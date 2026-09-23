#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A CARTA CARTOGRÁFICA DA DOGCITY, a imagem oficial da cidade selada.
//
// Substitui public/landing/citymap-1600-v2.webp (13/09), que mostrava uma cidade
// que não existe mais: anéis de tier, sem Orla da Baía, sem columbário, sem os
// 70.709 lotes do bloco 966.670. Esta peça é desenhada A PARTIR DO REGISTRO
// SELADO e da superfície como construída, nunca de um número copiado à mão.
//
//   node scripts/city/carta.mjs              # SVG + PNG 1600 + PNG 3200 + WebP
//   node scripts/city/carta.mjs --so-svg=1   # só o vetor, para iterar rápido
//
// FONTES (leitura, nunca escrita):
//   data/superficie.f32 + .json      o chão COMO CONSTRUÍDO, 1600x1600, ±12 km
//   public/city/cidade-malha.json    os 2.071 quarteirões (centro, giro, lado, prof)
//   public/city/cidade-lotes.bin     os lotes das três orlas especiais (S07/S08/S09)
//   public/city/cidade.json          programa congelado, contagens, nomes
//   public/city/mapa-v1.json         avenidas, anéis viários, alça, Founders Club
//   data/dogcity_merkle.json         bloco, root, lotes, lápides do cartucho
//
// ⚠️ O QUARTEIRÃO É A UNIDADE, NÃO O LOTE. 70.709 lotes num quadrado de 1.600 px
// (4,6 m por pixel) viram textura, e textura mente: parece detalhe e não é. A
// carta desenha os 2.071 quarteirões do tecido como polígonos cheios, e a rua
// aparece em NEGATIVO, o vão escuro entre eles. As três orlas especiais (Orla
// Nobre, Distrito Financeiro, Orla da Baía) não têm quarteirão na malha: ali os
// lotes são fundidos (preenchimento sem traço, com 0,8 m de folga) para que o
// olho leia a fileira e não a divisa.
//
// ⚠️ A VERDADE DO PROGRAMA É cidade.json, NÃO mapa-v1.json. Medido em 23/09
// contando lotes dentro de cada polígono: os 70 do mapa-v1 têm CENTENAS de lotes
// dentro (o gerador não os reservou; IN08 tem 402, B03 tem 413), os 76 do
// cidade.json têm zero (D01 tem 1) e as 7 âncoras têm zero nas duas listas.
// Desenhar mapa-v1 pintaria "terra do projeto" em cima de lote de holder.
//
// ⚠️ OS ANÉIS AN1 A AN6 SÃO DODECÁGONOS e `aneisViarios[].r` é o VÉRTICE: a face
// fica em r·cos(15°) = 96,6%. Os vértices caem nas 12 avenidas (teia.ts). A AN7 é
// a ÚNICA circular (r 6.950, arco 330° a 120°), sobre a alça.
//
// ⚠️ A LARGURA DESENHADA DAS VIAS É SIMBÓLICA, e menor que a seção publicada.
// Os 44 m da avenida de distrito são a SEÇÃO (calçada, canteiro), não o asfalto
// (6 a 10 m). E o registro selado não recuou dos anéis: medido em 23/09, há
// cantos de lote a 0,0 m da aresta dos dodecágonos AN1 a AN6 e a 0,1 m do eixo
// da avenida de rumo 30. Traçar 44 m cobriria fileiras inteiras. A via vai como
// linha de carta (10 a 24 m), por cima do tecido, que é o que ela é aqui.
//
// ⚠️ ÁGUA É TUDO ABAIXO DE -40 m NA SUPERFÍCIE, e só dentro da casca (r 9.050).
// Fora dela é regolito seco. Sem o recorte, os cantos altos do quadro saem
// pintados de azul (armadilha paga no mapa-topo, ver lá).
//
// ⚠️ TODO TEXTO QUE APARECE NA PEÇA É EM INGLÊS (regra do fundador, 02/09). O
// comentário continua em português. Nada de travessão, em lugar nenhum.
//
// ⚠️ A RASTERIZAÇÃO É PELO CHROMIUM DO PLAYWRIGHT, sem janela. O sharp desta
// instalação usa librsvg, que ignora @font-face embutido e textPath: o letreiro
// sairia em DejaVu e os rótulos curvos sumiriam. O Chromium honra os dois. O
// sharp entra só depois, para converter PNG em WebP.
//
// ⚠️ DIREÇÃO DE ARTE FECHADA EM 23/09 (marketing/CARTA-BRIEF.md), depois de um
// teste A/B/C de variantes de estilo julgado pela chapa. A base é a variante
// A (atmosfera da v2: curva de nível atravessando a cidade, malha creme densa,
// banda da alça com degradê), enxertada com três achados da variante B (halo
// escuro em todo rótulo, borda creme nos lotes fundidos das três orlas, água
// em três profundidades com hachura de margem) e um da C (os números do
// cartucho em destaque). Nada disto mexe em geometria, dado ou cartucho: é só
// a camada de estilo, igual às variantes que a geraram.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '../..')
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=')

const LADO = 1600                       // o SVG, em unidades; o PNG sai em 1x e 2x
const QUADRO = +arg('quadro', 7400)     // meio-lado do enquadramento, em metros
const SO_SVG = arg('so-svg', '0') !== '0'
const DEG = Math.PI / 180
const ESC = LADO / (2 * QUADRO)         // px por metro
// mundo -> px. x cresce para leste e z para o sul; o y do SVG cresce para baixo,
// então os dois eixos usam a mesma função sem giro. Praça no (0,0) = centro.
const mPx = (m) => (m + QUADRO) * ESC
const pt = (x, z) => `${mPx(x).toFixed(1)} ${mPx(z).toFixed(1)}`
// rumo de bússola: 0 = norte (-z), cresce para leste (+x)
const doRumo = (r, rumo) => [r * Math.sin(rumo * DEG), -r * Math.cos(rumo * DEG)]
const rumoDe = (x, z) => ((Math.atan2(x, -z) / DEG) + 360) % 360
const noArco = (rumo, [a, b]) => (a <= b ? rumo >= a && rumo <= b : rumo >= a || rumo <= b)

// ── as fontes ───────────────────────────────────────────────────────────────
const ler = (p) => JSON.parse(readFileSync(resolve(RAIZ, p), 'utf8'))
const cidade = ler('public/city/cidade.json')
const malha = ler('public/city/cidade-malha.json')
const mapa = ler('public/city/mapa-v1.json')
const merkle = ler('data/dogcity_merkle.json')

const SUP = (() => {
  const meta = ler('data/superficie.json')
  const buf = readFileSync(resolve(RAIZ, 'data/superficie.f32'))
  // cópia para um ArrayBuffer alinhado: Float32Array sobre o buffer do Node
  // quebra quando o byteOffset não é múltiplo de 4
  const H = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + meta.n * meta.n * 4))
  return { H, n: meta.n, R: meta.raio, cel: (2 * meta.raio) / (meta.n - 1), min: meta.min, max: meta.max }
})()
const COTA_AGUA = -40
const R_CASCA = mapa.reservas?.limite?.r ?? 9050
const alturaEm = (x, z) => {
  const { H, n, R, cel } = SUP
  const fi = (x + R) / cel, fj = (z + R) / cel
  const i = Math.max(0, Math.min(n - 2, Math.floor(fi))), j = Math.max(0, Math.min(n - 2, Math.floor(fj)))
  const u = fi - i, v = fj - j
  return H[j * n + i] * (1 - u) * (1 - v) + H[j * n + i + 1] * u * (1 - v)
    + H[(j + 1) * n + i] * (1 - u) * v + H[(j + 1) * n + i + 1] * u * v
}
const naAgua = (x, z) => Math.hypot(x, z) < R_CASCA && alturaEm(x, z) < COTA_AGUA

