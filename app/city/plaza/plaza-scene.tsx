'use client'
// ═══════════════════════════════════════════════════════════════════════════════
// Satoshi Plaza on the Moon, with the DOG mempool alive above it.
//
// praca-central.md: the plaza of the landing scene (Central Tower, BitFlow HQ,
// Kray Tower, the deck and its gardens) exported as-is from blender/dogcity-landing
// .blend to public/city/plaza.glb, standing on the real Mare Tranquillitatis
// terrain (public/lunar/btc-core-heightmap.f32, VEX 2×, same as the .blend), with
// the spaceport 3 km south. Every pending DOG transaction is a ship in orbit;
// each block is a landing window; the board on screen is the node's mempool.
//
// Raw Three.js (house rule: no react-three-fiber). Everything this file imports
// is tracked: the lunar helpers under lib/city/lunar are gitignored and must
// never be imported from a production page (Vercel builds from the GitHub clone).
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { loadTerrain } from './terrain'
import { createOrbitLayer, PAD_MAIN } from './orbit-layer'
import { startFeed, type DogTx, type Snapshot } from './feed'
import { buildChalet, type Chalet } from './chalet'
import { buildPrecinct, ANCHORS, type Precinct } from './precinct'
import { loadPark, PARK_CENTER, type Park } from './park'

// ── framing ────────────────────────────────────────────────────────────────────
// The default view is the landing hero, from the north-east, high enough that the
// orbit ring sweeps through the frame and the spaceport reads at the horizon.
// From the north-north-east, down the monumental axis: deck in front, the towers
// framing it, the Castle of Cards beyond the deck, the spaceport at the horizon
// behind the castle, and the Earth in the south-western sky.
const HOME_POS = new THREE.Vector3(560, 640, -1480)
const HOME_TARGET = new THREE.Vector3(0, 100, 480)
// A phone in portrait sees a narrow slice: pull in closer and look a little
// lower so the deck and the towers fill the width instead of floating mid-frame.
function homeFor(aspect: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
  // ?view=castle | spaceport: bookmarks for the two other set pieces
  const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null
  if (view === 'castle' || view === 'south' || view === 'chalet') return { pos: new THREE.Vector3(-560, 300, 1260), target: new THREE.Vector3(0, 110, 620) }
  if (view === 'north') return { pos: new THREE.Vector3(520, 300, -1240), target: new THREE.Vector3(0, 90, -620) }
  if (view === 'top') return { pos: new THREE.Vector3(60, 2600, 900), target: new THREE.Vector3(0, 0, 100) }
  // the park's own hero, "The Gate Reveal": from the Gate crest, south-west of the
  // Monarch, looking up the Vale of the Mark (park frame (−2210, −1748) → three (−2210, +1748))
  if (view === 'parkclose') return { pos: new THREE.Vector3(PARK_CENTER.x - 1250, 40, PARK_CENTER.z + 1050), target: new THREE.Vector3(PARK_CENTER.x, 150, PARK_CENTER.z) }
  if (view === 'padclose') return { pos: new THREE.Vector3(PAD_MAIN.x + 40, PAD_MAIN.y + 40, PAD_MAIN.z - 150), target: new THREE.Vector3(PAD_MAIN.x - 20, PAD_MAIN.y + 24, PAD_MAIN.z + 20) }
  if (view === 'pad') return { pos: new THREE.Vector3(PAD_MAIN.x + 150, 90, PAD_MAIN.z + 190), target: new THREE.Vector3(PAD_MAIN.x - 60, 40, PAD_MAIN.z + 60) }
  if (view === 'far') return { pos: new THREE.Vector3(-2600, 2800, 4200), target: new THREE.Vector3(1800, 0, -1900) }
  if (view === 'park') return { pos: new THREE.Vector3(PARK_CENTER.x - 2210, 30, PARK_CENTER.z + 1748), target: new THREE.Vector3(PARK_CENTER.x, 120, PARK_CENTER.z) }
  if (view === 'spaceport') return { pos: new THREE.Vector3(600, 380, 3700), target: new THREE.Vector3(-140, 60, 3090) }
  if (aspect >= 1) return { pos: HOME_POS.clone(), target: HOME_TARGET.clone() }
  return { pos: new THREE.Vector3(430, 760, -1300), target: new THREE.Vector3(0, 40, 420) }
}

