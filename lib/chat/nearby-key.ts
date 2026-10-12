import { redisClient } from '@/lib/upstash'
import { base64url } from '@/lib/chat/nearby'

// A chave que assina as falas do chat de proximidade do jogo (lib/chat/nearby.ts).
//
// ECDSA P-256. A privada nasce sozinha na primeira fala e mora no Upstash (SET NX: duas funcoes
// frias ao mesmo tempo ficam com a mesma), no mesmo cofre das sessoes de carteira (wsess:*): quem
// le o Redis ja podia se passar por qualquer carteira, entao a fronteira de confianca e a mesma.
// Nenhuma env nova. Trocar a chave: DEL dogcity:nearby:key:v1. O jogo busca a publica de novo
// quando uma assinatura nao bate (dogcity-mundo src/social/fala.ts).

const CHAVE_REDIS = 'dogcity:nearby:key:v1'
const ALGORITMO = { name: 'ECDSA', namedCurve: 'P-256' } as const
const ASSINATURA = { name: 'ECDSA', hash: 'SHA-256' } as const

export interface ChavePublica {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

interface Par {
  privada: CryptoKey
  publica: ChavePublica
}

let par: Promise<Par> | null = null

function jwkValida(j: unknown): j is JsonWebKey & { x: string; y: string; d: string } {
  if (!j || typeof j !== 'object') return false
  const o = j as Record<string, unknown>
  return o.kty === 'EC' && o.crv === 'P-256' && typeof o.x === 'string' && typeof o.y === 'string' && typeof o.d === 'string'
}

async function carregar(): Promise<Par> {
  let jwk: unknown = await redisClient.get(CHAVE_REDIS)
  if (!jwkValida(jwk)) {
    const gerada = await crypto.subtle.generateKey(ALGORITMO, true, ['sign', 'verify'])
    const nova = await crypto.subtle.exportKey('jwk', gerada.privateKey)
    const ok = await redisClient.set(CHAVE_REDIS, nova, { nx: true })
    jwk = ok === 'OK' ? nova : await redisClient.get(CHAVE_REDIS)
    if (!jwkValida(jwk)) throw new Error('nearby: chave de assinatura invalida no Redis')
  }
  const privada = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'], ext: false }, ALGORITMO, false, ['sign'])
  return { privada, publica: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } }
}

function obterPar(): Promise<Par> {
  if (!par) {
    par = carregar().catch((e: unknown) => {
      par = null
      throw e
    })
  }
  return par
}

export async function chavePublica(): Promise<ChavePublica> {
  return (await obterPar()).publica
}

/** Assina a string exata que vai ao jogo; devolve 64 bytes (r||s) em base64url. */
export async function assinarFala(corpo: string): Promise<string> {
  const { privada } = await obterPar()
  const sig = await crypto.subtle.sign(ASSINATURA, privada, new TextEncoder().encode(corpo))
  return base64url(new Uint8Array(sig))
}
