// Layout deterministico do sankey do Flow: funcao PURA que transforma a
// FlowResponse + viewport + orientacao em retangulos, curvas e rotulos ja
// posicionados. Zero forca, zero aleatorio: a mesma entrada produz sempre a
// mesma saida, e a cena so desenha o que sai daqui (zero alocacao por frame
// no loop de render: tudo que custa memoria nasce neste passo).

import type {
  FlowResponse,
  FlowNode,
  RestNode,
  FlowLink,
  LabelCat,
} from './flow-types'

export type FlowOrientation = 'h' | 'v'

export interface FlowViewport {
  width: number
  height: number
}

/** Retangulo final de um no (individual, resto ou fantasma). */
export interface LayoutNode {
  /** Carteira, id de resto (g2:holders) ou 'ghost'. */
  id: string
  kind: 'node' | 'rest' | 'ghost'
  x: number
  y: number
  w: number
  h: number
  gen: number
  /** So a raiz (G0) ganha glow. */
  glow: boolean
  node: FlowNode | null
  rest: RestNode | null
}

/** Curva cubica de um link, com amostras pre-computadas pro hit-test. */
export interface LayoutLink {
  link: FlowLink
  /** Espessura em px, escala sqrt com pinca 1..40. */
  width: number
  back: boolean
  x0: number
  y0: number
  cx0: number
  cy0: number
  cx1: number
  cy1: number
  x1: number
  y1: number
  /** Pares x,y achatados (SAMPLES pontos) pro teste de distancia no hover. */
  samples: Float32Array
}

export interface LayoutLabel {
  /**
   * chip = entidade rotulada (dogdata), sempre visivel;
   * auto = endereco truncado, so em barra >= 24px;
   * rest = "N wallets, X DOG"; ghost = ancora do re-root.
   */
  kind: 'chip' | 'auto' | 'rest' | 'ghost'
  text: string
  sub: string | null
  x: number
  y: number
  /** Categoria pra cor de header do chip (exchange azul). */
  cat: LabelCat | null
  nodeId: string
}

export interface LayoutRulerBar {
  dog: number
  px: number
  text: string
}

export interface LayoutRuler {
  x: number
  y: number
  bars: LayoutRulerBar[]
}

export interface LayoutColLabel {
  text: string
  x: number
  y: number
}

export interface FlowLayout {
  nodes: LayoutNode[]
  links: LayoutLink[]
  labels: LayoutLabel[]
  ruler: LayoutRuler
  colLabels: LayoutColLabel[]
  /** Indice id -> posicao em nodes, pra cena nao varrer o array. */
  index: Record<string, number>
  /** Fator da escala sqrt (px por sqrt(DOG)), o mesmo de nos e links. */
  scaleK: number
  orientation: FlowOrientation
  width: number
  height: number
}

// Espessura fixa da barra do no no eixo do fluxo.
const BAR = 14
// Vao minimo entre nos empilhados na mesma coluna.
const GAP = 10
// Pinca de espessura de link exigida pela spec: 1px a 40px.
const LINK_MIN = 1
const LINK_MAX = 40
// Altura minima de barra pra continuar clicavel mesmo com valor minusculo.
const NODE_MIN = 4
// Quantos pontos por curva pro hit-test (pares x,y).
const SAMPLES = 24
// Barras da regua fixa: 10M, 1B e 10B DOG.
const RULER_DOGS = [10e6, 1e9, 10e9]

/** Endereco truncado no padrao da spec: bc1q…x7f2 (4 + 4). */
export function truncAddr(w: string): string {
  if (w.length <= 11) return w
  return w.slice(0, 4) + '…' + w.slice(-4)
}

/** Formata DOG compacto: 12.4B, 850M, 3.2K. Copy do site em ingles. */
export function fmtDog(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e9) return trim(v / 1e9) + 'B'
  if (abs >= 1e6) return trim(v / 1e6) + 'M'
  if (abs >= 1e3) return trim(v / 1e3) + 'K'
  return trim(v)
}

function trim(n: number): string {
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
  return s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function fmtCount(n: number): string {
  // Separador de milhar sem toLocaleString pra saida ser identica em
  // qualquer runtime (layout deterministico ate no texto).
  const s = String(Math.round(n))
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const fromEnd = s.length - i
    out += s.charAt(i)
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += ','
  }
  return out
}

/** Volume que dimensiona a barra: o maior entre recebido, enviado e saldo. */
function volumeOf(inDog: number, outDog: number, b: number): number {
  const v = Math.max(inDog, outDog, b)
  return v > 0 ? v : 1
}

