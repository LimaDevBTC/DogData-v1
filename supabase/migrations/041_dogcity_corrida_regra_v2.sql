-- Migration 041: a regra do prêmio v2 da corrida da AN7 (DogCity). NÃO APLICADA: o fundador aplica.
-- Decisão do fundador (14/11/2026): assets_carros/projeto/CORRIDA_REGRA_V2.md. Substitui o campeonato com data e o desafio que premiava
-- desde a primeira volta. (A 040 já é a dos cards de novidades do jogo, game_news; esta vem depois.)
--
-- A REGRA, por modelo (os 18 carros da DOG MOTORS; Cyber e Moto2 rankeiam, sem prêmio):
--   1. Cada modelo tem o seu recorde na AN7 (race_records), independente dos outros.
--   2. ABERTURA: o modelo fica em abertura até 10 carteiras verificadas DIFERENTES terem pelo menos uma volta válida com ele. Nenhuma
--      volta é premiada na hora; o recorde só acompanha a melhor volta. Quando a 10ª carteira diferente fecha a primeira volta válida
--      dela, a abertura fecha: a MELHOR volta válida do modelo até aquele instante (de qualquer uma das 10, inclusive voltas repetidas
--      delas; empate: a mais antiga) leva o carro (race_prizes pending_review, fase 'abertura') e é o recorde. O vencedor pode ser OUTRA
--      carteira que a que fechou.
--   3. Depois da abertura: quem bater o recorde do modelo (ESTRITAMENTE mais rápido) com aquele modelo vira o dono do recorde e leva o
--      carro (fase 'desafio'), se ainda não tem prêmio daquele modelo.
--   4. Um carro de cada modelo por carteira (race_prizes_one_per_wallet_model; prêmio rejeitado não conta). Quem já tem o modelo bate o
--      próprio recorde e segue dono dele, sem carro novo; o próximo que bater e não tem, leva.
--   5. Sem teto semanal nem diário.
--   6. O prêmio só vai para a garagem depois da revisão (pending_review -> approved -> delivered).
--   7. Volta anulada depois (valid -> void) não conta para a abertura (enquanto ela não fechou) nem para o recorde (rodar
--      race_recompute_record, como antes).
--
-- O QUE ESTA MIGRATION FAZ
--   * race_prizes.phase passa a aceitar 'abertura' (mantém 'campeonato' e 'desafio', pelo histórico).
--   * race_openings: UMA linha por (pista, modelo) quando a abertura fecha (a volta que fechou, a volta vencedora, o prêmio criado). É o
--     que deixa o fechamento definitivo (anular voltas depois não reabre) e o finish repetido idempotente. Sem política: só o service role.
--   * race_finish_lap(p_lap_id, p_prize, p_needed): a função que o finish chama depois de gravar a volta válida. Uma transação, TRAVA por
--     (pista, modelo) (pg_advisory_xact_lock): o recorde (race_claim_record: só estritamente melhor), as carteiras diferentes com volta
--     válida, a fase, o prêmio (abertura fechando agora, ou recorde novo depois dela) e a posição. Devolve um jsonb com tudo que o
--     finish precisa. IDEMPOTENTE: repetir o finish da mesma volta devolve o mesmo e não cria nada; uma volta nunca recebe dois prêmios
--     (nem depois de um prêmio rejeitado). p_prize = false (Cyber, Moto2): só recorde, carteiras e posição, nunca prêmio nem abertura.
--   * NADA é apagado: race_championship e race_championship_best ficam, sem uso (a rota /close e o código do campeonato saíram).
--
-- ORDEM SEGURA: aplicar ANTES de mesclar o PR do código (o código novo chama race_finish_lap; sem ela o finish responde 503 e o cliente
-- repete). O código antigo segue funcionando depois desta migration (ela só alarga o check e acrescenta uma tabela e uma função).
--
-- VOLTAS DE TESTE: as voltas válidas de teste contam para a abertura. Antes do lançamento, anule-as (valid -> void) e refaça o recorde;
-- se uma abertura fechou por teste, desfaça-a assim (ato humano deliberado, nunca efeito de código):
--   begin;
--   update public.race_laps set status = 'void', void_reason = 'test' where track_id = 'an7-v1' and model = '<modelo>' and status = 'valid';
--   select public.race_recompute_record('an7-v1', '<modelo>');
--   update public.race_prizes set state = 'rejected', note = 'test' where track_id = 'an7-v1' and model = '<modelo>' and phase = 'abertura' and state = 'pending_review';
--   delete from public.race_openings where track_id = 'an7-v1' and model = '<modelo>';
--   commit;
-- Rejeitar o prêmio da abertura depois do fechamento (volta suspeita) NÃO reabre a abertura: anule a volta, rode race_recompute_record e o
-- carro do modelo vai para o próximo que bater o recorde.

