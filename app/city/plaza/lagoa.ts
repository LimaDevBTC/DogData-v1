// ═══════════════════════════════════════════════════════════════════════════
// AS LAGOAS ALPINAS: A ÁGUA.
//
// Pedido do fundador na rodada da montanha, palavra por palavra: "a cadeia de
// montanhas que são características de lagos, e gostaria de floresta e lagoa
// naquela região". E em 05/09, vendo o pico em produção: "outra coisa são os
// LAGOS da região das montanhas". Plural, e é o que este arquivo passou a
// montar: um corpo d'água por registro da tabela do relevo, não mais um só.
//
// AS BACIAS NÃO SÃO DESTE ARQUIVO. Quem escava é `inverno.ts`, que publica a
// tabela `LAGOS`: um registro por corpo, com centro, raio inscrito, cota e
// profundidade. Este módulo LÊ a tabela (ver `tabelaDoRelevo`, e a nota sobre
// por que a leitura é pelo módulo) e não copia UM número dela para constante
// local. Se o relevo mudar a sela de lugar, acrescentar um corpo ou afundar
// outro, a água acompanha sozinha na próxima carga; um valor craveado aqui
// seria exatamente o tipo de dívida que já custou 242 m de erro nas vistas de
// `chapas.mjs` nesta mesma rodada.
//
// E TUDO QUE VARIA DE CORPO PARA CORPO SAI DA TABELA OU DA MEDIÇÃO, nada é
// repetido igual em todos: a cota é a do registro, os rumos e os anéis saem do
// raio inscrito, e a onda e a largura da margem saem do raio MEDIDO na
// superfície (ver `planejar`). Corpo menor tem onda menor.
//
// ── POR QUE NÃO DÁ PARA REAPROVEITAR `lagos.ts` ────────────────────────────
// A água da cidade nasce de um FLOOD-FILL abaixo de uma cota única (−40 m por
// padrão). As lâminas daqui vivem em centenas de metros de altitude, cada uma
// na SUA cota: para o detector de `lagos.ts` achar estas bacias seria preciso
// cavar o maciço inteiro até abaixo do nível da cidade. E a cor de lá é uma
// constante da cidade inteira (`COR_AGUA` #1D4A66, luminância relativa
// 0,0612), com praia de AREIA CLARA automática em toda cratera fora da baía.
// Lagoa alpina não é isso: é água escura e parada, com margem de rocha molhada
// e mata encostando. Por isso ela tem malha, cor, shader e consulta próprios.
//
// ⚠️ E É POR ISSO QUE A ÁGUA NÃO PODE SER UM PLANO SÓ. Cada bacia tem a sua
// cota, medida pelo relevo; um plano único na média deixaria a lagoa alta
// submersa e a baixa boiando. Cada corpo é um leque próprio, na cota dele.
//
// ── A GEOGRAFIA, MEDIDA OFFLINE (`tsx`, `superficieAt` real, sem navegador) ─
// Os números por corpo saem no console em cada carga (`[lagoa] ...`), porque
// eles dependem da tabela do relevo e mudam quando ela muda. O corpo que
// calibrou cor, onda e margem é a sela de r 8.000 / azimute 285:
//
//   lâmina, em grade de 1 m     5,42 ha (54.208 m²)
//   lâmina, na malha construída 5,47 ha (54.652 m²)
//   profundidade                11,37 m média, 20,72 m máxima
//   linha d'água por rumo       121,5 m no mínimo, 154,5 m no máximo, 131,0 m
//                               de média (360 rumos, passo de 0,5 m)
//   lábio mais baixo em volta   412,9 m, ou seja +5,9 m sobre a lâmina
//
// Os 444 m² a mais da malha são a sobra de 0,6 m com que a lâmina entra por
// baixo do barranco (ver `LAMINA_SOBRA`): é área desenhada e escondida, de
// propósito, não área de água. O número que vale como "tamanho da lagoa" é o
// da grade.
//
// A linha d'água oscilar 33 m entre rumos é o motivo de a lâmina NÃO ser um
// disco: um disco de 154 m flutuaria sobre terra seca no rumo em que a margem
// fecha em 121, e um disco de 121 deixaria um anel de leito exposto de 33 m no
// rumo oposto. Cada corpo é um leque em que o raio de cada rumo é MEDIDO no
// `heightAt` de verdade, na hora de construir.
//
// ── ⚠️ A ARMADILHA QUE ESTE ARQUIVO NÃO CONSEGUE FECHAR SOZINHO ────────────
// `inverno.ts` é o único sistema vizinho do maciço que não consulta
// `lagos.naAgua`. A frente do relevo defende as semeaduras que moram DENTRO
// dele (a floresta e o penhasco, com uma guarda de cota privada), e o número
// que isso vale está medido no corpo calibrado: rodando
// `gerarCandidatosFloresta` com a guarda desarmada nascem **59 árvores dentro
// da água**. O resto do vizinhado está limpo por GEOMETRIA, não por sorte:
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
// ── ⚠️ O SENTIDO DE GIRO, E ELE JÁ TINHA CUSTADO TRÊS RODADAS NO VIZINHO ───
// Medido em 05/09 sobre a malha REAL que `buildLagoa` constrói (relevo de hoje,
// `superficieAt` de verdade, sem navegador): as DUAS malhas saíam com a normal
// geométrica apontando para BAIXO em 100,00% dos triângulos, contra material
// `FrontSide`. `lagoa:agua` 22.808 de 22.808, normal geométrica média
// (0,0000, −1,0000, 0,0000); `lagoa:margem` 9.184 de 9.184, média
// (0,0020, −1,0000, 0,0077). Com `?lagoa=1` não havia água rasterizada de
// NENHUMA câmera acima dela: a GPU descartava as duas malhas inteiras como face
// de trás antes de virarem fragmento.
//
// É o MESMO defeito, do MESMO dia, do arquivo vizinho: a casca de neve de
// `alpino.ts` ficou invisível por três rodadas de conserto (máscara, material,
// levante, folga adaptativa) porque todas consertavam elos a montante de um
// triângulo que nunca era desenhado. A trava contra isso já existia nesta casa,
// em `terrain.ts:722`, e nenhum dos dois módulos a tinha recebido.
//
// ⚠️ E A MARGEM ERRAVA DUAS VEZES: ela chama `computeVertexNormals`, que deriva
// a normal DO ENROLAMENTO, então o atributo que ilumina também saía apontando
// para baixo (média medida (0,0024, −1,0000, 0,0080)). Mesmo desenhada, a rocha
// molhada estaria iluminada pelo lado de dentro do morro.
//
// O conserto está na EMISSÃO do índice (ver `acumularLamina` e
// `acumularMargem`), com `travarGiro` de guarda-corpo em cima, e ela grita no
// console quando dispara.
//
// ── A BANDEIRA ─────────────────────────────────────────────────────────────
// `?lagoa=1`, OPT-IN, e isso é deliberado: quem decide ligar é o fundador,
// depois de VER. Sem a bandeira, `buildLagoa` devolve um grupo vazio e
// `naLagoa` responde `false` sempre, ou seja o caminho de hoje fica bit a bit
// igual. A bandeira mora em `inverno.ts` e é importada daqui: ela é UMA
// constante, num dono só, e essa regra nasceu de um defeito medido (ver a nota
// do `export` logo abaixo).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import * as relevo from './inverno'
import { INVERNO_ATIVO, LAGOA_ATIVA } from './inverno'
import { superficie } from './materiais'

// ⚠️ A BANDEIRA VEM DE `inverno.ts`, NÃO DAQUI, e ela é reexportada só para
// quem monta a cena não precisar importar dois módulos. Ela já foi lida nos
// DOIS arquivos, e foi assim que a bacia entrou no caminho padrão enquanto a
// água ficava de fora: cova seca de 5,4 ha no ar em 04/09. Uma bandeira, uma
// leitura, um dono.
export { LAGOA_ATIVA }

/** um corpo, como a tabela do relevo o entrega. Só forma: nenhum destes
 *  números é escolhido aqui. */
export interface LagoDoRelevo {
  nome?: string
  centro: { x: number; z: number }
  /** raio INSCRITO, em metros: o maior disco submerso em TODOS os rumos. É a
   *  semente da busca radial, não a linha d'água (ver `raioDaMargem`). */
  raio: number
  /** cota da lâmina, em metros */
  cota: number
  /** profundidade de projeto da cuba. A profundidade que este módulo publica é
   *  MEDIDA no terreno, sonda por sonda; este campo é só documentação da
   *  tabela. */
  prof?: number
}

