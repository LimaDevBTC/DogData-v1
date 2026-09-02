#!/usr/bin/env node
// Extrai a SUPERFÍCIE COMO CONSTRUÍDA da cena e grava em disco.
//
// ⚠️ Por que passar pelo navegador em vez de ler o heightmap: o arquivo
// `public/lunar/btc-core-heightmap.f32` é o relevo NATURAL da Lua. A cidade
// modifica ele em cima: pódio, rampa, bacia do Lago da Praça, vala dos canais,
// cova do parque, monte. Quem quiser desenhar a topografia DA CIDADE tem de ler
// `superficieAt`, que é a mesma função que assenta lote, rua e peça. Replicar
// isso fora da cena já errou por 75 m uma vez (ver a nota em __plazaGrade).
//
//   node scripts/city/topo.mjs --n=600 --raio=12000
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
// O destino padrao e a pasta de pecas premium, NAO /tmp: peca de marketing
// gravada em /tmp e apagada no proximo boot, e ja se perdeu um mapa assim.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const PADRAO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../marketing/mapas')

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const n = +arg('n', 600), raio = +arg('raio', 12000)
const saida = arg('saida', PADRAO)
mkdirSync(saida, { recursive: true })

const nav = await chromium.launch()
const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const url = 'http://localhost:3000/city?stats=1&quality=high&view=deck&ilhas=1'
console.log(`carregando ${url}`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => !!window.__plazaGrade, null, { timeout: 180000 })
await pag.waitForFunction(
  () => !document.body.innerText.includes('The whole plaza loads before it opens'),
  null, { timeout: 300000 })
await pag.waitForTimeout(20000)
console.log(`amostrando ${n} por ${n} sobre ${2 * raio} m...`)
const g = await pag.evaluate(([n, r]) => window.__plazaGrade(n, r), [n, raio])
await nav.close()

const buf = Buffer.alloc(g.alturas.length * 4)
g.alturas.forEach((v, i) => buf.writeFloatLE(v, i * 4))
writeFileSync(`${saida}/topo.f32`, buf)
writeFileSync(`${saida}/topo.json`, JSON.stringify({ n: g.n, raio: g.raio, min: g.min, max: g.max, celulaM: (2 * g.raio) / (g.n - 1) }, null, 1))
console.log(`gravado ${saida}/topo.f32 (${(buf.length / 1e6).toFixed(2)} MB) e topo.json`)
console.log(`  relevo de ${g.min.toFixed(1)} a ${g.max.toFixed(1)} m, celula ${((2 * g.raio) / (g.n - 1)).toFixed(1)} m`)
