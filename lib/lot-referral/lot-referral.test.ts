import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runReferralJob, type CreditArgs, type CreditStatus, type JobDeps } from './job'
import { parseFeedPage, parseHolders } from './io'
import {
  blockOf, decide, parseItemsHandle, referrerHandleOf, fitsDailyCeiling, isFeedItem, isMature, itemsFor, weeklyRanking, type FeedItem,
} from './rules'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const LOT_A = 'S05-Q07-B0602-L018' // lote de quem indicou
const LOT_A2 = 'S05-Q07-B0602-L019' // mesma quadra
const LOT_B = 'S01-Q00-B0001-L001' // outra quadra
const OWNER = 'bc1p' + 'a'.repeat(58)
const G1 = 'bc1p' + 'b'.repeat(58)
const G2 = 'bc1p' + 'c'.repeat(58)
const oid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const feed = (n: number, over: Partial<FeedItem> = {}): FeedItem => ({
  order_id: oid(n), lot_id: LOT_B, referrer_lot: LOT_A, referrer_handle: null, receive_address: G1, payer_address: null,
  indexed_at: '2026-11-17T10:00:00.000Z', indexed_block: 976_000, ...over,
})

describe('quadra e maturidade', () => {
  it('blockOf tira o -Lnnn', () => {
    assert.equal(blockOf(LOT_A), 'S05-Q07-B0602')
    assert.equal(blockOf(LOT_A), blockOf(LOT_A2))
    assert.notEqual(blockOf(LOT_B), blockOf(LOT_A))
  })
  it('144 blocos: 143 não, 144 sim; sem altura do pedido, 26 h', () => {
    const it0 = { indexed_at: '2026-11-17T10:00:00Z', indexed_block: 1000 }
    assert.equal(isMature(it0, 1143, NOW), false)
    assert.equal(isMature(it0, 1144, NOW), true)
    assert.equal(isMature(it0, null, NOW), false)
    assert.equal(isMature({ indexed_at: '2026-11-19T09:00:00Z', indexed_block: null }, null, NOW), true)
    assert.equal(isMature({ indexed_at: '2026-11-20T00:00:00Z', indexed_block: null }, null, NOW), false)
    assert.equal(isMature({ indexed_at: null, indexed_block: null }, 5, NOW), false)
  })
})

