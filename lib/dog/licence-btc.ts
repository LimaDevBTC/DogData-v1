// ═══════════════════════════════════════════════════════════════════════════
// LICENÇA PAGA EM BITCOIN: a conta pura, sem rede e sem banco.
//
// REGRAS (decididas pelo fundador em 19/10, contrato público em /dogcity/docs):
//  1. A licença continua valendo em $DOG (Personal 10.000, Commercial 50.000, Patron
//     500.000). Em BTC paga-se o equivalente pela MEDIANA de corretoras para DOG/USD e
//     BTC/USD, travada por 15 minutos. Sem fontes independentes suficientes, NÃO cota.
//  2. BTC NÃO conta para os 10.000.000 $DOG que disparam o mint. Este módulo não é
//     importado por lib/dog/mint-b.ts, nem por /api/dogcity/mint-b, nem entra em
//     `total_received`: o livro (founders-ledger.ts) continua SÓ em DOG. Há um teste que
//     tranca isso (licence-btc.test.ts).
//  3. Por carteira soma-se DOG e BTC (o BTC pelo valor em DOG da cotação travada; se foi
//     pago depois de vencida a trava, pela cotação do bloco em que confirmou) para chegar
//     ao degrau da licença.
//
// FALHA FECHADA: tudo aqui devolve "não" diante de dúvida. NaN, negativo, zero, Infinity,
// inteiro inseguro e preço fora de faixa são recusados, nunca arredondados para dentro.
// Pagamento sem cotação confiável vira `pending_review`, jamais licença sozinho.
// ═══════════════════════════════════════════════════════════════════════════

export const LICENCE_DOG = { personal: 10_000, commercial: 50_000, patron: 500_000 } as const
export type LicenceTier = keyof typeof LICENCE_DOG
export const LICENCE_TIERS = Object.keys(LICENCE_DOG) as LicenceTier[]
export const isTier = (t: unknown): t is LicenceTier => typeof t === 'string' && (LICENCE_TIERS as string[]).includes(t)

/** o fundo, em Bitcoin (o mesmo das docs, seção do Founders Program) */
export const FUND_BTC_ADDRESS = 'bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63'
/** o fundo, em DOG: pagamento que sai daqui nunca é pagamento de licença */
export const FUND_DOG_ADDRESS = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'

export const SATS_PER_BTC = 100_000_000
export const QUOTE_LOCK_MS = 15 * 60 * 1000
/** depois de vencida, a cotação ainda "liga" a carteira por este tempo (cotação do bloco) */
export const LINK_WINDOW_AFTER_EXPIRY_MS = 2 * 60 * 60 * 1000
/** confirmações antes de creditar (a mesma regra do B: com menos, uma reorg ainda desfaz) */
export const BTC_MIN_CONFIRMATIONS = 6

/** fontes independentes mínimas por par, e o desvio máximo da mediana que ainda conta */
export const MIN_SOURCES = 2
export const MAX_DEVIATION = 0.05

// ── TETOS ABSOLUTOS ─────────────────────────────────────────────────────────
/** nenhum pagamento credita mais que isto, em sats; acima vai para revisão, nunca é truncado */
export const MAX_PAYMENT_SATS = 100_000_000 // 1 BTC
/** nenhum pagamento credita mais que isto em DOG (4x o Patron) */
export const MAX_CREDIT_DOG_PER_PAYMENT = 2_000_000
/** o BTC de uma carteira soma no máximo isto em DOG (a escada acaba em 500.000) */
export const MAX_BTC_CREDIT_DOG_PER_WALLET = 5_000_000
/** abaixo disto o pagamento é poeira: não é licença, não gera revisão */
export const MIN_PAYMENT_SATS = 1_000
/** faixa de sanidade dos preços; fora dela o preço é lixo, não cotação */
export const DOG_USD_BOUNDS: [number, number] = [1e-6, 100]
export const BTC_USD_BOUNDS: [number, number] = [1_000, 10_000_000]

