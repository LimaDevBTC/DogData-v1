'use client'

// A CRATERA DA GUERRA, palco solo: a rota /city/war com câmera, céu e HUD
// próprios em cima do motor compartilhado de battlefield.ts. A mesma batalha
// também vive dentro do mundo da DogCity; aqui é o link direto compartilhável.
//
// ⚠️ r3f NÃO ENTRA NESTE REPO (quebra em runtime): Three.js cru, como toda
// cena da cidade. Zero assets externos.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createBattlefield, type OrcamentoBatalha } from './battlefield'

const fmtDog = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)
const fmtPreco = (p: number) => (p > 0 ? p.toFixed(6) : '-')

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ── orçamento por aparelho ────────────────────────────────────────────────────
type Tier = 'low' | 'mid' | 'high'

function detectaTier(): Tier {
  if (typeof navigator === 'undefined') return 'mid'
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const mem = (navigator as any).deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  let gpuFraca = false
  try {
    const probe = document.createElement('canvas')
    const gl = (probe.getContext('webgl2') || probe.getContext('webgl')) as WebGLRenderingContext | null
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    if (gl && dbg) {
      const nome = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
      gpuFraca = /adreno (5|6[0-3])|mali-g5|mali-g4|powervr/.test(nome)
    }
  } catch {}
  if (!mobile && cores >= 8 && mem >= 8) return 'high'
  if (mobile && (mem <= 3 || cores <= 4 || gpuFraca)) return 'low'
  return mobile ? 'mid' : 'high'
}

const ORCAMENTO: Record<Tier, OrcamentoBatalha & { dpr: number; antialias: boolean; bloom: boolean; motas: number }> = {
  low:  { dpr: 1.0, cap: 1000, niveis: 18, antialias: false, bloom: false, maxOndas: 6,  maxLuzes: 2, detritos: 160, poeiraMax: 240, faiscaMax: 80,  motas: 150 },
  mid:  { dpr: 1.5, cap: 2200, niveis: 28, antialias: false, bloom: false, maxOndas: 10, maxLuzes: 3, detritos: 350, poeiraMax: 500, faiscaMax: 140, motas: 300 },
  high: { dpr: 2.0, cap: 4200, niveis: 40, antialias: true,  bloom: true,  maxOndas: 20, maxLuzes: 6, detritos: 700, poeiraMax: 900, faiscaMax: 240, motas: 500 },
}

interface Hud {
  preco: number
  delta24: number
  status: 'connecting' | 'live' | 'down'
  ursosCaidos: number
  caesCaidos: number
  compra: number
  venda: number
}

