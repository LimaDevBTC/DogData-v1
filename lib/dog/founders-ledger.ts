// ═══════════════════════════════════════════════════════════════════════════
// LIVRO DOS FOUNDERS: a conta pura do fundo de construção, sem rede e sem banco.
// A rota /api/donate/leaderboard só busca as linhas e chama buildLedger().
//
// REGRAS (decididas pelo fundador, espelham scripts/did/founders_extrair.py do
// repo do jogo, o extrator independente que lê o nosso nó):
//  1. Conta só o que a SAÍDA do fundo recebeu, em átomos inteiros (10^-5 DOG).
//  2. O fundo como remetente (retirada, movimento interno) não é doação.
//  3. VÁRIOS REMETENTES: o valor recebido pelo fundo é repartido na proporção
//     do DOG LÍQUIDO que cada endereço enviou (entrada menos o troco que voltou
//     a ele), em átomos inteiros, pelo maior resto (empate: o primeiro). Quem
//     não enviou DOG (só pagou taxa, amount nulo) tem peso 0 e NÃO é founder.
//  4. Sem remetente com DOG: entra no total, cai no balde "anonymous", NÃO
//     numera founder. Nunca se inventa doador a partir de troco ou de outro
//     endereço da transação.
//  5. O número do founder é a ordem da PRIMEIRA contribuição: bloco, posição da
//     transação no bloco, ordem dos remetentes. Nunca por timestamp (vários
//     blocos têm todas as transações com o mesmo timestamp).
// A posição no bloco não existe no banco: vem de founders-positions.json (gerada
// pelo extrator a partir do nó). Transação que ainda não está na tabela cai para
// o `id` da linha (ordem de ingestão do scanner), depois para o txid.
// ═══════════════════════════════════════════════════════════════════════════
import POSICOES from './founders-positions.json'

export const ATOMOS_POR_DOG = 100_000n

export interface TxRow {
  id?: number | string | null
  txid: string
  block_height: number
  timestamp: string
  senders: unknown
  receivers: unknown
}

export interface LedgerOptions {
  /** posição da transação no bloco (txid -> posição); padrão: a tabela do extrator. */
  posicoes?: Record<string, number>
  /** licença por total em DOG */
  licenseFor: (totalDog: number) => string
}

function parseJsonArr(val: unknown): any[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') { try { const v = JSON.parse(val); return Array.isArray(v) ? v : [] } catch { return [] } }
  return []
}

/** Átomos inteiros de um item do índice. `amount` inteiro é o exato; o float só entra se faltar; nulo = 0. */
function atomos(item: any): bigint {
  const a = item?.amount
  if (typeof a === 'number' && Number.isInteger(a)) return BigInt(a)
  const d = item?.amount_dog ?? item?.dog_amount ?? item?.total_dog
  if (typeof d === 'number' && Number.isFinite(d)) return BigInt(Math.round(d * 100_000))
  return 0n
}

/** Reparte `total` na proporção dos `pesos` pelo maior resto; empate: o primeiro. Soma exata. */
export function repartir(total: bigint, pesos: bigint[]): bigint[] {
  const soma = pesos.reduce((s, p) => s + p, 0n)
  if (total < 0n || pesos.length === 0 || soma === 0n || pesos.some((p) => p < 0n)) throw new Error('repartir: invalid input')
  const base = pesos.map((p) => (total * p) / soma)
  let faltam = Number(total - base.reduce((s, b) => s + b, 0n))
  const ordem = pesos
    .map((p, i) => ({ i, resto: (total * p) % soma }))
    .sort((a, b) => (a.resto === b.resto ? a.i - b.i : a.resto > b.resto ? -1 : 1))
  for (const { i } of ordem) { if (faltam <= 0) break; base[i] += 1n; faltam-- }
  return base
}

export interface Contribution {
  bloco: number
  posicao: number
  txid: string
  timestamp: string
  fundoAtomos: bigint
  remetentes: { address: string; atomos: bigint }[] // vazio = anonymous
}

/** Contribuição de UMA linha, ou null se não é doação. */
export function contributionOf(row: TxRow, wallet: string, posicoes: Record<string, number>): Contribution | null {
  const senders = parseJsonArr(row.senders)
  const receivers = parseJsonArr(row.receivers)
  let recebido = 0n
  for (const r of receivers) if (String(r?.address ?? '').toLowerCase() === wallet) recebido += atomos(r)
  if (recebido <= 0n) return null

  const entrou = new Map<string, bigint>() // ordem de inserção = ordem dos remetentes
  for (const s of senders) {
    const a = typeof s?.address === 'string' ? s.address.toLowerCase() : ''
    if (a) entrou.set(a, (entrou.get(a) ?? 0n) + atomos(s))
  }
  if (entrou.has(wallet)) return null // o fundo gasta: nunca doação

  const base = { bloco: row.block_height, posicao: posicoes[row.txid] ?? Number.MAX_SAFE_INTEGER, txid: row.txid, timestamp: row.timestamp, fundoAtomos: recebido }
  const voltou = new Map<string, bigint>()
  for (const r of receivers) {
    const a = String(r?.address ?? '').toLowerCase()
    if (a && a !== wallet && entrou.has(a)) voltou.set(a, (voltou.get(a) ?? 0n) + atomos(r))
  }
  const enderecos = [...entrou.keys()]
  const pesos = enderecos.map((a) => { const p = (entrou.get(a) ?? 0n) - (voltou.get(a) ?? 0n); return p > 0n ? p : 0n })
  if (enderecos.length === 0) return { ...base, remetentes: [] } // sem remetente: anonymous
  if (enderecos.length === 1) return { ...base, remetentes: [{ address: enderecos[0], atomos: recebido }] }
  if (pesos.every((p) => p === 0n)) return { ...base, remetentes: [] } // vários e nenhum enviou DOG líquido: anonymous
  const partes = repartir(recebido, pesos)
  return { ...base, remetentes: enderecos.map((address, i) => ({ address, atomos: partes[i] })).filter((r) => r.atomos > 0n) }
}