const ATOMOS = 100_000 // 10^-5 DOG, como o livro

/** número finito e estritamente positivo, senão NaN (que ninguém confunde com preço) */
export function positive(n: unknown): number {
  const v = typeof n === 'string' && n.trim() !== '' ? Number(n) : n
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : NaN
}

const floorAtomos = (dog: number) => Math.floor(dog * ATOMOS) / ATOMOS

// ── MEDIANA ─────────────────────────────────────────────────────────────────

export interface SourceSample { name: string; price: number }

export type MedianResult =
  | { ok: true; price: number; sources: SourceSample[] }
  | { ok: false; reason: 'not_enough_sources' | 'sources_disagree' }

function medianOf(sorted: number[]): number {
  const m = sorted.length >> 1
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2
}

/**
 * A mediana das fontes, ou a recusa. Passos:
 *  1. descarta amostra inválida (NaN, <= 0, Infinity, fora da faixa de sanidade) e nome repetido;
 *  2. menos de MIN_SOURCES independentes: recusa (`not_enough_sources`);
 *  3. descarta quem se afasta mais de MAX_DEVIATION da mediana;
 *  4. menos de MIN_SOURCES sobrando: recusa (`sources_disagree`);
 *  5. o preço é a mediana de quem sobrou.
 */
export function medianPrice(samples: SourceSample[], bounds: [number, number]): MedianResult {
  const seen = new Set<string>()
  const valid: SourceSample[] = []
  for (const s of samples) {
    const price = positive(s?.price)
    if (!Number.isFinite(price) || price < bounds[0] || price > bounds[1]) continue
    if (typeof s.name !== 'string' || !s.name || seen.has(s.name)) continue
    seen.add(s.name)
    valid.push({ name: s.name, price })
  }
  if (valid.length < MIN_SOURCES) return { ok: false, reason: 'not_enough_sources' }
  const m = medianOf(valid.map((v) => v.price).sort((a, b) => a - b))
  const kept = valid.filter((v) => Math.abs(v.price - m) / m <= MAX_DEVIATION)
  if (kept.length < MIN_SOURCES) return { ok: false, reason: 'sources_disagree' }
  const price = medianOf(kept.map((v) => v.price).sort((a, b) => a - b))
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'sources_disagree' }
  return { ok: true, price, sources: kept }
}

// ── COTAÇÃO ─────────────────────────────────────────────────────────────────

export interface Quote {
  id: string
  tier: LicenceTier
  ordinalsAddress: string
  paymentAddress: string
  dogAmount: number
  sats: number
  dogUsd: number
  btcUsd: number
  createdAtMs: number
  expiresAtMs: number
  sources: SourceSample[]
}

/** sats que valem `dog` DOG: arredonda PARA CIMA, para quem paga nunca ficar abaixo do degrau. */
export function satsForDog(dog: number, dogUsd: number, btcUsd: number): number | null {
  const d = positive(dog), du = positive(dogUsd), bu = positive(btcUsd)
  if (!Number.isFinite(d) || !Number.isFinite(du) || !Number.isFinite(bu)) return null
  const sats = Math.ceil((d * du * SATS_PER_BTC) / bu)
  if (!Number.isSafeInteger(sats) || sats < 1 || sats > MAX_PAYMENT_SATS) return null
  return sats
}

/** o valor em DOG de `sats` a uma taxa; null em qualquer entrada inválida ou acima do teto */
export function dogForSats(sats: number, dogUsd: number, btcUsd: number): number | null {
  const s = positive(sats), du = positive(dogUsd), bu = positive(btcUsd)
  if (!Number.isFinite(s) || !Number.isFinite(du) || !Number.isFinite(bu) || !Number.isSafeInteger(s)) return null
  const dog = floorAtomos((s / SATS_PER_BTC) * bu / du)
  if (!Number.isFinite(dog) || dog <= 0) return null
  return dog
}

export type QuoteRefusal = 'not_enough_sources' | 'sources_disagree' | 'bad_input' | 'bad_price'

