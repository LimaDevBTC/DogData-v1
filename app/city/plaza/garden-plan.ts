// O plano dos jardins (praca-jardins.md): só geometria e nomes, sem three, para o
// precinto (que planta e pavimenta em volta), os monumentos (que ocupam) e a
// Calçada dos Fundadores lerem o MESMO desenho. Quadro three: x leste, z sul.
//
// Os quatro espelhos d'água estão nas diagonais em r 560:
//   SE (+x,+z)  a Pata de Diamante ($DOG)
//   SW (−x,+z)  o Jardim Ordinal
//   NW (−x,−z)  o Espelho de Satoshi
//   NE (+x,−z)  o Jardim do White Paper, com o Bloco Gênese junto à muralha

export const R_POOL_RING = 560
export const POOL_R = 48

export type Quadrant = 'SE' | 'SW' | 'NW' | 'NE'
/** ângulo (medido a partir de +x para +z, como Math.atan2(z, x)) do eixo de cada quadrante */
export const QUADRANT_ANGLE: Record<Quadrant, number> = {
  SE: Math.PI / 4,
  SW: (3 * Math.PI) / 4,
  NW: (5 * Math.PI) / 4,
  NE: (7 * Math.PI) / 4,
}
export function poolCenter(q: Quadrant): [number, number] {
  const a = QUADRANT_ANGLE[q]
  return [Math.cos(a) * R_POOL_RING, Math.sin(a) * R_POOL_RING]
}
/** ponto na diagonal do quadrante, a `r` do centro da praça, deslocado `side` metros para o lado esquerdo (olhando para fora) */
export function onDiagonal(q: Quadrant, r: number, side = 0): [number, number] {
  const a = QUADRANT_ANGLE[q]
  const px = -Math.sin(a), pz = Math.cos(a) // perpendicular à esquerda de quem olha para fora
  return [Math.cos(a) * r + px * side, Math.sin(a) * r + pz * side]
}

// ═══════════════════════════════════════════════════════════════════════════
// AS QUATRO QUE FICAM, EM CIMA DO DECK, A 90° UMA DA OUTRA (22/09/2026)
//
// Decisão do fundador: o jardim clássico saiu (ver a bandeira `JARDIM` em
// precinct.ts) e só as peças com significado continuam na Satoshi Plaza,
// mudando-se para cima do deck, debaixo da torre: a Pata de Diamante com a
// estátua do Leônidas, o Jardim do White Paper e o painel do Dog Social Club.
// Horas depois entrou a quarta — o TELÃO do Vincent, que era a fachada da
// Cryptolution House e foi separada da casa a pedido dele — e o pente passou de
// 120° para 90°: "prefiro integrar o telão com as outras três peças e quebrar
// cada um em 90°".
//
// ⚠️ O DESLOCAMENTO DO PENTE NÃO É ESCOLHA LIVRE, E ELE TEM DONO. **68,7° é o
// rumo do condomínio do Dog Social Club na cidade externa** (`DSC_RUMO` em
// `scripts/gerar_cidade.py`, que decide o setor cujos lotes mais internos são
// reservados a eles), e é exatamente o rumo em que o painel já estava. O pente
// fica ancorado nele com qualquer passo, para o painel não parar de apontar
// para o condomínio.
//
// ⚠️ E O PASSO DE 90° NÃO CAI EM BULEVAR, ao contrário do que esta nota dizia
// quando o pente era de 120°. Um pente de 90° só encosta nos quatro bulevares
// cardeais se COMEÇAR num deles (deslocamento múltiplo de 90); ancorado em 68,7
// ele passa a 21,3° do bulevar mais próximo. De quebra também não cai nas
// quatro DIAGONAIS, que é onde moram os braseiros de r 150: cada braço fica a
// 23,7° delas, 62 m de folga no raio do braseiro.
//
//   68,7°   painel do Dog Social Club   (nunca se mexeu de rumo)
//  158,7°   Pata de Diamante + Leônidas
//  248,7°   Telão da Cryptolution       (ver telao.ts)
//  338,7°   Jardim do White Paper
//
// ⚠️ A FAIXA LIVRE DO DECK É r 85 A 245, MEDIDA, NÃO SUPOSTA: por dentro o
// pedestal da Agulha vai a 56 e o Círculo dos Fundadores fecha em 77; por fora
// a colunata dórica está em 250. As caixas de BTC ocupam r 196 perto do norte,
// em 355,9° e 4,1° — o braço do White Paper passa a 17,2° delas.
//
// ⚠️ E A COTA É A ARMADILHA DESTA MUDANÇA. As peças se assentam por
// `yAt(x, z)`, que é o regolito; o piso do deck está `DECK_Y` (39,95 m) ACIMA
// disso. Mudar só o (x, z) enterra as quatro quarenta metros abaixo do piso.
// Ver a nota de `DECK_Y` mais abaixo, que já documenta a mesma armadilha para
// `props-table.ts` e para a Calçada dos Fundadores.
export const DECK_RUMO = { dsc: 68.7, pata: 158.7, telao: 248.7, paper: 338.7 } as const

