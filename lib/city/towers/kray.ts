// ═══════════════════════════════════════════════════════════════════════════
// Kray Space — flagship sponsor tower (Satoshi Plaza, west anchor)
// Faithful to the owner's reference render: a TALL slender black tower (~3:1)
// with a low pinched waist that widens continuously to its widest point at the
// crown; bold DARK V-ribs sweep from the pinched base up to the top corners of
// each wide façade (with a thin silver highlight edge); the glass is an ordered
// vertical rhythm of warm-lit bays between continuous white mullion lines and
// dark floor slabs; a dark penthouse band, an overhanging roof rim with a
// garden ring, and the glowing Kray triangle standing above the roof centre.
// Built in local space, positioned/rotated at world coords — caller only does
// scene.add(group) + animate(t).
//
// SHARED SOURCE OF TRUTH. This file lives in lib/ (tracked) rather than in
// app/city/explore/ (gitignored) because the landing page's institutional-
// partners section renders the same building, and a production page may never
// import from the ignored city directory — Vercel builds from the GitHub clone,
// where that directory does not exist. app/city/explore/kray-tower.ts is now a
// thin re-export of this module, so the plaza anchor and the landing showcase
// can never drift apart.
//
// `opts.detail` adds the close-range pass (lobby colonnade, entrance steps,
// podium lip). The city never turns it on — at city distance those meshes are
// sub-pixel — and the landing viewer, which frames the tower from ~1.6 heights
// away, always does.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const H = 320 // total tower height — slender landmark (needle at 500 still rules the sky)

/** Crown height of the tower body, in city units — the landing viewer frames on it. */
export const KRAY_HEIGHT = H
/** Storeys expressed by the façade texture (ROWS below) — quoted in the landing dossier. */
export const KRAY_STOREYS = 27

// ── Silhouette profile ───────────────────────────────────────────────────────
// s(h) = half-width scale at height-fraction h. Reference shape: slight flare at
// the very foot, LOW waist (~12%), then one continuous widening sweep — the
// crown is the widest point (subtle pull-in at the very rim).
const CP: [number, number][] = [
  [0.00, 0.84], [0.05, 0.74], [0.12, 0.68], [0.30, 0.75], [0.50, 0.82],
  [0.70, 0.90], [0.85, 0.965], [0.93, 1.00], [1.00, 0.985],
]
function prof(h: number): number {
  if (h <= CP[0][0]) return CP[0][1]
  if (h >= CP[CP.length - 1][0]) return CP[CP.length - 1][1]
  for (let i = 0; i < CP.length - 1; i++) {
    const [h0, s0] = CP[i], [h1, s1] = CP[i + 1]
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0)
      const ts = t * t * (3 - 2 * t) // smoothstep → C1-smooth vertical curve
      return s0 + (s1 - s0) * ts
    }
  }
  return CP[CP.length - 1][1]
}

// ── Rounded-rectangle (superellipse) cross-section loft ──────────────────────
// Lofts P+1 columns (seam duplicated for wrap-free UVs) across `rings` stations
// following a profile fn. UV: u around perimeter, v up → drives the façade map.
function buildLoft(
  profile: (h: number) => number, HX: number, HZ: number,
  hLo: number, hHi: number, rings: number, P: number,
  capTop: boolean, capBottom: boolean,
): THREE.BufferGeometry {
  const cols = P + 1
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const e = 0.2 // superellipse exponent → crisp near-rectangular corners, softly chamfered
  // Superellipse points cluster at the corners when stepped by angle, which
  // would stretch the façade texture across the face middles (windows become
  // wide slabs). Parametrise u by ARC LENGTH instead — the cross-section shape
  // is scale-invariant across rings, so one normalised table serves them all.
  const ringPt = (i: number): [number, number] => {
    const th = (2 * Math.PI * i) / P
    const ct = Math.cos(th), st = Math.sin(th)
    return [Math.sign(ct) * Math.pow(Math.abs(ct), e), Math.sign(st) * Math.pow(Math.abs(st), e)]
  }
  const uArc: number[] = [0]
  {
    let acc = 0
    let [px, pz] = ringPt(0)
    for (let i = 1; i <= P; i++) {
      const [qx, qz] = ringPt(i)
      acc += Math.hypot((qx - px) * HX, (qz - pz) * HZ)
      uArc.push(acc)
      px = qx; pz = qz
    }
    for (let i = 0; i <= P; i++) uArc[i] /= acc
  }
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1)
    const h = hLo + (hHi - hLo) * t
    const s = profile(h), y = h * H, hx = HX * s, hz = HZ * s
    for (let i = 0; i <= P; i++) {
      const [nx, nz] = ringPt(i)
      pos.push(hx * nx, y, hz * nz)
      uv.push(uArc[i], t)
    }
  }
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < P; i++) {
      const a = r * cols + i, b = a + 1
      const c = (r + 1) * cols + i, d = c + 1
      idx.push(a, b, d, a, d, c)
    }
  }
  const cap = (r: number, top: boolean) => {
    const cy = (hLo + (hHi - hLo) * (r / (rings - 1))) * H
    const ci = pos.length / 3
    pos.push(0, cy, 0); uv.push(0.5, 0.5)
    const base = r * cols
    for (let i = 0; i < P; i++) {
      const a = base + i, b = base + i + 1
      if (top) idx.push(ci, a, b); else idx.push(ci, b, a)
    }
  }
  if (capTop) cap(rings - 1, true)
  if (capBottom) cap(0, false)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

