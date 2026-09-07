// ═══════════════════════════════════════════════════════════════════════════
// THE SPHERE na cena da cidade.
//
// Um telão de LED esférico de **160 m de diâmetro**, emergindo de um
// embasamento sobre um deck apertado, com praça caminhável em volta. Referência
// declarada: a Sphere de Las Vegas (elipsóide de 157 x 112 m, ~1,2 milhão de
// pontos de LED a ~20 cm de passo). A nossa é ESFERA, mostra 111,0 m acima do
// colar (a de Vegas mostra 112) e tem 1,34 milhão de LEDs. Dossiê em
// `sphere.md`.
//
// ⚠️ ELA MEDIA 135 m E ERA QUASE UMA BOLA INTEIRA POUSADA NO CHÃO até 07/09 à
// tarde, quando o fundador viu a peça em produção: com o centro a 0,88 R ela
// mostrava 94% da própria altura, e a referência real mostra 71%. A correção
// (0,43 R, 160 m de diâmetro, embasamento, deck apertado) refez o corte, a
// faixa de texto, o passo de LED e a cota do tabuleiro, e cada um desses
// números está medido no comentário da própria constante.
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
 * ⚠️ 160 m, E NÃO OS 135 DE 07/09 DE MANHÃ. O fundador viu a peça em produção e
 * apontou duas coisas na mesma frase: *"ela me parece pequena em relação ao
 * terreno que ela ocupa, e o mais importante, o ponto de corte dela com o solo
 * está bem mais embaixo: a nossa esfera é quase uma esfera completa, enquanto a
 * esfera real é pouco mais de meia esfera"*.
 *
 * Ele está certo, e a conta prova. Com 135 m e enterro de 0,88 R a peça mostrava
 * **94% da própria altura**, ou seja uma bola inteira POUSADA no chão. A de Las
 * Vegas mede 157 x 112 m, isto é mostra **71%** e tem o centro a 0,43 R: ela não
 * pousa, ela EMERGE de um embasamento, e é a base larga encontrando o terreno
 * que dá a leitura de monumento assentado.
 *
 * Corrigido o enterro para 0,43 R, manter 135 m derrubaria o topo de 126,9 para
 * 96,5 m, e a queixa era justamente de tamanho. Com 160 m o topo fica em
 * **114,4 m acima do tabuleiro** (111,0 acima do colar que resolve o encontro),
 * praticamente a altura da referência, e a esfera encosta no chão numa linha de
 * **147,5 m de largura** em vez dos 64,1 m de antes.
 *
 * ⚠️ E OS 160 CABEM, já estava medido: sobram 33,5 m no radial e 105,4 m no arco
 * contra a caixa do módulo. O que aperta a praça não é a esfera, é o
 * embasamento, e essa conta está em `SPHERE_PRACA_*`.
 */
export const SPHERE_DIAM = 160
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
 *     **sobre o DECK APERTADO (230,5 x 248,6)   99,78 a 116,00 m   desnível 16,2**
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
 * Medido, a razão entre a largura da esfera no chão e a largura do deck:
 *
 *                        no radial   no arco
 *     antes (135 m, deck do módulo inteiro)     28,2%      17,3%
 *     **agora (160 m, deck apertado)**          **64,0%**  **59,3%**
 *     contando o embasamento construído          75,7%      70,2%
 *
 * O radial não muda (a caixa do módulo já era apertada nesse eixo e os dois
 * lados dele SÃO rua). Quem encolhe é o arco, em 16,5% de cada ponta, e o
 * resultado é um deck de 230,5 m no radial por 248,6 m no arco: um lote quase
 * quadrado para uma peça de revolução, em vez de uma laje de quarteirão inteiro
 * com uma bola no meio.
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
 *     centro acima do tabuleiro                 34,4 m  (0,43 x 80)
 *     topo acima do tabuleiro                  114,4 m  (71,5% da altura total)
 *     largura no plano do tabuleiro            144,5 m
 *     latitude do plano de corte              −25,47°
 *     calota que sai da malha (thetaLength)     29,3% da área
 *
 * ⚠️ E ESSE PLANO DE CORTE MOVEU A FAIXA DE TEXTO. A faixa antiga vivia entre as
 * latitudes −11,95° e −33,05°, e com o corte em −25,47° ela ficaria METADE
 * ENTERRADA. A faixa nova está em `SPHERE_FAIXA_LINHA0/1`, remedida.
 */