/**
 * A TABELA DE CORPOS, E ESTE ARQUIVO NÃO INVENTA UM NÚMERO DELA.
 *
 * ⚠️ A LEITURA É PELO MÓDULO (`relevo.LAGOS`) E NÃO POR IMPORTAÇÃO NOMEADA, e
 * o motivo é de calendário, não de gosto: a frente do relevo e a frente da água
 * correm na MESMA rodada, o bot de auto-commit publica de hora em hora e
 * `tsc --noEmit` limpo é o portão de saída de cada uma. Um `import { LAGOS }`
 * derrubaria a árvore inteira enquanto a tabela não estivesse publicada, e
 * derrubaria de novo, ao contrário, se ela fosse publicada e os três exports
 * antigos saíssem juntos. Assim as duas ordens de chegada compilam, e no dia
 * em que a tabela existir ela passa a ser usada sem mais uma edição aqui.
 *
 * ⚠️ E O QUE NÃO SE FAZ, EM NENHUMA DAS DUAS ORDENS, É COPIAR VALOR. Sem
 * tabela, o corpo único é montado a partir dos exports do próprio relevo
 * (`LAGOA_CENTRO`, `LAGOA_RAIO`, `LAGOA_COTA`); sem nenhum dos dois, a lista é
 * VAZIA e não sobe água nenhuma. Constante geográfica craveada aqui é
 * exatamente a dívida que já custou 242 m de erro nas vistas de `chapas.mjs`
 * nesta mesma rodada.
 *
 * Chamada DENTRO de `buildLagoa`, nunca na avaliação do módulo: ler a tabela na
 * carga amarraria este arquivo à ordem de inicialização de `inverno.ts`.
 */
function tabelaDoRelevo(): readonly LagoDoRelevo[] {
  const m = relevo as unknown as {
    LAGOS?: readonly LagoDoRelevo[]
    LAGOA_CENTRO?: { x: number; z: number }
    LAGOA_RAIO?: number
    LAGOA_COTA?: number
  }
  if (m.LAGOS && m.LAGOS.length > 0) return m.LAGOS
  if (m.LAGOA_CENTRO && typeof m.LAGOA_RAIO === 'number' && typeof m.LAGOA_COTA === 'number')
    return [{ nome: 'sela 285', centro: m.LAGOA_CENTRO, raio: m.LAGOA_RAIO, cota: m.LAGOA_COTA }]
  return []
}

export interface LagoaOpts {
  /** a MESMA superfície que a câmera vê (`terrain.superficieAt`), nunca o
   *  `heightAt` analítico: a linha d'água é medida contra ela e uma discordância
   *  de chord aqui vira lâmina flutuando sobre a margem. */
  heightAt: (x: number, z: number) => number
  sombra?: boolean
}

/** o que cada corpo devolve depois de MEDIDO na superfície de verdade. É isto
 *  que o console imprime: com tabela, o número por corpo é a única forma de
 *  saber que a bacia daquele registro existe mesmo. */
export interface CorpoMedido {
  nome: string
  /** área da lâmina em m², somada triângulo a triângulo da malha construída */
  area: number
  /** profundidade máxima medida sob a lâmina, em metros */
  profMax: number
  cota: number
  /** raio médio da linha d'água, em metros, medido rumo a rumo */
  raioMedio: number
  triangulos: number
}

export interface Lagoa {
  group: THREE.Group
  /** área somada de TODOS os corpos, em m² */
  area: number
  /** a maior profundidade entre os corpos, em metros */
  profMax: number
  triangulos: number
  /** um por corpo construído, na ordem da tabela do relevo */
  corpos: CorpoMedido[]
  update: (t: number) => void
  dispose: () => void
}

// ── a forma da malha ────────────────────────────────────────────────────────
/** ⚠️ O ARCO ALVO ENTRE DOIS RUMOS, EM METROS, e é ELE que passou a decidir
 *  quantos rumos cada corpo tem. O corpo calibrado usava 256 rumos num raio
 *  inscrito de 120 m, o que dá 2π·120/256 = 2,945 m de arco: é este número.
 *  Repetir 256 num corpo de 40 m daria 0,98 m de arco, ou seja três vértices
 *  dentro da MESMA célula de 10 m do relevo fino, sondando o mesmo triângulo
 *  de terreno três vezes por 0,062 ms cada. */
const ARCO_ALVO = 2.945
/** teto e piso de rumos. 256 é o do corpo calibrado; 64 ainda dá 12 arestas por
 *  quadrante, que é onde uma margem de lagoa deixa de ler como polígono. */
const AZ_MAX = 256
const AZ_MIN = 64
/** ⚠️ UM ANEL A CADA TANTOS METROS DE RAIO INSCRITO. O corpo calibrado tinha 14
 *  anéis para 120 m, ou seja um a cada 8,57 m. Os anéis existem para o
 *  gradiente de profundidade ter onde interpolar (`aProf` é varying, e uma
 *  lâmina de dois triângulos interpolaria 20,72 m de fundo em linha reta), e
 *  esse gradiente é uma função do RAIO, não do número de corpos. */
const METROS_POR_ANEL = 8.57
const ANEIS_MAX = 14
const ANEIS_MIN = 5
/** ⚠️ QUANTO A LÂMINA ENTRA POR BAIXO DO BARRANCO. Na linha d'água o terreno
 *  vale exatamente a cota do corpo; 0,6 m adiante, com os 14,2 graus medidos de
 *  margem, ele já está 0,15 m ACIMA da lâmina e esconde a aresta. Sem essa
 *  sobra a borda da malha coincide com a borda do terreno e a serrilha da
 *  amostragem aparece como um fio claro em volta do lago. NÃO escala com o
 *  tamanho do corpo: é folga de costura contra o talude da margem, e o talude
 *  da margem é o mesmo em todos. */
const LAMINA_SOBRA = 0.6
/** ⚠️ ATÉ ONDE A BUSCA RADIAL VAI, EM MÚLTIPLOS DO RAIO INSCRITO. No corpo
 *  calibrado a busca ia a 260 m sobre um raio inscrito de 120, e a linha d'água
 *  medida fechou em 154,5 m no pior rumo: 2,2 deixa a mesma folga de 68% sobre
 *  a margem real em qualquer corpo. */
const BUSCA_FATOR = 2.2
/** ⚠️ E ELE CRESCE SOZINHO QUANDO A BACIA É MAIOR QUE O RAIO DA TABELA, porque
 *  o alcance truncado é o pior defeito que esta busca sabe produzir e ele está
 *  MEDIDO. Num teste com um corpo cujo raio de tabela subestimava a cova, parte
 *  dos rumos batia no teto e ficava gravada exatamente no teto: entre um rumo
 *  travado em 132 m e o vizinho legítimo em 90 m, a interpolação de `naLagoa`
 *  passava a mentir por **39,32 m** (contra 0,42 m quando nada trunca). Dobrar
 *  o alcance e refazer custa alguns milissegundos e some com isso. Duas
 *  dobras, teto de 8,8 raios: além disso não é mais uma bacia, é um vale
 *  aberto descendo a montanha, e aí o certo é avisar em vez de sair varrendo. */
const BUSCA_DOBRAS = 2
/** ⚠️ BUSCA EM DOIS TEMPOS, E ISSO É TEMPO DE BOOT MEDIDO, não zelo.
 *  `superficieAt` custa 62 µs por ponto neste maciço (medido: 67.308 amostras
 *  em 4.143 ms), então a varredura ingênua de 0,5 m entre 120 e 260 m gastaria
 *  280 amostras por rumo, 71.680 no total, e travaria um quadro inteiro. Passo
 *  grosso para achar o intervalo e 5 bissecções dentro dele dão 0,094 m de
 *  precisão com ~14 amostras por rumo. Conferido contra a varredura fina de
 *  0,5 m, rumo a rumo: desvio máximo de 0,47 m, e ele é da REFERÊNCIA, não
 *  daqui. A varredura só sabe responder em múltiplos do passo dela, enquanto a
 *  bissecção fecha em 0,094 m. */
