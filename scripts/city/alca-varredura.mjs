#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A ALCA DE TERRA DENTRO DA BAIA: onde ela esta e que largura tem.
//
// ⚠️ PERGUNTA DO FUNDADOR, 07/09: "o ultimo anel do dodecaedro fica exatamente
// sobre a alca de terra que temos dentro da baia. Precisamos ver qual a largura
// dessa alca, se ela comporta via luxuosa no meio, terrenos de um lado e do
// outro. Os terrenos terao praia de um lado e pista do outro."
//
// ⚠️ MEDE `superficieAt` NA CENA, nao o heightmap. A baia final e o resultado da
// terraplanagem do canal e do podio; ler o heightmap responderia onde a agua
// NATURAL esta, nao onde ela acabou ficando.
//
// Varre em coordenada polar e, em cada rumo, acha os TRECHOS SECOS cercados de
// agua dos dois lados. Esse e o corte transversal da alca.
//
// Uso:  node scripts/city/alca-varredura.mjs [--passo=20] [--rumos=720]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const PASSO = +arg('passo', 20)
const RUMOS = +arg('rumos', 720)
const R0 = +arg('r0', 5800), R1 = +arg('r1', 9050)
const SAIDA = arg('saida', '/tmp/alca')
const PRAZO = +arg('prazo', 1500000)
const AGUA = -40

mkdirSync(SAIDA, { recursive: true })
const pontos = [], idx = []
for (let b = 0; b < RUMOS; b++) {
  const g = (b / RUMOS) * Math.PI * 2
  const sx = Math.sin(g), sz = -Math.cos(g)
  for (let r = R0; r <= R1; r += PASSO) { idx.push([b, g, r]); pontos.push([sx * r, sz * r]) }
}
console.log(`${RUMOS} rumos x r ${R0}-${R1} de ${PASSO} em ${PASSO} m = ${pontos.length.toLocaleString('pt-BR')} pontos`)

const nav = await chromium.launch()
try {
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const url = 'http://localhost:3000/city?stats=1&quality=high&view=deck&live=0&look=2'
  console.log(`carregando ${url}`)
  await pag.goto(url, { waitUntil: 'domcontentloaded' })
  await pag.waitForFunction(() => !!window.__plazaPerfil, null, { timeout: PRAZO })
  await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: PRAZO })
  await pag.waitForTimeout(4000)
  console.log('cena pronta, sondando o relevo')
  const ys = []
  const LOTE = 20000
  for (let i = 0; i < pontos.length; i += LOTE) {
    const p = pontos.slice(i, i + LOTE)
    ys.push(...await pag.evaluate((pp) => window.__plazaPerfil(pp), p))
  }
  console.log(`${ys.length.toLocaleString('pt-BR')} cotas`)

  // por rumo: os trechos secos com agua dos DOIS lados
  const porRumo = new Array(RUMOS).fill(null).map(() => [])
  const nR = Math.floor((R1 - R0) / PASSO) + 1
  for (let b = 0; b < RUMOS; b++) {
    const base = b * nR
    const seco = []
    for (let k = 0; k < nR; k++) seco.push(ys[base + k] > AGUA)
    let k = 0
    while (k < nR) {
      if (!seco[k]) { k++; continue }
      let f = k
      while (f < nR && seco[f]) f++
      const aguaAntes = k > 0 && !seco[k - 1]
      const aguaDepois = f < nR && !seco[f]
      if (aguaAntes && aguaDepois) {
        porRumo[b].push({ rIn: R0 + k * PASSO, rOut: R0 + (f - 1) * PASSO, larg: (f - k) * PASSO })
      }
      k = f
    }
  }

  const linhas = []
  let comAlca = 0, somaL = 0, minL = Infinity, maxL = 0
  for (let b = 0; b < RUMOS; b++) {
    const g = (b / RUMOS) * 360
    for (const t of porRumo[b]) {
      comAlca++; somaL += t.larg
      if (t.larg < minL) minL = t.larg
      if (t.larg > maxL) maxL = t.larg
      linhas.push({ rumo: +g.toFixed(2), ...t, meio: (t.rIn + t.rOut) / 2 })
    }
  }
  writeFileSync(`${SAIDA}/alca.json`, JSON.stringify(linhas, null, 1))
  console.log('')
  console.log(`${comAlca} cortes com terra cercada de agua dos dois lados, em ${porRumo.filter((p) => p.length).length} rumos de ${RUMOS}`)
  if (comAlca) console.log(`largura: min ${minL} m, media ${(somaL / comAlca).toFixed(0)} m, max ${maxL} m`)
  console.log('')
  // os arcos contiguos de rumo em que a alca existe
  const tem = porRumo.map((p) => p.length > 0)
  const arcos = []
  let b = 0
  while (b < RUMOS) {
    if (!tem[b]) { b++; continue }
    let f = b
    while (f < RUMOS && tem[f]) f++
    arcos.push([b, f - 1])
    b = f
  }
  // costura o arco que passa pelo rumo 0
  if (arcos.length > 1 && arcos[0][0] === 0 && arcos[arcos.length - 1][1] === RUMOS - 1) {
    const u = arcos.pop(); arcos[0] = [u[0] - RUMOS, arcos[0][1]]
  }
  arcos.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))
  console.log('os arcos de alca, do maior para o menor:')
  for (const [i0, i1] of arcos.slice(0, 8)) {
    const g0 = (i0 / RUMOS) * 360, g1 = (i1 / RUMOS) * 360
    const ls = [], ms = []
    for (let k = i0; k <= i1; k++) {
      const p = porRumo[(k + RUMOS) % RUMOS]
      if (!p.length) continue
      const maior = p.reduce((a, c) => (c.larg > a.larg ? c : a))
      ls.push(maior.larg); ms.push((maior.rIn + maior.rOut) / 2)
    }
    if (!ls.length) continue
    ls.sort((a, c) => a - c)
    const med = ls[Math.floor(ls.length / 2)]
    const compr = ((i1 - i0 + 1) / RUMOS) * 2 * Math.PI * (ms.reduce((a, c) => a + c, 0) / ms.length)
    console.log(`  rumo ${g0.toFixed(1).padStart(6)} a ${g1.toFixed(1).padStart(6)} (${(g1 - g0).toFixed(1)} graus, ~${(compr / 1000).toFixed(2)} km de arco)`)
    console.log(`     largura min ${ls[0]} · mediana ${med} · max ${ls[ls.length - 1]} m`
      + ` · eixo medio em r ${Math.round(ms.reduce((a, c) => a + c, 0) / ms.length)}`)
    const estreitos = ls.filter((l) => l < 200).length
    console.log(`     cortes abaixo de 200 m: ${estreitos} de ${ls.length} (${(100 * estreitos / ls.length).toFixed(0)}%)`)
  }
} finally {
  await nav.close()
}
