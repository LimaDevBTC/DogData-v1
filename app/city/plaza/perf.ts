// Desempenho (o brief do fundador: "tá muito pesado, a imagem chega a travar").
// O que os jogos pesados fazem, e o que cabe aqui:
//
//   1. NÍVEIS DE QUALIDADE por aparelho (tier): no celular, menos pixels (DPR
//      1,5), sombra menor e sem PCF suave, sem os 111 mil pontos do censo, metade
//      das partículas das fontes; no desktop, tudo.
//   2. RESOLUÇÃO DINÂMICA: mede o tempo de quadro e baixa o DPR quando o quadro
//      passa de ~24 ms (e sobe de volta quando sobra); é o que consoles fazem para
//      segurar 60/30 fps sem trocar de cena.
//   3. ORÇAMENTO DE LUZES: cada PointLight custa em TODOS os fragmentos da cena;
//      a praça tinha ~30. Fica ≤ 10 (o resto vira emissão/uplights pintados).
//   4. CULLING POR DISTÂNCIA (LOD grosso): o que é pequeno some longe (sebes,
//      placas, bancos, postes, painéis), o parque só de perto; sombras só de quem
//      é grande. Nada disso muda a imagem de perto; muda o custo de longe.
//   5. INSTÂNCIAS e MALHAS FUNDIDAS: uma chamada de desenho por família.
//
// Este módulo é o (1), (2) e a régua do (4). O resto está nos módulos das peças.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type Tier = 'mobile' | 'desktop'
export type Quality = 'high' | 'balanced' | 'low'

export interface PerfProfile {
  tier: Tier
  quality: Quality
  /** teto e piso da resolução dinâmica (DPR); o piso é alto de propósito: DPR é o
   *  ÚLTIMO recurso, não o primeiro (o fundador viu a praça virar pixel art) */
  maxPixelRatio: number
  minPixelRatio: number
  antialias: boolean
  shadowMapSize: number
  softShadows: boolean
  /** 1 = mapa de sombra a cada quadro; 2 = quadro sim, quadro não (o governador sobe isto antes de baixar o DPR) */
  shadowUpdateEvery: 1 | 2
  censusPoints: boolean
  jetParticles: number
  /** distância (m) a partir da qual o miúdo do jardim some */
  smallCull: number
  /** distância a partir da qual as placas e painéis com texto somem */
  textCull: number
  /** distância do CENTRO DO PARQUE a partir da qual as trilhas/templo/censo somem */
  parkDetailCull: number
  /** distância a partir da qual as torres trocam para o LOD1 decimado */
  lodDistance: number
  /** frações de cristais do parque por faixa de distância (perto, médio, longe, horizonte) */
  crystalLod: [number, number, number, number]
}

export function detectTier(): Tier {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const touch = (navigator.maxTouchPoints || 0) > 1
  const small = Math.min(window.innerWidth, window.innerHeight) < 820
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && small)) return 'mobile'
  return 'desktop'
}

export function parseQuality(q: string | null | undefined): Quality {
  return q === 'high' || q === 'low' ? q : 'balanced'
}

/** Os três níveis (praca-central.md §4.5, Quality Pass): BALANCED é o padrão,
 *  bonito e fluido; HIGH é o modo cinematográfico; LOW é para máquina fraca.
 *  As otimizações estruturais (batching, instâncias, culling, LOD, atlas) valem
 *  nos três; o que muda é o quanto cada uma aperta. */
export function profileFor(tier: Tier, quality: Quality = 'balanced'): PerfProfile {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const mobile = tier === 'mobile'
  if (quality === 'high') {
    return {
      tier, quality, maxPixelRatio: Math.min(dpr, 3), minPixelRatio: 1.5, antialias: true,
      shadowMapSize: 2048, softShadows: true, shadowUpdateEvery: 1,
      censusPoints: true, jetParticles: 900, smallCull: 3400, textCull: 1700, parkDetailCull: 3800, lodDistance: 4800,
      crystalLod: [1, 0.6, 0.3, 0.15],
    }
  }
  if (quality === 'low') {
    return {
      tier, quality, maxPixelRatio: 1.25, minPixelRatio: 0.9, antialias: true,
      shadowMapSize: 1024, softShadows: false, shadowUpdateEvery: 2,
      censusPoints: false, jetParticles: 300, smallCull: 1200, textCull: 600, parkDetailCull: 2200, lodDistance: 1300,
      crystalLod: [0.6, 0.2, 0.1, 0.05],
    }
  }
  // balanced
  return mobile
    ? {
      tier, quality, maxPixelRatio: 2, minPixelRatio: 1.25, antialias: true,
      shadowMapSize: 2048, softShadows: false, shadowUpdateEvery: 1,
      censusPoints: false, jetParticles: 600, smallCull: 2200, textCull: 1000, parkDetailCull: 2800, lodDistance: 2600,
      crystalLod: [1, 0.3, 0.15, 0.08],
    }
    : {
      tier, quality, maxPixelRatio: 2, minPixelRatio: 1.25, antialias: true,
      shadowMapSize: 2048, softShadows: true, shadowUpdateEvery: 1,
      censusPoints: true, jetParticles: 900, smallCull: 2600, textCull: 1300, parkDetailCull: 3000, lodDistance: 3200,
      crystalLod: [1, 0.35, 0.15, 0.08],
    }
}

