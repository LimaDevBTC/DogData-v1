// Um banco de MENTIRA que imita as funções dc_points_* da migração 042, para os testes (lib/game/points/points.test.ts).
// Mesmas regras, na mesma ordem: trava por carteira (aqui, uma fila de promessas por carteira, com um respiro entre a
// leitura e a escrita para a corrida aparecer se a trava faltar), ref idempotente, teto diário só nos ganhos, saldo
// nunca negativo nem acima de 1.000.000, a foto da migração, um carro de cada modelo. A prova no Postgres de verdade é a
// do PR (PGlite e Postgres embutido, fora do repo).
import { CAR_MODELS, CAR_MODEL_IDS } from '@/lib/game/cars/catalog'
import { DAILY_CAP, MAX_BALANCE, MAX_PER_OP, legacyBalanceFromSave, migrationCap } from './rules'
import type { BuyCarAnswer, EarnAnswer, MigrateAnswer, PointsState, PointsStore, SpendAnswer } from './store'

interface Line { kind: 'earn' | 'spend' | 'car' | 'migration' | 'refund'; source: string; ref: string; requested: number; delta: number; day: string; item?: string; qty?: number; unitPrice?: number; id: number }

const tick = () => new Promise<void>((r) => setTimeout(r, 1))

export class MemoryPointsStore implements PointsStore {
  today = '2026-11-15'
  handles = new Set<string>()
  balances = new Map<string, number>()
  migrated = new Map<string, number>()
  ledger = new Map<string, Line[]>()
  /** a foto da 042: carteira -> { saldo do save, teto, o que migra } */
  legacy = new Map<string, { saveBalance: number; cap: number; amount: number }>()
  models = new Map<string, { priceDc: number | null; active: boolean }>(CAR_MODEL_IDS.map((id) => [id, { priceDc: CAR_MODELS[id].priceDc, active: true }]))
  /** posse: 'carteira|modelo' -> origem */
  owned = new Map<string, 'purchase' | 'prize' | 'dc'>()
  /** com false a trava some (o teste prova que sem ela a corrida dá dois carros) */
  locking = true
  private seq = 0
  private locks = new Map<string, Promise<void>>()

  /** a foto dos saves, como o DO da 042 faz (UMA vez) */
  snapshot(saves: Record<string, unknown>, day: string): void {
    if (this.legacy.size > 0) return
    const cap = migrationCap(day)
    for (const [w, save] of Object.entries(saves)) {
      const b = legacyBalanceFromSave(save)
      this.legacy.set(w, { saveBalance: b, cap, amount: Math.min(b, cap) })
    }
  }

  private async lock<T>(wallet: string, fn: () => Promise<T>): Promise<T> {
    if (!this.locking) return fn()
    const prev = this.locks.get(wallet) ?? Promise.resolve()
    let release!: () => void
    const mine = new Promise<void>((r) => { release = r })
    this.locks.set(wallet, prev.then(() => mine))
    await prev
    try { return await fn() } finally { release() }
  }

  private lines(w: string): Line[] {
    let l = this.ledger.get(w)
    if (!l) { l = []; this.ledger.set(w, l) }
    return l
  }

  private bal(w: string) { return this.balances.get(w) ?? 0 }

  private append(w: string, line: Omit<Line, 'id'>): number {
    const after = this.bal(w) + line.delta
    if (after < 0) throw new Error('dc_points_ledger: the balance never goes negative')
    if (after > MAX_BALANCE) throw new Error('dc_points_ledger: the balance cap is 1000000')
    if (line.kind === 'earn' && (line.requested < 1 || line.requested > MAX_PER_OP)) throw new Error('check')
    this.lines(w).push({ ...line, id: ++this.seq })
    this.balances.set(w, after)
    return this.seq
  }

  earnedOn(w: string, day: string): number {
    return this.lines(w).filter((l) => l.kind === 'earn' && l.day === day).reduce((s, l) => s + l.delta, 0)
  }

  private byRef(w: string, ref: string) { return this.lines(w).find((l) => l.ref === ref) }

  async state(w: string): Promise<PointsState> {
    return {
      balance: this.bal(w), earnedToday: this.earnedOn(w, this.today), day: this.today,
      migrated: this.migrated.has(w), migratedAmount: this.migrated.get(w) ?? 0, hasHandle: this.handles.has(w),
    }
  }

