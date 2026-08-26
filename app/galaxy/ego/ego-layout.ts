// Layout radial deterministico do ego-grafo: funcao PURA que transforma a
// EgoResponse + viewport + modo mobile em discos, curvas e rotulos ja
// posicionados. A licao anti-Arkham: NADA de force layout, zero aleatorio,
// zero jitter entre visitas; a mesma resposta produz sempre as mesmas
// posicoes e a cena so desenha o que sai daqui (nada de math cara por
// frame: amostras de curva e caixas de rotulo nascem neste passo).
//
// Geometria: centro no meio do viewport, ENTRADAS no semicirculo esquerdo
// e SAIDAS no direito (leitura Arkham). Dentro de cada lado a maior
// contraparte fica colada no eixo horizontal e as demais abrem em leque
// simetrico pra cima e pra baixo, com angulo deterministico por indice.
// Os restos ("+N wallets") moram alem do leque, um por lado.

import type { EgoResponse, EgoEdge, EgoRest, LabelCat } from './ego-types'

export interface EgoViewport {
  width: number
  height: number
}

/** Disco final (centro, contraparte ou bolha de resto). */
export interface EgoLayoutNode {
  /** 'center', 'in:<addr>', 'out:<addr>', 'rest:in' ou 'rest:out'. */
  id: string
  kind: 'center' | 'counterparty' | 'rest'
  /** Lado do no; null so no centro. */
  dir: 'in' | 'out' | null
  /** Endereco da carteira; null nas bolhas de resto. */
  w: string | null
  x: number
  y: number
  /** Raio em px. */
  r: number
  /** Indice da aresta do no em edges; -1 pro centro e pros restos. */
  edgeIdx: number
  edge: EgoEdge | null
  rest: EgoRest | null
}

/** Curva cubica de uma aresta, com amostras pre-computadas pro hit-test. */
export interface EgoLayoutEdge {
  dir: 'in' | 'out'
  edge: EgoEdge
  /** Id do no da contraparte desta aresta. */
  nodeId: string
  /** Espessura em px, escala sqrt com pinca 1..16 desktop / 1..10 mobile. */
  width: number
  /** A curva vai sempre do centro (x0,y0) pra contraparte (x1,y1). */
  x0: number
  y0: number
  cx0: number
  cy0: number
  cx1: number
  cy1: number
  x1: number
  y1: number
  /** Seta de direcao no meio da curva: posicao e angulo do FLUXO. */
  ax: number
  ay: number
  aa: number
  /** Pares x,y achatados (SAMPLES pontos) pro teste de distancia no hover. */
  samples: Float32Array
}

export interface EgoLayoutLabel {
  /**
   * center = chip do no central (rotulo ou endereco truncado);
   * chip = entidade rotulada (dogdata), prioridade maxima de vaga;
   * auto = endereco truncado, so se sobrar vaga;
   * rest = "+N wallets · X DOG" da bolha de resto.
   * Todo rotulo aqui JA passou pelo culling de colisao: quem perdeu a vaga
   * nao existe nesta lista (o endereco fica acessivel so pelo tooltip).
   */
  kind: 'center' | 'chip' | 'auto' | 'rest'
  text: string
  x: number
  y: number
  /** Caixa reservada do rotulo (pro chip de fundo e pro culling). */
  w: number
  h: number
  cat: LabelCat | null
  nodeId: string
}

export interface EgoLayout {
  nodes: EgoLayoutNode[]
  edges: EgoLayoutEdge[]
  labels: EgoLayoutLabel[]
  /** Indice id -> posicao em nodes, pra cena nao varrer o array. */
  index: Record<string, number>
  /** Raio do disco central em px. */
  centerR: number
  width: number
  height: number
  mobile: boolean
}

