// ═══════════════════════════════════════════════════════════════════════════
// O PROGRAMA DA CIDADE, ENCAIXADO NA TEIA
//
// ⚠️ O PEDIDO DO FUNDADOR, 31/08: "as peças extras não conversam com as ruas.
// Vamos adequar as vias de maneira organizada para que no futuro a gente
// construa o prédio, estádio, parque, ou o que quer que seja sob medida, com as
// ruas devidamente conectadas e com os módulos exatos para a futura construção.
// Não precisamos das peças ainda, somente do projeto delas na cidade."
//
// ⚠️ E ELAS NÃO SÃO DO SKETCHFAB. Ele perguntou, e a resposta importa para a
// decisão: são 3.134 linhas de código nosso em 34 arquivos (`pecas/*.ts`), uma
// composição desenhada por peça — o Parque Olímpico sozinho tem nove parcelas de
// 360 m e uma cruz de esplanadas. Apagar isso jogaria fora projeto de verdade.
// O que estava errado não era a peça, era o ENDEREÇO dela.
//
// ⚠️ A CAUSA DO DESENCONTRO: a peça vinha posicionada pela grade do GERADOR (a
// teia antiga, por banda de quarteirão) e a rua passou a ser desenhada pela teia
// nova (26 anéis × 256 radiais). Duas grades, então a peça caía rente às ruas em
// vez de emoldurada por elas, cortando quarteirão no meio.
//
// A regra agora é uma só, e é o que faz nada quebrar:
//   TODA PEÇA OCUPA UM NÚMERO INTEIRO DE MÓDULOS DA TEIA.
// Os lados da peça SÃO ruas, porque os lados do módulo são ruas. Não existe
// "conectar a peça à malha" como passo separado: ela nasce conectada.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { ANEIS, HR, N_RAD, anguloDe, areaDoModulo, caixaDoModulo, passoNoRaio,
         polyDoModulo, type Modulo } from './teia'

export interface PecaPrograma {
  id: string
  nome: string
  tipo: string
  /** a área que o programa pede, em m² */
  area: number
  /** onde ela estava, para a peça viajar o mínimo possível */
  x: number
  z: number
}

export interface PecaEncaixada extends PecaPrograma {
  mod: Modulo
  /** o centro do bloco de módulos, em mundo */
  cx: number
  cz: number
  /** meias medidas do retângulo inscrito, para o módulo 3D compor dentro */
  a: number
  b: number
  /** rumo da tangente: a peça olha para fora, como todo lote desta cidade */
  rot: number
  poly: [number, number][]
  areaReal: number
}


/**
 * Encaixa cada peça num bloco inteiro de módulos.
 *
 * ⚠️ AS MAIORES ESCOLHEM PRIMEIRO. Com as pequenas na frente, o Parque Olímpico
 * (116 ha) não acha bloco livre e é empurrado para a borda; é o mesmo motivo pelo
 * qual o alocador antigo já ordenava por área.
 *
 * ⚠️ E A BUSCA É POR CUSTO, NÃO PELA PRIMEIRA VAGA: deformação (o quanto o bloco
 * difere da área pedida) mais viagem (o quanto a peça saiu do lugar). Só vaga
 * livre não basta — encher a cidade do centro para fora deixaria o hipódromo na
 * praça e o teatro no cinturão.
 */
export interface ViaPrincipal {
  /** os anéis viários, em raio de mundo */
  aneis: number[]
  /** os bulevares, em rumo (graus) */
  bulevares: number[]
}

