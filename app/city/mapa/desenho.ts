// ═══════════════════════════════════════════════════════════════════════════
// O DESENHO: funções puras de canvas 2D, uma por camada, chamadas em ordem por
// mapa-client.tsx a cada `redesenhar()`. Nenhuma delas toca React nem estado,
// só ctx.
//
// ⚠️ TRÊS NÍVEIS, CUMULATIVOS. 'perto' desenha tudo que 'medio' desenha (e
// 'medio' tudo que 'longe' desenha), mais a camada de cima. É assim que o
// zoom nunca "perde" contexto: a via continua lá quando o lote aparece.
//
// ⚠️ CANVAS 2D PURO, NUNCA r3f (regra da casa: @react-three/fiber quebra
// neste repo). Não há WebGL aqui, só CanvasRenderingContext2D.
// ═══════════════════════════════════════════════════════════════════════════
import type { Camera, Nivel } from './camera'
import { mundoParaTela, retanguloVisivel } from './camera'
import type { Malha, Selo, Agua } from './malha'
import { ehAgua } from './malha'
import type { Registro } from './registro'
import { consultarGrade, cantosDoLote } from './registro'
import { COR_SETOR, TIPO_PROGRAMA, NOME_PECA_EN, FUNDO, LARANJA, CIANO_DSC } from './estilo'

export interface Contexto {
  ctx: CanvasRenderingContext2D
  cw: number
  ch: number
  cam: Camera
  nivel: Nivel
  malha: Malha
  agua: Agua
  registro: Registro
  selo: Selo
  fundoImg: HTMLImageElement | null
  selecionado: number
}

const escalaLinha = (metros: number, escala: number, min = 0.75, max = 16) =>
  Math.max(min, Math.min(max, metros * escala))

/** desenha um caminho poligonal (não fechado) pulando trechos sobre água:
 *  é o uso documentado de agua.bin, não riscar via em cima da baía. Todas as
 *  vias passam por aqui, então a checagem é feita num lugar só. */
function tracarSemAgua(ctx: CanvasRenderingContext2D, cam: Camera, cw: number, ch: number, agua: Agua, pontos: readonly [number, number][]) {
  ctx.beginPath()
  let precisaMover = true
  for (let i = 0; i < pontos.length - 1; i++) {
    const [ax, az] = pontos[i], [bx, bz] = pontos[i + 1]
    if (ehAgua(agua, (ax + bx) / 2, (az + bz) / 2)) { precisaMover = true; continue }
    const [sx0, sy0] = mundoParaTela(cam, cw, ch, ax, az)
    const [sx1, sy1] = mundoParaTela(cam, cw, ch, bx, bz)
    if (precisaMover) { ctx.moveTo(sx0, sy0); precisaMover = false }
    ctx.lineTo(sx1, sy1)
  }
  ctx.stroke()
}

function fundo(c: Contexto) {
  const { ctx, cw, ch } = c
  ctx.fillStyle = FUNDO
  ctx.fillRect(0, 0, cw, ch)
  if (!c.fundoImg) return
  const f = c.selo.fundo
  const meia = f.celula / 2
  const [sx0, sy0] = mundoParaTela(c.cam, cw, ch, f.x0 - meia, f.z0 - meia)
  const [sx1, sy1] = mundoParaTela(c.cam, cw, ch, f.x0 + (f.n - 0.5) * f.celula, f.z0 + (f.n - 0.5) * f.celula)
  ctx.drawImage(c.fundoImg, sx0, sy0, sx1 - sx0, sy1 - sy0)
}

