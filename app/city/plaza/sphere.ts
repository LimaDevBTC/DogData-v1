// ═══════════════════════════════════════════════════════════════════════════
// THE SPHERE na cena da cidade.
//
// Um telão de LED esférico de **196 m de diâmetro**, emergindo de um
// embasamento sobre um deck apertado, com praça caminhável em volta. Referência
// declarada: a Sphere de Las Vegas (elipsóide de 157 x 112 m, ~1,2 milhão de
// pontos de LED a ~20 cm de passo). A nossa é ESFERA, mostra 136,7 m acima do
// colar (a de Vegas mostra 112) e tem 1,34 milhão de LEDs. Dossiê em
// `sphere.md`.
//
// ⚠️ ELA CRESCEU DUAS VEZES EM 07/09, E AS DUAS FORAM O FUNDADOR VENDO A PEÇA
// EM PRODUÇÃO. De manhã ela media 135 m com o centro a 0,88 R (uma bola inteira
// pousada no chão, 94% da altura à vista contra os 71% da referência); à tarde
// virou 160 m com o centro a 0,43 R; à noite ele fechou **196 m**, que é o
// máximo que deixa PRAÇA e não beirada. Cada salto refez o corte, a faixa de
// texto, o passo de LED, o orçamento de escrita e o fillrate, e cada um desses
// números está medido no comentário da própria constante.
//
// ⚠️ E ELA NUNCA MORRE, POR REQUISITO ESCRITO. Palavra do fundador em 07/09:
// *"ela e seus detalhes devem ser vistos de qualquer lugar, mesmo que só parte,
// mas ela não pode desaparecer por completo em momento nenhum"*, com o limite
// *"algo LEVE"*. Isso é `uVida` (ver a seção 6): a respiração do anel e o pulso
// de evento custam UM uniforme, não um shader, e por isso valem também no
// material liso do perfil fraco, que é justamente onde a peça virava bola
// parada. Nada pisca: 0,083 Hz.
//
// ⚠️ SÓ A CASCA. Sem auditório, sem plateia, sem interior. O Geode é o interior
// da cidade e a Sphere é o exterior; uma é sala, a outra é casca, e por isso não
// competem.
//
// ⚠️ A POSIÇÃO É UM MÓDULO DA TEIA, NÃO UMA COORDENADA. Regra paga duas vezes
// nesta casa (`estadio.ts` e `geode.ts`): peça de infra ocupa um número inteiro
// de módulos porque os lados do módulo SÃO ruas. E caber num módulo é NECESSÁRIO
// E NÃO SUFICIENTE: o sítio foi varrido contra as três famílias de via de
// `cidade-malha.json` (bulevar, autopista, anel), canais, eclusas, metrô, água e
// as 70 peças de `cidade.json` mais Geode e Estádio à mão. Os números estão em
// `sphere.md`, seção "A validação contra tudo, com número".
//
// ⚠️ ELA NÃO CARREGA SOB DEMANDA. Sumir do boot mataria a razão de ela existir,
// que é ser vista de 81% do tecido da cidade. O que escalona por distância e por
// perfil é o DETALHE (o padrão de ponto, a nitidez do conteúdo, o texto), nunca
// a peça.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'
import { R_ANCHOR } from './precinct'
import { PRACA_Y } from './terrain'
import type { PerfProfile } from './perf'

// ═══════════════════════════════════════════════════════════════════════════
// 1. O SÍTIO E AS CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ SUBSTITUI O RUMO 320 / r 3.800 DE 06/09, QUE COLIDIA COM O ANEL EXTERIOR.
 * Medido em 07/09: **-97 m de folga contra o AN3** (r 3.750, seção de 26 m) em
 * qualquer rumo daquela banda da teia, ou seja o anel corta o prédio e não a
 * calçada. É exatamente o mesmo erro de método que já custou o Geode e o
 * Estádio: varrer contra as peças e esquecer a malha viária.
 *
 * Este módulo saiu de uma varredura da teia inteira (r 1.900 a 6.900) contra
 * tudo. Folga medida: 637 m ao bulevar mais próximo (BUL07), 406 m ao anel mais
 * próximo (AN5, r 5.620), 3.363 m à autopista, 1.621 m à eclusa, 4.310 m à
 * água, 2.296 m à peça construída mais próxima (E01). Separação do distrito
 * esportivo: 7.266 m do Geode (117,9° de rumo) e 7.621 m do Estádio (128,6°).
 */
export const SPHERE_MOD: Modulo = { i: 20, nr: 1, j: 108, ns: 1 }

/**
 * ⚠️ O SÍTIO É PARAMÉTRICO A PARTIR DAQUI, e isso é de propósito: em 07/09 o
 * fundador avisou que a POSIÇÃO provavelmente muda (ele estuda trazer a peça
 * para perto da praça central). Tudo o que se segue sai de `SPHERE_MOD` por
 * `caixaDoModulo`/`polyDoModulo`, e a cota do tabuleiro é MEDIDA no relevo em
 * `buildSphere`, então trocar o módulo não pede reescrever a peça: pede trocar
 * uma linha e conferir a folga contra a malha viária de novo.
 */

/** caixa do módulo, direto de `caixaDoModulo(SPHERE_MOD)`, já com recuo de rua.
 *  Medido: 227,0 m no radial x 370,8 m no arco, centro em r 5.117,5 m. */
const _CX = caixaDoModulo(SPHERE_MOD)
export const SPHERE_ENVELOPE_RADIAL = _CX.r1 - _CX.r0
export const SPHERE_ENVELOPE_ARCO = (_CX.a1 - _CX.a0) * _CX.rm

/**
 * ⚠️ 196 m, DECISÃO FECHADA DO FUNDADOR EM 07/09 À NOITE, e o número tem um
 * limite duro atrás dele: **o menor lado do lote**. A caixa do módulo mede
 * 227,0 m no radial (o arco tem 370,8 e nunca é quem aperta), e com o centro a
 * 0,43 R a esfera encosta no tabuleiro numa linha de `2R·√(1−0,43²)` =
 * **1,8057 R**. Medido, para os três diâmetros que estavam na mesa:
 *
 *     diâmetro   base no chão   praça no radial, por lado (contra os 227,0)
 *       160 m      144,5 m        41,3 m
 *     **196 m      177,0 m        25,0 m  ← escolhido**
 *       218 m      196,8 m        15,1 m
 *
 * ⚠️ E OS 218 FORAM RECUSADOS PELO MOTIVO CERTO: com 15 m de folga sobra
 * BEIRADA, não praça. Medido contra o deck de verdade, os 218 deixariam
 * **1,4 m** entre o embasamento e a divisa radial do lote, ou seja o pódio
 * encostaria na rua. A base tem de ser caminhável porque a cidade vai para
 * terceira pessoa, e isso é o que trava a escala, não a esfera.
 *
 * O que 196 entrega, medido:
 *
 *     topo acima do tabuleiro                  140,1 m   (a de Vegas tem 112)
 *     topo acima do colar (o que se vê)        136,7 m   = 69,8% da altura
 *     largura no plano do tabuleiro            177,0 m
 *     largura na linha do colar                180,0 m
 *
 * ⚠️ NÃO AUMENTAR ALÉM DISTO SEM O FUNDADOR. O limite não é estrutural nem de
 * fillrate: é a praça.
 */
/**
 * ⚠️ 215,6 m DESDE 08/09, E O MOTIVO MUDOU DE NATUREZA. Os 196 m eram travados
 * pela PRAÇA do sítio antigo: a caixa do módulo da teia tinha 227,0 m no radial e
 * crescer mais deixaria beirada em vez de praça caminhável. Esse limite morreu
 * junto com o módulo: na âncora norte quem manda é o anel viário do precinto.
 *
 * ⚠️ E O QUE PEDIU O CRESCIMENTO FOI PROPORÇÃO, NÃO ESCALA. O fundador: *"os
 * prédios parecem altos demais e a esfera precisa ser o foco das atenções"*.
 * Medido acima do piso da praça, antes: torre central 525,4 m, BitFlow 343,9,
 * Kray 332,2, e a esfera 140,1, ou seja **27% do prédio mais alto**. Crescer a
 * esfera sozinha não resolvia (para empatar com a torre ela precisaria de 735 m
 * de diâmetro, 3,75x), então isto anda junto com o corte dos prédios em
 * `plaza-scene.tsx`: torre central −45%, âncoras laterais −25%.
 *
 * O que 215,6 entrega, medido:
 *
 *     altura acima do piso da praça             154,1 m  (era 140,1)
 *     largura no plano do piso                  194,7 m
 *     encosta no chão em                        r 522,6
 *     folga contra o anel viário (borda 469)    **53,6 m**  (era 23,9)
 *
 * ⚠️ A FOLGA MELHOROU AO CRESCER, e isso não é engano: o avental é um quadrado
 * de lado fixo e é ELE que definia a folga antes, não a esfera. A esfera cresceu
 * dentro do avental.
 *
 * ⚠️ E O JARDIM ACOMPANHA SOZINHO, porque tudo nele sai de `sphereRaioNaCota` e
 * do sítio. O passo do LED também: ele é `2πR/2048` e vai de 30,07 para 33,08 cm,
 * com a contagem de LEDs inalterada em 1.335.088, que é `2048²/π` e não depende
 * de R. A letra grande vai de 16,84 para 18,52 m, e o alcance de leitura sobe na
 * mesma proporção.
 */
export const SPHERE_DIAM = 215.6
export const SPHERE_R = SPHERE_DIAM / 2

/**
 * A COTA DO TABULEIRO. **Este número é o esperado, não a fonte**: quem manda é
 * `sphereAssentar()`, que MEDE o relevo sob o deck na hora de construir. O valor
 * fica escrito aqui porque ele é o contrato conferível offline e porque, se a
 * medição divergir dele, a peça mudou de sítio ou o terreno mudou, e as duas
 * coisas merecem ser notadas.
 *
 * Regra da casa, já escrita em `assentarEstadio` e `assentarGeode`: o pé é a
 * cota MÁXIMA medida em grade sobre a peça inteira, mais 0,4 m de margem para o
 * micro-relevo do `terreno=fino`. Medido em 07/09 contra
 * `public/lunar/btc-core-heightmap.f32`, com o mesmo `heightAt` da cena:
 *
 *     sobre o MÓDULO INTEIRO (227,0 x 370,8)    97,13 a 117,39 m   desnível 20,3
 *     **sobre o DECK APERTADO (229,6 x 254,2)   99,78 a 116,00 m   desnível 16,2**
 *
 * A cota máxima do módulo cai numa QUINA do arco (o vértice 2 do polígono mede
 * 117,39 m), e é justamente a quina que o deck novo não cobre mais. Por isso o
 * pé desceu de 118,3 para 116,4 sem nenhuma terraplenagem a mais.
 *
 * ⚠️ E O PREÇO CONTINUA MEDIDO: o talude na quina baixa chega a **16,6 m**
 * (116,4 contra 99,78), contra os 20,6 m de antes. Hoje ele é uma saia reta;
 * escalonar esse talude em terraços é dívida declarada, não defeito escondido.
 */
export const SPHERE_PLATAFORMA_Y = 116.4

/**
 * ⚠️ O TABULEIRO ENCOLHEU NO ARCO, e isso é a outra metade da queixa do
 * fundador: *"ela me parece pequena EM RELAÇÃO AO TERRENO QUE ELA OCUPA"*. O
 * deck cobria o módulo inteiro (227,0 x 370,8) e a esfera nadava dentro dele.
 *
 * Medido sobre o polígono de verdade (`polyDoModulo`, não a caixa), a razão
 * entre a largura da esfera na linha do colar e a largura do deck:
 *
 *                        no radial   no arco
 *     135 m, deck do módulo inteiro             28,2%      17,3%
 *     160 m, deck apertado                      64,2%      58,0%
 *     **196 m, deck apertado**                  **78,4%**  **70,8%**
 *     196 m contando o embasamento construído    88,9%      80,3%
 *
 * O radial não muda (a caixa do módulo já era apertada nesse eixo e os dois
 * lados dele SÃO rua). Quem encolhe é o arco, em 16,5% de cada ponta, e o
 * resultado é um deck de **229,6 m no radial por 254,2 m no arco**: um lote quase
 * quadrado para uma peça de revolução, em vez de uma laje de quarteirão inteiro
 * com uma bola no meio.
 *
 * ⚠️ ESTES 229,6 x 254,2 SÃO MEDIDOS NO POLÍGONO, e o dossiê chegou a publicar
 * 230,5 x 248,6, que sai da CAIXA (`caixaDoModulo`, 227,0 x 370,8) e não do
 * dodecágono. É a mesma diferença de 58 m que já derrubou o centro da peça uma
 * vez (ver `sphereSitio`): quem constrói é o polígono.
 *
 * ⚠️ E O RESTO DO MÓDULO CONTINUA SENDO O LOTE. `sphereParcela()` ainda devolve
 * o polígono INTEIRO, então a teia continua sem desenhar rua por dentro; as duas
 * pontas do arco que o deck não cobre ficam em terreno natural, que é a condição
 * normal de um lote de monumento e não um buraco.
 *
 * ⚠️ BÔNUS MEDIDO: a cota máxima do módulo inteiro (117,39 m) cai numa QUINA do
 * arco, a 185 m do centro, e essa quina fica FORA do deck novo. Sobre o deck
 * apertado o relevo vai de **99,78 a 116,00 m**, então o pé desce de 118,3 para
 * **116,4** (116,00 + 0,4 de margem) e o talude da quina baixa cai de 20,6 para
 * **16,6 m**. Continua sendo saia reta, e terraçar continua sendo dívida
 * declarada; só ficou 4 m menor de graça.
 *
 * ⚠️ E A ESCALA DE 196 m NÃO MEXEU EM NADA DISTO, de propósito: o deck é o mesmo
 * polígono, então a cota é a mesma, o talude é o mesmo 16,6 m e a terraplenagem
 * é a mesma. Quem cresceu foi a peça DENTRO do deck. É o que permitiu subir de
 * 160 para 196 sem remedir o heightmap.
 */
export const SPHERE_DECK_ENCOLHE = 0.165

/**
 * Quanto do raio fica ACIMA do tabuleiro, medido do centro da esfera.
 *
 * ⚠️ 0,43 R, A MESMA PROPORÇÃO DA REFERÊNCIA REAL, e não os 0,88 R de antes. A
 * Sphere de Las Vegas mede 157 m de largura por 112 de altura: centro a 33,5 m
 * do chão em 78,5 m de raio, ou seja **0,43 R**, com **71%** da altura à vista.
 * Os 0,88 R que estavam aqui davam 94% e liam como bola largada no chão, que foi
 * exatamente o que o fundador viu.
 *
 * O que sai desta constante, medido:
 *
 *     centro acima do tabuleiro                 42,14 m  (0,43 x 98)
 *     topo acima do tabuleiro                  140,1 m   (71,5% da altura total)
 *     largura no plano do tabuleiro            177,0 m
 *     latitude do plano de corte              −25,47°
 *     calota que sai da malha (thetaLength)     29,1% da área
 *
 * ⚠️ A LATITUDE DO CORTE NÃO DEPENDE DE R, e isso é bom saber antes da próxima
 * mudança de escala: ela é `asin(−0,43)` e vale −25,47° em qualquer diâmetro.
 *
 * ⚠️ E É ESTE CORTE QUE DECIDE ONDE A FAIXA MORA, mas não pelo motivo que este
 * comentário deu até 07/09. Ele dizia que o corte tinha EMPURRADO a faixa para
 * baixo (para ela não ficar meio enterrada) e que o limite era o OCLUSOR, o
 * colar. Isso resolvia o problema errado: o que o corte realmente faz é tirar a
 * calota de baixo da silhueta e, com isso, subir a metade da altura aparente
 * para **+16,56°**. A faixa foi para lá em 07/09 à noite, e a conta inteira, com
 * a chapa de produção que a motivou, está em `SPHERE_FAIXA_LINHA0`.
 */
