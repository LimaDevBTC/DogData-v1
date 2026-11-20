// Rodar: npx tsx --test lib/dog/lot-message.test.ts
//
// "MESSAGE THE OWNER" (fundador, 20/11/2026): a regra do texto (500 caracteres, sem link, sem controle), o dono pelo mint (falha
// fechado), os freios (10 por dia, 1 por dia por lote, teto de respostas), o silêncio, a caixa só da sessão e sem endereço inteiro,
// e o HTTP (mesma origem, JSON, sessão, freios, teto do corpo). O banco é EM MEMÓRIA e imita as funções da migração 045.
import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import {
  MAX_CARACTERES, MENSAGENS_POR_DIA, RESPOSTAS_POR_DIA, donoNaResposta, enderecoCurto, idValido, idsValidos, temLink, validarTexto,
} from './lot-message'
import {
  agir, caixa, enviar, naoLidas, responder, type MensagemRow, type MessageDeps, type MessageStore, type Silencio,
} from './lot-message-service'
import { getInbox, postInbox, postLotMessage, type CorpoLido, type PortaHttp } from './lot-message-http'
import { SemTabela } from './licence-lot-service'

const A = 'bc1p' + 'a'.repeat(58) // o remetente
const B = 'bc1p' + 'b'.repeat(58) // o dono do lote
const C = 'bc1p' + 'c'.repeat(58) // um terceiro
const LOTE = 'S09-Q00-B0035-L001'
const LOTE2 = 'S09-Q00-B0035-L002'
const SEM_DONO = 'S01-Q90-B0079-L001'
const DIA = 24 * 60 * 60 * 1000

// ── o banco em memória (as funções da 045) ───────────────────────────────────

interface Linha extends MensagemRow { deletedAt: string | null; createdMs: number }

