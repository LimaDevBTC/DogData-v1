// ═══════════════════════════════════════════════════════════════════════════
// O METRÔ, O BONDE E O BARCO: a rede de transporte da DogCity.
//
// ⚠️ O DADO EXISTIA E NINGUÉM O LIA. `cidade-malha.json` publica `metro` desde
// que o gerador foi escrito: cota, 4 radiais, 2 circulares, 80 estações e 8
// baldeações. Nunca houve uma linha de desenho. Este módulo é o primeiro
// consumidor daquele campo, e a primeira medição dele.
//
// ⚠️ E A MEDIÇÃO REPROVOU O TRAÇADO PUBLICADO EM QUATRO PONTOS. Os quatro estão
// registrados aqui embaixo com número. O defeito 1 é do gerador e só lá se
// conserta; os defeitos 2, 3 e 4 este módulo conserta sozinho, REAMOSTRANDO as
// paradas a partir das linhas em vez de aceitar a lista de estações como está
// (ver `reamostrarEstacoes`). As LINHAS continuam sendo as do gerador: quatro
// radiais e duas circulares, nos mesmos rumos e nos mesmos φ. O que muda é onde
// o trem para.
//
// ⚠️ E NADA AQUI É CONSTANTE. `buildMetro` recebe a rede por parâmetro, então no
// dia em que o gerador publicar o traçado corrigido este arquivo desenha o
// traçado novo sem uma linha de mudança, e `reamostrar: false` volta ao
// comportamento de desenhar exatamente o que veio publicado.
//
// ── O RESULTADO, MEDIDO CONTRA O `cidade-malha.json` DE HOJE ──────────────
//                                        PUBLICADO      REAMOSTRADO (800 m)
//   estações                                  80                60
//   nas 4 radiais                             80                24
//   nas 2 circulares (35,6 km de via)          0                44
//   vão mediano entre paradas               180 m             783 m
//   vão mínimo                                4 m             488 m
//   lotes FORA de 800 m de estação           67,6%             20,7%
//   distância média do quarteirão          1.293 m             613 m
//   docas com baldeação para o metrô        0 de 20          17 de 32
//   triângulos                              26.320            20.398
// A rede fica CONEXA nos dois casos, com as mesmas 8 baldeações.
//
// ── DEFEITO 1: A COTA ABSOLUTA FAZ O TÚNEL AFLORAR ────────────────────────
// `METRO_COTA = -26.0` é cota ABSOLUTA, e é exatamente o erro que as autopistas
// já corrigiram em 30/08 trocando `AUTO_COTA` por `AUTO_PROF` (35 m de cobertura
// medidos a partir da superfície). Medido nas 80 estações publicadas, com
// `altura()` do próprio gerador:
//
//   superfície nas estações   de −36,1 m (E032) a +91,4 m (rumo 270)
//   cobertura sobre o teto    de −10,1 m a +117,4 m
//   estações com o CHÃO ABAIXO DA COTA DO TÚNEL      13 de 80
//   estações com menos de 8 m de cobertura            27 de 80
//
// Ou seja: em 13 estações o metrô publicado passa POR CIMA do terreno. Nos rumos
// 0 e 90 a cidade desce para a baía (superfície de −36 a −13) e o túnel vira
// viaduto; nos rumos 180 e 270 ela sobe até +91 e o túnel fica a 117 m de
// profundidade, que é escada de 39 andares.
//
// ⚠️ E O CRUZAMENTO COM A AUTOPISTA DEIXOU DE SER GARANTIDO. O campo
// `autopistaCota: -42` registrava a separação de camadas: metrô raso a −26,
// autopista funda a −42, e as duas nunca se encontram. Só que a autopista MUDOU
// DE REGRA e hoje corre a 35 m abaixo da superfície: onde o chão está a −36, ela
// está a −71 e o metrô publicado, a −26, ficaria 10 m NO AR. A separação por
// cota absoluta não descreve mais nada. A separação por PROFUNDIDADE, sim, e por
// construção: metrô a 12 m de cobertura, autopista a 35 m, em qualquer ponto do
// sítio, sem exceção e sem verificação.
//
// É o que `perfilDoTunel` faz aqui: o teto é `superficieAt − PROF_TETO`, depois
// alisado por uma rampa máxima de 4%. Medido com o traçado publicado:
//
//   rumo   0   teto a 12,0 a 15,2 m sob a superfície (média 12,3)
//   rumo  90   teto a 12,0 a 15,0 m (média 12,5)
//   rumo 180   teto a 12,0 a 13,8 m (média 12,3)
//   rumo 270   teto a 12,0 a 32,1 m (média 15,4)
//
// A pior escada da cidade cai de 117 m para 32,1 m, e 78 das 80 estações ficam
// entre 12 e 16 m, que é escada rolante única. A rampa de 4% é o teto de
// projeto de metrô real (Londres 3,3%, Nova York 3%); ela é o que impede o perfil
// de copiar cada ondulação do regolito e virar montanha-russa.
//
// ── DEFEITO 2: 80 ESTAÇÕES EM 4 RUAS, E 35,6 km DE CIRCULAR SEM PORTA ─────
// ⚠️ AS 80 ESTAÇÕES PUBLICADAS TÊM `rumo` EM {0, 90, 180, 270}, TODAS AS 80. Ou
// seja estão todas nas quatro radiais, e as duas linhas circulares (13,7 km em
// φ 2.180 mais 21,9 km em φ 3.488) não têm uma estação própria: só 9 estações
// caem sobre alguma circular e 5 dessas são as baldeações que já existiriam de
// qualquer jeito. Desenhar as 80 como estão seria enfileirar 160 embocaduras em
// quatro ruas e deixar duas linhas inteiras sem entrada.
//
// O gerador põe estação em TODA rua de anel sobre a radial, e é daí que vem o
// resto. Medido nos φ publicados de um radial (20 estações):
//
//   vão entre estações vizinhas   4 m (!), 95, 110, 121, 180, 239, 298 m
//   vão mediano                   180 m      (os 76 vãos, TODOS abaixo de 400 m)
//   separação entre radiais vizinhos em r 2.180    3.424 m
//   separação entre radiais vizinhos em r 3.488    5.479 m
//
// E005 (φ 2.176) e E006 (φ 2.180) são DUAS ESTAÇÕES A 4 METROS UMA DA OUTRA: é a
// rua de anel 2.176 encostando na circular 2.180, artefato de gerar estação por
// rua. 180 m é espaçamento de BONDE DE RUA, não de metrô, e 3.424 m entre uma
// linha e a vizinha é distância de trem intermunicipal.
//
// ⚠️ O TOTAL DE 80 ESTÁ QUASE CERTO; A DISTRIBUIÇÃO É QUE ESTÁ ERRADA. A 800 m de
// vão o traçado pede cerca de 24 paradas nas radiais e 44 nas circulares. É o que
// `reamostrarEstacoes` entrega, e o porquê dos 800 m, com fonte primária, está no
// bloco daquela função.
//
// ⚠️ E FILTRAR A LISTA PUBLICADA NÃO RESOLVERIA. Desbastar por vão mínimo (o que
// `desbastar` faz) conserta as radiais e não cria UMA parada nas circulares,
// porque não há nenhuma para filtrar. Só reamostrar a partir da linha põe porta
// nos 35,6 km.
//
// ── DEFEITO 3: 67,6% DOS LOTES FICAM FORA DE QUALQUER ESTAÇÃO ─────────────
// A norma é a APTA (APTA-SUDS-UD-RP-001-09, "Defining Transit Areas of
// Influence"): 400 m (1/4 de milha) de captação a pé para ônibus e 800 m (1/2
// milha) para transporte sobre trilhos. Medido contra os 85.824 lotes dos 1.862
// quarteirões de `cidade-malha.json`, distância euclidiana do centro do
// quarteirão à estação mais próxima:
//
//   REDE PUBLICADA, 4 radiais, 80 estações      400 m  16,6%    800 m  32,4%
//   REAMOSTRADA A 800 m, 60 estações            400 m  36,4%    800 m  79,3%
//
// Na rede publicada 57.999 lotes ficam fora dos 800 m, com distância média de
// 1.293 m e pior quarteirão a 4.046 m. O buraco não era local, era a cidade
// inteira entre os quatro braços: por octante de rumo, o pior era o 270 com
// 10.279 lotes descobertos e o melhor ainda tinha 3.530. Reamostrando, o
// descoberto cai para 17.746 lotes, a média para 613 m e o pior para 2.387 m,
// com VINTE estações A MENOS. Não é mais metrô, é metrô no lugar certo.
//
// ── O CONSERTO MEDIDO, PARA O GERADOR ─────────────────────────────────────
// Três cenários, medidos com o mesmo método e o mesmo conjunto de lotes:
//
//   B  metrô em 9 radiais (os 9 bulevares), desbastado a
//      um mínimo de 700 m entre paradas: 6 paradas por radial
//      = 54 estações, 26 A MENOS que as 80 de hoje        800 m  60,3%
//   T  bonde ("veículo de transporte leve") nos 5 anéis
//      viários AN1..AN5, parada a cada 400 m de arco
//      = 287 paradas                                      400 m  82,2%
//   B + T                                                        91,5%
//   rede publicada + T                                           86,0%
//
// O metrô sozinho NUNCA cobre a cidade, e isso não é defeito dele: metrô de
// verdade é tronco, com vão longo e estação cara. Quem cobre é o modo leve em
// cima do anel viário, que já existe desenhado. Por isso este módulo trata os
// dois no mesmo lugar: a decisão de mobilidade é a soma, não o metrô.
//
// ── DEFEITO 4: O BARCO NÃO ENCOSTAVA NO METRÔ ─────────────────────────────
// Os três canais radiais (CR01 rumo 25, CR02 rumo 55, CR03 rumo 85) cruzam as
// duas circulares do metrô em 6 pontos, e na rede PUBLICADA não existe estação em
// nenhum: as 80 estão todas nos rumos 0, 90, 180 e 270 e nenhum canal está em
// rumo cardeal. Como radial de canal e radial de metrô só se encontrariam no
// centro (e os canais começam em r 1.450), não havia UM ponto de contato entre os
// dois modos: as 20 docas saíam todas com `estacao: null`.
//
// ⚠️ CONSERTADO AQUI, E DE GRAÇA. O cruzamento canal/circular virou CORTE
// OBRIGATÓRIO da reamostragem, então a circular passa a ter parada exatamente em
// cima do canal. Medido depois da mudança: 17 das 32 docas têm baldeação de metrô
// a menos de 300 m. As de CR03 (rumo 85) encostam nas estações da radial de rumo
// 90, que fica a 5 graus: ver a nota do limiar de corte, que é por que aquele
// cruzamento não ganha estação própria.
// A estação não custa lote, porque o cais já é solo público, que é a mesma regra
// que o próprio gerador escreveu para as outras estações.
//
// ── A EMBARCAÇÃO, E A LÂMINA NIVELADA ─────────────────────────────────────
// Ver `docas()`. Resumo: waterbus de 24 m de comprimento por 4,5 m de boca e
// 1,3 m de calado, o porte do vaporetto de Veneza e do barco de canal de
// Amsterdam. A lâmina radial tem 60 m e 3 m de profundidade: 1,7 m de folga sob
// a quilha e 51 m livres com dois barcos cruzando, que é 11 vezes a boca (o
// mínimo de projeto para tráfego em dois sentidos é 3).
//
// ⚠️ A LÂMINA NÃO ACOMPANHA MAIS O CHÃO, E O CABEÇALHO DE `canais.ts` ESTÁ
// DESATUALIZADO NESSE PONTO. Ele ainda diz "a lâmina acompanha o chão e isso é
// uma licença assumida", mas o corpo do mesmo arquivo já não faz isso: `COTA =
// o.cota` e `plaza-scene.tsx` passa `mc.lagos.cota ?? -40`. A água do canal é uma
// lâmina só, absoluta, em −40, coplanar com a baía e com os lagos, e quem
// negocia com o relevo é a parede do cais. Medido nas constantes: NÍVEL −40,0 /
// piso do cais −37,8 / pé do muro −44,0. Para a navegação isso é o cenário BOM:
// canal navegável exige lâmina nivelada, e ela já está nivelada. Não há
// incompatibilidade a resolver.
//
// ── ORÇAMENTO ─────────────────────────────────────────────────────────────
// ⚠️ ZERO TEXTURA NOVA, E ISSO FOI CONFERIDO, NÃO SUPOSTO. Este módulo pede duas
// superfícies a `./materiais`, 'concreto' e 'pedra', e as duas JÁ ESTÃO NO CACHE:
// contadas nas chamadas de `vestir`/`superficie` da pasta, 'concreto' aparece 7
// vezes e 'pedra' 3 antes desta. `superficie()` devolve o mesmo `Conjunto` e
// `vestir()` clona só a Texture (o `repeat` mora nela), nunca a imagem, então o
// three sobe uma vez por `source`. Saldo na conta de 233 texturas: zero.
// Nenhum `onBeforeCompile` próprio,
// logo zero programa de shader novo (o único que entra é o de `quebrarRepeticao`,
// que já existe e tem chave de cache fixa).
//
// ⚠️ O TÚNEL NÃO É MODELADO, E ISSO CUSTA 0 TRIÂNGULO. Ele está a 12 m abaixo do
// chão e não há câmera lá dentro: modelá-lo seria pagar por geometria que nunca
// aparece. O que existe do túnel é o PERFIL, que é dado (`Float64Array` de cotas)
// e serve para duas coisas reais: fixar a profundidade de cada estação (o
// comprimento da escada, que é visível) e alimentar o modo terceira pessoa
// quando ele chegar. O dia em que houver jogador descendo a escada, a caixa da
// estação se modela a partir deste mesmo perfil.
//
// Contagem por instância: boca 142 tri, sinal 12 tri, doca 84 tri. Medido pelo
// `buildMetro` rodando contra o `cidade-malha.json` de hoje:
//
//   115 bocas (60 estações x 2, menos 5 que caíram na água) x 154 =  17.710 tri
//    32 docas (16 cruzamentos x 2 margens)                  x  84 =   2.688 tri
//   TOTAL                                                            20.398 tri
//
// São 3 chamadas de desenho e 0,38% dos 5,3 M de triângulos da cena, num
// orçamento de 373 programas e 233 texturas, sem somar uma textura nem um
// programa. E a reamostragem PAGOU o próprio custo: desenhar as 80 publicadas
// custaria 26.320 tri para entregar 32,4% de cobertura; as 60 reamostradas custam
// 20.398 e entregam 79,3%. Menos geometria e mais do dobro de cidade servida,
// porque nada é modelado duas vezes e nada do que é invisível é modelado uma.
//
// Three.js cru, sem react-three-fiber (ele quebra em runtime neste repo).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { vestir } from './materiais'

