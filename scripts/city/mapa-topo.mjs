#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// O MAPA TOPOGRÁFICO DA DOGCITY, em curvas de nível.
//
// Lê a grade que `scripts/city/topo.mjs` extraiu da CENA (não do heightmap
// natural: ver a nota longa lá) e desenha um SVG cartográfico.
//
// ⚠️ VETOR, NÃO RASTER, e a escolha é de qualidade. Sombreamento de relevo por
// pixel exigiria embutir um PNG em base64 dentro do SVG, o que mata a nitidez no
// zoom e engorda o arquivo. Bandas hipsométricas preenchidas entre curvas dão o
// mesmo efeito de volume, são nativas de vetor e é assim que carta topográfica de
// verdade é feita desde antes de existir computador.
//
// ⚠️ AS BANDAS SÃO EMPILHADAS, NÃO RECORTADAS. Para cada cota, extraio o contorno
// da região {altura >= cota} e pinto ela inteira. Pintando da cota mais baixa
// para a mais alta, cada banda cobre o miolo da anterior e sobra um anel. Isso
// evita ter de calcular polígono de banda com furo, que é onde este tipo de
// código costuma quebrar. O `fill-rule: evenodd` resolve ilha e lagoa sozinho.
//
// ⚠️ TODO TEXTO QUE APARECE NA PEÇA É EM INGLÊS. Regra do fundador, 02/09: a
// comunicação do projeto é 100% inglês. Vale para rótulo, legenda, cartucho e
// qualquer coisa que o público leia. O comentário de código continua em
// português, que é a língua de quem mantém, não a de quem consome.
//
//   node scripts/city/mapa-topo.mjs --entrada=/tmp/topo --saida=/tmp/topo
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'

// ⚠️ A FONTE VAI EMBUTIDA, e não é capricho. Antes daqui o cartucho pedia
// `ui-monospace, SFMono-Regular, Menlo, monospace`: uma família do SISTEMA, que
// muda conforme a máquina que abre o arquivo. O letreiro DOGCITY do cartucho é a
// marca do projeto, e marca que troca de desenho por computador não é marca.
// 21 KB de woff2 em base64 contra 3,5 MB de vetor não pesa em nada.
const FONTE_EMBUTIDA = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'fontes/jetbrains-mono-latin.woff2')
).toString('base64')
const ESTILO = `<defs><style>
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400;
src:url(data:font/woff2;base64,${FONTE_EMBUTIDA}) format('woff2');}
</style></defs>`
// O destino padrao e a pasta de pecas premium, NAO /tmp: peca de marketing
// gravada em /tmp e apagada no proximo boot, e ja se perdeu um mapa assim.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const PADRAO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../marketing/mapas')

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=')
const ENT = arg('entrada', PADRAO)
const SAI = arg('saida', PADRAO)
const LADO = +arg('lado', 2400)          // o SVG, em px
const PASSO = +arg('passo', 20)          // curva fina, em metros
const MESTRA = +arg('mestra', 100)       // curva mestra, em metros

const meta = JSON.parse(readFileSync(`${ENT}/topo.json`, 'utf8'))
const N = meta.n, RAIO = meta.raio
const buf = readFileSync(`${ENT}/topo.f32`)
const H = new Float32Array(N * N)
for (let i = 0; i < N * N; i++) H[i] = buf.readFloatLE(i * 4)

const COTA_AGUA = +arg('agua', -40)
const F = LADO / 2400   // fator, para o desenho escalar junto
// ⚠️ A GRADE É EMOLDURADA POR UMA BORDA BAIXA, E SEM ISSO O MAPA SAI RASGADO.
// Marching squares só devolve laço FECHADO quando a região não toca a borda do
// domínio. Onde {altura >= cota} é cortada pela borda, a curva sai ABERTA, e
// fechar ela com `Z` traça uma corda reta atravessando o mapa inteiro: a
// primeira geração saiu com faixas diagonais gigantes por exatamente isso.
// Com uma moldura de uma célula em cota muito baixa, toda região fica cercada e
// todo contorno fecha sozinho. Custo: dois índices e nenhuma exceção no laço.
const FUNDO_MOLDURA = meta.min - 1000
const M = N + 2
const h = (i, j) => (i === 0 || j === 0 || i === M - 1 || j === M - 1)
  ? FUNDO_MOLDURA : H[(j - 1) * N + (i - 1)]
// mundo -> px. O mundo vai de -RAIO a +RAIO nos dois eixos; o z do mundo cresce
// para o sul, e no SVG o y cresce para baixo, então os dois concordam sem giro.
const px = (i) => ((i - 1) / (N - 1)) * LADO
const mundoPx = (m) => ((m + RAIO) / (2 * RAIO)) * LADO

// ── o terreno, consultado ponto a ponto ─────────────────────────────────────
// A mesma grade que desenha as curvas responde "dá para construir aqui?". É ela
// que impede a malha de sair jogada por cima da baía.
const celM = (2 * RAIO) / (N - 1)
const alturaEm = (x, z) => {
  const fi = ((x + RAIO) / (2 * RAIO)) * (N - 1), fj = ((z + RAIO) / (2 * RAIO)) * (N - 1)
  const i = Math.max(0, Math.min(N - 2, Math.floor(fi))), j = Math.max(0, Math.min(N - 2, Math.floor(fj)))
  const u = fi - i, v = fj - j
  return H[j * N + i] * (1 - u) * (1 - v) + H[j * N + i + 1] * u * (1 - v)
       + H[(j + 1) * N + i] * (1 - u) * v + H[(j + 1) * N + i + 1] * u * v
}
const declEm = (x, z) => {
  const hx = (alturaEm(x + celM, z) - alturaEm(x - celM, z)) / (2 * celM)
  const hz = (alturaEm(x, z + celM) - alturaEm(x, z - celM)) / (2 * celM)
  return (Math.atan(Math.hypot(hx, hz)) * 180) / Math.PI
}

// ── O ESPELHO D'ÁGUA: CADA LAGO NO NÍVEL DELE ──────────────────────────────
// ⚠️ UMA COTA SÓ PARA TODO O MAPA DEIXAVA TODO LAGO NO FUNDO DE UM BARRANCO, e
// foi o fundador quem viu: "eles parecem secos, todos estão com a água no fundo,
// porque o que enche a água de todo mapa é -40 para todos; podemos encher todos
// os lagos até a borda, aí sim teremos orla em torno deles".
//
// Ele está certo e a medição mostra o tamanho do problema. A cratera do rumo
// 282° tem fundo em -83 m e parede subindo a +150: com a lâmina em -40 sobra um
// espelho de 0,17 km² no fundo de um poço de 140 m. Isso não é lago, é poça.
//
// A correção é hidrologia de verdade, não um número novo: PRIORITY-FLOOD. Cada
// bacia fechada enche até a SOLEIRA dela — o ponto mais baixo da borda, por onde
// transbordaria. O algoritmo parte dos corpos que mandam no nível e sobe,
// atribuindo a cada célula o menor "teto" que a alcança.
//
// ⚠️ TRÊS REGRAS, E CADA UMA SAIU DE UM ERRO MEDIDO NESTA MESMA SESSÃO:
//
// (a) SEMEAR SÓ OS MARES. Semeando a borda do domínio e mais nada, o sítio
//     inteiro é uma cratera e encheu até a soleira dela: +36,0 km² de água nova
//     e a cidade afogada. Semeando TODA água em -40, cada lago ficava preso no
//     nível global e o enchimento não fazia nada. O certo é semear os CORPOS
//     GRANDES: medido, há 35 corpos em -40, dois deles com 98,5 e 24,5 km² e o
//     terceiro com 0,555. O degrau é claro, e 2 km² separa mar de lago.
//
// (b) LAGO SECO CONTINUA SECO. Toda depressão fechada aceita ser enchida, e sem
//     filtro apareceram 1.037 bacias somando 17 km² de água que não existe —
//     mil poças de montanha, que na carta lêem como sarampo. Só enche quem já
//     tem lâmina: pelo menos 2 ha de água hoje. Sobram NOVE lagos.
//
// (c) SÓ SOB A ABÓBADA. Fora dela é regolito seco, como a própria pintura da
//     água já assume.
const COTA_AGUA_SEMENTE = COTA_AGUA
const AREA_MAR = +arg('areaMar', 2)        // km², o que separa mar de lago
const AREA_LAGO = +arg('areaLago', 0.02)   // km², lâmina mínima para encher
const SECO = (() => {
  const T = N * N
  const areaCel = (celM * celM) / 1e6
  const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  // 1. os corpos d'água de hoje, para separar mar de lago
  const corpo4 = new Int32Array(T).fill(-1)
  const mares = new Set()
  const areaCorpo = []
  {
    const pilha = []
    let id = 0
    for (let k0 = 0; k0 < T; k0++) {
      if (corpo4[k0] >= 0 || H[k0] > COTA_AGUA_SEMENTE) continue
      let cel = 0
      pilha.push(k0); corpo4[k0] = id
      while (pilha.length) {
        const k = pilha.pop(); cel++
        const i = k % N, j = (k / N) | 0
        for (const [di, dj] of viz) {
          const i2 = i + di, j2 = j + dj
          if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue
          const k2 = j2 * N + i2
          if (corpo4[k2] >= 0 || H[k2] > COTA_AGUA_SEMENTE) continue
          corpo4[k2] = id; pilha.push(k2)
        }
      }
      areaCorpo.push(cel * areaCel)
      if (cel * areaCel >= AREA_MAR) mares.add(id)
      id++
    }
  }
  // 2. priority-flood a partir da borda e dos mares
  const SUP = new Float32Array(T).fill(Infinity)
  const feito = new Uint8Array(T)
  const hv = new Float64Array(T), hk = new Int32Array(T)
  let tam = 0
  const empurra = (v, k) => {
    let i = tam++; hv[i] = v; hk[i] = k
    while (i > 0) {
      const p = (i - 1) >> 1
      if (hv[p] <= hv[i]) break
      const a = hv[p]; hv[p] = hv[i]; hv[i] = a
      const b = hk[p]; hk[p] = hk[i]; hk[i] = b
      i = p
    }
  }
  const tira = () => {
    const v0 = hv[0], k0 = hk[0]
    tam--; hv[0] = hv[tam]; hk[0] = hk[tam]
    let i = 0
    for (;;) {
      const a = 2 * i + 1, b = a + 1
      let m = i
      if (a < tam && hv[a] < hv[m]) m = a
      if (b < tam && hv[b] < hv[m]) m = b
      if (m === i) break
      const t1 = hv[m]; hv[m] = hv[i]; hv[i] = t1
      const t2 = hk[m]; hk[m] = hk[i]; hk[i] = t2
      i = m
    }
    return [v0, k0]
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i
    const borda = i === 0 || j === 0 || i === N - 1 || j === N - 1
    if (!borda && !mares.has(corpo4[k])) continue
    SUP[k] = Math.max(H[k], COTA_AGUA_SEMENTE); feito[k] = 1; empurra(SUP[k], k)
  }
  while (tam) {
    const [v, k] = tira()
    const i = k % N, j = (k / N) | 0
    for (const [di, dj] of viz) {
      const i2 = i + di, j2 = j + dj
      if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue
      const k2 = j2 * N + i2
      if (feito[k2]) continue
      SUP[k2] = Math.max(H[k2], v); feito[k2] = 1; empurra(SUP[k2], k2)
    }
  }
  // 3. quem NÃO é lago de verdade volta ao nível global
  const bacia = new Int32Array(T).fill(-1)
  const relatorio = []
  {
    const pilha = []
    let id = 0
    for (let k0 = 0; k0 < T; k0++) {
      if (bacia[k0] >= 0 || SUP[k0] <= H[k0] + 0.5) continue
      const celulas = []
      let jaAgua = 0, nivel = SUP[k0], fundo = Infinity, sx = 0, sz = 0
      pilha.push(k0); bacia[k0] = id
      while (pilha.length) {
        const k = pilha.pop(); celulas.push(k)
        const i = k % N, j = (k / N) | 0
        sx += i; sz += j
        nivel = Math.max(nivel, SUP[k]); fundo = Math.min(fundo, H[k])
        if (H[k] <= COTA_AGUA_SEMENTE) jaAgua++
        for (const [di, dj] of viz) {
          const i2 = i + di, j2 = j + dj
          if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue
          const k2 = j2 * N + i2
          if (bacia[k2] >= 0 || SUP[k2] <= H[k2] + 0.5) continue
          bacia[k2] = id; pilha.push(k2)
        }
      }
      id++
      const cx4 = (sx / celulas.length / (N - 1)) * 2 * RAIO - RAIO
      const cz4 = (sz / celulas.length / (N - 1)) * 2 * RAIO - RAIO
      const r4 = Math.hypot(cx4, cz4)
      const vale = jaAgua * areaCel >= AREA_LAGO && r4 <= 9050
      if (!vale) { for (const k of celulas) SUP[k] = Math.max(H[k], COTA_AGUA_SEMENTE); continue }
      if (nivel > COTA_AGUA_SEMENTE + 0.5) {
        relatorio.push({ r: r4, g: ((Math.atan2(cx4, -cz4) * 180) / Math.PI + 360) % 360,
          antes: jaAgua * areaCel, depois: celulas.length * areaCel, nivel, fundo })
      }
    }
  }
  relatorio.sort((a, b) => b.depois - a.depois)
  if (relatorio.length) {
    console.log(`  LAGOS CHEIOS ATE A SOLEIRA: ${relatorio.length}, de `
      + `${relatorio.reduce((a, b) => a + b.antes, 0).toFixed(2)} para `
      + `${relatorio.reduce((a, b) => a + b.depois, 0).toFixed(2)} km2`)
    for (const l of relatorio.slice(0, 8)) {
      console.log(`    r ${l.r.toFixed(0).padStart(5)} rumo ${l.g.toFixed(0).padStart(3)}: `
        + `${l.antes.toFixed(2)} -> ${l.depois.toFixed(2)} km2, espelho ${l.nivel.toFixed(0)} m, `
        + `${(l.nivel - l.fundo).toFixed(0)} m de profundidade`)
    }
  }
  const out = new Float32Array(T)
  for (let k = 0; k < T; k++) out[k] = H[k] - SUP[k]     // < 0 = debaixo d'agua
  return out
})()
// a mesma grade responde desenho e decisao: nao ha como as duas divergirem
const secoEm = (x, z) => {
  const fi = ((x + RAIO) / (2 * RAIO)) * (N - 1), fj = ((z + RAIO) / (2 * RAIO)) * (N - 1)
  const i = Math.max(0, Math.min(N - 2, Math.floor(fi))), j = Math.max(0, Math.min(N - 2, Math.floor(fj)))
  const u = fi - i, v = fj - j
  return SECO[j * N + i] * (1 - u) * (1 - v) + SECO[j * N + i + 1] * u * (1 - v)
       + SECO[(j + 1) * N + i] * (1 - u) * v + SECO[(j + 1) * N + i + 1] * u * v
}
// ⚠️ O MESMO LIMIAR DO DESENHO, E A DIFERENÇA CUSTOU UM MAPA COM SARAMPO. O
// contorno da terra usa -0,5 m; esta função usava 0, e aí toda célula de uma
// depressão de um centímetro — há mais de mil delas no maciço — respondia "isto
// é água". O resultado foi uma praia e uma viela circular em volta de cada poça,
// espalhadas pelo tecido inteiro como hexágonos.
const PROF_MINIMA = 0.5
const naAgua = (x, z) => secoEm(x, z) < -PROF_MINIMA

// ── marching squares: o contorno da região {altura >= nivel} ────────────────
// ⚠️ INTERPOLA DENTRO DA CÉLULA. Sem interpolar, a curva sai em degrau de grade e
// o mapa inteiro vira serrilha, que é exatamente o defeito que a ilha teve.
// ⚠️ A GRADE É INJETADA porque o mesmo marching squares serve a duas perguntas
// diferentes: "onde está a cota X" (relevo) e "onde está a X metros da baía"
// (campo de distância, que desenha a orla). Duplicar o algoritmo para o segundo
// uso seria a forma mais fácil de os dois divergirem num conserto futuro.
function contornoEm(nivel, hFn, MM, pxFn) {
  const segs = []
  const t = (a, b) => (nivel - a) / (b - a || 1e-9)
  const px = pxFn
  const M = MM, h = hFn
  for (let j = 0; j < M - 1; j++) {
    for (let i = 0; i < M - 1; i++) {
      const a = h(i, j), b = h(i + 1, j), c = h(i + 1, j + 1), d = h(i, j + 1)
      let k = 0
      if (a >= nivel) k |= 8
      if (b >= nivel) k |= 4
      if (c >= nivel) k |= 2
      if (d >= nivel) k |= 1
      if (k === 0 || k === 15) continue
      const T = [px(i + t(a, b)), px(j)]                 // topo
      const R = [px(i + 1), px(j + t(b, c))]             // direita
      const B = [px(i + t(d, c)), px(j + 1)]             // baixo
      const L = [px(i), px(j + t(a, d))]                 // esquerda
      const p = (u, v) => segs.push([u, v])
      switch (k) {
        case 1: case 14: p(L, B); break
        case 2: case 13: p(B, R); break
        case 3: case 12: p(L, R); break
        case 4: case 11: p(T, R); break
        case 5: p(L, T); p(B, R); break
        case 6: case 9: p(T, B); break
        case 7: case 8: p(L, T); break
        case 10: p(T, R); p(L, B); break
      }
    }
  }
  return encadeia(segs)
}
const contorno = (nivel) => contornoEm(nivel, h, M, px)
// ⚠️ A TERRA NÃO É MAIS {altura >= -40}, É {SECO >= 0}. Com lago em cota própria
// não existe UMA cota que separe terra de água no mapa inteiro: o mesmo -40 que
// é margem na baía já é fundo de poço na cratera do rumo 282. A grade de
// profundidade responde as duas perguntas de uma vez, e desenho e decisão saem
// dela, então não há como divergirem. O nível -0,5 em vez de 0 é para não pedir
// contorno de um platô exatamente zero, que é degenerado no marching squares.
const hSeco = (i, j) => (i === 0 || j === 0 || i === M - 1 || j === M - 1)
  ? -1e6 : SECO[(j - 1) * N + (i - 1)]
const contornoTerra = (abaixo = 0.5) => contornoEm(-abaixo, hSeco, M, px)

