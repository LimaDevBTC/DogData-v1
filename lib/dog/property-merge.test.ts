// Rodar: npx tsx --test lib/dog/property-merge.test.ts
//
// A PROPRIEDADE UNIDA opt-in (fundador, 19/11/2026): a seleção conferida (vizinhança real, S08, posse pelo mint, um
// lote licenciado, já unido), o teto do lazer por nível, o freio de 21 dias (unir OU desfazer), o desfazer forçado
// por venda sem freio, e o serviço com um banco EM MEMÓRIA que imita as funções da migração 044. Os três lotes de
// S09-Q00-B0035 são os cantos reais de dogcity-mundo plano/saida/lotes.json; o resto é simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import type { LicenceTier } from './licence-btc'
import type { MintHolder } from './licence-lot'
import { vizinhancaDaGeometria, type LoteGeo } from './lot-property'
import {
  FREIO_DIAS, FREIO_MS, REGUA_DO_LAZER, areaDaPropriedade, casaPelaArea, lazerPelaArea, publica, freioDoLote, opcoesDeConsolidacao, quebradas, tierDaPropriedade, validarConsolidacao,
  validarDesfazer, type PropertyRecord,
} from './property-merge'
import { consolidar, desfazer, propriedadesPublicas, vistaDaCarteira, type PropertyDeps, type PropertyStore } from './property-merge-service'
import { SemTabela } from './licence-lot-service'

const L1 = 'S09-Q00-B0035-L001'
const L2 = 'S09-Q00-B0035-L002'
const L3 = 'S09-Q00-B0035-L003'
const SOLTO = 'S01-Q90-B0079-L001'
const GEO: LoteGeo[] = [
  { lotId: L1, cantos: [[5707.77, 49.6], [5655.28, 49.4], [5655.04, 114.65], [5707.52, 114.85]] },
  { lotId: L2, cantos: [[5655.28, 49.4], [5600.25, 49.2], [5600.0, 114.95], [5655.04, 114.65]] },
  { lotId: L3, cantos: [[5600.25, 49.2], [5547.77, 49.0], [5547.52, 115.25], [5600.0, 114.95]] },
  { lotId: SOLTO, cantos: [[1499.92, -1081.3], [1581.77, -1137.2], [1533.12, -1195.1], [1454.94, -1147.16]] },
]
const VIZ = vizinhancaDaGeometria(GEO)
const A = 'bc1p' + 'a'.repeat(58)
const B = 'bc1p' + 'b'.repeat(58)
const DIA = 24 * 60 * 60 * 1000
const T0 = Date.parse('2026-11-19T12:00:00Z')
const tiers = (m: Record<string, LicenceTier | null>) => new Map(Object.entries(m))
const reg = (over: Partial<PropertyRecord>): PropertyRecord => ({
  id: 'p1', wallet: A, lots: [L1, L2], anchor: L1, state: 'active', createdAt: new Date(T0 - 30 * DIA).toISOString(), endedAt: null, ...over,
})

// ── as regras puras ─────────────────────────────────────────────────────────

test('o lazer vem da ÁREA, para toda licença: a régua em ordem, a piscina primeiro, sem teto por nível (20/11)', () => {
  assert.deepEqual(REGUA_DO_LAZER.map((r) => r.peca), ['piscina', 'basquete', 'tenis', 'hospedes', 'futebol', 'academia'])
  assert.equal(REGUA_DO_LAZER[0].minM2, 0)
  assert.deepEqual(lazerPelaArea(1000), ['piscina'])
  assert.deepEqual(lazerPelaArea(2500), ['piscina', 'basquete'])
  assert.deepEqual(lazerPelaArea(7500), ['piscina', 'basquete', 'tenis', 'hospedes', 'futebol'])
  assert.deepEqual(lazerPelaArea(15000), ['piscina', 'basquete', 'tenis', 'hospedes', 'futebol', 'academia'])
  assert.deepEqual(lazerPelaArea(null), ['piscina'])
  assert.deepEqual(lazerPelaArea(NaN), ['piscina'])
  assert.deepEqual(casaPelaArea(2000), { largura: 26, fundo: 18 })
  assert.deepEqual(casaPelaArea(6000), { largura: 36, fundo: 24 })
  assert.equal(areaDaPropriedade(['a'], null), null)
  assert.equal(areaDaPropriedade([L1, L2], (l) => (l === L1 ? 500 : 700)), 1200)
  assert.equal(areaDaPropriedade([L1, L2], (l) => (l === L1 ? 500 : null)), null)
})

