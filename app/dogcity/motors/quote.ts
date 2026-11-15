// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS no site: a leitura da vitrine e da garagem (GET /api/dogcity/cars), pura, para o servidor (página) e o
// cliente (cartões) lerem do mesmo jeito e o teste conferir sem rede.
//
// DESDE 15/11/2026 OS CARROS CUSTAM DC POINTS (decisão do fundador, assets_carros/projeto/CARROS_DC_POINTS.md): a vitrine
// lê GET /api/dogcity/car-buy (parseDcShowroom, dcOfferFor). A leitura da cotação em $DOG/BTC (parseShowroom, offerFor)
// fica para quando CAR_SALES_OPEN voltar a ser ligado; a vitrine não a usa.
//
// FALHA FECHADA. O cartão só mostra preço e botão de compra quando a resposta é 200 e o modelo veio inteiro: id do
// catálogo, nome e classe iguais aos do catálogo, preço dentro do piso e do teto, `available` true. Qualquer coisa
// fora da forma = aquele modelo sem preço. 503 `sales_closed` = loja fechada ("Coming soon", sem preço e sem botão).
// Outra falha = "unavailable" (sem preço e sem botão, e a página diz que tenta de novo).
// Os sats são a PRÉVIA (indicativa): o valor que se paga é o do pedido, travado pelo servidor.
// ═══════════════════════════════════════════════════════════════════════════

import { CAR_MODELS, isCarModel, validPriceDc, validPriceDog } from "@/lib/game/cars/catalog"
import { normalizeAddress } from "@/lib/dog/licence-btc"

/** os mesmos tetos do servidor (lib/game/cars/order.ts e lib/dog/licence-btc.ts), repetidos aqui só para recusar */
const MIN_SATS = 1_000
const MAX_SATS = 50_000_000

export interface ModelQuote {
  priceDog: number
  available: boolean
  /** a prévia em sats agora; null = sem cotação confiável (em $DOG ainda se compra) */
  sats: number | null
}

export type ShowroomState =
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "unavailable" }
  | { kind: "open"; models: Readonly<Record<string, ModelQuote>>; lockMinutes: number; asOf: string }

export function parseShowroom(status: number, body: unknown): ShowroomState {
  const b = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  if (status === 503 && b?.error === "sales_closed") return { kind: "closed" }
  if (status !== 200 || !b || !Array.isArray(b.models)) return { kind: "unavailable" }
  const models: Record<string, ModelQuote> = {}
  for (const m of b.models as unknown[]) {
    if (!m || typeof m !== "object") continue
    const r = m as Record<string, unknown>
    if (!isCarModel(r.id) || models[r.id]) continue
    const c = CAR_MODELS[r.id]
    if (r.name !== c.name || r.class !== c.class) continue
    if (!validPriceDog(r.priceDog)) continue
    const sats = typeof r.sats === "number" && Number.isSafeInteger(r.sats) && r.sats >= MIN_SATS && r.sats <= MAX_SATS ? r.sats : null
    models[r.id] = { priceDog: r.priceDog, available: r.available === true, sats: r.available === true ? sats : null }
  }
  const lock = typeof b.lockMinutes === "number" && Number.isFinite(b.lockMinutes) && b.lockMinutes > 0 && b.lockMinutes <= 60 ? b.lockMinutes : 15
  const asOf = typeof b.asOf === "string" && Number.isFinite(Date.parse(b.asOf)) ? b.asOf : ""
  return { kind: "open", models, lockMinutes: lock, asOf }
}

/** o que o cartão de um modelo mostra, pela vitrine */
export type CardOffer =
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "unavailable" }
  | { kind: "not_for_sale" }
  | { kind: "for_sale"; priceDog: number; sats: number | null }

export function offerFor(state: ShowroomState, id: string): CardOffer {
  if (state.kind !== "open") return { kind: state.kind }
  const q = state.models[id]
  if (!q) return { kind: "unavailable" }
  if (!q.available) return { kind: "not_for_sale" }
  return { kind: "for_sale", priceDog: q.priceDog, sats: q.sats }
}

