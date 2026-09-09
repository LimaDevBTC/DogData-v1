// ═══════════════════════════════════════════════════════════════════════════
// O PÓDIO CÍVICO: a laje que uma parcela inteira vira quando recebe programa.
//
// ⚠️ ESTE ARQUIVO NASCEU DO `campus.ts`, e nasceu porque a segunda peça pediu a
// mesma coisa. O campus resolveu, em 07/09, terraplanagem por franja, laje
// recuada, calçada de borda, muro que procura o chão mais baixo e porta rápida
// por raio ao quadrado dentro do `heightAt`. Repetir isso na mão para cada peça
// nova é repetir também os DEFEITOS que custaram chapa para achar:
//
//   · medir a franja na métrica (raio, ângulo) em vez de contra as retas do
//     polígono, o que pôs a borda da laje numa rampa de 66,2% de declive;
//   · declarar a normal da tampa em vez de tirá-la do winding, o que fez a laje
//     aparecer pelo avesso em produção;
//   · deixar `castShadow` na laje, o que escureceu o chão da cidade inteira.
//
// ⚠️ `campus.ts` NÃO FOI MIGRADO PARA CÁ, de propósito: ele está no ar com três
// peças pousadas em cima e a migração é mexida sem ganho imediato. A dívida está
// registrada em `aquatico.md`. Quem for migrar: a API abaixo cobre tudo o que o
// campus faz, menos o eixo do losango e as covas de arborização, que são
// particularidades dele.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'
import { COR_CALCADA, COR_MEIOFIO, COR_PLATO } from './vias'

export type Pt = readonly [number, number]
type Pt3 = readonly [number, number, number]

/** quanto o muro do pódio desce abaixo do chão mais baixo que ele encontra */
const RESERVA_MURO = 2.5

export interface PodioOpts {
  /** o bloco da teia que vira parcela */
  mod: Modulo
  /** a cota terraplanada, a que equilibra corte e aterro na parcela */
  cota: number
  /** nome do grupo e do mesh, para achar na cena */
  nome: string
  /** a rampa entre a divisa (chão natural) e a laje */
  franja?: number
  /** a faixa de calçada na borda da laje */
  calcada?: number
  /** a espessura da laje sobre o chão terraplanado */
  espessura?: number
}

/**
 * Recua um polígono CONVEXO para dentro por `d`, deslocando cada aresta e
 * cruzando as retas vizinhas.
 *
 * ⚠️ O RECUO NÃO É "PUXAR O VÉRTICE PARA O CENTRO". Isso encolheria por fator, e
 * num quadrilátero alongado o recuo sairia maior num eixo do que no outro.
 */
export function recuarPoly(poly: Pt[], d: number): Pt[] {
  const n = poly.length
  const retas = poly.map((p, i) => {
    const q = poly[(i + 1) % n]
    const dx = q[0] - p[0], dz = q[1] - p[1]
    const L = Math.hypot(dx, dz) || 1
    const nx = dz / L, nz = -dx / L
    return { px: p[0] + nx * d, pz: p[1] + nz * d, dx, dz }
  })
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = retas[(i + n - 1) % n], b = retas[i]
    const det = a.dx * b.dz - a.dz * b.dx
    if (Math.abs(det) < 1e-9) { out.push([b.px, b.pz]); continue }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / det
    out.push([a.px + a.dx * t, a.pz + a.dz * t])
  }
  return out
}

export function dentroDoPoly(x: number, z: number, poly: Pt[]): boolean {
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro
  }
  return dentro
}

function tri(pos: number[], nor: number[], cor: number[], a: Pt3, b: Pt3, c: Pt3, k: THREE.Color) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const L = Math.hypot(nx, ny, nz) || 1
  nx /= L; ny /= L; nz /= L
  for (const p of [a, b, c]) pos.push(p[0], p[1], p[2])
  for (let i = 0; i < 3; i++) { nor.push(nx, ny, nz); cor.push(k.r, k.g, k.b) }
  return ny
}

function tampa(pos: number[], nor: number[], cor: number[], poly: Pt[], y: number, k: THREE.Color) {
  let pior = 1
  for (let i = 1; i + 1 < poly.length; i++) {
    pior = Math.min(pior, tri(pos, nor, cor, [poly[0][0], y, poly[0][1]],
      [poly[i][0], y, poly[i][1]], [poly[i + 1][0], y, poly[i + 1][1]], k))
  }
  return pior
}