// ── a fonte embutida: a marca não muda de desenho por computador ───────────
const FONTE = readFileSync(resolve(AQUI, 'fontes/jetbrains-mono-latin.woff2')).toString('base64')
const FAMILIA = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`

// ── a paleta: plot-map escuro, laranja da marca só em traço ────────────────
const FUNDO = '#0B0A09'
const CREME = '#EDE1CB', BRUMA = '#B3A690', APAGADO = '#7E7362'
const LARANJA = '#E8660D', LARANJA_CLARO = '#F4A661'
const AGUA = '#17404F', AGUA_FUNDA = '#0F2C38', AGUA_RASA = '#265E70', COSTA = '#7FB0C4', AREIA = '#93805F'
const VIA = '#E9DECB', HALO = FUNDO
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const cor = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mistura = (a, b, t) => cor(hex(a).map((v, i) => v + (hex(b)[i] - v) * t))
// rampa por paradas: t em [0,1] percorre as paradas em ordem
const rampa = (paradas) => (t) => {
  const k = Math.min(paradas.length - 2, Math.max(0, Math.floor(t * (paradas.length - 1))))
  return mistura(paradas[k], paradas[k + 1], t * (paradas.length - 1) - k)
}
// o relevo: úmber escuro do fundo do vale ao cume. É fundo, não figura: a
// banda mais clara ainda fica abaixo do quarteirão mais escuro.
const TERRA_RAMPA = rampa(['#181412', '#241E1A', '#302823', '#3D332B', '#4A3E33'])
// os seis setores comuns: o quarteirão sobe DOIS DEGRAUS acima do relevo em
// que pisa, na mesma família úmber do terreno (não uma cor nova), para o
// disco da cidade se destacar da planície em miniatura, no X. A rampa
// reaproveita o topo da TERRA_RAMPA como piso e sobe dali; os seis tons ficam
// próximos de propósito (é infraestrutura comum, não zoneamento por cor) mas
// visíveis o bastante para a chave do canto não repetir seis amostras iguais.
const UMBER_RAMPA = rampa(['#3D332B', '#4A3E33', '#584A3C', '#655749'])
// as três orlas nomeadas: tom mais claro e hierárquico (a alça é o endereço
// mais nobre da cidade, depois o Distrito Financeiro, depois a Orla da Baía),
// com borda creme clara só nos lotes fundidos (nunca no quarteirão comum) para
// lerem como joia sobre o tecido escuro em vez de uma diferença de tom que só
// se vê a 3200.
const ORLA_RAMPA = rampa(['#3E3221', '#6B5638', '#8F7449'])
const ORLA_BORDA = '#F7E4BC'
const SETOR_T = { 1: 0.6, 2: 0.15, 3: 0.9, 4: 0.05, 5: 0.7, 6: 0.35, 7: 1.0, 8: 0.55, 9: 0.15 }
const corSetor = (s) => (s >= 7 ? ORLA_RAMPA(SETOR_T[s]) : UMBER_RAMPA(SETOR_T[s]))
const NOME_SETOR = { 7: 'ORLA NOBRE · THE SPIT', 8: 'FINANCIAL DISTRICT', 9: 'BAY SHORE' }
// a rua como linha, por cima do tecido: creme fina e densa, como na v2
const RUA_LINHA = CREME

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// ⚠️ HALO ESCURO EM TODO TEXTO. Com o quarteirão levantado e a orla clara, um
// rótulo creme pode cair sobre um tom claro e sumir; paint-order="stroke"
// desenha o contorno escuro ANTES do preenchimento, então o texto lê igual
// sobre qualquer tom, sem duplicar elemento. O Chromium (quem rasteriza esta
// carta, ver cabeçalho) honra paint-order.
const T = (x, y, txt, o = {}) => {
  const tam = o.tam || 10
  return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" fill="${o.cor || CREME}" `
    + `font-family="${FAMILIA}" font-size="${tam}" letter-spacing="${o.esp ?? 2}" `
    + `paint-order="stroke" stroke="${o.halo || HALO}" stroke-width="${(tam * 0.32).toFixed(2)}" stroke-opacity="${o.haloOp ?? 0.85}" stroke-linejoin="round" `
    + `opacity="${o.op ?? 1}" text-anchor="${o.anc || 'start'}"${o.rot ? ` transform="rotate(${o.rot} ${(+x).toFixed(1)} ${(+y).toFixed(1)})"` : ''}>${esc(txt)}</text>\n`
}
// rótulo curvo sobre um arco de rumo a0 -> a1 (sentido horário), raio r em metros
let nArco = 0
let defs = ''
const TC = (r, a0, a1, txt, o = {}) => {
  const id = `arco${nArco++}`
  const [x0, z0] = doRumo(r, a0), [x1, z1] = doRumo(r, a1)
  const grande = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0
  const tam = o.tam || 10
  defs += `<path id="${id}" d="M${pt(x0, z0)}A${(r * ESC).toFixed(1)} ${(r * ESC).toFixed(1)} 0 ${grande} 1 ${pt(x1, z1)}"/>\n`
  return `<text fill="${o.cor || CREME}" font-family="${FAMILIA}" font-size="${tam}" letter-spacing="${o.esp ?? 3}" `
    + `paint-order="stroke" stroke="${o.halo || HALO}" stroke-width="${(tam * 0.28).toFixed(2)}" stroke-opacity="${o.haloOp ?? 0.8}" stroke-linejoin="round" opacity="${o.op ?? 1}">`
    + `<textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(txt)}</textPath></text>\n`
}

