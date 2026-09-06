// O precinto da praça: o que costura o deck às quatro âncoras (praca-central.md §4.2,
// D7 e D8). Um círculo central (o deck, r 300), um cinturão de jardim, um bulevar
// anelar em r 450 ligando as quatro portas, quatro bulevares radiais nos eixos
// cardeais, e as âncoras em r 620: BitFlow a oeste, Kray a leste, o Chalé ao sul, e
// ao norte, enquanto a quarta âncora não existe, a grande fonte e o jardim.
//
// O jardim é clássico, do jeito que o fundador pediu depois de ver (e recusar) a
// versão bioluminescente ("muito colorido"): "um imenso jardim com o que tem de
// mais belo na Terra mesmo, sem inventar muita moda, como os jardins dos cassinos
// e palácios". Gramados e parterres com sebes aparadas, alamedas de palmeiras e
// árvores de copa, topiaria nas esquinas, espelhos d'água com fontes brancas,
// bancos e postes de luz quente: o mesmo vocabulário que os sítios da Kray e da
// BitFlow já trazem (lib_dogcity: palm, street_tree, hedge_block, water_basin,
// lamp), agora contínuo entre elas. Tudo instanciado e semeado por um gerador
// determinístico, para a praça ser a mesma em toda visita.
//
// Paleta: verdes escuros de gramado e sebe, pedra escura nos passeios, água
// branca, luz quente. O laranja DOG fica na arquitetura.
import * as THREE from 'three'
import {
  isReserved, WHITEPAPER_CYPRESSES, SATOSHI_CYPRESSES, SATOSHI_BENCHES, ORDINAL_OLIVES, PAW_BLOSSOMS,
  POOL_R,
} from './garden-plan'
import type { PerfProfile, DistanceCuller } from './perf'
import { makeGlowTexture } from './light-pool'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
// ⚠️ PRACA_Y VEM DE terrain.ts, NÃO DE UM LITERAL AQUI. As âncoras nascem
// (este módulo é avaliado) antes de o terreno carregar (`loadTerrain` é
// assíncrono), então elas não podem perguntar a `heightAt`; mas o VALOR da
// cota da praça é o mesmo dos dois lados, e `terrain.ts` já o exporta para
// isso. Uma fonte só: mudar `PRACA_Y` lá muda as âncoras aqui sozinho.
import { PRACA_Y } from './terrain'

export const R_DECK = 300
export const R_GARDEN_IN = 332
export const R_RING = 452
export const RING_W = 34
export const R_ANCHOR = 620
export const BOULEVARD_W = 42
export const R_EDGE = 900

/** Onde cada âncora fica e para onde olha (rotação em y). Frentes voltadas para o centro.
 *  ⚠️ y = PRACA_Y, NÃO MAIS 0: em 05/09 (segunda rodada) a praça inteira desceu
 *  para −35 (o fundador viu a ilha alta demais e mandou abaixar; ver o
 *  cabeçalho de `bacia()` em terrain.ts). As três âncoras construídas
 *  (BitFlow, Kray, Chalé) são objetos SEPARADOS do chão do precinto e não
 *  seguem `heightAt` sozinhas: sem este ajuste elas ficariam de pé no ar, 35 m
 *  acima do jardim que desceu ao redor delas. */
export const ANCHORS = {
  west: { pos: new THREE.Vector3(-R_ANCHOR, PRACA_Y, 0), rotY: Math.PI / 2 },   // BitFlow, frente para +x
  east: { pos: new THREE.Vector3(R_ANCHOR, PRACA_Y, 0), rotY: -Math.PI / 2 },   // Kray, frente para −x
  south: { pos: new THREE.Vector3(0, PRACA_Y, R_ANCHOR), rotY: 0 },              // Chalé, frente para −z
  north: { pos: new THREE.Vector3(0, PRACA_Y, -R_ANCHOR), rotY: Math.PI },      // jardim, por enquanto
} as const

const ICE = new THREE.Color('#F2EAD6')      // luz de poste, branco quente
const WARM = new THREE.Color('#FFB35C')
const LAWN = new THREE.Color('#183121')
const HEDGE = new THREE.Color('#1a3a1f')
const LEAF = new THREE.Color('#2f6b3a')
const LEAF_TIP = new THREE.Color('#6fae63')
const TRUNK = new THREE.Color('#3a2c22')
const WATER_JET = new THREE.Color('#e9f3ff')

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Precinct {
  group: THREE.Group
  update: (t: number) => void
  dispose: () => void
  /** Com `realTrees`, os pontos semeados dos setores saem daqui como MODELOS a
   *  plantar (props.ts os instancia). O gerador procedural de árvore e palmeira
   *  fica desligado: o fundador quer "nenhuma árvore simples, sai tudo que é
   *  genérico", e a copa-esfera sobre cilindro era exatamente isso. */
  treeSpots: { file: string; at: [number, number][] }[]
}

/** Está dentro de algum bulevar radial? (faixa de largura BOULEVARD_W nos eixos) */
function inRadialBoulevard(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  if (r < R_GARDEN_IN - 20 || r > R_ANCHOR - 100) return false
  return Math.abs(x) < BOULEVARD_W / 2 + 6 || Math.abs(z) < BOULEVARD_W / 2 + 6
}
/** Está no anel do bulevar? */
function inRing(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  return Math.abs(r - R_RING) < RING_W / 2 + 6
}
/** Está no sítio de uma âncora (o retângulo do lote)? Os quatro, o norte incluído. */
function inAnchorSite(x: number, z: number): boolean {
  const half = 175
  return (Math.abs(Math.abs(x) - R_ANCHOR) < half && Math.abs(z) < half) || (Math.abs(Math.abs(z) - R_ANCHOR) < half && Math.abs(x) < half)
}
/** Só os três lotes construídos: BitFlow (oeste), Kray (leste), Chalé (sul). */
function inBuiltAnchorSite(x: number, z: number): boolean {
  const half = 175
  return (Math.abs(Math.abs(x) - R_ANCHOR) < half && Math.abs(z) < half) || (Math.abs(z - R_ANCHOR) < half && Math.abs(x) < half)
}
const SITE_HALF = 175
const WALK_W = 8
/** A calçada do lote: um anel retangular de passeio em volta de cada âncora construída. */
function inSiteWalk(x: number, z: number): boolean {
  for (const [cx, cz] of [[-R_ANCHOR, 0], [R_ANCHOR, 0], [0, R_ANCHOR]] as const) {
    const dx = Math.abs(x - cx), dz = Math.abs(z - cz)
    const outer = SITE_HALF + 4 + WALK_W, inner = SITE_HALF + 4
    if (dx < outer && dz < outer && !(dx < inner && dz < inner)) return true
  }
  return false
}

