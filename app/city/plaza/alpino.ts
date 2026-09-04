// ═══════════════════════════════════════════════════════════════════════════
// O ALPINO: a coroa de neve e a mata de conífera do maciço oeste, que é o
// pedaço de relevo que entrou pra dentro da abóbada quando ela cresceu de 7.050
// pra 9.050 m de raio.
//
// ⚠️ NÃO EXISTEM ALPES AQUI, E ESSE É O PARTIDO INTEIRO. Medido sobre a grade do
// terreno COMO CONSTRUÍDO (célula 40,1 m), recortada pelo interior da abóbada:
//   pico dentro da casca      321,7 m   (x = -8.234, z = -902; r = 8.283 m, azimute 264°)
//   mediana do terreno         10,6 m   (o chão da cidade é pódio plano)
//   p90 / p95 / p99     140,9 / 212,3 / 263,3 m
//   acima de 250 m       5,29 km², 2,06% da área, TUDO no anel de 6.032 a 9.050 m
//   acima de 300 m       0,09 km², desprezível
// 320 m de pico com a cidade a 10 m é um MORRO GRANDE, não um alpe. Pico nevado
// pontudo nessa proporção lê como brinquedo. Por isso a neve aqui é uma COROA
// no arco oeste, fundo encostado na casca, e não um destino.
//
// ⚠️ A COTA DE NEVE NÃO É UM CORTE NA COTA. Corte duro em h = 250 desenha uma
// CURVA DE NÍVEL, que a olho vira um círculo perfeito no morro e denuncia a
// conta. Três coisas quebram isso, e as três estão implementadas:
//   1. faixa de mistura de 30 m (235 a 265), não um degrau;
//   2. modulação por INCLINAÇÃO: neve não gruda em face íngreme, então a
//      cobertura cai de cheia em até 30° pra zero em 55°;
//   3. ruído de mundo de célula ~240 m deslocando o limiar em ±16 m.
//
// ⚠️ A MATA ENTRA ABAIXO DA NEVE, E ELA É QUEM DÁ A LEITURA DE MONTANHA. A faixa
// de 150 a 250 m é exatamente onde moram o p95 e o p99: é a última banda com
// área de verdade antes do branco. Sem ela o morro sobe do pódio direto pro
// gelo, e 320 m sozinhos não contam a história.
//
// ⚠️ UMA GRADE DE ALTURA SÓ, AMOSTRADA UMA VEZ. A neve precisa da grade e a mata
// precisa de altura em 210 mil candidatos: chamar `heightAt` nos dois seria meio
// milhão de consultas na construção. Aqui a grade de 40 m (a MESMA célula da
// grade do terreno, então não se perde informação) é amostrada uma vez dentro do
// anel e a mata lê dela por bilinear.
//
// ⚠️ AGORA MEDIDO (04/09, Node 20 + tsx, sem navegador), com o terreno REAL:
// `buildTerrain` sobre o heightmap da NASA em disco mais `alturaInvernoAt` com
// as três feições lidas de `public/`, e `heightAt` = `terrain.superficieAt`.
//
//     103.674 chamadas de `superficieAt`, 1.453 ms   antes desta rodada
//     138.340 chamadas,                   2.890 ms   com a folga adaptativa
//
// O custo é de CHAMADA, não de laço: no maciço uma consulta a `superficieAt`
// custa 56,3 µs (contra 11,4 µs de `heightAt`, porque ela lineariza a malha e
// paga 3 a 4 `heightAt` por consulta). Quem mexer neste arquivo tem de contar
// chamada, não linha. O +1,4 s de construção é o preço da neve deixar de estar
// enterrada (ver o achado 04/09 mais abaixo); é caro e está declarado.
//
// ⚠️ A ALTURA VEM DE `superficieAt`, NÃO DE `heightAt`. Regra da casa, e já
// custou um erro de 42 m: quem desenha coisa que ENCOSTA no chão tem de usar a
// linearização que a malha do regolito realmente mostra. Quem liga este módulo
// passa `terrain.superficieAt` no campo `heightAt` das opções, como fazem vias,
// praças, lotes e a arborização.
//
// Orçamento: 4 chamadas de desenho novas (neve, conífera de perto, conífera de
// longe, sub-bosque) e 2 programas (a neve tem material próprio, transparente;
// as duas coníferas E o sub-bosque dividem um material só). Quatro, não seis:
// os dois níveis de LOD da árvore e a moita são InstancedMesh sobre o MESMO
// material, e o que separa moita de matacão é cor por instância, não peça.
//
// ⚠️ ACHADO 03/09, A CAUSA DA CHAPA SEM NEVE, MEDIDA COM SCRIPT OFFLINE (node
// importando terrain.ts + inverno.ts de verdade, sobre o heightmap real):
// depois das duas correções da rodada anterior (pre-corte adaptativo e
// LEVANTE escalado por zona), a MÁSCARA JÁ NÃO ERA O PROBLEMA. Amostrando a
// grade inteira do maciço (célula 40 m, mesma desta função) com
// `?inverno=1` ligado: 6.270 quads com cobertura > 0, **10,03 km² de área**,
// cobertura MÁXIMA 0,96 (o teto do próprio `neveEm`), pico real da montanha
// em 1.098 m sobre a grade de `superficieAt`. A máscara SEMPRE devolveu neve
// de verdade; zero pixel branco na chapa não podia vir daqui.
// O material era o problema. `conjNeve = superficie('concreto')` (linha que
// existia aqui) emprestava a receita de PAVIMENTO como mapa de albedo da
// neve. Medido (amostrando o canvas real gerado por `amostraConcreto`):
// albedo médio (169, 166, 160) em sRGB 0-255. Multiplicado pela cor por
// vértice `COR_NEVE` (232, 236, 242), o produto cai pra ~61% de reflectância
// (≈156, 156, 153), um CINZA MÉDIO MORNO, não branco. A cobertura de 0,96
// no pico da montanha, a MELHOR condição possível, nunca passava disso: a
// textura emprestada cortava o teto de branco que `COR_NEVE` foi desenhada
// pra entregar (91% por canal) pela metade, e o resultado, semitransparente
// sobre um regolito da MESMA família de tom (`TINTA_REGOLITO = #9A948B`,
// medida em `terrain.ts`), lia como "sem neve nenhuma" numa chapa, mesmo com
// a malha de fato desenhada por baixo. Script e números completos no
// relatório desta rodada.
//
// O CONSERTO: a neve não usa mais NENHUM mapa de albedo emprestado. A cor
// sai só da cor por vértice (branco quase puro, ver `COR_NEVE_PO` abaixo),
// que agora também carrega DUAS variações (pó fresco vs pista compactada, e
// a borda suja perto da rocha), ver a seção de cor mais abaixo. A textura
// nova que entrou é só um NORMAL MAP de alta frequência (o brilho de
// cristal), não um albedo: ver "A TEXTURA DO BRILHO" mais abaixo.
//
// ⚠️⚠️ ACHADO 04/09, E É O QUE FALTAVA: A NEVE ESTAVA ENTERRADA NA PEDRA.
// Depois do conserto do material a chapa continuou sem neve, e a causa é
// GEOMÉTRICA, não de máscara nem de cor.
//
// MEDIDO OFFLINE (Node 20, `tsx`, sem navegador) com o TERRENO REAL: o próprio
// `buildTerrain` sobre `public/lunar/btc-core-heightmap.f32` mais
// `alturaInvernoAt` com as três feições lidas de `public/city/inverno/`, e a
// casca de neve conferida triângulo a triângulo (22.538 triângulos, 45 pontos
// de amostra em cada, altura de referência = `superficieAt`, a MESMA superfície
// que a malha do regolito desenha):
//
//   toda a casca      26,1% dos triângulos com o terreno FURANDO a neve
//   acima de 250 m    30,4% furando, 21,8% por mais de 0,4 m
//   acima de 600 m    22,9% furando, 17,5% por mais de 2 m, máximo 37,3 m
//
// A conta é simples: a casca tem célula de 40 m e a corda de um quad é uma
// RETA, enquanto o terreno por baixo tem talude de até 60°. O `LEVANTE` era um
// número FIXO (0,4 m fora do parque, 9 m dentro dele) e um número fixo não pode
// cobrir um erro que varia de 0 a dezenas de metros. Um quarto da neve do corpo
// alto ficava debaixo da rocha, e o que sobrava aparecia em retalhos: exatamente
// o que o fundador viu.
//
// O CONSERTO É MEDIR O ERRO EM VEZ DE CHUTAR O LEVANTE, ver "FOLGA ADAPTATIVA"
// na seção 2b. Antes e depois na MESMA carga (o terreno tem ruído de execução,
// ver a armadilha abaixo, então comparar dois processos diferentes não vale):
//
//   toda a casca      26,1% → 2,8% de furo, p99 12,3 → 0,8 m, máximo 37,3 → 6,2
//   acima de 250 m    30,4% → 3,6%
//   acima de 600 m    22,9% → 6,5%, e ZERO triângulo furando por mais de 9 m
//   e a casca FLUTUA MENOS que antes (mediana 5,80 → 4,41 m), porque a folga
//   local substituiu os 9 m constantes que o parque levantava em toda parte.
//
// ⚠️ ARMADILHA DE MEDIÇÃO, E ELA CUSTOU MEIA HORA AQUI: entre duas execuções o
// pico do maciço mediu 1.017,9 m e depois 1.026,6 m, com o mesmo código deste
// arquivo. A primeira suspeita (falta de reprodutibilidade em ponto flutuante)
// foi TESTADA E REFUTADA: três execuções seguidas devolvem `pico = 1.023,4115`
// e `superficieAt(-8325, 291) = 761,770532` idênticos ao sexto decimal. O que
// mudava era o TERRENO: `inverno.ts` estava sendo reescrito por outra frente da
// mesma rodada enquanto eu media. Regra que fica: comparar antes e depois SEMPRE
// dentro da MESMA carga, com o mesmo objeto de terreno, e não entre dois
// processos.
//
// ⚠️⚠️ OBRA 2, 04/09: OS TRÊS DEFEITOS QUE O REVISOR ACHOU NA OBRA 1, E OS
// TRÊS ERAM DE ORDEM E DE ORÇAMENTO, NÃO DE FORMA. A mata de 51.947 árvores e a
// casca com 2,8% de furo ficaram como estavam; o que estava errado era QUEM
// entrava em cada balde e QUANTO cada aparelho pagava. Tudo medido na mesma
// carga (mesmo processo, mesmo objeto de terreno, `alpino.ts` de HEAD e o novo
// importados lado a lado), com a câmera em (-3037, 8090), o pior caso real:
//
//   1. O BALDE DE PERTO ENCHIA PELA ORDEM DA GRADE (z crescente), não pela
//      distância à câmera. Das 13.414 árvores dentro de `R_CHEIA`, 6.000
//      entravam em malha cheia, TODAS com z entre 6.873 e 7.845, e 7.414 que
//      estavam perto caíam no volume de 8 triângulos. Em fração do que o
//      visitante tem em volta:
//
//        a menos de   100 m    antes    0,0% em malha cheia   agora 100%
//        a menos de   200 m    antes    0,0%                  agora 100%
//        a menos de   400 m    antes   19,6%                  agora 100%
//        a menos de   729 m    antes   39,6%                  agora 100%
//
//      e o balde saiu de 4 setores de 45° ocupados (2.008, 2.452, 1.032, 508,
//      0, 0, 0, 0) para os 8. Varrendo 60 posições DENTRO da mata, a fração em
//      malha cheia a 200 m tinha PIOR CASO de 0,0% e agora tem 100,0%.
//
//   2. O SUB-BOSQUE TINHA O MESMO VÍCIO, porque era emitido dentro do laço do
//      balde de perto: 2.600 de 2.600 saturados, moita e matacão em 3 setores
//      de 8, com peça a até 1.399 m. Agora ele tem CORTE PRÓPRIO (histograma de
//      peças, não de árvores): 8 setores de 8, e a peça mais distante a 469 m,
//      que é onde ela ainda mede mais de 1 px.
//
//   3. O PERFIL DE MÁQUINA CHEGAVA E NÃO ERA LIDO. Ver `orcamentoDe`: teto de
//      árvore, de balde de perto, de sub-bosque e sombra agora saem dele.
//
//   E O `frustumCulled = false` ERA UMA MENTIRA ÚTIL: a esfera é que estava
//   errada (calculada uma vez com `count = 0`). Ver o bloco das InstancedMesh.
//   Com a esfera refeita a cada rebalanceamento, o culling ligou, e o que ele
//   paga é o PASSE DE SOMBRA: com a câmera na praça, 415.576 triângulos por
//   quadro viravam mapa de sombra de uma mata a 6 km, fora da caixa do sol.
//   Agora são ZERO. Provado por varredura, não por argumento: 400 posições de
//   câmera × 3 malhas, a folga mínima de QUALQUER instância dentro da esfera é
//   +2,949 m (nunca negativa), e as 640 checagens com `count = 0` devolvem
//   esfera vazia, que é o que corta.
//
//   O custo por quadro do histograma, mínimo de 40 amostras aquecidas (mínimo,
//   não mediana: a máquina estava com load entre 4 e 10 e a mediana mentia): o
//   rebalanceamento dentro da mata foi de 2,59 para 2,98 ms com 51.947 árvores
//   na execução mais leve, e o MESMO par mediu 3,68 → 4,15 ms com a máquina
//   mais ocupada. O nível não é comparável entre execuções; a DIFERENÇA é, e
//   ela ficou entre 0,39 e 0,48 ms para os dois histogramas mais a caixa das
//   três esferas. Na cidade continua em 0,01 ms, porque a porta de
//   `temArvorePerto` não mudou.
//
//   ⚠️ E A CONSTRUÇÃO NÃO MUDOU: 138.340 chamadas de `superficieAt` antes e
//   depois, 51.947 árvores, 18,030 km² de neve e 458.914 triângulos declarados,
//   idênticos. O tempo de parede oscilou de 3,3 a 5,1 s entre execuções na
//   MESMA versão do código (a máquina estava carregada), então quem for medir
//   isto de novo conte CHAMADA, não segundo. A repartição, essa é estável e é
//   nova nesta rodada:
//
//       fase grade (103.570 chamadas)        1.560 ms   15,1 µs por chamada
//       folga adaptativa (34.770 chamadas)   2.313 ms   66,5 µs por chamada
//       mata + geometria + LOD                 246 ms
//
//   Ou seja o item caro NÃO é a grade do anel, é a sub-amostragem da folga: 25%
//   das chamadas e 56% do tempo, porque toda ela cai dentro do maciço, onde
//   `superficieAt` custa quatro vezes mais que na planície. Quem for atrás do
//   tempo de carga tem de atacar ESSA fase.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DOME_R } from './dome'
import type { DistanceCuller, PerfProfile } from './perf'
import { INVERNO_ATIVO, zonaEsquiavelAt, PISTAS } from './inverno'