// ⚠️ ENCADEAR É O QUE FAZ VIRAR CURVA E NÃO CONFETE. Sem isto o SVG teria um
// `path` de duas pontas por célula, dezenas de milhares deles, e nem o traço
// contínuo nem o preenchimento funcionariam.
function encadeia(segs) {
  const chave = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`
  const mapa = new Map()
  for (const [a, b] of segs) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const k = chave(x)
      if (!mapa.has(k)) mapa.set(k, [])
      mapa.get(k).push(y)
    }
  }
  const vistos = new Set(), linhas = []
  for (const [a, b] of segs) {
    const k0 = chave(a) + '|' + chave(b)
    const k1 = chave(b) + '|' + chave(a)
    if (vistos.has(k0)) continue
    vistos.add(k0); vistos.add(k1)
    const linha = [a, b]
    // cresce para a frente e depois para trás
    for (const frente of [true, false]) {
      for (;;) {
        const ponta = frente ? linha[linha.length - 1] : linha[0]
        const ant = frente ? linha[linha.length - 2] : linha[1]
        const viz = mapa.get(chave(ponta)) || []
        const prox = viz.find((v) => {
          const ka = chave(ponta) + '|' + chave(v)
          return !vistos.has(ka) && chave(v) !== chave(ant)
        })
        if (!prox) break
        vistos.add(chave(ponta) + '|' + chave(prox))
        vistos.add(chave(prox) + '|' + chave(ponta))
        if (frente) linha.push(prox); else linha.unshift(prox)
        if (chave(prox) === chave(linha[0]) && frente) break
      }
    }
    if (linha.length > 2) linhas.push(linha)
  }
  return linhas
}

const d = (linhas, fechar) => linhas.map((l) =>
  'M' + l.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + (fechar ? 'Z' : '')).join('')

// ── a paleta: linguagem escura de mapa de lote, a do resto do produto ───────
// Terra do fundo do vale ao cume, escura para clara. Sem verde (reservado a
// estado no produto) e sem roxo (banido por colidir com o azul).
const TERRA = ['#171410', '#221D17', '#2D261D', '#393024', '#463A2C', '#544634',
               '#63523D', '#725F47', '#816C52', '#90795D', '#9F8769', '#AE9576',
               '#BDA384', '#CBB294', '#D8C2A6', '#E4D2B9']
const AGUA_FUNDO = '#0B2430', AGUA_RASO = '#1C4E63'
const CURVA = '#8A7A63', CURVA_MESTRA = '#C9B48F'
const FUNDO = '#0A0A0B'

const min = Math.floor(meta.min / PASSO) * PASSO
const max = Math.ceil(meta.max / PASSO) * PASSO
const niveis = []
for (let v = min; v <= max; v += PASSO) niveis.push(v)

let corpo = ''
// 1. bandas de terra, empilhadas de baixo para cima. TODAS as cotas, inclusive as
//    abaixo da lâmina: fora da cúpula não existe água, existe regolito seco, e a
//    primeira geração pintou o mapa inteiro de azul por ter esquecido disso.
const bandas = niveis
bandas.forEach((v, k) => {
  const cor = TERRA[Math.min(TERRA.length - 1, Math.floor((k / bandas.length) * TERRA.length))]
  const ls = contorno(v)
  if (ls.length) corpo += `<path d="${d(ls, true)}" fill="${cor}" fill-rule="evenodd"/>\n`
})
// 2. a água, RECORTADA PELA CASCA e desenhada como DISCO MENOS TERRA.
// ⚠️ DUAS ARMADILHAS AQUI, as duas pagas na primeira geração.
// (a) Água só existe dentro da abóbada, e é assim que a cena faz
//     (`buildLagos({ raio: DOME_R })`). Fora da casca, terreno abaixo da cota da
//     lâmina é planície de regolito seco, não mar. Sem o recorte o mapa saiu com
//     a Lua inteira submersa.
// (b) `contorno(cota)` delimita a região ACIMA da cota, então pintar esse
//     contorno pinta a TERRA, não a água. Na primeira geração a água cobriu 70%
//     do disco quando o dado diz 23%. A forma certa é DISCO MENOS TERRA: um
//     `path` único que carrega o círculo da casca E os laços de {h >= cota}, com
//     `fill-rule: evenodd`, que subtrai um do outro sozinho.
const rDomePx = mundoPx(9050) - mundoPx(0)
const cx = LADO / 2, cy = LADO / 2
const disco = `M${cx - rDomePx} ${cy}a${rDomePx} ${rDomePx} 0 1 0 ${2 * rDomePx} 0a${rDomePx} ${rDomePx} 0 1 0 ${-2 * rDomePx} 0Z`
// ⚠️ (c) E O RECORTE PELA CASCA É OBRIGATÓRIO MESMO USANDO O DISCO NO PATH.
// `evenodd` conta cruzamento no plano INTEIRO, não dentro do disco: uma região
// fora do disco que caia dentro de um laço de terra soma um cruzamento e é
// pintada. Na geração sem recorte o mapa saiu com todo o terreno ALTO de fora da
// cúpula pintado de azul.
corpo += `<clipPath id="casca"><circle cx="${cx}" cy="${cy}" r="${rDomePx.toFixed(1)}"/></clipPath>\n`
corpo += '<g clip-path="url(#casca)">\n'
for (const [fundo, cor, op] of [[0.5, AGUA_RASO, 1], [30, AGUA_FUNDO, 0.92]]) {
  corpo += `<path d="${disco}${d(contornoTerra(fundo), true)}" fill="${cor}" fill-rule="evenodd" opacity="${op}"/>\n`
}
corpo += `<path d="${d(contornoTerra(), false)}" fill="none" stroke="#7FB9D4" stroke-width="1.6" opacity="0.75"/>\n`
corpo += '</g>\n'

// ⚠️ OS TRÊS CANAIS RADIAIS SÃO VETOR, NÃO AMOSTRA, e a razão é de resolução.
// O leito deles é um V estreito: medido em 02/09 chamando a cena ponto a ponto,
// o fundo chega a -43,6 m no eixo e já está em -42 a seis metros dele. Com célula
// de 40 m a amostragem cai na encosta em vez do fundo, e a carta desenhou o CR03
// com 160 m de fluxo INTERROMPIDO num canal que está perfeito. Foi o fundador
// quem viu a quebra, e a quebra era minha.
//
// Aumentar resolução não resolve de forma robusta, porque o fundo é quase uma
// linha. O certo é desenhar a hidrografia a partir da GEOMETRIA PUBLICADA, que é
// exata, como toda carta faz com rio e estrada. Vem de
// `public/city/cidade-malha.json` -> `canais.radiais`.
const malha = JSON.parse(readFileSync(arg('malha', '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/public/city/cidade-malha.json'), 'utf8'))
let hidro = ''
for (const r of (malha.canais?.radiais ?? [])) {
  const a = (r.rumo * Math.PI) / 180
  const p0 = [mundoPx(Math.sin(a) * r.rInicio), mundoPx(-Math.cos(a) * r.rInicio)]
  const p1 = [mundoPx(Math.sin(a) * (r.rFim ?? 5000)), mundoPx(-Math.cos(a) * (r.rFim ?? 5000))]
  const larg = ((r.lamina ?? r.secao ?? 60) / (2 * RAIO)) * LADO
  hidro += `<line x1="${p0[0].toFixed(1)}" y1="${p0[1].toFixed(1)}" x2="${p1[0].toFixed(1)}" y2="${p1[1].toFixed(1)}" `
    + `stroke="${AGUA_RASO}" stroke-width="${Math.max(2.5, larg).toFixed(1)}" stroke-linecap="round"/>\n`
}
corpo += `<g clip-path="url(#casca)">${hidro}</g>\n`

// ⚠️ LÁPIDE: O LAGO DA PRAÇA NÃO TEM MAIS LÂMINA PRÓPRIA. Havia aqui um caso
// especial que desenhava tudo abaixo de −6,5 m dentro de r 1.480 como água,
// escrito em 02/09 quando o lago central tinha sido subido para essa cota.
//
// A CENA MUDOU E O CASO ESPECIAL FICOU. Medido no perfil de hoje, em 11/09: a
// praça é um disco SECO em cota −35 até r ≈ 1.100, o canal anelar vai de 1.100 a
// 1.410 com fundo em −48, e `terrain.ts` diz literalmente `LAGO_AGUA_Y = -40`,
// "a cota de toda a água da cidade". Com o corte em −6,5 o mapa pintava a praça
// inteira de azul e o canal sumia dentro do disco: era por isso que o círculo de
// vias do centro parecia solto, boiando na água.
//
// Com a lâmina única, o campo de profundidade deste arquivo já resolve: água é
// onde a bacia está abaixo de −40, e ali isso é exatamente o anel do canal.

// ── A ORLA DA BAÍA, COMO OBRA ──────────────────────────────────────────────
// ⚠️ A BAÍA TINHA MARGEM, NÃO TINHA ORLA. Litoral sem praia contínua, sem via de
// contorno e sem quarteirão: a carta mostrava a água encostando no nada. A
// decisão do fundador é tratá-la como a alça já é — obra, não acidente de
// relevo: "se preciso mova terreno, terraplane, mas deixe a orla inteira
// habitável, com infraestrutura de ruas ligada à malha completa".
//
// ⚠️ E A GEOMETRIA SAI DE UM CAMPO DE DISTÂNCIA, NÃO DE UM CÍRCULO. A alça pôde
// ser dois círculos fixos porque a faixa dela é quase um anel perfeito. A margem
// da baía não é: ela varia de r 3.536 a 6.264, e a versão anterior desenhou a
// orla como setor de coroa entre 4.800 e 5.700, o que a deixava por cima da água
// num trecho e longe dela em outro. Aqui cada faixa é uma ISOLINHA do campo de
// distância até a lâmina, então praia, via e quarteirão acompanham a costa sozinhos,
// por mais irregular que ela seja.
//
//     0 a  80 m da água   praia (terraplanada, como a da alça)
//    80 a 120 m           recuo da via
//   120 a 160 m           BOULEVARD DA ORLA, 40 m
//   160 a 660 m           quarteirão nobre, os 500 m dos tiers 4 e 5
const ORLA = arg('orla', '0') !== '0'
let orlaDist = null, orlaNG = 0, orlaCEL = 0
if (ORLA || arg('vias', '0') !== '0') {
  // 1. qual água é a BAÍA: flood fill a partir do ponto que o gerador publica,
  //    e não "o maior corpo" — a mesma armadilha que `lagos.ts` documenta.
  orlaCEL = +arg('celOrla', 40)
  orlaNG = Math.ceil((2 * RAIO) / orlaCEL)
  const agua = new Uint8Array(orlaNG * orlaNG)
  for (let j = 0; j < orlaNG; j++) {
    for (let i = 0; i < orlaNG; i++) {
      const x = -RAIO + (i + 0.5) * orlaCEL, z = -RAIO + (j + 0.5) * orlaCEL
      // ⚠️ O CANAL DA PRAÇA NÃO ENTRA NA CONTA DA ORLA. Tirar só o MIOLO (pondo
      // distância infinita dentro de r 1.480 depois do chamfer) não bastava: as
      // células logo FORA do disco continuavam medindo 90 m até a lâmina do
      // canal, caíam na faixa nobre e a carta pintava tier 4 e 5 em volta do
      // Satoshi Plaza — que é núcleo cívico, e cuja frente d'água está decidida
      // na baía (§3.3). A água do centro sai do grid ANTES do chamfer.
      const rc = Math.hypot(x, z)
      if (rc <= 9050 && rc > 1480 && naAgua(x, z)) agua[j * orlaNG + i] = 1
    }
  }
  // ⚠️ O FLOOD FILL NÃO PASSA PELOS CANAIS, e sem isso ele engole a cidade. Os
  // três canais radiais ligam a baía ao Lago da Praça, então hidrograficamente
  // tudo é um corpo só — e a primeira versão, correta como hidrografia, pintou
  // faixa de orla em volta da Satoshi Plaza e ao longo dos canais, a 6 km da
  // baía. Orla é da BAÍA; canal tem margem, não litoral. Fechar a passagem é o
  // que separa os dois, e usa a mesma lista publicada que decide ponte.
  const bloqueio = new Uint8Array(orlaNG * orlaNG)
  for (const c of (malha.canais?.radiais ?? [])) {
    const a0 = (c.rumo * Math.PI) / 180
    const ux = Math.sin(a0), uz = -Math.cos(a0)
    const meia = (c.lamina ?? 60) / 2 + (malha.canais?.talude ?? 40) + orlaCEL
    for (let j = 0; j < orlaNG; j++) for (let i = 0; i < orlaNG; i++) {
      const x = -RAIO + (i + 0.5) * orlaCEL, z = -RAIO + (j + 0.5) * orlaCEL
      const t = x * ux + z * uz
      if (t < (c.rInicio ?? 0) || t > (c.rFim ?? 9050)) continue
      if (Math.abs(x * uz - z * ux) <= meia) bloqueio[j * orlaNG + i] = 1
    }
  }
  // ⚠️ A ORLA É DE TODA A ÁGUA DA CIDADE, NÃO SÓ DA BAÍA. Medindo apenas a margem
  // da baía eu reportei 3,54 km de frente e concluí que nem os tiers 4 e 5
  // caberiam (1,7 m de testada cada). Medida a água inteira dentro da cidade, a
  // frente aproveitável é 50,16 km:
  //     baía    14,85 km
  //     lagos   21,84 km   ← os 17 corpos, que eu vinha ignorando
  //     canais  13,47 km
  // Com isso os 2.062 dos tiers 4 e 5 ficam com 24,3 m de testada cada, que é
  // lote urbano de frente para a água. A conclusão anterior estava errada porque
  // a pergunta estava: "cabe na baía" não é "cabe na cidade".
  const baia = new Uint8Array(orlaNG * orlaNG)
  for (let c = 0; c < agua.length; c++) if (agua[c]) baia[c] = 1
  // 2. distância até a baía, chamfer em duas passadas
  const INF = 1e9
  orlaDist = new Float64Array(orlaNG * orlaNG).fill(INF)
  for (let c = 0; c < baia.length; c++) if (baia[c]) orlaDist[c] = 0
  const d1 = orlaCEL, d2 = orlaCEL * 1.41421356
  for (let j = 0; j < orlaNG; j++) for (let i = 0; i < orlaNG; i++) {
    const c = j * orlaNG + i; if (!orlaDist[c]) continue
    let b = orlaDist[c]
    for (const [di, dj, w] of [[-1, 0, d1], [1, 0, d1], [0, -1, d1], [-1, -1, d2], [1, -1, d2]]) {
      const ni = i + di, nj = j + dj
      if (ni >= 0 && nj >= 0 && ni < orlaNG && nj < orlaNG) b = Math.min(b, orlaDist[nj * orlaNG + ni] + w)
    }
    orlaDist[c] = b
  }
  for (let j = orlaNG - 1; j >= 0; j--) for (let i = orlaNG - 1; i >= 0; i--) {
    const c = j * orlaNG + i; if (!orlaDist[c]) continue
    let b = orlaDist[c]
    for (const [di, dj, w] of [[1, 0, d1], [-1, 0, d1], [0, 1, d1], [1, 1, d2], [-1, 1, d2]]) {
      const ni = i + di, nj = j + dj
      if (ni >= 0 && nj >= 0 && ni < orlaNG && nj < orlaNG) b = Math.min(b, orlaDist[nj * orlaNG + ni] + w)
    }
    orlaDist[c] = b
  }
}
// ⚠️ A ALÇA NÃO É ORLA DA BAÍA, é a alça. Ela margeia a baía pelo lado de fora,
// então caía inteira dentro da faixa de 660 m e o laranja de "bay shore" cobria
// o desenho próprio dela — duas obras diferentes com a mesma tinta. Marcando as
// células da alça como infinitamente distantes, ela sai de todas as faixas e
// volta a ser o que é: praia, mansões de frente, AN7, mansões de trás, praia.
if (orlaDist) {
  for (let j = 0; j < orlaNG; j++) for (let i = 0; i < orlaNG; i++) {
    const x = -RAIO + (i + 0.5) * orlaCEL, z = -RAIO + (j + 0.5) * orlaCEL
    const r = Math.hypot(x, z), g = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
    // ⚠️ E A PRAÇA CENTRAL TAMBÉM SAI. O Lago da Praça é água da cidade, então
    // entrou na conta de "toda a água" e a faixa de orla nobre foi desenhada em
    // volta dele: tier de holder pintado DENTRO do Satoshi Plaza, que é núcleo
    // cívico e não tem lote nenhum. O lago é paisagem do centro, não frente de
    // lote. O raio vem do próprio `discoLago` usado na hidrografia.
    if (r <= 1480) orlaDist[j * orlaNG + i] = 1e9
    if (r >= 6400 && (g >= 346 || g <= 116.5)) orlaDist[j * orlaNG + i] = 1e9
  }
}
const distBaia = (x, z) => {
  if (!orlaDist) return Infinity
  const i = Math.floor((x + RAIO) / orlaCEL), j = Math.floor((z + RAIO) / orlaCEL)
  if (i < 0 || j < 0 || i >= orlaNG || j >= orlaNG) return Infinity
  return orlaDist[j * orlaNG + i]
}
const ORLA_PRAIA = +arg('orlaPraia', 80)
const ORLA_VIA_R = +arg('orlaViaDist', 140)      // eixo do boulevard, em distância da água
const ORLA_VIA_W = +arg('orlaViaLarg', 40)
// ⚠️ UMA QUADRA, NÃO MEIO QUILÔMETRO. A faixa nobre tinha 500 m de profundidade,
// e o fundador viu o efeito: "tem carteira ali que vai morar a 3 quadras da
// praia". Frente de água que não se vê da janela não é frente de água. Com 50,16
// km de margem aproveitável, os 2.062 dos tiers 4 e 5 cabem numa fileira só de
// 100 m de fundo — que é exatamente o que uma quadra tem.
const ORLA_FUNDO = +arg('orlaFundo', 265)

// ── A PALETA DOS TIERS, FONTE ÚNICA ────────────────────────────────────────
// ⚠️ COR DE TIER MORA AQUI E EM MAIS LUGAR NENHUM. Ela aparece em três sítios —
// a mancha no terreno, o painel "WHO LIVES WHERE" e a legenda de símbolos — e
// escrita três vezes divergiria no primeiro ajuste, com o painel dizendo uma cor
// e o mapa pintando outra.
//
// ⚠️ TRÊS FAMÍLIAS, UMA POR TIPO DE LUGAR, e não oito cores soltas. A alça é
// laranja, a frente d'água é bronze, o tecido é neutro. Assim o leitor lê a
// hierarquia antes de ler o nome: a cor diz QUE TIPO de endereço é, a posição na
// família diz qual degrau. Oito matizes sem parentesco viram mapa político.
//
// A posição de cada um está fechada em `tiersposition.md` §2 e §3.1 a §3.5.
// ⚠️ ESTA PALETA É PARA SER LIDA POR UM HOLDER, NÃO POR UM URBANISTA. Decisão do
// fundador, 11/09: "esse é o mapa que vamos postar hoje, pré snapshot; os
// holders têm que olhar e entender". Legibilidade virou requisito, e isso mudou
// dois critérios:
//
// (a) UMA ESCADA SÓ, do privilégio ao comum, em vez de três famílias paralelas.
//     As famílias diziam QUE TIPO de endereço era, o que é correto de projeto e
//     inútil para quem procura o próprio nome: dois laranjas vizinhos obrigavam
//     a conferir o painel. Agora os oito degraus mudam de MATIZ e de VALOR ao
//     mesmo tempo — ouro, âmbar, laranja, queimado, tijolo, pedra, cinza, ardósia
//     —, e a quebra entre o 5 e o 6 (quente para neutro) é a quebra real da
//     cidade: acaba a frente d'água, começa o tecido.
//
// (b) OPACIDADE ALTA, que só é possível porque as CURVAS DE NÍVEL SÃO DESENHADAS
//     POR CIMA (ver a nota "uso do solo vem por baixo das curvas"). O relevo não
//     se perde: ele volta pela linha, não pela tinta. Com 0,40 a mancha sumia
//     dentro da banda hipsométrica e o mapa de tier virava mapa de relevo.
//
// Nada de verde nem de roxo: verde é reservado a status no produto e roxo está
// banido da casa.
const TIER_COR = {
  t1: '#FFCE7A',   // Satoshi Visionary  — ouro claro
  t2: '#F79B34',   // BTC Maximalist     — âmbar
  t3: '#DE6A18',   // Rune Master        — laranja
  t4: '#B4501C',   // Ordinal Believer   — queimado
  t5: '#87452A',   // DOG Supporter      — tijolo
  t6: '#9C8F79',   // Diamond Paws       — pedra
  g20: '#6A6E72',  // o Grupo, >= 20k DOG — cinza frio
  g00: '#414750',  // todo o resto        — ardósia
}
// a opacidade com que cada mancha vai ao terreno; o painel usa as mesmas
const TIER_OP = { t1: 0.86, t2: 0.86, t3: 0.86, t4: 0.8, t5: 0.78, t6: 0.66, g20: 0.68, g00: 0.7 }

// ── OS BAIRROS (--bairros=1) ────────────────────────────────────────────────
// ⚠️ USO DO SOLO VEM POR BAIXO DAS CURVAS, nunca por cima: numa carta a
// altimetria é o esqueleto e a mancha urbana é a pele. Invertendo, as curvas
// somem e a peça vira infográfico.
//
// ⚠️ E A MANCHA É VETOR, NÃO PIXEL. A primeira versão varria a tela amostrando
// ponto a ponto e emitia um quadradinho por amostra: saiu serrilhada e o SVG
// passou de 7 MB. O certo é o que carta faz há um século: a zona é uma COROA
// CIRCULAR, e o recorte contra a costa sai de um `clipPath` com o contorno da
// lâmina, que já está calculado aqui para desenhar a água. Uma fonte, dois usos.
//
// ⚠️ E O CLIP DE TERRA JÁ INCLUI A ALÇA, porque a grade vem da CENA e não do
// relevo natural: lá a alça é plataforma em −30, acima da lâmina de −40. No
// heightmap cru ela é água, e foi assim que ela sumiu do primeiro mapa.
const BAIRROS = arg('bairros', '0') !== '0'
if (BAIRROS) {
  const R_T6 = +arg('rT6', 3300), R_G20 = +arg('rG20', 5300), R_PER = +arg('rPer', 6900)
  // ⚠️ O TECIDO COMEÇA NO ANEL DA PRAÇA, NÃO EM 960. Com 960 a mancha do tier 6
  // era pintada POR CIMA do canal anelar (que vai de r 1.100 a 1.410) e do disco
  // da praça: um anel de água inteiro pintado como bairro de holder, que é o
  // mesmo erro do setor de coroa da orla que já morreu neste arquivo.
  const R_PRACA = +arg('rPraca', 1460)
  const A_BAIA = 6580, A_MAR = 7316, PRAIA_W = 80, VIA_R = 6950, VIA_W = 44
  const rp = (m) => mundoPx(m) - mundoPx(0)
  const cxx = LADO / 2, cyy = LADO / 2
  // coroa circular completa, como path com dois arcos
  const coroa = (r0, r1) => {
    const a = rp(r1), b = rp(r0)
    return `M${cxx - a} ${cyy}a${a} ${a} 0 1 0 ${2 * a} 0a${a} ${a} 0 1 0 ${-2 * a} 0Z`
         + `M${cxx - b} ${cyy}a${b} ${b} 0 1 1 ${2 * b} 0a${b} ${b} 0 1 1 ${-2 * b} 0Z`
  }
  // setor de coroa, para a alça (arco 346° a 116,5°)
  const setor = (r0, r1, g0, g1) => {
    const pt = (r, g) => {
      const a = (g * Math.PI) / 180
      return `${mundoPx(Math.sin(a) * r).toFixed(1)} ${mundoPx(-Math.cos(a) * r).toFixed(1)}`
    }
    const arco = (r, ga, gb, passo) => {
      let out = ''
      const n = Math.ceil(Math.abs(gb - ga) / passo)
      for (let k = 0; k <= n; k++) out += (k ? 'L' : '') + pt(r, ga + ((gb - ga) * k) / n)
      return out
    }
    const g1x = g1 < g0 ? g1 + 360 : g1
    return `M${arco(r0, g0, g1x, 0.5)}L${arco(r1, g1x, g0, 0.5)}Z`
  }
  corpo += `<pattern id="hach" width="${14 * F}" height="${14 * F}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<line x1="0" y1="0" x2="0" y2="${14 * F}" stroke="#6E9AB4" stroke-width="${2.2 * F}" opacity="0.55"/></pattern>\n`
  corpo += `<clipPath id="terra" clipPathUnits="userSpaceOnUse">`
    + `<path d="${d(contornoTerra(), true)}" clip-rule="evenodd"/></clipPath>\n`
  const zona = (dd, cor, op) => `<path d="${dd}" fill="${cor}" fill-rule="evenodd" opacity="${op}"/>`
  let manchas = ''
  // ⚠️ O NÚCLEO CÍVICO É LUGAR, NÃO VAZIO. A praça é chão construído em cota −35,
  // e a banda hipsométrica mais baixa a pintava quase preta: no meio da carta
  // ficava um buraco, que é a última leitura que se quer no centro da cidade.
  // Ela não ganha cor de tier porque não tem lote nenhum — é núcleo cívico.
  const R_PRACA_CHAO = +arg('rPracaChao', 1024)
  manchas += zona(coroa(60, R_PRACA_CHAO), '#A79C89', 0.55)         // a praça, chão cívico
  manchas += zona(coroa(R_PRACA, R_T6), TIER_COR.t6, TIER_OP.t6)    // tier 6, Diamond Paws
  manchas += zona(coroa(R_T6, R_G20), TIER_COR.g20, TIER_OP.g20)    // Grupo >= 20k
  manchas += zona(coroa(R_G20, R_PER), TIER_COR.g00, TIER_OP.g00)   // periferia < 20k
  // ⚠️ A TERRA DO PROJETO VAI EM HACHURA, NÃO EM CHAPADO. Pintada de azul ela
  // era lida como água: numa carta, área azul contínua é lâmina, e o olho não
  // negocia isso. Hachura diagonal é a convenção de "reservado" desde sempre.
  manchas += zona(coroa(R_PER, 9050), 'url(#hach)', 0.9)
  // a alça: praia, mansões de frente, via, mansões de trás, praia
  manchas += zona(setor(A_BAIA, A_BAIA + PRAIA_W, 346, 116.5), '#A69B80', 0.62)
  // ⚠️ A FILEIRA DA FRENTE TEM DOIS DONOS, E ELES NÃO SE MISTURAM. `tiersposition`
  // §3.1 e §3.2 fecharam: Satoshi Visionary ocupa o CENTRO do arco, de 23,2° a
  // 77,7°, que é o trecho de frente para a cidade; BTC Maximalist fica nos dois
  // flancos. Pintar a fileira inteira de uma cor só apagava a única decisão de
  // posição que já está travada com data.
  const G_T1_A = 23.2, G_T1_B = 77.7
  manchas += zona(setor(A_BAIA + PRAIA_W, VIA_R - VIA_W / 2, 346, G_T1_A), TIER_COR.t2, TIER_OP.t2)
  manchas += zona(setor(A_BAIA + PRAIA_W, VIA_R - VIA_W / 2, G_T1_B, 116.5), TIER_COR.t2, TIER_OP.t2)
  manchas += zona(setor(A_BAIA + PRAIA_W, VIA_R - VIA_W / 2, G_T1_A, G_T1_B), TIER_COR.t1, TIER_OP.t1)
  manchas += zona(setor(VIA_R + VIA_W / 2, A_MAR - PRAIA_W, 346, 116.5), TIER_COR.t3, TIER_OP.t3)
  manchas += zona(setor(A_MAR - PRAIA_W, A_MAR, 346, 116.5), '#A69B80', 0.62)
  // ⚠️ O SETOR DE COROA DA ORLA MORREU AQUI. Ele pintava os tiers 4 e 5 entre
  // r 4.800 e 5.700 no arco 358,5°-99,5°, o que ficava por cima da água num
  // trecho e longe dela em outro, e ainda cobria só um pedaço do litoral. A orla
  // agora é desenhada por distância até a lâmina, logo abaixo, e cobre a baía
  // inteira.
  // ── A ORLA DA BAÍA, EM FAIXAS ─────────────────────────────────────────────
  // ⚠️ EMPILHADAS DA MAIS LARGA PARA A MAIS ESTREITA, a mesma técnica das bandas
  // hipsométricas deste arquivo: cada faixa cobre o miolo da anterior e sobra um
  // anel. Assim nenhuma precisa ser calculada como polígono com furo, que é onde
  // este tipo de código costuma quebrar.
  if (orlaDist) {
    const hDist = (i, j) => {
      // ⚠️ A MOLDURA É BAIXA, E EU FIZ AO CONTRÁRIO NA PRIMEIRA VERSÃO. O
      // cabeçalho de `FUNDO_MOLDURA` neste mesmo arquivo já avisava: marching
      // squares só fecha laço quando a região {valor >= nível} NÃO toca a borda
      // do domínio, e emoldurar com valor ALTO faz ela tocar sempre. Os
      // contornos saíam abertos, o `Z` os fechava com uma corda reta, e a carta
      // ganhou cunhas gigantes atravessando a cidade inteira — o mesmo defeito
      // que a primeira geração do mapa teve e que a nota de lá documenta.
      // Com moldura em −1 toda faixa de distância fecha sozinha.
      if (i <= 0 || j <= 0 || i >= orlaNG + 1 || j >= orlaNG + 1) return -1
      return orlaDist[(j - 1) * orlaNG + (i - 1)]
    }
    const pxDist = (i) => ((i - 1) / (orlaNG - 1)) * LADO
    // contornoEm devolve {dist >= nivel}; a faixa é o complemento, então as
    // bandas vêm de fora para dentro e a última a pintar é a praia
    const faixa = (ate, cor, op) => {
      const ls = contornoEm(ate, hDist, orlaNG + 2, pxDist)
      if (!ls.length) return ''
      const disco = `M0 0H${LADO}V${LADO}H0Z`
      return `<path d="${disco}${d(ls, true)}" fill="${cor}" fill-rule="evenodd" opacity="${op}"/>`
    }
    // ⚠️ TODO MUNDO DE FRENTE PARA A ÁGUA, e não um tier atrás do outro. A versão
    // anterior empilhava as classes por PROFUNDIDADE: a primeira fileira tinha a
    // praia e a segunda olhava por cima. O fundador cortou: "aqueles dois tiers
    // ali podem ganhar orla, não só o mais claro". Numa orla curta, dividir em
    // fileiras é dar água a um e vista a outro. Dividir AO LONGO da costa dá
    // frente de água a todos, e é o que a faixa comporta.
    //
    // ⚠️ E OS TRECHOS SE ALTERNAM, não ficam em blocos contíguos. Cada grupo em um
    // arco só concentraria tudo num setor, que é o defeito que o fundador viu
    // ("é visível que elas foram concentradas numa área pequena da orla").
    let orla = ''
    // ⚠️ A FRENTE D'ÁGUA TAMBÉM TEM DOIS DONOS. `tiersposition` §3.3: Ordinal
    // Believer fica DE FRENTE para a água e DOG Supporter na segunda faixa,
    // atrás dele. A via de orla é a divisa natural entre os dois — quem está
    // entre a via e a lâmina tem frente d'água, quem está atrás tem vista. Uma
    // faixa só, de uma cor só, não dizia qual dos dois tiers estava onde.
    orla += faixa(ORLA_FUNDO, TIER_COR.t5, TIER_OP.t5)                    // tier 5, atrás da via
    orla += faixa(ORLA_VIA_R + ORLA_VIA_W / 2, '#8C8578', 0.55)           // calçada e recuo
    orla += faixa(ORLA_VIA_R - ORLA_VIA_W / 2, TIER_COR.t4, TIER_OP.t4)   // tier 4, na lâmina
    orla += faixa(ORLA_PRAIA, '#A69B80', 0.72)                    // praia contínua
    // os trechos claros: alternados ao longo da costa, sobre a mesma faixa
    {
      const sem = (n) => { const v = Math.sin(n * 91.7 + 47.3) * 43758.5453; return v - Math.floor(v) }
      let tr = ''
      for (let k = 0; k < 40; k += 2) {
        const g0 = (k / 40) * 360 + 2 * sem(k), g1 = ((k + 1) / 40) * 360 + 2 * sem(k + 1)
        const pt = (r, g) => { const a2 = (g * Math.PI) / 180
          return `${mundoPx(Math.sin(a2) * r).toFixed(1)} ${mundoPx(-Math.cos(a2) * r).toFixed(1)}` }
        let dd = 'M'
        for (let g = g0; g <= g1; g += 0.5) dd += pt(9050, g) + 'L'
        for (let g = g1; g >= g0; g -= 0.5) dd += pt(900, g) + 'L'
        tr += `<path d="${dd.slice(0, -1)}Z" fill="#D89A48" opacity="0.5"/>`
      }
      orla += `<g clip-path="url(#orlaNobre)">${tr}</g>`
    }
    // ⚠️ AS PARCELAS DO PROJETO VÃO ESPALHADAS, NÃO EM BLOCO. Decisão do fundador:
    // concentradas num trecho só elas monopolizariam um setor da orla; espalhadas,
    // costuram a frente de água inteira e nenhum pedaço fica sem equipamento por
    // perto. O passo é IRREGULAR de propósito — parcela igualmente espaçada ao
    // longo de 69,6 km de costa leria como cerca, não como cidade.
    const ang0 = Math.atan2(4863.8, 3738.4)
    const semente = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
    let parcelas = ''
    for (let k = 0; k < 34; k++) {
      const t = (k + 0.35 * semente(k) + 0.2 * semente(k * 7)) / 34
      const g = t * 360
      const larg = 2.2 + 2.8 * semente(k * 13)
      // ⚠️ PARCELA É ANEL CURTO, NÃO CUNHA. A primeira versão traçava um setor do
      // CENTRO da baía até 9 km, e o clip deveria recortá-lo na faixa da orla:
      // com o clip quebrado pela moldura, sobraram raios azuis rasgando a cidade
      // inteira. Traçando o anel entre dois raios próximos, a parcela já nasce do
      // tamanho certo e não depende do clip para existir.
      const rc = 5600, esp = 900
      let dd = 'M'
      for (let gg = g - larg / 2; gg <= g + larg / 2; gg += 0.25) {
        const a2 = (gg * Math.PI) / 180
        dd += `${mundoPx(Math.sin(a2) * (rc + esp / 2)).toFixed(1)} ${mundoPx(-Math.cos(a2) * (rc + esp / 2)).toFixed(1)}L`
      }
      for (let gg = g + larg / 2; gg >= g - larg / 2; gg -= 0.25) {
        const a2 = (gg * Math.PI) / 180
        dd += `${mundoPx(Math.sin(a2) * (rc - esp / 2)).toFixed(1)} ${mundoPx(-Math.cos(a2) * (rc - esp / 2)).toFixed(1)}L`
      }
      parcelas += `<path d="${dd.slice(0, -1)}Z" fill="#4E7A93" opacity="0.55"/>`
    }
    orla += `<g clip-path="url(#orlaNobre)">${parcelas}</g>`
    corpo += `<clipPath id="orlaNobre" clipPathUnits="userSpaceOnUse">`
      + `<path d="M0 0H${LADO}V${LADO}H0Z${d(contornoEm(ORLA_FUNDO, hDist, orlaNG + 2, pxDist), true)}" clip-rule="evenodd"/>`
      + `</clipPath>\n`
    // guardado para pintar DEPOIS das manchas: ver a nota logo abaixo
    var orlaPronta = orla
  }
  corpo += `<g clip-path="url(#terra)">${manchas}</g>\n`
  // ⚠️ A ORLA VAI POR CIMA DOS ANÉIS DE BAIRRO, e a ordem invertida foi o motivo
  // de ela quase não aparecer na carta: pintada antes, os anéis do tecido, do
  // Grupo e da periferia passavam por cima e só sobrava o naco que calhava de
  // cair fora deles. A faixa junto à água tem precedência sobre o anel que a
  // atravessa, porque é ela que define o endereço ali.
  if (typeof orlaPronta === 'string') corpo += `<g clip-path="url(#terra)">${orlaPronta}</g>\n`
}

