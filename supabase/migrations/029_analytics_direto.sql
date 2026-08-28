-- Migration 029: abrir a caixa preta do "Direto".
--
-- "Direto" e 68% do trafego do DogData (2.683 de 3.926 sessoes em 30 dias) e na
-- aba de Aquisicao era uma linha so, sem nada dentro. Isso e um problema porque
-- "Direto" quase nunca quer dizer "digitou o endereco": quer dizer "o navegador
-- nao mandou de onde veio". Causas comuns: link com rel="noreferrer", app
-- nativo, cliente de email, QR code, https->http.
--
-- O caso concreto que motivou isto: o DogData e o explorer oficial da DOG no
-- CoinMarketCap, e o CMC poe rel="noreferrer" nos links de explorer. Entao a
-- listagem mais valiosa do site chega TOTALMENTE anonima. Medido: zero mencao a
-- coinmarketcap em referrer ou utm, em 43 mil eventos.
--
-- O que da pra fazer sem inventar atribuicao: mostrar em QUE PAGINA o trafego
-- direto aterrissa. Origem externa que manda gente pra pagina profunda e
-- especifica (/holders) tem forma completamente diferente de quem digitou o
-- dominio (que cai em /). Medido em 30 dias, dentro do MESMO balde "Direto":
--
--     /holders   797 sessoes   73,9% de rejeicao   1,68 paginas/sessao
--     /          830 sessoes    8,1% de rejeicao   3,18 paginas/sessao
--
-- Duas populacoes completamente diferentes na mesma linha. O painel nao afirma
-- "isto e CMC" — afirma "isto entra por /holders sem dizer de onde vem", que e
-- o fato, e deixa a leitura pra quem sabe o que foi publicado onde.
--
-- ⚠️ A correcao DE VERDADE nao e esta funcao, e por UTM no link submetido ao
-- CMC: ?utm_source=coinmarketcap&utm_medium=referral. Enquanto isso nao existe,
-- isto e a melhor aproximacao honesta possivel — e nenhuma ferramenta de
-- analytics do mercado consegue melhor, porque o dado nao chega.
--
-- Nota de SQL: `profundidade` mora numa camada EXTERNA de proposito. Calculada
-- junto dos agregados ela referencia entry_page cru, que nao esta no GROUP BY
-- (o group e sobre o coalesce), e o Postgres recusa.
create or replace function public.analytics_direto(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_ini timestamptz := now() - make_interval(days => v_days);
begin
  return coalesce((
    select jsonb_agg(y order by y.sessoes desc) from (
      select x.*,
        -- quem digita o dominio cai em '/' (profundidade 1); quem veio de link
        -- externo cai fundo. E o unico discriminante que os dados oferecem sem
        -- atribuicao declarada.
        (length(x.pagina) - length(replace(x.pagina, '/', ''))) as profundidade
      from (
        select
          coalesce(entry_page, '/') as pagina,
          count(*) as sessoes,
          round(100.0 * count(*) filter (
            where not (pageviews >= 2 or coalesce(engaged_ms,0) >= 10000 or events >= 1)
          ) / nullif(count(*),0), 1) as rejeicao,
          round(avg(pageviews)::numeric, 2) as paginas_sessao,
          round((avg(engaged_ms) filter (where engaged_ms is not null))::numeric / 1000.0, 1) as duracao_s
        from public.analytics_sessions
        where started_at >= v_ini and is_bot = false
          and (referrer is null or referrer = '')
        group by 1
        order by 2 desc limit 12
      ) x
    ) y
  ), '[]'::jsonb);
end;
$fn$;

revoke all on function public.analytics_direto(int) from public, anon, authenticated;

comment on function public.analytics_direto is
  'Abre o balde "Direto" por pagina de entrada. Nao atribui origem — mostra a FORMA do trafego sem referrer, porque link com rel=noreferrer (caso do CoinMarketCap) chega indistinguivel de quem digitou o dominio.';
