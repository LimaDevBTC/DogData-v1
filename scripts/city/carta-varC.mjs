#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// VARIANTE C: O SELO. Cópia de carta.mjs (23/09) só com a camada de estilo
// trocada, a pedido do brief marketing/CARTA-BRIEF.md. Direção: poster de
// alto contraste, marketing primeiro, não artefato técnico. Fundo quase preto
// quente, a cidade em creme e dourado (contraste alto contra o fundo, ao
// contrário da v3, onde quarteirão e fundo ficavam no mesmo tom de bege), a
// água em petróleo mais fundo, o arco laranja mais grosso (era um fio na v3),
// tipografia como herói (DOGCITY grande, merkle root em friso monoespaçado na
// base inteira da folha, números do cartucho em destaque) e só os 14 rótulos
// de lugar que importam para quem compra, grandes e sem colisão (a v3 tinha
// "$DOG ARENA / CAMPUS" colados e nome de planta industrial no poster).
// Geometria, dados e fontes de leitura são os mesmos de carta.mjs; nada aqui
// decide onde fica um lote ou quanto mede um setor.
//
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

// ── a paleta do SELO: fundo quase preto quente, cidade em creme e dourado,
// contraste alto de propósito (a v3 tinha quarteirão e fundo no mesmo tom) ──
const FUNDO = '#1A1512'
const CREME = '#F6ECD9', BRUMA = '#C9BBA0', APAGADO = '#8A7A61'
const LARANJA = '#E8660D', LARANJA_CLARO = '#FFAE5C'
const AGUA = '#0E3644', AGUA_FUNDA = '#071E27', COSTA = '#7FAFC0', AREIA = '#C9A878'
const VIA = '#F6ECD9'
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const cor = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mistura = (a, b, t) => cor(hex(a).map((v, i) => v + (hex(b)[i] - v) * t))
// rampa por paradas: t em [0,1] percorre as paradas em ordem
const rampa = (paradas) => (t) => {
  const k = Math.min(paradas.length - 2, Math.max(0, Math.floor(t * (paradas.length - 1))))
  return mistura(paradas[k], paradas[k + 1], t * (paradas.length - 1) - k)
}
// o relevo no SELO é textura sutil, não feature: a rampa inteira fica perto
// do preto quente do fundo (a v2 deixava a curva de nível correr forte pela
// folha toda; aqui o herói é a tipografia e o par cidade/fundo, o relevo só
// dá textura de lua por baixo). A banda mais clara continua abaixo do
// quarteirão mais escuro, com folga bem maior do que na v3.
const TERRA_RAMPA = rampa(['#1A1512', '#211B16', '#28211A', '#312820', '#3B2F25'])
// os nove setores: dourado e creme, faixa BEM mais larga que a v3 (a crítica
// da v3 era "quase o mesmo tom"). Nove passos iguais, permutados para que
// setores vizinhos não caiam em tons vizinhos.
const SETOR_RAMPA = rampa(['#7A5A2C', '#B8934C', '#DFC079', '#F6E4B8'])
const SETOR_T = { 1: 0.625, 2: 0.25, 3: 0.5, 4: 0.125, 5: 0.375, 6: 0.0, 7: 1.0, 8: 0.875, 9: 0.75 }
const corSetor = (s) => SETOR_RAMPA(SETOR_T[s])
const NOME_SETOR = { 7: 'ORLA NOBRE · THE SPIT', 8: 'FINANCIAL DISTRICT', 9: 'BAY SHORE' }

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (x, y, txt, o = {}) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" fill="${o.cor || CREME}" `
  + `font-family="${FAMILIA}" font-size="${o.tam || 10}" letter-spacing="${o.esp ?? 2}" `
  + `opacity="${o.op ?? 1}" text-anchor="${o.anc || 'start'}"${o.rot ? ` transform="rotate(${o.rot} ${(+x).toFixed(1)} ${(+y).toFixed(1)})"` : ''}>${esc(txt)}</text>\n`
