// O precinto da praça: o que costura o deck às quatro âncoras (praca-central.md §4.2,
// D7 e D8). Um círculo central (o deck, r 300), um cinturão de jardim, um bulevar
// anelar em r 450 ligando as quatro portas, quatro bulevares radiais nos eixos
// cardeais, e as âncoras em r 620: BitFlow a oeste, Kray a leste, o Chalé ao sul, e
// ao norte, enquanto a quarta âncora não existe, a Árvore-Mãe e o jardim.
//
// O jardim é lunar e vivo do jeito que o fundador pediu ("lembra Avatar? aquela
// flora estonteante"): tamareiras de luz, cogumelos-lanterna, musgo que brilha,
// esporos flutuando, espelhos d'água com fontes. Tudo instanciado e semeado por
// um gerador determinístico, para a praça ser a mesma em toda visita.
//
// Paleta: a arquitetura é quente (laranja DOG); a flora é fria (ciano, violeta,
// magenta), para o jardim emoldurar as torres em vez de competir com elas.
import * as THREE from 'three'

export const R_DECK = 300
export const R_GARDEN_IN = 332
export const R_RING = 452
export const RING_W = 34
export const R_ANCHOR = 620
export const BOULEVARD_W = 42

/** Onde cada âncora fica e para onde olha (rotação em y). Frentes voltadas para o centro. */
export const ANCHORS = {
  west: { pos: new THREE.Vector3(-R_ANCHOR, 0, 0), rotY: Math.PI / 2 },   // BitFlow, frente para +x
  east: { pos: new THREE.Vector3(R_ANCHOR, 0, 0), rotY: -Math.PI / 2 },   // Kray, frente para −x
  south: { pos: new THREE.Vector3(0, 0, R_ANCHOR), rotY: 0 },              // Chalé, frente para −z
  north: { pos: new THREE.Vector3(0, 0, -R_ANCHOR), rotY: Math.PI },      // jardim, por enquanto
} as const

