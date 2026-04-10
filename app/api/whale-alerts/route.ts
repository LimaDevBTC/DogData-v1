import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { getStacksTransactionsResilient } from '@/lib/multichain/stacks-resilient'
import { getSolanaTransactions } from '@/lib/multichain/helius'
import type { ChainTransaction } from '@/lib/multichain/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────

type AlertChain = 'bitcoin' | 'stacks' | 'solana'

interface TxParticipant {
  address: string
  amount: number
  amount_dog: number
  has_dog: boolean
  is_change?: boolean
}

interface BitcoinTransaction {
  txid: string
  block_height: number
  timestamp: string
  type: string
  senders: TxParticipant[]
  receivers: TxParticipant[]
  sender_count: number
  receiver_count: number
  total_dog_in: number
  total_dog_out: number
  total_dog_moved: number
  net_transfer: number
  change_amount: number
  has_change: boolean
  fee_sats?: number
}

interface WhaleAlert {
  chain: AlertChain
  txid: string
  txid_short: string
  total_dog_moved: number
  total_dog_formatted: string
  usd_value: string
  usd_value_raw: number
  type: string
  classification: string
  severity: 'MEGA' | 'HIGH' | 'MEDIUM' | 'ALERT'
  from: string
  from_short: string
  to: string
  to_short: string
  senders: { address: string; address_short: string; amount_dog: number; amount_formatted: string }[]
  receivers: { address: string; address_short: string; amount_dog: number; amount_formatted: string; is_change: boolean }[]
  sender_count: number
  receiver_count: number
  net_transfer: number
  net_transfer_formatted: string
  block_height: number | null
  timestamp: string
  time_ago: string
  explorer_url: string
  dogdata_url: string
  context: string
  tweet: string
  // Enrichment fields (populated for Stacks and Solana when available)
  protocol?: string
  description?: string
  fee?: number
  fee_token?: string
  transfer_count?: number  // number of DOG transfer legs in the tx
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatDogAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return amount.toFixed(2)
}

function formatUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
  return `$${amount.toFixed(2)}`
}

