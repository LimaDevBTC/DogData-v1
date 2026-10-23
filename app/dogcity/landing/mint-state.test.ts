// Rodar: npx tsx --test app/dogcity/landing/mint-state.test.ts
//
// Vetores dos seis estados do contador (brief landing v3 §4.2) com dado SIMULADO.
// Nenhum destes números vai para a tela: B e a altura são inventados aqui, de
// propósito, para cobrir as bordas de cada fase.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aboutBlocks, calendarFromB, calendarRows, countdownState, parseB, parseMintB, phaseAt, phaseEnd,
  FUND_GOAL,
} from './mint-state'

const B = 971_900 // simulado

test('sem dado do fundo: connecting, sem número, com a frase do estado A', () => {
  const s = countdownState({ raised: null, B: null, tip: 971_954 })
  assert.equal(s.kind, 'connecting')
  assert.equal(s.label, 'THE DEED COUNTDOWN')
  assert.equal(s.number, null)
  assert.equal(s.rail.mode, 'connecting')
  assert.equal(s.h1, 'At 10,000,000 $DOG the mint clock starts. Every lot in DogCity becomes a deed on Bitcoin.')
})

test('A: enchendo; o que falta arredonda para cima, a porcentagem para baixo', () => {
  const s = countdownState({ raised: 9_887_345.60701, B: null, tip: 971_954 })
  assert.equal(s.kind, 'A')
  assert.equal(s.label, 'THE DEED COUNTDOWN · LIVE')
  assert.equal(s.number, '112,655')
  assert.equal(s.unit, '$DOG TO GO')
  assert.equal(s.founderLine, true)
  assert.equal(s.primary.label, 'Find your lot')
  assert.equal(s.secondary.label, 'Enter the city')
  assert.ok(s.rail.mode === 'fund')
  if (s.rail.mode === 'fund') assert.equal(s.rail.readout, '9,887,345 / 10,000,000 $DOG · 98.87%')
  assert.equal(s.aria, '112,655 $DOG to go, 98.87% of 10,000,000')
  assert.equal(s.nav.desktop, '112,655 $DOG TO GO · FIND YOUR LOT')
  assert.equal(s.nav.mobile, '112,655 TO GO')
  // a um centavo do alvo a tela ainda diz que falta 1 e não 100%
  const q = countdownState({ raised: FUND_GOAL - 0.01, B: null, tip: 1 })
  assert.equal(q.number, '1')
  if (q.rail.mode === 'fund') assert.match(q.rail.readout, /99\.99%$/)
})

test('B0: cheio sem B, ou B com menos de 6 confirmações', () => {
  const sem = countdownState({ raised: 10_000_250, B: null, tip: 971_954 })
  assert.equal(sem.kind, 'B0')
  assert.equal(sem.label, 'THE FUND IS FULL')
  // o valor real arrecadado, não a meta
  assert.equal(sem.number, '10,000,250')
  assert.equal(sem.unit, '$DOG RAISED · GOAL REACHED')
  assert.equal(sem.secondary.label, 'See the calendar')
  assert.equal(sem.founderLine, false)
  const cinco = countdownState({ raised: 10_000_250, B, tip: B + 4 }) // 5 confirmações
  assert.equal(cinco.kind, 'B0')
  // B conhecido e a altura ainda não chegou: só o rótulo do bloco, sem número (22/10/2026)
  const semAltura = countdownState({ raised: null, B, tip: null })
  assert.equal(semAltura.kind, 'B0')
  assert.equal(semAltura.number, null)
  assert.equal(semAltura.label, `THE MINT · FROM BLOCK ${B.toLocaleString('en-US')}`)
  assert.equal(semAltura.rail.mode, 'connecting')
  assert.equal(semAltura.unit, 'READING THE CHAIN')
  // o "pisca" da primeira pintura: com o fundo conhecido, o total NÃO volta a aparecer enquanto falta a altura
  const comFundo = countdownState({ raised: 10_407_345.6, B, tip: null })
  assert.equal(comFundo.number, null)
  assert.equal(comFundo.unit, 'READING THE CHAIN')
})

