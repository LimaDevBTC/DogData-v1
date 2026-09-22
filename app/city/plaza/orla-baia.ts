/**
 * A ORLA DA BAÍA — a arquibancada que olha a alça.
 *
 * ⚠️ NÃO CONFUNDIR COM `orla.ts`, QUE É OUTRA COISA. `orla.ts` é a arborização
 * da Orla Nobre (as palmeiras do canteiro da avenida da alça, r 6.950). Este
 * arquivo é o CHÃO da margem oposta da baía, onde moram os tiers 4 e 5.
 *
 * ── por que ela existe ──────────────────────────────────────────────────────
 * A alça (`alca.ts`) é a FACHADA da baía e tem 511 endereços. Esta é a margem
 * que a vê, e é o único endereço de água possível para as 2.062 carteiras dos
 * tiers 4 (Ordinal Believer, 713) e 5 (DOG Supporter, 1.349), que o caderno
 * `tiersposition.md` §3.3 mandou para cá em 10/09/2026.
 *
 * ── por que a linha d'água é IMPOSTA, e não a margem natural ────────────────
 * MEDIDO na margem interna da baía: ela varia de r 3.400 a 5.720 e o terreno
 * atrás fica entre −15 e −40, quase na lâmina (−40). Uma margem que serpenteia
 * 2.300 m não dá fileira contínua nem praia decente, e foi exatamente esse o
 * diagnóstico do fundador ("a margem é sinuosa demais"). A saída é a MESMA que
 * a alça já usa e que já está na cena: um CÍRCULO fixo de linha d'água, com
 * rampa espelhada dos dois lados, para que avançar sobre a água (ou sobre a
 * terra) seja o objetivo e não o erro a evitar. Ver o cabeçalho de
 * `ALCA_R_BAIA` em `alca.ts`, que é o mesmo gesto na margem de lá.
 *
 * ── o desenho, em quatro peças ──────────────────────────────────────────────
 * 1. A PRAIA IMPOSTA em r 4.800, nos dois setores de 40° que flanqueiam o eixo.
 * 2. A ENSEADA de 20° no eixo 51,3° (o eixo do Founders Club, o mesmo centro do
 *    arco da alça): a linha d'água mergulha até r 3.780 e volta, num seno, sem
 *    degrau. Ali não nasce lote NENHUM: é praia pública, e é ela que devolve a
 *    aproximação de barco à ilha do mirante (§11.4) que o círculo de 4.800
 *    teria estrangulado.
 * 3. QUATRO DEDOS (penínsulas) em 11,3 / 31,3 / 71,3 / 91,3, passo igual de
 *    20°. O slot central (51,3) fica VAGO de propósito, porque ele é a enseada:
 *    excluir em vez de desalinhar, que é a regra de simetria da casa.
 * 4. DOIS ANÉIS DE CANAL atrás da praia, que transformam uma fileira de frente
 *    d'água em CINCO.
 *
 * ── a ordem de chamada importa, e isso é armadilha medida ───────────────────
 * `alcaAlturaAt` cava o leito da baía a −44 em TODO r entre 5.700 e 6.500 do
 * arco dela, e o arco dela (346° a 116,5°) contém o nosso inteiro. Se esta
 * função rodasse ANTES, a alça apagaria as pontas dos dedos, que chegam a
 * 6.050. Por isso em `terrain.ts` a chamada é aninhada, esta por fora:
 * `orlaBaiaAlturaAt(x, z, alcaAlturaAt(x, z, ...))`.
 *
 * ── e o que ela NÃO faz ─────────────────────────────────────────────────────
 * Não toca na ilha do mirante nem em nenhuma outra ilha da baía. Fora da rampa
 * espelhada o chão volta ao natural numa saia de 250 m, então só some o que
 * estiver a menos de 250 m da nova linha d'água. MEDIDO: a ponta do dedo mais
 * próximo fica a 530 m da praia da alça, com folga de sobra.
 */
import { ALCA_PLATAFORMA_Y, ALCA_AGUA } from './alca'

/**
 * O ARCO DA ORLA, em rumo de bússola da cidade. 100° de abertura, simétrico no
 * eixo 51,3°. Por que 100 e não mais: a regra de área (curva publicada com piso
 * de 60 m de fundo) faz da testada um TETO, não uma meta, e em 102° o fundo do
 * tier 5 cairia para 59,9 m e furaria o piso. Alargar o arco não dá lote maior,
 * dá lote mais raso.
 */
export const ORLA_BAIA_ARCO: [number, number] = [1.3, 101.3]

/**
 * O EIXO, que é o centro do arco e também o centro do arco da alça
 * (`ALCA_TERRA` = 346 → 116,5 tem centro em 51,25). Os dois desenhos olham um
 * para o outro pelo mesmo eixo, e é isso que faz a baía ler como uma sala.
 */
