// Fixture completa e realista do contrato do Flow, pra desenvolver a cena
// sem depender da API (zero fetch na missao do renderer). Os numeros seguem
// a realidade do DOG: supply 100B, tesouraria do airdrop como raiz, Kraken /
// Gate / Bitget rotuladas como exchange, restos por coluna e um refluxo.

import type {
  FlowResponse,
  FlowNode,
  RestNode,
  FlowLink,
  NodeLabel,
} from './flow-types'

// Mesmo endereco de ROOT_WALLET em app/api/holders/tree/_shared.ts,
// copiado como literal pra nao arrastar codigo de servidor pro client.
const ROOT = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'

// Enderecos ficticios mas com formato valido, so pra fixture.
const KRAKEN = 'bc1qkrakenhot7f2m9x4c8v0t3s6d1r5e8w2q7a4z9x7f2'
const GATE = 'bc1qgatehotx4c8v0t3s6d1r5e8w2q7a4z9m2k5j8h3g6f4'
const BITGET = 'bc1qbitgetcstdy0t3s6d1r5e8w2q7a4z9m2k5j8h3b8c1'
const MERLIN = 'bc1pmerlinbridgevault6d1r5e8w2q7a4z9m2k5j8h3d9e2'
const AIRDDIST = 'bc1qairdropdistr5e8w2q7a4z9m2k5j8h3g6f4d9e2a5b1'
const MMDESK = 'bc1qmmdeskalpha2q7a4z9m2k5j8h3g6f4d9e2a5b1c4d7'
const W1 = 'bc1qw4lletone9z2m5k8j3h6g1f4d7e0a3b6c9d2e5x7f2'
const W2 = 'bc1qw4llettwo2m5k8j3h6g1f4d7e0a3b6c9d2e5f8a1b4'
const W3 = 'bc1pw4lletthree5k8j3h6g1f4d7e0a3b6c9d2e5f8g2h5'
const W4 = 'bc1qw4lletfour8j3h6g1f4d7e0a3b6c9d2e5f8g2h5j8k1'
const W5 = 'bc1qw4lletfive3h6g1f4d7e0a3b6c9d2e5f8g2h5j8k1m4'
const W6 = 'bc1pw4lletsix6g1f4d7e0a3b6c9d2e5f8g2h5j8k1m4n7'
const G2A = 'bc1qgen2alpha1f4d7e0a3b6c9d2e5f8g2h5j8k1m4n7p0'
const G2B = 'bc1qgen2bravo4d7e0a3b6c9d2e5f8g2h5j8k1m4n7p0q3'
const G2C = 'bc1pgen2charlie7e0a3b6c9d2e5f8g2h5j8k1m4n7p0r6'
const G2D = 'bc1qgen2delta0a3b6c9d2e5f8g2h5j8k1m4n7p0q3r6s9'
const G3A = 'bc1qgen3alpha3b6c9d2e5f8g2h5j8k1m4n7p0q3r6s9t2'
const G3B = 'bc1pgen3bravo6c9d2e5f8g2h5j8k1m4n7p0q3r6s9t2u5'
const G3C = 'bc1qgen3charlie9d2e5f8g2h5j8k1m4n7p0q3r6s9t2v8'
const G4A = 'bc1qgen4deep2e5f8g2h5j8k1m4n7p0q3r6s9t2u5v8w1'
const G4B = 'bc1pgen4deeper5f8g2h5j8k1m4n7p0q3r6s9t2u5v8x4'

function label(name: string, cat: NodeLabel['cat'], source: NodeLabel['source'] = 'dogdata'): NodeLabel {
  return { name, cat, source }
}

function node(
  w: string,
  gen: number,
  inDog: number,
  outDog: number,
  b: number,
  h: boolean,
  extra?: Partial<FlowNode>,
): FlowNode {
  const base: FlowNode = {
    w,
    gen,
    b,
    in: inDog,
    out: outDog,
    held_pct: inDog > 0 ? Math.min(1, b / inDog) : 0,
    h,
    c: 0,
    sw: 0,
    sh: 0,
    sb: 0,
    label: null,
  }
  if (extra) {
    for (const key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        ;(base as unknown as Record<string, unknown>)[key] = (extra as Record<string, unknown>)[key]
      }
    }
  }
  return base
}

function rest(id: string, gen: number, kind: RestNode['kind'], n: number, b: number, inDog: number, outDog: number): RestNode {
  return { id, gen, kind, n, b, in: inDog, out: outDog }
}

function link(s: string, t: string, dog: number, txs: number, fb: number, lb: number, back?: true): FlowLink {
  const l: FlowLink = { s, t, dog, txs, fb, lb }
  if (back) l.back = true
  return l
}

// Raiz: a tesouraria recebeu o etch inteiro (100B) e distribuiu quase tudo.
const rootNode = node(ROOT, 0, 100e9, 99.6e9, 0.4e9, true, {
  c: 80850,
  sw: 263874,
  sh: 121400,
  sb: 100e9,
  label: label('DOG TREASURY', 'vault'),
})

