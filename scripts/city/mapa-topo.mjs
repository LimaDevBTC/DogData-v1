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
for (const [nivel, cor, op] of [[COTA_AGUA, AGUA_RASO, 1], [COTA_AGUA - 30, AGUA_FUNDO, 0.92]]) {
  corpo += `<path d="${disco}${d(contorno(nivel), true)}" fill="${cor}" fill-rule="evenodd" opacity="${op}"/>\n`
}
corpo += `<path d="${d(contorno(COTA_AGUA), false)}" fill="none" stroke="#7FB9D4" stroke-width="1.6" opacity="0.75"/>\n`
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

// ⚠️ A CIDADE TEM DUAS LÂMINAS, NÃO UMA, e a primeira carta esqueceu a segunda.
// A baía e os três canais radiais estão na cota -40. O Lago da Praça, o anel de
// água em volta do centro, foi SUBIDO para -6,5 em 02/09 (quando o barranco de
// 44 graus virou praia), e o leito dele fica em -14. Desenhando só -40, o mapa
// pintava o lago central como TERRA e as oito ilhas dele sumiam junto. Foi o
// fundador quem viu, olhando a carta.
const LAGO_LAMINA = +arg('lagoLamina', -6.5)
const rLagoPx = mundoPx(1480) - mundoPx(0)
const discoLago = `M${cx - rLagoPx} ${cy}a${rLagoPx} ${rLagoPx} 0 1 0 ${2 * rLagoPx} 0a${rLagoPx} ${rLagoPx} 0 1 0 ${-2 * rLagoPx} 0Z`
corpo += `<clipPath id="lago"><circle cx="${cx}" cy="${cy}" r="${rLagoPx.toFixed(1)}"/></clipPath>\n`
corpo += '<g clip-path="url(#lago)">\n'
corpo += `<path d="${discoLago}${d(contorno(LAGO_LAMINA), true)}" fill="${AGUA_RASO}" fill-rule="evenodd"/>\n`
corpo += `<path d="${d(contorno(LAGO_LAMINA), false)}" fill="none" stroke="#7FB9D4" stroke-width="1.6" opacity="0.75"/>\n`
corpo += '</g>\n'

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
      if (Math.hypot(x, z) <= 9050 && alturaEm(x, z) <= COTA_AGUA) agua[j * orlaNG + i] = 1
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
  const R_PRACA = +arg('rPraca', 960)
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
    + `<path d="${d(contorno(COTA_AGUA), true)}" clip-rule="evenodd"/></clipPath>\n`
  const zona = (dd, cor, op) => `<path d="${dd}" fill="${cor}" fill-rule="evenodd" opacity="${op}"/>`
  let manchas = ''
  manchas += zona(coroa(R_PRACA, R_T6), '#AA967A', 0.40)   // tier 6, Diamond Paws
  manchas += zona(coroa(R_T6, R_G20), '#706C62', 0.40)     // Grupo >= 20k
  manchas += zona(coroa(R_G20, R_PER), '#494640', 0.42)    // periferia < 20k
  // ⚠️ A TERRA DO PROJETO VAI EM HACHURA, NÃO EM CHAPADO. Pintada de azul ela
  // era lida como água: numa carta, área azul contínua é lâmina, e o olho não
  // negocia isso. Hachura diagonal é a convenção de "reservado" desde sempre.
  manchas += zona(coroa(R_PER, 9050), 'url(#hach)', 0.9)
  // a alça: praia, mansões de frente, via, mansões de trás, praia
  manchas += zona(setor(A_BAIA, A_BAIA + PRAIA_W, 346, 116.5), '#A69B80', 0.62)
  manchas += zona(setor(A_BAIA + PRAIA_W, VIA_R - VIA_W / 2, 346, 116.5), '#F2842E', 0.62)
  manchas += zona(setor(VIA_R + VIA_W / 2, A_MAR - PRAIA_W, 346, 116.5), '#C6641C', 0.62)
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
    orla += faixa(ORLA_FUNDO, '#B4763A', 0.44)                    // a faixa nobre inteira
    orla += faixa(ORLA_VIA_R + ORLA_VIA_W / 2, '#8C8578', 0.5)    // calçada e recuo
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
const VIAS = arg('vias', '0') !== '0'
if (VIAS) {
  const LIMD = +arg('decliveVia', 12)
  const LIMIAR_PONTE = +arg('ponte', 150)
  const LIMIAR_CANAL = +arg('ponteCanal', 200)   // 140 m de vão mais folga de talude
  const R0 = +arg('rMalha0', 1420), R1 = +arg('rMalha1', 6900)
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
  const trecho = (p0, p1, limiar) => {
    const comp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const n = Math.max(2, Math.ceil(comp / PASSO))
    let molhadoSeguido = 0, pior = 0, temPonte = false
    for (let t = 0; t <= n; t++) {
      const x = p0[0] + ((p1[0] - p0[0]) * t) / n, z = p0[1] + ((p1[1] - p0[1]) * t) / n
      const r = Math.hypot(x, z), g = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
      if (naAlca(r, g)) return null
      if (alturaEm(x, z) <= COTA_AGUA) {
        // canal atravessa-se sempre; o resto obedece ao limiar da classe
        const lim = sobreCanal(x, z) ? Math.max(limiar, LIMIAR_CANAL) : limiar
        molhadoSeguido += comp / n
        if (molhadoSeguido > lim) return null
        temPonte = true
      } else {
        molhadoSeguido = 0
        if (declEm(x, z) > LIMD) return null
      }
      pior = Math.max(pior, 0)
    }
    return { ponte: temPonte }
  }
  // ── nós e arestas ─────────────────────────────────────────────────────────
  const chave = (ia, ir) => ia * NR + ir
  const no = new Map()
  ANEIS.forEach((r, ia) => {
    for (let ir = 0; ir < NR; ir++) if (r >= nasceEm(ir) - 1e-6) no.set(chave(ia, ir), PNO(r, rumoDe(ir)))
  })
  const arestas = []
  const adj = new Map()
  const liga = (a, b, cls, ponte) => {
    const k = arestas.length
    arestas.push({ a, b, cls, ponte, viva: true })
    if (!adj.has(a)) adj.set(a, []); adj.get(a).push(k)
    if (!adj.has(b)) adj.set(b, []); adj.get(b).push(k)
  }
  // arestas de anel: entre rumos vizinhos QUE EXISTEM naquele anel
  ANEIS.forEach((r, ia) => {
    const vivos = []
    for (let ir = 0; ir < NR; ir++) if (no.has(chave(ia, ir))) vivos.push(ir)
    for (let t = 0; t < vivos.length; t++) {
      const a = chave(ia, vivos[t]), b = chave(ia, vivos[(t + 1) % vivos.length])
      // ⚠️ ANEL LOCAL NÃO GANHA PONTE. Com limiar de 150 m em toda aresta de
      // anel, a teia atravessava a baía em degraus: dezenas de pontinhas
      // paralelas sobre a água, que na carta lê como escada e não como cidade.
      // Ponte é obra de arte, e obra de arte é de via estrutural. Rua de bairro
      // encontra a lâmina e acaba ali, que é o que ela faz no 3D.
      const res = trecho(no.get(a), no.get(b), 0)
      if (res) liga(a, b, 'anel', res.ponte)
    }
  })
  // arestas radiais: entre anéis vizinhos
  for (let ir = 0; ir < NR; ir++) {
    for (let ia = 0; ia + 1 < ANEIS.length; ia++) {
      const a = chave(ia, ir), b = chave(ia + 1, ir)
      if (!no.has(a) || !no.has(b)) continue
      const res = trecho(no.get(a), no.get(b), classeDe(ir) === 'bulevar' ? LIMIAR_PONTE : 0)
      if (res) liga(a, b, classeDe(ir), res.ponte)
    }
  }
  // ⚠️ OS 12 BULEVARES SEGUEM ALÉM DO ÚLTIMO ANEL, senão a perimetral não tem o
  // que recolher: ela corre na borda, a teia para em R_FORA, e as duas nunca se
  // encontram. Prolongar só os bulevares (não a teia local) é o que uma cidade
  // faz — a via estrutural sai, a rua de bairro não.
  const IA_FIM = ANEIS.length - 1
  const PROLONGA = +arg('prolonga', 2200)
  for (let ir = 0; ir < NR; ir += NR / N_BASE) {
    const g = rumoDe(ir)
    let ant = chave(IA_FIM, ir)
    if (!no.has(ant)) continue
    for (let d = 120; d <= PROLONGA; d += 120) {
      const rr = raioNaFace(ANEIS[IA_FIM], g) + d
      if (rr > 9050) break
      const q = PXY(rr, g)
      const res = trecho(no.get(ant), q, LIMIAR_PONTE)
      if (!res) break
      // ⚠️ AQUI NÃO SE TOCA EM `pai`: o union-find ainda não existe neste ponto do
      // arquivo, e ele inicializa a partir de `no` logo abaixo. Registrar o nó
      // basta; tentar semeá-lo no `pai` quebra com "cannot access before
      // initialization", que é o erro que esta linha já causou uma vez.
      const k = 3e6 + ir * 100 + d
      no.set(k, q)
      liga(ant, k, 'bulevar', !!res.ponte)
      ant = k
    }
  }
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
        const seco = alturaEm(q[0], q[1]) > COTA_AGUA && declEm(q[0], q[1]) <= LIMD
        if (rq > 9050 || naAlca(rq, gq) || !seco) { anterior = null; continue }
        const k = base++
        no.set(k, q); pai.set(k, k); nosDaOrla.push(k); desteGrupo.push(k); nosOrla++
        if (anterior !== null) {
          const res = trecho(no.get(anterior), q, 0)
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
          const res = trecho(pa, pb, 0)
          if (res) { liga(A, B, 'orla', !!res.ponte); emendas++ }
        }
      }
      if (emendas) console.log(`  orla: ${emendas} emendas dentro da propria linha de costa`)
    }

    // ── A PERIMETRAL É A PRÓPRIA PISTA DA ORLA NOBRE ──────────────────────
    // ⚠️ EXISTE UMA VIA DE CONTORNO, NÃO DUAS. Decisão do fundador, e ela custou
    // três tentativas minhas para entrar: primeiro tracei uma perimetral na base
    // da abóbada, depois um segundo anel dentro da cidade, e nenhum dos dois era
    // o que ele pediu. O certo é o mais simples: a pista que corre a 140 m da
    // água na baía CONTINUA, dá a volta na cidade e volta nela mesma.
    //
    // ⚠️ E ELA SAI NO RAIO EM QUE A ORLA MORRE, chegando no raio da outra ponta.
    // A margem varia de r 3.500 a 6.500, então nem a mediana nem um raio fixo
    // descrevem as extremidades: traçada assim, a continuação não lia como
    // continuação de nada. Interpolando ponta a ponta, ela sai na direção em que
    // a pista vinha e chega na direção em que a pista recomeça.
    {
      const G0B = 358.5, G1B = 99.5
      const noArcoBaia = (g) => g >= G0B || g <= G1B
      const daBaia = []
      for (const k of nosDaOrla) {
        const q = no.get(k)
        const g = ((Math.atan2(q[0], -q[1]) * 180) / Math.PI + 360) % 360
        const r = Math.hypot(q[0], q[1])
        if (noArcoBaia(g) && r > 3000 && r < 6800) daBaia.push({ k, g, r })
      }
      if (daBaia.length > 20) {
        const ordB = [...daBaia].sort((a, b) => a.g - b.g)
        const pontaFim = ordB.filter((o) => o.g <= G1B).pop() ?? ordB[0]
        const pontaIni = ordB.filter((o) => o.g >= G0B)[0] ?? ordB[ordB.length - 1]
        const rFim = pontaFim.r, rIni = pontaIni.r
        const totalG = ((G0B - G1B) + 360) % 360
        const passoG = 0.6
        let ant = pontaFim.k, criados = 0, ultimo = null
        for (let g = G1B + passoG; g <= G1B + totalG - 1e-9; g += passoG) {
          const gg = g % 360
          const f = (g - G1B) / totalG
          // curva suave entre os dois raios, com folga no meio para a via não
          // encostar na Praça nem sair da terra plana
          const suave = f * f * (3 - 2 * f)
          const rr = rFim + (rIni - rFim) * suave
          const q = PXY(rr, gg)
          const seco = alturaEm(q[0], q[1]) > COTA_AGUA && declEm(q[0], q[1]) <= LIMD
          if (!seco || naAlca(rr, gg)) { ant = null; continue }
          const k = base++
          no.set(k, q); pai.set(k, k); nosOrla++; criados++
          if (ant !== null) {
            const res = trecho(no.get(ant), q, LIMIAR_PONTE)
            if (res) liga(ant, k, 'orla', !!res.ponte)
          }
          ant = k; ultimo = k
        }
        // fecha no outro extremo da pista da baía
        if (ultimo !== null) {
          const res = trecho(no.get(ultimo), no.get(pontaIni.k), LIMIAR_PONTE)
          if (res) liga(ultimo, pontaIni.k, 'orla', !!res.ponte)
        }
        console.log(`  perimetral (a propria pista da orla): sai de r ${rFim.toFixed(0)} no rumo ${pontaFim.g.toFixed(1)}, `
          + `chega em r ${rIni.toFixed(0)} no rumo ${pontaIni.g.toFixed(1)}, ${criados} nos`)
      }
    }

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
      const p0 = no.get(e.a), p1 = no.get(e.b)
      const comp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const n = Math.max(2, Math.ceil(comp / 25))
      let seguido = 0, pior = 0
      for (let t = 0; t <= n; t++) {
        const x = p0[0] + ((p1[0] - p0[0]) * t) / n, z = p0[1] + ((p1[1] - p0[1]) * t) / n
        if (alturaEm(x, z) <= COTA_AGUA) { seguido += comp / n; pior = Math.max(pior, seguido) }
        else seguido = 0
      }
      if (pior > 0) molhTotal++
      if (pior > VAO_MAX) { e.viva = false; cortadas++ }
    }
    console.log(`    via sobre agua: ${molhTotal} arestas molhadas, ${cortadas} cortadas por vao > ${VAO_MAX} m`)
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
      for (const k of [e.a, e.b]) if (grau.get(k) === 1) pontas.push(k)
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
      if (melhor !== null && dist <= FECHA_MAX) {
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
        if (grau.get(k) !== 1) continue
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
  const dPonte = dDe(vivas.filter((e) => e.ponte))
  corpo += `<g clip-path="url(#casca)">`
    // casing só nas largas: em rua de 1,7 px o contorno come a própria via
    + `<path d="${dAnelOrla}" fill="none" stroke="#14100A" stroke-width="${lg(92).toFixed(2)}" opacity="0.55" stroke-linecap="round"/>`
    + `<path d="${dBul}" fill="none" stroke="#14100A" stroke-width="${lg(66).toFixed(2)}" opacity="0.5" stroke-linecap="round"/>`
    + `<path d="${dLocal}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(15).toFixed(2)}" opacity="0.82" stroke-linecap="round"/>`
    + `<path d="${dRamal}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(26).toFixed(2)}" opacity="0.9" stroke-linecap="round"/>`
    + `<path d="${dBul}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(42).toFixed(2)}" opacity="0.92" stroke-linecap="round"/>`
    + `<path d="${dAnelOrla}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(60).toFixed(2)}" opacity="0.96" stroke-linecap="round"/>`
    + (dPonte ? `<path d="${dPonte}" fill="none" stroke="${VIA_COR}" stroke-width="${lg(24).toFixed(2)}" opacity="0.95" stroke-dasharray="${7 * F} ${5 * F}"/>` : '')
    + `</g>\n`
  // a AN7: a via da alça, exceção por decreto (a alça é terraplanagem)
  const an7 = []
  for (let g = 330; g <= 330 + ((120 - 330 + 360) % 360); g += 0.5) an7.push(PX(PXY(6950, g % 360)))
  corpo += `<path d="M${an7.join('L')}" fill="none" stroke="#14100A" stroke-width="${lg(72).toFixed(2)}" opacity="0.5" stroke-linecap="round"/>`
    + `<path d="M${an7.join('L')}" fill="none" stroke="#FFF2DC" stroke-width="${lg(44).toFixed(2)}" opacity="0.95" stroke-linecap="round"/>\n`
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
  [-2450, 1180, 'INNER FABRIC', 'middle'],
  [-4180, 2900, 'OUTER FABRIC', 'middle'],
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
  mob += T(px0, perto ? py0 - 30 * F : py0 - 16 * F, nome, { tam: 19, anc, cor: '#F5E9D6', esp: 4 })
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
mob += veu(m, py2 - 30 * F, 560 * F, 236 * F)
mob += T(px2, py2, 'WHO LIVES WHERE', { tam: 14, esp: 4, cor: '#F7931A', op: 0.95 })
py2 += 30 * F
const TIERS_LEG = [
  ['#F2842E', 'THE SPIT · FRONT', 'Satoshi Visionary · BTC Maximalist'],
  ['#C6641C', 'THE SPIT · BACK', 'Rune Master'],
  ['#B4763A', 'WATERFRONT', 'Ordinal Believer · DOG Supporter'],
  ['#AA967A', 'INNER FABRIC', 'Diamond Paws'],
  ['#706C62', 'OUTER FABRIC', 'holders from 20k DOG'],
  ['#494640', 'OUTSKIRTS', 'holders under 20k DOG'],
]
for (const [cor, bairro, quem] of TIERS_LEG) {
  mob += `<rect x="${px2}" y="${py2 - 10 * F}" width="${13 * F}" height="${13 * F}" fill="${cor}" opacity="0.9"/>`
  mob += T(px2 + 22 * F, py2, bairro, { tam: 13, esp: 2.6, cor: '#F0E4D0', op: 0.95 })
  mob += T(px2 + 246 * F, py2, quem, { tam: 12, esp: 1.6, cor: '#C9B99E', op: 0.85 })
  py2 += 25 * F
}
mob += T(px2, py2 + 6 * F, 'AIRDROP BEHAVIOUR DECIDES THE DISTRICT · WALLET AGE DECIDES THE STREET',
  { tam: 11, esp: 1.8, op: 0.5 })

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
const lx = LADO - m - 260 * F, ly = LADO - m - 470 * F
mob += veu(lx - 22 * F, ly - 34 * F, 282 * F, 470 * F)
// ⚠️ A LEGENDA CRESCEU COM A PEÇA. Enquanto a carta era só relevo, três linhas
// bastavam. Com bairro e via na folha, cor sem verbete é decoração: quem abre o
// mapa tem de saber que laranja é a alça e que a hachura é terra do projeto.
const LIN = 26 * F
let yy = ly
const verbete = (rot, pinta) => { const t = T(lx, yy, rot, { tam: 13, esp: 3, op: 0.78 }) + pinta(yy); yy += LIN; return t }
const chip = (cor, op = 1) => (y) => `<rect x="${lx + 196 * F}" y="${y - 11 * F}" width="${34 * F}" height="${12 * F}" fill="${cor}" opacity="${op}"/>`
const tracinho = (cor, w, dash) => (y) => `<line x1="${lx + 196 * F}" y1="${y - 5 * F}" x2="${lx + 230 * F}" y2="${y - 5 * F}" stroke="${cor}" stroke-width="${w * F}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
mob += verbete('WATER', chip(AGUA_RASO))
mob += verbete('BEACH', chip('#A69B80', 0.75))
mob += verbete('SPIT · FRONT', chip('#F2842E', 0.85))
mob += verbete('SPIT · BACK', chip('#C6641C', 0.85))
mob += verbete('WATERFRONT', chip('#B4763A', 0.8))
mob += verbete('INNER FABRIC', chip('#AA967A', 0.65))
mob += verbete('OUTER FABRIC', chip('#706C62', 0.7))
mob += verbete('OUTSKIRTS', chip('#494640', 0.8))
mob += verbete('PROJECT LAND', chip('url(#hach)', 0.9))
mob += verbete('SHORE ROAD', tracinho('#F0E2C8', 6))
mob += verbete('BOULEVARDS', tracinho('#F0E2C8', 3.6))
mob += verbete('STREETS', tracinho('#F0E2C8', 1.6))
mob += verbete('BRIDGE', tracinho('#F0E2C8', 2.5, `${7 * F} ${5 * F}`))
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
