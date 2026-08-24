import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { netTransfer } from '@/lib/dog/net-transfer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface HolderEntry {
  rank: number
  address: string
  total_dog: number
}

interface ForensicProfile {
  address: string
  behavior_pattern: string
}

interface AddressLabel {
  id: string
  text: string
  description: string
}

let holdersMap: Map<string, HolderEntry> | null = null
let forensicMap: Map<string, ForensicProfile> | null = null

async function getHoldersMap(): Promise<Map<string, HolderEntry>> {
  if (holdersMap) return holdersMap
  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'dog_holders_by_address.json'), 'utf-8')
  const data = JSON.parse(raw)
  holdersMap = new Map()
  for (const h of data.holders || []) holdersMap.set(h.address.toLowerCase(), h)
  return holdersMap
}

async function getForensicMap(): Promise<Map<string, ForensicProfile>> {
  if (forensicMap) return forensicMap
  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'forensic_behavioral_analysis.json'), 'utf-8')
  const data = JSON.parse(raw)
  forensicMap = new Map()
  for (const p of data.all_profiles || []) forensicMap.set(p.address.toLowerCase(), p)
  return forensicMap
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function getTierLabel(total_dog: number): AddressLabel {
  if (total_dog >= 500_000_000) return { id: 'whale',   text: 'Whale',   description: 'Top 10 holder' }
  if (total_dog >= 100_000_000) return { id: 'shark',   text: 'Shark',   description: 'Top 50 holder' }
  if (total_dog >=  50_000_000) return { id: 'dolphin', text: 'Dolphin', description: 'Top 100 holder' }
  if (total_dog >=  10_000_000) return { id: 'fish',    text: 'Fish',    description: 'Top 1,000 holder' }
  if (total_dog >=   1_000_000) return { id: 'shrimp',  text: 'Shrimp',  description: 'Top 10,000 holder' }
  return { id: 'plankton', text: 'Holder', description: 'DOG holder' }
}

const behaviorLabels: Record<string, { text: string }> = {
  diamond_paws: { text: 'Diamond Paws' },
  dog_legend:   { text: 'DOG Legend' },
  hodl_hero:    { text: 'HODL Hero' },
  paper_hands:  { text: 'Paper Hands' },
  panic_seller: { text: 'Panic Seller' },
  rune_master:  { text: 'Rune Master' },
}

function enrichAddress(
  address: string | null,
  holders: Map<string, HolderEntry>,
  forensic: Map<string, ForensicProfile>
): { holder_rank: number | null; label: AddressLabel | null; is_known: boolean } {
  if (!address) return { holder_rank: null, label: null, is_known: false }
  const addrLower = address.toLowerCase()
  const holder = holders.get(addrLower)
  const profile = forensic.get(addrLower)

  let label: AddressLabel | null = null
  if (holder) {
    label = getTierLabel(holder.total_dog)
  } else if (profile) {
    const bl = behaviorLabels[profile.behavior_pattern]
    if (bl) label = { id: profile.behavior_pattern, text: bl.text, description: '' }
  }

  return {
    holder_rank: holder?.rank ?? null,
    label,
    is_known: !!(holder || profile),
  }
}

function classifyTx(
  senders: Array<{ amount_dog: number; holder_rank: number | null }>,
  receivers: Array<{ amount_dog: number; holder_rank: number | null; is_change: boolean; address: string | null }>,
): 'whale_movement' | 'airdrop_og_activity' | 'consolidation' | 'normal' {
  const dogReceivers = receivers.filter(r => r.amount_dog > 0 && !r.is_change && r.address)
  const senderAddrs = new Set(
    senders.filter(s => s.amount_dog > 0).map(s => (s as any).address?.toLowerCase()).filter(Boolean)
  )
  if (dogReceivers.length > 0 && dogReceivers.every(r => senderAddrs.has(r.address!.toLowerCase()))) {
    return 'consolidation'
  }

  const totalMoved = senders.reduce((s, x) => s + x.amount_dog, 0)
  if (totalMoved >= 1_000_000) return 'whale_movement'

  const hasHighRank = [...senders, ...receivers].some(p => p.holder_rank !== null && p.holder_rank <= 100)
  if (hasHighRank) return 'airdrop_og_activity'

  return 'normal'
}

