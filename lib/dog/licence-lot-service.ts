// ═══════════════════════════════════════════════════════════════════════════
// A LICENÇA NO LOTE, LIGADA AO BANCO E AO MINT POR INTERFACES (12/11/2026).
// As regras estão em licence-lot.ts; aqui só a ordem das leituras, as escritas e as falhas.
// O banco de verdade e o mint de verdade estão em licence-lot-supabase.ts; os testes passam falsos.
//
// TRÊS CONSUMIDORES:
//   standingDaCarteira   GET /api/dogcity/licence-standing: os lotes que a carteira guarda e a licença de
//                        cada um. É também um GATILHO: aplica o crédito livre na hora (quem acabou de pagar
//                        abre o jogo ou o mint e já vê a licença, sem esperar a varredura).
//   heldParaCotacao      POST /api/dogcity/licence-quote: o que o LOTE já soma (subir paga a diferença do lote)
//   passeDosLotes        /api/cron/licence-btc, depois da varredura do BTC: aplica o que estiver livre em
//                        todas as carteiras (os pagamentos em BTC com lote nomeado primeiro)
//
// FALHAS:
//   * Sem as tabelas da migração 037 (SemTabela): MODO ANTIGO, a licença por carteira como sempre foi, e
//     nada é aplicado. É o que deixa publicar o código antes da migração sem quebrar a casa nem o placar.
//   * Mint mudo: nada é aplicado pela automática. O standing mostra os lotes pela reserva do registro
//     selado do DogData (o lote do snapshot, `lotsFrom: 'snapshot'`), como o jogo faz com `lote:<endereço>`.
//   * Banco fora ou prazo estourado: null ("não sei agora"), nunca licença inventada.
//   * Troca condicional recusada (outra aplicação da mesma carteira entrou no meio): para, relê, e a
//     próxima volta refaz a conta. Nunca aplica o mesmo crédito duas vezes.
// ═══════════════════════════════════════════════════════════════════════════
import type { TxRow } from './founders-ledger'
import type { LicenceTier } from './licence-btc'
import {
  appliedAtoms, atomsOf, creditsOfPayments, directBtcOf, dogOfAtoms, heldLotsOf, lotTakesLicence, planWallet,
  standingOfLots, walletTotals,
  type Application, type Assignment, type CreditedPayment, type DirectBtc, type LotLicence, type MintHolder,
} from './licence-lot'
import { standingOfWallet } from './licence-wallet'

/** as tabelas da migração 037 (ou a coluna `lot_id` das cotações) ainda não existem no banco */
export class SemTabela extends Error {
  constructor(msg = 'lot licence tables are not in the database yet') { super(msg); this.name = 'SemTabela' }
}

export interface LotLicenceStore {
  /** as linhas de dog_transactions que ligam o fundo a esta carteira (a consulta de licence-wallet.ts) */
  fundRowsOf(address: string, signal?: AbortSignal): Promise<TxRow[]>
  /** os pagamentos em BTC creditados a esta carteira */
  creditedOf(address: string, signal?: AbortSignal): Promise<CreditedPayment[]>
  /** o lote nomeado por cada cotação, só das que nomearam. SemTabela sem a coluna */
  quoteLots(quoteIds: string[], signal?: AbortSignal): Promise<Map<string, string>>
  /** as aplicações desta carteira. SemTabela sem a 037 */
  assignmentsOf(wallet: string, signal?: AbortSignal): Promise<Assignment[]>
  /** o total aplicado em cada lote pedido (lote sem linha fica fora do mapa = 0) */
  lotTotals(lotIds: string[], signal?: AbortSignal): Promise<Map<string, number>>
  /** dogcity_licence_apply: true = aplicou; false = o mundo mudou (refazer a conta) */
  apply(wallet: string, app: Application, appliedBeforeDog: number): Promise<boolean>
}

