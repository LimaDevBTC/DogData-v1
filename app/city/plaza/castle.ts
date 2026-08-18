// O Castelo de Cartas do Satoshi: o prédio do OrdCards na praça (praca-central.md
// §2, decisão D2). Um castelo de conto de fadas feito de cartas, e as cartas são
// as do endereço Gênesis (o tributo que o mundo inscreveu para o Satoshi), compostas
// em public/city/castle/cards.jpg pelo atlas; o verso é a marca do OrdCards.
//
// Construído em código, e não no Blender, por uma razão de produto: as cartas são
// IMAGENS REAIS, e uma estrutura de mil placas texturizadas é uma InstancedMesh
// (duas: frentes e versos), não uma malha exportada. Cada carta é uma placa 63:88
// de 8 × 11,2 m; o castelo é o que se faz com placas quando se tem centenas delas:
// muralha de cartas em pé (verso para fora, uma em cinco de frente, como janela),
// torres de "A" (pares encostados) subindo em anéis que afunilam, com pisos de
// cartas deitadas entre os andares, uma torre de menagem no centro, coruchéus de
// quatro cartas, flâmulas com a marca, ponte levadiça que é uma carta gigante
// baixada sobre o fosso, e luz quente por dentro vazando pelas frestas.
import * as THREE from 'three'

export const CARD_W = 8
export const CARD_H = CARD_W * 88 / 63
const CARD_T = 0.16
const ATLAS_COLS = 6
const ATLAS_ROWS = 4
const N_CARDS = ATLAS_COLS * ATLAS_ROWS

const WARM = new THREE.Color('#FFB35C')

interface Placed {
  pos: THREE.Vector3
  yaw: number   // rotação em y (0 = normal apontando +z)
  pitch: number // inclinação sobre o eixo x local (positivo = topo cai para trás)
  roll: number
  cell: number
  /** true = frente para fora (janela); false = verso para fora (muralha) */
  frontOut: boolean
  scale: number
}

export interface Castle {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
}