function parseJsonArr(val: string | any[] | null | undefined): any[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

// ─── mempool.space enrichment ────────────────────────────────────────────────

interface MempoolVin {
  txid: string
  vout: number
  is_coinbase?: boolean
  prevout?: {
    scriptpubkey?: string
    scriptpubkey_address?: string | null
    scriptpubkey_type?: string
    value?: number
  } | null
}

interface MempoolVout {
  scriptpubkey?: string
  scriptpubkey_address?: string | null
  scriptpubkey_type?: string
  value: number
}

interface MempoolTx {
  txid: string
  vin: MempoolVin[]
  vout: MempoolVout[]
  size: number
  weight: number
  fee: number
  status: {
    confirmed: boolean
    block_height?: number
    block_time?: number
  }
}

async function fetchMempool<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DogData/1.0' },
    next: { revalidate: 600 },
  })
  if (!res.ok) throw new Error(`mempool.space ${url} → ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : (res.text() as any)
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txid: string }> }
) {
  const { txid: rawTxid } = await params
  const txid = rawTxid.trim().toLowerCase()

  if (!/^[0-9a-f]{64}$/.test(txid)) {
    return NextResponse.json({ error: 'Invalid txid format' }, { status: 400 })
  }

  try {
    const [holders, forensic, txQuery, mempoolTxRes, tipHeightRes] = await Promise.all([
      getHoldersMap(),
      getForensicMap(),
      supabase
        .from('dog_transactions')
        .select('txid, block_height, timestamp, type, fee_sats, total_dog_moved, senders, receivers')
        .eq('txid', txid)
        .maybeSingle(),
      fetchMempool<MempoolTx>(`https://mempool.space/api/tx/${txid}`).catch(() => null),
      fetchMempool<number | string>('https://mempool.space/api/blocks/tip/height').catch(() => null),
    ])

    if (txQuery.error) throw new Error(`Supabase tx query failed: ${txQuery.error.message}`)

    const rawTx = txQuery.data
    if (!rawTx) {
      // ⚠️ NÃO ESTAR NO HISTÓRICO NÃO É NÃO EXISTIR. A praça manda gente para cá:
      // cada foguete em órbita é uma transação de DOG que o NOSSO nó viu na
      // mempool, e o número dela é clicável. Até esta linha existir, quem clicava
      // caía num "transaction not found" para uma transação que a gente estava
      // literalmente desenhando na tela um segundo antes.
      //
      // `dog_mempool` é a tabela do watcher (scripts/dog_mempool_watcher.py), que
      // já acompanha o ciclo pending → confirmed → dropped. Aqui ela vira a
      // resposta quando o histórico ainda não tem a transação.
      const pend = await supabase
        .from('dog_mempool')
        .select('txid, status, first_seen, dog_in, dog_out, fee_sats, vsize, fee_rate, n_in, n_out, rbf, senders, receivers, block_height, confirmed_at, dropped_at')
        .eq('txid', txid)
        .maybeSingle()

      const m = pend.data
      if (!m) {
        return NextResponse.json({ error: 'Transaction not found', txid }, { status: 404 })
      }

      // ⚠️ O QUE A MEMPOOL SABE É MENOS DO QUE O HISTÓRICO SABE, e a resposta diz
      // isso em vez de fingir. Não há `vout` por saída nem valor em sats por
      // entrada: o watcher guarda endereço e DOG, que é o que a órbita precisa.
      // Os campos ausentes vão nulos, e a tela trata nulo como "ainda não".
      const mempoolReceivers = Array.isArray(m.receivers) ? m.receivers : parseJsonArr(m.receivers)
      const inputs = (m.senders || []).map((address: string, i: number) => ({
        position: i,
        address,
        sats: 0,
        script_type: null,
        amount_dog: 0,
        holder_rank: holders.get(String(address).toLowerCase())?.rank ?? null,
        label: null,
        is_known: holders.has(String(address).toLowerCase()),
      }))
      // ⚠️ AQUI A ORDEM NÃO MUDA, MAS O TROCO SE IDENTIFICA. Numa lista de saídas
      // a posição é o vout, então reordenar seria mentir sobre a transação. O que
      // faltava era a etiqueta: a página já desenha "change" quando o campo vem
      // preenchido, e o caminho confirmado já preenchia. Só a mempool não.
      const remetentes = new Set<string>(m.senders || [])
      const fluxo = netTransfer(m.senders, mempoolReceivers)
      const outputs = mempoolReceivers.map((r: any, i: number) => ({
        position: i,
        address: r.address ?? null,
        sats: 0,
        script_type: null,
        amount_dog: Number(r.dog ?? r.amount_dog ?? 0),
        holder_rank: holders.get(String(r.address).toLowerCase())?.rank ?? null,
        label: null,
        is_change: remetentes.has(r.address),
        is_known: holders.has(String(r.address).toLowerCase()),
      }))

      return NextResponse.json({
        txid,
        // ⚠️ `status` É O CAMPO NOVO, e a tela pinta por ele. `pending` é a órbita,
        // e é ele que vira amarelo.
        status: m.status,
        block_height: m.block_height ?? null,
        timestamp: m.confirmed_at || m.first_seen,
        first_seen: m.first_seen,
        type: 'transfer',
        size: null,
        vsize: m.vsize ?? null,
        weight: null,
        fee_sats: Number(m.fee_sats ?? 0),
        fee_rate: m.fee_rate != null ? Number(m.fee_rate) : null,
        confirmations: 0,
        // ⚠️ MESMO CONTRATO DA CONFIRMADA: `total_dog_moved` é o bruto e
        // `net_transfer` é o que mudou de mão. Assim a transação não muda de
        // valor ao pousar, e nenhum dos dois campos muda de sentido conforme a
        // linha ser da mempool ou do histórico.
        total_dog_moved: fluxo.gross,
        net_transfer: fluxo.net,
        change_amount: fluxo.change,
        has_change: fluxo.change > 0,
        rbf: m.rbf ?? null,
        inputs,
        outputs,
        classification: 'normal',
      }, {
        // ⚠️ SEM CACHE: uma transação pendente muda de estado a qualquer bloco, e
        // servir dez minutos de cache aqui é mostrar "em órbita" para algo que já
        // pousou. O caminho confirmado, logo abaixo, continua com cache longo.
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // ── DOG attribution maps (address → dog amount) ─────────────────────────
    const dogSenders = parseJsonArr(rawTx.senders).filter((s: any) => s.has_dog !== false && s.amount_dog > 0)
    const dogReceivers = parseJsonArr(rawTx.receivers).filter((r: any) => r.has_dog !== false && r.amount_dog > 0)

    const dogSenderMap = new Map<string, number>()
    for (const s of dogSenders) dogSenderMap.set(String(s.address).toLowerCase(), Number(s.amount_dog))

    const dogReceiverMap = new Map<string, { amount: number; is_change: boolean }>()
    for (const r of dogReceivers) {
      dogReceiverMap.set(String(r.address).toLowerCase(), {
        amount: Number(r.amount_dog),
        is_change: !!r.is_change,
      })
    }

    // ── Build inputs/outputs ────────────────────────────────────────────────
    type IO = {
      position: number
      address: string | null
      sats: number
      script_type: string | null
      amount_dog: number
      is_change?: boolean
      is_op_return?: boolean
      op_return_hex?: string
      holder_rank: number | null
      label: AddressLabel | null
      is_known: boolean
    }

    let inputs: IO[] = []
    let outputs: IO[] = []
    const seenInputDog = new Set<string>()
    const seenOutputDog = new Set<string>()

    if (mempoolTxRes) {
      mempoolTxRes.vin.forEach((vin, i) => {
        const addr = vin.prevout?.scriptpubkey_address ?? null
        const addrKey = addr?.toLowerCase() ?? null
        let amount_dog = 0
        if (addrKey && dogSenderMap.has(addrKey) && !seenInputDog.has(addrKey)) {
          amount_dog = dogSenderMap.get(addrKey)!
          seenInputDog.add(addrKey)
        }
        inputs.push({
          position: i + 1,
          address: addr,
          sats: vin.prevout?.value ?? 0,
          script_type: vin.prevout?.scriptpubkey_type ?? null,
          amount_dog,
          ...enrichAddress(addr, holders, forensic),
        })
      })

      mempoolTxRes.vout.forEach((vout, i) => {
        const addr = vout.scriptpubkey_address ?? null
        const addrKey = addr?.toLowerCase() ?? null
        const isOpReturn = vout.scriptpubkey_type === 'op_return'
        let amount_dog = 0
        let is_change = false
        if (addrKey && dogReceiverMap.has(addrKey) && !seenOutputDog.has(addrKey)) {
          const r = dogReceiverMap.get(addrKey)!
          amount_dog = r.amount
          is_change = r.is_change
          seenOutputDog.add(addrKey)
        }
        outputs.push({
          position: i + 1,
          address: isOpReturn ? null : addr,
          sats: vout.value,
          script_type: vout.scriptpubkey_type ?? null,
          amount_dog,
          is_change,
          is_op_return: isOpReturn,
          op_return_hex: isOpReturn ? vout.scriptpubkey : undefined,
          ...enrichAddress(isOpReturn ? null : addr, holders, forensic),
        })
      })
    } else {
      // Fallback: mempool.space unavailable — use stored DOG-only data
      inputs = dogSenders.map((s: any, i: number) => ({
        position: i + 1,
        address: s.address,
        sats: 0,
        script_type: null,
        amount_dog: Number(s.amount_dog),
        ...enrichAddress(s.address, holders, forensic),
      }))
      outputs = dogReceivers.map((r: any, i: number) => ({
        position: i + 1,
        address: r.address,
        sats: 0,
        script_type: null,
        amount_dog: Number(r.amount_dog),
        is_change: !!r.is_change,
        ...enrichAddress(r.address, holders, forensic),
      }))
    }

    // ── Fee / vsize / confirmations ─────────────────────────────────────────
    const size = mempoolTxRes?.size ?? null
    const weight = mempoolTxRes?.weight ?? null
    const vsize = weight !== null ? Math.ceil(weight / 4) : null
    const fee_sats = mempoolTxRes?.fee ?? rawTx.fee_sats ?? 0
    const fee_rate = vsize ? fee_sats / vsize : null

    let confirmations: number | null = null
    if (tipHeightRes !== null && rawTx.block_height) {
      const tip = typeof tipHeightRes === 'number' ? tipHeightRes : parseInt(String(tipHeightRes), 10)
      if (!isNaN(tip)) confirmations = Math.max(0, tip - rawTx.block_height + 1)
    }

    // ── Classification (uses DOG senders/receivers) ─────────────────────────
    const classification = classifyTx(
      dogSenders.map((s: any) => ({
        address: s.address,
        amount_dog: Number(s.amount_dog),
        ...enrichAddress(s.address, holders, forensic),
      })),
      dogReceivers.map((r: any) => ({
        address: r.address,
        amount_dog: Number(r.amount_dog),
        is_change: !!r.is_change,
        ...enrichAddress(r.address, holders, forensic),
      })),
    )

    return NextResponse.json({
      txid: rawTx.txid,
      status: 'confirmed',
      block_height: rawTx.block_height,
      timestamp: rawTx.timestamp,
      type: rawTx.type || 'transfer',
      size,
      vsize,
      weight,
      fee_sats,
      fee_rate,
      confirmations,
      total_dog_moved: rawTx.total_dog_moved || 0,
      inputs,
      outputs,
      classification,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    })
  } catch (err: any) {
    console.error('[tx route] error:', err)
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 })
  }
}
