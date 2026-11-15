// ═══════════════════════════════════════════════════════════════════════════
// DC POINTS NO BANCO (migração 042): os fios entre as rotas e as funções atômicas dc_points_*. Só fios: a trava, o teto
// diário, a idempotência e o saldo moram nas funções do banco. Toda resposta é lida com desconfiança: forma inesperada
// LANÇA (a rota responde 503), nunca vira "saldo 0" ou "comprou" por engano.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PointsState {
  balance: number
  earnedToday: number
  day: string
  migrated: boolean
  migratedAmount: number
  hasHandle: boolean
}

export type MigrateAnswer = { status: 'migrated' | 'already' | 'no_handle'; amount: number; balance: number }

export type EarnAnswer =
  | { status: 'ok' | 'duplicate'; requested: number; credited: number; balance: number; earnedToday: number; day: string }
  | { status: 'no_handle' }
  | { status: 'ref_conflict' }

export type SpendAnswer =
  | { status: 'ok' | 'duplicate'; item: string; qty: number; unitPrice: number; debited: number; balance: number }
  | { status: 'insufficient'; balance: number; needed: number }
  | { status: 'price_changed'; unitPrice: number; total: number; balance: number }
  | { status: 'ref_conflict' }

export type BuyCarAnswer =
  | { status: 'ok' | 'duplicate'; model: string; price: number; balance: number; ownershipRef: string }
  | { status: 'insufficient'; model: string; price: number; balance: number }
  | { status: 'already_owned'; model: string }
  | { status: 'unknown_model' | 'not_for_sale' | 'price_mismatch'; model: string }
  | { status: 'ref_conflict' }

/** o que as rotas precisam do banco (a 042 implementa; o teste usa store-memory.ts, que imita a 042) */
export interface PointsStore {
  state(wallet: string): Promise<PointsState>
  migrate(wallet: string): Promise<MigrateAnswer>
  earn(wallet: string, source: string, amount: number, ref: string, maxPerOp: number, allOrNothing: boolean): Promise<EarnAnswer>
  spend(wallet: string, item: string, qty: number, unitPrice: number, ref: string, maxTotal: number | null): Promise<SpendAnswer>
  buyCar(wallet: string, model: string, expectedPrice: number, ref: string): Promise<BuyCarAnswer>
}

/** a linha de um modelo em car_models, para a vitrine em DC Points */
export interface CarDcRow { id: string; name: string; priceDc: number | null; active: boolean }

const bad = (fn: string): never => { throw new Error(`${fn}: unexpected answer`) }

/** inteiro seguro vindo do banco (número ou texto de dígitos); qualquer outra coisa: null */
export function dbInt(v: unknown): number | null {
  const n = typeof v === 'string' && /^-?[0-9]{1,16}$/.test(v) ? Number(v) : v
  return typeof n === 'number' && Number.isSafeInteger(n) ? n : null
}

const DAY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

function obj(v: unknown, fn: string): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : bad(fn)
}

function int(o: Record<string, unknown>, k: string, fn: string, lo = 0, hi = 1_000_000): number {
  const n = dbInt(o[k])
  return n !== null && n >= lo && n <= hi ? n : bad(fn)
}

function day(o: Record<string, unknown>, k: string, fn: string): string {
  const d = o[k]
  return typeof d === 'string' && DAY_RE.test(d) ? d : bad(fn)
}

export function parseState(v: unknown): PointsState {
  const fn = 'dc_points_state'
  const o = obj(v, fn)
  if (typeof o.migrated !== 'boolean' || typeof o.has_handle !== 'boolean') bad(fn)
  return {
    balance: int(o, 'balance', fn),
    earnedToday: int(o, 'earned_today', fn),
    day: day(o, 'day', fn),
    migrated: o.migrated as boolean,
    migratedAmount: int(o, 'migrated_amount', fn),
    hasHandle: o.has_handle as boolean,
  }
}

export function parseMigrate(v: unknown): MigrateAnswer {
  const fn = 'dc_points_migrate'
  const o = obj(v, fn)
  if (o.status !== 'migrated' && o.status !== 'already' && o.status !== 'no_handle') bad(fn)
  return { status: o.status as MigrateAnswer['status'], amount: int(o, 'amount', fn), balance: int(o, 'balance', fn) }
}

export function parseEarnAnswer(v: unknown): EarnAnswer {
  const fn = 'dc_points_earn'
  const o = obj(v, fn)
  if (o.status === 'no_handle' || o.status === 'ref_conflict') return { status: o.status }
  if (o.status !== 'ok' && o.status !== 'duplicate') bad(fn)
  const requested = int(o, 'requested', fn, 1, 10_000)
  const credited = int(o, 'credited', fn, 0, requested)
  return {
    status: o.status as 'ok' | 'duplicate', requested, credited,
    balance: int(o, 'balance', fn), earnedToday: int(o, 'earned_today', fn), day: day(o, 'day', fn),
  }
}

