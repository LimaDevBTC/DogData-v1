// ═══════════════════════════════════════════════════════════════════════════
// A ALÇA: a faixa de terra dentro da baía que vira o bairro de mansões da orla.
//
// DECISÃO DO FUNDADOR, 09/09/2026: terraplanar TUDO. Ela não vira falésia nem
// parque, vira terreno de mansões, e a plataforma fica BAIXA, perto da água,
// não no topo do morro.
//
// ⚠️ OS NÚMEROS DE ENTRADA, MEDIDOS E REPASSADOS, NÃO REMEDIDOS AQUI:
//     arco    346° a 116,5° (`ALCA_TERRA`, já publicado em `teia.ts`), 15,26 km
//     terra seca dentro do arco: 12,49 km²
//     relevo  −42,4 a +13,0 m, mediana +4,4 (morro de ~700 m de base e 55 m de
//             amplitude transversal, uniforme ao longo do comprimento)
//     margem que olha a cidade (baía): r 5.800 a 6.632, mediana 6.580
//     margem externa (mar aberto): mediana r 7.316
//     lâmina d'água da cidade: −40 (a mesma de `lagos.cota`/`LAGO_AGUA_Y` em
//     `terrain.ts`, que não é exportada; repetida aqui como constante própria,
//     do mesmo jeito que `canais.ts` faz com `o.cota ?? -40`)
//
// ⚠️ 10/09/2026, SEGUNDA RODADA: A MARGEM VIROU TABELA POR RUMO, NÃO CÍRCULO
// ÚNICO. A primeira versão tratava as duas margens como um círculo na mediana
// (6.580 e 7.316), o mesmo critério que `teia.ts` usa para a avenida da alça.
// Só que aí "terraplanar TUDO" não fechava: a margem da baía sozinha varia de
// 5.800 a 6.632 medido, 832 m de diferença, mais que a largura de um lote
// inteiro, e nos rumos onde a terra real chega mais perto da cidade que a
// mediana, a faixa entre a margem real e a mediana ficava sem terraplanagem
// nenhuma. Medido: só 71% da terra seca virava plataforma (8,88 de 12,49 km²).
//
// A correção é a TABELA: `scripts/city/gerar-tabela-alca.ts` varre o arco a
// cada 0,25° (523 pontos) contra `buildTerrain` de verdade (relevo NATURAL,
// com a própria alça desligada por `?alca=0` para não medir o platô que ela
// mesma aplaina) e acha, em cada rumo, onde a terra seca começa e termina
// entre água dos dois lados. As duas listas abaixo (`ALCA_TABELA_BAIA` e
// `ALCA_TABELA_MAR`) SÃO essa medição, congelada em constante: rodar a
// varredura de novo só é preciso se o relevo da alça mudar. Em runtime,
// `alcaMargens` interpola LINEARMENTE entre os dois rumos vizinhos da tabela,
// o(1) por consulta, sem varredura nenhuma no boot.
//
// Medido depois da tabela: baía 5.918 a 6.634 (mediana 6.582), mar 7.298 a
// 7.758 (mediana 7.314) — a mediana bate com a medição original repassada
// (6.580 e 7.316); o que a tabela ganha é o RESTO do intervalo, que o círculo
// único jogava fora.
//
// ⚠️ 10/09/2026, TERCEIRA RODADA: O FUNDADOR DERRUBOU A TABELA E VOLTOU AO
// CÍRCULO, DE PROPÓSITO. Ordem literal: "a gente pode simplesmente fazer a
// praia toda retinha, linda, perfeita, fazer a via toda circular... esquece
// isso de ter que seguir o terreno". Ou seja, inverte quem manda: não é mais
// a linha d'água que segue o relevo medido, é o relevo que se ajusta à linha
// d'água. `ALCA_R_BAIA` e `ALCA_R_MAR`, logo abaixo, são as DUAS medianas já
// medidas (6.580 e 7.316) — as mesmas da primeira rodada — só que agora
// IMPOSTAS sem exceção, inclusive escavando terra que hoje existe do lado de
// dentro do círculo e aterrando água que hoje existe do lado de fora dele.
//
// ⚠️ A TABELA NÃO FOI APAGADA. `alcaMargens` e as duas listas continuam de pé:
// não decidem mais ONDE a praia fica (isso agora é `ALCA_R_BAIA`/`ALCA_R_MAR`,
// fixos), mas são o "antes" contra o qual `scripts/city/verificar-alca.ts`
// mede quanto de linha d'água avançou ou recuou rumo a rumo — sem elas essa
// conta não existiria mais.
//
// ⚠️ E A GUARDA DE "ÁGUA POR NATUREZA SAI SEM TOCAR" FOI REMOVIDA DE PROPÓSITO.
// Ela existia para nunca avançar sobre água de verdade; agora avançar sobre
// água de verdade É o pedido (até 782 m de diferença entre a margem medida e
// o círculo, nos dois sentidos). O que substitui a guarda é a rampa espelhada
// da praia (ver `alcaAlturaAt`): a escavação desce com talude de −40 a −44 em
// 80 m, nunca com parede, então a transição continua sem degrau mesmo
// avançando sobre água ou sobre terra por centenas de metros.
// ═══════════════════════════════════════════════════════════════════════════
import { ALCA_TERRA, noArcoDoAnel } from './teia'

