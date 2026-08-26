// A BIBLIOTECA DE LINGUAGENS DE EXPLOSAO.
//
// ATENCAO DE PRODUTO: hoje todo tiro na guerra estoura igual (a mesma bola
// de fogo generica pra obus, foguete, canhao e bomba). Este modulo existe
// pra dar a CADA ARMA a sua propria assinatura visual, do jeito que
// bitcoin-warfront.vercel.app faz: obus levanta chao, incendiaria deixa
// fogo residual, MLRS estoura seco em rajada curta, bomba aerea e a unica
// que pode ser gorda. Cada funcao aqui e uma linguagem, nao uma variacao
// de escala da mesma explosao.
//
// ⚠️ MODULO AUTONOMO: nenhuma dependencia deste repositorio alem de three e
// BufferGeometryUtils (nao usado aqui, mas a regra do caller vale igual).
// Quem instancia injeta o group de destino e o helper semRaycast (o mesmo
// truque de tanks.ts/battlefield.ts: efeito visual nao precisa participar
// de raycast, e a praca faz raycast recursivo na cena inteira).
//
// ⚠️ ZERO ALOCACAO POR EVENTO: todo mundo (sprite, mesh, textura, buffer)
// nasce uma unica vez na fabrica, dimensionado por tier (`low` corta pela
// metade). Disparar um efeito so MUTA objetos que ja existem (position.set,
// scale.setScalar, quaternion.setFromUnitVectors sobre o quaternion que o
// proprio objeto ja tem). O unico lugar que guarda estado entre frames sem
// pool de Object3D e a fila de sub-estouros do cluster, e mesmo essa fila e
// um vetor fixo de slots reciclados, nunca um array que cresce.
//
// ⚠️ NADA DE PointLight AQUI: toda iluminacao e ilusao (sprite aditivo,
// clarao no chao). O orcamento de luzes da cena e do anfitriao (battlefield
// ja usa o teto). Nenhum ShaderMaterial tambem: sprites + MeshBasicMaterial
// bastam pra tudo que este modulo precisa encenar.
import * as THREE from 'three'

export type LadoExplosao = 'buy' | 'sell'

export interface DepsExplosoes {
  group: THREE.Group
  /** desliga o raycast do objeto (efeito visual nao precisa ser clicavel) */
  semRaycast: (m: THREE.Object3D) => void
  /** tier reduzido: todo pool nasce pela metade */
  low: boolean
}

