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
/**
 * ⚠️ O ROTEIRO FOI REESCRITO EM 08/09/2026, e o pedido do fundador tem uma
 * frase que organiza tudo: **"o ponto fraco do tour de hoje são os momentos que
 * ele sai da cúpula. Deve sair, mostra o spaceport, os foguetes da mempool e
 * descer."** Ou seja: sair é permitido UMA vez, com assunto, e voltando.
 *
 * ⚠️ E A MEDIÇÃO DEU RAZÃO A ELE DE UM JEITO QUE EU NÃO ESPERAVA. As três
 * paradas `montanha*` do roteiro antigo miravam (−2.394, 10.672), que sondado
 * em produção com `__plazaPerfil` tem **240,9 m** de cota e fica em r 10.937 —
 * do lado de fora da cúpula, que mede 9.054 de raio. O maciço nevado de verdade
 * é o do `inverno.ts`, declarado lá em "r=8.330, az 262" e medido em **961,4 m**
 * no rumo 262°, r 7.900: DENTRO da cúpula. As três paradas gastavam 2,2 min do
 * laço olhando regolito ondulado a 11-13 km. Saíram, e no lugar entraram duas
 * de `cordilheira`, que é o mesmo assunto no lugar certo.
 *
 * ⚠️ `abobadafora` TAMBÉM SAIU, pelo mesmo critério: é literalmente a casca
 * vista de fora, o plano que o fundador chama de ponto fraco.
 *
 * O que entrou, na ordem do pedido dele:
 *   · o campus esportivo com as três peças e os TRÊS interiores;
 *   · a caverna do Leônidas, por dentro;
 *   · o rasante sobre a cordilheira, sem sair da cúpula;
 *   · o rasante sobre a alça dos condomínios;
 *   · THE SPHERE, que em 08/09 virou a quarta âncora da praça e por isso migrou
 *     do ato da cordilheira para o da descida ao centro;
 *   · e a saída única: spaceport de perto, a banda de órbita e a descida.
 *
 * Uma volta passou de 15 para **~22 min** no desktop. Para uma transmissão que
 * fica horas no ar isso é a favor, não contra: repetição é o que cansa.
 */