export const SPHERE_ENTERRO = 0.43

/**
 * O EMBASAMENTO, e ele é requisito e não enfeite.
 *
 * ⚠️ COM O CORTE MAIS BAIXO A LINHA DE ENCONTRO COM O CHÃO FICA VISÍVEL E LONGA
 * (**180,0 m no topo do colar**, contra 147,5 na esfera de 160), e uma
 * intersecção seca entre uma esfera de 196 m e um piso plano lê como bug de
 * modelagem. A de Las Vegas resolve isso com o embasamento do
 * edifício. Aqui são duas peças:
 *
 *   · **pódio**: anel de 12,6 m de largura e **2,2 m** de altura, de r 89,49
 *     (onde a esfera passa pela cota +2,2) a r 102,09. É o terraço que envolve a
 *     base, e ele é caminhável porque a cidade vai para terceira pessoa.
 *   · **colar**: um chanfro de 3,0 m de largura e 1,2 m de altura sobre o pódio,
 *     inclinado a **25,9°**, que sobe até encostar na esfera em r 90,02. É ele
 *     que resolve o encontro: a esfera EMERGE de um bisel, não corta um plano.
 *
 * Resultado medido: **136,7 m de esfera acima do topo do colar, 69,8% da altura
 * total**, contra os 71% da referência. E a casca é cortada 1,0 m ABAIXO do topo
 * do pódio, então o aro da malha nunca briga em profundidade com o piso.
 *
 * ⚠️ ACESSO AO PÓDIO É DÍVIDA DECLARADA. 2,2 m de face vertical não se sobe a
 * pé, e escada/rampa é programa de praça, que o dossiê já lista em aberto.
 */
/**
 * ⚠️ O PÓDIO ACABOU EM 08/09, POR DECISÃO DO FUNDADOR: *"creio que a praça seja
 * completamente plana, e talvez podemos abrir mão do pódio e colocá-la
 * diretamente no solo, ou algo próximo disso"*. A praça é plana mesmo
 * (`PRACA_Y`), então o embasamento perdeu a função que o justificava: ele
 * existia para resolver uma peça de 196 m pousada em terreno com 16,2 m de
 * desnível sob ela, com saia reta até o relevo. Nada disso existe na âncora.
 *
 * ⚠️ E O "ALGO PRÓXIMO DISSO" É O COLAR, QUE FICA. A esfera encontrando um piso
 * plano numa linha de 180 m lê como bug de modelagem, e não é gosto: é o mesmo
 * motivo pelo qual a de Las Vegas tem embasamento. O colar não é pódio, é um
 * chanfro de 3,0 m de largura e 1,2 m de altura, ou seja um FILETE no pé: a
 * esfera EMERGE de um bisel em vez de cortar um plano, e quem chega pisa no
 * mesmo chão da praça. Zero degrau, zero terraço, zero escada.
 *
 * ⚠️ COM O PÓDIO EM ZERO, A ESCADARIA DO JARDIM VIROU ZERO DEGRAU SOZINHA: ela
 * era dimensionada por `SPHERE_PODIO_H / ESCADA_ESPELHOS`, e agora não há
 * desnível para vencer. É o resultado certo, e é por isso que a constante fica
 * em 0 em vez de a escadaria ser apagada à mão.
 */
export const SPHERE_PODIO_H = 0
/**
 * ⚠️ 12,6 m, E NÃO OS 14,0 DA ESFERA DE 160. A largura do pódio não escala com
 * a esfera: ela é escala HUMANA (um terraço que alguém pisa), e o que a define
 * é o que sobra de deck do lado de fora. Com 196 m a esfera encosta em r 88,50 e
 * o pódio começa em r 89,49; o deck tem 229,6 m no radial, logo 114,80 m de meia
 * largura, e a conta de repartir o que sobra em DUAS faixas caminháveis iguais é
 *
 *     114,80 − 89,49 = 25,31 m para dividir  →  12,6 m de pódio + 12,7 m de deck
 *
 * Medido: o terraço do pódio fica com **12,6 m** e o anel de praça no nível do
 * tabuleiro com **12,7 m** no radial e **25,0 m** no arco. Com os 14,0 antigos o
 * anel de deck caía para 11,3 m e o embasamento passava a ocupar 90,1% da
 * largura radial do deck; com 12,6 são 88,9%, e as duas faixas leem como duas
 * faixas em vez de uma calçada sobrando ao lado de um terraço.
 *
 * ⚠️ A ALTURA NÃO MUDOU, e nem podia: 2,2 m é degrau de gente, não proporção de
 * esfera. Continua sem escada, e continua dívida declarada.
 */
export const SPHERE_PODIO_LARG = 12.6
export const SPHERE_COLAR_LARG = 3.0
export const SPHERE_COLAR_H = 1.2

/** raio em que a esfera passa por uma cota `y` acima do tabuleiro */
export function sphereRaioNaCota(y: number): number {
  const dy = SPHERE_ENTERRO * SPHERE_R - y
  return SPHERE_R * Math.sqrt(Math.max(0, 1 - (dy / SPHERE_R) ** 2))
}

/** onde a esfera encontra o topo do pódio: 73,23 m */
export const SPHERE_R_PE = sphereRaioNaCota(SPHERE_PODIO_H)
/** onde ela encontra o topo do colar, que é a linha visível: 73,75 m */
export const SPHERE_R_COLAR = sphereRaioNaCota(SPHERE_PODIO_H + SPHERE_COLAR_H)

/**
 * A praça RESERVADA em volta do EMBASAMENTO, por lado, contra o deck apertado.
 *
 * ⚠️ ELA ENCOLHEU COM OS 196 m, E ISSO É O PREÇO DECLARADO DA ESCALA. Medido
 * sobre `sphereDeckPoly()` (229,6 m no radial x 254,2 no arco, medidos, não
 * lidos) contra o pódio em r 102,09:
 *
 *                        radial      arco
 *     esfera de 160       27,6 m     39,9 m
 *     **esfera de 196     12,7 m     25,0 m**
 *
 * A esses 12,7 m soma-se o terraço do pódio, que também é chão de pisar: são
 * **12,6 + 12,7 = 25,3 m** de faixa caminhável do costado da esfera até a rua,
 * que é exatamente a conta de 25,0 m que o fundador fez à mão contra a caixa do
 * módulo (227,0 m). O que o dossiê chamava de praça grande era, antes, laje.
 *
 * ⚠️ E A ASSIMETRIA ENTRE OS EIXOS É CONHECIDA: 12,7 no radial contra 25,0 no
 * arco. Quadrar o deck pediria `SPHERE_DECK_ENCOLHE = 0,1904` (229,6 x 229,6),
 * o que muda a pegada da terraplenagem e obriga a remedir `SPHERE_PLATAFORMA_Y`
 * no heightmap. Fica declarado, não feito: os lados radiais SÃO rua e não se
 * mexem, e encolher o arco só melhora a cota, nunca piora.
 */
export const SPHERE_PRACA_RADIAL = 12.7
export const SPHERE_PRACA_ARCO = 25.0

// ═══════════════════════════════════════════════════════════════════════════
// 2. A GRADE DE LED
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ O PASSO DO LED É 30,07 cm, E QUEM MANDA É A GRADE, NÃO O PASSO.
 *
 * ⚠️ ELE FOI 20,71 → 24,54 → **30,07 cm** nas três escalas de 07/09. O passo não
 * é uma constante escolhida: ele CAI da grade em potência de dois, que é o que
 * faz a célula ser quadrada por construção. Com R = 98 m: a circunferência do
 * equador mede 2πR = 615,75 m, e 615,75 / 2.048 = **30,07 cm**; do polo ao polo
 * são πR = 307,88 m, e 307,88 / 1.024 = **30,07 cm** também.
 *
 * ⚠️ E O NÚMERO DE LEDs NÃO MUDA COM A ESCALA, medido: `4πR² / passo²` com
 * `passo = 2πR/2048` dá `2048²/π` = **1.335.088 pontos**, sem R nenhum na conta.
 * Crescer a esfera não compra pixel, compra ÁREA: a casca foi de 80.425 para
 * **120.687 m²** com o mesmo painel esticado. É por isso que o passo engrossa, e
 * é a única forma de manter a célula quadrada numa grade de potência de dois.
 *
 * As duas pontas que o dossiê exige continuam entregues, remedidas. A câmera da
 * praça tem **FOV vertical de 42°** (`plaza-scene.tsx:1125`); num quadro de
 * 1080 px isso dá **678,7 µrad por pixel**, e um LED ocupa `p / D / 678,7e-6`:
 *
 *      20 m    22,15 px    painel resolvido, dá para contar puck
 *     100 m     4,43 px    **o padrão de disco aparece e lê como PAINEL**
 *     200 m     2,21 px    transição
 *     443 m     1,00 px    o ponto encosta no pixel: o padrão morre aqui
 *   1.000 m     0,44 px    ponto de luz
 *   3.000 m     0,15 px    **sub-pixel, ela lê como ponto de luz**
 *   5.175 m     0,09 px    (a distância da praça central)
 *
 * ⚠️ O PADRÃO DURA MAIS LONGE, E ISSO NÃO É GANHO DE GRAÇA: ele morria a 361 m e
 * agora morre a **443 m**, mas o degrau para o material liso do perfil fraco
 * continua em `lodDistance` (298 a 381 m), ou seja ele passou a cair com o padrão
 * ainda em **k = 0,195** (era 0,037). Medido, e é dívida declarada: o degrau
 * ficou 5x mais visível no perfil fraco. Fazê-lo esperar o padrão morrer custaria
 * o shader completo sobre 95 a 100% da tela de um celular entre 298 e 443 m, que
 * é caro demais para o que se ganha.
 *
 * Painel físico resultante: **1.335.088 LEDs** sobre **120.687 m² de casca**. A
 * de Las Vegas tem 1,2 milhão a ~20 cm sobre um elipsóide bem menor.
 */
export const SPHERE_GRADE_COLS = 2048
export const SPHERE_GRADE_ROWS = 1024
export const SPHERE_PASSO = (2 * Math.PI * SPHERE_R) / SPHERE_GRADE_COLS  // 0,2454 m

/**
 * ⚠️ A FAIXA MORA NO CENTRO ÓPTICO DA SILHUETA, E ESSE PONTO NÃO É O EQUADOR.
 *
 * ⚠️ ELA ESTEVE EM 540-640 ATÉ 07/09 À NOITE, E FOI DEFEITO DE PRODUÇÃO. O
 * fundador viu a peça no ar e disse: *"o texto que estamos imprimindo na nossa
 * sphere está somente na parte de baixo (…) exatamente onde tem aquela tarja
 * branca me parece ser o local de maior visibilidade"*. Estava, e a tarja que
 * ele apontou é a cinta da Kray em 400-424. Ele leu a peça certo, e dá para
 * provar por número.
 *
 * ⚠️ A METADE DA ALTURA APARENTE FICA EM +16,56°, LINHA 418. A casca é cortada
 * em −24,69° (`thetaMax`, ver `buildSphere`), então a silhueta visível vai de
 * `sin = −0,43` a `sin = +1,00` e o meio dela cai em `sin = 0,285`, que é
 * latitude **+16,56°** e não o equador. Medida a linha que cai no meio da altura
 * aparente, por ponto de vista:
 *
 *     olho\dist    200    315    500   1000   2000   3000   5175
 *       1,7 m      572    533    496    459    439    432    426
 *       150 m      496    469    451    435    426    424    421
 *       250 m      369    400    411    416    417    418    418
 *       400 m      248    307    353    389    404    409    413
 *
 * Converge para **418-426 em qualquer altura de câmera**, e só desce para 533-572
 * para quem está de pé no chão a menos de 315 m, que é onde o próprio dossiê já
 * dizia que não se lê nada.
 *
 * ⚠️ E O ERRO ANTERIOR FOI OTIMIZAR ESMAGAMENTO ONDE LEGIBILIDADE NÃO CORRIA
 * RISCO. A versão de 540-640 escolheu a faixa MAIS BAIXA que o colar deixava,
 * para minimizar a compressão da altura da letra para um pedestre de 1,7 m a
 * 315 m. Só que a 315 m a letra de 16,84 m mede **78,8 px** de tela (fov 42 em
 * 1080, 678,7 µrad/px): esmagar para 0,43 ainda deixa **33,9 px**, quatro vezes
 * o piso de ~9 px. Comprou 0,44 de compressão num lugar onde ela não valia nada
 * e pagou com a tela inteira em todo lugar onde ela valia.
 *
 * Compressão PIOR da banda, medida (`X` = latitude oclusa ou de costas):
 *
 *     olho      dist    315    500   1000   2000   2756
 *     antes    1,7 m   0,87   0,96   0,97   0,95   0,94
 *     antes  158,5 m   0,85   0,89   0,91   0,92   0,92
 *     antes    400 m   0,28   0,55   0,77   0,86   0,88
 *     agora    1,7 m   0,43   0,65   0,81   0,87   0,88
 *     agora  158,5 m   0,83   0,87   0,90   0,91   0,91
 *     agora    400 m   0,74   0,90   0,98   0,95   0,94
 *
 * ⚠️ OS 158,5 m SÃO A COTA DO CENTRO DA ESFERA, E É DE LÁ QUE A CHAPA DO
 * FUNDADOR FOI TIRADA. A câmera da praça não é um pedestre: `controls` deixa
 * subir sem teto (`maxDistance` 16.000, `minPolarAngle` 0) e a cidade se olha de
 * cima. Contra a câmera de verdade a faixa antiga era a PIOR das candidatas, e a
 * 400 m de altura ela chegava a **0,28**, ou seja de perfil.
 *
 * ⚠️ O ALCANCE DE LEITURA NÃO MUDOU, e isso é o que fecha a conta. Com o
 * critério de 9 px de altura JÁ COMPRIMIDA para a letra de 16,84 m:
 *
 *     olho        1,7 m    158,5 m    400 m
 *     antes      2.706 m   2.669 m   2.590 m
 *     **agora    2.565 m   2.624 m   2.691 m**
 *
 * Perde 141 m para o pedestre e ganha 101 m para a câmera aérea. É empate, e o
 * que se compra com o empate é a peça deixar de ter o conteúdo no rodapé.
 *
 * ⚠️ O QUE SE PERDE DE VERDADE É O PEDESTRE COLADO. Abaixo de ~200 m, no chão, a
 * faixa nova fica de perfil e não se lê em azimute nenhum (a antiga ainda dava
 * 11,7 casas a 150 m). Isso está DENTRO do contrato já publicado, que abre a
 * janela de leitura em 315 m e diz que do pé da esfera não se lê nada; a
 * diferença é que agora a geometria impõe o que o orçamento já dizia. Fica
 * declarado, não escondido.
 *
 * ⚠️ QUEM É CENTRADA É A LINHA GRANDE, NÃO A CAIXA DA FAIXA, e a escolha tem
 * motivo: a linha grande carrega o VALOR, e valor é o que se lê. Com
 * `LINHA0 = 378` o miolo grande ocupa 386-442 e o centro dele cai em **414**,
 * a 1,14 m dos 417,8 do centro óptico numa esfera de 196 m. Centrar a CAIXA em
 * vez da linha (366-474) poria o valor em 402 e o anel aceso no lugar exato;
 * medido, a diferença de compressão entre as duas é ≤0,04 em toda a tabela, e
 * então ganha a que serve a leitura.
 *
 * ⚠️ NÃO EXISTE OCLUSOR AQUI. O limite que mandava na versão antiga era o topo
 * do colar (latitude −23,29°, linha 644,5), e a faixa nova acaba em 486: sobram
 * **166 linhas, 50,1 m** até o corte da malha. O que limita a faixa para CIMA é
 * só o escorço do polo, e ele começa a doer bem acima de 378.
 */
