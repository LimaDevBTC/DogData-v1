'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DogCity Luna — Phase 1 verification preview.
//
// Renders the 3 real lunar terrain patches (fetched by scripts/lunar/fetch_terrain.ts)
// with each zone's minted lots (scripts/lunar/generate_lots.ts) as simple tinted
// blocks sized by height tier — no BitFlow/Kray/central-tower art yet, no roads/water
// (this is Luna, none of that applies), no 29.53-day animated day/night. Just: is the
// terrain real, and did the lots land on it correctly. Additive route — does not
// touch /city/explore or anything under it.
//
// Raw Three.js (not @react-three/fiber — this project's r3f@8.17.14 pins
// react-reconciler@0.27.0, which breaks against the installed React 18.3.1 at
// runtime). Mirrors app/city/explore/city-3d.tsx's proven pattern instead.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { DISTRICTS, type ZoneId } from '@/lib/city/zones'
import { subsolarPoint, sunLocalDirection, sunDirectionVector } from '@/lib/city/lunar/sun'

const ZONES: ZoneId[] = ['btc-core', 'solana', 'stacks']

// Artistic scene-space placement — the 3 sites are real but geographically distant
// (equator vs each pole); this just lays them out legibly side by side, the same
// spirit as zones.ts's old ZONE_CENTERS island offsets.
const ZONE_ANCHOR: Record<ZoneId, [number, number]> = {
  'btc-core': [0, 0],
  solana: [9000, 0],
  stacks: [-9000, 0],
}
const ZONE_LABEL: Record<ZoneId, { name: string; color: string }> = {
  'btc-core': { name: 'BTC-core — Mare Tranquillitatis', color: '#F7931A' },
  solana: { name: 'Solana — Shackleton', color: '#9945FF' },
  stacks: { name: 'Stacks — Peary', color: '#5546FF' },
}

interface HeightmapMeta {
  cols: number; rows: number; cellSizeM: number
  siteCenterLatDeg: number; siteCenterLonDeg: number
  minRelM: number; maxRelM: number
}
interface LunarLot {
  xM: number; zM: number; elevationM: number
  district: number; heightTier: number; footprint: number
}
interface ZoneData { meta: HeightmapMeta; heights: Float32Array; lots: LunarLot[] }

async function loadZone(zone: ZoneId): Promise<ZoneData | null> {
  try {
    const [meta, buf, lots] = await Promise.all([
      fetch(`/lunar/${zone}-heightmap.json`).then(r => { if (!r.ok) throw new Error('no heightmap meta'); return r.json() }),
      fetch(`/lunar/${zone}-heightmap.f32`).then(r => { if (!r.ok) throw new Error('no heightmap bin'); return r.arrayBuffer() }),
      fetch(`/lunar/${zone}-lots.json`).then(r => r.ok ? r.json() : []),
    ])
    return { meta, heights: new Float32Array(buf), lots }
  } catch (err) {
    console.warn(`[luna] ${zone}: ${(err as Error).message}`)
    return null
  }
}

// Direct world-space (X=east-ish, Y=up, Z=south-ish) mesh. Winding (a,c,b)(b,c,d)
// verified by hand (cross product) to face +Y for this index layout — do not swap
// without re-checking, a flipped winding reads as inverted (unlit) terrain.
function buildTerrainGeometry(meta: HeightmapMeta, heights: Float32Array, targetRes = 160): THREE.BufferGeometry {
  const { cols, rows, cellSizeM } = meta
  const gridHalf = (cols - 1) / 2
  const stride = Math.max(1, Math.floor((cols - 1) / targetRes))
  const nx = Math.floor((cols - 1) / stride) + 1
  const nz = Math.floor((rows - 1) / stride) + 1

  let minH = Infinity, maxH = -Infinity
  for (let j = 0; j < nz; j++) {
    const gz = Math.min(rows - 1, j * stride)
    for (let i = 0; i < nx; i++) {
      const h = heights[gz * cols + Math.min(cols - 1, i * stride)]
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
  }

  const positions = new Float32Array(nx * nz * 3)
  const colors = new Float32Array(nx * nz * 3)
  for (let j = 0; j < nz; j++) {
    const gz = Math.min(rows - 1, j * stride)
    for (let i = 0; i < nx; i++) {
      const gx = Math.min(cols - 1, i * stride)
      const h = heights[gz * cols + gx]
      const idx = (j * nx + i) * 3
      positions[idx] = (gx - gridHalf) * cellSizeM
      positions[idx + 1] = h
      positions[idx + 2] = (gz - gridHalf) * cellSizeM
      const t = maxH > minH ? (h - minH) / (maxH - minH) : 0.5
      const c = 0.11 + t * 0.15 // dark → lighter regolith grey
      colors[idx] = c; colors[idx + 1] = c * 0.97; colors[idx + 2] = c * 0.93
    }
  }

  const indices: number[] = []
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function buildSiteGroup(zone: ZoneId, data: ZoneData): THREE.Group {
  const [ax, az] = ZONE_ANCHOR[zone]
  const group = new THREE.Group()
  group.position.set(ax, 0, az)

  const geo = buildTerrainGeometry(data.meta, data.heights)
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  const terrain = new THREE.Mesh(geo, terrainMat)
  terrain.receiveShadow = true
  terrain.castShadow = true
  group.add(terrain)

  // Real subsolar-point-derived sun direction for THIS site's true selenographic
  // position — see lib/city/lunar/sun.ts. Static for now (animating across the
  // 29.53-day lunar day is a fast-follow, not this phase).
  const subsolar = subsolarPoint(new Date())
  const { elevationDeg, azimuthDeg } = sunLocalDirection(data.meta.siteCenterLatDeg, data.meta.siteCenterLonDeg, subsolar)
  const dir = sunDirectionVector(elevationDeg, azimuthDeg)
  const sunDist = 4000
  const sunY = Math.max(dir.y, 0.06) * sunDist

  const sun = new THREE.DirectionalLight(elevationDeg > 5 ? 0xfff6e8 : 0xffb070, 1.6)
  sun.position.set(dir.x * sunDist, sunY, dir.z * sunDist)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = sunDist * 2
  const shadowSpan = data.meta.cols * data.meta.cellSizeM * 0.6
  sun.shadow.camera.left = -shadowSpan; sun.shadow.camera.right = shadowSpan
  sun.shadow.camera.top = shadowSpan; sun.shadow.camera.bottom = -shadowSpan
  group.add(sun)
  group.add(sun.target)

  if (data.lots.length > 0) {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1)
    const markMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 })
    const inst = new THREE.InstancedMesh(boxGeo, markMat, data.lots.length)
    inst.castShadow = true
    inst.receiveShadow = true
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    data.lots.forEach((lot, i) => {
      const h = 2 + lot.heightTier * 5 // no real building art yet — a size-coded block stands in
      const footprint = Math.max(1, lot.footprint * 0.5)
      dummy.position.set(lot.xM, lot.elevationM + h / 2, lot.zM)
      dummy.scale.set(footprint, h, footprint)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      color.set(DISTRICTS[lot.district]?.color ?? '#888888')
      inst.setColorAt(i, color)
    })
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    group.add(inst)
  }

  return group
}

