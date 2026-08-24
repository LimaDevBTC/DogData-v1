// A órbita: cada transação de DOG pendente é uma nave circulando sobre a praça;
// o bloco é a janela de pouso e as naves do bloco descem no spaceport, uma atrás
// da outra. Spec: praca-central.md §1 (metáfora D1, "órbita e pouso").
//
// Regras de leitura, escritas antes do código:
//   • taxa manda na ALTITUDE: quem paga a taxa rápida voa baixo (perto de pousar),
//     quem paga o mínimo voa alto. A ordem visível é a ordem econômica.
//   • quantia manda no TAMANHO da nave, em escala log: 10 mil DOG é uma cápsula,
//     100 milhões é um cargueiro. Nunca linear, senão uma tx grande esconde a praça.
//   • a nave é um FOGUETE de aço inox no desenho de uma Starship, com "$DOG" na
//     fuselagem (pedido do fundador: "estilo SpaceX, escrito $DOG"): ogiva, corpo
//     cilíndrico, quatro flaps, três motores, o lado do escudo térmico em preto.
//     Voa de nariz em órbita e vira em pé para pousar, como a de verdade.
//   • a nave que o visitante está seguindo ganha halo branco e maior.
//   • nada aqui decide estado. Entrar, pousar e cair chegam prontos do feed.
import * as THREE from 'three'
import { isDonation, type DogTx } from './feed'

export const ORBIT_CENTER = new THREE.Vector3(0, 0, 0)
/** O pad principal do spaceport, no quadro three (x, y, z) = (-140, ~77, 3090). */
export const PAD_MAIN = new THREE.Vector3(-140, 77.5, 3090)
/** Vagas de pouso em volta do pad principal, para um bloco com várias naves. */
const PAD_SPOTS: THREE.Vector3[] = [
  PAD_MAIN.clone(),
  new THREE.Vector3(-380, 23.5, 3300), // SP_Pad0
  new THREE.Vector3(-60, 77.5, 3160),
  new THREE.Vector3(-220, 77.5, 3160),
  new THREE.Vector3(-60, 77.5, 3020),
  new THREE.Vector3(-220, 77.5, 3020),
  new THREE.Vector3(-300, 60, 3120),
  new THREE.Vector3(20, 80, 3090),
]

const DOG_ORANGE = new THREE.Color('#F7931A')
// ⚠️ CAUDA VERMELHA É DOAÇÃO PARA A CIDADE (fundador, 2026-08-24). Vermelho
// porque é a única cor forte que a praça ainda não usa: laranja é o DOG, o verde
// está reservado para estado e o roxo foi banido por colidir com o azul. Quem
// olha a órbita e vê um rastro vermelho sabe, sem legenda, que alguém acabou de
// bancar um pedaço da cidade.
const DONATION_RED = new THREE.Color('#FF3B30')
const DOG_HOT = new THREE.Color('#FFB35C')
const FOLLOW_WHITE = new THREE.Color('#FFFFFF')
/** Nariz para cima: leva o +z do modelo ao +y do mundo. */
const UPRIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)

type Phase = 'orbit' | 'landing' | 'parked' | 'dropping'

interface Ship {
  tx: DogTx
  group: THREE.Group
  body: THREE.Mesh
  glow: THREE.Sprite
  hit: THREE.Mesh
  trail: THREE.Line
  trailPts: THREE.Vector3[]
  trailAt: number
  phase: Phase
  // órbita
  radius: number
  altitude: number
  omega: number
  phase0: number
  tilt: number
  // pouso / queda
  curve: THREE.CatmullRomCurve3 | null
  t0: number
  dur: number
  spot: THREE.Vector3 | null
  parkedAt: number
  followed: boolean
  size: number
  flightQ: THREE.Quaternion
}

