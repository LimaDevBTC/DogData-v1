// O Parque Runestone em tempo real (praca-central.md D10), a partir do que o Blender
// exportou de `runestone-park-v2.blend` (blender/export_park.py):
//   /city/park/heightmap.f32   o terreno do parque, 281×281 células de 25,7 m
//   /city/park/stones.json     as 1.009 pedras marcadas (variante + matriz de mundo)
//   /city/park/crystals.glb    as dez variantes de cristal, na origem
//   /city/park/scatter.bin     os 111.374 pontos do censo (uma pedra por Runestone
//                              do airdrop), int16 em quartos de metro
//   /city/park/temple.glb      o templo Leonidas, a estrada, o pavilhão, os painéis
//   /city/park/trails.glb      as trilhas W1-W5: decks, narizes de âmbar, fáscias,
//                              pilares, marcos, lanternas e os visitantes
//   /city/park/crystal-basecolor.webp + crystal-normal.webp
//                              as texturas do runestone3d.gltf (a mesma pedra da
//                              /airdrop), de onde sai a RECEITA DA MARCA BRANCA do
//                              .blend: pedra negra de obsidiana, arestas que
//                              faíscam, e o glifo que emite (mais forte quanto
//                              menor a pedra, para ler em qualquer escala)
//
// Onde fica: em `park-site.ts` (a posição da cena da landing, nordeste da praça,
// rumo 43°, a 5,2 km para o construído do parque ficar fora do platô). O parque
// tem chão próprio: dentro de PARK_CORE o terreno é o do .blend sobre um datum
// plano (o chão real sob o Monarca), e de PARK_CORE a PARK_HALF ele funde no
// regolito real (`baseAt`, sem a cova); o regolito, por sua vez, abre uma cova
// sob o parque (terrain.ts) para nunca vazar pelo fundo do vale. A malha é um
// disco: os cantos do quadrado colapsam no raio PARK_HALF.
//
// Quadro: o Blender é Z-up e o parque foi modelado com y = norte; o glTF já vem
// convertido (x, z, −y); o heightmap e o censo vêm crus e são convertidos aqui.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { regolithColor } from './terrain'
import { PARK_CENTER, PARK_ROT_Y, PARK_HALF, PARK_CORE, TEMPLE_WORLD, parkReach, parkCore } from './park-site'
import { buildLeonidasCave, CAVE_LOCAL, CAVE_YAW, type LeonidasCave } from './leonidas-cave'
import { mergeStaticByMaterial, type PerfProfile, type DistanceCuller } from './perf'
import { SF, loadSf, dressSf } from './sf-assets'
import { FUNDIR, fundirMalhasLisas } from './fusao'
import { emFatias, type Tarefa, type Trabalho } from './obra'

export { PARK_CENTER, PARK_ROT_Y }

// ═══════════════════════════════════════════════════════════════════════════
// A FUSÃO DO TEMPLO E DAS TRILHAS (`?fundir=1`). `materialLiso` e
// `fundirMalhasLisas` viviam aqui e se mudaram para `fusao.ts` (censo de
// 02/09, frente orçamento): a técnica é genérica, não específica do parque,
// e os seis prédios de `plaza-scene.tsx` (254 dos ~510 materiais da entrada
// padrão) são o próximo a usá-la. Esta seção documentava o achado que abriu
// o módulo, e fica como resumo: lendo o JSON de `temple.glb` e `trails.glb`,
// 16 + 9 = 25 materiais, e 24 deles (todos menos `M_T5`, a pedra runestone
// que já troca de material na linha do `TIER_BY_NAME` abaixo) são PBR LISO,
// sem mapa nenhum. `mergeStaticByMaterial` (perf.ts) já funde por material
// EXISTENTE (138 malhas → ~20) mas não reduz quantos materiais existem;
// `fundirMalhasLisas` funde os 24 num só ANTES daquela rodar, e ela roda
// depois só para o que sobrar (a pedra retagueada). `temple-hall.glb`
// (leonidas-cave.ts, 9 materiais, TODOS com textura) não entra: fundir
// textura sem atlas troca o pixel, e isso fica fora da bandeira.
// ═══════════════════════════════════════════════════════════════════════════

export interface Park {
  group: THREE.Group
  update: (t: number, halfHeightPx: number, camPos: THREE.Vector3) => void
  /** ⚠️ A COTA DO CHÃO DO PARQUE, EM MUNDO, ou null fora da pegada dele.
   *
   *  Ela existe porque o parque tem TERRENO PRÓPRIO. `terrain.heightAt` e
   *  `terrain.superficieAt` são o relevo da CIDADE, e o parque está a r 9.800,
   *  fora dela: nenhuma das duas sabe onde fica o gramado daqui. O trava-chão da
   *  câmera usava uma delas e por isso o visitante atravessava o chão do parque
   *  (fundador, 31/08: "o parque Runestone está permitindo a câmera passar por
   *  dentro da terra"). Medido por raycast no centro do parque: chão visível em
   *  y = 40,1 m; a superfície da cidade ali devolve outra coisa.
   *
   *  ⚠️ E ISSO É O QUE FECHA A CAVERNA TAMBÉM. O plano dela existe embaixo do
   *  parque, mas ela é destino de GAMEPLAY, não de câmera livre. Com o chão certo
   *  no trava-chão, descer até lá deixa de ser possível por navegação. */
  alturaEm: (x: number, z: number) => number | null
  dispose: () => void
}

/** A receita por tier (materiais M_T8..M_T2 do .blend), na ordem das variantes do
 *  crystals.glb: metálico, rugosidade, tinta escura das faces, força da emissão da
 *  marca. Os "b" são as pedras foscas. */
