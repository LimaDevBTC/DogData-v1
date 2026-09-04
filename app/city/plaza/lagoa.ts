// ═══════════════════════════════════════════════════════════════════════════
// A LAGOA ALPINA: A ÁGUA.
//
// Pedido do fundador na rodada da montanha, palavra por palavra: "a cadeia de
// montanhas que são características de lagos, e gostaria de floresta e lagoa
// naquela região". A floresta já subiu com a frente do relevo; isto aqui é a
// água que faltava.
//
// A BACIA NÃO É DESTE ARQUIVO. Quem escava é `inverno.ts` (ver a seção "A
// LAGOA ALPINA: a BACIA"), que publica `LAGOA_CENTRO`, `LAGOA_RAIO` e
// `LAGOA_COTA`. Este módulo IMPORTA os três em vez de copiar número: se o
// relevo se mexer na próxima rodada, a lâmina acompanha sozinha, e um valor
// craveado aqui seria exatamente o tipo de dívida que já custou 242 m de erro
// nas vistas de `chapas.mjs` nesta mesma rodada.
//
// ── POR QUE NÃO DÁ PARA REAPROVEITAR `lagos.ts` ────────────────────────────
// A água da cidade nasce de um FLOOD-FILL abaixo de uma cota única (−40 m por
// padrão). A lâmina daqui vive a 407 m de altitude, medidos: para o detector
// de `lagos.ts` achar esta bacia seria preciso cavar um buraco de 447 m no
// meio do maciço. E a cor de lá é uma constante da cidade inteira (`COR_AGUA`
// #1D4A66, luminância relativa 0,0612), com praia de AREIA CLARA automática em
// toda cratera fora da baía. Lagoa alpina não é isso: é água escura e parada,
// com margem de rocha molhada e mata encostando. Por isso ela tem malha, cor,
// shader e consulta próprios.
//
// ── A GEOGRAFIA, MEDIDA OFFLINE (`tsx`, `superficieAt` real, sem navegador) ─
//   lâmina, em grade de 1 m     5,42 ha (54.208 m²)
//   lâmina, na malha construída 5,47 ha (54.652 m²)
//   profundidade                11,37 m média, 20,72 m máxima
//   linha d'água por rumo       121,5 m no mínimo, 154,5 m no máximo, 131,0 m
//                               de média (360 rumos, passo de 0,5 m)
//   lábio mais baixo em volta   412,9 m, ou seja +5,9 m sobre a lâmina
//   malha                       9.472 triângulos (6.912 de água, 2.560 de margem)
//
// Os 444 m² a mais da malha são a sobra de 0,6 m com que a lâmina entra por
// baixo do barranco (ver `LAMINA_SOBRA`): é área desenhada e escondida, de
// propósito, não área de água. O número que vale como "tamanho da lagoa" é o
// da grade.
//
// A linha d'água oscilar 33 m entre rumos é o motivo de a lâmina NÃO ser um
// disco: um disco de 154 m flutuaria sobre terra seca no rumo em que a margem
// fecha em 121, e um disco de 121 deixaria um anel de leito exposto de 33 m no
// rumo oposto. A malha daqui é um leque em que o raio de cada rumo é MEDIDO no
// `heightAt` de verdade, na hora de construir.
//
// ── ⚠️ A ARMADILHA QUE ESTE ARQUIVO NÃO CONSEGUE FECHAR SOZINHO ────────────
// `inverno.ts` é o único sistema vizinho do maciço que não consulta
// `lagos.naAgua`. A frente do relevo já defendeu as duas semeaduras que moram
// DENTRO dele (a floresta e o penhasco, ambas com uma guarda de cota privada),
// e o número que isso vale está medido: rodando `gerarCandidatosFloresta` com
// a guarda desarmada nascem **59 árvores dentro da água** (97 na pegada da
// bacia, das quais 59 abaixo da lâmina). O resto do vizinhado está limpo por
// GEOMETRIA, não por sorte, e também está medido:
//
//   • a mata de `alpino.ts` não chega aqui: `zonaEsquiavelAt` vale de 0,514 a
//     1,000 em toda a pegada, e `alpino.ts` pula tudo que passa de 0,04.
//   • a pista mais próxima está a 1.527 m do centro e o vão de teleférico mais
//     próximo a 1.879 m (números da varredura de sítio, em `inverno.ts`).
//
// Quem AINDA não sabe da água é `inverno-detalhe.ts`, que semeia peça pela
// `zonaEsquiavelAt` e não tem consulta de água nenhuma. Não é editável nesta
// frente; fica escrito no relatório o que ele precisa receber.
//
// ── A BANDEIRA ─────────────────────────────────────────────────────────────
// `?lagoa=1`, OPT-IN, e isso é deliberado: a conferência visual desta rodada
// ficou bloqueada (o `.next` do dev foi sobrescrito por um `next build` com o
// fundador ao vivo), e o bot de auto-commit publica de hora em hora. Nada novo
// entra no caminho padrão antes de alguém VER. Sem a bandeira, `buildLagoa`
// devolve um grupo vazio e `naLagoa` responde `false` sempre, ou seja o
// caminho de hoje fica bit a bit igual.
//
// ⚠️ A BACIA, ESSA, JÁ ESTÁ NO AR. Ela é parte de `alturaInvernoAt` e sobe com
// `?inverno` ligado, que é o padrão desde 03/09. Quem abrir a cidade hoje vê a
// cova seca; a bandeira só decide se ela tem água dentro.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { LAGOA_CENTRO, LAGOA_RAIO, LAGOA_COTA, INVERNO_ATIVO, LAGOA_ATIVA } from './inverno'
import { superficie } from './materiais'

