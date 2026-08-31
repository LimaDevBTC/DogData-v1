// ═══════════════════════════════════════════════════════════════════════════
// AS ILHAS DA BAÍA: o endereço mais exclusivo da cidade
//
// ⚠️ O PROGRAMA É DO FUNDADOR, 30/08: "o principal é a praia e 2 exemplares de
// local plano pra construção de uma mansão. Todas as ilhas servem a esse
// propósito, ser casa dos magnatas. Será o local mais exclusivo da cidade."
// A ilha aqui não é paisagem, é LOTE: praia larga, DOIS patamares de construção,
// e trilha ligando os dois à orla.
//
// ⚠️ E A REFERÊNCIA É DELE: "Bahamas, Maldivas, Angra dos Reis". As três não se
// parecem entre si, mas o que elas TÊM EM COMUM é o que estava faltando, e não
// era a montanha: é o BANCO RASO. Bahamas é cayo baixo sobre um banco de areia
// que se estende quilômetros; Maldivas é atol com lagoa; Angra é morro granítico
// arredondado com enseada funda e praia no fundo dela. Nenhuma das três tem pico.
// A primeira versão nossa era vulcão jovem — a coisa errada, bem feita.
//
// ⚠️ O BANCO RASO É DESENHADO ACIMA DA LÂMINA, E ISSO É DELIBERADO. A água da
// cidade é opaca (`lagos.ts`, MeshStandardMaterial sem transparência), então
// nada submerso aparece: um banco desenhado no lugar certo, debaixo d'água,
// seria invisível. Aqui o apron submerso sobe para 15 cm ACIMA da lâmina e é
// pintado no gradiente do raso — é o mesmo truque de sempre nesta cena, faixa
// pintada em vez de volume, e é o que faz a turquesa existir.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

// paleta: a maquete da cidade + a faixa de raso, que é nova
const C_FUNDO = new THREE.Color('#2E4A57')   // o mergulho, na borda do banco
const C_AREIA = new THREE.Color('#E2D9BE')   // a praia
const C_MATO = new THREE.Color('#6C7A5B')    // a mata
const C_MATO_E = new THREE.Color('#59684C')  // a mata fechada do alto
const C_ROCHA = new THREE.Color('#8A8375')   // o costão de rocha
const C_PLATO = new THREE.Color('#C3BBA8')   // o patamar de construção
const C_TRILHA = new THREE.Color('#A79C86')  // a trilha de saibro

export type TipoIlha = 'angra' | 'banco' | 'atol'

export interface Patamar { raio: number; rumo: number; dist: number; cota: number }

export interface IlhaSpec {
  id: string
  nome: string
  x: number
  z: number
  /** raio médio até a linha d'água */
  raio: number
  /** altura do ponto mais alto acima da lâmina */
  cume: number
  tipo: TipoIlha
  semente: number
  /** alongamento do eixo maior (1 = redonda) */
  alonga: number
  /** giro do eixo maior, em graus */
  giro: number
  /** ⚠️ até onde o banco raso vai, como múltiplo do raio.
   *
   *  ⚠️ E ELE TEM TETO. A primeira tentativa usou 2,0 a 3,1 e o resultado medido
   *  foi que os cinco bancos SE ENCOSTARAM: a baía virou uma mancha clara
   *  contínua com pontinhos verdes em cima, que não é Bahamas, é maré baixa. O
   *  banco é a MOLDURA da ilha, não o assunto. 1,5 a 1,95 mantém a turquesa em
   *  volta de cada uma e devolve o azul fundo entre elas. */
  banco: number
  /** ⚠️ SEMPRE DOIS, é o programa. */
  patamares: [Patamar, Patamar]
  dono?: string
}

