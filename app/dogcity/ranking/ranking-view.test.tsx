// Rodar: npx tsx --test app/dogcity/ranking/ranking-view.test.tsx
//
// A PAGINA do ranking dos DC Points renderizada no servidor: as tres abas, o seletor de periodo, o estado vazio honesto,
// o "Unavailable", a linha "You", o texto publico em ingles sem travessao nem promessa de premio, e o endereco so abreviado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
import { RankingView, RULES, EMPTY_TEXT, type RankingState } from './ranking-view'
import type { Board, Period, PublicRanking } from '@/lib/game/points/ranking'

;(globalThis as any).React = React

const base = (over: Partial<PublicRanking> = {}): PublicRanking => ({
  board: 'total', period: 'all', updatedAt: '2026-11-27T12:00:00.000Z', total: 3, me: null,
  rows: [
    { rank: 1, handle: 'alice', wallet: 'bc1paaaaaa…aaaaaa', walletPath: null, avatar: null, points: 1234 },
    { rank: 2, handle: null, wallet: 'bc1pbbbbbb…bbbbbb', walletPath: '/address/bitcoin/bc1p' + 'b'.repeat(58), avatar: null, points: 800 },
    { rank: 2, handle: 'carol', wallet: 'bc1pcccccc…cccccc', walletPath: null, avatar: 'a'.repeat(64) + 'i0', points: 800 },
  ], ...over,
})
const html = (s: RankingState, board: Board = 'total', period: Period = 'all') =>
  renderToStaticMarkup(React.createElement(RankingView, { state: s, board, period }))
    .replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')

test('titulo, tres abas e o seletor de periodo', () => {
  const h = html({ status: 'ready', data: base() })
  assert.ok(h.includes('DC Points ranking'))
  for (const t of ['Total', 'Login', 'Ambassador', 'All time', 'This week']) assert.ok(h.includes(`>${t}<`), t)
  assert.match(h, /aria-selected="true"[^>]*>Total</)
})

test('linhas: posicao, @handle, carteira abreviada com link interno, pontos com separador, empate na mesma posicao', () => {
  const h = html({ status: 'ready', data: base() })
  assert.ok(h.includes('@alice') && h.includes('1,234') && h.includes('@carol'))
  assert.ok(h.includes('href="/address/bitcoin/bc1p' + 'b'.repeat(58) + '"'))
  assert.ok(!h.includes('mempool.space') && !h.includes('http'.concat('s://')) )
  assert.equal((h.match(/>2<\/td>/g) ?? []).length, 2)
  assert.ok(h.includes('/api/inscription/' + 'a'.repeat(64) + 'i0/content'))
})

test('estado vazio honesto por quadro, loading e Unavailable', () => {
  const vazio = (b: Board) => html({ status: 'ready', data: base({ board: b, rows: [], total: 0 }) }, b)
  assert.ok(vazio('ambassador').includes('No ambassador points yet'))
  assert.ok(vazio('login').includes(EMPTY_TEXT.login))
  assert.ok(html({ status: 'error' }).includes('Unavailable'))
  assert.ok(html({ status: 'loading' }).includes('Reading the board'))
})

test('a linha You so aparece com sessao (me)', () => {
  assert.ok(!html({ status: 'ready', data: base() }).includes('>You<'))
  const h = html({ status: 'ready', data: base({ me: { rank: 7, points: 42 } }) })
  assert.ok(h.includes('>You<') && h.includes('>7<') && h.includes('>42<'))
})

test('dado remoto vira texto, nunca HTML', () => {
  const h = html({ status: 'ready', data: base({ rows: [{ rank: 1, handle: null, wallet: '<img src=x onerror=alert(1)>', walletPath: null, avatar: null, points: 1 }] }) })
  assert.ok(!h.includes('<img src=x'))
})

test('texto publico em ingles: sem travessao, sem promessa de premio, sem endereco inteiro', () => {
  const dir = new URL('.', import.meta.url).pathname
  const all = [html({ status: 'ready', data: base() }), ...RULES.map((r) => r.lead + r.text), readFileSync(dir + 'layout.tsx', 'utf8'), readFileSync(dir + 'page.tsx', 'utf8')].join('\n')
  assert.ok(!all.includes('\u2014') && !all.includes('\u2013'))
  assert.ok(!/\b(airdrop|prize|win|reward you|will receive|guarantee)/i.test(RULES.map((r) => r.text).join(' ')))
  assert.ok(html({ status: 'loading' }).includes('Nothing on this page is a promise of a reward'))
  assert.ok(!html({ status: 'ready', data: base() }).includes('b'.repeat(58)) || html({ status: 'ready', data: base() }).includes('/address/bitcoin/'))
})
