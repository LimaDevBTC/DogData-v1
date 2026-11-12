// ═══════════════════════════════════════════════════════════════════════════
// A LICENÇA NO LOTE: a conta pura, sem rede e sem banco (fundador, 12/11/2026).
// Contrato entre mint, DogData e jogo: LICENCA_NO_LOTE_CONTRATO.md. Tabelas: migração 037.
//
// REGRAS:
//  1. A licença de construção pertence ao LOTE (à inscrição da escritura). Nunca se vende sozinha: a
//     escritura muda de mãos e a licença vai junto. Cada lote tem a sua; nada se soma entre lotes.
//  2. O pagamento continua creditado à carteira que paga (scanner do $DOG e varredura do BTC intocados).
//     O crédito só vira licença quando é APLICADO a um lote. Crédito livre = o que a carteira conta
//     (standingOfWallet de licence-wallet.ts, a conta do placar) menos o que ela já aplicou.
//  3. APLICAÇÃO AUTOMÁTICA: crédito livre > 0 e a carteira guarda EXATAMENTE um lote, pelo mint
//     (`lots` + `snapshotLot` de GET /api/mint/holder/<address>, o do snapshot contando como lote).
//     Zero lotes: o crédito espera um lote. Dois ou mais: a carteira escolhe (a escolha fica para depois;
//     até lá o crédito espera). Mint mudo ou resposta estranha: não aplica, tenta na próxima volta.
//  4. Pagamento em BTC cuja cotação nomeou o lote (`lotId`): o crédito daquele pagamento cai direto
//     naquele lote, ANTES da automática, e ninguém mais o usa (o `ref` 'btc:<txid>:<vout>' é único).
//  5. Subir de nível paga a diferença do LOTE: o que um lote já soma vale para quem o guarda agora.
//  6. Setor 8 (Financial District) é só de empresa: lote S08 nunca leva licença (SETOR_DAS_EMPRESAS).
//
// TUDO EM ÁTOMOS INTEIROS (10^-5 DOG, a unidade do livro): a função do banco que aplica compara a soma
// já aplicada com a que o chamador viu (troca condicional), e ruído de ponto flutuante travaria a troca.
// ═══════════════════════════════════════════════════════════════════════════
import { buildLedger, type TxRow } from './founders-ledger'
import {
  FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, LICENCE_TIERS, applyBtcCredits, isTier, licenceFor, normalizeAddress,
  type Credit, type LicenceTier,
} from './licence-btc'

// ── LOTE ────────────────────────────────────────────────────────────────────

/** o mesmo formato do mint (packages/core LOT_ID_RE) e de /api/dogcity/lot-state */
export const LOT_ID_RE = /^S\d{2}-Q\d{2}-B\d{3,5}-L\d{3,5}$/

/** id de lote canônico (maiúsculo, sem espaço), ou null */
export function normalizeLotId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toUpperCase()
  return LOT_ID_RE.test(t) ? t : null
}

/** o lote pode levar licença: formato válido e fora do setor 8 (só de empresa) */
export const lotTakesLicence = (lotId: string): boolean => LOT_ID_RE.test(lotId) && !lotId.startsWith('S08-')

// ── ÁTOMOS ──────────────────────────────────────────────────────────────────

const ATOMOS = 100_000

/** átomos inteiros de um valor em DOG; inválido, zero ou negativo vale 0 */
export function atomsOf(dog: unknown): number {
  const v = typeof dog === 'string' && dog.trim() !== '' ? Number(dog) : dog
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * ATOMOS) : 0
}

export const dogOfAtoms = (a: number): number => a / ATOMOS

/** o degrau de um lote pelo total aplicado nele (as faixas do placar); abaixo de Personal: null */
export function tierOfLot(totalDog: unknown): LicenceTier | null {
  const k = licenceFor(dogOfAtoms(atomsOf(totalDog)))
  return isTier(k) ? k : null
}

const rank = (t: LicenceTier | null) => (t ? LICENCE_TIERS.indexOf(t) + 1 : 0)

// ── APLICAÇÕES ──────────────────────────────────────────────────────────────

export type AssignmentSource = 'dog' | 'btc' | 'migration'

/** uma linha de dogcity_licence_assignment */
export interface Assignment {
  lotId: string
  wallet: string
  amountDog: number
  source: AssignmentSource
  ref: string | null
}

/** o que um plano manda aplicar (a carteira é a do plano) */
export interface Application {
  lotId: string
  amountDog: number
  source: AssignmentSource
  ref: string | null
}

