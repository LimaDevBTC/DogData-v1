'use client'

// A CRATERA DA GUERRA: o book de DOG/USD da Kraken como campo de batalha.
//
// A linha de frente é o preço. À esquerda, os cães Shiba de casaco laranja
// Bitcoin (as ordens de compra); à direita, os ursos (as de venda). Cada
// fileira é um nível do book, a distância até a frente é a distância até o
// preço, e o tamanho da tropa é o volume parado ali. Cada trade é um disparo
// que cruza o campo e acerta a linha inimiga, com o impacto do tamanho do
// trade. Dois obeliscos de obsidiana marcam onde a frente esteve nas últimas
// 24 horas: o território disputado do dia.
//
// ⚠️ MENOS É O PONTO. A referência (bitcoin-warfront) empilha menu de armas,
// tape, minimapa e placar por cima do 3D; aqui o HUD são três coisas: o preço,
// a pressão e as baixas. O resto acontece NA CENA, que é a regra da casa.
//
// ⚠️ r3f NÃO ENTRA NESTE REPO (quebra em runtime contra o React instalado):
// Three.js cru, como toda cena da cidade.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { connectKraken, type BookLevel, type WarTrade } from './kraken'
import { shibaGeometry, bearGeometry } from './critters'

const CAP = 4200            // instâncias por exército
const NIVEIS = 40           // níveis do book por lado
const CAMPO_X = 88          // meia largura útil do campo
const FRENTE = 7            // folga entre a costura e a primeira fileira

const fmtDog = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)
const fmtPreco = (p: number) => (p > 0 ? p.toFixed(6) : '-')