// ── as normas, com fonte ────────────────────────────────────────────────────
/** captação a pé de estação sobre trilhos, em metros. APTA-SUDS-UD-RP-001-09. */
export const RAIO_CAPTACAO_TRILHO = 800
/** captação a pé de parada de superfície, em metros. Mesma fonte. */
export const RAIO_CAPTACAO_SUPERFICIE = 400
/** rampa longitudinal máxima de metrô. Londres 3,3%, Nova York 3%; 4% é o teto. */
export const RAMPA_MAX = 0.04
/** cobertura de terra sobre o teto do túnel. Metrô é RASO de propósito: a escada
 *  curta é o que faz a estação ser usada. A autopista fica a 35 m, então as duas
 *  camadas se separam por construção em qualquer ponto do sítio. */
export const PROF_TETO = 12
/** pé-direito da caixa da estação: do teto do túnel ao piso da plataforma. */
export const ALTURA_CAIXA = 8
/** a cota absoluta que o gerador publica hoje. Fica registrada porque o defeito 1
 *  do cabeçalho é sobre ela; o desenho NÃO a usa. */
export const COTA_PUBLICADA = -26

// ── o dado que vem de cidade-malha.json ─────────────────────────────────────
export interface EstacaoDado {
  id: string
  /** rumo da radial em graus, 0 ao norte, crescendo para leste */
  rumo: number
  /** a coordenada de anel do gerador, que NÃO é o raio (ver `phi` em gerar_cidade.py) */
  phi: number
  x: number
  z: number
  transferencia: boolean
}
export interface CanalDado {
  id: string; rumo: number; secao: number; lamina: number
  cota: number; rInicio: number; rFim: number
}
export interface AnelViarioDado { r: number; larg: number }

// ── o grafo ─────────────────────────────────────────────────────────────────
export interface NoRede {
  id: string
  /** ⚠️ EM INGLÊS. Todo texto que o público lê é inglês, inclusive nome de
   *  estação; só o comentário é português. */
  nome: string
  x: number; z: number
  /** a cota da superfície no ponto, de `heightAt` */
  ySuperficie: number
  /** a cota do teto do túnel, do perfil alisado */
  yTeto: number
  /** quanto a escada desce, em metros: `ySuperficie − yTeto + ALTURA_CAIXA` */
  descida: number
  linhas: string[]
  baldeacao: boolean
}
export interface ArestaRede {
  a: string; b: string; linha: string
  /** comprimento no plano, em metros */
  metros: number
}
export type TipoLinha = 'radial' | 'circular'
export interface LinhaRede {
  id: string
  /** ⚠️ EM INGLÊS, como todo nome de linha */
  nome: string
  tipo: TipoLinha
  cor: number
  /** os nós na ordem em que o trem os visita */
  nos: string[]
}
export interface Rede {
  nos: Map<string, NoRede>
  arestas: ArestaRede[]
  linhas: LinhaRede[]
  /** true se um passageiro alcança qualquer estação a partir de qualquer outra */
  conexa: boolean
  /** quantos pedaços desligados o grafo tem. 1 é o valor bom. */
  componentes: number
  /** ids das linhas que ficaram num componente sozinhas */
  linhasIsoladas: string[]
  /** os nós em que duas ou mais linhas se encontram */
  baldeacoes: NoRede[]
  /** via total, em metros */
  metros: number
}

// ── nomes, todos em inglês ──────────────────────────────────────────────────
//
// ⚠️ O NOME SAI DO RUMO E DA BANDA, NÃO DE UMA LISTA À MÃO. Lista à mão quebra
// no dia em que o gerador publicar 9 radiais em vez de 4, e a rede tem de
// sobreviver a isso sem edição. As bandas são as mesmas de `constantes.bandas`
// do gerador (Nucleo/Meio/Bairro/Borda), traduzidas.
const CARDEAL: { rumo: number; nome: string; sigla: string; cor: number }[] = [
  { rumo: 0, nome: 'North', sigla: 'N', cor: 0xe8660d },
  { rumo: 45, nome: 'Northeast', sigla: 'NE', cor: 0xcf9b3a },
  { rumo: 90, nome: 'East', sigla: 'E', cor: 0x4f8fd0 },
  { rumo: 135, nome: 'Southeast', sigla: 'SE', cor: 0x7fa66b },
  { rumo: 180, nome: 'South', sigla: 'S', cor: 0xc2564a },
  { rumo: 225, nome: 'Southwest', sigla: 'SW', cor: 0x8c7fb0 },
  { rumo: 270, nome: 'West', sigla: 'W', cor: 0x3fa192 },
  { rumo: 315, nome: 'Northwest', sigla: 'NW', cor: 0xb0763f },
]

function cardealDe(rumo: number) {
  const r = ((rumo % 360) + 360) % 360
  let melhor = CARDEAL[0]
  let dist = 999
  for (const c of CARDEAL) {
    const d = Math.min(Math.abs(r - c.rumo), 360 - Math.abs(r - c.rumo))
    if (d < dist) { dist = d; melhor = c }
  }
  // dois bulevares podem cair no mesmo cardeal (61,875 e 90 caem em NE e E):
  // o rumo entra no nome quando isso acontece, e quem resolve é `montarRede`.
  return melhor
}

/** a banda do gerador, em inglês, a partir de φ */
function bandaDe(phi: number): string {
  if (phi < 2180) return 'Core'
  if (phi < 3010) return 'Midtown'
  if (phi < 4300) return 'Quarter'
  return 'Edge'
}

// ── o perfil do túnel ───────────────────────────────────────────────────────
/**
 * A cota do TETO do túnel ao longo de um traçado, com duas garantias:
 *   1. nunca menos de `prof` metros de terra em cima, em ponto nenhum;
 *   2. nunca mais de `rampa` de inclinação entre amostras vizinhas.
 *
 * ⚠️ AS DUAS VARREDURAS NÃO SÃO UM ALISAMENTO, SÃO UM ENVELOPE. Alisar por média
 * levantaria o perfil em algum ponto e comeria a cobertura justamente onde ela é
 * escassa. Aqui cada passada só EMPURRA PARA BAIXO (`Math.min`), então a
 * cobertura mínima sobrevive às duas por construção. Uma passada para frente e
 * uma para trás bastam: o resultado é exatamente
 * `min_j (teto0[j] + rampa · |s_i − s_j|)`, que é o maior perfil que respeita as
 * duas condições ao mesmo tempo.
 *
 * ⚠️ `heightAt` TEM DE SER `superficieAt`, e não `heightAt` cru. `superficieAt`
 * já traz a vala dos canais e a bacia dos lagos dentro dele, então onde a
 * circular cruza um canal o perfil MERGULHA sozinho, sem o módulo precisar saber
 * que existe canal. Passar a função errada põe o túnel dentro d'água.
 */
