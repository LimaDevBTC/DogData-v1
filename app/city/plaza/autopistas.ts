// ═══════════════════════════════════════════════════════════════════════════
// AS TRÊS SUPERVIAS (AUTOPISTAS)
//
// O pedido do fundador, 03/09: "o projeto tinha 3 supervias que contornavam
// toda a cidade. Elas obrigatoriamente precisam existir e estarem conectadas ao
// resto da malha viária. Precisamos de viadutos, rota de saída para os bairros.
// Não se preocupe com posicionamento de lotes, eles serão gerados sobre a
// infra, então nosso papel é deixar essa infra pronta para a divisão dos lotes."
//
// Este módulo é a infra. Ele NÃO desenha lote, não mexe na teia e não edita
// nenhum arquivo vizinho: `vias.ts` e `teia.ts` entram como LEITURA.
//
// ── 1. ELAS SÃO CORDAS, E EU CONFERI ───────────────────────────────────────
//
// `public/city/cidade-malha.json` publica `autopistas` com `rumo` e
// `afastamento`, e nenhum módulo desta cena lia esse campo: as supervias nunca
// foram desenhadas. O gerador (`scripts/gerar_cidade.py:858`) monta cada uma
// como CORDA, não como radial, e o teste que sobrou lá (`em_diagonal`) prova a
// convenção:
//
//     |x·cos(rumo) + z·sin(rumo) − afastamento| < largura/2
//
// ou seja normal n = (cos rumo, sin rumo), direção d = (−sin rumo, cos rumo), e
// o eixo é o lugar dos pontos com p·n = afastamento. MEDIDO aqui: as três
// passam a 1.750, −2.050 e 1.500 m do centro, com meia-corda
// √(5500² − afastamento²) de 5.104 a 5.292 m. São cordas. Confirmado.
//
// ⚠️ E AS BOCAS PUBLICADAS NÃO ESTÃO SOBRE A PRÓPRIA CORDA. Medido nas seis, a
// distância entre a boca publicada e a ponta teórica da corda dela:
//
//     AU1A 3.570 m   AU1B   990 m
//     AU2A 5.611 m   AU2B 1.353 m      (AU2A fica 5.327 m FORA do eixo,
//     AU3A   771 m   AU3B 1.366 m       do lado errado da cidade)
//
// A causa está no próprio gerador: a boca é uma peça de 380 × 240 m que passa
// pelo ALOCADOR DE PEÇAS junto com as outras 38, e o alocador a empurra para a
// primeira célula inteira da teia que estiver livre. Ela saiu procurando vaga e
// nunca voltou para o eixo. O campo `bocas` descreve onde a peça FOI PARAR na
// rodada de loteamento de 02/09, não onde o portal do túnel deve ficar.
//
// ⚠️ POR ISSO EU IGNOREI `bocas` E FIQUEI COM A CORDA, e a autorização é a
// frase do próprio pedido: "não se preocupe com posicionamento de lotes, eles
// serão gerados sobre a infra". A reserva de 02/09 vai ser regerada em cima
// desta infra; o eixo geométrico é o dado que sobrevive. Quem for regerar lote
// consulta `reservado()` no fim deste arquivo, que publica a pegada NOVA.
//
// ── 2. O AFLORAMENTO, MEDIDO ───────────────────────────────────────────────
//
// O JSON publica `cota: −42` para as três. O sítio ondula de −90 a +160 m, então
// uma cota FIXA não é túnel: onde o chão afunda abaixo de −35,5 (a laje de
// cobertura da caixa) a caixa sai do terreno. MEDIDO por mim em 03/09,
// amostrando o eixo de 25 em 25 m contra `btc-core-heightmap.f32` com a mesma
// função `altura()` do gerador:
//
//     AU1   2.551 m afloram de 10.428 m  (24,5%)   cobertura < 10 m em 3.351 m
//     AU2   2.001 m afloram de 10.207 m  (19,6%)   cobertura < 10 m em 4.403 m
//     AU3       0 m afloram de 10.583 m  ( 0,0%)   cobertura < 10 m em     0 m
//     ─────────────────────────────────────────────────────────────────────
//     4.552 m de túnel a céu aberto por defeito de cota.
//
// ⚠️ E A CORREÇÃO ÓBVIA TAMBÉM REPROVA. "Assentar o teto em superficieAt − 35",
// que é o que `AUTO_PROF` no gerador propõe, faz o greide COPIAR o relevo:
// medido, a rampa chega a 24,7% na AU1 e 12,7% na AU2. Isso não se dirige.
// Numa cidade que vai virar terceira pessoa, greide é requisito, não estética.
//
// ⚠️ O QUE EU USEI: ENVOLTÓRIA INFERIOR COM RAMPA LIMITADA. O perfil é
//
//     alvo[i] = terreno[i] − COBERTURA − GABARITO
//     env     = min-plus de alvo com |rampa| ≤ RAMPA_TRONCO   (2 passadas)
//     env     = média móvel de CURVA_VERTICAL m               (2 passadas)
//     y       = max(env, rampa do portal A, rampa do portal B)
//
// A passada min-plus só EMPURRA PARA BAIXO, então `y ≤ alvo` no trecho
// enterrado por construção: a cobertura nunca fica abaixo de COBERTURA lá. As
// duas rampas de portal são as únicas coisas que sobem, e sobem a exatamente
// RAMPA_TRONCO. Máximo de três funções com |derivada| ≤ 4% tem |derivada| ≤ 4%,
// então o greide inteiro sai dentro da norma sem clamp nenhum depois.
//
// RESULTADO MEDIDO, já com os portais reposicionados (item 3):
//
//     AU1   9.349 m   túnel  8.822 m (94,4%)   trincheira 476 m   viaduto  50 m
//     AU2  11.127 m   túnel 10.677 m (96,0%)   trincheira 450 m   viaduto   0 m
//     AU3  13.470 m   túnel 12.944 m (96,1%)   trincheira 526 m   viaduto   0 m
//     ─────────────────────────────────────────────────────────────────────
//     33.946 m no total, 32.443 m invisíveis, 1.502 m de obra à vista.
//     Rampa máxima 4,00% nas três. Fundo mais profundo: −88,4 m (AU2).
//
// Zero metro aflora por acidente. Os 1.502 m abertos são PROJETO: a trincheira
// dos seis portais e um viaduto de 50 m na AU1, onde o terreno cai mais rápido
// do que 4% e passar por baixo custaria mais escavação do que atravessar por
// cima. É a resposta ao "precisamos de viadutos".
//
// ⚠️ TODOS OS NÚMEROS ACIMA FORAM MEDIDOS CONTRA `altura()` DO GERADOR, que é o
// relevo do `btc-core-heightmap.f32` com a rampa do platô, e NÃO contra o
// `superficieAt` que este módulo consome em produção. Os dois concordam no
// grosso do sítio e divergem no talude fino, na cava dos canais e sob a lâmina.
// A conta é feita de novo em tempo de execução, com o `heightAt` que chegar por
// `opts`: se a divergência importar, ela aparece nos campos `metrosDe*` do
// retorno, que é onde se remede sem abrir o arquivo.
//
// ── 3. OS PORTAIS AFOGADOS ─────────────────────────────────────────────────
//
// ⚠️ A PONTA NORDESTE DA AU1 E DA AU2 NASCE DENTRO DA BAÍA. Medido ao longo da
// corda: na AU1 o terreno está em −48 m já em r 4.379 e continua CAINDO até −76
// em r 6.745; a lâmina única da cidade está em −40. Não existe ponto seco
// naquela ponta, em raio nenhum. Um portal ali abriria debaixo d'água.
//
// A boca sobe até encontrar terra: o portal é o t mais externo cujo terreno fica
// acima de `cotaAgua + BORDA_LIVRE` num pátio de PATIO_SECO metros para dentro.
// Medido, isso põe a boca norte da AU1 em r 3.196 e a da AU2 em r 4.980, as
// duas na ORLA da baía, que é a frente construída da cidade. As outras quatro
// alcançam r 6.900, o anel externo da teia, que é a "rota de saída para os
// bairros" pedida: sai do portal e cai direto no anel que dá a volta na cidade.
//
// ── 4. VIA EXPRESSA NÃO ACEITA ENTRADA EM QUALQUER PONTO ────────────────────
//
// Se aceitasse, deixava de ser expressa e virava avenida. O espaçamento mínimo
// entre acessos aqui é 1.600 m, que é a regra do AASHTO Green Book: mínimo de
// 1,6 km (1 milha) entre interseções em área urbana e 3,2 km (2 milhas) em área
// rural. Fonte consultada em 03/09: TxDOT Roadway Design Manual 15.6 (General
// Design Considerations) e o WSDOT Design Manual capítulo 1360, que citam o
// número do Green Book.
//
// ⚠️ E O NÚMERO ELIMINA CANDIDATO DE VERDADE, não é enfeite. As cordas cruzam as
// 12 avenidas radiais da teia em 5 pontos cada dentro do tecido, e MEDIDO, três
// desses cruzamentos ficam a 963, 1.112 e 961 m do vizinho. Aceitar os cinco
// daria trevo a menos de 1 km um do outro, que é interseção de avenida. Foram
// recusados. O critério completo:
//
//   · candidato = cruzamento da corda com uma das 12 avenidas radiais (é a
//     única classe de via com seção para absorver saída de expressa: 34 ou 44 m)
//   · varredura da ponta A para a ponta B, aceita se ≥ 1.600 m do último aceito
//     E ≥ 1.600 m do portal de chegada
//   · vão que sobrar acima de 3.200 m ganha UM trevo no anel viário mais
//     próximo do meio do vão (a segunda melhor via: 26 m). É o teto rural do
//     Green Book usado como limite superior, para não deixar 4,7 km de expressa
//     sem saída nenhuma.
//
// MEDIDO, o que sobrou:
//
//     AU1   3 trevos + 2 portais =  5 acessos   vãos 1.895 / 2.051 / 2.659 / 2.744
//     AU2   4 trevos + 2 portais =  6 acessos   vãos 2.007 / 1.745 / 2.447 / 2.368 / 2.560
//     AU3   4 trevos + 2 portais =  6 acessos   vãos 3.022 / 2.541 / 1.778 / 3.147 / 2.982
//     ─────────────────────────────────────────────────────────────────────
//     11 trevos + 6 portais = 17 acessos. Menor vão 1.745 m, maior 3.147 m.
//
// ── 5. GEOMETRIA DE VEÍCULO, PORQUE ISTO VAI SER DIRIGIDO ──────────────────
//
// Velocidade de projeto 100 km/h no tronco, 60 km/h nas alças.
//   · rampa máxima do tronco  4,0%  (AASHTO admite até 6% em urbano ondulado;
//     4% é o desejável e é o que o perfil entrega medido)
//   · rampa máxima da alça    6,0%  (TxDOT Roadway Design Manual 15.7, alça de
//     trevo: 6% desejável, 8% máximo absoluto)
//   · raio mínimo horizontal  R = V² / (127 (e + f)), e = 6%, f = 0,14
//       tronco 100 km/h → 393,7 m, adotado 400 m (o tronco é RETO, então cumpre
//       por construção; o número fica declarado para quem editar o traçado)
//       alça    60 km/h → 141,7 m, adotado 150 m
//   · curva vertical: a média móvel de CURVA_VERTICAL m arredonda a quebra de
//     greide. Com quebra máxima de 8% (de +4 para −4) o Green Book pede
//     L = K·A = 52 × 8 = 416 m de curva de lombada a 100 km/h; a janela de 175 m
//     aplicada DUAS VEZES equivale a ~350 m de suavização. Fica 16% curta do
//     ideal, e registro isso como dívida em vez de esconder: alongar a janela
//     rouba cobertura no fundo das concavidades, e cobertura é o que segura o
//     item 2. Quem quiser fechar o número mexe em CURVA_VERTICAL e remede.
//
// ── 6. ORÇAMENTO ───────────────────────────────────────────────────────────
//
// A cidade trava o Safari do iPhone do fundador: 455 MB de textura, 233
// texturas, 5,3 M de triângulos, 373 programas. As regras que eu segui:
//
//   · 32.443 dos 33.946 m NÃO SÃO DESENHADOS. Túnel enterrado é invisível: o
//     laço pula todo trecho com cobertura ≥ COBERTURA_ABERTA. 95,6% do
//     comprimento custa zero triângulo.
//   · 1.414 TRIÂNGULOS no sistema inteiro, contados replicando o laço de
//     desenho contra o relevo real: 342 de pavimento (57 segmentos de 25 m ×
//     3 bandas), 220 de parede de trincheira (55 segmentos × 2 lados), 8 de
//     viga de bordo e 16 de pilar no único viaduto, 144 nos 6 batentes de
//     portal e 684 nas 22 bocas de alça (171 segmentos de 20 m). É 0,027% dos
//     5,3 M de triângulos que a cena já carrega.
//   · DUAS CHAMADAS DE DESENHO no total, para o sistema inteiro: uma malha de
//     asfalto e uma de concreto, as duas fundidas em `BufferGeometry` própria
//     (sem `mergeGeometries`: as fitas já nascem num vetor só).
//   · ZERO TEXTURA NOVA. `superficie('asfalto')` e `superficie('concreto')` vêm
//     do cache compartilhado de `materiais.ts`; `vestir` clona a Texture para
//     mudar o `repeat`, e clone de Texture divide a mesma `source` na GPU.
//   · ZERO PROGRAMA NOVO. Este arquivo não tem `onBeforeCompile` nenhum. O único
//     gancho é o que `vestir` instala por dentro (`quebrarRepeticao`), que tem
//     `customProgramCacheKey` FIXA de propósito lá.
//   · O culler recebe o grupo inteiro com centro no meio do sítio. Registrar
//     obra por obra daria culling mais fino e 34 chamadas de desenho em vez de
//     2; a 6.156 triângulos o culling fino não paga o preço.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three'
import { superficie, vestir, type Superficie } from './materiais'
import type { DistanceCuller } from './perf'
import { ANEIS, AVENIDAS } from './teia'

