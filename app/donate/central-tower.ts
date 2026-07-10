// ═══════════════════════════════════════════════════════════════════════════
// Central Tower — modern "Needle" (Satoshi Plaza dead-centre landmark)
// The literal heart of DogCity, reimagined as a sleek crypto-age observation
// tower: a smooth hour-glass glass shaft with three brushed-metal legs sweeping
// from a splayed base to a pinched waist, crowned by a WIDE observation deck
// whose rim is one big circular LED band reading "DOG • GO • TO • THE • MOON"
// (large, generously spaced, wrapping the ring so you read the near face and the
// solid core hides the far side), a glass top-house dome, and a slim antenna
// mast with a small aircraft beacon. Rules the sky at ~500.
// Built in local space (base at y=0); caller places the group at the plaza slab
// top (y=4) and drives animate(t). Zero per-frame allocations.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

const WORDS = ['DOG', 'GO', 'TO', 'THE', 'MOON']  // joined by a round glowing middot

// ── Modern shaft skin — dark glass with thin vertical neon pinstripes ────────
function makeShaftTexture(): THREE.CanvasTexture {
  const W = 512, H = 512, LINES = 26
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#070810'; ctx.fillRect(0, 0, W, H)
  const step = W / LINES
  for (let i = 0; i < LINES; i++) {
    const x = i * step + step / 2
    // most lines a cool dark-steel, an occasional warm gold accent line
    const warm = i % 5 === 2
    ctx.fillStyle = warm ? '#ffbe66' : '#38506e'
    ctx.shadowColor = warm ? 'rgba(255,190,102,0.8)' : 'rgba(90,130,180,0.5)'
    ctx.shadowBlur = warm ? 10 : 5
    ctx.fillRect(x - (warm ? 2 : 1.2), 6, warm ? 4 : 2.4, H - 12)
  }
  // faint horizontal floor ticks
  ctx.shadowBlur = 0; ctx.fillStyle = '#101725'
  for (let r = 0; r <= 18; r++) ctx.fillRect(0, (r / 18) * H - 1, W, 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

// ── Circular LED marquee — big, wide-spaced "DOG • GO • TO • THE • MOON •" ────
// One full phrase wraps the ring once (repeat 1) so every letter is large; words
// in warm gold, separators the glowing white round middot of the KRAY•SPACE lockup.
function makeRingTexture(): THREE.CanvasTexture {
  const H = 200
  const gap = 120, dotR = 15, tracking = 14
  const meas = document.createElement('canvas').getContext('2d')!
  const font = '800 132px "Helvetica Neue", Arial, sans-serif'
  meas.font = font
  try { (meas as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${tracking}px` } catch { /* noop */ }
  const wordW = WORDS.map(w => meas.measureText(w).width + tracking * (w.length - 1))
  let cycle = 0
  for (const w of wordW) cycle += w + gap + dotR * 2 + gap
  const W = Math.max(16, Math.ceil(cycle))

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#05060b'; ctx.fillRect(0, 0, W, H)
  ctx.font = font
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${tracking}px` } catch { /* noop */ }
  const cy = H / 2 + 3
  let x = 0
  for (let i = 0; i < WORDS.length; i++) {
    ctx.shadowColor = 'rgba(255,194,77,0.95)'; ctx.fillStyle = '#FFC24D'
    for (const blur of [30, 14]) { ctx.shadowBlur = blur; ctx.fillText(WORDS[i], x, cy) }
    x += wordW[i] + gap
    ctx.shadowColor = 'rgba(230,240,255,0.95)'; ctx.fillStyle = '#f2f7ff'
    for (const blur of [26, 10]) {
      ctx.shadowBlur = blur
      ctx.beginPath(); ctx.arc(x + dotR, cy, dotR, 0, Math.PI * 2); ctx.fill()
    }
    x += dotR * 2 + gap
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(1, 1)            // one big phrase wraps the whole ring
  tex.anisotropy = 8
  return tex
}

// Soft radial halo for the antenna beacon.
function makeGlowTexture(): THREE.CanvasTexture {
  const S = 128
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,235,190,0.95)')
  g.addColorStop(0.4, 'rgba(255,190,110,0.4)')
  g.addColorStop(1, 'rgba(255,190,110,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(canvas)
}

export function buildCentralTower(
  opts: { x: number; z: number; base: number; height: number },
): { group: THREE.Group; animate: (t: number) => void } {
  const group = new THREE.Group()
  group.position.set(opts.x, 4, opts.z)   // base sits on the plaza slab top

  const H = opts.height, B = opts.base

  // ── Smooth hour-glass shaft profile (radius by height fraction) ───────────
  const CP: [number, number][] = [
    [0.00, 0.92], [0.05, 0.78], [0.16, 0.46], [0.34, 0.29],  // splay → waist
    [0.50, 0.33], [0.62, 0.42], [0.68, 0.40],                // neck under the deck
  ]
  const rAt = (h: number): number => {
    if (h <= CP[0][0]) return CP[0][1] * B
    if (h >= CP[CP.length - 1][0]) return CP[CP.length - 1][1] * B
    for (let i = 0; i < CP.length - 1; i++) {
      const [h0, s0] = CP[i], [h1, s1] = CP[i + 1]
      if (h >= h0 && h <= h1) {
        const t = (h - h0) / (h1 - h0), ts = t * t * (3 - 2 * t)
        return (s0 + (s1 - s0) * ts) * B
      }
    }
    return CP[CP.length - 1][1] * B
  }
  const SHAFT_TOP = 0.68

  // ── Shared materials ─────────────────────────────────────────────────────
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x0d1017, roughness: 0.3, metalness: 0.85, emissive: 0x2b3646, emissiveIntensity: 0.28,
  })
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xc4ccd8, roughness: 0.28, metalness: 0.9, emissive: 0x8a94a6, emissiveIntensity: 0.22,
  })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0e1c2e, roughness: 0.12, metalness: 0.6, transparent: true, opacity: 0.55,
    emissive: 0x123246, emissiveIntensity: 0.5, side: THREE.DoubleSide,
  })

  // ── Base plinth + warm ground ring ────────────────────────────────────────
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(B * 1.5, B * 1.7, H * 0.022, 48), metalMat)
  plinth.position.y = H * 0.011
  group.add(plinth)
  const baseRing = new THREE.Mesh(
    new THREE.CylinderGeometry(B * 1.3, B * 1.3, H * 0.006, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xFFA63a, toneMapped: false, side: THREE.DoubleSide }),
  )
  baseRing.position.y = H * 0.026
  group.add(baseRing)

  // ── Glass shaft (lathe of the hour-glass profile) ─────────────────────────
  const RINGS = 40
  const latheePts: THREE.Vector2[] = []
  for (let i = 0; i <= RINGS; i++) {
    const h = SHAFT_TOP * (i / RINGS)
    latheePts.push(new THREE.Vector2(Math.max(0.6, rAt(h)), h * H))
  }
  const shaftTex = makeShaftTexture()
  shaftTex.repeat.set(6, 3)
  const shaft = new THREE.Mesh(
    new THREE.LatheGeometry(latheePts, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0a0c13, roughness: 0.22, metalness: 0.8,
      emissive: 0xffffff, emissiveMap: shaftTex, emissiveIntensity: 0.85, side: THREE.DoubleSide,
    }),
  )
  shaft.castShadow = true
  group.add(shaft)

  // ── Three brushed-metal legs sweeping base → waist → deck ─────────────────
  const legMat = silverMat
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6
    const ca = Math.cos(a), sa = Math.sin(a)
    const pts: THREE.Vector3[] = []
    const N = 16
    for (let j = 0; j <= N; j++) {
      const h = SHAFT_TOP * (j / N)
      const rr = rAt(h) * 1.08 + 1.5
      pts.push(new THREE.Vector3(ca * rr, h * H, sa * rr))
    }
    const leg = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, B * 0.06, 6, false),
      legMat,
    )
    leg.castShadow = true
    group.add(leg)
  }

  // ── Observation deck (the hero) + big circular LED band ───────────────────
  const rNeck = rAt(SHAFT_TOP)
  const rDeck = B * 1.7
  const deckY0 = SHAFT_TOP * H
  // flared underside
  const underside = new THREE.Mesh(
    new THREE.CylinderGeometry(rDeck, rNeck * 1.1, H * 0.03, 64), metalMat,
  )
  underside.position.y = deckY0 + H * 0.015
  group.add(underside)
  // dark core so the far LED face never shows through
  const bandY = deckY0 + H * 0.03 + H * 0.032
  const bandH = H * 0.062
  const core = new THREE.Mesh(new THREE.CylinderGeometry(rDeck - 2.4, rDeck - 2.4, bandH * 1.15, 48), metalMat)
  core.position.y = bandY
  group.add(core)
  // the LED band
  const ringTex = makeRingTexture()
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(rDeck, rDeck, bandH, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: ringTex, side: THREE.FrontSide, toneMapped: false }),
  )
  band.position.y = bandY
  group.add(band)
  // bright rims framing the band
  for (const dy of [-bandH / 2 - 1.4, bandH / 2 + 1.4]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rDeck + 0.6, 1.6, 10, 72), silverMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = bandY + dy
    group.add(rim)
  }
  // glass top-house tapering in above the band
  const houseY0 = bandY + bandH / 2
  const house = new THREE.Mesh(
    new THREE.CylinderGeometry(B * 0.85, rDeck * 0.98, H * 0.03, 64), glassMat,
  )
  house.position.y = houseY0 + H * 0.015
  group.add(house)
  // domed cap
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(B * 0.85, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glassMat,
  )
  dome.position.y = houseY0 + H * 0.03
  group.add(dome)

  // ── Slim antenna mast + aircraft beacon ───────────────────────────────────
  const mastBot = houseY0 + H * 0.03
  const mastTop = H * 0.96
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, B * 0.14, mastTop - mastBot, 12), silverMat,
  )
  mast.position.y = (mastBot + mastTop) / 2
  group.add(mast)
  const beaconY = mastTop + 3
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }),
  )
  beacon.position.y = beaconY
  group.add(beacon)
  const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffd27a, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }))
  beaconGlow.scale.setScalar(B * 0.9)
  beaconGlow.position.y = beaconY
  group.add(beaconGlow)

  // ── Lights (budget: 2) — deck glow + warm base uplight ────────────────────
  const deckLight = new THREE.PointLight(0xFFC24D, 1.3, H * 0.8, 2)
  deckLight.position.y = bandY
  group.add(deckLight)
  const uplight = new THREE.PointLight(0xFFA63a, 0.7, B * 5, 2)
  uplight.position.y = H * 0.04
  group.add(uplight)

  // ── Animation ─────────────────────────────────────────────────────────────
  const animate = (t: number) => {
    ringTex.offset.x = (t * 0.025) % 1        // LED ticker drifts steadily around the ring
    const blink = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3.0))   // aircraft-warning pulse
    ;(beacon.material as THREE.MeshBasicMaterial).opacity = blink
    ;(beaconGlow.material as THREE.SpriteMaterial).opacity = 0.5 + 0.5 * blink
    beaconGlow.scale.setScalar(B * (0.8 + 0.25 * blink))
    deckLight.intensity = 1.2 + 0.25 * Math.sin(t * 1.1)
  }

  return { group, animate }
}