function faixa(pos: number[], nor: number[], cor: number[], fora: Pt[], dentro: Pt[], y: number, k: THREE.Color) {
  let pior = 1
  for (let i = 0; i < fora.length; i++) {
    const j = (i + 1) % fora.length
    const A: Pt3 = [fora[i][0], y, fora[i][1]], B: Pt3 = [fora[j][0], y, fora[j][1]]
    const C: Pt3 = [dentro[j][0], y, dentro[j][1]], D: Pt3 = [dentro[i][0], y, dentro[i][1]]
    pior = Math.min(pior, tri(pos, nor, cor, A, B, C, k), tri(pos, nor, cor, A, C, D, k))
  }
  return pior
}

function paredeDoMuro(pos: number[], nor: number[], cor: number[], poly: Pt[], y: number,
                      pe: (x: number, z: number) => number, k: THREE.Color) {
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    const p = poly[i], q = poly[j]
    const n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 60))
    for (let s = 0; s < n; s++) {
      const t0 = s / n, t1 = (s + 1) / n
      const x0 = p[0] + (q[0] - p[0]) * t0, z0 = p[1] + (q[1] - p[1]) * t0
      const x1 = p[0] + (q[0] - p[0]) * t1, z1 = p[1] + (q[1] - p[1]) * t1
      const b0 = pe(x0, z0), b1 = pe(x1, z1)
      tri(pos, nor, cor, [x0, y, z0], [x0, b0, z0], [x1, b1, z1], k)
      tri(pos, nor, cor, [x0, y, z0], [x1, b1, z1], [x1, y, z1], k)
    }
  }
}

const suave = (k: number) => k * k * (3 - 2 * k)

export interface Podio {
  mod: Modulo
  /** cota do chão terraplanado */
  cota: number
  /** cota do topo da laje: é aqui que a peça pousa */
  topo: number
  franja: number
  /** o polígono da parcela, que vira máscara de via */
  parcela(): { poly: [number, number][] }
  /** o polígono da laje (a parcela recuada pela franja) */
  laje(): Pt[]
  naLaje(x: number, z: number): boolean
  /** a cota do chão depois da terraplanagem, dada a cota natural */
  alturaAt(x: number, z: number, natural: number): number
  /** envolve um `alturaEm` para que quem pousa peça ache o topo da laje */
  comPodio(base: (x: number, z: number) => number): (x: number, z: number) => number
  /** o rumo do eixo do bloco, em graus, e o giro na convenção do Three */
  rumo: number
  giro: number
  /** o centro do bloco, que é onde a peça pousa */
  centro: { x: number; z: number }
  /** a cota em que o muro pousa num ponto da borda */
  peDoMuro(alturaEm: (x: number, z: number) => number, x: number, z: number): number
  /** a altura do muro por aresta, amostrada, para medir sem desenhar */
  medirMuro(alturaEm: (x: number, z: number) => number): { aresta: number; comprimento: number; minima: number; maxima: number }[]
  criar(alturaEm: (x: number, z: number) => number): THREE.Group
}