// ── as constantes do projeto ───────────────────────────────────────────────

/** largura da caixa da supervia, em metros. Publicada pelo gerador, não se discute. */
export const LARGURA = 26.0
/** metros de rocha sobre a laje de cobertura, no trecho enterrado */
export const COBERTURA = 35.0
/** do greide ao topo da caixa: 5,5 m de gabarito livre mais 1,0 m de laje */
export const GABARITO = 6.5
/** rampa máxima do tronco (AASHTO: 4% desejável em expressa urbana) */
export const RAMPA_TRONCO = 0.04
/** rampa máxima da alça de trevo (TxDOT 15.7: 6% desejável) */
export const RAMPA_ALCA = 0.06
/** raio mínimo horizontal do tronco a 100 km/h, e = 6%, f = 0,14 */
export const RAIO_MIN_TRONCO = 400
/** raio mínimo horizontal da alça a 60 km/h */
export const RAIO_MIN_ALCA = 150
/** janela da média móvel que faz as vezes de curva vertical, em metros */
export const CURVA_VERTICAL = 175
/** AASHTO Green Book: 1,6 km entre acessos de expressa em área urbana */
export const VAO_MIN_ACESSO = 1600
/** AASHTO Green Book: 3,2 km é o intervalo rural; aqui vira teto */
export const VAO_MAX_ACESSO = 3200
/** cobertura abaixo da qual a obra é aberta (trincheira) e portanto DESENHADA */
export const COBERTURA_ABERTA = 4.0
/** borda livre do portal sobre a lâmina d'água */
export const BORDA_LIVRE = 3.0
/** quanto de terreno seco o portal precisa para dentro, antes de aceitar a boca */
export const PATIO_SECO = 300
/** passo de amostragem do eixo, em metros */
export const PASSO = 25
/** raio do tecido produtivo: onde as bandas de lote acabam (gerador, PHI_PRODUTIVO) */
const R_PRODUTIVO = 5500
/** o anel externo da teia, onde a rota de saída aterrissa */
const R_SAIDA = 6900
/** meia-largura reservada para a obra, para a máscara de lote */
const RESERVA_MEIA = 22