// rótulo curvo sobre um arco de rumo a0 -> a1 (sentido horário), raio r em metros
let nArco = 0
let defs = ''
const TC = (r, a0, a1, txt, o = {}) => {
  const id = `arco${nArco++}`
  const [x0, z0] = doRumo(r, a0), [x1, z1] = doRumo(r, a1)
  const grande = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0
  defs += `<path id="${id}" d="M${pt(x0, z0)}A${(r * ESC).toFixed(1)} ${(r * ESC).toFixed(1)} 0 ${grande} 1 ${pt(x1, z1)}"/>\n`
  return `<text fill="${o.cor || CREME}" font-family="${FAMILIA}" font-size="${o.tam || 10}" letter-spacing="${o.esp ?? 3}" opacity="${o.op ?? 1}">`
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
NIVEIS.forEach((v, k) => {
  const ls = contornos(v, g2).map((l) => simplifica(l, 0.35))
  if (!ls.length) return
  nPontosRelevo += ls.reduce((s, l) => s + l.length, 0)
  corpo += `<path d="${caminho(ls, true)}" fill="${TERRA_RAMPA((k + 1) / NIVEIS.length)}" fill-rule="evenodd" `
    + `stroke="#4A3F30" stroke-width="0.35" stroke-opacity="0.16"/>\n`
})
console.log(`relevo: ${NIVEIS.length} bandas, ${nPontosRelevo} pontos, ${Date.now() - t0} ms`)

// a água em resolução cheia (15 m): a linha de costa é o que mais se lê
const g1 = grade(1)
const terraLaços = contornos(COTA_AGUA, g1).map((l) => simplifica(l, 0.25))
const fundoLaços = contornos(-75, g1).map((l) => simplifica(l, 0.35))
const rc = R_CASCA * ESC, cx = LADO / 2
const disco = `M${(cx - rc).toFixed(1)} ${cx}a${rc.toFixed(1)} ${rc.toFixed(1)} 0 1 0 ${(2 * rc).toFixed(1)} 0a${rc.toFixed(1)} ${rc.toFixed(1)} 0 1 0 ${(-2 * rc).toFixed(1)} 0Z`
defs += `<clipPath id="casca"><circle cx="${cx}" cy="${cx}" r="${rc.toFixed(1)}"/></clipPath>\n`
corpo += `<g clip-path="url(#casca)">\n`
// a praia: um traço de areia na costa, pintado ANTES da água, que cobre a
// metade molhada dele e deixa a metade seca como faixa clara na margem
corpo += `<path d="${caminho(terraLaços, false)}" fill="none" stroke="${AREIA}" stroke-width="2.4" stroke-opacity="0.5"/>\n`
// ⚠️ ÁGUA = DISCO MENOS TERRA. `contornos(cota)` delimita a região ACIMA da cota;
// pintar isso pinta a terra. O path leva o disco da casca E os laços de terra
// com evenodd, que subtrai um do outro. E o clip-path é obrigatório mesmo assim:
// evenodd conta cruzamento no plano inteiro, e sem o recorte o terreno alto de
// fora da casca (dentro de um laço, fora do disco) sairia azul.
corpo += `<path d="${disco}${caminho(terraLaços, true)}" fill="${AGUA}" fill-rule="evenodd"/>\n`
corpo += `<path d="${disco}${caminho(fundoLaços, true)}" fill="${AGUA_FUNDA}" fill-rule="evenodd" opacity="0.85"/>\n`
corpo += `<path d="${caminho(terraLaços, false)}" fill="none" stroke="${COSTA}" stroke-width="0.7" stroke-opacity="0.75"/>\n`
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
// nenhum que alguém consulte. No SELO o recuo é um pouco maior (a crítica da
// v3 era rua fina demais para ler em 1.600 px).
const RECUO = 2.1
const porSetor = {}
for (const b of malha.quarteiroes) {
  const s = b.setor
  porSetor[s] = (porSetor[s] || '') + poli(retangulo(b.x, b.z, b.lado / 2 - RECUO, b.prof / 2 - RECUO, b.giro))
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
  porSetor[setor] = (porSetor[setor] || '') + poli(retangulo(x, z, frente / 2 + 0.8, prof / 2 + 0.8, giro))
}
for (const s of Object.keys(porSetor).map(Number).sort((a, b) => a - b)) {
  // traço escuro fino em volta de cada quarteirão: reforça a rua como vão,
  // que na v3 sumia em 1.600 px por ser só o recuo entre polígonos
  corpo += `<path d="${porSetor[s]}" fill="${corSetor(s)}" stroke="${FUNDO}" stroke-width="0.6" stroke-opacity="0.55"/>\n`
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
// SELO: só 14 nomes de lugar na folha inteira (o brief é explícito: "menos e
// mais", e a crítica da v3 era rótulo demais colidindo e nome de planta
// industrial). Estes 8 mais os 6 que já têm chamada própria mais abaixo
// (Satoshi Plaza, Financial District, Orla Nobre, Bay Shore, The Bay,
// Founders Club) somam os 14 do brief. CAMPUS fica de fora de propósito: não
// está na lista do fundador e era ele que colava em "$DOG ARENA" na v3.
const ROTULOS_PERMITIDOS = new Set(['G01', 'K01', 'ESTADIO', 'GEODE', 'SPHERE', 'ATLETISMO', 'AQUATICS', 'DERBY'])
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
const AREA_ROTULO = 60000   // m²: abaixo disso o nome não cabe nem no 3200
const ROTULOS_LUGAR = []    // para conferir depois contra a superfície
for (const p of cidade.programa) {
  const pol = poligonoDe(p)
  const [cxm, czm] = centroide(pol)
  if (Math.abs(cxm) > QUADRO + 300 || Math.abs(czm) > QUADRO + 300) continue
  if (p.tipo === 'agua') continue          // lago é água na superfície, não hachura
  const d = poli(pol)
  nPecas++
  if (ANCORAS.has(p.id)) { hachurasA += d; contornosA += d } else { hachuras += d }
  const area = areaDe(pol)
  const nome = NOME_CURTO[p.id]
  if (!nome || area < AREA_ROTULO || !ROTULOS_PERMITIDOS.has(p.id)) continue
  let [lx, lz] = [cxm, czm]
  // o estádio mora dentro do campus: os dois centróides coincidem. O nome do
  // campus vai para a metade do polígono mais longe do estádio.
  if (p.id === 'CAMPUS') {
    const est = cidade.programa.find((q) => q.id === 'ESTADIO')
    const [ex, ez] = centroide(poligonoDe(est))
    const longe = [...pol].sort((a, b) => Math.hypot(b[0] - ex, b[1] - ez) - Math.hypot(a[0] - ex, a[1] - ez)).slice(0, 2)
    const [mx, mz] = centroide(longe)
    lx = ex + (mx - ex) * 0.72; lz = ez + (mz - ez) * 0.72
  }
  ROTULOS_LUGAR.push([nome, lx, lz])
  const ancora = ANCORAS.has(p.id)
  // grande: só sobraram 14 rótulos na folha inteira, cada um pode ser herói
  rotulos += T(mPx(lx), mPx(lz) + 4, nome, { tam: ancora ? 12 : 10, esp: ancora ? 3 : 2.2, anc: 'middle', cor: ancora ? LARANJA_CLARO : CREME, op: ancora ? 0.98 : 0.92 })
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
  rotulos += T(mPx(fx), mPx(fz) + FC.r_ext * ESC + 10, 'FOUNDERS CLUB', { tam: 7, esp: 1.6, anc: 'middle', op: 0.85 })
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
  avenidas += via(tracaSobreTerra(pts), a.papel === 'distrito' ? 16 : 12)
}
// os anéis: seis dodecágonos com vértice em r nas 12 avenidas, e a AN7 circular
let aneis = ''
let an7Path = ''
for (const an of mapa.aneisViarios) {
  if (an.circulo) {
    const [a0, a1] = an.arco
    const pts = []
    for (let g = 0; g <= ((a1 - a0 + 360) % 360); g += 0.25) pts.push(doRumo(an.r, a0 + g))
    an7Path = tracaSobreTerra(pts)
    continue
  }
  const pts = []
  for (let k = 0; k < 12; k++) {
    const [x0, z0] = doRumo(an.r, k * 30), [x1, z1] = doRumo(an.r, (k + 1) * 30)
    pts.push(...amostraReta(x0, z0, x1, z1).slice(k ? 1 : 0))
  }
  // dentro da alça de terra não há outra rua além da AN7 (fundador, 07/09)
  const filt = pts.filter(([x, z]) => !(Math.hypot(x, z) >= ALCA_R_DENTRO && noArco(rumoDe(x, z), ALCA_TERRA)))
  aneis += via(tracaSobreTerra(filt), an.larg >= 34 ? 14 : 12)
}
corpo += avenidas + aneis
// a AN7, laranja da marca: a única cor quente saturada da folha, a assinatura.
// No SELO ela é bem mais grossa que na v3 (lá virou um fio): um halo largo e
// escurecido por baixo, o traço laranja cheio por cima, e uma linha clara no
// miolo. É a primeira coisa que o olho pega no poster.
corpo += via(an7Path, 50, { cor: mistura(LARANJA, FUNDO, 0.45), op: 0.5 })
corpo += via(an7Path, 32, { cor: LARANJA, op: 1 })
corpo += `<path d="${an7Path.terra}" fill="none" stroke="${LARANJA_CLARO}" stroke-width="1.6" stroke-opacity="0.95"/>\n`

// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 5: TOPÔNIMOS, SETORES, ROSA, ESCALA, CARTUCHO
// ═══════════════════════════════════════════════════════════════════════════
// a Praça e o Distrito Financeiro (anel de 27 lotes em r 992, dentro da Praça)
const rDF = (() => {
  let s = 0, n = 0
  for (let i = 0; i < nLotes; i++) { const o = i * REG; if (bin.readUInt8(o + 4) + 1 !== 8) continue; s += Math.hypot(bin.readInt16LE(o) / 4, bin.readInt16LE(o + 2) / 4); n++ }
  return n ? s / n : 992
})()
corpo += `<circle cx="${cx}" cy="${cx}" r="4.5" fill="${LARANJA}"/>\n`
rotulos += T(cx, cx - 18, 'SATOSHI PLAZA', { tam: 15, esp: 6, anc: 'middle' })
rotulos += TC(rDF + 150, 300, 60, NOME_SETOR[8], { tam: 11, esp: 4.5, op: 0.95 })
// a Orla Nobre, na alça: nome curvo por fora da fileira de trás (r 7.000 a 7.044)
const meioAlca = ((ALCA_TERRA[0] + ((ALCA_TERRA[1] - ALCA_TERRA[0] + 360) % 360) / 2) % 360)
// SELO: rótulo maior precisa de outro arco. Centrado em meioAlca (rumo 51) ele
// caía embaixo da chave de distritos (medido: a caixa vai de x 1334 a 1566,
// y 116 a 267 no 1600, e o texto passava bem no meio). Deslocado para rumo 68
// ele sai da caixa (fica à esquerda dela até rumo ~45, abaixo dela depois de
// rumo ~48) e ainda não chega no rumo 103 do Runestone Gate.
rotulos += TC(7128, 45, 91, NOME_SETOR[7], { tam: 13, esp: 5, op: 0.98 })
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
for (const rm of rumosBaia) rotulos += TC(3985, rm - 12, rm + 12, NOME_SETOR[9], { tam: 11, esp: 4.5, op: 0.98 })
// a baía: nome no espelho d'água, entre o Founders Club e a alça
const baia = mapa.agua.lagos.baia
const rumoBaia = rumoDe(baia.x, baia.z)
ROTULOS_LUGAR.push(['THE BAY', ...doRumo(5950, rumoBaia - 14)])
rotulos += TC(5950, rumoBaia - 30, rumoBaia + 2, 'THE BAY', { tam: 13, esp: 7, cor: mistura(COSTA, CREME, 0.55), op: 0.9 })
// SELO: sem sigla S01..S06 no corpo do mapa. O brief pede só os 14 nomes de
// lugar na folha inteira; o código de S01..S09 já mora na chave de distritos,
// e repetir a sigla em cima do tecido era clutter que a v3 não precisava.
corpo += rotulos

// ── moldura do SELO: tipografia como herói ─────────────────────────────────
// A v2 vendia com um letreiro pequeno numa caixa. Aqui o letreiro é grande e
// sangra direto no fundo quase preto (os cantos do quadro caem fora da casca,
// então é só relevo escuro atrás, igual a v2 fazia); o cartucho vira uma
// linha de números grandes; e o merkle root ganha um friso monoespaçado
// correndo a base inteira da folha, de margem a margem.
const m = 34
const painel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0D0C0A" fill-opacity="0.9" stroke="${CREME}" stroke-opacity="0.16" stroke-width="0.8"/>\n`
const dataSelo = (() => {
  const d = statSync(resolve(RAIZ, 'data/dogcity_merkle.json')).mtime
  const mes = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  return `${String(d.getUTCDate()).padStart(2, '0')} ${mes} ${d.getUTCFullYear()}`
})()
let mob = ''
// letreiro sem caixa visível, grande, a peça que se reconhece em miniatura no
// X. Um selo sólido do próprio fundo vai por baixo só para o texto não brigar
// com a hachura de terra do projeto que mora nesse canto (é canto de fora da
// casca, mas ainda dentro do quadro): mesma cor do fundo, sem borda, então
// não lê como caixa, só apaga o que estava atrás.
mob += `<rect x="0" y="0" width="478" height="158" fill="${FUNDO}" opacity="0.95"/>\n`
mob += T(m - 2, m + 58, 'DOGCITY', { tam: 58, esp: 14 })
mob += T(m, m + 82, 'MARE TRANQUILLITATIS · THE MOON', { tam: 10, esp: 4, op: 0.78 })
mob += `<line x1="${m}" y1="${m + 94}" x2="${m + 280}" y2="${m + 94}" stroke="${LARANJA}" stroke-width="2.5" opacity="0.9"/>\n`
mob += T(m, m + 112, 'CADASTRAL CHART · DOG DATA', { tam: 8.5, esp: 2.4, cor: LARANJA_CLARO, op: 0.9 })
// rosa dos ventos, sem caixa
const nx = LADO - m - 20, ny = m + 34
mob += `<path d="M${nx} ${ny - 28}L${nx + 9} ${ny + 9}L${nx} ${ny}L${nx - 9} ${ny + 9}Z" fill="${CREME}" opacity="0.92"/>\n`
mob += `<path d="M${nx} ${ny}L${nx + 9} ${ny + 9}L${nx} ${ny + 28}L${nx - 9} ${ny + 9}Z" fill="${CREME}" opacity="0.35"/>\n`
mob += T(nx, ny - 34, 'N', { tam: 12, esp: 0, anc: 'middle', op: 0.95 })
// chave dos setores, canto superior direito, abaixo da rosa
const CH = [
  [7, 'S07 · ORLA NOBRE · THE SPIT'], [8, 'S08 · FINANCIAL DISTRICT'], [9, 'S09 · BAY SHORE'],
  [1, 'S01'], [2, 'S02'], [3, 'S03'], [4, 'S04'], [5, 'S05'], [6, 'S06'],
]
const kx = LADO - m - 232, ky = m + 82
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
  ['AN7 · THE SPIT AVENUE', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${LARANJA}" stroke-width="4.5"/>`],
  ['AVENUES · RING ROADS', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${VIA}" stroke-width="2.4"/>`],
  ['BRIDGE', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${VIA}" stroke-width="2.2" stroke-dasharray="2.2 1.6"/>`],
  ['CANAL', (x, y) => `<line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${AGUA}" stroke-width="4"/><line x1="${x}" y1="${y - 3}" x2="${x + 14}" y2="${y - 3}" stroke="${COSTA}" stroke-width="5.2" stroke-opacity="0.35"/>`],
  ['STREETS READ AS THE GAP', (x, y) => `<rect x="${x}" y="${y - 7}" width="6" height="8" fill="${corSetor(3)}"/><rect x="${x + 8}" y="${y - 7}" width="6" height="8" fill="${corSetor(5)}"/>`],
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
// o cartucho do SELO: números em destaque (o brief pede isso explicitamente).
// O merkle root sai daqui: ele vira o friso na base da folha, mais abaixo, e
// não se repete em miniatura na caixa para não competir com os números.
const carteiras = cidade.carteiras, lotesTot = merkle.lotes ?? cidade.lotes.total, lapides = merkle.lapides ?? cidade.cemiterio.lapides
const cw = 460, chh = 100, cxp = LADO - m - cw, cyp = LADO - m - chh
mob += painel(cxp, cyp, cw, chh)
mob += T(cxp + 16, cyp + 22, `BLOCK ${merkle.bloco.toLocaleString('en-US')}`, { tam: 15, esp: 3.5, cor: LARANJA_CLARO })
mob += T(cxp + cw - 16, cyp + 22, `SEALED ${dataSelo}`, { tam: 8, esp: 2, op: 0.65, anc: 'end' })
const STATS = [[lotesTot, 'LOTS'], [carteiras, 'WALLETS'], [lapides, 'HEADSTONES']]
STATS.forEach(([n, cap], i) => {
  const x = cxp + 16 + i * 150
  mob += `<text x="${x}" y="${cyp + 64}" fill="${CREME}" font-family="${FAMILIA}" font-size="25" letter-spacing="0.5" `
    + `stroke="${CREME}" stroke-width="0.6">${n.toLocaleString('en-US')}</text>\n`
  mob += T(x, cyp + 79, cap, { tam: 7.5, esp: 2.6, op: 0.62 })
})
mob += T(cxp + 16, cyp + 92, 'DOG DATA', { tam: 7.5, esp: 3, op: 0.55 })
// o friso: o merkle root inteiro, monoespaçado, correndo a base da folha de
// margem a margem (textLength estica o traço até a largura exata, sem depender
// de acertar letter-spacing na mão para 64 caracteres hex)
const frLabel = 'MERKLE ROOT', frX0 = 16, frX1 = LADO - 16, frLabelFim = frX0 + 100
mob += `<line x1="${frX0}" y1="${LADO - 27}" x2="${frX1}" y2="${LADO - 27}" stroke="${CREME}" stroke-opacity="0.14" stroke-width="0.7"/>\n`
mob += T(frX0, LADO - 10, frLabel, { tam: 7.5, esp: 2.4, op: 0.55 })
mob += `<text x="${frLabelFim}" y="${LADO - 10}" fill="${CREME}" font-family="${FAMILIA}" font-size="11.5" opacity="0.85" `
  + `textLength="${(frX1 - frLabelFim).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${merkle.root}</text>\n`

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
