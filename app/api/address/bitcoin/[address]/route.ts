import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/dog/identity'
import { netTransfer } from '@/lib/dog/net-transfer'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── Supabase client (service role for unrestricted reads) ────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface HolderEntry {
  rank: number
  address: string
  total_amount: number
  total_dog: number
  utxo_count: number
}

interface ForensicProfile {
  address: string
  airdrop_rank: number
  airdrop_amount: number
  current_balance: number
  current_rank: number
  retention_rate: number
  diamond_score: number
  behavior_pattern: string
  behavior_detail: string
  is_dumping: boolean
  insights: string[]
  accumulation_rate?: number
}

interface TxEntry {
  txid: string
  block_height: number
  timestamp: string
  direction: 'in' | 'out' | 'self'
  /**
   * O DELTA da carteira nesta transação, nunca o bruto que entrou nela.
   * 'out': quanto saiu de fato (gasto menos troco) · 'in': quanto entrou ·
   * 'self': o delta é zero e este campo traz o que a carteira remexeu entre os
   * próprios UTXOs, para a linha não aparecer valendo nada.
   */
  amount_dog: number
  counterparty: string | null
  counterparties: string[]
  total_dog_moved: number
  fee_sats: number
  synthetic?: boolean
  synthetic_label?: string
}

interface AddressLabel {
  id: string
  text: string
  description: string
}

interface SupabaseRow {
  txid: string
  block_height: number
  timestamp: string
  total_dog_moved: number | null
  fee_sats: number | null
  senders: string | any[] | null
  receivers: string | any[] | null
}

// ─── Module-level caches (file-based holder/forensic data) ────────────────────

let holdersMap: Map<string, HolderEntry> | null = null
let holdersTimestamp = ''
let holdersTotal = 0
let forensicMap: Map<string, ForensicProfile> | null = null

async function getHoldersMap() {
  if (holdersMap) return { map: holdersMap, total: holdersTotal, timestamp: holdersTimestamp }
  const filePath = path.join(process.cwd(), 'data', 'dog_holders_by_address.json')
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
  holdersTotal = data.total_holders || data.holders?.length || 0
  holdersTimestamp = data.timestamp || new Date().toISOString()
  holdersMap = new Map()
  for (const h of data.holders || []) holdersMap.set(h.address.toLowerCase(), h)
  return { map: holdersMap, total: holdersTotal, timestamp: holdersTimestamp }
}

async function getForensicMap() {
  if (forensicMap) return forensicMap
  const filePath = path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json')
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
  forensicMap = new Map()
  for (const p of data.all_profiles || []) forensicMap.set(p.address.toLowerCase(), p)
  return forensicMap
}

// ─── Convert Supabase rows → TxEntry[] for a given address ────────────────────

