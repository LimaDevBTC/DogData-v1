// Rodar: PGLITE=/caminho/node_modules/@electric-sql/pglite/dist/index.js npx tsx --test lib/phone/fotos.sql.test.ts
// As fotos da Câmera do DOG Phone: a limpeza do JPEG (pura) e a galeria contra o SQL DE VERDADE da 048 (PGlite), com o
// armazém em memória. Sem `PGLITE` os testes de SQL são PULADOS: não valem como aprovados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { apagarFoto, guardarFoto, lerFoto, limparJpeg, LIMITES_FOTO, listarFotos, type Armazem } from './fotos'
import { agirMural, feed } from './extra'
import { agir, inicio, type PhoneDeps } from './service'
import { abrirBancoLocal } from './sql-local'

const PGLITE = process.env.PGLITE
const pular = PGLITE ? false : 'sem PGLITE: o SQL da 048 NAO foi exercitado'
const ANA = 'bc1p' + 'a'.repeat(58)
const BIA = 'bc1p' + 'b'.repeat(58)

const seg = (marca: number, corpo: number[]): number[] => [0xff, marca, ((corpo.length + 2) >> 8) & 255, (corpo.length + 2) & 255, ...corpo]
/** um JPEG de estrutura valida (o servidor confere a estrutura, nao decodifica): com EXIF e comentario para tirar */
function jpeg(w: number, h: number, extra: number[] = []): Uint8Array {
  const exif = seg(0xe1, [...Buffer.from('Exif\0\0GPS: -23.5,-46.6 segredo')])
  const coment = seg(0xfe, [...Buffer.from('feito no aparelho X')])
  const jfif = seg(0xe0, [...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])
  const dqt = seg(0xdb, [0, ...Array(64).fill(8)])
  const sof = seg(0xc0, [8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0])
  const dht = seg(0xc4, [0, ...Array(16).fill(0)])
  const sos = seg(0xda, [1, 1, 0, 0, 63, 0])
  return new Uint8Array([0xff, 0xd8, ...jfif, ...exif, ...coment, ...dqt, ...sof, ...dht, ...extra, ...sos, ...Array(80).fill(0x55), 0xff, 0xd9])
}

function armazem(): Armazem & { arquivos: Map<string, Uint8Array> } {
  const arquivos = new Map<string, Uint8Array>()
  return {
    arquivos,
    gravar: async (c, b) => void arquivos.set(c, b),
    ler: async (c) => arquivos.get(c) ?? null,
    apagar: async (c) => void arquivos.delete(c),
  }
}

test('limparJpeg: le as medidas, tira EXIF e comentario, recusa o que nao e JPEG, o grande e o de medida errada', () => {
  const r = limparJpeg(jpeg(960, 1280))
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual([r.w, r.h], [960, 1280])
  const texto = Buffer.from(r.bytes).toString('latin1')
  assert.ok(!texto.includes('Exif') && !texto.includes('segredo') && !texto.includes('aparelho X'), 'metadado saiu')
  assert.ok(texto.includes('JFIF') && r.bytes[0] === 0xff && r.bytes[1] === 0xd8 && r.bytes[r.bytes.length - 1] === 0xd9)
  assert.ok(r.bytes.length < jpeg(960, 1280).length)
  const png = new Uint8Array(400).fill(7)
  png.set([0x89, 0x50, 0x4e, 0x47])
  assert.deepEqual(limparJpeg(png), { ok: false, why: 'not_jpeg' })
  assert.deepEqual(limparJpeg(new Uint8Array(20)), { ok: false, why: 'not_jpeg' })
  assert.deepEqual(limparJpeg(jpeg(960, 1280).subarray(0, 150)), { ok: false, why: 'not_jpeg' }) // cortado: sem o fim
  assert.deepEqual(limparJpeg(jpeg(4000, 3000)), { ok: false, why: 'bad_size' })
  assert.deepEqual(limparJpeg(jpeg(20, 20)), { ok: false, why: 'bad_size' })
  assert.deepEqual(limparJpeg(new Uint8Array(LIMITES_FOTO.bytes + 1)), { ok: false, why: 'too_big' })
  // um segmento que nao e' de JPEG de foto (marca reservada) derruba o arquivo
  assert.deepEqual(limparJpeg(jpeg(960, 1280, seg(0x01, [1, 2, 3]))), { ok: false, why: 'not_jpeg' })
})

