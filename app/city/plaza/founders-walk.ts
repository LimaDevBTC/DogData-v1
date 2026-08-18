// A Calçada dos Fundadores (praca-jardins.md §3): o bulevar norte, do deck à
// Grande Fonte, é a calçada de quem já pagou a cidade.
//
//   uma placa de latão por fundador, na ordem de chegada (founder_seq de
//   /api/donate/leaderboard), com o endereço gravado, o total em DOG e a data;
//   depois das ocupadas, placas escuras vazias à espera (o que falta lê-se no chão);
//   e a LINHA DE LUZ no eixo do bulevar, que acende do Anel para a Fonte na
//   proporção do fundo: quando chegar na Fonte (10M DOG), a cidade abre.
//
// Nada inventado: os dados chegam vivos da API; a placa de quem doou hoje está
// aqui na próxima visita.
import * as THREE from 'three'
import { FOUNDERS_R0, FOUNDERS_R1, FOUNDERS_SLOTS_PER_SIDE, FOUNDERS_SIDE, FOUNDERS_LINE_R0, FOUNDERS_LINE_R1 } from './garden-plan'

export interface Founder {
  founder_seq: number
  address: string
  crossed_at: string
  total: number
  license?: string
}
export interface FoundersData {
  founders: Founder[]
  goal: number
  total_received: number
  progress_pct: number
}

