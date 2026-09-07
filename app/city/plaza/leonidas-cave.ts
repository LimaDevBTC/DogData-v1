// O TEMPLO LEONIDAS DENTRO DA CAVERNA (praca-ajustes.md item 14, leonidas.md F4).
//
// O pedido do fundador: "o templo será preto e laranja, entre as monarcas, dentro
// de uma caverna", com caminho secreto. Em 07/09/2026 as duas peças de dentro
// foram trocadas, e é isto que a F4 ligou na cena:
//
//   · o GEODO (`leonidas-geode.glb`, 287,6 x 204 x 92,4 m, 143.790 tris, 5
//     materiais) no lugar da câmara de basalto de 64 m. Ele NÃO é um buraco: é
//     uma cavidade dentro da própria formação das runestones, com drusas do
//     mesmo tier das pedras marcadas crescendo para dentro. Traz o corredor em
//     S que corta a linha de visão, o mirante onde ele desemboca, a escadaria
//     de 20 degraus (a única régua humana da sala) e os matacões que escondem a
//     boca. Ver `blender/build_leonidas_geode.py`;
//   · a FORTALEZA-CAVEIRA (`leonidas-fortress.glb`, 121,2 x 124,5 x 62,86 m,
//     171.708 tris) no lugar do pagode japonês, que o fundador recusou ("esse
//     mini templo japonês não está à altura dele"). A caveira é FACHADA e a
//     nave é escavada no maciço atrás dela; a boca é a porta. Ver
//     `blender/build_leonidas_fortress.py`;
//   · o JARDIM DO PÁTIO é vegetação de caverna em volta da fortaleza: cogumelos
//     de textura emissiva e crostas de líquen, tudo em azul frio contra o âmbar
//     do templo. Ver `buildCaveGarden`;
//   · o CAMINHO SECRETO é uma fieira de lajes que sai do pódio do precinto e
//     vai rareando até a boca: quem não procurar, não acha.
//
// ⚠️ AS DUAS PEÇAS DE DENTRO NÃO ENTRAM NO BOOT, e é pedido explícito do
// fundador: "a cabeceira só vai ser vista por quem entrar na caverna, então
// podemos otimizar o carregamento". Elas carregam por PROXIMIDADE (ver o bloco
// do PORTÃO em `buildLeonidasCave`) e são descartadas ao sair, com dispose de
// geometria e material. O que fica no boot é só a boca: monólitos, fio de brasa,
// lanternas, braseiros, terraço e caminho secreto, que somam 146 KB de GLB.
//
// Quadro: tudo em LOCAL do parque (o mesmo de park.ts). O grupo é posto na
// soleira da boca, com +X saindo dela. Os três GLB (geodo, fortaleza e a câmara
// velha) usam a MESMA convenção, então nada aqui gira ou escala peça de dentro.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { loadSf, dressSf, SF } from './sf-assets'
import type { PerfProfile, DistanceCuller } from './perf'

/** A boca da caverna, em LOCAL do parque (x, z do three). Fica a 340 m do
 *  Monarca no azimute 80°, num pocket de flanco a 23° com cinco pedras grandes
 *  a menos de 110 m: escondida, mas entre as monarcas. */
export const CAVE_LOCAL = { x: 335, z: -59 }
/** giro do grupo: +X local sai pela boca, morro abaixo (azimute 80°) */
export const CAVE_YAW = THREE.MathUtils.degToRad(10)
/** A CAMADA DA CAVERNA. O sol da praça é uma direcional sem oclusão: ele
 *  atravessa a rocha e acende o piso da câmara como se não houvesse teto (medido:
 *  o interior lia cinza-médio). Piso e salão vão para esta camada, que o sol e o
 *  hemisférico NÃO enxergam, só as brasas daqui de dentro. A câmera precisa
 *  habilitá-la (`camera.layers.enable(CAVE_LAYER)` em plaza-scene). */
export const CAVE_LAYER = 3

const ORANGE = 0xf7931a
const EMBER = 0xff8a2b
/** o frio do jardim. O âmbar é do TEMPLO e o frio é da vegetação: separados
 *  assim, a câmara lê como duas coisas (um prédio aceso no meio de um mato que
 *  brilha), e não como um monte de luzinhas da mesma cor. */
const SPORE = 0x4a90d9
/** ATENÇÃO, o significado deste número encolheu. Ele era a escala que
 *  `build_leonidas_cave.py` aplicava na rocha inteira, espelhada aqui para que o
 *  .ts pudesse posicionar por múltiplos dela. A assadeira de 2026-08-26 passou a
 *  emitir METROS FINAIS, sem multiplicador nenhum, e o interior mudou de figura
 *  (o meio do salão andou de x = −44 para x ≈ −71).
 *
 *  Então o que ainda depende de `S` são SÓ as peças presas à soleira, que é a
 *  origem e não se mexeu: monólitos, fio de brasa do chão, lanternas da garganta,
 *  braseiros e as duas luzes da boca. Tudo que é do INTERIOR (templo, cumeeira,
 *  luz do salão, jardim) passou a ser MEDIDO da malha do piso em `chamberPlan`,
 *  justamente para não precisar de outra rodada de números na próxima ampliação. */
const S = 2.0
/** a cor da marca, a MESMA de park.ts:94 (as pedras marcadas do parque). O
 *  cristal do geodo é da família delas pelos parâmetros do tier, e é nesta cor
 *  que ele acende. */
const MARK = new THREE.Color(0.93, 0.91, 0.86)

// ── O CONTRATO DAS DUAS PEÇAS DE DENTRO ─────────────────────────────────────
// Tudo medido no GLB pronto (`blender/verify_leonidas_*.py`), não copiado de
// script nenhum. Quadro local do grupo, metros finais, +X saindo da boca.
const GEODO_URL = '/city/park/leonidas-geode.glb'
const FORTALEZA_URL = '/city/park/leonidas-fortress.glb'
/** Onde a fortaleza é assentada em X, e este número é a razão de ser da caverna
 *  nova. `build_leonidas_geode.py` escavou o geodo EM VOLTA da fortaleza posta
 *  em x = −213 (constante `FORT_AT` de lá), e a conta que manda é o
 *  enquadramento da chegada:
 *
 *   · o plano do rosto é o max x de FORT_Skull, **+22,93** local → −190,07;
 *   · o mirante (onde o corredor desemboca) fica em **x = −56**;
 *   · logo o visitante sai do corredor a **134,07 m** da fachada.
 *
 *  ⚠️ E O NÚMERO EXIGIDO É 133,6 m, NÃO OS 101,2 QUE O BRIEFING DIZIA. Os 101,2
 *  saem de D = (S/2)/tan(22,5)/0,75 com S = 62,86, que é só a ALTURA. A peça tem
 *  124,50 m de LARGURA, o dobro; num quadro 3:2 com fov vertical de 45 graus a
 *  meia-largura vale 1,5 x tan(22,5) = 0,6213 x D, então caber a 75% pede
 *  D = 62,25 / (0,75 x 0,6213) = 133,6 m. Medido em chapa: a 104 m a fortaleza
 *  ocupava 63,3% da altura e **192,5% da largura**, ou seja não cabia. */
const FORT_AT_X = -213
/** o plano do rosto no quadro LOCAL da fortaleza (max x de FORT_Skull, medido) */
const FORT_ROSTO_X = 22.93
/** a soleira do corredor, medida no geodo (LEDGE_X[0] + 4 m de passo) */
const MIRANTE_X = -56
/** o contrato de enquadramento: a distância mínima da soleira à fachada */
const D_LEITURA = 133.6

/** O EIXO DO CORREDOR EM S, em coordenadas do three (three.z = −blender.y), com
 *  a cota do piso junto. É o contrato de `build_leonidas_geode.py` (CORREDOR e
 *  CORREDOR_Z), e ele SOBE: quem entra sobe no escuro de 0 a 6,2 m e o salão se
 *  abre abaixo dele. A lista antiga tinha cinco pontos e cota fixa, e com ela as
 *  lanternas do fim do corredor ficariam 6 m dentro do piso novo. */
const CORREDOR: [number, number, number][] = [
  [34, 0.0, 0], [20, 0.6, 0], [8, 1.5, -1], [-5, 3.2, -10],
  [-18, 4.8, -16.5], [-31, 5.7, -13], [-42, 6.15, -6], [-52, 6.2, -1],
]
/** meia-largura do túnel na boca: vão de 7,2 m, pequeno de propósito */
const CORREDOR_MEIA = 3.6
/** ⚠️ O ALARGAMENTO NÃO É LINEAR, e uma reta aqui põe lanterna dentro da rocha.
 *  `build_leonidas_geode.py` abre o túnel em 2,35x mas SÓ DEPOIS DE 55% DO
 *  CAMINHO ("alargar desde a boca entregaria o interior de fora"), com um
 *  smoothstep nos 45% finais. Interpolando em reta, a meia-largura no meio do
 *  corredor daria 6,03 m contra os 3,6 m reais: uma lanterna a 0,8 disso ficaria
 *  1,2 m dentro da pedra. */
function alargamento(u: number): number {
  const s = THREE.MathUtils.clamp((u - 0.55) / 0.45, 0, 1)
  return 1 + 1.35 * (s * s * (3 - 2 * s))
}

