-- Migration: separa log bruto de rollup diario, e agrega no servidor
-- Run in Supabase SQL Editor (Dashboard -> SQL -> New Query)
--
-- POR QUE ISTO EXISTE
--
-- /api/status/full paginava system_health_log de 1.000 em 1.000 ate um teto de
-- 100.000 linhas, sob este comentario no codigo:
--
--     const HARD_CAP = 100_000 // safety stop; today's table is ~7k rows / 90d
--
-- Medido em 2026-08-06: a janela de 90 dias tem 309.069 linhas e a tabela
-- cresce 4.070 por dia. A estimativa errou por 50x, com duas consequencias.
--
--   1. Custo. Cada carregamento fazia ate 100 consultas sequenciais e puxava
--      ~15 MB. A pagina se re-consulta a cada 30s contra um cache s-maxage=30,
--      entao quase toda sondagem era um miss. Uma aba aberta valia algo na
--      ordem de 1,8 GB/hora de egress.
--   2. Correcao. O teto de 100.000 cortava antes dos 90 dias: a barra dizia
--      "90 dias" mostrando uns 24, silenciosamente.
--
-- E nenhuma daquelas linhas chegava ao cliente. Elas viravam quatro numeros por
-- componente: ultimo estado, uptime de 30 dias, uptime de 90 dias e um balde
-- por dia.
--
-- O DESENHO
--
-- Podar o log bruto sozinho nao resolvia: para sustentar a barra de 90 dias era
-- preciso guardar 90 dias de linha bruta, o que estabiliza em ~366.000 linhas.
-- Entao o log bruto e o rollup viram coisas separadas.
--
--   system_health_log    detalhe, curta duracao (14 dias, ~57.000 linhas)
--   system_health_daily  um balde por componente por dia, guardado para sempre
--                        (~28 componentes x 365 dias = ~10.000 linhas/ano)
--
-- A barra passa a ler o rollup. O log bruto existe para investigar incidente
-- recente, que e a unica coisa para que ele serve depois de fechado o dia.

-- ─── 1. Indice que faltava ───────────────────────────────────────────────────
-- (component, checked_at desc) serve o DISTINCT ON do health_latest e o filtro
-- de janela do rollup. Nao existia: as consultas varriam a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_health_component_checked
  ON system_health_log (component, checked_at DESC);

-- ─── 2. Tabela de rollup ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_health_daily (
  component      text    NOT NULL,
  day            date    NOT NULL,
  total          integer NOT NULL DEFAULT 0,
  ok_count       integer NOT NULL DEFAULT 0,
  degraded_count integer NOT NULL DEFAULT 0,
  down_count     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (component, day)
);

ALTER TABLE system_health_daily ENABLE ROW LEVEL SECURITY;

-- ─── 3. Rollup ───────────────────────────────────────────────────────────────
-- Recompoe os ultimos p_days dias a partir do log bruto. Idempotente: recalcula
-- o balde inteiro em vez de somar, entao rodar duas vezes no mesmo dia nao
-- duplica contagem.
--
-- O dia e calculado em UTC de proposito, para casar com o dayKey() do
-- TypeScript, que usa toISOString().slice(0,10). Se um lado virar hora local e
-- o outro nao, o balde da direita da barra pisca no fuso errado.
CREATE OR REPLACE FUNCTION health_rollup(p_days int DEFAULT 3)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched bigint;
BEGIN
  INSERT INTO system_health_daily AS d (component, day, total, ok_count, degraded_count, down_count)
  SELECT
    l.component,
    (l.checked_at AT TIME ZONE 'UTC')::date,
    count(*),
    count(*) FILTER (WHERE l.status = 'ok'),
    count(*) FILTER (WHERE l.status = 'degraded'),
    count(*) FILTER (WHERE l.status = 'down')
  FROM system_health_log l
  WHERE l.checked_at >= now() - make_interval(days => p_days)
  GROUP BY 1, 2
  ON CONFLICT (component, day) DO UPDATE SET
    total          = EXCLUDED.total,
    ok_count       = EXCLUDED.ok_count,
    degraded_count = EXCLUDED.degraded_count,
    down_count     = EXCLUDED.down_count;
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

