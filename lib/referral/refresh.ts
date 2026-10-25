// Referral: o trabalho do cron, que PREENCHE referral_progress (a conta de cada carteira indicada).
//
// Por que existe: a contagem precisa de fontes externas (API do mint, mempool.space) e de consultas
// ao livro. Nada disso pode correr por requisicao do placar (o DogData ja esgotou o IO do Supabase
// em 26/08). O cron faz o trabalho em LOTES pequenos, das carteiras mais antigas na conta, e o
// placar so le o resultado pronto (funcao referral_board, tabelas pequenas, cache de CDN).
//
// Falha fechada: se uma fonte falha para uma carteira, ELA NAO E GRAVADA nesta rodada (o progresso
// anterior fica como estava e a carteira volta na fila). Lote de mint sem bloco confirmado ainda nao
// conta. Lote ja resolvido fica guardado (o bloco de um mint confirmado nao muda) e nao e' pedido de novo.
//
// A tabela e' DERIVADA: dá para apagar referral_progress e o cron a refaz inteira a partir de
// referral_links e das fontes.

import { mintLookup, resolveMintBlock, toMintedLot, type OwnedLotState } from './sources'
import { walletProgress, type LinkFact, type MintedLot, type Payment, type WalletProgress } from './tally'

export interface ResolvedLot {
  b: number
  t: number | null
}

export interface PendingWallet extends LinkFact {
  /** lotes cunhados que ja tiveram o bloco resolvido em rodadas anteriores */
  knownLots: Record<string, ResolvedLot>
}

export interface ProgressRow extends WalletProgress {
  referred: string
  /** todos os lotes cunhados ja resolvidos (cache; inclui os anteriores ao vinculo) */
  mintLots: Record<string, ResolvedLot>
}

export interface RefreshDeps {
  nextBatch(n: number): Promise<PendingWallet[]>
  mintLookup(addresses: string[]): Promise<Map<string, OwnedLotState[]>>
  resolveMint(lotId: string): Promise<{ block: number; timeMs: number } | null>
  dogPayments(w: PendingWallet): Promise<Payment[]>
  btcPayments(addresses: string[]): Promise<Map<string, Payment[]>>
  save(rows: ProgressRow[]): Promise<void>
}

export interface RefreshResult {
  picked: number
  saved: number
  skipped: number
}

export const defaultDeps = (
  pieces: Pick<RefreshDeps, 'nextBatch' | 'dogPayments' | 'btcPayments' | 'save'>,
): RefreshDeps => ({
  ...pieces,
  mintLookup: (a) => mintLookup(a),
  resolveMint: (id) => resolveMintBlock(id),
})

export async function refreshBatch(deps: RefreshDeps, n: number, deadlineMs: number = Infinity): Promise<RefreshResult> {
  const batch = await deps.nextBatch(n)
  if (batch.length === 0) return { picked: 0, saved: 0, skipped: 0 }

  const addresses = batch.map((w) => w.referred)
  const [lookup, btc] = await Promise.all([
    deps.mintLookup(addresses),
    deps.btcPayments(addresses).catch((e) => {
      console.error('[referral/refresh] btc:', (e as Error)?.message)
      return null
    }),
  ])

  const rows: ProgressRow[] = []
  let skipped = 0
  for (const w of batch) {
    if (Date.now() > deadlineMs) { skipped++; continue } // sem tempo: a carteira volta na proxima rodada
    try {
      const owned = lookup.get(w.referred)
      if (!owned || !btc) { skipped++; continue } // fonte falhou para esta carteira: fica para a proxima
      const dog = await deps.dogPayments(w)

      const mintLots: Record<string, ResolvedLot> = { ...w.knownLots }
      for (const lot of owned) {
        if (lot.state !== 'minted' || mintLots[lot.lotId]) continue
        const r = await deps.resolveMint(lot.lotId)
        if (r) mintLots[lot.lotId] = { b: r.block, t: Number.isFinite(r.timeMs) ? r.timeMs : null }
      }
      const lots: MintedLot[] = Object.entries(mintLots).map(([lotId, v]) => toMintedLot(lotId, { block: v.b, timeMs: v.t ?? NaN }))
      const progress = walletProgress(w, lots, [...dog, ...(btc.get(w.referred) ?? [])])
      rows.push({ referred: w.referred, mintLots, ...progress })
    } catch (e) {
      console.error('[referral/refresh] carteira falhou:', (e as Error)?.message)
      skipped++
    }
  }
  if (rows.length) await deps.save(rows)
  return { picked: batch.length, saved: rows.length, skipped }
}
