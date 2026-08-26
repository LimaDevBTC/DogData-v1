'use client'

// Cena do Flow: canvas 2D puro (Three nunca carrega aqui), DPR ate 2,
// hit-testing proprio por retangulo e por amostras de curva. Todo o layout
// vem pronto de flow-layout.ts; o loop de desenho so le arrays ja alocados
// (zero alocacao por frame) e so roda quando ha mudanca de estado, hover ou
// a animacao do tracejado do link em hover/selecao.

import { useEffect, useMemo, useRef, useState } from 'react'

import type { PointerEvent as ReactPointerEvent } from 'react'
import type { FlowResponse, LabelCat } from './flow-types'
import { layoutFlow, truncAddr, fmtDog, type FlowLayout } from './flow-layout'

export interface FlowSceneProps {
  data: FlowResponse
  /** Carteira selecionada (dossie aberto): a cadeia dela fica acesa. */
  focus: string | null
  /** h = colunas da esquerda pra direita; v = mobile, raiz no topo. */
  orientation: 'h' | 'v'
  onNodeClick: (w: string) => void
  onRestClick: (id: string) => void
  /** Duplo clique num no individual: perfil completo do endereco. */
  onAddressClick: (w: string) => void
  /**
   * Ids (carteira ou resto) esmaecidos pelos filtros de exibicao da casca.
   * O no continua desenhado e clicavel, so apaga: filtro de exibicao nunca
   * remove estrutura, senao o sankey mente.
   */
  dimmed?: Record<string, 1> | null
}

// Paleta plot-map: laranja de CENA nas barras e links do canvas; o laranja
// de MARCA #f7931a so aparece em texto de chip 2D. Cinza azulado pra gasto,
// azul frio pra refluxo e pra categoria exchange. Verde nunca (so status).
const BG = '#040305'
const ORANGE = '#E8660D'
const SPENT = '#3A3F4A'
const BLUE = '#4A90D9'
const BRAND = '#f7931a'
const TEXT = '#A6ABB8'
const TEXT_DIM = '#6C7180'
const RING = '#E5E7EB'
const TIP_BG = '#0B0A11'

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
const FONT_SM = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
const FONT_TIP = '11px ui-monospace, SFMono-Regular, Menlo, monospace'

// Arrays de tracejado pre-alocados: setLineDash recebe sempre os mesmos.
const DASH: number[] = [7, 5]
const NO_DASH: number[] = []
const GHOST_DASH: number[] = [3, 3]

// Estilo de link: 0 = fluxo normal, 1 = refluxo (azul), 2 = pra gasto.
const STYLE_FLOW = 0
const STYLE_BACK = 1
const STYLE_SPENT = 2
const LINK_COLORS = [ORANGE, BLUE, SPENT]

interface Hover {
  kind: 'node' | 'link'
  id: string
  li: number
}

interface Chain {
  nodes: Record<string, 1>
  links: Record<number, 1>
}

interface TipLine {
  text: string
  color: string
}

interface Graph {
  outByNode: Record<string, number[]>
  inByNode: Record<string, number[]>
  styles: number[]
}

function catColor(cat: LabelCat | null): string {
  return cat === 'exchange' ? BLUE : BRAND
}

