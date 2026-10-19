/**
 * GET /api/dogcity/mint-b
 *
 * O detector do bloco B: o bloco da transação de doação que fez o fundo de
 * construção cruzar 10.000.000 $DOG (contrato: /dogcity/docs, seção 7). A conta
 * mora em lib/dog/mint-b.ts (pura, testada); esta rota busca as linhas, a ponta
 * e o B congelado.
 *
 * FONTE: a MESMA de /api/donate/leaderboard: as linhas de `dog_transactions`
 * (todas têm bloco: a mempool mora em outra tabela) que tocam a carteira do
 * fundo, passadas pelo mesmo livro (lib/dog/founders-ledger.ts).
 *
 * RESPOSTA PÚBLICA E ESTÁVEL (não acrescente campo sem avisar o mint e a landing):
 *   { status: "filling" | "full_unconfirmed" | "set", raised, goal, B, confirmations, tip }
 *   filling           raised < goal. B e confirmations nulos.
 *   full_unconfirmed  a meta foi atingida, mas B tem menos de 6 confirmações. B é
 *                     PROVISÓRIO (uma reorg o move ou desfaz): quem lê não usa B aqui.
 *   set               B tem 6 confirmações ou mais e está CONGELADO: nunca mais muda.
 * `confirmations` = tip - B + 1. 503 { error } quando o banco não responde.
 *
 * CONGELAMENTO: na primeira vez que vê B com 6 confirmações, a rota grava B na
 * tabela `dogcity_mint_b` (supabase/migrations/033, uma linha, imutável) e dali
 * em diante só lê essa linha, sem reconstruir o livro. Sem a tabela (migração
 * ainda não aplicada) cai para a memória do processo, que segura enquanto a
 * instância viver e reconstrói do livro ao subir.
 *
 * Dado público (só o que a cadeia já mostra). CORS só para o mint e o ensaio;
 * a landing é do mesmo domínio. Cache de 30 s no CDN e na memória do processo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildLedger, type TxRow } from '@/lib/dog/founders-ledger'
import { corsHeaders, DONATION_WALLET, mintBNow, type BContribution, type FrozenB, type MintBPublic, type MintBSource } from '@/lib/dog/mint-b'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CACHE_MS = 30_000
const OK_CACHE = 'public, s-maxage=30'
const ERR_CACHE = 'public, s-maxage=10'
const TABLE = 'dogcity_mint_b'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

let memo: { at: number; body: MintBPublic } | null = null
// B congelado visto por esta instância: imutável, vale até o processo morrer.
let frozenMem: FrozenB | null = null
// O que ESTA instância congelou e tentou gravar: segura o B quando a tabela não existe.
let congeladoAqui: FrozenB | null = null

// ⚠️ DISJUNTOR (incidente de IO de 26/08), como no leaderboard: pendurada no banco
// anêmico esta rota não pode segurar a landing. 8 s e 503 rápido com cache curto.
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const erro = (msg: string) => NextResponse.json({ error: msg }, { status: 503, headers: { ...cors, 'Cache-Control': ERR_CACHE } })
  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => { timer = setTimeout(() => res(erro('data backend busy')), 8000) })
  try {
    return await Promise.race([
      handler(cors).catch((err) => {
        console.error('[dogcity/mint-b] error:', err)
        return erro('mint-b unavailable')
      }),
      prazo,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' },
  })
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

/** Tabela ausente (migração 033 ainda não aplicada) não é falha: é "sem congelado persistido". */
const semTabela = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message ?? ''))

async function loadFrozen(): Promise<FrozenB | null> {
  if (frozenMem) return frozenMem
  const { data, error } = await supabase.from(TABLE).select('b, raised, tip, txid').eq('id', 1).maybeSingle()
  if (error && !semTabela(error)) throw new Error(`mint_b read: ${error.message}`) // erro de verdade: 503, nunca "não congelado"
  if (!error && data) {
    const r = data as { b: number; raised: number | string; tip: number; txid: string | null }
    frozenMem = { B: Number(r.b), raised: Number(r.raised), tip: Number(r.tip), txid: r.txid }
  } else if (congeladoAqui) {
    frozenMem = congeladoAqui // sem tabela: vale o que esta instância congelou
  }
  return frozenMem
}

async function saveFrozen(f: FrozenB): Promise<void> {
  // insere uma vez (conflito = já havia, não toca); a trigger da migração barra update/delete
  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: 1, b: f.B, raised: f.raised, tip: f.tip, txid: f.txid }, { onConflict: 'id', ignoreDuplicates: true })
  if (error && !semTabela(error)) console.error('[dogcity/mint-b] freeze write failed:', error.message)
}

async function lerContribuicoes(): Promise<BContribution[]> {
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
  return buildLedger(confirmadas, DONATION_WALLET, { licenseFor: () => '' }).contributions
}

const fonte: MintBSource = {
  loadFrozen,
  saveFrozen: async (f) => { congeladoAqui = f; await saveFrozen(f) },
  readContributions: lerContribuicoes,
  readTip: ponta,
}

async function handler(cors: Record<string, string>) {
  const reply = (body: MintBPublic) => NextResponse.json(body, { headers: { ...cors, 'Cache-Control': OK_CACHE } })
  if (memo && Date.now() - memo.at < CACHE_MS) return reply(memo.body)

  const { body, diverged } = await mintBNow(fonte)
  if (diverged) console.warn('[dogcity/mint-b] frozen B differs from the ledger read now; the frozen B stands')
  memo = { at: Date.now(), body }
  return reply(body)
}
