// Rodar: PGLITE=/caminho/node_modules/@electric-sql/pglite/dist/index.js npx tsx --test lib/phone/phone.sql.test.ts
//
// O DOG Phone (Mensagens) de ponta a ponta contra o SQL DE VERDADE da migração 046, num Postgres local (PGlite): três contas
// (ana, bia, caio), o aceite antes da conversa, a persistência, o bloqueio e a terceira conta que não recebe nem alcança a
// conversa das outras duas. Sem `PGLITE` os testes são PULADOS (e dizem isso): não valem como aprovados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { getMessages, getPhone, getSearch, postFriends, postMessages, type PortaHttp } from './http'
import { agir, buscar, contar, enviar, historico, inicio, ler, type PhoneDeps } from './service'
import { abrirBancoLocal, type BancoLocal } from './sql-local'

const PGLITE = process.env.PGLITE
const pular = PGLITE ? false : 'sem PGLITE: o SQL da 046 NAO foi exercitado'

const ANA = 'bc1p' + 'a'.repeat(58)
const BIA = 'bc1p' + 'b'.repeat(58)
const CAIO = 'bc1p' + 'c'.repeat(58)
const DUDA = 'bc1p' + 'd'.repeat(58)

async function cenario(): Promise<{ db: BancoLocal; deps: PhoneDeps }> {
  const db = await abrirBancoLocal(PGLITE!)
  await db.sql(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'bia'),($3,'caio')`, [ANA, BIA, CAIO])
  return { db, deps: { rpc: db.rpc, segredo: 'teste' } }
}
let n = 0
const cid = (): string => `cid_teste_${String(++n).padStart(4, '0')}`

test('aceite antes da conversa, historico, nao lidas e leitura', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  // a busca confirma o perfil sem endereco
  const b = await buscar(deps, ANA, '@Bia')
  assert.ok(b.ok && b.found)
  assert.deepEqual(b.ok && b.found ? [b.profile.handle, b.relation, b.profile.id] : null, ['bia', 'none', null])
  assert.ok(!JSON.stringify(b).includes(BIA), 'a busca nunca devolve a carteira')
  assert.deepEqual(await buscar(deps, ANA, 'ninguem'), { ok: true, found: false })
  assert.deepEqual(await buscar(deps, ANA, 'b%'), { ok: false, why: 'invalid_handle' })
  const eu = await buscar(deps, ANA, 'ana')
  assert.equal(eu.ok && eu.found ? eu.relation : null, 'self')

  // pedido: antes do aceite nao ha' envio, de nenhum dos dois lados
  const p = await agir(deps, ANA, { action: 'request', handle: 'bia' })
  assert.ok(p.ok && p.status === 'requested' && p.id)
  const idBia = p.ok ? p.id! : ''
  const idAna = (await inicio(deps, ANA)).me.id
  assert.deepEqual(await enviar(deps, ANA, { to: idBia, text: 'oi', cid: cid() }), { ok: false, why: 'not_friends' })
  assert.deepEqual(await enviar(deps, BIA, { to: idAna, text: 'oi', cid: cid() }), { ok: false, why: 'not_friends' })
  assert.deepEqual(await historico(deps, ANA, { with: idBia, before: null, limit: null }), { ok: false, why: 'not_friends' })
  // quem pediu nao aceita o proprio pedido; o pedido repetido nao duplica
  assert.deepEqual(await agir(deps, ANA, { action: 'accept', id: idBia }), { ok: false, why: 'not_found' })
  assert.equal(((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { status: string }).status, 'requested')
  const telaBia = await inicio(deps, BIA)
  assert.deepEqual([telaBia.incoming.map((x) => x.handle), telaBia.requests, telaBia.friends.length], [['ana'], 1, 0])
  assert.deepEqual((await inicio(deps, ANA)).outgoing.map((x) => x.handle), ['bia'])

  // aceite
  const a = await agir(deps, BIA, { action: 'accept', id: idAna })
  assert.ok(a.ok && a.nudge === (await contar(deps, ANA)).nudge, 'o aceite devolve a cutucada de quem pediu')
  const m1 = await enviar(deps, ANA, { to: idBia, text: '  ola bia  ', cid: 'cid_fixo_0001' })
  assert.ok(m1.ok && m1.message.text === 'ola bia' && m1.message.mine)
  assert.ok(m1.ok && m1.nudge === telaBia.me.nudge, 'o envio devolve a cutucada do destinatario')
  // o mesmo cid (reenvio depois de reconectar) devolve a mesma mensagem, sem duplicar
  const m1b = await enviar(deps, ANA, { to: idBia, text: 'ola bia', cid: 'cid_fixo_0001' })
  assert.equal(m1b.ok && m1.ok ? m1b.message.id : -1, m1.ok ? m1.message.id : -2)
  await enviar(deps, ANA, { to: idBia, text: 'tudo bem?', cid: cid() })
  assert.deepEqual(await contar(deps, BIA).then((c) => [c.unread, c.requests]), [2, 0])
  assert.deepEqual(await contar(deps, ANA).then((c) => c.unread), 0)
  const hb = await historico(deps, BIA, { with: idAna, before: null, limit: 10 })
  assert.ok(hb.ok)
  assert.deepEqual(hb.ok ? hb.messages.map((m) => [m.text, m.mine]) : [], [['tudo bem?', false], ['ola bia', false]])
  await ler(deps, BIA, { with: idAna, upTo: hb.ok ? hb.messages[0]!.id : 0 })
  assert.equal((await contar(deps, BIA)).unread, 0)
  const ha = await historico(deps, ANA, { with: idBia, before: null, limit: 10 })
  assert.equal(ha.ok ? ha.peerRead : -1, hb.ok ? hb.messages[0]!.id : -2, 'ana ve ate' + ' onde bia leu')
  await enviar(deps, BIA, { to: idAna, text: 'tudo!', cid: cid() })
  const telaAna = await inicio(deps, ANA)
  assert.deepEqual(telaAna.friends.map((f) => [f.handle, f.unread, f.last?.text, f.last?.mine]), [['bia', 1, 'tudo!', false]])
  assert.ok(!JSON.stringify(telaAna).includes(BIA) && !JSON.stringify(telaAna).includes(ANA), 'a tela nunca traz carteira')
  await db.fechar()
})

test('historico paginado e persistencia depois de reconectar', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const idBia = ((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { id: string }).id
  const idAna = (await inicio(deps, ANA)).me.id
  await agir(deps, BIA, { action: 'accept', id: idAna })
  for (let i = 1; i <= 45; i++) {
    // direto no banco (sem o freio de 30 por minuto): o que se mede aqui e' a pagina
    await db.rpc('dogcity_phone_send', { p_me: idAna, p_other: idBia, p_body: `m${i}`, p_cid: cid(), p_cap_min: 1000 })
  }
  // "reconectou": outro objeto de deps sobre o MESMO banco (nenhum estado no servico)
  const depois: PhoneDeps = { rpc: db.rpc, segredo: 'teste' }
  const p1 = await historico(depois, BIA, { with: idAna, before: null, limit: 20 })
  assert.ok(p1.ok && p1.more)
  assert.deepEqual(p1.ok ? [p1.messages.length, p1.messages[0]!.text, p1.messages[19]!.text] : [], [20, 'm45', 'm26'])
  const p2 = await historico(depois, BIA, { with: idAna, before: p1.ok ? p1.messages[19]!.id : 0, limit: 20 })
  assert.deepEqual(p2.ok ? [p2.messages[0]!.text, p2.messages[19]!.text, p2.more] : [], ['m25', 'm6', true])
  const p3 = await historico(depois, BIA, { with: idAna, before: p2.ok ? p2.messages[19]!.id : 0, limit: 20 })
  assert.deepEqual(p3.ok ? [p3.messages.length, p3.messages.at(-1)!.text, p3.more] : [], [5, 'm1', false])
  // entregue depois de reconectar: bia nao leu nada, as 45 de ana continuam contadas; quando ela responde, leu ate' ali
  assert.equal((await contar(depois, BIA)).unread, 45)
  await enviar(depois, BIA, { to: idAna, text: 'li tudo', cid: cid() })
  assert.equal((await contar(depois, BIA)).unread, 0)
  await db.fechar()
})

test('a terceira conta nao recebe nem alcanca a conversa das outras duas', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const idBia = ((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { id: string }).id
  const idAna = (await inicio(deps, ANA)).me.id
  await agir(deps, BIA, { action: 'accept', id: idAna })
  const m = await enviar(deps, ANA, { to: idBia, text: 'segredo das duas', cid: cid() })
  assert.ok(m.ok)
  const telaCaio = await inicio(deps, CAIO)
  assert.deepEqual([telaCaio.friends, telaCaio.incoming, telaCaio.outgoing, telaCaio.unread], [[], [], [], 0])
  for (const com of [idAna, idBia]) {
    assert.deepEqual(await historico(deps, CAIO, { with: com, before: null, limit: 50 }), { ok: false, why: 'not_friends' })
    assert.deepEqual(await enviar(deps, CAIO, { to: com, text: 'deixa eu entrar', cid: cid() }), { ok: false, why: 'not_friends' })
    assert.deepEqual(await ler(deps, CAIO, { with: com, upTo: 999 }), { ok: false, why: 'not_friends' })
    assert.deepEqual(await agir(deps, CAIO, { action: 'accept', id: com }), { ok: false, why: 'not_found' })
    assert.deepEqual(await agir(deps, CAIO, { action: 'mute', id: com }), { ok: false, why: 'not_found' })
    assert.deepEqual(await agir(deps, CAIO, { action: 'report', id: com }), { ok: false, why: 'not_found' })
  }
  // nem com o cid da mensagem de ana (o cid e' por remetente)
  const roubo = await db.rpc('dogcity_phone_send', { p_me: telaCaio.me.id, p_other: idBia, p_body: 'x', p_cid: 'cid_teste_0001', p_cap_min: 30 })
  assert.equal((roubo as { status: string }).status, 'not_friends')
  // nada da conversa aparece em nenhuma resposta de caio, mesmo virando amigo de ana depois
  await agir(deps, CAIO, { action: 'request', handle: 'ana' })
  await agir(deps, ANA, { action: 'accept', id: telaCaio.me.id })
  const hc = await historico(deps, CAIO, { with: idAna, before: null, limit: 50 })
  assert.deepEqual(hc.ok ? hc.messages : null, [])
  assert.ok(!JSON.stringify(await inicio(deps, CAIO)).includes('segredo'))
  // a cutucada de caio e' outra: o aviso de ana para bia nao e' dele
  assert.notEqual(telaCaio.me.nudge, m.ok ? m.nudge : '')
  await db.fechar()
})

test('bloqueio impede pedido e mensagem novos e nao se revela na busca', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const idBia = ((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { id: string }).id
  const idAna = (await inicio(deps, ANA)).me.id
  await agir(deps, BIA, { action: 'accept', id: idAna })
  await enviar(deps, ANA, { to: idBia, text: 'antes', cid: cid() })
  assert.deepEqual(await agir(deps, BIA, { action: 'block', id: idAna }), { ok: true, status: 'ok', id: idAna })
  assert.deepEqual(await enviar(deps, ANA, { to: idBia, text: 'depois', cid: cid() }), { ok: false, why: 'not_friends' })
  assert.deepEqual(await enviar(deps, BIA, { to: idAna, text: 'depois', cid: cid() }), { ok: false, why: 'not_friends' })
  assert.deepEqual(await historico(deps, ANA, { with: idBia, before: null, limit: 10 }), { ok: false, why: 'not_friends' })
  assert.deepEqual(await buscar(deps, ANA, 'bia'), { ok: true, found: false })
  assert.deepEqual(await agir(deps, ANA, { action: 'request', handle: 'bia' }), { ok: false, why: 'not_found' })
  const telaBia = await inicio(deps, BIA)
  assert.deepEqual([telaBia.blocked.map((x) => x.handle), telaBia.friends.length], [['ana'], 0])
  assert.deepEqual(await agir(deps, BIA, { action: 'request', handle: 'ana' }), { ok: false, why: 'blocked' })
  // desbloquear nao refaz a amizade: precisa de pedido e aceite de novo
  await agir(deps, BIA, { action: 'unblock', id: idAna })
  assert.deepEqual(await enviar(deps, ANA, { to: idBia, text: 'voltei', cid: cid() }), { ok: false, why: 'not_friends' })
  assert.equal(((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { status: string }).status, 'requested')
  await agir(deps, BIA, { action: 'accept', id: idAna })
  const h = await historico(deps, BIA, { with: idAna, before: null, limit: 10 })
  assert.deepEqual(h.ok ? h.messages.map((x) => x.text) : [], ['antes'], 'a conversa antiga volta com o novo aceite')
  await db.fechar()
})

test('recusar, cancelar, remover, silenciar, denunciar e os tetos', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const idAna = (await inicio(deps, ANA)).me.id
  const idBia = (await inicio(deps, BIA)).me.id
  // recusar: quem foi recusado espera para pedir de novo; quem recusou pode pedir
  await agir(deps, ANA, { action: 'request', handle: 'bia' })
  assert.equal(((await agir(deps, BIA, { action: 'decline', id: idAna })) as { ok: boolean }).ok, true)
  assert.deepEqual(await agir(deps, ANA, { action: 'request', handle: 'bia' }), { ok: false, why: 'cooldown' })
  assert.equal((await inicio(deps, BIA)).incoming.length, 0)
  assert.equal(((await agir(deps, BIA, { action: 'request', handle: 'ana' })) as { status: string }).status, 'requested')
  // cancelar o pedido enviado
  assert.equal(((await agir(deps, BIA, { action: 'cancel', id: idAna })) as { ok: boolean }).ok, true)
  assert.equal((await inicio(deps, ANA)).incoming.length, 0)
  // pedido cruzado vira amizade na hora
  await agir(deps, BIA, { action: 'request', handle: 'ana' })
  assert.equal(((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { status: string }).status, 'accepted')
  // silenciar: chega, mas nao conta no selo
  await enviar(deps, ANA, { to: idBia, text: 'um', cid: cid() })
  assert.equal((await contar(deps, BIA)).unread, 1)
  await agir(deps, BIA, { action: 'mute', id: idAna })
  const t = await inicio(deps, BIA)
  assert.deepEqual([t.unread, t.friends[0]!.muted, t.friends[0]!.unread], [0, true, 1])
  await agir(deps, BIA, { action: 'unmute', id: idAna })
  assert.equal((await contar(deps, BIA)).unread, 1)
  // denuncia com teto por dia, guardando o contexto
  for (let i = 0; i < 5; i++) assert.equal(((await agir(deps, BIA, { action: 'report', id: idAna, reason: 'spam' })) as { ok: boolean }).ok, true)
  assert.deepEqual(await agir(deps, BIA, { action: 'report', id: idAna, reason: 'spam' }), { ok: false, why: 'report_cap' })
  const den = await db.sql('select reason, jsonb_array_length(context) as n from public.dogcity_phone_report limit 1')
  assert.deepEqual([den[0]!.reason, den[0]!.n], ['spam', 1])
  // teto por minuto no banco
  const r1 = await db.rpc('dogcity_phone_send', { p_me: idAna, p_other: idBia, p_body: 'dois', p_cid: cid(), p_cap_min: 2 })
  const r2 = await db.rpc('dogcity_phone_send', { p_me: idAna, p_other: idBia, p_body: 'tres', p_cid: cid(), p_cap_min: 2 })
  assert.deepEqual([(r1 as { status: string }).status, (r2 as { status: string }).status], ['ok', 'rate'])
  // remover a amizade fecha a conversa para os dois
  assert.equal(((await agir(deps, ANA, { action: 'remove', id: idBia })) as { ok: boolean }).ok, true)
  assert.deepEqual(await enviar(deps, BIA, { to: idAna, text: 'ei', cid: cid() }), { ok: false, why: 'not_friends' })
  // teto de pedidos pendentes
  await db.sql(`insert into public.dogcity_profiles (address, handle) select 'bc1q' || lpad(g::text, 38, '0'), 'alvo_' || g from generate_series(1, 25) g`)
  let ultimo = ''
  for (let g = 1; g <= 21; g++) ultimo = ((await agir(deps, CAIO, { action: 'request', handle: `alvo_${g}` })) as { status?: string; why?: string }).why ?? 'ok'
  assert.equal(ultimo, 'cap_pending')
  await db.fechar()
})

test('trocar o handle nao perde a conversa; conta sem handle nao e achada; nomes parecidos nao se fundem', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const idBia = ((await agir(deps, ANA, { action: 'request', handle: 'bia' })) as { id: string }).id
  const idAna = (await inicio(deps, ANA)).me.id
  await agir(deps, BIA, { action: 'accept', id: idAna })
  await enviar(deps, ANA, { to: idBia, text: 'guarda isso', cid: cid() })
  await db.sql(`update public.dogcity_profiles set handle = 'beatriz' where address = $1`, [BIA])
  const t = await inicio(deps, ANA)
  assert.deepEqual(t.friends.map((f) => [f.id, f.handle, f.last?.text]), [[idBia, 'beatriz', 'guarda isso']])
  const h = await historico(deps, BIA, { with: idAna, before: null, limit: 5 })
  assert.equal(h.ok ? h.messages.length : 0, 1)
  // outra carteira pega o handle antigo: e' OUTRA conta, sem a conversa
  await db.sql(`insert into public.dogcity_profiles (address, handle) values ($1, 'bia')`, [DUDA])
  const nova = await buscar(deps, ANA, 'bia')
  assert.deepEqual(nova.ok && nova.found ? [nova.relation, nova.profile.id] : null, ['none', null])
  const telaDuda = await inicio(deps, DUDA)
  assert.notEqual(telaDuda.me.id, idBia)
  assert.deepEqual([telaDuda.friends.length, telaDuda.unread], [0, 0])
  // conta sem handle (so' carteira): existe, mas ninguem a acha pela busca
  const semHandle = 'bc1p' + 'e'.repeat(58)
  assert.equal((await inicio(deps, semHandle)).me.handle, null)
  await db.fechar()
})

test('HTTP: sessao, mesma origem, JSON e o corpo que nunca diz quem e', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const porta: PortaHttp = {
    sessao: async (req) => ({ ana: ANA, bia: BIA, caio: CAIO })[req.headers.get('x-teste') ?? ''] ?? null,
    freioIp: async () => false,
    freioConta: async () => false,
    lerCorpo: async (req) => {
      try {
        return { ok: true, valor: JSON.parse(await req.text()) }
      } catch {
        return { ok: false, status: 400 }
      }
    },
  }
  const pedir = (caminho: string, quem: string | null, corpo?: unknown, extra: Record<string, string> = {}): Request =>
    new Request(`http://x${caminho}`, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: { ...(quem ? { 'x-teste': quem } : {}), ...(corpo === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  assert.equal((await getPhone(pedir('/api/dogcity/phone', null), porta, deps)).status, 401)
  assert.equal((await getPhone(pedir('/api/dogcity/phone', 'ana', undefined, { 'sec-fetch-site': 'cross-site' }), porta, deps)).status, 403)
  const eu = await getPhone(pedir('/api/dogcity/phone', 'ana'), porta, deps)
  assert.equal(eu.headers.get('cache-control'), 'no-store')
  const idAna = ((await eu.json()) as { me: { id: string } }).me.id
  const b = (await (await getSearch(pedir('/api/dogcity/phone/search?handle=bia', 'ana'), porta, deps)).json()) as { found: boolean; relation: string }
  assert.deepEqual([b.found, b.relation], [true, 'none'])
  const ped = (await (await postFriends(pedir('/api/dogcity/phone/friends', 'ana', { action: 'request', handle: 'bia' }), porta, deps)).json()) as { id: string }
  // o corpo tenta se passar por bia: `from`, `me` e `address` nem sao lidos
  const falso = await postMessages(pedir('/api/dogcity/phone/messages', 'caio', { to: idAna, from: ped.id, me: ped.id, address: BIA, text: 'sou a bia', cid: cid() }), porta, deps)
  assert.equal(falso.status, 403)
  assert.equal((await postFriends(pedir('/api/dogcity/phone/friends', 'bia', { action: 'accept', id: idAna }), porta, deps)).status, 200)
  const env = await postMessages(pedir('/api/dogcity/phone/messages', 'ana', { to: ped.id, text: 'oi', cid: cid() }), porta, deps)
  assert.equal(env.status, 200)
  assert.equal((await postMessages(pedir('/api/dogcity/phone/messages', 'ana', { to: ped.id, text: 'x'.repeat(501), cid: cid() }), porta, deps)).status, 422)
  assert.equal((await getMessages(pedir(`/api/dogcity/phone/messages?with=${idAna}`, 'caio'), porta, deps)).status, 403)
  assert.equal((await getMessages(pedir(`/api/dogcity/phone/messages?with=${ped.id}`, 'caio'), porta, deps)).status, 403)
  const hist = (await (await getMessages(pedir(`/api/dogcity/phone/messages?with=${idAna}`, 'bia'), porta, deps)).json()) as { messages: Array<{ text: string }> }
  assert.deepEqual(hist.messages.map((m) => m.text), ['oi'])
  assert.equal((await postMessages(new Request('http://x/api/dogcity/phone/messages', { method: 'POST', headers: { 'x-teste': 'ana' }, body: 'to=1' }), porta, deps)).status, 415)
  await db.fechar()
})
