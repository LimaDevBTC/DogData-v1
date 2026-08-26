import { NextRequest, NextResponse } from 'next/server'
import {
  NODE_SELECT,
  TREE_CACHE_HEADERS,
  attachLabels,
  errorJson,
  escapeLike,
  isValidPrefix,
  rowToNode,
  supabase,
  comPrazo,
} from '../_shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MATCH_LIMIT = 10

// GET /api/holders/tree/search?q=prefixo
// Ate 10 carteiras cujo endereco comeca com `q` (wallet ilike prefixo%),
// por subtree_holders desc.
export async function GET(req: NextRequest) {
  return comPrazo(() => handler(req))
}

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''

  if (!isValidPrefix(q)) {
    return errorJson('q must be at least 3 characters')
  }

  try {
    const { data, error } = await supabase
      .from('dog_genealogy')
      .select(NODE_SELECT)
      .ilike('wallet', `${escapeLike(q.trim())}%`)
      .order('subtree_holders', { ascending: false })
      .limit(MATCH_LIMIT)

    if (error) throw new Error(error.message)

    const matches = await attachLabels((data ?? []).map((row: any) => rowToNode(row)))
    return NextResponse.json({ matches }, { headers: TREE_CACHE_HEADERS })
  } catch (err: any) {
    console.error('[api/holders/tree/search GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}
