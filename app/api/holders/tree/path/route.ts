import { NextRequest, NextResponse } from 'next/server'
import {
  NODE_SELECT,
  TREE_CACHE_HEADERS,
  attachLabels,
  errorJson,
  isValidAddress,
  rowToNode,
  supabase,
  type No,
  comPrazo,
} from '../_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Trava de seguranca contra ciclo: a genealogia e construida sem ciclos, mas
// a rota nao confia nisso as cegas e para de subir depois de 400 passos.
const MAX_STEPS = 400

// GET /api/holders/tree/path?addr=X
// Sobe de pai em pai a partir de `addr` ate a raiz (parent NULL), devolvendo
// o caminho da raiz ate `addr` inclusive.
export async function GET(req: NextRequest) {
  return comPrazo(() => handler(req))
}

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const addr = searchParams.get('addr') ?? ''

  if (!isValidAddress(addr)) {
    return errorJson('invalid addr')
  }

  try {
    const chain: No[] = []
    let current: string | null = addr
    let steps = 0

    while (current && steps < MAX_STEPS) {
      const result: { data: any; error: { message: string } | null } = await supabase
        .from('dog_genealogy')
        .select(NODE_SELECT)
        .eq('wallet', current)
        .maybeSingle()

      if (result.error) throw new Error(result.error.message)
      if (!result.data) {
        if (steps === 0) return errorJson('wallet not found', 404)
        break // pai referenciado sumiu da tabela: devolve o que subiu ate aqui
      }

      const node = rowToNode(result.data)
      chain.push(node)
      current = node.p
      steps++
    }

    // `chain` veio de addr para a raiz; o contrato pede da raiz para addr.
    const path = await attachLabels(chain.reverse())
    return NextResponse.json({ path }, { headers: TREE_CACHE_HEADERS })
  } catch (err: any) {
    console.error('[api/holders/tree/path GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}
