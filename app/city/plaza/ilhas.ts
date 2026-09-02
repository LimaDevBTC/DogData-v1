// ═══════════════════════════════════════════════════════════════════════════
// AS ILHAS DA BAÍA: o endereço mais exclusivo da cidade
//
// ⚠️ O PROGRAMA É DO FUNDADOR, 30/08: "o principal é a praia e 2 exemplares de
// local plano pra construção de uma mansão. Todas as ilhas servem a esse
// propósito, ser casa dos magnatas. Será o local mais exclusivo da cidade."
// A ilha aqui não é paisagem, é LOTE: praia, DOIS patamares de construção, e
// trilha ligando os dois à orla.
//
// ⚠️ E A REFERÊNCIA É DELE: "Bahamas, Maldivas, Angra dos Reis". As três não se
// parecem entre si, mas o que elas TÊM EM COMUM não é a montanha, é o BANCO
// RASO: cayo baixo sobre banco de areia, atol com lagoa, morro granítico com
// enseada funda e praia no fundo dela. Nenhuma das três tem pico.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ A ILHA DEIXOU DE SER UM CONTORNO E VIROU RELEVO CORTADO PELO MAR, EM
// 02/09, E ESTA É A LIÇÃO MAIS CARA DESTE ARQUIVO. LEIA ANTES DE MEXER.
//
// As duas primeiras versões descreviam a costa como `r(a)`, o raio em função do
// rumo: primeiro uma senoide, depois um fbm de várias oitavas. A segunda é
// melhor que a primeira e as duas estão CONDENADAS PELA REPRESENTAÇÃO, não pelo
// ajuste. Enquanto a costa for `r(a)`, todo ponto dela mora num rumo único visto
// do centro, e disso decorre, sem escapatória:
//
//   nao existe enseada que abraca      (dois pontos no mesmo rumo)
//   nao existe gancho nem restinga     (idem)
//   nao existe lagoa interna           (a costa e' uma curva so)
//   nao existe ilhota destacada        (a costa e' conexa por construcao)
//
// Ou seja: por mais oitavas que se empilhe, sai ESTRELA DE BRAÇOS. Foi o que a
// chapa mostrou, e a palavra do fundador foi "hoje elas parecem alienígenas".
// Empilhar ruído conserta a TEXTURA da costa e não toca na TOPOLOGIA dela.
//
// Agora a ilha é o que a natureza faz e o que o resto deste mapa já faz: um
// CAMPO DE ALTURA, e a costa é apenas onde ele cruza a lâmina. A massa vem de
// dois a quatro domos suaves SOBREPOSTOS E DESCENTRADOS, mais um fbm em DUAS
// dimensões. Península, enseada que abraça, lagoa e ilhota solta saem de graça
// do descentramento, sem uma regra especial para cada caso. Uma ilha virar duas,
// ou nascer com uma lagoa dentro, não é defeito: é o ponto.
//
// ⚠️ E É POR ISSO QUE `patamares` SUMIU DA TABELA. Com contorno paramétrico dava
// para escrever o pad à mão; com campo de altura o lugar plano só se sabe depois
// de gerar o campo. Os dois pads e a trilha agora são MEDIDOS no campo (os dois
// máximos da distância à costa), o que também impede que a tabela e a geometria
// divirjam em silêncio, que é como esta cena já perdeu semanas.
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ OS NÚMEROS DESTA VERSÃO, medidos fora do navegador sobre o campo de altura
// (o script vive no scratchpad; o que importa é que dá para refazer):
//
//   25 especificacoes que produzem 28 CORPOS de terra (tres ilhas se partem)
//   5,50 km2 de terra, 74,67 km de linha d'agua, 13,58 km de orla por km2
//   282.776 triangulos, UMA chamada de desenho, UM programa
//   folga minima ate a terra firme: 80 m, medida no contorno de todas elas
//
// Para comparar com as duas versões mortas, na mesma baía: a roseta de senoide
// dava 8,48 km de orla por km² e o fbm radial 7,90. O campo de altura dá 13,58,
// e o ganho não é de ajuste, é de TOPOLOGIA: ele pode fazer curva que volta.
//
// ⚠️ A PRAIA SAI DA INCLINAÇÃO, NÃO DE UMA FAIXA DE COTA. A versão anterior
// pintava de areia tudo abaixo de 4 m e a chapa mostrava metade da ilha branca.
// A regra certa já estava medida na margem da baía (`lagos.ts`, PRAIA_SUBIDA e
// PRAIA_MAX): encosta rasa dá praia larga, encosta íngreme não dá praia nenhuma.
// As constantes são as MESMAS de lá, de propósito: a praia da ilha e a praia do
// continente têm de ser a mesma praia.
//
// ⚠️ E A PALETA É MEDIDA DO MAPA, NÃO ESCOLHIDA. O creme #E2D9BE que estava aqui
// é muito mais claro que qualquer chão desta cidade, e era isso que fazia a ilha
// ler como objeto colado por cima. Agora a areia é a `COR_AREIA` da margem da
// baía, a mata é a `COR_MATO` do tecido, e a rocha é a `TINTA_REGOLITO` do
// terreno. Mesma família, mesma resposta à luz.
//
// ⚠️ E O HALO DE RASO É OBRIGATÓRIO, senão nada disso salva. A lâmina da baía não
// tem furo onde a ilha está, então `campoDeMargem` media a distância até a margem
// EXTERNA da baía e devolvia água cheia, opaca e escura encostando na praia: a
// ilha lia como adesivo recortado. `contornosIlhas()` existe para `lago.ts`
// injetar a costa de cada ilha como margem, e o gradiente de profundidade que já
// existe faz o resto.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { look2 } from './look'
import { superficie } from './materiais'

// ── a paleta, medida do resto do mapa ──────────────────────────────────────
// ⚠️ NÃO INVENTE TOM AQUI. Cada uma destas cores tem um dono em outro arquivo, e
// o valor foi copiado de lá. Se um dia divergirem, a ilha volta a saltar do mapa.
const C_AREIA = new THREE.Color('#8E856F')   // = COR_AREIA de lagos.ts (praia da baía)
const C_MATO = new THREE.Color('#6C7A5B')    // = COR_MATO de lago.ts (a mata do tecido)
const C_MATO_S = new THREE.Color('#7E8A6B')  // = COR_TERRA de lago.ts (a capoeira seca)
const C_MATO_E = new THREE.Color('#5A6650')  // a mesma mata, fechada, no alto
const C_ROCHA = new THREE.Color('#9A948B')   // = TINTA_REGOLITO de terrain.ts
// ⚠️ O TOM DO PATAMAR SAIU DA PALETA EM 03/09. Ele era `#A39C90`, quase branco
// ao lado do verde, e na chapa os dois pads liam como remendo de neve com borda
// serrilhada, a pior coisa do quadro. A decisão, com a conta na mão: ANTES DO
// MINT UM PATAMAR NÃO É UMA SUPERFÍCIE, É UMA PROMESSA. O que existe hoje ali é
// terraplenagem, e terraplenagem se vê pelo RELEVO (o aplainamento continua no
// campo de altura, intacto), não por tinta. Então o pad deixou de ser pintado e
// virou uma CLAREIRA: a mesma mata, um pouco mais seca, entrando por rampa
// suave. Quando o mint existir e a construção for real, aí sim ela pede
// superfície própria, e o gancho é este comentário.
const C_CLAREIRA = new THREE.Color('#7E8A6B')  // = COR_TERRA de lago.ts (mato seco)
const C_TRILHA = new THREE.Color('#8E856F')  // a trilha é areia batida
// ⚠️ O FUNDO SUBMERSO DEIXOU DE SER AZUL. Ele era `#2E4A57` de quando a água era
// opaca e nada submerso aparecia; com o halo de raso ligado, os primeiros metros
// de banco ficam VISÍVEIS através da lâmina, e quem tem de pintá-los de azul é a
// água, não a areia. Areia molhada é areia escura.
const C_FUNDO = new THREE.Color('#6A6354')

