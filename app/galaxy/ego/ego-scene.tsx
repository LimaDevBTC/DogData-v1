'use client'

// Cena do ego-grafo (modo GRAPH): canvas 2D puro, DPR ate 2, hit-testing
// proprio por circulo e por amostras de curva. Todo o layout vem pronto de
// ego-layout.ts; o canvas so redesenha em mudanca de estado ou hover, e a
// unica animacao continua e o tracejado marchando na aresta acesa.
// Zero fetch aqui: a casca entrega a EgoResponse pronta.

import { useEffect, useMemo, useRef, useState } from 'react'

import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EgoResponse, LabelCat } from './ego-types'
import { layoutEgo, truncAddr, fmtDog, fmtCount, type EgoLayout } from './ego-layout'

export interface EgoSceneProps {
  data: EgoResponse
  /** Mobile: raio maior (0.40) e pincas menores; a casca ja pede limit 12. */
  mobile: boolean
  /** Clique numa contraparte: a casca re-centra o ego nela. */
  onCounterpartyClick: (w: string) => void
  /** Clique na bolha de resto de um lado. */
  onRestClick: (dir: 'in' | 'out') => void
  /** Duplo clique em qualquer disco: perfil completo do endereco. */
  onAddressClick: (w: string) => void
  /** Clique no disco central. */
  onCenterClick: (w: string) => void
}

// Paleta plot-map: laranja de CENA nas entradas, azul frio nas saidas; o
// laranja de MARCA #f7931a so em texto de chip. Cinza azulado pra gasto,
// verde nunca (so status), roxo proibido.
const BG = '#040305'
const ORANGE = '#E8660D'
const BLUE = '#4A90D9'
const SPENT = '#3A3F4A'
const BRAND = '#f7931a'
const TEXT = '#A6ABB8'
const TEXT_DIM = '#6C7180'
const RING = '#E5E7EB'
const TIP_BG = '#0B0A11'

// Gradiente de opacidade da aresta: forte junto ao centro, esmaecendo em
// direcao a contraparte. Pares (perto, longe) por lado.
const ORANGE_HI = 'rgba(232, 102, 13, 0.9)'
const ORANGE_LO = 'rgba(232, 102, 13, 0.32)'
const BLUE_HI = 'rgba(74, 144, 217, 0.9)'
const BLUE_LO = 'rgba(74, 144, 217, 0.32)'

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
const FONT_SM = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
const FONT_TIP = '11px ui-monospace, SFMono-Regular, Menlo, monospace'

// Arrays de tracejado pre-alocados: setLineDash recebe sempre os mesmos.
const DASH: number[] = [7, 5]
const NO_DASH: number[] = []
const REST_DASH: number[] = [3, 3]

const TWO_PI = Math.PI * 2

interface Hover {
  kind: 'node' | 'edge'
  /** Id do no (vazio quando o hover e direto na curva). */
  id: string
  /** Indice da aresta acesa; -1 quando nada acende (centro, resto). */
  li: number
}

interface TipLine {
  text: string
  color: string
}

function catColor(cat: LabelCat | null): string {
  return cat === 'exchange' ? BLUE : BRAND
}