test('a licença da propriedade é a mais alta entre os lotes; lote sem licença entra só como terreno', () => {
  assert.equal(tierDaPropriedade([L1, L2, L3], tiers({ [L1]: null, [L2]: 'personal', [L3]: 'commercial' })), 'commercial')
  assert.equal(tierDaPropriedade([L1, L2], tiers({ [L1]: null, [L2]: null })), null)
})

test('unir: a seleção conexa dos lotes reais passa; a âncora é o menor lot_id', () => {
  const p = validarConsolidacao({ lots: [L3.toLowerCase(), L2], held: [L1, L2, L3], tiers: tiers({ [L2]: 'personal' }), vizinho: VIZ, registros: [], agoraMs: T0 })
  assert.deepEqual(p, { ok: true, lots: [L2, L3], anchor: L2, tier: 'personal' })
})

test('unir: o dono pode deixar um lote de fora; L001 + L003 sem o L002 não é conexo', () => {
  const base = { held: [L1, L2, L3], tiers: tiers({ [L1]: 'personal' }), vizinho: VIZ, registros: [], agoraMs: T0 }
  assert.equal(validarConsolidacao({ ...base, lots: [L1, L2] }).ok, true)
  assert.deepEqual(validarConsolidacao({ ...base, lots: [L1, L3] }), { ok: false, why: 'not_connected' })
})

test('unir: recusas (um lote só, S08, lote que não é da carteira, nenhuma licença, já unido, sem vizinhança)', () => {
  const base = { held: [L1, L2, L3], tiers: tiers({ [L1]: 'personal' }), vizinho: VIZ, registros: [] as PropertyRecord[], agoraMs: T0 }
  assert.equal(validarConsolidacao({ ...base, lots: [L1] }).ok === false && 'too_few', 'too_few')
  assert.deepEqual(validarConsolidacao({ ...base, lots: [L1, 'S08-Q00-B0001-L001'] }), { ok: false, why: 'sector_8' })
  assert.deepEqual(validarConsolidacao({ ...base, held: [L1], lots: [L1, L2] }), { ok: false, why: 'not_holder' })
  assert.deepEqual(validarConsolidacao({ ...base, tiers: tiers({}), lots: [L1, L2] }), { ok: false, why: 'no_licence' })
  assert.deepEqual(validarConsolidacao({ ...base, registros: [reg({ lots: [L2, L3], anchor: L2 })], lots: [L1, L2] }), { ok: false, why: 'already_merged' })
  assert.deepEqual(validarConsolidacao({ ...base, vizinho: null, lots: [L1, L2] }), { ok: false, why: 'not_connected' })
  assert.deepEqual(validarConsolidacao({ ...base, lots: 'x' }), { ok: false, why: 'invalid_lot' })
})

test('o freio de 21 dias: unir de novo um lote que acabou de ser desfeito por vontade espera; desfeito por venda, não', () => {
  const base = { lots: [L1, L2], held: [L1, L2, L3], tiers: tiers({ [L1]: 'personal' }), vizinho: VIZ, agoraMs: T0 }
  const voluntario = reg({ state: 'dissolved', createdAt: new Date(T0 - 40 * DIA).toISOString(), endedAt: new Date(T0 - 5 * DIA).toISOString() })
  const r = validarConsolidacao({ ...base, registros: [voluntario] })
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.why, 'cooldown')
  assert.equal(!r.ok && r.until, new Date(T0 - 5 * DIA + FREIO_MS).toISOString())
  const forcado = { ...voluntario, state: 'dissolved_forced' as const }
  assert.equal(validarConsolidacao({ ...base, registros: [forcado] }).ok, true)
  // passados os 21 dias, pode
  assert.equal(validarConsolidacao({ ...base, agoraMs: T0 + 17 * DIA, registros: [voluntario] }).ok, true)
  assert.equal(freioDoLote(L3, [voluntario], T0), null)
})

test('desfazer: só o dono, só ativa, e não antes de 21 dias da consolidação', () => {
  const nova = reg({ createdAt: new Date(T0 - 3 * DIA).toISOString() })
  const d = validarDesfazer({ id: 'p1', wallet: A, registros: [nova], agoraMs: T0 })
  assert.equal(!d.ok && d.why, 'cooldown')
  assert.equal(validarDesfazer({ id: 'p1', wallet: B, registros: [reg({})], agoraMs: T0 }).ok === false, true)
  assert.equal(validarDesfazer({ id: 'p1', wallet: A, registros: [reg({ state: 'dissolved', endedAt: 'x' })], agoraMs: T0 }).ok, false)
  assert.equal(validarDesfazer({ id: 'p1', wallet: A, registros: [reg({})], agoraMs: T0 }).ok, true)
  assert.equal(FREIO_DIAS, 21)
})