export function perfilDoTunel(
  pontos: readonly { x: number; z: number }[],
  heightAt: (x: number, z: number) => number,
  o: { prof?: number; rampa?: number; fechado?: boolean } = {},
): { teto: Float64Array; s: Float64Array } {
  const n = pontos.length
  const prof = o.prof ?? PROF_TETO
  const rampa = o.rampa ?? RAMPA_MAX
  const teto = new Float64Array(n)
  const s = new Float64Array(n)
  if (n === 0) return { teto, s }
  for (let i = 0; i < n; i++) teto[i] = heightAt(pontos[i].x, pontos[i].z) - prof
  for (let i = 1; i < n; i++) {
    s[i] = s[i - 1] + Math.hypot(pontos[i].x - pontos[i - 1].x, pontos[i].z - pontos[i - 1].z)
  }
  for (let i = 1; i < n; i++) teto[i] = Math.min(teto[i], teto[i - 1] + rampa * (s[i] - s[i - 1]))
  for (let i = n - 2; i >= 0; i--) teto[i] = Math.min(teto[i], teto[i + 1] + rampa * (s[i + 1] - s[i]))
  // ⚠️ LINHA FECHADA PRECISA DE UMA VOLTA A MAIS. A circular emenda o fim no
  // começo, e uma varredura só deixa um degrau na emenda: o último ponto não sabe
  // que o primeiro existe. Duas voltas extras fecham porque a segunda já parte de
  // um perfil que viu a costura inteira.
  if (o.fechado && n > 2) {
    const volta = s[n - 1] + Math.hypot(pontos[0].x - pontos[n - 1].x, pontos[0].z - pontos[n - 1].z)
    for (let passe = 0; passe < 2; passe++) {
      teto[0] = Math.min(teto[0], teto[n - 1] + rampa * (volta - s[n - 1]))
      for (let i = 1; i < n; i++) teto[i] = Math.min(teto[i], teto[i - 1] + rampa * (s[i] - s[i - 1]))
      teto[n - 1] = Math.min(teto[n - 1], teto[0] + rampa * (volta - s[n - 1]))
      for (let i = n - 2; i >= 0; i--) teto[i] = Math.min(teto[i], teto[i + 1] + rampa * (s[i + 1] - s[i]))
    }
  }
  return { teto, s }
}

// ── a cobertura a pé ────────────────────────────────────────────────────────
export interface Cobertura {
  /** quantos alvos (lotes, quarteirões, o que o chamador passar) ficam dentro */
  dentro: number
  fora: number
  total: number
  /** a fração FORA do alcance, que é o número que interessa */
  fracaoFora: number
  /** distância média do alvo à parada mais próxima, em metros */
  distanciaMedia: number
  /** o pior alvo */
  distanciaMaxima: number
}

/**
 * Que fração do tecido fica fora do alcance a pé de qualquer parada.
 *
 * ⚠️ O PESO É O LOTE, NÃO O QUARTEIRÃO. Quarteirão de borda tem 5 lotes e
 * quarteirão do núcleo tem 44: contar quarteirão dá o mesmo peso a uma esquina e
 * a um bairro. Medido com os dois métodos na rede publicada, a diferença é de
 * 32,4% (por lote) contra 33,5% (por quarteirão) de cobertura em 800 m; pequena
 * aqui, mas ela cresce com qualquer rede que favoreça o núcleo, e o número
 * honesto é o de gente.
 *
 * ⚠️ É DISTÂNCIA EM LINHA RETA, e a distância real de caminhada é maior. A APTA
 * usa o círculo justamente por convenção; a literatura (ACCESS Magazine, "Is a
 * Half-Mile Circle the Right Standard for TODs?") registra que o círculo
 * superestima a área servida. Então este número é OTIMISTA: a cobertura real é
 * pior do que a que sai daqui, nunca melhor.
 */
export function coberturaAPe(
  paradas: readonly { x: number; z: number }[],
  alvos: readonly { x: number; z: number; peso?: number }[],
  raio = RAIO_CAPTACAO_TRILHO,
): Cobertura {
  let dentro = 0, total = 0, soma = 0, pior = 0, somaPeso = 0
  for (const a of alvos) {
    const p = a.peso ?? 1
    if (p <= 0) continue
    let d = Infinity
    for (const q of paradas) {
      const dd = (q.x - a.x) * (q.x - a.x) + (q.z - a.z) * (q.z - a.z)
      if (dd < d) d = dd
    }
    d = Math.sqrt(d)
    total += p
    somaPeso += p
    soma += d * p
    if (d > pior) pior = d
    if (d <= raio) dentro += p
  }
  return {
    dentro,
    fora: total - dentro,
    total,
    fracaoFora: total > 0 ? (total - dentro) / total : 0,
    distanciaMedia: somaPeso > 0 ? soma / somaPeso : 0,
    distanciaMaxima: pior,
  }
}

// ── a montagem do grafo ─────────────────────────────────────────────────────
export interface RedeOpts {
  estacoes: readonly EstacaoDado[]
  radiais: readonly number[]
  circulares: readonly number[]
  heightAt: (x: number, z: number) => number
  /** tolerância em φ para dizer que uma estação está SOBRE uma circular */
  tolCircular?: number
  /** ⚠️ vão mínimo entre estações da mesma linha, em metros. Ver defeito 2: os φ
   *  publicados põem duas estações a 4 m uma da outra, e um trem não para duas
   *  vezes no mesmo lugar. Com valor > 0 o grafo FUNDE as vizinhas coladas em um
   *  nó só, mantendo sempre a de baldeação. Isto é do grafo, não do desenho: a
   *  boca continua sendo desenhada onde o gerador mandou. */
  vaoMinimo?: number
}

/**
 * Monta o grafo da rede a partir das estações publicadas e responde a única
 * pergunta que importa antes de desenhar qualquer coisa: dá para ir de qualquer
 * estação a qualquer outra.
 *
 * ⚠️ A CIRCULAR É UM CICLO FECHADO, e é ela que segura a rede em pé. Os 4
 * radiais publicados não se tocam: eles PARAM em φ 1.692 (o gerador descarta
 * φ < R_INICIO + 150) e nenhum deles atravessa o centro. Sem as circulares a rede
 * seria 4 pedaços soltos apontando para uma praça sem estação. Medido: a
 * circular interna (φ 2.180) toca os 4 radiais em E006, E026, E046 e E066, e é
 * só por causa dela que o grafo tem 1 componente.
 */
/**
 * Desbasta as paradas de uma linha para um vão mínimo, sem nunca perder uma
 * baldeação.
 *
 * ⚠️ SEMEIA COM AS OBRIGATÓRIAS E DEPOIS PREENCHE, e a ordem importa. A versão
 * anterior varria da esquerda para a direita e APAGAVA a parada anterior quando
 * chegava numa baldeação colada, mexendo em `nos`, em `linha.nos` e no fim do
 * vetor de arestas ao mesmo tempo: três estruturas para manter em sincronia
 * dentro de um laço, que é onde defeito mora. Aqui a escolha acontece ANTES de
 * qualquer nó existir, e o resto do `montarRede` só vê a lista já limpa.
 *
 * ⚠️ ELE É AGRESSIVO DE PROPÓSITO, e por isso o padrão é ficar DESLIGADO
 * (`vaoMinimo` ausente ou 0 devolve a lista intacta). Medido nos φ publicados
 * com vão mínimo de 700 m: as 20 paradas de um radial caem para 4, porque as
 * baldeações de φ 2.180 e 3.488 estão a 488 e 588 m das vizinhas e comem as duas.
 * Isto é uma ferramenta de medição do traçado, não um conserto: o conserto é o
 * gerador publicar φ de metrô em vez de φ de rua de anel.
 */
function desbastar(est: readonly EstacaoDado[], vaoMin: number): EstacaoDado[] {
  if (vaoMin <= 0) return est.slice()
  const escolhidas: EstacaoDado[] = est.filter((e) => e.transferencia)
  const longe = (e: EstacaoDado) =>
    escolhidas.every((s) => Math.hypot(e.x - s.x, e.z - s.z) >= vaoMin)
  for (const e of est) if (!e.transferencia && longe(e)) escolhidas.push(e)
  return escolhidas.sort((a, b) => a.phi - b.phi)
}

// ═══════════════════════════════════════════════════════════════════════════
// A REAMOSTRAGEM: onde a estação DEVERIA estar
//
// ⚠️ AS 80 ESTAÇÕES PUBLICADAS ESTÃO TODAS NAS QUATRO RADIAIS, E AS DUAS
// CIRCULARES NÃO TÊM UMA PORTA. Conferido nos 80 registros de
// `cidade-malha.json`: todo `rumo` está em {0, 90, 180, 270}. Só 9 estações caem
// sobre alguma circular e 5 delas são baldeação, ou seja 35,6 km de via circular
// (13,7 km em φ 2.180 mais 21,9 km em φ 3.488) sem embocadura própria. Desenhar
// as 80 como estão seria desenhar 160 embocaduras enfileiradas em quatro ruas e
// deixar duas linhas inteiras sem entrada.
//
// ⚠️ O TOTAL DE 80 ESTÁ QUASE CERTO; A DISTRIBUIÇÃO É QUE ESTÁ ERRADA. Com vão de
// 800 m o traçado pede cerca de 24 nas radiais e 44 nas circulares, e é isso que
// esta função produz. Ela NÃO inventa linha: as linhas são as mesmas quatro
// radiais e duas circulares que o gerador publica. Ela só decide ONDE PARAR.
//
// ── POR QUE 800 m, COM FONTE ──────────────────────────────────────────────
// O vão mediano publicado é 180 m (mínimo 4 m, máximo 298 m). Os 76 vãos, sem
// exceção, ficam abaixo de 400 m, que é espaçamento de BONDE DE RUA e não de
// metrô. As referências:
//   Banco Mundial, Urban Rail Development Handbook, Tabela 3.3: metrô é
//     "1 kilometer or more"; Tabela 5.5: material de 80 a 100 km/h pede
//     vão de 600 a 800 m.
//   Roth et al., J. R. Soc. Interface 2012, medido em rede real: Paris 570 m,
//     Nova York 780 m, Tóquio 1,06 km, Londres 1,29 km, Moscou 1,67 km.
//   A prova causal, mesmo material rodante e mesma cidade: Paris Linha 4, vão de
//     424 m, roda a 21 km/h; Linha 14, vão de 1.158 m, roda a 39 km/h. A 180 m a
//     velocidade comercial cai abaixo do que faz alguém preferir o trem.
//   Captação a pé, TCQSM Parte 5 e Banco Mundial: 800 m para estação de trilho
//     (O'Sullivan e Morrall mediram 75% dos passageiros caminhando até 800 m).
// 800 m é o ponto em que as duas exigências se encontram: é o teto do vão que o
// material rodante aproveita E o raio de captação a pé da mesma norma. Vão maior
// anda mais rápido e cobre menos; menor cobre igual e anda pior.
export const VAO_ALVO = 800