export interface AlpinoOpts {
  /** ⚠️ passe `terrain.superficieAt`, não `terrain.heightAt`. Ver cabeçalho. */
  heightAt: (x: number, z: number) => number
  /** está molhado? vem de `lagos.naAgua`, fonte única com quem desenha a água */
  molhado?: (x: number, z: number) => boolean
  /** está na rua? vem de `vias.naVia`. No anel de 6 a 9 km não deve haver rua,
   *  mas o teste é barato e evita conífera nascendo em pista se a malha crescer */
  naVia?: (x: number, z: number, folga?: number) => boolean
  sombra?: boolean
  profile?: PerfProfile
  culler?: DistanceCuller
}

export interface Alpino {
  group: THREE.Group
  /** coníferas plantadas */
  arvores: number
  /** área da coroa de neve efetivamente desenhada, em km² */
  neveKm2: number
  triangulos: number
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ── a geografia do problema, em metros ──────────────────────────────────────
/** piso do anel de trabalho. A medição põe TODO o terreno acima de 250 m entre
 *  6.032 e 9.050; 5.600 dá folga pro pé da mata sem varrer o pódio. */
const R_INT = 5600
const R_EXT = DOME_R          // 9.050
/** a célula da grade do terreno como construído */
const PASSO = 40

// ── a folga adaptativa da casca de neve (ver o achado 04/09 no cabeçalho) ────
/** ⚠️ SUB-AMOSTRAGEM DENTRO DA CÉLULA, e o número saiu de medição, não de
 *  gosto: 40/2 = 20 m. As duas opções, medidas com o terreno real, contra os
 *  26,1% de furo da versão sem folga adaptativa:
 *    20 m   138.340 chamadas de `superficieAt`, 2.890 ms de construção, furo 2,8%
 *    10 m   275.286 chamadas,                  10.182 ms,               furo 0,1%
 *  Dobrar a resolução custa o DOBRO de chamadas e 3,5× o tempo de construção
 *  para ganhar 2,7 pontos de furo num defeito que já saiu de 26% para 3%. Não
 *  paga: 20 m. */
const SUB_CORDA = 2
/** ⚠️ MARGEM SOBRE O ERRO MEDIDO, porque o déficit é amostrado a 20 m e o
 *  terreno ainda pode subir ENTRE duas amostras. Medido no terreno real, com o
 *  MESMO número de chamadas nos dois casos: sem margem (1,0) sobram 7,2% de
 *  furo, com 1,2 sobram 2,8%. Não é fator de segurança inventado, é a diferença
 *  medida entre o que a amostragem vê e o que a chapa vê, e ela é de graça. */
const FATOR_FOLGA = 1.2
/** ⚠️ TETO DA FOLGA = UM PASSO DE GRADE. Subir mais que 40 m num quad de 40 m
 *  é levantar a casca acima de 45° de corda, e a essa altura a célula é PAREDE:
 *  `neveEm` já está apagando a neve ali pela regra de inclinação (cheia até
 *  30°, zero em 55°). ⚠️ E ELE NÃO PEGA NO TERRENO DE HOJE: medido, com teto e
 *  sem teto o resultado é IDÊNTICO (2,8% de furo, 6,2 m de máximo), porque o
 *  déficit máximo medido é 30,9 m e 30,9 × 1,2 ainda cabe. Fica como
 *  guarda-corpo para o dia em que a montanha mudar, não como número calibrado
 *  para a de agora. */
const TETO_FOLGA = PASSO

const COTA_NEVE = 250
/** meia largura da faixa de mistura: 235 a 265 */
const FAIXA_NEVE = 15
/** deslocamento do limiar pelo ruído de mundo */
const RUIDO_NEVE = 16
/** célula do ruído que quebra a curva de nível */
const CELULA_RUIDO = 240

// ⚠️ A COTA DE NEVE DO PARQUE DE INVERNO É OUTRA, E SÓ VALE DENTRO DA ZONA
// ESCULPIDA POR `inverno.ts`. 250 m fazia sentido para um morro de 321,7 m de
// pico (cobria só o 22% de cima, o que este cabeçalho já defendia: "coroa no
// arco oeste, não um destino"). A montanha nova sobe a ~1.066 m sobre uma base
// a 13 m: uma estação de esqui de verdade é nevada da base ao cume nas pistas
// preparadas, não só no topo. `COTA_NEVE_INVERNO = 70` cobre praticamente todo
// o relevo esculpido; fora da zona (`zonaEsquiavelAt` = 0) a conta volta a
// `COTA_NEVE = 250` de sempre, sem gelar encosta que não é do parque.
// Sem `?inverno=1`, `zonaEsquiavelAt` devolve 0 em qualquer ponto e esta
// mistura devolve `COTA_NEVE` puro: bit a bit o que já rodava.
const COTA_NEVE_INVERNO = 70

/** faixa da mata, com pluma nas duas pontas */
const MATA_BAIXO = 150
const MATA_ALTO = 250
const PLUMA_MATA = 25

// ── A DENSIDADE DA MATA, E ELA ESTAVA ERRADA POR CONSTRUÇÃO (04/09) ──────────
//
// ⚠️ O TETO NUNCA FOI O GARGALO: O ESPAÇAMENTO ERA. Medido com o terreno real
// (14.000 árvores plantadas, ou seja o teto de 14.000 batendo): a mata ocupava
// 1.880 hectares com MÉDIA DE 7,4 ÁRVORES POR HECTARE (p90 = 14, máximo 19).
// Mata de
// conífera madura fica entre 300 e 1.000 árvores/ha; bosque aberto, 50 a 150.
// Sete por hectare é savana, não mata, e é exatamente a queixa do fundador.
//
// E o teto não podia consertar isso sozinho: com `PASSO_MATA = 26` o candidato
// nasce um a cada 676 m², ou seja NO MÁXIMO 14,8 por hectare mesmo que TODOS
// passassem em todas as máscaras. O espaçamento era o teto real.
//
// ⚠️ E A MANCHA ESTAVA MOLE. `mancha = 0,35 + 0,9 × ruído` nunca chega a zero:
// aceita em toda parte, só que pouco. Isso espalha a mesma pouca árvore por
// TODO o anel, que é a receita de "pontinhos verdes". Mata de verdade é o
// contrário: talhão fechado ao lado de clareira vazia. Agora a mancha é um
// LIMIAR (`suave01` sobre o ruído), então há terra sem nenhuma árvore e talhão
// com a densidade cheia.
//
/** espaçamento do candidato: 3,3× mais candidatos por hectare que os 26 m
 *  antigos (30,9 contra 14,8 por hectare) */
const PASSO_MATA = 18
/** ⚠️ MOITA, NÃO ÁRVORE SOLTA. Conífera se regenera em grupo (a semente cai
 *  perto da mãe), e a moita é o que dobra a densidade sem dobrar a VARREDURA,
 *  que é o item caro: cada ponto aceito vira de 1 a 4 troncos num raio de 6 m,
 *  e o custo por tronco extra é uma bilinear na grade, não uma consulta ao
 *  terreno. */
const MOITA_MAX = 5
const RAIO_MOITA = 6
/** ⚠️ TETO DURO DE INSTÂNCIAS, MEDIDO E NÃO CHUTADO. Ver a tabela de custo no
 *  relatório. Medido com o terreno real: 51.947 coníferas plantadas (a
 *  varredura rende um pouco mais que isto e o desbaste determinístico corta),
 *  415.576 triângulos no volume de longe e 3,77 MB de matriz mais tinte de
 *  instância. Densidade resultante na mancha, em árvores por hectare ocupado:
 *  p50 = 27, p90 = 83, p99 = 100, máximo 107, média 35,9, contra p50 = 7,
 *  p90 = 14, máximo 19 e média 7,4 de antes. O miolo do talhão passou a ter
 *  densidade de bosque aberto de verdade (a faixa citada é 50 a 150/ha) e a
 *  borda continua rala, que é o que borda de mata é. */
const TETO_ARVORES = 52000
/** ⚠️ O BALDE DE PERTO É UM ORÇAMENTO, NÃO UMA FOLGA, E ISSO MUDOU EM 04/09
 *  (obra 2). Até aqui este número era defendido como "folga de 2,5× sobre as
 *  2.390 medidas com a câmera pousada numa árvore"; a medição do revisor, com a
 *  câmera em (-3037, 8090), mostrou 13.414 árvores dentro de `R_CHEIA` e o
 *  balde SATURADO em 6.000. Ele nunca foi folga: é teto, e teto que enchia pela
 *  ordem errada (ver o cabeçalho e o bloco do histograma em `rebalancear`).
 *  Agora quem entra são as 6.000 MAIS PRÓXIMAS, o que naquela câmera dá um raio
 *  de mata REAL de 729 m em volta do visitante, com 100% de malha cheia dentro
 *  dele. Alocar o balde com a capacidade inteira (o que este arquivo já não
 *  faz) reservaria 3,95 MB para um `count` que fica em ZERO a viagem toda:
 *  medido com a câmera na praça, `alpino:conifera:perto` tem count = 0, e agora
 *  a esfera vazia dele ainda o tira do passe de sombra. */
const TETO_PERTO = 6000
/** além disto a conífera vira o volume de longe (8 triângulos) */
const R_CHEIA = 1400
/** ⚠️ O LOD NÃO SE REBALANCEIA POR QUADRO, e agora o custo está MEDIDO, com a
 *  câmera andando em passos de 400 m (mediana de 12 chamadas, aquecido):
 *
 *      dentro da cidade   antes 1,96 ms por passo   agora 0,01 ms
 *      dentro da mata     antes 1,17 ms (14 mil)    agora 2,66 ms (52 mil)
 *
 *  Na cidade, que é onde o visitante passa a sessão inteira, o rebalanceamento
 *  deixou de existir: quem paga isso é a porta de `temArvorePerto` abaixo.
 *  Dentro da mata o custo POR ÁRVORE caiu (0,084 para 0,051 µs), porque a
 *  matriz passou a ser escrita à mão no buffer e o tinte é assado uma vez.
 *
 *  ⚠️ 04/09, OBRA 2: o histograma de distância somou de 0,39 a 0,48 ms a este
 *  número (2,59 → 2,98 ms na execução mais leve, 3,68 → 4,15 ms na mais
 *  carregada, com 51.947 árvores), medido pelo MÍNIMO de 40 amostras aquecidas
 *  e não pela mediana, porque a máquina estava compartilhada com as outras
 *  frentes da rodada e a mediana oscilava entre 6,8 e 10,9 ms na MESMA versão
 *  do código. Mínimo é o número honesto quando a máquina não é sua, e o que se
 *  compara entre execuções é a diferença, não o nível. Na cidade nada mudou. */
const PASSO_REBALANCE = 400
/** ⚠️ SUB-BOSQUE SÓ DE PERTO, E A CONTA DE PIXEL MANDA NISSO. A vista de
 *  contrato do maciço está a 4.560 m do alvo; com 60° de campo e 1.080 px de
 *  altura, um pixel vale 0,00097 rad, então uma moita de 1,5 m mede 0,34 px a
 *  4.560 m e 1,1 px no limite de `R_CHEIA`. Sub-bosque desenhado além disso é
 *  triângulo pago para não aparecer. Dentro de `R_CHEIA` ele é o que separa
 *  "mata" de "árvore espetada em chão pelado", que era a queixa.
 *
 *  ⚠️ E ESTE TETO TAMBÉM SATURAVA PELA ORDEM ERRADA (obra 2, 04/09): 2.600 de
 *  2.600, com peça a até 1.399 m e só 3 dos 8 setores de 45° em volta da câmera
 *  ocupados, porque a emissão acontecia dentro do laço do balde de perto, na
 *  mesma ordem de k. A demanda é conhecida (62% das árvores pedem sub-bosque e
 *  cada uma pede 1 ou 2 peças, 0,93 por árvore: com o balde cheio em 6.000 são
 *  ~5.580 peças pedidas para 2.600 slots), então o corte dele sai de um
 *  histograma PRÓPRIO, que soma peças por anel. Medido depois: 8 setores de 8
 *  ocupados e a peça mais distante a 469 m, dentro da faixa em que ela ainda
 *  mede mais de 1 px. */
const TETO_SUBBOSQUE = 2600
/** ⚠️ QUANTOS ANÉIS O HISTOGRAMA DE DISTÂNCIA USA. 48 sobre `R_CHEIA` = 1.400 m
 *  dá anel de 29,2 m, que é menos que o espaçamento de candidato (`PASSO_MATA`
 *  = 18 m mais a moita de 6 m): o corte anda praticamente contínuo com a
 *  câmera, então a troca de LOD continua acontecendo por distância e não em
 *  degrau visível. Mesmo número que `instanciarFlorestaDensa` usa em
 *  `inverno.ts` (lido como referência, não editado aqui). */
const ANEIS_LOD = 48

// ── O ORÇAMENTO SAI DO PERFIL, E ATÉ 04/09 NÃO SAÍA (defeito 3 da obra 2) ────
//
// ⚠️ `AlpinoOpts.profile` EXISTIA E NENHUM CAMPO DELE ERA LIDO. Medido antes
// de consertar, com o terreno real e `profileFor('desktop','balanced')`:
// 51.947 instâncias, `frustumCulled = false` nas três malhas, `castShadow =
// true` nas três e o único culling era o registro de distância de 26 km, que
// nunca corta (o diâmetro da abóbada é 18,1 km). Celular e desktop pagavam a
// MESMA conta: 415.576 triângulos no passe principal MAIS o mesmo tanto no
// passe de sombra, de qualquer ponto da cidade.
//
// ⚠️ E O QUE ESCALA NÃO É SÓ TRIÂNGULO, É CPU. `rebalancear` percorre a mata
// inteira: 2,98 a 4,15 ms medidos para 52 mil neste desktop (mínimo de 40
// amostras aquecidas), uma vez a cada 400 m de câmera. Num telefone isso é a
// diferença entre um engasgo e um travamento, e é a razão principal de o teto
// de árvore cair no celular, não a GPU.
//
// ⚠️ O FATOR NÃO É GOSTO, É A DENSIDADE QUE SOBRA. O desbaste é uniforme
// (`hash01(k)` contra `manter`), então a densidade por hectare escala junto
// com o teto. Medido com o terreno real, na mancha, em árvores por hectare
// ocupado, e o resto medido com a câmera em (-3037, 8090):
//
//   perfil     árvores  p50/ha  p90/ha   tris desenhados  sombra   matriz+tinte
//   desktop     51.947     27      83        590.430      222.526    6,42 MB
//   celular     33.914     18      54        386.014            0    4,19 MB
//   low         19.997     12      32        226.658            0    2,47 MB
//
// 52 mil é o número que a obra 1 defendeu e ele fica intacto no desktop e em
// `?q=high`. No celular 34 mil ainda deixa o miolo do talhão com mais que o
// dobro da densidade da mata ANTES da obra 1 (p50 era 7/ha, p90 14), e é o que
// a memória e a CPU do aparelho aguentam.
interface OrcamentoAlpino {
  arvores: number
  perto: number
  subbosque: number
  /** a mata entra no mapa de sombra? */
  sombra: boolean
}
/** ⚠️ SEM PERFIL, O ORÇAMENTO CHEIO: quem chama `buildAlpino` sem `profile`
 *  (teste, script de medição) recebe exatamente o que este arquivo fazia antes
 *  desta função existir. Nada muda em silêncio para quem não passa o campo. */
function orcamentoDe(p?: PerfProfile): OrcamentoAlpino {
  // ⚠️ `high` GANHA DO TIER, e isso segue `profileFor` em `perf.ts` (lido como
  // referência, não editado aqui): lá o modo cinematográfico devolve DPR 3,
  // sombra suave e mapa de 2.048 mesmo num aparelho `mobile`, porque `?q=high`
  // é escolha explícita de quem está olhando. Baixar o teto da mata aí seria a
  // única peça da cena a desobedecer o pedido.
  const alto = !!p && p.quality === 'high'
  const f = !p || alto ? 1 : p.quality === 'low' ? 0.385 : p.tier === 'mobile' ? 0.654 : 1
  return {
    arvores: Math.round(TETO_ARVORES * f),
    perto: Math.round(TETO_PERTO * f),
    subbosque: Math.round(TETO_SUBBOSQUE * f),
    // ⚠️ SOMBRA DA MATA SÓ NO DESKTOP FORA DO MODO LOW (e em `?q=high`), e o
    // motivo é a caixa do sol: `plaza-scene.tsx` usa uma ortográfica de
    // meia-largura 1.000 a 4.600 m centrada no alvo da câmera, com um texel de
    // até 4,5 m no mapa de 2.048 (e o dobro disso nos 1.024 do celular). Sombra
    // de conífera de 3,2 m de raio num texel de 4,5 m não é sombra, é ruído.
    // ⚠️ SEM PERFIL, LIBERADO: quem chama sem `profile` (teste, script de
    // medição) fica com o `o.sombra` dele valendo, que é o contrato que este
    // arquivo tinha antes de `orcamentoDe` existir. O tier só TIRA sombra,
    // nunca dá.
    sombra: !p || alto || (p.tier === 'desktop' && p.quality !== 'low'),
  }
}

// ── ruído determinístico: a montanha é a mesma em toda visita ───────────────
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function hash2(ix: number, iz: number, semente: number): number {
  return hash01((ix * 73856093) ^ (iz * 19349663) ^ (semente * 83492791))
}

/** valor-ruído bilinear em coordenada de mundo, saída em 0..1 */
function ruido(x: number, z: number, celula: number, semente: number): number {
  const fx = x / celula, fz = z / celula
  const ix = Math.floor(fx), iz = Math.floor(fz)
  const tx = fx - ix, tz = fz - iz
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz)
  const a = hash2(ix, iz, semente), b = hash2(ix + 1, iz, semente)
  const c = hash2(ix, iz + 1, semente), d = hash2(ix + 1, iz + 1, semente)
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz
}

