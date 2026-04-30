/**
 * Hiro API integration for Stacks blockchain — fallback data source.
 *
 * Provides holder balances and transaction data directly from the Stacks
 * blockchain via Hiro's public API, independent of Tenero.
 *
 * Used as a fallback when Tenero is unavailable, and as the source for
 * data Tenero doesn't expose (ft balances, contract calls, etc.).
 *
 * Docs: https://docs.hiro.so/stacks/api
 */

import { ChainHolder, ChainTransaction, ChainTokenInfo, DOG_TOKENS } from './types'
import { probedFetch } from '@/lib/health-logger'

const BASE_URL = 'https://api.hiro.so'
const TOKEN_CONTRACT = DOG_TOKENS.stacks.address // SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-DOG
const [CONTRACT_PRINCIPAL, CONTRACT_NAME] = TOKEN_CONTRACT.split('.')
const TOKEN_ID = `${CONTRACT_PRINCIPAL}.${CONTRACT_NAME}::${CONTRACT_NAME}`

async function hiroFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  const apiKey = process.env.HIRO_API_KEY
  if (apiKey) headers['x-api-key'] = apiKey

  const resp = await probedFetch('external:hiro', `${BASE_URL}${path}`, {
    headers,
    cache: 'no-store', // Disable Next.js Data Cache — memoryCache handles TTL
    signal: AbortSignal.timeout(10_000),
  })

  if (!resp.ok) {
    throw new Error(`Hiro ${path}: ${resp.status} ${resp.statusText}`)
  }

  return resp.json() as Promise<T>
}

// === Token Info (from ft metadata + contract) ===

interface HiroFtMetadata {
  name: string
  symbol: string
  decimals: number
  total_supply: string
  token_uri: string
  sender_address: string
  tx_id: string
}

interface HiroFtHolders {
  total: number
  results: Array<{
    address: string
    balance: string
  }>
}

export async function getHiroTokenInfo(): Promise<ChainTokenInfo> {
  // Hiro doesn't have price data — we provide what we can
  const [metadata, holders] = await Promise.all([
    hiroFetch<HiroFtMetadata>(
      `/metadata/v1/ft/${TOKEN_CONTRACT}`
    ).catch(() => null),
    hiroFetch<HiroFtHolders>(
      `/extended/v1/tokens/ft/${TOKEN_ID}/holders?limit=1`
    ).catch(() => null),
  ])

  const decimals = metadata?.decimals ?? DOG_TOKENS.stacks.decimals
  const rawSupply = metadata?.total_supply ? BigInt(metadata.total_supply) : BigInt(0)
  const totalSupply = Number(rawSupply) / 10 ** decimals

  return {
    chain: 'stacks',
    address: TOKEN_CONTRACT,
    symbol: metadata?.symbol || 'DOG',
    name: metadata?.name || 'DOG.GO.TO.THE.MOON',
    decimals,
    price_usd: 0, // Hiro doesn't have pricing
    price_change_24h: 0,
    market_cap_usd: 0,
    volume_24h_usd: 0,
    liquidity_usd: null,
    holder_count: holders?.total ?? 0,
    total_supply: totalSupply,
    circulating_supply: totalSupply,
    last_updated: new Date().toISOString(),
  }
}

// === Holders ===

export async function getHiroHolders(limit = 50): Promise<{
  holders: ChainHolder[]
  total_count: number
}> {
  const data = await hiroFetch<HiroFtHolders>(
    `/extended/v1/tokens/ft/${TOKEN_ID}/holders?limit=${limit}`
  )

  const decimals = DOG_TOKENS.stacks.decimals
  const totalRaw = (data.results || []).reduce(
    (sum, h) => sum + Number(BigInt(h.balance) / BigInt(10 ** decimals)),
    0
  )

  const holders: ChainHolder[] = (data.results || []).map((h, i) => {
    const balance = Number(BigInt(h.balance)) / 10 ** decimals
    return {
      chain: 'stacks' as const,
      address: h.address,
      balance,
      balance_usd: null, // no price from Hiro
      percentage_of_supply: totalRaw > 0 ? (balance / totalRaw) * 100 : 0,
      rank: i + 1,
      last_active: null,
    }
  })

  return { holders, total_count: data.total ?? holders.length }
}

// === Transactions (contract calls + transfers) ===

interface HiroTxResult {
  tx_id: string
  tx_type: string
  tx_status: string
  block_height: number
  burn_block_time_iso: string
  sender_address: string
  token_transfer?: {
    recipient_address: string
    amount: string
  }
  contract_call?: {
    function_name: string
    contract_id: string
  }
  events?: Array<{
    event_type: string
    asset: {
      asset_event_type: string
      sender?: string
      recipient?: string
      amount?: string
    }
  }>
}

interface HiroTxListResponse {
  total: number
  results: HiroTxResult[]
}

export async function getHiroTransactions(limit = 50): Promise<{
  transactions: ChainTransaction[]
  total_count: number
}> {
  const data = await hiroFetch<HiroTxListResponse>(
    `/extended/v1/address/${CONTRACT_PRINCIPAL}.${CONTRACT_NAME}/transactions?limit=${limit}`
  )

  const decimals = DOG_TOKENS.stacks.decimals

  const transactions: ChainTransaction[] = (data.results || [])
    .filter(tx => tx.tx_status === 'success')
    .map(tx => {
      // Try to extract DOG token transfer events
      const ftEvent = tx.events?.find(
        e => e.event_type === 'fungible_token_asset' && e.asset?.amount
      )

      const amount = ftEvent?.asset?.amount
        ? Number(BigInt(ftEvent.asset.amount)) / 10 ** decimals
        : 0

      const isSwap = tx.contract_call?.function_name?.includes('swap') ?? false

      return {
        chain: 'stacks' as const,
        tx_id: tx.tx_id,
        type: isSwap ? 'swap' as const : 'transfer' as const,
        from_address: ftEvent?.asset?.sender || tx.sender_address,
        to_address: ftEvent?.asset?.recipient || tx.token_transfer?.recipient_address || '',
        amount,
        amount_usd: null,
        timestamp: tx.burn_block_time_iso,
        block_height: tx.block_height,
      }
    })
    .filter(tx => tx.amount > 0)

  return { transactions, total_count: data.total ?? transactions.length }
}
