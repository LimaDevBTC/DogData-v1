// A cola das rotas /api/game/race/*: as dependencias reais (Supabase, id), a carteira da sessao e a resposta. SO' as rotas importam isto
// (importar `@/lib/supabase` sem as variaveis de ambiente lanca de proposito); a logica esta em service.ts e e' testada sem rede.
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sessionWallet } from '@/lib/game/session'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { falhaPrivada } from '@/lib/api/prazo'
import { criarStoreSupabase } from './store-supabase'
import type { Deps, Resposta } from './service'

export const deps: Deps = { store: criarStoreSupabase(supabase), novoId: () => randomUUID() }

/** Prazo de cada rota (regra da casa: rota tem prazo; estourou, 503 e o cliente repete). O gate tem o do cliente (8 s), o finish o dele (20 s). */
export const PRAZO_MS = { start: 10_000, gate: 8_000, finish: 20_000, leitura: 5_000, fechar: 30_000 } as const

export const SEM_CACHE = { 'Cache-Control': 'no-store' } as const

export const json = (body: unknown, status = 200, headers: Record<string, string> = SEM_CACHE): NextResponse => NextResponse.json(body, { status, headers })

export const resposta = (r: Resposta): NextResponse => json(r.body, r.status)

/** A carteira da sessao verificada (cookie dg_wallet), na forma canonica (bech32 minusculo). Sem sessao, ou endereco estranho: null (a rota responde 401). */
export async function carteiraDaSessao(req: NextRequest): Promise<string | null> {
  return normalizeAddress(await sessionWallet(req))
}

export const falhaDaRota = (): NextResponse => falhaPrivada()
