import { NextRequest, NextResponse } from 'next/server'
import { getWalletSession } from '@/lib/identity/session'
import { inWaves, inscriptionMeta, isImageType, listInscriptions } from '@/lib/ordinals/inscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Quantas inscrições da carteira chegam a ser olhadas por página. Cada uma
// custa um metadado no ordinals.com, e a grade da tela mostra bem menos que
// isso de uma vez.
const PAGE = 36

/**
 * GET /api/profile/inscriptions?cursor=0
 *
 * As inscrições que a carteira da sessão segura, já filtradas para o que serve
 * de foto (imagem, nada que execute código). Exige sessão: é a carteira da
 * pessoa, não uma consulta pública de endereço alheio.
 */
export async function GET(req: NextRequest) {
  const session = await getWalletSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401 })
  }

  const cursor = Math.max(0, Number(req.nextUrl.searchParams.get('cursor') ?? 0) || 0)

  try {
    const { items, total } = await listInscriptions(session.address, cursor, PAGE)

    // O indexador quase nunca traz o tipo de conteúdo; quem sabe é o metadado
    // público, e ele é imutável, então a segunda visita sai do cache.
    const enriched = await inWaves(items, async (item) => {
      if (item.contentType) return item
      const meta = await inscriptionMeta(item.id)
      return {
        ...item,
        contentType: meta?.contentType ?? null,
        number: item.number || meta?.number || 0,
      }
    })

    const images = enriched.filter((i) => isImageType(i.contentType))

    return NextResponse.json({
      inscriptions: images,
      // Duas contagens de propósito: "a carteira tem N" e "N servem de foto".
      // Sem isso, quem tem 30 inscrições de texto lê a grade vazia como bug.
      scanned: items.length,
      total,
      cursor,
      next_cursor: cursor + items.length < total ? cursor + items.length : null,
    })
  } catch (e: any) {
    console.error('[api/profile/inscriptions]', e?.message)
    return NextResponse.json(
      { error: 'Could not read your inscriptions right now.' },
      { status: 502 },
    )
  }
}