/** o ponto de mundo de (rumo, φ). Sem `raioEmPhi` o raio é o próprio φ, que é a
 *  aproximação circular: medido, ela erra de 0,4% (φ 2.180) a 2,7% (φ 3.488),
 *  porque o sítio é superelipse e não círculo. Serve para desenho de depuração,
 *  não para assentar embocadura. */
function pontoDe(
  rumo: number, phi: number,
  raioEmPhi?: (ang: number, phi: number) => number,
): { x: number; z: number } {
  const a = (rumo * Math.PI) / 180
  const r = raioEmPhi ? raioEmPhi(a, phi) : phi
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r }
}

/**
 * Distribui `n` intervalos entre dois cortes obrigatórios, por COMPRIMENTO DE
 * ARCO e não pelo parâmetro.
 *
 * ⚠️ INTERPOLAR φ (OU O ÂNGULO) DIRETO DÁ VÃO DESIGUAL, e a desigualdade não é
 * desprezível: entre φ 2.180 e 3.488 o raio de mundo anda 1.232 m enquanto φ anda
 * 1.308, ou seja o parâmetro corre 6,2% mais rápido que o chão. Numa circular é
 * pior, porque o raio varia com o rumo (medido: 3.345 a 3.583 em φ 3.488, uma
 * diferença de 7,1%) e um passo angular constante daria estação mais espaçada de
 * um lado da cidade que do outro. Então a tabela de arco vem primeiro e o
 * parâmetro sai dela.
 */
function porArco(
  t0: number, t1: number,
  ponto: (t: number) => { x: number; z: number },
  vao: number,
  amostras = 96,
): number[] {
  const ts: number[] = []
  const s: number[] = [0]
  for (let i = 0; i <= amostras; i++) ts.push(t0 + ((t1 - t0) * i) / amostras)
  for (let i = 1; i <= amostras; i++) {
    const a = ponto(ts[i - 1]), b = ponto(ts[i])
    s.push(s[i - 1] + Math.hypot(b.x - a.x, b.z - a.z))
  }
  const L = s[amostras]
  const n = Math.max(1, Math.round(L / vao))
  const out: number[] = []
  for (let k = 1; k < n; k++) {
    const alvo = (L * k) / n
    let i = 1
    while (i < amostras && s[i] < alvo) i++
    const f = (alvo - s[i - 1]) / Math.max(1e-9, s[i] - s[i - 1])
    out.push(ts[i - 1] + (ts[i] - ts[i - 1]) * f)
  }
  return out
}

export interface ReamostraOpts {
  /** as estações publicadas: servem para herdar id e extensão, não posição */
  estacoes: readonly EstacaoDado[]
  radiais: readonly number[]
  circulares: readonly number[]
  /** φ para raio de mundo. Vem de `plaza-scene`, que já monta um para os canais. */
  raioEmPhi?: (ang: number, phi: number) => number
  /** os canais: cada cruzamento com uma circular vira parada OBRIGATÓRIA, que é o
   *  que dá baldeação barco/metrô. Ver o defeito 4 do cabeçalho. */
  canais?: readonly CanalDado[]
  vao?: number
}

/**
 * Reamostra as paradas a partir das LINHAS publicadas, em vez de aceitar a lista
 * de estações como está.
 *
 * ⚠️ FILTRAR A LISTA PUBLICADA NÃO RESOLVERIA. Filtrar por vão mínimo desbasta as
 * radiais (é o que `desbastar` faz) mas não cria uma única parada nas circulares,
 * porque não existe nenhuma para filtrar: as 80 estão todas nos quatro rumos
 * cardeais. Só reamostrar a partir da linha põe porta nos 35,6 km de circular.
 *
 * ⚠️ OS CORTES OBRIGATÓRIOS SÃO A COLUNA DO MÉTODO. Cada trecho entre dois cortes
 * recebe um número INTEIRO de intervalos, então a parada cai exatamente em cima
 * de todo cruzamento que importa e o vão fica quase uniforme dentro do trecho.
 * São três famílias de corte:
 *   as pontas do trecho produtivo da radial (o primeiro e o último φ publicados)
 *   todo cruzamento de radial com circular (as 8 baldeações que já existem)
 *   todo cruzamento de circular com canal (os 6 que faltavam)
 *
 * ⚠️ A EXTENSÃO SAI DO φ PUBLICADO, NÃO DE R_DENTRO ATÉ R_FORA. A radial vai de
 * φ 1.692 a 5.194 e não de 1.450 a 6.900, porque o gerador corta o φ produtivo em
 * 5.400 (`PHI_PRODUTIVO − 100`): além disso não há lote, e estação em cinturão
 * vazio é estação servindo regolito. São 3.502 m de linha útil por radial, e é
 * por isso que saem 6 paradas e não as 7 que 5.450 m dariam.
 *
 * ⚠️ O VÃO DE 4 m É ARTEFATO E MORRE AQUI. E005 (φ 2.176) e E006 (φ 2.180) são a
 * mesma parada publicada duas vezes, empilhada junto da baldeação: o gerador põe
 * estação em toda rua de anel e a rua 2.176 encosta na circular 2.180. Como a
 * reamostragem parte da linha e não da lista, a pilha não tem como sobreviver.
 */
export function reamostrarEstacoes(o: ReamostraOpts): EstacaoDado[] {
  const vao = o.vao ?? VAO_ALVO
  const R = o.raioEmPhi
  const out: EstacaoDado[] = []
  // ⚠️ HERDA O ID PUBLICADO QUANDO A PARADA CAI NO MESMO LUGAR. As 8 baldeações
  // são citadas por id em `cidade-malha.json` e provavelmente em qualquer coisa
  // que venha a ler aquele arquivo; trocar E006 por um id novo quebraria a
  // referência sem necessidade. 30 m de tolerância: o vão real é de centenas.
  const herdar = (x: number, z: number, gerado: string): string => {
    let melhor = gerado, d = 30
    for (const e of o.estacoes) {
      const dd = Math.hypot(e.x - x, e.z - z)
      if (dd < d) { d = dd; melhor = e.id }
    }
    return melhor
  }

  // ── as radiais ──────────────────────────────────────────────────────────
  for (const rumo of o.radiais) {
    const pubs = o.estacoes.filter((e) => Math.abs(e.rumo - rumo) < 0.01)
    if (pubs.length < 2) continue
    const phi0 = Math.min(...pubs.map((e) => e.phi))
    const phi1 = Math.max(...pubs.map((e) => e.phi))
    const cortes = [phi0, phi1]
    for (const c of o.circulares) if (c > phi0 + 1 && c < phi1 - 1) cortes.push(c)
    cortes.sort((a, b) => a - b)
    const phis: number[] = [cortes[0]]
    for (let i = 0; i + 1 < cortes.length; i++) {
      for (const p of porArco(cortes[i], cortes[i + 1], (t) => pontoDe(rumo, t, R), vao)) phis.push(p)
      phis.push(cortes[i + 1])
    }
    let k = 0
    for (const phi of phis) {
      const p = pontoDe(rumo, phi, R)
      k++
      out.push({
        id: herdar(p.x, p.z, `R${Math.round(rumo)}-${String(k).padStart(2, '0')}`),
        rumo, phi: Math.round(phi * 10) / 10,
        x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
        transferencia: o.circulares.some((c) => Math.abs(c - phi) < 1),
      })
    }
  }

  // ── as circulares ───────────────────────────────────────────────────────
  for (const phi of o.circulares) {
    // cortes em RUMO: as radiais, mais os canais que alcançam este φ
    const cortes: number[] = o.radiais.map((r) => ((r % 360) + 360) % 360)
    for (const c of o.canais ?? []) {
      // o canal só cruza esta circular se o φ dela cai dentro do trecho dele.
      // ⚠️ A COMPARAÇÃO É φ CONTRA RAIO, e ela é aproximada de propósito: `rInicio`
      // e `rFim` do canal são RAIO DE MUNDO e φ não é raio. O erro medido é de
      // 2,7% no pior φ, e a folga de 60 m abaixo cobre isso com sobra.
      const p = pontoDe(c.rumo, phi, R)
      const r = Math.hypot(p.x, p.z)
      if (r > c.rInicio + 60 && r < c.rFim - 60) cortes.push(((c.rumo % 360) + 360) % 360)
    }
    // ⚠️ DOIS CORTES COLADOS VIRAM UM VÃO DE 190 m, e isso foi medido nesta
    // própria função antes de existir esta linha. O canal CR03 corre no rumo 85 e
    // a radial leste no rumo 90: são 5 graus, ou 190 m de arco em φ 2.180. Cortar
    // nos dois põe duas estações a 190 m uma da outra, que é o mesmo defeito de
    // vão curto que a reamostragem veio corrigir, reinventado por ela.
    // Quem sobrevive é a RADIAL, porque ela é baldeação de duas linhas de trem; o
    // canal a 190 m de distância continua servido, a pé, pela mesma estação. O
    // limiar é meio vão: mais perto que isso, a segunda parada não paga a parada.
    const raioMedio = Math.hypot(pontoDe(0, phi, R).x, pontoDe(0, phi, R).z) || phi
    const minGrau = ((vao / 2) / (2 * Math.PI * raioMedio)) * 360
    const prio = new Map<number, number>()
    for (const c of cortes) {
      const eRadial = o.radiais.some((r) => Math.abs(((r - c) % 360 + 540) % 360 - 180) < 0.01)
      prio.set(c, Math.max(prio.get(c) ?? 0, eRadial ? 1 : 0))
    }
    const unicos = [...new Set(cortes)].sort((a, b) => a - b)
    const mantidos: number[] = []
    for (const c of [...unicos].sort((a, b) => (prio.get(b)! - prio.get(a)!) || a - b)) {
      // ⚠️ `< minGrau`, NÃO `> 180 − minGrau`. A conta devolve a diferença angular
      // com sinal em (−180, 180]; perto é MÓDULO PEQUENO. Com o sinal invertido a
      // regra só descartava corte ANTIPODAL, que nunca acontece, e o vão de 190 m
      // sobrevivia intacto.
      const perto = mantidos.some((m) => Math.abs((((c - m) % 360) + 540) % 360 - 180) < minGrau)
      if (!perto) mantidos.push(c)
    }
    mantidos.sort((a, b) => a - b)
    const rumos: number[] = []
    for (let i = 0; i < mantidos.length; i++) {
      const a = mantidos[i]
      const b = i + 1 < mantidos.length ? mantidos[i + 1] : mantidos[0] + 360
      rumos.push(a)
      for (const t of porArco(a, b, (u) => pontoDe(u, phi, R), vao)) rumos.push(((t % 360) + 360) % 360)
    }
    let k = 0
    const ci = o.circulares.indexOf(phi)
    for (const rumo of rumos) {
      const p = pontoDe(rumo, phi, R)
      k++
      // ⚠️ A PARADA QUE CAI EM CIMA DE UMA RADIAL NÃO É UMA ESTAÇÃO NOVA. Ela é a
      // MESMA baldeação que o laço das radiais já emitiu, e emiti-la de novo daria
      // duas estações no mesmo ponto (o defeito de 4 m, reinventado). O laço das
      // radiais já pôs a dela lá, com `transferencia: true`; aqui ela é pulada.
      if (o.radiais.some((r) => Math.abs((((r - rumo) % 360) + 540) % 360 - 180) < 0.01)) continue
      out.push({
        id: herdar(p.x, p.z, `C${ci + 1}-${String(k).padStart(2, '0')}`),
        rumo: Math.round(rumo * 100) / 100,
        phi,
        x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
        transferencia: false,
      })
    }
  }
  return out
}