/** ponto no deck: rumo de BÚSSOLA da cidade (x leste, z sul), raio, e `side`
 *  metros para a esquerda de quem olha para fora. É o irmão de `onDiagonal`
 *  para quem não mora numa diagonal. */
export function noDeck(rumoGraus: number, r: number, side = 0): [number, number] {
  const b = (rumoGraus * Math.PI) / 180
  const ux = Math.sin(b), uz = -Math.cos(b)     // para fora
  return [ux * r + Math.cos(b) * side, uz * r + Math.sin(b) * side]
}

// ── O Telão da Cryptolution: a fachada saiu da casa e virou peça da praça ───
// O telão era a FACHADA da Cryptolution House (cryptolution-house.ts): o vão que
// o Blender abriu no modelo, com a thumbnail do vídeo do dia do Vincent e o
// clique que levanta o player. A casa nunca chegou a entrar na cena, e o
// fundador decidiu separar as duas coisas: "colocar o telão passando o vídeo
// dele na praça principal e deixar a mansão dele separada". O telão virou a
// quarta peça do pente; a casa continua existindo como módulo, sem telão.
//
/** ⚠️ O TELÃO ENTRA NA MESMA ESCALA DA PATA (0,60), E ISSO É O ASSUNTO DA PEÇA.
 *  O vão do Blender tem 96 × 54 m. Em tamanho cheio, no deck, ele não seria a
 *  quarta peça do conjunto: a palma da pata mede 57,6 m de diâmetro depois do
 *  conserto de hoje, e uma placa de 96 m ao lado dela faz as outras três lerem
 *  como detalhe. Em 0,60 o telão fica com 57,6 m de largura, exatamente a
 *  palma, e as quatro peças passam a ter a mesma escala. Do centro da laje ele
 *  ainda preenche 14° do campo de visão, que é tela de cinema grande. */
export const TELAO_ESCALA = 0.6
export const TELAO_W = 96 * TELAO_ESCALA          // 57,6
export const TELAO_H = 54 * TELAO_ESCALA          // 32,4
/** o peitoril: a tela não começa no piso, senão a primeira fila de gente tapa o
 *  rodapé do vídeo de quem está atrás. 7 m é a altura do pódio do Leônidas mais
 *  o pedestal, para as duas peças terem a mesma linha de base na chapa. */