// ⚠️ `typeof window !== 'undefined'` NO LADO ESQUERDO, mesmo motivo de
// `INVERNO_ATIVO` em `inverno.ts`: este componente é `'use client'` mas o Next
// ainda avalia o módulo uma vez NO SERVIDOR para montar o HTML inicial, e ali
// não existe `window.location`. Leitura única, no módulo, sem estado.
// ⚠️ A BANDEIRA VEM DE `inverno.ts`, NÃO DAQUI. Ela era lida nos dois arquivos
// e foi assim que a bacia entrou no caminho padrão enquanto a água ficava de
// fora: cova seca de 5,4 ha no ar. Uma bandeira, uma leitura, um dono.
export { LAGOA_ATIVA }

export interface LagoaOpts {
  /** a MESMA superfície que a câmera vê (`terrain.superficieAt`), nunca o
   *  `heightAt` analítico: a linha d'água é medida contra ela e uma discordância
   *  de chord aqui vira lâmina flutuando sobre a margem. */
  heightAt: (x: number, z: number) => number
  sombra?: boolean
}

export interface Lagoa {
  group: THREE.Group
  /** área da lâmina em m², somada triângulo a triângulo da malha construída */
  area: number
  /** profundidade máxima medida sob a lâmina, em metros */
  profMax: number
  triangulos: number
  update: (t: number) => void
  dispose: () => void
}

// ── a forma da malha ────────────────────────────────────────────────────────
/** rumos do leque. 256 dá 3,2 m de arco no raio médio de 131 m, que é menos
 *  que o passo de 10 m do relevo fino: adensar mais só amostraria o mesmo
 *  triângulo de terreno duas vezes. */
const N_AZ = 256
/** anéis da lâmina. 14 anéis dão 6.912 triângulos e 3.585 vértices, e eles
 *  existem para o gradiente de profundidade ter onde interpolar: `aProf` é
 *  varying, e uma lâmina de dois triângulos interpolaria os 20,72 m de fundo
 *  em linha reta. Cada vértice custa uma sonda de `superficieAt` (62 µs
 *  medidos), e é isso que segura o número aqui em vez de 40. */
const ANEIS = 14
/** ⚠️ QUANTO A LÂMINA ENTRA POR BAIXO DO BARRANCO. Na linha d'água o terreno
 *  vale exatamente `LAGOA_COTA`; 0,6 m adiante, com os 14,2 graus medidos de
 *  margem, ele já está 0,15 m ACIMA da lâmina e esconde a aresta. Sem essa
 *  sobra a borda da malha coincide com a borda do terreno e a serrilha da
 *  amostragem aparece como um fio claro em volta do lago. */
const LAMINA_SOBRA = 0.6
/** onde a busca radial começa. `LAGOA_RAIO` é o maior disco submerso em TODOS
 *  os rumos (medido pela frente do relevo, 120 m), então dentro dele não há o
 *  que procurar: começar aqui poupa 40 amostras grossas por rumo, 10.240 no
 *  total, que a 62 µs cada são 0,64 s de boot. Se o relevo mudar e o raio ficar
 *  velho, a busca desce em vez de subir (ver `raioDaMargem`) e nada quebra em
 *  silêncio. */
const BUSCA_INICIO = LAGOA_RAIO
/** ⚠️ BUSCA EM DOIS TEMPOS, E ISSO É TEMPO DE BOOT MEDIDO, não zelo.
 *  `superficieAt` custa 62 µs por ponto neste maciço (medido: 67.308 amostras
 *  em 4.143 ms), então a varredura ingênua de 0,5 m entre 120 e 260 m gastaria
 *  280 amostras por rumo, 71.680 no total, e travaria um quadro inteiro. Passo
 *  grosso de 3 m para achar o intervalo e 5 bissecções dentro dele dão 0,094 m
 *  de precisão com ~14 amostras por rumo. Conferido contra a varredura fina de
 *  0,5 m, rumo a rumo: desvio máximo de 0,47 m, e ele é da REFERÊNCIA, não
 *  daqui. A varredura só sabe responder em múltiplos do passo dela, enquanto a
 *  bissecção fecha em 0,094 m. */
