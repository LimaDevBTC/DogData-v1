// O precinto da praça: o que costura o deck às quatro âncoras (praca-central.md §4.2,
// D7 e D8). Um círculo central (o deck, r 300), um cinturão de jardim, um bulevar
// anelar em r 450 ligando as quatro portas, quatro bulevares radiais nos eixos
// cardeais, e as âncoras em r 620: BitFlow a oeste, Kray a leste, o Chalé ao sul, e
// ao norte, enquanto a quarta âncora não existe, a grande fonte e o jardim.
//
// O jardim é clássico, do jeito que o fundador pediu depois de ver (e recusar) a
// versão bioluminescente ("muito colorido"): "um imenso jardim com o que tem de
// mais belo na Terra mesmo, sem inventar muita moda, como os jardins dos cassinos
// e palácios". Gramados e parterres com sebes aparadas, alamedas de palmeiras e
// árvores de copa, topiaria nas esquinas, espelhos d'água com fontes brancas,
// bancos e postes de luz quente: o mesmo vocabulário que os sítios da Kray e da
// BitFlow já trazem (lib_dogcity: palm, street_tree, hedge_block, water_basin,
// lamp), agora contínuo entre elas. Tudo instanciado e semeado por um gerador
// determinístico, para a praça ser a mesma em toda visita.
//
// Paleta: verdes escuros de gramado e sebe, pedra escura nos passeios, água
// branca, luz quente. O laranja DOG fica na arquitetura.
import * as THREE from 'three'

export const R_DECK = 300
export const R_GARDEN_IN = 332
export const R_RING = 452
export const RING_W = 34
export const R_ANCHOR = 620
export const BOULEVARD_W = 42
export const R_EDGE = 900

/** Onde cada âncora fica e para onde olha (rotação em y). Frentes voltadas para o centro. */
export const ANCHORS = {
  west: { pos: new THREE.Vector3(-R_ANCHOR, 0, 0), rotY: Math.PI / 2 },   // BitFlow, frente para +x
  east: { pos: new THREE.Vector3(R_ANCHOR, 0, 0), rotY: -Math.PI / 2 },   // Kray, frente para −x
  south: { pos: new THREE.Vector3(0, 0, R_ANCHOR), rotY: 0 },              // Chalé, frente para −z
  north: { pos: new THREE.Vector3(0, 0, -R_ANCHOR), rotY: Math.PI },      // jardim, por enquanto
} as const