export function buildLedger(rowsIn: TxRow[], wallet: string, opts: LedgerOptions) {
  const w = wallet.toLowerCase()
  const posicoes = opts.posicoes ?? (POSICOES as Record<string, number>)
  const rows = [...rowsIn].sort((a, b) => {
    if (a.block_height !== b.block_height) return a.block_height - b.block_height
    const pa = posicoes[a.txid] ?? Number.MAX_SAFE_INTEGER, pb = posicoes[b.txid] ?? Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    const ia = Number(a.id ?? 0), ib = Number(b.id ?? 0)
    if (ia !== ib) return ia - ib
    return a.txid < b.txid ? -1 : a.txid > b.txid ? 1 : 0
  })
  const contribs: Contribution[] = []
  const vistos = new Set<string>()
  for (const r of rows) {
    if (vistos.has(r.txid)) continue
    vistos.add(r.txid)
    const c = contributionOf(r, w, posicoes)
    if (c) contribs.push(c)
  }

  let totalAtomos = 0n
  const donors = new Map<string, { atomos: bigint; txCount: number; lastTx: string; first: Contribution }>()
  const events: { address: string; amountAtomos: bigint; timestamp: string; txid: string }[] = []
  const anon: Contribution[] = []
  for (const c of contribs) {
    totalAtomos += c.fundoAtomos
    if (c.remetentes.length === 0) {
      anon.push(c)
      const rec = donors.get('anonymous') ?? { atomos: 0n, txCount: 0, lastTx: '', first: c }
      rec.atomos += c.fundoAtomos; rec.txCount += 1
      if (!rec.lastTx || c.timestamp > rec.lastTx) rec.lastTx = c.timestamp
      donors.set('anonymous', rec)
      events.push({ address: 'anonymous', amountAtomos: c.fundoAtomos, timestamp: c.timestamp, txid: c.txid })
      continue
    }
    for (const r of c.remetentes) {
      const rec = donors.get(r.address) ?? { atomos: 0n, txCount: 0, lastTx: '', first: c }
      rec.atomos += r.atomos; rec.txCount += 1
      if (!rec.lastTx || c.timestamp > rec.lastTx) rec.lastTx = c.timestamp
      donors.set(r.address, rec)
      events.push({ address: r.address, amountAtomos: r.atomos, timestamp: c.timestamp, txid: c.txid })
    }
  }
  const dog = (a: bigint) => Number(a) / Number(ATOMOS_POR_DOG)

  const leaderboard = [...donors.entries()]
    .map(([address, d]) => ({ address, total: dog(d.atomos), totalAtomos: d.atomos, txCount: d.txCount, lastTx: d.lastTx, license: opts.licenseFor(dog(d.atomos)) }))
    .sort((a, b) => (a.totalAtomos === b.totalAtomos ? 0 : a.totalAtomos > b.totalAtomos ? -1 : 1))
    .map(({ totalAtomos: _t, ...e }, i) => ({ rank: i + 1, ...e }))

  // Founders: ordem da primeira contribuição (contribs já está em ordem de bloco/posição/id).
  const founders: { founder_seq: number; address: string; crossed_at: string; total: number; totalAtomos: bigint; license: string }[] = []
  const vistosF = new Set<string>()
  for (const c of contribs) {
    for (const r of c.remetentes) {
      if (vistosF.has(r.address)) continue
      vistosF.add(r.address)
      const t = donors.get(r.address)!.atomos
      founders.push({ founder_seq: founders.length + 1, address: r.address, crossed_at: c.timestamp, total: dog(t), totalAtomos: t, license: opts.licenseFor(dog(t)) })
    }
  }

  const recent = events
    .filter((e) => e.address !== 'anonymous')
    .sort((a, b) => (a.timestamp === b.timestamp ? 0 : a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 20)
    .map((e) => ({ address: e.address, amount: dog(e.amountAtomos), timestamp: e.timestamp, txid: e.txid }))

  return { totalAtomos, totalReceived: dog(totalAtomos), leaderboard, founders, recent, contributions: contribs }
}