const BUSCA_GROSSO = 3
const BUSCA_BISSEC = 5
const BUSCA_ALCANCE = 260

// ── a margem ────────────────────────────────────────────────────────────────
/** largura da faixa de rocha molhada, da linha d'água para fora. A orla da
 *  bacia tem 40 m até o lábio e sobe 14,2 graus; 22 m é a metade de baixo
 *  dela, que é onde a rocha de uma lagoa de montanha fica escura. */
const MARGEM_LARG = 22
/** quanto a faixa entra POR BAIXO da lâmina, para não sobrar vão na costura */
const MARGEM_DENTRO = 4
/** anéis da faixa. Cinco põem nó em −4, +1,2, +6,4, +11,6, +16,8 e +22 m da
 *  linha d'água, ou seja dois deles nos primeiros 7 m, que é onde a rampa de
 *  umidade cai mais rápido. Cada nó custa uma sonda de terreno. */
const MARGEM_ANEIS = 5
/** a faixa sobe isto sobre a superfície amostrada. A malha do terreno tem
 *  célula de 59 m e a corda dela já está embutida em `superficieAt`, então o
 *  que resta é folga de z-fighting: 0,22 m é a mesma ordem do levante que a
 *  praia dos lagos usa e some na vista de pé (1,7 m de olho). */
const MARGEM_LEVANTE = 0.22

// ── as cores ────────────────────────────────────────────────────────────────
/** o corpo d'água fundo. Luminância relativa 0,0218, ou seja 36% da `COR_AGUA`
 *  da cidade (0,0612): tarn alpino é escuro porque é fundo, frio e sem
 *  sedimento em suspensão. */
const COR_FUNDA = '#102C36'
/** a beirada rasa, onde o leito ainda atravessa: 0,0789, 129% da `COR_AGUA`.
 *  O contraste entre estas duas DENTRO da mesma lâmina é o que lê como
 *  profundidade; água de cor única lê como adesivo (lição de 01/09, `lago.ts`). */
const COR_RASA = '#2A5563'
/** ⚠️ O QUE A ÁGUA REFLETE AQUI NÃO É CÉU AZUL. O céu desta cena é PRETO
 *  (`scene.background = 0x000000`, é a Lua) e o que existe sobre a lagoa é a
 *  casca da abóbada e a neve do maciço. Um fresnel para azul de céu terrestre
 *  daria uma lâmina que não combina com nada em volta; este cinza-ardósia frio
 *  é a casca e a neve, que é o que de fato está lá em cima. */
const REFLEXO: [number, number, number] = [0.30, 0.34, 0.38]
/** rocha molhada, na linha d'água */
const COR_MOLHADA = '#2B2724'
/** rocha seca, no fim da faixa. A transição entre as duas é a única coisa que
 *  diz "esta água tem nível" quando a câmera está longe demais para ver onda. */
const COR_SECA = '#6B645C'

// ═══════════════════════════════════════════════════════════════════════════
// O CONTORNO, E POR QUE ELE É ESTADO DE MÓDULO
//
// `naLagoa(x, z, folga?)` tem de responder a quem PLANTA e a quem PAVIMENTA,
// e nenhum desses dois recebe a instância da lagoa: eles chamam uma função,
// exatamente como `lagos.naAgua` é passada por closure hoje. Aqui a fonte é a
// tabela de contorno medida na construção.
//
// ⚠️ E ELA COMEÇA NULA DE PROPÓSITO. Sem `?lagoa=1` ninguém constrói, a tabela
// segue nula e `naLagoa` responde `false` para todo ponto: não existe água na
// cena, então "está molhado?" é `false`, e o caminho de hoje não muda em nada.
// ═══════════════════════════════════════════════════════════════════════════
let CONTORNO: Float32Array | null = null

/** smoothstep no intervalo [0,1], a mesma curva que o resto do maciço usa */
function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

/**
 * Está dentro da lagoa (ou a menos de `folga` metros dela)?
 *
 * Mesmo contrato de `lagos.naAgua`: `folga` é em METROS de verdade, não
 * dilatação de célula. A dilatação aqui é RADIAL, e pode ser porque este corpo
 * é estrelado em torno do centro por construção (a linha d'água é uma função
 * de valor único do azimute, medida rumo a rumo), então empurrar o raio para
 * fora é o mesmo que engordar o polígono.
 *
 * CONFERIDA CONTRA O TERRENO, e o número é este: 200.000 pontos sorteados na
 * pegada da bacia, comparando a resposta daqui com `superficieAt(x,z) <
 * LAGOA_COTA`, deram **99,945% a 99,956% de acerto** em três cargas, e em
 * nenhuma delas o pior ponto discordante ficou a mais de 0,92 m da linha
 * d'água. O resíduo é a discretização do contorno (256 rumos, 1,4 grau), não
 * um erro de forma.
 */
