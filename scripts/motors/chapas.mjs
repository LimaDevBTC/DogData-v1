#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS no site: as chapas de prova da página /dogcity/motors, Chromium no desktop e WebKit em emulação de
// iPhone 13 (o fundador testa no iPhone). UM navegador por vez, um depois do outro.
//
//   flock /tmp/dogcity-navegador.lock node scripts/motors/chapas.mjs [url base] [pasta de saída]
//
// Dois estados:
//   fechada  a rota de verdade (sem as variáveis CAR_FUND_* a loja responde 503 sales_closed): "Coming soon"
//   aberta   respostas SIMULADAS só nesta chapa (route do Playwright): preços marcadores do catálogo, uma carteira
//            conectada e assinada, o c05 na garagem, e um pedido BTC de mentira para a janela de compra. A janela
//            mostra o portão do destino (a segunda declaração de lib/game/cars/pay-to.ts vem vazia: "Do not pay").
// Mede também: altura do cartão no celular (em telas), rolagem lateral, travessão e texto em português na página.
// O playwright-core é o do OrdCards (os navegadores dele estão instalados nesta máquina).
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const pw = require(process.env.PLAYWRIGHT_CORE ?? '/home/bitmax/Projects/bitcoin-fullstack/OrdCards/node_modules/playwright-core')
const BASE = process.argv[2] ?? 'http://localhost:3917'
const OUT = process.argv[3] ?? 'chapas/dog_motors_site'
mkdirSync(OUT, { recursive: true })

const ADDR = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'
const PAYER = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const CAR_BTC = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
// os 18 do catálogo com os preços MARCADORES de lib/game/cars/catalog.ts (simulação, não são preços)
const MODELS = [
  ['c02', 'DOG Centurion', 'super', 500000], ['c05', 'DOG Revolt', 'super', 500000], ['c15', 'DOG Bison', 'sport', 150000],
  ['c39', 'DOG Horizon R', 'sport', 120000], ['c40', 'DOG Apex 90', 'sport', 120000], ['c41', 'DOG Surge IV', 'sport', 120000],
  ['c10', 'DOG Sovereign', 'luxury', 200000], ['c25', 'DOG Turbo 75', 'classic', 80000], ['c26', 'DOG Gullwing 54', 'classic', 80000],
  ['c28', 'DOG Monarch GT', 'classic', 80000], ['c62', 'DOG Breeze', 'classic', 60000], ['c30', 'DOG Cutter 71', 'muscle', 70000],
  ['c32', 'DOG Stallion', 'muscle', 70000], ['c61', 'DOG Stallion 65 Convertible', 'muscle', 70000], ['c42', 'DOG Field 41', 'offroad', 50000],
  ['c43', 'DOG Outpost 110', 'offroad', 50000], ['c52', 'DOG Bug', 'popular', 20000], ['c56', 'DOG Bug Classic', 'popular', 20000],
]
const DOG_USD = 0.0021, BTC_USD = 98000
const satsOf = (dog) => Math.round((dog * DOG_USD / BTC_USD) * 1e8)

async function mockOpen(page) {
  await page.route('**/api/dogcity/car-quote', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      const m = MODELS.find((x) => x[0] === body.model)
      const now = Date.now()
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: '3f2b8c1e-9a4d-4f6b-8e2a-1c5d7e9f0a1b', model: m[0], name: m[1], currency: body.currency, priceDog: m[3],
          payTo: CAR_BTC, payerAddress: body.paymentAddress ?? ADDR, expiresAt: new Date(now + 15 * 60_000).toISOString(), serverTime: new Date(now).toISOString(),
          ...(body.currency === 'btc'
            ? { sats: satsOf(m[3]), dogUsd: DOG_USD, btcUsd: BTC_USD, sources: [{ name: 'DOG/USD kraken', price: DOG_USD }, { name: 'DOG/USD okx', price: DOG_USD }, { name: 'BTC/USD coinbase', price: BTC_USD }] }
            : { dogExact: `${m[3]}.04217`, dogExactAtoms: m[3] * 100000 + 4217 }),
        }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        models: MODELS.map(([id, name, cls, priceDog]) => ({ id, name, class: cls, priceDog, available: true, sats: satsOf(priceDog) })),
        dogUsd: DOG_USD, btcUsd: BTC_USD, sources: [], asOf: new Date().toISOString(), lockMinutes: 15,
      }),
    })
  })
  await page.route('**/api/dogcity/cars?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: ADDR, cars: [{ model: 'c05', name: 'DOG Revolt', source: 'purchase', since: '2026-11-13T00:00:00Z' }] }),
  }))
  await page.route('**/api/wallet/session', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ session: { address: ADDR, walletId: 'xverse' } }),
  }))
  await page.addInitScript(([a, p]) => {
    localStorage.setItem('dogdata-wallet-account', JSON.stringify({ walletId: 'xverse', ordinalsAddress: a, paymentAddress: p, network: 'mainnet' }))
  }, [ADDR, PAYER])
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

async function scrollTo(page, sel, offset = 0) {
  await page.evaluate(([s, o]) => {
    const el = document.querySelector(s)
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o)
  }, [sel, offset])
  await page.waitForTimeout(900)
}

