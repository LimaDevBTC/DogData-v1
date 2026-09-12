#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// repro-aquece.mjs — DISPARA DE PROPÓSITO a corrida "descarte durante sondagem".
//
// O DEFEITO QUE ISTO GUARDA (12/09/2026): `renderer.compileAsync` do three sonda
// os materiais numa corrente própria de `setTimeout` e lê
// `properties.get(material).currentProgram` sem guarda nenhuma. Material
// descartado no meio da sondagem apaga esse mapa, o `isReady()` estoura DENTRO
// do timer (fora de qualquer try/catch) e a promessa NUNCA assenta. Quem
// dependia dela para acender ficava invisível para sempre. O conserto foi parar
// de usar `compileAsync` e dirigir a sondagem em `obra.ts`.
//
// ⚠️ POR QUE UM SCRIPT PRÓPRIO, e não mais uma vista no portão. O portão
// (`chapas.mjs`) só posiciona a câmera DEPOIS de `__plazaPronto` mais a espera
// de assentamento, e a corrida exige o contrário: a câmera tem de já estar a
// menos de `INVERNO_R_DET` (6.000 m) do centro do parque ANTES de `aoPronto`
// chamar `revela(iv.group)`, senão `dispararCamadaPerto` nunca roda e o
// `disposeGrupo(florestaEsparsa.group)` nunca cai dentro da janela de sondagem.
//
// ⚠️ E NÃO OLHE PARA O PIXEL. Visibilidade não prova nada aqui: quem escreve
// `.visible` do grupo do inverno é o `DistanceCuller`, todo quadro. A evidência
// é o registro nomeado em `window.__plazaAquece`.
//
// Uso:
//   node scripts/city/repro-aquece.mjs
//   node scripts/city/repro-aquece.mjs --saida=/tmp/repro-aquece.json
//
// Sai 1 se houver erro de console/pageerror OU se algum aquecimento ficar 'em voo'.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'

// = VISTAS.invernope de scripts/city/chapas.mjs (pé da montanha, ~1 km do centro
// do parque de inverno). Não invente coordenada nova aqui.
const VISTA = [-7300, 240, 700, -8325, 600, 291, 50]
const saida = (process.argv.find((a) => a.startsWith('--saida=')) || '--saida=/tmp/repro-aquece.json').split('=').slice(1).join('=')
const url = 'http://localhost:3000/city?stats=1&quality=high&view=deck&live=0&look=2'

const nav = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu'] })
const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const erros = [], logs = []
const t0 = Date.now()
pag.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error') erros.push(t)
  if (/\[(aquece|inverno)\]/.test(t)) logs.push(`${Date.now() - t0} ms  ${t}`)
})
pag.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))

console.log(`carregando ${url}`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: 480000 })
const fixa = () => pag.evaluate((v) => window.__plazaOlhar?.(...v), VISTA).catch(() => {})
await fixa()
const ate = Date.now() + 300000
let carga = false
while (Date.now() < ate) {
  await pag.waitForTimeout(2000)
  await fixa() // `controls.update()` roda depois no laço: reafirma o posto
  const st = await pag.evaluate(() => ({
    carga: !!window.__invernoCarga,
    aquece: (window.__plazaAquece ?? []).map((a) => ({ ...a })),
  }))
  carga = st.carga
  const iv = st.aquece.find((a) => a.nome === 'inverno')
  if (carga && iv && iv.motivo !== 'em voo') break
}
const aquece = await pag.evaluate(() => (window.__plazaAquece ?? []).map((a) => ({ ...a })))
await nav.close()
writeFileSync(saida, JSON.stringify({ url, quando: new Date().toISOString(), invernoSinalizou: carga, aquece, logs, erros }, null, 2))
for (const a of aquece) console.log(`  ${a.nome}: ${a.materiais} materiais, ${a.motivo}, ${a.ms} ms, ${a.descartados} descartado(s) na sondagem`)
const emVoo = aquece.filter((a) => a.motivo === 'em voo').map((a) => a.nome)
if (emVoo.length) console.error(`PENDURADO (promessa que nunca assentou): ${emVoo.join(', ')}`)
if (erros.length) { console.error(`erros de console: ${erros.length}`); for (const e of erros) console.error('  ' + e) }
console.log(`relatório em ${saida}`)
process.exit(erros.length || emVoo.length ? 1 : 0)