/** ⚠️ 0,95 É 44 GRAUS, E O NÚMERO ANTERIOR ERA 0,62, QUE É 32. 32 graus é a
 *  encosta normal do flanco de um domo, não um paredão: com 0,62 nascia
 *  afloramento na barriga de todo morro, e na chapa isso lia como caroço marrom
 *  solto no meio do verde. Rocha exposta é onde a terra não para. */
const ROCHA_DECL = 0.95

// ⚠️ A MATA VARIA EM MANCHA, E ISSO É UM RUÍDO DE MUNDO, NÃO POR ILHA. Se cada
// ilha tivesse a sua semente, duas ilhas vizinhas teriam capoeiras de padrões
// diferentes e o olho leria isso como material diferente. Uma função só, em
// coordenada de mundo, é o que faz o arquipélago inteiro parecer a mesma mata.
const manchaMata = fazFbm2(90210, 3)

/** ⚠️ A MÉDIA DESTA FUNÇÃO É `C_MATO` DE PROPÓSITO: a mancha varia para os dois
 *  lados em torno da cor MEDIDA do tecido do mapa, então ela acrescenta variação
 *  sem deslocar o tom. `alto` escurece com a cota, que é o que a versão anterior
 *  fazia sozinha e por isso saturava numa ilha baixa. */
const _mata = new THREE.Color()
function mataEm(mancha: number, alto: number): THREE.Color {
  const m = suave(mancha)
  if (m < 0.5) _mata.copy(C_MATO_S).lerp(C_MATO, m * 2)
  else _mata.copy(C_MATO).lerp(C_MATO_E, (m - 0.5) * 2)
  return _mata.lerp(C_MATO_E, Math.min(1, Math.max(0, alto)) * 0.5)
}

/** metros de mundo por unidade do UV da malha (o `tbn` do splat sai daqui) */
const UV_METROS = 9

// ── a praia, com as constantes da margem da baía ────────────────────────────
/** a subida que a areia acompanha, em metros. `lagos.ts`, mesmo número. */
const PRAIA_SUBIDA = 1.5
/** teto de largura: acima disso não é praia, é planície molhada. Idem. */
const PRAIA_MAX = 18.0

export type TipoIlha = 'angra' | 'banco' | 'atol'

/** um pad de mansão, MEDIDO no campo de altura (não mais escrito à mão) */
export interface Patamar { x: number; z: number; raio: number; cota: number }

export interface IlhaSpec {
  id: string
  nome: string
  /** o grupo do arquipélago (só leitura, para menu e relatório) */
  grupo?: string
  x: number
  z: number
  /** ⚠️ O RAIO DO DISCO DE MESMA ÁREA, e ele é HONRADO POR CALIBRAÇÃO. O campo de
   *  altura não tem raio; o que existe é uma cota de corte. `campoIlha` procura,
   *  por bisseção, a cota cuja área emersa é π·raio². Sem isso a mesma
   *  `raio: 600` daria ilhas de 120 a 260 ha conforme a semente. */
  raio: number
  /** altura do ponto mais alto acima da lâmina */
  cume: number
  tipo: TipoIlha
  semente: number
  /** alongamento do eixo maior (1 = redonda) */
  alonga: number
  /** giro do eixo maior, em graus */
  giro: number
  /** quantos domos formam a massa. Padrão por tipo. ⚠️ UM SÓ NÃO SERVE: é o
   *  descentramento entre dois ou mais que produz península e enseada. */
  nucleos?: number
  /** amplitude do fbm 2D como fração do cume. Padrão por tipo. */
  rugosidade?: number
  dono?: string
}

export interface Ilhas { group: THREE.Group; postas: number; triangulos: number; dispose: () => void }

// ═══════════════════════════════════════════════════════════════════════════
// O RUÍDO
// ═══════════════════════════════════════════════════════════════════════════

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** ⚠️ RUÍDO DETERMINÍSTICO: `Math.random()` mudaria a ilha a cada recarga. */
function ruido2(semente: number) {
  const h = (i: number, j: number) => hash2(i * 3 + semente, j * 7 + semente * 13) * 2 - 1
  return (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y)
    const u = x - i, v = y - j
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v)
    return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv)
         + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv
  }
}

/** fbm em DUAS dimensões: é ele que deforma a costa sem passar pelo rumo, e por
 *  isso pode abrir lagoa, gancho e ilhota, coisa que `r(a)` nunca pôde. */
function fazFbm2(semente: number, oitavas = 4, ganho = 0.55) {
  const n: ((x: number, y: number) => number)[] = []
  for (let o = 0; o < oitavas; o++) n.push(ruido2(semente + o * 977))
  return (x: number, y: number) => {
    let s = 0, amp = 1, f = 1, norm = 0
    for (let o = 0; o < oitavas; o++) {
      s += amp * n[o](x * f, y * f); norm += amp; amp *= ganho; f *= 2
    }
    return s / norm
  }
}

const suave = (k: number) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c) }

// ═══════════════════════════════════════════════════════════════════════════
// O CAMPO DE ALTURA
//
// ⚠️ FUNÇÃO PURA, SEM THREE, DE PROPÓSITO: é o que permite medir a ilha inteira
// (área, contorno, se ela cai na água da baía) fora do navegador, e foi assim que
// as posições desta tabela foram conferidas.
// ═══════════════════════════════════════════════════════════════════════════

export interface CampoIlha {
  /** meia-largura da caixa local, no eixo maior e no menor */
  Lx: number
  Lz: number
  /** altura em metros acima da lâmina, no quadro LOCAL (antes do giro) */
  alt: (sx: number, sz: number) => number
}

