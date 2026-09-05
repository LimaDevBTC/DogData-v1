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

// ── Jardim do White Paper (NE): nove estelas alternando os lados da alameda ──
export const STELA_SIDE = 13
/** raios das nove estelas: cinco antes do passeio-anel (r 739..751), quatro depois */
const STELA_R = [628, 652, 676, 700, 724, 762, 786, 810, 834]
export const STELAE: { pos: [number, number]; side: -1 | 1; page: number }[] = STELA_R.map((r, i) => {
  const side = (i % 2 === 0 ? 1 : -1) as -1 | 1
  return { pos: onDiagonal('NE', r, side * STELA_SIDE), side, page: i + 1 }
})
export const GENESIS_POS = onDiagonal('NE', 872)
/** ciprestes atrás das estelas: uma nave, duas filas, saltando o passeio-anel */
export const WHITEPAPER_CYPRESSES: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let r = 618; r <= 850; r += 20) {
    if (r > 728 && r < 762) continue
    out.push(onDiagonal('NE', r, 25), onDiagonal('NE', r, -25))
  }
  return out
})()

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

// ── A Pata de Diamante (SE): a palma é o espelho da diagonal, quatro dedos abrem para fora ──
export const PAW_PALM = poolCenter('SE')
export const PAW_TOE_R = 17
export const PAW_TOES: [number, number][] = (() => {
  const [cx, cz] = PAW_PALM
  const a0 = QUADRANT_ANGLE.SE
  return ([[-0.66, 80], [-0.23, 92], [0.23, 92], [0.66, 80]] as const).map(([da, r]) => [cx + Math.cos(a0 + da) * r, cz + Math.sin(a0 + da) * r] as [number, number])
})()
export const PAW_PLAQUE = onDiagonal('SE', 498, 12)
/** Leonidas, o fundador do DOG: no eixo da diagonal, atrás dos dedos da pata, de frente para o deck */
export const LEONIDAS_POS = onDiagonal('SE', 730)
export const LEONIDAS_PLINTH_R = 8
/** árvores de flor branca em arco atrás dos dedos, dos dois lados da alameda */
export const PAW_BLOSSOMS: [number, number][] = (() => {
  const [cx, cz] = PAW_PALM
  const out: [number, number][] = []
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const a = QUADRANT_ANGLE.SE + sgn * (0.16 + (i / 5) * 1.3)
      const r = 118 + (i % 2) * 12
      out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
  }
  return out
})()

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
