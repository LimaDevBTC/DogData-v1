// Rodar: npx tsx --test app/dogcity/casa-da-licenca.test.ts
//
// As frases da casa da licença (decisão do fundador, 28/10/2026) para cada caso:
// licença com lote, com lote sem posição agora, sem lote, e sem licença. Os
// veículos têm de ser a frase EXATA dos cartões da landing (TIERS), e nenhuma
// frase pode ter travessão, data ou preço.
//
// Também (fundador, 28/10/2026): a carteira de custódia (corretora, empresa) NUNCA
// leva licença nem casa; a linha SECTOR da escritura escreve o nome do distrito
// nos nove setores; o CTA velho do número de Founder acabou; a nota de quem
// pagou sacando de corretora.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  casaDaLicenca, oQueConstroi, tipoPelaFrente, veiculosDe, nomeDaLicenca,
  ehCarteiraDeCustodia, licencaVisivel, rotuloDoSetor, notaCorretoraTexto,
  AVISO_SEM_LOTE, SUPORTE, SUPORTE_LEAD, CTA_LICENCA, TEXTO_LICENCA_ABERTA, NOTA_CORRETORA,
  type CasaDaLicenca,
} from './casa-da-licenca'
import { DISTRITO_DO_SETOR, SETOR_DAS_EMPRESAS, TIERS } from './dogcity-data'
import { buildLedger, type TxRow } from '../../lib/dog/founders-ledger'
import { FUND_DOG_ADDRESS, licenceFor } from '../../lib/dog/licence-btc'
import { licenceOfWallet } from '../../lib/dog/licence-wallet'

const lerRepo = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

const LOTE = { lot_id: 'S05-Q17-B1775-L027', sector: 5 }

test('Personal com lote: residência do catálogo do distrito, moto, em produção', () => {
  const c = casaDaLicenca('personal', LOTE)
  assert.deepEqual(c, {
    caso: 'com_lote',
    degrau: 'personal',
    licenca: 'Personal',
    rotulo: 'YOUR BUILDING · PERSONAL LICENCE',
    loteId: 'S05-Q17-B1775-L027',
    distrito: 'Timberline',
    constroi: 'A residence from the Timberline catalogue',
    veiculos: 'Vehicles: the $DOG moto',
    status: 'In production',
    tipo: null,
  })
})

test('Commercial com lote: uso misto com loja no térreo, moto e Cyber laranja', () => {
  const c = casaDaLicenca('commercial', { lot_id: 'S01-Q01-B0001-L001', sector: 1 })
  assert.equal(c?.caso, 'com_lote')
  if (c?.caso !== 'com_lote') return
  assert.equal(c.rotulo, 'YOUR BUILDING · COMMERCIAL LICENCE')
  assert.equal(c.distrito, 'Harbor Canals')
  assert.equal(c.constroi, 'A mixed-use building from the Harbor Canals catalogue (a shop on the ground floor, a home above)')
  assert.equal(c.veiculos, 'Vehicles: the $DOG moto and an orange Cyber $DOG')
  assert.equal(c.status, 'In production')
})

test('Patron com lote: projeto próprio, moto, Cyber preta e helicóptero, em projeto', () => {
  const c = casaDaLicenca('patron', { lot_id: 'S07-Q01-B001-L001', sector: 7 })
  assert.equal(c?.caso, 'com_lote')
  if (c?.caso !== 'com_lote') return
  assert.equal(c.licenca, 'Patron')
  assert.equal(c.distrito, 'The Spit')
  assert.equal(c.constroi, 'A custom residence designed for you')
  assert.equal(c.veiculos, 'Vehicles: the $DOG moto, a black Cyber $DOG (instead of the orange one) and the DOG helicopter')
  assert.equal(c.status, 'In design')
})

test('os veículos são a linha exata do cartão da landing, degrau a degrau', () => {
  for (const t of TIERS) {
    const linha = t.perks.find((p) => p.startsWith('Vehicles: '))
    assert.ok(linha, `cartão ${t.key} sem linha de veículos`)
    assert.equal(veiculosDe(t.key as 'personal'), linha)
    assert.equal(nomeDaLicenca(t.key as 'personal'), t.name)
  }
})

test('distrito com "The" não vira "the The"; Financial District não tem catálogo de casas', () => {
  assert.equal(oQueConstroi('personal', 7), 'A residence from The Spit catalogue')
  assert.equal(oQueConstroi('commercial', 9), 'A mixed-use building from the Bay Shore catalogue (a shop on the ground floor, a home above)')
  assert.equal(oQueConstroi('personal', 8), 'A residence from the district catalogue')
  // o setor 8 é só de empresa: mesmo com licença no placar, a casa nunca é desenhada ali
  assert.equal(casaDaLicenca('personal', { lot_id: 'S08-Q01-B001-L001', sector: 8 }), null)
  assert.equal(casaDaLicenca('commercial', { lot_id: 'S08-Q00-B0002-L004', sector: 8 }), null)
})

