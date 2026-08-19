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

export function buildFoundersWalk(opts: { heightAt: (x: number, z: number) => number; data: FoundersData | null; profile?: PerfProfile; culler?: DistanceCuller }): FoundersWalk {
  const group = new THREE.Group()
  group.name = 'FoundersWalk'
  const plaques = new THREE.Group()
  group.add(plaques)
  opts.culler?.add(plaques, (opts.profile?.textCull ?? 1300) * 1.3, new THREE.Vector3(0, 0, -(FOUNDERS_R0 + FOUNDERS_R1) / 2))
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const yAt = opts.heightAt
  const founders = [...(opts.data?.founders ?? [])].sort((a, b) => a.founder_seq - b.founder_seq)
  const progress = THREE.MathUtils.clamp((opts.data?.progress_pct ?? 0) / 100, 0, 1)

  // ── as placas: no chão do bulevar norte, dos dois lados, alternando ────────
  // Uma chamada de desenho para as 48 placas (atlas 8×6 numa textura só, malha
  // fundida com o UV de cada placa) e duas para as molduras (instanciadas: latão
  // nas ocupadas, escura nas vazias). Antes eram 96 malhas e 48 texturas.
  const PW = 3.6, PD = 2.5
  const total = FOUNDERS_SLOTS_PER_SIDE * 2
  const step = (FOUNDERS_R1 - FOUNDERS_R0) / (FOUNDERS_SLOTS_PER_SIDE - 1)
  const COLS = 8, ROWS = 6, TW = 512, TH = 352
  const atlas = document.createElement('canvas')
  atlas.width = COLS * TW; atlas.height = ROWS * TH
  const actx = atlas.getContext('2d')!
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const lightPos: THREE.Vector3[] = []
  const frameMats: THREE.Matrix4[][] = [[], []] // 0 = latão (ocupada), 1 = escura (vazia)
  const tmpO = new THREE.Object3D()
  for (let k = 0; k < total; k++) {
    const side = k % 2 === 0 ? -1 : 1 // esquerda, direita, esquerda…
    const idx = Math.floor(k / 2)
    const r = FOUNDERS_R0 + idx * step
    const x = side * FOUNDERS_SIDE, z = -r // o norte é −z
    const y = yAt(x, z)
    const f = founders[k] ?? null
    // a arte da placa entra no atlas
    const tile = plaqueTexture(f, k + 1)
    const col = k % COLS, row = Math.floor(k / COLS)
    actx.drawImage(tile.image as HTMLCanvasElement, col * TW, row * TH)
    tile.dispose()
    // o quad da placa, no chão, com o topo do texto para o norte (−z)
    const u0 = col / COLS, u1 = (col + 1) / COLS
    const v0 = 1 - (row + 1) / ROWS, v1 = 1 - row / ROWS
    const base = positions.length / 3
    const yy = y + 0.49
    positions.push(x - PW / 2, yy, z + PD / 2, x + PW / 2, yy, z + PD / 2, x + PW / 2, yy, z - PD / 2, x - PW / 2, yy, z - PD / 2)
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    tmpO.position.set(x, y + 0.42, z); tmpO.rotation.set(0, 0, 0); tmpO.scale.setScalar(1); tmpO.updateMatrix()
    frameMats[f ? 0 : 1].push(tmpO.matrix.clone())
    if (f) lightPos.push(new THREE.Vector3(x, y + 0.5, z))
  }
  const atlasTex = track(new THREE.CanvasTexture(atlas))
  atlasTex.colorSpace = THREE.SRGBColorSpace
  atlasTex.anisotropy = 8
  const plaqueGeo = track(new THREE.BufferGeometry())
  plaqueGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  plaqueGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  plaqueGeo.setIndex(indices)
  plaqueGeo.computeVertexNormals()
  const plaqueMat = track(new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.4, metalness: 0.7, envMapIntensity: 1.1, emissive: 0xffffff, emissiveMap: atlasTex, emissiveIntensity: 0.14 }))
  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat)
  plaqueMesh.receiveShadow = true
  plaques.add(plaqueMesh)
  const frameGeo = track(new THREE.BoxGeometry(PW + 0.3, 0.12, PD + 0.3))
  const brass = track(new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 0.95, envMapIntensity: 1.2 }))
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.6, metalness: 0.4 }))
  for (const [i, mat] of [[0, brass], [1, frameMat]] as const) {
    if (!frameMats[i].length) continue
    const im = new THREE.InstancedMesh(frameGeo, mat, frameMats[i].length)
    frameMats[i].forEach((m, j) => im.setMatrixAt(j, m))
    im.instanceMatrix.needsUpdate = true
    im.receiveShadow = true
    plaques.add(im)
  }
  // luz quente rasante nas placas ocupadas: uma
  const lights: THREE.PointLight[] = []
  for (let i = 0; i < Math.min(lightPos.length, 4); i += 4) {
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