test('galeria: guardar, listar, ler so a dona, apagar tira o arquivo, teto do dia', { skip: pular }, async () => {
  const db = await abrirBancoLocal(PGLITE!)
  await db.sql(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'bia')`, [ANA, BIA])
  const deps: PhoneDeps = { rpc: db.rpc, segredo: 'teste' }
  await inicio(deps, ANA)
  await inicio(deps, BIA)
  const arm = armazem()
  const f1 = await guardarFoto(deps, arm, ANA, jpeg(960, 1280), 'selfie')
  const f2 = await guardarFoto(deps, arm, ANA, jpeg(960, 1280), 'qualquer')
  assert.ok(f1.ok && f2.ok)
  if (!f1.ok || !f2.ok) return
  assert.deepEqual([f1.photo.kind, f2.photo.kind, f1.photo.w, f1.photo.h], ['selfie', 'front', 960, 1280])
  assert.equal(arm.arquivos.size, 2)
  // o caminho do arquivo nao leva a carteira, e o que foi gravado ja' esta' sem metadado
  for (const [caminho, bytes] of arm.arquivos) {
    assert.ok(!caminho.includes(ANA) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(caminho), caminho)
    assert.ok(!Buffer.from(bytes).toString('latin1').includes('segredo'))
  }
  const lista = await listarFotos(deps, ANA, null)
  assert.deepEqual(lista.ok ? lista.photos.map((p) => [p.id, p.kind]) : [], [[f2.photo.id, 'front'], [f1.photo.id, 'selfie']])
  assert.ok(!JSON.stringify(lista).includes(ANA) && !JSON.stringify(lista).includes('.jpg'), 'a lista nao traz carteira nem caminho')
  // a bia nao ve nem le nem apaga foto da ana
  const daBia = await listarFotos(deps, BIA, null)
  assert.deepEqual(daBia.ok ? daBia.photos : null, [])
  assert.deepEqual(await lerFoto(deps, arm, BIA, f1.photo.id), { ok: false, why: 'not_found' })
  assert.deepEqual(await apagarFoto(deps, arm, BIA, f1.photo.id), { ok: false, why: 'not_found' })
  const lida = await lerFoto(deps, arm, ANA, f1.photo.id)
  assert.ok(lida.ok && lida.bytes[0] === 0xff && lida.bytes[1] === 0xd8)
  assert.deepEqual(await lerFoto(deps, arm, ANA, 'x'), { ok: false, why: 'invalid_id' })
  // recusada antes de gravar: nada vai para o armazem
  assert.deepEqual(await guardarFoto(deps, arm, ANA, new Uint8Array(300).fill(1), 'front'), { ok: false, why: 'not_jpeg' })
  assert.equal(arm.arquivos.size, 2)
  // apagar: some da lista, do armazem e nao se le mais
  assert.deepEqual(await apagarFoto(deps, arm, ANA, f1.photo.id), { ok: true, id: f1.photo.id })
  assert.equal(arm.arquivos.size, 1)
  assert.deepEqual(await lerFoto(deps, arm, ANA, f1.photo.id), { ok: false, why: 'not_found' })
  const depois = await listarFotos(deps, ANA, null)
  assert.deepEqual(depois.ok ? depois.photos.map((p) => p.id) : [], [f2.photo.id])
  // teto do dia: a foto recusada pelo teto nao deixa arquivo orfao
  await db.sql(`insert into public.dogcity_phone_photo (owner, path, bytes, w, h, kind) select owner, 'x/' || g, 10, 100, 100, 'front' from public.dogcity_phone_photo, generate_series(1, $1) g where id = $2`, [LIMITES_FOTO.dia, f2.photo.id])
  assert.deepEqual(await guardarFoto(deps, arm, ANA, jpeg(960, 1280), 'front'), { ok: false, why: 'cap_day' })
  assert.equal(arm.arquivos.size, 1)
  await db.fechar()
})

test('foto em post do Social City: so foto propria, quem ve o post ve a foto, bloqueio e apagar tiram', { skip: pular }, async () => {
  const db = await abrirBancoLocal(PGLITE!)
  await db.sql(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'bia')`, [ANA, BIA])
  const deps: PhoneDeps = { rpc: db.rpc, segredo: 'teste' }
  await inicio(deps, ANA)
  const idBia = (await inicio(deps, BIA)).me.id
  const arm = armazem()
  const f = await guardarFoto(deps, arm, ANA, jpeg(960, 1280), 'selfie')
  assert.ok(f.ok)
  if (!f.ok) return
  const idFoto = f.photo.id
  // antes de publicar a foto e' so' da ana
  assert.deepEqual(await lerFoto(deps, arm, BIA, idFoto), { ok: false, why: 'not_found' })
  // a bia nao publica com a foto da ana; sem texto e sem foto nao ha' post
  assert.deepEqual(await agirMural(deps, BIA, { action: 'post', text: 'roubada', photo: idFoto }), { ok: false, why: 'not_found' })
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: '' }), { ok: false, why: 'empty' })
  assert.deepEqual(await agirMural(deps, ANA, { action: 'post', text: 'x', photo: 'abc' }), { ok: false, why: 'invalid_id' })
  // a ana publica so' a foto (sem texto)
  const p = await agirMural(deps, ANA, { action: 'post', text: '', photo: idFoto })
  assert.ok(p.ok && p.id)
  const fb = await feed(deps, BIA, { before: null, author: null })
  assert.deepEqual(fb.ok ? fb.posts.map((x) => [x.text, x.photo, x.author.handle]) : [], [['', idFoto, 'ana']])
  // agora a bia, que ve o post, baixa a foto
  const lida = await lerFoto(deps, arm, BIA, idFoto)
  assert.ok(lida.ok && lida.bytes[0] === 0xff)
  // a foto continua fora da galeria da bia, e ela nao apaga
  const galBia = await listarFotos(deps, BIA, null)
  assert.deepEqual(galBia.ok ? galBia.photos : null, [])
  assert.deepEqual(await apagarFoto(deps, arm, BIA, idFoto), { ok: false, why: 'not_found' })
  // bloqueio: a ana bloqueia a bia; a bia perde o post e a foto
  await agir(deps, ANA, { action: 'block', id: idBia })
  assert.deepEqual(await lerFoto(deps, arm, BIA, idFoto), { ok: false, why: 'not_found' })
  await agir(deps, ANA, { action: 'unblock', id: idBia })
  assert.ok((await lerFoto(deps, arm, BIA, idFoto)).ok)
  // a ana apaga a foto da galeria: o post fica, sem imagem, e o arquivo some
  assert.ok((await apagarFoto(deps, arm, ANA, idFoto)).ok)
  const fb2 = await feed(deps, BIA, { before: null, author: null })
  assert.deepEqual(fb2.ok ? fb2.posts.map((x) => x.photo) : [], [null])
  assert.deepEqual(await lerFoto(deps, arm, BIA, idFoto), { ok: false, why: 'not_found' })
  assert.equal(arm.arquivos.size, 0)
  // apagar o POST tambem tira o acesso de quem nao e' a dona
  await db.sql(`update public.dogcity_phone_post set created_at = now() - interval '1 hour'`, [])
  const f2 = await guardarFoto(deps, arm, ANA, jpeg(960, 1280), 'front')
  const p2 = await agirMural(deps, ANA, { action: 'post', text: 'com legenda', photo: f2.ok ? f2.photo.id : 0 })
  assert.ok(f2.ok && p2.ok && (await lerFoto(deps, arm, BIA, f2.photo.id)).ok)
  if (!f2.ok || !p2.ok) return
  assert.ok((await agirMural(deps, ANA, { action: 'delete', id: p2.id! })).ok)
  assert.deepEqual(await lerFoto(deps, arm, BIA, f2.photo.id), { ok: false, why: 'not_found' })
  assert.ok((await lerFoto(deps, arm, ANA, f2.photo.id)).ok, 'a dona continua com a foto na galeria')
  await db.fechar()
})