// Raio do anel de contrapartes como fracao de min(w,h); o mobile abre um
// pouco mais porque trabalha com limit 12 (menos discos, mais respiro).
const R_FRAC = 0.36
const R_FRAC_M = 0.4
// Raio do disco central (maior que qualquer contraparte, e o protagonista).
const CENTER_R = 22
const CENTER_R_M = 16
// Pinca do raio das contrapartes: area segue sqrt(b), ou seja r ~ b^(1/4).
const NODE_R_MIN = 4
const NODE_R_MAX = 14
// Pinca de espessura de aresta por modo.
const EDGE_W_MIN = 1
const EDGE_W_MAX = 16
const EDGE_W_MAX_M = 10
// Abertura maxima do leque pra cada lado do eixo horizontal (radianos).
// 62 graus deixa folga no semicirculo pra bolha de resto nao colidir.
const SPREAD = (62 * Math.PI) / 180
// Angulo fixo da bolha de resto, sempre alem do leque, abaixo do eixo.
const REST_ANGLE = (80 * Math.PI) / 180
// Raio da bolha de resto.
const REST_R = 10
const REST_R_M = 8
// Quantos pontos por curva pro hit-test (pares x,y).
const SAMPLES = 24
// Largura estimada por caractere da fonte mono de 10px e 9px: o layout e
// funcao pura sem canvas, entao o culling mede texto por estimativa
// deterministica (levemente generosa pra nunca subestimar colisao).
const CHAR_W_10 = 6.2
const CHAR_W_9 = 5.6
// Folga entre retangulos de texto no teste de colisao.
const CULL_PAD = 2

/** Endereco truncado no padrao da casa: bc1q…x7f2 (4 + 4). */
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

/** Separador de milhar sem toLocaleString: saida identica em todo runtime. */
export function fmtCount(n: number): string {
  const s = String(Math.round(n))
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const fromEnd = s.length - i
    out += s.charAt(i)
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += ','
  }
  return out
}

