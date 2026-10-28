// Rodar: npx tsx --test app/dogcity/casa-da-licenca.test.ts
//
// As frases da casa da licença (decisão do fundador, 28/10/2026) para cada caso:
// licença com lote, com lote sem posição agora, sem lote, e sem licença. Os
// veículos têm de ser a frase EXATA dos cartões da landing (TIERS), e nenhuma
// frase pode ter travessão, data ou preço.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  casaDaLicenca, oQueConstroi, tipoPelaFrente, veiculosDe, nomeDaLicenca,
  AVISO_SEM_LOTE, SUPORTE, SUPORTE_LEAD, type CasaDaLicenca,
} from './casa-da-licenca'
import { DISTRITO_DO_SETOR, TIERS } from './dogcity-data'

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
  const fd = casaDaLicenca('personal', { lot_id: 'S08-Q01-B001-L001', sector: 8 })
  assert.equal(fd?.caso === 'com_lote' && fd.distrito, 'Financial District')
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
  const textos = [AVISO_SEM_LOTE, SUPORTE.rotulo, SUPORTE_LEAD]
  for (const c of casos) for (const v of Object.values(c ?? {})) if (typeof v === 'string') textos.push(v)
  for (const t of textos) {
    assert.ok(!/[—–]/.test(t), `travessão em: ${t}`)
    assert.ok(!/\b20\d\d\b|\bQ[1-4]\b|\$\s?\d|\d+\s?(USD|BTC|sats)\b/i.test(t), `data ou preço em: ${t}`)
  }
})