export function naLagoa(x: number, z: number, folga = 0): boolean {
  const c = CONTORNO
  if (!c) return false
  const dx = x - LAGOA_CENTRO.x, dz = z - LAGOA_CENTRO.z
  // porta em caixa antes da raiz: quem chama isto chama por muda de árvore
  const lim = BUSCA_ALCANCE + folga
  if (dx <= -lim || dx >= lim || dz <= -lim || dz >= lim) return false
  const d = Math.hypot(dx, dz)
  if (d >= lim) return false
  // ângulo → índice, com interpolação linear entre os dois rumos vizinhos: sem
  // ela a consulta teria degrau de 1,4 graus e a borda da mata sairia serrilhada
  let t = (Math.atan2(dz, dx) / (Math.PI * 2)) * N_AZ
  t = ((t % N_AZ) + N_AZ) % N_AZ
  const i0 = Math.floor(t), i1 = (i0 + 1) % N_AZ, f = t - i0
  const r = c[i0] * (1 - f) + c[i1] * f
  return d < r + folga
}

/** o raio da linha d'água num rumo, medido no terreno de verdade. Sobe a
 *  partir de `BUSCA_INICIO` quando ali ainda é água e DESCE quando não é: a
 *  segunda metade é o que faz a busca continuar certa se `LAGOA_RAIO` ficar
 *  para trás numa rodada futura de relevo. */
function raioDaMargem(heightAt: (x: number, z: number) => number, cos: number, sen: number): number {
  const cx = LAGOA_CENTRO.x, cz = LAGOA_CENTRO.z
  const submerso = (r: number) => heightAt(cx + cos * r, cz + sen * r) < LAGOA_COTA
  // 1. o intervalo, no passo grosso: `dentro` é o último raio submerso conhecido
  //    e `fora` o primeiro seco conhecido.
  let dentro: number, fora: number
  if (submerso(BUSCA_INICIO)) {
    dentro = BUSCA_INICIO
    fora = BUSCA_ALCANCE
    for (let d = BUSCA_INICIO + BUSCA_GROSSO; d <= BUSCA_ALCANCE; d += BUSCA_GROSSO) {
      if (!submerso(d)) { fora = d; break }
      dentro = d
    }
  } else {
    // `LAGOA_RAIO` ficou para trás: a margem está DENTRO dele. Descer é o que
    // faz este arquivo continuar certo se o relevo mudar numa rodada futura.
    fora = BUSCA_INICIO
    dentro = 0
    for (let d = BUSCA_INICIO - BUSCA_GROSSO; d > 0; d -= BUSCA_GROSSO) {
      if (submerso(d)) { dentro = d; break }
      fora = d
    }
    if (dentro === 0) return 0
  }
  // 2. e o refino por bissecção, só dentro do intervalo
  for (let k = 0; k < BUSCA_BISSEC; k++) {
    const meio = (dentro + fora) / 2
    if (submerso(meio)) dentro = meio; else fora = meio
  }
  return dentro
}

/**
 * A lâmina: um leque de `N_AZ` rumos por `ANEIS` anéis, com o raio de CADA
 * rumo medido no terreno. Todos os vértices ficam em `LAGOA_COTA` (água parada
 * é nivelada, essa é a definição), então a normal é (0,1,0) em todos eles e
 * `computeVertexNormals` seria trabalho para chegar no mesmo lugar.
 *
 * Cada vértice carrega `aProf`, a profundidade REAL medida sob ele. ⚠️ E isto
 * é o oposto do que `lago.ts` decidiu para a cidade, com razão nos dois casos:
 * lá o leito é escavado quase plano (bacia a −26 com lâmina a −17), então
 * sondar o terreno devolveria profundidade constante e eles tiveram de derivar
 * o gradiente da distância à margem. Aqui o leito é uma cuba de verdade, de 0
 * a 20,72 m medidos, e a sonda é a resposta certa e mais barata.
 */
