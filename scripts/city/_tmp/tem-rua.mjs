// Todo lote tem rua na frente? Pergunta para a RUA, com a mesma máscara
// (`naVia`) que a arborização usa para não plantar dentro do asfalto.
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
  const porSetor = {}, semRua = []
  // ⚠️ A BUSCA É NOS QUATRO LADOS. O registro não diz qual lado é a testada
  // (o giro dá o eixo, não o sentido), então "tem rua" é: existe pavimento
  // encostado em pelo menos um dos quatro lados do retângulo.
  const OFF = [2, 5, 9]
  for (let i = 0; i < n; i++) {
    const o = i * REG
    const x = dv.getInt16(o, true) / 4, z = dv.getInt16(o + 2, true) / 4
    const s = dv.getUint8(o + 4)
    const w = dv.getUint16(o + 9, true) / 10, d = dv.getUint16(o + 11, true) / 10
    const g = (dv.getUint16(o + 13, true) / 100) * Math.PI / 180
    const ca = Math.cos(g), sa = Math.sin(g)
    let achou = false
    for (const [lx0, lz0, ex, ez] of [[0, -d / 2, 0, -1], [0, d / 2, 0, 1],
                                      [-w / 2, 0, -1, 0], [w / 2, 0, 1, 0]]) {
      for (const t of OFF) {
        const lx = lx0 + ex * t, lz = lz0 + ez * t
        const px = x + lx * ca - lz * sa, pz = z + lx * sa + lz * ca
        if (window.__plazaChao(px, pz).naVia) { achou = true; break }
      }
      if (achou) break
    }
    porSetor[s] = porSetor[s] || { n: 0, com: 0 }
    porSetor[s].n++
    if (achou) porSetor[s].com++
    else if (semRua.length < 12) semRua.push({ s, x: Math.round(x), z: Math.round(z), w, d })
  }
  return { n, porSetor, semRua }
})
let tot = 0, com = 0
for (const [s, v] of Object.entries(r.porSetor)) { tot += v.n; com += v.com }
console.log(`lotes: ${tot} | com rua encostada: ${com} (${(100 * com / tot).toFixed(2)}%) | sem: ${tot - com}`)
for (const [s, v] of Object.entries(r.porSetor).sort((a, c) => +a[0] - +c[0])) {
  console.log(`  setor ${(+s + 1).toString().padStart(2)}: ${v.n.toString().padStart(6)} lotes, ${(100 * v.com / v.n).toFixed(1)}% com rua`)
}
if (r.semRua.length) { console.log('  exemplos sem rua:'); for (const q of r.semRua) console.log('   ', JSON.stringify(q)) }
await b.close()