export function parseSpendAnswer(v: unknown): SpendAnswer {
  const fn = 'dc_points_spend'
  const o = obj(v, fn)
  if (o.status === 'ref_conflict') return { status: 'ref_conflict' }
  if (o.status === 'insufficient') return { status: 'insufficient', balance: int(o, 'balance', fn), needed: int(o, 'needed', fn, 1, 10_000) }
  if (o.status === 'price_changed') {
    return { status: 'price_changed', unitPrice: int(o, 'unit_price', fn, 1, 10_000), total: int(o, 'total', fn, 1, 10_000), balance: int(o, 'balance', fn) }
  }
  if (o.status !== 'ok' && o.status !== 'duplicate') bad(fn)
  if (typeof o.item !== 'string') bad(fn)
  return {
    status: o.status as 'ok' | 'duplicate', item: o.item as string, qty: int(o, 'qty', fn, 1, 100),
    unitPrice: int(o, 'unit_price', fn, 1, 10_000), debited: int(o, 'debited', fn, 1, 10_000), balance: int(o, 'balance', fn),
  }
}

export function parseBuyCarAnswer(v: unknown): BuyCarAnswer {
  const fn = 'dc_points_buy_car'
  const o = obj(v, fn)
  if (o.status === 'ref_conflict') return { status: 'ref_conflict' }
  const model = typeof o.model === 'string' && /^c[0-9]{2}$/.test(o.model) ? o.model : bad(fn)
  switch (o.status) {
    case 'ok':
    case 'duplicate': {
      const ref = typeof o.ownership_ref === 'string' && /^dc:[0-9]{1,18}$/.test(o.ownership_ref) ? o.ownership_ref : bad(fn)
      return { status: o.status, model, price: int(o, 'price', fn, 1, 250_000), balance: int(o, 'balance', fn), ownershipRef: ref }
    }
    case 'insufficient':
      return { status: 'insufficient', model, price: int(o, 'price', fn, 1, 250_000), balance: int(o, 'balance', fn) }
    case 'already_owned':
      return { status: 'already_owned', model }
    case 'unknown_model':
    case 'not_for_sale':
    case 'price_mismatch':
      return { status: o.status, model }
    default:
      return bad(fn)
  }
}

export function pointsStore(db: SupabaseClient, signal?: AbortSignal): PointsStore {
  const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    let q = db.rpc(fn, args)
    if (signal) q = q.abortSignal(signal)
    const { data, error } = await q
    if (error) throw new Error(`${fn}: ${error.message || 'database error'}`)
    return data
  }
  return {
    async state(wallet) {
      return parseState(await rpc('dc_points_state', { p_wallet: wallet }))
    },
    async migrate(wallet) {
      return parseMigrate(await rpc('dc_points_migrate', { p_wallet: wallet }))
    },
    async earn(wallet, source, amount, ref, maxPerOp, allOrNothing) {
      return parseEarnAnswer(await rpc('dc_points_earn', {
        p_wallet: wallet, p_source: source, p_amount: amount, p_ref: ref, p_max_per_op: maxPerOp, p_all_or_nothing: allOrNothing,
      }))
    },
    async spend(wallet, item, qty, unitPrice, ref, maxTotal) {
      return parseSpendAnswer(await rpc('dc_points_spend', {
        p_wallet: wallet, p_item: item, p_qty: qty, p_unit_price: unitPrice, p_ref: ref, p_max_total: maxTotal,
      }))
    },
    async buyCar(wallet, model, expectedPrice, ref) {
      return parseBuyCarAnswer(await rpc('dc_points_buy_car', {
        p_wallet: wallet, p_model: model, p_expected_price: expectedPrice, p_ref: ref,
      }))
    },
  }
}

/** os modelos com o preço em DC Points do banco (a vitrine e a GET de /api/dogcity/car-buy) */
export async function carDcRows(db: SupabaseClient, signal?: AbortSignal): Promise<CarDcRow[]> {
  let q = db.from('car_models').select('id, name, price_dc, active')
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) throw new Error(`car_models: ${error.message || 'database error'}`)
  if (!Array.isArray(data)) throw new Error('car_models: unexpected answer')
  return data.flatMap((r: any) => (typeof r?.id === 'string' && typeof r?.name === 'string'
    ? [{ id: r.id, name: r.name, priceDc: r.price_dc == null ? null : dbInt(r.price_dc), active: r.active === true }]
    : []))
}
