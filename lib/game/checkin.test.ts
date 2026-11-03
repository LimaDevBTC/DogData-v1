// Rodar: npx tsx --test lib/game/checkin.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, computeCheckin, gameDay, nextMilestone, weekStart } from './checkin'

const T = '2026-11-04' // quarta
const run = (n: number, end = T) => Array.from({ length: n }, (_, i) => addDays(end, -i))

test('dia de jogo vira as 08:00 UTC', () => {
  assert.equal(gameDay(Date.parse('2026-11-04T07:59:59Z')), '2026-11-03')
  assert.equal(gameDay(Date.parse('2026-11-04T08:00:00Z')), '2026-11-04')
  assert.equal(gameDay(Date.parse('2026-11-04T23:59:59Z')), '2026-11-04')
  assert.equal(gameDay(Date.parse('2026-11-05T00:00:00Z')), '2026-11-04')
  assert.equal(gameDay(Date.parse('2026-01-01T03:00:00Z')), '2025-12-31')
})

test('sem historico', () => {
  const c = computeCheckin([], T)
  assert.deepEqual([c.streak, c.best, c.restDaysLeft, c.weekDays, c.checkedToday, c.nextMilestone], [0, 0, 2, 0, false, 7])
  assert.equal(c.reward, null)
})

test('sequencia simples e hoje ainda nao marcado nao quebra', () => {
  const c = computeCheckin(run(3, addDays(T, -1)), T)
  assert.equal(c.streak, 3)
  assert.equal(c.checkedToday, false)
  assert.equal(c.restDaysLeft, 2)
})

test('uma folga e duas folgas sao perdoadas; a terceira em 7 dias quebra', () => {
  const base = (skip: number[]) =>
    run(7).filter((_, i) => !skip.includes(i)) // i = dias atras de hoje
  assert.equal(computeCheckin(base([2]), T).streak, 6)
  const two = computeCheckin(base([2, 4]), T)
  assert.equal(two.streak, 5)
  assert.equal(two.restDaysLeft, 0)
  const three = computeCheckin(base([2, 4, 5]), T)
  assert.equal(three.streak, 2) // terceiro buraco (2 dias atras) quebra; recomeca nos 2 dias marcados depois
})

test('quebrou: welcome back recomeca em 1 e best guarda a maior', () => {
  const old = run(10, '2026-10-20')
  const c = computeCheckin([...old, T], T)
  assert.equal(c.streak, 1)
  assert.equal(c.best, 10)
  assert.equal(c.restDaysLeft, 2)
})

test('folga repoe depois de 7 dias', () => {
  // buraco ha 8 dias: ja saiu da janela
  const days = run(12).filter((_, i) => i !== 8)
  const c = computeCheckin(days, T)
  assert.equal(c.streak, 11)
  assert.equal(c.restDaysLeft, 2)
})

test('semana de jogo comeca na segunda; meta 4 de 7', () => {
  assert.equal(weekStart('2026-11-04'), '2026-11-02')
  assert.equal(weekStart('2026-11-08'), '2026-11-02')
  assert.equal(weekStart('2026-11-09'), '2026-11-09')
  const c = computeCheckin(['2026-11-01', '2026-11-02', '2026-11-04'], T)
  assert.equal(c.weekDays, 2)
})

test('duplicatas e dias futuros sao ignorados; POST duplo nao paga duas vezes', () => {
  const days = [T, T, addDays(T, 1)]
  const first = computeCheckin(days, T, true)
  assert.equal(first.streak, 1)
  assert.deepEqual(first.reward?.items, [{ id: 'racao', qtd: 2 }, { id: 'garrafa_agua', qtd: 2 }])
  assert.equal(first.reward?.points, 10)
  const second = computeCheckin(days, T, false)
  assert.equal(second.justClaimed, false)
  assert.equal(second.reward, null)
  assert.equal(second.checkedToday, true)
})

test('marco de 7 dias paga +50 e proximo marco avanca', () => {
  const c = computeCheckin(run(7), T, true)
  assert.equal(c.streak, 7)
  assert.equal(c.reward?.points, 60)
  assert.equal(c.nextMilestone, 14)
  assert.equal(nextMilestone(30), 60)
  assert.equal(nextMilestone(100), 200)
})