async function audit(page, tag) {
  const r = await page.evaluate(() => {
    const text = document.body.innerText
    const card = document.querySelector('[data-motors] article')
    return {
      emDash: text.includes('—'),
      portuguese: /\b(não|você|comprar|preço|carro|carteira|garagem|loja)\b/i.test(text),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      cardH: card ? Math.round(card.getBoundingClientRect().height) : null,
      vh: window.innerHeight,
      height: document.documentElement.scrollHeight,
    }
  })
  return { tag, ...r, cardScreens: r.cardH ? +(r.cardH / r.vh).toFixed(2) : null }
}

const results = []

// ── Chromium, desktop ──
{
  const browser = await pw.chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/dogcity/motors`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await settle(page, 2000)
  await page.screenshot({ path: join(OUT, 'd01_heroi.jpg'), type: 'jpeg', quality: 82 })
  await scrollTo(page, '#place', 0)
  await page.screenshot({ path: join(OUT, 'd02_lugar.jpg'), type: 'jpeg', quality: 82 })
  await scrollTo(page, '#place ul', 80)
  await page.screenshot({ path: join(OUT, 'd03_torre_ring_corrida.jpg'), type: 'jpeg', quality: 82 })
  await scrollTo(page, '#cars', 0)
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, 'd04_vitrine_fechada.jpg'), type: 'jpeg', quality: 82 })
  await scrollTo(page, '#cars .mt-grid', 80)
  await page.screenshot({ path: join(OUT, 'd05_cartoes_fechada.jpg'), type: 'jpeg', quality: 82 })
  await scrollTo(page, '#buy', 0)
  await page.screenshot({ path: join(OUT, 'd06_como_comprar.jpg'), type: 'jpeg', quality: 82 })
  results.push(await audit(page, 'chromium 1440 fechada'))
  await page.screenshot({ path: join(OUT, 'd00_pagina_inteira_fechada.jpg'), type: 'jpeg', quality: 70, fullPage: true })

  // aberta (simulada)
  const p2 = await ctx.newPage()
  await mockOpen(p2)
  await p2.goto(`${BASE}/dogcity/motors#cars`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await settle(p2, 2000)
  await scrollTo(p2, '#cars .mt-grid', 80)
  await p2.screenshot({ path: join(OUT, 'd07_cartoes_aberta.jpg'), type: 'jpeg', quality: 82 })
  results.push(await audit(p2, 'chromium 1440 aberta'))
  // a janela de compra do DOG Surge IV, em BTC
  await p2.locator('article', { hasText: 'DOG Surge IV' }).getByRole('button', { name: /Buy the DOG Surge IV/ }).click()
  await p2.waitForTimeout(1500)
  await p2.screenshot({ path: join(OUT, 'd08_janela_compra.jpg'), type: 'jpeg', quality: 82 })
  await p2.getByRole('radio', { name: /BTC/ }).click()
  await p2.getByRole('button', { name: /Lock the BTC price/ }).click()
  await p2.waitForTimeout(1500)
  await p2.screenshot({ path: join(OUT, 'd09_pedido_portao_destino.jpg'), type: 'jpeg', quality: 82 })
  await browser.close()
}

// ── WebKit, iPhone 13 ──
{
  const browser = await pw.webkit.launch()
  const ctx = await browser.newContext({ ...pw.devices['iPhone 13'] })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/dogcity/motors`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await settle(page, 2000)
  await page.screenshot({ path: join(OUT, 'm01_heroi_iphone.jpg'), type: 'jpeg', quality: 80 })
  await scrollTo(page, '#place', 0)
  await page.screenshot({ path: join(OUT, 'm02_lugar_iphone.jpg'), type: 'jpeg', quality: 80 })
  await scrollTo(page, '#cars .mt-grid', 64)
  await page.screenshot({ path: join(OUT, 'm03_cartao_fechada_iphone.jpg'), type: 'jpeg', quality: 80 })
  results.push(await audit(page, 'webkit iphone13 fechada'))

  const p2 = await ctx.newPage()
  await mockOpen(p2)
  await p2.goto(`${BASE}/dogcity/motors`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await settle(p2, 2000)
  await scrollTo(p2, '#cars .mt-grid', 64)
  await p2.screenshot({ path: join(OUT, 'm04_cartao_aberta_iphone.jpg'), type: 'jpeg', quality: 80 })
  await scrollTo(p2, '#cars .mt-grid li:nth-child(2)', 64)
  await p2.screenshot({ path: join(OUT, 'm05_cartao_owned_iphone.jpg'), type: 'jpeg', quality: 80 })
  results.push(await audit(p2, 'webkit iphone13 aberta'))
  await p2.locator('article', { hasText: 'DOG Bug Classic' }).getByRole('button', { name: /Buy the DOG Bug Classic/ }).click()
  await p2.waitForTimeout(1500)
  await p2.screenshot({ path: join(OUT, 'm06_janela_compra_iphone.jpg'), type: 'jpeg', quality: 80 })
  await p2.getByRole('button', { name: /Get my exact amount/ }).click()
  await p2.waitForTimeout(1500)
  await p2.screenshot({ path: join(OUT, 'm07_pedido_dog_iphone.jpg'), type: 'jpeg', quality: 80 })
  await browser.close()
}

writeFileSync(join(OUT, 'medidas.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