// 3. as curvas finas, e depois as mestras por cima
let finas = '', mestras = ''
for (const v of niveis) {
  const ls = contorno(v)
  if (!ls.length) continue
  if (v % MESTRA === 0) mestras += d(ls, false)
  else finas += d(ls, false)
}
corpo += `<path d="${finas}" fill="none" stroke="${CURVA}" stroke-width="1" opacity="0.30"/>\n`
corpo += `<path d="${mestras}" fill="none" stroke="${CURVA_MESTRA}" stroke-width="2" opacity="0.60"/>\n`

// ── A MALHA VIÁRIA (--vias=1) ───────────────────────────────────────────────
// ⚠️ ELA É GERADA AQUI, NÃO LIDA DE `cidade-malha.json`. Três rodadas tentaram
// desenhar a malha publicada e as três produziram a mesma carta confusa, porque
// o defeito não era o traço, era o dado. Medido nos 9 bulevares do JSON: o
// espaçamento entre rumos vizinhos vai de 5,625° a 73,125°, e BUL05 (180°) corre
// a 5,6° de BUL06 (185,625°) por sete quilômetros e meio — as "duas vias uma do
// lado da outra" que o fundador viu. Pior: os anéis viários são DODECÁGONOS com
// vértice em múltiplo de 30°, e cinco dos nove bulevares cruzam esses anéis no
// MEIO DA FACE, com desvio de até 13,125° do vértice. Não existe esquina ali.
//
// A malha daqui nasce de uma regra só, e a simetria sai por construção:
//   · 12 bulevares a cada 30°, EM CIMA dos vértices do dodecágono;
//   · radiais locais por subdivisão binária desses 30°, então todo radial cai
//     num rumo múltiplo de 1,875° e todo cruzamento é uma esquina de verdade;
//   · anéis com vão por classe, os mesmos 122/180/239/298 do quarteirão.
//
// ⚠️ E ELA É UM GRAFO, NÃO UM AMONTOADO DE TRAÇOS. Nó é cruzamento, aresta é o
// trecho entre dois cruzamentos vizinhos. Uma aresta só existe se o chão dela
// aguentar. Depois: componente conexo (só a maior rede fica) e poda de grau 1
// repetida até parar, que é o que elimina cauda pendurada. É a diferença entre
// "recortei cada linha" e "isto é uma rede".
// ⚠️ O RAIO DA AN7 POR RUMO É FONTE ÚNICA. Três consumidores precisam dele: o
// traçado da própria avenida, o ponto exato onde cada radial deve parar, e as
// curvas de acesso. Calculado em três lugares, os três divergiriam no primeiro
// ajuste — e "a radial para exatamente nela" deixaria de ser verdade em silêncio.
// ⚠️ A AN7 É UM CÍRCULO EXATO DE r 6.950, E ISSO É DECISÃO, NÃO PREGUIÇA.
// Ela procurava o raio viável rumo a rumo, varrendo ±2.800 m em torno de 6.950.
// Na carta isso virou serrilha: a oeste, onde o maciço encosta na avenida, a
// linha ficava pulando de 50 em 50 m e lia como risco tremido, não como pista.
// O fundador cortou o assunto em 11/09/2026: "a única via circular REDONDA será
// essa perimetral da orla nobre". Uma pista de corrida não zigue-zague.
//
// E a medição diz que a busca nunca fez falta. MEDIDO nos 720 rumos de meio
// grau, em r 6.950 exato:
//     ÁGUA           0 rumos          <- ela nunca precisou desviar de lago
//     declive > 12°  32 rumos (4,4%)  <- só terraplanagem, e pontual
//     pior desvio que a busca pedia: 200 m, no rumo 254°
// 200 m é 2,9% do raio e é MENOS que a largura do próprio platô do pódio (a
// faixa de 6.950 a 7.150 já está nivelada em 0,00° nos 360 rumos). Desviar a
// avenida inteira para caber num terreno que a obra nivela de qualquer jeito era
// trocar a geometria da cidade por ruído de amostragem.
//
// ⚠️ ELA CONTINUA SENDO FONTE ÚNICA. Três consumidores precisam deste raio: o
// traçado da avenida, o ponto em que cada radial para, e as curvas de acesso.
// Calculado em três lugares, os três divergiriam no primeiro ajuste.
const AN7_R_BASE = 6950
let an7TemTunel = false   // a legenda só ganha o verbete se a obra existir
function raioAN7() { return AN7_R_BASE }

