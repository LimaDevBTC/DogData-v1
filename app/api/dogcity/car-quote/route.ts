/**
 * DOG MOTORS: comprar um carro do DOG CITY em $DOG ou BTC (sem Ordinal: o carro fica registrado por carteira).
 *
 * GET  /api/dogcity/car-quote
 *   -> { models: [{ id, name, class, priceDog, available, sats }], dogUsd, btcUsd, sources, asOf, lockMinutes }
 *   Só a PRÉVIA para a vitrine: o preço em $DOG de cada modelo e os sats de agora, sem gravar nada e sem travar
 *   nada. Sem cotação confiável os sats vêm null (em $DOG ainda se compra). Cache de 30 s na CDN.
 *
 * POST /api/dogcity/car-quote   { model, currency: 'btc' | 'dog', paymentAddress? }   (cookie de sessão dg_wallet)
 *   -> { id, model, name, currency, priceDog, payTo, payerAddress, expiresAt, serverTime,
 *        sats, dogUsd, btcUsd, sources            (BTC: pagar exatamente `sats` de `payerAddress` até `expiresAt`)
 *        dogExact, dogExactAtoms }                ($DOG: enviar EXATAMENTE `dogExact` de `payerAddress`)
 *   Cotação + pedido, gravado antes de responder. Quem fica com o carro é a carteira da SESSÃO (nunca um endereço
 *   do corpo). 401 sem sessão, 400 por campo, 409 `already_owned` (a carteira já tem o modelo, por compra ou prêmio
 *   da corrida), 409 `model_not_for_sale`, 429 (freio de IP e tetos por carteira/pagador), 503 sem cotação confiável.
 *
 * LOJA FECHADA (sem CAR_FUND_BTC_ADDRESS e CAR_FUND_DOG_ADDRESS válidos, ou com preços provisórios): as duas
 * respondem 503 `sales_closed` e nada é gravado. Regras: lib/game/cars/order.ts. O crédito é da varredura
 * /api/cron/car-pay. Nada aqui toca as tabelas da licença, o livro dos founders ou o bloco B.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomInt, randomUUID } from 'node:crypto'
import { supabase } from '@/lib/supabase'
import { sessionWallet } from '@/lib/game/session'
import { spotMedians, type FetchLike, type Medians } from '@/lib/dog/price-sources'
import { passouDoTeto, respostaFreio, lerJsonComTeto } from '@/lib/seguranca/freio'
import { comPrazo } from '@/lib/api/prazo'
import { CAR_MODEL_IDS, CAR_MODELS } from '@/lib/game/cars/catalog'
import { carSales } from '@/lib/game/cars/config'
import { BTC_ORDER_LOCK_MS, DOG_SUFFIX_MAX, DOG_SUFFIX_MIN, carSats, createCarOrder } from '@/lib/game/cars/order'
import { carOrderStore } from '@/lib/game/cars/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

/** pedidos por IP por hora: cada pedido é uma linha no banco */
const TETO_IP_HORA = 60
const CORPO_MAX = 2_048
const PRAZO_MS = 10_000

const NO_STORE = { 'Cache-Control': 'no-store' }
const PREVIEW_CACHE = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' }
const ERR_CACHE = { 'Cache-Control': 'public, s-maxage=10' }

const nofetch = (u: string, i?: any) => fetch(u, i) as ReturnType<FetchLike>

// a mediana de 10 s serve a rajada da vitrine sem martelar as corretoras (a mesma da licença)
const MEDIAN_TTL_MS = 10_000
let memo: { at: number; m: Medians } | null = null
async function medians(): Promise<Medians> {
  if (memo && Date.now() - memo.at < MEDIAN_TTL_MS) return memo.m
  const m = await spotMedians(nofetch)
  memo = { at: Date.now(), m }
  return m
}

const store = carOrderStore(supabase)

export async function POST(req: NextRequest) {
  const sales = carSales()
  if (!sales.open) return NextResponse.json({ error: 'sales_closed' }, { status: 503, headers: NO_STORE })
  if (await passouDoTeto(req, 'carquote', TETO_IP_HORA, 3600)) return respostaFreio(3600)
  return comPrazo(async () => {
    const wallet = await sessionWallet(req).catch(() => null)
    if (!wallet) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE })
    const corpo = await lerJsonComTeto(req, CORPO_MAX)
    if (!corpo.ok) return NextResponse.json({ error: corpo.status === 413 ? 'body too large' : 'invalid json' }, { status: corpo.status, headers: NO_STORE })
    const r = await createCarOrder({
      sales, store, medians, nowMs: Date.now(), newId: () => randomUUID(),
      randomSuffix: () => randomInt(DOG_SUFFIX_MIN, DOG_SUFFIX_MAX + 1),
    }, wallet, corpo.valor)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE })
    return NextResponse.json(r.order, { headers: NO_STORE })
  }, { ms: PRAZO_MS, falha: () => NextResponse.json({ error: 'no reliable quote right now' }, { status: 503, headers: NO_STORE }) })
}

export async function GET() {
  const sales = carSales()
  if (!sales.open) return NextResponse.json({ error: 'sales_closed' }, { status: 503, headers: ERR_CACHE })
  return comPrazo(async (signal) => {
    const [rowsRes, m] = await Promise.all([
      supabase.from('car_models').select('id, price_dog, active').abortSignal(signal),
      medians().catch(() => null),
    ])
    if (rowsRes.error) throw new Error(rowsRes.error.message)
    const db = new Map<string, { price: number; active: boolean }>()
    for (const r of rowsRes.data ?? []) db.set(String((r as any).id), { price: Number((r as any).price_dog), active: (r as any).active === true })
    const dog = m && m.dog.ok ? m.dog : null
    const btc = m && m.btc.ok ? m.btc : null
    const models = CAR_MODEL_IDS.map((id) => {
      const c = CAR_MODELS[id]
      const row = db.get(id)
      // à venda só quando o código e o banco dão o MESMO preço e o modelo está ativo (a mesma regra do POST)
      const available = !!row && row.active && row.price === c.priceDog
      const sats = available && dog && btc ? carSats(c.priceDog, dog.price, btc.price) : null
      return { id, name: c.name, class: c.class, priceDog: c.priceDog, available, sats }
    })
    const both = dog && btc
    return NextResponse.json({
      models,
      dogUsd: both ? dog.price : null,
      btcUsd: both ? btc.price : null,
      sources: both ? [...dog.sources, ...btc.sources] : [],
      asOf: new Date().toISOString(),
      lockMinutes: BTC_ORDER_LOCK_MS / 60_000,
    }, { headers: PREVIEW_CACHE })
  }, { ms: PRAZO_MS, falha: () => NextResponse.json({ error: 'no reliable quote right now' }, { status: 503, headers: ERR_CACHE }) })
}