function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

// ── cores ───────────────────────────────────────────────────────────────────
/** ⚠️ A NEVE NÃO É BRANCA #FFFFFF. Branco puro contra o regolito #9A948B estoura
 *  e some no céu; a neve real na sombra da manhã lê azulada. #E8ECF2 é o que
 *  sobra de branco depois que a luz da cena já é quente. Esta é a cor do PÓ
 *  FRESCO, fora de pista: a mais clara das três, porque é ela quem carrega o
 *  branco que o achado 03/09 mediu sendo cortado pela metade pela textura de
 *  concreto emprestada (ver cabeçalho). Sem mapa de albedo agora, ESTA cor
 *  chega inteira ao olho. */
const COR_NEVE_PO = new THREE.Color('#E8ECF2')
/** neve de PISTA, onde a máquina de compactação passa (ou, sem `?inverno=1`,
 *  onde a rampa é mansa o bastante pra parecer pisoteada): mais cinza e mais
 *  densa que o pó, porque compactação esmaga o cristal solto que dá o branco
 *  frio da neve fresca. Mais escura de propósito, não mais suja: a sujeira é
 *  a terceira cor, só na borda. */
const COR_NEVE_COMPACTADA = new THREE.Color('#C7CCD6')
/** ⚠️ A BORDA DE DERRETIMENTO NÃO É A ROCHA, É A MISTURA. Puxar até
 *  `TINTA_REGOLITO` (o mesmo `#9A948B` que `terrain.ts` usa pra tingir o
 *  regolito exposto) em vez de inventar um marrom novo: onde a neve rareia
 *  perto da pedra, a MESMA pedra que já está exposta ali do lado deveria
 *  aparecer misturada, não uma cor de "sujeira" sem relação com o que a
 *  câmera vê a um metro dali. */
const COR_NEVE_SUJA = new THREE.Color('#9A948B')
/** agulha de conífera: mais escura e mais fria que a copa da cidade (#7E8A6B),
 *  porque é isso que separa a mata do morro da arborização de rua na mesma vista */
const COR_AGULHA = new THREE.Color('#3E5140')
const COR_FUSTE = new THREE.Color('#4A423A')
/** folhagem baixa do sub-bosque: mais quente e mais clara que a agulha, porque
 *  arbusto pega mais sol que copa e é isso que separa os dois planos */
const COR_MOITA = new THREE.Color('#4E5B3C')
/** matacão solto: a MESMA pedra exposta que `terrain.ts` mistura no talude
 *  (`ROCHA_PICO = #6E6A63`), não um cinza novo sem relação com o chão */
const COR_MATACAO = new THREE.Color('#6E6A63')

// ── pó fresco vs pista compactada ────────────────────────────────────────────
// ⚠️ MESMA LÓGICA DE VARIAÇÃO DE MUNDO QUE `materiais.ts` USA NO ASFALTO
// (lida como referência, não editada aqui): o sinal que decide a mistura vem
// de COORDENADA DE MUNDO (posição real da pista, ou inclinação real do
// terreno), nunca de UV/ladrilho, senão a "pista" ficaria repetindo a cada
// tile e denunciaria a conta como um xadrez.
//
// ⚠️ PISTA DE VERDADE QUANDO EXISTE: com `?inverno=1`, `PISTAS` (de
// `inverno.ts`) tem a geometria REAL das pistas esculpidas; a "compactação"
// aqui é 1 no eixo de cada uma, decaindo a 0 em `largura/2 + FAIXA_PISOTEIO`
// metros pra fora, a mesma forma de `pistaProximidade01` de `inverno.ts`
// (não exportada; a distância ponto-segmento é reimplementada aqui, pequena
// e sem estado, não vale a pena mudar o contrato de `inverno.ts` por ela).
// SEM a bandeira (ou fora de alcance de qualquer pista), cai no substituto
// pedido: inclinação. Rampa mansa é onde máquina e esquiador pisam mais.
const FAIXA_PISOTEIO = 12
/** cópia local e pequena de `pontoEmRumo` de `inverno.ts` (não exportada):
 *  mesma convenção documentada lá (azimute 0 = -Z, sentido horário). */
function pontoEmRumoNeve(r: number, azGraus: number): [number, number] {
  const a = (azGraus * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}
function compactacaoEm(x: number, z: number, inc: number, zona: number): number {
  if (zona > 0.01 && PISTAS.length > 0) {
    let melhorDist = Infinity
    let melhorMeia = 0
    for (const p of PISTAS) {
      const meia = p.largura / 2
      const pts = p.pontos
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az_] = pontoEmRumoNeve(pts[i].r, pts[i].az)
        const [bx, bz] = pontoEmRumoNeve(pts[i + 1].r, pts[i + 1].az)
        const dx = bx - ax, dz = bz - az_
        const lenSq = dx * dx + dz * dz || 1
        let t = ((x - ax) * dx + (z - az_) * dz) / lenSq
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const px = ax + dx * t, pz = az_ + dz * t
        const d = Math.hypot(x - px, z - pz)
        if (d < melhorDist) { melhorDist = d; melhorMeia = meia }
      }
    }
    const alcance = melhorMeia + FAIXA_PISOTEIO
    if (melhorDist < alcance) return suave01(1 - melhorDist / alcance)
  }
  // sem pista real por perto: rampa mansa (< 8°) lê como pisoteada, íngreme
  // (> 28°) lê como pó intocado
  return 1 - suave01((inc - 8) / 20)
}

