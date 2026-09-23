// ═══════════════════════════════════════════════════════════════════════════
// O TECIDO: o loteamento inteiro sobre o terreno real.
//
// ⚠️ DOIS REGISTROS, E CONFUNDIR OS DOIS FOI ERRO MEU. A primeira versão pintava
// cada lote com a cor da coorte e deixava tudo chapado na altura de um plinto:
// isso é CHAPA DE DIAGNÓSTICO, boa para achar lote em máscara e costura torta, e
// péssima como imagem, porque uma cidade pintada de heatmap parece planilha
// extrudada. O fundador viu e disse o que era: amador.
//
//   'obra'        (padrão)  A CIDADE EM CONSTRUÇÃO: infraestrutura pronta (rua,
//                           canal, orla, túnel, peça) e NENHUM lote desenhado.
//   'massa'                 modelo de massa de arquiteto: volume claro, sem
//                           fachada, altura pela tipologia, rua legível, sombra
//                           lateral de sol baixo. É o registro certo para um
//                           plano ANTES de projetar prédio.
//   'lote'                  plinto raso de 0,45 m por lote, para conferência de
//                           geometria e para ver o parcelamento.
//
// ⚠️ 'obra' É O PADRÃO DESDE 30/08, a pedido do fundador ("retire a demarcação
// dos lotes e adicione a animação de construção"). E é honesto: nada foi mintado
// ainda, então lote demarcado promete uma posse que não existe. O que existe de
// verdade é a infraestrutura, e é ela que a cidade mostra.
//
// ⚠️ NÃO APAGUE O CAMINHO DE 'lote'. Ele é a chapa de conferência de geometria e
// já achou lote em máscara, costura torta e superquadra invadindo quarteirão
// vizinho. `?modo=lote` continua ligando.
//
// ⚠️ NADA AQUI É PROJETO DE PRÉDIO. Massa não é fachada: são caixas sem detalhe,
// que é exatamente como se apresenta plano urbano antes de existir arquitetura.
//
// Lê public/city/cidade-lotes.bin (13 bytes por lote) e public/city/cidade.json.
// A ordem dos registros é a mesma de data/dogcity_lotes.csv, onde mora o dono.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { buildPecas, type Peca } from './pecas'
import { look2 } from './look'
import { vestir } from './materiais'
import { detectTier } from './perf'

export interface TecidoOpts {
  heightAt: (x: number, z: number) => number
  /** 'lote' (padrão) é a cidade ANTES do mint: terreno demarcado e nenhum prédio.
   *  'massa' é a prévia de como ela fica cheia. */
  modo?: 'obra' | 'lote' | 'massa'
  /** sombra própria nos 52.991 volumes: transforma a imagem e custa fps */
  sombra?: boolean
  /** 'pedra' é a paleta de maquete; 'idade' e 'forma' são lentes de diagnóstico */
  pintura?: 'pedra' | 'idade' | 'forma'
  /** ⚠️ 23/09: se não vier, `buildTecido` mede sozinho com `detectTier()` de
   *  `perf.ts` (nunca reinventado aqui). Passe explícito só se quem chama já
   *  tiver o `PerfProfile` pronto e quiser garantir os dois lendo o mesmo tier.
   *  Liga o corte por altura das 70.709 molduras de `?modo=lote` (ver update()
   *  logo abaixo). Em 'obra' (o padrão publicado) isto não faz diferença
   *  nenhuma, porque o laço de lote nem roda; o corte é para quem abre
   *  `?modo=lote` no telefone, que hoje desenha a cidade inteira de uma vez sem
   *  olhar o aparelho. NÃO muda o desktop nem o HIGH. */
  mobile?: boolean
}

export interface Tecido {
  group: THREE.Group
  /** liga e desliga os marcos de esquina por distância; chame no laço */
  update(cam: THREE.Vector3): void
  /** covas de árvore que as peças com módulo próprio pediram, em mundo */
  covas: { x: number; z: number; r: number }[]
  lotes: number
  pecas: number
  triangulos: number
  dispose(): void
}

// ⚠️ A PALETA PADRÃO NÃO É DE DADO, É DE MAQUETE. Quatro tons de concreto claro
// sobre regolito: a variação por lote é o que impede a cidade de virar um bloco
// só, e a ausência de cor forte é o que a faz parecer cidade e não gráfico.
// ⚠️ CLAY É CINZA MÉDIO, NÃO BRANCO. O valor canônico do clay render é 0,65
// linear, cerca de #CCCCCC. A primeira paleta estava em L 0,70 a 0,87: clara
// demais, estourava no sol e matava o meio-tom. Medido na chapa: 50,4% da cidade
// acima de L 0,72 e só 13,4% de meio-tom, ou seja uma imagem de dois valores.
const PEDRA = ['#B9B3A8', '#ADA79B', '#A19B90', '#C4BEB3']
const CORES_COORTE = ['#FFE9C4', '#FFC97A', '#F7931A', '#E8660D', '#C24A12', '#8E3A1B', '#5C2D1E', '#3A2320']
const CORES_FORMA = ['#8B8B93', '#C9A227', '#3FA7D6', '#E8660D', '#E5484D']