test('foto de perfil (049): troca, aparece no cartao, quem ve o perfil le, bloqueio tira, galeria nao mostra, tirar apaga', { skip: pular }, async () => {
  const { tirarAvatar, trocarAvatar } = await import('./fotos')
  const db = await abrirBancoLocal(PGLITE!)
  await db.sql(`insert into public.dogcity_profiles (address, handle) values ($1,'ana'),($2,'bia')`, [ANA, BIA])
  const deps: PhoneDeps = { rpc: db.rpc, segredo: 'teste' }
  const eu = await inicio(deps, ANA)
  assert.equal(eu.me.photo, null, 'sem foto: o cartao diz null (e o jogo sabe que o servidor ja tem a 049)')
  const idBia = (await inicio(deps, BIA)).me.id
  const arm = armazem()
  const a1 = await trocarAvatar(deps, arm, ANA, jpeg(512, 512))
  assert.ok(a1.ok && a1.photo.kind === 'avatar')
  if (!a1.ok) return
  // o cartao da ana (para ela e para a bia, no feed e no inicio) leva a foto
  assert.equal((await inicio(deps, ANA)).me.photo, a1.photo.id)
  await agirMural(deps, ANA, { action: 'post', text: 'oi' })
  const fb = await feed(deps, BIA, { before: null, author: null })
  assert.deepEqual(fb.ok ? fb.posts.map((x) => x.author.photo) : [], [a1.photo.id])
  // a bia, que ve o perfil, baixa a foto; a foto de perfil nao aparece na galeria da ana e nao sai por "apagar da galeria"
  assert.ok((await lerFoto(deps, arm, BIA, a1.photo.id)).ok)
  const gal = await listarFotos(deps, ANA, null)
  assert.deepEqual(gal.ok ? gal.photos : null, [])
  assert.deepEqual(await apagarFoto(deps, arm, ANA, a1.photo.id), { ok: false, why: 'not_found' })
  // bloqueio: a bia perde a foto; desbloqueio devolve
  await agir(deps, ANA, { action: 'block', id: idBia })
  assert.deepEqual(await lerFoto(deps, arm, BIA, a1.photo.id), { ok: false, why: 'not_found' })
  await agir(deps, ANA, { action: 'unblock', id: idBia })
  assert.ok((await lerFoto(deps, arm, BIA, a1.photo.id)).ok)
  // trocar: a anterior some do bucket e de quem lia; a bia nao usa a foto da ana como dela
  const a2 = await trocarAvatar(deps, arm, ANA, jpeg(400, 400))
  assert.ok(a2.ok)
  if (!a2.ok) return
  assert.equal(arm.arquivos.size, 1)
  assert.deepEqual(await lerFoto(deps, arm, BIA, a1.photo.id), { ok: false, why: 'not_found' })
  assert.equal((await inicio(deps, ANA)).me.photo, a2.photo.id)
  assert.equal(((await db.rpc('dogcity_phone_avatar_set', { p_me: idBia, p_photo: a2.photo.id })) as { status: string }).status, 'not_found')
  // uma foto comum da galeria nao vira foto de perfil por esse caminho
  const comum = await guardarFoto(deps, arm, ANA, jpeg(960, 1280), 'front')
  const idAna = (await inicio(deps, ANA)).me.id
  assert.equal(((await db.rpc('dogcity_phone_avatar_set', { p_me: idAna, p_photo: comum.ok ? comum.photo.id : 0 })) as { status: string }).status, 'not_found')
  // arquivo que nao e' JPEG: recusado, a foto de perfil continua a mesma
  assert.deepEqual(await trocarAvatar(deps, arm, ANA, new Uint8Array(300).fill(1)), { ok: false, why: 'not_jpeg' })
  assert.equal((await inicio(deps, ANA)).me.photo, a2.photo.id)
  // tirar: volta a null e o arquivo sai
  assert.deepEqual(await tirarAvatar(deps, arm, ANA), { ok: true })
  assert.equal((await inicio(deps, ANA)).me.photo, null)
  assert.deepEqual(await lerFoto(deps, arm, BIA, a2.photo.id), { ok: false, why: 'not_found' })
  assert.equal(arm.arquivos.size, 1, 'so a foto comum da galeria ficou')
  await db.fechar()
})