const VIAS = arg('vias', '0') !== '0'
if (VIAS) {
  const LIMD = +arg('decliveVia', 12)
  const LIMIAR_PONTE = +arg('ponte', 150)
  const LIMIAR_CANAL = +arg('ponteCanal', 200)   // 140 m de vão mais folga de talude
  // ⚠️ A RAMPA DE ACESSO À AN7 NÃO ABRE EXCEÇÃO PARA ÁGUA, e isso foi VERIFICADO,
  // não suposto. O limiar dela é o mesmo da ponte estrutural, e subi-lo para
  // 360 m (o estreito da raiz leste da alça mede 335 m) não mudou uma linha do
  // mapa: os oito rumos de terra já chegam por terra firme, e os quatro que
  // faltam estão atrás de 1,4 a 2,7 km de baía aberta, longe de qualquer limiar.
  // A exceção da rampa é de DECLIVE, não de água — "sem estradas sobre as águas"
  // continua valendo inteiro. O parâmetro fica exposto só para a medição poder
  // ser refeita sem editar código.
  const LIMIAR_ACESSO = +arg('ponteAcesso', LIMIAR_PONTE)
  const LIMIAR_CORTE = +arg('corte', 60)   // m de encosta acima do limite que uma rua vence
  const LIMD_ORLA = +arg('decliveOrla', 18)  // corniche de borda de lago
  // ⚠️ 55 m, NÃO 150. A faixa livre da AN7 existe para impedir que rua comum
  // DESEMBOQUE na autopista, não para proibir via paralela: marginal ao lado de
  // autopista é o arranjo normal, e é o que a própria marginal da cidade faz.
  // Com 150 m a regra passava a proibir coisa legítima — MEDIDO no lago do rumo
  // 282, a lâmina chega a 105 m do eixo da AN7 em três rumos e a 121 a 190 m em
  // outros seis, de modo que NENHUMA via cabia na margem oeste e um terço do
  // lago ficava sem orla. A avenida tem 44 m; 55 m do eixo deixa 33 m entre o
  // meio-fio dela e a via de serviço, que é defensa e acostamento.
  const FAIXA_AN7 = +arg('faixaAN7', 50)
  // ⚠️ O CORTE É MAIS FOLGADO QUE A COLOCAÇÃO, E TEM DE SER. O nó é posto a 55 m
  // do eixo; o trecho entre dois nós oscila e encosta nos 55. Testando corte e
  // colocação com o mesmo número, a via paralela nascia e morria na mesma
  // geração. 40 m é o limite do que é inaceitável: a avenida tem 22 m de
  // meia-largura, então 40 deixa 18 m livres do meio-fio dela.
  const FAIXA_AN7_CORTE = +arg('faixaAN7Corte', 40)
  // ⚠️ A MALHA NÃO PODE NASCER DENTRO DO CANAL, e nascia. MEDIDO no perfil do
  // centro: a praça é um disco seco em cota −35 até r ≈ 1.100, o CANAL ANELAR vai
  // de 1.100 a 1.410 (fundo em −48), e a cidade sobe a partir dali. Com R0 em
  // 1.420 a face do dodecágono caía em 0,966 × 1.420 = 1.372, ou seja, DENTRO da
  // água: o primeiro anel saía picotado e a junção com o centro nunca fechava —
  // "o círculo de vias em torno do canal circular central não está fechado".
  // Com vértice em 1.640 a face fica em 1.585, 175 m de terra firme além da
  // margem, e sobra exatamente um quarteirão entre o anel da praça e ela.
  const R0 = +arg('rMalha0', 1640), R1 = +arg('rMalha1', 6900)
  // o anel da praça: via circular colada no canal, 50 m além da margem
  const R_ANEL_PRACA = +arg('rAnelPraca', 1460)
  const N_BASE = 12                     // os bulevares, e o dodecágono dos anéis
  const SUB = [8, 16]                   // subdivisões: 96 e 192 radiais
  const R_SUB2 = +arg('rSub2', 3400)    // onde a segunda subdivisão nasce
  const ALCA_R_DENTRO = 6400
  const naAlca = (r, g) => r >= ALCA_R_DENTRO && (g >= 346 || g <= 116.5)
  const vao = (r) => (r < 2200 ? 122 : r < 3400 ? 180 : r < 5000 ? 239 : 298)
  const ANEIS = []
  for (let r = R0; r <= R1; r += vao(r)) ANEIS.push(r)
  const NR = N_BASE * SUB[1]            // 192 rumos possíveis, todos alinhados
  const rumoDe = (ir) => (ir / NR) * 360
  // em que anel cada rumo nasce: bulevar no primeiro, depois as duas subdivisões
  const nasceEm = (ir) => {
    if (ir % (NR / N_BASE) === 0) return R0                 // bulevar
    if (ir % (NR / (N_BASE * SUB[0])) === 0) return ANEIS[0] // 96 radiais
    return R_SUB2                                            // 192 radiais
  }
  const classeDe = (ir) => (ir % (NR / N_BASE) === 0 ? 'bulevar' : 'local')
  // ⚠️ O ANEL É DODECÁGONO, NÃO CÍRCULO, e a malha gerada tinha perdido isso. Ao
  // trocar a teia publicada por uma gerada, os anéis viraram polígonos de 96 e
  // 192 lados: na escala da carta, círculo puro. O dodecágono é a assinatura da
  // cidade e tem consequência de projeto, não só de desenho — é ele que dá
  // esquina em cunha, que faz a face ser reta e que põe os doze bulevares nos
  // VÉRTICES em vez de num ponto qualquer da curva.
  //
  // A regra é a mesma que `vias-varredura.mjs` usa para auditar: o raio
  // publicado é o do VÉRTICE, e o meio da face fica em cos(15°) = 96,6% dele.
  // Um radial a `rel` graus do meio da face encontra essa face em
  //     r = R · cos(15°) / cos(rel)
  // Com `rel` indo de −15° a +15° dentro de cada setor de 30°, a interseção
  // percorre a reta inteira: no meio do setor cai em 0,966R, no vértice em R.
  const PASSO_DODEC = Math.PI / 6
  const COS15 = Math.cos(PASSO_DODEC / 2)
  const raioNaFace = (R, gDeg) => {
    const ang = (gDeg * Math.PI) / 180
    const rel = ((ang % PASSO_DODEC) + PASSO_DODEC) % PASSO_DODEC - PASSO_DODEC / 2
    return (R * COS15) / Math.cos(rel)
  }
  const PXY = (r, g) => { const a = (g * Math.PI) / 180; return [Math.sin(a) * r, -Math.cos(a) * r] }
  // o nó do anel `R` no rumo `g`: sobre a FACE do dodecágono, não sobre o círculo
  const PNO = (R, g) => PXY(raioNaFace(R, g), g)
  // ── CANAL NÃO É BAÍA, e tratar os dois como "água" esvaziou o setor inteiro
  // dos canais na rodada anterior. Os três canais radiais têm 60 m de lâmina e
  // 40 m de talude por lado: 140 m de vão, que qualquer rua cruza com uma ponte
  // curta. A baía tem quilômetros e não se cruza. Zerando a ponte para via local
  // eu matei as duas de uma vez, e o quarteirão entre canais ficou sem acesso —
  // depois o componente conexo o descartou por inteiro, que é o vazio que
  // apareceu na carta.
  //
  // A distinção sai da GEOMETRIA PUBLICADA, não de adivinhar largura: o ponto
  // está sobre um canal de `malha.canais.radiais` ou não está.
  const CANAIS = (malha.canais?.radiais ?? []).map((c) => {
    const a = (c.rumo * Math.PI) / 180
    return { ux: Math.sin(a), uz: -Math.cos(a), meia: (c.lamina ?? 60) / 2 + (malha.canais?.talude ?? 40),
             r0: c.rInicio ?? 0, r1: c.rFim ?? 9050 }
  })
  const sobreCanal = (x, z) => {
    for (const c of CANAIS) {
      const t = x * c.ux + z * c.uz                 // projeção no eixo do canal
      if (t < c.r0 - c.meia || t > c.r1 + c.meia) continue
      if (Math.abs(x * c.uz - z * c.ux) <= c.meia) return true   // distância perpendicular
    }
    return false
  }
  // ── transitável? amostra o trecho e decide, com direito a ponte curta ──────
  const PASSO = 25
  // ⚠️ `obra` É O MODO OBRA DE ARTE, e ele só vale para a rampa de acesso à AN7.
  // Nele o DECLIVE NATURAL NÃO VETA — o lance é corte, aterro e viaduto, igual
  // ao que a AN7 já faz na alça por decreto. A ÁGUA continua vetando em qualquer
  // modo: "sem estradas sobre as águas" é ordem do fundador, e o limiar de ponte
  // segue sendo o mesmo. O pior declive volta no retorno para virar número no
  // relatório, porque terraplanagem que ninguém mediu é terraplanagem escondida.
  // ⚠️ `limD` É POR CHAMADA porque a cidade não tem um limite só. Rua de
  // quarteirão para em 12°; a corniche da orla de lago vence 18°, e é a mesma
  // via que dá acesso à faixa nobre. O nó da orla já testava 18° e a ARESTA
  // continuava em 12°: o resultado era isolinha aceita e trecho recusado, ou
  // seja, nó sem via — que na carta é o toco de 200 m que o fundador viu.
  const trecho = (p0, p1, limiar, obra = false, limD = LIMD) => {
    const comp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const n = Math.max(2, Math.ceil(comp / PASSO))
    let molhadoSeguido = 0, pior = 0, temPonte = false, molhado = 0, ingremeSeguido = 0
    let hMin = Infinity, hMax = -Infinity
    for (let t = 0; t <= n; t++) {
      const x = p0[0] + ((p1[0] - p0[0]) * t) / n, z = p0[1] + ((p1[1] - p0[1]) * t) / n
      const r = Math.hypot(x, z), g = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
      // ⚠️ A ALÇA VETA EM QUALQUER MODO. Obra de arte é licença de DECLIVE, não
      // passe livre: a alça é a orla nobre e lá a AN7 é o próprio endereço das
      // mansões, não tem marginal nem rua atrás. MEDIDO: nenhuma das 8 rampas
      // que chegam à avenida passa pelo arco da alça, então isto não custa nada.
      if (naAlca(r, g)) return null
      const h = alturaEm(x, z)
      if (naAgua(x, z)) {
        // canal atravessa-se sempre; o resto obedece ao limiar da classe
        const lim = sobreCanal(x, z) ? Math.max(limiar, LIMIAR_CANAL) : limiar
        molhadoSeguido += comp / n
        molhado += comp / n
        if (molhadoSeguido > lim) return null
        temPonte = true
      } else {
        molhadoSeguido = 0
        const d = declEm(x, z)
        pior = Math.max(pior, d)
        // ⚠️ UM PONTO ÍNGREME NÃO MATA UM QUARTEIRÃO INTEIRO. O teste era tudo ou
        // nada: qualquer amostra acima do limite derrubava a aresta de 300 m
        // inteira. MEDIDO no bolsão em volta da cratera (rumos 255° a 310°,
        // r 5.500 a 6.700): 17% do chão aceita lote, 39% aceita rua e só 32%
        // passa de 12° — e mesmo assim quase não havia rua ali, porque os 32%
        // vêm em manchas que cortam toda aresta que as atravessa. A água já era
        // tratada assim (trecho curto molhado é ponte); encosta curta é CORTE, e
        // corte de 60 m é obra de rua comum. Acima disso a rua não passa.
        if (d > limD) {
          ingremeSeguido += comp / n
          if (!obra && ingremeSeguido > LIMIAR_CORTE) return null
        } else ingremeSeguido = 0
        hMin = Math.min(hMin, h); hMax = Math.max(hMax, h)
      }
    }
    return { ponte: temPonte, pior, hMin, hMax, molhado, molhadoFim: molhadoSeguido }
  }
  // ── nós e arestas ─────────────────────────────────────────────────────────
  const chave = (ia, ir) => ia * NR + ir
  const no = new Map()
  ANEIS.forEach((r, ia) => {
    for (let ir = 0; ir < NR; ir++) if (r >= nasceEm(ir) - 1e-6) no.set(chave(ia, ir), PNO(r, rumoDe(ir)))
  })
  const arestas = []
  const adj = new Map()
  const liga = (a, b, cls, ponte, acesso = false) => {
    const k = arestas.length
    arestas.push({ a, b, cls, ponte, viva: true, acesso })
    if (!adj.has(a)) adj.set(a, []); adj.get(a).push(k)
    if (!adj.has(b)) adj.set(b, []); adj.get(b).push(k)
  }
  // arestas de anel: entre rumos vizinhos QUE EXISTEM naquele anel
  // ⚠️ O ANEL MAIS EXTERNO É A MARGINAL, E ELA EXISTE POR REGRA DE PROJETO.
  // Ordem do fundador em 11/09/2026: "não seria o ideal ligarmos rua comum a
  // autopista perimetral; a última rua fica a um quarteirão da autopista". Sem
  // uma via marginal, ou a rua desemboca na AN7 (e a autopista vira avenida de
  // bairro, com cruzamento a cada 300 m), ou a última fileira de lotes fica sem
  // chegada. A marginal resolve os dois: ela recolhe o tecido inteiro e entrega
  // o tráfego aos bulevares, que são os únicos que entram na avenida, e entram
  // por trevo.
  //
  // ⚠️ ELA É OBRA DE ARTE, como as rampas. MEDIDO em 11/09/2026 nos 360 rumos do
  // dodecágono de vértice 6.697: 167 rumos abaixo de 12°, 82 entre 12° e 20°,
  // 18 acima de 20° — o trecho difícil é o talude do pódio, de 179° a 300°.
  // Com o limite comum de 12° a marginal só existia em 68 dos 192 rumos e o
  // tecido morria a 769 m da avenida (mediana), deixando a faixa de frente sem
  // rua. Corte e aterro em 300 m de talude é obra ordinária; a ÁGUA continua
  // vetando, e a alça também.
  const IA_MARGINAL = ANEIS.length - 1
  ANEIS.forEach((r, ia) => {
    const marginal = ia === IA_MARGINAL
    const vivos = []
    for (let ir = 0; ir < NR; ir++) if (no.has(chave(ia, ir))) vivos.push(ir)
    for (let t = 0; t < vivos.length; t++) {
      const a = chave(ia, vivos[t]), b = chave(ia, vivos[(t + 1) % vivos.length])
      // ⚠️ ANEL LOCAL NÃO GANHA PONTE. Com limiar de 150 m em toda aresta de
      // anel, a teia atravessava a baía em degraus: dezenas de pontinhas
      // paralelas sobre a água, que na carta lê como escada e não como cidade.
      // Ponte é obra de arte, e obra de arte é de via estrutural. Rua de bairro
      // encontra a lâmina e acaba ali, que é o que ela faz no 3D.
      const res = trecho(no.get(a), no.get(b), 0, marginal)
      if (res) liga(a, b, marginal ? 'marginal' : 'anel', res.ponte)
    }
  })
  // arestas radiais: entre anéis vizinhos
  for (let ir = 0; ir < NR; ir++) {
    for (let ia = 0; ia + 1 < ANEIS.length; ia++) {
      const a = chave(ia, ir), b = chave(ia + 1, ir)
      if (!no.has(a) || !no.has(b)) continue
      // ⚠️ A PERNA QUE SOBE ATÉ A MARGINAL SOBE JUNTO COM ELA. Sem isto a
      // marginal nascia inteira e órfã: o componente conexo a descartava em
      // bloco, e o mapa saía igual ao de antes.
      const ultima = ia + 1 === IA_MARGINAL
      // ⚠️ BULEVAR NÃO SE INTERROMPE NA MONTANHA: ELE PASSA POR CIMA. O fundador
      // apontou duas radiais soltas no rumo do maciço — "ou corrija o terreno e
      // complete, ou coloque um elevado para interligar". MEDIDO no rumo 270: o
      // maciço sobe de 199 m em r 5.800 a 293 m em r 6.250, com declives de 9° a
      // 17°, e o limite de 12° partia a radial em dois pedaços entre r 5.505 e
      // 6.101. Os doze bulevares são via estrutural, e via estrutural vence o
      // relevo com obra de arte — o mesmo critério que a AN7 e a marginal já
      // usam. Rua LOCAL continua obedecendo aos 12°: ela serve quarteirão, e
      // quarteirão não se constrói em talude de 17°.
      const ehBulevar = classeDe(ir) === 'bulevar'
      const res = trecho(no.get(a), no.get(b), ehBulevar ? LIMIAR_PONTE : 0, ultima || ehBulevar)
      if (res) {
        liga(a, b, classeDe(ir), res.ponte)
        if (ehBulevar && res.pior > LIMD) arestas[arestas.length - 1].elevado = res.pior
      }
    }
  }
  // ⚠️ OS 12 BULEVARES SEGUEM ALÉM DO ÚLTIMO ANEL, senão a perimetral não tem o
  // que recolher: ela corre na borda, a teia para em R_FORA, e as duas nunca se
  // encontram. Prolongar só os bulevares (não a teia local) é o que uma cidade
  // faz — a via estrutural sai, a rua de bairro não.
  // ⚠️ A RADIAL PARA EXATAMENTE NA AN7: nem antes, nem depois. Antes, ela deixa
  // um vão que não é esquina nem chegada; depois, ela fura a avenida e sobra do
  // outro lado. O raio vem da mesma função que desenha a avenida, então os dois
  // não podem divergir.
  // ── O ANEL DA PRAÇA: A VIA QUE FECHA O CENTRO ─────────────────────────────
  // ⚠️ ELE É CIRCULAR, E ISSO NÃO CONTRADIZ A REGRA DA CIDADE. A regra do
  // fundador é que a única via redonda de ESCALA URBANA é a AN7; aqui o que a
  // via acompanha é um canal circular, e foi ele quem descreveu assim: "vamos
  // ter um círculo em torno do canal e, logo depois, o primeiro dodecaedro".
  // Dodecágono colado num anel de água deixaria doze cunhas d'água nas faces e
  // doze pontas de terra nos vértices.
  //
  // ⚠️ E ELE ENTRA NO GRAFO LIGADO AO PRIMEIRO DODECÁGONO, rumo a rumo. Sem a
  // perna radial ele seria um anel bonito e órfão, e o componente conexo o
  // comeria inteiro — que é o que a carta mostrava.
  {
    // ⚠️ 96 NÓS, que é a contagem de radiais do primeiro anel, e não 24. Com 24 a
    // corda do anel dava 381 m: no papel um polígono de 24 lados ainda lê como
    // círculo, mas cada trecho virava uma reta de 381 m ligando duas esquinas
    // que não existem, e as pernas radiais saíam de quatro em quatro.
    const N_PRACA = N_BASE * SUB[0]         // os mesmos 96 rumos do primeiro anel
    let anterior = null, primeiro = null, arestasPraca = 0, radiaisPraca = 0
    const chaveP = (t) => 5e6 + t
    for (let t = 0; t <= N_PRACA; t++) {
      const ir = (t % N_PRACA) * (NR / N_PRACA)
      const g = rumoDe(ir)
      const q = PXY(R_ANEL_PRACA, g)
      const k = chaveP(t % N_PRACA)
      if (t < N_PRACA) no.set(k, q)
      if (anterior !== null) {
        const res = trecho(no.get(anterior), no.get(k), LIMIAR_CANAL)
        if (res) { liga(anterior, k, 'praca', !!res.ponte); arestasPraca++ }
      }
      if (t === 0) primeiro = k
      anterior = k
      // a perna que sobe para o primeiro dodecágono, no mesmo rumo
      if (t < N_PRACA) {
        const alvo = chave(0, ir)
        if (no.has(alvo)) {
          const res = trecho(q, no.get(alvo), LIMIAR_CANAL)
          if (res) { liga(k, alvo, 'local', !!res.ponte); radiaisPraca++ }
        }
      }
    }
    console.log(`  anel da praca: r ${R_ANEL_PRACA} m, ${arestasPraca} de ${N_PRACA} trechos, ${radiaisPraca} pernas ate o primeiro dodecagono`)
  }

  // ⚠️ A RAMPA DE ACESSO À AN7 NÃO MORA MAIS AQUI. Ela precisa saber qual é a
  // REDE PRINCIPAL para não nascer emendada num nó que o componente conexo vai
  // descartar meia dúzia de linhas depois, e o componente só existe lá embaixo.
  // Procure por "A RAMPA DE ACESSO À AN7".
  const pai = new Map()
  const acha = (a) => { while (pai.get(a) !== a) { pai.set(a, pai.get(pai.get(a))); a = pai.get(a) } return a }
  for (const k of no.keys()) pai.set(k, k)

  // ── O BOULEVARD DA ORLA ───────────────────────────────────────────────────
  // ⚠️ ELE NÃO É UM ANEL, É UMA ISOLINHA. A margem da baía varia de r 3.536 a
  // 6.264: qualquer círculo desenhado ali fica por cima da água num trecho e
  // longe dela em outro, que foi o defeito da versão anterior. Traçado como a
  // curva {distância até a baía = 140 m}, ele acompanha a costa sozinho.
  //
  // ⚠️ E ELE ENTRA NO GRAFO, não é uma linha desenhada por cima. Sem virar
  // aresta, o boulevard não conectaria nada: os quarteirões da orla continuariam
  // órfãos e a poda os comeria. Cada vértice dele procura o nó de malha mais
  // próximo e costura, que é como uma via de contorno funciona de verdade.
  let nosOrla = 0, ligacoesOrla = 0
  if (orlaDist) {
    const hDist = (i, j) => {
      // ⚠️ A MOLDURA É BAIXA, E EU FIZ AO CONTRÁRIO NA PRIMEIRA VERSÃO. O
      // cabeçalho de `FUNDO_MOLDURA` neste mesmo arquivo já avisava: marching
      // squares só fecha laço quando a região {valor >= nível} NÃO toca a borda
      // do domínio, e emoldurar com valor ALTO faz ela tocar sempre. Os
      // contornos saíam abertos, o `Z` os fechava com uma corda reta, e a carta
      // ganhou cunhas gigantes atravessando a cidade inteira — o mesmo defeito
      // que a primeira geração do mapa teve e que a nota de lá documenta.
      // Com moldura em −1 toda faixa de distância fecha sozinha.
      if (i <= 0 || j <= 0 || i >= orlaNG + 1 || j >= orlaNG + 1) return -1
      return orlaDist[(j - 1) * orlaNG + (i - 1)]
    }
    const mundoDist = (i) => -RAIO + (i - 1 + 0.5) * orlaCEL
    const ORLA_SUBIDA = +arg('orlaSubida', 400)   // m que a via sobe para achar chão
    const ORLA_RECUO_MIN = +arg('orlaRecuoMin', 35)  // m mínimos entre a via e a lâmina
    const ORLA_VAO = +arg('orlaVao', 60)             // m de enseada que a via atravessa
    const distEm = (x, z) => {
      const fi = (x + RAIO) / orlaCEL - 0.5, fj = (z + RAIO) / orlaCEL - 0.5
      const i = Math.max(0, Math.min(orlaNG - 1, Math.round(fi))), j = Math.max(0, Math.min(orlaNG - 1, Math.round(fj)))
      return orlaDist[j * orlaNG + i]
    }
    const gradDist = (x, z) => {
      const e = orlaCEL
      const gx = (distEm(x + e, z) - distEm(x - e, z)) / (2 * e)
      const gz = (distEm(x, z + e) - distEm(x, z - e)) / (2 * e)
      const m = Math.hypot(gx, gz)
      return m > 1e-6 ? [gx / m, gz / m] : null
    }
    const linhas = contornoEm(ORLA_VIA_R, hDist, orlaNG + 2, mundoDist)
    const PASSO_ORLA = 120
    let base = 1e6                       // chaves da orla fora do espaço da teia
    const nosDaOrla = []
    const gruposOrla = []   // um por linha de contorno, para a emenda não pular de corpo
    for (const linha of linhas) {
      if (linha.length < 4) continue
      // reamostra a curva em passos regulares para o traço não ficar denso demais
      const pontos = []
      let acum = 0
      pontos.push(linha[0])
      for (let t = 1; t < linha.length; t++) {
        acum += Math.hypot(linha[t][0] - linha[t - 1][0], linha[t][1] - linha[t - 1][1])
        if (acum >= PASSO_ORLA) { pontos.push(linha[t]); acum = 0 }
      }
      if (pontos.length < 2) continue
      const desteGrupo = []
      gruposOrla.push(desteGrupo)
      let anterior = null
      for (const q of pontos) {
        // ⚠️ A ISOLINHA CORRE PELA FRONTEIRA QUE EU MESMO CRIEI. Ao marcar as
        // células da alça como infinitamente distantes para tirá-la das faixas,
        // a distância salta de ~100 m para 1e9 na divisa: a curva de 140 m passa
        // a acompanhar ESSA descontinuidade e sai atravessando a baía a nado, em
        // linha grossa, que foi o polígono branco sobre a água. Exclusão por
        // valor sentinela cria borda, e marching squares acha borda. O filtro
        // aqui é o mesmo que vale para qualquer rua: só nasce nó onde dá para
        // construir.
        const rq = Math.hypot(q[0], q[1])
        const gq = ((Math.atan2(q[0], -q[1]) * 180) / Math.PI + 360) % 360
        // ⚠️ 140 m DA ÁGUA É REGRA DE BAÍA, E NUMA CRATERA ISSO CAI NA PAREDE.
        // O fundador apontou: "esse lago em particular ainda não está integrado
        // aos bairros de fato". MEDIDO na faixa de orla da cratera do rumo 282,
        // 265 m terra adentro em 72 rumos: 7% aceita lote, 27% aceita rua e 66%
        // passa de 12°. A isolinha fixa nascia dentro desses 66% e dois terços
        // dos nós eram recusados; sobrava um toco de 200 m.
        //
        // A correção não é afrouxar o limite, é a via SUBIR. Onde o chão da
        // isolinha não serve, o nó caminha para longe da água — subindo o talude
        // pelo gradiente do campo de distância — até achar a primeira cota
        // construível, em até 400 m. Na baía, onde o chão já serve, nada muda e
        // a via continua a 140 m da lâmina. Na cratera ela sai da parede e vai
        // para a CRISTA, que é onde uma cidade de lago se instala de verdade.
        // O limite de 18° continua valendo como último recurso: corniche corta
        // talude, mas não anda em parede.
        let qq = q
        if (!naAgua(qq[0], qq[1]) && declEm(qq[0], qq[1]) > LIMD) {
          const g0 = gradDist(qq[0], qq[1])
          if (g0) {
            // ⚠️ SE NÃO ACHAR CHÃO DE RUA, FICA COM O MENOS PIOR. A primeira
            // versão só aceitava ≤12° e desistia: na margem norte do lago do
            // rumo 282 o talude fica em 13° mesmo a 250 m da água, e três nós
            // seguidos eram recusados — 420 m de orla sem via, bem no trecho que
            // o fundador apontou. Guardando o ponto mais brando do caminho, a
            // corniche passa onde passa, dentro do limite dela.
            let melhor = null, brando = declEm(qq[0], qq[1])
            for (let passo = 20; passo <= ORLA_SUBIDA; passo += 20) {
              const alvo = [q[0] + g0[0] * passo, q[1] + g0[1] * passo]
              if (naAgua(alvo[0], alvo[1])) break
              const dd = declEm(alvo[0], alvo[1])
              if (dd <= LIMD) { qq = alvo; melhor = null; break }
              if (dd < brando) { brando = dd; melhor = alvo }
            }
            if (melhor && brando <= LIMD_ORLA) qq = melhor
          }
        }
        // ⚠️ E ONDE A AUTOPISTA APERTA, A VIA RECUA PARA A ÁGUA. No lago do rumo
        // 282 a AN7 passa raspando a margem oeste: 105 m do eixo à lâmina no
        // ponto mais estreito. A isolinha de 140 m caía em cima da avenida, o
        // corte da faixa livre a derrubava, e um terço do lago ficava sem orla —
        // "o lago não tem orla completa", como o fundador disse. O nó volta pelo
        // gradiente da distância até sair da faixa, respeitando um recuo mínimo
        // da lâmina. Com isso a via da margem oeste vira a marginal da AN7 ali,
        // que é exatamente o que ela tem de ser.
        {
          const gA = ((Math.atan2(qq[0], -qq[1]) * 180) / Math.PI + 360) % 360
          const naAlcaArco = gA >= 340 || gA <= 122
          if (!naAlcaArco && Math.abs(Math.hypot(qq[0], qq[1]) - AN7_R_BASE) < FAIXA_AN7) {
            const g1 = gradDist(qq[0], qq[1])
            let achou = false
            if (g1) {
              for (let rec = 10; rec <= 260; rec += 10) {
                const alvo = [qq[0] - g1[0] * rec, qq[1] - g1[1] * rec]
                if (distEm(alvo[0], alvo[1]) < ORLA_RECUO_MIN) break
                if (Math.abs(Math.hypot(alvo[0], alvo[1]) - AN7_R_BASE) >= FAIXA_AN7) { qq = alvo; achou = true; break }
              }
            }
            // ⚠️ SE NÃO COUBE, O NÓ NÃO NASCE. Mantendo o nó onde ele estava, a
            // orla continuava do lado de FORA da autopista: dois becos em
            // r 7.004 e r 7.049, no rumo 283, pendurados na margem errada de uma
            // avenida que ninguém atravessa a pé.
            if (!achou) { anterior = null; continue }
          }
        }
        const rqq = Math.hypot(qq[0], qq[1])
        const gqq = ((Math.atan2(qq[0], -qq[1]) * 180) / Math.PI + 360) % 360
        // ⚠️ FORA DA AN7 NÃO HÁ RUA, e fora da alça isso é regra de projeto: o
        // que sobra além da avenida é terra do projeto até a abóbada, em
        // hachura. Dois nós de orla tinham escapado para r 7.004 e r 7.049 no
        // rumo 283 e viravam beco na margem errada da autopista.
        const foraDaAN7 = !(gqq >= 340 || gqq <= 122) && rqq > AN7_R_BASE
        const seco = !naAgua(qq[0], qq[1]) && declEm(qq[0], qq[1]) <= LIMD_ORLA && !foraDaAN7
        if (rqq > 9050 || naAlca(rqq, gqq) || !seco) { anterior = null; continue }
        const k = base++
        no.set(k, qq); pai.set(k, k); nosDaOrla.push(k); desteGrupo.push(k); nosOrla++
        if (anterior !== null) {
          // ⚠️ ENSEADA CURTA NÃO PARTE A ORLA. Com tolerância zero de água, um
          // único ponto molhado no meio de um passo de 120 m derrubava o trecho
          // e o anel do lago saía picotado. Via de orla margeia a água: 60 m de
          // travessia é passarela, não ponte.
          const res = trecho(no.get(anterior), qq, ORLA_VAO, false, LIMD_ORLA)
          if (res) liga(anterior, k, 'orla', !!res.ponte)
        }
        anterior = k
      }
    }
    // ── A CONTINUAÇÃO: A PISTA DA ORLA FECHA A VOLTA ──────────────────────
    // ⚠️ A EMENDA É DENTRO DA MESMA LINHA DE COSTA, NUNCA ENTRE CORPOS D'ÁGUA
    // DIFERENTES. A primeira versão ordenava TODOS os nós de orla por ângulo em
    // torno do centro do mapa e emendava vizinho com vizinho nessa lista. Só que
    // a cidade não tem uma orla: tem a baía, dezessete lagos e os canais, cada um
    // com a sua. Ordenados por ângulo, a orla de um lago virava "vizinha" da orla
    // de outro do lado oposto, e a emenda saía atravessando a cidade inteira.
    // MEDIDO: arestas de até 1.948 m, ligando r 1.523 a r 8.491 — as "pistas
    // radiais enormes" que apareceram na chapa.
    //
    // Aqui a emenda só liga pontas da MESMA linha de contorno, e só se elas
    // estiverem perto. Vão curto e seco fecha; o resto fica aberto, que é a
    // resposta honesta para uma margem interrompida por encosta ou por água.
    {
      const EMENDA_MAX = +arg('emendaOrla', 380)
      let emendas = 0
      for (const grupo of gruposOrla) {
        for (let t = 0; t + 1 < grupo.length; t++) {
          const A = grupo[t], B = grupo[t + 1]
          const pa = no.get(A), pb = no.get(B)
          const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1])
          if (L < 1 || L > EMENDA_MAX) continue
          const jaLigado = arestas.some((e) => e.viva
            && ((e.a === A && e.b === B) || (e.a === B && e.b === A)))
          if (jaLigado) continue
          const res = trecho(pa, pb, 0, false, LIMD_ORLA)
          if (res) { liga(A, B, 'orla', !!res.ponte); emendas++ }
        }
      }
      if (emendas) console.log(`  orla: ${emendas} emendas dentro da propria linha de costa`)
    }

    // ── LÁPIDE: A PERIMETRAL INTERNA FOI REMOVIDA ────────────────────────
    // ⚠️ NÃO REFAÇA ESTE TRECHO. Aqui existia um arco que continuava a pista da
    // baía de 99,5° a 358,5° para "fechar a volta" dentro da cidade. O fundador
    // matou em 11/09/2026 com a regra que fecha o assunto:
    //
    //     "essa perimetral interna deve sair, ela está em cima da malha de
    //      dodecaedros. A única via circular REDONDA será a perimetral da orla
    //      nobre."
    //
    // O defeito era de linguagem, não de traçado: um círculo desenhado por cima
    // do tecido cruza as faces do dodecágono em ângulo qualquer, picota quarteirão
    // e some como via — na chapa ele lia como risco, não como avenida. A cidade
    // tem UMA via redonda, a AN7, e ela corre na orla nobre. Tudo que é anel
    // dentro da cidade é dodecágono, com face reta e vértice.
    //
    // A pista da baía CONTINUA existindo: ela é a isolinha a 140 m da água, segue
    // a costa e não é círculo nenhum. O que saiu foi só a emenda circular.

    // ── OS RAMAIS: A ORLA TEM DE ENTRAR NA CIDADE ─────────────────────────
    // ⚠️ VIA PARALELA À COSTA SEM TRANSVERSAL É MURO, NÃO AVENIDA. A versão
    // anterior ligava cada nó da orla ao vizinho mais próximo e desenhava isso
    // como rua local: ficavam centenas de tocos de 15 m que somem contra o
    // traço do boulevard, e no papel a pista corria solta ao lado da malha sem
    // tocá-la. O fundador viu exatamente isso.
    //
    // O conserto é o que uma orla real tem: RAMAL TRANSVERSAL a intervalo
    // regular, com calibre próprio, entrando na cidade. A cada `passo` metros de
    // costa nasce um, e ele procura o nó de malha mais próximo — não o vizinho
    // imediato da orla, que é para onde a ligação antiga escorregava.
    const LIG_MAX = +arg('orlaLig', 700)
    const PASSO_RAMAL = +arg('ramal', 280)
    let andado = 0, ultimo = null
    for (const k of nosDaOrla) {
      const p = no.get(k)
      if (ultimo) andado += Math.hypot(p[0] - ultimo[0], p[1] - ultimo[1])
      ultimo = p
      if (andado < PASSO_RAMAL) continue
      andado = 0
      let melhor = null, dist = Infinity
      for (const [k2, q] of no) {
        if (k2 >= 1e6) continue                 // só nó de malha, não de orla
        const d0 = Math.hypot(p[0] - q[0], p[1] - q[1])
        if (d0 < dist) { dist = d0; melhor = k2 }
      }
      if (melhor !== null && dist <= LIG_MAX) {
        const res = trecho(p, no.get(melhor), LIMIAR_PONTE)
        if (res) { liga(k, melhor, 'ramal', !!res.ponte); ligacoesOrla++ }
      }
    }
    console.log(`  orla da baia: ${nosOrla} nos de boulevard, ${ligacoesOrla} ligacoes com a malha`)
  }

  // ── componente conexo: só a maior rede fica ───────────────────────────────
  for (const e of arestas) { const ra = acha(e.a), rb = acha(e.b); if (ra !== rb) pai.set(ra, rb) }
  const peso = new Map()
  for (const e of arestas) {
    const r = acha(e.a), p0 = no.get(e.a), p1 = no.get(e.b)
    peso.set(r, (peso.get(r) ?? 0) + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
  }
  let raiz = null, maior = -1
  for (const [r, v] of peso) if (v > maior) { maior = v; raiz = r }
  const total = [...peso.values()].reduce((a, b) => a + b, 0)

  // ── COSTURA: bolsão isolado se LIGA, não se joga fora ─────────────────────
  // ⚠️ DESCARTAR O QUE NÃO CONECTA É METADE DO TRABALHO, e a metade preguiçosa.
  // Um quarteirão que ficou separado por um canal ou por uma língua de encosta
  // não é erro de traçado: é um pedaço de cidade esperando uma ligação. Cidade
  // de verdade resolve isso com uma ponte ou uma rampa, não apagando o bairro.
  // Aqui cada componente órfão procura o nó mais próximo da rede principal e,
  // se der para alcançar, ganha a costura. Só o que fica longe demais some.
  // ⚠️ A COSTURA PRECISA ALCANÇAR A ORLA. Com 420 m ela ligava bolsão vizinho,
  // mas a orla corre por fora do tecido em vários trechos (a malha para em
  // r 6.900 e a água vai além), e ali o boulevard ficava órfão: o fundador viu
  // lote de orla "em local sem estrada, depois da entrada da alça". Orla sem via
  // não é lote, é paisagem. 1.400 m é o alcance de um ramal de acesso de verdade.
  // ⚠️ 700 m, NÃO 1.400. O alcance maior foi posto para a costura chegar à orla,
  // mas depois que o boulevard virou estrutural e ganhou ramais próprios ela não
  // precisa mais disso — e com 1.400 ela emitia traço de mais de um quilômetro
  // cruzando a borda. Medido: 1.084 m numa costura entre dois pontos em r 8.880.
  const COSTURA_MAX = +arg('costura', 700)
  // ⚠️ SÓ COMPONENTE COM RUA ENTRA NA COSTURA. A primeira versão varria TODOS os
  // nós, e nó sem nenhuma aresta viva é o seu próprio componente: a rotina saiu
  // costurando 659 pontos soltos que não têm rua nenhuma, inventando ligação
  // para lugar onde o terreno já tinha dito não. Depois a poda de grau 1 comia
  // quase tudo de volta (627 arestas), o que é o sintoma clássico de estar
  // criando e destruindo na mesma passada. Bolsão é pedaço de MALHA, não ponto.
  const COSTURA_MIN = +arg('costuraMin', 250)
  const nosPorComp = new Map()
  for (const e of arestas) {
    const r = acha(e.a)
    if ((peso.get(r) ?? 0) < COSTURA_MIN) continue
    if (!nosPorComp.has(r)) nosPorComp.set(r, new Set())
    nosPorComp.get(r).add(e.a); nosPorComp.get(r).add(e.b)
  }
  for (const [r, set] of nosPorComp) nosPorComp.set(r, [...set])
  const comRua = new Set()
  for (const e of arestas) { comRua.add(e.a); comRua.add(e.b) }
  let costuras = 0, orfaosPerdidos = 0
  for (let volta = 0; volta < 6; volta++) {
    let mexeu = false
    for (const [r, lista] of nosPorComp) {
      if (acha(lista[0]) === acha(raiz)) continue
      let melhor = null, dMelhor = Infinity
      for (const k of lista) {
        const p = no.get(k)
        for (const k2 of comRua) {
          if (acha(k2) !== acha(raiz)) continue
          const q = no.get(k2)
          const d0 = Math.hypot(p[0] - q[0], p[1] - q[1])
          if (d0 < dMelhor) { dMelhor = d0; melhor = [k, k2] }
        }
      }
      if (melhor && dMelhor <= COSTURA_MAX) {
        const res = trecho(no.get(melhor[0]), no.get(melhor[1]), Math.max(LIMIAR_PONTE, dMelhor))
        liga(melhor[0], melhor[1], 'costura', !!(res && res.ponte))
        const ra = acha(melhor[0]), rb = acha(melhor[1])
        if (ra !== rb) pai.set(ra, rb)
        costuras++; mexeu = true
      }
    }
    if (!mexeu) break
  }
  for (const [r, lista] of nosPorComp) if (acha(lista[0]) !== acha(raiz)) orfaosPerdidos++
  for (const e of arestas) if (acha(e.a) !== acha(raiz)) e.viva = false

  // ── A RAMPA DE ACESSO À AN7 ───────────────────────────────────────────────
  // ⚠️ "LEVE AS RADIAIS ATÉ EXATAMENTE ELA. NEM MENOS, NEM ALÉM." Ordem do
  // fundador em 11/09/2026, e ela esbarrava em duas coisas medidas no mesmo dia:
  //
  //  1. O TERRENO. Entre a crista do platô urbano (r 6.100 a 6.325, cota 135 a
  //     293 m) e a plataforma da AN7 (r 6.950, cota 13 a 123 m) corre o talude do
  //     pódio, de 13° a 22°. Nenhuma via de 12° desce ali, e era por isso que os
  //     bulevares do quadrante sudoeste paravam 250 a 850 m antes da avenida.
  //     A regra aqui é a mesma que a AN7 já usa na alça: o último lance é OBRA DE
  //     ARTE — corte, aterro e viaduto — e o declive natural não o veta. O pior
  //     declive vencido vai para o relatório, porque terraplanagem que ninguém
  //     mediu é terraplanagem escondida.
  //
  //  2. A ÁGUA, que continua vetando e não ganhou exceção nenhuma. MEDIDO de 5
  //     em 5 m em cada rumo, o que separa a malha da avenida nos quatro rumos
  //     que não chegam é 1.743 m no rumo 0, 2.699 m no 30, 2.699 m no 60 e
  //     1.445 m no 90: é a BAÍA, e do outro lado dela a avenida corre sobre a
  //     alça. Não é teto de rampa nem limiar de ponte que os barra, é um
  //     quilômetro e meio a dois e sete de lâmina d'água. A alça não fica sem
  //     acesso por isso — a AN7 é um circuito e entra nela por terra pelas duas
  //     pontas, em 120° e em 330°.
  //
  // ⚠️ E A RAMPA SAI DA REDE PRINCIPAL, não do último anel que existe no papel.
  // A primeira versão partia de ANEIS[último] sem perguntar: no rumo 120 isso a
  // fazia nascer a r 3.174 e refazer 2,9 km de radial em modo obra de arte,
  // passando por cima de encosta que a malha honesta já tinha recusado.
  // ⚠️ 1.800 m, E O NÚMERO SAIU DE MEDIÇÃO. Com 1.200 o rumo 270 ficava de fora
  // por 245 m: ali o maciço oeste sobe a 293 m e a malha honesta morre em
  // r 5.505, a 1.445 m da avenida. Encurtar o teto não corrige terreno, só
  // esconde a radial que falta. Com 1.800 os OITO rumos de terra chegam; os
  // quatro que sobram (0°, 30°, 60°, 90°) não param por teto nenhum, param
  // porque entre eles e a avenida há de 1,4 a 2,7 km de baía aberta.
  // ── ONDE A BORDA DO TECIDO ESTÁ, POR RUMO ─────────────────────────────────
  // diagnóstico: quanto falta da última rua até a autopista, rumo a rumo
  {
    const vivoEm2 = new Set()
    for (const e of arestas) if (e.viva) { vivoEm2.add(e.a); vivoEm2.add(e.b) }
    const faltas = []
    for (let ir = 0; ir < NR; ir += 4) {
      let melhor = 0
      for (let ia = ANEIS.length - 1; ia >= 0; ia--) {
        const k = chave(ia, ir)
        if (no.has(k) && vivoEm2.has(k) && acha(k) === acha(raiz)) { melhor = raioNaFace(ANEIS[ia], rumoDe(ir)); break }
      }
      faltas.push({ g: rumoDe(ir), r: melhor, falta: AN7_R_BASE - melhor })
    }
    const comTecido = faltas.filter((f) => f.r > 0)
    const ord = [...comTecido].sort((a, b) => a.falta - b.falta)
    const med = ord[Math.floor(ord.length / 2)].falta
    console.log(`    BORDA DO TECIDO: ${comTecido.length} de ${faltas.length} rumos com malha; falta ate a AN7 mediana ${med.toFixed(0)} m, min ${ord[0].falta.toFixed(0)}, max ${ord[ord.length-1].falta.toFixed(0)}`)
    const longe = ord.filter((f) => f.falta > 700)
    if (longe.length) console.log(`      ${longe.length} rumos a mais de 700 m (baia): ${longe.slice(-6).map((f) => `${f.g.toFixed(0)}°/${f.falta.toFixed(0)}m`).join(' ')}`)
  }

  const RAMPA_MAX = +arg('rampaAcesso', 1800)
  const terminaNaAN7 = new Set()   // ponta que morre NA avenida: chegada, não beco
  const chegouAN7 = new Set()      // rumos em que a radial de fato encostou
  const relAcesso = []
  {
    const vivoEm = new Set()
    for (const e of arestas) if (e.viva) { vivoEm.add(e.a); vivoEm.add(e.b) }
    for (let ir = 0; ir < NR; ir += NR / N_BASE) {
      const g = rumoDe(ir)
      const rAlvo = raioAN7(g, alturaEm, declEm, LIMD)
      if (rAlvo === null) continue
      let iaUlt = -1
      for (let ia = ANEIS.length - 1; ia >= 0; ia--) {
        const k = chave(ia, ir)
        if (no.has(k) && vivoEm.has(k) && acha(k) === acha(raiz)) { iaUlt = ia; break }
      }
      if (iaUlt < 0) { relAcesso.push({ g, rAlvo, rFeito: 0, ok: false, piorDecl: 0, agua: 0 }); continue }
      const rIni = raioNaFace(ANEIS[iaUlt], g)
      const PROLONGA = rAlvo - rIni
      if (PROLONGA <= 0) { relAcesso.push({ g, rAlvo, rFeito: rIni, ok: true, piorDecl: 0, agua: 0 }); continue }
      // ⚠️ TETO DE COMPRIMENTO. A rampa é a aproximação final, não uma segunda
      // chance de refazer a radial: se a rede principal morre a mais de
      // RAMPA_MAX da avenida, quem falta é cidade, e cidade não se inventa em
      // modo obra de arte.
      if (PROLONGA > RAMPA_MAX) { relAcesso.push({ g, rAlvo, rFeito: rIni, ok: false, piorDecl: 0, agua: 0 }); continue }
      // ⚠️ O ÚLTIMO PASSO CAI EXATAMENTE EM rAlvo. Com `d += 120` até PROLONGA a
      // rampa parava no múltiplo de 120 anterior — 13 m de sobra, que na carta é
      // exatamente o vão entre a radial e a avenida que o fundador não quer.
      const nPassos = Math.max(1, Math.round(PROLONGA / 120))
      let ant = chave(iaUlt, ir), rFeito = rIni, piorDecl = 0, ok = true
      let molhadoRampa = 0, aguaTotal = 0
      const criados = []
      for (let st = 1; st <= nPassos; st++) {
        const rr = rIni + (PROLONGA * st) / nPassos
        const q = PXY(rr, g)
        const res = trecho(no.get(ant), q, LIMIAR_ACESSO, true)
        if (!res) { ok = false; break }
        // ⚠️ A ÁGUA SE SOMA AO LONGO DA RAMPA INTEIRA, e não lance a lance.
        // Medindo por lance, cada passo de 120 m cabia sozinho no limiar e a
        // rampa atravessava 2 km de baía em quinze pontinhas seguidas — a mesma
        // "escada sobre a água" que este arquivo já documenta no anel local.
        molhadoRampa = res.molhado > 0 ? molhadoRampa + res.molhado : 0
        if (molhadoRampa > LIMIAR_ACESSO) { ok = false; break }
        aguaTotal += res.molhado
        piorDecl = Math.max(piorDecl, res.pior)
        const k = 3e6 + ir * 100 + st
        no.set(k, q); pai.set(k, k); criados.push(k)
        liga(ant, k, 'bulevar', !!res.ponte, true)
        const r1 = acha(k), r2 = acha(ant); if (r1 !== r2) pai.set(r1, r2)
        ant = k; rFeito = rr
      }
      if (!ok) for (const k of criados) { for (const j of adj.get(k) ?? []) arestas[j].viva = false }
      else { terminaNaAN7.add(ant); chegouAN7.add(Math.round(g)) }
      relAcesso.push({ g, rAlvo, rFeito: ok ? rFeito : rIni, ok, piorDecl, agua: aguaTotal })
    }
  }
  // ── PODA DE VIA SOBRE ÁGUA ────────────────────────────────────────────────
  // ⚠️ ELA VEM ANTES DA PODA DE GRAU 1 E DO FECHO DE PONTAS, e a ordem é o que
  // fecha o ciclo: cortar um viaduto indevido cria um beco no lugar dele, e
  // rodando depois do fecho esse beco fica órfão até a próxima geração. Medido
  // quando a ordem estava trocada: 3 cortes, 3 becos novos.
  // ⚠️ PONTE É TRAVESSIA CURTA, NÃO VIADUTO SOBRE A BAÍA. Várias rotinas daqui
  // podem emitir aresta molhada: o fecho de pontas (que é permissivo de
  // propósito), a costura e os ramais. Cada uma isolada é razoável, e somadas
  // deixam traço correndo sobre a lâmina. Esta passada mede o trecho molhado de
  // CADA aresta viva e derruba a que passa do limiar, sem exceção de classe.
  {
    const VAO_MAX = +arg('vaoMax', 200)
    let cortadas = 0, molhTotal = 0
    for (const e of arestas) {
      if (!e.viva) continue
      // ⚠️ A RAMPA DE ACESSO JÁ FOI MEDIDA COM LIMIAR PRÓPRIO, e o dela é maior
      // de propósito (o estreito da alça tem 335 m). Passar de novo por aqui,
      // com o teto de 200 m por aresta, derrubaria a ponte que a rampa acabou de
      // aprovar — e o corte deixaria a radial parada no meio da água.
      if (e.acesso) continue
      const p0 = no.get(e.a), p1 = no.get(e.b)
      const comp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const n = Math.max(2, Math.ceil(comp / 25))
      let seguido = 0, pior = 0
      for (let t = 0; t <= n; t++) {
        const x = p0[0] + ((p1[0] - p0[0]) * t) / n, z = p0[1] + ((p1[1] - p0[1]) * t) / n
        if (naAgua(x, z)) { seguido += comp / n; pior = Math.max(pior, seguido) }
        else seguido = 0
      }
      if (pior > 0) molhTotal++
      if (pior > VAO_MAX) { e.viva = false; cortadas++ }
    }
    console.log(`    via sobre agua: ${molhTotal} arestas molhadas, ${cortadas} cortadas por vao > ${VAO_MAX} m`)
  }

  // ── A FAIXA LIVRE DA AUTOPISTA ────────────────────────────────────────────
  // ⚠️ ENCHER OS LAGOS PÔS A ORLA EM CIMA DA AN7. A cratera do rumo 282 subiu de
  // 0,17 para 1,02 km² e a margem nova encostou na avenida: a via de orla, cinco
  // ramais e uma costura entraram na faixa da autopista, uma delas a 2 m do eixo.
  // Nenhuma dessas rotinas sabe o que é autopista — a orla segue a água, a
  // costura procura o nó mais próximo — então a regra tem de ser aplicada aqui,
  // uma vez, sobre o que já existe. Só BULEVAR (que entra por trevo) e a
  // MARGINAL (que corre a um quarteirão) atravessam a faixa.
  const invadeAN7 = (p0, p1) => {
    const comp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const n2 = Math.max(2, Math.ceil(comp / 25))
    for (let t = 0; t <= n2; t++) {
      const x = p0[0] + ((p1[0] - p0[0]) * t) / n2, z = p0[1] + ((p1[1] - p0[1]) * t) / n2
      const g = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
      if (g >= 340 || g <= 122) continue          // na alça a avenida é o endereço
      if (Math.abs(Math.hypot(x, z) - AN7_R_BASE) < FAIXA_AN7_CORTE) return true
    }
    return false
  }
  {
    let cortadas = 0
    for (const e of arestas) {
      if (!e.viva || e.cls === 'bulevar' || e.cls === 'marginal') continue
      if (invadeAN7(no.get(e.a), no.get(e.b))) { e.viva = false; cortadas++ }
    }
    console.log(`    faixa livre da AN7: ${cortadas} arestas cortadas (${FAIXA_AN7_CORTE} m de cada lado)`)
  }

  // ── poda de grau 1, repetida até estabilizar ──────────────────────────────
  // ⚠️ ISTO É O ACABAMENTO. Conectividade sozinha deixa a cauda pendurada: um
  // radial que encosta na rede numa ponta e morre na outra passa no teste e
  // continua sendo um fio solto no papel. Cortando todo nó de grau 1 e repetindo,
  // a rede converge para o que de fato liga dois lugares.
  // ⚠️ EXCEÇÃO: bulevar que morre na BORDA fica. Ele termina em destino (o
  // spaceport, os campos de extração), não em vazio.
  const R_BORDA = +arg('rBorda', 6600)
  let podadas = 0
  for (let volta = 0; volta < 40; volta++) {
    const grau = new Map()
    for (const e of arestas) if (e.viva) {
      grau.set(e.a, (grau.get(e.a) ?? 0) + 1); grau.set(e.b, (grau.get(e.b) ?? 0) + 1)
    }
    let mexeu = false
    for (const e of arestas) {
      if (!e.viva) continue
      for (const ponta of [e.a, e.b]) {
        if (grau.get(ponta) !== 1) continue
        const p = no.get(ponta)
        // ⚠️ QUEM MORRE NA AN7 NÃO É GRAU 1 DE VERDADE. A avenida é desenhada
        // fora do grafo, então a ponta da rampa parece solta para a poda e ela
        // comia a aproximação inteira — depois o trevo ficava boiando no papel,
        // ligado a nada. A chegada é destino, e destino não se poda.
        if (terminaNaAN7.has(ponta)) continue
        if (e.cls === 'bulevar' && Math.hypot(p[0], p[1]) >= R_BORDA) continue
        // ⚠️ O BOULEVARD DA ORLA NÃO SE PODA. Ele é a via que dá acesso à faixa
        // nobre inteira; podado por grau 1 ele encurta trecho a trecho e deixa
        // lote de frente para a água sem chegada, que é o defeito que o fundador
        // apontou. Ele entra na rede por costura, não por poda.
        if (e.cls === 'orla' || e.cls === 'ramal') continue
        e.viva = false; podadas++; mexeu = true; break
      }
    }
    if (!mexeu) break
  }
  // ── ACABAMENTO: FECHAR AS PONTAS DA ORLA ──────────────────────────────────
  // ⚠️ PONTA DE BOULEVARD É CHEGADA, NÃO FIM DE LINHA. Depois da costura ainda
  // sobravam extremidades soltas onde a faixa nobre contorna uma reentrância ou
  // uma ilha: a via chegava e parava, deixando os últimos lotes sem saída pelos
  // dois lados. Cada ponta de orla procura o nó mais próximo que NÃO seja o seu
  // vizinho imediato e fecha, o que transforma trecho aberto em circuito.
  {
    const grau = new Map()
    for (const e of arestas) if (e.viva) {
      grau.set(e.a, (grau.get(e.a) ?? 0) + 1); grau.set(e.b, (grau.get(e.b) ?? 0) + 1)
    }
    // ⚠️ TODA CLASSE ISENTA DE PODA PRECISA DESTE FECHO, não só a orla. A versão
    // anterior olhava `cls === 'orla'` e deixava os RAMAIS de fora: um ramal que
    // não alcançou a malha virava beco permanente, porque a poda não o toca e o
    // fecho não o via. Medido: sobravam 6 becos, todos a menos de 180 m de um
    // nó — inclusive um a 63 m, que é distância de esquina.
    const pontas = []
    for (const e of arestas) {
      if (!e.viva || (e.cls !== 'orla' && e.cls !== 'ramal' && e.cls !== 'bulevar')) continue
      for (const k of [e.a, e.b]) if (grau.get(k) === 1 && !terminaNaAN7.has(k)) pontas.push(k)
    }
    const FECHA_MAX = +arg('fechaPonta', 900)
    // (duas passadas: fechar uma ponta pode revelar outra)
    let fechadas = 0
    for (const k of pontas) {
      const p = no.get(k)
      const vizinhos = new Set()
      for (const e of arestas) if (e.viva && (e.a === k || e.b === k)) vizinhos.add(e.a === k ? e.b : e.a)
      // ⚠️ O ALVO TEM DE ESTAR NA REDE, e sem essa checagem o fecho anda em
      // círculos: ligando a ponta ao nó mais próximo qualquer, ele acaba ligando
      // ponta com ponta e o beco só muda de lugar. Medido entre duas rodadas: os
      // becos caíram de 6 para 4 e reapareceram nas MESMAS coordenadas, com a
      // classe trocada pela aresta que o próprio fecho tinha acabado de criar.
      // Alvo com grau 2 ou mais é alvo que leva a algum lugar.
      let melhor = null, dist = Infinity
      for (const [k2, q] of no) {
        if (k2 === k || vizinhos.has(k2)) continue
        if ((grau.get(k2) ?? 0) < 2) continue
        const d0 = Math.hypot(p[0] - q[0], p[1] - q[1])
        if (d0 > 1e-6 && d0 < dist) { dist = d0; melhor = k2 }
      }
      // ⚠️ E O FECHO É PERMISSIVO DE PROPÓSITO. Testar o vão com o limiar normal
      // fazia a ligação ser recusada justamente onde ela é mais necessária: uma
      // ponta que morre à beira d'água ou no pé de uma encosta é rejeitada pelo
      // mesmo terreno que a deixou encalhada ali. Se a distância é de esquina, a
      // cidade constrói a esquina: ponte curta ou corte, é obra de rotina.
      // ⚠️ PERMISSIVO NÃO É CEGO: a faixa livre da autopista continua valendo.
      // O fecho roda DEPOIS do corte da faixa, e sem esta linha ele reabre na
      // mão o que o corte acabou de tirar.
      if (melhor !== null && dist <= FECHA_MAX && !invadeAN7(p, no.get(melhor))) {
        const res = trecho(p, no.get(melhor), Math.max(LIMIAR_PONTE, dist))
        liga(k, melhor, 'ramal', !!(res && res.ponte))
        arestas[arestas.length - 1].viva = true
        grau.set(k, (grau.get(k) ?? 0) + 1)
        grau.set(melhor, (grau.get(melhor) ?? 0) + 1)
        fechadas++
      }
    }
    if (fechadas) console.log(`    pontas de orla fechadas: ${fechadas}`)
  }

  // ── AUDITORIA DE BECO SEM SAÍDA ───────────────────────────────────────────
  // ⚠️ A PODA DE GRAU 1 NÃO ALCANÇA O QUE FOI ISENTO DELA. Boulevard de orla e
  // ramal ficaram de fora da poda para não encurtarem pelas pontas, e o efeito
  // colateral é que um deles pode acabar no vazio e ninguém percebe. Este
  // relatório existe para a ponta aparecer em número, e não só a olho na chapa.
  {
    const grau = new Map()
    for (const e of arestas) if (e.viva) {
      grau.set(e.a, (grau.get(e.a) ?? 0) + 1); grau.set(e.b, (grau.get(e.b) ?? 0) + 1)
    }
    const becos = []
    for (const e of arestas) {
      if (!e.viva) continue
      for (const k of [e.a, e.b]) {
        if (grau.get(k) !== 1 || terminaNaAN7.has(k)) continue
        const p = no.get(k)
        const viz = new Set()
        for (const e2 of arestas) if (e2.viva && (e2.a === k || e2.b === k)) viz.add(e2.a === k ? e2.b : e2.a)
        let dist = Infinity, alvo = null
        for (const [k2, q] of no) {
          if (k2 === k || viz.has(k2)) continue
          const d0 = Math.hypot(p[0] - q[0], p[1] - q[1])
          if (d0 > 1e-6 && d0 < dist) { dist = d0; alvo = k2 }
        }
        becos.push({ k, cls: e.cls, x: p[0], z: p[1], dist, alvo })
      }
    }
    becos.sort((a, b) => a.dist - b.dist)
    console.log(`    BECOS SEM SAIDA: ${becos.length}`)
    for (const b of becos.slice(0, 14)) {
      const r = Math.hypot(b.x, b.z), g = ((Math.atan2(b.x, -b.z) * 180) / Math.PI + 360) % 360
      console.log(`      ${b.cls.padEnd(8)} r ${r.toFixed(0).padStart(5)} rumo ${g.toFixed(1).padStart(5)}  a ${b.dist.toFixed(0)} m do no mais proximo`)
    }
  }

  // ── A REGRA DA AUTOPISTA: RUA COMUM NÃO ENCOSTA NA AN7 ────────────────────
  // ⚠️ ISTO É AUDITORIA, NÃO ENFEITE. "Não seria o ideal ligarmos rua comum a
  // autopista perimetral" só é verdade se alguém medir: basta uma costura, um
  // fecho de ponta ou um ramal de orla chegar perto para a avenida virar via de
  // bairro sem ninguém perceber. Só o BULEVAR pode tocar a AN7, e mesmo ele só
  // pelo trevo. Na alça a regra não vale: lá a avenida é o endereço das mansões.
  {
    let pior = Infinity, quem = null, encostam = 0
    for (const e of arestas) {
      if (!e.viva || e.cls === 'bulevar') continue
      const p0 = no.get(e.a), p1 = no.get(e.b)
      const n2 = Math.max(2, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 25))
      // ⚠️ O MÍNIMO É POR ARESTA. Acumulando num `pior` global, a primeira aresta
      // que chegasse perto contaminava todas as seguintes e o relatório acusou
      // 1.339 infrações onde havia um punhado.
      let dEsta = Infinity
      for (let t = 0; t <= n2; t++) {
        const x = p0[0] + ((p1[0] - p0[0]) * t) / n2, z = p0[1] + ((p1[1] - p0[1]) * t) / n2
        const g = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
        if (g >= 340 || g <= 122) continue             // arco da alça: a AN7 é o endereço
        dEsta = Math.min(dEsta, Math.abs(Math.hypot(x, z) - AN7_R_BASE))
      }
      if (dEsta < pior) { pior = dEsta; quem = e.cls }
      if (dEsta < 120) encostam++
    }
    console.log(`    REGRA DA AUTOPISTA: rua comum mais proxima da AN7 a ${pior.toFixed(0)} m (classe ${quem}); ${encostam} arestas a menos de 120 m`)
  }

  // ⚠️ AUDITORIA DE COMPRIMENTO. Toda rotina que "liga" aqui tem um alcance
  // próprio (costura 1.400 m, fecho 900, ramal 700, prolongamento 2.200), e cada
  // uma parece razoável sozinha. Somadas elas produzem traço atravessando a
  // cidade, que é a "zona" que aparece na chapa. Este relatório mostra o que
  // cada alcance está de fato emitindo, em vez de confiar no número escolhido.
  {
    const porCls = new Map()
    const longas = []
    for (const e of arestas) {
      if (!e.viva) continue
      const p0 = no.get(e.a), p1 = no.get(e.b)
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const st = porCls.get(e.cls) ?? { n: 0, soma: 0, max: 0 }
      st.n++; st.soma += L; st.max = Math.max(st.max, L)
      porCls.set(e.cls, st)
      longas.push({ cls: e.cls, L, p0, p1 })
    }
    console.log('    comprimento por classe:')
    for (const [cls, st] of [...porCls].sort((a, b) => b[1].max - a[1].max)) {
      console.log(`      ${cls.padEnd(12)} ${String(st.n).padStart(5)} arestas  media ${(st.soma / st.n).toFixed(0).padStart(5)} m  MAX ${st.max.toFixed(0).padStart(6)} m`)
    }
    longas.sort((a, b) => b.L - a.L)
    console.log('    as 8 mais longas:')
    for (const l of longas.slice(0, 8)) {
      const r0 = Math.hypot(l.p0[0], l.p0[1]), r1 = Math.hypot(l.p1[0], l.p1[1])
      console.log(`      ${l.cls.padEnd(12)} ${l.L.toFixed(0).padStart(5)} m   de r ${r0.toFixed(0)} a r ${r1.toFixed(0)}`)
    }
  }

  const vivas = arestas.filter((e) => e.viva)
  const kmVivo = vivas.reduce((acc, e) => {
    const p0 = no.get(e.a), p1 = no.get(e.b)
    return acc + Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
  }, 0)
  console.log(`  malha gerada: ${no.size} nos, ${arestas.length} arestas candidatas`)
  console.log(`    conexo: ${(maior / 1000).toFixed(1)} km de ${(total / 1000).toFixed(1)} (${((100 * maior) / total).toFixed(1)}%) antes da costura`)
  console.log(`    costura: ${costuras} ligacoes novas, ${orfaosPerdidos} bolsoes longe demais`)
  console.log(`    poda de grau 1: ${podadas} arestas; rede final ${(kmVivo / 1000).toFixed(1)} km em ${vivas.length} arestas`)
  // ── desenho ───────────────────────────────────────────────────────────────
  const PX = (q) => `${mundoPx(q[0]).toFixed(1)} ${mundoPx(q[1]).toFixed(1)}`
  const dDe = (lista) => lista.map((e) => `M${PX(no.get(e.a))}L${PX(no.get(e.b))}`).join('')
  const lg = (m) => Math.max(0.6 * F, (m / (2 * RAIO)) * LADO)
  // ⚠️ UMA COR SÓ PARA TODA A REDE, e a hierarquia sai da LARGURA. Foi pedido do
  // fundador e é o que carta de estrada faz: a via importante não é de outra cor,
  // é mais grossa. Pintando rua local de escuro e bulevar de claro, a peça
  // passava a ler como duas redes diferentes sobrepostas, que é justamente o que
  // ela não é — a local nasce do bulevar por subdivisão e desemboca nele.
  const VIA_COR = '#F0E2C8'
  const dLocal = dDe(vivas.filter((e) => e.cls === 'local' || e.cls === 'anel' || e.cls === 'costura'))
  const dRamal = dDe(vivas.filter((e) => e.cls === 'ramal'))
  // ⚠️ A ORLA E A PERIMETRAL GANHAM CALIBRE PRÓPRIO. Desenhadas com a mesma
  // largura dos bulevares, elas somem no meio deles: o fundador procurou o anel
  // da orla nobre na chapa e não achou, mesmo com ele traçado e ligado. A regra
  // da casa é "uma cor só, o destaque vem do tamanho", então a distinção é
  // largura e não cor — via de contorno é mais larga que radial de distrito,
  // como é numa cidade de verdade.
  const dBul = dDe(vivas.filter((e) => e.cls === 'bulevar'))
  const dAnelOrla = dDe(vivas.filter((e) => e.cls === 'orla'))
  // ⚠️ A MARGINAL TEM CALIBRE PRÓPRIO, entre a rua local e o bulevar. Ela não é
  // rua de quarteirão (recolhe o tecido inteiro no encontro com a autopista) nem
  // é bulevar (não vai a lugar nenhum, corre em paralelo à AN7). Desenhada como
  // local, o leitor não vê que existe uma via ali e volta a achar que a rua
  // desemboca na avenida.
  const dMarginal = dDe(vivas.filter((e) => e.cls === 'marginal' || e.cls === 'praca'))
  // ⚠️ O ELEVADO DE BULEVAR GANHA O MESMO SÍMBOLO DA AN7: traço perpendicular de
  // apoio. Sem ele o leitor vê uma avenida atravessando uma encosta de 17° como
  // se fosse chão plano, que é mentira de carta.
  const elevados = vivas.filter((e) => e.elevado)
  {
    const km = elevados.reduce((a, e) => {
      const p0 = no.get(e.a), p1 = no.get(e.b)
      return a + Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    }, 0) / 1000
    const pior = elevados.reduce((m, e) => Math.max(m, e.elevado ?? 0), 0)
    console.log(`    ELEVADO DE BULEVAR: ${elevados.length} tramos, ${km.toFixed(1)} km, encosta mais ingreme ${pior.toFixed(0)}°`)
  }
  let dApoio = ''
  for (const e of elevados) {
    const p0 = no.get(e.a), p1 = no.get(e.b)
    const comp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const ux = (p1[0] - p0[0]) / comp, uz = (p1[1] - p0[1]) / comp
    const n2 = Math.max(1, Math.round(comp / 150))
    for (let t = 0; t < n2; t++) {
      const f = (t + 0.5) / n2
      const q = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f]
      const meia = 62
      dApoio += `M${PX([q[0] + uz * meia, q[1] - ux * meia])}L${PX([q[0] - uz * meia, q[1] + ux * meia])}`
    }
  }
  const dPonte = dDe(vivas.filter((e) => e.ponte))
  corpo += `<g clip-path="url(#casca)">`
    // casing só nas largas: em rua de 1,7 px o contorno come a própria via
    + `<path d="${dAnelOrla}" fill="none" stroke="#14100A" stroke-width="${lg(92).toFixed(2)}" opacity="0.55" stroke-linecap="round"/>`
    + `<path d="${dBul}" fill="none" stroke="#14100A" stroke-width="${lg(66).toFixed(2)}" opacity="0.5" stroke-linecap="round"/>`
    + `<path d="${dLocal}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(15).toFixed(2)}" opacity="0.82" stroke-linecap="round"/>`
    + `<path d="${dRamal}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(26).toFixed(2)}" opacity="0.9" stroke-linecap="round"/>`
    + `<path d="${dMarginal}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(30).toFixed(2)}" opacity="0.92" stroke-linecap="round"/>`
    + `<path d="${dApoio}" fill="none" stroke="#14100A" stroke-width="${lg(13).toFixed(2)}" opacity="0.6" stroke-linecap="butt"/>`
    + `<path d="${dBul}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(42).toFixed(2)}" opacity="0.92" stroke-linecap="round"/>`
    + `<path d="${dApoio}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(7).toFixed(2)}" opacity="0.9" stroke-linecap="butt"/>`
    + `<path d="${dAnelOrla}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(60).toFixed(2)}" opacity="0.96" stroke-linecap="round"/>`
    + (dPonte ? `<path d="${dPonte}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(24).toFixed(2)}" opacity="0.95" stroke-dasharray="${7 * F} ${5 * F}"/>` : '')
    + `</g>\n`
  // ── A AN7 DÁ A VOLTA COMPLETA: ELA É A PERIMETRAL ─────────────────────────
  // ⚠️ A ORLA NOBRE É A ALÇA, e a pista dela é a AN7 — não a margem da baía.
  // Passei quatro rodadas desenhando vias na beira da baía achando que era isso,
  // até o fundador dizer a frase que resolvia: "meu problema é a pista da orla
  // nobre ser uma meia lua, ela tem que dar a volta completa na cidade". A AN7
  // nasceu como arco de 150° porque a alça só existe de 330° a 120°; o pedido é
  // que a AVENIDA continue, não que a alça cresça.
  //
  // ⚠️ ELA É UM CÍRCULO FECHADO, e o traçado não tem mais emenda nem interrupção:
  // 720 pontos em r 6.950 e um `Z`. A versão anterior recortava a linha rumo a
  // rumo conforme o terreno e saía serrilhada a oeste — ver a nota longa em
  // `raioAN7`. O que o terreno pede continua sendo MEDIDO e relatado, só não
  // manda mais no desenho.
  {
    const NE = 720                            // estacas de meio grau
    const PT = [], hAN7 = []
    for (let k = 0; k < NE; k++) {
      const q = PXY(AN7_R_BASE, k * 0.5)
      PT.push(q); hAN7.push(alturaEm(q[0], q[1]))
    }
    let d0 = ''
    for (let k = 0; k < NE; k++) d0 += (k === 0 ? 'M' : 'L') + PX(PT[k])
    d0 += 'Z'
    // ── O GREIDE, E A ESTRUTURA QUE ELE EXIGE ───────────────────────────────
    // ⚠️ O CÍRCULO PERFEITO EM PLANTA COBRA UM PREÇO EM PERFIL, e o fundador
    // nomeou esse preço antes de eu medir: "a parte das montanhas deve ser um
    // viaduto gigante, todo esse pedaço que ficou igual eletrocardiograma deve
    // virar um mega elevado, estilo Alpes europeus — isso vai fazer com que ela
    // fique perfeitamente circular". É exatamente isso: o desvio em planta virou
    // estrutura em corte.
    //
    // MEDIDO em 11/09/2026, o chão sob a AN7 nos 720 rumos vai de −30 m (a alça)
    // a +169 m (o maciço oeste, entre os rumos 235° e 300°).
    //
    // ⚠️ O GREIDE É ENVELOPE SUPERIOR, NÃO MÉDIA, e a diferença é o pedido do
    // fundador. Com a média o greide passava no meio do maciço: dava viaduto nos
    // vales e TÚNEL nas cristas, quatro tramos escavados alternando com quatro
    // elevados, e a carta virava tracejado picotado. Ele pediu o contrário —
    // "um mega elevado, estilo Alpes europeus" —, então o greide passa POR CIMA
    // de tudo: máximo móvel de ±10° (que levanta a linha acima de cada crista)
    // e duas médias de ±20° (que devolvem a suavidade). O resultado é uma obra
    // contínua, com rampa máxima de 2,7% — greide de autopista de verdade.
    const DS = (2 * Math.PI * AN7_R_BASE) / NE
    const suaviza = (v, W) => v.map((_, k) => {
      let s2 = 0
      for (let d = -W; d <= W; d++) s2 += v[(k + d + NE) % NE]
      return s2 / (2 * W + 1)
    })
    const envelope = (v, W) => v.map((_, k) => {
      let m2 = -Infinity
      for (let d = -W; d <= W; d++) m2 = Math.max(m2, v[(k + d + NE) % NE])
      return m2
    })
    const JAN = Math.max(1, Math.round(+arg('greideJanela', 20) * 2))
    const JAN_TOPO = Math.max(1, Math.round(+arg('greideEnvelope', 10) * 2))
    const greide = suaviza(suaviza(envelope(hAN7, JAN_TOPO), JAN), JAN)
    const VIADUTO_MIN = +arg('viadutoMin', 8)     // m de tabuleiro para virar obra
    const TUNEL_MIN = +arg('tunelMin', 25)        // m de cobertura para virar túnel
    const CORTE_MIN = +arg('corteMin', 8)          // m de escavação para virar corte
    const tipo = hAN7.map((h, k) => (greide[k] - h > VIADUTO_MIN ? 'viaduto'
      : h - greide[k] > TUNEL_MIN ? 'tunel'
      : h - greide[k] > CORTE_MIN ? 'corte' : 'terra'))
    // ⚠️ CORRIDA CURTA NÃO VIRA OBRA. Sem isto o maciço produzia dezenas de
    // trechinhos de 60 m alternando viaduto e terra, que na carta lê como
    // tracejado sujo e não como estrutura. Toda corrida com menos de 5 estacas
    // (300 m) volta a ser terreno.
    for (let k = 0; k < NE; k++) {
      if (tipo[k] === 'terra') continue
      let n2 = 1
      while (n2 < NE && tipo[(k + n2) % NE] === tipo[k]) n2++
      if (n2 < 5) for (let d = 0; d < n2; d++) tipo[(k + d) % NE] = 'terra'
      k += n2 - 1
    }
    // ⚠️ VÃO CURTO NÃO INTERROMPE A OBRA. No maciço o terreno encosta no greide
    // por 200 ou 300 m entre um vale e outro, e classificar isso como chão
    // partia o elevado em oito tramos: na carta voltava a ler picotado, que é
    // exatamente o "eletrocardiograma" que o fundador mandou acabar. Todo
    // intervalo de menos de 6° (730 m) entre dois trechos de viaduto vira
    // viaduto — uma obra de 700 m não se interrompe para reapoiar no chão.
    const VAO_FECHA = Math.max(1, Math.round(+arg('viadutoVao', 6) * 2))
    for (let k = 0; k < NE; k++) {
      if (tipo[k] === 'viaduto') continue
      let n2 = 0
      while (n2 < NE && tipo[(k + n2) % NE] !== 'viaduto') n2++
      if (n2 > 0 && n2 <= VAO_FECHA && tipo[(k - 1 + NE) % NE] === 'viaduto') {
        for (let d = 0; d < n2; d++) tipo[(k + d) % NE] = 'viaduto'
      }
      k += Math.max(0, n2 - 1)
    }
    const corrida = (qual) => {
      const saida = []
      let atual = null
      for (let k = 0; k <= NE; k++) {
        const t = tipo[k % NE]
        if (t === qual && k < NE) { if (!atual) atual = []; atual.push(PT[k]) }
        else if (atual) { saida.push(atual); atual = null }
      }
      if (atual) saida.push(atual)
      return saida
    }
    const runsVia = corrida('viaduto'), runsTun = corrida('tunel'), runsCor = corrida('corte')
    const linhaDe = (runs) => runs.map((r) => r.map((q, i) => (i ? 'L' : 'M') + PX(q)).join('')).join('')
    const dViad = linhaDe(runsVia), dTunel = linhaDe(runsTun)
    // ⚠️ OS PILARES SÃO O QUE FAZ LER COMO ELEVADO. Uma linha grossa sobre o
    // vale é só uma linha grossa; o traço perpendicular a cada 360 m é o símbolo
    // cartográfico de tabuleiro sobre apoio, e é ele que conta a história dos
    // Alpes sem precisar de rótulo.
    let dPilar = ''
    for (const r of runsVia) {
      for (let i = 2; i < r.length; i += 5) {
        const q = r[i], L = Math.hypot(q[0], q[1])
        const ux = q[0] / L, uz = q[1] / L, meia = 95
        dPilar += `M${PX([q[0] - ux * meia, q[1] - uz * meia])}L${PX([q[0] + ux * meia, q[1] + uz * meia])}`
      }
    }
    let rampaMax = 0
    for (let k = 0; k < NE; k++) rampaMax = Math.max(rampaMax, Math.abs(greide[(k + 1) % NE] - greide[k]) / DS)
    const kmDe = (runs) => (runs.reduce((a, r) => a + r.length, 0) * DS) / 1000
    const deckMax = Math.max(...hAN7.map((h, k) => greide[k] - h))
    const coberturaMax = Math.max(...hAN7.map((h, k) => h - greide[k]))
    // ── OS TREVOS: A RADIAL ENTRA POR CURVA, NÃO POR ESQUINA ────────────────
    // ⚠️ ESQUINA EM VIA DE ALTA VELOCIDADE É PARADA OBRIGATÓRIA, e o fundador foi
    // explícito: "ninguém quer uma esquina ali, isso será pista de corrida". Um
    // cruzamento em T obriga a frear; um acesso curvo deixa entrar e sair sem
    // perder a linha, que é como autopista encontra anel no mundo real.
    //
    // Cada radial ganha DOIS ramos, um para cada sentido do anel. O ramo sai do
    // eixo da radial a `RECUO` metros da avenida, ainda apontando para fora, e
    // chega TANGENTE à AN7 a `ABERTURA` graus de distância. A curva é uma Bézier
    // cúbica cujos pontos de controle ficam sobre as duas tangentes: por
    // construção ela sai reta no sentido da radial e entra deitada no sentido do
    // anel, sem quina em nenhuma das duas pontas.
    const RECUO_TREVO = +arg('trevoRecuo', 620)
    const ABERTURA = +arg('trevoAbertura', 7)
    let trevos = ''
    for (let k = 0; k < 12; k++) {
      const g = k * 30
      // ⚠️ TREVO SÓ ONDE A RADIAL CHEGOU. Desenhado para os doze rumos sem
      // perguntar, ele aparecia solto nos quatro rumos da baía — um Y de asfalto
      // no meio do nada, sem tronco nenhum encostando nele.
      if (!chegouAN7.has(g)) continue
      const rA = raioAN7(g, alturaEm, declEm, LIMD)
      if (rA === null) continue
      const dirRad = [Math.sin((g * Math.PI) / 180), -Math.cos((g * Math.PI) / 180)]
      const P0 = PXY(rA - RECUO_TREVO, g)
      for (const lado of [-1, 1]) {
        const gFim = g + lado * ABERTURA
        const rFim = raioAN7(gFim, alturaEm, declEm, LIMD)
        if (rFim === null) continue
        const P3 = PXY(rFim, gFim)
        // tangente ao anel no ponto de chegada: perpendicular ao raio
        const aF = (gFim * Math.PI) / 180
        const tang = [lado * Math.cos(aF), lado * Math.sin(aF)]
        const L1 = RECUO_TREVO * 0.85
        const L2 = (Math.abs(ABERTURA) * Math.PI / 180) * rFim * 0.72
        const P1 = [P0[0] + dirRad[0] * L1, P0[1] + dirRad[1] * L1]
        const P2 = [P3[0] - tang[0] * L2, P3[1] - tang[1] * L2]
        trevos += `M${PX(P0)}C${PX(P1)} ${PX(P2)} ${PX(P3)}`
      }
    }
    const perimetro = (2 * Math.PI * AN7_R_BASE) / 1000
    corpo += `<path d="${d0}" fill="none" stroke="#14100A" stroke-width="${lg(92).toFixed(2)}" opacity="0.55" stroke-linecap="round"/>`
      + `<path d="${trevos}" fill="none" stroke="#14100A" stroke-width="${lg(76).toFixed(2)}" opacity="0.5" stroke-linecap="round"/>`
      // o tabuleiro: sombra larga sob a pista, e os apoios atravessando
      + `<path d="${dPilar}" fill="none" stroke="#14100A" stroke-width="${lg(16).toFixed(2)}" opacity="0.6" stroke-linecap="butt"/>`
      + `<path d="${d0}" fill="none" stroke="#FFF2DC" stroke-width="${lg(62).toFixed(2)}" opacity="0.97" stroke-linecap="round"/>`
      + `<path d="${dPilar}" fill="none" stroke="#FFF2DC" stroke-width="${lg(9).toFixed(2)}" opacity="0.9" stroke-linecap="butt"/>`
      // ⚠️ O TÚNEL SE APAGA, NÃO SE INTERROMPE. Cortar a linha quebraria o
      // círculo que o fundador acabou de mandar fechar; o tracejado escuro por
      // cima da pista é o símbolo de trecho coberto e mantém a volta inteira.
      + `<path d="${dTunel}" fill="none" stroke="#3B3327" stroke-width="${lg(62).toFixed(2)}" opacity="0.85" stroke-dasharray="${11 * F} ${9 * F}"/>`
      + `<path d="${trevos}" fill="none" stroke="#FFF2DC" stroke-width="${lg(44).toFixed(2)}" opacity="0.95" stroke-linecap="round"/>\n`
    console.log(`  AN7 como perimetral: circulo fechado de r ${AN7_R_BASE} m, ${perimetro.toFixed(1)} km`)
    console.log(`    greide: rampa maxima ${(rampaMax * 100).toFixed(1)}%, cota de ${Math.min(...greide).toFixed(0)} a ${Math.max(...greide).toFixed(0)} m`)
    console.log(`    VIADUTO ${kmDe(runsVia).toFixed(1)} km em ${runsVia.length} tramos, tabuleiro ate ${deckMax.toFixed(0)} m acima do chao`)
    console.log(`    TUNEL   ${kmDe(runsTun).toFixed(1)} km em ${runsTun.length} tramos, cobertura ate ${coberturaMax.toFixed(0)} m`)
    console.log(`    CORTE   ${kmDe(runsCor).toFixed(1)} km em ${runsCor.length} tramos`)
    an7TemTunel = runsTun.length > 0
    const rumoDoPonto = (q) => ((Math.atan2(q[0], -q[1]) * 180) / Math.PI + 360) % 360
    const faixas = (runs) => runs.map((r) => `${rumoDoPonto(r[0]).toFixed(0)}-${rumoDoPonto(r[r.length-1]).toFixed(0)}°`).join(' ')
    console.log(`      viaduto em: ${faixas(runsVia)}`)
    if (runsTun.length) console.log(`      tunel em:   ${faixas(runsTun)}`)
    if (runsCor.length) console.log(`      corte em:   ${faixas(runsCor)}`)
    // ⚠️ O QUE NÃO CHEGA TEM DE APARECER EM METRO, e não sumir do relatório. Os
    // rumos da baía não alcançam a avenida porque entre a última quadra e a alça
    // há mais de 1 km de água aberta, e a ponte máxima é de 150 m. A alça não
    // fica sem acesso por isso: a AN7 é um circuito e entra nela pelas DUAS
    // pontas, por terra.
    {
      const chegam = relAcesso.filter((a) => a.ok)
      const pior = chegam.reduce((m, a) => Math.max(m, a.piorDecl), 0)
      console.log(`  radiais ate a AN7: ${chegam.length} de ${relAcesso.length}; rampa mais ingreme ${pior.toFixed(0)}° (obra de arte)`)
      const comPonte = chegam.filter((a) => a.agua > 1)
      for (const a of comPonte) console.log(`    rumo ${a.g.toFixed(0).padStart(3)}: ponte de ${a.agua.toFixed(0)} m na aproximacao`)
      for (const a of relAcesso.filter((x) => !x.ok)) {
        console.log(`    rumo ${a.g.toFixed(0).padStart(3)}: para em r ${a.rFeito.toFixed(0)}, ${(a.rAlvo - a.rFeito).toFixed(0)} m ate a avenida (baia)`)
      }
    }
    console.log(`  trevos de acesso: ${chegouAN7.size} radiais x 2 ramos, recuo ${RECUO_TREVO} m, abertura ${ABERTURA}°`)
  }
  // autopistas: correm SOB a cidade, não se recortam
  let au = ''
  for (const a of (malha.autopistas ?? [])) {
    const ru = (a.rumo * Math.PI) / 180, off = a.afastamento, L = 9050
    const dx = Math.sin(ru), dz = -Math.cos(ru), nx = Math.cos(ru), nz = Math.sin(ru)
    au += `M${mundoPx(nx * off - dx * L).toFixed(1)} ${mundoPx(nz * off - dz * L).toFixed(1)}`
        + `L${mundoPx(nx * off + dx * L).toFixed(1)} ${mundoPx(nz * off + dz * L).toFixed(1)}`
  }
  corpo += `<g clip-path="url(#casca)"><path d="${au}" fill="none" stroke="#7FB9D4" `
    + `stroke-width="${lg(30).toFixed(2)}" opacity="0.45" stroke-dasharray="${14 * F} ${10 * F}"/></g>\n`
}

