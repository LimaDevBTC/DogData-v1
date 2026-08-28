-- Migration 026: sessao sem identidade PRECISA existir mesmo assim.
--
-- BUG, achado porque o fundador estranhou "706 sessoes para 122 visitantes".
-- analytics_ingest (migracao 020) tinha:
--
--     if v_type = 'vital' or v_vid is null then return ...; end if;
--
-- ANTES de gravar a sessao. A intencao era pular o upsert do VISITANTE quando
-- nao ha id — mas a guarda pulava a SESSAO junto. Quem navega com localStorage
-- bloqueado (aba anonima, ITP do Safari, webview de app) tem visitorId() nulo
-- no cliente, e a visita inteira sumia de analytics_sessions.
--
-- Medido nas primeiras 7h de producao: 12 sessoes e 33 eventos, TODOS com
-- visitor_id nulo, vindos de BR, CH, DE e US em Chrome e Safari. Gente real,
-- invisivel em toda metrica que passa por analytics_sessions — que hoje e
-- quase o painel inteiro. O site nao pode obrigar ninguem a aceitar storage,
-- entao esse buraco so cresceria.
--
-- Agora a guarda separa as duas coisas: o VISITANTE so entra se tiver id; a
-- SESSAO entra sempre. E is_new_visitor vira NULL nesse caso, nao false —
-- "nao da pra saber se e novo" nao e "nao e novo", mesma regra de NULL que
-- vale pra duracao e pra identidade desde a 024.
--
-- Duas correcoes menores que vieram junto, no ON CONFLICT da sessao:
--  · engaged_ms e max_scroll_pct agora usam coalesce(...,0) antes de somar,
--    porque a 022 tornou as duas colunas anulaveis e somar em NULL apagaria o
--    acumulado da sessao;
--  · visitor_id = coalesce(s.visitor_id, v_vid): uma sessao que comeca sem
--    identidade e ganha depois (storage liberado no meio da visita) passa a ter
--    dono, mas nunca troca de dono.