export function buildPrecinct(opts: { heightAt: (x: number, z: number) => number; profile?: PerfProfile; culler?: DistanceCuller; realTrees?: boolean }): Precinct {
  // `realTrees`: cipreste, oliveira, flor branca e os bancos passaram a ser
  // modelos de verdade (props-table.ts). O gerador procedural continua fazendo
  // as copas redondas e os pinheiros dos setores, que ninguém vê de perto.
  const REAL = opts.realTrees ?? false
  const SMALL = opts.profile?.smallCull ?? 2600
  const cull = (o: THREE.Object3D, d = SMALL) => opts.culler?.add(o, d)
  const group = new THREE.Group()
  group.name = 'Precinct'
  const rnd = mulberry(840000)
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const yAt = (x: number, z: number) => opts.heightAt(x, z)
  // ⚠️ Y0, EM 05/09 (SEGUNDA RODADA): A PRAÇA DESCEU E O PRECINTO INTEIRO
  // (r ≤ 900, dentro do disco plano da bacia) DESCEU JUNTO. A maioria das
  // peças daqui usa `yAt(x, z)` por peça e já acompanha sozinha, porque
  // `opts.heightAt` agora devolve a cota nova em qualquer ponto do precinto
  // (o disco é plano, então o valor é o MESMO em todo lugar aqui dentro). Mas
  // um bom número de malhas planas (o anel, o leque das âncoras, o passeio
  // circular, as calçadas dos lotes) foram desenhadas com `position.y` CRAVADO
  // em 0,2 a 1,62 (a altura do meio-fio acima do chão), sem nunca consultar
  // `yAt`, porque todo o precinto vivia no platô 0. `Y0` é essa mesma consulta
  // feita UMA vez (o disco é plano, então uma sonda no centro vale para
  // qualquer ponto do precinto): somada a cada um desses cravados, eles voltam
  // a encostar no chão novo em vez de flutuar 35 m no ar.
  const Y0 = opts.heightAt(0, 0)

  // ── pavimento: anel e radiais ──────────────────────────────────────────────
  const paveMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 }))
  const kerbMat = track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, transparent: true, opacity: 0.55 }))
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(R_RING - RING_W / 2, R_RING + RING_W / 2, 192)), paveMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = Y0 + 0.35
  ring.receiveShadow = true
  group.add(ring)
  for (const rr of [R_RING - RING_W / 2, R_RING + RING_W / 2]) {
    const k = new THREE.Mesh(track(new THREE.RingGeometry(rr - 0.35, rr + 0.35, 192)), kerbMat)
    k.rotation.x = -Math.PI / 2
    k.position.y = Y0 + 0.42
    group.add(k)
  }
  const radialGeo = track(new THREE.PlaneGeometry(BOULEVARD_W, R_ANCHOR - 100 - R_GARDEN_IN + 40))
  const kerbGeo = track(new THREE.PlaneGeometry(0.7, R_ANCHOR - 100 - R_GARDEN_IN + 40))
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    const g = new THREE.Group()
    const mid = (R_GARDEN_IN - 20 + R_ANCHOR - 100) / 2
    const p = new THREE.Mesh(radialGeo, paveMat)
    p.rotation.x = -Math.PI / 2
    p.receiveShadow = true
    g.add(p)
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(kerbGeo, kerbMat)
      k.rotation.x = -Math.PI / 2
      k.position.set(sx * (BOULEVARD_W / 2), 0.07, 0)
      g.add(k)
      // a linha de luz do meio-fio, e postes
    }
    g.position.set(Math.sin(a) * mid, Y0 + 0.36, Math.cos(a) * mid)
    g.rotation.y = a
    group.add(g)
  }

  // ── O PÁTIO EM LEQUE DAS DUAS TORRES ─────────────────────────────────────
  //
  // O fundador, 2026-08-23: "queremos pátio em leque". O problema que ele
  // resolve: o lote de cada âncora é um QUADRADO de 350 m alinhado aos eixos
  // cartesianos, largado num desenho inteiramente RADIAL (deck circular, anel em
  // r 452, bulevares saindo do centro). Repintar a paleta tirou o retângulo
  // preto do jardim, mas a gramática continuava sendo outra: a praça gira, o
  // lote não.
  //
  // O leque é um setor de coroa circular: nasce colado ao anel, abre no ângulo
  // da torre e vai até depois dela, de modo que a TORRE FICA DE PÉ DENTRO DO
  // PÁTIO em vez de ao lado de um. Por construção ele é concêntrico com tudo o
  // mais, então não existe alinhamento para errar.
  //
  // Só as duas TORRES ganham leque. O Chalé ao sul é uma casa de 30 m: um pátio
  // de 320 m de boca na frente dele seria um aeroporto com uma cabana no meio.
  const FAN_IN = R_RING + RING_W / 2 + 4      // encosta no anel, sem cobri-lo
  const FAN_OUT = 700                          // passa da torre (fachada em ~580)
  const FAN_HALF = THREE.MathUtils.degToRad(15)
  {
    // theta do RingGeometry conta a partir de +x e cresce para -z depois do
    // tombo de -90° em x. Kray fica em +x (theta 0), BitFlow em -x (theta π).
    for (const centre of [0, Math.PI]) {
      const g = new THREE.Group()
      g.name = 'AnchorForecourt'
      const floor = new THREE.Mesh(
        track(new THREE.RingGeometry(FAN_IN, FAN_OUT, 96, 1, centre - FAN_HALF, FAN_HALF * 2)),
        paveMat,
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = Y0 + 0.34
      floor.receiveShadow = true
      g.add(floor)

      // ⚠️ AS FAIXAS SÃO O QUE FAZ O PÁTIO TER ESCALA. Um leque liso de 230 m de
      // fundo é uma mancha; três arcos de pedra clara dizem a distância que se
      // tem para andar, que é como uma esplanada de verdade se lê.
      for (const t of [0.28, 0.56, 0.84]) {
        const r = FAN_IN + (FAN_OUT - FAN_IN) * t
        const band = new THREE.Mesh(
          track(new THREE.RingGeometry(r - 1.1, r + 1.1, 96, 1, centre - FAN_HALF, FAN_HALF * 2)),
          track(new THREE.MeshStandardMaterial({ color: 0x23242b, roughness: 0.7, metalness: 0.2 })),
        )
        band.rotation.x = -Math.PI / 2
        band.position.y = Y0 + 0.36
        g.add(band)
      }

      // o meio-fio de luz: os dois lados retos e a boca externa, o mesmo
      // vocabulário do anel e dos bulevares
      for (const side of [-1, 1]) {
        const a = centre + side * FAN_HALF
        const len = FAN_OUT - FAN_IN
        const k = new THREE.Mesh(track(new THREE.PlaneGeometry(0.7, len)), kerbMat)
        k.rotation.x = -Math.PI / 2
        k.position.set(Math.cos(a) * (FAN_IN + len / 2), Y0 + 0.42, -Math.sin(a) * (FAN_IN + len / 2))
        k.rotation.z = -a
        g.add(k)
      }
      const mouth = new THREE.Mesh(
        track(new THREE.RingGeometry(FAN_OUT - 0.35, FAN_OUT + 0.35, 96, 1, centre - FAN_HALF, FAN_HALF * 2)),
        kerbMat,
      )
      mouth.rotation.x = -Math.PI / 2
      mouth.position.y = Y0 + 0.42
      g.add(mouth)
      group.add(g)
    }
  }

  // ── o desenho do parterre: alamedas diagonais e o passeio-anel externo ────
  // Visto de cima, um jardim de palácio é um desenho: além dos quatro bulevares
  // cardeais, quatro alamedas nas diagonais (do anel à muralha, passando pelos
  // espelhos d'água) e um passeio circular em r 745 costurando os setores entre
  // as âncoras. Pedra escura com o meio-fio de luz, como o resto.
  const ALLEE_W = 14
  const allee = (a: number, r0: number, r1: number) => {
    const len = r1 - r0, mid = (r0 + r1) / 2
    const g = new THREE.Group()
    const p = new THREE.Mesh(track(new THREE.PlaneGeometry(ALLEE_W, len)), paveMat)
    p.rotation.x = -Math.PI / 2
    p.receiveShadow = true
    g.add(p)
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(track(new THREE.PlaneGeometry(0.6, len)), kerbMat)
      k.rotation.x = -Math.PI / 2
      k.position.set(sx * (ALLEE_W / 2), 0.07, 0)
      g.add(k)
    }
    g.position.set(Math.sin(a) * mid, Y0 + 0.36, Math.cos(a) * mid)
    g.rotation.y = a
    group.add(g)
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    allee(a, R_RING + RING_W / 2 - 2, 560 - 52) // do anel ao espelho d'água
    allee(a, 560 + 52, R_EDGE - 6)              // do espelho à muralha
  }
  const R_PROM = 745, PROM_W = 12
  const promenadeArc = (a0: number, a1: number) => {
    const seg = Math.max(8, Math.round(((a1 - a0) * R_PROM) / 6))
    const p = new THREE.Mesh(track(new THREE.RingGeometry(R_PROM - PROM_W / 2, R_PROM + PROM_W / 2, seg, 1, a0, a1 - a0)), paveMat)
    p.rotation.x = -Math.PI / 2
    p.position.y = Y0 + 0.35
    p.receiveShadow = true
    group.add(p)
    for (const rr of [R_PROM - PROM_W / 2, R_PROM + PROM_W / 2]) {
      const k = new THREE.Mesh(track(new THREE.RingGeometry(rr - 0.3, rr + 0.3, seg, 1, a0, a1 - a0)), kerbMat)
      k.rotation.x = -Math.PI / 2
      k.position.y = Y0 + 0.42
      group.add(k)
    }
  }
  {
    // RingGeometry mede o ângulo a partir de +x no plano da geometria; depois de
    // rotation.x = −π/2 o plano (x, y) vira (x, −z), então theta = atan2(−z, x)
    // o norte não tem lote (é a Grande Fonte): o passeio-anel passa por trás dela
    const free = (theta: number) => { const x = Math.cos(theta) * R_PROM, z = -Math.sin(theta) * R_PROM; return !inBuiltAnchorSite(x, z) && Math.hypot(x, z + R_ANCHOR) >= 128 }
    const n = 720
    let start: number | null = null
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2
      const ok = i < n && free(th)
      if (ok && start == null) start = th
      if (!ok && start != null) { if (th - start > 0.05) promenadeArc(start, th); start = null }
    }
  }

  // ── as calçadas dos lotes: um anel retangular de passeio em volta de cada âncora ──
  // construída, onde o bulevar cardeal, o passeio-anel e as alamedas CHEGAM. Antes
  // o passeio-anel morria na cerca do lote e o bulevar parava no gramado: as "ruas
  // sem sentido" que o fundador viu.
  const kerbLine = (x0: number, z0: number, x1: number, z1: number, y = 0.42) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const k = new THREE.Mesh(track(new THREE.PlaneGeometry(0.6, len)), kerbMat)
    k.rotation.x = -Math.PI / 2
    k.rotation.z = -Math.atan2(x1 - x0, z1 - z0)
    k.position.set((x0 + x1) / 2, Y0 + y, (z0 + z1) / 2)
    group.add(k)
  }
  for (const [cx, cz] of [[-R_ANCHOR, 0], [R_ANCHOR, 0], [0, R_ANCHOR]] as const) {
    const inner = SITE_HALF + 4, outer = inner + WALK_W
    // quatro lados: retângulos finos
    for (const [dx, dz, w, d] of [
      [0, -(inner + WALK_W / 2), 2 * outer, WALK_W], [0, inner + WALK_W / 2, 2 * outer, WALK_W],
      [-(inner + WALK_W / 2), 0, WALK_W, 2 * inner], [inner + WALK_W / 2, 0, WALK_W, 2 * inner],
    ] as const) {
      const p = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), paveMat)
      p.rotation.x = -Math.PI / 2
      p.position.set(cx + dx, Y0 + 0.36, cz + dz)
      p.receiveShadow = true
      group.add(p)
    }
    for (const h of [inner, outer]) {
      kerbLine(cx - h, cz - h, cx + h, cz - h); kerbLine(cx + h, cz - h, cx + h, cz + h)
      kerbLine(cx + h, cz + h, cx - h, cz + h); kerbLine(cx - h, cz + h, cx - h, cz - h)
    }
  }
  // e o passeio em volta de cada espelho d'água, onde as alamedas param e retomam
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const cx = Math.cos(a) * 560, cz = Math.sin(a) * 560
    const p = new THREE.Mesh(track(new THREE.RingGeometry(POOL_R + 2, POOL_R + 8, 96)), paveMat)
    p.rotation.x = -Math.PI / 2
    p.position.set(cx, Y0 + 0.35, cz)
    p.receiveShadow = true
    group.add(p)
    const k = new THREE.Mesh(track(new THREE.RingGeometry(POOL_R + 7.7, POOL_R + 8.3, 96)), kerbMat)
    k.rotation.x = -Math.PI / 2
    k.position.set(cx, Y0 + 0.42, cz)
    group.add(k)
  }

  // ── postes: esferas de luz fria em hastes finas, ao longo dos bulevares ────
  const lampCount = 4 * 12 * 2 + 64 + 96
  const poleGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 9, 6))
  const bulbGeo = track(new THREE.SphereGeometry(0.9, 7, 5)) // 256 lâmpadas: 60 tris cada bastam
  const poleMat = track(new THREE.MeshStandardMaterial({ color: 0x23242b, metalness: 0.7, roughness: 0.4 }))
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false }))
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampCount)
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount)
  const o = new THREE.Object3D()
  let li = 0
  const lamp = (x: number, z: number) => {
    if (li >= lampCount) return
    const y = yAt(x, z)
    o.position.set(x, y + 4.5, z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix()
    poles.setMatrixAt(li, o.matrix)
    o.position.set(x, y + 9.4, z); o.updateMatrix()
    bulbs.setMatrixAt(li, o.matrix)
    li++
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (let k = 0; k < 12; k++) {
      const r = R_GARDEN_IN + 8 + k * 14.5
      for (const s of [-1, 1]) {
        const off = s * (BOULEVARD_W / 2 + 2.5)
        lamp(Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off)
      }
    }
  }
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2
    const r = R_RING + (k % 2 === 0 ? -1 : 1) * (RING_W / 2 + 2.5)
    lamp(Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2 + Math.PI / 96
    lamp(Math.cos(a) * (R_EDGE + 3), Math.sin(a) * (R_EDGE + 3))
  }
  poles.count = bulbs.count = li
  poles.instanceMatrix.needsUpdate = bulbs.instanceMatrix.needsUpdate = true
  group.add(poles, bulbs)
  // ── A POÇA DE LUZ DE CADA POSTE ──────────────────────────────────────────
  // 256 lâmpadas acesas e nenhuma marca no chão: de noite a praça lia como um
  // campo escuro com pontinhos brancos flutuando (fundador, 2026-08-19, "tá bem
  // escuro"). Uma nuvem de sprites aditivos no pé de cada poste é o que faz a
  // luz artificial existir para quem olha, e custa UM desenho, não 256 luzes.
  const lampPools = (() => {
    const pos = new Float32Array(li * 3)
    const m = new THREE.Matrix4(); const v = new THREE.Vector3()
    for (let i = 0; i < li; i++) {
      poles.getMatrixAt(i, m)
      v.setFromMatrixPosition(m)
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y - 4.3 + 0.25; pos[i * 3 + 2] = v.z
    }
    const g = track(new THREE.BufferGeometry())
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(g, track(new THREE.PointsMaterial({
      map: makeGlowTexture(), color: 0xdfe8ff, size: 17, sizeAttenuation: true,
      transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending,
    })))
    pts.frustumCulled = false
    pts.name = 'LampPools'
    return pts
  })()
  group.add(lampPools)
  cull(lampPools, SMALL)
  cull(poles); cull(bulbs, SMALL * 1.4)

  // ── espelhos d'água com fontes, nas diagonais entre as âncoras ───────────
  const poolMat = track(new THREE.MeshStandardMaterial({ color: 0x08111c, roughness: 0.05, metalness: 0.7, emissive: 0x0a1a2c, emissiveIntensity: 0.5, envMapIntensity: 1.6 }))
  const poolRimMat = track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, transparent: true, opacity: 0.7 }))
  const jets: THREE.Points[] = []
  const jetTex = makeDotTexture()
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const cx = Math.cos(a) * 560, cz = Math.sin(a) * 560
    const y = yAt(cx, cz)
    const pool = new THREE.Mesh(track(new THREE.CircleGeometry(48, 64)), poolMat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(cx, y + 0.25, cz)
    pool.receiveShadow = true
    group.add(pool)
    const rim = new THREE.Mesh(track(new THREE.RingGeometry(47.4, 48.6, 96)), poolRimMat)
    rim.rotation.x = -Math.PI / 2
    rim.position.set(cx, y + 0.32, cz)
    group.add(rim)
    // a fonte: um jato central e um anel de jatos menores
    const NJ = opts.profile?.jetParticles ?? 900
    const pos = new Float32Array(NJ * 3)
    const seed = new Float32Array(NJ * 2)
    for (let k = 0; k < NJ; k++) { seed[k * 2] = rnd(); seed[k * 2 + 1] = rnd() }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pm = track(new THREE.PointsMaterial({ map: jetTex, color: WATER_JET, size: 1.7, sizeAttenuation: true, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }))
    const pts = new THREE.Points(geo, pm)
    pts.position.set(cx, y + 0.3, cz)
    pts.userData.seed = seed
    // (o NW voltou a ter jato central quando a figura em lâminas saiu, 2026-08-19)
    pts.frustumCulled = false
    group.add(pts)
    jets.push(pts)
    track(geo)
  }

  // ── o gramado: o cinturão e os setores são relva, e a relva é o fundo do jardim ──
  const lawnMat = track(new THREE.MeshStandardMaterial({ color: LAWN, roughness: 0.95, metalness: 0 }))
  const lawnIn = new THREE.Mesh(track(new THREE.RingGeometry(R_GARDEN_IN - 4, R_RING - RING_W / 2 + 2, 192)), lawnMat)
  lawnIn.rotation.x = -Math.PI / 2
  lawnIn.position.y = Y0 + 0.2
  lawnIn.receiveShadow = true
  group.add(lawnIn)
  const lawnOut = new THREE.Mesh(track(new THREE.RingGeometry(R_RING + RING_W / 2 - 2, R_EDGE - 6, 256)), lawnMat)
  lawnOut.rotation.x = -Math.PI / 2
  lawnOut.position.y = Y0 + 0.2
  lawnOut.receiveShadow = true
  group.add(lawnOut)
  // ── a borda do jardim: passeio perimetral, muralha baixa de pedra e postes ──
  // Um jardim de palácio termina numa linha desenhada, não desmancha no regolito.
  const edgePath = new THREE.Mesh(track(new THREE.RingGeometry(R_EDGE - 7, R_EDGE + 8, 256)), paveMat)
  edgePath.rotation.x = -Math.PI / 2
  edgePath.position.y = Y0 + 0.34
  edgePath.receiveShadow = true
  group.add(edgePath)
  const wall = new THREE.Mesh(
    track(new THREE.CylinderGeometry(R_EDGE + 9.4, R_EDGE + 9.4, 1.6, 256, 1, true)),
    track(new THREE.MeshStandardMaterial({ color: 0x1c1c21, roughness: 0.8, metalness: 0.15, side: THREE.DoubleSide })),
  )
  wall.position.y = Y0 + 0.8
  wall.castShadow = wall.receiveShadow = true
  group.add(wall)
  const wallCap = new THREE.Mesh(track(new THREE.RingGeometry(R_EDGE + 8.4, R_EDGE + 10.4, 256)), track(new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.2 })))
  wallCap.rotation.x = -Math.PI / 2
  wallCap.position.y = Y0 + 1.62
  group.add(wallCap)
  const edgeLine = new THREE.Mesh(track(new THREE.RingGeometry(R_EDGE - 7.4, R_EDGE - 6.6, 256)), kerbMat)
  edgeLine.rotation.x = -Math.PI / 2
  edgeLine.position.y = Y0 + 0.42
  group.add(edgeLine)

  // onde pode nascer: cinturão 332..440 (fora dos radiais e do anel), e setores
  // 480..900 fora dos sítios das âncoras, dos bulevares e dos espelhos d'água
  const canGrow = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    if (r < R_GARDEN_IN || r > 900) return false
    if (inRing(x, z) || inRadialBoulevard(x, z) || inAnchorSite(x, z)) return false
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2
      if (Math.hypot(x - Math.cos(a) * 560, z - Math.sin(a) * 560) < 62) return false
    }
    if (Math.hypot(x, z + R_ANCHOR) < 120) return false // a grande fonte do norte
    if (Math.abs(r - 745) < 6 + 5) return false // o passeio-anel
    // as alamedas diagonais: distância ao eixo diagonal mais próximo
    if (r > R_RING && Math.min(Math.abs(x - z), Math.abs(x + z)) / Math.SQRT2 < 7 + 5) return false
    if (inSiteWalk(x, z)) return false
    if (isReserved(x, z, 3)) return false // os monumentos e as placas (garden-plan.ts)
    return true
  }
  const sample = (n: number, rMin: number, rMax: number, tries = 40): [number, number][] => {
    const out: [number, number][] = []
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < tries; t++) {
        const a = rnd() * Math.PI * 2
        const r = Math.sqrt(rMin * rMin + rnd() * (rMax * rMax - rMin * rMin))
        const x = Math.cos(a) * r, z = Math.sin(a) * r
        if (canGrow(x, z)) { out.push([x, z]); break }
      }
    }
    return out
  }

  // ── sebes aparadas: parterres em arcos concêntricos e linhas radiais ──────
  const hedgeGeo = track(new THREE.BoxGeometry(1, 1, 1))
  const hedgeMat = track(new THREE.MeshStandardMaterial({ color: HEDGE, roughness: 0.9 }))
  const hedges: THREE.Matrix4[] = []
  const hedgeArc = (r: number, a0: number, a1: number, h = 1.6, w = 1.4) => {
    const len = r * (a1 - a0)
    const n = Math.max(1, Math.round(len / 5.5)) // caixas de 6 m: metade das instâncias
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) / n) * (a1 - a0)
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      // o comprimento da caixa (x local) na TANGENTE do arco: rotation.y = −a + π/2
      // (com −a ela ficava radial e a sebe virava uma linha tracejada de lajes)
      o.position.set(x, yAt(x, z) + h / 2, z); o.rotation.set(0, -a + Math.PI / 2, 0); o.scale.set(6.0, h, w); o.updateMatrix()
      hedges.push(o.matrix.clone())
    }
  }
  const hedgeLine = (x0: number, z0: number, x1: number, z1: number, h = 1.6, w = 1.4) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 5.5))
    const yaw = Math.atan2(x1 - x0, z1 - z0)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
      o.position.set(x, yAt(x, z) + h / 2, z); o.rotation.set(0, yaw, 0); o.scale.set(w, h, Math.min(6.0, len / n + 0.4)); o.updateMatrix()
      hedges.push(o.matrix.clone())
    }
  }
  const gap = (r: number) => (BOULEVARD_W / 2 + 10) / r // meio-ângulo do bulevar radial em r
  // cinturão interno: dois arcos por quadrante, com sebes radiais nas pontas
  for (let q = 0; q < 4; q++) {
    const a0 = q * Math.PI / 2, a1 = a0 + Math.PI / 2
    for (const r of [R_GARDEN_IN + 14, R_GARDEN_IN + 62]) hedgeArc(r, a0 + gap(r), a1 - gap(r))
    for (const a of [a0 + gap(R_GARDEN_IN + 14), a1 - gap(R_GARDEN_IN + 14)]) {
      hedgeLine(Math.cos(a) * (R_GARDEN_IN + 14), Math.sin(a) * (R_GARDEN_IN + 14), Math.cos(a) * (R_GARDEN_IN + 62), Math.sin(a) * (R_GARDEN_IN + 62))
    }
    // as sebes que emolduram o bulevar radial e o anel
    const ea = a0 + gap(R_GARDEN_IN + 8) - 0.012, eb = a1 - gap(R_GARDEN_IN + 8) + 0.012
    hedgeLine(Math.cos(ea) * (R_GARDEN_IN + 4), Math.sin(ea) * (R_GARDEN_IN + 4), Math.cos(ea + 0.001) * (R_RING - RING_W / 2 - 4), Math.sin(ea + 0.001) * (R_RING - RING_W / 2 - 4), 1.2, 1.2)
    hedgeLine(Math.cos(eb) * (R_GARDEN_IN + 4), Math.sin(eb) * (R_GARDEN_IN + 4), Math.cos(eb) * (R_RING - RING_W / 2 - 4), Math.sin(eb) * (R_RING - RING_W / 2 - 4), 1.2, 1.2)
  }
  // setores externos: três arcos por quadrante, interrompidos nos sítios e nos espelhos
  for (let q = 0; q < 4; q++) {
    const a0 = q * Math.PI / 2, a1 = a0 + Math.PI / 2
    for (const r of [500, 560, 620, 690, 760, 830]) {
      const g = gap(r) + 0.02
      // divide o arco em trechos que não atravessam sítio, espelho ou fonte
      const n = 60
      let start: number | null = null
      for (let i = 0; i <= n; i++) {
        const a = a0 + g + ((a1 - a0 - 2 * g) * i) / n
        const x = Math.cos(a) * r, z = Math.sin(a) * r
        const ok = i < n && canGrow(x, z)
        if (ok && start == null) start = a
        if (!ok && start != null) { if (a - start > 0.03) hedgeArc(r, start, a); start = null }
      }
    }
  }
  const hedgeMesh = new THREE.InstancedMesh(hedgeGeo, hedgeMat, hedges.length)
  hedges.forEach((m, i) => hedgeMesh.setMatrixAt(i, m))
  hedgeMesh.instanceMatrix.needsUpdate = true
  hedgeMesh.receiveShadow = true // não projeta: milhares de caixinhas no mapa de sombra por nada
  group.add(hedgeMesh)
  cull(hedgeMesh)

  // ── palmeiras: alamedas nos bulevares e no anel, e bosques nos setores ────
  // as palmeiras dos SETORES continuam procedurais (ninguém chega perto); as das
  // alamedas e do anel viraram tamareiras de verdade (props-table.ts) quando
  // `realTrees` está ligado
  // No modo REAL a palmeira procedural (tronco de cilindro e nove fitas) saiu
  // por inteiro: as do fundo distante apareciam de perto na volta da Kray e eram
  // justamente as "murchas" que o fundador mandou tirar. O que sobra são as
  // tamareiras de verdade — as da tabela e as semeadas aqui, devolvidas em
  // `treeSpots`.
  const farPalms: [number, number][] = REAL ? sample(38, 620, 900) : []
  const palms: [number, number][] = REAL
    ? []
    : [...sample(70, R_GARDEN_IN + 20, 430), ...sample(150, 480, 900)]
  if (!REAL) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      for (let k = 0; k < 8; k++) {
        const r = R_GARDEN_IN + 16 + k * 16
        for (const sx of [-1, 1]) {
          const off = sx * (BOULEVARD_W / 2 + 7)
          palms.push([Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off])
        }
      }
    }
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2
      if (Math.abs(Math.sin(2 * a)) < 0.14) continue // deixa as portas dos bulevares livres
      for (const sr of [-1, 1]) {
        const r = R_RING + sr * (RING_W / 2 + 9)
        palms.push([Math.cos(a) * r, Math.sin(a) * r])
      }
    }
  }
  const trunkGeo = track(new THREE.CylinderGeometry(0.42, 0.7, 1, 8))
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.85 }))
  const frondGeo = track(makeFrondGeometry())
  const frondMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }))
  const FRONDS = 9
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length)
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palms.length * FRONDS)
  palms.forEach(([x, z], i) => {
    const h = 11 + rnd() * 9
    const y = yAt(x, z)
    o.position.set(x, y + h / 2, z); o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.06); o.scale.set(1, h, 1); o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
    for (let f = 0; f < FRONDS; f++) {
      const a = (f / FRONDS) * Math.PI * 2 + rnd() * 0.35
      const len = h * (0.42 + rnd() * 0.16)
      o.position.set(x, y + h, z); o.rotation.set(0, a, 0); o.scale.set(len, len, len); o.updateMatrix()
      fronds.setMatrixAt(i * FRONDS + f, o.matrix)
    }
  })
  trunks.castShadow = true // as folhas não: 2.700 fitas no mapa de sombra
  trunks.instanceMatrix.needsUpdate = fronds.instanceMatrix.needsUpdate = true
  group.add(trunks, fronds)

  // ── árvores: cinco espécies, nada em fila igual (praca-jardins.md §4) ─────
  // copa redonda e pinheiro-manso semeados nos setores, com a mistura mudando por
  // quadrante; cipreste italiano nas naves (White Paper, Satoshi), oliveira
  // prateada no Jardim Ordinal, flor branca na Pata de Diamante. Cada espécie é
  // um InstancedMesh (tronco + copa), escala e giro semeados.
  type Kind = 'round' | 'pine' | 'olive' | 'blossom' | 'cypress'
  const kindAt = (x: number, z: number): Kind => {
    const u = rnd()
    if (x > 0 && z < 0) return u < 0.42 ? 'pine' : 'round'          // NE: pinheiros na nave do White Paper
    if (x < 0 && z < 0) return u < 0.3 ? 'pine' : 'round'           // NW
    if (x < 0 && z > 0) return u < 0.5 ? 'olive' : u < 0.7 ? 'pine' : 'round' // SW: o jardim antigo
    return u < 0.32 ? 'blossom' : u < 0.5 ? 'pine' : 'round'         // SE: o único que floresce
  }
  // com as árvores de verdade nos lugares que se vê (props-table.ts), o gerador
  // procedural passa a ser só o fundo distante: 150 → 48 (item 11 do fundador,
  // "menos árvores, muito mais detalhadas")
  const planted: { kind: Kind; x: number; z: number }[] = REAL
    ? []
    : sample(150, 560, 900).map(([x, z]) => ({ kind: kindAt(x, z), x, z }))
  // ── as árvores dos setores, agora de verdade ──────────────────────────────
  // Mesma semeadura de antes (mesmo sorteio, mesmas zonas proibidas), mas cada
  // ponto vira um MODELO por quadrante: mediterrânea e bordo no norte, oliveira
  // e mediterrânea no sudoeste, cerejeira e bordo no sudeste. Menos árvores,
  // todas detalhadas — o item 11 da lista.
  const treeSpots: { file: string; at: [number, number][] }[] = []
  if (REAL) {
    const byFile: Record<string, [number, number][]> = {}
    const put = (file: string, p: [number, number]) => { (byFile[file] ??= []).push(p) }
    for (const [x, z] of sample(44, 560, 900)) {
      const u = rnd()
      if (x > 0 && z < 0) put(u < 0.45 ? 'tree-maple' : 'tree-medit', [x, z])        // NE, a nave do White Paper
      else if (x < 0 && z < 0) put(u < 0.35 ? 'tree-cypress' : 'tree-medit', [x, z]) // NW
      else if (x < 0 && z > 0) put(u < 0.5 ? 'tree-olive' : 'tree-medit', [x, z])    // SW, o jardim antigo
      else put(u < 0.4 ? 'tree-blossom' : 'tree-maple', [x, z])                      // SE, o que floresce
    }
    for (const [file, at] of Object.entries(byFile)) treeSpots.push({ file, at })
    if (farPalms.length) treeSpots.push({ file: 'palm-date', at: farPalms })
  }
  if (!REAL) {
    for (const [x, z] of WHITEPAPER_CYPRESSES) planted.push({ kind: 'cypress', x, z })
    for (const [x, z] of SATOSHI_CYPRESSES) planted.push({ kind: 'cypress', x, z })
    for (const [x, z] of ORDINAL_OLIVES) planted.push({ kind: 'olive', x, z })
    for (const [x, z] of PAW_BLOSSOMS) planted.push({ kind: 'blossom', x, z })
  }

  const treeTrunkGeo = track(new THREE.CylinderGeometry(0.5, 0.9, 1, 7))
  const canopyGeo = track(new THREE.SphereGeometry(1, 12, 9))
  const cypressGeo = track((() => {
    const pts = [[0, 0], [0.55, 0.04], [0.92, 0.22], [1, 0.42], [0.86, 0.66], [0.5, 0.88], [0.12, 0.98], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y))
    return new THREE.LatheGeometry(pts, 9)
  })())
  const mats: Record<Kind, THREE.MeshStandardMaterial> = {
    round: track(new THREE.MeshStandardMaterial({ color: LEAF, roughness: 0.9 })),
    pine: track(new THREE.MeshStandardMaterial({ color: 0x24462c, roughness: 0.92 })),
    olive: track(new THREE.MeshStandardMaterial({ color: 0x77846a, roughness: 1 })),
    blossom: track(new THREE.MeshStandardMaterial({ color: 0xe4dcd8, roughness: 0.85 })),
    cypress: track(new THREE.MeshStandardMaterial({ color: 0x1b3320, roughness: 0.95 })),
  }
  const byKind = (k: Kind) => planted.filter((p) => p.kind === k)
  const tTrunks = new THREE.InstancedMesh(treeTrunkGeo, trunkMat, planted.length)
  let ti = 0
  const trunkAt = (x: number, z: number, h: number, w = 1) => {
    o.position.set(x, yAt(x, z) + h / 2, z); o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.05); o.scale.set(w, h, w); o.updateMatrix()
    tTrunks.setMatrixAt(ti++, o.matrix)
  }
  for (const k of ['round', 'pine', 'olive', 'blossom'] as Kind[]) {
    const list = byKind(k)
    const canopies = new THREE.InstancedMesh(canopyGeo, mats[k], Math.max(1, list.length))
    list.forEach((p, i) => {
      const y = yAt(p.x, p.z)
      if (k === 'round') {
        const h = 5.5 + rnd() * 5.5, cr = 3.6 + rnd() * 3.8
        trunkAt(p.x, p.z, h)
        o.position.set(p.x, y + h + cr * 0.72, p.z); o.rotation.set(0, rnd() * 6.28, 0); o.scale.set(cr * (0.9 + rnd() * 0.2), cr * (0.8 + rnd() * 0.15), cr * (0.9 + rnd() * 0.2)); o.updateMatrix()
      } else if (k === 'pine') {
        const h = 8 + rnd() * 4, cr = 6 + rnd() * 3.5
        trunkAt(p.x, p.z, h, 1.2)
        o.position.set(p.x, y + h + 1.2, p.z); o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.12); o.scale.set(cr, 2.2 + rnd() * 0.8, cr * (0.85 + rnd() * 0.3)); o.updateMatrix()
      } else if (k === 'olive') {
        const h = 3.2 + rnd() * 1.6, cr = 3.6 + rnd() * 1.8
        trunkAt(p.x, p.z, h, 1.5)
        o.position.set(p.x, y + h + cr * 0.6, p.z); o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.25); o.scale.set(cr * (0.85 + rnd() * 0.3), cr * 0.75, cr * (0.85 + rnd() * 0.3)); o.updateMatrix()
      } else {
        const h = 4 + rnd() * 1.6, cr = 3.8 + rnd() * 1.6
        trunkAt(p.x, p.z, h)
        o.position.set(p.x, y + h + cr * 0.7, p.z); o.rotation.set(0, rnd() * 6.28, 0); o.scale.set(cr, cr * 0.9, cr * (0.9 + rnd() * 0.2)); o.updateMatrix()
      }
      canopies.setMatrixAt(i, o.matrix)
    })
    canopies.count = list.length
    canopies.castShadow = canopies.receiveShadow = true
    canopies.instanceMatrix.needsUpdate = true
    canopies.name = `Trees_${k}`
    group.add(canopies)
  }
  {
    const list = byKind('cypress')
    const cyp = new THREE.InstancedMesh(cypressGeo, mats.cypress, Math.max(1, list.length))
    list.forEach((p, i) => {
      const h = 15 + rnd() * 7, r = 1.5 + rnd() * 0.5
      trunkAt(p.x, p.z, 1.2, 0.8)
      o.position.set(p.x, yAt(p.x, p.z) + 0.6, p.z); o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.03); o.scale.set(r, h, r); o.updateMatrix()
      cyp.setMatrixAt(i, o.matrix)
    })
    cyp.count = list.length
    cyp.castShadow = cyp.receiveShadow = true
    cyp.instanceMatrix.needsUpdate = true
    cyp.name = 'Trees_cypress'
    group.add(cyp)
  }
  tTrunks.count = ti
  tTrunks.castShadow = true
  tTrunks.instanceMatrix.needsUpdate = true
  group.add(tTrunks)

  // ── topiaria: esferas aparadas nas esquinas dos parterres e ao longo do anel ──
  const topi: [number, number][] = []
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2 + Math.PI / 48
    if (Math.abs(Math.sin(2 * a)) < 0.16) continue
    topi.push([Math.cos(a) * (R_GARDEN_IN + 38), Math.sin(a) * (R_GARDEN_IN + 38)])
  }
  const topiMesh = new THREE.InstancedMesh(canopyGeo, track(new THREE.MeshStandardMaterial({ color: HEDGE, roughness: 0.9 })), topi.length)
  topi.forEach(([x, z], i) => {
    const r = 1.6 + rnd() * 0.6
    o.position.set(x, yAt(x, z) + r, z); o.rotation.set(0, 0, 0); o.scale.setScalar(r); o.updateMatrix()
    topiMesh.setMatrixAt(i, o.matrix)
  })
  topiMesh.instanceMatrix.needsUpdate = true
  group.add(topiMesh)
  cull(topiMesh)

  // ── bancos ao longo do anel, olhando para dentro ─────────────────────────
  const benchGeo = track(new THREE.BoxGeometry(4.2, 0.5, 1))
  const benchMat = track(new THREE.MeshStandardMaterial({ color: 0x2b2a2f, roughness: 0.6, metalness: 0.3 }))
  const benches = new THREE.InstancedMesh(benchGeo, benchMat, REAL ? 0 : 40)
  for (let k = 0; k < (REAL ? 0 : 40); k++) {
    const a = (k / 40) * Math.PI * 2 + Math.PI / 40
    const r = R_RING - RING_W / 2 + 3
    o.position.set(Math.cos(a) * r, yAt(Math.cos(a) * r, Math.sin(a) * r) + 0.6, Math.sin(a) * r); o.rotation.set(0, -a, 0); o.scale.setScalar(1); o.updateMatrix()
    benches.setMatrixAt(k, o.matrix)
  }
  benches.instanceMatrix.needsUpdate = true
  group.add(benches)
  cull(benches, SMALL * 0.7)
  // os dois bancos de pedra de frente para o Espelho de Satoshi
  {
    const sb = new THREE.InstancedMesh(track(new THREE.BoxGeometry(5, 0.55, 1.2)), benchMat, SATOSHI_BENCHES.length)
    SATOSHI_BENCHES.forEach(([x, z], i) => {
      o.position.set(x, yAt(x, z) + 0.6, z); o.rotation.set(0, -Math.atan2(z, x) + Math.PI / 2, 0); o.scale.setScalar(1); o.updateMatrix()
      sb.setMatrixAt(i, o.matrix)
    })
    sb.instanceMatrix.needsUpdate = true
    group.add(sb)
    cull(sb, SMALL * 0.7)
  }

  // ── luz de jardim: uplights quentes na base das palmeiras das alamedas ───
  // No modo REAL o array procedural está vazio, então os uplights seguem as
  // árvores DE VERDADE (as semeadas nos setores e as tamareiras do fundo). Sem
  // isto, tirar a palmeira procedural apagou de uma vez toda a luz de jardim.
  const glowSpots: [number, number][] = palms.length
    ? palms
    : treeSpots.flatMap((t) => t.at)
  const glowTex = makeGlowTexture()
  const upPos = new Float32Array(glowSpots.length * 3)
  glowSpots.forEach(([x, z], i) => { upPos[i * 3] = x; upPos[i * 3 + 1] = yAt(x, z) + 1.2; upPos[i * 3 + 2] = z })
  const upGeo = track(new THREE.BufferGeometry())
  upGeo.setAttribute('position', new THREE.BufferAttribute(upPos, 3))
  const uplights = new THREE.Points(upGeo, track(new THREE.PointsMaterial({ map: glowTex, color: 0xffd9a8, size: 12, sizeAttenuation: true, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending })))
  uplights.frustumCulled = false
  group.add(uplights)
  cull(uplights, SMALL)

  // ── a grande fonte do norte, no lugar da quarta âncora ───────────────────
  const fountain = buildGrandFountain(rnd, track, jetTex, Math.round(((opts.profile?.jetParticles ?? 900) * 16) / 9))
  const fy = yAt(0, -R_ANCHOR)
  fountain.group.position.set(0, fy, -R_ANCHOR)
  group.add(fountain.group)

  // ⚠️ A GRANDE FONTE TINHA DUAS LUZES A METROS UMA DA OUTRA, e agora tem uma.
  //
  // Havia esta, pendurada em (0, y+26, -R_ANCHOR), e outra DENTRO de
  // `buildGrandFountain`, em y 24, acendendo a mesma peça a poucos metros de
  // distância. Duas PointLight custam o dobro em todo fragmento iluminado da
  // cena inteira, não só ali: o preço é malhas vezes luzes. A de dentro ficou,
  // porque ela já pulsa com a água e mora no objeto que ela acende, e recebeu a
  // intensidade das duas somada.
  //
  // Os jardins continuam sendo acesos pelos monumentos e pelas poças de luz
  // (light-pool.ts), que é o que faz a cidade parecer acesa sem cobrar por pixel.
  const lights: THREE.PointLight[] = []

  const update = (t: number) => {
    // fontes: cada partícula sobe e cai numa parábola, com fase própria
    for (const j of jets) {
      const seed = j.userData.seed as Float32Array
      const pa = j.geometry.attributes.position as THREE.BufferAttribute
      const n = pa.count
      const noCenter = j.userData.noCenter === true
      for (let k = 0; k < n; k++) {
        const u = (t * 0.55 + seed[k * 2]) % 1
        const ring = !noCenter && k % 5 === 0 ? 0 : 1
        const ang = seed[k * 2 + 1] * Math.PI * 2
        const rr = ring === 0 ? 1.5 * u * 6 : 26 + u * 10
        const h = ring === 0 ? 46 * Math.sin(u * Math.PI) : 16 * Math.sin(u * Math.PI)
        pa.setXYZ(k, Math.cos(ang) * rr, h, Math.sin(ang) * rr)
      }
      pa.needsUpdate = true
    }
    fountain.update(t)
    for (const l of lights) l.intensity = 1.1 * (0.92 + 0.08 * Math.sin(t * 0.9 + l.position.x))
  }

  // ── funde o pavimento, os meios-fios e os gramados: uma malha por material ──
  // Eram ~90 malhas planas (anéis, radiais, alamedas, passeios, calçadas dos lotes);
  // viram três chamadas de desenho. As geometrias originais são descartadas.
  group.updateMatrixWorld(true)
  const mergeByMaterial = (mat: THREE.Material, name: string) => {
    const parts: THREE.BufferGeometry[] = []
    const dead: THREE.Mesh[] = []
    group.traverse((o) => {
      const m = o as THREE.Mesh & { isInstancedMesh?: boolean }
      if (!m.isMesh || m.isInstancedMesh || m.material !== mat) return
      const g = m.geometry.clone()
      // sem uv e sem tangentes: só posição e normal, para todas fundirem
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a)
      g.applyMatrix4(m.matrixWorld)
      parts.push(g)
      dead.push(m)
    })
    if (parts.length < 2) { for (const g of parts) g.dispose(); return }
    const merged = mergeGeometries(parts, false)
    for (const g of parts) g.dispose()
    if (!merged) return
    for (const m of dead) m.removeFromParent()
    const mesh = new THREE.Mesh(track(merged), mat)
    mesh.receiveShadow = true
    mesh.name = name
    group.add(mesh)
  }
  mergeByMaterial(paveMat, 'Paving')
  mergeByMaterial(kerbMat, 'Kerbs')
  mergeByMaterial(lawnMat, 'Lawns')

  return {
    group,
    update,
    treeSpots,
    dispose() { for (const d of disposables) d.dispose(); jetTex.dispose(); glowTex.dispose(); fountain.dispose() },
  }
}