export function montarRede(o: RedeOpts): Rede {
  const tol = o.tolCircular ?? 1
  const vaoMin = o.vaoMinimo ?? 0
  const nos = new Map<string, NoRede>()
  const arestas: ArestaRede[] = []
  const linhas: LinhaRede[] = []

  // ── as radiais ────────────────────────────────────────────────────────────
  // ⚠️ NOME DUPLICADO É ERRO DE MAPA. Dois bulevares podem cair no mesmo cardeal
  // (61,875 e 90 caem os dois perto de leste); quando isso acontece o rumo entra
  // no nome, que é como o mapa de metrô resolve linha homônima.
  const usados = new Map<string, number>()

  for (const rumo of o.radiais) {
    const todas = o.estacoes
      .filter((e) => Math.abs(e.rumo - rumo) < 0.01)
      .sort((a, b) => a.phi - b.phi)
    if (todas.length === 0) continue
    const est = desbastar(todas, vaoMin)

    // o perfil é amostrado a cada 40 m entre estações, e não de estação a
    // estação: entre duas estações a 298 m há colina que a amostra grossa perde.
    const traco: { x: number; z: number }[] = []
    const indiceDaEstacao: number[] = []
    for (let i = 0; i < est.length; i++) {
      indiceDaEstacao.push(traco.length)
      traco.push({ x: est[i].x, z: est[i].z })
      if (i + 1 < est.length) {
        const L = Math.hypot(est[i + 1].x - est[i].x, est[i + 1].z - est[i].z)
        const k = Math.max(1, Math.round(L / 40))
        for (let t = 1; t < k; t++) {
          traco.push({
            x: est[i].x + ((est[i + 1].x - est[i].x) * t) / k,
            z: est[i].z + ((est[i + 1].z - est[i].z) * t) / k,
          })
        }
      }
    }
    const { teto } = perfilDoTunel(traco, o.heightAt)

    const c = cardealDe(rumo)
    const n = (usados.get(c.sigla) ?? 0) + 1
    usados.set(c.sigla, n)
    const id = `R-${c.sigla}${n > 1 ? n : ''}`
    const nome = n > 1 ? `${c.nome} Line ${n}` : `${c.nome} Line`
    const linha: LinhaRede = { id, nome, tipo: 'radial', cor: c.cor, nos: [] }

    let ultimo: NoRede | null = null
    const contaBanda = new Map<string, number>()
    for (let i = 0; i < est.length; i++) {
      const e = est[i]
      const ySup = o.heightAt(e.x, e.z)
      const yTeto = teto[indiceDaEstacao[i]]
      const banda = bandaDe(e.phi)
      const naCircular = o.circulares.some((v) => Math.abs(e.phi - v) < tol)
      let nome2: string
      if (naCircular) {
        // ⚠️ A BALDEAÇÃO GANHA O NOME DO ANEL, não um número: é o nó que o
        // passageiro procura no mapa, e "North Inner" se acha, "North Core 5" não.
        const idx = o.circulares.findIndex((v) => Math.abs(e.phi - v) < tol)
        nome2 = `${c.nome} ${idx === 0 ? 'Inner' : idx === 1 ? 'Outer' : `Ring ${idx + 1}`}`
      } else {
        const k = (contaBanda.get(banda) ?? 0) + 1
        contaBanda.set(banda, k)
        nome2 = `${c.nome} ${banda} ${k}`
      }
      const no: NoRede = {
        id: e.id,
        nome: nome2,
        x: e.x, z: e.z,
        ySuperficie: ySup,
        yTeto,
        descida: ySup - yTeto + ALTURA_CAIXA,
        linhas: [id],
        baldeacao: false,
      }
      nos.set(e.id, no)
      linha.nos.push(e.id)
      if (ultimo) {
        arestas.push({
          a: ultimo.id, b: e.id, linha: id,
          metros: Math.hypot(e.x - ultimo.x, e.z - ultimo.z),
        })
      }
      ultimo = no
    }
    linhas.push(linha)
  }

  // ── as circulares ─────────────────────────────────────────────────────────
  //
  // ⚠️ ELA REUSA O NÓ DO RADIAL ONDE ELE EXISTE E CRIA O SEU ONDE NÃO EXISTE, e
  // as duas metades dessa frase são obrigatórias.
  //   REUSAR: estação de baldeação é UMA estação servida por duas linhas, não duas
  //     estações vizinhas. Se a circular criasse nó próprio na baldeação, o grafo
  //     daria "conexo" com o passageiro trocando de trem por teletransporte.
  //   CRIAR: a versão anterior deste laço SÓ reusava, e por isso as duas
  //     circulares saíam com 4 nós cada, os quatro cruzamentos cardeais. Eram
  //     35,6 km de via com 8 paradas, vão de 3.424 e 5.479 m. As paradas
  //     intermediárias da reamostragem têm rumo que não é rumo de radial nenhuma
  //     (37,4 · 52,1 · 25,0 do canal), então NENHUM laço de radial as cria: se
  //     este aqui também não criar, elas somem da rede depois de calculadas.
  for (let ci = 0; ci < o.circulares.length; ci++) {
    const phi = o.circulares[ci]
    const naLinha = o.estacoes
      .filter((e) => Math.abs(e.phi - phi) < tol)
      .sort((a, b) => Math.atan2(a.x, -a.z) - Math.atan2(b.x, -b.z))
    if (naLinha.length < 2) continue
    const id = `C${ci + 1}`
    const nome = ci === 0 ? 'Inner Circle' : ci === 1 ? 'Outer Circle' : `Ring Line ${ci + 1}`
    const linha: LinhaRede = { id, nome, tipo: 'circular', cor: ci === 0 ? 0xd9d2c2 : 0x8e856f, nos: [] }

    // o perfil do anel, fechado: a mesma cobertura mínima e a mesma rampa de 4%
    // das radiais, agora com a costura resolvida (ver `perfilDoTunel`).
    const traco: { x: number; z: number }[] = []
    const indiceDaEstacao: number[] = []
    for (let i = 0; i < naLinha.length; i++) {
      indiceDaEstacao.push(traco.length)
      traco.push({ x: naLinha[i].x, z: naLinha[i].z })
      const b = naLinha[(i + 1) % naLinha.length]
      const L = Math.hypot(b.x - naLinha[i].x, b.z - naLinha[i].z)
      const k = Math.max(1, Math.round(L / 40))
      for (let t = 1; t < k; t++) {
        traco.push({
          x: naLinha[i].x + ((b.x - naLinha[i].x) * t) / k,
          z: naLinha[i].z + ((b.z - naLinha[i].z) * t) / k,
        })
      }
    }
    const { teto } = perfilDoTunel(traco, o.heightAt, { fechado: true })

    const contaCardeal = new Map<string, number>()
    for (let i = 0; i < naLinha.length; i++) {
      const e = naLinha[i]
      let no = nos.get(e.id)
      if (!no) {
        const ySup = o.heightAt(e.x, e.z)
        const yTeto = teto[indiceDaEstacao[i]]
        const c = cardealDe(e.rumo)
        const k = (contaCardeal.get(c.sigla) ?? 0) + 1
        contaCardeal.set(c.sigla, k)
        no = {
          id: e.id,
          // ⚠️ EM INGLÊS, e pelo setor de rumo: "Outer Circle NE 3" se acha num
          // mapa, um número corrido de 1 a 28 não.
          nome: `${nome} ${c.sigla} ${k}`,
          x: e.x, z: e.z,
          ySuperficie: ySup,
          yTeto,
          descida: ySup - yTeto + ALTURA_CAIXA,
          linhas: [],
          baldeacao: false,
        }
        nos.set(e.id, no)
      }
      no.linhas.push(id)
      no.baldeacao = no.linhas.length > 1
      linha.nos.push(no.id)
    }
    for (let i = 0; i < linha.nos.length; i++) {
      const a = nos.get(linha.nos[i])!
      const b = nos.get(linha.nos[(i + 1) % linha.nos.length])!
      // o arco, não a corda: o trem circula pela linha do anel
      const raioA = Math.hypot(a.x, a.z), raioB = Math.hypot(b.x, b.z)
      const ang = Math.abs(Math.atan2(b.x, -b.z) - Math.atan2(a.x, -a.z))
      const dAng = Math.min(ang, Math.PI * 2 - ang)
      arestas.push({ a: a.id, b: b.id, linha: id, metros: ((raioA + raioB) / 2) * dAng })
    }
    linhas.push(linha)
  }

  // ── componentes conexos ───────────────────────────────────────────────────
  const viz = new Map<string, string[]>()
  for (const a of arestas) {
    if (!viz.has(a.a)) viz.set(a.a, [])
    if (!viz.has(a.b)) viz.set(a.b, [])
    viz.get(a.a)!.push(a.b)
    viz.get(a.b)!.push(a.a)
  }
  const comp = new Map<string, number>()
  let nc = 0
  for (const id of nos.keys()) {
    if (comp.has(id)) continue
    nc++
    const fila = [id]
    comp.set(id, nc)
    while (fila.length) {
      const cur = fila.pop()!
      for (const v of viz.get(cur) ?? []) {
        if (!comp.has(v)) { comp.set(v, nc); fila.push(v) }
      }
    }
  }
  const compsPorLinha = new Map<string, Set<number>>()
  for (const l of linhas) {
    const s = new Set<number>()
    for (const id of l.nos) { const c = comp.get(id); if (c) s.add(c) }
    compsPorLinha.set(l.id, s)
  }
  // uma linha está isolada se o componente dela não tem nenhuma outra linha
  const linhasIsoladas: string[] = []
  for (const l of linhas) {
    const meus = compsPorLinha.get(l.id)!
    const acompanhado = linhas.some((o2) => {
      if (o2.id === l.id) return false
      for (const c of compsPorLinha.get(o2.id)!) if (meus.has(c)) return true
      return false
    })
    if (!acompanhado) linhasIsoladas.push(l.id)
  }

  return {
    nos, arestas, linhas,
    conexa: nc <= 1,
    componentes: nc,
    linhasIsoladas,
    baldeacoes: [...nos.values()].filter((n) => n.baldeacao),
    metros: arestas.reduce((a, b) => a + b.metros, 0),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// O DESENHO
// ═══════════════════════════════════════════════════════════════════════════

/** despejo de triângulos, com a mesma regra de orientação do resto da cena.
 *  ⚠️ ANTI-HORÁRIO VISTO DE FORA, senão a normal aponta para dentro e o backface
 *  culling apaga a face. É a mesma armadilha que `canais.ts` registra. */
class Balde {
  vs: number[] = []
  ns: number[] = []
  uvs: number[] = []
  ix: number[] = []
  private quad(
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number],
    nx: number, ny: number, nz: number, su: number, sv: number,
  ) {
    const i = this.vs.length / 3
    for (const v of [a, b, c, d]) { this.vs.push(v[0], v[1], v[2]); this.ns.push(nx, ny, nz) }
    // UV em METROS DE MUNDO: `vestir(mat, nome, 1)` então repete certo sem o
    // módulo precisar saber o tamanho do ladrilho.
    this.uvs.push(0, 0, su, 0, su, sv, 0, sv)
    this.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  /** uma caixa alinhada aos eixos, do canto mínimo ao máximo. 12 triângulos. */
  caixa(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], 0, 1, 0, dx, dz)   // topo
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], 0, -1, 0, dx, dz)  // base
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, dx, dy)
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, dx, dy)
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, dz, dy)
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, dz, dy)
  }
  /** uma caixa SEM TAMPA e vista por dentro: o poço da escada. 10 triângulos. */
  poco(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, 1, 0, dx, dz)   // fundo
    this.quad([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], 0, 0, -1, dx, dy)
    this.quad([x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], 0, 0, 1, dx, dy)
    this.quad([x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], -1, 0, 0, dz, dy)
    this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], 1, 0, 0, dz, dy)
  }
  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.vs, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.ns, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2))
    g.setIndex(this.ix)
    g.computeBoundingSphere()
    return g
  }
  get triangulos() { return this.ix.length / 3 }
}

