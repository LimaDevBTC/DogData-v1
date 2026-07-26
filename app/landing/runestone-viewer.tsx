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
      if (disposed || !mount) return

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(36, mount.clientWidth / mount.clientHeight, 0.1, 100)
      camera.position.set(2.4, 0.7, 3.6)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15
      mount.appendChild(renderer.domElement)

      const key = new THREE.DirectionalLight(0xffb066, 2.4)
      key.position.set(3, 4, 2)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x9fb4d0, 1.2)
      rim.position.set(-4, 2.5, -3)
      scene.add(rim)
      const under = new THREE.PointLight(0xf56e0f, 0.6, 10, 2)
      under.position.set(0, -1.6, 0.6)
      scene.add(under)
      scene.add(new THREE.AmbientLight(0x33363c, 0.7))

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.enableZoom = false          // never trap the page scroll
      controls.minPolarAngle = Math.PI * 0.22
      controls.maxPolarAngle = Math.PI * 0.62
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      controls.autoRotateSpeed = 0.8

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
    <div className="relative w-full h-full min-h-[420px]">
      <div ref={mountRef} className="absolute inset-0" aria-label="Interactive 3D model of the Runestone monolith" role="img" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-mono text-[11px] tracking-[0.25em] text-dusty animate-pulse">
            {status === "error" ? "RUNESTONE UNAVAILABLE" : "SUMMONING RUNESTONE…"}
          </div>
        </div>
      )}
      {status === "ready" && (
        <div className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] tracking-[0.2em] text-dusty pointer-events-none">
          DRAG TO ROTATE
        </div>
      )}
    </div>
  )
}
