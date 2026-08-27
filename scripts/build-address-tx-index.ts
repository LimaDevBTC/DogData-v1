/**
 * build-address-tx-index.ts
 * Builds an inverted index in Upstash Redis: dog:addr:txs:{address} → TxEntry[]
 * Also builds dog:txid:{txid} → block_height for O(1) tx lookup.
 *
 * Run:  npx tsx scripts/build-address-tx-index.ts
 * Incremental: reads dog:addr:index:last_block to skip already-processed blocks.
 */

import fs from 'fs/promises'
import path from 'path'
import { Redis } from '@upstash/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const redisClient = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL!,
  token: process.env.UPSTASH_KV_REST_API_TOKEN!,
})

const TX_DIR = path.join(process.cwd(), 'data', 'dog_transactions')
const LAST_BLOCK_KEY = 'dog:addr:index:last_block'
const BATCH_SIZE = 50 // Redis pipeline batch size

interface BlockFile {
  block_height: number
  timestamp: string
  transactions: BlockTx[]
}

interface BlockTx {
  txid: string
  block_height: number
  timestamp: string
  type?: string
  senders: Array<{ address: string; amount_dog: number; has_dog?: boolean }>
  receivers: Array<{ address: string; amount_dog: number; has_dog?: boolean; is_change?: boolean }>
  total_dog_moved: number
  fee_sats?: number
}

interface TxEntry {
  txid: string
  block_height: number
  timestamp: string
  direction: 'in' | 'out' | 'self'
  amount_dog: number
  counterparty: string | null
  counterparties: string[]
  total_dog_moved: number
  fee_sats: number
}

// ⚠️ MESMA REGRA DA ROTA `app/api/address/bitcoin/[address]`, e pelo mesmo
// motivo: em 27/08 um holder viu 2.090.927 DOG "saindo" da carteira dele num dia
// em que doou 50 mil, porque o troco era filtrado fora e o valor saía do
// `senders` cru. Este script constrói o mesmo extrato por outro caminho; se ele
// rodar com a conta velha, reintroduz o susto.
// A regra: o número da linha é o DELTA do endereço, gasto menos o que voltou
// para ELE. Quem só juntou os próprios UTXOs é 'self', não uma saída.
const DUST_DOG = 0.00001

function buildEntriesForTx(tx: BlockTx): Map<string, TxEntry> {
  const entries = new Map<string, TxEntry>()

  const senders = tx.senders.filter(s => s.has_dog !== false && s.amount_dog > 0)
  // ⚠️ o troco FICA na lista: é justamente o que precisa ser descontado
  const receivers = tx.receivers.filter(r => r.has_dog !== false && r.amount_dog > 0)

  const senderAddrs = new Set(senders.map(s => s.address))
  const receiverAddrs = new Set(receivers.map(r => r.address))
  const allAddrs = Array.from(new Set([...Array.from(senderAddrs), ...Array.from(receiverAddrs)]))

  const somaDe = (lista: Array<{ address: string; amount_dog: number }>, addr: string) =>
    lista.reduce((t, x) => t + (x.address === addr ? Number(x.amount_dog) || 0 : 0), 0)

  for (const addr of allAddrs) {
    const gastou = somaDe(senders, addr)
    const voltou = somaDe(receivers, addr)
    const delta = gastou - voltou

    const direction: 'in' | 'out' | 'self' =
      delta > DUST_DOG ? 'out' : delta < -DUST_DOG ? 'in' : 'self'
    const amount_dog = direction === 'self' ? gastou : Math.abs(delta)

    // contraparte é quem recebeu SEM ter mandado
    const destinatarios = receivers.filter(r => !senderAddrs.has(r.address))
    const otherSenders = senders.filter(s => s.address !== addr).map(s => s.address)
    const otherReceivers = destinatarios.filter(r => r.address !== addr).map(r => r.address)
    const counterparties = Array.from(new Set([...otherSenders, ...otherReceivers]))

    entries.set(addr, {
      txid: tx.txid,
      block_height: tx.block_height,
      timestamp: tx.timestamp,
      direction,
      amount_dog,
      counterparty: counterparties.length === 1 ? counterparties[0] : null,
      counterparties,
      total_dog_moved: tx.total_dog_moved,
      fee_sats: tx.fee_sats || 0,
    })
  }

  return entries
}

