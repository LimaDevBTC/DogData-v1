/**
 * DOG PHONE, o app Runes (22/11/2026): o saldo das cinco runes que o celular mostra, no endereço da SESSÃO assinada.
 *
 *   GET /api/dogcity/phone/runes
 *     { address, runes: [{ id, name, amount, divisibility }], source, updatedAt }
 *
 * As cinco são fixas, pelo RUNE ID (conferidos em ord em 22/11/2026): DOG•GO•TO•THE•MOON 840000:3, LOBO•THE•WOLF•PUP 840000:35,
 * MAGIC•INTERNET•MONEY 840000:45, PUPS•WORLD•PEACE 840000:41, GIZMO•IMAGINARY•KITTEN 865193:4006. `amount` é a quantidade em
 * unidades de base, como texto (PUPS tem 18 casas: não cabe em número). Rune que a carteira não tem sai com "0". A lista vem da
 * UniSat (paga por chamada: freio de 5 s por carteira). Falha do indexador é 502 `why: 'indexer'`, nunca uma lista de zeros.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const RUNAS = [
  { id: '840000:3', name: 'DOG•GO•TO•THE•MOON', divisibility: 5 },
  { id: '840000:35', name: 'LOBO•THE•WOLF•PUP', divisibility: 8 },
  { id: '840000:45', name: 'MAGIC•INTERNET•MONEY', divisibility: 0 },
  { id: '840000:41', name: 'PUPS•WORLD•PEACE', divisibility: 18 },
  { id: '865193:4006', name: 'GIZMO•IMAGINARY•KITTEN', divisibility: 8 },
] as const
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Cross-site request refused.', why: 'cross_site' }, { status: 403, headers: NO_STORE })
  }
  if (await passouDoTeto(req, 'phone-runes', 30)) return respostaFreio()
  const session = await getWalletSession(req).catch(() => null)
  if (!session) return NextResponse.json({ error: 'Sign in first.', why: 'no_session' }, { status: 401, headers: NO_STORE })
  if (await tooFast(`phone-runes:${session.address}`, 5)) {
    return NextResponse.json({ error: 'Slow down, try again in a moment.', why: 'slow' }, { status: 429, headers: NO_STORE })
  }
  try {
    const token = process.env.UNISAT_API_TOKEN
    if (!token) throw new Error('UNISAT_API_TOKEN missing')
    const res = await fetch(`https://open-api.unisat.io/v1/indexer/address/${encodeURIComponent(session.address)}/runes/balance-list?start=0&limit=500`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DOG DATA/1.0' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`unisat ${res.status}`)
    const j = await res.json()
    if (j?.code !== 0 || !Array.isArray(j.data?.detail)) throw new Error(`unisat ${j?.msg ?? 'shape'}`)
    const porId = new Map<string, string>()
    for (const d of j.data.detail as Array<{ runeid?: unknown; amount?: unknown }>) {
      if (typeof d?.runeid === 'string' && typeof d.amount === 'string' && /^\d{1,40}$/.test(d.amount)) porId.set(d.runeid, d.amount)
    }
    return NextResponse.json(
      {
        address: session.address,
        runes: RUNAS.map((r) => ({ ...r, amount: porId.get(r.id) ?? '0' })),
        source: 'UniSat indexer',
        updatedAt: new Date().toISOString(),
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[api/dogcity/phone/runes]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not read your runes right now.', why: 'indexer' }, { status: 502, headers: NO_STORE })
  }
}
