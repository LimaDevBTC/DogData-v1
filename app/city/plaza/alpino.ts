// ═══════════════════════════════════════════════════════════════════════════
// O ALPINO: a coroa de neve e a mata de conífera do maciço oeste, que é o
// pedaço de relevo que entrou pra dentro da abóbada quando ela cresceu de 7.050
// pra 9.050 m de raio.
//
// ⚠️ NÃO EXISTEM ALPES AQUI, E ESSE É O PARTIDO INTEIRO. Medido sobre a grade do
// terreno COMO CONSTRUÍDO (célula 40,1 m), recortada pelo interior da abóbada:
//   pico dentro da casca      321,7 m   (x = -8.234, z = -902; r = 8.283 m, azimute 264°)
//   mediana do terreno         10,6 m   (o chão da cidade é pódio plano)
//   p90 / p95 / p99     140,9 / 212,3 / 263,3 m
//   acima de 250 m       5,29 km², 2,06% da área, TUDO no anel de 6.032 a 9.050 m
//   acima de 300 m       0,09 km², desprezível
// 320 m de pico com a cidade a 10 m é um MORRO GRANDE, não um alpe. Pico nevado
// pontudo nessa proporção lê como brinquedo. Por isso a neve aqui é uma COROA
// no arco oeste, fundo encostado na casca, e não um destino.
//
// ⚠️ A COTA DE NEVE NÃO É UM CORTE NA COTA. Corte duro em h = 250 desenha uma
// CURVA DE NÍVEL, que a olho vira um círculo perfeito no morro e denuncia a
// conta. Três coisas quebram isso, e as três estão implementadas:
//   1. faixa de mistura de 30 m (235 a 265), não um degrau;
//   2. modulação por INCLINAÇÃO: neve não gruda em face íngreme, então a
//      cobertura cai de cheia em até 30° pra zero em 55°;
//   3. ruído de mundo de célula ~240 m deslocando o limiar em ±16 m.
//
// ⚠️ A MATA ENTRA ABAIXO DA NEVE, E ELA É QUEM DÁ A LEITURA DE MONTANHA. A faixa
// de 150 a 250 m é exatamente onde moram o p95 e o p99: é a última banda com
// área de verdade antes do branco. Sem ela o morro sobe do pódio direto pro
// gelo, e 320 m sozinhos não contam a história.
//
// ⚠️ UMA GRADE DE ALTURA SÓ, AMOSTRADA UMA VEZ. A neve precisa da grade e a mata
// precisa de altura em 210 mil candidatos: chamar `heightAt` nos dois seria meio
// milhão de consultas na construção. Aqui a grade de 40 m (a MESMA célula da
// grade do terreno, então não se perde informação) é amostrada uma vez dentro do
// anel e a mata lê dela por bilinear. NÃO MEDI o tempo de construção resultante.
//
// ⚠️ A ALTURA VEM DE `superficieAt`, NÃO DE `heightAt`. Regra da casa, e já
// custou um erro de 42 m: quem desenha coisa que ENCOSTA no chão tem de usar a
// linearização que a malha do regolito realmente mostra. Quem liga este módulo
// passa `terrain.superficieAt` no campo `heightAt` das opções, como fazem vias,
// praças, lotes e a arborização.
//
// Orçamento: 3 chamadas de desenho novas (neve, conífera de perto, conífera de
// longe) e 2 programas (a neve tem material próprio, transparente; as duas
// coníferas dividem um material só). Três, não cinco: os dois níveis de LOD da
// árvore são InstancedMesh sobre o MESMO material.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DOME_R } from './dome'
import { superficie, vestir } from './materiais'
import type { DistanceCuller, PerfProfile } from './perf'
import { INVERNO_ATIVO, zonaEsquiavelAt } from './inverno'

export interface AlpinoOpts {
  /** ⚠️ passe `terrain.superficieAt`, não `terrain.heightAt`. Ver cabeçalho. */
  heightAt: (x: number, z: number) => number
  /** está molhado? vem de `lagos.naAgua`, fonte única com quem desenha a água */
  molhado?: (x: number, z: number) => boolean
  /** está na rua? vem de `vias.naVia`. No anel de 6 a 9 km não deve haver rua,
   *  mas o teste é barato e evita conífera nascendo em pista se a malha crescer */
  naVia?: (x: number, z: number, folga?: number) => boolean
  sombra?: boolean
  profile?: PerfProfile
  culler?: DistanceCuller
}