/** Um ponto no eixo do corredor pelo parâmetro u ∈ [0,1], com a meia-largura. */
function noCorredor(u: number): { x: number; y: number; z: number; meia: number } {
  const t = THREE.MathUtils.clamp(u, 0, 1) * (CORREDOR.length - 1)
  const k = Math.min(CORREDOR.length - 2, Math.floor(t))
  const f = t - k
  const a = CORREDOR[k], b = CORREDOR[k + 1]
  return {
    x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f,
    meia: CORREDOR_MEIA * alargamento(THREE.MathUtils.clamp(u, 0, 1)),
  }
}

/** A cota do piso do corredor no x pedido. O eixo é monótono em x da boca até o
 *  mirante, então dá para perguntar por x sem parametrizar o caminho. */
function corredorEmX(x: number): number {
  for (let k = 0; k < CORREDOR.length - 1; k++) {
    const a = CORREDOR[k], b = CORREDOR[k + 1]
    if (x <= a[0] && x >= b[0]) return a[1] + (b[1] - a[1]) * ((a[0] - x) / Math.max(1e-6, a[0] - b[0]))
  }
  return x > CORREDOR[0][0] ? CORREDOR[0][1] : CORREDOR[CORREDOR.length - 1][1]
}

export interface LeonidasCave {
  group: THREE.Group
  /** o ponto de mundo da boca, para o menu Places */
  mouthLocal: THREE.Vector3
  /** `camWorld` é a câmera em MUNDO: é ela que abre e fecha o portão do interior.
   *  Sem ela a caverna anima o que já existe e não carrega nada. */
  update: (t: number, camWorld?: THREE.Vector3) => void
  dispose: () => void
}

/** Descarta uma hierarquia inteira: geometria, material e as texturas dele.
 *
 *  ⚠️ AS TEXTURAS SAEM PORQUE ESTAS PEÇAS NÃO SÃO COMPARTILHADAS. Os dois GLB do
 *  interior têm ZERO imagem embutida (medido no chunk glTF: nenhum `images`), e
 *  os dois cogumelos do jardim só são usados aqui e não passam por cache de
 *  módulo nenhum (`loadSf` refaz o `gltf.load` a cada chamada). Se um dia uma
 *  destas peças for compartilhada com outro módulo, esta função tem de parar de
 *  descartar textura, senão serve mapa morto para o outro. */
function descarta(root: THREE.Object3D) {
  const mats = new Set<THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    for (const mm of Array.isArray(m.material) ? m.material : [m.material]) if (mm) mats.add(mm)
  })
  for (const mm of mats) { soltaTexturas(mm as THREE.MeshStandardMaterial); mm.dispose() }
  root.removeFromParent()
}

/** Os mapas de um material. `Material.dispose()` NÃO leva textura junto, e é por
 *  isso que esta função existe separada: quem descarta uma peça inteira chama as
 *  duas, e quem descarta só o material de um clone chama esta na hora certa. */
function soltaTexturas(m: THREE.MeshStandardMaterial) {
  for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'] as const) {
    (m[k] as THREE.Texture | null)?.dispose()
  }
}

/** A planta do SALÃO, lida da malha do piso em tempo de execução: onde é o meio
 *  do pátio e até onde ele vai.
 *
 *  Por que a caixa da malha não serve: a mesma malha traz a laje do salão E a
 *  FITA DO CORREDOR, que sai da laje e vai até a boca. A união das duas puxa o
 *  centro para a boca e infla o comprimento. Medido em 2026-08-26: caixa de
 *  131 x 90 m para uma laje de 100 x 90 m, com o centro 16 m fora do lugar.
 *  Plantar por essa caixa joga canteiro dentro da rocha.
 *
 *  Então mede por FATIAS em x: a fatia do salão é larga (dezenas de metros de
 *  corda) e a do corredor é estreita (11,6 m no ponto mais aberto). Fica só o que
 *  for largo. A conta não sabe nada sobre a caverna de hoje: valeu para a laje
 *  redonda de ontem, vale para a elipse com rabo de hoje e vale para a próxima. */
function chamberPlan(mesh: THREE.Mesh, paraLocal: THREE.Matrix4, piso: PisoDoSalao): { cx: number; cz: number; r: number; top: number } | null {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return null
  const v = new THREE.Vector3()
  const box = new THREE.Box3()
  for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(paraLocal))
  const x0 = box.min.x, span = Math.max(1e-6, box.max.x - x0)
  const BINS = 48
  const lo = new Float64Array(BINS).fill(Infinity)
  const hi = new Float64Array(BINS).fill(-Infinity)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(paraLocal)
    const b = THREE.MathUtils.clamp(Math.floor(((v.x - x0) / span) * BINS), 0, BINS - 1)
    if (v.z < lo[b]) lo[b] = v.z
    if (v.z > hi[b]) hi[b] = v.z
  }
  let widest = 0
  for (let b = 0; b < BINS; b++) widest = Math.max(widest, hi[b] - lo[b])
  if (!(widest > 0)) return null
  let bMin = -1, bMax = -1, zMin = Infinity, zMax = -Infinity
  for (let b = 0; b < BINS; b++) {
    if (!(hi[b] - lo[b] >= widest * 0.35)) continue
    if (bMin < 0) bMin = b
    bMax = b
    zMin = Math.min(zMin, lo[b]); zMax = Math.max(zMax, hi[b])
  }
  if (bMin < 0) return null
  const w = span / BINS
  const ax0 = x0 + bMin * w, ax1 = x0 + (bMax + 1) * w
  // a laje é assada MAIOR que o vazio de propósito ("a borda enterra na parede e
  // não sobra fresta entre piso e rocha": 100 x 90 m de laje para 90 x 81 m de
  // salão). Então o pátio pisável é 0,88 da laje, não a laje inteira.
  const r = Math.min(ax1 - ax0, zMax - zMin) * 0.5 * 0.88
  const cx = (ax0 + ax1) * 0.5, cz = (zMin + zMax) * 0.5
  // ⚠️ `top` NÃO É MAIS `box.max.y`, E O GEODO É QUEM DERRUBOU AQUELA LINHA. A
  // malha do piso traz a RAMPA do corredor, que sobe até o mirante: medido no
  // GLB novo, `box.max.y` devolve 6,87 m (o parapeito do mirante) para um salão
  // cujo piso está em −0,82 m. Plantar por ele poria o jardim 7,7 m no ar.
  // Agora `top` é a cota medida no MEIO do salão, e cada peça pergunta a altura
  // no ponto dela em `piso.h`.
  return { cx, cz, r, top: piso.h(cx, cz) }
}

/** A ALTURA DO PISO, ponto a ponto, medida da malha e não presumida.
 *
 *  O piso do geodo NÃO é um plano: ele leva deslocamento (medido sob a pegada da
 *  fortaleza: de −1,28 a −0,28 m, mediana −0,82) e uma rampa de corredor que sobe
 *  de 0 a 6,2 m. Um número só para o salão inteiro afunda ou levanta cada peça
 *  por até meio metro, e cogumelo de 42 cm some.
 *
 *  Grade de 6 m guardando o MAIOR y de cada célula: a laje tem fundo também (a
 *  bacia desce a −7 m), e quem interessa é a superfície de cima. Fora da grade,
 *  a mediana. */
export interface PisoDoSalao {
  h: (x: number, z: number) => number
  mediana: number
  /** o MENOR y do piso dentro de uma pegada: é assim que uma peça se assenta sem
   *  pairar em ponto nenhum dela */
  minEm: (b: THREE.Box3) => number
}

function amostraPiso(mesh: THREE.Mesh, paraLocal: THREE.Matrix4): PisoDoSalao {
  const CEL = 6
  const grid = new Map<string, number>()
  const ys: number[] = []
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (pos) {
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(paraLocal)
      const k = `${Math.round(v.x / CEL)},${Math.round(v.z / CEL)}`
      const cur = grid.get(k)
      if (cur === undefined || v.y > cur) grid.set(k, v.y)
      ys.push(v.y)
    }
  }
  ys.sort((a, b) => a - b)
  const mediana = ys.length ? ys[ys.length >> 1] : 0
  const h = (x: number, z: number): number => {
    const cx = Math.round(x / CEL), cz = Math.round(z / CEL)
    // anel crescente: a célula exata, depois a vizinhança. Duas voltas bastam
    // (12 m), e além disso a peça está fora do piso e a mediana é a resposta
    for (let r = 0; r <= 2; r++) {
      let soma = 0, n = 0
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          if (r > 0 && Math.max(Math.abs(i), Math.abs(j)) !== r) continue
          const y = grid.get(`${cx + i},${cz + j}`)
          if (y !== undefined) { soma += y; n++ }
        }
      }
      if (n) return soma / n
    }
    return mediana
  }
  const minEm = (b: THREE.Box3): number => {
    let m = Infinity
    for (const [k, y] of grid) {
      const c = k.split(',')
      const x = Number(c[0]) * CEL, z = Number(c[1]) * CEL
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) m = Math.min(m, y)
    }
    return Number.isFinite(m) ? m : mediana
  }
  return { h, mediana, minEm }
}

/** Ruído determinístico por índice. `Math.random` é proibido nas cenas da praça:
 *  a mesma caverna precisa nascer idêntica em todo aparelho e em toda recarga,
 *  senão a chapa de ontem não compara com a de hoje. */
function hash1(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7 + 13.37) * 43758.5453123
  return s - Math.floor(s)
}