test('B: fechado até B+288, conta em blocos com "about" e o bloco absoluto', () => {
  const s = countdownState({ raised: 10_000_250, B, tip: B + 76 }) // 212 blocos para o Founder
  assert.equal(s.kind, 'B')
  assert.equal(s.label, `FUND FULL AT BLOCK ${B.toLocaleString('en-US')}`)
  assert.equal(s.number, '212')
  assert.equal(s.unit, 'BLOCKS TO THE FOUNDER MINT')
  assert.equal(s.sub, `about 35 hours · opens at block ${(B + 288).toLocaleString('en-US')}`)
  assert.equal(s.h1, 'Founders mint first, free. Then every wallet with a lot mints its own.')
  assert.equal(s.nav.desktop, 'MINT OPENS IN 212 BLOCKS')
  assert.equal(s.founderLine, false)
  assert.ok(s.rail.mode === 'phases')
  if (s.rail.mode === 'phases') {
    assert.equal(s.rail.current, 0)
    assert.equal(s.rail.readout, `BLOCK ${(B + 76).toLocaleString('en-US')}`)
    assert.ok(s.rail.fraction > 0 && s.rail.fraction < 0.2)
  }
  // borda: a 6ª confirmação já é B
  assert.equal(countdownState({ raised: null, B, tip: B + 5 }).kind, 'B')
  // borda: B+287 ainda é fechado
  assert.equal(countdownState({ raised: null, B, tip: B + 287 }).kind, 'B')
})

test('C: Founder de B+288 até B+720', () => {
  const s = countdownState({ raised: null, B, tip: B + 380 }) // 340 restantes
  assert.equal(s.kind, 'C')
  assert.equal(s.label, 'FOUNDER PHASE · OPEN')
  assert.equal(s.number, '340')
  assert.equal(s.unit, 'BLOCKS LEFT FOR FOUNDERS')
  assert.equal(s.h1, `Founders are minting their own lots free. The Whitelist opens at block ${(B + 720).toLocaleString('en-US')}, from US$1 a lot.`)
  assert.equal(s.primary.label, 'Mint at mint.dogcity.space')
  assert.equal(s.primary.href, 'https://mint.dogcity.space')
  assert.equal(s.nav.desktop, 'FOUNDER PHASE OPEN · MINT')
  assert.equal(countdownState({ raised: null, B, tip: B + 288 }).kind, 'C')
  assert.equal(countdownState({ raised: null, B, tip: B + 719 }).kind, 'C')
})

test('D: Whitelist de B+720 até B+3.744', () => {
  const s = countdownState({ raised: null, B, tip: B + 854 }) // 2.890 restantes
  assert.equal(s.kind, 'D')
  assert.equal(s.label, 'WHITELIST · OPEN')
  assert.equal(s.number, '2,890')
  assert.equal(s.unit, 'BLOCKS LEFT TO CLAIM YOUR LOT')
  assert.equal(s.h1, `Every wallet with a lot at block 966,670 mints its own lot at half its public price, from US$1. Unclaimed lots go on sale at block ${(B + 3744).toLocaleString('en-US')}.`)
  assert.equal(s.primary.label, 'Mint your lot')
  assert.equal(countdownState({ raised: null, B, tip: B + 720 }).kind, 'D')
})

test('E: Partners de B+3.744 até B+4.032', () => {
  const s = countdownState({ raised: null, B, tip: B + 3852 }) // 180 restantes
  assert.equal(s.kind, 'E')
  assert.equal(s.label, 'PARTNERS · OPEN')
  assert.equal(s.number, '180')
  assert.equal(s.unit, 'BLOCKS TO THE PUBLIC MINT')
  assert.equal(s.h1, 'Holders of partner collections mint unclaimed lots at a quarter off the public price, from US$1.50.')
  assert.equal(s.nav.desktop, 'PARTNERS PHASE OPEN · MINT')
})