test('desfazer forçado: a propriedade com um lote fora da carteira é quebrada, sem olhar o freio', () => {
  const nova = reg({ createdAt: new Date(T0 - 1 * DIA).toISOString() })
  assert.deepEqual(quebradas([nova], A, [L1]).map((r) => r.id), ['p1'])
  assert.deepEqual(quebradas([nova], A, [L1, L2, L3]), [])
})

test('o convite "Expand your house": só com um lote licenciado e um vizinho na mesma carteira', () => {
  assert.deepEqual(opcoesDeConsolidacao([L1, L2, L3, SOLTO], tiers({ [L2]: 'personal' }), VIZ, [], T0).map((o) => o.lots), [[L1, L2, L3]])
  assert.deepEqual(opcoesDeConsolidacao([L1, L2, L3], tiers({}), VIZ, [], T0), [])
  assert.deepEqual(opcoesDeConsolidacao([L1, SOLTO], tiers({ [L1]: 'personal' }), VIZ, [], T0), [])
  assert.deepEqual(opcoesDeConsolidacao([L1, L2], tiers({ [L1]: 'personal' }), null, [], T0), [])
})

// ── o serviço com o banco em memória (as regras da 044) ─────────────────────

function memDb(init: PropertyRecord[] = [], semTabela = false) {
  const rows = init.map((r) => ({ ...r }))
  let agora = T0
  let seq = 0
  const sem = () => { if (semTabela) throw new SemTabela() }
  const naJanela = (iso: string | null) => !!iso && Date.parse(iso) > agora - FREIO_MS
  const store: PropertyStore = {
    async ofWallet(w) { sem(); return rows.filter((r) => r.wallet === w).map((r) => ({ ...r })) },
    async touching(lots) { sem(); return rows.filter((r) => r.lots.some((l) => lots.includes(l))).map((r) => ({ ...r })) },
    async active() { sem(); return rows.filter((r) => r.state === 'active').map((r) => ({ ...r })) },
    async merge(wallet, lots) {
      sem()
      const ls = [...new Set(lots)].sort()
      if (rows.some((r) => r.state === 'active' && r.lots.some((l) => ls.includes(l)))) return null
      if (rows.some((r) => r.lots.some((l) => ls.includes(l)) && (naJanela(r.createdAt) || (r.state === 'dissolved' && naJanela(r.endedAt))))) return null
      const id = `m${++seq}`
      rows.push({ id, wallet, lots: ls, anchor: ls[0], state: 'active', createdAt: new Date(agora).toISOString(), endedAt: null })
      return id
    },
    async dissolve(id, wallet, reason) {
      sem()
      const r = rows.find((x) => x.id === id)
      if (!r || r.state !== 'active' || r.wallet !== wallet) return false
      if (reason === 'voluntary' && naJanela(r.createdAt)) return false
      r.state = reason === 'forced' ? 'dissolved_forced' : 'dissolved'
      r.endedAt = new Date(agora).toISOString()
      return true
    },
  }
  return { rows, store, avanca: (ms: number) => { agora += ms }, agora: () => agora }
}

function deps(db: ReturnType<typeof memDb>, held: Record<string, string[] | null>, totals: Record<string, number> = { [L1]: 10_000 }): PropertyDeps {
  return {
    store: db.store,
    holder: async (a): Promise<MintHolder | null> => (held[a] ? { lots: held[a]!, snapshotLot: null } : null),
    lotTotals: async (lots) => new Map(lots.filter((l) => l in totals).map((l) => [l, totals[l]])),
    vizinho: async () => VIZ,
    areas: async () => null,
    agoraMs: db.agora,
  }
}

const silencio = async <T>(fn: () => Promise<T>) => {
  const e = console.error
  console.error = () => {}
  try { return await fn() } finally { console.error = e }
}