// ruído determinístico barato: o mesmo soldado fica sempre no mesmo lugar da fileira
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
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

  useEffect(() => {
    const el = montagem.current
    if (!el) return

    // ── palco ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x040305)
    scene.fog = new THREE.FogExp2(0x040305, 0.0026)

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.5, 900)
    camera.position.set(-50, 32, 72)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    el.appendChild(renderer.domElement)

    // o relevo é UMA função, e todo mundo pisa nela: chão, tropas, costura e
    // obeliscos usam a mesma altura, senão o exército flutua sobre a bacia
    const altura = (x: number, z: number) => {
      const r = Math.hypot(x / 1.35, z)
      const bacia = -3.2 * Math.exp(-((r / 95) ** 2))
      const borda = 2.6 * Math.exp(-(((r - 128) / 26) ** 2))
      const rugosidade =
        0.55 * Math.sin(x * 0.11 + z * 0.07) * Math.sin(z * 0.13 - x * 0.05) +
        0.3 * (hash(Math.round(x * 0.5), Math.round(z * 0.5)) - 0.5)
      return bacia + borda + rugosidade
    }

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 2, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 24
    controls.maxDistance = 240
    controls.maxPolarAngle = 1.38

    // sol baixo e rasante, a luz da cidade; e um resto de brasa vindo de trás
    // dos ursos, senão a horda escura afoga no preto do fundo
    const sol = new THREE.DirectionalLight(0xffd9ae, 2.6)
    sol.position.set(60, 38, 120)
    scene.add(sol)
    scene.add(new THREE.HemisphereLight(0x34344a, 0x120c08, 1.15))
    const brasa = new THREE.DirectionalLight(0x9c3a28, 0.9)
    brasa.position.set(140, 26, -60)
    scene.add(brasa)

    // ── regolito: chão de cratera, deprimido no centro do campo ─────────────
    {
      const g = new THREE.PlaneGeometry(420, 300, 130, 92)
      g.rotateX(-Math.PI / 2)
      const pos = g.attributes.position
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, altura(pos.getX(i), pos.getZ(i)))
      }
      g.computeVertexNormals()
      const chao = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 1 }))
      scene.add(chao)
    }

    // ── estrelas ────────────────────────────────────────────────────────────
    {
      const n = 1400
      const p = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(430)
        v.y = Math.abs(v.y) * 0.9 + 18
        p.set([v.x, v.y, v.z], i * 3)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(p, 3))
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfc4d6, size: 0.7, sizeAttenuation: false })))
    }

    // ── a costura: a linha de frente é o preço, deitada no relevo ───────────
    const matCostura = new THREE.MeshBasicMaterial({ color: 0xffe9c9 })
    const costura = new THREE.Group()
    for (let s = 0; s < 80; s++) {
      const z0 = -62 + s * 1.55
      const z1 = z0 + 1.55
      const y0 = altura(0, z0) + 0.3
      const y1 = altura(0, z1) + 0.3
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, Math.hypot(1.62, y1 - y0)), matCostura)
      seg.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2)
      seg.rotation.x = Math.atan2(y1 - y0, 1.55)
      costura.add(seg)
    }
    scene.add(costura)
    const brilhoFrente = new THREE.PointLight(0xffc98a, 12, 60, 1.6)
    brilhoFrente.position.set(0, 4, 0)
    scene.add(brilhoFrente)

    // ── exércitos ───────────────────────────────────────────────────────────
    const matCaes = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, emissive: 0x2a1503, emissiveIntensity: 0.5,
    })
    const matUrsos = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, emissive: 0x38110a, emissiveIntensity: 0.55,
    })
    const caes = new THREE.InstancedMesh(shibaGeometry(), matCaes, CAP)
    const ursos = new THREE.InstancedMesh(bearGeometry(), matUrsos, CAP)
    caes.count = 0
    ursos.count = 0
    scene.add(caes, ursos)

    // ── obeliscos de obsidiana: onde a frente esteve em 24h ─────────────────
    const obsidiana = new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.25, metalness: 0.1 })
    const fazObelisco = () => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), obsidiana)
      o.position.y = 4.5
      o.rotation.y = 0.4
      // obsidiana some no breu; a coroa acesa é o que marca o território
      const coroa = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.35, 1.75),
        new THREE.MeshBasicMaterial({ color: 0xffa050 }),
      )
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
      const tx = new THREE.CanvasTexture(cv)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }))
      sp.scale.set(22, 4.1, 1)
      return sp
    }
    let etLow: THREE.Sprite | null = null
    let etHigh: THREE.Sprite | null = null

    // ── projéteis e impactos ────────────────────────────────────────────────
    interface Tiro {
      mesh: THREE.Mesh
      de: THREE.Vector3
      para: THREE.Vector3
      t0: number
      dur: number
      forca: number
      lado: 'buy' | 'sell'
    }
    const tiros: Tiro[] = []
    interface Onda {
      mesh: THREE.Mesh
      luz: THREE.PointLight
      t0: number
      forca: number
    }
    const ondas: Onda[] = []
    const geoTiro = new THREE.SphereGeometry(1, 10, 10)
    const geoOnda = new THREE.RingGeometry(0.8, 1, 40)
    geoOnda.rotateX(-Math.PI / 2)

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

    const montaExercito = (
      mesh: THREE.InstancedMesh,
      niveis: BookLevel[],
      lado: 1 | -1, // -1 cães (bids, x negativo), +1 ursos (asks)
      qMediana: number,
    ) => {
      let i = 0
      for (let li = 0; li < niveis.length && i < CAP; li++) {
        const nv = niveis[li]
        const x0 = precoParaX(nv.price)
        const unidades = Math.min(96, Math.max(1, Math.round(6 * Math.sqrt(nv.qty / qMediana))))
        for (let u = 0; u < unidades && i < CAP; u++) {
          const fila = Math.floor(u / 12)
          const col = u % 12
          const jx = (hash(li * 31 + u, 7) - 0.5) * 0.7
          const jz = (hash(li * 17 + u, 13) - 0.5) * 0.9
          const px = x0 + lado * (fila * 1.5 + jx)
          const pz = (col - 5.5) * 1.45 + (fila % 2) * 0.7 + jz
          vp.set(px, altura(px, pz) + 0.05, pz)
          const esc = 0.9 + hash(li, u) * 0.25
          vs.set(esc, esc, esc)
          eu.set(0, (hash(u, li) - 0.5) * 0.35 + (lado === 1 ? 0 : 0), 0)
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
      const bids = book.bids.slice(0, NIVEIS)
      const asks = book.asks.slice(0, NIVEIS)
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

      // obeliscos e território de 24h
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
    const dispara = (t: WarTrade) => {
      const forca = Math.min(40, Math.max(0.4, emaQty > 0 ? t.qty / emaQty : 1))
      const r = 0.22 * Math.sqrt(forca) + 0.12
      const cor = t.side === 'buy' ? 0xffb35c : 0xff5940
      const mesh = new THREE.Mesh(geoTiro, new THREE.MeshBasicMaterial({ color: cor }))
      mesh.scale.setScalar(r)
      const zAlvo = (hash(t.at % 997, t.qty) - 0.5) * 90
      const lado = t.side === 'buy' ? 1 : -1 // compra acerta os ursos (x positivo)
      const de = new THREE.Vector3(-lado * (14 + hash(t.at % 31, 3) * 30), 1.2, zAlvo + (hash(t.at % 13, 5) - 0.5) * 30)
      const para = new THREE.Vector3(lado * (FRENTE + hash(t.at % 7, 11) * 6), 0.8, zAlvo)
      scene.add(mesh)
      tiros.push({ mesh, de, para, t0: performance.now(), dur: 750 + 350 * Math.min(3, forca / 8), forca, lado: t.side })
    }

    const impacto = (p: THREE.Vector3, forca: number, lado: 'buy' | 'sell') => {
      const cor = lado === 'buy' ? 0xffa64d : 0xff5238
      const mesh = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: cor, transparent: true, side: THREE.DoubleSide }))
      mesh.position.copy(p).setY(0.25)
      const luz = new THREE.PointLight(cor, 30 * Math.min(6, forca), 26, 1.8)
      luz.position.copy(p).setY(2.5)
      scene.add(mesh, luz)
      ondas.push({ mesh, luz, t0: performance.now(), forca })
    }

    // ── laço ────────────────────────────────────────────────────────────────
    let vivo = true
    let ultimoBook = 0
    let ultimoHud = 0
    const anima = (agora: number) => {
      if (!vivo) return
      requestAnimationFrame(anima)

      if (bookSujo && agora - ultimoBook > 250) {
        bookSujo = false
        ultimoBook = agora
        aplicaBook()
      }
      while (filaTrades.length) dispara(filaTrades.shift()!)

      for (let i = tiros.length - 1; i >= 0; i--) {
        const t = tiros[i]
        const f = (agora - t.t0) / t.dur
        if (f >= 1) {
          impacto(t.para, t.forca, t.lado)
          scene.remove(t.mesh)
          ;(t.mesh.material as THREE.Material).dispose()
          tiros.splice(i, 1)
          continue
        }
        t.mesh.position.lerpVectors(t.de, t.para, f)
        t.mesh.position.y = 1 + Math.sin(f * Math.PI) * (6 + Math.min(18, t.forca))
      }
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i]
        const f = (agora - o.t0) / 650
        if (f >= 1) {
          scene.remove(o.mesh, o.luz)
          ;(o.mesh.material as THREE.Material).dispose()
          ondas.splice(i, 1)
          continue
        }
        const raio = 1 + f * (3 + Math.sqrt(o.forca) * 2.2)
        o.mesh.scale.setScalar(raio)
        ;(o.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - f
        o.luz.intensity = 30 * Math.min(6, o.forca) * (1 - f)
      }

      matCostura.color.setHSL(0.09, 0.7, 0.72 + 0.1 * Math.sin(agora * 0.004))

      if (agora - ultimoHud > 500) {
        ultimoHud = agora
        setHud({
          preco: mid,
          delta24: open24 > 0 && mid > 0 ? (mid - open24) / open24 : 0,
          low24, high24, status, ursosCaidos, caesCaidos, compra, venda,
        })
      }

      controls.update()
      renderer.render(scene, camera)
    }
    requestAnimationFrame(anima)

    const aoRedimensionar = () => {
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', aoRedimensionar)

    return () => {
      vivo = false
      feed.stop()
      window.removeEventListener('resize', aoRedimensionar)
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

      {/* localização e fonte, canto de mapa */}
      <div className="absolute top-4 left-5 font-mono text-[10px] tracking-[0.22em] uppercase text-white/45 select-none">
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${vivoAgora ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        Kraken {vivoAgora ? 'live' : hud.status}
        <div className="mt-1 text-white/30">War Crater · 3 km SW of Central Plaza</div>
      </div>

      {/* o preço é a manchete */}
      <div className="absolute top-4 inset-x-0 text-center select-none pointer-events-none">
        <div className="font-mono text-3xl md:text-4xl text-white/95 tabular-nums">${fmtPreco(hud.preco)}</div>
        <div className="font-mono text-[11px] tracking-[0.2em] mt-1 text-white/40 uppercase">
          DOG / USD
          {hud.delta24 !== 0 && (
            <span className={hud.delta24 > 0 ? 'text-emerald-400/80 ml-3' : 'text-red-400/80 ml-3'}>
              {hud.delta24 > 0 ? '+' : ''}{(hud.delta24 * 100).toFixed(2)}% 24h
            </span>
          )}
        </div>
      </div>

      {/* pressão: quem empurra a frente */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72 select-none pointer-events-none">
        <div className="flex justify-between font-mono text-[10px] tracking-[0.18em] uppercase mb-1">
          <span className="text-[#f7931a]/85">Dogs {fmtDog(hud.compra)}</span>
          <span className="text-red-400/75">{fmtDog(hud.venda)} Bears</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden bg-white/10">
          <div className="h-full bg-gradient-to-r from-[#f7931a] to-[#c96a12]" style={{ width: `${fracaoCompra * 100}%` }} />
        </div>
      </div>

      {/* baixas do combate assistido */}
      <div className="absolute bottom-6 right-5 text-right font-mono text-[10px] tracking-[0.18em] uppercase text-white/40 select-none">
        <div>Bears fallen <span className="text-white/75">{fmtDog(hud.ursosCaidos)}</span></div>
        <div>Dogs fallen <span className="text-white/75">{fmtDog(hud.caesCaidos)}</span></div>
      </div>

      <div className="absolute bottom-6 left-5 font-mono text-[10px] tracking-[0.18em] uppercase text-white/25 select-none">
        drag to orbit · scroll to zoom
      </div>
    </div>
  )
}