export function montarPodio(opts: PodioOpts): Podio {
  const franja = opts.franja ?? 34
  const calcada = opts.calcada ?? 12
  const espessura = opts.espessura ?? 1.5
  const topo = opts.cota + espessura
  const cx = caixaDoModulo(opts.mod)
  const poly = polyDoModulo(opts.mod) as Pt[]
  const laje = recuarPoly(poly, franja)
  const miolo = recuarPoly(laje, calcada)

  // ⚠️ PORTA RÁPIDA ANTES DE QUALQUER CONTA, e ela compara raio AO QUADRADO.
  // `alturaAt` é chamada de dentro do `heightAt`, que é o trava-chão da câmera
  // (todo quadro) e o pouso de toda peça, poste e árvore da cidade. Quase todo
  // ponto do mapa está fora desta parcela, e duas comparações resolvem isso sem
  // atan2 e sem raiz: `Math.hypot` do V8 não é embutido e custa dezenas de ns.
  const rDentro = cx.r0 - 40
  const rFora = Math.max(...poly.map((p) => Math.hypot(p[0], p[1]))) + 40
  const r2Dentro = rDentro * rDentro
  const r2Fora = rFora * rFora

  // ⚠️ A DISTÂNCIA SE MEDE CONTRA AS RETAS DO POLÍGONO, NÃO CONTRA O SETOR
  // ANULAR. A parcela desenhada é um quadrilátero de lados retos (o anel da
  // cidade é uma face de dodecágono), e a laje é recuada perpendicular a essas
  // retas: medir em (raio, ângulo) diverge por mais de 100 m nas quinas.
  const arestas = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const dx = q[0] - p[0], dz = q[1] - p[1]
    const L = Math.hypot(dx, dz) || 1
    return { px: p[0], pz: p[1], nx: dz / L, nz: -dx / L }
  })

  function dentroDaParcela(x: number, z: number): number {
    let d = Infinity
    for (const a of arestas) {
      const t = (x - a.px) * a.nx + (z - a.pz) * a.nz
      if (t < d) d = t
    }
    return d
  }

  function peso(x: number, z: number): number {
    const r2 = x * x + z * z
    if (r2 <= r2Dentro || r2 >= r2Fora) return 0
    const d = dentroDaParcela(x, z)
    if (d <= 0) return 0
    return d >= franja ? 1 : suave(d / franja)
  }

  const naLaje = (x: number, z: number) => dentroDoPoly(x, z, laje)
  const eixoA = (cx.a0 + cx.a1) / 2

  function peDoMuro(alturaEm: (x: number, z: number) => number, x: number, z: number): number {
    // ⚠️ ELE PROCURA O CHÃO MAIS BAIXO NUMA FAIXA EM VOLTA, não só embaixo da
    // aresta: entre a laje e a divisa existe a rampa da franja, e um muro que
    // parasse na cota da própria aresta deixaria a rampa à mostra por baixo.
    let baixo = alturaEm(x, z)
    const r = Math.hypot(x, z) || 1
    const ux = x / r, uz = z / r
    for (const d of [franja * 0.5, franja, franja + 40, franja + 90]) {
      baixo = Math.min(baixo, alturaEm(x + ux * d, z + uz * d), alturaEm(x - ux * d, z - uz * d),
        alturaEm(x - uz * d, z + ux * d), alturaEm(x + uz * d, z - ux * d))
    }
    return baixo - RESERVA_MURO
  }

  return {
    mod: opts.mod,
    cota: opts.cota,
    topo,
    franja,
    rumo: eixoA * 180 / Math.PI,
    giro: -eixoA,
    centro: { x: Math.sin(eixoA) * cx.rm, z: -Math.cos(eixoA) * cx.rm },
    parcela: () => ({ poly: polyDoModulo(opts.mod) }),
    laje: () => laje,
    naLaje,
    alturaAt(x, z, natural) {
      const k = peso(x, z)
      return k <= 0 ? natural : natural * (1 - k) + opts.cota * k
    },
    comPodio(base) {
      return (x: number, z: number) => (naLaje(x, z) ? topo : base(x, z))
    },
    peDoMuro,
    medirMuro(alturaEm) {
      return laje.map((p, i) => {
        const q = laje[(i + 1) % laje.length]
        let baixa = Infinity, alta = -Infinity
        for (let s = 0; s <= 20; s++) {
          const t = s / 20
          const h = topo - peDoMuro(alturaEm, p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
          baixa = Math.min(baixa, h); alta = Math.max(alta, h)
        }
        return { aresta: i, comprimento: Math.hypot(q[0] - p[0], q[1] - p[1]), minima: baixa, maxima: alta }
      })
    },
    criar(alturaEm) {
      const pos: number[] = [], nor: number[] = [], cor: number[] = []
      const nyMiolo = tampa(pos, nor, cor, miolo, topo, new THREE.Color(COR_PLATO))
      const nyFaixa = faixa(pos, nor, cor, laje, miolo, topo, new THREE.Color(COR_CALCADA))
      paredeDoMuro(pos, nor, cor, laje, topo, (x, z) => peDoMuro(alturaEm, x, z), new THREE.Color(COR_MEIOFIO))
      // ⚠️ PORTÃO DE TAMPA VIRADA: uma comparação no boot que teria pego sozinha
      // o defeito que a chapa de produção do campus pegou.
      if (nyMiolo < 0.9 || nyFaixa < 0.9) {
        console.error(`[${opts.nome}] TAMPA VIRADA: normal.y miolo ${nyMiolo.toFixed(2)}, faixa ${nyFaixa.toFixed(2)}`)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
      g.computeBoundingSphere()
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }))
      mesh.name = `${opts.nome}_PODIO`
      mesh.receiveShadow = true
      // ⚠️ A LAJE NÃO PROJETA SOMBRA, E ISSO É CONSERTO, NÃO ECONOMIA: no campus
      // `castShadow = true` deixou o chão da cidade inteira preto em pleno dia,
      // porque a sombra em cascata ajusta o frustum ao que projeta. A laje é
      // chão: o que ela projetaria ninguém veria.
      mesh.castShadow = false
      const grupo = new THREE.Group()
      grupo.name = opts.nome
      grupo.add(mesh)
      return grupo
    },
  }
}
