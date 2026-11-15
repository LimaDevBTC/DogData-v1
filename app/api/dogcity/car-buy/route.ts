/**
 * DOG MOTORS: comprar um carro do DOG CITY com DC POINTS (decisão do fundador de 15/11/2026). Não é dinheiro de verdade:
 * DC Points são pontos do jogo (não se compram, não se transferem, nunca viram $DOG). A venda em $DOG/BTC
 * (/api/dogcity/car-quote) segue atrás de CAR_SALES_OPEN, desligada.
 *
 * GET  /api/dogcity/car-buy   (pública, cache 30 s)
 *   -> 200 { currency: 'dc_points', models: [{ id, name, class, priceDc, available }] }
 *   `available` = ativo no banco e car_models.price_dc igual ao preço do código. 503 banco fora.
 *
 * POST /api/dogcity/car-buy { model, ref }   (cookie de sessão dg_wallet)
 *   -> 200 { ok, model, name, priceDc, balance, duplicate }
 *   Numa transação só (dc_points_buy_car, migração 042): trava a carteira e carteira + modelo, confere o modelo ativo, o
 *   preço do banco igual ao do código, um de cada modelo por carteira (compra em DC, compra antiga em cripto e prêmio da
 *   corrida contam) e o saldo; debita e grava a posse com origem 'dc'. `ref` idempotente. O preço NUNCA vem do corpo.
 *   400 invalid_json | invalid_body | invalid_model | invalid_ref; 401; 402 insufficient_points { balance, priceDc, missing };
 *   409 already_owned | model_not_for_sale | ref_conflict; 413; 429 (10 por minuto por carteira, e o freio de IP);
 *   503 catalog_mismatch (preço do banco diferente do código: a venda fecha sozinha) | unavailable.
 *
 * Depois do 200 a garagem (GET /api/dogcity/cars?address=) já traz o carro com source 'dc'.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comPrazo } from '@/lib/api/prazo'
import { passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { buyCarWithPoints, carDcShowroom } from '@/lib/game/points/service'
import { carDcRows, pointsStore } from '@/lib/game/points/store'
import { json, rateLimited, readBody, unauthenticated, unavailable, walletOf, walletOverLimit } from '@/lib/game/points/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

/** compras por IP por hora (cada uma é uma transação no banco); a carteira tem o próprio teto */
const TETO_IP_HORA = 120
const PUBLIC_CACHE = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' }

export async function GET() {
  return comPrazo(async (signal) => {
    const rows = await carDcRows(supabase, signal)
    return NextResponse.json(carDcShowroom(rows), { headers: PUBLIC_CACHE })
  }, { ms: 6_000, falha: () => NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'public, s-maxage=5' } }) })
}

export async function POST(req: NextRequest) {
  if (await passouDoTeto(req, 'carbuy', TETO_IP_HORA, 3600)) return respostaFreio(3600)
  return comPrazo(async (signal) => {
    const wallet = await walletOf(req)
    if (!wallet) return unauthenticated()
    if (await walletOverLimit('carBuy', wallet)) return rateLimited()
    const body = await readBody(req)
    if (!body.ok) return body.res
    const r = await buyCarWithPoints(pointsStore(supabase, signal), wallet, body.value)
    return json(r.body, r.status)
  }, { ms: 8_000, falha: unavailable })
}