export const SPHERE_ENTERRO = 0.43

/**
 * O EMBASAMENTO, e ele é requisito e não enfeite.
 *
 * ⚠️ COM O CORTE MAIS BAIXO A LINHA DE ENCONTRO COM O CHÃO FICA VISÍVEL E LONGA
 * (147,5 m), e uma intersecção seca entre uma esfera de 160 m e um piso plano lê
 * como bug de modelagem. A de Las Vegas resolve isso com o embasamento do
 * edifício. Aqui são duas peças:
 *
 *   · **pódio**: anel de 14,0 m de largura e **2,2 m** de altura, de r 73,23
 *     (onde a esfera passa pela cota +2,2) a r 87,23. É o terraço que envolve a
 *     base, e ele é caminhável porque a cidade vai para terceira pessoa.
 *   · **colar**: um chanfro de 3,0 m de largura e 1,2 m de altura sobre o pódio,
 *     inclinado a **25,8°**, que sobe até encostar na esfera em r 73,75. É ele
 *     que resolve o encontro: a esfera EMERGE de um bisel, não corta um plano.
 *
 * Resultado medido: **111,0 m de esfera acima do topo do colar, 69,4% da altura
 * total**, contra os 71% da referência. E a casca é cortada 1,0 m ABAIXO do topo
 * do pódio, então o aro da malha nunca briga em profundidade com o piso.
 *
 * ⚠️ ACESSO AO PÓDIO É DÍVIDA DECLARADA. 2,2 m de face vertical não se sobe a
 * pé, e escada/rampa é programa de praça, que o dossiê já lista em aberto.
 */
export const SPHERE_PODIO_H = 2.2
export const SPHERE_PODIO_LARG = 14.0
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
 * Medido: 230,5/2 − 87,23 = **28,0 m no radial** e 248,6/2 − 87,23 = **37,0 m no
 * arco**. É menos do que os 46,0 x 117,9 de antes, e é assim de propósito: o que
 * sobrava antes não era praça, era laje.
 */
export const SPHERE_PRACA_RADIAL = 28.0
export const SPHERE_PRACA_ARCO = 37.0

// ═══════════════════════════════════════════════════════════════════════════
// 2. A GRADE DE LED
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ O PASSO DO LED É 24,54 cm, E QUEM MANDA É A GRADE, NÃO O PASSO.
 *
 * ⚠️ ELE ERA 20,71 cm ATÉ A ESFERA CRESCER DE 135 PARA 160 m. O passo não é uma
 * constante escolhida: ele CAI da grade em potência de dois, que é o que faz a
 * célula ser quadrada por construção. Com R = 80 m: a circunferência do equador
 * mede 2πR = 502,65 m, e 502,65 / 2.048 = **24,54 cm**; do polo ao polo são
 * πR = 251,33 m, e 251,33 / 1.024 = **24,54 cm** também. Manter os 20,71 cm
 * exigiria 2.427 colunas, que não é potência de dois e quebraria a queda por
 * oitava de latitude e o encaixe do mipmap.
 *
 * E as duas pontas que o dossiê exige continuam entregues, remedidas. A câmera
 * da praça tem **FOV vertical de 42°** (`plaza-scene.tsx:1125`); num quadro de
 * 1080 px isso dá **678,7 µrad por pixel**, e um LED ocupa `p / D / 678,7e-6`:
 *
 *      20 m    18,08 px    painel resolvido, dá para contar puck
 *     100 m     3,62 px    **o padrão de disco aparece e lê como PAINEL**
 *     200 m     1,81 px    transição
 *     361 m     1,00 px    o ponto encosta no pixel: o padrão morre aqui
 *   1.000 m     0,36 px    ponto de luz
 *   3.000 m     0,12 px    **sub-pixel, ela lê como ponto de luz**
 *   5.118 m     0,07 px    (a distância da praça central)
 *
 * ⚠️ E O PASSO MAIS GROSSO NÃO PIOROU NADA, MELHOROU: com 20,71 cm o padrão
 * morria a 305 m, agora morre a 361 m, ou seja a leitura de painel dura 18% mais
 * longe. O que se perde é densidade de perto, e a 20 m ainda são 18 px por LED.
 *
 * Painel físico resultante: **1.335.088 LEDs** sobre **80.425 m² de casca**. A
 * de Las Vegas tem 1,2 milhão a ~20 cm sobre um elipsóide menor.
 */
