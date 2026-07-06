// ═══════════════════════════════════════════════════════════════════════════════
// lib/city/snapshots.ts — current holder snapshots per chain for the delta engine.
//
// BTC comes from the full local snapshot (authoritative → complete=true). SOL/STX
// come from the live resilient sources which only return the top-N holders
// (complete=false → the diff never implodes wallets they simply didn't list).
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { getSolanaHolders } from '@/lib/multichain/helius'
import { getStacksHoldersResilient } from '@/lib/multichain/stacks-resilient'
import type { HolderInput } from './registry'
import type { ChainId } from './zones'

export interface ChainSnapshot {
  chain: ChainId
  holders: HolderInput[]
  supply: number       // √-footprint normaliser (BTC max — one token across chains)
  complete: boolean    // true only when the source lists every holder
}

export function loadBtcSnapshot(): ChainSnapshot {
  const p = path.join(process.cwd(), 'data', 'dog_holders.json')
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  const holders: HolderInput[] = (raw.holders || []).map((h: { address: string; total_dog: number; utxo_count: number }) => ({
    address: h.address, balance: h.total_dog, utxo_count: h.utxo_count,
  }))
  const supply = holders.reduce((m, h) => Math.max(m, h.balance), 1)
  return { chain: 'bitcoin', holders, supply, complete: true }
}

export async function loadSolanaSnapshot(limit = 1000): Promise<ChainSnapshot> {
  const data = await getSolanaHolders(limit)
  const holders: HolderInput[] = (data.holders || [])
    .filter(h => h.address && h.balance > 0)
    .map(h => ({ address: h.address, balance: h.balance }))
  const supply = holders.reduce((m, h) => Math.max(m, h.balance), 1)
  return { chain: 'solana', holders, supply, complete: false }
}

export async function loadStacksSnapshot(limit = 500): Promise<ChainSnapshot> {
  const data = await getStacksHoldersResilient(limit)
  const holders: HolderInput[] = (data.holders || [])
    .filter(h => h.address && h.balance > 0)
    .map(h => ({ address: h.address, balance: h.balance }))
  const supply = holders.reduce((m, h) => Math.max(m, h.balance), 1)
  return { chain: 'stacks', holders, supply, complete: false }
}