/** TODAS as primitivas de um GLB, com a matriz de mundo já assada na geometria:
 *  é o par (geometria, material) que o InstancedMesh exige. O `firstGeometry` do
 *  sf-assets devolve só a primeira, e o cogumelo em cacho tem duas (haste e
 *  chapéu, materiais diferentes), e com ela o chapéu ficava de fora. */
function primitivesOf(root: THREE.Object3D): { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] {
  const out: { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const geo = m.geometry.clone()
    geo.applyMatrix4(m.matrixWorld)
    out.push({ geo, mat: (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial })
  })
  return out
}

/** Adapta um material de cogumelo ao escuro da câmara. Os dois modelos já vêm com
 *  TEXTURA EMISSIVA do Sketchfab, que é o motivo de terem sido escolhidos: eles
 *  leem sem luz nenhuma, que é o pedido ("lá não teremos luz"). O que muda aqui:
 *   · a força do glTF (KHR_materials_emissive_strength = 7,3 no alto) estoura no
 *     tone mapping da praça e vira uma bola branca; cai para a banda de brasa;
 *   · a franja do chapéu é alfa. Transparente + InstancedMesh dá ordem de desenho
 *     errada (a franja de trás apaga a da frente); vira recorte por alphaTest;
 *   · sem céu na câmara, envMapIntensity alto só suja o preto. */
function shroomMat(src: THREE.MeshStandardMaterial, intensity: number, fallbackEmissive?: number): THREE.MeshStandardMaterial {
  const m = src.clone()
  if (!m.emissiveMap && fallbackEmissive !== undefined) m.emissive = new THREE.Color(fallbackEmissive)
  m.emissiveIntensity = intensity
  m.envMapIntensity = 0.1
  m.metalness = 0
  m.roughness = Math.min(1, (m.roughness ?? 0.7) + 0.15)
  if (m.transparent) { m.transparent = false; m.alphaTest = 0.45 }
  return m
}

/** O JARDIM DO PÁTIO, em LOCAL do grupo da caverna (mesmo quadro do salão).
 *
 *  Pedido do fundador: "um pátio com jardim em torno do templo (precisa ser algum
 *  tipo de planta diferente, pois lá não teremos luz)". Então a flora é de
 *  caverna: cogumelos de textura emissiva e crostas de líquen. A luz da cena é a
 *  PRÓPRIA vegetação: emissivo frio mais três pontos baratos, um por canteiro
 *  grande. O salão continua na penumbra, que é a graça.
 *
 *  NENHUMA posição é chutada. A rocha é assada no Blender e cresce de vez em
 *  quando (a escala já subiu de 1,35 para 2,0, e a câmara está sendo ampliada de
 *  novo), e o salão é assentado por medida. Tudo aqui sai do BOUNDING BOX real do
 *  piso da câmara e do salão, lidos depois de carregados: caverna maior, jardim
 *  maior, sem outra rodada de números.
 */