/**
 * A COTA DA PLATAFORMA, e ela é ESCOLHA DE DESENHO, não conta de equilíbrio de
 * terra: o fundador quis a plataforma BAIXA, junto da água (10 m acima da
 * lâmina de −40), não no topo do morro (que chega a +13,0). Pode mudar se o
 * desenho das mansões pedir outra cota; é por isso que é constante exportada
 * e comentada, não um número espalhado pelo arquivo.
 */
export const ALCA_PLATAFORMA_Y = -30

/**
 * ⚠️ A MESMA CONSTANTE DE `terrain.ts` (`LAGO_AGUA_Y`) E DE `lagos.cota` no
 * `cidade-malha.json`, hoje −40. Não é importável (não é exportada de
 * `terrain.ts`, e importar de lá criaria ciclo: `terrain.ts` importa este
 * arquivo). Repetida aqui como constante própria, o mesmo padrão que
 * `canais.ts:317` já usa (`const AGUA = o.cota ?? -40`).
 */
export const ALCA_AGUA = -40

/**
 * O PASSO DA TABELA, EM GRAUS. `ALCA_TABELA_BAIA[i]` e `ALCA_TABELA_MAR[i]`
 * valem para o rumo `ALCA_TERRA[0] + i * ALCA_TABELA_PASSO_GRAUS`, sempre
 * contando a partir de 346° e passando por 0°.
 */
export const ALCA_TABELA_PASSO_GRAUS = 0.25

// ⚠️ AS DUAS TABELAS ABAIXO SÃO DADO MEDIDO, NÃO CÓDIGO: geradas por
// `scripts/city/gerar-tabela-alca.ts` em 10/09/2026, 523 pontos cada (346° a
// 116,5°, passo de 0,25°), contra o relevo natural real (`buildTerrain` com a
// própria alça desligada). Ver o cabeçalho do arquivo para o porquê da tabela
// substituir o círculo único. Para regenerar depois de uma mudança de relevo:
// `npx tsx scripts/city/gerar-tabela-alca.ts` e colar a saída aqui.

