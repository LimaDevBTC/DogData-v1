import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { DONATION_WALLET } from '@/app/dogcity/dogcity-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/donate/verify?txid=<64 hex>
 *
 * PARA QUE ISTO EXISTE: a janela de doação monta o pedido no navegador, e um
 * navegador é território do visitante. Extensão hostil, devtools aberto ou um
 * script de terceiro comprometido podem trocar o endereço de destino ANTES de
 * a carteira ser chamada, e a página não teria como saber.
 *
 * Então a página não é a autoridade. Depois do broadcast, o SERVIDOR lê a
 * transação na rede e diz se ela realmente paga o endereço do fundo. O endereço
 * comparado aqui vem do código do servidor, não do que o cliente mandou: se a
 * resposta disser que não bate, o que foi adulterado foi o navegador da pessoa,
 * e a tela grita isso em vez de mostrar um "obrigado".
 *
 * Nenhum valor é aceito do cliente além do txid, e ele é conferido contra a
 * forma canônica antes de virar URL.
 */

const TXID = /^[0-9a-f]{64}$/
const CACHE_SECONDS = 120

interface Verdict {
  txid: string
  found: boolean
  paysFund: boolean
  fundAddress: string
  /** Sats que foram para o endereço do fundo (546 típico numa transferência de rune). */
  valueToFund: number
  confirmed: boolean
}

export async function GET(req: NextRequest) {
  const txid = (req.nextUrl.searchParams.get('txid') ?? '').trim().toLowerCase()
  if (!TXID.test(txid)) {
    return NextResponse.json({ error: 'Invalid transaction id.' }, { status: 400 })
  }

  const key = `donateverify:${txid}`
  try {
    const hit = await redisClient.get<Verdict>(key)
    // Só o veredito de uma transação JÁ CONFIRMADA é reaproveitado: enquanto
    // ela estiver na mempool o estado ainda muda.
    if (hit?.confirmed) return NextResponse.json(hit)
  } catch {
    /* cache é otimização */
  }

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8_000)
    const res = await fetch(`https://mempool.space/api/tx/${txid}`, { signal: ctrl.signal })
    clearTimeout(t)

    if (res.status === 404) {
      return NextResponse.json({
        txid, found: false, paysFund: false, fundAddress: DONATION_WALLET,
        valueToFund: 0, confirmed: false,
      })
    }
    if (!res.ok) throw new Error(`mempool ${res.status}`)

    const tx = await res.json()
    const outs: any[] = tx?.vout ?? []
    const toFund = outs.filter((o) => o?.scriptpubkey_address === DONATION_WALLET)

    const verdict: Verdict = {
      txid,
      found: true,
      paysFund: toFund.length > 0,
      fundAddress: DONATION_WALLET,
      valueToFund: toFund.reduce((sum, o) => sum + (Number(o?.value) || 0), 0),
      confirmed: Boolean(tx?.status?.confirmed),
    }

    try {
      await redisClient.set(key, verdict, { ex: CACHE_SECONDS })
    } catch {
      /* idem */
    }
    return NextResponse.json(verdict)
  } catch (e: any) {
    console.error('[api/donate/verify]', e?.message)
    return NextResponse.json({ error: 'Could not read the transaction right now.' }, { status: 502 })
  }
}
