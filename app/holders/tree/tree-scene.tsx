'use client'

// HOLDERS TREE, a galaxia genealogica do DOG: a tesouraria do airdrop e o sol,
// cada geracao e uma concha orbital, cada carteira do esqueleto e uma estrela.
// Holders acesos em laranja bitcoin, carteiras que ja gastaram tudo em brasa
// apagada. A poeira de fundo e semeada com a densidade REAL de gens[]: a
// densidade visual E o dado, sem baixar 264k nos.
//
// ⚠️ r3f NAO ENTRA NESTE REPO (quebra em runtime): Three.js cru, no mesmo
// padrao de app/city/war/war-scene.tsx. Zero alocacao por frame no loop.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  type TreeNode,
  type TreeResponse,
  type GenStat,
  sanitizeNode,
  nodePosition,
  childFanPosition,
  shellRadius,
  sizeFor,
  colorFor,
  hashIdx,
  fmtDog,
  fmtInt,
  shortAddr,
} from './galaxy'

// ── orcamento por aparelho: mobile corta DPR e metade da poeira ──────────────
const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const MAX_NODES = 8000 // esqueleto (~3000) + filhos materializados por clique
const MAX_PATH = 402 // raiz ate o no, contrato limita em 400 passos
const MAX_LINK_SEGMENTS = 6000 // linhas curtas pai-filho dos filhos materializados

interface HudState {
  status: 'loading' | 'live' | 'error'
  wallets: number
  holders: number
  generations: number
}

interface TooltipState {
  x: number
  y: number
  addr: string
  label?: string
  balance: number
  subtreeHolders: number
  holder: boolean
  /** Ponto da populacao: so endereco/geracao/estado; saldo vem no clique. */
  minimal?: boolean
}

interface SceneApi {
  focusWallet: (addr: string) => void
  clearSelection: () => void
}