export const TELAO_PEITORIL = 7
/** ⚠️ r 224 É O PLANO DA TELA, E QUEM MANDA NA FOLGA É O CANTO, NÃO O CENTRO.
 *  A peça inteira é um retângulo TANGENTE de 79,6 m de largura (a saia do
 *  pódio) por 20 de fundo, do degrau da frente (z +4 local) ao fundo do pódio
 *  (z −12). O canto de um retângulo tangente não fica em `r + fundo`: fica em
 *  √((r + fundo)² + meia largura²) — a mesma aritmética do §23 do masterplan,
 *  que custou 210 lotes sobrepostos na Orla da Baía.
 *
 *  Com a face em 224 o canto mede **239,3 m**, 10,7 m antes da colunata dórica
 *  de 250; o Leônidas fecha em 237 do outro lado, que é a mesma ordem de folga.
 *  Em 230, que foi o primeiro número que escrevi, o canto ia a 245,2 e sobrava
 *  4,8 m para uma colunata cujas colunas têm raio próprio. */
export const TELAO_POS = noDeck(DECK_RUMO.telao, 224)
/** ⚠️ ISTO É RAIO DE PLANTIO, NÃO EXTENSÃO RADIAL. Entra em `RESERVED`, que é
 *  uma lista de CÍRCULOS para o plantio evitar, e por isso cobre a meia largura
 *  do pódio (39,8) mais folga. Lido como alcance radial ele diria que a peça
 *  vai a 266 e fura a colunata, o que é falso: ver a nota de `TELAO_POS`. */
export const TELAO_R = 42

// ── Jardim do White Paper (rumo 338,7): nove estelas alternando os lados da alameda ──
/** ⚠️ A ALAMEDA ESTREITOU DE 13 PARA 7 m, E É ARITMÉTICA, NÃO GOSTO. As estelas
 *  alternam os lados, então a alameda tem 2×STELA_SIDE de largura e o passo
 *  entre duas estelas seguidas é o vão radial. Enquanto o passo era 25,75 m
 *  (r 628 a 834 na diagonal), 13 m de lado davam 26 de largura contra 25,75 de
 *  vão: quadrado, e a fileira lia como nave. No deck o passo caiu para 15 m e a
 *  largura de 26 passou a ser MAIOR que o vão: o zigue-zague deixou de ler como
 *  caminho e virou um punhado de lápides espalhadas (visto na chapa de 22/09).
 *  Com 7 m a proporção volta: 14 de largura contra 15 de vão. */
export const STELA_SIDE = 7
/** ⚠️ OS NOVE RAIOS ENCOLHERAM PARA CABER NO DECK. A alameda ocupava 206 m
 *  (r 628 a 834) na diagonal NE; a faixa livre do deck tem 160 m. Passo de
 *  15 m em vez de 25,75, de r 105 a 225, e o Bloco Gênese fecha em 240, logo
 *  antes da colunata. A leitura não muda: quem entra pelo anel caminha as nove
 *  páginas para dentro e encontra o Gênese no fim. */
const STELA_R = [105, 120, 135, 150, 165, 180, 195, 210, 225]
export const STELAE: { pos: [number, number]; side: -1 | 1; page: number }[] = STELA_R.map((r, i) => {
  const side = (i % 2 === 0 ? 1 : -1) as -1 | 1
  return { pos: noDeck(DECK_RUMO.paper, r, side * STELA_SIDE), side, page: i + 1 }
})
export const GENESIS_POS = noDeck(DECK_RUMO.paper, 240)
/** ciprestes atrás das estelas: uma nave, duas filas, saltando o passeio-anel */
/** ⚠️ VAZIO DESDE 22/09: os ciprestes eram jardim, e o jardim saiu (ver a
 *  bandeira `JARDIM` em precinct.ts). A lista continua exportada porque quem a
 *  consome não deve precisar saber disso; um dia ela volta com outra espécie,
 *  se o fundador quiser árvore no deck. */
export const WHITEPAPER_CYPRESSES: [number, number][] = []

