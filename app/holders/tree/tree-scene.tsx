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
  sizeFromBalance,
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

interface FlowPeer {
  w: string
  label?: { name: string; cat: string; source: string } | null
  dog: number
  txs: number
}

interface NodeDossier {
  w: string
  label?: { name: string; cat: string; source: string } | null
  balance_dog: number
  pct_supply: number
  rank: number | null
  is_holder: boolean
  lth_sth: string | null
  depth: number
  first_block: number
  cohort_tier: string | null
  flows: { in_dog: number; out_dog: number; top_in: FlowPeer[]; top_out: FlowPeer[] }
}

interface SceneApi {
  focusWallet: (addr: string) => void
  clearSelection: () => void
  clearTrails: () => void
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
  const [popInfo, setPopInfo] = useState<{ drawn: number } | null>(null)
  const [trilhas, setTrilhas] = useState(0)
  // dossie rico da rota /node (o mesmo que o Flow usa): rank, % do supply,
  // LTH/STH, coorte e as maiores contrapartes com rotulo
  const [dossie, setDossie] = useState<NodeDossier | null>(null)
  const [cardAberto, setCardAberto] = useState(false)

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

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.5, 14000)
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
    controls.maxDistance = 6000
    // ⚠️ NAVEGACAO LIVRE COM SELECAO (fundador, 26/08): sem isso o dolly so
    // ia ATE a estrela selecionada (o alvo da orbita fica nela) e viajar
    // pra uma conexao exigia pan; com zoomToCursor o zoom LEVA a camera na
    // direcao do ponteiro/pinca, entao da pra apontar pra qualquer estrela
    // conectada e ir ate ela, selecionado ou nao
    controls.zoomToCursor = true
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
          // nevoa ilegivel (chapa do fundador no celular). Com a ESCALA
          // REAL (lei de potencia sobre o saldo) o teto sobe pra 150: e ele
          // que deixa a tesouraria e a Kraken serem visivelmente enormes;
          // 34 estava CORTANDO o topo da escala e achatando as baleias
          // contra as sardinhas. O piso cai pra 0.8: sem isso as carteiras
          // pequenas empatavam por baixo no zoom-out (foi o que o fundador
          // viu: "todas as estrelas tem o mesmo tamanho").
          gl_PointSize = clamp(ps, 0.8, 150.0);
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
      if (linkCount % 25 === 0 || linkCount === 1) setTrilhas(linkCount)
      ;(linkGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    }

    // ── populacao: TODAS as carteiras do historico, cada ponto real ──────────
    // Diretriz do fundador (26/08, duas rodadas): nenhum ponto decorativo E
    // nenhuma amostra: a galaxia desenha o universo inteiro. O payload e
    // binario e sem enderecos (~2,3MB para 264k): posicoes int16 (x8),
    // geracao uint16, classe uint8 e o indice de cada ponto na ordem
    // canonica do banco; a identidade resolve no CLIQUE via /population/at.
    // O esqueleto (top 3000) ja vem excluido do binario pelo export.
    let popPoints: THREE.Points | null = null
    let popPos: Float32Array | null = null
    let popDepth: Uint16Array | null = null
    let popClasse: Uint8Array | null = null
    let popOrdem: Uint32Array | null = null
    let popResolvendo = false
    // ── o leque do airdrop: TODAS as arestas tesouraria -> geracao 1 ────────
    // Pedido do fundador (26/08): a carteira do airdrop precisa MOSTRAR as
    // ~80 mil arestas dela. Com as geracoes ESFERICAS o leque abre em 3D
    // (dente-de-leao) em vez de empilhar num disco. Duas camadas, ambas na
    // receita do linkMat (cor uniforme + opacity, que comprovadamente
    // renderiza nesta cena; o caminho de vertexColors em LineBasicMaterial
    // rendeu linhas brancas e cinco chapas estouradas):
    //   veu: TODOS os fios, opacity minuscula (no miolo ha dezenas de fios
    //        por pixel, o conjunto vira nevoa dourada);
    //   raios: 1 a cada 67 fios, acesos, dando estrutura visivel de longe.
    let burstVeu: THREE.LineSegments | null = null
    let burstRaios: THREE.LineSegments | null = null
    let burstDest: THREE.Points | null = null
    // o leque e ESTADO DO CLIQUE (fundador, 26/08): padrao DESLIGADO; abre
    // quando a tesouraria e selecionada e fecha quando a selecao muda,
    // igual ao leque de filhos de qualquer outra carteira
    let lequeDesejado = false
    const atualizaLeque = (raiz: boolean) => {
      lequeDesejado = raiz
      if (raiz) buildAirdropBurst()
      if (burstVeu) burstVeu.visible = raiz
      if (burstRaios) burstRaios.visible = raiz
      if (burstDest) burstDest.visible = raiz
    }
    const buildAirdropBurst = () => {
      if (burstVeu || !popPos || !popDepth) return
      let n = 0
      for (let i = 0; i < popDepth.length; i++) if (popDepth[i] === 1) n++
      for (let i = 0; i < starCount; i++) if (nodeMeta[i] && nodeMeta[i].d === 1) n++
      if (n === 0) return
      const nRaios = Math.floor(n / 67) + 1
      const posVeu = new Float32Array(n * 6)
      const posRaios = new Float32Array(nRaios * 6)
      let kV = 0
      let kR = 0
      const escreve = (x: number, y: number, z: number) => {
        const oV = kV * 6
        posVeu[oV + 3] = x
        posVeu[oV + 4] = y
        posVeu[oV + 5] = z
        if (kV % 67 === 0 && kR < nRaios) {
          const oR = kR * 6
          posRaios[oR + 3] = x
          posRaios[oR + 4] = y
          posRaios[oR + 5] = z
          kR++
        }
        kV++
      }
      for (let i = 0; i < popDepth.length; i++) {
        if (popDepth[i] === 1) escreve(popPos[i * 3], popPos[i * 3 + 1], popPos[i * 3 + 2])
      }
      for (let i = 0; i < starCount; i++) {
        if (nodeMeta[i] && nodeMeta[i].d === 1) escreve(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2])
      }
      const gV = new THREE.BufferGeometry()
      gV.setAttribute('position', new THREE.BufferAttribute(posVeu, 3))
      const mV = new THREE.LineBasicMaterial({
        color: 0xf7931a,
        transparent: true,
        opacity: 0.015,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      burstVeu = new THREE.LineSegments(gV, mV)
      burstVeu.frustumCulled = false
      scene.add(burstVeu)
      const gR = new THREE.BufferGeometry()
      gR.setAttribute('position', new THREE.BufferAttribute(posRaios.subarray(0, kR * 6), 3))
      const mR = new THREE.LineBasicMaterial({
        color: 0xffb347,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      burstRaios = new THREE.LineSegments(gR, mR)
      burstRaios.frustumCulled = false
      scene.add(burstRaios)
      // ⚠️ DESTINOS EM DESTAQUE: o fundador clicou no airdrop e nao viu em
      // QUAIS estrelas as arestas pousavam. Destacar as 80 mil nao resolve
      // (virou uma bola branca solida na primeira tentativa): destaca as
      // MAIORES, que sao as que o olho procura. Limiar byte >= 139
      // (1M+ DOG na escala do export), anel claro por cima do ponto.
      const idxDest: number[] = []
      if (popClasse && popDepth) {
        for (let i = 0; i < popDepth.length; i++) {
          if (popDepth[i] === 1 && popClasse[i] >= 139) idxDest.push(i)
        }
      }
      const nD = idxDest.length
      const posDest = new Float32Array(nD * 3)
      const colDest = new Float32Array(nD * 3)
      const sizeDest = new Float32Array(nD)
      for (let j = 0; j < nD; j++) {
        const i = idxDest[j]
        posDest[j * 3] = popPos[i * 3]
        posDest[j * 3 + 1] = popPos[i * 3 + 1]
        posDest[j * 3 + 2] = popPos[i * 3 + 2]
        colDest[j * 3] = 0.85
        colDest[j * 3 + 1] = 0.62
        colDest[j * 3 + 2] = 0.28
        // um degrau acima do tamanho real da carteira: destaca sem mentir
        const saldo = Math.pow(10, (popClasse![i] / 255) * 11) - 1
        sizeDest[j] = sizeFromBalance(saldo) * 1.35
      }
      const gD = new THREE.BufferGeometry()
      gD.setAttribute('position', new THREE.BufferAttribute(posDest, 3))
      gD.setAttribute('color', new THREE.BufferAttribute(colDest, 3))
      gD.setAttribute('size', new THREE.BufferAttribute(sizeDest, 1))
      burstDest = new THREE.Points(gD, starMat)
      burstDest.frustumCulled = false
      scene.add(burstDest)
      burstVeu.visible = lequeDesejado
      burstRaios.visible = lequeDesejado
      burstDest.visible = lequeDesejado
    }

    let popFormato = 0
    const buildPopulation = (buf: ArrayBuffer) => {
      const dv = new DataView(buf)
      if (buf.byteLength < 8) return
      const magia = dv.getUint32(0, false)
      // DGX1: byte de classe (0/1/2/3). DGX2: byte CONTINUO de tamanho em
      // escala log (cereja do bolo do fundador: mais DOG, estrela maior).
      // Os dois convivem porque a CDN pode servir o binario velho por ate
      // uma hora depois do deploy.
      if (magia === 0x44475831) popFormato = 1
      else if (magia === 0x44475832) popFormato = 2
      else return
      const n = dv.getUint32(4, true)
      const fimXyz = 8 + n * 6
      const fimDep = fimXyz + n * 2
      const fimCls = fimDep + n
      const fimOrd = fimCls + n * 4
      if (buf.byteLength < fimOrd) return
      // slice realinha cada bloco em offset 0 (uint32 exige alinhamento 4)
      const xyz = new Int16Array(buf.slice(8, fimXyz))
      popDepth = new Uint16Array(buf.slice(fimXyz, fimDep))
      popClasse = new Uint8Array(buf.slice(fimDep, fimCls))
      popOrdem = new Uint32Array(buf.slice(fimCls, fimOrd))
      popPos = new Float32Array(n * 3)
      const cols = new Float32Array(n * 3)
      const sizes = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        popPos[i * 3] = xyz[i * 3] / 8
        popPos[i * 3 + 1] = xyz[i * 3 + 1] / 8
        popPos[i * 3 + 2] = xyz[i * 3 + 2] / 8
        const c = popClasse[i]
        if (c === 0) {
          // zero DOG: pequena padrao, cinza-brasa
          cols[i * 3] = 0.15
          cols[i * 3 + 1] = 0.125
          cols[i * 3 + 2] = 0.11
          sizes[i] = 1.2
        } else if (popFormato === 2) {
          // ESCALA REAL: o byte guarda log10(1+saldo)/11; desfaz o log pra
          // recuperar o saldo e aplica a MESMA curva do esqueleto
          // (sizeFromBalance, lei de potencia normalizada pelo supply).
          // Estrela de 2 mil DOG e visivelmente menor que uma de 2 milhoes,
          // que e visivelmente menor que uma baleia: era o pedido.
          const saldo = Math.pow(10, (c / 255) * 11) - 1
          const s = sizeFromBalance(saldo)
          sizes[i] = s
          // brilho acompanha o tamanho de leve (as grandes ja dominam por
          // area; empurrar cor tambem satura o miolo em aditivo)
          const brilho = 0.85 + Math.min(1, s / 46) * 0.4
          cols[i * 3] = 0.5 * brilho
          cols[i * 3 + 1] = 0.28 * brilho
          cols[i * 3 + 2] = 0.06 * brilho
        } else if (c === 1) {
          cols[i * 3] = 0.5
          cols[i * 3 + 1] = 0.28
          cols[i * 3 + 2] = 0.06
          sizes[i] = 1.5
        } else if (c === 2) {
          cols[i * 3] = 0.62
          cols[i * 3 + 1] = 0.36
          cols[i * 3 + 2] = 0.08
          sizes[i] = 2.1
        } else {
          cols[i * 3] = 0.72
          cols[i * 3 + 1] = 0.44
          cols[i * 3 + 2] = 0.1
          sizes[i] = 2.9
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
      if (lequeDesejado) buildAirdropBurst()
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

    // ⚠️ o dedo manda: qualquer interacao do usuario CANCELA o voo em
    // andamento (o tween reimpunha camera e alvo por 1.6s e a navegacao
    // parecia travada logo depois de clicar numa estrela)
    const cancelaVoo = () => {
      tween.active = false
    }
    controls.addEventListener('start', cancelaVoo)

    // dolly de entrada suave: de longe ate o enquadre padrao
    const portrait = el.clientWidth < el.clientHeight
    flyTo(0, portrait ? 720 : 540, portrait ? 1540 : 1220, 0, 0, 0, 2600)

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
      // a tesouraria e caso especial: parar a 30 do centro poe a camera
      // DENTRO da esfera da G1 (r=120) e o leque vira parede de fogo; a
      // parada dela e fora da casca, com o dente-de-leao inteiro no quadro
      const raiz = x === 0 && y === 0 && z === 0
      // a esfera da G1 tem raio ~143: a parada precisa ficar FORA dela com
      // folga, senao o leque preenche a tela inteira e nao da pra ver onde
      // as arestas pousam
      const radial = raiz ? 300 : 14
      const alto = raiz ? 480 : 26
      const px = x + flyDir.x * radial
      const py = y + alto
      const pz = z + flyDir.z * radial
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
      const dCam = Math.sqrt(radial * radial + alto * alto)
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
        let pPhi = Math.PI / 2
        let px = 0
        let py = 0
        let pz = 0
        const pIdx = indexByWallet.get(parent.w)
        if (pIdx !== undefined) {
          px = posArr[pIdx * 3]
          py = posArr[pIdx * 3 + 1]
          pz = posArr[pIdx * 3 + 2]
          pTheta = Math.atan2(pz, px)
          const pR = Math.sqrt(px * px + py * py + pz * pz)
          if (pR > 1) pPhi = Math.acos(Math.max(-1, Math.min(1, py / pR)))
        }
        let wrote = false
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (indexByWallet.has(child.w)) continue
          if (starCount >= MAX_NODES) break
          const depth = child.d > 0 ? child.d : parent.d + 1
          childFanPosition(pTheta, pPhi, i, children.length, depth, child.w, tmpV)
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
      atualizaLeque(node.d <= 0)
      void materializeChildren(node)
      void fetchPathAndDraw(node.w)
    }

    // busca: voa ate o no; se nao esta no esqueleto, materializa via /path
    const focusWallet = async (addr: string) => {
      const target = await fetchPathAndDraw(addr)
      if (!target || disposed) return
      setSelected(target)
      setCopied(false)
      atualizaLeque(target.d <= 0)
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
        atualizaLeque(false)
        setSelected(null)
      },
      // Clear de verdade: o desenho que o usuario foi acumulando clique a
      // clique (arestas pai-filho de cada carteira aberta) e uma feature,
      // mas precisava de vassoura (fundador 26/08). Zera as arestas, a
      // linhagem, o leque e o conjunto de expandidos, entao os mesmos
      // cliques voltam a materializar do zero.
      clearTrails: () => {
        linkCount = 0
        linkGeom.setDrawRange(0, 0)
        clearLineage()
        atualizaLeque(false)
        expanded.clear()
        setSelected(null)
        setTrilhas(0)
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
      if (!popPos || !popOrdem) return -1
      const rect = renderer.domElement.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      let melhor = -1
      let melhorD = raioPx * raioPx
      for (let i = 0; i < popOrdem.length; i++) {
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
        // sem endereco no payload: a identidade resolve no clique
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          addr: `Generation ${popDepth ? popDepth[pi] : '?'} wallet`,
          label:
            popClasse && popClasse[pi] > 0
              ? popFormato === 2
                ? popClasse[pi] >= 208
                  ? '1B+ DOG'
                  : popClasse[pi] >= 185
                    ? '100M+ DOG'
                    : popClasse[pi] >= 139
                      ? '1M+ DOG'
                      : undefined
                : popClasse[pi] === 3
                  ? '100M+ DOG'
                  : popClasse[pi] === 2
                    ? '1M+ DOG'
                    : undefined
              : undefined,
          balance: 0,
          subtreeHolders: 0,
          holder: !!(popClasse && popClasse[pi] > 0),
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
        // ponto da populacao: carteira real sem endereco no payload; o
        // indice canonico resolve a identidade em /population/at e dai o
        // focusWallet cuida do dossie, do voo e dos filhos
        const pi = pickPop(e.clientX, e.clientY, e.pointerType === 'touch' ? 22 : 12)
        if (pi >= 0 && popOrdem && !popResolvendo) {
          popResolvendo = true
          void (async () => {
            try {
              const r = await fetch(`/api/holders/tree/population/at?i=${popOrdem![pi]}`)
              if (!r.ok || disposed) return
              const j = (await r.json()) as { w?: string }
              if (j.w && !disposed) await focusWallet(j.w)
            } catch {
              /* resolvedor ocupado: o proximo clique tenta de novo */
            } finally {
              popResolvendo = false
            }
          })()
        }
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
        // populacao completa em binario; sem ela a cena segue so com o
        // esqueleto (a rota degrada pra 204, nunca 500)
        void (async () => {
          try {
            const resP = await fetch('/api/holders/tree/population')
            if (!resP.ok || resP.status === 204 || disposed) return
            const buf = await resP.arrayBuffer()
            if (disposed) return
            buildPopulation(buf)
            if (popOrdem) setPopInfo({ drawn: popOrdem.length })
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
      controls.removeEventListener('start', cancelaVoo)
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
      if (burstVeu) {
        burstVeu.geometry.dispose()
        ;(burstVeu.material as THREE.Material).dispose()
      }
      if (burstRaios) {
        burstRaios.geometry.dispose()
        ;(burstRaios.material as THREE.Material).dispose()
      }
      if (burstDest) burstDest.geometry.dispose()
      starTex.dispose()
      sunTex.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement)
    }
    // roda uma unica vez: toda comunicacao posterior passa por apiRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // dossie completo da carteira selecionada: enriquece o card sem tocar na
  // cena (a rota ja existe e e cacheada; falha nao quebra nada, o card
  // continua com o que a cena ja sabe)
  useEffect(() => {
    const w = selected?.w
    if (!w) {
      setDossie(null)
      return
    }
    let morto = false
    setDossie(null)
    fetch(`/api/holders/tree/node?w=${encodeURIComponent(w)}`, { signal: AbortSignal.timeout(9000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!morto && j && typeof j.balance_dog === 'number') setDossie(j as NodeDossier)
      })
      .catch(() => {})
    return () => {
      morto = true
    }
  }, [selected?.w])

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
                Every dot is a real wallet and every wallet is in the sky:
                {' '}{fmtInt(popInfo.drawn)} in the field plus the brightest lineages.
                Click any dot to open it.
              </p>
            )}
            {trilhas > 0 && (
              <button
                onClick={() => apiRef.current?.clearTrails()}
                className="pointer-events-auto mt-3 border border-white/15 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:border-[#f7931a]/50 hover:text-[#f7931a]"
              >
                Clear trails
              </button>
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
          <div className="pointer-events-auto max-h-[62vh] w-full overflow-y-auto overscroll-contain bg-[#0a0708]/90 border border-white/10 rounded-lg p-3 backdrop-blur-sm mt-36 sm:mt-0 sm:max-h-[86vh] sm:p-5">
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

            {/* linha de identidade: posicao no ranking e fatia do supply,
                os dois numeros que dizem "quao grande e esta carteira" */}
            {dossie && (dossie.rank !== null || dossie.pct_supply > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.15em]">
                {dossie.rank !== null && (
                  <span className="border border-[#f7931a]/40 px-1.5 py-0.5 text-[#f7931a]">
                    Rank #{fmtInt(dossie.rank)}
                  </span>
                )}
                {dossie.pct_supply > 0 && (
                  <span className="border border-white/15 px-1.5 py-0.5 text-white/60">
                    {dossie.pct_supply < 0.01 ? '<0.01' : dossie.pct_supply.toFixed(2)}% of supply
                  </span>
                )}
                {dossie.lth_sth && (
                  <span className="border border-white/15 px-1.5 py-0.5 text-white/60">{dossie.lth_sth}</span>
                )}
                {dossie.cohort_tier && (
                  <span className="border border-white/15 px-1.5 py-0.5 text-white/60">{dossie.cohort_tier}</span>
                )}
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:mt-4 sm:gap-y-3">
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">DOG held</div>
                <div className={`mt-0.5 text-[12px] sm:text-sm ${selected.h ? 'text-[#f7931a]' : 'text-white/50'}`}>
                  {fmtDog(selected.b)}
                </div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Direct children</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtInt(selected.c)}</div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Subtree holders</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtInt(selected.sh)}</div>
              </div>
              <div>
                <div className="tracking-[0.2em] uppercase text-white/40">Subtree DOG</div>
                <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtDog(selected.sb)}</div>
              </div>
            </div>

            {/* ⚠️ o resto do dossie e SEMPRE visivel no desktop (ha espaco de
                sobra) e fica atras do botao no celular, onde o card precisa
                caber junto com a estrela (fundador 26/08) */}
            <div className={`${cardAberto ? 'block' : 'hidden'} sm:block`}>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:gap-y-3">
                <div>
                  <div className="tracking-[0.2em] uppercase text-white/40">Subtree wallets</div>
                  <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtInt(selected.sw)}</div>
                </div>
                <div>
                  <div className="tracking-[0.2em] uppercase text-white/40">First block</div>
                  <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">
                    {selected.fb > 0 ? fmtInt(selected.fb) : '...'}
                  </div>
                </div>
                {dossie && (
                  <>
                    <div>
                      <div className="tracking-[0.2em] uppercase text-white/40">Total received</div>
                      <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtDog(dossie.flows.in_dog)}</div>
                    </div>
                    <div>
                      <div className="tracking-[0.2em] uppercase text-white/40">Total sent</div>
                      <div className="mt-0.5 text-[12px] text-white/80 sm:text-sm">{fmtDog(dossie.flows.out_dog)}</div>
                    </div>
                  </>
                )}
              </div>

              {/* as maiores contrapartes: cada uma leva a propria estrela */}
              {dossie && (dossie.flows.top_in.length > 0 || dossie.flows.top_out.length > 0) && (
                <div className="mt-4 space-y-3">
                  {(
                    [
                      ['Received from', dossie.flows.top_in, '#E8660D'],
                      ['Sent to', dossie.flows.top_out, '#4A90D9'],
                    ] as [string, FlowPeer[], string][]
                  ).map(([titulo, lista, cor]) =>
                    lista.length === 0 ? null : (
                      <div key={titulo}>
                        <div className="text-[9px] uppercase tracking-[0.2em] text-white/40">{titulo}</div>
                        <div className="mt-1 space-y-0.5">
                          {lista.slice(0, 4).map((peer) => (
                            <button
                              key={peer.w}
                              onClick={() => apiRef.current?.focusWallet(peer.w)}
                              className="flex w-full items-center justify-between gap-2 py-0.5 text-left text-[10px] text-white/60 transition-colors hover:text-[#f7931a]"
                            >
                              <span className="truncate">
                                {peer.label ? peer.label.name : shortAddr(peer.w)}
                              </span>
                              <span className="shrink-0 font-mono" style={{ color: cor }}>
                                {fmtDog(peer.dog)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* expandir: so no celular, so quando ha mais para ver */}
            <button
              onClick={() => setCardAberto((v) => !v)}
              className="mt-3 w-full border border-white/10 py-1 text-[9px] uppercase tracking-[0.2em] text-white/45 transition-colors hover:text-white/80 sm:hidden"
            >
              {cardAberto ? 'Less' : 'More details'}
            </button>

            {/* regra da casa: link de carteira fica em casa */}
            <a
              href={`/address/bitcoin/${selected.w}`}
              className="mt-3 block w-full text-center text-[10px] tracking-[0.25em] uppercase border border-[#f7931a]/40 text-[#f7931a] rounded px-3 py-1.5 sm:mt-4 sm:py-2 hover:bg-[#f7931a]/10 transition-colors"
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
