import { memoryCache } from '@/lib/cache'
import { ChainHolder, ChainTransaction, ChainTransfer, DOG_TOKENS } from './types'

const TOKEN_MINT = DOG_TOKENS.solana.address
const DECIMALS = DOG_TOKENS.solana.decimals
const CACHE_TTL = 5 * 60 * 1000 // 5 min

function getApiKey(): string {
  const key = process.env.HELIUS_API_KEY
  if (!key) throw new Error('HELIUS_API_KEY is not set')
  return key
}

function rpcUrl(): string {
  return `https://mainnet.helius-rpc.com/?api-key=${getApiKey()}`
}

function enhancedUrl(): string {
  return `https://api-mainnet.helius-rpc.com`
}

async function rpcCall<T>(method: string, params: any): Promise<T> {
  const resp = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!resp.ok) throw new Error(`Helius RPC ${method}: ${resp.status}`)
  const json = await resp.json()
  if (json.error) throw new Error(`Helius RPC ${method}: ${json.error.message}`)
  return json.result as T
}

// === Supply ===

interface TokenSupplyResult {
  context: { slot: number }
  value: {
    amount: string
    decimals: number
    uiAmountString: string
  }
}

export async function getSolanaSupply(): Promise<number> {
  const cacheKey = 'helius:supply'
  const cached = memoryCache.get<number>(cacheKey)
  if (cached !== null) return cached

  const result = await rpcCall<TokenSupplyResult>('getTokenSupply', [TOKEN_MINT])
  const supply = parseFloat(result.value.uiAmountString) || 0
  memoryCache.set(cacheKey, supply, CACHE_TTL)
  return supply
}

// === Top Holders (largest accounts) ===

interface LargestAccount {
  address: string // token account address
  amount: string
  decimals: number
  uiAmountString: string
}

interface TokenAccountInfo {
  parsed: {
    info: {
      owner: string
      mint: string
      tokenAmount: {
        uiAmountString: string
      }
    }
  }
}

async function resolveOwner(tokenAccount: string): Promise<string> {
  try {
    const result = await rpcCall<{ value: TokenAccountInfo }>('getAccountInfo', [
      tokenAccount,
      { encoding: 'jsonParsed' },
    ])
    return result.value?.parsed?.info?.owner || tokenAccount
  } catch {
    return tokenAccount
  }
}

export async function getSolanaHolders(limit = 20): Promise<{
  holders: ChainHolder[]
  total_count: number
  bridgeSupply: number
}> {
  const cacheKey = `helius:holders:${limit}`
  const cached = memoryCache.get<{ holders: ChainHolder[]; total_count: number; bridgeSupply: number }>(cacheKey)
  if (cached) return cached

  const totalSupply = await getSolanaSupply()

  // Get largest accounts
  const result = await rpcCall<{ context: { slot: number }; value: LargestAccount[] }>(
    'getTokenLargestAccounts',
    [TOKEN_MINT]
  )

  const accounts = result.value || []

  // The largest account (~97.9%) is the bridge/treasury — real circulating = total - bridge
  const largestBalance = accounts.length > 0 ? parseFloat(accounts[0].uiAmountString) : 0
  const isBridge = largestBalance > totalSupply * 0.5 // if holds >50%, it's the bridge
  const bridgeSupply = isBridge ? largestBalance : 0
  const circulatingOnSolana = totalSupply - bridgeSupply

  // Resolve owner wallets and build holder list (skip bridge account)
  const holdersToProcess = isBridge ? accounts.slice(1) : accounts
  const holdersSlice = holdersToProcess.slice(0, limit)

  // Resolve owners in parallel (batched)
  const owners = await Promise.all(holdersSlice.map(a => resolveOwner(a.address)))

  const holders: ChainHolder[] = holdersSlice.map((a, i) => {
    const balance = parseFloat(a.uiAmountString)
    return {
      chain: 'solana' as const,
      address: owners[i],
      balance,
      balance_usd: null, // will be enriched by caller with price
      percentage_of_supply: circulatingOnSolana > 0 ? (balance / circulatingOnSolana) * 100 : 0,
      rank: i + 1,
      last_active: null,
    }
  })

  // Get approximate total holder count via DAS pagination
  let totalHolderCount = 0
  try {
    const dasResult = await rpcCall<{ total: number; token_accounts: any[] }>(
      'getTokenAccounts',
      { mint: TOKEN_MINT, page: 1, limit: 1 }
    )
    // DAS total = limit when there are more, so we need Birdeye for count
    // For now use the holder count from Birdeye (already fetched by caller)
    totalHolderCount = dasResult.token_accounts?.length > 0 ? -1 : 0 // -1 = unknown but exists
  } catch {
    totalHolderCount = -1
  }

  const res = { holders, total_count: totalHolderCount, bridgeSupply }
  memoryCache.set(cacheKey, res, CACHE_TTL)
  return res
}