// ── O Espelho de Satoshi (NW): a figura no espelho d'água, 21 ciprestes em crescente ──
export const SATOSHI_POOL = poolCenter('NW')
/** dois arcos de dez ciprestes atrás da figura, um de cada lado da alameda que segue para fora */
export const SATOSHI_CYPRESSES: [number, number][] = (() => {
  const [cx, cz] = SATOSHI_POOL
  const a0 = QUADRANT_ANGLE.NW // olhando para fora
  const out: [number, number][] = []
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const a = a0 + sgn * (0.24 + (i / 9) * 0.95)
      const r = 66 + (i / 9) * 8
      out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
  }
  return out
})()
/** dois bancos de pedra ladeando a alameda que vem do Anel, de frente para a figura */
export const SATOSHI_BENCHES: [number, number][] = [onDiagonal('NW', 500, 14), onDiagonal('NW', 500, -14)]

// ── A Pata de Diamante (rumo 158,7): a palma é o espelho da diagonal, quatro dedos abrem para fora ──
/** ⚠️ A PATA INTEIRA EM 0,60, E O FATOR É ÚNICO DE PROPÓSITO.
 *
 *  O erro que isto conserta: ao trazer a peça da diagonal para o deck eu
 *  encolhi a DISTÂNCIA dos dedos (80/92 para 52/62) e deixei os RAIOS como
 *  estavam (palma 48, dedo 17). Com 52 − 17 = 35 contra 48 de palma, cada dedo
 *  entrava 13 m dentro dela. Seis pares ficaram negativos e o fundador viu na
 *  chapa: "está uma várzea, tudo sobreposto".
 *
 *  Agora o fator 0,60 multiplica TUDO: palma, dedo, emblema, distâncias e o
 *  recuo do Leônidas. A forma é idêntica à do desenho que funcionava (os quatro
 *  ângulos de abertura não mudaram e todas as razões internas se conservam), e
 *  a menor folga entre peças de verdade é +2,71 m.
 *
 *  ⚠️ E A PALMA GANHOU RAIO PRÓPRIO EM VEZ DE USAR `POOL_R`. POOL_R é
 *  compartilhado: ele desenha também o Espelho de Satoshi em r 560 e os
 *  passeios de `precinct.ts`. Encolher POOL_R para caber a pata encolheria o
 *  Satoshi junto, que é a mesma família de erro que esta nota conserta. */
export const PAW_SCALE = 0.6
export const PAW_PALM_R = 48 * PAW_SCALE          // 28,8
export const PAW_MARK_R = 30 * PAW_SCALE          // 18,0, era 30 cravado em monuments.ts
export const PAW_PALM = noDeck(DECK_RUMO.pata, 120)
export const PAW_TOE_R = 17 * PAW_SCALE           // 10,2
/** ⚠️ O PASSEIO DO DEDO CAI DE 4,5 PARA 1,0 m, E ISSO NÃO É EFEITO DA ESCALA:
 *  É DEFEITO DO DESENHO ORIGINAL, achado agora. O vão entre dois dedos vizinhos
 *  vale 4,53 m na escala cheia; dois passeios de 4,5 somam 9. Os quatro anéis de
 *  passeio já se sobrepunham 4,47 m na diagonal, coplanares na mesma cota, ou
 *  seja z-fighting garantido desde sempre. Se um dia o passeio largo voltar, ele
 *  tem de ser UM contorno só (a união das quatro bordas), nunca quatro anéis. */
export const PAW_TOE_WALK = 1.0
export const PAW_TOES: [number, number][] = (() => {
  const [cx, cz] = PAW_PALM
  const b = (DECK_RUMO.pata * Math.PI) / 180
  const a0 = Math.atan2(-Math.cos(b), Math.sin(b))   // o rumo, na convenção atan2(z,x) deste arquivo
  return ([[-0.66, 80], [-0.23, 92], [0.23, 92], [0.66, 80]] as const)
    .map(([da, r]) => [cx + Math.cos(a0 + da) * r * PAW_SCALE,
                       cz + Math.sin(a0 + da) * r * PAW_SCALE] as [number, number])
})()
/** a placa sai de dentro da água (ela estava a 46,57 m do centro de uma palma
 *  de raio 48) e vai para o lado por onde se chega, o bulevar sul */