test('os nove setores têm nome, e o 1 a 6 seguem o mapa do jogo', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => DISTRITO_DO_SETOR[s]),
    ['Harbor Canals', 'Liberty Row', 'Brownstone Heights', 'Arroyo', 'Timberline', 'Atomic Heights', 'The Spit', 'Financial District', 'Bay Shore'],
  )
})

test('lote sem posição agora: a casa continua, sem id nem distrito, com a frase genérica', () => {
  const c = casaDaLicenca('personal', 'sem_posicao')
  assert.equal(c?.caso, 'com_lote')
  if (c?.caso !== 'com_lote') return
  assert.equal(c.loteId, null)
  assert.equal(c.distrito, null)
  assert.equal(c.constroi, 'A residence from the district catalogue')
  assert.equal(c.status, 'In production')
})

test('licença sem lote: diz a licença, que não há lote ligado e onde a casa vai', () => {
  const c = casaDaLicenca('commercial', 'sem_lote')
  assert.deepEqual(c, {
    caso: 'sem_lote',
    degrau: 'commercial',
    licenca: 'Commercial',
    rotulo: 'BUILDING LICENCE · COMMERCIAL',
    titulo: 'This wallet holds a Commercial licence.',
    aviso: 'No lot is linked to this wallet. The building goes on the lot of the wallet that holds the deed.',
  })
  assert.equal(SUPORTE.href, '/dogcity/support')
})

test('sem licença (citizen, null, lixo): nada, e a tela segue como sempre', () => {
  for (const t of [null, undefined, 'citizen', 'PATRON', '', 7, {}]) {
    assert.equal(casaDaLicenca(t, LOTE), null)
    assert.equal(casaDaLicenca(t, 'sem_lote'), null)
  }
})

test('o gancho da tipologia: tipo sai null sem a frente; a régua é a do jogo', () => {
  assert.equal(casaDaLicenca('personal', LOTE)?.caso === 'com_lote' && (casaDaLicenca('personal', LOTE) as any).tipo, null)
  assert.deepEqual([5.9, 6, 21.9, 22, 26.9, 27, 49.9, 50, 80].map(tipoPelaFrente),
    ['Row', 'Small', 'Small', 'Standard', 'Standard', 'Large', 'Large', 'Estate', 'Estate'])
  for (const v of [null, undefined, NaN, 0, -3, Infinity]) assert.equal(tipoPelaFrente(v as number), null)
})

test('nenhuma frase tem travessão, data ou preço', () => {
  const casos: (CasaDaLicenca | null)[] = []
  for (const d of ['personal', 'commercial', 'patron']) {
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9]) casos.push(casaDaLicenca(d, { lot_id: `S0${s}-Q01-B001-L001`, sector: s }))
    casos.push(casaDaLicenca(d, 'sem_posicao'), casaDaLicenca(d, 'sem_lote'))
  }
  const textos = [
    AVISO_SEM_LOTE, SUPORTE.rotulo, SUPORTE_LEAD,
    CTA_LICENCA.rotulo, TEXTO_LICENCA_ABERTA, notaCorretoraTexto(),
    ...Object.values(NOTA_CORRETORA),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => rotuloDoSetor(s)),
  ]
  for (const c of casos) for (const v of Object.values(c ?? {})) if (typeof v === 'string') textos.push(v)
  for (const t of textos) {
    assert.ok(!/[—–]/.test(t), `travessão em: ${t}`)
    assert.ok(!/\b20\d\d\b|\bQ[1-4]\b|\$\s?\d|\d+\s?(USD|BTC|sats)\b/i.test(t), `data ou preço em: ${t}`)
  }
})

// ── REGRA 1: CARTEIRA DE CUSTÓDIA NUNCA LEVA LICENÇA NEM CASA ───────────────
// O caso real: a carteira de custódia da Kraken (lote S08-Q00-B0002-L004, uma
// `empresa` do Financial District) foi creditada com 87.777 $DOG em 2 transações
// de 14/09 porque clientes sacaram direto para o endereço do fundo.
const KRAKEN = 'bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn'
const at = (dog: number) => Math.round(dog * 100_000)
const tx = (txid: string, block: number, from: string, dog: number): TxRow => ({
  id: block, txid, block_height: block, timestamp: '2026-09-14T00:00:00Z',
  senders: [{ address: from, amount: at(dog) }],
  receivers: [{ address: FUND_DOG_ADDRESS, amount: at(dog) }],
})

