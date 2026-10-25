// Rodar: npx tsx --test lib/referral/sources.test.ts
//
// As fontes da contagem com fetch e banco FALSOS (nenhuma rede): o lookup do mint em grupos de 4, a queda para
// pedidos individuais num 400, o bloco do mint pelo reveal, e as licencas lidas do livro e do BTC.
import test from 'node:test'
import assert from 'node:assert/strict'
import { btcPayments, dogPayments, mintLookup, resolveMintBlock, FUND_DOG_ADDRESS, type FetchFn } from './sources'
import { walletProgress } from './tally'

const addr = (c: string) => 'bc1p' + c.repeat(58)
const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map(addr)
const REVEAL = 'ad255cee5ee31c3e593e77ebf54e42f504733657a3831732e81487280ebac790'

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

test('mintLookup: grupos de 4 enderecos; o endereco sem lote vem com lista vazia', async () => {
  const urls: string[] = []
  const f: FetchFn = async (url) => {
    urls.push(url)
    const asked = new URL(url).searchParams.getAll('address')
    return reply(200, { lots: asked.includes(A) ? [{ lotId: 'S02-Q16-B3221-L004', address: A, state: 'minted' }] : [] })
  }
  const out = await mintLookup([A, B, C, D, E], f, 'https://mint.test')
  assert.equal(urls.length, 2)
  assert.equal(new URL(urls[0]).searchParams.getAll('address').length, 4)
  assert.deepEqual(out.get(A), [{ lotId: 'S02-Q16-B3221-L004', state: 'minted' }])
  assert.deepEqual(out.get(E), [])
  assert.equal(out.size, 5)
})

test('mintLookup: 400 no grupo cai para pedidos individuais; o recusado vale vazio, os outros seguem', async () => {
  const f: FetchFn = async (url) => {
    const asked = new URL(url).searchParams.getAll('address')
    if (asked.includes(B)) return reply(400, { error: 'Enter a valid mainnet address.' })
    return reply(200, { lots: asked.map((a) => ({ lotId: 'L-' + a.slice(4, 6), address: a, state: 'available' })) })
  }
  const out = await mintLookup([A, B, C], f, 'https://mint.test')
  assert.deepEqual(out.get(B), [])
  assert.equal(out.get(A)!.length, 1)
  assert.equal(out.get(C)!.length, 1)
})

test('mintLookup: 503 (registro nao carregado), erro de rede ou corpo estranho: o endereco fica AUSENTE (nunca vira "sem lote")', async () => {
  const f503: FetchFn = async () => reply(503, { error: 'not_ready' })
  assert.equal((await mintLookup([A, B], f503, 'https://mint.test')).size, 0)
  const fnet: FetchFn = async () => { throw new Error('ECONNRESET') }
  assert.equal((await mintLookup([A], fnet, 'https://mint.test')).size, 0)
  const fbad: FetchFn = async () => reply(200, { nada: true })
  assert.equal((await mintLookup([A], fbad, 'https://mint.test')).size, 0)
})

test('mintLookup: ignora lote de outro endereco ou com id estranho', async () => {
  const f: FetchFn = async () => reply(200, { lots: [{ lotId: '../x', address: A, state: 'minted' }, { lotId: 'OK-1', address: 'outro', state: 'minted' }, { lotId: 'OK-2', address: A, state: 'minted' }] })
  const out = await mintLookup([A], f, 'https://mint.test')
  assert.deepEqual(out.get(A), [{ lotId: 'OK-2', state: 'minted' }])
})

test('resolveMintBlock: inscriptionId do lote -> txid do reveal -> bloco confirmado', async () => {
  const urls: string[] = []
  const f: FetchFn = async (url) => {
    urls.push(url)
    if (url.includes('/api/mint/lot/')) return reply(200, { lotId: 'L1', state: 'minted', inscriptionId: `${REVEAL}i0` })
    return reply(200, { confirmed: true, block_height: 972_629, block_time: 1_792_686_622 })
  }
  const r = await resolveMintBlock('L1', f, 'https://mint.test', 'https://mempool.test/api')
  assert.deepEqual(r, { block: 972_629, timeMs: 1_792_686_622_000 })
  assert.equal(urls[1], `https://mempool.test/api/tx/${REVEAL}/status`)
})

test('resolveMintBlock: sem inscricao, reveal nao confirmado, lote nao cunhado ou fonte fora: null (ainda nao conta)', async () => {
  const make = (lot: unknown, st: unknown, lotStatus = 200): FetchFn => async (url) =>
    url.includes('/api/mint/lot/') ? reply(lotStatus, lot) : reply(200, st)
  assert.equal(await resolveMintBlock('L1', make({ state: 'minted', inscriptionId: null }, {}), 'https://m', 'https://p'), null)
  assert.equal(await resolveMintBlock('L1', make({ state: 'minted', inscriptionId: `${REVEAL}i0` }, { confirmed: false }), 'https://m', 'https://p'), null)
  assert.equal(await resolveMintBlock('L1', make({ state: 'reserved', inscriptionId: `${REVEAL}i0` }, { confirmed: true, block_height: 5 }), 'https://m', 'https://p'), null)
  assert.equal(await resolveMintBlock('L1', make({}, {}, 503), 'https://m', 'https://p'), null)
  assert.equal(await resolveMintBlock('L1', async () => { throw new Error('x') }, 'https://m', 'https://p'), null)
  assert.equal(await resolveMintBlock('../../etc', make({}, {}), 'https://m', 'https://p'), null)
})