export const TOUR_LIVE: readonly ParadaLive[] = [
  // ── 1. a batalha, que é onde a live começa ────────────────────────────────
  { key: 'warentry',   voo: 14.0, parada: 26 },
  { key: 'war',        voo: 22.0, parada: 24 },
  { key: 'coliseu',    voo: 24.0, parada: 22 },

  // ── 2. o distrito esportivo, e ele deixou de ser só o campus ──────────────
  //
  // ⚠️ A ORDEM É GEOGRÁFICA, E ISSO É O QUE ECONOMIZA VOO. As frentes novas
  // estão no MESMO arco das três antigas: DOG AQUATICS em 77,143°, o campus
  // entre 90° e 120°, o DOG Derby em 140,6°. Percorridas nessa ordem, a câmera
  // faz um arco contínuo de 63° sem voltar; intercaladas, atravessaria o mesmo
  // anel três vezes por volta.
  //
  // ⚠️ E A PEÇA AQUÁTICA PEDE TRÊS PARADAS, não uma, porque ela tem programa
  // diferente em cada ponta dos 324 m: a nave coberta de um lado, a torre de
  // saltos de 60,35 m do outro, e o tanque de 50 m que só existe por dentro.
  // Uma parada só mostraria uma caixa branca comprida.
  { key: 'aquatics',        voo: 28.0, parada: 26 },
  { key: 'aquaticstorre',   voo: 16.0, parada: 24 },
  { key: 'aquaticsdentro',  voo: 14.0, parada: 26 },

  // ── o campus esportivo: as três peças num pódio só ────────────────────────
  // ⚠️ É UMA SEQUÊNCIA SÓ, não três visitas. As três estão no MESMO anel
  // (r 3.294), a 615,1 m uma da outra, sobre uma laje única em −17,7. O voo
  // entre elas é curto de propósito: é assim que a câmera conta que são
  // vizinhas. Separadas no roteiro, o espectador não faz a ligação.
  { key: 'esportes',        voo: 30.0, parada: 26 },
  { key: 'atletismoperto',  voo: 20.0, parada: 22 },
  { key: 'atletismodentro', voo: 16.0, parada: 28 },
  { key: 'estadiorasante',  voo: 18.0, parada: 22 },
  { key: 'estadiodentro',   voo: 14.0, parada: 28 },
  { key: 'geoderasante',    voo: 18.0, parada: 22 },
  { key: 'geodedentro',     voo: 14.0, parada: 28 },

  // ⚠️ O DERBY FECHA O ARCO, e ele estava fora do roteiro desde que foi
  // construído: o galgódromo é a peça de 60,26 ha em 140,6°, vizinha imediata
  // da GEODE no mesmo anel. Duas paradas, a aberta e a de perto, no mesmo par
  // que as outras peças do distrito usam.
  { key: 'derby',           voo: 22.0, parada: 24 },
  { key: 'derbyperto',      voo: 16.0, parada: 26 },

  // ── 3. a água: o lago, as ilhas e a alça ──────────────────────────────────
  { key: 'lago',            voo: 28.0, parada: 24 },
  { key: 'ilhasrasante',    voo: 22.0, parada: 24, soDesktop: true },
  // ⚠️ DUAS PARADAS NA ORLA DESDE 10/09, e elas correm PERTO. O enquadramento
  // antigo ficava a 1.570 m, distância em que as 1.542 palmeiras da orla
  // aparecem como proxy de 12 triângulos: a chapa mostrava bolhas verdes onde
  // há alameda. A aberta agora corre a 55 m de altura ao longo do arco, e a
  // rasante desce para 8 m, que é a altura de quem dirige na avenida.
  { key: 'alca',            voo: 30.0, parada: 26 },
  { key: 'alcarasante',     voo: 14.0, parada: 26 },

  // ── 4. a cordilheira, dentro da cúpula ────────────────────────────────────
  // ⚠️ THE SPHERE SAIU DESTE ATO EM 08/09, e a razão é geográfica e não de
  // ritmo: o fundador mudou a peça para a QUARTA ÂNCORA da praça central
  // (r 620, onde estava a Grande Fonte). Ela era vizinha da cordilheira quando
  // morava em r 5.118 no rumo 233,6°; agora a vizinhança dela são as outras três
  // âncoras, e as duas paradas foram para o ato 7, a descida ao centro.
  //
  // Manter aqui custaria duas travessias de 5 km em cada volta do laço, ida e
  // volta, para depois voltar ao mesmo lugar no fim.
  { key: 'cordilheira',     voo: 26.0, parada: 26, soDesktop: true },
  { key: 'cordilheirarasante', voo: 20.0, parada: 26, soDesktop: true },

  // ── 5. o parque e a caverna do Leônidas ───────────────────────────────────
  // ⚠️ ESTE ATO É DE CHÃO, e é por isso que ele não conta como "sair da
  // cúpula": `park` corre a 30 m de altura e as três do templo são de dentro da
  // caverna. Em nenhuma delas a casca aparece por fora.
  { key: 'park',            voo: 36.0, parada: 24, soDesktop: true },
  { key: 'parkclose',       voo: 20.0, parada: 24, soDesktop: true },
  { key: 'temple',          voo: 22.0, parada: 22, soDesktop: true },
  { key: 'templein',        voo: 16.0, parada: 28, soDesktop: true },
  { key: 'templegarden',    voo: 14.0, parada: 26, soDesktop: true },

  // ── 6. A SAÍDA, e ela é uma só: spaceport, foguetes e a descida ───────────
  { key: 'spaceport',       voo: 34.0, parada: 24 },
  { key: 'spaceportperto',  voo: 16.0, parada: 26 },
  // ⚠️ A BANDA DE ÓRBITA MEDIDA: as naves da mempool giram em r 911 m a
  // **4.828 m** de altura, sobre a praça. Esta parada olha para baixo de 5.100:
  // pega a praça inteira, os canais radiais e as naves com o rastro cruzando o
  // quadro. E ela NÃO depende de haver nave (mesma regra do `padtour`): sem
  // mempool, continua sendo a zenital da praça.
  { key: 'orbita',          voo: 30.0, parada: 26 },

  // ── 7. a descida ao centro, e agora ela tem QUATRO âncoras ────────────────
  // ⚠️ THE SPHERE ENTROU AQUI EM 08/09, vinda do ato 4. Ela é a âncora NORTE do
  // anel r 620, então a descida passa a contar a praça fechada: Kray a leste,
  // a esfera ao norte, o deck no meio e a zenital por cima. As duas paradas
  // dela ficam ANTES da Kray porque a órbita (parada anterior) desce do zênite,
  // e o norte é o primeiro quadrante que a câmera encontra vindo de cima.
  //
  // ⚠️ O VOO ATÉ ELA ENCOLHEU DE 32 PARA 18 s, e não é aperto de ritmo: é a
  // distância que mudou. No ato 4 a câmera vinha da cordilheira, a 5 km; aqui
  // ela vem da órbita, direto por cima da praça.
  // ⚠️ TRÊS PARADAS E NÃO DUAS, em escala descendente: aberta (787 m, a quarta
  // âncora fechando a praça), média (318 m, a faixa de LED legível) e CHÃO (170 m,
  // dentro do jardim, olho a 1,7 m). A terceira entrou em 08/09 numa auditoria do
  // roteiro contra a obra do dia: o jardim do avental era a única peça visível
  // construída naquele dia sem uma parada sequer.
  { key: 'sphere',          voo: 18.0, parada: 24 },
  { key: 'sphereperto',     voo: 14.0, parada: 26 },
  { key: 'spherejardim',    voo: 12.0, parada: 26 },
  { key: 'kray',            voo: 22.0, parada: 22 },
  { key: 'deck',            voo: 20.0, parada: 24 },
  { key: 'top',             voo: 18.0, parada: 24 },
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