// ── a boca: as medidas ──────────────────────────────────────────────────────
//
// ⚠️ A BOCA EXISTE PORQUE NINGUÉM ACHA METRÔ QUE NÃO TEM BOCA. A rede inteira
// está a 12 m abaixo do chão e é invisível; o que o visitante vê da cidade é
// isto. Local: +Z é o eixo da avenida, +X atravessa a pista, origem no chão.
//
// As medidas saem de estação real, não de gosto:
//   ESCADA  8,0 m de vão livre    duas escadas rolantes lado a lado mais fixa
//   POÇO    12 x 8                a boca do Metrô de Moscou e do Bund de Xangai
//   MARQUISE 16 x 11 em balanço   cobre a boca inteira e a fila
//   TOTEM   6,0 m                 o mastro tem de ser lido de 300 m, que é a
//                                 distância entre a estação e o meio do quarteirão
const BOCA = {
  aventalX: 7.0,      // meia largura do avental
  aventalZ: 11.0,     // meio comprimento
  pisoY: 0.42,        // o avental acima do chão
  saia: 2.4,          // ⚠️ 2,4 m e não 0,4: o avental tem 22 m de comprimento e o
                      // sítio tem trecho a 5% de declive; sem saia o canto de
                      // baixo fica no ar. 22 x 5% = 1,1 m, com folga para 10%.
  pocoX: 4.0,
  pocoZ: 6.0,
  pocoFundo: 4.2,     // até onde a escada é visível do lado de fora
  parapeitoH: 1.1,
  parapeitoE: 0.45,
  marqX: 5.5,
  marqZ: 8.0,
  marqY: 5.2,
  marqE: 0.45,
  colunaE: 0.35,
  totemH: 6.0,
  totemE: 0.42,
  placaL: 3.0,
  placaH: 0.9,
  placaY: 4.3,
}

function geometriaDaBoca(): { corpo: THREE.BufferGeometry; sinal: THREE.BufferGeometry; tri: number } {
  const b = new Balde()
  const B = BOCA
  const y0 = -B.saia, y1 = B.pisoY
  // ── o avental em MOLDURA, quatro lajes em volta do poço ──────────────────
  // ⚠️ MOLDURA E NÃO LAJE FURADA. Laje inteira taparia o poço, e furar uma laje
  // custa triangulação de polígono com buraco; quatro caixas dão o mesmo desenho
  // com 48 triângulos e nenhuma matemática.
  b.caixa(-B.aventalX, y0, -B.aventalZ, B.aventalX, y1, -B.pocoZ)
  b.caixa(-B.aventalX, y0, B.pocoZ, B.aventalX, y1, B.aventalZ)
  b.caixa(-B.aventalX, y0, -B.pocoZ, -B.pocoX, y1, B.pocoZ)
  b.caixa(B.pocoX, y0, -B.pocoZ, B.aventalX, y1, B.pocoZ)
  // o poço, aberto em cima
  b.poco(-B.pocoX, -B.pocoFundo, -B.pocoZ, B.pocoX, y1, B.pocoZ)
  // parapeito em três lados: o quarto é a entrada, e ela olha para a calçada
  b.caixa(-B.pocoX - B.parapeitoE, y1, -B.pocoZ - B.parapeitoE,
          B.pocoX + B.parapeitoE, y1 + B.parapeitoH, -B.pocoZ)
  b.caixa(-B.pocoX - B.parapeitoE, y1, -B.pocoZ, -B.pocoX, y1 + B.parapeitoH, B.pocoZ)
  b.caixa(B.pocoX, y1, -B.pocoZ, B.pocoX + B.parapeitoE, y1 + B.parapeitoH, B.pocoZ)
  // marquise em balanço sobre duas colunas: o vão livre é o lado da entrada
  b.caixa(-B.marqX, B.marqY, -B.marqZ, B.marqX, B.marqY + B.marqE, B.marqZ)
  b.caixa(-B.pocoX - B.parapeitoE, y1, -B.marqZ,
          -B.pocoX - B.parapeitoE + B.colunaE, B.marqY, -B.marqZ + B.colunaE)
  b.caixa(B.pocoX + B.parapeitoE - B.colunaE, y1, -B.marqZ,
          B.pocoX + B.parapeitoE, B.marqY, -B.marqZ + B.colunaE)
  // o mastro do sinal, na quina de fora
  b.caixa(B.aventalX - B.totemE, y1, B.aventalZ - B.totemE,
          B.aventalX, y1 + B.totemH, B.aventalZ)

  // ── o sinal, em geometria e material separados ───────────────────────────
  // ⚠️ SEPARADO PORQUE ELE ACENDE E O CONCRETO NÃO. É a mesma divisão que
  // `mobiliario-urbano.ts` faz entre carcaça e difusor, e pelo mesmo motivo: um
  // material emissivo no corpo inteiro acenderia a boca toda como uma lâmpada.
  const s = new Balde()
  s.caixa(B.aventalX - B.placaL, y1 + B.placaY, B.aventalZ - B.totemE - 0.06,
          B.aventalX - B.totemE, y1 + B.placaY + B.placaH, B.aventalZ - B.totemE)
  return { corpo: b.geometria(), sinal: s.geometria(), tri: b.triangulos + s.triangulos }
}

// ── a doca ──────────────────────────────────────────────────────────────────
//
// ⚠️ A EMBARCAÇÃO É UM WATERBUS, E A LÂMINA DECIDE ISSO SOZINHA. Medido no dado
// dos canais e no de `canais.ts`:
//   lâmina radial   60 m           (`secao`/`lamina` de CR01, CR02, CR03)
//   água            −40,0 m        (`cota`, a mesma dos lagos e da baía)
//   leito           −44,0 m        (`FUNDO = 4.0` em canais.ts)
//   piso do cais    −37,8 m        (`DECK = 2.2`, o mesmo da orla da baía)
// Ou seja 3,0 m de profundidade útil e 60 m de largura navegável.
//
// O barco que cabe aí, e que existe no mundo, é o vaporetto de Veneza / o barco
// de canal de Amsterdam: 24 m de comprimento, 4,5 m de boca, 1,3 m de calado.
// A conta fecha em três frentes:
//   FOLGA SOB A QUILHA  3,0 − 1,3 = 1,7 m. O mínimo de projeto é 10 a 15% do
//                       calado, ou 0,2 m; sobra uma ordem de grandeza.
//   DOIS SENTIDOS       60 − 2 x 4,5 = 51 m livres, ou 11 vezes a boca. O mínimo
//                       de canal em dois sentidos é 3 boca; até o anel de 28 m
//                       que o gerador ainda não publicou passaria (19 m, 4 boca).
//   RAIO DE GIRO        o canal tem 60 m e o barco 24: ele dá meia volta dentro
//                       do próprio canal, sem bacia de manobra.
// Barco maior não cabe no calado; barco menor (táxi de 8 m) cabe, e é o segundo
// serviço, mas não é ele que faz transporte de massa.
//
// ⚠️ E O CAIS DE −37,8 É ALTO DEMAIS PARA EMBARCAR. São 2,2 m acima da água, que
// é altura de muro, não de convés. Por isso a doca não é um pedaço de cais: é uma
// PLATAFORMA REBAIXADA a 0,9 m acima da lâmina (altura de convés de waterbus),
// ligada ao passeio por uma rampa de 1,3 m de desnível. Sem esse rebaixo o
// passageiro salta 2,2 m para dentro do barco.
const DOCA = {
  deckX: 3.5,       // meia largura, avançando sobre a água
  deckZ: 7.0,       // meio comprimento, ao longo do canal
  deckAcimaAgua: 0.9,
  deckE: 0.45,
  rampaComp: 6.0,
  guardaH: 1.05,
  guardaE: 0.14,
  cabecoH: 0.85,
  cabecoE: 0.32,
}

function geometriaDaDoca(alturaCais: number): { corpo: THREE.BufferGeometry; tri: number } {
  const b = new Balde()
  const D = DOCA
  // origem: no nível da ÁGUA, +X apontando para dentro do canal, +Z ao longo dele
  const dTopo = D.deckAcimaAgua
  const dBase = dTopo - D.deckE
  b.caixa(-D.deckX, dBase, -D.deckZ, D.deckX, dTopo, D.deckZ)
  // a rampa até o passeio, aproximada por dois degraus: uma cunha custaria o
  // dobro de faces e some sob o corrimão de qualquer forma
  const meio = (dTopo + alturaCais) / 2
  b.caixa(-D.deckX - D.rampaComp / 2, dTopo - 0.4, -2.6, -D.deckX, meio, 2.6)
  b.caixa(-D.deckX - D.rampaComp, meio - 0.4, -2.6, -D.deckX - D.rampaComp / 2, alturaCais, 2.6)
  // guarda-corpo nos dois lados do deck: o vão do meio é onde o barco encosta
  b.caixa(-D.deckX, dTopo, -D.deckZ, D.deckX, dTopo + D.guardaH, -D.deckZ + D.guardaE)
  b.caixa(-D.deckX, dTopo, D.deckZ - D.guardaE, D.deckX, dTopo + D.guardaH, D.deckZ)
  // dois cabeços de amarração, na borda de fora
  for (const z of [-D.deckZ * 0.55, D.deckZ * 0.55]) {
    b.caixa(D.deckX - D.cabecoE, dTopo, z - D.cabecoE / 2,
            D.deckX, dTopo + D.cabecoH, z + D.cabecoE / 2)
  }
  return { corpo: b.geometria(), tri: b.triangulos }
}