// 4. a casca da abóbada
corpo += `<circle cx="${LADO / 2}" cy="${LADO / 2}" r="${rDomePx.toFixed(1)}" fill="none" stroke="#F7931A" stroke-width="2.5" opacity="0.55" stroke-dasharray="14 10"/>\n`

// ── a mobília cartográfica ─────────────────────────────────────────────────
// ⚠️ É ELA QUE SEPARA GRÁFICO DE PEÇA. Sem escala não dá para medir, sem norte
// não dá para se orientar, sem legenda a cor não quer dizer nada, e sem lugar
// nomeado ninguém reconhece a própria cidade. Nesta casa a régua é "escritório
// top para um sheik", não "chapa de diagnóstico".
// ⚠️ TODO TEXTO PASSA POR ESCAPE, e a falta disso derrubou a carta inteira uma
// vez: bastou um "&" cru no subtítulo do cartucho para o parser XML abortar em
// `xmlParseEntityRef: no name` e engolir TUDO que vinha depois — as duas
// legendas, a escala, o norte e a rosa. O SVG não avisa: ele renderiza até o
// erro e o resto some em silêncio, o que faz parecer que a legenda "não foi
// gerada". Escapar na função que desenha texto fecha a porta para sempre.
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (x, y, txt, o = {}) => `<text x="${x}" y="${y}" fill="${o.cor || '#E4D2B9'}" `
  + `font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${(o.tam || 22) * F}" `
  + `letter-spacing="${(o.esp ?? 3) * F}" opacity="${o.op ?? 1}" `
  + `text-anchor="${o.anc || 'start'}">${esc(txt)}</text>`

