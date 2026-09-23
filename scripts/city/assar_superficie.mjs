#!/usr/bin/env node
// ASSA A SUPERFÍCIE COMO CONSTRUÍDA e grava em disco, para o gerador PERGUNTAR à
// cena qual é a cota em vez de reimplementá-la.
//
// ⚠️ POR QUE ISTO EXISTE, e a resposta é uma conta de 22/09/2026. O gerador tinha
// a própria `altura()`, uma RÉPLICA em Python do `heightAt` da cena, e as duas
// divergiram em silêncio por dezenove dias: o platô ficou em 1.470/1.830 contra
// 2.400/2.760, a bacia do Lago da Praça não existia do lado de cá, e a vala dos
// canais radiais também não. Custo medido contra o registro selado: 12.340 lotes
// com a cota gravada a mais de 1,5 m do chão que a cena desenha, pior caso
// 56,6 m, e 36 lotes com escritura ABAIXO da lâmina d'água.
//
// ⚠️ E `cota_cm` ENTRA NA FOLHA DO MERKLE. Então isso nunca foi defeito de
// desenho, foi defeito de TÍTULO: a escritura afirmava um número que o chão da
// cidade desmente. O portão de 15 testes não pegava porque ele compara a cota de
// cada lote com a MEDIANA DOS VIZINHOS, e erro que vale igual para o bairro
// inteiro passa sem uma linha vermelha.
//
// ⚠️ A TENTAÇÃO ERRADA É PORTAR A FÓRMULA DE NOVO. Seria a QUARTA cópia (cena,
// gerador, conferir_terreno.py e a nova), e as três primeiras já divergiram. O
// próprio `plaza-scene.tsx` registra que replicar o terreno fora da cena "já
// errou por 75 m uma vez". `superficieAt` é a MESMA função que assenta lote,
// rua, praia e peça: é a única fonte que não diverge do que a câmera mostra.
//
// DOIS MODOS:
//   node scripts/city/assar_superficie.mjs
//       assa a GRADE (padrão 1.600² sobre ±12.000 m, célula 15,0 m) em
//       data/superficie.f32 + data/superficie.json. É o que o gerador lê para
//       plantar: testar declive, rejeitar candidato, medir água.
//
//   node scripts/city/assar_superficie.mjs --pontos=data/dogcity_lotes.csv
//       além da grade, pergunta a cota EXATA no centro de cada lote e grava
//       data/superficie_lotes.csv. É o que vira `cota_cm` na escritura: sem
//       erro de grade nenhum, porque é ponto arbitrário e não interpolação.
//
// ⚠️ O DEV SERVER TEM DE ESTAR NO AR em localhost:3000, e ele NÃO pode ter sido
// derrubado por um `next build` recente (o build e o dev dividem o mesmo `.next`;
// depois de buildar, reinicie o dev antes de assar).
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ A IMPRESSÃO DIGITAL DO CHÃO, E ELA É O CADEADO DESTA FRENTE. Assar uma vez
// não resolve nada se o arquivo puder envelhecer em silêncio: era exatamente
// assim que o gerador media um platô de 1.470 enquanto a cena desenhava 2.400.
// Aqui a assadura grava o sha256 de TODO módulo que entra em `heightAt`, e o
// gerador recalcula e ABORTA se divergir. Não há modo "continua assim mesmo":
// selar uma cidade contra um chão que mudou é o defeito que isto conserta.
const RAIZ_TS = resolve(dirname(fileURLToPath(import.meta.url)), '../../app/city/plaza')
// ⚠️ A LISTA SE DESCOBRE SOZINHA, E ESSA LIÇÃO CUSTOU UMA ASSADURA. A primeira
// versão disto tinha treze nomes escritos à mão. Meia hora depois entrou um
// módulo novo de chão (`margem-agua.ts`, o §16.6), fora da lista, e a digital
// não teria mudado: o gerador seguiria plantando sobre um chão velho achando que
// estava em dia. Lista escrita à mão envelhece, e envelhecer em silêncio é o
// defeito exato que esta digital existe para matar.
//
// Agora a varredura parte de `terrain.ts` e segue os `import ... from './x'`
// TRANSITIVAMENTE. Módulo novo que entre no chão entra na conta no mesmo commit
// em que nasce, sem ninguém lembrar de nada.
const modulosDoChao = () => {
  const vistos = new Set()
  const fila = ['terrain.ts']
  while (fila.length) {
    const m = fila.shift()
    if (vistos.has(m)) continue
    vistos.add(m)
    let txt = ''
    try { txt = readFileSync(`${RAIZ_TS}/${m}`, 'utf8') } catch { continue }
    for (const mt of txt.matchAll(/^\s*import[^'"]*['"]\.\/([A-Za-z0-9._-]+)['"]/gm)) {
      const alvo = mt[1].endsWith('.ts') ? mt[1] : `${mt[1]}.ts`
      if (!vistos.has(alvo)) fila.push(alvo)
    }
  }
  return [...vistos].sort()
}
const MODULOS_DO_CHAO = modulosDoChao()
const digitalDoChao = () => {
  const h = createHash('sha256')
  for (const m of MODULOS_DO_CHAO) {
    let txt = ''
    try { txt = readFileSync(`${RAIZ_TS}/${m}`, 'utf8') } catch { txt = '(ausente)' }
    h.update(m); h.update('\0'); h.update(txt); h.update('\0')
  }
  return h.digest('hex')
}

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=')
const n = +arg('n', 1600)
const raio = +arg('raio', 12000)
const prazo = +arg('prazo', 900000)
const saida = arg('saida', 'data')
const pontosCsv = arg('pontos', '')
// ⚠️ O LOTE DA SONDA NÃO É ESTÉTICA. `__plazaPerfil` devolve um array de números
// por CDP, em JSON: pedir os 2,56 M pontos da grade de uma vez é ~50 MB de JSON
// numa chamada só, e o que acontece é a chamada morrer sem dizer por quê. Em
// lotes de 100 k o pico fica em ~2 MB e o progresso é visível, que importa
// porque a cena leva minutos para abrir e ninguém deve ficar no escuro.
const LOTE = +arg('lote', 100000)
// ⚠️ SÓ DESENVOLVIMENTO (tarefa da selagem fora do git, 23/09): `--reg=NOME`
// acrescenta `&reg=NOME` à URL da cena, o MESMO override de `registro-dev.ts`
// (`app/city/plaza/*`) que aponta cidade.json/malha/bins para
// `public/city/NOME/`. Sem `--reg=`, a URL sai idêntica à de sempre.
const reg = arg('reg', '')
const regQS = reg ? `&reg=${encodeURIComponent(reg)}` : ''