/** a margem que olha para a cidade (a baía), em metros de raio, por rumo */
export const ALCA_TABELA_BAIA: readonly number[] = [6098.0,6258.0,6282.0,6294.0,6306.0,6318.0,6334.0,6350.0,6366.0,6382.0,6382.0,6378.0,6378.0,6374.0,6394.0,6410.0,6422.0,6434.0,6446.0,6458.0,6474.0,6490.0,6502.0,6502.0,6494.0,6486.0,6486.0,6486.0,6486.0,6486.0,6478.0,6470.0,6470.0,6470.0,6478.0,6482.0,6490.0,6494.0,6502.0,6514.0,6522.0,6530.0,6534.0,6534.0,6534.0,6538.0,6538.0,6542.0,6546.0,6550.0,6550.0,6546.0,6542.0,6534.0,6530.0,6530.0,6530.0,6526.0,6522.0,6514.0,6506.0,6502.0,6498.0,6506.0,6514.0,6522.0,6530.0,6530.0,6526.0,6526.0,6526.0,6526.0,6530.0,6530.0,6530.0,6530.0,6530.0,6534.0,6538.0,6542.0,6546.0,6550.0,6554.0,6554.0,6554.0,6550.0,6550.0,6546.0,6546.0,6542.0,6542.0,6542.0,6538.0,6538.0,6538.0,6538.0,6542.0,6542.0,6546.0,6554.0,6562.0,6570.0,6574.0,6578.0,6578.0,6574.0,6574.0,6570.0,6562.0,6562.0,6566.0,6566.0,6566.0,6570.0,6574.0,6578.0,6582.0,6586.0,6590.0,6590.0,6586.0,6582.0,6578.0,6578.0,6578.0,6578.0,6574.0,6566.0,6566.0,6566.0,6566.0,6570.0,6570.0,6570.0,6570.0,6574.0,6574.0,6578.0,6582.0,6590.0,6594.0,6598.0,6598.0,6602.0,6602.0,6598.0,6598.0,6598.0,6598.0,6598.0,6602.0,6606.0,6602.0,6602.0,6602.0,6602.0,6602.0,6602.0,6602.0,6606.0,6606.0,6606.0,6606.0,6602.0,6602.0,6598.0,6594.0,6594.0,6590.0,6590.0,6590.0,6586.0,6586.0,6586.0,6586.0,6586.0,6582.0,6582.0,6582.0,6582.0,6586.0,6590.0,6594.0,6594.0,6598.0,6598.0,6598.0,6602.0,6606.0,6610.0,6610.0,6614.0,6618.0,6622.0,6626.0,6630.0,6634.0,6634.0,6634.0,6630.0,6626.0,6626.0,6626.0,6626.0,6626.0,6626.0,6626.0,6626.0,6626.0,6626.0,6626.0,6630.0,6630.0,6630.0,6630.0,6630.0,6630.0,6630.0,6626.0,6626.0,6622.0,6618.0,6614.0,6614.0,6614.0,6618.0,6614.0,6610.0,6598.0,6586.0,6578.0,6566.0,6562.0,6570.0,6578.0,6582.0,6586.0,6586.0,6590.0,6594.0,6594.0,6598.0,6602.0,6602.0,6602.0,6602.0,6598.0,6598.0,6598.0,6598.0,6602.0,6602.0,6606.0,6606.0,6610.0,6610.0,6610.0,6610.0,6614.0,6614.0,6614.0,6614.0,6614.0,6614.0,6618.0,6618.0,6618.0,6618.0,6618.0,6614.0,6614.0,6614.0,6614.0,6614.0,6614.0,6614.0,6610.0,6610.0,6606.0,6606.0,6606.0,6606.0,6606.0,6606.0,6602.0,6602.0,6602.0,6602.0,6606.0,6606.0,6610.0,6610.0,6610.0,6610.0,6606.0,6602.0,6598.0,6598.0,6594.0,6598.0,6598.0,6598.0,6598.0,6598.0,6594.0,6590.0,6590.0,6590.0,6594.0,6598.0,6602.0,6606.0,6610.0,6606.0,6606.0,6602.0,6598.0,6594.0,6594.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6590.0,6586.0,6582.0,6582.0,6578.0,6578.0,6578.0,6578.0,6582.0,6582.0,6586.0,6590.0,6590.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6594.0,6590.0,6590.0,6590.0,6590.0,6598.0,6602.0,6602.0,6606.0,6602.0,6598.0,6590.0,6586.0,6582.0,6578.0,6582.0,6582.0,6582.0,6586.0,6582.0,6578.0,6578.0,6574.0,6578.0,6582.0,6586.0,6586.0,6586.0,6586.0,6590.0,6590.0,6590.0,6594.0,6594.0,6590.0,6590.0,6586.0,6586.0,6586.0,6582.0,6586.0,6586.0,6586.0,6586.0,6582.0,6582.0,6578.0,6578.0,6578.0,6574.0,6570.0,6566.0,6562.0,6554.0,6558.0,6558.0,6562.0,6562.0,6566.0,6566.0,6570.0,6570.0,6570.0,6566.0,6562.0,6554.0,6550.0,6546.0,6546.0,6550.0,6554.0,6562.0,6566.0,6566.0,6566.0,6562.0,6558.0,6554.0,6550.0,6542.0,6538.0,6534.0,6534.0,6534.0,6534.0,6534.0,6530.0,6530.0,6522.0,6518.0,6514.0,6510.0,6506.0,6502.0,6494.0,6490.0,6490.0,6490.0,6490.0,6490.0,6494.0,6498.0,6502.0,6502.0,6506.0,6502.0,6498.0,6494.0,6486.0,6482.0,6482.0,6486.0,6490.0,6494.0,6498.0,6494.0,6490.0,6482.0,6482.0,6478.0,6474.0,6470.0,6466.0,6462.0,6462.0,6458.0,6450.0,6454.0,6458.0,6470.0,6482.0,6498.0,6514.0,6526.0,6534.0,6530.0,6526.0,6518.0,6510.0,6494.0,6466.0,6446.0,6430.0,6406.0,6374.0,6362.0,6366.0,6374.0,6386.0,6390.0,6390.0,6378.0,6362.0,6342.0,6314.0,6270.0,6210.0,5918.0]