export interface Alpino {
  group: THREE.Group
  /** coníferas plantadas */
  arvores: number
  /** área da coroa de neve efetivamente desenhada, em km² */
  neveKm2: number
  triangulos: number
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ── a geografia do problema, em metros ──────────────────────────────────────
/** piso do anel de trabalho. A medição põe TODO o terreno acima de 250 m entre
 *  6.032 e 9.050; 5.600 dá folga pro pé da mata sem varrer o pódio. */
const R_INT = 5600
const R_EXT = DOME_R          // 9.050
/** a célula da grade do terreno como construído */
const PASSO = 40

const COTA_NEVE = 250
/** meia largura da faixa de mistura: 235 a 265 */
const FAIXA_NEVE = 15
/** deslocamento do limiar pelo ruído de mundo */
const RUIDO_NEVE = 16
/** célula do ruído que quebra a curva de nível */
const CELULA_RUIDO = 240

// ⚠️ A COTA DE NEVE DO PARQUE DE INVERNO É OUTRA, E SÓ VALE DENTRO DA ZONA
// ESCULPIDA POR `inverno.ts`. 250 m fazia sentido para um morro de 321,7 m de
// pico (cobria só o 22% de cima, o que este cabeçalho já defendia: "coroa no
// arco oeste, não um destino"). A montanha nova sobe a ~1.066 m sobre uma base
// a 13 m: uma estação de esqui de verdade é nevada da base ao cume nas pistas
// preparadas, não só no topo. `COTA_NEVE_INVERNO = 70` cobre praticamente todo
// o relevo esculpido; fora da zona (`zonaEsquiavelAt` = 0) a conta volta a
// `COTA_NEVE = 250` de sempre, sem gelar encosta que não é do parque.
// Sem `?inverno=1`, `zonaEsquiavelAt` devolve 0 em qualquer ponto e esta
// mistura devolve `COTA_NEVE` puro: bit a bit o que já rodava.
const COTA_NEVE_INVERNO = 70

/** faixa da mata, com pluma nas duas pontas */
const MATA_BAIXO = 150
const MATA_ALTO = 250
const PLUMA_MATA = 25
/** espaçamento do candidato a conífera, antes das máscaras */
const PASSO_MATA = 26
/** teto duro de instâncias */
const TETO_ARVORES = 14000
/** além disto a conífera vira o volume de longe (8 triângulos) */
const R_CHEIA = 1400
/** ⚠️ O LOD NÃO SE REBALANCEIA POR QUADRO. Refazer 14 mil matrizes custa alguns
 *  ms; a mata está a 6 km da praça, então na prática o balde de perto fica vazio
 *  a viagem inteira. O passo é largo de propósito. NÃO MEDI o custo do refaz. */
const PASSO_REBALANCE = 400

// ── ruído determinístico: a montanha é a mesma em toda visita ───────────────
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function hash2(ix: number, iz: number, semente: number): number {
  return hash01((ix * 73856093) ^ (iz * 19349663) ^ (semente * 83492791))
}

/** valor-ruído bilinear em coordenada de mundo, saída em 0..1 */
function ruido(x: number, z: number, celula: number, semente: number): number {
  const fx = x / celula, fz = z / celula
  const ix = Math.floor(fx), iz = Math.floor(fz)
  const tx = fx - ix, tz = fz - iz
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz)
  const a = hash2(ix, iz, semente), b = hash2(ix + 1, iz, semente)
  const c = hash2(ix, iz + 1, semente), d = hash2(ix + 1, iz + 1, semente)
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz
}

function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

// ── cores ───────────────────────────────────────────────────────────────────
/** ⚠️ A NEVE NÃO É BRANCA #FFFFFF. Branco puro contra o regolito #9A948B estoura
 *  e some no céu; a neve real na sombra da manhã lê azulada. #E8ECF2 é o que
 *  sobra de branco depois que a luz da cena já é quente. */
const COR_NEVE = new THREE.Color('#E8ECF2')
/** agulha de conífera: mais escura e mais fria que a copa da cidade (#7E8A6B),
 *  porque é isso que separa a mata do morro da arborização de rua na mesma vista */
const COR_AGULHA = new THREE.Color('#3E5140')
const COR_FUSTE = new THREE.Color('#4A423A')

interface Arvore { x: number; z: number; y: number; esc: number; escXZ: number; giro: number }

