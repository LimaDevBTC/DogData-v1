// ═══════════════════════════════════════════════════════════════════════════
// OS ATALHOS DE LICENÇA DA JANELA DE PAGAMENTO EM BTC: a conta pura, sem rede e sem React.
//
// POR QUE EXISTE: o seletor de valor em BTC mostrava 10.000 / 50.000 / 200.000 sats, números
// genéricos sem relação com a licença (28/10). Os atalhos certos são os três degraus
// (Personal 10.000, Commercial 50.000, Patron 500.000 $DOG) e cada um vale, em sats, EXATAMENTE
// o que a cotação trava: `satsForDog(dog do degrau, DOG/USD, BTC/USD)` de licence-btc.ts, a
// mesma função que `buildQuote` (cotação gravada) e o GET de prévia usam. Nada aqui inventa
// preço: a prévia que não bate com a conta é descartada (falha fechada) e o degrau fica sem
// número, nunca com um número errado.
//
// O VALOR EM SATS DE UM DEGRAU É SEMPRE O PREÇO CHEIO. O degrau pago em BTC credita quando
// `sats >= q.sats` da cotação (matchQuote em licence-btc.ts); pagar só a diferença de uma
// subida cairia em `pending_review / underpaid_for_quote`. Por isso este módulo calcula a
// diferença em $DOG (`missingDog`) só como informação, e NÃO a converte em sats a pagar.
// ═══════════════════════════════════════════════════════════════════════════
import {
  LICENCE_DOG, LICENCE_TIERS, combineWallet, licenceFor, satsForDog,
  type LicenceKey, type LicenceTier,
} from './licence-btc'

/** a resposta de GET /api/dogcity/licence-quote, já conferida */
export interface LicencePreview {
  tiers: Record<LicenceTier, number>
  dogUsd: number
  btcUsd: number
}

/**
 * Lê a prévia do servidor e a CONFERE contra a conta de licence-btc.ts. Qualquer campo
 * ausente, não inteiro seguro, ou diferente do `satsForDog` dos mesmos preços: null.
 */
export function parseLicencePreview(json: unknown): LicencePreview | null {
  const j = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null
  if (!j) return null
  const dogUsd = Number(j.dogUsd), btcUsd = Number(j.btcUsd)
  const raw = (j.tiers && typeof j.tiers === 'object' ? j.tiers : null) as Record<string, unknown> | null
  if (!raw || !Number.isFinite(dogUsd) || !Number.isFinite(btcUsd)) return null
  const tiers = {} as Record<LicenceTier, number>
  for (const t of LICENCE_TIERS) {
    const s = raw[t]
    const expected = satsForDog(LICENCE_DOG[t], dogUsd, btcUsd)
    if (typeof s !== 'number' || !Number.isSafeInteger(s) || s <= 0 || expected === null || s !== expected) return null
    tiers[t] = s
  }
  return { tiers, dogUsd, btcUsd }
}

export interface LicencePreset {
  tier: LicenceTier
  /** o valor da licença em $DOG */
  dogAmount: number
  /** os sats que valem `dogAmount` agora; null = sem preço confiável */
  sats: number | null
}

/** Sempre os três degraus, nesta ordem. Sem prévia, sem sats: o botão não inventa número. */
export function licencePresets(preview: LicencePreview | null): LicencePreset[] {
  return LICENCE_TIERS.map((tier) => ({
    tier,
    dogAmount: LICENCE_DOG[tier],
    sats: preview ? preview.tiers[tier] : null,
  }))
}

export interface WalletLicence {
  /** DOG no fundo + BTC creditado (em DOG), o mesmo total que a escada do servidor lê */
  totalDog: number
  rung: LicenceKey
}

/**
 * O que a carteira já tem na escada, lido do placar (/api/donate/leaderboard, sem ?slim).
 * Procura o endereço ordinals em `leaderboard`, `founders` e `btc_licences` e soma como o
 * servidor soma (`combineWallet`: DOG + BTC com o teto por carteira). Carteira que não está em
 * nenhuma lista vale 0. Placar ilegível: null (não se sabe, a tela não afirma nada).
 */
export function walletLicence(board: unknown, address: string | null | undefined): WalletLicence | null {
  const b = (board && typeof board === 'object' ? board : null) as Record<string, unknown> | null
  if (!b || !Array.isArray(b.leaderboard) || typeof address !== 'string' || !address) return null
  const want = address.toLowerCase()
  let best = 0
  for (const key of ['leaderboard', 'founders', 'btc_licences'] as const) {
    const list = Array.isArray(b[key]) ? (b[key] as Array<Record<string, unknown>>) : []
    for (const e of list) {
      if (typeof e?.address !== 'string' || e.address.toLowerCase() !== want) continue
      best = Math.max(best, combineWallet(Number(e.total), Number(e.btc_dog)))
    }
  }
  return { totalDog: best, rung: licenceFor(best) }
}

export interface LicenceOffer extends LicencePreset {
  /** 'held': a carteira já está neste degrau ou acima; ninguém compra duas licenças */
  state: 'available' | 'held'
  /** quanto falta em $DOG para a carteira chegar a este degrau (0 se já chegou); só informação */
  missingDog: number
}

/**
 * Cruza os atalhos com o que a carteira já tem. `held` usa a MESMA comparação de `licenceFor`
 * (total >= degrau), então a tela e o crédito do servidor não discordam do degrau.
 */
export function licenceOffers(presets: LicencePreset[], wallet: WalletLicence | null): LicenceOffer[] {
  const total = wallet ? wallet.totalDog : 0
  return presets.map((p) => ({
    ...p,
    state: wallet && total >= p.dogAmount ? 'held' : 'available',
    missingDog: Math.max(0, p.dogAmount - total),
  }))
}