  async migrate(w: string): Promise<MigrateAnswer> {
    return this.lock(w, async () => {
      if (this.migrated.has(w)) return { status: 'already', amount: this.migrated.get(w)!, balance: this.bal(w) }
      if (!this.handles.has(w)) return { status: 'no_handle', amount: 0, balance: this.bal(w) }
      const lg = this.legacy.get(w)
      const amount = lg?.amount ?? 0
      await tick()
      if (amount > 0) this.append(w, { kind: 'migration', source: 'save', ref: 'migration', requested: lg!.saveBalance, delta: amount, day: this.today })
      this.migrated.set(w, amount)
      return { status: 'migrated', amount, balance: this.bal(w) }
    })
  }

  async earn(w: string, source: string, amount: number, ref: string, maxPerOp: number, allOrNothing: boolean): Promise<EarnAnswer> {
    if (!Number.isSafeInteger(maxPerOp) || maxPerOp < 1 || maxPerOp > MAX_PER_OP) throw new Error('dc_points_earn: bad per-operation cap')
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > maxPerOp) throw new Error('dc_points_earn: bad amount')
    return this.lock(w, async () => {
      const prev = this.byRef(w, ref)
      if (prev) {
        if (prev.kind === 'earn' && prev.source === source && prev.requested === amount) {
          return { status: 'duplicate', requested: prev.requested, credited: prev.delta, balance: this.bal(w), earnedToday: this.earnedOn(w, this.today), day: this.today }
        }
        return { status: 'ref_conflict' }
      }
      if (!this.handles.has(w)) return { status: 'no_handle' }
      const earned = this.earnedOn(w, this.today)
      const bal = this.bal(w)
      await tick()
      let credit = Math.min(amount, Math.max(0, DAILY_CAP - earned), Math.max(0, MAX_BALANCE - bal))
      if (allOrNothing && credit < amount) credit = 0
      this.append(w, { kind: 'earn', source, ref, requested: amount, delta: credit, day: this.today })
      return { status: 'ok', requested: amount, credited: credit, balance: this.bal(w), earnedToday: earned + credit, day: this.today }
    })
  }

  async spend(w: string, item: string, qty: number, unitPrice: number, ref: string, maxTotal: number | null): Promise<SpendAnswer> {
    const total = qty * unitPrice
    if (!Number.isSafeInteger(total) || total < 1 || total > MAX_PER_OP) throw new Error('dc_points_spend: the total is above the per-operation cap')
    return this.lock(w, async () => {
      const prev = this.byRef(w, ref)
      if (prev) {
        if (prev.kind === 'spend' && prev.item === item && prev.qty === qty) {
          return { status: 'duplicate', item, qty, unitPrice: prev.unitPrice!, debited: -prev.delta, balance: this.bal(w) }
        }
        return { status: 'ref_conflict' }
      }
      if (maxTotal !== null && total > maxTotal) return { status: 'price_changed', unitPrice, total, balance: this.bal(w) }
      const bal = this.bal(w)
      await tick()
      if (bal < total) return { status: 'insufficient', balance: bal, needed: total }
      this.append(w, { kind: 'spend', source: 'market', ref, requested: total, delta: -total, day: this.today, item, qty, unitPrice })
      return { status: 'ok', item, qty, unitPrice, debited: total, balance: this.bal(w) }
    })
  }

  async buyCar(w: string, model: string, expectedPrice: number, ref: string): Promise<BuyCarAnswer> {
    return this.lock(w, async () => {
      const prev = this.byRef(w, ref)
      if (prev) {
        if (prev.kind === 'car' && prev.source === model) return { status: 'duplicate', model, price: -prev.delta, balance: this.bal(w), ownershipRef: `dc:${prev.id}` }
        return { status: 'ref_conflict' }
      }
      const m = this.models.get(model)
      if (!m) return { status: 'unknown_model', model }
      if (!m.active || m.priceDc === null) return { status: 'not_for_sale', model }
      if (m.priceDc !== expectedPrice) return { status: 'price_mismatch', model }
      const k = `${w}|${model}`
      const owns = this.owned.has(k)
      const bal = this.bal(w)
      await tick() // a janela da corrida: sem trava, duas compras leem "não tem" e "tem saldo" juntas
      if (owns) return { status: 'already_owned', model }
      if (bal < m.priceDc) return { status: 'insufficient', model, price: m.priceDc, balance: bal }
      const id = this.append(w, { kind: 'car', source: model, ref, requested: m.priceDc, delta: -m.priceDc, day: this.today, item: model, qty: 1, unitPrice: m.priceDc })
      this.owned.set(k, 'dc')
      return { status: 'ok', model, price: m.priceDc, balance: this.bal(w), ownershipRef: `dc:${id}` }
    })
  }
}