// ═══════════════════════════════════════════════════════════════════════════
// MARCHING SQUARES, emprestado de scripts/city/mapa-topo.mjs (mesmas três
// lições: moldura baixa para todo laço fechar, encadear segmentos em curva,
// Douglas-Peucker em vez de decimação).
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ A GRADE É RECORTADA AO QUADRO ANTES DE TUDO. A superfície cobre ±12 km e a
// carta mostra ±7,4 km: correr o marching squares nos 2,56 M de células inteiras
// gastaria 60% do tempo desenhando montanha que fica fora da folha. Recorte com
// margem de 12 células, para o laço fechar fora da área visível.
const MARGEM = 12
const i0 = Math.max(0, Math.floor((SUP.R - QUADRO) / SUP.cel) - MARGEM)
const i1 = Math.min(SUP.n - 1, Math.ceil((SUP.R + QUADRO) / SUP.cel) + MARGEM)
const W = i1 - i0 + 1
const BAIXO = SUP.min - 1000
function grade(passo) {
  const Wp = Math.floor((W - 1) / passo) + 1
  const M = Wp + 2
  const { H, n } = SUP
  const amostra = (i, j) => (i === 0 || j === 0 || i === M - 1 || j === M - 1)
    ? BAIXO : H[(i0 + (j - 1) * passo) * n + (i0 + (i - 1) * passo)]
  const pxDe = (f) => mPx((i0 + (f - 1) * passo) * SUP.cel - SUP.R)
  return { M, amostra, pxDe }
}
function contornos(nivel, { M, amostra: h, pxDe: px }) {
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
      const Tp = [px(i + t(a, b)), px(j)]
      const Rt = [px(i + 1), px(j + t(b, c))]
      const Bt = [px(i + t(d, c)), px(j + 1)]
      const Lf = [px(i), px(j + t(a, d))]
      const p = (u, v) => segs.push([u, v])
      switch (k) {
        case 1: case 14: p(Lf, Bt); break
        case 2: case 13: p(Bt, Rt); break
        case 3: case 12: p(Lf, Rt); break
        case 4: case 11: p(Tp, Rt); break
        case 5: p(Lf, Tp); p(Bt, Rt); break
        case 6: case 9: p(Tp, Bt); break
        case 7: case 8: p(Lf, Tp); break
        case 10: p(Tp, Rt); p(Lf, Bt); break
      }
    }
  }
  return encadeia(segs)
}
function encadeia(segs) {
  const chave = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`
  const viz = new Map()
  for (const [a, b] of segs) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const k = chave(x)
      if (!viz.has(k)) viz.set(k, [])
      viz.get(k).push(y)
    }
  }
  const vistos = new Set(), linhas = []
  for (const [a, b] of segs) {
    const k0 = chave(a) + '|' + chave(b)
    if (vistos.has(k0)) continue
    vistos.add(k0); vistos.add(chave(b) + '|' + chave(a))
    const linha = [a, b]
    for (const frente of [true, false]) {
      for (;;) {
        const ponta = frente ? linha[linha.length - 1] : linha[0]
        const ant = frente ? linha[linha.length - 2] : linha[1]
        const prox = (viz.get(chave(ponta)) || []).find((v) =>
          !vistos.has(chave(ponta) + '|' + chave(v)) && chave(v) !== chave(ant))
        if (!prox) break
        vistos.add(chave(ponta) + '|' + chave(prox)); vistos.add(chave(prox) + '|' + chave(ponta))
        if (frente) linha.push(prox); else linha.unshift(prox)
        if (chave(prox) === chave(linha[0]) && frente) break
      }
    }
    if (linha.length > 2) linhas.push(linha)
  }
  return linhas
}
function simplifica(linha, tol) {
  if (linha.length < 3) return linha
  const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
  const d2 = (p, a, b) => {
    const l = sq(a, b)
    if (l === 0) return sq(p, a)
    const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l))
    return sq(p, [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])])
  }
  const fica = new Uint8Array(linha.length)
  fica[0] = fica[linha.length - 1] = 1
  const pilha = [[0, linha.length - 1]]
  while (pilha.length) {
    const [i, j] = pilha.pop()
    let pior = -1, ki = -1
    for (let k = i + 1; k < j; k++) { const v = d2(linha[k], linha[i], linha[j]); if (v > pior) { pior = v; ki = k } }
    if (pior > tol * tol && ki > 0) { fica[ki] = 1; pilha.push([i, ki], [ki, j]) }
  }
  return linha.filter((_, i) => fica[i])
}
const caminho = (linhas, fechar) => linhas.map((l) =>
  'M' + l.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + (fechar ? 'Z' : '')).join('')

// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 1: RELEVO E ÁGUA
// ═══════════════════════════════════════════════════════════════════════════
let corpo = ''
const t0 = Date.now()
// ⚠️ BANDAS DISCRETAS, EMPILHADAS DE BAIXO PARA CIMA. Cada banda é a região
// {h >= cota} inteira; a de cima cobre o miolo da de baixo e sobra o anel. O
// próprio traço do path é a curva de nível, de graça. O passo é irregular de
// propósito: a cidade vive entre -40 e +60 m (metade do quadro) e a montanha
// de borda passa de 500; passo fixo ou apagaria a cidade ou listraria a serra.
const NIVEIS = [-40, -20, 0, 20, 40, 60, 80, 100, 130, 160, 200, 250, 300, 400, 550]
const g2 = grade(2)   // 30 m por célula bastam para banda de relevo (3,2 px)
corpo += `<rect width="${LADO}" height="${LADO}" fill="${TERRA_RAMPA(0)}"/>\n`
let nPontosRelevo = 0
// guarda as mesmas linhas de nível para redesenhar por cima do tecido, na
// camada 2: a v2 deixava a curva de nível atravessar a cidade inteira, e a
// versão anterior desta carta a escondia debaixo do quarteirão opaco. É a
// MESMA geometria desta camada, só redesenhada mais tarde, mais fina.
const linhasRelevo = []
NIVEIS.forEach((v, k) => {
  const ls = contornos(v, g2).map((l) => simplifica(l, 0.35))
  if (!ls.length) return
  nPontosRelevo += ls.reduce((s, l) => s + l.length, 0)
  linhasRelevo.push(ls)
  corpo += `<path d="${caminho(ls, true)}" fill="${TERRA_RAMPA((k + 1) / NIVEIS.length)}" fill-rule="evenodd" `
    + `stroke="${BRUMA}" stroke-width="0.7" stroke-opacity="0.45"/>\n`
})
console.log(`relevo: ${NIVEIS.length} bandas, ${nPontosRelevo} pontos, ${Date.now() - t0} ms`)

// a água em resolução cheia (15 m): a linha de costa é o que mais se lê.
// ⚠️ TRÊS PROFUNDIDADES, NÃO DUAS: rasa (-40 a -58, a margem), média (-58 a
// -75) e funda (< -75, igual à versão anterior desta carta). -40 continua
// sendo o único limiar que o resto do código lê (naAgua/pontes usa só
// COTA_AGUA); -58 é puramente de desenho, um degrau extra de degradê que
// nada mais consulta.
const g1 = grade(1)
const terraLaços = contornos(COTA_AGUA, g1).map((l) => simplifica(l, 0.25))
const rasoLaços = contornos(-58, g1).map((l) => simplifica(l, 0.3))
const fundoLaços = contornos(-75, g1).map((l) => simplifica(l, 0.35))
const rc = R_CASCA * ESC, cx = LADO / 2
const disco = `M${(cx - rc).toFixed(1)} ${cx}a${rc.toFixed(1)} ${rc.toFixed(1)} 0 1 0 ${(2 * rc).toFixed(1)} 0a${rc.toFixed(1)} ${rc.toFixed(1)} 0 1 0 ${(-2 * rc).toFixed(1)} 0Z`
defs += `<clipPath id="casca"><circle cx="${cx}" cy="${cx}" r="${rc.toFixed(1)}"/></clipPath>\n`
defs += `<pattern id="hachAgua" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
  + `<line x1="0" y1="0" x2="0" y2="5" stroke="${COSTA}" stroke-width="0.65" stroke-opacity="0.55"/></pattern>\n`
corpo += `<g clip-path="url(#casca)">\n`
// a praia: um traço de areia na costa, pintado ANTES da água, que cobre a
// metade molhada dele e deixa a metade seca como faixa clara na margem
corpo += `<path d="${caminho(terraLaços, false)}" fill="none" stroke="${AREIA}" stroke-width="2.4" stroke-opacity="0.5"/>\n`
// ⚠️ ÁGUA = DISCO MENOS TERRA. `contornos(cota)` delimita a região ACIMA da cota;
// pintar isso pinta a terra. O path leva o disco da casca E os laços de terra
// com evenodd, que subtrai um do outro. E o clip-path é obrigatório mesmo assim:
// evenodd conta cruzamento no plano inteiro, e sem o recorte o terreno alto de
// fora da casca (dentro de um laço, fora do disco) sairia azul.
corpo += `<path d="${disco}${caminho(terraLaços, true)}" fill="${AGUA_RASA}" fill-rule="evenodd"/>\n`
corpo += `<path d="${disco}${caminho(rasoLaços, true)}" fill="${AGUA}" fill-rule="evenodd" opacity="0.92"/>\n`
corpo += `<path d="${disco}${caminho(fundoLaços, true)}" fill="${AGUA_FUNDA}" fill-rule="evenodd" opacity="0.88"/>\n`
// a hachura da margem: só o anel raso (entre a costa e -58), pelos dois laços
// diretamente (são laços aninhados; evenodd já isola o anel entre os dois
// sem precisar de um limite externo)
corpo += `<path d="${caminho(terraLaços, true)}${caminho(rasoLaços, true)}" fill="url(#hachAgua)" fill-rule="evenodd" opacity="0.55"/>\n`
corpo += `<path d="${caminho(terraLaços, false)}" fill="none" stroke="${COSTA}" stroke-width="0.8" stroke-opacity="0.8"/>\n`
corpo += `</g>\n`
console.log(`água: ${terraLaços.length} laços de costa, ${Date.now() - t0} ms`)

// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 2: OS QUARTEIRÕES, COR POR SETOR, RUA EM NEGATIVO
// ═══════════════════════════════════════════════════════════════════════════
// quadro da malha: mundo = centro + R(giro)·local; x local = testada (lado),
// z local = profundidade (prof). giro em graus, positivo de +x para +z.
const retangulo = (x, z, meiaX, meiaZ, giroGraus) => {
  const g = giroGraus * DEG, c = Math.cos(g), s = Math.sin(g)
  return [[-meiaX, -meiaZ], [meiaX, -meiaZ], [meiaX, meiaZ], [-meiaX, meiaZ]]
    .map(([lx, lz]) => [x + lx * c - lz * s, z + lx * s + lz * c])
}
const poli = (pts) => 'M' + pts.map(([x, z]) => pt(x, z)).join('L') + 'Z'
// ⚠️ O RECUO DE 1,5 m É PARA A RUA APARECER. O vão real entre quarteirões vizinhos
// é de 16 m (medido na malha: p5 e p50 iguais a 16,0), que a 4,6 m/px dá 3,5 px
// no 1600 e 7 no 3200. Com o recuo o vão vai a 19 m e a rua lê limpa nos dois.
// É recuo de desenho, não de cadastro: a área do quarteirão não muda em lugar
// nenhum que alguém consulte.
const RECUO = 1.5
// ⚠️ DUAS BOLSAS POR SETOR, NUNCA UMA. O quarteirão da malha ganha traço de
// rua por cima (linha creme, ver abaixo); o lote fundido das três orlas
// especiais NÃO pode ganhar esse traço, porque ali o lote é fundido de
// propósito para o olho ler a fileira e não a divisa (aviso do cabeçalho).
// Guardar as duas bolsas separadas é o que permite tratamento diferente sem
// reintroduzir a divisa por lote.
const porSetorBlocos = {}, porSetorOrlas = {}
for (const b of malha.quarteiroes) {
  const s = b.setor
  porSetorBlocos[s] = (porSetorBlocos[s] || '') + poli(retangulo(b.x, b.z, b.lado / 2 - RECUO, b.prof / 2 - RECUO, b.giro))
}
// as três orlas especiais vêm do registro, lote a lote, fundidos por setor.
// ⚠️ O SETOR DO .bin É ZERO-BASED (0..8) e o do lot_id é S01..S09: bin 6 = S07.
const REG = 15
const bin = readFileSync(resolve(RAIZ, 'public/city/cidade-lotes.bin'))
const nLotes = Math.floor(bin.length / REG)
if (cidade.registroBytes !== REG) throw new Error(`cidade.json declara ${cidade.registroBytes} bytes por lote, este leitor espera ${REG}`)
const contagemOrla = { 7: 0, 8: 0, 9: 0 }
for (let i = 0; i < nLotes; i++) {
  const o = i * REG
  const setor = bin.readUInt8(o + 4) + 1
  if (!(setor in contagemOrla)) continue
  const x = bin.readInt16LE(o) / 4, z = bin.readInt16LE(o + 2) / 4
  const frente = bin.readUInt16LE(o + 9) / 10, prof = bin.readUInt16LE(o + 11) / 10
  const giro = bin.readUInt16LE(o + 13) / 100
  contagemOrla[setor]++
  porSetorOrlas[setor] = (porSetorOrlas[setor] || '') + poli(retangulo(x, z, frente / 2 + 0.8, prof / 2 + 0.8, giro))
}
const setoresComuns = Object.keys(porSetorBlocos).map(Number).sort((a, b) => a - b)
// 1) o preenchimento dos quarteirões comuns, translúcido: a curva de nível de
// baixo ainda respira por baixo
for (const s of setoresComuns) corpo += `<path d="${porSetorBlocos[s]}" fill="${corSetor(s)}" fill-opacity="0.88"/>\n`
// 2) a curva de nível volta a atravessar por cima do tecido (mesma geometria
// da camada 1), antes da malha creme, para ficar por baixo dela
for (const ls of linhasRelevo) corpo += `<path d="${caminho(ls, true)}" fill="none" stroke="${BRUMA}" stroke-width="0.6" stroke-opacity="0.28"/>\n`
// 3) a rua como LINHA creme fina e densa, por cima do quarteirão comum. Não
// entra nas orlas: ver aviso acima
for (const s of setoresComuns) corpo += `<path d="${porSetorBlocos[s]}" fill="none" stroke="${RUA_LINHA}" stroke-width="0.62" stroke-opacity="0.55" stroke-linejoin="round"/>\n`
// 4) as três orlas nomeadas, com borda creme clara: é o que faz o Spit, os
// píeres de Bay Shore e o anel do Distrito Financeiro lerem como endereço
// nobre, e não só uma diferença de tom que só se vê a 3200
for (const s of [7, 8, 9]) {
  if (!porSetorOrlas[s]) continue
  corpo += `<path d="${porSetorOrlas[s]}" fill="${corSetor(s)}"/>\n`
  corpo += `<path d="${porSetorOrlas[s]}" fill="none" stroke="${ORLA_BORDA}" stroke-width="0.7" stroke-opacity="0.75"/>\n`
}
console.log(`quarteirões: ${malha.quarteiroes.length}; lotes das orlas: S07 ${contagemOrla[7]}, S08 ${contagemOrla[8]}, S09 ${contagemOrla[9]} (de ${nLotes})`)

// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 3: PROGRAMA E ÂNCORAS, HACHURA FINA E NOME CURTO
// ═══════════════════════════════════════════════════════════════════════════
defs += `<pattern id="hach" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
  + `<line x1="0" y1="0" x2="0" y2="4" stroke="${CREME}" stroke-width="0.6" stroke-opacity="0.42"/></pattern>\n`
defs += `<pattern id="hachA" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
  + `<line x1="0" y1="0" x2="0" y2="3" stroke="${LARANJA_CLARO}" stroke-width="0.7" stroke-opacity="0.6"/></pattern>\n`
// nome curto em inglês, por id. Só tradução do nome publicado, nunca nome novo.
// Dicionário do PROGRAMA INTEIRO (documentação), mas só os 14 nomes do brief
// (marketing/CARTA-BRIEF.md) chegam a rotular a folha: ver ROTULO_PERMITIDO.
const NOME_CURTO = {
  GF01: 'GOLF COURSE', VP02: 'FOREST', A01: 'CENTRAL PARK', E01: 'OLYMPIC PARK', VP01: 'WEST LAKE',
  IN01: 'ILMENITE PLANT', IN02: 'H2 REDUCTION', IN03: 'REGOLITH ELECTROLYSIS', IN04: 'VOLATILES PLANT',
  IN05: 'FOUNDRY', IN06: 'SOLAR CELL FAB', IN07: 'BLOCK SINTERING', IN08: 'OXYGEN TANKS',
  B01: 'SOLAR FIELD E', B06: 'SOLAR FIELD S', B10: 'SOLAR FIELD W', B14: 'SOLAR FIELD N',
  A02: 'BOTANICAL GARDEN', A03: 'COHORT GARDENS', A05: 'FOUNDERS WALK', A04: 'WEST LAKE',
  B04: 'RADIATOR FIELD', G01: 'RUNESTONE GATE', B08: 'TRAINING GROUND S', B13: 'TRAINING GROUND N',
  B12: 'WEST FARMS', B05: 'BELT FARMS', C01: 'DOG UNIVERSITY', D02: 'CUSTOMS', D03: 'CONTAINER YARD',
  C05: 'CITY HALL', B16: 'NORTH DEPOT', VP03: 'WEST STATION', B03: 'RAIL YARD SE', B11: 'RAIL YARD W',
  B09: 'RESERVOIR W', B02: 'RESERVOIR E', C08: 'LOST DOG MEMORIAL', C07: 'DOG DATA HQ', B07: 'REGOLITH DEPOT',
  C09: 'MARKET HALL', C02: 'HOSPITAL', C06: 'THE MINT', C04: 'RUNE MUSEUM', C12: 'COLOSSUS', C03: 'THEATRE',
  D01: 'DOME GATE', C10: 'OBSERVATORY', B15: 'BELT LOOKOUT', C11: 'GATE BEACON', K01: 'COLUMBARIUM FIELD',
  ESTADIO: '$DOG ARENA', GEODE: 'THE GEODE', SPHERE: 'THE SPHERE', CAMPUS: 'CAMPUS',
  ATLETISMO: 'ATHLETICS', AQUATICS: 'AQUATICS', DERBY: 'DOG DERBY',
}
const ANCORAS = new Set(['ESTADIO', 'GEODE', 'SPHERE', 'CAMPUS', 'ATLETISMO', 'AQUATICS', 'DERBY'])
// ⚠️ SÓ OS 14 NOMES DO BRIEF ROTULAM A FOLHA (a v3 tinha rótulo demais
// colidindo e nome de planta industrial, que não vende lote). Oito vêm deste
// laço; os outros seis (Satoshi Plaza, Financial District, Orla Nobre, Bay
// Shore, The Bay, Founders Club) têm chamada própria mais abaixo, fora dele.
// CAMPUS fica de fora de propósito: continua em ANCORAS (ganha hachura e
// contorno laranja de âncora) mas sem texto próprio, porque colava em
// "$DOG ARENA" na v3 (o estádio mora dentro dele e já leva o nome dele).
const ROTULO_PERMITIDO = new Set(['ESTADIO', 'GEODE', 'SPHERE', 'ATLETISMO', 'AQUATICS', 'DERBY', 'G01', 'K01'])
const centroide = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]
const areaDe = (p) => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1] }, 0)) / 2
// polígono de cada peça: o publicado, ou retângulo/elipse a partir de x,z,a,b,rot
// (a e b são MEIOS-LADOS: K01 tem a 278 e b 86,3 e mede 9,6 ha = 556 x 172,6 m)
const poligonoDe = (p) => {
  if (p.poly && p.poly.length >= 3) return p.poly
  if (p.forma === 'elipse') {
    const g = (p.rot || 0) * DEG, c = Math.cos(g), s = Math.sin(g), pts = []
    for (let k = 0; k < 36; k++) { const a = k * 10 * DEG, lx = p.a * Math.cos(a), lz = p.b * Math.sin(a); pts.push([p.x + lx * c - lz * s, p.z + lx * s + lz * c]) }
    return pts
  }
  return retangulo(p.x, p.z, p.a, p.b, p.rot || 0)
}
let hachuras = '', hachurasA = '', contornosA = '', rotulos = ''
let nPecas = 0, nRotulos = 0
const ROTULOS_LUGAR = []    // para conferir depois contra a superfície
for (const p of cidade.programa) {
  const pol = poligonoDe(p)
  const [cxm, czm] = centroide(pol)
  if (Math.abs(cxm) > QUADRO + 300 || Math.abs(czm) > QUADRO + 300) continue
  if (p.tipo === 'agua') continue          // lago é água na superfície, não hachura
  const d = poli(pol)
  nPecas++
  if (ANCORAS.has(p.id)) { hachurasA += d; contornosA += d } else { hachuras += d }
  if (!ROTULO_PERMITIDO.has(p.id)) continue
  // K01 é "COLUMBARIUM FIELD" no registro; o brief pede o nome curto
  const nome = p.id === 'K01' ? 'COLUMBARIUM' : NOME_CURTO[p.id]
  if (!nome) continue
  const [lx, lz] = [cxm, czm]
  ROTULOS_LUGAR.push([nome, lx, lz])
  const ancora = ANCORAS.has(p.id)
  // ponto laranja em todo rótulo de ponto, do mesmo jeito que Satoshi Plaza
  // já marca o centro da cidade
  rotulos += `<circle cx="${mPx(lx).toFixed(1)}" cy="${mPx(lz).toFixed(1)}" r="3" fill="${LARANJA}"/>\n`
  rotulos += T(mPx(lx), mPx(lz) + 14, nome, { tam: ancora ? 10 : 9.5, esp: ancora ? 2.4 : 2, anc: 'middle', cor: ancora ? LARANJA_CLARO : CREME, op: 0.95 })
  nRotulos++
}
corpo += `<path d="${hachuras}" fill="url(#hach)" stroke="${CREME}" stroke-width="0.5" stroke-opacity="0.45"/>\n`
corpo += `<path d="${hachurasA}" fill="url(#hachA)"/>\n`
corpo += `<path d="${contornosA}" fill="none" stroke="${LARANJA}" stroke-width="0.9" stroke-opacity="0.9"/>\n`
console.log(`programa: ${nPecas} peças no quadro, ${nRotulos} rotuladas`)