export interface OrbitLayer {
  group: THREE.Group
  enter: (tx: DogTx, opts?: { silent?: boolean }) => void
  land: (tx: DogTx, opts?: { silent?: boolean }) => void
  drop: (tx: DogTx) => void
  /** Uma nave já pousada (na carga inicial), sem animação. */
  park: (tx: DogTx) => void
  update: (t: number, dt: number, fees: { fast: number | null; slow: number | null }) => void
  pick: (raycaster: THREE.Raycaster) => DogTx | null
  follow: (txid: string | null) => DogTx | null
  positionOf: (txid: string) => THREE.Vector3 | null
  count: () => { orbit: number; landing: number; parked: number }
  dispose: () => void
}

function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function sizeFor(dog: number): number {
  // 1e3 → 20 m · 1e5 → 32 m · 1e7 → 44 m · 1e9 → 56 m
  return THREE.MathUtils.clamp(2 + 6 * Math.log10(Math.max(1, dog)), 16, 60)
}

/** Altitude pela taxa, relativa à faixa rápida do momento: rápida ou acima → baixo,
 *  mínimo → alto. Sem cotação (feed frio) cai no meio. */
export function altitudeFor(feeRate: number | null, fast: number | null, slow: number | null): number {
  const lo = 330, hi = 760
  if (feeRate == null) return (lo + hi) / 2
  const f = fast ?? 3, s = slow ?? 1
  const span = Math.max(0.5, f - s)
  const k = THREE.MathUtils.clamp((feeRate - s) / span, 0, 1) // 0 = lento, 1 = rápido
  return hi - k * (hi - lo)
}

/** A pintura da nave: aço inox com juntas de painel, o lado do escudo térmico em
 *  preto, "$DOG" grande na fuselagem e a marca pequena. Uma textura, todas as naves. */
