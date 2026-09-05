// ═══════════════════════════════════════════════════════════════════════════
// O LAGO DA PRAÇA: o anel de água entre a Praça Central e a cidade, com quatro
// pontes atravessando e ilhas reservadas para projeto parceiro.
//
// ⚠️ ELE NÃO CUSTA UM LOTE, e é isso que torna a ideia barata. O lote começa em
// r 1.300 e a muralha do precinto está em r 900: os 400 m entre os dois nunca
// tiveram endereço nenhum. O anel era regolito vazio, e regolito vazio no meio
// da cidade é a coisa que mais denuncia que a cidade não foi projetada.
//
// ⚠️ E ELE EXIGIU MEXER NO TERRENO, o que foi medido antes de decidir. Sonda de
// 36 rumos em r 1.300: o regolito ia de −18,7 a +25,1, ou seja 43,8 m de
// amplitude só por rumo. Uma lâmina plana ali afundaria 18,7 m de um lado e
// boiaria 25,1 m do outro. Por isso `terrain.ts` estendeu o platô de 960 para
// 1.340 e escavou uma bacia dentro dele: com o anel inteiro no nível 0, a água
// fica plana e o barranco tem a mesma altura em toda a volta.
//
// A GEOMETRIA, publicada por terrain.ts em `lago` e MEDIDA em 02/09:
//   fundo   −14 m      a bacia escavada no platô
//   lâmina  −6,5 m     7,5 m de água, 262 ha
//   fundo plano  r 1.100 a 1.390
//   linha d'água r 1.062,9 a 1.087,7 por dentro, r 1.403,3 a 1.421,7 por fora
//
// ⚠️ ESTE CABEÇALHO JÁ MENTIU UMA VEZ, e a mentira custou um diagnóstico
// inteiro: ele dizia margem em r 1.020 a 1.200 com 70 m de talude e lâmina em
// −17 quando o `terrain.ts` já tinha 1.090 / 1.390, talude de 40 e fundo de 26.
// Número de geometria aqui é CÓPIA: a fonte é `bacia()` em `terrain.ts`.
//
// ⚠️ A LÂMINA SUBIU DE −17 PARA −6,5 EM 02/09, POR DECISÃO DO FUNDADOR, e o
// motivo é a margem. Com a lâmina a 17 m abaixo do platô e 40 m de talude, o
// barranco seco tinha 44,3° de pico e a linha d'água caía justamente em cima
// dele, a 43,0°: era a "pista de skate" que ele apontou, e nenhuma areia era
// possível ali (`w = 1,5 / inclinação` dava 1,6 m). Agora o banco seco tem 6,5 m
// em 22,4° de pico e a linha d'água cai numa BANQUETA de 5,9 a 15,3°, que dá de
// 5,5 a 14,4 m de areia conforme o rumo. As cotas dependentes (as quatro pontes,
// as oito ilhas, o pé do píer e o espelho d'água do Dog Social Club) saem todas
// de `L.agua` e acompanharam sozinhas.
//
// ⚠️ AS QUATRO PONTES CAEM NOS BULEVARES, nos rumos 0, 90, 180 e 270. Não é
// simetria por simetria: os quatro são costura de setor, então a ponte entrega
// quem atravessa direto no eixo radial que leva ao Cinturão. Ponte que
// desembarca no meio de um quarteirão seria ponte para lugar nenhum.
//
// AS ILHAS são reservas nomeadas, e é assim que elas têm de ler antes de
// existir projeto: um disco de terra com cais, sem construção em cima. A
// primeira é do Dog Social Club por decisão do fundador; as outras sete ficam
// marcadas para projeto parceiro.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { contornosIlhas } from './ilhas'
import { look2 } from './look'
import { vestir, superficie, quebrarRepeticao } from './materiais'

export interface LagoOpts {
  heightAt: (x: number, z: number) => number
  lago: { r0: number; r1: number; agua: number; fundo: number }
  sombra?: boolean
}

export interface Ilha { id: string; nome: string; x: number; z: number; r: number; dono: string | null }

/**
 * ⚠️ A MARGEM DA ILHA NÃO É UM CÍRCULO, E QUEM PLANTA NELA PRECISA DA MESMA CURVA.
 * Se a praia usar o raio deformado e a floresta usar o raio redondo, a palmeira
 * nasce na água num lado da ilha e no meio da trilha no outro. Por isso o contorno
 * é uma função exportada, e não uma conta repetida em dois arquivos.
 * `k` é o índice da ilha (cada uma deforma diferente), `a` o ângulo em radianos.
 */
export function contornoIlha(k: number, a: number, base: number): number {
  return base * (1 + 0.062 * Math.sin(a * 3 + k) + 0.038 * Math.sin(a * 5 - k * 2))
}

/** o ângulo LOCAL da ilha `k` onde o píer encosta: nada de mato pode nascer nele */
export function anguloDesembarque(k: number): number {
  const ang = ((22.5 + k * 45) * Math.PI) / 180
  return Math.atan2(Math.cos(ang), -Math.sin(ang))
}

export interface Lago {
  group: THREE.Group
  /** avança a ondulação da água; chame no laço com o tempo em segundos */
  update(t: number): void
  pontes: number
  ilhas: Ilha[]
  areaHa: number
  triangulos: number
  dispose(): void
}

// ⚠️ A ÁGUA DO LAGO NÃO USA O AZUL DAS PEÇAS.
// (ver também `aguaDeVerdade()` no fim do arquivo: o azul sozinho não resolve) `#16283C` é o azul de lâmina
// pequena (espelho de praça, piscina), e ele foi escolhido para ler contra
// calçada clara em peça de 60 m. Num lago de 173 ha cercado de regolito claro no
// platô ele lê PRETO: a chapa mostrava um fosso de sombra e não água. Este aqui é
// o mesmo azul um passo mais claro e mais saturado, que é o que faz a lâmina
// pegar o sol raso e virar água.
export const COR_AGUA = '#1D4A66'
// ⚠️ A AREIA DO LAGO É A MESMA DA BAÍA, E ISSO NÃO É ECONOMIA, É MUNDO. As duas
// se encontram, e o fundador já reclamou de peça que "parece alienígena" quando
// uma família de cor não fecha. Os dois valores estão medidos contra o CHÃO
// VESTIDO em `lagos.ts`: o regolito de look2 cai perto de #6B6459 na tela, e a
// areia seca fica UM passo acima dele. #8E856F, que era o valor daqui, está dois
// passos acima e lê como glacê.
// ⚠️ E NO look2 A COR NÃO VEM DO MATERIAL, VEM DO VÉRTICE, em rampa de quatro
// componentes: a transição para o chão é ALFA, não cor. Cor fixa não funde com
// chão texturado por ruído de mundo em nenhuma hora do dia, e foi essa a lição
// que a orla da baía já pagou.
const AREIA_MOLHADA = '#463F33'
const AREIA_SECA = '#847A66'
const COR_PRAIA = AREIA_SECA          // a faixa do look 1, chapada, como sempre foi
// as constantes da praia por inclinação, iguais às de `lagos.ts` de propósito
const PRAIA_SUBIDA = 1.5
const PRAIA_SONDA = 6.0
const PRAIA_SONDA2 = 16.0
// ⚠️ PRAIA_MAX SUBIU DE 18 PARA 40 EM 05/09 (SEGUNDA RODADA), E AQUI ELA
// DIVERGE DE `lagos.ts` DE PROPÓSITO, pela primeira vez desde que a nota
// acima foi escrita. O motivo é a inclinação: a baía tem taludes que ainda
// vencem dezenas de metros em poucas dezenas de corrida (praia estreita,
// terreno de cratera), enquanto o anel da praça agora é uma reta de ~4,2%
// (ver `terrain.ts`, `bacia()`), pedida pelo fundador ("a praia não precisa
// ter faixa de areia enorme, mas ocupa toda a margem"). Com o teto em 18 a
// fórmula `1,5 / inclinação` cortava a areia real (28 m medidos pelo harness
// contra a MALHA, nos dois lados) na metade. 40 dá folga para os dois lados
// da modulação orgânica (`onda`, ±25%: 21 a 35 m) sem deixar a areia crescer
// sem limite se algum rumo futuro ficar mais manso ainda.
const PRAIA_MAX = 40.0
const PRAIA_MIN = 2.5
const PRAIA_FUNDO = 0.9
const PRAIA_ALISA = 6
// ⚠️ A BERMA, IGUAL À DE `lagos.ts` E PELO MESMO MOTIVO. Esta praia já tinha
// largura saudável (medido nos 720 rumos contra `superficieAt`: 7,6 a 13,4 m por
// dentro, 5,7 a 15,2 m por fora, e só 0% e 1% dos rumos no teto), mas o PERFIL
// TRANSVERSAL continuava um segmento reto só, da linha d'água ao chão: mesma
// curvatura em toda a volta, sem quebra. É a "pista de skate" vista de perto, e
// esta é a praia que fica ao lado da praça, ou seja a que se vê de mais perto.
// A crista entra como estação intermediária, com posição e altura em ondas de
// comprimento diferente do da largura (70 m), senão ela só copia a modulação
// que já existe e a fita continua fita.
const PRAIA_BERMA_F0 = 0.45
const PRAIA_BERMA_F1 = 0.25
const PRAIA_BERMA_H = 0.60
const PRAIA_BERMA_H0 = 0.22
const NA_MARGEM = 720                 // rumos em que a linha d'água é medida
const COR_PISO = '#CBC4B6'
const COR_ESTRUTURA = '#8F8879'
const COR_PISTA = '#57534B'
const COR_TRILHA = '#A79C86'   // saibro: a trilha da ilha não é pista de atletismo
const COR_MATO = '#6C7A5B'     // o verde fechado da mata, mais escuro que o gramado
const COR_TERRA = '#7E8A6B'

