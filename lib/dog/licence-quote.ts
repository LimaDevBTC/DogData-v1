// ═══════════════════════════════════════════════════════════════════════════
// CRIAR UMA COTAÇÃO DE LICENÇA EM BTC: validação, mediana, trava, gravação.
// A rota POST /api/dogcity/licence-quote só liga isto ao banco e às corretoras.
//
// A cotação liga o endereço de PAGAMENTO ao endereço ORDINALS da mesma carteira: é assim
// que o DOG (que chega ao endereço ordinals) e o BTC (que sai do endereço de pagamento)
// da mesma carteira se somam no degrau da licença. Xverse, UniSat e OKX têm os dois
// endereços diferentes; na Kray e às vezes na UniSat são o mesmo.
//
// Falha fechada: sem fontes independentes suficientes, 503 e NENHUMA linha gravada.
//
// SUBIR PAGA SÓ A DIFERENÇA (28/10): a cotação cobre o que a carteira AINDA FALTA para o degrau,
// `degrau - DOG que ela já conta` (DOG do livro + BTC creditado, lido do banco pela mesma conta do
// placar e passado em `heldDog`). A diferença vai na coluna `dog_amount`, que já existia. Sem saber
// o que a carteira já tem não há cotação (503); carteira que já tem o degrau: 409, nada gravado.
//
// LICENÇA NO LOTE (12/11): a cotação pode levar `lotId`, o lote que ela paga. Então `heldDog` é o que
// o LOTE já soma (subir paga a diferença do lote, lib/dog/licence-lot-service.ts), a carteira tem de
// guardar o lote pelo mint (senão 403, nada gravado), o 409 "já tem" é do lote, e a cotação gravada
// leva o lote (coluna `lot_id`, migração 037): o crédito do pagamento cai direto nele. Lote do setor 8
// (empresa) nunca leva licença: 400. Sem `lotId` a rota segue aceitando o pedido antigo.
// ═══════════════════════════════════════════════════════════════════════════
import {
  FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, LICENCE_DOG, buildQuote, isTier, normalizeAddress,
  type Quote, type SourceSample,
} from './licence-btc'
import { lotTakesLicence, normalizeLotId } from './licence-lot'
import type { Medians } from './price-sources'

/** cotações por endereço de pagamento por hora: segura quem fura a mediana em loop */
export const MAX_QUOTES_PER_PAYMENT_PER_HOUR = 20

export interface QuoteStore {
  countSince(paymentAddress: string, sinceMs: number): Promise<number>
  insert(q: Quote): Promise<void>
}

export interface PublicQuote {
  id: string
  tier: Quote['tier']
  /** o que a carteira AINDA FALTA em $DOG (o degrau menos `heldDog`): o que esta cotação cobre */
  dogAmount: number
  /** o valor cheio do degrau em $DOG */
  licenceDog: number
  /** o que a carteira já contava ao cotar: DOG do livro + BTC creditado */
  heldDog: number
  sats: number
  dogUsd: number
  btcUsd: number
  sources: SourceSample[]
  expiresAt: string
  /** o relógio do servidor na hora da cotação: a tela conta o prazo por ele, não pelo relógio do aparelho */
  serverTime: string
  /** onde pagar: o endereço Bitcoin do fundo */
  payTo: string
  /** o lote que esta cotação paga, quando o pedido nomeou um */
  lotId?: string
}

export type CreateQuoteResult =
  | { ok: true; status: 200; quote: PublicQuote }
  | { ok: false; status: 400 | 403 | 409 | 429 | 503; error: string }

export async function createQuote(
  deps: {
    store: QuoteStore
    medians: () => Promise<Medians>
    /**
     * DOG que JÁ CONTA para o degrau: sem lote, o da carteira (livro + BTC creditado, ou o `totalDog`
     * compatível do standing); com lote, o que o LOTE soma. null = não se sabe agora; 'not_holder' = a
     * carteira não guarda o lote.
     */
    heldDog: (ordinalsAddress: string, lotId: string | null) => Promise<number | null | 'not_holder'>
    nowMs: number
    newId: () => string
  },
  body: unknown,
): Promise<CreateQuoteResult> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (!isTier(b.tier)) return { ok: false, status: 400, error: 'tier must be personal, commercial or patron' }
  const ordinalsAddress = normalizeAddress(b.ordinalsAddress)
  const paymentAddress = normalizeAddress(b.paymentAddress)
  if (!ordinalsAddress || !paymentAddress) return { ok: false, status: 400, error: 'ordinalsAddress and paymentAddress must be Bitcoin mainnet addresses' }
  const fund = [FUND_BTC_ADDRESS, FUND_DOG_ADDRESS]
  if (fund.includes(ordinalsAddress) || fund.includes(paymentAddress)) return { ok: false, status: 400, error: 'the fund address cannot be a wallet address' }
  // o lote é opcional (pedido antigo); vindo, tem de ser um id de lote que leva licença
  const lotGiven = b.lotId !== undefined && b.lotId !== null && b.lotId !== ''
  const lotId = lotGiven ? normalizeLotId(b.lotId) : null
  if (lotGiven && !lotId) return { ok: false, status: 400, error: 'lotId must be a DogCity lot id' }
  if (lotId && !lotTakesLicence(lotId)) return { ok: false, status: 400, error: 'this lot does not take a building licence' }

  if ((await deps.store.countSince(paymentAddress, deps.nowMs - 3_600_000)) >= MAX_QUOTES_PER_PAYMENT_PER_HOUR) {
    return { ok: false, status: 429, error: 'too many quotes for this address, try again later' }
  }

  const [m, held] = await Promise.all([deps.medians().catch(() => null), deps.heldDog(ordinalsAddress, lotId).catch(() => null)])
  if (held === 'not_holder') return { ok: false, status: 403, error: 'this wallet does not hold this lot' }
  if (!m) return { ok: false, status: 503, error: 'no reliable quote right now' }
  // sem saber o que a carteira já conta não se cota: pedir o preço cheio a quem só deve a diferença
  // (ou cotar um degrau que ela já tem) é o erro que esta regra existe para não cometer
  if (held === null || !Number.isFinite(held) || held < 0) return { ok: false, status: 503, error: 'no reliable quote right now' }
  const built = buildQuote({ id: deps.newId(), tier: b.tier, ordinalsAddress, paymentAddress, dog: m.dog, btc: m.btc, nowMs: deps.nowMs, heldDog: held, lotId })
  if (!built.ok) {
    if (built.reason === 'already_held') return { ok: false, status: 409, error: lotId ? 'this lot already holds this licence' : 'this wallet already holds this licence' }
    return { ok: false, status: 503, error: 'no reliable quote right now' }
  }

  // gravar ANTES de responder: uma cotação que a pessoa viu e nós não temos nunca credita
  try {
    await deps.store.insert(built.quote)
  } catch {
    return { ok: false, status: 503, error: 'no reliable quote right now' }
  }
  const q = built.quote
  return {
    ok: true,
    status: 200,
    quote: {
      id: q.id, tier: q.tier, dogAmount: q.dogAmount, licenceDog: LICENCE_DOG[q.tier], heldDog: held, sats: q.sats, dogUsd: q.dogUsd, btcUsd: q.btcUsd,
      sources: q.sources, expiresAt: new Date(q.expiresAtMs).toISOString(), serverTime: new Date(deps.nowMs).toISOString(), payTo: FUND_BTC_ADDRESS,
      ...(q.lotId ? { lotId: q.lotId } : {}),
    },
  }
}
