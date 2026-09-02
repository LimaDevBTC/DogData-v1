#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// O PORTÃO DE CONFERÊNCIA DA CIDADE. Uma carga da cena, N chapas, um navegador.
//
// ⚠️ POR QUE ISTO EXISTE, e o motivo é medido. Em 02/09 quatro agentes estavam
// com aba aberta ao mesmo tempo, cada uma renderizando a cidade inteira, e a
// máquina do fundador travou. Antes disso, no dia 01, um agente reportou 37 fps
// onde o coordenador media 58, porque tinha três abas abertas: a medição dele
// estava errada e ele não sabia.
//
// O gargalo desta casa não é token nem merge, é RUNTIME COMPARTILHADO: um
// `next dev`, um `.next`, um navegador e uma GPU para todo mundo. A regra que
// sai daí é dura e simples:
//
//   AGENTE NÃO ABRE NAVEGADOR. Agente escreve código e diz o que quer ver.
//   A conferência visual roda AQUI, uma vez, para todos.
//
// Uma carga da cena leva uns 40 segundos. Rodar seis enquadramentos em seis
// abas custa seis cargas e seis contextos de GPU; aqui custa UMA, porque a
// câmera se move dentro da mesma cena já montada.
//
// Uso:
//   node scripts/city/chapas.mjs                      todos os enquadramentos, look 2
//   node scripts/city/chapas.mjs --look=1             o caminho antigo
//   node scripts/city/chapas.mjs --vistas=orla,foz    só alguns
//   node scripts/city/chapas.mjs --saida=/tmp/x       onde gravar
//   node scripts/city/chapas.mjs --url-extra='&hour=night'
//
// Sai: um JPEG por enquadramento e um chapas.json com stats e console.
// Código de saída 1 se aparecer erro de console que não seja da lista conhecida.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ⚠️ OS ENQUADRAMENTOS SÃO CONTRATO, não gosto. Eles estão repetidos em
// `wiki-dogdata/dogcity/orcamento.md` e é assim que uma chapa de hoje se compara
// com uma de semana passada. Acrescente, evite mudar os que existem.
const VISTAS = {
  rua:      [980, 46, 240, 500, 6, 120, 45],
  rasante:  [2100, 6, 2100, 1200, 4, 1200, 55],
  perto:    [700, 12, 330, 560, 4, 250, 40],
  longe:    [1500, 220, 2600, 200, 0, 900, 45],
  aerea:    [0, 1400, 2200, 0, 0, 0, 45],
  orla:     [2000, 70, -1500, 2900, -35, -2500, 45],
  foz:      [1100, 95, -2650, 1620, -35, -3260, 42],
  // ⚠️ ATUALIZADO EM 02/09: o pátio saiu de r 9.200 para r 11.200 quando a casca
  // foi a 9.050. O enquadramento antigo apontava para o lugar vazio, e a primeira
  // conferência depois da mudança fotografou chão nenhum sem ninguém perceber.
  spaceport:[-508, 520, 9700, -508, 180, 11188, 42],
  // a parada do tour, exatamente como o visitante a recebe
  padtour:  [-468, 95, 11403, -498, 129, 11128, 42],
  zenite:   [0, 300, 0, 0, 1200, 0, 60],
  // pedidos pelos agentes da água em 02/09, para conferir borda molhada e fusão
  // da areia no chão. Rasante de verdade: a câmera fica NA cota da lâmina.
  aguarase: [-971.93, -36, -5400, -842.47, -40.5, -5400, 55],
  areiarase:[2504, -35, -2190, 2714, -40, -1980, 55],
  // o mar e o arquipelago, de cima: a baia nova tem centro em (4815, -3589) e
  // raio equivalente 4.246 m, e a aerea padrao nao alcanca ela.
  mar:      [-1200, 4200, 3800, 4815, -40, -3589, 50],
  // pedido pelo agente do canal central em 02/09: rasante na margem INTERNA do
  // Lago da Praca, para julgar a praia por inclinacao e a juncao da malha fina
  lagointerno:[1000, 14, 300, 1200, -6, 360, 45],
  lagoponte: [0, 60, 1700, 0, -6, 1300, 50],
  // a Ilha do Fundador (IL01) de perto: forma da costa, praia, mata e patamar
  ilhaperto:[2650, 620, -3560, 3526, -30, -4340, 42],
  // a margem do Lago da Praca, o canal central: camera baixa sobre a beirada
  lagocentral:[0, 55, 2050, 0, -38, 1150, 48],
  lagorase:  [0, -30, 1750, 0, -39, 1250, 55],
}

