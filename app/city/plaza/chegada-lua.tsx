'use client'

import * as THREE from 'three'
import { useEffect, useRef } from 'react'

// A CHEGADA PELA LUA (fundador, 16/09): "o cara nem sabe que a cidade é na lua".
// A /city abria direto no chão da Mare Tranquillitatis, e sem ver o globo nada
// diz que aquilo é a Lua. Esta peça ocupa o fundo da cortina de carga: o globo
// inteiro gira até o sítio ficar de frente, se aproxima conforme a carga anda,
// e quando a cidade fica pronta a câmera mergulha no ponto e a cortina cai.
//
// ⚠️ É UM CONTEXTO WEBGL SEPARADO, de propósito. A cena da cidade está montando
// no mesmo minuto (o boot é thread e rede pesados) e não renderiza nada útil
// enquanto a cortina está de pé; um canvas próprio, com uma esfera e duas
// texturas, não depende de nenhuma etapa do boot e morre inteiro no fim
// (`forceContextLoss`). No celular: texturas de 1024 e 30 quadros por segundo.
//
// Texturas: `scripts/city/lua-textura.mjs` (LROC color + relevo LOLA da NASA,
// borda esquerda da imagem em -180°).

// o sítio da btc-core (o mesmo da cidade inteira): ao lado da Apollo 11
const SITIO_LAT = 0.674
const SITIO_LON = 23.473

// quanto tempo a Lua fica na tela no mínimo, mesmo com cache quente: menos que
// isto e o giro não termina, e sem o giro ninguém lê "globo"
const LUA_MINIMO_S = 4.5
const MERGULHO_S = 3.6
// fração do mergulho em que a cortina começa a cair. Abaixo de ~90 km de altura
// a textura de 2048 já lê borrada; a cidade entra por cima antes disso.
const MERGULHO_CORTINA = 0.52
// altura final do mergulho, em raios lunares (0,006 R = 10 km)
const ALTURA_FIM = 0.006

const LARANJA = '#F7931A'

type Props = {
  /** 0 a 100, a mesma barra do portão */
  progresso: number
  /** a cidade abriu: pode mergulhar */
  pronto: boolean
  /** chamado quando a cortina deve começar a cair */
  onFim: () => void
}

const suave = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const cubica = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

