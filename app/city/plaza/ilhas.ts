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
// ⚠️ O PARÁGRAFO DO "BANCO RASO A 15 CM" SAIU DAQUI PORQUE ELE MENTIA. O apron
// acima da lâmina foi REMOVIDO do código em 31/08 (ver o ⚠️ dentro de `campo`),
// mas o cabeçalho continuou anunciando o truque, e cabeçalho que mente manda a
// próxima pessoa procurar a coisa errada.
//
// ⚠️ E EM 01/09 A ÁGUA GANHOU GRADIENTE DE PROFUNDIDADE (`lago.ts`,
// `aplicarProfundidade`): a lâmina virou `transparent`, a opacidade vai de 0,32
// no raso a 1,0 no fundo, e a cor clareia junto. A pergunta óbvia é se isso
// aposentou o truque do apron. NÃO APOSENTOU, e a razão é aritmética:
// `profDaAgua()` não mede profundidade, mede DISTÂNCIA ATÉ A MARGEM DA LÂMINA, e
// a lâmina da baía é uma casca CONTÍNUA que não tem furo nenhum onde as ilhas
// estão. Com `uProfRef` no teto de 150 m, a opacidade satura em
// −150·ln(0,42) ≈ 130 m da margem EXTERNA da baía. A ilha mais próxima da costa
// aqui está a 464 m dela: em volta de toda ilha o termo vale exp(−3,1) ≈ 0,045,
// ou seja água cheia, opaca e escura encostando na praia. Turquesa de ilha,
// hoje, não existe em lugar nenhum.
//
// ⚠️ O CONSERTO CERTO NÃO É NESTE ARQUIVO: é FURAR a lâmina da baía no contorno
// de cada ilha (`lagos.ts`), porque aí o `campoDeMargem` passa a contar a costa
// da ilha como margem e a turquesa sai de graça, correta, sem apron e sem
// z-fighting. Está no relatório como pedido para quem é dono de `lagos.ts`.
//
// ⚠️ A FORMA É DEDO FINO, E A RAZÃO É ARITMÉTICA, NÃO GOSTO. O produto aqui é
// MARGEM, e margem sai do PERÍMETRO, não da área. Medido neste arquivo: as 26
// ilhas somam 7,21 km² de terra e 61,16 km de linha d'água, ou seja 8,5 km de
// margem por km² de terra. A mesma terra num disco só daria 9,54 km de
// perímetro: o recorte multiplica a orla por 6,4. É por isso que existe `dedos`.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { look2 } from './look'
import { superficie, quebrarRepeticao } from './materiais'

// paleta: a maquete da cidade + a faixa de raso, que é nova
const C_FUNDO = new THREE.Color('#2E4A57')   // o mergulho, na borda do banco
const C_AREIA = new THREE.Color('#E2D9BE')   // a praia
const C_MATO = new THREE.Color('#6C7A5B')    // a mata
const C_MATO_E = new THREE.Color('#59684C')  // a mata fechada do alto
const C_ROCHA = new THREE.Color('#8A8375')   // o costão de rocha
const C_PLATO = new THREE.Color('#C3BBA8')   // o patamar de construção
const C_TRILHA = new THREE.Color('#A79C86')  // a trilha de saibro

/** metros de mundo por ladrilho do normal da ilha da baía */
const UV_METROS = 9

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
  /** o grupo do arquipélago a que ela pertence (só leitura, para menu e relatório) */
  grupo?: string
  /** ⚠️ QUANTOS DEDOS a costa tem. 0 = a bolha de antes.
   *
   *  ⚠️ E O TERMO TEM MÉDIA 1, `1 + k·cos(n·(a − fase))`, DE PROPÓSITO. A
   *  primeira versão usava `1 − k·(1 − cos)/2`, que só SUBTRAI: media 15,0 km de
   *  margem nas cinco antigas e caiu para 13,4, porque encolheu a ilha inteira em
   *  vez de recortá-la. Com média 1 a área fica onde estava e só o contorno
   *  serpenteia: as mesmas cinco foram de 14,99 para 22,24 km de margem. */
  dedos?: number
  /** a profundidade do recorte, 0..0,5. Acima de 0,5 o dedo fecha sobre si mesmo. */
  dedoK?: number
  /** o rumo do primeiro dedo, em graus do quadro LOCAL da ilha */
  fase?: number
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

