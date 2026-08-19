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

export type Tier = 'mobile' | 'desktop'

export interface PerfProfile {
  tier: Tier
  maxPixelRatio: number
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
  return tier === 'mobile'
    ? { tier, maxPixelRatio: 1.5, shadowMapSize: 1024, softShadows: false, censusPoints: false, jetParticles: 400, smallCull: 1400, textCull: 700, parkDetailCull: 2600 }
    : { tier, maxPixelRatio: 2, shadowMapSize: 2048, softShadows: true, censusPoints: true, jetParticles: 900, smallCull: 2600, textCull: 1300, parkDetailCull: 4200 }
}

/** Resolução dinâmica: chama `sample(dtMs)` por quadro; ajusta o DPR do renderer
 *  a cada ~2 s dentro de [0,7, max]. */
export class DynamicResolution {
  private acc = 0
  private n = 0
  private since = 0
  private dpr: number
  constructor(private renderer: THREE.WebGLRenderer, private max: number, private onChange?: (dpr: number) => void) {
    this.dpr = Math.min(window.devicePixelRatio || 1, max)
    renderer.setPixelRatio(this.dpr)
  }
  get current() { return this.dpr }
  sample(dtMs: number, now: number) {
    this.acc += dtMs; this.n++
    if (this.since === 0) this.since = now
    if (now - this.since < 2000 || this.n < 20) return
    const avg = this.acc / this.n
    this.acc = 0; this.n = 0; this.since = now
    let next = this.dpr
    if (avg > 26) next = Math.max(0.7, this.dpr * 0.85)
    else if (avg < 14) next = Math.min(this.max, Math.min(window.devicePixelRatio || 1, this.dpr * 1.1))
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