// The Founders Club: ilha criada pelo projeto dentro da baía. Terra do projeto,
// então hachura, e não o tom de setor de ninguém.
const FC = mapa.reservas?.foundersClub
if (FC?.crescentes) {
  let d = ''
  for (const c of FC.crescentes) d += poli(c)
  if (FC.casa_poly) d += poli(FC.casa_poly)
  corpo += `<path d="${d}" fill="${mistura(AREIA, CREME, 0.15)}" fill-opacity="0.9"/>\n`
  corpo += `<path d="${d}" fill="url(#hach)" stroke="${CREME}" stroke-width="0.5" stroke-opacity="0.5"/>\n`
  const [fx, fz] = FC.centro
  corpo += `<circle cx="${mPx(fx).toFixed(1)}" cy="${mPx(fz).toFixed(1)}" r="3" fill="${LARANJA}"/>\n`
  rotulos += T(mPx(fx), mPx(fz) + FC.r_ext * ESC + 16, 'FOUNDERS CLUB', { tam: 9.5, esp: 2, anc: 'middle', op: 0.95 })
  ROTULOS_LUGAR.push(['FOUNDERS CLUB', fx, fz])
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 4: CANAIS, AVENIDAS, ANÉIS (DODECÁGONOS) E A AN7 (CÍRCULO)
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ VIA SÓ ONDE HÁ TERRA. As avenidas de rumo 30 e 60 cruzam 3 km de baía até a
// alça, e não há ponte ali: o acesso à alça é pela AN7, a partir das radiais de
// 330 e 120 (teia.ts). A polilinha é amostrada a cada 12 m e partida em trechos
// de terra; um trecho de água CURTO (canal, lago da praça: < 150 m, o mesmo
// limiar que separa ponte de desvio na cena) é ponte e sai tracejado.
const PONTE_MAX = 150
function tracaSobreTerra(pontos) {
  const terra = [], ponte = []
  let atual = [], emAgua = false, aguaDesde = 0, aguaPts = []
  const fecha = () => { if (atual.length > 1) terra.push(atual); atual = [] }
  for (let k = 0; k < pontos.length; k++) {
    const [x, z] = pontos[k]
    const agua = naAgua(x, z)
    if (agua && !emAgua) { emAgua = true; aguaDesde = k; aguaPts = [pontos[Math.max(0, k - 1)]] }
    if (agua) { aguaPts.push([x, z]); continue }
    if (emAgua) {
      emAgua = false
      const comp = Math.hypot(x - pontos[aguaDesde][0], z - pontos[aguaDesde][1])
      if (comp <= PONTE_MAX && atual.length) { aguaPts.push([x, z]); ponte.push(aguaPts); atual.push([x, z]); continue }
      fecha()
    }
    atual.push([x, z])
  }
  fecha()
  const d = (ls) => ls.map((l) => 'M' + l.map(([x, z]) => pt(x, z)).join('L')).join('')
  return { terra: d(terra), ponte: d(ponte) }
}
const amostraReta = (x0, z0, x1, z1, passo = 12) => {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / passo)), pts = []
  for (let k = 0; k <= n; k++) pts.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n])
  return pts
}
const via = (tracado, largM, o = {}) => {
  let s = ''
  const w = (largM * ESC).toFixed(2)
  if (tracado.terra) s += `<path d="${tracado.terra}" fill="none" stroke="${FUNDO}" stroke-width="${(largM * ESC + 1.2).toFixed(2)}" stroke-opacity="0.55" stroke-linecap="butt" stroke-linejoin="round"/>\n`
    + `<path d="${tracado.terra}" fill="none" stroke="${o.cor || VIA}" stroke-width="${w}" stroke-opacity="${o.op ?? 0.9}" stroke-linecap="butt" stroke-linejoin="round"/>\n`
  if (tracado.ponte) s += `<path d="${tracado.ponte}" fill="none" stroke="${o.cor || VIA}" stroke-width="${w}" stroke-opacity="${o.op ?? 0.9}" stroke-dasharray="${(2.2).toFixed(1)} ${(1.6).toFixed(1)}"/>\n`
  return s
}

