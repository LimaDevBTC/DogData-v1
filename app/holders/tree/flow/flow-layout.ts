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
   * chip = entidade rotulada (dogdata), prioridade maxima de vaga;
   * auto = endereco truncado, so desktop, barra >= 24px E vaga livre;
   * rest = "N wallets · X DOG" em linha unica; ghost = ancora do re-root.
   * Todo rotulo aqui JA passou pelo culling de colisao do layout: quem
   * perdeu a vaga nao existe nesta lista (aparece so no tooltip).
   */
  kind: 'chip' | 'auto' | 'rest' | 'ghost'
  text: string
  sub: string | null
  x: number
  y: number
  /** Caixa reservada do rotulo (pro chip de fundo e pro culling). */
  w: number
  h: number
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
  /** Mobile: regua em linha horizontal unica em vez de barras empilhadas. */
  compact: boolean
  /**
   * Area reservada da regua no canto inferior esquerdo: a cena pinta esse
   * retangulo com fundo solido e o layout nunca posiciona rotulo dentro.
   */
  bg: { x: number; y: number; w: number; h: number }
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
// Pinca de espessura de link: 1px ao teto do modo. No desktop o teto segue
// a spec original (40px); num canvas de 390px uma faixa de 40px vira parede,
// entao o mobile tem teto proprio de 14px.
const LINK_MIN = 1
const LINK_MAX = 40
const LINK_MAX_V = 14
// Refluxo tem tetos ainda menores: 12px no desktop; no mobile vira traco
// fino FIXO de 1.5px (nunca faixa), senao forma cortina por cima de tudo.
const LINK_MAX_BACK_H = 12
const BACK_W_V = 1.5
// Altura minima de barra pra continuar clicavel mesmo com valor minusculo
// (3px no mobile, onde cada pixel de empilhamento custa caro).
const NODE_MIN = 4
const NODE_MIN_V = 3
// Respiro minimo entre faixas de geracao no mobile; se nao couber no
// viewport, o excedente sai por pan, nunca por aperto.
const BAND_STEP_MIN_V = 120
// Teto de nos nomeados por faixa no mobile, mesmo que a API mande mais.
const MAX_NAMED_V = 5
// Quantos pontos por curva pro hit-test (pares x,y).
const SAMPLES = 24
// Barras da regua fixa: 10M, 1B e 10B DOG.
const RULER_DOGS = [10e6, 1e9, 10e9]
// Largura estimada por caractere da fonte mono de 10px e 9px: o layout e
// funcao pura sem canvas, entao o culling mede texto por estimativa
// deterministica (levemente generosa pra nunca subestimar colisao).
const CHAR_W_10 = 6.2
const CHAR_W_9 = 5.6
// Folga entre retangulos de texto no teste de colisao.
const CULL_PAD = 2

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

/** Corta o texto com elipse pra caber em maxW px (estimativa por char). */
function ellipsize(text: string, maxW: number, charW: number): string {
  if (text.length * charW <= maxW) return text
  const keep = Math.max(1, Math.floor(maxW / charW) - 1)
  return text.slice(0, keep) + '…'
}