export interface LotLicenceCronStore extends LotLicenceStore {
  allFundRows(): Promise<TxRow[]>
  allCredited(): Promise<CreditedPayment[]>
  allAssignments(): Promise<Assignment[]>
}

export interface LotDeps {
  store: LotLicenceStore
  /** o mint (GET /api/mint/holder/<address>); null = não respondeu ou respondeu fora da forma */
  holder: (address: string) => Promise<MintHolder | null>
  /** o lote do snapshot pelo registro selado do DogData; null = o endereço não tem lote; undefined = não se sabe */
  snapshotLot: (address: string) => Promise<string | null | undefined>
}

const erroDe = (e: unknown) => (e as Error)?.message ?? String(e)

// ── o estado de uma carteira ────────────────────────────────────────────────

interface Estado {
  totalDog: number
  walletTier: LicenceTier | null
  assignments: Assignment[]
  directBtc: DirectBtc[]
}

type EstadoOuAntigo = (Estado & { antigo: false }) | { antigo: true; totalDog: number; walletTier: LicenceTier | null }

/**
 * O que a carteira conta, o que já aplicou e os pagamentos em BTC com lote nomeado, de UMA leitura dos
 * créditos (o total e os diretos saem da mesma lista: um crédito que chega entre duas leituras nunca é
 * contado num lado e não no outro). `strict`: sem ler o BTC não há resposta (quem COBRA precisa dele).
 */
async function estadoDe(store: LotLicenceStore, address: string, strict: boolean, signal?: AbortSignal): Promise<EstadoOuAntigo> {
  const [rows, credited] = await Promise.all([
    store.fundRowsOf(address, signal),
    store.creditedOf(address, signal).catch((e) => {
      if (strict) throw e
      if (!signal?.aborted) console.error('[licence-lot] btc credits unavailable:', erroDe(e))
      return [] as CreditedPayment[]
    }),
  ])
  const s = standingOfWallet(rows, address, creditsOfPayments(credited))
  const quoteIds = [...new Set(credited.map((c) => c.quoteId).filter((q): q is string => !!q))]
  try {
    const [assignments, quoteLots] = await Promise.all([
      store.assignmentsOf(address, signal),
      quoteIds.length ? store.quoteLots(quoteIds, signal) : Promise.resolve(new Map<string, string>()),
    ])
    return { antigo: false, totalDog: s.totalDog, walletTier: s.tier, assignments, directBtc: directBtcOf(credited, quoteLots) }
  } catch (e) {
    if (e instanceof SemTabela) return { antigo: true, totalDog: s.totalDog, walletTier: s.tier }
    throw e
  }
}

/**
 * Aplica as aplicações de um plano, uma a uma, cada uma condicionada à soma que a anterior deixou.
 * Para na primeira recusa (`stale`): a soma no banco não é mais a que o plano viu.
 */
async function aplicarPlano(store: LotLicenceStore, wallet: string, assignments: Assignment[], apps: Application[]):
  Promise<{ feitas: Application[]; stale: boolean }> {
  const feitas: Application[] = []
  let antes = appliedAtoms(assignments)
  for (const app of apps) {
    if (!(await store.apply(wallet, app, dogOfAtoms(antes)))) return { feitas, stale: true }
    feitas.push(app)
    antes += atomsOf(app.amountDog)
  }
  return { feitas, stale: false }
}

const comoAplicacoes = (wallet: string, apps: Application[]): Assignment[] => apps.map((a) => ({ ...a, wallet }))

/** um prazo para a resposta inteira, encadeado ao sinal de quem pediu */
async function comPrazo<T>(ms: number, signal: AbortSignal | undefined, fn: (s: AbortSignal) => Promise<T>): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const fora = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', fora, { once: true })
  }
  try {
    const prazo = new Promise<null>((res) => ctrl.signal.addEventListener('abort', () => res(null), { once: true }))
    const r = await Promise.race([fn(ctrl.signal), prazo])
    return ctrl.signal.aborted ? null : r
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', fora)
  }
}