describe('decide', () => {
  it('500 + 250 normal', () => {
    assert.deepEqual(decide(feed(1), OWNER, 976_144, NOW), { kind: 'credit', sameBlock: false, ownerAmount: 500, guestAmount: 250, ownerWallet: OWNER, guestWallet: G1 })
  })
  it('dobro para os dois na mesma quadra', () => {
    assert.deepEqual(decide(feed(1, { lot_id: LOT_A2 }), OWNER, 976_144, NOW), { kind: 'credit', sameBlock: true, ownerAmount: 1000, guestAmount: 500, ownerWallet: OWNER, guestWallet: G1 })
  })
  it('nunca o próprio lote', () => {
    assert.deepEqual(decide(feed(1, { lot_id: LOT_A }), OWNER, 976_144, NOW), { kind: 'reject', reason: 'self_lot' })
  })
  it('indicado igual ao dono do lote: recusa, também em maiúsculas e antes da maturidade', () => {
    assert.deepEqual(decide(feed(1, { receive_address: OWNER }), OWNER, 976_144, NOW), { kind: 'reject', reason: 'self_wallet' })
    assert.deepEqual(decide(feed(1, { receive_address: OWNER.toUpperCase() }), OWNER, 100, NOW), { kind: 'reject', reason: 'self_wallet' })
  })
  it('handle: credita o endereço do handle; dobro se o indicador guarda escritura na quadra do lote indicado', () => {
    const h = feed(1, { referrer_lot: null, referrer_handle: 'alice' })
    assert.deepEqual(decide(h, OWNER, 976_144, NOW), { kind: 'credit', sameBlock: false, ownerAmount: 500, guestAmount: 250, ownerWallet: OWNER, guestWallet: G1 })
    assert.deepEqual(decide(h, OWNER, 976_144, NOW, new Set([blockOf(LOT_A)])), { kind: 'credit', sameBlock: false, ownerAmount: 500, guestAmount: 250, ownerWallet: OWNER, guestWallet: G1 })
    assert.deepEqual(decide(h, OWNER, 976_144, NOW, new Set([blockOf(LOT_B)])), { kind: 'credit', sameBlock: true, ownerAmount: 1000, guestAmount: 500, ownerWallet: OWNER, guestWallet: G1 })
  })
  it('handle que não existe: recusa; handle com @ e maiúsculas vale como o normalizado', () => {
    assert.deepEqual(decide(feed(1, { referrer_lot: null, referrer_handle: 'ghost' }), null, 976_144, NOW), { kind: 'reject', reason: 'unknown_handle' })
    assert.equal(referrerHandleOf(feed(1, { referrer_handle: '@Alice' })), 'alice')
  })
  it('autoindicação por handle: recebe ou paga com o endereço do indicador', () => {
    const h = (o: Partial<FeedItem>) => feed(1, { referrer_lot: null, referrer_handle: 'alice', ...o })
    assert.deepEqual(decide(h({ receive_address: OWNER }), OWNER, 976_144, NOW), { kind: 'reject', reason: 'self_wallet' })
    assert.deepEqual(decide(h({ payer_address: OWNER }), OWNER, 100, NOW), { kind: 'reject', reason: 'self_wallet' })
    assert.equal(decide(h({ payer_address: G2 }), OWNER, 976_144, NOW).kind, 'credit')
  })
  it('autoindicação por lote: pagador igual ao dono do lote', () => {
    assert.deepEqual(decide(feed(1, { payer_address: OWNER }), OWNER, 976_144, NOW), { kind: 'reject', reason: 'self_wallet' })
  })
  it('espera: sem maturidade ou sem dono conhecido', () => {
    assert.deepEqual(decide(feed(1), OWNER, 976_143, NOW), { kind: 'wait', reason: 'not_mature' })
    assert.deepEqual(decide(feed(1), null, 976_144, NOW), { kind: 'wait', reason: 'owner_unknown' })
  })
})

describe('teto, itens, ranking, forma', () => {
  it('teto diário de 5.000', () => {
    assert.equal(fitsDailyCeiling(4000, 1000), true)
    assert.equal(fitsDailyCeiling(4001, 1000), false)
    assert.equal(fitsDailyCeiling(0, 5001), false)
  })
  it('itens por quantidade: 3 quad, 10 jet, 25 m4', () => {
    assert.deepEqual(itemsFor(2), [])
    assert.deepEqual(itemsFor(3), ['quad'])
    assert.deepEqual(itemsFor(10), ['quad', 'jet'])
    assert.deepEqual(itemsFor(25), ['quad', 'jet', 'm4'])
  })
  it('ranking top 3 com prêmios; empate: quem chegou primeiro', () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => ({ wallet: 'W1', created_at: `2026-11-18T10:0${i}:00Z` })),
      ...Array.from({ length: 3 }, (_, i) => ({ wallet: 'W2', created_at: `2026-11-18T09:0${i}:00Z` })),
      { wallet: 'W3', created_at: '2026-11-18T11:00:00Z' }, { wallet: 'W4', created_at: '2026-11-18T11:01:00Z' },
      { wallet: 'W5', created_at: '2026-11-18T11:02:00Z' },
    ]
    assert.deepEqual(weeklyRanking(rows), [
      { rank: 1, wallet: 'W2', lots: 3, prizeDc: 5000 }, { rank: 2, wallet: 'W1', lots: 3, prizeDc: 2500 }, { rank: 3, wallet: 'W3', lots: 1, prizeDc: 1000 },
    ])
  })
  it('o feed hostil: linha malformada cai fora', () => {
    assert.equal(isFeedItem(feed(1)), true)
    assert.equal(isFeedItem(feed(1, { referrer_lot: null, referrer_handle: 'alice' })), true)
    assert.equal(isFeedItem({ ...feed(1), payer_address: undefined }), true)
    for (const bad of [feed(1, { referrer_lot: null, referrer_handle: null }), feed(1, { referrer_handle: 'a b' }), feed(1, { payer_address: 'x' }), null, {}, { ...feed(1), lot_id: 'x' }, { ...feed(1), order_id: 'x' }, { ...feed(1), indexed_block: -1 }, { ...feed(1), indexed_block: 1.5 }, { ...feed(1), receive_address: 'x' }]) {
      assert.equal(isFeedItem(bad), false)
    }
    assert.equal(parseFeedPage({ items: [feed(1), { lixo: 1 }], next: null }).items.length, 1)
    assert.throws(() => parseFeedPage({ nope: 1 }))
  })
  it('detentores: só lote mintado com holder válido', () => {
    const m = parseHolders({ lots: [
      { lotId: LOT_A, state: 'minted', holder: OWNER }, { lotId: LOT_B, state: 'reserved', holder: OWNER }, { lotId: LOT_A2, state: 'minted', holder: null },
    ] })
    assert.equal(m.get(LOT_A), OWNER)
    assert.equal(m.get(LOT_B), null)
    assert.equal(m.get(LOT_A2), null)
  })
})