function bancoFalso() {
  let agora = Date.parse('2026-11-20T12:00:00Z')
  let seq = 0
  const linhas: Linha[] = []
  const silencios: (Silencio & { owner: string })[] = []
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`
  const noDia = (l: Linha) => l.createdMs > agora - DIA
  const store: MessageStore = {
    async send(a) {
      let to: string, lot: string, thread: string
      const id = uuid()
      if (a.replyTo === null) {
        if (!a.to || !a.lot) throw new Error('a new message needs the owner and the lot')
        if (linhas.filter((l) => l.from === a.from && l.replyTo === null && noDia(l)).length >= a.dayCap) return 'day_cap'
        if (linhas.some((l) => l.from === a.from && l.lot === a.lot && l.replyTo === null && noDia(l))) return 'lot_cap'
        to = a.to; lot = a.lot; thread = id
      } else {
        const p = linhas.find((l) => l.id === a.replyTo && l.to === a.from && l.deletedAt === null)
        if (!p) return 'not_found'
        if (linhas.filter((l) => l.from === a.from && l.replyTo !== null && noDia(l)).length >= a.replyCap) return 'reply_cap'
        to = p.from; lot = p.lot; thread = p.threadId
      }
      if (silencios.some((s) => s.owner === to && s.wallet === a.from)) return 'muted'
      assert.notEqual(a.from, to, 'check (from_wallet <> to_wallet)')
      assert.ok([...a.body].length >= 1 && [...a.body].length <= 500, 'check (char_length(body) between 1 and 500)')
      linhas.push({
        id, threadId: thread, replyTo: a.replyTo, lot, from: a.from, to, body: a.body, createdAt: new Date(agora).toISOString(),
        createdMs: agora, readAt: null, deletedAt: null,
      })
      return 'ok'
    },
    async inbox(w, limit) {
      return linhas.filter((l) => l.to === w && l.deletedAt === null).sort((x, y) => y.createdMs - x.createdMs).slice(0, limit)
    },
    async unread(w) {
      return linhas.filter((l) => l.to === w && l.deletedAt === null && l.readAt === null).length
    },
    async ownBodies(w, ids) {
      return new Map(linhas.filter((l) => l.from === w && ids.includes(l.id)).map((l) => [l.id, l.body]))
    },
    async markRead(w, ids) {
      for (const l of linhas) if (l.to === w && ids.includes(l.id) && l.readAt === null && l.deletedAt === null) l.readAt = new Date(agora).toISOString()
    },
    async remove(w, id) {
      const l = linhas.find((x) => x.to === w && x.id === id && x.deletedAt === null)
      if (!l) return false
      l.deletedAt = new Date(agora).toISOString()
      return true
    },
    async mute(w, id) {
      const m = linhas.find((x) => x.id === id && x.to === w)
      if (!m) return false
      if (!silencios.some((s) => s.owner === w && s.wallet === m.from)) {
        silencios.push({ id: uuid(), owner: w, wallet: m.from, createdAt: new Date(agora).toISOString() })
      }
      for (const l of linhas) if (l.to === w && l.from === m.from && l.deletedAt === null) l.deletedAt = new Date(agora).toISOString()
      return true
    },
    async unmute(w, id) {
      const i = silencios.findIndex((s) => s.owner === w && s.id === id)
      if (i < 0) return false
      silencios.splice(i, 1)
      return true
    },
    async mutes(w, limit) {
      return silencios.filter((s) => s.owner === w).slice(0, limit)
    },
  }
  return { store, linhas, silencios, passar: (ms: number) => { agora += ms } }
}

function montar(o: { dono?: (lot: string) => Promise<string | null | undefined>; handles?: Record<string, string> } = {}) {
  const b = bancoFalso()
  const deps: MessageDeps = {
    store: b.store,
    donoDoLote: o.dono ?? (async (lot) => (lot === SEM_DONO ? null : B)),
    handles: async (as) => new Map(as.flatMap((a) => (o.handles?.[a] ? [[a, o.handles[a]] as [string, string]] : []))),
  }
  return { ...b, deps }
}

// ── o texto ─────────────────────────────────────────────────────────────────

test('texto: apara os espaços e recusa o vazio', () => {
  assert.deepEqual(validarTexto('   Hi neighbour!  \n '), { ok: true, texto: 'Hi neighbour!' })
  assert.deepEqual(validarTexto(''), { ok: false, why: 'empty' })
  assert.deepEqual(validarTexto(' \n\t  '), { ok: false, why: 'empty' })
})

test('texto: até 500 caracteres, contados por ponto de código (um emoji é um)', () => {
  assert.equal(validarTexto('x'.repeat(MAX_CARACTERES)).ok, true)
  assert.deepEqual(validarTexto('x'.repeat(MAX_CARACTERES + 1)), { ok: false, why: 'too_long' })
  assert.equal(validarTexto('\u{1F436}'.repeat(MAX_CARACTERES)).ok, true)
  assert.deepEqual(validarTexto('\u{1F436}'.repeat(MAX_CARACTERES + 1)), { ok: false, why: 'too_long' })
  assert.deepEqual(validarTexto('x'.repeat(100_000)), { ok: false, why: 'too_long' })
})

test('texto: o que não é string é recusado', () => {
  for (const v of [undefined, null, 5, {}, ['hi'], true]) assert.deepEqual(validarTexto(v), { ok: false, why: 'invalid_text' })
})

test('texto: quebras de linha normalizadas, controle e direção de texto recusados', () => {
  assert.deepEqual(validarTexto('a\r\nb\rc'), { ok: true, texto: 'a\nb\nc' })
  assert.deepEqual(validarTexto('a\n\n\n\n\nb'), { ok: true, texto: 'a\n\nb' })
  assert.deepEqual(validarTexto('tab\tok'), { ok: true, texto: 'tab\tok' })
  for (const s of ['a\u0000b', 'a\u0007b', 'a\u001bb', 'a\u007fb', 'a\u0085b', 'abc\u202Edcba', 'x\u2066y']) {
    assert.deepEqual(validarTexto(s), { ok: false, why: 'invalid_text' }, JSON.stringify(s))
  }
  // o emoji composto (ZWJ) passa
  assert.equal(validarTexto('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}').ok, true)
})

test('texto: recusa link, URL e domínio solto', () => {
  const links = [
    'see http://x.io', 'HTTPS://EXAMPLE.ORG/a', 'go to https now', 'www.site', 'visit www . example', 'ftp://files', 'example.com',
    'my shop: sub.domain.co.uk/path', 'mail me a@b.io', 'javascript:alert(1)', 'mailto:x', 'try example．com', 'ＷＷＷ．x', 'dogcity.space',
    'ipfs://bafy', 'x://y', 'Check (my.site)',
  ]
  for (const s of links) assert.deepEqual(validarTexto(s), { ok: false, why: 'link' }, s)
})

test('texto: o que parece com link mas não é passa', () => {
  const ok = [
    'Hi! Can we match the facades on The Spit?', 'The pool is 3.5 m deep', 'e.g. a white wall', 'Like the U.S. style',
    'My lot is S09-Q00-B0035-L002, next to yours.', 'Meet at 10:30 by the dock', 'Price? No, just the colours :)', 'ok... sure',
  ]
  for (const s of ok) assert.equal(validarTexto(s).ok, true, s)
  assert.equal(temLink('3.14159'), false)
})

test('endereço curto: bc1p…abcd, nunca o inteiro', () => {
  const curto = enderecoCurto(A)
  assert.equal(curto, 'bc1p\u2026aaaa')
  assert.ok(!curto.includes(A))
})

test('ids: uuid conferido, lista de 1 a 50 sem repetir', () => {
  const u = '00000000-0000-4000-8000-000000000001'
  assert.equal(idValido(u.toUpperCase()), u)
  assert.equal(idValido('1; drop table'), null)
  assert.equal(idValido(7), null)
  assert.deepEqual(idsValidos([u, u]), [u])
  assert.equal(idsValidos([]), null)
  assert.equal(idsValidos('x'), null)
  assert.equal(idsValidos([u, 'nope']), null)
  assert.equal(idsValidos(Array.from({ length: 51 }, () => u)), null)
})

test('dono pelo mint: mintado com detentor = o endereço; não mintado = ninguém; qualquer dúvida = não se sabe', () => {
  const r = (lots: unknown) => ({ lots })
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'minted', holder: B.toUpperCase() }]), LOTE), B)
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'available', holder: null }]), LOTE), null)
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'reserved' }]), LOTE), null)
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'not_for_sale' }]), LOTE), null)
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'minted', holder: null }]), LOTE), undefined)
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'minted', holder: 'not-an-address' }]), LOTE), undefined)
  assert.equal(donoNaResposta(r([{ lotId: LOTE2, state: 'minted', holder: B }]), LOTE), undefined)
  assert.equal(donoNaResposta(r([{ lotId: LOTE, state: 'weird' }]), LOTE), undefined)
  assert.equal(donoNaResposta({ error: 'Unavailable.' }, LOTE), undefined)
  assert.equal(donoNaResposta(null, LOTE), undefined)
})

// ── enviar ──────────────────────────────────────────────────────────────────

test('enviar: vai para o dono do lote pelo mint, com o remetente da sessão', async () => {
  const m = montar()
  assert.deepEqual(await enviar(m.deps, A, LOTE.toLowerCase(), '  Hello neighbour  '), { ok: true })
  assert.equal(m.linhas.length, 1)
  assert.deepEqual([m.linhas[0].from, m.linhas[0].to, m.linhas[0].lot, m.linhas[0].body], [A, B, LOTE, 'Hello neighbour'])
  assert.equal(m.linhas[0].threadId, m.linhas[0].id)
})

test('enviar: lote inválido, texto ruim e link são recusados antes de perguntar ao mint', async () => {
  let perguntas = 0
  const m = montar({ dono: async () => { perguntas++; return B } })
  assert.deepEqual(await enviar(m.deps, A, 'S99', 'hi'), { ok: false, why: 'invalid_lot' })
  assert.deepEqual(await enviar(m.deps, A, undefined, 'hi'), { ok: false, why: 'invalid_lot' })
  assert.deepEqual(await enviar(m.deps, A, LOTE, '   '), { ok: false, why: 'empty' })
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'x'.repeat(501)), { ok: false, why: 'too_long' })
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'buy at www.scam'), { ok: false, why: 'link' })
  assert.equal(perguntas, 0)
  assert.equal(m.linhas.length, 0)
})

test('enviar: mint mudo ou estranho = falha fechado; lote sem dono = no_owner', async () => {
  const mudo = montar({ dono: async () => undefined })
  assert.deepEqual(await enviar(mudo.deps, A, LOTE, 'hi'), { ok: false, why: 'unknown' })
  const caiu = montar({ dono: async () => { throw new Error('timeout') } })
  assert.deepEqual(await enviar(caiu.deps, A, LOTE, 'hi'), { ok: false, why: 'unknown' })
  const lixo = montar({ dono: async () => 'nao-e-endereco' })
  assert.deepEqual(await enviar(lixo.deps, A, LOTE, 'hi'), { ok: false, why: 'unknown' })
  const m = montar()
  assert.deepEqual(await enviar(m.deps, A, SEM_DONO, 'hi'), { ok: false, why: 'no_owner' })
  assert.equal(mudo.linhas.length + caiu.linhas.length + lixo.linhas.length + m.linhas.length, 0)
})

test('enviar: ninguém manda mensagem para o próprio lote', async () => {
  const m = montar()
  assert.deepEqual(await enviar(m.deps, B, LOTE, 'hi me'), { ok: false, why: 'own_lot' })
  assert.equal(m.linhas.length, 0)
})

test('freio: 1 por dia do mesmo remetente para o mesmo lote', async () => {
  const m = montar()
  assert.equal((await enviar(m.deps, A, LOTE, 'one')).ok, true)
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'two'), { ok: false, why: 'lot_cap' })
  assert.equal((await enviar(m.deps, C, LOTE, 'another sender')).ok, true)
  m.passar(DIA + 1)
  assert.equal((await enviar(m.deps, A, LOTE, 'next day')).ok, true)
})

test('freio: até 10 mensagens novas por dia por remetente', async () => {
  const m = montar()
  for (let i = 0; i < MENSAGENS_POR_DIA; i++) {
    assert.equal((await enviar(m.deps, A, `S09-Q00-B0035-L${String(100 + i).padStart(3, '0')}`, `hi ${i}`)).ok, true)
  }
  assert.deepEqual(await enviar(m.deps, A, 'S09-Q00-B0035-L200', 'eleventh'), { ok: false, why: 'day_cap' })
  m.passar(DIA + 1)
  assert.equal((await enviar(m.deps, A, 'S09-Q00-B0035-L200', 'next day')).ok, true)
})

test('banco: sem as tabelas da 045 = not_open; banco fora = unknown', async () => {
  const m = montar()
  m.deps.store.send = async () => { throw new SemTabela('no table') }
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'hi'), { ok: false, why: 'not_open' })
  m.deps.store.send = async () => { throw new Error('connection reset') }
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'hi'), { ok: false, why: 'unknown' })
  m.deps.store.inbox = async () => { throw new SemTabela() }
  assert.deepEqual(await caixa(m.deps, B), { ok: false, why: 'not_open' })
})

// ── responder e a caixa ─────────────────────────────────────────────────────

test('responder: vai para a carteira do remetente, presa à mesma conversa, e ele vê na caixa dele', async () => {
  const m = montar({ handles: { [B]: 'thespit' } })
  await enviar(m.deps, A, LOTE, 'Can we match the facades?')
  const original = m.linhas[0]
  assert.deepEqual(await responder(m.deps, B, original.id, 'Sure, white and teal.'), { ok: true })
  const resp = m.linhas[1]
  assert.deepEqual([resp.from, resp.to, resp.lot, resp.threadId, resp.replyTo], [B, A, LOTE, original.threadId, original.id])
  const v = await caixa(m.deps, A)
  assert.ok(!('ok' in v))
  if ('ok' in v) return
  assert.equal(v.unread, 1)
  assert.equal(v.messages.length, 1)
  assert.deepEqual(v.messages[0].from, { handle: 'thespit', short: enderecoCurto(B) })
  assert.equal(v.messages[0].reply, true)
  assert.equal(v.messages[0].quote, 'Can we match the facades?')
  assert.equal(v.messages[0].text, 'Sure, white and teal.')
  // e o remetente responde de volta na mesma conversa
  assert.deepEqual(await responder(m.deps, A, resp.id, 'Great!'), { ok: true })
  assert.equal(m.linhas[2].to, B)
  assert.equal(m.linhas[2].threadId, original.threadId)
})

test('responder: só a uma mensagem RECEBIDA e não apagada; o corpo não escolhe o destinatário', async () => {
  const m = montar()
  await enviar(m.deps, A, LOTE, 'hello')
  const id = m.linhas[0].id
  assert.deepEqual(await responder(m.deps, C, id, 'not mine to answer'), { ok: false, why: 'not_found' })
  assert.deepEqual(await responder(m.deps, A, id, 'answering my own'), { ok: false, why: 'not_found' })
  assert.deepEqual(await responder(m.deps, B, 'nope', 'x'), { ok: false, why: 'not_found' })
  assert.deepEqual(await responder(m.deps, B, id, 'www.x'), { ok: false, why: 'link' })
  assert.deepEqual(await responder(m.deps, B, id, ''), { ok: false, why: 'empty' })
  await agir(m.deps, B, { action: 'delete', id })
  assert.deepEqual(await responder(m.deps, B, id, 'too late'), { ok: false, why: 'not_found' })
  assert.equal(m.linhas.length, 1)
})

test('responder: não gasta as 10 do dia, e tem o próprio teto', async () => {
  const m = montar({ dono: async (lot) => (lot === LOTE2 ? C : B) })
  for (let i = 0; i < RESPOSTAS_POR_DIA + 1; i++) {
    await enviar(m.deps, `bc1p${String(i).padStart(58, 'd')}`, LOTE, `hi ${i}`)
  }
  const recebidas = m.linhas.slice()
  for (let i = 0; i < RESPOSTAS_POR_DIA; i++) assert.equal((await responder(m.deps, B, recebidas[i].id, 'thanks')).ok, true)
  assert.deepEqual(await responder(m.deps, B, recebidas[RESPOSTAS_POR_DIA].id, 'thanks'), { ok: false, why: 'reply_cap' })
  // as respostas não contam nas novas
  assert.deepEqual(await enviar(m.deps, B, LOTE2, 'a new one'), { ok: true })
})

test('caixa: só as mensagens PARA a sessão, sem endereço inteiro em lugar nenhum', async () => {
  const m = montar({ handles: { [A]: 'neighbour' } })
  await enviar(m.deps, A, LOTE, 'from A')
  await enviar(m.deps, C, LOTE, 'from C')
  const v = await caixa(m.deps, B)
  if ('ok' in v) return assert.fail('caixa falhou')
  assert.equal(v.messages.length, 2)
  assert.equal(v.unread, 2)
  assert.deepEqual(v.messages.map((x) => x.from.handle).sort(), [null, 'neighbour'].sort())
  const json = JSON.stringify(v)
  for (const end of [A, B, C]) assert.ok(!json.includes(end), 'o endereço inteiro vazou')
  // terceiros não veem nada
  const vc = await caixa(m.deps, C)
  if ('ok' in vc) return assert.fail('caixa falhou')
  assert.equal(vc.messages.length, 0)
  const va = await caixa(m.deps, A)
  if ('ok' in va) return assert.fail('caixa falhou')
  assert.equal(va.messages.length, 0)
})

test('caixa: handles fora do ar não derrubam a caixa (cai no endereço curto)', async () => {
  const m = montar()
  m.deps.handles = async () => { throw new Error('down') }
  await enviar(m.deps, A, LOTE, 'hi')
  const v = await caixa(m.deps, B)
  if ('ok' in v) return assert.fail('caixa falhou')
  assert.deepEqual(v.messages[0].from, { handle: null, short: enderecoCurto(A) })
})

// ── as ações da caixa ───────────────────────────────────────────────────────

test('ações: marcar como lida, apagar, e só na caixa da sessão', async () => {
  const m = montar()
  await enviar(m.deps, A, LOTE, 'one')
  await enviar(m.deps, C, LOTE, 'two')
  const [um, dois] = m.linhas
  assert.deepEqual(await agir(m.deps, B, { action: 'read', ids: [um.id] }), { ok: true, unread: 1 })
  assert.deepEqual(await naoLidas(m.deps, B), { unread: 1 })
  // C não apaga nem lê a mensagem de B
  assert.deepEqual(await agir(m.deps, C, { action: 'delete', id: dois.id }), { ok: false, why: 'not_found' })
  await agir(m.deps, C, { action: 'read', ids: [dois.id] })
  assert.equal(dois.readAt, null)
  assert.deepEqual(await agir(m.deps, B, { action: 'delete', id: dois.id }), { ok: true, unread: 0 })
  assert.deepEqual(await agir(m.deps, B, { action: 'delete', id: dois.id }), { ok: false, why: 'not_found' })
  const v = await caixa(m.deps, B)
  if ('ok' in v) return assert.fail('caixa falhou')
  assert.deepEqual(v.messages.map((x) => x.text), ['one'])
})

test('ações: silenciar some com as mensagens do remetente e as próximas não chegam (e ele não sabe)', async () => {
  const m = montar()
  await enviar(m.deps, A, LOTE, 'first')
  m.passar(DIA + 1)
  await enviar(m.deps, A, LOTE, 'second')
  await enviar(m.deps, C, LOTE, 'from C')
  const deA = m.linhas[0].id
  assert.deepEqual(await agir(m.deps, B, { action: 'mute', id: deA }), { ok: true, unread: 1 })
  let v = await caixa(m.deps, B)
  if ('ok' in v) return assert.fail('caixa falhou')
  assert.deepEqual(v.messages.map((x) => x.text), ['from C'])
  assert.equal(v.muted.length, 1)
  assert.equal(v.muted[0].who.short, enderecoCurto(A))
  m.passar(DIA + 1)
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'third'), { ok: true }) // parece que foi
  assert.equal(m.linhas.length, 3) // e não entrou
  // desfaz o silêncio: volta a chegar
  assert.deepEqual(await agir(m.deps, B, { action: 'unmute', id: v.muted[0].id }), { ok: true, unread: 1 })
  m.passar(DIA + 1)
  assert.deepEqual(await enviar(m.deps, A, LOTE, 'fourth'), { ok: true })
  v = await caixa(m.deps, B)
  if ('ok' in v) return assert.fail('caixa falhou')
  assert.ok(v.messages.some((x) => x.text === 'fourth'))
})

test('ações: o silenciado também não consegue responder', async () => {
  const m = montar({ dono: async () => A })
  await enviar(m.deps, B, LOTE, 'hi A') // B escreve para A (dono no falso)
  const paraA = m.linhas[0]
  assert.deepEqual(await responder(m.deps, A, paraA.id, 'hi B'), { ok: true })
  const deA = m.linhas[1]
  await agir(m.deps, B, { action: 'mute', id: deA.id })
  m.passar(5_000)
  assert.deepEqual(await responder(m.deps, A, paraA.id, 'are you there?'), { ok: true })
  assert.equal(m.linhas.length, 2)
})

test('ações: recusas de forma', async () => {
  const m = montar()
  assert.deepEqual(await agir(m.deps, B, { action: 'nuke' }), { ok: false, why: 'unknown_action' })
  assert.deepEqual(await agir(m.deps, B, {}), { ok: false, why: 'unknown_action' })
  assert.deepEqual(await agir(m.deps, B, { action: 'read', ids: 'all' }), { ok: false, why: 'invalid_id' })
  assert.deepEqual(await agir(m.deps, B, { action: 'delete', id: 3 }), { ok: false, why: 'invalid_id' })
  assert.deepEqual(await agir(m.deps, B, { action: 'mute', id: '00000000-0000-4000-8000-000000000999' }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agir(m.deps, B, { action: 'unmute', id: '00000000-0000-4000-8000-000000000999' }), { ok: false, why: 'not_found' })
})

// ── HTTP ────────────────────────────────────────────────────────────────────

function porta(o: { sessao?: string | null; ipCheio?: boolean; carteiraCheia?: boolean } = {}): PortaHttp & { chaves: string[] } {
  const chaves: string[] = []
  return {
    chaves,
    sessao: async () => (o.sessao === undefined ? A : o.sessao),
    freioIp: async () => !!o.ipCheio,
    freioCarteira: async (k) => { chaves.push(k); return !!o.carteiraCheia },
    async lerCorpo(req, teto): Promise<CorpoLido> {
      const t = await req.text()
      if (Buffer.byteLength(t) > teto) return { ok: false, status: 413 }
      try { return { ok: true, valor: JSON.parse(t) } } catch { return { ok: false, status: 400 } }
    },
  }
}

function pedido(caminho: string, corpo?: unknown, cab: Record<string, string> = {}): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: { ...(corpo === undefined ? {} : { 'content-type': 'application/json' }), ...cab },
  }
  if (corpo !== undefined) init.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
  return new NextRequest(`https://www.dogdata.xyz${caminho}`, init)
}

