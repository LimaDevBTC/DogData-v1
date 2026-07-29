"use client"

// ═══════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL PARTNERS — the anchor-lot viewer.
//
// One WebGL canvas showing one anchor building at a time, presented the way an
// architecture office presents a tower: a single subject on its lot, a studio
// rig, a real cast shadow, and a set-out grid under it. The buildings are NOT
// re-modelled for the web — they are the exact same builders the city renders
// (lib/city/towers/*), called with `detail: true` for the close-range pass.
// That is the whole point of the section: what you orbit here is what stands on
// Satoshi Plaza.
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
import { PARTNERS, type PartnerKey } from "./partners-data"

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
  const g = ctx.createRadialGradient(C, C, 0, C, C, C)
  g.addColorStop(0, "#191c21")
  g.addColorStop(0.42, "#101318")
  g.addColorStop(0.72, "#05060a")
  g.addColorStop(1, "#000000")
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(C, C, C, 0, Math.PI * 2); ctx.fill()

  // concentric set-out rings
  ctx.lineWidth = 1.4
  ctx.strokeStyle = "rgba(240,240,242,0.09)"
  for (const r of [0.10, 0.18, 0.26, 0.34, 0.42]) {
    ctx.beginPath(); ctx.arc(C, C, C * r, 0, Math.PI * 2); ctx.stroke()
  }
  // radial ticks, every 15°, stopping short of the middle
  ctx.lineWidth = 1
  ctx.strokeStyle = "rgba(240,240,242,0.055)"
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(C + Math.cos(a) * C * 0.11, C + Math.sin(a) * C * 0.11)
    ctx.lineTo(C + Math.cos(a) * C * 0.46, C + Math.sin(a) * C * 0.46)
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
  /** camera position + target that frame this tower at aspect 1 */
  fit: { center: THREE_NS.Vector3; radius: number }
}

export default function TowerViewer({ partner }: { partner: PartnerKey }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")

  // imperative handles the React tree pokes at after boot
  const selectRef = useRef<((k: PartnerKey) => void) | null>(null)
  const zoomRef = useRef<((factor: number) => void) | null>(null)
  const pendingRef = useRef<PartnerKey>(partner)

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
      const { buildKrayTower } = await import("@/lib/city/towers/kray")
      const { buildBitflowTower } = await import("@/lib/city/towers/bitflow")
      if (disposed || !mount) return

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

      // ── lazy build + cache ──────────────────────────────────────────────────
      const built = new Map<PartnerKey, Built>()
      const box = new THREE.Box3()
      const sizeV = new THREE.Vector3()

      const build = (k: PartnerKey): Built => {
        const hit = built.get(k)
        if (hit) return hit

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
          t.setDaylight(0)                   // black page — the tower is at night
          animate = t.animate
        }

        // tame the studio environment per-material (see the PMREM note above)
        holder.traverse((o) => {
          const m = (o as THREE_NS.Mesh).material
          const list = Array.isArray(m) ? m : m ? [m] : []
          for (const mat of list) {
            if ("envMapIntensity" in mat) (mat as THREE_NS.MeshStandardMaterial).envMapIntensity = 0.35
          }
        })

        scene.add(holder)
        box.setFromObject(holder)
        box.getSize(sizeV)
        const center = box.getCenter(new THREE.Vector3())
        // frame on the mass, not the bounding sphere: these are 4:1 towers and a
        // sphere fit would leave them tiny in a 16:9 plate
        const radius = Math.max(sizeV.y * 0.52, sizeV.x * 0.62, sizeV.z * 0.62)
        const entry: Built = { holder, animate, fit: { center, radius } }
        built.set(k, entry)
        return entry
      }

      // ── camera fitting + tween ──────────────────────────────────────────────
      const camFrom = new THREE.Vector3()
      const camTo = new THREE.Vector3()
      const tgtFrom = new THREE.Vector3()
      const tgtTo = new THREE.Vector3()
      let tweenT = 1                          // 1 = settled
      let distFor = 0

      const distanceFor = (radius: number) => {
        const vFov = (camera.fov * Math.PI) / 180
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
        return (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.08
      }

      const aimAt = (b: Built, instant: boolean) => {
        distFor = distanceFor(b.fit.radius)
        tgtTo.set(0, b.fit.center.y * 0.92, 0)
        // three-quarter view, slightly above the midpoint — the standard
        // presentation angle for a tower elevation
        const dir = new THREE.Vector3(0.62, 0.30, 0.72).normalize()
        camTo.copy(tgtTo).addScaledVector(dir, distFor)
        controls.minDistance = distFor * 0.42
        controls.maxDistance = distFor * 1.9
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

      let current: PartnerKey | null = null
      const select = (k: PartnerKey) => {
        const b = build(k)
        built.forEach((v, vk) => { v.holder.visible = vk === k })
        box.setFromObject(b.holder)
        box.getSize(sizeV)
        // Anything drawn at canvas radius C·f lands at world radius f·scale, and
        // the lot square is printed at f = 0.20 — so scale = 3.2 × footprint
        // puts the outline at 1.28 × the building's own half-width, a surveyed
        // margin rather than a line jammed against the façade.
        pad.scale.setScalar(Math.max(sizeV.x, sizeV.z) * 3.2)
        aimAt(b, current === null)
        current = k
      }
      selectRef.current = select
      select(pendingRef.current)
      setStatus("ready")

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
            const want = distanceFor(b.fit.radius)
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
        scene.traverse((o) => {
          const mesh = o as THREE_NS.Mesh
          mesh.geometry?.dispose?.()
          const m = mesh.material
          const list = Array.isArray(m) ? m : m ? [m] : []
          for (const mat of list) mat.dispose()
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

  const p = PARTNERS.find((x) => x.key === partner)!

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        className="absolute inset-0"
        role="img"
        aria-label={`Interactive 3D model of ${p.building}, ${p.name}'s anchor building on Satoshi Plaza`}
      />

      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-mono text-[11px] tracking-[0.25em] text-dusty animate-pulse">
            {status === "error" ? "MODEL UNAVAILABLE" : "RAISING THE ANCHOR…"}
          </div>
        </div>
      )}

      {status === "ready" && (
        <>
          {/* the surveyor's readout — which building, which lot */}
          <div className="absolute bottom-3 left-3 pointer-events-none font-mono leading-tight">
            <div className="text-[10px] tracking-[0.22em] text-snow/80">{p.building.toUpperCase()}</div>
            <div className="text-[9px] tracking-[0.22em] text-lava mt-0.5">{p.lot}</div>
          </div>

          <div className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] tracking-[0.2em] text-dusty pointer-events-none">
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
