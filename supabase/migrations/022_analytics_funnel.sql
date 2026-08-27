-- Migration 022: o funil, da visita ate a doacao de 10k+ DOG.
--
-- A conversao do DogData nao e um clique: e uma transacao na Bitcoin. O funil
-- por isso tem duas metades que so se encontram no meio:
--
--   visita → viu a oferta → copiou o endereco → conectou carteira  [navegador]
--                                                      ↕
--                                     analytics_identity (prova de posse)
--                                                      ↕
--                                        doacao >= 10k DOG          [cadeia]
--
-- Quem doa sem nunca conectar carteira aparece como 'sem_atribuicao'. Isso e
-- informacao, nao falha: e a fatia do dinheiro que chegou por um caminho que
-- nao sabemos medir, e ela tem que aparecer com esse nome em vez de sumir da
-- conta e fazer os canais medidos parecerem melhores do que sao.

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_doacoes — as doacoes on-chain, uma linha por (tx, doador)
-- ═══════════════════════════════════════════════════════════════════════════
-- Reproduz em SQL a leitura que /api/donate/leaderboard faz em TypeScript,
-- inclusive as duas guardas que importam:
--
--  · SAQUE. Se a carteira da obra aparece entre os REMETENTES, a tx nao e
--    doacao: e retirada ou movimento interno. Sem essa guarda o troco que
--    volta pra propria carteira contaria como doacao nova e o destino do saque
--    viraria "doador".
--  · CODIFICACAO DUPLA. senders e receivers sao jsonb que guardam uma STRING
--    JSON, nao um array. Ler direto devolve escalar e a soma da zero calado.
--
-- ⚠️ ARMADILHA MEDIDA (27/08). `w = any(addresses)` NAO usa o indice GIN
-- idx_dog_tx_addresses; so o operador de continencia `addresses @> array[w]`
-- usa. Com dog_transactions em 1.007.234 linhas e 1,4 GB (o `535` do catalogo
-- do Supabase esta obsoleto), a diferenca medida foi 20.091 ms de varredura
-- sequencial contra 12,75 ms — e o funil chama esta funcao cinco vezes, o que
-- estourava o tempo limite. E a mesma classe de erro do incidente de IO de
-- 26/08. O endereco entra LITERAL, sem CTE: uma CTE que carrega o valor vira
-- barreira de otimizacao e o planejador perde o indice.
--
-- Se a regra do leaderboard mudar, esta funcao muda junto: sao os mesmos
-- numeros vistos de dois lugares, e diverge-los seria pior que nao ter.
create or replace function public.analytics_doacoes()
returns table (
  txid text, block_height int, ocorreu_em timestamptz,
  address text, amount_dog numeric, acumulado numeric
)
language sql stable security definer set search_path = public as $fn$
  with tx as (
    select t.txid, t.block_height, t.timestamp,
      case when jsonb_typeof(t.senders)   = 'string' then (t.senders   #>> '{}')::jsonb else t.senders   end as s,
      case when jsonb_typeof(t.receivers) = 'string' then (t.receivers #>> '{}')::jsonb else t.receivers end as r
    from public.dog_transactions t
    where t.addresses @> array['bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p']
  ),
  medido as (
    select tx.*,
      (select coalesce(sum((e->>'amount_dog')::numeric), 0)
         from jsonb_array_elements(tx.r) e
        where e->>'address' = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p') as valor,
      exists (select 1 from jsonb_array_elements(tx.s) e
               where e->>'address' = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p') as e_saque
    from tx
    where jsonb_typeof(tx.r) = 'array'
  ),
  doadores as (
    select m.txid, m.block_height, m.timestamp, m.valor,
      array(select distinct e->>'address' from jsonb_array_elements(m.s) e
             where e->>'address' is not null
               and e->>'address' <> 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p') as addrs
    from medido m
    where not m.e_saque and m.valor > 0 and jsonb_typeof(m.s) = 'array'
  ),
  -- Tx com mais de um remetente reparte o valor por igual. Mesma convencao do
  -- leaderboard: sem saber qual entrada pagou o que, dividir e a unica
  -- atribuicao que nao inventa um doador maior do que existiu.
  planas as (
    select d.txid, d.block_height, d.timestamp, a as address,
           d.valor / greatest(array_length(d.addrs, 1), 1) as amount_dog
    from doadores d, unnest(d.addrs) a
    where array_length(d.addrs, 1) > 0
  )
  select txid, block_height, timestamp, address, amount_dog,
         sum(amount_dog) over (partition by address order by timestamp, block_height
                               rows between unbounded preceding and current row)
  from planas;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_funnel_etapas — a contagem das cinco etapas
-- ═══════════════════════════════════════════════════════════════════════════
-- Sao cinco consultas independentes que so existem pra montar um array, e
-- deixa-las inline empurrava o resto do relatorio pra baixo de 40 linhas de
-- SELECT. Aqui separadas, analytics_funnel fica so com o que cruza navegador
-- com cadeia.
--
-- Os rotulos LEVAM ACENTO. O resto deste banco fica sem, de proposito (evita
-- dor de cabeca com collation e com ferramenta que normaliza mal), mas estes
-- cinco textos vao direto pra tela do painel e isso nao pode vazar pro que o
-- fundador le.
create or replace function public.analytics_funnel_etapas(v_ini timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare n_sessoes int; n_oferta int; n_copia int; n_carteira int; n_doacao int;
begin
  select count(*) into n_sessoes from public.analytics_sessions
   where started_at >= v_ini and is_bot = false;

  -- "Viu a oferta" = passou por alguma pagina que mostra a escada de licencas.
  select count(distinct session_id) into n_oferta from public.page_events
   where created_at >= v_ini and event_type = 'pageview' and is_bot = false
     and (page = '/' or page like '/dogcity%' or page like '/landing%' or page like '/donate%');

  select count(distinct session_id) into n_copia from public.page_events
   where created_at >= v_ini and event_type = 'event' and is_bot = false
     and event_name = 'donate_address_copied';

  select count(distinct session_id) into n_carteira from public.page_events
   where created_at >= v_ini and event_type = 'event' and is_bot = false
     and event_name = 'wallet_connected';

  select count(distinct address) into n_doacao from public.analytics_doacoes()
   where ocorreu_em >= v_ini and acumulado >= 10000;

  return jsonb_build_array(
    jsonb_build_object('etapa', 'Sessões',            'n', n_sessoes),
    jsonb_build_object('etapa', 'Viu a oferta',       'n', n_oferta),
    jsonb_build_object('etapa', 'Copiou o endereço',  'n', n_copia),
    jsonb_build_object('etapa', 'Conectou carteira',  'n', n_carteira),
    jsonb_build_object('etapa', 'Doou 10k+ DOG',      'n', n_doacao));
end;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════
-- analytics_funnel — o cruzamento entre navegador e cadeia
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTA sobre round(): percentile_cont e sum() sobre double precision devolvem
-- double precision, e round(x, n) so existe pra numeric. Todo round de duas
-- casas aqui leva ::numeric — sem ele a funcao inteira falha e o painel perde
-- a aba, nao so o numero.
create or replace function public.analytics_funnel(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_ini timestamptz := now() - make_interval(days => v_days);
  v_doacoes jsonb; v_atrib jsonb; v_por_canal jsonb; v_tempo jsonb;
begin
  select jsonb_build_object(
    'doacoes', count(*), 'doadores', count(distinct address),
    'total_dog', round(coalesce(sum(amount_dog), 0)::numeric, 2),
    'ticket_mediano', round(coalesce(percentile_cont(0.5) within group (order by amount_dog), 0)::numeric, 2),
    'cruzaram_10k', count(distinct address) filter (where acumulado >= 10000)
  ) into v_doacoes
  from public.analytics_doacoes() where ocorreu_em >= v_ini;

  select jsonb_build_object(
    'atribuidas', count(*) filter (where i.visitor_id is not null),
    'sem_atribuicao', count(*) filter (where i.visitor_id is null),
    'dog_atribuido', round(coalesce(sum(d.amount_dog) filter (where i.visitor_id is not null), 0)::numeric, 2),
    'dog_sem_atribuicao', round(coalesce(sum(d.amount_dog) filter (where i.visitor_id is null), 0)::numeric, 2)
  ) into v_atrib
  from public.analytics_doacoes() d
  left join public.analytics_identity i on lower(i.address) = lower(d.address)
  where d.ocorreu_em >= v_ini;

  -- De qual canal veio o dinheiro. first_channel e o PRIMEIRO toque do
  -- visitante, nao o ultimo: e ele que responde "o que trouxe essa pessoa".
  select coalesce(jsonb_agg(x order by x.dog desc), '[]'::jsonb) into v_por_canal from (
    select coalesce(v.first_channel, '(nao atribuido)') as canal,
           count(distinct d.address) as doadores,
           round(sum(d.amount_dog)::numeric, 2) as dog
    from public.analytics_doacoes() d
    left join public.analytics_identity i on lower(i.address) = lower(d.address)
    left join public.analytics_visitors  v on v.visitor_id = i.visitor_id
    where d.ocorreu_em >= v_ini group by 1) x;

  -- Quanto tempo entre a primeira visita e a doacao: diz se a decisao e de
  -- impulso ou de maturacao, e portanto se vale insistir em quem ja veio.
  select jsonb_build_object(
    'amostras', count(*),
    'horas_mediana', round(percentile_cont(0.5) within group (
        order by extract(epoch from (d.ocorreu_em - v.first_seen_at)) / 3600.0)::numeric, 1)
  ) into v_tempo
  from public.analytics_doacoes() d
  join public.analytics_identity i on lower(i.address) = lower(d.address)
  join public.analytics_visitors  v on v.visitor_id = i.visitor_id
  where d.ocorreu_em >= v_ini and d.ocorreu_em > v.first_seen_at;

  return jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'de', v_ini, 'ate', now()),
    'etapas', public.analytics_funnel_etapas(v_ini),
    'doacoes', v_doacoes, 'atribuicao', v_atrib,
    'por_canal', v_por_canal, 'tempo_ate_doar', v_tempo);
end;
$fn$;

revoke all on function public.analytics_doacoes()   from public, anon, authenticated;
revoke all on function public.analytics_funnel(int) from public, anon, authenticated;
revoke all on function public.analytics_funnel_etapas(timestamptz) from public, anon, authenticated;

comment on function public.analytics_doacoes is
  'Doacoes on-chain para a carteira da obra, uma linha por (tx, doador), com acumulado por endereco. Mesma regra de /api/donate/leaderboard, inclusive a guarda de saque e a decodificacao dupla de senders/receivers. Usa @> para casar com o indice GIN.';
comment on function public.analytics_funnel is
  'Funil da visita ate a doacao de 10k+ DOG. Une navegador e cadeia por analytics_identity; doador que nunca conectou carteira aparece como sem_atribuicao em vez de sumir.';
