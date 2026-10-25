// Rodar: npx tsx --test app/dogcity/referrals/board-view.test.tsx
//
// A PAGINA do placar de referral renderizada no servidor: o texto publico em ingles, as regras de contagem, a
// ausencia de travessao, de promessa de valor e de endereco inteiro. Tambem confere o texto publico dos outros
// arquivos novos (layout da rota e secao do perfil).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
import { ReferralBoardView, RULES, type BoardState } from './board-view'
import { toPublicBoard } from '../../../lib/referral/board'

;(globalThis as any).React = React // o JSX classico dos testes usa React no escopo

const FULL = 'bc1p' + 'q'.repeat(58)
const html = (s: BoardState) =>
  renderToStaticMarkup(React.createElement(ReferralBoardView, { state: s }))
    .replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')

const ready = (): BoardState => ({
  status: 'ready',
  board: toPublicBoard([
    { referrer_address: 'bc1p' + 'a'.repeat(58), handle: 'alice', referred: 12, minted: 4, minted_lots: 5,
      licences_personal: 2, licences_commercial: 1, licences_patron: 0, licence_dog: 70_000,
      counted_at: '2026-10-25T20:10:00Z', referrers_total: 2, referred_total: 13 },
    { referrer_address: FULL, handle: null, referred: 1, minted: 0, minted_lots: 0,
      licences_personal: 0, licences_commercial: 0, licences_patron: 0, licence_dog: 0,
      counted_at: '2026-10-25T20:10:00Z', referrers_total: 2, referred_total: 13 },
  ]),
})

test('o titulo e a frase do fundador estao na pagina, em ingles', () => {
  const h = html(ready())
  assert.ok(h.includes('Referral board'))
  assert.ok(h.includes("We're counting. What referrals unlock will be announced."))
})

test('mostra o ranking com @handle e contagens, e o endereco so abreviado', () => {
  const h = html(ready())
  assert.ok(h.includes('@alice'))
  assert.ok(h.includes('70,000'))
  assert.ok(h.includes('2 Personal') && h.includes('1 Commercial'))
  assert.ok(!h.includes(FULL), 'endereco inteiro de quem indica nao pode aparecer')
  assert.ok(h.includes('bc1pqqqqqq…'), 'o abreviado aparece')
})

test('as regras de contagem estao publicadas na propria pagina', () => {
  const h = html(ready())
  for (const r of RULES) {
    assert.ok(h.includes(r.lead), r.lead)
    assert.ok(h.includes(r.text.slice(0, 40)), r.lead)
  }
  const regras = RULES.map((r) => r.text).join(' ')
  assert.match(regras, /first time/)
  assert.match(regras, /already verified/)
  assert.match(regras, /one|first link/i)
  assert.match(regras, /Referring yourself/)
  assert.match(regras, /after the link/i)
  assert.match(regras, /exclude/)
  assert.match(regras, /abuse/)
})

test('sem travessao (em dash, en dash, barra horizontal) em nenhum estado da pagina', () => {
  for (const s of [{ status: 'loading' }, { status: 'error' }, ready(), { status: 'ready', board: toPublicBoard([]) }] as BoardState[]) {
    assert.doesNotMatch(html(s), /[\u2014\u2013\u2015\u2212]/, JSON.stringify(s).slice(0, 40))
  }
})

test('sem promessa de valor: nada de reward, airdrop, earn, bonus ou prazo; diz que nada e promessa', () => {
  const h = html(ready())
  assert.doesNotMatch(h, /\b(airdrop|earn|bonus|payout|prize|win)\b/i)
  assert.ok(h.includes('Nothing on this page is a promise'))
})

test('estados: carregando, erro e vazio dizem o que acontece, sem inventar numero', () => {
  assert.ok(html({ status: 'loading' }).includes('Reading the board.'))
  assert.ok(html({ status: 'error' }).includes('not available right now'))
  const vazio = html({ status: 'ready', board: toPublicBoard([]) })
  assert.ok(vazio.includes('No referrals counted yet'))
  assert.ok(!vazio.includes('<table'))
  // regras aparecem mesmo sem dado
  assert.ok(vazio.includes('How we count'.toUpperCase()))
})

test('o texto publico dos outros arquivos novos: sem travessao e sem endereco', () => {
  const root = new URL('../../../', import.meta.url)
  const layout = readFileSync(new URL('app/dogcity/referrals/layout.tsx', root), 'utf8')
  assert.doesNotMatch(layout, /[\u2014\u2013\u2015]/)
  assert.ok(layout.includes("We're counting. What referrals unlock will be announced."))
  const perfil = readFileSync(new URL('app/profile/page.tsx', root), 'utf8')
  const ini = perfil.indexOf('{/* ── referral (fase 1: so contar) ── */}')
  const fim = perfil.indexOf('{/* ── cidade e registro de fundadores ── */}')
  assert.ok(ini > 0 && fim > ini)
  const secao = perfil.slice(ini, fim)
  assert.doesNotMatch(secao, /[\u2014\u2013\u2015]/)
  assert.ok(secao.includes('Your referral link'))
  assert.ok(secao.includes('Copy'))
})
