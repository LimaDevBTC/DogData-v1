import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runReferralJob, type CreditArgs, type CreditStatus, type JobDeps } from './job'
import { parseFeedPage, parseHolders } from './io'
import {
  blockOf, decide, fitsDailyCeiling, isFeedItem, isMature, itemsFor, weeklyRanking, type FeedItem,
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
  order_id: oid(n), lot_id: LOT_B, referrer_lot: LOT_A, receive_address: G1,
  indexed_at: '2026-11-17T10:00:00.000Z', indexed_block: 976_000, ...over,
})

describe('quadra e maturidade', () => {
  it('blockOf tira o -Lnnn', () => {
    expect(blockOf(LOT_A)).toBe('S05-Q07-B0602')
    expect(blockOf(LOT_A)).toBe(blockOf(LOT_A2))
    expect(blockOf(LOT_B)).not.toBe(blockOf(LOT_A))
  })
  it('144 blocos: 143 não, 144 sim; sem altura do pedido, 26 h', () => {
    const it0 = { indexed_at: '2026-11-17T10:00:00Z', indexed_block: 1000 }
    expect(isMature(it0, 1143, NOW)).toBe(false)
    expect(isMature(it0, 1144, NOW)).toBe(true)
    expect(isMature(it0, null, NOW)).toBe(false)
    expect(isMature({ indexed_at: '2026-11-19T09:00:00Z', indexed_block: null }, null, NOW)).toBe(true)
    expect(isMature({ indexed_at: '2026-11-20T00:00:00Z', indexed_block: null }, null, NOW)).toBe(false)
    expect(isMature({ indexed_at: null, indexed_block: null }, 5, NOW)).toBe(false)
  })
})

describe('decide', () => {
  it('500 + 250 normal', () => {
    expect(decide(feed(1), OWNER, 976_144, NOW)).toMatchObject({ kind: 'credit', sameBlock: false, ownerAmount: 500, guestAmount: 250, ownerWallet: OWNER, guestWallet: G1 })
  })
  it('dobro para os dois na mesma quadra', () => {
    expect(decide(feed(1, { lot_id: LOT_A2 }), OWNER, 976_144, NOW)).toMatchObject({ kind: 'credit', sameBlock: true, ownerAmount: 1000, guestAmount: 500 })
  })
  it('nunca o próprio lote', () => {
    expect(decide(feed(1, { lot_id: LOT_A }), OWNER, 976_144, NOW)).toEqual({ kind: 'reject', reason: 'self_lot' })
  })
  it('indicado igual ao dono do lote: recusa, também em maiúsculas e antes da maturidade', () => {
    expect(decide(feed(1, { receive_address: OWNER }), OWNER, 976_144, NOW)).toEqual({ kind: 'reject', reason: 'self_wallet' })
    expect(decide(feed(1, { receive_address: OWNER.toUpperCase() }), OWNER, 100, NOW)).toEqual({ kind: 'reject', reason: 'self_wallet' })
  })
  it('espera: sem maturidade ou sem dono conhecido', () => {
    expect(decide(feed(1), OWNER, 976_143, NOW)).toEqual({ kind: 'wait', reason: 'not_mature' })
    expect(decide(feed(1), null, 976_144, NOW)).toEqual({ kind: 'wait', reason: 'owner_unknown' })
  })
})