// ── STANDING ────────────────────────────────────────────────────────────────

export interface WalletLotStanding {
  /** a licença mais alta entre os lotes que a carteira guarda agora; no modo antigo, a da carteira */
  tier: LicenceTier | null
  /** compatível com o `totalDog` antigo (ver standingOfLots); no modo antigo, o total da carteira */
  totalDog: number
  /** os lotes que a carteira guarda e a licença de cada um; null no modo antigo */
  lots: LotLicence[] | null
  /** o crédito que é da carteira e de nenhum lote; null no modo antigo */
  unassignedDog: number | null
  /** de onde veio a lista de lotes: o mint, a reserva do snapshot, ou null no modo antigo */
  lotsFrom: 'mint' | 'snapshot' | null
}

/**
 * A licença de uma carteira pelos lotes que ela guarda AGORA. null = não se sabe agora (banco fora,
 * prazo, registro do snapshot ilegível com o mint mudo). `apply: false` só lê (nunca escreve).
 */
export async function standingDaCarteira(
  deps: LotDeps,
  address: string,
  opts: { ms?: number; signal?: AbortSignal; strict?: boolean; apply?: boolean } = {},
): Promise<WalletLotStanding | null> {
  try {
    return await comPrazo(opts.ms ?? 4000, opts.signal, async (signal) => {
      const [estado, holder] = await Promise.all([
        estadoDe(deps.store, address, opts.strict === true, signal),
        deps.holder(address).catch(() => null),
      ])
      if (estado.antigo) return { tier: estado.walletTier, totalDog: estado.totalDog, lots: null, unassignedDog: null, lotsFrom: null }

      let assignments = estado.assignments
      const held = holder ? heldLotsOf(holder) : null
      const plano = planWallet({ totalDog: estado.totalDog, assignments, directBtc: estado.directBtc, heldLots: held })
      if (opts.apply !== false && plano.applications.length) {
        const r = await aplicarPlano(deps.store, address, assignments, plano.applications)
        assignments = r.stale ? await deps.store.assignmentsOf(address, signal) : [...assignments, ...comoAplicacoes(address, r.feitas)]
      }
      // o que sobra livre, já reservado o BTC que ainda vai para o lote nomeado
      const livre = planWallet({ totalDog: estado.totalDog, assignments, directBtc: estado.directBtc, heldLots: null }).unassignedDog

      let lots: string[]
      let lotsFrom: 'mint' | 'snapshot'
      if (held) {
        lots = held
        lotsFrom = 'mint'
      } else {
        const s = await deps.snapshotLot(address).catch(() => undefined)
        if (s === undefined) return null
        lots = s && lotTakesLicence(s) ? [s] : []
        lotsFrom = 'snapshot'
      }
      const totals = lots.length ? await deps.store.lotTotals(lots, signal) : new Map<string, number>()
      return { ...standingOfLots(lots, totals, livre), lotsFrom }
    })
  } catch (e) {
    if (!opts.signal?.aborted) console.error('[licence-lot] standing unavailable:', erroDe(e))
    return null
  }
}

// ── COTAÇÃO ─────────────────────────────────────────────────────────────────

/**
 * O que a cotação desconta para o degrau (subir paga a diferença do LOTE):
 *   * com `lotId`: a carteira tem de guardar o lote, PELO MINT (sem mint não se cota: quem paga é o dono);
 *     o crédito livre que a automática põe naquele lote entra antes; o valor é o total do lote.
 *   * sem `lotId` (cliente antigo): o lote é o único que a carteira guarda (mint, ou a reserva do snapshot
 *     se o mint calar); o valor é o `totalDog` compatível do standing.
 *   * sem as tabelas da 037: o total da carteira, como sempre foi (com `lotId`: não se cota).
 * null = não se sabe agora (503); 'not_holder' = a carteira não guarda o lote (403).
 */
