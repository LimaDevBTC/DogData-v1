// Rodar: npx tsx --test lib/game/points/ranking.test.ts
//
// O ranking dos DC Points (migração 050): o espelho em memória (ranking-memory.ts) imita dc_points_ranking; o SQL de verdade
// foi provado à parte no PGlite com o mesmo cenário (ver o PR). Aqui: gasto não derruba, migração entra no Total e não na
// semana, herdado não migrado entra uma vez só, empate, `me` só com sessão, endereço abreviado, e o SQL só aditivo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { memoryRanking, type RankLine } from './ranking-memory'
import { parseRankingQuery, toPublicRanking } from './ranking'

const w = (c: string) => 'bc1p' + c.repeat(58)
const [A, B, C, D, E, F] = ['a', 'b', 'c', 'd', 'e', 'f'].map(w)
const TODAY = '2026-11-27'
const handles: Record<string, string | null> = { [A]: 'alice', [B]: 'bob', [C]: 'carol', [D]: 'dave', [E]: 'erin', [F]: null }
const ln = (wallet: string, kind: string, source: string, delta: number, day = TODAY, at = '2026-11-20T10:00:00Z'): RankLine =>
  ({ wallet, kind, source, delta, day, at })
const base = {
  lines: [
    ln(A, 'earn', 'checkin', 50), ln(A, 'earn', 'pesca', 100), ln(A, 'spend', 'market', -80), ln(A, 'car', 'c02', -12500),
    ln(A, 'migration', 'save', 200, '2026-10-29'), ln(A, 'refund', 'refund', 99),
    ln(B, 'earn', 'checkin', 50, '2026-11-17', '2026-11-10T10:00:00Z'), ln(B, 'earn', 'checkin', 50, '2026-11-26', '2026-11-21T10:00:00Z'),
    ln(C, 'referral', 'referral', 500, '2026-11-25'), ln(C, 'earn', 'checkin', 50, TODAY, '2026-11-25T00:00:00Z'),
    ln(D, 'earn', 'checkin', 150, TODAY, '2026-11-22T00:00:00Z'),
  ],
  legacy: [
    { wallet: A, amount: 200, at: '2026-11-15T00:00:00Z' }, // já migrou: não soma de novo
    { wallet: E, amount: 165, at: '2026-11-15T00:00:00Z' }, // não migrou, tem handle: soma
    { wallet: F, amount: 70, at: '2026-11-15T00:00:00Z' }, // sem handle: não migra, não aparece
  ],
  handles, migrated: [A],
}
const run = (board: 'total' | 'login' | 'ambassador', period: 'all' | 'week', wallet: string | null = null) =>
  memoryRanking(base, board, period, 100, wallet, TODAY)
const pts = (r: ReturnType<typeof run>) => r.rows.map((x) => [x.handle, x.points, x.rank])

test('gasto, compra de carro e estorno nunca derrubam nem inflam: o ranking soma só o ganho', () => {
  const t = run('total', 'all')
  assert.equal(t.rows.find((x) => x.handle === 'alice')!.points, 350) // 50 + 100 + 200 migrados; -80, -12.500 e o estorno de 99 fora
})

test('a migração entra no Total all time e não entra na semana', () => {
  assert.equal(run('total', 'all').rows.find((x) => x.handle === 'alice')!.points, 350)
  assert.equal(run('total', 'week').rows.find((x) => x.handle === 'alice')!.points, 150)
})

test('herdado que ainda não migrou entra UMA vez; quem migrou não soma a foto de novo; sem handle não aparece; semana não leva herdado', () => {
  const t = run('total', 'all')
  assert.equal(t.rows.find((x) => x.handle === 'erin')!.points, 165)
  assert.equal(t.rows.find((x) => x.handle === 'alice')!.points, 350) // 200 do livro, não 400
  assert.ok(!t.rows.some((x) => x.wallet === F))
  assert.ok(!run('total', 'week').rows.some((x) => x.handle === 'erin'))
  assert.ok(!run('login', 'all').rows.some((x) => x.handle === 'erin'))
})

test('quadros: Login só check-in, Ambassador só indicação, ambos fora do herdado e da migração', () => {
  assert.deepEqual(pts(run('login', 'all')), [['dave', 150, 1], ['bob', 100, 2], ['alice', 50, 3], ['carol', 50, 3]])
  assert.deepEqual(pts(run('ambassador', 'all')), [['carol', 500, 1]])
  assert.equal(run('ambassador', 'all').total, 1)
})

test('semana: só os últimos 7 dias de jogo', () => {
  const b = run('login', 'week')
  assert.equal(b.rows.find((x) => x.handle === 'bob')!.points, 50) // o check-in de 17/11 ficou de fora
  assert.equal(run('login', 'all').rows.find((x) => x.handle === 'bob')!.points, 100)
})