// ── a seção do tronco: 26 m ────────────────────────────────────────────────
//
// 2,5 acostamento + 8,0 pista + 5,0 barreira central + 8,0 pista + 2,5. As duas
// pistas de 8 m são o mesmo par do anel viário de `vias.ts`, de propósito: a
// cidade já leu essa largura como "via de porte", e a supervia não precisa
// inventar uma sexta seção. O canteiro de 5 m é barreira rígida, não jardim:
// numa expressa a 100 km/h o separador é obra, e ele fica 0,45 m acima da pista.
interface Banda { de: number; ate: number; dy: number; sup: Superficie }

const SEC_TRONCO: Banda[] = [
  { de: -13.0, ate: -2.5, dy: 0.0, sup: 'asfalto' },
  { de: -2.5, ate: 2.5, dy: 0.45, sup: 'concreto' },
  { de: 2.5, ate: 13.0, dy: 0.0, sup: 'asfalto' },
]
/** a alça de trevo: 10 m, uma faixa mais acostamento dos dois lados */
const SEC_ALCA: Banda[] = [{ de: -5.0, ate: 5.0, dy: 0.0, sup: 'asfalto' }]

// ── tipos publicados ───────────────────────────────────────────────────────

/** o pedaço da malha publicada que este módulo lê. `bocas` entra e é IGNORADO;
 *  ver a nota 1 do cabeçalho. */
export interface AutopistaJSON {
  id: string
  rumo: number
  afastamento: number
  largura: number
  cota: number
}
export interface MalhaAutopistas {
  autopistas: AutopistaJSON[]
}

export type TipoObra = 'tunel' | 'trincheira' | 'viaduto'

/** um acesso: portal de ponta ou trevo intermediário */
export interface Acesso {
  id: string
  /** 'portal' abre na superfície; 'trevo' liga por alça */
  tipo: 'portal' | 'trevo'
  /** estação ao longo do eixo, em metros a partir do centro da corda */
  t: number
  x: number
  z: number
  /** com quem ele se conecta: 'AV<rumo>' avenida radial, 'AN<raio>' anel viário,
   *  'ORLA' quando o portal morre na frente da baía */
  liga: string
  /** cota do greide no acesso */
  y: number
}

export interface EixoAutopista {
  id: string
  rumo: number
  afastamento: number
  /** normal e direção da corda, em (x, z) */
  nx: number; nz: number; dx: number; dz: number
  /** estações inicial e final, em metros ao longo de `d` */
  tA: number; tB: number
  comprimento: number
  /** amostras de PASSO em PASSO: terreno, greide e classificação */
  ter: Float32Array
  y: Float32Array
  obra: TipoObra[]
  acessos: Acesso[]
  metrosDeTunel: number
  metrosDeTrincheira: number
  metrosDeViaduto: number
  /** rampa máxima medida, em fração (0,04 = 4%) */
  rampaMax: number
  /** ponto do eixo na estação `t` */
  ponto(t: number): { x: number; z: number }
  /** greide na estação `t`, interpolado */
  greide(t: number): number
}

