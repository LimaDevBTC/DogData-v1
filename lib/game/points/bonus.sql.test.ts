// Rodar: PGLITE=/usr/local/lib/node_modules/firebase-tools/node_modules/@electric-sql/pglite/dist/index.js npx tsx --test lib/game/points/bonus.sql.test.ts
// O bônus único de embaixador (migração 051) contra o SQL DE VERDADE das migrações 039 + 042 + 043 + 050 + 051 (PGlite).
// Sem `PGLITE` os testes são PULADOS: não valem como aprovados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PGLITE = process.env.PGLITE
const pular = PGLITE ? false : 'sem PGLITE: o SQL da 051 NAO foi exercitado'
const MIG = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations')
const ler = (f: string): string => readFileSync(join(MIG, f), 'utf8')

const ANA = 'bc1p' + 'a'.repeat(58)
const BIA = 'bc1p' + 'b'.repeat(58)
const SEM = 'bc1p' + 'c'.repeat(58) // sem handle
const OLD = 'bc1p' + 'd'.repeat(58)

type Linha = Record<string, unknown>
interface Db { query(s: string, p?: unknown[]): Promise<{ rows: Linha[] }>; exec(s: string): Promise<unknown>; close(): Promise<void> }

type Ctor = new (o?: { loadDataDir?: Blob | File }) => Db
let PG: Ctor | undefined
const ctor = async (): Promise<Ctor> => (PG ??= ((await import(pathToFileURL(PGLITE!).href)) as { PGlite: Ctor }).PGlite)
const CRIACAO = `
  create role anon; create role authenticated; create role service_role;
  create table public.dogcity_profiles (address text primary key, handle text unique not null check (handle ~ '^[a-z0-9_]{3,15}$'), avatar_inscription_id text);
  create table public.dogcity_game_saves (wallet text primary key, save jsonb, updated_at timestamptz);
  create table public.referral_links (referred_address text primary key, referrer_address text not null, referrer_handle text not null);
`
// O PGlite 0.2 corrompe a memoria depois de varias excecoes no MESMO banco (plpgsql raise / check violada): ate "passa" o que
// devia falhar. Por isso: cada caso que ESPERA recusa roda num banco proprio, clonado do molde (a 042+043+050+051 prontas).
let molde: Blob | File | undefined
async function comBonus(): Promise<Db> {
  const PGlite = await ctor()
  if (!molde) {
    const db = new PGlite()
    await db.exec(CRIACAO)
    for (const f of ['039_dogcity_cars.sql', '042_dc_points.sql', '043_lot_referrals.sql', '050_dc_points_ranking.sql', '051_dc_points_ambassador_bonus.sql']) await db.exec(ler(f))
    await db.query(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'bia'),($3,'oldie')`, [ANA, BIA, OLD])
    molde = await (db as unknown as { dumpDataDir(): Promise<Blob | File> }).dumpDataDir()
    await db.close()
  }
  return new PGlite({ loadDataDir: molde })
}
const j = async (db: Db, sql: string, p: unknown[] = []): Promise<Linha> => (await db.query(sql, p)).rows[0]!.r as Linha
const bonus = (db: Db, w: string, v: number, slug = 'traffic-2026-11', note = 'One-time bonus for ambassador link traffic') =>
  j(db, 'select public.dc_points_ambassador_bonus($1,$2,$3,$4) as r', [w, v, slug, note])
const bonusH = (db: Db, h: string, v: number, slug = 'traffic-2026-11', note = 'One-time bonus for ambassador link traffic') =>
  j(db, 'select public.dc_points_ambassador_bonus_handle($1,$2,$3,$4) as r', [h, v, slug, note])
const rank = (db: Db, board: string, period: string) => j(db, 'select public.dc_points_ranking($1,$2,100,null) as r', [board, period])
const RAZAO = /check constraint|bad |reason is required|written only|normalized|never goes negative|violates/
/** o caso roda num banco clonado so para ele: `prep` arruma o cenario, a consulta TEM de ser recusada pelo banco */
const recusa = async (prep: ((db: Db) => Promise<unknown>) | null, sql: string, p: unknown[] = []): Promise<void> => {
  const db = await comBonus()
  if (prep) await prep(db)
  await assert.rejects(() => db.query(sql, p), RAZAO, sql)
  await db.close()
}
const ligaTrava = (db: Db) => db.query(`select set_config('dogcity.dc_points','on',false)`)

test('o bonus credita, vai para o livro e entra no Ambassador e no Total (all time e semana)', { skip: pular }, async () => {
  const db = await comBonus()
  const r = await bonus(db, ANA, 1500)
  assert.deepEqual([r.status, r.credited, r.balance], ['credited', 1500, 1500])
  const l = (await db.query(`select kind, source, ref, requested, delta, note, game_day = public.dc_points_today() as hoje from public.dc_points_ledger where wallet = $1`, [ANA])).rows
  assert.deepEqual(l, [{ kind: 'referral', source: 'bonus', ref: 'bonus:traffic-2026-11', requested: 1500, delta: 1500, note: 'One-time bonus for ambassador link traffic', hoje: true }])
  for (const [board, period] of [['ambassador', 'all'], ['ambassador', 'week'], ['total', 'all'], ['total', 'week']]) {
    const rk = (await rank(db, board!, period!)) as { rows: Array<{ handle: string; points: number; rank: number }> }
    assert.deepEqual(rk.rows.map((x) => [x.handle, x.points, x.rank]), [['ana', 1500, 1]], `${board}/${period}`)
  }
  assert.equal(((await rank(db, 'login', 'all')) as { rows: unknown[] }).rows.length, 0, 'o bonus nao e check-in')
  await db.close()
})

test('a segunda chamada com o mesmo slug nao paga de novo; outro slug paga', { skip: pular }, async () => {
  const db = await comBonus()
  const a = await bonus(db, ANA, 1000)
  const b = await bonus(db, ANA, 1000)
  const h = await bonusH(db, '@ANA', 2000)
  assert.equal(a.status, 'credited')
  assert.deepEqual([b.status, b.credited, b.balance, b.ledger_id], ['already', 1000, 1000, a.ledger_id])
  assert.deepEqual([h.status, h.balance], ['already', 1000], 'o mesmo slug pelo handle, com valor diferente, tambem nao paga')
  assert.equal((await db.query(`select count(*)::int as n from public.dc_points_ledger where wallet = $1`, [ANA])).rows[0]!.n, 1)
  const c = await bonus(db, ANA, 500, 'other-slug')
  assert.deepEqual([c.status, c.balance], ['credited', 1500])
  assert.equal((await bonus(db, BIA, 700)).status, 'credited', 'cada carteira recebe o slug uma vez, cada uma a sua')
  await db.close()
})

test('carteira sem handle nao recebe e nada e gravado; handle inexistente; arroba e maiusculas', { skip: pular }, async () => {
  const db = await comBonus()
  assert.deepEqual(await bonus(db, SEM, 1000), { status: 'no_handle' })
  assert.equal((await db.query(`select count(*)::int as n from public.dc_points_wallets where wallet = $1`, [SEM])).rows[0]!.n, 0)
  assert.equal((await db.query(`select count(*)::int as n from public.dc_points_ledger`)).rows[0]!.n, 0)
  assert.deepEqual(await bonusH(db, '@ninguem', 1000), { status: 'no_profile' })
  assert.deepEqual(await bonusH(db, 'x', 1000), { status: 'no_profile' })
  assert.deepEqual(await bonusH(db, '', 1000), { status: 'no_profile' })
  assert.deepEqual(await bonusH(db, "ana'; --", 1000), { status: 'no_profile' })
  assert.equal((await bonusH(db, '  @BiA ', 300)).status, 'credited')
  assert.equal((await db.query(`select balance from public.dc_points_wallets where wallet = $1`, [BIA])).rows[0]!.balance, 300)
  // perfil com endereco que nao e' bech32: nao grava
  await db.query(`insert into public.dogcity_profiles (address, handle) values ('1abcdefghijklmnopqrstuvwxyz1234', 'legacy')`)
  assert.deepEqual(await bonusH(db, 'legacy', 100), { status: 'unsupported_address' })
  await db.close()
})

test('valor fora da faixa, slug, nota e carteira malformados LANCAM', { skip: pular }, async () => {
  const db = await comBonus()
  const q = 'select public.dc_points_ambassador_bonus($1,$2,$3,$4) as r'
  const ok = ['traffic-2026-11', 'nota']
  for (const [w, v, s, n] of [
    [ANA, 0, ok[0], ok[1]], [ANA, -5, ok[0], ok[1]], [ANA, 5001, ok[0], ok[1]], [ANA, null, ok[0], ok[1]],
    [ANA, 100, 'ab', ok[1]], [ANA, 100, 'Traffic', ok[1]], [ANA, 100, 'a b c', ok[1]], [ANA, 100, 'x'.repeat(49), ok[1]], [ANA, 100, null, ok[1]], [ANA, 100, 'bonus:x1', ok[1]],
    [ANA, 100, ok[0], ''], [ANA, 100, ok[0], '   '], [ANA, 100, ok[0], null], [ANA, 100, ok[0], 'n'.repeat(201)],
    ['nao-e-carteira', 100, ok[0], ok[1]], [null, 100, ok[0], ok[1]],
  ]) await recusa(null, q, [w, v, s, n])
  assert.equal((await bonus(db, ANA, 5000)).status, 'credited', 'o teto de 5.000 passa')
  assert.equal((await db.query(`select count(*)::int as n from public.dc_points_ledger`)).rows[0]!.n, 1)
  await db.close()
})

test('o teto de saldo de 1.000.000: o bonus e inteiro ou nada', { skip: pular }, async () => {
  const db = await comBonus()
  await bonus(db, ANA, 1, 'abre-a-carteira')
  await ligaTrava(db)
  await db.query(`insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta) values ($1,'migration','save','migration',998999,998999) on conflict do nothing`, [ANA])
  await db.query(`select set_config('dogcity.dc_points','off',false)`)
  const r = await bonus(db, ANA, 2000)
  assert.deepEqual([r.status, r.credited, r.balance], ['balance_cap', 0, 999000])
  assert.equal((await bonus(db, ANA, 1000, 'cabe')).status, 'credited')
  await db.close()
})

test('as regras antigas do livro continuam valendo (insercao direta com a trava ligada)', { skip: pular }, async () => {
  const prep = async (db: Db) => { await bonus(db, ANA, 100); await ligaTrava(db) } // abre a carteira e liga a trava como as funcoes
  const COLS = 'wallet, kind, source, ref, requested, delta, note'
  const ins = (kind: string, source: string, ref: string, requested: number, delta: number, note: string | null = null) =>
    recusa(prep, `insert into public.dc_points_ledger (${COLS}) values ($1,$2,$3,$4,$5,$6,$7)`, [ANA, kind, source, ref, requested, delta, note])
  const R32 = 'referral:' + 'a'.repeat(32)
  await ins('earn', 'pesca', 'earn:abcdefgh', 0, 0) // earn com pedido 0
  await ins('earn', 'pesca', 'earn:abcdefgh', 10001, 10) // earn acima de 10.000
  await ins('earn', 'pesca', 'earn:abcdefgh', 10, 11) // delta maior que o pedido
  await ins('earn', 'pesca', 'earn:abc', 10, 10) // ref curto
  await ins('earn', 'bonus', 'bonus:abc', 10, 10, 'n') // earn nao usa o ref do bonus
  await ins('referral', 'referral', 'referral:xyz:owner', 500, 500) // ref de referral malformado
  await ins('referral', 'referral', R32 + ':other', 500, 500)
  await ins('referral', 'referral', R32 + ':owner', 1001, 1001) // acima de 1.000
  await ins('referral', 'referral', 'bonus:abc', 100, 100, 'n') // referral comum nao usa o ref do bonus
  await ins('refund', 'refund', 'refund:abc', 100, 100, null) // estorno sem nota
  await ins('migration', 'save', 'migration', 10, 11) // migracao com requested < delta
  await ins('xpto', 'x', 'earn:abcdefgh', 10, 10) // kind desconhecido
  await ins('referral', 'bonus', 'bonus:abc', 100, 100, null) // bonus sem nota
  await ins('referral', 'bonus', 'bonus:abc', 5001, 5001, 'n') // bonus acima de 5.000
  await ins('referral', 'bonus', 'bonus:abc', 100, 50, 'n') // delta diferente do pedido
  await ins('referral', 'bonus', R32 + ':owner', 100, 100, 'n') // bonus com ref de referral
  await ins('referral', 'bonus', 'bonus:ab', 100, 100, 'n') // slug curto
  await ins('spend', 'bonus', 'bonus:abc', 100, -100, 'n') // spend com ref de bonus
  await recusa(async (db) => { await bonus(db, ANA, 100) }, `insert into public.dc_points_ledger (${COLS}) values ($1,'referral','bonus','bonus:semtrava',10,10,'n')`, [ANA])
  await recusa(async (db) => { await bonus(db, ANA, 100) }, `select public.dc_points_refund($1, 10, 'r1', '')`, [ANA])
  // e o que sempre foi valido continua valido
  const db = await comBonus()
  await prep(db)
  await db.query(`insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta) values ($1,'referral','referral',$2,1000,1000)`, [ANA, R32 + ':owner'])
  await db.query(`insert into public.dc_points_ledger (wallet, kind, source, ref, requested, delta) values ($1,'earn','pesca','earn:abcdefgh',10,10)`, [ANA])
  await db.query(`select set_config('dogcity.dc_points','off',false)`)
  assert.equal((await j(db, `select public.dc_points_refund($1, 10, 'r1', 'motivo') as r`, [ANA])).status, 'ok')
  await db.close()
})

test('gasto posterior nao tira o embaixador do ranking', { skip: pular }, async () => {
  const db = await comBonus()
  await bonus(db, ANA, 1200)
  const s = await j(db, `select public.dc_points_spend($1, 'madeira', 1, 1000, 'spend:abcdefgh') as r`, [ANA])
  assert.equal(s.status, 'ok')
  assert.equal((await db.query(`select balance from public.dc_points_wallets where wallet = $1`, [ANA])).rows[0]!.balance, 200)
  for (const [board, period] of [['ambassador', 'all'], ['ambassador', 'week'], ['total', 'all']]) {
    const rk = (await rank(db, board!, period!)) as { rows: Array<{ points: number }> }
    assert.deepEqual(rk.rows.map((x) => x.points), [1200], `${board}/${period}`)
  }
  await db.close()
})

test('o bonus fica fora dos tetos: 480 do dia e 5.000 de indicacao', { skip: pular }, async () => {
  const db = await comBonus()
  await bonus(db, ANA, 5000)
  const ganho = await j(db, `select public.dc_points_earn($1, 'pesca', 480, 'earn:abcdefgh', 480) as r`, [ANA])
  assert.equal(ganho.status, 'ok', 'o teto diario de ganho de jogo nao viu o bonus')
  assert.equal(ganho.credited, 480)
  const ord = '00000000-0000-4000-8000-000000000001'
  const rr = await j(db, `select public.lot_referral_credit($1::uuid,'owner',$2,500,'S01-Q01-B001-L001',null,'bia',$3,$4,false,1,now()) as r`, [ord, ANA, BIA, SEM])
  assert.deepEqual([rr.status, rr.credited], ['ok', 500], 'o teto diario de indicacao nao viu o bonus')
  // e o teto de indicacao continua valendo para a indicacao: 5.000 em indicacoes no dia, o proximo vai para revisao
  let rev = ''
  for (let i = 2; i <= 11; i++) {
    const o = `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`
    rev = String((await j(db, `select public.lot_referral_credit($1::uuid,'owner',$2,500,'S01-Q01-B001-L001',null,'bia',$3,$4,false,1,now()) as r`, [o, ANA, BIA, SEM])).status)
  }
  assert.equal(rev, 'review', 'a 11a indicacao do dia (5.500) passa do teto de 5.000 e vai para revisao')
  await db.close()
})

test('a migracao aplicada duas vezes nao da erro e deixa as mesmas regras', { skip: pular }, async () => {
  const db = await comBonus()
  const defs = async () => (await db.query(`select conname, pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'public.dc_points_ledger'::regclass and contype = 'c' order by conname`)).rows
  const antes = await defs()
  await bonus(db, ANA, 100)
  await db.exec(ler('051_dc_points_ambassador_bonus.sql'))
  assert.deepEqual(await defs(), antes)
  assert.deepEqual((await bonus(db, ANA, 100)).status, 'already')
  assert.ok(antes.some((c) => c.conname === 'dc_points_ledger_bonus_ref_check'))
  await db.close()
})

test('a 051 sem a 043 para na guarda, sem mudar nada', { skip: pular }, async () => {
  const velho = new (await ctor())()
  await velho.exec(`create role anon; create role authenticated; create role service_role;
    create table public.dogcity_profiles (address text primary key, handle text unique not null);
    create table public.dogcity_game_saves (wallet text primary key, save jsonb, updated_at timestamptz);`)
  await velho.exec(ler('039_dogcity_cars.sql'))
  await velho.exec(ler('042_dc_points.sql'))
  const sql = ler('051_dc_points_ambassador_bonus.sql')
  const guarda = sql.slice(sql.indexOf('do $$'), sql.indexOf('$$;', sql.indexOf('do $$')) + 3)
  await assert.rejects(() => velho.query(guarda), /apply 043 first/)
  await velho.close()
})

test('permissoes: so o service_role executa; anon e authenticated nao', { skip: pular }, async () => {
  const db = await comBonus()
  const fns = ['public.dc_points_ambassador_bonus(text,integer,text,text)', 'public.dc_points_ambassador_bonus_handle(text,integer,text,text)']
  for (const f of fns) {
    const r = (await db.query(`select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as auth, has_function_privilege('service_role', $1, 'execute') as srv`, [f])).rows[0]
    assert.deepEqual(r, { anon: false, auth: false, srv: true }, f)
  }
  const mesmo = (await db.query(`select has_function_privilege('anon', 'public.dc_points_open(text)', 'execute') as anon`)).rows[0]
  assert.deepEqual(mesmo, { anon: false }, 'o mesmo fecho das outras dc_points_*')
  await db.exec(`set role anon`)
  await assert.rejects(() => db.query(`select public.dc_points_ambassador_bonus_handle('ana', 100, 'abc-def', 'n')`))
  await db.exec(`reset role`)
  await db.exec(`set role authenticated`)
  await assert.rejects(() => db.query(`select public.dc_points_ambassador_bonus($1, 100, 'abc-def', 'n')`, [ANA]))
  await db.exec(`reset role`)
  await db.close()
})

test('o texto que o operador cola nao tem palavra destrutiva', () => {
  const linha = "select public.dc_points_ambassador_bonus_handle('@handle', 1000, 'traffic-2026-11', 'One-time bonus for ambassador link traffic');"
  assert.ok(!/\b(delete|drop|update|truncate)\b/i.test(linha))
})
