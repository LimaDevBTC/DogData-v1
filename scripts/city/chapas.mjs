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
//   node scripts/city/chapas.mjs --vistas=olhobulevar,olhonucleo,olhobairro,olhoborda
//                                                     as quatro de altura do olho
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
  padtour:  [-388, 227, 11618, -528, 299, 11148, 42],
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
  // ⚠️ O MACIÇO OESTE, acrescentado em 03/09 quando ele deixou de ser morro e
  // virou estação de inverno. O cume medido fica em r 8.330, azimute 268 graus,
  // ou seja (-8.325, 291), a 1.065,9 m. Estes dois enquadramentos são contrato:
  // é contra eles que a montanha de amanhã se compara com a de hoje.
  inverno:   [-3800, 1250, 400, -8325, 700, 291, 42],
  // ⚠️ A CASCA, acrescentada em 03/09 quando a flecha foi de 2.566 para 5.500 e a
  // borda deixou de ser constante. Os três são contrato: `abobada` julga se ela
  // lê como cúpula ou como lente de dentro, `cascaoeste` é o arco onde a borda
  // sobe para 353 m e é o único lugar onde a forma nova aparece, e `abobadafora`
  // é a silhueta de fora. Coordenadas copiadas de `viewFor()`, e a do oeste é
  // espelhada da `abobadafora` para pegar o lado que mudou.
  abobada:   [0, 900, 3000, 0, 620, 0, 45],
  // ⚠️ ENQUADRAMENTOS NOVOS, 03/09, e o motivo é o que o cabeçalho do terrain.ts
  // avisa: MEXER NA ALTURA MOVE O MUNDO. A coroa foi de 2.619 para 5.513 m e a
  // `abobada` acima, calibrada para a casca velha, passou a fotografar céu preto:
  // a colmeia subiu para fora do cone da câmera. Estes dois OLHAM PARA CIMA.
  cupula:    [0, 240, 2400, 0, 3600, 0, 60],
  cupulaoeste:[-5200, 300, 1200, -8600, 2200, 500, 60],
  abobadafora:[4600, 1250, 4600, 0, 380, 0, 45],
  cascaoeste:[-6400, 1700, 4200, -8000, 500, 300, 45],
  invernope: [-7300, 240, 700, -8325, 600, 291, 50],
}

// ═══════════════════════════════════════════════════════════════════════════
// OS ENQUADRAMENTOS DE ALTURA DO OLHO (02/09/2026)
//
// ⚠️ POR QUE UMA TABELA SEPARADA, e não mais quatro linhas em VISTAS. Nas de
// cima o `y` é um número escrito à mão, e isso funciona porque a câmera está a
// dezenas ou centenas de metros do chão: errar 3 m numa aérea não muda a chapa.
// A 1,7 m, errar 30 cm põe a câmera dentro do asfalto ou flutuando, e o chão da
// DogCity varia 232 m dentro do sítio. Então aqui o `y` NÃO se escreve: ele se
// pergunta para a cena, com `window.__plazaChao(x, z)`, que devolve a MESMA
// superfície que a malha desenha.
//
// ⚠️ E O PONTO TAMBÉM SE PERGUNTA. O centro de um quarteirão não é rua, é lote.
// Cada semente abaixo é um LUGAR, não uma coordenada exata: o roteiro procura em
// anéis crescentes o pavimento mais próximo, usando `naVia`, que é a mesma
// máscara com que a arborização evita plantar dentro do asfalto. Sem isso a
// chapa de rua saía com a câmera no meio de um lote vazio, olhando para nada.
//
// Formato: [x semente, z semente, rumo em graus, fov].
// Rumo segue a convenção dos bulevares de `cidade-malha.json`: 0 = -z.
// As sementes de quarteirão são os IDs reais da malha, um por banda:
//   olhonucleo  S03-Q04-B001 (Núcleo, k=2, travessa estreita)
//   olhobairro  S06-Q17-B015 (Bairro, k=4)
//   olhoborda   S04-Q19-B017 (Borda, k=5, o quarteirão mais fundo)
const OLHOS = {
  olhobulevar: [12, -2600, 0, 55],          // BUL01, olhando para fora
  olhonucleo:  [1697.7, 802.9, 115.312, 55],
  olhobairro:  [-1258.6, -3809.8, 341.719, 55],
  olhoborda:   [-1778.2, 4609.7, 201.094, 55],
}

