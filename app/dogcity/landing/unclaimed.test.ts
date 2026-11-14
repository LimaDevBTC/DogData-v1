// Rodar: npx tsx --test app/dogcity/landing/unclaimed.test.ts
//
// O relogio da Whitelist, os textos do verificador, o link do lote com UTM e o ?address=. Alturas SIMULADAS (as de verdade vem do
// mint em producao; nada aqui vai para a tela).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addressFromSearch, bannerText, blocksLeftText, mintLotHref, unclaimedText, whitelistClock,
} from './unclaimed'
import { parseMinterRead } from './use-mint-clock'

const CAL = { founderStart: 1000, whitelistStart: 1432, partnerStart: 4456, publicStart: 4744 }

test('relogio: dentro da Whitelist conta blocos ate partnerStart e diz about', () => {
  const c = whitelistClock(CAL, 3186)!
  assert.equal(c.active, true)
  assert.equal(c.blocksLeft, 1270)
  assert.equal(c.endBlock, 4456)
  assert.equal(c.publicBlock, 4744)
  assert.equal(c.about, 'about 9 days')
  assert.equal(bannerText(c), 'Unclaimed lots open to other wallets in about 9 days. Check your wallet.')
  assert.match(unclaimedText(c), /^Your lot is unclaimed\. Whitelist closes in about 9 days \(block 4,456\)\. After that, other wallets can mint it\.$/)
  assert.equal(blocksLeftText(c), '1,270 blocks left, about 9 days.')
})

test('relogio: bordas (primeiro e ultimo bloco da Whitelist) e fora dela', () => {
  assert.equal(whitelistClock(CAL, 1432)!.active, true)
  assert.equal(whitelistClock(CAL, 4455)!.active, true)
  assert.equal(whitelistClock(CAL, 4455)!.blocksLeft, 1)
  assert.equal(blocksLeftText(whitelistClock(CAL, 4455)!), '1 block left, about 10 minutes.')
  assert.equal(whitelistClock(CAL, 4456)!.active, false, 'em partnerStart a faixa some')
  assert.equal(whitelistClock(CAL, 4456)!.blocksLeft, 0)
  assert.equal(whitelistClock(CAL, 5000)!.active, false)
  assert.equal(whitelistClock(CAL, 1431)!.active, false, 'antes da Whitelist nao e Whitelist')
})

test('relogio: sem calendario ou sem altura nao inventa contagem', () => {
  assert.equal(whitelistClock(null, 100), null)
  assert.equal(whitelistClock(CAL, null), null)
  assert.equal(whitelistClock(CAL, -1), null)
  assert.equal(whitelistClock(CAL, 1.5), null)
})

test('copy: sem travessao nem emoji', () => {
  const c = whitelistClock(CAL, 3186)!
  for (const t of [bannerText(c), unclaimedText(c), blocksLeftText(c)]) assert.doesNotMatch(t, /[–—]/)
})

test('link do lote: leva os UTM de quem chegou', () => {
  const h = new URL(mintLotHref('S07-Q01-B001-L001', { utm_source: 'x', utm_medium: 'social', utm_campaign: 'nov', utm_content: 'post1' }))
  assert.equal(h.origin + h.pathname, 'https://mint.dogcity.space/lot/S07-Q01-B001-L001')
  assert.equal(h.searchParams.get('utm_source'), 'x')
  assert.equal(h.searchParams.get('utm_medium'), 'social')
  assert.equal(h.searchParams.get('utm_campaign'), 'nov')
  assert.equal(h.searchParams.get('utm_content'), 'post1')
})

test('link do lote: sem UTM de entrada marca o proprio verificador', () => {
  const h = new URL(mintLotHref('S07-Q01-B001-L001', {}))
  assert.equal(h.searchParams.get('utm_source'), 'dogdata')
  assert.equal(h.searchParams.get('utm_medium'), 'checker')
  assert.equal(h.searchParams.get('utm_campaign'), 'whitelist-unclaimed')
})

test('?address=: aceita endereco, recusa lixo', () => {
  assert.equal(addressFromSearch('?address=bc1qmkhn2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), 'bc1qmkhn2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
  assert.equal(addressFromSearch('?utm_source=x&address=bc1p0000000000000000000000000000000000000000000000000000'), 'bc1p0000000000000000000000000000000000000000000000000000')
  assert.equal(addressFromSearch(''), null)
  assert.equal(addressFromSearch('?address='), null)
  assert.equal(addressFromSearch('?address=<script>alert(1)</script>'), null)
  assert.equal(addressFromSearch('?address=abc'), null)
})

test('leitura do minter: calendario + altura + claimed viram o relogio', () => {
  const r = parseMinterRead({ height: 3186, claimed: 264, minted: 263, calendar: CAL })!
  assert.equal(r.claimed, 264)
  assert.equal(r.clock!.active, true)
  assert.equal(parseMinterRead({ height: 3186, minted: 263, calendar: CAL })!.claimed, 263)
})

test('leitura do minter: forma estranha nao vira numero', () => {
  assert.equal(parseMinterRead(null), null)
  assert.equal(parseMinterRead({ error: 'x' })!.clock, null)
  assert.equal(parseMinterRead({ height: 3186, calendar: { founderStart: 5, whitelistStart: 4 } })!.clock, null)
  assert.equal(parseMinterRead({ height: 'abc', calendar: CAL })!.clock, null)
  assert.equal(parseMinterRead({ height: 3186, claimed: -3, calendar: CAL })!.claimed, null)
})
