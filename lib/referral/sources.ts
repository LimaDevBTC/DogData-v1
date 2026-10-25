// Referral: as FONTES de dados da contagem. Cada funcao recebe o que precisa de fora (fetch, cliente
// do banco), entao nada aqui toca em ambiente no import e os testes rodam sem rede.
//
// De onde vem cada numero:
//  * mint (escritura): API PUBLICA do mint, https://mint.dogcity.space.
//      GET /api/mint/lookup?address=A&address=B   (ate 4 enderecos; 60 pedidos por minuto por IP)
//        -> lots[]: os lotes cujo dono no REGISTRO selado e' o endereco, com `state` (minted | reserved | available).
//      GET /api/mint/lot/{lotId} -> inscriptionId do lote cunhado (txid do reveal + "i0").
//    A API do mint NAO serve o bloco do mint. O bloco sai da transacao reveal no mempool.space
//    (GET /api/tx/{txid}/status). Sem bloco confirmado o lote NAO conta ainda (falha fechada).
//    APROXIMACAO a documentar: so enxerga lote registrado no nome da carteira indicada (o que
//    /lookup mostra). Escritura que a carteira comprou de lote de outro dono nao aparece nessa API.
//  * licenca em $DOG: dog_transactions (o mesmo livro de /api/donate/leaderboard), uma consulta
//    por carteira indicada com `addresses @> {fundo, carteira}` (indice GIN), reaproveitando
//    contributionOf() de founders-ledger.ts, a regra exata do livro (partilha de varios remetentes).
//  * licenca em BTC: dogcity_btc_payments com status 'credited' (indice parcial por endereco),
//    pelo credit_dog da cotacao travada.

import type { SupabaseClient } from '@supabase/supabase-js'
import { contributionOf, type TxRow } from '../dog/founders-ledger'
import type { MintedLot, Payment } from './tally'

export const MINT_BASE = 'https://mint.dogcity.space'
export const MEMPOOL_BASE = 'https://mempool.space/api'
export const FUND_DOG_ADDRESS = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
export const LOOKUP_BATCH = 4

export type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

export interface OwnedLotState {
  lotId: string
  /** 'minted' | 'reserved' | 'available' | null (estado ilegivel agora) */
  state: string | null
}

const LOT_ID = /^[A-Za-z0-9_-]{1,40}$/
const INSCRIPTION = /^([0-9a-f]{64})i(0|[1-9][0-9]{0,9})$/

async function getJson(f: FetchFn, url: string, ms: number): Promise<{ ok: boolean; status: number; body: any }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await f(url, { signal: ctrl.signal })
    let body: unknown = null
    try { body = await r.json() } catch { /* corpo nao-JSON */ }
    return { ok: r.ok, status: r.status, body }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Os lotes de cada endereco no registro do mint. A chave do Map e' o endereco pedido. Endereco AUSENTE
 * do resultado = a consulta falhou (tente de novo depois); lista vazia = a consulta deu certo e a
 * carteira nao tem lote. Um 400 no grupo (um endereco que o mint recusa por rede ou forma) cai para
 * pedidos individuais: o endereco recusado vale lista vazia, os outros seguem.
 */
export async function mintLookup(
  addresses: string[],
  f: FetchFn = fetch as unknown as FetchFn,
  base: string = MINT_BASE,
): Promise<Map<string, OwnedLotState[]>> {
  const out = new Map<string, OwnedLotState[]>()
  const once = async (group: string[]): Promise<'ok' | 'bad' | 'fail'> => {
    const q = group.map((a) => `address=${encodeURIComponent(a)}`).join('&')
    try {
      const r = await getJson(f, `${base}/api/mint/lookup?${q}`, 8000)
      if (r.status === 400) return 'bad'
      if (!r.ok || !Array.isArray(r.body?.lots)) return 'fail'
      const by = new Map<string, OwnedLotState[]>(group.map((a) => [a, []]))
      for (const l of r.body.lots) {
        const a = typeof l?.address === 'string' ? l.address : ''
        if (!by.has(a) || typeof l?.lotId !== 'string' || !LOT_ID.test(l.lotId)) continue
        by.get(a)!.push({ lotId: l.lotId, state: typeof l.state === 'string' ? l.state : null })
      }
      for (const [a, lots] of by) out.set(a, lots)
      return 'ok'
    } catch {
      return 'fail'
    }
  }
  for (let i = 0; i < addresses.length; i += LOOKUP_BATCH) {
    const group = addresses.slice(i, i + LOOKUP_BATCH)
    const r = await once(group)
    if (r === 'bad' && group.length > 1) {
      for (const a of group) if ((await once([a])) === 'bad') out.set(a, [])
    } else if (r === 'bad') {
      out.set(group[0], [])
    }
  }
  return out
}