/** a margem externa (o mar aberto), em metros de raio, por rumo */
export const ALCA_TABELA_MAR: readonly number[] = [7498.0,7510.0,7514.0,7514.0,7506.0,7498.0,7494.0,7490.0,7490.0,7494.0,7498.0,7498.0,7498.0,7486.0,7470.0,7458.0,7450.0,7446.0,7442.0,7442.0,7438.0,7438.0,7438.0,7434.0,7426.0,7418.0,7410.0,7410.0,7418.0,7426.0,7422.0,7414.0,7402.0,7394.0,7390.0,7386.0,7382.0,7378.0,7370.0,7366.0,7362.0,7358.0,7354.0,7354.0,7350.0,7346.0,7342.0,7338.0,7338.0,7338.0,7338.0,7338.0,7338.0,7342.0,7342.0,7342.0,7342.0,7342.0,7338.0,7338.0,7338.0,7334.0,7334.0,7334.0,7334.0,7338.0,7342.0,7342.0,7342.0,7342.0,7342.0,7338.0,7338.0,7338.0,7334.0,7334.0,7330.0,7330.0,7330.0,7330.0,7330.0,7330.0,7330.0,7330.0,7334.0,7334.0,7338.0,7338.0,7338.0,7338.0,7338.0,7338.0,7334.0,7334.0,7338.0,7338.0,7338.0,7334.0,7334.0,7330.0,7330.0,7330.0,7330.0,7330.0,7330.0,7330.0,7330.0,7322.0,7314.0,7310.0,7306.0,7302.0,7302.0,7298.0,7298.0,7298.0,7298.0,7302.0,7302.0,7310.0,7318.0,7326.0,7326.0,7326.0,7322.0,7322.0,7318.0,7318.0,7318.0,7318.0,7318.0,7318.0,7318.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7314.0,7310.0,7310.0,7310.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7310.0,7314.0,7314.0,7314.0,7310.0,7310.0,7310.0,7310.0,7310.0,7314.0,7314.0,7314.0,7318.0,7318.0,7318.0,7318.0,7314.0,7310.0,7310.0,7306.0,7306.0,7306.0,7310.0,7314.0,7314.0,7314.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7306.0,7302.0,7302.0,7302.0,7298.0,7298.0,7298.0,7298.0,7298.0,7302.0,7302.0,7302.0,7306.0,7306.0,7306.0,7306.0,7302.0,7302.0,7302.0,7306.0,7306.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7314.0,7314.0,7314.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7306.0,7306.0,7302.0,7302.0,7302.0,7306.0,7306.0,7306.0,7306.0,7306.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7302.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7302.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7314.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7302.0,7302.0,7302.0,7302.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7310.0,7314.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7306.0,7310.0,7310.0,7310.0,7314.0,7318.0,7322.0,7326.0,7330.0,7334.0,7334.0,7334.0,7330.0,7330.0,7330.0,7330.0,7330.0,7334.0,7334.0,7334.0,7338.0,7338.0,7346.0,7350.0,7354.0,7358.0,7362.0,7362.0,7362.0,7362.0,7362.0,7366.0,7370.0,7374.0,7378.0,7378.0,7382.0,7386.0,7390.0,7394.0,7398.0,7402.0,7410.0,7418.0,7422.0,7426.0,7426.0,7422.0,7422.0,7422.0,7426.0,7430.0,7434.0,7438.0,7438.0,7442.0,7446.0,7450.0,7454.0,7462.0,7466.0,7470.0,7474.0,7474.0,7482.0,7486.0,7498.0,7510.0,7518.0,7522.0,7530.0,7534.0,7538.0,7542.0,7546.0,7546.0,7550.0,7550.0,7550.0,7554.0,7558.0,7562.0,7566.0,7570.0,7578.0,7586.0,7598.0,7602.0,7606.0,7606.0,7606.0,7614.0,7622.0,7626.0,7634.0,7642.0,7650.0,7654.0,7658.0,7658.0,7658.0,7658.0,7662.0,7670.0,7682.0,7694.0,7698.0,7702.0,7706.0,7714.0,7718.0,7722.0,7730.0,7734.0,7738.0,7742.0,7742.0,7742.0,7746.0,7750.0,7758.0]

