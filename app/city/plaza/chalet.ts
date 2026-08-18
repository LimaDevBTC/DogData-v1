// O Chalé do OrdCards: a âncora sul da praça (praca-central.md §4.2, D2 nova).
//
// Duas cartas colossais encostadas em "A", e as cartas são a carta OFICIAL do
// OrdCards da inscrição da logo (72d5cde4…i0, N° 127.106.002), fotografadas do
// componente real: a frente (forças, elemento, habilidade, DNA) olha para a praça
// pela escadaria monumental; o verso (QR "verify on-chain", DNA) olha para o
// spaceport. As cartas repousam sobre um pódio de vidro habitado, os lados do "A"
// ficam abertos com mezaninos por dentro, as arestas das cartas são de luz, e um
// passeio liga a porta ao fim do bulevar sul.
import * as THREE from 'three'

const CARD_RATIO = 88 / 63
const WARM = new THREE.Color('#FFB35C')
const ORANGE = new THREE.Color('#F7931A')

export interface Chalet {
  group: THREE.Group
  /** altura do ápice, para quem quiser mirar a câmera */
  apexY: number
  update: (t: number) => void
  dispose: () => void
}

export function buildChalet(front: THREE.Texture, back: THREE.Texture): Chalet {
  const group = new THREE.Group()
  group.name = 'OrdCardsChalet'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  const W = 172, H = W * CARD_RATIO // 240 m de carta
  const lean = 0.5 // 28,6° da vertical
  const apex = H * Math.cos(lean)
  const half = H * Math.sin(lean)
  const BASE_H = 26 // o pódio de vidro
  const CARD_T = 1.6

  // ── pódio: plinto de pedra, e o volume de vidro habitado ──────────────────
  const plinthR = Math.max(W, half * 2) * 0.62
  const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(plinthR, plinthR + 1.2, 1.4, 96)), track(new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.85 })))
  plinth.position.y = 0.7
  plinth.receiveShadow = true
  group.add(plinth)
  const plinthRing = new THREE.Mesh(track(new THREE.RingGeometry(plinthR - 0.9, plinthR - 0.1, 160)), track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, side: THREE.DoubleSide })))
  plinthRing.rotation.x = -Math.PI / 2
  plinthRing.position.y = 1.45
  group.add(plinthRing)

  const glassMat = track(new THREE.MeshPhysicalMaterial({
    color: 0x0f1a26, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.32,
    envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
  }))
  const baseW = W - 4, baseD = half * 2 - 4
  const glass = new THREE.Mesh(track(new THREE.BoxGeometry(baseW, BASE_H, baseD)), glassMat)
  glass.position.y = 1.4 + BASE_H / 2
  group.add(glass)
  // esquadrias do pódio: mullions verticais nas quatro faces
  const mullionMat = track(new THREE.MeshStandardMaterial({ color: 0x24252c, metalness: 0.75, roughness: 0.4 }))
  const mullionGeo = track(new THREE.BoxGeometry(0.7, BASE_H, 0.7))
  const nMx = Math.round(baseW / 9), nMz = Math.round(baseD / 9)
  const mullions = new THREE.InstancedMesh(mullionGeo, mullionMat, (nMx + nMz) * 2 + 4)
  const o = new THREE.Object3D()
  let mi = 0
  for (let i = 0; i <= nMx; i++) for (const s of [-1, 1]) { o.position.set(-baseW / 2 + (i * baseW) / nMx, 1.4 + BASE_H / 2, s * baseD / 2); o.updateMatrix(); mullions.setMatrixAt(mi++, o.matrix) }
  for (let i = 1; i < nMz; i++) for (const s of [-1, 1]) { o.position.set(s * baseW / 2, 1.4 + BASE_H / 2, -baseD / 2 + (i * baseD) / nMz); o.updateMatrix(); mullions.setMatrixAt(mi++, o.matrix) }
  mullions.count = mi
  mullions.instanceMatrix.needsUpdate = true
  group.add(mullions)
  // pisos por dentro do pódio (dois) e mezaninos dentro do A (três), quentes
  const floorMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.6, metalness: 0.2, emissive: WARM, emissiveIntensity: 0.12 }))
  const lightFloorMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.28, depthWrite: false }))
  const floorAt = (y: number, w: number, d: number, lit = true) => {
    const f = new THREE.Mesh(track(new THREE.BoxGeometry(w, 1.2, d)), floorMat)
    f.position.y = y
    f.receiveShadow = true
    group.add(f)
    if (lit) {
      const l = new THREE.Mesh(track(new THREE.PlaneGeometry(w - 2, d - 2)), lightFloorMat)
      l.rotation.x = -Math.PI / 2
      l.position.y = y + 0.7
      group.add(l)
    }
  }
  floorAt(1.4 + 0.6, baseW - 2, baseD - 2)
  floorAt(1.4 + BASE_H / 2, baseW - 4, baseD - 4)
  const cardBase = 1.4 + BASE_H // as cartas nascem no topo do pódio
  for (const k of [0.16, 0.34, 0.52]) {
    const y = cardBase + apex * k
    const d = 2 * half * (1 - k) - 6
    if (d > 20) floorAt(y, W - 10, d)
  }
  // o "chão" do A no topo do pódio: laje clara
  floorAt(cardBase - 0.6, baseW, baseD, false)

  // ── as duas cartas ────────────────────────────────────────────────────────
  const cardMat = (map: THREE.Texture) =>
    track(new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.06, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.5 }))
  const innerMat = track(new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.55, metalness: 0.25 }))
  const cardGeo = track(new THREE.PlaneGeometry(W, H))
  const edgeMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const edgeGeoH = track(new THREE.BoxGeometry(W + 0.4, 0.9, CARD_T + 0.6))
  const edgeGeoV = track(new THREE.BoxGeometry(0.9, H + 0.4, CARD_T + 0.6))
  const mk = (map: THREE.Texture, sign: number) => {
    const g = new THREE.Group()
    const outer = new THREE.Mesh(cardGeo, cardMat(map))
    outer.position.z = CARD_T / 2
    const inner = new THREE.Mesh(cardGeo, innerMat)
    inner.rotation.y = Math.PI
    inner.position.z = -CARD_T / 2
    outer.castShadow = outer.receiveShadow = true
    inner.receiveShadow = true
    g.add(outer, inner)
    // arestas de luz: o perímetro da carta
    for (const [gy, py] of [[edgeGeoH, H / 2], [edgeGeoH, -H / 2]] as const) { const e = new THREE.Mesh(gy, edgeMat); e.position.y = py; g.add(e) }
    for (const px of [-W / 2, W / 2]) { const e = new THREE.Mesh(edgeGeoV, edgeMat); e.position.x = px; g.add(e) }
    // pivota na base sobre o pódio: base em z = sign·half, topo no ápice
    g.position.set(0, cardBase + apex / 2, sign * half / 2)
    g.rotation.set(-lean, sign > 0 ? 0 : Math.PI, 0, 'YXZ')
    return g
  }
  group.add(mk(front, -1), mk(back, 1))

  // ── luz ──────────────────────────────────────────────────────────────────
  const lights: THREE.PointLight[] = []
  const addLight = (x: number, y: number, z: number, i: number, c: THREE.Color | number = WARM, dist = 380) => {
    const l = new THREE.PointLight(c, i, dist, 1.35)
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
  }
  addLight(-W * 0.28, cardBase + apex * 0.3, 0, 2.2)
  addLight(W * 0.28, cardBase + apex * 0.3, 0, 2.2)
  addLight(0, cardBase + apex * 0.6, 0, 1.6)
  addLight(0, 1.4 + BASE_H * 0.5, 0, 1.4)
  // focos brancos de fora, para as faces lerem de longe
  for (const [x, z] of [[-W * 0.35, -half - 100], [W * 0.35, -half - 100], [-W * 0.35, half + 100], [W * 0.35, half + 100]]) addLight(x, 36, z, 1.5, 0xfff4e6, 460)

  // ── a porta e o passeio para o bulevar sul (norte do chalé) ──────────────
  const walkMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 }))
  const walk = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 150)), walkMat)
  walk.rotation.x = -Math.PI / 2
  walk.position.set(0, 0.36, -plinthR - 60)
  walk.receiveShadow = true
  group.add(walk)
  const walkLineMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.6 }))
  for (const sx of [-1, 1]) {
    const ln = new THREE.Mesh(track(new THREE.PlaneGeometry(0.6, 150)), walkLineMat)
    ln.rotation.x = -Math.PI / 2
    ln.position.set(sx * 15, 0.42, -plinthR - 60)
    group.add(ln)
  }
  // portal de entrada: um pórtico baixo com o glifo
  const portal = new THREE.Mesh(track(new THREE.BoxGeometry(34, 12, 4)), track(new THREE.MeshStandardMaterial({ color: 0x0f0f13, roughness: 0.4, metalness: 0.6, emissive: WARM, emissiveIntensity: 0.15 })))
  portal.position.set(0, 7.4, -baseD / 2 - 6)
  group.add(portal)

  // ── a marca girando sobre o ápice ────────────────────────────────────────
  const glyph = new THREE.Group()
  glyph.add(new THREE.Mesh(track(new THREE.TorusGeometry(10, 1.2, 8, 48)), track(new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))))
  glyph.add(new THREE.Mesh(track(new THREE.SphereGeometry(4, 24, 16)), track(new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))))
  glyph.position.set(0, cardBase + apex + 30, 0)
  group.add(glyph)
  const beacon = new THREE.PointLight(ORANGE, 0.8, 200, 1.5)
  beacon.position.copy(glyph.position)
  group.add(beacon)

  return {
    group,
    apexY: cardBase + apex,
    update(t) {
      glyph.rotation.y = t * 0.3
      glyph.position.y = cardBase + apex + 30 + Math.sin(t * 0.8) * 2
      for (const l of lights) l.intensity = (l.userData.base ??= l.intensity) * (0.92 + 0.08 * Math.sin(t * 1.1 + l.position.x * 0.02))
    },
    dispose() { for (const d of disposables) d.dispose() },
  }
}
