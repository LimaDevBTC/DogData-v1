// Run: npx tsx --test app/dogcity/motors/motors.test.ts
//
// A vitrine da DOG MOTORS: a ficha dos 18 bate com o catálogo da loja (nome, classe, ordem), os números do jogo ficam
// dentro das faixas da classe, as fotos existem nas três larguras, os créditos cobrem todo carro, e a leitura da
// vitrine e da garagem falha FECHADA (resposta torta = sem preço, sem botão, sem "Owned").
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CAR_MODELS, CAR_MODEL_IDS } from '@/lib/game/cars/catalog'
import { CAR_CREDITS, CLASS_COUNT, CLASS_LABEL, CLASS_ORDER, GAME_CLASS, PHOTO_WIDTHS, SHOWROOM, SPECS, photoSrcSet } from './cars'
import { offerFor, parseGarage, parseShowroom, satsToBtc } from './quote'

const ROOT = join(__dirname, '..', '..', '..')
const ADDR = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2q'.replace(/q$/, 'p')

test('os 18 da vitrine são os 18 do catálogo, com o mesmo nome e a mesma classe, na ordem das classes', () => {
  assert.equal(SHOWROOM.length, 18)
  assert.deepEqual([...SHOWROOM.map((c) => c.id)].sort(), [...CAR_MODEL_IDS].sort())
  for (const c of SHOWROOM) {
    assert.equal(c.name, CAR_MODELS[c.id].name)
    assert.equal(c.cls, CAR_MODELS[c.id].class)
    assert.equal(c.classLabel, CLASS_LABEL[c.cls])
  }
  // a ordem das classes e a numeração contínua 1..18
  const order = SHOWROOM.map((c) => CLASS_ORDER.indexOf(c.cls))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.deepEqual(SHOWROOM.map((c) => c.n), Array.from({ length: 18 }, (_, i) => i + 1))
  assert.equal(Object.values(CLASS_COUNT).reduce((a, b) => a + b, 0), 18)
  for (const cls of CLASS_ORDER) assert.ok(CLASS_COUNT[cls] >= 1, `classe ${cls} sem carro`)
})

test('os números do jogo: dentro das faixas que o jogo prova (dinamica_carro.test.ts) e coerentes entre si', () => {
  const FAIXA: Record<string, [number, number]> = {
    super: [330, 350], esportivo: [250, 300], luxo: [240, 260], classico: [200, 230], muscle: [200, 230], offroad: [160, 190], popular: [140, 160],
  }
  for (const id of CAR_MODEL_IDS) {
    const s = SPECS[id]
    assert.ok(s, `${id} sem ficha`)
    assert.equal(s.gameClass, GAME_CLASS[CAR_MODELS[id].class], `${id}: a classe do jogo não corresponde à da loja`)
    const [lo, hi] = FAIXA[s.gameClass]
    assert.ok(s.topKmh >= lo && s.topKmh <= hi, `${id}: ${s.topKmh} km/h fora de ${lo}-${hi}`)
    assert.ok(s.zeroTo100 > 2 && s.zeroTo100 < 10, `${id}: 0-100 em ${s.zeroTo100} s`)
    assert.ok(Number.isInteger(s.massKg) && s.massKg >= 700 && s.massKg <= 3000)
    assert.ok(/^[A-Za-z0-9 -]{2,20}$/.test(s.engine))
  }
  // o que se sente: o supercarro arranca antes do clássico, que arranca antes do popular
  assert.ok(SPECS.c02.zeroTo100 < SPECS.c28.zeroTo100 && SPECS.c28.zeroTo100 < SPECS.c52.zeroTo100)
})

test('as fotos existem nas três larguras e em AVIF e WebP, leves', () => {
  for (const id of CAR_MODEL_IDS) {
    for (const w of PHOTO_WIDTHS) {
      for (const ext of ['avif', 'webp']) {
        const f = join(ROOT, 'public', 'dogcity-motors', `car-${id}-${w}.${ext}`)
        assert.ok(existsSync(f), `falta ${f}`)
        assert.ok(statSync(f).size < 40_000, `${f} pesado demais`)
      }
    }
    assert.match(photoSrcSet(id, 'avif'), new RegExp(`car-${id}-896\\.avif 896w`))
  }
  for (const f of ['hero-1600.avif', 'hero-m-720.avif', 'gallery-1600.avif', 'tower-1200.avif', 'ring-1200.avif', 'race-1200.avif', 'og-dog-motors-r2.jpg']) {
    assert.ok(existsSync(join(ROOT, 'public', 'dogcity-motors', f)), `falta ${f}`)
  }
})

test('todo carro tem crédito CC BY (autor e link do modelo), sem nome de marca no link', () => {
  for (const id of CAR_MODEL_IDS) {
    const c = CAR_CREDITS[id]
    assert.ok(c && c.author.length > 0, `${id} sem autor`)
    assert.match(c.url, /^https:\/\/sketchfab\.com\/models\/[0-9a-f]{32}$/)
  }
})