export default function ChegadaLua({ progresso, pronto, onFim }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const marcaRef = useRef<HTMLDivElement>(null)
  // o laço lê por ref: re-render do portão (a barra anda várias vezes por
  // segundo) não pode recriar o renderer
  const progressoRef = useRef(progresso)
  const prontoRef = useRef(pronto)
  const onFimRef = useRef(onFim)
  progressoRef.current = progresso
  prontoRef.current = pronto
  onFimRef.current = onFim

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    } catch {
      // sem WebGL a cortina continua sendo a de sempre; a cidade também não
      // abriria, então não há o que mergulhar
      onFimRef.current()
      return
    }
    const celular = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, celular ? 1.5 : 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 1)
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.0005, 400)

    const tam = celular ? 1024 : 2048
    const loader = new THREE.TextureLoader()
    const texturas: THREE.Texture[] = []
    const tex = (url: string, srgb: boolean) => {
      const t = loader.load(url)
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      texturas.push(t)
      return t
    }

    // ── a Lua: raio 1, sítio levado para +Z (de frente para a câmera)
    const lua = new THREE.Group()
    scene.add(lua)
    const materialLua = new THREE.MeshStandardMaterial({
      map: tex(`/city/moon/moon_color_${tam}.jpg`, true),
      normalMap: tex(`/city/moon/moon_normal_${tam}.jpg`, false),
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughness: 1,
      metalness: 0,
    })
    const globo = new THREE.Mesh(new THREE.SphereGeometry(1, celular ? 128 : 192, celular ? 64 : 96), materialLua)
    lua.add(globo)
    // ⚠️ CONVENÇÃO: com a borda esquerda da textura em -180°, a longitude L do
    // SphereGeometry aponta para (cos L, 0, -sin L). Girar Y por a leva L para
    // L + a, e +Z é o ângulo -90°: a = -90° - L. Depois X pela latitude.
    const phi = THREE.MathUtils.degToRad(SITIO_LAT)
    const lam = THREE.MathUtils.degToRad(SITIO_LON)
    const yawSitio = -Math.PI / 2 - lam
    lua.rotation.order = 'XYZ'
    lua.rotation.x = phi
    const sitioLocal = new THREE.Vector3(Math.cos(phi) * Math.cos(lam), Math.sin(phi), -Math.cos(phi) * Math.sin(lam))

    // o brilho da cidade no sítio: o ponto quente para onde o mergulho cai
    const brilhoCanvas = document.createElement('canvas')
    brilhoCanvas.width = brilhoCanvas.height = 64
    {
      const c = brilhoCanvas.getContext('2d')!
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,214,160,1)')
      g.addColorStop(0.25, 'rgba(247,147,26,0.55)')
      g.addColorStop(1, 'rgba(247,147,26,0)')
      c.fillStyle = g
      c.fillRect(0, 0, 64, 64)
    }
    const brilhoTex = new THREE.CanvasTexture(brilhoCanvas)
    texturas.push(brilhoTex)
    const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilhoTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }))
    brilho.position.copy(sitioLocal).multiplyScalar(1.0005)
    lua.add(brilho)

    // ── sol de lado: o terminador na borda direita é o que desenha as crateras
    const sol = new THREE.DirectionalLight(0xfff4e6, 3.2)
    sol.position.set(-0.85, 0.3, 0.6)
    scene.add(sol)
    scene.add(new THREE.AmbientLight(0x8aa4ff, 0.05)) // luz da Terra

    // ── a Terra ao fundo, pequena, só no quadro deitado
    const terra = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 48, 32),
      new THREE.MeshStandardMaterial({ map: tex('/city/earth/earth_atmos_1024.jpg', true), roughness: 0.9 }),
    )
    terra.position.set(-6.4, 3.1, -16)
    terra.rotation.z = 0.41
    scene.add(terra)

    // ── estrelas
    {
      const n = celular ? 900 : 1800
      const pos = new Float32Array(n * 3)
      const col = new Float32Array(n * 3)
      let s = 11
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u)
        pos[i * 3] = 150 * q * Math.cos(t); pos[i * 3 + 1] = 150 * u; pos[i * 3 + 2] = 150 * q * Math.sin(t)
        const b = 0.25 + rnd() * 0.75
        col[i * 3] = b; col[i * 3 + 1] = b * 0.97; col[i * 3 + 2] = b
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, depthWrite: false })))
    }

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth
      const h = mount.clientHeight || window.innerHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    // distância (em raios, do centro) para o disco ocupar `fração` da menor
    // dimensão da tela. Em retrato a largura manda.
    const distanciaPara = (fracao: number) => {
      const tanMeia = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect)
      return 1 / Math.sin(Math.atan(fracao * tanMeia))
    }

    const t0 = performance.now()
    let progressoSuave = 0
    let mergulhoT0 = -1
    let dMergulho = 0
    let giroMergulho = 0
    let avisou = false
    let ultimo = 0
    let raf = 0
    const sitioMundo = new THREE.Vector3()
    const paraCamera = new THREE.Vector3()
    const tela = new THREE.Vector3()

    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro)
      // 30 qps no celular: a cidade está montando no mesmo aparelho
      if (celular && agora - ultimo < 32) return
      const dt = Math.min(0.1, (agora - (ultimo || agora)) / 1000)
      ultimo = agora
      const t = (agora - t0) / 1000

      // a carga anda aos saltos; a câmera não
      const alvo = Math.max(progressoRef.current / 100, Math.min(0.12, t / 60))
      progressoSuave += (alvo - progressoSuave) * Math.min(1, dt * 1.2)

      // o giro: o sítio entra pela esquerda e para de frente
      let giro = THREE.MathUtils.degToRad(-58) * (1 - suave(t / 9))
      let d = distanciaPara(THREE.MathUtils.lerp(0.62, 1.5, suave(progressoSuave)))
      // deriva lenta para a cena nunca congelar enquanto a barra espera
      const deriva = Math.sin(t * 0.11) * 0.035

      if (mergulhoT0 < 0 && prontoRef.current && t >= LUA_MINIMO_S) {
        mergulhoT0 = t
        dMergulho = d
        giroMergulho = giro
      }
      let e = 0
      if (mergulhoT0 >= 0) {
        e = cubica((t - mergulhoT0) / MERGULHO_S)
        giro = giroMergulho * (1 - e)
        const h0 = dMergulho - 1
        d = 1 + h0 * Math.pow(ALTURA_FIM / h0, e)
        if (!avisou && e >= MERGULHO_CORTINA) {
          avisou = true
          onFimRef.current()
        }
      }

      lua.rotation.y = yawSitio + giro + deriva * (1 - e)
      lua.updateMatrixWorld()
      sitioMundo.copy(sitioLocal).applyMatrix4(lua.matrixWorld)

      // câmera sobre o eixo do sítio visto de frente (+Z), com um leve desvio
      // para cima que some no mergulho: de longe é retrato, de perto é queda
      const desvio = 0.12 * (1 - e)
      camera.position.set(0, desvio * (d - 1), d)
      camera.up.set(0, 1, 0)
      camera.lookAt(sitioMundo.x * (e * 0.999), sitioMundo.y * e, sitioMundo.z * e)

      // o brilho: um alfinete de tamanho constante na tela enquanto a Lua é
      // disco, e de perto trava no tamanho físico da cidade (~21 km), que é
      // quando ele deixa de ser marca e vira a luz para onde se cai
      const alt = Math.max(0.0001, camera.position.distanceTo(sitioMundo))
      brilho.scale.setScalar(Math.max(alt * (0.018 + 0.006 * Math.sin(t * 2.2) * (1 - e)), 0.012))

      renderer.render(scene, camera)

      // ── a marca do sítio (visor: sem caixa, só halo)
      const marca = marcaRef.current
      if (marca) {
        paraCamera.copy(camera.position).sub(sitioMundo).normalize()
        const deFrente = sitioMundo.clone().normalize().dot(paraCamera)
        tela.copy(sitioMundo).project(camera)
        const w = mount.clientWidth, h = mount.clientHeight
        const x = (tela.x * 0.5 + 0.5) * w
        const y = (-tela.y * 0.5 + 0.5) * h
        const op = suave((deFrente - 0.2) / 0.3) * suave((t - 2.5) / 1.5) * (1 - suave(e / 0.2))
        marca.style.opacity = op.toFixed(3)
        marca.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
    }
    raf = requestAnimationFrame(quadro)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) x.dispose()
      })
      for (const t of texturas) t.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={marcaRef}
        className="pointer-events-none absolute left-0 top-0 will-change-transform"
        style={{ opacity: 0 }}
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border" style={{ borderColor: LARANJA }} />
          <span className="block h-2 w-2 rounded-full" style={{ background: LARANJA, boxShadow: `0 0 10px ${LARANJA}` }} />
        </div>
        <div
          className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap text-left font-mono"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.75)' }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: LARANJA }}>DogCity</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Mare Tranquillitatis</div>
        </div>
      </div>
    </div>
  )
}
