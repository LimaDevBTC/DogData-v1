/**
 * GET /api/dogcity/mint-b
 *
 * O detector do bloco B: o bloco em que o fundo de construção chega a
 * 10.000.000 $DOG (contrato: /dogcity/docs, seção 7). A conta mora em
 * lib/dog/mint-b.ts (pura, testada); esta rota só busca as linhas.
 *
 * FONTE: a MESMA de /api/donate/leaderboard: as linhas de `dog_transactions`
 * que tocam a carteira do fundo, com `block_height`, passadas pelo mesmo
 * livro (lib/dog/founders-ledger.ts). Total e B nunca divergem do placar.
 *
 * Resposta:
 *   { goal, raised, B, txid, raisedAtB, tip, confirmations }   B existe
 *   { goal, raised, B: null, ... }                              ainda não cruzou
 * `confirmations` = ponta - B + 1. Quem exibe o calendário espera 6 ou mais.
 *
 * Dado público (só o que a cadeia já mostra): CORS aberto. Cache de 60 s no
 * CDN e na memória do processo, para a manada da landing e da página do mint.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildLedger, type TxRow } from '@/lib/dog/founders-ledger'
import { buildBResult, detectB, DONATION_WALLET, type BResult } from '@/lib/dog/mint-b'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CACHE_MS = 60_000
const HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
  'Access-Control-Allow-Origin': '*',
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

let memo: { at: number; body: BResult & { last_updated: string } } | null = null

// ⚠️ DISJUNTOR (incidente de IO de 26/08), como no leaderboard: pendurada no banco
// anêmico esta rota não pode segurar a landing. 8 s e 503 rápido com cache curto.
export async function GET() {
  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => {
    timer = setTimeout(() => res(NextResponse.json(
      { error: 'data backend busy' },
      { status: 503, headers: HEADERS },
    )), 8000)
  })
  try {
    return await Promise.race([handler().catch((err) => {
      console.error('[dogcity/mint-b] error:', err)
      return NextResponse.json({ error: 'mint-b unavailable' }, { status: 503, headers: HEADERS })
    }), prazo])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function ponta(): Promise<number | null> {
  // duas leituras, cada uma um limite inferior verdadeiro da ponta: vale a maior.
  // Se o vigia da mempool parou, a do banco segura; se o scanner atrasou, a do vigia.
  const [snap, ultimo] = await Promise.all([
    supabase.from('mempool_snapshot').select('tip_height').eq('id', 1).maybeSingle(),
    supabase.from('dog_transactions').select('block_height').order('block_height', { ascending: false }).limit(1),
  ])
  const a = Number((snap.data as { tip_height?: unknown } | null)?.tip_height)
  const b = Number((ultimo.data as { block_height?: unknown }[] | null)?.[0]?.block_height)
  const v = [a, b].filter((n) => Number.isSafeInteger(n) && n > 0)
  return v.length ? Math.max(...v) : null
}

async function handler() {
  if (memo && Date.now() - memo.at < CACHE_MS) return NextResponse.json(memo.body, { headers: HEADERS })

  // Todas as linhas que tocam o fundo, paginadas, ordem estável (bloco, id).
  const PAGE = 1000
  const rows: TxRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('dog_transactions')
      .select('id, txid, block_height, timestamp, senders, receivers')
      .contains('addresses', [DONATION_WALLET])
      .order('block_height', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as TxRow[]))
    if (!data || data.length < PAGE) break
  }

  // Sem altura de bloco não é confirmada: não entra na conta.
  const confirmadas = rows.filter((r) => Number.isSafeInteger(r.block_height) && r.block_height > 0)
  const ledger = buildLedger(confirmadas, DONATION_WALLET, { licenseFor: () => '' })
  const { found, totalAtomos } = detectB(ledger.contributions)
  const body = { ...buildBResult(found, totalAtomos, await ponta()), last_updated: new Date().toISOString() }

  memo = { at: Date.now(), body }
  return NextResponse.json(body, { headers: HEADERS })
}