/**
 * A LARGURA DA PRAIA, E ELA SAI DA CONTA, NÃO É CHUTADA: declividade pedida de
 * 1:8 para vencer os 10 m entre a lâmina (−40) e a plataforma (−30) dá
 * 10 / (1/8) = 80 m de corrida. Ver a verificação: item 5 confirma que é isto
 * que a cena entrega.
 */
export const ALCA_PRAIA_LARGURA = 80

/**
 * O CÍRCULO DA MARGEM DA BAÍA (que olha para a cidade), fixo em todos os
 * rumos. ESCOLHA DE DESENHO do fundador, 10/09/2026, não conta de terreno: é
 * a MEDIANA já medida da margem real (`ALCA_TABELA_BAIA`, 5.918 a 6.634), o
 * ponto em que o movimento de terra fica equilibrado entre escavar e aterrar.
 * A praia (`ALCA_PRAIA_LARGURA`) e a via da alça (`AVENIDA_ALCA` em teia.ts,
 * 120 m além deste círculo) partem dele.
 */
export const ALCA_R_BAIA = 6580

/**
 * O CÍRCULO DA MARGEM EXTERNA (o mar aberto), pelo mesmo critério do círculo
 * da baía: mediana medida (`ALCA_TABELA_MAR`, 7.298 a 7.758). Com os dois
 * círculos fixos a alça vira um anel de largura constante de
 * `ALCA_R_MAR − ALCA_R_BAIA` = 736 m ao longo dos 15,26 km do arco.
 */
export const ALCA_R_MAR = 7316

/**
 * O FUNDO ESCAVADO, PARA ONDE VAI A TERRA QUE HOJE EXISTE DENTRO DO CÍRCULO
 * DA ÁGUA. Não é a lâmina (`ALCA_AGUA`, −40) porque um corte exatamente na
 * cota da lâmina lê como faca no plano da água; 4 m abaixo dela é a MESMA
 * folga que `scripts/city/verificar-alca.ts` já usa para o leito de canal
 * (`leito: M.lagos.cota - 4`), então o fundo da alça escavada fica com a
 * mesma cara de fundo de canal, não uma superfície nova inventada aqui.
 */
export const ALCA_LEITO_Y = ALCA_AGUA - 4

/**
 * A FRANJA NAS DUAS PONTAS DO ARCO (346° e 116,5°), para a terraplanagem
 * morrer no terreno natural do continente sem degrau. 250 m de corrida ao
 * longo do arco: mais que os 34 m do pódio cívico de propósito, porque ali a
 * franja recua de uma rua que já é reta e aqui ela tem de absorver o relevo
 * natural de um morro inteiro encostando no continente. Verificado no item 4
 * (degrau contra o natural).
 */
export const ALCA_FRANJA_PONTAS = 250

/**
 * ⚠️ CHAVE DE DIAGNÓSTICO: `?alca=0` desliga a terraplanagem inteira, o mesmo
 * padrão de `?campus=0` e `?aquatics=0`. A leitura acontece uma vez, no
 * módulo.
 */
const _flagAlca = typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('alca') ?? '')
export const ALCA_CHAO = _flagAlca !== '0'

const _suave = (k: number) => k * k * (3 - 2 * k)

