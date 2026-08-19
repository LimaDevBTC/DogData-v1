// A TABELA dos adereços: onde cada modelo de fora entra na praça, e por quê.
// Uma linha por peça; `props.ts` cuida do resto (carga, instância, terreno,
// culling). Os nomes de arquivo são os de `public/city/sf/`, convertidos por
// `blender/fetch_batch.py` a partir de `blender/picks.json`. Todo modelo é
// CC0/CC-BY e está creditado em `sf-assets.ts` (a licença exige).
//
// A REGRA: nada entra por ser bonito. Cada linha diz onde e por quê; as espécies
// de árvore que aqui viram modelo real saem do gerador procedural de
// `precinct.ts` (opção `realTrees`), para não haver duas árvores no mesmo lugar.
import type { PropSpec } from './props'
import {
  onDiagonal, WHITEPAPER_CYPRESSES, SATOSHI_CYPRESSES, ORDINAL_OLIVES, PAW_BLOSSOMS,
  QUADRANT_ANGLE, poolCenter, BOULEVARD_PALMS, DECK_GATE_PALMS, HERO_PALMS, DECK_Y,
} from './garden-plan'
import { R_ANCHOR } from './precinct'
import { PAD_MAIN } from './orbit-layer'

const rad = (d: number) => (d * Math.PI) / 180

/** um anel de `n` pontos no raio `r`, começando no ângulo `a0` (graus, de +x para +z) */
export function ring(n: number, r: number, a0 = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(a0) + (i / n) * Math.PI * 2
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]
  })
}
/** pontos ao longo de um bulevar cardeal (0 = norte, 90 = leste, 180 = sul, 270 = oeste) */
export function alongBoulevard(deg: number, rs: number[], side = 0): [number, number][] {
  const a = rad(deg)
  return rs.map((r) => [Math.sin(a) * r + Math.cos(a) * side, Math.cos(a) * r - Math.sin(a) * side] as [number, number])
}
/** pontos ao longo de uma alameda diagonal */
export function alongAllee(q: 'NE' | 'NW' | 'SE' | 'SW', rs: number[], side = 0): [number, number][] {
  return rs.map((r) => onDiagonal(q, r, side))
}

/** os bancos do Anel, olhando para dentro (o mesmo lugar dos antigos de caixa) */
const BENCH_RING = ring(24, 452 - 34 / 2 + 3, 7.5)
/** as urnas: nas esquinas dos parterres, entre as portas dos bulevares */
const URNS = ring(16, 332 + 38, 11.25).filter(([x, z]) => Math.abs(Math.sin(2 * Math.atan2(z, x))) > 0.2)

// ── o DECK central (revisão de 2026-08-19: "todos os seus elementos são
// genéricos"). O deck é a laje da praça, em y = DECK_Y; tudo aqui é `lift`
// relativo ao terreno, então cada peça leva `deckLift` para subir do chão do
// regolito (y 0) até a laje. ────────────────────────────────────────────────
const deckLift = DECK_Y
/** os quatro eixos do deck, a `r` do centro */
const deckAxis = (r: number): [number, number][] => [[0, -r], [r, 0], [0, r], [-r, 0]]
/** as diagonais do deck */
const deckDiag = (r: number): [number, number][] => {
  const k = r / Math.SQRT2
  return [[k, -k], [k, k], [-k, k], [-k, -k]]
}