// altura de massa por tipologia do utxo_count, em metros. Não é projeto: é a
// silhueta que a regra 4 do fundador já determina (1 UTXO é massa única, 10+ é
// torre), posta em volume para o plano ter relevo.
const ALTURA = [7, 11, 17, 30, 52]

interface Meta {
  distritos?: number; setores?: number; bulevar_m: number
  raioInicio: number; raioSitio: number; raioBorda: number
  plantadas: number; programa: Peca[]
}

/** ruído determinístico por lote: a cidade é a mesma em toda visita */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export async function buildTecido(o: TecidoOpts): Promise<Tecido> {
  const [meta, buf] = await Promise.all([
    fetch('/city/cidade.json').then((r) => r.json() as Promise<Meta>),
    fetch('/city/cidade-lotes.bin').then((r) => r.arrayBuffer()),
  ])
  // ⚠️ O REGISTRO PASSOU DE 11 PARA 13 BYTES. Os dois a mais são o GIRO DO LOTE,
  // uint16 em centésimos de grau. Até aqui a orientação era reconstruída como
  // `setor * 7,5°`, o que funcionava enquanto havia um giro por setor; agora o
  // giro é do QUARTEIRÃO e, na Cinta, é a tangente local, diferente em cada
  // bloco. Derivar do setor giraria a Cinta inteira errado, em silêncio.
  const dv = new DataView(buf)
  // ⚠️ REGISTRO v3 (21/09): 15 bytes. Testada e fundo passaram a uint16 em
  // DECÍMETROS porque o maior lote institucional tem 388 m de testada e o
  // campo de 1 byte parava em 255: o desenho saía 133 m menor que o registro.
  // Os quatro bits de quarto de metro na flag sumiram junto, eram remendo do
  // mesmo problema. Posição segue em quartos de metro.
  const REG = 15
  const n = Math.floor(buf.byteLength / REG)
  const group = new THREE.Group()
  group.name = 'tecido'
  const modo = o.modo ?? 'obra'
  const pintura = o.pintura ?? 'pedra'
  const mobile = o.mobile ?? detectTier() === 'mobile'

  // ⚠️ O RECUO É O QUE FAZ A RUA EXISTIR. Sem ele os lotes se encostam, o
  // quarteirão vira uma mancha só e a cidade perde a coisa mais básica que ela
  // tem, que é o desenho da rua entre as coisas. 1,4 m de cada lado.
  const RECUO = 1.4

  /** a cor da linha de divisa quando a pintura é a de pedra: cal sobre
   *  regolito, que é como um loteamento se marca no chão de verdade. */
  const COR_DIVISA = '#D8D2C4'
  /** o passo do tracejado, em metros de divisa. 3 m pintados, 3 m de chão. */
  const DASH = 6.0
  /** o acumulador da moldura: posição, cor, `u` (metro corrido ao longo da
   *  divisa, de onde sai o tracejado) e o setor de cada lote, para o corte por
   *  esfera continuar valendo. */
  const mol = { pos: [] as number[], cor: [] as number[], u: [] as number[],
                idx: [] as number[], setor: [] as number[] }
  const sSetDe = (s: number) => (s < SET ? s : SET - 1)

  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.translate(0, 0.5, 0)          // pivô no pé: a massa cresce do chão para cima
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.0 })
  // ⚠️ AQUI A COR POR INSTÂNCIA GANHOU, E ELA MULTIPLICA O MAPA IGUALZINHO À COR
  // POR VÉRTICE. A maquete tem uma paleta de clay MEDIDA (PEDRA, L 0,65, a nota
  // logo acima diz por quê); vestir com o albedo de 'concreto' multiplicaria
  // 0,48 linear por 0,33 e devolveria a cidade a 0,16, ou seja desfazendo o
  // ajuste de valor que já custou uma rodada. E clarear a paleta pra compensar
  // não fecha: o fator seria 3,07 e estoura em 1.
  // Por isso o albedo do mapa SAI e ficam o normal e a rugosidade. Isso é o que
  // a maquete precisava mesmo: relevo de fôrma e resposta de luz não uniforme,
  // com o valor do clay intacto.
  // ⚠️ SÓ VALE NOS MODOS 'lote' E 'massa'. Em 'obra', que é o padrão, este
  // material não vai a lugar nenhum, porque o laço abaixo nem roda.
  if (look2 && modo !== 'obra') {
    vestir(mat, 'concreto', 12, { normal: 0.9, macro: false })
    mat.map = null
    mat.needsUpdate = true
  }
  // ⚠️ UMA MALHA POR SETOR, E NÃO UMA SÓ, PORQUE O FRUSTUM PRECISA DE UMA ESFERA
  // QUE SIRVA DE TESTE. Com os 52.984 lotes numa InstancedMesh única, a esfera
  // envolvente dela tem raio de 6.894 m e cobre a cidade inteira: ela intersecta
  // o frustum SEMPRE, olhando para onde for, e por isso o módulo vivia com
  // `frustumCulled = false`. Resultado medido em 29/08: 1,44 milhão de triângulos
  // desenhados em toda vista, inclusive nas que olham para o lado oposto.
  // Fatiado em 12 setores, cada esfera tem raio de cerca de 1.700 m e o
  // renderizador descarta as que estão fora do quadro. Custa 11 chamadas de
  // desenho a mais, que é o troco.
  // ⚠️ ISTO DERRUBOU O TECIDO INTEIRO E EM SILÊNCIO. O campo `setores` virou
  // `distritos` quando os 12 setores de 7,5° deram lugar a 6 distritos desiguais.
  // `Array.from({length: undefined})` devolve array VAZIO, então `porSetor[s]`
  // era undefined e o módulo morria no primeiro lote: a cidade subia só com ruas.
  const SET_TECIDO = meta.distritos ?? meta.setores ?? 12
  // ⚠️ OS DISTRITOS ESPECIAIS TÊM BALDE PRÓPRIO, E ATÉ 22/09 NÃO TINHAM.
  //
  // O balde de instância existe para uma coisa só: dar a cada malha uma esfera
  // de corte APERTADA, para o frustum descartar o setor inteiro numa comparação.
  // O registro, porém, tem setores que não são distrito de tecido: a Orla Nobre
  // grava setor 7, o Distrito Financeiro 8 e a Orla da Baía 9. Com
  // `Math.min(SET - 1, setor)` os três caíam TODOS no balde do último distrito,
  // e a esfera dele passava a envolver a cidade inteira — ou seja o distrito
  // com mais lotes da cidade deixava de ser cortado, por causa de um punhado de
  // lotes do outro lado do mapa.
  //
  // Enquanto eram 532 lotes (Orla Nobre e Financeiro) isso passou batido. Com a
  // Orla da Baía são 2.594 lotes espalhados por 130° de arco, e o balde
  // envenenado é o maior da cidade. O conserto é não amontoar: o número de
  // baldes sai do MAIOR setor que o arquivo traz, e cada um fica com a esfera
  // que é de fato a dele.
  let setorMax = SET_TECIDO - 1
  for (let i = 0; i < n; i++) setorMax = Math.max(setorMax, dv.getUint8(i * REG + 4))
  const SET = setorMax + 1
  const porSetor: { m: number[]; c: number[] }[] = Array.from({ length: SET }, () => ({ m: [], c: [] }))
  const m4 = new THREE.Matrix4()
  const cor = new THREE.Color()
  const q = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const esc = new THREE.Vector3()

  // ⚠️ EM 'obra' O LAÇO NEM RODA. Não basta esconder a malha depois: o laço faz
  // 5 sondagens de terreno por lote em 85.839 lotes, ou seja 429 mil chamadas de
  // `superficieAt`, e isso é o grosso do tempo de subida da cena.
  for (let i = 0; modo !== 'obra' && i < n; i++) {
    const off = i * REG
    // ⚠️ REGISTRO v2 (20/09): posição em QUARTOS DE METRO e o quarto de metro da
    // frente e do fundo nos bits 4-7 da flag. Em metros inteiros, dois lotes que
    // se encostam na divisa de fundo apareciam cruzados em até 1 m, e meio metro
    // de erro é degrau de calçada para o boneco de 1,70 m.
    const x = dv.getInt16(off, true) / 4, z = dv.getInt16(off + 2, true) / 4
    const setor = dv.getUint8(off + 4), coorte = dv.getUint8(off + 5)
    const flags = dv.getUint8(off + 8)
    const frente = dv.getUint16(off + 9, true) / 10
    const prof = dv.getUint16(off + 11, true) / 10
    const giroLote = (dv.getUint16(off + 13, true) / 100) * Math.PI / 180
    const forma = Math.min(4, (flags >> 1) & 7)
    const r01 = hash01(i)

    let alt: number
    if (modo === 'lote') {
      // ⚠️ O TERRENO NÃO É PRÉDIO. 0,45 m é o suficiente para a borda do lote
      // lançar uma linha de sombra com sol a 16 graus e o parcelamento ficar
      // legível; mais que isso e o loteamento vira maquete de cidade cheia,
      // que é exatamente o que o fundador não quer antes do mint.
      alt = 0.45
    } else {
      // altura pela tipologia, modulada pela área e por um ruído fixo, para o
      // quarteirão ter perfil em vez de virar um degrau só
      const areaRel = Math.min(3, (frente * prof) / 300)
      alt = ALTURA[forma] * (0.72 + 0.5 * areaRel * 0.35 + 0.4 * r01)
    }

    // ⚠️ NO MODO LOTE O TERRENO DEIXA DE SER VOLUME E VIRA MOLDURA NO CHÃO.
    //
    // Queixa do fundador, 22/09: "todos os terrenos são blocos de concreto
    // sobre o terreno, parece que todos foram levantados, e que todas as ruas
    // estariam no andar de baixo". Ele está certo e a causa são DUAS somadas:
    // a caixa de 0,45 m, e o pé dela ser o canto MAIS ALTO dos quatro (a nota
    // logo abaixo explica por que era assim: assentando pelo centro, metade do
    // lote enterrava). Num lote de 68 m de fundo com o teto de declive de 12%,
    // o canto mais alto está 8 m acima do mais baixo: a laje fica pairando
    // metros no ar do lado de baixo, e a rua ao lado parece um piso inferior.
    //
    // A saída é a que ele pediu: pontilhado no chão demarcando o terreno. A
    // moldura tem QUATRO CANTOS COM COTA PRÓPRIA, então ela acompanha o
    // declive e não pode nem flutuar nem cortar. O tracejado não é geometria
    // (dash por geometria custaria 60 triângulos por lote, 4,2 M no total): é
    // descarte por `u` no fragmento, 8 triângulos por lote.
    if (modo === 'lote') {
      const cg = Math.cos(-giroLote), sg = Math.sin(-giroLote)
      const mf = Math.max(1.5, frente / 2 - RECUO), mp = Math.max(1.5, prof / 2 - RECUO)
      const BANDA = Math.min(1.2, Math.min(mf, mp) * 0.35)
      // os quatro cantos, cada um na SUA cota: é isto que tira o lote do ar
      const cantos: [number, number, number][] = []
      for (const [lx, lz] of [[-mf, -mp], [mf, -mp], [mf, mp], [-mf, mp]] as const) {
        const wx = x + lx * cg - lz * sg, wz = z + lx * sg + lz * cg
        cantos.push([wx, o.heightAt(wx, wz) + 0.10, wz])
      }
      // e os quatro de dentro, na MESMA cota do canto de fora: a 1,2 m de
      // distância o chão não muda o bastante para pagar outra sondagem, e o
      // laço já é o grosso do tempo de subida da cena.
      const dentro: [number, number, number][] = []
      for (let k = 0; k < 4; k++) {
        const [lx, lz] = [[-mf + BANDA, -mp + BANDA], [mf - BANDA, -mp + BANDA],
                          [mf - BANDA, mp - BANDA], [-mf + BANDA, mp - BANDA]][k] as [number, number]
        dentro.push([x + lx * cg - lz * sg, cantos[k][1], z + lx * sg + lz * cg])
      }
      cor.set(pintura === 'idade' ? CORES_COORTE[Math.min(7, coorte)]
            : pintura === 'forma' ? CORES_FORMA[forma]
            : COR_DIVISA)
      if (flags & 1) cor.set('#7FD4E0')
      const base = mol.pos.length / 3
      let u = 0
      for (let k = 0; k < 4; k++) {
        const a = cantos[k], b = cantos[(k + 1) % 4]
        const ai = dentro[k], bi = dentro[(k + 1) % 4]
        const lado = Math.hypot(b[0] - a[0], b[2] - a[2])
        for (const [p, uu] of [[a, u], [b, u + lado], [ai, u], [bi, u + lado]] as const) {
          mol.pos.push(p[0], p[1], p[2])
          mol.cor.push(cor.r, cor.g, cor.b)
          mol.u.push(uu)
        }
        const q0 = base + k * 4
        mol.idx.push(q0, q0 + 1, q0 + 3, q0, q0 + 3, q0 + 2)
        u += lado
      }
      mol.setor.push(sSetDe(setor))
      continue
    }

    q.setFromAxisAngle(eixoY, -giroLote)
    // ⚠️ O PÉ DO LOTE É O PONTO MAIS ALTO DA TESTADA, NÃO O CENTRO. Uma caixa é
    // plana e o terreno não: assentando pelo centro, a metade de cima do lote
    // afunda no regolito. Medido em 29/08 com 4.000 sondas verticais: 8,1% das
    // amostras tinham chão por cima do lote, com o pior caso a 11,9 m, e os
    // piores são justamente os maiores (a superquadra tem 168 m de testada num
    // terreno que sobe). Tomando o MÁXIMO dos cinco pontos o lote nunca enterra;
    // no máximo sobra um degrau do lado de baixo, que é o que um embasamento faz
    // num terreno em declive de qualquer jeito.
    const meiaF = frente / 2, meiaP = prof / 2
    let base = o.heightAt(x, z)
    for (const [dx, dz] of [[-meiaF, -meiaP], [meiaF, -meiaP], [-meiaF, meiaP], [meiaF, meiaP]] as const) {
      const gx = -giroLote
      const cgx = Math.cos(gx), sgx = Math.sin(gx)
      base = Math.max(base, o.heightAt(x + dx * cgx - dz * sgx, z + dx * sgx + dz * cgx))
    }
    pos.set(x, base, z)
    esc.set(Math.max(3, frente - RECUO * 2), alt, Math.max(3, prof - RECUO * 2))
    m4.compose(pos, q, esc)
    const sSet = setor < SET ? setor : SET - 1
    porSetor[sSet].m.push(...m4.elements)

    if (pintura === 'idade') cor.set(CORES_COORTE[Math.min(7, coorte)])
    else if (pintura === 'forma') cor.set(CORES_FORMA[forma])
    else {
      cor.set(PEDRA[(i + forma) % PEDRA.length])
      // escurece de leve com o ruído: quatro tons chapados ainda leem como quatro
      const k = 0.88 + 0.16 * r01
      cor.setRGB(cor.r * k, cor.g * k, cor.b * k)
    }
    if (flags & 1) cor.set('#7FD4E0')      // o condomínio DSC continua marcado
    porSetor[sSet].c.push(cor.r, cor.g, cor.b)
  }

  // ── a moldura de divisa, uma malha por setor ─────────────────────────────
  // ⚠️ NÃO É INSTÂNCIA, E NÃO PODE SER. Instância é um transform rígido: uma
  // moldura plana instanciada cortaria o chão de um lado e boiaria do outro
  // exatamente onde o lote está em declive, que é o defeito que ela veio
  // consertar. Cada canto precisa da cota dele, então cada lote traz os seus
  // oito vértices. São 8 triângulos por lote (contra 12 da caixa) e cerca de
  // 17 MB no modo `lote`, que NÃO é o modo padrão da cena.
  const molhas: THREE.Mesh[] = []
  if (modo === 'lote' && mol.setor.length) {
    const matMol = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    // ⚠️ O TRACEJADO É DESCARTE NO FRAGMENTO, NÃO GEOMETRIA NEM TEXTURA. Dash
    // por geometria custaria 60 triângulos por lote (4,2 M na cidade); por
    // textura custaria um sampler e um material novo, que é o recurso escasso
    // desta cena. Aqui é uma linha de GLSL sobre o `u` que já viaja no vértice.
    matMol.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aU;\nvarying float vU;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vU = aU;')
      sh.fragmentShader = 'varying float vU;\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>',
                 `#include <clipping_planes_fragment>\n  if (fract(vU / ${DASH.toFixed(1)}) > 0.5) discard;`)
    }
    const porS: Record<number, number[]> = {}
    for (let i = 0; i < mol.setor.length; i++) (porS[mol.setor[i]] ||= []).push(i)
    for (const [sTxt, lista] of Object.entries(porS)) {
      const pos: number[] = [], cores: number[] = [], us: number[] = [], idx: number[] = []
      let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity
      for (const li of lista) {
        const b = li * 16, base = pos.length / 3
        for (let v = 0; v < 16; v++) {
          pos.push(mol.pos[(b + v) * 3], mol.pos[(b + v) * 3 + 1], mol.pos[(b + v) * 3 + 2])
          cores.push(mol.cor[(b + v) * 3], mol.cor[(b + v) * 3 + 1], mol.cor[(b + v) * 3 + 2])
          us.push(mol.u[b + v])
          mnX = Math.min(mnX, mol.pos[(b + v) * 3]); mxX = Math.max(mxX, mol.pos[(b + v) * 3])
          mnZ = Math.min(mnZ, mol.pos[(b + v) * 3 + 2]); mxZ = Math.max(mxZ, mol.pos[(b + v) * 3 + 2])
        }
        for (let k = 0; k < 4; k++) {
          const q0 = base + k * 4
          idx.push(q0, q0 + 1, q0 + 3, q0, q0 + 3, q0 + 2)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
      g.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1))
      g.setIndex(idx)
      // ⚠️ A ESFERA VAI NA GEOMETRIA, NÃO NA MALHA: `Mesh` não tem
      // `boundingSphere`; quem o frustum consulta é o da geometria. Escrever no
      // objeto errado compila em JS e o corte simplesmente nunca acontece.
      g.boundingSphere = new THREE.Sphere(
        new THREE.Vector3((mnX + mxX) / 2, 0, (mnZ + mxZ) / 2),
        Math.hypot(mxX - mnX, mxZ - mnZ) / 2 + 20)
      const m = new THREE.Mesh(g, matMol)
      m.name = `tecido:divisa:S${String(+sTxt + 1).padStart(2, '0')}`
      m.frustumCulled = true
      m.renderOrder = 2
      molhas.push(m)
      group.add(m)
    }
  }

  // ── as 12 malhas, uma por setor, cada uma com a esfera dela ──────────────
  const lotes: THREE.InstancedMesh[] = []
  const tmp = new THREE.Matrix4()
  const cen = new THREE.Vector3()
  for (let sIdx = 0; sIdx < SET; sIdx++) {
    const b = porSetor[sIdx]
    const qtd = b.c.length / 3
    if (!qtd) continue
    const im = new THREE.InstancedMesh(geo, mat, qtd)
    im.name = `tecido:lote:S${String(sIdx + 1).padStart(2, '0')}`
    const cx: number[] = []
    for (let k = 0; k < qtd; k++) {
      tmp.fromArray(b.m, k * 16)
      im.setMatrixAt(k, tmp)
      im.setColorAt(k, cor.setRGB(b.c[k * 3], b.c[k * 3 + 1], b.c[k * 3 + 2]))
      cx.push(tmp.elements[12], tmp.elements[13], tmp.elements[14])
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    // ⚠️ A ESFERA SAI DAS INSTÂNCIAS, NÃO DA GEOMETRIA. `computeBoundingSphere`
    // do three olha só a caixa de 1 m da geometria base e daria uma esfera
    // minúscula na origem: o setor inteiro sumiria da tela. A esfera correta é a
    // que envolve as POSIÇÕES das instâncias, com folga para a altura do volume.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let k = 0; k < qtd; k++) {
      minX = Math.min(minX, cx[k * 3]); maxX = Math.max(maxX, cx[k * 3])
      minZ = Math.min(minZ, cx[k * 3 + 2]); maxZ = Math.max(maxZ, cx[k * 3 + 2])
    }
    cen.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
    const raio = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 90   // 90 m de folga
    im.boundingSphere = new THREE.Sphere(cen, raio)
    im.frustumCulled = true
    im.receiveShadow = true
    lotes.push(im)
  }
  const malha = lotes[0]
  // ⚠️ SOMBRA PRÓPRIA, e ela era a causa raiz do achatamento. Até agora os 52.991
  // volumes só RECEBIAM sombra e nunca lançavam: por isso o modelo de massa lia
  // como planta extrudada em vez de maquete.
  // ⚠️ E ELA NÃO É DE GRAÇA. A frente de cena mediu 1,0 ms na vista de plano, mas
  // na rasante, com muito mais lançador dentro da câmera de sombra, o quadro cai
  // de 51 para 24 fps. Fica ligada por padrão no modo massa, que é o registro de
  // CHAPA, e sai com ?sombra=0 para navegar.
  for (const im of lotes) im.castShadow = o.sombra ?? (modo === 'massa')
  for (const im of lotes) group.add(im)

  // ⚠️ O CORTE POR ALTURA DO CELULAR, 23/09. O fundador: "ta dando o navegador
  // no celular, provavelmente tudo isso que entrou nao foi otimizado pra nao
  // quebrar em mobile". As 70.709 molduras (8 triângulos cada, 565.672 no
  // total) já são cortadas por setor pelo frustum (nota lá em cima), mas o
  // frustum só descarta o que está fora do CAMPO DE VISÃO: uma câmera alta
  // olhando para baixo, que é exatamente a vista de visão geral que uma chapa
  // ou um visitante curioso tomam, enxerga vários setores ao mesmo tempo e o
  // frustum não ajuda em nada.
  //
  // Medido em 23/09 no próprio registro (`cidade-lotes.bin`, 70.709 lotes em 9
  // setores): o raio de cada setor (bounding box da nuvem de pontos dele) vai
  // de 1.048 m (Distrito Financeiro, minúsculo) a 6.391 m (Orla Nobre, um anel
  // esparso que se estende quase pelo sítio inteiro), contra um sítio publicado
  // (`cidade.json.raioSitio`) de 9.000 m de raio. Setores desse tamanho ficam
  // encostados uns nos outros perto do centro: não precisa estar muito alto
  // para o cone de 42° de FOV pegar mais de um ao mesmo tempo.
  // O corte escolhido (1.500 m) é quase dez vezes o teto de quem está
  // ANDANDO pela cidade (`ALT_PASSEIO = 160` em explore.ts, o limiar entre
  // passeio e voo) e menos de um sexto do raio do sítio inteiro: alto o
  // bastante para nunca pegar quem está de fato conferindo um lote de perto, e
  // baixo o bastante para desligar bem antes da vista de topo que enxerga a
  // cidade inteira de uma vez.
  //
  // ⚠️ A ARMADILHA: ALTURA É SOBRE O CHÃO LOCAL, NÃO SOBRE O MAR. O sítio tem
  // relevo (montanha, cratera, abóbada): usar `cam.y` sozinho confundiria um
  // voo rasante perto de um pico alto com "câmera longe olhando a cidade
  // inteira" bem no meio do passeio de rua. `o.heightAt(cam.x, cam.z)` é a
  // MESMA sonda que assenta o lote, então o corte concorda com o chão que a
  // própria cidade desenha.
  //
  // ⚠️ SÓ NO CELULAR (`mobile`), E SÓ EM `modo=lote`. `modo=obra`, que é o
  // padrão publicado, nem chega aqui: `molhas` fica vazio e o laço abaixo não
  // tem o que apagar. Desktop e o perfil HIGH não mudam em nada: o fundador só
  // pediu conserto para o aparelho que está travando.
  const ALT_MOLDURA_MOBILE = 1500

  // ── os marcos de esquina ──────────────────────────────────────────────────
  // ⚠️ UM POR LOTE, e é ele que faz o chão parecer DEMARCADO em vez de pintado.
  // De longe some, de perto conta a história certa: terreno medido, com dono,
  // esperando construção. 52.991 instâncias de 12 triângulos, dentro do teto
  // medido de 300.000 e sem chamada de desenho nova relevante.
  const marcosSetores: { m: THREE.InstancedMesh; cx: number; cz: number; raio: number }[] = []
  let geoMarco: THREE.BufferGeometry | null = null
  let matMarco: THREE.Material | null = null
  if (modo === 'lote') {
    geoMarco = new THREE.BoxGeometry(0.5, 1.5, 0.5)
    geoMarco.translate(0, 0.75, 0)
    matMarco = new THREE.MeshStandardMaterial({ color: '#8A8375', roughness: 0.95 })
    // ⚠️ O MARCO PRECISA SUMIR DE LONGE, E ELE NÃO SUMIA. O comentário acima
    // sempre disse "de longe some": não sumia. Eram 52.984 instâncias de 12
    // triângulos numa malha só, com `frustumCulled = false` e `castShadow`
    // ligado, ou seja 636 mil triângulos desenhados em toda vista MAIS 636 mil na
    // passada de sombra, para postes de 1,5 m que a 1 km medem menos de um pixel.
    // Medido em 29/08: escondendo o grupo `tecido` o quadro caía de 26,6 para
    // 13,3 ms, que é a diferença entre 37 e 75 fps por causa do vsync.
    // Agora são 12 malhas, uma por setor, e cada uma some a 900 m do centro dela.
    const marcosPorSetor: number[][] = Array.from({ length: SET }, () => [])
    const mm = new THREE.Matrix4()
    const pm = new THREE.Vector3()
    const qm = new THREE.Quaternion()
    const em = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < n; i++) {
      const off = i * REG
      const x = dv.getInt16(off, true) / 4, z = dv.getInt16(off + 2, true) / 4
      const setor = dv.getUint8(off + 4)
      const frente = dv.getUint16(off + 9, true) / 10
      const prof = dv.getUint16(off + 11, true) / 10
    const giroLote = (dv.getUint16(off + 13, true) / 100) * Math.PI / 180
      const ang = -giroLote
      const cx = Math.cos(ang), sx = Math.sin(ang)
      // esquina da frente, no canto esquerdo de quem olha da rua
      const lx = -frente / 2 + 0.6, lz = -prof / 2 + 0.6
      const wx = x + lx * cx - lz * sx
      const wz = z + lx * sx + lz * cx
      qm.setFromAxisAngle(eixoY, ang)
      pm.set(wx, o.heightAt(wx, wz), wz)
      mm.compose(pm, qm, em)
      marcosPorSetor[setor < SET ? setor : SET - 1].push(...mm.elements)
    }
    for (let sIdx = 0; sIdx < SET; sIdx++) {
      const arr = marcosPorSetor[sIdx]
      const qtd = arr.length / 16
      if (!qtd) continue
      const im = new THREE.InstancedMesh(geoMarco, matMarco, qtd)
      im.name = `tecido:marco:S${String(sIdx + 1).padStart(2, '0')}`
      let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity
      for (let k = 0; k < qtd; k++) {
        mm.fromArray(arr, k * 16)
        im.setMatrixAt(k, mm)
        const px = mm.elements[12], pz = mm.elements[14]
        mnX = Math.min(mnX, px); mxX = Math.max(mxX, px)
        mnZ = Math.min(mnZ, pz); mxZ = Math.max(mxZ, pz)
      }
      im.instanceMatrix.needsUpdate = true
      im.frustumCulled = false
      // ⚠️ SOMBRA DESLIGADA NO MARCO. Um poste de 1,5 m projeta 2,4 m com o sol a
      // 32 graus, que na chapa de topo mede 0,4 px. Ele estava dobrando o custo
      // dele na passada de sombra para não desenhar nada.
      im.castShadow = false
      im.receiveShadow = true
      group.add(im)
      marcosSetores.push({ m: im, cx: (mnX + mxX) / 2, cz: (mnZ + mxZ) / 2, raio: Math.hypot(mxX - mnX, mxZ - mnZ) / 2 })
    }
  }

  // ── os bulevares de costura MUDARAM DE ARQUIVO ────────────────────────────
  // ⚠️ NÃO REDESENHE BULEVAR AQUI. Eles moram em app/city/plaza/vias.ts desde
  // 29/08/2026, junto com a via de contorno e as travessas, porque rua é uma
  // coisa só e tinha de ter um dono só. A versão que vivia aqui desenhava a
  // pista em +0,45 e o meio-fio em +0,30, ou seja a seção de cabeça para baixo:
  // a via virava um planalto claro com moldura escura em vez de uma calha. Se os
  // dois módulos desenharem, as faixas coplanares brigam no z-buffer.

  // ── as peças demarcadas ───────────────────────────────────────────────────
  // ⚠️ CADA TIPO TEM DESENHO PRÓPRIO, e isso deixou de ser detalhe: enquanto
  // eram elipses coloridas, estádio, lago e alfândega tinham a mesma forma e a
  // cidade parecia um mapa com adesivos. O desenho de cada uma mora em
  // app/city/plaza/pecas.ts. Continua sendo massa, sem fachada.
  const pecas = (meta.programa ?? []) as Peca[]
  // ⚠️ A COMPOSIÇÃO 3D DA PEÇA FICOU ADIADA, NÃO APAGADA (fundador, 31/08: "não
  // precisamos das peças ainda, somente do projeto delas na cidade"). O que a
  // cidade mostra agora é a PARCELA RESERVADA, desenhada por `programa.ts` sobre
  // um número inteiro de módulos da teia, com rua nos quatro lados por
  // construção. As 3.134 linhas de `pecas/*.ts` continuam no repositório e voltam
  // com `?pecas3d=1` — elas são projeto nosso, não asset baixado, e o defeito
  // nunca foi o desenho delas: era o endereço, que vinha de outra grade.
  const quer3d = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('pecas3d') === '1'
  const construidas = quer3d
    ? buildPecas(pecas, o.heightAt)
    : { group: new THREE.Group(), triangulos: 0, covas: [], dispose() {} }
  group.add(construidas.group)

  // ⚠️ NO MODO LOTE SÃO 8 TRIÂNGULOS (a moldura), NÃO 12 (a caixa).
  const triangulos = (modo === 'obra' ? 0 : n * (modo === 'lote' ? 8 : 12)) + construidas.triangulos
  // ⚠️ 900 m É ONDE O MARCO PARA DE CONTAR HISTÓRIA. Ele tem 1,5 m: a essa
  // distância mede cerca de 2 px de altura, e o que ele diz (terreno demarcado,
  // com dono) já foi dito pela própria fileira de lotes.
  const R_MARCO = 900
  return {
    group,
    update(cam: THREE.Vector3) {
      for (const s2 of marcosSetores) {
        const on = Math.hypot(cam.x - s2.cx, cam.z - s2.cz) < R_MARCO + s2.raio
        if (s2.m.visible !== on) s2.m.visible = on
      }
      // corte por altura das molduras no celular; ver a nota longa acima de
      // `ALT_MOLDURA_MOBILE`. `molhas` só existe em `modo=lote`, então em
      // 'obra' e 'massa' este laço roda vazio e não custa nada.
      if (mobile && molhas.length) {
        const chao = o.heightAt(cam.x, cam.z)
        const on = cam.y - chao < ALT_MOLDURA_MOBILE
        for (const m of molhas) if (m.visible !== on) m.visible = on
      }
    },
    covas: construidas.covas,
    lotes: modo === 'obra' ? 0 : n,
    pecas: pecas.length,
    triangulos,
    dispose() {
      geo.dispose(); mat.dispose()
      for (const im of lotes) im.dispose()
      for (const m of molhas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      geoMarco?.dispose(); matMarco?.dispose()
      construidas.dispose()
    },
  }
}
