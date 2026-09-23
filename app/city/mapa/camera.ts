// ═══════════════════════════════════════════════════════════════════════════
// A CÂMERA 2D: pan e zoom por mouse e toque, sem depender de React a cada
// pixel arrastado.
//
// ⚠️ ESTADO FORA DO REACT DE PROPÓSITO. Um pointermove dispara a 60-120 Hz;
// se cada um virasse setState, o React re-renderizaria o painel e a legenda
// junto com o canvas a cada pixel de arrasto. A câmera vive num objeto mutável
// e chama `aoMudar()` direto — só o clique (que É raro) toca o React.
//
// ⚠️ ESCALA É PX POR METRO, IGUAL NOS DOIS EIXOS. O mundo não tem distorção
// (x leste, z sul, sem projeção), então zoom é um escalar só: arc() do canvas
// desenha círculo verdadeiro, não elipse.
// ═══════════════════════════════════════════════════════════════════════════

export interface Camera { x: number; z: number; escala: number }
export type Nivel = 'longe' | 'medio' | 'perto'

export const LIMIAR_MEDIO = 0.045
export const LIMIAR_PERTO = 0.55

export function nivelDe(escala: number): Nivel {
  if (escala < LIMIAR_MEDIO) return 'longe'
  if (escala < LIMIAR_PERTO) return 'medio'
  return 'perto'
}

export function mundoParaTela(cam: Camera, cw: number, ch: number, wx: number, wz: number): [number, number] {
  return [cw / 2 + (wx - cam.x) * cam.escala, ch / 2 + (wz - cam.z) * cam.escala]
}

export function telaParaMundo(cam: Camera, cw: number, ch: number, sx: number, sy: number): [number, number] {
  return [cam.x + (sx - cw / 2) / cam.escala, cam.z + (sy - ch / 2) / cam.escala]
}

/** retângulo do mundo visível agora, com margem (para consultar a grade um
 *  pouco além da borda e não ver lote "nascendo" na beirada durante o pan) */
export function retanguloVisivel(cam: Camera, cw: number, ch: number, margemPx = 64) {
  const [xmin, zmin] = telaParaMundo(cam, cw, ch, -margemPx, -margemPx)
  const [xmax, zmax] = telaParaMundo(cam, cw, ch, cw + margemPx, ch + margemPx)
  return { xmin, zmin, xmax, zmax }
}

const dist = (a: PointerEvent, b: PointerEvent) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
const meio = (a: PointerEvent, b: PointerEvent) => [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2] as const

export interface OpcoesCamera {
  escalaMin: number
  escalaMax: number
  /** raio aproximado do sítio, para não deixar o pan fugir demais para o vazio lunar */
  limiteXZ: number
  aoMudar: () => void
  /** clique/tap real (não arrasto): coordenadas de MUNDO */
  aoClicar: (wx: number, wz: number) => void
}

/** liga pan/zoom/pinch a um canvas e devolve a câmera (mutável) + destruir() */
export function ligarCamera(canvas: HTMLCanvasElement, inicial: Camera, opt: OpcoesCamera) {
  const cam: Camera = { ...inicial }
  const ativos = new Map<number, PointerEvent>()
  let pinchDist0 = 0
  let pinchEscala0 = 1
  let arrastoOrigem: { sx: number; sy: number; camX: number; camZ: number } | null = null
  let moveuPx = 0
  let baixouEm = 0

  const clamp = () => {
    cam.escala = Math.max(opt.escalaMin, Math.min(opt.escalaMax, cam.escala))
    const lim = opt.limiteXZ
    cam.x = Math.max(-lim, Math.min(lim, cam.x))
    cam.z = Math.max(-lim, Math.min(lim, cam.z))
  }

  const zoomEm = (sx: number, sy: number, fator: number) => {
    const rect = canvas.getBoundingClientRect()
    const cw = rect.width, ch = rect.height
    const [wx, wz] = telaParaMundo(cam, cw, ch, sx, sy)
    cam.escala *= fator
    clamp()
    // mantém o ponto sob o cursor fixo na tela — é o que faz o zoom "mirar"
    const [sx2, sy2] = mundoParaTela(cam, cw, ch, wx, wz)
    cam.x += (sx2 - sx) / cam.escala
    cam.z += (sy2 - sy) / cam.escala
    clamp()
    opt.aoMudar()
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const fator = Math.exp(-e.deltaY * 0.0015)
    zoomEm(e.clientX - rect.left, e.clientY - rect.top, fator)
  }

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    ativos.set(e.pointerId, e)
    moveuPx = 0
    baixouEm = performance.now()
    if (ativos.size === 1) {
      const rect = canvas.getBoundingClientRect()
      arrastoOrigem = { sx: e.clientX - rect.left, sy: e.clientY - rect.top, camX: cam.x, camZ: cam.z }
    } else if (ativos.size === 2) {
      arrastoOrigem = null
      const [a, b] = [...ativos.values()]
      pinchDist0 = dist(a, b)
      pinchEscala0 = cam.escala
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!ativos.has(e.pointerId)) return
    ativos.set(e.pointerId, e)
    const rect = canvas.getBoundingClientRect()
    if (ativos.size === 1 && arrastoOrigem) {
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top
      cam.x = arrastoOrigem.camX - (sx - arrastoOrigem.sx) / cam.escala
      cam.z = arrastoOrigem.camZ - (sy - arrastoOrigem.sy) / cam.escala
      moveuPx = Math.hypot(sx - arrastoOrigem.sx, sy - arrastoOrigem.sy)
      clamp()
      opt.aoMudar()
    } else if (ativos.size === 2) {
      const [a, b] = [...ativos.values()]
      const d = dist(a, b)
      const [mx, my] = meio(a, b)
      cam.escala = pinchEscala0 * (d / Math.max(1, pinchDist0))
      clamp()
      opt.aoMudar()
      // recentraliza no meio do pinça a cada quadro (aproximação simples e
      // estável — pinça longa já é gesto grosso, não precisa ser exato ao pixel)
      const localRect = canvas.getBoundingClientRect()
      const [wx, wz] = telaParaMundo(cam, localRect.width, localRect.height, mx - localRect.left, my - localRect.top)
      const [sx2, sy2] = mundoParaTela(cam, localRect.width, localRect.height, wx, wz)
      cam.x += (sx2 - (mx - localRect.left)) / cam.escala
      cam.z += (sy2 - (my - localRect.top)) / cam.escala
      clamp()
      opt.aoMudar()
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    const eraToqueUnico = ativos.size === 1
    const durou = performance.now() - baixouEm
    ativos.delete(e.pointerId)
    if (ativos.size < 2) { pinchDist0 = 0 }
    if (eraToqueUnico && moveuPx < 8 && durou < 600) {
      const rect = canvas.getBoundingClientRect()
      const [wx, wz] = telaParaMundo(cam, rect.width, rect.height, e.clientX - rect.left, e.clientY - rect.top)
      opt.aoClicar(wx, wz)
    }
    arrastoOrigem = null
  }

  canvas.style.touchAction = 'none'
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  return {
    cam,
    zoomBotao(fator: number) {
      const rect = canvas.getBoundingClientRect()
      zoomEm(rect.width / 2, rect.height / 2, fator)
    },
    irPara(x: number, z: number, escala?: number) {
      cam.x = x
      cam.z = z
      if (escala !== undefined) cam.escala = escala
      clamp()
      opt.aoMudar()
    },
    destruir() {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    },
  }
}