test('HTTP envio: recusas de origem, tipo, sessão, freios e corpo', async () => {
  const m = montar()
  const r = (p: PortaHttp, req: NextRequest) => postLotMessage(req, p, m.deps)
  const ok = { lot: LOTE, text: 'hi' }
  assert.equal((await r(porta(), pedido('/api/dogcity/lot-message', ok, { 'sec-fetch-site': 'cross-site' }))).status, 403)
  assert.equal((await r(porta(), pedido('/api/dogcity/lot-message', ok, { 'content-type': 'text/plain' }))).status, 415)
  assert.equal((await r(porta({ ipCheio: true }), pedido('/api/dogcity/lot-message', ok))).status, 429)
  assert.equal((await r(porta({ sessao: null }), pedido('/api/dogcity/lot-message', ok))).status, 401)
  assert.equal((await r(porta({ carteiraCheia: true }), pedido('/api/dogcity/lot-message', ok))).status, 429)
  assert.equal((await r(porta(), pedido('/api/dogcity/lot-message', '{nope'))).status, 400)
  assert.equal((await r(porta(), pedido('/api/dogcity/lot-message', '[1,2]'))).status, 400)
  assert.equal((await r(porta(), pedido('/api/dogcity/lot-message', { lot: LOTE, text: 'x'.repeat(5000) }))).status, 413)
  assert.equal(m.linhas.length, 0)
})

