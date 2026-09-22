import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage()
await p.goto('http://localhost:3000/city?stats=1&quality=low&view=deck&live=0&intro=0', { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => typeof window.__plazaChao === 'function'
  && Math.abs(window.__plazaChao(6950, -1000).superficieAt) > 1, null, { timeout: 600000 })
const out = await p.evaluate(() => {
  const R = 4400, RUMO = 25 * Math.PI / 180  // dentro do distrito
  const ux = Math.sin(RUMO), uz = -Math.cos(RUMO)
  const px = -uz, pz = ux
  const l = []
  for (let perp = 0; perp <= 180; perp += 8) {
    const x = ux * R + px * perp, z = uz * R + pz * perp
    const c = window.__plazaChao(x, z)
    l.push([perp, c.superficieAt, c.heightAt])
  }
  return l
})
for (const [perp, s, h] of out) console.log(String(perp).padStart(4), String(s).padStart(8), String(h).padStart(8))
await b.close()
