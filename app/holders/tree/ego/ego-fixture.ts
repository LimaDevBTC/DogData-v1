// Fixture completa e realista do contrato do ego, pra desenvolver a cena
// sem depender da API (zero fetch na missao do renderer). Os numeros seguem
// a realidade do DOG: supply 100B, tesouraria do airdrop no centro, Kraken /
// Gate / Bitget rotuladas como exchange entre as contrapartes de saida e
// restos agregados nos DOIS lados.

import type { EgoResponse, EgoEdge, EgoLabel } from './ego-types'

// Mesmo endereco de ROOT_WALLET em app/api/holders/tree/_shared.ts,
// copiado como literal pra nao arrastar codigo de servidor pro client.
const ROOT = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'

// Enderecos ficticios mas com formato valido, so pra fixture.
const ETCH = 'bc1petchrevealsrc3s6d1r5e8w2q7a4z9m2k5j8h3f7g1'
const KRAKEN = 'bc1qkrakenhot7f2m9x4c8v0t3s6d1r5e8w2q7a4z9x7f2'
const GATE = 'bc1qgatehotx4c8v0t3s6d1r5e8w2q7a4z9m2k5j8h3g6f4'
const BITGET = 'bc1qbitgetcstdy0t3s6d1r5e8w2q7a4z9m2k5j8h3b8c1'
const MERLIN = 'bc1pmerlinbridgevault6d1r5e8w2q7a4z9m2k5j8h3d9e2'
const AIRDDIST = 'bc1qairdropdistr5e8w2q7a4z9m2k5j8h3g6f4d9e2a5b1'
const MMDESK = 'bc1qmmdeskalpha2q7a4z9m2k5j8h3g6f4d9e2a5b1c4d7'
const RETURN1 = 'bc1qreturndust9z2m5k8j3h6g1f4d7e0a3b6c9d2e5r1t3'
const RETURN2 = 'bc1preturnsweep2m5k8j3h6g1f4d7e0a3b6c9d2e5s4u6'
const W1 = 'bc1qw4lletone9z2m5k8j3h6g1f4d7e0a3b6c9d2e5x7f2'
const W2 = 'bc1qw4llettwo2m5k8j3h6g1f4d7e0a3b6c9d2e5f8a1b4'
const W3 = 'bc1pw4lletthree5k8j3h6g1f4d7e0a3b6c9d2e5f8g2h5'
const W4 = 'bc1qw4lletfour8j3h6g1f4d7e0a3b6c9d2e5f8g2h5j8k1'
const W5 = 'bc1qw4lletfive3h6g1f4d7e0a3b6c9d2e5f8g2h5j8k1m4'
const W6 = 'bc1pw4lletsix6g1f4d7e0a3b6c9d2e5f8g2h5j8k1m4n7'

function label(
  name: string,
  cat: EgoLabel['cat'],
  source: EgoLabel['source'] = 'dogdata',
): EgoLabel {
  return { name, cat, source }
}

function edge(
  w: string,
  dog: number,
  txs: number,
  fb: number,
  lb: number,
  b: number,
  h: boolean,
  lab?: EgoLabel,
): EgoEdge {
  return { w, label: lab ?? null, b, h, dog, txs, fb, lb }
}

export const EGO_FIXTURE: EgoResponse = {
  // A tesouraria do airdrop no centro: recebeu o etch inteiro (100B) mais
  // uns refluxos pequenos, distribuiu quase tudo e segura 0.4B.
  center: {
    w: ROOT,
    label: label('DOG TREASURY', 'vault'),
    b: 0.4e9,
    h: true,
    depth: 0,
    in_dog: 100.83e9,
    out_dog: 99.6e9,
    in_pairs: 9,
    out_pairs: 80850,
  },
  // ENTRADAS (semicirculo esquerdo): o etch e refluxos de mesas e poeira.
  inflows: [
    edge(ETCH, 100e9, 1, 840000, 840000, 0, false, label('ETCH REVEAL', 'other')),
    edge(MMDESK, 0.42e9, 61, 862100, 909900, 0.1e9, true, label('MM DESK ALPHA', 'mm')),
    edge(RETURN2, 0.21e9, 4, 871400, 902500, 0.02e9, true),
    edge(RETURN1, 0.09e9, 12, 858800, 897300, 0, false),
    edge(W6, 0.05e9, 2, 851900, 851900, 0, false),
    edge(W5, 0.03e9, 1, 866200, 866200, 0.05e9, true),
  ],
  // SAIDAS (semicirculo direito): exchanges rotuladas + carteiras cruas.
  outflows: [
    edge(KRAKEN, 13.9e9, 412, 840100, 912400, 12.69e9, true, label('KRAKEN HOT', 'exchange')),
    edge(GATE, 6.2e9, 188, 840200, 909800, 4.3e9, true, label('GATE HOT', 'exchange')),
    edge(BITGET, 4.8e9, 95, 841000, 905300, 4.0e9, true, label('BITGET CUSTODY', 'exchange')),
    edge(MERLIN, 3.8e9, 22, 842500, 861200, 3.75e9, true, label('MERLIN BRIDGE', 'vault')),
    edge(AIRDDIST, 3.1e9, 1804, 840050, 858400, 0.05e9, true, label('AIRDROP DISTRIBUTOR', 'distributor')),
    edge(MMDESK, 2.2e9, 240, 843300, 911600, 0.1e9, true, label('MM DESK ALPHA', 'mm')),
    edge(W1, 1.9e9, 3, 840070, 840120, 1.7e9, true, label('DIAMOND PAW 07', 'other', 'verified')),
    edge(W2, 1.5e9, 7, 840090, 852300, 0, false),
    edge(W3, 1.2e9, 4, 840060, 848800, 0.8e9, true),
    edge(W4, 0.9e9, 5, 840080, 855100, 0.2e9, true),
    edge(W5, 0.7e9, 2, 840110, 840110, 0.05e9, true),
    edge(W6, 0.5e9, 6, 840130, 851900, 0, false),
  ],
  // Contrapartes alem do limit, agregadas: restos nos DOIS lados.
  restIn: { n: 3, dog: 0.03e9 },
  restOut: { n: 80838, dog: 58.9e9 },
  meta: {
    w: ROOT,
    limit: 24,
    min: 0,
    dir: 'all',
    generated_at: '2026-08-26T12:00:00.000Z',
  },
}