// ⚠️ COORDENADAS MEDIDAS (preenchimento por distância à costa nos 20,48 km² da
// baía), não escolhidas. O ponto mais fundo está a 1.540 m da costa.
//
// ⚠️ A RAZÃO CUME/RAIO CAIU DE 0,39 PARA 0,05–0,15. Angra dos Reis tem morro de
// 200 m em ilha de 3 km: razão 0,07. Um cayo das Bahamas fica em 0,01. A primeira
// versão estava em 0,39, que é ilha vulcânica de 1 milhão de anos, não paraíso.
export const ILHAS: readonly IlhaSpec[] = [
  // A DO FUNDADOR, tipo Angra: morros arredondados, enseadas fundas, praia no
  // fundo de cada uma. A 5.589 m do centro no rumo 40,3°, o eixo entre a cidade e
  // o Parque Runestone. A maior, e a única com banco em toda a volta.
  { id: 'IL01', nome: 'Ilha do Fundador', x: 3613, z: -4264,
    raio: 600, cume: 88, tipo: 'angra', semente: 1, alonga: 1.35, giro: 214,
    banco: 1.55, dono: 'fundador',
    patamares: [
      { raio: 118, rumo: 214, dist: 245, cota: 0.62 },   // o alto, vista da cidade
      { raio: 104, rumo: 62, dist: 335, cota: 0.16 },    // o baixo, sobre a praia
    ] },
  { id: 'IL02', nome: 'Ilha Norte', x: 4975, z: -3494,
    raio: 430, cume: 62, tipo: 'angra', semente: 7, alonga: 1.18, giro: 70,
    banco: 1.50,
    patamares: [
      { raio: 92, rumo: 152, dist: 185, cota: 0.58 },
      { raio: 80, rumo: 340, dist: 230, cota: 0.14 },
    ] },
  // BAHAMAS: cayo baixo sobre um banco enorme. Quase toda ela é praia e raso.
  { id: 'IL03', nome: 'Banco do Poente', x: 3139, z: -5390,
    raio: 285, cume: 13, tipo: 'banco', semente: 13, alonga: 1.7, giro: 128,
    banco: 1.95,
    patamares: [
      { raio: 74, rumo: 128, dist: 105, cota: 0.72 },
      { raio: 64, rumo: 300, dist: 128, cota: 0.66 },
    ] },
  { id: 'IL04', nome: 'Ilha Leste', x: 5626, z: -2665,
    raio: 230, cume: 40, tipo: 'angra', semente: 23, alonga: 1.45, giro: 20,
    banco: 1.55,
    patamares: [
      { raio: 62, rumo: 20, dist: 92, cota: 0.56 },
      { raio: 54, rumo: 205, dist: 106, cota: 0.18 },
    ] },
  // MALDIVAS: atol com lagoa. O anel é estreito e a lagoa é rasa e clara.
  { id: 'IL05', nome: 'Atol', x: 4679, z: -4323,
    raio: 150, cume: 9, tipo: 'atol', semente: 31, alonga: 1.2, giro: 300,
    banco: 1.85,
    patamares: [
      { raio: 40, rumo: 300, dist: 96, cota: 0.9 },
      { raio: 34, rumo: 128, dist: 100, cota: 0.86 },
    ] },
]

export interface Ilhas { group: THREE.Group; postas: number; triangulos: number; dispose: () => void }

/** ⚠️ RUÍDO DETERMINÍSTICO: `Math.random()` mudaria a ilha a cada recarga. */
function ruido2(semente: number) {
  const h = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + semente * 144269) | 0
    n = Math.imul(n ^ (n >> 13), 1274126177)
    return (((n ^ (n >> 16)) >>> 0) / 4294967296) * 2 - 1
  }
  return (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y)
    const u = x - i, v = y - j
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v)
    return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv)
         + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv
  }
}
const suave = (k: number) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c) }