/** Resolve uma semente de OLHOS no argumento de `__plazaOlhar`, dentro da página. */
const acharRua = (pag, [x0, z0, rumo, fov]) =>
  pag.evaluate(
    ([x0, z0, rumo, fov]) => {
      const rad = (rumo * Math.PI) / 180
      const dir = [Math.sin(rad), -Math.cos(rad)]
      let pe = null
      // ⚠️ ANÉIS DE 2 EM 2 m ATÉ 200 m, COM PASSO ANGULAR EM ARCO, e as duas
      // coisas são conserto de erro medido em 02/09. O primeiro laço andava de
      // 10 em 10 graus: a 100 m do centro isso são 17 m entre amostras, e a
      // travessa da cidade tem 9 m de largura. Duas das quatro sementes voltaram
      // "não achei pavimento" com a rua passando a 100 m dali. Passo de arco de
      // 3 m nunca pula uma via, porque a via mais estreita tem 9.
      // O alcance vai a 200 porque o quarteirão mais fundo tem 286 m de prof.,
      // ou seja 143 m do centro ao contorno, e 140 raspava.
      for (let r = 2; r <= 200 && !pe; r += 2) {
        const passos = Math.max(12, Math.ceil((2 * Math.PI * r) / 3))
        for (let k = 0; k < passos; k++) {
          const ar = (k / passos) * 2 * Math.PI
          const c = window.__plazaChao(x0 + r * Math.cos(ar), z0 + r * Math.sin(ar))
          if (c && c.naVia) { pe = c; break }
        }
      }
      if (!pe) return null
      const ax = pe.x + dir[0] * 60, az = pe.z + dir[1] * 60
      const alvo = window.__plazaChao(ax, az)
      // olho a 1,7 m, alvo a 1,6 m: a linha de visada cai 10 cm em 60 m, que é
      // o que o olho de um adulto faz e o que põe o horizonte no lugar certo.
      return { args: [pe.x, pe.superficieAt + 1.7, pe.z, ax, alvo.superficieAt + 1.6, az, fov], achouEm: pe }
    },
    [x0, z0, rumo, fov],
  )

// ⚠️ ERROS QUE NÃO SÃO NOSSOS. O backend local não roda, então estas rotas dão
// 503 sempre. Sem esta lista o portão acusaria falha em toda execução e viraria
// alarme que ninguém olha, que é pior que não ter alarme.
const RUIDO = [/\/api\/mempool\/dog/, /\/api\/donate\/leaderboard/, /\/api\/city\/chat/]

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=')
const look = arg('look', '2')
const saida = arg('saida', 'chapas')
const extra = arg('url-extra', '')
const pedidas = arg('vistas', '').split(',').filter(Boolean)
// ⚠️ RESOLUÇÃO PARAMETRIZADA, padrão INALTERADO. 1440x900 continua sendo o que
// sai quando ninguém pede nada, para que a chapa de hoje siga comparável com a
// da semana passada. Peça de marketing é outro caso: banner de YouTube quer
// 2560x1440 e esticar 1440 até lá borra, que é o defeito do banner antigo.
// `escala` é deviceScaleFactor: renderiza em N vezes e reduz, o que suaviza
// serrilhado melhor do que qualquer filtro depois.
const largura = +arg('largura', 1440)
const altura = +arg('altura', 900)
const escala = +arg('escala', 1)
// ⚠️ O PRAZO DE CARGA ESCALA COM O QUADRO. Em 1440x900 a cena abre em ~40 s e os
// 300 s cravados sobravam. Em 2560x1440 são 2,8x mais pixels e a primeira
// tentativa estourou o prazo sem tirar nenhuma chapa. Quem pede quadro grande
// precisa poder pedir prazo grande junto.
// ⚠️ 300 s NÃO BASTAM QUANDO A MÁQUINA ESTÁ COMPARTILHADA, medido em 02/09: duas
// execuções seguidas estouraram o prazo, e uma sonda do mesmo portão, com a
// máquina mais folgada, mediu o portão abrindo em 169,9 s com zero erro de
// console. Ou seja o portão está são e o prazo é que estava justo. 480 s dá a
// folga de 2,8x que o pior caso medido pede.
const prazoCarga = +arg('prazo-carga', 480000)
const lista = pedidas.length ? pedidas : [...Object.keys(VISTAS), ...Object.keys(OLHOS)]
for (const v of lista) if (!VISTAS[v] && !OLHOS[v]) { console.error(`enquadramento desconhecido: ${v}\nexistem: ${[...Object.keys(VISTAS), ...Object.keys(OLHOS)].join(', ')}`); process.exit(2) }