function shortenAddress(address: string): string {
  if (address.length <= 16) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getSeverity(dogAmount: number): WhaleAlert['severity'] {
  if (dogAmount >= 100_000_000) return 'MEGA'
  if (dogAmount >= 10_000_000) return 'HIGH'
  if (dogAmount >= 5_000_000) return 'MEDIUM'
  return 'ALERT'
}

const CHAIN_LABELS: Record<AlertChain, string> = {
  bitcoin: 'Bitcoin L1',
  stacks: 'Stacks',
  solana: 'Solana',
}

const CHAIN_EMOJIS: Record<AlertChain, string> = {
  bitcoin: '₿',
  stacks: 'Ⓢ',
  solana: '◎',
}

function explorerUrl(chain: AlertChain, txid: string): string {
  switch (chain) {
    case 'bitcoin':
      return `https://mempool.space/tx/${txid}`
    case 'stacks':
      return `https://explorer.hiro.so/txid/${txid}`
    case 'solana':
      return `https://solscan.io/tx/${txid}`
  }
}

// ─── Bitcoin-specific classification ─────────────────────────────

function classifyBitcoinTx(tx: BitcoinTransaction): string {
  if (tx.type === 'consolidation') return 'Consolidation'
  if (tx.type === 'split') return 'Split / Distribution'

  const receivers = tx.receivers || []
  const senders = tx.senders || []

  const hasRoundReceiver = receivers.some(r => {
    const dog = r.amount_dog
    return dog >= 100_000 && (dog % 1_000_000 === 0 || dog % 500_000 === 0 || dog % 100_000 === 0)
  })

  if (senders.length > 1 && receivers.length <= 2) return 'Consolidation'
  if (senders.length === 1 && receivers.length > 3) return 'Distribution'
  if (hasRoundReceiver) return 'Possible Exchange / OTC'
  if (tx.net_transfer > 0 && senders.length === 1 && receivers.length <= 2) return 'Direct Transfer'

  return 'Transfer'
}

function classifyMultichainTx(tx: ChainTransaction): string {
  if (tx.type === 'swap') {
    return tx.protocol ? `DEX Swap via ${tx.protocol}` : 'DEX Swap'
  }
  if (tx.type === 'bridge') {
    return tx.protocol ? `Bridge Transfer via ${tx.protocol}` : 'Bridge Transfer'
  }
  // Use description-derived type from Tenero transfer_type when available
  if (tx.description) return tx.description
  return 'Transfer'
}

// ─── Build context/tweet ─────────────────────────────────────────

function buildBitcoinContext(tx: BitcoinTransaction, classification: string): string {
  const parts: string[] = []
  const senders = tx.senders || []
  const receivers = tx.receivers || []

  if (senders.length > 1) parts.push(`${senders.length} wallets consolidated`)
  if (receivers.length > 1) {
    const nonChange = receivers.filter(r => !r.is_change)
    parts.push(`sent to ${nonChange.length} recipient${nonChange.length > 1 ? 's' : ''}`)
  }
  if (classification.includes('Exchange') || classification.includes('OTC')) {
    const roundReceiver = receivers.find(r => {
      const dog = r.amount_dog
      return dog >= 100_000 && (dog % 1_000_000 === 0 || dog % 500_000 === 0 || dog % 100_000 === 0)
    })
    if (roundReceiver) {
      parts.push(`round amount ${formatDogAmount(roundReceiver.amount_dog)} DOG (likely exchange or OTC)`)
    }
  }
  if (tx.has_change) parts.push(`${formatDogAmount(tx.change_amount)} DOG returned as change`)

  return parts.length > 0 ? parts.join('. ') + '.' : `${classification} of ${formatDogAmount(tx.total_dog_moved)} DOG.`
}

function buildMultichainContext(tx: ChainTransaction, classification: string): string {
  const parts = [`${classification} on ${CHAIN_LABELS[tx.chain as AlertChain]}`]
  if (tx.from_address) parts.push(`from ${shortenAddress(tx.from_address)}`)
  if (tx.to_address) parts.push(`to ${shortenAddress(tx.to_address)}`)
  if (tx.amount_usd) parts.push(`(${formatUSD(tx.amount_usd)})`)
  if (tx.all_transfers && tx.all_transfers.length > 1) {
    parts.push(`— ${tx.all_transfers.length} transfer legs`)
  }
  if (tx.fee != null && tx.fee_token) {
    parts.push(`fee: ${tx.fee.toFixed(6)} ${tx.fee_token}`)
  }
  return parts.join(' ') + '.'
}

function buildTweet(alert: Omit<WhaleAlert, 'tweet'>): string {
  // 3-tier alert system:
  //   ALERT  (1M–5M)   → normal  ⚪
  //   MEDIUM (5M–10M)  → médio   🟡
  //   HIGH   (10M–99M) → forte   🔴
  //   MEGA   (100M+)   → forte   🔴🔴
  const isStrong = alert.severity === 'HIGH' || alert.severity === 'MEGA'
  const isMega   = alert.severity === 'MEGA'

  const headerEmoji = isMega ? '🔴🔴' : isStrong ? '🔴' : alert.severity === 'MEDIUM' ? '🟡' : '⚪'
  const alertLabel  = isMega ? 'MEGA WHALE ALERT'
    : isStrong        ? 'WHALE ALERT 🚨'
    : alert.severity === 'MEDIUM' ? 'WHALE ALERT'
    : 'WHALE ALERT'

  const chainEmoji = CHAIN_EMOJIS[alert.chain]
  const chainLabel = CHAIN_LABELS[alert.chain]

  const lines = [
    `${headerEmoji} DOG ${alertLabel} ${chainEmoji} ${chainLabel}`,
    '',
    `${alert.total_dog_formatted} DOG (${alert.usd_value}) moved`,
    '',
    `${alert.from_short} → ${alert.to_short}`,
  ]

  if (alert.classification !== 'Transfer' && alert.classification !== 'Direct Transfer') {
    lines.push(`Type: ${alert.classification}`)
  }

  lines.push('')
  if (alert.block_height) {
    lines.push(`Block ${alert.block_height.toLocaleString()} | ${alert.time_ago}`)
  } else {
    lines.push(alert.time_ago)
  }
  lines.push(alert.explorer_url)
  lines.push('')
  lines.push('Powered by DOG DATA | dogdata.xyz')

  return lines.join('\n')
}

// ─── Fetch price ──────────────────────────────────────────────────

async function getDogPrice(): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/price/kraken`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json()
      return parseFloat(data.price || data.last_price || '0')
    }
  } catch {}
  return 0
}

// ─── Chain fetchers ───────────────────────────────────────────────

async function fetchBitcoinWhales(threshold: number, limit: number, dogPrice: number): Promise<WhaleAlert[]> {
  const cacheDataRaw = await redisClient.get('dog:transactions')
  let txData: any = null

  if (cacheDataRaw) {
    txData = typeof cacheDataRaw === 'string' ? JSON.parse(cacheDataRaw) : cacheDataRaw
  }

  if (!txData?.transactions) return []

  const transactions: BitcoinTransaction[] = txData.transactions
  const whales = transactions
    // Use net_transfer (real DOG that changed hands, excluding change outputs)
    // Fall back to total_dog_moved for old cached data that lacks net_transfer
    .filter(tx => {
      const realMoved = (tx.net_transfer != null && tx.net_transfer > 0) ? tx.net_transfer : tx.total_dog_moved
      return realMoved >= threshold
    })
    .sort((a, b) => {
      const aReal = (a.net_transfer != null && a.net_transfer > 0) ? a.net_transfer : a.total_dog_moved
      const bReal = (b.net_transfer != null && b.net_transfer > 0) ? b.net_transfer : b.total_dog_moved
      return bReal - aReal
    })
    .slice(0, limit)

  return whales.map(tx => {
    // Real amount = net_transfer (excludes change UTXOs back to sender)
    const realMoved = (tx.net_transfer != null && tx.net_transfer > 0) ? tx.net_transfer : tx.total_dog_moved

    const classification = classifyBitcoinTx(tx)
    const severity = getSeverity(realMoved)
    const usdValueRaw = realMoved * dogPrice

    const senders = (tx.senders || []).map(s => ({
      address: s.address,
      address_short: shortenAddress(s.address),
      amount_dog: s.amount_dog,
      amount_formatted: `${formatDogAmount(s.amount_dog)} DOG`,
    }))

    const receivers = (tx.receivers || []).map(r => ({
      address: r.address,
      address_short: shortenAddress(r.address),
      amount_dog: r.amount_dog,
      amount_formatted: `${formatDogAmount(r.amount_dog)} DOG`,
      is_change: r.is_change || false,
    }))

    const primarySender = senders[0]?.address || ''
    const primaryReceiver = receivers.find(r => !r.is_change)?.address || receivers[0]?.address || ''

    const alertBase = {
      chain: 'bitcoin' as AlertChain,
      txid: tx.txid,
      txid_short: `${tx.txid.slice(0, 8)}...${tx.txid.slice(-6)}`,
      total_dog_moved: realMoved,
      total_dog_formatted: `${formatDogAmount(realMoved)}`,
      usd_value: dogPrice > 0 ? formatUSD(usdValueRaw) : 'N/A',
      usd_value_raw: Math.round(usdValueRaw * 100) / 100,
      type: tx.type,
      classification,
      severity,
      from: primarySender,
      from_short: shortenAddress(primarySender),
      to: primaryReceiver,
      to_short: shortenAddress(primaryReceiver),
      senders,
      receivers,
      sender_count: tx.sender_count,
      receiver_count: tx.receiver_count,
      net_transfer: tx.net_transfer,
      net_transfer_formatted: `${formatDogAmount(tx.net_transfer)} DOG`,
      block_height: tx.block_height,
      timestamp: tx.timestamp,
      time_ago: timeAgo(tx.timestamp),
      explorer_url: explorerUrl('bitcoin', tx.txid),
      dogdata_url: `https://www.dogdata.xyz/transactions?search=${tx.txid}`,
      context: buildBitcoinContext(tx, classification),
    }

    return { ...alertBase, tweet: buildTweet(alertBase) }
  })
}