// ── Façade texture — ordered VERTICAL window bays (reference rhythm) ─────────
// Continuous thin white mullion lines between bays, dark horizontal floor
// slabs, warm/cool lit interiors, a dark penthouse band under the roof and a
// taller warm lobby band at the foot. Baked once (emissiveMap), never redrawn.
function makeFacadeTexture(): THREE.CanvasTexture {
  const S = 1024, BAYS = 34, ROWS = 27  // bays slightly taller than wide → vertical rhythm
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, S, S)
  const bw = S / BAYS, rh = S / ROWS
  // flipY: canvas y=0 = building TOP. Row 0 = penthouse band, last 2 = lobby.
  for (let r = 0; r < ROWS; r++) {
    for (let b = 0; b < BAYS; b++) {
      const x = b * bw, y = r * rh
      let col: string
      if (r <= 1) {
        col = '#101722'                                    // dark 2-storey penthouse band (sign sits here)
      } else if (r >= ROWS - 2) {
        col = Math.random() < 0.85 ? '#ffca8a' : '#151a24' // tall warm lobby glass
      } else {
        const lit = Math.random() < 0.60
        col = lit ? (Math.random() < 0.22 ? '#cfe0ff' : '#ffd9a0') : '#10141d'
      }
      ctx.fillStyle = col
      ctx.fillRect(x + 3.5, y + 4, bw - 7, rh - 8)
    }
  }
  // dark floor slabs — kill glow between storeys
  ctx.fillStyle = '#04050a'
  for (let r = 0; r <= ROWS; r++) ctx.fillRect(0, r * rh - 2, S, 4)
  // continuous white mullion lines — the reference's fine vertical rhythm
  ctx.fillStyle = '#96a2b4'
  for (let b = 0; b <= BAYS; b++) ctx.fillRect(b * bw - 1.2, 0, 2.4, S)
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 8
  return tex
}

// ── "KRAY•SPACE" façade sign — official brand lockup recreated in canvas:
// bold all-caps sans, a round middot separating the words, white on dark.
// HIGH-RES (4096×1024, 4:1 to match the sign plane) with a CRISP solid core and
// a single restrained bloom so the letters stay sharp up close (the old triple
// heavy blur softened the edges into a low-res look). ────────────────────────
function makeSignTexture(): THREE.CanvasTexture {
  const W = 4096, Hh = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = Hh
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, Hh)
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.font = '700 460px "Helvetica Neue", Arial, sans-serif'
  try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '24px' } catch { /* noop */ }
  // manual layout so the separator dot is a precise circle at optical centre
  const t1 = 'KRAY', t2 = 'SPACE', gap = 104, dotR = 52, cy = Hh / 2
  const w1 = ctx.measureText(t1).width, w2 = ctx.measureText(t2).width
  const total = w1 + gap + dotR * 2 + gap + w2
  const x0 = (W - total) / 2
  const dotX = x0 + w1 + gap + dotR
  const drawGlyphs = () => {
    ctx.fillText(t1, x0, cy)
    ctx.beginPath(); ctx.arc(dotX, cy, dotR, 0, Math.PI * 2); ctx.fill()
    ctx.fillText(t2, x0 + w1 + gap + dotR * 2 + gap, cy)
  }
  // pass 1 — one soft outer halo (neon bloom that survives daylight)
  ctx.shadowColor = 'rgba(206,224,255,0.9)'; ctx.shadowBlur = 60
  ctx.fillStyle = '#eaf1ff'; drawGlyphs()
  // pass 2 — crisp solid core, no blur → sharp legible edges
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; drawGlyphs()
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 16
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  return tex
}