export interface AutopistasOpts {
  /** ⚠️ `superficieAt`, NUNCA `heightAt`. Mesma regra que `vias.ts` segue: quem
   *  assenta pavimento pergunta pela superfície acabada (com platô, talude e
   *  cava), não pelo relevo cru. Com `heightAt` o portal nasce no ar sobre o
   *  talude e a trincheira abre dentro da rampa do platô. */
  heightAt: (x: number, z: number) => number
  /** a cota da lâmina única da cidade. Padrão −40, que é `LAGO_COTA` do gerador. */
  cotaAgua?: number
  /** a malha já carregada. Sem ela o módulo busca sozinho. */
  malha?: MalhaAutopistas
  /** onde registrar o grupo; sem ele, chame `update(cam)` a cada quadro */
  culler?: DistanceCuller
  /** distância em que o sistema some. Padrão 14.000 m (a vista de órbita). */
  distanciaCulling?: number
}

export interface Autopistas {
  group: THREE.Group
  eixos: EixoAutopista[]
  portais: number
  trevos: number
  metrosDeTunel: number
  metrosDeTrincheira: number
  metrosDeViaduto: number
  /** o que foi realmente desenhado */
  triangulos: number
  chamadas: number
  /** ⚠️ O CONTRATO COM QUEM VAI REGERAR LOTE. true se (x,z) cai sobre obra de
   *  supervia à vista (portal, trincheira, viaduto, boca de alça) mais `folga`
   *  metros. O trecho enterrado NÃO marca: passar por baixo de um lote é o
   *  motivo de a autopista ser túnel. Ver a nota 1 do cabeçalho. */
  reservado(x: number, z: number, folga?: number): boolean
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ── a fita: um acumulador de triângulos por superfície ─────────────────────
//
// ⚠️ O UV SAI EM UNIDADES DE LADRILHO, e isso é imposição de `materiais.ts`: lá
// o `repeat` é `Math.max(1, mundo / metros)` e nunca fica abaixo de 1. Com
// `vestir(mat, nome, 1)` o repeat trava em 1 e quem divide pelo lado do ladrilho
// é a geometria. Mesma convenção da `Fita` de `vias.ts`, para as duas malhas
// lerem a mesma textura no mesmo tamanho.
class Fita {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  idx: number[] = []
  constructor(readonly ladrilho: number) {}

  private v(p: THREE.Vector3, n: THREE.Vector3, u: number, w: number): number {
    const i = this.pos.length / 3
    this.pos.push(p.x, p.y, p.z)
    this.nor.push(n.x, n.y, n.z)
    this.uv.push(u / this.ladrilho, w / this.ladrilho)
    return i
  }

  /** um quad em ordem anti-horária vista pela normal, com UV em metros de mundo */
  quad(
    a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3,
    ua: [number, number], ub: [number, number], uc: [number, number], ud: [number, number],
    n: THREE.Vector3,
  ) {
    const i0 = this.v(a, n, ua[0], ua[1])
    const i1 = this.v(b, n, ub[0], ub[1])
    const i2 = this.v(c, n, uc[0], uc[1])
    const i3 = this.v(d, n, ud[0], ud[1])
    this.idx.push(i0, i1, i2, i0, i2, i3)
  }

