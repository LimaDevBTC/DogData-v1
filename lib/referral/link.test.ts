// Rodar: npx tsx --test lib/referral/link.test.ts
//
// As regras do vinculo carteira -> indicador (lib/referral/link.ts), com um ReferralStore falso e atomico:
// primeira verificacao, primeiro indicador, autoindicacao, ref invalido, e a garantia de que nada disso
// derruba o verify (a funcao nunca lanca, mesmo com o banco falhando).
import test from 'node:test'
import assert from 'node:assert/strict'
import { linkOnVerify, type NewLink, type ReferralStore } from './link'

const ALICE = 'bc1p' + 'a'.repeat(58)
const BOB = 'bc1p' + 'b'.repeat(58)
const CARL = 'bc1p' + 'c'.repeat(58)
const DAN = 'bc1p' + 'd'.repeat(58)

function fakeStore(init: {
  profiles?: Record<string, string> // handle -> address
  verified?: string[] // ja em wallet_first_verify
  known?: string[] // perfil ou ponte de analytics sem registro em wallet_first_verify
  tip?: number | null
} = {}) {
  const profiles = new Map(Object.entries(init.profiles ?? {}))
  const verified = new Set(init.verified ?? [])
  const known = new Set(init.known ?? [])
  const links = new Map<string, NewLink>()
  const calls: string[] = []
  const store: ReferralStore & { links: typeof links; verified: typeof verified; calls: string[]; fail: Partial<Record<keyof ReferralStore, boolean>> } = {
    links, verified, calls, fail: {},
    async wasKnownBefore(a) { calls.push('known'); if (store.fail.wasKnownBefore) throw new Error('db'); return known.has(a) },
    async markFirstVerify(a) {
      calls.push('mark'); if (store.fail.markFirstVerify) throw new Error('db')
      if (verified.has(a)) return false // atomico: so a primeira chamada ve true
      verified.add(a); return true
    },
    async referrerOf(h) { calls.push('referrer'); if (store.fail.referrerOf) throw new Error('db'); return profiles.get(h) ?? null },
    async chainTip() { calls.push('tip'); if (store.fail.chainTip) throw new Error('net'); return init.tip === undefined ? 973_000 : init.tip },
    async insertLink(l) {
      calls.push('insert'); if (store.fail.insertLink) throw new Error('db')
      if (links.has(l.referredAddress)) return false
      links.set(l.referredAddress, l); return true
    },
  }
  return store
}

test('primeira verificacao com ref valido: vincula, guarda o endereco do indicador e o bloco', async () => {
  const s = fakeStore({ profiles: { alice: ALICE } })
  const r = await linkOnVerify({ address: BOB, ref: '@alice' }, s)
  assert.deepEqual(r, { linked: true })
  assert.deepEqual(s.links.get(BOB), { referredAddress: BOB, referrerAddress: ALICE, referrerHandle: 'alice', linkedBlock: 973_000 })
  assert.ok(s.verified.has(BOB))
})

test('aceita @handle, handle puro e caixa alta; guarda sempre o handle em minusculas', async () => {
  for (const ref of ['@alice', 'alice', '  @ALICE  ']) {
    const s = fakeStore({ profiles: { alice: ALICE } })
    assert.equal((await linkOnVerify({ address: BOB, ref }, s)).linked, true, ref)
    assert.equal(s.links.get(BOB)!.referrerHandle, 'alice')
  }
})

test('quem ja tinha verificado antes NAO pode ser capturado por um link', async () => {
  const s = fakeStore({ profiles: { alice: ALICE }, verified: [BOB] })
  const r = await linkOnVerify({ address: BOB, ref: '@alice' }, s)
  assert.deepEqual(r, { linked: false, reason: 'known_wallet' })
  assert.equal(s.links.size, 0)
})

test('verificou sem ref, depois chegou por um link: nao vincula (a primeira verificacao ja passou)', async () => {
  const s = fakeStore({ profiles: { alice: ALICE } })
  assert.equal((await linkOnVerify({ address: BOB, ref: undefined }, s)).reason, 'no_ref')
  assert.ok(s.verified.has(BOB), 'a carteira fica registrada mesmo sem ref')
  const r = await linkOnVerify({ address: BOB, ref: '@alice' }, s)
  assert.deepEqual(r, { linked: false, reason: 'known_wallet' })
  assert.equal(s.links.size, 0)
})

test('carteira antiga com perfil ou ponte de analytics (sem registro novo) tambem nao e capturada, mas fica registrada', async () => {
  const s = fakeStore({ profiles: { alice: ALICE }, known: [BOB] })
  const r = await linkOnVerify({ address: BOB, ref: '@alice' }, s)
  assert.deepEqual(r, { linked: false, reason: 'known_wallet' })
  assert.equal(s.links.size, 0)
  assert.ok(s.verified.has(BOB))
})

test('o navegador ja trazia sessao verificada para o mesmo endereco: nao vincula', async () => {
  const s = fakeStore({ profiles: { alice: ALICE } })
  const r = await linkOnVerify({ address: BOB, ref: '@alice', priorSessionAddress: BOB }, s)
  assert.deepEqual(r, { linked: false, reason: 'known_wallet' })
  // sessao anterior de OUTRA carteira nao impede a carteira nova
  const s2 = fakeStore({ profiles: { alice: ALICE } })
  assert.equal((await linkOnVerify({ address: BOB, ref: '@alice', priorSessionAddress: CARL }, s2)).linked, true)
})

