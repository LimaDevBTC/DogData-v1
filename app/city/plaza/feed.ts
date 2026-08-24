// O feed da órbita: pergunta a /api/mempool/dog a cada 6 s e transforma a diferença
// em eventos que a cena entende. A cena nunca calcula estado a partir da resposta
// crua; ela reage a "entrou em órbita", "pousou", "caiu", "painel mudou".
//
// A verdade mora no watcher da casa (scripts/dog_mempool_watcher.py) e chega aqui
// já com o carimbo de idade (`stale_seconds`): se o watcher morrer, o painel diz
// "há N s" em vez de fingir que a órbita está viva.

import { DONATION_WALLET } from '../../dogcity/dogcity-data'

/** ⚠️ ESTA TRANSAÇÃO PAGA A CIDADE?
 *
 *  O endereço vem de `dogcity-data.ts`, que já é a fonte da landing e da página
 *  de doação. Uma quarta cópia dele espalhada pelo código é como um endereço de
 *  destino muda em três lugares e continua errado no quarto.
 *
 *  Só o RECEBEDOR conta: a carteira de doações também gasta (o fundador vende
 *  para pagar a obra, e isso é público), e uma saída dela não é uma doação
 *  chegando. Foguete com cauda vermelha é dinheiro ENTRANDO. */
export const isDonation = (tx: { receivers: Array<{ address: string }> }): boolean =>
  tx.receivers.some((r) => r.address === DONATION_WALLET)

/** Quanto DOG chegou de fato na carteira da cidade nesta transação.
 *
 * ⚠️ NÃO É O TAMANHO DA TRANSAÇÃO, e essa foi a confusão que o fundador apontou:
 * uma doação saiu de um UTXO de 600 mil, 10 mil chegaram aqui e 590 mil voltaram
 * para o doador. Quem lê "600.000" lê uma doação sessenta vezes maior. A única
 * leitura honesta é a soma do que foi para o endereço da cidade, e é essa. */
export const donationDog = (tx: { receivers: Array<{ address: string; dog: number }> }): number =>
  tx.receivers.reduce((n, r) => (r.address === DONATION_WALLET ? n + Number(r.dog || 0) : n), 0)

export interface DogTx {
  txid: string
  status: 'pending' | 'confirmed' | 'dropped'
  first_seen: string
  seen_pending: boolean
  block_height: number | null
  block_time: string | null
  confirmed_at: string | null
  dropped_at: string | null
  /** o UTXO inteiro que foi gasto. Quase nunca é o que você quer mostrar. */
  dog_in: number
  dog_out: number
  dog_burn: number
  /** ⚠️ O QUE MUDOU DE MÃO, troco descontado. É este que vai para a tela. */
  dog_net: number
  /** o que voltou para quem mandou */
  dog_change: number
  /** transfer · self (só juntou os próprios UTXOs) · unknown (sem remetente) */
  flow_kind: 'transfer' | 'self' | 'unknown'
  explicit_edict: boolean
  cenotaph: boolean
  senders: string[]
  receivers: Array<{ address: string; dog: number }>
  fee_sats: number | null
  vsize: number | null
  fee_rate: number | null
  n_in: number | null
  n_out: number | null
  rbf: boolean
}

export interface Snapshot {
  updated_at: string
  tx_count: number
  vbytes: number
  min_fee_rate: number | null
  fee_fast: number | null
  fee_normal: number | null
  fee_slow: number | null
  tip_height: number | null
  tip_hash: string | null
  tip_time: string | null
  dog_pending: number
  dog_pending_amount: number
  last_dog_block: number | null
  last_dog_block_time: string | null
  last_dog_block_count: number | null
  last_dog_block_amount: number | null
}

export interface FeedPayload {
  pending: DogTx[]
  landed: DogTx[]
  dropped: DogTx[]
  snapshot: Snapshot | null
  stale_seconds: number | null
}

export interface FeedEvents {
  /** Primeira resposta: tudo de uma vez, para a cena povoar sem animar chegada. */
  onReady: (p: FeedPayload) => void
  onEnter: (tx: DogTx) => void
  onLand: (tx: DogTx) => void
  onDrop: (tx: DogTx) => void
  onSnapshot: (s: Snapshot | null, staleSeconds: number | null) => void
  onError: (message: string) => void
}

export interface Feed {
  stop: () => void
  /** A última resposta, para o painel e o "follow your DOG". */
  latest: () => FeedPayload | null
  lookup: (txid: string) => Promise<DogTx | null>
}

export const POLL_MS = 6000

export function startFeed(ev: FeedEvents): Feed {
  let latest: FeedPayload | null = null
  let known = new Map<string, DogTx>() // txid → último estado visto
  let ready = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const poll = async () => {
    if (stopped) return
    try {
      const res = await fetch('/api/mempool/dog', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const p = (await res.json()) as FeedPayload
      latest = p
      if (!ready) {
        ready = true
        for (const tx of [...p.pending, ...p.landed, ...p.dropped]) known.set(tx.txid, tx)
        ev.onReady(p)
      } else {
        const next = new Map<string, DogTx>()
        for (const tx of p.pending) {
          next.set(tx.txid, tx)
          const was = known.get(tx.txid)
          if (!was) ev.onEnter(tx)
        }
        for (const tx of p.landed) {
          next.set(tx.txid, tx)
          const was = known.get(tx.txid)
          // pousou: estava pendente (ou nunca vista, chegou direto no bloco)
          if (!was || was.status === 'pending') ev.onLand(tx)
        }
        for (const tx of p.dropped) {
          next.set(tx.txid, tx)
          const was = known.get(tx.txid)
          if (was && was.status === 'pending') ev.onDrop(tx)
        }
        // pendente que sumiu de todas as listas (retenção): trata como caída silenciosa
        for (const [txid, was] of Array.from(known.entries())) {
          if (was.status === 'pending' && !next.has(txid)) ev.onDrop(was)
        }
        known = next
      }
      ev.onSnapshot(p.snapshot, p.stale_seconds)
    } catch (err) {
      ev.onError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!stopped) timer = setTimeout(poll, POLL_MS)
    }
  }
  void poll()

  return {
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
    latest: () => latest,
    lookup: async (txid: string) => {
      const res = await fetch(`/api/mempool/dog?txid=${encodeURIComponent(txid)}`, { cache: 'no-store' }).catch(() => null)
      if (!res?.ok) return null
      const d = (await res.json()) as { tx: DogTx | null }
      return d.tx
    },
  }
}