/** acumulador por cor, com o mesmo cuidado de sentido de face do kit das peças */
class Balde {
  vs: number[] = []; ix: number[] = []
  quad(A: number[], B: number[], C: number[], D: number[]) {
    // ⚠️ a componente Y de u x v é uz*vx - ux*vz. Escrever ao contrário vira
    // justamente as faces que já estavam certas: foi o que apagou as praças e os
    // anéis viários em 29/08, duas vezes no mesmo dia.
    const ny = (B[2] - A[2]) * (C[0] - B[0]) - (B[0] - A[0]) * (C[2] - B[2])
    const [p, q, r, s] = ny >= 0 ? [A, B, C, D] : [A, D, C, B]
    const i = this.vs.length / 3
    this.vs.push(...p, ...q, ...r, ...s)
    this.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
}

/**
 * ⚠️ AS DUAS MALHAS VERDES ERAM O DEFEITO NÚMERO UM DA CENA, e não por serem
 * grandes: por serem CHAPADAS. Medido em 01/09 no `?stats=1`: `lago:#7E8A6B`
 * ocupa 2.902 m de caixa e `lago:#6C7A5B` 2.426 m, as duas com `map: false`,
 * `uv: false` e cor única. Quatro agentes texturizaram rua, calçada, regolito,
 * praça e lote no mesmo dia, e a chapa continuava amadora porque metade do
 * quadro na câmera de rua é este verde sem mapa nenhum.
 *
 * ⚠️ SEM UV, `vestir` NÃO TEM O QUE REPETIR. As malhas do `Balde` só carregam
 * `position`: elas nascem de quads em coordenada de mundo e ninguém nunca
 * pediu UV delas. Então o UV é gerado aqui, em METROS DE MUNDO divididos pelo
 * lado do ladrilho, e o `vestir` é chamado com `mundo = 1, metros = 1`, que dá
 * `repeat = 1`. Chamar `vestir(mat, 'campo', 1)` direto NÃO funcionaria: o
 * `Math.max(1, ...)` de dentro do `vestir` trava o repeat em 1 e o ladrilho
 * sairia do tamanho da peça inteira.
 *
 * ⚠️ A COR DO MATERIAL MULTIPLICA O MAPA, então vestir mantendo `#6C7A5B`
 * (linear ~0,15) daria um verde de pântano. As duas viram TINTA CLARA e a
 * textura passa a mandar. Conta feita na mão, com o meio do albedo do 'campo'
 * em ~(105,128,80) sRGB: com a tinta `#D8E0CC` a mata cai em ~(89,112,66), um
 * passo abaixo do `#6C7A5B` que ela substituiu, que é o que mata fechada deve
 * ser; com a tinta branca o gramado fica em ~(110,127,72), mais claro que a
 * mata. O par continua legível como dois usos de solo, que era o pedido.
 *
 * MATA e GRAMADO se separam por TRÊS coisas, não só por tinta, porque só tinta
 * o olho lê como "a mesma grama com sombra":
 *   mata     ladrilho 11 m, normal 1,15, macro 90 m   denso, relevo forte
 *   gramado  ladrilho 17 m, normal 0,60, macro 70 m   aberto, quase liso
 *
 * Custo: ZERO triângulo e ZERO chamada de desenho, porque os dois materiais já
 * existiam. Zero programa novo também: o `quebrarRepeticao` de dentro do
 * `vestir` declara `customProgramCacheKey` fixo e divide o programa com todo o
 * resto da cidade.
 */
function vestirVerde(g: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial, cor: string) {
  const mata = cor === COR_MATO
  if (!mata && cor !== COR_TERRA) return
  const lado = mata ? 11 : 17
  const p = g.getAttribute('position')
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / lado
    uv[i * 2 + 1] = p.getZ(i) / lado
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  mat.color.set(mata ? '#D8E0CC' : '#FFFFFF')
  vestir(mat, 'campo', 1, {
    metros: 1,
    normal: mata ? 1.15 : 0.6,
    macroMetros: mata ? 90 : 70,
  })
}

export function buildLago(o: LagoOpts): Lago {
  const group = new THREE.Group()
  group.name = 'lago'
  const L = o.lago
  const baldes = new Map<string, Balde>()
  const B = (cor: string) => {
    let b = baldes.get(cor)
    if (!b) { b = new Balde(); baldes.set(cor, b) }
    return b
  }
  const P = (x: number, z: number, y: number) => [x, y, z]
  const NO = (x: number, z: number, off: number) => [x, o.heightAt(x, z) + off, z]

  // ⚠️ A LINHA D'ÁGUA SE MEDE, NÃO SE CALCULA. O talude varia com o rumo (ver
  // `bacia` em terrain.ts: dois harmônicos mexem no comprimento dele e na altura
  // do banco seco), então o raio em que o chão cruza a cota da lâmina muda de
  // rumo para rumo, e nenhuma constante de raio serve mais. Bisseção no
  // `heightAt`, 720 rumos, 40 passos: 28.800 consultas UMA VEZ, na construção.
  // ⚠️ E `o.heightAt` AQUI É O `superficieAt` DO TERRENO, não a curva analítica:
  // `plaza-scene.tsx` passa `heightAt: terrain.superficieAt`. É o certo, porque
  // a areia tem de pousar na MALHA que o olho vê, e não na fórmula. Foi essa
  // diferença que enterrou a faixa antiga em até 14,43 m (rumo 45°, r 1.053,5).
  const linhaDagua = (fora: boolean): Float64Array => {
    const out = new Float64Array(NA_MARGEM)
    const lo = fora ? L.r1 : L.r0 - 90, hi = fora ? L.r1 + 90 : L.r0
    for (let k = 0; k < NA_MARGEM; k++) {
      const a = (k / NA_MARGEM) * Math.PI * 2
      const sx = Math.sin(a), sz = -Math.cos(a)
      let l = lo, h = hi
      for (let it = 0; it < 40; it++) {
        const m = (l + h) / 2
        const y = o.heightAt(sx * m, sz * m)
        // por dentro o chão DESCE com o raio; por fora, SOBE
        if (fora ? y < L.agua : y > L.agua) l = m
        else h = m
      }
      out[k] = (l + h) / 2
    }
    return out
  }
  // ⚠️ A LINHA D'ÁGUA MEDIDA NÃO PODE IR CRUA PARA A PRAIA, e esta era a margem
  // deformada do lago. `linhaDagua` faz bisseção contra `superficieAt`, que é a
  // MALHA do terreno interpolada por triângulo: a raiz não é uma curva lisa, ela
  // salta quando o rumo troca de triângulo. A largura da areia (`W`) já era
  // alisada em 6 passadas, mas a LINHA de onde ela sai não era nunca, então a
  // borda molhada seguia um contorno serrilhado a 720 rumos, ou seja um dente a
  // cada 9,3 m de arco em r 1.075: de perto lê como recorte de tesoura.
  // Mesma máquina de `alisaContorno` em `lagos.ts`, mesmo teto de desvio de 4 m,
  // e ele é o que impede o alisamento de descolar a areia da água: a franja
  // molhada entra de 5 a 9,5 m para dentro da lâmina e cobre os 4 m com folga.
  // ⚠️ E O LAÇO É CIRCULAR. Deixar a emenda dos 720 rumos de fora guardaria uma
  // quina não alisada por margem, e uma quina só numa linha lisa é o que o olho
  // acha primeiro.
  const alisaRaio = (r: Float64Array, passadas = 3, teto = 4) => {
    const M = r.length
    const cru = r.slice()
    for (let p = 0; p < passadas; p++) {
      const T = r.slice()
      for (let k = 0; k < M; k++) {
        r[k] = T[k] * 0.5 + (T[(k + M - 1) % M] + T[(k + 1) % M]) * 0.25
      }
    }
    for (let k = 0; k < M; k++) {
      const d = r[k] - cru[k]
      if (d > teto) r[k] = cru[k] + teto
      else if (d < -teto) r[k] = cru[k] - teto
    }
  }
  const margemI = linhaDagua(false), margemE = linhaDagua(true)
  alisaRaio(margemI); alisaRaio(margemE)
  let rMargemI = Infinity, rMargemE = -Infinity
  for (let k = 0; k < NA_MARGEM; k++) {
    if (margemI[k] < rMargemI) rMargemI = margemI[k]
    if (margemE[k] > rMargemE) rMargemE = margemE[k]
  }

  // ── 1. a lâmina d'água ───────────────────────────────────────────────────
  // ⚠️ ELA VAI ALÉM DA MARGEM NOMINAL DE PROPÓSITO. A bacia tem talude de 70 m
  // de cada lado, e a linha d'água cai DENTRO do talude, não na quebra: estender
  // a lâmina 60 m para dentro e para fora garante que ela morra enterrada no
  // barranco em vez de terminar num degrau boiando.
  // ⚠️ OS RAIOS SAEM DA MARGEM MEDIDA, e a folga de 30 m é o que ENTERRA a
  // ponta da lâmina no barranco em vez de deixá-la terminar num degrau boiando.
  // Como a linha d'água anda de 25 m com o rumo (r 1.062,9 a 1.087,7 por
  // dentro), um raio constante tirado de `L.r0` voltaria a errar nos dois
  // sentidos: sobra de fora num rumo, fresta de água no outro.
  const rAguaI = rMargemI - 30, rAguaE = rMargemE + 30
  // ⚠️ Z-FIGHTING CONTRA `lagos.ts`, MEDIDO EM 05/09/2026, DEPOIS DE A BACIA
  // DESCER PARA -40. Enquanto o Lago da Praça vivia em -6,5 ele não tinha como
  // se encontrar com a água da cidade; com os dois na mesma cota (-40) e a
  // vala dos radiais entrando até o fundo plano do anel, o leito da bacia
  // ficou contíguo por baixo d'água com o resto da rede, e o flood-fill de
  // `lagos.ts` (que varre a cidade inteira abaixo de `cota`) passou a achar e
  // desenhar a MESMA lâmina aqui. Medido com `npx tsx`, sem navegador, sobre o
  // `buildLagos` de verdade: 26.123 dos 528.468 vértices de `lagos:agua` caem
  // dentro do raio 1.100 a 1.460 do Lago da Praça, coplanares em Y=-40 com
  // esta lâmina. Duas cascas iguais na mesma cota brigam pelo depth buffer em
  // toda a volta do anel, não só numa costura: é a "falha no encontro" que o
  // fundador viu, só que espalhada pela lâmina inteira, não concentrada numa
  // borda.
  //
  // A mesma receita de `canais.ts` (lá é `VIES_AGUA`, 3 cm, e o canal sempre
  // ganha da baía): aqui o lago ganha da baía com um viés menor, 1,5 cm, de
  // propósito. Os dois módulos já se sobrepõem hoje, medido, entre r 1.450 e
  // 1.460 (a borda da lâmina do lago encosta no início da água do canal): com
  // 1,5 cm o lago sobe da baía sem empatar com o canal, que continua ganhando
  // ali. A ordem fica: baía perde de tudo, lago perde só do canal.
  const VIES_LAGO = 0.015
  {
    const b = B(COR_AGUA)
    const seg = 240
    const p = (r: number, a: number) => P(Math.sin(a) * r, -Math.cos(a) * r, L.agua + VIES_LAGO)
    if (!look2) {
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
        b.quad(p(rAguaI, a0), p(rAguaI, a1), p(rAguaE, a1), p(rAguaE, a0))
      }
    } else {
      // ⚠️ NO LOOK 2 A LÂMINA PRECISA DE VÉRTICE NO MEIO, e o motivo não é
      // geometria, é o GRADIENTE DE PROFUNDIDADE. O anel tinha 276 m de largura
      // (r 962 a 1.238) com UM quad de ponta a ponta: os dois únicos vértices
      // radiais estão os dois NA MARGEM, então a distância até a margem
      // interpolada entre eles dá zero no anel inteiro e a água sai rasa em toda
      // a volta. Aqui o raio vai em 12 faixas com espaçamento cosseno, denso nas
      // duas beiras (primeiro passo ~4,7 m) e folgado no meio, que é onde o
      // gradiente pouco muda. Custo medido no papel: 480 -> 5.760 triângulos.
      const RD = 12
      const raios: number[] = []
      for (let j = 0; j <= RD; j++) {
        const s = (1 - Math.cos((j / RD) * Math.PI)) / 2
        raios.push(rAguaI + (rAguaE - rAguaI) * s)
      }
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
        for (let j = 0; j < RD; j++) {
          const r0 = raios[j], r1 = raios[j + 1]
          b.quad(p(r0, a0), p(r0, a1), p(r1, a1), p(r1, a0))
        }
      }
    }
  }

  // ── 2. OS DOIS ANÉIS DE MARGEM, QUE SÃO VIA E NÃO CALÇADA ────────────────
  //
  // ⚠️ ESTE BLOCO ERA UM PASSEIO DE 14 m E ISSO ESTAVA ERRADO, e o defeito era
  // de SISTEMA e não de desenho. Sondei o chão nos quatro rumos onde as pontes
  // encostam: do lado da praça, em r 960 e 990, a ponte desembocava em REGOLITO
  // PURO, sem via nenhuma. E do lado de fora, as quatro pontes chegavam na
  // cidade sem nada que as ligasse entre si: para ir da ponte norte à ponte
  // leste era preciso atravessar a praça inteira ou dar a volta pela cidade.
  // Quatro pontes espetaculares que não formam rede não são rede, são quatro
  // becos. O fundador viu isso de cima antes de eu medir.
  //
  // Agora são dois ANÉIS VIÁRIOS de verdade, com seção:
  //   ANEL DA PRAÇA  r 975, 20 m   recebe as pontes do lado de dentro
  //   ANEL DA ORLA   r 1.440, 26 m recebe as pontes do lado de fora e alimenta
  //                                os 12 bulevares, que passaram a começar em
  //                                1.420 para encostar nele (gerar_cidade.py)
  // Com eles o sistema fecha: praça → ponte → orla → bulevar → anel → Cinturão.
  const R_ANEL_PRACA = 975, LARG_PRACA = 20
  // ⚠️ O ANEL DA ORLA RECUOU DE L.r1+50 PARA L.r1+75 EM 02/09, E NÃO É GOSTO.
  // Com ele em r 1.440 a rotatória de cada cabeceira (raio 26) chegava em
  // r 1.414, onde o chão MEDIDO estava a −9,15 m: eram quatro línguas de asfalto
  // de 26 m descendo 9 m por um barranco de 40°, e elas caíam exatamente onde o
  // pé da ponte encosta, que é onde o olho vai. Recuar mata o defeito na origem
  // e é mais barato que recortar o disco. Em r 1.465 a aresta interna do anel
  // fica em 1.452, e o pé do talude externo vai no máximo até 1.447: 5 m livres
  // no pior rumo.
  const R_ANEL_ORLA = L.r1 + 75, LARG_ORLA = 26
  const aneisDeMargem = [
    { r: R_ANEL_PRACA, larg: LARG_PRACA },
    { r: R_ANEL_ORLA, larg: LARG_ORLA },
  ]
  for (const an of aneisDeMargem) {
    const seg = Math.max(160, Math.ceil((2 * Math.PI * an.r) / 18))
    // seção: calçada 3 + pista (larg-6) + calçada 3, com a guia de 15 cm
    const bandas: [number, number, number, string][] = [
      [0, 3, 0.8, COR_PISO],
      [3, an.larg - 3, 0.65, COR_PISTA],
      [an.larg - 3, an.larg, 0.8, COR_PISO],
    ]
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      for (const [de, ate, alt, cor] of bandas) {
        const b = B(cor)
        const p = (t: number, a: number) => {
          const r = an.r - an.larg / 2 + t
          return NO(Math.sin(a) * r, -Math.cos(a) * r, alt)
        }
        b.quad(p(de, a0), p(de, a1), p(ate, a1), p(ate, a0))
      }
    }
  }
  // A faixa de praia do LOOK 1: anel concêntrico de largura constante.
  // ⚠️ ELA É O DEFEITO QUE O FUNDADOR APONTOU, E FICA SÓ PORQUE O look 1 FICA.
  // Largura fixa de 28 m sobre um barranco que muda de inclinação, cor chapada
  // sem mapa e sem alfa, e as duas pontas erram a linha d'água por alguns
  // metros. No look 2 ela não é desenhada: ver o bloco da praia por inclinação.
  if (!look2) for (const [rIn, rOut] of [[L.r0 - 42, L.r0 - 14], [L.r1 + 14, L.r1 + 42]]) {
    const b = B(COR_PRAIA)
    const seg = Math.max(120, Math.ceil((2 * Math.PI * rOut) / 18))
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2
      const nr = 4
      for (let j = 0; j < nr; j++) {
        const ra = rIn + ((rOut - rIn) * j) / nr, rb = rIn + ((rOut - rIn) * (j + 1)) / nr
        const p = (r: number, a: number) => NO(Math.sin(a) * r, -Math.cos(a) * r, 0.55)
        b.quad(p(ra, a0), p(ra, a1), p(rb, a1), p(rb, a0))
      }
    }
  }
  // ── 2b. A PRAIA DO LOOK 2: A LARGURA SAI DA INCLINAÇÃO ──────────────────
  //
  // ⚠️ A LARGURA NÃO É UMA CONSTANTE, É UMA CONSEQUÊNCIA. `w = subida /
  // inclinação`: a areia acompanha 1,5 m de subida do terreno, e onde ela vem,
  // vem. Medido no barranco novo: a inclinação na linha d'água vai de 5,9° a
  // 15,3° conforme o rumo, o que dá de 5,5 a 14,4 m de areia antes da modulação.
  // A mesma máquina de `lagos.ts`, e de propósito: as duas areias se encontram.
  //
  // ⚠️ DUAS SONDAS, A MAIS ÍNGREME MANDA. Com uma sonda só, uma margem redonda
  // devolve a MESMA largura em toda a volta e a praia volta a ler como fita.
  //
  // ⚠️ E O LADO DE TERRA ACABA EM ALFA, NÃO EM COR. Chutar a cor do regolito
  // para fundir não funde: o chão é textura mais ruído de mundo mais sombra, e
  // uma cor fixa é igual a ele em UM ponto do dia. Alfa se desfaz sobre o chão
  // QUE ESTIVER LÁ. Por isso a cor por vértice aqui tem QUATRO componentes.
  //
  // ⚠️ A NORMAL DA MARGEM É RADIAL, e isso é conta e não preguiça: o talude varia
  // ±12 m em lóbulos de 120°, ou seja dr/da fica perto de 5,6 m por radiano
  // contra r 1.074, e a margem se afasta do radial em menos de 0,3°. Chamar a
  // máquina de esquadria de `lagos.ts` aqui seria precisão que ninguém vê.
  const posAr: number[] = [], corAr: number[] = [], uvAr: number[] = [], idxAr: number[] = []
  if (look2) {
    const cMol = new THREE.Color(AREIA_MOLHADA), cSec = new THREE.Color(AREIA_SECA)
    const LADRILHO = 8
    const rnd = (x: number, z: number) => {
      const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
      return h - Math.floor(h)
    }
    const onda = (x: number, z: number, esc: number) => {
      const xi = Math.floor(x / esc), zi = Math.floor(z / esc)
      const fx = x / esc - xi, fz = z / esc - zi
      const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz)
      const q0 = rnd(xi, zi) + (rnd(xi + 1, zi) - rnd(xi, zi)) * ux
      const q1 = rnd(xi, zi + 1) + (rnd(xi + 1, zi + 1) - rnd(xi, zi + 1)) * ux
      return q0 + (q1 - q0) * uz
    }
    const emite = (x: number, y: number, z: number, cor: THREE.Color, al: number) => {
      posAr.push(x, y, z)
      corAr.push(cor.r, cor.g, cor.b, al)
      uvAr.push(x / LADRILHO, z / LADRILHO)
    }
    for (const fora of [false, true]) {
      const sinal = fora ? 1 : -1                  // para que lado fica a terra
      const rr = fora ? margemE : margemI
      const M = NA_MARGEM
      const SX = new Float64Array(M), SZ = new Float64Array(M)
      for (let k = 0; k < M; k++) {
        const a = (k / M) * Math.PI * 2
        SX[k] = Math.sin(a); SZ[k] = -Math.cos(a)
      }
      const em = (k: number, d: number) =>
        [SX[k] * (rr[k] + sinal * d), SZ[k] * (rr[k] + sinal * d)] as const
      const W = new Float64Array(M)
      for (let k = 0; k < M; k++) {
        const [x1, z1] = em(k, PRAIA_SONDA), [x2, z2] = em(k, PRAIA_SONDA2)
        const h1 = o.heightAt(x1, z1), h2 = o.heightAt(x2, z2)
        const decl = Math.max(0, (h1 - L.agua) / PRAIA_SONDA, (h2 - L.agua) / PRAIA_SONDA2)
        const w = decl < 1e-3 ? PRAIA_MAX : Math.min(PRAIA_MAX, PRAIA_SUBIDA / decl)
        // ⚠️ A MODULAÇÃO MULTIPLICA, NÃO SOMA: onde a medida é zero continua
        // zero, e a areia nunca é inventada em cima de rocha.
        W[k] = w * (0.75 + 0.5 * onda(SX[k] * rr[k], SZ[k] * rr[k], 70))
      }
      // ⚠️ ALISAR É O QUE MATA A LASCA, e o laço é CIRCULAR: deixar a emenda dos
      // 720 rumos de fora guardaria uma quina não alisada por margem, e uma
      // quina só numa faixa lisa é justamente o que o olho acha.
      for (let p = 0; p < PRAIA_ALISA; p++) {
        const T = W.slice()
        for (let k = 0; k < M; k++) W[k] = (T[(k + M - 1) % M] + 2 * T[k] + T[(k + 1) % M]) / 4
      }
      // ⚠️ NÃO EXISTE CORTE POR LIMIAR, e essa era a causa da lasca no gêmeo
      // deste código: campo contínuo não pisca, porque não há decisão para
      // oscilar em volta. Quem desaparece é o alfa.
      const alfa = (w: number) => Math.max(0, Math.min(1, (w - 0.8) / (PRAIA_MIN - 0.8)))
      const banda = (k: number) => {
        const w = W[k]
        // ⚠️ A FRANJA ENTRA PARA DENTRO DA LÂMINA e começa 0,9 m abaixo dela:
        // assim a areia não tem borda nenhuma do lado molhado, ela só some.
        const wm = -(5 + 0.25 * w)
        // ⚠️ O RABO É LONGO DE PROPÓSITO. Com 3 m ele não é fusão, é chanfro.
        const wf = w + Math.max(9, w * 0.9)
        const [xs, zs] = em(k, w), [xf, zf] = em(k, wf)
        // a crista da berma: onde ela cai e quanto ela levanta
        const wb = w * (PRAIA_BERMA_F0 + PRAIA_BERMA_F1 * onda(SX[k] * rr[k], SZ[k] * rr[k], 135))
        const [xb, zb] = em(k, wb)
        const cris = PRAIA_BERMA_H0 + PRAIA_BERMA_H * (w / PRAIA_MAX)
          * (0.6 + 0.8 * onda(SX[k] * rr[k] + 311, SZ[k] * rr[k] - 177, 190))
        return {
          wm, w, wb, wf, a: alfa(w),
          // ⚠️ A CRISTA POUSA NO CHÃO E DEPOIS LEVANTA, não numa cota fixa: se
          // ela saísse de uma constante voltaria a ser prateleira, que é o
          // defeito que a linha `ys` abaixo já tinha consertado uma vez.
          yb: Math.max(L.agua + 0.10, o.heightAt(xb, zb) + 0.06) + cris,
          // ⚠️ A COTA SAI DO CHÃO, NÃO DE UMA CONSTANTE, senão a faixa lê como
          // prateleira apoiada onde o terreno sobe devagar.
          ys: Math.max(L.agua + 0.05, o.heightAt(xs, zs) + 0.06),
          yf: Math.max(L.agua + 0.06, o.heightAt(xf, zf) + 0.06),
        }
      }
      for (let k = 0; k < M; k++) {
        const k2 = (k + 1) % M
        const A0 = banda(k), B0 = banda(k2)
        if (A0.a <= 0 && B0.a <= 0) continue        // aqui a água encosta na rocha
        const quad = (
          wa0: number, ya0: number, aa0: number, wa1: number, ya1: number, aa1: number,
          wb0: number, yb0: number, ab0: number, wb1: number, yb1: number, ab1: number,
          c0: THREE.Color, c1: THREE.Color,
        ) => {
          const bp = posAr.length / 3
          const [xa, za] = em(k, wa0), [xb, zb] = em(k2, wa1)
          const [xc, zc] = em(k2, wb1), [xd, zd] = em(k, wb0)
          emite(xa, ya0, za, c0, aa0)
          emite(xb, ya1, zb, c0, aa1)
          emite(xc, yb1, zc, c1, ab1)
          emite(xd, yb0, zd, c1, ab0)
          // ⚠️ O SENTIDO DEPENDE DO LADO: por fora a normal do quad vira, e o
          // material é DoubleSide justamente porque a faixa é vista de raso dos
          // dois lados do lago. Manter a ordem constante e confiar no DoubleSide
          // é mais barato que testar produto vetorial em 5.760 quads.
          idxAr.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
        }
        const yL = L.agua + 0.02
        quad(A0.wm, L.agua - PRAIA_FUNDO, A0.a, B0.wm, L.agua - PRAIA_FUNDO, B0.a,
             0, yL, A0.a, 0, yL, B0.a, cMol, cMol)
        // a antepraia, curta e íngreme, sobe só até a crista
        quad(0, yL, A0.a, 0, yL, B0.a,
             A0.wb, A0.yb, A0.a, B0.wb, B0.yb, B0.a, cMol, cSec)
        // o pós-praia, quase plano, da crista até o chão: é a QUEBRA entre os
        // dois que faz o olho ler praia em vez de rampa
        quad(A0.wb, A0.yb, A0.a, B0.wb, B0.yb, B0.a,
             A0.w, A0.ys, A0.a, B0.w, B0.ys, B0.a, cSec, cSec)
        quad(A0.w, A0.ys, A0.a, B0.w, B0.ys, B0.a,
             A0.wf, A0.yf, 0, B0.wf, B0.yf, 0, cSec, cSec)
      }
    }
  }

  // ⚠️ A ROTATÓRIA EM CADA CABECEIRA, e ela não é enfeite: é o que faz a ponte
  // ENTREGAR em vez de despejar. Sem ela o tabuleiro de 26 m morre numa faixa de
  // via de 20 e quem chega não tem para onde virar.
  for (const rumo of [0, 90, 180, 270]) {
    const ang = (rumo * Math.PI) / 180
    for (const an of aneisDeMargem) {
      const cx = Math.sin(ang) * an.r, cz = -Math.cos(ang) * an.r
      const N = 36, RE = 26, RI = 11
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2
        const P2 = (rr: number, aa: number, off: number) =>
          NO(cx + Math.cos(aa) * rr, cz + Math.sin(aa) * rr, off)
        B(COR_PISTA).quad(P2(RI, a0, 0.65), P2(RI, a1, 0.65), P2(RE, a1, 0.65), P2(RE, a0, 0.65))
        B(COR_TERRA).quad(P2(0, a0, 0.9), P2(0, a1, 0.9), P2(RI, a1, 0.9), P2(RI, a0, 0.9))
      }
    }
  }

  // ── 3. as quatro pontes ──────────────────────────────────────────────────
  // Tabuleiro de 26 m de largura a +7 m do platô, atravessando os 420 m de anel.
  // Duas torres por ponte, de 74 m, com tirantes: é a silhueta que faz a ponte
  // ser vista da praça e do outro lado, que é o que o fundador pediu quando
  // disse "espetaculares".
  // ⚠️ A PONTE VAI DE ANEL A ANEL, e não de praia a praia. Antes ela começava em
  // L.r0 - 70 e terminava em L.r1 + 70, ou seja no meio do nada dos dois lados.
  const R_PONTE_I = R_ANEL_PRACA, R_PONTE_E = R_ANEL_ORLA
  const LARG = 26
  //
  // ⚠️ O TABULEIRO NÃO TINHA RAMPA, E ISSO SÓ APARECEU NA SONDA. Levar a ponte de
  // anel a anel resolveu O PLANO (ela passou a encostar em via dos dois lados),
  // mas não o PERFIL: `Y_DECK` era constante, então a ponte chegava na rotatória
  // a 7 m de altura e a rotatória estava a 0,65 m. Vista de cima parecia ligada;
  // de lado era uma laje voando com um degrau de 6,35 m na cabeceira. Ligação em
  // planta sem ligação em corte não é ligação.
  //
  // Agora o perfil é de viaduto: encontro no nível da via, rampa de 28% do vão
  // (130 m para 6,2 m, ou 4,8%), patamar no meio. A concordância é suavizada
  // (`3k² − 2k³`) porque emenda reta deixa QUINA na crista, e quina numa peça de
  // 465 m aparece de longe.
  //
  // ⚠️ Y_ENC DEIXOU DE SER UMA CONSTANTE ÚNICA EM 05/09 (SEGUNDA RODADA), E
  // O MOTIVO É QUE OS DOIS ANÉIS PARARAM DE TER A MESMA COTA. Até aqui
  // `R_ANEL_PRACA` (975) e `R_ANEL_ORLA` (L.r1+75) viviam os dois no platô
  // plano em 0, e uma constante servia às duas cabeceiras. Com a praça em
  // −35 e a orla pousada na subida nova da cidade (a poucos metros da lâmina:
  // medido, −38,5 no eixo do bulevar norte), as duas cabeceiras ficam a
  // ALTURAS DIFERENTES. Uma constante só faria o tabuleiro flutuar de um lado
  // ou afundar no chão do outro; cada cabeceira lê agora a SUA cota local
  // (`o.heightAt`, a mesma função que a rotatória usa para o piso), e o arco
  // por cima é sempre a mesma altura de sempre (6,2 m: `Y_DECK` 7,0 menos
  // `Y_ENC` 0,8, os números antigos), só que somada ao encontro de cada lado
  // em vez de a um platô comum que não existe mais.
  const ALTURA_ARCO = 6.2
  const RAMPA = 0.28
  const TORRES = [0.30, 0.70]        // fração do vão onde cada torre sobe
  const H_TORRE = 74
  let pontes = 0
  for (const rumo of [0, 90, 180, 270]) {
    pontes++
    const ang = (rumo * Math.PI) / 180
    const dx = Math.sin(ang), dz = -Math.cos(ang)
    const px = Math.cos(ang), pz = Math.sin(ang)
    const eixo = (t: number) => {
      const r = R_PONTE_I + (R_PONTE_E - R_PONTE_I) * t
      return [dx * r, dz * r] as const
    }
    // ⚠️ CADA CABECEIRA, A SUA COTA. `+0,8` é o mesmo colchão de guia que a
    // rotatória usa (`P2(..., 0.65)`/`P2(..., 0.9)` acima); manter o mesmo
    // valor aqui é o que faz o tabuleiro encostar exatamente na pista, sem
    // degrau nem fresta, em QUALQUER cota que a cabeceira esteja.
    const yEncI = o.heightAt(dx * R_PONTE_I, dz * R_PONTE_I) + 0.8
    const yEncE = o.heightAt(dx * R_PONTE_E, dz * R_PONTE_E) + 0.8
    const encAt = (t: number) => yEncI + (yEncE - yEncI) * t
    const yDeck = (t: number) => {
      const k = t < RAMPA ? t / RAMPA : t > 1 - RAMPA ? (1 - t) / RAMPA : 1
      return encAt(t) + ALTURA_ARCO * (k * k * (3 - 2 * k))
    }
    // tabuleiro
    {
      const b = B(COR_PISO)
      const n = 40
      for (let k = 0; k < n; k++) {
        const [x0, z0] = eixo(k / n), [x1, z1] = eixo((k + 1) / n)
        const y0 = yDeck(k / n), y1 = yDeck((k + 1) / n)
        b.quad(
          P(x0 - px * LARG / 2, z0 - pz * LARG / 2, y0),
          P(x1 - px * LARG / 2, z1 - pz * LARG / 2, y1),
          P(x1 + px * LARG / 2, z1 + pz * LARG / 2, y1),
          P(x0 + px * LARG / 2, z0 + pz * LARG / 2, y0),
        )
      }
      // as duas laterais do tabuleiro, para ele ter espessura vista de lado
      const be = B(COR_ESTRUTURA)
      for (const s of [-1, 1]) {
        for (let k = 0; k < n; k++) {
          const [x0, z0] = eixo(k / n), [x1, z1] = eixo((k + 1) / n)
          const ox = px * s * LARG / 2, oz = pz * s * LARG / 2
          const y0 = yDeck(k / n), y1 = yDeck((k + 1) / n)
          // ⚠️ NA RAMPA A SAIA TEM DE MORRER NO CHÃO e não acompanhar o tabuleiro:
          // uma viga de 3,2 m pendurada sob o encontro fica boiando sobre a via.
          // ⚠️ `encAt`, NÃO MAIS `Y_ENC`: o "chão" que a saia persegue é o
          // encontro LOCAL (que agora varia de uma cabeceira a outra), não um
          // platô comum.
          const e0 = Math.min(3.2, y0 - encAt(k / n) + 0.6), e1 = Math.min(3.2, y1 - encAt((k + 1) / n) + 0.6)
          be.quad(
            P(x0 + ox, z0 + oz, y0), P(x1 + ox, z1 + oz, y1),
            P(x1 + ox, z1 + oz, y1 - e1), P(x0 + ox, z0 + oz, y0 - e0),
          )
        }
      }
    }
    // torres e tirantes
    for (const t of TORRES) {
      const [tx, tz] = eixo(t)
      const b = B(COR_ESTRUTURA)
      // a torre: um prisma de 4 faces, do fundo da bacia ao topo
      const base = L.fundo
      const lado = 7
      for (const s of [-1, 1]) {
        const ox = px * s * (LARG / 2 - 1), oz = pz * s * (LARG / 2 - 1)
        for (let f = 0; f < 4; f++) {
          const a = (f / 4) * Math.PI * 2, a2 = ((f + 1) / 4) * Math.PI * 2
          const c1x = tx + ox + Math.cos(a) * lado, c1z = tz + oz + Math.sin(a) * lado
          const c2x = tx + ox + Math.cos(a2) * lado, c2z = tz + oz + Math.sin(a2) * lado
          // ⚠️ `yDeck(t)`, NÃO MAIS `Y_DECK`: o topo da torre é o arco naquele
          // PONTO do vão (as duas torres ficam dentro do patamar plano do
          // arco, então isto lê igual ao valor fixo de antes onde as duas
          // cabeceiras tinham a mesma cota, e some sozinho onde não têm mais).
          b.quad(P(c1x, c1z, base), P(c2x, c2z, base),
                 P(c2x, c2z, yDeck(t) + H_TORRE), P(c1x, c1z, yDeck(t) + H_TORRE))
        }
        // tirantes: seis fitas finas do topo da torre até o tabuleiro
        for (let k = 1; k <= 6; k++) {
          const d = (k / 7) * (R_PONTE_E - R_PONTE_I) * 0.34
          for (const dir of [-1, 1]) {
            const ta = t + (dir * d) / (R_PONTE_E - R_PONTE_I)
            const [ax, az] = eixo(ta)
            const w = 0.9
            // o tirante ancora ONDE O TABULEIRO ESTÁ, que na rampa já não é 7 m
            b.quad(
              P(tx + ox - px * w, tz + oz - pz * w, yDeck(t) + H_TORRE),
              P(tx + ox + px * w, tz + oz + pz * w, yDeck(t) + H_TORRE),
              P(ax + ox + px * w, az + oz + pz * w, yDeck(ta)),
              P(ax + ox - px * w, az + oz - pz * w, yDeck(ta)),
            )
          }
        }
      }
    }
  }

  // ── 4. as ilhas ──────────────────────────────────────────────────────────
  //
  // ⚠️ ELAS ERAM DISCOS DE TERRA E O FUNDADOR CHAMOU DE GENÉRICAS, com razão: um
  // disco verde com mato jogado em cima não é ilha, é mancha. Ilha de verdade tem
  // ORLA (praia, e a praia é o que faz a água ter margem), tem MIOLO (a floresta),
  // tem CLAREIRA (senão não há para onde ir), tem TRILHA ligando as duas, e tem
  // um jeito de CHEGAR. Sem os cinco ela continua sendo mancha por mais palmeira
  // que se plante.
  //
  // ⚠️ E ELAS CONTINUAM SENDO RESERVA. O que está desenhado é o SÍTIO: praia,
  // trilha, clareira e píer. Projeto de parceiro entra na clareira, que é
  // exatamente o pedaço deixado livre. A primeira é do Dog Social Club por
  // decisão do fundador, e por isso ela é maior e tem praça em vez de clareira.
  const rIlha = (rAguaI + rAguaE) / 2
  const ilhas: Ilha[] = []
  for (let k = 0; k < 8; k++) {
    const rumo = 22.5 + k * 45                    // entre as pontes, nunca sob elas
    const ang = (rumo * Math.PI) / 180
    const x = Math.sin(ang) * rIlha, z = -Math.cos(ang) * rIlha
    const dsc = k === 0
    const raio = dsc ? 92 : 54 + (k % 3) * 9      // ⚠️ raio VARIADO: oito ilhas do
                                                  // mesmo tamanho leem como carimbo
    ilhas.push({
      id: `ILHA${String(k + 1).padStart(2, '0')}`,
      nome: dsc ? 'Ilha do Dog Social Club' : `Ilha ${k + 1}, reservada`,
      x, z, r: raio, dono: dsc ? 'Dog Social Club' : null,
    })
    const seg = 44
    const p = (r: number, a: number, y: number) => P(x + Math.cos(a) * r, z + Math.sin(a) * r, y)
    // ⚠️ A MARGEM NÃO É UM CÍRCULO. Dois harmônicos deformam o raio em ±9%: é o
    // suficiente para a ilha ter enseada e ponta, e é o que separa terra de moeda.
    const rr = (a: number, base: number) => contornoIlha(k, a, base)
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2
      const R0 = (a: number) => rr(a, raio)           // linha d'água
      const R1 = (a: number) => rr(a, raio * 0.88)    // fim da praia
      const R2 = (a: number) => rr(a, raio * 0.70)    // trilha
      const R3 = (a: number) => rr(a, raio * 0.655)  // ⚠️ 4,5% do raio, não 8%:
                                                     // a trilha larga lia como
                                                     // pista de atletismo
      const R4 = (a: number) => rr(a, raio * (dsc ? 0.42 : 0.34))  // clareira
      // praia: da linha d'água para dentro, subindo
      B(COR_PRAIA).quad(p(R0(a0), a0, L.agua + 0.15), p(R0(a1), a1, L.agua + 0.15),
                        p(R1(a1), a1, L.agua + 1.5), p(R1(a0), a0, L.agua + 1.5))
      // mata: da praia até a trilha
      B(COR_MATO).quad(p(R1(a0), a0, L.agua + 1.5), p(R1(a1), a1, L.agua + 1.5),
                       p(R2(a1), a1, L.agua + 2.4), p(R2(a0), a0, L.agua + 2.4))
      // trilha: um anel de saibro, que é o que faz a ilha ser percorrível
      B(COR_TRILHA).quad(p(R2(a0), a0, L.agua + 2.6), p(R2(a1), a1, L.agua + 2.6),
                         p(R3(a1), a1, L.agua + 2.6), p(R3(a0), a0, L.agua + 2.6))
      // mata de novo, entre a trilha e a clareira
      B(COR_MATO).quad(p(R3(a0), a0, L.agua + 2.7), p(R3(a1), a1, L.agua + 2.7),
                       p(R4(a1), a1, L.agua + 3.0), p(R4(a0), a0, L.agua + 3.0))
      // ⚠️ A CLAREIRA DAS SETE RESERVADAS É GRAMADO E NÃO LAJE. Laje clara num
      // lote vazio lê como estacionamento; grama lê como terreno guardado.
      if (!dsc)
        B(COR_TERRA).quad(p(R4(a0), a0, L.agua + 3.1), p(R4(a1), a1, L.agua + 3.1),
                          p(0, a1, L.agua + 3.1), p(0, a0, L.agua + 3.1))
    }

    // ⚠️ AS ILHAS ERAM TAMPAS DE PAPEL. A praia delas começa em `L.agua + 0,15` e
    // não havia NADA entre essa borda e o fundo da bacia: de qualquer ângulo
    // raso a ilha era um disco de 15 cm de espessura boiando 6,65 m acima do
    // leito, e a lâmina passava por baixo dela. Uma parede por segmento resolve,
    // e custa 44 quads por ilha, 352 no total. Ela usa a MESMA `contornoIlha`
    // que a praia, senão a parede sai de um contorno e a areia de outro.
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2
      B(COR_TERRA).quad(
        p(rr(a0, raio), a0, L.agua + 0.15), p(rr(a1, raio), a1, L.agua + 0.15),
        p(rr(a1, raio), a1, L.fundo), p(rr(a0, raio), a0, L.fundo))
    }

    // ── o desembarque: a ponte de tábuas encontra a trilha ──────────────────
    //
    // ⚠️ ISTO É O MESMO DEFEITO DAS PONTES DO LAGO, EM MINIATURA. O píer parava
    // na areia e a trilha corria em anel sem tocar nele: quem desembarcava caía
    // no mato. Uma faixa radial de saibro costura os dois, e é o que transforma
    // praia + trilha + clareira em percurso em vez de três desenhos soltos.
    const aPier = anguloDesembarque(k)
    {
      const meia = 5.5 / raio                       // 5,5 m de meia-largura
      // ⚠️ A COTA DA FAIXA DE DESEMBARQUE VINHA DE UMA RAMPA RETA E ELA NÃO
      // ENCOSTAVA NA ILHA EM LUGAR NENHUM, e é a segunda margem deformada que
      // achei. A ilha é feita de patamares (clareira +3,1 / mata +2,7 a +3,0 /
      // trilha +2,6 / mata +1,5 a +2,4 / praia +0,15 a +1,5), e a faixa descia
      // de +3,0 a +2,5 em linha reta por cima de tudo: no começo ela ficava 10 cm
      // ENTERRADA na clareira, e na beira d'água (f 0,92) ficava +2,5 sobre uma
      // praia de +1,05, ou seja uma tábua de saibro flutuando 1,45 m acima da
      // areia, oito vezes, uma por ilha. Agora a cota SAI DO PATAMAR que está
      // embaixo, mais 5 cm, e o passo caiu de 10 para 22 porque com 10 cada
      // degrau saltava 45 cm perto da praia.
      const fCl = dsc ? 0.42 : 0.34
      const yTerraco = (f: number) => {
        if (f <= fCl) return L.agua + 3.1
        if (f <= 0.655) return L.agua + 3.0 - (0.3 * (f - fCl)) / (0.655 - fCl)
        if (f <= 0.70) return L.agua + 2.6
        if (f <= 0.88) return L.agua + 2.4 - (0.9 * (f - 0.70)) / 0.18
        return L.agua + 1.5 - (1.35 * (f - 0.88)) / 0.12
      }
      const passos = 22
      for (let j = 0; j < passos; j++) {
        const f0 = 0.30 + (0.64 * j) / passos, f1 = 0.30 + (0.64 * (j + 1)) / passos
        const q = (f: number, da: number) =>
          p(rr(aPier + da, raio * f), aPier + da, yTerraco(f) + 0.05)
        B(COR_TRILHA).quad(q(f0, -meia), q(f1, -meia), q(f1, meia), q(f0, meia))
      }
    }

    // ── o programa da Ilha do Dog Social Club ──────────────────────────────
    //
    // ⚠️ A CLAREIRA DELA ERA UMA LAJE BRANCA VAZIA OCUPANDO 40% DA ILHA, e um
    // vazio desse tamanho no meio de um cartão de visita não lê como reserva,
    // lê como esquecimento. As outras sete continuam guardadas (gramado, para o
    // projeto do parceiro entrar depois); esta é do Dog Social Club por decisão
    // do fundador, então ela é a única que já tem desenho.
    //
    // A composição é concêntrica e olha bem de cima, que é de onde a cidade é
    // vista: átrio de laje, banco corrido em anel, ESPELHO D'ÁGUA e pódio no
    // centro. O espelho repete a água do lago dentro da ilha, que é o truque que
    // faz a peça pertencer ao lago em vez de estar pousada nele.
    if (dsc) {
      const aro = (rf0: number, rf1: number, y0: number, y1: number, cor: string) => {
        for (let j = 0; j < seg; j++) {
          const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2
          B(cor).quad(p(rr(a0, raio * rf0), a0, y0), p(rr(a1, raio * rf0), a1, y0),
                      p(rr(a1, raio * rf1), a1, y1), p(rr(a0, raio * rf1), a0, y1))
        }
      }
      const Y0 = L.agua + 3.1
      aro(0.42, 0.345, Y0, Y0, COR_PISO)              // átrio
      aro(0.345, 0.335, Y0, Y0 + 0.55, COR_ESTRUTURA) // espelda do banco corrido
      aro(0.335, 0.315, Y0 + 0.55, Y0 + 0.55, COR_ESTRUTURA)
      aro(0.315, 0.305, Y0 + 0.55, Y0, COR_ESTRUTURA)
      // ⚠️ ESPELHO D'ÁGUA NO NÍVEL DO PISO É UM DISCO AZUL PINTADO. Sem parede
      // e sem recuo não há sombra na borda, e sem sombra na borda o olho lê
      // tinta e não líquido. A bacia desce 1,6 m e a lâmina fica 35 cm abaixo
      // do átrio: é o degrau que faz a água existir.
      aro(0.305, 0.295, Y0, Y0 - 1.6, COR_ESTRUTURA)  // a parede da bacia
      aro(0.295, 0.145, Y0 - 0.35, Y0 - 0.35, COR_AGUA)
      aro(0.145, 0.135, Y0 - 1.6, Y0 + 1.2, COR_PISO) // o pé do pódio, dentro da água
      aro(0.135, 0.0, Y0 + 1.2, Y0 + 1.2, COR_PISO)   // o pódio
      // os doze mastros do átrio: é o que dá altura e é o que se vê de longe
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2
        const mx = x + Math.cos(a) * rr(a, raio * 0.385), mz = z + Math.sin(a) * rr(a, raio * 0.385)
        for (let f = 0; f < 4; f++) {
          const b0 = (f / 4) * Math.PI * 2, b1 = ((f + 1) / 4) * Math.PI * 2
          const q = (bb: number, yy: number) => P(mx + Math.cos(bb) * 0.7, mz + Math.sin(bb) * 0.7, yy)
          B(COR_ESTRUTURA).quad(q(b0, Y0), q(b1, Y0), q(b1, Y0 + 15), q(b0, Y0 + 15))
        }
      }
    }

    // ⚠️ O PÍER APONTA PARA A PRAÇA, e não para um rumo qualquer: quem chega de
    // barco vem de lá, que é onde estão as pontes e a cidade velha.
    const dirX = -Math.sin(ang), dirZ = Math.cos(ang)
    const perX = Math.cos(ang), perZ = Math.sin(ang)
    const pIni = raio * 0.92, pFim = raio + 34, w = 4.5
    B(COR_ESTRUTURA).quad(
      P(x + dirX * pIni - perX * w, z + dirZ * pIni - perZ * w, L.agua + 1.4),
      P(x + dirX * pFim - perX * w, z + dirZ * pFim - perZ * w, L.agua + 1.4),
      P(x + dirX * pFim + perX * w, z + dirZ * pFim + perZ * w, L.agua + 1.4),
      P(x + dirX * pIni + perX * w, z + dirZ * pIni + perZ * w, L.agua + 1.4))
    // os pilares do píer, que é o que o faz ler como píer e não como tábua
    for (let j = 0; j <= 5; j++) {
      const t = pIni + ((pFim - pIni) * j) / 5
      for (const sgn of [-1, 1]) {
        const px2 = x + dirX * t + perX * w * 0.8 * sgn
        const pz2 = z + dirZ * t + perZ * w * 0.8 * sgn
        for (let f = 0; f < 4; f++) {
          const b0 = (f / 4) * Math.PI * 2, b1 = ((f + 1) / 4) * Math.PI * 2
          const q = (bb: number, yy: number) =>
            P(px2 + Math.cos(bb) * 0.5, pz2 + Math.sin(bb) * 0.5, yy)
          B(COR_ESTRUTURA).quad(q(b0, L.fundo), q(b1, L.fundo), q(b1, L.agua + 1.4), q(b0, L.agua + 1.4))
        }
      }
    }
  }

  // ── 5. uma malha por cor ─────────────────────────────────────────────────
  const feitas: THREE.Mesh[] = []
  let triangulos = 0
  baldes.forEach((b, cor) => {
    if (!b.ix.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.vs, 3))
    g.setIndex(b.ix)
    g.computeVertexNormals()
    const agua = cor === COR_AGUA
    const mat = new THREE.MeshStandardMaterial({
      color: cor,
      // ⚠️ ÁGUA COM roughness 0,08 E metalness 0,35 NÃO LÊ COMO ÁGUA AQUI, e
      // isso foi medido na chapa: quase espelho, ela devolve o hemisfério claro
      // da cena inteira e some, virando uma chapa PÁLIDA que parece areia. O
      // valor de piscina de 60 m não serve numa lâmina de 293 ha vista de 400 m.
      // Com 0,30 e 0,02 a cor base manda e o brilho vira reflexo de sol e não
      // fundo de céu.
      roughness: agua ? 0.30 : 0.92,
      metalness: agua ? 0.02 : 0,
      side: THREE.DoubleSide,
    })
    if (look2) vestirVerde(g, mat, cor)
    const m = new THREE.Mesh(g, mat)
    m.name = `lago:${agua ? 'agua' : cor}`
    m.receiveShadow = !agua
    m.castShadow = (o.sombra ?? true) && !agua
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
    triangulos += b.ix.length / 3
  })

  // ── 5b. A MALHA DA AREIA, QUE NÃO CABE NO BALDE ─────────────────────────
  // ⚠️ QUATRO COMPONENTES DE COR, e o three só respeita o alfa da cor por
  // vértice se o material for `transparent`. Com itemSize 3 o alfa simplesmente
  // não existe e a faixa volta a acabar em aresta. O `Balde` só carrega
  // `position`, por isso a areia tem malha própria: uma chamada de desenho a
  // mais, e é a única do trabalho inteiro.
  if (idxAr.length) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(posAr, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(corAr, 4))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvAr, 2))
    g.setIndex(idxAr)
    g.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      vertexColors: true,
      // ⚠️ TRANSPARENTE, MAS SEM ESCREVER PROFUNDIDADE. A faixa é pintada por
      // cima do chão que está a 6 cm dela, que é o que a areia faz; com
      // `depthWrite` ligado as duas brigariam em z na margem inteira.
      transparent: true,
      depthWrite: false,
    })
    // ⚠️ SÓ NORMAL E RUGOSIDADE, O ALBEDO SE DESCARTA. A cor por vértice
    // MULTIPLICA o mapa: areia clara vezes o albedo do regolito daria cinza
    // sujo, e compensar exigiria clarear até estourar. Textura COMPARTILHADA do
    // cache: nenhum upload novo de GPU, e o `customProgramCacheKey` de
    // `quebrarRepeticao` mantém tudo num programa só.
    const sup = superficie('regolito')
    mat.normalMap = sup.normalMap
    mat.roughnessMap = sup.roughnessMap
    // ⚠️ NORMAL FRACO DE PROPÓSITO: luz rasante na Lua amplifica normal, e a
    // margem é vista quase sempre rasante. No valor cheio a areia vira lixa.
    const f = sup.normalScale * 0.55
    mat.normalScale = new THREE.Vector2(f, f)
    quebrarRepeticao(mat, 110)
    const m = new THREE.Mesh(g, mat)
    m.name = 'lago:areia'
    m.receiveShadow = true
    // ⚠️ AREIA NÃO PROJETA SOMBRA: é uma fita deitada no chão, a sombra dela cai
    // nela mesma, e ela pagaria passe de mapa de sombra em 8 km de margem.
    m.castShadow = false
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
    triangulos += idxAr.length / 3
  }

  const areaHa = (Math.PI * (rAguaE * rAguaE - rAguaI * rAguaI)) / 1e4
  const relogios = feitas.map((m) => aguaDeVerdade(m)).filter(Boolean) as { value: number }[]
  return {
    group, pontes, ilhas, areaHa, triangulos,
    update(t: number) { for (const u of relogios) u.value = t },
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}

