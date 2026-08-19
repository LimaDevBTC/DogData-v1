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

export interface PerfProfile {
  tier: Tier
  maxPixelRatio: number
  /** a resolução dinâmica nunca desce abaixo disto */
  minPixelRatio: number
  antialias: boolean
  /** distância a partir da qual as torres trocam para o LOD1 decimado */
  lodDistance: number
  shadowMapSize: number
  softShadows: boolean
  censusPoints: boolean
  jetParticles: number
  /** distância (m) a partir da qual o miúdo do jardim some */
  smallCull: number
  /** distância a partir da qual as placas e painéis com texto somem */
  textCull: number
  /** distância do CENTRO DO PARQUE a partir da qual as trilhas/templo/censo somem */
  parkDetailCull: number
}

export function detectTier(): Tier {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const touch = (navigator.maxTouchPoints || 0) > 1
  const small = Math.min(window.innerWidth, window.innerHeight) < 820
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && small)) return 'mobile'
  return 'desktop'
}

export function profileFor(tier: Tier): PerfProfile {
  // O meio-termo (fundador, 2026-08-18): a primeira versão do celular baixava a
  // resolução até 0,7 e sem antialiasing virava pixel art; ficou rápido e feio.
  // Agora o celular renderiza até 2× (não os 3× nativos), nunca abaixo de 1×,
  // com MSAA (barato nas GPUs de celular, que são tile-based) e sombra 1024.
  return tier === 'mobile'
    ? { tier, maxPixelRatio: 2, minPixelRatio: 1, antialias: true, shadowMapSize: 1024, softShadows: false, censusPoints: false, jetParticles: 500, smallCull: 1800, textCull: 900, parkDetailCull: 2800, lodDistance: 2300 }
    : { tier, maxPixelRatio: 2, minPixelRatio: 1, antialias: true, shadowMapSize: 2048, softShadows: true, censusPoints: true, jetParticles: 900, smallCull: 2600, textCull: 1300, parkDetailCull: 3000, lodDistance: 2300 }
}
/** ?quality=high|balanced|low sobrepõe o tier (para o fundador testar no celular) */
export function applyQualityOverride(p: PerfProfile, q: string | null): PerfProfile {
  if (q === 'high') return { ...p, maxPixelRatio: Math.min(3, window.devicePixelRatio || 2), minPixelRatio: 1.5, shadowMapSize: 2048, softShadows: true, censusPoints: true, jetParticles: 900, smallCull: 2600, textCull: 1300, lodDistance: 2600 }
  if (q === 'low') return { ...p, maxPixelRatio: 1.25, minPixelRatio: 0.85, antialias: false, shadowMapSize: 1024, softShadows: false, censusPoints: false, jetParticles: 300, smallCull: 1200, textCull: 600, lodDistance: 1200 }
  return p
}

/** Resolução dinâmica: chama `sample(dtMs)` por quadro; ajusta o DPR do renderer
 *  a cada ~2 s dentro de [0,7, max]. */
export class DynamicResolution {
  private acc = 0
  private n = 0
  private since = 0
  private dpr: number
  private readonly born: number
  constructor(private renderer: THREE.WebGLRenderer, private max: number, private min = 1, private onChange?: (dpr: number) => void) {
    this.dpr = Math.min(window.devicePixelRatio || 1, max)
    renderer.setPixelRatio(this.dpr)
    this.born = performance.now()
  }
  get current() { return this.dpr }
  sample(dtMs: number, now: number) {
    // os primeiros 8 s são carga e compilação: não contam
    if (now - this.born < 8000) return
    this.acc += dtMs; this.n++
    if (this.since === 0) this.since = now
    if (now - this.since < 2500 || this.n < 30) return
    const avg = this.acc / this.n
    this.acc = 0; this.n = 0; this.since = now
    let next = this.dpr
    // só desce se estiver claramente abaixo de 30 fps; sobe devagar quando sobra
    if (avg > 36) next = Math.max(this.min, this.dpr * 0.88)
    else if (avg < 20) next = Math.min(this.max, Math.min(window.devicePixelRatio || 1, this.dpr * 1.08))
    if (Math.abs(next - this.dpr) > 0.02) {
      this.dpr = next
      this.renderer.setPixelRatio(next)
      this.onChange?.(next)
    }
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
