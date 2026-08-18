// As duas estátuas da praça (praca-jardins.md §2, brief do fundador 2026-08-18):
//
//   SATOSHI, à maneira de Lugano: a figura sentada de capuz, com o laptop no colo,
//   feita de LÂMINAS de aço paralelas (planos sagitais, atravessando de trás
//   para a frente): de frente quase some (só as arestas das lâminas, com vazios
//   entre elas), de lado aparece inteira. A figura é definida como um campo de
//   distância (união de cápsulas, elipsoides e caixas), cortada em N lâminas por
//   marching squares e extrudada: tudo procedural, uma malha só.
//
//   LEONIDAS, o fundador do DOG: alto, imponente, capa e capuz negros, e o rosto é
//   uma CAVEIRA AMARELA de olhos vermelhos acesos. Não pixel art: a caveira é
//   modelada (crânio, malares, órbitas, nariz, maxilar, dentes), a capa cai em
//   pregas, o capuz sombreia. Escala de monumento.
//
// Ambas nascem em metros na escala real (Satoshi sentado ~1,4 m; Leonidas ~2,2 m)
// e quem as coloca escala.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ═══════════════════════════════════════════════════════════════════════════════
// SDF, o mínimo: esferas, elipsoides, cápsulas, caixas (com giro em x), união
// suave e subtração. p em metros.
// ═══════════════════════════════════════════════════════════════════════════════
type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const sdSphere = (p: V3, c: V3, r: number) => len(sub(p, c)) - r
function sdEllipsoid(p: V3, c: V3, r: V3): number {
  const q = sub(p, c)
  const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2])
  const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]))
  if (k1 < 1e-9) return -Math.min(r[0], r[1], r[2])
  return (k0 * (k0 - 1)) / k1
}
function sdCapsule(p: V3, a: V3, b: V3, r: number): number {
  const pa = sub(p, a), ba = sub(b, a)
  const h = THREE.MathUtils.clamp((pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2]), 0, 1)
  return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - r
}
/** caixa arredondada, centro c, meias-medidas h, girada `rx` em torno de x */
function sdBox(p: V3, c: V3, h: V3, round = 0.01, rx = 0): number {
  let q = sub(p, c)
  if (rx) {
    const cs = Math.cos(-rx), sn = Math.sin(-rx)
    q = [q[0], q[1] * cs - q[2] * sn, q[1] * sn + q[2] * cs]
  }
  const d: V3 = [Math.abs(q[0]) - h[0], Math.abs(q[1]) - h[1], Math.abs(q[2]) - h[2]]
  const outside = Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0), Math.max(d[2], 0))
  const inside = Math.min(Math.max(d[0], d[1], d[2]), 0)
  return outside + inside - round
}
const smin = (a: number, b: number, k: number) => {
  const h = THREE.MathUtils.clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return b + (a - b) * h - k * h * (1 - h)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Marching squares → laços fechados → THREE.Shape (com furos) → extrusão
// ═══════════════════════════════════════════════════════════════════════════════
type Pt = [number, number]
/** contornos f=0 de uma grade (nx × ny) de valores f(u, v); devolve laços fechados */
function contours(f: (u: number, v: number) => number, u0: number, u1: number, v0: number, v1: number, h: number): Pt[][] {
  const nu = Math.ceil((u1 - u0) / h), nv = Math.ceil((v1 - v0) / h)
  const F = new Float32Array((nu + 1) * (nv + 1))
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) F[j * (nu + 1) + i] = f(u0 + i * h, v0 + j * h)
  const at = (i: number, j: number) => F[j * (nu + 1) + i]
  const segs: [Pt, Pt][] = []
  const lerp = (i0: number, j0: number, i1: number, j1: number): Pt => {
    const a = at(i0, j0), b = at(i1, j1)
    const t = a === b ? 0.5 : THREE.MathUtils.clamp(a / (a - b), 0, 1)
    return [u0 + (i0 + (i1 - i0) * t) * h, v0 + (j0 + (j1 - j0) * t) * h]
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = at(i, j) < 0, b = at(i + 1, j) < 0, c = at(i + 1, j + 1) < 0, d = at(i, j + 1) < 0
      const idx = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0)
      if (idx === 0 || idx === 15) continue
      // arestas: 0 = ab (baixo), 1 = bc (direita), 2 = cd (cima), 3 = da (esquerda)
      const E = (e: number): Pt => e === 0 ? lerp(i, j, i + 1, j) : e === 1 ? lerp(i + 1, j, i + 1, j + 1) : e === 2 ? lerp(i + 1, j + 1, i, j + 1) : lerp(i, j + 1, i, j)
      // tabela com o interior à DIREITA do sentido (e0 → e1); os segmentos entram
      // invertidos, para o interior ficar à esquerda e a borda externa ter área > 0
      const T: Record<number, [number, number][]> = {
        1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [1, 0]], 6: [[0, 2]], 7: [[3, 2]],
        8: [[2, 3]], 9: [[2, 0]], 10: [[2, 1], [0, 3]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
      }
      for (const [e0, e1] of T[idx]) segs.push([E(e1), E(e0)])
    }
  }
  // encadeia: início → fim, por chave quantizada
  const key = (p: Pt) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`
  const byStart = new Map<string, [Pt, Pt][]>()
  for (const s of segs) { const k = key(s[0]); const l = byStart.get(k) ?? []; l.push(s); byStart.set(k, l) }
  const used = new Set<[Pt, Pt]>()
  const loops: Pt[][] = []
  for (const s of segs) {
    if (used.has(s)) continue
    const loop: Pt[] = [s[0]]
    let cur = s
    used.add(cur)
    for (let guard = 0; guard < segs.length + 2; guard++) {
      loop.push(cur[1])
      const nexts = byStart.get(key(cur[1]))
      const nx = nexts?.find((n) => !used.has(n))
      if (!nx) break
      used.add(nx)
      cur = nx
      if (key(cur[1]) === key(loop[0])) { loop.push(cur[1]); break }
    }
    if (loop.length >= 4) loops.push(loop)
  }
  return loops
}
const signedArea = (l: Pt[]) => { let a = 0; for (let i = 0; i < l.length - 1; i++) a += l[i][0] * l[i + 1][1] - l[i + 1][0] * l[i][1]; return a / 2 }
function pointInLoop(p: Pt, l: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = l.length - 2; i < l.length - 1; j = i++) {
    const yi = l[i][1], yj = l[j][1]
    if (yi > p[1] !== yj > p[1] && p[0] < ((l[j][0] - l[i][0]) * (p[1] - yi)) / (yj - yi) + l[i][0]) inside = !inside
  }
  return inside
}
/** laços → formas com furos (o interior fica à esquerda: área > 0 = borda externa) */
function shapesFrom(loops: Pt[][]): THREE.Shape[] {
  const outers = loops.filter((l) => signedArea(l) > 0)
  const holes = loops.filter((l) => signedArea(l) < 0)
  return outers.map((o) => {
    const sh = new THREE.Shape(o.map(([x, y]) => new THREE.Vector2(x, y)))
    for (const hl of holes) {
      if (pointInLoop(hl[0], o)) {
        // o furo pertence ao menor externo que o contém
        const smaller = outers.some((o2) => o2 !== o && Math.abs(signedArea(o2)) < Math.abs(signedArea(o)) && pointInLoop(hl[0], o2))
        if (!smaller) sh.holes.push(new THREE.Path(hl.map(([x, y]) => new THREE.Vector2(x, y))))
      }
    }
    return sh
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SATOSHI de Lugano: a figura como SDF, cortada em lâminas sagitais
// ═══════════════════════════════════════════════════════════════════════════════
/** distância com sinal à figura sentada (metros, y para cima, olha para +z) */
function satoshiSDF(p: V3): number {
  let d = Infinity
  // a cabeça e o capuz (uma casca aberta na frente, caindo até os ombros)
  const head = sdSphere(p, [0, 1.19, 0.03], 0.125)
  const hoodOuter = sdEllipsoid(p, [0, 1.17, -0.04], [0.21, 0.27, 0.23])
  const hoodInner = sdEllipsoid(p, [0, 1.17, -0.04], [0.17, 0.225, 0.19])
  const opening = sdEllipsoid(p, [0, 1.15, 0.2], [0.14, 0.17, 0.19])
  const hood = Math.max(Math.max(hoodOuter, -hoodInner), -opening)
  d = Math.min(d, head, hood)
  // o capuz desce e vira o manto dos ombros
  const cape = sdEllipsoid(p, [0, 0.98, -0.05], [0.31, 0.15, 0.25])
  d = smin(d, cape, 0.05)
  // tronco e ombros
  const torso = sdEllipsoid(p, [0, 0.79, -0.03], [0.28, 0.33, 0.2])
  d = smin(d, torso, 0.06)
  for (const s of [-1, 1]) {
    d = smin(d, sdSphere(p, [s * 0.25, 0.97, -0.02], 0.1), 0.05)
    // braços: do ombro ao cotovelo, do cotovelo às mãos sobre o teclado
    d = smin(d, sdCapsule(p, [s * 0.27, 0.97, -0.02], [s * 0.3, 0.72, 0.13], 0.075), 0.03)
    d = smin(d, sdCapsule(p, [s * 0.3, 0.72, 0.13], [s * 0.13, 0.6, 0.33], 0.06), 0.03)
    d = smin(d, sdSphere(p, [s * 0.12, 0.585, 0.36], 0.055), 0.02)
    // pernas cruzadas: coxa para fora e para a frente, canela cruzando à frente
    d = smin(d, sdCapsule(p, [s * 0.14, 0.5, 0.0], [s * 0.36, 0.31, 0.22], 0.11), 0.04)
    d = smin(d, sdCapsule(p, [s * 0.36, 0.31, 0.22], [-s * 0.09, 0.15, 0.36 + (s > 0 ? 0.04 : -0.02)], 0.08), 0.03)
    d = smin(d, sdSphere(p, [-s * 0.13, 0.13, 0.4 + (s > 0 ? 0.03 : -0.03)], 0.065), 0.02)
  }
  // o assento (as ancas) e o laptop
  d = smin(d, sdEllipsoid(p, [0, 0.36, -0.06], [0.28, 0.2, 0.24]), 0.05)
  d = Math.min(d, sdBox(p, [0, 0.545, 0.36], [0.21, 0.012, 0.15], 0.006))
  d = Math.min(d, sdBox(p, [0, 0.72, 0.53], [0.21, 0.165, 0.01], 0.006, 0.28))
  return d
}

export interface Statue {
  group: THREE.Group
  height: number
  dispose: () => void
}

/** A figura em lâminas: `pitch` metros entre lâminas, `thick` de espessura. */
export function buildSatoshiLugano(opts: { pitch?: number; thick?: number; grid?: number } = {}): Statue {
  const pitch = opts.pitch ?? 0.02, thick = opts.thick ?? 0.006, h = opts.grid ?? 0.011
  const geos: THREE.BufferGeometry[] = []
  const X0 = -0.5, X1 = 0.5
  for (let x = X0; x <= X1 + 1e-6; x += pitch) {
    // a figura desce 0,14 m e o plinto corta o que sobra: sentada de verdade,
    // sem vão entre o assento e a pedra
    const loops = contours((u, v) => Math.max(satoshiSDF([x, v + 0.14, u]), -v), -0.34, 0.62, 0.0, 1.5, h)
    if (!loops.length) continue
    const shapes = shapesFrom(loops)
    if (!shapes.length) continue
    const g = new THREE.ExtrudeGeometry(shapes, { depth: thick, bevelEnabled: false, curveSegments: 4 })
    // a forma vive em (u = z, v = y); a extrusão (z da forma) vira x: giro de −90° em y
    g.rotateY(-Math.PI / 2)
    g.translate(x - thick / 2, 0, 0)
    geos.push(g)
  }
  const merged = mergeGeometries(geos, false)!
  for (const g of geos) g.dispose()
  merged.computeVertexNormals()
  // aço inox à luz da praça: metálico mas não espelho puro (o céu é preto e um
  // espelho puro vira silhueta negra); a rugosidade deixa o sol e os focos pegarem
  const mat = new THREE.MeshStandardMaterial({ color: 0xd6dae0, metalness: 0.72, roughness: 0.32, envMapIntensity: 1.8, side: THREE.DoubleSide, emissive: 0x14161a, emissiveIntensity: 0.6 })
  const mesh = new THREE.Mesh(merged, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.name = 'SatoshiLugano'
  const group = new THREE.Group()
  group.add(mesh)
  return { group, height: 1.44, dispose() { merged.dispose(); mat.dispose() } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEONIDAS: capa negra em pregas, capuz justo à cabeça, e a caveira REAL
// (CC0 "Human Skull" de CDmir, OpenGameArt, convertida por
// blender/convert_skull_oga.py em public/city/leonidas-skull.glb: 4,5 mil tris,
// albedo×AO 1K, normal 1K, rugosidade; 0,22 m de altura, origem no centro,
// rosto para +z), tingida de amarelo, com os olhos vermelhos acesos no fundo das
// órbitas. Proporções humanas: 2,3 m de altura, cabeça de 22 cm, capuz que a
// abraça (o primeiro capuz era três vezes maior que a caveira).
// ═══════════════════════════════════════════════════════════════════════════════
const HEAD_Y = 2.02 // centro da caveira
/** capa: superfície de revolução com pregas (raio modulado no ângulo), do chão aos ombros/pescoço */
function capeGeometry(): THREE.BufferGeometry {
  const RINGS = 44, SEG = 80
  const pos: number[] = [], idx: number[] = [], uv: number[] = []
  const H = 1.88 // do chão ao pescoço
  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS, y = t * H
    // a silhueta de um corpo alto sob a capa: bainha larga, cintura, peito,
    // ombros marcados, pescoço (pontos-chave em t → raio, interpolados)
    const K: [number, number][] = [[0, 0.44], [0.3, 0.33], [0.55, 0.3], [0.78, 0.31], [0.88, 0.335], [0.94, 0.24], [1, 0.1]]
    let base = K[K.length - 1][1]
    for (let k = 0; k < K.length - 1; k++) {
      if (t >= K[k][0] && t <= K[k + 1][0]) {
        const u = (t - K[k][0]) / (K[k + 1][0] - K[k][0])
        const uu = u * u * (3 - 2 * u)
        base = K[k][1] + (K[k + 1][1] - K[k][1]) * uu
        break
      }
    }
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2
      // pregas fundas embaixo, somem no ombro; a frente (+z, a = π/2) tem a abertura da capa;
      // os braços insinuados dos lados (a = 0 e π), da cintura ao ombro
      const fold = (0.045 * Math.sin(a * 9 + t * 1.6) + 0.018 * Math.sin(a * 21 + 1.3)) * Math.pow(1 - t, 0.9)
      const front = Math.exp(-Math.pow((a - Math.PI / 2) / 0.22, 2)) * (1 - t) * 0.04
      const armWin = t > 0.3 && t < 0.88 ? Math.sin(((t - 0.3) / 0.58) * Math.PI) : 0
      const arms = 0.05 * armWin * (Math.exp(-Math.pow(a / 0.5, 2)) + Math.exp(-Math.pow((a - Math.PI) / 0.5, 2)) + Math.exp(-Math.pow((a - 2 * Math.PI) / 0.5, 2)))
      const r = base + fold - front + arms
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r)
      uv.push(i / SEG, t)
    }
  }
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
    const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
/** capuz: casca de revolução aberta na frente num arco ogival, justa à cabeça:
 *  nasce nos ombros (r 0,3), abraça o crânio (r 0,15) e fecha num pico atrás */
function hoodGeometry(): THREE.BufferGeometry {
  const RINGS = 32, SEG = 56
  const pos: number[] = [], idx: number[] = []
  const Y0 = 1.7, Y1 = 2.36
  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS
    const y = Y0 + (Y1 - Y0) * t
    // raio: 0,3 nos ombros → 0,155 na altura do rosto (t≈0.5) → 0 no pico
    const r = t < 0.5 ? 0.3 - (0.3 - 0.155) * Math.sin((t / 0.5) * Math.PI * 0.5) : 0.155 * Math.cos(((t - 0.5) / 0.5) * Math.PI * 0.5) + 0.02 * (1 - t)
    // o pico cai um pouco para trás; a borda da frente avança sobre o rosto no meio
    const zc = -0.09 * Math.max(0, t - 0.5) * 2 + 0.03
    // meia-abertura: 1,05 rad nos ombros, 0,8 no rosto, fecha no pico
    const half = t < 0.55 ? 1.05 - 0.25 * (t / 0.55) : 0.8 * Math.pow(1 - (t - 0.55) / 0.45, 0.7) + 0.02
    const a0 = Math.PI / 2 + half, a1 = Math.PI / 2 + Math.PI * 2 - half
    for (let i = 0; i <= SEG; i++) {
      const a = a0 + (i / SEG) * (a1 - a0)
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r + zc)
    }
  }
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
    const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** `skull`: a cena do leonidas-skull.glb (será clonada; materiais tingidos). */
export function buildLeonidas(skull: THREE.Object3D): Statue {
  const group = new THREE.Group()
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const cloth = track(new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide }))
  const clothIn = track(new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, side: THREE.DoubleSide }))
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 1 }))
  const cape = new THREE.Mesh(track(capeGeometry()), cloth)
  cape.castShadow = cape.receiveShadow = true
  group.add(cape)
  // o peito sob a capa e o pescoço
  const chest = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.15, 0.36, 6, 16)), cloth)
  chest.position.set(0, 1.5, 0.02)
  chest.scale.set(1.3, 1, 0.8)
  group.add(chest)
  const neck = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.075, 0.2, 12)), dark)
  neck.position.set(0, 1.84, 0.02)
  group.add(neck)
  const hood = new THREE.Mesh(track(hoodGeometry()), cloth)
  hood.castShadow = true
  group.add(hood)
  const hoodIn = new THREE.Mesh(track(hoodGeometry()), clothIn)
  hoodIn.scale.set(0.985, 0.995, 0.985)
  hoodIn.position.y = 0.006
  group.add(hoodIn)
  // a caveira: clona a cena, tinge de amarelo, liga sombras
  const sk = skull.clone(true)
  sk.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    const mat = src.clone()
    mat.color.setRGB(1.0, 0.86, 0.22) // o amarelo do Leonidas sobre o osso
    mat.emissive = new THREE.Color(0x4a3408)
    mat.emissiveIntensity = 0.5
    mat.roughness = 0.6
    mat.metalness = 0.05
    if (mat.normalScale) mat.normalScale.set(0.9, 0.9)
    m.material = track(mat)
    m.castShadow = true
    m.receiveShadow = true
  })
  sk.position.set(0, HEAD_Y, 0.03)
  sk.rotation.x = 0.05
  group.add(sk)
  // os olhos: duas brasas no fundo das órbitas
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(track(new THREE.SphereGeometry(0.011, 12, 10)), track(new THREE.MeshBasicMaterial({ color: 0xff2612, toneMapped: false })))
    eye.position.set(s * 0.033, HEAD_Y + 0.014, 0.03 + 0.058)
    group.add(eye)
    const l = new THREE.PointLight(0xff2a1a, 0.6, 1.6, 2)
    l.position.set(s * 0.04, HEAD_Y + 0.02, 0.15)
    group.add(l)
  }
  return { group, height: 2.36, dispose() { for (const d of disposables) d.dispose() } }
}