/**
 * ⚠️ ÁGUA NÃO É UMA COR, É UM COMPORTAMENTO, e foi por não entender isso que eu
 * gastei três tentativas trocando o azul. Um MeshStandardMaterial azul liso é
 * uma CHAPA azul: de cima ela é do tom que se escreveu e de raso ela continua do
 * mesmo tom, o que nenhum líquido faz. O que faz o olho reconhecer água são
 * três coisas, e nenhuma delas é a cor:
 *
 *   1. FRESNEL. Olhando de cima você vê o corpo d'água (escuro); olhando de raso
 *      ela devolve o céu (claro). É o contraste entre esses dois extremos DENTRO
 *      da mesma lâmina que diz "isto é líquido".
 *   2. ONDULAÇÃO. Duas cristas cruzadas de período longo (26 e 40 m) inclinam a
 *      normal alguns graus. Não se vê a onda; vê-se o brilho do sol se partindo
 *      nela, e é isso que tira a cara de vidro parado.
 *   3. MOVIMENTO. As cristas andam. Uma lâmina parada num plano de 293 ha lê
 *      como piso polido.
 *
 * Tudo isso cabe em `onBeforeCompile`: zero draw call novo, zero material novo,
 * zero pós-processamento. A cena já compila 228 programas com teto medido de 235,
 * e um Reflector de verdade (que redesenha a cena por espelho) está proibido pela
 * spec da maquete, decisão D10.
 */
