#!/usr/bin/env node
// O CENSO DE GEOMETRIA POR PEÇA, lido da cena de verdade.
//
// ⚠️ O IRMÃO DE `texturas.mjs`, E ELE FALTAVA. O censo de VRAM existe desde
// 03/09 e por isso a frente de TEXTURA foi resolvida (espelho KTX2). A de
// GEOMETRIA nunca teve instrumento: cada peça nova era medida à mão, no seu
// próprio `verificar-*.ts`, contra o seu próprio GLB. Assim dá para provar que
// o Derby cabe no celular e continuar sem saber que as torres não cabem.
//
// ⚠️ E O QUE PESA É O RESIDENTE, NÃO O .glb. Draco some no destino: o atributo
// cru é várias vezes o arquivo, e vive DUAS vezes (cópia JS + cópia GPU). Um
// THREE.LOD guarda TODOS os níveis, então o LOD baixa custo de desenho e não
// baixa memória nenhuma. É isso que este censo mede.
//
//   node scripts/city/geometria.mjs             # desktop
//   node scripts/city/geometria.mjs --mobile    # emulando iPhone 13
import { chromium, devices } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const movel = process.argv.includes('--mobile')
const prazo = +arg('prazo', 900000)
const topo = +arg('topo', 30)

const nav = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu'] })
const ctx = await nav.newContext(movel ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } })
const pag = await ctx.newPage()
// mesma regra do censo de textura: para medir o celular, a qualidade tem de ser
// a que o aparelho escolhe sozinho
const url = `http://localhost:3000/city?stats=1&view=deck&live=0${movel ? '' : '&quality=high'}`
console.log(`carregando ${url}  (${movel ? 'iPhone 13 emulado' : 'desktop'})`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: prazo })
await pag.waitForTimeout(25000)

const censo = await pag.evaluate(() => window.__plazaGeometria())
await nav.close()

const MiB = (n) => n.toFixed(2)
console.log(`\ngeometria residente: ${MiB(censo.mibResidente)} MiB  (atributo cru ${MiB(censo.mibAtributo)} MiB, x2 para cópia JS + GPU)`)
console.log(`${censo.triangulos.toLocaleString('pt-BR')} triângulos em ${censo.geometrias} geometrias, ${censo.pecas} peças nomeadas\n`)
console.log(`${'PEÇA'.padEnd(30)}${'MiB'.padStart(9)}${'TRIS'.padStart(12)}${'VERTS'.padStart(12)}${'B/VERT'.padStart(8)}${'MALHAS'.padStart(8)}`)
let somaTopo = 0
for (const l of censo.maiores.slice(0, topo)) {
  somaTopo += l.mib
  console.log(`${l.peca.slice(0, 29).padEnd(30)}${MiB(l.mib).padStart(9)}${l.tris.toLocaleString('pt-BR').padStart(12)}` +
    `${l.verts.toLocaleString('pt-BR').padStart(12)}${String(l.bytesPorVert).padStart(8)}${String(l.malhas).padStart(8)}`)
  // a quebra por atributo só nas cinco maiores: é onde ela muda uma decisão
  if (somaTopo && censo.maiores.indexOf(l) < 6) {
    console.log(`${''.padEnd(6)}${l.attrs.map((a) => `${a.nome} ${a.tipo.replace('Array', '')} ${MiB(a.mib)}`).join('  ·  ')}`)
  }
}
console.log(`\nas ${Math.min(topo, censo.maiores.length)} maiores somam ${MiB(somaTopo)} MiB de ${MiB(censo.mibResidente)} MiB`)