/** O bloco em que a escritura do lote foi cunhada (reveal confirmado), ou null se ainda nao se sabe. */
export async function resolveMintBlock(
  lotId: string,
  f: FetchFn = fetch as unknown as FetchFn,
  mintBase: string = MINT_BASE,
  mempoolBase: string = MEMPOOL_BASE,
): Promise<{ block: number; timeMs: number } | null> {
  if (!LOT_ID.test(lotId)) return null
  try {
    const lot = await getJson(f, `${mintBase}/api/mint/lot/${encodeURIComponent(lotId)}`, 8000)
    const m = INSCRIPTION.exec(String(lot.body?.inscriptionId ?? ''))
    if (!lot.ok || lot.body?.state !== 'minted' || !m) return null
    const st = await getJson(f, `${mempoolBase}/tx/${m[1]}/status`, 8000)
    const block = Number(st.body?.block_height)
    const time = Number(st.body?.block_time)
    if (!st.ok || st.body?.confirmed !== true || !Number.isSafeInteger(block) || block <= 0) return null
    return { block, timeMs: Number.isFinite(time) && time > 0 ? time * 1000 : NaN }
  } catch {
    return null
  }
}

export function toMintedLot(lotId: string, r: { block: number; timeMs: number }): MintedLot {
  return { lotId, block: r.block, timeMs: Number.isFinite(r.timeMs) ? r.timeMs : null }
}

const ms = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/**
 * O que a carteira pagou ao fundo em $DOG depois do vinculo, pela regra do livro (contributionOf).
 * Uma consulta por carteira, pelo indice GIN de `addresses`; o bloco do vinculo (se houver) corta as
 * linhas no banco, e a regra final de "depois" fica em tally.ts. Lanca se o banco falhar.
 */
export async function dogPayments(
  db: SupabaseClient,
  referred: string,
  linkedBlock: number | null,
  linkedAtMs: number,
): Promise<Payment[]> {
  let q = db
    .from('dog_transactions')
    .select('id, txid, block_height, timestamp, senders, receivers')
    .contains('addresses', [FUND_DOG_ADDRESS, referred])
    .order('block_height', { ascending: true })
    .limit(500)
  // corte so para poupar o banco: sem bloco, 3 h antes do vinculo (o tempo do bloco atrasa em relacao ao relogio)
  q = linkedBlock !== null ? q.gte('block_height', linkedBlock) : q.gte('timestamp', new Date(linkedAtMs - 3 * 3600_000).toISOString())
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const me = referred.toLowerCase()
  const seen = new Set<string>()
  const out: Payment[] = []
  for (const row of (data ?? []) as TxRow[]) {
    if (seen.has(row.txid)) continue
    seen.add(row.txid)
    const c = contributionOf(row, FUND_DOG_ADDRESS, {})
    if (!c) continue
    for (const r of c.remetentes) {
      if (r.address.toLowerCase() !== me) continue
      out.push({ kind: 'dog', dog: Number(r.atomos) / 100_000, block: c.bloco, timeMs: ms(c.timestamp) })
    }
  }
  return out
}

/** Os creditos em BTC (em $DOG) das carteiras, por endereco. Lanca se o banco falhar. */
export async function btcPayments(db: SupabaseClient, addresses: string[]): Promise<Map<string, Payment[]>> {
  const out = new Map<string, Payment[]>(addresses.map((a) => [a, []]))
  for (let i = 0; i < addresses.length; i += 100) {
    const chunk = addresses.slice(i, i + 100)
    const { data, error } = await db
      .from('dogcity_btc_payments')
      .select('ordinals_address, credit_dog, block_height, block_time, credited_at')
      .eq('status', 'credited')
      .in('ordinals_address', chunk)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const a = String(r.ordinals_address ?? '')
      const dog = Number(r.credit_dog)
      if (!out.has(a) || !(dog > 0)) continue
      const bh = Number(r.block_height)
      out.get(a)!.push({
        kind: 'btc',
        dog,
        block: Number.isSafeInteger(bh) && bh > 0 ? bh : null,
        timeMs: ms(r.block_time) ?? ms(r.credited_at),
      })
    }
  }
  return out
}