const BUSCA_GROSSO = 3
/** ⚠️ E O PASSO GROSSO É UMA FRAÇÃO DO RAIO, NÃO UMA CONSTANTE, porque com
 *  tabela os corpos deixaram de ter todos o mesmo tamanho. 2,5% do raio é
 *  EXATAMENTE o que o corpo calibrado sempre usou (3 m sobre 120), então ele
 *  não muda um bit: MEDIDO em sondas de terreno, que é o número determinista
 *  aqui (o relógio de parede oscilou 60% entre cargas iguais, com várias
 *  frentes na mesma máquina), o corpo calibrado gasta 7.739 sondas nas duas
 *  políticas. Numa tabela de seis corpos, com um deles de raio 580 m, são
 *  131.081 sondas com 3 m fixos contra **95.614** com a fração: 27% a menos.
 *  A precisão fica proporcional ao tamanho (o intervalo grosso é sempre
 *  partido em 32 pela bissecção), que é a definição certa aqui: 0,44 m de erro
 *  numa lâmina de 842 m de raio é a mesma coisa que 0,094 m numa de 131 m. */
const BUSCA_GROSSO_FRAC = 0.025
/** ⚠️ E ELE TEM TETO ABSOLUTO, porque um passo grosso maior que o LÁBIO da
 *  bacia PULA POR CIMA DELE e a busca vaza para o vale seguinte. Medido numa
 *  tabela de covas naturais: com passo de 14,5 m um corpo vazou por uma crista
 *  fina e a linha d'água de um rumo foi parar a 1.268 m do centro, contra 192 m
 *  no rumo vizinho. A orla de uma bacia escavada tem 40 m de largura (é o
 *  `LAGOA_ORLA` do relevo), então 12 m é menos de um terço do lábio mais
 *  estreito que a tabela deveria conter, e passo nenhum o atravessa por acidente.
 *  Custa quase nada: 95.614 sondas sem o teto contra 97.537 com ele, contra
 *  131.081 do passo fixo de 3 m, na mesma tabela de seis corpos. */
const BUSCA_GROSSO_MAX = 12
/** ⚠️ QUANDO O CONTORNO DEIXA DE SER UMA LAGOA E VIRA UM VALE, E COMO SE SABE.
 *  Este módulo modela cada corpo como ESTRELADO em torno do centro: a linha
 *  d'água é uma função de valor único do azimute. É verdade para uma bacia
 *  escavada e mentira para uma depressão natural esparramada, e a razão entre o
 *  maior e o menor raio medidos separa as duas com folga. Medido: a bacia
 *  calibrada dá 154,5/121,5 = **1,27**, e as covas naturais do maciço dão de
 *  1,95 a **7,06**. Acima de 2,5 o aviso sai com o número, porque o defeito que
 *  isso produz (mata abrindo clareira onde não há água, lâmina em cima de terra
 *  seca) é caro de diagnosticar depois e barato de anunciar aqui. */
const FORMA_RAZAO_MAX = 2.5
const BUSCA_BISSEC = 5

// ── a margem ────────────────────────────────────────────────────────────────
/** largura da faixa de rocha molhada no corpo calibrado, da linha d'água para
 *  fora. A orla da bacia tem 40 m até o lábio e sobe 14,2 graus; 22 m é a
 *  metade de baixo dela, que é onde a rocha de uma lagoa de montanha fica
 *  escura. Corpo menor tem faixa menor, pela mesma escala da onda: 22 m de
 *  rocha molhada em volta de uma poça de 40 m de raio seria mais margem que
 *  água. */
const MARGEM_LARG = 22
const MARGEM_LARG_MIN = 8
/** quanto a faixa entra POR BAIXO da lâmina, para não sobrar vão na costura.
 *  Não escala pelo mesmo motivo de `LAMINA_SOBRA`, mas é limitada a 20% do raio
 *  medido para não engolir o corpo inteiro num lago pequeno. */
const MARGEM_DENTRO = 4
/** anéis da faixa no corpo calibrado. Cinco põem nó em −4, +1,2, +6,4, +11,6,
 *  +16,8 e +22 m da linha d'água, ou seja dois deles nos primeiros 7 m, que é
 *  onde a rampa de umidade cai mais rápido. Cada nó custa uma sonda de terreno. */
const MARGEM_ANEIS = 5
const MARGEM_ANEIS_MIN = 3
/** a faixa sobe isto sobre a superfície amostrada. A malha do terreno tem
 *  célula de 59 m e a corda dela já está embutida em `superficieAt`, então o
 *  que resta é folga de z-fighting: 0,22 m é a mesma ordem do levante que a
 *  praia dos lagos usa e some na vista de pé (1,7 m de olho). */
const MARGEM_LEVANTE = 0.22

// ── a onda ──────────────────────────────────────────────────────────────────
/** ⚠️ A INCLINAÇÃO DE NORMAL DO CORPO CALIBRADO, e ela NÃO é a do lago da
 *  praça. `aguaDeVerdade` em `lago.ts` inclina 0,052 com períodos de 26 e 40 m,
 *  calibrado para uma baía de 20,5 km² varrida por vento aberto. Uma lagoa de
 *  5,42 ha encaixada numa sela a 407 m, com crista de 1.044 m em volta, não tem
 *  essa pista de vento: aqui a amplitude é 0,016 (3,25 vezes menor) e o período
 *  vai a 34 e 51 m. O que se quer é o sol quebrando de leve, não o mar. */
const ONDA_AMP = 0.016
/** números de onda do corpo calibrado, em rad/m: 0,185 dá período de 34,0 m e
 *  0,123 dá 51,1 m. */
const ONDA_KX = 0.185
const ONDA_KZ = 0.123
/** ⚠️ O RAIO MÉDIO DO CORPO QUE CALIBROU A ONDA, medido: 131,0 m em 360 rumos.
 *  É a referência da escala, e por isso é um número medido e não escolhido. */
const ONDA_R_REF = 131
/** ⚠️ CORPO MENOR TEM ONDA MENOR, E A ESCALA É A RAIZ DA RAZÃO DE RAIO.
 *  O que obriga a escalar é o COMPRIMENTO: manter 34 m de período numa poça de
 *  40 m de raio põe pouco mais de DUAS cristas no corpo inteiro, e duas cristas
 *  numa lâmina inteira não leem como onda, leem como a lâmina inteira
 *  balançando. A raiz vem da mesma física que a casa já usa para vento
 *  limitado por pista (altura e comprimento de onda crescem com a raiz da
 *  pista), e a amplitude anda junto para a inclinação não virar lixa quando o
 *  comprimento encurta. Preso entre 0,35 e 1,25 porque nenhum corpo desta
 *  cordilheira tem pista de vento para passar do calibrado, e abaixo de 0,35 a
 *  onda desaparece contra o fresnel. */
const ONDA_ESC_MIN = 0.35
const ONDA_ESC_MAX = 1.25

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
 *  (`scene.background = 0x000000`, é a Lua) e o que existe sobre as lagoas é a
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
// tabela de contorno medida na construção, agora UMA POR CORPO.
//
// ⚠️ E ELA COMEÇA NULA DE PROPÓSITO. Sem `?lagoa=1` ninguém constrói, a tabela
// segue nula e `naLagoa` responde `false` para todo ponto: não existe água na
// cena, então "está molhado?" é `false`, e o caminho de hoje não muda em nada.
// ═══════════════════════════════════════════════════════════════════════════
interface Contorno {
  cx: number
  cz: number
  nAz: number
  /** raio da linha d'água por rumo, em metros */
  raios: Float32Array
  /** o maior raio da tabela acima: fora dele não há água NESTE corpo */
  alcance: number
}
let CONTORNOS: Contorno[] | null = null
/** ⚠️ A CAIXA DE TODOS OS CORPOS DE UMA VEZ, e ela é o que segura o custo da
 *  consulta com tabela. `naLagoa` é chamada por muda de árvore numa varredura
 *  que cobre o maciço inteiro, e a esmagadora maioria dos pontos não está perto
 *  de água nenhuma: com esta caixa esses pontos saem em QUATRO comparações,
 *  independente de quantas lagoas existam, e só quem entra nela paga o laço
 *  corpo a corpo. MEDIDO, e ela não só segurou o custo, baixou: a versão de um
 *  corpo custava 39,2 ns longe e 150,6 ns perto; com DOIS corpos são 9,0 ns
 *  longe e 118,3 ns perto. O ganho de perto é outro: a caixa por corpo passou a
 *  ser o maior raio MEDIDO da linha d'água (154,5 m no corpo calibrado) em vez
 *  do teto da busca (260 m), que sempre foi generoso demais. */
let CAIXA: { x0: number; x1: number; z0: number; z1: number } | null = null

