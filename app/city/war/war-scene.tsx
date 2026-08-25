'use client'

// A CRATERA DA GUERRA, v2: o book de DOG/USD da Kraken como campo de batalha.
//
// A linha de frente é o preço. À esquerda, os cães Shiba de casaco laranja
// Bitcoin (as compras); à direita, os ursos (as vendas). Cada fileira é um
// nível do book, a distância até a frente é a distância até o preço, o tamanho
// da tropa é o volume parado ali, e cada trade cruza o campo como um disparo
// em quatro camadas de impacto: clarão, onda, poeira e faíscas, com soldados
// tombando de verdade e cicatriz que o vento apaga.
//
// ⚠️ O ORÇAMENTO VEM ANTES DA BELEZA. Tudo aqui nasce dimensionado por tier de
// aparelho (low/mid/high): instâncias, níveis do book, partículas, DPR, bloom.
// Um celular fraco recebe a MESMA cena com menos soldados e sem pós, nunca uma
// cena quebrada. E NADA aloca por trade: projéteis, rastros, ondas, luzes,
// clarões, cicatrizes e cadáveres vivem em pools criados uma vez.
//
// ⚠️ r3f NÃO ENTRA NESTE REPO (quebra em runtime): Three.js cru, como toda
// cena da cidade. Zero assets externos: céu, Terra, texturas e bichos são
// procedurais, o bundle não carrega um byte de imagem.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { connectKraken, type BookLevel, type WarTrade } from './kraken'
import { shibaGeometry, bearGeometry } from './critters'

const CAMPO_X = 88
const FRENTE = 7

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

const ORCAMENTO: Record<Tier, {
  dpr: number; cap: number; niveis: number; antialias: boolean; bloom: boolean
  maxOndas: number; maxLuzes: number; detritos: number; poeiraMax: number; faiscaMax: number; motas: number
}> = {
  low:  { dpr: 1.0, cap: 1000, niveis: 18, antialias: false, bloom: false, maxOndas: 6,  maxLuzes: 2, detritos: 160, poeiraMax: 240, faiscaMax: 80,  motas: 150 },
  mid:  { dpr: 1.5, cap: 2200, niveis: 28, antialias: false, bloom: false, maxOndas: 10, maxLuzes: 3, detritos: 350, poeiraMax: 500, faiscaMax: 140, motas: 300 },
  high: { dpr: 2.0, cap: 4200, niveis: 40, antialias: true,  bloom: true,  maxOndas: 20, maxLuzes: 6, detritos: 700, poeiraMax: 900, faiscaMax: 240, motas: 500 },
}

interface Hud {
  preco: number
  delta24: number
  low24: number
  high24: number
  status: 'connecting' | 'live' | 'down'
  ursosCaidos: number
  caesCaidos: number
  compra: number
  venda: number
}

