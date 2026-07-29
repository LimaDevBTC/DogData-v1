// ═══════════════════════════════════════════════════════════════════════════
// BitFlow Tower — "The Stack" (Satoshi Plaza, north anchor)
// bbfbuild.md, rebuilt from the owner's photoreference: a dark modern glass
// tower of stacked, cantilevered modular volumes — charcoal massing with warm
// amber-lit glass floors, salamander pixel-dither perforated panels, orange LED
// accent lines up the core and around the crown, a lit BITFLOW sign (orange
// pixel-mark + cream wordmark from the OFFICIAL art) on the crown and again at
// the glowing ground entrance, and a rooftop garden setback. Palette: black-
// flow #0B0E0B massing · salamander #F78116 glow/LED · warm-white glass · a
// whisper of sea #00D1AC in the dither. Built in local space, base y=0; caller
// places the group at the plaza slab top (y=4) and drives animate(t). Zero
// per-frame allocations.
//
// SHARED SOURCE OF TRUTH. This file lives in lib/ (tracked) rather than in
// app/city/explore/ (gitignored) because the landing page's institutional-
// partners section renders the same building, and a production page may never
// import from the ignored city directory — Vercel builds from the GitHub clone,
// where that directory does not exist. app/city/explore/bitflow-tower.ts is now
// a thin re-export of this module, so the plaza anchor and the landing showcase
// can never drift apart.
//
// `opts.detail` adds the close-range pass (expressed volume edges + cantilever
// lips). The city never turns it on; the landing viewer always does.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

const SEA = 0x00d1ac, SALA = 0xf78116, BLACK = 0x0b0e0b

/** Roof height of the crown band, in city units — the landing viewer frames on it. */
export const BITFLOW_HEIGHT = 332
/** Stacked volumes in the massing (podium · core · 6 setbacks · crown). */
export const BITFLOW_VOLUMES = 9

// ── Bitflow pixel-wave mark — traced from the official logomark (1 = filled) ──
// Used for the glowing 3D rooftop icon.
const MARK: number[][] = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
]
const MROWS = MARK.length, MCOLS = MARK[0].length

// deterministic hash → stable per-cell randomness (no per-frame alloc)
function rnd(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return n - Math.floor(n)
}

// ── Warm glass-floor facade — dark glass, strong horizontal floor slabs, mostly
// amber-lit interiors with a little cool white, few dark. `bright` boosts the
// lit ratio for the hero core. Baked once → emissiveMap. flipY: canvas y=0 is
// the building TOP. ──────────────────────────────────────────────────────────
const texCache = new Map<string, THREE.CanvasTexture>()
function glassTex(cols: number, rows: number, bright: number, calm: boolean): THREE.CanvasTexture {
  const key = `g${cols}x${rows}x${bright}${calm ? 'c' : ''}`
  const hit = texCache.get(key); if (hit) return hit
  const S = 512
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#070809'; ctx.fillRect(0, 0, S, S)
  const cw = S / cols, ch = S / rows
  // ── density is the whole difference between the two modes ──────────────────
  // At city distance a volume is 30 px tall and the façade's only job is to say
  // BITFLOW in brand colour from across the plaza, so ~2 cells in 3 are lit at
  // full salamander/sea. Put the same texture in front of a showcase camera and
  // that reads as a quilt, not a curtain wall: no glass, no depth, no building.
  // `calm` keeps the palette exactly — no new hues — and only thins it out, so
  // roughly one bay in three is lit, each at its own brightness. The tower stays
  // unmistakably Bitflow (LED spine, crown frame, rooftop mark, both signs) and
  // starts reading as architecture.
  const litP = calm ? 0.24 + bright * 0.14 : 0.62 + bright * 0.28
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = rnd(c + 1, r + 1)
      let col: string
      if (k < litP) {
        // Strict BitFlow palette — true salamander orange + sea-green. Read as a
        // diffuse map (below) so daylight keeps them saturated like the icon.
        const sea = rnd(r + 7, c + 2) >= 0.56
        if (calm) {
          // same two hues, varied in level so a lit bay reads as a room with a
          // light in it rather than a swatch of poster colour
          const b2 = 0.55 + rnd(c + 3, r + 5) * 0.45
          col = sea
            ? `rgb(${Math.round(0 * b2)},${Math.round(209 * b2)},${Math.round(172 * b2)})`
            : `rgb(${Math.round(247 * b2)},${Math.round(129 * b2)},${Math.round(22 * b2)})`
        } else col = sea ? '#00d1ac' : '#f78116'
      } else col = calm ? '#090d13' : '#0c1016'
      ctx.fillStyle = col
      ctx.fillRect(c * cw + 1.5, r * ch + 2.5, cw - 3, ch - 5)
    }
  }
  // dark floor slabs (strong horizontal rhythm) + thin mullions
  ctx.fillStyle = '#050607'
  for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * ch - 1.5, S, 3)
  ctx.fillStyle = '#1a1e24'
  for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw - 0.7, 0, 1.4, S)
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace   // used as diffuse map + emissiveMap
  texCache.set(key, tex); return tex
}