// ── um banco de mentira que imita 043 (unicidade por pedido+lado, handle, teto diário, boas-vindas única, itens) ──────────────
function fakeWorld(opts: { handles: Set<string>; owners: Map<string, string | null>; handleOwners?: Map<string, string | null>; held?: Map<string, string[]>; heldFails?: boolean; links?: Map<string, string>; height: number | null; feedItems: FeedItem[]; pageSize?: number }) {
  const rows = new Map<string, { status: string; wallet: string | null; amount: number }>() // `${order}|${side}`
  const ledger: Array<{ ref: string; wallet: string; delta: number }> = []
  const items = new Set<string>()
  const links = opts.links ?? new Map<string, string>() // referred -> referrer (referral_links: o primeiro vence)
  const credit = async (a: CreditArgs): Promise<CreditStatus> => {
    const key = `${a.orderId}|${a.side}`
    if (rows.has(key)) return 'duplicate'
    if (a.side === 'guest' && [...rows.entries()].some(([k, r]) => k.endsWith('|guest') && r.wallet === a.wallet && r.status === 'credited')) {
      rows.set(key, { status: 'guest_taken', wallet: a.wallet, amount: a.amount }); return 'guest_taken'
    }
    if (!opts.handles.has(a.wallet)) return 'no_handle'
    const today = ledger.filter((l) => l.wallet === a.wallet).reduce((s, l) => s + l.delta, 0)
    if (!fitsDailyCeiling(today, a.amount)) { rows.set(key, { status: 'review', wallet: a.wallet, amount: a.amount }); return 'review' }
    ledger.push({ ref: key, wallet: a.wallet, delta: a.amount })
    if (!links.has(a.guestWallet) && a.guestWallet !== a.referrerWallet) links.set(a.guestWallet, a.referrerWallet)
    rows.set(key, { status: 'credited', wallet: a.wallet, amount: a.amount })
    if (a.side === 'owner') {
      const n = [...rows.entries()].filter(([k, r]) => k.endsWith('|owner') && r.wallet === a.wallet && r.status === 'credited').length
      for (const it of itemsFor(n)) items.add(`${a.wallet}|${it}`)
    }
    return 'ok'
  }
  const deps: JobDeps = {
    now: () => NOW,
    height: async () => opts.height,
    async feedPage(after) {
      const size = opts.pageSize ?? 200
      const start = after ? Number(after) : 0
      const slice = opts.feedItems.slice(start, start + size)
      return { items: slice, next: start + size < opts.feedItems.length ? String(start + size) : null }
    },
    async resolved(ids) {
      const out = new Map<string, Set<string>>()
      for (const [k] of rows) { const [o, s] = k.split('|'); if (ids.includes(o)) out.set(o, (out.get(o) ?? new Set()).add(s)) }
      return out
    },
    async holders(lots) { return new Map(lots.map((l) => [l, opts.owners.get(l) ?? null])) },
    async handles(hs) { return new Map(hs.map((h) => [h, opts.handleOwners?.get(h) ?? null])) },
    async heldBlocks(addr) { return opts.heldFails ? new Set<string>() : new Set((opts.held?.get(addr) ?? []).map(blockOf)) },
    credit,
    async reject(item, reason) { rows.set(`${item.order_id}|order`, { status: 'rejected:' + reason, wallet: null, amount: 0 }) },
  }
  return { deps, rows, ledger, items, links }
}
const total = (w: ReturnType<typeof fakeWorld>, wallet: string) => w.ledger.filter((l) => l.wallet === wallet).reduce((s, l) => s + l.delta, 0)

