import { NextResponse } from 'next/server'
import { allIdentities, resolveIdentities } from '@/lib/dog/identity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/identity?addresses=a,b,c   quem é o dono destes
 * GET /api/identity                    todas as identidades que a casa conhece
 *
 * Quem é o dono destes endereços. Existe para as telas do cliente poderem
 * perguntar sem ter que carregar o `verified_addresses.json` inteiro nem falar
 * com o banco de rótulos por conta própria, que era como as três fontes de
 * identidade acabaram desencontradas.
 *
 * ⚠️ ENDEREÇO SEM DONO CONHECIDO NÃO VOLTA NO MAPA. A tela distingue "não
 * sabemos" de "sabemos que é anônimo" pela ausência, e nenhum dos dois vira
 * palpite.
 */
const TETO = 200

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bruto = (searchParams.get('addresses') || '').trim()

  // ⚠️ SEM PARÂMETRO, DEVOLVE TUDO, e isso é de propósito. A página de holders
  // pinta milhares de linhas: perguntar endereço por endereço seria uma ida ao
  // servidor por linha. O conjunto todo é pequeno (dezenas), cabe numa resposta
  // e é público por natureza, então a lista inteira é a forma barata e honesta.
  if (!bruto) {
    const todas = await allIdentities()
    const tudo: Record<string, unknown> = {}
    for (const [address, id] of Array.from(todas.entries())) tudo[address] = id
    return NextResponse.json(
      { identities: tudo, count: todas.size },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
    )
  }

  // ⚠️ COM TETO: a lista vem da URL, então é entrada de fora. Sem limite, um
  // pedido com dez mil endereços vira trabalho nosso de graça.
  const enderecos = bruto.split(',').map((a) => a.trim()).filter(Boolean).slice(0, TETO)

  const mapa = await resolveIdentities(enderecos)
  const out: Record<string, unknown> = {}
  for (const [address, id] of Array.from(mapa.entries())) out[address] = id

  return NextResponse.json(
    { identities: out },
    // identidade muda de mês em mês, não de minuto em minuto
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
  )
}