// ── licencas ────────────────────────────────────────────────────────────────

function fakeDb(rowsByTable: Record<string, unknown[]>, err: Record<string, string> = {}) {
  return {
    from(table: string) {
      const q: any = {}
      for (const m of ['select', 'contains', 'order', 'limit', 'gte', 'in', 'eq']) q[m] = () => q
      q.then = (res: (v: unknown) => unknown) => res(err[table] ? { data: null, error: { message: err[table] } } : { data: rowsByTable[table] ?? [], error: null })
      return q
    },
  } as any
}

// transacoes no formato de dog_transactions: BOB doa ao fundo
const tx = (id: number, txid: string, block: number, ts: string, from: string, atomos: number) => ({
  id, txid, block_height: block, timestamp: ts,
  senders: [{ address: from, amount: atomos, amount_dog: atomos / 1e5, has_dog: true }],
  receivers: [{ address: FUND_DOG_ADDRESS, amount: atomos, amount_dog: atomos / 1e5, vout: 1 }],
})

test('dogPayments: le o livro com a regra do fundo (contributionOf) e devolve so o que ESTA carteira pagou', async () => {
  const rows = [
    tx(1, 't1', 972_000, '2026-10-20T10:00:00Z', A, 5_000_00000), // 5.000 DOG, antes do vinculo
    tx(2, 't2', 973_100, '2026-10-25T13:00:00Z', A, 12_000_00000), // 12.000 DOG, depois
    tx(2, 't2', 973_100, '2026-10-25T13:00:00Z', A, 12_000_00000), // duplicada: nao conta duas vezes
    tx(3, 't3', 973_100, '2026-10-25T13:00:00Z', B, 99_000_00000), // outra carteira (nao deveria vir; defesa)
  ]
  const pays = await dogPayments(fakeDb({ dog_transactions: rows }), A, 973_000, Date.UTC(2026, 9, 25, 12))
  assert.deepEqual(pays.map((p) => [p.kind, p.dog, p.block]), [['dog', 5000, 972_000], ['dog', 12000, 973_100]])
  const p = walletProgress({ referred: A, referrer: B, linkedAtMs: Date.UTC(2026, 9, 25, 12), linkedBlock: 973_000 }, [], pays)
  assert.equal(p.licenceDog, 12_000)
  assert.equal(p.tier, 'personal')
})

test('dogPayments: o fundo como remetente nunca e doacao; erro do banco LANCA (a carteira nao e gravada)', async () => {
  const saida = { id: 9, txid: 't9', block_height: 973_100, timestamp: '2026-10-25T13:00:00Z',
    senders: [{ address: FUND_DOG_ADDRESS, amount: 100, has_dog: true }], receivers: [{ address: A, amount: 100, vout: 1 }] }
  assert.deepEqual(await dogPayments(fakeDb({ dog_transactions: [saida] }), A, 973_000, 0), [])
  await assert.rejects(dogPayments(fakeDb({}, { dog_transactions: 'boom' }), A, 973_000, 0), /boom/)
})

test('btcPayments: credit_dog por endereco com o bloco; linha sem credito ou de outro endereco e ignorada; erro lanca', async () => {
  const rows = [
    { ordinals_address: A, credit_dog: 10000, block_height: 973_200, block_time: '2026-10-25T14:00:00Z', credited_at: '2026-10-25T14:30:00Z' },
    { ordinals_address: A, credit_dog: null, block_height: 973_201, block_time: null, credited_at: null },
    { ordinals_address: C, credit_dog: 5, block_height: 1, block_time: null, credited_at: null },
    { ordinals_address: B, credit_dog: 500, block_height: null, block_time: null, credited_at: '2026-10-25T15:00:00Z' },
  ]
  const out = await btcPayments(fakeDb({ dogcity_btc_payments: rows }), [A, B])
  assert.deepEqual(out.get(A), [{ kind: 'btc', dog: 10000, block: 973_200, timeMs: Date.parse('2026-10-25T14:00:00Z') }])
  assert.deepEqual(out.get(B), [{ kind: 'btc', dog: 500, block: null, timeMs: Date.parse('2026-10-25T15:00:00Z') }])
  assert.equal(out.has(C), false)
  await assert.rejects(btcPayments(fakeDb({}, { dogcity_btc_payments: 'down' }), [A]), /down/)
})