// textura de disco radial via canvas: o "map" das estrelas e da poeira
function discTexture(size: number, soft: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const half = size / 2
  const g = ctx.createRadialGradient(half, half, 0, half, half, half)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(soft, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(c)
}

// ⚠️ disco NÍTIDO pras estrelas do esqueleto: o gradiente mole de ponta a
// ponta virava bola de bokeh e as conchas somavam numa névoa branca (o
// fundador fotografou); núcleo sólido, borda que morre rápido
function crispDiscTexture(size: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const half = size / 2
  const g = ctx.createRadialGradient(half, half, 0, half, half, half)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.42, 'rgba(255,255,255,1)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(c)
}

export default function TreeScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)

  const [hud, setHud] = useState<HudState>({ status: 'loading', wallets: 0, holders: 0, generations: 0 })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [copied, setCopied] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TreeNode[]>([])
  const [searching, setSearching] = useState(false)
  const [popInfo, setPopInfo] = useState<{ drawn: number; total: number } | null>(null)

  // ── busca (input controlado no React, voo executado pela cena) ─────────────
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let dead = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/holders/tree/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error('search failed')
        const data = (await res.json()) as { matches: TreeNode[] }
        if (!dead) setResults((data.matches || []).map(sanitizeNode))
      } catch {
        if (!dead) setResults([])
      } finally {
        if (!dead) setSearching(false)
      }
    }, 250)
    return () => {
      dead = true
      clearTimeout(t)
    }
  }, [query])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const mobile = isMobile()
    const dprCap = mobile ? 1.5 : 2
    let disposed = false

    // ── palco ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x040305)
    scene.fog = new THREE.FogExp2(0x040305, 0.00075)

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.5, 8200)
    camera.position.set(0, 320, 780)

    const renderer = new THREE.WebGLRenderer({ antialias: !mobile })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap))
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    // ⚠️ era piso 60 por causa da parede de luz; com o fade da poeira por
    // distancia e o passo maior das conchas, 16 deixa chegar NA estrela
    // sem nevoa. O teto acompanha o universo esticado (passo 22 -> 34).
    controls.minDistance = 16
    controls.maxDistance = 3400
    controls.target.set(0, 0, 0)
    // rotacao ociosa lenta: para NA PRIMEIRA interacao e nao volta
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.22
    const stopIdleSpin = () => {
      controls.autoRotate = false
      controls.removeEventListener('start', stopIdleSpin)
    }
    controls.addEventListener('start', stopIdleSpin)

    // ── o sol do airdrop (a tesouraria) ──────────────────────────────────────
    const sunTex = discTexture(128, 0.18)
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(7, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }),
    )
    scene.add(sunMesh)
    const haloMat = new THREE.SpriteMaterial({
      map: sunTex,
      color: 0xf7931a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.scale.set(64, 64, 1)
    scene.add(halo)
    const haloOuter = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTex,
        color: 0x8a4a10,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    haloOuter.scale.set(150, 150, 1)
    scene.add(haloOuter)

    // ── esqueleto interativo: um unico THREE.Points com capacidade fixa ──────
    const starTex = crispDiscTexture(64)
    const posArr = new Float32Array(MAX_NODES * 3)
    const colArr = new Float32Array(MAX_NODES * 3)
    const sizeArr = new Float32Array(MAX_NODES)
    // posicoes vagas ficam longe do universo: raycast e frustum nunca as acham
    posArr.fill(1e7)

    const starGeom = new THREE.BufferGeometry()
    starGeom.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    starGeom.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    starGeom.setAttribute('size', new THREE.BufferAttribute(sizeArr, 1))
    starGeom.setDrawRange(0, 0)

    // PointsMaterial nao tem tamanho por vertice, entao o shader reimplementa
    // o mesmo contrato (map de disco, sizeAttenuation, vertexColors) com a
    // attribute size por estrela
    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: starTex },
        uScale: { value: 600 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float ps = size * (uScale / -mv.z);
          // ⚠️ teto de pixels: sem ele, chegar perto da concha inflava cada
          // estrela numa bola de dezenas de pixels e a soma aditiva virava
          // nevoa ilegivel (chapa do fundador no celular). 34 e o novo teto
          // porque o piso da camera caiu de 60 pra 16: a estrela focada
          // preenche de perto, as vizinhas continuam ponto.
          gl_PointSize = clamp(ps, 1.5, 34.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.04) discard;
          gl_FragColor = vec4(vColor * tex.a, tex.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    })
    const stars = new THREE.Points(starGeom, starMat)
    stars.frustumCulled = false
    scene.add(stars)

    // atenuacao coerente com o fov: uScale = altura(px fisicos) / (2*tan(fov/2))
    const updatePointScale = () => {
      const hPx = el.clientHeight * renderer.getPixelRatio()
      starMat.uniforms.uScale.value = hPx / (2 * Math.tan((camera.fov * Math.PI) / 360))
    }
    updatePointScale()

    // ── registro dos nos ─────────────────────────────────────────────────────
    let starCount = 0
    const nodeMeta: TreeNode[] = []
    const indexByWallet = new Map<string, number>()
    let rootNode: TreeNode | null = null
    const expanded = new Set<string>() // pais cujos filhos ja foram materializados
    const tmpV = { x: 0, y: 0, z: 0 }

    const writeStar = (n: TreeNode, x: number, y: number, z: number): number => {
      const i = starCount
      posArr[i * 3] = x
      posArr[i * 3 + 1] = y
      posArr[i * 3 + 2] = z
      colorFor(n, colArr, i * 3)
      sizeArr[i] = sizeFor(n.b, n.sb)
      nodeMeta[i] = n
      indexByWallet.set(n.w, i)
      starCount++
      starGeom.setDrawRange(0, starCount)
      return i
    }

    const flushStars = () => {
      ;(starGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(starGeom.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
      ;(starGeom.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true
    }

    // garante o no na cena; raiz vive no sol e devolve -1
    const ensureNode = (n: TreeNode): number => {
      if (n.d <= 0) {
        rootNode = rootNode || n
        return -1
      }
      const existing = indexByWallet.get(n.w)
      if (existing !== undefined) return existing
      if (starCount >= MAX_NODES) return -2
      nodePosition(n.w, n.d, tmpV)
      return writeStar(n, tmpV.x, tmpV.y, tmpV.z)
    }

    // ── linhagem selecionada: linha aditiva laranja da raiz ate o no ─────────
    const pathArr = new Float32Array(MAX_PATH * 3)
    const pathGeom = new THREE.BufferGeometry()
    pathGeom.setAttribute('position', new THREE.BufferAttribute(pathArr, 3))
    pathGeom.setDrawRange(0, 0)
    const pathMat = new THREE.LineBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const pathLine = new THREE.Line(pathGeom, pathMat)
    pathLine.frustumCulled = false
    scene.add(pathLine)

    // ── linhas curtas pai-filho dos filhos materializados ────────────────────
    const linkArr = new Float32Array(MAX_LINK_SEGMENTS * 6)
    const linkGeom = new THREE.BufferGeometry()
    linkGeom.setAttribute('position', new THREE.BufferAttribute(linkArr, 3))
    linkGeom.setDrawRange(0, 0)
    const linkMat = new THREE.LineBasicMaterial({
      color: 0xf7931a,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const links = new THREE.LineSegments(linkGeom, linkMat)
    links.frustumCulled = false
    scene.add(links)
    let linkCount = 0

    const addLink = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      if (linkCount >= MAX_LINK_SEGMENTS) return
      const o = linkCount * 6
      linkArr[o] = ax
      linkArr[o + 1] = ay
      linkArr[o + 2] = az
      linkArr[o + 3] = bx
      linkArr[o + 4] = by
      linkArr[o + 5] = bz
      linkCount++
      linkGeom.setDrawRange(0, linkCount * 2)
      ;(linkGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    }

    // ── populacao: carteiras REAIS no lugar da poeira ────────────────────────
    // Diretriz do fundador (26/08): nenhum ponto decorativo na galaxia. Cada
    // grao aqui e uma carteira do historico, amostrada por geracao
    // proporcionalmente a populacao real (a densidade visual continua sendo o
    // dado, como era com a poeira) e CLICAVEL: o clique resolve o dossie
    // completo via focusWallet. A amostra vem pronta do servidor
    // (/api/holders/tree/population, gerada por export_galaxy_population.py).
    let popPoints: THREE.Points | null = null
    let popPos: Float32Array | null = null
    let popAddr: string[] = []
    let popDepth: Int32Array | null = null
    let popHolder: Uint8Array | null = null
    const buildPopulation = (rows: [string, number, number][]) => {
      // carteira que ja esta no esqueleto nao entra duas vezes
      const keep: [string, number, number][] = []
      for (const r of rows) {
        if (!indexByWallet.has(r[0])) keep.push(r)
      }
      const n = keep.length
      if (n === 0) return
      popPos = new Float32Array(n * 3)
      const cols = new Float32Array(n * 3)
      const sizes = new Float32Array(n)
      popAddr = new Array(n)
      popDepth = new Int32Array(n)
      popHolder = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        const w = keep[i][0]
        const d = keep[i][1]
        const h = keep[i][2]
        nodePosition(w, d, tmpV)
        popPos[i * 3] = tmpV.x
        popPos[i * 3 + 1] = tmpV.y
        popPos[i * 3 + 2] = tmpV.z
        popAddr[i] = w
        popDepth[i] = d
        popHolder[i] = h
        if (h) {
          cols[i * 3] = 0.5
          cols[i * 3 + 1] = 0.28
          cols[i * 3 + 2] = 0.06
          sizes[i] = 1.5
        } else {
          cols[i * 3] = 0.15
          cols[i * 3 + 1] = 0.125
          cols[i * 3 + 2] = 0.11
          sizes[i] = 1.2
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(popPos, 3))
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
      g.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
      // o MESMO shader das estrelas: o teto de gl_PointSize evita a parede
      // de luz de perto que a poeira mole tinha
      popPoints = new THREE.Points(g, starMat)
      popPoints.frustumCulled = false
      scene.add(popPoints)
    }

    // ── voo de camera (dolly de entrada e busca), sem alocacao no loop ───────
    const tween = {
      active: false,
      t0: 0,
      dur: 0,
      fromPos: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      fromTgt: new THREE.Vector3(),
      toTgt: new THREE.Vector3(),
    }
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

    const flyTo = (px: number, py: number, pz: number, tx: number, ty: number, tz: number, dur: number) => {
      tween.fromPos.copy(camera.position)
      tween.fromTgt.copy(controls.target)
      tween.toPos.set(px, py, pz)
      tween.toTgt.set(tx, ty, tz)
      tween.t0 = performance.now()
      tween.dur = dur
      tween.active = true
      controls.autoRotate = false
    }

    // dolly de entrada suave: de longe ate o enquadre padrao
    const portrait = el.clientWidth < el.clientHeight
    flyTo(0, portrait ? 390 : 290, portrait ? 840 : 650, 0, 0, 0, 2600)

    const flyDir = new THREE.Vector3()
    const flyView = new THREE.Vector3()
    const flyRight = new THREE.Vector3()
    const flyUpS = new THREE.Vector3()
    const flyToNode = (x: number, y: number, z: number) => {
      flyDir.set(x, y, z)
      if (flyDir.lengthSq() < 1) flyDir.set(0, 0.3, 1)
      flyDir.normalize()
      // parada a ~30 unidades (era 58): com o piso 16 e o fade da poeira,
      // o voo termina com a estrela exata dominando o quadro.
      // ⚠️ chegada DE CIMA (14 radial, 26 vertical), nao rasante: a rasante
      // atravessava a concha dos filhos (raio +34) e as estrelas coladas na
      // camera viravam parede de bokeh por cima da HUD inteira.
      const px = x + flyDir.x * 14
      const py = y + 26
      const pz = z + flyDir.z * 14
      // ⚠️ ANCORA FORA DO PAINEL: centrada, a estrela parava exatamente
      // atras do painel de info (retrato: painel em cima; desktop: painel
      // a direita) e o fundador via o banner tapando a propria estrela.
      // Deslocar CAMERA E ALVO pelo mesmo vetor muda so onde a estrela cai
      // no quadro, sem mudar distancia nem orientacao: retrato joga a
      // estrela pra ~76% da altura (abaixo do painel), desktop pra ~40% da
      // largura (a esquerda do painel lateral).
      flyView.set(x - px, y - py, z - pz).normalize()
      flyRight.set(-flyView.z, 0, flyView.x)
      if (flyRight.lengthSq() < 1e-6) flyRight.set(1, 0, 0)
      flyRight.normalize()
      flyUpS.crossVectors(flyRight, flyView)
      const aspect = el.clientWidth / Math.max(1, el.clientHeight)
      // altura do mundo visivel na profundidade da estrela (fov 55)
      const dCam = Math.sqrt(14 * 14 + 26 * 26)
      const alturaMundo = 2 * dCam * Math.tan((55 * Math.PI) / 360)
      const larguraMundo = alturaMundo * aspect
      const fx = aspect < 1 ? 0.5 : 0.4
      const fy = aspect < 1 ? 0.76 : 0.5
      const kx = (0.5 - fx) * larguraMundo
      const ky = (fy - 0.5) * alturaMundo
      const ox = flyRight.x * kx + flyUpS.x * ky
      const oy = flyRight.y * kx + flyUpS.y * ky
      const oz = flyRight.z * kx + flyUpS.z * ky
      flyTo(px + ox, py + oy, pz + oz, x + ox, y + oy, z + oz, 1600)
    }

    // ── selecao: filhos em leque + linhagem + painel ─────────────────────────
    const setLineage = (pathNodes: TreeNode[]) => {
      let n = 0
      // a raiz entra como origem mesmo se o path ja comecar nela
      if (pathNodes.length === 0 || pathNodes[0].d > 0) {
        pathArr[0] = 0
        pathArr[1] = 0
        pathArr[2] = 0
        n = 1
      }
      for (const node of pathNodes) {
        if (n >= MAX_PATH) break
        if (node.d <= 0) {
          pathArr[n * 3] = 0
          pathArr[n * 3 + 1] = 0
          pathArr[n * 3 + 2] = 0
        } else {
          const idx = ensureNode(node)
          if (idx < 0) continue
          pathArr[n * 3] = posArr[idx * 3]
          pathArr[n * 3 + 1] = posArr[idx * 3 + 1]
          pathArr[n * 3 + 2] = posArr[idx * 3 + 2]
        }
        n++
      }
      flushStars()
      pathGeom.setDrawRange(0, n)
      ;(pathGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    }

    const clearLineage = () => {
      pathGeom.setDrawRange(0, 0)
    }

    const materializeChildren = async (parent: TreeNode) => {
      if (expanded.has(parent.w) || parent.c <= 0) return
      expanded.add(parent.w)
      try {
        const res = await fetch(`/api/holders/tree/children?addr=${encodeURIComponent(parent.w)}&limit=400&offset=0`)
        if (!res.ok || disposed) return
        const data = (await res.json()) as { children: TreeNode[] }
        const children = (data.children || []).map(sanitizeNode)
        if (children.length === 0) return

        // angulo do pai na propria concha; raiz usa angulo 0
        let pTheta = 0
        let px = 0
        let py = 0
        let pz = 0
        const pIdx = indexByWallet.get(parent.w)
        if (pIdx !== undefined) {
          px = posArr[pIdx * 3]
          py = posArr[pIdx * 3 + 1]
          pz = posArr[pIdx * 3 + 2]
          pTheta = Math.atan2(pz, px)
        }
        let wrote = false
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (indexByWallet.has(child.w)) continue
          if (starCount >= MAX_NODES) break
          const depth = child.d > 0 ? child.d : parent.d + 1
          childFanPosition(pTheta, i, children.length, depth, child.w, tmpV)
          const idx = writeStar(child, tmpV.x, tmpV.y, tmpV.z)
          addLink(px, py, pz, posArr[idx * 3], posArr[idx * 3 + 1], posArr[idx * 3 + 2])
          wrote = true
        }
        if (wrote) flushStars()
      } catch {
        // sem drama: a arvore ainda pode estar sendo escrita
      }
    }

    const fetchPathAndDraw = async (addr: string): Promise<TreeNode | null> => {
      try {
        const res = await fetch(`/api/holders/tree/path?addr=${encodeURIComponent(addr)}`)
        if (!res.ok || disposed) return null
        const data = (await res.json()) as { path: TreeNode[] }
        const path = (data.path || []).map(sanitizeNode)
        if (path.length === 0) return null
        setLineage(path)
        return path[path.length - 1]
      } catch {
        return null
      }
    }

    const selectNode = (node: TreeNode) => {
      setSelected(node)
      setCopied(false)
      void materializeChildren(node)
      void fetchPathAndDraw(node.w)
    }

    // busca: voa ate o no; se nao esta no esqueleto, materializa via /path
    const focusWallet = async (addr: string) => {
      const target = await fetchPathAndDraw(addr)
      if (!target || disposed) return
      setSelected(target)
      setCopied(false)
      void materializeChildren(target)
      const idx = indexByWallet.get(target.w)
      if (target.d <= 0 || idx === undefined) {
        flyToNode(0, 0, 0)
      } else {
        flyToNode(posArr[idx * 3], posArr[idx * 3 + 1], posArr[idx * 3 + 2])
      }
    }

    apiRef.current = {
      focusWallet: (addr: string) => void focusWallet(addr),
      clearSelection: () => {
        clearLineage()
        setSelected(null)
      },
    }

    // ── picking por PROJEÇÃO DE TELA, não por threshold de raio ─────────────
    // ⚠️ O raycast de Points com threshold em unidades de MUNDO fazia só o
    // sol (que é malha) ser clicável: a distância útil variava com o zoom e
    // no celular nenhum toque acertava (o fundador reportou). Agora cada
    // estrela do esqueleto é projetada pra tela e vence a mais próxima do
    // ponteiro dentro do raio em PIXELS (maior no toque).
    const raycaster = new THREE.Raycaster()
    const mouseNdc = new THREE.Vector2()
    const projV = new THREE.Vector3()
    let hoverIdx = -3 // -3 nada, -1 sol, >=0 estrela
    let downX = 0
    let downY = 0

    const pickAt = (clientX: number, clientY: number, raioPx: number): number => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouseNdc, camera)
      if (raycaster.intersectObject(sunMesh, false).length > 0) return -1
      const px = clientX - rect.left
      const py = clientY - rect.top
      let melhor = -3
      let melhorD = raioPx * raioPx
      for (let i = 0; i < starCount; i++) {
        projV.set(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2])
        projV.project(camera)
        if (projV.z > 1) continue // atrás da câmera
        const sx = (projV.x * 0.5 + 0.5) * rect.width
        const sy = (-projV.y * 0.5 + 0.5) * rect.height
        const d = (sx - px) * (sx - px) + (sy - py) * (sy - py)
        if (d < melhorD) {
          melhorD = d
          melhor = i
        }
      }
      return melhor
    }

    // populacao: mesmo picking por projecao de tela, com throttle no hover
    // (24k projecoes por movimento de mouse pesam; 90ms ninguem percebe)
    const pickPop = (clientX: number, clientY: number, raioPx: number): number => {
      if (!popPos) return -1
      const rect = renderer.domElement.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      let melhor = -1
      let melhorD = raioPx * raioPx
      for (let i = 0; i < popAddr.length; i++) {
        projV.set(popPos[i * 3], popPos[i * 3 + 1], popPos[i * 3 + 2])
        projV.project(camera)
        if (projV.z > 1) continue
        const sx = (projV.x * 0.5 + 0.5) * rect.width
        const sy = (-projV.y * 0.5 + 0.5) * rect.height
        const d = (sx - px) * (sx - px) + (sy - py) * (sy - py)
        if (d < melhorD) {
          melhorD = d
          melhor = i
        }
      }
      return melhor
    }
    let hoverPop = -1
    let hoverPopT = 0

    const onPointerMove = (e: PointerEvent) => {
      const idx = pickAt(e.clientX, e.clientY, 12)
      if (idx === hoverIdx && idx === -3) {
        // esqueleto nao acertou: tenta a populacao, com throttle
        const agora = performance.now()
        if (agora - hoverPopT < 90) return
        hoverPopT = agora
        const pi = pickPop(e.clientX, e.clientY, 10)
        if (pi === hoverPop) return
        hoverPop = pi
        if (pi === -1) {
          renderer.domElement.style.cursor = 'grab'
          setTooltip(null)
          return
        }
        renderer.domElement.style.cursor = 'pointer'
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          addr: shortAddr(popAddr[pi]),
          label: `Generation ${popDepth ? popDepth[pi] : '?'}`,
          balance: 0,
          subtreeHolders: 0,
          holder: !!(popHolder && popHolder[pi]),
          minimal: true,
        })
        return
      }
      hoverPop = -1
      hoverIdx = idx
      renderer.domElement.style.cursor = idx === -3 ? 'grab' : 'pointer'
      if (idx === -3) {
        setTooltip(null)
      } else if (idx === -1) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          addr: rootNode ? shortAddr(rootNode.w) : 'Airdrop treasury',
          label: rootNode?.label?.name ?? 'Airdrop treasury',
          balance: rootNode?.b ?? 0,
          subtreeHolders: rootNode?.sh ?? 0,
          holder: true,
        })
      } else {
        const n = nodeMeta[idx]
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          addr: shortAddr(n.w),
          label: n.label?.name,
          balance: n.b,
          subtreeHolders: n.sh,
          holder: n.h,
        })
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }

    const onPointerUp = (e: PointerEvent) => {
      // clique de verdade, nao o fim de um arrasto de orbita
      // ⚠️ no TOQUE o dedo sempre escorrega alguns pixels entre down e up:
      // 6px matava todo tap no celular; a tolerância agora respeita o tipo
      const toleranciaTap = e.pointerType === 'touch' ? 16 : 7
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > toleranciaTap) return
      const idx = pickAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 26 : 14)
      // ⚠️ o clique tambem VOA (antes so a busca voava): sem o voo, o painel
      // de info abria por cima da estrela parada no centro e o fundador via
      // o banner tapando a propria carteira. O voo ancora a estrela fora da
      // area do painel (ver flyToNode).
      if (idx === -1 && rootNode) {
        selectNode(rootNode)
        flyToNode(0, 0, 0)
      } else if (idx >= 0) {
        selectNode(nodeMeta[idx])
        flyToNode(posArr[idx * 3], posArr[idx * 3 + 1], posArr[idx * 3 + 2])
      } else {
        // ponto da populacao: e uma carteira real, o dossie completo vem do
        // /path via focusWallet (que tambem voa e materializa os filhos)
        const pi = pickPop(e.clientX, e.clientY, e.pointerType === 'touch' ? 22 : 12)
        if (pi >= 0) void focusWallet(popAddr[pi])
      }
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // ── carga inicial do esqueleto ───────────────────────────────────────────
    const loadTree = async () => {
      try {
        const res = await fetch('/api/holders/tree')
        if (!res.ok) throw new Error(`tree ${res.status}`)
        const data = (await res.json()) as TreeResponse
        if (disposed) return
        rootNode = sanitizeNode(data.root)
        const nodes = (data.nodes || []).map(sanitizeNode)
        for (const n of nodes) ensureNode(n)
        flushStars()
        const gens = data.gens || []
        // populacao real no lugar da poeira; sem ela a cena segue so com o
        // esqueleto (a rota degrada pra lista vazia, nunca 500)
        void (async () => {
          try {
            const resP = await fetch(`/api/holders/tree/population?n=${mobile ? 12000 : 24000}`)
            if (!resP.ok || disposed) return
            const pop = (await resP.json()) as { total: number; w: [string, number, number][] }
            if (disposed || !Array.isArray(pop.w)) return
            buildPopulation(pop.w)
            setPopInfo({ drawn: pop.w.length, total: pop.total || 0 })
          } catch {
            /* esqueleto sozinho ainda e uma galaxia */
          }
        })()
        const wallets = gens.reduce((acc, g) => acc + Math.max(0, g.wallets), 0)
        const holders = gens.reduce((acc, g) => acc + Math.max(0, g.holders), 0)
        const generations = gens.reduce((acc, g) => Math.max(acc, g.depth), 0)
        setHud({ status: 'live', wallets, holders, generations })
      } catch {
        if (!disposed) setHud((prev) => ({ ...prev, status: 'error' }))
      }
    }
    void loadTree()

    // ── resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
      updatePointScale()
    }
    window.addEventListener('resize', onResize)

    // ── loop: zero alocacao por frame ────────────────────────────────────────
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const now = performance.now()
      if (tween.active) {
        const t = Math.min(1, (now - tween.t0) / tween.dur)
        const k = easeInOut(t)
        camera.position.lerpVectors(tween.fromPos, tween.toPos, k)
        controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k)
        if (t >= 1) tween.active = false
      }
      const pulse = 1 + Math.sin(now * 0.0012) * 0.05
      halo.scale.set(64 * pulse, 64 * pulse, 1)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ── cleanup completo ─────────────────────────────────────────────────────
    return () => {
      disposed = true
      apiRef.current = null
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.removeEventListener('start', stopIdleSpin)
      controls.dispose()
      starGeom.dispose()
      starMat.dispose()
      pathGeom.dispose()
      pathMat.dispose()
      linkGeom.dispose()
      linkMat.dispose()
      sunMesh.geometry.dispose()
      ;(sunMesh.material as THREE.Material).dispose()
      haloMat.dispose()
      ;(haloOuter.material as THREE.Material).dispose()
      if (popPoints) popPoints.geometry.dispose()
      starTex.dispose()
      sunTex.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement)
    }
    // roda uma unica vez: toda comunicacao posterior passa por apiRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard bloqueado: sem fallback barulhento
    }
  }

  const pickResult = (w: string) => {
    setResults([])
    setQuery('')
    apiRef.current?.focusWallet(w)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#040305] font-mono text-white">
      <div ref={mountRef} className="absolute inset-0" />

      {/* HUD superior: titulo, subtitulo e contadores vindos de gens[] */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 pointer-events-none">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <a
              href="/holders"
              className="pointer-events-auto text-[10px] tracking-[0.25em] uppercase text-white/40 hover:text-[#f7931a] transition-colors"
            >
              ← Holders
            </a>
            <h1 className="mt-1 text-lg sm:text-xl tracking-[0.3em] uppercase text-white/90">$DOG Galaxy</h1>
            <p className="mt-1 max-w-md text-[11px] leading-relaxed text-white/50">
              Every wallet that ever touched DOG, branching from the airdrop treasury. Lit nodes still hold today.
            </p>
            <div className="mt-3 flex gap-6 text-[10px] tracking-[0.2em] uppercase">
              <div>
                <div className="text-white/40">Total wallets</div>
                <div className="mt-0.5 text-sm text-[#f7931a]">
                  {hud.status === 'live' ? fmtInt(hud.wallets) : '...'}
                </div>
              </div>
              <div>
                <div className="text-white/40">Holders lit</div>
                <div className="mt-0.5 text-sm text-[#f7931a]">
                  {hud.status === 'live' ? fmtInt(hud.holders) : '...'}
                </div>
              </div>
              <div>
                <div className="text-white/40">Generations</div>
                <div className="mt-0.5 text-sm text-[#f7931a]">
                  {hud.status === 'live' ? fmtInt(hud.generations) : '...'}
                </div>
              </div>
            </div>
            {popInfo && (
              <p className="mt-2 max-w-md text-[9px] leading-relaxed text-white/35">
                Every dot is a real wallet: {fmtInt(popInfo.drawn)} sampled plus the brightest
                lineages, out of {fmtInt(popInfo.total)} mapped. Search reaches them all.
              </p>
            )}
            {hud.status === 'error' && (
              <p className="mt-2 text-[10px] text-white/40">Tree data is still being written. Refresh in a moment.</p>
            )}
          </div>

          {/* busca por endereco */}
          <div className="pointer-events-auto relative w-full sm:w-80">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address"
              spellCheck={false}
              className="w-full bg-[#0a0708]/80 border border-white/10 rounded px-3 py-2 text-xs text-white/80 placeholder:text-white/30 outline-none focus:border-[#f7931a]/60 transition-colors"
            />
            {query.trim().length >= 3 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0708]/95 border border-white/10 rounded overflow-hidden z-20">
                {searching && <div className="px-3 py-2 text-[10px] text-white/40">Searching...</div>}
                {!searching && results.length === 0 && (
                  <div className="px-3 py-2 text-[10px] text-white/40">No wallet found</div>
                )}
                {!searching &&
                  results.map((r) => (
                    <button
                      key={r.w}
                      onClick={() => pickResult(r.w)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-[#f7931a] transition-colors"
                    >
                      <span>{shortAddr(r.w)}</span>
                      <span className="text-white/40">{r.h ? `${fmtDog(r.b)} DOG` : 'spent'}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* tooltip 2D do hover */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-[#0a0708]/90 border border-white/10 rounded px-3 py-2 text-[10px] leading-relaxed"
          style={{
            left: Math.min(tooltip.x + 14, typeof window !== 'undefined' ? window.innerWidth - 200 : tooltip.x),
            top: tooltip.y + 14,
          }}
        >
          <div className="text-white/90">{tooltip.addr}</div>
          {tooltip.label && <div className="text-[#f7931a]">{tooltip.label}</div>}
          {tooltip.minimal ? (
            <div className="text-white/50">
              {tooltip.holder ? 'still holding' : 'fully spent'} · click for details
            </div>
          ) : (
            <>
              <div className="text-white/50">
                {tooltip.holder ? `${fmtDog(tooltip.balance)} DOG held` : 'fully spent'}
              </div>
              <div className="text-white/50">{fmtInt(tooltip.subtreeHolders)} holders in subtree</div>
            </>
          )}
        </div>
      )}

      {/* painel lateral do no selecionado */}
      {selected && (
        <div className="absolute top-0 right-0 h-full w-full sm:w-96 p-4 sm:p-6 pointer-events-none flex items-start sm:items-center">
          <div className="pointer-events-auto w-full bg-[#0a0708]/90 border border-white/10 rounded-lg p-3 backdrop-blur-sm mt-36 sm:mt-0 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] tracking-[0.25em] uppercase text-white/40">
                  {selected.d <= 0 ? 'Airdrop treasury' : `Generation ${selected.d}`}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-white/90 truncate">{shortAddr(selected.w)}</span>
                  <button
                    onClick={() => copyAddress(selected.w)}
                    className="shrink-0 text-[9px] tracking-[0.15em] uppercase border border-white/10 rounded px-1.5 py-0.5 text-white/50 hover:text-[#f7931a] hover:border-[#f7931a]/50 transition-colors"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {selected.label && (
                  <div className="mt-1 text-[11px] text-[#f7931a]">{selected.label.name}</div>
                )}
              </div>
              <button
                onClick={() => apiRef.current?.clearSelection()}
                className="shrink-0 text-white/40 hover:text-white/80 transition-colors text-sm leading-none"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:mt-4 sm:gap-y-3">
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">DOG held</div>
                <div className={`mt-0.5 text-[12px] sm:text-sm ${selected.h ? 'text-[#f7931a]' : 'text-white/50'}`}>
                  {fmtDog(selected.b)}
                </div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">First block</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{selected.fb > 0 ? fmtInt(selected.fb) : '...'}</div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Subtree holders</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtInt(selected.sh)}</div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Subtree wallets</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtInt(selected.sw)}</div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Subtree DOG</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtDog(selected.sb)}</div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Direct children</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtInt(selected.c)}</div>
              </div>
            </div>

            {/* regra da casa: link de carteira fica em casa */}
            <a
              href={`/address/bitcoin/${selected.w}`}
              className="mt-3 block w-full text-center text-[10px] tracking-[0.25em] uppercase border border-[#f7931a]/40 text-[#f7931a] rounded px-3 py-1.5 sm:mt-5 sm:py-2 hover:bg-[#f7931a]/10 transition-colors"
            >
              View address
            </a>
            {selected.c > 0 && (
              <p className="mt-3 hidden text-[10px] text-white/40 leading-relaxed sm:block">
                Children fan out on the next shell. The bright line traces this wallet back to the treasury.
              </p>
            )}
          </div>
        </div>
      )}

      {/* estado de carga */}
      {hud.status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/50">Charting the galaxy...</p>
        </div>
      )}
    </div>
  )
}