// ── peças ──────────────────────────────────────────────────────────────────────

/** Uma folha de tamareira: uma fita que sobe e se dobra para fora e para baixo,
 *  com cor mais forte na base e clara na ponta (vertex color). Escala 1 = 1 m. */
function makeFrondGeometry(): THREE.BufferGeometry {
  const SEG = 10
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const w0 = 0.09
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG
    // arco: sobe, dobra e cai
    const x = Math.sin(u * 1.35) * 0.9
    const y = 0.35 * Math.sin(u * Math.PI * 0.85) - u * u * 0.55
    const w = w0 * (1 - u * 0.7)
    pos.push(x, y, -w, x, y, w)
    const c = LEAF.clone().lerp(LEAF_TIP, u)
    col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    if (i < SEG) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function makeDotTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

/** A grande fonte do norte: uma bacia larga com um jato central alto e um anel de
 *  jatos, coroada por um anel de palmeiras; o marco de palácio no ponto cardeal
 *  cuja âncora ainda não existe. */
function buildGrandFountain(rnd: () => number, track: <T extends { dispose: () => void }>(o: T) => T, jetTex: THREE.Texture, jatos: number) {
  const group = new THREE.Group()
  group.name = 'GrandFountain'
  const R = 70
  const basin = new THREE.Mesh(track(new THREE.CylinderGeometry(R, R + 1.5, 2.2, 96)), track(new THREE.MeshStandardMaterial({ color: 0x1b1a1e, roughness: 0.6, metalness: 0.2 })))
  basin.position.y = 1.1
  basin.receiveShadow = true
  group.add(basin)
  const water = new THREE.Mesh(track(new THREE.CircleGeometry(R - 2, 96)), track(new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.05, metalness: 0.7, emissive: 0x0b1a2c, emissiveIntensity: 0.4, envMapIntensity: 1.6 })))
  water.rotation.x = -Math.PI / 2
  water.position.y = 2.0
  group.add(water)
  const rim = new THREE.Mesh(track(new THREE.RingGeometry(R - 0.8, R, 128)), track(new THREE.MeshBasicMaterial({ color: ICE, toneMapped: false, transparent: true, opacity: 0.8, side: THREE.DoubleSide })))
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 2.25
  group.add(rim)
  // taça central em dois níveis
  for (const [r, y] of [[16, 8], [9, 15]] as const) {
    const cup = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r * 0.55, 1.6, 48)), basin.material as THREE.Material)
    cup.position.y = y
    group.add(cup)
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(2.2, 2.8, y - 2, 12)), basin.material as THREE.Material)
    stem.position.y = (y - 2) / 2 + 2
    group.add(stem)
  }
  // jatos: um central alto, um anel médio, um anel baixo na borda
  //
  // ⚠️ ERA `1600` FIXO, E ESTA ERA A MAIOR FONTE DA CENA DESOBEDECENDO O PERFIL.
  // Os quatro espelhos das diagonais já liam `jetParticles` desde sempre (600 no
  // celular contra 900 no desktop), e só esta, que é a mais pesada das cinco,
  // ficava de fora: o telefone reescrevia 1.600 posições por quadro, a conta
  // inteira do desktop. Somando as cinco eram 4.000 partículas e cerca de 12 mil
  // senos e cossenos POR QUADRO num aparelho que já não abria.
  //
  // O fator 16/9 preserva o desktop EXATO: `jetParticles` 900 devolve 1.600,
  // bit a bit o que era. No celular 600 devolve 1.067, e no `low` 300 devolve 533.
  const NJ = jatos
  const pos = new Float32Array(NJ * 3)
  const seed = new Float32Array(NJ * 2)
  for (let k = 0; k < NJ; k++) { seed[k * 2] = rnd(); seed[k * 2 + 1] = rnd() }
  const geo = track(new THREE.BufferGeometry())
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pts = new THREE.Points(geo, track(new THREE.PointsMaterial({ map: jetTex, color: WATER_JET, size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })))
  pts.frustumCulled = false
  pts.position.y = 2
  group.add(pts)
  // anel de palmeiras em volta, no gramado
  const trunkGeo = track(new THREE.CylinderGeometry(0.42, 0.7, 1, 8))
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.85 }))
  const frondGeo = track(makeFrondGeometry())
  const frondMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }))
  const NPALM = 20, FR = 9
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, NPALM)
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, NPALM * FR)
  const o = new THREE.Object3D()
  for (let i = 0; i < NPALM; i++) {
    const a = (i / NPALM) * Math.PI * 2
    if (Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) > 0) continue // a boca do bulevar
    const x = Math.cos(a) * (R + 22), z = Math.sin(a) * (R + 22)
    const h = 15 + rnd() * 5
    o.position.set(x, h / 2, z); o.rotation.set(0, rnd() * 6, 0); o.scale.set(1, h, 1); o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
    for (let f = 0; f < FR; f++) {
      const fa = (f / FR) * Math.PI * 2 + rnd() * 0.3
      const len = h * 0.5
      o.position.set(x, h, z); o.rotation.set(0, fa, 0); o.scale.set(len, len, len); o.updateMatrix()
      fronds.setMatrixAt(i * FR + f, o.matrix)
    }
  }
  trunks.instanceMatrix.needsUpdate = fronds.instanceMatrix.needsUpdate = true
  trunks.castShadow = fronds.castShadow = true
  group.add(trunks, fronds)
  // 2,0 mais os 1,1 da luz externa que foi retirada: a fonte continua com a
  // mesma presença de luz, com metade do custo.
  const light = new THREE.PointLight(0xffe4c0, 3.1, 380, 1.4)
  light.position.y = 24
  group.add(light)
  return {
    group,
    update(t: number) {
      const a = geo.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < NJ; k++) {
        const u = (t * 0.5 + seed[k * 2]) % 1
        const kind = k % 8 === 0 ? 0 : k % 8 < 4 ? 1 : 2
        const ang = seed[k * 2 + 1] * Math.PI * 2
        const rr = kind === 0 ? u * 5 : kind === 1 ? 16 + u * 14 : R - 6 - u * 10
        const h = kind === 0 ? 62 * Math.sin(u * Math.PI) : kind === 1 ? 24 * Math.sin(u * Math.PI) : 10 * Math.sin(u * Math.PI)
        a.setXYZ(k, Math.cos(ang) * rr, (kind === 0 ? 16 : kind === 1 ? 8 : 0) + h, Math.sin(ang) * rr)
      }
      a.needsUpdate = true
      light.intensity = 2.0 * (0.92 + 0.08 * Math.sin(t * 0.8))
    },
    dispose() {},
  }
}