export default function WarScene() {
  const montagem = useRef<HTMLDivElement>(null)
  const [hud, setHud] = useState<Hud>({
    preco: 0, delta24: 0, low24: 0, high24: 0, status: 'connecting',
    ursosCaidos: 0, caesCaidos: 0, compra: 0, venda: 0,
  })
  const [baleia, setBaleia] = useState<{ lado: 'buy' | 'sell'; chave: number } | null>(null)

  useEffect(() => {
    const el = montagem.current
    if (!el) return
    const orc = ORCAMENTO[detectaTier()]

    // ── palco ───────────────────────────────────────────────────────────────
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

    // ⚠️ ENQUADRAMENTO ASSINATURA: costura em diagonal no terço inferior, Terra
    // perto do cruzamento superior direito. É o frame que nasce screenshot.
    // retrato precisa de mais recuo: com o quadro em pé os dois exércitos só
    // cabem com a câmera mais alta e mais longe
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

    // deriva idle: quase imperceptível, mantém a cena viva num clipe
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

    // o relevo é UMA função e todo mundo pisa nela
    const altura = (x: number, z: number) => {
      const r = Math.hypot(x / 1.35, z)
      const bacia = -3.2 * Math.exp(-((r / 95) ** 2))
      const borda = 2.6 * Math.exp(-(((r - 128) / 26) ** 2))
      const rugosidade =
        0.55 * Math.sin(x * 0.11 + z * 0.07) * Math.sin(z * 0.13 - x * 0.05) +
        0.3 * (hash(Math.round(x * 0.5), Math.round(z * 0.5)) - 0.5)
      return bacia + borda + rugosidade
    }

    // ── luz: sol rasante quente + brasa atrás dos ursos ─────────────────────
    const sol = new THREE.DirectionalLight(0xffd9ae, 2.6)
    sol.position.set(60, 38, 120)
    scene.add(sol)
    scene.add(new THREE.HemisphereLight(0x34344a, 0x120c08, 1.15))
    const brasa = new THREE.DirectionalLight(0x9c3a28, 0.9)
    brasa.position.set(140, 26, -60)
    scene.add(brasa)
    const solDir = sol.position.clone().normalize()

    // ── céu: cúpula com disco solar + a Terra no horizonte ──────────────────
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

    // a Terra é um sprite pintado à mão: azul, continentes, terminador e halo,
    // o símbolo de que isto é a Lua; nenhuma textura baixada
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
    // do enquadramento assinatura a câmera olha pra +x/-z; a Terra fica no
    // terço superior DIREITO, sobre o horizonte dos ursos, longe do HUD
    terra.position.set(252, 68, 26)
    scene.add(terra)

    // ── estrelas com cor, tamanho e cintilação por estrela ──────────────────
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

    // ── motas de poeira suspensa afunilando na frente ───────────────────────
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

    // ── neblina rasteira colada na frente ───────────────────────────────────
    const gNev = new THREE.PlaneGeometry(26, 130, 1, 1)
    gNev.rotateX(-Math.PI / 2)
    const matNev = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, cor: { value: new THREE.Color(0x3a2a20) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; uniform vec3 cor; varying vec2 vUv;
        float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
        float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ v += a * hash2(floor(p)); p = p * 2.03 + time * 0.02; a *= 0.5; } return v; }
        void main(){
          float n = fbm(vUv * vec2(6.0, 14.0));
          float borda = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          gl_FragColor = vec4(cor, n * 0.5 * borda);
        }`,
    })
    const neblina = new THREE.Mesh(gNev, matNev)
    neblina.position.set(0, 0.55, 0)
    scene.add(neblina)

    // ── regolito ────────────────────────────────────────────────────────────
    {
      const g = new THREE.PlaneGeometry(420, 300, 130, 92)
      g.rotateX(-Math.PI / 2)
      const pos = g.attributes.position
      for (let i = 0; i < pos.count; i++) pos.setY(i, altura(pos.getX(i), pos.getZ(i)))
      g.computeVertexNormals()
      scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 1 })))
    }

    // ── a costura: energia viva, fundida num draw call só ───────────────────
    const matCostura = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { time: { value: 0 }, pressao: { value: 0.5 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; uniform float pressao; varying vec2 vUv;
        void main(){
          float onda = sin(vUv.y * 40.0 - time * 6.0) * 0.5 + 0.5;
          float pulso = 0.6 + 0.4 * sin(time * 3.0);
          vec3 quente = vec3(1.0, 0.71, 0.36);
          vec3 frio = vec3(1.0, 0.28, 0.18);
          vec3 cor = mix(frio, quente, pressao);
          gl_FragColor = vec4(cor * (0.7 + onda * 0.5) * pulso, 1.0);
        }`,
    })
    {
      const partes: THREE.BufferGeometry[] = []
      for (let s = 0; s < 80; s++) {
        const z0 = -62 + s * 1.55
        const z1 = z0 + 1.55
        const y0 = altura(0, z0) + 0.3
        const y1 = altura(0, z1) + 0.3
        const g = new THREE.BoxGeometry(0.35, 0.1, Math.hypot(1.55, y1 - y0))
        g.rotateX(Math.atan2(y1 - y0, 1.55))
        g.translate(0, (y0 + y1) / 2, (z0 + z1) / 2)
        partes.push(g)
      }
      const geo = mergeGeometries(partes, false)!
      partes.forEach((p) => p.dispose())
      scene.add(new THREE.Mesh(geo, matCostura))
    }
    const brilhoFrente = new THREE.PointLight(0xffc98a, 12, 60, 1.6)
    brilhoFrente.position.set(0, 4, 0)
    scene.add(brilhoFrente)

    // ── exércitos: respiração na GPU + rim de sol rasante ───────────────────
    const matCaes = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, emissive: 0x2a1503, emissiveIntensity: 0.5,
    })
    const matUrsos = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, emissive: 0x5c0f1c, emissiveIntensity: 0.75,
    })
    let shaderCaes: any = null
    let shaderUrsos: any = null
    matCaes.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.uniforms.solDir = { value: solDir }
      shader.vertexShader = 'attribute float aFase;\nuniform float uTime;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float peso = smoothstep(0.0, 1.3, position.y);
        transformed.y += sin(uTime * 2.1 + aFase * 6.283) * 0.035 * peso;
        float bal = sin(uTime * 1.5 + aFase * 6.283) * 0.045 * peso;
        float cb = cos(bal); float sb = sin(bal);
        transformed.xz = mat2(cb, -sb, sb, cb) * transformed.xz;`,
      )
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 solDir;\nvoid main() {')
        .replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          float rim = pow(1.0 - max(dot(normalize(vNormal), solDir), 0.0), 3.0);
          totalEmissiveRadiance += rim * vec3(1.0, 0.55, 0.12) * 0.9;
        `)
      shaderCaes = shader
    }
    matUrsos.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.vertexShader = 'attribute float aFase;\nuniform float uTime;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float peso = smoothstep(0.0, 1.2, position.y);
        transformed.y += sin(uTime * 1.7 + aFase * 6.283) * 0.03 * peso;`,
      )
      shaderUrsos = shader
    }
    const geoShiba = shibaGeometry()
    const geoUrso = bearGeometry()
    const caes = new THREE.InstancedMesh(geoShiba, matCaes, orc.cap)
    const ursos = new THREE.InstancedMesh(geoUrso, matUrsos, orc.cap)
    caes.count = 0
    ursos.count = 0
    const faseCaes = new Float32Array(orc.cap)
    const faseUrsos = new Float32Array(orc.cap)
    for (let i = 0; i < orc.cap; i++) {
      faseCaes[i] = hash(i, 41)
      faseUrsos[i] = hash(i, 59)
    }
    caes.geometry = geoShiba.clone()
    ursos.geometry = geoUrso.clone()
    caes.geometry.setAttribute('aFase', new THREE.InstancedBufferAttribute(faseCaes, 1))
    ursos.geometry.setAttribute('aFase', new THREE.InstancedBufferAttribute(faseUrsos, 1))
    scene.add(caes, ursos)

    // cadáveres: os tombados ficam um tempo no campo
    const detritoCaes = new THREE.InstancedMesh(geoShiba, matCaes, orc.detritos)
    const detritoUrsos = new THREE.InstancedMesh(geoUrso, matUrsos, orc.detritos)
    detritoCaes.count = 0
    detritoUrsos.count = 0
    scene.add(detritoCaes, detritoUrsos)
    const curCaes = { v: 0 }
    const curUrsos = { v: 0 }
    interface Tombo {
      mesh: THREE.InstancedMesh
      idx: number
      para: THREE.Quaternion
      x: number
      y: number
      z: number
      esc: number
      t0: number
    }
    const tombos: Tombo[] = []
    const qZero = new THREE.Quaternion()
    const tomba = (mesh: THREE.InstancedMesh, cur: { v: number }, p: THREE.Vector3, n: number) => {
      for (let k = 0; k < n; k++) {
        const idx = (cur.v = (cur.v + 1) % orc.detritos)
        mesh.count = Math.max(mesh.count, idx + 1)
        const px = p.x + (hash(idx, 3) - 0.5) * 4
        const pz = p.z + (hash(idx, 7) - 0.5) * 4
        tombos.push({
          mesh, idx,
          para: new THREE.Quaternion().setFromEuler(new THREE.Euler(
            (Math.PI / 2) * (hash(idx, 1) > 0.5 ? 1 : -1), hash(idx, 2) * Math.PI, 0,
          )),
          x: px, y: altura(px, pz), z: pz,
          esc: 0.8 + hash(idx, 9) * 0.3,
          t0: performance.now(),
        })
      }
    }

    // ── obeliscos de obsidiana com coroa acesa ──────────────────────────────
    const obsidiana = new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.25, metalness: 0.1 })
    const matCoroa = new THREE.MeshBasicMaterial({ color: 0xffa050 })
    const fazObelisco = () => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), obsidiana)
      o.position.y = 4.5
      o.rotation.y = 0.4
      const coroa = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.35, 1.75), matCoroa)
      coroa.position.y = 4.35
      o.add(coroa)
      const luz = new THREE.PointLight(0xff9040, 14, 30, 1.8)
      luz.position.y = 5.4
      o.add(luz)
      o.visible = false
      scene.add(o)
      return o
    }
    const obLow = fazObelisco()
    const obHigh = fazObelisco()

    const etiqueta = (texto: string) => {
      const cv = document.createElement('canvas')
      cv.width = 512
      cv.height = 96
      const cx = cv.getContext('2d')!
      cx.font = '600 44px ui-monospace, monospace'
      cx.textAlign = 'center'
      cx.fillStyle = 'rgba(240,235,225,0.92)'
      cx.fillText(texto, 256, 62)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }))
      sp.scale.set(22, 4.1, 1)
      return sp
    }
    let etLow: THREE.Sprite | null = null
    let etHigh: THREE.Sprite | null = null

    // ── arsenal: tudo em pool, nada aloca por trade ─────────────────────────
    const texDisco = (() => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 64
      const cx = cv.getContext('2d')!
      const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.4, 'rgba(255,255,255,0.65)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      cx.fillStyle = g
      cx.fillRect(0, 0, 64, 64)
      return new THREE.CanvasTexture(cv)
    })()

    const geoTiro = new THREE.SphereGeometry(1, 10, 10)
    const geoOnda = new THREE.RingGeometry(0.8, 1, 40)
    geoOnda.rotateX(-Math.PI / 2)
    const geoRastro = new THREE.BoxGeometry(0.12, 0.12, 1)
    geoRastro.translate(0, 0, -0.5)

    const matTiroCompra = new THREE.MeshBasicMaterial({ color: 0xffb35c })
    const matTiroVenda = new THREE.MeshBasicMaterial({ color: 0xff5940 })
    const matRastroCompra = new THREE.MeshBasicMaterial({
      color: 0xffb35c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const matRastroVenda = matRastroCompra.clone()
    matRastroVenda.color.setHex(0xff5940)

    const POOL_TIROS = orc.maxOndas * 2
    interface Tiro { i: number; t0: number; dur: number; forca: number; lado: 'buy' | 'sell' }
    const poolTiros: THREE.Mesh[] = []
    const poolRastros: THREE.Mesh[] = []
    for (let i = 0; i < POOL_TIROS; i++) {
      const m = new THREE.Mesh(geoTiro, matTiroCompra)
      m.visible = false
      m.userData.de = new THREE.Vector3()
      m.userData.para = new THREE.Vector3()
      m.userData.prev = new THREE.Vector3()
      scene.add(m)
      poolTiros.push(m)
      const r = new THREE.Mesh(geoRastro, matRastroCompra)
      r.visible = false
      scene.add(r)
      poolRastros.push(r)
    }
    let cursorTiro = 0
    const tiros: Tiro[] = []

    const matOndaCompra = new THREE.MeshBasicMaterial({ color: 0xffa64d, transparent: true, side: THREE.DoubleSide })
    const matOndaVenda = new THREE.MeshBasicMaterial({ color: 0xff5238, transparent: true, side: THREE.DoubleSide })
    interface Onda { mesh: THREE.Mesh; luz: THREE.PointLight | null; t0: number; forca: number }
    const poolOndas: THREE.Mesh[] = Array.from({ length: orc.maxOndas }, () => {
      const m = new THREE.Mesh(geoOnda, matOndaCompra)
      m.visible = false
      scene.add(m)
      return m
    })
    let cursorOnda = 0
    // ⚠️ luz de verdade custa caro pra todo material Standard da cena; só uma
    // fração dos impactos ganha luz real, o resto fica com anel + clarão
    const poolLuzes: THREE.PointLight[] = Array.from({ length: orc.maxLuzes }, () => {
      const l = new THREE.PointLight(0xffa64d, 0, 26, 1.8)
      scene.add(l)
      return l
    })
    let cursorLuz = 0
    const ondas: Onda[] = []

    const POOL_FLASH = 24
    const flashPool = Array.from({ length: POOL_FLASH }, () => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texDisco, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }))
      sp.visible = false
      scene.add(sp)
      return sp
    })
    let flashCursor = 0

    // poeira de impacto
    const poeiraPos = new Float32Array(orc.poeiraMax * 3)
    const poeiraVel = new Float32Array(orc.poeiraMax * 3)
    const poeiraViva = new Uint8Array(orc.poeiraMax)
    const poeiraT0 = new Float32Array(orc.poeiraMax)
    poeiraPos.fill(-999)
    const geoPoeira = new THREE.BufferGeometry()
    geoPoeira.setAttribute('position', new THREE.BufferAttribute(poeiraPos, 3))
    const matPoeira = new THREE.PointsMaterial({
      map: texDisco, color: 0xcabfa8, size: 1.6, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true,
    })
    scene.add(new THREE.Points(geoPoeira, matPoeira))
    let poeiraCursor = 0
    const emitPoeira = (p: THREE.Vector3, forca: number) => {
      const n = Math.min(28, 6 + Math.round(forca * 2))
      for (let k = 0; k < n; k++) {
        const i = (poeiraCursor = (poeiraCursor + 1) % orc.poeiraMax)
        const ang = hash(i, k + 1) * Math.PI * 2
        const spd = 1.4 + hash(i, k + 9) * 2.4
        poeiraPos[i * 3] = p.x
        poeiraPos[i * 3 + 1] = p.y + 0.2
        poeiraPos[i * 3 + 2] = p.z
        poeiraVel[i * 3] = Math.cos(ang) * spd
        poeiraVel[i * 3 + 1] = 1.1 + hash(i, k + 3) * 1.5
        poeiraVel[i * 3 + 2] = Math.sin(ang) * spd
        poeiraViva[i] = 1
        poeiraT0[i] = performance.now()
      }
    }

    // faíscas
    const faiscaPos = new Float32Array(orc.faiscaMax * 6)
    const faiscaVel = new Float32Array(orc.faiscaMax * 3)
    const faiscaViva = new Uint8Array(orc.faiscaMax)
    const faiscaT0 = new Float32Array(orc.faiscaMax)
    const geoFaisca = new THREE.BufferGeometry()
    geoFaisca.setAttribute('position', new THREE.BufferAttribute(faiscaPos, 3))
    const matFaisca = new THREE.LineBasicMaterial({ color: 0xffe1a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    scene.add(new THREE.LineSegments(geoFaisca, matFaisca))
    let faiscaCursor = 0
    const emitFaiscas = (p: THREE.Vector3, forca: number) => {
      const n = Math.min(18, 4 + Math.round(forca))
      for (let k = 0; k < n; k++) {
        const i = (faiscaCursor = (faiscaCursor + 1) % orc.faiscaMax)
        const ang = hash(i, k + 1) * Math.PI * 2
        const spd = 4 + hash(i, k + 2) * 6
        faiscaVel[i * 3] = Math.cos(ang) * spd
        faiscaVel[i * 3 + 1] = 2 + hash(i, k + 5) * 2.6
        faiscaVel[i * 3 + 2] = Math.sin(ang) * spd
        faiscaPos[i * 6] = faiscaPos[i * 6 + 3] = p.x
        faiscaPos[i * 6 + 1] = faiscaPos[i * 6 + 4] = p.y + 0.3
        faiscaPos[i * 6 + 2] = faiscaPos[i * 6 + 5] = p.z
        faiscaViva[i] = 1
        faiscaT0[i] = performance.now()
      }
    }

    // cicatrizes que somem
    const texCicatriz = (() => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 128
      const cx = cv.getContext('2d')!
      const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(18,13,9,0.85)')
      g.addColorStop(0.55, 'rgba(18,13,9,0.4)')
      g.addColorStop(1, 'rgba(18,13,9,0)')
      cx.fillStyle = g
      cx.fillRect(0, 0, 128, 128)
      return new THREE.CanvasTexture(cv)
    })()
    const geoCicatriz = new THREE.CircleGeometry(1, 20)
    geoCicatriz.rotateX(-Math.PI / 2)
    const POOL_CICATRIZ = 40
    const cicatrizes = Array.from({ length: POOL_CICATRIZ }, () => {
      const m = new THREE.Mesh(geoCicatriz, new THREE.MeshBasicMaterial({
        map: texCicatriz, transparent: true, opacity: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4,
      }))
      m.visible = false
      scene.add(m)
      return m
    })
    let cicatrizCursor = 0
    const marcaCicatriz = (p: THREE.Vector3, forca: number) => {
      const m = cicatrizes[cicatrizCursor]
      cicatrizCursor = (cicatrizCursor + 1) % POOL_CICATRIZ
      m.position.set(p.x, altura(p.x, p.z) + 0.03, p.z)
      m.scale.setScalar(1.3 + Math.sqrt(forca) * 1.1)
      m.rotation.z = hash(p.x, p.z) * Math.PI * 2
      m.visible = true
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.75
      m.userData.t0 = performance.now()
    }

    // tremor de baleia
    let tremorT0 = -1
    let tremorForca = 0

    // ── pós: bloom em meia resolução + grading, só no tier alto ─────────────
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
      // ⚠️ sem OutputPass o composer pula tone mapping e sRGB e a cena sai lavada
      composer.addPass(new OutputPass())
    }

    // ── estado vindo da Kraken ──────────────────────────────────────────────
    let book: { bids: BookLevel[]; asks: BookLevel[] } = { bids: [], asks: [] }
    let bookSujo = false
    let mid = 0
    let spanSuave = 0
    let emaQty = 0
    const filaTrades: WarTrade[] = []
    let ursosCaidos = 0
    let caesCaidos = 0
    let compra = 0
    let venda = 0
    let status: Hud['status'] = 'connecting'
    let low24 = 0
    let high24 = 0
    let open24 = 0

    const feed = connectKraken({
      depth: 100,
      onBook: (bids, asks) => {
        book = { bids, asks }
        bookSujo = true
      },
      onTrade: (t) => {
        filaTrades.push(t)
        emaQty = emaQty === 0 ? t.qty : emaQty * 0.97 + t.qty * 0.03
        if (t.side === 'buy') {
          ursosCaidos += t.qty
          compra += t.qty
        } else {
          caesCaidos += t.qty
          venda += t.qty
        }
      },
      onStatus: (s) => {
        status = s
      },
    })

    fetch('/api/war/ticker')
      .then((r) => r.json())
      .then((t) => {
        if (t && t.low24) {
          low24 = t.low24
          high24 = t.high24
          open24 = t.open
        }
      })
      .catch(() => {})

    // ── do book para as fileiras ────────────────────────────────────────────
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const eu = new THREE.Euler()
    const vp = new THREE.Vector3()
    const vs = new THREE.Vector3()

    const precoParaX = (preco: number) => {
      if (!(mid > 0) || !(spanSuave > 0)) return 0
      const d = ((preco - mid) / spanSuave) * (CAMPO_X - FRENTE)
      const s = Math.sign(d)
      return s * Math.min(Math.abs(d) + FRENTE, CAMPO_X + 14)
    }

    const montaExercito = (mesh: THREE.InstancedMesh, niveis: BookLevel[], lado: 1 | -1, qMediana: number) => {
      let i = 0
      for (let li = 0; li < niveis.length && i < orc.cap; li++) {
        const nv = niveis[li]
        const x0 = precoParaX(nv.price)
        const unidades = Math.min(96, Math.max(1, Math.round(6 * Math.sqrt(nv.qty / qMediana))))
        for (let u = 0; u < unidades && i < orc.cap; u++) {
          const fila = Math.floor(u / 12)
          const col = u % 12
          const jx = (hash(li * 31 + u, 7) - 0.5) * 0.7
          const jz = (hash(li * 17 + u, 13) - 0.5) * 0.9
          const px = x0 + lado * (fila * 1.5 + jx)
          const pz = (col - 5.5) * 1.45 + (fila % 2) * 0.7 + jz
          vp.set(px, altura(px, pz) + 0.05, pz)
          const esc = 0.9 + hash(li, u) * 0.25
          vs.set(esc, esc, esc)
          eu.set(0, (hash(u, li) - 0.5) * 0.35, 0)
          q.setFromEuler(eu)
          m4.compose(vp, q, vs)
          mesh.setMatrixAt(i, m4)
          i++
        }
      }
      mesh.count = i
      mesh.instanceMatrix.needsUpdate = true
    }

    const aplicaBook = () => {
      const bids = book.bids.slice(0, orc.niveis)
      const asks = book.asks.slice(0, orc.niveis)
      if (!bids.length || !asks.length) return
      mid = (bids[0].price + asks[0].price) / 2
      const alcance = Math.max(
        bids.length ? mid - bids[bids.length - 1].price : 0,
        asks.length ? asks[asks.length - 1].price - mid : 0,
      )
      spanSuave = spanSuave === 0 ? alcance : spanSuave * 0.92 + alcance * 0.08
      const todas = [...bids, ...asks].map((l) => l.qty).sort((a, b) => a - b)
      const qMediana = todas[Math.floor(todas.length / 2)] || 1
      montaExercito(caes, bids, -1, qMediana)
      montaExercito(ursos, asks, 1, qMediana)

      if (low24 > 0 && mid > 0) {
        obLow.visible = obHigh.visible = true
        obLow.position.x = Math.max(-CAMPO_X - 10, Math.min(CAMPO_X + 10, precoParaX(low24)))
        obHigh.position.x = Math.max(-CAMPO_X - 10, Math.min(CAMPO_X + 10, precoParaX(high24)))
        obLow.position.z = -58
        obHigh.position.z = -58
        obLow.position.y = altura(obLow.position.x, -58) + 4.5
        obHigh.position.y = altura(obHigh.position.x, -58) + 4.5
        if (!etLow) {
          etLow = etiqueta(`24H LOW ${fmtPreco(low24)}`)
          etHigh = etiqueta(`24H HIGH ${fmtPreco(high24)}`)
          scene.add(etLow, etHigh!)
        }
        etLow.position.set(obLow.position.x, 11.4, -58)
        etHigh!.position.set(obHigh.position.x, 11.4, -58)
      }
    }

    // ── trades viram disparos ───────────────────────────────────────────────
    const LIMIAR_BALEIA = 16
    const dispara = (t: WarTrade) => {
      const forca = Math.min(40, Math.max(0.4, emaQty > 0 ? t.qty / emaQty : 1))
      const zAlvo = (hash(t.at % 997, t.qty) - 0.5) * 90
      const lado = t.side === 'buy' ? 1 : -1
      const i = cursorTiro
      cursorTiro = (cursorTiro + 1) % POOL_TIROS
      const mesh = poolTiros[i]
      const rastro = poolRastros[i]
      mesh.material = t.side === 'buy' ? matTiroCompra : matTiroVenda
      rastro.material = t.side === 'buy' ? matRastroCompra : matRastroVenda
      mesh.visible = rastro.visible = true
      mesh.scale.setScalar(0.22 * Math.sqrt(forca) + 0.12)
      mesh.userData.de.set(-lado * (14 + hash(t.at % 31, 3) * 30), 1.2, zAlvo + (hash(t.at % 13, 5) - 0.5) * 30)
      mesh.userData.para.set(lado * (FRENTE + hash(t.at % 7, 11) * 6), 0.8, zAlvo)
      mesh.userData.prev.copy(mesh.userData.de)
      tiros.push({ i, t0: performance.now(), dur: 750 + 350 * Math.min(3, forca / 8), forca, lado: t.side })
      if (forca > LIMIAR_BALEIA) {
        setBaleia({ lado: t.side, chave: t.at })
        tremorT0 = performance.now()
        tremorForca = Math.min(1, forca / 40)
      }
    }

    const impacto = (p: THREE.Vector3, forca: number, lado: 'buy' | 'sell') => {
      const cor = lado === 'buy' ? 0xffa64d : 0xff5238
      const mesh = poolOndas[cursorOnda]
      cursorOnda = (cursorOnda + 1) % poolOndas.length
      mesh.material = lado === 'buy' ? matOndaCompra : matOndaVenda
      mesh.visible = true
      mesh.position.copy(p).setY(0.25)
      let luz: THREE.PointLight | null = null
      if (forca > 2 || cursorOnda % 3 === 0) {
        luz = poolLuzes[cursorLuz]
        cursorLuz = (cursorLuz + 1) % poolLuzes.length
        luz.color.setHex(cor)
        luz.position.copy(p).setY(2.5)
        luz.intensity = 30 * Math.min(6, forca)
      }
      ondas.push({ mesh, luz, t0: performance.now(), forca })

      const sp = flashPool[flashCursor]
      flashCursor = (flashCursor + 1) % POOL_FLASH
      ;(sp.material as THREE.SpriteMaterial).color.setHex(lado === 'buy' ? 0xffe1b0 : 0xffb0a0)
      sp.position.copy(p).setY(1.5)
      sp.userData.base = 2.4 + Math.sqrt(forca) * 2
      sp.scale.setScalar(sp.userData.base)
      ;(sp.material as THREE.SpriteMaterial).opacity = 1
      sp.visible = true
      sp.userData.t0 = performance.now()

      emitPoeira(p, forca)
      emitFaiscas(p, forca)
      marcaCicatriz(p, forca)
      if (lado === 'buy') tomba(detritoUrsos, curUrsos, p, Math.min(14, 1 + Math.round(forca)))
      else tomba(detritoCaes, curCaes, p, Math.min(14, 1 + Math.round(forca)))
    }

    // ── laço ────────────────────────────────────────────────────────────────
    let vivo = true
    let visivel = !document.hidden
    const aoMudarVisibilidade = () => {
      visivel = !document.hidden
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)

    let ultimoBook = 0
    let ultimoHud = 0
    const passo = new THREE.Vector3()
    const zEixo = new THREE.Vector3(0, 0, 1)
    const ndc = new THREE.Vector3()

    const anima = (agora: number) => {
      if (!vivo) return
      requestAnimationFrame(anima)
      if (!visivel) return

      // intro cinematográfica: da órbita ao enquadramento assinatura
      if (introT0 !== null) {
        const f = Math.min(1, (agora - introT0) / 3000)
        const e = easeOutQuint(f)
        camera.position.lerpVectors(introDe.pos, enquadre.pos, e)
        controls.target.lerpVectors(introDe.tgt, enquadre.tgt, e)
        // ⚠️ sem isto a câmera desce de costas: o lerp move a posição, mas a
        // orientação só existiria no controls.update(), que a intro desliga
        camera.lookAt(controls.target)
        if (f >= 1) {
          controls.enabled = true
          introT0 = null
          agendaDeriva()
        }
      }

      if (bookSujo && agora - ultimoBook > 250) {
        bookSujo = false
        ultimoBook = agora
        aplicaBook()
      }

      // teto de disparos por frame: rajada da Kraken vira fila, não travada
      let processados = 0
      let drenados = 0
      while (drenados < filaTrades.length && processados < orc.maxOndas) {
        dispara(filaTrades[drenados])
        drenados++
        processados++
      }
      if (drenados > 0) filaTrades.splice(0, drenados)

      for (let i = tiros.length - 1; i >= 0; i--) {
        const t = tiros[i]
        const mesh = poolTiros[t.i]
        const rastro = poolRastros[t.i]
        const f = (agora - t.t0) / t.dur
        if (f >= 1) {
          impacto(mesh.userData.para, t.forca, t.lado)
          mesh.visible = rastro.visible = false
          tiros.splice(i, 1)
          continue
        }
        mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
        mesh.position.y = 1 + Math.sin(f * Math.PI) * (6 + Math.min(18, t.forca))
        passo.subVectors(mesh.position, mesh.userData.prev)
        const dist = passo.length()
        if (dist > 0.0005) rastro.quaternion.setFromUnitVectors(zEixo, passo.normalize())
        rastro.position.copy(mesh.position)
        rastro.scale.set(mesh.scale.x * 0.55, mesh.scale.x * 0.55, Math.max(1.2, dist * 16 + t.forca * 0.35))
        mesh.userData.prev.copy(mesh.position)
      }

      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i]
        const f = (agora - o.t0) / 650
        if (f >= 1) {
          o.mesh.visible = false
          if (o.luz) o.luz.intensity = 0
          ondas.splice(i, 1)
          continue
        }
        o.mesh.scale.setScalar(1 + f * (3 + Math.sqrt(o.forca) * 2.2))
        ;(o.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - f
        if (o.luz) o.luz.intensity = 30 * Math.min(6, o.forca) * (1 - f)
      }

      for (const sp of flashPool) {
        if (!sp.visible) continue
        const k = (agora - sp.userData.t0) / 130
        if (k >= 1) {
          sp.visible = false
          continue
        }
        sp.scale.setScalar(sp.userData.base * (1 + k * 0.6))
        ;(sp.material as THREE.SpriteMaterial).opacity = 1 - k
      }

      for (let i = 0; i < orc.poeiraMax; i++) {
        if (!poeiraViva[i]) continue
        const dt = (agora - poeiraT0[i]) / 1000
        if (dt > 1.3) {
          poeiraViva[i] = 0
          poeiraPos[i * 3 + 1] = -999
          continue
        }
        poeiraVel[i * 3 + 1] -= 0.038
        poeiraPos[i * 3] += poeiraVel[i * 3] * 0.016
        poeiraPos[i * 3 + 1] += poeiraVel[i * 3 + 1] * 0.016
        poeiraPos[i * 3 + 2] += poeiraVel[i * 3 + 2] * 0.016
      }
      geoPoeira.attributes.position.needsUpdate = true

      for (let i = 0; i < orc.faiscaMax; i++) {
        if (!faiscaViva[i]) continue
        const dt = (agora - faiscaT0[i]) / 1000
        if (dt > 0.45) {
          faiscaViva[i] = 0
          continue
        }
        faiscaVel[i * 3 + 1] -= 0.15
        const hx = faiscaPos[i * 6]
        const hy = faiscaPos[i * 6 + 1]
        const hz = faiscaPos[i * 6 + 2]
        faiscaPos[i * 6] = hx + faiscaVel[i * 3] * 0.016
        faiscaPos[i * 6 + 1] = hy + faiscaVel[i * 3 + 1] * 0.016
        faiscaPos[i * 6 + 2] = hz + faiscaVel[i * 3 + 2] * 0.016
        faiscaPos[i * 6 + 3] = hx
        faiscaPos[i * 6 + 4] = hy
        faiscaPos[i * 6 + 5] = hz
      }
      geoFaisca.attributes.position.needsUpdate = true

      for (const m of cicatrizes) {
        if (!m.visible) continue
        const f = (agora - m.userData.t0) / 12000
        if (f >= 1) {
          m.visible = false
          continue
        }
        ;(m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - f)
      }

      for (let i = tombos.length - 1; i >= 0; i--) {
        const t = tombos[i]
        const f = Math.min(1, (agora - t.t0) / 380)
        q.slerpQuaternions(qZero, t.para, f * f)
        vs.setScalar(t.esc)
        vp.set(t.x, t.y + 0.05 - 0.12 * f, t.z)
        m4.compose(vp, q, vs)
        t.mesh.setMatrixAt(t.idx, m4)
        t.mesh.instanceMatrix.needsUpdate = true
        if (f >= 1) tombos.splice(i, 1)
      }

      // uniforms vivos
      const seg = agora * 0.001
      if (shaderCaes) shaderCaes.uniforms.uTime.value = seg
      if (shaderUrsos) shaderUrsos.uniforms.uTime.value = seg
      matEs.uniforms.time.value = seg
      matPo.uniforms.time.value = seg
      matNev.uniforms.time.value = seg
      matCostura.uniforms.time.value = seg
      const total = compra + venda
      const alvoPress = total > 0 ? compra / total : 0.5
      matCostura.uniforms.pressao.value += (alvoPress - matCostura.uniforms.pressao.value) * 0.05

      if (gradePass) {
        ndc.set(0, altura(0, 0), 0).project(camera)
        gradePass.uniforms.splitX.value = ndc.x * 0.5 + 0.5
      }

      if (agora - ultimoHud > 500) {
        ultimoHud = agora
        setHud({
          preco: mid,
          delta24: open24 > 0 && mid > 0 ? (mid - open24) / open24 : 0,
          low24, high24, status, ursosCaidos, caesCaidos, compra, venda,
        })
      }

      if (introT0 === null) controls.update()

      // tremor de baleia: decai em 700ms, aplicado só no render
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
      feed.stop()
      window.removeEventListener('resize', aoRedimensionar)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      controls.removeEventListener('start', pausaDeriva)
      controls.removeEventListener('end', agendaDeriva)
      if (deriva) clearTimeout(deriva)
      controls.dispose()
      // ⚠️ sem esta varredura, cada remount (troca de rota, fast refresh)
      // acumula memória de GPU que nunca volta
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

      {/* vinheta barata que roda em qualquer tier, CSS puro */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.42) 100%)' }}
      />

      {/* clarão de baleia */}
      {baleia && (
        <div
          key={baleia.chave}
          onAnimationEnd={() => setBaleia(null)}
          className="absolute inset-0 pointer-events-none animate-baleia"
          style={{ background: `radial-gradient(ellipse at center, transparent 42%, ${baleia.lado === 'buy' ? 'rgba(247,147,26,0.16)' : 'rgba(200,40,60,0.16)'} 100%)` }}
        />
      )}

      {/* localização e fonte */}
      <div className="absolute top-4 left-5 font-mono text-[10px] tracking-[0.22em] uppercase text-white/45 select-none">
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${vivoAgora ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        Kraken {vivoAgora ? 'live' : hud.status}
        <div className="mt-1 text-white/30 hidden sm:block">War Crater · 3 km SW of Central Plaza</div>
      </div>

      {/* o preço é a manchete */}
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

      {/* pressão: quem empurra a frente */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-60 sm:w-72 select-none pointer-events-none">
        <div className="flex justify-between font-mono text-[10px] tracking-[0.18em] uppercase mb-1">
          <span className="text-[#f7931a]/85 tabular-nums">Dogs {fmtDog(hud.compra)}</span>
          <span className="text-red-400/75 tabular-nums">{fmtDog(hud.venda)} Bears</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden bg-white/10">
          <div className="h-full bg-gradient-to-r from-[#f7931a] to-[#c96a12]" style={{ width: `${fracaoCompra * 100}%` }} />
        </div>
      </div>

      {/* baixas do combate assistido */}
      <div className="absolute bottom-20 sm:bottom-7 right-4 sm:right-5 text-right font-mono text-[10px] tracking-[0.18em] uppercase text-white/40 select-none">
        <div>Bears fallen <span className="text-white/75 tabular-nums">{fmtDog(hud.ursosCaidos)}</span></div>
        <div>Dogs fallen <span className="text-white/75 tabular-nums">{fmtDog(hud.caesCaidos)}</span></div>
      </div>

      <div className="absolute bottom-7 left-5 font-mono text-[10px] tracking-[0.18em] uppercase text-white/25 select-none hidden md:block">
        drag to orbit · scroll to zoom
      </div>

      {/* a marca sobrevive ao crop do card */}
      <div className="absolute bottom-1.5 inset-x-0 text-center font-mono text-[9px] tracking-[0.32em] uppercase text-white/20 select-none pointer-events-none">
        dogdata.xyz
      </div>
    </div>
  )
}
