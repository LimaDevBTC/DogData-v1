// ═══════════════════════════════════════════════════════════════════════════
// INDICAÇÃO POR EMBAIXADOR (17/11/2026, unificada por @handle em 18/11): as regras PURAS (sem rede, sem banco). Contrato público: /dogcity/docs#referrals.
// Decisão do fundador: o código é o @handle da PESSOA (o lote continua aceito como atalho e credita o dono ATUAL do lote).
// 500 DC por lote indicado a quem indicou; 250 DC ao indicado no primeiro mint; dobro para os dois na mesma quadra; crédito 144 blocos depois do `indexed`; nunca o próprio lote nem a própria carteira; um nível
// só; teto de 5.000 DC por dia por carteira (acima: revisão manual); itens por quantidade de lotes indicados.
// A idempotência e o teto TAMBÉM moram no banco (043); aqui está a conta que o job faz antes e que os testes cobrem.
// ═══════════════════════════════════════════════════════════════════════════

import { parseRef } from '../referral/ref'

export const OWNER_DC = 500
export const GUEST_DC = 250
export const SAME_BLOCK_FACTOR = 2
export const MATURITY_BLOCKS = 144
/** sem a altura do bloco no pedido: só conta depois de 26 horas (144 blocos = 24 h, com folga) */
export const MATURITY_FALLBACK_MS = 26 * 3_600_000
export const DAILY_CEILING_DC = 5000

export const ITEM_TIERS: ReadonlyArray<{ item: 'quad' | 'jet' | 'm4'; lots: number }> = Object.freeze([
  { item: 'quad', lots: 3 },
  { item: 'jet', lots: 10 },
  { item: 'm4', lots: 25 },
])
export type RefItem = 'quad' | 'jet' | 'm4'

/**
 * O @handle do pedido `?handle=` da rota referral-items (27/11/2026): com ou sem o @, qualquer caixa, no formato do handle do DogCity
 * (^[a-z0-9_]{3,15}$, o CHECK da dogcity_profiles). null = pedido inválido (a rota responde 400). A rota por handle NUNCA devolve o
 * endereço da carteira: o jogo só precisa saber se a pessoa tem o item.
 */
export function parseItemsHandle(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const h = raw.trim().replace(/^@/, '').toLowerCase()
  return /^[a-z0-9_]{3,15}$/.test(h) ? h : null
}

export const LOT_ID_RE = /^S[0-9]{2}-Q[0-9]{2}-B[0-9]{3,5}-L[0-9]{3,5}$/

/** a quadra de um lote: o ID sem o "-Lnnn" */
export function blockOf(lotId: string): string {
  return lotId.replace(/-L[0-9]{3,5}$/, '')
}

/** a carteira como o livro guarda: bech32 minúsculo, base58 intacto */
export function normWallet(a: string): string {
  const t = a.trim()
  return t.toLowerCase().startsWith('bc1') ? t.toLowerCase() : t
}

/**
 * um pedido do feed do mint (GET /api/mint/cron/referral-feed). CONTRATO com o mint: os nomes não mudam.
 * Quem indicou vem por `referrer_handle` (o código principal) OU por `referrer_lot` (atalho); se vierem os dois, o handle manda.
 */
export interface FeedItem {
  order_id: string
  lot_id: string
  referrer_lot: string | null
  referrer_handle: string | null
  receive_address: string
  /** quem pagou o pedido (pode ser outra carteira que a de entrega); null = o mint não soube */
  payer_address: string | null
  indexed_at: string | null
  indexed_block: number | null
}

const addrOk = (v: unknown) => typeof v === 'string' && v.length >= 26 && v.length <= 90

export function isFeedItem(v: unknown): v is FeedItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const lotOk = o.referrer_lot === null || o.referrer_lot === undefined || (typeof o.referrer_lot === 'string' && LOT_ID_RE.test(o.referrer_lot))
  const handleOk = o.referrer_handle === null || o.referrer_handle === undefined || (typeof o.referrer_handle === 'string' && parseRef(o.referrer_handle) !== null)
  const hasWho = (typeof o.referrer_lot === 'string') || (typeof o.referrer_handle === 'string')
  return typeof o.order_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(o.order_id)
    && typeof o.lot_id === 'string' && LOT_ID_RE.test(o.lot_id)
    && lotOk && handleOk && hasWho
    && addrOk(o.receive_address)
    && (o.payer_address === null || o.payer_address === undefined || addrOk(o.payer_address))
    && (o.indexed_at === null || (typeof o.indexed_at === 'string' && Number.isFinite(Date.parse(o.indexed_at))))
    && (o.indexed_block === null || (typeof o.indexed_block === 'number' && Number.isSafeInteger(o.indexed_block) && o.indexed_block >= 0))
}

