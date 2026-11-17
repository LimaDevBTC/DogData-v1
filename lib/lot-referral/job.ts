// O giro do job de crédito da indicação (a rota é app/api/cron/lot-referrals): lê o feed do mint, decide com as regras puras
// (rules.ts) e credita pelas funções do banco (043). Tudo de fora entra por `JobDeps`, para o teste rodar sem rede nem banco.
// Idempotente: o banco recusa o segundo crédito do mesmo (pedido, lado); o job ainda pula o que já está gravado.
import { decide, normWallet, type Decision, type FeedItem } from './rules'

export type Side = 'owner' | 'guest'
export type CreditStatus = 'ok' | 'duplicate' | 'no_handle' | 'review' | 'guest_taken'

export interface CreditArgs {
  orderId: string
  side: Side
  wallet: string
  amount: number
  lot: string
  referrerLot: string
  guestWallet: string
  sameBlock: boolean
  indexedBlock: number | null
  indexedAt: string | null
}

export interface JobDeps {
  now(): number
  /** a altura atual da cadeia segundo o mint; null = não soube */
  height(): Promise<number | null>
  /** uma página do feed (lança se o mint falha); `next` null = fim */
  feedPage(after: string | null): Promise<{ items: FeedItem[]; next: string | null }>
  /** do que já está gravado: por pedido, os lados resolvidos ('owner', 'guest', 'order') */
  resolved(orderIds: string[]): Promise<Map<string, Set<string>>>
  /** o dono ATUAL de cada lote (null = o mint não soube) */
  holders(lots: string[]): Promise<Map<string, string | null>>
  credit(a: CreditArgs): Promise<CreditStatus>
  reject(item: FeedItem, reason: string): Promise<void>
}

export interface JobLimits { maxPages: number; maxCalls: number; deadlineMs: number }
export const DEFAULT_LIMITS: JobLimits = { maxPages: 20, maxCalls: 400, deadlineMs: 45_000 }

export interface JobReport {
  pages: number
  seen: number
  skippedDone: number
  rejected: number
  waiting: { not_mature: number; owner_unknown: number }
  credited: { owner: number; guest: number }
  duplicate: number
  noHandle: number
  review: number
  guestTaken: number
  stoppedEarly: boolean
}

export async function runReferralJob(d: JobDeps, limits: JobLimits = DEFAULT_LIMITS): Promise<JobReport> {
  const started = d.now()
  const rep: JobReport = {
    pages: 0, seen: 0, skippedDone: 0, rejected: 0, waiting: { not_mature: 0, owner_unknown: 0 },
    credited: { owner: 0, guest: 0 }, duplicate: 0, noHandle: 0, review: 0, guestTaken: 0, stoppedEarly: false,
  }
  const height = await d.height().catch(() => null)
  // carteiras cuja boas-vindas já está em jogo neste giro (paga, esperando ou sem handle): um pedido MAIS NOVO delas nunca a toma
  const guestBusy = new Set<string>()
  let calls = 0
  let after: string | null = null
  for (;;) {
    if (rep.pages >= limits.maxPages || d.now() - started > limits.deadlineMs) { rep.stoppedEarly = true; break }
    const page = await d.feedPage(after)
    rep.pages += 1
    const items = page.items
    const done = await d.resolved(items.map((i) => i.order_id))
    const lots = [...new Set(items.filter((i) => i.lot_id !== i.referrer_lot).map((i) => i.referrer_lot))]
    const owners = lots.length ? await d.holders(lots) : new Map<string, string | null>()
    for (const item of items) {
      rep.seen += 1
      const got = done.get(item.order_id) ?? new Set<string>()
      if (got.has('order') || (got.has('owner') && got.has('guest'))) {
        rep.skippedDone += 1
        guestBusy.add(normWallet(item.receive_address))
        continue
      }
      const dec: Decision = decide(item, owners.get(item.referrer_lot) ?? null, height, d.now())
      if (dec.kind === 'reject') {
        await d.reject(item, dec.reason)
        rep.rejected += 1
        continue
      }
      if (dec.kind === 'wait') {
        rep.waiting[dec.reason] += 1
        guestBusy.add(normWallet(item.receive_address))
        continue
      }
      const base = { orderId: item.order_id, lot: item.lot_id, referrerLot: item.referrer_lot, guestWallet: dec.guestWallet, sameBlock: dec.sameBlock, indexedBlock: item.indexed_block, indexedAt: item.indexed_at }
      const sides: Array<[Side, string, number]> = []
      if (!got.has('owner')) sides.push(['owner', dec.ownerWallet, dec.ownerAmount])
      if (!got.has('guest') && !guestBusy.has(dec.guestWallet)) sides.push(['guest', dec.guestWallet, dec.guestAmount])
      for (const [side, wallet, amount] of sides) {
        if (calls >= limits.maxCalls) { rep.stoppedEarly = true; return rep }
        calls += 1
        const st = await d.credit({ ...base, side, wallet, amount })
        if (side === 'guest') guestBusy.add(wallet)
        if (st === 'ok') rep.credited[side] += 1
        else if (st === 'duplicate') rep.duplicate += 1
        else if (st === 'no_handle') rep.noHandle += 1
        else if (st === 'review') rep.review += 1
        else rep.guestTaken += 1
      }
    }
    if (!page.next) break
    after = page.next
  }
  return rep
}
