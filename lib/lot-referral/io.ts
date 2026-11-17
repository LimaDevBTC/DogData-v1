// Os fios do job de indicação com o mundo: o feed e os detentores do mint (HTTP) e as funções do banco (043). Só fios; as regras
// moram em rules.ts e o giro em job.ts. Lê com desconfiança: forma inesperada LANÇA (o giro termina, o próximo tenta de novo).
import type { SupabaseClient } from '@supabase/supabase-js'
import { MINT_ORIGIN } from '../dog/licence-lot-supabase'
import type { CreditArgs, CreditStatus, JobDeps } from './job'
import { isFeedItem, normWallet, type FeedItem } from './rules'

const FEED_LIMIT = 200
const HTTP_MS = 8_000

async function mintJson(path: string, headers: Record<string, string> = {}): Promise<unknown> {
  const r = await fetch(`${MINT_ORIGIN}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(HTTP_MS), headers: { accept: 'application/json', ...headers } })
  if (!r.ok) throw new Error(`mint ${path.split('?')[0]}: HTTP ${r.status}`)
  return r.json()
}

export function parseFeedPage(v: unknown): { items: FeedItem[]; next: string | null } {
  const o = v as { items?: unknown; next?: unknown } | null
  if (!o || !Array.isArray(o.items) || (o.next !== null && typeof o.next !== 'string')) throw new Error('referral-feed: unexpected answer')
  // linha malformada é DESCARTADA (nunca credita); o resto da página segue
  return { items: o.items.filter(isFeedItem), next: o.next as string | null }
}

export function parseHolders(v: unknown): Map<string, string | null> {
  const o = v as { lots?: unknown } | null
  if (!o || !Array.isArray(o.lots)) throw new Error('lots: unexpected answer')
  const out = new Map<string, string | null>()
  for (const l of o.lots as Array<Record<string, unknown>>) {
    if (typeof l?.lotId !== 'string') continue
    // só vale o lote MINTADO com detentor conhecido; qualquer dúvida = null (o job espera)
    out.set(l.lotId, l.state === 'minted' && typeof l.holder === 'string' && l.holder.length >= 26 ? normWallet(l.holder) : null)
  }
  return out
}

export function referralDeps(db: SupabaseClient, env: Record<string, string | undefined> = process.env): JobDeps {
  const secret = env.MINT_CRON_SECRET?.trim()
  return {
    now: () => Date.now(),
    async height() {
      const s = (await mintJson('/api/mint/status')) as { height?: unknown }
      return typeof s?.height === 'number' && Number.isSafeInteger(s.height) ? s.height : null
    },
    async feedPage(after) {
      if (!secret) throw new Error('MINT_CRON_SECRET not set')
      const qs = `limit=${FEED_LIMIT}${after ? `&after=${encodeURIComponent(after)}` : ''}`
      return parseFeedPage(await mintJson(`/api/mint/cron/referral-feed?${qs}`, { authorization: `Bearer ${secret}` }))
    },
    async resolved(orderIds) {
      const out = new Map<string, Set<string>>()
      if (orderIds.length === 0) return out
      const { data, error } = await db.from('lot_referral_rewards').select('order_id, side').in('order_id', orderIds)
      if (error) throw new Error(`lot_referral_rewards: ${error.message}`)
      for (const r of (data ?? []) as Array<{ order_id: string; side: string }>) {
        const s = out.get(r.order_id) ?? new Set<string>()
        s.add(r.side)
        out.set(r.order_id, s)
      }
      return out
    },
    async holders(lots) {
      const out = new Map<string, string | null>()
      for (let i = 0; i < lots.length; i += 200) {
        const part = lots.slice(i, i + 200)
        for (const [k, v] of parseHolders(await mintJson(`/api/mint/lots?ids=${part.join(',')}`))) out.set(k, v)
      }
      return out
    },
    async credit(a: CreditArgs): Promise<CreditStatus> {
      const { data, error } = await db.rpc('lot_referral_credit', {
        p_order: a.orderId, p_side: a.side, p_wallet: a.wallet, p_amount: a.amount, p_lot: a.lot, p_referrer_lot: a.referrerLot,
        p_guest_wallet: a.guestWallet, p_same_block: a.sameBlock, p_indexed_block: a.indexedBlock, p_indexed_at: a.indexedAt,
      })
      if (error) throw new Error(`lot_referral_credit: ${error.message}`)
      const st = (data as { status?: unknown } | null)?.status
      if (st === 'ok' || st === 'duplicate' || st === 'no_handle' || st === 'review' || st === 'guest_taken') return st
      throw new Error('lot_referral_credit: unexpected answer')
    },
    async reject(item, reason) {
      const { error } = await db.rpc('lot_referral_reject', {
        p_order: item.order_id, p_lot: item.lot_id, p_referrer_lot: item.referrer_lot, p_guest_wallet: normWallet(item.receive_address),
        p_reason: reason, p_indexed_block: item.indexed_block, p_indexed_at: item.indexed_at,
      })
      if (error) throw new Error(`lot_referral_reject: ${error.message}`)
    },
  }
}