// ⚠️ EXPORTADO PARA OS CANAIS USAREM O MESMO COMPORTAMENTO. Água de canal com
// outro shader ficaria de outra cor e outro brilho ao lado da água do lago, e
// os dois se encontram: o canal desagua nele.
export function aguaDeVerdade(m: THREE.Mesh): { value: number } | null {
  if (!m.name.endsWith(':agua')) return null
  const mat = m.material as THREE.MeshStandardMaterial
  const uTempo = { value: 0 }
  // no look 2 a lâmina ganha o campo de margem antes de o shader existir
  // ⚠️ SÓ A LÂMINA DOS LAGOS RECEBE A COSTA DAS ILHAS. O canal tem 60 m de
  // largura e a sua própria margem a 30 m, então a ilha a 5 km nunca seria o
  // mínimo; o que se evita aqui é inflar o balde de segmentos de dois corpos
  // que não têm nada a ganhar com isso.
  const campo = look2 ? campoDeMargem(m.geometry, m.name === 'lagos:agua') : null
  if (campo) {
    mat.transparent = true
    // ⚠️ `depthWrite` FICA LIGADO mesmo com transparência. A lâmina é uma casca
    // única e quase plana, sem sobreposição consigo mesma, então escrever
    // profundidade não cria erro de ordem e evita que a água deixe de ocluir o
    // que está atrás dela (barranco do outro lado, ilha, pilar de ponte).
    mat.depthWrite = true
  }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = uTempo
    if (campo) {
      sh.uniforms.uProfRef = { value: campo.ref }
      sh.uniforms.uEsc = { value: campo.esc }
      aplicarProfundidade(sh)
      return
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoAgua;')
      .replace('#include <begin_vertex>',
               '#include <begin_vertex>\nvMundoAgua = (modelMatrix * vec4(position, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
               '#include <common>\nuniform float uTempo;\nvarying vec3 vMundoAgua;')
      // a ondulação entra DEPOIS de a normal existir e ANTES de a luz ser somada
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        float ondaA = sin(vMundoAgua.x * 0.241 + uTempo * 0.62);
        float ondaB = sin(vMundoAgua.z * 0.157 - uTempo * 0.44);
        float ondaC = sin((vMundoAgua.x + vMundoAgua.z) * 0.083 + uTempo * 0.31);
        normal = normalize(normal + vec3(ondaA * 0.052 + ondaC * 0.021, 0.0,
                                         ondaB * 0.052 - ondaC * 0.019));
      `)
      // o fresnel entra no fim, sobre a cor já iluminada
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float cosI = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
        float fres = pow(1.0 - cosI, 3.2);
        vec3 ceu = vec3(0.42, 0.52, 0.60);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, ceu, fres * 0.62);
      `)
  }
  // ⚠️ CHAVE FIXA, e ela é obrigatória: sem `customProgramCacheKey` o three
  // compila UM programa por material com `onBeforeCompile`, numa cena que já
  // compila 228 programas com teto medido em 235. As três águas (lago, baía,
  // canais) dividem o mesmo programa por look.
  mat.customProgramCacheKey = () => (campo ? 'agua-prof-v2' : 'agua-v1')
  mat.needsUpdate = true
  return uTempo
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFUNDIDADE: por que a lâmina lia como adesivo, e por qual caminho ela deixou
// de ler.
//
// O defeito, medido em chapa em 01/09: a água era azul UNIFORME até encostar na
// margem. Água rasa e água funda chegavam ao olho com a mesma cor e a mesma
// opacidade, e o que vende água num render não é a onda, é o gradiente de
// profundidade: clara e translúcida onde é raso, escura e opaca onde é fundo.
// Sem esse gradiente, qualquer margem parece adesivo colado no chão.
//
// ⚠️ O BUFFER DE PROFUNDIDADE DA CENA FOI DESCARTADO, e não por gosto. Ele daria
// água que responde a qualquer coisa submersa, mas: (1) exige um passe extra da
// cena inteira num alvo de profundidade, e a cena tem 6,3 M de triângulos a 36
// fps, ou seja o passe custaria a ordem de um quadro; (2) o renderer liga
// `logarithmicDepthBuffer`, então a leitura precisaria desfazer a curva
// logarítmica antes de virar metro, e errar esse passo dá um gradiente plausível
// e falso; (3) nada disso cabe na assinatura `aguaDeVerdade(mesh)`, que a baía e
// os canais já consomem: precisaria do renderer e do laço de render.
//
// ⚠️ E A SONDA DO TERRENO TAMBÉM FOI DESCARTADA, apesar de `heightAt` existir nos
// três chamadores. Ela mede a profundidade DE VERDADE, mas o leito destes três
// corpos é escavado quase plano (bacia do lago a −26 com lâmina a −17, vala de
// canal com fundo fixo): amostrar o terreno devolve profundidade CONSTANTE, que
// é exatamente o defeito que se quer corrigir. Ela só teria o que dizer no leito
// natural da baía.
//
// O que sobrou é o que a própria malha já sabe: a DISTÂNCIA ATÉ A MARGEM. A
// margem é o contorno da lâmina, e o contorno se extrai da topologia, sem
// terreno e sem passe extra: aresta que pertence a um só triângulo é borda.
// Distância até a borda é um proxy honesto de profundidade em corpo escavado, e
// tem a propriedade que interessa: escala sozinha. Numa baía de 20,5 km² a
// referência sai em centenas de metros, num canal de 60 m sai em ~15.
// ═══════════════════════════════════════════════════════════════════════════