describe('o giro do job', () => {
  const base = () => ({ handles: new Set([OWNER, G1, G2]), owners: new Map([[LOT_A, OWNER]]), height: 976_200 })

  it('credita dono e indicado, e rodar duas vezes não duplica', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1), feed(2, { receive_address: G2 })] })
    const r1 = await runReferralJob(w.deps)
    assert.deepEqual(r1.credited, { owner: 2, guest: 2 })
    assert.equal(total(w, OWNER), 1000)
    assert.equal(total(w, G1), 250)
    const r2 = await runReferralJob(w.deps)
    assert.deepEqual(r2.credited, { owner: 0, guest: 0 })
    assert.equal(r2.skippedDone, 2)
    assert.equal(total(w, OWNER), 1000)
    assert.equal(w.ledger.length, 4)
  })
  it('antes de 144 blocos espera e depois credita', async () => {
    const w = fakeWorld({ ...base(), height: 976_100, feedItems: [feed(1)] })
    assert.equal((await runReferralJob(w.deps)).waiting.not_mature, 1)
    assert.equal(w.ledger.length, 0)
    const w2 = fakeWorld({ ...base(), height: 976_144, feedItems: [feed(1)] })
    assert.equal((await runReferralJob(w2.deps)).credited.owner, 1)
  })
  it('própria carteira e próprio lote: nada é creditado, e o pedido não volta', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1, { receive_address: OWNER }), feed(2, { lot_id: LOT_A })] })
    const r = await runReferralJob(w.deps)
    assert.equal(r.rejected, 2)
    assert.equal(w.ledger.length, 0)
    assert.equal((await runReferralJob(w.deps)).skippedDone, 2)
  })
  it('dono desconhecido espera; dono sem handle tenta de novo no giro seguinte', async () => {
    const w = fakeWorld({ ...base(), owners: new Map(), feedItems: [feed(1)] })
    assert.equal((await runReferralJob(w.deps)).waiting.owner_unknown, 1)
    const w2 = fakeWorld({ ...base(), handles: new Set([G1]), feedItems: [feed(1)] })
    assert.equal((await runReferralJob(w2.deps)).noHandle, 1)
    assert.deepEqual(w2.ledger.map((l) => l.wallet), [G1])
  })
  it('teto de 5.000 por dia: o excesso vai para revisão e não credita', async () => {
    const many = Array.from({ length: 12 }, (_, i) => feed(i + 1, { receive_address: 'bc1p' + String(i).padStart(2, '0').repeat(29) }))
    const handles = new Set([OWNER, ...many.map((m) => m.receive_address)])
    const w = fakeWorld({ ...base(), handles, feedItems: many })
    const r = await runReferralJob(w.deps)
    assert.equal(total(w, OWNER), 5000)
    assert.equal(r.credited.owner, 10)
    assert.equal(r.review, 2)
    assert.equal([...w.rows.values()].filter((x) => x.status === 'review').length, 2)
    await runReferralJob(w.deps)
    assert.equal(total(w, OWNER), 5000)
  })
  it('itens por quantidade de lotes da carteira dona (3 quad, 10 jet)', async () => {
    const many = Array.from({ length: 10 }, (_, i) => feed(i + 1, { receive_address: 'bc1p' + String(i).padStart(2, '0').repeat(29) }))
    const w = fakeWorld({ ...base(), handles: new Set([OWNER, ...many.map((m) => m.receive_address)]), feedItems: many.slice(0, 2) })
    await runReferralJob(w.deps)
    assert.deepEqual([...w.items], [])
    const w2 = fakeWorld({ ...base(), handles: new Set([OWNER, ...many.map((m) => m.receive_address)]), feedItems: many })
    await runReferralJob(w2.deps)
    assert.deepEqual([...w2.items].sort(), [`${OWNER}|jet`, `${OWNER}|quad`])
  })
  it('boas-vindas é uma por indicado: o segundo pedido dele só paga ao dono', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1), feed(2)] })
    const r = await runReferralJob(w.deps)
    assert.deepEqual(r.credited, { owner: 2, guest: 1 })
    assert.equal(total(w, G1), 250)
  })
  it('boas-vindas pendente do primeiro pedido não vai para o segundo', async () => {
    const w = fakeWorld({ ...base(), handles: new Set([OWNER]), feedItems: [feed(1), feed(2)] })
    const r = await runReferralJob(w.deps)
    assert.equal(r.credited.guest, 0)
    assert.equal(r.noHandle, 1)
  })
  it('handle: credita o dono do handle, grava o vínculo e o dobro vem das escrituras do indicador', async () => {
    const h = (n: number, o: Partial<FeedItem> = {}) => feed(n, { referrer_lot: null, referrer_handle: 'alice', ...o })
    const handleOwners = new Map([['alice', OWNER]])
    const w = fakeWorld({ ...base(), handleOwners, held: new Map([[OWNER, [LOT_B.replace('L001', 'L002')]]]), feedItems: [h(1), h(2, { receive_address: G2, lot_id: LOT_A })] })
    const r = await runReferralJob(w.deps)
    assert.deepEqual(r.credited, { owner: 2, guest: 2 })
    assert.equal(total(w, G1), 500) // mesma quadra de uma escritura do indicador: dobro
    assert.equal(total(w, G2), 250)
    assert.equal(total(w, OWNER), 1000 + 500)
    assert.equal(w.links.get(G1), OWNER)
    assert.equal(w.links.get(G2), OWNER)
  })
  it('handle: falha ao consultar as escrituras = sem dobro, e o crédito sai', async () => {
    const w = fakeWorld({ ...base(), handleOwners: new Map([['alice', OWNER]]), held: new Map([[OWNER, [LOT_B]]]), heldFails: true, feedItems: [feed(1, { referrer_lot: null, referrer_handle: 'alice' })] })
    await runReferralJob(w.deps)
    assert.equal(total(w, G1), 250)
  })
  it('handle inexistente: pedido recusado, nada creditado, não volta', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1, { referrer_lot: null, referrer_handle: 'ghost' })] })
    const r = await runReferralJob(w.deps)
    assert.equal(r.rejected, 1)
    assert.equal(w.ledger.length, 0)
    assert.equal(w.rows.get(`${oid(1)}|order`)?.status, 'rejected:unknown_handle')
    assert.equal((await runReferralJob(w.deps)).skippedDone, 1)
  })
  it('autoindicação por handle e por pagador: recusa', async () => {
    const w = fakeWorld({ ...base(), handleOwners: new Map([['alice', OWNER]]), feedItems: [
      feed(1, { referrer_lot: null, referrer_handle: 'alice', receive_address: OWNER }),
      feed(2, { referrer_lot: null, referrer_handle: 'alice', payer_address: OWNER }),
    ] })
    assert.equal((await runReferralJob(w.deps)).rejected, 2)
    assert.equal(w.ledger.length, 0)
  })
  it('lote como atalho continua: credita o dono atual e também grava o vínculo', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1, { lot_id: LOT_A2 })] })
    await runReferralJob(w.deps)
    assert.equal(total(w, OWNER), 1000)
    assert.equal(w.links.get(G1), OWNER)
  })
  it('o vínculo existente não é trocado (o primeiro vence)', async () => {
    const w = fakeWorld({ ...base(), links: new Map([[G1, G2]]), feedItems: [feed(1)] })
    await runReferralJob(w.deps)
    assert.equal(w.links.get(G1), G2)
  })
  it('itens e teto contam por endereço de quem indicou, mesmo misturando handle e lote', async () => {
    const mk = (i: number) => 'bc1p' + String(i).padStart(2, '0').repeat(29)
    const many = [0, 1, 2].map((i) => i === 1 ? feed(i + 1, { receive_address: mk(i) }) : feed(i + 1, { referrer_lot: null, referrer_handle: 'alice', receive_address: mk(i) }))
    const w = fakeWorld({ ...base(), handleOwners: new Map([['alice', OWNER]]), handles: new Set([OWNER, ...many.map((m) => m.receive_address)]), feedItems: many })
    await runReferralJob(w.deps)
    assert.deepEqual([...w.items], [`${OWNER}|quad`])
  })
  it('páginas do feed são percorridas', async () => {
    const items = Array.from({ length: 5 }, (_, i) => feed(i + 1, { receive_address: 'bc1p' + String(i).padStart(2, '0').repeat(29) }))
    const w = fakeWorld({ ...base(), pageSize: 2, handles: new Set([OWNER, ...items.map((m) => m.receive_address)]), feedItems: items })
    const r = await runReferralJob(w.deps)
    assert.equal(r.pages, 3)
    assert.equal(r.credited.owner, 5)
  })
})