test('o caso da Kraken: o placar dá Commercial, a tela não mostra licença nem casa', () => {
  const rows = [tx('k1', 100, KRAKEN, 50_000), tx('k2', 101, KRAKEN, 37_777)]
  // o livro do fundo soma 87.777 $DOG e o degrau é Commercial (o placar não muda aqui)
  const ledger = buildLedger(rows, FUND_DOG_ADDRESS, { licenseFor: licenceFor, posicoes: {} })
  assert.equal(ledger.leaderboard.find((e) => e.address === KRAKEN)?.total, 87_777)
  const licence = licenceOfWallet(rows, KRAKEN, [])
  assert.equal(licence.tier, 'commercial')

  // o que a rota manda: o lote do registro (setor 8) corta a licença
  const sinais = { setor: 8, tierDoLote: 'co' }
  assert.equal(ehCarteiraDeCustodia(sinais), true)
  const enviada = licencaVisivel(licence, sinais)
  assert.equal(enviada, null)
  // e a tela, sem licença, não desenha bloco algum (nem com lote, nem sem)
  const tierDe = (l: { tier: string | null } | null) => l?.tier
  assert.equal(casaDaLicenca(tierDe(enviada), { lot_id: 'S08-Q00-B0002-L004', sector: 8 }), null)
  assert.equal(casaDaLicenca(tierDe(enviada), 'sem_lote'), null)
  // segunda trava: mesmo que a licença chegasse, o lote do setor 8 não desenha casa
  assert.equal(casaDaLicenca(licence.tier, { lot_id: 'S08-Q00-B0002-L004', sector: 8 }), null)
})

test('identidade conhecida (corretora, ponte, mercado) corta a licença, com ou sem lote', () => {
  const licence = { tier: 'commercial' }
  assert.equal(licencaVisivel(licence, { identidade: { name: 'Kraken', kind: 'exchange' } }), null)
  assert.equal(licencaVisivel(licence, { identidade: { name: 'Kraken' }, setor: 5 }), null)
  assert.equal(licencaVisivel(licence, { identidade: { name: 'Kraken' }, setor: null }), null)
})

test('carteira comum não perde a licença: nem o objeto, nem o null do banco fora', () => {
  const licence = { tier: 'personal' }
  for (const sinais of [{}, { identidade: null }, { setor: 5 }, { setor: 1, tierDoLote: 't6' }, { setor: 9, tierDoLote: 'sol' }, { setor: null, tierDoLote: null }]) {
    assert.equal(ehCarteiraDeCustodia(sinais), false)
    assert.equal(licencaVisivel(licence, sinais), licence)
  }
  assert.equal(licencaVisivel(null, { setor: 5 }), null)
  assert.equal(licencaVisivel(undefined, {}), null)
  const casa = casaDaLicenca('personal', { lot_id: 'S05-Q17-B1775-L027', sector: 5 })
  assert.equal(casa?.caso, 'com_lote')
})

test('o tier "co" (Company) sozinho já é custódia, mesmo se o setor não vier', () => {
  assert.equal(ehCarteiraDeCustodia({ tierDoLote: 'co' }), true)
  assert.equal(ehCarteiraDeCustodia({ setor: SETOR_DAS_EMPRESAS }), true)
})

test('os dados do registro: setor 8 = só empresa (32 lotes, ordem -1, tier "co"), e a Kraken está lá', () => {
  const csv = lerRepo('data/dogcity_lotes.csv').split('\n')
  const cab = csv[0].replace('\r', '').split(',')
  const [iLot, iAddr, iOrdem, iSetor] = ['lot_id', 'address', 'ordem', 'setor'].map((c) => cab.indexOf(c))
  assert.ok([iLot, iAddr, iOrdem, iSetor].every((i) => i >= 0), 'colunas do CSV mudaram')
  const info = JSON.parse(lerRepo('data/dogcity_lot_info.json')) as { campos: string[]; lote: Record<string, [string]> }
  assert.equal(info.campos[0], 'tier')

  let doSetor8 = 0
  let kraken: string[] | null = null
  for (const linha of csv.slice(1)) {
    if (!linha) continue
    const c = linha.split(',')
    const tier = info.lote[c[iLot]]?.[0]
    if (Number(c[iSetor]) === SETOR_DAS_EMPRESAS) {
      doSetor8++
      assert.equal(c[iOrdem], '-1', `lote de empresa com ordem: ${c[iLot]}`)
      assert.equal(tier, 'co', `lote do setor 8 que não é Company: ${c[iLot]}`)
    } else {
      assert.notEqual(tier, 'co', `Company fora do setor 8: ${c[iLot]}`)
    }
    if (c[iAddr] === KRAKEN) kraken = c
  }
  assert.equal(doSetor8, 32)
  assert.ok(kraken, 'a carteira de custódia da Kraken saiu do registro')
  assert.equal(kraken![iLot], 'S08-Q00-B0002-L004')
  assert.equal(ehCarteiraDeCustodia({ setor: Number(kraken![iSetor]), tierDoLote: info.lote[kraken![iLot]][0] }), true)
})