test('F: Public a partir de B+4.032; preço sem contagem, contagem quando houver', () => {
  const s = countdownState({ raised: null, B, tip: B + 4032 })
  assert.equal(s.kind, 'F')
  assert.equal(s.label, 'PUBLIC MINT · OPEN')
  assert.equal(s.number, 'US$2')
  assert.equal(s.unit, 'AND UP · BY TIER AND SIZE')
  assert.equal(s.h1, 'Anyone mints any unclaimed lot from US$2, priced by its tier and size, up to 10 lots per wallet every 144 blocks.')
  if (s.rail.mode === 'phases') assert.equal(s.rail.fraction, 1)
  const c = countdownState({ raised: null, B, tip: B + 9000, inscribed: 41_206 })
  assert.equal(c.number, '41,206')
  assert.equal(c.unit, '/ 70,714 DEEDS INSCRIBED')
})

test('a fase é a mesma função do minter (bordas)', () => {
  const cal = calendarFromB(B)
  assert.deepEqual(cal, { founderStart: B + 288, whitelistStart: B + 720, partnerStart: B + 3744, publicStart: B + 4032 })
  assert.equal(phaseAt(B + 287, cal), 'CLOSED')
  assert.equal(phaseAt(B + 288, cal), 'FOUNDER')
  assert.equal(phaseAt(B + 3743, cal), 'WHITELIST')
  assert.equal(phaseAt(B + 3744, cal), 'PARTNER')
  assert.equal(phaseAt(B + 4032, cal), 'PUBLIC')
  assert.equal(phaseAt(-1, cal), 'CLOSED')
  assert.equal(phaseEnd('PUBLIC', cal), Infinity)
})

test('B pela variável de ambiente: vazio é null, número com separador vale', () => {
  assert.equal(parseB(undefined), null)
  assert.equal(parseB(''), null)
  assert.equal(parseB('  '), null)
  assert.equal(parseB('abc'), null)
  assert.equal(parseB('971,900'), 971_900)
  assert.equal(parseB('971900'), 971_900)
})

test('resposta do detector: só status conhecido vale; B só entra em "set"', () => {
  assert.deepEqual(
    parseMintB({ status: 'set', raised: 10_000_250, goal: 10_000_000, B: 971_900, confirmations: 6, tip: 971_905 }),
    { status: 'set', B: 971_900, raised: 10_000_250, tip: 971_905 },
  )
  // full_unconfirmed: o B da API é provisório e NÃO sai daqui
  assert.deepEqual(
    parseMintB({ status: 'full_unconfirmed', raised: 10_000_250, goal: 10_000_000, B: 971_900, confirmations: 2, tip: 971_901 }),
    { status: 'full_unconfirmed', B: null, raised: 10_000_250, tip: 971_901 },
  )
  assert.deepEqual(
    parseMintB({ status: 'filling', raised: 9_887_345.6, goal: 10_000_000, B: null, confirmations: null, tip: 971_954 }),
    { status: 'filling', B: null, raised: 9_887_345.6, tip: 971_954 },
  )
  // lixo: 503, status desconhecido, set sem B válido, texto
  assert.equal(parseMintB({ error: 'data backend busy' }), null)
  assert.equal(parseMintB({ status: 'done', B: 971_900 }), null)
  assert.equal(parseMintB({ status: 'set', B: null }), null)
  assert.equal(parseMintB({ status: 'set', B: '971900' }), null)
  assert.equal(parseMintB({ status: 'set', B: 0 }), null)
  assert.equal(parseMintB({ status: 'set', B: 1.5 }), null)
  assert.equal(parseMintB({ B: 971_900 }), null)
  assert.equal(parseMintB(null), null)
  assert.equal(parseMintB('set'), null)
  assert.equal(parseMintB({ status: 'filling', raised: -1, tip: 'x' })?.raised, null)
})

test('full_unconfirmed: a tela diz THE FUND IS FULL, mesmo sem o número do fundo e sem B', () => {
  const s = countdownState({ raised: null, B: null, tip: null, fundFull: true })
  assert.equal(s.kind, 'B0')
  assert.equal(s.label, 'THE FUND IS FULL')
  assert.equal(s.number, null)
  assert.equal(s.unit, 'GOAL REACHED')
  assert.equal(s.sub, null) // B provisório não aparece
  assert.equal(s.calendar, null)
  // com o número, mostra o arrecadado real
  const com = countdownState({ raised: 10_000_250.9, B: null, tip: 971_901, fundFull: true })
  assert.equal(com.kind, 'B0')
  assert.equal(com.number, '10,000,250')
  // sem a flag e sem número continua "connecting": nunca número de exemplo
  assert.equal(countdownState({ raised: null, B: null, tip: null }).kind, 'connecting')
})

