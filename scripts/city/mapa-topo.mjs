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

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=')
const ENT = arg('entrada', '/tmp/topo')
const SAI = arg('saida', '/tmp/topo')
const LADO = +arg('lado', 2400)          // o SVG, em px
const PASSO = +arg('passo', 20)          // curva fina, em metros
const MESTRA = +arg('mestra', 100)       // curva mestra, em metros

const meta = JSON.parse(readFileSync(`${ENT}/topo.json`, 'utf8'))
const N = meta.n, RAIO = meta.raio
const buf = readFileSync(`${ENT}/topo.f32`)
const H = new Float32Array(N * N)
for (let i = 0; i < N * N; i++) H[i] = buf.readFloatLE(i * 4)

const COTA_AGUA = +arg('agua', -40)
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

// 4. a casca da abóbada
corpo += `<circle cx="${LADO / 2}" cy="${LADO / 2}" r="${rDomePx.toFixed(1)}" fill="none" stroke="#F7931A" stroke-width="2.5" opacity="0.55" stroke-dasharray="14 10"/>\n`

// ── a mobília cartográfica ─────────────────────────────────────────────────
// ⚠️ É ELA QUE SEPARA GRÁFICO DE PEÇA. Sem escala não dá para medir, sem norte
// não dá para se orientar, sem legenda a cor não quer dizer nada, e sem lugar
// nomeado ninguém reconhece a própria cidade. Nesta casa a régua é "escritório
// top para um sheik", não "chapa de diagnóstico".
const F = LADO / 2400                                  // fator, para o desenho escalar junto
const T = (x, y, txt, o = {}) => `<text x="${x}" y="${y}" fill="${o.cor || '#E4D2B9'}" `
  + `font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${(o.tam || 22) * F}" `
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
mob += T(m + 26 * F, m + 116 * F, `HYPSOMETRIC CHART · ${PASSO} M CONTOUR · ${MESTRA} M INDEX`, { tam: 15, esp: 4, op: 0.5 })
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
const lx = LADO - m - 260 * F, ly = LADO - m - 132 * F
mob += veu(lx - 22 * F, ly - 34 * F, 282 * F, 118 * F)
mob += T(lx, ly, 'WATER', { tam: 14, esp: 3, op: 0.75 })
  + `<rect x="${lx + 70 * F}" y="${ly - 11 * F}" width="${40 * F}" height="${12 * F}" fill="${AGUA_RASO}"/>`
  + `<rect x="${lx + 112 * F}" y="${ly - 11 * F}" width="${40 * F}" height="${12 * F}" fill="${AGUA_FUNDO}"/>`
  + T(lx, ly + 26 * F, 'DOME', { tam: 14, esp: 3, op: 0.75 })
  + `<line x1="${lx + 70 * F}" y1="${ly + 21 * F}" x2="${lx + 152 * F}" y2="${ly + 21 * F}" stroke="#F7931A" stroke-width="${2.5 * F}" stroke-dasharray="${10 * F} ${7 * F}"/>`
  + T(lx, ly + 52 * F, `RELIEF ${meta.min.toFixed(0)} TO ${meta.max.toFixed(0)} M`, { tam: 13, esp: 2, op: 0.55 })
mob += T(LADO - m - 26 * F, LADO - m - 26 * F, 'DOG DATA', { tam: 15, esp: 5, op: 0.5, anc: 'end' })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
<rect width="${LADO}" height="${LADO}" fill="${FUNDO}"/>
${corpo}${mob}</svg>`
writeFileSync(`${SAI}/mapa-topo.svg`, svg)
console.log(`mapa-topo.svg: ${(svg.length / 1e6).toFixed(2)} MB`)
console.log(`  ${niveis.length} niveis de ${min} a ${max} m, passo ${PASSO}, mestra ${MESTRA}`)
console.log(`  celula ${meta.celulaM.toFixed(1)} m, lado ${LADO} px para ${2 * RAIO} m = ${(2 * RAIO / LADO).toFixed(1)} m/px`)