function chainTxToAlert(tx: ChainTransaction, dogPrice: number): WhaleAlert {
  const chain = tx.chain as AlertChain
  const classification = classifyMultichainTx(tx)
  const severity = getSeverity(tx.amount)
  const usdValueRaw = tx.amount_usd ?? tx.amount * dogPrice

  // Build senders/receivers from all_transfers when available, else single entry
  const allTransfers = tx.all_transfers ?? [{ from: tx.from_address, to: tx.to_address, amount: tx.amount }]

  const senders = allTransfers.map(t => ({
    address: t.from,
    address_short: shortenAddress(t.from),
    amount_dog: t.amount,
    amount_formatted: `${formatDogAmount(t.amount)} DOG`,
  }))

  const receivers = allTransfers.map(t => ({
    address: t.to,
    address_short: shortenAddress(t.to),
    amount_dog: t.amount,
    amount_formatted: `${formatDogAmount(t.amount)} DOG`,
    is_change: false,
  }))

  const alertBase = {
    chain,
    txid: tx.tx_id,
    txid_short: `${tx.tx_id.slice(0, 8)}...${tx.tx_id.slice(-6)}`,
    total_dog_moved: tx.amount,
    total_dog_formatted: formatDogAmount(tx.amount),
    usd_value: usdValueRaw > 0 ? formatUSD(usdValueRaw) : 'N/A',
    usd_value_raw: Math.round(usdValueRaw * 100) / 100,
    type: tx.type,
    classification,
    severity,
    from: tx.from_address,
    from_short: shortenAddress(tx.from_address),
    to: tx.to_address,
    to_short: shortenAddress(tx.to_address),
    senders,
    receivers,
    sender_count: senders.length,
    receiver_count: receivers.length,
    net_transfer: tx.amount,
    net_transfer_formatted: `${formatDogAmount(tx.amount)} DOG`,
    block_height: tx.block_height,
    timestamp: tx.timestamp,
    time_ago: timeAgo(tx.timestamp),
    explorer_url: explorerUrl(chain, tx.tx_id),
    dogdata_url: `https://www.dogdata.xyz/transactions?search=${tx.tx_id}`,
    context: buildMultichainContext(tx, classification),
    // Enrichment fields
    ...(tx.protocol && { protocol: tx.protocol }),
    ...(tx.description && { description: tx.description }),
    ...(tx.fee != null && { fee: tx.fee, fee_token: tx.fee_token }),
    ...(allTransfers.length > 1 && { transfer_count: allTransfers.length }),
  }

  return { ...alertBase, tweet: buildTweet(alertBase) }
}