export const ORLA_BAIA_EIXO = 51.3

/** A enseada: 20° centrados no eixo, onde a linha d'água mergulha. */
export const ORLA_BAIA_ENSEADA: [number, number] = [41.3, 61.3]

/**
 * O CÍRCULO DA LINHA D'ÁGUA, fixo nos dois setores de 40°. Mesmo critério do
 * `ALCA_R_BAIA` da margem de lá: o ponto em que o movimento de terra fica
 * equilibrado entre escavar e aterrar, medido contra a margem real.
 */
export const ORLA_BAIA_R_AGUA = 4800

/**
 * O CÍRCULO DA ENSEADA. 1.020 m mais para dentro, o que devolve 1.370 m de
 * aproximação à ilha contra os 350 m que o círculo de 4.800 deixaria.
 */
export const ORLA_BAIA_R_ENSEADA = 3780

/**
 * A LARGURA DA PRAIA, e ela sai da conta, igual à da alça: 10 m entre a lâmina
 * (−40) e a plataforma (−30) a 1:8 dá 80 m de corrida.
 */
export const ORLA_BAIA_PRAIA = 80

/** A cota da plataforma e a da lâmina, as MESMAS da alça: uma água só. */
export const ORLA_BAIA_PLATAFORMA_Y = ALCA_PLATAFORMA_Y
export const ORLA_BAIA_AGUA = ALCA_AGUA
/** O fundo escavado, 4 m abaixo da lâmina — o padrão de leito de canal da casa. */
export const ORLA_BAIA_LEITO_Y = ALCA_AGUA - 4

/** O pé da praia, que é a testada da primeira fileira: 4.800 − 80. */
export const ORLA_BAIA_R_FRENTE = ORLA_BAIA_R_AGUA - ORLA_BAIA_PRAIA

/**
 * A BORDA INTERNA DO DISTRITO, e a seção que leva até ela.
 *
 * ⚠️ A AVENIDA DO CINTURÃO MANDA NA SEÇÃO, E ISSO FOI MEDIDO. O AN4 é um anel
 * viário de verdade em r 4.450 com 30 m de caixa, e ele atravessa este
 * distrito inteiro. A primeira seção que eu desenhei ignorou isso e pôs a
 * fileira do meio em r 4.444, dentro da caixa dele: 530 das 2.679 sondagens
 * (20%) foram reprovadas por anel, e a fileira C inteira, 6,1 km de testada,
 * morreu calada.
 *
 * Desviar o anel foi descartado: ele é círculo por decisão publicada e desviá-lo
 * aqui reabriria a discussão do dodecágono. A saída é a melhor das duas de
 * qualquer jeito — **o AN4 vira o bulevar do distrito**, com fileira de cada
 * lado. Toda orla que funciona tem uma arterial atrás dela.
 *
 * ⚠️ E TODA FILEIRA TEM RUA NA TESTADA. A primeira seção não tinha: eram cinco
 * fileiras encostadas em praia e canal, sem uma via. Lote com testada para a
 * água e nenhuma rua é lote sem endereço, e a teia genérica (27 anéis × 168
 * radiais) NÃO serve aqui — ela é dodecágono e a fileira é círculo, então as
 * duas se cruzam em ângulo. O distrito sai da teia (ver `naOrlaDaBaia`) e
 * carrega as próprias vias, como a alça já faz com a AN7.
 *
 *   4.800  linha d'água
 *   4.720  pé da praia
 *   4.708  a Rua da Praia (12 m, entre a areia e o lote): testada de A
 *   4.640  fundo de A, que encosta no fundo de B
 *   4.572  testada de B (tier 5)
 *   4.560  a Rua do Canal Norte (12 m)
 *   4.470  a outra borda seca do canal 1  (eixo em 4.515, corredor 90)
 *   4.467  a caixa do AN4 começa (4.450 ± 15, mais 2 m de margem)
 *   4.433  a caixa do AN4 acaba — ELA É a via da fileira C
 *   4.430  testada de C (tier 5, olha o bulevar)
 *   4.362  fundo de C, que encosta no fundo de D
 *   4.294  testada de D (tier 5)
 *   4.282  a Rua do Canal Sul (12 m)
 *   4.192  a outra borda seca do canal 2  (eixo em 4.237, corredor 90)
 *   4.180  testada de E (tier 5)
 *   4.112  fundo de E, que encosta no fundo de F
 *   4.044  testada de F (tier 5, olha a Rua de Trás)
 *   4.038  a Rua de Trás (12 m)
 *   4.030  a borda interna do distrito
 */
export const ORLA_BAIA_R_FUNDO = 4030

