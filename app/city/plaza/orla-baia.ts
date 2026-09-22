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
 * A BORDA INTERNA DO DISTRITO. Sai da soma das cinco fileiras e dos dois
 * canais, de fora para dentro, e fecha em 620 m:
 *
 *   4.800  linha d'água
 *   4.720  pé da praia, testada da fileira A (tier 4, olha a baía)
 *   4.652  fundo de A, que encosta no fundo de B
 *   4.584  testada de B (tier 5, olha o canal 1)
 *   4.544  pé do talude do canal 1
 *   4.484  a outra margem da lâmina
 *   4.444  testada de C (tier 5, canal 1 pela outra banda)
 *   4.376  fundo de C, que encosta no fundo de D
 *   4.308  testada de D (tier 5, olha o canal 2)
 *   4.168  testada de E (tier 5, canal 2 pela outra banda)
 *   4.100  fundo de E: a borda interna
 */
export const ORLA_BAIA_R_FUNDO = 4100

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
 * AS CINCO TESTADAS, de fora para dentro: raio, sentido de crescimento (+1 para
 * fora, −1 para dentro) e a que tier a fileira pertence. É esta lista que o
 * gerador lê: mudar a seção aqui muda o loteamento lá, sem cópia.
 */
export const ORLA_BAIA_FILEIRAS: ReadonlyArray<{ r: number; sentido: 1 | -1; tier: 4 | 5 }> = [
  { r: 4720, sentido: -1, tier: 4 },   // A, a praia
  { r: 4584, sentido: +1, tier: 5 },   // B, canal 1 banda de fora
  { r: 4444, sentido: -1, tier: 5 },   // C, canal 1 banda de dentro
  { r: 4308, sentido: +1, tier: 5 },   // D, canal 2 banda de fora
  { r: 4168, sentido: -1, tier: 5 },   // E, canal 2 banda de dentro
]

/**
 * OS QUATRO DEDOS. Passo angular igual de 20°, e o slot do meio (51,3) não
 * entra porque ali é a enseada. Regra do fundador: elementos repetidos
 * igualmente espaçados, e quando um não cabe é melhor EXCLUIR do que desalinhar
 * os outros.
 */
export const ORLA_BAIA_DEDO_RUMOS: readonly number[] = [11.3, 31.3, 71.3, 91.3]

/**
 * A SEÇÃO DO DEDO, 166 m: cais 8 + lote 68 + rua 14 + lote 68 + cais 8. As duas
 * fileiras ficam de costas, cada uma olhando a sua água, e a rua de 14 m corre
 * na espinha. O cais é passeio molhado, não parede: a lateral do dedo desce
 * pela MESMA rampa 1:8 da praia.
 */
export const ORLA_BAIA_DEDO_LARGURA = 166
export const ORLA_BAIA_DEDO_CAIS = 8
/**
 * A PONTA DO DEDO. 6.150, e os 100 m a mais que o esboço de 21/09 previa são
 * conta de testada, não gosto: a 6.050 faltavam 754 m de linha para os 2.062
 * lotes depois de descontar o que os canais radiais CR01 e CR03 atravessam.
 * Deixa 430 m de lâmina até a praia da alça, que continua canal navegável largo.
 */
export const ORLA_BAIA_DEDO_PONTA = 6150

/**
 * OS DOIS ANÉIS DE CANAL, pelos eixos. Seção: fundo chato de 60 m na cota
 * −44, talude de 40 m de cada lado até a plataforma (−30). Isso põe a linha
 * d'água em 83 m de largura e deixa 28,6 m de barranco seco de cada lado, que
 * é onde o passeio de canal corre.
 */
export const ORLA_BAIA_CANAL_EIXOS: readonly number[] = [4514, 4238]
export const ORLA_BAIA_CANAL_FUNDO = 60
export const ORLA_BAIA_CANAL_TALUDE = 40

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
 * A DISTÂNCIA ASSINADA ATÉ A TERRA, em metros: positiva para dentro da terra,
 * negativa sobre a água. É a união da costa com os quatro dedos, e a união se
 * faz por MÁXIMO das distâncias assinadas — o que cria uma quina côncava onde o
 * dedo encontra a praia, que é exatamente o que uma restinga faz de verdade.
 */
export function orlaBaiaDistTerra(r: number, anguloGraus: number): number {
  let dist = orlaBaiaLinhaDagua(anguloGraus) - r
  for (const rumo of ORLA_BAIA_DEDO_RUMOS) {
    let d = anguloGraus - rumo
    if (d > 180) d -= 360
    if (d < -180) d += 360
    if (Math.abs(d) > 20) continue          // nenhum dedo tem 20° de meia-largura
    const perp = Math.abs(Math.sin(d * Math.PI / 180)) * r
    const lado = ORLA_BAIA_DEDO_LARGURA / 2 - perp
    const ponta = ORLA_BAIA_DEDO_PONTA - r
    dist = Math.max(dist, Math.min(lado, ponta))
  }
  return dist
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

  const distTerra = orlaBaiaDistTerra(r, ang)

  let alvo: number
  if (distTerra >= ORLA_BAIA_PRAIA) {
    alvo = ORLA_BAIA_PLATAFORMA_Y
    const canal = _canalCota(r)
    if (canal !== null) alvo = Math.min(alvo, canal)
  } else if (distTerra >= 0) {
    // a praia: rampa 1:8 da lâmina até o pé da plataforma
    alvo = ORLA_BAIA_AGUA + (ORLA_BAIA_PLATAFORMA_Y - ORLA_BAIA_AGUA) * (distTerra / ORLA_BAIA_PRAIA)
  } else if (distTerra >= -ORLA_BAIA_PRAIA) {
    // a rampa espelhada: mesma corrida, descendo até o fundo escavado
    alvo = ORLA_BAIA_AGUA + (ORLA_BAIA_LEITO_Y - ORLA_BAIA_AGUA) * (-distTerra / ORLA_BAIA_PRAIA)
  } else {
    // ⚠️ A SAIA SOBRE A ÁGUA, e é ela que preserva as ilhas da baía. Passados
    // os 80 m da rampa espelhada, o fundo escavado volta ao natural em 250 m:
    // só desaparece o que estiver encostado na nova linha d'água.
    const k = _suave(Math.min(1, (-distTerra - ORLA_BAIA_PRAIA) / ORLA_BAIA_SAIA))
    alvo = ORLA_BAIA_LEITO_Y * (1 - k) + natural * k
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