export const SPHERE_FAIXA_LINHA0 = 368
export const SPHERE_FAIXA_LINHA1 = 496

/**
 * ⚠️ A FAIXA FOI DE 108 PARA 128 LINHAS EM 08/09, E NÃO PARA DAR AR AO TEXTO DE
 * PERTO: foi para caber o REGISTRO DE LONGE. Pedido do fundador: *"só tá faltando
 * a esfera mostrar os dados mesmo a grandes distâncias"*.
 *
 * ⚠️ O MIOLO DE PERTO NÃO ANDOU UM PIXEL. A faixa cresceu 10 linhas para cada
 * lado e a margem do modo perto subiu de 8 para 18, então a linha grande continua
 * em 386-442 com centro em 414 e a pequena em 450-478, exatamente como estavam.
 * O que mudou foi só o espaço em volta.
 *
 * A altura física passou de 32,47 para **38,49 m**, e isso tem um efeito de
 * borda bem-vindo: o anel aceso que sobra além do `textCull` ficou 18% mais
 * alto, e é ele a assinatura da peça a 8 km.
 */

/** latitude, em graus, de uma linha da grade contada do polo norte */
export function sphereLatDaLinha(linha: number): number {
  return 90 - (180 * linha) / SPHERE_GRADE_ROWS
}

// ── o interior da faixa, em linhas de LED ──────────────────────────────────
// ⚠️ A FAIXA É DIMENSIONADA PELA LETRA, e não o contrário: doutrina do letreiro
// do Estádio (`estadio.md`), que a pagou com um painel de 10,5 m para letra de
// 7,35. Aqui: margem 8, linha grande 56 (7 x 8), vão 8, linha pequena 28
// (7 x 4), margem 8 = **108 linhas**, e a soma fecha.
// ⚠️ ERAM 108 NA CONTA E 100 NO CÓDIGO, E ISSO ERA DEFEITO. Enquanto o limite
// era o colar (a janela livre tinha 101 linhas) a faixa foi cravada em 100, e a
// conta acima nunca bateu: 8+56+8+28 = 100 já sem margem NENHUMA embaixo, ou
// seja a linha pequena encostava na borda do painel. Com a faixa no centro
// óptico o oclusor sumiu, então a margem de baixo passou a existir de verdade e
// a faixa mede 108 linhas = **32,47 m**. As escalas 8 e 4 continuam intactas e a
// letra não mudou de tamanho (12,03 x 16,84 m a grande, 6,01 x 8,42 a pequena).
const FX_MARGEM = 8
const FX_GRANDE_ESCALA = 8   // linhas de LED por pixel de glifo
const FX_PEQUENA_ESCALA = 4
const FX_VAO = 8

/**
 * ⚠️ O REGISTRO DE LONGE: UMA LINHA SÓ, DOBRO DA ESCALA, SÓ O VALOR.
 *
 * Medido na tela da live (1080 px, fov 42, `pxAng` 6,787e-4), com o critério de
 * 9 px de altura de letra que esta casa usa:
 *
 *     escala 8 (perto)   letra 16,84 m   32 casas   legível até **2.757 m**
 *     escala 16 (longe)  letra 33,69 m   16 casas   legível até **5.515 m**
 *
 * ⚠️ E 16 NÃO É ESCOLHA DE GOSTO, É A PRÓXIMA QUE FECHA A VOLTA. O texto tem de
 * dar a volta num número inteiro de casas: `2048 / (8 x escala)` só é inteiro
 * para escala em potência de dois. 8 dá 32 casas, 16 dá 16, e 15 daria 17,07, ou
 * seja emenda visível no meridiano. Não existe meio termo entre 2.757 e 5.515 m.
 *
 * ⚠️ O QUE ELE MOSTRA É O VALOR E MAIS NADA. O rótulo (a linha pequena) já é
 * ilegível bem antes: com 8,42 m ele morre em 1.378 m. Insistir nele de longe
 * gastaria metade da faixa com borrão. 16 casas cobrem qualquer valor que esta
 * peça publica (o orçamento de perto já era 7).
 *
 * ⚠️ E EXISTE UM TETO FÍSICO ACIMA DISTO, DECLARADO. Para ler a 9 px a letra
 * precisa de 30,5 m aos 5 km, 48,9 m aos 8 km e **67,2 m aos 11,8 km** (a
 * distância do spaceport). Os 67 m são um terço do diâmetro da esfera: ali não
 * há texto, há um caractere gigante. Além de 5,5 km quem carrega significado é o
 * ANEL: a cor da faixa, a respiração e o pulso de evento, que já existem e não
 * dependem de resolver letra. Ver a seção 5.1.
 */
const FX_LONGE_ESCALA = 16
/** margem do modo perto dentro da faixa nova; o de longe usa 8 */
const FX_MARGEM_PERTO = 18

/**
 * ⚠️ A LETRA MORRE POR PIXEL DE TELA, NÃO POR CONSTANTE DE PERFIL, E ATÉ 08/09
 * ERA O CONTRÁRIO. Defeito visto pelo fundador em produção: *"a esfera não tem
 * nada escrito, olhando pelo celular"*. Estava certo, e a causa é uma troca de
 * categoria.
 *
 * `uTextoDist` nascia de `p.textCull`, um campo GLOBAL de `perf.ts` calibrado
 * para a letra miúda da cidade (placa, rótulo, letreiro de rua). A letra desta
 * peça tem **16,84 m de altura**, a maior do projeto por uma ordem de grandeza.
 * Emprestar a constante da placa para ela erra, e erra muito.
 *
 * Medido, com `pxAng = fov / (altura_css · dpr)` e a letra grande de 16,84 m,
 * a distância em que ela cai a 9 px de tela (o MESMO critério que a tabela de
 * alcance de `SPHERE_FAIXA_LINHA0` publica):
 *
 *     tela                          alcance real   textCull do perfil   erro
 *     celular 844 css, dpr 1,5        3.232 m            600 m          5,4x
 *     **celular 844 css, dpr 2        4.309 m            600 m          7,2x**
 *     celular 844 css, dpr 3          6.463 m            600 m         10,8x
 *     desktop 1080, dpr 1             2.757 m          1.700 m          1,6x
 *
 * ⚠️ E O SINAL ESTAVA INVERTIDO, QUE É O PIOR DA HISTÓRIA. `perf.ts` corta mais
 * cedo no celular porque celular é mais fraco, e para fillrate isso é certo. Só
 * que legibilidade de texto vai com DENSIDADE DE PIXEL, e telefone tem dpr 2 ou
 * 3 contra o dpr 1 do monitor: o celular enxerga a letra MAIS LONGE, não menos.
 * A peça estava punindo justamente a tela que lê melhor.
 *
 * ⚠️ E CORRIGIR ISSO CUSTA ZERO DE FILLRATE. O `mix` do fragmento não pula as
 * buscas de textura: `conteudo` já é amostrado duas vezes antes, sempre, e o
 * corte só decide se o resultado vira `uCorFaixa`. Subir a distância não
 * acrescenta uma instrução sequer, só deixa de apagar o que já foi lido.
 *
 * O corte continua existindo, e pelo motivo que sempre teve: letra abaixo de um
 * punhado de pixels não vira texto, vira borra que cintila a cada passo da
 * câmera. O que muda é que agora ele é MEDIDO na tela de quem está olhando.
 */
export const SPHERE_TEXTO_PX = 9
/** 7 linhas de glifo x 8 linhas de LED x o passo do meridiano = 16,84 m */
export const SPHERE_LETRA_ALTURA = 7 * FX_GRANDE_ESCALA * (Math.PI * SPHERE_R / SPHERE_GRADE_ROWS)

/**
 * ⚠️ O TEXTO FECHA A VOLTA EXATA, e isso não é enfeite: um texto que não fecha
 * deixa uma emenda visível no meridiano, e a esfera não tem "costas" para
 * escondê-la. O avanço é de 8 pixels de glifo (5 de largura + 3 de vão, que é
 * vão generoso de propósito porque LED perde contraste entre traços vizinhos):
 *
 *     linha grande: 8 x 8 = 64 LEDs por caractere, 2048/64 = **32 caracteres**
 *                   letra de 5x7 glifos = **12,03 x 16,84 m**
 *     linha pequena: 8 x 4 = 32 LEDs por caractere, 2048/32 = **64 caracteres**
 *                   letra de **6,01 x 8,42 m**
 *
 * O alcance de leitura sai do pixel de glifo, que precisa de ~1,5 px de tela:
 * **2.362 m** para a linha grande, **1.181 m** para a pequena. Pelo critério
 * mais frouxo da altura da letra (9 px), **2.756 m** e **1.378 m**.
 *
 * ⚠️ NÃO ROLA. A doutrina de design da DogCity proíbe marquee, e a doutrina do
 * dado proíbe qualquer coisa que tiqueteie. O texto fica parado; quem gira é
 * quem olha.
 */
export const SPHERE_CHARS_GRANDE = SPHERE_GRADE_COLS / (8 * FX_GRANDE_ESCALA)   // 32
export const SPHERE_CHARS_PEQUENA = SPHERE_GRADE_COLS / (8 * FX_PEQUENA_ESCALA) // 64
export const SPHERE_CHARS_LONGE = SPHERE_GRADE_COLS / (8 * FX_LONGE_ESCALA)     // 16

/**
 * ⚠️ O ORÇAMENTO DE CARACTERES DO CONTEÚDO, e ele é apertado.
 *
 * De um azimute só não se lê a volta inteira. Medida a compressão da LARGURA da
 * letra (mesma conta da altura, na tangente de longitude), o arco em que ela
 * fica acima de 0,5 mede, na geometria de **196 m**:
 *
 *     150 m     56°     5,0 de 32 casas grandes, 10,0 de 64 pequenas
 *     200 m     73°     6,4 casas grandes, 12,9 pequenas
 *     300 m     89°     7,9 casas grandes, 15,7 pequenas
 *     **315 m   90°     8,0 casas grandes, 16,0 pequenas ← o ponto de projeto**
 *     400 m     96°     8,6 casas grandes, 17,1 pequenas
 *   1.000 m    111°     9,8 casas grandes, 19,7 pequenas
 *
 * ⚠️ E O ORÇAMENTO APERTOU COM A PEÇA MAIOR, não afrouxou, PORQUE ELE DEPENDE DE
 * `d/R` E NÃO DE `d`. Esfera maior significa que, à mesma distância, se enxerga
 * uma fatia MENOR da circunferência: o mesmo 7/15 que fechava a 257 m com 160 m
 * de esfera só fecha a **315 m** com 196. O orçamento em CARACTERES não muda; o
 * que anda é a distância em que ele fecha, e ela anda proporcional a R.
 *
 * ⚠️ E A REGRA "JANELA ≥ PERÍODO" DO DOSSIÊ ESTAVA ERRADA, medida em 07/09.
 * `repetirNaVolta()` distribui `floor(nChars/(len+1))` cópias de período
 * `nChars/cópias`; para a janela conter uma cópia INTEIRA em QUALQUER azimute a
 * condição é `janela ≥ período + comprimento`, não `janela ≥ período`. Com 7
 * caracteres o período é 8 casas e a condição pede 15, e a janela nunca passa de
 * ~10 casas em distância nenhuma. Medido por azimute, com a janela de 8,0 casas
 * dos 315 m:
 *
 *     cópia inteira à vista              13% dos azimutes
 *     cortada na FRENTE (falta o 1º)     44%
 *     cortada atrás (falta o último)     44%
 *     pior azimute                       3,5 dos 7 caracteres
 *
 * ⚠️ ENTÃO A GARANTIA NÃO É GEOMÉTRICA, É TIPOGRÁFICA, e é por isso que ela mora
 * no formato e não aqui. Duas travas, as duas em `sphere-conteudo.ts`:
 * `repetirNaVolta` separa as cópias com `·` em vez de vão vazio, de modo que uma
 * cópia cortada se ANUNCIA cortada em vez de virar outro número; e `fmtPreco`
 * paga um algarismo para manter o zero da frente, porque `.001126` sem o
 * primeiro caractere lê `001126` e `0.00113` sem ele lê `.00113`.
 *
 * A linha grande carrega o VALOR e a pequena o RÓTULO, e não o contrário: valor
 * é curto e precisa ser visto de todo lado. Texto mais longo continua
 * funcionando, mas vira faixa de leitura por setor (lados diferentes da esfera
 * dizem coisas diferentes), que é uma decisão de conteúdo e não um acidente.
 */
export const SPHERE_ARCO_LEGIVEL_GRAUS = 90
export const SPHERE_ORCAMENTO_DIST_M = 315
export const SPHERE_ORCAMENTO_GRANDE = 7
export const SPHERE_ORCAMENTO_PEQUENA = 15

// ═══════════════════════════════════════════════════════════════════════════
// 3. A FONTE 5x7
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A MESMA matriz 5x7 do letreiro do Estádio e da Torre Central, não uma fonte
 * nova. A tabela canônica em TypeScript vive em
 * `app/dogcity/sections/construction-fund.tsx:209` (que por sua vez reimplementa
 * a de `blender/build_central_tower.py:339`); ela é `const` de módulo dentro de
 * um componente de cliente da landing, então não dá para importar de uma peça de
 * cena. O que se reusa é a MATRIZ, linha por linha, idêntica, mais os símbolos
 * que preço e altura de bloco exigem (`$ : / + #`).
 *
 * ⚠️ A TABELA É SÓ CAIXA ALTA. Nunca alimentar com dado onde a caixa signifique
 * algo.
 */
const GLIFOS: Record<string, string> = {
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11111/00010/00100/00010/00001/10001/01110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/11110/00001/00001/10001/01110',
  '6': '00110/01000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00010/01100',
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01110/10001/10000/10000/10000/10001/01110',
  D: '11100/10010/10001/10001/10001/10010/11100',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01110/10001/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '01110/00100/00100/00100/00100/00100/01110',
  J: '00111/00010/00010/00010/00010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/10001/11001/10101/10011/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/11011/10001',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '.': '00000/00000/00000/00000/00000/01100/01100',
  ',': '00000/00000/00000/00000/01100/01100/11000',
  '%': '11001/11010/00010/00100/01000/01011/10011',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '·': '00000/00000/00000/01100/01100/00000/00000',
  '●': '00000/01110/11111/11111/11111/01110/00000',
  // ── acrescentados aqui, que preço e altura de bloco pedem ──────────────
  $: '00100/01111/10100/01110/00101/11110/00100',
  ':': '00000/01100/01100/00000/01100/01100/00000',
  '/': '00001/00010/00010/00100/01000/01000/10000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '#': '01010/01010/11111/01010/11111/01010/01010',
}

/** cada glifo vira 5 colunas de máscara de 7 bits, uma vez, na carga do módulo */
const FONTE: Map<string, number[]> = (() => {
  const m = new Map<string, number[]>()
  for (const ch of Object.keys(GLIFOS)) {
    const linhas = GLIFOS[ch].split('/')
    const cols: number[] = []
    for (let c = 0; c < 5; c++) {
      let mask = 0
      for (let r = 0; r < 7; r++) if (linhas[r][c] === '1') mask |= 1 << r
      cols.push(mask)
    }
    m.set(ch, cols)
  }
  return m
})()