function construirLamina(
  heightAt: (x: number, z: number) => number,
  contorno: Float32Array,
): { geo: THREE.BufferGeometry; area: number; profMax: number } {
  const nV = 1 + N_AZ * ANEIS
  const pos = new Float32Array(nV * 3)
  const nor = new Float32Array(nV * 3)
  const prof = new Float32Array(nV)
  const idx: number[] = []
  const cx = LAGOA_CENTRO.x, cz = LAGOA_CENTRO.z

  const põe = (k: number, x: number, z: number) => {
    pos[k * 3] = x; pos[k * 3 + 1] = LAGOA_COTA; pos[k * 3 + 2] = z
    nor[k * 3] = 0; nor[k * 3 + 1] = 1; nor[k * 3 + 2] = 0
    const p = LAGOA_COTA - heightAt(x, z)
    prof[k] = p > 0 ? p : 0
  }
  põe(0, cx, cz)
  let profMax = prof[0]

  for (let j = 0; j < ANEIS; j++) {
    // ⚠️ ANEL MAIS APERTADO PERTO DA MARGEM (expoente 0,78, não linear): é lá
    // que a profundidade sai de 20 m para 0 em poucos metros, e é lá que o
    // gradiente varying precisa de vértice. No centro a cuba tem fundo plano
    // (78 m de raio, medido em `inverno.ts`) e não há nada para interpolar.
    const t = Math.pow((j + 1) / ANEIS, 0.78)
    for (let i = 0; i < N_AZ; i++) {
      const a = (i / N_AZ) * Math.PI * 2
      const rBorda = contorno[i] + LAMINA_SOBRA
      const r = rBorda * t
      const k = 1 + j * N_AZ + i
      põe(k, cx + Math.cos(a) * r, cz + Math.sin(a) * r)
      if (prof[k] > profMax) profMax = prof[k]
    }
  }

  for (let i = 0; i < N_AZ; i++) {
    const i2 = (i + 1) % N_AZ
    idx.push(0, 1 + i, 1 + i2)
    for (let j = 0; j < ANEIS - 1; j++) {
      const a0 = 1 + j * N_AZ + i, a1 = 1 + j * N_AZ + i2
      const b0 = 1 + (j + 1) * N_AZ + i, b1 = 1 + (j + 1) * N_AZ + i2
      idx.push(a0, b0, b1, a0, b1, a1)
    }
  }

  // a área sai da malha CONSTRUÍDA, somada triângulo a triângulo: é o número
  // que se publica, e ele não pode ser π·r² de um raio que não existe
  let area = 0
  for (let t = 0; t < idx.length; t += 3) {
    const p = idx[t] * 3, q = idx[t + 1] * 3, s = idx[t + 2] * 3
    area += Math.abs((pos[q] - pos[p]) * (pos[s + 2] - pos[p + 2])
                   - (pos[s] - pos[p]) * (pos[q + 2] - pos[p + 2])) / 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setAttribute('aProf', new THREE.BufferAttribute(prof, 1))
  geo.setIndex(idx)
  return { geo, area, profMax }
}

/**
 * ÁGUA ESCURA E PARADA, e "parada" é o requisito de forma, não um atalho.
 *
 * ⚠️ A AMPLITUDE DA ONDA NÃO É A DO LAGO DA PRAÇA. `aguaDeVerdade` em
 * `lago.ts` inclina a normal em 0,052 com períodos de 26 e 40 m, calibrado
 * para uma baía de 20,5 km² varrida por vento aberto. Uma lagoa de 5,42 ha
 * encaixada numa sela a 407 m, com crista de 1.044 m em volta, não tem essa
 * pista de vento: aqui a amplitude é 0,016 (3,25 vezes menor) e o período vai
 * a 34 e 51 m. O que se quer é o sol quebrando de leve, não o mar.
 *
 * O que carrega a leitura no lugar da onda é o FRESNEL, e forte: 0,78 contra
 * os 0,62 do lago. Espelho é a assinatura de tarn alpino, e o que ele espelha
 * aqui é a casca e a neve (ver `REFLEXO`), porque o céu desta cena é preto.
 *
 * Um programa novo, com chave fixa, e ele só existe com `?lagoa=1`: a cena
 * compila 228 programas com teto medido de 235, e a lagoa entra com dois (este
 * e o da margem) apenas no caminho da bandeira.
 */
function materialDaAgua(profMax: number): { mat: THREE.MeshStandardMaterial; relogio: { value: number } } {
  const mat = new THREE.MeshStandardMaterial({
    color: COR_FUNDA,
    roughness: 0.12,
    metalness: 0.02,
    transparent: true,
    // ⚠️ ESCREVE PROFUNDIDADE mesmo transparente, mesma razão de `lago.ts`: a
    // lâmina é uma casca única e plana, nunca se sobrepõe a si mesma, e sem
    // isso ela deixaria de ocluir o barranco do outro lado.
    depthWrite: true,
    side: THREE.FrontSide,
  })
  const uTempo = { value: 0 }
  // referência do gradiente: metade da cuba medida, que é onde a água deixa de
  // deixar o leito passar. Vem do número da malha, não de um palpite.
  const uRef = { value: Math.max(2, profMax * 0.5) }
  const rasa = new THREE.Color(COR_RASA)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = uTempo
    sh.uniforms.uProfRef = uRef
    sh.uniforms.uRasa = { value: new THREE.Vector3(rasa.r, rasa.g, rasa.b) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>',
               '#include <common>\nattribute float aProf;\nvarying float vProf;\nvarying vec3 vMundoLagoa;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vProf = aProf;
        vMundoLagoa = (modelMatrix * vec4(position, 1.0)).xyz;
      `)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTempo;
        uniform float uProfRef;
        uniform vec3 uRasa;
        varying float vProf;
        varying vec3 vMundoLagoa;
      `)
      // a ondulação entra depois de a normal existir e antes de a luz somar
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        float ondaA = sin(vMundoLagoa.x * 0.185 + uTempo * 0.21);
        float ondaB = sin(vMundoLagoa.z * 0.123 - uTempo * 0.16);
        normal = normalize(normal + vec3(ondaA * 0.016, 0.0, ondaB * 0.016));
      `)
      // profundidade e reflexo entram no fim, sobre a cor já iluminada
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float funda = smoothstep(0.0, uProfRef, vProf);
        gl_FragColor.rgb = mix(uRasa, gl_FragColor.rgb, funda);
        float cosI = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
        float fres = pow(1.0 - cosI, 3.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(${REFLEXO[0]}, ${REFLEXO[1]}, ${REFLEXO[2]}), fres * 0.78);
        // raso é translúcido: é por onde o leito de pedra continua aparecendo
        gl_FragColor.a = mix(0.55, 1.0, funda);
      `)
  }
  // ⚠️ CHAVE FIXA, obrigatória: sem ela o three compila um programa por
  // material com `onBeforeCompile`, e o orçamento de programas desta cena é
  // apertado (228 de 235 medidos).
  mat.customProgramCacheKey = () => 'lagoa-agua-v1'
  mat.needsUpdate = true
  return { mat, relogio: uTempo }
}

