'use client'

// ═══════════════════════════════════════════════════════════════════════════
// FoundersTower — the *real* Satoshi Plaza landmark, rendered live.
// A minimal, self-contained Three.js scene that mounts the exact same
// buildCentralTower() used in /city/explore (base 34, height 500), so the
// donate page shows the true "Lunar Spire" with its animated DOG•GO•TO•THE
// •MOON LED band and pulsing beacon — not a stylized div mockup.
// Cheap: one tower group, a handful of lights, a gentle auto-orbit, and it
// pauses its RAF whenever the card scrolls out of view.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
// Local copy of the Satoshi Plaza tower so the landing page builds in production
// without the WIP city (app/city/explore/ is gitignored, not deployed to Vercel).
import { buildCentralTower } from './central-tower'

export default function FoundersTower() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let W = mount.clientWidth || 1
    let H = mount.clientHeight || 1

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(42, W / H, 1, 4000)
    const CENTER_Y = 250          // aim at mid-tower
    const DIST = 760              // frames the full spire vertically
    camera.position.set(0, CENTER_Y + 40, DIST)
    camera.lookAt(0, CENTER_Y, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)          // transparent → card gradient shows through
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    // ── Lights (slightly lifted vs. the city so it reads in a small card) ─────
    scene.add(new THREE.AmbientLight(0x0a0816, 0.35))
    const hemi = new THREE.HemisphereLight(0x2a4a72, 0x2a1400, 0.55)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0x9fb4dc, 0.8)
    key.position.set(-260, 420, 340)
    scene.add(key)
    const warm = new THREE.DirectionalLight(0xF7931A, 0.35)
    warm.position.set(300, 180, 160)
    scene.add(warm)

    // ── The real tower ────────────────────────────────────────────────────────
    const { group, animate } = buildCentralTower({ x: 0, z: 0, base: 34, height: 500 })
    group.position.y = 0        // sit its own base on the scene floor
    scene.add(group)

    // ── Patrons' Walk — a real ring of gold plaques on the plaza floor, part of
    // the scene (correct perspective as the camera orbits, unlike a CSS overlay).
    const walkMat = new THREE.MeshBasicMaterial({
      color: 0xFCD34D, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
      depthWrite: false,
    })
    const walk = new THREE.Mesh(new THREE.RingGeometry(148, 155, 128), walkMat)
    walk.rotation.x = -Math.PI / 2
    walk.position.y = 1.0
    scene.add(walk)

    // individual plaques — small gold studs seated on the ring
    const plaqueMat = new THREE.MeshBasicMaterial({ color: 0xFCD34D, transparent: true, opacity: 0.75 })
    const plaqueGeo = new THREE.BoxGeometry(7, 0.8, 4.5)
    const plaques = new THREE.Group()
    const PLAQUE_COUNT = 28
    for (let i = 0; i < PLAQUE_COUNT; i++) {
      const a = (i / PLAQUE_COUNT) * Math.PI * 2
      const p = new THREE.Mesh(plaqueGeo, plaqueMat)
      p.position.set(Math.cos(a) * 151.5, 1.4, Math.sin(a) * 151.5)
      p.rotation.y = -a + Math.PI / 2
      plaques.add(p)
    }
    scene.add(plaques)

    // soft warm pool of light under the ring so it reads as lit stone
    const walkGlowMat = new THREE.MeshBasicMaterial({
      color: 0xF7931A, transparent: true, opacity: 0.05, side: THREE.DoubleSide,
      depthWrite: false,
    })
    const walkGlow = new THREE.Mesh(new THREE.CircleGeometry(210, 96), walkGlowMat)
    walkGlow.rotation.x = -Math.PI / 2
    walkGlow.position.y = 0.4
    scene.add(walkGlow)

    // ── Render loop with visibility gating ────────────────────────────────────
    let raf = 0
    let visible = true
    const clock = new THREE.Clock()
    let theta = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const t = clock.getElapsedTime()
      animate(t)
      walkMat.opacity = 0.26 + 0.1 * Math.sin(t * 1.4)   // slow breath on the Walk
      theta += 0.0016
      camera.position.set(Math.sin(theta) * DIST, CENTER_Y + 40, Math.cos(theta) * DIST)
      camera.lookAt(0, CENTER_Y, 0)
      renderer.render(scene, camera)
    }
    frame()

    // Pause the RAF when the card is off-screen (donate page is long).
    const io = new IntersectionObserver(
      ([e]) => { visible = e.isIntersecting },
      { threshold: 0.01 },
    )
    io.observe(mount)

    // ── Resize ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      W = mount.clientWidth || 1
      H = mount.clientHeight || 1
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    })
    ro.observe(mount)

    // ── Teardown ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      renderer.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />
}