// ── a porta rápida ───────────────────────────────────────────────────────────
// ⚠️ PORTA RÁPIDA ANTES DE QUALQUER CONTA. `alcaAlturaAt` é chamada de dentro
// de `heightAt`, que é o trava-chão da câmera (todo quadro) e o pouso de toda
// peça, poste e árvore da cidade. A alça vive entre r 5.700 e 7.900: quase todo
// ponto do mapa está fora disso, e a comparação de raio AO QUADRADO resolve
// isso sem `Math.hypot` (que trata estouro e desnormal e não é embutido no V8,
// o mesmo motivo que `campus.ts` já documenta) e sem `atan2`. Só quem passa no
// raio paga o ângulo, que é o segundo filtro, mais caro e mais raro de
// precisar.
//
// ⚠️ E A JANELA CONTINUA VALENDO DEPOIS DA TABELA: medido nela, a margem da
// baía vai de 5.918 a 6.634 e a do mar de 7.298 a 7.758, então 5.700 e 7.900
// sobram folga (218 m e 142 m) dos dois lados de toda a faixa real.
const _R_GATE_DENTRO = 5700
const _R_GATE_FORA = 7900
const _R2_GATE_DENTRO = _R_GATE_DENTRO * _R_GATE_DENTRO
const _R2_GATE_FORA = _R_GATE_FORA * _R_GATE_FORA

/**
 * A largura do arco `ALCA_TERRA`, sempre positiva, contada de `a` até `b`
 * passando por 0 (346° a 116,5° são 130,5°).
 */
const _ARCO_LARGURA = ((ALCA_TERRA[1] - ALCA_TERRA[0]) + 360) % 360

/**
 * A distância angular, em graus, do rumo até a borda mais próxima do arco.
 * POSITIVA para dentro do arco (é a distância até a borda mais próxima),
 * NEGATIVA para fora. Usada só depois que `noArcoDoAnel` já confirmou que o
 * ponto está dentro, então o valor devolvido aqui é sempre >= 0 em uso real;
 * a metade negativa existe só para a função ficar correta em qualquer entrada.
 */
function _distAnguloAteABorda(anguloGraus: number): number {
  const g = ((anguloGraus % 360) + 360) % 360
  const pos = ((g - ALCA_TERRA[0]) + 360) % 360
  if (pos <= _ARCO_LARGURA) return Math.min(pos, _ARCO_LARGURA - pos)
  return -Math.min(pos - _ARCO_LARGURA, 360 - pos)
}

const _N_TABELA = ALCA_TABELA_BAIA.length

/**
 * As duas margens MEDIDAS (baía e mar), em metros de raio, NO RUMO EXATO, por
 * interpolação linear entre os dois pontos vizinhos da tabela.
 *
 * ⚠️ DESDE A TERCEIRA RODADA (10/09), ESTA FUNÇÃO NÃO GOVERNA MAIS O CHÃO.
 * `alcaAlturaAt` usa os círculos fixos `ALCA_R_BAIA`/`ALCA_R_MAR`. O que sobra
 * para `alcaMargens` é ser o "antes" da comparação: `verificar-alca.ts` chama
 * esta função para saber quanto a margem real de cada rumo diferia do círculo
 * que passou a valer, e reportar quanto de linha d'água avançou ou recuou.
 *
 * ⚠️ O(1) POR CONSULTA, SEM VARREDURA. A tabela já está pronta (gerada
 * offline, ver o cabeçalho do arquivo); em runtime isto é uma divisão, dois
 * acessos de array e uma soma.
 *
 * Só é chamada com ângulo já confirmado dentro do arco (`noArcoDoAnel`), mas
 * a conta de índice é segura para qualquer ângulo: fica grampeada nas pontas
 * da tabela em vez de estourar o array.
 */
export function alcaMargens(anguloGraus: number): { baia: number; mar: number } {
  const g = ((anguloGraus % 360) + 360) % 360
  const pos = ((g - ALCA_TERRA[0]) + 360) % 360
  const idx = pos / ALCA_TABELA_PASSO_GRAUS
  const i0 = Math.max(0, Math.min(_N_TABELA - 1, Math.floor(idx)))
  const i1 = Math.min(_N_TABELA - 1, i0 + 1)
  const t = Math.max(0, Math.min(1, idx - i0))
  return {
    baia: ALCA_TABELA_BAIA[i0] + (ALCA_TABELA_BAIA[i1] - ALCA_TABELA_BAIA[i0]) * t,
    mar: ALCA_TABELA_MAR[i0] + (ALCA_TABELA_MAR[i1] - ALCA_TABELA_MAR[i0]) * t,
  }
}