  get triangulos() { return this.idx.length / 3 }
  get vazia() { return this.idx.length === 0 }

  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

// ── o perfil longitudinal ──────────────────────────────────────────────────

/** envoltória inferior com rampa limitada: min-plus em duas passadas.
 *  ⚠️ AS DUAS PASSADAS SÃO O QUE TORNA A RESTRIÇÃO BILATERAL. A ida garante
 *  y[i+1] ≤ y[i] + g·ds e a volta garante y[i] ≤ y[i+1] + g·ds; juntas dão
 *  |y[i+1] − y[i]| ≤ g·ds. Uma passada só limitaria a subida e deixaria o
 *  greide despencar de uma amostra para a outra, que foi o meu primeiro erro
 *  medido nesta rodada: o perfil caía 41,5 m em 25 m de eixo, 166% de rampa. */
function envoltoria(alvo: Float32Array, ds: number, g: number): Float32Array {
  const y = Float32Array.from(alvo)
  const passo = g * ds
  for (let i = 1; i < y.length; i++) y[i] = Math.min(y[i], y[i - 1] + passo)
  for (let i = y.length - 2; i >= 0; i--) y[i] = Math.min(y[i], y[i + 1] + passo)
  return y
}

/** média móvel de janela `w` amostras, no lugar da curva vertical parabólica */
function suavizar(y: Float32Array, w: number): Float32Array {
  const out = new Float32Array(y.length)
  for (let i = 0; i < y.length; i++) {
    const a = Math.max(0, i - w), b = Math.min(y.length - 1, i + w)
    let s = 0
    for (let k = a; k <= b; k++) s += y[k]
    out[i] = s / (b - a + 1)
  }
  return out
}

// ── o traçado ──────────────────────────────────────────────────────────────

/** onde a corda cruza o raio `R`, nas duas pontas (vazio se a corda não alcança) */
function cruzaRaio(afastamento: number, R: number): number[] {
  const q = R * R - afastamento * afastamento
  if (q <= 0) return []
  const t = Math.sqrt(q)
  return [-t, t]
}

/**
 * A boca seca: o `t` mais externo cujo terreno fica acima da lâmina com borda
 * livre, num pátio de PATIO_SECO metros para dentro.
 *
 * ⚠️ ELA EXISTE PORQUE DUAS DAS SEIS PONTAS NASCEM DEBAIXO D'ÁGUA. Medido na
 * AU1: o terreno na ponta nordeste está em −48 m já em r 4.379 e continua
 * caindo até −76 m em r 6.745, e a lâmina da cidade é −40. Sem esta busca o
 * portal abriria no fundo da baía.
 */
function bocaSeca(
  nx: number, nz: number, dx: number, dz: number, off: number,
  sinal: -1 | 1, tLimite: number, heightAt: (x: number, z: number) => number, agua: number,
): number {
  const passo = 50
  const n = Math.floor(PATIO_SECO / passo)
  for (let t = sinal * tLimite; Math.abs(t) > 1200; t -= sinal * passo) {
    let seco = true
    for (let k = 0; k <= n && seco; k++) {
      const tt = t - sinal * k * passo
      if (heightAt(nx * off + dx * tt, nz * off + dz * tt) < agua + BORDA_LIVRE) seco = false
    }
    if (seco) return t
  }
  return sinal * 1200
}

/**
 * Os acessos de uma supervia. Ver a nota 4 do cabeçalho: o critério é o
 * espaçamento mínimo do AASHTO Green Book, 1,6 km em área urbana.
 */
function escolherAcessos(
  eixo: { nx: number; nz: number; dx: number; dz: number; afastamento: number; tA: number; tB: number },
): { t: number; liga: string }[] {
  const { nx, nz, dx, dz, afastamento: off, tA, tB } = eixo
  const cand: { t: number; liga: string }[] = []

  // candidatos de primeira classe: as 12 avenidas radiais da teia
  for (const av of AVENIDAS) {
    const b = (av.rumo * Math.PI) / 180
    const sb = Math.sin(b), cb = Math.cos(b)
    const den = sb * nx - cb * nz
    if (Math.abs(den) < 1e-9) continue
    const s = off / den
    // ⚠️ A AVENIDA É MEIA-RETA. `s` negativo é o lado OPOSTO da cidade, onde
    // aquela avenida não existe. Mesma armadilha que `emAvenida` em `teia.ts`
    // registra: sem o teste de sinal o trevo nasceria numa avenida imaginária.
    if (s <= 1450 || s > R_SAIDA) continue
    const t = Math.sin(b) * s * dx + -Math.cos(b) * s * dz
    if (t > tA + 400 && t < tB - 400) cand.push({ t, liga: `AV${av.rumo}` })
  }
  cand.sort((p, q) => p.t - q.t)

  const sel: { t: number; liga: string }[] = []
  let ultimo = tA
  for (const c of cand) {
    if (c.t - ultimo >= VAO_MIN_ACESSO && tB - c.t >= VAO_MIN_ACESSO) { sel.push(c); ultimo = c.t }
  }

  // vão acima do teto rural ganha um trevo no anel viário mais próximo do meio
  const marcos = [tA, ...sel.map((s) => s.t), tB]
  const extra: { t: number; liga: string }[] = []
  for (let i = 0; i < marcos.length - 1; i++) {
    if (marcos[i + 1] - marcos[i] <= VAO_MAX_ACESSO) continue
    const meio = (marcos[i] + marcos[i + 1]) / 2
    let melhor: { t: number; liga: string } | null = null
    for (const R of ANEIS) {
      for (const t of cruzaRaio(off, R)) {
        if (t < marcos[i] + VAO_MIN_ACESSO || t > marcos[i + 1] - VAO_MIN_ACESSO) continue
        if (!melhor || Math.abs(t - meio) < Math.abs(melhor.t - meio)) melhor = { t, liga: `AN${Math.round(R)}` }
      }
    }
    if (melhor) extra.push(melhor)
  }
  return [...sel, ...extra].sort((p, q) => p.t - q.t)
}

/** monta o eixo inteiro de uma supervia: traçado, perfil, classificação, acessos */
function montarEixo(a: AutopistaJSON, heightAt: (x: number, z: number) => number, agua: number): EixoAutopista {
  const ru = (a.rumo * Math.PI) / 180
  const nx = Math.cos(ru), nz = Math.sin(ru)
  const dx = -nz, dz = nx
  const off = a.afastamento
  const ponto = (t: number) => ({ x: nx * off + dx * t, z: nz * off + dz * t })

  const lim = cruzaRaio(off, R_SAIDA)
  const tLim = lim.length ? lim[1] : R_SAIDA
  const e0 = bocaSeca(nx, nz, dx, dz, off, -1, tLim, heightAt, agua)
  const e1 = bocaSeca(nx, nz, dx, dz, off, 1, tLim, heightAt, agua)
  const tA = Math.min(e0, e1), tB = Math.max(e0, e1)
  const L = tB - tA

  const N = Math.max(2, Math.floor(L / PASSO) + 1)
  const ds = L / (N - 1)
  const ter = new Float32Array(N)
  const alvo = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const p = ponto(tA + i * ds)
    ter[i] = heightAt(p.x, p.z)
    alvo[i] = ter[i] - COBERTURA - GABARITO
  }

  let env = envoltoria(alvo, ds, RAMPA_TRONCO)
  const w = Math.max(1, Math.round(CURVA_VERTICAL / ds))
  env = suavizar(suavizar(env, w), w)

  // ⚠️ AS RAMPAS DE PORTAL ENTRAM POR `max`, DEPOIS DA SUAVIZAÇÃO, e a ordem é o
  // conserto de um defeito que eu medi nesta rodada. Ancorar y[0] = terreno[0]
  // ANTES de suavizar não segura nada (a passada de volta da min-plus derruba a
  // âncora e o túnel nunca sobe); ancorar DEPOIS de suavizar, por atribuição,
  // cria um degrau de 41,5 m em 25 m, e a medição saiu 19,25% de rampa. Entrando
  // por `max` de duas retas de exatamente 4%, a âncora é exata E o greide
  // continua dentro da norma, porque máximo de funções com |derivada| ≤ 4% tem
  // |derivada| ≤ 4%.
  const y = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    y[i] = Math.max(env[i], ter[0] - RAMPA_TRONCO * i * ds, ter[N - 1] - RAMPA_TRONCO * (N - 1 - i) * ds)
  }

  const obra: TipoObra[] = new Array(N)
  let mTun = 0, mTri = 0, mVia = 0
  for (let i = 0; i < N; i++) {
    const cob = ter[i] - (y[i] + GABARITO)
    if (y[i] > ter[i] + 0.5) { obra[i] = 'viaduto'; mVia += ds }
    else if (cob < COBERTURA_ABERTA) { obra[i] = 'trincheira'; mTri += ds }
    else { obra[i] = 'tunel'; mTun += ds }
  }
  let rampaMax = 0
  for (let i = 0; i < N - 1; i++) rampaMax = Math.max(rampaMax, Math.abs(y[i + 1] - y[i]) / ds)

