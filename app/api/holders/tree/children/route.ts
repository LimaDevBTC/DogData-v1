import { NextRequest, NextResponse } from 'next/server'
import {
  NODE_SELECT,
  TREE_CACHE_HEADERS,
  attachLabels,
  errorJson,
  isValidAddress,
  rowToNode,
  supabase,
  comPrazo,
} from '../_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LIMIT = 400
// O PostgREST deste projeto tampa cada resposta em 1000 linhas (max-rows);
// pedir mais que isso num range so devolveria os 1000 primeiros em silencio.
// A pagina fica limitada aqui, e quem quiser mais pagina com offset.
const MAX_LIMIT = 1000

// GET /api/holders/tree/children?addr=X&limit=400&offset=0
// Filhos diretos de `addr` (parent = addr), por subtree_holders desc.
export async function GET(req: NextRequest) {
  return comPrazo(() => handler(req))
}

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const addr = searchParams.get('addr') ?? ''

  if (!isValidAddress(addr)) {
    return errorJson('invalid addr')
  }

  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const offset = clampInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)

  try {
    const { data, error } = await supabase
      .from('dog_genealogy')
      .select(NODE_SELECT)
      .eq('parent', addr)
      .order('subtree_holders', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)

    const nodes = await attachLabels((data ?? []).map((row: any) => rowToNode(row)))
    return NextResponse.json({ children: nodes }, { headers: TREE_CACHE_HEADERS })
  } catch (err: any) {
    console.error('[api/holders/tree/children GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? NaN : parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