// ── Pixel-dither perforated panel — near-black with a sparse scatter of glowing
// orange (and a whisper of sea-green) pixels, the brand's dither motif. ───────
function ditherTex(cols: number, rows: number): THREE.CanvasTexture {
  const key = `d${cols}x${rows}`
  const hit = texCache.get(key); if (hit) return hit
  const S = 512
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, S, S)
  const cw = S / cols, ch = S / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = rnd(c * 2 + 1, r * 3 + 1)
      if (k > 0.26) continue
      const bright = 0.45 + rnd(r + 9, c + 4) * 0.55
      const sea = rnd(c + 6, r + 8) < 0.34   // healthy mix of sea-green with orange
      const rr = Math.round((sea ? 0 : 247) * bright)
      const g = Math.round((sea ? 209 : 129) * bright)
      const bb = Math.round((sea ? 172 : 22) * bright)
      ctx.fillStyle = `rgb(${rr},${g},${bb})`
      ctx.fillRect(c * cw + cw * 0.28, r * ch + ch * 0.28, cw * 0.44, ch * 0.44)
    }
  }
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, tex); return tex
}

// ── Official BITFLOW lockup from /Bitflow.png — the WHOLE mark + wordmark, laid
// out and centred exactly as the brand ships it. We only key out the white
// background (alpha ramp) and keep the original colours (orange mark + cream
// wordmark), so nothing has to be hand-aligned. Async → onReady(tex, aspect).
function loadFullLogo(onReady: (tex: THREE.CanvasTexture, aspect: number) => void) {
  const img = new Image(); img.crossOrigin = 'anonymous'
  img.onload = () => {
    const w = img.width, h = img.height
    const src = document.createElement('canvas'); src.width = w; src.height = h
    const sc = src.getContext('2d')!; sc.drawImage(img, 0, 0)
    const d = sc.getImageData(0, 0, w, h).data
    const avg = (i: number) => (d[i] + d[i + 1] + d[i + 2]) / 3
    const ink = (i: number) => d[i + 3] > 40 && avg(i) < 246   // anything not near-white
    // tight bbox of the whole logo (mark + wordmark)
    let minx = w, miny = h, maxx = 0, maxy = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (ink(i)) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y }
    }
    const pad = Math.round((maxy - miny) * 0.06)   // small even breathing room
    minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad)
    maxx = Math.min(w - 1, maxx + pad); maxy = Math.min(h - 1, maxy + pad)
    const bw = Math.max(1, maxx - minx + 1), bh = Math.max(1, maxy - miny + 1)
    const out = document.createElement('canvas'); out.width = bw; out.height = bh
    const oc = out.getContext('2d')!; const od = oc.createImageData(bw, bh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const si = ((y + miny) * w + (x + minx)) * 4, oi = (y * bw + x) * 4
      const a2 = avg(si)
      let a = (250 - a2) / 12; a = a < 0 ? 0 : a > 1 ? 1 : a   // white → transparent, soft edge
      od.data[oi] = d[si]; od.data[oi + 1] = d[si + 1]; od.data[oi + 2] = d[si + 2]   // keep brand colours
      od.data[oi + 3] = Math.round(a * 255 * (d[si + 3] / 255))
    }
    oc.putImageData(od, 0, 0)
    const tex = new THREE.CanvasTexture(out); tex.anisotropy = 16; tex.minFilter = THREE.LinearMipmapLinearFilter
    onReady(tex, bw / bh)
  }
  img.src = '/Bitflow.png'
}

