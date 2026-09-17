// Razão de escuta do Radiola: segundos de escuta VERIFICADA por endereço bc1p.
//
// Filosofia (Honor-Bound): o DogCity só CONTA escuta. Nunca credita o Rune
// RADIOLA (é L1 e o supply é do Radiola). O que fica aqui é um livro-razão
// auditável de segundos por endereço; o Radiola lê e distribui o Rune.
//
// ⚠️ REDIS GUARDADO: usa o MESMO Upstash do app, mas NÃO lança no import quando
// a env falta (diferente de lib/upstash.ts, que lança de propósito). Assim as
// rotas do Radiola degradam soft — o player nunca quebra — e, em produção (onde
// a env existe), o farm funciona de verdade. As chaves e o cookie de sessão são
// os mesmos que /api/wallet/verify grava, então posse provada continua valendo.

import { Redis } from '@upstash/redis'
import type { NextRequest } from 'next/server'
import { RADIOLA } from './catalog'

let _redis: Redis | null | undefined
function redis(): Redis | null {
  if (_redis !== undefined) return _redis
  const url = process.env.UPSTASH_KV_REST_API_URL
  const token = process.env.UPSTASH_KV_REST_API_TOKEN
  _redis = url && token ? new Redis({ url, token }) : null
  return _redis
}

/** hash: address -> segundos de escuta vitalícios. */
const TOTAL_KEY = 'radiola:earned:total'

/** chave diária por endereço, pro teto de escuta/dia. */
function dayKey(address: string): string {
  const d = new Date()
  const ymd =
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(d.getUTCDate()).padStart(2, '0')}`
  return `radiola:day:${ymd}:${address}`
}

/**
 * Endereço da sessão de posse provada (cookie dg_wallet → wsess:<sid>). É o
 * mesmo registro que só nasce em /api/wallet/verify depois da assinatura
 * conferir, então a existência já é a prova. null quando não há sessão (ou sem
 * Redis).
 */
export async function readSessionAddress(req: NextRequest): Promise<string | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const r = redis()
  if (!r) return null
  try {
    const s = await r.get<{ address?: string }>(`wsess:${sid}`)
    return s?.address ? s.address : null
  } catch {
    return null
  }
}

/** Freio por chave: um pedido a cada N s. true = bloqueado. Falha aberta. */
export async function tooFast(key: string, seconds: number): Promise<boolean> {
  const r = redis()
  if (!r) return false
  try {
    const reserved = await r.set(`throttle:${key}`, '1', { ex: seconds, nx: true })
    return reserved !== 'OK'
  } catch {
    return false
  }
}

export interface CreditResult {
  credited: number
  totalSeconds: number
  usedToday: number
  cappedForToday: boolean
}

/**
 * Credita escuta verificada. NUNCA confia no cliente: credita no máximo o
 * intervalo de um heartbeat e respeita o teto diário por endereço. Sem Redis,
 * é no-op honesto (nada acumula).
 */
export async function creditListening(
  address: string,
  claimedSeconds: number,
): Promise<CreditResult> {
  const r = redis()
  if (!r) return { credited: 0, totalSeconds: 0, usedToday: 0, cappedForToday: false }

  // Teto pelo TEMPO REAL desde o último crédito, não só pelo intervalo nominal:
  // o freio do heartbeat abre a cada (intervalo - 2s) de folga pro jitter, e sem
  // isto um cliente batendo no piso creditaria 15 s a cada 13 s (~15% de escuta
  // inventada). Primeiro heartbeat da sessão vale o intervalo cheio.
  const now = Date.now()
  const lastKey = `radiola:lastbeat:${address}`
  const lastBeat = Number(await r.get<number>(lastKey)) || 0
  const elapsed = lastBeat > 0
    ? Math.max(0, Math.floor((now - lastBeat) / 1000))
    : RADIOLA.heartbeatSeconds

  let credit = Math.min(Math.floor(claimedSeconds), RADIOLA.heartbeatSeconds, elapsed)
  await r.set(lastKey, now, { ex: 60 * 60 * 2 })

  const usedToday = Number(await r.get<number>(dayKey(address))) || 0
  const room = Math.max(0, RADIOLA.dailyCapSeconds - usedToday)
  credit = Math.min(credit, room)

  if (credit <= 0) {
    const total = Number(await r.hget(TOTAL_KEY, address)) || 0
    return { credited: 0, totalSeconds: total, usedToday, cappedForToday: true }
  }

  const newToday = usedToday + credit
  // ex 26h cobre folga de fuso sem manter a chave pra sempre.
  await r.set(dayKey(address), newToday, { ex: 60 * 60 * 26 })
  const total = await r.hincrby(TOTAL_KEY, address, credit)
  return { credited: credit, totalSeconds: total, usedToday: newToday, cappedForToday: false }
}

/** Total vitalício de segundos de escuta de um endereço. */
export async function readListening(address: string): Promise<number> {
  const r = redis()
  if (!r) return 0
  return Number(await r.hget(TOTAL_KEY, address)) || 0
}

export interface LedgerRow {
  address: string
  seconds: number
}

/** Razão completo (para o handoff de distribuição do Radiola). */
export async function readLedger(): Promise<LedgerRow[]> {
  const r = redis()
  if (!r) return []
  const all = (await r.hgetall<Record<string, string | number>>(TOTAL_KEY)) || {}
  const rows: LedgerRow[] = Object.entries(all).map(([address, seconds]) => ({
    address,
    seconds: Number(seconds) || 0,
  }))
  rows.sort((a, b) => b.seconds - a.seconds)
  return rows
}