const ICE = new THREE.Color('#F2EAD6')      // luz de poste, branco quente
const WARM = new THREE.Color('#FFB35C')
const LAWN = new THREE.Color('#183121')
const HEDGE = new THREE.Color('#1a3a1f')
const LEAF = new THREE.Color('#2f6b3a')
const LEAF_TIP = new THREE.Color('#6fae63')
const TRUNK = new THREE.Color('#3a2c22')
const WATER_JET = new THREE.Color('#e9f3ff')

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Precinct {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

/** Está dentro de algum bulevar radial? (faixa de largura BOULEVARD_W nos eixos) */
function inRadialBoulevard(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  if (r < R_GARDEN_IN - 20 || r > R_ANCHOR - 100) return false
  return Math.abs(x) < BOULEVARD_W / 2 + 6 || Math.abs(z) < BOULEVARD_W / 2 + 6
}
/** Está no anel do bulevar? */
function inRing(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  return Math.abs(r - R_RING) < RING_W / 2 + 6
}
/** Está no sítio de uma âncora (o retângulo do lote)? */
function inAnchorSite(x: number, z: number): boolean {
  const half = 175
  return (Math.abs(Math.abs(x) - R_ANCHOR) < half && Math.abs(z) < half) || (Math.abs(Math.abs(z) - R_ANCHOR) < half && Math.abs(x) < half)
}

export function buildPrecinct(opts: { heightAt: (x: number, z: number) => number }): Precinct {
  const group = new THREE.Group()
  group.name = 'Precinct'
  const rnd = mulberry(840000)
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const yAt = (x: number, z: number) => opts.heightAt(x, z)

  // ── pavimento: anel e radiais ──────────────────────────────────────────────
  const paveMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 }))
  const kerbMat = track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, transparent: true, opacity: 0.55 }))
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(R_RING - RING_W / 2, R_RING + RING_W / 2, 192)), paveMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.35
  ring.receiveShadow = true
  group.add(ring)
  for (const rr of [R_RING - RING_W / 2, R_RING + RING_W / 2]) {
    const k = new THREE.Mesh(track(new THREE.RingGeometry(rr - 0.35, rr + 0.35, 192)), kerbMat)
    k.rotation.x = -Math.PI / 2
    k.position.y = 0.42
    group.add(k)
  }
  const radialGeo = track(new THREE.PlaneGeometry(BOULEVARD_W, R_ANCHOR - 100 - R_GARDEN_IN + 40))
  const kerbGeo = track(new THREE.PlaneGeometry(0.7, R_ANCHOR - 100 - R_GARDEN_IN + 40))
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    const g = new THREE.Group()
    const mid = (R_GARDEN_IN - 20 + R_ANCHOR - 100) / 2
    const p = new THREE.Mesh(radialGeo, paveMat)
    p.rotation.x = -Math.PI / 2
    p.receiveShadow = true
    g.add(p)
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(kerbGeo, kerbMat)
      k.rotation.x = -Math.PI / 2
      k.position.set(sx * (BOULEVARD_W / 2), 0.07, 0)
      g.add(k)
      // a linha de luz do meio-fio, e postes
    }
    g.position.set(Math.sin(a) * mid, 0.36, Math.cos(a) * mid)
    g.rotation.y = a
    group.add(g)
  }

  // ── o desenho do parterre: alamedas diagonais e o passeio-anel externo ────
  // Visto de cima, um jardim de palácio é um desenho: além dos quatro bulevares
  // cardeais, quatro alamedas nas diagonais (do anel à muralha, passando pelos
  // espelhos d'água) e um passeio circular em r 745 costurando os setores entre
  // as âncoras. Pedra escura com o meio-fio de luz, como o resto.
  const ALLEE_W = 14
  const allee = (a: number, r0: number, r1: number) => {
    const len = r1 - r0, mid = (r0 + r1) / 2
    const g = new THREE.Group()
    const p = new THREE.Mesh(track(new THREE.PlaneGeometry(ALLEE_W, len)), paveMat)
    p.rotation.x = -Math.PI / 2
    p.receiveShadow = true
    g.add(p)
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(track(new THREE.PlaneGeometry(0.6, len)), kerbMat)
      k.rotation.x = -Math.PI / 2
      k.position.set(sx * (ALLEE_W / 2), 0.07, 0)
      g.add(k)
    }
    g.position.set(Math.sin(a) * mid, 0.36, Math.cos(a) * mid)
    g.rotation.y = a
    group.add(g)
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    allee(a, R_RING + RING_W / 2 - 2, 560 - 52) // do anel ao espelho d'água
    allee(a, 560 + 52, R_EDGE - 6)              // do espelho à muralha
  }
  const R_PROM = 745, PROM_W = 12
  const promenadeArc = (a0: number, a1: number) => {
    const seg = Math.max(8, Math.round(((a1 - a0) * R_PROM) / 6))
    const p = new THREE.Mesh(track(new THREE.RingGeometry(R_PROM - PROM_W / 2, R_PROM + PROM_W / 2, seg, 1, a0, a1 - a0)), paveMat)
    p.rotation.x = -Math.PI / 2
    p.position.y = 0.35
    p.receiveShadow = true
    group.add(p)
    for (const rr of [R_PROM - PROM_W / 2, R_PROM + PROM_W / 2]) {
      const k = new THREE.Mesh(track(new THREE.RingGeometry(rr - 0.3, rr + 0.3, seg, 1, a0, a1 - a0)), kerbMat)
      k.rotation.x = -Math.PI / 2
      k.position.y = 0.42
      group.add(k)
    }
  }
  {
    // RingGeometry mede o ângulo a partir de +x no plano da geometria; depois de
    // rotation.x = −π/2 o plano (x, y) vira (x, −z), então theta = atan2(−z, x)
    const free = (theta: number) => { const x = Math.cos(theta) * R_PROM, z = -Math.sin(theta) * R_PROM; return !inAnchorSite(x, z) && Math.hypot(x, z + R_ANCHOR) >= 128 }
    const n = 720
    let start: number | null = null
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2
      const ok = i < n && free(th)
      if (ok && start == null) start = th
      if (!ok && start != null) { if (th - start > 0.05) promenadeArc(start, th); start = null }
    }
  }

  // ── postes: esferas de luz fria em hastes finas, ao longo dos bulevares ────
  const lampCount = 4 * 12 * 2 + 64 + 96
  const poleGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 9, 6))
  const bulbGeo = track(new THREE.SphereGeometry(0.9, 10, 8))
  const poleMat = track(new THREE.MeshStandardMaterial({ color: 0x23242b, metalness: 0.7, roughness: 0.4 }))
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false }))
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampCount)
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount)
  const o = new THREE.Object3D()
  let li = 0
  const lamp = (x: number, z: number) => {
    if (li >= lampCount) return
    const y = yAt(x, z)
    o.position.set(x, y + 4.5, z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix()
    poles.setMatrixAt(li, o.matrix)
    o.position.set(x, y + 9.4, z); o.updateMatrix()
    bulbs.setMatrixAt(li, o.matrix)
    li++
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (let k = 0; k < 12; k++) {
      const r = R_GARDEN_IN + 8 + k * 14.5
      for (const s of [-1, 1]) {
        const off = s * (BOULEVARD_W / 2 + 2.5)
        lamp(Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off)
      }
    }
  }
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2
    const r = R_RING + (k % 2 === 0 ? -1 : 1) * (RING_W / 2 + 2.5)
    lamp(Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2 + Math.PI / 96
    lamp(Math.cos(a) * (R_EDGE + 3), Math.sin(a) * (R_EDGE + 3))
  }
  poles.count = bulbs.count = li
  poles.instanceMatrix.needsUpdate = bulbs.instanceMatrix.needsUpdate = true
  group.add(poles, bulbs)

  // ── espelhos d'água com fontes, nas diagonais entre as âncoras ───────────
  const poolMat = track(new THREE.MeshStandardMaterial({ color: 0x08111c, roughness: 0.05, metalness: 0.7, emissive: 0x0a1a2c, emissiveIntensity: 0.5, envMapIntensity: 1.6 }))
  const poolRimMat = track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, transparent: true, opacity: 0.7 }))
  const jets: THREE.Points[] = []
  const jetTex = makeDotTexture()
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const cx = Math.cos(a) * 560, cz = Math.sin(a) * 560
    const y = yAt(cx, cz)
    const pool = new THREE.Mesh(track(new THREE.CircleGeometry(48, 64)), poolMat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(cx, y + 0.25, cz)
    pool.receiveShadow = true
    group.add(pool)
    const rim = new THREE.Mesh(track(new THREE.RingGeometry(47.4, 48.6, 96)), poolRimMat)
    rim.rotation.x = -Math.PI / 2
    rim.position.set(cx, y + 0.32, cz)
    group.add(rim)
    // a fonte: um jato central e um anel de jatos menores
    const NJ = 900
    const pos = new Float32Array(NJ * 3)
    const seed = new Float32Array(NJ * 2)
    for (let k = 0; k < NJ; k++) { seed[k * 2] = rnd(); seed[k * 2 + 1] = rnd() }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pm = track(new THREE.PointsMaterial({ map: jetTex, color: WATER_JET, size: 1.7, sizeAttenuation: true, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }))
    const pts = new THREE.Points(geo, pm)
    pts.position.set(cx, y + 0.3, cz)
    pts.userData.seed = seed
    pts.frustumCulled = false
    group.add(pts)
    jets.push(pts)
    track(geo)
  }

  // ── o gramado: o cinturão e os setores são relva, e a relva é o fundo do jardim ──
  const lawnMat = track(new THREE.MeshStandardMaterial({ color: LAWN, roughness: 0.95, metalness: 0 }))
  const lawnIn = new THREE.Mesh(track(new THREE.RingGeometry(R_GARDEN_IN - 4, R_RING - RING_W / 2 + 2, 192)), lawnMat)
  lawnIn.rotation.x = -Math.PI / 2
  lawnIn.position.y = 0.2
  lawnIn.receiveShadow = true
  group.add(lawnIn)
  const lawnOut = new THREE.Mesh(track(new THREE.RingGeometry(R_RING + RING_W / 2 - 2, R_EDGE - 6, 256)), lawnMat)
  lawnOut.rotation.x = -Math.PI / 2
  lawnOut.position.y = 0.2
  lawnOut.receiveShadow = true
  group.add(lawnOut)
  // ── a borda do jardim: passeio perimetral, muralha baixa de pedra e postes ──
  // Um jardim de palácio termina numa linha desenhada, não desmancha no regolito.
  const edgePath = new THREE.Mesh(track(new THREE.RingGeometry(R_EDGE - 7, R_EDGE + 8, 256)), paveMat)
  edgePath.rotation.x = -Math.PI / 2
  edgePath.position.y = 0.34
  edgePath.receiveShadow = true
  group.add(edgePath)
  const wall = new THREE.Mesh(
    track(new THREE.CylinderGeometry(R_EDGE + 9.4, R_EDGE + 9.4, 1.6, 256, 1, true)),
    track(new THREE.MeshStandardMaterial({ color: 0x1c1c21, roughness: 0.8, metalness: 0.15, side: THREE.DoubleSide })),
  )
  wall.position.y = 0.8
  wall.castShadow = wall.receiveShadow = true
  group.add(wall)
  const wallCap = new THREE.Mesh(track(new THREE.RingGeometry(R_EDGE + 8.4, R_EDGE + 10.4, 256)), track(new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.2 })))
  wallCap.rotation.x = -Math.PI / 2
  wallCap.position.y = 1.62
  group.add(wallCap)
  const edgeLine = new THREE.Mesh(track(new THREE.RingGeometry(R_EDGE - 7.4, R_EDGE - 6.6, 256)), kerbMat)
  edgeLine.rotation.x = -Math.PI / 2
  edgeLine.position.y = 0.42
  group.add(edgeLine)

  // onde pode nascer: cinturão 332..440 (fora dos radiais e do anel), e setores
  // 480..900 fora dos sítios das âncoras, dos bulevares e dos espelhos d'água
  const canGrow = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    if (r < R_GARDEN_IN || r > 900) return false
    if (inRing(x, z) || inRadialBoulevard(x, z) || inAnchorSite(x, z)) return false
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2
      if (Math.hypot(x - Math.cos(a) * 560, z - Math.sin(a) * 560) < 62) return false
    }
    if (Math.hypot(x, z + R_ANCHOR) < 120) return false // a grande fonte do norte
    if (Math.abs(r - 745) < 6 + 5) return false // o passeio-anel
    // as alamedas diagonais: distância ao eixo diagonal mais próximo
    if (r > R_RING && Math.min(Math.abs(x - z), Math.abs(x + z)) / Math.SQRT2 < 7 + 5) return false
    return true
  }
  const sample = (n: number, rMin: number, rMax: number, tries = 40): [number, number][] => {
    const out: [number, number][] = []
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < tries; t++) {
        const a = rnd() * Math.PI * 2
        const r = Math.sqrt(rMin * rMin + rnd() * (rMax * rMax - rMin * rMin))
        const x = Math.cos(a) * r, z = Math.sin(a) * r
        if (canGrow(x, z)) { out.push([x, z]); break }
      }
    }
    return out
  }

  // ── sebes aparadas: parterres em arcos concêntricos e linhas radiais ──────
  const hedgeGeo = track(new THREE.BoxGeometry(1, 1, 1))
  const hedgeMat = track(new THREE.MeshStandardMaterial({ color: HEDGE, roughness: 0.9 }))
  const hedges: THREE.Matrix4[] = []
  const hedgeArc = (r: number, a0: number, a1: number, h = 1.6, w = 1.4) => {
    const len = r * (a1 - a0)
    const n = Math.max(1, Math.round(len / 3))
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) / n) * (a1 - a0)
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      o.position.set(x, yAt(x, z) + h / 2, z); o.rotation.set(0, -a, 0); o.scale.set(3.1, h, w); o.updateMatrix()
      hedges.push(o.matrix.clone())
    }
  }
  const hedgeLine = (x0: number, z0: number, x1: number, z1: number, h = 1.6, w = 1.4) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3))
    const yaw = Math.atan2(x1 - x0, z1 - z0)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
      o.position.set(x, yAt(x, z) + h / 2, z); o.rotation.set(0, yaw, 0); o.scale.set(w, h, 3.1); o.updateMatrix()
      hedges.push(o.matrix.clone())
    }
  }
  const gap = (r: number) => (BOULEVARD_W / 2 + 10) / r // meio-ângulo do bulevar radial em r
  // cinturão interno: dois arcos por quadrante, com sebes radiais nas pontas
  for (let q = 0; q < 4; q++) {
    const a0 = q * Math.PI / 2, a1 = a0 + Math.PI / 2
    for (const r of [R_GARDEN_IN + 14, R_GARDEN_IN + 62]) hedgeArc(r, a0 + gap(r), a1 - gap(r))
    for (const a of [a0 + gap(R_GARDEN_IN + 14), a1 - gap(R_GARDEN_IN + 14)]) {
      hedgeLine(Math.cos(a) * (R_GARDEN_IN + 14), Math.sin(a) * (R_GARDEN_IN + 14), Math.cos(a) * (R_GARDEN_IN + 62), Math.sin(a) * (R_GARDEN_IN + 62))
    }
    // as sebes que emolduram o bulevar radial e o anel
    const ea = a0 + gap(R_GARDEN_IN + 8) - 0.012, eb = a1 - gap(R_GARDEN_IN + 8) + 0.012
    hedgeLine(Math.cos(ea) * (R_GARDEN_IN + 4), Math.sin(ea) * (R_GARDEN_IN + 4), Math.cos(ea + 0.001) * (R_RING - RING_W / 2 - 4), Math.sin(ea + 0.001) * (R_RING - RING_W / 2 - 4), 1.2, 1.2)
    hedgeLine(Math.cos(eb) * (R_GARDEN_IN + 4), Math.sin(eb) * (R_GARDEN_IN + 4), Math.cos(eb) * (R_RING - RING_W / 2 - 4), Math.sin(eb) * (R_RING - RING_W / 2 - 4), 1.2, 1.2)
  }
  // setores externos: três arcos por quadrante, interrompidos nos sítios e nos espelhos
  for (let q = 0; q < 4; q++) {
    const a0 = q * Math.PI / 2, a1 = a0 + Math.PI / 2
    for (const r of [500, 560, 620, 690, 760, 830]) {
      const g = gap(r) + 0.02
      // divide o arco em trechos que não atravessam sítio, espelho ou fonte
      const n = 60
      let start: number | null = null
      for (let i = 0; i <= n; i++) {
        const a = a0 + g + ((a1 - a0 - 2 * g) * i) / n
        const x = Math.cos(a) * r, z = Math.sin(a) * r
        const ok = i < n && canGrow(x, z)
        if (ok && start == null) start = a
        if (!ok && start != null) { if (a - start > 0.03) hedgeArc(r, start, a); start = null }
      }
    }
  }
  const hedgeMesh = new THREE.InstancedMesh(hedgeGeo, hedgeMat, hedges.length)
  hedges.forEach((m, i) => hedgeMesh.setMatrixAt(i, m))
  hedgeMesh.instanceMatrix.needsUpdate = true
  hedgeMesh.castShadow = hedgeMesh.receiveShadow = true
  group.add(hedgeMesh)

  // ── palmeiras: alamedas nos bulevares e no anel, e bosques nos setores ────
  const palms: [number, number][] = [...sample(70, R_GARDEN_IN + 20, 430), ...sample(150, 480, 900)]
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (let k = 0; k < 8; k++) {
      const r = R_GARDEN_IN + 16 + k * 16
      for (const sx of [-1, 1]) {
        const off = sx * (BOULEVARD_W / 2 + 7)
        palms.push([Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off])
      }
    }
  }
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2
    if (Math.abs(Math.sin(2 * a)) < 0.14) continue // deixa as portas dos bulevares livres
    for (const sr of [-1, 1]) {
      const r = R_RING + sr * (RING_W / 2 + 9)
      palms.push([Math.cos(a) * r, Math.sin(a) * r])
    }
  }
  const trunkGeo = track(new THREE.CylinderGeometry(0.42, 0.7, 1, 8))
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.85 }))
  const frondGeo = track(makeFrondGeometry())
  const frondMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }))
  const FRONDS = 9
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length)
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palms.length * FRONDS)
  palms.forEach(([x, z], i) => {
    const h = 11 + rnd() * 9
    const y = yAt(x, z)
    o.position.set(x, y + h / 2, z); o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.06); o.scale.set(1, h, 1); o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
    for (let f = 0; f < FRONDS; f++) {
      const a = (f / FRONDS) * Math.PI * 2 + rnd() * 0.35
      const len = h * (0.42 + rnd() * 0.16)
      o.position.set(x, y + h, z); o.rotation.set(0, a, 0); o.scale.set(len, len, len); o.updateMatrix()
      fronds.setMatrixAt(i * FRONDS + f, o.matrix)
    }
  })
  trunks.castShadow = fronds.castShadow = true
  trunks.instanceMatrix.needsUpdate = fronds.instanceMatrix.needsUpdate = true
  group.add(trunks, fronds)

  // ── árvores de copa redonda: nos setores, entre os arcos de sebe ─────────
  const trees = sample(140, 480, 900)
  const treeTrunkGeo = track(new THREE.CylinderGeometry(0.5, 0.9, 1, 7))
  const canopyGeo = track(new THREE.SphereGeometry(1, 12, 9))
  const canopyMat = track(new THREE.MeshStandardMaterial({ color: LEAF, roughness: 0.9 }))
  const tTrunks = new THREE.InstancedMesh(treeTrunkGeo, trunkMat, trees.length)
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, trees.length)
  trees.forEach(([x, z], i) => {
    const h = 6 + rnd() * 5, cr = 4 + rnd() * 3.5
    const y = yAt(x, z)
    o.position.set(x, y + h / 2, z); o.rotation.set(0, 0, 0); o.scale.set(1, h, 1); o.updateMatrix()
    tTrunks.setMatrixAt(i, o.matrix)
    o.position.set(x, y + h + cr * 0.75, z); o.scale.set(cr, cr * 0.85, cr); o.updateMatrix()
    canopies.setMatrixAt(i, o.matrix)
  })
  tTrunks.castShadow = canopies.castShadow = true
  tTrunks.instanceMatrix.needsUpdate = canopies.instanceMatrix.needsUpdate = true
  group.add(tTrunks, canopies)

  // ── topiaria: esferas aparadas nas esquinas dos parterres e ao longo do anel ──
  const topi: [number, number][] = []
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2 + Math.PI / 48
    if (Math.abs(Math.sin(2 * a)) < 0.16) continue
    topi.push([Math.cos(a) * (R_GARDEN_IN + 38), Math.sin(a) * (R_GARDEN_IN + 38)])
  }
  const topiMesh = new THREE.InstancedMesh(canopyGeo, track(new THREE.MeshStandardMaterial({ color: HEDGE, roughness: 0.9 })), topi.length)
  topi.forEach(([x, z], i) => {
    const r = 1.6 + rnd() * 0.6
    o.position.set(x, yAt(x, z) + r, z); o.rotation.set(0, 0, 0); o.scale.setScalar(r); o.updateMatrix()
    topiMesh.setMatrixAt(i, o.matrix)
  })
  topiMesh.castShadow = true
  topiMesh.instanceMatrix.needsUpdate = true
  group.add(topiMesh)

  // ── bancos ao longo do anel, olhando para dentro ─────────────────────────
  const benchGeo = track(new THREE.BoxGeometry(4.2, 0.5, 1))
  const benchMat = track(new THREE.MeshStandardMaterial({ color: 0x2b2a2f, roughness: 0.6, metalness: 0.3 }))
  const benches = new THREE.InstancedMesh(benchGeo, benchMat, 40)
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 + Math.PI / 40
    const r = R_RING - RING_W / 2 + 3
    o.position.set(Math.cos(a) * r, yAt(Math.cos(a) * r, Math.sin(a) * r) + 0.6, Math.sin(a) * r); o.rotation.set(0, -a, 0); o.scale.setScalar(1); o.updateMatrix()
    benches.setMatrixAt(k, o.matrix)
  }
  benches.instanceMatrix.needsUpdate = true
  group.add(benches)

  // ── luz de jardim: uplights quentes na base das palmeiras das alamedas ───
  const glowTex = makeGlowTexture()
  const upPos = new Float32Array(palms.length * 3)
  palms.forEach(([x, z], i) => { upPos[i * 3] = x; upPos[i * 3 + 1] = yAt(x, z) + 1.2; upPos[i * 3 + 2] = z })
  const upGeo = track(new THREE.BufferGeometry())
  upGeo.setAttribute('position', new THREE.BufferAttribute(upPos, 3))
  const uplights = new THREE.Points(upGeo, track(new THREE.PointsMaterial({ map: glowTex, color: 0xffd9a8, size: 9, sizeAttenuation: true, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })))
  uplights.frustumCulled = false
  group.add(uplights)

  // ── a grande fonte do norte, no lugar da quarta âncora ───────────────────
  const fountain = buildGrandFountain(rnd, track, jetTex)
  const fy = yAt(0, -R_ANCHOR)
  fountain.group.position.set(0, fy, -R_ANCHOR)
  group.add(fountain.group)

  // luzes: poucas e quentes
  const lights: THREE.PointLight[] = []
  for (const [x, z] of [[0, -R_ANCHOR], [396, -396], [-396, -396], [396, 396], [-396, 396]] as const) {
    const l = new THREE.PointLight(0xffe0b8, 1.1, 300, 1.6)
    l.position.set(x, yAt(x, z) + 26, z)
    group.add(l)
    lights.push(l)
  }

  const update = (t: number) => {
    // fontes: cada partícula sobe e cai numa parábola, com fase própria
    for (const j of jets) {
      const seed = j.userData.seed as Float32Array
      const pa = j.geometry.attributes.position as THREE.BufferAttribute
      const n = pa.count
      for (let k = 0; k < n; k++) {
        const u = (t * 0.55 + seed[k * 2]) % 1
        const ring = k % 5 === 0 ? 0 : 1
        const ang = seed[k * 2 + 1] * Math.PI * 2
        const rr = ring === 0 ? 1.5 * u * 6 : 26 + u * 10
        const h = ring === 0 ? 46 * Math.sin(u * Math.PI) : 16 * Math.sin(u * Math.PI)
        pa.setXYZ(k, Math.cos(ang) * rr, h, Math.sin(ang) * rr)
      }
      pa.needsUpdate = true
    }
    fountain.update(t)
    for (const l of lights) l.intensity = 1.1 * (0.92 + 0.08 * Math.sin(t * 0.9 + l.position.x))
  }

  return {
    group,
    update,
    dispose() { for (const d of disposables) d.dispose(); jetTex.dispose(); glowTex.dispose(); fountain.dispose() },
  }
}

