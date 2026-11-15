// Rodar: npx tsx --test lib/game/points/points.test.ts
//
// DC Points no servidor e a compra de carro em DC Points (migração 042), com um banco de MENTIRA que imita as funções
// dc_points_* (store-memory.ts). UM TESTE POR ATAQUE: crédito acima do teto diário, débito acima do saldo, referência
// repetida, corrida de duas compras simultâneas do mesmo modelo, carteira sem handle, valor NaN/negativo/fração/gigante,
// preço do cliente ignorado, migração que tenta passar do teto, migração repetida. Mais: fonte fora da lista, check-in
// pela rota earn, o preço em DC igual ao $DOG / 20, o seed da 042 igual ao catálogo, os tetos da 042 iguais aos do código.
// O SQL de verdade é provado à parte (PGlite e Postgres embutido, fora do repo; ver o PR).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAR_MODELS, CAR_MODEL_IDS, DOG_PER_DC_POINT, MAX_CAR_PRICE_DC, catalogIsSane } from '@/lib/game/cars/catalog'
import { computeCheckin } from '@/lib/game/checkin'
import { ECONOMIA } from './ajustes_economia'
import {
  CHECKIN_MAX_PER_OP, DAILY_CAP, EARN_SOURCES, MAX_BALANCE, MAX_PER_OP, MIGRATION_START_DAY, legacyBalanceFromSave, migrationAmount,
  migrationCap, parseEarn, parseSpend, quoteSpend, SPEND_ITEMS,
} from './rules'
import { buyCarWithPoints, carDcShowroom, creditCheckin, earnPoints, readPoints, spendPoints } from './service'
import { MemoryPointsStore } from './store-memory'
import { parseBuyCarAnswer, parseEarnAnswer, parseSpendAnswer, parseState } from './store'

const W = 'bc1p' + 'a'.repeat(58)
const W2 = 'bc1p' + 'b'.repeat(58)
const DAY = '2026-11-15'
let n = 0
const ref = () => `ref-${String(++n).padStart(8, '0')}`

function store(handles: string[] = [W]): MemoryPointsStore {
  const s = new MemoryPointsStore()
  s.today = DAY
  for (const h of handles) s.handles.add(h)
  return s
}

/** dá saldo pelo caminho de verdade (ganhos), dia a dia, sem passar do teto */
async function fund(s: MemoryPointsStore, w: string, amount: number) {
  const day0 = s.today
  let left = amount
  let d = 0
  while (left > 0) {
    s.today = `2026-12-${String(1 + (d++ % 28)).padStart(2, '0')}`
    if (d > 28) s.today = `2027-01-${String(d - 27).padStart(2, '0')}`
    while (left > 0 && s.earnedOn(w, s.today) < DAILY_CAP) {
      const a = Math.min(left, DAILY_CAP - s.earnedOn(w, s.today), 480)
      const r = await earnPoints(s, w, { source: 'venda', amount: a, ref: ref() })
      assert.equal(r.status, 200)
      left -= r.body.credited as number
    }
  }
  s.today = day0
}

// ── crédito acima do teto diário ──────────────────────────────────────────────────────────────────────────────
test('ataque: crédito acima do teto diário de 480 entra só até o teto, e depois nada', async () => {
  const s = store()
  const a = await earnPoints(s, W, { source: 'pesca', amount: 400, ref: ref() })
  assert.equal(a.status, 200)
  assert.equal(a.body.credited, 400)
  const b = await earnPoints(s, W, { source: 'caca', amount: 200, ref: ref() })
  assert.equal(b.body.credited, 80)
  assert.equal(b.body.capped, true)
  assert.equal(b.body.remainingToday, 0)
  const c = await earnPoints(s, W, { source: 'venda', amount: 1, ref: ref() })
  assert.equal(c.status, 200)
  assert.equal(c.body.credited, 0)
  assert.equal(c.body.balance, 480)
  // cem chamadas de 480 no mesmo dia não passam de 480
  for (let i = 0; i < 100; i++) await earnPoints(s, W, { source: 'madeira', amount: 480, ref: ref() })
  assert.equal(s.earnedOn(W, DAY), 480)
  assert.equal((await readPoints(s, W)).body.balance, 480)
  // o dia vira (08:00 UTC): o teto volta inteiro
  s.today = '2026-11-16'
  const d = await earnPoints(s, W, { source: 'venda', amount: 480, ref: ref() })
  assert.equal(d.body.credited, 480)
  assert.equal(d.body.balance, 960)
})

