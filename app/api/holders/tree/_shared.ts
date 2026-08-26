import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveIdentities } from '@/lib/dog/identity'

// Raiz da genealogia: a tesouraria do airdrop, a unica linha com parent NULL
// em dog_genealogy (depth 0). Endereco fixo, nao muda.
export const ROOT_WALLET = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'

// Endereco bitcoin: bech32 (bc1...) ou base58 (1.../3...). Mesmo padrao ja
// usado em app/explorer/page.tsx, para as duas telas nao terem regras
// diferentes para a mesma coisa.
const ADDR_RE = /^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$/

export function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && ADDR_RE.test(addr)
}

export function isValidPrefix(q: unknown): q is string {
  return typeof q === 'string' && q.trim().length >= 3
}

// Escapa curingas do LIKE/ILIKE (% e _) antes de montar o prefixo de busca,
// senao um endereco que contenha esses caracteres por acaso vira um padrao
// em vez de um literal.
export function escapeLike(s: string): string {
  return s.replace(/[%_]/g, (c) => `\\${c}`)
}

// O dado muda devagar (script de enriquecimento roda em segundo plano, nao
// em tempo real), entao a CDN pode servir uma resposta com ate 5 minutos e
// revalidar em segundo plano por mais 10 sem bloquear quem esta pedindo.
export const TREE_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
} as const

// ⚠️ DISJUNTOR (incidente de 26/08): com o banco anemico de IO, cada rota
// desta arvore pendurava por MINUTOS; o 500 nao era cacheado, entao todo
// visitante redetonava as consultas (tempestade perpetua de timeouts no
// Postgres) e as funcoes penduradas comiam a concorrencia da Vercel,
// derrubando APIs sem nenhuma relacao (a batalha levou 503). Regra: rota de
// arvore tem PRAZO. Estourou, devolve 503 rapido COM CACHE CURTO NA CDN,
// que e o que mata o estouro de manada: os proximos 60s de visitantes
// recebem o 503 da borda sem tocar no banco.
export const TREE_BUDGET_MS = 7000
export const TREE_FAIL_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
} as const

export function respostaIndisponivel(): NextResponse {
  return NextResponse.json(
    { error: 'data backend busy, retry shortly' },
    { status: 503, headers: TREE_FAIL_HEADERS },
  )
}

/** Corre o handler contra o prazo; estourou = 503 cacheavel imediato. */
export async function comPrazo(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => {
    timer = setTimeout(() => res(respostaIndisponivel()), TREE_BUDGET_MS)
  })
  try {
    const r = await Promise.race([fn().catch(() => respostaIndisponivel()), prazo])
    return r
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface No {
  w: string
  p: string | null
  d: number
  b: number
  h: boolean
  c: number
  sw: number
  sh: number
  sb: number
  fb: number
  label?: { name: string; source: string }
}

// Linha crua de dog_genealogy, so as colunas que as rotas de arvore leem.
interface Row {
  wallet: string
  parent: string | null
  depth: number | null
  balance_dog: number | string | null
  is_holder: boolean | null
  children_count: number | null
  subtree_wallets: number | null
  subtree_holders: number | null
  subtree_balance_dog: number | string | null
  first_block: number | null
}

export const NODE_SELECT =
  'wallet, parent, depth, balance_dog, is_holder, children_count, subtree_wallets, subtree_holders, subtree_balance_dog, first_block'

export function rowToNode(row: Row): No {
  return {
    w: row.wallet,
    p: row.parent,
    d: row.depth ?? 0,
    b: Number(row.balance_dog ?? 0),
    h: !!row.is_holder,
    c: row.children_count ?? 0,
    sw: row.subtree_wallets ?? 0,
    sh: row.subtree_holders ?? 0,
    sb: Number(row.subtree_balance_dog ?? 0),
    fb: row.first_block ?? 0,
  }
}

type PagedResult = { data: Row[] | null; error: { message: string } | null }

/**
 * Busca mais de 1000 linhas paginando com .range(). O PostgREST tampa cada
 * resposta no max-rows configurado do projeto (1000, medido em 2026-08-26:
 * um select=depth,count() devolveu PGRST123, entao agregacao nativa nao esta
 * disponivel e a paginacao manual e o unico jeito de passar de 1000 linhas).
 *
 * `build(from, to)` deve devolver uma query NOVA a cada chamada (o cliente
 * supabase-js nao permite reusar o mesmo builder depois de um await).
 */
export async function fetchNodesPaged(
  build: (from: number, to: number) => PromiseLike<PagedResult>,
  limit: number,
): Promise<No[]> {
  const PAGE = 1000
  const out: No[] = []
  let offset = 0
  while (out.length < limit) {
    const to = Math.min(offset + PAGE, limit) - 1
    const { data, error } = await build(offset, to)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows.map(rowToNode))
    if (rows.length < to - offset + 1) break
    offset += PAGE
  }
  return out.slice(0, limit)
}

/** Anexa o rotulo (nome + procedencia) so nos nos devolvidos, nunca na tabela inteira. */
export async function attachLabels(nodes: No[]): Promise<No[]> {
  if (nodes.length === 0) return nodes
  const identities = await resolveIdentities(nodes.map((n) => n.w))
  if (identities.size === 0) return nodes
  return nodes.map((n) => {
    const id = identities.get(n.w)
    return id ? { ...n, label: { name: id.name, source: id.source } } : n
  })
}

export function errorJson(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export { supabase }