// ── peças ──────────────────────────────────────────────────────────────────────

/** Uma folha de tamareira: uma fita que sobe e se dobra para fora e para baixo,
 *  com cor mais forte na base e clara na ponta (vertex color). Escala 1 = 1 m. */
function makeFrondGeometry(): THREE.BufferGeometry {
  const SEG = 10
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const w0 = 0.09
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG
    // arco: sobe, dobra e cai
    const x = Math.sin(u * 1.35) * 0.9
    const y = 0.35 * Math.sin(u * Math.PI * 0.85) - u * u * 0.55
    const w = w0 * (1 - u * 0.7)
    pos.push(x, y, -w, x, y, w)
    const c = LEAF.clone().lerp(LEAF_TIP, u)
    col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    if (i < SEG) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
function makeDotTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

/** A grande fonte do norte: uma bacia larga com um jato central alto e um anel de
 *  jatos, coroada por um anel de palmeiras; o marco de palácio no ponto cardeal
 *  cuja âncora ainda não existe. */
function buildGrandFountain(rnd: () => number, track: <T extends { dispose: () => void }>(o: T) => T, jetTex: THREE.Texture) {
  const group = new THREE.Group()
  group.name = 'GrandFountain'
  const R = 70
  const basin = new THREE.Mesh(track(new THREE.CylinderGeometry(R, R + 1.5, 2.2, 96)), track(new THREE.MeshStandardMaterial({ color: 0x1b1a1e, roughness: 0.6, metalness: 0.2 })))
  basin.position.y = 1.1
  basin.receiveShadow = true
  group.add(basin)
  const water = new THREE.Mesh(track(new THREE.CircleGeometry(R - 2, 96)), track(new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.05, metalness: 0.7, emissive: 0x0b1a2c, emissiveIntensity: 0.4, envMapIntensity: 1.6 })))
  water.rotation.x = -Math.PI / 2
  water.position.y = 2.0
  group.add(water)
  const rim = new THREE.Mesh(track(new THREE.RingGeometry(R - 0.8, R, 128)), track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, transparent: true, opacity: 0.8, side: THREE.DoubleSide })))
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 2.25
  group.add(rim)
  // taça central em dois níveis
  for (const [r, y] of [[16, 8], [9, 15]] as const) {
    const cup = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r * 0.55, 1.6, 48)), basin.material as THREE.Material)
    cup.position.y = y
    group.add(cup)
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(2.2, 2.8, y - 2, 12)), basin.material as THREE.Material)
    stem.position.y = (y - 2) / 2 + 2
    group.add(stem)
  }
  // jatos: um central alto, um anel médio, um anel baixo na borda
  const NJ = 1600
  const pos = new Float32Array(NJ * 3)
  const seed = new Float32Array(NJ * 2)
  for (let k = 0; k < NJ; k++) { seed[k * 2] = rnd(); seed[k * 2 + 1] = rnd() }
  const geo = track(new THREE.BufferGeometry())
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pts = new THREE.Points(geo, track(new THREE.PointsMaterial({ map: jetTex, color: WATER_JET, size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })))
  pts.frustumCulled = false
  pts.position.y = 2
  group.add(pts)
  // anel de palmeiras em volta, no gramado
  const trunkGeo = track(new THREE.CylinderGeometry(0.42, 0.7, 1, 8))
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.85 }))
  const frondGeo = track(makeFrondGeometry())
  const frondMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }))
  const NPALM = 20, FR = 9
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, NPALM)
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, NPALM * FR)
  const o = new THREE.Object3D()
  for (let i = 0; i < NPALM; i++) {
    const a = (i / NPALM) * Math.PI * 2
    if (Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) > 0) continue // a boca do bulevar
    const x = Math.cos(a) * (R + 22), z = Math.sin(a) * (R + 22)
    const h = 15 + rnd() * 5
    o.position.set(x, h / 2, z); o.rotation.set(0, rnd() * 6, 0); o.scale.set(1, h, 1); o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
    for (let f = 0; f < FR; f++) {
      const fa = (f / FR) * Math.PI * 2 + rnd() * 0.3
      const len = h * 0.5
      o.position.set(x, h, z); o.rotation.set(0, fa, 0); o.scale.set(len, len, len); o.updateMatrix()
      fronds.setMatrixAt(i * FR + f, o.matrix)
    }
  }
  trunks.instanceMatrix.needsUpdate = fronds.instanceMatrix.needsUpdate = true
  trunks.castShadow = fronds.castShadow = true
  group.add(trunks, fronds)
  const light = new THREE.PointLight(0xffe4c0, 2.0, 360, 1.4)
  light.position.y = 24
  group.add(light)
  return {
    group,
    update(t: number) {
      const a = geo.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < NJ; k++) {
        const u = (t * 0.5 + seed[k * 2]) % 1
        const kind = k % 8 === 0 ? 0 : k % 8 < 4 ? 1 : 2
        const ang = seed[k * 2 + 1] * Math.PI * 2
        const rr = kind === 0 ? u * 5 : kind === 1 ? 16 + u * 14 : R - 6 - u * 10
        const h = kind === 0 ? 62 * Math.sin(u * Math.PI) : kind === 1 ? 24 * Math.sin(u * Math.PI) : 10 * Math.sin(u * Math.PI)
        a.setXYZ(k, Math.cos(ang) * rr, (kind === 0 ? 16 : kind === 1 ? 8 : 0) + h, Math.sin(ang) * rr)
      }
      a.needsUpdate = true
      light.intensity = 2.0 * (0.92 + 0.08 * Math.sin(t * 0.8))
    },
    dispose() {},
  }
}