export const SPHERE_GRADE_COLS = 2048
export const SPHERE_GRADE_ROWS = 1024
export const SPHERE_PASSO = (2 * Math.PI * SPHERE_R) / SPHERE_GRADE_COLS  // 0,2454 m

/**
 * ⚠️ A FAIXA DE TEXTO NÃO FICA NO EQUADOR, E A CONTA MANDA.
 *
 * ⚠️ E A FAIXA MUDOU DE LUGAR EM 07/09, POR CAUSA DO CORTE NOVO. Ela vivia nas
 * linhas 580 a 700 (latitude −11,95° a −33,05°), medida com o centro a 0,88 R.
 * Com o centro em 0,43 R o plano de corte subiu para a latitude **−25,47°**, e a
 * faixa antiga ficaria **metade enterrada**. Não é ajuste fino: é consequência
 * direta da geometria nova, e foi remedida inteira.
 *
 * O pedido é "faixa equatorial", e a razão dela existir é que os polos sofrem
 * escorço de perspectiva. Só que o mesmo escorço atinge o equador, porque TODO
 * observador da cidade está ABAIXO do centro da esfera: o centro fica em
 * y = 150,80 m (tabuleiro 116,4 + 0,43 R) e o olho de pedestre está a 1,7 m.
 *
 * Medido exatamente, sem aproximação de observador distante: para um ponto de
 * latitude φ e um olho a distância horizontal `d`, a compressão da ALTURA da
 * letra é `√(1 − (t̂·v̂)²)`, onde `t̂` é a tangente na direção da latitude e `v̂`
 * a direção do olhar. **A conta é a mesma em qualquer azimute**, porque a esfera
 * é de revolução e a faixa é de latitude constante: qualquer observador vê,
 * no meridiano que o encara, exatamente esta geometria. É essa simetria que
 * dispensa varrer azimute. O embasamento entra na conta como OCLUSOR: uma
 * latitude que o pódio ou o colar escondem vale zero, não vale "quase".
 *
 * Compressão da altura da letra na faixa escolhida (1,00 = de frente):
 *
 *   lat \ d     115 m   150 m   200 m   300 m   500 m  1000 m  2250 m
 *    −4,92°      0,86    0,97    0,99    1,00    1,00    1,00    1,00
 *   −13,71°      0,99    1,00    0,99    0,98    0,98    0,97    0,97
 *   −22,50°      0,94    0,93    0,93    0,93    0,92    0,92    0,92
 *
 * A faixa de leitura vai de **115,25 m** (a borda do deck no eixo radial, o
 * ponto mais afastado do eixo que ainda é chão desta peça) a **2.250 m** (além
 * disso a letra de 13,74 m cai abaixo de ~9 px de altura e nenhuma latitude
 * salva; com a letra maior isso é 450 m mais longe do que a peça de 135 m
 * alcançava). Varridas as faixas de 100 linhas dentro dessa janela:
 *
 *     linhas 520-620   lat  −1,41 a −18,98    pior compressão 0,770
 *     linhas 530-630   lat  −3,16 a −20,74    pior compressão 0,814
 *     **linhas 540-640 lat  −4,92 a −22,50    pior compressão 0,856**
 *     linhas 545-645   lat  −5,80 a −23,38    **OCLUÍDA pelo embasamento**
 *
 * Escolhida a **540 a 640**: é a mais baixa que o embasamento ainda deixa ver
 * inteira, e ser a mais baixa é o que maximiza a compressão, porque o observador
 * está sempre embaixo. Uma linha a mais para baixo e o pódio come a faixa.
 *
 * ⚠️ E A LEITURA MELHOROU COM A PEÇA MAIOR: o pior caso passou de 0,950 numa
 * faixa de 24,7 m para **0,856 numa faixa de 24,54 m** com a MESMA altura
 * física, mas com letra 18% maior (13,74 m contra 11,60) e alcance 25% maior.
 * O 0,856 é pior que o 0,950 antigo porque agora o pior caso é a borda do deck a
 * 115 m, e ali a esfera de 160 m se vê muito mais de baixo do que a de 135.
 *
 * ⚠️ DO PÉ DA ESFERA NÃO SE LÊ NADA, em latitude nenhuma: quem está encostado no
 * pódio olha para cima em mais de 55° e vê a faixa de perfil. Isso é geometria,
 * não defeito, e vale igual para a de Las Vegas. A leitura começa onde a praça
 * acaba.
 */