  const greide = (t: number): number => {
    const f = Math.min(N - 1, Math.max(0, (t - tA) / ds))
    const i = Math.min(N - 2, Math.floor(f))
    return y[i] + (y[i + 1] - y[i]) * (f - i)
  }
  const terrenoEm = (t: number): number => {
    const f = Math.min(N - 1, Math.max(0, (t - tA) / ds))
    const i = Math.min(N - 2, Math.floor(f))
    return ter[i] + (ter[i + 1] - ter[i]) * (f - i)
  }

  const acessos: Acesso[] = []
  const rA = Math.hypot(ponto(tA).x, ponto(tA).z)
  const rB = Math.hypot(ponto(tB).x, ponto(tB).z)
  acessos.push({
    id: `${a.id}-PA`, tipo: 'portal', t: tA, ...ponto(tA), y: terrenoEm(tA),
    liga: rA > R_SAIDA - 60 ? `AN${R_SAIDA}` : 'ORLA',
  })
  for (const [k, c] of escolherAcessos({ nx, nz, dx, dz, afastamento: off, tA, tB }).entries()) {
    acessos.push({
      id: `${a.id}-T${k + 1}`, tipo: 'trevo', t: c.t, ...ponto(c.t), liga: c.liga, y: greide(c.t),
    })
  }
  acessos.push({
    id: `${a.id}-PB`, tipo: 'portal', t: tB, ...ponto(tB), y: terrenoEm(tB),
    liga: rB > R_SAIDA - 60 ? `AN${R_SAIDA}` : 'ORLA',
  })
  acessos.sort((p, q) => p.t - q.t)

  return {
    id: a.id, rumo: a.rumo, afastamento: off, nx, nz, dx, dz, tA, tB, comprimento: L,
    ter, y, obra, acessos,
    metrosDeTunel: mTun, metrosDeTrincheira: mTri, metrosDeViaduto: mVia, rampaMax,
    ponto, greide,
  }
}

// ── o desenho ──────────────────────────────────────────────────────────────

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const CIMA = V(0, 1, 0)

/** o pavimento de um trecho: uma fita por banda da seção */
function pavimento(
  fAsf: Fita, fCon: Fita, eixo: EixoAutopista, sec: Banda[],
  i0: number, i1: number, ds: number, larguraExtra = 0,
) {
  const { nx, nz, dx, dz, afastamento: off, tA, y } = eixo
  for (let i = i0; i < i1; i++) {
    const t0 = tA + i * ds, t1 = tA + (i + 1) * ds
    const y0 = y[i], y1 = y[i + 1]
    const c0x = nx * off + dx * t0, c0z = nz * off + dz * t0
    const c1x = nx * off + dx * t1, c1z = nz * off + dz * t1
    for (const b of sec) {
      const de = b.de - (b.de < 0 ? larguraExtra : 0)
      const ate = b.ate + (b.ate > 0 ? larguraExtra : 0)
      const f = b.sup === 'concreto' ? fCon : fAsf
      // ⚠️ A NORMAL SAI `CIMA` E NÃO DA RAMPA, DE PROPÓSITO. A 4% o desvio real
      // é 2,3°; calcular a normal exata custaria uma normalização por vértice
      // (5.400 delas) para um erro de iluminação que não se vê no asfalto.
      f.quad(
        V(c0x + nx * de, y0 + b.dy, c0z + nz * de),
        V(c1x + nx * de, y1 + b.dy, c1z + nz * de),
        V(c1x + nx * ate, y1 + b.dy, c1z + nz * ate),
        V(c0x + nx * ate, y0 + b.dy, c0z + nz * ate),
        [t0, de], [t1, de], [t1, ate], [t0, ate], CIMA,
      )
    }
  }
}

/** as duas paredes de arrimo da trincheira, do greide até o terreno */
function paredes(fCon: Fita, eixo: EixoAutopista, i0: number, i1: number, ds: number) {
  const { nx, nz, dx, dz, afastamento: off, tA, y, ter } = eixo
  for (const lado of [-1, 1] as const) {
    const u = lado * (LARGURA / 2 + 1.0)
    const n = V(-lado * nx, 0, -lado * nz)
    for (let i = i0; i < i1; i++) {
      const t0 = tA + i * ds, t1 = tA + (i + 1) * ds
      const x0 = nx * off + dx * t0 + nx * u, z0 = nz * off + dz * t0 + nz * u
      const x1 = nx * off + dx * t1 + nx * u, z1 = nz * off + dz * t1 + nz * u
      const b0 = y[i] - 0.6, b1 = y[i + 1] - 0.6
      const c0 = Math.max(b0 + 0.4, ter[i] + 0.35), c1 = Math.max(b1 + 0.4, ter[i + 1] + 0.35)
      if (lado > 0) fCon.quad(V(x0, b0, z0), V(x1, b1, z1), V(x1, c1, z1), V(x0, c0, z0), [t0, b0], [t1, b1], [t1, c1], [t0, c0], n)
      else fCon.quad(V(x1, b1, z1), V(x0, b0, z0), V(x0, c0, z0), V(x1, c1, z1), [t1, b1], [t0, b0], [t0, c0], [t1, c1], n)
    }
  }
}

/** o viaduto: viga de bordo dos dois lados e pilar a cada 50 m */
function viaduto(fCon: Fita, eixo: EixoAutopista, i0: number, i1: number, ds: number) {
  const { nx, nz, dx, dz, afastamento: off, tA, y, ter } = eixo
  for (const lado of [-1, 1] as const) {
    const u = lado * (LARGURA / 2)
    const n = V(lado * nx, 0, lado * nz)
    for (let i = i0; i < i1; i++) {
      const t0 = tA + i * ds, t1 = tA + (i + 1) * ds
      const x0 = nx * off + dx * t0 + nx * u, z0 = nz * off + dz * t0 + nz * u
      const x1 = nx * off + dx * t1 + nx * u, z1 = nz * off + dz * t1 + nz * u
      const a0 = y[i], a1 = y[i + 1], b0 = a0 - 1.4, b1 = a1 - 1.4
      if (lado > 0) fCon.quad(V(x0, b0, z0), V(x1, b1, z1), V(x1, a1, z1), V(x0, a0, z0), [t0, b0], [t1, b1], [t1, a1], [t0, a0], n)
      else fCon.quad(V(x1, b1, z1), V(x0, b0, z0), V(x0, a0, z0), V(x1, a1, z1), [t1, b1], [t0, b0], [t0, a0], [t1, a1], n)
    }
  }
  const passoPilar = Math.max(1, Math.round(50 / ds))
  for (let i = i0; i <= i1; i += passoPilar) {
    const t = tA + i * ds
    const cx = nx * off + dx * t, cz = nz * off + dz * t
    const topo = y[i] - 1.4, base = ter[i] - 1.0
    if (topo - base < 1.5) continue
    caixa(fCon, cx, cz, nx, nz, dx, dz, 3.0, 3.0, base, topo, t)
  }
}