test('HTTP envio: o remetente é a sessão, nunca o corpo; cada motivo com o seu status', async () => {
  const m = montar()
  const p = porta()
  const res = await postLotMessage(pedido('/api/dogcity/lot-message', { lot: LOTE, text: 'hi', from: C, to: C }), p, m.deps)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual([m.linhas[0].from, m.linhas[0].to], [A, B])
  assert.deepEqual(p.chaves, [`lot-message:${A}`])
  const st = async (corpo: unknown, d = m.deps) => {
    const x = await postLotMessage(pedido('/api/dogcity/lot-message', corpo), porta(), d)
    return [x.status, (await x.json()).why]
  }
  assert.deepEqual(await st({ lot: LOTE, text: 'again' }), [429, 'lot_cap'])
  assert.deepEqual(await st({ lot: LOTE2, text: 'http://x' }), [422, 'link'])
  assert.deepEqual(await st({ lot: LOTE2, text: '' }), [422, 'empty'])
  assert.deepEqual(await st({ lot: LOTE2, text: 'y'.repeat(501) }), [422, 'too_long'])
  assert.deepEqual(await st({ lot: 'bad', text: 'hi' }), [422, 'invalid_lot'])
  assert.deepEqual(await st({ lot: SEM_DONO, text: 'hi' }), [404, 'no_owner'])
  assert.deepEqual(await st({ replyTo: 'x', text: 'hi' }), [404, 'not_found'])
  const mudo = montar({ dono: async () => undefined })
  assert.deepEqual(await st({ lot: LOTE2, text: 'hi' }, mudo.deps), [503, 'unknown'])
  const proprio = montar({ dono: async () => A })
  assert.deepEqual(await st({ lot: LOTE2, text: 'hi' }, proprio.deps), [422, 'own_lot'])
})

