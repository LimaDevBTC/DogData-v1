// ═══════════════════════════════════════════════════════════════════════════
// DC POINTS NO SERVIDOR: o que cada rota responde, sem Next e sem rede (as rotas em app/api só põem a sessão, o freio e
// o corpo lido). A carteira que chega aqui JÁ É a da sessão verificada, normalizada (bech32 minúsculo, base58 intacto):
// nenhum endereço do corpo é lido. O contrato exato (campos e erros) está no cabeçalho de cada função e em
// assets_carros/projeto/CARROS_DC_POINTS_CONTRATO.md.
// ═══════════════════════════════════════════════════════════════════════════
import { CAR_MODELS, catalogIsSane } from '@/lib/game/cars/catalog'
import {
  CHECKIN_MAX_PER_OP, CHECKIN_SOURCE, DAILY_CAP, EARN_SOURCES, carPriceDc, parseCarBuy, parseEarn, parseSpend, quoteSpend,
  sourceCaps,
} from './rules'
import type { PointsStore } from './store'

export interface Reply { status: number; body: Record<string, unknown> }

const reply = (status: number, body: Record<string, unknown>): Reply => ({ status, body })
const remaining = (earned: number) => Math.max(0, DAILY_CAP - earned)

/**
 * GET /api/game/points -> 200 { balance, earnedToday, dailyCap, remainingToday, canEarn, migrated, migratedAmount, day, sources }
 * Na primeira leitura de uma carteira COM handle, a migração única do save (o valor da foto da 042, fora do teto diário).
 */
export async function readPoints(store: PointsStore, wallet: string): Promise<Reply> {
  let st = await store.state(wallet)
  if (st.hasHandle && !st.migrated) {
    await store.migrate(wallet)
    st = await store.state(wallet)
  }
  return reply(200, {
    balance: st.balance,
    earnedToday: st.earnedToday,
    dailyCap: DAILY_CAP,
    remainingToday: remaining(st.earnedToday),
    canEarn: st.hasHandle,
    migrated: st.migrated,
    migratedAmount: st.migratedAmount,
    day: st.day,
    sources: sourceCaps(),
  })
}

/**
 * POST /api/game/points/earn { source, amount, ref, allOrNothing? }
 * 200 { ok, source, requested, credited, capped, duplicate, balance, earnedToday, remainingToday, dailyCap }
 * 400 invalid_body | invalid_source | invalid_amount | invalid_ref; 403 no_handle; 409 ref_conflict
 */
export async function earnPoints(store: PointsStore, wallet: string, body: unknown): Promise<Reply> {
  const p = parseEarn(body)
  if (!p.ok) return reply(400, { error: p.error })
  const r = await store.earn(wallet, p.source, p.amount, p.ref, EARN_SOURCES[p.source].maxPerOp, p.allOrNothing)
  if (r.status === 'no_handle') return reply(403, { error: 'no_handle' })
  if (r.status === 'ref_conflict') return reply(409, { error: 'ref_conflict' })
  return reply(200, {
    ok: true,
    source: p.source,
    requested: r.requested,
    credited: r.credited,
    capped: r.credited < r.requested,
    duplicate: r.status === 'duplicate',
    balance: r.balance,
    earnedToday: r.earnedToday,
    remainingToday: remaining(r.earnedToday),
    dailyCap: DAILY_CAP,
  })
}

/**
 * POST /api/game/points/spend { item, qty, ref, maxTotal? } (o mercado do jogo). O preço é do SERVIDOR: o preço do dia do
 * jogo (cópia de precoDoDia) pelo dia `day` (o dia do jogo de agora, 08:00 UTC); campo de preço no corpo é ignorado.
 * 200 { ok, item, qty, unitPrice, debited, balance, day, duplicate }
 * 400 invalid_body | invalid_item | invalid_qty | invalid_ref | invalid_max_total; 402 insufficient_points { balance, needed };
 * 409 price_changed { unitPrice, total } | ref_conflict
 */