// G1: 12 nos nomeados na ordem de promocao da spec (rotulados primeiro,
// depois por DOG movimentado).
const g1Nodes: FlowNode[] = [
  node(KRAKEN, 1, 14.1e9, 1.41e9, 12.69e9, true, { c: 210, sw: 3400, sh: 1900, sb: 13.1e9, label: label('KRAKEN HOT', 'exchange') }),
  node(GATE, 1, 6.4e9, 2.1e9, 4.3e9, true, { c: 88, sw: 940, sh: 610, sb: 4.6e9, label: label('GATE HOT', 'exchange') }),
  node(BITGET, 1, 4.9e9, 0.9e9, 4.0e9, true, { c: 61, sw: 720, sh: 505, sb: 4.2e9, label: label('BITGET CUSTODY', 'exchange') }),
  node(MERLIN, 1, 3.8e9, 0.05e9, 3.75e9, true, { c: 4, sw: 12, sh: 9, sb: 3.8e9, label: label('MERLIN BRIDGE', 'vault') }),
  node(AIRDDIST, 1, 3.1e9, 3.05e9, 0.05e9, true, { c: 12100, sw: 44100, sh: 20050, sb: 2.9e9, label: label('AIRDROP DISTRIBUTOR', 'distributor') }),
  node(MMDESK, 1, 2.4e9, 2.3e9, 0.1e9, true, { c: 340, sw: 2100, sh: 890, sb: 1.1e9, label: label('MM DESK ALPHA', 'mm') }),
  node(W1, 1, 1.9e9, 0.2e9, 1.7e9, true, { c: 6, sw: 40, sh: 25, sb: 1.8e9, label: label('DIAMOND PAW 07', 'other', 'verified') }),
  node(W2, 1, 1.5e9, 1.5e9, 0, false, { c: 55, sw: 480, sh: 190, sb: 0.9e9 }),
  node(W3, 1, 1.2e9, 0.4e9, 0.8e9, true, { c: 9, sw: 66, sh: 31, sb: 1.0e9 }),
  node(W4, 1, 0.9e9, 0.7e9, 0.2e9, true, { c: 21, sw: 130, sh: 70, sb: 0.5e9 }),
  node(W5, 1, 0.7e9, 0.65e9, 0.05e9, true, { c: 14, sw: 90, sh: 38, sb: 0.3e9 }),
  node(W6, 1, 0.5e9, 0.5e9, 0, false, { c: 30, sw: 210, sh: 85, sb: 0.4e9 }),
]

const g2Nodes: FlowNode[] = [
  node(G2A, 2, 2.6e9, 1.9e9, 0.7e9, true, { c: 44, sw: 300, sh: 140, sb: 1.4e9 }),
  node(G2B, 2, 1.8e9, 1.75e9, 0.05e9, true, { c: 120, sw: 800, sh: 260, sb: 0.9e9 }),
  node(G2C, 2, 1.1e9, 0.2e9, 0.9e9, true, { c: 3, sw: 18, sh: 12, sb: 1.0e9, label: label('OG WHALE 12', 'other', 'verified') }),
  node(G2D, 2, 0.8e9, 0.8e9, 0, false, { c: 16, sw: 95, sh: 30, sb: 0.3e9 }),
]

const g3Nodes: FlowNode[] = [
  node(G3A, 3, 1.4e9, 0.9e9, 0.5e9, true, { c: 8, sw: 40, sh: 22, sb: 0.7e9 }),
  node(G3B, 3, 0.9e9, 0.88e9, 0.02e9, true, { c: 26, sw: 150, sh: 55, sb: 0.4e9 }),
  node(G3C, 3, 0.6e9, 0.6e9, 0, false, { c: 11, sw: 60, sh: 19, sb: 0.2e9 }),
]

const g4Nodes: FlowNode[] = [
  node(G4A, 4, 1.1e9, 0.4e9, 0.7e9, true, { c: 5, sw: 22, sh: 14, sb: 0.9e9 }),
  node(G4B, 4, 0.7e9, 0.68e9, 0.02e9, true, { c: 40, sw: 310, sh: 96, sb: 0.5e9 }),
]

