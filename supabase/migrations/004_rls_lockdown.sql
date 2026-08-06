-- Migration: fecha a escrita anonima. Ver docs/supabase-auditoria-2026-08-06.md §8.
--
-- ⚠️ ORDEM: só rode DEPOIS que o deploy com a mudanca de lib/supabase.ts estiver
-- no ar. Aquele commit troca a chave anon pela service role em todo consumidor
-- server-side. Rodar antes derruba analytics/track e ads/track na hora.
--
-- MOTIVO, medido em 2026-08-06 com a chave anon e nada mais:
--
--     DELETE /rest/v1/dog_transactions   ->  HTTP 204
--     PATCH  /rest/v1/dog_transactions   ->  HTTP 204
--
-- Nove tabelas aceitavam escrita anonima, incluindo as 469.234 linhas que sao a
-- fonte de verdade do explorer. Nada no app depende de acesso anon: tudo roda em
-- rota de servidor, e a service role ignora RLS. Entao a postura correta e a
-- mais simples: RLS ligado e ZERO policies. O papel anon fica sem nada.

do $$
declare t text;
begin
  foreach t in array array[
    'dog_transactions', 'page_events', 'ad_events',
    'dog_metrics_history', 'stacks_metrics_history',
    'tx_class_block', 'tx_class_daily',
    'dogcity_events', 'dogcity_cursors'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- View SECURITY DEFINER: roda com o privilegio de quem criou e portanto passa
-- por cima do RLS de quem consulta. security_invoker devolve a checagem ao
-- chamador, que e o comportamento esperado de uma view de agregado publico.
alter view public.tx_class_daily_pct set (security_invoker = on);

-- ═══ CONFERENCIA ═══════════════════════════════════════════════════════════
-- Deve listar as 12 tabelas com rowsecurity = true:
--
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r'
--   order by relrowsecurity, relname;
--
-- Depois disso, um DELETE com a chave anon passa a responder 401/403 em vez de
-- 204, e o painel Advisors zera os alertas de RLS.
--
-- ═══ ROLLBACK ══════════════════════════════════════════════════════════════
-- Se algo server-side quebrar por falta da service role em producao:
--
--   alter table public.<tabela> disable row level security;
