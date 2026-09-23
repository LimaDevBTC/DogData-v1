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
import type { Malha, Selo, Agua, Via } from './malha'
import type { Registro } from './registro'
import { consultarGrade, cantosDoLote, rumoMundo } from './registro'
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

/** desenha uma polilinha em coordenadas de mundo. Nenhum corte de água aqui:
 *  cada `Via` que chega em `malha.vias` já saiu VIVA do dump de
 *  `app/city/plaza/vias.ts` (ver a doutrina em `malha.ts`), ou seja já passou
 *  por água, alça, orla e (na teia) pela poda de conectividade. Recortar de
 *  novo contra `agua.bin` aqui seria aplicar uma SEGUNDA régua, mais grosseira
 *  (célula de agua.bin contra o corte analítico da cena) e sobre uma ponte de
 *  verdade ela cortaria certo o pavimento que a cena decidiu manter. */
function tracarPoligonal(ctx: CanvasRenderingContext2D, cam: Camera, cw: number, ch: number, pontos: readonly (readonly [number, number])[]) {
  if (pontos.length < 2) return
  ctx.beginPath()
  for (let i = 0; i < pontos.length; i++) {
    const [sx, sy] = mundoParaTela(cam, cw, ch, pontos[i][0], pontos[i][1])
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
  }
  ctx.stroke()
}

const cantosBuf = new Float32Array(8)

/** traça o CONTORNO do lote `i` (chame ctx.beginPath() antes; fill/stroke
 *  depois, é de quem chama). Reto pelos 4 cantos para geo 0/2/3; para geo=1
 *  (fatia de anel, emenda 23/09 ao §41) a frente e o fundo são ARCOS de
 *  círculo centrados na ORIGEM, não a corda entre os cantos gravados — uma
 *  corda cortaria dezenas de metros para dentro num arco largo. Os dois
 *  círculos são MUNDIAIS (centro (0,0), a Praça); a câmera só translada e
 *  escala, nunca gira (doutrina de camera.ts), então continuam círculos na
 *  tela e dá para usar ctx.arc() nativo em vez de tesselar em segmentos. */
function tracarLote(ctx: CanvasRenderingContext2D, cam: Camera, cw: number, ch: number, r: Registro, i: number) {
  cantosDoLote(r, i, cantosBuf)
  const [p0x, p0z, p1x, p1z, p2x, p2z, p3x, p3z] = cantosBuf
  if (r.geo[i] !== 1) {
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = mundoParaTela(cam, cw, ch, cantosBuf[k * 2], cantosBuf[k * 2 + 1])
      if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
    return
  }
  // rumo do mundo -> ângulo do canvas: 0 rad do canvas aponta para +x (leste),
  // crescendo para +y (sul); rumo 0 aponta para -z (norte), crescendo para +x
  // (leste). A mesma rotação de 90° (-π/2) alinha os dois em qualquer sentido.
  const ang = (rumo: number) => rumo - Math.PI / 2
  const r0 = Math.hypot(p0x, p0z), r1 = Math.hypot(p2x, p2z)
  const a0 = rumoMundo(p0x, p0z), a1 = rumoMundo(p1x, p1z)
  const [ox, oy] = mundoParaTela(cam, cw, ch, 0, 0)
  const [sx0, sy0] = mundoParaTela(cam, cw, ch, p0x, p0z)
  ctx.moveTo(sx0, sy0)
  ctx.arc(ox, oy, r0 * cam.escala, ang(a0), ang(a1), false)
  const [sx2, sy2] = mundoParaTela(cam, cw, ch, p2x, p2z)
  ctx.lineTo(sx2, sy2)
  ctx.arc(ox, oy, r1 * cam.escala, ang(a1), ang(a0), true)
  ctx.closePath()
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
  const { n, setor, poligonos, lotes } = malha.quarteiroes
  const fill = nivel !== 'perto'
  for (let i = 0; i < n; i++) {
    // §39: 138 quarteirões da malha não têm nenhum lote (peça sem reserva ou
    // sonda livre demais); pintar o envoltório deles pinta terreno onde não
    // há lote nenhum. O fundo de quarteirão só existe para o olho ler o
    // bloco à distância, nunca para inventar área que ninguém tem.
    if (lotes[i] === 0) continue
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

// ⚠️ "ANEL" COBRE DUAS COISAS (ver a doutrina em `malha.ts`, tipo `Via`): o
// anel viário arterial (26-44 m, inclui a AN7 em círculo) e o arco fino da
// teia (12 m). Nenhum anel viário publicado tem menos de 20 m; nenhuma via da
// teia tem mais. A largura é o único sinal que sobrou para separar os dois
// traços, porque o dump não inventa um sétimo `tipo` só para isto.
const LARG_ANEL_ESTRUTURAL = 20
const ehEstrutural = (v: Via) => v.tipo === 'avenida' || (v.tipo === 'anel' && v.larg >= LARG_ANEL_ESTRUTURAL)

function vias(c: Contexto) {
  const { ctx, cw, ch, cam, malha, nivel } = c
  const lista = malha.vias
  // ⚠️ SEM REDE, SEM REDESENHO — NUNCA REDERIVAÇÃO. `malha.vias` só é `null`
  // quando `public/city/mapa/vias.json` faltou ou veio malformado; o mapa
  // continua funcionando (quarteirão, programa e lote não dependem de via) e
  // `mapa-client.tsx` avisa no canto. A tentação de "se faltar, calcule você
  // mesmo" é exatamente a regressão que esta tarefa veio consertar.
  if (!lista) return

  // estrutural: avenida e anel viário, em TODOS os níveis de zoom.
  ctx.strokeStyle = '#847C6C'
  for (const v of lista) {
    if (!ehEstrutural(v)) continue
    ctx.lineWidth = escalaLinha(v.larg, cam.escala, 0.75, 16)
    tracarPoligonal(ctx, cam, cw, ch, v.pontos)
  }
  if (nivel === 'longe') return
  // local: teia (radial/travessa/arco fino) e via de orla, translúcida e só a
  // partir de 'medio' — mesmo corte de sempre, ainda barato neste zoom.
  ctx.strokeStyle = 'rgba(132,124,108,0.55)'
  ctx.lineWidth = escalaLinha(2.5, cam.escala, 0.5, 3)
  for (const v of lista) {
    if (ehEstrutural(v)) continue
    tracarPoligonal(ctx, cam, cw, ch, v.pontos)
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
    ctx.beginPath()
    tracarLote(ctx, cam, cw, ch, registro, i)
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
    ctx.beginPath()
    tracarLote(ctx, cam, cw, ch, registro, i)
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
