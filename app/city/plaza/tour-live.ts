// ═══════════════════════════════════════════════════════════════════════════
// O TOUR DA LIVE: a cidade se mostrando sozinha, para quem está assistindo.
//
// ⚠️ NÃO É O TOUR DA INTERFACE, e a diferença é o público. O tour do menu é para
// quem clicou: ele tem texto, corre em 4,2 s de voo e 6,4 s de parada, e termina.
// Este aqui é para uma transmissão que fica horas no ar: ninguém clicou, ninguém
// vai ler legenda, e o que ele precisa é DEMORAR. Voo lento, parada longa, e
// volta ao começo sem fim.
//
// ⚠️ E ELE SUBSTITUI A ÓRBITA OCIOSA. O que havia antes era
// `controls.autoRotate` depois de 25 s: a câmera girava em torno de UM ponto
// para sempre, que na live vira um único enquadramento repetido por horas. O
// fundador, 05/09: "no momento ele fica circulando sobre um único ponto, ele
// deveria ficar um tempo em cada ponto".
//
// A ordem é a do pedido: abre por cima da batalha, passa no estádio, na água,
// nas montanhas e no Parque Runestone, com a praça e o spaceport entre eles para
// a volta não ficar só de periferia.
// ═══════════════════════════════════════════════════════════════════════════

export interface ParadaLive {
  /** a chave de `viewFor` */
  key: string
  /** segundos de voo ATÉ esta parada */
  voo: number
  /** segundos parado nela, depois de chegar */
  parada: number
  /** só no desktop: paradas caras que o telefone não aguenta */
  soDesktop?: boolean
}

/**
 * ⚠️ OS TEMPOS SÃO O PRODUTO AQUI, e o fundador foi direto: "não pode ser
 * rápido". Uma volta leva cerca de **15 minutos** no desktop, contra 1 minuto e
 * 46 do tour da interface com as mesmas paradas. O voo longo é o que faz a
 * câmera parecer grua de cinema em vez de corte; a parada longa é o que dá tempo
 * de o espectador ler o lugar.
 *
 * ⚠️ E A PARADA NÃO É IMÓVEL. Câmera travada por meio minuto lê como transmissão
 * congelada, e quem está assistindo não sabe se o site caiu. Durante a parada a
 * câmera orbita o alvo devagar (`TOUR_LIVE_DERIVA`), que é o movimento que uma
 * grua faria enquanto o operador segura o plano.
 */
export const TOUR_LIVE: readonly ParadaLive[] = [
  // abre em cima da batalha, que é onde a live começa
  { key: 'warentry',   voo: 14.0, parada: 26 },
  { key: 'war',        voo: 22.0, parada: 24 },
  { key: 'coliseu',    voo: 24.0, parada: 22 },
  // ⚠️ O DISTRITO ESPORTIVO É UMA SEQUÊNCIA SÓ, não duas visitas separadas. O
  // estádio e THE GEODE ficam a 540 m no mesmo radial: encadeados, o voo entre
  // eles é curto e a câmera conta que são vizinhos. Separados no roteiro, o
  // espectador não faz a ligação.
  { key: 'estadioalto', voo: 30.0, parada: 24 },
  { key: 'estadio',    voo: 18.0, parada: 24 },
  { key: 'estadiorasante', voo: 16.0, parada: 20 },
  // por dentro do estádio, pedido do fundador em 06/09
  { key: 'estadiodentro', voo: 14.0, parada: 26 },
  // THE GEODE, a arena coberta
  { key: 'geodealto',  voo: 20.0, parada: 22 },
  { key: 'geode',      voo: 16.0, parada: 26 },
  { key: 'geoderasante', voo: 14.0, parada: 28 },
  // a água: lago, ilhas de longe e de perto, e a orla
  { key: 'lago',       voo: 28.0, parada: 24 },
  { key: 'ilhas',      voo: 24.0, parada: 22, soDesktop: true },
  { key: 'ilhasrasante', voo: 18.0, parada: 26, soDesktop: true },
  // a montanha e a estação de inverno
  { key: 'montanha',   voo: 32.0, parada: 24, soDesktop: true },
  { key: 'montanharasante', voo: 18.0, parada: 26, soDesktop: true },
  { key: 'montanhatopo', voo: 20.0, parada: 22, soDesktop: true },
  // o parque, a 9,8 km
  { key: 'park',       voo: 36.0, parada: 28, soDesktop: true },
  { key: 'parkclose',  voo: 20.0, parada: 26, soDesktop: true },
  // volta para o centro: spaceport, torres e a praça
  { key: 'spaceport',  voo: 32.0, parada: 24 },
  { key: 'kray',       voo: 28.0, parada: 22 },
  { key: 'deck',       voo: 22.0, parada: 24 },
  { key: 'top',        voo: 18.0, parada: 26 },
  // a silhueta da casca, de fora, antes de recomeçar
  { key: 'abobadafora', voo: 28.0, parada: 24 },
]

/** ⚠️ O celular perde as paradas caras, do mesmo jeito que o tour da interface. */
export function rotaLive(tier: 'mobile' | 'desktop'): ParadaLive[] {
  return TOUR_LIVE.filter((p) => tier === 'desktop' || !p.soDesktop)
}

/** quanto tempo leva uma volta, em segundos (para o log e para a conferência) */
export function duracaoLive(tier: 'mobile' | 'desktop'): number {
  return rotaLive(tier).reduce((s, p) => s + p.voo + p.parada, 0)
}

/**
 * ⚠️ UM MINUTO PARADO, e não os 25 s da órbita antiga. O fundador pediu "ficou 1
 * minuto parado, começa o tour": antes disso a pessoa ainda está mexendo, e uma
 * câmera que sai andando sozinha no meio de um gesto é pior que uma parada.
 */
export const TOUR_LIVE_OCIO_MS = 60_000

/**
 * A órbita lenta que a câmera faz enquanto segura um plano, em graus por segundo
 * do `autoRotateSpeed` do OrbitControls.
 *
 * ⚠️ 0,05 É LENTO DE PROPÓSITO. O valor que a órbita ociosa usava era 0,18, e
 * numa parada de 25 s isso dá quase um quarto de volta: o plano vira outro plano
 * no meio da parada. Aqui a deriva tem que ser quase imperceptível, só o
 * bastante para a imagem não parecer congelada.
 */
export const TOUR_LIVE_DERIVA = 0.05
