// ═══════════════════════════════════════════════════════════════════════════
// DC POINTS NO SERVIDOR: as regras das rotas (sem rede, sem banco). Decisões do fundador de 15/11/2026:
// assets_carros/projeto/CARROS_DC_POINTS.md. Contrato das rotas: CARROS_DC_POINTS_CONTRATO.md (mesma pasta) e o PR.
//
// DC Points são PONTOS, não moeda: não se compram, não se transferem, nunca viram $DOG. As contas puras do jogo
// (regras_saldo, regras_preco, ajustes_economia, catálogo de itens) estão copiadas ao lado com teste de igualdade; aqui
// fica o que é só do servidor:
//   * a lista FECHADA de fontes de ganho e o teto por operação de cada uma (tirada do README da economia);
//   * a leitura HOSTIL do corpo de cada rota (tipo, inteiro, faixa, tamanho; NaN, Infinity, fração, negativo, string,
//     `__proto__` e afins nunca passam);
//   * o preço do mercado do jogo, calculado AQUI pelo dia do jogo (o cliente nunca manda preço);
//   * o espelho, para teste, do que a migração única do save faz no banco (validarSecao do jogo + o teto de 480 x dias).
// A autoridade de saldo, teto diário, idempotência e trava é o BANCO (supabase/migrations/042_dc_points.sql).
// ═══════════════════════════════════════════════════════════════════════════
import { CAR_MODELS, isCarModel } from '@/lib/game/cars/catalog'
import { DAILY_REWARD, MILESTONE_BONUS } from '@/lib/game/checkin'
import { ECONOMIA } from './ajustes_economia'
import { ITENS_PRECO } from './catalogo_itens'
import { precoDoDia } from './regras_preco'
import { saldoValido, totalDe } from './regras_saldo'

/** teto de DC Points GANHOS por carteira por dia do jogo, todas as fontes somadas (480) */
export const DAILY_CAP = ECONOMIA.tetoDiarioRecebido
/** teto absoluto de um ganho ou de um gasto no mercado (10.000); o carro tem o próprio (MAX_CAR_PRICE_DC) */
export const MAX_PER_OP = ECONOMIA.valorMaximoPorOperacao
/** teto absoluto do saldo (1.000.000) */
export const MAX_BALANCE = ECONOMIA.saldoMaximo
/** o primeiro dia de jogo que a migração do save conta (inclusive) */
export const MIGRATION_START_DAY = '2026-10-29'
/** quantidade máxima de um item numa compra do mercado */
export const MAX_SPEND_QTY = 100
/** teto do corpo das rotas de escrita */
export const BODY_MAX_BYTES = 1024
/** a referência que o cliente gera (crypto.randomUUID() serve) */
export const REF_RE = /^[A-Za-z0-9_-]{8,64}$/
/** o check-in diário credita com esta fonte, pelo próprio check-in (nunca pela rota earn) */
export const CHECKIN_SOURCE = 'checkin'
/** o maior check-in de um dia: 10 + o maior bônus de marco (50) */
export const CHECKIN_MAX_PER_OP = DAILY_REWARD.points + Math.max(0, ...Object.values(MILESTONE_BONUS))
/** a recompensa única dos primeiros passos (dogcity-mundo src/tutorial/regras.ts, RECOMPENSA_PONTOS) */
export const TUTORIAL_REWARD = 25

export interface EarnSource {
  /** o maior valor aceito numa operação desta fonte */
  maxPerOp: number
  /** fonte de valor fixo: o pedido tem de ser exatamente isto */
  fixed?: number
  /** paga UMA vez por carteira (o servidor usa a referência fixa `once:<fonte>`; a do cliente é ignorada) */
  once?: boolean
}

/**
 * A lista FECHADA de fontes de ganho (dogcity-mundo src/economia/README.md, "Fontes e sumidouros" e "DC Points por hora").
 * Venda de produção ao mercado (peixe, madeira, minério, caça, cavalo, o mercado central): uma operação nunca paga mais
 * que um dia inteiro (o teto diário). Turno da fazenda: 50 por hora, até 2 horas. Missão sem drop: até 100. Tutorial e
 * Verified: o valor fixo do jogo, uma vez por carteira. `checkin` NÃO está aqui de propósito: só o check-in credita.
 */