async function fetchStacksWhales(threshold: number, limit: number, dogPrice: number): Promise<WhaleAlert[]> {
  try {
    const { transactions } = await getStacksTransactionsResilient(100)
    return transactions
      .filter(tx => tx.amount >= threshold)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map(tx => chainTxToAlert(tx, dogPrice))
  } catch (err) {
    console.warn('[whale-alerts] Stacks fetch failed:', (err as Error).message)
    return []
  }
}

async function fetchSolanaWhales(threshold: number, limit: number, dogPrice: number): Promise<WhaleAlert[]> {
  try {
    const { transactions } = await getSolanaTransactions(100)
    return transactions
      .filter(tx => tx.amount >= threshold)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map(tx => chainTxToAlert(tx, dogPrice))
  } catch (err) {
    console.warn('[whale-alerts] Solana fetch failed:', (err as Error).message)
    return []
  }
}

// ─── Main handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const threshold = parseInt(url.searchParams.get('threshold') || '1000000', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const format = url.searchParams.get('format') || 'full' // full | tweet | compact
    const chainParam = url.searchParams.get('chain') // bitcoin | stacks | solana | null (all)

    const requestedChains: AlertChain[] = chainParam
      ? [chainParam as AlertChain]
      : ['bitcoin', 'stacks', 'solana']

    // Get current price for USD conversion
    const dogPrice = await getDogPrice()

    // Fetch whales from all requested chains in parallel
    const fetchers: Promise<WhaleAlert[]>[] = []

    if (requestedChains.includes('bitcoin')) {
      fetchers.push(fetchBitcoinWhales(threshold, limit, dogPrice))
    }
    if (requestedChains.includes('stacks')) {
      fetchers.push(fetchStacksWhales(threshold, limit, dogPrice))
    }
    if (requestedChains.includes('solana')) {
      fetchers.push(fetchSolanaWhales(threshold, limit, dogPrice))
    }

    const results = await Promise.all(fetchers)
    const allAlerts = results
      .flat()
      .sort((a, b) => b.total_dog_moved - a.total_dog_moved)
      .slice(0, limit)

    // Per-chain summary
    const chainSummary: Record<string, number> = {}
    for (const alert of allAlerts) {
      chainSummary[alert.chain] = (chainSummary[alert.chain] || 0) + 1
    }

    // Response based on format
    const response = {
      service: 'DOG DATA Whale Alerts',
      version: '2.0.0',
      chains: requestedChains,
      threshold: `${formatDogAmount(threshold)} DOG`,
      threshold_raw: threshold,
      dog_price_usd: dogPrice,
      total_alerts: allAlerts.length,
      alerts_by_chain: chainSummary,
      timestamp: new Date().toISOString(),
      alerts: format === 'tweet'
        ? allAlerts.map(a => ({
            chain: a.chain,
            txid: a.txid,
            severity: a.severity,
            tweet: a.tweet,
            explorer_url: a.explorer_url,
          }))
        : format === 'compact'
          ? allAlerts.map(a => ({
              chain: a.chain,
              txid_short: a.txid_short,
              amount: a.total_dog_formatted,
              usd: a.usd_value,
              severity: a.severity,
              classification: a.classification,
              from_short: a.from_short,
              to_short: a.to_short,
              time_ago: a.time_ago,
              explorer_url: a.explorer_url,
            }))
          : allAlerts,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
        'X-Whale-Count': String(allAlerts.length),
        'X-Threshold': String(threshold),
        'X-Chains': requestedChains.join(','),
      },
    })
  } catch (error: any) {
    console.error('Whale alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch whale alerts', message: error.message },
      { status: 500 }
    )
  }
}