// os lugares, em coordenada de mundo
// ⚠️ NOME É O QUE FAZ ALGUÉM RECONHECER A PRÓPRIA CIDADE. Quatro topônimos
// bastavam quando a carta era só relevo; com bairro, orla e alça desenhados, o
// leitor precisa saber como se chama o que está vendo. Os rumos vêm da geometria
// já decidida: a alça no meio do arco (51,25°), a orla na margem da cidade.
const LUGARES = [
  [0, 0, 'SATOSHI PLAZA', 'middle'],
  [4815, -3589, 'THE BAY', 'middle'],
  [8048, -8630, 'RUNESTONE PARK', 'middle'],
  [-508, 11188, 'SPACEPORT', 'middle'],
  [5420, -4360, 'THE SPIT', 'middle'],
  [3180, -2480, 'BAY SHORE', 'middle'],
  // ⚠️ O TOPÔNIMO PASSOU A DIZER O TIER, e não o apelido do anel. Com o painel
  // "WHO LIVES WHERE" nomeando os oito, o rótulo no terreno que dizia "INNER
  // FABRIC" obrigava o leitor a voltar ao painel para descobrir de quem era
  // aquele cinza. Quem abre a carta pergunta onde ELE mora; o nome responde.
  [-2450, 1180, 'DIAMOND PAWS', 'middle'],
  [-4180, 2900, 'THE GROUP', 'middle'],
  [-3100, 5980, 'EVERY OTHER HOLDER', 'middle'],
]