-- ─── 4. Leitura da barra ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION health_daily(p_days int DEFAULT 90)
RETURNS TABLE (
  component      text,
  day            date,
  total          bigint,
  ok_count       bigint,
  degraded_count bigint,
  down_count     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.component,
    d.day,
    d.total::bigint,
    d.ok_count::bigint,
    d.degraded_count::bigint,
    d.down_count::bigint
  FROM system_health_daily d
  WHERE d.day >= (now() AT TIME ZONE 'UTC')::date - p_days;
$$;

-- ─── 5. Ultimo registro de cada componente ───────────────────────────────────
-- SETOF da propria tabela em vez de declarar coluna a coluna, para nao quebrar
-- se um tipo mudar na origem.
CREATE OR REPLACE FUNCTION health_latest()
RETURNS SETOF system_health_log
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (component) *
  FROM system_health_log
  ORDER BY component, checked_at DESC;
$$;

-- ─── 6. Poda do log bruto ────────────────────────────────────────────────────
-- So e seguro depois que o rollup do periodo ja rodou. health_maintain() abaixo
-- garante a ordem; nao chame health_prune sozinho.
CREATE OR REPLACE FUNCTION health_prune(p_keep_days int DEFAULT 14)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed bigint;
BEGIN
  DELETE FROM system_health_log
  WHERE checked_at < now() - make_interval(days => p_keep_days);
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- ─── 7. Manutencao, na ordem certa ───────────────────────────────────────────
-- Rollup primeiro, poda depois. p_rollup_days e maior que 1 de proposito, para
-- reconsolidar ontem caso a ultima execucao do dia anterior tenha falhado.
CREATE OR REPLACE FUNCTION health_maintain(p_keep_days int DEFAULT 14, p_rollup_days int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rolled  bigint;
  removed bigint;
BEGIN
  rolled  := health_rollup(p_rollup_days);
  removed := health_prune(p_keep_days);
  RETURN jsonb_build_object('rolled_up', rolled, 'pruned', removed);
END;
$$;

-- ─── 8. Permissoes ───────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION health_daily(int)        TO service_role;
GRANT EXECUTE ON FUNCTION health_latest()          TO service_role;
GRANT EXECUTE ON FUNCTION health_rollup(int)       TO service_role;
GRANT EXECUTE ON FUNCTION health_prune(int)        TO service_role;
GRANT EXECUTE ON FUNCTION health_maintain(int,int) TO service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- COMO APLICAR, NESTA ORDEM
--
-- 1. Rode tudo acima.
--
-- 2. Backfill do rollup a partir de TODO o historico bruto existente. Isto e o
--    que preserva a barra de 90 dias antes de qualquer poda:
--
--       select health_rollup(400);
--
--    Confira antes de seguir. Deve voltar algo perto de 28 componentes vezes o
--    numero de dias de historico:
--
--       select count(*) from system_health_daily;
--       select min(day), max(day) from system_health_daily;
--
-- 3. So depois de conferir, pode o bruto:
--
--       select health_prune(14);
--       vacuum full system_health_log;
--
--    Sem o VACUUM FULL o DELETE marca as linhas como mortas mas o arquivo nao
--    encolhe, entao o painel de uso continua mostrando o tamanho antigo.
--    VACUUM FULL trava a tabela enquanto roda; nesta escala sao segundos.
--
-- 4. Confira que a leitura da barra ficou barata:
--
--       select count(*) from health_daily(90);   -- espera ~2.500, nao 309.069
--       select count(*) from health_latest();    -- espera ~28
--
-- 5. A manutencao continua sozinha: /cron/health-probes chama health_maintain()
--    a cada 10 minutos.