function parseJsonArr(val: string | any[] | null | undefined): any[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

// ⚠️⚠️ O TROCO NÃO SAIU DA CARTEIRA. Esta função já publicou o contrário, e um
// holder escreveu para o fundador dizendo que teve "a mini heart-attack" ao ver
// 2.090.927 DOG saindo da carteira dele num dia em que ele tinha doado 50 mil.
//
// O QUE ACONTECIA: rune mora em UTXO. Para mandar 50 mil de um UTXO que tem
// 2,09 milhões, você gasta o UTXO INTEIRO, manda 50 mil ao destino e os outros
// 2,04 milhões voltam para você no ponteiro do runestone. A linha do banco
// registrava isso corretamente (`senders` com 2,09 M, `receivers` com 50 mil ao
// destino e 2,04 M de volta marcados `is_change`), mas aqui o troco era
// FILTRADO FORA da lista de destinatários e o valor da linha saía do `senders`
// cru. Resultado: a tela dizia "saiu 2,09 M" quando saíram 50 mil, e ainda
// escondia a volta que explicaria o saldo.
//
// ESCALA MEDIDA no banco em 27/08: 452.034 das 1.007.234 transações indexadas
// (44,9%) têm troco. Não era o caso de um usuário, era quase metade do extrato
// do site.
//
// A REGRA, agora: o número da linha é o DELTA da carteira, gasto menos o que
// voltou para ela. Quem só juntou os próprios UTXOs vira 'self', com seta neutra
// e sem contraparte, em vez de uma seta vermelha de saída.
//
// ⚠️ O troco é reconhecido comparando ENDEREÇO com a lista de remetentes, e não
// pela marca `is_change` (que existe e é confiável: numa amostra de 200 mil
// linhas não há um só troco sem marca). Comparar endereço é o mesmo critério do
// `lib/dog/net-transfer.ts`, funciona se a marca faltar num indexador futuro, e
// mantém as duas telas respondendo a mesma coisa sobre a mesma transação.
const DUST_DOG = 0.00001 // a menor unidade do DOG: 5 casas decimais

function rowsToTxEntries(rows: SupabaseRow[], targetAddr: string): TxEntry[] {
  const target = targetAddr.toLowerCase()
  const entries: TxEntry[] = []

  for (const row of rows) {
    const senders = parseJsonArr(row.senders)
      .filter((s: any) => s.has_dog !== false && Number(s.amount_dog) > 0)
    // ⚠️ o troco fica na lista de propósito: ele é justamente o que precisa ser
    // descontado. Filtrá-lo aqui foi a origem do incidente.
    const receivers = parseJsonArr(row.receivers)
      .filter((r: any) => r.has_dog !== false && Number(r.amount_dog) > 0)

    const enderecosQueMandaram = new Set(
      senders.map((s: any) => s.address?.toLowerCase()).filter(Boolean),
    )
    const somaDe = (lista: any[], addr: string) =>
      lista.reduce(
        (t: number, x: any) => t + (x.address?.toLowerCase() === addr ? Number(x.amount_dog) || 0 : 0),
        0,
      )

    const gastou = somaDe(senders, target)
    const voltou = somaDe(receivers, target)
    if (gastou <= 0 && voltou <= 0) continue

    const delta = gastou - voltou
    const direction: 'in' | 'out' | 'self' =
      delta > DUST_DOG ? 'out' : delta < -DUST_DOG ? 'in' : 'self'
    // no 'self' o delta é zero por definição; mostrar zero esconderia um evento
    // que existiu, então a linha carrega o que foi remexido, com seta neutra
    const amount_dog = direction === 'self' ? gastou : Math.abs(delta)

    // contraparte é quem RECEBEU SEM TER MANDADO. Sem esta regra o próprio
    // endereço de troco de um terceiro aparecia como destinatário da carteira.
    const destinatarios = receivers.filter(
      (r: any) => !enderecosQueMandaram.has(r.address?.toLowerCase()),
    )
    const otherAddrs = [
      ...senders.filter((s: any) => s.address?.toLowerCase() !== target).map((s: any) => s.address),
      ...destinatarios.filter((r: any) => r.address?.toLowerCase() !== target).map((r: any) => r.address),
    ]
    const counterparties = Array.from(new Set(otherAddrs.filter(Boolean)))

    // o "total movido" da linha também passa a ser líquido: era o bruto em
    // 451.930 das 452.034 linhas com troco
    const nt = netTransfer(senders, receivers)
    const total_dog_moved =
      senders.length || receivers.length ? nt.net : Number(row.total_dog_moved) || 0

    entries.push({
      txid: row.txid,
      block_height: row.block_height,
      timestamp: row.timestamp,
      direction,
      amount_dog,
      counterparty: counterparties.length === 1 ? counterparties[0] : null,
      counterparties,
      total_dog_moved,
      fee_sats: row.fee_sats || 0,
    })
  }
  return entries
}

// ─── Labels ──────────────────────────────────────────────────────────────────

function getTierLabel(total_dog: number): AddressLabel {
  if (total_dog >= 500_000_000) return { id: 'whale',   text: 'Whale',   description: 'Top 10 holder' }
  if (total_dog >= 100_000_000) return { id: 'shark',   text: 'Shark',   description: 'Top 50 holder' }
  if (total_dog >=  50_000_000) return { id: 'dolphin', text: 'Dolphin', description: 'Top 100 holder' }
  if (total_dog >=  10_000_000) return { id: 'fish',    text: 'Fish',    description: 'Top 1,000 holder' }
  if (total_dog >=   1_000_000) return { id: 'shrimp',  text: 'Shrimp',  description: 'Top 10,000 holder' }
  return { id: 'plankton', text: 'Holder', description: 'DOG holder' }
}

const behaviorLabelMap: Record<string, { text: string; description: string }> = {
  diamond_paws:      { text: 'Diamond Paws',      description: 'Held exact airdrop amount' },
  dog_legend:        { text: 'DOG Legend',        description: 'Major accumulator' },
  hodl_hero:         { text: 'HODL Hero',         description: 'Long-term holder' },
  satoshi_visionary: { text: 'Satoshi Visionary', description: 'Early believer' },
  rune_master:       { text: 'Rune Master',       description: 'Rune-native holder' },
  steady_holder:     { text: 'Steady Holder',     description: 'Consistent holding' },
  ordinal_believer:  { text: 'Ordinal Believer',  description: 'Ordinal-focused holder' },
  btc_maximalist:    { text: 'BTC Maximalist',    description: 'BTC-first behavior' },
  paper_hands:       { text: 'Paper Hands',       description: 'Sold airdrop' },
  panic_seller:      { text: 'Panic Seller',      description: 'Sold during dips' },
  profit_taker:      { text: 'Profit Taker',      description: 'Took profits strategically' },
  early_exit:        { text: 'Early Exit',        description: 'Sold early' },
}

function computeLabels(holder: HolderEntry | null, forensic: ForensicProfile | null): AddressLabel[] {
  const labels: AddressLabel[] = []
  if (holder) {
    labels.push(getTierLabel(holder.total_dog))
    if (holder.rank <= 10)       labels.push({ id: 'top10',  text: 'Top 10 Holder',  description: 'Rank #' + holder.rank })
    else if (holder.rank <= 100) labels.push({ id: 'top100', text: 'Top 100 Holder', description: 'Rank #' + holder.rank })
  }
  if (forensic) {
    labels.push({ id: 'airdrop_og', text: 'Airdrop OG', description: `Airdrop rank #${forensic.airdrop_rank}` })
    const bl = behaviorLabelMap[forensic.behavior_pattern]
    if (bl) labels.push({ id: forensic.behavior_pattern, ...bl })
    if (forensic.current_balance > forensic.airdrop_amount) {
      labels.push({ id: 'accumulator', text: 'Accumulator', description: 'Bought more after airdrop' })
    }
  }
  return labels
}

function computeStats(txs: TxEntry[]) {
  let total_received = 0, total_sent = 0
  let first_ts: string | null = null, last_ts: string | null = null
  let first_block: number | null = null, last_block: number | null = null
  let largest_receive = 0, largest_send = 0

  for (const tx of txs) {
    if (tx.direction === 'in') {
      total_received += tx.amount_dog
      if (tx.amount_dog > largest_receive) largest_receive = tx.amount_dog
    } else if (tx.direction === 'out') {
      total_sent += tx.amount_dog
      if (tx.amount_dog > largest_send) largest_send = tx.amount_dog
    }
    if (!first_block || tx.block_height < first_block) {
      first_block = tx.block_height
      first_ts = tx.timestamp
    }
    if (!last_block || tx.block_height > last_block) {
      last_block = tx.block_height
      last_ts = tx.timestamp
    }
  }

  return {
    total_received_dog: total_received,
    total_sent_dog: total_sent,
    first_tx_timestamp: first_ts,
    last_tx_timestamp: last_ts,
    first_tx_block: first_block,
    last_tx_block: last_block,
    largest_single_receive: largest_receive,
    largest_single_send: largest_send,
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params
  const address = rawAddress.trim()
  const addressLower = address.toLowerCase()

  const sp = req.nextUrl.searchParams
  const txLimitRaw = Number(sp.get('limit') ?? '0')
  const txOffsetRaw = Number(sp.get('offset') ?? '0')
  const direction = sp.get('direction')
  const wantsPagination = sp.has('limit') || sp.has('offset') || sp.has('direction')
  const txLimit = Number.isFinite(txLimitRaw) && txLimitRaw > 0
    ? Math.min(Math.floor(txLimitRaw), 500)
    : 50
  const txOffset = Number.isFinite(txOffsetRaw) && txOffsetRaw >= 0 ? Math.floor(txOffsetRaw) : 0

  try {
    const [holdersData, forensicData, txQuery, blockQuery] = await Promise.all([
      getHoldersMap(),
      getForensicMap(),
      supabase
        .from('dog_transactions')
        .select('txid, block_height, timestamp, total_dog_moved, fee_sats, senders, receivers')
        .contains('addresses', [address])
        .order('block_height', { ascending: false })
        .limit(10000),
      supabase
        .from('dog_transactions')
        .select('block_height')
        .order('block_height', { ascending: false })
        .limit(1)
        .single(),
    ])

    if (txQuery.error) throw new Error(`Supabase tx query failed: ${txQuery.error.message}`)

    const holder = holdersData.map.get(addressLower) || null
    const forensic = forensicData.get(addressLower) || null

    let transactions: TxEntry[] = rowsToTxEntries((txQuery.data as SupabaseRow[]) || [], address)

    // Reconcile current balance against indexed tx history. The indexer starts
    // at block 840,654 — the DOG airdrop (~block 840,000) and any pre-range
    // activity is invisible. For holders, attribute the unexplained delta as
    // a synthetic "pre-indexed" entry so totals reconcile with current balance.
    if (holder && holder.total_dog > 0) {
      const indexedNet = transactions.reduce(
        (acc, t) => acc + (t.direction === 'in' ? t.amount_dog : t.direction === 'out' ? -t.amount_dog : 0),
        0,
      )
      const unexplained = holder.total_dog - indexedNet
      if (unexplained >= 1) {
        transactions.push({
          txid: 'pre-indexed-synthetic',
          block_height: 840000,
          timestamp: '2024-04-20T00:00:00.000Z',
          direction: 'in',
          amount_dog: unexplained,
          counterparty: null,
          counterparties: [],
          total_dog_moved: unexplained,
          fee_sats: 0,
          synthetic: true,
          synthetic_label: forensic?.airdrop_amount
            ? `DOG Airdrop + pre-indexed activity (~block 840,000)`
            : `Pre-indexed activity (incl. DOG airdrop, ~block 840,000)`,
        })
        transactions.sort((a, b) => b.block_height - a.block_height)
      }
    }

    if (!holder && !forensic && transactions.length === 0) {
      return NextResponse.json({
        address,
        status: 'not_a_dog_holder',
        holder: null,
        forensic: null,
        labels: [],
        transactions: [],
        tx_count: 0,
        stats: computeStats([]),
        metadata: {
          indexed_blocks: 0,
          last_updated: new Date().toISOString(),
          total_holders: holdersData.total,
        },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      })
    }

    const lastIndexedBlock = blockQuery.data?.block_height ?? 0

    const status = holder ? 'holder' : forensic ? 'forensic_only' : 'tx_only'

    const holderPayload = holder
      ? {
          rank: holder.rank,
          total_dog: holder.total_dog,
          total_amount: holder.total_amount,
          utxo_count: holder.utxo_count,
          percentile: parseFloat(((holder.rank / holdersData.total) * 100).toFixed(4)),
        }
      : null

    const forensicPayload = forensic
      ? {
          behavior_pattern: forensic.behavior_pattern,
          behavior_detail: forensic.behavior_detail,
          airdrop_rank: forensic.airdrop_rank,
          airdrop_amount: forensic.airdrop_amount,
          current_balance: forensic.current_balance,
          retention_rate: forensic.retention_rate,
          diamond_score: forensic.diamond_score,
          is_dumping: forensic.is_dumping,
          insights: forensic.insights,
        }
      : null

    const filteredTxs = direction === 'in' || direction === 'out'
      ? transactions.filter(t => t.direction === direction)
      : transactions

    const totalTxs = filteredTxs.length
    const pagedTxs = wantsPagination
      ? filteredTxs.slice(txOffset, txOffset + txLimit)
      : filteredTxs

    return NextResponse.json({
      address,
      status,
      holder: holderPayload,
      forensic: forensicPayload,
      labels: computeLabels(holder, forensic),
      // ⚠️ QUEM É O DONO. A página de holders já mostrava isto pelo
      // `verified_addresses.json` no cliente; aqui não existia, então a mesma
      // carteira era "Bitget" numa tela e um endereço anônimo na outra.
      entity: await resolveIdentity(address),
      transactions: pagedTxs,
      tx_count: totalTxs,
      stats: computeStats(transactions),
      pagination: wantsPagination
        ? {
            offset: txOffset,
            limit: txLimit,
            total: totalTxs,
            has_more: txOffset + txLimit < totalTxs,
            direction: direction ?? 'all',
          }
        : null,
      last_updated: new Date().toISOString(),
      metadata: {
        indexed_blocks: lastIndexedBlock,
        last_updated: new Date().toISOString(),
        total_holders: holdersData.total,
        block_range: { from: 840654, to: lastIndexedBlock },
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err: any) {
    console.error('[address route] error:', err)
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 })
  }
}