test('HTTP caixa: GET só com sessão, ?count=1 só o contador, POST com as ações', async () => {
  const m = montar()
  await enviar(m.deps, A, LOTE, 'hello B')
  const id = m.linhas[0].id
  assert.equal((await getInbox(pedido('/api/dogcity/inbox'), porta({ sessao: null }), m.deps)).status, 401)
  assert.equal((await getInbox(pedido('/api/dogcity/inbox', undefined, { 'sec-fetch-site': 'cross-site' }), porta({ sessao: B }), m.deps)).status, 403)
  assert.equal((await getInbox(pedido('/api/dogcity/inbox'), porta({ sessao: B, ipCheio: true }), m.deps)).status, 429)
  const c = await getInbox(pedido('/api/dogcity/inbox?count=1'), porta({ sessao: B }), m.deps)
  assert.deepEqual(await c.json(), { unread: 1 })
  const v = await (await getInbox(pedido('/api/dogcity/inbox'), porta({ sessao: B }), m.deps)).json()
  assert.equal(v.messages[0].text, 'hello B')
  assert.ok(!JSON.stringify(v).includes(A))
  // a caixa de A não tem a mensagem que A mandou
  assert.equal((await (await getInbox(pedido('/api/dogcity/inbox'), porta({ sessao: A }), m.deps)).json()).messages.length, 0)
  const acao = (corpo: unknown, p = porta({ sessao: B }), cab: Record<string, string> = {}) =>
    postInbox(pedido('/api/dogcity/inbox', corpo, cab), p, m.deps)
  assert.equal((await acao({ action: 'read', ids: [id] }, porta({ sessao: null }))).status, 401)
  assert.equal((await acao({ action: 'read', ids: [id] }, porta({ sessao: B }), { 'sec-fetch-site': 'cross-site' })).status, 403)
  assert.equal((await acao({ action: 'read', ids: [id] }, porta({ sessao: B }), { 'content-type': 'text/plain' })).status, 415)
  assert.equal((await acao({ action: 'read', ids: [id] }, porta({ sessao: B, carteiraCheia: true }))).status, 429)
  assert.equal((await acao({ action: 'zap' })).status, 422)
  assert.equal((await acao({ action: 'delete', id }, porta({ sessao: C }))).status, 404)
  const lida = await acao({ action: 'read', ids: [id] })
  assert.deepEqual([lida.status, await lida.json()], [200, { ok: true, unread: 0 }])
  assert.equal((await acao({ action: 'mute', id })).status, 200)
  const depois = await (await getInbox(pedido('/api/dogcity/inbox'), porta({ sessao: B }), m.deps)).json()
  assert.equal(depois.messages.length, 0)
  assert.equal(depois.muted.length, 1)
})