export function campoIlha(spec: IlhaSpec): CampoIlha {
  const sem = spec.semente
  const h = (k: number) => hash2(k * 131 + sem, k * 977 + sem * 31)
  const nuc = spec.nucleos ?? (spec.tipo === 'angra' ? 3 : spec.tipo === 'banco' ? 2 : 1)
  const rug = spec.rugosidade ?? (spec.tipo === 'angra' ? 0.42 : spec.tipo === 'banco' ? 0.32 : 0.16)
  const fbm = fazFbm2(sem * 17 + 5, 3)
  // ⚠️ A ESCALA DO FBM É FRAÇÃO DO RAIO, não metros fixos. Com metros fixos o
  // cayo de 105 m sairia liso e a ilha de 672 m sairia rendada: o mesmo ruído lê
  // como coisas diferentes em escalas diferentes.
  // ⚠️ E 0,90 COM TRÊS OITAVAS, NÃO 0,62 COM QUATRO. Medido na primeira versão do
  // campo: com a oitava fina em 52 m as 25 ilhas viravam 88 CORPOS DE TERRA, ou
  // seja confete, e a orla saltava para 21 km por km², que é número de lixo, não
  // de litoral. Com a oitava fina em 150 m o ruído deforma península em vez de
  // picar a ilha.
  const Lf = spec.raio * 0.90

  // ── os domos ──────────────────────────────────────────────────────────────
  // ⚠️ DESCENTRADOS, E O DESCENTRAMENTO É O ASSUNTO. Domos concêntricos dão a
  // mesma bolha de sempre; domos deslocados que se encostam pela SAIA produzem
  // istmo, península e enseada que abraça, e domos que não se encostam produzem
  // ilhota irmã. Nenhum caso precisa de código próprio.
  const domos: { cx: number; cz: number; r: number; a: number }[] = []
  if (spec.tipo === 'atol') {
    // o atol é um caso à parte: anel, não domo. A lagoa é o que sobra no meio.
    domos.push({ cx: 0, cz: 0, r: 0, a: 0 })
  } else {
    for (let i = 0; i < nuc; i++) {
      const ang = (i / nuc) * Math.PI * 2 + (h(i) - 0.5) * 1.6
      const dd = spec.raio * (0.30 + 0.48 * h(i + 10))
      domos.push({
        cx: Math.cos(ang) * dd,
        cz: Math.sin(ang) * dd,
        r: spec.raio * (0.58 + 0.34 * h(i + 20)),
        a: spec.cume * (0.52 + 0.48 * h(i + 30)),
      })
    }
  }

  /** a massa antes do corte, em metros */
  const massa = (u: number, v: number): number => {
    let m = 0
    if (spec.tipo === 'atol') {
      // ⚠️ ANEL GAUSSIANO. A lagoa não é escavada: ela é o miolo que o anel não
      // levantou, e por isso fica abaixo do corte e vira água sozinha.
      const d = Math.hypot(u, v)
      const r0 = spec.raio * 0.80, w = spec.raio * 0.30
      m = spec.cume * Math.exp(-Math.pow((d - r0) / w, 2)) * 1.45
    } else {
      // ⚠️ SOMA, NÃO MÁXIMO. Com `max` os domos se encostam por uma aresta viva e
      // o vale entre eles fica com quina; somando, a saia de um levanta a do
      // outro e nasce o istmo suave que faz a península ler.
      for (const d of domos) {
        const q = Math.hypot(u - d.cx, v - d.cz) / d.r
        if (q >= 1) continue
        m += d.a * 0.5 * (1 + Math.cos(Math.PI * q))
      }
    }
    // ⚠️ O RUÍDO É JANELADO PELA PRÓPRIA MASSA, e sem isso ele CRIA TERRA no mar
    // aberto: uma crista de ruído longe de qualquer domo cruza o corte e vira
    // ilhota fantasma. Foram 88 corpos vindos de 25 ilhas na primeira medição.
    // Com a janela, o ruído só existe onde já há massa: ele deforma a costa,
    // abre enseada e destaca ponta, mas não inventa arquipélago onde não há.
    const jan = suave(m / (0.10 * spec.cume))
    return m + fbm(u / Lf, v / Lf) * spec.cume * rug * jan
  }

  // ── a calibração do corte ─────────────────────────────────────────────────
  // ⚠️ BISSEÇÃO SOBRE A ÁREA EMERSA, medida numa grade grossa. 18 passadas numa
  // grade de 96x96 custam 166 mil avaliações por ilha, uma vez, no build.
  const Lx0 = spec.raio * 1.55 * spec.alonga
  const Lz0 = spec.raio * 1.55
  const alvo = Math.PI * spec.raio * spec.raio
  const G = 96
  const amostra: number[] = []
  const cel = ((2 * Lx0) / G) * ((2 * Lz0) / G) / spec.alonga
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const u = (-Lx0 + ((i + 0.5) / G) * 2 * Lx0) / spec.alonga
      const v = -Lz0 + ((j + 0.5) / G) * 2 * Lz0
      amostra.push(massa(u, v))
    }
  }
  let lo = 0, hi = spec.cume * 1.4
  for (let it = 0; it < 24; it++) {
    const mid = (lo + hi) / 2
    let n = 0
    for (const a of amostra) if (a > mid) n++
    if (n * cel > alvo) lo = mid; else hi = mid
  }
  const corte = (lo + hi) / 2

  const alt = (sx: number, sz: number) => massa(sx / spec.alonga, sz) - corte
  return { Lx: Lx0, Lz: Lz0, alt }
}

/** ⚠️ O MERGULHO. Abaixo da lâmina o campo continuaria plano em `-corte`, e um
 *  fundo plano encostando na praia é justamente o degrau que a versão anterior
 *  levou duas rodadas para tirar. Aqui a queda é suave nos primeiros metros (o
 *  banco raso, que agora APARECE por baixo da água translúcida) e acelera depois. */
function mergulho(h: number): number {
  const t = -h
  return -Math.min(80, t * 1.15 + t * t * 0.055)
}