/** smoothstep no intervalo [0,1], a mesma curva que o resto do maciço usa */
function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

function trava(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Está dentro de ALGUMA lagoa (ou a menos de `folga` metros dela)?
 *
 * Mesmo contrato de `lagos.naAgua`: `folga` é em METROS de verdade, não
 * dilatação de célula. A dilatação aqui é RADIAL, e pode ser porque cada corpo
 * é estrelado em torno do seu centro por construção (a linha d'água é uma
 * função de valor único do azimute, medida rumo a rumo), então empurrar o raio
 * para fora é o mesmo que engordar o polígono.
 *
 * CONFERIDA CONTRA O TERRENO, COM DOIS CORPOS NA MESMA CENA, e os números são
 * estes: a referência é a varredura radial fina (passo de 0,5 m, 720 rumos por
 * corpo) sobre `superficieAt` de verdade, e 80.000 pontos sorteados nas duas
 * pegadas deram **99,844% de acerto**, com os 125 discordantes TODOS a menos de
 * **0,54 m** da linha d'água fina (124 deles abaixo de 0,5 m). O resíduo é a
 * discretização do contorno, não um erro de forma. Com um corpo só: 99,858% e
 * 0,42 m no pior caso.
 *
 * ⚠️ E ESSE NÚMERO É DE PROPÓSITO O DO PIOR CASO: o segundo corpo do teste é
 * justamente um que `planejar` REPROVA na razão de forma (2,7 contra o teto de
 * 2,5). Ou seja o aviso dispara antes de o modelo estrelado começar a errar de
 * verdade, que é o lado certo para ele errar.
 *
 * E a folga é monótona, o que importa para quem planta: em 200.000 pontos,
 * `naLagoa(p)` verdadeiro implicou `naLagoa(p, 12)` verdadeiro ZERO vezes ao
 * contrário. Uma clareira pedida com folga nunca fica menor que a lâmina.
 */
export function naLagoa(x: number, z: number, folga = 0): boolean {
  const cs = CONTORNOS
  if (!cs) return false
  const cx = CAIXA!
  // porta única de todos os corpos, antes de qualquer laço e de qualquer raiz
  if (x <= cx.x0 - folga || x >= cx.x1 + folga || z <= cx.z0 - folga || z >= cx.z1 + folga) return false
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]
    const dx = x - c.cx, dz = z - c.cz
    // porta em caixa POR CORPO antes da raiz: dois corpos podem caber na mesma
    // caixa global sem que o ponto esteja perto de nenhum dos dois
    const lim = c.alcance + folga
    if (dx <= -lim || dx >= lim || dz <= -lim || dz >= lim) continue
    const d = Math.hypot(dx, dz)
    if (d >= lim) continue
    // ângulo → índice, com interpolação linear entre os dois rumos vizinhos: sem
    // ela a consulta teria degrau de 1,4 graus e a borda da mata sairia serrilhada
    const n = c.nAz
    let t = (Math.atan2(dz, dx) / (Math.PI * 2)) * n
    t = ((t % n) + n) % n
    const i0 = Math.floor(t), i1 = (i0 + 1) % n, f = t - i0
    const r = c.raios[i0] * (1 - f) + c.raios[i1] * f
    if (d < r + folga) return true
  }
  return false
}

/** o raio da linha d'água num rumo, medido no terreno de verdade. Sobe a
 *  partir do raio inscrito que o relevo publicou quando ali ainda é água e
 *  DESCE quando não é: a segunda metade é o que faz a busca continuar certa se
 *  o raio da tabela ficar para trás numa rodada futura de relevo. */