// ═══════════════════════════════════════════════════════════════════════════
// 4. A PALETA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ `#E8660D` PARA O DADO, e nunca o lava `#F56E0F`. A regra é da casa
 * (`project_chart_palette`): o lava está fora da banda de luminosidade escura e
 * lê como anúncio; a Sphere é instrumento primeiro e outdoor depois.
 *
 * ⚠️ VERDE É SÓ STATUS, NUNCA VALOR. Nada de vermelho e verde para preço: é
 * estética de corretora e o projeto inteiro evita esse registro. `COR_STATUS`
 * existe declarada para quando a próxima frente precisar de um sinal de "ao
 * vivo", e não deve encostar em número.
 *
 * ⚠️ ROXO É BANIDO.
 */
const COR_DADO = '#E8660D'
/** ⚠️ O RÓTULO SAIU DO CREME EM 08/09, E ISTO É SUPOSIÇÃO MINHA, DECLARADA. O
 *  fundador padronizou "cinza chumbo com letras laranjas"; ele não falou da
 *  linha pequena. `#C6BFB1` era o creme quente do piso da praça, e numa peça
 *  agora neutra ele era o único resto de calor que não é o dado. Passou a um
 *  cinza claro neutro de MESMA luminância (0,524), então a hierarquia entre
 *  valor e rótulo não mudou em nada: o que mudou é que o calor da peça é
 *  exclusividade do laranja. Se a intenção era o rótulo laranja também, é
 *  trocar esta linha por `COR_DADO`. */
const COR_ROTULO = '#BEC0C3'
const COR_STATUS = '#3E7F52'   // reservado a status; JAMAIS a valor
/**
 * O LED apagado.
 *
 * ⚠️ CINZA-GRAFITE, NÃO PRETO, e o primeiro valor (`#15161A`) foi corrigido
 * depois de renderizar a peça fora do navegador: ele lia como BURACO no relevo
 * em vez de objeto, porque um painel de LED real reflete 5 a 8% e `#15161A` em
 * linear é 0,007, ou seja abaixo disso. `#2A2C33` dá 0,027 em linear, que com o
 * termo de sol e o realce de borda fecha num grafite que tem volume contra o céu
 * preto da Lua sem competir com o dado.
 */
/** ⚠️ O LED APAGADO, TAMBÉM NEUTRALIZADO EM 08/09. Ele era `#2A2C33` e carregava
 *  o mesmo viés azul do corpo; como ele multiplica a luz da cena em TODO
 *  fragmento da casca, o viés dele tingia a peça inteira mesmo com o conteúdo
 *  neutro. Mesma luminância linear, croma neutra. */
const COR_PAINEL = new THREE.Color('#2C2C2D')
const COR_PISO = new THREE.Color('#B4AC9E')
const COR_PLINTO = new THREE.Color('#4A4A52')

// ═══════════════════════════════════════════════════════════════════════════
// 5. O CONTEÚDO: a interface que a próxima frente vai ligar no dado vivo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O que a esfera está mostrando AGORA.
 *
 * ⚠️ ESTE É O CONTRATO, E O SISTEMA DE CONTEÚDO NÃO NASCE AQUI. Nesta rodada
 * entra conteúdo estático plausível, só para provar o shader. A frente seguinte
 * liga a grade de conteúdo (PREÇO, VOLUME, PULSO, SNAPSHOT), os três eventos
 * (transação para a carteira, bloco BTC minerado, mint de terreno) e o intervalo
 * comercial, chamando `pintar()` quando o dado mudar. Nada aqui roda por quadro.
 */
export interface SphereConteudo {
  /** a linha de cima da faixa; até 32 caracteres, caixa alta */
  grande: string
  /** a linha de baixo; até 64 caracteres, caixa alta */
  pequena: string
  /**
   * 0 = ocioso sóbrio, 1 = intervalo comercial no talo.
   *
   * ⚠️ É ESTE CONTRASTE QUE SEPARA MARCO DE CIDADE DE BOLA DE DISCOTECA. O
   * estado normal da peça é o sóbrio; quem sobe de saturação é o anúncio, e a
   * proporção de tempo entre dado e propaganda tem de ser garantida no CÓDIGO,
   * não em política comercial (anúncio paga e dado não, e essa pressão esvazia a
   * diferenciação sozinha).
   */
  ganho?: number
  /** a cor do dado; o padrão é `#E8660D` e mudar isso pede motivo */
  cor?: string
  /** cor da linha pequena, o rótulo */
  corRotulo?: string
  /**
   * Pintura livre no resto da esfera (polos e corpo), em coordenadas de TEXTURA.
   * É por aqui que a peça de um parceiro entra: recebe o contexto já limpo e as
   * dimensões, e a faixa é desenhada POR CIMA depois.
   *
   * ⚠️ Os polos ficam só para cor: escorço de perspectiva torna letra ilegível
   * lá, e a conta está em `SPHERE_FAIXA_LINHA0`.
   */
  pintarCorpo?: (g: CanvasRenderingContext2D, w: number, h: number) => void
}

/**
 * O conteúdo com que a peça NASCE, antes de o programa de conteúdo falar.
 *
 * ⚠️ ELE NÃO TEM NÚMERO, E ISSO É CONSERTO DE DEFEITO DE PRODUÇÃO. Até 07/09
 * esta constante era `{ grande: '0.00042', pequena: '$DOG USD SPOT' }`, um preço
 * de teste cravado com o rótulo de preço de verdade em cima. O fundador viu a
 * peça no ar e disse que *"o preço do DOG lá está errado"*: estava, e não por
 * pouco, porque o valor real da rota naquele dia era **0,001126**, ou seja 2,7
 * vezes o que o telão dizia. Número inventado com rótulo verdadeiro numa peça de
 * 196 m é a pior falha possível desta casa.
 *
 * ⚠️ E A REGRA VALE PARA SEMPRE: **esta constante não escreve valor**. Quem
 * escreve valor é `sphere-conteudo.ts`, contra rota, com validade. O que nasce
 * aqui é o mesmo ESTADO NEUTRO que o programa usa quando nenhuma fonte está
 * fresca: a identidade da peça e nada mais. Ela vive por poucos quadros (a cena
 * chama `repintar()` no instante em que a esfera entra), e mesmo assim não pode
 * mentir nesses quadros.
 *
 * ⚠️ GANHO 0,42 É O ESTADO OCIOSO, e ele é sóbrio de propósito. É o contraste
 * entre este número e o do intervalo comercial que separa marco de cidade de
 * bola de discoteca.
 */
export const SPHERE_CONTEUDO_NEUTRO: SphereConteudo = {
  grande: 'DOGCITY',
  pequena: 'THE SPHERE',
  ganho: 0.42,
}

// ═══════════════════════════════════════════════════════════════════════════
// 5.1 A VIDA DE LONGE: o requisito de "ela nunca morre"
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ REQUISITO ESCRITO DO FUNDADOR, 07/09: *"nela vamos precisar gastar
 * orçamento visual, pois ela e seus detalhes devem ser vistos de qualquer lugar,
 * mesmo que só parte, mas ela não pode desaparecer por completo em momento
 * nenhum"*, com o limite *"196 com algo LEVE aparecendo em qualquer lugar que
 * ela seja vista"*.
 *
 * ⚠️ O DEFEITO QUE ISSO CORRIGE É REAL E ESTAVA MEDIDO. Além do `textCull` (600
 * a 1.700 m conforme o perfil) o texto desvanece, e além de `lodDistance` (298 a
 * 381 m no perfil fraco) a casca troca para o material liso. Dali para fora a
 * peça só se mexia quando o QUADRO trocava, ou seja de 16 em 16 segundos, em
 * degrau. Uma esfera de 196 m que é o marco da cidade não pode ser bola parada
 * em 4 das 5 configurações de perfil.
 *
 * ⚠️ E A CORREÇÃO NÃO É LIGAR O SHADER CARO DE LONGE, é fazer o modo BARATO
 * continuar vivo. Tudo isto é **um uniforme** (`uVida`) que multiplica só a
 * FAIXA, calculado na CPU dentro do `update()` que já roda por quadro:
 *
 *   · no fragmento cheio custa `mix` + `mul` = 2 instruções sobre ~70 ALU e
 *     2 buscas de textura, ou seja **~3% do shader**;
 *   · no fragmento LISO custa as mesmas 2 sobre ~40 ALU, **~5%**;
 *   · na CPU custa um `Math.sin` e três comparações por quadro, dentro de uma
 *     função que já existia;
 *   · **zero** textura nova, **zero** varying novo, **zero** chamada de desenho.
 *
 * Por que a FAIXA e não a casca inteira: de longe é ela que sobra depois do
 * `textCull`, e ela continua sendo a parte ACESA da peça por construção.
 *
 * ⚠️ O NÚMERO QUE ESTAVA AQUI (4,01x a média da esfera) VIROU O NÚMERO ERRADO EM
 * 07/09, quando o corpo passou a ler como painel ligado (ver `pintarTextura`). A
 * razão faixa/esfera COM TEXTO nunca foi uma constante desta seção: ela é MEDIDA
 * do canvas a cada repintura, por `mediaDe`, e acompanha o conteúdo do quadro. O
 * que este comentário pode fixar é o CHÃO da faixa contra o corpo em volta, e
 * esse subiu de **1,03x para 1,84x**: antes o anel só existia por causa da letra,
 * agora ele existe sem ela, que é exatamente o que este requisito pede.
 * A 3 km a esfera é um disco de 96 px e a faixa mede 14,8 px dele; da praça
 * central (5.175 m) são 56 px de disco e 8,6 px de faixa. É esse anel que se
 * mexe.
 */

/**
 * A RESPIRAÇÃO DO ANEL, no estado ocioso.
 *
 * ⚠️ 0,083 Hz, E ESSE NÚMERO É O LIMITE DE GOSTO, NÃO UMA PREFERÊNCIA. Um ciclo
 * de 12 s é uma ordem de grandeza abaixo de qualquer coisa que o olho leia como
 * piscada (a percepção de cintilação começa perto de 3 Hz), então isto é uma
 * maré e não um estroboscópio. É o contraste entre ocioso sóbrio e evento que dá
 * o efeito, e é isso que separa marco de cidade de bola de discoteca.
 */
export const SPHERE_VIDA_PERIODO_MS = 12_000
/**
 * A amplitude, e ela é MENOR DE PERTO de propósito.
 *
 * ⚠️ DE PERTO A FAIXA É O INSTRUMENTO, e um instrumento não respira: ali o que
 * se mexe é o dado. A amplitude cheia (0,16) só vale além de `textCull`, onde a
 * letra já morreu; dentro da distância de leitura ela cai para um quarto disso
 * (0,04), que é imperceptível sobre o número e ainda assim cumpre o "em qualquer
 * lugar". A rampa é calculada na CPU, então não custa instrução de shader.
 */
export const SPHERE_VIDA_AMP = 0.16

/**
 * O PULSO DE EVENTO, e ele é a razão de a peça existir atravessando a distância.
 *
 * Bloco minerado, compra para a carteira da cidade e mint são raros (144 blocos
 * por dia, compra mais rara ainda) e são o motivo de a Sphere estar de pé. O
 * conteúdo deles já entra na faixa, mas texto morre no `textCull`: de 3 km
 * ninguém leria `#965501`. Um swell de brilho no anel, ao contrário, chega.
 *
 * ⚠️ UM SWELL, NÃO UMA PISCADA: sobe em 600 ms, desce em 2,6 s, uma vez por
 * evento, pico de **1,85x** no anel. Para comparar, o intervalo comercial é
 * 2,14x do ocioso o TEMPO TODO. Ou seja o evento levanta a voz por três segundos
 * e o anúncio fala alto por 72: quem grita continua sendo o anúncio, e o evento
 * continua sendo notícia.
 */
export const SPHERE_PULSO_AMP = 0.85
export const SPHERE_PULSO_SOBE_MS = 600
export const SPHERE_PULSO_MS = 3_200

// ═══════════════════════════════════════════════════════════════════════════
// 6. O SHADER DE LED
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ OS TRECHOS DE LOG-DEPTH SÃO OBRIGATÓRIOS. O renderizador da praça liga o
 * buffer logarítmico (`plaza-scene.tsx:904`) e um `ShaderMaterial` cru que não
 * inclua estes trechos escreve profundidade na escala ERRADA: some ou fura tudo.
 *
 * ⚠️ E A POSIÇÃO DE VISTA TEM DE SE CHAMAR `mvPosition`. A atmosfera da cena
 * REMENDA os chunks de névoa (`atmosfera.ts:143`) e o `fog_vertex` remendado lê
 * uma variável com esse nome para calcular `vFogAr`. Escrever `vFogDepth` à mão,
 * como a abóbada faz, deixaria `vFogAr` indefinido e a esfera fora da atmosfera
 * do resto da cidade. Aqui a mistura é opaca, então dá para usar os chunks
 * inteiros, que é o caminho certo.
 */
