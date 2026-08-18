// Três protótipos para o prédio do OrdCards no sítio ao sul do deck
// (praca-central.md §2, D2 revogado). Atrás de `?proto=hand|tally|shuffle`: sem
// o parâmetro nada disto entra na cena, então produção não muda enquanto o
// fundador escolhe olhando.
//
//   hand     A Mão: cinco cartas colossais em leque, plantadas como velas.
//   tally    A Torre da Tally: mil cartas empilhadas, cada uma girada um grau em
//            relação à de baixo, uma torre torcida de 300 m; o supply da coleção.
//   shuffle  A Fonte do Embaralhar: cartas subindo numa hélice e descendo noutra,
//            um embaralhar eterno em câmera lenta sobre um pavilhão.
//   chalet   O Chalé: duas cartas colossais encostadas em "A", e as cartas são a
//            carta OFICIAL do OrdCards com a logo do projeto como arte, capturada
//            do componente real (public/city/cards/logo-front.png e logo-back.png:
//            frente com forças, elemento, habilidade e DNA; verso com QR code e
//            DNA). A frente olha para a praça, o verso para o spaceport.
//
// As cartas são as do endereço Gênesis (public/city/cards/cards.jpg, 6×4) e o
// verso é a marca. Mesma técnica do castelo: duas InstancedMesh (frentes e versos)
// com a célula do atlas por instância.
import * as THREE from 'three'

const CARD_RATIO = 88 / 63
const COLS = 6, ROWS = 4
const WARM = new THREE.Color('#FFB35C')
const ORANGE = new THREE.Color('#F7931A')

export type ProtoKind = 'hand' | 'tally' | 'shuffle' | 'chalet'

export interface Proto {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

interface CardSet {
  fronts: THREE.InstancedMesh
  backs: THREE.InstancedMesh
  set: (i: number, pos: THREE.Vector3, quat: THREE.Quaternion, w: number, h: number, thick: number, frontOut: boolean, cell: number) => void
  commit: () => void
  dispose: () => void
}

/** Um jogo de N cartas instanciadas, frente e verso, com célula do atlas por carta. */
function makeCardSet(n: number, atlas: THREE.Texture, back: THREE.Texture, opts?: { emissive?: number }): CardSet {
  const geoF = new THREE.PlaneGeometry(1, 1)
  const geoB = new THREE.PlaneGeometry(1, 1)
  const uv = new Float32Array(n * 2)
  geoF.setAttribute('aUvOff', new THREE.InstancedBufferAttribute(uv, 2))
  const frontMat = new THREE.MeshStandardMaterial({
    map: atlas, roughness: 0.5, metalness: 0.05,
    emissive: opts?.emissive ? 0xffffff : 0x000000, emissiveMap: opts?.emissive ? atlas : null, emissiveIntensity: opts?.emissive ?? 0,
  })
  frontMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCell = { value: new THREE.Vector2(1 / COLS, 1 / ROWS) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUvOff;\nuniform vec2 uCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = vMapUv * uCell + aUvOff;\n#endif\n#ifdef USE_EMISSIVEMAP\n  vEmissiveMapUv = vEmissiveMapUv * uCell + aUvOff;\n#endif')
  }
  frontMat.customProgramCacheKey = () => `card-atlas-${opts?.emissive ?? 0}`
  const backMat = new THREE.MeshStandardMaterial({ map: back, roughness: 0.6, metalness: 0.05 })
  const fronts = new THREE.InstancedMesh(geoF, frontMat, n)
  const backs = new THREE.InstancedMesh(geoB, backMat, n)
  fronts.castShadow = backs.castShadow = true
  fronts.receiveShadow = backs.receiveShadow = true
  const o = new THREE.Object3D()
  const nrm = new THREE.Vector3()
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
  return {
    fronts, backs,
    set(i, pos, quat, w, h, thick, frontOut, cell) {
      nrm.set(0, 0, 1).applyQuaternion(quat)
      o.position.copy(pos).addScaledVector(nrm, thick / 2)
      o.quaternion.copy(quat)
      o.scale.set(w, h, 1)
      o.updateMatrix()
      const outer = o.matrix.clone()
      o.position.copy(pos).addScaledVector(nrm, -thick / 2)
      o.quaternion.copy(quat).multiply(flip)
      o.updateMatrix()
      const inner = o.matrix.clone()
      if (frontOut) { fronts.setMatrixAt(i, outer); backs.setMatrixAt(i, inner) }
      else { fronts.setMatrixAt(i, inner); backs.setMatrixAt(i, outer) }
      const col = cell % COLS, row = Math.floor(cell / COLS)
      uv[i * 2] = col / COLS
      uv[i * 2 + 1] = 1 - (row + 1) / ROWS
    },
    commit() {
      fronts.instanceMatrix.needsUpdate = true
      backs.instanceMatrix.needsUpdate = true
      ;(geoF.getAttribute('aUvOff') as THREE.InstancedBufferAttribute).needsUpdate = true
    },
    dispose() { geoF.dispose(); geoB.dispose(); frontMat.dispose(); backMat.dispose() },
  }
}

function plinth(group: THREE.Group, r: number, ringColor = WARM) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 1, 1.4, 96), new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.85 }))
  base.position.y = 0.7
  base.receiveShadow = true
  group.add(base)
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.9, r - 0.1, 160), new THREE.MeshBasicMaterial({ color: ringColor, toneMapped: false, side: THREE.DoubleSide }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 1.45
  group.add(ring)
}