/**
 * A MARGEM: rocha molhada e faixa úmida, SEM PRAIA DE AREIA.
 *
 * ⚠️ E a ausência da areia é decisão, não esquecimento. `lagos.ts` dá praia de
 * areia clara a toda cratera fora da baía, e é o certo lá embaixo: cratera
 * lunar cheia de pó tem praia. Uma lagoa encaixada numa sela de rocha a 407 m
 * não tem: tem pedra escura e molhada na linha d'água, ficando seca e clara
 * para cima. Copiar a praia daqui seria copiar a assinatura errada.
 *
 * A faixa é um leque que acompanha o contorno medido, deitado na superfície,
 * e entra 4 m POR BAIXO da lâmina: sem essa sobreposição a costura entre as
 * duas malhas abriria um fio de terreno cru na linha d'água, que é o mesmo
 * defeito dos 40 m de barragem que apareceu entre canal e lago em 02/09.
 *
 * A umidade viaja no atributo `aMolhado` e faz DUAS coisas de uma vez: ela
 * escurece o albedo (pela cor por vértice, de graça) e derruba a rugosidade
 * (pela injeção de shader abaixo). Rocha molhada é escura E brilhante; só
 * escurecer daria uma mancha de tinta. O ALFA da cor é outra coisa: é o
 * desvanecer da faixa contra o terreno, na aresta de fora.
 *
 * A textura de pedra vem do cache de `materiais.ts` e `vias.ts` já a gerou no
 * caminho padrão (medido: 146 ms de geração), então aqui ela custa zero.
 */