const VS = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  uniform vec3 uCam;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vW;
  varying float vD;
  void main() {
    vP = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vD = distance(wp.xyz, uCam);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
  }`

/**
 * ⚠️ A ROTA PREGUIÇOSA É TEXTURA ESTICADA, E ELA PRODUZ ESFERA PINTADA. O que
 * faz a peça ler como TELA é o padrão de ponto nascer no fragmento, e é isso que
 * está aqui. Quatro decisões carregam o shader:
 *
 * 1. **O TAMANHO DO PONTO NA TELA É ANALÍTICO, NÃO `fwidth`.** A longitude sai
 *    de `atan(p.z, p.x)`, que tem costura em ±π: `fwidth` explode exatamente ali
 *    e desenharia uma linha de erro no meridiano, na esfera inteira, para
 *    sempre. A conta certa não precisa de derivada: um LED mede `uPasso` metros,
 *    está a `vD` metros do olho e a tela tem `uPxAng` radianos por pixel, então
 *    ele ocupa `uPasso · face / (vD · uPxAng)` pixels, onde `face` é o
 *    encurtamento junto à silhueta (`|n̂·v̂|`). Sem costura, sem quadrado de
 *    derivada, e é a MESMA conta que a tabela de `SPHERE_PASSO` documenta.
 *
 * 2. **A MÁSCARA DESVANECE PARA A PRÓPRIA MÉDIA, E ISSO CONSERVA ENERGIA.** Com
 *    o ponto grande na tela, `sinal` vale `1/preenchimento ≈ 1,99` dentro do
 *    disco e 0 no vão: é o comportamento físico de um puck, que é mais brilhante
 *    que a média do painel. Com o ponto abaixo de um pixel, `sinal` vale 1,0
 *    liso. A média é a mesma nas duas pontas, então a esfera não muda de brilho
 *    ao se afastar: ela só perde a granulação. É isso que faz os 3 km lerem como
 *    ponto de luz sem cintilar, que é o que fisicamente acontece.
 *
 * 3. **AS COLUNAS CAEM POR OITAVA DE LATITUDE.** Numa grade equiretangular pura
 *    a célula estreita com `cos(lat)` e vira agulha no polo: aliasing garantido
 *    justamente onde ninguém olha. Dobrando a largura da célula a cada oitava de
 *    `cos(lat)` ARREDONDADA (não truncada, ver a nota no shader), a célula fica
 *    sempre entre 0,707 e 1,414 de quadrada, que é
 *    exatamente como um globo de painéis de LED é construído de verdade (menos
 *    painéis por anel perto do polo).
 *
 * 4. **DUAS AMOSTRAS DA MESMA TEXTURA, com regimes de LOD diferentes.** A
 *    amostra "nítida" usa a UV encaixada no centro da célula, o que quantiza o
 *    conteúdo por LED e é o que dá a leitura de painel; encaixada, a derivada da
 *    UV vale um texel dentro da célula e o LOD dá ~0, que é o certo de perto. A
 *    amostra "suave" usa a UV contínua e deixa o mipmap fazer a média correta de
 *    longe. A mistura entre as duas usa um limiar PRÓPRIO (`kc`), mais tardio
 *    que o do ponto, senão a amostra encaixada entraria com peso enquanto ainda
 *    é LOD 0 sobre textura de 2.048 e traria de volta o serrilhado que o mipmap
 *    tinha acabado de resolver.
 */
const FS = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <fog_pars_fragment>
  uniform sampler2D uConteudo;
  uniform vec2 uGrade;
  uniform float uPasso;
  uniform float uPxAng;
  uniform float uGanho;
  uniform float uVida;
  uniform float uRaioPonto;
  uniform float uPreenche;
  uniform float uAA;
  uniform float uTextoDist;
  uniform vec2 uFaixaV;
  uniform vec3 uCorFaixa;
  uniform vec3 uCam;
  uniform vec3 uSol;
  uniform vec3 uSolCor;
  uniform vec3 uAmb;
  uniform vec3 uPainel;
  varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vD;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 p = normalize(vP);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    // ⚠️ A LONGITUDE ENTRA NEGADA, E ISSO E CONSERTO DE DEFEITO MEDIDO: com
    // lon/2pi + 0.5 o texto sai ESPELHADO, e nao um pouco, e sim de tras para
    // frente ("0.00042" lia "24000.0"). Visto de FORA da esfera, um observador
    // em -x tem a direita da tela em +z, e ali atan(p.z, p.x) DECRESCE; entao
    // o u tem de decrescer com a longitude para o texto correr para a direita.
    // Achado renderizando a peca fora do navegador, com tracador de raio proprio.
    vec2 uv = vec2(0.5 - lon * 0.15915494, lat * 0.31830989 + 0.5);

    // celula quadrada tambem perto do polo: colunas por oitava de cos(lat).
    // ⚠️ O +0.5 E O CONSERTO DE UMA MEDICAO: com floor() puro a celula ia de
    // 0,500 a 1,000 de quadrada (pior caso logo ABAIXO de lat 60, medido), ou
    // seja meia celula de largura, que e o aliasing que a oitava veio evitar.
    // Arredondando em vez de truncar, a razao fica entre 0,707 e 1,414.
    float cosLat = max(cos(lat), 0.015625);
    float cols = uGrade.x / exp2(floor(-log2(cosLat) + 0.5));

    // tamanho de UM LED na tela, em pixels, sem derivada (ver nota 1)
    vec3 v = normalize(uCam - vW);
    float face = max(abs(dot(normalize(vN), v)), 0.05);
    float ledPx = uPasso * face / max(vD * uPxAng, 1e-6);

    float k = smoothstep(1.0, 2.6, ledPx);     // o ponto aparece
    float kc = smoothstep(1.8, 3.2, ledPx);    // o conteudo encaixa no LED

    // o disco, com a borda suavizada por ~meio pixel de tela
    vec2 cel = vec2(uv.x * cols, uv.y * uGrade.y);
    float d = length(fract(cel) - 0.5);
    float aa = clamp(uAA / max(ledPx, 0.001), 0.02, 0.5);
    float disco = 1.0 - smoothstep(uRaioPonto - aa, uRaioPonto + aa, d);
    float sinal = mix(uPreenche, disco, k) / uPreenche;

    // conteudo: nitido por celula de perto, mipmap de longe
    vec2 uvEncaixe = (floor(cel) + 0.5) / vec2(cols, uGrade.y);
    vec3 conteudo = mix(texture2D(uConteudo, uv).rgb,
                        texture2D(uConteudo, uvEncaixe).rgb, kc);

    // ⚠️ O TEXTO SOME NO textCull DO PERFIL, e vira faixa acesa lisa. E a razao
    // e a mesma que criou o campo em perf.ts: letra abaixo de um punhado de
    // pixels nao vira texto, vira borra que cintila a cada passo da camera.
    float naFaixa = step(uFaixaV.x, uv.y) * step(uv.y, uFaixaV.y);
    conteudo = mix(conteudo, uCorFaixa,
                   naFaixa * smoothstep(uTextoDist * 0.75, uTextoDist * 1.15, vD));

    // ⚠️ O PAINEL APAGADO LE A LUZ DA CENA, NAO UMA CONSTANTE INVENTADA. A
    // primeira versao tinha 0.16 + 0.55*sol cravado no shader e a esfera
    // ficava fora do ciclo de dia da cidade: de dia lia como buraco preto no
    // relevo e de noite continuava igual. uAmb e uSolCor vem de fora, por
    // iluminar(), e o padrao ja e um dia lunar plausivel.
    // ⚠️ E O REALCE DE BORDA NAO E ENFEITE: contra o ceu preto da Lua, uma
    // esfera escura sem borda perde a silhueta e vira recorte. Um pow resolve.
    float sol = max(dot(normalize(vN), uSol), 0.0);
    float borda = pow(1.0 - face, 3.0);
    // ⚠️ uVida MULTIPLICA SO A FAIXA, e e o requisito de "ela nunca morre"
    // (ver SPHERE_VIDA_*). Duas instrucoes: a respiracao do anel e o pulso de
    // evento vivem inteiros num uniforme calculado na CPU, entao valem igual
    // aqui e no material liso, que e onde a peca virava bola parada.
    vec3 cor = uPainel * (uAmb + uSolCor * sol + borda * 1.5)
             + conteudo * (sinal * uGanho * mix(1.0, uVida, naFaixa));
    gl_FragColor = vec4(cor, 1.0);
    #include <fog_fragment>
  }`

/**
 * ⚠️ O MATERIAL LISO É O DEGRAU DE FILLRATE, e ele existe medido. A conta está
 * em `sphereCusto()`: a 300 m a esfera ocupa **36,4° do campo e 35,1%** de uma
 * tela de 1080p, e **100% da tela de um celular** de 390 x 844 em dpr 1,5 (eram
 * 29,9°, 23,4% e 90,0% com a esfera de 160: crescer para 196 custa **50% mais
 * fragmento à mesma distância**, porque o fillrate vai com R², e é no celular
 * que a conta aparece). Cada um desses fragmentos roda o shader completo (duas
 * buscas de textura, um `atan`, um `asin`, dois `log2`).
 *
 * Então no perfil fraco, além da distância de leitura, a casca troca para ESTE
 * material: mesma cor, mesmo brilho, mesma forma no sol, zero textura, ~40 ALU.
 * Não é "sumir": a peça continua inteira, o que sai é o detalhe.
 *
 * ⚠️ E ELE NÃO É MAIS UM MODO PARADO. Era, e era esse o defeito que o fundador
 * apontou: de 298 m para fora, no celular, a peça virava bola lisa. Agora o
 * `uVida` da seção 5.1 vale aqui também, pelo mesmo uniforme e por um `mul` a
 * mais, então o anel respira e o evento pulsa no modo BARATO. É o modo barato
 * que precisava ficar vivo, não o caro que precisava ser ligado de longe.
 */
const FS_LISO = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <fog_pars_fragment>
  uniform float uGanho;
  uniform float uVida;
  uniform vec3 uCam;
  uniform vec3 uSol;
  uniform vec3 uSolCor;
  uniform vec3 uAmb;
  uniform vec3 uPainel;
  uniform vec3 uMedia;
  uniform vec3 uCorFaixa;
  uniform vec2 uFaixaV;
  varying vec3 vP; varying vec3 vN; varying vec3 vW; varying float vD;
  void main() {
    #include <logdepthbuf_fragment>
    // ⚠️ MESMA CONTA DE PAINEL DO SHADER CHEIO, TERMO A TERMO. Se as duas
    // divergirem, a peca MUDA DE COR ao cruzar o degrau de fillrate, e o degrau
    // passa a ser visivel: e exatamente o que ele nao pode ser.
    vec3 n = normalize(vN);
    float sol = max(dot(n, uSol), 0.0);
    float borda = pow(1.0 - max(abs(dot(n, normalize(uCam - vW))), 0.05), 3.0);
    // A FAIXA SOBREVIVE, e proceduralmente: um asin e dois smoothstep, zero
    // textura. Sem isto a troca de material APAGA o anel aceso, que e a unica
    // assinatura da peca a essa distancia, e o degrau vira um estalo visivel.
    // A borda usa smoothstep e nao step porque a 2,6 km a faixa mede ~14 px e
    // uma aresta dura ali serrilha a cada passo da camera.
    float v = asin(clamp(normalize(vP).y, -1.0, 1.0)) * 0.31830989 + 0.5;
    float meio = (uFaixaV.x + uFaixaV.y) * 0.5;
    float meia = (uFaixaV.y - uFaixaV.x) * 0.5;
    float naFaixa = 1.0 - smoothstep(meia * 0.75, meia * 1.15, abs(v - meio));
    // ⚠️ E A VIDA MORA AQUI TAMBEM, com o MESMO uniforme e a mesma conta: e
    // justamente neste material que a peca ficava parada, porque ele e o que o
    // perfil fraco usa de 298 m para fora. Um mul a mais num shader de ~40 ALU.
    gl_FragColor = vec4(uPainel * (uAmb + uSolCor * sol + borda * 1.5)
                        + mix(uMedia, uCorFaixa * uVida, naFaixa) * uGanho, 1.0);
    #include <fog_fragment>
  }`

// ═══════════════════════════════════════════════════════════════════════════
// 7. O PERFIL, LIDO CAMPO A CAMPO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ ESTA CASA JÁ TEVE DUAS VEZES O DEFEITO DE UM MÓDULO RECEBER O `PerfProfile`
 * E NUNCA LER NADA DELE, então o que este módulo lê e o que ele NÃO lê está
 * escrito, campo a campo, e é conferível:
 *
 *   LIDOS
 *   · `tier`         segmentos da malha e se o material liso está armado
 *   · `quality`      idem, e a suavização da borda do ponto
 *   · `cortaTextura` escolhe o lado BASE da textura de conteúdo (2.048 ou
 *                    1.024). É o campo certo por definição: `perf.ts` diz que
 *                    `texLado` "não enxerga família" e que quem troca por
 *                    arquivo menor "precisa decidir por CONTEÚDO". Aqui o
 *                    conteúdo é justamente o que dá para servir mais grosso.
 *   · `texLado`      teto duro por cima dessa escolha, com os DOIS lados
 *                    escalados pelo mesmo fator (a textura é 2:1)
 *   · `textCull`     ⚠️ SÓ COMO SEMENTE, desde 08/09. Ele preenche `uTextoDist`
 *                    no boot e é sobrescrito no PRIMEIRO `update()` pela
 *                    distância MEDIDA na tela (ver `SPHERE_TEXTO_PX`). Ele é um
 *                    campo global calibrado para letra miúda de placa, e a letra
 *                    desta peça tem 16,84 m: no celular ele errava por 7,2x e
 *                    deixava a esfera sem nada escrito, que foi o que o fundador
 *                    viu em produção. Não volte a mandar nele.
 *   · `lodDistance`  teto da distância em que o material liso entra
 *   · `maxPixelRatio` piso do tamanho do pixel de tela quando o chamador não
 *                    passa `uPxAng` medido: tela mais densa lê o ponto de mais
 *                    longe, e isso é físico
 *   · `smallCull`    o mobiliário da praça some além dele (o EMBASAMENTO não:
 *                    ele é silhueta, ver a nota em `construirPodio`)
 *   · `antialias`    sem MSAA a borda do disco precisa de mais suavização
 *   · `shadowMapSize`, `softShadows`  decidem se a peça projeta sombra
 *
 *   NÃO LIDOS, e por quê
 *   · `censusPoints`, `jetParticles`, `crystalLod`, `parkDetailCull`, `domeCell`
 *     são de outras peças (censo, fontes, parque, abóbada) e não têm análogo aqui
 *   · `shadowUpdateEvery` e `minPixelRatio` são do `FrameGovernor`, que é global
 *   · `quality === 'high'` não liga nada exclusivo além dos segmentos: a peça já
 *     roda o shader completo em todo perfil dentro da distância de leitura, e
 *     inventar um modo a mais seria custo sem imagem
 */
export interface SphereEscalonamento {
  segW: number
  segH: number
  texW: number
  texH: number
  /** distância além da qual a casca troca para o material liso; Infinity = nunca */
  distLiso: number
  /** distância em que a letra desvanece */
  distTexto: number
  /** distância em que o mobiliário da praça some. ⚠️ O EMBASAMENTO NÃO OBEDECE:
   *  ele tem 204,2 m de diâmetro e é silhueta, não mobiliário. */
  distMiudo: number
  /** suavização da borda do disco, em pixels de tela */
  aa: number
  projetaSombra: boolean
}

export function sphereEscalonamento(p: PerfProfile): SphereEscalonamento {
  // ── malha ──────────────────────────────────────────────────────────────
  // ⚠️ TRIÂNGULO NÃO É O VILÃO AQUI, e a conta prova: com 128 gomos no equador
  // a flecha da corda mede R·(1−cos(1,406°)) = **2,95 cm** numa esfera de 98 m
  // de raio, ou seja invisível de qualquer distância. O que custa é FILLRATE.
  // Por isso a malha é generosa e barata, e quem escalona é o fragmento.
  const alta = p.quality === 'high'
  const segW = p.tier === 'mobile' ? 96 : alta ? 160 : 128
  const segH = Math.round(segW / 2)

  // ── textura de conteúdo ────────────────────────────────────────────────
  // ⚠️ E O TETO ESCALA OS DOIS LADOS PELO MESMO FATOR. A textura é 2:1 (grade
  // equiretangular) e `perf.ts` avisa: "um atlas retangular tem os DOIS lados
  // escalados pelo mesmo fator, senão o quadro de cada célula dele deforma".
  const baseW = p.cortaTextura ? 1024 : 2048
  const fator = p.texLado(baseW) / baseW
  const texW = Math.round(baseW * fator)
  const texH = Math.round((baseW / 2) * fator)

  // ── o degrau de fillrate ───────────────────────────────────────────────
  // A distância em que o padrão de ponto encosta em 1 px de tela é
  // `uPasso / uPxAng`, calculada por quadro em `update()`. Aqui fica só o TETO
  // do perfil: no fraco, o `lodDistance` limita; no forte, nunca troca.
  const fraco = p.tier === 'mobile' || p.quality === 'low'
  const distLiso = fraco ? p.lodDistance : Infinity

  return {
    segW, segH, texW, texH, distLiso,
    distTexto: p.textCull,
    distMiudo: p.smallCull,
    // sem MSAA a borda do disco serrilha; com MSAA meio pixel basta
    aa: p.antialias ? 0.5 : 0.85,
    // ⚠️ A PEÇA NÃO PROJETA SOMBRA POR PADRÃO, e não é economia: ela está a
    // 5.117 m do centro e a câmera de sombra da cena não alcança esse raio, então
    // ligar `castShadow` gastaria um passe e não desenharia nada. Fica atrás dos
    // dois campos certos para o dia em que a sombra ganhar cascata.
    projetaSombra: p.softShadows && p.shadowMapSize >= 2048 && p.quality === 'high',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. O SÍTIO NA TEIA (mesma disciplina do Geode e do Estádio)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ A ESFERA MUDOU DE ENDEREÇO EM 08/09: ELA É A QUARTA ÂNCORA DA PRAÇA CENTRAL.
 *
 * Decisão do fundador: *"a esfera vai sair de onde ela está e vai completar a
 * praça central, sendo o quarto prédio ali, onde hoje tem uma fonte"*. A vaga já
 * estava reservada no código, e literalmente escrita assim em `precinct.ts`:
 * `north: { pos: (0, PRACA_Y, -R_ANCHOR) }, // jardim, por enquanto`. As outras
 * três âncoras do anel r 620 são a BitFlow a oeste, a Kray a leste e o Chalé ao
 * sul; o norte era a Grande Fonte segurando o lugar.
 *
 * ⚠️ O QUE MORREU COM A MUDANÇA, e é bom saber antes de procurar: `SPHERE_MOD`
 * e toda a varredura da teia que escolheu aquele módulo (folga contra bulevar,
 * anel, autopista, eclusa, água e as 70 peças de `cidade.json`). O anel da teia
 * começa em r 1.900 e o precinto acaba em r 900: a peça saiu do domínio da teia
 * e entrou no da praça, onde quem manda é `precinct.ts`. A constante fica
 * declarada logo abaixo, sem uso, porque a conta que ela carrega é a memória de
 * como se escolhe um sítio nesta cidade, e ela vai ser precisa de novo.
 *
 * ⚠️ E O GIRO É O DA ÂNCORA, não o rumo do módulo. `ANCHORS.north.rotY` é π (a
 * frente olha para o centro da praça, ou seja para +z). Como a esfera é sólido
 * de revolução, o giro não muda a casca: ele existe para o deck, o jardim e as
 * escadarias, que têm frente.
 */