function makeLiveryTexture(): THREE.Texture {
  // O mapa UV do Lathe: u dá a volta (1024 px = 2π·0,09 = 0,565 do comprimento),
  // v anda com o ÍNDICE do ponto do perfil, e no corpo 1 v = 1,26 do comprimento
  // (512 px). Logo 1 unidade de comprimento vale 1811 px em volta e 406 px ao
  // longo, e todo texto escrito ao longo do eixo tem de ser encolhido por 0,224
  // no avanço para não esticar (a primeira versão virou faixas laranja).
  const W = 1024, H = 512
  const ALONG = 0.224
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  // aço
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#d9dce1'); g.addColorStop(0.5, '#c4c8ce'); g.addColorStop(1, '#d2d5da')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // juntas dos anéis e das chapas
  ctx.strokeStyle = 'rgba(70,74,82,0.35)'
  ctx.lineWidth = 2
  for (let i = 1; i < 12; i++) { const y = (i / 12) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  for (let i = 1; i < 16; i++) { const x = (i / 16) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  // v = 0 é a cauda e fica na BASE da imagem (flipY): a ogiva está no topo.
  // Escudo térmico: metade da circunferência centrada em u = 0 (o −y do modelo,
  // que em voo é a barriga e no pouso é o lado sul, de costas para a praça),
  // da cauda até quase a ponta. As bordas caem em u = 0,25 e 0,75, onde estão
  // os flaps (±x do modelo), como no Starship.
  ctx.fillStyle = '#17181c'
  ctx.fillRect(0, H * 0.08, W * 0.25, H * 0.92)
  ctx.fillRect(W * 0.75, H * 0.08, W * 0.25, H * 0.92)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (let i = 0; i < 26; i++) { const y = H * 0.08 + (i / 26) * H * 0.92; ctx.fillRect(0, y, W * 0.25, 1.5); ctx.fillRect(W * 0.75, y, W * 0.25, 1.5) }
  // "$DOG" ao longo do eixo, lendo da cauda para a ponta: no lado limpo (u = 0,5,
  // o +y do modelo: o céu em voo, o norte e a praça no pouso) em laranja sobre o
  // aço, e no escudo (u = 0) em laranja sobre o preto, para ler também de baixo.
  const word = (cx: number, cy: number, text: string, px: number, color: string) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-Math.PI / 2)
    ctx.scale(ALONG, 1)
    ctx.fillStyle = color
    ctx.font = `bold ${px}px "JetBrains Mono", "DM Sans", system-ui, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
  word(W * 0.5, H * 0.6, '$DOG', 300, '#F7931A')
  word(0, H * 0.6, '$DOG', 300, '#F7931A')
  word(W, H * 0.6, '$DOG', 300, '#F7931A') // a metade que sobra do escudo (u = 1)
  word(W * 0.5, H * 0.87, 'DOGCITY', 56, '#1a1a1e')
  // anel de aviso na saia dos motores
  ctx.fillStyle = '#F7931A'
  ctx.fillRect(0, H * 0.985, W, H * 0.015)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,220,170,0.85)')
  g.addColorStop(0.45, 'rgba(255,150,40,0.28)')
  g.addColorStop(1, 'rgba(255,120,20,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createOrbitLayer(): OrbitLayer {
  const group = new THREE.Group()
  group.name = 'OrbitLayer'
  const ships = new Map<string, Ship>()
  const glowTex = makeGlowTexture()

  // ── o foguete: uma geometria só (revolução), flaps, motores, e a pintura ──
  // Perfil ao longo de +z (0 = cauda, 1 = ponta), raio em unidades de comprimento;
  // proporções de Starship: 9 m de diâmetro para 50 m de altura → raio 0,09.
  const rocketGeo = (() => {
    const pts: THREE.Vector2[] = []
    const R = 0.09
    pts.push(new THREE.Vector2(0.0, 0.0))
    pts.push(new THREE.Vector2(R * 0.72, 0.0))     // a saia dos motores
    // o corpo em fatias: o v da textura anda com o índice do ponto, então o
    // corpo precisa de tantos pontos quanto a ogiva para a pintura não escorrer
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(R, 0.03 + (0.63 * i) / 10))
    for (let i = 1; i <= 8; i++) {                  // ogiva
      const t = i / 8
      pts.push(new THREE.Vector2(R * Math.cos((t * Math.PI) / 2) * (1 - 0.15 * t), 0.66 + 0.34 * t))
    }
    const g = new THREE.LatheGeometry(pts, 28)
    g.rotateX(Math.PI / 2) // o Lathe nasce em torno de +y; a nave voa em +z
    // UV: u em volta, v ao longo: é o que a pintura espera
    return g
  })()
  // flap: uma pá trapezoidal (raiz longa no casco, ponta recuada), 0,17 de
  // comprimento por 0,10 de envergadura, no plano x-z do modelo
  const flapGeo = (() => {
    const sh = new THREE.Shape()
    sh.moveTo(0, 0); sh.lineTo(0.10, 0.025); sh.lineTo(0.10, 0.11); sh.lineTo(0.03, 0.17); sh.lineTo(0, 0.17); sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false })
    g.rotateX(Math.PI / 2) // (x, y, z) → (x, −z, y): o comprimento cai em +z, a espessura em y
    return g
  })()
  const engineGeo = new THREE.ConeGeometry(0.02, 0.05, 10, 1, true)
  engineGeo.rotateX(-Math.PI / 2)
  const hitGeo = new THREE.SphereGeometry(1, 8, 8)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  const livery = makeLiveryTexture()
  const steelMat = (hot: boolean) =>
    new THREE.MeshStandardMaterial({
      map: livery, color: 0xffffff, metalness: 0.88, roughness: 0.3, envMapIntensity: 1.2,
      // a emissão segue a pintura (o "$DOG" continua lendo na sombra; o escudo fica preto)
      emissive: hot ? DOG_HOT : 0xffffff, emissiveMap: livery, emissiveIntensity: hot ? 0.3 : 0.14,
    })
  const flapMat = new THREE.MeshStandardMaterial({ color: 0x8b8f96, metalness: 0.9, roughness: 0.35 })
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x35373c, metalness: 0.9, roughness: 0.4, side: THREE.DoubleSide })

  let landingQueueAt = 0 // carimbo do último pouso agendado, para escalonar
  let spotIndex = 0
  let followedId: string | null = null

  const makeShip = (tx: DogTx): Ship => {
    const size = sizeFor(tx.dog_in)
    const g = new THREE.Group()
    g.name = `ship:${tx.txid}`
    const hot = tx.dog_in >= 10_000_000
    // o modelo mede 1 de comprimento em +z, cauda em z = 0; escala pelo tamanho
    const model = new THREE.Group()
    const body = new THREE.Mesh(rocketGeo, steelMat(hot))
    body.castShadow = true
    model.add(body)
    // flaps: dois traseiros grandes, dois dianteiros menores, nos lados ±x
    for (const [z, sc, sx] of [[0.04, 1, -1], [0.04, 1, 1], [0.7, 0.62, -1], [0.7, 0.62, 1]] as const) {
      const f = new THREE.Mesh(flapGeo, flapMat)
      f.scale.set(sx * sc, sc, sc) // o lado −x é o espelho
      f.position.set(sx * 0.085, 0.004 * sc, z)
      f.castShadow = true
      model.add(f)
    }
    // três motores na saia
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6
      const e = new THREE.Mesh(engineGeo, engineMat)
      e.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, -0.02)
      model.add(e)
    }
    model.scale.setScalar(size)
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }),
    )
    glow.scale.setScalar(size * 1.9)
    glow.position.z = -0.14 * size // a chama, atrás da saia
    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.scale.setScalar(size * 0.9)
    hit.position.z = 0.5 * size
    hit.userData.txid = tx.txid
    g.add(model, glow, hit)
    const trailPts = Array.from({ length: 24 }, () => new THREE.Vector3())
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts)
    const trailCol = new Float32Array(24 * 3)
    const tint = isDonation(tx) ? DONATION_RED : DOG_ORANGE
    for (let i = 0; i < 24; i++) {
      const a = 1 - i / 24
      trailCol[i * 3] = tint.r * a
      trailCol[i * 3 + 1] = tint.g * a
      trailCol[i * 3 + 2] = tint.b * a
    }
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    trail.frustumCulled = false
    group.add(g, trail)
    return {
      tx, group: g, body, glow, hit, trail, trailPts, trailAt: 0,
      phase: 'orbit',
      radius: 780 + hash01(tx.txid, 1) * 340,
      altitude: 700,
      omega: (Math.PI * 2) / (70 + hash01(tx.txid, 2) * 40),
      phase0: hash01(tx.txid, 3) * Math.PI * 2,
      tilt: (hash01(tx.txid, 4) - 0.5) * 0.28,
      curve: null, t0: 0, dur: 0, spot: null, parkedAt: 0,
      followed: false, size, flightQ: new THREE.Quaternion(),
    }
  }

  const orbitPos = (s: Ship, t: number, out: THREE.Vector3): THREE.Vector3 => {
    const a = s.phase0 + s.omega * t
    const x = Math.cos(a) * s.radius
    const z = Math.sin(a) * s.radius
    // inclinação leve: a órbita sobe de um lado e desce do outro
    const y = s.altitude + Math.sin(a) * s.radius * Math.sin(s.tilt) * 0.35 + Math.sin(t * 0.7 + s.phase0) * 6
    return out.set(x, y, z)
  }

  const setPhase = (s: Ship, p: Phase) => { s.phase = p }

  const nextSpot = (): THREE.Vector3 => {
    const spot = PAD_SPOTS[spotIndex % PAD_SPOTS.length]
    spotIndex++
    return spot.clone()
  }

  const remove = (s: Ship) => {
    group.remove(s.group, s.trail)
    s.trail.geometry.dispose()
    ;(s.trail.material as THREE.Material).dispose()
    ;(s.body.material as THREE.Material).dispose()
    ;(s.glow.material as THREE.Material).dispose()
    ships.delete(s.tx.txid)
  }

  const applyFollow = (s: Ship) => {
    const m = s.body.material as THREE.MeshStandardMaterial
    if (s.followed) {
      m.emissive.copy(FOLLOW_WHITE)
      m.emissiveIntensity = 0.45
      ;(s.glow.material as THREE.SpriteMaterial).color.set(0xffffff)
      s.glow.scale.setScalar(s.size * 3.4)
    } else {
      const hot = s.tx.dog_in >= 10_000_000
      m.emissive.copy(hot ? DOG_HOT : FOLLOW_WHITE)
      m.emissiveIntensity = hot ? 0.3 : 0.14
      ;(s.glow.material as THREE.SpriteMaterial).color.set(0xffffff)
      s.glow.scale.setScalar(s.size * 1.9)
    }
  }

  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  let clock = 0

  const api: OrbitLayer = {
    group,
    enter(tx, opts) {
      if (ships.has(tx.txid)) return
      const s = makeShip(tx)
      ships.set(tx.txid, s)
      s.followed = followedId === tx.txid
      applyFollow(s)
      if (!opts?.silent) {
        // chega de fora: começa mais alto e mais longe e converge para a órbita
        s.altitude += 400
        s.radius += 900
      }
      orbitPos(s, clock, tmp)
      s.group.position.copy(tmp)
      for (const p of s.trailPts) p.copy(tmp)
    },
    park(tx) {
      if (ships.has(tx.txid)) return
      const s = makeShip(tx)
      ships.set(tx.txid, s)
      s.followed = followedId === tx.txid
      applyFollow(s)
      setPhase(s, 'parked')
      s.spot = nextSpot()
      s.parkedAt = clock
      s.group.position.copy(s.spot)
      s.group.quaternion.copy(UPRIGHT)
      for (const p of s.trailPts) p.copy(s.group.position)
      ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.35
    },
    land(tx, opts) {
      let s = ships.get(tx.txid)
      if (!s) {
        // nunca esteve em órbita para a cena (chegou direto no bloco): entra e pousa
        api.enter(tx, { silent: true })
        s = ships.get(tx.txid)!
      }
      s.tx = tx
      if (s.phase === 'parked') return
      const spot = nextSpot()
      const p0 = s.group.position.clone()
      // continua um trecho na tangente, mergulha para o eixo do pad e desce
      const ahead = orbitPos(s, clock + 6, tmp).clone()
      ahead.y = p0.y - 60
      const above = spot.clone().add(tmp2.set(0, 420, 0))
      const low = spot.clone().add(tmp2.set(0, 70, 0))
      const down = spot.clone()
      s.curve = new THREE.CatmullRomCurve3([p0, ahead, above, low, down], false, 'catmullrom', 0.5)
      // escalona: um pouso a cada 3,5 s dentro do mesmo bloco
      const start = Math.max(clock, landingQueueAt + 3.5)
      landingQueueAt = start
      s.t0 = opts?.silent ? clock - 100 : start
      s.dur = 16
      s.spot = down
      setPhase(s, 'landing')
    },
    drop(tx) {
      const s = ships.get(tx.txid)
      if (!s || s.phase !== 'orbit') return
      const p0 = s.group.position.clone()
      const away = orbitPos(s, clock + 10, tmp).clone().multiplyScalar(2.2)
      away.y = p0.y + 900
      s.curve = new THREE.CatmullRomCurve3([p0, orbitPos(s, clock + 4, tmp2).clone(), away], false, 'catmullrom', 0.5)
      s.t0 = clock
      s.dur = 7
      setPhase(s, 'dropping')
    },
    update(t, dt, fees) {
      clock = t
      for (const s of Array.from(ships.values())) {
        if (s.phase === 'orbit') {
          // altitude e raio convergem para o alvo (novas chegam de longe)
          const target = altitudeFor(s.tx.fee_rate, fees.fast, fees.slow)
          s.altitude += (target - s.altitude) * Math.min(1, dt * 0.35)
          const rTarget = 780 + hash01(s.tx.txid, 1) * 340
          s.radius += (rTarget - s.radius) * Math.min(1, dt * 0.35)
          orbitPos(s, t, tmp)
          const prev = s.group.position.clone()
          s.group.position.copy(tmp)
          tmp2.copy(tmp).sub(prev)
          if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
        } else if (s.phase === 'landing' && s.curve) {
          const u = THREE.MathUtils.clamp((t - s.t0) / s.dur, 0, 1)
          if (u <= 0) {
            orbitPos(s, t, tmp)
            const prev = s.group.position.clone()
            s.group.position.copy(tmp)
            tmp2.copy(tmp).sub(prev)
            if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
            // a curva parte de onde a nave estiver quando a vez dela chegar
            const pts = s.curve.points
            pts[0].copy(tmp)
            s.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
          } else {
            const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2 // ease in-out
            s.curve.getPointAt(e, tmp)
            const prev = s.group.position.clone()
            s.group.position.copy(tmp)
            tmp2.copy(tmp).sub(prev)
            // voa de nariz até 65% do caminho; daí vira em pé (nariz para cima),
            // como uma Starship no flip final, e desce vertical até a cauda tocar
            if (u < 0.65) {
              if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
              s.flightQ.copy(s.group.quaternion)
            } else {
              const k = THREE.MathUtils.smoothstep(u, 0.65, 0.9)
              s.group.quaternion.slerpQuaternions(s.flightQ, UPRIGHT, k)
            }
            ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.95 - 0.5 * Math.max(0, u - 0.8) / 0.2
            if (u >= 1) {
              setPhase(s, 'parked')
              s.parkedAt = t
              s.curve = null
              s.group.quaternion.copy(UPRIGHT)
              ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.2
            }
          }
        } else if (s.phase === 'dropping' && s.curve) {
          const u = THREE.MathUtils.clamp((t - s.t0) / s.dur, 0, 1)
          s.curve.getPointAt(u, tmp)
          const prev = s.group.position.clone()
          s.group.position.copy(tmp)
          tmp2.copy(tmp).sub(prev)
          if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
          const fade = 1 - u
          ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.95 * fade
          ;(s.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 * fade
          ;(s.trail.material as THREE.LineBasicMaterial).opacity = 0.55 * fade
          if (u >= 1) { remove(s); continue }
        } else if (s.phase === 'parked') {
          // fica no pátio por dez minutos e taxia para o hangar (some)
          if (t - s.parkedAt > 600) { remove(s); continue }
          const gm = s.glow.material as THREE.SpriteMaterial
          gm.opacity = 0.3 + 0.08 * Math.sin(t * 2 + s.phase0)
        }
        // rastro: só quando voa, amostrado no TEMPO (60 ms) e não por quadro, para o
        // comprimento não depender do frame rate: 24 amostras = 1,4 s de rastro.
        if (s.phase === 'orbit' || s.phase === 'landing' || s.phase === 'dropping') {
          if (t - s.trailAt >= 0.06) {
            const pts = s.trailPts
            // um salto grande (quadro lento, entrada de longe) zera o rastro em vez
            // de riscar uma corda no céu
            if (pts[0].distanceTo(s.group.position) > 260) for (const p of pts) p.copy(s.group.position)
            for (let i = pts.length - 1; i > 0; i--) pts[i].copy(pts[i - 1])
            pts[0].copy(s.group.position)
            s.trail.geometry.setFromPoints(pts)
            s.trailAt = t
          }
          s.trail.visible = true
        } else {
          s.trail.visible = false
        }
      }
    },
    pick(raycaster) {
      const hits: THREE.Mesh[] = []
      for (const s of Array.from(ships.values())) hits.push(s.hit)
      const found = raycaster.intersectObjects(hits, false)
      if (!found.length) return null
      const txid = found[0].object.userData.txid as string
      return ships.get(txid)?.tx ?? null
    },
    follow(txid) {
      followedId = txid
      let found: DogTx | null = null
      for (const s of Array.from(ships.values())) {
        s.followed = s.tx.txid === txid
        applyFollow(s)
        if (s.followed) found = s.tx
      }
      return found
    },
    positionOf(txid) {
      const s = ships.get(txid)
      return s ? s.group.position.clone() : null
    },
    count() {
      let orbit = 0, landing = 0, parked = 0
      for (const s of Array.from(ships.values())) {
        if (s.phase === 'orbit') orbit++
        else if (s.phase === 'landing') landing++
        else if (s.phase === 'parked') parked++
      }
      return { orbit, landing, parked }
    },
    dispose() {
      for (const s of Array.from(ships.values())) remove(s)
      rocketGeo.dispose(); flapGeo.dispose(); engineGeo.dispose(); hitGeo.dispose(); glowTex.dispose(); hitMat.dispose(); livery.dispose(); flapMat.dispose(); engineMat.dispose()
    },
  }
  return api
}