export async function heldParaCotacao(
  deps: LotDeps,
  address: string,
  lotId: string | null,
  opts: { ms?: number; signal?: AbortSignal } = {},
): Promise<number | null | 'not_holder'> {
  try {
    return await comPrazo<number | null | 'not_holder'>(opts.ms ?? 5000, opts.signal, async (signal) => {
      const [estado, holder] = await Promise.all([
        estadoDe(deps.store, address, true, signal),
        deps.holder(address).catch(() => null),
      ])
      if (estado.antigo) return lotId ? null : estado.totalDog
      const held = holder ? heldLotsOf(holder) : null
      if (lotId) {
        if (!held) return null
        if (!held.includes(lotId)) return 'not_holder'
      }
      let assignments = estado.assignments
      const plano = planWallet({ totalDog: estado.totalDog, assignments, directBtc: estado.directBtc, heldLots: held })
      if (plano.applications.length) {
        const r = await aplicarPlano(deps.store, address, assignments, plano.applications)
        // cobrar sobre uma soma que acabou de mudar no meio é cobrar errado: melhor pedir de novo
        if (r.stale) return null
        assignments = [...assignments, ...comoAplicacoes(address, r.feitas)]
      }
      const livre = planWallet({ totalDog: estado.totalDog, assignments, directBtc: estado.directBtc, heldLots: null }).unassignedDog
      if (lotId) {
        const totals = await deps.store.lotTotals([lotId], signal)
        return dogOfAtoms(atomsOf(totals.get(lotId)))
      }
      let lots = held
      if (!lots) {
        const s = await deps.snapshotLot(address).catch(() => undefined)
        if (s === undefined) return null
        lots = s && lotTakesLicence(s) ? [s] : []
      }
      const totals = lots.length ? await deps.store.lotTotals(lots, signal) : new Map<string, number>()
      return standingOfLots(lots, totals, livre).totalDog
    })
  } catch (e) {
    if (!opts.signal?.aborted) console.error('[licence-lot] quote held unavailable:', erroDe(e))
    return null
  }
}

// ── A VARREDURA ─────────────────────────────────────────────────────────────

/** perguntas ao mint por volta da varredura (a cada 2 min): com rodízio, todas as carteiras passam */
export const MAX_HOLDER_CHECKS = 20
/** perguntas ao mint ao mesmo tempo */
const HOLDER_CONCURRENCY = 4
/** o passo do rodízio: o intervalo da varredura */
const VOLTA_MS = 2 * 60 * 1000

export interface LotPassResult {
  /** carteiras com algum crédito */
  wallets: number
  /** aplicações de BTC com lote nomeado */
  direct: number
  /** aplicações automáticas (a carteira guarda exatamente um lote) */
  automatic: number
  /** perguntas feitas ao mint nesta volta */
  checked: number
  /** carteiras com crédito livre esperando */
  noLot: number
  manyLots: number
  holderUnknown: number
  /** trocas condicionais recusadas (a próxima volta refaz) */
  stale: number
  /** sem as tabelas da 037: nada foi feito */
  skipped?: 'no_tables'
}

async function emLotes<T>(itens: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) await fn(itens[i++])
  }))
}

/**
 * Uma volta: lê o livro inteiro, os créditos em BTC e todas as aplicações; aplica primeiro os pagamentos
 * em BTC com lote nomeado (sem perguntar ao mint), depois pergunta ao mint por até `maxHolderChecks`
 * carteiras com crédito livre (em rodízio, para nenhuma ficar para trás) e aplica onde a carteira guarda
 * exatamente um lote. Uma carteira que falha não derruba as outras.
 */