function raioDaMargem(
  heightAt: (x: number, z: number) => number,
  cx: number,
  cz: number,
  cota: number,
  inicio: number,
  alcance: number,
  grosso: number,
  cos: number,
  sen: number,
): number {
  const submerso = (r: number) => heightAt(cx + cos * r, cz + sen * r) < cota
  // 1. o intervalo, no passo grosso: `dentro` é o último raio submerso conhecido
  //    e `fora` o primeiro seco conhecido.
  let dentro: number, fora: number
  if (submerso(inicio)) {
    dentro = inicio
    fora = alcance
    for (let d = inicio + grosso; d <= alcance; d += grosso) {
      if (!submerso(d)) { fora = d; break }
      dentro = d
    }
  } else {
    // o raio da tabela ficou para trás: a margem está DENTRO dele. Descer é o
    // que faz este arquivo continuar certo se o relevo mudar numa rodada futura.
    fora = inicio
    dentro = 0
    for (let d = inicio - grosso; d > 0; d -= grosso) {
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
 * O QUE UM CORPO VIRA DEPOIS DE MEDIDO. Tudo que muda de corpo para corpo mora
 * aqui, e nada disso é escolhido a olho: rumos e anéis saem do raio inscrito
 * que o relevo publicou (ver `ARCO_ALVO` e `METROS_POR_ANEL`), a escala da onda
 * e a largura da margem saem do raio MEDIDO na superfície.
 */
interface Plano {
  nome: string
  cx: number
  cz: number
  cota: number
  nAz: number
  aneis: number
  raios: Float32Array
  raioMedio: number
  raioMax: number
  /** amplitude de inclinação da normal, escalada pelo tamanho do corpo */
  ondaAmp: number
  /** os dois números de onda, escalados pelo tamanho do corpo */
  ondaKx: number
  ondaKz: number
  margemLarg: number
  margemDentro: number
  margemAneis: number
}

/** mede um corpo da tabela do relevo contra a superfície de verdade. Devolve
 *  `null` quando ali não existe bacia nenhuma (todos os rumos secos): a tabela
 *  é do relevo, e um registro sem cova escavada não pode virar disco boiando. */
function planejar(
  heightAt: (x: number, z: number) => number,
  lago: LagoDoRelevo,
  indice: number,
): Plano | null {
  const cx = lago.centro.x, cz = lago.centro.z, cota = lago.cota
  const raio = lago.raio
  const nAz = trava(Math.round((2 * Math.PI * raio) / ARCO_ALVO / 8) * 8, AZ_MIN, AZ_MAX)
  const raios = new Float32Array(nAz)
  // o passo grosso é 2,5% do raio, com piso nos 3 m do corpo calibrado: ver a
  // nota de `BUSCA_GROSSO_FRAC`, que é onde o custo de seis corpos foi medido
  const grosso = trava(raio * BUSCA_GROSSO_FRAC, BUSCA_GROSSO, BUSCA_GROSSO_MAX)
  let soma = 0, rMax = 0, secos = 0, truncados = 0
  let alcance = raio * BUSCA_FATOR
  /** rumo que chegou ao teto da busca sem o terreno voltar a subir acima da
   *  cota: por ali a bacia não fecha, ou seja é por ali que ela VAZA */
  const vaza = new Uint8Array(nAz)
  for (let tentativa = 0; ; tentativa++) {
    soma = 0; rMax = 0; secos = 0; truncados = 0
    vaza.fill(0)
    for (let i = 0; i < nAz; i++) {
      const a = (i / nAz) * Math.PI * 2
      const r = raioDaMargem(heightAt, cx, cz, cota, raio, alcance, grosso, Math.cos(a), Math.sin(a))
      raios[i] = r
      soma += r
      if (r > rMax) rMax = r
      if (r <= 0) secos++
      // rumo que parou EM CIMA do teto: a bacia continua para fora dele
      else if (r >= alcance - grosso) { truncados++; vaza[i] = 1 }
    }
    if (truncados === 0 || tentativa >= BUSCA_DOBRAS) break
    alcance *= 2
  }
  // ⚠️ RUMO TRUNCADO NÃO VIRA LINHA D'ÁGUA, E ISTO É CONSERTO DE UM DEFEITO
  // MEDIDO NO RELEVO DE HOJE, não zelo. O teto da busca é uma decisão DESTE
  // arquivo; gravá-lo como margem é publicar um número que o terreno nunca
  // disse. O `North Tarn` da tabela (cota 683 m) vaza: varredura fina de 0,5 m
  // em 360 rumos contra `superficieAt` real mostra 7 rumos (azimute local 130 a
  // 136 graus) em que o terreno NUNCA volta a 683 m dentro de 2.000 m, e o
  // lábio mais baixo do corpo fica em 682,1 m, ou seja **0,86 m ABAIXO da
  // lâmina**; dali para fora a encosta cai a 273 m em 660 m de corrida. Com o
  // teto gravado, `planejar` publicava 7,64 ha de lâmina com "fundo" de
  // 411,75 m: água desenhada descendo a montanha, e `naLagoa` respondendo
  // `true` sobre 7,64 ha de rocha seca. É a mesma família da cova seca de
  // 04/09, ao contrário.
  //
  // O reparo é ANGULAR e conservador: cada rumo que vaza recebe a interpolação
  // entre os dois rumos FECHADOS mais próximos de cada lado. Não há risco de
  // lâmina flutuando, e a razão é geométrica: num rumo truncado o terreno está
  // ABAIXO da cota em toda a corrida, então qualquer raio até o teto continua
  // submerso. O que se escolhe é onde PARAR, e parar junto com a margem
  // vizinha é a única resposta que o terreno sustenta. Medido: North Tarn volta
  // de 7,64 ha e "fundo" 411,75 m para 3,99 ha e fundo 15,02 m, que é o corpo
  // de 3,92 ha que a frente do relevo publicou em `inverno.ts` (a diferença é
  // a mesma sobra de costura de `LAMINA_SOBRA` que os outros quatro têm).
  //
  // ⚠️ E O CONSERTO É DAQUI, O DEFEITO NÃO: quem levanta o lábio é a frente do
  // relevo. Por isso o aviso sai com o número que ela precisa (quanto falta ao
  // lábio), e não só com "deu ruim".
  if (truncados > 0 && truncados < nAz) {
    const orig = Float32Array.from(raios)
    const fechado = (i: number) => !vaza[((i % nAz) + nAz) % nAz]
    for (let i = 0; i < nAz; i++) {
      if (!vaza[i]) continue
      let ka = 1, kb = 1
      while (ka < nAz && !fechado(i - ka)) ka++
      while (kb < nAz && !fechado(i + kb)) kb++
      const ra = orig[((i - ka) % nAz + nAz) % nAz]
      const rb = orig[((i + kb) % nAz + nAz) % nAz]
      raios[i] = (ra * kb + rb * ka) / (ka + kb)
    }
    soma = 0; rMax = 0
    for (let i = 0; i < nAz; i++) { soma += raios[i]; if (raios[i] > rMax) rMax = raios[i] }
    console.warn(`[lagoa] "${lago.nome ?? `lago ${indice + 1}`}" VAZA: ${truncados} de ${nAz} rumos não fecham em `
      + `${alcance.toFixed(0)} m, ou seja o lábio da bacia está ABAIXO da lâmina (${cota} m) naquele setor e a água `
      + `escorreria por ali. A margem desses rumos foi costurada com a dos vizinhos fechados (lâmina agora até `
      + `${rMax.toFixed(0)} m). Conserto de verdade é do relevo: subir o lábio deste sítio acima de ${cota} m em `
      + 'TODOS os rumos, ou baixar a cota da tabela.')
  } else if (truncados >= nAz) {
    // nenhum rumo fecha: não existe bacia aqui, existe uma encosta inteira
    // abaixo da cota. Nada a costurar, e o corpo é pulado logo abaixo.
    console.warn(`[lagoa] "${lago.nome ?? `lago ${indice + 1}`}": NENHUM dos ${nAz} rumos fecha em ${alcance.toFixed(0)} m. `
      + `Isto não é uma bacia na cota ${cota} m, é encosta aberta. Pulado.`)
    return null
  }
  // sem cova não há água: o relevo publicou o registro mas a bacia não subiu
  // (relevo real que não carregou, ou uma rodada que mexeu na tabela sem
  // mexer no carimbo). Melhor pular ESTE corpo e dizer por quê do que desenhar
  // um disco no ar, que é o defeito que a cova seca já ensinou ao contrário.
  if (rMax <= 0 || secos > nAz / 2) return null
  // ⚠️ E A FORMA TEM DE FECHAR COMO LAGOA, não como vale: ver `FORMA_RAZAO_MAX`.
  let rMin = Infinity
  for (let i = 0; i < nAz; i++) if (raios[i] > 0 && raios[i] < rMin) rMin = raios[i]
  if (rMax > rMin * FORMA_RAZAO_MAX) {
    console.warn(`[lagoa] "${lago.nome ?? `lago ${indice + 1}`}": a linha d'água vai de ${rMin.toFixed(0)} a ${rMax.toFixed(0)} m `
      + `(razão ${(rMax / rMin).toFixed(1)}, teto ${FORMA_RAZAO_MAX}). Isto não é uma bacia fechada em volta de ${'('}${cx.toFixed(0)}, ${cz.toFixed(0)}${')'}: `
      + 'a lâmina vai passar por cima de terra seca em algum rumo. O centro ou a cota da tabela precisam mudar.')
  }
  const raioMedio = soma / nAz
  const esc = trava(Math.sqrt(raioMedio / ONDA_R_REF), ONDA_ESC_MIN, ONDA_ESC_MAX)
  return {
    nome: lago.nome ?? `lago ${indice + 1}`,
    cx, cz, cota, nAz,
    aneis: trava(Math.round(raio / METROS_POR_ANEL), ANEIS_MIN, ANEIS_MAX),
    raios, raioMedio, raioMax: rMax,
    ondaAmp: ONDA_AMP * esc,
    // comprimento de onda ∝ esc, então o NÚMERO de onda ∝ 1/esc
    ondaKx: ONDA_KX / esc,
    ondaKz: ONDA_KZ / esc,
    margemLarg: Math.max(MARGEM_LARG_MIN, MARGEM_LARG * esc),
    margemDentro: Math.min(MARGEM_DENTRO, raioMedio * 0.2),
    margemAneis: trava(Math.round(MARGEM_ANEIS * esc), MARGEM_ANEIS_MIN, MARGEM_ANEIS),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AS DUAS MALHAS, E POR QUE SÃO DUAS E NÃO DUAS POR CORPO
//
// ⚠️ TODOS OS CORPOS ENTRAM NA MESMA GEOMETRIA: uma malha de água e uma de
// margem, para a cordilheira inteira. Não é economia de linha, são três
// defeitos evitados de uma vez:
//
//   1. CHAMADA DE DESENHO. Uma malha por corpo faria 2·N chamadas; assim são 2,
//      quantos corpos existam.
//   2. ORDEM DE TRANSPARÊNCIA. As duas malhas são transparentes, e o three
//      ordena transparente pela DISTÂNCIA do centro do volume envolvente. Com
//      uma malha por corpo, dois lagos vizinhos com centros quase à mesma
//      distância trocariam de ordem conforme a câmera anda, e a margem de um
//      apareceria por cima da água do outro. Com uma malha só a ordem interna é
//      a da lista de índices, que é fixa.
//   3. PROGRAMA DE SHADER. Um material por corpo com `onBeforeCompile` compila
//      um programa por corpo se a chave de cache não for fixa, e o orçamento
//      desta cena é apertado (228 programas medidos, teto de 235).
//
// O que era uniforme por lagoa virou ATRIBUTO POR VÉRTICE: a profundidade de
// referência (`aRef`) e a onda (`aOnda`, amplitude e escala). É o que permite
// cada corpo ter a sua própria onda dentro de uma malha só.
// ═══════════════════════════════════════════════════════════════════════════

interface Acumulador {
  pos: number[]
  idx: number[]
}

/** ⚠️ QUANTOS TRIÂNGULOS A TRAVA OLHA. Amostra e não varredura, porque o giro é
 *  propriedade do LAÇO que emitiu o índice e não de cada triângulo: 512 amostras
 *  por passo constante caem em todos os corpos da tabela e em todos os anéis de
 *  cada um. As duas malhas somam 31.992 triângulos no relevo de hoje; olhar
 *  todos custaria o mesmo nada, mas amostra não fica cara quando a tabela
 *  crescer. */
const GIRO_AMOSTRA = 512

/**
 * A TRAVA DE ENROLAMENTO, E ELA É A MESMA DE `terrain.ts:722` E DE
 * `alpino.ts:1249`. Ver a seção do cabeçalho: as duas malhas daqui nasceram com
 * 100,00% dos triângulos virados para baixo contra material `FrontSide`, que é
 * o mesmo defeito que deixou a casca de neve invisível por três rodadas no
 * arquivo vizinho, escrito no mesmo dia.
 *
 * As duas malhas são alturas sobre a planta (a lâmina é literalmente plana, um
 * leque numa cota só), então a normal geométrica de todo triângulo não
 * degenerado tem de apontar para CIMA. Se a maioria da amostra apontar para
 * baixo, o índice inteiro é invertido.
 *
 * ⚠️ E NÃO SE CONSERTA COM `side: THREE.DoubleSide`. Isso esconderia o defeito
 * em vez de corrigi-lo: dobra o custo de fragmento de duas malhas
 * TRANSPARENTES (as duas mais caras por pixel da cena), e a face de trás fica
 * com a normal invertida, ou seja iluminada ao contrário. A água ainda escreve
 * profundidade (`depthWrite: true`, ver `materialDaAgua`), então desenhar a
 * face de baixo dela é pagar por um lado que nunca é olhado.
 *
 * ⚠️ E ELA GRITA, SEMPRE. O defeito da neve atravessou três revisões
 * exatamente por ser silencioso.
 */
function travarGiro(pos: number[], idx: number[], nome: string): number {
  const tri = idx.length / 3
  if (tri === 0) return 0
  const passo = Math.max(1, Math.floor(tri / GIRO_AMOSTRA))
  let baixo = 0, olhados = 0
  for (let t = 0; t < tri; t += passo) {
    const k = t * 3
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3
    const e1x = pos[b] - pos[a], e1z = pos[b + 2] - pos[a + 2]
    const e2x = pos[c] - pos[a], e2z = pos[c + 2] - pos[a + 2]
    // só a componente Y da normal geométrica (e1 × e2): é a única que decide
    // de que lado a face está, e ela é o DOBRO da área em planta com sinal
    const ny = e1z * e2x - e1x * e2z
    if (Math.abs(ny) < 1e-3) continue          // degenerado em planta: não vota
    olhados++
    if (ny < 0) baixo++
  }
  if (olhados === 0 || baixo * 2 <= olhados) return 0
  console.warn(`[lagoa] ⚠️ GIRO INVERTIDO em "${nome}": ${baixo} de ${olhados} triângulos amostrados saíram com a normal `
    + `geométrica para BAIXO, e o material é FrontSide — a malha inteira seria descartada como face de trás, de toda `
    + `câmera acima da água. Invertendo os ${tri} triângulos. (Mesmo defeito da casca de neve de \`alpino.ts\`; quem `
    + 'mexeu na ordem de emissão de `acumularLamina`/`acumularMargem` precisa reconferir.)')
  for (let k = 0; k + 2 < idx.length; k += 3) { const s = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = s }
  return tri
}

/**
 * A lâmina de UM corpo, acrescentada ao acumulador. Um leque de `nAz` rumos por
 * `aneis` anéis, com o raio de CADA rumo medido no terreno. Todos os vértices
 * ficam na cota DO CORPO (água parada é nivelada, essa é a definição), então a
 * normal é (0,1,0) em todos eles e `computeVertexNormals` seria trabalho para
 * chegar no mesmo lugar.
 *
 * Cada vértice carrega `aProf`, a profundidade REAL medida sob ele. ⚠️ E isto
 * é o oposto do que `lago.ts` decidiu para a cidade, com razão nos dois casos:
 * lá o leito é escavado quase plano (bacia a −26 com lâmina a −17), então
 * sondar o terreno devolveria profundidade constante e eles tiveram de derivar
 * o gradiente da distância à margem. Aqui o leito é uma cuba de verdade, de 0
 * a 20,72 m medidos, e a sonda é a resposta certa e mais barata.
 */
function acumularLamina(
  heightAt: (x: number, z: number) => number,
  p: Plano,
  ac: Acumulador,
  prof: number[],
  ref: number[],
  onda: number[],
): { area: number; profMax: number; triangulos: number } {
  const base = ac.pos.length / 3
  const { cx, cz, cota, nAz, aneis, raios } = p
  const profs: number[] = []

  const põe = (x: number, z: number) => {
    ac.pos.push(x, cota, z)
    const d = cota - heightAt(x, z)
    profs.push(d > 0 ? d : 0)
  }
  põe(cx, cz)
  let profMax = profs[0]

  for (let j = 0; j < aneis; j++) {
    // ⚠️ ANEL MAIS APERTADO PERTO DA MARGEM (expoente 0,78, não linear): é lá
    // que a profundidade sai do fundo para 0 em poucos metros, e é lá que o
    // gradiente varying precisa de vértice. No centro a cuba tem fundo plano e
    // não há nada para interpolar.
    const t = Math.pow((j + 1) / aneis, 0.78)
    for (let i = 0; i < nAz; i++) {
      const a = (i / nAz) * Math.PI * 2
      const r = (raios[i] + LAMINA_SOBRA) * t
      põe(cx + Math.cos(a) * r, cz + Math.sin(a) * r)
      const k = profs.length - 1
      if (profs[k] > profMax) profMax = profs[k]
    }
  }

  // ⚠️ A REFERÊNCIA DO GRADIENTE É DESTE CORPO, não da cena: metade da cuba
  // medida aqui, que é onde a água deixa de deixar o leito passar. Uma
  // referência única faria a poça rasa parecer só a beirada de um lago fundo.
  const uRef = Math.max(2, profMax * 0.5)
  for (let k = 0; k < profs.length; k++) {
    prof.push(profs[k])
    ref.push(uRef)
    onda.push(p.ondaAmp, p.ondaKx, p.ondaKz)
  }

  const i0 = ac.idx.length
  for (let i = 0; i < nAz; i++) {
    const i2 = (i + 1) % nAz
    // ⚠️ O SENTIDO DE GIRO, E ELE ERA A CAUSA DE A ÁGUA NÃO APARECER (05/09,
    // ver o cabeçalho e `travarGiro`). O vértice do rumo `i` está em
    // (cos a, sin a) e o do rumo `i2` em (cos(a+da), sin(a+da)), com da > 0. A
    // ordem antiga do leque (`centro, i, i2`) dava normal geométrica
    // (v1−v0)×(v2−v0) com Y = −r²·sin(da), ou seja face virada para BAIXO em
    // 22.808 de 22.808 triângulos, e o material é `FrontSide`. Trocados os dois
    // últimos índices, sai +r²·sin(da).
    //
    // As duas partições do quad seguem o MESMO sentido, e as contas fecham nas
    // duas (r = raio do anel de dentro, dr = passo radial, da = passo angular):
    //   (a0,b1,b0): Y = +r·dr·da        (a0,a1,b1): Y = +r·dr·da
    // (as ordens antigas, `a0,b0,b1` e `a0,b1,a1`, davam −r·dr·da nas duas.)
    ac.idx.push(base, base + 1 + i2, base + 1 + i)
    for (let j = 0; j < aneis - 1; j++) {
      const a0 = base + 1 + j * nAz + i, a1 = base + 1 + j * nAz + i2
      const b0 = base + 1 + (j + 1) * nAz + i, b1 = base + 1 + (j + 1) * nAz + i2
      ac.idx.push(a0, b1, b0, a0, a1, b1)
    }
  }

  // a área sai da malha CONSTRUÍDA, somada triângulo a triângulo: é o número
  // que se publica, e ele não pode ser π·r² de um raio que não existe
  let area = 0
  const P = ac.pos
  for (let t = i0; t < ac.idx.length; t += 3) {
    const a = ac.idx[t] * 3, b = ac.idx[t + 1] * 3, c = ac.idx[t + 2] * 3
    area += Math.abs((P[b] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b + 2] - P[a + 2])) / 2
  }
  return { area, profMax, triangulos: (ac.idx.length - i0) / 3 }
}

/**
 * ÁGUA ESCURA E PARADA, e "parada" é o requisito de forma, não um atalho.
 *
 * A onda vem por atributo (`aOnda`: amplitude e os dois números de onda), então
 * um material só atende a cordilheira inteira com uma onda por corpo. O que
 * carrega a leitura no lugar da onda é o FRESNEL, e forte: 0,78 contra os 0,62
 * do lago da praça. Espelho é a assinatura de tarn alpino, e o que ele espelha
 * aqui é a casca e a neve (ver `REFLEXO`), porque o céu desta cena é preto.
 *
 * Um programa novo, com chave fixa, e ele só existe com `?lagoa=1`: a cena
 * compila 228 programas com teto medido de 235, e as lagoas entram com dois
 * (este e o da margem) apenas no caminho da bandeira, sejam quantas forem.
 */
function materialDaAgua(): { mat: THREE.MeshStandardMaterial; relogio: { value: number } } {
  const mat = new THREE.MeshStandardMaterial({
    color: COR_FUNDA,
    roughness: 0.12,
    metalness: 0.02,
    transparent: true,
    // ⚠️ ESCREVE PROFUNDIDADE mesmo transparente, mesma razão de `lago.ts`: as
    // lâminas são cascas planas que nunca se sobrepõem entre si (cada bacia é
    // uma cova separada), e sem isso elas deixariam de ocluir o barranco do
    // outro lado.
    depthWrite: true,
    side: THREE.FrontSide,
  })
  const uTempo = { value: 0 }
  const rasa = new THREE.Color(COR_RASA)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = uTempo
    sh.uniforms.uRasa = { value: new THREE.Vector3(rasa.r, rasa.g, rasa.b) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>',
               '#include <common>\nattribute float aProf;\nattribute float aRef;\nattribute vec3 aOnda;\n'
               + 'varying float vProf;\nvarying float vRef;\nvarying vec3 vOnda;\nvarying vec3 vMundoLagoa;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vProf = aProf;
        vRef = aRef;
        vOnda = aOnda;
        vMundoLagoa = (modelMatrix * vec4(position, 1.0)).xyz;
      `)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTempo;
        uniform vec3 uRasa;
        varying float vProf;
        varying float vRef;
        varying vec3 vOnda;
        varying vec3 vMundoLagoa;
      `)
      // a ondulação entra depois de a normal existir e antes de a luz somar
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        float ondaA = sin(vMundoLagoa.x * vOnda.y + uTempo * 0.21);
        float ondaB = sin(vMundoLagoa.z * vOnda.z - uTempo * 0.16);
        normal = normalize(normal + vec3(ondaA * vOnda.x, 0.0, ondaB * vOnda.x));
      `)
      // profundidade e reflexo entram no fim, sobre a cor já iluminada
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float funda = smoothstep(0.0, vRef, vProf);
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
  mat.customProgramCacheKey = () => 'lagoa-agua-v2'
  mat.needsUpdate = true
  return { mat, relogio: uTempo }
}

/**
 * A MARGEM de UM corpo, acrescentada ao acumulador: rocha molhada e faixa
 * úmida, SEM PRAIA DE AREIA.
 *
 * ⚠️ E a ausência da areia é decisão, não esquecimento. `lagos.ts` dá praia de
 * areia clara a toda cratera fora da baía, e é o certo lá embaixo: cratera
 * lunar cheia de pó tem praia. Uma lagoa encaixada numa sela de rocha não tem:
 * tem pedra escura e molhada na linha d'água, ficando seca e clara para cima.
 * Copiar a praia daqui seria copiar a assinatura errada.
 *
 * A faixa é um leque que acompanha o contorno medido, deitado na superfície,
 * e entra por baixo da lâmina: sem essa sobreposição a costura entre as duas
 * malhas abriria um fio de terreno cru na linha d'água, que é o mesmo defeito
 * dos 40 m de barragem que apareceu entre canal e lago em 02/09.
 *
 * A umidade viaja no atributo `aMolhado` e faz DUAS coisas de uma vez: ela
 * escurece o albedo (pela cor por vértice, de graça) e derruba a rugosidade
 * (pela injeção de shader abaixo). Rocha molhada é escura E brilhante; só
 * escurecer daria uma mancha de tinta. O ALFA da cor é outra coisa: é o
 * desvanecer da faixa contra o terreno, na aresta de fora.
 */
function acumularMargem(
  heightAt: (x: number, z: number) => number,
  p: Plano,
  ac: Acumulador,
  cor: number[],
  uv: number[],
  molh: number[],
  passo: number,
): number {
  const base = ac.pos.length / 3
  const { cx, cz, nAz, raios, margemLarg, margemDentro, margemAneis } = p
  const cMolhada = new THREE.Color(COR_MOLHADA)
  const cSeca = new THREE.Color(COR_SECA)
  const tmp = new THREE.Color()

  for (let j = 0; j <= margemAneis; j++) {
    const u = j / margemAneis
    for (let i = 0; i < nAz; i++) {
      const a = (i / nAz) * Math.PI * 2
      const r = raios[i] - margemDentro + u * (margemDentro + margemLarg)
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      ac.pos.push(x, heightAt(x, z) + MARGEM_LEVANTE, z)
      // ⚠️ A UMIDADE É MEDIDA A PARTIR DA LINHA D'ÁGUA, NÃO DA BORDA DA FAIXA.
      // Parametrizar por `u` (0 na aresta submersa) deixaria a rocha 36% seca
      // já ENCOSTADA na água, que é o oposto do que se quer: a pedra mais
      // escura da lagoa é exatamente a que a lâmina lambe. Dentro d'água a
      // umidade é cheia; para fora ela cai pelo afastamento da margem.
      //
      // ⚠️ E NÃO É LINEAR NA LARGURA. Rocha de beira de lago seca depressa: o
      // expoente 0,55 põe a metade escura no primeiro terço da faixa, que é a
      // proporção que uma foto de tarn mostra. Linear daria uma rampa de tinta
      // cinza atravessando a margem inteira.
      const dAgua = r - raios[i]
      const seco = dAgua <= 0 ? 0 : Math.pow(Math.min(1, dAgua / margemLarg), 0.55)
      molh.push(1 - seco)
      tmp.copy(cMolhada).lerp(cSeca, seco)
      // opaca até 55% da faixa e desvanecendo até 0 na aresta: o último terço é
      // o que costura a rocha da lagoa no terreno do maciço sem deixar linha
      cor.push(tmp.r, tmp.g, tmp.b, 1 - suave01((dAgua / margemLarg - 0.55) / 0.45))
      uv.push(x / passo, z / passo)
    }
  }
  let tri = 0
  for (let j = 0; j < margemAneis; j++) {
    for (let i = 0; i < nAz; i++) {
      const i2 = (i + 1) % nAz
      const a0 = base + j * nAz + i, a1 = base + j * nAz + i2
      const b0 = base + (j + 1) * nAz + i, b1 = base + (j + 1) * nAz + i2
      // ⚠️ MESMO GIRO DA LÂMINA, E PELO MESMO MOTIVO MEDIDO: a ordem antiga
      // (`a0,b0,b1` / `a0,b1,a1`) dava Y = −r·dr·da nas duas partições, e a
      // faixa saía com 9.184 de 9.184 triângulos virados para baixo contra
      // material `FrontSide`. Aqui o erro custava DOBRADO: a margem chama
      // `computeVertexNormals`, que deriva a normal DO ENROLAMENTO, então o
      // atributo que ilumina também apontava para baixo (média medida
      // (0,0024, −1,0000, 0,0080)). Mesmo se fosse desenhada, a rocha molhada
      // estaria iluminada pelo lado de dentro do morro.
      ac.idx.push(a0, b1, b0, a0, a1, b1)
      tri += 2
    }
  }
  return tri
}

function materialDaMargem(): THREE.MeshStandardMaterial {
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
  return mat
}

/** o que devolver quando não há lagoa nenhuma: grupo vazio, zero em tudo, e
 *  `update`/`dispose` que não fazem nada. Quem chama não precisa de `if`. */
function lagoaVazia(): Lagoa {
  const group = new THREE.Group()
  group.name = 'lagoa'
  return { group, area: 0, profMax: 0, triangulos: 0, corpos: [], update() {}, dispose() { group.clear() } }
}

/**
 * Monta TODAS as lagoas da tabela `LAGOS`. Síncrona, sem rede, sem GLB e sem
 * textura nova (a pedra vem do cache compartilhado de `materiais.ts`).
 *
 * ⚠️ E ELA CUSTA UM QUADRO INTEIRO, medido: 7.739 sondas de terreno e 559 ms
 * com o corpo calibrado sozinho; 95.614 sondas e 4,2 s com uma tabela de seis
 * corpos. O trabalho é quase todo sonda, a 62 µs cada. Isso é aceitável AQUI e
 * por um motivo específico: as lagoas são opt-in (`?lagoa=1`), então só paga
 * quem foi ver. ⚠️ NO DIA EM QUE A BANDEIRA VIRAR PADRÃO, ISTO TEM DE ENTRAR
 * NA `Obra` FATIADA, como `invernoComoTrabalho` fez em 03/09 pelo mesmo
 * motivo, e o argumento fica mais forte a cada corpo que a tabela ganhar: com
 * seis, o congelamento passa de quatro segundos.
 *
 * ⚠️ NÃO RECEBE `PerfProfile`, DE PROPÓSITO. A revisão desta rodada reprovou
 * um módulo por aceitar um perfil e nunca ler campo nenhum dele. As lagoas
 * somam alguns milhares de triângulos em duas chamadas de desenho, uma fração
 * de 1% dos 6,3 M da cena: não há nada aqui que valha um teto por tier de
 * máquina. Se um dia valer, o perfil entra junto com o campo que ele controla,
 * não antes.
 */
export function buildLagoa(o: LagoaOpts): Lagoa {
  if (!LAGOA_ATIVA) return lagoaVazia()
  // ⚠️ SEM O PARQUE DE INVERNO NÃO EXISTE BACIA NENHUMA. As cotas da tabela
  // vivem nas centenas de metros e quem escava até lá é `alturaInvernoAt`; com
  // `?inverno=0` o terreno ali fica dezenas de metros acima e as lâminas
  // nasceriam ENTERRADAS (ou, pior, flutuando num rumo e enterradas no outro).
  // Melhor não subir e dizer por quê.
  if (!INVERNO_ATIVO) {
    console.warn('[lagoa] `?lagoa=1` pede `?inverno` ligado: as bacias são escavadas por `alturaInvernoAt`. Sem elas não há água.')
    return lagoaVazia()
  }
  const heightAt = o.heightAt

  const tabela = tabelaDoRelevo()
  if (tabela.length === 0) {
    console.warn('[lagoa] `inverno.ts` não publica corpo d\'água nenhum (nem `LAGOS`, nem `LAGOA_CENTRO`): sem água.')
    return lagoaVazia()
  }

  const planos: Plano[] = []
  for (let i = 0; i < tabela.length; i++) {
    const p = planejar(heightAt, tabela[i], i)
    if (p) planos.push(p)
    else {
      // acontece quando os relevos reais não carregaram (`carregarRelevo` avisa
      // no console): sem os carimbos o maciço fica só com envelope e a bacia
      // não é escavada. Água aqui seria um disco boiando no ar.
      console.warn(`[lagoa] "${tabela[i].nome ?? `lago ${i + 1}`}" não tem bacia escavada na cota ${tabela[i].cota} m: pulado.`)
    }
  }
  if (planos.length === 0) {
    console.warn('[lagoa] nenhuma bacia da tabela do relevo está escavada: o relevo do maciço não subiu. Sem água.')
    return lagoaVazia()
  }

  // ── a água ────────────────────────────────────────────────────────────────
  const acAgua: Acumulador = { pos: [], idx: [] }
  const prof: number[] = [], ref: number[] = [], onda: number[] = []
  const corpos: CorpoMedido[] = []
  let areaTotal = 0, profGeral = 0
  for (const p of planos) {
    const m = acumularLamina(heightAt, p, acAgua, prof, ref, onda)
    areaTotal += m.area
    if (m.profMax > profGeral) profGeral = m.profMax
    corpos.push({
      nome: p.nome, area: m.area, profMax: m.profMax, cota: p.cota,
      raioMedio: p.raioMedio, triangulos: m.triangulos,
    })
  }
  // ⚠️ A TRAVA DE ENROLAMENTO, ANTES DE A GEOMETRIA EXISTIR. Ver `travarGiro`:
  // é a trava de `terrain.ts:722`, que este módulo não tinha, e sem ela a
  // lâmina inteira era descartada como face de trás.
  travarGiro(acAgua.pos, acAgua.idx, 'lagoa:agua')
  const nA = acAgua.pos.length / 3
  const geoAgua = new THREE.BufferGeometry()
  geoAgua.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acAgua.pos), 3))
  // água parada é plana: a normal é (0,1,0) em todo vértice, e escrevê-la
  // direto poupa o `computeVertexNormals` de chegar no mesmo lugar
  const nor = new Float32Array(nA * 3)
  for (let k = 0; k < nA; k++) nor[k * 3 + 1] = 1
  geoAgua.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geoAgua.setAttribute('aProf', new THREE.BufferAttribute(new Float32Array(prof), 1))
  geoAgua.setAttribute('aRef', new THREE.BufferAttribute(new Float32Array(ref), 1))
  geoAgua.setAttribute('aOnda', new THREE.BufferAttribute(new Float32Array(onda), 3))
  geoAgua.setIndex(acAgua.idx)

  const { mat: matAgua, relogio } = materialDaAgua()
  const agua = new THREE.Mesh(geoAgua, matAgua)
  agua.name = 'lagoa:agua'
  // água não recebe nem projeta sombra: ela já é o espelho da cena, e sombra
  // de árvore desenhada sobre a lâmina brigaria com o fresnel
  agua.receiveShadow = false
  agua.castShadow = false
  agua.frustumCulled = false
  agua.renderOrder = 1 // ver a nota de ordem em `acumularMargem`

  // ── a margem ──────────────────────────────────────────────────────────────
  const acMar: Acumulador = { pos: [], idx: [] }
  const cor: number[] = [], uv: number[] = [], molh: number[] = []
  const passo = superficie('pedra').metros
  let triMargem = 0
  for (const p of planos) triMargem += acumularMargem(heightAt, p, acMar, cor, uv, molh, passo)
  // ⚠️ ANTES DO `computeVertexNormals` LÁ EMBAIXO, E A ORDEM É OBRIGATÓRIA:
  // ele deriva a normal do ENROLAMENTO, então corrigir o índice depois dele
  // deixaria a faixa desenhada e iluminada ao contrário.
  travarGiro(acMar.pos, acMar.idx, 'lagoa:margem')
  const geoMar = new THREE.BufferGeometry()
  geoMar.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acMar.pos), 3))
  // ⚠️ QUATRO COMPONENTES, e o three só respeita o alfa da cor por vértice se
  // o material for `transparent` (armadilha já paga pela praia dos lagos). Com
  // itemSize 3 a faixa acabaria numa ARESTA de pedra clara contra o regolito
  // cru, que é exatamente a borda de adesivo que se está tentando não fazer.
  geoMar.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cor), 4))
  geoMar.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2))
  geoMar.setAttribute('aMolhado', new THREE.BufferAttribute(new Float32Array(molh), 1))
  geoMar.setIndex(acMar.idx)
  // os corpos não compartilham vértice (cada leque é uma ilha de índices), então
  // a normal de cada um sai da geometria dele mesmo
  geoMar.computeVertexNormals()

  const margem = new THREE.Mesh(geoMar, materialDaMargem())
  margem.name = 'lagoa:margem'
  // ⚠️ ORDEM EXPLÍCITA, e ela não é decoração: as duas malhas são
  // transparentes e o three ordena transparente por DISTÂNCIA do centro do
  // volume envolvente. Os dois centros estão em cima um do outro (é o mesmo
  // conjunto de corpos), então a ordem sairia por ruído de ponto flutuante e
  // trocaria conforme a câmera anda. Com a margem em 0 e a água em 1 a rocha do
  // leito é desenhada primeiro e continua aparecendo POR BAIXO da água rasa,
  // que é metade do que faz a beirada ler como beirada.
  margem.renderOrder = 0
  margem.receiveShadow = o.sombra ?? true
  // fita deitada no chão: a sombra dela cairia nela mesma e pagaria passe de
  // mapa de sombra por nada
  margem.castShadow = false
  margem.frustumCulled = false

  const group = new THREE.Group()
  group.name = 'lagoa'
  // a margem entra antes da água na lista, e o `renderOrder` das duas garante
  // que a ordem de desenho seja essa mesmo (ver a nota em `acumularMargem`)
  group.add(margem)
  group.add(agua)

  // a tabela só é publicada quando existe água de verdade na cena: é o que faz
  // `naLagoa` responder `false` em todo caminho que não construiu lagoa
  CONTORNOS = planos.map((p) => ({ cx: p.cx, cz: p.cz, nAz: p.nAz, raios: p.raios, alcance: p.raioMax }))
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const c of CONTORNOS) {
    if (c.cx - c.alcance < x0) x0 = c.cx - c.alcance
    if (c.cx + c.alcance > x1) x1 = c.cx + c.alcance
    if (c.cz - c.alcance < z0) z0 = c.cz - c.alcance
    if (c.cz + c.alcance > z1) z1 = c.cz + c.alcance
  }
  CAIXA = { x0, x1, z0, z1 }

  return {
    group,
    area: areaTotal,
    profMax: profGeral,
    triangulos: acAgua.idx.length / 3 + triMargem,
    corpos,
    update(t: number) { relogio.value = t },
    dispose() {
      CONTORNOS = null
      CAIXA = null
      for (const m of [agua, margem]) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
      group.clear()
    },
  }
}