/** o handle de quem indicou, normalizado (minúsculo, sem @), ou null se o pedido indicou por lote */
export function referrerHandleOf(item: Pick<FeedItem, 'referrer_handle'>): string | null {
  return item.referrer_handle ? parseRef(item.referrer_handle) : null
}

/** já passaram 144 blocos do `indexed`? Com altura nos dois lados, pelos blocos; sem a do pedido, pela idade (26 h). */
export function isMature(item: Pick<FeedItem, 'indexed_at' | 'indexed_block'>, height: number | null, nowMs: number): boolean {
  if (item.indexed_block !== null && height !== null) return height - item.indexed_block >= MATURITY_BLOCKS
  if (item.indexed_block !== null) return false
  const at = item.indexed_at ? Date.parse(item.indexed_at) : Number.NaN
  return Number.isFinite(at) && nowMs - at >= MATURITY_FALLBACK_MS
}

export type RejectReason = 'self_lot' | 'self_wallet' | 'unknown_handle'
export type Decision =
  | { kind: 'reject'; reason: RejectReason }
  | { kind: 'wait'; reason: 'not_mature' | 'owner_unknown' }
  | { kind: 'credit'; sameBlock: boolean; ownerWallet: string; guestWallet: string; ownerAmount: number; guestAmount: number }

/**
 * A decisão de UM pedido. `referrer` é o ENDEREÇO de quem indicou: o dono ATUAL do lote (atalho) ou o dono do handle.
 * null = não soube dizer: com handle significa que ele não existe (recusa); com lote, espera.
 * `referrerBlocks` = as quadras das escrituras que o indicador guarda agora (só usado no caminho do handle; vazio = sem dobro).
 * Recusas (próprio lote, própria carteira, handle inexistente) são definitivas e valem antes da maturidade.
 */
export function decide(item: FeedItem, referrer: string | null, height: number | null, nowMs: number, referrerBlocks: ReadonlySet<string> = new Set()): Decision {
  const handle = referrerHandleOf(item)
  const viaLot = handle === null
  if (viaLot && item.lot_id === item.referrer_lot) return { kind: 'reject', reason: 'self_lot' }
  if (!viaLot && referrer === null) return { kind: 'reject', reason: 'unknown_handle' }
  const guest = normWallet(item.receive_address)
  if (referrer !== null) {
    const r = normWallet(referrer)
    if (r === guest || (item.payer_address && normWallet(item.payer_address) === r)) return { kind: 'reject', reason: 'self_wallet' }
  }
  if (!isMature(item, height, nowMs)) return { kind: 'wait', reason: 'not_mature' }
  if (referrer === null) return { kind: 'wait', reason: 'owner_unknown' }
  const block = blockOf(item.lot_id)
  const sameBlock = viaLot ? !!item.referrer_lot && block === blockOf(item.referrer_lot) : referrerBlocks.has(block)
  const k = sameBlock ? SAME_BLOCK_FACTOR : 1
  return { kind: 'credit', sameBlock, ownerWallet: normWallet(referrer), guestWallet: guest, ownerAmount: OWNER_DC * k, guestAmount: GUEST_DC * k }
}

/** o que cabe no teto diário: quanto já entrou hoje e o pedido; false = vai para a fila de revisão */
export function fitsDailyCeiling(alreadyToday: number, amount: number, ceiling = DAILY_CEILING_DC): boolean {
  return alreadyToday + amount <= ceiling
}

/** os itens a que uma contagem de lotes indicados dá direito */
export function itemsFor(lotsReferred: number): RefItem[] {
  return ITEM_TIERS.filter((t) => lotsReferred >= t.lots).map((t) => t.item)
}

/** o ranking semanal: quem teve mais lotes indicados creditados na janela; empate: quem chegou ao número primeiro */
export const WEEKLY_PRIZES: readonly number[] = Object.freeze([5000, 2500, 1000])
export interface RankRow { wallet: string; created_at: string }
export function weeklyRanking(rows: readonly RankRow[]): Array<{ rank: number; wallet: string; lots: number; prizeDc: number }> {
  const by = new Map<string, { n: number; last: number }>()
  for (const r of rows) {
    const t = Date.parse(r.created_at)
    const e = by.get(r.wallet) ?? { n: 0, last: 0 }
    e.n += 1
    e.last = Math.max(e.last, Number.isFinite(t) ? t : 0)
    by.set(r.wallet, e)
  }
  return [...by.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].last - b[1].last || (a[0] < b[0] ? -1 : 1))
    .slice(0, WEEKLY_PRIZES.length)
    .map(([wallet, e], i) => ({ rank: i + 1, wallet, lots: e.n, prizeDc: WEEKLY_PRIZES[i] }))
}
