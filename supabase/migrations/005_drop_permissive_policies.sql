-- Migration: remove as policies permissivas que sobreviveram à 004.
--
-- ⚠️⚠️ NÃO RODE AINDA. Pré-requisito, e ele já falhou uma vez:
--
--   O commit que troca a chave anon pela service role em lib/supabase.ts e nas
--   rotas de métricas TEM que estar EM PRODUÇÃO antes. Na 004 isso não foi
--   conferido, o SQL entrou antes do deploy, e analytics/report e ads/report
--   passaram a devolver zero com as tabelas cheias.
--
--   Como conferir, sem SQL: as duas rotas abaixo têm que voltar número > 0.
--
--     curl -s https://www.dogdata.xyz/api/analytics/report | grep pageviews
--     curl -s https://www.dogdata.xyz/api/ads/report       | grep impressions
--
--   Se vier 0, o deploy ainda não saiu. Espere.
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- A 004 ligou RLS nas nove tabelas, e nove das doze ficaram fechadas. Três não:
-- `dog_transactions`, `tx_class_block` e `tx_class_daily` já tinham policies
-- permissivas criadas antes, que estavam dormentes enquanto o RLS estava
-- desligado e acordaram junto com ele.
--
-- Medido com a chave anon, tentando inserir uma linha que já existe (nada é
-- gravado nos dois desfechos: ou o RLS barra, ou a chave duplicada barra):
--
--     dog_transactions   -> 23505, chave duplicada   ESCRITA PERMITIDA
--     tx_class_block     -> 23505                     ESCRITA PERMITIDA
--     tx_class_daily     -> 23505                     ESCRITA PERMITIDA
--     as outras nove     -> 42501, violação de RLS    bloqueadas
--
-- Todo acesso do app é server-side com service role, que ignora RLS. Então
-- nenhuma policy é necessária, e a postura correta é não ter nenhuma.
--
-- Dropa por varredura em vez de por nome porque os nomes foram criados fora
-- deste repositório e não estão versionados em lugar nenhum.

do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('dog_transactions', 'tx_class_block', 'tx_class_daily')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ═══ CONFERÊNCIA ═══════════════════════════════════════════════════════════
-- Tem que voltar zero linhas:
--
--   select tablename, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('dog_transactions','tx_class_block','tx_class_daily');
--
-- ═══ ROLLBACK ══════════════════════════════════════════════════════════════
-- Não há rollback: os nomes e as expressões das policies antigas não foram
-- preservados. Se algum consumidor anônimo aparecer depois, a recriação certa
-- é uma policy de leitura explícita, nunca de escrita:
--
--   create policy anon_read on public.dog_transactions
--     for select to anon using (true);
