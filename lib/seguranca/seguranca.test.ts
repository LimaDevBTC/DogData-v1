// Rodar: npx tsx --test lib/seguranca/seguranca.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { cronAutorizado, segredoConfere } from './cron'
import { apelidoDoIp, enderecoCurto, linhaDoEvento } from './evento'
import { chaveDesafio, enderecoValido, lerPedidoVerify, novoVinculo, vinculoValido } from '../wallet/desafio'
import { validateHandle } from '../identity/handle'

const pedido = (h: Record<string, string> = {}) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } })
const PROD = { CRON_SECRET: 'segredo-sintetico', NODE_ENV: 'production' }
// endereco sintetico, so' a forma importa aqui
const TAPROOT = 'bc1pxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlhxy2kgdygjrsqtzq2n0y'

test('cron: so o Bearer certo passa', () => {
  assert.equal(cronAutorizado(pedido({ authorization: 'Bearer segredo-sintetico' }), PROD), true)
  assert.equal(cronAutorizado(pedido({ authorization: 'Bearer errado' }), PROD), false)
  assert.equal(cronAutorizado(pedido({ authorization: 'segredo-sintetico' }), PROD), false)
  assert.equal(cronAutorizado(pedido(), PROD), false)
})

test('cron: cabecalho que qualquer um escreve nao abre a rota', () => {
  assert.equal(cronAutorizado(pedido({ 'user-agent': 'vercel-cron/1.0' }), PROD), false)
  assert.equal(cronAutorizado(pedido({ 'x-vercel-cron': '1' }), PROD), false)
})

test('cron: falha fechada sem a variavel, com folga so no next dev', () => {
  assert.equal(cronAutorizado(pedido({ authorization: 'Bearer ' }), { NODE_ENV: 'production' }), false)
  assert.equal(cronAutorizado(pedido(), { NODE_ENV: 'production' }), false)
  assert.equal(cronAutorizado(pedido(), { NODE_ENV: 'test' }), false)
  assert.equal(cronAutorizado(pedido(), { NODE_ENV: 'development' }), true)
})

test('segredoConfere: vazio e tipo errado nunca conferem', () => {
  assert.equal(segredoConfere('a', 'a'), true)
  assert.equal(segredoConfere('a', 'b'), false)
  assert.equal(segredoConfere('', ''), false)
  assert.equal(segredoConfere(null, undefined), false)
  assert.equal(segredoConfere('a', undefined), false)
})

test('evento: a linha nao leva IP cru nem endereco inteiro', () => {
  const ip = '203.0.113.9'
  const l = linhaDoEvento('auth_assinatura_invalida', pedido({ 'x-real-ip': ip }), { carteira: enderecoCurto(TAPROOT) }, Date.parse('2026-11-05T00:00:00Z'))
  assert.equal(l.includes(ip), false)
  assert.equal(l.includes(TAPROOT), false)
  assert.equal(JSON.parse(l).seg, 'auth_assinatura_invalida')
})

test('evento: o apelido do IP muda de um dia para o outro', () => {
  assert.notEqual(apelidoDoIp('203.0.113.9', Date.parse('2026-11-05T12:00:00Z')), apelidoDoIp('203.0.113.9', Date.parse('2026-11-06T12:00:00Z')))
})

test('desafio: o endereco tem de ser de mainnet e bem formado', () => {
  assert.equal(enderecoValido(TAPROOT), true)
  assert.equal(enderecoValido('1BoatSLRHtKNngkdXEeobR76b53LETtpyT'), true)
  assert.equal(enderecoValido('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'), true)
  for (const ruim of ['', 'abc', 'wnonce:x', '../../etc/passwd', 'bc1' + 'q'.repeat(200), null, 42, {}, ['bc1q']]) {
    assert.equal(enderecoValido(ruim), false, String(ruim))
  }
})

test('desafio: a chave depende do navegador, entao um estranho nao sobrescreve o desafio de outro', () => {
  const a = novoVinculo()
  const b = novoVinculo()
  assert.equal(vinculoValido(a), true)
  assert.notEqual(chaveDesafio(TAPROOT, a), chaveDesafio(TAPROOT, b))
  for (const ruim of ['', 'A'.repeat(32), '../x', null, 7]) assert.equal(vinculoValido(ruim), false)
})

test('verify: recusa corpo malformado antes de qualquer cripto', () => {
  const ok = { address: TAPROOT, signature: 'c2ln', protocol: 'bip322' }
  assert.ok(lerPedidoVerify(ok))
  for (const ruim of [
    null, [], 'x', 1,
    { ...ok, address: { $ne: 1 } },
    { ...ok, signature: 123 },
    { ...ok, signature: 'x'.repeat(5000) },
    { ...ok, protocol: 'nenhum' },
    { ...ok, publicKey: 'nao-hex' },
    { ...ok, publicKey: 'a'.repeat(500) },
  ]) assert.equal(lerPedidoVerify(ruim), null)
})

test('verify: campo informativo estranho nao vira dado gravado', () => {
  const p = lerPedidoVerify({ address: TAPROOT, signature: 'c2ln', protocol: 'ecdsa', walletId: { a: 1 }, visitor_id: 9, session_id: 'x'.repeat(200) })!
  assert.equal(p.walletId, null)
  assert.equal(p.visitorId, null)
  assert.equal(p.sessionId!.length, 64)
})

test('handle: papel da casa e reservado, handle comum segue valendo', () => {
  for (const h of ['official', 'STAFF', 'security', 'founder']) assert.equal(validateHandle(h).reason, 'reserved')
  assert.equal(validateHandle('dogdamassa').ok, true)
})