// ⚠️ AS ÂNCORAS ENTRAM COMO PONTO NOMEADO, NUNCA COMO POLÍGONO DE LOTE, e a
// distinção é o que torna a peça publicável. O programa da cidade existe (71
// peças, 16,95 km²), mas as posições dele vêm de uma grade ANTERIOR, que não
// seguia o dodecágono até o fim — o próprio fundador registrou isso. Desenhar a
// área exata de cada uma num material de divulgação seria afirmar um endereço
// que ainda vai mudar, e material de divulgação é promessa: alguém mede depois e
// cobra. Ponto nomeado diz a verdade que já é firme ("a cidade tem arena, golfe,
// universidade") sem afirmar a que ainda não é.
const ANCORAS = [
  [1038, 6662, 'GOLF COURSE'],
  [2506, 628, 'CENTRAL PARK'],
  [-861, 2406, 'OLYMPIC PARK'],
  [1976, 2408, 'DOG DERBY'],
  [-1909, 1416, 'FINANCIAL DISTRICT'],
  [-699, -1954, 'COHORT GARDENS'],
  [2106, 1728, '$DOG ARENA'],
  [1663, 1111, 'DOG UNIVERSITY'],
  [-1192, 1452, 'CITY HALL'],
  [-1186, -1599, 'LOST DOG MEMORIAL'],
  [482, 1923, 'DOG DATA HQ'],
  [-776, 1641, 'RUNE MUSEUM'],
]
let mob = ''
for (const [x, z, nome, anc] of LUGARES) {
  const px0 = mundoPx(x), py0 = mundoPx(z)
  mob += `<circle cx="${px0.toFixed(0)}" cy="${py0.toFixed(0)}" r="${4 * F}" fill="#F7931A"/>`
  // ⚠️ O RÓTULO SOBE OU DESCE PARA NÃO SAIR DA MOLDURA. O spaceport fica a
  // 11.188 m ao sul, quase na borda do recorte de 12.000, e o nome dele saía
  // cortado pela moldura na primeira geração.
  const perto = py0 > LADO - 140 * F
  // ⚠️ TOPÔNIMO DE BAIRRO PRECISA DE HALO. Ele cai ora sobre pedra clara, ora
  // sobre ardósia, e em monoespaçada fina o mesmo creme some numa e grita na
  // outra. O contorno escuro por baixo é o que faz o nome ler igual em qualquer
  // mancha, e é o que carta impressa faz desde sempre.
  const yTxt = perto ? py0 - 30 * F : py0 - 16 * F
  mob += `<text x="${px0}" y="${yTxt}" fill="#F5E9D6" stroke="#14100A" stroke-width="${4 * F}" `
    + `paint-order="stroke" stroke-linejoin="round" opacity="0.9" `
    + `font-family="'JetBrains Mono', ui-monospace, monospace" font-size="${19 * F}" `
    + `letter-spacing="${4 * F}" text-anchor="${anc}">${esc(nome)}</text>`
}
// as âncoras do programa: marca pequena e rótulo discreto, para não competir
// com os topônimos de bairro
for (const [x, z, nome] of ANCORAS) {
  const px0 = mundoPx(x), py0 = mundoPx(z)
  mob += `<circle cx="${px0.toFixed(0)}" cy="${py0.toFixed(0)}" r="${2.6 * F}" fill="none" `
    + `stroke="#F5E9D6" stroke-width="${1.4 * F}" opacity="0.85"/>`
  mob += T(px0 + 9 * F, py0 + 5 * F, nome, { tam: 13, cor: '#EFE3CE', esp: 2.4, op: 0.9 })
}