test('um indicador por carteira, o primeiro, para sempre', async () => {
  const s = fakeStore({ profiles: { alice: ALICE, carl: CARL } })
  assert.equal((await linkOnVerify({ address: BOB, ref: '@alice' }, s)).linked, true)
  // segunda verificacao da mesma carteira com outro indicador: nao troca
  const again = await linkOnVerify({ address: BOB, ref: '@carl' }, s)
  assert.equal(again.linked, false)
  assert.equal(s.links.get(BOB)!.referrerAddress, ALICE)
  // mesmo que a trava de primeira vez falhasse, a chave unica por carteira recusa o segundo
  const s2 = fakeStore({ profiles: { alice: ALICE, carl: CARL } })
  s2.links.set(DAN, { referredAddress: DAN, referrerAddress: ALICE, referrerHandle: 'alice', linkedBlock: 1 })
  const r2 = await linkOnVerify({ address: DAN, ref: '@carl' }, s2)
  assert.deepEqual(r2, { linked: false, reason: 'already_linked' })
  assert.equal(s2.links.get(DAN)!.referrerAddress, ALICE)
})

test('duas verificacoes simultaneas da mesma carteira nova vinculam UMA vez', async () => {
  const s = fakeStore({ profiles: { alice: ALICE, carl: CARL } })
  const [a, b] = await Promise.all([
    linkOnVerify({ address: BOB, ref: '@alice' }, s),
    linkOnVerify({ address: BOB, ref: '@carl' }, s),
  ])
  assert.equal([a, b].filter((x) => x.linked).length, 1)
  assert.equal(s.links.size, 1)
})

test('autoindicacao nao vale: mesma carteira (o handle e dela)', async () => {
  // a carteira tem o proprio handle mas nao deixou sinal anterior (caso extremo): ainda assim nao indica a si mesma
  const s = fakeStore({ profiles: { bob: BOB } })
  const r = await linkOnVerify({ address: BOB, ref: '@bob' }, s)
  assert.deepEqual(r, { linked: false, reason: 'self' })
  assert.equal(s.links.size, 0)
})

test('autoindicacao com perfil ja existente tambem nao vale', async () => {
  const s = fakeStore({ profiles: { bob: BOB }, known: [BOB] })
  const r = await linkOnVerify({ address: BOB, ref: 'bob' }, s)
  assert.equal(r.linked, false)
  assert.equal(s.links.size, 0)
})

test('ref invalido e ignorado em silencio, sem consultar o banco de indicadores nem lancar', async () => {
  const lixo: unknown[] = ['', '   ', 'a', 'ab', 'x'.repeat(16), 'bad handle', 'al-ice', '@@alice', 'admin', '@dogdata', 'a'.repeat(200), 42, {}, [], true, null, undefined]
  for (const ref of lixo) {
    const s = fakeStore({ profiles: { alice: ALICE } })
    const r = await linkOnVerify({ address: BOB, ref }, s)
    assert.equal(r.linked, false, String(ref))
    assert.equal(s.links.size, 0)
    assert.ok(!s.calls.includes('referrer'), `nao consulta indicador para ${JSON.stringify(ref)}`)
    assert.ok(!s.calls.includes('insert'))
  }
})

test('handle valido mas de ninguem (conta que nao existe) e ignorado', async () => {
  const s = fakeStore({ profiles: { alice: ALICE } })
  const r = await linkOnVerify({ address: BOB, ref: '@ghost' }, s)
  assert.deepEqual(r, { linked: false, reason: 'unknown_ref' })
  assert.equal(s.links.size, 0)
})

test('endereco que nao e da rede principal nao vincula e nem e registrado', async () => {
  const s = fakeStore({ profiles: { alice: ALICE } })
  const r = await linkOnVerify({ address: 'tb1p' + 'a'.repeat(58), ref: '@alice' }, s)
  assert.deepEqual(r, { linked: false, reason: 'bad_address' })
  assert.equal(s.verified.size, 0)
})

test('sem a ponta da cadeia o vinculo sai com linked_block nulo (a contagem cai para o tempo)', async () => {
  for (const tip of [null, undefined]) {
    const s = fakeStore({ profiles: { alice: ALICE }, tip: tip === undefined ? null : tip })
    assert.equal((await linkOnVerify({ address: BOB, ref: '@alice' }, s)).linked, true)
    assert.equal(s.links.get(BOB)!.linkedBlock, null)
  }
  const s = fakeStore({ profiles: { alice: ALICE } })
  s.fail.chainTip = true
  assert.equal((await linkOnVerify({ address: BOB, ref: '@alice' }, s)).linked, true)
  assert.equal(s.links.get(BOB)!.linkedBlock, null)
})

test('o banco falhando NUNCA derruba o verify: nenhuma falha vira excecao, e na duvida nao vincula', async () => {
  const pontos: (keyof ReferralStore)[] = ['markFirstVerify', 'wasKnownBefore', 'referrerOf', 'insertLink']
  for (const ponto of pontos) {
    const s = fakeStore({ profiles: { alice: ALICE } })
    s.fail[ponto] = true
    const r = await linkOnVerify({ address: BOB, ref: '@alice' }, s) // nao pode lancar
    assert.equal(r.linked, false, ponto)
    assert.equal(s.links.size, 0, ponto)
  }
})

test('sem ref: so registra a carteira (1 chamada ao banco), nao consulta mais nada', async () => {
  const s = fakeStore()
  const r = await linkOnVerify({ address: BOB, ref: undefined }, s)
  assert.deepEqual(r, { linked: false, reason: 'no_ref' })
  assert.deepEqual(s.calls, ['mark'])
})