// ── 1. A Mão ─────────────────────────────────────────────────────────────────
function buildHand(atlas: THREE.Texture, back: THREE.Texture): Proto {
  const group = new THREE.Group()
  group.name = 'Proto:Hand'
  const W = 150, H = W * CARD_RATIO // 209 m
  const cards = makeCardSet(5, atlas, back, { emissive: 0.35 })
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler()
  const cells = [0, 7, 14, 21, 3]
  for (let i = 0; i < 5; i++) {
    const roll = (i - 2) * 0.24 // leque: ±27°
    // a carta pivota no canto de baixo: o centro sobe e desloca com o roll
    const cx = Math.sin(roll) * H * 0.5 * -1
    const cy = 1.4 + Math.cos(roll) * H * 0.5
    pos.set(cx, cy, (i - 2) * 6)
    e.set(-0.1, Math.PI, roll, 'YXZ') // de frente para o norte (−z), levemente para trás
    q.setFromEuler(e)
    cards.set(i, pos, q, W, H, 1.2, true, cells[i])
  }
  cards.commit()
  group.add(cards.fronts, cards.backs)
  plinth(group, 120)
  // luz de baixo, três focos quentes nas faces
  const lights: THREE.PointLight[] = []
  for (const x of [-70, 0, 70]) {
    const l = new THREE.PointLight(WARM, 2.4, 420, 1.4)
    l.position.set(x, 30, -60)
    group.add(l); lights.push(l)
  }
  // o glifo, no ar, entre as cartas: anel e ponto
  const glyph = new THREE.Group()
  const ringG = new THREE.Mesh(new THREE.TorusGeometry(14, 1.6, 8, 48), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))
  const dot = new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 16), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))
  glyph.add(ringG, dot)
  glyph.position.set(0, H + 40, 0)
  group.add(glyph)
  return {
    group,
    update(t) { glyph.rotation.y = t * 0.3; glyph.position.y = H + 40 + Math.sin(t * 0.8) * 3 },
    dispose() { cards.dispose(); group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m !== cards.fronts && m !== cards.backs) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.() } }) },
  }
}

// ── 2. A Torre da Tally ──────────────────────────────────────────────────────
function buildTally(atlas: THREE.Texture, back: THREE.Texture): Proto {
  const group = new THREE.Group()
  group.name = 'Proto:Tally'
  const N = 1000
  const W = 64, D = W * CARD_RATIO, STEP = 0.31 // 1000 × 0,31 = 310 m
  const slabGeo = new THREE.BoxGeometry(W, STEP * 0.7, D)
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 0.35, metalness: 0.75 })
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, N)
  slabs.castShadow = true
  slabs.receiveShadow = true
  // a borda acesa: uma placa um pouco maior e mais fina, cujas faces laterais
  // saem 0,25 m para fora da laje e riscam a torre de linhas quentes
  const rimGeo = new THREE.BoxGeometry(W + 0.5, STEP * 0.18, D + 0.5)
  const rimMat = new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false })
  const rims = new THREE.InstancedMesh(rimGeo, rimMat, Math.ceil(N / 5))
  const o = new THREE.Object3D()
  let ri = 0
  for (let i = 0; i < N; i++) {
    o.position.set(0, 1.4 + i * STEP + STEP / 2, 0)
    o.rotation.set(0, (i / N) * Math.PI * 2 * 0.75, 0) // três quartos de volta ao longo da altura
    o.updateMatrix()
    slabs.setMatrixAt(i, o.matrix)
    if (i % 5 === 0) { rims.setMatrixAt(ri++, o.matrix) }
  }
  slabs.instanceMatrix.needsUpdate = true
  rims.instanceMatrix.needsUpdate = true
  group.add(slabs, rims)
  // a carta do topo: uma carta do Gênesis de frente, virada para o céu, e o glifo
  const top = makeCardSet(1, atlas, back, { emissive: 0.6 })
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (Math.PI * 2 * 0.75), 'YXZ'))
  top.set(0, new THREE.Vector3(0, 1.4 + N * STEP + 0.6, 0), q, W, D, 0.4, true, 7)
  top.commit()
  group.add(top.fronts, top.backs)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))
  beacon.position.set(0, 1.4 + N * STEP + 24, 0)
  group.add(beacon)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 24, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.4 }))
  mast.position.set(0, 1.4 + N * STEP + 12, 0)
  group.add(mast)
  plinth(group, 70)
  const l = new THREE.PointLight(WARM, 1.6, 300, 1.4)
  l.position.set(0, 60, 0)
  group.add(l)
  return {
    group,
    update(t) { const k = 0.85 + 0.15 * Math.sin(t * 1.2); rimMat.color.copy(WARM).multiplyScalar(k); beacon.scale.setScalar(1 + 0.15 * Math.sin(t * 2)) },
    dispose() { slabGeo.dispose(); slabMat.dispose(); rimGeo.dispose(); rimMat.dispose(); top.dispose() },
  }
}