/**
 * A PROFUNDIDADE DE FILEIRA, e aqui ela é FIXA, ao contrário da Orla Nobre.
 *
 * ⚠️ A REGRA DE ÁREA SE INVERTEU, E ISSO FOI MEDIDO. O esboço de 21/09 pedia
 * testada fixa com fundo pela curva, que é o que a alça faz. Medido contra o
 * snapshot, não fecha aqui: o maior Ordinal Believer tem 7.997 m² prometidos e
 * a 24 m de testada isso pede 330 m de fundo, cinco vezes a seção inteira do
 * distrito. Numa faixa estreita entre a praia e o canal quem NÃO pode variar é
 * o fundo. Então: fundo travado em 68 m, testada = área ÷ 68.
 *
 * O efeito colateral é bom e é o que dá para prometer: cada lote recebe a área
 * publicada EXATA, sem piso e sem teto, e a razão entregue/prometida do
 * distrito é 1,000 por construção. A testada vira o que varia — 13,7 m no menor
 * DOG Supporter e 117,6 m no maior Ordinal Believer — e é ela que conta a
 * história de quem tem quanto, que é exatamente o que uma orla faz.
 */
export const ORLA_BAIA_FILEIRA_PROF = 68

/**
 * A TESTADA MÍNIMA. Abaixo disto não é lote, é corredor. MEDIDO: nenhuma
 * carteira dos dois tiers chega perto (o menor pede 13,7 m), então este piso
 * hoje não distorce um único lote — ele está aqui para o dia em que a curva ou
 * o snapshot mudarem.
 */
export const ORLA_BAIA_TESTADA_MIN = 12

/**
 * O RECUO DE DIVISA DE FUNDO, e ele existe porque duas fileiras de costas com
 * o fundo EXATAMENTE na mesma linha se atravessam.
 *
 * ⚠️ MEDIDO em 22/09 pelo teste novo do portão: 141 pares de lotes sobrepostos
 * na orla, todos entre fileiras de costas (A×B, C×D, E×F), o pior com 0,41 m.
 * A causa é geométrica e não tem a ver com o canto (esse é o §23): o fundo de
 * cada lote é uma reta TANGENTE ao círculo do encontro, e duas tangentes em
 * rumos diferentes se cruzam. Com as duas fileiras encostando na mesma linha,
 * qualquer diferença de rumo já produz cruzamento.
 *
 * O recuo resolve sem custar um metro de testada: o retângulo inteiro anda
 * meio metro na direção da rua, então o fundo fica 0,5 m aquém da linha e a
 * folga entre as duas fileiras é 1 m. A rua perde 0,5 m de cada lado (12 vira
 * 11), que é recuo de calçada, não de lote.
 */
export const ORLA_BAIA_RECUO_FUNDO = 0.5

/**
 * AS CINCO TESTADAS, de fora para dentro: raio, sentido de crescimento (+1 para
 * fora, −1 para dentro) e a que tier a fileira pertence. É esta lista que o
 * gerador lê: mudar a seção aqui muda o loteamento lá, sem cópia.
 */
export const ORLA_BAIA_FILEIRAS: ReadonlyArray<{ r: number; sentido: 1 | -1; tier: 4 | 5 }> = [
  { r: 4708, sentido: -1, tier: 4 },   // A, a Rua da Praia
  { r: 4572, sentido: +1, tier: 5 },   // B, a Rua do Canal Norte
  { r: 4430, sentido: -1, tier: 5 },   // C, o bulevar (AN4)
  { r: 4294, sentido: +1, tier: 5 },   // D, a Rua do Canal Sul
  { r: 4180, sentido: -1, tier: 5 },   // E, a Rua do Canal Sul de dentro
  // ⚠️ A FILEIRA F NASCEU EM 22/09 PARA PAGAR OS DOIS DEDOS QUE O ARQUIPÉLAGO
  // TIROU. Ela não tem água na frente, tem rua, e por isso é a menos nobre do
  // distrito — mas continua sendo endereço de tier 5, que é o que o §3.3 do
  // caderno promete. MEDIDO: os dois dedos perdidos custavam 5.720 m de
  // testada e ela devolve 5.647.
  { r: 4044, sentido: +1, tier: 5 },   // F, a Rua de Trás
]