test('serviço: une, a vista mostra a propriedade, desfazer antes de 21 dias espera, depois desfaz e o freio vale para unir de novo', async () => {
  const db = memDb()
  const d = deps(db, { [A]: [L1, L2, L3] }, { [L1]: 10_000, [L3]: 10_000 })
  const v0 = await vistaDaCarteira(d, A)
  assert.ok(!('ok' in v0))
  assert.equal(!('ok' in v0) && v0.canExpand, true)
  const m = await consolidar(d, A, [L1, L2])
  assert.deepEqual(m, { ok: true, id: 'm1', anchor: L1, lots: [L1, L2], tier: 'personal' })
  assert.deepEqual(await consolidar(d, A, [L2, L3]), { ok: false, why: 'already_merged' })
  const v1 = await vistaDaCarteira(d, A)
  assert.ok(!('ok' in v1) && v1.properties.length === 1 && v1.properties[0].amenities.join() === 'piscina' && v1.properties[0].areaM2 === null)
  const cedo = await desfazer(d, A, 'm1')
  assert.equal(!cedo.ok && cedo.why, 'cooldown')
  db.avanca(22 * DIA)
  assert.deepEqual(await desfazer(d, A, 'm1'), { ok: true, anchor: L1, lots: [L1, L2] })
  const deNovo = await consolidar(d, A, [L1, L2, L3])
  assert.equal(!deNovo.ok && deNovo.why, 'cooldown')
})

test('serviço: vender um lote desfaz a propriedade na próxima leitura (forçado, sem freio) e o robô não a vê mais', async () => {
  const db = memDb()
  await consolidar(deps(db, { [A]: [L1, L2, L3] }), A, [L1, L2, L3])
  db.avanca(1 * DIA)  // dentro do freio: o desfazer forçado não liga para ele
  const vendeu = deps(db, { [A]: [L1, L3] })
  assert.deepEqual(await propriedadesPublicas(vendeu), [])
  assert.equal(db.rows[0].state, 'dissolved_forced')
  // e o forçado não trava unir de novo o que sobrou? trava: a consolidação de ontem ainda conta no freio dos lotes
  const r = await consolidar(vendeu, A, [L1, L2])
  assert.equal(r.ok, false)
})

test('serviço: a lista pública (o robô) traz âncora, lotes, licença, a área e o lazer que a área libera, sem endereço', async () => {
  const db = memDb()
  await consolidar(deps(db, { [A]: [L1, L2] }, { [L2]: 50_000 }), A, [L1, L2])
  const pub = await propriedadesPublicas(deps(db, { [A]: [L1, L2] }, { [L2]: 50_000 }))
  assert.deepEqual(pub, [{ anchor: L1, lots: [L1, L2], tier: 'commercial', state: 'active', areaM2: null, amenities: ['piscina'] }])
  assert.ok(!JSON.stringify(pub).includes('bc1'))
})

test('serviço: mint mudo nunca une nem desfaz; sem a tabela é "not open"', async () => {
  const db = memDb()
  assert.deepEqual(await consolidar(deps(db, {}), A, [L1, L2]), { ok: false, why: 'unknown' })
  await consolidar(deps(db, { [A]: [L1, L2] }), A, [L1, L2])
  assert.equal((await propriedadesPublicas(deps(db, {})) as unknown[]).length, 1)   // mint mudo: continua ativa
  const fechado = memDb([], true)
  assert.deepEqual(await silencio(() => consolidar(deps(fechado, { [A]: [L1, L2] }), A, [L1, L2])), { ok: false, why: 'not_open' })
})

test('a prévia pela área: o arquivo de áreas, a área da propriedade e o lazer que ela libera (a licença não muda o lazer)', async () => {
  const { arquivoDeAreas, lerAreas, areaDoLote } = await import('./lot-property')
  const quadrado = (x: number, z: number, w: number, d: number) => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]] as [number, number][]
  assert.equal(areaDoLote(quadrado(0, 0, 40, 50)), 2000)
  const arq = arquivoDeAreas([{ lotId: L1, cantos: quadrado(0, 0, 40, 100) }, { lotId: L2, cantos: quadrado(40, 0, 40, 100) }], 'teste')
  assert.equal(arq.lotes, 2)
  const areaDe = lerAreas(JSON.parse(JSON.stringify(arq)))!
  assert.equal(areaDe(L1), 4000)
  assert.equal(areaDe('S01-Q01-B0001-L999'), null)
  assert.equal(lerAreas({ versao: 2 }), null)
  for (const tier of ['personal', 'commercial', 'patron'] as const) {
    const p = publica(reg({}), tiers({ [L1]: tier }), areaDe)
    assert.equal(p.areaM2, 8000)
    assert.deepEqual(p.amenities, ['piscina', 'basquete', 'tenis', 'hospedes', 'futebol'])
  }
})