export const EARN_SOURCES: Readonly<Record<string, EarnSource>> = Object.freeze({
  venda: Object.freeze({ maxPerOp: DAILY_CAP }),
  pesca: Object.freeze({ maxPerOp: DAILY_CAP }),
  madeira: Object.freeze({ maxPerOp: DAILY_CAP }),
  minerio: Object.freeze({ maxPerOp: DAILY_CAP }),
  caca: Object.freeze({ maxPerOp: DAILY_CAP }),
  cavalo: Object.freeze({ maxPerOp: DAILY_CAP }),
  turno: Object.freeze({ maxPerOp: ECONOMIA.pontosPorHora.turno * 2 }),
  missao: Object.freeze({ maxPerOp: 100 }),
  tutorial: Object.freeze({ maxPerOp: TUTORIAL_REWARD, fixed: TUTORIAL_REWARD, once: true }),
  verified: Object.freeze({ maxPerOp: ECONOMIA.recompensaVerified, fixed: ECONOMIA.recompensaVerified, once: true }),
})

/** o teto por operação de cada fonte, como GET /api/game/points devolve */
export function sourceCaps(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(EARN_SOURCES)) out[k] = v.maxPerOp
  return out
}

/** o que o mercado central do jogo VENDE por DC Points (ECONOMIA.mercado.vende) */
export const SPEND_ITEMS: ReadonlyArray<string> = Object.freeze([...ECONOMIA.mercado.vende])

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

export function isEarnSource(v: unknown): v is string {
  return typeof v === 'string' && own(EARN_SOURCES, v)
}

export function isSpendItem(v: unknown): v is string {
  return typeof v === 'string' && SPEND_ITEMS.includes(v) && own(ITENS_PRECO, v)
}

/** inteiro seguro de lo a hi. NaN, Infinity, fração, string, null, boolean: não. */
export function intIn(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= lo && v <= hi
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype

export type Parsed<T> = ({ ok: true } & T) | { ok: false; error: string }

/** POST /api/game/points/earn { source, amount, ref, allOrNothing? } */
export function parseEarn(body: unknown): Parsed<{ source: string; amount: number; ref: string; allOrNothing: boolean; once: boolean }> {
  if (!isPlainObject(body)) return { ok: false, error: 'invalid_body' }
  if (!isEarnSource(body.source)) return { ok: false, error: 'invalid_source' }
  const src = EARN_SOURCES[body.source]
  const amount = body.amount
  if (!intIn(amount, 1, Math.min(src.maxPerOp, MAX_PER_OP))) return { ok: false, error: 'invalid_amount' }
  if (src.fixed !== undefined && amount !== src.fixed) return { ok: false, error: 'invalid_amount' }
  const once = src.once === true
  let ref: string
  if (once) {
    // a referência do cliente é ignorada (paga uma vez por carteira); se veio, ainda tem de ter a forma
    if (body.ref !== undefined && (typeof body.ref !== 'string' || !REF_RE.test(body.ref))) return { ok: false, error: 'invalid_ref' }
    ref = `once:${body.source}`
  } else {
    if (typeof body.ref !== 'string' || !REF_RE.test(body.ref)) return { ok: false, error: 'invalid_ref' }
    ref = `earn:${body.ref}`
  }
  if (body.allOrNothing !== undefined && typeof body.allOrNothing !== 'boolean') return { ok: false, error: 'invalid_body' }
  return { ok: true, source: body.source, amount, ref, allOrNothing: body.allOrNothing === true, once }
}

/** POST /api/game/points/spend { item, qty, ref, maxTotal? }. O preço NÃO vem do corpo (campo de preço é ignorado). */
export function parseSpend(body: unknown): Parsed<{ item: string; qty: number; ref: string; maxTotal: number | null }> {
  if (!isPlainObject(body)) return { ok: false, error: 'invalid_body' }
  if (!isSpendItem(body.item)) return { ok: false, error: 'invalid_item' }
  if (!intIn(body.qty, 1, MAX_SPEND_QTY)) return { ok: false, error: 'invalid_qty' }
  if (typeof body.ref !== 'string' || !REF_RE.test(body.ref)) return { ok: false, error: 'invalid_ref' }
  let maxTotal: number | null = null
  if (body.maxTotal !== undefined && body.maxTotal !== null) {
    if (!intIn(body.maxTotal, 1, MAX_PER_OP)) return { ok: false, error: 'invalid_max_total' }
    maxTotal = body.maxTotal
  }
  return { ok: true, item: body.item, qty: body.qty, ref: `spend:${body.ref}`, maxTotal }
}

/** POST /api/dogcity/car-buy { model, ref }. O preço NÃO vem do corpo. */
export function parseCarBuy(body: unknown): Parsed<{ model: string; ref: string }> {
  if (!isPlainObject(body)) return { ok: false, error: 'invalid_body' }
  if (!isCarModel(body.model)) return { ok: false, error: 'invalid_model' }
  if (typeof body.ref !== 'string' || !REF_RE.test(body.ref)) return { ok: false, error: 'invalid_ref' }
  return { ok: true, model: body.model, ref: `car:${body.ref}` }
}

const MS_DAY = 86_400_000

/** o número do dia do jogo (o mesmo de diaDoJogo do jogo) de um dia YYYY-MM-DD; NaN se não é dia */
export function dayNumber(day: string): number {
  if (typeof day !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)) return Number.NaN
  const t = Date.parse(day + 'T00:00:00Z')
  return Number.isFinite(t) ? Math.floor(t / MS_DAY) : Number.NaN
}