// === Transactions (Enhanced API) ===

interface HeliusTransaction {
  description: string
  type: string
  source: string
  fee: number
  feePayer: string
  signature: string
  slot: number
  timestamp: number
  tokenTransfers: Array<{
    fromUserAccount: string
    toUserAccount: string
    tokenAmount: number
    mint: string
  }>
  nativeTransfers: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
}

// Normalize Helius source names to human-readable protocol labels
function normalizeSource(source: string): string | undefined {
  const map: Record<string, string> = {
    RAYDIUM: 'Raydium',
    JUPITER: 'Jupiter',
    ORCA: 'Orca',
    METEORA: 'Meteora',
    MAGIC_EDEN: 'Magic Eden',
    TENSOR: 'Tensor',
    DRIFT: 'Drift',
    MANGO: 'Mango',
    OPENBOOK: 'OpenBook',
    PHOENIX: 'Phoenix',
    LIFINITY: 'Lifinity',
    ALDRIN: 'Aldrin',
    CREMA: 'Crema',
    STEP: 'Step Finance',
    COINFRA: 'Coinfra',
    UNKNOWN: '',
  }
  const mapped = map[source]
  if (mapped !== undefined) return mapped || undefined
  return source && source !== 'UNKNOWN' ? source : undefined
}

export async function getSolanaTransactions(limit = 30): Promise<{
  transactions: ChainTransaction[]
  total_count: number
}> {
  const cacheKey = `helius:txs:${limit}`
  const cached = memoryCache.get<{ transactions: ChainTransaction[]; total_count: number }>(cacheKey)
  if (cached) return cached

  const url = `${enhancedUrl()}/v0/addresses/${TOKEN_MINT}/transactions?api-key=${getApiKey()}&limit=${limit}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Helius Enhanced API: ${resp.status}`)

  const data: HeliusTransaction[] = await resp.json()

  const transactions: ChainTransaction[] = []

  for (const tx of data) {
    // Find all DOG token transfers in this transaction
    const dogTransfers = (tx.tokenTransfers || []).filter(t => t.mint === TOKEN_MINT)
    if (dogTransfers.length === 0) continue

    // Use the largest DOG transfer as the primary from/to
    const mainTransfer = dogTransfers.reduce((a, b) => a.tokenAmount > b.tokenAmount ? a : b)

    // Total DOG moved = sum of all outgoing DOG transfers
    const totalAmount = dogTransfers.reduce((sum, t) => sum + t.tokenAmount, 0)

    const txType = tx.type === 'SWAP' ? 'swap' as const
      : tx.type === 'TRANSFER' ? 'transfer' as const
      : 'transfer' as const

    // All individual DOG transfers (for multi-hop / multi-output visibility)
    const allTransfers: ChainTransfer[] = dogTransfers.map(t => ({
      from: t.fromUserAccount,
      to: t.toUserAccount,
      amount: t.tokenAmount,
    }))

    // Fee: Helius returns lamports — convert to SOL (1 SOL = 1e9 lamports)
    const feeInSol = tx.fee > 0 ? tx.fee / 1_000_000_000 : undefined

    const protocol = normalizeSource(tx.source)

    // Description: use Helius description when meaningful, otherwise omit
    const description = tx.description && tx.description.length > 0 && tx.description !== 'Unknown'
      ? tx.description
      : undefined

    transactions.push({
      chain: 'solana',
      tx_id: tx.signature,
      type: txType,
      from_address: mainTransfer.fromUserAccount || tx.feePayer,
      to_address: mainTransfer.toUserAccount || '',
      amount: totalAmount,
      amount_usd: null,
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
      block_height: tx.slot,
      protocol,
      description,
      fee: feeInSol,
      fee_token: 'SOL',
      all_transfers: allTransfers.length > 1 ? allTransfers : undefined,
    })
  }

  const result = { transactions, total_count: transactions.length }
  memoryCache.set(cacheKey, result, CACHE_TTL)
  return result
}