/** Monta a cotação a partir das duas medianas. Qualquer dúvida: recusa. */
export function buildQuote(input: {
  id: string
  tier: unknown
  ordinalsAddress: string
  paymentAddress: string
  dog: MedianResult
  btc: MedianResult
  nowMs: number
}): { ok: true; quote: Quote } | { ok: false; reason: QuoteRefusal } {
  if (!isTier(input.tier) || !Number.isFinite(input.nowMs)) return { ok: false, reason: 'bad_input' }
  if (!input.dog.ok) return { ok: false, reason: input.dog.reason }
  if (!input.btc.ok) return { ok: false, reason: input.btc.reason }
  const dogAmount = LICENCE_DOG[input.tier]
  const sats = satsForDog(dogAmount, input.dog.price, input.btc.price)
  if (sats === null) return { ok: false, reason: 'bad_price' }
  return {
    ok: true,
    quote: {
      id: input.id,
      tier: input.tier,
      ordinalsAddress: input.ordinalsAddress,
      paymentAddress: input.paymentAddress,
      dogAmount,
      sats,
      dogUsd: input.dog.price,
      btcUsd: input.btc.price,
      createdAtMs: input.nowMs,
      expiresAtMs: input.nowMs + QUOTE_LOCK_MS,
      sources: [
        ...input.dog.sources.map((s) => ({ name: `DOG/USD ${s.name}`, price: s.price })),
        ...input.btc.sources.map((s) => ({ name: `BTC/USD ${s.name}`, price: s.price })),
      ],
    },
  }
}

/** ms que faltam para vencer (0 = vencida) */
export const msLeft = (q: Pick<Quote, 'expiresAtMs'>, nowMs: number) => Math.max(0, q.expiresAtMs - nowMs)

// ── PAGAMENTO ───────────────────────────────────────────────────────────────

export interface BtcPayment {
  txid: string
  vout: number
  sats: number
  /** todo endereço que financiou a transação */
  payerAddresses: string[]
  /** a primeira vez que a rede (ou a nossa varredura) viu a transação */
  seenAtMs: number
  confirmations: number
  blockTimeMs: number | null
}

export interface PriceAtBlock { dogUsd: number; btcUsd: number }

export type ReviewReason =
  | 'above_ceiling'          // acima do teto: um humano decide, nada é truncado
  | 'invalid_amount'
  | 'ambiguous_owner'        // o mesmo endereço pagador ligado a mais de uma carteira ordinals
  | 'underpaid_for_quote'    // pagou dentro da trava, mas menos que os sats cotados
  | 'price_unavailable'      // sem cotação confiável do bloco; tenta de novo sozinho

export type Resolution =
  | { status: 'observed'; reason: 'confirmations' }
  | { status: 'unmatched'; reason: 'dust' | 'fund_is_payer' | 'no_quote' }
  | { status: 'pending_review'; reason: ReviewReason; retry: boolean }
  | { status: 'credited'; ordinalsAddress: string; quoteId: string; creditDog: number; basis: 'quote' | 'block'; dogUsd: number; btcUsd: number }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Qual cotação cobre este pagamento, ou por que nenhuma. Pura e sem preço de bloco. */