export interface ExplosionLibrary {
  /** assinatura de OBUS: flash branco curto + leque de terra + anel de poeira baixo. Sem bola de fogo. */
  fontanaDeTerra: (p: THREE.Vector3, forca: number) => void
  /** bola de fogo branco->laranja + 2-3 chamas residuais no chao + fumaca preta subindo */
  incendiaria: (p: THREE.Vector3, forca: number) => void
  /** assinatura de MLRS: 3 estouros brancos-quentes secos em 60ms, faiscas retas */
  clusterQuente: (p: THREE.Vector3, forca: number) => void
  /** a grande: flash largo + coluna de fogo alta + anel de choque duplo + terra em leque */
  bombaAerea: (p: THREE.Vector3, forca: number) => void
  /** assinatura de CANHAO ATIRANDO de perto: cone de fogo na direcao do cano + anel de fumaca na boca */
  claraoDeBoca: (pos: THREE.Vector3, dir: THREE.Vector3, forca: number) => void
  /** caveirinha pixel-art que sobe e some: marcador de baixa */
  caveira: (p: THREE.Vector3, lado: LadoExplosao) => void
  /** assinatura de LANCA-CHAMAS: rajada dirigida de ~700ms, linguas de fogo que nascem na boca e avancam ao longo de dir, do branco-amarelo perto da boca ao laranja escuro na ponta, com 1-2 chamas residuais curtas no chao do alcance final */
  jatoDeChamas: (pos: THREE.Vector3, dir: THREE.Vector3, forca: number) => void
  /** assinatura de FLAK: estouro antiaereo no ceu, flash pequeno laranja + nuvenzinha escura que incha e some em ~1.4s, sem anel de chao e sem terra */
  flak: (p: THREE.Vector3, forca: number) => void
  /** anima todos os pools num unico passo; `agora` = performance.now() do chamador */
  update: (agora: number, dt: number) => void
  dispose: () => void
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function createExplosionLibrary(deps: DepsExplosoes): ExplosionLibrary {
  const { group, semRaycast, low } = deps
  // pools inteiros: low corta pela metade, sempre pelo menos 1
  const t = (n: number) => (low ? Math.max(1, Math.round(n * 0.5)) : n)

  // tudo que este modulo cria mora aqui, pra dispose() nao precisar varrer
  // o `group` inteiro (que e do anfitriao e pode ter outros sistemas dentro)
  const objetos: THREE.Object3D[] = []
  const add = <T extends THREE.Object3D>(o: T): T => {
    o.visible = false
    semRaycast(o)
    group.add(o)
    objetos.push(o)
    return o
  }

  // ── vetores de trabalho reaproveitados: nenhuma orientacao aloca Vector3
  // ou Quaternion novo, so muta o que o objeto pooled ja possui ───────────
  const EIXO_X = new THREE.Vector3(1, 0, 0)
  const EIXO_Z = new THREE.Vector3(0, 0, 1)
  const _dir = new THREE.Vector3()

  const CORES_REGOLITO = [0x4a4038, 0x5f5142, 0x372f28, 0x6b5a42, 0x453b30]

  // ═══════════════════════════════════════════════════════════════════════
  // TEXTURAS (canvas, uma vez cada)
  // ═══════════════════════════════════════════════════════════════════════

  // clarao curto: disco branco que estoura e some
  const texFlash = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(cv)
  })()

  // bola de fogo: nucleo branco, meio laranja, borda dissolve
  const texFogo = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(255,220,150,0.95)')
    g.addColorStop(0.45, 'rgba(255,130,40,0.8)')
    g.addColorStop(0.72, 'rgba(120,45,20,0.35)')
    g.addColorStop(1, 'rgba(40,20,15,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(cv)
  })()

  // fumaca escura: blob suave, sem aditivo (le como fumaca, nao como luz)
  const texFumaca = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 96
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(48, 48, 0, 48, 48, 48)
    g.addColorStop(0, 'rgba(22,19,16,0.85)')
    g.addColorStop(0.5, 'rgba(22,19,16,0.5)')
    g.addColorStop(1, 'rgba(22,19,16,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 96, 96)
    return new THREE.CanvasTexture(cv)
  })()

  // anel: rosca de luz, usada achatada no chao (poeira, choque) e de pe na
  // boca do canhao (fumaca de disparo), sempre num plano simples com UV
  const texAnel = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 96
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(48, 48, 0, 48, 48, 48)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.55, 'rgba(255,255,255,0)')
    g.addColorStop(0.68, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.82, 'rgba(255,255,255,0.32)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 96, 96)
    return new THREE.CanvasTexture(cv)
  })()

  // chama: gota alongada, pro fogo residual que fica queimando no chao
  const texChama = (() => {
    const cv = document.createElement('canvas')
    cv.width = 48
    cv.height = 64
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(24, 44, 2, 24, 30, 30)
    g.addColorStop(0, 'rgba(255,244,200,0.95)')
    g.addColorStop(0.35, 'rgba(255,170,60,0.85)')
    g.addColorStop(0.75, 'rgba(200,60,20,0.45)')
    g.addColorStop(1, 'rgba(120,20,10,0)')
    cx.fillStyle = g
    cx.beginPath()
    cx.moveTo(24, 2)
    cx.quadraticCurveTo(44, 34, 24, 62)
    cx.quadraticCurveTo(4, 34, 24, 2)
    cx.closePath()
    cx.fill()
    return new THREE.CanvasTexture(cv)
  })()

  // caveirinha pixel-art: 12x12 celulas espelhadas em 2x2px = canvas 24x24.
  // desenhada so com fillRect, sem imageSmoothingEnabled, filtro nearest no
  // fim pra ficar bloco de verdade em vez de borrada.
  const texCaveira = (() => {
    const cv = document.createElement('canvas')
    cv.width = 24
    cv.height = 24
    const cx = cv.getContext('2d')!
    cx.imageSmoothingEnabled = false
    const meio: number[][] = [
      [0, 0, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1],
      [0, 0, 0, 1, 1, 1],
      [0, 0, 0, 0, 0, 0],
    ]
    cx.fillStyle = '#f4f1ea'
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 6; col++) {
        if (!meio[row][col]) continue
        cx.fillRect(col * 2, row * 2, 2, 2)
        cx.fillRect((11 - col) * 2, row * 2, 2, 2)
      }
    }
    cx.fillStyle = '#241d1a'
    cx.fillRect(2 * 2, 3 * 2, 2 * 2, 2 * 2)
    cx.fillRect(8 * 2, 3 * 2, 2 * 2, 2 * 2)
    cx.fillRect(5 * 2, 6 * 2, 2, 2)
    cx.fillRect(6 * 2, 6 * 2, 2, 2)
    cx.fillRect(3 * 2, 9 * 2, 1, 2)
    cx.fillRect(5 * 2, 9 * 2, 1, 2)
    cx.fillRect(7 * 2, 9 * 2, 1, 2)
    cx.fillRect(9 * 2, 9 * 2, 1, 2)
    const tx = new THREE.CanvasTexture(cv)
    tx.magFilter = THREE.NearestFilter
    tx.minFilter = THREE.NearestFilter
    tx.needsUpdate = true
    return tx
  })()

  // ═══════════════════════════════════════════════════════════════════════
  // GEOMETRIAS (uma vez cada, compartilhadas por pool inteiro)
  // ═══════════════════════════════════════════════════════════════════════

  const geoFrag = new THREE.BoxGeometry(0.16, 0.18, 0.16)

  // cone da boca: apice no eixo local +X, base (culatra) na origem. quem usa
  // orienta o mesh inteiro via quaternion.setFromUnitVectors(EIXO_X, dir).
  const geoConeBoca = new THREE.ConeGeometry(0.32, 1.15, 8)
  geoConeBoca.rotateZ(-Math.PI / 2)
  geoConeBoca.translate(0.575, 0, 0)

  // planos simples com UV 0..1: a forma de anel vem da textura (texAnel),
  // nao da geometria, entao chao e boca reaproveitam o mesmo desenho
  const geoAnelChao = new THREE.PlaneGeometry(2, 2)
  geoAnelChao.rotateX(-Math.PI / 2)
  const geoAnelBoca = new THREE.PlaneGeometry(2, 2)

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: FLASH curto (obus, MLRS seco, boca de canhao)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_FLASH = t(18)
  interface FlashInst { sp: THREE.Sprite; t0: number; dur: number }
  const flashes: FlashInst[] = []
  for (let i = 0; i < CAP_FLASH; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texFlash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    })))
    flashes.push({ sp, t0: 0, dur: 120 })
  }
  let curFlash = 0
  const dispararFlash = (x: number, y: number, z: number, base: number, cor: number, dur: number) => {
    const f = flashes[curFlash]
    curFlash = (curFlash + 1) % CAP_FLASH
    f.sp.position.set(x, y, z)
    f.sp.scale.setScalar(base)
    ;(f.sp.material as THREE.SpriteMaterial).color.setHex(cor)
    ;(f.sp.material as THREE.SpriteMaterial).opacity = 1
    f.sp.visible = true
    f.t0 = performance.now()
    f.dur = dur
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: BOLA DE FOGO (incendiaria)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_FOGO = t(10)
  interface FogoInst { sp: THREE.Sprite; t0: number; dur: number; base: number }
  const fogos: FogoInst[] = []
  for (let i = 0; i < CAP_FOGO; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texFogo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    })))
    fogos.push({ sp, t0: 0, dur: 700, base: 2 })
  }
  let curFogo = 0
  const dispararFogo = (x: number, y: number, z: number, base: number, dur: number, cor: number) => {
    const b = fogos[curFogo]
    curFogo = (curFogo + 1) % CAP_FOGO
    b.sp.position.set(x, y, z)
    ;(b.sp.material as THREE.SpriteMaterial).color.setHex(cor)
    ;(b.sp.material as THREE.SpriteMaterial).opacity = 1
    b.sp.scale.setScalar(base * 0.35)
    b.sp.visible = true
    b.t0 = performance.now()
    b.dur = dur
    b.base = base
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: COLUNA DE FOGO (bombaAerea)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_COLUNA = t(4)
  interface ColunaInst { sp: THREE.Sprite; t0: number; dur: number; larg: number; alt: number; y0: number }
  const colunas: ColunaInst[] = []
  for (let i = 0; i < CAP_COLUNA; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texFogo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    })))
    colunas.push({ sp, t0: 0, dur: 1100, larg: 1.4, alt: 5.5, y0: 0 })
  }
  let curColuna = 0
  const dispararColuna = (x: number, y: number, z: number, alt: number, larg: number, dur: number) => {
    const c = colunas[curColuna]
    curColuna = (curColuna + 1) % CAP_COLUNA
    c.sp.position.set(x, y, z)
    ;(c.sp.material as THREE.SpriteMaterial).opacity = 1
    c.sp.visible = true
    c.t0 = performance.now()
    c.dur = dur
    c.alt = alt
    c.larg = larg
    c.y0 = y
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: CHAMA RESIDUAL (fica queimando no chao depois da incendiaria)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_CHAMA = t(18)
  interface ChamaInst { sp: THREE.Sprite; t0: number; dur: number; seed: number; base: number }
  const chamas: ChamaInst[] = []
  for (let i = 0; i < CAP_CHAMA; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texChama, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    })))
    chamas.push({ sp, t0: 0, dur: 4000, seed: 0, base: 1 })
  }
  let curChama = 0
  const dispararChama = (x: number, y: number, z: number, dur: number) => {
    const c = chamas[curChama]
    curChama = (curChama + 1) % CAP_CHAMA
    c.sp.position.set(x, y + 0.55, z)
    c.sp.scale.setScalar(1.1)
    ;(c.sp.material as THREE.SpriteMaterial).opacity = 0.85
    c.sp.visible = true
    c.t0 = performance.now()
    c.dur = dur
    c.seed = hash(x, z + curChama)
    c.base = 0.9 + hash(z, x + curChama) * 0.5
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: FUMACA PRETA (sobe da incendiaria e da bomba aerea)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_FUMACA = t(10)
  interface FumacaInst { sp: THREE.Sprite; t0: number; dur: number; y0: number; base: number; jit: number }
  const fumacas: FumacaInst[] = []
  for (let i = 0; i < CAP_FUMACA; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texFumaca, transparent: true, depthWrite: false, opacity: 0,
    })))
    fumacas.push({ sp, t0: 0, dur: 2500, y0: 0, base: 2, jit: 0 })
  }
  let curFumaca = 0
  const dispararFumacaPreta = (x: number, y: number, z: number, base: number, dur: number) => {
    const s = fumacas[curFumaca]
    curFumaca = (curFumaca + 1) % CAP_FUMACA
    s.sp.position.set(x, y, z)
    s.sp.scale.setScalar(base * 0.5)
    ;(s.sp.material as THREE.SpriteMaterial).opacity = 0
    s.sp.visible = true
    s.t0 = performance.now()
    s.dur = dur
    s.y0 = y
    s.base = base
    s.jit = hash(x, z + curFumaca) - 0.5
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: ANEL DE CHAO (poeira baixa da fontana + choque duplo da bomba)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_ANEL_CHAO = t(14)
  interface AnelChaoInst { mesh: THREE.Mesh; t0: number; dur: number; alvo: number; opacBase: number }
  const aneisChao: AnelChaoInst[] = []
  for (let i = 0; i < CAP_ANEL_CHAO; i++) {
    const mesh = add(new THREE.Mesh(geoAnelChao, new THREE.MeshBasicMaterial({
      map: texAnel, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
    })))
    aneisChao.push({ mesh, t0: 0, dur: 500, alvo: 3, opacBase: 0.5 })
  }
  let curAnelChao = 0
  const dispararAnelChao = (x: number, y: number, z: number, alvo: number, dur: number, cor: number, opacBase: number) => {
    const a = aneisChao[curAnelChao]
    curAnelChao = (curAnelChao + 1) % CAP_ANEL_CHAO
    a.mesh.position.set(x, y + 0.04, z)
    a.mesh.rotation.y = hash(x, z + curAnelChao) * Math.PI * 2
    a.mesh.scale.set(0.3, 1, 0.3)
    ;(a.mesh.material as THREE.MeshBasicMaterial).color.setHex(cor)
    ;(a.mesh.material as THREE.MeshBasicMaterial).opacity = opacBase
    a.mesh.visible = true
    a.t0 = performance.now()
    a.dur = dur
    a.alvo = alvo
    a.opacBase = opacBase
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: CONE DE BOCA + ANEL DE FUMACA DA BOCA (claraoDeBoca)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_CONE_BOCA = t(6)
  interface ConeBocaInst { mesh: THREE.Mesh; t0: number; dur: number }
  const conesBoca: ConeBocaInst[] = []
  for (let i = 0; i < CAP_CONE_BOCA; i++) {
    const mesh = add(new THREE.Mesh(geoConeBoca, new THREE.MeshBasicMaterial({
      map: texFogo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    })))
    conesBoca.push({ mesh, t0: 0, dur: 110 })
  }
  let curConeBoca = 0

  const CAP_ANEL_BOCA = t(6)
  interface AnelBocaInst { mesh: THREE.Mesh; t0: number; dur: number; alvo: number }
  const aneisBoca: AnelBocaInst[] = []
  for (let i = 0; i < CAP_ANEL_BOCA; i++) {
    const mesh = add(new THREE.Mesh(geoAnelBoca, new THREE.MeshBasicMaterial({
      map: texAnel, color: 0xcabfae, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
    })))
    aneisBoca.push({ mesh, t0: 0, dur: 380, alvo: 1.4 })
  }
  let curAnelBoca = 0

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: FRAGMENTOS DE TERRA (leque de regolito, gravidade real)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_FRAG = t(140)
  interface FragInst {
    mesh: THREE.Mesh; t0: number; dur: number
    x0: number; y0: number; z0: number; vx: number; vy: number; vz: number
  }
  const fragmentos: FragInst[] = []
  for (let i = 0; i < CAP_FRAG; i++) {
    const mesh = add(new THREE.Mesh(geoFrag, new THREE.MeshBasicMaterial({
      color: CORES_REGOLITO[i % CORES_REGOLITO.length], transparent: true,
    })))
    fragmentos.push({ mesh, t0: 0, dur: 1000, x0: 0, y0: 0, z0: 0, vx: 0, vy: 0, vz: 0 })
  }
  let curFrag = 0
  const G_TERRA = 15
  const emitFragmentos = (x: number, y: number, z: number, n: number, spread: number, subida: number, dur: number) => {
    for (let k = 0; k < n; k++) {
      const fr = fragmentos[curFrag]
      curFrag = (curFrag + 1) % CAP_FRAG
      const ang = hash(curFrag, k + 1) * Math.PI * 2
      const spd = spread * (0.5 + hash(curFrag, k + 7) * 0.7)
      fr.vx = Math.cos(ang) * spd
      fr.vz = Math.sin(ang) * spd
      fr.vy = subida * (0.55 + hash(curFrag, k + 3) * 0.7)
      fr.x0 = x
      fr.y0 = y
      fr.z0 = z
      fr.t0 = performance.now()
      fr.dur = dur
      fr.mesh.position.set(x, y, z)
      fr.mesh.rotation.set(hash(curFrag, 11) * Math.PI, hash(curFrag, 13) * Math.PI, hash(curFrag, 17) * Math.PI)
      ;(fr.mesh.material as THREE.MeshBasicMaterial).color.setHex(CORES_REGOLITO[(curFrag + k) % CORES_REGOLITO.length])
      ;(fr.mesh.material as THREE.MeshBasicMaterial).opacity = 1
      fr.mesh.scale.setScalar(0.7 + hash(curFrag, k + 9) * 0.6)
      fr.mesh.visible = true
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FAISCAS RETAS: um unico LineSegments (buffer fixo, sem alocar por tiro)
  // assinatura do MLRS: linhas curtas, sem gravidade forte, saem retas
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_FAISCA = t(48)
  const faiscaPos = new Float32Array(CAP_FAISCA * 6)
  const faiscaViva = new Uint8Array(CAP_FAISCA)
  const faiscaT0 = new Float32Array(CAP_FAISCA)
  const faiscaDur = new Float32Array(CAP_FAISCA)
  const faiscaOX = new Float32Array(CAP_FAISCA)
  const faiscaOY = new Float32Array(CAP_FAISCA)
  const faiscaOZ = new Float32Array(CAP_FAISCA)
  const faiscaVX = new Float32Array(CAP_FAISCA)
  const faiscaVY = new Float32Array(CAP_FAISCA)
  const faiscaVZ = new Float32Array(CAP_FAISCA)
  const geoFaisca = new THREE.BufferGeometry()
  geoFaisca.setAttribute('position', new THREE.BufferAttribute(faiscaPos, 3))
  const matFaisca = new THREE.LineBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
  })
  const faiscasSeg = add(new THREE.LineSegments(geoFaisca, matFaisca))
  faiscasSeg.frustumCulled = false
  faiscasSeg.visible = true
  let curFaisca = 0
  const emitFaiscasSecas = (x: number, y: number, z: number, forca: number) => {
    const n = Math.min(t(8), 3 + Math.round(hash(x, z + forca) * 4))
    for (let k = 0; k < n; k++) {
      const i = curFaisca
      curFaisca = (curFaisca + 1) % CAP_FAISCA
      const ang = hash(i, k + 1) * Math.PI * 2
      const spd = 5 + hash(i, k + 5) * 6
      faiscaOX[i] = x
      faiscaOY[i] = y + 0.3
      faiscaOZ[i] = z
      faiscaVX[i] = Math.cos(ang) * spd
      faiscaVY[i] = 1.4 + hash(i, k + 2) * 2
      faiscaVZ[i] = Math.sin(ang) * spd
      faiscaViva[i] = 1
      faiscaT0[i] = performance.now()
      faiscaDur[i] = 220 + hash(i, k + 9) * 130
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: CAVEIRA (marcador de baixa)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_CAVEIRA = t(12)
  const CAVEIRA_BASE = 3.4
  interface CaveiraInst { sp: THREE.Sprite; t0: number; y0: number }
  const caveiras: CaveiraInst[] = []
  for (let i = 0; i < CAP_CAVEIRA; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texCaveira, transparent: true, depthWrite: false, opacity: 0,
    })))
    caveiras.push({ sp, t0: 0, y0: 0 })
  }
  let curCaveira = 0

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: LINGUAS DE FOGO (jatoDeChamas, o lanca-chamas). Reaproveita a
  // textura texChama (mesma da chama residual da incendiaria). Cada lingua
  // nasce na boca com t0 no futuro (agora + atraso) pra escalonar a rajada
  // inteira sem precisar de uma fila separada como a do cluster.
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_JATO = t(12)
  interface JatoInst {
    sp: THREE.Sprite; t0: number; dur: number
    ox: number; oy: number; oz: number
    dx: number; dy: number; dz: number
    lx: number; lz: number; alcance: number; base: number
  }
  const linguasJato: JatoInst[] = []
  for (let i = 0; i < CAP_JATO; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texChama, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    })))
    linguasJato.push({
      sp, t0: 0, dur: 280, ox: 0, oy: 0, oz: 0, dx: 1, dy: 0, dz: 0, lx: 0, lz: 0, alcance: 6, base: 1,
    })
  }
  let curLingua = 0

  // ═══════════════════════════════════════════════════════════════════════
  // POOL: NUVEM DE FLAK (estouro antiaereo no ceu). Reaproveita a textura
  // texFumaca (mesma fumaca preta da incendiaria e da bomba aerea), so que
  // aqui incha e some sozinha, sem chao, sem anel, sem terra.
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_FLAK = t(10)
  interface FlakInst { sp: THREE.Sprite; t0: number; dur: number; base: number }
  const nuvensFlak: FlakInst[] = []
  for (let i = 0; i < CAP_FLAK; i++) {
    const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: texFumaca, transparent: true, depthWrite: false, opacity: 0,
    })))
    nuvensFlak.push({ sp, t0: 0, dur: 1400, base: 1.2 })
  }
  let curFlak = 0

  // ═══════════════════════════════════════════════════════════════════════
  // FILA DO CLUSTER: 3 sub-estouros escalonados em 60ms, slots reciclados
  // (nunca um array que cresce, so ativa/desativa posicoes fixas)
  // ═══════════════════════════════════════════════════════════════════════
  const CAP_AGENDA = t(9)
  interface AgendaSlot { ativo: boolean; at: number; x: number; y: number; z: number; forca: number }
  const agendaCluster: AgendaSlot[] = Array.from({ length: CAP_AGENDA }, () => ({
    ativo: false, at: 0, x: 0, y: 0, z: 0, forca: 0,
  }))
  let curAgenda = 0

  // ═══════════════════════════════════════════════════════════════════════
  // AS SEIS LINGUAGENS
  // ═══════════════════════════════════════════════════════════════════════

  // 1) OBUS: nada de bola de fogo, o obus levanta chao. flash curto branco
  // + leque de ~14 fragmentos escuros em arco balistico + poeira rasteira.
  const fontanaDeTerra = (p: THREE.Vector3, forca: number) => {
    const f = Math.max(0.4, Math.sqrt(Math.max(0, forca)))
    dispararFlash(p.x, p.y + 0.3, p.z, 1.1 + f * 0.5, 0xfff2dc, 90)
    emitFragmentos(p.x, p.y, p.z, t(14), 2.2 + f * 0.9, 3.6 + f * 1.4, 900 + Math.min(400, forca * 30))
    dispararAnelChao(p.x, p.y, p.z, 3.2 + f * 1.6, 520, 0xcabfa8, 0.5)
  }

  // 2) INCENDIARIA: bola de fogo nucleo branco -> laranja, 2-3 chamas
  // residuais no chao (queimam 3-5s com flicker) e fumaca preta subindo.
  const incendiaria = (p: THREE.Vector3, forca: number) => {
    const f = Math.max(0.4, Math.sqrt(Math.max(0, forca)))
    dispararFogo(p.x, p.y + 0.4, p.z, 1.8 + f * 1.1, 700 + Math.min(350, forca * 20), 0xffb35a)
    dispararFlash(p.x, p.y + 0.4, p.z, 1.0 + f * 0.4, 0xffffff, 70)
    const numChamas = hash(p.x, p.z) > 0.5 ? 3 : 2
    for (let k = 0; k < numChamas; k++) {
      const ang = hash(p.z + k, p.x) * Math.PI * 2
      const rad = 0.6 + hash(p.x, p.z + k) * 1.1
      dispararChama(p.x + Math.cos(ang) * rad, p.y, p.z + Math.sin(ang) * rad, 3000 + hash(p.x, k + p.z) * 2000)
    }
    dispararFumacaPreta(p.x, p.y + 0.6, p.z, 2.4 + f * 1.2, 2400 + Math.min(600, forca * 25))
  }

  // 3) MLRS: 3 estouros brancos-quentes pequenos e secos, 60ms entre eles,
  // espalhados num raio de 3 ao redor do ponto de impacto. Faiscas retas,
  // sem gravidade forte, sem bola de fogo: assinatura seca, nao gorda.
  const clusterQuente = (p: THREE.Vector3, forca: number) => {
    const agora = performance.now()
    for (let k = 0; k < 3; k++) {
      const slot = agendaCluster[curAgenda]
      curAgenda = (curAgenda + 1) % CAP_AGENDA
      const ang = hash(agora + k, p.x + k) * Math.PI * 2
      const raio = hash(agora + k, p.z + k) * 3
      slot.ativo = true
      slot.at = agora + k * 60
      slot.x = p.x + Math.cos(ang) * raio
      slot.y = p.y
      slot.z = p.z + Math.sin(ang) * raio
      slot.forca = forca
    }
  }

  // 4) BOMBA AEREA: a unica que pode ser gorda. Flash largo + coluna de
  // fogo alta + anel de choque duplo (dois raios, dois tempos) + terra em
  // leque bem maior que a do obus.
  const bombaAerea = (p: THREE.Vector3, forca: number) => {
    const f = Math.max(0.6, Math.sqrt(Math.max(0, forca)))
    dispararFlash(p.x, p.y + 0.5, p.z, 3.2 + f * 1.6, 0xfff4dc, 140)
    dispararColuna(p.x, p.y, p.z, 5.5 + f * 3.2, 1.4 + f * 0.6, 1100 + Math.min(500, forca * 30))
    dispararAnelChao(p.x, p.y, p.z, 4.5 + f * 2.2, 480, 0xffcf8a, 0.85)
    dispararAnelChao(p.x, p.y, p.z, 7.5 + f * 3.4, 700, 0xd9c9a8, 0.5)
    emitFragmentos(p.x, p.y, p.z, t(22), 4.5 + f * 1.6, 5.5 + f * 1.8, 1250 + Math.min(500, forca * 35))
    dispararFumacaPreta(p.x, p.y + 1.0, p.z, 3.6 + f * 1.6, 3200 + Math.min(700, forca * 30))
  }

  // 5) CLARAO DE BOCA: canhao atirando de perto. Cone de fogo curto NA
  // DIRECAO do cano (mesh orientado, nao sprite: sprite so gira em torno do
  // eixo da camera, e essa chama precisa apontar de verdade) + anel de
  // fumaca saindo da boca. Nao solta projetil: o chamador cuida disso no
  // mesmo frame, esta funcao so acende o disparo.
  const claraoDeBoca = (pos: THREE.Vector3, dir: THREE.Vector3, forca: number) => {
    const f = Math.max(0.3, Math.sqrt(Math.max(0, forca)))
    _dir.copy(dir)
    if (_dir.lengthSq() < 1e-6) _dir.set(1, 0, 0)
    else _dir.normalize()

    const c = conesBoca[curConeBoca]
    curConeBoca = (curConeBoca + 1) % CAP_CONE_BOCA
    c.mesh.position.copy(pos)
    c.mesh.quaternion.setFromUnitVectors(EIXO_X, _dir)
    const esc = 0.75 + f * 0.4
    c.mesh.scale.set(esc, esc * 0.85, esc * 0.85)
    ;(c.mesh.material as THREE.MeshBasicMaterial).opacity = 1
    c.mesh.visible = true
    c.t0 = performance.now()
    c.dur = 100 + Math.min(60, forca * 3)

    const r = aneisBoca[curAnelBoca]
    curAnelBoca = (curAnelBoca + 1) % CAP_ANEL_BOCA
    r.mesh.position.copy(pos)
    r.mesh.quaternion.setFromUnitVectors(EIXO_Z, _dir)
    r.mesh.scale.setScalar(0.25)
    ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6
    r.mesh.visible = true
    r.t0 = performance.now()
    r.dur = 380 + Math.min(120, forca * 4)
    r.alvo = 1.4 + f * 0.6

    dispararFlash(pos.x, pos.y, pos.z, 1.0 + f * 0.35, 0xfff2d8, 85)
  }

  // 6) CAVEIRA: o marcador de baixa. Sobe 2.5, escala 1->1.4, some em 900ms.
  const caveira = (p: THREE.Vector3, lado: LadoExplosao) => {
    const c = caveiras[curCaveira]
    curCaveira = (curCaveira + 1) % CAP_CAVEIRA
    c.sp.position.copy(p)
    c.y0 = p.y
    c.t0 = performance.now()
    c.sp.scale.setScalar(CAVEIRA_BASE)
    ;(c.sp.material as THREE.SpriteMaterial).color.setHex(lado === 'buy' ? 0xfff2e0 : 0xf0e6ea)
    ;(c.sp.material as THREE.SpriteMaterial).opacity = 1
    c.sp.visible = true
  }

  // 7) JATO DE CHAMAS: lanca-chamas. Rajada dirigida de ~700ms. As linguas
  // nascem na boca e avancam ao longo de dir com leve espalhamento lateral
  // e queda (a gravidade puxa a ponta pra baixo), do branco-amarelo perto
  // da boca ao laranja escuro na ponta. Ao final deixa 1-2 chamas residuais
  // curtas no chao, no alcance final (reaproveita dispararChama, a mesma
  // brasa que a incendiaria usa).
  const ALCANCE_JATO = 6
  const NUM_LINGUAS_JATO = t(7)
  const DUR_RAJADA_JATO = 700
  const jatoDeChamas = (pos: THREE.Vector3, dir: THREE.Vector3, forca: number) => {
    const f = Math.max(0.4, Math.sqrt(Math.max(0, forca)))
    _dir.copy(dir)
    if (_dir.lengthSq() < 1e-6) _dir.set(1, 0, 0)
    else _dir.normalize()
    const agora = performance.now()
    const alcance = ALCANCE_JATO * (0.75 + f * 0.35)
    // perpendicular horizontal a dir, so pro leve espalhamento lateral
    const latx = -_dir.z
    const latz = _dir.x
    for (let k = 0; k < NUM_LINGUAS_JATO; k++) {
      const j = linguasJato[curLingua]
      curLingua = (curLingua + 1) % CAP_JATO
      const atraso = (k / NUM_LINGUAS_JATO) * DUR_RAJADA_JATO * 0.7
      const jit = hash(agora + k, pos.x + k) - 0.5
      j.ox = pos.x
      j.oy = pos.y
      j.oz = pos.z
      j.dx = _dir.x
      j.dy = _dir.y
      j.dz = _dir.z
      j.lx = latx * jit * 1.1
      j.lz = latz * jit * 1.1
      j.alcance = alcance
      j.base = 0.8 + hash(pos.z, agora + k) * 0.4
      j.t0 = agora + atraso
      j.dur = 240 + hash(pos.x, agora + k) * 140
      j.sp.visible = true
    }
    // 1-2 chamas residuais curtas no chao, no alcance final da rajada
    const px = pos.x + _dir.x * alcance
    const pz = pos.z + _dir.z * alcance
    const numResiduais = hash(pos.x, pos.z + forca) > 0.5 ? 2 : 1
    for (let r = 0; r < numResiduais; r++) {
      const ang = hash(px + r, pz) * Math.PI * 2
      const rad = r * 0.5
      dispararChama(px + Math.cos(ang) * rad, pos.y, pz + Math.sin(ang) * rad, 900 + hash(pz, px + r) * 500)
    }
  }

  // 8) FLAK: estouro antiaereo no ceu. Flash pequeno laranja + uma
  // nuvenzinha escura que incha rapido e depois so dissolve, em ~1.4s. Sem
  // anel de chao e sem fragmentos de terra: o estouro e no ar, nao no chao.
  const flak = (p: THREE.Vector3, forca: number) => {
    const f = Math.max(0.3, Math.sqrt(Math.max(0, forca)))
    dispararFlash(p.x, p.y, p.z, 0.6 + f * 0.25, 0xff8a30, 90)
    const n = nuvensFlak[curFlak]
    curFlak = (curFlak + 1) % CAP_FLAK
    n.sp.position.set(p.x, p.y, p.z)
    n.sp.scale.setScalar(0.4)
    ;(n.sp.material as THREE.SpriteMaterial).opacity = 0
    n.sp.visible = true
    n.t0 = performance.now()
    n.dur = 1300 + hash(p.x, p.z + forca) * 200
    n.base = 1.1 + f * 0.5
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UPDATE: um passo so anima tudo
  // ═══════════════════════════════════════════════════════════════════════
  const update = (agora: number, dt: number) => {
    for (const f of flashes) {
      if (!f.sp.visible) continue
      const k = (agora - f.t0) / f.dur
      if (k >= 1) { f.sp.visible = false; continue }
      const mat = f.sp.material as THREE.SpriteMaterial
      mat.opacity = 1 - k
    }

    for (const b of fogos) {
      if (!b.sp.visible) continue
      const k = (agora - b.t0) / b.dur
      if (k >= 1) { b.sp.visible = false; continue }
      const cresce = Math.min(1, k * 3.2)
      b.sp.scale.setScalar(b.base * (0.35 + 0.65 * cresce))
      const mat = b.sp.material as THREE.SpriteMaterial
      mat.opacity = k < 0.3 ? 1 : Math.max(0, 1 - (k - 0.3) / 0.7)
    }

    for (const c of colunas) {
      if (!c.sp.visible) continue
      const k = (agora - c.t0) / c.dur
      if (k >= 1) { c.sp.visible = false; continue }
      const subida = Math.min(1, k * 2.2)
      const alt = c.alt * subida
      c.sp.scale.set(c.larg * (0.6 + 0.4 * subida), Math.max(0.05, alt), 1)
      c.sp.position.y = c.y0 + alt * 0.5
      const mat = c.sp.material as THREE.SpriteMaterial
      mat.opacity = k < 0.5 ? 1 : Math.max(0, 1 - (k - 0.5) / 0.5)
    }

    for (const ch of chamas) {
      if (!ch.sp.visible) continue
      const dtms = agora - ch.t0
      if (dtms >= ch.dur) { ch.sp.visible = false; continue }
      const flick = 0.75 + 0.25 * Math.sin(agora * 0.02 + ch.seed * 30)
      const restante = ch.dur - dtms
      const kFade = restante < 260 ? restante / 260 : 1
      ch.sp.scale.setScalar(ch.base * flick)
      const mat = ch.sp.material as THREE.SpriteMaterial
      mat.opacity = 0.85 * flick * Math.max(0, kFade)
    }

    for (const s of fumacas) {
      if (!s.sp.visible) continue
      const k = (agora - s.t0) / s.dur
      if (k >= 1) { s.sp.visible = false; continue }
      s.sp.position.y = s.y0 + k * (2.6 + s.base * 0.4)
      s.sp.position.x += Math.sin(agora * 0.001 + s.jit * 10) * dt * 0.3
      s.sp.scale.setScalar(s.base * (0.5 + k * 0.9))
      const mat = s.sp.material as THREE.SpriteMaterial
      mat.opacity = k < 0.2 ? (k / 0.2) * 0.55 : 0.55 * (1 - (k - 0.2) / 0.8)
    }

    for (const a of aneisChao) {
      if (!a.mesh.visible) continue
      const k = (agora - a.t0) / a.dur
      if (k >= 1) { a.mesh.visible = false; continue }
      const esc = a.alvo * Math.min(1, k * 1.6)
      a.mesh.scale.set(esc, 1, esc)
      const mat = a.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = a.opacBase * (1 - k)
    }

    for (const c of conesBoca) {
      if (!c.mesh.visible) continue
      const k = (agora - c.t0) / c.dur
      if (k >= 1) { c.mesh.visible = false; continue }
      const mat = c.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 1 - k
    }

    for (const r of aneisBoca) {
      if (!r.mesh.visible) continue
      const k = (agora - r.t0) / r.dur
      if (k >= 1) { r.mesh.visible = false; continue }
      const esc = 0.25 + (r.alvo - 0.25) * Math.min(1, k * 1.4)
      r.mesh.scale.setScalar(esc)
      const mat = r.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 * (1 - k)
    }

    for (const fr of fragmentos) {
      if (!fr.mesh.visible) continue
      let dtms = agora - fr.t0
      if (dtms >= fr.dur) { fr.mesh.visible = false; continue }
      let tt = dtms / 1000
      let ny = fr.y0 + fr.vy * tt - 0.5 * G_TERRA * tt * tt
      if (ny < fr.y0) {
        // pousou: trava no chao e acelera o resto do sumico
        const restante = fr.dur - dtms
        if (restante > 160) { fr.t0 = agora - fr.dur + 160; dtms = agora - fr.t0; tt = dtms / 1000 }
        ny = fr.y0
      }
      const nx = fr.x0 + fr.vx * tt
      const nz = fr.z0 + fr.vz * tt
      fr.mesh.position.set(nx, ny, nz)
      fr.mesh.rotation.x += dt * 4
      fr.mesh.rotation.z += dt * 3
      const k = dtms / fr.dur
      const mat = fr.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1
    }

    let faiscaMudou = false
    for (let i = 0; i < CAP_FAISCA; i++) {
      if (!faiscaViva[i]) continue
      const dtms = agora - faiscaT0[i]
      if (dtms >= faiscaDur[i]) {
        faiscaViva[i] = 0
        faiscaPos[i * 6] = faiscaPos[i * 6 + 3] = faiscaOX[i]
        faiscaPos[i * 6 + 1] = faiscaPos[i * 6 + 4] = faiscaOY[i]
        faiscaPos[i * 6 + 2] = faiscaPos[i * 6 + 5] = faiscaOZ[i]
        faiscaMudou = true
        continue
      }
      const tt = dtms / 1000
      const hx = faiscaOX[i] + faiscaVX[i] * tt
      const hy = faiscaOY[i] + faiscaVY[i] * tt - 4 * tt * tt
      const hz = faiscaOZ[i] + faiscaVZ[i] * tt
      const ttr = Math.max(0, tt - 0.05)
      const tx = faiscaOX[i] + faiscaVX[i] * ttr
      const ty = faiscaOY[i] + faiscaVY[i] * ttr - 4 * ttr * ttr
      const tz = faiscaOZ[i] + faiscaVZ[i] * ttr
      faiscaPos[i * 6] = hx; faiscaPos[i * 6 + 1] = hy; faiscaPos[i * 6 + 2] = hz
      faiscaPos[i * 6 + 3] = tx; faiscaPos[i * 6 + 4] = ty; faiscaPos[i * 6 + 5] = tz
      faiscaMudou = true
    }
    if (faiscaMudou) geoFaisca.attributes.position.needsUpdate = true

    for (const c of caveiras) {
      if (!c.sp.visible) continue
      const k = (agora - c.t0) / 1300
      if (k >= 1) { c.sp.visible = false; continue }
      c.sp.position.y = c.y0 + 4.2 * k
      const esc = 1 + 0.4 * Math.min(1, k * 1.3)
      c.sp.scale.setScalar(CAVEIRA_BASE * esc)
      const mat = c.sp.material as THREE.SpriteMaterial
      mat.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3)
    }

    for (const j of linguasJato) {
      if (!j.sp.visible) continue
      if (agora < j.t0) continue
      const k = (agora - j.t0) / j.dur
      if (k >= 1) { j.sp.visible = false; continue }
      const avanco = j.alcance * k
      const queda = 1.6 * k * k
      j.sp.position.set(
        j.ox + j.dx * avanco + j.lx * k,
        j.oy + j.dy * avanco - queda,
        j.oz + j.dz * avanco + j.lz * k,
      )
      j.sp.scale.setScalar(Math.max(0.15, j.base * (1.1 - 0.5 * k)))
      const mat = j.sp.material as THREE.SpriteMaterial
      // do branco-amarelo perto da boca ao laranja escuro na ponta
      mat.color.setRGB(1 - k * 0.35, 0.92 - k * 0.62, 0.76 - k * 0.74)
      mat.opacity = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85)
    }

    for (const n of nuvensFlak) {
      if (!n.sp.visible) continue
      const k = (agora - n.t0) / n.dur
      if (k >= 1) { n.sp.visible = false; continue }
      const incha = Math.min(1, k * 2.4)
      n.sp.scale.setScalar(n.base * (0.35 + 0.65 * incha))
      const mat = n.sp.material as THREE.SpriteMaterial
      mat.opacity = k < 0.25 ? (k / 0.25) * 0.6 : 0.6 * Math.max(0, 1 - (k - 0.25) / 0.75)
    }

    for (const slot of agendaCluster) {
      if (!slot.ativo || agora < slot.at) continue
      slot.ativo = false
      dispararFlash(slot.x, slot.y + 0.3, slot.z, 1.3 + Math.sqrt(Math.max(0, slot.forca)) * 0.5, 0xfff6e0, 95)
      emitFaiscasSecas(slot.x, slot.y, slot.z, slot.forca)
    }
  }

  const dispose = () => {
    for (const o of objetos) {
      group.remove(o)
      const mat = (o as any).material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) mat.dispose()
    }
    geoFrag.dispose()
    geoConeBoca.dispose()
    geoAnelChao.dispose()
    geoAnelBoca.dispose()
    geoFaisca.dispose()
    texFlash.dispose()
    texFogo.dispose()
    texFumaca.dispose()
    texAnel.dispose()
    texChama.dispose()
    texCaveira.dispose()
  }

  return {
    fontanaDeTerra, incendiaria, clusterQuente, bombaAerea, claraoDeBoca, caveira,
    jatoDeChamas, flak, update, dispose,
  }
}