/**
 * A coroa de neve e a mata do maciço oeste.
 *
 * Síncrona: não carrega arquivo nenhum, a textura da neve sai de `materiais`.
 */
export function buildAlpino(o: AlpinoOpts): Alpino {
  const group = new THREE.Group()
  group.name = 'alpino'

  // ── 1. a grade de altura, amostrada UMA VEZ dentro do anel ────────────────
  const N = Math.ceil((2 * R_EXT) / PASSO) + 1
  const h = new Float32Array(N * N)
  const valido = new Uint8Array(N * N)
  const xDe = (i: number) => -R_EXT + i * PASSO
  const idx = (i: number, j: number) => j * N + i
  // margem de um passo pra fora do anel útil: a inclinação usa diferença central
  const rMin = R_INT - PASSO * 2
  const rMax = R_EXT + PASSO * 2
  for (let j = 0; j < N; j++) {
    const z = xDe(j)
    for (let i = 0; i < N; i++) {
      const x = xDe(i)
      const r = Math.hypot(x, z)
      if (r < rMin || r > rMax) continue
      const k = idx(i, j)
      h[k] = o.heightAt(x, z)
      valido[k] = 1
    }
  }

  /** altura por bilinear na grade; devolve NaN se a célula não foi amostrada */
  const alturaEm = (x: number, z: number): number => {
    const fx = (x + R_EXT) / PASSO, fz = (z + R_EXT) / PASSO
    const i = Math.floor(fx), j = Math.floor(fz)
    if (i < 0 || j < 0 || i + 1 >= N || j + 1 >= N) return NaN
    const k00 = idx(i, j), k10 = idx(i + 1, j), k01 = idx(i, j + 1), k11 = idx(i + 1, j + 1)
    if (!valido[k00] || !valido[k10] || !valido[k01] || !valido[k11]) return NaN
    const tx = fx - i, tz = fz - j
    return (h[k00] * (1 - tx) + h[k10] * tx) * (1 - tz) + (h[k01] * (1 - tx) + h[k11] * tx) * tz
  }

  /** inclinação em graus por diferença central na grade */
  const inclinacaoEm = (i: number, j: number): number => {
    if (i <= 0 || j <= 0 || i + 1 >= N || j + 1 >= N) return 90
    const kxp = idx(i + 1, j), kxm = idx(i - 1, j), kzp = idx(i, j + 1), kzm = idx(i, j - 1)
    if (!valido[kxp] || !valido[kxm] || !valido[kzp] || !valido[kzm]) return 90
    const dx = (h[kxp] - h[kxm]) / (2 * PASSO)
    const dz = (h[kzp] - h[kzm]) / (2 * PASSO)
    return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI
  }

  /** cobertura de neve em 0..1: cota + faixa + inclinação + ruído */
  const neveEm = (x: number, z: number, alt: number, inc: number): number => {
    // ⚠️ COTA MISTURADA PELA ZONA DO PARQUE. Sem `?inverno=1`,
    // `zonaEsquiavelAt` é 0 em qualquer (x, z) e `cotaBase` é `COTA_NEVE` puro:
    // bit a bit a conta de sempre.
    const zona = INVERNO_ATIVO ? zonaEsquiavelAt(x, z) : 0
    const cotaBase = COTA_NEVE - (COTA_NEVE - COTA_NEVE_INVERNO) * zona
    const limiar = cotaBase + (ruido(x, z, CELULA_RUIDO, 11) * 2 - 1) * RUIDO_NEVE
    const t = suave01((alt - (limiar - FAIXA_NEVE)) / (2 * FAIXA_NEVE))
    if (t <= 0) return 0
    // neve não gruda em face muito íngreme: cheia até 30°, zero em 55°
    const s = 1 - suave01((inc - 30) / 25)
    // manchado fino, senão a coroa vira um esmalte uniforme
    const m = 0.82 + 0.18 * ruido(x, z, 70, 29)
    return Math.min(0.96, t * s * m)
  }

  // ── 2. a coroa: uma casca de quads sobre o terreno, alfa = cobertura ──────
  // ⚠️ MALHA PRÓPRIA E NÃO COR POR VÉRTICE DO TERRENO: o regolito é de
  // `terrain.ts`, que não é meu arquivo, e repintar vértice de lá seria mexer no
  // modelo de terreno de outro módulo. A casca sobe e vai com `polygonOffset`,
  // que é o par de cintos que a cena já usa em chão sobre chão.
  //
  // ⚠️ 0,4 m FIXO ENTERRAVA A NEVE NO FLANCO ÍNGREME, medido em 03/09: esta
  // grade (PASSO=40) interpola `superficieAt` nos SEUS próprios cantos, e a
  // malha grossa do terreno interpola os DELA (cell aprox 59 m). As duas são
  // aproximações diferentes da MESMA `heightAt`, e onde o relevo é raso (a
  // cidade) elas quase coincidem; onde é íngreme (o maciço, até 130% de
  // rampa) elas divergem de verdade. Varredura de 1.802 pontos fora da grade
  // no flanco do parque: divergência média 0,617 m, MÁXIMA 7,62 m (0,4% das
  // amostras acima de 5 m). 0,4 m de folga não cobre isso: a neve ficava
  // enterrada exatamente nos pontos mais íngremes, que também são os mais
  // visíveis de longe. A folga agora escala com `zonaEsquiavelAt` (0 fora do
  // parque, bit a bit os mesmos 0,4 m de sempre; até 9 m dentro dele, folga
  // sobre o pior caso medido).
  const LEVANTE_BASE = 0.4
  const LEVANTE_INVERNO = 9
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const cor: number[] = []
  const cobertura = new Float32Array(N * N)
  const conjNeve = superficie('concreto')
  const TILE = conjNeve.metros

  // ⚠️ ACHADO 03/09, medido offline antes de mexer: o pre-corte abaixo usava
  // `COTA_NEVE` (250) sozinho como piso, e isso e um limiar DIFERENTE do que
  // `neveEm` de fato usa quando a zona do parque baixa a cota para
  // `COTA_NEVE_INVERNO` (70). Resultado medido: qualquer ponto com altura
  // entre 39 e 219 m DENTRO da zona (cotaBase baixo, ainda deveria nevar)
  // nunca chegava a `neveEm`, porque o pre-corte já tinha descartado a
  // célula. Isso reduzia a área nevada, mas sozinho NAO explica zero neve
  // (a varredura offline com o mesmo bug ainda deu 13,258 km² > 0): é bug
  // real, corrigido aqui, mas não é a causa de "nem um pixel branco" sozinho.
  // O piso do pre-corte agora usa o MENOR limiar possível (o da zona do
  // parque, quando `?inverno=1` está ligado); é só uma otimização de
  // descarte, `neveEm` continua sendo quem decide de verdade.
  const pisoPreCorte = INVERNO_ATIVO
    ? Math.min(COTA_NEVE, COTA_NEVE_INVERNO) - FAIXA_NEVE - RUIDO_NEVE
    : COTA_NEVE - FAIXA_NEVE - RUIDO_NEVE
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j)
      if (!valido[k] || h[k] < pisoPreCorte) continue
      const x = xDe(i), z = xDe(j)
      if (Math.hypot(x, z) > R_EXT) continue
      cobertura[k] = neveEm(x, z, h[k], inclinacaoEm(i, j))
    }
  }

  let quads = 0
  const nv = new THREE.Vector3()
  const empurra = (i: number, j: number) => {
    const k = idx(i, j)
    const x = xDe(i), z = xDe(j)
    const zona = INVERNO_ATIVO ? zonaEsquiavelAt(x, z) : 0
    const levante = LEVANTE_BASE + (LEVANTE_INVERNO - LEVANTE_BASE) * zona
    pos.push(x, h[k] + levante, z)
    // normal da grade, não do quad: a casca acompanha o morro sem facetar
    const dx = (h[idx(i + 1, j)] - h[idx(i - 1, j)]) / (2 * PASSO)
    const dz = (h[idx(i, j + 1)] - h[idx(i, j - 1)]) / (2 * PASSO)
    nv.set(-dx, 1, -dz).normalize()
    nor.push(nv.x, nv.y, nv.z)
    // ⚠️ UV EM METROS DE MUNDO: `vestir` recebe `mundo = TILE` lá embaixo, então
    // o `repeat` sai 1 e o ladrilho já vem no tamanho certo daqui.
    uv.push(x / TILE, z / TILE)
    cor.push(COR_NEVE.r, COR_NEVE.g, COR_NEVE.b, cobertura[k])
  }
  for (let j = 1; j < N - 2; j++) {
    for (let i = 1; i < N - 2; i++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1)
      if (!valido[a] || !valido[b] || !valido[c] || !valido[d]) continue
      if (cobertura[a] + cobertura[b] + cobertura[c] + cobertura[d] <= 0.004) continue
      empurra(i, j); empurra(i + 1, j); empurra(i + 1, j + 1)
      empurra(i, j); empurra(i + 1, j + 1); empurra(i, j + 1)
      quads++
    }
  }

  let neve: THREE.Mesh | null = null
  const matNeve = new THREE.MeshStandardMaterial({
    // ⚠️ BRANCO NO `color` PORQUE A COR MULTIPLICA O MAPA, e aqui quem dá a cor
    // é a cor por vértice (que também multiplica). Pintar `color` de novo
    // escureceria a neve duas vezes.
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  vestir(matNeve, 'concreto', TILE, { normal: 0.45, macroMetros: 320 })
  if (quads > 0) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    // itemSize 4: o three liga USE_COLOR_ALPHA e o alfa por vértice vale
    g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 4))
    g.computeBoundingSphere()
    neve = new THREE.Mesh(g, matNeve)
    neve.name = 'alpino:neve'
    neve.castShadow = false
    neve.receiveShadow = false
    neve.renderOrder = 1
    group.add(neve)
  }

  // ── 3. a mata: candidatos em grade jitterada, filtrados pela faixa ────────
  const arvores: Arvore[] = []
  const passos = Math.floor((2 * R_EXT) / PASSO_MATA)
  for (let j = 0; j <= passos; j++) {
    for (let i = 0; i <= passos; i++) {
      const jx = (hash2(i, j, 3) - 0.5) * PASSO_MATA * 0.9
      const jz = (hash2(i, j, 7) - 0.5) * PASSO_MATA * 0.9
      const x = -R_EXT + i * PASSO_MATA + jx
      const z = -R_EXT + j * PASSO_MATA + jz
      const r = Math.hypot(x, z)
      if (r < R_INT || r > R_EXT - 30) continue
      const alt = alturaEm(x, z)
      if (!Number.isFinite(alt)) continue
      // ⚠️ 03/09: DENTRO DA ZONA DO PARQUE, QUEM PLANTA É `inverno.ts`. Ele
      // tem árvore de verdade (`tree-pine.glb`, `sequoia-mass.glb`, publicadas
      // pela frente de espécies especificamente pra isto) numa faixa própria
      // (15-190 m); manter a conífera de 34 triângulos daqui por cima
      // dobraria a densidade com duas espécies que não combinam. A faixa
      // MATA_BAIXO_INVERNO/MATA_ALTO_INVERNO que existia aqui virou código
      // morto por esse motivo e foi retirada: fora da zona nada mudou.
      const zonaMata = INVERNO_ATIVO ? zonaEsquiavelAt(x, z) : 0
      if (zonaMata > 0.04) continue
      // pluma nas duas pontas da faixa: a mata não começa nem acaba numa reta
      const dens = suave01((alt - (MATA_BAIXO - PLUMA_MATA)) / (2 * PLUMA_MATA))
        * (1 - suave01((alt - (MATA_ALTO - PLUMA_MATA)) / (2 * PLUMA_MATA)))
      if (dens <= 0.02) continue
      // manchado: mata de verdade tem clareira e adensamento
      const mancha = 0.35 + 0.9 * ruido(x, z, 180, 41)
      if (hash2(i, j, 13) > dens * mancha) continue
      // face muito íngreme não segura mata alta
      const ii = Math.round((x + R_EXT) / PASSO), jj = Math.round((z + R_EXT) / PASSO)
      if (inclinacaoEm(ii, jj) > 42) continue
      if (o.molhado?.(x, z)) continue
      if (o.naVia?.(x, z, 2.5)) continue
      const t = hash2(i, j, 17)
      arvores.push({
        x, z, y: alt,
        esc: 0.75 + t * 0.85,
        escXZ: 0.85 + hash2(i, j, 23) * 0.4,
        giro: hash2(i, j, 31) * Math.PI * 2,
      })
    }
  }

  // desbaste determinístico se passar do teto
  let mata = arvores
  if (arvores.length > TETO_ARVORES) {
    const manter = TETO_ARVORES / arvores.length
    mata = arvores.filter((_, i) => hash01(i * 2654435761) < manter)
  }

  // ── 4. duas geometrias, um material só ───────────────────────────────────
  const pinta = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  }
  // conífera de perto: fuste de 5 lados + duas saias de cone de 7 lados. 34 tris.
  const fuste = new THREE.CylinderGeometry(0.28, 0.42, 3.2, 5, 1, true)
  fuste.translate(0, 1.6, 0)
  const saiaA = new THREE.ConeGeometry(2.6, 6.0, 7, 1, true)
  saiaA.translate(0, 5.6, 0)
  const saiaB = new THREE.ConeGeometry(1.6, 4.4, 7, 1, true)
  saiaB.translate(0, 10.2, 0)
  const gPerto = mergeGeometries([
    pinta(fuste, COR_FUSTE), pinta(saiaA, COR_AGULHA), pinta(saiaB, COR_AGULHA),
  ], false)!
  // conífera de longe: um cone de 4 lados, 8 triângulos, mesma silhueta a 1,4 km
  const gLonge = pinta(new THREE.ConeGeometry(2.3, 11.5, 4, 1, false), COR_AGULHA)
  gLonge.translate(0, 5.75, 0)

  const matArvore = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true,
  })

  const cap = mata.length
  const perto = new THREE.InstancedMesh(gPerto, matArvore, Math.max(1, cap))
  const longe = new THREE.InstancedMesh(gLonge, matArvore, Math.max(1, cap))
  perto.name = 'alpino:conifera:perto'
  longe.name = 'alpino:conifera:longe'
  for (const m of [perto, longe]) {
    m.castShadow = o.sombra ?? false   // a mata está a 6 km: sombra dela não lê
    m.receiveShadow = false
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(m)
  }

  // ── 5. LOD por distância, refeito só quando a câmera anda ────────────────
  const m4 = new THREE.Matrix4()
  const vp = new THREE.Vector3()
  const vq = new THREE.Quaternion()
  const ve = new THREE.Euler()
  const vs = new THREE.Vector3()
  const ultima = new THREE.Vector3(1e9, 1e9, 1e9)

  const rebalancear = (cam: THREE.Vector3) => {
    let np = 0, nl = 0
    for (const a of mata) {
      const d = Math.hypot(a.x - cam.x, a.z - cam.z)
      const alvo = d < R_CHEIA ? perto : longe
      vp.set(a.x, a.y, a.z)
      ve.set(0, a.giro, 0)
      vq.setFromEuler(ve)
      vs.set(a.esc * a.escXZ, a.esc, a.esc * a.escXZ)
      m4.compose(vp, vq, vs)
      if (alvo === perto) perto.setMatrixAt(np++, m4)
      else longe.setMatrixAt(nl++, m4)
    }
    perto.count = np
    longe.count = nl
    perto.instanceMatrix.needsUpdate = true
    longe.instanceMatrix.needsUpdate = true
  }
  rebalancear(new THREE.Vector3(0, 0, 0))
  perto.computeBoundingSphere()
  longe.computeBoundingSphere()

  // ⚠️ REGISTRO NO CULLING COM DISTÂNCIA GENEROSA, DE PROPÓSITO. Esta coroa é
  // FUNDO: ela existe pra ser vista da cidade inteira, de 6 a 9 km. Cortá-la na
  // distância de mobiliário apagaria justamente o horizonte que ela desenha.
  o.culler?.add(group, 26000, new THREE.Vector3(0, 0, 0))

  const trisPerto = gPerto.attributes.position.count / 3
  const trisLonge = gLonge.index ? gLonge.index.count / 3 : gLonge.attributes.position.count / 3
  // custo declarado: a coroa em quads + a mata toda no volume de longe (o pior
  // caso do balde de perto, com a câmera dentro da mata, sobe cada árvore de
  // trisLonge para trisPerto)
  const triangulos = quads * 2 + Math.round(mata.length * trisLonge)
  void trisPerto

  return {
    group,
    arvores: mata.length,
    neveKm2: (quads * PASSO * PASSO) / 1e6,
    triangulos,
    update(cam: THREE.Vector3) {
      if (cam.distanceTo(ultima) < PASSO_REBALANCE) return
      ultima.copy(cam)
      rebalancear(cam)
    },
    dispose() {
      neve?.geometry.dispose()
      matNeve.dispose()
      gPerto.dispose()
      gLonge.dispose()
      matArvore.dispose()
      perto.dispose()
      longe.dispose()
      group.clear()
    },
  }
}