/**
 * O preço de uma compra no mercado do jogo no dia `day`: o preço do dia do jogo (precoDoDia, escassez 1, como o jogo hoje)
 * vezes a quantidade, com o teto por operação. null = não vende (item fora da lista, dia ruim, total acima do teto).
 */
export function quoteSpend(item: string, qty: number, day: string): { unitPrice: number; total: number } | null {
  if (!isSpendItem(item) || !intIn(qty, 1, MAX_SPEND_QTY)) return null
  const n = dayNumber(day)
  if (!Number.isInteger(n)) return null
  const unitPrice = precoDoDia(ITENS_PRECO[item], n, 1, ECONOMIA)
  const total = totalDe(unitPrice, qty, ECONOMIA)
  return unitPrice > 0 && total > 0 ? { unitPrice, total } : null
}

/** o preço de um carro em DC Points no código (o banco tem de dar o mesmo: dc_points_buy_car confere) */
export function carPriceDc(model: string): number | null {
  return isCarModel(model) ? CAR_MODELS[model].priceDc : null
}

/** o teto da migração do save: 480 x dias de jogo de 2026-10-29 até `day` (inclusive) */
export function migrationCap(day: string): number {
  const d = dayNumber(day)
  const s = dayNumber(MIGRATION_START_DAY)
  if (!Number.isInteger(d)) return 0
  return DAILY_CAP * Math.max(0, d - s + 1)
}

const DIA_MAXIMO = 10_000_000

/**
 * O saldo da seção `economia` de um save dogcity.jogo.v1, validado como validarSecao do jogo (src/economia/persistencia.ts):
 * envelope v 1, seção v 1, saldo inteiro de 0 a 1.000.000, recebido.dia inteiro de 0 a 10.000.000, recebido.total inteiro
 * de 0 a 480. Lixo: 0. ESPELHO de dc_points_save_balance (042): o banco é quem conta; isto existe para o teste.
 */
export function legacyBalanceFromSave(save: unknown): number {
  if (!save || typeof save !== 'object' || Array.isArray(save)) return 0
  const env = save as Record<string, unknown>
  if (env.v !== 1) return 0
  const e = env.economia
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 0
  const s = e as Record<string, unknown>
  if (s.v !== 1) return 0
  if (!saldoValido(s.saldo, ECONOMIA)) return 0
  const r = s.recebido
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 0
  const rr = r as Record<string, unknown>
  if (typeof rr.dia !== 'number' || !Number.isInteger(rr.dia) || rr.dia < 0 || rr.dia > DIA_MAXIMO) return 0
  if (typeof rr.total !== 'number' || !Number.isInteger(rr.total) || rr.total < 0 || rr.total > ECONOMIA.tetoDiarioRecebido) return 0
  return (s.saldo as number) + 0 // -0 vira 0
}

/** o que a migração dá: o saldo do save na foto, limitado ao teto do dia da foto */
export function migrationAmount(save: unknown, snapshotDay: string): number {
  return Math.min(legacyBalanceFromSave(save), migrationCap(snapshotDay))
}