/** distância no plano XZ de um ponto até um segmento */
function distSeg(px: number, pz: number,
                 ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az
  const ll = dx * dx + dz * dz
  let t = ll > 0 ? ((px - ax) * dx + (pz - az) * dz) / ll : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = ax + dx * t - px, qz = az + dz * t - pz
  return Math.hypot(qx, qz)
}

/**
 * Escreve no `aDist` da malha, em METROS, a distância de cada vértice até a
 * margem, e devolve a escala do corpo d'água. Trabalha em três tempos:
 *
 *   1. SOLDA por posição arredondada e conta aresta. Aresta de contagem 1 é
 *      margem. ⚠️ A solda é obrigatória: as três lâminas nascem de um acumulador
 *      de quads que DUPLICA todo vértice, então contar aresta por índice daria
 *      contagem 1 em todas elas e a malha inteira viraria margem.
 *   2. ADENSA onde o triângulo é grande e está perto da margem, porque `aDist` é
 *      varying: um quad de canal com 60 m de vão tem os dois vértices na margem,
 *      distância 0 nos dois, e interpola zero no meio do canal.
 *   3. MEDE a distância de cada vértice à borda mais próxima, com as arestas de
 *      margem indexadas numa grade, senão são 91 mil vértices contra alguns
 *      milhares de arestas.
 */