export const PAW_PLAQUE = noDeck(DECK_RUMO.pata, 120, -40)
/** Leonidas, o fundador do DOG: no eixo, atrás dos dedos da pata, de frente
 *  para a Agulha. 102 m atrás do centro da palma, que é os 170 do desenho
 *  original vezes o mesmo 0,60. Com pedestal (8) e passeio (7) ele fecha em
 *  r 237, oito metros antes da colunata dórica. */
export const LEONIDAS_POS = noDeck(DECK_RUMO.pata, 222)
export const LEONIDAS_PLINTH_R = 8
/** A casa do LeonidasNFT ("The Block"): o cubo fecha a vista da alameda SE
 *  atrás da estátua, como o Gênese fecha a NE. Fachada olhando o deck.
 *  O LeonidasNFT pediu MAIOR: o módulo escala 1,4× (cubo ~45 m, pódio ~62 m). */
export const BLOCK_POS = onDiagonal('SE', 825)
export const BLOCK_R = 45 // meia diagonal do pódio 1,4× (43,6) + folga
/** árvores de flor branca em arco atrás dos dedos, dos dois lados da alameda */
/** ⚠️ VAZIO DESDE 22/09, mesmo motivo dos ciprestes: era jardim. */
export const PAW_BLOSSOMS: [number, number][] = []

// ── Jardim Ordinal (SW): o círculo de runestones ao lado da alameda, e as placas ──
export const ORDINAL_CENTER = onDiagonal('SW', 660, 64)
export const ORDINAL_RING_R = 34
export const ORDINAL_STONES = 12
export const ORDINAL_PLAQUES: [number, number][] = [onDiagonal('SW', 640, 12), onDiagonal('SW', 640, -12)]
export const ORDINAL_OLIVES: [number, number][] = (() => {
  const [cx, cz] = ORDINAL_CENTER
  const out: [number, number][] = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2
    const r = 58 + (i % 3) * 9
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
  }
  return out
})()

// ── O busto do Satoshi (Sketchfab, "Mystery in Bronze"): no portão noroeste, ao
// lado da alameda que leva ao Espelho, de frente para quem passa ──────────────
export const BUST_POS = onDiagonal('NW', 476, 17)
/** as palmeiras das ALAMEDAS dos quatro bulevares (as procedurais saem daqui
 *  quando os modelos reais entram: `realTrees`) */
export const BOULEVARD_PALMS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (let k = 0; k < 8; k++) {
      const r = 332 + 16 + k * 16
      for (const sx of [-1, 1]) {
        const off = sx * (42 / 2 + 7)
        out.push([Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off])
      }
    }
  }
  return out
})()
/** palmeiras altas nas quatro portas do deck */
export const DECK_GATE_PALMS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (const sx of [-1, 1]) {
      const off = sx * 30
      const r = 316
      out.push([Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off])
    }
  }
  return out
})()
/** palmeiras "de perto" (o modelo real): quatro em cada portão do Anel */
export const HERO_PALMS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    for (const r of [452 - 34, 452 + 34]) {
      for (const s of [-1, 1]) {
        const off = s * 31
        out.push([Math.sin(a) * r + Math.cos(a) * off, Math.cos(a) * r - Math.sin(a) * off])
      }
    }
  }
  return out
})()