/**
 * OS DEDOS, E ELES VIRARAM DOIS, NÃO QUATRO. Isto é conserto medido de 22/09 e
 * a causa é a que ninguém tinha olhado: **a baía em frente ao distrito não é
 * água aberta, é um arquipélago.**
 *
 * MEDIDO contra `ILHAS` em `ilhas.ts`, que é onde as ilhas são declaradas:
 *
 *   IL01 Ilha do Fundador   costa nos rumos 28 a 44,  r 4.670 a 6.520
 *   IL02 Ilha Norte         costa nos rumos 50 a 60,  r 5.470 a 6.460
 *   IL04 Ilha Leste         costa nos rumos 66 a 70,  r 5.770 a 6.430
 *
 * Com o pente de 20° do desenho aprovado, o dedo de 31,3° entrava 91 m DENTRO
 * da Ilha do Fundador e o de 71,3° dentro da Ilha Leste. Medido de outro jeito:
 * pedindo 200 m de folga, o dedo de 31,3 só podia ir até r 4.810, ou seja 90 m
 * de península, e o de 71,3 até 5.800.
 *
 * ⚠️ E O PENTE DE QUATRO É GEOMETRICAMENTE IMPOSSÍVEL AQUI, não é questão de
 * gosto. Com passo igual e o slot do meio vago, o par interno fica em 51,3 ± S.
 * Para limpar a Ilha do Fundador (que vai até o rumo 44) o par interno precisa
 * de S ≥ 25,3; aí o par externo cai em 51,3 − 2S ≤ 0,7, fora do arco, que
 * começa em 1,3. Não existe S que sirva para os dois pares.
 *
 * Então vale a regra do fundador ao pé da letra: elementos repetidos igualmente
 * espaçados, e **excluir é melhor do que desalinhar**. Exclui-se o par interno
 * inteiro (31,3 e o espelho dele, 71,3) e ficam dois dedos em 11,3 e 91,3, a
 * 80° um do outro, espelhados no eixo 51,3 e AMBOS livres até r 6.400. O miolo
 * da baía fica para a enseada e para o arquipélago, que é o que ele já é.
 *
 * O que isso custa em testada está pago pela fileira F, que nasceu no mesmo
 * conserto (ver `ORLA_BAIA_FILEIRAS`).
 */
export const ORLA_BAIA_DEDO_RUMOS: readonly number[] = [11.3, 91.3]

/**
 * A SEÇÃO DO DEDO, 182 m: cais 17 + lote 68 + rua 12 + lote 68 + cais 17.
 *
 * ⚠️ O DEDO NÃO TEM PRAIA, E ESSA FOI A SEGUNDA CORREÇÃO MEDIDA DE 21/09. A
 * primeira versão dava a ele a mesma rampa 1:8 de 80 m da costa. Numa
 * península de 166 m de largura os 80 m de cada lado se encontram no meio: o
 * dedo inteiro virava praia, com 12,5% de declive de ponta a ponta, e as 817
 * reprovações por declive (31% das sondagens) eram TODAS ele. Nenhum lote
 * nasceu nos quatro dedos e ninguém avisou.
 *
 * A lateral do dedo é CAIS, não praia: 15 m de enrocamento para vencer os
 * mesmos 10 m, mais 2 m de recuo até a divisa. É o que um píer urbano é, e é o
 * que a palavra "cais" já dizia no desenho aprovado.
 */
export const ORLA_BAIA_DEDO_LARGURA = 182
export const ORLA_BAIA_DEDO_CAIS = 17
/** O enrocamento da lateral do dedo: 10 m de queda em 15 m de corrida. */
export const ORLA_BAIA_CAIS_TALUDE = 15
/**
 * A PONTA DO DEDO, e ela é conta de testada, não gosto. O esboço de 21/09 dizia
 * 6.050. MEDIDO com o desenho fechado: a 6.150 sobrava 0,1 km de linha em 42,0
 * e UMA carteira dos 2.062 ficava de fora. Depois veio o conserto do canto do
 * retângulo (ver `_testada_no_anel` no gerador), que come mais 1,5% de arco nas
 * três fileiras que crescem para dentro. Em 6.300 a folga volta para uns 0,4 km.
 * Deixa 280 m de lâmina até a praia da alça (6.580), que é canal navegável, e
 * os dois dedos estão medidos livres de ilha até r 6.400.
 */
export const ORLA_BAIA_DEDO_PONTA = 6300

/**
 * OS DOIS ANÉIS DE CANAL, pelos eixos. Seção: fundo chato de 44 m na cota −44,
 * talude de 23 m de cada lado até a plataforma (−30), 90 m de corredor no
 * total. A lâmina sai com **57 m**, que é praticamente o padrão arterial da
 * casa (`CANAL_ANEL_SEC`, 60), num corredor bem menor (90 contra 140) — é o
 * que deixa as fileiras caberem entre a praia e o AN4.
 *
 * ⚠️ A LÂMINA NÃO PODE SER ESTREITA, E ISSO NÃO É GOSTO. A primeira versão
 * tinha 47 m de lâmina. A malha de água da cena (`lagos.ts`) amostra a 30 m:
 * uma lâmina de 47 m é uma célula e meia e desenha fita picotada, não canal.
 * Com 57 m são quase duas células cheias. O talude ficou mais íngreme (14 m em
 * 23, ou 61%), que é enrocamento de canal, a mesma ordem do cais do dedo.
 */