// os três canais radiais: da orla do lago da praça até a boca na baía
// ⚠️ O FIM DO CANAL É MEDIDO NA SUPERFÍCIE, não copiado do JSON: mapa-v1 diz
// rFim 7.200, mas a alça (r 6.580 a 7.300) é terra seca nos três rumos, e a
// malha diz 4.720/3.860/4.700, que é onde o leito entra na baía. O critério é
// geométrico: o canal acaba onde há água a 60 m dos DOIS lados do eixo.
const CANAIS = mapa.agua?.canais?.radiais ?? malha.canais.radiais
let canais = ''
for (const c of CANAIS) {
  const larg = c.lamina ?? c.secao ?? 60
  let fim = c.rInicio, seguidas = 0
  for (let r = c.rInicio; r <= 7400; r += 15) {
    const [x, z] = doRumo(r, c.rumo)
    const nx = Math.cos(c.rumo * DEG), nz = Math.sin(c.rumo * DEG)   // perpendicular ao radial
    const aberta = naAgua(x + nx * larg, z + nz * larg) && naAgua(x - nx * larg, z - nz * larg)
    if (aberta) { if (++seguidas >= 8) { fim = r - 15 * 8; break } } else seguidas = 0
    fim = r
  }
  const [x0, z0] = doRumo(c.rInicio, c.rumo), [x1, z1] = doRumo(fim, c.rumo)
  canais += `<path d="M${pt(x0, z0)}L${pt(x1, z1)}" fill="none" stroke="${COSTA}" stroke-width="${(larg * ESC + 1.4).toFixed(2)}" stroke-opacity="0.7"/>\n`
  canais += `<path d="M${pt(x0, z0)}L${pt(x1, z1)}" fill="none" stroke="${AGUA}" stroke-width="${(larg * ESC).toFixed(2)}"/>\n`
  console.log(`canal ${c.id} rumo ${c.rumo}: r ${c.rInicio} a ${fim.toFixed(0)}`)
}
corpo += canais