/**
 * A garagem de uma carteira (GET /api/dogcity/cars?address=). Devolve os modelos que ela tem, ou null quando a
 * resposta não serve (503, outro endereço, forma torta): null = não afirmar nada (nem "Owned", nem "não tem").
 */
export function parseGarage(status: number, body: unknown, address: string): ReadonlySet<string> | null {
  if (status !== 200 || !body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  const want = normalizeAddress(address)
  if (!want || normalizeAddress(b.address) !== want || !Array.isArray(b.cars)) return null
  const out = new Set<string>()
  for (const c of b.cars as unknown[]) {
    const m = c && typeof c === "object" ? (c as Record<string, unknown>).model : null
    if (isCarModel(m)) out.add(m)
  }
  return out
}

/** "500,000" */
export const fmtDog = (n: number) => n.toLocaleString("en-US")
/** sats em BTC com 8 casas, sem ponto flutuante na conta ("0.01234567") */
export function satsToBtc(sats: number): string {
  if (!Number.isSafeInteger(sats) || sats < 0) return ""
  const s = String(sats).padStart(9, "0")
  return `${s.slice(0, -8)}.${s.slice(-8)}`
}

// ── DC POINTS (GET /api/dogcity/car-buy) ──────────────────────────────────────────────────────────────────────

export interface DcQuote {
  priceDc: number
  available: boolean
}

export type DcShowroomState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "open"; models: Readonly<Record<string, DcQuote>> }

/**
 * A vitrine em DC Points. FALHA FECHADA: só 200 com `currency: "dc_points"`; cada modelo só vale com id, nome e classe do
 * catálogo e o MESMO preço em DC do catálogo (preço diferente = sem preço e sem botão). Qualquer outra coisa: "unavailable".
 */
export function parseDcShowroom(status: number, body: unknown): DcShowroomState {
  const b = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  if (status !== 200 || !b || b.currency !== "dc_points" || !Array.isArray(b.models)) return { kind: "unavailable" }
  const models: Record<string, DcQuote> = {}
  for (const m of b.models as unknown[]) {
    if (!m || typeof m !== "object") continue
    const r = m as Record<string, unknown>
    if (!isCarModel(r.id) || models[r.id]) continue
    const c = CAR_MODELS[r.id]
    if (r.name !== c.name || r.class !== c.class) continue
    if (!validPriceDc(r.priceDc) || r.priceDc !== c.priceDc) continue
    models[r.id] = { priceDc: r.priceDc, available: r.available === true }
  }
  return { kind: "open", models }
}

/** o que o cartão de um modelo mostra, pela vitrine em DC Points */
export type DcOffer =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "not_for_sale" }
  | { kind: "for_sale"; priceDc: number }

export function dcOfferFor(state: DcShowroomState, id: string): DcOffer {
  if (state.kind !== "open") return { kind: state.kind }
  const q = state.models[id]
  if (!q) return { kind: "unavailable" }
  if (!q.available) return { kind: "not_for_sale" }
  return { kind: "for_sale", priceDc: q.priceDc }
}

/** o saldo de DC Points da sessão (GET /api/game/points); null = não afirmar nada (sem sessão, falha, forma torta) */
export interface PointsView {
  balance: number
  canEarn: boolean
}

export function parsePoints(status: number, body: unknown): PointsView | null {
  if (status !== 200 || !body || typeof body !== "object" || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  const bal = b.balance
  if (typeof bal !== "number" || !Number.isSafeInteger(bal) || bal < 0 || bal > 1_000_000) return null
  if (typeof b.canEarn !== "boolean") return null
  return { balance: bal, canEarn: b.canEarn }
}

/** "12,500" */
export const fmtPoints = (n: number) => n.toLocaleString("en-US")