// Cheap starfield — same idea as city-3d.tsx's, simplified (no day/night fade, Luna sky is always black).
function buildStars(): THREE.Points {
  const count = 6000
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI * 0.5
    const r = 30000 + Math.random() * 3000
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 500
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: 0xdfe6f5, size: 22, sizeAttenuation: true, transparent: true, opacity: 0.9 })
  return new THREE.Points(geo, mat)
}

export default function LunarScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadedZones, setLoadedZones] = useState<Partial<Record<ZoneId, { lots: number }>>>({})
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let renderer: THREE.WebGLRenderer | null = null
    let raf = 0
    let controls: any = null

    ;(async () => {
      const pairs = await Promise.all(ZONES.map(z => loadZone(z).then(d => [z, d] as const)))
      if (cancelled) return
      const zonesData: Partial<Record<ZoneId, ZoneData>> = {}
      for (const [z, d] of pairs) if (d) zonesData[z] = d
      const loadedSummary: Partial<Record<ZoneId, { lots: number }>> = {}
      for (const z of ZONES) if (zonesData[z]) loadedSummary[z] = { lots: zonesData[z]!.lots.length }
      setLoadedZones(loadedSummary)
      setLoading(false)
      if (Object.keys(zonesData).length === 0) { setFailed(true); return }

      const mount = mountRef.current
      if (!mount) return
      const W = mount.clientWidth, H = mount.clientHeight

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x000000)

      const camera = new THREE.PerspectiveCamera(50, W / H, 10, 60000)
      camera.position.set(0, 5000, 11000)
      camera.lookAt(0, 0, 0)

      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      mount.appendChild(renderer.domElement)

      scene.add(new THREE.AmbientLight(0x404050, 0.22))
      scene.add(new THREE.HemisphereLight(0x1a2030, 0x0a0805, 0.15))
      scene.add(buildStars())

      for (const zone of ZONES) {
        const data = zonesData[zone]
        if (data) scene.add(buildSiteGroup(zone, data))
      }

      try {
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
        if (cancelled) return
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.minDistance = 50
        controls.maxDistance = 40000
        controls.target.set(0, 0, 0)
      } catch { /* controls unavailable — static camera still renders */ }

      const onResize = () => {
        if (!mount || !renderer) return
        const w = mount.clientWidth, h = mount.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      const animate = () => {
        raf = requestAnimationFrame(animate)
        controls?.update()
        renderer!.render(scene, camera)
      }
      animate()

      ;(mount as any).__cleanup = () => {
        window.removeEventListener('resize', onResize)
        cancelAnimationFrame(raf)
        controls?.dispose?.()
        renderer?.dispose()
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      const cleanup = (mountRef.current as any)?.__cleanup
      if (cleanup) cleanup()
    }
  }, [])

  const loadedCount = Object.keys(loadedZones).length

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="font-mono text-xs text-white/60 tracking-[0.25em] uppercase">Loading real lunar terrain…</p>
        </div>
      )}
      {!loading && failed && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="font-mono text-xs text-red-400 tracking-[0.2em] uppercase text-center px-6">
            No terrain data found — run scripts/lunar/fetch_terrain.ts and generate_lots.ts first.
          </p>
        </div>
      )}
      <div ref={mountRef} className="w-full h-full" />
      {loadedCount > 0 && (
        <div className="absolute bottom-4 left-4 z-10 font-mono text-[10px] uppercase tracking-widest space-y-1 pointer-events-none">
          {ZONES.map(zone => (
            <div key={zone} className="flex items-center gap-1.5" style={{ color: loadedZones[zone] ? '#fff' : '#666' }}>
              <span style={{ color: ZONE_LABEL[zone].color }}>●</span>
              {ZONE_LABEL[zone].name}
              {loadedZones[zone] && <span className="text-white/40">· {loadedZones[zone]!.lots.toLocaleString()} lots</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