export default function FlowScene({
  data,
  focus,
  orientation,
  onNodeClick,
  onRestClick,
  onAddressClick,
  dimmed,
}: FlowSceneProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Estado quente fica em refs: hover e transform mudam a cada movimento de
  // ponteiro e nao podem causar re-render de React, so redesenho de canvas.
  const layoutRef = useRef<FlowLayout | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const hoverRef = useRef<Hover | null>(null)
  const hoverChainRef = useRef<Chain | null>(null)
  const focusChainRef = useRef<Chain | null>(null)
  const dashSetRef = useRef<Record<number, 1>>({})
  const dashOffRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const drawReqRef = useRef<number | null>(null)
  const tipRef = useRef<{ lines: TipLine[]; x: number; y: number } | null>(null)
  const viewRef = useRef({ x: 0, y: 0, s: 1 })
  const pointersRef = useRef<Record<string, { x: number; y: number }>>({})
  const pinchRef = useRef<{ d: number; s: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const lastClickRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })
  const focusProp = useRef<string | null>(null)
  focusProp.current = focus
  // Mapa de esmaecimento vem da casca; ref pro draw ler sem re-render.
  const dimmedProp = useRef<Record<string, 1> | null>(null)
  dimmedProp.current = dimmed ?? null

  const layout = useMemo(() => {
    if (size.w < 10 || size.h < 10) return null
    return layoutFlow(data, { width: size.w, height: size.h }, orientation)
  }, [data, size.w, size.h, orientation])

  // Grafo de adjacencia por indice de link, pre-computado uma vez por
  // layout: o hover acende a cadeia inteira sem varrer nada no frame.
  const graph = useMemo<Graph | null>(() => {
    if (!layout) return null
    const outByNode: Record<string, number[]> = {}
    const inByNode: Record<string, number[]> = {}
    const styles: number[] = []
    for (let i = 0; i < layout.links.length; i++) {
      const l = layout.links[i].link
      if (!outByNode[l.s]) outByNode[l.s] = []
      if (!inByNode[l.t]) inByNode[l.t] = []
      outByNode[l.s].push(i)
      inByNode[l.t].push(i)
      let style = STYLE_FLOW
      if (layout.links[i].back) style = STYLE_BACK
      else if (l.t.length > 6 && l.t.slice(-6) === ':spent') style = STYLE_SPENT
      styles.push(style)
    }
    return { outByNode, inByNode, styles }
  }, [layout])

  // ---- cadeia acesa: caminhada dirigida nos dois sentidos ----
  function walkChain(g: Graph, lay: FlowLayout, chain: Chain, seeds: string[], dir: 'out' | 'in') {
    const adj = dir === 'out' ? g.outByNode : g.inByNode
    const seen: Record<string, 1> = {}
    const q = seeds.slice()
    for (let qi = 0; qi < q.length; qi++) {
      const id = q[qi]
      if (seen[id]) continue
      seen[id] = 1
      chain.nodes[id] = 1
      const ls = adj[id]
      if (!ls) continue
      for (let j = 0; j < ls.length; j++) {
        const li = ls[j]
        chain.links[li] = 1
        const other = dir === 'out' ? lay.links[li].link.t : lay.links[li].link.s
        if (!seen[other]) q.push(other)
      }
    }
  }

  function chainForNode(id: string): Chain | null {
    const g = graphRef.current
    const lay = layoutRef.current
    if (!g || !lay || lay.index[id] === undefined) return null
    const chain: Chain = { nodes: {}, links: {} }
    walkChain(g, lay, chain, [id], 'in')
    walkChain(g, lay, chain, [id], 'out')
    return chain
  }

  function chainForLink(li: number): Chain | null {
    const g = graphRef.current
    const lay = layoutRef.current
    if (!g || !lay || !lay.links[li]) return null
    const l = lay.links[li].link
    const chain: Chain = { nodes: {}, links: {} }
    chain.links[li] = 1
    walkChain(g, lay, chain, [l.s], 'in')
    walkChain(g, lay, chain, [l.t], 'out')
    return chain
  }

  // ---- desenho ----
  // draw e recriada a cada render (fecha sobre props/state atuais); os
  // callbacks de rAF chamam sempre a versao mais nova via drawRef, senao a
  // animacao do tracejado ficaria presa num closure velho.
  const drawRef = useRef<() => void>(() => {})

  function requestDraw() {
    if (drawReqRef.current !== null) return
    drawReqRef.current = requestAnimationFrame(() => {
      drawReqRef.current = null
      drawRef.current()
    })
  }

  function needsDashAnim(): boolean {
    if (hoverRef.current && hoverRef.current.kind === 'link') return true
    for (const k in dashSetRef.current) {
      if (Object.prototype.hasOwnProperty.call(dashSetRef.current, k)) return true
    }
    return false
  }

  // A animacao do tracejado so roda enquanto existe link em hover/selecao;
  // fora disso o canvas fica parado (redesenha so em mudanca de estado).
  function ensureAnim() {
    if (animRef.current !== null) return
    const tick = () => {
      if (!needsDashAnim()) {
        animRef.current = null
        return
      }
      dashOffRef.current -= 0.6
      drawRef.current()
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }

  function draw() {
    const cvs = canvasRef.current
    const lay = layoutRef.current
    const g = graphRef.current
    if (!cvs || !lay || !g) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const view = viewRef.current
    const hover = hoverRef.current
    const chain = hoverChainRef.current || focusChainRef.current
    const dashSet = dashSetRef.current
    const dimmedMap = dimmedProp.current
    const hoverLi = hover && hover.kind === 'link' ? hover.li : -1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, size.w, size.h)
    ctx.translate(view.x, view.y)
    ctx.scale(view.s, view.s)

    // links primeiro, nos por cima
    ctx.lineCap = 'butt'
    for (let i = 0; i < lay.links.length; i++) {
      const L = lay.links[i]
      const inChain = chain ? chain.links[i] === 1 : false
      let linkAlpha = chain ? (inChain ? 0.9 : 0.11) : 0.5
      // link com ponta esmaecida apaga junto (filtro de exibicao da casca)
      if (dimmedMap && (dimmedMap[L.link.s] === 1 || dimmedMap[L.link.t] === 1)) {
        linkAlpha *= 0.25
      }
      ctx.globalAlpha = linkAlpha
      ctx.strokeStyle = LINK_COLORS[g.styles[i]]
      ctx.lineWidth = L.width
      if (i === hoverLi || dashSet[i] === 1) {
        ctx.setLineDash(DASH)
        ctx.lineDashOffset = dashOffRef.current
      } else {
        ctx.setLineDash(NO_DASH)
      }
      ctx.beginPath()
      ctx.moveTo(L.x0, L.y0)
      ctx.bezierCurveTo(L.cx0, L.cy0, L.cx1, L.cy1, L.x1, L.y1)
      ctx.stroke()
    }
    ctx.setLineDash(NO_DASH)
    ctx.lineDashOffset = 0

    for (let i = 0; i < lay.nodes.length; i++) {
      const ln = lay.nodes[i]
      let dim = chain ? (chain.nodes[ln.id] === 1 ? 1 : 0.25) : 1
      if (dimmedMap && dimmedMap[ln.id] === 1) dim *= 0.18
      if (ln.kind === 'ghost') {
        // ancora do re-root: barra apagada e tracejada, so referencia
        ctx.globalAlpha = 0.7 * dim
        ctx.setLineDash(GHOST_DASH)
        ctx.strokeStyle = TEXT_DIM
        ctx.lineWidth = 1
        ctx.strokeRect(ln.x, ln.y, ln.w, ln.h)
        ctx.setLineDash(NO_DASH)
        continue
      }
      if (ln.kind === 'rest' && ln.rest) {
        ctx.globalAlpha = dim
        if (ln.rest.kind === 'spent') {
          // resto spent inteiro vazado, no cinza azulado do gasto
          ctx.strokeStyle = SPENT
          ctx.lineWidth = 1.25
          ctx.strokeRect(ln.x, ln.y, ln.w, ln.h)
        } else {
          ctx.fillStyle = ORANGE
          ctx.globalAlpha = 0.85 * dim
          ctx.fillRect(ln.x, ln.y, ln.w, ln.h)
          ctx.globalAlpha = dim
          ctx.strokeStyle = ORANGE
          ctx.lineWidth = 1
          ctx.strokeRect(ln.x, ln.y, ln.w, ln.h)
        }
        continue
      }
      const n = ln.node
      if (!n) continue
      ctx.globalAlpha = dim
      if (ln.glow) {
        // unico no com glow: a raiz
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 16
      }
      if (!n.h) {
        // nao-holder: barra inteira no cinza do gasto
        ctx.fillStyle = SPENT
        ctx.fillRect(ln.x, ln.y, ln.w, ln.h)
      } else {
        // holder: contorno laranja, preenchimento solido so na fracao
        // held_pct (o que ainda esta na carteira)
        ctx.strokeStyle = ORANGE
        ctx.lineWidth = 1.25
        ctx.strokeRect(ln.x, ln.y, ln.w, ln.h)
        const p = Math.max(0, Math.min(1, n.held_pct))
        if (p > 0) {
          ctx.fillStyle = ORANGE
          if (orientation === 'h') {
            const fh = ln.h * p
            ctx.fillRect(ln.x, ln.y + ln.h - fh, ln.w, fh)
          } else {
            ctx.fillRect(ln.x, ln.y, ln.w * p, ln.h)
          }
        }
      }
      if (ln.glow) {
        ctx.shadowBlur = 0
      }
      // verified: so um anel fino em volta (nome fica pro hover)
      if (n.label && n.label.source === 'verified') {
        ctx.globalAlpha = 0.75 * dim
        ctx.strokeStyle = ORANGE
        ctx.lineWidth = 1
        ctx.strokeRect(ln.x - 2.5, ln.y - 2.5, ln.w + 5, ln.h + 5)
        ctx.globalAlpha = dim
      }
      // no selecionado (dossie aberto): anel claro
      if (focusProp.current === ln.id) {
        ctx.strokeStyle = RING
        ctx.lineWidth = 1
        ctx.strokeRect(ln.x - 4.5, ln.y - 4.5, ln.w + 9, ln.h + 9)
      }
    }

    // rotulos de coluna
    ctx.globalAlpha = 1
    ctx.font = FONT
    ctx.fillStyle = TEXT_DIM
    ctx.textBaseline = 'middle'
    for (let i = 0; i < lay.colLabels.length; i++) {
      const cl = lay.colLabels[i]
      ctx.textAlign = orientation === 'h' ? 'center' : 'left'
      ctx.fillText(cl.text, cl.x, cl.y)
    }

    // rotulos de no
    for (let i = 0; i < lay.labels.length; i++) {
      const lb = lay.labels[i]
      let dim = chain ? (chain.nodes[lb.nodeId] === 1 ? 1 : 0.25) : 1
      if (dimmedMap && dimmedMap[lb.nodeId] === 1) dim *= 0.18
      ctx.globalAlpha = dim
      if (lb.kind === 'chip') {
        // chip de entidade: mono caps, fundo solido, cor por categoria
        ctx.font = FONT
        const tw = ctx.measureText(lb.text).width
        const cw = tw + 10
        const ch = 15
        const cx = lb.x
        const cy = lb.y - ch / 2
        const color = catColor(lb.cat)
        ctx.fillStyle = BG
        ctx.fillRect(cx, cy, cw, ch)
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(cx, cy, cw, ch)
        ctx.fillStyle = color
        ctx.textAlign = 'left'
        ctx.fillText(lb.text, cx + 5, cy + ch / 2 + 0.5)
      } else if (lb.kind === 'auto' || lb.kind === 'ghost') {
        ctx.font = FONT
        ctx.fillStyle = lb.kind === 'ghost' ? TEXT_DIM : TEXT
        ctx.textAlign = 'left'
        ctx.fillText(lb.text, lb.x, lb.y)
        if (lb.sub) {
          ctx.font = FONT_SM
          ctx.fillStyle = TEXT_DIM
          ctx.fillText(lb.sub, lb.x, lb.y + 11)
        }
      } else {
        // resto: "N WALLETS" + total em DOG
        ctx.font = FONT
        ctx.fillStyle = TEXT
        ctx.textAlign = 'left'
        ctx.fillText(lb.text, lb.x, lb.y - 5)
        if (lb.sub) {
          ctx.font = FONT_SM
          ctx.fillStyle = TEXT_DIM
          ctx.fillText(lb.sub, lb.x, lb.y + 7)
        }
      }
    }

    // ---- camadas de tela (nao sofrem pan/zoom) ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1

    // regua fixa 10M / 1B / 10B: acompanha o zoom pra nunca mentir a escala
    ctx.font = FONT_SM
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    let ry = lay.ruler.y
    for (let i = 0; i < lay.ruler.bars.length; i++) {
      const bar = lay.ruler.bars[i]
      const px = Math.max(1, bar.px * view.s)
      ctx.fillStyle = ORANGE
      ctx.globalAlpha = 0.8
      ctx.fillRect(lay.ruler.x, ry - px, 30, px)
      ctx.globalAlpha = 1
      ctx.fillStyle = TEXT_DIM
      ctx.fillText(bar.text, lay.ruler.x + 36, ry - px / 2)
      ry -= Math.max(px, 10) + 7
    }

    // selo de completude: dog_flows ainda em backfill
    if (data.meta.flows === 'partial') {
      ctx.font = FONT
      const msg = 'FLOWS PARTIAL'
      const tw = ctx.measureText(msg).width
      const bx = size.w - tw - 26
      const by = 10
      ctx.fillStyle = BG
      ctx.fillRect(bx, by, tw + 12, 16)
      ctx.strokeStyle = SPENT
      ctx.lineWidth = 1
      ctx.strokeRect(bx, by, tw + 12, 16)
      ctx.fillStyle = TEXT
      ctx.fillText(msg, bx + 6, by + 8.5)
    }

    // tooltip por cima de tudo
    const tip = tipRef.current
    if (tip && tip.lines.length > 0) {
      ctx.font = FONT_TIP
      let w = 0
      for (let i = 0; i < tip.lines.length; i++) {
        const tw = ctx.measureText(tip.lines[i].text).width
        if (tw > w) w = tw
      }
      const pad = 8
      const lh = 15
      const bw = w + pad * 2
      const bh = tip.lines.length * lh + pad * 2 - 4
      let bx = tip.x + 14
      let by = tip.y + 14
      if (bx + bw > size.w - 4) bx = tip.x - bw - 10
      if (by + bh > size.h - 4) by = tip.y - bh - 10
      if (bx < 4) bx = 4
      if (by < 4) by = 4
      ctx.fillStyle = TIP_BG
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = SPENT
      ctx.lineWidth = 1
      ctx.strokeRect(bx, by, bw, bh)
      ctx.textAlign = 'left'
      for (let i = 0; i < tip.lines.length; i++) {
        ctx.fillStyle = tip.lines[i].color
        ctx.fillText(tip.lines[i].text, bx + pad, by + pad + i * lh + 4)
      }
    }
  }

  // mantem a referencia sempre na versao mais recente de draw
  drawRef.current = draw

  // ---- hit-test ----
  function toWorld(sx: number, sy: number): { x: number; y: number } {
    const v = viewRef.current
    return { x: (sx - v.x) / v.s, y: (sy - v.y) / v.s }
  }

  function hitTest(sx: number, sy: number): Hover | null {
    const lay = layoutRef.current
    if (!lay) return null
    const p = toWorld(sx, sy)
    // nos primeiro (estao por cima), com 2px de folga pra barra fininha
    for (let i = lay.nodes.length - 1; i >= 0; i--) {
      const n = lay.nodes[i]
      if (p.x >= n.x - 2 && p.x <= n.x + n.w + 2 && p.y >= n.y - 2 && p.y <= n.y + n.h + 2) {
        return { kind: 'node', id: n.id, li: -1 }
      }
    }
    // links por distancia as amostras pre-computadas da curva
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < lay.links.length; i++) {
      const L = lay.links[i]
      const tol = Math.max(L.width / 2, 3) + 2
      const tol2 = tol * tol
      const s = L.samples
      for (let j = 0; j < s.length; j += 2) {
        const dx = p.x - s[j]
        const dy = p.y - s[j + 1]
        const d2 = dx * dx + dy * dy
        if (d2 <= tol2 && d2 < bestD) {
          bestD = d2
          best = i
        }
      }
    }
    if (best >= 0) return { kind: 'link', id: '', li: best }
    return null
  }

  // ---- tooltip ----
  function buildTip(h: Hover | null): TipLine[] {
    const lay = layoutRef.current
    if (!h || !lay) return []
    const lines: TipLine[] = []
    if (h.kind === 'link') {
      const L = lay.links[h.li]
      const l = L.link
      lines.push({
        text: displayName(l.s, lay) + ' → ' + displayName(l.t, lay),
        color: TEXT,
      })
      lines.push({
        text: fmtDog(l.dog) + ' DOG · ' + String(l.txs) + ' TXS',
        color: L.back ? BLUE : ORANGE,
      })
      if (L.back) lines.push({ text: 'BACKFLOW', color: BLUE })
      return lines
    }
    const idx = lay.index[h.id]
    if (idx === undefined) return []
    const ln = lay.nodes[idx]
    if (ln.kind === 'ghost') {
      lines.push({ text: 'BACK TO PREVIOUS ROOT', color: TEXT })
      return lines
    }
    if (ln.kind === 'rest' && ln.rest) {
      const r = ln.rest
      lines.push({
        text: (r.kind === 'holders' ? 'HOLDERS REST' : 'SPENT REST') + ' · G' + String(r.gen),
        color: TEXT,
      })
      lines.push({ text: 'IN ' + fmtDog(r.in) + ' · OUT ' + fmtDog(r.out), color: TEXT_DIM })
      if (r.kind === 'holders') lines.push({ text: 'BAL ' + fmtDog(r.b) + ' DOG', color: ORANGE })
      lines.push({ text: 'CLICK TO EXPAND', color: TEXT_DIM })
      return lines
    }
    const n = ln.node
    if (!n) return []
    if (n.label) {
      // aqui e o unico lugar onde o nome de um verified aparece
      lines.push({ text: n.label.name.toUpperCase(), color: catColor(n.label.cat) })
    }
    lines.push({ text: truncAddr(n.w), color: TEXT })
    lines.push({ text: 'IN ' + fmtDog(n.in) + ' · OUT ' + fmtDog(n.out), color: TEXT_DIM })
    lines.push(
      n.h
        ? { text: 'HELD ' + (n.held_pct * 100).toFixed(1) + '% · BAL ' + fmtDog(n.b), color: ORANGE }
        : { text: 'FULLY SPENT', color: TEXT_DIM },
    )
    return lines
  }

  function displayName(id: string, lay: FlowLayout): string {
    const idx = lay.index[id]
    if (idx !== undefined) {
      const ln = lay.nodes[idx]
      if (ln.node && ln.node.label) return ln.node.label.name.toUpperCase()
      if (ln.rest) return ln.rest.kind === 'holders' ? 'HOLDERS REST' : 'SPENT REST'
    }
    return truncAddr(id)
  }

  // ---- selecao vinda de fora (focus) ----
  function refreshFocus() {
    const g = graphRef.current
    const f = focusProp.current
    dashSetRef.current = {}
    focusChainRef.current = null
    if (f && g) {
      focusChainRef.current = chainForNode(f)
      // tracejado marchando so nos links encostados no no selecionado
      const outs = g.outByNode[f]
      const ins = g.inByNode[f]
      if (outs) for (let i = 0; i < outs.length; i++) dashSetRef.current[outs[i]] = 1
      if (ins) for (let i = 0; i < ins.length; i++) dashSetRef.current[ins[i]] = 1
    }
  }

  // ---- efeitos ----
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    layoutRef.current = layout
    graphRef.current = graph
    // layout novo invalida hover e cadeias penduradas em indices antigos
    hoverRef.current = null
    hoverChainRef.current = null
    tipRef.current = null
    refreshFocus()
    const cvs = canvasRef.current
    if (cvs && size.w > 0) {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cvs.width = Math.round(size.w * dpr)
      cvs.height = Math.round(size.h * dpr)
    }
    requestDraw()
    if (needsDashAnim()) ensureAnim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, graph, size.w, size.h])

  useEffect(() => {
    refreshFocus()
    requestDraw()
    if (needsDashAnim()) ensureAnim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  // filtros de exibicao mudaram: so redesenha, nada de layout novo
  useEffect(() => {
    requestDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimmed])

  // wheel precisa de passive: false pra segurar o scroll da pagina
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = cvs.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const v = viewRef.current
      const factor = Math.pow(1.0015, -e.deltaY)
      const ns = Math.max(0.4, Math.min(5, v.s * factor))
      // zoom ancorado no cursor: o ponto do mundo sob o mouse nao anda
      v.x = sx - ((sx - v.x) / v.s) * ns
      v.y = sy - ((sy - v.y) / v.s) * ns
      v.s = ns
      requestDraw()
    }
    cvs.addEventListener('wheel', onWheel, { passive: false })
    return () => cvs.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    return () => {
      // ⚠️ ZERAR os refs junto do cancel: no StrictMode do dev os efeitos
      // rodam efeito-limpeza-efeito com os MESMOS refs; cancelar sem zerar
      // deixava o id morto em drawReqRef e todo requestDraw seguinte
      // desistia achando que havia frame pendente: canvas em branco eterno
      // (incidente de 26/08).
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
      if (drawReqRef.current !== null) {
        cancelAnimationFrame(drawReqRef.current)
        drawReqRef.current = null
      }
    }
  }, [])

  // ---- ponteiro ----
  function localPos(e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const cvs = canvasRef.current
    if (!cvs) return { x: 0, y: 0 }
    const rect = cvs.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function pointerCount(): number {
    let n = 0
    for (const k in pointersRef.current) {
      if (Object.prototype.hasOwnProperty.call(pointersRef.current, k)) n++
    }
    return n
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const cvs = canvasRef.current
    if (cvs) cvs.setPointerCapture(e.pointerId)
    const p = localPos(e)
    pointersRef.current[String(e.pointerId)] = p
    if (pointerCount() === 2) {
      // pinch basico: guarda distancia e escala iniciais
      const pts: { x: number; y: number }[] = []
      for (const k in pointersRef.current) {
        if (Object.prototype.hasOwnProperty.call(pointersRef.current, k)) {
          pts.push(pointersRef.current[k])
        }
      }
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      pinchRef.current = { d: Math.sqrt(dx * dx + dy * dy) || 1, s: viewRef.current.s }
      dragRef.current = null
    } else {
      dragRef.current = { x: p.x, y: p.y, moved: false }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const p = localPos(e)
    const id = String(e.pointerId)
    const wasDown = pointersRef.current[id] !== undefined
    if (wasDown) pointersRef.current[id] = p

    if (pinchRef.current && pointerCount() === 2) {
      const pts: { x: number; y: number }[] = []
      for (const k in pointersRef.current) {
        if (Object.prototype.hasOwnProperty.call(pointersRef.current, k)) {
          pts.push(pointersRef.current[k])
        }
      }
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const mx = (pts[0].x + pts[1].x) / 2
      const my = (pts[0].y + pts[1].y) / 2
      const v = viewRef.current
      const ns = Math.max(0.4, Math.min(5, pinchRef.current.s * (d / pinchRef.current.d)))
      v.x = mx - ((mx - v.x) / v.s) * ns
      v.y = my - ((my - v.y) / v.s) * ns
      v.s = ns
      requestDraw()
      return
    }

    if (wasDown && dragRef.current) {
      const drag = dragRef.current
      const dx = p.x - drag.x
      const dy = p.y - drag.y
      if (drag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        drag.moved = true
        viewRef.current.x += dx
        viewRef.current.y += dy
        drag.x = p.x
        drag.y = p.y
        requestDraw()
      }
      return
    }

    // hover: recomputa cadeia e tooltip so quando o alvo muda
    const h = hitTest(p.x, p.y)
    const prev = hoverRef.current
    const changed =
      (h === null) !== (prev === null) ||
      (h !== null && prev !== null && (h.kind !== prev.kind || h.id !== prev.id || h.li !== prev.li))
    if (changed) {
      hoverRef.current = h
      hoverChainRef.current = h
        ? h.kind === 'node'
          ? chainForNode(h.id)
          : chainForLink(h.li)
        : null
      tipRef.current = h ? { lines: buildTip(h), x: p.x, y: p.y } : null
      const cvs = canvasRef.current
      if (cvs) {
        // cursor pointer sobre qualquer coisa clicavel
        cvs.style.cursor = h && h.kind === 'node' ? 'pointer' : h ? 'crosshair' : 'default'
      }
      if (needsDashAnim()) ensureAnim()
    } else if (h && tipRef.current) {
      tipRef.current.x = p.x
      tipRef.current.y = p.y
    }
    if (changed || h) requestDraw()
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    const id = String(e.pointerId)
    const wasDrag = dragRef.current ? dragRef.current.moved : false
    delete pointersRef.current[id]
    if (pointerCount() < 2) pinchRef.current = null
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || wasDrag) return

    const p = localPos(e)
    const h = hitTest(p.x, p.y)
    if (!h || h.kind !== 'node') return
    const lay = layoutRef.current
    if (!lay) return
    const idx = lay.index[h.id]
    if (idx === undefined) return
    const ln = lay.nodes[idx]
    if (ln.kind === 'rest' && ln.rest) {
      onRestClick(ln.rest.id)
      return
    }
    if (ln.kind === 'ghost') {
      if (data.ghost) onNodeClick(data.ghost.w)
      return
    }
    if (!ln.node) return
    const now = Date.now()
    const last = lastClickRef.current
    if (last.id === ln.id && now - last.t < 350) {
      // duplo clique: perfil completo do endereco
      lastClickRef.current = { id: '', t: 0 }
      onAddressClick(ln.node.w)
    } else {
      lastClickRef.current = { id: ln.id, t: now }
      onNodeClick(ln.node.w)
    }
  }

  function onPointerLeave() {
    if (hoverRef.current) {
      hoverRef.current = null
      hoverChainRef.current = null
      tipRef.current = null
      const cvs = canvasRef.current
      if (cvs) cvs.style.cursor = 'default'
      requestDraw()
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full"
      style={{ background: BG }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
    </div>
  )
}
