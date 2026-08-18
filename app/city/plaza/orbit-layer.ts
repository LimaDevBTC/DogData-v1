// A órbita: cada transação de DOG pendente é uma nave circulando sobre a praça;
// o bloco é a janela de pouso e as naves do bloco descem no spaceport, uma atrás
// da outra. Spec: praca-central.md §1 (metáfora D1, "órbita e pouso").
//
// Regras de leitura, escritas antes do código:
//   • taxa manda na ALTITUDE: quem paga a taxa rápida voa baixo (perto de pousar),
//     quem paga o mínimo voa alto. A ordem visível é a ordem econômica.
//   • quantia manda no TAMANHO da nave, em escala log: 10 mil DOG é uma cápsula,
//     100 milhões é um cargueiro. Nunca linear, senão uma tx grande esconde a praça.
//   • toda nave é laranja DOG; a que o visitante está seguindo fica branca e maior.
//   • nada aqui decide estado. Entrar, pousar e cair chegam prontos do feed.
import * as THREE from 'three'
import type { DogTx } from './feed'

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
const DOG_HOT = new THREE.Color('#FFB35C')
const FOLLOW_WHITE = new THREE.Color('#FFFFFF')

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

  // Um casco só, compartilhado: cápsula com nariz. Escala por nave.
  const bodyGeo = (() => {
    const g = new THREE.CapsuleGeometry(0.22, 0.9, 6, 12)
    g.rotateZ(Math.PI / 2) // deitada no eixo x = frente
    return g
  })()
  const finGeo = new THREE.BoxGeometry(0.5, 0.05, 1.1)
  const bandGeo = (() => {
    const g = new THREE.TorusGeometry(0.235, 0.025, 6, 24)
    g.rotateY(Math.PI / 2)
    return g
  })()
  const hitGeo = new THREE.SphereGeometry(1, 8, 8)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })

  let landingQueueAt = 0 // carimbo do último pouso agendado, para escalonar
  let spotIndex = 0
  let followedId: string | null = null

  // Casco escuro e metálico; o laranja vem do motor (o sprite) e de uma faixa fina
  // de janelas. Uma cápsula inteira laranja lia como dirigível, e não como nave.
  const bodyMatFor = (hot: boolean) =>
    new THREE.MeshStandardMaterial({
      color: 0x24262c,
      roughness: 0.32,
      metalness: 0.85,
      emissive: hot ? DOG_HOT : DOG_ORANGE,
      emissiveIntensity: 0.18,
    })

  const makeShip = (tx: DogTx): Ship => {
    const size = sizeFor(tx.dog_in)
    const g = new THREE.Group()
    g.name = `ship:${tx.txid}`
    const hot = tx.dog_in >= 10_000_000
    const body = new THREE.Mesh(bodyGeo, bodyMatFor(hot))
    body.scale.setScalar(size)
    body.castShadow = false
    const fins = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.5, metalness: 0.6 }))
    fins.scale.setScalar(size)
    fins.position.x = -0.35 * size
    const band = new THREE.Mesh(
      bandGeo,
      new THREE.MeshBasicMaterial({ color: hot ? DOG_HOT : DOG_ORANGE, toneMapped: false }),
    )
    band.scale.setScalar(size)
    band.position.x = 0.12 * size
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }),
    )
    glow.scale.setScalar(size * 3.2)
    glow.position.x = -0.6 * size
    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.scale.setScalar(size * 1.4)
    hit.userData.txid = tx.txid
    const trailPts = Array.from({ length: 24 }, () => new THREE.Vector3())
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts)
    const trailCol = new Float32Array(24 * 3)
    for (let i = 0; i < 24; i++) {
      const a = 1 - i / 24
      trailCol[i * 3] = DOG_ORANGE.r * a
      trailCol[i * 3 + 1] = DOG_ORANGE.g * a
      trailCol[i * 3 + 2] = DOG_ORANGE.b * a
    }
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    trail.frustumCulled = false
    g.add(body, fins, band, glow, hit)
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
      followed: false, size,
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
      m.emissiveIntensity = 1.6
      ;(s.glow.material as THREE.SpriteMaterial).color.set(0xffffff)
      s.glow.scale.setScalar(s.size * 5)
    } else {
      m.emissive.copy(s.tx.dog_in >= 10_000_000 ? DOG_HOT : DOG_ORANGE)
      m.emissiveIntensity = 0.9
      ;(s.glow.material as THREE.SpriteMaterial).color.set(0xffffff)
      s.glow.scale.setScalar(s.size * 3.2)
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
      s.group.position.copy(s.spot).add(tmp.set(0, s.size * 0.25, 0))
      s.group.rotation.set(0, hash01(tx.txid, 5) * Math.PI * 2, 0)
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
      const down = spot.clone().add(tmp2.set(0, s.size * 0.25, 0))
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
            if (u < 0.85 && tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
            else s.group.rotation.x *= 0.9 // endireita para pousar
            ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.95 - 0.5 * Math.max(0, u - 0.8) / 0.2
            if (u >= 1) {
              setPhase(s, 'parked')
              s.parkedAt = t
              s.curve = null
              ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.35
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
      bodyGeo.dispose(); finGeo.dispose(); bandGeo.dispose(); hitGeo.dispose(); glowTex.dispose(); hitMat.dispose()
    },
  }
  return api
}
