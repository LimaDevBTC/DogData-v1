/**
 * GET /api/cron/car-pay   (cron; NÃO está no vercel.json: quem liga é o fundador, ver PROGRESSO_carros_compra.md)
 *
 * A varredura dos pagamentos dos carros da DOG MOTORS:
 *   BTC   no CAR_FUND_BTC_ADDRESS (mempool.space), casado pelo endereço pagador dentro da trava do pedido;
 *   $DOG  no CAR_FUND_DOG_ADDRESS (as linhas de dog_transactions do scanner), casado pelo remetente E pelo valor
 *         exato do pedido (preço + sufixo), consumido por txid + saída.
 * Credita com 6 confirmações, pela função dogcity_car_credit (pagamento + posse numa transação só). Fora de par
 * (a menor, a maior, vencido, pagador trocado, ambíguo, acima do teto, já tem o modelo) vai para pending_review.
 * Regras: lib/game/cars/payment.ts e sweep.ts.
 *
 * Protegida por CRON_SECRET (Authorization: Bearer ...). Sem CRON_SECRET a rota recusa tudo. LOJA FECHADA (sem
 * CAR_FUND_BTC_ADDRESS e CAR_FUND_DOG_ADDRESS válidos, ou preços provisórios): responde 200 `sales_closed` e não
 * faz NADA (nem lê a rede, nem o banco). Não toca nas tabelas da licença, no livro dos founders nem no bloco B.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase'
import { FUND_BTC_ADDRESS, FUND_DOG_ADDRESS } from '@/lib/dog/licence-btc'
import type { FetchLike } from '@/lib/dog/price-sources'
import { eventoSeguranca } from '@/lib/seguranca/evento'
import { carSales } from '@/lib/game/cars/config'
import { BLOCK_TIME_SLACK_MS, DOG_BLOCK_GRACE_MS, DOG_LATE_REVIEW_MS, DOG_ORDER_LOCK_MS } from '@/lib/game/cars/order'
import { dogPaymentsFromRow, fundList, readBtcChain, sweepCars, type ChainPayment } from '@/lib/game/cars/sweep'
import { carSweepStore, dogIndexTip, dogRowsTouching } from '@/lib/game/cars/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' }
const nofetch = (u: string, i?: any) => fetch(u, i) as ReturnType<FetchLike>

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

/** até onde, para trás, um pagamento em $DOG ainda pode casar com um pedido */
const DOG_LOOKBACK_MS = DOG_ORDER_LOCK_MS + DOG_BLOCK_GRACE_MS + DOG_LATE_REVIEW_MS + BLOCK_TIME_SLACK_MS

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    eventoSeguranca('cron_negado', req)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }
  const sales = carSales()
  if (!sales.open) return NextResponse.json({ ok: true, skipped: 'sales_closed', reason: sales.reason }, { headers: NO_STORE })

  const funds = fundList(FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, sales.btcAddress, sales.dogAddress)
  const nowMs = Date.now()

  // as duas pontas leem em paralelo; uma fora não impede a outra (o que não foi lido nunca vira carro)
  const [btcRes, dogRes] = await Promise.allSettled([
    readBtcChain(nofetch, sales.btcAddress, funds),
    (async () => {
      const [tip, read] = await Promise.all([dogIndexTip(supabase), dogRowsTouching(supabase, sales.dogAddress, nowMs - DOG_LOOKBACK_MS)])
      const payments: ChainPayment[] = []
      let skipped = 0
      for (const row of read.rows) {
        const r = dogPaymentsFromRow(row, sales.dogAddress, funds)
        payments.push(...r.payments)
        skipped += r.skipped
      }
      if (read.truncated) console.warn('[cron/car-pay] dog rows truncated: older rows wait for the next sweep')
      return { tip, payments, skipped, truncated: read.truncated }
    })(),
  ])
  if (btcRes.status === 'rejected') console.error('[cron/car-pay] btc read failed:', (btcRes.reason as Error)?.message)
  if (dogRes.status === 'rejected') console.error('[cron/car-pay] dog read failed:', (dogRes.reason as Error)?.message)
  const btc = btcRes.status === 'fulfilled' ? btcRes.value : null
  const dog = dogRes.status === 'fulfilled' ? dogRes.value : null
  if (!btc && !dog) return NextResponse.json({ ok: false, error: 'sweep failed' }, { status: 502, headers: NO_STORE })

  try {
    const result = await sweepCars({ nowMs, funds, btc, dog: dog ? { tip: dog.tip, payments: dog.payments } : null, store: carSweepStore(supabase) })
    return NextResponse.json({
      ok: true,
      btc: btc ? { tip: btc.tip, seen: btc.payments.length } : { error: 'read failed' },
      dog: dog ? { tip: dog.tip, seen: dog.payments.length, skippedRows: dog.skipped, truncated: dog.truncated } : { error: 'read failed' },
      ...result,
    }, { headers: NO_STORE })
  } catch (err) {
    console.error('[cron/car-pay] error:', (err as Error)?.message)
    return NextResponse.json({ ok: false, error: 'sweep failed' }, { status: 502, headers: NO_STORE })
  }
}
