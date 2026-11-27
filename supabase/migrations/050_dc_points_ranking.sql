-- Migration 050: o ranking dos DC Points (27/11/2026). NÃO APLICADA: o fundador cola no SQL Editor. Só ADITIVA (um índice e duas
-- funções de leitura): nenhum insert, update, delete, drop ou truncate; não toca dc_points_legacy nem o livro.
-- Depende da 042 (livro-caixa dc_points_*) e da 043 (kind 'referral'). Quem lê: GET /api/game/points/ranking (service role).
--
-- DECISÃO DO FUNDADOR (27/11/2026): três quadros, Total, Login (check-in diário) e Ambassador (indicações). ENTRA TUDO NO TOTAL.
-- O ranking soma pontos GANHOS, nunca o saldo: gastar (mercado, carro) não derruba ninguém.
--
-- O QUE CADA LANÇAMENTO DO LIVRO VALE (delta > 0 sempre; delta <= 0 nunca entra):
--   kind earn      source checkin                              -> Total, Login
--   kind earn      source venda pesca madeira minerio caca cavalo turno missao tutorial verified -> Total
--   kind referral  source referral (cron lot-referrals, 043)    -> Total, Ambassador
--   kind migration source save (a migração única do save)       -> Total, SÓ no "all time" (não é ganho da semana)
--   kind spend (mercado) e kind car (compra de carro)           -> nunca entram (delta < 0)
--   kind refund (estorno manual)                                -> nunca entra: devolve ponto GASTO, não é ganho novo
--
-- OS PONTOS HERDADOS AINDA NÃO MIGRADOS: dc_points_legacy guarda a foto dos saves. A migração (dc_points_migrate) só roda quando
-- a carteira entra E TEM HANDLE, e então grava no livro `amount` (kind migration). O Total soma, para a carteira que ainda não
-- migrou (dc_points_wallets.migrated_at nulo ou sem linha) e já tem handle, o MESMO `amount`: o número do ranking é igual ao
-- que a carteira terá no livro ao migrar. Quem migrou já tem o lançamento no livro e NÃO soma a foto de novo (conta uma vez só).
-- Sem handle, a carteira não migra e não aparece. Nada é gravado: dc_points_legacy continua intacta. Só "all time" e só Total.
--
-- A SEMANA: os últimos 7 dias de jogo (dc_points_today() - 6 até hoje; o dia vira às 08:00 UTC), sobre game_day do livro.
-- EMPATE: mesma posição para pontos iguais (1, 2, 2, 4). A ORDEM entre empatados: quem chegou primeiro àquela pontuação (o
-- lançamento mais antigo entre os últimos que a formaram: created_at do último lançamento que conta; para o herdado, a hora da
-- foto), depois a carteira (estável).

create index if not exists dc_points_ledger_rank_idx on public.dc_points_ledger (source, game_day) where delta > 0;
create index if not exists dc_points_ledger_rank_kind_idx on public.dc_points_ledger (kind, game_day) where delta > 0;

-- as linhas do ranking de um quadro: carteira, pontos, e a hora em que chegou lá (desempate)
create or replace function public.dc_points_board(p_board text, p_period text)
returns table (wallet text, pts bigint, at timestamptz)
language sql stable as $$
  with earned as (
    select l.wallet, sum(l.delta)::bigint as pts, max(l.created_at) as at
      from public.dc_points_ledger l
     where l.delta > 0
       and (
            (p_board = 'total' and (l.kind in ('earn', 'referral') or (l.kind = 'migration' and p_period = 'all')))
         or (p_board = 'login' and l.kind = 'earn' and l.source = 'checkin')
         or (p_board = 'ambassador' and l.kind = 'referral')
       )
       and (p_period = 'all' or l.game_day >= public.dc_points_today() - 6)
     group by l.wallet
  ),
  legacy as (
    select g.wallet, g.amount::bigint as pts, g.captured_at as at
      from public.dc_points_legacy g
     where p_board = 'total' and p_period = 'all' and g.amount > 0
       and not exists (select 1 from public.dc_points_wallets w where w.wallet = g.wallet and w.migrated_at is not null)
       and public.dc_points_has_handle(g.wallet)
  )
  select u.wallet, sum(u.pts)::bigint, max(u.at)
    from (select * from earned union all select * from legacy) u
   group by u.wallet
  having sum(u.pts) > 0
$$;

-- o ranking: { total, updated_at, rows: [{ rank, wallet, handle, avatar, points }], me: { rank, points } | null }
create or replace function public.dc_points_ranking(p_board text, p_period text, p_limit integer default 100, p_wallet text default null)
returns jsonb
language plpgsql stable as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 0), 500);
begin
  if p_board is null or p_board not in ('total', 'login', 'ambassador') then
    raise exception 'dc_points_ranking: bad board';
  end if;
  if p_period is null or p_period not in ('all', 'week') then
    raise exception 'dc_points_ranking: bad period';
  end if;
  return (
    with ranked as (
      select b.wallet, b.pts, b.at,
             rank() over (order by b.pts desc) as rk,
             row_number() over (order by b.pts desc, b.at asc, b.wallet asc) as rn
        from public.dc_points_board(p_board, p_period) b
    ),
    top as (
      select r.*, p.handle, p.avatar_inscription_id
        from ranked r
        left join public.dogcity_profiles p on p.address = lower(r.wallet)
       where r.rn <= v_limit
       order by r.rn
    )
    select jsonb_build_object(
      'total', (select count(*) from ranked),
      'updated_at', now(),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
                'rank', t.rk, 'wallet', t.wallet, 'handle', t.handle, 'avatar', t.avatar_inscription_id, 'points', t.pts
              ) order by t.rn) from top t), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', r.rk, 'points', r.pts) from ranked r where p_wallet is not null and r.wallet = p_wallet)
    )
  );
end;
$$;

-- o mesmo fecho das tabelas dc_points_*: só o service role (as rotas do servidor); o cliente do banco não executa
revoke all on function public.dc_points_board(text, text) from public, anon, authenticated;
revoke all on function public.dc_points_ranking(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.dc_points_board(text, text) to service_role;
grant execute on function public.dc_points_ranking(text, text, integer, text) to service_role;
