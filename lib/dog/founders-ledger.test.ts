// Run: npx tsx --test lib/dog/founders-ledger.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLedger, repartir, type TxRow } from './founders-ledger'

const W = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
const lic = () => 'x'

// Real rows (shape as stored in dog_transactions).
const MISSING_DONATION: TxRow = {
  id: 1, txid: '57782273bb196f249e0412846a49ed4ce4d92b39bbf76a8595c62b98ca8723ea', block_height: 965159, timestamp: '2026-09-02T10:51:07Z',
  senders: [{ address: 'bc1pdmpwsprd9dycdu3kxawz4r28hnk7qlzeaj5c6kd63jv2cdqzs9zq4utlqm', amount: 1000646230, amount_dog: 10006.4623, has_dog: true }],
  receivers: [
    { address: W, amount: 1000000000, amount_dog: 10000.0, vout: 1 },
    { address: 'bc1pdmpwsprd9dycdu3kxawz4r28hnk7qlzeaj5c6kd63jv2cdqzs9zq4utlqm', amount: 646230, amount_dog: 6.4623, vout: 2 },
  ],
}
const TWO_ENTRIES: TxRow = {
  id: 145942, txid: '1138a93ce987cc9bf4af0129e6c3aa9829ae66d680697ddf579f62effd6db983', block_height: 939633, timestamp: '2026-03-06T22:17:14+00:00',
  senders: JSON.stringify([
    { amount: 878053000, address: 'bc1pk8g4rztfkxs2q9c40g6keeknjw6aadx3kzu4suzlll0remfw7xxs5x9ctv', has_dog: true, amount_dog: 8780.53 },
    { amount: null, address: 'bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da', has_dog: false, amount_dog: null },
  ]),
  receivers: JSON.stringify([
    { vout: 1, address: 'bc1pk8g4rztfkxs2q9c40g6keeknjw6aadx3kzu4suzlll0remfw7xxs5x9ctv', amount: 6083000, amount_dog: 60.83 },
    { vout: 2, address: W, amount: 871970000, amount_dog: 8719.7 },
  ]),
}

test('the donation that was missing counts: 10,000 DOG, change is not a donation, donor is founder 1', () => {
  const L = buildLedger([MISSING_DONATION], W, { licenseFor: lic })
  assert.equal(L.totalAtomos, 1_000_000_000n)
  assert.equal(L.founders.length, 1)
  assert.equal(L.founders[0].address, 'bc1pdmpwsprd9dycdu3kxawz4r28hnk7qlzeaj5c6kd63jv2cdqzs9zq4utlqm')
  assert.equal(L.founders[0].total, 10000)
})

test('two entries: the one that only paid the fee is not a founder; the DOG sender gets all 8,719.7', () => {
  const L = buildLedger([TWO_ENTRIES], W, { licenseFor: lic })
  assert.equal(L.totalAtomos, 871_970_000n)
  assert.deepEqual(L.founders.map((f) => [f.founder_seq, f.address.slice(0, 12), f.totalAtomos]), [[1, 'bc1pk8g4rztf', 871_970_000n]])
  assert.equal(L.leaderboard.length, 1)
})

test('several DOG senders split by net DOG (inputs minus own change), largest remainder, exact sum', () => {
  const A = 'bc1pa', B = 'bc1pb'
  const row: TxRow = {
    txid: 'aa', block_height: 1, timestamp: 't',
    senders: [{ address: A, amount: 700 }, { address: B, amount: 400 }],
    receivers: [{ address: W, amount: 1001 }, { address: B, amount: 100 }], // B net = 300, A net = 700
  }
  const L = buildLedger([row], W, { licenseFor: lic })
  const got = Object.fromEntries(L.founders.map((f) => [f.address, f.totalAtomos]))
  assert.equal(got[A] + got[B], 1001n)
  assert.equal(got[A], 701n) // 1001*700/1000 = 700.7, 1001*300/1000 = 300.3 -> remainder goes to A
  assert.equal(got[B], 300n)
  assert.deepEqual(repartir(10n, [1n, 1n, 1n]), [4n, 3n, 3n])
})

test('numbering is by block, then position in block, never by timestamp; anonymous counts but is not numbered', () => {
  const mk = (txid: string, block: number, ts: string, from: string | null): TxRow => ({
    txid, block_height: block, timestamp: ts,
    senders: from ? [{ address: from, amount: 100 }] : [],
    receivers: [{ address: W, amount: 100 }],
  })
  const rows = [mk('t3', 11, '2026-01-01', 'late'), mk('t2', 10, '2026-12-31', 'second'), mk('t1', 10, '2026-12-31', 'first'), mk('t0', 9, '2026-06-01', null)]
  const L = buildLedger(rows, W, { licenseFor: lic, posicoes: { t1: 3, t2: 7 } })
  assert.deepEqual(L.founders.map((f) => f.address), ['first', 'second', 'late'])
  assert.equal(L.totalAtomos, 400n)
  assert.ok(L.leaderboard.some((e) => e.address === 'anonymous'))
})

test('the fund as sender (withdrawal) is never a donation', () => {
  const row: TxRow = { txid: 'w', block_height: 5, timestamp: 't', senders: [{ address: W, amount: 500 }], receivers: [{ address: 'x', amount: 300 }, { address: W, amount: 200 }] }
  assert.equal(buildLedger([row], W, { licenseFor: lic }).totalAtomos, 0n)
})
