"use client"

// ═══════════════════════════════════════════════════════════════════════════
// Interactive Runestone — the official runestone3d.gltf in a raw Three.js
// viewer (house rule: no react-three-fiber). Drag to rotate, gentle auto-spin,
// warm key + cool rim lighting on black. WebGL only boots when the section
// approaches the viewport and pauses offscreen; zoom is disabled so the page
// scroll is never trapped.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"

export default function RunestoneViewer() {
  const mountRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const zoomRef = useRef<((factor: number) => void) | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let cleanup: (() => void) | null = null

    const boot = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !startedRef.current) {
        startedRef.current = true
        boot.disconnect()
        setStatus("loading")
        init()
      }
    }, { rootMargin: "400px" })
    boot.observe(mount)

    async function init() {
      const THREE = await import("three")
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js")
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js")
      if (disposed || !mount) return

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(36, mount.clientWidth / mount.clientHeight, 0.1, 100)
      camera.position.set(2.4, 0.7, 3.6)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.6
      mount.appendChild(renderer.domElement)

      // a black crystal lives on reflections — studio environment map first
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

      const key = new THREE.DirectionalLight(0xffb066, 3.6)
      key.position.set(3, 4, 2)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xbcd0ec, 2.2)
      rim.position.set(-4, 2.5, -3)
      scene.add(rim)
      const rim2 = new THREE.DirectionalLight(0xffffff, 1.4)
      rim2.position.set(1.5, -1, -3.5)
      scene.add(rim2)
      const under = new THREE.PointLight(0xf56e0f, 1.2, 12, 2)
      under.position.set(0, -1.6, 0.6)
      scene.add(under)
      scene.add(new THREE.AmbientLight(0x3c4048, 1.1))

      // block wheel-zoom BEFORE OrbitControls registers its wheel listener —
      // pinch zoom stays enabled, the page scroll is never trapped
      renderer.domElement.addEventListener("wheel", (e) => e.stopImmediatePropagation(), { passive: true })

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.enableZoom = true           // pinch on touch; wheel blocked above
      controls.minDistance = 1.6
      controls.maxDistance = 7
      controls.minPolarAngle = Math.PI * 0.22
      controls.maxPolarAngle = Math.PI * 0.62
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      controls.autoRotateSpeed = 0.8

      // button-driven dolly for explicit zoom in/out
      zoomRef.current = (factor: number) => {
        const dir = camera.position.clone().sub(controls.target)
        const len = Math.min(7, Math.max(1.6, dir.length() * factor))
        dir.setLength(len)
        camera.position.copy(controls.target).add(dir)
        controls.update()
      }

      new GLTFLoader().load(
        "/runestone3d.gltf",
        (gltf) => {
          if (disposed) return
          const model = gltf.scene
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          model.position.sub(center)
          const holder = new THREE.Group()
          holder.add(model)
          holder.scale.setScalar(2.6 / (Math.max(size.x, size.y, size.z) || 1))
          scene.add(holder)
          setStatus("ready")
        },
        undefined,
        () => setStatus("error"),
      )

      let raf = 0
      let running = true
      const loop = () => {
        if (!running || disposed) return
        controls.update()
        renderer.render(scene, camera)
        raf = requestAnimationFrame(loop)
      }
      loop()

      const vis = new IntersectionObserver((es) => {
        const on = es[0].isIntersecting
        if (on && !running) { running = true; loop() }
        else if (!on) { running = false; cancelAnimationFrame(raf) }
      })
      vis.observe(mount)

      const onResize = () => {
        if (!mount) return
        camera.aspect = mount.clientWidth / mount.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(mount.clientWidth, mount.clientHeight)
      }
      window.addEventListener("resize", onResize)

      cleanup = () => {
        running = false
        cancelAnimationFrame(raf)
        vis.disconnect()
        window.removeEventListener("resize", onResize)
        controls.dispose()
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

  return (
    // no min-height: the parent plate owns the box. A floor here overflowed
    // that plate on phones, where the plate is ~248px tall.
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" aria-label="Interactive 3D model of the Runestone monolith" role="img" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-mono text-[11px] tracking-[0.25em] text-dusty animate-pulse">
            {status === "error" ? "RUNESTONE UNAVAILABLE" : "SUMMONING RUNESTONE…"}
          </div>
        </div>
      )}
      {status === "ready" && (
        <>
          <div className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] tracking-[0.2em] text-dusty pointer-events-none">
            DRAG TO ROTATE · PINCH OR USE ± TO ZOOM
          </div>
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button
              onClick={() => zoomRef.current?.(0.8)}
              aria-label="Zoom in"
              className="w-9 h-9 grid place-items-center font-mono text-base text-snow border border-white/20 bg-void/60 hover:border-lava/60 hover:text-lava transition-colors"
            >
              +
            </button>
            <button
              onClick={() => zoomRef.current?.(1.25)}
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