mkdirSync(saida, { recursive: true })
const nav = await chromium.launch()
const pag = await (await nav.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const url = `http://localhost:3000/city?stats=1&quality=high&view=deck&ilhas=1&live=0${regQS}`
console.log(`carregando ${url}`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => !!window.__plazaPerfil, null, { timeout: prazo })
// ⚠️ ESPERAR A OBRA TERMINAR, não só a função existir. A cena constrói em fatias
// (ver obra.ts) e o terreno é a faixa 0, mas o pódio, o campus e a orla entram
// depois. Sondar cedo devolve o chão pela metade, que é pior que não sondar.
await pag.waitForFunction(
  () => !document.body.innerText.includes('The whole plaza loads before it opens'),
  null, { timeout: prazo })
await pag.waitForTimeout(20000)

const sonda = async (pontos) => {
  const out = new Float64Array(pontos.length)
  for (let i = 0; i < pontos.length; i += LOTE) {
    const fatia = pontos.slice(i, i + LOTE)
    const h = await pag.evaluate((p) => window.__plazaPerfil(p), fatia)
    for (let k = 0; k < h.length; k++) out[i + k] = h[k]
    process.stdout.write(`\r  ${Math.min(i + LOTE, pontos.length)} de ${pontos.length}`)
  }
  process.stdout.write('\n')
  return out
}

// ── a grade ────────────────────────────────────────────────────────────────
const celula = (2 * raio) / (n - 1)
console.log(`assando a grade ${n} por ${n} sobre ${2 * raio} m (celula ${celula.toFixed(2)} m)...`)
const pts = new Array(n * n)
for (let j = 0; j < n; j++) {
  const z = -raio + celula * j
  for (let i = 0; i < n; i++) pts[j * n + i] = [-raio + celula * i, z]
}
const alt = await sonda(pts)
const buf = Buffer.alloc(alt.length * 4)
let min = Infinity, max = -Infinity
for (let i = 0; i < alt.length; i++) {
  buf.writeFloatLE(alt[i], i * 4)
  if (alt[i] < min) min = alt[i]
  if (alt[i] > max) max = alt[i]
}
writeFileSync(`${saida}/superficie.f32`, buf)
const digital = digitalDoChao()
writeFileSync(`${saida}/superficie.json`, JSON.stringify({
  n, raio, celulaM: celula, min, max,
  digitalDoChao: digital,
  modulos: MODULOS_DO_CHAO,
  fonte: 'window.__plazaPerfil (superficieAt), a mesma funcao que assenta lote, rua e peca',
}, null, 1))
console.log(`  digital do chao ${digital.slice(0, 16)}... sobre ${MODULOS_DO_CHAO.length} modulos`)
console.log(`gravado ${saida}/superficie.f32 (${(buf.length / 1e6).toFixed(1)} MB), relevo de ${min.toFixed(1)} a ${max.toFixed(1)} m`)

// ── a cota exata por lote, se pedida ───────────────────────────────────────
if (pontosCsv) {
  const linhas = readFileSync(pontosCsv, 'utf8').trim().split('\n')
  const cab = linhas[0].split(',')
  const iId = cab.indexOf('lot_id'), iX = cab.indexOf('x_m'), iZ = cab.indexOf('z_m')
  if (iId < 0 || iX < 0 || iZ < 0) { console.error('csv sem lot_id/x_m/z_m'); process.exit(1) }
  const ids = [], pp = []
  for (let k = 1; k < linhas.length; k++) {
    const c = linhas[k].split(',')
    ids.push(c[iId]); pp.push([+c[iX], +c[iZ]])
  }
  console.log(`sondando a cota exata de ${ids.length} lotes...`)
  const h = await sonda(pp)
  const out = ['lot_id,cota_cena_m']
  for (let k = 0; k < ids.length; k++) out.push(`${ids[k]},${h[k].toFixed(3)}`)
  writeFileSync(`${saida}/superficie_lotes.csv`, out.join('\n') + '\n')
  console.log(`gravado ${saida}/superficie_lotes.csv`)
}
await nav.close()
