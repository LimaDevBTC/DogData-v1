// Run: npx tsx --test lib/dog/licence-grupo.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { comGrupos } from './licence-grupo'
import { buildLedger, type TxRow } from './founders-ledger'
import { licenceFor } from './licence-btc'

const W = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
const ORD = 'bc1pp03eygaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaahyw6'
const PAY = '3HToGYNABg8na96TC3zKZ74P4UsHBJCJQg'
const OUTRO = 'bc1pk8g4rztfkxs2q9c40g6keeknjw6aadx3kzu4suzlll0remfw7xxs5x9ctv'

// 50.000 DOG numa transação só, assinada pela conta de ordinals (39.000) e pela de pagamento (11.000)
const PARTIDA: TxRow = {
  id: 1, txid: 'aa'.repeat(32), block_height: 970000, timestamp: '2026-11-18T04:27:10Z',
  senders: [
    { address: ORD, amount: 3_900_000_000, has_dog: true },
    { address: PAY, amount: 1_100_000_000, has_dog: true },
  ],
  receivers: [{ address: W, amount: 5_000_000_000 }],
}
const SOZINHO: TxRow = {
  id: 2, txid: 'bb'.repeat(32), block_height: 970001, timestamp: '2026-11-18T05:00:00Z',
  senders: [{ address: OUTRO, amount: 1_500_000_000, has_dog: true }],
  receivers: [{ address: W, amount: 1_500_000_000 }],
}

test('o caso 18/11: o livro parte 39.000 + 11.000 e o grupo soma 50.000 = commercial', () => {
  const l = buildLedger([PARTIDA, SOZINHO], W, { licenseFor: licenceFor, posicoes: {} })
  const board = l.leaderboard.map((e) => ({ ...e, licence_total: e.total }))
  assert.equal(board.find((e) => e.address === ORD)?.license, 'personal')
  assert.equal(board.find((e) => e.address === PAY.toLowerCase())?.total, 11_000)
  const out = comGrupos(board, l.contributions, new Map([[PAY.toLowerCase(), PAY]]))
  const a = out.find((e) => e.address === ORD)!
  const b = out.find((e) => e.address === PAY.toLowerCase())!
  assert.equal(a.group_total, 50_000)
  assert.equal(a.group_license, 'commercial')
  assert.deepEqual(a.co_signers, [PAY]) // base58 com a caixa original
  assert.equal(b.group_license, 'commercial')
  assert.deepEqual(b.co_signers, [ORD])
  assert.equal(a.license, 'personal', 'a conta do placar não muda')
})

test('quem doou sozinho sai sem grupo', () => {
  const l = buildLedger([PARTIDA, SOZINHO], W, { licenseFor: licenceFor, posicoes: {} })
  const board = l.leaderboard.map((e) => ({ ...e, licence_total: e.total }))
  const o = comGrupos(board, l.contributions).find((e) => e.address === OUTRO)!
  assert.equal(o.group_total, undefined)
  assert.equal(o.co_signers, undefined)
})

test('a união é transitiva', () => {
  const e = (address: string, t: number) => ({ address, licence_total: t, license: licenceFor(t) })
  const out = comGrupos([e('a', 4000), e('b', 4000), e('c', 4000)], [{ remetentes: [{ address: 'a' }, { address: 'b' }] }, { remetentes: [{ address: 'b' }, { address: 'c' }] }])
  assert.equal(out[0].group_total, 12_000)
  assert.equal(out[2].group_license, 'personal')
  assert.deepEqual(out[0].co_signers?.sort(), ['b', 'c'])
})