// ── O Círculo dos Fundadores: no PÉ DA TORRE, sobre o deck ─────────────────
// Estava no bulevar norte, que um dia vai levar à quarta âncora (decisão do
// fundador, 2026-08-19: "a placa dos doadores devia ser na base da torre"). O
// deck é a laje do plaza.glb: PlazaPodium termina em y 39,3 e o piso onde a
// Needle assenta está em 39,9, medido no GLB.
export const DECK_Y = 39.95
// ⚠️ ESTE NÚMERO NÃO MUDOU EM 05/09 (SEGUNDA RODADA), QUANDO A PRAÇA DESCEU
// PARA PRACA_Y (terrain.ts). DECK_Y é a distância da laje ao zero do MODELO
// (plaza.glb), e continua sendo essa distância; o que mudou foi a cota do
// CHÃO onde o modelo pousa. Os dois consumidores tratam isso de dois jeitos:
//   - props-table.ts:61 (`deckLift = DECK_Y`) soma DECK_Y à altura LOCAL do
//     terreno em cada ponto (`terrainY + DECK_Y`), então já acompanha sozinho
//     quando `terrainY` passa a valer PRACA_Y ali. NÃO MEXER.
//   - plaza-scene.tsx (o marco do Bitcoin, os dois refletores dele) usa
//     DECK_Y como cota ABSOLUTA (esses objetos não são filhos do grupo do
//     plaza.glb, então movê-lo não os move); ali a conta virou
//     `PRACA_Y + DECK_Y`, corrigida na própria plaza-scene.tsx.
// Medido no central-tower.glb: NEEDLE_PLINTH é um tambor de raio 56 que vai de
// y 47,9 a 57,9 (a torre assenta em 39,9), e WATER_JET_RING tem raio 81,3. O
// círculo das placas vive ENTRE os dois, no piso do deck, andável.
export const FOUNDERS_RINGS: { r: number; n: number }[] = [
  { r: 66, n: 48 }, // o muro: 48 trechos de 8,6 m, um por fundador
]
export const FOUNDERS_SLOTS = FOUNDERS_RINGS.reduce((a, b) => a + b.n, 0)
/** o anel de luz do fundo: fecha conforme a arrecadação; quando fechar, a cidade abre */
export const FOUNDERS_RING_R = 77

/** Onde NÃO se planta: círculos (x, z, r) reservados aos monumentos e placas. */
export const RESERVED: [number, number, number][] = [
  ...STELAE.map((s) => [s.pos[0], s.pos[1], 7] as [number, number, number]),
  [GENESIS_POS[0], GENESIS_POS[1], 16],
  ...WHITEPAPER_CYPRESSES.map(([x, z]) => [x, z, 4] as [number, number, number]),
  ...SATOSHI_CYPRESSES.map(([x, z]) => [x, z, 4] as [number, number, number]),
  ...SATOSHI_BENCHES.map(([x, z]) => [x, z, 5] as [number, number, number]),
  ...PAW_TOES.map(([x, z]) => [x, z, PAW_TOE_R + 8] as [number, number, number]),
  [PAW_PLAQUE[0], PAW_PLAQUE[1], 6],
  [LEONIDAS_POS[0], LEONIDAS_POS[1], LEONIDAS_PLINTH_R + 10],
  [BLOCK_POS[0], BLOCK_POS[1], BLOCK_R],
  [TELAO_POS[0], TELAO_POS[1], TELAO_R],
  ...PAW_BLOSSOMS.map(([x, z]) => [x, z, 5] as [number, number, number]),
  [ORDINAL_CENTER[0], ORDINAL_CENTER[1], ORDINAL_RING_R + 14],
  ...ORDINAL_PLAQUES.map(([x, z]) => [x, z, 5] as [number, number, number]),
  ...ORDINAL_OLIVES.map(([x, z]) => [x, z, 5] as [number, number, number]),
  [BUST_POS[0], BUST_POS[1], 7],
  ...HERO_PALMS.map(([x, z]) => [x, z, 6] as [number, number, number]),
  ...BOULEVARD_PALMS.map(([x, z]) => [x, z, 5] as [number, number, number]),
]
export function isReserved(x: number, z: number, margin = 0): boolean {
  for (const [cx, cz, r] of RESERVED) if (Math.hypot(x - cx, z - cz) < r + margin) return true
  return false
}