export const PROPS: readonly PropSpec[] = [
  // ── árvores: as espécies com papel (as de copa redonda e os pinheiros seguem
  // procedurais nos setores, que é onde ninguém chega perto) ──────────────────
  {
    file: 'tree-cypress', why: 'a nave do Jardim do White Paper e o crescente do Espelho de Satoshi',
    at: [...WHITEPAPER_CYPRESSES, ...SATOSHI_CYPRESSES], scale: 1, jitter: 0.14, cull: 1800,
  },
  {
    file: 'tree-olive', why: 'o jardim antigo em volta do círculo de runestones (SW)',
    at: ORDINAL_OLIVES, jitter: 0.16, cull: 1500,
  },
  {
    file: 'tree-blossom', why: 'a Pata de Diamante é o único jardim que floresce',
    at: PAW_BLOSSOMS, jitter: 0.18, cull: 1500,
  },
  // ── palmeiras de verdade: as antigas "murchas" saíram (fundador, 2026-08-19) ──
  {
    file: 'palm-date', why: 'as alamedas dos quatro bulevares e os portões do Anel: tamareira cheia e ereta',
    at: [...BOULEVARD_PALMS, ...HERO_PALMS], jitter: 0.12, cull: 1500,
  },
  {
    file: 'palm-tall', why: 'oito palmeiras altas nas quatro portas do deck, para marcar a subida',
    at: DECK_GATE_PALMS, jitter: 0.08, cull: 1700,
  },
  // ── o deck central, DEPOIS DA LIMPEZA (2026-08-19) ─────────────────────────
  // O deck ficou com o que significa: podium, escadarias, colunata e o inlay do
  // Bitcoin no piso. Os obeliscos, a esfera armilar e as taças de Versalhes
  // saíram daqui (aumentavam a confusão que o fundador apontou) e foram para o
  // jardim, onde o vocabulário é esse. No deck fica só o que serve a quem chega:
  {
    file: 'column-doric', why: 'a colunata do deck: 36 colunas dóricas na borda, no lugar dos cones brancos do GLB',
    at: ring(28, 250, 6.4), lift: deckLift, jitter: 0.03, cull: 3200,
  },
  {
    file: 'torch-pillar', why: 'oito pilares com fogo, aos pares no topo das quatro escadarias',
    at: [
      ...alongBoulevard(0, [286], -22), ...alongBoulevard(0, [286], 22),
      ...alongBoulevard(90, [286], -22), ...alongBoulevard(90, [286], 22),
      ...alongBoulevard(180, [286], -22), ...alongBoulevard(180, [286], 22),
      ...alongBoulevard(270, [286], -22), ...alongBoulevard(270, [286], 22),
    ],
    yaw: 'center', scale: 3.4, lift: deckLift, cull: 3000,
  },
  {
    file: 'brazier', why: 'quatro braseiros em volta do inlay do Bitcoin, no piso do deck',
    at: deckDiag(150), yaw: 'center', scale: 3.2, lift: deckLift, cull: 2200,
  },
  {
    file: 'btc-atm', why: 'dois caixas de BTC no topo da escadaria norte, onde se chega ao deck',
    at: [[-14, -196], [14, -196]], yaw: 'center', lift: deckLift, cull: 1200, castShadow: false,
  },
  // ── as peças que saíram do deck, agora no jardim ──────────────────────────
  {
    file: 'armillary', why: 'a esfera armilar no eixo do jardim norte, antes da Grande Fonte',
    at: [[0, -520]], yaw: 'center', scale: 3.0, lift: 1.5, cull: 1600,
  },
  {
    file: 'pedestal', why: 'a base da esfera armilar',
    at: [[0, -520]], scale: 1.5, cull: 1600,
  },
  {
    file: 'deck-colonnade', why: 'as duas taças de Versalhes nas portas leste e oeste do jardim',
    at: [[520, 0], [-520, 0]], yaw: 'center', scale: 0.62, cull: 1600,
  },
  // ── as árvores emblemáticas (item 11): poucas, boas, com silhueta própria ──
  // Das seis que o garimpo trouxe, três não eram árvore inteira (dois scans de
  // tronco sem copa e uma cerejeira pela metade) e foram recusadas na folha de
  // contato. Ficaram as três que se sustentam de perto.
  {
    file: 'tree-maple', why: 'bordos japoneses ao longo da alameda do Jardim Ordinal: a única cor quente do jardim',
    at: [...alongAllee('SW', [560, 600, 640, 680], 26), ...alongAllee('SW', [560, 600, 640, 680], -26)],
    jitter: 0.12, cull: 1400,
  },
  {
    file: 'tree-medit', why: 'a árvore de copa do cinturão interno, no lugar das copas procedurais de perto',
    at: ring(20, 392, 9), jitter: 0.16, cull: 1600,
  },
  {
    file: 'tree-gnarled', why: 'três árvores antigas, retorcidas, junto à Grande Fonte do norte: as mais velhas da praça',
    at: [[-58, -556], [64, -572], [-14, -604]], jitter: 0.1, cull: 1600,
  },
  // ── água ────────────────────────────────────────────────────────────────────
  {
    file: 'fountain-grand', why: 'a Grande Fonte do norte, no lugar da quarta âncora: escultura no eixo',
    at: [[0, -R_ANCHOR]], yaw: 'center', scale: 2.6, lift: 2.2, cull: 4000, envMapIntensity: 1.3,
  },
  {
    file: 'fountain-basin', why: 'um chafariz no meio dos espelhos do norte e do oeste (o do DOG fica livre: a marca é o assunto)',
    at: [poolCenter('NE'), poolCenter('SW'), poolCenter('NW')], yaw: 'center', scale: 2.4, lift: 0.3, cull: 2200,
  },
  {
    file: 'garden-urn', why: 'urnas nas esquinas dos parterres, o vocabulário do jardim de palácio',
    at: URNS, yaw: 'center', scale: 1, jitter: 0.06, cull: 1100,
  },
  // ── o que se senta e o que ilumina ─────────────────────────────────────────
  {
    file: 'bench-classic', why: 'os bancos do Anel, olhando para o deck',
    at: BENCH_RING, yaw: 'center', cull: 1000, castShadow: false,
  },
  {
    file: 'lamp-stone', why: 'lanternas de pedra ao longo da alameda do Jardim Ordinal',
    at: [...alongAllee('SW', [500, 540, 580, 620, 660, 700], 11), ...alongAllee('SW', [500, 540, 580, 620, 660, 700], -11)],
    scale: 1, cull: 1100, castShadow: false,
  },
  // ── o spaceport: torre, tanques e antenas ──────────────────────────────────
  {
    file: 'sp-strongback', why: 'a torre de lançamento do spaceport, ao lado do pad principal',
    at: [[PAD_MAIN.x + 120, PAD_MAIN.z - 40]], yaw: 'center', scale: 1, cull: 9000,
  },
  {
    file: 'sp-tank', why: 'o parque de tanques atrás dos hangares',
    at: [[PAD_MAIN.x - 250, PAD_MAIN.z + 240], [PAD_MAIN.x - 250, PAD_MAIN.z + 300], [PAD_MAIN.x - 250, PAD_MAIN.z + 360]],
    yaw: 90, scale: 1.4, cull: 6000,
  },
  {
    file: 'sp-dish', why: 'as antenas do controle, olhando para a Terra',
    at: [[PAD_MAIN.x + 330, PAD_MAIN.z + 90], [PAD_MAIN.x + 380, PAD_MAIN.z + 160]],
    yaw: 210, scale: 1.6, cull: 6000,
  },
]

export { QUADRANT_ANGLE }
