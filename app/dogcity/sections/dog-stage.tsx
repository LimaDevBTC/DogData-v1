"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O PALCO DO $DOG (brief landing v3 §4.5). three.js PURO: @react-three/fiber
// quebra em runtime neste repo. Este arquivo só entra por next/dynamic com
// ssr: false, e só quando a seção The city chega a 600 px da tela.
//
// O GLB é o do jogo (cachorro.glb, 2,6 MB, meshopt + KTX2, feito para three r186),
// carregado aqui no three 0.162 com KTX2Loader (transcodificador basis servido do
// próprio site, public/basis, o mesmo da versão do three) e o MeshoptDecoder.
//
// O chão é diegético: um disco escuro com a grade de agrimensura da escritura e
// o contorno de um lote em fio lava, os anéis da cidade sumindo na borda. Luz:
// a Terra, fria, do alto à esquerda; contraluz lava da direita. Sem pós.
// Arrastar gira (70 graus para cada lado); no desktop a cabeça segue o cursor.
// Em WALK e RUN a grade corre embaixo dele (esteira). Em SWIM o disco vira água.
// Setas giram, 1 a 5 trocam o clipe. Pausa fora da tela e com a aba escondida.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"

export const CLIPS = ["Idle", "Walk", "Run", "Jump", "Swim"] as const
export type Clip = (typeof CLIPS)[number]
const GLB = "/landing/v3/dog/cachorro.glb"
const AZ_LIMIT = (70 * Math.PI) / 180

export interface StageHandle { setClip: (c: Clip) => void; rotate: (rad: number) => void }

