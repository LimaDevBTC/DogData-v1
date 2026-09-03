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
  /**
   * ⚠️ O LADO DA CÉLULA DA ABÓBADA (m), E ELE É O BOTÃO DE CUSTO MAIS PESADO DA
   * CENA. Medido em 31/08 com célula 42: a casca sozinha é 2.105.493 triângulos,
   * 54% dos 3.879.647 da praça inteira, em 4 malhas. O número de células cai com
   * o QUADRADO do lado, então 42 → 84 divide o custo por quatro.
   *
   * ⚠️ E O TRIÂNGULO NÃO É O PIOR. O vidro é transparente com mistura aditiva,
   * ou seja ele repinta a tela inteira por cima de tudo: no celular quem dói é
   * a taxa de preenchimento, não a geometria. Por isso o celular leva a célula
   * mais larga mesmo tendo triângulo de sobra.
   */
  domeCell: number
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
      crystalLod: [1, 0.6, 0.3, 0.15], domeCell: 42,
    }
  }
  if (quality === 'low') {
    return {
      tier, quality, maxPixelRatio: 1.25, minPixelRatio: 0.9, antialias: true,
      shadowMapSize: 1024, softShadows: false, shadowUpdateEvery: 2,
      censusPoints: false, jetParticles: 300, smallCull: 1200, textCull: 600, parkDetailCull: 2200, lodDistance: 1300,
      crystalLod: [0.6, 0.2, 0.1, 0.05], domeCell: 130,
    }
  }
  // balanced
  return mobile
    ? {
      // ⚠️ ESTE PERFIL ERA UM DESKTOP COM SOMBRA MOLE, E O CELULAR MORRIA NELE.
      //
      // Medido em 03/09 contra produção, com iPhone 13 emulado: o telefone
      // recebia 233 texturas, 455 MB de VRAM e 5,3 M de triângulos, ou seja
      // EXATAMENTE a carga do desktop, e ainda desenhava em `dpr 2`. O fundador
      // relatou a consequência: a barra chega a 68%, trava, reinicia e dá erro
      // de cliente. Isso é o navegador do celular derrubando o contexto WebGL
      // por falta de memória, e ele não avisa antes.
      //
      // O que este perfil cortava era CUSTO DE DESENHO (sombra suave, pontos de
      // censo), que é o eixo errado: o telefone não estava lento, estava sem
      // memória. Os dois números abaixo são de MEMÓRIA e por isso mudaram:
      //
      //   · `maxPixelRatio` 2 para 1,5: o alvo de render escala com o QUADRADO
      //     da densidade, e o pós-processamento aloca vários alvos do tamanho
      //     da tela. 1,5² sobre 2² é 44% a menos em cada um deles.
      //   · `shadowMapSize` 2048 para 1024: um mapa de profundidade de 2048 são
      //     16 MB; de 1024, 4 MB. São 12 MB por luz que projeta sombra.
      //
      // ⚠️ ISTO NÃO RESOLVE OS 455 MB DE TEXTURA, que é o item dominante e vem
      // do CONTEÚDO, não do perfil. Os três maiores são uma textura procedural
      // de 4096x2112 (44 MB), o atlas `dsc-atlas.webp` (26,68 MB) e uma de
      // 2048x2048 (21,34 MB). Cortar isso é a próxima frente e precisa de um
      // teto de resolução por aparelho, não de um ajuste aqui.
      tier, quality, maxPixelRatio: 1.5, minPixelRatio: 1, antialias: true,
      shadowMapSize: 1024, softShadows: false, shadowUpdateEvery: 1,
      censusPoints: false, jetParticles: 600, smallCull: 2200, textCull: 1000, parkDetailCull: 2800, lodDistance: 2600,
      crystalLod: [1, 0.3, 0.15, 0.08], domeCell: 96,
    }
    : {
      tier, quality, maxPixelRatio: 2, minPixelRatio: 1.25, antialias: true,
      shadowMapSize: 2048, softShadows: true, shadowUpdateEvery: 1,
      censusPoints: true, jetParticles: 900, smallCull: 2600, textCull: 1300, parkDetailCull: 3000, lodDistance: 3200,
      crystalLod: [1, 0.35, 0.15, 0.08], domeCell: 58,
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
  private items: {
    o: THREE.Object3D; center: THREE.Vector3; maxDist: number
    /** as luzes que vivem dentro deste grupo, com a intensidade original */
    luzes: { l: THREE.Light; i0: number }[]
  }[] = []

  /**
   * ⚠️ LUZ NUNCA É ESCONDIDA, SÓ APAGADA, E ISSO É O CONSERTO DE UM DEFEITO CARO.
   *
   * O culling escondia o grupo inteiro com `visible = false`, e vários grupos têm
   * luz dentro (o Parque Runestone tem 7, Monuments 2, Precinct 1, o Chalé 1, o
   * DSC 1). A CONTAGEM DE LUZES FAZ PARTE DA CHAVE DE CACHE DE PROGRAMA do three:
   * toda vez que uma luz aparecia ou sumia, o renderizador recompilava TODOS os
   * materiais da cena e guardava mais uma família inteira de programas, para
   * sempre.
   *
   * Medido em 29/08/2026: com a câmera perto a cena tinha 10 pontuais e 2 spots;
   * levando a câmera para 8,5 km e trazendo de volta, ela passava a 5 e 0 e
   * voltava a 10 e 2. UMA viagem de ida e volta subiu os programas compilados de
   * 444 para 480. Navegando pela cidade isso não converge: cada combinação nova
   * de (pontuais, spots) é uma família nova.
   *
   * Apagar em vez de esconder mantém a contagem CONSTANTE, que é o que o
   * renderizador precisa. Custa o laço fixo das 12 luzes no fragmento, que é
   * previsível e já estava sendo pago quando a câmera está perto.
   */
  add(o: THREE.Object3D, maxDist: number, center?: THREE.Vector3) {
    this.items.push({ o, center: center ?? new THREE.Vector3(), maxDist, luzes: [] })
  }

  /**
   * ⚠️ O INVENTÁRIO DE LUZ SE REFAZ NA TRANSIÇÃO, E NÃO NO REGISTRO. A primeira
   * versão varria o grupo dentro de `add()`, e seis luzes continuavam escapando:
   * vários módulos registram o grupo no culling e SÓ DEPOIS penduram luz nele
   * (GLB que carrega assíncrono, luz criada no fim do build). O inventário de
   * registro nascia incompleto e ninguém percebia.
   * Varrer aqui é barato porque só roda quando a visibilidade MUDA, o que
   * acontece algumas vezes por travessia de cidade e não por quadro.
   */
  private inventariar(it: { o: THREE.Object3D; luzes: { l: THREE.Light; i0: number }[] }) {
    const vistas = new Set(it.luzes.map((z) => z.l))
    it.o.traverse((c) => {
      const l = c as THREE.Light
      if (l.isLight && !vistas.has(l)) it.luzes.push({ l, i0: l.intensity })
    })
  }
  /** Liga TUDO por um instante. O `compileAsync` do three só compila o que está
   *  visível, e a visita guiada voa justamente por peças que o culling esconde
   *  (parque, caverna, spaceport): sem isto, cada parada compilava shader em
   *  pleno voo e a câmera engasgava. Usar só no boot, antes do portão abrir, e
   *  chamar `update()` logo depois. */
  revealAll() {
    for (const it of this.items) {
      it.o.visible = true
      this.inventariar(it)
      for (const z of it.luzes) { z.l.visible = true; z.l.intensity = z.i0 }
    }
  }
  update(cam: THREE.Vector3) {
    for (const it of this.items) {
      const on = cam.distanceTo(it.center) < it.maxDist
      const mudou = it.o.visible !== on
      if (mudou) {
        it.o.visible = on
        this.inventariar(it)
      }
      // ⚠️ a luz sai do esconde-esconde: fica sempre visível e só perde a
      // intensidade. Ver a nota em add(): esconder luz recompila a cena inteira.
      for (const z of it.luzes) {
        z.l.visible = true
        const alvo = on ? z.i0 : 0
        if (z.l.intensity !== alvo) z.l.intensity = alvo
      }
    }
  }

  /** quantas luzes o culling gerencia, e quantas estão acesas agora */
  contagemDeLuz() {
    let total = 0, acesas = 0
    for (const it of this.items) for (const z of it.luzes) { total++; if (z.l.intensity > 0) acesas++ }
    return { total, acesas }
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

/**
 * ORÇAMENTO DE LUZ: mantém a contagem de luzes da cena CONSTANTE.
 *
 * ⚠️ POR QUE ISTO EXISTE. A contagem de luzes faz parte da chave de cache de
 * programa do three: mudou a contagem, o renderizador RECOMPILA TODOS OS
 * MATERIAIS da cena e guarda mais uma família inteira de programas, para sempre.
 * Medido em 29/08/2026 nesta cena: uma viagem de câmera de ida e volta até 8,5 km
 * subia os programas compilados de 444 para 480, e navegando não converge, porque
 * cada combinação nova de (pontuais, spots) é uma família nova.
 *
 * ⚠️ E NÃO DÁ PARA CONSERTAR PELA LUZ. O three não conta luz cujo ANCESTRAL está
 * invisível, então marcar a própria luz como visível não adianta: quem apaga é o
 * grupo acima dela. Tentei duas vezes pelo lado do DistanceCuller (inventário no
 * registro, depois inventário na transição) e sobraram seis pontuais que somem
 * por outro caminho: elas estão penduradas em grupos e malhas que outros módulos
 * escondem por conta própria.
 *
 * O conserto que FUNCIONA é orçamentário e não estrutural: um LASTRO de luzes de
 * intensidade zero no raiz da cena, ligado e desligado para completar sempre o
 * mesmo total. O renderizador vê um número fixo, compila uma família só, e o
 * lastro não ilumina nada porque a intensidade é zero.
 *
 * O custo é honesto e previsível: o laço de N luzes no fragmento roda sempre,
 * inclusive quando a cidade está longe. É exatamente o que já se pagava quando a
 * câmera estava perto.
 */
export class OrcamentoDeLuz {
  private lastroPonto: THREE.PointLight[] = []
  private lastroSpot: THREE.SpotLight[] = []
  private reais: THREE.Light[] = []
  private quadro = 0

  constructor(private scene: THREE.Object3D, private alvoPonto = 12, private alvoSpot = 2) {
    for (let k = 0; k < alvoPonto; k++) {
      const l = new THREE.PointLight(0xffffff, 0, 0.01)
      l.name = `lastro:ponto${k}`
      l.visible = false
      scene.add(l)
      this.lastroPonto.push(l)
    }
    for (let k = 0; k < alvoSpot; k++) {
      const l = new THREE.SpotLight(0xffffff, 0, 0.01)
      l.name = `lastro:spot${k}`
      l.visible = false
      scene.add(l)
      this.lastroSpot.push(l)
    }
    this.recensear()
  }

  /** refaz a lista de luzes reais; caro, então só de tempos em tempos */
  private recensear() {
    this.reais = []
    this.scene.traverse((o) => {
      const l = o as THREE.Light
      if (l.isLight && !l.name.startsWith('lastro:')) this.reais.push(l)
    })
  }

  /** uma luz só conta se ela E todos os ancestrais dela estiverem visíveis */
  private contaDeVerdade(l: THREE.Light) {
    let p: THREE.Object3D | null = l
    while (p) { if (!p.visible) return false; p = p.parent }
    return true
  }

  update() {
    // ⚠️ RECENSEIA A CADA 120 QUADROS, e não por quadro: módulo que carrega tarde
    // (GLB assíncrono, peça atrás de bandeira) traz luz nova depois do boot, e um
    // censo de boot só nasceria incompleto. Duas vezes por segundo é de sobra e
    // custa uma travessia da cena.
    if (this.quadro++ % 120 === 0) this.recensear()
    let ponto = 0, spot = 0
    for (const l of this.reais) {
      if (!this.contaDeVerdade(l)) continue
      if ((l as THREE.PointLight).isPointLight) ponto++
      else if ((l as THREE.SpotLight).isSpotLight) spot++
    }
    for (let k = 0; k < this.lastroPonto.length; k++) {
      const on = ponto + k < this.alvoPonto
      if (this.lastroPonto[k].visible !== on) this.lastroPonto[k].visible = on
    }
    for (let k = 0; k < this.lastroSpot.length; k++) {
      const on = spot + k < this.alvoSpot
      if (this.lastroSpot[k].visible !== on) this.lastroSpot[k].visible = on
    }
  }

  /** o que o renderizador está vendo agora, para a sonda de ?stats=1 */
  medida() {
    let ponto = 0, spot = 0
    for (const l of this.reais) {
      if (!this.contaDeVerdade(l)) continue
      if ((l as THREE.PointLight).isPointLight) ponto++
      else if ((l as THREE.SpotLight).isSpotLight) spot++
    }
    return {
      reais: { ponto, spot },
      lastroAceso: {
        ponto: this.lastroPonto.filter((l) => l.visible).length,
        spot: this.lastroSpot.filter((l) => l.visible).length,
      },
      alvo: { ponto: this.alvoPonto, spot: this.alvoSpot },
    }
  }

  dispose() {
    for (const l of [...this.lastroPonto, ...this.lastroSpot]) l.removeFromParent()
  }
}