/** um pagamento em BTC creditado (dogcity_btc_payments, status 'credited') */
export interface CreditedPayment {
  txid: string
  vout: number
  ordinalsAddress: string
  creditDog: number
  quoteId: string | null
}

/** o crédito de um pagamento em BTC cuja cotação nomeou o lote: vai direto para ele */
export interface DirectBtc {
  ref: string
  lotId: string
  creditDog: number
}

export const btcRef = (txid: string, vout: number) => `btc:${txid}:${vout}`
export const migrationRef = (wallet: string) => `migration:${wallet}`

export const appliedAtoms = (assignments: Pick<Assignment, 'amountDog'>[]): number =>
  assignments.reduce((s, a) => s + atomsOf(a.amountDog), 0)

/** os créditos em BTC no formato do placar (applyBtcCredits / standingOfWallet) */
export const creditsOfPayments = (credited: CreditedPayment[]): Credit[] =>
  credited.map((c) => ({ ordinalsAddress: c.ordinalsAddress, creditDog: c.creditDog }))

/** os pagamentos creditados cuja cotação nomeou um lote que leva licença, na ordem em que vieram */
export function directBtcOf(credited: CreditedPayment[], quoteLots: Map<string, string>): DirectBtc[] {
  const out: DirectBtc[] = []
  for (const c of credited) {
    const lot = c.quoteId ? normalizeLotId(quoteLots.get(c.quoteId)) : null
    if (!lot || !lotTakesLicence(lot) || atomsOf(c.creditDog) <= 0) continue
    out.push({ ref: btcRef(c.txid, c.vout), lotId: lot, creditDog: c.creditDog })
  }
  return out
}

// ── O PLANO DE UMA CARTEIRA ─────────────────────────────────────────────────

export type PlanWhy =
  | 'applied'         // aplicou tudo o que estava livre
  | 'nothing_free'    // nada livre (tudo já está em algum lote)
  | 'no_lot'          // crédito livre e nenhum lote: espera um lote
  | 'many_lots'       // crédito livre e dois ou mais lotes: espera a escolha
  | 'holder_unknown'  // crédito livre e o mint não disse quais lotes a carteira guarda

export interface WalletPlan {
  applications: Application[]
  /** o crédito que fica da carteira e de nenhum lote, depois do plano */
  unassignedDog: number
  why: PlanWhy
}

/**
 * O que aplicar agora para UMA carteira. Pura. Primeiro os pagamentos em BTC que nomearam o lote
 * (cada `ref` uma vez, nunca acima do que a carteira conta), depois a automática, que só acontece
 * com a lista de lotes do mint (`heldLots` null = o mint não respondeu) e exatamente um lote.
 */
export function planWallet(input: {
  /** o que a carteira conta: standingOfWallet().totalDog (DOG do livro + BTC creditado, teto incluído) */
  totalDog: number
  /** as aplicações DESTA carteira */
  assignments: Assignment[]
  /** os pagamentos em BTC desta carteira com lote nomeado */
  directBtc: DirectBtc[]
  /** os lotes que a carteira guarda agora, pelo mint; null = não se sabe */
  heldLots: string[] | null
}): WalletPlan {
  let room = Math.max(0, atomsOf(input.totalDog) - appliedAtoms(input.assignments))
  const refs = new Set(input.assignments.map((a) => a.ref).filter((r): r is string => !!r))
  const applications: Application[] = []
  for (const d of input.directBtc) {
    if (refs.has(d.ref) || !lotTakesLicence(d.lotId)) continue
    refs.add(d.ref)
    const amt = Math.min(atomsOf(d.creditDog), room)
    if (amt <= 0) continue
    applications.push({ lotId: d.lotId, amountDog: dogOfAtoms(amt), source: 'btc', ref: d.ref })
    room -= amt
  }
  const done = (why: PlanWhy): WalletPlan => ({ applications, unassignedDog: dogOfAtoms(room), why })
  if (room <= 0) return done(applications.length ? 'applied' : 'nothing_free')
  if (input.heldLots === null) return done('holder_unknown')
  const held = [...new Set(input.heldLots.filter(lotTakesLicence))]
  if (held.length === 0) return done('no_lot')
  if (held.length > 1) return done('many_lots')
  applications.push({ lotId: held[0], amountDog: dogOfAtoms(room), source: 'dog', ref: null })
  room = 0
  return done('applied')
}

// ── O MINT: QUEM GUARDA O QUÊ ───────────────────────────────────────────────

/** GET https://mint.dogcity.space/api/mint/holder/<address> -> { address, lots, snapshotLot } */
export interface MintHolder {
  /** lotes cuja escritura o endereço guarda agora */
  lots: string[]
  /** o lote do snapshot dele, se ainda não mintado e ainda reservado a ele */
  snapshotLot: string | null
}

