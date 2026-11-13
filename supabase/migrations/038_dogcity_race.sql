-- Migration 038: a corrida da perimetral AN7 (DogCity, frente S). NAO APLICADA: o fundador aplica.
-- Plano: assets_carros/projeto/PLANO_CORRIDA_PERIMETRAL.md ("Regra do prêmio", "Contrato jogo <-> servidor"). Cliente: dogcity-mundo PR #404.
--
-- Seis tabelas e duas views por trás de /api/game/race/{start,gate,finish,leaderboard,me,close}:
--   race_tracks         a versão do traçado (an7-v1). Mexer no traçado = pista nova (an7-v2), nunca editar a v1. A soma sha256 da lista
--                       de portões é a que o teste do servidor tranca contra a lista que o jogo gera (lib/game/race/track.test.ts).
--   race_championship   a config do campeonato: a janela [starts_at, ends_at) por pista e o fechamento. Sem linha = sem campeonato
--                       (nada é premiado). Dentro da janela nada é premiado na hora; o vencedor de cada modelo sai no fechamento
--                       (POST /api/game/race/close); depois da janela, recorde novo do modelo gera race_prizes pending_review na hora.
--   race_laps           cada volta: open (a que está correndo; UMA por carteira, expira em 30 min) -> valid | void. O tempo oficial é
--                       o carimbo do ÚLTIMO portão menos o da largada, no relógio do SERVIDOR; `splits` = ms desde a largada em cada portão.
--   race_gate_hits      o carimbo do servidor de cada portão da volta (append-only).
--   race_records        o recorde de cada modelo na pista (a volta que o segura). Só melhora, e só por race_claim_record.
--   race_prizes         o prêmio (carro do modelo): UM por carteira por modelo (rejeitado libera a vaga). fase campeonato | desafio;
--                       estado pending_review -> approved -> delivered, ou rejected. Entregue como os carros vendidos: registrado
--                       no nosso banco pela carteira, sem Ordinal.
--   race_best_laps      view: a melhor volta válida de cada carteira por modelo (o ranking e a posição leem daqui).
--   race_championship_best  view: a melhor volta válida de cada modelo DENTRO da janela (o fechamento lê daqui).
--
-- IMUTABILIDADE: volta finalizada (valid ou void) não muda e não sai; a única mudança é a anulação deliberada, valid -> void com motivo,
-- com todo o resto igual (trapaça achada depois). Carimbo de portão é append-only e só entra em volta aberta. Prêmio só muda de estado,
-- em frente (pending_review -> approved|rejected, approved -> delivered|rejected), e nunca sai. Os gatilhos valem também para o service role.
--
-- Anular uma volta que segura o recorde: depois do UPDATE rode `select public.race_recompute_record('an7-v1', '<modelo>')`.
--
-- Lido e escrito SÓ pelas rotas do servidor (service role), depois da sessão dg_wallet resolvida. RLS ligada, ZERO políticas, como 033/034/036/037:
-- o anon não vê nada. Carteiras já vivem em dogcity_profiles; nenhum dado pessoal novo. Repo público: nenhum segredo aqui.
--
-- ORDEM SEGURA: aplicar ANTES de publicar o código. Sem as tabelas as rotas respondem 500 e o jogo segue sem corrida.
-- Abrir o campeonato (depois de aplicar):
--   insert into public.race_championship (track_id, starts_at, ends_at) values ('an7-v1', '<início, UTC>', '<fim, UTC>');
-- Voltas de teste antes da janela contam no ranking e no recorde do desafio; para limpar antes de abrir, anule-as (valid -> void).

