/**
 * DOG MOTORS: o estado de UM pedido de carro, para a janela de compra acompanhar o pagamento.
 *
 * GET /api/dogcity/car-order?id=<uuid>[&txid=<64 hex>]     (cookie de sessão dg_wallet)
 *   -> { id, model, currency, expiresAt, serverTime, stage, reason, warnings, confirmations, needed, txid }
 *   Só LEITURA. Só a carteira da SESSÃO vê o pedido dela (outro id, ou pedido de outra carteira: 404). O txid é o que a
 *   carteira devolveu ao transmitir; o servidor lê a transação no mempool.space e compara com o pedido GRAVADO (o
 *   endereço que recebe, o pagador e os sats), nunca com o que o cliente diz. Estágios e avisos: lib/game/cars/order-status.ts.
 *   A rede não respondeu: o estágio sai sem a leitura dela (nunca "pago" por suposição). Banco fora: 503.
 *
 * Quem dá o carro é a varredura (/api/cron/car-pay) com a função do banco; esta rota não grava nada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sessionWallet } from '@/lib/game/session'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { comPrazo } from '@/lib/api/prazo'
import { isCarModel } from '@/lib/game/cars/catalog'
import { checkTx, mostFinal, orderStatus, type PaymentRowStatus, type TxCheck } from '@/lib/game/cars/order-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TXID = /^[0-9a-f]{64}$/
/** a janela consulta a cada 15 s enquanto está aberta: 600 por hora por IP sobra para isso e barra o uso como proxy */
const TETO_IP_HORA = 600
const MEMPOOL = 'https://mempool.space/api'
const PAY_STATUS: ReadonlySet<string> = new Set(['observed', 'credited', 'unmatched', 'pending_review'])

const erro = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE })

async function mempool(path: string, signal: AbortSignal): Promise<{ status: number; body: any }> {
  const r = await fetch(`${MEMPOOL}${path}`, { signal, cache: 'no-store' })
  if (r.status === 404 || r.status === 400) return { status: 404, body: null }
  if (!r.ok) throw new Error(`mempool ${r.status}`)
  const text = await r.text()
  try { return { status: 200, body: JSON.parse(text) } } catch { return { status: 200, body: text } }
}

/** a transação contra o pedido; null quando a rede não respondeu (a tela não afirma nada da rede) */
async function readTx(txid: string, payTo: string, payer: string, parent: AbortSignal): Promise<TxCheck | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6_000)
  const stop = () => ctrl.abort()
  parent.addEventListener('abort', stop)
  try {
    const [tx, tip] = await Promise.all([mempool(`/tx/${txid}`, ctrl.signal), mempool('/blocks/tip/height', ctrl.signal).catch(() => null)])
    if (tx.status === 404) return { found: false, toPayTo: 0, fromPayer: false, confirmed: false, confirmations: 0 }
    const h = tip && tip.status === 200 ? Number(tip.body) : NaN
    return checkTx(tx.body, payTo, payer, Number.isSafeInteger(h) && h > 0 ? h : null)
  } catch {
    return null
  } finally {
    clearTimeout(t)
    parent.removeEventListener('abort', stop)
  }
}

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') ?? '').trim().toLowerCase()
  const txidRaw = (req.nextUrl.searchParams.get('txid') ?? '').trim().toLowerCase()
  if (!UUID.test(id)) return erro('pass id=<order id>', 400)
  if (txidRaw && !TXID.test(txidRaw)) return erro('txid must be 64 hex characters', 400)
  const txid = txidRaw || null
  if (await passouDoTeto(req, 'carorder', TETO_IP_HORA, 3600)) return respostaFreio(3600)

  return comPrazo(async (signal) => {
    const wallet = normalizeAddress(await sessionWallet(req).catch(() => null))
    if (!wallet) return erro('unauthenticated', 401)

    const { data: row, error } = await supabase.from('car_orders')
      .select('id, model, wallet, currency, sats, pay_to, payer_address, expires_at')
      .eq('id', id).eq('wallet', wallet).abortSignal(signal).maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) return erro('order not found', 404)
    const o = row as any
    const exp = Date.parse(String(o.expires_at))
    const payTo = normalizeAddress(o.pay_to)
    const payer = normalizeAddress(o.payer_address)
    const sats = o.sats == null ? null : Number(o.sats)
    if (!isCarModel(o.model) || (o.currency !== 'btc' && o.currency !== 'dog') || !Number.isFinite(exp) || !payTo || !payer
      || (o.currency === 'btc' && !(Number.isSafeInteger(sats) && (sats as number) > 0))) {
      throw new Error('car_orders: unreadable row')
    }

    const [creditedRes, payRes] = await Promise.all([
      supabase.from('car_payments').select('txid', { count: 'exact', head: true })
        .eq('order_id', id).eq('status', 'credited').abortSignal(signal),
      txid
        ? supabase.from('car_payments').select('status, review_reason').eq('currency', o.currency).eq('txid', txid).abortSignal(signal)
        : Promise.resolve({ data: [], error: null } as { data: any[]; error: null }),
    ])
    if (creditedRes.error) throw new Error(creditedRes.error.message)
    if (payRes.error) throw new Error(payRes.error.message)
    const credited = (creditedRes.count ?? 0) > 0
    const rows = (payRes.data ?? [])
      .filter((r: any) => PAY_STATUS.has(r?.status))
      .map((r: any) => ({ status: r.status as PaymentRowStatus, reviewReason: typeof r.review_reason === 'string' ? r.review_reason : null }))
    const payment = mostFinal(rows)

    const tx = txid && !credited ? await readTx(txid, payTo, payer, signal) : null
    const now = Date.now()
    const st = orderStatus({
      nowMs: now,
      order: { currency: o.currency, sats: o.currency === 'btc' ? (sats as number) : null, expiresAtMs: exp },
      credited, payment, tx, hasTxid: !!txid,
    })
    return NextResponse.json({
      id, model: o.model, currency: o.currency, expiresAt: new Date(exp).toISOString(), serverTime: new Date(now).toISOString(),
      txid, ...st, network: txid && !credited ? (tx ? 'read' : 'unavailable') : 'not_needed',
    }, { headers: NO_STORE })
  }, { ms: 10_000, falha: () => erro('order status is not available right now', 503) })
}