test('a cópia da vitrine: sem travessão em nenhum arquivo da frente, sem promessa de valorização', () => {
  const files = [
    ...readdirSync(__dirname).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => join(__dirname, f)),
    join(ROOT, 'components', 'donate', 'car-checkout.tsx'),
    join(ROOT, 'components', 'donate', 'qr-code.tsx'),
    join(ROOT, 'app', 'dogcity', 'sections', 'motors-call.tsx'),
    join(ROOT, 'lib', 'game', 'cars', 'order-view.ts'),
    join(ROOT, 'lib', 'game', 'cars', 'order-status.ts'),
    join(ROOT, 'lib', 'game', 'cars', 'pay-to.ts'),
    join(ROOT, 'app', 'api', 'dogcity', 'car-order', 'route.ts'),
  ]
  assert.ok(files.filter((f) => f.endsWith('.tsx')).length >= 7)
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    // o travessão é proibido em qualquer texto (comentários de código em português também ficam sem ele)
    assert.ok(!src.includes('\u2014'), `${f} tem travessão`)
    // nada de promessa de valorização na cópia
    for (const bad of [/\bwill be worth\b/i, /\bguaranteed\b/i, /\binvestment\b/i, /\bprice will\b/i, /\bgo up in value\b/i, /\bappreciat/i, /\bprices? go(es)? up\b/i, /\bgo up\b/i]) {
      assert.ok(!bad.test(src), `${f}: ${bad}`)
    }
  }
})

// ── a leitura da vitrine ──
const okBody = () => ({
  models: CAR_MODEL_IDS.map((id) => ({ id, name: CAR_MODELS[id].name, class: CAR_MODELS[id].class, priceDog: 100_000, available: true, sats: 123_456 })),
  dogUsd: 0.002, btcUsd: 100_000, sources: [], asOf: '2026-11-13T12:00:00.000Z', lockMinutes: 15,
})

test('503 sales_closed é a loja fechada; qualquer outra falha é "unavailable"', () => {
  assert.deepEqual(parseShowroom(503, { error: 'sales_closed' }), { kind: 'closed' })
  assert.equal(parseShowroom(503, { error: 'no reliable quote right now' }).kind, 'unavailable')
  assert.equal(parseShowroom(500, null).kind, 'unavailable')
  assert.equal(parseShowroom(200, { models: 'x' }).kind, 'unavailable')
  assert.equal(parseShowroom(200, null).kind, 'unavailable')
  // loja fechada: o cartão não tem preço nem botão
  assert.deepEqual(offerFor({ kind: 'closed' }, 'c02'), { kind: 'closed' })
})

test('loja aberta: cada modelo inteiro vira oferta; modelo torto fica sem preço', () => {
  const b = okBody()
  ;(b.models[0] as any).name = 'Lamborghini'          // nome que o catálogo não vende
  ;(b.models[1] as any).priceDog = Number.NaN         // preço que não é preço
  ;(b.models[2] as any).priceDog = 10_000_000         // acima do teto
  ;(b.models[3] as any).available = false             // fora de venda
  ;(b.models[4] as any).sats = -5                     // sats tortos: some só a prévia
  ;(b.models[5] as any).class = 'super'               // classe trocada
  b.models.push({ ...b.models[6] })                   // repetido: vale o primeiro
  const s = parseShowroom(200, b)
  assert.equal(s.kind, 'open')
  assert.equal(offerFor(s, b.models[0].id).kind, 'unavailable')
  assert.equal(offerFor(s, b.models[1].id).kind, 'unavailable')
  assert.equal(offerFor(s, b.models[2].id).kind, 'unavailable')
  assert.equal(offerFor(s, b.models[3].id).kind, 'not_for_sale')
  assert.deepEqual(offerFor(s, b.models[4].id), { kind: 'for_sale', priceDog: 100_000, sats: null })
  assert.equal(offerFor(s, b.models[5].id).kind, 'unavailable')
  assert.deepEqual(offerFor(s, b.models[7].id), { kind: 'for_sale', priceDog: 100_000, sats: 123_456 })
  assert.equal(offerFor(s, 'c99').kind, 'unavailable')
})

test('a garagem: só afirma com 200, o mesmo endereço e modelos do catálogo', () => {
  const body = { address: ADDR, cars: [{ model: 'c02' }, { model: 'c99' }, { model: '__proto__' }, null] }
  assert.deepEqual([...(parseGarage(200, body, ADDR) ?? [])], ['c02'])
  assert.equal(parseGarage(503, body, ADDR), null)
  assert.equal(parseGarage(200, { ...body, address: 'bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63' }, ADDR), null)
  assert.equal(parseGarage(200, { address: ADDR, cars: 'c02' }, ADDR), null)
  assert.equal(parseGarage(200, body, 'not-an-address'), null)
})

test('sats em BTC sem ponto flutuante', () => {
  assert.equal(satsToBtc(1), '0.00000001')
  assert.equal(satsToBtc(123_456_789), '1.23456789')
  assert.equal(satsToBtc(50_000_000), '0.50000000')
  assert.equal(satsToBtc(-1), '')
  assert.equal(satsToBtc(1.5), '')
})