export function buildKrayTower(
  b: { x: number; z: number; w: number; d: number; face: number },
  opts: { detail?: boolean } = {},
): { group: THREE.Group; animate: (t: number) => void } {
  const detail = opts.detail === true
  const group = new THREE.Group()
  group.position.set(b.x, 4, b.z) // base of building at y = 4 (plaza slab top)
  group.rotation.y = b.face       // wide façades → plaza-facing = local +Z

  // Slender body — deliberately narrower than the anchor lot (175×82) so the
  // tower reads ~3:1 like the reference, standing in its own landscaped ground.
  const HX = 52, HZ = 32
  const P = 40

  // ── Shared materials ───────────────────────────────────────────────────────
  const facadeTex = makeFacadeTexture()
  const facadeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0b0f, roughness: 0.35, metalness: 0.6,
    emissive: 0xffffff, emissiveMap: facadeTex, emissiveIntensity: 1.0,
    side: THREE.DoubleSide,
  })
  const ribMat = new THREE.MeshStandardMaterial({   // bold DARK structural ribs
    color: 0x14161c, roughness: 0.4, metalness: 0.7,
  })
  const edgeMat = new THREE.MeshStandardMaterial({  // thin silver highlight edge
    color: 0xb9c2cf, roughness: 0.35, metalness: 0.6,
    emissive: 0xb9c2cf, emissiveIntensity: 0.22,
  })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.5, metalness: 0.55 })
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1c3322, roughness: 0.9, metalness: 0.0 })
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.4, metalness: 0.6 })

  // ── Ground plinth — dark landscaped pad grounding the slender body ──────────
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.4, 40), darkMat)
  plinth.scale.set(HX * 1.7, 1, HZ * 2.1)
  plinth.position.y = 1.2
  group.add(plinth)

  // ── Main body (slender flared loft, widest at the crown) ────────────────────
  const body = new THREE.Mesh(buildLoft(prof, HX, HZ, 0, 1, 30, P, true, true), facadeMat)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // ── Real 3D relief: protruding silver slab rings every 3rd floor ────────────
  // Thin lofted ribbons just proud of the glass line — they catch light exactly
  // like the reference's horizontal floor edges. Shared material, cheap 2-ring lofts.
  const ROWS = 27, slabT = 1.7 / H
  for (let r = 3; r <= 24; r += 3) {
    const f = r / ROWS
    const ring = new THREE.Mesh(
      buildLoft((h) => prof(h) * 1.018, HX, HZ, f - slabT / 2, f + slabT / 2, 2, P, false, false),
      edgeMat,
    )
    group.add(ring)
  } // 8 slab rings

  // ── V-ribs — the reference's signature: dark fins from the pinched base up
  // to the top corners of each wide façade, doubled by a silver edge line ─────
  const facePoint = (zside: number, h: number, u: number, out = 1.4) =>
    new THREE.Vector3(HX * prof(h) * u * 0.99, h * H, zside * (HZ * prof(h) + out))
  const addRib = (zside: number, hA: number, uA: number, hB: number, uB: number, r: number, mat: THREE.Material, out = 1.4) => {
    const pts: THREE.Vector3[] = []
    const N = 12
    for (let k = 0; k <= N; k++) {
      const p = k / N
      pts.push(facePoint(zside, hA + (hB - hA) * p, uA + (uB - uA) * p, out))
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, r, 5, false), mat))
  }
  for (const zside of [1, -1]) {
    for (const s of [-1, 1]) {
      addRib(zside, 0.10, 0, 1.0, s * 0.92, 2.3, ribMat)          // main dark V
      addRib(zside, 0.10, 0, 1.0, s * 0.92, 0.8, edgeMat, 2.6)    // silver edge riding on it
      addRib(zside, 0.0, s * 0.52, 0.115, 0, 2.0, ribMat)         // base legs into the pinch
    }
  } // 12 rib tubes total

  // ── Entrance — layered angular canopies over the warm lobby (plaza side) ────
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(HX * 1.5, 1.6, 13), darkMat)
  canopy.position.set(0, 0.055 * H, HZ * prof(0.03) + 6)
  canopy.rotation.x = 0.07
  group.add(canopy)
  // The lower canopy is a silver slab. Across the plaza that is a highlight
  // catching the light; at showcase range a fully bright plank hanging off the
  // entrance is the weakest thing on the building, so close range gives it a
  // dark soffit and keeps the silver for a nosing bar along its leading edge —
  // which is how the highlight actually happens on a real canopy.
  const canopy2 = new THREE.Mesh(new THREE.BoxGeometry(HX * 1.05, 1.3, 9), detail ? darkMat : edgeMat)
  canopy2.position.set(0, 0.038 * H, HZ * prof(0.03) + 9.5)
  canopy2.rotation.x = 0.09
  group.add(canopy2)
  if (detail) {
    const nosing = new THREE.Mesh(new THREE.BoxGeometry(HX * 1.05, 0.5, 0.9), edgeMat)
    nosing.position.set(0, 0.038 * H - 0.5, HZ * prof(0.03) + 13.9)
    nosing.rotation.x = 0.09
    group.add(nosing)
  }

  // ── Close-range pass (landing showcase only) ────────────────────────────────
  // At plaza distance the lobby is four pixels of warm glass and none of this
  // resolves; at showcase distance the foot of the tower is the first thing the
  // eye lands on, and a 2-storey band of flat emissive texture reads as a
  // decal. Three cheap additions give the base real depth: a colonnade of
  // structural mullions standing off the glass, a landed entrance stair, and a
  // slab lip capping the lobby band where the tower proper begins.
  if (detail) {
    const lobbyTop = 0.074                                   // top of the warm lobby band
    const zLobby = HZ * prof(lobbyTop * 0.5)
    const colGeo = new THREE.BoxGeometry(1.5, lobbyTop * H, 1.5)
    const COLS_N = 13
    for (let i = 0; i < COLS_N; i++) {
      const u = (i / (COLS_N - 1)) * 2 - 1                   // -1 … 1 across the façade
      for (const zside of [1, -1]) {
        const col = new THREE.Mesh(colGeo, edgeMat)
        col.position.set(HX * prof(lobbyTop * 0.5) * u * 0.92, (lobbyTop * H) / 2, zside * (zLobby + 1.1))
        group.add(col)
      }
    }

    // entrance stair — three landings stepping down to the plinth, plaza side
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(HX * (0.95 + s * 0.12), 1.1, 4.5 + s * 2.2), darkMat)
      step.position.set(0, 2.4 + (2 - s) * 1.1, zLobby + 5 + s * 4.4)
      group.add(step)
    }

    // slab lip where the lobby band ends and the shaft begins — the horizontal
    // shadow line that tells you the podium is a separate piece of building
    const lip = new THREE.Mesh(
      buildLoft((h) => prof(h) * 1.035, HX, HZ, lobbyTop - 0.004, lobbyTop + 0.004, 2, P, false, false),
      darkMat,
    )
    group.add(lip)

    // a kerb around the plinth. Without it the landscaped pad is a hard-edged
    // dark ellipse on a dark plaza and reads as the building's own shadow; a
    // lit rim turns the same shape into ground the tower is standing on.
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(1, 0.014, 6, 64), edgeMat)
    kerb.rotation.x = Math.PI / 2
    kerb.scale.set(HX * 1.7, HZ * 2.1, 1)
    kerb.position.y = 2.3
    group.add(kerb)
  }

  // ── "Kray Space" sign — on the dark penthouse band, over a backing plate so
  // the white neon reads day and night, clear of the V-ribs (they hug the
  // corners this high). BOTH wide façades: plaza (+Z) and rear (-Z). ───────────
  const signH2 = 0.963                       // centre of the 2-storey dark band
  const signW = HX * 1.4, signH = signW / 4
  const signTex = makeSignTexture()          // shared by both faces
  const zFace = HZ * prof(signH2)
  const signGeo = new THREE.PlaneGeometry(signW, signH)
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, toneMapped: false })
  for (const zside of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(signW + 7, signH + 3, 1.4), darkMat)
    plate.position.set(0, signH2 * H, zside * (zFace + 2.2))
    group.add(plate)
    const sign = new THREE.Mesh(signGeo, signMat)
    sign.position.set(0, signH2 * H, zside * (zFace + 3.2))
    if (zside < 0) sign.rotation.y = Math.PI   // rear plane faces outward → text reads correctly
    group.add(sign)
  }

  // ── Crown: overhanging rim + roof garden ring + railing ─────────────────────
  const rTopX = HX * prof(1), rTopZ = HZ * prof(1)
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.6, 40), darkMat)
  rim.scale.set(rTopX * 1.07, 1, rTopZ * 1.10)   // slight brim past the glass line
  rim.position.y = H + 2.2
  group.add(rim)

  const hedge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), hedgeMat)
  hedge.rotation.x = Math.PI / 2
  hedge.scale.set(rTopX * 0.94, rTopZ * 0.94, 1)
  hedge.position.y = H + 5.6
  group.add(hedge)
  // clustered rooftop shrubs around the rim (shared geometry/material)
  const bushGeo = new THREE.IcosahedronGeometry(2.6, 1)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3
    const bush = new THREE.Mesh(bushGeo, hedgeMat)
    bush.position.set(Math.cos(a) * (rTopX * 0.88), H + 6.4, Math.sin(a) * (rTopZ * 0.88))
    bush.scale.setScalar(0.8 + ((i * 37) % 10) / 18)
    group.add(bush)
  }
  const railing = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.4, 40, 1, true), railMat)
  railing.scale.set(rTopX * 1.0, 1, rTopZ * 1.03)
  railing.position.y = H + 6.6
  group.add(railing)

  // ── Glowing Kray triangle standing above the roof centre ────────────────────
  // White-on-black logo as an alphaMap: mark = solid glowing white, bg = fully
  // transparent. Reads against a bright sky too (additive would wash out by day).
  const logoTex = new THREE.TextureLoader().load('/kray.jpeg')
  const logoMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, alphaMap: logoTex, depthWrite: false, toneMapped: false,
    transparent: true, side: THREE.DoubleSide, alphaTest: 0.12,  // kill jpeg noise around the mark
  })
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), logoMat)
  const logoBaseY = H + 30
  logo.position.set(0, logoBaseY, 0)
  group.add(logo)

  // ── Crowning 3D icon — Tom's inscribed GLB, spinning 360° above the roof
  // centre. Loads async; the flat triangle above holds the spot until it lands,
  // then we hide the flat mark and hand the crown to the real 3D icon. On a load
  // failure the triangle simply stays — the crown is never left empty. ─────────
  const iconPivot = new THREE.Group()
  iconPivot.position.set(0, logoBaseY, 0)
  group.add(iconPivot)
  let iconLoaded = false
  // the inscribed GLB ships Draco-compressed geometry (KHR_draco_mesh_compression),
  // so the loader needs a Draco decoder — served locally from /public/draco.
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  const gltfLoader = new GLTFLoader()
  gltfLoader.setDRACOLoader(dracoLoader)
  gltfLoader.load(
    '/d672e3f9510fd8cea3b08b3eb7ce9460b33792aa4584b9e40d1e1962eec119dai0.glb',
    (gltf) => {
      const model = gltf.scene
      // normalise: recenter to origin, then scale to the crown's target size so
      // the icon reads regardless of the GLB's native units/offset.
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      model.position.sub(center)
      const holder = new THREE.Group()
      holder.add(model)
      const maxDim = Math.max(size.x, size.y, size.z) || 1
      holder.scale.setScalar(46 / maxDim)
      iconPivot.add(holder)
      logo.visible = false        // hand the crown to the real 3D icon
      iconLoaded = true
      dracoLoader.dispose()       // free the decoder worker pool once decoded
    },
    undefined,
    () => { /* load failed — keep the flat triangle as the crown mark */ },
  )

  // ── Lights (budget: 2) — logo halo + warm lobby/entrance glow ───────────────
  const logoLight = new THREE.PointLight(0xffffff, 1.1, 150, 2)
  logoLight.position.set(0, logoBaseY, 0)
  group.add(logoLight)
  const lobbyLight = new THREE.PointLight(0xffd9a0, 0.6, 150, 2)
  lobbyLight.position.set(0, 0.05 * H, HZ * prof(0.05) + 10)
  group.add(lobbyLight)

  // ── Animation (cheap, zero per-frame allocations) ───────────────────────────
  const animate = (t: number) => {
    if (iconLoaded) {
      // The inscribed icon is close to flat, so a full 360° spin spends part of
      // every revolution edge-on — a gold sliver instead of the Kray mark. From
      // across the plaza that is a glint and it is fine. In the showcase, where
      // this mark is the point of the whole plate and a visitor may only watch
      // for a couple of seconds, close range trades the spin for a ±54° sweep:
      // still alive, never side-on.
      iconPivot.rotation.y = detail ? Math.sin(t * 0.22) * 0.95 : t * 0.5
      iconPivot.position.y = logoBaseY + Math.sin(t * 0.8) * 1.4
    } else {
      // flat triangle holds the crown until the GLB lands
      logoMat.opacity = 0.85 + 0.15 * Math.sin(t * 1.2)
      logo.position.y = logoBaseY + Math.sin(t * 0.8) * 1.2
      logo.rotation.y = t * 0.2
    }
    logoLight.intensity = 1.1 + 0.3 * Math.sin(t * 1.2)
  }

  return { group, animate }
}