export const SPHERE_FAIXA_LINHA0 = 540
export const SPHERE_FAIXA_LINHA1 = 640

/** latitude, em graus, de uma linha da grade contada do polo norte */
export function sphereLatDaLinha(linha: number): number {
  return 90 - (180 * linha) / SPHERE_GRADE_ROWS
}

// ── o interior da faixa, em linhas de LED ──────────────────────────────────
// ⚠️ A FAIXA É DIMENSIONADA PELA LETRA, e não o contrário: doutrina do letreiro
// do Estádio (`estadio.md`), que a pagou com um painel de 10,5 m para letra de
// 7,35. Aqui: margem 8, linha grande 56 (7 x 8), vão 8, linha pequena 28
// (7 x 4), margem 8 = **100 linhas exatas**.
// ⚠️ ERAM 120 LINHAS ATÉ A FAIXA DESCER: a janela que o embasamento deixa livre
// tem 101 linhas, então o miolo apertou de 120 para 100. A ALTURA FÍSICA não
// mudou (24,54 m contra 24,85), porque o passo cresceu junto com a esfera, e a
// letra ficou 18% maior: as escalas 8 e 4 continuam intactas.
const FX_MARGEM = 8
const FX_GRANDE_ESCALA = 8   // linhas de LED por pixel de glifo
const FX_PEQUENA_ESCALA = 4
const FX_VAO = 8

/**
 * ⚠️ O TEXTO FECHA A VOLTA EXATA, e isso não é enfeite: um texto que não fecha
 * deixa uma emenda visível no meridiano, e a esfera não tem "costas" para
 * escondê-la. O avanço é de 8 pixels de glifo (5 de largura + 3 de vão, que é
 * vão generoso de propósito porque LED perde contraste entre traços vizinhos):
 *
 *     linha grande: 8 x 8 = 64 LEDs por caractere, 2048/64 = **32 caracteres**
 *                   letra de 5x7 glifos = **9,82 x 13,74 m**
 *     linha pequena: 8 x 4 = 32 LEDs por caractere, 2048/32 = **64 caracteres**
 *                   letra de **4,91 x 6,87 m**
 *
 * O alcance de leitura sai do pixel de glifo, que precisa de ~1,5 px de tela:
 * **1.929 m** para a linha grande, **964 m** para a pequena. Pelo critério mais
 * frouxo da altura da letra (9 px), **2.250 m** e **1.125 m**.
 *
 * ⚠️ NÃO ROLA. A doutrina de design da DogCity proíbe marquee, e a doutrina do
 * dado proíbe qualquer coisa que tiqueteie. O texto fica parado; quem gira é
 * quem olha.
 */
export const SPHERE_CHARS_GRANDE = SPHERE_GRADE_COLS / (8 * FX_GRANDE_ESCALA)   // 32
export const SPHERE_CHARS_PEQUENA = SPHERE_GRADE_COLS / (8 * FX_PEQUENA_ESCALA) // 64

