/**
 * GET /api/dogcity/licence-standing?address=<endereço ordinals>
 *   -> { address, tier, totalDog }   (tier: personal | commercial | patron | null)
 *
 * O que a janela de pagamento em BTC precisa de UMA carteira (28/10): o degrau que ela já tem e o
 * total em $DOG que o sustenta (DOG do livro do fundo + BTC creditado, com o teto por carteira), para
 * mostrar a DIFERENÇA até os degraus de cima. É a conta do placar sobre as linhas desta carteira
 * (lib/dog/licence-wallet.ts), sem baixar /api/donate/leaderboard inteiro.
 *
 * Só leitura e só para exibir: a cotação (POST /api/dogcity/licence-quote) refaz esta conta no servidor
 * a cada pedido, e é ela que manda no valor cobrado. Banco fora ou prazo estourado: 503 (a tela segue
 * sem o aviso, com o preço cheio). Sem cache: o número muda quando um pagamento é creditado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, normalizeAddress } from '@/lib/dog/licence-btc'
import { posicaoDaCarteira } from '@/lib/dog/licence-wallet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const NO_STORE = { 'Cache-Control': 'no-store' }
const STANDING_MS = 4000

export async function GET(req: NextRequest) {
  // a mesma normalização da cotação: bech32 minúsculo, base58 intacto
  const address = normalizeAddress(req.nextUrl.searchParams.get('address'))
  if (!address || address === FUND_BTC_ADDRESS || address === FUND_DOG_ADDRESS) {
    return NextResponse.json({ error: 'invalid Bitcoin address' }, { status: 400, headers: NO_STORE })
  }
  const s = await posicaoDaCarteira(supabase, address, { ms: STANDING_MS }).catch(() => null)
  if (!s) return NextResponse.json({ error: 'data backend busy, retry shortly' }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ address, tier: s.tier, totalDog: s.totalDog }, { headers: NO_STORE })
}