-- ── prêmio: a fase 'abertura' ──────────────────────────────────────────────────────────────────────────────────
-- O check da 038 foi escrito na coluna (nome automático): acha qualquer check de race_prizes que fale de phase, tira e põe o novo.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.race_prizes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%phase%'
  loop
    execute format('alter table public.race_prizes drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.race_prizes
  add constraint race_prizes_phase_check check (phase in ('campeonato', 'desafio', 'abertura'));

-- ── a abertura fechada de cada modelo ──────────────────────────────────────────────────────────────────────────
create table if not exists public.race_openings (
  track_id text not null references public.race_tracks (id),
  model text not null check (model ~ '^[a-z][a-z0-9]{1,15}$'),
  -- a volta que fechou a abertura (a primeira volta válida da carteira que completou as p_needed)
  closing_lap_id uuid not null references public.race_laps (id),
  -- a melhor volta do modelo naquele instante: a que leva o carro (e é o recorde)
  winning_lap_id uuid not null references public.race_laps (id),
  -- o prêmio criado; null se a carteira vencedora já tinha o modelo (o próximo recorde leva)
  prize_id uuid references public.race_prizes (id),
  -- carteiras diferentes com volta válida no fechamento, e quantas eram necessárias
  drivers integer not null check (drivers >= 1),
  needed integer not null check (needed >= 2),
  closed_at timestamptz not null default now(),
  primary key (track_id, model)
);

alter table public.race_openings enable row level security;

-- ── a função do finish ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.race_finish_lap(
  p_lap_id uuid,
  p_prize boolean,
  p_needed integer default 10
) returns jsonb
language plpgsql as $$
declare
  v_lap public.race_laps%rowtype;
  v_win public.race_laps%rowtype;
  v_claimed boolean;
  v_record boolean;
  v_drivers integer;
  v_rank integer;
  v_prize_id uuid;
  v_prize_phase text;
  v_closed boolean := false;
  v_closing boolean := false;
begin
  if p_needed is null or p_needed < 2 or p_needed > 1000 then
    raise exception 'race_finish_lap: p_needed must be between 2 and 1000';
  end if;
  select * into v_lap from public.race_laps where id = p_lap_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'lap_not_found');
  end if;

  -- uma volta por vez em cada (pista, modelo): o recorde, a abertura e o prêmio nunca competem. A trava solta no fim da transação.
  perform pg_advisory_xact_lock(hashtextextended('race_finish_lap:' || v_lap.track_id || ':' || v_lap.model, 0));
  -- relê já com a trava: a volta pode ter sido anulada (valid -> void) no meio
  select * into v_lap from public.race_laps where id = p_lap_id;
  if v_lap.status <> 'valid' then
    return jsonb_build_object('ok', false, 'reason', 'lap_not_valid');
  end if;

  -- o recorde: só estritamente melhor (empate fica com a volta mais antiga)
  v_claimed := public.race_claim_record(v_lap.track_id, v_lap.model, v_lap.id, v_lap.wallet, v_lap.lap_ms);

  -- carteiras DIFERENTES com volta válida no modelo (esta inclusa: já está válida)
  select count(distinct wallet)::integer into v_drivers
  from public.race_laps
  where track_id = v_lap.track_id and model = v_lap.model and status = 'valid';

  if p_prize then
    select exists (select 1 from public.race_openings where track_id = v_lap.track_id and model = v_lap.model) into v_closed;
    if not v_closed then
      -- ainda em abertura: nada é premiado, a não ser que esta volta tenha completado as carteiras
      if v_drivers >= p_needed then
        -- a melhor volta válida do modelo agora (menor tempo; empate: a mais antiga) leva o carro
        select * into v_win from public.race_laps
        where track_id = v_lap.track_id and model = v_lap.model and status = 'valid'
        order by lap_ms, finished_at, id
        limit 1;
        -- e é o recorde (conserta um recorde velho cuja volta tenha sido anulada)
        insert into public.race_records as r (track_id, model, lap_id, wallet, lap_ms, set_at)
        values (v_win.track_id, v_win.model, v_win.id, v_win.wallet, v_win.lap_ms, v_win.finished_at)
        on conflict (track_id, model) do update
          set lap_id = excluded.lap_id, wallet = excluded.wallet, lap_ms = excluded.lap_ms, set_at = excluded.set_at
          where r.lap_id is distinct from excluded.lap_id;
        -- quem já tem o modelo (prêmio não rejeitado) não ganha de novo: o próximo recorde leva
        if not exists (
          select 1 from public.race_prizes where wallet = v_win.wallet and model = v_win.model and state <> 'rejected'
        ) then
          insert into public.race_prizes (track_id, wallet, model, lap_id, lap_ms, phase, state)
          values (v_win.track_id, v_win.wallet, v_win.model, v_win.id, v_win.lap_ms, 'abertura', 'pending_review')
          on conflict (wallet, model) where state <> 'rejected' do nothing
          returning id into v_prize_id;
        end if;
        insert into public.race_openings (track_id, model, closing_lap_id, winning_lap_id, prize_id, drivers, needed)
        values (v_lap.track_id, v_lap.model, v_lap.id, v_win.id, v_prize_id, v_drivers, p_needed);
      end if;
    elsif v_claimed then
      -- a abertura já estava fechada e esta volta é recorde novo: o desafio, se a carteira ainda não tem o modelo
      -- e esta volta nunca teve prêmio (nem rejeitado: um finish repetido não recria o que a revisão recusou)
      if not exists (select 1 from public.race_prizes where lap_id = v_lap.id)
         and not exists (
           select 1 from public.race_prizes where wallet = v_lap.wallet and model = v_lap.model and state <> 'rejected'
         ) then
        insert into public.race_prizes (track_id, wallet, model, lap_id, lap_ms, phase, state)
        values (v_lap.track_id, v_lap.wallet, v_lap.model, v_lap.id, v_lap.lap_ms, 'desafio', 'pending_review')
        on conflict (wallet, model) where state <> 'rejected' do nothing;
      end if;
    end if;
    select exists (select 1 from public.race_openings where track_id = v_lap.track_id and model = v_lap.model) into v_closed;
    select coalesce(
      (select closing_lap_id = v_lap.id from public.race_openings where track_id = v_lap.track_id and model = v_lap.model), false
    ) into v_closing;
  end if;

  -- o que ficou gravado (a resposta sai daqui, por isso o finish repetido devolve o mesmo)
  v_record := coalesce(
    (select lap_id = v_lap.id from public.race_records where track_id = v_lap.track_id and model = v_lap.model), false
  );
  select phase into v_prize_phase
  from public.race_prizes where lap_id = v_lap.id and state <> 'rejected'
  limit 1;
  v_rank := public.race_rank_of(v_lap.track_id, v_lap.model, v_lap.wallet, v_lap.lap_ms, v_lap.finished_at);

  return jsonb_build_object(
    'ok', true,
    'record', v_record,
    'rank', v_rank,
    -- o prêmio é SEMPRE sobre a carteira que terminou esta volta (a abertura pode ter premiado outra volta)
    'prize', case when v_prize_phase is not null then 'pending_review' else 'none' end,
    'prize_phase', v_prize_phase,
    -- 'opening' = o modelo ainda junta pilotos; 'open' = o recorde vale carro (modelo sem prêmio: sempre 'open')
    'phase', case when p_prize and not v_closed then 'opening' else 'open' end,
    'drivers', v_drivers,
    'needed', p_needed,
    'opening_closed', v_closing
  );
end;
$$;

-- ── permissões ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Só o service role (rotas do servidor) toca nisto, como na 038.
revoke all on table public.race_openings from anon, authenticated;
revoke all on function public.race_finish_lap(uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.race_finish_lap(uuid, boolean, integer) to service_role;