export const FLOW_FIXTURE: FlowResponse = {
  root: rootNode,
  cols: [
    { gen: 0, label: 'Root', nodes: [rootNode], rest: [] },
    {
      gen: 1,
      label: 'Gen 1',
      nodes: g1Nodes,
      rest: [
        rest('g1:holders', 1, 'holders', 41230, 18.4e9, 21.2e9, 2.8e9),
        rest('g1:spent', 1, 'spent', 27390, 0, 39.3e9, 39.3e9),
      ],
    },
    {
      gen: 2,
      label: 'Gen 2',
      nodes: g2Nodes,
      rest: [
        rest('g2:holders', 2, 'holders', 18640, 9.1e9, 10.6e9, 1.5e9),
        rest('g2:spent', 2, 'spent', 22110, 0, 17.8e9, 17.8e9),
      ],
    },
    {
      gen: 3,
      label: 'Gen 3',
      nodes: g3Nodes,
      rest: [
        rest('g3:holders', 3, 'holders', 9870, 4.2e9, 5.0e9, 0.8e9),
        rest('g3:spent', 3, 'spent', 12040, 0, 8.9e9, 8.9e9),
      ],
    },
    {
      gen: 4,
      label: 'Gen 4+',
      nodes: g4Nodes,
      rest: [
        rest('g4:holders', 4, 'holders', 30410, 6.6e9, 7.4e9, 0.8e9),
        rest('g4:spent', 4, 'spent', 41060, 0, 9.8e9, 9.8e9),
      ],
    },
  ],
  links: [
    // Raiz -> G1 (fluxo TOTAL do par via dog_flows, nao a primeira chegada)
    link(ROOT, KRAKEN, 13.9e9, 412, 840100, 912400),
    link(ROOT, GATE, 6.2e9, 188, 840200, 909800),
    link(ROOT, BITGET, 4.8e9, 95, 841000, 905300),
    link(ROOT, MERLIN, 3.8e9, 22, 842500, 861200),
    link(ROOT, AIRDDIST, 3.1e9, 1804, 840050, 858400),
    link(ROOT, MMDESK, 2.2e9, 240, 843300, 911600),
    link(ROOT, W1, 1.9e9, 3, 840070, 840120),
    link(ROOT, W2, 1.5e9, 7, 840090, 852300),
    link(ROOT, W3, 1.2e9, 4, 840060, 848800),
    link(ROOT, W4, 0.9e9, 5, 840080, 855100),
    link(ROOT, W5, 0.7e9, 2, 840110, 840110),
    link(ROOT, W6, 0.5e9, 6, 840130, 851900),
    link(ROOT, 'g1:holders', 21.2e9, 40110, 840050, 913000),
    link(ROOT, 'g1:spent', 39.3e9, 26480, 840050, 913200),
    // G1 -> G2
    link(AIRDDIST, G2A, 1.4e9, 610, 845000, 890200),
    link(AIRDDIST, 'g2:holders', 1.1e9, 8120, 845100, 902300),
    link(AIRDDIST, 'g2:spent', 0.5e9, 3040, 845200, 899100),
    link(MMDESK, G2B, 1.2e9, 320, 846400, 908800),
    link(W2, G2C, 1.1e9, 5, 852400, 853000),
    link(W2, 'g2:spent', 0.4e9, 2, 852600, 852600),
    link(GATE, G2D, 0.8e9, 44, 861300, 897700),
    link(GATE, 'g2:holders', 0.9e9, 130, 860000, 906500),
    link('g1:spent', 'g2:spent', 12.6e9, 18220, 841000, 912800),
    link('g1:spent', 'g2:holders', 7.8e9, 9110, 841200, 910100),
    // Pulo de geracao: raiz -> G2 direto (link que pula vai direto)
    link(ROOT, G2A, 1.2e9, 14, 844000, 844600),
    // G2 -> G3
    link(G2A, G3A, 1.1e9, 90, 848900, 905900),
    link(G2B, G3B, 0.9e9, 210, 850100, 909400),
    link(G2B, 'g3:spent', 0.6e9, 140, 850500, 907300),
    link('g2:spent', 'g3:spent', 6.1e9, 8450, 846000, 911900),
    link('g2:spent', 'g3:holders', 3.9e9, 5230, 846200, 910800),
    link(G2D, G3C, 0.6e9, 33, 858700, 896200),
    // G3 -> G4+
    link(G3A, G4A, 0.8e9, 12, 856000, 893800),
    link(G3B, G4B, 0.7e9, 61, 857400, 908100),
    link('g3:spent', 'g4:spent', 5.4e9, 6100, 851000, 912600),
    link('g3:holders', 'g4:holders', 2.9e9, 3900, 851400, 911300),
    // Refluxo: carteira de G2 devolvendo pra exchange de G1 (arco por baixo)
    link(G2B, KRAKEN, 0.62e9, 27, 870200, 912100, true),
    // Refluxo fundo: G3 voltando pra distribuidora de G1
    link(G3B, AIRDDIST, 0.18e9, 9, 881500, 904700, true),
  ],
  ghost: null,
  stats: {
    wallets: 263875,
    coverage_gap_pct: 0,
    direct_children: 80850,
    holding_pct: 61.8,
    exchange_dog: 21.4e9,
    exchange_pct_supply: 21.4,
  },
  meta: {
    root: ROOT,
    generated_at: '2026-08-26T12:00:00.000Z',
    flows: 'partial',
    min: 1000000,
    active: 'all',
    truncated_links: 37,
    total_links_considered: 157,
  },
}