// ── 3. A Fonte do Embaralhar ─────────────────────────────────────────────────
function buildShuffle(atlas: THREE.Texture, back: THREE.Texture): Proto {
  const group = new THREE.Group()
  group.name = 'Proto:Shuffle'
  const N = 320
  const W = 9, H = W * CARD_RATIO
  const TOP = 170
  const cards = makeCardSet(N, atlas, back, { emissive: 0.25 })
  const phase = new Float32Array(N), stream = new Uint8Array(N), spin = new Float32Array(N), cell = new Uint16Array(N)
  for (let i = 0; i < N; i++) {
    phase[i] = i / N
    stream[i] = i % 2
    spin[i] = 0.4 + ((i * 37) % 17) / 17
    cell[i] = (i * 7) % (COLS * ROWS)
  }
  // o pavilhão: dais, doze colunas esguias e um anel de luz no alto
  plinth(group, 60)
  const colGeo = new THREE.CylinderGeometry(0.9, 1.1, 40, 10)
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1b1b21, roughness: 0.4, metalness: 0.7 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const c = new THREE.Mesh(colGeo, colMat)
    c.position.set(Math.cos(a) * 42, 21.4, Math.sin(a) * 42)
    c.castShadow = true
    group.add(c)
  }
  const canopy = new THREE.Mesh(new THREE.TorusGeometry(42, 1.4, 8, 96), new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  canopy.rotation.x = Math.PI / 2
  canopy.position.y = 41.6
  group.add(canopy)
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 4, 48), new THREE.MeshStandardMaterial({ color: 0x0f0f13, roughness: 0.3, metalness: 0.6 }))
  dais.position.y = 3.4
  group.add(dais)
  const core = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, TOP, 16, 1, true), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }))
  core.position.y = 5 + TOP / 2
  group.add(core)
  const l = new THREE.PointLight(WARM, 2.0, 260, 1.4)
  l.position.set(0, 30, 0)
  group.add(l)
  group.add(cards.fronts, cards.backs)

  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler()
  const T = 26 // segundos por volta completa (subir e descer)
  const update = (t: number) => {
    for (let i = 0; i < N; i++) {
      const u = (t / T + phase[i]) % 1
      const up = stream[i] === 0
      // sobe pelo miolo em espiral apertada; desce por fora numa espiral larga
      const y = up ? 5 + u * TOP : 5 + (1 - u) * TOP
      const r = up ? 8 + 6 * Math.sin(u * Math.PI) : 30 + 14 * Math.sin(u * Math.PI)
      const a = (up ? 1 : -1) * (u * Math.PI * 4 + phase[i] * Math.PI * 2)
      pos.set(Math.cos(a) * r, y, Math.sin(a) * r)
      e.set(u * spin[i] * 6, a + Math.PI / 2, Math.sin(t * spin[i] + i) * 0.4, 'YXZ')
      q.setFromEuler(e)
      cards.set(i, pos, q, W, H, 0.12, (i % 3) !== 0, cell[i])
    }
    cards.commit()
  }
  update(0)
  return {
    group,
    update,
    dispose() { cards.dispose(); colGeo.dispose(); colMat.dispose(); group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m !== cards.fronts && m !== cards.backs && m.geometry !== colGeo) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.() } }) },
  }
}