function buildCaveGarden(opts: {
  tall: THREE.Object3D | null
  cluster: THREE.Object3D | null
  /** a planta do salão, de `chamberPlan` */
  plan: { cx: number; cz: number; r: number; top: number }
  /** a caixa da FORTALEZA já assentada (era a do pagode) */
  hallBox: THREE.Box3 | null
  /** a altura do piso ponto a ponto: o geodo não tem piso plano */
  piso: PisoDoSalao
  low: boolean
}): { group: THREE.Group; mats: THREE.MeshStandardMaterial[]; lights: THREE.PointLight[]; junk: { dispose: () => void }[]; instances: number; draws: number } | null {
  const { plan, hallBox: hb, piso, low } = opts

  // ── a régua ──────────────────────────────────────────────────────────────
  const floorC = new THREE.Vector3(plan.cx, plan.top, plan.cz)
  const floorR = plan.r
  const hallC = new THREE.Vector3()
  // a calçada nua rente ao templo: a PLANTA dele mais 3,5 m de passeio. Guardado
  // como meia-caixa e não como raio de propósito: ver `hallRadius` abaixo.
  let keepX: number, keepZ: number
  if (hb) {
    hb.getCenter(hallC)
    const hs = hb.getSize(new THREE.Vector3())
    keepX = hs.x * 0.5 + 3.5
    keepZ = hs.z * 0.5 + 3.5
  } else {
    // sem salão (o glb do templo faltou), o jardim ainda acontece: um anel em
    // torno do meio do pátio, com um vazio no meio do tamanho de um templo
    hallC.copy(floorC)
    keepX = keepZ = floorR * 0.4
  }

  /** O raio da caixa do templo NA DIREÇÃO `a`. É a peça que evita os dois erros
   *  opostos que a conferência pegou: com um raio único de "meio-lado + folga" o
   *  anel entrava pelos CANTOS da planta (duas peças dentro do salão a 39° do
   *  eixo); com um raio único de meia-DIAGONAL ele limpava os cantos mas deixava
   *  10 m de piso nu nos flancos, porque a planta é 30 x 24,6 m e não um quadrado.
   *  Seguindo a caixa, o canteiro encosta no passeio dos quatro lados. */
  const hallRadius = (a: number) => {
    const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a))
    return Math.min(ca > 1e-3 ? keepX / ca : Infinity, sa > 1e-3 ? keepZ / sa : Infinity)
  }
  const hallMax = Math.hypot(keepX, keepZ)   // o canto: o mais longe que a caixa chega

  // o `off` desconta o quanto o templo está descentrado do pátio, então o aro
  // cabe dentro do piso em QUALQUER ângulo, não só no ângulo medido hoje
  const off = Math.hypot(hallC.x - floorC.x, hallC.z - floorC.z)
  const outer = Math.max(hallMax + 5, floorR - off - 2)
  // a clareira de quem entra: o corredor desemboca do lado +X do salão, então a
  // faixa central dessa direção não recebe planta nenhuma
  const laneHalf = Math.max(7, floorR * 0.3)
  const gapHalf = Math.asin(THREE.MathUtils.clamp(laneHalf / Math.max(1, (hallMax + outer) * 0.5), 0, 0.96)) + 0.14

  /** Encaixa um ponto no pátio: empurra para fora da PLANTA do templo, prende no
   *  aro do pátio, prende dentro do disco do piso e RECUSA o que cai na clareira
   *  da entrada.
   *
   *  ⚠️ A ORDEM DAS DUAS PRISÕES ERA UM DEFEITO ESCONDIDO, e a fortaleza o
   *  acendeu. A versão de ontem empurrava para fora do templo e SÓ DEPOIS
   *  prendia no disco do piso, e o segundo passo desfazia o primeiro: com o
   *  pagode de 30 m dentro de um salão de 90 m a diferença era centimétrica,
   *  mas com uma fortaleza de 121 x 124 m num salão de 288 x 204 a conta
   *  medida diz que um ponto atrás dela (135 m do meio do piso) voltava para
   *  93,5 m, ou seja para DENTRO da muralha. Agora o raio é preso de uma vez
   *  só, dentro da faixa que existe naquele ângulo: do passeio do templo até
   *  onde o disco do piso acaba. Se não sobrar faixa, não nasce planta ali. */
  const fit = (px: number, pz: number): { x: number; z: number } | null => {
    const dx0 = px - hallC.x, dz0 = pz - hallC.z
    const d = Math.hypot(dx0, dz0) || 1
    const ux = dx0 / d, uz = dz0 / d
    const need = hallRadius(Math.atan2(dz0, dx0))
    // até onde o disco do piso deixa ir NESTA direção (interseção raio/círculo)
    const ox = hallC.x - floorC.x, oz = hallC.z - floorC.z
    const b = ox * ux + oz * uz
    const c = ox * ox + oz * oz - (floorR - 1.5) * (floorR - 1.5)
    const disc = b * b - c
    if (disc <= 0) return null
    const cap = -b + Math.sqrt(disc)
    if (cap <= need) return null      // a fortaleza encosta na parede neste ângulo
    const rr = THREE.MathUtils.clamp(d, need, Math.min(outer, cap))
    const x = hallC.x + ux * rr, z = hallC.z + uz * rr
    if (x > hallC.x && Math.abs(z - hallC.z) < laneHalf) return null
    return { x, z }
  }

  // ── os canteiros: aglomerado, nunca peça solta espalhada por igual ────────
  // (a mesma lição dos afloramentos do parque: cristal nasce em flor, não em
  // pedra avulsa). Cada canteiro é um centro no anel com um punhado de peças
  // apertadas em volta; entre um canteiro e o outro, piso nu.
  const BEDS = low ? 6 : 9
  const beds: { x: number; z: number; r: number; vigor: number }[] = []
  for (let k = 0; k < BEDS; k++) {
    const t = (k + 0.5) / BEDS
    const a = gapHalf + t * (Math.PI * 2 - gapHalf * 2) + (hash1(k, 3) - 0.5) * 0.16
    // a faixa plantável naquele ângulo: do passeio do templo até o aro do pátio.
    // Ela é mais larga nos flancos (a planta é mais estreita lá), e é isso que
    // faz o jardim abraçar o prédio em vez de descrever um círculo em volta dele.
    const near = hallRadius(a)
    const reach = Math.max(2, outer - near)
    const p = fit(hallC.x + Math.cos(a) * (near + (0.15 + hash1(k, 7) * 0.55) * reach),
                  hallC.z + Math.sin(a) * (near + (0.15 + hash1(k, 7) * 0.55) * reach))
    if (!p) continue
    const vigor = 0.6 + hash1(k, 23) * 0.7
    beds.push({ x: p.x, z: p.z, r: Math.max(3, reach * (0.24 + vigor * 0.2)), vigor })
  }
  if (!beds.length) return null

  const mTall: THREE.Matrix4[] = []
  const mClump: THREE.Matrix4[] = []
  const mCap: THREE.Matrix4[] = []
  const mPad: THREE.Matrix4[] = []
  const o = new THREE.Object3D()
  // ⚠️ a cota vem de `piso.h(x, z)`, e não de um `floorTop` só para o salão
  // inteiro: o piso do geodo varia meio metro e a rampa do corredor sobe 6,2 m
  const push = (arr: THREE.Matrix4[], x: number, z: number, y: number, s: number, yaw: number, flat = 1) => {
    o.position.set(x, piso.h(x, z) + y, z)
    o.rotation.set(0, yaw, 0)
    o.scale.set(s, s * flat, s)
    o.updateMatrix()
    arr.push(o.matrix.clone())
  }

  let n = 0
  for (const bed of beds) {
    // o hero do canteiro: o cogumelo grande, quase no centro. Os dois modelos do
    // Sketchfab custam 1800 e 1600 triângulos cada, então é AQUI que o orçamento
    // do celular fraco se decide (medido: 70 mil triângulos no padrão); no LOW
    // cada canteiro leva um de cada e o resto do volume fica com o miúdo.
    const heroes = low ? 1 : (hash1(n, 17) > 0.58 ? 2 : 1)
    for (let i = 0; i < heroes; i++, n++) {
      const a = hash1(n, 41) * Math.PI * 2
      const rr = bed.r * 0.3 * hash1(n, 43)
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mTall, p.x, p.z, -0.12, 0.6 + hash1(n, 47) * 0.8, hash1(n, 53) * Math.PI * 2)
    }
    // os cachos de três, no meio-termo de altura
    const clumps = low ? 1 : 2 + (hash1(n, 29) > 0.5 ? 1 : 0)
    for (let i = 0; i < clumps; i++, n++) {
      const a = hash1(n, 59) * Math.PI * 2
      const rr = bed.r * (0.35 + hash1(n, 61) * 0.6)
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mClump, p.x, p.z, -0.1, 0.32 + hash1(n, 67) * 0.34, hash1(n, 71) * Math.PI * 2)
    }
    // o miúdo: chapéus baixos que fazem o canteiro ter chão
    const caps = Math.round((6 + bed.vigor * 6) * (low ? 0.55 : 1))
    for (let i = 0; i < caps; i++, n++) {
      const a = hash1(n, 73) * Math.PI * 2
      // sqrt: adensa o miolo do canteiro em vez de virar um anel oco
      const rr = bed.r * Math.sqrt(hash1(n, 79)) * 1.05
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mCap, p.x, p.z, -0.05, 0.5 + hash1(n, 83) * 0.95, hash1(n, 89) * Math.PI * 2)
    }
    // as crostas de líquen: o que amarra o canteiro no piso e vaza para fora dele
    const pads = low ? 0 : Math.round(4 + bed.vigor * 5)
    for (let i = 0; i < pads; i++, n++) {
      const a = hash1(n, 97) * Math.PI * 2
      const rr = bed.r * (0.2 + hash1(n, 101) * 1.25)
      const p = fit(bed.x + Math.cos(a) * rr, bed.z + Math.sin(a) * rr)
      if (p) push(mPad, p.x, p.z, 0.02, 0.7 + hash1(n, 103) * 1.9, hash1(n, 107) * Math.PI * 2, 0.09 + hash1(n, 109) * 0.08)
    }
  }

  const group = new THREE.Group()
  group.name = 'CaveGarden'
  const mats: THREE.MeshStandardMaterial[] = []
  const junk: { dispose: () => void }[] = []
  let draws = 0
  const addInst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], name: string) => {
    if (!ms.length) { geo.dispose(); return }
    const im = new THREE.InstancedMesh(geo, mat, ms.length)
    ms.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    // a esfera de recorte tem de sair das INSTÂNCIAS, não da geometria base: sem
    // isto o three mede um cogumelo de 5 m na origem do grupo (a soleira da boca)
    // e o anel inteiro some do quadro assim que a boca sai da tela
    im.computeBoundingSphere()
    // sem sombra: o orçamento de sombra da praça é das torres, e mato no escuro
    // não tem sombra para dar. A camada da caverna mantém o sol fora daqui.
    im.castShadow = false
    im.receiveShadow = false
    im.layers.set(CAVE_LAYER)
    im.name = name
    group.add(im)
    junk.push(im, geo)
    draws++
  }

  if (opts.tall) {
    for (const p of primitivesOf(opts.tall)) {
      const mat = shroomMat(p.mat, 1.9)
      mats.push(mat); junk.push(mat)
      addInst(p.geo, mat, mTall, 'CaveGardenTall')
    }
  }
  if (opts.cluster) {
    for (const p of primitivesOf(opts.cluster)) {
      // a haste não traz emissivo no glTF: sem um fio de brasa fria ela some no
      // preto e o chapéu fica flutuando
      const hasGlow = !!p.mat.emissiveMap
      const mat = shroomMat(p.mat, hasGlow ? 1.5 : 0.55, SPORE)
      mats.push(mat); junk.push(mat)
      addInst(p.geo, mat, mClump, hasGlow ? 'CaveGardenClumpCap' : 'CaveGardenClumpStem')
    }
  }
  // os modelos carregados não entram na cena, só as instâncias: a geometria
  // original pode ir embora agora. As texturas ficam, porque `clone()` de material
  // compartilha a referência delas com os clones que estão em uso.
  for (const src of [opts.tall, opts.cluster]) {
    src?.traverse((x) => { const mm = x as THREE.Mesh; if (mm.isMesh) mm.geometry.dispose() })
  }

  // ── o miúdo, feito à mão ─────────────────────────────────────────────────
  // Chapéu e haste na MESMA geometria e no MESMO material: um material por peça
  // dobraria a chamada de desenho para ganhar uma haste escura de 30 cm que
  // ninguém vê. Aqui a peça inteira brilha, que é o que fungo de caverna faz.
  {
    const capGeo = mergeGeometries([
      new THREE.SphereGeometry(0.42, 9, 4, 0, Math.PI * 2, 0, Math.PI * 0.54).scale(1, 0.66, 1).translate(0, 0.58, 0),
      new THREE.CylinderGeometry(0.07, 0.12, 0.6, 6, 1, true).translate(0, 0.3, 0),
    ])
    if (capGeo) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: SPORE, emissiveIntensity: 0.9, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
      mats.push(mat); junk.push(mat)
      addInst(capGeo, mat, mCap, 'CaveGardenCaps')
    }
    // a crosta: uma calota bem baixa, não um disco chapado (disco briga em z com
    // o piso e pisca); a escala em y achata cada uma de um jeito
    const padGeo = new THREE.SphereGeometry(1, 8, 2, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const padMat = new THREE.MeshStandardMaterial({ color: 0x0b1a1e, emissive: SPORE, emissiveIntensity: 0.45, roughness: 0.9, metalness: 0 })
    mats.push(padMat); junk.push(padMat)
    addInst(padGeo, padMat, mPad, 'CaveGardenLichen')
  }

  // ── a luz: TRÊS pontos, nos canteiros mais fortes ────────────────────────
  // O orçamento da praça é ≤ 10 PointLights na cena inteira e a caverna já gasta
  // três; então o jardim leva o mínimo que faz a poça de luz fria aparecer no
  // piso, e todo o resto do brilho é emissão (que não custa luz nenhuma).
  const lights: THREE.PointLight[] = []
  const strong = beds.slice().sort((a, b) => b.vigor - a.vigor).slice(0, low ? 1 : 3)
  for (const bed of strong) {
    const l = new THREE.PointLight(SPORE, 34, 44, 1.7)
    l.layers.enable(CAVE_LAYER) // acende os dois: a rocha (camada 0) e o pátio
    l.position.set(bed.x, piso.h(bed.x, bed.z) + 2.6, bed.z)
    group.add(l)
    lights.push(l)
  }

  return { group, mats, lights, junk, instances: mTall.length + mClump.length + mCap.length + mPad.length, draws }
}

