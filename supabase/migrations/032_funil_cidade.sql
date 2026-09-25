-- Migration 032: o funil ganha a cidade ("Entered the city" e "Found their lot").
--
-- ⚠️ NAO APLICADA. Escrita pela frente FS2 da troca da /city
-- (dogcity-mundo/LIGAR.md, FS2 e secao 2.3 passo 5). Quem aplica e o
-- fundador, pelo painel do Supabase ou pelo MCP, depois do merge. No plano ela
-- se chama "028", mas o numero 028 ja foi consumido pela 027 ("Migration
-- 027+028") e o repositorio segue em 031: por isso 032.
--
-- O QUE MUDA: so `analytics_funnel_etapas`. As cinco etapas de antes ficam
-- iguais, com o mesmo texto (os de 030, em ingles, que sao os que estao no
-- banco hoje; conferido com pg_get_functiondef em 24/09), e duas entram
-- DEPOIS de "Saw the offer" e ANTES de "Copied the address":
--
--   Sessions → Saw the offer → Entered the city → Found their lot
--            → Copied the address → Connected a wallet → Donated 10k+ DOG
--
-- A cidade fica no meio porque e nela que o holder ve o proprio lote, e ver o
-- lote vem antes de doar pela licenca. `analytics_funnel` nao muda: ela so
-- repassa este array em 'etapas'.
--
-- DEFINICOES (as duas contam SESSOES distintas, como as etapas vizinhas):
--   · Entered the city: pageview com page = '/city' ou abaixo de '/city/'. O
--     jogo novo manda page '/city' (mesma serie da praca antiga, LIGAR.md F2);
--     as paginas Next que ficam sob /city ('/city/war', '/city/mapa') tambem
--     contam. `like '/city%'` puro pegaria '/cityfoo', por isso as duas
--     condicoes. As duas consultas novas foram conferidas contra o banco em
--     24/09 numa janela de 1 dia, so leitura: 11 sessoes na cidade, 0 lotes.
--   · Found their lot: evento `find_my_lot` com `event_meta.found = true`
--     (booleano JSON). E o evento do FIND MY LOT e do `?addr=` do jogo
--     (LIGAR.md F11b). Procurar e nao achar NAO conta: a etapa e "achou".
--
-- ⚠️ SERIE SEM PASSADO: a praca antiga nunca mandou `find_my_lot`, entao
-- "Found their lot" nasce em zero e so enche quando o jogo novo (F11b) estiver
-- no ar. "Entered the city" ja conta hoje (o tracker do layout do Next manda
-- page '/city' da praca antiga); no dia da troca ela passa a depender do jogo
-- mandar o pageview (F2): sem isso a etapa cai a zero e parece queda.
--
-- ⚠️ CUSTO: as duas consultas novas tem a forma exata das vizinhas (faixa de
-- created_at por idx_page_events_type e idx_page_events_name, filtro por
-- is_bot), sem varredura nova. A funcao so roda quando o painel /admin abre
-- a aba de conversao.
--
-- COMPATIBILIDADE com o painel: app/admin/analytics/conversao.tsx acha as
-- etapas do meio pelo NOME, nao pela posicao (mudado junto, na mesma branch),
-- entao o painel le certo com 5 ou com 7 etapas, antes e depois de aplicar.

create or replace function public.analytics_funnel_etapas(v_ini timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  n_sessoes int; n_oferta int; n_cidade int; n_lote int;
  n_copia int; n_carteira int; n_doacao int;
begin
  select count(*) into n_sessoes from public.analytics_sessions
   where started_at >= v_ini and is_bot = false;

  -- "Viu a oferta" = passou por alguma pagina que mostra a escada de licencas.
  select count(distinct session_id) into n_oferta from public.page_events
   where created_at >= v_ini and event_type = 'pageview' and is_bot = false
     and (page = '/' or page like '/dogcity%' or page like '/landing%' or page like '/donate%');

  -- "Entrou na cidade" = pageview da /city (jogo novo ou praca antiga).
  select count(distinct session_id) into n_cidade from public.page_events
   where created_at >= v_ini and event_type = 'pageview' and is_bot = false
     and (page = '/city' or page like '/city/%');

  -- "Achou o lote" = o FIND MY LOT (ou o ?addr=) caiu num lote.
  select count(distinct session_id) into n_lote from public.page_events
   where created_at >= v_ini and event_type = 'event' and is_bot = false
     and event_name = 'find_my_lot'
     and event_meta->>'found' = 'true';

  select count(distinct session_id) into n_copia from public.page_events
   where created_at >= v_ini and event_type = 'event' and is_bot = false
     and event_name = 'donate_address_copied';

  select count(distinct session_id) into n_carteira from public.page_events
   where created_at >= v_ini and event_type = 'event' and is_bot = false
     and event_name = 'wallet_connected';

  select count(distinct address) into n_doacao from public.analytics_doacoes()
   where ocorreu_em >= v_ini and acumulado >= 10000;

  return jsonb_build_array(
    jsonb_build_object('etapa', 'Sessions',           'n', n_sessoes),
    jsonb_build_object('etapa', 'Saw the offer',      'n', n_oferta),
    jsonb_build_object('etapa', 'Entered the city',   'n', n_cidade),
    jsonb_build_object('etapa', 'Found their lot',    'n', n_lote),
    jsonb_build_object('etapa', 'Copied the address', 'n', n_copia),
    jsonb_build_object('etapa', 'Connected a wallet', 'n', n_carteira),
    jsonb_build_object('etapa', 'Donated 10k+ DOG',   'n', n_doacao));
end;
$fn$;

-- create or replace mantem as permissoes, mas a funcao e security definer e
-- nao pode ficar exposta ao anon por acidente num banco recriado
revoke all on function public.analytics_funnel_etapas(timestamptz) from public, anon, authenticated;

comment on function public.analytics_funnel_etapas is
  'Etapas do funil em sessoes distintas: Sessions, Saw the offer, Entered the city, Found their lot, Copied the address, Connected a wallet, Donated 10k+ DOG (enderecos). Rotulos em ingles porque vao direto para a tela (migracao 030).';