/** um prisma de 4 faces alinhado com o eixo; é o pilar e é o batente do portal */
function caixa(
  f: Fita, cx: number, cz: number, nx: number, nz: number, dx: number, dz: number,
  meiaN: number, meiaD: number, base: number, topo: number, uRef: number,
) {
  const p = (sn: number, sd: number) => ({
    x: cx + nx * sn * meiaN + dx * sd * meiaD,
    z: cz + nz * sn * meiaN + dz * sd * meiaD,
  })
  const cantos = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)]
  for (let k = 0; k < 4; k++) {
    const a = cantos[k], b = cantos[(k + 1) % 4]
    const ex = b.x - a.x, ez = b.z - a.z
    const len = Math.hypot(ex, ez) || 1
    const n = V(ez / len, 0, -ex / len)
    f.quad(
      V(a.x, base, a.z), V(b.x, base, b.z), V(b.x, topo, b.z), V(a.x, topo, a.z),
      [uRef, base], [uRef + len, base], [uRef + len, topo], [uRef, topo], n,
    )
  }
}

/**
 * O batente do portal: o quadro de concreto onde o túnel começa.
 *
 * ⚠️ ELE NÃO FICA NA BOCA, FICA ONDE A CAIXA ENTRA NO CHÃO. Na boca o greide
 * está NO terreno e não existe túnel nenhum ainda; o portal de verdade é a
 * primeira estação com cobertura suficiente para a laje. Posto na boca, o
 * quadro nasceria em campo aberto, de pé no meio do nada.
 */
function batente(fCon: Fita, eixo: EixoAutopista, i: number, ds: number) {
  const { nx, nz, dx, dz, afastamento: off, tA, y, ter } = eixo
  const t = tA + i * ds
  const cx = nx * off + dx * t, cz = nz * off + dz * t
  const base = y[i] - 0.6
  const topo = Math.max(y[i] + GABARITO + 2.0, ter[i] + 1.2)
  // duas ombreiras de 4 m e a verga por cima do vão de 26 m
  for (const lado of [-1, 1] as const) {
    const u = lado * (LARGURA / 2 + 2.0)
    caixa(fCon, cx + nx * u, cz + nz * u, nx, nz, dx, dz, 2.0, 2.5, base, topo, t)
  }
  const vBase = y[i] + GABARITO
  if (topo - vBase > 0.4) {
    caixa(fCon, cx, cz, nx, nz, dx, dz, LARGURA / 2 + 4.0, 2.5, vBase, topo, t)
  }
}

/**
 * A alça de um trevo, e ela é a resposta ao "rota de saída para os bairros".
 *
 * ⚠️ SÓ A BOCA DELA É DESENHADA, e a conta explica por quê: o tronco está de 35
 * a 88 m abaixo do terreno, e a 6% a alça precisa de 583 a 1.467 m para subir.
 * Desses, o trecho com menos de 4 m de cobertura são os últimos ~70 a 120 m. O
 * resto é galeria, invisível como o tronco. Desenhar a alça inteira custaria
 * dez vezes mais triângulo para enterrar nove décimos deles.
 */
function alca(
  fAsf: Fita, fCon: Fita, eixo: EixoAutopista, ac: Acesso,
  heightAt: (x: number, z: number) => number, lado: -1 | 1,
): { x: number; z: number; r: number } | null {
  const { nx, nz, dx, dz, afastamento: off } = eixo
  const u = lado * 33
  const passo = 20
  // sobe a 6% a partir do tronco, afastando-se ao longo do eixo
  const prof = Math.max(0, heightAt(ac.x, ac.z) - ac.y)
  const comp = prof / RAMPA_ALCA
  const pt = (s: number) => {
    const t = ac.t + lado * (comp - s)
    const k = Math.min(1, s / Math.max(1, comp))
    const uu = u * k * k * (3 - 2 * k)
    return { x: nx * off + dx * t + nx * uu, z: nz * off + dz * t + nz * uu, t }
  }
  // acha onde a cobertura cai abaixo do limite: dali para a frente é obra à vista
  let sAbre = comp
  for (let s = 0; s <= comp; s += passo) {
    const p = pt(s)
    const yAlca = ac.y + s * RAMPA_ALCA
    if (heightAt(p.x, p.z) - (yAlca + GABARITO) < COBERTURA_ABERTA) { sAbre = s; break }
  }
  const aberto = comp - sAbre
  if (aberto < passo) return null

  let ant: { x: number; z: number; y: number; t: number } | null = null
  for (let s = sAbre; s <= comp + 1e-6; s += passo) {
    const p = pt(Math.min(s, comp))
    const cur = { ...p, y: Math.min(ac.y + Math.min(s, comp) * RAMPA_ALCA, heightAt(p.x, p.z)) }
    if (ant) {
      for (const b of SEC_ALCA) {
        fAsf.quad(
          V(ant.x + nx * b.de * lado, ant.y, ant.z + nz * b.de * lado),
          V(cur.x + nx * b.de * lado, cur.y, cur.z + nz * b.de * lado),
          V(cur.x + nx * b.ate * lado, cur.y, cur.z + nz * b.ate * lado),
          V(ant.x + nx * b.ate * lado, ant.y, ant.z + nz * b.ate * lado),
          [ant.t, b.de], [cur.t, b.de], [cur.t, b.ate], [ant.t, b.ate], CIMA,
        )
      }
      // mureta do lado de fora da boca da alça
      const uw = 5.5 * lado
      const n = V(lado * nx, 0, lado * nz)
      const ax = ant.x + nx * uw, az = ant.z + nz * uw
      const bx = cur.x + nx * uw, bz = cur.z + nz * uw
      const h0 = Math.max(ant.y + 0.4, heightAt(ax, az) + 0.3)
      const h1 = Math.max(cur.y + 0.4, heightAt(bx, bz) + 0.3)
      fCon.quad(
        V(ax, ant.y - 0.3, az), V(bx, cur.y - 0.3, bz), V(bx, h1, bz), V(ax, h0, az),
        [ant.t, ant.y], [cur.t, cur.y], [cur.t, h1], [ant.t, h0], n,
      )
    }
    ant = cur
  }
  const fim = pt(comp)
  return { x: fim.x, z: fim.z, r: 60 }
}