export const TIERS: { metal: number; rough: number; dark: [number, number, number]; emit: number }[] = [
  { metal: 0.35, rough: 0.10, dark: [0.065, 0.065, 0.075], emit: 0.35 }, // M_T8, o Monarca
  { metal: 0.35, rough: 0.10, dark: [0.065, 0.065, 0.075], emit: 0.60 }, // M_T7, os Maiores
  { metal: 0.35, rough: 0.11, dark: [0.09, 0.09, 0.105], emit: 0.85 },   // M_T6, os Picos
  { metal: 0.05, rough: 0.62, dark: [0.24, 0.23, 0.22], emit: 0.85 },    // M_T6b
  { metal: 0.35, rough: 0.11, dark: [0.09, 0.09, 0.105], emit: 1.10 },   // M_T5, as Grandes
  { metal: 0.05, rough: 0.62, dark: [0.24, 0.23, 0.22], emit: 1.10 },    // M_T5b
  { metal: 0.30, rough: 0.13, dark: [0.20, 0.20, 0.22], emit: 1.40 },    // M_T4, as Médias
  { metal: 0.05, rough: 0.62, dark: [0.30, 0.29, 0.28], emit: 1.40 },    // M_T4b
  { metal: 0.32, rough: 0.11, dark: [0.20, 0.20, 0.22], emit: 2.20 },    // M_T3, escala humana
  { metal: 0.32, rough: 0.11, dark: [0.20, 0.20, 0.22], emit: 2.20 },    // M_T2, as de palma
]
const TIER_BY_NAME: Record<string, number> = { M_T8: 0, M_T7: 1, M_T6: 2, M_T6b: 3, M_T5: 4, M_T5b: 5, M_T4: 6, M_T4b: 7, M_T3: 8, M_T2: 9 }
const MARK = new THREE.Color(0.93, 0.91, 0.86)

interface HeightMeta { cols: number; rows: number; cellSizeM: number; minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number }

/** Blender (x, y, z) → three (x, z, −y), como matriz. */
const B2T = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
)
const T2B = B2T.clone().invert()

/** O eixo do giro do parque, uma vez só. Ele era um `new THREE.Vector3(0, 1, 0)`
 *  DENTRO de `worldOf`, que roda uma vez por vértice do terreno e uma por ponto
 *  do censo: 172 mil objetos jogados fora por boot só para dizer "para cima".
 *  `applyAxisAngle` não escreve no eixo, então um só serve para todos. */
const EIXO_Y = new THREE.Vector3(0, 1, 0)

/** O material de UMA pedra: a receita da marca branca em shader (ver o bloco das
 *  pedras marcadas em loadPark). Exportado para o Jardim Ordinal da praça usar as
 *  mesmas pedras com a mesma pele. */
