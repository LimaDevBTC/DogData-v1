// "sem rua encostada" é diagnóstico pobre. A pergunta certa é: a QUE DISTÂNCIA
// está o asfalto mais próximo da testada de cada lote?
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
  const passo = Math.max(1, Math.floor(n / 4000))
  const d = [], porSetor = {}
  for (let i = 0; i < n; i += passo) {
    const o = i * REG
    const x = dv.getInt16(o, true) / 4, z = dv.getInt16(o + 2, true) / 4
    const s = dv.getUint8(o + 4)
    const w = dv.getUint16(o + 9, true) / 10, dp = dv.getUint16(o + 11, true) / 10
    const g = (dv.getUint16(o + 13, true) / 100) * Math.PI / 180
    const ca = Math.cos(g), sa = Math.sin(g)
    let melhor = 999
    for (const [lx0, lz0, ex, ez] of [[0, -dp / 2, 0, -1], [0, dp / 2, 0, 1],
                                      [-w / 2, 0, -1, 0], [w / 2, 0, 1, 0]]) {
      for (let t = 1; t <= 120; t += 3) {
        const lx = lx0 + ex * t, lz = lz0 + ez * t
        const px = x + lx * ca - lz * sa, pz = z + lx * sa + lz * ca
        if (window.__plazaChao(px, pz).naVia) { if (t < melhor) melhor = t; break }
      }
    }
    d.push(melhor)
    porSetor[s] = porSetor[s] || []
    porSetor[s].push(melhor)
  }
  return { n, amostra: d.length, d, porSetor }
})
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * f)] }
console.log(`amostra ${r.amostra} de ${r.n} lotes. Distância da divisa até o asfalto mais próximo:`)
console.log(`  mediana ${q(r.d, .5)} m | p75 ${q(r.d, .75)} m | p90 ${q(r.d, .9)} m | acima de 120 m: ${r.d.filter((v) => v > 120).length}`)
for (const [s, a] of Object.entries(r.porSetor).sort((x, y) => +x[0] - +y[0])) {
  console.log(`  setor ${(+s + 1).toString().padStart(2)}: n=${String(a.length).padStart(5)}  mediana ${String(q(a, .5)).padStart(4)} m  p90 ${String(q(a, .9)).padStart(4)} m`)
}
await b.close()