function contorno(c: Contexto) {
  const { ctx, cw, ch, cam, malha } = c
  const p = malha.contorno
  ctx.beginPath()
  for (let i = 0; i < p.length; i += 2) {
    const [sx, sy] = mundoParaTela(cam, cw, ch, p[i], p[i + 1])
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
  }
  ctx.closePath()
  ctx.strokeStyle = 'rgba(237,230,214,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function quarteiroes(c: Contexto) {
  const { ctx, cw, ch, cam, malha, nivel } = c
  const { n, setor, poligonos } = malha.quarteiroes
  const fill = nivel !== 'perto'
  for (let i = 0; i < n; i++) {
    const o = i * 8
    const cor = COR_SETOR[setor[i]] ?? '#888888'
    ctx.beginPath()
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = mundoParaTela(cam, cw, ch, poligonos[o + k * 2], poligonos[o + k * 2 + 1])
      if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    if (fill) {
      ctx.globalAlpha = nivel === 'longe' ? 0.5 : 0.4
      ctx.fillStyle = cor
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (nivel !== 'longe') {
      ctx.strokeStyle = 'rgba(10,10,12,0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

function vias(c: Contexto) {
  const { ctx, cw, ch, cam, malha, agua, nivel } = c
  ctx.strokeStyle = '#847C6C'
  for (const b of malha.bulevares) {
    ctx.lineWidth = escalaLinha(b.larguraM, cam.escala)
    tracarSemAgua(ctx, cam, cw, ch, agua, [[b.x0, b.z0], [b.x1, b.z1]])
  }
  for (const a of malha.avenidas) {
    ctx.lineWidth = escalaLinha(a.larguraM, cam.escala, 0.75, 14)
    tracarSemAgua(ctx, cam, cw, ch, agua, [[a.x0, a.z0], [a.x1, a.z1]])
  }
  for (const an of malha.aneisViarios) {
    ctx.lineWidth = escalaLinha(an.larguraM, cam.escala)
    const v = an.vertices
    const pontos: [number, number][] = []
    for (let k = 0; k <= 12; k++) pontos.push([v[(k % 12) * 2], v[(k % 12) * 2 + 1]])
    tracarSemAgua(ctx, cam, cw, ch, agua, pontos)
  }
  // a alça: arco verdadeiro (não dodecágono), rumo 330°→120° passando por 0°
  {
    const passos = 48
    const alca = malha.alca
    const de = alca.rumoIni, ate = alca.rumoFim + 360
    const pontos: [number, number][] = []
    for (let k = 0; k <= passos; k++) {
      const rumo = de + ((ate - de) * k) / passos
      const a = (rumo * Math.PI) / 180
      pontos.push([Math.sin(a) * alca.r, -Math.cos(a) * alca.r])
    }
    ctx.lineWidth = escalaLinha(alca.larguraM, cam.escala)
    tracarSemAgua(ctx, cam, cw, ch, agua, pontos)
  }
  if (nivel === 'longe') return
  // teia: fina, só a partir de 'medio' (168 radiais + 27 anéis, ainda barato)
  ctx.strokeStyle = 'rgba(132,124,108,0.55)'
  ctx.lineWidth = escalaLinha(2.5, cam.escala, 0.5, 3)
  for (const r of malha.teiaRadiais) tracarSemAgua(ctx, cam, cw, ch, agua, [[r.x0, r.z0], [r.x1, r.z1]])
  const passosAnel = 72
  for (const raio of malha.teiaAneis) {
    const pontos: [number, number][] = []
    for (let k = 0; k <= passosAnel; k++) {
      const a = (2 * Math.PI * k) / passosAnel
      pontos.push([Math.sin(a) * raio, -Math.cos(a) * raio])
    }
    tracarSemAgua(ctx, cam, cw, ch, agua, pontos)
  }
}

function bboxTelaDoPoligono(cam: Camera, cw: number, ch: number, poly: Float32Array) {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity
  for (let i = 0; i < poly.length; i += 2) {
    const [sx, sy] = mundoParaTela(cam, cw, ch, poly[i], poly[i + 1])
    if (sx < xmin) xmin = sx
    if (sx > xmax) xmax = sx
    if (sy < ymin) ymin = sy
    if (sy > ymax) ymax = sy
  }
  return { xmin, xmax, ymin, ymax, w: xmax - xmin, h: ymax - ymin }
}

function programa(c: Contexto) {
  const { ctx, cw, ch, cam, malha, nivel } = c
  if (nivel === 'longe') return
  // ⚠️ NOME DUPLICADO, RÓTULO UMA VEZ SÓ. Uma âncora (as 7 grandes) e uma peça
  // comum do programa às vezes apontam para o mesmo nome em inglês (DERBY e
  // E02 são as duas faces de "DOG Derby": a estrutura e o precinto). Sem este
  // filtro o texto empilhava em cima dele mesmo, achado na chapa de 'medio'.
  const nomesDeAncora = new Set(malha.ancoras.map((a) => NOME_PECA_EN[a.id] ?? a.id))
  const desenhaUm = (p: (typeof malha.programa)[number], ancora: boolean) => {
    const cor = TIPO_PROGRAMA[p.tipo]?.cor ?? '#C99A5B'
    const box = bboxTelaDoPoligono(cam, cw, ch, p.poly)
    if (box.xmax < -50 || box.xmin > cw + 50 || box.ymax < -50 || box.ymin > ch + 50) return
    ctx.beginPath()
    for (let i = 0; i < p.poly.length; i += 2) {
      const [sx, sy] = mundoParaTela(cam, cw, ch, p.poly[i], p.poly[i + 1])
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    ctx.globalAlpha = ancora ? 0.55 : 0.4
    ctx.fillStyle = cor
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = ancora ? LARANJA : 'rgba(20,18,14,0.6)'
    ctx.lineWidth = ancora ? 1.5 : 1
    ctx.stroke()
    const nome = NOME_PECA_EN[p.id] ?? p.id
    if (box.w > 46 && box.h > 18 && (ancora || !nomesDeAncora.has(nome))) {
      const [lx, ly] = mundoParaTela(cam, cw, ch, p.cx, p.cz)
      ctx.font = ancora ? '600 12px ui-monospace, monospace' : '11px ui-monospace, monospace'
      ctx.fillStyle = '#EDE6D6'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.85)'
      ctx.shadowBlur = 3
      ctx.fillText(nome, lx, ly)
      ctx.shadowBlur = 0
    }
  }
  for (const p of malha.programa) desenhaUm(p, false)
  for (const p of malha.ancoras) desenhaUm(p, true)
}

const cantosBuf = new Float32Array(8)

/** S07 The Spit / Orla Nobre, S08 Financial District e S09 Bay Shore: cada um
 *  grava UM QUARTEIRÃO POR LOTE (ver o aviso em registro.ts), então eles não
 *  entram em malha.quarteiroes (que só cobre os setores 1-6, o tecido comum) e
 *  o desenho por quarteirão de `quarteiroes()` os pula por completo nos níveis
 *  longe e médio. A legenda promete cor para os três; sem isto nada aparecia.
 *  São só 2.594 lotes ao todo (505+27+2062), então desenhar cada um como o
 *  próprio retângulo (em vez de agregar por fileira) já é barato o bastante
 *  para não custar quadro, inclusive no celular. Em 'perto' não desenha nada
 *  aqui: lotes() já cobre estes mesmos lotes junto com todos os outros. */
function distritosEspeciais(c: Contexto) {
  const { ctx, cw, ch, cam, registro, nivel } = c
  if (nivel === 'perto') return
  for (const i of registro.especiais) {
    cantosDoLote(registro, i, cantosBuf)
    ctx.beginPath()
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = mundoParaTela(cam, cw, ch, cantosBuf[k * 2], cantosBuf[k * 2 + 1])
      if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    ctx.globalAlpha = nivel === 'longe' ? 0.5 : 0.4
    ctx.fillStyle = COR_SETOR[registro.setor[i]] ?? '#888888'
    ctx.fill()
    ctx.globalAlpha = 1
    if (nivel !== 'longe') {
      ctx.strokeStyle = 'rgba(10,10,12,0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

function lotes(c: Contexto) {
  const { ctx, cw, ch, cam, registro, nivel, selecionado } = c
  if (nivel !== 'perto') return
  const { xmin, zmin, xmax, zmax } = retanguloVisivel(cam, cw, ch, 40)
  let desenhados = 0
  const TETO = 12000 // válvula de segurança; a grade de 200 m já limita bem antes disso
  consultarGrade(registro, xmin, zmin, xmax, zmax, (i) => {
    if (desenhados++ > TETO) return
    cantosDoLote(registro, i, cantosBuf)
    ctx.beginPath()
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = mundoParaTela(cam, cw, ch, cantosBuf[k * 2], cantosBuf[k * 2 + 1])
      if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    const selecao = i === selecionado
    ctx.fillStyle = COR_SETOR[registro.setor[i]] ?? '#888888'
    ctx.globalAlpha = selecao ? 0.85 : 0.55
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = selecao ? LARANJA : 'rgba(10,10,12,0.7)'
    ctx.lineWidth = selecao ? 2.5 : 1
    ctx.stroke()
    if (registro.dsc[i]) {
      const [dx, dy] = mundoParaTela(cam, cw, ch, registro.x[i], registro.z[i])
      ctx.fillStyle = CIANO_DSC
      ctx.beginPath()
      ctx.arc(dx, dy, Math.max(1.5, Math.min(4, cam.escala * 1.5)), 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

export function redesenhar(c: Contexto) {
  fundo(c)
  contorno(c)
  quarteiroes(c)
  distritosEspeciais(c)
  vias(c)
  programa(c)
  lotes(c)
}
