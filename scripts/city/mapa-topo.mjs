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
function contorno(nivel) {
  const segs = []
  const t = (a, b) => (nivel - a) / (b - a || 1e-9)
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
  // a orla da baía: os tiers 4 e 5, faixa junto à margem no arco da baía
  manchas += zona(setor(+arg('orlaR0', 4800), +arg('orlaR1', 5700), 358.5, 99.5), '#CB8A3C', 0.42)
  corpo += `<g clip-path="url(#terra)">${manchas}</g>\n`
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
  const PXY = (r, g) => { const a = (g * Math.PI) / 180; return [Math.sin(a) * r, -Math.cos(a) * r] }
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
    for (let ir = 0; ir < NR; ir++) if (r >= nasceEm(ir) - 1e-6) no.set(chave(ia, ir), PXY(r, rumoDe(ir)))
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
  // ── componente conexo: só a maior rede fica ───────────────────────────────
  const pai = new Map()
  const acha = (a) => { while (pai.get(a) !== a) { pai.set(a, pai.get(pai.get(a))); a = pai.get(a) } return a }
  for (const k of no.keys()) pai.set(k, k)
  for (const e of arestas) { const ra = acha(e.a), rb = acha(e.b); if (ra !== rb) pai.set(ra, rb) }
  const peso = new Map()
  for (const e of arestas) {
    const r = acha(e.a), p0 = no.get(e.a), p1 = no.get(e.b)
    peso.set(r, (peso.get(r) ?? 0) + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
  }
  let raiz = null, maior = -1
  for (const [r, v] of peso) if (v > maior) { maior = v; raiz = r }
  const total = [...peso.values()].reduce((a, b) => a + b, 0)
  for (const e of arestas) if (acha(e.a) !== raiz) e.viva = false
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
        e.viva = false; podadas++; mexeu = true; break
      }
    }
    if (!mexeu) break
  }
  const vivas = arestas.filter((e) => e.viva)
  const kmVivo = vivas.reduce((acc, e) => {
    const p0 = no.get(e.a), p1 = no.get(e.b)
    return acc + Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
  }, 0)
  console.log(`  malha gerada: ${no.size} nos, ${arestas.length} arestas candidatas`)
  console.log(`    conexo: ${(maior / 1000).toFixed(1)} km de ${(total / 1000).toFixed(1)} (${((100 * maior) / total).toFixed(1)}%)`)
  console.log(`    poda de grau 1: ${podadas} arestas; rede final ${(kmVivo / 1000).toFixed(1)} km em ${vivas.length} arestas`)
  // ── desenho ───────────────────────────────────────────────────────────────
  const PX = (q) => `${mundoPx(q[0]).toFixed(1)} ${mundoPx(q[1]).toFixed(1)}`
  const dDe = (lista) => lista.map((e) => `M${PX(no.get(e.a))}L${PX(no.get(e.b))}`).join('')
  const lg = (m) => Math.max(0.6 * F, (m / (2 * RAIO)) * LADO)
  const dLocal = dDe(vivas.filter((e) => e.cls === 'local' || e.cls === 'anel'))
  const dBul = dDe(vivas.filter((e) => e.cls === 'bulevar'))
  const dPonte = dDe(vivas.filter((e) => e.ponte))
  corpo += `<g clip-path="url(#casca)">`
    + `<path d="${dLocal}" fill="none" stroke="#20190F" stroke-width="${lg(14).toFixed(2)}" opacity="0.38" stroke-linecap="round"/>`
    + `<path d="${dBul}" fill="none" stroke="#14100A" stroke-width="${lg(66).toFixed(2)}" opacity="0.55" stroke-linecap="round"/>`
    + `<path d="${dBul}" fill="none" stroke="#F0E2C8" stroke-width="${lg(40).toFixed(2)}" opacity="0.92" stroke-linecap="round"/>`
    + (dPonte ? `<path d="${dPonte}" fill="none" stroke="#F5E9D6" stroke-width="${lg(26).toFixed(2)}" opacity="0.95" stroke-dasharray="${7 * F} ${5 * F}"/>` : '')
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
const T = (x, y, txt, o = {}) => `<text x="${x}" y="${y}" fill="${o.cor || '#E4D2B9'}" `
  + `font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${(o.tam || 22) * F}" `
  + `letter-spacing="${(o.esp ?? 3) * F}" opacity="${o.op ?? 1}" `
  + `text-anchor="${o.anc || 'start'}">${txt}</text>`

// os lugares, em coordenada de mundo
const LUGARES = [
  [0, 0, 'SATOSHI PLAZA', 'middle'],
  [4815, -3589, 'THE BAY', 'middle'],
  [8048, -8630, 'RUNESTONE PARK', 'middle'],
  [-508, 11188, 'SPACEPORT', 'middle'],
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
mob += T(m + 26 * F, m + 116 * F, (BAIRROS || VIAS ? `CITY PLAN · ${PASSO} M CONTOUR · 168 RADIALS · 26 RINGS` : `HYPSOMETRIC CHART · ${PASSO} M CONTOUR · ${MESTRA} M INDEX`), { tam: 15, esp: 4, op: 0.5 })
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
const lx = LADO - m - 260 * F, ly = LADO - m - 366 * F
mob += veu(lx - 22 * F, ly - 34 * F, 282 * F, 366 * F)
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
mob += verbete('BAY SHORE', chip('#CB8A3C', 0.7))
mob += verbete('INNER FABRIC', chip('#AA967A', 0.65))
mob += verbete('OUTER FABRIC', chip('#706C62', 0.7))
mob += verbete('OUTSKIRTS', chip('#494640', 0.8))
mob += verbete('PROJECT LAND', chip('url(#hach)', 0.9))
mob += verbete('STREETS', tracinho('#F0E2C8', 3))
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