/** uma carteira com mais lotes do que isto na resposta é resposta estranha, não carteira */
export const MAX_HOLDER_LOTS = 5_000

/**
 * A resposta do mint, conferida. Qualquer coisa fora da forma (endereço que não é o perguntado, lote
 * com id inválido, campo faltando) vira null: "o mint não disse", e nada é aplicado com base nela.
 */
export function readMintHolder(body: unknown, address: string): MintHolder | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const asked = normalizeAddress(address)
  if (!asked || normalizeAddress(b.address) !== asked) return null
  if (!Array.isArray(b.lots) || b.lots.length > MAX_HOLDER_LOTS) return null
  const lots: string[] = []
  for (const l of b.lots) {
    const id = normalizeLotId(l)
    if (!id) return null
    lots.push(id)
  }
  if (b.snapshotLot !== null && b.snapshotLot !== undefined && typeof b.snapshotLot !== 'string') return null
  const snapshotLot = typeof b.snapshotLot === 'string' ? normalizeLotId(b.snapshotLot) : null
  if (typeof b.snapshotLot === 'string' && !snapshotLot) return null
  return { lots: [...new Set(lots)], snapshotLot }
}

/** os lotes que a carteira guarda e que levam licença: os mintados mais o do snapshot, sem repetir */
export function heldLotsOf(h: MintHolder): string[] {
  const all = [...h.lots, ...(h.snapshotLot ? [h.snapshotLot] : [])]
  return [...new Set(all.filter(lotTakesLicence))].sort()
}

// ── O QUE O STANDING DEVOLVE ────────────────────────────────────────────────

export interface LotLicence {
  lot: string
  tier: LicenceTier | null
  totalDog: number
}

/** quantas licenças existem por degrau (o placar da landing conta por lote) */
export type LicenceTierCount = Record<LicenceTier, number>

export interface LotStandingView {
  /** a licença mais alta entre os lotes que a carteira guarda agora (rifle e barco saem daqui) */
  tier: LicenceTier | null
  /**
   * COMPATÍVEL com o `totalDog` antigo (a tela de pagamento e o mint cobram a diferença por ele):
   * um lote = o total do lote + o crédito livre (que a automática põe nele); nenhum lote = o crédito
   * livre (espera um lote); dois ou mais = o total do lote mais alto (o livre espera a escolha).
   */
  totalDog: number
  lots: LotLicence[]
  unassignedDog: number
}

export function standingOfLots(heldLots: string[], lotTotals: Map<string, number>, unassignedDog: number): LotStandingView {
  const lots = [...new Set(heldLots.filter(lotTakesLicence))]
    .map((lot) => {
      const a = atomsOf(lotTotals.get(lot))
      return { lot, tier: tierOfLot(dogOfAtoms(a)), totalDog: dogOfAtoms(a), a }
    })
    .sort((x, y) => y.a - x.a || (x.lot < y.lot ? -1 : x.lot > y.lot ? 1 : 0))
  const free = atomsOf(unassignedDog)
  const top = lots[0]
  const tier = lots.reduce<LicenceTier | null>((t, l) => (rank(l.tier) > rank(t) ? l.tier : t), null)
  const compat = lots.length === 0 ? free : lots.length === 1 ? top.a + free : top.a
  return { tier, totalDog: dogOfAtoms(compat), lots: lots.map(({ a: _a, ...l }) => l), unassignedDog: dogOfAtoms(free) }
}

// ── O TOTAL DE TODAS AS CARTEIRAS (a varredura) ─────────────────────────────

/**
 * O que cada carteira conta, sobre o livro INTEIRO: a mesma conta do placar (/api/donate/leaderboard)
 * e de standingOfWallet, chaveada pelo endereço como a rota normaliza (bech32 minúsculo, base58
 * intacto). O livro guarda tudo em minúsculas; a caixa original do base58 sai das próprias linhas.
 */
