import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage()
await p.goto('http://localhost:3000/city?stats=1&quality=low&view=deck&live=0&intro=0&modo=lote',
  { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof window.__plazaChao === 'function'
  && window.__plazaChao(0, 0).naVia !== null, null, { timeout: 900000 })
const r = await p.evaluate(async () => {
  const m = await fetch('/city/cidade-malha.json').then((r) => r.json())
  const tpk = m.constantes.travessasPorK || {}
  const qs = m.quarteiroes.filter((q) => (q.k ?? 0) >= 2 && (q.lotes ?? 0) > 0)
  const passo = Math.max(1, Math.floor(qs.length / 400))
  const vaos = [], laterais = []
  for (let i = 0; i < qs.length; i += passo) {
    const q = qs[i]
    const tab = tpk[String(q.k)]
    if (!tab || !tab.length) continue
    const g = (q.giro * Math.PI) / 180, ca = Math.cos(g), sa = Math.sin(g)
    const dirX = ca, dirZ = sa, perpX = -sa, perpZ = ca
    const z = (tab[0].z0 + tab[0].z1) / 2
    const cx = q.x + perpX * z, cz = q.z + perpZ * z
    for (const sgn of [-1, 1]) {
      // caminha a partir da PONTA da travessa, na direção dela
      const ex = cx + dirX * sgn * (q.lado / 2), ez = cz + dirZ * sgn * (q.lado / 2)
      let d = 999
      for (let t = 1; t <= 200; t += 2) {
        if (window.__plazaChao(ex + dirX * sgn * t, ez + dirZ * sgn * t).naVia) { d = t; break }
      }
      vaos.push(d)
    }
    // e a lateral: da borda EXTERNA do quarteirão para fora
    const meia = q.prof / 2
    for (const sgn of [-1, 1]) {
      const ex = q.x + perpX * sgn * meia, ez = q.z + perpZ * sgn * meia
      let d = 999
      for (let t = 1; t <= 200; t += 2) {
        if (window.__plazaChao(ex + perpX * sgn * t, ez + perpZ * sgn * t).naVia) { d = t; break }
      }
      laterais.push(d)
    }
  }
  return { vaos, laterais, n: qs.length }
})
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * f)] }
const rel = (a, nome) => console.log(`  ${nome}: mediana ${q(a, .5)} m | p75 ${q(a, .75)} m | p90 ${q(a, .9)} m | ` +
  `até 6 m: ${(100 * a.filter((v) => v <= 6).length / a.length).toFixed(0)}% | nada em 200 m: ${a.filter((v) => v > 200).length}`)
console.log(`quarteirões com lote: ${r.n}, amostra ${r.vaos.length / 2}`)
rel(r.vaos, 'da PONTA da travessa até o asfalto')
rel(r.laterais, 'da BORDA externa do quarteirão até o asfalto')
await b.close()