// ── a textura do brilho ─────────────────────────────────────────────────────
// ⚠️ NÃO É ALBEDO, É SÓ RELEVO FINO. Pesquisado antes de escrever (WebSearch:
// "snow shader real-time", "PBR snow material", "subsurface scattering
// snow"): o item caro de verdade em neve renderizada é o subsurface
// scattering (a luz entra no cristal, espalha, sai por outro ponto): isso é
// coisa de render offline, fora do orçamento desta cena. O item BARATO que
// sobra, e que esta busca confirma como a técnica padrão em tempo real, é um
// normal map de alta frequência: com a rugosidade baixa e o normal
// perturbado pixel a pixel, o especular do próprio `MeshStandardMaterial`
// (GGX, já pago em qualquer material físico da cena) já produz o brilho
// pontual que muda de posição a cada passo de câmera, que é a assinatura do
// "sparkle" de cristal. Nenhum termo novo de shader, nenhum
// `onBeforeCompile`: zero programas novos, só um mapa a mais no material
// padrão.
//
// ⚠️ TAMANHO: 256×256, RGBA8, um canal só de conteúdo (o normal; alfa fica
// 255 fixo). 256×256×4 bytes = 262.144 bytes cru; com a cadeia de mipmap
// (que o three gera sozinho pra `RepeatWrapping`) o custo real de GPU fica
// perto de 1,33× isso, **≈ 0,35 MB**. Comparado ao que SAIU (os três mapas de
// 512×512 de `superficie('concreto')` que este material usava antes:
// albedo+normal+roughness, ~3 MB, mas COMPARTILHADOS com `autopistas.ts`,
// `metro.ts` e `tecido.ts`, a economia de memória não é real: ninguém mais
// vai deixar de pagar por eles), o número que importa é BINDINGS deste
// material: 3 texturas antes (map+normalMap+roughnessMap), 1 agora.
const SPARKLE_PX = 256
/** dois oitavas de valor-ruído em coordenada de TEXTURA (pixel), não de
 *  mundo: isto é o grão do cristal, tem escala de ladrilho mesmo, repete a
 *  cada `TILE_SPARKLE` metros de propósito (ruído puro não tem feição que o
 *  olho reconheça, então repetir não denuncia nada, a mesma regra que
 *  `materiais.ts` usa pro grão do regolito). */