export function encaixaPrograma(
  pecas: PecaPrograma[],
  molhado: (x: number, z: number) => boolean,
  vias?: ViaPrincipal,
): PecaEncaixada[] {
  // ⚠️ TODA PARCELA TEM DE ENCOSTAR NUMA VIA PRINCIPAL, e isso virou requisito
  // em 31/08, quando o fundador tirou a teia fina ("vamos criar apenas as vias
  // principais, em nível AAA+"). Enquanto a teia de 27 anéis × 168 radiais
  // existia, a parcela tinha rua nos quatro lados de graça, porque os lados dela
  // ERAM ruas. Sem a teia fina, parcela solta no meio do quarteirão fica sem
  // acesso — que é exatamente o "nada quebra" que ele cobra. Aqui ela é obrigada
  // a ter pelo menos UMA testada num anel viário ou num bulevar.
  const encosta = (m: Modulo): boolean => {
    if (!vias) return true
    const c = caixaDoModulo(m)
    for (const ra of vias.aneis) {
      if (Math.abs(c.r0 - ra) < 80 || Math.abs(c.r1 - ra) < 80) return true
    }
    for (const bu of vias.bulevares) {
      const b = (bu * Math.PI) / 180
      for (const aa of [c.a0, c.a1]) {
        const d = Math.abs(((aa - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        if (d * c.rm < 90) return true
      }
    }
    return false
  }
  const ocupado = new Set<string>()
  const marca = (m: Modulo, escreve: boolean): boolean => {
    const rm = (ANEIS[m.i] + ANEIS[Math.min(ANEIS.length - 1, m.i + m.nr)]) / 2
    const passo = passoNoRaio(rm)
    for (let r = 0; r < m.nr; r++) {
      for (let c = 0; c < m.ns; c++) {
        const k = `${m.i + r}|${(m.j + c * passo) % N_RAD}`
        if (!escreve && ocupado.has(k)) return false
        if (escreve) ocupado.add(k)
      }
    }
    return true
  }

  const fila = [...pecas].sort((p, q) => q.area - p.area)
  const out: PecaEncaixada[] = []

  for (const p of fila) {
    const ru0 = (Math.atan2(p.x, -p.z) + Math.PI * 2) % (Math.PI * 2)
    const r0 = Math.hypot(p.x, p.z)
    let melhor: { custo: number; m: Modulo } | null = null

    for (let i = 0; i + 1 < ANEIS.length; i++) {
      for (let nr = 1; nr <= 4 && i + nr < ANEIS.length; nr++) {
        const rm = (ANEIS[i] + ANEIS[i + nr]) / 2
        const passo = passoNoRaio(rm)
        // ⚠️ `ns` SAI DA ÁREA, não de uma varredura cega: com a profundidade do
        // bloco definida por (i, nr), a largura que a área pede é aritmética.
        const prof = ANEIS[i + nr] - ANEIS[i] - 2 * HR
        if (prof < 40) continue
        const arcoMod = ((passo / N_RAD) * Math.PI * 2) * rm
        const nsIdeal = Math.max(1, Math.round(p.area / Math.max(1, prof * arcoMod)))
        for (const ns of [nsIdeal, nsIdeal + 1, Math.max(1, nsIdeal - 1)]) {
          if (ns * arcoMod > 2600) continue          // nenhuma peça é um setor inteiro
          // varre o rumo a partir do original, para os dois lados
          const jIdeal = Math.round((ru0 / (Math.PI * 2)) * N_RAD / passo) * passo
          for (let d = 0; d <= N_RAD / passo; d++) {
            for (const sg of d === 0 ? [0] : [-1, 1]) {
              const j = ((jIdeal + sg * d * passo) % N_RAD + N_RAD) % N_RAD
              const m: Modulo = { i, nr, j, ns }
              if (!marca(m, false)) continue
              if (!encosta(m)) continue                 // sem testada de via principal
              const cx0 = caixaDoModulo(m)
              const am = (cx0.a0 + cx0.a1) / 2
              const mx = Math.sin(am) * cx0.rm, mz = -Math.cos(am) * cx0.rm
              if (molhado(mx, mz)) continue
              const ar = areaDoModulo(m)
              const deform = Math.abs(ar / p.area - 1)
              if (deform > 0.55) continue
              const viagem = Math.hypot(mx - p.x, mz - p.z) / 3000
              const custo = deform + viagem * 0.9
              if (!melhor || custo < melhor.custo) melhor = { custo, m }
            }
            if (melhor && melhor.custo < 0.10) break
          }
          if (melhor && melhor.custo < 0.10) break
        }
        if (melhor && melhor.custo < 0.06) break
      }
      if (melhor && melhor.custo < 0.06) break
    }

    if (!melhor) continue
    marca(melhor.m, true)
    const c = caixaDoModulo(melhor.m)
    const am = (c.a0 + c.a1) / 2
    out.push({
      ...p,
      mod: melhor.m,
      cx: Math.sin(am) * c.rm,
      cz: -Math.cos(am) * c.rm,
      // ⚠️ O RETÂNGULO INSCRITO, não o trapézio: os módulos 3D compõem dentro de
      // `a × b`, e um deles é uma pista oval de 1.600 m. Meia largura é o arco no
      // raio de DENTRO, que é o menor: assim o retângulo cabe no trapézio inteiro.
      a: ((c.a1 - c.a0) * c.r0) / 2,
      b: (c.r1 - c.r0) / 2,
      rot: (am * 180) / Math.PI,
      poly: polyDoModulo(melhor.m),
      areaReal: areaDoModulo(melhor.m),
    })
  }
  return out
}

// ── o desenho do PROJETO: a reserva, não o prédio ───────────────────────────
//
// ⚠️ ISTO É PLANTA, NÃO MAQUETE (fundador, 31/08: "não precisamos das peças
// ainda, somente do projeto delas na cidade, de maneira profissional"). O bloco
// reservado aparece como parcela demarcada, com a cor do uso e a moldura de rua
// que já existe em volta. A composição 3D de cada peça continua no código e volta
// com `?pecas3d=1` — ela não foi apagada, foi adiada.
const COR_USO: Record<string, string> = {
  civico: '#B9B3A2', esporte: '#94A47E', verde: '#7E8A6B', jardim: '#7E8A6B',
  agua: '#3E6E82', lazer: '#94A47E', floresta: '#59684C', producao: '#A79C86',
  industria: '#8A8375', infra: '#8F8879', transporte: '#9AA0A6',
  distribuicao: '#9E968A', financeiro: '#B4AC9A',
}

export interface ProgramaDesenho { group: THREE.Group; triangulos: number; dispose: () => void }

export function desenhaPrograma(
  pecas: PecaEncaixada[],
  heightAt: (x: number, z: number) => number,
): ProgramaDesenho {
  const group = new THREE.Group()
  group.name = 'programa'
  const pos: number[] = [], cor: number[] = [], idx: number[] = []
  const c = new THREE.Color()
  for (const p of pecas) {
    c.set(COR_USO[p.tipo] ?? '#A8A296')
    const m0 = p.mod
    const box = caixaDoModulo(m0)
    // ⚠️ SUBDIVIDIDA EM LINHA RETA, e as duas metades disso importam.
    // SUBDIVIDIDA: o terreno fura a parcela se ela for um quad só — é o mesmo
    // defeito do platô do quarteirão, e aqui a parcela chega a 1.000 m.
    // EM LINHA RETA: os lados da parcela são as ruas, e as ruas são cordas. Se a
    // subdivisão interpolar o ÂNGULO, a parcela vira curva e abre uma lasca entre
    // ela e a calçada. A interpolação é bilinear entre os QUATRO CANTOS, em
    // coordenada de mundo, então os lados continuam retos.
    const pt = (r: number, a: number) => [Math.sin(a) * r, -Math.cos(a) * r] as const
    const P00 = pt(box.r0, box.a0), P01 = pt(box.r0, box.a1)
    const P10 = pt(box.r1, box.a0), P11 = pt(box.r1, box.a1)
    const larg = Math.hypot(P01[0] - P00[0], P01[1] - P00[1])
    const NU = Math.max(2, Math.round(larg / 45))
    const NV = Math.max(2, Math.round((box.r1 - box.r0) / 45))
    const bil = (u: number, v: number) => {
      const ax = P00[0] + (P01[0] - P00[0]) * u, az = P00[1] + (P01[1] - P00[1]) * u
      const bx = P10[0] + (P11[0] - P10[0]) * u, bz = P10[1] + (P11[1] - P10[1]) * u
      return [ax + (bx - ax) * v, az + (bz - az) * v] as const
    }
    for (let u = 0; u < NU; u++) {
      for (let v = 0; v < NV; v++) {
        const b = pos.length / 3
        // ⚠️ a ordem dos quatro cantos dá normal para CIMA (sexta vez que isto
        // aparece nesta cena; ver a nota em teia.ts)
        for (const [uu, vv] of [[u / NU, v / NV], [(u + 1) / NU, v / NV],
                                [(u + 1) / NU, (v + 1) / NV], [u / NU, (v + 1) / NV]] as const) {
          const [x, z] = bil(uu, vv)
          pos.push(x, heightAt(x, z) + 0.45, z)
          cor.push(c.r, c.g, c.b)
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.93, metalness: 0,
  }))
  m.name = 'programa:parcelas'
  m.receiveShadow = true
  group.add(m)
  return {
    group,
    triangulos: idx.length / 3,
    dispose() { g.dispose(); (m.material as THREE.Material).dispose(); group.clear() },
  }
}