function construirMargem(
  heightAt: (x: number, z: number) => number,
  contorno: Float32Array,
  sombra: boolean,
): { malha: THREE.Mesh; triangulos: number } {
  const nV = N_AZ * (MARGEM_ANEIS + 1)
  const pos = new Float32Array(nV * 3)
  // ⚠️ QUATRO COMPONENTES, e o three só respeita o alfa da cor por vértice se
  // o material for `transparent` (armadilha já paga pela praia dos lagos). Com
  // itemSize 3 a faixa acabaria numa ARESTA de pedra clara contra o regolito
  // cru, que é exatamente a borda de adesivo que se está tentando não fazer.
  const cor = new Float32Array(nV * 4)
  const uv = new Float32Array(nV * 2)
  const molh = new Float32Array(nV)
  const idx: number[] = []
  const cx = LAGOA_CENTRO.x, cz = LAGOA_CENTRO.z
  const cMolhada = new THREE.Color(COR_MOLHADA)
  const cSeca = new THREE.Color(COR_SECA)
  const tmp = new THREE.Color()
  const passo = superficie('pedra').metros

  for (let j = 0; j <= MARGEM_ANEIS; j++) {
    const u = j / MARGEM_ANEIS
    for (let i = 0; i < N_AZ; i++) {
      const a = (i / N_AZ) * Math.PI * 2
      const r = contorno[i] - MARGEM_DENTRO + u * (MARGEM_DENTRO + MARGEM_LARG)
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      const k = j * N_AZ + i
      pos[k * 3] = x
      pos[k * 3 + 1] = heightAt(x, z) + MARGEM_LEVANTE
      pos[k * 3 + 2] = z
      // ⚠️ A UMIDADE É MEDIDA A PARTIR DA LINHA D'ÁGUA, NÃO DA BORDA DA FAIXA.
      // Parametrizar por `u` (0 na aresta submersa) deixaria a rocha 36% seca
      // já ENCOSTADA na água, que é o oposto do que se quer: a pedra mais
      // escura da lagoa é exatamente a que a lâmina lambe. Dentro d'água a
      // umidade é cheia; para fora ela cai pelo afastamento da margem.
      //
      // ⚠️ E NÃO É LINEAR NA LARGURA. Rocha de beira de lago seca depressa: o
      // expoente 0,55 põe a metade escura nos primeiros 7 m dos 22 visíveis,
      // que é a proporção que uma foto de tarn mostra. Linear daria uma rampa
      // de tinta cinza atravessando a margem inteira.
      const dAgua = r - contorno[i]
      const seco = dAgua <= 0 ? 0 : Math.pow(Math.min(1, dAgua / MARGEM_LARG), 0.55)
      const m = 1 - seco
      molh[k] = m
      tmp.copy(cMolhada).lerp(cSeca, seco)
      cor[k * 4] = tmp.r; cor[k * 4 + 1] = tmp.g; cor[k * 4 + 2] = tmp.b
      // opaca até 55% da faixa e desvanecendo até 0 na aresta: o último terço é
      // o que costura a rocha da lagoa no terreno do maciço sem deixar linha
      cor[k * 4 + 3] = 1 - suave01((dAgua / MARGEM_LARG - 0.55) / 0.45)
      uv[k * 2] = x / passo
      uv[k * 2 + 1] = z / passo
    }
  }
  for (let j = 0; j < MARGEM_ANEIS; j++) {
    for (let i = 0; i < N_AZ; i++) {
      const i2 = (i + 1) % N_AZ
      const a0 = j * N_AZ + i, a1 = j * N_AZ + i2
      const b0 = (j + 1) * N_AZ + i, b1 = (j + 1) * N_AZ + i2
      idx.push(a0, b0, b1, a0, b1, a1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 4))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('aMolhado', new THREE.BufferAttribute(molh, 1))
  geo.setIndex(idx)
  geo.computeVertexNormals()

  const s = superficie('pedra')
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    // ⚠️ O ALBEDO DA TEXTURA SE DESCARTA, e é a armadilha da casa: a cor por
    // vértice MULTIPLICA o mapa, então pedra escura vezes albedo de pedra
    // daria um preto morto. A cor é toda da rampa por vértice; a textura entra
    // só como micro-relevo e rugosidade.
    side: THREE.FrontSide,
    transparent: true,
    // ⚠️ TRANSPARENTE E SEM ESCREVER PROFUNDIDADE, mesma decisão da praia dos
    // lagos: a faixa é uma fita deitada a 0,22 m do chão e escrever
    // profundidade a poria brigando em z contra o terreno logo abaixo dela.
    depthWrite: false,
  })
  // luz rasante na Lua amplifica normal, e a margem é vista quase sempre
  // rasante: no valor cheio a rocha vira lixa (mesma redução da praia dos lagos)
  const f = s.normalScale * 0.6
  mat.normalScale = new THREE.Vector2(f, f)
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMolhado;\nvarying float vMolhado;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMolhado = aMolhado;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMolhado;')
      // rocha molhada reflete: na linha d'água a rugosidade cai para 27% do
      // valor seco, e é esse brilho que separa a beirada da pedra do maciço
      .replace('#include <roughnessmap_fragment>',
               '#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.0, 0.27, vMolhado);')
  }
  mat.customProgramCacheKey = () => 'lagoa-margem-v1'
  mat.needsUpdate = true

  const malha = new THREE.Mesh(geo, mat)
  malha.name = 'lagoa:margem'
  // ⚠️ ORDEM EXPLÍCITA, e ela não é decoração: as duas malhas são
  // transparentes e o three ordena transparente por DISTÂNCIA do centro do
  // volume envolvente. Os dois centros estão em cima um do outro (é o mesmo
  // corpo), então a ordem sairia por ruído de ponto flutuante e trocaria
  // conforme a câmera anda. Com a margem em 0 e a água em 1 a rocha do leito é
  // desenhada primeiro e continua aparecendo POR BAIXO da água rasa, que é
  // metade do que faz a beirada ler como beirada.
  malha.renderOrder = 0
  malha.receiveShadow = sombra
  // fita deitada no chão: a sombra dela cairia nela mesma e pagaria passe de
  // mapa de sombra por nada
  malha.castShadow = false
  malha.frustumCulled = false
  return { malha, triangulos: idx.length / 3 }
}

/** o que devolver quando não há lagoa nenhuma: grupo vazio, zero em tudo, e
 *  `update`/`dispose` que não fazem nada. Quem chama não precisa de `if`. */