mkdirSync(saida, { recursive: true })
// ⚠️ `view=deck` NÃO É ENFEITE. Sem `?view=` a cena entra pelo voo de pouso da
// BATALHA, que é a entrada padrão, e esse voo é uma animação de câmera que
// SOBRESCREVE o `__plazaOlhar`: a primeira execução do portão, em 02/09, saiu com
// as três chapas mostrando o campo de guerra em vez dos enquadramentos pedidos.
// Qualquer `?view=` explícito desliga a entrada da guerra.
const url = `http://localhost:3000/city?stats=1&quality=high&view=deck&look=${look}${extra}`

const nav = await chromium.launch()
const pag = await (await nav.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: escala })).newPage()
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
// ⚠️ O SINAL AGORA E EXPLICITO, e a mudanca veio de tres chapas pretas. A espera
// antiga era pela AUSENCIA de uma frase no DOM, e isso e corrida: em 02 e 03/09
// ela passou com a cortina de carga ainda de pe e o roteiro fotografou preto,
// uma vez com `?plate=1` (que esconde a propria frase que ele procurava) e duas
// sem motivo aparente. `plaza-scene.tsx` agora publica `window.__plazaPronto`
// no MESMO efeito que abre a cena, entao nao ha como os dois divergirem.
// A frase fica como reserva, para o roteiro nao quebrar contra uma versao velha.
// ⚠️ SEM RESERVA, E ISSO E DELIBERADO. Eu tinha deixado a condicao antiga ligada
// por `||` "para nao quebrar contra versao velha", e foi ELA que disparou na
// execucao seguinte: a chapa saiu na cortina de 7 por cento outra vez. Uma
// condicao de reserva mais fraca ligada por OU nao e rede de seguranca, e o
// caminho de menor resistencia para o bug voltar. Ou o sinal existe, ou falha.
await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: prazoCarga })
// e uma confirmacao curta: o sinal pode nascer um quadro antes do primeiro
// desenho da cena aberta, e a chapa nao pode pegar esse quadro
await pag.waitForTimeout(1500)
// ⚠️ E DEPOIS DO PORTÃO A CENA AINDA CRESCE. Os módulos pesados continuam
// chegando e a contagem de triângulos sobe por mais uns segundos.
await pag.waitForTimeout(25000)

const relatorio = { url, quando: new Date().toISOString(), vistas: {}, logs, erros }
for (const v of lista) {
  let achouEm = null
  if (OLHOS[v]) {
    const r = await acharRua(pag, OLHOS[v])
    if (!r) { console.error(`  ${v}: não achei pavimento a 200 m da semente (${OLHOS[v][0]}, ${OLHOS[v][1]})`); relatorio.vistas[v] = { erro: 'sem via em 200 m' }; continue }
    achouEm = r.achouEm
    await pag.evaluate((a) => window.__plazaOlhar(...a), r.args)
  } else {
    await pag.evaluate((a) => window.__plazaOlhar(...a), VISTAS[v])
  }
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
  relatorio.vistas[v] = { arquivo, fps: st?.fps, calls: st?.calls, tris: st?.triangles, programas: st?.programs, pos: st?.pos, ...(achouEm ? { olho: achouEm } : {}) }
  console.log(`  ${v.padEnd(12)} ${String(st?.fps).padStart(3)} fps · ${String(st?.calls).padStart(4)} calls · ${((st?.triangles ?? 0) / 1e6).toFixed(2)}M tris · ${String(st?.programs).padStart(3)} prog${achouEm ? ` · rua em (${achouEm.x.toFixed(0)}, ${achouEm.z.toFixed(0)}) cota ${achouEm.superficieAt}` : ''}  -> ${arquivo}`)
}
await nav.close()
writeFileSync(join(saida, 'chapas.json'), JSON.stringify(relatorio, null, 2))

if (erros.length) {
  console.error(`\n⚠️ ${erros.length} erro(s) de console que não são da lista conhecida:`)
  for (const e of erros.slice(0, 10)) console.error('  ' + e)
  process.exit(1)
}
console.log(`\nsem erro de console. ${lista.length} chapas em ${saida}/`)