/**
 * ⚠️ O ORÇAMENTO DE CARACTERES DO CONTEÚDO, e ele é apertado.
 *
 * De um azimute só não se lê a volta inteira. Medida a compressão da LARGURA da
 * letra (mesma conta da altura, na tangente de longitude), o arco em que ela
 * fica acima de 0,5 mede, na geometria de 160 m:
 *
 *     200 m     81°     7,2 de 32 casas grandes, 14,5 de 64 pequenas
 *     **300 m   94°     8,4 casas grandes, 16,8 pequenas**
 *     400 m    101°     9,0 casas grandes, 17,9 pequenas
 *   1.000 m    112°    10,0 casas grandes, 20,0 pequenas
 *
 * Como `repetirNaVolta()` distribui `floor(nChars / (len + 1))` cópias e cada
 * cópia ocupa um período de `nChars / cópias` casas, a garantia de ver UMA cópia
 * inteira é **janela ≥ período**. Daí sai o orçamento, e ele DEPENDE DA
 * DISTÂNCIA MÍNIMA que se queira garantir:
 *
 *     garantindo desde 200 m    grande ≤ 5,  pequena ≤ 11
 *     **garantindo desde 300 m  grande ≤ 7,  pequena ≤ 15**
 *
 * ⚠️ ESCOLHIDO O DE 300 m, E A ESCOLHA TEM PREÇO DECLARADO. O de 200 m dá cinco
 * casas para o valor, e cinco casas obrigam o preço do DOG a 2 algarismos
 * significativos (`.00042`), ou seja o preço teria de andar 2,4% para o painel
 * mudar de dígito: um telão com número congelado. Entre isso e mover a garantia
 * de 200 para 300 m, vale mais mover a garantia. Entre 115 e 300 m o leitor pode
 * pegar uma cópia cortada de um lado e precisa andar; a 300 m ele lê a linha
 * grande com 67 px de altura de tela, que é letra enorme.
 *
 * ⚠️ E O ORÇAMENTO APERTOU COM A PEÇA MAIOR, não afrouxou: na esfera de 135 m a
 * janela a 200 m era de 92° e o mesmo 7/15 valia desde os 200. Esfera maior
 * significa que, à mesma distância, se enxerga uma fatia MENOR da circunferência.
 *
 * É por isso que a linha grande carrega o VALOR e a pequena o RÓTULO, e não o
 * contrário: valor é curto e precisa ser visto de todo lado. Texto mais longo
 * continua funcionando, mas vira faixa de leitura por setor (lados diferentes da
 * esfera dizem coisas diferentes), que é uma decisão de conteúdo e não um
 * acidente.
 */
export const SPHERE_ARCO_LEGIVEL_GRAUS = 94
export const SPHERE_ORCAMENTO_DIST_M = 300
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
const COR_ROTULO = '#C6BFB1'   // o mesmo creme do piso da praça (`pracas.ts`)
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
const COR_PAINEL = new THREE.Color('#2A2C33')
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
 * O conteúdo de TESTE desta rodada: números plausíveis, nada ligado em dado
 * vivo. Serve para provar o shader e nada mais.
 *
 * ⚠️ E ELE JÁ RESPEITA O ORÇAMENTO DE CARACTERES medido acima: 7 na linha
 * grande (4 cópias na volta) e 13 na pequena (4 cópias), que é o que garante
 * uma cópia inteira legível de qualquer azimute.
 *
 * ⚠️ GANHO 0,42 É O ESTADO OCIOSO, e ele é sóbrio de propósito. É o contraste
 * entre este número e o do intervalo comercial que separa marco de cidade de
 * bola de discoteca.
 */