export async function buildLeonidasCave(opts: {
  gltf: GLTFLoader
  /** altura LOCAL do chão do parque */
  groundLocal: (lx: number, lz: number) => number
  /** de onde sai o caminho secreto (o pódio do precinto), em local do parque */
  pathFrom: { x: number; z: number }
  /** o centro do parque em MUNDO: o culling mede distância em mundo, e passar
   *  a posição local escondia a caverna sempre (bug medido em 2026-08-19) */
  parkCenter: THREE.Vector3
  profile?: PerfProfile
  culler?: DistanceCuller
}): Promise<LeonidasCave | null> {
  const loadGlb = (url: string) => new Promise<THREE.Object3D | null>((res) => opts.gltf.load(url, (g) => res(g.scene), undefined, () => { console.warn('[plaza] caverna ausente', url); res(null) }))
  const group = new THREE.Group()
  group.name = 'LeonidasCave'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  /** o que respira e não é do interior: a brasa da boca */
  const emissives: THREE.Material[] = []


  // ── a soleira: dois monólitos, o fio de brasa no chão, brasa nas paredes ──
  // A primeira versão tinha uma verga atravessada de ponta a ponta: de longe
  // virava uma barra amarela chapada, um travessão de plástico na boca da
  // caverna. Saiu. O que fica é pedra preta e brasa rasteira.
  {
    const black = track(new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.85, metalness: 0.15 }))
    const glow = track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.5, roughness: 0.5 }))
    emissives.push(glow)
    const mono = track(new THREE.CylinderGeometry(1.2, 2.1, 18, 6))
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(mono, black)
      // ⚠️ ombreiras da porta NOVA: a boca foi de 19 m de vão para 7,2 m na
      // reforma de 26/08. Com z = +-9,4 os monólitos ficavam a 18,8 m um do
      // outro, longe da porta, e liam como pedras avulsas no terraço.
      p.position.set(5.5 * S, 9, s * 5.0)
      p.rotation.y = s * 0.3
      p.castShadow = true
      group.add(p)
    }
    // o fio de brasa da soleira: uma linha no chão, atravessando a boca
    // 7,6 m e não 18,5: o fio atravessa a BOCA (vão de 7,2 m), e não o vão
    // antigo. Com 18,5 ele sobrava 5,6 m para cada lado, entrando na rocha.
    //
    // ⚠️ E ELE SUBIU 1,2 m COM O GEODO, senão ficava ENTERRADO. A fita do
    // corredor novo é uma RAMPA: medida na malha, a superfície em x = 11 vai de
    // 1,03 a 1,50 m (o eixo do contrato dá 1,28), contra os 0 m da câmara velha.
    // Um fio a y = 0,1 sumia debaixo do piso. Ele agora é mais alto que fino
    // (0,6 em vez de 0,16) e fica meio enterrado de propósito: assentado em 1,295
    // ele vai de 0,995 a 1,595, ou seja aparece de 10 a 57 cm ao longo dos 7,6 m
    // e não flutua em ponto nenhum do deslocamento de ±0,24 m da laje.
    const sill = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.6, 7.6)), track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.4, roughness: 0.6 })))
    sill.position.set(5.5 * S, corredorEmX(5.5 * S) + 0.02, 0)
    group.add(sill)
    // as lanternas da garganta: brasa nas paredes, sem custo de luz
    const lampGeo = track(new THREE.SphereGeometry(0.2, 10, 8))
    // ⚠️ O CORREDOR NOVO SOBE, e não só serpenteia. O eixo de cinco pontos com
    // cota fixa (y = 6,2) foi feito para um corredor plano de 65 m; o do geodo
    // tem 86 m, desvia 16,5 m do eixo e SOBE de 0 a 6,2 m até o mirante. Com a
    // lista velha, as duas primeiras lanternas boiavam 6 m acima do chão da boca
    // e as últimas ficavam dentro da rampa. Agora elas seguem `CORREDOR`, que é
    // o contrato da assadeira, e encostam na parede pela meia-largura local, com
    // 20% de folga para o deslocamento de ±0,75 m que o túnel levou.
    // A altura fica entre 3,2 e 4,2 m acima do piso: o perfil do túnel é uma
    // parede reta até 4,6 m e só depois vira meia-cana, então a lanterna encosta
    // no trecho vertical e não some dentro da abóbada.
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1
      // ⚠️ o passeio começa em u = 0,30 e não na boca: a face da rocha está em
      // x = +8,4 a +10,7 (medida a raio pelo verificador), que é u ≈ 0,29. As duas
      // primeiras lanternas da versão antiga caíam em x = 28 e 12, ou seja FORA
      // da caverna, boiando a 4 m do chão do terraço sem parede atrás.
      const p = noCorredor(0.30 + (i / 5) * 0.62)
      const lamp = new THREE.Mesh(lampGeo, glow)
      lamp.position.set(p.x, p.y + 4.2 - (i % 3) * 0.5, p.z + side * p.meia * 0.8)
      group.add(lamp)
    }
  }

  // ── os braseiros da soleira: quem chega vê fogo antes de ver a porta ─────
  {
    const brazier = await loadSf(opts.gltf, '/city/sf/brazier.glb')
    if (brazier) {
      dressSf(brazier, { envMapIntensity: 0.3, roughness: 0.8 })
      const b = new THREE.Box3().setFromObject(brazier)
      const k = 3.6 / Math.max(0.001, b.getSize(new THREE.Vector3()).y) // 3,6 m de altura
      for (const s of [-1, 1]) {
        const g = brazier.clone(true)
        g.scale.setScalar(k)
        g.position.set(9.5 * S, -b.min.y * k, s * 13)
        g.rotation.y = s * 0.4
        group.add(g)
        const fire = new THREE.Mesh(track(new THREE.SphereGeometry(0.55, 10, 8)), track(new THREE.MeshBasicMaterial({ color: 0xffa23a })))
        fire.position.set(9.5 * S, (b.max.y - b.min.y) * k * 0.98, s * 13)
        group.add(fire)
      }
    }
  }

  group.position.set(CAVE_LOCAL.x, opts.groundLocal(CAVE_LOCAL.x, CAVE_LOCAL.z), CAVE_LOCAL.z)
  group.rotation.y = CAVE_YAW

  // ── o TERRAÇO da boca ────────────────────────────────────────────────────
  // O flanco cai 19° na frente da caverna: medido, o chão está 4 m ABAIXO da
  // soleira a 15 m da boca e 9 m abaixo a 30 m. Sem isto, o portal e os matacões
  // pairam. O terraço é uma prateleira de rocha que sai da soleira, desce de
  // leve e funde no terreno no aro, e por dentro do morro ele fica enterrado, que
  // é como uma sacada de rocha se comporta.
  const apron = (() => {
    const RINGS = 18, SECT = 40, R = 34 * S
    const HALF = Math.PI * 0.62 // leque: o disco inteiro entrava pela câmara adentro
    const cx = CAVE_LOCAL.x, cz = CAVE_LOCAL.z
    const floorY = opts.groundLocal(cx, cz)
    const pos: number[] = [], idx: number[] = []
    const smooth = (e0: number, e1: number, x: number) => { const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }
    for (let i = 0; i <= RINGS; i++) {
      const r = (i / RINGS) * R
      for (let j = 0; j <= SECT; j++) {
        const a = CAVE_YAW * -1 + (j / SECT - 0.5) * 2 * HALF
        const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r
        const terr = opts.groundLocal(px, pz)
        const ledge = floorY - 0.1 - Math.max(0, r - 24) * 0.2 + Math.sin(a * 3 + r * 0.2) * 0.35 * smooth(8, 24, r)
        const y = THREE.MathUtils.lerp(Math.max(ledge, terr), terr, smooth(R - 12, R, r))
        pos.push(px, y, pz)
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SECT; j++) {
        const a0 = i * (SECT + 1) + j, b0 = a0 + SECT + 1
        // sentido anti-horário visto DE CIMA: com o outro sentido o terraço
        // ficava de costas para o céu e sumia (backface), e os matacões pareciam
        // flutuar sobre o nada
        idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0)
      }
    }
    const geo = track(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.95, metalness: 0.05 }))
    const m = new THREE.Mesh(geo, mat)
    m.name = 'CaveApron'
    m.receiveShadow = true
    return m
  })()

  // ── o caminho secreto: lajes do pódio até a boca, rareando no fim ────────
  const path = (() => {
    const A = new THREE.Vector2(opts.pathFrom.x, opts.pathFrom.z)
    const B = new THREE.Vector2(CAVE_LOCAL.x + 28 * Math.cos(CAVE_YAW), CAVE_LOCAL.z - 28 * Math.sin(CAVE_YAW))
    const mid = A.clone().lerp(B, 0.5)
    const perp = new THREE.Vector2(-(B.y - A.y), B.x - A.x).normalize()
    // a curva desvia 150 m para o norte: o caminho contorna o esporão, não sobe reto
    const C = mid.add(perp.multiplyScalar(150))
    const N = 132
    const mats: THREE.Matrix4[] = []
    const o = new THREE.Object3D()
    const p = new THREE.Vector2()
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      // quadrática de Bézier A → C → B
      const w0 = (1 - u) * (1 - u), w1 = 2 * (1 - u) * u, w2 = u * u
      p.set(A.x * w0 + C.x * w1 + B.x * w2, A.y * w0 + C.y * w1 + B.y * w2)
      // rareia perto da caverna: as últimas lajes só aparecem de perto
      if (u > 0.72 && i % 2 === 1) continue
      const jitter = Math.sin(i * 12.9898) * 43758.5453
      const j = jitter - Math.floor(jitter)
      const side = (i % 2 === 0 ? 1 : -1) * (0.7 + j * 0.9)
      const dx = Math.cos(u * 3.1) * 0, dz = 0
      o.position.set(p.x + side * 0.9 + dx, opts.groundLocal(p.x, p.y) + 0.12, p.y + side * 0.5 + dz)
      o.rotation.set(0, j * 6.28, 0)
      o.scale.setScalar(0.85 + j * 0.5)
      o.updateMatrix()
      mats.push(o.matrix.clone())
    }
    // as lajes: mais claras que a rocha, senão o caminho não se acha nem de
    // perto (medido na chapa: a 300 m ele sumia por completo no regolito)
    const geo = track(new THREE.BoxGeometry(2.2, 0.3, 1.5))
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.85, metalness: 0.1 }))
    const im = new THREE.InstancedMesh(geo, mat, mats.length)
    mats.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.receiveShadow = true
    im.name = 'SecretPath'
    // as marcas: a cada dez lajes uma brasa baixa, do tamanho de um mojão. É o
    // que transforma "sumido" em "secreto": quem procura, segue.
    const markGeo = track(new THREE.ConeGeometry(0.34, 1.15, 6))
    const markMat = track(new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: ORANGE, emissiveIntensity: 0.55, roughness: 0.6 }))
    const marks = mats.filter((_, i) => i % 10 === 4)
    const mim = new THREE.InstancedMesh(markGeo, markMat, marks.length)
    marks.forEach((m, i) => {
      const p = new THREE.Vector3().setFromMatrixPosition(m)
      mim.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x + 2.2, p.y + 0.5, p.z + 1.4))
    })
    mim.instanceMatrix.needsUpdate = true
    mim.name = 'SecretPathMarks'
    const g = new THREE.Group()
    g.name = 'SecretPath'
    g.add(im, mim)
    return g
  })()

  const holder = new THREE.Group()
  holder.name = 'LeonidasCaveSite'
  holder.add(group, apron, path)
  const CULL = (opts.profile?.parkDetailCull ?? 4200) * 1.3
  const cullAt = new THREE.Vector3(CAVE_LOCAL.x, 0, CAVE_LOCAL.z).add(opts.parkCenter)
  opts.culler?.add(group, CULL, cullAt)
  opts.culler?.add(apron, CULL, cullAt)
  opts.culler?.add(path, opts.profile?.parkDetailCull ?? 4200, cullAt)
  // ⚠️ O JARDIM ENTRA NO CULLING POR UM PORTA-COPOS QUE NUNCA MORRE, e a razão é
  // que `DistanceCuller` só sabe `add`: ele guarda a referência para sempre.
  // Registrar o grupo do jardim direto (como era ontem, quando ele nascia uma vez
  // só) vazaria um grupo descartado a cada entrada e saída da caverna. Este nó
  // fica vazio quando o jardim não existe.
  // Ele é miúdo dentro de uma câmara: some antes da rocha, que ainda precisa ler
  // de longe como um contraforte.
  const jardimHolder = new THREE.Group()
  jardimHolder.name = 'CaveGardenHolder'
  group.add(jardimHolder)
  opts.culler?.add(jardimHolder, (opts.profile?.parkDetailCull ?? 4200) * 0.7, cullAt)

  // ══ O PORTÃO: as duas peças de dentro entram por PROXIMIDADE ═══════════════
  //
  // Pedido do fundador, 07/09: "a cabeceira só vai ser vista por quem entrar na
  // caverna, então podemos otimizar o carregamento". As duas somam 3.466.180
  // bytes de GLB e 315.498 triângulos, e NENHUM dos dois byte entra no boot: a
  // câmera nasce na praça, a 11.800 m do centro do parque, e o gatilho mais
  // largo daqui é de 6.825 m da boca.
  //
  // ⚠️ SÃO DOIS GATILHOS PORQUE SÃO DUAS FUNÇÕES, e um número só erraria os dois:
  //
  //  · o GEODO é o MACIÇO. A casca dele é a rocha que se vê de fora (a cavidade
  //    fica dentro dela), então ele tem de existir sempre que o sítio for
  //    desenhado. O gatilho é o próprio raio do culling vezes 1,25: assim ele
  //    chega ANTES de o culling mostrar o sítio, e nunca se vê o pátio sem pedra.
  //    Medido com o perfil padrão: culling a 5.460 m, gatilho a 6.825 m.
  //  · a FORTALEZA é invisível de fora, e isto foi MEDIDO e não suposto: dos 600
  //    raios que o verificador do geodo atira de fora, ZERO alcança o salão. O
  //    gatilho dela não é visibilidade, é TEMPO DE REDE: 2.540.024 bytes precisam
  //    chegar antes do mirante. De 420 m da boca até o mirante há 420 + 86 m de
  //    corredor = 506 m de caminhada, folgado até em rede de 1 Mbps.
  //
  // A histerese (sair só 200 m / 15% depois de entrar) existe para quem anda na
  // fronteira não ficar baixando e descartando o mesmo arquivo.
  //
  // ⚠️ O QUE ISTO CUSTA, DECLARADO. As oito PointLight desta caverna (cinco do
  // salão, três do jardim) nascem e morrem com o interior, e a contagem de luzes
  // faz parte da chave de cache de programa do three (a nota grande de
  // `DistanceCuller.add` em perf.ts conta a história: uma ida e volta de câmera
  // subiu os programas compilados de 444 para 480). Aqui a troca é deliberada e
  // as duas pontas foram pesadas:
  //  · sem o portão, 8 pontuais ficam no laço de fragmento da praça INTEIRA para
  //    sempre, e hoje já são 6 (as 3 da câmara mais as 3 do jardim);
  //  · com o portão, são ZERO enquanto o visitante não está na caverna, ao preço
  //    de DUAS famílias de programa (com caverna e sem), que é um número fechado
  //    e não uma família nova por travessia, porque a histerese impede o
  //    liga-desliga na fronteira.
  // O que sobra de dívida é pequeno e fica registrado: o inventário de luz do
  // culling guarda a referência das luzes que já morreram (ele só sabe somar),
  // então cada ida e volta completa deixa 8 entradas mortas na lista dele.
  // Custam duas escritas de propriedade por quadro cada uma e nada mais.
  const GEO_IN = CULL * 1.25, GEO_OUT = CULL * 1.45
  const FORT_IN = 420, FORT_OUT = 620

  /** o interior, que nasce vazio e pode voltar a ficar vazio */
  let geodo: THREE.Object3D | null = null
  let fortaleza: THREE.Object3D | null = null
  let baixandoGeodo = false, baixandoFort = false
  let piso: PisoDoSalao | null = null
  let plan: { cx: number; cz: number; r: number; top: number } | null = null
  let garden: ReturnType<typeof buildCaveGarden> = null
  let gardenBase: number[] = []
  let lights: { l: THREE.PointLight; base: number; fase: number; ritmo: number }[] = []
  let ambiente: THREE.AmbientLight | null = null
  /** o emissivo do INTERIOR, cada um com a força com que nasceu (o cristal do
   *  geodo é um sussurro de 0,016 e a órbita da fortaleza é 1,35: uma respiração
   *  única para os dois apagaria um e estouraria o outro) */
  let brasas: { m: THREE.MeshStandardMaterial; base: number }[] = []
  let dist = Infinity

  /** ⚠️ O QUADRO. Enquanto o grupo estava na origem, `Box3.setFromObject` já
   *  devolvia a caixa LOCAL e o código de ontem dependia disso ("medido AQUI,
   *  antes do grupo sair da origem"). O interior agora chega TARDE, com o grupo
   *  já em CAVE_LOCAL e girado 10°: medir em mundo devolveria a caixa 335 m fora
   *  do lugar. Esta matriz leva do mundo de volta ao local do grupo. */
  const paraLocalDe = (obj: THREE.Object3D): THREE.Matrix4 => {
    group.updateMatrixWorld(true)
    obj.updateMatrixWorld(true)
    return new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(obj.matrixWorld)
  }
  /** a caixa de uma peça no quadro LOCAL do grupo, medida na malha JÁ girada e
   *  escalada (que é a lição que este arquivo já pagou uma vez: a caixa medida
   *  antes do giro deixou o salão pairando) */
  const caixaLocal = (obj: THREE.Object3D): THREE.Box3 => {
    group.updateMatrixWorld(true)
    obj.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
    const m = new THREE.Matrix4()
    const box = new THREE.Box3()
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const bb = mesh.geometry.boundingBox
      if (!bb) return
      m.multiplyMatrices(inv, mesh.matrixWorld)
      box.union(bb.clone().applyMatrix4(m))
    })
    return box
  }

  /**
   * ⚠️ O CORTE POR TIER, E ELE LÊ UM CAMPO DO PERFIL DE VERDADE. Aceitar o perfil
   * só por ele existir é defeito que esta casa já teve duas vezes (ver a nota de
   * `cortaTextura` em perf.ts). Aqui a pergunta é explícita: `quality` e `tier`.
   *
   * 88.072 dos 143.790 triângulos do geodo (61,3%) são descartáveis SEM REASSAR
   * NADA, porque `GEO_Drusas` (51.032), `GEO_Talus` (18.980), `GEO_Vein` (12.980)
   * e `GEO_Stalactites` (5.080) são objetos separados com material próprio. Sem
   * eles a caverna cai para 55.718 tris e continua sendo a mesma caverna, só mais
   * nua: a casca (46.016), o piso (5.862) e os três matacões (3.840) ficam.
   *
   * ⚠️ E OS DOIS NÚMEROS DO DOSSIÊ ESTAVAM ERRADOS, conferidos aqui na soma dos
   * mesmos objetos que ele lista: 51.032 + 18.980 + 12.980 + 5.080 = 88.072, e
   * não 80.072; logo o resto é 55.718 e não "~63.700". Os valores por objeto
   * dele batem com o GLB; a subtração é que não fechava.
   *
   * A fortaleza NÃO entra neste corte, e é regra escrita da F4: "teto por tier
   * vale para o que ACOMPANHA a fortaleza, não para ela mesma". Ela é vista de
   * 20 m do rosto, e é a peça.
   */
  const ORNAMENTO = new Set(['GEO_Drusas', 'GEO_Talus', 'GEO_Vein', 'GEO_Stalactites'])
  const magro = (() => {
    const p = opts.profile
    if (!p) return false
    if (p.quality === 'high') return false          // quem pediu HIGH pediu tudo
    return p.quality === 'low' || p.tier === 'mobile'
  })()

  async function abreGeodo() {
    baixandoGeodo = true
    const [rock, shroomTall, shroomClump] = await Promise.all([
      loadGlb(GEODO_URL), loadSf(opts.gltf, SF.shroomTall), loadSf(opts.gltf, SF.shroomCluster),
    ])
    baixandoGeodo = false
    if (!rock) return
    // o visitante pode ter ido embora enquanto a rede respondia
    if (dist > GEO_OUT) { descarta(rock); if (shroomTall) descarta(shroomTall); if (shroomClump) descarta(shroomClump); return }

    // ── a rocha ─────────────────────────────────────────────────────────────
    // O sol da praça é uma direcional sem oclusão: ele entra pela rocha e acende
    // o piso da câmara como se não houvesse teto. Como sombra a 5 km não é opção
    // (o mapa de sombra é da praça), o interior se defende pelo ALBEDO.
    let floorMesh: THREE.Mesh | null = null
    const podados: THREE.Object3D[] = []
    dressSf(rock, { envMapIntensity: 0.12, roughness: 0.95, castShadow: true })
    rock.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (magro && ORNAMENTO.has(o.name)) { podados.push(o); return }
      m.receiveShadow = true
      const mat = m.material as THREE.MeshStandardMaterial
      if (!mat) return
      // ⚠️ SÓ A ROCHA LANÇA SOMBRA, e é a mesma conta da fortaleza: o passe de
      // sombra da praça é da direcional, que não entra na caverna, e ele testa a
      // camada da CÂMERA (que tem a CAVE_LAYER ligada), então tudo o que estiver
      // com `castShadow` é redesenhado nele. Deixar o `dressSf` valer para o
      // interior inteiro mandaria 93.934 triângulos de drusa, talus, veio,
      // estalactite e piso para o mapa de sombra a cada quadro, para produzir
      // sombra nenhuma. A casca e os matacões ficam: eles são o maciço que o sol
      // do parque vê de fora.
      m.castShadow = mat.name === 'CaveRock'
      if (mat.name === 'CaveFloor') { mat.color = new THREE.Color(0x101014); m.layers.set(CAVE_LAYER); floorMesh = m }
      else if (mat.name === 'CaveRock') {
        // 0x060608 e não 0x0c: a garganta é uma face virada PARA O SOL, e com
        // albedo médio ela lia cinza-claro dentro de uma caverna. Aqui o basalto
        // fica quase preto, e quem acende o interior é a brasa.
        //
        // ⚠️ E `CaveRock` É A ÚNICA PEÇA DO INTERIOR QUE FICA NA CAMADA 0, de
        // propósito. A casca do geodo é UMA malha só que carrega as duas faces:
        // a parede da cavidade (normal para dentro) e o MACIÇO que se vê de fora
        // (normal para fora, e o bbox dela bate com o elipsóide externo:
        // 354 x 256 x 175 m). Mandá-la para a CAVE_LAYER apagaria a montanha
        // inteira vista do parque; deixá-la na camada 0 deixa o sol tocar as
        // faces da cavidade que olham para cima, e o albedo 0,024 é a defesa
        // medida contra isso, a mesma da câmara velha.
        mat.color = new THREE.Color(0x060608)
      } else if (mat.name === 'CaveCrystal' || mat.name === 'CaveVein') {
        // ⚠️ O CRISTAL NÃO É REPINTADO. Ele sai do GLB com os parâmetros do TIER
        // das runestones (`CaveCrystal` = M_T4, dark 0,20/metal 0,30/rough 0,13;
        // `CaveVein` = M_T5, dark 0,09), que é o que o faz ser da mesma família
        // das pedras marcadas. Pintá-lo de 0x08080b, como o laço de ontem fazia
        // com "qualquer outra peça", apagaria justamente isso.
        // Quem acende é o .ts, e os dois valores vêm da chapa do escultor:
        // drusa 0,0157 (um sussurro: ela RESPONDE à brasa, não brilha sozinha) e
        // veio 0,077 (o dobro em cima, porque ele está a 90 m da luz mais
        // próxima e é a fonte fria declarada do teto).
        mat.emissive = MARK.clone()   // clone: a constante é compartilhada
        mat.emissiveIntensity = mat.name === 'CaveVein' ? 0.077 : 0.0157
        brasas.push({ m: mat, base: mat.emissiveIntensity })
        m.layers.set(CAVE_LAYER)
      } else {
        // as estalactites e o talus (`CaveDrip`) são interior e vão para a camada
        // da caverna. Sem isto o sol da praça as acende como se não houvesse
        // teto: é o mesmo bug que o piso já teve, e ele volta a cada peça nova.
        mat.color = new THREE.Color(0x08080b)
        m.layers.set(CAVE_LAYER)
      }
    })
    // ⚠️ o corte sai INTEIRO por material: `GEO_Talus` e `GEO_Stalactites`
    // dividem o `CaveDrip`, e `descarta` descarta material junto. Cortar só um
    // dos dois serviria material morto ao outro. Os quatro nomes de ORNAMENTO
    // cobrem os dois usuários de cada material que eles tocam.
    for (const o of podados) descarta(o)
    geodo = rock
    group.add(rock)

    // a planta do pátio, medida do piso de verdade: é dela que saem o lugar da
    // luz e o anel do jardim
    if (floorMesh) {
      const fm: THREE.Mesh = floorMesh
      piso = amostraPiso(fm, paraLocalDe(fm))
      plan = chamberPlan(fm, paraLocalDe(fm), piso)
    }

    // ── a luz ───────────────────────────────────────────────────────────────
    // ⚠️ TRÊS PointLight NÃO ENCHEM 288 m, e a chapa da abside do escultor é a
    // prova: ela saiu PRETA com manchas brancas boiando, e a medição de pixel deu
    // o veredito (drusa em RGB 60-80 contra fundo em 0-5). O cristal nunca esteve
    // claro demais; a sala é que não existia atrás dele. As três luzes de ontem
    // foram calculadas para uma câmara de 64 m e a única do salão ficava na
    // frente do templo, que fazia sombra em 40 m de nave.
    // Este é o plano declarado da F3, o MESMO que as chapas do geodo usam, com o
    // mapeamento de unidade do escultor (1 de intensidade no three ≈ 812 W no
    // EEVEE). Cada luz tem função; nenhuma é "para clarear".
    // ⚠️ E A POSIÇÃO VALE MAIS QUE A INTENSIDADE: com a `rosto` solta no meio do
    // salão (x = −150), a mesma potência acendia a caverna inteira por igual e a
    // sala virava argila bege. Em x = −176 ela fica DENTRO do pátio da muralha,
    // entre o rosto (−190) e a frente da muralha (−164): a muralha de 18 m faz o
    // abat-jour e o que se vê é uma brasa SAINDO do templo.
    const acende = (x: number, y: number, z: number, base: number, alcance: number, ritmo: number, fase: number) => {
      const l = new THREE.PointLight(EMBER, base, alcance, 1.7)
      l.layers.enable(CAVE_LAYER) // acende os dois: a rocha (camada 0) e o interior
      l.position.set(x, y, z)
      group.add(l)
      lights.push({ l, base, fase, ritmo })
    }
    // (as posições vêm em quadro do escultor, z para cima; aqui three.z = −blender.y)
    acende(-176, 16, 0, 700, 320, 1.7, 0)      // rosto: o derrame do templo
    acende(-292, 26, 0, 140, 180, 2.6, 1)      // abside: o contraluz atrás do crânio
    acende(-256, 76, 0, 70, 260, 2.2, 2)       // abóbada: acende o teto e o veio
    acende(-18, 6, -16.5, 60, 120, 2.6, 3)     // garganta: o cotovelo do corredor
    acende(18, 7, 0, 70, 95, 3.1, 4)           // soleira: o que se vê de longe
    // ⚠️ O AMBIENTE NÃO É OPCIONAL, e é a segunda metade da mesma descoberta. No
    // EEVEE o emissivo do cristal ainda ilumina o que está em volta; no three,
    // `emissive` de MeshStandardMaterial não ilumina NADA. Sem ele a sala fica
    // MAIS preta no navegador do que na chapa.
    // Ele não é PointLight, não gera sombra e não entra no orçamento de ≤ 10 da
    // praça. O valor declarado é 0,006 de radiância âmbar no fundo de mundo do
    // EEVEE; o AmbientLight do three recebe IRRADIÂNCIA, que é π vezes isso, daí
    // 0,019. Fica SÓ na CAVE_LAYER: na camada 0 ele seria um véu âmbar sobre a
    // Lua inteira, porque luz ambiente não tem posição para limitar alcance.
    ambiente = new THREE.AmbientLight(EMBER, 0.019)
    ambiente.layers.set(CAVE_LAYER)
    group.add(ambiente)

  }

  async function abreFortaleza() {
    baixandoFort = true
    // ⚠️ O JARDIM VEM COM A FORTALEZA, E NÃO COM O GEODO. Ele é um anel em volta
    // do templo: sem a pegada dela medida, `buildCaveGarden` cai no ramo "sem
    // salão" e abre a clareira do meio pelo raio do piso (38 m), o que poria
    // canteiro dentro de uma muralha de 121 x 124 m. E ele é miúdo, então só é
    // visto por quem está dentro, exatamente como ela.
    const [forte, shroomTall, shroomClump] = await Promise.all([
      loadGlb(FORTALEZA_URL), loadSf(opts.gltf, SF.shroomTall), loadSf(opts.gltf, SF.shroomCluster),
    ])
    baixandoFort = false
    if (!forte) { if (shroomTall) descarta(shroomTall); if (shroomClump) descarta(shroomClump); return }
    if (dist > FORT_OUT || !geodo) {
      descarta(forte)
      if (shroomTall) descarta(shroomTall)
      if (shroomClump) descarta(shroomClump)
      return
    }
    // tudo dela é INTERIOR: nada da fortaleza é visto de fora da caverna
    //
    // ⚠️ E ELA NÃO ENTRA NO PASSE DE SOMBRA, nem para lançar nem para receber. O
    // mapa de sombra da praça é da DIRECIONAL, que aqui dentro não existe (é para
    // isso que a CAVE_LAYER foi criada), e as cinco pontuais desta caverna não
    // lançam sombra. Com `castShadow` ligado seriam 171.708 triângulos redesenhados
    // no passe de sombra a cada quadro para produzir sombra nenhuma. O filtro de
    // camada não salva: o passe de sombra testa a camada da CÂMERA, e a câmera
    // da praça tem a CAVE_LAYER habilitada.
    dressSf(forte, { envMapIntensity: 0.15, roughness: 0.9, castShadow: false })
    forte.traverse((o) => {
      const m = o as THREE.Mesh
      o.layers.set(CAVE_LAYER)
      if (!m.isMesh) return
      m.receiveShadow = false
      const mat = m.material as THREE.MeshStandardMaterial
      if (!mat) return
      // ⚠️ o emissivo foi ZERADO no GLB de propósito (o laranja é luz, nunca tinta
      // assada no arquivo: a rodada 1 da fortaleza quebrou essa regra e foi
      // reprovada por isso). Quem acende é aqui, com os dois números da chapa.
      // A coroa fica MAIS FRACA que as órbitas, senão ela rouba o primeiro sinal.
      if (mat.name === 'FortressCrystal') { mat.emissive = new THREE.Color(ORANGE); mat.emissiveIntensity = 1.35; brasas.push({ m: mat, base: 1.35 }) }
      else if (mat.name === 'FortressCrown') { mat.emissive = new THREE.Color(ORANGE); mat.emissiveIntensity = 0.40; brasas.push({ m: mat, base: 0.40 }) }
    })
    group.add(forte)
    fortaleza = forte

    // ── o assentamento, MEDIDO na malha já no lugar ─────────────────────────
    // ⚠️ NADA AQUI GIRA OU ESCALA: os dois GLB saem no mesmo quadro (metros
    // finais, +X para fora da boca), então a fortaleza entra em rotação zero e
    // escala 1. Mas a caixa é medida DEPOIS de assentada, porque é assim que este
    // arquivo já errou uma vez (o pagode ficou pairando por ter sido medido antes
    // do giro).
    forte.position.set(FORT_AT_X, 0, 0)
    const bx = caixaLocal(forte)
    // O X: `build_leonidas_geode.py` escavou a caverna em volta de x = −213 e é
    // esse número que entrega o enquadramento. Aqui ele é CONFERIDO, não
    // presumido: a soleira do corredor está em x = −56 e o plano do rosto no max
    // x do crânio; se a peça for reassada mais funda, o aviso acende.
    const rosto = FORT_AT_X + FORT_ROSTO_X
    const dLeitura = MIRANTE_X - rosto
    if (dLeitura < D_LEITURA) console.warn('[plaza] fortaleza perto demais da soleira:', dLeitura.toFixed(1), 'm, o quadro pede', D_LEITURA)
    // O Y: o piso do geodo NÃO é plano. Medido nos vértices sob a pegada dela, ele
    // vai de −1,28 a −0,28 m (mediana −0,82), e a fortaleza sai do arquivo com a
    // base em y = 0. Assentá-la em zero a deixaria PAIRANDO 0,8 m em quase toda a
    // pegada, que é o defeito que este arquivo já registrou uma vez.
    // Ela desce até o ponto MAIS BAIXO do piso sob ela (pela grade de 6 m: −1,12
    // nas 408 células da pegada): assim a laje de base dela, que tem 0,8 m de
    // espessura, vai de −1,12 a −0,32 e encosta em tudo, sobrando como soco de
    // meio metro onde o piso é mais alto. É o que uma base de maciço faz.
    const alvoY = piso ? piso.minEm(bx) : 0
    forte.position.y += alvoY - bx.min.y

    // ── o JARDIM DO PÁTIO, agora que a pegada do templo existe ──────────────
    if (plan && piso) {
      garden = buildCaveGarden({
        tall: shroomTall, cluster: shroomClump, plan, hallBox: caixaLocal(forte),
        piso, low: opts.profile?.quality === 'low',
      })
      // a intensidade com que cada material NASCEU: a respiração multiplica esta,
      // e não a do quadro anterior (multiplicar a corrente faz o brilho derivar
      // até apagar em alguns minutos de cena aberta)
      gardenBase = garden ? garden.mats.map((m) => m.emissiveIntensity) : []
      if (garden) jardimHolder.add(garden.group)
    }
    // ⚠️ OS COGUMELOS DE ORIGEM NÃO PASSAM POR `descarta`, e não é esquecimento.
    // `buildCaveGarden` já descartou a GEOMETRIA deles (as instâncias ficaram com
    // uma cópia), e as TEXTURAS têm de sobreviver: `shroomMat` clona o material e
    // o clone compartilha a referência dos mapas com o original. Descartá-las aqui
    // apagaria o emissivo do jardim que acabou de nascer. Elas saem em
    // `fechaFortaleza`, quando o jardim inteiro morre.
    if (!garden) { for (const s of [shroomTall, shroomClump]) if (s) descarta(s) }
  }

  function fechaFortaleza() {
    if (garden) {
      garden.group.removeFromParent()
      for (const d of garden.junk) d.dispose()
      // as texturas do cogumelo saem AQUI, e só aqui: elas vieram do GLB de
      // origem e são compartilhadas com os clones que o jardim usa. `dispose()`
      // de material não leva mapa junto.
      for (const m of garden.mats) soltaTexturas(m)
      for (const l of garden.lights) l.dispose()
      garden = null
      gardenBase = []
    }
    if (!fortaleza) return
    const alvo = fortaleza
    fortaleza = null
    brasas = brasas.filter((b) => !/^Fortress/.test(b.m.name))
    descarta(alvo)
  }

  function fechaGeodo() {
    fechaFortaleza()
    for (const { l } of lights) { l.removeFromParent(); l.dispose() }
    lights = []
    ambiente?.removeFromParent(); ambiente?.dispose(); ambiente = null
    brasas = []
    piso = null
    plan = null
    if (geodo) { const g = geodo; geodo = null; descarta(g) }
  }

  return {
    group: holder,
    mouthLocal: new THREE.Vector3(CAVE_LOCAL.x, group.position.y, CAVE_LOCAL.z),
    update(t, camWorld) {
      // ── o portão ──────────────────────────────────────────────────────────
      // distância HORIZONTAL até a boca: a câmera voa, e uma altura de voo não
      // deve descarregar a caverna de quem está parado em cima dela. É a mesma
      // âncora que o culling usa (o parque não gira: PARK_ROT_Y = 0).
      if (camWorld) {
        dist = Math.hypot(camWorld.x - cullAt.x, camWorld.z - cullAt.z)
        if (!geodo && !baixandoGeodo && dist < GEO_IN) void abreGeodo()
        else if (geodo && dist > GEO_OUT) fechaGeodo()
        if (geodo && !fortaleza && !baixandoFort && dist < FORT_IN) void abreFortaleza()
        else if (fortaleza && dist > FORT_OUT) fechaFortaleza()
      }
      // brasa: a luz respira, o material não (o material é o que lê de longe)
      for (const { l, base, fase, ritmo } of lights) l.intensity = base * (0.9 + 0.1 * Math.sin(t * ritmo + fase))
      for (const m of emissives) (m as THREE.MeshStandardMaterial).emissiveIntensity = 1.35 * (0.94 + 0.06 * Math.sin(t * 2.2))
      // o interior respira em torno da força com que NASCEU: o cristal do geodo é
      // um sussurro de 0,016 e a órbita da fortaleza é 1,35, e um valor único
      // apagaria uma e estouraria a outra.
      for (let i = 0; i < brasas.length; i++) brasas[i].m.emissiveIntensity = brasas[i].base * (0.94 + 0.06 * Math.sin(t * 2.2 + i * 0.7))
      // o jardim respira em outro compasso, mais lento que a brasa: fungo não
      // pisca como fogo. Cada família com sua fase, senão o pátio inteiro pulsa
      // junto e vira um pisca-pisca.
      if (garden) {
        for (let i = 0; i < garden.mats.length; i++) {
          const base = gardenBase[i]
          garden.mats[i].emissiveIntensity = base * (0.88 + 0.12 * Math.sin(t * 0.55 + i * 1.9))
        }
        for (let i = 0; i < garden.lights.length; i++) garden.lights[i].intensity = 34 * (0.82 + 0.18 * Math.sin(t * 0.42 + i * 2.3))
      }
    },
    dispose() { fechaGeodo(); for (const d of disposables) d.dispose() },
  }
}
