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
// SUBIR PAGA SÓ A DIFERENÇA (fundador, 25/10; no BTC desde 28/10): para a carteira que já conta
// DOG, o preço de um degrau é `degrau - o que ela já conta` (`dogStillNeeded` de licence-btc.ts),
// em sats pela MESMA função da cotação (`licenceSats`), que é a que o servidor trava e a que o
// código de crédito cobra. O degrau que a carteira já tem não se oferece (`held`).
// ═══════════════════════════════════════════════════════════════════════════
import {
  LICENCE_DOG, LICENCE_TIERS, dogStillNeeded, licenceFor, licenceSats, satsForDog, toAtomos,
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
    sats: preview ? licenceSats(LICENCE_DOG[tier], preview.dogUsd, preview.btcUsd) : null,
  }))
}

export interface WalletStanding {
  /** DOG no fundo + BTC creditado (em DOG), o mesmo total que a escada do servidor lê */
  totalDog: number
  rung: LicenceKey
}

/**
 * Lê GET /api/dogcity/licence-standing. Total ausente, negativo ou não finito: null (a tela não
 * afirma nada e mostra o preço cheio; quem manda no valor cobrado é a cotação, no servidor).
 */
export function parseWalletStanding(json: unknown): WalletStanding | null {
  const j = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null
  const t = j ? j.totalDog : undefined
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return null
  return { totalDog: t, rung: licenceFor(t) }
}

export interface LicenceOffer extends LicencePreset {
  /** 'held': a carteira já está neste degrau ou acima; ninguém compra duas licenças */
  state: 'available' | 'held'
  /** o que a carteira AINDA FALTA em $DOG para este degrau (0 se já tem): o que a cotação cobra */
  neededDog: number
}

/**
 * Os três degraus para a carteira: o que falta em $DOG e os sats disso pela conta da cotação
 * (`licenceSats`). `held` usa a MESMA comparação de `licenceFor` (em átomos), então a tela e o
 * crédito do servidor não discordam do degrau. Sem dados da carteira: preço cheio, tudo disponível.
 */
export function licenceOffers(preview: LicencePreview | null, wallet: WalletStanding | null): LicenceOffer[] {
  const held = wallet ? wallet.totalDog : 0
  return LICENCE_TIERS.map((tier) => {
    const neededDog = dogStillNeeded(tier, held)
    const isHeld = wallet !== null && toAtomos(held) >= toAtomos(LICENCE_DOG[tier])
    return {
      tier,
      dogAmount: LICENCE_DOG[tier],
      neededDog,
      state: isHeld ? 'held' : 'available',
      sats: preview && !isHeld ? licenceSats(neededDog, preview.dogUsd, preview.btcUsd) : null,
    }
  })
}
