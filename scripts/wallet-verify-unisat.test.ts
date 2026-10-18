// Prova offline de que o verificador do servidor (lib/wallet/verify.ts) aceita
// a assinatura nos quatro tipos de endereço que a UniSat pode expor (taproot,
// segwit nativo e aninhado por BIP-322 simples; legado 1... por ECDSA) e
// recusa assinatura de outra chave, mensagem trocada e, fora do legado,
// protocolo trocado.
// Rodar: npx tsx scripts/wallet-verify-unisat.test.ts
import { Signer } from 'bip322-js'
import bitcoinMessage from 'bitcoinjs-message'
import { ECPairFactory } from 'ecpair'
import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { verifyOwnership } from '../lib/wallet/verify'
import { buildChallengeMessage } from '../lib/wallet/message'

bitcoin.initEccLib(ecc as any)
const ECPair = ECPairFactory(ecc as any)
const net = bitcoin.networks.bitcoin
const a = ECPair.makeRandom({ network: net })
const b = ECPair.makeRandom({ network: net })
const xonly = (k: Buffer) => k.subarray(1, 33)

const enderecos = (k: typeof a) => ({
  p2tr: bitcoin.payments.p2tr({ internalPubkey: xonly(Buffer.from(k.publicKey)), network: net }).address!,
  p2wpkh: bitcoin.payments.p2wpkh({ pubkey: Buffer.from(k.publicKey), network: net }).address!,
  p2sh: bitcoin.payments.p2sh({ redeem: bitcoin.payments.p2wpkh({ pubkey: Buffer.from(k.publicKey), network: net }), network: net }).address!,
  p2pkh: bitcoin.payments.p2pkh({ pubkey: Buffer.from(k.publicKey), network: net }).address!,
})

let falhas = 0
const conf = (nome: string, cond: boolean) => {
  console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}`)
  if (!cond) falhas++
}

const A = enderecos(a)
for (const [tipo, addr] of Object.entries(A)) {
  const msg = buildChallengeMessage(addr, crypto.randomUUID(), new Date().toISOString())
  const legado = tipo === 'p2pkh'
  const assinar = (k: typeof a, m: string) =>
    legado
      ? bitcoinMessage.sign(m, Buffer.from(k.privateKey!), true).toString('base64')
      : String(Signer.sign(k.toWIF(), addr, m))
  const protocolo = legado ? 'ecdsa' : 'bip322'
  const sig = assinar(a, msg)
  conf(`${tipo} ${addr.slice(0, 8)}: assinatura certa passa`, verifyOwnership({ address: addr, message: msg, signature: sig, protocol: protocolo }).ok)
  conf(`${tipo}: mensagem trocada recusa`, !verifyOwnership({ address: addr, message: msg + ' ', signature: sig, protocol: protocolo }).ok)
  let outra = ''
  try { outra = legado ? bitcoinMessage.sign(msg, Buffer.from(b.privateKey!), true).toString('base64') : String(Signer.sign(b.toWIF(), enderecos(b)[tipo as keyof typeof A], msg)) } catch { /* noop */ }
  conf(`${tipo}: assinatura de outra chave recusa`, !verifyOwnership({ address: addr, message: msg, signature: outra, protocol: protocolo }).ok)
  // No legado o bip322-js aceita de propósito a assinatura clássica (BIP-137)
  // pelo caminho BIP-322: é a mesma chave provando o mesmo endereço, não furo.
  if (!legado) conf(`${tipo}: protocolo trocado recusa`, !verifyOwnership({ address: addr, message: msg, signature: sig, protocol: 'ecdsa' }).ok)
}
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo')
process.exit(falhas ? 1 : 0)