export const ORLA_BAIA_CANAL_EIXOS: readonly number[] = [4515, 4237]
export const ORLA_BAIA_CANAL_FUNDO = 44
export const ORLA_BAIA_CANAL_TALUDE = 23

/**
 * A COSTA DAS TRÊS ILHAS QUE CAEM NA JANELA DA ORLA, como tabela polar no
 * quadro LOCAL de cada uma, com 60 m de margem já somados.
 *
 * ⚠️ POR QUE ISTO EXISTE, E É UM DEFEITO QUE QUASE FOI PUBLICADO. As ilhas da
 * baía são MALHA À PARTE (`ilhas.ts`), não entram em `heightAt`: para o
 * gerador, o chão debaixo da Ilha do Fundador é o mesmo chão da praia. Sem esta
 * máscara o loteamento plantava 427 m de testada da fileira A DENTRO da ilha do
 * fundador, e nem o gerador nem o portão veriam problema nenhum, porque os dois
 * medem cota e a ilha não tem cota.
 *
 * ⚠️ E É TABELA, NÃO DISCO NEM ELIPSE, e isso também foi medido. Um disco que
 * cobre a Ilha do Fundador inteira tem 1.168 m e alcança r 4.522, comendo a
 * fileira B; a elipse apertada ainda alcança 4.522. A costa real só chega a
 * 4.670. A ilha é um blobe de três domos, não uma forma analítica, então a
 * máscara é a costa MEDIDA em 72 baldes de 5°, cada balde com o maior raio
 * amostrado nele e nos dois vizinhos.
 *
 * Fonte: `campoIlha()` de `ilhas.ts`, amostrada em 2.880 direções, 2026-09-22.
 * Se `ILHAS` mudar, esta tabela tem de ser regerada — ela é cópia MEDIDA de uma
 * fonte procedural, que é o único jeito de o gerador em Python enxergar a
 * mesma costa que a cena desenha.
 */
export const ORLA_BAIA_ILHAS: ReadonlyArray<{ id: string; x: number; z: number; giro: number; r: readonly number[] }> = [
  { id: 'IL01', x: 3509, z: -4308, giro: 240, r: [1218,970,970,970,925,966,997,1025,1029,1029,1029,910,910,910,1014,1014,1014,1005,992,978,963,946,926,738,694,621,659,659,659,566,514,288,299,311,326,342,361,381,404,612,744,824,878,914,937,950,955,956,956,956,955,952,945,937,927,915,919,957,968,968,1085,1090,1090,1209,1211,1211,1211,1061,1061,1229,1229,1229] },
  { id: 'IL02', x: 4875, z: -3316, giro: 90, r: [607,586,564,561,563,563,563,542,511,478,447,420,441,476,512,548,581,610,637,662,684,702,712,712,712,707,716,716,716,715,719,719,719,716,687,646,593,531,456,175,173,179,190,466,514,555,589,618,642,662,678,691,701,713,723,727,728,728,728,728,727,720,657,621,620,651,669,669,669,668,651,632] },
  { id: 'IL04', x: 5669, z: -2201, giro: 330, r: [425,423,408,358,339,339,362,368,368,368,368,367,364,360,345,333,325,317,311,315,320,328,338,362,367,370,370,370,370,370,368,362,352,337,314,302,305,321,382,384,384,384,385,389,447,447,447,447,445,442,438,433,419,394,391,412,418,419,419,419,419,418,417,413,407,400,403,417,422,425,425,425] },
]

