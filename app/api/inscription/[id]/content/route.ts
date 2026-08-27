import { NextRequest, NextResponse } from 'next/server'
import { INSCRIPTION_ID, isImageType } from '@/lib/ordinals/inscriptions'

export const runtime = 'nodejs'

/**
 * GET /api/inscription/<id>/content
 *
 * A arte de uma inscrição, servida pelo nosso domínio. Existe por três razões:
 *
 * 1. Conteúdo de inscrição é IMUTÁVEL, então a CDN pode guardar para sempre e
 *    a foto de perfil de alguém deixa de custar uma ida a um gateway público a
 *    cada visita de cada página.
 * 2. O `<img>` do site não passa a depender do uptime do ordinals.com: se ele
 *    cair, tenta o espelho da UniSat.
 * 3. ⚠️ SÓ IMAGEM SAI DAQUI. Sem esse filtro, a rota seria um proxy aberto de
 *    HTML e JavaScript hospedado no nosso domínio, e a foto de perfil de
 *    qualquer pessoa poderia executar código sob dogdata.xyz.
 */

const GATEWAYS = [
  (id: string) => `https://ordinals.com/content/${id}`,
  (id: string) => `https://static.unisat.io/content/${id}`,
]

// Teto de tamanho: foto de perfil não tem por que passar disso, e sem teto uma
// inscrição de vídeo de 20 MB viraria tráfego nosso.
const MAX_BYTES = 4 * 1024 * 1024

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = (raw ?? '').trim().toLowerCase()
  if (!INSCRIPTION_ID.test(id)) {
    return NextResponse.json({ error: 'Invalid inscription id.' }, { status: 400 })
  }

  for (const gateway of GATEWAYS) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10_000)
      const res = await fetch(gateway(id), { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) continue

      const type = res.headers.get('content-type')
      if (!isImageType(type)) {
        return NextResponse.json(
          { error: 'This inscription is not an image.' },
          { status: 415 },
        )
      }

      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Inscription too large.' }, { status: 413 })
      }

      return new NextResponse(buf, {
        headers: {
          'Content-Type': type as string,
          'Content-Length': String(buf.byteLength),
          // Imutável de verdade: o mesmo id devolve os mesmos bytes para sempre.
          'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
          // A imagem vem de terceiro: nada de sniffing, nada de virar página.
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      })
    } catch {
      /* tenta o próximo espelho */
    }
  }

  return NextResponse.json({ error: 'Inscription content unavailable.' }, { status: 502 })
}
