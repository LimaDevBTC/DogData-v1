import { NextRequest, NextResponse } from 'next/server'
import { ROOT_WALLET, TREE_CACHE_HEADERS, comPrazo, errorJson, isValidAddress } from '../_shared'
import { buildFlow, type ActiveWindow } from './_agg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Defaults do contrato: raiz = tesouraria, corte do slider em 1M DOG,
// janela de atividade completa, desktop.
const DEFAULT_MIN = 1_000_000

// GET /api/holders/tree/flow?root&expand&min&active&mobile
// O payload inteiro do sankey por geracao, agregado no servidor: colunas
// G0..G4+, links de dog_flows, nos de resto, stats dos 4 tiles e meta com o
// selo complete/partial do backfill.
export async function GET(req: NextRequest) {
  return comPrazo(() => handler(req))
}

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const rootParam = searchParams.get('root')
  const root = rootParam === null || rootParam === '' ? ROOT_WALLET : rootParam
  if (!isValidAddress(root)) {
    return errorJson('invalid root')
  }

  // min invalido ou negativo volta ao default em vez de derrubar a rota: o
  // slider do front so manda numeros, mas a URL e publica.
  const minRaw = Number(searchParams.get('min') ?? DEFAULT_MIN)
  const min = Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : DEFAULT_MIN

  const activeRaw = searchParams.get('active') ?? 'all'
  const active: ActiveWindow = activeRaw === '90d' || activeRaw === '30d' ? activeRaw : 'all'

  const mobile = searchParams.get('mobile') === '1'

  // ids de resto separados por virgula (g2:holders); o que nao casar com o
  // formato e ignorado dentro da agregacao.
  const expand = (searchParams.get('expand') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    const payload = await buildFlow({ root, expand, min, active, mobile })
    if (!payload) {
      return errorJson('root wallet not found in dog_genealogy', 404)
    }
    return NextResponse.json(payload, { headers: TREE_CACHE_HEADERS })
  } catch (err: any) {
    console.error('[api/holders/tree/flow GET]', err?.message ?? err)
    return errorJson('internal', 500)
  }
}