export function crystalMaterialFor(tier: (typeof TIERS)[number], bcTex: THREE.Texture, nmTex: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: bcTex, normalMap: nmTex, normalScale: new THREE.Vector2(1, 1),
    metalness: tier.metal, roughness: tier.rough, envMapIntensity: 1.1,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDark = { value: new THREE.Color(tier.dark[0], tier.dark[1], tier.dark[2]) }
    sh.uniforms.uMark = { value: MARK }
    sh.uniforms.uEmit = { value: tier.emit }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uDark; uniform vec3 uMark; uniform float uEmit; float crystalLum = 0.0;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          crystalLum = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          float crystalMk = floor(clamp((crystalLum - 0.42) / 0.30, 0.0, 1.0) * 4.0 + 0.5) / 4.0;
          diffuseColor.rgb *= mix(sampledDiffuseColor.rgb * uDark, uMark, crystalMk);
        #endif`)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        {
          // rampa suave, não em degraus: de longe os mips fundem o traço branco
          // do glifo com o preto em volta e a luminância cai para 0,1..0,3; com
          // a rampa em degraus (0,5..0,8) o glifo simplesmente sumia a 1 km, e o
          // fundador viu o parque sem marca nenhuma no celular. Assim ele vira
          // um brilho proporcional, como um bloom, e continua lendo de longe.
          float crystalMe = smoothstep(0.06, 0.55, crystalLum);
          totalEmissiveRadiance += uMark * uEmit * 1.4 * crystalMe;
        }`)
  }
  return m
}

/** As duas texturas da pedra (as do runestone3d.gltf), prontas para glTF (flipY off). */
export function loadCrystalTextures(): Promise<[THREE.Texture, THREE.Texture]> {
  const texLoader = new THREE.TextureLoader()
  const loadTex = (url: string, srgb: boolean) => new Promise<THREE.Texture>((res, rej) => texLoader.load(url, (t) => {
    t.flipY = false // UVs de glTF: origem no canto superior esquerdo
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    res(t)
  }, undefined, rej))
  return Promise.all([loadTex('/city/park/crystal-basecolor.webp', true), loadTex('/city/park/crystal-normal.webp', false)])
}

// ═══════════════════════════════════════════════════════════════════════════
// A CONSTRUÇÃO EM FATIAS. O contrato está em `obra.ts`; aqui está o CORTE.
//
// ⚠️ O PARQUE ERA A MAIOR TRAVA DA CIDADE. Medido em 02/09/2026 no boot de
// `/city` com `PerformanceObserver` em `longtask`: 60,3 s de thread bloqueada em
// 29 tarefas, e 21,4 s deles NESTE arquivo, sendo 21.257 ms numa ÚNICA tarefa.
// Um terço da trava da cidade inteira saía daqui. Por isso a construção deixou
// de ser uma função síncrona e virou um gerador que cede o controle.
//
// ⚠️ E CEDER POUCAS VEZES NÃO RESOLVERIA NADA. O orçamento da `Obra` é checado
// ENTRE cessões: ceder cinco vezes numa tarefa de 21 s entrega cinco travadas de
// 4 s, que o visitante lê igual a uma de 21. A regra deste arquivo é que NENHUMA
// fatia passe de ~4 ms, e quem decide é o RELÓGIO, nunca a contagem de itens. O
// custo por item varia de verdade: no laço do terreno um vértice do miolo do
// disco custa uma consulta de heightmap, e um da borda cai na saia da cidade,
// que tem exponencial dentro.
//
// O QUE MEDI, E ONDE. Não abri navegador. Medi os laços numéricos no Node 20
// (mesmo V8), em 03/09/2026, com os arquivos reais de `public/city/park/` e
// `public/lunar/`, na PRIMEIRA passada, sem JIT quente, que é o que o boot vive:
//     162 ms   o laço do terreno fino, 58.081 vértices
//     120 ms   `new THREE.PlaneGeometry(7200, 7200, 240, 240)`
//      36 ms   `computeVertexNormals` dele, 115.200 triângulos
//     104 ms   o laço do censo, 111.374 pontos
//       9 ms   o terreno grosso, 3.721 vértices
//       5 ms   as 1.009 pedras marcadas
// Soma ~440 ms, e NÃO os 21 s. NÃO MEDI o que exigiria navegador: o parse dos
// três glTF com Draco, `mergeStaticByMaterial`, os `setFromObject` do construído
// e `buildLeonidasCave`. O resto do tempo está nesses quatro, ou na pressão de
// GC do boot inteiro. O corte por tempo cobre os dois casos: se um trecho for
// dez vezes mais lento no navegador do que aqui, ele cede dez vezes mais.
//
// E DEPOIS DO CORTE, rodando os mesmos geradores e cronometrando cada `next()`:
//     terreno fino     20 fatias, a maior de 35,2 ms
//     terreno grosso    3 fatias, a maior de  4,1 ms
//     censo            26 fatias, a maior de  5,1 ms
//
// ⚠️ AS DUAS FATIAS QUE AINDA ESTOURAM O ALVO SÃO DUAS CHAMADAS DO THREE, E EU
// NÃO AS FATIEI DE PROPÓSITO: `new PlaneGeometry(...)` (120 ms frio, 26 ms
// quente) e `computeVertexNormals` (36 ms frio, 14 ms quente), as duas sobre o
// mesmo disco de 58.081 vértices. Elas são divisíveis SÓ reescrevendo aqui o
// que o three faz lá dentro (a grade do plano é `push` em vetor JS, e a normal
// é acúmulo por triângulo mais normalização), e o resultado teria de ser
// bit a bit igual ou o sombreado do chão muda. Dá para fazer e dá para
// conferir offline; é decisão de quem coordena, não coisa para entrar de
// carona numa conversão de orçamento. No navegador as duas chegam quentes: a
// cidade constrói dezenas de `PlaneGeometry` antes de o parque (faixa 2)
// começar.
//
// ⚠️ E POR ISSO A REDE FICA FORA DO GERADOR. `parkComoTrabalho` é `async`: baixa
// e decodifica tudo ANTES de a peça entrar na fila. Um gerador que cedesse
// esperando `fetch` queimaria os 6 ms de TODO quadro girando em falso, e ainda
// seguraria as outras peças atrás dele na fila (é a mesma lição já escrita em
// `chalet.ts`).
//
// ⚠️ NÃO USE `yield*` NESTE ARQUIVO. O `target` do tsconfig é `es5` e
// `npx tsc --noEmit` recusa com "TS2802: Type 'Tarefa' can only be iterated
// through when using the '--downlevelIteration' flag" (conferido em 02/09).
// Repassar as cessões à mão, `for (const it = sub(); !it.next().done;) yield`,
// faz exatamente a mesma coisa e compila.
// ═══════════════════════════════════════════════════════════════════════════

/** O que `loadPark` sempre pediu, agora com nome: os dois caminhos usam o mesmo. */
export interface ParkOpts {
  baseAt: (x: number, z: number) => number
  meanHeight: number
  gltf?: GLTFLoader
  profile?: PerfProfile
  culler?: DistanceCuller
}

/** O parque como peça da `Obra`. */
export interface ParkTrabalho extends Trabalho {
  /** O grupo do parque. Nasce VAZIO e enche fatia a fatia, então já pode entrar
   *  na cena antes de a obra começar: o visitante vê o parque aparecer por
   *  partes em vez de esperar o pacote inteiro. */
  readonly group: THREE.Group
  /** O parque pronto, ou null enquanto a obra não chegou ao fim. */
  readonly parque: Park | null
}

/** O que a rede traz. Nenhuma geometria construída ainda. */
interface AtivosDoParque {
  meta: HeightMeta
  heights: Float32Array
  stones: { variants: string[]; stones: number[][] }
  s16: Int16Array
  gltf: GLTFLoader
  crystals: THREE.Group
  temple: THREE.Group
  trails: THREE.Group
  bcTex: THREE.Texture
  nmTex: THREE.Texture
}

/** O que a obra vai enchendo enquanto constrói. */
interface SaidaDoParque {
  group: THREE.Group
  park: Park | null
  /** A caverna do Leonidas termina DEPOIS do parque, fora da fila. Ver o bloco
   *  dela em `constroiParque`. */
  caverna: Promise<void> | null
}

/** Rede e decodificação: tudo o que não é CPU de construção. */
async function baixaAtivos(opts: ParkOpts): Promise<AtivosDoParque> {
  const [meta, hbuf, stones, sbuf] = await Promise.all([
    fetch('/city/park/heightmap.json').then((r) => r.json() as Promise<HeightMeta>),
    fetch('/city/park/heightmap.f32').then((r) => r.arrayBuffer()),
    fetch('/city/park/stones.json').then((r) => r.json() as Promise<{ variants: string[]; stones: number[][] }>),
    fetch('/city/park/scatter.bin').then((r) => r.arrayBuffer()),
  ])
  const gltf = opts.gltf ?? (() => { const d = new DRACOLoader(); d.setDecoderPath('/draco/'); const g = new GLTFLoader(); g.setDRACOLoader(d); return g })()
  const loadGlb = (url: string) => new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej))
  const [crystals, temple, trails, tex] = await Promise.all([
    loadGlb('/city/park/crystals.glb'), loadGlb('/city/park/temple.glb'), loadGlb('/city/park/trails.glb'),
    loadCrystalTextures(),
  ])
  return { meta, heights: new Float32Array(hbuf), stones, s16: new Int16Array(sbuf), gltf, crystals, temple, trails, bcTex: tex[0], nmTex: tex[1] }
}

/** O grupo do parque, já nomeado e girado, antes de ter uma malha dentro. */
function novoGrupoDoParque(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'RunestonePark'
  group.rotation.y = PARK_ROT_Y
  return group
}

/**
 * O cortador deste arquivo: roda `faz(i)` para i em [0, n) e cede PELO RELÓGIO.
 *
 * É o `emFatias` de `obra.ts` para quem itera um ÍNDICE e não um vetor (os laços
 * do terreno andam sobre `BufferAttribute`, e o do censo sobre um `Int16Array`
 * de passo 4: em nenhum dos dois existe o "item" que `emFatias` quer entregar).
 * A regra é a mesma e o motivo é o mesmo: contagem fixa daria fatia de 2 ms num
 * trecho e de 900 ms no seguinte.
 *
 * `passo` só existe para não ler o relógio a cada item; com 64, o estouro máximo
 * de uma fatia é o custo de 64 itens, medido em 0,18 ms no pior laço daqui.
 */
function* porIndice(n: number, faz: (i: number) => void, msPorFatia = 4, passo = 64): Tarefa {
  let t0 = performance.now()
  for (let i = 0; i < n; i++) {
    faz(i)
    if (i % passo === passo - 1 && performance.now() - t0 > msPorFatia) {
      yield
      t0 = performance.now()
    }
  }
}

/**
 * Levanta e pinta os vértices de um disco do chão do parque, cedendo pelo
 * relógio. O fino (240×240) e o grosso (60×60) são o MESMO código: eram dois
 * laços copiados, e cada correção precisava ser feita duas vezes.
 */
function* moldaDiscoDoParque(
  geo: THREE.BufferGeometry,
  groundLocal: (lx: number, lz: number) => number,
  worldOf: (lx: number, lz: number) => THREE.Vector3,
  center0: number,
  meanHeight: number,
): Tarefa {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(pos.count * 3)
  // a MESMA cor do chão da praça: o parque é o mesmo regolito, só com relevo
  const tint = new THREE.Color()
  const it = porIndice(pos.count, (k) => {
    let lx = pos.getX(k), lz = pos.getZ(k)
    // disco: os cantos do quadrado colapsam no raio PARK_HALF
    const rr = Math.hypot(lx, lz)
    if (rr > PARK_HALF) { lx *= PARK_HALF / rr; lz *= PARK_HALF / rr; pos.setX(k, lx); pos.setZ(k, lz) }
    const y = groundLocal(lx, lz)
    pos.setY(k, y)
    const w = worldOf(lx, lz)
    // relevo na MESMA régua do regolito (altura de mundo menos a média do sítio),
    // senão o disco do parque aparece mais claro que a planície em volta
    regolithColor(w.x, w.z, y + center0 - meanHeight, Math.hypot(w.x, w.z), tint)
    col[k * 3] = tint.r; col[k * 3 + 1] = tint.g; col[k * 3 + 2] = tint.b
  })
  while (!it.next().done) yield
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  // ⚠️ NÃO FATIADA, DE PROPÓSITO: uma chamada só do three, 36 ms medidos frios no
  // disco fino (115.200 triângulos) e 2,7 ms no grosso; quente dá 14 ms. Fatiar
  // exigiria reimplementar a normal do three aqui, bit a bit igual, e aí o
  // sombreado do chão do parque passaria a depender da minha cópia dela.
  geo.computeVertexNormals()
  yield
}

/** A construção inteira, em fatias de no máximo ~4 ms. */
function* constroiParque(a: AtivosDoParque, opts: ParkOpts, saida: SaidaDoParque): Tarefa {
  const { meta, heights, stones, s16, gltf, crystals, temple, trails, bcTex, nmTex } = a
  const group = saida.group
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // ── o datum: o chão real sob o Monarca; o núcleo do parque é plano sobre ele ──
  // e a borda (PARK_CORE → PARK_HALF) funde no regolito real. Tudo local ao grupo,
  // cujo y é o datum.
  const { cols, rows, cellSizeM: cell } = meta
  const parkH = (bx: number, by: number): number => {
    const fi = THREE.MathUtils.clamp((bx - meta.minX) / cell, 0, cols - 1.001)
    const fj = THREE.MathUtils.clamp((by - meta.minY) / cell, 0, rows - 1.001)
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j
    const H = (ii: number, jj: number) => heights[Math.min(rows - 1, jj) * cols + Math.min(cols - 1, ii)]
    return H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
  }
  const local = new THREE.Vector3()
  const worldOf = (lx: number, lz: number) => local.set(lx, 0, lz).applyAxisAngle(EIXO_Y, PARK_ROT_Y).add(PARK_CENTER)
  const center0 = opts.baseAt(PARK_CENTER.x, PARK_CENTER.z)
  group.position.set(PARK_CENTER.x, center0, PARK_CENTER.z)
  const ringLocal = (lx: number, lz: number) => { const w = worldOf(lx, lz); return opts.baseAt(w.x, w.z) - center0 }
  const coreK = (lx: number, lz: number) => {
    const r = Math.hypot(lx, lz)
    // ⚠️ O MESMO ALCANCE ANISOTRÓPICO DA COVA. Se o parque fundir em 3.600 e o
    // terreno em 2.750 do lado da cidade, sobra um degrau de 850 m entre os dois.
    const _mm = parkReach(lx, lz), _nn = parkCore(lx, lz)
    const k = r < _nn ? 1 : r > _mm ? 0 : 1 - (r - _nn) / (_mm - _nn)
    return k * k * (3 - 2 * k)
  }
  /** altura LOCAL (relativa ao grupo) do chão do parque em (lx, lz), quadro three local */
  const groundRaw = (lx: number, lz: number): number => {
    const kk = coreK(lx, lz)
    return ringLocal(lx, lz) * (1 - kk) + parkH(lx, -lz) * kk + 1.5
  }
  // ── o corte da caverna do Leonidas ────────────────────────────────────────
  // O maciço da caverna tem 44 m de profundidade e o flanco sobe 19°: sem corte,
  // a encosta entrava pela câmara e aparecia lá dentro como um piso cinza
  // subindo (foi o que se viu na primeira montagem). Aqui o sítio inteiro é
  // escavado no nível da soleira: até 46 m do EIXO da caverna o chão nunca passa
  // dela, e até 92 m volta ao natural (a caverna cresceu para 117 m em 2026-08-19). Terreno, terraço, trilhas e caminho
  // secreto leem esta mesma função, então ninguém discorda de ninguém.
  const CAVE_FLOOR = groundRaw(CAVE_LOCAL.x, CAVE_LOCAL.z) - 0.15
  const AX = Math.cos(CAVE_YAW), AZ = -Math.sin(CAVE_YAW)
  const A0X = CAVE_LOCAL.x + AX * 30, A0Z = CAVE_LOCAL.z + AZ * 30   // à frente da boca
  // ⚠️ 140, não 78: a caverna foi reformada em 26/08 e o fundo da câmara foi
  // de 78 m para 141 m atrás da boca. Com o eixo curto, a encosta voltava a
  // subir DENTRO do salão novo e aparecia como piso cinza no meio do pátio.
  const A1X = CAVE_LOCAL.x - AX * 140, A1Z = CAVE_LOCAL.z - AZ * 140   // o fundo da câmara
  const axisLen2 = (A1X - A0X) ** 2 + (A1Z - A0Z) ** 2
  const groundLocal = (lx: number, lz: number): number => {
    const h = groundRaw(lx, lz)
    if (h <= CAVE_FLOOR) return h
    const t = THREE.MathUtils.clamp(((lx - A0X) * (A1X - A0X) + (lz - A0Z) * (A1Z - A0Z)) / axisLen2, 0, 1)
    const d = Math.hypot(lx - (A0X + (A1X - A0X) * t), lz - (A0Z + (A1Z - A0Z) * t))
    // raio de influência acompanha o salão novo (83,5 m de largura de piso):
    // 120 cobre a câmara inteira mais folga de encosta
    if (d > 120) return h
    const k = THREE.MathUtils.clamp((120 - d) / 58, 0, 1)
    return h + (CAVE_FLOOR - h) * (k * k * (3 - 2 * k))
  }
  yield

  // ── terreno ───────────────────────────────────────────────────────────────
  const N = 240
  // ⚠️ A MAIOR FATIA QUE SOBROU: 120 ms medidos na primeira passada (58.081
  // vértices, 115.200 triângulos), 26 ms com o JIT quente. É uma chamada só do
  // three, e fatiá-la é reescrever `PlaneGeometry` aqui dentro. O que dá para
  // fazer, e está feito, é cercá-la de cessões: ela nunca divide uma FATIA com
  // outro trabalho. Dividir o QUADRO ela ainda pode, porque a `Obra` só olha o
  // relógio entre cessões e pode começá-la com orçamento sobrando.
  const geo = track(new THREE.PlaneGeometry(2 * PARK_HALF, 2 * PARK_HALF, N, N))
  geo.rotateX(-Math.PI / 2)
  yield
  for (const it = moldaDiscoDoParque(geo, groundLocal, worldOf, center0, opts.meanHeight); !it.next().done;) yield
  const terrainMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  const terrain = new THREE.Mesh(geo, terrainMat)
  terrain.receiveShadow = true
  terrain.name = 'ParkTerrain'
  group.add(terrain)
  yield
  // a versão grossa do mesmo chão (60×60) para quando o parque é horizonte
  const NC = 60
  const geoC = track(new THREE.PlaneGeometry(2 * PARK_HALF, 2 * PARK_HALF, NC, NC))
  geoC.rotateX(-Math.PI / 2)
  for (const it = moldaDiscoDoParque(geoC, groundLocal, worldOf, center0, opts.meanHeight); !it.next().done;) yield
  const terrainCoarse = new THREE.Mesh(geoC, terrainMat)
  terrainCoarse.receiveShadow = true
  terrainCoarse.name = 'ParkTerrainCoarse'
  terrainCoarse.visible = false
  group.add(terrainCoarse)
  // ⚠️ O INVERSO DE `worldOf`: mundo -> local do parque. Sem ele o trava-chão não
  // tem como perguntar "qual a cota daqui" usando a mesma função que desenhou.
  const _tmpLocal = new THREE.Vector3()
  const alturaEm = (x: number, z: number): number | null => {
    _tmpLocal.set(x - PARK_CENTER.x, 0, z - PARK_CENTER.z)
      .applyAxisAngle(EIXO_Y, -PARK_ROT_Y)
    const lx = _tmpLocal.x, lz = _tmpLocal.z
    // fora do sítio do parque quem manda é o relevo da cidade
    if (Math.hypot(lx, lz) > PARK_HALF) return null
    return groundLocal(lx, lz) + center0
  }

  const lodTerrain = (dist: number) => {
    const fine = dist < 4500
    if (terrain.visible !== fine) { terrain.visible = fine; terrainCoarse.visible = !fine }
  }
  yield

  // ── as pedras marcadas: cristais instanciados por variante ────────────────
  // A receita da marca branca, do .blend, em shader: a luminância da textura de
  // cor separa a pedra (preta, tingida por tier) das arestas e do glifo (claros);
  // a cor vira mix(textura × tinta, marca) por uma rampa em degraus (0,42..0,72), e
  // a emissão da marca é outra rampa (0,5..0,8) vezes a força do tier. Metálico
  // 0,35 e rugosidade 0,1: as faces são espelhos negros que faíscam ao sol.
  const crystalMats: THREE.MeshStandardMaterial[] = TIERS.map((tier) => track(crystalMaterialFor(tier, bcTex, nmTex)))
  const variantGeo: THREE.BufferGeometry[] = []
  crystals.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      const idx = Number((o.name.match(/CRYSTAL_(\d+)/) || [])[1])
      if (!Number.isNaN(idx)) variantGeo[idx] = m.geometry
    }
  })
  const byVariant = new Map<number, THREE.Matrix4[]>()
  const M = new THREE.Matrix4()
  const pDaPedra = new THREE.Vector3()
  const itPedras = emFatias(stones.stones, (row) => {
    const v = row[0]
    M.set(row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13], row[14], row[15], row[16])
    // M leva do local do cristal (Blender) ao mundo (Blender). Em three: B2T · M · T2B,
    // porque a geometria do GLB já está no quadro three.
    const Mt = new THREE.Matrix4().multiplyMatrices(B2T, M).multiply(T2B)
    // e desce ao datum: soma o anel local (a matriz traz o z do parque)
    const p = pDaPedra.setFromMatrixPosition(Mt)
    // A pedra que cai DENTRO da caverna do Leonidas sai da lista. Com o maciço a
    // 117 m (2026-08-19), um dos cristais vizinhos passou a atravessar a parede
    // da câmara e a furar o teto: por dentro via-se a lasca branca e a luz de
    // fora. O escudo é o raio da massa mais folga.
    // ⚠️ 150, não 78: com a reforma de 26/08 o maciço passou a 152 x 129 m
    // (fundo a 141 m atrás da boca), e o escudo antigo deixava cristal nascer
    // dentro da parede da câmara de novo.
    if (Math.hypot(p.x - CAVE_LOCAL.x, p.z - CAVE_LOCAL.z) < 150) return
    const list = byVariant.get(v) ?? []
    list.push(Mt)
    byVariant.set(v, list)
  })
  while (!itPedras.next().done) yield
  // LOD por contagem: cada variante é um InstancedMesh com as instâncias ordenadas
  // da MAIOR para a menor; de longe só as maiores são desenhadas (`count`), e a
  // silhueta da cordilheira não muda porque as grandes é que a fazem. De perto,
  // todas. É o LOD dos jogos, sem malhas extras: 485 mil triângulos viram ~100 mil
  // vistos da praça.
  const scaleOf = (m: THREE.Matrix4) => Math.hypot(m.elements[0], m.elements[1], m.elements[2])
  const crystalMeshes: THREE.InstancedMesh[] = []
  for (const [v, list] of Array.from(byVariant.entries())) {
    const g = variantGeo[v]
    if (!g) continue
    list.sort((m1, m2) => scaleOf(m2) - scaleOf(m1))
    const im = new THREE.InstancedMesh(g, crystalMats[Math.min(v, crystalMats.length - 1)], list.length)
    for (const it = emFatias(list, (m, i) => im.setMatrixAt(i, m)); !it.next().done;) yield
    im.instanceMatrix.needsUpdate = true
    im.castShadow = true
    im.receiveShadow = true
    im.name = `Crystals_${v}`
    im.userData.total = list.length
    im.frustumCulled = false // as instâncias cobrem 7 km; a esfera da geometria mentiria
    group.add(im)
    crystalMeshes.push(im)
    yield
  }
  const CL = opts.profile?.crystalLod ?? [1, 0.35, 0.15, 0.08]
  const lodCrystals = (dist: number) => {
    const frac = dist < 2500 ? CL[0] : dist < 5000 ? CL[1] : dist < 9000 ? CL[2] : CL[3]
    for (const im of crystalMeshes) {
      const n2 = Math.max(1, Math.ceil((im.userData.total as number) * frac))
      if (im.count !== n2) im.count = n2
    }
  }

  // ── o censo: 111 mil pontos, uma pedra por Runestone ─────────────────────
  // ⚠️ AQUI MORAVA UM `await new Promise(setTimeout)` A CADA 24.000 PONTOS. Era
  // a intenção certa com a régua errada: 111.374 pontos em 5 pedaços é ceder de
  // 20 em 20 mil itens, ou seja fatias de tamanho arbitrário, e o orçamento da
  // `Obra` (checado ENTRE cessões) não segura nenhuma delas. Agora o relógio
  // manda, e o caminho antigo (`loadPark`) recuperou a respiração de macrotarefa
  // no laço que o roda.
  const n = s16.length / 4
  const spos = new Float32Array(n * 3)
  const itCenso = porIndice(n, (i) => {
    const bx = s16[i * 4] / 4, by = s16[i * 4 + 1] / 4, bz = s16[i * 4 + 2] / 4
    const lx = bx, lz = -by
    spos[i * 3] = lx
    spos[i * 3 + 1] = groundLocal(lx, lz) + Math.max(0.5, bz - parkH(bx, by)) + 0.6
    spos[i * 3 + 2] = lz
  })
  while (!itCenso.next().done) yield
  const sgeo = track(new THREE.BufferGeometry())
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3))
  // pontos que somem quando o tamanho projetado cai abaixo de um pixel (de longe
  // 111 mil pontos de 1 px viravam chuvisco; de perto são o cascalho de Runestones)
  const scatterMat = track(new THREE.ShaderMaterial({
    uniforms: { uHalfH: { value: 450 }, uColor: { value: new THREE.Color(0x9fb4d8) }, uOpacity: { value: 0.6 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uHalfH;
      varying float vA;
      void main() {
        // ATENCAO: aqui havia um include de logdepthbuf_fragment e ele derrubava
        // a cena inteira. Aquele trecho escreve gl_FragDepthEXT a partir de
        // gl_FragCoord, e nenhum dos dois existe num shader de VERTICE: o
        // programa nao compilava e o three cuspia "Vertex shader is not
        // compiled" no primeiro quadro em que o censo entrava no campo de visao.
        // O par certo e logdepthbuf_vertex no fim do vertice, depois de
        // gl_Position, que ja esta la embaixo, e logdepthbuf_fragment no COMECO
        // do fragmento, que estava faltando.
        //
        // E NENHUMA CRASE NESTE COMENTARIO: ele mora dentro de um template
        // literal, e a crase fecha a string. Eu mesmo quebrei o arquivo assim ao
        // escrever esta nota, minutos depois de gravar a armadilha no wiki.
        //
        // E so apareceu agora porque o look=2 virou padrao em 02/09: o buffer
        // logaritmico e ligado pela cena, entao USE_LOGDEPTHBUF so fica definido
        // nesse caminho. O defeito estava escrito havia dias, e calado.
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float ps = 1.6 * uHalfH / max(1.0, -mv.z);
        vA = clamp((ps - 0.5) / 1.6, 0.0, 1.0);
        gl_PointSize = clamp(ps, 1.0, 5.0);
        gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uOpacity;
      varying float vA;
      void main() {
      #include <logdepthbuf_fragment>
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA <= 0.001) discard;
        gl_FragColor = vec4(uColor, uOpacity * vA * (1.0 - d * 1.6));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  const scatter = new THREE.Points(sgeo, scatterMat)
  scatter.name = 'Census'
  scatter.frustumCulled = false
  // no celular o censo não entra (111 mil pontos por quadro); no desktop, só de perto
  if (opts.profile?.censusPoints !== false) {
    group.add(scatter)
    opts.culler?.add(scatter, opts.profile?.parkDetailCull ?? 4200, PARK_CENTER)
  }
  yield

  // ── o templo e o construído ───────────────────────────────────────────────
  const built = new THREE.Group()
  built.add(temple, trails)
  // ⚠️ O `traverse` VIRA LISTA ANTES DE VIRAR TRABALHO. `Object3D.traverse` é uma
  // recursão de uma tacada só: não dá para ceder no meio dela sem inventar uma
  // pilha própria. Colher os nós primeiro custa uma passada barata (138 malhas) e
  // devolve um vetor que o `emFatias` corta. E a ORDEM é a mesma da recursão
  // (pré-ordem), o que importa porque o segundo laço mexe em `position.y` e um
  // pai ajustado antes do filho não dá o mesmo resultado que o contrário.
  const malhas: THREE.Mesh[] = []
  built.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) malhas.push(m) })
  const itPele = emFatias(malhas, (m) => {
    m.castShadow = true
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (!mat) return
    const tier = TIER_BY_NAME[mat.name]
    if (tier !== undefined) { m.material = crystalMats[tier]; return } // torii, lintel: runestones
    if ('roughness' in mat) { mat.roughness = Math.max(0.35, mat.roughness); if ('envMapIntensity' in mat) mat.envMapIntensity = 0.3 }
    if (mat.emissive && mat.emissiveIntensity > 0 && (mat.emissive.r > 0.5)) { mat.toneMapped = false; mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 1.6) }
  })
  while (!itPele.next().done) yield
  // cada peça desce ao datum pelo anel LOCAL dela: o anel do horizonte inclina
  // 0,6° ao longo do parque, e um deslocamento único enterraria a estrada numa
  // ponta e a deixaria no ar na outra
  const bb = new THREE.Box3()
  const c = new THREE.Vector3()
  // ⚠️ `passo` 1 AQUI, e não o 64 padrão. `setFromObject` varre TODOS os
  // vértices da malha, e `trails.glb` sozinho tem 153 mil triângulos: uma malha
  // grande pode custar mais que a fatia inteira, então o relógio é lido a cada
  // uma. Com 138 malhas o custo de ler o relógio é irrelevante.
  const itDatum = emFatias(malhas, (m) => {
    bb.setFromObject(m)
    bb.getCenter(c)
    m.position.y += groundLocal(c.x, c.z) - parkH(c.x, -c.z)
  }, 4, 1)
  while (!itDatum.next().done) yield
  // ── o Templo Leonidas saiu do pódio e entrou na CAVERNA ──────────────────
  // O pódio de três tiers (que o masterplan do parque deixou pronto para um
  // salão que nunca existiu) fica como está: uma plataforma vazia, na trilha.
  // O salão foi para dentro da rocha, entre as monarcas, item 14 da lista do
  // fundador. O que ficou aqui é só a MEDIDA do pódio, que é de onde o caminho
  // secreto sai.
  const podiumBox = (() => {
    let node: THREE.Object3D | null = null
    built.traverse((o) => { if (!node && /^Podium/i.test(o.name)) node = o })
    if (!node) { console.warn('[plaza] Podium node não encontrado no temple.glb'); return null }
    built.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(node)
  })()
  yield
  // ⚠️ A FUSÃO ENTRA AQUI, DEPOIS do `podiumBox` (que procura o nó "Podium" pelo
  // NOME, e a fusão apaga nomes) e depois do laço que ajusta rugosidade e
  // emissiva (a fusão lê o material já mutado, senão reconstrói o valor errado
  // de antes do ajuste). Atrás de `?fundir=1`: sem a bandeira, `built` chega em
  // `mergeStaticByMaterial` do jeito que sempre chegou, byte a byte igual a hoje.
  if (FUNDIR) {
    const r = fundirMalhasLisas(built, /^$/)
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stats') === '1') {
      console.log('[park] fundiu', r.antes, 'malhas lisas em', r.fundidas, 'material(is), recusadas', r.recusadas)
    }
    yield
  }
  // ⚠️ NÃO FATIADA, E NÃO MEDIDA (mediria só com navegador, porque depende do
  // glTF decodificado): uma chamada só de `perf.ts`, que faz `toNonIndexed` e
  // `mergeGeometries` sobre as 138 malhas do construído (`trails.glb` tem 153
  // mil triângulos). Fatiá-la é reescrever a fusão dentro de `perf.ts`, que não
  // é meu arquivo. O que dá para fazer daqui é cercá-la de cessões, e está feito.
  mergeStaticByMaterial(built, /^$/) // 138 malhas → ~20; com `?fundir=1` já não sobra quase nada aqui
  group.add(built)
  // as trilhas e o templo só de perto do parque (153 mil triângulos de passarela)
  opts.culler?.add(built, opts.profile?.parkDetailCull ?? 4200, PARK_CENTER)
  yield

  // ── a caverna do Leonidas, e o caminho secreto que leva a ela ────────────
  // ⚠️ ELA NÃO ESPERA, E NÃO É PREGUIÇA. `buildLeonidasCave` é `async` (baixa
  // quatro glTF) e este é um gerador: não existe `await` aqui dentro. Segurar a
  // fila do parque esperando rede seria o defeito que a `Obra` veio consertar.
  // Então a caverna é DISPARADA aqui e se pendura no grupo quando chegar; o
  // `update` e o `dispose` leem a variável, que pode estar nula por um tempo. O
  // caminho antigo (`loadPark`) espera a promessa antes de devolver, para quem
  // dependia de `TEMPLE_WORLD` preenchido continuar dependendo.
  let cave: LeonidasCave | null = null
  const podC = podiumBox ? podiumBox.getCenter(new THREE.Vector3()) : new THREE.Vector3(1290, 0, -430)
  saida.caverna = buildLeonidasCave({
    gltf, groundLocal, pathFrom: { x: podC.x, z: podC.z }, parkCenter: PARK_CENTER,
    profile: opts.profile, culler: opts.culler,
  }).then((c2) => {
    cave = c2
    if (c2) {
      group.add(c2.group)
      TEMPLE_WORLD.copy(c2.mouthLocal).applyAxisAngle(EIXO_Y, PARK_ROT_Y)
        .add(new THREE.Vector3(PARK_CENTER.x, center0, PARK_CENTER.z))
    }
  }).catch((err) => { console.error('[park] a caverna do Leonidas caiu e o parque seguiu', err) })

  // uma luz fria e baixa no templo, e o cristal-monarca com um halo
  const templeLight = new THREE.PointLight(0xffa04d, 1.0, 700, 1.4) // âmbar: a lei do parque, nada frio aceso
  templeLight.position.set(1290, groundLocal(1290, -430) + 40, -430)
  group.add(templeLight)

  saida.park = {
    group,
    alturaEm,
    update(t, halfHeightPx, camPos) {
      scatterMat.uniforms.uHalfH.value = halfHeightPx
      const dist = camPos.distanceTo(PARK_CENTER)
      lodCrystals(dist)
      lodTerrain(dist)
      cave?.update(t)
    },
    dispose() { cave?.dispose(); for (const d of disposables) d.dispose(); bcTex.dispose(); nmTex.dispose(); crystals.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() }) },
  }
}

/**
 * O caminho antigo, INTACTO na assinatura: devolve o parque pronto, com a
 * caverna já pendurada. Por dentro ele já é o gerador novo, rodado até o fim,
 * com a mesma respiração de macrotarefa que o censo tinha antes (um `setTimeout`
 * a cada ~200 ms de trabalho).
 *
 * ⚠️ ELE NÃO CONSERTA A TRAVA, e não é para consertar: 200 ms de fatia é
 * exatamente o defeito descrito no topo do arquivo. Quem quer a cidade fluida
 * usa `parkComoTrabalho` com a `Obra`. Este aqui existe só enquanto o
 * orquestrador não religa.
 */
export async function loadPark(opts: ParkOpts): Promise<Park> {
  const a = await baixaAtivos(opts)
  const saida: SaidaDoParque = { group: novoGrupoDoParque(), park: null, caverna: null }
  const g = constroiParque(a, opts, saida)
  let t0 = performance.now()
  while (!g.next().done) {
    if (performance.now() - t0 > 200) {
      await new Promise<void>((r) => setTimeout(r, 0))
      t0 = performance.now()
    }
  }
  await saida.caverna
  return saida.park as Park
}

/**
 * O parque como peça da `Obra`. A rede acontece no `await` daqui; o `Trabalho`
 * devolvido é CPU pura, fatiada em ~4 ms.
 *
 * Uso: `const p = await parkComoTrabalho({ ... }); scene.add(p.group); obra.põe(p)`.
 * O grupo já pode entrar na cena vazio, e enche sozinho enquanto a obra anda.
 *
 * `?stats=1` faz a peça relatar no fim quantas fatias gastou e qual foi a maior,
 * que é o número que esta conversão existe para segurar.
 */
export async function parkComoTrabalho(
  opts: ParkOpts & { aoPronto?: (park: Park) => void; peso?: number },
): Promise<ParkTrabalho> {
  const a = await baixaAtivos(opts)
  const saida: SaidaDoParque = { group: novoGrupoDoParque(), park: null, caverna: null }
  return {
    nome: 'Runestone Park',
    // peso relativo, só para a barra andar honesta: o parque é a maior peça da
    // cidade, ~440 ms de laço medidos contra os ~6 do chalé.
    peso: opts.peso ?? 20,
    faixa: 2,
    group: saida.group,
    get parque() { return saida.park },
    *fatia() {
      const g = constroiParque(a, opts, saida)
      // o cronômetro mede o que a `Obra` de fato executa de uma vez, que é
      // exatamente a definição de fatia: um `next()` do gerador de dentro
      let fatias = 0, pior = 0
      for (;;) {
        const t0 = performance.now()
        const r = g.next()
        const dt = performance.now() - t0
        fatias++
        if (dt > pior) pior = dt
        if (r.done) break
        yield
      }
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stats') === '1') {
        console.log('[park] obra em', fatias, 'fatias, a maior de', pior.toFixed(1), 'ms')
      }
      if (saida.park) opts.aoPronto?.(saida.park)
    },
  }
}