function campoDeMargem(geo: THREE.BufferGeometry, comIlhas = false): { ref: number; esc: number } | null {
  const pos = geo.getAttribute('position')
  if (!pos) return null
  const idx = geo.getIndex()
  const nTri = (idx ? idx.count : pos.count) / 3
  if (nTri < 1) return null
  const vi = (k: number) => (idx ? idx.getX(k) : k)

  // ── 1. margem por contagem de aresta, com solda a 5 cm ────────────────────
  const CH = (i: number) => `${Math.round(pos.getX(i) * 20)},${Math.round(pos.getZ(i) * 20)}`
  const chave: string[] = new Array(pos.count)
  for (let i = 0; i < pos.count; i++) chave[i] = CH(i)
  const conta = new Map<string, number>()
  for (let t = 0; t < nTri; t++) {
    for (let e = 0; e < 3; e++) {
      const a = chave[vi(t * 3 + e)], b = chave[vi(t * 3 + ((e + 1) % 3))]
      if (a === b) continue
      const k = a < b ? `${a}|${b}` : `${b}|${a}`
      conta.set(k, (conta.get(k) ?? 0) + 1)
    }
  }
  const seg: number[] = []          // ax, az, bx, bz
  for (let t = 0; t < nTri; t++) {
    for (let e = 0; e < 3; e++) {
      const ia = vi(t * 3 + e), ib = vi(t * 3 + ((e + 1) % 3))
      const a = chave[ia], b = chave[ib]
      if (a === b) continue
      const k = a < b ? `${a}|${b}` : `${b}|${a}`
      if (conta.get(k) !== 1) continue
      seg.push(pos.getX(ia), pos.getZ(ia), pos.getX(ib), pos.getZ(ib))
    }
  }
  // ⚠️ A COSTA DAS ILHAS ENTRA AQUI COMO MARGEM, e é isto que dá o halo de raso.
  //
  // O defeito, medido e relatado duas rodadas antes de ser consertado: a lâmina
  // da baía é uma casca CONTÍNUA, sem furo onde as ilhas estão, então a margem
  // que este trecho extrai por topologia é só o contorno EXTERNO da baía. Com
  // `uProfRef` no teto de 150 m, a opacidade satura a −150·ln(0,42) ≈ 130 m da
  // margem; a ilha mais próxima da costa está a 275 m dela. Resultado: em volta
  // de toda ilha a água chegava cheia, opaca e escura até encostar na praia, e a
  // ilha lia como adesivo recortado colado sobre azul.
  //
  // ⚠️ E O CONSERTO NÃO É FURAR A MALHA. Furar exigiria recortar a lâmina no
  // contorno de 25 ilhas, o que muda a triangulação da baía inteira e mexe em
  // `lagos.ts`. Não é preciso: a lâmina passa POR BAIXO da ilha e a ilha a
  // esconde, então o único lugar em que o furo faria diferença é este, o CAMPO
  // DE DISTÂNCIA. Injetar os segmentos custa uma concatenação e devolve
  // exatamente o gradiente que o furo devolveria.
  //
  // ⚠️ A LISTA VEM MEMOIZADA E JÁ EM COORDENADA DE MUNDO (`contornosIlhas`), e o
  // custo dela é o campo de altura das ilhas, que o módulo das ilhas geraria de
  // qualquer jeito. Se as ilhas estiverem desligadas, a lista volta vazia.
  if (comIlhas) {
    const ilhas = contornosIlhas()
    for (let k = 0; k < ilhas.length; k += 4) {
      seg.push(ilhas[k], ilhas[k + 1], ilhas[k + 2], ilhas[k + 3])
    }
  }
  if (!seg.length) return null

  // ── 3a. grade das arestas de margem, para a consulta não ser O(V x B) ─────
  const CEL = 48
  const balde = new Map<number, number[]>()
  const cel = (v: number) => Math.floor(v / CEL)
  const KG = (i: number, j: number) => i * 100003 + j
  for (let s = 0; s < seg.length; s += 4) {
    const i0 = cel(Math.min(seg[s], seg[s + 2])), i1 = cel(Math.max(seg[s], seg[s + 2]))
    const j0 = cel(Math.min(seg[s + 1], seg[s + 3])), j1 = cel(Math.max(seg[s + 1], seg[s + 3]))
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = KG(i, j)
        const l = balde.get(k); if (l) l.push(s); else balde.set(k, [s])
      }
    }
  }
  // ⚠️ A CAIXA DAS CÉLULAS OCUPADAS, e ela existe só para o laço abaixo PARAR.
  // Sem ela, um ponto longe de qualquer margem (miolo da baía, ou fora dela)
  // nunca acha bucket, `best` fica infinito e a busca caminha os 60 anéis
  // inteiros colecionando falha de Map.
  let gi0 = Infinity, gi1 = -Infinity, gj0 = Infinity, gj1 = -Infinity
  for (let s = 0; s < seg.length; s += 4) {
    const a = cel(Math.min(seg[s], seg[s + 2])), b = cel(Math.max(seg[s], seg[s + 2]))
    const c = cel(Math.min(seg[s + 1], seg[s + 3])), d = cel(Math.max(seg[s + 1], seg[s + 3]))
    if (a < gi0) gi0 = a; if (b > gi1) gi1 = b
    if (c < gj0) gj0 = c; if (d > gj1) gj1 = d
  }

  const dist = (x: number, z: number): number => {
    const ci = cel(x), cj = cel(z)
    let best = Infinity
    // ⚠️ ISTO CUSTAVA 62,2% DE TODA A CPU DO BOOT DA CIDADE, medido em 02/09 com
    // o Profiler do CDP: 47,6 s de 76,5 s locais, e o mesmo perfil em produção
    // com a página levando 147 s para abrir o portão.
    //
    // O defeito era de laço, não de algoritmo. A intenção sempre foi percorrer
    // o ANEL de células no raio `r`, mas o código varria o QUADRADO inteiro
    // (`i` e `j` de -r a +r) e jogava fora o miolo com um `continue`. Somando
    // r de 0 a 59 isso é Σ(2r+1)² = 287.980 visitas de célula para aproveitar
    // Σ8r = 14.161: **20,3 vezes mais trabalho do que o necessário**, e o
    // desperdício cresce com o QUADRADO do raio, então ele explode exatamente
    // nos pontos longe da margem, que são a maioria da lâmina.
    //
    // Agora as quatro bordas do anel são caminhadas diretamente. Mesma ordem de
    // visita, mesmo resultado, sem o miolo.
    for (let r = 0; r < 60; r++) {
      if (best < Infinity && (r - 1) * CEL > best) break
      // o anel já contém toda a caixa ocupada: nenhum anel maior pode achar nada
      if (best === Infinity && ci - r < gi0 && ci + r > gi1 && cj - r < gj0 && cj + r > gj1) break
      const visita = (i: number, j: number) => {
        const l = balde.get(KG(i, j)); if (!l) return
        for (const s of l) {
          const d = distSeg(x, z, seg[s], seg[s + 1], seg[s + 2], seg[s + 3])
          if (d < best) best = d
        }
      }
      if (r === 0) { visita(ci, cj); continue }
      for (let i = ci - r; i <= ci + r; i++) { visita(i, cj - r); visita(i, cj + r) }
      for (let j = cj - r + 1; j <= cj + r - 1; j++) { visita(ci - r, j); visita(ci + r, j) }
    }
    return best === Infinity ? 0 : best
  }

  // ⚠️ O MEMO NASCIA TARDE DEMAIS. Ele vivia lá embaixo, no trecho 3b, então o
  // laço de bissecção (sete passes, três cantos por triângulo, dezenas de
  // milhares de triângulos) chamava `dist` CRU. E canto de triângulo é o caso
  // com mais reuso que existe aqui: numa malha, cada vértice pertence a vários
  // triângulos, e a bissecção reavalia os mesmos cantos passe após passe.
  // Subindo o memo, os dois consumidores dividem o mesmo cache.
  const memo = new Map<string, number>()
  const dCache = (x: number, z: number) => {
    const k = `${Math.round(x * 4)},${Math.round(z * 4)}`
    let v = memo.get(k); if (v === undefined) { v = dist(x, z); memo.set(k, v) }
    return v
  }

  // ── 2. adensamento por bisseção da aresta mais longa ──────────────────────
  //
  // ⚠️ BISSECÇÃO DA ARESTA MAIS LONGA, não subdivisão 1 para 4. A 1 para 4
  // quadruplica por passe e estoura o orçamento em dois passes; a bissecção
  // dobra. E ela só entra onde vale: triângulo grande PERTO da margem. No miolo
  // da baía o gradiente já está achatado pela exponencial e ninguém vê a
  // diferença.
  //
  // ⚠️ Isto deixa junção em T entre triângulos vizinhos, e isso é aceito de
  // propósito: as três lâminas são planas ou quase, então não abre fenda
  // geométrica, e a diferença de `aDist` no meio de uma aresta partida é
  // centimétrica dentro de um campo que vale metros.
  const tri: number[] = []          // 6 números por triângulo: x,z de cada canto
  const alt: number[] = []          // a cota, que é linear e vai junto
  for (let t = 0; t < nTri; t++) {
    for (let e = 0; e < 3; e++) {
      const i = vi(t * 3 + e)
      tri.push(pos.getX(i), pos.getZ(i)); alt.push(pos.getY(i))
    }
  }
  // ⚠️ O TETO SUBIU DE +18.000 PARA +34.000 JUNTO COM O HALO DAS ILHAS, e a razão
  // é que o adensamento só entra onde o triângulo é grande E está perto da
  // margem. Com 25 ilhas injetadas, "perto da margem" passou a incluir 74,67 km
  // de costa nova no meio da baía: com o teto antigo o orçamento se gastava nas
  // ilhas e a orla EXTERNA da baía perdia o gradiente que já tinha. Os 16.000
  // triângulos a mais valem 0,25% de uma cena de 6,3 M.
  const TETO = nTri + 34000
  const LADO = 18, PERTO = 45
  for (let passe = 0; passe < 7; passe++) {
    if (tri.length / 6 >= TETO) break
    let partiu = false
    const nT = tri.length / 6
    for (let t = 0; t < nT; t++) {
      if (tri.length / 6 >= TETO) break
      const o = t * 6, oy = t * 3
      const px = [tri[o], tri[o + 2], tri[o + 4]], pz = [tri[o + 1], tri[o + 3], tri[o + 5]]
      const py = [alt[oy], alt[oy + 1], alt[oy + 2]]
      let pior = -1, comp = 0
      for (let e = 0; e < 3; e++) {
        const f = (e + 1) % 3
        const c = Math.hypot(px[f] - px[e], pz[f] - pz[e])
        if (c > comp) { comp = c; pior = e }
      }
      if (comp <= LADO) continue
      const perto = Math.min(dCache(px[0], pz[0]), dCache(px[1], pz[1]), dCache(px[2], pz[2]))
      if (perto > PERTO) continue
      const a = pior, b = (pior + 1) % 3, c = (pior + 2) % 3
      const mx = (px[a] + px[b]) / 2, mz = (pz[a] + pz[b]) / 2, my = (py[a] + py[b]) / 2
      // o triângulo original vira a metade a-m-c
      tri[o] = px[a]; tri[o + 1] = pz[a]; alt[oy] = py[a]
      tri[o + 2] = mx; tri[o + 3] = mz; alt[oy + 1] = my
      tri[o + 4] = px[c]; tri[o + 5] = pz[c]; alt[oy + 2] = py[c]
      // e a outra metade m-b-c entra no fim
      tri.push(mx, mz, px[b], pz[b], px[c], pz[c]); alt.push(my, py[b], py[c])
      partiu = true
    }
    if (!partiu) break
  }

  // ── 3b. grava posição, `aDist` e a escala do corpo ────────────────────────
  const nF = alt.length / 3
  const np = new Float32Array(nF * 9)
  const nd = new Float32Array(nF * 3)
  const todas: number[] = []
  for (let t = 0; t < nF; t++) {
    for (let e = 0; e < 3; e++) {
      const x = tri[t * 6 + e * 2], z = tri[t * 6 + e * 2 + 1], y = alt[t * 3 + e]
      np[t * 9 + e * 3] = x; np[t * 9 + e * 3 + 1] = y; np[t * 9 + e * 3 + 2] = z
      const d = dCache(x, z)
      nd[t * 3 + e] = d
      todas.push(d)
    }
  }
  geo.setIndex(null)
  geo.setAttribute('position', new THREE.BufferAttribute(np, 3))
  geo.setAttribute('aDist', new THREE.BufferAttribute(nd, 1))
  if (geo.getAttribute('normal')) geo.deleteAttribute('normal')
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv')
  geo.computeVertexNormals()
  geo.computeBoundingSphere()

  // ⚠️ A REFERÊNCIA É PERCENTIL, NÃO MÁXIMO. O máximo de uma baía é o ponto mais
  // longe de qualquer margem e não descreve nada: com ele a curva ficaria rasa
  // no corpo inteiro. O percentil 65 é o "meio da água" e faz o mesmo material
  // servir uma baía de quilômetros e um canal de 60 m sem constante por corpo.
  todas.sort((a, b) => a - b)
  const bruto = todas[Math.floor(todas.length * 0.65)] || 12
  const ref = Math.max(5, Math.min(150, bruto))
  // e a onda encolhe com o corpo: crista de 26 m num canal de 60 m é maré
  const esc = Math.max(1, Math.min(3.4, 90 / Math.max(8, bruto)))
  return { ref, esc }
}