export function sphereSitio(): { x: number; z: number; rumoDeg: number } {
  return { x: 0, z: -R_ANCHOR, rumoDeg: 180 }
}

/**
 * O AVENTAL da esfera na praça, um quadrado centrado na âncora.
 *
 * ⚠️ ELE SUBSTITUI O TABULEIRO DA TEIA, que era o quadrilátero do módulo
 * (229,6 x 254,2 m, com saia até o relevo). Na praça não existe módulo nem
 * relevo: o chão do precinto é laje construída e PLANA em `PRACA_Y`, então não
 * há terraplenagem, não há talude e não há saia. O que sobra é o avental que o
 * jardim precisa para existir, e ele é QUADRADO porque a esfera é de revolução
 * e o anel viário do precinto é concêntrico: qualquer torção que o dodecágono da
 * teia impunha desapareceu junto com o módulo.
 *
 * ⚠️ 254,2 m DE LADO, E O NÚMERO É HERANÇA DELIBERADA: é o lado maior do deck
 * antigo. Manter a medida faz o jardim que o `sphere-jardim-plano.ts` desenhou
 * continuar valendo peça por peça (a coroa de 40 tamareiras, as 36 topiárias, os
 * 10 ciprestes, os 24 postes e as quatro escadarias), em vez de virar um
 * redesenho no mesmo dia em que a peça mudou de lugar.
 */
export const SPHERE_AVENTAL_LADO = 254.2

export function sphereDeckPoly(): [number, number][] {
  const s = sphereSitio()
  const h = SPHERE_AVENTAL_LADO / 2
  // no sentido que `recuar()` do jardim espera (normal para dentro)
  return [
    [s.x - h, s.z - h], [s.x + h, s.z - h],
    [s.x + h, s.z + h], [s.x - h, s.z + h],
  ]
}


/**
 * A cota do piso, que na praça é uma CONSTANTE e não uma medição.
 *
 * ⚠️ A PRAÇA É PLANA, E O FUNDADOR ESTAVA CERTO AO SUPOR ISSO: o chão do
 * precinto é laje construída em `PRACA_Y = -35` (ver `terrain.ts` e a nota de
 * `ANCHORS` em `precinct.ts`, que põe as três âncoras construídas nessa mesma
 * cota justamente porque elas não seguem `heightAt`). Não há relevo para sondar,
 * então a varredura de 3,6 mil chamadas de `heightAt` que media o módulo da teia
 * saiu inteira: ela media um chão que a peça não pisa mais.
 *
 * ⚠️ O PARÂMETRO CONTINUA NA ASSINATURA, e de propósito. `buildSphere` passa o
 * `heightAt` da cena e o jardim repete a chamada; mudar a assinatura obrigaria
 * os dois a mudar por nada. Ele fica declarado como não usado, que é honesto, em
 * vez de a peça fingir que sonda.
 */
export function sphereAssentar(_heightAt?: (x: number, z: number) => number): number {
  return PRACA_Y
}


/**
 * A MESMA COTA, COM MEMÓRIA, para quem precisa dela fora de `buildSphere`.
 *
 * ⚠️ ELA EXISTE POR CAUSA DO JARDIM DO PÓDIO (07/09). Quem planta sobre a laje
 * precisa saber em que cota ela está, e a resposta certa NÃO é
 * `SPHERE_PLATAFORMA_Y`: essa constante é o valor esperado, conferível offline,
 * e quem manda é a medição, para a peça sobreviver a uma troca de módulo sem
 * ninguém lembrar de remedir. Também não é `heightAt(x, z)`: sob o deck o
 * relevo vai de 99,78 a 116,00 m, então uma árvore plantada na superfície
 * ficaria enterrada em até 16,6 m.
 *
 * ⚠️ A MEMÓRIA É POR REFERÊNCIA DE FUNÇÃO, e é o bastante: `sphereAssentar`
 * custa 9 ms medidos (uma grade de 4 m sobre o deck), e hoje ela seria chamada
 * três vezes no boot (a peça, o jardim e a tabela de adereços). Guardar por
 * referência mantém a resposta correta se o terreno for reconstruído, porque
 * um terreno novo traz um `heightAt` novo.
 */
let _cotaDeck: { fn: unknown; y: number } | null = null
export function sphereCotaDeck(heightAt: (x: number, z: number) => number): number {
  if (_cotaDeck && _cotaDeck.fn === heightAt) return _cotaDeck.y
  const y = sphereAssentar(heightAt)
  _cotaDeck = { fn: heightAt, y }
  return y
}

/**
 * ⚠️ NÃO EXISTE MAIS PARCELA DE TEIA, E DEVOLVER UMA SERIA MENTIRA. Enquanto a
 * esfera morava num módulo, ela precisava entrar na lista de parcelas para a
 * teia parar de desenhar rua por dentro do tabuleiro. Na âncora norte da praça
 * ela está em r 620, e a teia só começa em r 1.900: não há rua dela para parar.
 * Devolver o polígono do `SPHERE_MOD` mascararia um módulo VAZIO lá longe, e o
 * efeito seria um buraco sem rua no meio do tecido.
 */
export function sphereParcela(): null { return null }


/**
 * A distância em que a peça some, POR PERFIL.
 *
 * ⚠️ ELA NÃO SOME. O corte é maior que o raio do sítio da cidade inteira
 * (a coroa externa vai a ~6.900 m e a peça está em r 5.117), porque sumir do
 * boot mataria a razão de ela existir: 81% do tecido enxerga o topo dela, e ela
 * é vista da praça central a 5.118 m. O `DistanceCuller` continua registrado só
 * para a peça ter centro próprio e para o dia em que a cidade crescer.
 *
 * ⚠️ E O CUSTO DE MANTER LIGADO É BAIXO PORQUE O DEGRAU JÁ ACONTECEU ANTES: a
 * 3.000 m a esfera ocupa 0,2% de uma tela de 1080p (0,6% no celular) e já está
 * no material liso em todo perfil fraco.
 */