test('ataque: allOrNothing (venda de item) não entra pela metade', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'venda', amount: 450, ref: ref() })
  const r = await earnPoints(s, W, { source: 'venda', amount: 40, ref: ref(), allOrNothing: true })
  assert.equal(r.status, 200)
  assert.equal(r.body.credited, 0)
  assert.equal(r.body.capped, true)
  assert.equal(r.body.balance, 450)
  const ok = await earnPoints(s, W, { source: 'venda', amount: 30, ref: ref(), allOrNothing: true })
  assert.equal(ok.body.credited, 30)
})

test('ataque: o check-in conta no teto diário e não passa dele', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'pesca', amount: 475, ref: ref() })
  const c = await creditCheckin(s, W, DAY, 10)
  assert.deepEqual(c, { status: 'credited', credited: 5, balance: 480 })
  const again = await creditCheckin(s, W, DAY, 10)
  assert.equal(again.status, 'duplicate')
  assert.equal(again.credited, 5)
  assert.equal(s.balances.get(W), 480)
})

test('ataque: saldo no teto absoluto de 1.000.000 não cresce', async () => {
  const s = store()
  s.balances.set(W, MAX_BALANCE - 3)
  const r = await earnPoints(s, W, { source: 'venda', amount: 100, ref: ref() })
  assert.equal(r.body.credited, 3)
  assert.equal(r.body.balance, MAX_BALANCE)
  const z = await earnPoints(s, W, { source: 'venda', amount: 100, ref: ref() })
  assert.equal(z.body.credited, 0)
})

// ── débito acima do saldo ─────────────────────────────────────────────────────────────────────────────────────
test('ataque: gastar acima do saldo responde 402 e não mexe em nada', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'venda', amount: 5, ref: ref() })
  const r = await spendPoints(s, W, { item: 'carne', qty: 10, ref: ref() }, DAY)
  assert.equal(r.status, 402)
  assert.equal(r.body.error, 'insufficient_points')
  assert.equal(r.body.balance, 5)
  assert.ok((r.body.needed as number) > 5)
  assert.equal(s.balances.get(W), 5)
  assert.equal(s.ledger.get(W)!.filter((l) => l.kind === 'spend').length, 0)
})

test('ataque: comprar carro sem saldo responde 402 com quanto falta, sem carro', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'venda', amount: 300, ref: ref() })
  const r = await buyCarWithPoints(s, W, { model: 'c52', ref: ref() })
  assert.equal(r.status, 402)
  assert.deepEqual(r.body, { error: 'insufficient_points', balance: 300, priceDc: 500, missing: 200 })
  assert.equal(s.owned.size, 0)
  assert.equal(s.balances.get(W), 300)
})

test('ataque: um saldo de outra carteira não paga a minha compra (a carteira é a da sessão)', async () => {
  const s = store([W, W2])
  await fund(s, W2, 600)
  const r = await buyCarWithPoints(s, W, { model: 'c52', ref: ref(), wallet: W2, address: W2 })
  assert.equal(r.status, 402)
  assert.equal(s.balances.get(W2), 600)
})

// ── referência repetida ───────────────────────────────────────────────────────────────────────────────────────
test('ataque: a mesma referência repetida credita UMA vez', async () => {
  const s = store()
  const body = { source: 'pesca', amount: 50, ref: 'same-ref-0001' }
  const a = await earnPoints(s, W, body)
  const b = await earnPoints(s, W, body)
  const c = await earnPoints(s, W, body)
  assert.equal(a.body.duplicate, false)
  assert.equal(b.body.duplicate, true)
  assert.equal(c.body.duplicate, true)
  assert.equal(b.body.credited, 50)
  assert.equal(s.balances.get(W), 50)
})

test('ataque: a mesma referência para OUTRA operação é 409 ref_conflict', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'pesca', amount: 50, ref: 'same-ref-0002' })
  const other = await earnPoints(s, W, { source: 'pesca', amount: 480, ref: 'same-ref-0002' })
  assert.equal(other.status, 409)
  assert.equal(other.body.error, 'ref_conflict')
  const src = await earnPoints(s, W, { source: 'caca', amount: 50, ref: 'same-ref-0002' })
  assert.equal(src.status, 409)
  assert.equal(s.balances.get(W), 50)
})

