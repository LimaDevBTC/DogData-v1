// O CÍRCULO DOS FUNDADORES (praca-jardins.md §3, movido em 2026-08-19): no PÉ DA
// TORRE, sobre o deck, e não mais no bulevar norte (que um dia leva à quarta
// âncora, e a placa de quem pagou a cidade não pode ficar no caminho de um lote
// futuro).
//
//   dois anéis de placas de latão em volta da Needle, na ordem de chegada
//   (founder_seq de /api/donate/leaderboard), com o endereço gravado, o total em
//   DOG e a data; depois das ocupadas, placas escuras à espera;
//   e o ANEL DE LUZ em volta delas, que fecha na proporção do fundo: quando o
//   círculo fechar (10M DOG), a cidade abre.
//
// Nada inventado: os dados chegam vivos da API; a placa de quem doou hoje está
// aqui na próxima visita. Uma malha só para as 48 placas (atlas de textura) e
// duas instâncias para as molduras.
import * as THREE from 'three'
import { DECK_Y, FOUNDERS_RINGS, FOUNDERS_SLOTS, FOUNDERS_RING_R } from './garden-plan'
import type { PerfProfile, DistanceCuller } from './perf'

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

function plaqueTile(f: Founder | null, slot: number): HTMLCanvasElement {
  const W = 512, H = 352
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  if (f) {
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
  return c
}

export function buildFoundersWalk(opts: { heightAt: (x: number, z: number) => number; data: FoundersData | null; profile?: PerfProfile; culler?: DistanceCuller }): FoundersWalk {
  const group = new THREE.Group()
  group.name = 'FoundersCircle'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const founders = [...(opts.data?.founders ?? [])].sort((a, b) => a.founder_seq - b.founder_seq)
  const progress = THREE.MathUtils.clamp((opts.data?.progress_pct ?? 0) / 100, 0, 1)
  const Y = DECK_Y

  // ── as placas: no piso do deck, em dois anéis, o texto lendo de fora ──────
  const PW = 3.4, PD = 2.4
  const COLS = 8, ROWS = 6, TW = 512, TH = 352
  const atlas = document.createElement('canvas')
  atlas.width = COLS * TW; atlas.height = ROWS * TH
  const actx = atlas.getContext('2d')!
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const frameMats: THREE.Matrix4[][] = [[], []] // 0 = latão (ocupada), 1 = escura (vazia)
  const tmpO = new THREE.Object3D()
  const lightPos: THREE.Vector3[] = []
  let k = 0
  for (const { r, n } of FOUNDERS_RINGS) {
    for (let i = 0; i < n; i++, k++) {
      const a = (i / n) * Math.PI * 2 + (r < 66 ? Math.PI / n : 0)
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      const f = founders[k] ?? null
      const col = k % COLS, row = Math.floor(k / COLS)
      actx.drawImage(plaqueTile(f, k + 1), col * TW, row * TH)
      // o quad, deitado, com o topo do texto apontando para FORA do centro
      const u0 = col / COLS, u1 = (col + 1) / COLS
      const v0 = 1 - (row + 1) / ROWS, v1 = 1 - row / ROWS
      const base = positions.length / 3
      const ca = Math.cos(a), sa = Math.sin(a)
      const P = (du: number, dv: number): [number, number] => [
        x + (-sa) * du * (PW / 2) + ca * dv * (PD / 2),
        z + ca * du * (PW / 2) + sa * dv * (PD / 2),
      ]
      const c1 = P(-1, 1), c2 = P(1, 1), c3 = P(1, -1), c4 = P(-1, -1)
      positions.push(c1[0], Y + 0.06, c1[1], c2[0], Y + 0.06, c2[1], c3[0], Y + 0.06, c3[1], c4[0], Y + 0.06, c4[1])
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
      tmpO.position.set(x, Y, z); tmpO.rotation.set(0, -a, 0); tmpO.scale.setScalar(1); tmpO.updateMatrix()
      frameMats[f ? 0 : 1].push(tmpO.matrix.clone())
      if (f) lightPos.push(new THREE.Vector3(x, Y, z))
    }
  }
  const atlasTex = track(new THREE.CanvasTexture(atlas))
  atlasTex.colorSpace = THREE.SRGBColorSpace
  atlasTex.anisotropy = 8
  const plaqueGeo = track(new THREE.BufferGeometry())
  plaqueGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  plaqueGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  plaqueGeo.setIndex(indices)
  plaqueGeo.computeVertexNormals()
  const plaqueMat = track(new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.4, metalness: 0.7, envMapIntensity: 1.1, emissive: 0xffffff, emissiveMap: atlasTex, emissiveIntensity: 0.16 }))
  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat)
  plaqueMesh.receiveShadow = true
  group.add(plaqueMesh)
  const frameGeo = track(new THREE.BoxGeometry(PW + 0.28, 0.1, PD + 0.28))
  const brass = track(new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 0.95, envMapIntensity: 1.2 }))
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.6, metalness: 0.4 }))
  for (const [i, mat] of [[0, brass], [1, frameMat]] as const) {
    if (!frameMats[i].length) continue
    const im = new THREE.InstancedMesh(frameGeo, mat, frameMats[i].length)
    frameMats[i].forEach((m, j) => im.setMatrixAt(j, m))
    im.instanceMatrix.needsUpdate = true
    im.receiveShadow = true
    group.add(im)
  }

  // ── o anel do fundo: fecha na proporção arrecadada ────────────────────────
  const R = FOUNDERS_RING_R
  const litMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const dimMat = track(new THREE.MeshBasicMaterial({ color: 0x3a2e1c, toneMapped: false }))
  const a0 = -Math.PI / 2 // começa ao norte
  const litLen = Math.max(0.02, progress * Math.PI * 2)
  const lit = new THREE.Mesh(track(new THREE.RingGeometry(R - 0.6, R + 0.6, 128, 1, a0, litLen)), litMat)
  lit.rotation.x = -Math.PI / 2
  lit.position.y = Y + 0.05
  group.add(lit)
  const dim = new THREE.Mesh(track(new THREE.RingGeometry(R - 0.45, R + 0.45, 128, 1, a0 + litLen, Math.PI * 2 - litLen)), dimMat)
  dim.rotation.x = -Math.PI / 2
  dim.position.y = Y + 0.05
  group.add(dim)
  const headA = a0 + litLen
  const hx = Math.cos(headA) * R, hz = Math.sin(headA) * R
  const head = new THREE.Mesh(track(new THREE.CylinderGeometry(0.8, 1.0, 0.5, 24)), brass)
  head.position.set(hx, Y + 0.25, hz)
  group.add(head)

  const sign = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    draw(c.getContext('2d')!)
    const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return track(new THREE.MeshBasicMaterial({ map: t, toneMapped: false, transparent: true }))
  }
  const d = opts.data
  const headSign = new THREE.Mesh(track(new THREE.PlaneGeometry(9, 2.25)), sign(512, 128, (ctx) => {
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 512, 128)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#F7931A'; ctx.font = '700 42px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(d ? `${fmtDog(d.total_received)} / ${fmtDog(d.goal)} DOG` : 'THE FUND', 256, 44)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText(d ? `${d.progress_pct.toFixed(1)}% · WHEN THE RING CLOSES, THE CITY OPENS` : 'WHEN THE RING CLOSES, THE CITY OPENS', 256, 92)
  }))
  headSign.rotation.x = -Math.PI / 2
  headSign.rotation.z = -headA + Math.PI / 2
  headSign.position.set(Math.cos(headA) * (R + 3.4), Y + 0.06, Math.sin(headA) * (R + 3.4))
  group.add(headSign)

  const gate = new THREE.Mesh(track(new THREE.PlaneGeometry(12, 3)), sign(1024, 256, (ctx) => {
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, 1024, 256)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f2ead6'; ctx.font = '700 54px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText("THE FOUNDERS' CIRCLE", 512, 70)
    ctx.fillStyle = '#c9bfae'; ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('every wallet that paid for this city, in the order it arrived', 512, 140)
    ctx.fillStyle = '#F7931A'
    ctx.fillText(`${founders.length} founders · ${FOUNDERS_SLOTS - founders.length} plaques waiting`, 512, 196)
  }))
  gate.rotation.x = -Math.PI / 2
  gate.position.set(0, Y + 0.06, -(R + 22))
  group.add(gate)

  // luz quente rasante sobre as placas ocupadas (duas, não uma por placa)
  const lights: THREE.PointLight[] = []
  for (let i = 0; i < Math.min(lightPos.length, 2); i++) {
    const l = new THREE.PointLight(WARM, 2.4, 40, 1.8)
    l.position.copy(lightPos[Math.min(lightPos.length - 1, i * Math.floor(lightPos.length / 2))]).add(new THREE.Vector3(0, 3, 0))
    group.add(l)
    lights.push(l)
  }
  opts.culler?.add(group, (opts.profile?.textCull ?? 1300) * 1.6, new THREE.Vector3(0, 0, 0))
  void opts.heightAt

  return {
    group,
    update(t) { for (const l of lights) l.intensity = 2.4 * (0.9 + 0.1 * Math.sin(t * 1.1 + l.position.x * 0.05)) },
    dispose() { for (const d2 of disposables) d2.dispose() },
  }
}