/** o shader completo do look 2: onda em escala do corpo, profundidade, borda molhada */
function aplicarProfundidade(sh: { vertexShader: string; fragmentShader: string }) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>',
             '#include <common>\nattribute float aDist;\nvarying float vDist;\nvarying vec3 vMundoAgua;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vMundoAgua = (modelMatrix * vec4(position, 1.0)).xyz;
      vDist = aDist;
    `)
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uTempo;
      uniform float uProfRef;
      uniform float uEsc;
      varying float vDist;
      varying vec3 vMundoAgua;
      float profDaAgua() { return 1.0 - exp(-max(vDist, 0.0) / uProfRef); }
    `)
    // ⚠️ raso é liso e fundo é fosco, e não o contrário: o filme de água sobre a
    // areia é quase espelho, e a lâmina funda é picada pela onda inteira.
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.11, 0.34, profDaAgua());
    `)
    // a ondulação entra DEPOIS de a normal existir e ANTES de a luz ser somada
    .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      float prof = profDaAgua();
      float f = uEsc;
      vec2 pw = vMundoAgua.xz;
      float dv = length(vViewPosition);
      // ⚠️ VELUDO COTELÊ: A CAUSA ERA O CANAL, NÃO O RUMO. A versão de três
      // cristas mandava a inclinação para vec3(ondaA + ondaC, 0, ondaB + ondaC):
      // o X carregava uma senoide dominante de 26 m e o Z outra de 40 m,
      // INDEPENDENTES do rumo em que cada crista viajava. Sob luz direcional só
      // conta a componente da normal no azimute do sol, então um dos dois canais
      // manda sozinho e o que chega na tela é UMA senoide pura: faixas paralelas
      // regulares, que é exatamente o tecido que o fundador viu na rasante.
      // Girar os rumos matou o xadrez e não podia matar a listra, porque a
      // listra nasce da separação por eixo e não do ângulo entre as cristas.
      // Agora cada crista inclina a normal NO PRÓPRIO RUMO dela, que é o que
      // onda faz, e nenhum azimute de sol consegue isolar uma senoide só.
      //
      // ⚠️ E O ESPECTRO NÃO PODE TER RAZÃO SIMPLES. Os períodos velhos eram 26,1,
      // 40,0 e 75,7 m: 75,7 / 26,1 = 2,90, quase 3, e duas senoides quase em
      // razão inteira voltam a somar em fase a cada ~78 m e desenham banda larga
      // por cima da fina. Os cinco de agora (7,9 / 11,3 / 17,7 / 28,3 / 46,1 m)
      // não têm razão perto de inteiro entre nenhum par.
      //
      // ⚠️ E ÁGUA REAL NÃO TEM AMPLITUDE CONSTANTE. Mesmo com cinco cristas, cinco
      // senoides de amplitude fixa cobrem o corpo inteiro com a mesma agitação,
      // e regularidade em campo grande volta a ler como tecido. O termo raj e um campo
      // de rajada de 556 por 722 m que abre manchas de calmaria: é o termo que
      // mais tira a cara de padrão, e custa duas senoides.
      //
      // Custo: 7 senoides no fragmento contra 3. NÃO MEDIDO em quadro; a lâmina
      // é fragmento puro, zero chamada nova e zero programa novo.
      float raj = 0.62 + 0.38 * sin(dot(pw, vec2(0.71, 0.70)) * 0.0113 + uTempo * 0.10)
                              * sin(dot(pw, vec2(-0.66, 0.75)) * 0.0087 - uTempo * 0.08);
      // ⚠️ A MORTE POR DISTÂNCIA É POR BANDA, e tem de ser: crista de 7,9 m mede
      // menos que um pixel muito antes da de 46 m. Amortecer todas na mesma
      // janela ou deixa a curta serrilhando de longe, ou apaga a longa de perto.
      float dCurta = mix(1.0, 0.05, smoothstep(160.0, 800.0, dv));
      float dMedia = mix(1.0, 0.10, smoothstep(400.0, 1600.0, dv));
      float dLonga = mix(1.0, 0.16, smoothstep(900.0, 3000.0, dv));
      vec2 d1 = vec2(0.974, 0.225);   // 13 graus
      vec2 d2 = vec2(0.629, 0.777);   // 51
      vec2 d3 = vec2(0.035, 0.999);   // 88
      vec2 d4 = vec2(-0.588, 0.809);  // 126
      vec2 d5 = vec2(-0.956, 0.292);  // 163
      float o1 = sin(dot(pw, d1) * 0.795 * f - uTempo * 1.51 * f);
      float o2 = sin(dot(pw, d2) * 0.556 * f + uTempo * 1.22 * f);
      float o3 = sin(dot(pw, d3) * 0.355 * f - uTempo * 0.96 * f);
      float o4 = sin(dot(pw, d4) * 0.222 * f + uTempo * 0.73 * f);
      float o5 = sin(dot(pw, d5) * 0.136 * f - uTempo * 0.54 * f);
      vec2 incl = d1 * (o1 * 0.026 * dCurta)
                + d2 * (o2 * 0.023 * dCurta)
                + d3 * (o3 * 0.020 * dMedia)
                + d4 * (o4 * 0.016 * dLonga)
                + d5 * (o5 * 0.013 * dLonga);
      // onda de beira quase não existe: o fundo trava a lâmina
      float amp = mix(0.22, 1.0, prof);
      // ⚠️ E CORPO PEQUENO NÃO FAZ ONDA GRANDE. uEsc já encurta o período, mas
      // encurtar sem baixar a altura dá uma vala de 60 m com mar de fundo. A
      // altura cai junto com o tamanho do corpo: canal abrigado, baía aberta.
      amp *= mix(1.0, 0.45, clamp((uEsc - 1.0) / 2.4, 0.0, 1.0));
      amp *= raj;
      normal = normalize(normal + amp * vec3(incl.x, 0.0, incl.y));
    `)
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float profF = profDaAgua();
      // a cor: o raso deixa o leito passar e clareia, o fundo fecha em azul
      vec3 raso  = gl_FragColor.rgb * 1.42 + vec3(0.020, 0.048, 0.044);
      vec3 fundo = gl_FragColor.rgb * 0.44;
      gl_FragColor.rgb = mix(raso, fundo, profF);
      // o fresnel entra sobre a cor já iluminada, e ele é do corpo d'água: no
      // raso quem manda é o leito, não o céu
      float cosI = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
      float fres = pow(1.0 - cosI, 3.2);
      vec3 ceu = vec3(0.42, 0.52, 0.60);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, ceu, fres * 0.62 * mix(0.30, 1.0, profF));
      // A BORDA MOLHADA: uma faixa de 3,4 m onde a lâmina some, o que sobra é o
      // filme escuro por cima da areia. Isto é a linha d'água, e de perto é o
      // detalhe que mais convence.
      //
      // ⚠️ ELA ENTRA DEPOIS DO FRESNEL, e a ordem foi medida na rasante a 4 m da
      // beira. Antes dele, o rasante zera a conta: na beira o cosI vai a zero, o
      // fresnel mistura 62% de céu por cima e apaga tanto a faixa molhada quanto
      // o tom do raso. Vista de cima nada mudava, e foi por isso que passou.
      float molhada = 1.0 - smoothstep(0.0, 3.4, vDist);
      gl_FragColor.rgb *= mix(1.0, 0.70, molhada);
      // e a opacidade, que é o que separa raso de fundo antes de qualquer cor
      // ⚠️ O PISO É 0,32 E NÃO 0,24: com 0,24 o trecho raso do canal virava um
      // vidro pálido por cima do regolito e perdia a leitura de água. Água rasa
      // é translúcida, não é ausente.
      // ⚠️ E O GANHO DE FRESNEL NA OPACIDADE TAMBÉM É DO FUNDO. Sem o profF
      // ele fechava a lâmina rasa em ângulo raso, que é o único ângulo de onde
      // se olha a beira andando por ela, e a areia submersa sumia de novo.
      gl_FragColor.a *= mix(0.32, 1.0, smoothstep(0.0, 0.58, profF))
                      + fres * 0.35 * mix(0.20, 1.0, profF);
      gl_FragColor.a = clamp(gl_FragColor.a, 0.0, 1.0);
    `)
}