describe('teto, itens, ranking, forma', () => {
  it('teto diário de 5.000', () => {
    expect(fitsDailyCeiling(4000, 1000)).toBe(true)
    expect(fitsDailyCeiling(4001, 1000)).toBe(false)
    expect(fitsDailyCeiling(0, 5001)).toBe(false)
  })
  it('itens por quantidade: 3 quad, 10 jet, 25 m4', () => {
    expect(itemsFor(2)).toEqual([])
    expect(itemsFor(3)).toEqual(['quad'])
    expect(itemsFor(10)).toEqual(['quad', 'jet'])
    expect(itemsFor(25)).toEqual(['quad', 'jet', 'm4'])
  })
  it('ranking top 3 com prêmios; empate: quem chegou primeiro', () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => ({ wallet: 'W1', created_at: `2026-11-18T10:0${i}:00Z` })),
      ...Array.from({ length: 3 }, (_, i) => ({ wallet: 'W2', created_at: `2026-11-18T09:0${i}:00Z` })),
      { wallet: 'W3', created_at: '2026-11-18T11:00:00Z' }, { wallet: 'W4', created_at: '2026-11-18T11:01:00Z' },
      { wallet: 'W5', created_at: '2026-11-18T11:02:00Z' },
    ]
    expect(weeklyRanking(rows)).toEqual([
      { rank: 1, wallet: 'W2', lots: 3, prizeDc: 5000 }, { rank: 2, wallet: 'W1', lots: 3, prizeDc: 2500 }, { rank: 3, wallet: 'W3', lots: 1, prizeDc: 1000 },
    ])
  })
  it('o feed hostil: linha malformada cai fora', () => {
    expect(isFeedItem(feed(1))).toBe(true)
    for (const bad of [null, {}, { ...feed(1), lot_id: 'x' }, { ...feed(1), order_id: 'x' }, { ...feed(1), indexed_block: -1 }, { ...feed(1), indexed_block: 1.5 }, { ...feed(1), receive_address: 'x' }]) {
      expect(isFeedItem(bad)).toBe(false)
    }
    expect(parseFeedPage({ items: [feed(1), { lixo: 1 }], next: null }).items).toHaveLength(1)
    expect(() => parseFeedPage({ nope: 1 })).toThrow()
  })
  it('detentores: só lote mintado com holder válido', () => {
    const m = parseHolders({ lots: [
      { lotId: LOT_A, state: 'minted', holder: OWNER }, { lotId: LOT_B, state: 'reserved', holder: OWNER }, { lotId: LOT_A2, state: 'minted', holder: null },
    ] })
    expect(m.get(LOT_A)).toBe(OWNER)
    expect(m.get(LOT_B)).toBeNull()
    expect(m.get(LOT_A2)).toBeNull()
  })
})

// ── um banco de mentira que imita 043 (unicidade por pedido+lado, handle, teto diário, boas-vindas única, itens) ──────────────
function fakeWorld(opts: { handles: Set<string>; owners: Map<string, string | null>; height: number | null; feedItems: FeedItem[]; pageSize?: number }) {
  const rows = new Map<string, { status: string; wallet: string | null; amount: number }>() // `${order}|${side}`
  const ledger: Array<{ ref: string; wallet: string; delta: number }> = []
  const items = new Set<string>()
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
    credit,
    async reject(item, reason) { rows.set(`${item.order_id}|order`, { status: 'rejected:' + reason, wallet: null, amount: 0 }) },
  }
  return { deps, rows, ledger, items }
}
const total = (w: ReturnType<typeof fakeWorld>, wallet: string) => w.ledger.filter((l) => l.wallet === wallet).reduce((s, l) => s + l.delta, 0)

