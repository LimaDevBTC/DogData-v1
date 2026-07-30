"use client"

// ═══════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL PARTNERS — the anchor-lot viewer.
//
// One WebGL canvas showing one site at a time, presented the way an architecture
// office presents a building: a single subject on its own ground, a studio rig
// and a real cast shadow.
//
// What loads is a Blender-modelled, Draco-compressed GLB of the WHOLE SITE —
// building plus its planned garden, paving, kerbs, street and cars (blender/
// build_*.py, briefed by blender/SPEC-anchor-buildings.md). The procedural
// builders in lib/city/towers/* are still here, but their job changed: they are
// the city's LOD and this viewer's FALLBACK. If a GLB fails to fetch or decode,
// the plate shows a procedural tower rather than nothing.
//
// Two levels of detail for two distances is deliberate, not duplication: at city
// range a tower is thirty pixels and a procedural mesh is right; at showcase
// range you can read the mullions, and only modelled geometry survives that.
//
// House rules this file obeys, all of them learned in this repo:
//   · raw Three.js, never react-three-fiber (it crashes against our React)
//   · WebGL boots on an IntersectionObserver 400px out and hard-stops offscreen
//   · wheel is swallowed BEFORE OrbitControls registers, so page scroll is
//     never trapped; pinch-zoom and the ± buttons survive
//   · zero per-frame allocation, one rAF, one renderer
//   · towers are built lazily on first selection and cached — switching is a
//     visibility toggle plus a camera tween, never a rebuild
//
// The camera is fitted from the model's own bounding box rather than hand-typed
// distances, so the framing survives any future change to either building.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import type * as THREE_NS from "three"
import { SITES, type SiteKey } from "./partners-data"

// The tower builders place their group at y = 4 (the plaza slab top in the
// city). Here the pad IS the ground, so each holder is pushed down by that.
const PLAZA_SLAB = 4

// Camera tween length when switching partners, in seconds.
const TWEEN = 0.9

// ── the lot pad ────────────────────────────────────────────────────────────
// One textured disc carrying the ground, the set-out grid and the lot outline,
// baked once and shared by both partners.
//
// It is OPAQUE and its albedo ramps to pure black at the rim. The page behind
// is #000, so the disc has no visible edge — but unlike a transparent plane it
// costs nothing in the sort order and, more importantly, the centre stays dark
// charcoal rather than black, which is the only reason the tower's cast shadow
// is visible at all. A pure-black ground receives a pure-black shadow.
//
// The first version of this used PolarGridHelper in lava over a mid-grey disc.
// It read as a Tron floor: the ground was brighter than the building standing
// on it and the orange spokes pulled the eye off the subject. Everything here
// is a drafting line — dim, thin, and quieter than what it measures.
function makePadTexture(doc: Document): HTMLCanvasElement {
  const S = 1024, C = S / 2
  const cv = doc.createElement("canvas")
  cv.width = S; cv.height = S
  const ctx = cv.getContext("2d")!

  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, S, S)
  // The ramp reaches pure black at 0.66 of the radius, not at the rim. A ground
  // plane seen from 17° above the horizon compresses its whole outer third into
  // a few pixels, so a fade that is still mid-grey at 0.9 does not read as a
  // fade — it reads as a hard elliptical edge cutting across the frame, which
  // is precisely what the first version did. Ending the ramp early costs pad
  // that was never legible anyway and buys a horizon that genuinely dissolves.
  const g = ctx.createRadialGradient(C, C, 0, C, C, C)
  g.addColorStop(0, "#1a1d22")
  g.addColorStop(0.22, "#14171c")
  g.addColorStop(0.40, "#0b0d11")
  g.addColorStop(0.56, "#040508")
  g.addColorStop(0.66, "#000000")
  g.addColorStop(1, "#000000")
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(C, C, C, 0, Math.PI * 2); ctx.fill()

  // concentric set-out rings
  ctx.lineWidth = 1.4
  ctx.strokeStyle = "rgba(240,240,242,0.09)"
  for (const r of [0.08, 0.15, 0.22, 0.30, 0.38]) {
    ctx.beginPath(); ctx.arc(C, C, C * r, 0, Math.PI * 2); ctx.stroke()
  }
  // radial ticks, every 15°, stopping short of the middle
  ctx.lineWidth = 1
  ctx.strokeStyle = "rgba(240,240,242,0.055)"
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(C + Math.cos(a) * C * 0.09, C + Math.sin(a) * C * 0.09)
    ctx.lineTo(C + Math.cos(a) * C * 0.41, C + Math.sin(a) * C * 0.41)
    ctx.stroke()
  }

  // the anchor lot — the one lava line on the ground, with corner ticks
  const h = C * 0.20
  ctx.strokeStyle = "rgba(245,110,15,0.42)"
  ctx.lineWidth = 2
  ctx.strokeRect(C - h, C - h, h * 2, h * 2)
  ctx.strokeStyle = "rgba(245,110,15,0.85)"
  ctx.lineWidth = 3.5
  const tick = C * 0.045
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const x = C + sx * h, y = C + sy * h
    ctx.beginPath()
    ctx.moveTo(x - sx * tick, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * tick)
    ctx.stroke()
  }
  return cv
}