describe('a migração 043', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/043_lot_referrals.sql', import.meta.url), 'utf8')
  it('chave única por pedido e lado, boas-vindas única, só service_role executa', () => {
    assert.match(sql, /primary key \(order_id, side\)/)
    assert.match(sql, /lot_referral_guest_once[^;]*where side = 'guest' and status = 'credited'/)
    assert.match(sql, /grant execute on function public\.lot_referral_credit[^;]*to service_role/)
    assert.match(sql, /revoke all on function public\.lot_referral_credit[^;]*from public, anon, authenticated/)
  })
  it('o livro ganha referral fora do teto de 480 (kind próprio)', () => {
    assert.match(sql, /'referral'/)
    assert.doesNotMatch(sql, /kind = 'earn'.*referral/)
  })
  it('handle e lote: referrer_lot anulável, referrer_handle gravado, vínculo em referral_links sem trocar o primeiro', () => {
    assert.match(sql, /referrer_handle text check/)
    assert.match(sql, /check \(referrer_lot is not null or referrer_handle is not null\)/)
    assert.match(sql, /insert into public\.referral_links[^;]*on conflict \(referred_address\) do nothing/)
  })
  it('as assinaturas dos grants batem com as das funções', () => {
    assert.match(sql, /lot_referral_credit\(uuid, text, text, integer, text, text, text, text, text, boolean, integer, timestamptz, integer\)/)
    assert.match(sql, /lot_referral_reject\(uuid, text, text, text, text, text, integer, timestamptz\)/)
  })
  it('aplica toda a mudança numa única transação', () => {
    assert.match(sql, /\nbegin;\n/)
    assert.match(sql, /\ncommit;\s*$/)
  })
})

describe('parseItemsHandle (rota referral-items por handle)', () => {
  it('aceita com ou sem @, em qualquer caixa, e recusa o que não é handle', () => {
    assert.equal(parseItemsHandle('@JDog'), 'jdog')
    assert.equal(parseItemsHandle(' jdog '), 'jdog')
    for (const ruim of [null, undefined, '', 'ab', 'a'.repeat(16), 'j dog', 'jdog;drop', '@@jdog', 'jdog.x']) assert.equal(parseItemsHandle(ruim as string), null, String(ruim))
  })
  it('a rota por handle não devolve o endereço', () => {
    const src = readFileSync(new URL('../../app/api/dogcity/referral-items/route.ts', import.meta.url), 'utf8')
    const corpo = src.slice(src.indexOf('async function byHandle'), src.indexOf('export async function GET'))
    assert.ok(!/address:/.test(corpo.replace(/select\('address'\)/, '')), 'nenhuma resposta leva address')
    assert.ok(/\{ handle, items/.test(corpo))
  })
})