export async function passeDosLotes(deps: {
  store: LotLicenceCronStore
  holder: (address: string) => Promise<MintHolder | null>
  nowMs: number
  maxHolderChecks?: number
}): Promise<LotPassResult> {
  const res: LotPassResult = { wallets: 0, direct: 0, automatic: 0, checked: 0, noLot: 0, manyLots: 0, holderUnknown: 0, stale: 0 }
  let todas: Assignment[]
  let rows: TxRow[]
  let credited: CreditedPayment[]
  let quoteLots: Map<string, string>
  try {
    todas = await deps.store.allAssignments()
    ;[rows, credited] = await Promise.all([deps.store.allFundRows(), deps.store.allCredited()])
    const ids = [...new Set(credited.map((c) => c.quoteId).filter((q): q is string => !!q))]
    quoteLots = ids.length ? await deps.store.quoteLots(ids) : new Map()
  } catch (e) {
    if (e instanceof SemTabela) return { ...res, skipped: 'no_tables' }
    throw e
  }

  const totals = walletTotals(rows, creditsOfPayments(credited))
  const porCarteira = new Map<string, Assignment[]>()
  for (const a of todas) porCarteira.set(a.wallet, [...(porCarteira.get(a.wallet) ?? []), a])
  const pagosPor = new Map<string, CreditedPayment[]>()
  for (const c of credited) pagosPor.set(c.ordinalsAddress, [...(pagosPor.get(c.ordinalsAddress) ?? []), c])
  const carteiras = [...new Set([...totals.keys(), ...pagosPor.keys()])].sort()
  res.wallets = carteiras.length

  // 1) BTC com lote nomeado: não precisa do mint
  const esperando: string[] = []
  for (const w of carteiras) {
    const totalDog = totals.get(w) ?? 0
    const directBtc = directBtcOf(pagosPor.get(w) ?? [], quoteLots)
    try {
      const plano = planWallet({ totalDog, assignments: porCarteira.get(w) ?? [], directBtc, heldLots: null })
      if (plano.applications.length) {
        const r = await aplicarPlano(deps.store, w, porCarteira.get(w) ?? [], plano.applications)
        res.direct += r.feitas.length
        if (r.stale) { res.stale++; continue }
        porCarteira.set(w, [...(porCarteira.get(w) ?? []), ...comoAplicacoes(w, r.feitas)])
      }
      if (plano.why === 'holder_unknown') esperando.push(w)
    } catch (e) {
      console.error('[licence-lot] direct failed:', w, erroDe(e))
    }
  }

  // 2) automática: pergunta ao mint, em rodízio
  const max = Math.max(0, deps.maxHolderChecks ?? MAX_HOLDER_CHECKS)
  const n = esperando.length
  const inicio = n ? (Math.floor(deps.nowMs / VOLTA_MS) * max) % n : 0
  const vez = n <= max ? esperando : Array.from({ length: max }, (_, i) => esperando[(inicio + i) % n])
  res.holderUnknown = n - vez.length
  await emLotes(vez, HOLDER_CONCURRENCY, async (w) => {
    res.checked++
    try {
      const holder = await deps.holder(w).catch(() => null)
      const plano = planWallet({
        totalDog: totals.get(w) ?? 0,
        assignments: porCarteira.get(w) ?? [],
        directBtc: directBtcOf(pagosPor.get(w) ?? [], quoteLots),
        heldLots: holder ? heldLotsOf(holder) : null,
      })
      if (plano.why === 'no_lot') res.noLot++
      else if (plano.why === 'many_lots') res.manyLots++
      else if (plano.why === 'holder_unknown') res.holderUnknown++
      if (plano.applications.length) {
        const r = await aplicarPlano(deps.store, w, porCarteira.get(w) ?? [], plano.applications)
        res.automatic += r.feitas.filter((a) => a.source === 'dog').length
        res.direct += r.feitas.filter((a) => a.source === 'btc').length
        if (r.stale) res.stale++
      }
    } catch (e) {
      console.error('[licence-lot] automatic failed:', w, erroDe(e))
    }
  })
  return res
}