export function matchQuote(p: BtcPayment, quotes: Quote[]):
  | { kind: 'quote' | 'block'; quote: Quote }
  | { kind: 'done'; resolution: Resolution } {
  const done = (resolution: Resolution) => ({ kind: 'done' as const, resolution })
  const review = (reason: ReviewReason, retry = false) => done({ status: 'pending_review', reason, retry })

  if (!Number.isSafeInteger(p.sats) || p.sats <= 0 || !Number.isFinite(p.seenAtMs)) return review('invalid_amount')
  if (p.sats < MIN_PAYMENT_SATS) return done({ status: 'unmatched', reason: 'dust' })
  if (p.sats > MAX_PAYMENT_SATS) return review('above_ceiling')
  const payers = p.payerAddresses.map((a) => a.toLowerCase())
  // o próprio fundo como pagador (troco, movimento interno) nunca é pagamento de licença
  if (payers.includes(FUND_BTC_ADDRESS) || payers.includes(FUND_DOG_ADDRESS)) return done({ status: 'unmatched', reason: 'fund_is_payer' })

  // o relógio da trava: o mais cedo entre a primeira vista e o bloco (um pagamento que a
  // varredura só viu tarde mas que já estava num bloco a tempo não perde a trava)
  const lockMs = p.blockTimeMs != null && Number.isFinite(p.blockTimeMs) ? Math.min(p.seenAtMs, p.blockTimeMs) : p.seenAtMs

  const linked = quotes.filter((q) =>
    payers.includes(q.paymentAddress.toLowerCase()) &&
    q.createdAtMs <= p.seenAtMs &&
    lockMs <= q.expiresAtMs + LINK_WINDOW_AFTER_EXPIRY_MS)
  if (linked.length === 0) return done({ status: 'unmatched', reason: 'no_quote' })

  // duas carteiras ordinals ligadas ao mesmo pagador: não se adivinha de quem é o dinheiro
  if (new Set(linked.map((q) => q.ordinalsAddress.toLowerCase())).size > 1) return review('ambiguous_owner')

  const latest = (qs: Quote[]) => qs.reduce((a, b) => (b.createdAtMs > a.createdAtMs ? b : a))
  const inLock = linked.filter((q) => lockMs <= q.expiresAtMs)
  const covering = inLock.filter((q) => p.sats >= q.sats)
  if (covering.length > 0) return { kind: 'quote', quote: latest(covering) }
  if (inLock.length > 0) return review('underpaid_for_quote')
  return { kind: 'block', quote: latest(linked) }
}

/**
 * Decide o destino de UM pagamento. `priceAtBlock` só é chamada quando a trava venceu.
 * Credita pelo valor em DOG da cotação (se visto até `expiresAt` e cobrindo os sats) ou
 * pela cotação do bloco de confirmação (se visto depois). Tudo sob o teto, sem preço
 * confiável não credita.
 */
export async function resolvePayment(
  p: BtcPayment,
  quotes: Quote[],
  priceAtBlock: (blockTimeMs: number) => Promise<PriceAtBlock | null>,
): Promise<Resolution> {
  if (!(p.confirmations >= BTC_MIN_CONFIRMATIONS)) return { status: 'observed', reason: 'confirmations' }
  const m = matchQuote(p, quotes)
  if (m.kind === 'done') return m.resolution

  let dogUsd: number, btcUsd: number, creditDog: number | null
  if (m.kind === 'quote') {
    dogUsd = m.quote.dogUsd
    btcUsd = m.quote.btcUsd
    const computed = dogForSats(p.sats, dogUsd, btcUsd)
    // pagar os sats cotados nunca pode render menos que o degrau, nem por erro de ponto flutuante
    creditDog = computed === null ? null : Math.max(computed, m.quote.dogAmount)
  } else {
    if (p.blockTimeMs == null || !Number.isFinite(p.blockTimeMs)) return { status: 'pending_review', reason: 'price_unavailable', retry: true }
    const px = await priceAtBlock(p.blockTimeMs).catch(() => null)
    const du = positive(px?.dogUsd), bu = positive(px?.btcUsd)
    if (!px || !Number.isFinite(du) || !Number.isFinite(bu) ||
        du < DOG_USD_BOUNDS[0] || du > DOG_USD_BOUNDS[1] || bu < BTC_USD_BOUNDS[0] || bu > BTC_USD_BOUNDS[1]) {
      return { status: 'pending_review', reason: 'price_unavailable', retry: true }
    }
    dogUsd = du
    btcUsd = bu
    creditDog = dogForSats(p.sats, dogUsd, btcUsd)
  }
  if (creditDog === null || !Number.isFinite(creditDog) || creditDog <= 0) return { status: 'pending_review', reason: 'invalid_amount', retry: false }
  if (creditDog > MAX_CREDIT_DOG_PER_PAYMENT) return { status: 'pending_review', reason: 'above_ceiling', retry: false }
  return { status: 'credited', ordinalsAddress: m.quote.ordinalsAddress, quoteId: m.quote.id, creditDog, basis: m.kind, dogUsd, btcUsd }
}