describe('o giro do job', () => {
  const base = () => ({ handles: new Set([OWNER, G1, G2]), owners: new Map([[LOT_A, OWNER]]), height: 976_200 })

  it('credita dono e indicado, e rodar duas vezes não duplica', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1), feed(2, { receive_address: G2 })] })
    const r1 = await runReferralJob(w.deps)
    expect(r1.credited).toEqual({ owner: 2, guest: 2 })
    expect(total(w, OWNER)).toBe(1000)
    expect(total(w, G1)).toBe(250)
    const r2 = await runReferralJob(w.deps)
    expect(r2.credited).toEqual({ owner: 0, guest: 0 })
    expect(r2.skippedDone).toBe(2)
    expect(total(w, OWNER)).toBe(1000)
    expect(w.ledger).toHaveLength(4)
  })
  it('antes de 144 blocos espera e depois credita', async () => {
    const w = fakeWorld({ ...base(), height: 976_100, feedItems: [feed(1)] })
    expect((await runReferralJob(w.deps)).waiting.not_mature).toBe(1)
    expect(w.ledger).toHaveLength(0)
    const w2 = fakeWorld({ ...base(), height: 976_144, feedItems: [feed(1)] })
    expect((await runReferralJob(w2.deps)).credited.owner).toBe(1)
  })
  it('própria carteira e próprio lote: nada é creditado, e o pedido não volta', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1, { receive_address: OWNER }), feed(2, { lot_id: LOT_A })] })
    const r = await runReferralJob(w.deps)
    expect(r.rejected).toBe(2)
    expect(w.ledger).toHaveLength(0)
    expect((await runReferralJob(w.deps)).skippedDone).toBe(2)
  })
  it('dono desconhecido espera; dono sem handle tenta de novo no giro seguinte', async () => {
    const w = fakeWorld({ ...base(), owners: new Map(), feedItems: [feed(1)] })
    expect((await runReferralJob(w.deps)).waiting.owner_unknown).toBe(1)
    const w2 = fakeWorld({ ...base(), handles: new Set([G1]), feedItems: [feed(1)] })
    expect((await runReferralJob(w2.deps)).noHandle).toBe(1)
    expect(w2.ledger.map((l) => l.wallet)).toEqual([G1])
  })
  it('teto de 5.000 por dia: o excesso vai para revisão e não credita', async () => {
    const many = Array.from({ length: 12 }, (_, i) => feed(i + 1, { receive_address: 'bc1p' + String(i).padStart(2, '0').repeat(29) }))
    const handles = new Set([OWNER, ...many.map((m) => m.receive_address)])
    const w = fakeWorld({ ...base(), handles, feedItems: many })
    const r = await runReferralJob(w.deps)
    expect(total(w, OWNER)).toBe(5000)
    expect(r.credited.owner).toBe(10)
    expect(r.review).toBe(2)
    expect([...w.rows.values()].filter((x) => x.status === 'review')).toHaveLength(2)
    await runReferralJob(w.deps)
    expect(total(w, OWNER)).toBe(5000)
  })
  it('itens por quantidade de lotes da carteira dona (3 quad, 10 jet)', async () => {
    const many = Array.from({ length: 10 }, (_, i) => feed(i + 1, { receive_address: 'bc1p' + String(i).padStart(2, '0').repeat(29) }))
    const w = fakeWorld({ ...base(), handles: new Set([OWNER, ...many.map((m) => m.receive_address)]), feedItems: many.slice(0, 2) })
    await runReferralJob(w.deps)
    expect([...w.items]).toEqual([])
    const w2 = fakeWorld({ ...base(), handles: new Set([OWNER, ...many.map((m) => m.receive_address)]), feedItems: many })
    await runReferralJob(w2.deps)
    expect([...w2.items].sort()).toEqual([`${OWNER}|jet`, `${OWNER}|quad`])
  })
  it('boas-vindas é uma por indicado: o segundo pedido dele só paga ao dono', async () => {
    const w = fakeWorld({ ...base(), feedItems: [feed(1), feed(2)] })
    const r = await runReferralJob(w.deps)
    expect(r.credited).toEqual({ owner: 2, guest: 1 })
    expect(total(w, G1)).toBe(250)
  })
  it('boas-vindas pendente do primeiro pedido não vai para o segundo', async () => {
    const w = fakeWorld({ ...base(), handles: new Set([OWNER]), feedItems: [feed(1), feed(2)] })
    const r = await runReferralJob(w.deps)
    expect(r.credited.guest).toBe(0)
    expect(r.noHandle).toBe(1)
  })
  it('páginas do feed são percorridas', async () => {
    const items = Array.from({ length: 5 }, (_, i) => feed(i + 1, { receive_address: 'bc1p' + String(i).padStart(2, '0').repeat(29) }))
    const w = fakeWorld({ ...base(), pageSize: 2, handles: new Set([OWNER, ...items.map((m) => m.receive_address)]), feedItems: items })
    const r = await runReferralJob(w.deps)
    expect(r.pages).toBe(3)
    expect(r.credited.owner).toBe(5)
  })
})

describe('a migração 043', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/043_lot_referrals.sql', import.meta.url), 'utf8')
  it('chave única por pedido e lado, boas-vindas única, só service_role executa', () => {
    expect(sql).toMatch(/primary key \(order_id, side\)/)
    expect(sql).toMatch(/lot_referral_guest_once[^;]*where side = 'guest' and status = 'credited'/)
    expect(sql).toMatch(/grant execute on function public\.lot_referral_credit[^;]*to service_role/)
    expect(sql).toMatch(/revoke all on function public\.lot_referral_credit[^;]*from public, anon, authenticated/)
  })
  it('o livro ganha referral fora do teto de 480 (kind próprio)', () => {
    expect(sql).toMatch(/'referral'/)
    expect(sql).not.toMatch(/kind = 'earn'.*referral/)
  })
})