test('ataque: compra repetida com a mesma referência debita uma vez e devolve duplicate', async () => {
  const s = store()
  await fund(s, W, 1000)
  const body = { model: 'c52', ref: 'buy-ref-0001' }
  const a = await buyCarWithPoints(s, W, body)
  const b = await buyCarWithPoints(s, W, body)
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
  assert.equal(b.body.duplicate, true)
  assert.equal(s.balances.get(W), 500)
  // outra referência para o mesmo modelo: já tem
  const c = await buyCarWithPoints(s, W, { model: 'c52', ref: ref() })
  assert.equal(c.status, 409)
  assert.equal(c.body.error, 'already_owned')
})

test('ataque: gasto repetido com a mesma referência debita uma vez, mesmo com o preço do dia mudado', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'venda', amount: 200, ref: ref() })
  const body = { item: 'carne', qty: 2, ref: 'spend-ref-01' }
  const a = await spendPoints(s, W, body, DAY)
  assert.equal(a.status, 200)
  // repetição no dia seguinte, com maxTotal menor que o preço novo: devolve o original, não 409
  const b = await spendPoints(s, W, { ...body, maxTotal: 1 }, '2026-11-16')
  assert.equal(b.status, 200)
  assert.equal(b.body.duplicate, true)
  assert.equal(b.body.debited, a.body.debited)
  assert.equal(s.balances.get(W), 200 - (a.body.debited as number))
})

test('ataque: tutorial e Verified pagam UMA vez por carteira, qualquer que seja o ref', async () => {
  const s = store()
  const a = await earnPoints(s, W, { source: 'tutorial', amount: 25, ref: ref() })
  const b = await earnPoints(s, W, { source: 'tutorial', amount: 25, ref: ref() })
  const c = await earnPoints(s, W, { source: 'tutorial', amount: 25 })
  assert.equal(a.body.credited, 25)
  assert.equal(b.body.duplicate, true)
  assert.equal(c.body.duplicate, true)
  const v1 = await earnPoints(s, W, { source: 'verified', amount: 30, ref: ref() })
  const v2 = await earnPoints(s, W, { source: 'verified', amount: 30, ref: ref() })
  assert.equal(v1.body.credited, 30)
  assert.equal(v2.body.duplicate, true)
  assert.equal(s.balances.get(W), 55)
  // valor diferente do fixo: 400
  assert.equal((await earnPoints(s, W, { source: 'tutorial', amount: 24, ref: ref() })).status, 400)
  assert.equal((await earnPoints(s, W, { source: 'verified', amount: 31, ref: ref() })).status, 400)
})

// ── corrida de duas compras simultâneas do mesmo modelo ───────────────────────────────────────────────────────
test('ataque: duas compras simultâneas do mesmo modelo dão UM carro e UM débito', async () => {
  const s = store()
  await fund(s, W, 1500)
  const rs = await Promise.all(Array.from({ length: 8 }, () => buyCarWithPoints(s, W, { model: 'c52', ref: ref() })))
  const ok = rs.filter((r) => r.status === 200)
  assert.equal(ok.length, 1)
  assert.equal(rs.filter((r) => r.status === 409 && r.body.error === 'already_owned').length, 7)
  assert.equal(s.balances.get(W), 1000)
  assert.equal([...s.owned.keys()].filter((k) => k === `${W}|c52`).length, 1)
})

test('ataque: duas compras simultâneas de modelos diferentes não gastam o mesmo saldo duas vezes', async () => {
  const s = store()
  await fund(s, W, 600)
  const [a, b] = await Promise.all([
    buyCarWithPoints(s, W, { model: 'c52', ref: ref() }),
    buyCarWithPoints(s, W, { model: 'c56', ref: ref() }),
  ])
  assert.deepEqual([a.status, b.status].sort(), [200, 402])
  assert.equal(s.balances.get(W), 100)
})

test('controle: sem a trava, o banco de mentira deixa a corrida passar (o teste acima mede de verdade)', async () => {
  const s = store()
  await fund(s, W, 1500)
  s.locking = false
  const rs = await Promise.all([1, 2].map(() => buyCarWithPoints(s, W, { model: 'c52', ref: ref() })))
  assert.equal(rs.filter((r) => r.status === 200).length, 2)
})

