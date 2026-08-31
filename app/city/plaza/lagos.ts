// Os lagos de cratera: a água que a GEOGRAFIA dá, não a que o desenho impõe.
//
// ⚠️ ESTE MÓDULO EXISTE PORQUE OS CANAIS DE ANEL MORRERAM (fundador, 30/08).
// Eles eram sete círculos geométricos jogados sobre um relevo que não é
// circular — o CA07 passava 20,5 dos seus 34,4 km DENTRO de cratera — e nivelar
// os quinze canais numa lâmina só custaria 276 Mm³ de terraplenagem, mais do que
// o Canal do Panamá inteiro moveu (205 Mm³). A saída foi dele: "já que temos que
// usar o terreno real, é só transformar as crateras em lagos".
//
// ⚠️ E A LÂMINA É UMA SÓ, EM TODA A CIDADE. Também dele, e é hidráulica básica:
// "toda água da cidade precisa ter exatamente o mesmo nível, já que está tudo
// interligado". Água conectada acha um nível. O nível é `cota`, medido em −40 m
// porque é onde o custo desaba: afoga 163 lotes (0,2%) contra 14.958 em −20.
//
// ⚠️ O CONTORNO SE TRAÇA AQUI, NÃO VEM PUBLICADO. O gerador conhece o heightmap
// CRU; o chão que a cidade tem é `superficieAt`, com o pódio da abóbada, a cova
// do parque e a vala do canal já aplicados. Publicar polígono do chão cru poria
// a margem no lugar errado, então o cliente traça a orla a partir do chão final.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { COR_AGUA, aguaDeVerdade } from './lago'

const COR_AREIA = '#8E856F'    // a faixa de praia, no mesmo tom do cais dos canais
const COR_FUNDO = '#243B47'    // o raso junto à margem, para a água não virar chapa

export interface LagosOpts {
  /** a lâmina, única para toda a cidade */
  cota: number
  /** o chão que a câmera vê, com pódio, cova e vala já aplicados */
  superficieAt: (x: number, z: number) => number
  /** até onde procurar água: a casca */
  raio: number
  /** passo da amostragem em metros; 30 dá orla lisa sem pesar */
  passo?: number
  sombra?: boolean
}

export interface Lagos {
  group: THREE.Group
  area: number
  corpos: number
  triangulos: number
  update: (t: number) => void
  dispose: () => void
}

/**
 * ⚠️ MARCHING SQUARES, E É O QUE FAZ A ORLA FICAR LISA. A tentação é emitir um
 * quadrado por célula abaixo da cota — sai em degrau de 30 m, que a 200 m de
 * distância lê como serra. Aqui cada célula da grade é resolvida pelo caso dos
 * seus quatro cantos e o corte cai no ponto INTERPOLADO em que o chão cruza a
 * lâmina. A margem passa a ser a curva de nível de verdade.
 *
 * Os 16 casos saem de uma tabela: para cada combinação de cantos submersos,
 * o polígono da parte molhada, em índices onde 0..3 são os cantos e 4..7 são os
 * pontos das arestas.
 */
const CASOS: number[][] = [
  [],                    // 0000
  [0, 4, 7],             // 0001
  [1, 5, 4],             // 0010
  [0, 1, 5, 7],          // 0011
  [2, 6, 5],             // 0100
  [0, 4, 5, 2, 6, 7],    // 0101 (sela)
  [1, 2, 6, 4],          // 0110
  [0, 1, 2, 6, 7],       // 0111
  [3, 7, 6],             // 1000
  [0, 4, 6, 3],          // 1001
  [1, 5, 4, 3, 7, 6],    // 1010 (sela)
  [0, 1, 5, 6, 3],       // 1011
  [2, 3, 7, 5],          // 1100
  [0, 4, 5, 2, 3],       // 1101
  [1, 2, 3, 7, 4],       // 1110
  [0, 1, 2, 3],          // 1111
]