-- ── a pista ────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.race_tracks (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null,
  lap_m numeric not null check (lap_m > 0),
  gate_count integer not null check (gate_count between 2 and 400),
  gates_sha256 text not null check (gates_sha256 ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.race_tracks (id, label, lap_m, gate_count, gates_sha256)
values ('an7-v1', 'AN7 perimeter, v1', 43668.14, 61, '56b0afb5076b712eae30d208f9e7ab7d21cecf8c1c21a0bac58b7a18148a7783')
on conflict (id) do nothing;

-- ── a config do campeonato (a janela por pista) ────────────────────────────────────────────────────────────────
create table if not exists public.race_championship (
  track_id text primary key references public.race_tracks (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- preenchido pelo fechamento (POST /api/game/race/close); só depois do fim da janela
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (closed_at is null or closed_at >= ends_at)
);

-- ── as voltas ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.race_laps (
  id uuid primary key default gen_random_uuid(),
  track_id text not null references public.race_tracks (id),
  -- a carteira da sessão, como a rota normaliza (bech32 minúsculo, base58 intacto)
  wallet text not null check (length(wallet) between 26 and 90),
  model text not null check (model ~ '^[a-z][a-z0-9]{1,15}$'),
  status text not null default 'open' check (status in ('open', 'valid', 'void')),
  -- por que anulou: flag_autopilot, flag_teleport, flag_diag, bot, client_<motivo>, speed, order, expired, replaced, trace_*, ...
  void_reason text check (void_reason is null or length(void_reason) <= 60),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  lap_ms integer check (lap_ms is null or lap_ms > 0),
  -- o tempo do relógio do cliente (só informativo: vale o do servidor)
  client_lap_ms integer check (client_lap_ms is null or client_lap_ms > 0),
  splits integer[],
  -- sha256 da trajetória enviada: a mesma trajetória não vale duas vezes
  trace_sha256 text check (trace_sha256 is null or trace_sha256 ~ '^[0-9a-f]{64}$'),
  flags jsonb,
  created_at timestamptz not null default now(),
  check (expires_at > started_at),
  check (
    (status = 'open' and finished_at is null and lap_ms is null and splits is null and void_reason is null)
    or (status = 'valid' and finished_at is not null and lap_ms is not null and splits is not null and void_reason is null)
    or (status = 'void' and finished_at is not null and void_reason is not null)
  )
);

-- UMA volta aberta por carteira
create unique index if not exists race_laps_one_open_per_wallet
  on public.race_laps (wallet) where status = 'open';
-- o ranking (menor tempo primeiro; empate: a volta mais antiga) e a melhor volta de cada carteira
create index if not exists race_laps_ranking_idx
  on public.race_laps (track_id, model, lap_ms, finished_at) where status = 'valid';
create index if not exists race_laps_wallet_best_idx
  on public.race_laps (track_id, model, wallet, lap_ms, finished_at) where status = 'valid';
create index if not exists race_laps_wallet_idx
  on public.race_laps (wallet, started_at desc);
-- a mesma trajetória não vale duas vezes (volta copiada)
create unique index if not exists race_laps_trace_uidx
  on public.race_laps (trace_sha256) where status = 'valid' and trace_sha256 is not null;

alter table public.race_laps enable row level security;

create or replace function public.race_laps_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'race_laps: a lap is a receipt and is never deleted';
  end if;
  if old.status = 'open' then
    -- a volta aberta só pode ser finalizada (os checks da tabela fecham a forma); quem é ela não muda
    if (new.id, new.track_id, new.wallet, new.model, new.started_at, new.expires_at, new.created_at)
       is distinct from (old.id, old.track_id, old.wallet, old.model, old.started_at, old.expires_at, old.created_at) then
      raise exception 'race_laps: an open lap keeps its id, track, wallet, model and times';
    end if;
    return new;
  end if;
  -- volta finalizada (valid ou void) e' imutavel; a unica saida e' a anulacao deliberada: valid -> void com motivo, o resto igual
  if old.status = 'valid' and new.status = 'void' and new.void_reason is not null
     and (new.id, new.track_id, new.wallet, new.model, new.started_at, new.expires_at, new.finished_at, new.lap_ms,
          new.client_lap_ms, new.splits, new.trace_sha256, new.flags, new.created_at)
         is not distinct from
         (old.id, old.track_id, old.wallet, old.model, old.started_at, old.expires_at, old.finished_at, old.lap_ms,
          old.client_lap_ms, old.splits, old.trace_sha256, old.flags, old.created_at) then
    return new;
  end if;
  raise exception 'race_laps: a finished lap is immutable (the only change allowed is valid -> void with a reason)';
end;
$$;

drop trigger if exists race_laps_guard on public.race_laps;
create trigger race_laps_guard
  before update or delete on public.race_laps
  for each row execute function public.race_laps_guard();

-- ── o carimbo de cada portão (append-only, só em volta aberta) ─────────────────────────────────────────────────
create table if not exists public.race_gate_hits (
  race_id uuid not null references public.race_laps (id),
  i smallint not null check (i between 0 and 399),
  -- o relógio do SERVIDOR quando o portão chegou, ms desde 1970
  t_server_ms bigint not null,
  x real not null,
  y real not null,
  z real not null,
  v real not null,
  created_at timestamptz not null default now(),
  primary key (race_id, i)
);

alter table public.race_gate_hits enable row level security;

create or replace function public.race_gate_hits_guard() returns trigger
language plpgsql as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'race_gate_hits is append-only';
  end if;
  if not exists (select 1 from public.race_laps where id = new.race_id and status = 'open') then
    raise exception 'race_gate_hits: the lap is not open';
  end if;
  return new;
end;
$$;

drop trigger if exists race_gate_hits_guard on public.race_gate_hits;
create trigger race_gate_hits_guard
  before insert or update or delete on public.race_gate_hits
  for each row execute function public.race_gate_hits_guard();

-- ── o recorde de cada modelo ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.race_records (
  track_id text not null references public.race_tracks (id),
  model text not null check (model ~ '^[a-z][a-z0-9]{1,15}$'),
  lap_id uuid not null references public.race_laps (id),
  wallet text not null check (length(wallet) between 26 and 90),
  lap_ms integer not null check (lap_ms > 0),
  set_at timestamptz not null default now(),
  primary key (track_id, model)
);

alter table public.race_records enable row level security;

-- ── os prêmios ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.race_prizes (
  id uuid primary key default gen_random_uuid(),
  track_id text not null references public.race_tracks (id),
  wallet text not null check (length(wallet) between 26 and 90),
  model text not null check (model ~ '^[a-z][a-z0-9]{1,15}$'),
  lap_id uuid not null references public.race_laps (id),
  lap_ms integer not null check (lap_ms > 0),
  -- campeonato = o vencedor do fechamento; desafio = recorde novo depois da janela
  phase text not null check (phase in ('campeonato', 'desafio')),
  state text not null default 'pending_review' check (state in ('pending_review', 'approved', 'delivered', 'rejected')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  delivered_at timestamptz,
  check (state <> 'delivered' or delivered_at is not null)
);

-- UM prêmio por carteira por modelo; o rejeitado libera a vaga
create unique index if not exists race_prizes_one_per_wallet_model
  on public.race_prizes (wallet, model) where state <> 'rejected';
create index if not exists race_prizes_state_idx
  on public.race_prizes (state, created_at);
create index if not exists race_prizes_lap_idx
  on public.race_prizes (lap_id);

alter table public.race_prizes enable row level security;

create or replace function public.race_prizes_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'race_prizes: a prize is never deleted (reject it instead)';
  end if;
  if (new.id, new.track_id, new.wallet, new.model, new.lap_id, new.lap_ms, new.phase, new.created_at)
     is distinct from (old.id, old.track_id, old.wallet, old.model, old.lap_id, old.lap_ms, old.phase, old.created_at) then
    raise exception 'race_prizes: only state, note, reviewed_at and delivered_at can change';
  end if;
  if new.state is distinct from old.state and not (
       (old.state = 'pending_review' and new.state in ('approved', 'rejected'))
       or (old.state = 'approved' and new.state in ('delivered', 'rejected'))
     ) then
    raise exception 'race_prizes: invalid state change % -> %', old.state, new.state;
  end if;
  return new;
end;
$$;

drop trigger if exists race_prizes_guard on public.race_prizes;
create trigger race_prizes_guard
  before update or delete on public.race_prizes
  for each row execute function public.race_prizes_guard();

-- ── as views ───────────────────────────────────────────────────────────────────────────────────────────────────
-- A melhor volta válida de cada carteira por modelo. security_invoker: quem lê passa pelas permissões das tabelas (anon não tem nenhuma).
create or replace view public.race_best_laps with (security_invoker = true) as
select distinct on (track_id, model, wallet)
  id, track_id, model, wallet, lap_ms, finished_at, splits
from public.race_laps
where status = 'valid'
order by track_id, model, wallet, lap_ms, finished_at, id;

-- A melhor volta válida de cada modelo dentro da janela do campeonato (o fechamento lê daqui; empate: a mais antiga).
create or replace view public.race_championship_best with (security_invoker = true) as
select distinct on (c.track_id, l.model)
  c.track_id, l.model, l.id as lap_id, l.wallet, l.lap_ms, l.finished_at
from public.race_championship c
join public.race_laps l
  on l.track_id = c.track_id and l.status = 'valid' and l.finished_at >= c.starts_at and l.finished_at < c.ends_at
order by c.track_id, l.model, l.lap_ms, l.finished_at, l.id;

-- ── funções (o único caminho de escrita do recorde e a posição) ───────────────────────────────────────────────
-- Reivindica o recorde do modelo para uma volta válida: true só se NÃO havia recorde ou a volta é ESTRITAMENTE mais rápida
-- (empate fica com a volta mais antiga). Um comando só (insert ... on conflict ... where): duas voltas terminando juntas nunca
-- empatam o recorde nem o regridem.
create or replace function public.race_claim_record(
  p_track text, p_model text, p_lap_id uuid, p_wallet text, p_lap_ms integer
) returns boolean
language plpgsql as $$
declare
  v_n integer;
begin
  insert into public.race_records as r (track_id, model, lap_id, wallet, lap_ms)
  values (p_track, p_model, p_lap_id, p_wallet, p_lap_ms)
  on conflict (track_id, model) do update
    set lap_id = excluded.lap_id, wallet = excluded.wallet, lap_ms = excluded.lap_ms, set_at = now()
    where r.lap_ms > excluded.lap_ms;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- A posição de uma volta entre as melhores voltas das OUTRAS carteiras: 1 + quantas são melhores (menor tempo; empate: mais antiga).
create or replace function public.race_rank_of(
  p_track text, p_model text, p_wallet text, p_lap_ms integer, p_finished_at timestamptz
) returns integer
language sql stable as $$
  select (1 + count(*))::integer
  from public.race_best_laps
  where track_id = p_track and model = p_model and wallet <> p_wallet
    and (lap_ms < p_lap_ms or (lap_ms = p_lap_ms and finished_at < p_finished_at))
$$;

-- Depois de anular uma volta que segurava o recorde (valid -> void): refaz o recorde do modelo com a melhor volta válida que sobrou.
-- Sem volta válida, o recorde sai. Rodada à mão pelo fundador (SQL editor); o código nunca a chama.
create or replace function public.race_recompute_record(p_track text, p_model text) returns void
language plpgsql as $$
begin
  delete from public.race_records where track_id = p_track and model = p_model;
  insert into public.race_records (track_id, model, lap_id, wallet, lap_ms, set_at)
  select track_id, model, id, wallet, lap_ms, finished_at
  from public.race_laps
  where track_id = p_track and model = p_model and status = 'valid'
  order by lap_ms, finished_at, id
  limit 1;
end;
$$;

-- ── permissões ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Só o service role (rotas do servidor) toca nisto. RLS sem políticas já esconde as linhas; tira também os grants das tabelas, das
-- views e das funções dos papéis do cliente.
revoke all on table public.race_tracks from anon, authenticated;
revoke all on table public.race_championship from anon, authenticated;
revoke all on table public.race_laps from anon, authenticated;
revoke all on table public.race_gate_hits from anon, authenticated;
revoke all on table public.race_records from anon, authenticated;
revoke all on table public.race_prizes from anon, authenticated;
revoke all on table public.race_best_laps from anon, authenticated;
revoke all on table public.race_championship_best from anon, authenticated;
revoke all on function public.race_laps_guard() from public, anon, authenticated;
revoke all on function public.race_gate_hits_guard() from public, anon, authenticated;
revoke all on function public.race_prizes_guard() from public, anon, authenticated;
revoke all on function public.race_claim_record(text, text, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.race_rank_of(text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.race_recompute_record(text, text) from public, anon, authenticated;
grant execute on function public.race_claim_record(text, text, uuid, text, integer) to service_role;
grant execute on function public.race_rank_of(text, text, text, integer, timestamptz) to service_role;
grant execute on function public.race_recompute_record(text, text) to service_role;