test('ataque: o prêmio da corrida e a compra antiga em cripto contam como posse (um de cada modelo)', async () => {
  const s = store()
  await fund(s, W, 30_000)
  s.owned.set(`${W}|c02`, 'prize')
  s.owned.set(`${W}|c41`, 'purchase')
  assert.equal((await buyCarWithPoints(s, W, { model: 'c02', ref: ref() })).body.error, 'already_owned')
  assert.equal((await buyCarWithPoints(s, W, { model: 'c41', ref: ref() })).body.error, 'already_owned')
  const ok = await buyCarWithPoints(s, W, { model: 'c05', ref: ref() })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.priceDc, 12_500)
})

// ── carteira sem handle ───────────────────────────────────────────────────────────────────────────────────────
test('ataque: carteira sem handle não acumula (403), não migra, e o check-in só dá os itens', async () => {
  const s = store([])
  s.snapshot({ [W]: { v: 1, economia: { v: 1, saldo: 900, recebido: { dia: 20000, total: 0 } } } }, DAY)
  const e = await earnPoints(s, W, { source: 'pesca', amount: 10, ref: ref() })
  assert.equal(e.status, 403)
  assert.equal(e.body.error, 'no_handle')
  const g = await readPoints(s, W)
  assert.equal(g.body.canEarn, false)
  assert.equal(g.body.migrated, false)
  assert.equal(g.body.balance, 0)
  assert.equal((await creditCheckin(s, W, DAY, 10)).status, 'no_handle')
  assert.equal((await earnPoints(s, W, { source: 'tutorial', amount: 25 })).status, 403)
  // ganhou o handle: a próxima leitura migra, e o tutorial ainda paga (o ref não foi gasto)
  s.handles.add(W)
  const g2 = await readPoints(s, W)
  assert.equal(g2.body.migrated, true)
  assert.equal(g2.body.balance, 900)
  assert.equal((await earnPoints(s, W, { source: 'tutorial', amount: 25 })).body.credited, 25)
})

// ── valor NaN / negativo / fração / gigante ───────────────────────────────────────────────────────────────────
test('ataque: valor que não é inteiro da faixa é 400 e nada entra', async () => {
  const s = store()
  const bad: unknown[] = [NaN, Infinity, -Infinity, -1, 0, -0.5, 0.5, 10.5, 481, 1e21, 2 ** 53, Number.MAX_VALUE, '10', '1e3', null, true, [10], { v: 10 }, undefined]
  for (const amount of bad) {
    const r = await earnPoints(s, W, { source: 'pesca', amount, ref: ref() })
    assert.equal(r.status, 400, `amount ${String(amount)}`)
    assert.equal(r.body.error, 'invalid_amount')
  }
  // JSON de verdade: 1e999 vira Infinity no parse
  const r = await earnPoints(s, W, JSON.parse('{"source":"pesca","amount":1e999,"ref":"abcdefgh"}'))
  assert.equal(r.status, 400)
  // acima do teto da fonte (turno: 100; missão: 100)
  assert.equal((await earnPoints(s, W, { source: 'turno', amount: 101, ref: ref() })).status, 400)
  assert.equal((await earnPoints(s, W, { source: 'missao', amount: 101, ref: ref() })).status, 400)
  assert.equal(s.balances.get(W) ?? 0, 0)
  assert.equal(s.ledger.get(W)?.length ?? 0, 0)
})

test('ataque: quantidade do mercado NaN/negativa/fração/gigante é 400', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'venda', amount: 480, ref: ref() })
  for (const qty of [NaN, Infinity, -1, 0, 1.5, 101, 1e9, '2', null]) {
    const r = await spendPoints(s, W, { item: 'carne', qty, ref: ref() }, DAY)
    assert.equal(r.status, 400, `qty ${String(qty)}`)
  }
  // total acima do teto por operação (100 picaretas a ~60): invalid_qty
  assert.equal(quoteSpend('picareta', 100, DAY)!.total <= MAX_PER_OP, true)
  for (const maxTotal of [NaN, -1, 0, 1.5, 10_001, '9']) {
    const r = await spendPoints(s, W, { item: 'carne', qty: 1, ref: ref(), maxTotal }, DAY)
    assert.equal(r.status, 400, `maxTotal ${String(maxTotal)}`)
    assert.equal(r.body.error, 'invalid_max_total')
  }
  assert.equal(s.balances.get(W), 480)
})