/** Está dentro (ou na margem) de uma das ilhas declaradas da baía? */
export function naIlhaDaBaia(px: number, pz: number): boolean {
  for (const il of ORLA_BAIA_ILHAS) {
    const dx = px - il.x, dz = pz - il.z
    const d2 = dx * dx + dz * dz
    if (d2 > 1600 * 1600) continue            // porta rápida: nenhuma passa disso
    const g = (il.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const sx = dx * cg + dz * sg, sz = -dx * sg + dz * cg
    let th = Math.atan2(sz, sx)
    if (th < 0) th += Math.PI * 2
    const b = Math.min(il.r.length - 1, Math.floor((th / (Math.PI * 2)) * il.r.length))
    if (Math.sqrt(d2) <= il.r[b]) return true
  }
  return false
}

/**
 * A LARGURA DA RUA DO DISTRITO: 12 m, a mesma rua da teia que a cidade inteira
 * usa (asfalto de 6 a 10 m com meio-fio de 15 cm).
 */
export const ORLA_BAIA_RUA = 12

/**
 * AS VIAS EM ARCO DO DISTRITO, no formato que `vias.ts` já sabe desenhar
 * (`circulo` mais `arco`, o mesmo par da AN7 da alça). São círculos de verdade,
 * não dodecágonos: a fileira é círculo e a rua da fileira tem de ser o mesmo
 * círculo, senão as duas se cruzam em ângulo.
 *
 * A fileira C não aparece aqui porque a via dela É o AN4, a Avenida do
 * Cinturão, que já é desenhada como anel viário da cidade.
 */
export const ORLA_BAIA_VIAS: ReadonlyArray<{ id: string; nome: string; r: number; larg: number }> = [
  { id: 'OB1', nome: 'Rua da Praia', r: 4714, larg: ORLA_BAIA_RUA },
  { id: 'OB2', nome: 'Rua do Canal Norte', r: 4566, larg: ORLA_BAIA_RUA },
  { id: 'OB3', nome: 'Rua do Canal Sul', r: 4288, larg: ORLA_BAIA_RUA },
  { id: 'OB4', nome: 'Rua do Canal Sul Interna', r: 4186, larg: ORLA_BAIA_RUA },
  { id: 'OB5', nome: 'Rua de Trás', r: 4038, larg: ORLA_BAIA_RUA },
]

/**
 * A ESPINHA DO DEDO: a via de 12 m no eixo de cada península, da Rua da Praia
 * até a ponta. É por ela que se chega ao lote do dedo — o lote tem TESTADA na
 * água e ACESSO pelos fundos, que é o arranjo normal de frente d'água e o mesmo
 * da fileira de trás da Orla Nobre.
 */
export const ORLA_BAIA_DEDO_ESPINHA_LARG = ORLA_BAIA_RUA

/**
 * ⚠️ A MÁSCARA QUE TIRA A TEIA DAQUI, irmã de `naAlcaDeTerra` em `teia.ts` e
 * pelo mesmo motivo medido lá. A teia da cidade é dodecágono de 27 anéis por
 * 168 radiais; o distrito é feito de círculos. MEDIDO: dois anéis da teia
 * atravessam as fileiras (4.281 e 4.520 de vértice, 4.307 e 4.547 de face) e,
 * como vértice e face diferem 2,3%, eles cortam o lote em diagonal rumo a rumo.
 *
 * Quem pergunta é o bulevar, a teia local e a via de orla, nunca o anel
 * circular — a Rua da Praia e as ruas de canal SÃO as vias daqui.
 */
export function naOrlaDaBaia(px: number, pz: number): boolean {
  const r = Math.hypot(px, pz)
  if (r < ORLA_BAIA_R_FUNDO - 20 || r > ORLA_BAIA_DEDO_PONTA + 120) return false
  let ang = Math.atan2(px, -pz) * 180 / Math.PI
  if (ang < 0) ang += 360
  return ang >= ORLA_BAIA_ARCO[0] && ang <= ORLA_BAIA_ARCO[1]
}

/**
 * A FRANJA DAS PONTAS DO ARCO e a SAIA sobre a água, as duas em metros de
 * corrida. Mesmo papel da `ALCA_FRANJA_PONTAS`: a terraplanagem morre no
 * terreno natural sem degrau.
 */
export const ORLA_BAIA_FRANJA = 250
export const ORLA_BAIA_SAIA = 250

/** ⚠️ CHAVE DE DIAGNÓSTICO: `?orlabaia=0` desliga a terraplanagem inteira. */
const _flag = typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('orlabaia') ?? '')
export const ORLA_BAIA_CHAO = _flag !== '0'

const _suave = (k: number) => k * k * (3 - 2 * k)

// ── a porta rápida ───────────────────────────────────────────────────────────
// ⚠️ ANTES DE QUALQUER CONTA, pelo mesmo motivo que `alca.ts` documenta: esta
// função é chamada de dentro de `heightAt`, que é o trava-chão da câmera a todo
// quadro e o pouso de toda peça, poste e árvore. Comparação de raio AO QUADRADO
// (sem `Math.hypot`, que trata estouro e desnormal e não é embutido no V8) e só
// quem passa nela paga o `atan2`.
//
// Os limites saem da geometria, com folga: para dentro, a enseada cava até
// 3.780 e a praia dela desce a 3.700, mais a saia de 250 → 3.450, arredondado
// para 3.400. Para fora, a ponta do dedo é 6.050, mais praia 80 e rampa
// espelhada 80 → 6.310, mais saia 250 → 6.560, arredondado para 6.600.
const _R_GATE_DENTRO = 3400
const _R_GATE_FORA = 6600
const _R2_GATE_DENTRO = _R_GATE_DENTRO * _R_GATE_DENTRO
const _R2_GATE_FORA = _R_GATE_FORA * _R_GATE_FORA