export interface FoundersWalk {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

const WARM = new THREE.Color('#FFB35C')
const fmtDog = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : n.toFixed(0))
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function plaqueTexture(f: Founder | null, slot: number): THREE.CanvasTexture {
  const W = 512, H = 352
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  if (f) {
    // latão escovado: gradiente quente com veios finos
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#b8924e'); g.addColorStop(0.5, '#d4ad66'); g.addColorStop(1, '#a98443')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(60,40,10,0.18)'
    ctx.lineWidth = 1
    for (let y = 6; y < H; y += 7) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    ctx.strokeStyle = 'rgba(40,26,8,0.55)'
    ctx.lineWidth = 6
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.fillStyle = '#2a1c0a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 40px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`FOUNDER ${String(f.founder_seq).padStart(2, '0')}`, W / 2, 62)
    ctx.font = '500 21px "JetBrains Mono", ui-monospace, monospace'
    const a = f.address
    ctx.fillText(a.slice(0, 31), W / 2, 130)
    ctx.fillText(a.slice(31), W / 2, 160)
    ctx.font = '700 46px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`${fmtDog(f.total)} DOG`, W / 2, 232)
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(fmtDate(f.crossed_at), W / 2, 296)
  } else {
    ctx.fillStyle = '#131317'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(201,162,90,0.35)'
    ctx.lineWidth = 4
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.fillStyle = 'rgba(201,162,90,0.45)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 34px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(`FOUNDER ${String(slot).padStart(2, '0')}`, W / 2, 150)
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('THIS PLAQUE IS WAITING FOR YOU', W / 2, 220)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function buildFoundersWalk(opts: { heightAt: (x: number, z: number) => number; data: FoundersData | null }): FoundersWalk {
  const group = new THREE.Group()
  group.name = 'FoundersWalk'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const yAt = opts.heightAt
  const founders = [...(opts.data?.founders ?? [])].sort((a, b) => a.founder_seq - b.founder_seq)
  const progress = THREE.MathUtils.clamp((opts.data?.progress_pct ?? 0) / 100, 0, 1)

  // ── as placas: no chão do bulevar norte, dos dois lados, alternando ────────
  const PW = 3.6, PD = 2.5
  const plaqueGeo = track(new THREE.PlaneGeometry(PW, PD))
  const frameGeo = track(new THREE.BoxGeometry(PW + 0.3, 0.12, PD + 0.3))
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.6, metalness: 0.4 }))
  const brass = track(new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 0.95, envMapIntensity: 1.2 }))
  const total = FOUNDERS_SLOTS_PER_SIDE * 2
  const step = (FOUNDERS_R1 - FOUNDERS_R0) / (FOUNDERS_SLOTS_PER_SIDE - 1)
  const lightPos: THREE.Vector3[] = []
  for (let k = 0; k < total; k++) {
    const side = k % 2 === 0 ? -1 : 1 // esquerda, direita, esquerda…
    const idx = Math.floor(k / 2)
    const r = FOUNDERS_R0 + idx * step
    const x = side * FOUNDERS_SIDE, z = -r // o norte é −z
    const y = yAt(x, z)
    const f = founders[k] ?? null
    const tex = track(plaqueTexture(f, k + 1))
    const mat = track(new THREE.MeshStandardMaterial({
      map: tex, roughness: f ? 0.32 : 0.7, metalness: f ? 0.9 : 0.3, envMapIntensity: f ? 1.3 : 0.4,
      emissive: f ? 0xffffff : 0x000000, emissiveMap: f ? tex : null, emissiveIntensity: f ? 0.18 : 0,
    }))
    const frame = new THREE.Mesh(frameGeo, f ? brass : frameMat)
    frame.position.set(x, y + 0.42, z)
    frame.receiveShadow = true
    group.add(frame)
    const p = new THREE.Mesh(plaqueGeo, mat)
    p.rotation.x = -Math.PI / 2
    p.rotation.z = 0 // o texto lê para quem caminha do deck para a fonte (olhando para −z): a base do texto fica ao sul
    p.position.set(x, y + 0.49, z)
    group.add(p)
    if (f) lightPos.push(new THREE.Vector3(x, y + 0.5, z))
  }
  // luz quente rasante nas placas ocupadas: uma por placa era demais; um foco a cada quatro
  const lights: THREE.PointLight[] = []
  for (let i = 0; i < Math.min(lightPos.length, 8); i += 4) {
    const l = new THREE.PointLight(WARM, 1.6, 30, 1.8)
    l.position.copy(lightPos[i]).add(new THREE.Vector3(0, 2.2, 0))
    group.add(l)
    lights.push(l)
  }

  // ── a linha de luz do fundo: acende do Anel para a Fonte na proporção do fundo ──
  const len = FOUNDERS_LINE_R1 - FOUNDERS_LINE_R0
  const litLen = Math.max(0.5, len * progress)
  const y0 = yAt(0, -FOUNDERS_LINE_R0)
  const litMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const dimMat = track(new THREE.MeshBasicMaterial({ color: 0x3a2e1c, toneMapped: false }))
  const lit = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9, litLen)), litMat)
  lit.rotation.x = -Math.PI / 2
  lit.position.set(0, y0 + 0.44, -(FOUNDERS_LINE_R0 + litLen / 2))
  group.add(lit)
  const dim = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9, len - litLen)), dimMat)
  dim.rotation.x = -Math.PI / 2
  dim.position.set(0, y0 + 0.44, -(FOUNDERS_LINE_R0 + litLen + (len - litLen) / 2))
  group.add(dim)
  // a cabeça da linha: um marco de latão com o número
  const head = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 24)), brass)
  head.position.set(0, y0 + 0.25, -(FOUNDERS_LINE_R0 + litLen))
  group.add(head)
  const headTex = track((() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = '#F7931A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '700 44px "JetBrains Mono", ui-monospace, monospace'
    const d = opts.data
    ctx.fillText(d ? `${fmtDog(d.total_received)} OF ${fmtDog(d.goal)} DOG · ${d.progress_pct.toFixed(1)}%` : 'THE FUND', 256, 46)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 24px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('WHEN THE LIGHT REACHES THE FOUNTAIN, THE CITY OPENS', 256, 96)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  })())
  const headSign = new THREE.Mesh(track(new THREE.PlaneGeometry(6, 1.5)), track(new THREE.MeshBasicMaterial({ map: headTex, toneMapped: false })))
  headSign.rotation.x = -Math.PI / 2
  headSign.position.set(0, y0 + 0.5, -(FOUNDERS_LINE_R0 + litLen) + 2.2)
  group.add(headSign)
  // a placa de entrada, junto ao deck: o que é esta calçada
  const gateTex = track((() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 1024, 256)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f2ead6'; ctx.font = '700 54px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText("FOUNDERS' WALK", 512, 70)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('every wallet that paid for this city, in the order it arrived', 512, 140)
    ctx.fillStyle = '#F7931A'
    ctx.fillText(`${founders.length} founders · ${total - founders.length} plaques waiting`, 512, 196)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  })())
  const gate = new THREE.Mesh(track(new THREE.PlaneGeometry(10, 2.5)), track(new THREE.MeshBasicMaterial({ map: gateTex, toneMapped: false })))
  gate.rotation.x = -Math.PI / 2
  gate.position.set(0, y0 + 0.5, -(FOUNDERS_LINE_R0 + 8))
  group.add(gate)

  return {
    group,
    update(t) { for (const l of lights) l.intensity = 1.6 * (0.9 + 0.1 * Math.sin(t * 1.1 + l.position.z * 0.05)) },
    dispose() { for (const d of disposables) d.dispose() },
  }
}