test('ataque: fonte desconhecida, check-in pela rota earn, protótipo e corpo torto são 400', async () => {
  const s = store()
  for (const source of ['checkin', 'migration', 'refund', 'compra', '__proto__', 'toString', 'constructor', 'PESCA', '', 1, null]) {
    const r = await earnPoints(s, W, { source, amount: 10, ref: ref() })
    assert.equal(r.status, 400, `source ${String(source)}`)
    assert.equal(r.body.error, 'invalid_source')
  }
  for (const body of [null, [], 'pesca', 42, true, Object.create({ source: 'pesca', amount: 10, ref: 'abcdefgh' })]) {
    assert.equal((await earnPoints(s, W, body)).status, 400)
  }
  for (const r0 of ['short', 'a'.repeat(65), 'has space!', 'ünïcode00', 123456789, null, undefined]) {
    const r = await earnPoints(s, W, { source: 'pesca', amount: 10, ref: r0 })
    assert.equal(r.status, 400, `ref ${String(r0)}`)
    assert.equal(r.body.error, 'invalid_ref')
  }
  assert.equal((await earnPoints(s, W, { source: 'pesca', amount: 10, ref: ref(), allOrNothing: 'yes' })).status, 400)
  for (const model of ['__proto__', 'C52', 'c99', 'cyber', '', 52, null]) {
    const r = await buyCarWithPoints(s, W, { model, ref: ref() })
    assert.equal(r.status, 400, `model ${String(model)}`)
    assert.equal(r.body.error, 'invalid_model')
  }
  for (const item of ['peixe_cru', 'garrafa_vazia', 'carne_caca', 'tora', '__proto__', 'hasOwnProperty', 'CARNE', 7]) {
    const r = await spendPoints(s, W, { item, qty: 1, ref: ref() }, DAY)
    assert.equal(r.status, 400, `item ${String(item)}`)
    assert.equal(r.body.error, 'invalid_item')
  }
  assert.equal(s.ledger.get(W)?.length ?? 0, 0)
})

// ── preço do cliente ignorado ─────────────────────────────────────────────────────────────────────────────────
test('ataque: preço mandado pelo cliente no mercado é ignorado (cobra o preço do dia do servidor)', async () => {
  const s = store()
  await earnPoints(s, W, { source: 'venda', amount: 480, ref: ref() })
  const q = quoteSpend('machado', 2, DAY)!
  const r = await spendPoints(s, W, { item: 'machado', qty: 2, ref: ref(), price: 1, unitPrice: 1, total: 1, debited: 1 }, DAY)
  assert.equal(r.status, 200)
  assert.equal(r.body.unitPrice, q.unitPrice)
  assert.equal(r.body.debited, q.total)
  assert.ok(q.unitPrice >= 38 && q.unitPrice <= 63) // 50 +- 25%
  assert.equal(s.balances.get(W), 480 - q.total)
  // maxTotal só RECUSA: abaixo do preço, nada sai
  const low = await spendPoints(s, W, { item: 'carne', qty: 1, ref: ref(), maxTotal: 1 }, DAY)
  assert.equal(low.status, 409)
  assert.equal(low.body.error, 'price_changed')
  assert.equal(s.balances.get(W), 480 - q.total)
})

test('ataque: preço mandado pelo cliente na compra do carro é ignorado; o banco com outro preço fecha a venda', async () => {
  const s = store()
  await fund(s, W, 13_000)
  const r = await buyCarWithPoints(s, W, { model: 'c02', ref: ref(), priceDc: 1, price: 1, amount: 1 })
  assert.equal(r.status, 200)
  assert.equal(r.body.priceDc, 12_500)
  assert.equal(s.balances.get(W), 500)
  // o banco com outro preço (alguém mexeu numa ponta só): 503, nada debitado
  s.models.set('c56', { priceDc: 1, active: true })
  const m = await buyCarWithPoints(s, W, { model: 'c56', ref: ref() })
  assert.equal(m.status, 503)
  assert.equal(m.body.error, 'catalog_mismatch')
  s.models.set('c52', { priceDc: 500, active: false })
  assert.equal((await buyCarWithPoints(s, W, { model: 'c52', ref: ref() })).body.error, 'model_not_for_sale')
  assert.equal(s.balances.get(W), 500)
})

