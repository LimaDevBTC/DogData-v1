// Rodar: PGLITE=/caminho/node_modules/@electric-sql/pglite/dist/index.js npx tsx --test lib/phone/fotos.sql.test.ts
// As fotos da Câmera do DOG Phone: a limpeza do JPEG (pura) e a galeria contra o SQL DE VERDADE da 048 (PGlite), com o
// armazém em memória. Sem `PGLITE` os testes de SQL são PULADOS: não valem como aprovados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { apagarFoto, guardarFoto, lerFoto, limparJpeg, LIMITES_FOTO, listarFotos, type Armazem } from './fotos'
import { inicio, type PhoneDeps } from './service'
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