// ── a montagem ─────────────────────────────────────────────────────────────

export async function buildAutopistas(o: AutopistasOpts): Promise<Autopistas> {
  const malha: MalhaAutopistas = o.malha
    ?? ((await fetch('/city/cidade-malha.json').then((r) => r.json())) as MalhaAutopistas)
  const agua = o.cotaAgua ?? -40
  const heightAt = o.heightAt

  const eixos = (malha.autopistas ?? []).map((a) => montarEixo(a, heightAt, agua))

  const fAsf = new Fita(superficie('asfalto').metros)
  const fCon = new Fita(superficie('concreto').metros)
  /** as manchas de superfície que o gerador de lote precisa evitar */
  const manchas: { x: number; z: number; r: number }[] = []
  /** os intervalos de eixo com obra à vista, para a máscara analítica */
  const abertos: { eixo: EixoAutopista; t0: number; t1: number }[] = []

  for (const e of eixos) {
    const N = e.y.length
    const ds = e.comprimento / (N - 1)

    // corre a classificação em blocos, desenhando só o que não é túnel
    let i = 0
    while (i < N - 1) {
      const tipo = e.obra[i]
      let j = i
      while (j < N - 1 && e.obra[j] === tipo) j++
      if (tipo !== 'tunel') {
        pavimento(fAsf, fCon, e, SEC_TRONCO, i, j, ds)
        if (tipo === 'trincheira') paredes(fCon, e, i, j, ds)
        else viaduto(fCon, e, i, j, ds)
        abertos.push({ eixo: e, t0: e.tA + i * ds, t1: e.tA + j * ds })
      }
      i = j
    }

    // o batente de cada portal, na primeira estação com laje
    for (const lim of [{ de: 0, passo: 1 }, { de: N - 1, passo: -1 }]) {
      let k = lim.de
      while (k > 0 && k < N - 1 && e.ter[k] - (e.y[k] + GABARITO) < 1.0) k += lim.passo
      if (k > 0 && k < N - 1) batente(fCon, e, k, ds)
    }

    // as alças dos trevos
    for (const ac of e.acessos) {
      if (ac.tipo !== 'trevo') continue
      for (const lado of [-1, 1] as const) {
        const m = alca(fAsf, fCon, e, ac, heightAt, lado)
        if (m) manchas.push(m)
      }
    }
    for (const ac of e.acessos) {
      if (ac.tipo === 'portal') manchas.push({ x: ac.x, z: ac.z, r: 110 })
    }
  }

  // ── os materiais: dois, e nenhum programa novo ───────────────────────────
  //
  // ⚠️ `vestir(m, nome, 1)` E NÃO `vestir(m, nome, tamanho)`. A fita já emite UV
  // em unidades de ladrilho; passar o tamanho do mundo aqui multiplicaria o
  // repeat duas vezes e a textura sairia com o ladrilho do tamanho de um pixel.
  const mats: THREE.MeshStandardMaterial[] = []
  const material = (nome: Superficie, tinta: string, forca: number, macroM: number) => {
    const m = new THREE.MeshStandardMaterial({ color: tinta, roughness: 1, metalness: 0 })
    m.name = `autopista:${nome}`
    vestir(m, nome, 1, { normal: forca, macroMetros: macroM })
    mats.push(m)
    return m
  }
  const matAsf = material('asfalto', '#F5EFE4', 1.0, 90)
  const matCon = material('concreto', '#FFFFFF', 0.9, 110)

  const group = new THREE.Group()
  group.name = 'autopistas'
  const geos: THREE.BufferGeometry[] = []
  let chamadas = 0
  if (!fAsf.vazia) {
    const g = fAsf.geometria(); geos.push(g)
    const mesh = new THREE.Mesh(g, matAsf); mesh.name = 'autopistas:asfalto'
    mesh.receiveShadow = true; group.add(mesh); chamadas++
  }
  if (!fCon.vazia) {
    const g = fCon.geometria(); geos.push(g)
    const mesh = new THREE.Mesh(g, matCon); mesh.name = 'autopistas:concreto'
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); chamadas++
  }

  const dist = o.distanciaCulling ?? 14000
  if (o.culler) o.culler.add(group, dist, new THREE.Vector3(0, 0, 0))

  const reservado = (x: number, z: number, folga = 0): boolean => {
    for (const m of manchas) {
      if ((x - m.x) ** 2 + (z - m.z) ** 2 < (m.r + folga) ** 2) return true
    }
    for (const a of abertos) {
      const e = a.eixo
      const u = x * e.nx + z * e.nz - e.afastamento
      if (Math.abs(u) > RESERVA_MEIA + folga) continue
      const t = x * e.dx + z * e.dz
      if (t >= a.t0 - 30 - folga && t <= a.t1 + 30 + folga) return true
    }
    return false
  }

  const somaTun = eixos.reduce((s, e) => s + e.metrosDeTunel, 0)
  const somaTri = eixos.reduce((s, e) => s + e.metrosDeTrincheira, 0)
  const somaVia = eixos.reduce((s, e) => s + e.metrosDeViaduto, 0)

  return {
    group,
    eixos,
    portais: eixos.reduce((s, e) => s + e.acessos.filter((a) => a.tipo === 'portal').length, 0),
    trevos: eixos.reduce((s, e) => s + e.acessos.filter((a) => a.tipo === 'trevo').length, 0),
    metrosDeTunel: somaTun,
    metrosDeTrincheira: somaTri,
    metrosDeViaduto: somaVia,
    triangulos: fAsf.triangulos + fCon.triangulos,
    chamadas,
    reservado,
    update(cam: THREE.Vector3) {
      group.visible = cam.length() < dist
    },
    dispose() {
      for (const g of geos) g.dispose()
      for (const m of mats) {
        m.map?.dispose(); m.normalMap?.dispose(); m.roughnessMap?.dispose()
        m.dispose()
      }
      group.clear()
    },
  }
}