function hash(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function buildCastle(opts: { atlas: THREE.Texture; back: THREE.Texture }): Castle {
  const group = new THREE.Group()
  group.name = 'CardCastle'
  const cards: Placed[] = []
  let cellCursor = 0
  const nextCell = () => (cellCursor++ * 7) % N_CARDS

  const place = (pos: THREE.Vector3, yaw: number, pitch: number, frontOut: boolean, scale = 1, roll = 0) => {
    cards.push({ pos, yaw, pitch, roll, cell: nextCell(), frontOut, scale })
  }

  // ── um anel de cartas em pé, tangentes ao círculo, encostadas para fora ──
  const ringStanding = (cx: number, cz: number, r: number, y: number, lean: number, gapYawFrom?: number, gapYawTo?: number, windowEvery = 5) => {
    const n = Math.max(6, Math.round((2 * Math.PI * r) / (CARD_W * 1.02)))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      if (gapYawFrom != null && gapYawTo != null) {
        const da = ((a - gapYawFrom + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        if (da > 0 && da < gapYawTo - gapYawFrom) continue
      }
      // a carta fica no raio r, de face para fora (normal radial); a inclinação
      // encosta o topo para dentro (lean negativo) ou para fora
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r
      const yaw = Math.atan2(Math.cos(a), Math.sin(a)) // normal = radial
      place(new THREE.Vector3(px, y + (CARD_H / 2) * Math.cos(lean), pz), yaw, lean, i % windowEvery === 2)
    }
  }
  // ── um piso: cartas deitadas em roseta ──
  const floorRing = (cx: number, cz: number, r: number, y: number) => {
    const n = Math.max(4, Math.round((2 * Math.PI * (r - CARD_H * 0.35)) / (CARD_W * 0.95)))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2
      const rr = r - CARD_H * 0.5
      place(new THREE.Vector3(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr), Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI, Math.PI / 2, false)
    }
    if (r < CARD_H) place(new THREE.Vector3(cx, y, cz), hash(cards.length) * Math.PI, Math.PI / 2, true)
  }
  // ── uma torre: anéis de "A" afunilando, piso a cada andar, coruchéu e flâmula ──
  const tower = (cx: number, cz: number, tiers: number, r0: number, r1: number, y0 = 0) => {
    let y = y0
    for (let k = 0; k < tiers; k++) {
      const r = r0 + (r1 - r0) * (k / Math.max(1, tiers - 1))
      const n = Math.max(6, Math.round((2 * Math.PI * r) / (CARD_W * 0.78)))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + k * 0.17
        const lean = (i % 2 === 0 ? -1 : 1) * 0.36 // pares encostados: o "A"
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r
        // normal tangente ao anel: as cartas do "A" olham ao longo do círculo
        const yaw = Math.atan2(-Math.sin(a), Math.cos(a))
        place(new THREE.Vector3(px, y + (CARD_H / 2) * Math.cos(0.36), pz), yaw, lean, hash(i + k * 31, cx) < 0.18)
      }
      y += CARD_H * Math.cos(0.36) + 0.25
      floorRing(cx, cz, r + CARD_W * 0.15, y)
      y += CARD_T + 0.05
    }
    // coruchéu cônico: oito cartas de frente, encostadas no mastro, e uma segunda
    // volta menor por cima. É o telhado de conto de fadas, e é onde a arte aparece.
    const spireBase = y
    for (const [nn, rr, hh, sc] of [[8, r1 * 0.95, 0.0, 1.0], [6, r1 * 0.55, CARD_H * 0.62, 0.8]] as const) {
      for (let i = 0; i < nn; i++) {
        const a = (i / nn) * Math.PI * 2 + (nn === 6 ? Math.PI / 6 : 0)
        const rc = rr * 0.55
        place(new THREE.Vector3(cx + Math.cos(a) * rc, spireBase + hh + CARD_H * sc * 0.42, cz + Math.sin(a) * rc), Math.atan2(Math.cos(a), Math.sin(a)), -0.72, true, sc)
      }
    }
    y = spireBase + CARD_H * 0.62 + CARD_H * 0.8 * 0.84
    // mastro e flâmula triangular
    const pole = new THREE.Mesh(poleGeo, poleMat)
    pole.position.set(cx, y + 7, cz)
    pole.scale.y = 14
    group.add(pole)
    const flag = new THREE.Mesh(flagGeo, flagMat)
    flag.position.set(cx + 3.2, y + 12, cz)
    group.add(flag)
    flags.push(flag)
    return y
  }

  const poleGeo = new THREE.CylinderGeometry(0.16, 0.22, 1, 6)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.7 })
  const flagGeo = (() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 2.2, 0, 6.5, 0.6, 0, 0, -1.2, 0], 3))
    g.setIndex([0, 1, 2]); g.computeVertexNormals(); return g
  })()
  const flagMat = new THREE.MeshBasicMaterial({ color: 0xf7931a, side: THREE.DoubleSide, toneMapped: false })
  const flags: THREE.Mesh[] = []

  // ── a planta ──────────────────────────────────────────────────────────────
  const R_WALL = 54
  // plinto e fosso
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(R_WALL + 9, R_WALL + 10, 1.4, 64),
    new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.85, metalness: 0.1 }),
  )
  plinth.position.y = 0.7
  plinth.receiveShadow = true
  plinth.castShadow = true
  group.add(plinth)
  const moat = new THREE.Mesh(
    new THREE.RingGeometry(R_WALL + 10, R_WALL + 22, 96),
    new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.08, metalness: 0.6, emissive: 0x0b1a30, emissiveIntensity: 0.6, envMapIntensity: 1.4 }),
  )
  // o anel de luz do plinto, quente, na mesma linguagem do anel do deck
  const plinthRing = new THREE.Mesh(
    new THREE.RingGeometry(R_WALL + 8.4, R_WALL + 9.2, 128),
    new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  )
  plinthRing.rotation.x = -Math.PI / 2
  plinthRing.position.y = 1.45
  group.add(plinthRing)
  moat.rotation.x = -Math.PI / 2
  moat.position.y = -0.4
  moat.receiveShadow = true
  group.add(moat)
  const bank = new THREE.Mesh(
    new THREE.RingGeometry(R_WALL + 22, R_WALL + 25, 96),
    new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.9 }),
  )
  bank.rotation.x = -Math.PI / 2
  bank.position.y = 0.05
  group.add(bank)

  // muralha: três andares com piso, portão ao norte (yaw −z = ângulo −π/2)
  const GATE_A = -Math.PI / 2
  const gateHalf = (CARD_W * 1.6) / R_WALL
  let wy = 1.4
  for (let k = 0; k < 3; k++) {
    const gap = k < 2 ? [GATE_A - gateHalf, GATE_A + gateHalf] as const : undefined
    ringStanding(0, 0, R_WALL, wy, 0.14, gap?.[0], gap?.[1])
    wy += CARD_H * Math.cos(0.14) + 0.2
    // o piso da muralha: cartas deitadas na tangente
    const n = Math.round((2 * Math.PI * R_WALL) / (CARD_H * 0.98))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.05
      place(new THREE.Vector3(Math.cos(a) * (R_WALL - 0.5), wy, Math.sin(a) * (R_WALL - 0.5)), Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2, Math.PI / 2, false)
    }
    wy += CARD_T + 0.05
  }
  // ameias: uma carta em pé a cada duas, no topo da muralha
  {
    const n = Math.round((2 * Math.PI * R_WALL) / (CARD_W * 1.02))
    for (let i = 0; i < n; i += 2) {
      const a = (i / n) * Math.PI * 2
      place(new THREE.Vector3(Math.cos(a) * R_WALL, wy + CARD_H * 0.28, Math.sin(a) * R_WALL), Math.atan2(Math.cos(a), Math.sin(a)), 0.05, i % 6 === 0, 0.56)
    }
  }

  // torres de canto, torres do portão, torre de menagem
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    tower(Math.cos(a) * R_WALL, Math.sin(a) * R_WALL, 8, 9.5, 5.2, 1.4)
  }
  tower(-13, -R_WALL - 2, 6, 6.5, 3.8, 1.4)
  tower(13, -R_WALL - 2, 6, 6.5, 3.8, 1.4)
  // torres de meio de muralha, mais baixas, e duas esguias ao lado da menagem
  for (const a of [0, Math.PI / 2, Math.PI]) tower(Math.cos(a) * R_WALL, Math.sin(a) * R_WALL, 5, 7, 4, 1.4)
  tower(-24, 12, 11, 7, 3.6, 1.4)
  tower(26, -6, 10, 7, 3.6, 1.4)
  const keepTop = tower(0, 4, 15, 16, 6.5, 1.4)
  // pontes de cartas entre a menagem e as torres de canto, a meia altura: um
  // tabuleiro de cartas deitadas com guarda-corpo de cartas em pé
  for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) {
    const from = new THREE.Vector3(Math.cos(a) * 15, 0, 4 + Math.sin(a) * 15)
    const to = new THREE.Vector3(Math.cos(a) * (R_WALL - 8), 0, Math.sin(a) * (R_WALL - 8))
    const len = from.distanceTo(to)
    const nseg = Math.round(len / (CARD_H * 0.98))
    const dir = to.clone().sub(from).normalize()
    const yaw = Math.atan2(dir.x, dir.z)
    const yb = 1.4 + 3 * (CARD_H * Math.cos(0.36) + 0.3)
    for (let i = 0; i < nseg; i++) {
      const c = from.clone().addScaledVector(dir, (i + 0.5) * CARD_H * 0.98)
      place(new THREE.Vector3(c.x, yb, c.z), yaw + Math.PI / 2, Math.PI / 2, false) // tabuleiro
      const side = new THREE.Vector3(-dir.z, 0, dir.x)
      for (const sgn of [-1, 1]) {
        const p = c.clone().addScaledVector(side, sgn * CARD_W * 0.55)
        place(new THREE.Vector3(p.x, yb + CARD_H * 0.28, p.z), yaw + (sgn > 0 ? Math.PI / 2 : -Math.PI / 2), 0.08, i % 3 === 1, 0.56)
      }
    }
  }
  // coroa da menagem: oito cartas abertas em leque, de frente
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    place(new THREE.Vector3(Math.cos(a) * 7.5, keepTop + CARD_H * 0.55, 4 + Math.sin(a) * 7.5), Math.atan2(Math.cos(a), Math.sin(a)), -0.5, true, 0.9)
  }

  // ponte levadiça: uma carta gigante baixada sobre o fosso, do portão para o norte
  const bridgeLen = CARD_H * 2.6
  const tilt = 0.12
  place(
    new THREE.Vector3(0, 1.4 - Math.sin(tilt) * bridgeLen * 0.5 + 0.9, -R_WALL - 2 - Math.cos(tilt) * bridgeLen * 0.5),
    Math.PI, Math.PI / 2 - tilt, true, 2.6,
  )
  // correntes da ponte: duas linhas até as torres do portão
  const chainMat = new THREE.LineBasicMaterial({ color: 0x8a8a90, transparent: true, opacity: 0.6 })
  for (const sx of [-1, 1]) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(sx * 8, 1.4 - Math.sin(tilt) * bridgeLen + 0.9, -R_WALL - 2 - Math.cos(tilt) * bridgeLen),
      new THREE.Vector3(sx * 12.5, 1.4 + CARD_H * Math.cos(0.36) * 5.2, -R_WALL - 2),
    ])
    group.add(new THREE.Line(g, chainMat))
  }

  // ── luz por dentro: cilindros quentes nas torres e na menagem, e três luzes ──
  const glowMat = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.55, depthWrite: false })
  const glow = (x: number, z: number, r: number, h: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16, 1, true), glowMat)
    m.position.set(x, h / 2 + 1.4, z)
    group.add(m)
    return m
  }
  const glows: THREE.Mesh[] = []
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) glows.push(glow(Math.cos(a) * R_WALL, Math.sin(a) * R_WALL, 4.2, 82))
  glows.push(glow(-13, -R_WALL - 2, 3, 62), glow(13, -R_WALL - 2, 3, 62), glow(0, 4, 8, 165))
  const lights: THREE.PointLight[] = []
  const lightSpots: [number, number, number, number][] = [
    [0, 110, 4, 3.0], [0, 40, 4, 1.6], [-13, 40, -R_WALL - 2, 1.3], [13, 40, -R_WALL - 2, 1.3],
  ]
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    lightSpots.push([Math.cos(a) * R_WALL, 45, Math.sin(a) * R_WALL, 1.1])
  }
  for (const [x, y, z, i] of lightSpots) {
    const l = new THREE.PointLight(WARM, i, 260, 1.5)
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
  }
  // o pé de cada torre acende: um disco quente no chão, luz que "vaza" pela base
  const footMat = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false })
  for (const [x, z, r] of [[0, 4, 19], [-13, -R_WALL - 2, 8], [13, -R_WALL - 2, 8], [-24, 12, 8.5], [26, -6, 8.5]] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), footMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 1.5, z)
    group.add(m)
  }
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(11, 32), footMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(Math.cos(a) * R_WALL, 1.5, Math.sin(a) * R_WALL)
    group.add(m)
  }

  // ── as instâncias ─────────────────────────────────────────────────────────
  const planeF = new THREE.PlaneGeometry(CARD_W, CARD_H)
  const planeB = new THREE.PlaneGeometry(CARD_W, CARD_H)
  const uvOff = new Float32Array(cards.length * 2)
  const frontMat = new THREE.MeshStandardMaterial({ map: opts.atlas, roughness: 0.55, metalness: 0.05, side: THREE.FrontSide })
  frontMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCell = { value: new THREE.Vector2(1 / ATLAS_COLS, 1 / ATLAS_ROWS) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUvOff;\nuniform vec2 uCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = vMapUv * uCell + aUvOff;\n#endif')
  }
  frontMat.customProgramCacheKey = () => 'satoshi-card-atlas'
  const backMat = new THREE.MeshStandardMaterial({ map: opts.back, roughness: 0.6, metalness: 0.05, side: THREE.FrontSide })

  const fronts = new THREE.InstancedMesh(planeF, frontMat, cards.length)
  const backs = new THREE.InstancedMesh(planeB, backMat, cards.length)
  fronts.castShadow = backs.castShadow = true
  fronts.receiveShadow = backs.receiveShadow = true
  fronts.name = 'CardFronts'
  backs.name = 'CardBacks'

  const o = new THREE.Object3D()
  const n = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  cards.forEach((c, i) => {
    e.set(c.pitch, c.yaw, c.roll, 'YXZ')
    q.setFromEuler(e)
    n.set(0, 0, 1).applyQuaternion(q) // normal "de fora"
    const half = CARD_T / 2
    // face de fora
    o.position.copy(c.pos).addScaledVector(n, half)
    o.quaternion.copy(q)
    o.scale.setScalar(c.scale)
    o.updateMatrix()
    const outer = o.matrix.clone()
    // face de dentro: virada 180° em torno do eixo vertical local
    o.position.copy(c.pos).addScaledVector(n, -half)
    o.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI))
    o.updateMatrix()
    const inner = o.matrix.clone()
    if (c.frontOut) { fronts.setMatrixAt(i, outer); backs.setMatrixAt(i, inner) }
    else { fronts.setMatrixAt(i, inner); backs.setMatrixAt(i, outer) }
    const col = c.cell % ATLAS_COLS, row = Math.floor(c.cell / ATLAS_COLS)
    uvOff[i * 2] = col / ATLAS_COLS
    uvOff[i * 2 + 1] = 1 - (row + 1) / ATLAS_ROWS
  })
  planeF.setAttribute('aUvOff', new THREE.InstancedBufferAttribute(uvOff, 2))
  fronts.instanceMatrix.needsUpdate = true
  backs.instanceMatrix.needsUpdate = true
  group.add(fronts, backs)

  return {
    group,
    update(t) {
      const k = 0.5 + 0.08 * Math.sin(t * 0.9)
      glowMat.opacity = k
      for (const f of flags) f.rotation.y = 0.35 * Math.sin(t * 2.2 + f.position.x)
      for (const l of lights) l.intensity = l.userData.base ?? (l.userData.base = l.intensity)
      for (const l of lights) l.intensity = l.userData.base * (0.9 + 0.1 * Math.sin(t * 1.3 + l.position.x))
    },
    dispose() {
      planeF.dispose(); planeB.dispose(); frontMat.dispose(); backMat.dispose(); glowMat.dispose(); poleGeo.dispose(); poleMat.dispose(); flagGeo.dispose(); flagMat.dispose(); footMat.dispose()
      group.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.isMesh && m !== fronts && m !== backs) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.() }
      })
    },
  }
}
