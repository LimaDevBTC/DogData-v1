/**
 * DOG PHONE, o app Ordinals (22/11/2026): TODAS as inscrições que o indexador enxerga no endereço da SESSÃO assinada, não
 * só as que servem de foto (essa seleção é de /api/profile/inscriptions). Só consulta: nada aqui move ou assina.
 *
 *   GET /api/dogcity/phone/ordinals?cursor=0
 *     { address, inscriptions: [{ id, number, contentType }], total, cursor, next_cursor, source, updatedAt }
 *
 * O endereço coberto é um só: o que assinou a sessão (`dg_wallet`). A lista vem da UniSat (paga por chamada: freio de 3 s
 * por carteira) e o tipo de conteúdo, do metadado público do ordinals.com (imutável, cache de 30 dias). Falha do indexador
 * responde 502 com `why: 'indexer'`: o jogo mostra "fonte indisponível", nunca uma lista vazia que pareça carteira vazia.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'
import { inWaves, inscriptionMeta, listInscriptions } from '@/lib/ordinals/inscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

/** inscrições por página: cada uma sem tipo custa um metadado no ordinals.com */
const PAGE = 24
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Cross-site request refused.', why: 'cross_site' }, { status: 403, headers: NO_STORE })
  }
  if (await passouDoTeto(req, 'phone-ordinals', 30)) return respostaFreio()
  const session = await getWalletSession(req).catch(() => null)
  if (!session) {
    return NextResponse.json({ error: 'Sign in first.', why: 'no_session' }, { status: 401, headers: NO_STORE })
  }
  if (await tooFast(`phone-inscr:${session.address}`, 3)) {
    return NextResponse.json({ error: 'Slow down, try again in a moment.', why: 'slow' }, { status: 429, headers: NO_STORE })
  }
  const cursor = Math.min(100_000, Math.max(0, Math.floor(Number(req.nextUrl.searchParams.get('cursor') ?? 0)) || 0))
  try {
    const { items, total } = await listInscriptions(session.address, cursor, PAGE)
    const inscriptions = await inWaves(items, async (item) => {
      if (item.contentType && item.number) return item
      const meta = await inscriptionMeta(item.id).catch(() => null)
      return { id: item.id, number: item.number || meta?.number || 0, contentType: item.contentType ?? meta?.contentType ?? null }
    })
    return NextResponse.json(
      {
        address: session.address,
        inscriptions,
        total,
        cursor,
        next_cursor: items.length > 0 && cursor + items.length < total ? cursor + items.length : null,
        source: 'UniSat indexer',
        updatedAt: new Date().toISOString(),
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[api/dogcity/phone/ordinals]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not read your inscriptions right now.', why: 'indexer' }, { status: 502, headers: NO_STORE })
  }
}