/** Retangulo de texto reservado pelo culling de colisao. */
interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Interseccao com folga de CULL_PAD: encostado tambem conta como colisao. */
function collides(r: Rect, q: Rect): boolean {
  return (
    r.x - CULL_PAD < q.x + q.w &&
    r.x + r.w + CULL_PAD > q.x &&
    r.y - CULL_PAD < q.y + q.h &&
    r.y + r.h + CULL_PAD > q.y
  )
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
  // no fantasma do re-root; a final, os rotulos da ultima coluna. No mobile
  // a margem inferior e de 48px e pertence a AREA DE DESENHO: e onde vive a
  // regua compacta, nenhum no entra la.
  const mainStart = data.ghost ? 96 : 48
  const mainEnd = orientation === 'v' ? mainSize - 48 : mainSize - 56
  const crossTop = 34
  const crossBottom = 72

  // ---- colunas: G0 e a raiz sozinha, depois as colunas da resposta ----
  // No mobile aplica o teto de MAX_NAMED_V nos nomeados por faixa: o corte
  // e pelo menor fluxo e o excedente se funde ao resto local do mesmo tipo
  // (holders/spent), com a fusao anotada no rotulo do resto.
  const cutTo: Record<string, string> = {}
  const mergedInto: Record<string, number> = {}
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
    let named = col.nodes
    // Copia local dos restos: a fusao do excedente muda os totais e a
    // resposta da API nunca pode ser mutada (funcao pura).
    let restList: RestNode[] = col.rest
    if (orientation === 'v' && named.length > MAX_NAMED_V) {
      restList = col.rest.map((r) => ({ ...r }))
      const sorted = named
        .slice()
        .sort(
          (a, b) => volumeOf(b.in, b.out, b.b) - volumeOf(a.in, a.out, a.b),
        )
      named = sorted.slice(0, MAX_NAMED_V)
      for (let i = MAX_NAMED_V; i < sorted.length; i++) {
        const n = sorted[i]
        const kind: 'holders' | 'spent' = n.h ? 'holders' : 'spent'
        let r: RestNode | undefined
        for (const cand of restList) {
          if (cand.kind === kind) {
            r = cand
            break
          }
        }
        if (!r) {
          // A coluna nao tinha resto desse tipo: nasce um local, com o
          // mesmo formato de id que a API usa em ?expand=.
          r = {
            id: 'g' + String(col.gen) + ':' + kind,
            gen: col.gen,
            kind,
            n: 0,
            b: 0,
            in: 0,
            out: 0,
          }
          restList.push(r)
        }
        r.n += 1
        r.b += n.b
        r.in += n.in
        r.out += n.out
        cutTo[n.w] = r.id
        mergedInto[r.id] = (mergedInto[r.id] || 0) + 1
      }
    }
    for (const n of named) {
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
    for (const r of restList) {
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
  let step = nCols > 1 ? (mainEnd - mainStart - BAR) / (nCols - 1) : 0
  // Mobile: respiro obrigatorio de BAND_STEP_MIN_V entre faixas; o que nao
  // couber no viewport a cena resolve por pan, nunca por aperto.
  if (orientation === 'v' && nCols > 1 && step < BAND_STEP_MIN_V) {
    step = BAND_STEP_MIN_V
  }
  const nodeMin = orientation === 'v' ? NODE_MIN_V : NODE_MIN
  for (let ci = 0; ci < nCols; ci++) {
    const items = columns[ci]
    const main = mainStart + step * ci
    let total = GAP * (items.length - 1)
    for (const it of items) {
      it.size = Math.max(nodeMin, k * Math.sqrt(it.volume))
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

  // ---- regua fixa: 10M / 1B / 10B na mesma escala sqrt dos links ----
  // Calculada ANTES de links e rotulos porque a area dela e reservada: o
  // refluxo desvia do retangulo e o culling de rotulos ja nasce com ele
  // ocupado. No mobile a regua e compacta, numa linha horizontal so.
  const rulerLinkMax = orientation === 'v' ? LINK_MAX_V : LINK_MAX
  const rulerBars: LayoutRulerBar[] = []
  for (const dog of RULER_DOGS) {
    rulerBars.push({
      dog,
      px: Math.min(rulerLinkMax, Math.max(LINK_MIN, k * Math.sqrt(dog))),
      text: fmtDog(dog) + ' DOG',
    })
  }
  let ruler: LayoutRuler
  if (orientation === 'v') {
    // Linha unica: barra vertical fininha + texto, lado a lado.
    let rw = 12
    for (const b of rulerBars) {
      rw += Math.max(2, b.px) + 5 + b.text.length * CHAR_W_9 + 10
    }
    ruler = {
      x: 16,
      y: height - 16,
      bars: rulerBars,
      compact: true,
      bg: { x: 8, y: height - 34, w: Math.min(width - 16, rw + 8), h: 28 },
    }
  } else {
    let totalH = 0
    let tmax = 0
    for (const b of rulerBars) {
      totalH += Math.max(b.px, 10) + 7
      if (b.text.length > tmax) tmax = b.text.length
    }
    ruler = {
      x: 16,
      y: height - 20,
      bars: rulerBars,
      compact: false,
      bg: {
        x: 8,
        y: height - 20 - totalH - 8,
        w: 36 + tmax * CHAR_W_9 + 16,
        h: totalH + 24,
      },
    }
  }

  // ---- links: espessura sqrt, ancoras empilhadas na borda do no ----
  // Antes de medir, redireciona pros restos os links de nos fundidos pelo
  // teto de densidade mobile: fluxo nunca some, so muda de dono.
  const effLinks: FlowLink[] = []
  for (const l of data.links) {
    const s = cutTo[l.s] || l.s
    const t = cutTo[l.t] || l.t
    // Fluxo que virou interno ao proprio resto depois da fusao: descarta.
    if (s === t) continue
    effLinks.push(s === l.s && t === l.t ? l : { ...l, s, t })
  }
  // Teto de espessura por modo: 14px no mobile, 40px no desktop; refluxo
  // tem teto proprio (12px desktop) e traco fixo de 1.5px no mobile.
  const linkMax = orientation === 'v' ? LINK_MAX_V : LINK_MAX
  const widths: number[] = []
  for (let i = 0; i < effLinks.length; i++) {
    const raw = k * Math.sqrt(Math.max(0, effLinks[i].dog))
    let w = Math.min(linkMax, Math.max(LINK_MIN, raw))
    if (effLinks[i].back) {
      w = orientation === 'v' ? BACK_W_V : Math.min(LINK_MAX_BACK_H, w)
    }
    widths.push(w)
  }

  // Distribui as ancoras ao longo da borda do no na ordem do cross do outro
  // lado, pra links nao nascerem todos no centro e se atropelarem.
  const outSlots: Record<string, AnchorSlot[]> = {}
  const inSlots: Record<string, AnchorSlot[]> = {}
  for (let i = 0; i < effLinks.length; i++) {
    const l = effLinks[i]
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
  let backBase = Math.min(crossSize - 34, maxCrossBottomOfNodes + 30)
  if (orientation === 'h') {
    // A regua vive no rodape: o corredor do refluxo nao pode invadir a
    // area reservada dela (e o fundo solido da regua cobre o que sobrar).
    backBase = Math.min(backBase, ruler.bg.y - 8)
    backBase = Math.max(backBase, maxCrossBottomOfNodes + 8)
  }

  const links: LayoutLink[] = []
  for (let i = 0; i < effLinks.length; i++) {
    const l = effLinks[i]
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

  // ---- rotulos com culling de colisao ----
  // A lista `reserved` guarda todo retangulo de texto ja aceito (a regua
  // entra reservada de fabrica). Um rotulo so desenha se a caixa dele nao
  // intersecta nenhuma reservada (com folga de 2px); quem perde a vaga NAO
  // desenha e fica acessivel so pelo tooltip/hover. Prioridade de reserva:
  // (a) chips de entidade + ancora do ghost, (b) restos, (c) enderecos.
  const labels: LayoutLabel[] = []
  const reserved: Rect[] = [ruler.bg]
  const isFree = (box: Rect): boolean => {
    for (const q of reserved) {
      if (collides(box, q)) return false
    }
    return true
  }
  const pushIfFree = (lb: LayoutLabel, box: Rect): void => {
    if (!isFree(box)) return
    reserved.push(box)
    labels.push(lb)
  }

  // Passo (a): ghost + chips de entidade rotulada. Verified nao entra:
  // so anel fino no no + nome no hover.
  for (const ln of nodes) {
    if (ln.kind === 'ghost') {
      const g = data.ghost
      const text = g && g.label ? g.label.name.toUpperCase() : truncAddr(g ? g.w : '')
      const gw = Math.max(text.length * CHAR_W_10, 4 * CHAR_W_9)
      pushIfFree(
        {
          kind: 'ghost',
          text,
          sub: 'BACK',
          x: ln.x,
          y: ln.y - 8,
          w: gw,
          h: 22,
          cat: g && g.label ? g.label.cat : null,
          nodeId: 'ghost',
        },
        { x: ln.x, y: ln.y - 14, w: gw, h: 22 },
      )
      continue
    }
    const n = ln.node
    if (!n || !n.label || n.label.source !== 'dogdata') continue
    const text = n.label.name.toUpperCase()
    const cw = text.length * CHAR_W_10 + 10
    const ch = 15
    let x = orientation === 'h' ? ln.x : ln.x + ln.w + 6
    const y = orientation === 'h' ? ln.y - 8 : ln.y + 4
    // Mobile: chip nunca vaza pra fora da borda direita do canvas.
    if (orientation === 'v' && x + cw > width - 4) x = Math.max(4, width - 4 - cw)
    pushIfFree(
      {
        kind: 'chip',
        text,
        sub: null,
        x,
        y,
        w: cw,
        h: ch,
        cat: n.label.cat,
        nodeId: ln.id,
      },
      { x, y: y - ch / 2, w: cw, h: ch },
    )
  }

  // Passo (b): restos em LINHA UNICA "N wallets · X DOG", com elipse se a
  // largura ate a proxima coluna nao der; fonte 9px no mobile. A fusao do
  // teto de densidade aparece anotada como "(+N)".
  const restCharW = orientation === 'v' ? CHAR_W_9 : CHAR_W_10
  const restBoxH = orientation === 'v' ? 13 : 15
  for (const ln of nodes) {
    if (ln.kind !== 'rest' || !ln.rest) continue
    const dogVal = ln.rest.kind === 'holders' ? ln.rest.b : ln.rest.in
    let text = fmtCount(ln.rest.n) + ' wallets · ' + fmtDog(dogVal) + ' DOG'
    const merged = mergedInto[ln.id]
    if (merged) text += ' (+' + String(merged) + ')'
    let x: number
    let y: number
    let maxW: number
    if (orientation === 'h') {
      x = ln.x + ln.w + 6
      // Largura maxima: ate a proxima coluna, nunca por cima dela.
      const span = nCols > 1 ? step : mainEnd - mainStart
      maxW = Math.max(40, span - BAR - 14)
      y = ln.y + ln.h / 2 - restBoxH / 2
    } else {
      x = ln.x
      y = ln.y + ln.h + 6
      maxW = Math.max(40, width - x - 8)
    }
    text = ellipsize(text, maxW - 8, restCharW)
    const bw = text.length * restCharW + 8
    // Mobile: se a vaga abaixo da faixa esta tomada (a ultima faixa mora
    // colada na area reservada da regua), tenta a vaga acima da faixa
    // antes de desistir do rotulo.
    if (orientation === 'v' && !isFree({ x, y, w: bw, h: restBoxH })) {
      y = ln.y - 6 - restBoxH
    }
    pushIfFree(
      {
        kind: 'rest',
        text,
        sub: null,
        x,
        y,
        w: bw,
        h: restBoxH,
        cat: null,
        nodeId: ln.id,
      },
      { x, y, w: bw, h: restBoxH },
    )
  }

  // Passo (c): enderecos truncados, SO no desktop (no mobile endereco de
  // no sem rotulo jamais e permanente, fica no hover) e so em barra >= 24px
  // que ainda ache vaga livre.
  if (orientation === 'h') {
    for (const ln of nodes) {
      if (ln.kind !== 'node' || !ln.node) continue
      const n = ln.node
      if (n.label && n.label.source === 'dogdata') continue
      if (ln.h < 24) continue
      const text = truncAddr(n.w)
      const x = ln.x + ln.w + 6
      const y = ln.y + ln.h / 2
      const bw = text.length * CHAR_W_10
      pushIfFree(
        {
          kind: 'auto',
          text,
          sub: null,
          x,
          y,
          w: bw,
          h: 10,
          cat: null,
          nodeId: ln.id,
        },
        { x, y: y - 5, w: bw, h: 10 },
      )
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