export const SPHERE_CONTEUDO_TESTE: SphereConteudo = {
  grande: '0.00042',
  pequena: '$DOG USD SPOT',
  ganho: 0.42,
}

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
    vec3 cor = uPainel * (uAmb + uSolCor * sol + borda * 1.5)
             + conteudo * (sinal * uGanho);
    gl_FragColor = vec4(cor, 1.0);
    #include <fog_fragment>
  }`

/**
 * ⚠️ O MATERIAL LISO É O DEGRAU DE FILLRATE, e ele existe medido. A conta está
 * em `sphereCusto()`: a 300 m a esfera ocupa **29,9° do campo e 23,4%** de uma
 * tela de 1080p, mas **90,0% da tela de um celular** de 390 x 844 em dpr 1,5
 * (eram 25,4°, 16,6% e 64,1% com a esfera de 135 m: crescer para 160 custa 41%
 * mais fragmento à mesma distância, e é no celular que a conta aparece). Cada um
 * desses fragmentos roda o shader completo (duas buscas de textura, um `atan`,
 * um `asin`, dois `log2`), e nessa distância o padrão de ponto já morreu de
 * qualquer jeito, porque um LED ali mede 1,02 px.
 *
 * Então no perfil fraco, além da distância de leitura, a casca troca para ESTE
 * material: mesma cor, mesmo brilho, mesma forma no sol, zero textura e ~6
 * instruções. Não é "sumir": a peça continua inteira, o que sai é o detalhe.
 */
const FS_LISO = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <fog_pars_fragment>
  uniform float uGanho;
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
    gl_FragColor = vec4(uPainel * (uAmb + uSolCor * sol + borda * 1.5)
                        + mix(uMedia, uCorFaixa, naFaixa) * uGanho, 1.0);
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
 *   · `textCull`     distância em que a letra da faixa desvanece para faixa lisa
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
   *  ele tem 174,5 m de diâmetro e é silhueta, não mobiliário. */
  distMiudo: number
  /** suavização da borda do disco, em pixels de tela */
  aa: number
  projetaSombra: boolean
}

export function sphereEscalonamento(p: PerfProfile): SphereEscalonamento {
  // ── malha ──────────────────────────────────────────────────────────────
  // ⚠️ TRIÂNGULO NÃO É O VILÃO AQUI, e a conta prova: com 128 gomos no equador
  // a flecha da corda mede R·(1−cos(1,406°)) = **2,4 cm** numa esfera de 80 m
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

/** Centro e giro do bloco, direto da teia. */
export function sphereSitio(): { x: number; z: number; rumoDeg: number } {
  const c = caixaDoModulo(SPHERE_MOD)
  const am = (c.a0 + c.a1) / 2
  // ⚠️ O CENTRO É O CENTROIDE DO POLÍGONO, NÃO O PONTO POLAR (sin·rm, −cos·rm),
  // e a diferença NÃO é acadêmica: medido em 07/09, o ponto polar cai a **58 m**
  // do centroide de `polyDoModulo`, porque o anel é DODECÁGONO e `raioDodeca()`
  // move os vértices para a face. Com a esfera de 64 m de largura no chão isso
  // passava despercebido; com 147,5 m ela ficava visivelmente encostada num lado
  // do próprio lote, que é metade da queixa de "pequena em relação ao terreno".
  const q = polyDoModulo(SPHERE_MOD)
  return {
    x: q.reduce((a, p) => a + p[0], 0) / q.length,
    z: q.reduce((a, p) => a + p[1], 0) / q.length,
    rumoDeg: (THREE.MathUtils.radToDeg(am) + 360) % 360,
  }
}

/**
 * O polígono do DECK: o módulo encolhido no arco, centrado no lote.
 *
 * ⚠️ NÃO É O MÓDULO INTEIRO, e essa é a correção de 07/09 (ver
 * `SPHERE_DECK_ENCOLHE`). Os lados radiais ficam intactos porque eles SÃO rua; o
 * arco recua `SPHERE_DECK_ENCOLHE` de cada ponta, o que leva o deck de
 * 227,0 x 370,8 para **230,5 x 248,6 m** e faz a esfera ocupar 64,0% da largura
 * dele no radial e 59,3% no arco, contra 28,2% e 17,3% de antes.
 */
export function sphereDeckPoly(): [number, number][] {
  const q = polyDoModulo(SPHERE_MOD)
  const f = SPHERE_DECK_ENCOLHE
  const lerp = (a: [number, number], b: [number, number], k: number): [number, number] =>
    [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  // as arestas 0-1 e 2-3 são as do ARCO (interna e externa); 1-2 e 3-0 são radiais
  return [lerp(q[0], q[1], f), lerp(q[1], q[0], f), lerp(q[2], q[3], f), lerp(q[3], q[2], f)]
}

/**
 * A cota do tabuleiro, MEDIDA no relevo sob o deck.
 *
 * ⚠️ ELA É MEDIDA E NÃO CRAVADA PORQUE A PEÇA VAI MUDAR DE LUGAR. O fundador
 * avisou em 07/09 que estuda trazer a Sphere para perto da praça central; com a
 * cota saindo daqui, trocar `SPHERE_MOD` basta, e a regra da casa (cota MÁXIMA
 * sobre a peça inteira + 0,4 m de margem para o micro-relevo do `terreno=fino`)
 * continua valendo sozinha.
 *
 * Custo MEDIDO com `npx tsx` contra o `heightAt` real da cena: **5,18 ms**, uma
 * vez no boot (uma grade de 4 m sobre 230,5 x 248,6 m são ~3,6 mil chamadas). Os quatro vértices entram à mão porque a quina é
 * onde a cota extrema mora e uma grade pode passar ao lado dela: foi assim que o
 * Estádio furou a própria calçada.
 */
export function sphereAssentar(heightAt: (x: number, z: number) => number): number {
  const q = sphereDeckPoly()
  const dentro = (x: number, z: number) => {
    let s = false
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const [xi, zi] = q[i], [xj, zj] = q[j]
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) s = !s
    }
    return s
  }
  let mx = -Infinity
  for (const p of q) mx = Math.max(mx, heightAt(p[0], p[1]))
  const xs = q.map((p) => p[0]), zs = q.map((p) => p[1])
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 4)
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 4)
      if (dentro(x, z)) mx = Math.max(mx, heightAt(x, z))
  return Math.round((mx + 0.4) * 10) / 10
}

/** O polígono do bloco, que vira máscara de via: a rua para na divisa dele.
 *  ⚠️ Sem isto na lista de parcelas, a teia desenha rua POR DENTRO da peça, que
 *  foi exatamente o defeito que o fundador apontou na chapa do Estádio. */
export function sphereParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(SPHERE_MOD) }
}

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
 */
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
    out += ' '.repeat(esq) + t + ' '.repeat(vao - esq)
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
): { media: THREE.Color; corFaixa: THREE.Color } {
  const g = cv.getContext('2d')!
  const W = cv.width, H = cv.height

  // o corpo: o painel apagado, com um leve gradiente para a esfera ter volume
  // mesmo no estado ocioso. Os polos ficam SÓ para cor, por decisão medida.
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0.00, '#101318')
  grad.addColorStop(0.42, '#1A1D24')
  grad.addColorStop(1.00, '#0C0E12')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  c.pintarCorpo?.(g, W, H)

  // a faixa: um chão levemente aceso, para ela existir mesmo sem texto legível
  const corFaixa = '#241A14'
  const y0 = SPHERE_FAIXA_LINHA0 * f, y1 = SPHERE_FAIXA_LINHA1 * f
  g.fillStyle = corFaixa
  g.fillRect(0, Math.round(y0), W, Math.round(y1 - y0))

  // as duas linhas de texto, posicionadas em LEDs (ver o bloco FX_* acima)
  const lGrande = SPHERE_FAIXA_LINHA0 + FX_MARGEM
  const lPequena = lGrande + 7 * FX_GRANDE_ESCALA + FX_VAO
  escrever(g, c.grande, lGrande, FX_GRANDE_ESCALA, SPHERE_CHARS_GRANDE,
    c.cor ?? COR_DADO, f)
  escrever(g, c.pequena, lPequena, FX_PEQUENA_ESCALA, SPHERE_CHARS_PEQUENA,
    c.corRotulo ?? COR_ROTULO, f)

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
  /** conteúdo inicial; o padrão é o de teste desta rodada */
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
  const conteudo0 = o.conteudo ?? SPHERE_CONTEUDO_TESTE
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
  // sem custo; o embasamento tem **174,5 m de diâmetro** e é ele que dá à peça a
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
  // arte de corpo desliga o degrau: ver a nota em update()
  let temArte = !!conteudo0.pintarCorpo
  return {
    group, casca, base, custo,
    ganhar(g: number) {
      uniformes.uGanho.value = g
    },
    pintar(c: SphereConteudo) {
      const m = pintarTextura(cv, c, f)
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
      const querLiso = d > limite * 1.15
      if (querLiso !== liso) {
        liso = querLiso
        casca.material = liso ? matLiso : matLed
        custo.distLisoM = limite
      }
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
 * `sphereDeckPoly()`, 230,5 x 248,6 m, e a esfera ocupa **64,0% no radial e
 * 59,3% no arco** (75,7% e 70,2% contando o embasamento).
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
 * 0,43 R ela toca numa linha de **147,5 m de largura**, e uma esfera de 160 m
 * cortando um plano liso lê como bug de modelagem, não como arquitetura. A de
 * Las Vegas resolve isso com o embasamento do edifício, e é o mesmo recurso:
 *
 *     pódio    anel de 14,0 m de largura, **2,2 m** de altura, de r 73,23 a
 *              r 87,23. Terraço caminhável em volta da base.
 *     colar    chanfro de 3,0 m de largura e 1,2 m de altura sobre o pódio,
 *              inclinado a **25,8°**, subindo até encostar na esfera em r 73,75.
 *              É ele que faz a esfera EMERGIR de um bisel em vez de furar um
 *              plano.
 *
 * Medido: sobram **111,0 m de esfera acima do topo do colar, 69,4% da altura
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