test('as duas rotas aplicam a regra no servidor, e o lookup/profile não mandam a licença da custódia', () => {
  const lookup = lerRepo('app/api/dogcity/lookup/route.ts')
  assert.match(lookup, /licencaVisivel\(licenceBruta, \{ setor: l\?\.setor \?\? null, tierDoLote: info\?\.tier\?\.code \?\? null \}\)/)
  const perfil = lerRepo('app/api/profile/route.ts')
  assert.match(perfil, /resolveIdentity\(enderecoCidade\)/)
  assert.match(perfil, /licencaVisivel\(licenceBruta, sinais\)/)
  assert.match(perfil, /custody: ehCarteiraDeCustodia\(sinais\)/)
})

// ── REGRA 2: A LINHA SECTOR DA ESCRITURA TEM O NOME NOS NOVE SETORES ────────
test('a linha SECTOR: número e nome do distrito, nos nove setores', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => rotuloDoSetor(s)),
    [
      '1 · Harbor Canals', '2 · Liberty Row', '3 · Brownstone Heights', '4 · Arroyo', '5 · Timberline',
      '6 · Atomic Heights', '7 · The Spit', '8 · Financial District', '9 · Bay Shore',
    ],
  )
})

test('resposta antiga em cache (district null) ou com nome da rota: a linha é a mesma, nunca o número solto', () => {
  for (let s = 1; s <= 9; s++) {
    assert.equal(rotuloDoSetor(s, null), rotuloDoSetor(s))
    assert.equal(rotuloDoSetor(s, DISTRITO_DO_SETOR[s]), rotuloDoSetor(s))
  }
  // setor fora de 1 a 9 e sem nome: só o número, sem inventar
  assert.equal(rotuloDoSetor(12), '12')
  assert.equal(rotuloDoSetor(12, null), '12')
})

test('as três rotas devolvem o nome do distrito nos nove setores (DISTRITO_DO_SETOR), não o mapa dos setores 7 a 9', () => {
  for (const rota of ['app/api/dogcity/lookup/route.ts', 'app/api/profile/route.ts', 'app/api/dogcity/lot/route.ts']) {
    const src = lerRepo(rota)
    assert.match(src, /DISTRITO_DO_SETOR\[/, rota)
    assert.doesNotMatch(src, /BAIRRO_DO_SETOR/, rota)
  }
})

// ── REGRA 3: O CTA VELHO DO NÚMERO DE FOUNDER SAIU; O DA LICENÇA É UM SÓ ────
test('o CTA da licença e a nota de quem pagou de corretora, com as frases do fundador', () => {
  assert.equal(CTA_LICENCA.rotulo, 'GET THE LICENCE TO BUILD ON IT')
  assert.equal(CTA_LICENCA.href, '/dogcity#tiers')
  assert.equal(
    notaCorretoraTexto(),
    "Paid from an exchange? A withdrawal from an exchange arrives from the exchange's wallet, not yours. Contact DogCity support with the transaction and your own wallet address.",
  )
  assert.equal(SUPORTE.href, '/dogcity/support')
  assert.equal(SUPORTE.rotulo, 'DogCity support')
})

test('lookup e /profile: sem "LOCK YOUR FOUNDER NUMBER" nem "before the goal", com o CTA e a nota compartilhados', () => {
  const lookup = lerRepo('app/dogcity/sections/wallet-lookup.tsx')
  assert.doesNotMatch(lookup, /LOCK YOUR FOUNDER NUMBER/)
  assert.doesNotMatch(lookup, /The Founder number goes by order of/)
  // o mesmo botão nos dois cartões sem licença (lote sem licença e chegou depois)
  assert.equal((lookup.match(/<BotaoLicenca \/>/g) ?? []).length, 2)
  assert.doesNotMatch(lookup, /href="\/dogcity\/founders"/)
  const perfil = lerRepo('app/profile/page.tsx')
  assert.doesNotMatch(perfil, /Any amount before the goal makes/)
  assert.doesNotMatch(perfil, /Fund the city/)
  assert.match(perfil, /!profile\?\.custody && standing\.license/)
})