// ── migração ──────────────────────────────────────────────────────────────────────────────────────────────────
test('ataque: migração que tenta passar do teto fica em 480 x dias de 29/10 até o dia da foto', async () => {
  const s = store()
  s.snapshot({ [W]: { v: 1, economia: { v: 1, saldo: 1_000_000, recebido: { dia: 20000, total: 0 } } } }, DAY)
  const cap = 480 * 18 // 29/10 a 15/11 inclusive
  assert.equal(migrationCap(DAY), cap)
  const g = await readPoints(s, W)
  assert.equal(g.body.migrated, true)
  assert.equal(g.body.migratedAmount, cap)
  assert.equal(g.body.balance, cap)
  // a migração não conta no teto diário: ainda dá para ganhar 480 hoje
  assert.equal(g.body.earnedToday, 0)
  assert.equal((await earnPoints(s, W, { source: 'venda', amount: 480, ref: ref() })).body.credited, 480)
})

test('ataque: migração repetida não credita de novo; save inflado depois da foto não migra nada', async () => {
  const s = store([W, W2])
  s.snapshot({ [W]: { v: 1, economia: { v: 1, saldo: 700, recebido: { dia: 20000, total: 10 } } } }, DAY)
  await readPoints(s, W)
  await readPoints(s, W)
  assert.equal((await s.migrate(W)).status, 'already')
  await Promise.all([readPoints(s, W), readPoints(s, W), s.migrate(W)])
  assert.equal(s.balances.get(W), 700)
  assert.equal(s.ledger.get(W)!.filter((l) => l.kind === 'migration').length, 1)
  // a foto é uma só: uma segunda (o bloco colado de novo) não muda nada, e W2 (save novo) não tem foto
  s.snapshot({ [W2]: { v: 1, economia: { v: 1, saldo: 5000, recebido: { dia: 20000, total: 0 } } } }, '2026-11-20')
  const g2 = await readPoints(s, W2)
  assert.equal(g2.body.migrated, true)
  assert.equal(g2.body.migratedAmount, 0)
  assert.equal(g2.body.balance, 0)
})

test('a migração lê o save como o jogo (validarSecao): lixo vira 0', () => {
  const ok = (saldo: unknown, extra: Record<string, unknown> = {}) => ({ v: 1, economia: { v: 1, saldo, recebido: { dia: 20000, total: 5 }, ...extra } })
  assert.equal(legacyBalanceFromSave(ok(321)), 321)
  assert.equal(legacyBalanceFromSave(ok(0)), 0)
  assert.equal(legacyBalanceFromSave(ok(1_000_000)), 1_000_000)
  for (const bad of [ok(-1), ok(1.5), ok(1_000_001), ok('100'), ok(null), ok(NaN), ok(Infinity), null, [], 'x', { v: 2, economia: ok(5).economia },
    { v: 1 }, { v: 1, economia: { v: 2, saldo: 5, recebido: { dia: 1, total: 1 } } },
    { v: 1, economia: { v: 1, saldo: 5 } }, { v: 1, economia: { v: 1, saldo: 5, recebido: { dia: -1, total: 0 } } },
    { v: 1, economia: { v: 1, saldo: 5, recebido: { dia: 1, total: 481 } } }, { v: 1, economia: { v: 1, saldo: 5, recebido: { dia: 1.5, total: 0 } } }]) {
    assert.equal(legacyBalanceFromSave(bad), 0, JSON.stringify(bad))
  }
  assert.equal(migrationAmount(ok(50_000), '2026-10-29'), 480)
  assert.equal(migrationAmount(ok(100), '2026-10-29'), 100)
  assert.equal(migrationCap('2026-10-28'), 0)
  assert.equal(migrationCap('2026-11-30'), 480 * 33)
  assert.equal(migrationCap('lixo'), 0)
  assert.equal(MIGRATION_START_DAY, '2026-10-29')
})