/**
 * A LINHA D'ÁGUA NESTE RUMO. Fora da enseada é o círculo de 4.800; dentro dela
 * mergulha até 3.780 por um seno, que vale ZERO nas duas bordas — é isso que
 * impede a parede radial de 1.020 m que um degrau entre os dois círculos
 * criaria.
 */
export function orlaBaiaLinhaDagua(anguloGraus: number): number {
  const [e0, e1] = ORLA_BAIA_ENSEADA
  if (anguloGraus <= e0 || anguloGraus >= e1) return ORLA_BAIA_R_AGUA
  const t = (anguloGraus - e0) / (e1 - e0)
  return ORLA_BAIA_R_AGUA - (ORLA_BAIA_R_AGUA - ORLA_BAIA_R_ENSEADA) * Math.sin(Math.PI * t)
}

/**
 * A COTA DO CANAL a este raio, ou `null` se o ponto não está sobre canal
 * nenhum. Vale só para os dois anéis; quem chama já garantiu que ali é
 * plataforma seca.
 */
function _canalCota(r: number): number | null {
  const meiaAgua = ORLA_BAIA_CANAL_FUNDO / 2
  const meiaTudo = meiaAgua + ORLA_BAIA_CANAL_TALUDE
  for (const eixo of ORLA_BAIA_CANAL_EIXOS) {
    const d = Math.abs(r - eixo)
    if (d >= meiaTudo) continue
    if (d <= meiaAgua) return ORLA_BAIA_LEITO_Y
    const k = (d - meiaAgua) / ORLA_BAIA_CANAL_TALUDE
    return ORLA_BAIA_LEITO_Y + (ORLA_BAIA_PLATAFORMA_Y - ORLA_BAIA_LEITO_Y) * k
  }
  return null
}

/**
 * A DISTÂNCIA ASSINADA ATÉ A COSTA, em metros: positiva em terra, negativa
 * sobre a água. Só a costa — o dedo tem régua própria, porque tem beira
 * própria.
 */
export function orlaBaiaDistCosta(r: number, anguloGraus: number): number {
  return orlaBaiaLinhaDagua(anguloGraus) - r
}

/**
 * A DISTÂNCIA ASSINADA ATÉ O DEDO MAIS PRÓXIMO, pela mesma convenção. Fora de
 * qualquer dedo devolve um número muito negativo, para que o `max` com a costa
 * o ignore sem ramo extra.
 */
export function orlaBaiaDistDedo(r: number, anguloGraus: number): number {
  let d = -1e9
  for (const rumo of ORLA_BAIA_DEDO_RUMOS) {
    let g = anguloGraus - rumo
    if (g > 180) g -= 360
    if (g < -180) g += 360
    if (Math.abs(g) > 20) continue        // nenhum dedo tem 20° de meia-largura
    const perp = Math.abs(Math.sin(g * Math.PI / 180)) * r
    d = Math.max(d, Math.min(ORLA_BAIA_DEDO_LARGURA / 2 - perp, ORLA_BAIA_DEDO_PONTA - r))
  }
  return d
}

/**
 * O PERFIL DE BEIRA, e ele é UM só com duas larguras de corrida. `L` é quanto
 * a beira leva para vencer os 10 m entre a lâmina e a plataforma: 80 m na
 * praia da costa (1:8, areia) e 15 m no cais do dedo (enrocamento). Abaixo da
 * lâmina o mesmo `L` desce até o leito, que é a rampa espelhada — ela é o que
 * impede que avançar sobre a água vire parede.
 */
function _perfilBeira(d: number, L: number): number {
  if (d >= L) return ORLA_BAIA_PLATAFORMA_Y
  if (d >= 0) return ORLA_BAIA_AGUA + (ORLA_BAIA_PLATAFORMA_Y - ORLA_BAIA_AGUA) * (d / L)
  if (d >= -L) return ORLA_BAIA_AGUA + (ORLA_BAIA_LEITO_Y - ORLA_BAIA_AGUA) * (-d / L)
  return ORLA_BAIA_LEITO_Y
}

/**
 * ⚠️ O CONTRATO É O DA ALÇA, PALAVRA POR PALAVRA: recebe a cota que o terreno
 * (e quem já esculpiu antes) entrega neste ponto e devolve a cota final. Fora
 * da janela devolve `natural` bit a bit, para que somar esta parcela a
 * `heightAt` não mude um único ponto do resto do mapa.
 */