// ⚠️ AS COORDENADAS SÃO MEDIDAS, NÃO ESCOLHIDAS. Cada ilha foi posta rodando o
// MESMO preenchimento por cota que `lagos.ts` roda, sobre o mesmo heightmap
// (`public/lunar/btc-core-heightmap.f32`), na cota -40, e depois exigindo que
// todo o contorno dela caia em água com folga até a terra firme.
//
// ⚠️ E A MÁSCARA USADA É A INTERSEÇÃO DE DUAS, não a do gerador sozinha. O
// gerador (`scripts/gerar_cidade.py`) mede o relevo CRU, sem exagero vertical e
// sem o pódio da abóbada; a cena mede `terrain.superficieAt`, que tem os dois.
// Medido: só 80,7% da baía do gerador também é água na cena.
//
// OS GRUPOS, e cada um existe por uma razão de leitura:
//   angra-fundador  o miolo velho da baía. Morro arredondado, enseada funda.
//   cayos-norte     BAHAMAS: cayos baixos e COMPRIDOS (alonga 1,9 a 2,6) no raso
//                   do noroeste. Cume de 8 a 16 m: quase tudo ali é praia.
//   atois           MALDIVAS: atóis com lagoa. Um núcleo só, em anel.
//   angra-leste     os morros do arco leste, o grupo com mais silhueta.
//   cayos-sul       peças soltas fechando o arco sul, para o arquipélago dar a
//                   volta em vez de virar um bolo num canto.
//
// ⚠️ E O VAZIO É PARTE DO DESENHO. O miolo fundo da baía ficou SEM ilha nenhuma.
// Arquipélago sem água aberta não lê como arquipélago, lê como pântano.
export const ILHAS: readonly IlhaSpec[] = [
  { id: 'IL01', nome: 'Ilha do Fundador', grupo: 'angra-fundador', x: 3509, z: -4308,
    raio: 672, cume: 86, tipo: 'angra', semente: 7, alonga: 1.35, giro: 240, dono: 'fundador' },
  { id: 'IL02', nome: 'Ilha Norte', grupo: 'angra-fundador', x: 4875, z: -3316,
    raio: 482, cume: 58, tipo: 'angra', semente: 13, alonga: 1.18, giro: 90 },
  { id: 'IL04', nome: 'Ilha Leste', grupo: 'angra-fundador', x: 5669, z: -2201,
    raio: 258, cume: 32, tipo: 'angra', semente: 19, alonga: 1.45, giro: 330 },
  { id: 'IL05', nome: 'Atol da Baía', grupo: 'angra-fundador', x: 5813, z: -5376,
    raio: 168, cume: 9, tipo: 'atol', semente: 25, alonga: 1.2, giro: 300 },
  { id: 'IL10', nome: 'Cayo Maior', grupo: 'cayos-norte', x: 1591, z: -8063,
    raio: 291, cume: 14, tipo: 'banco', semente: 31, alonga: 2.1, giro: 150 },
  { id: 'IL11', nome: 'Cayo do Vento', grupo: 'cayos-norte', x: 2581, z: -7918,
    raio: 224, cume: 11, tipo: 'banco', semente: 37, alonga: 2.3, giro: 150 },
  { id: 'IL12', nome: 'Cayo Longo', grupo: 'cayos-norte', x: 390, z: -8092,
    raio: 196, cume: 9, tipo: 'banco', semente: 43, alonga: 2.6, giro: 150 },
  { id: 'IL13', nome: 'Cayo do Meio', grupo: 'cayos-norte', x: 3008, z: -7249,
    raio: 168, cume: 9, tipo: 'banco', semente: 49, alonga: 2, giro: 330 },
  { id: 'IL14', nome: 'Cayo Menor', grupo: 'cayos-norte', x: 671, z: -8592,
    raio: 134, cume: 8, tipo: 'banco', semente: 55, alonga: 1.9, giro: 180 },
  { id: 'IL15', nome: 'Cayo do Fim', grupo: 'cayos-norte', x: 1445, z: -8644,
    raio: 118, cume: 8, tipo: 'banco', semente: 61, alonga: 2.2, giro: 0 },
  { id: 'IL20', nome: 'Atol Grande', grupo: 'atois', x: 3808, z: -7082,
    raio: 213, cume: 11, tipo: 'atol', semente: 67, alonga: 1.25, giro: 120 },
  { id: 'IL21', nome: 'Atol da Lagoa', grupo: 'atois', x: 4432, z: -7073,
    raio: 168, cume: 9, tipo: 'atol', semente: 73, alonga: 1.35, giro: 120 },
  { id: 'IL22', nome: 'Atol Gêmeo', grupo: 'atois', x: 3527, z: -7654,
    raio: 140, cume: 9, tipo: 'atol', semente: 79, alonga: 1.2, giro: 150 },
  { id: 'IL23', nome: 'Atol do Canal', grupo: 'atois', x: 4282, z: -6593,
    raio: 123, cume: 8, tipo: 'atol', semente: 85, alonga: 1.4, giro: 150 },
  { id: 'IL24', nome: 'Atol Pequeno', grupo: 'atois', x: 4892, z: -6872,
    raio: 106, cume: 8, tipo: 'atol', semente: 91, alonga: 1.15, giro: 120 },
  { id: 'IL30', nome: 'Ilha dos Morros', grupo: 'angra-leste', x: 6645, z: -4684,
    raio: 426, cume: 48, tipo: 'angra', semente: 97, alonga: 1.4, giro: 300 },
  { id: 'IL31', nome: 'Ilha da Enseada', grupo: 'angra-leste', x: 7530, z: -2999,
    raio: 336, cume: 38, tipo: 'angra', semente: 103, alonga: 1.3, giro: 0 },
  { id: 'IL32', nome: 'Ilha do Costão', grupo: 'angra-leste', x: 7849, z: -2253,
    raio: 274, cume: 30, tipo: 'angra', semente: 109, alonga: 1.5, giro: 180 },
  { id: 'IL33', nome: 'Ilha da Ferradura', grupo: 'angra-leste', x: 7421, z: -3838,
    raio: 224, cume: 24, tipo: 'angra', semente: 115, alonga: 1.35, giro: 120 },
  { id: 'IL34', nome: 'Ilha do Farol', grupo: 'angra-leste', x: 7785, z: -1559,
    raio: 179, cume: 20, tipo: 'angra', semente: 121, alonga: 1.25, giro: 30 },
  { id: 'IL35', nome: 'Ilha Rasa', grupo: 'angra-leste', x: 6832, z: -3713,
    raio: 146, cume: 11, tipo: 'banco', semente: 127, alonga: 1.8, giro: 300 },
  { id: 'IL40', nome: 'Ilha do Sul', grupo: 'cayos-sul', x: 7852, z: 2566,
    raio: 325, cume: 34, tipo: 'angra', semente: 133, alonga: 1.45, giro: 270 },
  { id: 'IL41', nome: 'Cayo do Sul', grupo: 'cayos-sul', x: 7962, z: -86,
    raio: 213, cume: 10, tipo: 'banco', semente: 139, alonga: 2.2, giro: 90 },
  { id: 'IL42', nome: 'Atol do Sul', grupo: 'cayos-sul', x: 7930, z: 853,
    raio: 151, cume: 9, tipo: 'atol', semente: 145, alonga: 1.3, giro: 90 },
  { id: 'IL43', nome: 'Cayo da Ponta', grupo: 'cayos-sul', x: 7946, z: -1109,
    raio: 123, cume: 8, tipo: 'banco', semente: 151, alonga: 2, giro: 180 },
]

// ═══════════════════════════════════════════════════════════════════════════
// A MALHA
// ═══════════════════════════════════════════════════════════════════════════

/** ⚠️ A RESOLUÇÃO É ORÇAMENTO DE CÉLULAS, NÃO CÉLULA MÍNIMA, e a diferença foi
 *  medida. Com `cell = max(5, raio/44)` o piso de 5 m mandava em TODAS as ilhas
 *  pequenas: 25 ilhas custavam 1.065.220 triângulos, três vezes e meia o teto.
 *  Aqui cada ilha ganha um número de células proporcional ao raio e a célula sai
 *  disso, então a conta é previsível por construção.
 *
 *  ⚠️ E A CÉLULA É O QUE DECIDE O DENTE DE SERRA NA LINHA D'ÁGUA. A costa não é
 *  desenhada, é o cruzamento do campo com o zero, interpolado dentro da célula:
 *  o serrilhado que a chapa mostrou nas pontas dos braços tinha exatamente o
 *  tamanho da célula. */
function celulasDe(raio: number) { return Math.max(4200, Math.min(26000, Math.round(raio * 22))) }

interface Grade { NI: number; NJ: number; cell: number; Lx: number; Lz: number; H: Float32Array }

function grade(spec: IlhaSpec): Grade {
  const c = campoIlha(spec)
  const cell = Math.sqrt((2 * c.Lx * 2 * c.Lz) / celulasDe(spec.raio))
  const NI = Math.round((2 * c.Lx) / cell) + 1
  const NJ = Math.round((2 * c.Lz) / cell) + 1
  const H = new Float32Array(NI * NJ)
  for (let j = 0; j < NJ; j++) {
    const sz = -c.Lz + j * cell
    for (let i = 0; i < NI; i++) H[j * NI + i] = c.alt(-c.Lx + i * cell, sz)
  }
  return { NI, NJ, cell, Lx: c.Lx, Lz: c.Lz, H }
}