const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fmtDog = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)
const short = (s: string, a = 8, b = 6) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s)
const minutesAgo = (iso: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null)

interface HudState {
  loading: string | null
  error: string | null
  snapshot: Snapshot | null
  stale: number | null
  orbit: number
  parked: number
  picked: DogTx | null
  followed: DogTx | null
  followNote: string | null
}

export default function PlazaScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{ follow: (txid: string) => Promise<void>; home: () => void } | null>(null)
  const [hud, setHud] = useState<HudState>({
    loading: 'Loading the plaza…', error: null, snapshot: null, stale: null,
    orbit: 0, parked: 0, picked: null, followed: null, followNote: null,
  })
  const [followInput, setFollowInput] = useState('')
  // Phones start with the board folded to its one-line summary; the scene is the point.
  const [boardOpen, setBoardOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640)
  // ?plate=1: só a cena, sem HUD (para fotografar as chapas da landing)
  const [plate] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('plate') === '1')

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false

    // ── renderer ────────────────────────────────────────────────────────────
    // Log depth: a cena vai do deck (2 m) ao parque (9 km) e ao horizonte (60 km);
    // sem ele, duas superfícies quase coplanares a 9 km brigam no z-buffer.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 2, 200000)
    const home = homeFor(camera.aspect)
    camera.position.copy(home.pos)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(home.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 260
    controls.maxDistance = 16000
    controls.maxPolarAngle = Math.PI / 2 - 0.04 // never under the ground
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.18
    controls.update()
    let lastInteraction = 0
    const wake = () => { lastInteraction = performance.now(); controls.autoRotate = false }
    renderer.domElement.addEventListener('pointerdown', wake)
    renderer.domElement.addEventListener('wheel', wake, { passive: true })

    // ── light: one sun, low, from the north-west; earthshine as fill ─────────
    // The Moon has no sky, so the fill is weak and blue-grey (Earth is up there).
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6)
    sun.position.set(-2600, 1500, -1900)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 500
    sun.shadow.camera.far = 7000
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.left = -1000; sc.right = 1000; sc.top = 1000; sc.bottom = -1000
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 1.2
    sun.target.position.set(0, 0, 320)
    scene.add(sun, sun.target)
    // A caixa de sombra segue o alvo da câmera (encaixada em texels da luz para
    // não tremer) e cresce com a distância: sombras na praça E no parque, a 9 km,
    // com um mapa só. Sem isto o parque era plano: as pedras não assentavam.
    const SUN_DIR = sun.position.clone().normalize()
    const SUN_DIST = sun.position.length()
    const lightRot = new THREE.Matrix4().lookAt(SUN_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))
    const lightRotInv = lightRot.clone().invert()
    const shadowAnchor = new THREE.Vector3()
    let shadowHalf = 1000
    const followShadow = () => {
      const dist = camera.position.distanceTo(controls.target)
      const half = dist < 1500 ? 1000 : dist < 3500 ? 1800 : 3200
      if (half !== shadowHalf) {
        shadowHalf = half
        sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half
        sc.updateProjectionMatrix()
      }
      const texel = (2 * half) / sun.shadow.mapSize.x
      shadowAnchor.copy(controls.target).applyMatrix4(lightRotInv)
      shadowAnchor.x = Math.round(shadowAnchor.x / texel) * texel
      shadowAnchor.y = Math.round(shadowAnchor.y / texel) * texel
      shadowAnchor.applyMatrix4(lightRot)
      sun.target.position.copy(shadowAnchor)
      sun.position.copy(shadowAnchor).addScaledVector(SUN_DIR, SUN_DIST)
    }
    scene.add(new THREE.HemisphereLight(0x2a3448, 0x0e0d0c, 0.28))
    const earthshine = new THREE.DirectionalLight(0x8fb0ff, 0.25)
    earthshine.position.set(1200, 2600, 900)
    scene.add(earthshine)

    // dark studio reflections for the glass towers, per-material tamed below
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    const tameEnv = (root: THREE.Object3D) => {
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material
        const list = Array.isArray(m) ? m : m ? [m] : []
        for (const mat of list) if ('envMapIntensity' in mat) (mat as THREE.MeshStandardMaterial).envMapIntensity = 0.32
      })
    }

    // ── sky: stars and the Earth ─────────────────────────────────────────────
    scene.add(buildStars())
    // The Earth hangs where the home camera looks: over the plaza, a hand above
    // the horizon, so the first frame has the Needle against the blue. Real
    // textures (the three.js planet set, NASA-derived), lit by the same sun, so
    // it shows a phase like it does from Tranquility Base.
    const earth = buildEarth()
    earth.position.set(-21000, 6800, 30000)
    scene.add(earth)

    // ── layers ──────────────────────────────────────────────────────────────
    const orbit = createOrbitLayer()
    scene.add(orbit.group)

    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    const gltf = new GLTFLoader()
    gltf.setDRACOLoader(draco)

    const pulses: { m: THREE.MeshStandardMaterial; base: number; rate: number; phase: number }[] = []
    const sways: { o: THREE.Object3D; y0: number; amp: number }[] = []
    const jets: { o: THREE.Object3D; y0: number }[] = []
    let chalet: Chalet | null = null
    let precinct: Precinct | null = null
    let park: Park | null = null
    const spinners: THREE.Object3D[] = []
    let heightAt: (x: number, z: number) => number = () => 0

    const loadGlb = (url: string) =>
      new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej))

    const boot = async () => {
      try {
        setHud((h) => ({ ...h, loading: 'Reading Mare Tranquillitatis…' }))
        const terrain = await loadTerrain()
        if (disposed) return
        heightAt = terrain.heightAt
        scene.add(terrain.group)

        setHud((h) => ({ ...h, loading: 'Raising the plaza…' }))
        // The deck (podium, gardens, supertrees, amphitheatre, pools, colonnade,
        // monorail) comes from the landing .blend; the three towers are the
        // landing-grade GLBs the /dogcity partners section shows (D6). Each tower
        // GLB ships with its own site slab; on the plaza those slabs would fight
        // the deck, so only the buildings are kept.
        const [plaza, spaceport, needle, bitflow, kray] = await Promise.all([
          loadGlb('/city/plaza.glb'),
          loadGlb('/city/spaceport.glb'),
          loadGlb('/city/central-tower.glb'),
          loadGlb('/city/bitflow-hq.glb'),
          loadGlb('/city/kray-tower.glb'),
        ])
        if (disposed) return
        // The Needle's own site slab would double the deck; the tower stands on the
        // deck alone. BitFlow and Kray keep their whole sites (gardens, kerbs, cars):
        // out at the anchor radius there is nothing for them to collide with.
        const stripSite = (root: THREE.Object3D) => {
          const gone: THREE.Object3D[] = []
          root.traverse((o) => { if (/^(SITE_|PROP_)|_Site$/i.test(o.name)) gone.push(o) })
          for (const o of gone) o.parent?.remove(o)
        }
        stripSite(needle)
        // The precinct (praca-central.md §4.2, D7): the Needle at the centre of the
        // deck; four anchors on a ring at R_ANCHOR, one per cardinal point, every
        // front turned to the centre. In each tower GLB the signed façade faces +z,
        // so "face the plaza" is a rotation about y: west anchor +90°, east −90°.
        needle.position.set(0, 39.9, 0)
        bitflow.position.copy(ANCHORS.west.pos)
        bitflow.rotation.y = ANCHORS.west.rotY
        kray.position.copy(ANCHORS.east.pos)
        kray.rotation.y = ANCHORS.east.rotY
        for (const root of [plaza, spaceport, needle, bitflow, kray]) {
          tameEnv(root)
          root.traverse((o) => {
            const m = o as THREE.Mesh
            if (!m.isMesh) return
            m.castShadow = true
            m.receiveShadow = true
            const mat = m.material as THREE.MeshStandardMaterial
            const name = o.name || ''
            // beacons and LEDs breathe; nothing else moves in the exports
            if (/beacon|led|glow|_light|lamp|strip|portal/i.test(name) && mat && 'emissiveIntensity' in mat) {
              pulses.push({ m: mat, base: mat.emissiveIntensity, rate: 0.9 + Math.random() * 0.8, phase: Math.random() * 6 })
            }
          })
          scene.add(root)
        }
        // the named-node contract of the tower GLBs (see app/dogcity/partners)
        for (const [root, name, amp] of [[kray, 'KRAY_CROWN_ICON', 1.4], [bitflow, 'BITFLOW_ROOF_MARK', 0]] as const) {
          const o = root.getObjectByName(name)
          if (o) sways.push({ o, y0: o.position.y, amp })
        }
        for (const [root, name] of [[kray, 'WATER_JET'], [needle, 'WATER_JET_RING']] as const) {
          const o = root.getObjectByName(name)
          if (o) jets.push({ o, y0: o.scale.y })
        }
        // D9: the Needle's sign ring ("MOON • DOG…") turns, slowly, like a real one
        for (const name of ['NEEDLE_LED_BAND', 'NEEDLE_LED_DOTS']) {
          const o = needle.getObjectByName(name)
          if (o) spinners.push(o)
        }
        // the main pad sits on the terrain: keep the constant honest
        PAD_MAIN.y = heightAt(PAD_MAIN.x, PAD_MAIN.z) + 1

        // The OrdCards Chalet at the south anchor (D2, nova redação), the front of
        // the official logo card up the monumental stair, the QR to the spaceport.
        setHud((h) => ({ ...h, loading: 'Raising the Chalet…' }))
        const texLoader = new THREE.TextureLoader()
        const loadTex = (url: string) =>
          new Promise<THREE.Texture>((res, rej) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t) }, undefined, rej))
        const [lf, lb] = await Promise.all([loadTex('/city/cards/logo-front.png'), loadTex('/city/cards/logo-back.png')])
        if (disposed) return
        chalet = buildChalet(lf, lb)
        chalet.group.position.copy(ANCHORS.south.pos)
        chalet.group.rotation.y = ANCHORS.south.rotY
        scene.add(chalet.group)

        // The precinct: boulevards, the ring, the lunar garden, the Mother Tree (D7, D8).
        setHud((h) => ({ ...h, loading: 'Planting the garden…' }))
        precinct = buildPrecinct({ heightAt })
        scene.add(precinct.group)
        setHud((h) => ({ ...h, loading: null }))

        // The Runestone park, 5.2 km to the north-east (D10, the landing's
        // position), loads after the plaza is up: it is a horizon until someone
        // flies there, and 2 MB of park should never delay the first frame.
        loadPark({ baseAt: terrain.baseAt, meanHeight: terrain.meanHeight, gltf })
          .then((p) => { if (disposed) { p.dispose(); return } park = p; scene.add(p.group) })
          .catch((err) => console.warn('[plaza] park did not load', err))
        setHud((h) => ({ ...h, loading: null }))
      } catch (err) {
        console.error('[plaza]', err)
        setHud((h) => ({ ...h, loading: null, error: 'The plaza did not load. Refresh to try again.' }))
      }
    }
    void boot()

    // ── demo mode (?demo=1): synthetic ships, so the choreography can be seen
    // on a quiet night. Client-only, never touches the feed or the database, and
    // the board says DEMO while it runs.
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'
    const demoTimers: ReturnType<typeof setTimeout>[] = []
    if (demo) {
      let n = 0
      const fake = (): DogTx => {
        n++
        const id = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
        const dog = Math.round(Math.pow(10, 3 + Math.random() * 5))
        return {
          txid: id, status: 'pending', first_seen: new Date().toISOString(), seen_pending: true,
          block_height: null, block_time: null, confirmed_at: null, dropped_at: null,
          dog_in: dog, dog_out: dog, dog_burn: 0, explicit_edict: n % 2 === 0, cenotaph: false,
          senders: ['bc1pdemo' + id.slice(0, 20)], receivers: [{ address: 'bc1qdemo' + id.slice(20, 40), dog }],
          fee_sats: 300 + Math.round(Math.random() * 3000), vsize: 250, fee_rate: Number((1 + Math.random() * 6).toFixed(2)),
          n_in: 1, n_out: 2, rbf: true,
        }
      }
      const live: DogTx[] = []
      for (let i = 0; i < 6; i++) { const tx = fake(); live.push(tx); orbit.enter(tx, { silent: true }) }
      const tick = () => {
        // every 25 s: a new ship; every 4th tick a "block" lands the two lowest,
        // now and then one drops
        const tx = fake(); live.push(tx); orbit.enter(tx)
        if (live.length % 4 === 0) {
          const landed = live.splice(0, 2)
          for (const l of landed) orbit.land({ ...l, status: 'confirmed', block_height: 962984, confirmed_at: new Date().toISOString() })
        } else if (Math.random() < 0.15 && live.length > 3) {
          const d = live.splice(1, 1)[0]
          orbit.drop(d)
        }
        demoTimers.push(setTimeout(tick, 25_000))
      }
      demoTimers.push(setTimeout(tick, 8_000))
    }

    // ── the feed ────────────────────────────────────────────────────────────
    let fees = { fast: null as number | null, slow: null as number | null }
    const feed = startFeed({
      onReady(p) {
        fees = { fast: p.snapshot?.fee_fast ?? null, slow: p.snapshot?.fee_slow ?? null }
        for (const tx of p.pending) orbit.enter(tx, { silent: true })
        // the last landing wave stays on the apron for a while
        const cutoff = Date.now() - 12 * 60_000
        for (const tx of p.landed) if (tx.confirmed_at && new Date(tx.confirmed_at).getTime() > cutoff) orbit.park(tx)
      },
      onEnter: (tx) => orbit.enter(tx),
      onLand: (tx) => orbit.land(tx),
      onDrop: (tx) => orbit.drop(tx),
      onSnapshot(s, stale) {
        fees = { fast: s?.fee_fast ?? null, slow: s?.fee_slow ?? null }
        setHud((h) => ({ ...h, snapshot: s, stale, error: null }))
      },
      onError: (message) => setHud((h) => ({ ...h, error: `Feed: ${message}` })),
    })

    // ── picking ─────────────────────────────────────────────────────────────
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downAt = 0
    let downXY = [0, 0]
    const onDown = (e: PointerEvent) => { downAt = performance.now(); downXY = [e.clientX, e.clientY] }
    const onUp = (e: PointerEvent) => {
      if (performance.now() - downAt > 350) return
      if (Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6) return
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const tx = orbit.pick(ray)
      setHud((h) => ({ ...h, picked: tx }))
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    apiRef.current = {
      async follow(txid) {
        const inScene = orbit.follow(txid)
        if (inScene) {
          setHud((h) => ({ ...h, followed: inScene, followNote: null, picked: inScene }))
          return
        }
        const tx = await feed.lookup(txid)
        if (!tx) {
          setHud((h) => ({ ...h, followed: null, followNote: 'Not a DOG transaction our node has seen in the last 24 h.' }))
          return
        }
        setHud((h) => ({
          ...h,
          followed: tx,
          picked: tx,
          followNote:
            tx.status === 'confirmed'
              ? `Landed in block ${fmtInt.format(tx.block_height ?? 0)}.`
              : tx.status === 'dropped'
                ? 'It left the mempool without a block (replaced or evicted).'
                : 'In orbit.',
        }))
      },
      home() {
        const h = homeFor(camera.aspect)
        controls.target.copy(h.target)
        camera.position.copy(h.pos)
        controls.update()
      },
    }
    // ?tx=<txid>: chegou pela landing (ou por um link) já seguindo uma nave
    {
      const txParam = (new URLSearchParams(window.location.search).get('tx') || '').trim().toLowerCase()
      if (/^[0-9a-f]{64}$/.test(txParam)) {
        setFollowInput(txParam)
        // depois do primeiro feed: o orbit precisa das naves para achar a dela
        setTimeout(() => { void apiRef.current?.follow(txParam) }, 2500)
      }
    }

    // ── loop ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let raf = 0
    let hudTick = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(0.1, clock.getDelta())
      const t = clock.elapsedTime
      if (!controls.autoRotate && performance.now() - lastInteraction > 25_000) controls.autoRotate = true
      controls.update()
      followShadow()
      orbit.update(t, dt, fees)
      for (const p of pulses) p.m.emissiveIntensity = p.base * (0.8 + 0.25 * Math.sin(t * p.rate + p.phase))
      for (const s of sways) { s.o.rotation.y = Math.sin(t * 0.22) * 0.95; s.o.position.y = s.y0 + Math.sin(t * 0.8) * s.amp }
      for (const j of jets) j.o.scale.y = j.y0 * (0.88 + 0.12 * Math.sin(t * 1.4))
      chalet?.update(t)
      precinct?.update(t)
      park?.update(t, renderer.domElement.clientHeight / 2)
      for (const sp of spinners) sp.rotation.y = t * 0.12
      earth.rotation.y = t * 0.004
      const cl = earth.getObjectByName('Clouds'); if (cl) cl.rotation.y = t * 0.0025
      renderer.render(scene, camera)
      // the counters on the board follow the scene, twice a second
      if ((hudTick++ & 31) === 0) {
        const c = orbit.count()
        setHud((h) => (h.orbit === c.orbit + c.landing && h.parked === c.parked ? h : { ...h, orbit: c.orbit + c.landing, parked: c.parked }))
      }
    }
    animate()

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      feed.stop()
      for (const t of demoTimers) clearTimeout(t)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointerdown', wake)
      renderer.domElement.removeEventListener('wheel', wake)
      controls.dispose()
      orbit.dispose()
      chalet?.dispose()
      precinct?.dispose()
      park?.dispose()
      draco.dispose()
      pmrem.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry?.dispose()
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          for (const mat of mats) mat?.dispose()
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  const s = hud.snapshot
  const tipAge = minutesAgo(s?.tip_time ?? null)
  const lastDogAge = minutesAgo(s?.last_dog_block_time ?? null)
  const live = hud.stale != null && hud.stale < 40 && !hud.error

  const submitFollow = (e: React.FormEvent) => {
    e.preventDefault()
    const v = followInput.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(v)) {
      setHud((h) => ({ ...h, followNote: 'Paste a full transaction id (64 hex characters).' }))
      return
    }
    void apiRef.current?.follow(v)
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white select-none">
      <div ref={mountRef} className="absolute inset-0" />

      {!plate && <>
      {/* ── title, and the way back: the landing is the front door, the site is home */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
          <a href="/dogcity" className="hover:text-white">DogCity</a>
          <span className="mx-2 text-white/25">·</span>
          <a href="/" className="hover:text-white">DOG DATA</a>
        </p>
        <h1 className="mt-1 font-mono text-base font-semibold tracking-tight text-white sm:text-xl">Satoshi Plaza</h1>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Mare Tranquillitatis · the Moon</p>
      </div>

      {/* ── the board: under the title on phones, top-right on desktop ─────── */}
      <div className="absolute left-4 right-4 top-[5.6rem] sm:left-auto sm:right-6 sm:top-6 sm:w-[20rem]">
        <div className="border border-white/10 bg-black/85">
          <button
            type="button"
            onClick={() => setBoardOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70"
          >
            <span className="truncate">
              {boardOpen
                ? `Mission board${typeof window !== 'undefined' && window.location.search.includes('demo=1') ? ' · demo' : ''}`
                : `${hud.orbit} in orbit · ${fmtDog(s?.dog_pending_amount ?? 0)} DOG`}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`inline-block size-1.5 rounded-full ${live ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
              <span className="text-white/45">{live ? 'live' : hud.stale != null ? `${hud.stale}s ago` : 'connecting'}</span>
              <span className="text-white/40">{boardOpen ? '−' : '+'}</span>
            </span>
          </button>
          {boardOpen && (
            <dl className="grid gap-2 border-t border-white/10 px-3 py-3 font-mono text-[11px]">
              <Row k="In orbit" v={`${hud.orbit} ship${hud.orbit === 1 ? '' : 's'} · ${fmtDog(s?.dog_pending_amount ?? 0)} DOG`} strong />
              <Row
                k="Next landing"
                v={
                  <>
                    any minute <span className="text-white/45">· ~10 min cadence</span>
                    <br />
                    <span className="text-white/60">
                      last block {s?.tip_height ? fmtInt.format(s.tip_height) : '…'}
                      {tipAge != null ? `, ${tipAge} min ago` : ''}
                    </span>
                  </>
                }
              />
              <Row
                k="Last DOG landing"
                v={
                  s?.last_dog_block
                    ? `block ${fmtInt.format(s.last_dog_block)} · ${s.last_dog_block_count} ship${s.last_dog_block_count === 1 ? '' : 's'}${lastDogAge != null ? ` · ${lastDogAge} min ago` : ''}`
                    : 'waiting for the first block'
                }
              />
              <Row k="Fuel, sat/vB" v={s ? `${s.fee_fast ?? '…'} fast · ${s.fee_normal ?? '…'} · ${s.fee_slow ?? '…'} slow` : '…'} />
              <Row k="Whole mempool" v={s ? `${fmtInt.format(s.tx_count)} txs waiting` : '…'} />
              <Row k="On the apron" v={`${hud.parked} landed`} />
            </dl>
          )}
        </div>
      </div>

      {/* ── follow your DOG. On a phone only one bottom card is up at a time: the
             picked ship takes the slot while it is open. ───────────────────── */}
      <div
        className={`absolute left-4 right-4 sm:left-6 sm:right-auto sm:w-[26rem] ${hud.picked ? 'hidden sm:block' : ''}`}
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <form onSubmit={submitFollow} className="border border-white/10 bg-black/85 p-3">
          <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">Follow your DOG</label>
          <div className="mt-2 flex gap-2">
            <input
              value={followInput}
              onChange={(e) => setFollowInput(e.target.value)}
              placeholder="paste a transaction id"
              spellCheck={false}
              className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-white/30 focus:border-[#F7931A]/70 focus:outline-none"
            />
            <button type="submit" className="border border-[#F7931A]/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F7931A]">
              Find
            </button>
          </div>
          {hud.followNote && <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/60">{hud.followNote}</p>}
          <p className="mt-2 hidden font-mono text-[10px] leading-relaxed text-white/35 sm:block">
            Every ship is a DOG transaction our node sees in the mempool. Fee sets the altitude, amount sets the size, the block is the landing window.
          </p>
        </form>
      </div>

      {/* ── picked ship ───────────────────────────────────────────────────── */}
      {hud.picked && (
        <div className="absolute left-4 right-4 sm:left-auto sm:right-6 sm:w-[22rem]" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <div className="border border-white/10 bg-black/85 p-3 font-mono text-[11px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">
                  {hud.picked.status === 'pending' ? 'In orbit' : hud.picked.status === 'confirmed' ? 'Landed' : 'Left orbit'}
                </p>
                <p className="mt-1 text-white">{fmtDog(hud.picked.dog_in)} DOG</p>
              </div>
              <button type="button" onClick={() => setHud((h) => ({ ...h, picked: null }))} className="text-white/40 hover:text-white">
                ×
              </button>
            </div>
            <dl className="mt-2 grid gap-1 text-white/70">
              <Row k="tx" v={<a className="text-white underline decoration-white/20 underline-offset-2" href={`/tx/bitcoin/${hud.picked.txid}`}>{short(hud.picked.txid, 10, 8)}</a>} />
              <Row k="fee" v={hud.picked.fee_rate != null ? `${hud.picked.fee_rate} sat/vB · ${fmtInt.format(hud.picked.fee_sats ?? 0)} sats` : '…'} />
              <Row k="from" v={hud.picked.senders[0] ? <a className="underline decoration-white/20 underline-offset-2" href={`/address/bitcoin/${hud.picked.senders[0]}`}>{short(hud.picked.senders[0])}</a> : 'unknown'} />
              <Row k="to" v={hud.picked.receivers[0] ? <a className="underline decoration-white/20 underline-offset-2" href={`/address/bitcoin/${hud.picked.receivers[0].address}`}>{short(hud.picked.receivers[0].address)}</a> : 'burn'} />
              <Row
                k={hud.picked.status === 'confirmed' ? 'block' : 'seen'}
                v={hud.picked.status === 'confirmed' && hud.picked.block_height ? fmtInt.format(hud.picked.block_height) : `${minutesAgo(hud.picked.first_seen) ?? 0} min ago`}
              />
              {hud.picked.dog_burn > 0 && <Row k="burned" v={`${fmtDog(hud.picked.dog_burn)} DOG`} />}
            </dl>
          </div>
        </div>
      )}

      {/* ── loading / error ───────────────────────────────────────────────── */}
      {(hud.loading || hud.error) && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <p className="border border-white/10 bg-black/85 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">
            {hud.loading ?? hud.error}
          </p>
        </div>
      )}
      </>}
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-white/45">{k}</dt>
      <dd className={`text-right ${strong ? 'text-[#F7931A]' : 'text-white/85'}`}>{v}</dd>
    </div>
  )
}

// ── sky ────────────────────────────────────────────────────────────────────────
function buildStars(): THREE.Points {
  const N = 4000
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    // uniform on the sphere, but only above the horizon (the ground hides the rest)
    const u = Math.random(), v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(1 - v) // 0..90°
    const r = 90000
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.cos(phi)
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    const b = 0.35 + Math.random() * 0.65
    const warm = Math.random() < 0.2
    col[i * 3] = b
    col[i * 3 + 1] = b * (warm ? 0.9 : 0.97)
    col[i * 3 + 2] = b * (warm ? 0.75 : 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const m = new THREE.PointsMaterial({ size: 180, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })
  const p = new THREE.Points(g, m)
  p.name = 'Stars'
  return p
}

function buildEarth(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'Earth'
  const R = 1300 // ~4° across from 37 km: twice the real angle, on purpose; it is the postcard
  const loader = new THREE.TextureLoader()
  const tex = (url: string, srgb = true) => {
    const t = loader.load(url)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshPhongMaterial({
      map: tex('/city/earth/earth_atmos_2048.jpg'),
      specularMap: tex('/city/earth/earth_specular_2048.jpg', false),
      normalMap: tex('/city/earth/earth_normal_2048.jpg', false),
      normalScale: new THREE.Vector2(0.6, 0.6),
      specular: new THREE.Color(0x333333),
      shininess: 18,
    }),
  )
  g.add(globe)
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.012, 64, 48),
    new THREE.MeshLambertMaterial({ map: tex('/city/earth/earth_clouds_1024.png'), transparent: true, opacity: 0.9, depthWrite: false }),
  )
  clouds.name = 'Clouds'
  g.add(clouds)
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.05, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x4f8dff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }),
  )
  g.add(rim)
  g.rotation.z = 0.41 // axial tilt, for the look of it
  return g
}

function buildEarthDrawn(): THREE.Group {
  // A drawn Earth, deliberately quiet: deep ocean, muted land, thin cloud, a faint
  // blue rim. From the Moon it spans about two degrees; a 640 m ball 37 km away
  // reads the same. Seeded so it looks the same on every visit.
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const c = document.createElement('canvas')
  c.width = 512; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#123a72'
  ctx.fillRect(0, 0, 512, 256)
  ctx.fillStyle = '#4b5a3a'
  for (let i = 0; i < 18; i++) {
    ctx.beginPath()
    ctx.ellipse(rnd() * 512, 50 + rnd() * 156, 22 + rnd() * 60, 12 + rnd() * 34, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 70; i++) {
    ctx.beginPath()
    ctx.ellipse(rnd() * 512, rnd() * 256, 10 + rnd() * 50, 2 + rnd() * 5, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(0, 0, 512, 14); ctx.fillRect(0, 242, 512, 14) // ice caps
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const g = new THREE.Group()
  g.name = 'Earth'
  g.add(new THREE.Mesh(new THREE.SphereGeometry(640, 48, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })))
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(680, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x5f9cff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }),
  )
  g.add(rim)
  return g
}
