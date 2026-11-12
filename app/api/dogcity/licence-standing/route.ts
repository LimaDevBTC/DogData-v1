/**
 * GET /api/dogcity/licence-standing?address=<endereço ordinals>
 *   -> { address, tier, totalDog, lots, unassignedDog, lotsFrom }
 *        tier           personal | commercial | patron | null
 *        lots           [{ lot, tier, totalDog }] os lotes que a carteira guarda agora, ou null no modo antigo
 *        unassignedDog  o crédito que é da carteira e de nenhum lote (espera um lote, ou a escolha)
 *        lotsFrom       'mint' | 'snapshot' | null  de onde veio a lista de lotes
 *
 * LICENÇA NO LOTE (12/11, LICENCA_NO_LOTE_CONTRATO.md): a licença pertence ao lote. `tier` passa a ser a
 * licença MAIS ALTA entre os lotes que a carteira guarda agora (é dela que saem o rifle e o barco no jogo);
 * os lotes vêm do mint (GET /api/mint/holder/<address>) e, com o mint mudo, da reserva do registro selado
 * (o lote do snapshot, `lotsFrom: 'snapshot'`). `totalDog` continua COMPATÍVEL com quem já lia esta rota
 * (a janela de pagamento em BTC e o mint cobram a diferença por ele): um lote = o total do lote mais o
 * crédito livre; nenhum = o crédito livre; vários = o total do lote mais alto (lib/dog/licence-lot.ts).
 *
 * É TAMBÉM UM GATILHO: crédito livre e o mint dizendo que a carteira guarda exatamente um lote, aplica ali na
 * hora (lib/dog/licence-lot-service.ts), o mesmo que a varredura faria na próxima volta. Aplicar é idempotente
 * e condicional no banco (dogcity_licence_apply, migração 037): duas leituras ao mesmo tempo aplicam uma vez.
 *
 * Sem as tabelas da 037: o que era antes (licença por carteira, `lots` null). Banco fora ou prazo estourado:
 * 503 (a tela segue sem o aviso, com o preço cheio). Sem cache: o número muda quando um pagamento é creditado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, normalizeAddress } from '@/lib/dog/licence-btc'
import { standingDaCarteira } from '@/lib/dog/licence-lot-service'
import { holderDoMint, lotLicenceStore, snapshotDoRegistro } from '@/lib/dog/licence-lot-supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const NO_STORE = { 'Cache-Control': 'no-store' }
const STANDING_MS = 4000
const store = lotLicenceStore(supabase)

export async function GET(req: NextRequest) {
  // a mesma normalização da cotação: bech32 minúsculo, base58 intacto
  const address = normalizeAddress(req.nextUrl.searchParams.get('address'))
  if (!address || address === FUND_BTC_ADDRESS || address === FUND_DOG_ADDRESS) {
    return NextResponse.json({ error: 'invalid Bitcoin address' }, { status: 400, headers: NO_STORE })
  }
  const origin = req.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const s = await standingDaCarteira(
    { store, holder: (a) => holderDoMint(a), snapshotLot: snapshotDoRegistro(origin) },
    address,
    { ms: STANDING_MS },
  ).catch(() => null)
  if (!s) return NextResponse.json({ error: 'data backend busy, retry shortly' }, { status: 503, headers: NO_STORE })
  return NextResponse.json(
    { address, tier: s.tier, totalDog: s.totalDog, lots: s.lots, unassignedDog: s.unassignedDog, lotsFrom: s.lotsFrom },
    { headers: NO_STORE },
  )
}