/** distância de cada célula de terra até a costa, em metros (chanfro 2 passadas) */
function distCosta(g: Grade): Float32Array {
  const { NI, NJ, H } = g
  const D = new Float32Array(NI * NJ)
  const INF = 1e9
  for (let k = 0; k < D.length; k++) D[k] = H[k] > 0 ? INF : 0
  const d1 = g.cell, d2 = g.cell * 1.41421356
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const k = j * NI + i; if (D[k] === 0) continue
    let m = D[k]
    if (i > 0) m = Math.min(m, D[k - 1] + d1)
    if (j > 0) m = Math.min(m, D[k - NI] + d1)
    if (i > 0 && j > 0) m = Math.min(m, D[k - NI - 1] + d2)
    if (i < NI - 1 && j > 0) m = Math.min(m, D[k - NI + 1] + d2)
    D[k] = m
  }
  for (let j = NJ - 1; j >= 0; j--) for (let i = NI - 1; i >= 0; i--) {
    const k = j * NI + i; if (D[k] === 0) continue
    let m = D[k]
    if (i < NI - 1) m = Math.min(m, D[k + 1] + d1)
    if (j < NJ - 1) m = Math.min(m, D[k + NI] + d1)
    if (i < NI - 1 && j < NJ - 1) m = Math.min(m, D[k + NI + 1] + d2)
    if (i > 0 && j < NJ - 1) m = Math.min(m, D[k + NI - 1] + d2)
    D[k] = m
  }
  return D
}

/** ⚠️ OS DOIS PADS SÃO MEDIDOS, e o critério é a distância à costa: o lugar mais
 *  longe da água é o lugar mais LARGO, que é onde uma mansão cabe. O critério
 *  antigo (a ponta do braço) pegava justamente o ponto mais estreito da ilha. */
function acharPatamares(g: Grade, D: Float32Array, spec: IlhaSpec): Patamar[] {
  const { NI, NJ, H, cell } = g
  const cand: { x: number; z: number; d: number; h: number }[] = []
  for (let j = 1; j < NJ - 1; j++) for (let i = 1; i < NI - 1; i++) {
    const k = j * NI + i
    if (D[k] < cell * 1.5) continue
    cand.push({ x: -g.Lx + i * cell, z: -g.Lz + j * cell, d: D[k], h: H[k] })
  }
  cand.sort((a, b) => b.d - a.d)
  const esc: Patamar[] = []
  for (const c of cand) {
    if (esc.length >= 2) break
    // ⚠️ SEPARADOS, senão os dois pads caem no mesmo morro e viram um só.
    if (esc.some((e) => Math.hypot(e.x - c.x, e.z - c.z) < (e.raio + c.d) * 1.6)) continue
    // ⚠️ O PAD TEM TETO EM METROS, E ELE É NOVO. Com `raio * 0,20` a Ilha do
    // Fundador ganhava um pad de 134 m de raio, ou seja 268 m de ponta a ponta:
    // um TERÇO da ilha. Na chapa isso não lia como plataforma de mansão, lia como
    // calvície. Uma mansão de magnata com jardim cabe em 90 m de frente, então o
    // teto é 46 m de raio; a fração do raio e a folga continuam mandando nas
    // ilhas pequenas, onde 46 m não caberia.
    const r = Math.max(16, Math.min(46, spec.raio * 0.12, c.d * 0.45))
    esc.push({ x: c.x, z: c.z, raio: r, cota: c.h })
  }
  return esc
}

function distSegLocal(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az
  const ll = dx * dx + dz * dz
  let t = ll > 0 ? ((px - ax) * dx + (pz - az) * dz) / ll : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return { d: Math.hypot(ax + dx * t - px, az + dz * t - pz), t }
}

/** marching squares no nível zero: a costa. ⚠️ MESMA MÁQUINA QUE `lagos.ts` USA
 *  para achar a água, e pelo mesmo motivo: emitir a célula inteira dá degrau do
 *  tamanho da grade; o corte interpolado cai onde o campo cruza de verdade. */
function contorno(g: Grade): number[][] {
  const { NI, NJ, H, cell } = g
  const X = (i: number) => -g.Lx + i * cell
  const Z = (j: number) => -g.Lz + j * cell
  const segs: number[] = []
  const lerp = (a: number, b: number) => a / (a - b)
  for (let j = 0; j < NJ - 1; j++) {
    for (let i = 0; i < NI - 1; i++) {
      const a = H[j * NI + i], b = H[j * NI + i + 1]
      const c = H[(j + 1) * NI + i + 1], d = H[(j + 1) * NI + i]
      const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0)
      if (code === 0 || code === 15) continue
      const P: number[] = []
      if ((a > 0) !== (b > 0)) P.push(X(i) + cell * lerp(a, b), Z(j))
      if ((b > 0) !== (c > 0)) P.push(X(i + 1), Z(j) + cell * lerp(b, c))
      if ((c > 0) !== (d > 0)) P.push(X(i) + cell * lerp(d, c), Z(j + 1))
      if ((d > 0) !== (a > 0)) P.push(X(i), Z(j) + cell * lerp(a, d))
      for (let k = 0; k + 3 < P.length; k += 4) segs.push(P[k], P[k + 1], P[k + 2], P[k + 3])
    }
  }
  const out: number[][] = []
  for (let s = 0; s < segs.length; s += 4) out.push([segs[s], segs[s + 1], segs[s + 2], segs[s + 3]])
  return out
}

/** a costa de todas as ilhas, em COORDENADA DE MUNDO, para `lago.ts` usar como
 *  margem da lâmina. Memoizada: o campo é caro e a resposta não muda. */
let _contornos: number[] | null = null
export function contornosIlhas(): number[] {
  if (_contornos) return _contornos
  const out: number[] = []
  // ⚠️ ILHA DESLIGADA NÃO TEM COSTA. `plaza-scene` só monta o grupo com
  // `?ilhas=1`; sem esta guarda, `lago.ts` pediria o campo de altura de 25 ilhas
  // que ninguém vai desenhar, e ainda abriria um halo de raso em volta de nada.
  if (typeof window === 'undefined'
      || new URLSearchParams(window.location.search).get('ilhas') !== '1') {
    _contornos = out
    return out
  }
  for (const il of ILHAS) {
    const g = grade(il)
    const g0 = (il.giro * Math.PI) / 180
    const cg = Math.cos(g0), sg = Math.sin(g0)
    for (const s of contorno(g)) {
      out.push(il.x + s[0] * cg + s[1] * sg, il.z - s[0] * sg + s[1] * cg,
               il.x + s[2] * cg + s[3] * sg, il.z - s[2] * sg + s[3] * cg)
    }
  }
  _contornos = out
  return out
}

