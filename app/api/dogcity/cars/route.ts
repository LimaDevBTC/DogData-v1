/**
 * GET /api/dogcity/cars?address=<carteira>
 *   -> { address, cars: [{ model, name, source: 'purchase' | 'prize', since }] }
 *
 * A garagem DOG MOTORS de uma carteira: os carros que ela tem no DOG CITY (sem Ordinal: registro neste banco,
 * migração 039). Conta a compra (car_ownership) e o prêmio da corrida aprovado ou entregue (race_prizes da 038).
 * UM de cada modelo por carteira. É esta rota que o jogo lê para pôr o carro na garagem.
 *
 * Só leitura, CORS aberto (dado público, como /api/dogcity/lot-licence), cache curto na borda. Endereço fora da
 * forma: 400. Banco fora ou sem a 039: 503, e quem lê não afirma nada (nunca "sem carro" por engano).
 * Não depende da loja estar aberta: o prêmio da corrida existe com a loja fechada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { comPrazo } from '@/lib/api/prazo'
import { CAR_MODELS } from '@/lib/game/cars/catalog'
import { carsOf } from '@/lib/game/cars/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
const OK_CACHE = { ...CORS, 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' }
const ERR_CACHE = { ...CORS, 'Cache-Control': 'public, s-maxage=5' }

const erro = (error: string, status: number) => NextResponse.json({ error }, { status, headers: ERR_CACHE })

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('address')
  const address = normalizeAddress(raw)
  if (!address) return erro('pass address=<bitcoin mainnet address>', 400)
  return comPrazo(async (signal) => {
    const cars = await carsOf(supabase, address, signal)
    return NextResponse.json(
      { address, cars: cars.map((c) => ({ model: c.model, name: CAR_MODELS[c.model].name, source: c.source, since: c.since })) },
      { headers: OK_CACHE },
    )
  }, { ms: 6_000, falha: () => erro('cars are not available right now', 503) })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } })
}