/**
 * A cota do chão depois da terraplanagem da alça, dada a cota natural.
 *
 * ⚠️ A ORDEM DE ZONAS, DE FORA PARA DENTRO, TODA EM CIMA DE `ALCA_R_BAIA` E
 * `ALCA_R_MAR` (círculos fixos, não mais a tabela por rumo): fundo escavado
 * (plano em `ALCA_LEITO_Y`) → rampa espelhada (talude 1:8 de `ALCA_LEITO_Y` a
 * `ALCA_AGUA` nos 80 m antes do círculo) → praia (rampa 1:8 de `ALCA_AGUA` a
 * `ALCA_PLATAFORMA_Y` nos 80 m depois do círculo) → plataforma (plano em
 * `ALCA_PLATAFORMA_Y`). As duas margens (baía e mar) usam a mesma regra,
 * espelhada.
 *
 * ⚠️ NÃO HÁ MAIS GUARDA DE "ÁGUA POR NATUREZA SAI SEM TOCAR". Decisão do
 * fundador, 10/09/2026: a linha d'água agora é IMPOSTA pelo círculo, e avançar
 * sobre água (ou sobre terra) de verdade é o objetivo, não o erro a evitar. O
 * que garante que a transição não vira parede é a rampa espelhada acima, com
 * o mesmo talude 1:8 da praia — nunca um degrau, mesmo quando o círculo dista
 * centenas de metros da margem real.
 */
export function alcaAlturaAt(x: number, z: number, natural: number): number {
  if (!ALCA_CHAO) return natural
  const r2 = x * x + z * z
  if (r2 <= _R2_GATE_DENTRO || r2 >= _R2_GATE_FORA) return natural
  // ⚠️ CONVENÇÃO DE ÂNGULO IDÊNTICA A `naAlcaDeTerra` EM `teia.ts`: rumo de
  // bússola da cidade, x = leste, z = sul, `atan2(x, -z)`.
  const anguloRad = Math.atan2(x, -z)
  if (!noArcoDoAnel({ arco: ALCA_TERRA }, anguloRad)) return natural

  const r = Math.sqrt(r2)
  const anguloGraus = anguloRad * 180 / Math.PI
  // ⚠️ POSITIVO DO LADO DA TERRA (plataforma), NEGATIVO DO LADO DA ÁGUA
  // (escavação), para os DOIS círculos fixos — não mais a margem medida.
  const distBaia = r - ALCA_R_BAIA
  const distMar = ALCA_R_MAR - r
  const distMargem = Math.min(distBaia, distMar)

  let alvoRadial: number
  if (distMargem >= ALCA_PRAIA_LARGURA) {
    // bem dentro das duas margens: plataforma plana
    alvoRadial = ALCA_PLATAFORMA_Y
  } else if (distMargem >= 0) {
    // a praia: rampa 1:8 do círculo da água até o pé da plataforma
    alvoRadial = ALCA_AGUA + (ALCA_PLATAFORMA_Y - ALCA_AGUA) * (distMargem / ALCA_PRAIA_LARGURA)
  } else if (distMargem >= -ALCA_PRAIA_LARGURA) {
    // a rampa espelhada: mesma largura de corrida, descendo do círculo da
    // água até o fundo escavado — é ela que impede a parede na escavação
    alvoRadial = ALCA_AGUA + (ALCA_LEITO_Y - ALCA_AGUA) * (-distMargem / ALCA_PRAIA_LARGURA)
  } else {
    // bem fora das duas margens: fundo escavado, plano
    alvoRadial = ALCA_LEITO_Y
  }

  // ⚠️ A FRANJA DAS PONTAS, MEDIDA EM METROS DE ARCO NO PRÓPRIO RAIO DO PONTO,
  // não em graus fixos: um grau vale metros diferentes conforme o raio, e
  // medir em metros é o que dá largura de franja constante ao longo do arco.
  const distBordaGraus = _distAnguloAteABorda(anguloGraus)
  const distBordaMetros = distBordaGraus * (Math.PI / 180) * r
  const kFranja = distBordaMetros >= ALCA_FRANJA_PONTAS ? 1 : _suave(distBordaMetros / ALCA_FRANJA_PONTAS)

  return natural * (1 - kFranja) + alvoRadial * kFranja
}