export function buildLagos(o: LagosOpts): Lagos {
  const group = new THREE.Group()
  group.name = 'lagos'
  const L = o.cota
  const passo = o.passo ?? 30
  const R = o.raio
  const n = Math.ceil((R * 2) / passo)

  // ⚠️ A ALTURA É AMOSTRADA UMA VEZ SÓ. `superficieAt` interpola a malha do
  // terreno e não é barata; chamá-la dentro do laço dos casos multiplicaria por
  // quatro. A grade inteira sai antes, e os casos só leem.
  const alt = new Float32Array((n + 1) * (n + 1))
  const px = (i: number) => -R + i * passo
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = px(i), z = px(j)
      // fora da casca não há água: a cidade acaba ali
      alt[j * (n + 1) + i] = Math.hypot(x, z) > R - 40 ? 1e6 : o.superficieAt(x, z)
    }
  }
  const A = (i: number, j: number) => alt[j * (n + 1) + i]

  const posA: number[] = [], idxA: number[] = []      // a lâmina
  const posP: number[] = [], idxP: number[] = []      // a praia
  let area = 0

  /** o ponto onde o chão cruza a lâmina, entre dois cantos */
  const corta = (xa: number, za: number, ya: number, xb: number, zb: number, yb: number) => {
    const t = Math.abs(yb - ya) < 1e-6 ? 0.5 : (L - ya) / (yb - ya)
    const k = Math.min(1, Math.max(0, t))
    return [xa + (xb - xa) * k, za + (zb - za) * k] as [number, number]
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = px(i), x1 = px(i + 1), z0 = px(j), z1 = px(j + 1)
      const y0 = A(i, j), y1 = A(i + 1, j), y2 = A(i + 1, j + 1), y3 = A(i, j + 1)
      const c = (y0 < L ? 1 : 0) | (y1 < L ? 2 : 0) | (y2 < L ? 4 : 0) | (y3 < L ? 8 : 0)
      if (c === 0) continue
      const caso = CASOS[c]
      if (!caso.length) continue
      // os oito pontos: 0..3 cantos, 4..7 meios de aresta interpolados
      const P: [number, number][] = [
        [x0, z0], [x1, z0], [x1, z1], [x0, z1],
        corta(x0, z0, y0, x1, z0, y1),
        corta(x1, z0, y1, x1, z1, y2),
        corta(x1, z1, y2, x0, z1, y3),
        corta(x0, z1, y3, x0, z0, y0),
      ]
      const base = posA.length / 3
      for (const k of caso) { posA.push(P[k][0], L, P[k][1]) }
      for (let k = 1; k < caso.length - 1; k++) idxA.push(base, base + k, base + k + 1)
      // área da parte molhada, por shoelace
      let s = 0
      for (let k = 0; k < caso.length; k++) {
        const a = P[caso[k]], b = P[caso[(k + 1) % caso.length]]
        s += a[0] * b[1] - b[0] * a[1]
      }
      area += Math.abs(s) / 2

      // ⚠️ A PRAIA É UMA FAIXA NA ARESTA CORTADA, e sem ela a água encosta no
      // regolito cru — foi o que o fundador viu como "margem faltando
      // acabamento". Ela sobe 1,2 m acima da lâmina e entra 12 m terra adentro,
      // que é o suficiente para a linha d'água ter uma borda e não um corte.
      if (c !== 15) {
        for (let k = 0; k < caso.length; k++) {
          const ia = caso[k], ib = caso[(k + 1) % caso.length]
          if (ia < 4 || ib < 4) continue          // só as arestas de corte
          const a = P[ia], b = P[ib]
          const dx = b[0] - a[0], dz = b[1] - a[1]
          const dl = Math.hypot(dx, dz) || 1
          // a normal aponta para FORA da água (para o lado seco)
          const nx = -dz / dl, nz = dx / dl
          const fora = 12
          const bp = posP.length / 3
          posP.push(a[0], L - 0.4, a[1])
          posP.push(b[0], L - 0.4, b[1])
          posP.push(b[0] + nx * fora, L + 1.2, b[1] + nz * fora)
          posP.push(a[0] + nx * fora, L + 1.2, a[1] + nz * fora)
          idxP.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
        }
      }
    }
  }

  const feitas: THREE.Mesh[] = []
  const monta = (pos: number[], idx: number[], cor: string, agua: boolean, nome: string) => {
    if (!idx.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: cor,
      // os mesmos valores do lago central: os dois se encontram e não podem divergir
      roughness: agua ? 0.30 : 0.92,
      metalness: agua ? 0.02 : 0,
      side: THREE.DoubleSide,
    }))
    m.name = nome
    m.receiveShadow = !agua
    m.castShadow = (o.sombra ?? true) && !agua
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
  }
  monta(posP, idxP, COR_AREIA, false, 'lagos:praia')
  monta(posA, idxA, COR_AGUA, true, 'lagos:agua')

  const relogios = feitas.map((m) => aguaDeVerdade(m)).filter(Boolean) as { value: number }[]
  return {
    group,
    area,
    corpos: 0,
    triangulos: (idxA.length + idxP.length) / 3,
    update(t: number) { for (const u of relogios) u.value = t },
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}