// Item interno de empilhamento (no individual ou resto) em coordenadas
// abstratas: main = eixo do fluxo, cross = eixo de empilhamento. No h,
// main = x e cross = y; no v (mobile) troca, e a raiz fica no topo.
interface StackItem {
  id: string
  kind: 'node' | 'rest'
  node: FlowNode | null
  rest: RestNode | null
  gen: number
  volume: number
  main: number
  cross: number
  size: number
}

interface AnchorSlot {
  linkIdx: number
  width: number
  otherCross: number
}

export function layoutFlow(
  data: FlowResponse,
  viewport: FlowViewport,
  orientation: FlowOrientation,
): FlowLayout {
  const width = Math.max(320, viewport.width)
  const height = Math.max(320, viewport.height)
  const mainSize = orientation === 'h' ? width : height
  const crossSize = orientation === 'h' ? height : width

  // Margens em coordenadas abstratas. A folga inicial no eixo main abriga o
  // no fantasma do re-root; a final, os rotulos da ultima coluna.
  const mainStart = data.ghost ? 96 : 48
  const mainEnd = mainSize - 56
  const crossTop = 34
  const crossBottom = 72

  // ---- colunas: G0 e a raiz sozinha, depois as colunas da resposta ----
  const columns: StackItem[][] = []
  const rootItem: StackItem = {
    id: data.root.w,
    kind: 'node',
    node: data.root,
    rest: null,
    gen: 0,
    volume: volumeOf(data.root.in, data.root.out, data.root.b),
    main: 0,
    cross: 0,
    size: 0,
  }
  columns.push([rootItem])

  for (const col of data.cols) {
    if (col.gen === 0) continue
    const items: StackItem[] = []
    for (const n of col.nodes) {
      items.push({
        id: n.w,
        kind: 'node',
        node: n,
        rest: null,
        gen: col.gen,
        volume: volumeOf(n.in, n.out, n.b),
        main: 0,
        cross: 0,
        size: 0,
      })
    }
    for (const r of col.rest) {
      items.push({
        id: r.id,
        kind: 'rest',
        node: null,
        rest: r,
        gen: col.gen,
        volume: volumeOf(r.in, r.out, r.b),
        main: 0,
        cross: 0,
        size: 0,
      })
    }
    if (items.length > 0) columns.push(items)
  }

  // ---- escala sqrt unica pra nos e links ----
  // k e o maior fator que ainda faz TODAS as colunas caberem no eixo cross.
  const crossAvail = crossSize - crossTop - crossBottom
  let k = Infinity
  for (const items of columns) {
    let sumSqrt = 0
    for (const it of items) sumSqrt += Math.sqrt(it.volume)
    const usable = crossAvail - GAP * (items.length - 1)
    if (sumSqrt > 0 && usable > 0) {
      const kCol = usable / sumSqrt
      if (kCol < k) k = kCol
    }
  }
  if (!isFinite(k) || k <= 0) k = 1

  // ---- posicao main de cada coluna, espacamento uniforme ----
  const nCols = columns.length
  const step = nCols > 1 ? (mainEnd - mainStart - BAR) / (nCols - 1) : 0
  for (let ci = 0; ci < nCols; ci++) {
    const items = columns[ci]
    const main = mainStart + step * ci
    let total = GAP * (items.length - 1)
    for (const it of items) {
      it.size = Math.max(NODE_MIN, k * Math.sqrt(it.volume))
      total += it.size
    }
    // Pilha centralizada no eixo cross pro sankey nao pender pra um lado.
    let cross = crossTop + Math.max(0, (crossAvail - total) / 2)
    for (const it of items) {
      it.main = main
      it.cross = cross
      cross += it.size + GAP
    }
  }

  // Conversao abstrato -> tela. No v o fluxo escorre de cima pra baixo.
  const toX = (main: number, cross: number) => (orientation === 'h' ? main : cross)
  const toY = (main: number, cross: number) => (orientation === 'h' ? cross : main)

  // ---- retangulos finais ----
  const nodes: LayoutNode[] = []
  const index: Record<string, number> = {}
  const itemById: Record<string, StackItem> = {}
  for (const items of columns) {
    for (const it of items) {
      itemById[it.id] = it
      index[it.id] = nodes.length
      nodes.push({
        id: it.id,
        kind: it.kind,
        x: toX(it.main, it.cross),
        y: toY(it.main, it.cross),
        w: orientation === 'h' ? BAR : it.size,
        h: orientation === 'h' ? it.size : BAR,
        gen: it.gen,
        glow: it.gen === 0 && it.kind === 'node',
        node: it.node,
        rest: it.rest,
      })
    }
  }

  // No fantasma do re-root: barra apagada antes da raiz, so ancora visual.
  if (data.ghost) {
    const gSize = 40
    const gMain = mainStart - 64
    const gCross = rootItem.cross + rootItem.size / 2 - gSize / 2
    index['ghost'] = nodes.length
    nodes.push({
      id: 'ghost',
      kind: 'ghost',
      x: toX(gMain, gCross),
      y: toY(gMain, gCross),
      w: orientation === 'h' ? BAR : gSize,
      h: orientation === 'h' ? gSize : BAR,
      gen: -1,
      glow: false,
      node: null,
      rest: null,
    })
  }

  // ---- links: espessura sqrt, ancoras empilhadas na borda do no ----
  const widths: number[] = []
  for (let i = 0; i < data.links.length; i++) {
    const w = k * Math.sqrt(Math.max(0, data.links[i].dog))
    widths.push(Math.min(LINK_MAX, Math.max(LINK_MIN, w)))
  }

  // Distribui as ancoras ao longo da borda do no na ordem do cross do outro
  // lado, pra links nao nascerem todos no centro e se atropelarem.
  const outSlots: Record<string, AnchorSlot[]> = {}
  const inSlots: Record<string, AnchorSlot[]> = {}
  for (let i = 0; i < data.links.length; i++) {
    const l = data.links[i]
    if (l.back) continue
    const s = itemById[l.s]
    const t = itemById[l.t]
    if (!s || !t) continue
    if (!outSlots[l.s]) outSlots[l.s] = []
    if (!inSlots[l.t]) inSlots[l.t] = []
    outSlots[l.s].push({ linkIdx: i, width: widths[i], otherCross: t.cross })
    inSlots[l.t].push({ linkIdx: i, width: widths[i], otherCross: s.cross })
  }
  const sortSlots = (slots: AnchorSlot[]) => {
    slots.sort((a, b) => a.otherCross - b.otherCross || a.linkIdx - b.linkIdx)
  }
  const anchorAt: Record<string, { out: Record<number, number>; in: Record<number, number> }> = {}
  const fillAnchors = (
    slotsMap: Record<string, AnchorSlot[]>,
    side: 'out' | 'in',
  ) => {
    for (const id in slotsMap) {
      if (!Object.prototype.hasOwnProperty.call(slotsMap, id)) continue
      const slots = slotsMap[id]
      sortSlots(slots)
      const it = itemById[id]
      let total = 0
      for (const sl of slots) total += sl.width
      // Se a soma das espessuras passa da altura do no, comprime tudo
      // proporcionalmente pra caber dentro da barra.
      const fit = total > it.size && total > 0 ? it.size / total : 1
      let cur = it.cross + Math.max(0, (it.size - total * fit) / 2)
      if (!anchorAt[id]) anchorAt[id] = { out: {}, in: {} }
      for (const sl of slots) {
        anchorAt[id][side][sl.linkIdx] = cur + (sl.width * fit) / 2
        cur += sl.width * fit
      }
    }
  }
  fillAnchors(outSlots, 'out')
  fillAnchors(inSlots, 'in')

  // Fundo das colunas: base dos arcos de refluxo, sempre por baixo de tudo.
  let maxCrossBottomOfNodes = crossTop
  for (const items of columns) {
    for (const it of items) {
      const bottom = it.cross + it.size
      if (bottom > maxCrossBottomOfNodes) maxCrossBottomOfNodes = bottom
    }
  }
  const backBase = Math.min(crossSize - 34, maxCrossBottomOfNodes + 30)

  const links: LayoutLink[] = []
  for (let i = 0; i < data.links.length; i++) {
    const l = data.links[i]
    const s = itemById[l.s]
    const t = itemById[l.t]
    if (!s || !t) continue
    const lw = widths[i]
    let m0: number
    let c0: number
    let m1: number
    let c1: number
    let km0: number
    let kc0: number
    let km1: number
    let kc1: number
    if (l.back) {
      // Refluxo: sai do fundo do no de origem, mergulha abaixo das colunas
      // e sobe no fundo do destino (que esta numa coluna anterior).
      m0 = s.main + BAR / 2
      c0 = s.cross + s.size
      m1 = t.main + BAR / 2
      c1 = t.cross + t.size
      km0 = m0
      kc0 = backBase
      km1 = m1
      kc1 = backBase
    } else {
      m0 = s.main + BAR
      c0 = anchorAt[l.s] && anchorAt[l.s].out[i] !== undefined
        ? anchorAt[l.s].out[i]
        : s.cross + s.size / 2
      m1 = t.main
      c1 = anchorAt[l.t] && anchorAt[l.t].in[i] !== undefined
        ? anchorAt[l.t].in[i]
        : t.cross + t.size / 2
      const mid = (m0 + m1) / 2
      km0 = mid
      kc0 = c0
      km1 = mid
      kc1 = c1
    }
    const x0 = toX(m0, c0)
    const y0 = toY(m0, c0)
    const cx0 = toX(km0, kc0)
    const cy0 = toY(km0, kc0)
    const cx1 = toX(km1, kc1)
    const cy1 = toY(km1, kc1)
    const x1 = toX(m1, c1)
    const y1 = toY(m1, c1)
    // Amostras da cubica pro hit-test por distancia (nada de math por frame).
    const samples = new Float32Array(SAMPLES * 2)
    for (let sIdx = 0; sIdx < SAMPLES; sIdx++) {
      const u = sIdx / (SAMPLES - 1)
      const a = 1 - u
      const b0 = a * a * a
      const b1 = 3 * a * a * u
      const b2 = 3 * a * u * u
      const b3 = u * u * u
      samples[sIdx * 2] = b0 * x0 + b1 * cx0 + b2 * cx1 + b3 * x1
      samples[sIdx * 2 + 1] = b0 * y0 + b1 * cy0 + b2 * cy1 + b3 * y1
    }
    links.push({
      link: l,
      width: lw,
      back: !!l.back,
      x0, y0, cx0, cy0, cx1, cy1, x1, y1,
      samples,
    })
  }

  // ---- rotulos ----
  const labels: LayoutLabel[] = []
  for (const ln of nodes) {
    if (ln.kind === 'ghost') {
      const g = data.ghost
      labels.push({
        kind: 'ghost',
        text: g && g.label ? g.label.name.toUpperCase() : truncAddr(g ? g.w : ''),
        sub: 'BACK',
        x: ln.x,
        y: ln.y - 8,
        cat: g && g.label ? g.label.cat : null,
        nodeId: 'ghost',
      })
      continue
    }
    if (ln.kind === 'rest' && ln.rest) {
      // Resto sempre ganha rotulo, e o unico jeito de saber o que ele soma.
      labels.push({
        kind: 'rest',
        text: fmtCount(ln.rest.n) + ' WALLETS',
        sub: fmtDog(ln.rest.kind === 'holders' ? ln.rest.b : ln.rest.in) + ' DOG',
        x: orientation === 'h' ? ln.x + ln.w + 6 : ln.x,
        y: orientation === 'h' ? ln.y + ln.h / 2 : ln.y + ln.h + 12,
        cat: null,
        nodeId: ln.id,
      })
      continue
    }
    const n = ln.node
    if (!n) continue
    const barSize = orientation === 'h' ? ln.h : ln.w
    if (n.label && n.label.source === 'dogdata') {
      // Chip de entidade rotulada: SEMPRE visivel, mono caps, cor por
      // categoria. Verified nao entra aqui: so anel fino + nome no hover.
      labels.push({
        kind: 'chip',
        text: n.label.name.toUpperCase(),
        sub: null,
        x: orientation === 'h' ? ln.x : ln.x + ln.w + 6,
        y: orientation === 'h' ? ln.y - 8 : ln.y + 4,
        cat: n.label.cat,
        nodeId: ln.id,
      })
    } else if (barSize >= 24) {
      // Endereco sem rotulo nunca ganha texto permanente em barra pequena:
      // rotulo automatico so quando a barra tem 24px ou mais.
      labels.push({
        kind: 'auto',
        text: truncAddr(n.w),
        sub: null,
        x: orientation === 'h' ? ln.x + ln.w + 6 : ln.x,
        y: orientation === 'h' ? ln.y + ln.h / 2 : ln.y + ln.h + 12,
        cat: null,
        nodeId: ln.id,
      })
    }
  }

  // ---- rotulos de coluna ----
  const colLabels: LayoutColLabel[] = []
  for (let ci = 0; ci < nCols; ci++) {
    const items = columns[ci]
    if (items.length === 0) continue
    const gen = items[0].gen
    const text = gen === 0 ? 'G0 ROOT' : gen >= 4 ? 'G4+' : 'G' + gen
    const main = items[0].main + BAR / 2
    colLabels.push({
      text,
      x: orientation === 'h' ? main : 12,
      y: orientation === 'h' ? 18 : main,
    })
  }

  // ---- regua fixa: 10M / 1B / 10B na mesma escala sqrt dos links ----
  const rulerBars: LayoutRulerBar[] = []
  for (const dog of RULER_DOGS) {
    rulerBars.push({
      dog,
      px: Math.min(LINK_MAX, Math.max(LINK_MIN, k * Math.sqrt(dog))),
      text: fmtDog(dog) + ' DOG',
    })
  }
  const ruler: LayoutRuler = {
    x: 16,
    y: height - 20,
    bars: rulerBars,
  }

  return {
    nodes,
    links,
    labels,
    ruler,
    colLabels,
    index,
    scaleK: k,
    orientation,
    width,
    height,
  }
}