interface Built {
  holder: THREE_NS.Group
  animate: (t: number) => void
  /**
   * What the camera has to cover, measured off the model rather than typed in:
   * the vertical half-extent around `targetY` and the horizontal half-extent.
   * Two numbers instead of one radius because these are 4:1 towers — a single
   * bounding radius fits the diagonal and leaves the building tiny in a 16:9
   * plate, and fitting the height alone clips the crown on a narrow viewport.
   */
  fit: { targetY: number; halfV: number; halfH: number }
  /** true when this came from a Blender GLB rather than the procedural fallback */
  isGlb: boolean
}

// Which asset, poster and readout belong to each site lives in SITES
// (./partners-data) so the landing section, this viewer and the local workbench
// all read one table instead of three copies of the same strings.

export default function TowerViewer({ partner }: { partner: SiteKey }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")

  // imperative handles the React tree pokes at after boot
  const selectRef = useRef<((k: SiteKey) => void) | null>(null)
  const zoomRef = useRef<((factor: number) => void) | null>(null)
  const pendingRef = useRef<SiteKey>(partner)

  useEffect(() => {
    pendingRef.current = partner
    selectRef.current?.(partner)
  }, [partner])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let cleanup: (() => void) | null = null

    const boot = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true
          boot.disconnect()
          setStatus("loading")
          init().catch(() => setStatus("error"))
        }
      },
      { rootMargin: "400px" },
    )
    boot.observe(mount)

    async function init() {
      const THREE = await import("three")
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js")
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js")
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js")
      const { buildKrayTower } = await import("@/lib/city/towers/kray")
      const { buildBitflowTower } = await import("@/lib/city/towers/bitflow")
      if (disposed || !mount) return

      // The sites ship Draco-compressed (KHR_draco_mesh_compression), so the
      // loader needs a decoder — served locally from /public/draco, never a CDN.
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath("/draco/")
      const gltfLoader = new GLTFLoader()
      gltfLoader.setDRACOLoader(dracoLoader)

      // shadows are the single biggest cost here and the single biggest gain in
      // "is this an architectural render or a toy". Desktop pays for it; phones
      // get the same rig without the shadow pass.
      const wantShadows = window.innerWidth >= 768

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(34, mount.clientWidth / mount.clientHeight, 1, 6000)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      if (wantShadows) {
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
      }
      mount.appendChild(renderer.domElement)

      // ── environment: dark glass needs something to reflect ──────────────────
      // RoomEnvironment on its own is a bright studio and would wash these
      // near-black façades to grey. three 0.162 has no scene.environmentIntensity,
      // so every material gets its envMapIntensity dialled down individually
      // when the tower is registered below.
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

      // ── studio rig ──────────────────────────────────────────────────────────
      // Deliberately contrasty: both towers are near-black massing carrying
      // emissive glass, so a soft even rig flattens them into a lit texture on
      // a shape. The key does the modelling, the rim cuts the silhouette off
      // the page black, and the lava kick ties the render to the page accent.
      scene.add(new THREE.HemisphereLight(0x2b3446, 0x04050a, 0.42))
      const key = new THREE.DirectionalLight(0xfff0dc, 2.1)
      key.position.set(520, 760, 620)
      if (wantShadows) {
        key.castShadow = true
        key.shadow.mapSize.set(1024, 1024)
        const c = key.shadow.camera
        c.near = 100; c.far = 2400
        c.left = -520; c.right = 520; c.top = 760; c.bottom = -160
        key.shadow.bias = -0.0012
        key.shadow.normalBias = 1.6
      }
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x8fb4e8, 1.05)
      rim.position.set(-620, 420, -540)
      scene.add(rim)
      const kick = new THREE.DirectionalLight(0xf56e0f, 0.45)   // lava kick, page accent
      kick.position.set(180, 60, -700)
      scene.add(kick)

      // ── the lot pad ─────────────────────────────────────────────────────────
      // Unit disc; scaled per partner so the printed lot outline lands around
      // whichever building is standing on it.
      const padTex = new THREE.CanvasTexture(makePadTexture(document))
      padTex.colorSpace = THREE.SRGBColorSpace
      padTex.anisotropy = 8
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(1, 96),
        new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.95, metalness: 0 }),
      )
      pad.rotation.x = -Math.PI / 2
      pad.receiveShadow = wantShadows
      scene.add(pad)

      // ── controls ────────────────────────────────────────────────────────────
      // wheel is swallowed before OrbitControls can bind its own listener
      renderer.domElement.addEventListener("wheel", (e) => e.stopImmediatePropagation(), { passive: true })
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.enableZoom = true             // pinch on touch; wheel blocked above
      controls.minPolarAngle = Math.PI * 0.14
      controls.maxPolarAngle = Math.PI * 0.495   // never dip under the pad
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      controls.autoRotateSpeed = 0.55

      // ── lazy load + cache ───────────────────────────────────────────────────
      const built = new Map<SiteKey, Built>()
      const inflight = new Map<SiteKey, Promise<Built>>()
      const box = new THREE.Box3()
      const mbox = new THREE.Box3()
      const sizeV = new THREE.Vector3()

      const tameEnv = (root: THREE_NS.Object3D) => {
        // tame the studio environment per-material (see the PMREM note above)
        root.traverse((o) => {
          const m = (o as THREE_NS.Mesh).material
          const list = Array.isArray(m) ? m : m ? [m] : []
          for (const mat of list) {
            if ("envMapIntensity" in mat) (mat as THREE_NS.MeshStandardMaterial).envMapIntensity = 0.35
          }
        })
      }

      // ── framing a SITE, not a tower ──────────────────────────────────────────
      // A GLB here is a whole block: the building plus its gardens, paving, kerbs,
      // street and cars. Kray's site is 315 wide against a 379-tall building, so
      // fitting the full bounding box parks the camera out in the next block and
      // leaves the tower a thumbnail in the middle of a car park.
      //
      // The building is the part that is TALL. So the horizontal extent is measured
      // only from geometry reaching above a third of the site's height — the
      // gardens are flat and drop out of that measurement by construction, with no
      // per-building constant to hand-tune and nothing to re-tune if a modeller
      // widens a forecourt later.
      const fitFor = (root: THREE_NS.Object3D): Built["fit"] => {
        box.setFromObject(root)
        const botY = box.min.y, topY = box.max.y
        const cut = botY + (topY - botY) * 0.34
        const tall = new THREE.Box3()
        root.traverse((o) => {
          const m = o as THREE_NS.Mesh
          if (!m.isMesh) return
          mbox.setFromObject(m)
          if (mbox.max.y > cut) tall.union(mbox)
        })
        ;(tall.isEmpty() ? box : tall).getSize(sizeV)
        const targetY = (botY + topY) * 0.5 * 0.92
        return {
          targetY,
          halfV: Math.max(topY - targetY, targetY - botY) * 1.06,
          halfH: Math.max(sizeV.x, sizeV.z) * 0.5 * 1.15,
        }
      }

      // ── the named-node contract ─────────────────────────────────────────────
      // glTF carries no animation here by design. Anything that has to move after
      // export was authored as a separate single-material node with its origin at
      // its own centre, and the viewer drives it. A missing node is not an error —
      // a site simply has fewer moving parts — so every lookup is optional.
      const glbAnimator = (root: THREE_NS.Object3D): ((t: number) => void) => {
        const icon = root.getObjectByName("KRAY_CROWN_ICON")
        const jet = root.getObjectByName("WATER_JET") ?? root.getObjectByName("WATER_JET_RING")
        // BitFlow's LED trim, core strip and portal are each one merged mesh whose
        // geometry is spread over the whole tower, so they must NEVER be
        // transformed — only their emissive level moves. Authored base is ~0.55 and
        // saturated salamander goes pale cream past ~0.9 under ACES, so the pulse
        // is a small multiplier around whatever the asset shipped with.
        const pulses: { m: THREE_NS.MeshStandardMaterial; base: number; rate: number }[] = []
        for (const [name, rate] of [
          ["BITFLOW_LED_TRIM", 1.4], ["BITFLOW_CORE_STRIP", 1.1], ["BITFLOW_PORTAL_GLOW", 0.9],
        ] as const) {
          const o = root.getObjectByName(name) as THREE_NS.Mesh | undefined
          const m = o?.material as THREE_NS.MeshStandardMaterial | undefined
          if (m && "emissiveIntensity" in m) pulses.push({ m, base: m.emissiveIntensity, rate })
        }
        const iconY = icon?.position.y ?? 0
        const jetY = jet?.scale.y ?? 1
        return (t: number) => {
          // the owner's ruling: the Kray symbol keeps spinning above the roof
          if (icon) {
            icon.rotation.y = t * 0.5
            icon.position.y = iconY + Math.sin(t * 0.8) * 1.4
          }
          if (jet) jet.scale.y = jetY * (0.88 + 0.12 * Math.sin(t * 1.4))
          for (const p of pulses) p.m.emissiveIntensity = p.base * (0.88 + 0.12 * Math.sin(t * p.rate))
        }
      }

      const loadGlb = async (k: SiteKey): Promise<Built> => {
        const gltf = await new Promise<{ scene: THREE_NS.Group }>((res, rej) => {
          gltfLoader.load(SITES[k].glb, res as never, undefined, rej)
        })
        const holder = gltf.scene
        tameEnv(holder)
        holder.traverse((o) => {
          const m = o as THREE_NS.Mesh
          if (!m.isMesh) return
          m.castShadow = wantShadows
          m.receiveShadow = wantShadows
        })
        scene.add(holder)
        return { holder, animate: glbAnimator(holder), fit: fitFor(holder), isGlb: true }
      }

      const buildProcedural = (k: SiteKey): Built => {
        if (k === "needle") throw new Error("the Needle has no procedural fallback")
        const holder = new THREE.Group()
        holder.position.y = -PLAZA_SLAB      // building base lands on the pad
        const lot0 = { x: 0, z: 0, w: 175, d: 82, face: 0 }
        let animate: (t: number) => void
        if (k === "kray") {
          const t = buildKrayTower(lot0, { detail: true })
          holder.add(t.group)
          animate = t.animate
        } else {
          const t = buildBitflowTower(lot0, { detail: true })
          holder.add(t.group)
          // Not 0. Full night drives the rooftop mark's emissive to ~2.1, and
          // ACES takes saturated salamander that hot straight to yellow-white —
          // the brand mark stops being the brand colour. Half-night keeps the
          // glow reading as glow while the orange stays orange.
          t.setDaylight(0.45)
          animate = t.animate
        }

        tameEnv(holder)
        scene.add(holder)
        box.setFromObject(holder)
        box.getSize(sizeV)
        // The procedural Kray's crown is a Draco GLB that lands a beat after this
        // measurement, and BitFlow's rooftop mark floats ±1.6 — so the measured
        // top is not the final top. HEADROOM covers both without a second pass.
        // (The GLB path uses fitFor() instead: it has real ground to exclude.)
        const HEADROOM = 1.10
        const targetY = (box.min.y + box.max.y) * 0.5 * 0.92
        return {
          holder,
          animate,
          isGlb: false,
          fit: {
            targetY,
            halfV: Math.max(box.max.y - targetY, targetY - box.min.y) * HEADROOM,
            halfH: Math.max(sizeV.x, sizeV.z) * 0.5 * 1.18,
          },
        }
      }

      // ── one resolver, GLB first ─────────────────────────────────────────────
      // The Blender site is the intent; the procedural builder is the safety net.
      // A failed fetch, a corrupt asset, a browser without the Draco decoder — any
      // of them lands on a tower rather than on an empty plate, and says so once
      // in the console rather than once per frame.
      const get = (k: SiteKey): Promise<Built> => {
        const hit = built.get(k)
        if (hit) return Promise.resolve(hit)
        let p = inflight.get(k)
        if (!p) {
          p = loadGlb(k)
            .catch((err) => {
              if (!SITES[k].fallback) throw err   // the Needle: its poster is the fallback
              console.warn(
                `[partners] ${SITES[k].glb} did not load — falling back to the procedural builder.`,
                err,
              )
              return buildProcedural(k)
            })
            .then((b) => { built.set(k, b); inflight.delete(k); return b })
          inflight.set(k, p)
        }
        return p
      }

      // ── camera fitting + tween ──────────────────────────────────────────────
      const camFrom = new THREE.Vector3()
      const camTo = new THREE.Vector3()
      const tgtFrom = new THREE.Vector3()
      const tgtTo = new THREE.Vector3()
      let tweenT = 1                          // 1 = settled
      let distFor = 0

      // the distance at which BOTH extents clear their own field of view — the
      // binding one wins, so a wide plate stands off for height and a narrow
      // one stands off for width
      const distanceFor = (fit: Built["fit"]) => {
        const vFov = (camera.fov * Math.PI) / 180
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
        return Math.max(fit.halfV / Math.tan(vFov / 2), fit.halfH / Math.tan(hFov / 2))
      }

      const aimAt = (b: Built, instant: boolean) => {
        distFor = distanceFor(b.fit)
        tgtTo.set(0, b.fit.targetY, 0)
        // Three-quarter view, slightly ABOVE the midpoint. Dropping the camera
        // under it looks more dramatic and is wrong: both towers wear a flat
        // rooftop mark (BitFlow's pixel wave, Kray's inscribed icon), and seen
        // from below those resolve into their own bottom faces — the mark stops
        // being a mark and becomes a stack of bars.
        const dir = new THREE.Vector3(0.62, 0.31, 0.72).normalize()
        camTo.copy(tgtTo).addScaledVector(dir, distFor)
        // the near clamp is a legibility guard, not a physical one: these
        // façades are canvas textures tuned for a whole-building view, and
        // close enough to count the pixels they stop reading as glass
        controls.minDistance = distFor * 0.58
        controls.maxDistance = distFor * 1.8
        if (instant) {
          camera.position.copy(camTo)
          controls.target.copy(tgtTo)
          tweenT = 1
        } else {
          camFrom.copy(camera.position)
          tgtFrom.copy(controls.target)
          tweenT = 0
        }
        controls.update()
      }

      let current: SiteKey | null = null
      let firstAim = true
      const select = (k: SiteKey) => {
        // `current` is set BEFORE the await so the render loop animates the right
        // asset the instant it arrives, and so a fast double-click that lands two
        // selects cannot let the slower load win and show the wrong building.
        current = k
        if (!built.has(k)) setStatus("loading")
        get(k).then((b) => {
          if (disposed || current !== k) return
          built.forEach((v, vk) => { v.holder.visible = vk === k })
          // The Blender sites bring their own ground — plaza, paving, kerbs, kerb
          // planting, street. Printing the set-out disc under one of them would be
          // a survey drawing lying on top of finished landscape. So the pad now
          // belongs to the procedural fallback, which has no ground of its own.
          pad.visible = !b.isGlb
          if (!b.isGlb) {
            box.setFromObject(b.holder)
            box.getSize(sizeV)
            // Anything drawn at canvas radius C·f lands at world radius f·scale,
            // and the lot square is printed at f = 0.20 — so scale = 3.2 ×
            // footprint puts the outline at 1.28 × the building's own half-width,
            // a surveyed margin rather than a line jammed against the façade.
            pad.scale.setScalar(Math.max(sizeV.x, sizeV.z) * 3.2)
          }
          aimAt(b, firstAim)
          firstAim = false
          setStatus("ready")
        }).catch(() => {
          // only reachable for a site with no procedural fallback
          if (!disposed && current === k) setStatus("error")
        })
      }
      selectRef.current = select
      select(pendingRef.current)

      zoomRef.current = (factor: number) => {
        const dir = camera.position.clone().sub(controls.target)
        const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, dir.length() * factor))
        dir.setLength(len)
        camera.position.copy(controls.target).add(dir)
        controls.update()
      }

      // ── loop ────────────────────────────────────────────────────────────────
      const clock = new THREE.Clock()
      let raf = 0
      let running = true
      const loop = () => {
        if (!running || disposed) return
        const dt = clock.getDelta()
        const t = clock.elapsedTime

        if (tweenT < 1) {
          tweenT = Math.min(1, tweenT + dt / TWEEN)
          // the page's easing curve, in one line: easeOutQuint
          const e = 1 - Math.pow(1 - tweenT, 5)
          camera.position.lerpVectors(camFrom, camTo, e)
          controls.target.lerpVectors(tgtFrom, tgtTo, e)
        }

        if (current) built.get(current)?.animate(t)
        controls.update()
        renderer.render(scene, camera)
        raf = requestAnimationFrame(loop)
      }
      loop()

      const vis = new IntersectionObserver((es) => {
        const on = es[0].isIntersecting
        if (on && !running) { running = true; clock.getDelta(); loop() }
        else if (!on && running) { running = false; cancelAnimationFrame(raf) }
      })
      vis.observe(mount)

      const onResize = () => {
        if (!mount) return
        camera.aspect = mount.clientWidth / mount.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(mount.clientWidth, mount.clientHeight)
        // the fit is aspect-dependent: a phone in portrait needs to stand back
        if (current) {
          const b = built.get(current)
          if (b) {
            const want = distanceFor(b.fit)
            controls.minDistance = want * 0.42
            controls.maxDistance = want * 1.9
            if (Math.abs(want - distFor) > 1) {
              const dir = camera.position.clone().sub(controls.target).setLength(want)
              camera.position.copy(controls.target).add(dir)
              distFor = want
            }
          }
        }
      }
      window.addEventListener("resize", onResize)

      cleanup = () => {
        running = false
        cancelAnimationFrame(raf)
        vis.disconnect()
        window.removeEventListener("resize", onResize)
        selectRef.current = null
        zoomRef.current = null
        controls.dispose()
        pmrem.dispose()
        dracoLoader.dispose()          // frees the decoder worker pool
        scene.traverse((o) => {
          const mesh = o as THREE_NS.Mesh
          mesh.geometry?.dispose?.()
          const m = mesh.material
          const list = Array.isArray(m) ? m : m ? [m] : []
          for (const mat of list) {
            // GLB materials own packed textures; a material dispose does not free
            // them, and this viewer can mount, unmount and remount as the visitor
            // scrolls the section past. Walk the maps explicitly.
            const anyMat = mat as unknown as Record<string, { isTexture?: boolean; dispose?: () => void }>
            for (const slot of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"]) {
              const tex = anyMat[slot]
              if (tex?.isTexture) tex.dispose?.()
            }
            mat.dispose()
          }
        })
        renderer.dispose()
        if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      }
    }

    return () => {
      disposed = true
      boot.disconnect()
      cleanup?.()
    }
  }, [])

  const site = SITES[partner]

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        className="absolute inset-0"
        role="img"
        aria-label={site.aria}
      />

      {/* ── the poster frame ────────────────────────────────────────────────────
          A site GLB is ~0.7 MB and decodes through a Draco worker, so on a slow
          connection the plate would sit empty for a beat with nothing but a line
          of mono in the middle of it. The poster is that building's own Cycles
          render, so the plate shows the right building from the first paint and
          the WebGL canvas simply resolves on top of it. It fades rather than
          cutting, because a hard swap between two slightly different framings
          reads as a glitch. Not `next/image`: this is a decorative frame that
          must be in flight during the same beat as the GLB, and it is never the
          largest contentful paint of the page. */}
      <img
        src={site.poster}
        alt=""
        aria-hidden
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${
          status === "ready" ? "opacity-0" : "opacity-100"
        }`}
      />

      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-mono text-[11px] tracking-[0.25em] text-snow/70 animate-pulse bg-void/60 px-3 py-1.5">
            {status === "error" ? "MODEL UNAVAILABLE" : "RAISING THE ANCHOR…"}
          </div>
        </div>
      )}

      {status === "ready" && (
        <>
          {/* the surveyor's readout — which building, which lot */}
          <div className="absolute bottom-3 left-3 pointer-events-none font-mono leading-tight">
            <div className="text-[10px] tracking-[0.22em] text-snow/80">{site.label}</div>
            <div className="text-[9px] tracking-[0.22em] text-lava mt-0.5">{site.sub}</div>
          </div>

          {/* On a 390px plate this sits exactly on top of the lot readout above.
              The same instruction is already in the caption under the plate, so
              the phone drops the in-canvas copy rather than stacking two lines
              of mono over each other. */}
          <div className="hidden sm:block absolute bottom-3 inset-x-0 text-center font-mono text-[10px] tracking-[0.2em] text-dusty pointer-events-none">
            DRAG TO ORBIT
          </div>

          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button
              onClick={() => zoomRef.current?.(0.82)}
              aria-label="Zoom in"
              className="w-9 h-9 grid place-items-center font-mono text-base text-snow border border-white/20 bg-void/60 hover:border-lava/60 hover:text-lava transition-colors"
            >
              +
            </button>
            <button
              onClick={() => zoomRef.current?.(1.22)}
              aria-label="Zoom out"
              className="w-9 h-9 grid place-items-center font-mono text-base text-snow border border-white/20 bg-void/60 hover:border-lava/60 hover:text-lava transition-colors"
            >
              −
            </button>
          </div>
        </>
      )}
    </div>
  )
}