// ── leitura defensiva das respostas do banco ──────────────────────────────────────────────────────────────────
test('resposta torta do banco lança (a rota responde 503), nunca vira saldo ou carro', () => {
  assert.throws(() => parseState(null))
  assert.throws(() => parseState({ balance: -1, earned_today: 0, day: DAY, migrated: false, migrated_amount: 0, has_handle: true }))
  assert.throws(() => parseState({ balance: 1.5, earned_today: 0, day: DAY, migrated: false, migrated_amount: 0, has_handle: true }))
  assert.throws(() => parseEarnAnswer({ status: 'ok', requested: 10, credited: 11, balance: 1, earned_today: 1, day: DAY }))
  assert.throws(() => parseEarnAnswer({ status: 'maybe' }))
  assert.throws(() => parseSpendAnswer({ status: 'ok', item: 'carne', qty: 1, unit_price: 8, debited: 0, balance: 1 }))
  assert.throws(() => parseBuyCarAnswer({ status: 'ok', model: 'c52', price: 500, balance: 1, ownership_ref: 'x' }))
  assert.throws(() => parseBuyCarAnswer({ status: 'ok', model: '__proto__', price: 500, balance: 1, ownership_ref: 'dc:1' }))
  assert.deepEqual(parseState({ balance: '12', earned_today: 0, day: DAY, migrated: true, migrated_amount: 0, has_handle: true }).balance, 12)
})

// ── catálogo e a 042 ──────────────────────────────────────────────────────────────────────────────────────────
const SQL = readFileSync(join(process.cwd(), 'supabase/migrations/042_dc_points.sql'), 'utf8')

test('preço em DC Points = preço em $DOG / 20 (fundador, 15/11), a tabela da decisão, e o seed da 042 igual', () => {
  assert.equal(catalogIsSane(), true)
  assert.equal(DOG_PER_DC_POINT, 20)
  const FUNDADOR: Record<string, number> = {
    c52: 500, c56: 500, c42: 1250, c43: 1250, c62: 1500, c30: 1750, c32: 1750, c61: 1750, c25: 2000, c26: 2000, c28: 2000,
    c39: 3000, c40: 3000, c41: 3000, c15: 3750, c10: 5000, c02: 12500, c05: 12500,
  }
  assert.equal(CAR_MODEL_IDS.length, 18)
  const seed = new Map<string, number>()
  const block = SQL.slice(SQL.indexOf('update public.car_models m set price_dc'), SQL.indexOf(') as v (id, p)'))
  for (const m of block.matchAll(/\('(c[0-9]{2})', ([0-9]+)\)/g)) seed.set(m[1], Number(m[2]))
  assert.equal(seed.size, 18)
  for (const id of CAR_MODEL_IDS) {
    const c = CAR_MODELS[id]
    assert.equal(c.priceDc, c.priceDog / 20, id)
    assert.equal(c.priceDc, FUNDADOR[id], id)
    assert.equal(seed.get(id), c.priceDc, `seed ${id}`)
    assert.ok(c.priceDc <= MAX_CAR_PRICE_DC)
  }
})