const CYAN = new THREE.Color('#4FE3E8')
const VIOLET = new THREE.Color('#9B6BFF')
const MAGENTA = new THREE.Color('#FF5CC8')
const ICE = new THREE.Color('#DDEBFF')
const WARM = new THREE.Color('#FFB35C')

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

  // ── postes: esferas de luz fria em hastes finas, ao longo dos bulevares ────
  const lampCount = 4 * 12 * 2 + 64
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
  poles.count = bulbs.count = li
  poles.instanceMatrix.needsUpdate = bulbs.instanceMatrix.needsUpdate = true
  group.add(poles, bulbs)

  // ── espelhos d'água com fontes, nas diagonais entre as âncoras ───────────
  const poolMat = track(new THREE.MeshStandardMaterial({ color: 0x08111c, roughness: 0.05, metalness: 0.7, emissive: 0x0a1a2c, emissiveIntensity: 0.5, envMapIntensity: 1.6 }))
  const poolRimMat = track(new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false, transparent: true, opacity: 0.7 }))
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
    const pm = track(new THREE.PointsMaterial({ map: jetTex, color: 0xcfe9ff, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }))
    const pts = new THREE.Points(geo, pm)
    pts.position.set(cx, y + 0.3, cz)
    pts.userData.seed = seed
    pts.frustumCulled = false
    group.add(pts)
    jets.push(pts)
    track(geo)
  }

  // ── a flora ───────────────────────────────────────────────────────────────
  // onde pode nascer: cinturão 332..440 (fora dos radiais e do anel), e setores
  // 480..900 fora dos sítios das âncoras e dos bulevares
  const canGrow = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    if (r < R_GARDEN_IN || r > 920) return false
    if (inRing(x, z) || inRadialBoulevard(x, z) || inAnchorSite(x, z)) return false
    // os espelhos d'água
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2
      if (Math.hypot(x - Math.cos(a) * 560, z - Math.sin(a) * 560) < 56) return false
    }
    // a árvore-mãe ao norte pede espaço
    if (Math.hypot(x, z + R_ANCHOR) < 90) return false
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

  // tamareiras de luz: tronco + coroa de folhas arqueadas com gradiente emissivo
  const trees = [...sample(150, R_GARDEN_IN, 440), ...sample(210, 470, 920)]
  // fileiras nos bulevares radiais e no anel: a alameda
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (let k = 0; k < 9; k++) {
      const r = R_GARDEN_IN + 14 + k * 17
      for (const s of [-1, 1]) {
        const off = s * (BOULEVARD_W / 2 + 12)
        trees.push([Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off])
      }
    }
  }
  const trunkGeo = track(new THREE.CylinderGeometry(0.55, 1.4, 1, 7))
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.7, metalness: 0.2 }))
  const frondGeo = track(makeFrondGeometry())
  const frondMat = track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }))
  const FRONDS = 8
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length)
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, trees.length * FRONDS)
  const treeMeta: { x: number; z: number; h: number; hue: number }[] = []
  trees.forEach(([x, z], i) => {
    const h = 16 + rnd() * 18
    const y = yAt(x, z)
    o.position.set(x, y + h / 2, z); o.rotation.set(0, rnd() * 6.28, 0); o.scale.set(1, h, 1); o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
    const hue = rnd()
    treeMeta.push({ x, z, h, hue })
    for (let f = 0; f < FRONDS; f++) {
      const a = (f / FRONDS) * Math.PI * 2 + rnd() * 0.3
      const len = h * (0.55 + rnd() * 0.25)
      o.position.set(x, y + h, z)
      o.rotation.set(0, a, 0)
      o.scale.set(len, len, len)
      o.updateMatrix()
      fronds.setMatrixAt(i * FRONDS + f, o.matrix)
    }
  })
  trunks.castShadow = true
  trunks.instanceMatrix.needsUpdate = true
  fronds.instanceMatrix.needsUpdate = true
  group.add(trunks, fronds)
  // a cor por árvore: ciano, violeta ou magenta, com um brilho na base da coroa
  const frondColors = new Float32Array(trees.length * FRONDS * 3)
  treeMeta.forEach((m, i) => {
    const c = m.hue < 0.5 ? CYAN : m.hue < 0.82 ? VIOLET : MAGENTA
    for (let f = 0; f < FRONDS; f++) {
      const k = (i * FRONDS + f) * 3
      frondColors[k] = c.r; frondColors[k + 1] = c.g; frondColors[k + 2] = c.b
    }
  })
  frondGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(frondColors, 3))
  frondMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aTint;\nvarying vec3 vTint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = aTint;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vTint, opacity );')
  }
  frondMat.customProgramCacheKey = () => 'frond-tint'
  // o halo da coroa
  const haloTex = makeGlowTexture()
  const haloGeo = track(new THREE.BufferGeometry())
  const haloPos = new Float32Array(trees.length * 3)
  const haloCol = new Float32Array(trees.length * 3)
  treeMeta.forEach((m, i) => {
    haloPos[i * 3] = m.x; haloPos[i * 3 + 1] = yAt(m.x, m.z) + m.h * 1.05; haloPos[i * 3 + 2] = m.z
    const c = m.hue < 0.5 ? CYAN : m.hue < 0.82 ? VIOLET : MAGENTA
    haloCol[i * 3] = c.r; haloCol[i * 3 + 1] = c.g; haloCol[i * 3 + 2] = c.b
  })
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3))
  haloGeo.setAttribute('color', new THREE.BufferAttribute(haloCol, 3))
  const halos = new THREE.Points(haloGeo, track(new THREE.PointsMaterial({ map: haloTex, vertexColors: true, size: 30, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })))
  halos.frustumCulled = false
  group.add(halos)

  // cogumelos-lanterna: chapéu com a face de baixo acesa
  const shrooms = [...sample(90, R_GARDEN_IN, 440), ...sample(160, 470, 920)]
  const capGeo = track(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2))
  const stemGeo = track(new THREE.CylinderGeometry(0.28, 0.42, 1, 7))
  const capMat = track(new THREE.MeshStandardMaterial({ color: 0x1c1a26, roughness: 0.4, metalness: 0.1, emissive: VIOLET, emissiveIntensity: 0.25 }))
  const gillMat = track(new THREE.MeshBasicMaterial({ color: MAGENTA, toneMapped: false, transparent: true, opacity: 0.85, side: THREE.BackSide }))
  const caps = new THREE.InstancedMesh(capGeo, capMat, shrooms.length)
  const gills = new THREE.InstancedMesh(capGeo, gillMat, shrooms.length)
  const stems = new THREE.InstancedMesh(stemGeo, track(new THREE.MeshStandardMaterial({ color: 0x2a2836, roughness: 0.6 })), shrooms.length)
  shrooms.forEach(([x, z], i) => {
    const s = 3.5 + rnd() * 7
    const y = yAt(x, z)
    o.position.set(x, y + s * 0.9, z); o.rotation.set(0, rnd() * 6, 0); o.scale.set(s, s * 0.55, s); o.updateMatrix()
    caps.setMatrixAt(i, o.matrix)
    o.scale.set(s * 0.98, s * 0.53, s * 0.98); o.updateMatrix()
    gills.setMatrixAt(i, o.matrix)
    o.position.set(x, y + s * 0.45, z); o.scale.set(s * 0.32, s * 0.9, s * 0.32); o.updateMatrix()
    stems.setMatrixAt(i, o.matrix)
  })
  caps.castShadow = true
  caps.instanceMatrix.needsUpdate = gills.instanceMatrix.needsUpdate = stems.instanceMatrix.needsUpdate = true
  group.add(caps, gills, stems)

  // musgo que brilha: discos de luz no chão
  const moss = [...sample(260, R_GARDEN_IN, 440), ...sample(520, 470, 920)]
  const mossGeo = track(new THREE.CircleGeometry(1, 12))
  const mossMat = track(new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }))
  const mossMesh = new THREE.InstancedMesh(mossGeo, mossMat, moss.length)
  moss.forEach(([x, z], i) => {
    const s = 2 + rnd() * 7
    o.position.set(x, yAt(x, z) + 0.15, z); o.rotation.set(-Math.PI / 2, 0, rnd() * 6); o.scale.set(s, s * (0.6 + rnd() * 0.5), 1); o.updateMatrix()
    mossMesh.setMatrixAt(i, o.matrix)
  })
  mossMesh.instanceMatrix.needsUpdate = true
  group.add(mossMesh)

  // esporos: pontos que flutuam devagar sobre os jardins
  const NS = 2600
  const sporePos = new Float32Array(NS * 3)
  const sporeSeed = new Float32Array(NS * 3)
  const sporeSpots = [...sample(NS / 3, R_GARDEN_IN, 440, 12), ...sample((NS * 2) / 3, 470, 920, 12)]
  for (let i = 0; i < NS; i++) {
    const [x, z] = sporeSpots[i % sporeSpots.length]
    sporeSeed[i * 3] = x + (rnd() - 0.5) * 30
    sporeSeed[i * 3 + 1] = yAt(x, z) + 2 + rnd() * 26
    sporeSeed[i * 3 + 2] = z + (rnd() - 0.5) * 30
  }
  const sporeGeo = track(new THREE.BufferGeometry())
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePos, 3))
  const spores = new THREE.Points(sporeGeo, track(new THREE.PointsMaterial({ map: haloTex, color: 0xbfe8ff, size: 4.2, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })))
  spores.frustumCulled = false
  group.add(spores)

  // ── a Árvore-Mãe, no ponto norte, enquanto a quarta âncora não existe ─────
  const mother = buildMotherTree(rnd, track)
  const my = yAt(0, -R_ANCHOR)
  mother.group.position.set(0, my, -R_ANCHOR)
  group.add(mother.group)
  // seu próprio pódio de luz
  const mPlinth = new THREE.Mesh(track(new THREE.CylinderGeometry(96, 98, 1.2, 96)), track(new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.8 })))
  mPlinth.position.set(0, my + 0.6, -R_ANCHOR)
  mPlinth.receiveShadow = true
  group.add(mPlinth)
  const mRing = new THREE.Mesh(track(new THREE.RingGeometry(95, 96, 128)), track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })))
  mRing.rotation.x = -Math.PI / 2
  mRing.position.set(0, my + 1.25, -R_ANCHOR)
  group.add(mRing)

  // luzes: poucas e grandes; a flora é emissiva por si
  const lights: THREE.PointLight[] = []
  for (const [x, z, c] of [[0, -R_ANCHOR, 0xbfe6ff], [396, -396, 0x6fe0e8], [-396, -396, 0x9b6bff], [396, 396, 0xff7ad0], [-396, 396, 0x6fe0e8]] as const) {
    const l = new THREE.PointLight(c, 1.4, 320, 1.6)
    l.position.set(x, yAt(x, z) + 30, z)
    group.add(l)
    lights.push(l)
  }

  const update = (t: number) => {
    // esporos: deriva lenta em três eixos
    const p = sporeGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < NS; i++) {
      const sx = sporeSeed[i * 3], sy = sporeSeed[i * 3 + 1], sz = sporeSeed[i * 3 + 2]
      p.setXYZ(i, sx + Math.sin(t * 0.13 + i) * 4, sy + Math.sin(t * 0.21 + i * 0.7) * 3, sz + Math.cos(t * 0.11 + i * 1.3) * 4)
    }
    p.needsUpdate = true
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
    mother.update(t)
    frondMat.opacity = 0.86 + 0.06 * Math.sin(t * 0.7)
    for (const l of lights) l.intensity = 1.4 * (0.9 + 0.1 * Math.sin(t * 0.9 + l.position.x))
  }

  return {
    group,
    update,
    dispose() { for (const d of disposables) d.dispose(); jetTex.dispose(); haloTex.dispose(); mother.dispose() },
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
    const b = 1 - u * 0.75
    col.push(b, b, b, b, b, b)
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

/** A Árvore-Mãe: um tronco largo, uma copa larga e milhares de fios de luz caindo
 *  dela, como um salgueiro aceso. É o marco do ponto norte até a âncora chegar. */
function buildMotherTree(rnd: () => number, track: <T extends { dispose: () => void }>(o: T) => T) {
  const group = new THREE.Group()
  group.name = 'MotherTree'
  const H = 150
  // tronco: uma lofted cylinder com base alargada
  const trunk = new THREE.Mesh(track(new THREE.CylinderGeometry(9, 26, H * 0.62, 12, 1)), track(new THREE.MeshStandardMaterial({ color: 0x1a1720, roughness: 0.6, metalness: 0.2, emissive: 0x2a2140, emissiveIntensity: 0.4 })))
  trunk.position.y = H * 0.31
  trunk.castShadow = true
  group.add(trunk)
  // raízes: oito arcos baixos
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const r = new THREE.Mesh(track(new THREE.CylinderGeometry(3, 6, 60, 8)), trunk.material as THREE.Material)
    r.position.set(Math.cos(a) * 34, 12, Math.sin(a) * 34)
    r.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9)
    r.rotation.z = -Math.sin(a) * 0.95
    r.rotation.x = Math.cos(a) * 0.95
    group.add(r)
  }
  // copa: um disco largo de onde os fios caem
  const crownY = H * 0.62
  const crown = new THREE.Mesh(track(new THREE.SphereGeometry(58, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), track(new THREE.MeshStandardMaterial({ color: 0x1b1a2e, roughness: 0.5, emissive: 0x3a2f6a, emissiveIntensity: 0.5, side: THREE.DoubleSide })))
  crown.position.y = crownY
  group.add(crown)
  // os fios: linhas verticais com brilho decrescente, penduradas da borda da copa
  const NW = 1400
  const pos = new Float32Array(NW * 2 * 3)
  const col = new Float32Array(NW * 2 * 3)
  const seeds = new Float32Array(NW)
  for (let i = 0; i < NW; i++) {
    const a = rnd() * Math.PI * 2
    const rr = 12 + Math.sqrt(rnd()) * 56
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr
    const top = crownY + 4 - (rr / 58) * 26
    const len = 30 + rnd() * (top - 12)
    pos.set([x, top, z, x, top - len, z], i * 6)
    const c = rnd() < 0.7 ? ICE : rnd() < 0.5 ? CYAN : VIOLET
    col.set([c.r, c.g, c.b, c.r * 0.15, c.g * 0.15, c.b * 0.15], i * 6)
    seeds[i] = rnd()
  }
  const wg = track(new THREE.BufferGeometry())
  wg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  wg.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const wires = new THREE.LineSegments(wg, track(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })))
  wires.frustumCulled = false
  group.add(wires)
  // partículas subindo pelo tronco (sementes de luz)
  const NP = 500
  const pp = new Float32Array(NP * 3)
  const ps = new Float32Array(NP * 2)
  for (let i = 0; i < NP; i++) { ps[i * 2] = rnd(); ps[i * 2 + 1] = rnd() }
  const pg = track(new THREE.BufferGeometry())
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3))
  const glowTex = makeGlowTexture()
  const seedsPts = new THREE.Points(pg, track(new THREE.PointsMaterial({ map: glowTex, color: 0xdff4ff, size: 5, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })))
  seedsPts.frustumCulled = false
  group.add(seedsPts)
  const light = new THREE.PointLight(0xcfe6ff, 2.2, 420, 1.4)
  light.position.y = crownY - 10
  group.add(light)
  return {
    group,
    update(t: number) {
      const a = pg.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < NP; i++) {
        const u = (t * 0.06 + ps[i * 2]) % 1
        const ang = ps[i * 2 + 1] * Math.PI * 2 + t * 0.2
        const rr = 12 + (1 - u) * 50
        a.setXYZ(i, Math.cos(ang) * rr * (0.4 + 0.6 * u), 6 + u * (crownY + 30), Math.sin(ang) * rr * (0.4 + 0.6 * u))
      }
      a.needsUpdate = true
      light.intensity = 2.2 * (0.9 + 0.1 * Math.sin(t * 0.8))
      ;(wires.material as THREE.LineBasicMaterial).opacity = 0.65 + 0.12 * Math.sin(t * 0.5)
    },
    dispose() { glowTex.dispose() },
  }
}
