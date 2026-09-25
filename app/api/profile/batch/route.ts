import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comPrazo, falhaPublica } from '@/lib/api/prazo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/profile/batch?addresses=a,b,c   handle e foto de ate 50 enderecos
 *
 * Existe para a DogCity (escritura do lote, chip, chat) perguntar a identidade
 * publica de varios donos numa chamada so, e com cache na borda. O
 * `GET /api/profile?address=` continua para a pagina /profile, mas le o cookie
 * (para dizer `verified`) e faz 3 consultas sem cache: chamado por lote
 * pisado, era a rota que mais pesaria no Supabase (LIGAR.md 3.3).
 *
 * ⚠️ NAO LE COOKIE, de proposito: resposta que depende de cookie nao pode ser
 * cacheada na borda. Aqui so sai o que ja e publico (handle e foto). Posse
 * (`verified`) continua so em `/api/profile`.
 *
 * ⚠️ ENDERECO SEM PERFIL NAO VOLTA NO MAPA (mesma convencao de
 * /api/identity): quem chamou sabe o que pediu, e ausencia = sem handle e sem
 * foto. A chave do mapa e o endereco como veio no pedido.
 *
 * ⚠️ UMA consulta, pela chave primaria (`in` em `dogcity_profiles.address`),
 * nunca varredura. O perfil grava o endereco em minusculas (POST de
 * /api/profile), entao a busca tambem vai em minusculas.
 *
 * Para a borda acertar mais, o cliente manda a lista ordenada e sem repeticao.
 */
const TETO = 50
const ADDR_RE = /^(bc1|BC1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$/
const CACHE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } as const
// pedido malformado e deterministico: a borda pode guardar a recusa tambem
const CACHE_RECUSA = { 'Cache-Control': 'public, s-maxage=300' } as const
const PRAZO_MS = 5000

export async function GET(req: NextRequest) {
  const bruto = (req.nextUrl.searchParams.get('addresses') || '').trim()
  const pedidos = Array.from(
    new Set(bruto.split(',').map((a) => a.trim()).filter((a) => ADDR_RE.test(a))),
  )

  if (pedidos.length === 0) {
    return NextResponse.json(
      { error: 'addresses required: ?addresses=a,b,c (Bitcoin addresses, comma separated)' },
      { status: 400, headers: CACHE_RECUSA },
    )
  }
  // ⚠️ recusa em vez de cortar calado: um corte silencioso faria o cliente
  // achar que os enderecos que sobraram nao tem perfil
  if (pedidos.length > TETO) {
    return NextResponse.json(
      { error: `too many addresses: at most ${TETO} per request`, max: TETO },
      { status: 400, headers: CACHE_RECUSA },
    )
  }

  return comPrazo(async (signal) => {
    const chaves = Array.from(new Set(pedidos.map((a) => a.toLowerCase())))
    const { data, error } = await supabase
      .from('dogcity_profiles')
      .select('address, handle, avatar_inscription_id')
      .in('address', chaves)
      .abortSignal(signal)

    if (error) {
      console.error('[api/profile/batch]', error.message)
      return falhaPublica()
    }

    const porChave = new Map<string, { handle: string | null; avatar_inscription_id: string | null }>()
    for (const row of data ?? []) {
      if (!row.handle && !row.avatar_inscription_id) continue
      porChave.set(row.address, {
        handle: row.handle ?? null,
        avatar_inscription_id: row.avatar_inscription_id ?? null,
      })
    }

    const profiles: Record<string, { handle: string | null; avatar_inscription_id: string | null }> = {}
    for (const a of pedidos) {
      const p = porChave.get(a.toLowerCase())
      if (p) profiles[a] = p
    }

    return NextResponse.json({ profiles }, { headers: CACHE })
  }, { ms: PRAZO_MS, falha: () => falhaPublica() })
}