test('os tetos da 042 são os do código (480, 10.000, 1.000.000, 29/10, check-in, carro 250.000)', () => {
  assert.equal(DAILY_CAP, 480)
  assert.equal(MAX_PER_OP, 10_000)
  assert.equal(MAX_BALANCE, 1_000_000)
  assert.equal(ECONOMIA.tetoDiarioRecebido, 480)
  assert.ok(SQL.includes("greatest(0, 480 - v_earned)"))
  assert.ok(SQL.includes("select 480 * greatest(0, (p_day - date '2026-10-29') + 1)"))
  assert.ok(SQL.includes('check (balance between 0 and 1000000)'))
  assert.ok(SQL.includes("(kind = 'earn' and requested between 1 and 10000"))
  assert.ok(SQL.includes("(kind = 'car' and delta between -250000 and -1"))
  assert.ok(SQL.includes("interval '8 hours'"))
  assert.equal(CHECKIN_MAX_PER_OP, 60)
  assert.equal(computeCheckin(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'], DAY, true).reward!.points, 60)
  assert.equal(MAX_CAR_PRICE_DC, 250_000)
  // a 042 nunca dá grant ao anon nem ao authenticated; o estorno não tem grant nem para o service_role
  assert.ok(!/grant[^;]*to (anon|authenticated|public)/i.test(SQL))
  assert.ok(!/grant execute on function public\.dc_points_refund/.test(SQL))
  for (const t of ['dc_points_wallets', 'dc_points_ledger', 'dc_points_meta', 'dc_points_legacy']) {
    assert.ok(SQL.includes(`alter table public.${t} enable row level security`), t)
    assert.ok(SQL.includes(`revoke all on table public.${t} from anon, authenticated`), t)
  }
})

test('as fontes de ganho: lista fechada, tetos do README, nenhuma passa do teto diário nem do teto por operação', () => {
  assert.deepEqual(Object.keys(EARN_SOURCES).sort(), ['caca', 'cavalo', 'madeira', 'minerio', 'missao', 'pesca', 'turno', 'tutorial', 'venda', 'verified'])
  for (const [k, v] of Object.entries(EARN_SOURCES)) {
    assert.ok(v.maxPerOp >= 1 && v.maxPerOp <= DAILY_CAP && v.maxPerOp <= MAX_PER_OP, k)
    assert.equal(parseEarn({ source: k, amount: v.fixed ?? v.maxPerOp, ref: 'abcdefgh' }).ok, true, k)
  }
  assert.equal(EARN_SOURCES.turno.maxPerOp, 100)
  assert.equal(EARN_SOURCES.verified.fixed, ECONOMIA.recompensaVerified)
  assert.ok(!('checkin' in EARN_SOURCES))
})

test('o mercado: só o que o mercado central vende, preço de 1 ao teto, total dentro de 10.000', () => {
  assert.deepEqual([...SPEND_ITEMS], ['garrafa_agua', 'carne', 'galao', 'vara', 'rede', 'covo', 'machado', 'picareta'])
  for (const item of SPEND_ITEMS) {
    for (const day of ['2026-11-15', '2026-11-16', '2027-03-01']) {
      const q = quoteSpend(item, 1, day)!
      assert.ok(q.unitPrice >= 1 && q.total === q.unitPrice, `${item} ${day}`)
    }
  }
  assert.equal(quoteSpend('carne', 1, 'lixo'), null)
  assert.equal(parseSpend({ item: 'carne', qty: 1, ref: 'abcdefgh', maxTotal: null }).ok, true)
})

test('a vitrine em DC Points: preço do código, à venda só quando o banco concorda e o modelo está ativo', () => {
  const rows = CAR_MODEL_IDS.map((id) => ({ id, priceDc: CAR_MODELS[id].priceDc, active: true }))
  rows[0] = { ...rows[0], priceDc: 1 }
  rows[1] = { ...rows[1], active: false }
  const v = carDcShowroom(rows.slice(0, 17)) as { currency: string; models: { id: string; priceDc: number; available: boolean }[] }
  assert.equal(v.currency, 'dc_points')
  assert.equal(v.models.length, 18)
  const by = new Map(v.models.map((m) => [m.id, m]))
  assert.equal(by.get(rows[0].id)!.available, false)
  assert.equal(by.get(rows[1].id)!.available, false)
  assert.equal(by.get(CAR_MODEL_IDS[17])!.available, false) // sem linha no banco
  assert.equal(by.get(CAR_MODEL_IDS[2])!.available, true)
  assert.equal(by.get('c02')!.priceDc, 12_500)
})

test('as rotas leem a carteira da SESSÃO e nunca um preço ou endereço do corpo', () => {
  const root = process.cwd()
  for (const f of ['app/api/game/points/route.ts', 'app/api/game/points/earn/route.ts', 'app/api/game/points/spend/route.ts', 'app/api/dogcity/car-buy/route.ts']) {
    const src = readFileSync(join(root, f), 'utf8')
    assert.ok(src.includes('walletOf(req)'), `${f}: sessão`)
    assert.ok(src.includes('walletOverLimit('), `${f}: freio por carteira`)
    assert.ok(!/body\.(price|priceDc|unitPrice|total|wallet|address)/.test(src), `${f}: corpo`)
  }
  const svc = readFileSync(join(root, 'lib/game/points/service.ts'), 'utf8')
  const rules = readFileSync(join(root, 'lib/game/points/rules.ts'), 'utf8')
  assert.ok(!/body\.(price|priceDc|unitPrice|total|wallet|address)\b/.test(svc + rules))
  const http = readFileSync(join(root, 'lib/game/points/http.ts'), 'utf8')
  assert.ok(http.includes('sessionWallet(req)'))
})