export function sphereCull(): number {
  return 14000
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. A TEXTURA DE CONTEÚDO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Repete `texto` em torno da volta e devolve EXATAMENTE `nChars` caracteres.
 *
 * ⚠️ A VOLTA TEM DE FECHAR NUM NÚMERO INTEIRO DE CÓPIAS, e a primeira versão
 * disto (`t[i % (t.length + 1)]`) não fechava: com 16 caracteres em 32 casas o
 * padrão repetia a cada 17 e o meridiano de costura cortava uma palavra no meio.
 * A esfera não tem "costas" onde esconder uma emenda. Aqui o número de cópias é
 * `floor(nChars / (len + 1))` e a sobra é distribuída ENTRE as cópias, centrada,
 * pelo mesmo arredondamento acumulado que a teia usa: fecha exato, sempre.
 *
 * ⚠️ O VÃO ENTRE CÓPIAS LEVA `·`, E ISSO CUSTA ZERO CASA. Medido em 07/09: com 7
 * caracteres a janela legível de um azimute só contém uma cópia INTEIRA em 13%
 * dos azimutes; nos outros 87% o leitor pega uma cópia cortada de uma ponta (ver
 * a nota de `SPHERE_ORCAMENTO_*`). Com o vão VAZIO, um `418.2M` cortado na
 * frente vira `18.2M`, que é um número plausível e errado por vinte vezes; com o
 * separador o leitor vê `·18.2M` e sabe que aquilo é um pedaço. Ele ocupa uma
 * casa que já era vão, então o número de cópias e o período não mudam em nada: é
 * aviso de corte de graça.
 */
const SEPARADOR = '·'
function repetirNaVolta(texto: string, nChars: number): string {
  const t = texto.toUpperCase()
  if (!t.length) return ' '.repeat(nChars)
  if (t.length >= nChars) return t.slice(0, nChars)
  const rep = Math.max(1, Math.floor(nChars / (t.length + 1)))
  let out = ''
  for (let k = 0; k < rep; k++) {
    const larg = Math.floor((nChars * (k + 1)) / rep) - Math.floor((nChars * k) / rep)
    const vao = larg - t.length
    const esq = Math.floor(vao / 2)
    // o separador mora na primeira casa de vão à direita da cópia; sem vão
    // nenhum a volta continua fechando exata, só sem o aviso de corte.
    const dir = vao - esq
    out += ' '.repeat(esq) + t + (dir > 0 ? SEPARADOR + ' '.repeat(dir - 1) : '')
  }
  return out
}

/** Escreve uma cadeia na grade de LED, em pixels de glifo de `escala` LEDs. */
function escrever(
  g: CanvasRenderingContext2D,
  texto: string,
  linhaTopo: number,
  escala: number,
  nChars: number,
  cor: string,
  f: number,
) {
  g.fillStyle = cor
  const avanco = 8 * escala          // 5 de largura + 3 de vão, em LEDs
  const s = escala * f               // pixels de canvas por pixel de glifo
  const volta = repetirNaVolta(texto, nChars)
  for (let i = 0; i < nChars; i++) {
    const glifo = FONTE.get(volta[i])
    if (!glifo) continue
    const x0 = i * avanco * f
    for (let c = 0; c < 5; c++) {
      const mask = glifo[c]
      for (let r = 0; r < 7; r++) {
        if (!((mask >> r) & 1)) continue
        g.fillRect(Math.round(x0 + c * s), Math.round((linhaTopo + r * escala) * f),
          Math.ceil(s), Math.ceil(s))
      }
    }
  }
}

/**
 * Redesenha a textura de conteúdo inteira.
 *
 * ⚠️ NÃO CHAMAR POR QUADRO. É um canvas de até 2.048 x 1.024 e um envio de até
 * 8 MB para a GPU; ele existe para ser chamado quando o DADO muda, que é a cada
 * dezenas de segundos no melhor caso (`/api/price/kraken` tem cache de 30 s).
 * Nada aqui tiqueteia.
 */
function pintarTextura(
  cv: HTMLCanvasElement,
  c: SphereConteudo,
  f: number,
  longe = false,
): { media: THREE.Color; corFaixa: THREE.Color } {
  const g = cv.getContext('2d')!
  const W = cv.width, H = cv.height

  // ⚠️ O CORPO É UM PAINEL LIGADO, NÃO UM CASCO, e isso é decisão do fundador em
  // 07/09: no estado ocioso a peça tem de ler como TELA ACESA em nível baixo, e
  // não como bola preta com um anel. Medido, o que estava aqui (#101318 /
  // #1A1D24 / #0C0E12) emitia 0,0047 de luminância linear contra os 0,0491 do
  // painel apagado ao sol: 9,5%. O corpo era casco e só o dado era tela.
  //
  // ⚠️ E QUEM ACENDE NÃO É O NÍVEL MÉDIO, É A AMPLITUDE DO PONTO. O que faz a
  // casca ler como PAINEL é o disco do LED ter contraste contra o próprio fundo:
  // `sinal` vale `1/uPreenche` = 1,99 dentro do disco e 0 no vão, então a
  // ondulação da grade vale `corpo x uGanho x 1,99`. Com o corpo antigo ela media
  // **19%** do painel ao sol; com este, **34%**. Quem aparece é a grade de LED, e
  // não uma esfera embranquecida: a média do corpo sobe 2,6x e para por aí.
  //
  // ⚠️ O PICO SAIU DE CIMA DA FAIXA, E AGORA ISSO É OBRIGATÓRIO. O stop de 0,42
  // caía na linha 430, que era ACIMA da faixa antiga (540-640) e virou o MEIO da
  // faixa nova (378-486). Deixado onde estava, o chão da faixa ficaria mais
  // escuro que o corpo em volta e o anel aceso da seção 5.1 viraria anel
  // apagado. O pico foi para t 0,18 (linha 184), bem acima do miolo de texto, e
  // o corpo chega na faixa já em queda.
  // ⚠️ CINZA CHUMBO, E O AZUL SAIU EM 08/09 POR DECISÃO DO FUNDADOR: *"esfera
  // cinza chumbo com letras laranjas, padronizado pra nossa comunicação"*. A
  // versão anterior tinha 1,84 de azul para cada 1 de vermelho em linear, o que
  // contra o regolito quente da Lua lia como bola azul-marinho, não como painel.
  //
  // ⚠️ A NEUTRALIZAÇÃO PRESERVOU A LUMINÂNCIA, TERMO A TERMO, e é por isso que
  // nada do que foi calibrado antes precisou ser remedido: a ondulação da grade
  // continua em 34% do painel ao sol, o chão da faixa continua valendo 1,84x o
  // corpo em volta e o dado continua com 7,2x de contraste (era 7,3). O que
  // mudou foi só a CROMA: a razão azul/vermelho caiu de 1,84 para 1,04, ou seja
  // um sussurro de frio (3,5% no azul) em vez de um viés.
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0.00, '#2B2C2C')
  grad.addColorStop(0.18, '#39393A')
  grad.addColorStop(0.37, '#262727')
  grad.addColorStop(1.00, '#202021')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  c.pintarCorpo?.(g, W, H)

  // ⚠️ O CHÃO DA FAIXA SOBE JUNTO, E POR REQUISITO ESCRITO. `uCorFaixa` é o que a
  // peça mostra além do `textCull` e no material liso, e a seção 5.1 exige que
  // esse anel seja a parte ACESA da esfera. Medido: o chão antigo (#241A14) valia
  // **1,03x** o corpo debaixo dele, ou seja o anel só existia por causa da letra;
  // este vale **1,84x** o corpo em volta, então ele existe mesmo sem texto. E o
  // dado continua mandando na faixa: **7,3x** de contraste contra o chão, e 14,3x
  // no rótulo creme.
  // ⚠️ O CHÃO DA FAIXA TAMBÉM É CHUMBO AGORA. Ele era `#453225`, um marrom
  // quente escolhido para conversar com o laranja do dado, e virou o único ponto
  // quente de uma peça que o fundador padronizou em chumbo e laranja: com o
  // corpo neutro ele lia como faixa de terra. Mesma luminância, mesma razão de
  // 1,84x contra o corpo, mesmos 7,2x de contraste para o dado. Quem carrega o
  // calor da peça é a LETRA, e só ela.
  const corFaixa = '#363637'
  const y0 = SPHERE_FAIXA_LINHA0 * f, y1 = SPHERE_FAIXA_LINHA1 * f
  g.fillStyle = corFaixa
  g.fillRect(0, Math.round(y0), W, Math.round(y1 - y0))

  // ⚠️ DOIS REGISTROS, UM DE CADA VEZ, E QUEM ESCOLHE É A DISTÂNCIA. Ver
  // `FX_LONGE_ESCALA` para a conta e para o teto físico. De perto vão as duas
  // linhas (valor e rótulo); de longe vai UMA linha do dobro da altura com só o
  // valor, porque o rótulo já morreu em 1.378 m e ocuparia metade da faixa com
  // borrão.
  if (longe) {
    const lLonge = SPHERE_FAIXA_LINHA0 + FX_MARGEM
    escrever(g, c.grande, lLonge, FX_LONGE_ESCALA, SPHERE_CHARS_LONGE,
      c.cor ?? COR_DADO, f)
  } else {
    const lGrande = SPHERE_FAIXA_LINHA0 + FX_MARGEM_PERTO
    const lPequena = lGrande + 7 * FX_GRANDE_ESCALA + FX_VAO
    escrever(g, c.grande, lGrande, FX_GRANDE_ESCALA, SPHERE_CHARS_GRANDE,
      c.cor ?? COR_DADO, f)
    escrever(g, c.pequena, lPequena, FX_PEQUENA_ESCALA, SPHERE_CHARS_PEQUENA,
      c.corRotulo ?? COR_ROTULO, f)
  }

  // ── as duas médias, e as duas são MEDIDAS do canvas, nunca estimadas ─────
  const amostra = g.getImageData(0, 0, W, H).data
  const mediaDe = (linha0: number, linha1: number) => {
    let r = 0, vd = 0, b = 0, n = 0
    const i0 = Math.max(0, Math.round(linha0)) * W * 4
    const i1 = Math.min(H, Math.round(linha1)) * W * 4
    for (let i = i0; i < i1; i += 8 * 4) { r += amostra[i]; vd += amostra[i + 1]; b += amostra[i + 2]; n++ }
    const c = new THREE.Color(r / n / 255, vd / n / 255, b / n / 255)
    return c.convertSRGBToLinear()
  }

  // ⚠️ A MÉDIA DA ESFERA INTEIRA é o que o material liso mostra de longe.
  // Medida, porque é a única forma de o degrau de fillrate não mudar a cor da
  // peça quando ele entra.
  const media = mediaDe(0, H)

  // ⚠️ E A COR DA FAIXA É A MÉDIA DA FAIXA, NÃO O CHÃO DELA, e isto é conserto
  // de um defeito medido: com o chão (#241A14, um marrom quase preto) a esfera
  // ESCURECIA ao passar do `textCull`, porque a faixa é só 12% da altura
  // projetada e ela é a única parte acesa da peça. Renderizada a 3 km, a peça
  // lia como PONTO ESCURO, quando o requisito é justamente o contrário: "a 3 km
  // os pontos somem por sub-pixel e ela lê como ponto de luz".
  //
  // É o mesmo princípio que o padrão de ponto já usa: quando um detalhe deixa de
  // ser resolvível, ele desvanece para a PRÓPRIA MÉDIA, e não para o fundo.
  // Assim a letra some sem a peça perder brilho, e o que sobra de longe é um
  // anel aceso na cor certa.
  return { media, corFaixa: mediaDe(y0, y1) }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. A PEÇA
// ═══════════════════════════════════════════════════════════════════════════

export interface SphereOpts {
  perfil: PerfProfile
  /** o chão, para a saia do tabuleiro pousar no relevo */
  heightAt: (x: number, z: number) => number
  /** direção do sol da cena (normalizada), para o painel apagado ter forma */
  sol?: THREE.Vector3
  /** conteúdo inicial; o padrão é o estado NEUTRO, que não diz número nenhum */
  conteudo?: SphereConteudo
}

export interface SphereCusto {
  triangulosCasca: number
  triangulosBase: number
  chamadas: number
  texturaMB: number
  ledsFisicos: number
  passoCm: number
  /** a distância em que o padrão de ponto encosta em 1 px, com a tela de agora */
  distPadraoM: number
  /** a distância em que o material liso entra; Infinity se não entra */
  distLisoM: number
}

export interface Sphere {
  group: THREE.Group
  casca: THREE.Mesh
  base: THREE.Mesh
  /** troca o que está desenhado e reenvia a textura. NÃO chamar por quadro. */
  pintar(c: SphereConteudo): void
  /**
   * Só o ganho, sem repintar.
   *
   * ⚠️ É ISTO QUE FAZ O CROSSFADE CUSTAR NADA. `pintar()` é um canvas de 2.048 x
   * 1.024 e um envio de até 8 MB (~7 ms de thread principal, medido); esta aqui
   * é uma escrita de uniforme. `sphere-conteudo.ts` faz a transição descendo o
   * ganho, trocando a textura no fundo do vale e subindo de volta, ou seja um
   * dissolve de verdade sem tocar no shader e sem corte seco.
   */
  ganhar(g: number): void
  /**
   * Um swell de brilho no ANEL, uma vez, para um evento.
   *
   * ⚠️ É ISTO QUE FAZ O EVENTO ATRAVESSAR A DISTÂNCIA. O texto do evento morre
   * no `textCull` (600 a 1.700 m); o pulso não morre, porque ele é um uniforme
   * e vale igual no material liso. De 3 km ninguém lê `#965501`, mas todo mundo
   * vê o anel da cidade subir 1,85x por três segundos. Ver `SPHERE_PULSO_*`.
   *
   * `intensidade` escala o pico (1 = evento normal). Chamar de novo no meio de
   * um pulso REINICIA o swell, e é o comportamento certo: dois eventos juntos
   * são duas notícias, não uma onda quadrada.
   */
  pulsar(intensidade?: number): void
  /**
   * Alinha o painel apagado com a luz da cena.
   *
   * ⚠️ CHAMAR JUNTO COM A HORA DO AR. Sem isto a esfera usa o dia lunar padrão
   * e fica fora do ciclo de luz da cidade: o resto da praça escurece ao
   * entardecer e ela não. `solDir` é a direção DE ONDE vem a luz (normalizada),
   * `solCor` a cor vezes a intensidade e `amb` o ambiente.
   */
  iluminar(solDir: THREE.Vector3, solCor: THREE.Vector3, amb: THREE.Vector3): void
  /**
   * Por quadro. `pxAng` são os radianos de campo por PIXEL DE DISPOSITIVO:
   * `(fovVertical em rad) / (altura do canvas em px CSS × pixelRatio)`. Use
   * `spherePxAng()` se não tiver o número à mão.
   */
  update(cam: THREE.Vector3, pxAng?: number): void
  custo: SphereCusto
  dispose(): void
}

/** Radianos de campo por pixel de dispositivo. */
export function spherePxAng(fovDeg: number, alturaCss: number, pixelRatio: number): number {
  return THREE.MathUtils.degToRad(fovDeg) / Math.max(1, alturaCss * pixelRatio)
}

export function buildSphere(o: SphereOpts): Sphere {
  const p = o.perfil
  const esc = sphereEscalonamento(p)
  const s = sphereSitio()
  const rad = THREE.MathUtils.degToRad(s.rumoDeg)
  // ⚠️ O PÉ É MEDIDO NO RELEVO, NÃO LIDO DA CONSTANTE. `SPHERE_PLATAFORMA_Y` é o
  // valor ESPERADO (116,4, conferível offline); quem manda é a medição, para a
  // peça sobreviver a uma troca de módulo sem ninguém lembrar de remedir.
  const PLAT = sphereAssentar(o.heightAt)
  const YC = PLAT + SPHERE_ENTERRO * SPHERE_R
  const sol = (o.sol ?? new THREE.Vector3(0.28, 0.86, 0.18)).clone().normalize()
  const descartar: { dispose(): void }[] = []

  const group = new THREE.Group()
  group.name = 'THE_SPHERE'

  // ── a textura de conteúdo ────────────────────────────────────────────────
  const cv = document.createElement('canvas')
  cv.width = esc.texW; cv.height = esc.texH
  const f = esc.texW / SPHERE_GRADE_COLS      // pixels de canvas por LED
  const conteudo0 = o.conteudo ?? SPHERE_CONTEUDO_NEUTRO
  const med = pintarTextura(cv, conteudo0, f)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping          // a longitude dá a volta
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  // ⚠️ ANISOTROPIA NÃO É ENFEITE AQUI. Junto à silhueta a casca fica quase
  // paralela ao raio de visão e o mipmap isotrópico borra os DOIS eixos: sem
  // ela a borda da esfera vira um anel cinza e a faixa some antes da hora.
  tex.anisotropy = 8
  tex.needsUpdate = true
  descartar.push(tex)

  // ── a casca ──────────────────────────────────────────────────────────────
  // ⚠️ A CALOTA ENTERRADA SAI DA MALHA, não é desenhada por baixo do chão. O
  // corte para 1,0 m ABAIXO do topo do pódio (e não do tabuleiro), que é onde o
  // embasamento já esconde tudo: são **29,3% da área**, uma calota inteira que
  // deixa de existir. Com 0,88 R eram 6,0%; o corte mais baixo devolve quase um
  // terço da malha e do fillrate de graça.
  const cosCorte = -(SPHERE_ENTERRO * SPHERE_R - (SPHERE_PODIO_H - 1.0)) / SPHERE_R
  const thetaMax = Math.acos(THREE.MathUtils.clamp(cosCorte, -1, 1))
  const geoCasca = new THREE.SphereGeometry(SPHERE_R, esc.segW, esc.segH, 0, Math.PI * 2, 0, thetaMax)
  descartar.push(geoCasca)

  const uniformes = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uConteudo: { value: tex },
    uGrade: { value: new THREE.Vector2(SPHERE_GRADE_COLS, SPHERE_GRADE_ROWS) },
    uPasso: { value: SPHERE_PASSO },
    uPxAng: { value: spherePxAng(42, 1080, p.maxPixelRatio) },
    uGanho: { value: conteudo0.ganho ?? 0.42 },
    // ⚠️ A VIDA DO ANEL. Nasce em 1,0 (nem respirando nem pulsando) e é escrita
    // por quadro em `update()`, que já roda. Ver a seção 5.1.
    uVida: { value: 1 },
    // ⚠️ RAIO 0,40 DA CÉLULA, ou seja preenchimento π·0,40² = 0,503. É o que um
    // painel de LED de verdade entrega (puck menor que o passo, vão escuro
    // entre eles), e é o número que faz o pico valer 1/0,503 = 1,99 vezes a
    // média sem estourar o `ACESFilmicToneMapping` da cena.
    uRaioPonto: { value: 0.40 },
    uPreenche: { value: Math.PI * 0.40 * 0.40 },
    uAA: { value: esc.aa },
    uTextoDist: { value: esc.distTexto },
    uFaixaV: {
      value: new THREE.Vector2(
        1 - SPHERE_FAIXA_LINHA1 / SPHERE_GRADE_ROWS,
        1 - SPHERE_FAIXA_LINHA0 / SPHERE_GRADE_ROWS,
      ),
    },
    uCorFaixa: { value: med.corFaixa },
    uCam: { value: new THREE.Vector3() },
    uSol: { value: sol },
    // ⚠️ PADRÃO DE DIA LUNAR, e ele existe para a peça nascer certa mesmo se
    // ninguém chamar `iluminar()`. Quem tem a hora do ar da cena deve chamar.
    uSolCor: { value: new THREE.Vector3(1.6, 1.56, 1.48) },
    uAmb: { value: new THREE.Vector3(0.34, 0.35, 0.40) },
    uPainel: { value: COR_PAINEL.clone().convertSRGBToLinear() },
    uMedia: { value: med.media },
  }

  const matLed = new THREE.ShaderMaterial({
    uniforms: uniformes,
    vertexShader: VS, fragmentShader: FS, fog: true,
  })
  const matLiso = new THREE.ShaderMaterial({
    uniforms: uniformes,   // ⚠️ compartilhados de propósito: a troca de material
                           // não pode mudar cor, ganho nem sol no meio do caminho
    vertexShader: VS, fragmentShader: FS_LISO, fog: true,
  })
  matLed.name = 'sphere:led'
  matLiso.name = 'sphere:liso'
  descartar.push(matLed, matLiso)

  const casca = new THREE.Mesh(geoCasca, matLed)
  casca.name = 'SPHERE_CASCA'
  casca.position.set(s.x, YC, s.z)
  // giro só de longitude: latitude não muda, então a faixa continua horizontal
  casca.rotation.y = -rad
  casca.castShadow = esc.projetaSombra
  casca.receiveShadow = false
  group.add(casca)

  // ── o tabuleiro e a praça ────────────────────────────────────────────────
  const base = construirBase(PLAT, o.heightAt)
  descartar.push(base.geometry)
  descartar.push(base.material as THREE.Material)
  group.add(base)

  // ── o embasamento: pódio e colar ─────────────────────────────────────────
  // ⚠️ ELE NÃO É DETALHE DE PERTO, E POR ISSO NÃO OBEDECE MAIS AO `smallCull`. O
  // plinto antigo era um anel de 2,6 m em volta de um círculo de 32 m e sumia
  // sem custo; o embasamento tem **204,2 m de diâmetro** e é ele que dá à peça a
  // leitura de monumento assentado em vez de bola largada. Sumir com ele a 2 km
  // devolveria exatamente o defeito que o fundador apontou.
  const podio = construirPodio(PLAT)
  podio.position.set(s.x, 0, s.z)
  descartar.push(podio.geometry, podio.material as THREE.Material)
  group.add(podio)

  // ── o custo, medido da geometria de verdade ──────────────────────────────
  const triCasca = (geoCasca.index?.count ?? geoCasca.attributes.position.count) / 3
  const triBase = (base.geometry.index?.count ?? base.geometry.attributes.position.count) / 3
  const triPlinto = (podio.geometry.index?.count ?? podio.geometry.attributes.position.count) / 3
  const custo: SphereCusto = {
    triangulosCasca: Math.round(triCasca),
    triangulosBase: Math.round(triBase + triPlinto),
    chamadas: 3,
    texturaMB: (esc.texW * esc.texH * 4 * 1.334) / 1048576,
    ledsFisicos: Math.round((4 * Math.PI * SPHERE_R * SPHERE_R) / (SPHERE_PASSO * SPHERE_PASSO)),
    passoCm: SPHERE_PASSO * 100,
    distPadraoM: SPHERE_PASSO / uniformes.uPxAng.value,
    distLisoM: esc.distLiso,
  }

  let liso = false
  /** o conteúdo corrente, para a peça poder se repintar sozinha ao trocar de
   *  registro sem ninguém chamar `pintar()` */
  let atual: SphereConteudo = conteudo0
  /** registro de LONGE ligado? Ver `FX_LONGE_ESCALA` e a troca em `update()`. */
  let longe = false
  // arte de corpo desliga o degrau: ver a nota em update()
  let temArte = !!conteudo0.pintarCorpo
  // ── a vida do anel: respiração + pulso de evento (ver a seção 5.1) ──────
  let pulsoT0 = 0
  let pulsoAmp = 0
  const relogio = () =>
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  const suave = (a: number, b: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
  }
  return {
    group, casca, base, custo,
    ganhar(g: number) {
      uniformes.uGanho.value = g
    },
    pulsar(intensidade = 1) {
      pulsoT0 = relogio()
      pulsoAmp = SPHERE_PULSO_AMP * Math.max(0, intensidade)
    },
    pintar(c: SphereConteudo) {
      atual = c
      const m = pintarTextura(cv, c, f, longe)
      uniformes.uMedia.value = m.media
      uniformes.uCorFaixa.value = m.corFaixa
      uniformes.uGanho.value = c.ganho ?? 0.42
      temArte = !!c.pintarCorpo
      tex.needsUpdate = true
    },
    iluminar(solDir: THREE.Vector3, solCor: THREE.Vector3, amb: THREE.Vector3) {
      uniformes.uSol.value.copy(solDir).normalize()
      uniformes.uSolCor.value.copy(solCor)
      uniformes.uAmb.value.copy(amb)
    },
    update(cam: THREE.Vector3, pxAng?: number) {
      uniformes.uCam.value.copy(cam)
      if (pxAng && pxAng > 0) uniformes.uPxAng.value = pxAng
      const d = cam.distanceTo(casca.position)
      // ⚠️ O DEGRAU SÓ EXISTE ONDE O PERFIL AUTORIZA, e a primeira versão disto
      // estava errada de duas formas, as duas achadas na tabela de custo:
      //
      //  1. ela fazia `min(distLiso, distPadrao)`, e como `distPadrao` (a
      //     distância em que o LED encosta em 1 px, 361 a 722 m) é finita, o
      //     PERFIL FORTE trocava de material a 722 m mesmo com `distLiso`
      //     valendo Infinity. Ganho real: deixar de pagar o shader em 2,1% da
      //     tela. Preço: um estalo visível numa peça que se vê de 5 km. Não
      //     compensa, e além disso contraria o dossiê, que só pede o degrau no
      //     perfil fraco.
      //  2. ela trocava mesmo com arte de corpo pintada. O material liso não
      //     tem textura, então uma peça de parceiro ocupando a esfera inteira
      //     SUMIRIA a partir do degrau. O anúncio é justamente o conteúdo que
      //     não pode desaparecer no meio do intervalo comercial.
      const limite = Number.isFinite(esc.distLiso) && !temArte
        ? Math.min(esc.distLiso, uniformes.uPasso.value / uniformes.uPxAng.value)
        : esc.distLiso
      // ⚠️ A DISTÂNCIA DE TEXTO É MEDIDA NA TELA DE QUEM OLHA, por quadro, e não
      // lida do perfil. A conta e o defeito que ela conserta estão em
      // `SPHERE_TEXTO_PX`. `uPxAng` já é escrito duas linhas acima: a peça sempre
      // teve o número da tela na mão e não o usava para isto.
      const distTexto = SPHERE_LETRA_ALTURA / (SPHERE_TEXTO_PX * uniformes.uPxAng.value)
      // ⚠️ A TROCA DE REGISTRO CUSTA UMA REPINTURA, ENTÃO ELA TEM HISTERESE
      // LARGA. `pintarTextura` é um canvas de até 2.048 x 1.024 e um envio de até
      // 8 MB (~7 ms de thread principal, medido): por quadro seria inaceitável.
      // A banda morta vai de 0,85 a 1,15 do limiar, ou seja 30% da distância
      // (827 m dos 2.757 na tela da live). Uma volta do tour cruza isso duas
      // vezes: 14 ms por volta de 22 min. O que a banda impede é a câmera parar
      // em cima do limiar e repintar a cada quadro.
      const queroLonge = longe ? d > distTexto * 0.85 : d > distTexto * 1.15
      if (queroLonge !== longe) {
        longe = queroLonge
        const m = pintarTextura(cv, atual, f, longe)
        uniformes.uMedia.value = m.media
        uniformes.uCorFaixa.value = m.corFaixa
        tex.needsUpdate = true
      }
      // ⚠️ E O CORTE DE TEXTO ACOMPANHA O REGISTRO: no modo de longe a letra tem
      // o DOBRO da altura, então vive o dobro da distância. Usar o mesmo
      // `distTexto` apagaria justamente o registro que existe para não apagar.
      uniformes.uTextoDist.value = longe ? distTexto * 2 : distTexto
      // ⚠️ E O DEGRAU DE FILLRATE NÃO PODE ENTRAR ENQUANTO A LETRA AINDA É
      // LEGÍVEL, porque `FS_LISO` não tem textura nenhuma: trocar de material ali
      // apagaria o texto do mesmo jeito que o corte apagava. No celular isto leva
      // o degrau de `lodDistance` (1.300 m) para a distância medida (2.656 m em
      // dpr 2), e o preço está medido: o disco da esfera mede 7,2% da tela de um
      // 390x844 em dpr 2 a 1.300 m, 3,0% a 2.000 m e 1,7% a 2.656 m. É o shader
      // cheio sobre menos de um vigésimo da tela, na faixa em que antes ele nem
      // rodava.
      const querLiso = d > Math.max(limite, longe ? distTexto * 2 : distTexto) * 1.15
      if (querLiso !== liso) {
        liso = querLiso
        casca.material = liso ? matLiso : matLed
        custo.distLisoM = limite
      }
      // ── a vida do anel ───────────────────────────────────────────────────
      // ⚠️ ELA CUSTA UM `Math.sin` E TRÊS COMPARAÇÕES, dentro de uma função que
      // já rodava por quadro. A amplitude da respiração sobe com a distância
      // porque de perto quem se mexe é o DADO, e um instrumento não respira: de
      // 0,25 x SPHERE_VIDA_AMP dentro da leitura a 1,0 x além dela. A rampa é
      // calculada aqui, na CPU, e não no fragmento, justamente para o custo
      // ficar do lado barato.
      const t = relogio()
      // a respiração do anel acompanha a MESMA distância medida: se o texto
      // agora morre mais longe, a amplitude cheia também tem de começar mais
      // longe, senão o anel respira por cima do número que ainda se lê.
      const kLonge = suave(distTexto * 0.5, distTexto * 1.15, d)
      const amp = SPHERE_VIDA_AMP * (0.25 + 0.75 * kLonge)
      let vida = 1 + amp * Math.sin((2 * Math.PI * t) / SPHERE_VIDA_PERIODO_MS)
      if (pulsoT0 > 0) {
        const dt = t - pulsoT0
        if (dt >= SPHERE_PULSO_MS) pulsoT0 = 0
        else {
          // sobe rápido, desce devagar: swell, não piscada. Ver SPHERE_PULSO_*.
          const sobe = suave(0, SPHERE_PULSO_SOBE_MS, dt)
          const desce = 1 - suave(SPHERE_PULSO_SOBE_MS, SPHERE_PULSO_MS, dt)
          vida += pulsoAmp * sobe * desce
        }
      }
      uniformes.uVida.value = vida

      // ⚠️ NADA SOME AQUI. O embasamento é parte da silhueta, não mobiliário:
      // ver a nota em `construirPodio`. `esc.distMiudo` volta a mandar quando a
      // praça ganhar programa (banco, guarda-corpo, luminária), que é a frente
      // seguinte e ainda não existe.
      void esc.distMiudo
    },
    dispose() {
      for (const x of descartar) x.dispose()
    },
  }
}