export async function spendPoints(store: PointsStore, wallet: string, body: unknown, day: string): Promise<Reply> {
  const p = parseSpend(body)
  if (!p.ok) return reply(400, { error: p.error })
  const q = quoteSpend(p.item, p.qty, day)
  // sem preço ou total acima do teto por operação: quantidade demais (o item é válido, já conferido)
  if (!q) return reply(400, { error: 'invalid_qty' })
  const r = await store.spend(wallet, p.item, p.qty, q.unitPrice, p.ref, p.maxTotal)
  switch (r.status) {
    case 'ok':
    case 'duplicate':
      return reply(200, {
        ok: true, item: r.item, qty: r.qty, unitPrice: r.unitPrice, debited: r.debited, balance: r.balance, day,
        duplicate: r.status === 'duplicate',
      })
    case 'insufficient':
      return reply(402, { error: 'insufficient_points', balance: r.balance, needed: r.needed })
    case 'price_changed':
      return reply(409, { error: 'price_changed', unitPrice: r.unitPrice, total: r.total })
    default:
      return reply(409, { error: 'ref_conflict' })
  }
}

/**
 * POST /api/dogcity/car-buy { model, ref }. O preço é o do código (catálogo) E o do banco (car_models.price_dc), conferidos
 * juntos na função do banco; campo de preço no corpo é ignorado.
 * 200 { ok, model, name, priceDc, balance, duplicate }
 * 400 invalid_body | invalid_model | invalid_ref; 402 insufficient_points { balance, priceDc, missing };
 * 409 already_owned | model_not_for_sale | ref_conflict; 503 catalog_mismatch
 */
export async function buyCarWithPoints(store: PointsStore, wallet: string, body: unknown): Promise<Reply> {
  const p = parseCarBuy(body)
  if (!p.ok) return reply(400, { error: p.error })
  const price = carPriceDc(p.model)
  if (price === null || !catalogIsSane()) return reply(503, { error: 'catalog_mismatch' })
  const r = await store.buyCar(wallet, p.model, price, p.ref)
  switch (r.status) {
    case 'ok':
    case 'duplicate':
      return reply(200, {
        ok: true, model: r.model, name: CAR_MODELS[r.model].name, priceDc: r.price, balance: r.balance,
        duplicate: r.status === 'duplicate',
      })
    case 'insufficient':
      return reply(402, { error: 'insufficient_points', balance: r.balance, priceDc: r.price, missing: r.price - r.balance })
    case 'already_owned':
      return reply(409, { error: 'already_owned' })
    case 'not_for_sale':
      return reply(409, { error: 'model_not_for_sale' })
    case 'unknown_model':
    case 'price_mismatch':
      // o modelo do código não está no banco, ou o preço do banco é outro: a venda fecha sozinha até alguém corrigir
      return reply(503, { error: 'catalog_mismatch' })
    default:
      return reply(409, { error: 'ref_conflict' })
  }
}

export type CheckinPointsStatus = 'credited' | 'duplicate' | 'capped' | 'no_handle' | 'unavailable'
export interface CheckinPoints { status: CheckinPointsStatus; credited: number; balance: number | null }

/**
 * O check-in do dia credita no livro (fonte `checkin`, referência `checkin:<dia>`: idempotente por dia; repetir o POST depois
 * de uma falha do banco credita). `amount` é a recompensa do dia (10, +50 no marco de 7). Nunca lança: o livro fora não
 * derruba o check-in (status 'unavailable').
 */
export async function creditCheckin(store: PointsStore, wallet: string, day: string, amount: number): Promise<CheckinPoints> {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > CHECKIN_MAX_PER_OP || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)) {
    return { status: 'unavailable', credited: 0, balance: null }
  }
  try {
    const r = await store.earn(wallet, CHECKIN_SOURCE, amount, `checkin:${day}`, CHECKIN_MAX_PER_OP, false)
    if (r.status === 'no_handle') return { status: 'no_handle', credited: 0, balance: null }
    if (r.status === 'ref_conflict') return { status: 'duplicate', credited: 0, balance: null }
    if (r.status === 'duplicate') return { status: 'duplicate', credited: r.credited, balance: r.balance }
    return { status: r.credited > 0 ? 'credited' : 'capped', credited: r.credited, balance: r.balance }
  } catch (e) {
    console.error('[checkin points]', (e as Error)?.message)
    return { status: 'unavailable', credited: 0, balance: null }
  }
}

/** a vitrine pública em DC Points: o preço do código, à venda só quando o banco concorda e o modelo está ativo */
export function carDcShowroom(rows: ReadonlyArray<{ id: string; priceDc: number | null; active: boolean }>): Record<string, unknown> {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const sane = catalogIsSane()
  return {
    currency: 'dc_points',
    models: Object.values(CAR_MODELS).map((m) => {
      const r = byId.get(m.id)
      return {
        id: m.id, name: m.name, class: m.class, priceDc: m.priceDc,
        available: sane && !!r && r.active && r.priceDc === m.priceDc,
      }
    }),
  }
}
