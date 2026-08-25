// Verificação server-side da prova de posse (connectwallet.md — Bloco A.6).
// 3 caminhos por protocolo de assinatura. SOMENTE server (Node runtime).
import { Verifier, Address } from 'bip322-js'
import bitcoinMessage from 'bitcoinjs-message'
import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import type { SignatureProtocol } from './types'

export interface VerifyInput {
  address: string
  message: string
  signature: string
  protocol: SignatureProtocol
  publicKey?: string
}

export interface VerifyResult {
  ok: boolean
  reason?: string
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0) throw new Error('hex inválido')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
  return out
}
const utf8 = (s: string) => new TextEncoder().encode(s)
const sha256d = (b: Uint8Array) => sha256(sha256(b))

export function verifyOwnership(input: VerifyInput): VerifyResult {
  const { address, message, signature, protocol, publicKey } = input
  try {
    // Xverse / OKX → BIP-322 (taproot p2tr e também p2wpkh/p2sh).
    if (protocol === 'bip322') {
      const ok = Verifier.verifySignature(address, message, signature)
      return ok ? { ok: true } : { ok: false, reason: 'Assinatura BIP-322 inválida.' }
    }

    // Endereço de pagamento legado → ECDSA (Bitcoin message signing).
    if (protocol === 'ecdsa') {
      const ok = bitcoinMessage.verify(message, address, signature)
      return ok ? { ok: true } : { ok: false, reason: 'Assinatura ECDSA inválida.' }
    }

    // Kray → Schnorr BIP-340 cru.
    // ⚠️ ESQUEMA A VALIDAR com uma assinatura REAL da Kray (hashing + tweak da chave).
    // Fail-closed: se nada casar, rejeita.
    if (protocol === 'bip340-schnorr') {
      if (!publicKey) return { ok: false, reason: 'publicKey ausente (necessária p/ Kray).' }
      const pub = hexToBytes(publicKey)
      if (pub.length !== 32) return { ok: false, reason: 'x-only pubkey deve ter 32 bytes.' }

      // 1) Amarra pubkey ↔ endereço (senão um atacante assina com a própria chave e reivindica outro endereço).
      let derived: string | undefined
      try {
        derived = (Address as any).convertPubKeyIntoAddress(Buffer.from(pub), 'p2tr')?.mainnet
      } catch {
        /* noop */
      }
      if (!derived || derived !== address) {
        return { ok: false, reason: 'pubkey não corresponde ao endereço (Kray — validar derivação).' }
      }

      // 2) Verifica a assinatura Schnorr sobre o hash da mensagem (tenta variantes de hashing).
      const sig = hexToBytes(signature)
      const hashes = [sha256(utf8(message)), sha256d(utf8(message))]
      for (const h of hashes) {
        try {
          if (schnorr.verify(sig, h, pub)) return { ok: true }
        } catch {
          /* tenta a próxima variante */
        }
      }
      return { ok: false, reason: 'Assinatura Schnorr inválida (Kray — validar hashing).' }
    }

    return { ok: false, reason: 'Protocolo de assinatura desconhecido.' }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Erro na verificação.' }
  }
}