export function orlaBaiaAlturaAt(x: number, z: number, natural: number): number {
  if (!ORLA_BAIA_CHAO) return natural
  const r2 = x * x + z * z
  if (r2 <= _R2_GATE_DENTRO || r2 >= _R2_GATE_FORA) return natural

  // ⚠️ CONVENÇÃO DE ÂNGULO IDÊNTICA À DE `alca.ts` E `teia.ts`: rumo de bússola
  // da cidade, x = leste, z = sul, `atan2(x, -z)`.
  let ang = Math.atan2(x, -z) * 180 / Math.PI
  if (ang < 0) ang += 360
  const [a0, a1] = ORLA_BAIA_ARCO
  const r = Math.sqrt(r2)
  // a franja é medida em METROS de arco no próprio raio do ponto, não em graus
  // fixos: um grau vale metros diferentes conforme o raio, e é medir em metros
  // que dá franja de largura constante ao longo do arco.
  const grausDaFranja = (ORLA_BAIA_FRANJA * 180) / (Math.PI * r)
  if (ang < a0 - grausDaFranja || ang > a1 + grausDaFranja) return natural

  // ⚠️ DUAS BEIRAS, DOIS PERFIS, E A TERRA GANHA. A costa tem praia de 80 m e
  // o dedo tem cais de 15; cada um vira uma cota-alvo pelo seu próprio perfil e
  // a maior das duas vence, que é o jeito certo de unir duas formas de terra.
  // Onde o dedo cruza a praia da costa ele fica 5 m acima dela, que é o que uma
  // restinga construída é de verdade.
  const dCosta = orlaBaiaDistCosta(r, ang)
  const dDedo = orlaBaiaDistDedo(r, ang)
  const distTerra = Math.max(dCosta, dDedo)

  let alvo = Math.max(_perfilBeira(dCosta, ORLA_BAIA_PRAIA),
                      _perfilBeira(dDedo, ORLA_BAIA_CAIS_TALUDE))
  if (distTerra >= ORLA_BAIA_PRAIA) {
    // ⚠️ O CANAL SÓ CAVA PLATAFORMA CHEIA. Na beira ele não entra: cavar a 20 m
    // da linha d'água abriria a lâmina do canal para a baía por baixo da praia.
    const canal = _canalCota(r)
    if (canal !== null) alvo = Math.min(alvo, canal)
  } else if (distTerra < -ORLA_BAIA_PRAIA) {
    // ⚠️ AQUI HAVIA UMA SAIA DE VOLTA AO NATURAL, E ELA ERA UM DEFEITO GRANDE.
    //
    // A ideia era preservar as ilhas: passados os 80 m da rampa espelhada, o
    // fundo escavado voltava ao terreno natural em 250 m. MEDIDO em 22/09 pelo
    // próprio gerador: em **165 de 165 rumos** do arco sobrava terra entre a
    // linha d'água nova e a baía de verdade, com uma barra de até 760 m no rumo
    // 6,3°. Ou seja a praia imposta olhava para um banco de areia, e os dois
    // anéis de canal ficavam presos atrás dele: só 14% a 17% da lâmina deles
    // chegava à baía. Canal que não desagua é vala.
    //
    // A causa é aritmética: a margem natural da baía varia de r 3.400 a 5.720, e
    // onde ela está longe da linha imposta o terreno natural entre as duas está
    // ACIMA da lâmina. Devolver ao natural é devolver terra dentro d'água.
    //
    // A saia não era necessária nem para as ilhas: elas são malha à parte
    // (`ilhas.ts`), com saia própria até a cota −62, e não dependem deste chão.
    //
    // A regra agora é a da alça: do lado da água a orla NUNCA levanta o chão,
    // só abaixa. `min` com o natural garante que a lâmina exista sem
    // sobre-escavar onde a baía já é funda.
    alvo = Math.min(natural, ORLA_BAIA_LEITO_Y)
  }

  // ⚠️ A SAIA PARA DENTRO. A plataforma tem de morrer no terreno natural da
  // cidade sem degrau, e a borda interna NÃO é a mesma em todo rumo: na enseada
  // ela é o pé da praia de lá, não os 4.120 dos flancos.
  const rInterno = Math.min(ORLA_BAIA_R_FUNDO, orlaBaiaLinhaDagua(ang) - ORLA_BAIA_PRAIA)
  if (r < rInterno) {
    const k = _suave(Math.min(1, (rInterno - r) / ORLA_BAIA_SAIA))
    alvo = alvo * (1 - k) + natural * k
  }

  // a franja das duas pontas do arco
  const distBordaGraus = Math.min(ang - a0, a1 - ang)
  const distBordaMetros = distBordaGraus * (Math.PI / 180) * r
  const kFranja = distBordaMetros >= ORLA_BAIA_FRANJA
    ? 1
    : _suave(Math.max(0, distBordaMetros) / ORLA_BAIA_FRANJA)

  return natural * (1 - kFranja) + alvo * kFranja
}