export function walletTotals(rows: TxRow[], credits: Credit[]): Map<string, number> {
  const original = new Map<string, string>()
  const lembra = (a: unknown) => {
    const n = normalizeAddress(a)
    if (n && !original.has(n.toLowerCase())) original.set(n.toLowerCase(), n)
  }
  for (const r of rows) {
    for (const lado of [r.senders, r.receivers]) {
      const arr = typeof lado === 'string' ? (() => { try { return JSON.parse(lado) } catch { return [] } })() : lado
      if (Array.isArray(arr)) for (const x of arr) lembra(x?.address)
    }
  }
  for (const c of credits) lembra(c?.ordinalsAddress)
  const ledger = buildLedger(rows, FUND_DOG_ADDRESS, { licenseFor: licenceFor, posicoes: {} })
  const board = applyBtcCredits(ledger.leaderboard.filter((e) => e.address !== 'anonymous'), credits)
  const out = new Map<string, number>()
  const fundo = new Set([FUND_DOG_ADDRESS, FUND_BTC_ADDRESS])
  for (const e of [...board.entries, ...board.btcOnly]) {
    const k = original.get(e.address.toLowerCase()) ?? normalizeAddress(e.address)
    if (!k || fundo.has(k) || !(e.licence_total > 0)) continue
    out.set(k, e.licence_total)
  }
  return out
}

// ── A MIGRAÇÃO ÚNICA ────────────────────────────────────────────────────────

/** uma linha do placar público: o que a carteira conta (`licence_total`, DOG + BTC com o teto) */
export interface PlacarLinha {
  address: string
  licence_total: number
}

export interface LinhaDeMigracao {
  wallet: string
  lotId: string
  amountDog: number
  tier: LicenceTier | null
}

export interface PlanoDeMigracao {
  linhas: LinhaDeMigracao[]
  /** carteiras com licença e sem lote no snapshot: o crédito espera um lote */
  semLote: string[]
  /** carteiras cujo lote do snapshot é do setor 8 (empresa): nunca leva licença */
  setor8: string[]
  /** carteiras com crédito abaixo de Personal, deixadas para a aplicação automática */
  parciais: number
}

/**
 * Cada carteira com licença hoje -> o lote dela no snapshot 966.670 (contrato: "hoje todas são 1 carteira
 * = 1 lote"). `loteDe` recebe o endereço em minúsculas (o placar não guarda caixa) e devolve o lote e o
 * endereço como o registro selado grava. `parciais`: inclui também o crédito abaixo de Personal (o contrato
 * migra só quem tem licença; o resto a aplicação automática resolve).
 */
export function planoDeMigracao(
  placar: PlacarLinha[],
  loteDe: (enderecoMinusculo: string) => { lotId: string; address: string } | null,
  opts: { parciais?: boolean } = {},
): PlanoDeMigracao {
  const plano: PlanoDeMigracao = { linhas: [], semLote: [], setor8: [], parciais: 0 }
  const vistos = new Set<string>()
  for (const p of placar) {
    const n = normalizeAddress(p?.address)
    const a = atomsOf(p?.licence_total)
    if (!n || a <= 0 || vistos.has(n.toLowerCase())) continue
    vistos.add(n.toLowerCase())
    const tier = tierOfLot(dogOfAtoms(a))
    if (!tier && !opts.parciais) { plano.parciais++; continue }
    const l = loteDe(n.toLowerCase())
    const lotId = l ? normalizeLotId(l.lotId) : null
    if (!l || !lotId) { if (tier) plano.semLote.push(n); continue }
    if (!lotTakesLicence(lotId)) { plano.setor8.push(n); continue }
    const wallet = normalizeAddress(l.address) ?? n
    plano.linhas.push({ wallet, lotId, amountDog: dogOfAtoms(a), tier })
  }
  plano.linhas.sort((x, y) => (x.lotId < y.lotId ? -1 : x.lotId > y.lotId ? 1 : 0))
  return plano
}

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`

/**
 * O SQL da migração: uma chamada de dogcity_licence_apply por carteira, com `p_applied_before` = 0 (só
 * entra se a carteira ainda não aplicou nada) e `ref` 'migration:<carteira>' (único). Rodar duas vezes
 * não muda nada: a segunda devolve null em todas as linhas.
 */
export function sqlDaMigracao(linhas: LinhaDeMigracao[], cabecalho: string[]): string {
  const out = [...cabecalho.map((l) => `-- ${l}`), 'begin;']
  for (const l of linhas) {
    if (!normalizeAddress(l.wallet) || !lotTakesLicence(l.lotId) || atomsOf(l.amountDog) <= 0) {
      throw new Error(`linha de migração inválida: ${l.wallet} ${l.lotId}`)
    }
    const amount = dogOfAtoms(atomsOf(l.amountDog))
    out.push(`select public.dogcity_licence_apply(${sqlStr(l.wallet)}, ${sqlStr(l.lotId)}, ${amount}, 'migration', ${sqlStr(migrationRef(l.wallet))}, 0); -- ${l.tier ?? 'below personal'}`)
  }
  out.push('commit;', '')
  return out.join('\n')
}