create or replace function public.analytics_ingest(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type     text := p->>'event_type';
  v_sid      text := nullif(p->>'session_id', '');
  v_vid      text := nullif(p->>'visitor_id', '');
  v_ua       text := nullif(p->>'user_agent', '');
  v_ref      text := nullif(p->>'referrer', '');
  v_page     text := coalesce(nullif(p->>'page', ''), '/');
  v_utm_s    text := nullif(p->>'utm_source', '');
  v_utm_m    text := nullif(p->>'utm_medium', '');
  v_utm_c    text := nullif(p->>'utm_campaign', '');
  v_bot_why  text;
  v_is_bot   boolean;
  v_channel  text;
  v_dur      int  := greatest(0, least(coalesce((p->>'duration_ms')::int, 0), 1800000));
  v_scroll   int  := greatest(0, least(coalesce((p->>'scroll_pct')::int, 0), 100));
  v_is_new   boolean := null;
  v_new_sess boolean := false;
begin
  if v_type is null or v_type not in ('pageview','vital','engagement','event') then
    return jsonb_build_object('ok', false, 'error', 'event_type invalido');
  end if;

  -- Novidade de visitante e de sessao sao resolvidas ANTES de qualquer insert.
  -- Tentar deduzir depois, por RETURNING de um ON CONFLICT ou comparando
  -- first_seen_at com last_seen_at, e ambiguo: os dois carimbam o MESMO now()
  -- na linha recem-nascida, entao a comparacao responde "novo" pra sempre.
  if v_vid is not null then
    select not exists (select 1 from public.analytics_visitors where visitor_id = v_vid)
      into v_is_new;
  end if;
  if v_sid is not null then
    select not exists (select 1 from public.analytics_sessions where session_id = v_sid)
      into v_new_sess;
  end if;

  v_bot_why := public.analytics_bot_reason(v_ua);
  v_is_bot  := v_bot_why is not null;
  v_channel := public.analytics_channel(v_ref, v_utm_s, v_utm_m, v_utm_c);

  -- ── o evento cru ────────────────────────────────────────────────────────
  insert into public.page_events (
    event_type, page, referrer, country, city, region,
    device_type, browser, os, session_id, visitor_id,
    screen_w, screen_h, viewport_w, viewport_h, language, user_agent,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, channel,
    is_bot, bot_reason,
    vital_name, vital_value, vital_rating,
    duration_ms, scroll_pct, event_name, event_value, event_meta
  ) values (
    v_type, v_page, v_ref,
    nullif(p->>'country',''), nullif(p->>'city',''), nullif(p->>'region',''),
    nullif(p->>'device_type',''), nullif(p->>'browser',''), nullif(p->>'os',''),
    v_sid, v_vid,
    (p->>'screen_w')::int, (p->>'screen_h')::int,
    (p->>'viewport_w')::int, (p->>'viewport_h')::int,
    nullif(p->>'language',''), v_ua,
    v_utm_s, v_utm_m, v_utm_c, nullif(p->>'utm_term',''), nullif(p->>'utm_content',''), v_channel,
    v_is_bot, v_bot_why,
    nullif(p->>'vital_name',''), (p->>'vital_value')::real, nullif(p->>'vital_rating',''),
    nullif(v_dur, 0), nullif(v_scroll, 0),
    nullif(p->>'event_name',''), (p->>'event_value')::double precision, nullif(p->'event_meta', 'null'::jsonb)
  );

  -- Vital dispara uma vez por sessao e contaria como atividade que o visitante
  -- nao teve; so ELE sai cedo. A guarda de v_vid saiu daqui: ela pulava a
  -- sessao junto com o visitante, e era o bug desta migracao.
  if v_type = 'vital' then
    return jsonb_build_object('ok', true, 'bot', v_is_bot);
  end if;

  -- ── o visitante: SO se houver identidade ───────────────────────────────
  if v_vid is not null then
    -- Primeiro toque so entra no INSERT. O DO UPDATE nao toca em nenhuma coluna
    -- first_*: e isso que faz "de onde veio quem doou" continuar respondendo a
    -- origem real seis meses depois, e nao a ultima aba que a pessoa abriu.
    insert into public.analytics_visitors as av (
      visitor_id, first_seen_at, last_seen_at, sessions, pageviews, engaged_ms,
      first_channel, first_referrer, first_page,
      first_utm_source, first_utm_medium, first_utm_campaign, first_country,
      last_channel, last_country, last_device, is_bot
    ) values (
      v_vid, now(), now(),
      case when v_new_sess then 1 else 0 end,
      case when v_type = 'pageview' then 1 else 0 end,
      case when v_type = 'engagement' then v_dur else 0 end,
      v_channel, v_ref, v_page, v_utm_s, v_utm_m, v_utm_c, nullif(p->>'country',''),
      v_channel, nullif(p->>'country',''), nullif(p->>'device_type',''), v_is_bot
    )
    on conflict (visitor_id) do update set
      last_seen_at = now(),
      -- Ultimo toque e o canal da ultima SESSAO, nao do ultimo evento. Sem a
      -- guarda de v_new_sess, o segundo pageview de qualquer visita (navegacao
      -- interna nao carrega referrer) reclassificava o visitante como 'Direto' e
      -- apagava a origem da visita que estava acontecendo naquele instante.
      last_channel = case when v_new_sess then v_channel else av.last_channel end,
      last_country = coalesce(nullif(p->>'country',''), av.last_country),
      last_device  = coalesce(nullif(p->>'device_type',''), av.last_device),
      sessions     = av.sessions   + (case when v_new_sess then 1 else 0 end),
      pageviews    = av.pageviews  + (case when v_type = 'pageview' then 1 else 0 end),
      engaged_ms   = av.engaged_ms + (case when v_type = 'engagement' then v_dur else 0 end);
  end if;

  if v_sid is null then
    return jsonb_build_object('ok', true, 'bot', v_is_bot, 'new_visitor', v_is_new);
  end if;

  -- ── a sessao ────────────────────────────────────────────────────────────
  -- entry_page grava uma vez e nunca mais (coalesce guarda o valor antigo);
  -- exit_page anda a cada pageview, e o ultimo que sobrar e a saida de fato.
  insert into public.analytics_sessions as s (
    session_id, visitor_id, started_at, last_seen_at,
    pageviews, events, engaged_ms, max_scroll_pct,
    entry_page, exit_page,
    country, city, region, device_type, browser, os,
    referrer, channel, utm_source, utm_medium, utm_campaign,
    is_new_visitor, is_bot, bot_reason
  ) values (
    v_sid, v_vid, now(), now(),
    case when v_type = 'pageview' then 1 else 0 end,
    case when v_type = 'event' then 1 else 0 end,
    case when v_type = 'engagement' then v_dur else 0 end,
    v_scroll,
    v_page, v_page,
    nullif(p->>'country',''), nullif(p->>'city',''), nullif(p->>'region',''),
    nullif(p->>'device_type',''), nullif(p->>'browser',''), nullif(p->>'os',''),
    v_ref, v_channel, v_utm_s, v_utm_m, v_utm_c,
    v_is_new, v_is_bot, v_bot_why
  )
  on conflict (session_id) do update set
    last_seen_at   = now(),
    pageviews      = s.pageviews  + (case when v_type = 'pageview' then 1 else 0 end),
    events         = s.events     + (case when v_type = 'event' then 1 else 0 end),
    -- coalesce obrigatorio: a 022 tornou engaged_ms anulavel (NULL = nao
    -- medido), e somar em NULL apagaria o acumulado da sessao inteira.
    engaged_ms     = coalesce(s.engaged_ms, 0) + (case when v_type = 'engagement' then v_dur else 0 end),
    max_scroll_pct = greatest(coalesce(s.max_scroll_pct, 0), v_scroll),
    exit_page      = case when v_type = 'pageview' then v_page else s.exit_page end,
    country        = coalesce(s.country, nullif(p->>'country','')),
    city           = coalesce(s.city,    nullif(p->>'city','')),
    region         = coalesce(s.region,  nullif(p->>'region','')),
    os             = coalesce(s.os,      nullif(p->>'os','')),
    -- uma sessao que comeca sem identidade e ganha depois passa a ter dono,
    -- mas nunca troca de dono
    visitor_id     = coalesce(s.visitor_id, v_vid);

  return jsonb_build_object('ok', true, 'bot', v_is_bot, 'new_visitor', v_is_new);
end;
$$;


revoke all on function public.analytics_ingest(jsonb) from public, anon, authenticated;

comment on function public.analytics_ingest is
  'Ingestao de um evento em uma transacao: grava o evento cru e reconcilia analytics_sessions e analytics_visitors. A SESSAO e criada mesmo sem visitor_id (localStorage bloqueado); so o VISITANTE exige identidade.';