function gerarNormalNeve(): THREE.CanvasTexture {
  const t0 = performance.now()
  const cv = document.createElement('canvas')
  cv.width = SPARKLE_PX; cv.height = SPARKLE_PX
  const ctx = cv.getContext('2d')!
  const alt = new Float32Array(SPARKLE_PX * SPARKLE_PX)
  for (let v = 0; v < SPARKLE_PX; v++) {
    for (let u = 0; u < SPARKLE_PX; u++) {
      const n1 = ruido(u, v, 5, 501)
      const n2 = ruido(u, v, 1.7, 502)
      alt[v * SPARKLE_PX + u] = n1 * 0.65 + n2 * 0.35
    }
  }
  const at = (u: number, v: number) =>
    alt[((v + SPARKLE_PX) % SPARKLE_PX) * SPARKLE_PX + ((u + SPARKLE_PX) % SPARKLE_PX)]
  const dados = ctx.createImageData(SPARKLE_PX, SPARKLE_PX)
  const FORCA = 6 // alto de propósito: isto é o cristal, não o relevo do terreno
  for (let v = 0; v < SPARKLE_PX; v++) {
    for (let u = 0; u < SPARKLE_PX; u++) {
      const l = at(u - 1, v), r = at(u + 1, v), d0 = at(u, v - 1), d1 = at(u, v + 1)
      let nx = -(r - l) * FORCA, nz = -(d1 - d0) * FORCA, ny = 1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len; ny /= len; nz /= len
      const k = (v * SPARKLE_PX + u) * 4
      dados.data[k] = (nx * 0.5 + 0.5) * 255
      dados.data[k + 1] = (ny * 0.5 + 0.5) * 255
      dados.data[k + 2] = (nz * 0.5 + 0.5) * 255
      dados.data[k + 3] = 255
    }
  }
  ctx.putImageData(dados, 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  console.log(`[alpino] normal map da neve gerado em ${(performance.now() - t0).toFixed(1)} ms (${SPARKLE_PX}×${SPARKLE_PX})`)
  return tex
}
/** tamanho do ladrilho do brilho, em metros de mundo: pequeno de propósito
 *  (o cristal é um detalhe fino, não uma macro-variação como a do regolito) */
const TILE_SPARKLE = 6

/**
 * A coroa de neve e a mata do maciço oeste.
 *
 * Síncrona: não carrega arquivo nenhum. A cor da neve sai só de vértice; a
 * única textura é o normal map de brilho, gerado aqui mesmo por canvas.
 */
export function buildAlpino(o: AlpinoOpts): Alpino {
  const group = new THREE.Group()
  group.name = 'alpino'
  // ⚠️ O PERFIL É LIDO AQUI E EM MAIS NENHUM LUGAR, de propósito: um objeto só
  // com os quatro números que este módulo escala, resolvido uma vez. Ver
  // `orcamentoDe` e a tabela de densidade por tier lá em cima.
  const orc = orcamentoDe(o.profile)

  // ── 1. a grade de altura, amostrada UMA VEZ dentro do anel ────────────────
  const N = Math.ceil((2 * R_EXT) / PASSO) + 1
  const h = new Float32Array(N * N)
  const valido = new Uint8Array(N * N)
  const xDe = (i: number) => -R_EXT + i * PASSO
  const idx = (i: number, j: number) => j * N + i
  // margem de um passo pra fora do anel útil: a inclinação usa diferença central
  const rMin = R_INT - PASSO * 2
  const rMax = R_EXT + PASSO * 2
  for (let j = 0; j < N; j++) {
    const z = xDe(j)
    for (let i = 0; i < N; i++) {
      const x = xDe(i)
      const r = Math.hypot(x, z)
      if (r < rMin || r > rMax) continue
      const k = idx(i, j)
      h[k] = o.heightAt(x, z)
      valido[k] = 1
    }
  }

  /** altura por bilinear na grade; devolve NaN se a célula não foi amostrada */
  const alturaEm = (x: number, z: number): number => {
    const fx = (x + R_EXT) / PASSO, fz = (z + R_EXT) / PASSO
    const i = Math.floor(fx), j = Math.floor(fz)
    if (i < 0 || j < 0 || i + 1 >= N || j + 1 >= N) return NaN
    const k00 = idx(i, j), k10 = idx(i + 1, j), k01 = idx(i, j + 1), k11 = idx(i + 1, j + 1)
    if (!valido[k00] || !valido[k10] || !valido[k01] || !valido[k11]) return NaN
    const tx = fx - i, tz = fz - j
    return (h[k00] * (1 - tx) + h[k10] * tx) * (1 - tz) + (h[k01] * (1 - tx) + h[k11] * tx) * tz
  }

  /** inclinação em graus por diferença central na grade */
  const inclinacaoEm = (i: number, j: number): number => {
    if (i <= 0 || j <= 0 || i + 1 >= N || j + 1 >= N) return 90
    const kxp = idx(i + 1, j), kxm = idx(i - 1, j), kzp = idx(i, j + 1), kzm = idx(i, j - 1)
    if (!valido[kxp] || !valido[kxm] || !valido[kzp] || !valido[kzm]) return 90
    const dx = (h[kxp] - h[kxm]) / (2 * PASSO)
    const dz = (h[kzp] - h[kzm]) / (2 * PASSO)
    return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI
  }

  /** cobertura de neve em 0..1: cota + faixa + inclinação + ruído */
  const neveEm = (x: number, z: number, alt: number, inc: number): number => {
    // ⚠️ COTA MISTURADA PELA ZONA DO PARQUE. Sem `?inverno=1`,
    // `zonaEsquiavelAt` é 0 em qualquer (x, z) e `cotaBase` é `COTA_NEVE` puro:
    // bit a bit a conta de sempre.
    const zona = INVERNO_ATIVO ? zonaEsquiavelAt(x, z) : 0
    const cotaBase = COTA_NEVE - (COTA_NEVE - COTA_NEVE_INVERNO) * zona
    const limiar = cotaBase + (ruido(x, z, CELULA_RUIDO, 11) * 2 - 1) * RUIDO_NEVE
    const t = suave01((alt - (limiar - FAIXA_NEVE)) / (2 * FAIXA_NEVE))
    if (t <= 0) return 0
    // neve não gruda em face muito íngreme: cheia até 30°, zero em 55°
    const s = 1 - suave01((inc - 30) / 25)
    // manchado fino, senão a coroa vira um esmalte uniforme
    const m = 0.82 + 0.18 * ruido(x, z, 70, 29)
    return Math.min(0.96, t * s * m)
  }

  // ── 2. a coroa: uma casca de quads sobre o terreno, alfa = cobertura ──────
  // ⚠️ MALHA PRÓPRIA E NÃO COR POR VÉRTICE DO TERRENO: o regolito é de
  // `terrain.ts`, que não é meu arquivo, e repintar vértice de lá seria mexer no
  // modelo de terreno de outro módulo. A casca sobe e vai com `polygonOffset`,
  // que é o par de cintos que a cena já usa em chão sobre chão.
  //
  // ⚠️ O LEVANTE VOLTOU A SER SÓ A FOLGA DE Z-FIGHT, 0,4 m. Até 03/09 ele
  // carregava DOIS papéis: a folga de profundidade (que é o que o
  // `polygonOffset` e estes 0,4 m resolvem) e a compensação do erro de corda,
  // que virou `LEVANTE_INVERNO = 9` dentro da zona do parque. Nove metros
  // constantes é errado nas DUAS pontas, e agora a distribuição está medida no
  // terreno real (11.269 células de neve, déficit de corda por célula):
  //
  //     0 a  2 m   76,7% das células      p50 do déficit = 0,47 m
  //     2 a  5 m   13,6%                  p90            = 4,87 m
  //     5 a 10 m    7,0%                  p99            = 13,76 m
  //    10 a 25 m    2,7%                  máximo         = 30,91 m
  //    25 a 60 m    0,1%
  //
  // Ou seja: 9 m constantes levantavam à toa três quartos da coroa (que
  // precisava de menos de 2) e ainda enterravam os 2,8% que precisavam de mais
  // de 10. Um número só não serve para uma distribuição assim. O erro de corda
  // agora é MEDIDO célula a célula na seção 2b, e ele some sozinho quando a
  // montanha suavizar, que é o que a frente da montanha está fazendo agora.
  const LEVANTE_BASE = 0.4
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const cor: number[] = []
  const cobertura = new Float32Array(N * N)
  // ⚠️ "compactação" (0 pó fresco .. 1 pista), amostrada JUNTO com a
  // cobertura, no mesmo laço, pra não abrir uma segunda varredura da grade
  // inteira só pra isto. Ver `compactacaoEm` acima.
  const compact = new Float32Array(N * N)

  // ⚠️ ACHADO 03/09, medido offline antes de mexer: o pre-corte abaixo usava
  // `COTA_NEVE` (250) sozinho como piso, e isso e um limiar DIFERENTE do que
  // `neveEm` de fato usa quando a zona do parque baixa a cota para
  // `COTA_NEVE_INVERNO` (70). Resultado medido: qualquer ponto com altura
  // entre 39 e 219 m DENTRO da zona (cotaBase baixo, ainda deveria nevar)
  // nunca chegava a `neveEm`, porque o pre-corte já tinha descartado a
  // célula. Isso reduzia a área nevada, mas sozinho NAO explica zero neve
  // (a varredura offline com o mesmo bug ainda deu 13,258 km² > 0): é bug
  // real, corrigido aqui, mas não é a causa de "nem um pixel branco" sozinho.
  // O piso do pre-corte agora usa o MENOR limiar possível (o da zona do
  // parque, quando `?inverno=1` está ligado); é só uma otimização de
  // descarte, `neveEm` continua sendo quem decide de verdade.
  const pisoPreCorte = INVERNO_ATIVO
    ? Math.min(COTA_NEVE, COTA_NEVE_INVERNO) - FAIXA_NEVE - RUIDO_NEVE
    : COTA_NEVE - FAIXA_NEVE - RUIDO_NEVE
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j)
      if (!valido[k] || h[k] < pisoPreCorte) continue
      const x = xDe(i), z = xDe(j)
      if (Math.hypot(x, z) > R_EXT) continue
      const inc = inclinacaoEm(i, j)
      cobertura[k] = neveEm(x, z, h[k], inc)
      if (cobertura[k] > 0) {
        const zona = INVERNO_ATIVO ? zonaEsquiavelAt(x, z) : 0
        compact[k] = compactacaoEm(x, z, inc, zona)
      }
    }
  }

  // ── 2b. A FOLGA ADAPTATIVA: o erro de corda MEDIDO, não um levante chutado ─
  //
  // ⚠️ ESTA É A CORREÇÃO DO ACHADO 04/09 (ver o cabeçalho). O quad de 40 m é
  // uma RETA entre quatro amostras; o terreno por baixo não é. Para cada célula
  // que vira quad, o terreno é reamostrado a 20 m (`SUB_CORDA`) e o DÉFICIT é
  // o quanto o terreno passa por cima do plano do triângulo naquele ponto.
  //
  // ⚠️ POR QUE ISTO É PROVADAMENTE SUFICIENTE, e não um empurrão a esmo:
  // levantar os TRÊS vértices de um triângulo pelo mesmo `d` levanta o plano
  // inteiro por `d` (o plano é afim). Então dar a cada NÓ o maior déficit
  // entre as células que o tocam garante, em toda célula, que o plano subiu
  // pelo menos o déficit dela. É a menor folga que resolve, e ela é ZERO em
  // terreno plano: quando a frente da montanha alargar os carimbos e o talude
  // cair de 55° para 30°, esta conta encolhe sozinha. Não há número calibrado
  // para a montanha de hoje neste bloco.
  //
  // ⚠️ E A DIAGONAL DO QUAD TAMBÉM É ESCOLHIDA, não fixa, o que é de graça:
  // partir o quad pela diagonal que passa mais ALTO segue a crista em vez de
  // cortá-la, então o triângulo precisa de MENOS folga para cobrir o mesmo
  // terreno. Medido na mesma carga, contra a diagonal fixa de sempre e sem
  // gastar uma amostra a mais, a casca ENCOSTA MAIS NA ROCHA:
  //     flutuação   p50 5,41 → 4,41 m   p90 20,89 → 16,89   p99 40,23 → 33,13
  // com o furo praticamente igual (2,4% contra 2,8%, ambos irrelevantes ao
  // lado dos 26,1% de onde se partiu). Menos flutuação é neve pousada em vez
  // de neve pairando, que é o defeito que sobra depois do enterro.
  // ⚠️ DUAS ECONOMIAS MEDIDAS, e as duas mudam o custo de verdade:
  //  1. o canto da célula fina JÁ ESTÁ em `h` (é nó da grade grossa): pedi-lo
  //     de novo a `heightAt` custava 46.568 chamadas em vez de 34.666, ou seja
  //     11.902 a mais, 25,6% desta seção. Sai da grade;
  //  2. o meio de aresta é canto de DUAS células e o resto é interno: sem
  //     cache o mesmo ponto seria amostrado duas vezes. Com cache o custo fica
  //     em 3,08 chamadas novas por célula (medido: 34.666 chamadas para 11.269
  //     células de neve), que é o mínimo possível para um retículo de 20 m.
  // ⚠️ E O CENTRO SOZINHO NÃO SERVE, testado antes de escolher: das células
  // com déficit acima de 0,5 m, a amostra do centro captura a MEDIANA de 0%
  // do déficit e perde mais de 2 m em 45,2% delas. O pico do erro de corda
  // quase nunca cai no centro do quad, cai na aresta.
  //
  // ⚠️ E TAMPOUCO DÁ PRA JOGAR O CENTRO FORA, medido na obra 2 justamente
  // porque ele é a única das três chamadas novas por célula que NÃO é
  // compartilhada com a vizinha (as duas de aresta são), ou seja seria um
  // terço desta fase de graça. Rodando as duas contas na mesma amostragem, com
  // o terreno real: o déficit por célula quase não muda na distribuição (p50
  // 0,23 → 0,23 m, p90 1,65 → 1,62, p99 9,60 → 9,36, máximo 30,91 nos dois),
  // MAS a pior célula perde 11,96 m de folga. Onze metros e noventa e seis é
  // exatamente o tipo de célula que este bloco inteiro existe pra salvar. O
  // centro fica.
  const NSUB = (N - 1) * SUB_CORDA + 1
  const caixaFina = new Map<number, number>()
  const finoEm = (fi: number, fj: number): number => {
    if (fi % SUB_CORDA === 0 && fj % SUB_CORDA === 0) {
      const k = idx(fi / SUB_CORDA, fj / SUB_CORDA)
      if (valido[k]) return h[k]
    }
    const chave = fj * NSUB + fi
    const v = caixaFina.get(chave)
    if (v !== undefined) return v
    const y = o.heightAt(-R_EXT + (fi * PASSO) / SUB_CORDA, -R_EXT + (fj * PASSO) / SUB_CORDA)
    caixaFina.set(chave, y)
    return y
  }
  /** a célula (i, j) vira quad? guardado no índice do nó de baixo-esquerda */
  const emite = new Uint8Array(N * N)
  /** 1 = partir pela diagonal (i+1,j)-(i,j+1) em vez da (i,j)-(i+1,j+1) */
  const diagB = new Uint8Array(N * N)
  const folga = new Float32Array(N * N)
  for (let j = 1; j < N - 2; j++) {
    for (let i = 1; i < N - 2; i++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1)
      if (!valido[a] || !valido[b] || !valido[c] || !valido[d]) continue
      if (cobertura[a] + cobertura[b] + cobertura[c] + cobertura[d] <= 0.004) continue
      emite[a] = 1
      const h00 = h[a], h10 = h[b], h01 = h[c], h11 = h[d]
      const usaB = h10 + h01 > h00 + h11
      if (usaB) diagB[a] = 1
      let def = 0
      for (let sb = 0; sb <= SUB_CORDA; sb++) {
        for (let sa = 0; sa <= SUB_CORDA; sa++) {
          const u = sa / SUB_CORDA, v = sb / SUB_CORDA
          const t = finoEm(i * SUB_CORDA + sa, j * SUB_CORDA + sb)
          const y = usaB
            ? (u + v <= 1
              ? h00 + (h10 - h00) * u + (h01 - h00) * v
              : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v))
            : (v <= u
              ? h00 + (h10 - h00) * u + (h11 - h10) * v
              : h00 + (h11 - h01) * u + (h01 - h00) * v)
          if (t - y > def) def = t - y
        }
      }
      if (def <= 0) continue
      const ff = Math.min(TETO_FOLGA, def * FATOR_FOLGA)
      if (ff > folga[a]) folga[a] = ff
      if (ff > folga[b]) folga[b] = ff
      if (ff > folga[c]) folga[c] = ff
      if (ff > folga[d]) folga[d] = ff
    }
  }
  caixaFina.clear()

  let quads = 0
  const nv = new THREE.Vector3()
  const corPonto = new THREE.Color()
  // ⚠️ MALHA INDEXADA, e a economia é medida: cada nó da grade é canto de até
  // quatro quads, e a versão não indexada empurrava o MESMO vértice até seis
  // vezes (dois triângulos por quad, três vértices cada). Todos os atributos
  // aqui são função de (i, j) e de mais nada, então indexar é idêntico pixel a
  // pixel. Medido no terreno real, mesma carga: 67.614 vértices e 3,10 MB viram
  // 12.111 vértices e 0,68 MB, com a MESMA contagem de triângulos (22.538).
  const indiceDe = new Int32Array(N * N).fill(-1)
  const ind: number[] = []
  let nVert = 0
  const vert = (i: number, j: number): number => {
    const k = idx(i, j)
    if (indiceDe[k] >= 0) return indiceDe[k]
    const x = xDe(i), z = xDe(j)
    pos.push(x, h[k] + LEVANTE_BASE + folga[k], z)
    // ⚠️ NORMAL DA GRADE DO TERRENO, SEM A FOLGA DE PROPÓSITO. A folga é uma
    // correção de casco local (o máximo entre as células vizinhas), não
    // relevo: somá-la aqui faria o sombreado seguir o degrau da correção em
    // vez de seguir o morro, e a coroa ficaria manchada de facetas onde o
    // terreno é liso. A casca acompanha o morro sem facetar.
    const dx = (h[idx(i + 1, j)] - h[idx(i - 1, j)]) / (2 * PASSO)
    const dz = (h[idx(i, j + 1)] - h[idx(i, j - 1)]) / (2 * PASSO)
    nv.set(-dx, 1, -dz).normalize()
    nor.push(nv.x, nv.y, nv.z)
    // ⚠️ UV EM METROS DE MUNDO, ladrilho do BRILHO (`TILE_SPARKLE`), não mais
    // do concreto: sem mapa de albedo, o UV só serve pro normal map fino.
    uv.push(x / TILE_SPARKLE, z / TILE_SPARKLE)
    // ⚠️ A COR NÃO É MAIS CONSTANTE. Pó → compactada por `compact[k]`, e as
    // duas puxam pra `COR_NEVE_SUJA` conforme a cobertura cai perto da borda
    // (`cobertura` já carrega a mistura de cota + inclinação + ruído, então
    // reusar ela aqui é reusar o MESMO sinal que já decide "quão dentro da
    // neve" este ponto está, não inventar uma segunda métrica de borda).
    corPonto.copy(COR_NEVE_PO).lerp(COR_NEVE_COMPACTADA, compact[k])
    const borda = Math.min(1, cobertura[k] / 0.7)
    corPonto.lerp(COR_NEVE_SUJA, 1 - borda)
    cor.push(corPonto.r, corPonto.g, corPonto.b, cobertura[k])
    indiceDe[k] = nVert
    return nVert++
  }
  for (let j = 1; j < N - 2; j++) {
    for (let i = 1; i < N - 2; i++) {
      const k = idx(i, j)
      if (!emite[k]) continue
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1)
      // as duas partições preservam o mesmo sentido de giro (a face é única,
      // o material não é `DoubleSide`)
      if (diagB[k]) ind.push(a, b, d, b, c, d)
      else ind.push(a, b, c, a, c, d)
      quads++
    }
  }

  let neve: THREE.Mesh | null = null
  // ⚠️ SEM `map` NENHUM DE PROPÓSITO. Ver o achado 03/09 no cabeçalho: o
  // defeito da chapa sem neve era exatamente aqui, um `map` emprestado
  // cortando pela metade o branco que a cor por vértice já entrega. `color`
  // fica branco (neutro, não multiplica nada) e quem pinta é só a cor por
  // vértice (`corPonto` acima) vezes a luz da cena, inclusive a luz azulada
  // do céu (`HemisphereLight` já existe em `plaza-scene.tsx`, cor
  // `0x3a4664`, e o `earthshine` em `0x8fb0ff`): a sombra azulada da neve
  // pedida na Tarefa 3 não precisa de código novo aqui, é o PBR padrão do
  // `MeshStandardMaterial` recebendo a luz que a cena já tem, iluminando um
  // material quase branco. `roughness = 0.55` é escolha de olho (não
  // medida): neve real varia de ~0,9 (pó) a ~0,3 (pista prensada) e não dá
  // pra variar por vértice sem shader novo, então fica no meio da faixa.
  const matNeve = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.55,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const texNeve = gerarNormalNeve()
  matNeve.normalMap = texNeve
  // ⚠️ FORÇA MODERADA, DE OLHO: alta o bastante pra dar o brilho pontual que
  // muda de posição com a câmera (o "sparkle"), baixa o bastante pra não
  // virar plástico granulado uniforme quando a luz bate de frente. NÃO MEDI
  // a distância exata onde o mipmap do three apaga este detalhe (dependeria
  // de FOV e resolução de tela, que não tenho aqui); o que sei, porque é
  // física de mipmap e não suposição, é que ele decai sozinho conforme o
  // ladrilho de `TILE_SPARKLE` (6 m) encolhe abaixo de um pixel de tela, sem
  // nenhum código de distância meu.
  matNeve.normalScale = new THREE.Vector2(0.9, 0.9)
  if (quads > 0) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    // itemSize 4: o three liga USE_COLOR_ALPHA e o alfa por vértice vale
    g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 4))
    g.setIndex(ind)
    g.computeBoundingSphere()
    neve = new THREE.Mesh(g, matNeve)
    neve.name = 'alpino:neve'
    neve.castShadow = false
    neve.receiveShadow = false
    neve.renderOrder = 1
    group.add(neve)
  }

  // ── 3. a mata: candidatos em grade jitterada, filtrados pela faixa ────────
  // ⚠️ ARMAZENADA EM `Float32Array`, NÃO EM ARRAY DE OBJETO. Seis campos por
  // árvore (x, z, y, esc, escXZ, giro): como objeto o V8 gasta cerca de 72 B
  // por muda (cabeçalho mais seis slots de double mais o ponteiro do array),
  // como float são 24 B. Em 52 mil árvores isso é 1,25 MB contra 3,6 MB, e o
  // laço do LOD percorre memória contígua em vez de perseguir ponteiro.
  const bruto: number[] = []
  const passos = Math.floor((2 * R_EXT) / PASSO_MATA)
  for (let j = 0; j <= passos; j++) {
    for (let i = 0; i <= passos; i++) {
      const jx = (hash2(i, j, 3) - 0.5) * PASSO_MATA * 0.9
      const jz = (hash2(i, j, 7) - 0.5) * PASSO_MATA * 0.9
      const x = -R_EXT + i * PASSO_MATA + jx
      const z = -R_EXT + j * PASSO_MATA + jz
      const r = Math.hypot(x, z)
      if (r < R_INT || r > R_EXT - 30) continue
      const alt = alturaEm(x, z)
      if (!Number.isFinite(alt)) continue
      // ⚠️ 03/09: DENTRO DA ZONA DO PARQUE, QUEM PLANTA É `inverno.ts`. Ele
      // tem árvore de verdade (`tree-pine.glb`, `sequoia-mass.glb`, publicadas
      // pela frente de espécies especificamente pra isto) numa faixa própria
      // (15-190 m); manter a conífera de 34 triângulos daqui por cima
      // dobraria a densidade com duas espécies que não combinam. A faixa
      // MATA_BAIXO_INVERNO/MATA_ALTO_INVERNO que existia aqui virou código
      // morto por esse motivo e foi retirada: fora da zona nada mudou.
      const zonaMata = INVERNO_ATIVO ? zonaEsquiavelAt(x, z) : 0
      if (zonaMata > 0.04) continue
      // pluma nas duas pontas da faixa: a mata não começa nem acaba numa reta
      const dens = suave01((alt - (MATA_BAIXO - PLUMA_MATA)) / (2 * PLUMA_MATA))
        * (1 - suave01((alt - (MATA_ALTO - PLUMA_MATA)) / (2 * PLUMA_MATA)))
      if (dens <= 0.02) continue
      // ⚠️ MANCHA COM LIMIAR, NÃO COM PISO. A versão antiga
      // (`0,35 + 0,9 × ruído`) nunca zerava: aceitava em toda parte, pouco, e
      // o resultado é pontinho espalhado por 1.880 hectares. Aqui o ruído de
      // célula 210 m passa por um limiar: abaixo de 0,44 é clareira de
      // verdade (nenhuma árvore) e acima de 0,62 é talhão cheio. A mesma
      // árvore concentrada em menos terra é o que lê como mata a 4 km.
      const mancha = suave01((ruido(x, z, 210, 41) - 0.44) / 0.18)
      if (mancha <= 0.01) continue
      if (hash2(i, j, 13) > dens * mancha) continue
      // face muito íngreme não segura mata alta
      const ii = Math.round((x + R_EXT) / PASSO), jj = Math.round((z + R_EXT) / PASSO)
      if (inclinacaoEm(ii, jj) > 42) continue
      if (o.molhado?.(x, z)) continue
      if (o.naVia?.(x, z, 2.5)) continue
      // ⚠️ A MOITA: o ponto aceito vira de 1 a `MOITA_MAX` troncos. O primeiro
      // fica no ponto medido (que já passou por água, via e inclinação); os
      // outros saem num disco de `RAIO_MOITA`, com raio por `sqrt` para o
      // sorteio ficar uniforme na ÁREA e não amontoar tudo no centro. Eles
      // herdam as máscaras do ponto-mãe de propósito: 6 m é menos que a folga
      // de qualquer uma delas e reconferir custaria uma consulta a `naVia` por
      // tronco, que é justamente o item caro.
      // ⚠️ FAIXAS DE SEMENTE DISJUNTAS (101, 151, 201, 251, 301 mais 7 por
      // tronco): com as faixas encavaladas que a primeira versão tinha, dois
      // sorteios diferentes caíam na MESMA semente e a árvore saía com escala
      // vertical igual à horizontal, ou com o giro amarrado ao porte.
      const quantos = 1 + Math.floor(hash2(i, j, 43) * MOITA_MAX)
      for (let q = 0; q < quantos; q++) {
        let px = x, pz = z
        if (q > 0) {
          const ang = hash2(i, j, 101 + q * 7) * Math.PI * 2
          const d = RAIO_MOITA * Math.sqrt(hash2(i, j, 151 + q * 7))
          px = x + Math.cos(ang) * d
          pz = z + Math.sin(ang) * d
        }
        const ay = q === 0 ? alt : alturaEm(px, pz)
        if (!Number.isFinite(ay)) continue
        bruto.push(
          px, pz, ay,
          0.75 + hash2(i, j, 201 + q * 7) * 0.85,
          0.85 + hash2(i, j, 251 + q * 7) * 0.4,
          hash2(i, j, 301 + q * 7) * Math.PI * 2,
        )
      }
    }
  }

  // desbaste determinístico se passar do teto
  const CAMPOS = 6
  const brutas = bruto.length / CAMPOS
  const manter = brutas > orc.arvores ? orc.arvores / brutas : 1
  let nArv = 0
  const mata = new Float32Array(Math.min(brutas, orc.arvores) * CAMPOS)
  for (let k = 0; k < brutas; k++) {
    if (manter < 1 && hash01(k * 2654435761) >= manter) continue
    if (nArv * CAMPOS + CAMPOS > mata.length) break
    for (let c = 0; c < CAMPOS; c++) mata[nArv * CAMPOS + c] = bruto[k * CAMPOS + c]
    nArv++
  }
  bruto.length = 0

  // ── 4. três geometrias, um material só ───────────────────────────────────
  const pinta = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  }
  // conífera de perto: fuste de 5 lados + duas saias de cone de 7 lados. 34 tris.
  //
  // ⚠️ A COPA ABRIU DE 2,6 PARA 3,2 m DE RAIO (04/09), e a razão é de COBERTURA,
  // não de gosto. A 4 km a árvore mede 2,6 px: nessa escala a mata não se lê por
  // silhueta, se lê pela FRAÇÃO DE CHÃO que a copa cobre. Com raio 2,6 e a escala
  // média das instâncias (1,234), cada copa cobria 25,3 m²; nos 7,4 troncos por
  // hectare de antes isso dava 1,9% de cobertura (3,5% no p90), ou seja chão
  // pelado com pontinhos. Raio 3,2 leva a copa a 49,0 m², e com a densidade nova
  // a cobertura vai a 17,6% na média e 40,7% no p90 do talhão: aí é mata.
  // Conífera de 11,5 m com 3,2 m de raio continua sendo proporção de conífera
  // real, não um guarda-chuva.
  const fuste = new THREE.CylinderGeometry(0.28, 0.42, 3.2, 5, 1, true)
  fuste.translate(0, 1.6, 0)
  const saiaA = new THREE.ConeGeometry(3.2, 6.0, 7, 1, true)
  saiaA.translate(0, 5.6, 0)
  const saiaB = new THREE.ConeGeometry(2.0, 4.4, 7, 1, true)
  saiaB.translate(0, 10.2, 0)
  const gPerto = mergeGeometries([
    pinta(fuste, COR_FUSTE), pinta(saiaA, COR_AGULHA), pinta(saiaB, COR_AGULHA),
  ], false)!
  // ── A CONÍFERA DE LONGE, REDESENHADA (04/09) ──────────────────────────────
  //
  // ⚠️ ERA `ConeGeometry(2.3, 11.5, 4)`: DOZE triângulos, sendo QUATRO na tampa
  // de baixo, que fica enterrada no chão e nunca é vista, e nenhum fuste. O
  // volume de longe desta casa já tem uma resposta boa para isso, em
  // `especies.ts` (`geoLonge`, lido como referência, não editado aqui): um
  // OCTAEDRO alongado com o pé na cor do tronco e a cintura a 62% da altura.
  // Oito triângulos, um contorno de copa em qualquer ângulo e um pé escuro.
  //
  // Aqui a cintura desce para 38% da altura, porque conífera não é copada: ela
  // abre logo acima do chão e afina até a ponta. O pé em `COR_FUSTE` é o que dá
  // o tronco sem gastar um triângulo: o degrau de valor entre o pé escuro e a
  // agulha aparece no gradiente mesmo quando a árvore inteira mede poucos
  // pixels.
  //
  // ⚠️ E A CONTA DE PIXEL DIZ QUE ISTO BASTA. A vista de contrato do maciço
  // está a 4.560 m; com 60° de campo e 1.080 px de altura de tela, um pixel
  // vale 0,00097 rad, então uma conífera de 11,5 m mede 2,6 px de altura ali e
  // 8,5 px no limite de `R_CHEIA` (1.400 m). Nessa escala silhueta fina não
  // existe: o que existe é MASSA e DENSIDADE, que é o que a seção 3 corrigiu.
  // Gastar triângulo em detalhe de longe seria pagar por pixel que não há; o
  // caminho certo é o contrário, e é o que está feito aqui: 8 triângulos em vez
  // de 12 (as quatro da tampa enterrada saíram), 33% mais barato POR ÁRVORE
  // exatamente na hora em que o número de árvores subiu quase quatro vezes.
  const gLonge = (() => {
    const H = 11.5, R = 3.2, yc = H * 0.38   // o mesmo raio da saia de perto
    const vs = [0, 0, 0]
    const cs = [COR_FUSTE.r, COR_FUSTE.g, COR_FUSTE.b]
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      vs.push(Math.cos(a) * R, yc, Math.sin(a) * R)
      cs.push(COR_AGULHA.r, COR_AGULHA.g, COR_AGULHA.b)
    }
    vs.push(0, H, 0)
    cs.push(COR_AGULHA.r, COR_AGULHA.g, COR_AGULHA.b)
    const ix: number[] = []
    for (let k = 0; k < 4; k++) {
      const a = 1 + k, b = 1 + ((k + 1) % 4)
      ix.push(0, b, a)   // a saia, para baixo
      ix.push(a, b, 5)   // a ponta, para cima
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
    g.setIndex(ix)
    g.computeVertexNormals()
    return g
  })()

  // ── O SUB-BOSQUE: moita e matacão, UMA geometria só ───────────────────────
  // ⚠️ UM OCTAEDRO ACHATADO, 8 TRIÂNGULOS, E A PEÇA É A MESMA PARA OS DOIS.
  // Moita e matacão têm a mesma silhueta de bolha baixa nesta escala; o que
  // separa os dois é a COR por instância e o achatamento da matriz. Uma
  // geometria só é uma chamada de desenho só, que é a moeda desta cena.
  // A cor do vértice fica branca de propósito: quem pinta é a cor por
  // instância, escrita no laço do LOD.
  const gSub = (() => {
    const g = new THREE.OctahedronGeometry(1, 0)
    const p = g.attributes.position
    // ⚠️ QUEBRA A SIMETRIA DO DIAMANTE PELO PONTO, NÃO PELO ÍNDICE. A
    // `OctahedronGeometry` do three vem SEM índice: o mesmo canto aparece em
    // quatro triângulos, com quatro índices diferentes. Deslocar por índice
    // (o jeito óbvio) rasgaria o poliedro em oito triângulos soltos. A chave
    // do ruído é a coordenada arredondada, então cantos coincidentes recebem
    // o MESMO deslocamento e a casca continua fechada.
    const chave = (v: number) => Math.round(v * 1000)
    const jj = (x: number, y: number, z: number, s: number) =>
      hash01((chave(x) * 73856093) ^ (chave(y) * 19349663) ^ (chave(z) * 83492791) ^ (s * 2654435761))
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k)
      p.setX(k, x * (0.78 + jj(x, y, z, 977) * 0.5))
      p.setY(k, y * (0.42 + jj(x, y, z, 613) * 0.3))
      p.setZ(k, z * (0.78 + jj(x, y, z, 331) * 0.5))
    }
    // ⚠️ SOBE 0,45 PARA NÃO FICAR METADE ENTERRADO. O octaedro nasce centrado
    // na origem, e a instância é pousada na altura do chão: sem este
    // deslocamento a moita ficaria com 50% do volume debaixo da terra. Com
    // 0,45 sobra um quarto do corpo enterrado, que é como arbusto e matacão de
    // verdade assentam (nenhum dos dois fica pousado em cima do solo).
    g.translate(0, 0.45, 0)
    g.computeVertexNormals()
    const n = p.count
    const arr = new Float32Array(n * 3).fill(1)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  })()

  const matArvore = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true,
  })

  const capPerto = Math.max(1, Math.min(nArv, orc.perto))
  const capSub = Math.max(1, Math.min(nArv * 2, orc.subbosque))
  const perto = new THREE.InstancedMesh(gPerto, matArvore, capPerto)
  const longe = new THREE.InstancedMesh(gLonge, matArvore, Math.max(1, nArv))
  const subbosque = new THREE.InstancedMesh(gSub, matArvore, capSub)
  perto.name = 'alpino:conifera:perto'
  longe.name = 'alpino:conifera:longe'
  subbosque.name = 'alpino:subbosque'
  // ⚠️⚠️ `frustumCulled = false` ERA LOAD-BEARING, E ELE MENTIA: A ESFERA
  // ESTAVA ERRADA, NÃO O CULLING. Conferido no three 0.162 antes de mexer
  // (`Frustum.intersectsObject`: se `object.boundingSphere` existe, é ELA que
  // decide; `InstancedMesh.computeBoundingSphere` percorre só até `this.count`).
  // O arquivo chamava `computeBoundingSphere()` uma única vez, logo depois do
  // `rebalancear(0,0,0)` de boot, e naquele instante `perto.count` e
  // `subbosque.count` são ZERO (não há árvore a 1.400 m do centro da cidade):
  // a esfera nascia VAZIA (`makeEmpty`, raio -Infinity) e nunca era refeita.
  // Ligar o culling com essa esfera apagaria as duas malhas para sempre, que
  // é exatamente o que a nota de risco da obra 2 suspeitava. Desligar o
  // culling escondia o defeito e cobrava o preço em toda parte: as três
  // malhas entravam no passe principal E no passe de sombra
  // (`WebGLShadowMap`, linha 339, testa `!object.frustumCulled ||
  // _frustum.intersectsObject`) de QUALQUER ponto da cidade, mesmo com a mata
  // a 6 km e fora da caixa de 1.000 a 4.600 m do sol.
  //
  // O conserto é calcular a esfera CERTA a cada rebalanceamento (ver
  // `aplicarEsfera` lá embaixo: caixa dos centros medida no mesmo laço que já
  // escreve a matriz, mais o raio da peça vezes a maior escala de instância),
  // e aí o culling pode ligar.
  perto.castShadow = orc.sombra && (o.sombra ?? false)
  subbosque.castShadow = orc.sombra && (o.sombra ?? false)
  // ⚠️ O VOLUME DE LONGE NUNCA PROJETA SOMBRA, em nenhum tier. Ele é um
  // octaedro de 8 triângulos que só existe para dar MASSA a mais de 1,4 km:
  // a sombra dele não seria a sombra de uma conífera, seria a de um losango.
  // São 45.947 instâncias fora do passe de sombra na medição de hoje.
  longe.castShadow = false
  for (const m of [perto, longe, subbosque]) {
    m.receiveShadow = false
    m.frustumCulled = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(m)
  }
  // ⚠️ TINTE POR INSTÂNCIA, e é ele que faz a mancha ler como mata e não como
  // esmalte verde. Mata real não tem uma cor só: idade, exposição e espécie
  // variam o valor de árvore para árvore, e a 3 px de altura é essa VARIAÇÃO
  // que o olho lê como textura de floresta. O custo é 12 B por instância
  // (0,60 MB em 52 mil), contra zero triângulo novo.
  //
  // ⚠️ O TINTE É DA ÁRVORE, NÃO DO SLOT, e a diferença não é sutil: o LOD
  // reordena os slots toda vez que a câmera anda, então tinte por slot faria a
  // mata inteira PISCAR de cor a cada rebalanceamento. Por isso ele é indexado
  // pela ÁRVORE e assado aqui, uma vez: recalcular dois hashes por árvore a
  // cada rebalanceamento custava mais que o próprio cálculo da matriz.
  const tinte = new Float32Array(nArv * 3)
  for (let k = 0; k < nArv; k++) {
    const v = 0.80 + hash01(k * 7919 + 13) * 0.34      // valor
    const q = 0.94 + hash01(k * 5237 + 71) * 0.12      // temperatura
    tinte[k * 3] = v * q
    tinte[k * 3 + 1] = v
    tinte[k * 3 + 2] = v * (2 - q)
  }
  // ⚠️ QUANTAS PEÇAS DE SUB-BOSQUE CADA ÁRVORE PEDE, ASSADO AQUI PELO MESMO
  // MOTIVO DO TINTE: o histograma de distância (ver `rebalancear`) precisa
  // SOMAR peças por anel antes de decidir o corte, e recalcular dois hashes
  // por árvore duas vezes por rebalanceamento seria pagar a conta em dobro.
  // 62% das árvores pedem sub-bosque e cada uma pede 1 ou 2 peças, ou seja
  // 0,93 peça por árvore em média: com o balde de perto cheio em 6.000, a
  // demanda é de ~5.580 peças para um teto de 2.600, e é essa disputa que o
  // corte próprio do sub-bosque resolve.
  const pecasArv = new Uint8Array(nArv)
  for (let k = 0; k < nArv; k++) {
    pecasArv[k] = hash01(k * 913 + 17) < 0.62 ? 1 + Math.floor(hash01(k * 2287) * 2) : 0
  }
  // ⚠️ `setColorAt` UMA VEZ SÓ PARA ALOCAR o `instanceColor` (o three cria o
  // atributo na primeira chamada); daí em diante o laço escreve direto no
  // buffer, como faz com a matriz. Medido: com `setColorAt` e o tinte
  // recalculado por chamada, um rebalanceamento dentro da mata custava
  // 10,69 ms; escrevendo no buffer com o tinte assado, 2,66 ms.
  const brancoInicial = new THREE.Color('#ffffff')
  for (const m of [perto, longe, subbosque]) m.setColorAt(0, brancoInicial)
  const cPerto = perto.instanceColor!.array as Float32Array
  const cLonge = longe.instanceColor!.array as Float32Array
  const cSub = subbosque.instanceColor!.array as Float32Array

  // ── 5. LOD por distância, refeito só quando a câmera anda ────────────────
  const ultima = new THREE.Vector3(1e9, 1e9, 1e9)
  // ⚠️ A PORTA RÁPIDA DO `update`, E ELA NÃO PODE SER UMA ESFERA. A primeira
  // versão desta porta usava centro e raio da mancha, e não abria NUNCA: a
  // mata é um ARCO de 180° no anel de 5,6 a 9,0 km, então a esfera que a
  // envolve tem 9 km de raio e cobre a cidade inteira. O que serve é uma grade
  // de OCUPAÇÃO grossa: 2.209 bytes (grade de 47 × 47, célula de 400 m sobre os
  // 18,1 km do anel) que dizem, com no máximo 121 leituras de byte, se existe
  // árvore ao alcance da câmera. Enquanto não existir, o balde de perto está
  // corretamente vazio e o laço de 52 mil matrizes (2,66 ms medidos) é PULADO.
  // Medido: 1,54 ms por passo de câmera dentro da cidade antes, 0,02 ms agora.
  // É esta porta que paga o teto novo: só quem voa até o maciço gasta o
  // rebalanceamento.
  const CEL_OCUP = 400
  const NO = Math.ceil((2 * R_EXT) / CEL_OCUP) + 1
  const ocupado = new Uint8Array(NO * NO)
  for (let k = 0; k < nArv; k++) {
    const ci = Math.floor((mata[k * CAMPOS] + R_EXT) / CEL_OCUP)
    const cj = Math.floor((mata[k * CAMPOS + 1] + R_EXT) / CEL_OCUP)
    if (ci >= 0 && cj >= 0 && ci < NO && cj < NO) ocupado[cj * NO + ci] = 1
  }
  const RAIO_OCUP = Math.ceil((R_CHEIA + CEL_OCUP) / CEL_OCUP)
  const temArvorePerto = (cx: number, cz: number): boolean => {
    const ci = Math.floor((cx + R_EXT) / CEL_OCUP), cj = Math.floor((cz + R_EXT) / CEL_OCUP)
    for (let dj = -RAIO_OCUP; dj <= RAIO_OCUP; dj++) {
      const jj = cj + dj
      if (jj < 0 || jj >= NO) continue
      for (let di = -RAIO_OCUP; di <= RAIO_OCUP; di++) {
        const ii = ci + di
        if (ii < 0 || ii >= NO) continue
        if (ocupado[jj * NO + ii]) return true
      }
    }
    return false
  }
  let tudoLonge = false

  // ⚠️ A MATRIZ É ESCRITA À MÃO NO BUFFER, sem `Matrix4.compose` nem
  // `setMatrixAt`. Isto não é micro-otimização gratuita: são 52 mil matrizes
  // por rebalanceamento, e `compose` monta a rotação a partir de um
  // quatérnio genérico (nove multiplicações e um `setFromEuler` antes) para
  // depois COPIAR 16 floats. Aqui a rotação é só em Y e a escala é diagonal,
  // então a matriz tem forma fechada e vai direto no `array` do atributo.
  // Convenção coluna-a-coluna do three: e[0..2] é a primeira coluna.
  const porMatriz = (arr: Float32Array, slot: number,
                     x: number, y: number, z: number,
                     sx: number, sy: number, sz: number, giro: number) => {
    const c = Math.cos(giro), s = Math.sin(giro)
    const e = slot * 16
    arr[e] = c * sx; arr[e + 1] = 0; arr[e + 2] = -s * sx; arr[e + 3] = 0
    arr[e + 4] = 0; arr[e + 5] = sy; arr[e + 6] = 0; arr[e + 7] = 0
    arr[e + 8] = s * sz; arr[e + 9] = 0; arr[e + 10] = c * sz; arr[e + 11] = 0
    arr[e + 12] = x; arr[e + 13] = y; arr[e + 14] = z; arr[e + 15] = 1
  }
  const mPerto = perto.instanceMatrix.array as Float32Array
  const mLonge = longe.instanceMatrix.array as Float32Array
  const mSub = subbosque.instanceMatrix.array as Float32Array

  // ── O CORTE POR DISTÂNCIA, E ELE ERA A ORDEM DA VARREDURA (defeito 1) ──────
  //
  // ⚠️ O BALDE DE PERTO ENCHIA PELA ORDEM DA GRADE, NÃO PELA CÂMERA. A grade de
  // candidatos é varrida em z crescente e `mata` guarda essa ordem, então o
  // `np < capPerto` de antes servia os primeiros 6.000 slots a quem tem o menor
  // z e virava a porta na cara de todo o resto. Medido com a câmera em
  // (-3037, 8090), o pior caso real (a câmera dentro da mata):
  //
  //   13.414 árvores dentro de `R_CHEIA`, `perto.count` saturado em 6.000,
  //   TODAS com z entre 6.873 e 7.845, e 7.414 árvores a menos de 1.400 m
  //   caindo no volume de longe.
  //
  // Ou seja: metade da mata em volta do visitante com geometria de 8
  // triângulos, e a metade boa toda de um lado só. É o mesmo defeito que
  // `instanciarFlorestaDensa` (`inverno.ts`, lido como referência, não editado
  // aqui) consertou hoje, e a receita vem de lá.
  //
  // ⚠️ HISTOGRAMA DE ANÉIS E SOMA ACUMULADA, NÃO ORDENAÇÃO. Ordenar 52 mil
  // distâncias por rebalanceamento seria o caminho óbvio e o caro (O(n log n)
  // com alocação). Aqui são dois passos O(n) com aritmética inteira: contar
  // quantas árvores caem em cada um dos `ANEIS_LOD` anéis, somar do centro
  // para fora até estourar o orçamento e devolver o RAIO em que ele acaba.
  //
  // ⚠️ E O SUB-BOSQUE PRECISA DO CORTE DELE (defeito 2), não do mesmo. Ele era
  // emitido DENTRO do laço do balde de perto, na mesma ordem de k, e saturava
  // igual: 2.600 de 2.600, moita e matacão nascendo só de um lado da câmera.
  // Como a demanda por árvore é conhecida (`pecasArv`, assado acima), o
  // segundo histograma soma PEÇAS por anel em vez de árvores e devolve um
  // corte próprio, sempre menor ou igual ao da árvore.
  const histoArv = new Int32Array(ANEIS_LOD)
  const histoSub = new Int32Array(ANEIS_LOD)
  /** distância à câmera por árvore, calculada no passo 1 e reusada no passo 2:
   *  208 KB em 52 mil, contra 52 mil raízes quadradas a mais por chamada */
  const distCam = new Float32Array(nArv)

  // ── A ESFERA DE CULLING, MEDIDA NO MESMO LAÇO QUE ESCREVE A MATRIZ ─────────
  //
  // ⚠️ A CAIXA É DOS CENTROS DAS INSTÂNCIAS; A PEÇA SOBRA PARA FORA DELA, e é
  // por isso que existe uma margem por balde. A margem é o raio da caixa da
  // geometria (a partir da origem dela, que é onde a instância pousa) vezes a
  // MAIOR escala que o laço pode aplicar. Nada disto é chute: as escalas saem
  // das mesmas expressões que `rebalancear` usa.
  //   árvore   `esc` ≤ 1,60 e `escXZ` ≤ 1,25, então `sxz` ≤ 2,00
  //   moita    `s` ≤ 2,70 e o eixo z ganha mais `(0,8 + 0,5)`, então ≤ 3,51
  /** ⚠️ O CANTO MAIS LONGE DA ORIGEM, POR EIXO E NÃO POR CANTO ENUMERADO:
   *  `max(|min|, |max|)` em cada eixo dá exatamente o canto extremo da caixa,
   *  sem precisar listar os oito (listar quatro deles, que era a versão óbvia,
   *  pode perder o pior em caixa assimétrica). */
  const raioGeo = (g: THREE.BufferGeometry): number => {
    g.computeBoundingBox()
    const bb = g.boundingBox!
    return Math.hypot(
      Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)),
      Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)),
      Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)),
    )
  }
  const margemPerto = raioGeo(gPerto) * 2.0
  const margemLonge = raioGeo(gLonge) * 2.0
  const margemSub = raioGeo(gSub) * 3.51
  /** caixa de cada balde, na ordem x0,y0,z0,x1,y1,z1 */
  const caixa = new Float32Array(18)
  const zerarCaixa = () => {
    for (let b = 0; b < 3; b++) {
      caixa[b * 6] = caixa[b * 6 + 1] = caixa[b * 6 + 2] = Infinity
      caixa[b * 6 + 3] = caixa[b * 6 + 4] = caixa[b * 6 + 5] = -Infinity
    }
  }
  const engolir = (b: number, x: number, y: number, z: number) => {
    const o6 = b * 6
    if (x < caixa[o6]) caixa[o6] = x
    if (y < caixa[o6 + 1]) caixa[o6 + 1] = y
    if (z < caixa[o6 + 2]) caixa[o6 + 2] = z
    if (x > caixa[o6 + 3]) caixa[o6 + 3] = x
    if (y > caixa[o6 + 4]) caixa[o6 + 4] = y
    if (z > caixa[o6 + 5]) caixa[o6 + 5] = z
  }
  /** ⚠️ COUNT ZERO PRECISA DE ESFERA VAZIA, NÃO DE ESFERA GRANDE: sem instância
   *  não há nada a desenhar, e `makeEmpty` (raio -Infinity) é justamente o que
   *  faz `Frustum.intersectsSphere` devolver `false` sempre. É o estado em que
   *  o balde de perto passa a viagem inteira quando o visitante fica na praça. */
  const aplicarEsfera = (m: THREE.InstancedMesh, n: number, b: number, margem: number) => {
    if (!m.boundingSphere) m.boundingSphere = new THREE.Sphere()
    if (n === 0) { m.boundingSphere.makeEmpty(); return }
    const o6 = b * 6
    const cx = (caixa[o6] + caixa[o6 + 3]) / 2
    const cy = (caixa[o6 + 1] + caixa[o6 + 4]) / 2
    const cz = (caixa[o6 + 2] + caixa[o6 + 5]) / 2
    m.boundingSphere.center.set(cx, cy, cz)
    m.boundingSphere.radius =
      Math.hypot(caixa[o6 + 3] - cx, caixa[o6 + 4] - cy, caixa[o6 + 5] - cz) + margem
  }

  const rebalancear = (cam: THREE.Vector3) => {
    // ── passo 1: o histograma radial e os dois cortes ──────────────────────
    histoArv.fill(0)
    histoSub.fill(0)
    const largura = R_CHEIA / ANEIS_LOD
    for (let k = 0; k < nArv; k++) {
      const b = k * CAMPOS
      const dx = mata[b] - cam.x, dz = mata[b + 1] - cam.z
      const d = Math.sqrt(dx * dx + dz * dz)
      distCam[k] = d
      if (d < R_CHEIA) {
        const anel = (d / largura) | 0
        histoArv[anel]++
        histoSub[anel] += pecasArv[k]
      }
    }
    // ⚠️ PISO DE UM ANEL, e ele existe pelo mesmo motivo que em `inverno.ts`:
    // se o primeiro anel sozinho já estourasse o orçamento (uma moita densa
    // colada na câmera), o corte sairia 0 e quem está DENTRO da mata veria só
    // o volume de longe, que é o defeito que este bloco existe pra consertar.
    // O `np < capPerto` lá embaixo continua sendo o cinto de segurança.
    let soma = 0
    let corteArv = largura
    for (let a = 0; a < ANEIS_LOD; a++) {
      if (soma + histoArv[a] > capPerto) break
      soma += histoArv[a]
      corteArv = (a + 1) * largura
    }
    let somaS = 0
    let corteSub = largura
    for (let a = 0; a < ANEIS_LOD; a++) {
      if (somaS + histoSub[a] > capSub) break
      somaS += histoSub[a]
      corteSub = (a + 1) * largura
    }
    if (corteSub > corteArv) corteSub = corteArv

    // ── passo 2: as matrizes, agora com quem está perto de verdade ─────────
    zerarCaixa()
    let np = 0, nl = 0, ns = 0
    for (let k = 0; k < nArv; k++) {
      const b = k * CAMPOS
      const ax = mata[b], az = mata[b + 1], ay = mata[b + 2]
      const esc = mata[b + 3], escXZ = mata[b + 4], giro = mata[b + 5]
      const d = distCam[k]
      const daPerto = d < corteArv && np < capPerto
      const sxz = esc * escXZ
      if (daPerto) {
        porMatriz(mPerto, np, ax, ay, az, sxz, esc, sxz, giro)
        cPerto[np * 3] = tinte[k * 3]
        cPerto[np * 3 + 1] = tinte[k * 3 + 1]
        cPerto[np * 3 + 2] = tinte[k * 3 + 2]
        engolir(0, ax, ay, az)
        np++
        // ⚠️ SUB-BOSQUE SÓ PARA QUEM ESTÁ NO BALDE DE PERTO E DENTRO DO CORTE
        // DELE. Ver `TETO_SUBBOSQUE`: além de `R_CHEIA` a moita mede menos de
        // 1,1 px. Duas peças em cada terceira árvore, no pé dela, com a mesma
        // herança de máscara que a moita de rua usa em `arborizacao.ts` (o
        // arbusto nasce da árvore, não de uma grade própria: canteiro solto no
        // meio do terreno vira mato).
        const quantasPecas = d < corteSub ? pecasArv[k] : 0
        for (let q = 0; q < quantasPecas && ns < capSub; q++) {
          const ang = hash01(k * 331 + q * 97) * Math.PI * 2
          const dd = 1.4 + hash01(k * 613 + q * 53) * 2.6
          const px = ax + Math.cos(ang) * dd, pz = az + Math.sin(ang) * dd
          const py = alturaEm(px, pz)
          if (!Number.isFinite(py)) continue
          // matacão em 28% dos casos: mais baixo, mais largo e cinza
          const pedra = hash01(k * 149 + q * 11) < 0.28
          const s = pedra
            ? 0.9 + hash01(k * 71 + q * 29) * 1.5
            : 1.1 + hash01(k * 71 + q * 29) * 1.6
          porMatriz(mSub, ns, px, py, pz,
            s, s * (pedra ? 0.55 : 0.95), s * (0.8 + hash01(k * 401 + q * 7) * 0.5),
            hash01(k * 977 + q * 13) * Math.PI * 2)
          const cc = pedra ? COR_MATACAO : COR_MOITA
          cSub[ns * 3] = cc.r; cSub[ns * 3 + 1] = cc.g; cSub[ns * 3 + 2] = cc.b
          engolir(2, px, py, pz)
          ns++
        }
      } else {
        porMatriz(mLonge, nl, ax, ay, az, sxz, esc, sxz, giro)
        cLonge[nl * 3] = tinte[k * 3]
        cLonge[nl * 3 + 1] = tinte[k * 3 + 1]
        cLonge[nl * 3 + 2] = tinte[k * 3 + 2]
        engolir(1, ax, ay, az)
        nl++
      }
    }
    perto.count = np
    longe.count = nl
    subbosque.count = ns
    aplicarEsfera(perto, np, 0, margemPerto)
    aplicarEsfera(longe, nl, 1, margemLonge)
    aplicarEsfera(subbosque, ns, 2, margemSub)
    perto.instanceMatrix.needsUpdate = true
    longe.instanceMatrix.needsUpdate = true
    subbosque.instanceMatrix.needsUpdate = true
    if (perto.instanceColor) perto.instanceColor.needsUpdate = true
    if (longe.instanceColor) longe.instanceColor.needsUpdate = true
    if (subbosque.instanceColor) subbosque.instanceColor.needsUpdate = true
    tudoLonge = np === 0
  }
  rebalancear(new THREE.Vector3(0, 0, 0))

  // ⚠️ REGISTRO NO CULLING COM DISTÂNCIA GENEROSA, DE PROPÓSITO. Esta coroa é
  // FUNDO: ela existe pra ser vista da cidade inteira, de 6 a 9 km. Cortá-la na
  // distância de mobiliário apagaria justamente o horizonte que ela desenha.
  //
  // ⚠️ E DISTÂNCIA NÃO É A RÉGUA ÚTIL AQUI, O FRUSTUM É, o que responde por que
  // este 26.000 continua onde está em vez de virar um número do perfil. O
  // `DistanceCuller` mede do CENTRO registrado, e o centro de um arco de 180°
  // no anel de 5,6 a 9,0 km não fica em lugar nenhum do arco: qualquer
  // distância que corte a mata vista do leste também a corta da praça, que é o
  // enquadramento de contrato. Medido: dentro da abóbada o ponto mais distante
  // do maciço está a 17,3 km, então baixar o registro para 14.000 só apagaria a
  // mata na borda leste, onde uma conífera de 11,5 m mede 0,7 px. Não paga o
  // risco de a montanha mudar de cor num voo.
  // Quem faz o corte de verdade agora é o `frustumCulled = true` das três
  // malhas da mata (ver o bloco da esfera lá em cima): ele é exato, não tem
  // pop, e tira as três do passe de sombra sempre que a caixa do sol não as
  // alcança, que é o caso em toda a cidade.
  o.culler?.add(group, 26000, new THREE.Vector3(0, 0, 0))

  const trisPerto = gPerto.attributes.position.count / 3
  const trisLonge = gLonge.index ? gLonge.index.count / 3 : gLonge.attributes.position.count / 3
  const trisSub = gSub.index ? gSub.index.count / 3 : gSub.attributes.position.count / 3
  // custo declarado: a coroa em quads + a mata toda no volume de longe + o
  // sub-bosque no teto dele. O pior caso do balde de perto (câmera dentro da
  // mata) troca `orc.perto` árvores de `trisLonge` para `trisPerto`, o que
  // soma `orc.perto × (trisPerto - trisLonge)` a este número.
  const triangulos = quads * 2 + nArv * trisLonge + capSub * trisSub
  void trisPerto

  return {
    group,
    arvores: nArv,
    neveKm2: (quads * PASSO * PASSO) / 1e6,
    triangulos,
    update(cam: THREE.Vector3) {
      if (cam.distanceTo(ultima) < PASSO_REBALANCE) return
      // porta rápida: nenhuma árvore ao alcance e tudo já no balde de longe,
      // não há troca de LOD possível. Ver `temArvorePerto`.
      if (tudoLonge && !temArvorePerto(cam.x, cam.z)) {
        ultima.copy(cam)
        return
      }
      ultima.copy(cam)
      rebalancear(cam)
    },
    dispose() {
      neve?.geometry.dispose()
      matNeve.dispose()
      texNeve.dispose()
      gPerto.dispose()
      gLonge.dispose()
      gSub.dispose()
      matArvore.dispose()
      perto.dispose()
      longe.dispose()
      subbosque.dispose()
      group.clear()
    },
  }
}