/** O governador de quadro: mede o tempo de cada quadro (fora dos primeiros 8 s de
 *  carga) e, quando fica claramente abaixo de 30 fps por 2,5 s, degrada NA ORDEM
 *  em que menos se percebe: 1) mapa de sombra a cada dois quadros; 2) DPR em
 *  passos de 10 % até o piso do perfil. Quando sobra, volta na ordem inversa. */
export class FrameGovernor {
  private acc = 0
  private n = 0
  private since = 0
  private readonly born: number
  private dpr: number
  shadowEvery: 1 | 2
  constructor(private renderer: THREE.WebGLRenderer, private profile: PerfProfile, private onChange?: (dpr: number, shadowEvery: number) => void) {
    this.dpr = Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio)
    this.shadowEvery = profile.shadowUpdateEvery
    renderer.setPixelRatio(this.dpr)
    this.born = performance.now()
  }
  get pixelRatio() { return this.dpr }
  sample(dtMs: number, now: number) {
    if (now - this.born < 8000) return
    this.acc += dtMs; this.n++
    if (this.since === 0) this.since = now
    if (now - this.since < 2500 || this.n < 30) return
    const avg = this.acc / this.n
    this.acc = 0; this.n = 0; this.since = now
    let changed = false
    if (avg > 36) {
      if (this.shadowEvery === 1) { this.shadowEvery = 2; changed = true }
      else if (this.dpr > this.profile.minPixelRatio + 0.01) { this.dpr = Math.max(this.profile.minPixelRatio, this.dpr * 0.9); this.renderer.setPixelRatio(this.dpr); changed = true }
    } else if (avg < 20) {
      const cap = Math.min(this.profile.maxPixelRatio, window.devicePixelRatio || 1)
      if (this.dpr < cap - 0.01) { this.dpr = Math.min(cap, this.dpr * 1.08); this.renderer.setPixelRatio(this.dpr); changed = true }
      else if (this.shadowEvery === 2 && this.profile.shadowUpdateEvery === 1) { this.shadowEvery = 1; changed = true }
    }
    if (changed) this.onChange?.(this.dpr, this.shadowEvery)
  }
}

/** Culling por distância: registra objetos com um raio de "vale a pena desenhar";
 *  `update(cameraPos)` liga/desliga. Barato: uma distância por grupo. */
export class DistanceCuller {
  private items: { o: THREE.Object3D; center: THREE.Vector3; maxDist: number }[] = []
  add(o: THREE.Object3D, maxDist: number, center?: THREE.Vector3) {
    this.items.push({ o, center: center ?? new THREE.Vector3(), maxDist })
  }
  update(cam: THREE.Vector3) {
    for (const it of this.items) {
      const on = cam.distanceTo(it.center) < it.maxDist
      if (it.o.visible !== on) it.o.visible = on
    }
  }
}

/** Funde, por material, as malhas ESTÁTICAS de uma hierarquia (um GLB): 50 chamadas
 *  de desenho viram 8. `keep` casa com os nomes que não podem fundir (nós
 *  animados: giram, sobem, escalam) e nada abaixo deles é tocado. As matrizes de
 *  mundo entram na geometria; as originais são removidas. */
export function mergeStaticByMaterial(root: THREE.Object3D, keep: RegExp): { before: number; after: number } {
  root.updateMatrixWorld(true)
  const skip = new Set<THREE.Object3D>()
  root.traverse((o) => { if (keep.test(o.name)) o.traverse((c) => skip.add(c)) })
  const groups = new Map<string, { mat: THREE.Material; meshes: THREE.Mesh[] }>()
  let before = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean }
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || skip.has(o)) return
    if (Array.isArray(m.material)) return
    before++
    const key = (m.material as THREE.Material).uuid
    const g = groups.get(key) ?? { mat: m.material as THREE.Material, meshes: [] }
    g.meshes.push(m)
    groups.set(key, g)
  })
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  let after = 0
  for (const { mat, meshes } of Array.from(groups.values())) {
    if (meshes.length < 2) { after += meshes.length; continue }
    const parts: THREE.BufferGeometry[] = []
    const hasUv = meshes.some((m: THREE.Mesh) => !!m.geometry.attributes.uv)
    for (const m of meshes) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a)
      if (!g.attributes.normal) g.computeVertexNormals()
      if (hasUv && !g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
      if (!hasUv && g.attributes.uv) g.deleteAttribute('uv')
      // no quadro do root: mundo → local do root
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
      parts.push(g)
    }
    const merged = mergeGeometries(parts, false)
    for (const g of parts) g.dispose()
    if (!merged) { after += meshes.length; continue }
    for (const m of meshes) m.removeFromParent()
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = `merged:${mat.name || mat.uuid.slice(0, 6)}`
    root.add(mesh)
    after++
  }
  return { before, after }
}