// as 12 avenidas, de r 1.420 a 7.050, nunca dentro da alça de terra
const ALCA_TERRA = mapa.alca.terra, ALCA_R_DENTRO = mapa.alca.rDentro
const AV = mapa.avenidas
let avenidas = ''
for (const a of AV.lista) {
  const pts = amostraReta(...doRumo(AV.rInicio, a.rumo), ...doRumo(AV.rFim, a.rumo))
    .filter(([x, z]) => !(Math.hypot(x, z) >= ALCA_R_DENTRO && noArco(rumoDe(x, z), ALCA_TERRA)))
  avenidas += via(tracaSobreTerra(pts), a.papel === 'distrito' ? 13 : 10)
}
// os anéis: seis dodecágonos com vértice em r nas 12 avenidas, e a AN7 circular
let aneis = ''
let an7Path = ''
let AN7_R = 0
for (const an of mapa.aneisViarios) {
  if (an.circulo) {
    const [a0, a1] = an.arco
    const pts = []
    for (let g = 0; g <= ((a1 - a0 + 360) % 360); g += 0.25) pts.push(doRumo(an.r, a0 + g))
    an7Path = tracaSobreTerra(pts)
    AN7_R = an.r
    continue
  }
  const pts = []
  for (let k = 0; k < 12; k++) {
    const [x0, z0] = doRumo(an.r, k * 30), [x1, z1] = doRumo(an.r, (k + 1) * 30)
    pts.push(...amostraReta(x0, z0, x1, z1).slice(k ? 1 : 0))
  }
  // dentro da alça de terra não há outra rua além da AN7 (fundador, 07/09)
  const filt = pts.filter(([x, z]) => !(Math.hypot(x, z) >= ALCA_R_DENTRO && noArco(rumoDe(x, z), ALCA_TERRA)))
  aneis += via(tracaSobreTerra(filt), an.larg >= 34 ? 12 : 10)
}
corpo += avenidas + aneis
// a AN7, laranja da marca: a única cor quente saturada da folha, a assinatura.
// ⚠️ BANDA LARGA COM DEGRADÊ, NÃO FIO. A versão anterior desenhava só uma
// linha de 26 m simbólicos (~3 px no 1600); a v2, que vendeu, tinha uma faixa
// grossa. Medido contra ela em 23/09: uma banda de ~425 m aqui rende os
// mesmos ~46 px do poster que funcionou, e é exagero de estilo, não medida de
// terreno real (70 m na escala da folha mal passava de fio). Como a AN7 é um
// círculo perfeito centrado na Praça, um degradê RADIAL centrado ali varia só
// com o raio, que é exatamente o corte transversal da banda: escuro nas duas
// bordas, laranja saturado, núcleo claro, laranja de novo, escuro de novo.
const BANDA_AN7 = 425
const rIn = (AN7_R - BANDA_AN7 / 2) * ESC, rOut = (AN7_R + BANDA_AN7 / 2) * ESC
const fIn = rIn / rOut
defs += `<radialGradient id="gradArco" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cx}" r="${rOut.toFixed(2)}">`
  + `<stop offset="${fIn.toFixed(4)}" stop-color="${mistura(LARANJA, FUNDO, 0.55)}"/>`
  + `<stop offset="${(fIn + (1 - fIn) * 0.22).toFixed(4)}" stop-color="${LARANJA}"/>`
  + `<stop offset="${((1 + fIn) / 2).toFixed(4)}" stop-color="${mistura(LARANJA_CLARO, CREME, 0.4)}"/>`
  + `<stop offset="${(1 - (1 - fIn) * 0.22).toFixed(4)}" stop-color="${LARANJA}"/>`
  + `<stop offset="1" stop-color="${mistura(LARANJA, FUNDO, 0.55)}"/></radialGradient>\n`
corpo += via(an7Path, BANDA_AN7, { cor: 'url(#gradArco)', op: 1 })
// a Orla Nobre volta a desenhar por cima da banda larga (enxerto da variante
// B: a borda creme clara), senão a faixa cobriria as fileiras de lote que a
// camada 2 já tinha desenhado
if (porSetorOrlas[7]) {
  corpo += `<path d="${porSetorOrlas[7]}" fill="${corSetor(7)}"/>\n`
  corpo += `<path d="${porSetorOrlas[7]}" fill="none" stroke="${ORLA_BORDA}" stroke-width="0.75" stroke-opacity="0.8"/>\n`
}
corpo += `<path d="${an7Path.terra}" fill="none" stroke="${LARANJA_CLARO}" stroke-width="1.1" stroke-opacity="0.9"/>\n`

// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 5: TOPÔNIMOS, SETORES, ROSA, ESCALA, CARTUCHO
// ═══════════════════════════════════════════════════════════════════════════
// a Praça e o Distrito Financeiro (anel de 27 lotes em r 992, dentro da Praça)
const rDF = (() => {
  let s = 0, n = 0
  for (let i = 0; i < nLotes; i++) { const o = i * REG; if (bin.readUInt8(o + 4) + 1 !== 8) continue; s += Math.hypot(bin.readInt16LE(o) / 4, bin.readInt16LE(o + 2) / 4); n++ }
  return n ? s / n : 992
})()
corpo += `<rect x="${(cx - 3).toFixed(1)}" y="${(cx - 3).toFixed(1)}" width="6" height="6" fill="${LARANJA}"/>\n`
rotulos += T(cx, cx - 15, 'SATOSHI PLAZA', { tam: 13, esp: 5, anc: 'middle' })
rotulos += TC(rDF + 150, 300, 60, NOME_SETOR[8], { tam: 9.5, esp: 4, op: 0.92 })
// a Orla Nobre, na alça: nome curvo por fora da fileira de trás (r 7.000 a 7.044)
const meioAlca = ((ALCA_TERRA[0] + ((ALCA_TERRA[1] - ALCA_TERRA[0] + 360) % 360) / 2) % 360)
rotulos += TC(7128, meioAlca - 28, meioAlca + 28, NOME_SETOR[7], { tam: 11, esp: 4.5 })
// a Orla da Baía: as fileiras ficam em r 4.075 a 4.700, em dois grupos partidos
// pelo lobo da baía; o nome vai por dentro da primeira fileira, uma vez em cada
// grupo (o fundador prefere repetição simétrica a um rótulo torto no meio)
const rumosBaia = (() => {
  const rs = []
  for (let i = 0; i < nLotes; i++) { const o = i * REG; if (bin.readUInt8(o + 4) + 1 !== 9) continue; const x = bin.readInt16LE(o) / 4, z = bin.readInt16LE(o + 2) / 4; if (Math.hypot(x, z) < 4800) rs.push(rumoDe(x, z)) }
  rs.sort((a, b) => a - b)
  // parte no maior salto angular
  let corte = 0, maior = 0
  for (let k = 1; k < rs.length; k++) if (rs[k] - rs[k - 1] > maior) { maior = rs[k] - rs[k - 1]; corte = k }
  const g1 = rs.slice(0, corte), g2 = rs.slice(corte)
  const med = (g) => g[Math.floor(g.length / 2)]
  return [med(g1), med(g2)]
})()
for (const rm of rumosBaia) rotulos += TC(3985, rm - 12, rm + 12, NOME_SETOR[9], { tam: 10, esp: 4, op: 0.95 })
// a baía: nome no espelho d'água, entre o Founders Club e a alça
const baia = mapa.agua.lagos.baia
const rumoBaia = rumoDe(baia.x, baia.z)
ROTULOS_LUGAR.push(['THE BAY', ...doRumo(5950, rumoBaia - 14)])
rotulos += TC(5950, rumoBaia - 30, rumoBaia + 2, 'THE BAY', { tam: 12, esp: 6, cor: mistura(COSTA, CREME, 0.5), op: 0.9 })
// os seis setores do tecido: sigla no meio do arco de cada um, em r 5.050.
// ⚠️ APAGADO, NÃO FUNDO. O quarteirão comum agora é dois degraus mais claro
// (§ disco levantado); FUNDO sumiria contra ele. O halo do T() já cobre a
// leitura contra os dois tons possíveis (comum e orla).
const DEF = malha.constantes.distritosDef
DEF.forEach((d, k) => {
  const rumo = d.rumo + d.abertura / 2
  rotulos += TC(5050, rumo - 3, rumo + 3, `S0${k + 1}`, { tam: 8, esp: 3, cor: APAGADO, op: 0.65 })
})
corpo += rotulos

