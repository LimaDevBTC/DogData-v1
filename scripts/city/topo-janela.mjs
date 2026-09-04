#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A JANELA TOPOGRÁFICA: uma grade fina de um PEDAÇO do mundo, não da cidade toda.
//
// ⚠️ POR QUE ESTE EXISTE AO LADO DE `topo.mjs`. Aquele amostra `__plazaGrade`,
// que é sempre CENTRADA NA PRAÇA e cobre 24 km de lado: no melhor caso prático
// (n=600) a célula sai com 40 m. Quarenta metros é bom para desenhar a carta da
// cidade e é cego para julgar montanha: o maciço oeste inteiro cabe em 60
// células, e "o pico está pontiagudo demais" é uma pergunta sobre INCLINAÇÃO,
// que só existe se a célula for menor que a feição.
//
// Aqui a grade é local: centro, meia-largura e n livres. Em (-8325, 291) com
// meia-largura 2.600 m e n=520, a célula sai com 10 m.
//
// ⚠️ E A ALTURA VEM DA CENA, PELO MESMO MOTIVO QUE `topo.mjs` REGISTRA: o
// heightmap em disco é o relevo NATURAL da Lua, e a cidade escreve por cima
// (pódio, cova do parque, monte, pista de esqui). Quem julga o que se vê tem de
// ler `superficieAt`, e o único jeito de fazer isso de fora é pela cena.
//
// ⚠️ UMA CARGA, TODAS AS JANELAS. O gargalo desta casa é runtime compartilhado
// (a nota longa está em `chapas.mjs`), então este script aceita várias janelas
// numa carga só: repita `--janela=nome:cx,cz:meia:n`.
//
//   node scripts/city/topo-janela.mjs --janela=inverno:-8325,291:2600:520
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=')
const saida = arg('saida', '/home/bitmax/.local/share/dogcity/topo')
const prazo = +arg('prazo', 900000)
const janelas = process.argv.filter((a) => a.startsWith('--janela=')).map((a) => {
  const [nome, centro, meia, n] = a.slice('--janela='.length).split(':')
  const [cx, cz] = centro.split(',').map(Number)
  return { nome, cx, cz, meia: +meia, n: +n }
})
if (!janelas.length) janelas.push({ nome: 'inverno', cx: -8325, cz: 291, meia: 2600, n: 520 })
mkdirSync(saida, { recursive: true })

const nav = await chromium.launch()
const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const url = 'http://localhost:3000/city?stats=1&quality=high&view=deck'
console.log(`carregando ${url}`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => !!window.__plazaChao, null, { timeout: prazo })
await pag.waitForFunction(
  () => !document.body.innerText.includes('The whole plaza loads before it opens'),
  null, { timeout: prazo })
await pag.waitForTimeout(20000)

// ⚠️ CRONOMETRA ANTES DE COMPROMETER A CARGA. `__plazaChao` também consulta
// `naVia`, que percorre o grafo viário: se o ponto custar caro, 270 mil deles
// travam a aba e a carga inteira se perde. Melhor descobrir com mil.
const sonda = await pag.evaluate(() => {
  const t0 = performance.now()
  for (let k = 0; k < 1000; k++) window.__plazaChao(-8325 + k, 291)
  return (performance.now() - t0) / 1000
})
console.log(`custo por ponto: ${sonda.toFixed(4)} ms`)

for (const j of janelas) {
  console.log(`amostrando ${j.nome}: ${j.n} x ${j.n} em (${j.cx}, ${j.cz}), meia ${j.meia} m`
    + `, estimado ${((sonda * j.n * j.n) / 1000).toFixed(1)} s`)
  const g = await pag.evaluate(([cx, cz, meia, n]) => {
    const alturas = new Array(n * n)
    let min = Infinity, max = -Infinity
    for (let jj = 0; jj < n; jj++) {
      const z = cz - meia + (2 * meia * jj) / (n - 1)
      for (let i = 0; i < n; i++) {
        const x = cx - meia + (2 * meia * i) / (n - 1)
        const y = window.__plazaChao(x, z).superficieAt
        alturas[jj * n + i] = y
        if (y < min) min = y
        if (y > max) max = y
      }
    }
    return { min, max, alturas }
  }, [j.cx, j.cz, j.meia, j.n])
  const buf = Buffer.alloc(g.alturas.length * 4)
  g.alturas.forEach((v, i) => buf.writeFloatLE(v, i * 4))
  writeFileSync(`${saida}/${j.nome}.f32`, buf)
  const celula = (2 * j.meia) / (j.n - 1)
  writeFileSync(`${saida}/${j.nome}.json`, JSON.stringify(
    { n: j.n, centro: [j.cx, j.cz], meia: j.meia, min: g.min, max: g.max, celulaM: celula }, null, 1))
  console.log(`  ${saida}/${j.nome}.f32 (${(buf.length / 1e6).toFixed(2)} MB)`
    + `, relevo ${g.min.toFixed(1)} a ${g.max.toFixed(1)} m, celula ${celula.toFixed(1)} m`)
}
await nav.close()