// ── as texturas do chão, desenhadas em canvas (nenhum arquivo a mais) ──
function gridTexture(): THREE.CanvasTexture {
  const n = 512
  const c = document.createElement("canvas")
  c.width = c.height = n
  const g = c.getContext("2d")!
  g.clearRect(0, 0, n, n)
  // grade de agrimensura: a cada 64 px um fio, a cada 256 um fio mais forte (a escritura)
  for (let i = 0; i <= n; i += 32) {
    const strong = i % 128 === 0
    g.strokeStyle = strong ? "rgba(245,233,214,0.20)" : "rgba(245,233,214,0.075)"
    g.lineWidth = strong ? 2 : 1
    g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, n); g.stroke()
    g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(n, i + 0.5); g.stroke()
  }
  // as cruzes de registro
  g.strokeStyle = "rgba(245,233,214,0.32)"
  g.lineWidth = 2
  for (let x = 0; x < n; x += 128) for (let y = 0; y < n; y += 128) {
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  t.anisotropy = 4
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function plateTexture(): THREE.CanvasTexture {
  const n = 1024
  const c = document.createElement("canvas")
  c.width = c.height = n
  const g = c.getContext("2d")!
  const m = n / 2
  // o disco escuro que some na borda
  const rad = g.createRadialGradient(m, m, n * 0.05, m, m, m)
  rad.addColorStop(0, "rgba(34,30,24,1)")
  rad.addColorStop(0.62, "rgba(27,25,21,0.96)")
  rad.addColorStop(1, "rgba(21,19,15,0)")
  g.fillStyle = rad
  g.fillRect(0, 0, n, n)
  // os anéis da cidade (dodecágonos), sumindo para fora
  for (let k = 0; k < 4; k++) {
    const r = n * (0.24 + k * 0.07)
    g.strokeStyle = `rgba(245,233,214,${0.16 - k * 0.035})`
    g.lineWidth = 2
    g.beginPath()
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI * 2
      const x = m + r * Math.cos(a), y = m + r * Math.sin(a)
      if (i) g.lineTo(x, y); else g.moveTo(x, y)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function lotTexture(): THREE.CanvasTexture {
  const n = 512
  const c = document.createElement("canvas")
  c.width = c.height = n
  const g = c.getContext("2d")!
  g.clearRect(0, 0, n, n)
  // o contorno de um lote em fio lava, com os vértices A a D
  const x0 = n * 0.22, y0 = n * 0.26, x1 = n * 0.78, y1 = n * 0.74
  g.strokeStyle = "rgba(232,102,13,0.95)"
  g.lineWidth = 4
  g.strokeRect(x0, y0, x1 - x0, y1 - y0)
  g.fillStyle = "rgba(232,102,13,0.07)"
  g.fillRect(x0, y0, x1 - x0, y1 - y0)
  g.fillStyle = "#FF8A3D"
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill() }
  g.fillStyle = "rgba(245,233,214,0.7)"
  g.font = "600 22px monospace"
  g.fillText("A", x0 - 26, y0 - 8); g.fillText("B", x1 + 10, y0 - 8); g.fillText("C", x1 + 10, y1 + 26); g.fillText("D", x0 - 26, y1 + 26)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function blobTexture(): THREE.CanvasTexture {
  const n = 256
  const c = document.createElement("canvas")
  c.width = c.height = n
  const g = c.getContext("2d")!
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  r.addColorStop(0, "rgba(0,0,0,0.75)")
  r.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = r
  g.fillRect(0, 0, n, n)
  return new THREE.CanvasTexture(c)
}

export default function DogStage({
  clip, onReady, onError, reduced, handleRef,
}: {
  clip: Clip
  onReady: () => void
  onError: (msg: string) => void
  reduced: boolean
  handleRef: React.MutableRefObject<StageHandle | null>
}) {
  const host = useRef<HTMLDivElement>(null)
  const clipRef = useRef(clip)
  const reducedRef = useRef(reduced)
  const api = useRef<{ setClip: (c: Clip, userInitiated: boolean) => void; kick: () => void } | null>(null)
  const [, force] = useState(0)

  useEffect(() => { reducedRef.current = reduced }, [reduced])

  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    const desk = window.matchMedia("(min-width: 640px) and (min-height: 521px)").matches
    const fine = window.matchMedia("(pointer: fine)").matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
    } catch (e) {
      onError(`WebGL unavailable: ${(e as Error).message}`)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, desk ? 1.5 : 1.25))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.setAttribute("aria-hidden", "true")
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100)

    // luz: a Terra (fria, alto à esquerda) e o contraluz lava (direita)
    scene.add(new THREE.HemisphereLight(0x3a3f4a, 0x15130f, 0.55))
    const earth = new THREE.DirectionalLight(0xcfe0ff, 2.4)
    earth.position.set(-3.2, 5.2, 3.0)
    scene.add(earth)
    const rim = new THREE.DirectionalLight(0xff7a26, 3.2)
    rim.position.set(4.0, 2.2, -3.4)
    scene.add(rim)
    const fill = new THREE.DirectionalLight(0xffe2c4, 0.35)
    fill.position.set(0.5, 1.2, 5)
    scene.add(fill)

    // o chão
    const R = 2.4
    const ground = new THREE.Group()
    const plate = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ map: plateTexture(), transparent: true, depthWrite: false }))
    plate.rotation.x = -Math.PI / 2
    ground.add(plate)
    const gridTex = gridTexture()
    const gridMat = new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, depthWrite: false, opacity: 1 })
    const grid = new THREE.Mesh(new THREE.CircleGeometry(R * 0.82, 96), gridMat)
    grid.rotation.x = -Math.PI / 2
    grid.position.y = 0.001
    ground.add(grid)
    const lotMat = new THREE.MeshBasicMaterial({ map: lotTexture(), transparent: true, depthWrite: false, opacity: 1 })
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), lotMat)
    lot.rotation.x = -Math.PI / 2
    lot.position.y = 0.002
    ground.add(lot)
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }))
    blob.rotation.x = -Math.PI / 2
    blob.position.y = 0.003
    ground.add(blob)
    // a água do SWIM
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0c2630, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0 })
    const water = new THREE.Mesh(new THREE.CircleGeometry(R * 0.92, 96), waterMat)
    water.rotation.x = -Math.PI / 2
    ground.add(water)
    scene.add(ground)

    const dog = new THREE.Group()
    scene.add(dog)

    let mixer: THREE.AnimationMixer | null = null
    const actions = new Map<string, THREE.AnimationAction>()
    let current: THREE.AnimationAction | null = null
    let head: THREE.Object3D | null = null
    let height = 1
    let swimDepth = 0
    let yaw = 0
    let targetYaw = 0
    let headYaw = 0, headPitch = 0, wantHeadYaw = 0, wantHeadPitch = 0
    let running = false
    let visible = false
    let raf = 0
    let last = 0
    let swimT = 0
    let playing = !reducedRef.current

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      frame()
    }

    const frameCamera = () => {
      // enquadra o $DOG inteiro com folga, olhando um pouco de cima
      const h = height
      const dist = (h * 1.32) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.min(1, camera.aspect * 1.25)
      camera.position.set(0, h * 0.78, dist)
      camera.lookAt(0, h * 0.5, 0)
    }

    const render = () => renderer.render(scene, camera)
    const frame = () => { frameCamera(); render() }

    const loop = (t: number) => {
      raf = 0
      if (!running) return
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016)
      last = t
      if (mixer && playing) {
        mixer.update(dt)
        // a cabeça segue o cursor: aditivo, logo depois do mixer (que reescreve o osso a cada quadro)
        headYaw += (wantHeadYaw - headYaw) * Math.min(1, dt * 6)
        headPitch += (wantHeadPitch - headPitch) * Math.min(1, dt * 6)
        if (head && (Math.abs(headYaw) > 1e-3 || Math.abs(headPitch) > 1e-3)) {
          head.rotateY(headYaw)
          head.rotateX(headPitch)
        }
      }
      yaw += (targetYaw - yaw) * Math.min(1, dt * 8)
      dog.rotation.y = yaw
      // a esteira: a grade corre para trás do $DOG
      const c = clipRef.current
      const speed = !playing ? 0 : c === "Walk" ? 0.32 : c === "Run" ? 0.9 : 0
      if (speed) {
        gridTex.offset.x -= Math.sin(yaw) * speed * dt
        gridTex.offset.y += Math.cos(yaw) * speed * dt
      }
      const wantLot = speed ? 0 : 1
      lotMat.opacity += (wantLot - lotMat.opacity) * Math.min(1, dt * 4)
      const swim = c === "Swim"
      const wantWater = swim ? 0.93 : 0
      waterMat.opacity += (wantWater - waterMat.opacity) * Math.min(1, dt * 4)
      gridMat.opacity += ((swim ? 0 : 1) - gridMat.opacity) * Math.min(1, dt * 4)
      swimT += dt
      water.position.y = swim ? swimDepth + Math.sin(swimT * 1.6) * 0.008 : 0.004
      dog.position.y += ((swim ? -swimDepth * 0.15 : 0) - dog.position.y) * Math.min(1, dt * 4)
      frame()
      raf = requestAnimationFrame(loop)
    }
    const start = () => { if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop) } }
    const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0 }
    const kick = () => {
      if (playing && visible && !document.hidden) start()
      else { yaw = targetYaw; dog.rotation.y = yaw; frame() }   // parado: um quadro só, já no ângulo
    }

    const setClip = (name: Clip, user: boolean) => {
      clipRef.current = name
      if (user) playing = true          // movimento reduzido: o toque no chip ainda anima
      const a = actions.get(name)
      if (!a || a === current) { kick(); return }
      a.reset()
      a.setLoop(name === "Jump" ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
      a.clampWhenFinished = true
      a.enabled = true
      if (current) a.crossFadeFrom(current, 0.25, true)
      a.play()
      current = a
      kick()
    }
    api.current = { setClip, kick }
    handleRef.current = {
      setClip: (c) => setClip(c, true),
      rotate: (rad) => { targetYaw = THREE.MathUtils.clamp(targetYaw + rad, -AZ_LIMIT, AZ_LIMIT); kick() },
    }

    // ── a carga: KTX2 (basis do próprio site) + meshopt ──
    const ktx2 = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer)
    const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
    loader.load(
      GLB,
      (gltf) => {
        if (disposed) return
        const root = gltf.scene
        root.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) { m.frustumCulled = false }
          if (/^head$/i.test(o.name)) head = o
        })
        // normaliza: pés no chão, centrado. As matrizes do mundo PRIMEIRO: sem isto
        // a caixa sai da geometria crua (o rig do jogo tem escala no nó) e o $DOG
        // aparece gigante, cortado pela câmera.
        root.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(root, true)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const k = 1.6 / Math.max(0.001, size.y)
        root.scale.setScalar(k)
        root.position.set(-center.x * k, -box.min.y * k, -center.z * k)
        height = size.y * k
        swimDepth = height * 0.42
        dog.add(root)
        mixer = new THREE.AnimationMixer(root)
        mixer.addEventListener("finished", () => { if (clipRef.current === "Jump") setClip("Idle", false) })
        for (const c of gltf.animations) actions.set(c.name, mixer.clipAction(c))
        setClip(clipRef.current, false)
        if (!playing) { mixer.update(0); }
        resize()
        onReady()
        force((n) => n + 1)
      },
      undefined,
      (err) => {
        if (disposed) return
        const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err)
        onError(msg)
      },
    )

    // ── interação ──
    let drag: { x: number; yaw: number } | null = null
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, yaw: targetYaw }
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (drag) {
        const w = el.clientWidth || 1
        targetYaw = THREE.MathUtils.clamp(drag.yaw + ((e.clientX - drag.x) / w) * Math.PI * 1.2, -AZ_LIMIT, AZ_LIMIT)
        kick()
      }
    }
    const onUp = () => { drag = null }
    const onWinMove = (e: PointerEvent) => {
      if (!fine || e.pointerType !== "mouse" || !visible) return
      const r = el.getBoundingClientRect()
      const nx = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.8), -1, 1)
      const ny = THREE.MathUtils.clamp((e.clientY - (r.top + r.height * 0.3)) / (r.height * 0.8), -1, 1)
      wantHeadYaw = nx * 0.55
      wantHeadPitch = ny * 0.3
      kick()
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onUp)
    window.addEventListener("pointermove", onWinMove, { passive: true })

    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !document.hidden && playing) start()
      else stop()
    }, { threshold: 0.01 })
    io.observe(el)
    const onVis = () => { if (document.hidden) stop(); else if (visible && playing) start() }
    document.addEventListener("visibilitychange", onVis)
    resize()

    return () => {
      disposed = true
      stop()
      ro.disconnect(); io.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("pointermove", onWinMove)
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onUp)
      ktx2.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        for (const mt of mats) {
          for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose()
          mt.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
      api.current = null
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (clip !== clipRef.current) api.current?.setClip(clip, true)
  }, [clip])

  return <div ref={host} className="absolute inset-0 touch-pan-y cursor-grab active:cursor-grabbing" />
}
