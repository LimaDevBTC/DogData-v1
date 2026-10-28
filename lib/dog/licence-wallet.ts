// ═══════════════════════════════════════════════════════════════════════════
// A LICENÇA DE UMA CARTEIRA, SEM BAIXAR O PLACAR INTEIRO (28/10/2026).
//
// /api/donate/leaderboard monta o livro do fundo com TODAS as transações e ~50 KB
// de resposta. A casa da licença (lookup da landing e /profile) só precisa do
// degrau de UMA carteira, então a conta aqui é a MESMA, sobre menos linhas:
//   * $DOG: as transações que ligam o fundo à carteira (`addresses @> {fundo,
//     carteira}`, índice GIN, o mesmo filtro de lib/referral/sources.ts), passadas
//     por buildLedger() de founders-ledger.ts. A contribuição de cada transação só
//     depende dela mesma (partilha de vários remetentes incluída), então o total
//     da carteira sobre este recorte é igual ao do livro inteiro;
//   * BTC: dogcity_btc_payments com status 'credited' desta carteira (índice
//     parcial por ordinals_address), somado por applyBtcCredits() de
//     licence-btc.ts, a mesma função do placar (teto por carteira incluído);
//   * o degrau: licenceFor() de licence-btc.ts, as mesmas faixas do placar
//     (Personal 10.000, Commercial 50.000, Patron 500.000).
//
// FALHA FECHADA E QUIETA: banco fora ou prazo estourado devolve null ("não sei
// agora") e a tela segue como sempre foi; nunca inventa licença. Sem a tabela de
// BTC (ou com ela falhando), conta só o $DOG, como o placar: nunca credita a mais.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLedger, type TxRow } from './founders-ledger'
import {
  FUND_DOG_ADDRESS, applyBtcCredits, isTier, licenceFor,
  type Credit, type LicenceTier,
} from './licence-btc'

export interface WalletLicence {
  /** o degrau, ou null abaixo de Personal (doou menos de 10.000 $DOG, ou nada) */
  tier: LicenceTier | null
}

/**
 * Pura: o degrau de UMA carteira a partir das linhas que a ligam ao fundo e dos
 * créditos em BTC. Linhas e créditos de outras carteiras são ignorados.
 */
export function licenceOfWallet(rows: TxRow[], address: string, credits: Credit[]): WalletLicence {
  const me = address.toLowerCase()
  // as posições no bloco só ordenam os founders; o total e o degrau não dependem delas
  const ledger = buildLedger(rows, FUND_DOG_ADDRESS, { licenseFor: licenceFor, posicoes: {} })
  const mine = ledger.leaderboard.find((e) => e.address === me)
  const entry = { address: me, total: mine?.total ?? 0, license: mine?.license ?? 'citizen' }
  const own = credits.filter((c) => typeof c?.ordinalsAddress === 'string' && c.ordinalsAddress.toLowerCase() === me)
  const [e] = applyBtcCredits([entry], own).entries
  return { tier: isTier(e.license) ? e.license : null }
}

const PAGE = 1000
const MAX_PAGES = 20 // 20.000 transações de uma carteira com o fundo: acima disso é defeito, não doador

async function rowsOf(db: SupabaseClient, address: string, signal: AbortSignal): Promise<TxRow[]> {
  const rows: TxRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE
    const { data, error } = await db
      .from('dog_transactions')
      .select('id, txid, block_height, timestamp, senders, receivers')
      .contains('addresses', [FUND_DOG_ADDRESS, address])
      .order('block_height', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
      .abortSignal(signal)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as TxRow[]))
    if (!data || data.length < PAGE) return rows
  }
  throw new Error('too many fund transactions for one wallet')
}

async function creditsOf(db: SupabaseClient, address: string, signal: AbortSignal): Promise<Credit[]> {
  try {
    const { data, error } = await db
      .from('dogcity_btc_payments')
      .select('ordinals_address, credit_dog')
      .eq('status', 'credited')
      .eq('ordinals_address', address)
      .abortSignal(signal)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({ ordinalsAddress: String(r.ordinals_address ?? ''), creditDog: Number(r.credit_dog) }))
  } catch (e) {
    // o mesmo tratamento do placar: sem BTC, a licença sai só do $DOG
    if (!signal.aborted) console.error('[licence-wallet] btc credits unavailable:', (e as Error)?.message)
    return []
  }
}

/**
 * O degrau de uma carteira, lido do banco. `address` já normalizado pela rota
 * (bech32 minúsculo, base58 intacto), como o registro e a tabela de BTC gravam.
 * null = não deu para saber agora (banco fora, prazo estourado); nunca lança.
 */
export async function licencaDaCarteira(
  db: SupabaseClient,
  address: string,
  opts: { ms?: number; signal?: AbortSignal } = {},
): Promise<WalletLicence | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.ms ?? 2500)
  const fora = () => ctrl.abort()
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort()
    else opts.signal.addEventListener('abort', fora, { once: true })
  }
  try {
    const [rows, credits] = await Promise.all([rowsOf(db, address, ctrl.signal), creditsOf(db, address, ctrl.signal)])
    if (ctrl.signal.aborted) return null
    return licenceOfWallet(rows, address, credits)
  } catch (e) {
    if (!ctrl.signal.aborted) console.error('[licence-wallet] unavailable:', (e as Error)?.message)
    return null
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', fora)
  }
}