// ⚠️ AS COORDENADAS SÃO MEDIDAS, NÃO ESCOLHIDAS, e a régua está escrita aqui
// porque sem ela ninguém consegue mexer numa linha destas sem chutar.
//
// A baía cresceu com a casca em 02/09 (7.050 -> 9.050 de raio): 56,63 km² de
// água contra os 20,48 de antes. Cada ilha abaixo foi posta rodando o MESMO
// preenchimento por cota que `lagos.ts` roda, sobre o mesmo heightmap
// (`public/lunar/btc-core-heightmap.f32`), na cota −40, e depois exigindo que
// TODOS os 720 pontos do contorno dela caiam em água com pelo menos 55 m de
// folga até a terra firme. A folga medida de cada uma vai no comentário do grupo.
//
// ⚠️ E A MÁSCARA USADA É A INTERSEÇÃO DE DUAS, não a do gerador sozinha. O
// gerador (`scripts/gerar_cidade.py`) mede o relevo CRU, sem exagero vertical e
// sem o pódio da abóbada; a cena mede `terrain.superficieAt`, que tem os dois.
// Medido: só 80,7% da baía do gerador também é água na cena. Ilha posta pela
// máscara do gerador sozinha nasce em cima de regolito nos outros 19,2%.
//
// ⚠️ DEPENDÊNCIA FORA DESTE ARQUIVO, E ELA É UM NÚMERO SÓ: `plaza-scene.tsx`
// ainda chama `buildLagos({ raio: 7050 })` enquanto `DOME_R` já é 9.050. Com
// 7.050 a lâmina para em r 7.010 e a baía desenhada tem 21,98 km², não 56,63:
// as 15 ilhas de r > 7.010 (os grupos 'angra-leste' e 'cayos-sul', e parte de
// 'cayos-norte') nascem em terra seca. Está no relatório.
//
// ⚠️ A RAZÃO CUME/RAIO FICA EM 0,05 a 0,15. Angra dos Reis tem morro de 200 m em
// ilha de 3 km: razão 0,07. Um cayo das Bahamas fica em 0,01. A primeira versão
// estava em 0,39, que é ilha vulcânica de 1 milhão de anos, não paraíso.
//
// OS GRUPOS, e cada um existe por uma razão de leitura:
//   angra-fundador  as 5 originais, no miolo velho da baía. Morro arredondado,
//                   enseada funda. As únicas que já apareciam em chapa.
//   cayos-norte     BAHAMAS: seis cayos baixos e COMPRIDOS (alonga 1,9 a 2,6)
//                   enfileirados no raso do noroeste. Cume de 8 a 14 m: quase
//                   tudo ali é praia.
//   atois           MALDIVAS: cinco atóis com lagoa, no meio-norte. Sem dedo, de
//                   propósito: atol é anel, e anel com dedo deixa de ser anel.
//   angra-leste     seis morros no arco leste, o grupo com mais silhueta.
//   cayos-sul       quatro peças soltas fechando o arco sul, para o arquipélago
//                   dar a volta em vez de virar um bolo num canto.
//
// ⚠️ E O VAZIO É PARTE DO DESENHO. O miolo fundo da baía (perto de 5.000,−5.000,
// o ponto a 1.235 m de qualquer costa) ficou SEM ilha nenhuma. Arquipélago sem
// água aberta não lê como arquipélago, lê como pântano.
export const ILHAS: readonly IlhaSpec[] = [
  { id: 'IL01', nome: 'Ilha do Fundador', grupo: 'angra-fundador', x: 3624, z: -4261,
    raio: 600, cume: 86, tipo: 'angra', semente: 7, alonga: 1.35, giro: 150,
    banco: 1.55, dedos: 4, dedoK: 0.34, fase: 30, dono: 'fundador',
    patamares: [
      { raio: 114, rumo: 323, dist: 378, cota: 0.6 },
      { raio: 100, rumo: 143, dist: 694, cota: 0.16 },
    ] },
  { id: 'IL02', nome: 'Ilha Norte', grupo: 'angra-fundador', x: 5022, z: -3277,
    raio: 430, cume: 58, tipo: 'angra', semente: 13, alonga: 1.18, giro: 195,
    banco: 1.55, dedos: 4, dedoK: 0.36, fase: 255,
    patamares: [
      { raio: 78, rumo: 147, dist: 216, cota: 0.6 },
      { raio: 71, rumo: 327, dist: 171, cota: 0.16 },
    ] },
  { id: 'IL03', nome: 'Banco do Poente', grupo: 'angra-fundador', x: 3029, z: -5451,
    raio: 285, cume: 13, tipo: 'banco', semente: 19, alonga: 1.7, giro: 165,
    banco: 1.55, dedos: 3, dedoK: 0.3, fase: 300,
    patamares: [
      { raio: 53, rumo: 239, dist: 121, cota: 0.72 },
      { raio: 45, rumo: 331, dist: 185, cota: 0.66 },
    ] },
  { id: 'IL04', nome: 'Ilha Leste', grupo: 'angra-fundador', x: 5739, z: -2277,
    raio: 230, cume: 32, tipo: 'angra', semente: 25, alonga: 1.45, giro: 315,
    banco: 1.55, dedos: 3, dedoK: 0.28, fase: 135,
    patamares: [
      { raio: 44, rumo: 280, dist: 141, cota: 0.6 },
      { raio: 38, rumo: 24, dist: 203, cota: 0.16 },
    ] },
  { id: 'IL05', nome: 'Atol da Baía', grupo: 'angra-fundador', x: 4628, z: -4350,
    raio: 150, cume: 9, tipo: 'atol', semente: 31, alonga: 1.2, giro: 270,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 345,
    patamares: [
      { raio: 31, rumo: 167, dist: 92, cota: 0.9 },
      { raio: 29, rumo: 347, dist: 111, cota: 0.86 },
    ] },
  { id: 'IL10', nome: 'Cayo Maior', grupo: 'cayos-norte', x: 475, z: -8196,
    raio: 260, cume: 14, tipo: 'banco', semente: 37, alonga: 2.1, giro: 180,
    banco: 1.55, dedos: 4, dedoK: 0.42, fase: 15,
    patamares: [
      { raio: 48, rumo: 277, dist: 276, cota: 0.72 },
      { raio: 42, rumo: 97, dist: 390, cota: 0.66 },
    ] },
  { id: 'IL11', nome: 'Cayo do Vento', grupo: 'cayos-norte', x: 2253, z: -7912,
    raio: 200, cume: 11, tipo: 'banco', semente: 43, alonga: 2.3, giro: 0,
    banco: 1.55, dedos: 4, dedoK: 0.44, fase: 165,
    patamares: [
      { raio: 37, rumo: 263, dist: 205, cota: 0.72 },
      { raio: 32, rumo: 83, dist: 290, cota: 0.66 },
    ] },
  { id: 'IL12', nome: 'Cayo Longo', grupo: 'cayos-norte', x: 3199, z: -7458,
    raio: 175, cume: 9, tipo: 'banco', semente: 49, alonga: 2.6, giro: 90,
    banco: 1.55, dedos: 3, dedoK: 0.4, fase: 210,
    patamares: [
      { raio: 32, rumo: 193, dist: 185, cota: 0.72 },
      { raio: 28, rumo: 347, dist: 240, cota: 0.66 },
    ] },
  { id: 'IL13', nome: 'Cayo do Meio', grupo: 'cayos-norte', x: 1553, z: -8213,
    raio: 150, cume: 9, tipo: 'banco', semente: 55, alonga: 2, giro: 30,
    banco: 1.55, dedos: 4, dedoK: 0.46, fase: 300,
    patamares: [
      { raio: 28, rumo: 19, dist: 107, cota: 0.72 },
      { raio: 24, rumo: 199, dist: 112, cota: 0.66 },
    ] },
  { id: 'IL14', nome: 'Cayo Menor', grupo: 'cayos-norte', x: 2635, z: -7399,
    raio: 120, cume: 8, tipo: 'banco', semente: 61, alonga: 1.9, giro: 60,
    banco: 1.55, dedos: 3, dedoK: 0.44, fase: 120,
    patamares: [
      { raio: 22, rumo: 168, dist: 87, cota: 0.72 },
      { raio: 19, rumo: 252, dist: 79, cota: 0.66 },
    ] },
  { id: 'IL15', nome: 'Cayo do Fim', grupo: 'cayos-norte', x: 1327, z: -7679,
    raio: 105, cume: 8, tipo: 'banco', semente: 67, alonga: 2.2, giro: 180,
    banco: 1.55, dedos: 3, dedoK: 0.42, fase: 120,
    patamares: [
      { raio: 19, rumo: 52, dist: 68, cota: 0.72 },
      { raio: 17, rumo: 128, dist: 96, cota: 0.66 },
    ] },
  { id: 'IL20', nome: 'Atol Grande', grupo: 'atois', x: 4213, z: -6799,
    raio: 190, cume: 11, tipo: 'atol', semente: 73, alonga: 1.25, giro: 345,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 90,
    patamares: [
      { raio: 42, rumo: 195, dist: 98, cota: 0.9 },
      { raio: 33, rumo: 15, dist: 98, cota: 0.86 },
    ] },
  { id: 'IL21', nome: 'Atol da Lagoa', grupo: 'atois', x: 5286, z: -6468,
    raio: 150, cume: 9, tipo: 'atol', semente: 79, alonga: 1.35, giro: 15,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 30,
    patamares: [
      { raio: 34, rumo: 98, dist: 103, cota: 0.9 },
      { raio: 31, rumo: 278, dist: 118, cota: 0.86 },
    ] },
  { id: 'IL22', nome: 'Atol Gêmeo', grupo: 'atois', x: 4783, z: -6906,
    raio: 125, cume: 9, tipo: 'atol', semente: 85, alonga: 1.2, giro: 345,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 300,
    patamares: [
      { raio: 28, rumo: 50, dist: 76, cota: 0.9 },
      { raio: 26, rumo: 230, dist: 77, cota: 0.86 },
    ] },
  { id: 'IL23', nome: 'Atol do Canal', grupo: 'atois', x: 5499, z: -5848,
    raio: 110, cume: 8, tipo: 'atol', semente: 91, alonga: 1.4, giro: 285,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 15,
    patamares: [
      { raio: 28, rumo: 176, dist: 93, cota: 0.9 },
      { raio: 23, rumo: 356, dist: 99, cota: 0.86 },
    ] },
  { id: 'IL24', nome: 'Atol Pequeno', grupo: 'atois', x: 5770, z: -6130,
    raio: 95, cume: 8, tipo: 'atol', semente: 97, alonga: 1.15, giro: 195,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 120,
    patamares: [
      { raio: 22, rumo: 19, dist: 56, cota: 0.9 },
      { raio: 20, rumo: 199, dist: 66, cota: 0.86 },
    ] },
  { id: 'IL30', nome: 'Ilha dos Morros', grupo: 'angra-leste', x: 7146, z: -3885,
    raio: 380, cume: 48, tipo: 'angra', semente: 103, alonga: 1.4, giro: 120,
    banco: 1.55, dedos: 5, dedoK: 0.42, fase: 195,
    patamares: [
      { raio: 72, rumo: 161, dist: 239, cota: 0.6 },
      { raio: 63, rumo: 315, dist: 293, cota: 0.16 },
    ] },
  { id: 'IL31', nome: 'Ilha da Enseada', grupo: 'angra-leste', x: 6255, z: -5172,
    raio: 300, cume: 38, tipo: 'angra', semente: 109, alonga: 1.3, giro: 225,
    banco: 1.55, dedos: 5, dedoK: 0.44, fase: 345,
    patamares: [
      { raio: 51, rumo: 213, dist: 212, cota: 0.6 },
      { raio: 21, rumo: 1, dist: 66, cota: 0.16 },
    ] },
  { id: 'IL32', nome: 'Ilha do Costão', grupo: 'angra-leste', x: 7761, z: -2217,
    raio: 245, cume: 30, tipo: 'angra', semente: 115, alonga: 1.5, giro: 240,
    banco: 1.55, dedos: 4, dedoK: 0.42, fase: 90,
    patamares: [
      { raio: 42, rumo: 300, dist: 46, cota: 0.6 },
      { raio: 41, rumo: 120, dist: 198, cota: 0.16 },
    ] },
  { id: 'IL33', nome: 'Ilha da Ferradura', grupo: 'angra-leste', x: 7856, z: -1404,
    raio: 200, cume: 24, tipo: 'angra', semente: 121, alonga: 1.35, giro: 345,
    banco: 1.55, dedos: 5, dedoK: 0.46, fase: 30,
    patamares: [
      { raio: 38, rumo: 128, dist: 87, cota: 0.6 },
      { raio: 33, rumo: 281, dist: 142, cota: 0.16 },
    ] },
  { id: 'IL34', nome: 'Ilha do Farol', grupo: 'angra-leste', x: 7004, z: -4695,
    raio: 160, cume: 20, tipo: 'angra', semente: 127, alonga: 1.25, giro: 255,
    banco: 1.55, dedos: 4, dedoK: 0.44, fase: 75,
    patamares: [
      { raio: 24, rumo: 266, dist: 59, cota: 0.6 },
      { raio: 27, rumo: 86, dist: 43, cota: 0.16 },
    ] },
  { id: 'IL35', nome: 'Ilha Rasa', grupo: 'angra-leste', x: 7828, z: -3083,
    raio: 130, cume: 11, tipo: 'banco', semente: 133, alonga: 1.8, giro: 255,
    banco: 1.55, dedos: 3, dedoK: 0.4, fase: 165,
    patamares: [
      { raio: 24, rumo: 7, dist: 98, cota: 0.72 },
      { raio: 21, rumo: 131, dist: 71, cota: 0.66 },
    ] },
  { id: 'IL40', nome: 'Ilha do Sul', grupo: 'cayos-sul', x: 7825, z: 2658,
    raio: 290, cume: 34, tipo: 'angra', semente: 139, alonga: 1.45, giro: 105,
    banco: 1.55, dedos: 5, dedoK: 0.44, fase: 285,
    patamares: [
      { raio: 33, rumo: 276, dist: 66, cota: 0.6 },
      { raio: 48, rumo: 46, dist: 139, cota: 0.16 },
    ] },
  { id: 'IL41', nome: 'Cayo do Sul', grupo: 'cayos-sul', x: 7900, z: -282,
    raio: 190, cume: 10, tipo: 'banco', semente: 145, alonga: 2.2, giro: 240,
    banco: 1.55, dedos: 4, dedoK: 0.44, fase: 60,
    patamares: [
      { raio: 35, rumo: 248, dist: 130, cota: 0.72 },
      { raio: 23, rumo: 68, dist: 102, cota: 0.66 },
    ] },
  { id: 'IL42', nome: 'Atol do Sul', grupo: 'cayos-sul', x: 7889, z: 1566,
    raio: 135, cume: 9, tipo: 'atol', semente: 151, alonga: 1.3, giro: 105,
    banco: 1.55, dedos: 0, dedoK: 0, fase: 240,
    patamares: [
      { raio: 29, rumo: 218, dist: 78, cota: 0.9 },
      { raio: 23, rumo: 38, dist: 87, cota: 0.86 },
    ] },
  { id: 'IL43', nome: 'Cayo da Ponta', grupo: 'cayos-sul', x: 7884, z: 766,
    raio: 110, cume: 8, tipo: 'banco', semente: 157, alonga: 2, giro: 90,
    banco: 1.55, dedos: 3, dedoK: 0.42, fase: 195,
    patamares: [
      { raio: 20, rumo: 188, dist: 118, cota: 0.72 },
      { raio: 18, rumo: 333, dist: 131, cota: 0.66 },
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
  // ⚠️ A RESOLUÇÃO PASSOU A SEGUIR O TAMANHO, e é o que permite ter 26 ilhas em
  // vez de 5. Com 176x104 fixos, 26 ilhas custariam 951.408 triângulos numa cena
  // que já roda 6,3 M a 36 fps. Escalando por raio, custam 206.978, ou seja 3,3%
  // da cena e só 13% acima do que as cinco antigas já gastavam (183.040).
  // ⚠️ OS PISOS (72 e 40) NÃO SÃO ENFEITE. A costa é irregular e atravessa os
  // anéis em raios diferentes a cada rumo: com poucos anéis o contorno vira
  // escada. E com 5 dedos, 72 rumos deixam 14 amostras por dedo, que é o mínimo
  // para a enseada ler como enseada e não como dente.
  const NA = Math.max(72, Math.min(200, Math.round(spec.raio * 0.30)))
  const NR = Math.max(40, Math.min(104, Math.round(spec.raio * 0.16)))
  const rn = ruido2(spec.semente)
  const rnFino = ruido2(spec.semente * 31 + 7)
  const g0 = (spec.giro * Math.PI) / 180

  // ⚠️ A COSTA DE ANGRA É RECORTADA, a de banco é lisa e comprida. Enseada funda
  // é o que faz Angra ser Angra: a praia mora no FUNDO dela, protegida.
  const rec = spec.tipo === 'angra' ? 1.6 : spec.tipo === 'banco' ? 0.8 : 0.5
  const nDedo = spec.dedos ?? 0
  const kDedo = spec.dedoK ?? 0
  const faseD = ((spec.fase ?? 0) * Math.PI) / 180
  const raioEm = (a: number) => {
    const s = spec.semente
    const b = spec.raio * (1
      + 0.20 * rec * Math.sin(a * 2 + s * 1.7)
      + 0.14 * rec * Math.sin(a * 3 - s * 2.3)
      + 0.08 * rec * Math.sin(a * 5 + s * 0.9)
      + 0.10 * rec * rn(Math.cos(a) * 2.3 + s, Math.sin(a) * 2.3 - s))
    // ⚠️ OS DEDOS. Enseada funda entre pontas compridas: é isto que transforma
    // 9,5 km de perímetro em 61 km, e é isto que faz a casa de magnata ter
    // frente d'água em vez de fundo de morro.
    return nDedo ? b * (1 + kDedo * Math.cos(nDedo * (a - faseD))) : b
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
    // ⚠️ A PRAIA NÃO ESTÁ MAIS EM `raio * 0,93`, E COM DEDO ISSO IMPORTA. O
    // contorno agora vai de 0,66 a 1,34 do raio nominal: no fundo de uma enseada,
    // 0,93 do raio cai DENTRO DA ÁGUA e a trilha terminava no mar. Aqui o ponto
    // sai da costa de verdade naquele rumo, medida pelo mesmo `raioEm`.
    const [cu, cv] = paraLocal(Math.sin(ab), -Math.cos(ab))
    const rCosta = raioEm(Math.atan2(cv, cu)) * 0.93
    const C = { px: Math.sin(ab) * rCosta, pz: -Math.cos(ab) * rCosta, cota: 0.03 }
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
  // ⚠️ UV EM METROS DE MUNDO, PROJETADO DE CIMA. A malha é um leque polar e nunca
  // teve UV: sem ele o normalMap não tem o que ler. Projeção planar XZ deforma no
  // costão quase vertical, e isso é aceito de propósito: o costão é 1/5 da ilha e
  // a alternativa (UV pelo leque) esticaria o ladrilho no centro, que é onde a
  // praia e o patamar estão.
  {
    const pp = g.getAttribute('position')
    const uv = new Float32Array(pp.count * 2)
    for (let i = 0; i < pp.count; i++) {
      uv[i * 2] = pp.getX(i) / UV_METROS
      uv[i * 2 + 1] = pp.getZ(i) / UV_METROS
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  return g
}

export function buildIlhas(o: { cota: number; sombra?: boolean }): Ilhas {
  const group = new THREE.Group()
  group.name = 'ilhas'
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
  // ⚠️ AQUI O ALBEDO É DESCARTADO DE PROPÓSITO, e a conta é o motivo. A ilha é
  // pintada por VÉRTICE num gradiente que vai de areia (#E2D9BE) a mata fechada
  // (#59684C) a rocha, e cor por vértice MULTIPLICA o mapa igual à cor do
  // material. Vestir com o albedo do 'campo' (meio medido em 98,120,70) pintaria
  // de verde a praia e o patamar de construção, que é justamente o que a
  // gradação existe para separar. Então entram só NORMAL e RUGOSIDADE: o
  // micro-relevo e a resposta de luz chegam, a leitura de uso do solo fica.
  //
  // Custo: zero chamada de desenho (as cinco ilhas já dividiam este material) e
  // zero programa novo (o `quebrarRepeticao` usa chave de cache fixa).
  if (look2) {
    const c = superficie('campo')
    mat.normalMap = c.normalMap
    mat.roughnessMap = c.roughnessMap
    mat.normalScale = new THREE.Vector2(c.normalScale * 1.25, c.normalScale * 1.25)
    mat.roughness = 1
    quebrarRepeticao(mat, 120)
    mat.needsUpdate = true
  }
  // ⚠️ UMA MALHA SÓ PARA AS 26, E ISSO É ORÇAMENTO, NÃO ELEGÂNCIA. Uma malha por
  // ilha eram 5 chamadas de desenho e viraria 26, numa cena que já faz 442 e roda
  // a 36 fps. As geometrias são todas diferentes (cada ilha tem semente própria),
  // então instanciar não serve: o caminho é FUNDIR. Todas já dividiam o mesmo
  // material, todas têm os mesmos atributos (position, color, uv, index), e a
  // posição de cada uma entra por `translate` antes da fusão.
  //
  // ⚠️ O PREÇO É O RECORTE POR TRONCO. Fundidas, as 26 viram um volume de 9 km de
  // lado e o three passa a desenhar as 26 sempre que qualquer uma estiver no
  // quadro. Aceito medindo: 206.978 triângulos no total, 3,3% da cena, contra as
  // 21 chamadas que a alternativa custaria.
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