// ── a interface do módulo ───────────────────────────────────────────────────
export interface Doca {
  id: string
  /** o que serve esta doca, em inglês: entra em legenda de mapa */
  nome: string
  x: number; z: number
  /** rumo do canal em graus */
  rumo: number
  /** em que margem: −1 ou +1 */
  margem: number
  /** id da estação de metrô a que ela dá baldeação, ou null.
   *  ⚠️ COM `reamostrar: false` ISTO SAI `null` EM TODAS, e não é defeito deste
   *  campo: na rede publicada não existe estação sobre canal nenhum. Medido com a
   *  reamostragem ligada, que é o padrão: 17 das 32 docas ficam a menos de 300 m
   *  de uma estação. Ver defeito 4 do cabeçalho. */
  estacao: string | null
  /** id do anel viário em que ela cai, ou null */
  anel: string | null
}

export interface MetroOpts {
  /** ⚠️ `superficieAt`, NUNCA `heightAt`: é o chão que a câmera vê, e é ele que
   *  já traz a vala do canal dentro, que é o que faz o perfil mergulhar sozinho
   *  onde a circular cruza um canal. */
  heightAt: (x: number, z: number) => number
  estacoes: readonly EstacaoDado[]
  radiais: readonly number[]
  circulares: readonly number[]
  /** os canais de `cidade-malha.json`, para as docas */
  canais?: readonly CanalDado[]
  /** os anéis viários, para amarrar a doca na rua */
  aneisViarios?: readonly (AnelViarioDado & { id?: string; nome?: string })[]
  /** a cota absoluta da água. A mesma de `lagos.cota`; o padrão é −40. */
  aguaCota?: number
  /** máscara de água: boca dentro de lago ou baía não é desenhada */
  molhado?: (x: number, z: number) => boolean
  /** quantas bocas por estação. 2 é o padrão (uma de cada lado do cruzamento);
   *  1 no aparelho fraco. Nunca 0: estação sem boca não existe para o visitante. */
  bocasPorEstacao?: 1 | 2
  /** vão mínimo entre nós do grafo, em metros. Ver `RedeOpts.vaoMinimo`. */
  vaoMinimo?: number
  /** φ para raio de mundo, o mesmo que `plaza-scene` já monta para os canais.
   *  Sem ele a reamostragem usa raio igual a φ, que erra até 2,7%. */
  raioEmPhi?: (ang: number, phi: number) => number
  /** ⚠️ LIGADA POR PADRÃO, e o padrão é decisão, não conveniência. Com `false` o
   *  módulo desenha as 80 estações publicadas como estão, e aí 160 embocaduras
   *  ficam enfileiradas em quatro ruas com vão mediano de 180 m enquanto 35,6 km
   *  de circular ficam sem uma porta. Ver o bloco da reamostragem. */
  reamostrar?: boolean
  /** vão alvo da reamostragem, em metros. Padrão `VAO_ALVO` (800). */
  vao?: number
  sombra?: boolean
}

export interface Metro {
  group: THREE.Group
  rede: Rede
  docas: Doca[]
  /** quantas bocas foram efetivamente desenhadas */
  bocas: number
  triangulos: number
  /** chamadas de desenho que este módulo adiciona à cena */
  chamadas: number
  dispose(): void
}

/**
 * Sobe o metrô, as bocas de superfície e as docas dos canais.
 *
 * ⚠️ ELE NÃO DESENHA TÚNEL, E ISSO É DECISÃO, NÃO PREGUIÇA. Ver o cabeçalho: o
 * túnel está a 12 m sob o chão e nenhuma câmera desta cena entra lá. O que sai
 * daqui é a SUPERFÍCIE (bocas e docas, que são o que existe da rede para quem
 * anda na cidade) mais o GRAFO em `rede`, que é o que o modo terceira pessoa vai
 * consumir quando existir. Custo do túnel em triângulos: zero.
 */
export function buildMetro(o: MetroOpts): Metro {
  const group = new THREE.Group()
  group.name = 'metro'
  const sombra = o.sombra !== false
  const nBocas = o.bocasPorEstacao ?? 2
  const agua = o.aguaCota ?? -40

  // ⚠️ A REAMOSTRAGEM VEM ANTES DE TUDO, inclusive do grafo: ela é quem decide o
  // conjunto de estações, e grafo, embocadura e cobertura saem todos dele. Rodar
  // o grafo na lista publicada e reamostrar só o desenho daria um mapa que não
  // bate com a rede.
  const estacoes = o.reamostrar === false
    ? o.estacoes
    : reamostrarEstacoes({
        estacoes: o.estacoes,
        radiais: o.radiais,
        circulares: o.circulares,
        raioEmPhi: o.raioEmPhi,
        canais: o.canais,
        vao: o.vao,
      })

  const rede = montarRede({
    estacoes,
    radiais: o.radiais,
    circulares: o.circulares,
    heightAt: o.heightAt,
    vaoMinimo: o.vaoMinimo,
  })

  // ── materiais: três, e nenhum gera textura ──────────────────────────────
  // ⚠️ `mundo = 1` porque o `Balde` já emite UV EM METROS DE MUNDO. Passar o
  // tamanho da peça aqui multiplicaria a repetição duas vezes e a calçada sairia
  // com junta de 4 cm.
  const matCorpo = new THREE.MeshStandardMaterial({ color: 0xb9b2a2 })
  vestir(matCorpo, 'concreto', 1)
  const matSinal = new THREE.MeshStandardMaterial({
    color: 0x1b1b1b, emissive: 0xe8660d, emissiveIntensity: 1.1, roughness: 0.6, metalness: 0,
  })
  const matDoca = new THREE.MeshStandardMaterial({ color: 0xa79c86 })
  vestir(matDoca, 'pedra', 1)

  const { corpo: gBoca, sinal: gSinal } = geometriaDaBoca()
  const triBoca = (gBoca.getIndex()?.count ?? 0) / 3
  const triSinal = (gSinal.getIndex()?.count ?? 0) / 3

  // ── onde cada boca cai ──────────────────────────────────────────────────
  //
  // ⚠️ A BOCA NÃO FICA EM CIMA DA ESTAÇÃO, FICA AO LADO DA PISTA. A estação está
  // no eixo do cruzamento, que é asfalto; boca no eixo é boca no meio da avenida.
  // O afastamento saiu da largura publicada dos bulevares que as quatro radiais
  // do metrô ocupam, medida em `cidade-malha.json`:
  //   rumo   0   BUL01   44 m   meia pista 22,0 m
  //   rumo  90   BUL03   34 m   meia pista 17,0 m
  //   rumo 180   BUL05   34 m
  //   rumo 270   BUL08   34 m
  // Com o eixo do avental a 30 m e meia largura de 7 m, a borda de dentro cai em
  // 23 m: sobra 1,0 m para o bulevar de 44 e 6,0 m para os de 34. É pouco no
  // BUL01 e é de propósito, porque a alternativa é afastar todo mundo e deixar a
  // boca no meio do quarteirão. ⚠️ SE O GERADOR ALARGAR BULEVAR ACIMA DE 46 m,
  // ESTE NÚMERO PASSA A INVADIR A PISTA e tem de subir junto.
  const AFASTA = 30
  // ⚠️ O ÍNDICE É SOBRE `estacoes`, A LISTA REAMOSTRADA, e não sobre `o.estacoes`.
  // Depois da reamostragem os ids das paradas novas (C1-03, R90-04) não existem na
  // lista publicada: procurar lá deixaria toda parada de circular SEM EMBOCADURA,
  // que é exatamente o defeito que a reamostragem foi feita para consertar.
  const porId = new Map(estacoes.map((e) => [e.id, e]))
  const alvos: { x: number; z: number; rot: number; y: number }[] = []
  for (const no of rede.nos.values()) {
    const e = porId.get(no.id)
    if (!e) continue
    // ⚠️ A BOCA SE ALINHA COM A LINHA, E NUMA CIRCULAR A LINHA É A TANGENTE. O
    // campo `rumo` de uma parada de circular é o rumo DELA VISTA DO CENTRO, ou
    // seja a direção RADIAL, que na circular é a perpendicular da via. Usar
    // `rumo` direto punha a marquise atravessada na avenida circular e o avental
    // de 22 m cortando as duas pistas. Numa baldeação vale o radial, porque o
    // bulevar de 34 a 44 m é o espaço público mais largo dos dois.
    const soCircular = !o.radiais.some((r) => Math.abs(((r - e.rumo) % 360 + 540) % 360 - 180) < 0.01)
    const a = ((e.rumo + (soCircular ? 90 : 0)) * Math.PI) / 180
    // a perpendicular ao rumo: é para lá que a boca sai da pista
    const px = Math.cos(a), pz = Math.sin(a)
    for (let k = 0; k < nBocas; k++) {
      const lado = k === 0 ? 1 : -1
      const bx = e.x + px * AFASTA * lado
      const bz = e.z + pz * AFASTA * lado
      if (o.molhado?.(bx, bz)) continue
      // ⚠️ A COTA SAI DO CANTO MAIS BAIXO DO AVENTAL, não do centro. Pousado no
      // centro, um avental de 22 m num declive de 5% deixa 55 cm de vão no canto
      // de baixo, que é exatamente o buraco por onde o regolito aparece. Quatro
      // amostras custam quatro chamadas por boca, uma vez, no boot.
      let yMin = Infinity
      for (const [dx, dz] of [
        [BOCA.aventalX, BOCA.aventalZ], [-BOCA.aventalX, BOCA.aventalZ],
        [BOCA.aventalX, -BOCA.aventalZ], [-BOCA.aventalX, -BOCA.aventalZ],
      ]) {
        const wx = bx + dx * Math.cos(a) - dz * Math.sin(a)
        const wz = bz + dx * Math.sin(a) + dz * Math.cos(a)
        yMin = Math.min(yMin, o.heightAt(wx, wz))
      }
      // ⚠️ A BOCA TEM DE OLHAR PARA A PISTA, E O SINAL DO GIRO NÃO É ÓBVIO.
      // Conferido na matriz do three (giro θ em torno de Y leva o local (0,0,1)
      // para (sen θ, cos θ) e o local (1,0,0) para (cos θ, −sen θ)):
      //   o eixo da avenida no rumo `a` é (sen a, −cos a)
      //   local +Z sobre esse eixo  =>  sen θ = sen a e cos θ = −cos a  =>  θ = π − a
      //   nesse θ, o local +X aponta para −(cos a, sen a), ou seja PARA O EIXO
      // Como a boca do lado +1 está deslocada em +(cos a, sen a), é ela que usa
      // θ = π − a; a do lado −1 usa θ = −a, que espelha as duas coisas de uma vez.
      // Com o sinal trocado (que era o que estava aqui) as duas bocas viravam de
      // costas para a avenida e a marquise cobria o lote do vizinho.
      alvos.push({ x: bx, z: bz, rot: lado > 0 ? Math.PI - a : -a, y: yMin })
    }
  }

  const bocas = new THREE.InstancedMesh(gBoca, matCorpo, Math.max(1, alvos.length))
  const sinais = new THREE.InstancedMesh(gSinal, matSinal, Math.max(1, alvos.length))
  bocas.name = 'metro-bocas'
  sinais.name = 'metro-sinais'
  bocas.castShadow = sombra
  bocas.receiveShadow = sombra
  // ⚠️ O SINAL NÃO PROJETA SOMBRA. Ele é uma placa emissiva de 3 x 0,9 m e a
  // sombra dela custa a mesma passada de shadow map que um prédio.
  sinais.castShadow = false
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const um = new THREE.Vector3(1, 1, 1)
  const pos = new THREE.Vector3()
  for (let i = 0; i < alvos.length; i++) {
    const t = alvos[i]
    q.setFromAxisAngle(eixoY, t.rot)
    pos.set(t.x, t.y, t.z)
    m.compose(pos, q, um)
    bocas.setMatrixAt(i, m)
    sinais.setMatrixAt(i, m)
  }
  // ⚠️ `count` EXPLÍCITO. Uma InstancedMesh nasce com a contagem do construtor, e
  // o `Math.max(1, ...)` acima desenharia uma instância de matriz zerada (uma
  // boca esmagada na origem, dentro do castelo do Satoshi) quando a lista vem
  // vazia. É a mesma nota que `mobiliario-urbano.ts` já registrou.
  bocas.count = alvos.length
  sinais.count = alvos.length
  bocas.instanceMatrix.needsUpdate = true
  sinais.instanceMatrix.needsUpdate = true
  if (alvos.length > 0) { group.add(bocas); group.add(sinais) }

  // ── as docas ────────────────────────────────────────────────────────────
  // ⚠️ COM `estacoes` REAMOSTRADAS, não com `o.estacoes`: é o que preenche o
  // campo `estacao` da doca e fecha a baldeação barco/metrô.
  const docas = calcularDocas({
    canais: o.canais, aneisViarios: o.aneisViarios,
    circulares: o.circulares, estacoes, raioEmPhi: o.raioEmPhi,
  })
  const alturaCais = 2.2   // `DECK` de canais.ts: o piso do cais acima da lâmina
  const { corpo: gDoca } = geometriaDaDoca(alturaCais)
  const triDoca = (gDoca.getIndex()?.count ?? 0) / 3
  const docaMesh = new THREE.InstancedMesh(gDoca, matDoca, Math.max(1, docas.length))
  docaMesh.name = 'metro-docas'
  docaMesh.castShadow = sombra
  docaMesh.receiveShadow = sombra
  for (let i = 0; i < docas.length; i++) {
    const d = docas[i]
    const a = (d.rumo * Math.PI) / 180
    // ⚠️ MESMO GIRO DA BOCA, PELA MESMA CONTA, e ele NÃO leva meia volta de 90°.
    // O local +X da doca tem de apontar para o EIXO do canal, que é para onde ela
    // avança sobre a água: em θ = π − a o local +X aponta para −(cos a, sen a), e
    // a doca da margem +1 está justamente deslocada em +(cos a, sen a). Com o
    // quarto de volta que estava aqui, o deck ficava PARALELO ao canal em vez de
    // entrar nele, e os cabeços de amarração apontavam para o lote.
    q.setFromAxisAngle(eixoY, d.margem > 0 ? Math.PI - a : -a)
    pos.set(d.x, agua, d.z)
    m.compose(pos, q, um)
    docaMesh.setMatrixAt(i, m)
  }
  docaMesh.count = docas.length
  docaMesh.instanceMatrix.needsUpdate = true
  if (docas.length > 0) group.add(docaMesh)

  const triangulos = alvos.length * (triBoca + triSinal) + docas.length * triDoca
  const chamadas = (alvos.length > 0 ? 2 : 0) + (docas.length > 0 ? 1 : 0)

  return {
    group,
    rede,
    docas,
    bocas: alvos.length,
    triangulos,
    chamadas,
    dispose() {
      gBoca.dispose(); gSinal.dispose(); gDoca.dispose()
      matCorpo.dispose(); matSinal.dispose(); matDoca.dispose()
      group.clear()
    },
  }
}

