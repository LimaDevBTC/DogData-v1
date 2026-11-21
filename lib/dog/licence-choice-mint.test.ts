// Rodar: npx tsx --test lib/dog/licence-choice-mint.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { enderecoDoMint } from './licence-choice-mint'

const SEG = 'segredo-do-mint-com-mais-de-16'
const ADDR = 'bc1psxe4nuzvh5mh0eycp5vln6ypv2gkm3p7wld4n6qwzr6jeskz3ewsrmdfly'
const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } })

test('segredo certo e endereço válido: o endereço normalizado', () => {
    assert.equal(enderecoDoMint(req({ authorization: `Bearer ${SEG}`, 'x-dogcity-wallet': ADDR.toUpperCase() }), SEG), ADDR)
  })
test('ATAQUE: sem segredo configurado, segredo curto, errado, de outro tamanho ou sem Bearer: null (cai no cookie)', () => {
    const h = { authorization: `Bearer ${SEG}`, 'x-dogcity-wallet': ADDR }
    assert.equal(enderecoDoMint(req(h), undefined), null)
    assert.equal(enderecoDoMint(req(h), 'curto'), null)
    assert.equal(enderecoDoMint(req({ ...h, authorization: `Bearer ${SEG.slice(0, -1)}x` }), SEG), null)
    assert.equal(enderecoDoMint(req({ ...h, authorization: `Bearer ${SEG}a` }), SEG), null)
    assert.equal(enderecoDoMint(req({ ...h, authorization: SEG }), SEG), null)
    assert.equal(enderecoDoMint(req({ 'x-dogcity-wallet': ADDR }), SEG), null)
  })
test('ATAQUE: segredo certo com endereço ausente ou lixo: null', () => {
    for (const w of ['', 'lixo', "bc1p' or 1=1", 'bc1p\n']) {
      assert.equal(enderecoDoMint(req({ authorization: `Bearer ${SEG}`, 'x-dogcity-wallet': w }), SEG), null)
    }
  })