test('empate: mesma posição, ordem de quem chegou primeiro; o seguinte pula a posição', () => {
  const t = run('total', 'week')
  assert.deepEqual(pts(t), [['carol', 550, 1], ['alice', 150, 2], ['dave', 150, 2], ['bob', 50, 4]])
})

test('quadro vazio é lista vazia, não erro', () => {
  const r = memoryRanking({ lines: [], legacy: [], handles: {}, migrated: [] }, 'ambassador', 'all', 100, null, TODAY)
  assert.deepEqual([r.total, r.rows.length, r.me], [0, 0, null])
})

test('`me`: só aparece com sessão (a rota passa hasSession); sem sessão é sempre null', () => {
  const raw = run('total', 'all', A)
  assert.deepEqual(raw.me, { rank: 2, points: 350 })
  assert.deepEqual(toPublicRanking(raw, 'total', 'all', true).me, { rank: 2, points: 350 })
  assert.equal(toPublicRanking(raw, 'total', 'all', false).me, null)
  assert.equal(toPublicRanking(run('total', 'all', F), 'total', 'all', true).me, null) // sem ponto: fora do quadro
})

test('endereço: sai abreviado, nunca inteiro; linha com handle não leva caminho; linha sem handle leva o caminho interno', () => {
  const pub = toPublicRanking(run('total', 'all'), 'total', 'all', false)
  const json = JSON.stringify(pub)
  for (const full of [A, B, C, D, E]) assert.ok(!json.includes(full), 'endereço inteiro vazou')
  const alice = pub.rows.find((x) => x.handle === 'alice')!
  assert.ok(alice.wallet.includes('…') && alice.wallet.startsWith('bc1paaaaaa') && alice.walletPath === null)
  const semHandle = toPublicRanking({ ...run('total', 'all'), rows: [{ rank: 1, wallet: F, handle: null, avatar: null, points: 5 }] }, 'total', 'all', false)
  assert.equal(semHandle.rows[0].walletPath, `/address/bitcoin/${F}`) // caminho INTERNO, nunca mempool.space
  assert.ok(!semHandle.rows[0].walletPath!.includes('http'))
})

test('a resposta do banco é lida com desconfiança: forma inesperada lança', () => {
  assert.throws(() => toPublicRanking(null, 'total', 'all', false))
  assert.throws(() => toPublicRanking({ total: 1, rows: 'x', updated_at: new Date().toISOString() }, 'total', 'all', false))
  assert.throws(() => toPublicRanking({ total: 1, rows: [{ rank: 1, wallet: 'x', points: 1 }], updated_at: new Date().toISOString() }, 'total', 'all', false))
  assert.throws(() => toPublicRanking({ total: 0, rows: [], updated_at: 'ontem' }, 'total', 'all', false))
  // handle e foto fora do formato viram null, nunca texto solto
  const r = toPublicRanking({ total: 1, updated_at: new Date().toISOString(), rows: [{ rank: 1, wallet: A, handle: '<b>x</b>', avatar: 'javascript:1', points: 3 }] }, 'total', 'all', false)
  assert.deepEqual([r.rows[0].handle, r.rows[0].avatar], [null, null])
})

test('parâmetros: fora da lista cai no padrão; limit entre 1 e 100; me só com 1', () => {
  const q = (s: string) => parseRankingQuery(new URLSearchParams(s))
  assert.deepEqual(q(''), { board: 'total', period: 'all', limit: 100, me: false })
  assert.deepEqual(q('board=login&period=week&limit=10&me=1'), { board: 'login', period: 'week', limit: 10, me: true })
  assert.deepEqual(q('board=__proto__&period=x&limit=-5&me=yes'), { board: 'total', period: 'all', limit: 100, me: false })
  assert.equal(q('limit=99999').limit, 100)
  assert.equal(q('limit=0').limit, 1)
})

test('a migração 050 é só aditiva (sem delete, drop, truncate, insert, update) e fecha as funções ao service role', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/050_dc_points_ranking.sql'), 'utf8')
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase()
  for (const verbo of ['delete ', 'drop ', 'truncate', 'insert ', 'update ', 'alter ']) assert.ok(!code.includes(verbo), verbo)
  assert.match(code, /grant execute on function public\.dc_points_ranking\(text, text, integer, text\) to service_role/)
  assert.match(code, /revoke all on function public\.dc_points_ranking\(text, text, integer, text\) from public, anon, authenticated/)
  assert.match(code, /create index if not exists dc_points_ledger_rank_idx on public\.dc_points_ledger \(source, game_day\)/)
  assert.ok(!sql.includes('—') && !sql.includes('–'))
})