export default function EgoScene({
  data,
  mobile,
  onCounterpartyClick,
  onRestClick,
  onAddressClick,
  onCenterClick,
}: EgoSceneProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Estado quente em refs: hover muda a cada movimento de ponteiro e nao
  // pode causar re-render de React, so redesenho de canvas.
  const layoutRef = useRef<EgoLayout | null>(null)
  const hoverRef = useRef<Hover | null>(null)
  const dashOffRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const drawReqRef = useRef<number | null>(null)
  const tipRef = useRef<{ lines: TipLine[]; x: number; y: number } | null>(null)
  const downRef = useRef<{ x: number; y: number } | null>(null)
  const lastClickRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })

  // Canvas infinito, mesmo padrao do Flow: a view mora num ref porque muda a
  // cada frame de gesto e nao pode re-renderizar React. x/y em px de tela,
  // s = escala (clamp 0.35 a 6).
  const viewRef = useRef({ x: 0, y: 0, s: 1 })
  const pointersRef = useRef<Record<string, { x: number; y: number }>>({})
  const pinchRef = useRef<{ d: number; s: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const S_MIN = 0.35
  const S_MAX = 6

  // zoom ancorado: o ponto de TELA (sx, sy) continua sobre o mesmo ponto do
  // mundo depois da mudanca de escala
  function zoomAt(sx: number, sy: number, factor: number) {
    const v = viewRef.current
    const ns = Math.max(S_MIN, Math.min(S_MAX, v.s * factor))
    v.x = sx - ((sx - v.x) / v.s) * ns
    v.y = sy - ((sy - v.y) / v.s) * ns
    v.s = ns
    requestDraw()
  }

  function resetView() {
    viewRef.current = { x: 0, y: 0, s: 1 }
    requestDraw()
  }

  const layout = useMemo(() => {
    if (size.w < 10 || size.h < 10) return null
    return layoutEgo(data, { width: size.w, height: size.h }, mobile)
  }, [data, size.w, size.h, mobile])

  // ---- desenho ----
  // draw e recriada a cada render (fecha sobre props/state atuais); os
  // callbacks de rAF chamam sempre a versao mais nova via drawRef.
  const drawRef = useRef<() => void>(() => {})

  function requestDraw() {
    if (drawReqRef.current !== null) return
    drawReqRef.current = requestAnimationFrame(() => {
      drawReqRef.current = null
      drawRef.current()
    })
  }

  function needsDashAnim(): boolean {
    const h = hoverRef.current
    return !!h && h.li >= 0
  }

  // O tracejado marchando so roda enquanto ha aresta acesa; fora disso o
  // canvas fica parado (redesenha so em mudanca de estado).
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
    if (!cvs || !lay) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const hover = hoverRef.current
    const litLi = hover ? hover.li : -1
    const hoverId = hover && hover.kind === 'node' ? hover.id : ''
    const anyHover = hover !== null

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, size.w, size.h)

    // mundo sob pan/zoom: tudo ate os rotulos anda com a view; so o tooltip
    // fica em espaco de tela (transform resetado la embaixo)
    const v = viewRef.current
    ctx.translate(v.x, v.y)
    ctx.scale(v.s, v.s)

    // conectores tracejados centro -> bolha de resto, por baixo de tudo
    ctx.lineWidth = 1
    ctx.setLineDash(REST_DASH)
    for (let i = 0; i < lay.nodes.length; i++) {
      const ln = lay.nodes[i]
      if (ln.kind !== 'rest') continue
      const lit = hoverId === ln.id
      ctx.globalAlpha = lit ? 0.7 : anyHover ? 0.12 : 0.3
      ctx.strokeStyle = ln.dir === 'in' ? ORANGE : BLUE
      // do disco central ate a borda da bolha, em linha reta
      const cxn = lay.nodes[lay.index['center']]
      const dx = ln.x - cxn.x
      const dy = ln.y - cxn.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      ctx.beginPath()
      ctx.moveTo(cxn.x + (dx / d) * cxn.r, cxn.y + (dy / d) * cxn.r)
      ctx.lineTo(ln.x - (dx / d) * ln.r, ln.y - (dy / d) * ln.r)
      ctx.stroke()
    }
    ctx.setLineDash(NO_DASH)

    // arestas: gradiente forte no centro esmaecendo pra contraparte
    ctx.lineCap = 'butt'
    for (let i = 0; i < lay.edges.length; i++) {
      const L = lay.edges[i]
      const lit = i === litLi
      ctx.globalAlpha = lit ? 1 : anyHover ? 0.15 : 1
      const grad = ctx.createLinearGradient(L.x0, L.y0, L.x1, L.y1)
      if (L.dir === 'in') {
        grad.addColorStop(0, ORANGE_HI)
        grad.addColorStop(1, ORANGE_LO)
      } else {
        grad.addColorStop(0, BLUE_HI)
        grad.addColorStop(1, BLUE_LO)
      }
      ctx.strokeStyle = grad
      ctx.lineWidth = L.width
      if (lit) {
        ctx.setLineDash(DASH)
        ctx.lineDashOffset = dashOffRef.current
      } else {
        ctx.setLineDash(NO_DASH)
      }
      ctx.beginPath()
      ctx.moveTo(L.x0, L.y0)
      ctx.bezierCurveTo(L.cx0, L.cy0, L.cx1, L.cy1, L.x1, L.y1)
      ctx.stroke()
      ctx.setLineDash(NO_DASH)
      ctx.lineDashOffset = 0

      // seta pequena de direcao no meio da curva, no sentido do FLUXO
      const s = Math.max(4, Math.min(8, L.width + 2))
      ctx.save()
      ctx.translate(L.ax, L.ay)
      ctx.rotate(L.aa)
      ctx.fillStyle = L.dir === 'in' ? ORANGE : BLUE
      ctx.beginPath()
      ctx.moveTo(s, 0)
      ctx.lineTo(-s * 0.7, s * 0.6)
      ctx.lineTo(-s * 0.7, -s * 0.6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // discos por cima das arestas
    for (let i = 0; i < lay.nodes.length; i++) {
      const ln = lay.nodes[i]
      const related =
        !anyHover ||
        hoverId === ln.id ||
        ln.kind === 'center' ||
        (litLi >= 0 && ln.edgeIdx === litLi)
      const dim = related ? 1 : 0.3

      if (ln.kind === 'rest') {
        // bolha de resto: circulo tracejado, estilo resto do Flow
        ctx.globalAlpha = dim
        ctx.setLineDash(REST_DASH)
        ctx.strokeStyle = TEXT_DIM
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.arc(ln.x, ln.y, ln.r, 0, TWO_PI)
        ctx.stroke()
        ctx.setLineDash(NO_DASH)
        continue
      }

      if (ln.kind === 'center') {
        const c = data.center
        ctx.globalAlpha = 1
        // o protagonista: unico disco com glow
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 16
        if (c.h) {
          ctx.fillStyle = ORANGE
          ctx.beginPath()
          ctx.arc(ln.x, ln.y, ln.r, 0, TWO_PI)
          ctx.fill()
        } else {
          // centro que ja gastou tudo: disco vazado no cinza do gasto
          ctx.strokeStyle = SPENT
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(ln.x, ln.y, ln.r, 0, TWO_PI)
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        // verified: anel fino claro em volta do disco central
        if (c.label && c.label.source === 'verified') {
          ctx.strokeStyle = RING
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(ln.x, ln.y, ln.r + 3.5, 0, TWO_PI)
          ctx.stroke()
        }
        continue
      }

      const e = ln.edge
      if (!e) continue
      ctx.globalAlpha = dim
      if (e.h) {
        // holder: disco cheio
        ctx.fillStyle = ORANGE
        ctx.beginPath()
        ctx.arc(ln.x, ln.y, ln.r, 0, TWO_PI)
        ctx.fill()
      } else {
        // gastou: disco vazado
        ctx.strokeStyle = SPENT
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.arc(ln.x, ln.y, ln.r, 0, TWO_PI)
        ctx.stroke()
      }
      // verified: anel fino claro (nome fica pro hover)
      if (e.label && e.label.source === 'verified') {
        ctx.globalAlpha = 0.85 * dim
        ctx.strokeStyle = RING
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(ln.x, ln.y, ln.r + 2.5, 0, TWO_PI)
        ctx.stroke()
      }
    }

    // rotulos ja culled pelo layout
    ctx.textBaseline = 'middle'
    for (let i = 0; i < lay.labels.length; i++) {
      const lb = lay.labels[i]
      const related =
        !anyHover ||
        hoverId === lb.nodeId ||
        lb.nodeId === 'center' ||
        (litLi >= 0 && lay.edges[litLi].nodeId === lb.nodeId)
      ctx.globalAlpha = related ? 1 : 0.3
      ctx.font = lay.mobile ? FONT_SM : FONT
      ctx.textAlign = 'left'
      if (lb.kind === 'chip' || lb.kind === 'center') {
        // chip com fundo solido; cor por categoria, cinza pra endereco puro
        const color = lb.cat !== null || lb.kind === 'chip' ? catColor(lb.cat) : SPENT
        ctx.fillStyle = BG
        ctx.fillRect(lb.x, lb.y, lb.w, lb.h)
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(lb.x, lb.y, lb.w, lb.h)
        ctx.fillStyle = lb.cat !== null || lb.kind === 'chip' ? color : TEXT
        ctx.fillText(lb.text, lb.x + 5, lb.y + lb.h / 2 + 0.5)
      } else if (lb.kind === 'rest') {
        // resto: chip de fundo solido pro texto nao se misturar as curvas
        ctx.fillStyle = BG
        ctx.fillRect(lb.x, lb.y, lb.w, lb.h)
        ctx.strokeStyle = SPENT
        ctx.lineWidth = 1
        ctx.strokeRect(lb.x, lb.y, lb.w, lb.h)
        ctx.fillStyle = TEXT
        ctx.fillText(lb.text, lb.x + 4, lb.y + lb.h / 2 + 0.5)
      } else {
        // endereco truncado que ganhou vaga
        ctx.fillStyle = TEXT
        ctx.fillText(lb.text, lb.x, lb.y + lb.h / 2)
      }
    }

    // tooltip por cima de tudo, em espaco de TELA (fora do pan/zoom)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
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
  // Recebe px/py em TELA e converte pro mundo da view; as folgas de dedo sao
  // pensadas em px de tela, entao dividem pela escala pra valerem o mesmo
  // tamanho fisico em qualquer zoom.
  function hitTest(px: number, py: number): Hover | null {
    const lay = layoutRef.current
    if (!lay) return null
    const v = viewRef.current
    const wx = (px - v.x) / v.s
    const wy = (py - v.y) / v.s
    const slack = 3 / v.s
    // discos primeiro (estao por cima), com folga pro dedo
    for (let i = lay.nodes.length - 1; i >= 0; i--) {
      const n = lay.nodes[i]
      const dx = wx - n.x
      const dy = wy - n.y
      const tol = n.r + slack
      if (dx * dx + dy * dy <= tol * tol) {
        return { kind: 'node', id: n.id, li: n.edgeIdx }
      }
    }
    // curvas por distancia as amostras pre-computadas
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < lay.edges.length; i++) {
      const L = lay.edges[i]
      const tol = Math.max(L.width / 2, 3 / v.s) + 2 / v.s
      const tol2 = tol * tol
      const s = L.samples
      for (let j = 0; j < s.length; j += 2) {
        const dx = wx - s[j]
        const dy = wy - s[j + 1]
        const d2 = dx * dx + dy * dy
        if (d2 <= tol2 && d2 < bestD) {
          bestD = d2
          best = i
        }
      }
    }
    if (best >= 0) return { kind: 'edge', id: '', li: best }
    return null
  }

  // ---- tooltip ----
  function buildTip(h: Hover | null): TipLine[] {
    const lay = layoutRef.current
    if (!h || !lay) return []
    const lines: TipLine[] = []

    if (h.kind === 'edge') {
      const L = lay.edges[h.li]
      const e = L.edge
      const other = e.label ? e.label.name.toUpperCase() : truncAddr(e.w)
      const me = data.center.label
        ? data.center.label.name.toUpperCase()
        : truncAddr(data.center.w)
      lines.push({
        text: L.dir === 'in' ? other + ' → ' + me : me + ' → ' + other,
        color: TEXT,
      })
      lines.push({
        text: fmtDog(e.dog) + ' DOG · ' + fmtCount(e.txs) + ' TXS',
        color: L.dir === 'in' ? ORANGE : BLUE,
      })
      lines.push({
        text: 'BLOCKS ' + String(e.fb) + ' → ' + String(e.lb),
        color: TEXT_DIM,
      })
      return lines
    }

    const idx = lay.index[h.id]
    if (idx === undefined) return []
    const ln = lay.nodes[idx]

    if (ln.kind === 'rest' && ln.rest) {
      lines.push({
        text: ln.dir === 'in' ? 'INFLOW REST' : 'OUTFLOW REST',
        color: TEXT,
      })
      lines.push({
        text: '+' + fmtCount(ln.rest.n) + ' wallets · ' + fmtDog(ln.rest.dog) + ' DOG',
        color: ln.dir === 'in' ? ORANGE : BLUE,
      })
      lines.push({ text: 'CLICK TO EXPAND', color: TEXT_DIM })
      return lines
    }

    if (ln.kind === 'center') {
      const c = data.center
      if (c.label) {
        lines.push({ text: c.label.name.toUpperCase(), color: catColor(c.label.cat) })
      }
      lines.push({ text: truncAddr(c.w), color: TEXT })
      lines.push({
        text: 'IN ' + fmtDog(c.in_dog) + ' · OUT ' + fmtDog(c.out_dog),
        color: TEXT_DIM,
      })
      lines.push({
        text: 'PAIRS IN ' + fmtCount(c.in_pairs) + ' · OUT ' + fmtCount(c.out_pairs),
        color: TEXT_DIM,
      })
      lines.push(
        c.h
          ? { text: 'BAL ' + fmtDog(c.b) + ' DOG', color: ORANGE }
          : { text: 'FULLY SPENT', color: TEXT_DIM },
      )
      return lines
    }

    const e = ln.edge
    if (!e) return []
    if (e.label) {
      // aqui e o unico lugar onde o nome de um verified aparece
      lines.push({ text: e.label.name.toUpperCase(), color: catColor(e.label.cat) })
    }
    lines.push({ text: truncAddr(e.w), color: TEXT })
    lines.push({
      text: 'PAIR ' + fmtDog(e.dog) + ' DOG · ' + fmtCount(e.txs) + ' TXS',
      color: ln.dir === 'in' ? ORANGE : BLUE,
    })
    lines.push({
      text: 'BLOCKS ' + String(e.fb) + ' → ' + String(e.lb),
      color: TEXT_DIM,
    })
    lines.push(
      e.h
        ? { text: 'BAL ' + fmtDog(e.b) + ' DOG', color: ORANGE }
        : { text: 'FULLY SPENT', color: TEXT_DIM },
    )
    return lines
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
    // layout novo invalida hover e tooltip pendurados em indices antigos
    hoverRef.current = null
    tipRef.current = null
    const cvs = canvasRef.current
    if (cvs && size.w > 0) {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cvs.width = Math.round(size.w * dpr)
      cvs.height = Math.round(size.h * dpr)
    }
    requestDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, size.w, size.h])

  useEffect(() => {
    return () => {
      // ⚠️ ZERAR os refs junto do cancel: no StrictMode do dev os efeitos
      // rodam efeito-limpeza-efeito com os MESMOS refs; cancelar sem zerar
      // deixa o id morto em drawReqRef e todo requestDraw seguinte desiste
      // achando que ha frame pendente: canvas em branco eterno (bug real
      // do incidente de 26/08 no Flow).
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

  // ego novo (re-centro em outra carteira): a view volta pro enquadramento
  // padrao, senao o grafo novo nasce fora da tela no pan antigo
  useEffect(() => {
    viewRef.current = { x: 0, y: 0, s: 1 }
    requestDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // wheel com passive false (senao o browser rola a pagina) e, no mesmo
  // efeito, o endurecimento pro WebKit: iOS antigo ignora touch-action em
  // canvas, entao touchstart/touchmove levam preventDefault na marra; no
  // Chrome e inocuo porque o pointer events ja cuida de tudo.
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = cvs.getBoundingClientRect()
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.pow(1.0015, -e.deltaY))
    }
    const engole = (e: TouchEvent) => {
      e.preventDefault()
    }
    cvs.addEventListener('wheel', onWheel, { passive: false })
    cvs.addEventListener('touchstart', engole, { passive: false })
    cvs.addEventListener('touchmove', engole, { passive: false })
    return () => {
      cvs.removeEventListener('wheel', onWheel)
      cvs.removeEventListener('touchstart', engole)
      cvs.removeEventListener('touchmove', engole)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    downRef.current = p
    if (pointerCount() === 2) {
      // pinch: guarda distancia e escala iniciais; o pan de um dedo morre
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
      downRef.current = null
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
      const ns = Math.max(S_MIN, Math.min(S_MAX, pinchRef.current.s * (d / pinchRef.current.d)))
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

    const h = hitTest(p.x, p.y)
    const prev = hoverRef.current
    const changed =
      (h === null) !== (prev === null) ||
      (h !== null && prev !== null && (h.kind !== prev.kind || h.id !== prev.id || h.li !== prev.li))
    if (changed) {
      hoverRef.current = h
      tipRef.current = h ? { lines: buildTip(h), x: p.x, y: p.y } : null
      const cvs = canvasRef.current
      if (cvs) {
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
    delete pointersRef.current[id]
    if (pointerCount() < 2) pinchRef.current = null
    if (pointerCount() === 1) {
      // handoff pinch -> pan: o dedo que sobrou re-semeia o arrasto pra nao
      // dar salto nem virar clique fantasma
      for (const k in pointersRef.current) {
        if (Object.prototype.hasOwnProperty.call(pointersRef.current, k)) {
          const resto = pointersRef.current[k]
          dragRef.current = { x: resto.x, y: resto.y, moved: true }
        }
      }
      return
    }
    const down = downRef.current
    downRef.current = null
    const wasDrag = dragRef.current ? dragRef.current.moved : false
    dragRef.current = null
    if (!down || wasDrag) return
    const p = localPos(e)
    // arrasto (scroll acidental no touch) nao vira clique
    if (Math.abs(p.x - down.x) > 6 || Math.abs(p.y - down.y) > 6) return

    const h = hitTest(p.x, p.y)
    if (!h || h.kind !== 'node') return
    const lay = layoutRef.current
    if (!lay) return
    const idx = lay.index[h.id]
    if (idx === undefined) return
    const ln = lay.nodes[idx]

    if (ln.kind === 'rest') {
      if (ln.dir) onRestClick(ln.dir)
      return
    }
    if (!ln.w) return

    const now = Date.now()
    const last = lastClickRef.current
    if (last.id === ln.id && now - last.t < 350) {
      // duplo clique: perfil completo do endereco
      lastClickRef.current = { id: '', t: 0 }
      onAddressClick(ln.w)
      return
    }
    lastClickRef.current = { id: ln.id, t: now }
    if (ln.kind === 'center') {
      onCenterClick(ln.w)
    } else {
      onCounterpartyClick(ln.w)
    }
  }

  function onPointerLeave() {
    downRef.current = null
    dragRef.current = null
    pinchRef.current = null
    pointersRef.current = {}
    if (hoverRef.current) {
      hoverRef.current = null
      tipRef.current = null
      const cvs = canvasRef.current
      if (cvs) cvs.style.cursor = 'default'
      requestDraw()
    }
  }

  // botoes de zoom sempre visiveis: mesmo que o gesto falhe em algum
  // aparelho, o canvas continua navegavel e ANUNCIA que se move
  const btnCls =
    'flex h-[34px] w-[34px] items-center justify-center border border-white/10 bg-[#0B0A11]/90 font-mono text-[12px] text-white/70 transition-colors hover:text-white'

  function centerZoom(factor: number) {
    zoomAt(size.w / 2, size.h / 2, factor)
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full select-none"
      style={{ background: BG, WebkitUserSelect: 'none' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerLeave}
        onPointerLeave={onPointerLeave}
      />
      <div className="absolute bottom-3 right-3 z-10 flex flex-col">
        <button type="button" aria-label="Zoom in" className={btnCls} onClick={() => centerZoom(1.35)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" className={`${btnCls} border-t-0`} onClick={() => centerZoom(1 / 1.35)}>
          −
        </button>
        <button
          type="button"
          aria-label="Reset view"
          className={`${btnCls} w-auto border-t-0 px-2 text-[9px] uppercase tracking-[0.15em]`}
          onClick={resetView}
        >
          Fit
        </button>
      </div>
    </div>
  )
}
