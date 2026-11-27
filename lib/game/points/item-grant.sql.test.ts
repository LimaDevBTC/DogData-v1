// Rodar: PGLITE=/tmp/pgl/node_modules/@electric-sql/pglite/dist/index.js npx tsx --test lib/game/points/item-grant.sql.test.ts
// A concessão manual de item Ambassador Edition (migração 052) contra o SQL DE VERDADE das migrações 039 + 042 + 043 + 050 + 051 + 052 (PGlite 0.6).
// Sem `PGLITE` os testes são PULADOS: não valem como aprovados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PGLITE = process.env.PGLITE
const pular = PGLITE ? false : 'sem PGLITE: o SQL da 052 NAO foi exercitado'
const MIG = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations')
const ler = (f: string): string => readFileSync(join(MIG, f), 'utf8')

const ANA = 'bc1p' + 'a'.repeat(58)
const BIA = 'bc1p' + 'b'.repeat(58)
const SEM = 'bc1p' + 'c'.repeat(58) // sem handle
const NOTA = 'One-time ambassador bonus: 4 visitors reached the mint through the link'
const CHAMADA = `select public.ambassador_item_grant_handle('@jdog', 'quad', 4, '${NOTA}');`

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
// cada caso que ESPERA recusa roda num banco proprio, clonado do molde
let molde: Blob | File | undefined
async function banco(): Promise<Db> {
  const PGlite = await ctor()
  if (!molde) {
    const db = new PGlite()
    await db.exec(CRIACAO)
    for (const f of ['039_dogcity_cars.sql', '042_dc_points.sql', '043_lot_referrals.sql', '050_dc_points_ranking.sql', '051_dc_points_ambassador_bonus.sql', '052_ambassador_item_grant.sql']) await db.exec(ler(f))
    await db.query(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'jdog')`, [ANA, BIA])
    molde = await (db as unknown as { dumpDataDir(): Promise<Blob | File> }).dumpDataDir()
    await db.close()
  }
  return new PGlite({ loadDataDir: molde })
}
const j = async (db: Db, sql: string, p: unknown[] = []): Promise<Linha> => (await db.query(sql, p)).rows[0]!.r as Linha
const dar = (db: Db, w: string, item: string, lots: number | null, note: string | null = NOTA) =>
  j(db, 'select public.ambassador_item_grant($1,$2,$3,$4) as r', [w, item, lots, note])
const darH = (db: Db, h: string, item: string, lots: number, note: string | null = NOTA) =>
  j(db, 'select public.ambassador_item_grant_handle($1,$2,$3,$4) as r', [h, item, lots, note])
const itens = async (db: Db, w: string) => (await db.query(`select item from public.lot_referral_items where wallet = $1 order by item`, [w])).rows.map((r) => r.item)
const recusa = async (sql: string, p: unknown[], re: RegExp): Promise<void> => {
  const db = await banco()
  await assert.rejects(() => db.query(sql, p), re, sql)
  await db.close()
}

test('a chamada do operador concede o quad pelo handle e grava o motivo', { skip: pular }, async () => {
  const db = await banco()
  const r = await j(db, `select public.ambassador_item_grant_handle('@JDOG', 'quad', 4, $1) as r`, [NOTA])
  assert.deepEqual(r, { status: 'unlocked', item: 'quad', wallet_short: BIA.slice(0, 8) + '...' + BIA.slice(-4) })
  const l = (await db.query(`select wallet, item, lots_at_unlock, order_id, note, granted_by from public.lot_referral_items`)).rows
  assert.deepEqual(l, [{ wallet: BIA, item: 'quad', lots_at_unlock: 4, order_id: null, note: NOTA, granted_by: 'operator' }])
  await db.close()
})

test('o item aparece na consulta da rota exatamente como um item ganho por lotes', { skip: pular }, async () => {
  const db = await banco()
  await dar(db, BIA, 'quad', 4)
  // a mesma consulta de app/api/dogcity/referral-items/route.ts: so (wallet, item), sem filtro de pedido
  const manual = (await db.query(`select item from public.lot_referral_items where wallet = $1`, [BIA])).rows
  assert.deepEqual(manual, [{ item: 'quad' }])
  // item ganho por lotes (linha da 043): mesma forma na consulta
  await db.query(`insert into public.lot_referral_items (wallet, item, lots_at_unlock, order_id) values ($1,'quad',3,gen_random_uuid())`, [ANA])
  assert.deepEqual((await db.query(`select item from public.lot_referral_items where wallet = $1`, [ANA])).rows, manual)
  // lotsReferred segue contando so lotes de verdade
  const n = (await db.query(`select count(*)::int as n from public.lot_referral_rewards where wallet = $1 and side = 'owner' and status = 'credited'`, [BIA])).rows[0]!.n
  assert.equal(n, 0)
  await db.close()
})

test('a segunda chamada devolve already e nao duplica; outros itens e carteiras seguem independentes', { skip: pular }, async () => {
  const db = await banco()
  assert.equal((await dar(db, BIA, 'quad', 4)).status, 'unlocked')
  const b = await dar(db, BIA, 'quad', 99, 'outra nota')
  assert.equal(b.status, 'already')
  assert.deepEqual((await db.query(`select lots_at_unlock, note from public.lot_referral_items where wallet = $1`, [BIA])).rows, [{ lots_at_unlock: 4, note: NOTA }], 'a primeira linha fica intacta')
  assert.equal((await darH(db, '@jdog', 'quad', 4)).status, 'already')
  assert.equal((await dar(db, BIA, 'jet', 10)).status, 'unlocked')
  assert.equal((await dar(db, ANA, 'm4', 25)).status, 'unlocked')
  assert.deepEqual(await itens(db, BIA), ['jet', 'quad'])
  assert.deepEqual(await itens(db, ANA), ['m4'])
  await db.close()
})

test('sem handle, handle inexistente, endereco nao bech32 e arroba/maiusculas', { skip: pular }, async () => {
  const db = await banco()
  assert.deepEqual(await dar(db, SEM, 'quad', 4), { status: 'no_handle' })
  assert.equal((await db.query(`select count(*)::int as n from public.lot_referral_items`)).rows[0]!.n, 0)
  for (const h of ['@ninguem', 'x', '', "ana'; --"]) assert.deepEqual(await darH(db, h, 'quad', 4), { status: 'no_profile' }, h)
  await db.query(`insert into public.dogcity_profiles (address, handle) values ('1abcdefghijklmnopqrstuvwxyz1234', 'legacy')`)
  assert.deepEqual(await darH(db, 'legacy', 'quad', 4), { status: 'unsupported_address' })
  assert.equal((await darH(db, '  @AnA ', 'quad', 3)).status, 'unlocked')
  assert.equal((await db.query(`select count(*)::int as n from public.lot_referral_items`)).rows[0]!.n, 1)
  await db.close()
})

test('item desconhecido, conversoes abaixo da regua, nota e carteira ruins LANCAM', { skip: pular }, async () => {
  const q = 'select public.ambassador_item_grant($1,$2,$3,$4) as r'
  for (const [w, i, n, t, re] of [
    [BIA, 'tank', 4, NOTA, /unknown item/], [BIA, null, 4, NOTA, /unknown item/], [BIA, 'QUAD', 4, NOTA, /unknown item/],
    [BIA, 'quad', 2, NOTA, /threshold/], [BIA, 'quad', 0, NOTA, /threshold/], [BIA, 'quad', null, NOTA, /threshold/],
    [BIA, 'jet', 9, NOTA, /threshold/], [BIA, 'm4', 24, NOTA, /threshold/], [BIA, 'm4', 4, NOTA, /threshold/],
    [BIA, 'quad', 4, '', /reason is required/], [BIA, 'quad', 4, '   ', /reason is required/], [BIA, 'quad', 4, null, /reason is required/], [BIA, 'quad', 4, 'n'.repeat(201), /reason is required/],
    ['nao-e-carteira', 'quad', 4, NOTA, /bad wallet/], [null, 'quad', 4, NOTA, /bad wallet/],
  ] as Array<[string | null, string | null, number | null, string | null, RegExp]>) await recusa(q, [w, i, n, t], re)
  const db = await banco()
  assert.equal((await dar(db, BIA, 'm4', 25, 'n'.repeat(200))).status, 'unlocked', 'nota de 200 passa; 25 passa no m4')
  await db.close()
})

test('o credito automatico posterior por lotes nao da erro, nao duplica e nao mexe na concessao', { skip: pular }, async () => {
  const db = await banco()
  await dar(db, BIA, 'quad', 4)
  const credita = async (i: number) => j(db, `select public.lot_referral_credit($1::uuid,'owner',$2,500,'S01-Q01-B001-L001','S01-Q01-B001-L001','jdog',$2,$3,false,100,now()) as r`,
    [`00000000-0000-4000-8000-00000000000${i}`, BIA, ANA])
  for (let i = 1; i <= 3; i++) assert.equal((await credita(i)).status, 'ok')
  // 3 lotes de verdade: tenta inserir o quad, conflita e segue
  assert.deepEqual(await itens(db, BIA), ['quad'])
  assert.deepEqual((await db.query(`select lots_at_unlock, order_id, note, granted_by from public.lot_referral_items where wallet = $1`, [BIA])).rows, [{ lots_at_unlock: 4, order_id: null, note: NOTA, granted_by: 'operator' }])
  assert.equal((await db.query(`select count(*)::int as n from public.lot_referral_rewards where wallet = $1 and side = 'owner' and status = 'credited'`, [BIA])).rows[0]!.n, 3, 'a contagem de lotes de verdade e' + ' so a real')
  // o contrario: creditar por lotes antes, conceder depois = already
  assert.equal((await dar(db, BIA, 'quad', 4)).status, 'already')
  // concessao nao toca no livro de DC
  assert.equal((await db.query(`select count(*)::int as n from public.dc_points_ledger where source = 'bonus'`)).rows[0]!.n, 0)
  await db.close()
})

test('a concessao nao conta como lote: o item por lotes de verdade sai igual sem ela', { skip: pular }, async () => {
  const db = await banco()
  await dar(db, ANA, 'quad', 3)
  const r = await j(db, `select public.lot_referral_credit('00000000-0000-4000-8000-000000000009'::uuid,'owner',$1,500,'S01-Q01-B001-L001','S01-Q01-B001-L001','ana',$1,$2,false,100,now()) as r`, [ANA, BIA])
  assert.equal(r.status, 'ok')
  assert.equal((await db.query(`select count(*)::int as n from public.lot_referral_rewards where wallet = $1 and status = 'credited'`, [ANA])).rows[0]!.n, 1)
  assert.deepEqual(await itens(db, ANA), ['quad'], 'segue um so')
  await db.close()
})

test('a 052 aplicada duas vezes nao muda nada', { skip: pular }, async () => {
  const db = await banco()
  await dar(db, BIA, 'quad', 4)
  const cols = async () => (await db.query(`select column_name from information_schema.columns where table_name = 'lot_referral_items' order by column_name`)).rows
  const antes = await cols()
  await db.exec(ler('052_ambassador_item_grant.sql'))
  assert.deepEqual(await cols(), antes)
  assert.deepEqual(antes.map((c) => c.column_name), ['granted_by', 'item', 'lots_at_unlock', 'note', 'order_id', 'unlocked_at', 'wallet'])
  assert.equal((await dar(db, BIA, 'quad', 4)).status, 'already')
  assert.equal((await db.query(`select count(*)::int as n from public.lot_referral_items`)).rows[0]!.n, 1)
  await db.close()
})

test('permissoes com papeis reais: so o service_role executa', { skip: pular }, async () => {
  const db = await banco()
  const fns = ['public.ambassador_item_grant(text,text,integer,text)', 'public.ambassador_item_grant_handle(text,text,integer,text)']
  for (const f of fns) {
    const r = (await db.query(`select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as auth, has_function_privilege('service_role', $1, 'execute') as srv`, [f])).rows[0]
    assert.deepEqual(r, { anon: false, auth: false, srv: true }, f)
  }
  await db.exec(`set role anon`)
  await assert.rejects(() => db.query(`select public.ambassador_item_grant_handle('jdog', 'quad', 4, 'n')`), /permission denied/)
  await db.exec(`reset role`)
  await db.exec(`set role authenticated`)
  await assert.rejects(() => db.query(`select public.ambassador_item_grant($1, 'quad', 4, 'n')`, [BIA]), /permission denied/)
  await db.exec(`reset role`)
  assert.equal((await db.query(`select count(*)::int as n from public.lot_referral_items`)).rows[0]!.n, 0)
  await db.close()
})

test('o texto da migracao e a chamada do operador nao tem palavra destrutiva', () => {
  const ruim = /\b(delete|drop|truncate|update)\b/i
  assert.ok(!ruim.test(ler('052_ambassador_item_grant.sql')))
  assert.ok(!ruim.test(CHAMADA))
  assert.ok(!/update/i.test(ler('052_ambassador_item_grant.sql')), 'nem como pedaco de palavra')
})
