import { NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { getLiveSnapshot } from '@/lib/snapshot-redis'
import dogStatsFallback from '@/data/dog_stats_fallback.json'
import externalHoldersFallback from '@/data/external_holders.json'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MULTICHAIN_FALLBACK_KEY = 'holders:fallback:multichain'

export async function GET() {
  // BTC: from the live snapshot (written hourly by the snapshotter)
  // Solana + Stacks: from the multichain fallback key (written by /api/multichain/stats on success)
  const [snap, multiRaw] = await Promise.allSettled([
    getLiveSnapshot(),
    redisClient.get(MULTICHAIN_FALLBACK_KEY),
  ])

  const btc =
    snap.status === 'fulfilled' && snap.value?.total_holders
      ? snap.value.total_holders
      : (dogStatsFallback as any).totalHolders ?? 0

  let solana = (externalHoldersFallback as any).solana?.holders ?? 0
  let stacks = (externalHoldersFallback as any).stacks?.holders ?? 0
  let updatedAt: string | null = null

  if (multiRaw.status === 'fulfilled' && multiRaw.value) {
    const parsed =
      typeof multiRaw.value === 'string'
        ? JSON.parse(multiRaw.value)
        : (multiRaw.value as { solana: number; stacks: number; updated_at: string })
    if (parsed.solana > 0) solana = parsed.solana
    if (parsed.stacks > 0) stacks = parsed.stacks
    updatedAt = parsed.updated_at ?? null
  }

  return NextResponse.json(
    { btc, solana, stacks, total: btc + solana + stacks, updated_at: updatedAt },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}