/** Retangulo de texto reservado pelo culling de colisao. */
interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Reimplementacao LOCAL do culling por retangulos reservados (mesma ideia
// da flow-layout, de proposito NAO importada de la pra nao acoplar os
// modos). Interseccao com folga: encostado tambem conta como colisao.
function collides(r: Rect, q: Rect): boolean {
  return (
    r.x - CULL_PAD < q.x + q.w &&
    r.x + r.w + CULL_PAD > q.x &&
    r.y - CULL_PAD < q.y + q.h &&
    r.y + r.h + CULL_PAD > q.y
  )
}

/**
 * Angulo do leque pro item de indice i (lista ja ordenada por dog desc):
 * o 0 fica no eixo, os seguintes alternam abaixo/acima em multiplos de um
 * passo fixo, ate a abertura maxima. Positivo = pra baixo na tela.
 */
function fanOffset(i: number, n: number): number {
  if (i === 0 || n <= 1) return 0
  const maxMult = Math.ceil((n - 1) / 2)
  const step = SPREAD / maxMult
  const mult = Math.ceil(i / 2)
  const sign = i % 2 === 1 ? 1 : -1
  return sign * mult * step
}

export function layoutEgo(
  data: EgoResponse,
  viewport: EgoViewport,
  mobile: boolean,
): EgoLayout {
  const width = Math.max(280, viewport.width)
  const height = Math.max(280, viewport.height)
  const cx = width / 2
  const cy = height / 2
  const R = Math.min(width, height) * (mobile ? R_FRAC_M : R_FRAC)
  const centerR = mobile ? CENTER_R_M : CENTER_R
  const edgeWMax = mobile ? EDGE_W_MAX_M : EDGE_W_MAX
  const restR = mobile ? REST_R_M : REST_R

  // Ordena defensivamente por dog desc: a API ja manda assim, mas o layout
  // e quem garante o determinismo do leque (copia local, resposta imutavel).
  const inflows = data.inflows.slice().sort((a, b) => b.dog - a.dog)
  const outflows = data.outflows.slice().sort((a, b) => b.dog - a.dog)

  // Escalas relativas ao proprio ego: o maior saldo vira o disco de 14px e
  // o maior par vira a aresta de teto; tudo deterministico por resposta.
  let bMax = 1
  let dogMax = 1
  for (const e of inflows) {
    if (e.b > bMax) bMax = e.b
    if (e.dog > dogMax) dogMax = e.dog
  }
  for (const e of outflows) {
    if (e.b > bMax) bMax = e.b
    if (e.dog > dogMax) dogMax = e.dog
  }

  // Area do disco segue sqrt(b): raio ~ b^(1/4), normalizado pelo maior.
  const radiusFor = (b: number): number => {
    if (b <= 0) return NODE_R_MIN
    const s = Math.sqrt(Math.sqrt(b / bMax))
    return NODE_R_MIN + (NODE_R_MAX - NODE_R_MIN) * Math.min(1, s)
  }
  const widthFor = (dog: number): number => {
    if (dog <= 0) return EDGE_W_MIN
    const w = edgeWMax * Math.sqrt(dog / dogMax)
    return Math.min(edgeWMax, Math.max(EDGE_W_MIN, w))
  }

  const nodes: EgoLayoutNode[] = []
  const edges: EgoLayoutEdge[] = []
  const index: Record<string, number> = {}

  index['center'] = nodes.length
  nodes.push({
    id: 'center',
    kind: 'center',
    dir: null,
    w: data.center.w,
    x: cx,
    y: cy,
    r: centerR,
    edgeIdx: -1,
    edge: null,
    rest: null,
  })

  const placeSide = (list: EgoEdge[], dir: 'in' | 'out') => {
    const n = list.length
    const sideSign = dir === 'in' ? -1 : 1
    for (let i = 0; i < n; i++) {
      const e = list[i]
      const off = fanOffset(i, n)
      // Vetor unitario do centro pra contraparte (esquerda ou direita).
      const ux = Math.cos(off) * sideSign
      const uy = Math.sin(off)
      const x = cx + R * ux
      const y = cy + R * uy
      const r = radiusFor(e.b)
      const id = dir + ':' + e.w
      const edgeIdx = edges.length

      // Curva do CENTRO pra contraparte com tangentes horizontais (mesma
      // linguagem de curva do sankey do Flow), encostando na borda dos
      // dois discos, nunca no miolo.
      const x0 = cx + centerR * ux
      const y0 = cy + centerR * uy
      const x1 = x - (r + 1) * ux
      const y1 = y - (r + 1) * uy
      const midX = (x0 + x1) / 2
      const cx0 = midX
      const cy0 = y0
      const cx1 = midX
      const cy1 = y1

      // Amostras da cubica pro hit-test por distancia (nada por frame).
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

      // Seta no meio da curva (t = 0.5): ponto e tangente analiticos. A
      // curva sempre vai do centro pra fora, entao no lado de ENTRADA o
      // fluxo real e o inverso e a seta gira meia-volta.
      const ax = (x0 + 3 * cx0 + 3 * cx1 + x1) / 8
      const ay = (y0 + 3 * cy0 + 3 * cy1 + y1) / 8
      const dxv = 0.75 * (cx0 - x0) + 1.5 * (cx1 - cx0) + 0.75 * (x1 - cx1)
      const dyv = 0.75 * (cy0 - y0) + 1.5 * (cy1 - cy0) + 0.75 * (y1 - cy1)
      let aa = Math.atan2(dyv, dxv)
      if (dir === 'in') aa += Math.PI

      edges.push({
        dir,
        edge: e,
        nodeId: id,
        width: widthFor(e.dog),
        x0, y0, cx0, cy0, cx1, cy1, x1, y1,
        ax, ay, aa,
        samples,
      })
      index[id] = nodes.length
      nodes.push({
        id,
        kind: 'counterparty',
        dir,
        w: e.w,
        x,
        y,
        r,
        edgeIdx,
        edge: e,
        rest: null,
      })
    }
  }

  placeSide(inflows, 'in')
  placeSide(outflows, 'out')

  // Bolhas de resto, uma por lado, sempre alem do leque (angulo fixo maior
  // que a abertura maxima), abaixo do eixo horizontal.
  const placeRest = (rest: EgoRest | null, dir: 'in' | 'out') => {
    if (!rest || rest.n <= 0) return
    const sideSign = dir === 'in' ? -1 : 1
    const x = cx + R * Math.cos(REST_ANGLE) * sideSign
    const y = cy + R * Math.sin(REST_ANGLE)
    const id = 'rest:' + dir
    index[id] = nodes.length
    nodes.push({
      id,
      kind: 'rest',
      dir,
      w: null,
      x,
      y,
      r: restR,
      edgeIdx: -1,
      edge: null,
      rest,
    })
  }
  placeRest(data.restIn, 'in')
  placeRest(data.restOut, 'out')

  // ---- rotulos com culling de colisao ----
  // A lista reserved guarda todo retangulo ja aceito; um rotulo so desenha
  // se a caixa dele nao intersecta nenhum reservado. Prioridade de reserva:
  // (a) chip do centro, (b) chips de entidade (dogdata), (c) restos,
  // (d) enderecos truncados. Quem perde a vaga fica so no tooltip.
  const labels: EgoLayoutLabel[] = []
  const reserved: Rect[] = []
  const charW = mobile ? CHAR_W_9 : CHAR_W_10
  const chipH = mobile ? 13 : 15
  const isFree = (box: Rect): boolean => {
    for (const q of reserved) {
      if (collides(box, q)) return false
    }
    return true
  }
  const pushIfFree = (lb: EgoLayoutLabel, box: Rect): void => {
    if (!isFree(box)) return
    reserved.push(box)
    labels.push(lb)
  }
  const clampX = (x: number, w: number): number => {
    if (x < 2) return 2
    if (x + w > width - 2) return width - 2 - w
    return x
  }

  // (a) chip do centro: rotulo se houver, senao endereco truncado.
  {
    const c = data.center
    const text = c.label ? c.label.name.toUpperCase() : truncAddr(c.w)
    const w = text.length * charW + 10
    const x = clampX(cx - w / 2, w)
    const y = cy + centerR + 8
    pushIfFree(
      {
        kind: 'center',
        text,
        x,
        y,
        w,
        h: chipH,
        cat: c.label ? c.label.cat : null,
        nodeId: 'center',
      },
      { x, y, w, h: chipH },
    )
  }

  // (b) chips de entidade rotulada nas contrapartes, sempre pro lado de
  // fora do anel (esquerda nas entradas, direita nas saidas). Verified nao
  // entra: so anel fino no disco + nome no hover.
  for (const ln of nodes) {
    if (ln.kind !== 'counterparty' || !ln.edge) continue
    const lab = ln.edge.label
    if (!lab || lab.source !== 'dogdata') continue
    const text = lab.name.toUpperCase()
    const w = text.length * charW + 10
    const rawX = ln.dir === 'in' ? ln.x - ln.r - 6 - w : ln.x + ln.r + 6
    const x = clampX(rawX, w)
    const y = ln.y - chipH / 2
    pushIfFree(
      { kind: 'chip', text, x, y, w, h: chipH, cat: lab.cat, nodeId: ln.id },
      { x, y, w, h: chipH },
    )
  }

  // (c) restos: "+N wallets · X DOG" logo abaixo da bolha.
  for (const ln of nodes) {
    if (ln.kind !== 'rest' || !ln.rest) continue
    const text =
      '+' + fmtCount(ln.rest.n) + ' wallets · ' + fmtDog(ln.rest.dog) + ' DOG'
    const w = text.length * charW + 8
    const x = clampX(ln.x - w / 2, w)
    const y = ln.y + ln.r + 6
    pushIfFree(
      { kind: 'rest', text, x, y, w, h: chipH, cat: null, nodeId: ln.id },
      { x, y, w, h: chipH },
    )
  }

  // (d) enderecos truncados das contrapartes sem chip, APENAS se sobrar
  // vaga livre depois de tudo que importa mais.
  for (const ln of nodes) {
    if (ln.kind !== 'counterparty' || !ln.edge) continue
    const lab = ln.edge.label
    if (lab && lab.source === 'dogdata') continue
    const text = truncAddr(ln.edge.w)
    const w = text.length * charW
    const h = 10
    const rawX = ln.dir === 'in' ? ln.x - ln.r - 6 - w : ln.x + ln.r + 6
    const x = clampX(rawX, w)
    const y = ln.y - h / 2
    pushIfFree(
      { kind: 'auto', text, x, y, w, h, cat: null, nodeId: ln.id },
      { x, y, w, h },
    )
  }

  return {
    nodes,
    edges,
    labels,
    index,
    centerR,
    width,
    height,
    mobile,
  }
}