function geoIlha(spec: IlhaSpec, cota: number): THREE.BufferGeometry {
  const NA = 176
  // ⚠️ 104 ANÉIS, NÃO 72. A costa é irregular (`raioEm` varia com o ângulo) e
  // atravessa os anéis em raios diferentes a cada rumo: com poucos anéis o
  // contorno vira escada. É a mesma razão que o contorno da baía usa passo de 30 m.
  const NR = 104
  const rn = ruido2(spec.semente)
  const rnFino = ruido2(spec.semente * 31 + 7)
  const g0 = (spec.giro * Math.PI) / 180

  // ⚠️ A COSTA DE ANGRA É RECORTADA, a de banco é lisa e comprida. Enseada funda
  // é o que faz Angra ser Angra: a praia mora no FUNDO dela, protegida.
  const rec = spec.tipo === 'angra' ? 1.6 : spec.tipo === 'banco' ? 0.8 : 0.5
  const raioEm = (a: number) => {
    const s = spec.semente
    return spec.raio * (1
      + 0.20 * rec * Math.sin(a * 2 + s * 1.7)
      + 0.14 * rec * Math.sin(a * 3 - s * 2.3)
      + 0.08 * rec * Math.sin(a * 5 + s * 0.9)
      + 0.10 * rec * rn(Math.cos(a) * 2.3 + s, Math.sin(a) * 2.3 - s))
  }

  const paraLocal = (x: number, z: number) => {
    const c = Math.cos(-g0), s = Math.sin(-g0)
    return [(x * c - z * s) / spec.alonga, x * s + z * c] as const
  }

  const cumeA = (spec.semente * 2.399963) % (Math.PI * 2)

  /** o relevo da terra, 0..1, antes de virar metros */
  const espinha = (u: number, v: number, R: number, t: number): number => {
    if (spec.tipo === 'banco') {
      // ⚠️ CAYO: uma lombada baixa e larga, quase plana, com queda só na borda.
      // Bahamas não tem morro; tem duna. Ombro em 0,55 e queda até a costa.
      return (1 - suave((t - 0.55) / 0.42)) * 0.92
    }
    if (spec.tipo === 'atol') {
      // ⚠️ ATOL: o anel é uma gaussiana em torno de t = 0,80, e a LAGOA no meio
      // fica logo abaixo da lâmina, o que a pinta de raso claro. Sem a lagoa
      // afundar, o atol vira uma rosquinha de areia e não lê como Maldivas.
      const anel = Math.exp(-Math.pow((t - 0.80) / 0.17, 2))
      const lagoa = -0.9 * Math.exp(-Math.pow(t / 0.52, 2))
      return anel + lagoa
    }
    // ANGRA: dois a três morros arredondados sobre um domo de cosseno. O domo
    // tem derivada ZERO no centro e na costa, que é o que tira a ponta.
    const domo = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, t)))
    const m1 = Math.exp(-Math.pow(Math.hypot(u - Math.cos(cumeA) * R * 0.28,
                                             v - Math.sin(cumeA) * R * 0.28) / (R * 0.40), 2))
    const m2 = Math.exp(-Math.pow(Math.hypot(u + Math.cos(cumeA) * R * 0.32,
                                             v + Math.sin(cumeA) * R * 0.26) / (R * 0.34), 2)) * 0.78
    const m3 = Math.exp(-Math.pow(Math.hypot(u - Math.sin(cumeA) * R * 0.34,
                                             v + Math.cos(cumeA) * R * 0.30) / (R * 0.26), 2)) * 0.55
    // ⚠️ O EXPOENTE DO DOMO CONTROLA A LARGURA DA PRAIA, e 1,6 era demais. Perto
    // da costa o domo já vai como (1−t)², então elevá-lo a 1,6 dá (1−t)^3,2: a
    // terra fica deitada por centenas de metros e tudo isso pinta de areia.
    // Medido na chapa: a praia comia metade da ilha. Com 0,95 o apron sobe mais
    // cedo, a praia vira faixa e a mata volta a ser o assunto.
    // ⚠️ O PESO DOS MORROS SUBIU DE 0,66 PARA 0,92 e o do domo caiu. Com o
    // banco fora e a praia estreita, a ilha ficou lendo como panqueca: o domo é
    // massa, quem dá SILHUETA é o morro. Agora a crista domina e o domo só
    // sustenta a base.
    return Math.pow(domo, 0.95) * 0.26 + Math.max(m1, m2, m3) * 0.92
  }

  const pats = spec.patamares.map((p) => {
    const a = (p.rumo * Math.PI) / 180
    return { ...p, px: Math.sin(a) * p.dist, pz: -Math.cos(a) * p.dist }
  })

  /** a trilha: patamar alto → patamar baixo → praia */
  function trilha(x: number, z: number) {
    const A = pats[0], B = pats[1]
    const ab = (B.rumo * Math.PI) / 180
    const C = { px: Math.sin(ab) * (spec.raio * 0.93), pz: -Math.cos(ab) * (spec.raio * 0.93), cota: 0.03 }
    let melhor = { d: Infinity, y: 0 }
    for (const [P, Q] of [[A, B], [B, C]] as const) {
      const dx = Q.px - P.px, dz = Q.pz - P.pz
      const L2 = dx * dx + dz * dz || 1
      const k = Math.max(0, Math.min(1, ((x - P.px) * dx + (z - P.pz) * dz) / L2))
      const d = Math.hypot(x - (P.px + dx * k), z - (P.pz + dz * k))
      if (d < melhor.d) melhor = { d, y: spec.cume * (P.cota + (Q.cota - P.cota) * k) }
    }
    return melhor
  }

  /** altura em metros acima da lâmina; devolve também se aquilo é banco raso */
  const campo = (x: number, z: number) => {
    const [u, v] = paraLocal(x, z)
    const a = Math.atan2(v, u)
    const R = raioEm(a)
    const t = Math.hypot(u, v) / Math.max(1, R)
    let y: number
    let raso = 0                                   // 0 = terra, 1 = borda do banco
    if (t <= 1) {
      const janela = Math.max(0, 1 - t * t)
      const cristas = (0.12 * rn(u / (spec.raio * 0.30), v / (spec.raio * 0.30))
                     + 0.05 * rnFino(u / (spec.raio * 0.11), v / (spec.raio * 0.11))) * janela
      y = (espinha(u, v, R, t) + cristas) * spec.cume
    } else {
      // ⚠️ O BANCO RASO SAIU (fundador, 31/08: "não precisa adicionar muito
      // efeito na água, faça só as ilhas"). Ele era um apron desenhado ACIMA da
      // lâmina e pintado de turquesa, porque a água da cidade é opaca e nada
      // submerso aparece. Duas coisas o condenaram: com 1,5 a 3,1 raios os cinco
      // bancos SE ENCOSTAVAM e a baía virava mancha clara; e ele estava com 15 cm
      // de altura contra ±35 cm de ruído, ou seja AFUNDAVA em parte da extensão —
      // as manchas escuras da chapa eram isso, não z-fighting (medido: 996 de
      // 2.936 vértices abaixo da lâmina). Agora a ilha simplesmente MERGULHA e a
      // água esconde o resto, que é o honesto numa lâmina opaca.
      const tb = t - 1
      raso = 0
      // ⚠️ SEM DEGRAU NA COSTA. Começar o mergulho em −3,5 punha um paredão de
      // 3,5 m exatamente na linha d'água, e como a costa cruza os anéis da malha
      // em ângulos diferentes, esse degrau saía SERRILHADO na orla. A queda parte
      // de zero e acelera: a praia entra na água sem batente.
      y = -74 * Math.pow(tb / 0.5, 1.6)
    }
    // os patamares, por corte-aterro com saia de transição
    for (const p of pats) {
      const dp = Math.hypot(x - p.px, z - p.pz)
      const fora = p.raio * 1.75
      if (dp >= fora) continue
      const k = dp <= p.raio ? 1 : 1 - (dp - p.raio) / (fora - p.raio)
      const s = suave(k)
      y = y * (1 - s) + spec.cume * p.cota * s
      raso *= 1 - s
    }
    // a trilha é ESCAVADA, não pintada: caminho que só muda de cor num morro
    // continua sendo morro.
    const tr = trilha(x, z)
    if (tr.d < 9 && t <= 1.02) {
      const s = suave(1 - tr.d / 9) * 0.78
      y = y * (1 - s) + tr.y * s
    }
    return { y, raso, t, tr: tr.d }
  }

  const pos: number[] = [], cor: number[] = [], idx: number[] = []
  const c = new THREE.Color()
  for (let j = 0; j <= NR; j++) {
    const tt = j / NR
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2
      const dirU = Math.cos(a) * spec.alonga, dirV = Math.sin(a)
      const cg = Math.cos(g0), sg = Math.sin(g0)
      const ux = dirU * cg + dirV * sg, uz = -dirU * sg + dirV * cg
      // o disco vai até o fim do banco mais o mergulho
      // ⚠️ 1,22 R BASTA. Sem o banco, o que existe além da costa é só o talude
      // submerso, e ele some sob a lâmina em poucos metros de raio.
      const R = raioEm(Math.atan2(dirV, dirU)) * 1.22
      const r = tt * R
      const x = ux * r, z = uz * r
      const f = campo(x, z)
      pos.push(x, f.y, z)

      const emPat = pats.some((p) => Math.hypot(x - p.px, z - p.pz) < p.raio * 1.05)
      if (emPat && f.y > 0.6) c.copy(C_PLATO)
      else if (f.tr < 7 && f.y > 0.6 && f.t <= 1.02) c.copy(C_TRILHA)
      // ⚠️ ABAIXO DA LÂMINA NÃO SE PINTA NADA, porque nada aparece: a água da
      // cidade é opaca. O talude submerso existe só para a linha d'água ser um
      // CORTE e não uma parede.
      else if (f.y < 0) { c.copy(C_FUNDO)
      // ⚠️ A PRAIA É UMA FAIXA EM METROS, NÃO UMA FRAÇÃO DO CUME. Como fração,
      // ilha baixa vira banco de areia inteiro: com cume 88, "13% do cume" davam
      // 11,4 m de cota pintados de areia, e como o apron dessas ilhas é deitado,
      // isso cobria metade da terra. Praia tem largura de praia.
      } else if (f.y < 4.0) c.copy(C_AREIA)
      else if (f.y < 11.0) c.copy(C_AREIA).lerp(C_MATO, (f.y - 4.0) / 7.0)
      else if (f.y < spec.cume * 0.80) {
        c.copy(C_MATO).lerp(C_MATO_E, (f.y - 11.0) / Math.max(1, spec.cume * 0.80 - 11.0))
      } else c.copy(C_MATO_E).lerp(C_ROCHA, Math.min(1, (f.y - spec.cume * 0.80) / (spec.cume * 0.20)))
      const k = 0.95 + 0.10 * (rnFino(x / 30, z / 30) * 0.5 + 0.5)
      cor.push(c.r * k, c.g * k, c.b * k)
    }
  }
  for (let j = 0; j < NR; j++) {
    for (let i = 0; i < NA; i++) {
      const a0 = j * NA + i, a1 = j * NA + ((i + 1) % NA)
      const b0 = (j + 1) * NA + i, b1 = (j + 1) * NA + ((i + 1) % NA)
      // ⚠️ ÂNGULO PRIMEIRO, RAIO DEPOIS: +X × +Z dá −Y, e a ordem natural vira a
      // ilha para baixo. Esta armadilha mordeu quatro vezes nesta cena.
      idx.push(a0, b1, b0, a0, a1, b1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.translate(0, cota, 0)
  return g
}

export function buildIlhas(o: { cota: number; sombra?: boolean }): Ilhas {
  const group = new THREE.Group()
  group.name = 'ilhas'
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
  let tri = 0
  for (const il of ILHAS) {
    const g = geoIlha(il, o.cota)
    const m = new THREE.Mesh(g, mat)
    m.name = `ilha:${il.id}`
    m.position.set(il.x, 0, il.z)
    m.castShadow = o.sombra ?? true
    m.receiveShadow = true
    group.add(m)
    tri += (g.index?.count ?? 0) / 3
  }
  return {
    group, postas: ILHAS.length, triangulos: tri,
    dispose() {
      group.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() })
      mat.dispose(); group.clear()
    },
  }
}