/**
 * O TABULEIRO: o deck apertado, nivelado, com saia até o relevo.
 *
 * ⚠️ ELE ERA O MÓDULO INTEIRO ATÉ 07/09 À TARDE, e isso é o que o fundador viu
 * como defeito: *"ela me parece pequena EM RELAÇÃO AO TERRENO QUE ELA OCUPA"*.
 * Com 227,0 x 370,8 de laje e uma esfera de 64 m no chão, a peça ocupava 17,3%
 * da largura do próprio deck no eixo do arco. Agora o deck é
 * `sphereDeckPoly()`, **229,6 x 254,2 m**, e a esfera de 196 m ocupa **78,4% no
 * radial e 70,8% no arco** (88,9% e 80,3% contando o embasamento).
 *
 * ⚠️ O QUE FICOU DE FORA CONTINUA SENDO LOTE, NÃO BURACO. `sphereParcela()`
 * ainda devolve o módulo inteiro, então a teia segue sem desenhar rua por
 * dentro; as duas pontas do arco ficam em terreno natural, que é condição normal
 * de lote de monumento.
 *
 * ⚠️ E ELE É CHÃO DE VERDADE, não pedestal visto de longe: a cidade vai para
 * terceira pessoa estilo GTA e alguém vai pisar aqui a 1,7 m de altura de olho.
 * Por isso o deck é subdividido (permite terraceamento depois sem refazer a
 * peça) e a saia desce colada no relevo em vez de cortar no ar.
 */
function construirBase(
  PLAT: number,
  heightAt: (x: number, z: number) => number,
): THREE.Mesh {
  const poly = sphereDeckPoly()
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []

  // ── o deck: grade bilinear sobre o quadrilátero do módulo ────────────────
  // ⚠️ O SENTIDO DO POLÍGONO SE MEDE, NÃO SE ADIVINHA. `polyDoModulo` não promete
  // horário nem anti-horário, e um deck com a normal para baixo some por
  // `backface culling` e leva junto a sombra que ele deveria receber.
  let area2 = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    area2 += a[0] * b[1] - b[0] * a[1]
  }
  const q = area2 > 0 ? poly : [...poly].reverse()

  const NU = 16, NV = 12
  const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  for (let j = 0; j <= NV; j++) {
    const t = j / NV
    const e0 = lerp2(q[0], q[3], t)
    const e1 = lerp2(q[1], q[2], t)
    for (let i = 0; i <= NU; i++) {
      const pnt = lerp2(e0, e1, i / NU)
      pos.push(pnt[0], PLAT, pnt[1])
      nor.push(0, 1, 0)
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }

  // ── a saia: da divisa do lote até o relevo ───────────────────────────────
  // ⚠️ ELA DESCE 1,5 m ABAIXO DO RELEVO. Parar exatamente na cota do terreno
  // deixa uma fresta de luz por causa do micro-relevo que o `terreno=fino`
  // acrescenta depois; enterrar resolve e não custa nada.
  const N_SAIA = 22
  for (let e = 0; e < q.length; e++) {
    const a = q[e], b = q[(e + 1) % q.length]
    const base0 = pos.length / 3
    for (let i = 0; i <= N_SAIA; i++) {
      const t = i / N_SAIA
      const x = a[0] + (b[0] - a[0]) * t
      const z = a[1] + (b[1] - a[1]) * t
      pos.push(x, PLAT, z)
      pos.push(x, heightAt(x, z) - 1.5, z)
      // normal para fora: perpendicular à aresta, no plano
      const ex = b[0] - a[0], ez = b[1] - a[1]
      const L = Math.hypot(ex, ez) || 1
      nor.push(ez / L, 0, -ex / L)
      nor.push(ez / L, 0, -ex / L)
    }
    for (let i = 0; i < N_SAIA; i++) {
      const k = base0 + i * 2
      idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setIndex(idx)
  geo.computeBoundingSphere()

  const mat = new THREE.MeshStandardMaterial({
    color: COR_PISO, roughness: 0.94, metalness: 0.0, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'SPHERE_TABULEIRO'
  mesh.receiveShadow = true
  mesh.castShadow = false
  return mesh
}

/**
 * O EMBASAMENTO: o pódio e o colar que resolvem o encontro com o chão.
 *
 * ⚠️ ELE EXISTE PORQUE O CORTE DESCEU. Com o centro a 0,88 R a esfera tocava o
 * piso num círculo de 32 m e um plinto de 2,6 m dava conta; com o centro a
 * 0,43 R ela toca numa linha de **180,0 m de largura**, e uma esfera de 196 m
 * cortando um plano liso lê como bug de modelagem, não como arquitetura. A de
 * Las Vegas resolve isso com o embasamento do edifício, e é o mesmo recurso:
 *
 *     pódio    anel de 12,6 m de largura, **2,2 m** de altura, de r 89,49 a
 *              r 102,09. Terraço caminhável em volta da base, e a largura sai da
 *              conta de repartir o que sobra de deck em duas faixas iguais (ver
 *              `SPHERE_PODIO_LARG`).
 *     colar    chanfro de 3,0 m de largura e 1,2 m de altura sobre o pódio,
 *              inclinado a **25,9°**, subindo até encostar na esfera em r 90,02.
 *              É ele que faz a esfera EMERGIR de um bisel em vez de furar um
 *              plano.
 *
 * Medido: sobram **136,7 m de esfera acima do topo do colar, 69,8% da altura
 * total**, contra os 71% da Sphere de Las Vegas. A casca é cortada 1,0 m abaixo
 * do topo do pódio, então o aro da malha nunca briga em profundidade com o piso.
 *
 * ⚠️ ACESSO É DÍVIDA DECLARADA: 2,2 m de face vertical não se sobe a pé, e
 * escada/rampa é programa de praça, que o dossiê já lista em aberto. A geometria
 * já está subdividida no ângulo (96 gomos) para receber o corte de uma escadaria
 * sem refazer a peça.
 */
function construirPodio(PLAT: number): THREE.Mesh {
  const N = 96
  const rInt = SPHERE_R_PE                                  // 73,23 m
  const rColar = rInt + SPHERE_COLAR_LARG                   // 76,23 m
  const rTopoColar = SPHERE_R_COLAR                         // 73,75 m
  const rExt = rInt + SPHERE_PODIO_LARG                     // 87,23 m
  const yPodio = PLAT + SPHERE_PODIO_H
  const yColar = yPodio + SPHERE_COLAR_H

  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  // quatro anéis de vértices, do topo do colar para fora e para baixo:
  //   0 topo do colar (encosta na esfera)   1 pé do colar (topo do pódio)
  //   2 borda externa do pódio               3 pé da face externa, no deck
  const aneis: [number, number, [number, number, number]][] = [
    [rTopoColar, yColar, [0, 1, 0]],
    [rColar, yPodio, [0, 1, 0]],
    [rExt, yPodio, [0, 1, 0]],
    [rExt, PLAT, [1, 0, 0]],
  ]
  for (const [r, y, n] of aneis) {
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r)
      // o anel 3 tem normal radial (face vertical); os outros, para cima. O
      // colar recebe a normal do próprio chanfro para pegar luz rasante.
      if (n[0] === 1) nor.push(Math.cos(a), 0, Math.sin(a))
      else nor.push(0, 1, 0)
    }
  }
  // o colar ganha a normal inclinada de verdade: 25,8° para fora
  const incl = Math.atan2(SPHERE_COLAR_H, rColar - rTopoColar)
  for (let k = 0; k < 2; k++)
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const j = (k * (N + 1) + i) * 3
      nor[j] = Math.cos(a) * Math.sin(incl)
      nor[j + 1] = Math.cos(incl)
      nor[j + 2] = Math.sin(a) * Math.sin(incl)
    }
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < N; i++) {
      const A = k * (N + 1) + i, B = A + 1, C = A + (N + 1), D = C + 1
      idx.push(A, C, B, B, C, D)
    }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  const mat = new THREE.MeshStandardMaterial({
    color: COR_PLINTO, roughness: 0.88, metalness: 0.04, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'SPHERE_EMBASAMENTO'
  mesh.receiveShadow = true
  mesh.castShadow = false
  return mesh
}

/**
 * O ORÇAMENTO DE FILLRATE, para relatório e para `?stats=1`.
 *
 * ⚠️ FILLRATE É O VILÃO, NÃO TRIÂNGULO, e a conta é esta. A esfera ocupa
 * `2·atan(R/d)` de campo; num quadro de `h` pixels com FOV vertical de 42° ela
 * cobre um disco de raio `(R/d)/pxAng` pixels, e CADA fragmento roda o shader.
 * O que a tabela mostra é que o problema não é a cena grande, é o CELULAR PERTO.
 */
export function sphereCusto(larguraCss: number, alturaCss: number, dpr: number, fovDeg = 42) {
  const pxAng = spherePxAng(fovDeg, alturaCss, dpr)
  const totalFrag = larguraCss * alturaCss * dpr * dpr
  return [100, 300, 1000, 3000].map((d) => {
    const raioPx = (SPHERE_R / d) / pxAng
    const frag = Math.min(Math.PI * raioPx * raioPx, totalFrag)
    return {
      distanciaM: d,
      grausDeCampo: 2 * Math.atan(SPHERE_R / d) * 180 / Math.PI,
      fragmentos: Math.round(frag),
      fracaoDaTela: frag / totalFrag,
      ledPx: SPHERE_PASSO / d / pxAng,
    }
  })
}
