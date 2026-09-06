#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// VARREDURA DOS TRES CANAIS RADIAIS, do canal central ate a foz na baia.
//
// ⚠️ POR QUE PASSA PELO NAVEGADOR. O relevo que interessa nao e o heightmap
// natural (`public/lunar/btc-core-heightmap.f32`): a cidade escava a vala do
// canal, ergue a banda de 950 m dos dois lados e enche tudo que fica abaixo de
// -40. Quem sabe a cota final e `superficieAt`, dentro da cena. Ler o heightmap
// aqui responderia onde a baia NATURAL esta, e nao onde a agua ACABOU ficando.
//
// ⚠️ E POR QUE UMA SONDA NOVA. `__plazaGrade` amostra grade regular de 40 m; um
// canal de 60 m de lamina cabe em uma celula e meia. Auditar canal exige andar
// no eixo e cortar transversal, ou seja ponto arbitrario: `__plazaPerfil`.
//
// Uso:  node scripts/city/canais-varredura.mjs [--passo=10] [--saida=...]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const PASSO = +arg('passo', 10)
const SAIDA = arg('saida', '/tmp/canais')
const PRAZO = +arg('prazo', 900000)

const malha = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const RADIAIS = malha.canais.radiais
const NIVEL = malha.lagos.cota            // -40
const BANDA = 950                          // CANAL_BANDA, terrain.ts:119
const R0 = 1400, R1 = 8400

// as transversais: eixo, muro, praia, meio da banda, borda da banda, fora dela
const LATERAIS = [0, 30, 60, 150, 400, 700, 960, 1200]

const pontos = []
const indice = []
for (const r of RADIAIS) {
  const g = (r.rumo * Math.PI) / 180
  const sx = Math.sin(g), sz = -Math.cos(g)
  const px = -sz, pz = sx
  for (let rr = R0; rr <= R1; rr += PASSO) {
    for (const lat of LATERAIS) {
      for (const sg of lat === 0 ? [0] : [-1, 1]) {
        indice.push({ id: r.id, r: rr, lat: sg * lat })
        pontos.push([sx * rr + px * sg * lat, sz * rr + pz * sg * lat])
      }
    }
  }
}
console.log(`${RADIAIS.length} canais, r ${R0} a ${R1} de ${PASSO} em ${PASSO} m, ${LATERAIS.length} laterais`)
console.log(`${pontos.length.toLocaleString('pt-BR')} pontos para amostrar`)

mkdirSync(SAIDA, { recursive: true })
const nav = await chromium.launch()
try {
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const url = 'http://localhost:3000/city?stats=1&quality=high&view=deck&live=0&look=2'
  console.log(`carregando ${url}`)
  await pag.goto(url, { waitUntil: 'domcontentloaded' })
  await pag.waitForFunction(() => !!window.__plazaPerfil, null, { timeout: PRAZO })
  await pag.waitForFunction(
    () => !document.body.innerText.includes('The whole plaza loads before it opens'),
    null, { timeout: PRAZO })
  await pag.waitForTimeout(8000)
  // ⚠️ EM LOTES. Uma chamada com 300 mil pares atravessa a ponte do Playwright
  // como um JSON gigante e estoura a memoria do contexto.
  const alturas = []
  const LOTE = 20000
  for (let i = 0; i < pontos.length; i += LOTE) {
    const parte = await pag.evaluate((p) => window.__plazaPerfil(p), pontos.slice(i, i + LOTE))
    alturas.push(...parte)
    process.stdout.write(`\r  ${Math.min(i + LOTE, pontos.length).toLocaleString('pt-BR')} / ${pontos.length.toLocaleString('pt-BR')}`)
  }
  console.log()
  const linhas = indice.map((k, i) => ({ ...k, y: alturas[i] }))
  writeFileSync(`${SAIDA}/perfil.json`, JSON.stringify({ nivel: NIVEL, banda: BANDA, passo: PASSO, laterais: LATERAIS, radiais: RADIAIS, linhas }))
  console.log(`gravado ${SAIDA}/perfil.json (${linhas.length.toLocaleString('pt-BR')} amostras)`)
} finally {
  await nav.close()
}
