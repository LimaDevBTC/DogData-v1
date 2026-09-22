import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage()
await p.goto('http://localhost:3000/city?stats=1&quality=low&view=deck&live=0&intro=0&modo=lote',
  { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof window.__plazaChao === 'function'
  && window.__plazaChao(0, 0).naVia !== null, null, { timeout: 900000 })
const r = await p.evaluate(async () => {
  const buf = await fetch('/city/cidade-lotes.bin').then((r) => r.arrayBuffer())
  const dv = new DataView(buf), REG = 15, n = Math.floor(buf.byteLength / REG)
  const passo = Math.max(1, Math.floor(n / 900))
  const d = []
  for (let i = 0; i < n; i += passo) {
    const o = i * REG
    const s = dv.getUint8(o + 4)
    if (s >= 6) continue                       // só o tecido comum
    const x = dv.getInt16(o, true) / 4, z = dv.getInt16(o + 2, true) / 4
    let melhor = 999
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a)
      for (let t = 2; t <= 250; t += 4) {
        if (window.__plazaChao(x + cx * t, z + cz * t).naVia) { if (t < melhor) melhor = t; break }
      }
    }
    d.push(melhor)
  }
  return d
})
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * f)] }
console.log(`tecido comum, ${r.length} lotes, busca em 24 direções até 250 m:`)
console.log(`  distância ao asfalto: mediana ${q(r, .5)} m | p75 ${q(r, .75)} m | p90 ${q(r, .9)} m`)
console.log(`  a 12 m ou menos: ${r.filter((v) => v <= 12).length} (${(100 * r.filter((v) => v <= 12).length / r.length).toFixed(0)}%)`)
console.log(`  nada em 250 m:   ${r.filter((v) => v > 250).length} (${(100 * r.filter((v) => v > 250).length / r.length).toFixed(0)}%)`)
await b.close()