function geoIlha(spec: IlhaSpec, cota: number): THREE.BufferGeometry {
  const g = grade(spec)
  const { NI, NJ, cell, H } = g
  const D = distCosta(g)
  const pats = acharPatamares(g, D, spec)

  // ── terraplenagem: os dois pads e a trilha, escritos NO CAMPO ─────────────
  // ⚠️ A TRILHA É ESCAVADA, NÃO PINTADA: caminho que só muda de cor num morro
  // continua sendo morro.
  let praiaPt: { x: number; z: number } | null = null
  if (pats.length === 2) {
    // o pé da trilha: o ponto de costa mais perto do pad baixo
    const baixo = pats[0].cota <= pats[1].cota ? pats[0] : pats[1]
    let melhor = Infinity
    for (const s of contorno(g)) {
      const d = Math.hypot(s[0] - baixo.x, s[1] - baixo.z)
      if (d < melhor) { melhor = d; praiaPt = { x: s[0], z: s[1] } }
    }
  }
  const pernas: { ax: number; az: number; bx: number; bz: number; ha: number; hb: number }[] = []
  if (pats.length === 2) {
    pernas.push({ ax: pats[0].x, az: pats[0].z, bx: pats[1].x, bz: pats[1].z,
                  ha: pats[0].cota, hb: pats[1].cota })
    if (praiaPt) {
      const baixo = pats[0].cota <= pats[1].cota ? pats[0] : pats[1]
      pernas.push({ ax: baixo.x, az: baixo.z, bx: praiaPt.x, bz: praiaPt.z,
                    ha: baixo.cota, hb: 0.4 })
    }
  }
  const TRILHA_L = 9
  for (let j = 0; j < NJ; j++) {
    for (let i = 0; i < NI; i++) {
      const k = j * NI + i
      if (H[k] <= 0) continue
      const x = -g.Lx + i * cell, z = -g.Lz + j * cell
      for (const p of pats) {
        const dp = Math.hypot(x - p.x, z - p.z)
        const fora = p.raio * 1.75
        if (dp >= fora) continue
        const s = suave(dp <= p.raio ? 1 : 1 - (dp - p.raio) / (fora - p.raio))
        H[k] = H[k] * (1 - s) + p.cota * s
      }
      for (const p of pernas) {
        const q = distSegLocal(x, z, p.ax, p.az, p.bx, p.bz)
        if (q.d >= TRILHA_L) continue
        const s = suave(1 - q.d / TRILHA_L) * 0.78
        H[k] = H[k] * (1 - s) + (p.ha + (p.hb - p.ha) * q.t) * s
      }
    }
  }

  // ── vértices ──────────────────────────────────────────────────────────────
  const g0 = (spec.giro * Math.PI) / 180
  const cg = Math.cos(g0), sg = Math.sin(g0)
  const pos: number[] = [], cor: number[] = [], uso: number[] = [], uv: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()
  const rnFino = ruido2(spec.semente * 31 + 7)
  // ⚠️ A FAIXA DE MISTURA ENTRE AREIA E MATA ACOMPANHA O RELEVO DA ILHA, e este
  // era o verdadeiro motivo de a ilha ler branca. Ela estava fixa em 6 m: numa
  // ilha de 86 m de cume isso é uma orla; num cayo de 9 m de cume é a ilha
  // INTEIRA em meio-tom de areia. Medido: 42,5% dos vértices emersos carregavam
  // peso de areia. Com a faixa proporcional ao cume, o cayo mistura em 2 m.
  const mistura = Math.max(1.5, Math.min(9, spec.cume * 0.10))
  const HP = (i: number, j: number) => H[Math.min(NJ - 1, Math.max(0, j)) * NI + Math.min(NI - 1, Math.max(0, i))]
  // ⚠️ MAPA DE ÍNDICE, porque a malha é RECORTADA: o quad fundo demais não entra,
  // e emitir todo vértice mesmo assim deixaria milhares de órfãos no buffer.
  const map = new Int32Array(NI * NJ).fill(-1)
  const CORTE_FUNDO = -22
  const usar = (i: number, j: number) => {
    const k = j * NI + i
    if (map[k] >= 0) return map[k]
    const sx = -g.Lx + i * cell, sz = -g.Lz + j * cell
    const h = H[k]
    const y = h > 0 ? h : mergulho(h)
    const wx = sx * cg + sz * sg, wz = -sx * sg + sz * cg
    map[k] = pos.length / 3
    pos.push(wx, y + cota, wz)
    uv.push(wx / UV_METROS, wz / UV_METROS)
    // a inclinação medida no campo, adimensional
    const decl = Math.hypot((HP(i + 1, j) - HP(i - 1, j)) / (2 * cell),
                            (HP(i, j + 1) - HP(i, j - 1)) / (2 * cell))
    // ⚠️ A PRAIA É A REGRA DA MARGEM DA BAÍA, TRANSPOSTA. Lá a largura da areia é
    // `min(PRAIA_MAX, PRAIA_SUBIDA / declive)`; aqui a mesma largura vira uma
    // BANDA DE COTA multiplicando pelo declive, ou seja
    // `min(PRAIA_MAX·decl, PRAIA_SUBIDA)`. Encosta rasa: banda finíssima mas
    // dezenas de metros de largura. Costão: banda de 1,5 m e três metros de
    // largura, ou seja praia nenhuma. É isto que tira o plástico branco.
    // ⚠️ E A PRAIA É LIMITADA POR LARGURA, NÃO SÓ POR COTA, e sem isto ela ainda
    // inundava. Medido depois da primeira versão do campo: 59% dos vértices
    // emersos saíam areia. A causa é que `lagos.ts` aplica a regra como LARGURA
    // ao longo da margem, com teto de 18 m, e eu a transpus para uma BANDA DE
    // COTA: numa ilha genuinamente plana, como um cayo de 9 m de cume, "tudo
    // abaixo de 1,5 m" é quase a ilha inteira. Aqui entram as duas, e a que
    // manda é a largura, que é a formulação original: `D` é a distância medida
    // até a costa e já existe para achar os patamares.
    const largura = Math.min(PRAIA_MAX, decl < 1e-3 ? PRAIA_MAX : PRAIA_SUBIDA / decl)
    const naPraia = D[k] < largura && h < PRAIA_SUBIDA * 2
    const hPraia = Math.min(PRAIA_MAX * decl, PRAIA_SUBIDA)
    // ⚠️ O PATAMAR ENTRA POR RAMPA, NÃO POR LIMIAR, e a borda em degraus da chapa
    // era exatamente isto: `dp < raio * 1,05` é um teste booleano por vértice, ou
    // seja a fronteira de cor caía na GRADE e desenhava a escada. A rampa espalha
    // a transição por metros e a grade some dentro dela.
    let clareira = 0
    for (const p of pats) {
      const dp = Math.hypot(sx - p.x, sz - p.z)
      if (dp < p.raio * 1.35) clareira = Math.max(clareira, suave(1 - dp / (p.raio * 1.35)))
    }
    const naTrilha = pernas.some((p) => distSegLocal(sx, sz, p.ax, p.az, p.bx, p.bz).d < 7)
    // ⚠️ A MATA EM MANCHAS, e a falta disto foi a queixa "verde chapado". A versão
    // de contorno tinha gradação por cota, que numa ilha baixa satura logo e vira
    // campo liso: medido, num cayo de 9 m de cume a rampa inteira cabe em 0,9 m de
    // altura, então 100% da mata saía na mesma tinta. Mata de verdade varia em
    // MANCHA, não em faixa. Aqui a variação vem de um fbm em coordenada de mundo
    // com escala de dezenas de metros, que é o tamanho de uma capoeira.
    const mancha = manchaMata(wx / 62, wz / 62) * 0.5 + 0.5
    let ua = 0, ub = 0, uc = 0                     // areia, mata, rocha
    // ⚠️ A COR E O USO DO SOLO SAEM DO MESMO RAMO. São duas descrições da MESMA
    // classificação e, escritas em dois lugares, divergem em silêncio.
    if (h > 0.6 && naTrilha) { c.copy(C_TRILHA); ua = 1 }
    else if (h <= 0) { c.copy(C_FUNDO); ua = 1 }
    else if (naPraia) { c.copy(C_AREIA); ua = 1 }
    else if (h < hPraia + mistura) {
      const t = Math.min(1, Math.max(0, (h - hPraia) / mistura))
      c.copy(C_AREIA).lerp(mataEm(mancha, 0), t); ua = 1 - t; ub = t
    } else if (decl > ROCHA_DECL || h > spec.cume * 0.84) {
      // ⚠️ O COSTÃO É INCLINAÇÃO, NÃO ALTURA. Rocha aparece onde a encosta é
      // íngreme demais para segurar terra, e isso acontece a 8 m de cota tanto
      // quanto a 80. Amarrar rocha só à cota dava a faixa horizontal de sempre.
      //
      // ⚠️ MAS O LIMIAR ERA 0,62 E ISSO ESTAVA ERRADO: 0,62 é 32 graus, que é a
      // encosta NORMAL do flanco de um domo, não um paredão. O resultado eram as
      // bossas marrons no meio da ilha que a chapa mostrou, afloramento nascendo
      // onde só havia barriga de morro. 0,95 é 44 graus, aí sim é face de rocha.
      const t = suave(Math.max((decl - ROCHA_DECL) / 0.55,
                               (h - spec.cume * 0.84) / (spec.cume * 0.16)))
      c.copy(mataEm(mancha, 1)).lerp(C_ROCHA, t); ub = 1 - t; uc = t
    } else {
      const t = Math.min(1, (h - hPraia - mistura) / Math.max(1, spec.cume * 0.55))
      c.copy(mataEm(mancha, t)); ub = 1
    }
    if (clareira > 0 && h > 0.6) c.lerp(C_CLAREIRA, clareira * 0.42)
    const kk = 0.95 + 0.10 * (rnFino(wx / 30, wz / 30) * 0.5 + 0.5)
    cor.push(c.r * kk, c.g * kk, c.b * kk)
    uso.push(ua, ub, uc)
    return map[k]
  }

  for (let j = 0; j < NJ - 1; j++) {
    for (let i = 0; i < NI - 1; i++) {
      const a = H[j * NI + i], b = H[j * NI + i + 1]
      const d = H[(j + 1) * NI + i], e = H[(j + 1) * NI + i + 1]
      // ⚠️ O RECORTE É O ORÇAMENTO. A caixa da ilha tem 1,55 raios de meia-largura
      // e só cerca de um terço dela é terra; sem descartar o quad fundo demais, a
      // conta triplica para desenhar fundo de mar que a água esconde.
      if (a < CORTE_FUNDO && b < CORTE_FUNDO && d < CORTE_FUNDO && e < CORTE_FUNDO) continue
      const v00 = usar(i, j), v10 = usar(i + 1, j), v01 = usar(i, j + 1), v11 = usar(i + 1, j + 1)
      // ⚠️ ORIENTAÇÃO: +X x +Z dá -Y. Esta armadilha mordeu cinco vezes nesta cena.
      idx.push(v00, v11, v10, v00, v01, v11)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
  geo.setAttribute('aUso', new THREE.Float32BufferAttribute(uso, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// ═══════════════════════════════════════════════════════════════════════════
// O SOLO: SPLAT POR USO DO SOLO, num material só
//
// ⚠️ O PROBLEMA QUE ISTO RESOLVE, nas palavras do fundador em 02/09: "o solo das
// ilhas eu achei muito artificial, precisamos do mesmo tipo de solo que temos no
// resto do mapa". A ilha tinha cor por vértice e nada mais: um gradiente
// perfeitamente liso de areia a mata a rocha, que é justamente o que denuncia
// superfície falsa, porque nenhum chão real varia sem grão.
//
// ⚠️ E VESTIR TUDO COM UMA SUPERFÍCIE SÓ NÃO SERVE, pela conta que já estava
// escrita aqui: cor por vértice MULTIPLICA o mapa, então o albedo do 'campo'
// (média linear medida 0,123 0,188 0,062) pintaria de verde a praia e o patamar.
// A saída é escolher a superfície POR USO DO SOLO, dentro do mesmo material:
//
//   areia (praia)          -> 'regolito', que é grão fino sem feição nenhuma
//   mata                   -> 'campo'
//   rocha, patamar, trilha -> 'pedra'
//
// Três superfícies, não seis: o patamar pediria 'concreto', mas 'pedra' a 4 m de
// ladrilho já separa o pad do mato e economiza três amostragens.
//
// ⚠️ E CADA ALBEDO ENTRA DIVIDIDO PELA PRÓPRIA MÉDIA, o que o transforma de COR
// em DETALHE em torno de 1. É isso que deixa a cor por vértice continuar mandando
// na leitura (praia clara, mata escura, patamar claro) enquanto a textura manda
// no grão e na resposta à luz. As médias são LINEARES e foram medidas rodando as
// receitas de `materiais.ts` fora do navegador, não estimadas.
//
// ⚠️ O UV NÃO É O ATRIBUTO, É O MUNDO. Cada superfície tem o seu ladrilho em
// metros ('regolito' 40, 'campo' 7, 'pedra' 4) e por isso precisa da sua própria
// escala; o atributo `uv` da malha tem uma escala só. As três saem de `vXZ`, a
// posição de mundo no plano. O atributo `uv` CONTINUA sendo necessário, e não é
// desperdício: é dele que o three tira o `tbn` em `normal_fragment_begin`, e como
// as três UVs são múltiplos escalares da mesma projeção, o quadro tangente é o
// mesmo para as três.
//
// ⚠️ A AREIA É PEDIDA A 6 m E NÃO A 40. 'regolito' vem com ladrilho de 40 m
// porque ele veste quilômetros de mare; numa faixa de praia de poucos metros de
// largura, 40 m de ladrilho é cor chapada de novo. Reescalar é seguro AQUI e só
// aqui, porque a receita do regolito não tem feição com identidade (as crateras
// foram removidas dela em 01/09): o que sobra é grão, e grão reescala.
//
// Custo: zero chamada de desenho nova, zero material novo, UM programa (chave
// fixa), e seis amostragens de textura a mais no fragmento das ilhas.
// ═══════════════════════════════════════════════════════════════════════════

/** médias LINEARES do albedo de cada receita, medidas fora do navegador */
const MEDIA_AREIA = new THREE.Vector3(0.1811, 0.1620, 0.1384)   // 'regolito'
const MEDIA_MATA = new THREE.Vector3(0.1230, 0.1884, 0.0620)    // 'campo'
const MEDIA_ROCHA = new THREE.Vector3(0.2461, 0.2271, 0.1952)   // 'pedra'
/** metros de mundo por ladrilho de cada uma, na escala em que a ilha as usa */
// ⚠️ A MATA SUBIU DE 7 PARA 11 m DE LADRILHO E O NORMAL CAIU DE 0,85 PARA 0,55.
// A queixa da chapa foi "um trançado fino de textura que não lê como vegetação",
// e trançado é o que um ladrilho de 7 m com normal forte faz quando visto em
// ângulo raso: a grade da receita vira tecido. Ladrilho maior e relevo mais
// fraco devolvem a leitura de massa vegetal. ⚠️ NÃO MEDI ISTO NA CHAPA, é a
// mudança menos verificada desta rodada.
const M_AREIA = 6, M_MATA = 11, M_ROCHA = 4
/** escala do ruído de mundo que apaga a grade do ladrilho, em metros */
const MACRO_METROS = 120

function vestirSplat(mat: THREE.MeshStandardMaterial) {
  const areia = superficie('regolito')
  const mata = superficie('campo')
  const rocha = superficie('pedra')
  // a MATA ocupa os três canais que o three já conhece: assim `USE_MAP`,
  // `USE_NORMALMAP_TANGENTSPACE` e `USE_ROUGHNESSMAP` ficam definidos e os
  // trechos que eu substituo existem para ser substituídos.
  mat.map = mata.map
  mat.normalMap = mata.normalMap
  mat.roughnessMap = mata.roughnessMap
  mat.normalScale = new THREE.Vector2(0.55, 0.55)
  // ⚠️ `roughness` FICA EM 1: no three ele MULTIPLICA o mapa de rugosidade, e
  // 0,92 (o valor que estava aqui) apagaria 8% do que o mapa diz.
  mat.roughness = 1
  mat.metalness = 0
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAlbA = { value: areia.map }
    sh.uniforms.uNrmA = { value: areia.normalMap }
    sh.uniforms.uRugA = { value: areia.roughnessMap }
    sh.uniforms.uAlbC = { value: rocha.map }
    sh.uniforms.uNrmC = { value: rocha.normalMap }
    sh.uniforms.uRugC = { value: rocha.roughnessMap }
    sh.uniforms.uEsc = { value: new THREE.Vector3(1 / M_AREIA, 1 / M_MATA, 1 / M_ROCHA) }
    sh.uniforms.uMedA = { value: MEDIA_AREIA }
    sh.uniforms.uMedB = { value: MEDIA_MATA }
    sh.uniforms.uMedC = { value: MEDIA_ROCHA }
    sh.uniforms.uMacro = { value: 1 / MACRO_METROS }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>',
               '#include <common>\nattribute vec3 aUso;\nvarying vec3 vUso;\nvarying vec2 vXZ;')
      .replace('#include <begin_vertex>', ['#include <begin_vertex>',
               'vUso = aUso;',
               'vXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'].join('\n'))
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', ['#include <common>',
        'uniform sampler2D uAlbA; uniform sampler2D uNrmA; uniform sampler2D uRugA;',
        'uniform sampler2D uAlbC; uniform sampler2D uNrmC; uniform sampler2D uRugC;',
        'uniform vec3 uEsc; uniform vec3 uMedA; uniform vec3 uMedB; uniform vec3 uMedC;',
        'uniform float uMacro;',
        'varying vec3 vUso; varying vec2 vXZ;',
        'vec3 pesosUso(){ return vUso / max(1e-4, vUso.x + vUso.y + vUso.z); }',
        'float irand(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float inoise(vec2 p){',
        '  vec2 i = floor(p), f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(irand(i), irand(i + vec2(1.0, 0.0)), u.x),',
        '             mix(irand(i + vec2(0.0, 1.0)), irand(i + vec2(1.0, 1.0)), u.x), u.y);',
        '}'].join('\n'))
      .replace('#include <map_fragment>', ['{',
        '  vec3 w = pesosUso();',
        '  vec3 dA = texture2D(uAlbA, vXZ * uEsc.x).rgb / uMedA;',
        '  vec3 dB = texture2D(map,   vXZ * uEsc.y).rgb / uMedB;',
        '  vec3 dC = texture2D(uAlbC, vXZ * uEsc.z).rgb / uMedC;',
        '  diffuseColor.rgb *= dA * w.x + dB * w.y + dC * w.z;',
        '  vec2 mp = vXZ * uMacro;',
        '  float m = inoise(mp) * 0.62 + inoise(mp * 3.1) * 0.26 + inoise(mp * 9.3) * 0.12;',
        '  diffuseColor.rgb *= mix(0.80, 1.16, m);',
        '}'].join('\n'))
      .replace('#include <roughnessmap_fragment>', ['float roughnessFactor = roughness;', '{',
        '  vec3 w = pesosUso();',
        '  roughnessFactor *= texture2D(uRugA, vXZ * uEsc.x).g * w.x',
        '                   + texture2D(roughnessMap, vXZ * uEsc.y).g * w.y',
        '                   + texture2D(uRugC, vXZ * uEsc.z).g * w.z;',
        '}'].join('\n'))
      .replace('#include <normal_fragment_maps>', ['{',
        '  vec3 w = pesosUso();',
        '  vec3 mapN = (texture2D(uNrmA, vXZ * uEsc.x).xyz * 2.0 - 1.0) * w.x',
        '            + (texture2D(normalMap, vXZ * uEsc.y).xyz * 2.0 - 1.0) * w.y',
        '            + (texture2D(uNrmC, vXZ * uEsc.z).xyz * 2.0 - 1.0) * w.z;',
        '  mapN.xy *= normalScale;',
        '  normal = normalize(tbn * mapN);',
        '}'].join('\n'))
  }
  // ⚠️ CHAVE FIXA E OBRIGATÓRIA. Sem ela o three compila um programa por
  // material, e esta cena já compila 402 na vista alta com teto medido perto de
  // 235. Aqui o material é um só, mas a regra da casa vale igual.
  mat.customProgramCacheKey = () => 'dogcity:ilha-splat-v1'
  mat.needsUpdate = true
}

export function buildIlhas(o: { cota: number; sombra?: boolean }): Ilhas {
  const group = new THREE.Group()
  group.name = 'ilhas'
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
  // ⚠️ A ILHA DEIXOU DE TER PALETA PRÓPRIA EM 02/09, e a queixa do fundador foi
  // exata: "o solo das ilhas eu achei muito artificial, precisamos do mesmo tipo
  // de solo que temos no resto do mapa". A versão anterior tinha razão em
  // DESCARTAR o albedo (cor por vértice multiplica o mapa, e vestir tudo com
  // 'campo' pintaria de verde a praia e o patamar de construção), mas o efeito
  // colateral foi um chão de cor chapada ao lado de um mapa todo texturado.
  //
  // A saída não é vestir tudo de uma superfície só, é ESCOLHER A SUPERFÍCIE POR
  // USO DO SOLO dentro do mesmo material. Ver `vestirSplat`.
  if (look2) vestirSplat(mat)

  // ⚠️ UMA MALHA SÓ PARA AS 25, E ISSO É ORÇAMENTO, NÃO ELEGÂNCIA. Uma malha por
  // ilha eram 5 chamadas de desenho e viraria 25, numa cena que já faz 442 e roda
  // a 36 fps. As geometrias são todas diferentes (cada ilha tem semente própria),
  // então instanciar não serve: o caminho é FUNDIR. Todas dividem o mesmo
  // material, todas têm os mesmos atributos (position, color, aUso, uv, index), e
  // a posição de cada uma entra por `translate` antes da fusão.
  //
  // ⚠️ O PREÇO É O RECORTE POR TRONCO. Fundidas, as 25 viram um volume de 9 km de
  // lado e o three passa a desenhar as 25 sempre que qualquer uma estiver no
  // quadro. Aceito medindo: 282.776 triângulos no total, 4,5% da cena, contra as
  // 24 chamadas que a alternativa custaria.
  const partes: THREE.BufferGeometry[] = []
  let tri = 0
  for (const il of ILHAS) {
    const g = geoIlha(il, o.cota)
    g.translate(il.x, 0, il.z)
    partes.push(g)
    tri += (g.index?.count ?? 0) / 3
  }
  const fundida = mergeGeometries(partes, false)
  for (const g of partes) g.dispose()
  if (fundida) {
    fundida.computeBoundingSphere()
    const m = new THREE.Mesh(fundida, mat)
    m.name = 'ilhas:arquipelago'
    m.castShadow = o.sombra ?? true
    m.receiveShadow = true
    group.add(m)
  }
  return {
    group, postas: ILHAS.length, triangulos: tri,
    dispose() {
      group.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() })
      mat.dispose(); group.clear()
    },
  }
}
