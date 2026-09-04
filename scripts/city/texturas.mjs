#!/usr/bin/env node
// O CENSO DE VRAM POR TEXTURA, lido da cena de verdade.
//
// ⚠️ POR QUE NÃO DÁ PARA FAZER ISSO POR GREP. As quatro primeiras texturas
// cortadas em 03/09 foram achadas lendo código, e o método tem dois furos: não
// vê textura que vem de ARQUIVO (um .webp de 4096 não aparece em nenhum número
// no fonte) nem textura que uma biblioteca cria por dentro. `renderer.info`
// também não serve: ele CONTA texturas e não pesa nenhuma.
//
// Roda a cena uma vez, com o mesmo perfil de aparelho que se quiser medir, e
// chama `window.__plazaTexturas()`.
//
//   node scripts/city/texturas.mjs                    # desktop
//   node scripts/city/texturas.mjs --mobile           # emulando iPhone 13
import { chromium, devices } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const movel = process.argv.includes('--mobile')
const prazo = +arg('prazo', 900000)

const nav = await chromium.launch()
const ctx = await nav.newContext(movel ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } })
const pag = await ctx.newPage()
// ⚠️ SEM `quality=high`, E ISSO JÁ ESTRAGOU UMA MEDIÇÃO. `topo.mjs` e
// `chapas.mjs` forçam `quality=high` de propósito (querem a geometria cheia), e
// copiar a URL deles aqui mede o perfil ERRADO: o `high` tem teto de textura de
// identidade, então o censo saiu idêntico ao de antes do teto existir e parecia
// que o corte não tinha funcionado. Para medir memória de celular a qualidade
// tem de ser a que o aparelho escolhe sozinho.
const url = `http://localhost:3000/city?stats=1&view=deck${movel ? '' : '&quality=high'}`
console.log(`carregando ${url}  (${movel ? 'iPhone 13 emulado' : 'desktop'})`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => !!window.__plazaTexturas, null, { timeout: prazo })
await pag.waitForFunction(
  () => !document.body.innerText.includes('The whole plaza loads before it opens'),
  null, { timeout: prazo })
await pag.waitForTimeout(15000)
const c = await pag.evaluate(() => window.__plazaTexturas())
await nav.close()

console.log(`\n${c.quantas} texturas distintas na cena, ${c.total} MB de VRAM `
  + `(o renderizador conta ${c.contadasPeloRenderer})`)
console.log(`\n${'px'.padStart(12)} ${'MB'.padStart(7)}   onde`)
for (const t of c.maiores) console.log(`${t.px.padStart(12)} ${String(t.mb).padStart(7)}   ${t.onde}`)
