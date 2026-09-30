// Leituras de Bitcoin L1 POR ENDERECO para as salas da sede KRAY•SPACE no
// DOGCITY (lib/runes/dog-l1.ts, lib/ordinals/dsc.ts). Duas fontes publicas,
// verificadas em 29/09/2026, com prazo e deduplicacao por endereco (a pre-consulta
// do jogo pergunta pelas duas salas juntas):
//
//   ord (ordinals.com)  GET /address/<addr> com Accept: application/json
//     -> { outputs[], inscriptions[] (ids), sat_balance, runes_balances:
//          [[nome espacado, quantidade decimal, simbolo]] }. So' blocos
//          CONFIRMADOS (o ord indexa bloco a bloco). As vezes responde 406 "JSON
//          API disabled" (Cloudflare, cf-cache-status BYPASS): vira erro e a
//          proxima fonte responde.
//   Kray (kray.space)   GET /api/wallet/utxos/<addr>?enrich=classify
//     -> { success, utxos: [{ txid, vout, status: { confirmed }, confirmations,
//          inscriptions: [{ id }], runes: [{ runeId, amount, divisibility }] }] }
//          (~3,5 s). O status de confirmacao vem por UTXO.
//
// Nada aqui concede nada: e' so' leitura. Quem decide e' a regra de cada sala.

const ORD = process.env.ORD_PUBLICO ?? 'https://ordinals.com'
const KRAY = process.env.KRAY_PUBLICO ?? 'https://www.kray.space'
const PRAZO_ORD_MS = 8_000
const PRAZO_KRAY_MS = 12_000
const CACHE_MS = 20_000

const BECH32 = /^(bc1)[02-9ac-hj-np-z]{11,87}$/i
const BASE58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/

export function enderecoValido(a: string): boolean {
  return BECH32.test(a) || BASE58.test(a)
}

async function json<T>(url: string, prazo: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), prazo)
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' })
    if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`)
    return (await r.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export interface OrdEndereco {
  inscricoes: string[]
  /** [nome espacado, quantidade decimal] */
  runas: Array<[string, string]>
}

export interface UtxoKray {
  confirmado: boolean
  inscricoes: string[]
  runas: Array<{ id: string; quantidade: bigint }>
}

// em voo e recentes, por endereco (uma instancia serve as duas salas)
const cache = new Map<string, { em: number; p: Promise<unknown> }>()

function lembrar<T>(chave: string, fazer: () => Promise<T>): Promise<T> {
  const agora = Date.now()
  const c = cache.get(chave)
  if (c && agora - c.em < CACHE_MS) return c.p as Promise<T>
  const p = fazer()
  cache.set(chave, { em: agora, p })
  // erro nao fica guardado
  p.catch(() => {
    if (cache.get(chave)?.p === p) cache.delete(chave)
  })
  if (cache.size > 500) for (const [k, v] of cache) if (agora - v.em > CACHE_MS) cache.delete(k)
  return p
}

export function lerOrdEndereco(endereco: string): Promise<OrdEndereco> {
  if (!enderecoValido(endereco)) return Promise.reject(new Error('endereco'))
  return lembrar(`ord:${endereco}`, async () => {
    const j = await json<{ inscriptions?: unknown; runes_balances?: unknown }>(`${ORD}/address/${endereco}`, PRAZO_ORD_MS)
    if (!Array.isArray(j.inscriptions) || !Array.isArray(j.runes_balances)) throw new Error('ord formato')
    return {
      inscricoes: j.inscriptions.filter((x): x is string => typeof x === 'string'),
      runas: (j.runes_balances as unknown[])
        .filter((r): r is [string, string] => Array.isArray(r) && typeof r[0] === 'string' && (typeof r[1] === 'string' || typeof r[1] === 'number'))
        .map((r) => [r[0], String(r[1])]),
    }
  })
}

export function lerUtxosKray(endereco: string): Promise<UtxoKray[]> {
  if (!enderecoValido(endereco)) return Promise.reject(new Error('endereco'))
  return lembrar(`kray:${endereco}`, async () => {
    const j = await json<{ success?: boolean; utxos?: any[] }>(`${KRAY}/api/wallet/utxos/${endereco}?enrich=classify`, PRAZO_KRAY_MS)
    if (j.success === false || !Array.isArray(j.utxos)) throw new Error('kray formato')
    return j.utxos.map((u) => ({
      confirmado: u?.status?.confirmed === true && Number(u?.confirmations ?? 1) >= 1,
      inscricoes: (Array.isArray(u?.inscriptions) ? u.inscriptions : []).map((i: any) => i?.id ?? i?.inscriptionId).filter((x: unknown): x is string => typeof x === 'string'),
      runas: (Array.isArray(u?.runes) ? u.runes : [])
        .filter((r: any) => typeof r?.runeId === 'string' && (typeof r?.amount === 'string' || typeof r?.amount === 'number'))
        .map((r: any) => ({ id: r.runeId as string, quantidade: BigInt(String(r.amount).split('.')[0]!) })),
    }))
  })
}

/** Dono atual pelo ord (/r/inscription/<id> -> address). null se o ord nao respondeu. */
export async function donoNoOrd(id: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}i\d{1,5}$/i.test(id)) return null
  try {
    const j = await json<{ address?: string | null }>(`${ORD}/r/inscription/${id}`, PRAZO_ORD_MS)
    return typeof j.address === 'string' && j.address ? j.address : null
  } catch {
    return null
  }
}

/** so' para os testes */
export function esquecerFontesL1(): void {
  cache.clear()
}