/**
 * Onde as docas caem: em todo cruzamento de canal com anel viário, mais os
 * cruzamentos com as circulares do metrô.
 *
 * ⚠️ DOCA SÓ EXISTE ONDE JÁ CHEGA RUA. Doca no meio do canal é ponto de embarque
 * sem como chegar nele: o passageiro desce do barco num cais e depois anda 800 m
 * até a esquina. Os anéis viários (AN1 a AN7) são exatamente as sete vias que
 * cruzam os três canais, então cada cruzamento já é uma ponte com passeio dos
 * dois lados, e a doca só desce daquele passeio para a água.
 *
 * ⚠️ E ELA CAI NAS DUAS MARGENS. Canal de 60 m é intransponível a pé fora da
 * ponte; doca numa margem só serve metade da cidade e obriga a travessia. É a
 * mesma regra da boca de metrô, pelo mesmo motivo.
 */
export function calcularDocas(o: {
  canais?: readonly CanalDado[]
  aneisViarios?: readonly (AnelViarioDado & { id?: string; nome?: string })[]
  circulares?: readonly number[]
  /** ⚠️ A LISTA REAMOSTRADA, não a publicada. É nela que existe estação sobre
   *  canal; na publicada não existe nenhuma (defeito 4). */
  estacoes?: readonly EstacaoDado[]
  raioEmPhi?: (ang: number, phi: number) => number
}): Doca[] {
  const out: Doca[] = []
  const canais = o.canais ?? []
  const aneis = o.aneisViarios ?? []
  const estacoes = o.estacoes ?? []
  // a estação a menos de 300 m da doca, que é o que faz a baldeação existir. 300 m
  // é passagem de estação, não caminhada de cidade: em Londres o corredor de
  // Monument a Bank tem 200 m e conta como uma estação só.
  const estacaoPerto = (x: number, z: number): string | null => {
    let melhor: string | null = null, d = 300
    for (const e of estacoes) {
      const dd = Math.hypot(e.x - x, e.z - z)
      if (dd < d) { d = dd; melhor = e.id }
    }
    return melhor
  }
  for (let ci = 0; ci < canais.length; ci++) {
    const c = canais[ci]
    const a = (c.rumo * Math.PI) / 180
    const ux = Math.sin(a), uz = -Math.cos(a)      // ao longo do canal
    const px = Math.cos(a), pz = Math.sin(a)       // atravessando
    // o afastamento da margem: meia lâmina menos meia doca, para o deck ficar
    // dentro d'água sem encostar no eixo
    const off = c.lamina / 2 - DOCA.deckX - 0.5
    const emitir = (r: number, chave: string, onde: string, anel: string | null) => {
      for (const margem of [1, -1]) {
        const x = ux * r + px * off * margem
        const z = uz * r + pz * off * margem
        out.push({
          id: `${c.id}-${chave}-${margem > 0 ? 'A' : 'B'}`,
          nome: `${nomeDoCanal(ci)} Wharf, ${onde} (${margem > 0 ? 'Left' : 'Right'} Bank)`,
          x, z, rumo: c.rumo, margem,
          estacao: estacaoPerto(x, z),
          anel,
        })
      }
    }
    // ── doca de RUA: todo cruzamento com anel viário ──────────────────────
    for (const an of aneis) {
      if (an.r < c.rInicio + 60 || an.r > c.rFim - 60) continue
      emitir(an.r, an.id ?? `R${Math.round(an.r)}`, nomeDoAnel(an), an.id ?? null)
    }
    // ── doca de METRÔ: todo cruzamento com circular ───────────────────────
    //
    // ⚠️ ESTA É A QUE FALTAVA, E ELA SÓ PASSOU A EXISTIR DEPOIS DA REAMOSTRAGEM.
    // Enquanto as estações eram as 80 publicadas, todas nos rumos cardeais, um
    // canal nos rumos 25, 55 ou 85 não tinha como encontrar nenhuma: `estacao`
    // saía `null` nas 20 docas e a baldeação barco/metrô era impossível. Agora a
    // circular tem parada em cima do canal (o cruzamento é corte obrigatório da
    // reamostragem), então a doca cai a poucos metros da boca do metrô.
    for (const phi of o.circulares ?? []) {
      const p = o.raioEmPhi
        ? (() => { const rr = o.raioEmPhi!(a, phi); return { r: rr } })()
        : { r: phi }
      if (p.r < c.rInicio + 60 || p.r > c.rFim - 60) continue
      const ci2 = (o.circulares ?? []).indexOf(phi)
      emitir(p.r, `C${ci2 + 1}`, ci2 === 0 ? 'Inner Circle' : 'Outer Circle', null)
    }
  }
  return out
}

// ⚠️ O NOME PÚBLICO É INGLÊS E NÃO PODE VIR DO JSON. `aneisViarios[].nome` está
// em PORTUGUÊS ("Anel Interior", "Avenida da Doca") porque o gerador é interno, e
// repassar aquele campo direto punha "CR01 Wharf at Anel Interior" na legenda do
// mapa: metade em inglês, metade em português. A tradução mora aqui, indexada
// pelo id, com o raio como último recurso para anel que o gerador inventar depois.
const ANEL_EN: Record<string, string> = {
  AN1: 'Inner Ring',
  AN2: 'Middle Ring',
  AN3: 'Outer Ring',
  AN4: 'Belt Avenue',
  AN5: 'Dock Avenue',
  AN6: 'Outflow Avenue',
  AN7: 'Service Road',
}
function nomeDoAnel(an: { r: number; id?: string }): string {
  return (an.id ? ANEL_EN[an.id] : undefined) ?? `Ring ${Math.round(an.r)}`
}

// ⚠️ "LEFT BANK" E "RIGHT BANK", NÃO "EAST" E "WEST". Os três canais correm nos
// rumos 25, 55 e 85: chamar as margens de leste e oeste está errado em todos os
// três, e no de 85 as margens são quase norte e sul. Margem esquerda e direita é
// a nomenclatura fluvial de verdade (olhando rio abaixo, e aqui rio abaixo é para
// fora, na direção da baía), e ela vale em qualquer rumo.
const ROMANO = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
function nomeDoCanal(i: number): string {
  return `Canal ${ROMANO[i] ?? i + 1}`
}