async function main() {
  console.log('🐕 DogData Address TX Index Builder')
  console.log('=====================================')

  // Read last processed block
  const lastBlockRaw = await redisClient.get<number>(LAST_BLOCK_KEY)
  const lastProcessedBlock = typeof lastBlockRaw === 'number' ? lastBlockRaw : 0
  console.log(`📦 Last indexed block: ${lastProcessedBlock || 'none (full run)'}`)

  // List all block files
  const files = await fs.readdir(TX_DIR)
  const blockFiles = files
    .filter(f => f.startsWith('block_') && f.endsWith('.json'))
    .sort()

  console.log(`📂 Found ${blockFiles.length} block files`)

  // Filter to unprocessed blocks
  const toProcess = blockFiles.filter(f => {
    const height = parseInt(f.replace('block_', '').replace('.json', ''), 10)
    return height > lastProcessedBlock
  })

  if (toProcess.length === 0) {
    console.log('✅ Nothing to index — all blocks already processed.')
    return
  }

  console.log(`⚙️  Processing ${toProcess.length} new blocks...\n`)

  // Accumulate all entries: address → TxEntry[]
  const addrTxMap = new Map<string, TxEntry[]>()
  // txid → block_height
  const txidMap = new Map<string, number>()

  let lastBlock = lastProcessedBlock
  let totalTxs = 0

  for (const file of toProcess) {
    const filePath = path.join(TX_DIR, file)
    const raw = await fs.readFile(filePath, 'utf-8')
    const block: BlockFile = JSON.parse(raw)

    for (const tx of block.transactions) {
      txidMap.set(tx.txid, tx.block_height)
      totalTxs++

      const entries = buildEntriesForTx(tx)
      for (const [addr, entry] of Array.from(entries)) {
        if (!addrTxMap.has(addr)) addrTxMap.set(addr, [])
        addrTxMap.get(addr)!.push(entry)
      }
    }

    lastBlock = Math.max(lastBlock, block.block_height)
  }

  console.log(`📊 Processed ${totalTxs} txs across ${toProcess.length} blocks`)
  console.log(`📍 Unique addresses: ${addrTxMap.size}`)
  console.log(`🔗 Unique txids: ${txidMap.size}`)
  console.log(`\n⬆️  Writing to Redis...`)

  // For incremental runs, we need to merge with existing Redis data
  const addresses = Array.from(addrTxMap.keys())
  let written = 0

  // Process in batches
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)

    // Fetch existing data for these addresses
    const existingRaw = await Promise.all(
      batch.map(addr => redisClient.get<string>(`dog:addr:txs:${addr}`))
    )

    const pipeline = redisClient.pipeline()

    for (let j = 0; j < batch.length; j++) {
      const addr = batch[j]
      const newEntries = addrTxMap.get(addr)!

      let existing: TxEntry[] = []
      const raw = existingRaw[j]
      if (raw) {
        try {
          existing = typeof raw === 'string' ? JSON.parse(raw) : (raw as TxEntry[])
        } catch {}
      }

      // Merge: existing + new entries, deduplicate by txid
      const seen = new Set(existing.map(e => e.txid))
      const merged = [...existing]
      for (const entry of newEntries) {
        if (!seen.has(entry.txid)) {
          merged.push(entry)
          seen.add(entry.txid)
        }
      }

      // Sort by block_height desc (newest first)
      merged.sort((a, b) => b.block_height - a.block_height)

      pipeline.set(`dog:addr:txs:${addr}`, JSON.stringify(merged))
    }

    await pipeline.exec()
    written += batch.length

    if (written % 500 === 0 || written === addresses.length) {
      process.stdout.write(`\r  Addresses: ${written}/${addresses.length}`)
    }
  }

  console.log(`\n\n⬆️  Writing txid index...`)

  // Write txid → block_height index in batches
  const txids = Array.from(txidMap.entries())
  for (let i = 0; i < txids.length; i += BATCH_SIZE * 2) {
    const pipeline = redisClient.pipeline()
    const batchSlice = txids.slice(i, i + BATCH_SIZE * 2)
    for (const [txid, height] of batchSlice) {
      pipeline.set(`dog:txid:${txid}`, height)
    }
    await pipeline.exec()

    if ((i + BATCH_SIZE * 2) % 500 === 0 || i + BATCH_SIZE * 2 >= txids.length) {
      process.stdout.write(`\r  TXIDs: ${Math.min(i + BATCH_SIZE * 2, txids.length)}/${txids.length}`)
    }
  }

  // Save last block
  await redisClient.set(LAST_BLOCK_KEY, lastBlock)
  await redisClient.set('dog:addr:index:meta', JSON.stringify({
    last_block: lastBlock,
    total_addresses: addrTxMap.size,
    total_txids: txidMap.size,
    built_at: new Date().toISOString(),
  }))

  console.log(`\n\n✅ Done!`)
  console.log(`   Last indexed block: ${lastBlock}`)
  console.log(`   Addresses written: ${written}`)
  console.log(`   TXIDs written: ${txidMap.size}`)
}

main().catch(e => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