function lagoaVazia(): Lagoa {
  const group = new THREE.Group()
  group.name = 'lagoa'
  return { group, area: 0, profMax: 0, triangulos: 0, update() {}, dispose() { group.clear() } }
}

/**
 * Monta a lagoa. Síncrona, sem rede, sem GLB e sem textura nova (a pedra vem
 * do cache compartilhado de `materiais.ts`).
 *
 * ⚠️ E ELA CUSTA 525 ms NUM QUADRO SÓ, medido. O trabalho é quase todo sonda
 * de terreno: 3.584 amostras da busca de margem, 3.585 da lâmina e 1.536 da
 * faixa, a 62 µs cada. Isso é aceitável AQUI e por um motivo específico: a
 * lagoa é opt-in (`?lagoa=1`), então só paga quem foi ver, e ela é bem menor
 * que os vizinhos síncronos do mesmo trecho de boot. ⚠️ NO DIA EM QUE A
 * BANDEIRA VIRAR PADRÃO, ISTO TEM DE ENTRAR NA `Obra` FATIADA, como
 * `invernoComoTrabalho` fez em 03/09 pelo mesmo motivo.
 *
 * ⚠️ NÃO RECEBE `PerfProfile`, DE PROPÓSITO. A revisão desta rodada reprovou
 * um módulo por aceitar um perfil e nunca ler campo nenhum dele. A lagoa
 * inteira mede 6.912 + 2.560 = 9.472 triângulos, 0,15% dos 6,3 M da cena, num
 * corpo de 5,47 ha que ou está em quadro inteiro ou está fora dele: não há
 * nada aqui que valha um teto por tier de máquina. Se um dia valer, o perfil
 * entra junto com o campo que ele controla, não antes.
 */
export function buildLagoa(o: LagoaOpts): Lagoa {
  if (!LAGOA_ATIVA) return lagoaVazia()
  // ⚠️ SEM O PARQUE DE INVERNO NÃO EXISTE BACIA. `LAGOA_COTA` é 407 m e quem
  // escava até lá é `alturaInvernoAt`; com `?inverno=0` o terreno ali fica na
  // casa dos 460 m e a lâmina nasceria ENTERRADA (ou, pior, flutuando num
  // rumo e enterrada no outro). Melhor não subir e dizer por quê.
  if (!INVERNO_ATIVO) {
    console.warn('[lagoa] `?lagoa=1` pede `?inverno` ligado: a bacia é escavada por `alturaInvernoAt`. Sem ela não há lagoa.')
    return lagoaVazia()
  }
  const heightAt = o.heightAt
  if (heightAt(LAGOA_CENTRO.x, LAGOA_CENTRO.z) >= LAGOA_COTA) {
    // acontece quando os relevos reais não carregaram (`carregarRelevo` avisa
    // no console): sem os três carimbos o maciço fica só com envelope e a
    // bacia não é escavada. Água aqui seria um disco boiando no ar.
    console.warn('[lagoa] o fundo da bacia está acima de LAGOA_COTA: o relevo do maciço não subiu. Sem água.')
    return lagoaVazia()
  }

  const contorno = new Float32Array(N_AZ)
  for (let i = 0; i < N_AZ; i++) {
    const a = (i / N_AZ) * Math.PI * 2
    contorno[i] = raioDaMargem(heightAt, Math.cos(a), Math.sin(a))
  }

  const { geo, area, profMax } = construirLamina(heightAt, contorno)
  const { mat, relogio } = materialDaAgua(profMax)
  const agua = new THREE.Mesh(geo, mat)
  agua.name = 'lagoa:agua'
  // água não recebe nem projeta sombra: ela já é o espelho da cena, e sombra
  // de árvore desenhada sobre a lâmina brigaria com o fresnel
  agua.receiveShadow = false
  agua.castShadow = false
  agua.frustumCulled = false
  agua.renderOrder = 1 // ver a nota de ordem em `construirMargem`

  const { malha: margem, triangulos: triMargem } = construirMargem(heightAt, contorno, o.sombra ?? true)

  const group = new THREE.Group()
  group.name = 'lagoa'
  // a margem entra antes da água na lista, e o `renderOrder` das duas garante
  // que a ordem de desenho seja essa mesmo (ver a nota em `construirMargem`)
  group.add(margem)
  group.add(agua)

  // a tabela só é publicada quando existe água de verdade na cena: é o que faz
  // `naLagoa` responder `false` em todo caminho que não construiu lagoa
  CONTORNO = contorno

  return {
    group,
    area,
    profMax,
    triangulos: geo.index!.count / 3 + triMargem,
    update(t: number) { relogio.value = t },
    dispose() {
      CONTORNO = null
      for (const m of [agua, margem]) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
      group.clear()
    },
  }
}