// ── 4. O Chalé ───────────────────────────────────────────────────────────────
function buildChalet(front: THREE.Texture, back: THREE.Texture): Proto {
  const group = new THREE.Group()
  group.name = 'Proto:Chalet'
  const W = 168, H = W * CARD_RATIO // 235 m de carta
  const lean = 0.5 // 28,6° da vertical: telhado íngreme de chalé
  const apex = H * Math.cos(lean)
  const half = H * Math.sin(lean)
  const cardMat = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.06, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55 })
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6, metalness: 0.2, side: THREE.FrontSide })
  const geo = new THREE.PlaneGeometry(W, H)
  const mk = (map: THREE.Texture, sign: number) => {
    // sign −1: carta norte (frente para a praça, −z); +1: carta sul (verso para o spaceport)
    const outer = new THREE.Mesh(geo, cardMat(map))
    const inner = new THREE.Mesh(geo, innerMat)
    const g = new THREE.Group()
    g.add(outer, inner)
    inner.rotation.y = Math.PI
    inner.position.z = -0.6
    outer.castShadow = true
    outer.receiveShadow = true
    // a carta pivota no chão: base em z = sign·half, topo no ápice
    g.position.set(0, 1.4 + apex / 2, sign * half / 2)
    g.rotation.set(sign * lean, sign > 0 ? 0 : Math.PI, 0, 'YXZ')
    return g
  }
  group.add(mk(front, -1), mk(back, 1))
  // a cumeeira: uma viga clara onde as duas cartas se encontram
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.4, metalness: 0.3 }))
  ridge.position.set(0, 1.4 + apex + 0.6, 0)
  group.add(ridge)
  // as empenas: dois triângulos de vidro escuro com a luz de dentro
  const gable = new THREE.Shape()
  gable.moveTo(-half, 0); gable.lineTo(half, 0); gable.lineTo(0, apex); gable.closePath()
  const gableGeo = new THREE.ShapeGeometry(gable)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1018, roughness: 0.15, metalness: 0.1, transmission: 0.55, thickness: 2, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: 0xffa040, emissiveIntensity: 0.06 })
  for (const sx of [-1, 1]) {
    const gm = new THREE.Mesh(gableGeo, glass)
    gm.rotation.y = sx * Math.PI / 2
    gm.position.set(sx * (W / 2 - 1.5), 1.4, 0)
    group.add(gm)
    // esquadrias: linhas verticais na empena
    for (let k = -3; k <= 3; k++) {
      const x = k * (half / 4)
      const hh = apex * (1 - Math.abs(x) / half)
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.9, hh, 0.9), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.4 }))
      mullion.position.set(sx * (W / 2 - 1.5), 1.4 + hh / 2, x)
      group.add(mullion)
    }
  }
  // o piso interno acende: um plano quente sob o chalé, e luzes de dentro
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 6, half * 2 - 6), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.35, toneMapped: false }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 1.6
  group.add(floor)
  const lights: THREE.PointLight[] = []
  for (const x of [-W * 0.3, 0, W * 0.3]) {
    const l = new THREE.PointLight(WARM, 2.6, 380, 1.3)
    l.position.set(x, apex * 0.35, 0)
    group.add(l); lights.push(l)
  }
  // luz de fora nas faces, para a carta ler mesmo de longe
  for (const [x, z] of [[-W * 0.35, -half - 90], [W * 0.35, -half - 90], [-W * 0.35, half + 90], [W * 0.35, half + 90]]) {
    const l = new THREE.PointLight(0xffffff, 1.4, 420, 1.2)
    l.position.set(x, 40, z)
    group.add(l)
  }
  plinth(group, Math.max(W, half * 2) * 0.72)
  // a marca no ápice, girando devagar
  const glyph = new THREE.Group()
  glyph.add(new THREE.Mesh(new THREE.TorusGeometry(10, 1.2, 8, 48), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false })))
  glyph.add(new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false })))
  glyph.position.set(0, 1.4 + apex + 30, 0)
  group.add(glyph)
  return {
    group,
    update(t) { glyph.rotation.y = t * 0.3; for (const l of lights) l.intensity = 2.6 * (0.9 + 0.1 * Math.sin(t * 1.1 + l.position.x)) },
    dispose() { geo.dispose(); gableGeo.dispose(); glass.dispose(); innerMat.dispose(); group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry !== geo && m.geometry !== gableGeo) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.() } }) },
  }
}

export function buildProto(kind: ProtoKind, atlas: THREE.Texture, back: THREE.Texture, logo?: { front: THREE.Texture; back: THREE.Texture }): Proto {
  if (kind === 'hand') return buildHand(atlas, back)
  if (kind === 'tally') return buildTally(atlas, back)
  if (kind === 'chalet' && logo) return buildChalet(logo.front, logo.back)
  return buildShuffle(atlas, back)
}