export function buildBitflowTower(
  b: { x: number; z: number; w: number; d: number; face: number },
  opts: { detail?: boolean } = {},
): { group: THREE.Group; animate: (t: number) => void; setDaylight: (day: number) => void } {
  const detail = opts.detail === true
  const group = new THREE.Group()
  group.position.set(b.x, 4, b.z)
  group.rotation.y = b.face          // north anchor: face = π → local +Z faces plaza

  const capMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.7, metalness: 0.3 })
  const darkMat = new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.55, metalness: 0.4 })
  const ledMat = new THREE.MeshBasicMaterial({ color: SALA, toneMapped: false })
  const warmGlow = new THREE.MeshBasicMaterial({ color: SALA, toneMapped: false, transparent: true, opacity: 0.7, side: THREE.DoubleSide })

  const glassMatCache = new Map<string, THREE.MeshStandardMaterial>()
  const facadeMat = (type: 'glass' | 'dither', cols: number, rows: number, bright: number) => {
    const key = `${type}${cols}x${rows}x${bright}${detail ? 'c' : ''}`
    const hit = glassMatCache.get(key); if (hit) return hit
    const tex = type === 'glass' ? glassTex(cols, rows, bright, detail) : ditherTex(cols, rows)
    // Same texture as BOTH a diffuse map and the emissive map: daylight lights the
    // diffuse colours so orange reads as the true #F78116 salamander (like the 3D
    // icon), while the emissive only makes them GLOW after dark. Matte + low metal
    // so the sky doesn't mirror-wash the colour to yellow.
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: tex,
      roughness: type === 'glass' ? 0.42 : 0.62,
      metalness: type === 'glass' ? 0.12 : 0.1,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.65,
    })
    glassMatCache.set(key, m); return m
  }

  // ── A stacked volume: BoxGeometry + 6-material array (window scale stays
  // right on wide and narrow faces alike). Returns the mesh. ─────────────────
  const litMats: THREE.MeshStandardMaterial[] = []
  const addVol = (type: 'glass' | 'dither', cx: number, cz: number, w: number, h: number, d: number, yBase: number, bright = 0) => {
    const cols = Math.max(2, Math.round(w / 8)), dcols = Math.max(2, Math.round(d / 8))
    const rows = Math.max(3, Math.round(h / 7))
    const front = facadeMat(type, cols, rows, bright)
    const side = facadeMat(type, dcols, rows, bright)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, capMat, capMat, front, front])
    mesh.position.set(cx, yBase + h / 2, cz)
    mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh)
    if (type === 'glass') { if (!litMats.includes(front)) litMats.push(front) }

    // ── Close-range pass (landing showcase only) ─────────────────────────────
    // The massing is nine textured boxes. At plaza distance that reads as a
    // cantilevered stack; at showcase distance it reads as nine textured boxes,
    // because every volume meets the next with a hairline seam and nothing
    // catches light along the edges. Two additions fix the silhouette: corner
    // mullions standing proud of the glass (the structure the stack hangs on)
    // and a slab lip capping each volume, which is what actually makes a
    // cantilever read as a cantilever — the shadow it throws on the box below.
    if (detail) {
      const mull = new THREE.BoxGeometry(2.4, h, 2.4)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(mull, darkMat)
        m.position.set(cx + sx * (w / 2), yBase + h / 2, cz + sz * (d / 2))
        m.castShadow = true
        group.add(m)
      }
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 5, 2.6, d + 5), darkMat)
      lip.position.set(cx, yBase + h, cz)
      lip.castShadow = true
      group.add(lip)
    }
    return mesh
  }

  // ══ Massing — a cantilevered "jenga" stack around a bright glass core ═══════
  const HD = b.d / 2
  //      type      cx    cz    w    h    d    yBase  bright
  addVol('glass',    0,    0,  172,  48,  80,   0,   0.15)   // podium (entrance below)
  const CORE_H = 250, CORE_D = 62, CORE_W = 64, CORE_X = 8
  const core = addVol('glass', CORE_X, 0, CORE_W, CORE_H, CORE_D, 44, 1.0)  // hero glass spine
  void core
  addVol('dither', -58,  6,   68,  76,  68,  48)            // left-low perforated
  addVol('glass',   56, -2,   72,  92,  74,  48,  0.3)      // right-low glass
  addVol('glass',  -54,  3,   74,  78,  72, 126,  0.3)      // left-mid glass
  addVol('dither',  58,  5,   66,  62,  66, 150)            // right-mid perforated
  const leftHigh = addVol('dither', -48, 2, 66, 60, 64, 206) // left-high perforated (rooftop garden atop)
  void leftHigh
  addVol('glass',   52,  1,   70,  66,  68, 214,  0.3)      // right-high glass
  const CROWN_Y = 290, CROWN_H = 42, CROWN_W = 150, CROWN_D = 78, CROWN_X = 10
  const crown = addVol('glass', CROWN_X, 0, CROWN_W, CROWN_H, CROWN_D, CROWN_Y, 0.2) // crown (sign band)
  void crown
  const crownTop = CROWN_Y + CROWN_H
  const crownFrontZ = CROWN_D / 2

  // ── Orange LED accents — vertical spine up the core + crown roof outline ────
  const coreFrontZ = CORE_D / 2
  const ledSpine = new THREE.Mesh(new THREE.BoxGeometry(5, CORE_H + CROWN_H, 1.2), ledMat)
  ledSpine.position.set(CORE_X - 20, 44 + (CORE_H + CROWN_H) / 2, coreFrontZ + 0.8)
  group.add(ledSpine)
  const ledSpine2 = new THREE.Mesh(new THREE.BoxGeometry(3, CORE_H, 1.2), ledMat)
  ledSpine2.position.set(CORE_X + 22, 44 + CORE_H / 2, coreFrontZ + 0.8)
  group.add(ledSpine2)
  // crown roof outline (rectangle frame of thin LED bars)
  const roofY = crownTop + 1
  for (const [w, h, x, y] of [
    [CROWN_W, 2.4, CROWN_X, roofY],                       // top
    [CROWN_W, 2.4, CROWN_X, CROWN_Y - 1],                 // bottom of crown band
    [2.4, CROWN_H + 2, CROWN_X - CROWN_W / 2, (CROWN_Y + roofY) / 2],
    [2.4, CROWN_H + 2, CROWN_X + CROWN_W / 2, (CROWN_Y + roofY) / 2],
  ] as [number, number, number, number][]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.4), ledMat)
    bar.position.set(x, y, crownFrontZ + 0.7)
    group.add(bar)
  }

  // ══ BITFLOW sign — the official lockup, centred to fit the crown plate ══════
  // One plane holding the whole mark+wordmark; on load we size it to the plate's
  // usable box (with margins) and centre it, so it never sits off to one side
  // or runs off the edge.
  const signPlate = new THREE.Mesh(new THREE.BoxGeometry(CROWN_W - 20, CROWN_H - 8, 1.6), darkMat)
  signPlate.position.set(CROWN_X, CROWN_Y + CROWN_H / 2, crownFrontZ + 0.6)
  group.add(signPlate)
  // mkLogo: centres the official lockup inside a (fitW × fitH) box at (cx,cy,z).
  const mkLogo = (fitW: number, fitH: number, cx: number, cy: number, z: number) => {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, side: THREE.DoubleSide, opacity: 0 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    mesh.position.set(cx, cy, z); mesh.visible = false
    group.add(mesh)
    loadFullLogo((tex, aspect) => {
      mat.map = tex; mat.opacity = 1; mat.needsUpdate = true
      let width = fitW, height = fitW / aspect
      if (height > fitH) { height = fitH; width = fitH * aspect }   // clamp to the plate height
      mesh.scale.set(width, height, 1); mesh.visible = true
    })
    return mesh
  }
  const signY = CROWN_Y + CROWN_H / 2, signZ = crownFrontZ + 1.6
  mkLogo((CROWN_W - 20) * 0.86, (CROWN_H - 8) * 0.72, CROWN_X, signY, signZ)

  // ── Glowing ground entrance — orange portal frame + lobby + sign ────────────
  // portal kept low (0→26) so the entrance sign sits in a clear band (30→46)
  // below the podium top (48) — nothing above clips it.
  const podFrontZ = HD
  const portalW = 46, portalH = 26
  for (const [w, h, x, y] of [
    [portalW + 4, 3, 0, portalH],
    [3, portalH, -portalW / 2, portalH / 2],
    [3, portalH, portalW / 2, portalH / 2],
  ] as [number, number, number, number][]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), ledMat)
    bar.position.set(x, y, podFrontZ + 0.8); group.add(bar)
  }
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(portalW - 4, portalH - 3), warmGlow)
  lobby.position.set(0, portalH / 2 - 1, podFrontZ + 0.3); group.add(lobby)
  const entryPlate = new THREE.Mesh(new THREE.BoxGeometry(92, 15, 1.4), darkMat)
  entryPlate.position.set(0, 38, podFrontZ + 0.5); group.add(entryPlate)
  mkLogo(92 * 0.86, 15 * 0.72, 0, 38, podFrontZ + 1.4)

  // ── Rooftop garden — setback terrace with greenery atop the left-high box ───
  const gardenMat = new THREE.MeshStandardMaterial({ color: 0x1f7a4a, roughness: 0.85, emissive: 0x0a3a20, emissiveIntensity: 0.4 })
  const planter = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 58), darkMat)
  planter.position.set(-48, 268, 2); group.add(planter)
  const shrubGeo = new THREE.IcosahedronGeometry(5, 0)
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(shrubGeo, gardenMat)
    s.position.set(-70 + (i % 4) * 15 + rnd(i, 1) * 4, 272, -14 + Math.floor(i / 4) * 20 + rnd(i, 2) * 4)
    s.scale.setScalar(0.7 + rnd(i, 3) * 0.6)
    group.add(s)
  }

  // ══ 3D pixel-wave ICON crowning the roof — glowing salamander, the brand mark
  // built at architectural scale. Emissive so it glows on its own; setDaylight
  // pushes the glow hard after dark (the user's "à noite tem que brilhar"). ════
  const ICON_CELL = 4.7, ICON_GAP = 0.7, ICON_DEPTH = 5.5
  let iconCells = 0
  for (let r = 0; r < MROWS; r++) for (let c = 0; c < MCOLS; c++) if (MARK[r][c]) iconCells++
  const iconMat = new THREE.MeshStandardMaterial({ color: SALA, emissive: SALA, emissiveIntensity: 1.4, roughness: 0.32, metalness: 0.25 })
  const icon = new THREE.InstancedMesh(new THREE.BoxGeometry(ICON_CELL - ICON_GAP, ICON_CELL - ICON_GAP, ICON_DEPTH), iconMat, iconCells)
  const iconW = MCOLS * ICON_CELL, iconH = MROWS * ICON_CELL
  const iconX = CROWN_X, iconBaseY = crownTop + 9, iconZ = 4
  const dummy = new THREE.Object3D()
  let ii = 0
  for (let r = 0; r < MROWS; r++) for (let c = 0; c < MCOLS; c++) {
    if (!MARK[r][c]) continue
    dummy.position.set(
      iconX + c * ICON_CELL - iconW / 2 + ICON_CELL / 2,
      iconBaseY + (iconH - r * ICON_CELL) - ICON_CELL / 2,
      iconZ,
    )
    dummy.updateMatrix(); icon.setMatrixAt(ii++, dummy.matrix)
  }
  icon.instanceMatrix.needsUpdate = true
  icon.castShadow = true
  group.add(icon)
  // slim dark stand raising the icon off the roof
  const iconStand = new THREE.Mesh(new THREE.BoxGeometry(iconW + 10, 6, 14), darkMat)
  iconStand.position.set(iconX, crownTop + 4, iconZ)
  group.add(iconStand)

  // ── Lights (budget: 4) — warm core · entrance · crown halo · rooftop icon ───
  const coreLight = new THREE.PointLight(0xff8a2a, 1.3, 260, 2)
  coreLight.position.set(CORE_X, 44 + CORE_H * 0.6, coreFrontZ + 30)
  group.add(coreLight)
  const entryLight = new THREE.PointLight(SALA, 0.9, 130, 2)
  entryLight.position.set(0, 24, podFrontZ + 18)
  group.add(entryLight)
  const crownLight = new THREE.PointLight(SALA, 0.8, 200, 2)
  crownLight.position.set(CROWN_X, signY, crownFrontZ + 26)
  group.add(crownLight)
  const iconLight = new THREE.PointLight(SALA, 1.0, 170, 2)
  iconLight.position.set(iconX, iconBaseY + iconH / 2, iconZ + 26)
  group.add(iconLight)

  void SEA
  // ── Daylight gate — the rooftop icon blazes at night, calmer by day ─────────
  let nightF = 1   // 1 = night … 0 = full day
  const setDaylight = (day: number) => { nightF = 1 - Math.min(1, Math.max(0, day)) }

  // ── Animation (zero per-frame allocations) — warm interior life + LED pulse ─
  const animate = (t: number) => {
    // diffuse map carries the daytime colour; emissive kept low so night glow
    // reads without ACES pushing the bright orange to yellow.
    const flick = 0.6 + 0.06 * Math.sin(t * 2.3)
    for (let i = 0; i < litMats.length; i++) litMats[i].emissiveIntensity = flick
    const pulse = 0.85 + 0.15 * (0.5 + 0.5 * Math.sin(t * 1.4))
    ledMat.color.setRGB(0.969 * pulse + 0.03, 0.506 * pulse + 0.02, 0.086 * pulse)
    coreLight.intensity = 1.25 + 0.15 * Math.sin(t * 1.1)
    crownLight.intensity = 0.75 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.4))
    // rooftop icon — glow scales with night, gentle shimmer + float
    const glow = 0.6 + 1.5 * nightF
    iconMat.emissiveIntensity = glow * (0.9 + 0.1 * Math.sin(t * 1.6))
    iconLight.intensity = (0.3 + 1.2 * nightF) * (0.9 + 0.1 * Math.sin(t * 1.6))
    icon.position.y = Math.sin(t * 0.7) * 1.6
  }

  return { group, animate, setDaylight }
}