export default function WarScene() {
  const montagem = useRef<HTMLDivElement>(null)
  const [hud, setHud] = useState<Hud>({
    preco: 0, delta24: 0, status: 'connecting', ursosCaidos: 0, caesCaidos: 0, compra: 0, venda: 0,
  })
  const [baleia, setBaleia] = useState<{ lado: 'buy' | 'sell'; chave: number } | null>(null)

  useEffect(() => {
    const el = montagem.current
    if (!el) return
    const orc = ORCAMENTO[detectaTier()]

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x040305, 0.0024)

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.5, 1400)

    const renderer = new THREE.WebGLRenderer({ antialias: orc.antialias })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, orc.dpr))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    el.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 24
    controls.maxDistance = 260
    controls.maxPolarAngle = 1.38

    // retrato precisa de mais recuo pros dois exércitos caberem no quadro
    const retrato = el.clientWidth < el.clientHeight
    const enquadre = retrato
      ? { pos: new THREE.Vector3(-74, 44, 94), tgt: new THREE.Vector3(10, 2, -8) }
      : { pos: new THREE.Vector3(-54, 31, 68), tgt: new THREE.Vector3(16, 2, -12) }
    const introDe = { pos: new THREE.Vector3(4, 210, 130), tgt: new THREE.Vector3(0, 10, 0) }
    camera.position.copy(introDe.pos)
    controls.target.copy(introDe.tgt)
    controls.enabled = false
    let introT0: number | null = performance.now()
    const easeOutQuint = (t: number) => 1 - (1 - t) ** 5

    controls.autoRotateSpeed = 0.12
    let deriva: ReturnType<typeof setTimeout> | null = null
    const pausaDeriva = () => {
      controls.autoRotate = false
      if (deriva) clearTimeout(deriva)
    }
    const agendaDeriva = () => {
      deriva = setTimeout(() => { controls.autoRotate = true }, 4000)
    }
    controls.addEventListener('start', pausaDeriva)
    controls.addEventListener('end', agendaDeriva)

    const altura = (x: number, z: number) => {
      const r = Math.hypot(x / 1.35, z)
      const bacia = -3.2 * Math.exp(-((r / 95) ** 2))
      const borda = 2.6 * Math.exp(-(((r - 128) / 26) ** 2))
      const rugosidade =
        0.55 * Math.sin(x * 0.11 + z * 0.07) * Math.sin(z * 0.13 - x * 0.05) +
        0.3 * (hash(Math.round(x * 0.5), Math.round(z * 0.5)) - 0.5)
      return bacia + borda + rugosidade
    }

    const sol = new THREE.DirectionalLight(0xffd9ae, 2.6)
    sol.position.set(60, 38, 120)
    scene.add(sol)
    scene.add(new THREE.HemisphereLight(0x34344a, 0x120c08, 1.15))
    const brasa = new THREE.DirectionalLight(0x9c3a28, 0.9)
    brasa.position.set(140, 26, -60)
    scene.add(brasa)
    const solDir = sol.position.clone().normalize()

    // céu com disco solar
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        sunDir: { value: solDir },
        topo: { value: new THREE.Color(0x03040a) },
        horizonte: { value: new THREE.Color(0x140a10) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 sunDir; uniform vec3 topo; uniform vec3 horizonte; varying vec3 vDir;
        void main(){
          float alt = clamp(vDir.y, -0.15, 1.0);
          vec3 ceu = mix(horizonte, topo, smoothstep(-0.05, 0.55, alt));
          float s = max(dot(vDir, sunDir), 0.0);
          float disco = pow(s, 200.0) * 3.0 + pow(s, 8.0) * 0.25;
          gl_FragColor = vec4(ceu + disco * vec3(1.0, 0.75, 0.45), 1.0);
        }`,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), skyMat))

    // a Terra pintada à mão, o selo de que isto é a Lua
    const terraCv = document.createElement('canvas')
    terraCv.width = terraCv.height = 256
    {
      const cx = terraCv.getContext('2d')!
      const grd = cx.createRadialGradient(104, 96, 10, 128, 128, 108)
      grd.addColorStop(0, '#6ea0e6')
      grd.addColorStop(0.55, '#2c5aa0')
      grd.addColorStop(1, '#12294f')
      cx.fillStyle = grd
      cx.beginPath()
      cx.arc(128, 128, 108, 0, Math.PI * 2)
      cx.fill()
      cx.save()
      cx.clip()
      cx.fillStyle = 'rgba(74,120,64,0.6)'
      for (let i = 0; i < 14; i++) {
        const x = 40 + hash(i, 3) * 176
        const y = 36 + hash(i, 9) * 180
        cx.beginPath()
        cx.ellipse(x, y, 14 + hash(i, 1) * 22, 9 + hash(i, 2) * 14, hash(i, 4) * 6, 0, Math.PI * 2)
        cx.fill()
      }
      cx.fillStyle = 'rgba(255,255,255,0.28)'
      for (let i = 0; i < 10; i++) {
        const x = 30 + hash(i, 23) * 196
        const y = 30 + hash(i, 31) * 196
        cx.beginPath()
        cx.ellipse(x, y, 20 + hash(i, 11) * 26, 5 + hash(i, 12) * 7, hash(i, 14) * 6, 0, Math.PI * 2)
        cx.fill()
      }
      const noite = cx.createLinearGradient(0, 0, 256, 60)
      noite.addColorStop(0.55, 'rgba(2,4,10,0)')
      noite.addColorStop(1, 'rgba(2,4,10,0.9)')
      cx.fillStyle = noite
      cx.fillRect(0, 0, 256, 256)
      cx.restore()
      cx.strokeStyle = 'rgba(140,190,255,0.5)'
      cx.lineWidth = 3
      cx.beginPath()
      cx.arc(128, 128, 109, 0, Math.PI * 2)
      cx.stroke()
    }
    const terra = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(terraCv), transparent: true, fog: false, depthWrite: false,
    }))
    terra.scale.setScalar(72)
    terra.position.set(252, 68, 26)
    scene.add(terra)

    // estrelas com cor e cintilação
    const nEstrelas = 2200
    const posEs = new Float32Array(nEstrelas * 3)
    const tamEs = new Float32Array(nEstrelas)
    const faseEs = new Float32Array(nEstrelas)
    const corEs = new Float32Array(nEstrelas * 3)
    {
      const frio = new THREE.Color(0xaeb8ff)
      const quente = new THREE.Color(0xffdca8)
      const v = new THREE.Vector3()
      const c = new THREE.Color()
      for (let i = 0; i < nEstrelas; i++) {
        v.randomDirection().multiplyScalar(820)
        v.y = Math.abs(v.y) * 0.9 + 24
        posEs.set([v.x, v.y, v.z], i * 3)
        tamEs[i] = 1.0 + Math.pow(hash(i, 5), 4) * 5.0
        faseEs[i] = hash(i, 8) * Math.PI * 2
        c.copy(frio).lerp(quente, hash(i, 13))
        corEs.set([c.r, c.g, c.b], i * 3)
      }
    }
    const gEs = new THREE.BufferGeometry()
    gEs.setAttribute('position', new THREE.BufferAttribute(posEs, 3))
    gEs.setAttribute('tam', new THREE.BufferAttribute(tamEs, 1))
    gEs.setAttribute('fase', new THREE.BufferAttribute(faseEs, 1))
    gEs.setAttribute('cor', new THREE.BufferAttribute(corEs, 3))
    const matEs = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float tam; attribute float fase; attribute vec3 cor;
        varying vec3 vCor; varying float vBrilho; uniform float time;
        void main(){
          vCor = cor;
          vBrilho = 0.65 + 0.35 * sin(time * 1.4 + fase * 3.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = tam * (420.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vCor; varying float vBrilho;
        void main(){ float d = distance(gl_PointCoord, vec2(0.5)); gl_FragColor = vec4(vCor * vBrilho, smoothstep(0.5, 0.0, d)); }`,
    })
    scene.add(new THREE.Points(gEs, matEs))

    // motas de poeira afunilando na frente
    const posPo = new Float32Array(orc.motas * 3)
    const fasePo = new Float32Array(orc.motas)
    for (let i = 0; i < orc.motas; i++) {
      const z = (hash(i, 2) - 0.5) * 140
      const x = (hash(i, 4) - 0.5) * 40 * (1 - Math.abs(z) / 90)
      posPo.set([x, 0.4 + hash(i, 6) * 5, z], i * 3)
      fasePo[i] = hash(i, 7) * Math.PI * 2
    }
    const gPo = new THREE.BufferGeometry()
    gPo.setAttribute('position', new THREE.BufferAttribute(posPo, 3))
    gPo.setAttribute('fase', new THREE.BufferAttribute(fasePo, 1))
    const matPo = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, cor: { value: new THREE.Color(0xd9b98a) } },
      vertexShader: `
        attribute float fase; uniform float time; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(time * 0.15 + fase) * 3.0;
          p.y += sin(time * 0.3 + fase * 2.0) * 0.6 + 0.4;
          vA = 0.5 + 0.5 * sin(time * 0.6 + fase);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 26.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 cor; varying float vA;
        void main(){ float d = distance(gl_PointCoord, vec2(0.5)); gl_FragColor = vec4(cor, smoothstep(0.5, 0.0, d) * vA * 0.35); }`,
    })
    scene.add(new THREE.Points(gPo, matPo))

    // regolito
    {
      const g = new THREE.PlaneGeometry(420, 300, 130, 92)
      g.rotateX(-Math.PI / 2)
      const pos = g.attributes.position
      for (let i = 0; i < pos.count; i++) pos.setY(i, altura(pos.getX(i), pos.getZ(i)))
      g.computeVertexNormals()
      scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 1 })))
    }

    // ── o motor da batalha ──────────────────────────────────────────────────
    let tremorT0 = -1
    let tremorForca = 0
    const campo = createBattlefield(altura, orc, (lado, forca) => {
      setBaleia({ lado, chave: performance.now() })
      tremorT0 = performance.now()
      tremorForca = Math.min(1, forca / 40)
    })
    scene.add(campo.group)
    campo.setLive(true)

    // ── pós: bloom meia resolução + grading, só no tier alto ────────────────
    let composer: EffectComposer | null = null
    let gradePass: ShaderPass | null = null
    if (orc.bloom) {
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(Math.floor(el.clientWidth / 2), Math.floor(el.clientHeight / 2)), 0.55, 0.4, 0.86,
      ))
      gradePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          splitX: { value: 0.5 },
          quente: { value: new THREE.Color(0xff9a4d) },
          frio: { value: new THREE.Color(0x4d7aff) },
          vinheta: { value: 0.5 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
        fragmentShader: `
          uniform sampler2D tDiffuse; uniform float splitX; uniform vec3 quente; uniform vec3 frio; uniform float vinheta;
          varying vec2 vUv;
          void main(){
            vec4 c = texture2D(tDiffuse, vUv);
            float lado = smoothstep(splitX - 0.28, splitX + 0.28, vUv.x);
            vec3 tint = mix(quente, frio, lado);
            c.rgb = mix(c.rgb, c.rgb * tint / max(max(tint.r, tint.g), tint.b), 0.18);
            vec2 uv = vUv - 0.5;
            float vig = 1.0 - dot(uv, uv) * vinheta;
            c.rgb *= clamp(vig, 0.4, 1.0);
            gl_FragColor = c;
          }`,
      })
      composer.addPass(gradePass)
      composer.addPass(new OutputPass())
    }

    // ── laço ────────────────────────────────────────────────────────────────
    let vivo = true
    let visivel = !document.hidden
    const aoMudarVisibilidade = () => {
      visivel = !document.hidden
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)

    let ultimoHud = 0
    const ndc = new THREE.Vector3()

    const anima = (agora: number) => {
      if (!vivo) return
      requestAnimationFrame(anima)
      if (!visivel) return

      if (introT0 !== null) {
        const f = Math.min(1, (agora - introT0) / 3000)
        const e = easeOutQuint(f)
        camera.position.lerpVectors(introDe.pos, enquadre.pos, e)
        controls.target.lerpVectors(introDe.tgt, enquadre.tgt, e)
        camera.lookAt(controls.target)
        if (f >= 1) {
          controls.enabled = true
          introT0 = null
          agendaDeriva()
        }
      }

      campo.update(agora)

      const seg = agora * 0.001
      matEs.uniforms.time.value = seg
      matPo.uniforms.time.value = seg

      if (gradePass) {
        ndc.set(0, altura(0, 0), 0).project(camera)
        gradePass.uniforms.splitX.value = ndc.x * 0.5 + 0.5
      }

      if (agora - ultimoHud > 500) {
        ultimoHud = agora
        const h = campo.hud()
        setHud({
          preco: h.preco,
          delta24: h.open24 > 0 && h.preco > 0 ? (h.preco - h.open24) / h.open24 : 0,
          status: h.status,
          ursosCaidos: h.ursosCaidos,
          caesCaidos: h.caesCaidos,
          compra: h.compra,
          venda: h.venda,
        })
      }

      if (introT0 === null) controls.update()

      let sx = 0
      let sy = 0
      if (tremorT0 > 0) {
        const ft = (agora - tremorT0) / 700
        if (ft >= 1) tremorT0 = -1
        else {
          const amp = 0.55 * tremorForca * (1 - ft)
          sx = (hash(Math.floor(agora * 0.06), 1) - 0.5) * amp
          sy = (hash(Math.floor(agora * 0.06), 2) - 0.5) * amp
        }
      }
      camera.position.x += sx
      camera.position.y += sy
      if (composer) composer.render()
      else renderer.render(scene, camera)
      camera.position.x -= sx
      camera.position.y -= sy
    }
    requestAnimationFrame(anima)

    const aoRedimensionar = () => {
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
      composer?.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', aoRedimensionar)

    return () => {
      vivo = false
      window.removeEventListener('resize', aoRedimensionar)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      controls.removeEventListener('start', pausaDeriva)
      controls.removeEventListener('end', agendaDeriva)
      if (deriva) clearTimeout(deriva)
      controls.dispose()
      campo.dispose()
      scene.traverse((obj) => {
        const g = (obj as THREE.Mesh).geometry
        if (g) g.dispose()
        const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else if (mat) {
          const map = (mat as THREE.SpriteMaterial).map
          if (map) map.dispose()
          mat.dispose()
        }
      })
      composer?.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  const vivoAgora = hud.status === 'live'
  const total = hud.compra + hud.venda
  const fracaoCompra = total > 0 ? hud.compra / total : 0.5

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={montagem} className="absolute inset-0" />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.42) 100%)' }}
      />

      {baleia && (
        <div
          key={baleia.chave}
          onAnimationEnd={() => setBaleia(null)}
          className="absolute inset-0 pointer-events-none animate-baleia"
          style={{ background: `radial-gradient(ellipse at center, transparent 42%, ${baleia.lado === 'buy' ? 'rgba(247,147,26,0.16)' : 'rgba(200,40,60,0.16)'} 100%)` }}
        />
      )}

      <div className="absolute top-4 left-5 font-mono text-[10px] tracking-[0.22em] uppercase text-white/45 select-none">
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${vivoAgora ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        Kraken {vivoAgora ? 'live' : hud.status}
        <div className="mt-1 text-white/30 hidden sm:block">War Crater · 3 km SW of Central Plaza</div>
      </div>

      <div className="absolute top-10 sm:top-4 inset-x-0 text-center select-none pointer-events-none">
        <div className="font-mono text-3xl md:text-4xl text-white/95 tabular-nums tracking-tight [text-shadow:0_1px_14px_rgba(0,0,0,0.7)]">
          ${fmtPreco(hud.preco)}
        </div>
        <div className="mx-auto mt-1.5 h-px w-8 bg-white/20" />
        <div className="font-mono text-[11px] tracking-[0.2em] mt-1.5 text-white/40 uppercase">
          DOG / USD
          {hud.delta24 !== 0 && (
            <span className={`tabular-nums ml-3 ${hud.delta24 > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
              {hud.delta24 > 0 ? '+' : ''}{(hud.delta24 * 100).toFixed(2)}% 24h
            </span>
          )}
        </div>
      </div>

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-60 sm:w-72 select-none pointer-events-none">
        <div className="flex justify-between font-mono text-[10px] tracking-[0.18em] uppercase mb-1">
          <span className="text-[#f7931a]/85 tabular-nums">Dogs {fmtDog(hud.compra)}</span>
          <span className="text-red-400/75 tabular-nums">{fmtDog(hud.venda)} Bears</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden bg-white/10">
          <div className="h-full bg-gradient-to-r from-[#f7931a] to-[#c96a12]" style={{ width: `${fracaoCompra * 100}%` }} />
        </div>
      </div>

      <div className="absolute bottom-20 sm:bottom-7 right-4 sm:right-5 text-right font-mono text-[10px] tracking-[0.18em] uppercase text-white/40 select-none">
        <div>Bears fallen <span className="text-white/75 tabular-nums">{fmtDog(hud.ursosCaidos)}</span></div>
        <div>Dogs fallen <span className="text-white/75 tabular-nums">{fmtDog(hud.caesCaidos)}</span></div>
      </div>

      <div className="absolute bottom-7 left-5 font-mono text-[10px] tracking-[0.18em] uppercase text-white/25 select-none hidden md:block">
        drag to orbit · scroll to zoom
      </div>

      <div className="absolute bottom-1.5 inset-x-0 text-center font-mono text-[9px] tracking-[0.32em] uppercase text-white/20 select-none pointer-events-none">
        dogdata.xyz
      </div>
    </div>
  )
}