// ⚠️ ERROS QUE NÃO SÃO NOSSOS. O backend local não roda, então estas rotas dão
// 503 sempre. Sem esta lista o portão acusaria falha em toda execução e viraria
// alarme que ninguém olha, que é pior que não ter alarme.
const RUIDO = [/\/api\/mempool\/dog/, /\/api\/donate\/leaderboard/, /\/api\/city\/chat/]

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=')
const look = arg('look', '2')
const saida = arg('saida', 'chapas')
const extra = arg('url-extra', '')
const pedidas = arg('vistas', '').split(',').filter(Boolean)
const lista = pedidas.length ? pedidas : Object.keys(VISTAS)
for (const v of lista) if (!VISTAS[v]) { console.error(`enquadramento desconhecido: ${v}\nexistem: ${Object.keys(VISTAS).join(', ')}`); process.exit(2) }

mkdirSync(saida, { recursive: true })
// ⚠️ `view=deck` NÃO É ENFEITE. Sem `?view=` a cena entra pelo voo de pouso da
// BATALHA, que é a entrada padrão, e esse voo é uma animação de câmera que
// SOBRESCREVE o `__plazaOlhar`: a primeira execução do portão, em 02/09, saiu com
// as três chapas mostrando o campo de guerra em vez dos enquadramentos pedidos.
// Qualquer `?view=` explícito desliga a entrada da guerra.
const url = `http://localhost:3000/city?stats=1&quality=high&view=deck&look=${look}${extra}`

const nav = await chromium.launch()
const pag = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const erros = [], logs = []
pag.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error') { if (!RUIDO.some((r) => r.test(t))) erros.push(t) }
  else if (/\[(vias|arborização|mobiliário|praças|lagos|canais|abóbada)\]/.test(t)) logs.push(t)
})
pag.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))

console.log(`carregando ${url}`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => !!window.__plazaStats, null, { timeout: 180000 })
// ⚠️ `__plazaStats` NASCE ANTES DE A CENA ESTAR PRONTA, e esperar só por ele me
// rendeu uma chapa da cortina de carga em 96% na primeira execução, em 02/09. O
// sinal honesto é o portão `boot.ready` do plaza-scene: enquanto ele é falso, a
// cena desenha um overlay preto por cima de tudo. Esperamos o overlay SAIR do DOM.
await pag.waitForFunction(
  () => !document.body.innerText.includes('The whole plaza loads before it opens'),
  null, { timeout: 300000 },
)
// ⚠️ E DEPOIS DO PORTÃO A CENA AINDA CRESCE. Os módulos pesados continuam
// chegando e a contagem de triângulos sobe por mais uns segundos.
await pag.waitForTimeout(25000)

const relatorio = { url, quando: new Date().toISOString(), vistas: {}, logs, erros }
for (const v of lista) {
  await pag.evaluate((a) => window.__plazaOlhar(...a), VISTAS[v])
  await pag.waitForTimeout(2500)
  const st = await pag.evaluate(() => window.__plazaStats)
  const arquivo = join(saida, `${v}-look${look}.jpeg`)
  // ⚠️ A CHAPA ESTOURA O TEMPO PADRÃO NESTA CENA. Medido em 02/09: o Playwright
  // espera as fontes e o compositor antes de capturar, e num quadro pesado isso
  // passa dos 30 s de fábrica. Prazo largo mais uma segunda tentativa: falhar a
  // captura por impaciência é o pior desfecho possível aqui, porque some
  // justamente a chapa do enquadramento mais caro, que é o que mais interessa.
  let tirou = false
  for (const prazo of [60000, 120000]) {
    try { await pag.screenshot({ path: arquivo, type: 'jpeg', quality: 88, timeout: prazo }); tirou = true; break }
    catch (e) { console.log(`  (${v}: chapa estourou ${prazo / 1000}s, tentando de novo)`) }
  }
  if (!tirou) { console.error(`  ${v}: NÃO consegui tirar a chapa`); relatorio.vistas[v] = { erro: 'timeout' }; continue }
  relatorio.vistas[v] = { arquivo, fps: st?.fps, calls: st?.calls, tris: st?.triangles, programas: st?.programs, pos: st?.pos }
  console.log(`  ${v.padEnd(10)} ${String(st?.fps).padStart(3)} fps · ${String(st?.calls).padStart(4)} calls · ${((st?.triangles ?? 0) / 1e6).toFixed(2)}M tris  -> ${arquivo}`)
}
await nav.close()
writeFileSync(join(saida, 'chapas.json'), JSON.stringify(relatorio, null, 2))

if (erros.length) {
  console.error(`\n⚠️ ${erros.length} erro(s) de console que não são da lista conhecida:`)
  for (const e of erros.slice(0, 10)) console.error('  ' + e)
  process.exit(1)
}
console.log(`\nsem erro de console. ${lista.length} chapas em ${saida}/`)
