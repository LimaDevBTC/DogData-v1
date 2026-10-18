import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildLedger, type TxRow } from '@/lib/dog/founders-ledger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DONATION_WALLET = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
const DOG_GOAL = 10_000_000

// SalesCity license ladder — a wallet's *accumulated* DOG donated unlocks tiers.
// The donation address is the product: no checkout, no second SKU.
const PERSONAL_LICENSE = 10_000
const COMMERCIAL_LICENSE = 50_000
const PATRON_TIER = 500_000

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

// ⚠️ O DEGRAU `patron` EXISTIA NA TABELA E NÃO EXISTIA NA FUNÇÃO, de 12/09/2026
// para trás. `PATRON_TIER` era publicado em `tiers` (linha ~223) e a escada parava
// em `commercial`: os QUATRO doadores de 500k ou mais, incluindo o maior de todos
// com 1.000.000 DOG, recebiam o mesmo rótulo de quem deu 50 mil. Achado na
// auditoria do dia do snapshot, com o Founders Pack prestes a dar nome de rua e
// prédio personalizado ao `patron`.
function licenseFor(total: number): 'patron' | 'commercial' | 'personal' | 'citizen' {
  if (total >= PATRON_TIER) return 'patron'
  if (total >= COMMERCIAL_LICENSE) return 'commercial'
  if (total >= PERSONAL_LICENSE) return 'personal'
  return 'citizen'
}

// ⚠️ DISJUNTOR (incidente de IO de 26/08): esta rota mora no portão de carga
// da praça e da landing; pendurada no banco anêmico ela travou a cidade nos
// 90%. Prazo de 8s: estourou, 503 rápido com cache curto na CDN pra
// segurar a manada, e o cliente segue sem o leaderboard.
export async function GET(req: NextRequest) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const prazo = new Promise<NextResponse>((res) => {
    timer = setTimeout(() => res(NextResponse.json(
      { error: 'data backend busy' },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
    )), 8000)
  })
  try {
    return await Promise.race([handler(req).catch(() => NextResponse.json(
      { error: 'leaderboard unavailable' },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
    )), prazo])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function handler(req: NextRequest) {
  // ?slim=1 (landing v3, 18/10/2026): o contador do herói da /dogcity só precisa do
  // total e da meta. O cálculo é o mesmo; a resposta cai de ~50 KB para ~120 bytes e
  // ganha entrada própria no cache da CDN. No desktop o número grande do contador é o
  // maior texto da tela: chegar cedo é o que fecha o LCP.
  const slim = req.nextUrl.searchParams.get('slim') === '1'
  try {
    // Fetch ALL txs that involve the donation wallet, paginated (no row cap).
    // Stable order (block, id) so pages never skip or repeat a row.
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

    // The accounting lives in lib/dog/founders-ledger.ts (pure, tested): donated
    // DOG split by net DOG sent per address, founder number by first
    // contribution (block, position in block), anonymous never numbered.
    const ledger = buildLedger(rows, DONATION_WALLET, { licenseFor })
    const totalReceived = ledger.totalReceived
    const leaderboard = ledger.leaderboard
    const founders = ledger.founders.map(({ totalAtomos: _t, ...f }) => f)
    const recent = ledger.recent

    const foundersCount = founders.length

    if (slim) {
      return NextResponse.json(
        {
          goal: DOG_GOAL,
          total_received: totalReceived,
          progress_pct: Math.min((totalReceived / DOG_GOAL) * 100, 100),
          last_updated: new Date().toISOString(),
        },
        { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } }
      )
    }

    return NextResponse.json(
      {
        wallet: DONATION_WALLET,
        goal: DOG_GOAL,
        total_received: totalReceived,
        progress_pct: Math.min((totalReceived / DOG_GOAL) * 100, 100),
        donor_count: leaderboard.length,
        leaderboard,
        // SalesCity additions
        tiers: {
          personal: PERSONAL_LICENSE,
          commercial: COMMERCIAL_LICENSE,
          patron: PATRON_TIER,
        },
        founders_count: foundersCount,
        founders,
        recent,
        last_updated: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } }
    )
  } catch (err: any) {
    console.error('[donate/leaderboard] error:', err)
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    )
  }
}