// ── CARTEIRA: DOG + BTC ─────────────────────────────────────────────────────

export type LicenceKey = 'patron' | 'commercial' | 'personal' | 'citizen'

/** o degrau da licença por total em DOG (as mesmas faixas de /api/donate/leaderboard) */
export function licenceFor(totalDog: number): LicenceKey {
  const t = positive(totalDog)
  if (!Number.isFinite(t)) return 'citizen'
  if (t >= LICENCE_DOG.patron) return 'patron'
  if (t >= LICENCE_DOG.commercial) return 'commercial'
  if (t >= LICENCE_DOG.personal) return 'personal'
  return 'citizen'
}

/** DOG + BTC (em DOG) de uma carteira. Entrada inválida vale 0; o BTC tem teto por carteira. */
export function combineWallet(dogTotal: number, btcCreditDog: number): number {
  const dog = Number.isFinite(dogTotal) && dogTotal > 0 ? dogTotal : 0
  const btcRaw = Number.isFinite(btcCreditDog) && btcCreditDog > 0 ? btcCreditDog : 0
  return dog + Math.min(btcRaw, MAX_BTC_CREDIT_DOG_PER_WALLET)
}

export interface Credit { ordinalsAddress: string; creditDog: number }

/** soma os créditos por carteira (chave em minúsculas, como o livro) */
export function sumCredits(credits: Credit[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of credits) {
    const v = positive(c?.creditDog)
    if (!Number.isFinite(v) || typeof c.ordinalsAddress !== 'string' || !c.ordinalsAddress) continue
    const k = c.ordinalsAddress.toLowerCase()
    out.set(k, (out.get(k) ?? 0) + v)
  }
  return out
}

/**
 * Aplica os créditos em BTC ao placar SEM TOCAR no total do fundo: a função não recebe
 * `total_received`, nem as contribuições do livro, nem devolve nada que alimente o B.
 * Cada entrada do placar ganha `btc_dog` e `licence_total`, e a `license` passa a sair do
 * total combinado. Carteira só com BTC aparece em `btcOnly`, fora do placar do fundo.
 */
export function applyBtcCredits<E extends { address: string; total: number; license: string }>(
  entries: E[],
  credits: Credit[],
): {
  entries: (E & { btc_dog: number; licence_total: number })[]
  btcOnly: { address: string; btc_dog: number; licence_total: number; license: LicenceKey }[]
} {
  const sums = sumCredits(credits)
  const used = new Set<string>()
  const out = entries.map((e) => {
    const k = e.address.toLowerCase()
    const btc = Math.min(sums.get(k) ?? 0, MAX_BTC_CREDIT_DOG_PER_WALLET)
    if (sums.has(k)) used.add(k)
    const total = combineWallet(e.total, btc)
    return { ...e, license: btc > 0 ? licenceFor(total) : e.license, btc_dog: btc, licence_total: total }
  })
  const btcOnly = [...sums.entries()]
    .filter(([k]) => !used.has(k))
    .map(([address, btc]) => {
      const b = Math.min(btc, MAX_BTC_CREDIT_DOG_PER_WALLET)
      return { address, btc_dog: b, licence_total: b, license: licenceFor(b) }
    })
    .sort((a, b) => b.btc_dog - a.btc_dog)
  return { entries: out, btcOnly }
}

// ── ENDEREÇO ────────────────────────────────────────────────────────────────

const ADDR_RE = /^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$/

/** bech32 vira minúsculo (canônico); base58 não pode ser normalizado. null = inválido. */
export function normalizeAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  const a = t.toLowerCase().startsWith('bc1') ? t.toLowerCase() : t
  return ADDR_RE.test(a) ? a : null
}