// ── moldura: letreiro, rosa, escala, chaves, cartucho ─────────────────────
const m = 34
const painel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0D0C0A" fill-opacity="0.9" stroke="${CREME}" stroke-opacity="0.16" stroke-width="0.8"/>\n`
let mob = ''
// letreiro (a logo é o letreiro: JetBrains Mono espaçada, creme)
mob += painel(m, m, 300, 78)
mob += T(m + 18, m + 36, 'DOGCITY', { tam: 27, esp: 11 })
mob += T(m + 18, m + 53, 'MARE TRANQUILLITATIS · THE MOON', { tam: 8.5, esp: 3, op: 0.8 })
mob += T(m + 18, m + 67, `CADASTRAL CHART · SEALED AT BLOCK ${merkle.bloco.toLocaleString('en-US')}`, { tam: 7.5, esp: 2, cor: LARANJA_CLARO, op: 0.9 })
// rosa dos ventos
const nx = LADO - m - 34, ny = m + 44
mob += painel(LADO - m - 68, m, 68, 78)
mob += `<path d="M${nx} ${ny - 26}L${nx + 8} ${ny + 8}L${nx} ${ny}L${nx - 8} ${ny + 8}Z" fill="${CREME}" opacity="0.92"/>\n`
mob += `<path d="M${nx} ${ny}L${nx + 8} ${ny + 8}L${nx} ${ny + 26}L${nx - 8} ${ny + 8}Z" fill="${CREME}" opacity="0.35"/>\n`
mob += T(nx, ny - 31, 'N', { tam: 11, esp: 0, anc: 'middle', op: 0.95 })
// chave dos setores. ⚠️ CANTO SUPERIOR ESQUERDO, sob o letreiro. No canto
// direito ela caía sobre o arco da Orla Nobre (a curva do rótulo passa perto
// ali, r 7.128): rótulo de lugar colidindo com painel de legenda é a mesma
// colisão que o brief pede para testar e afastar.
const CH = [
  [7, 'S07 · ORLA NOBRE · THE SPIT'], [8, 'S08 · FINANCIAL DISTRICT'], [9, 'S09 · BAY SHORE'],
  [1, 'S01'], [2, 'S02'], [3, 'S03'], [4, 'S04'], [5, 'S05'], [6, 'S06'],
]
const kx = m, ky = m + 90
mob += painel(kx, ky, 232, 20 + CH.length * 13 + 14)
mob += T(kx + 12, ky + 15, 'DISTRICTS', { tam: 7.5, esp: 3, op: 0.6 })
CH.forEach(([s, nome], i) => {
  const y = ky + 28 + i * 13
  mob += `<rect x="${kx + 12}" y="${y - 7}" width="14" height="8" fill="${corSetor(s)}"/>\n`
  mob += T(kx + 34, y, nome, { tam: 7.5, esp: 1.6, op: 0.85 })
})
// chave dos símbolos e escala, canto inferior esquerdo
const SIMB = [
  ['WATER · BELOW -40 M', (x, y) => `<rect x="${x}" y="${y - 7}" width="14" height="8" fill="${AGUA}" stroke="${COSTA}" stroke-width="0.6"/>`],
  ['PROJECT LAND', (x, y) => `<rect x="${x}" y="${y - 7}" width="14" height="8" fill="url(#hach)" stroke="${CREME}" stroke-opacity="0.5" stroke-width="0.5"/>`],
  ['ANCHOR PARCEL', (x, y) => `<rect x="${x}" y="${y - 7}" width="14" height="8" fill="url(#hachA)" stroke="${LARANJA}" stroke-width="0.9"/>`],
  ['AN7 · THE SPIT AVENUE', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="url(#gradArco)" stroke-width="5"/>`],
  ['AVENUES · RING ROADS', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${VIA}" stroke-width="2.4"/>`],
  ['BRIDGE', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${VIA}" stroke-width="2.2" stroke-dasharray="2.2 1.6"/>`],
  ['CANAL', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${AGUA}" stroke-width="4"/><line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${COSTA}" stroke-width="5.2" stroke-opacity="0.35"/>`],
  ['STREETS · CREAM LINE', (x, y) => `<rect x="${x}" y="${y - 7}" width="14" height="8" fill="${UMBER_RAMPA(0.4)}"/><line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${RUA_LINHA}" stroke-width="1.2"/>`],
  [`RELIEF · ${SUP.min.toFixed(0)} TO ${SUP.max.toFixed(0)} M`, (x, y) => [0, 1, 2, 3].map((k) => `<rect x="${x + k * 3.5}" y="${y - 7}" width="3.5" height="8" fill="${TERRA_RAMPA(k / 3)}"/>`).join('')],
]
const kmPx = 1000 * ESC
const sx = m, sh = 20 + SIMB.length * 13 + 44
const sy = LADO - m - sh
mob += painel(sx, sy, 236, sh)
mob += T(sx + 12, sy + 15, 'KEY', { tam: 7.5, esp: 3, op: 0.6 })
SIMB.forEach(([nome, desenha], i) => {
  const y = sy + 28 + i * 13
  mob += desenha(sx + 12, y) + T(sx + 34, y, nome, { tam: 7.5, esp: 1.6, op: 0.85 })
})
// a escala gráfica: 2 km em quatro trechos de 500 m
const by = LADO - m - 16, bx = sx + 12
for (let k = 0; k < 4; k++) mob += `<rect x="${(bx + k * kmPx / 2).toFixed(1)}" y="${by}" width="${(kmPx / 2).toFixed(1)}" height="5" fill="${k % 2 ? '#0D0C0A' : CREME}" stroke="${CREME}" stroke-width="0.7" opacity="0.9"/>\n`
mob += T(bx, by - 5, '0', { tam: 7, esp: 0, anc: 'middle', op: 0.75 })
mob += T(bx + kmPx, by - 5, '1', { tam: 7, esp: 0, anc: 'middle', op: 0.75 })
mob += T(bx + 2 * kmPx, by - 5, '2 KM', { tam: 7, esp: 0, anc: 'middle', op: 0.75 })
// o cartucho: bloco, contagens em destaque (enxerto da variante C, "os três
// números grandes são a melhor tipografia das três chapas"), o merkle root
// inteiro em mono DENTRO da caixa (o veredito pediu para não soltar o merkle
// numa faixa de rodapé) e a data.
// a data é a do selo (mtime do merkle), em UTC, e não a de hoje: regerar a
// carta daqui a um mês não muda a data em que a cidade foi fechada
const dataSelo = (() => {
  const d = statSync(resolve(RAIZ, 'data/dogcity_merkle.json')).mtime
  const mes = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  return `${String(d.getUTCDate()).padStart(2, '0')} ${mes} ${d.getUTCFullYear()}`
})()
const carteiras = cidade.carteiras, lotesTot = merkle.lotes ?? cidade.lotes.total, lapides = merkle.lapides ?? cidade.cemiterio.lapides
const cw = 420, chh = 128, cxp = LADO - m - cw, cyp = LADO - m - chh
mob += painel(cxp, cyp, cw, chh)
mob += T(cxp + 16, cyp + 20, `BLOCK ${merkle.bloco.toLocaleString('en-US')}`, { tam: 13, esp: 3.5, cor: LARANJA_CLARO })
mob += T(cxp + cw - 16, cyp + 20, `SEALED ${dataSelo} · DOG DATA`, { tam: 7.5, esp: 2, op: 0.65, anc: 'end' })
const STATS = [[lotesTot, 'LOTS'], [carteiras, 'WALLETS'], [lapides, 'HEADSTONES']]
STATS.forEach(([n, cap], i) => {
  const x = cxp + 16 + i * 138
  mob += T(x, cyp + 58, n.toLocaleString('en-US'), { tam: 22, esp: 0.4 })
  mob += T(x, cyp + 73, cap, { tam: 7.5, esp: 2.4, op: 0.62 })
})
mob += T(cxp + 16, cyp + 98, 'MERKLE ROOT', { tam: 7, esp: 3, op: 0.55 })
mob += T(cxp + 16, cyp + 112, merkle.root, { tam: 8.6, esp: 0, op: 0.95 })

// ── monta e grava ───────────────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
<title>DogCity cadastral chart, block ${merkle.bloco}</title>
<desc>${lotesTot} lots, ${carteiras} wallets, merkle root ${merkle.root}</desc>
<defs><style>@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${FONTE}) format('woff2');}</style>
${defs}</defs>
<rect width="${LADO}" height="${LADO}" fill="${FUNDO}"/>
${corpo}${mob}</svg>`
const SVG_SAIDA = resolve(RAIZ, arg('svg', 'public/city/carta.svg'))
writeFileSync(SVG_SAIDA, svg)
console.log(`${SVG_SAIDA}: ${(svg.length / 1e6).toFixed(2)} MB em ${Date.now() - t0} ms`)
// conferência: cada rótulo de lugar contra a superfície, para pegar nome na água
for (const [nome, x, z] of ROTULOS_LUGAR) console.log(`  rótulo ${nome.padEnd(22)} (${x.toFixed(0)}, ${z.toFixed(0)}) r ${Math.hypot(x, z).toFixed(0)} rumo ${rumoDe(x, z).toFixed(0)} h ${alturaEm(x, z).toFixed(1)} ${naAgua(x, z) ? 'ÁGUA' : 'terra'}`)
if (SO_SVG) process.exit(0)

// ── rasteriza: Chromium sem janela, 1x e 2x; WebP pelo sharp ───────────────
const PW = ['/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs', 'playwright']
let chromium = null
for (const p of PW) { try { ({ chromium } = await import(p)); break } catch { /* tenta o próximo */ } }
if (!chromium) throw new Error('playwright não encontrado: use o caminho de scripts/city/chapas.mjs')
const browser = await chromium.launch()
const pngs = {}
for (const dpr of [1, 2]) {
  const ctx = await browser.newContext({ viewport: { width: LADO, height: LADO }, deviceScaleFactor: dpr })
  const page = await ctx.newPage()
  await page.goto('file://' + SVG_SAIDA)
  await page.evaluate(() => document.fonts ? document.fonts.ready : null)
  await page.waitForTimeout(400)
  pngs[dpr] = await page.screenshot({ type: 'png', omitBackground: false })
  await ctx.close()
}
await browser.close()
const sharp = (await import('sharp')).default
const saidaWebp = resolve(RAIZ, arg('webp', 'public/landing/citymap-1600-v3.webp'))
// o PNG de 1600 é chapa de conferência, não vai para o repositório: o site serve
// o WebP, e o 3200 é o que se imprime
const saidaPng1 = resolve(arg('png1600', `${process.env.CARTA_CHAPAS || '/tmp'}/citymap-1600-v3.png`))
const saidaPng2 = resolve(RAIZ, arg('png3200', 'public/landing/citymap-3200-v3.png'))
await sharp(pngs[1]).png({ compressionLevel: 9 }).toFile(saidaPng1)
await sharp(pngs[2]).png({ compressionLevel: 9 }).toFile(saidaPng2)
await sharp(pngs[1]).webp({ quality: 86, effort: 6 }).toFile(saidaWebp)
for (const f of [saidaPng1, saidaPng2, saidaWebp]) console.log(`${f}: ${(statSync(f).size / 1024).toFixed(0)} KB`)