test('troca do fundo para o mint: filling -> full_unconfirmed -> set, só pelo dado', () => {
  const B = 971_900
  assert.equal(countdownState({ raised: 9_887_345, B: null, tip: B - 50 }).kind, 'A')
  assert.equal(countdownState({ raised: 10_000_250, B: null, tip: B + 2, fundFull: true }).kind, 'B0')
  const set = countdownState({ raised: 10_000_250, B, tip: B + 5 })
  assert.equal(set.kind, 'B') // fase CLOSED, contagem até o Founder
  assert.equal(set.number, '283')
  assert.equal(set.calendar?.founderStart, B + 288)
})

test('tempo aproximado sempre com "about"', () => {
  assert.equal(aboutBlocks(212), 'about 35 hours')
  assert.equal(aboutBlocks(288), 'about 48 hours')
  assert.equal(aboutBlocks(432), 'about 3 days')
  assert.equal(aboutBlocks(3024), 'about 21 days')
  assert.equal(aboutBlocks(1), 'about 10 minutes')
})

test('calendário: cinco fases, bloco absoluto só com B', () => {
  const sem = calendarRows(null)
  assert.equal(sem.length, 5)
  assert.ok(sem.every((r) => r.startsAt === null))
  const com = calendarRows(B)
  assert.deepEqual(com.map((r) => r.startsAt), [B, B + 288, B + 720, B + 3744, B + 4032])
  assert.deepEqual(com.map((r) => r.price), [null, 'FREE', 'FROM US$1', 'FROM US$1.50', 'FROM US$2'])
})

test('fase aberta pela altura sem o minter aceitando: não anuncia mint', () => {
  for (const minterAccepting of [false, null] as const) {
    const s = countdownState({ raised: null, B, tip: B + 380, minterAccepting })
    assert.equal(s.phase, 'FOUNDER')
    // recusa de verdade: OPENING SHORTLY; ainda sem leitura: só a fase, neutra (22/10/2026)
    assert.equal(s.label, minterAccepting === false ? 'FOUNDER PHASE · OPENING SHORTLY' : 'FOUNDER PHASE')
    if (minterAccepting === null) assert.equal(s.sub, 'Checking the minter…')
    assert.equal(s.nav.href, '#lookup')
    assert.notEqual(s.primary.href, 'https://mint.dogcity.space')
    assert.ok(!s.nav.external)
  }
})

test('fase aberta com o minter aceitando: mostra o mint', () => {
  const s = countdownState({ raised: null, B, tip: B + 380, minterAccepting: true })
  assert.equal(s.label, 'FOUNDER PHASE · OPEN')
  assert.equal(s.nav.desktop, 'FOUNDER PHASE OPEN · MINT')
})

test('fase fechada não depende do minter', () => {
  const s = countdownState({ raised: 10_000_250, B, tip: B + 76, minterAccepting: false })
  assert.equal(s.phase, 'CLOSED')
  assert.equal(s.nav.cta, 'FIND MY LOT')
})

test('contador do mint nas fases abertas: N deeds claimed · M on Bitcoin na frente da linha de baixo (22/10/2026)', () => {
  const f = countdownState({ raised: null, B, tip: B + 300, claimed: 27, inscribed: 3 })
  assert.equal(f.kind, 'C')
  assert.ok(f.sub?.startsWith('27 deeds claimed · 3 on Bitcoin · about '), f.sub ?? '')
  // sem pedido pago ainda: a linha fica como era (nada de "0 claimed")
  const zero = countdownState({ raised: null, B, tip: B + 300, claimed: 0, inscribed: 0 })
  assert.ok(zero.sub?.startsWith('about '), zero.sub ?? '')
  // minter antigo, sem os campos: igual a antes
  const sem = countdownState({ raised: null, B, tip: B + 300 })
  assert.ok(sem.sub?.startsWith('about '), sem.sub ?? '')
  // um só
  assert.ok(countdownState({ raised: null, B, tip: B + 900, claimed: 1, inscribed: 0 }).sub?.startsWith('1 deed claimed · 0 on Bitcoin · '))
})