// a moldura
const m = 54 * F
// ⚠️ PAINEL ATRÁS DO TEXTO. O terreno claro come tipografia clara, e o cartucho
// ficava ilegível sobre a banda alta. Um véu escuro de baixa opacidade resolve
// sem tapar o mapa.
const veu = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0A0A0B" opacity="0.55"/>`
mob += veu(m, m, 620 * F, 148 * F)
mob += `<rect x="${m}" y="${m}" width="${LADO - 2 * m}" height="${LADO - 2 * m}" fill="none" stroke="#E4D2B9" stroke-width="${1.5 * F}" opacity="0.28"/>`
// o cartucho
mob += T(m + 26 * F, m + 52 * F, 'DOGCITY', { tam: 44, esp: 10, cor: '#F5E9D6' })
mob += T(m + 26 * F, m + 88 * F, 'MARE TRANQUILLITATIS · THE MOON', { tam: 18, esp: 5, op: 0.72 })
mob += T(m + 26 * F, m + 116 * F, (BAIRROS || VIAS ? `CITY PLAN · ${PASSO} M CONTOUR · NEIGHBOURHOODS & NETWORK` : `HYPSOMETRIC CHART · ${PASSO} M CONTOUR · ${MESTRA} M INDEX`), { tam: 15, esp: 4, op: 0.5 })
// ── QUEM MORA ONDE: a legenda de tier ──────────────────────────────────────
// ⚠️ A LEGENDA DE COR DIZIA O NOME DO BAIRRO, NÃO QUEM VIVE NELE. Para uma carta
// de trabalho isso basta; para material de divulgação não, porque a pergunta que
// o leitor traz é uma só: "onde EU vou morar". Este painel responde ligando cada
// mancha ao tier que a ocupa.
//
// ⚠️ E ELE DIZ QUEM, NUNCA QUANTOS. Contagem de carteira e posição são saídas do
// snapshot, e material publicado vira promessa. O tier é um critério já público e
// auditável; o número de lotes de cada bairro não é, e não entra aqui.
const px2 = m + 26 * F
let py2 = m + 178 * F
// ⚠️ O VÉU TEM DE CABER A LINHA MAIS LONGA, e não a média. "from 20k DOG ·
// oldest UTXO sits closer in" são 40 caracteres em monoespaçada com espacejamento:
// com 620 de largura a frase saía por fora do painel e terminava em cima do
// terreno, ilegível justamente na linha que explica a regra de posição.
mob += veu(m, py2 - 30 * F, 700 * F, 300 * F)
mob += T(px2, py2, 'WHO LIVES WHERE', { tam: 14, esp: 4, cor: '#F7931A', op: 0.95 })
py2 += 30 * F
// ⚠️ UMA LINHA POR TIER, e não uma por bairro. O painel dizia "THE SPIT · FRONT
// — Satoshi Visionary · BTC Maximalist": dois tiers numa cor só, quando a
// posição deles dentro da alça está fechada e é DIFERENTE (§3.2: Visionary no
// centro do arco, Maximalist nos flancos). O mesmo valia para a frente d'água.
// A carta agora pinta os oito, e o painel é a chave deles.
const TIERS_LEG = [
  [TIER_COR.t1, TIER_OP.t1, '1 · SATOSHI VISIONARY', 'the spit · front row, centre of the arc'],
  [TIER_COR.t2, TIER_OP.t2, '2 · BTC MAXIMALIST', 'the spit · front row, both flanks'],
  [TIER_COR.t3, TIER_OP.t3, '3 · RUNE MASTER', 'the spit · back row'],
  [TIER_COR.t4, TIER_OP.t4, '4 · ORDINAL BELIEVER', 'waterfront · facing the water'],
  [TIER_COR.t5, TIER_OP.t5, '5 · DOG SUPPORTER', 'waterfront · behind the shore road'],
  [TIER_COR.t6, TIER_OP.t6, '6 · DIAMOND PAWS', 'inner fabric · by how the wallet is used'],
  [TIER_COR.g20, TIER_OP.g20, '7 TO 12 · THE GROUP', 'from 20k DOG · oldest UTXO sits closer in'],
  [TIER_COR.g00, TIER_OP.g00, 'EVERY OTHER HOLDER', 'under 20k DOG · outskirts, no ranking'],
]
// ⚠️ O QUADRADINHO É PINTADO COMO A MANCHA, sobre um fundo de terreno e com a
// mesma opacidade. A versão anterior mostrava a cor PURA: no painel o tier 6 era
// pedra clara, no mapa saía compondo com a banda hipsométrica e virava outro
// tom. Chave que não bate com o mapa é pior que chave nenhuma, porque o leitor
// procura a cor errada.
for (const [cor, op, bairro, quem] of TIERS_LEG) {
  mob += `<rect x="${px2}" y="${py2 - 10 * F}" width="${13 * F}" height="${13 * F}" fill="#6F5C45"/>`
  mob += `<rect x="${px2}" y="${py2 - 10 * F}" width="${13 * F}" height="${13 * F}" fill="${cor}" opacity="${op}"/>`
  mob += T(px2 + 22 * F, py2, bairro, { tam: 13, esp: 2.6, cor: '#F0E4D0', op: 0.95 })
  mob += T(px2 + 268 * F, py2, quem, { tam: 12, esp: 1.6, cor: '#C9B99E', op: 0.85 })
  py2 += 25 * F
}
mob += T(px2, py2 + 6 * F, 'AIRDROP BEHAVIOUR DECIDES THE DISTRICT · WALLET AGE DECIDES THE STREET',
  { tam: 11, esp: 1.8, op: 0.5 })
// ⚠️ A CARTA É PRÉ-SNAPSHOT E TEM DE DIZER ISSO. Ela mostra ONDE cada tier mora,
// que é regra fechada; não mostra lote de ninguém, porque lote é saída do bloco
// 966.670. Publicada sem esta linha, um holder lê a mancha do tier dele como
// endereço prometido. O número já é público (o countdown da landing usa ele).
mob += T(px2, py2 + 26 * F, 'PLAN BEFORE THE SNAPSHOT · EVERY WALLET IS PLACED AT BLOCK 966,670',
  { tam: 11, esp: 1.8, cor: '#F7931A', op: 0.72 })

// a escala
const kmPx = mundoPx(1000) - mundoPx(0)
const bx = m + 26 * F, by = LADO - m - 44 * F
let barra = ''
for (let k = 0; k < 5; k++) {
  barra += `<rect x="${bx + k * kmPx}" y="${by}" width="${kmPx}" height="${9 * F}" `
    + `fill="${k % 2 ? '#0A0A0B' : '#E4D2B9'}" stroke="#E4D2B9" stroke-width="${1 * F}" opacity="0.85"/>`
}
mob += barra + T(bx, by - 12 * F, '0', { tam: 14, op: 0.7, anc: 'middle' })
  + T(bx + 5 * kmPx, by - 12 * F, '5 KM', { tam: 14, op: 0.7, anc: 'middle' })
// o norte
const nx = LADO - m - 60 * F, ny = m + 92 * F
mob += `<path d="M${nx} ${ny - 42 * F}L${nx + 13 * F} ${ny + 12 * F}L${nx} ${ny}L${nx - 13 * F} ${ny + 12 * F}Z" fill="#E4D2B9" opacity="0.9"/>`
  + T(nx, ny + 34 * F, 'N', { tam: 20, anc: 'middle', op: 0.9 })
// a legenda
// ⚠️ A CAIXA CRESCE COM O NÚMERO DE VERBETES, e ela já estourou uma vez: ao
// entrar o viaduto, a linha de RELIEF saiu por baixo do véu.
const N_VERBETES = 12 + (an7TemTunel ? 1 : 0)
const ALT_LEG = (N_VERBETES * 26 + 80) * F
const lx = LADO - m - 260 * F, ly = LADO - m - ALT_LEG
mob += veu(lx - 22 * F, ly - 34 * F, 282 * F, ALT_LEG)
// ⚠️ A LEGENDA CRESCEU COM A PEÇA. Enquanto a carta era só relevo, três linhas
// bastavam. Com bairro e via na folha, cor sem verbete é decoração: quem abre o
// mapa tem de saber que laranja é a alça e que a hachura é terra do projeto.
const LIN = 26 * F
let yy = ly
const verbete = (rot, pinta) => { const t = T(lx, yy, rot, { tam: 13, esp: 3, op: 0.78 }) + pinta(yy); yy += LIN; return t }
const chip = (cor, op = 1) => (y) => `<rect x="${lx + 196 * F}" y="${y - 11 * F}" width="${34 * F}" height="${12 * F}" fill="${cor}" opacity="${op}"/>`
const tracinho = (cor, w, dash) => (y) => `<line x1="${lx + 196 * F}" y1="${y - 5 * F}" x2="${lx + 230 * F}" y2="${y - 5 * F}" stroke="${cor}" stroke-width="${w * F}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
// ⚠️ A COR DE TIER SAIU DAQUI. Ela estava nos dois painéis, e dois painéis com a
// mesma informação obrigam o leitor a conferir se dizem a mesma coisa. O painel
// "WHO LIVES WHERE" é a chave das cores; esta legenda é a chave dos SÍMBOLOS.
mob += verbete('WATER', chip(AGUA_RASO))
mob += verbete('BEACH', chip('#A69B80', 0.75))
mob += verbete('CIVIC CORE', chip('#A79C89', 0.8))
mob += verbete('PROJECT LAND', chip('url(#hach)', 0.9))
mob += verbete('AN7 · PERIMETER', tracinho('#FFF2DC', 6))
mob += verbete('SHORE ROAD', tracinho('#F0E2C8', 4))
mob += verbete('BOULEVARDS', tracinho('#F0E2C8', 3.6))
mob += verbete('FRONTAGE ROAD', tracinho('#F0E2C8', 2.6))
mob += verbete('STREETS', tracinho('#F0E2C8', 1.6))
mob += verbete('BRIDGE', tracinho('#F0E2C8', 2.5, `${7 * F} ${5 * F}`))
mob += verbete('VIADUCT', (y) => `<line x1="${lx + 196 * F}" y1="${y - 5 * F}" x2="${lx + 230 * F}" y2="${y - 5 * F}" stroke="#FFF2DC" stroke-width="${6 * F}"/>`
  + [0, 1, 2].map((i) => `<line x1="${lx + (203 + i * 10) * F}" y1="${y - 10 * F}" x2="${lx + (203 + i * 10) * F}" y2="${y}" stroke="#FFF2DC" stroke-width="${1.4 * F}"/>`).join(''))
// ⚠️ VERBETE DE OBRA QUE NÃO EXISTE É RUÍDO. Com o greide em envelope superior a
// AN7 zerou o túnel; a linha só volta se uma geração futura voltar a escavar.
if (an7TemTunel) mob += verbete('AN7 · TUNNEL', (y) => `<line x1="${lx + 196 * F}" y1="${y - 5 * F}" x2="${lx + 230 * F}" y2="${y - 5 * F}" stroke="#FFF2DC" stroke-width="${6 * F}"/>`
  + `<line x1="${lx + 196 * F}" y1="${y - 5 * F}" x2="${lx + 230 * F}" y2="${y - 5 * F}" stroke="#3B3327" stroke-width="${6 * F}" stroke-dasharray="${4 * F} ${3.5 * F}"/>`)
mob += verbete('EXPRESSWAY', tracinho('#7FB9D4', 2.5, `${10 * F} ${7 * F}`))
mob += verbete('DOME', tracinho('#F7931A', 2.5, `${10 * F} ${7 * F}`))
mob += T(lx, yy + 6 * F, `RELIEF ${meta.min.toFixed(0)} TO ${meta.max.toFixed(0)} M`, { tam: 12, esp: 2, op: 0.55 })
mob += T(LADO - m - 26 * F, LADO - m - 26 * F, 'DOG DATA', { tam: 15, esp: 5, op: 0.5, anc: 'end' })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
${ESTILO}
<rect width="${LADO}" height="${LADO}" fill="${FUNDO}"/>
${corpo}${mob}</svg>`
writeFileSync(`${SAI}/mapa-topo.svg`, svg)
console.log(`mapa-topo.svg: ${(svg.length / 1e6).toFixed(2)} MB`)
console.log(`  ${niveis.length} niveis de ${min} a ${max} m, passo ${PASSO}, mestra ${MESTRA}`)
console.log(`  celula ${meta.celulaM.toFixed(1)} m, lado ${LADO} px para ${2 * RAIO} m = ${(2 * RAIO / LADO).toFixed(1)} m/px`)
