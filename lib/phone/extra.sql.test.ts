// Rodar: PGLITE=/caminho/node_modules/@electric-sql/pglite/dist/index.js npx tsx --test lib/phone/extra.sql.test.ts
// Ligações e Mural do DOG Phone contra o SQL DE VERDADE das migrações 046 + 047 (PGlite), com três contas.
// Sem `PGLITE` os testes são PULADOS: não valem como aprovados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { agirChamada, agirMural, feed, historicoChamadas, lerSdp, sondar } from './extra'
import { agir, inicio, type PhoneDeps } from './service'
import { abrirBancoLocal } from './sql-local'

const PGLITE = process.env.PGLITE
const pular = PGLITE ? false : 'sem PGLITE: o SQL da 047 NAO foi exercitado'
const ANA = 'bc1p' + 'a'.repeat(58)
const BIA = 'bc1p' + 'b'.repeat(58)
const CAIO = 'bc1p' + 'c'.repeat(58)
const SDP = (quem: string): string => `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=${quem}\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\n`

async function cenario() {
  const db = await abrirBancoLocal(PGLITE!)
  await db.sql(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'bia'),($3,'caio')`, [ANA, BIA, CAIO])
  const deps: PhoneDeps = { rpc: db.rpc, segredo: 'teste' }
  const id = { ana: (await inicio(deps, ANA)).me.id, bia: (await inicio(deps, BIA)).me.id, caio: (await inicio(deps, CAIO)).me.id }
  const amigos = async (a: string, handleB: string, b: string, idA: string) => {
    await agir(deps, a, { action: 'request', handle: handleB })
    await agir(deps, b, { action: 'accept', id: idA })
  }
  await amigos(ANA, 'bia', BIA, id.ana)
  return { db, deps, id, amigos }
}

test('SDP: so audio, so ASCII, com teto', () => {
  assert.ok(lerSdp(SDP('x')))
  for (const ruim of [null, 'oi', 'v=0\r\nm=video 9 X\r\n' + 'a'.repeat(40), SDP('x') + 'm=video 9 UDP 96\r\n', SDP('x') + '\u0000', 'v=0' + 'a'.repeat(30000)]) assert.equal(lerSdp(ruim), null)
})

test('ligar, tocar do outro lado, atender, desligar; a terceira conta fica de fora', { skip: pular }, async () => {
  const { db, deps, id } = await cenario()
  // caio nao e' amigo de ninguem: nao liga
  assert.deepEqual(await agirChamada(deps, CAIO, { action: 'start', to: id.bia, offer: SDP('caio') }), { ok: false, why: 'not_friends' })
  const lig = await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('ana') })
  assert.ok(lig.ok && lig.id && lig.nudge === (await sondar(deps, BIA)).nudge, 'ligar devolve a cutucada de quem recebe')
  const idCh = lig.ok ? lig.id! : ''
  // bia ve a chamada tocando, com a oferta; ana ve a propria chamada SEM a oferta de volta e sem resposta ainda
  const vb = await sondar(deps, BIA)
  assert.deepEqual([vb.call?.state, vb.call?.incoming, vb.call?.peer.handle, vb.call?.offer === SDP('ana')], ['ringing', true, 'ana', true])
  const va = await sondar(deps, ANA)
  assert.deepEqual([va.call?.state, va.call?.incoming, va.call?.offer, va.call?.answer], ['ringing', false, null, null])
  assert.ok(!JSON.stringify(vb).includes(ANA) && !JSON.stringify(va).includes(BIA), 'a chamada nunca traz carteira')
  // caio nao ve, nao atende e nao encerra a chamada das duas
  assert.equal((await sondar(deps, CAIO)).call, null)
  assert.deepEqual(await agirChamada(deps, CAIO, { action: 'answer', id: idCh, answer: SDP('caio') }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agirChamada(deps, CAIO, { action: 'end', id: idCh }), { ok: false, why: 'not_found' })
  // quem ligou nao atende a propria chamada; ocupado para os dois lados
  assert.deepEqual(await agirChamada(deps, ANA, { action: 'answer', id: idCh, answer: SDP('ana') }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('ana') }), { ok: false, why: 'busy_self' })
  assert.deepEqual(await agirChamada(deps, BIA, { action: 'start', to: id.ana, offer: SDP('bia') }), { ok: false, why: 'busy_self' })
  // atender
  const at = await agirChamada(deps, BIA, { action: 'answer', id: idCh, answer: SDP('bia') })
  assert.ok(at.ok && at.nudge === va.nudge, 'atender devolve a cutucada de quem ligou')
  const va2 = await sondar(deps, ANA)
  assert.deepEqual([va2.call?.state, va2.call?.answer === SDP('bia')], ['active', true])
  assert.equal((await sondar(deps, BIA)).call?.offer, null, 'depois de atender a oferta nao e reenviada')
  // desligar apaga a sinalizacao do banco
  assert.ok((await agirChamada(deps, ANA, { action: 'end', id: idCh })).ok)
  const linha = await db.sql('select state, reason, offer, answer from public.dogcity_phone_call')
  assert.deepEqual(linha[0], { state: 'ended', reason: 'hangup', offer: null, answer: null })
  assert.equal((await sondar(deps, BIA)).call, null)
  const log = await historicoChamadas(deps, BIA)
  assert.deepEqual(log.calls.map((c) => [c.incoming, c.peer.handle, c.result]), [[true, 'ana', 'talked']])
  assert.deepEqual((await historicoChamadas(deps, CAIO)).calls, [])
  await db.fechar()
})

test('recusar, cancelar, perdida, ocupado', { skip: pular }, async () => {
  const { db, deps, id, amigos } = await cenario()
  await amigos(CAIO, 'bia', BIA, id.caio)
  // recusa
  const c1 = (await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('a') })) as { id: string }
  assert.ok((await agirChamada(deps, BIA, { action: 'end', id: c1.id })).ok)
  assert.deepEqual((await sondar(deps, ANA)).last, { id: c1.id, reason: 'declined', incoming: false })
  // ocupado: bia em chamada com ana, caio liga
  const c2 = (await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('a') })) as { id: string }
  assert.deepEqual(await agirChamada(deps, CAIO, { action: 'start', to: id.bia, offer: SDP('c') }), { ok: false, why: 'busy' })
  // cancelar (quem ligou desiste enquanto toca)
  assert.ok((await agirChamada(deps, ANA, { action: 'end', id: c2.id })).ok)
  assert.equal((await sondar(deps, BIA)).call, null)
  // perdida: ninguem atende ate' o tempo do toque
  await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('a') })
  await db.sql(`update public.dogcity_phone_call set created_at = now() - interval '2 minutes' where state = 'ringing'`)
  const vb = await sondar(deps, BIA)
  assert.deepEqual([vb.call, vb.missed], [null, 1])
  const log = await historicoChamadas(deps, BIA)
  assert.ok(log.calls.some((c) => c.result === 'missed'))
  assert.equal((await sondar(deps, BIA)).missed, 0, 'ver a lista marca as perdidas como vistas')
  assert.ok((await historicoChamadas(deps, ANA)).calls.some((c) => c.result === 'no_answer'))
  await db.fechar()
})

test('nao perturbe e silencio: nao toca, vira perdida, e quem liga nao fica sabendo', { skip: pular }, async () => {
  const { db, deps, id } = await cenario()
  await agirChamada(deps, BIA, { action: 'dnd', on: true })
  assert.equal((await sondar(deps, BIA)).dnd, true)
  const lig = await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('a') })
  assert.ok(lig.ok && lig.nudge === undefined, 'sem cutucada: nada toca do outro lado')
  assert.equal((await sondar(deps, BIA)).call, null)
  assert.equal((await sondar(deps, ANA)).call?.state, 'ringing', 'para quem liga parece uma chamada tocando')
  assert.deepEqual(await agirChamada(deps, BIA, { action: 'answer', id: (lig as { id: string }).id, answer: SDP('b') }), { ok: false, why: 'not_found' })
  await db.sql(`update public.dogcity_phone_call set created_at = now() - interval '2 minutes' where state = 'ringing'`)
  assert.deepEqual((await sondar(deps, ANA)).last?.reason, 'missed')
  assert.equal((await historicoChamadas(deps, BIA)).calls[0]!.result, 'missed', 'a perdida aparece na lista de quem estava em nao perturbe')
  // silencio (046) tem o mesmo efeito, mesmo sem nao perturbe
  await agirChamada(deps, BIA, { action: 'dnd', on: false })
  await agir(deps, BIA, { action: 'mute', id: id.ana })
  const l2 = await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('a') })
  assert.ok(l2.ok && l2.nudge === undefined)
  assert.ok((await agirChamada(deps, ANA, { action: 'end', id: (l2 as { id: string }).id })).ok)
  // bloqueio: nem liga
  await agir(deps, BIA, { action: 'block', id: id.ana })
  assert.deepEqual(await agirChamada(deps, ANA, { action: 'start', to: id.bia, offer: SDP('a') }), { ok: false, why: 'not_friends' })
  await db.fechar()
})

test('mural: publicar, ver com outra conta, curtir, apagar so o proprio, bloqueio some, sem handle nao publica', { skip: pular }, async () => {
  const { db, deps, id } = await cenario()
  const p1 = await agirMural(deps, ANA, { action: 'post', text: '  primeiro post  ' })
  assert.ok(p1.ok && p1.id)
  const idPost = p1.ok ? p1.id! : 0
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: 'rapido demais' }), { ok: false, why: 'rate' })
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: '   ' }), { ok: false, why: 'empty' })
  // caio (que nao e' amigo de ninguem) ve: o mural e' publico entre as contas do celular
  const fc = await feed(deps, CAIO, { before: null, author: null })
  assert.ok(fc.ok)
  assert.deepEqual(fc.ok ? fc.posts.map((p) => [p.text, p.author.handle, p.mine, p.likes, p.liked]) : [], [['primeiro post', 'ana', false, 0, false]])
  assert.ok(!JSON.stringify(fc).includes(ANA), 'o feed nunca traz carteira')
  // curtir uma vez por conta
  await agirMural(deps, CAIO, { action: 'like', id: idPost })
  const l2 = await agirMural(deps, CAIO, { action: 'like', id: idPost })
  assert.deepEqual([l2.ok && l2.likes, l2.ok && l2.liked], [1, true])
  await agirMural(deps, BIA, { action: 'like', id: idPost })
  const fa = await feed(deps, ANA, { before: null, author: null })
  assert.deepEqual(fa.ok ? [fa.posts[0]!.likes, fa.posts[0]!.liked, fa.posts[0]!.mine] : [], [2, false, true])
  assert.equal(((await agirMural(deps, CAIO, { action: 'like', id: idPost, on: false })) as { likes: number }).likes, 1)
  // apagar e denunciar: so' o autor apaga; ninguem denuncia o proprio post
  assert.deepEqual(await agirMural(deps, CAIO, { action: 'delete', id: idPost }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agirMural(deps, ANA, { action: 'report', id: idPost }), { ok: false, why: 'not_found' })
  assert.ok((await agirMural(deps, CAIO, { action: 'report', id: idPost, reason: 'spam' })).ok)
  // perfil: so' os posts de uma conta
  await db.sql(`insert into public.dogcity_phone_post (author, body) values ($1, 'post da bia')`, [id.bia])
  const perfil = await feed(deps, CAIO, { before: null, author: id.bia })
  assert.deepEqual(perfil.ok ? perfil.posts.map((p) => p.text) : [], ['post da bia'])
  // bloqueio: bia bloqueia caio; nenhum dos dois ve o outro no feed, e caio nao curte post dela
  const idBiaPost = perfil.ok ? perfil.posts[0]!.id : 0
  await agir(deps, BIA, { action: 'block', id: id.caio })
  const fc2 = await feed(deps, CAIO, { before: null, author: null })
  assert.deepEqual(fc2.ok ? fc2.posts.map((p) => p.author.handle) : [], ['ana'])
  assert.deepEqual(await agirMural(deps, CAIO, { action: 'like', id: idBiaPost }), { ok: false, why: 'not_found' })
  // paginacao
  await db.sql(`insert into public.dogcity_phone_post (author, body) select $1, 'p' || g from generate_series(1, 45) g`, [id.ana])
  const pg1 = await feed(deps, CAIO, { before: null, author: null })
  assert.ok(pg1.ok && pg1.posts.length === 20 && pg1.more && pg1.posts[0]!.text === 'p45')
  const pg2 = await feed(deps, CAIO, { before: pg1.ok ? pg1.posts[19]!.id : 0, author: null })
  assert.ok(pg2.ok && pg2.posts[0]!.text === 'p25')
  // apagar o proprio: some do feed
  assert.ok((await agirMural(deps, ANA, { action: 'delete', id: idPost })).ok)
  const fim = await feed(deps, ANA, { before: null, author: id.ana })
  assert.ok(fim.ok && !fim.posts.some((p) => p.id === idPost))
  // conta sem handle le, mas nao publica
  const sem = 'bc1p' + 'e'.repeat(58)
  assert.deepEqual(await agirMural(deps, sem, { action: 'post', text: 'oi' }), { ok: false, why: 'no_handle' })
  assert.ok((await feed(deps, sem, { before: null, author: null })).ok)
  await db.fechar()
})

test('mural: responder a um post (um nivel), o feed conta as respostas e o fio as mostra', { skip: pular }, async () => {
  const { db, deps } = await cenario()
  const raiz = await agirMural(deps, ANA, { action: 'post', text: 'post da ana' })
  const idRaiz = raiz.ok ? raiz.id! : 0
  const r1 = await agirMural(deps, BIA, { action: 'post', text: 'resposta da bia', reply: idRaiz })
  assert.ok(r1.ok && r1.id)
  assert.ok((await agirMural(deps, CAIO, { action: 'post', text: 'resposta do caio', reply: idRaiz })).ok)
  // o feed traz so' o post, com a contagem; as respostas nao aparecem soltas
  const f = await feed(deps, CAIO, { before: null, author: null })
  assert.deepEqual(f.ok ? f.posts.map((p) => [p.text, p.replies, p.replyTo]) : [], [['post da ana', 2, null]])
  // o fio: o post e as respostas a ele
  const fio = await feed(deps, ANA, { before: null, author: null, thread: idRaiz })
  assert.deepEqual(fio.ok ? fio.posts.map((p) => [p.text, p.replyTo]).reverse() : [], [['post da ana', null], ['resposta da bia', idRaiz], ['resposta do caio', idRaiz]])
  // nao ha' resposta de resposta, nem resposta a post que nao existe ou com id torto
  await db.sql(`update public.dogcity_phone_post set created_at = now() - interval '1 hour'`, [])
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: 'neta', reply: r1.ok ? r1.id : 0 }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: 'nada', reply: 999999 }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: 'torto', reply: 'x' }), { ok: false, why: 'invalid_id' })
  // bloqueio: a bia bloqueia o caio; ele nao responde ao post dela, e a ana deixa de... continua vendo as duas respostas
  const pb = await agirMural(deps, BIA, { action: 'post', text: 'post da bia' })
  await agir(deps, BIA, { action: 'block', id: (await feed(deps, CAIO, { before: null, author: null }) as { me: { id: string } }).me.id })
  assert.deepEqual(await agirMural(deps, CAIO, { action: 'post', text: 'oi bia', reply: pb.ok ? pb.id : 0 }), { ok: false, why: 'not_found' })
  // para a bia, a resposta do caio some do fio e da contagem
  const fioBia = await feed(deps, BIA, { before: null, author: null, thread: idRaiz })
  assert.deepEqual(fioBia.ok ? fioBia.posts.map((p) => [p.text, p.replies]).reverse() : [], [['post da ana', 1], ['resposta da bia', 0]])
  // apagar a resposta: a contagem cai
  assert.ok((await agirMural(deps, BIA, { action: 'delete', id: r1.ok ? r1.id : 0 })).ok)
  const fim = await feed(deps, ANA, { before: null, author: null, thread: idRaiz })
  assert.deepEqual(fim.ok ? fim.posts.map((p) => [p.text, p.replies]).reverse() : [], [['post da ana', 1], ['resposta do caio', 0]])
  await db.fechar()
})

