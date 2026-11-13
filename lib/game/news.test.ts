// Rodar: npx tsx --test lib/game/news.test.ts
//
// A logica pura das novidades do jogo: texto (cortes, idiomas, "en" obrigatorio), publico, linha hostil do banco, janela de data,
// ordem, limite de 12, corpos dos POSTs e o estado da carteira. Mais a migration 040 trancada: a semente tem os 8 idiomas, cabe
// nos limites e nao tem travessao em lugar nenhum.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BODY_MAX,
  CTA_MAX,
  NEWS_LOCALES,
  NEWS_MAX,
  TITLE_MAX,
  activeNews,
  compareNews,
  cutText,
  isActive,
  normalizeAudience,
  normalizeCta,
  normalizeNewsRow,
  normalizeTexts,
  parseClickBody,
  parseSeenBody,
  walletNewsState,
} from './news'

const NOW = Date.parse('2026-11-13T12:00:00Z')
const T = { en: { title: 'Boats are here', body: 'Every licence comes with a boat.', cta: 'Go to the Marina' } }

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'marina-boats',
    tag: 'new',
    priority: 100,
    starts_at: '2026-11-13T00:00:00+00:00',
    ends_at: null,
    audience: ['all'],
    image: 'marina_barcos',
    cta: { destino: 'marina_publica' },
    texts: T,
    published: true,
    ...over,
  }
}

// ---- texto ----

test('cutText: corta em pontos de codigo, tira controle e espaco repetido, nao parte par substituto', () => {
  assert.equal(cutText('a'.repeat(70), TITLE_MAX).length, TITLE_MAX)
  assert.equal(cutText('  Hello \n\t world  ', 60), 'Hello world')
  assert.equal(cutText('x\u0000y\u007fz', 60), 'x y z')
  assert.equal(cutText(42, 60), '')
  assert.equal(cutText(undefined, 60), '')
  // 3 emojis (cada um 2 unidades UTF-16): cortar em 2 pontos de codigo deixa 2 emojis inteiros
  assert.equal(cutText('\u{1F436}\u{1F436}\u{1F436}', 2), '\u{1F436}\u{1F436}')
  // o corte nao deixa espaco sobrando no fim
  assert.equal(cutText('abc def', 4), 'abc')
})

test('normalizeTexts: exige en, corta nos limites, descarta idioma fora da lista ou incompleto', () => {
  const long = { title: 't'.repeat(100), body: 'b'.repeat(300), cta: 'c'.repeat(50) }
  const out = normalizeTexts({ en: long, 'pt-BR': T.en, xx: T.en, 'pt-br': T.en, fr: { title: 'so titulo' }, ja: 'texto' })
  assert.ok(out)
  assert.equal(out.en.title.length, TITLE_MAX)
  assert.equal(out.en.body.length, BODY_MAX)
  assert.equal(out.en.cta.length, CTA_MAX)
  assert.deepEqual(Object.keys(out).sort(), ['en', 'pt-BR'])
  assert.equal(normalizeTexts({ 'pt-BR': T.en }), null)
  assert.equal(normalizeTexts({ en: { title: 'x', body: '', cta: 'y' } }), null)
  assert.equal(normalizeTexts({ en: { title: 'x', body: 'y' } }), null)
  assert.equal(normalizeTexts({ en: { title: 1, body: 2, cta: 3 } }), null)
  for (const bad of [null, undefined, 'en', 5, [], [T.en], true]) assert.equal(normalizeTexts(bad), null)
})

test('normalizeTexts: o objeto de saida so tem idiomas da lista e nao herda chave do prototipo', () => {
  const out = normalizeTexts(JSON.parse('{"en":{"title":"a","body":"b","cta":"c"},"__proto__":{"title":"a","body":"b","cta":"c"},"constructor":{"title":"a","body":"b","cta":"c"}}'))
  assert.ok(out)
  assert.deepEqual(Object.keys(out), ['en'])
  assert.equal(({} as Record<string, unknown>).title, undefined)
})

// ---- publico e botao ----

test('normalizeAudience: so valores da lista, sem repetir, ordem canonica; vazio ou invalido vira null', () => {
  assert.deepEqual(normalizeAudience(['all']), ['all'])
  assert.deepEqual(normalizeAudience(['licence', 'lot', 'lot', 'nope', 7]), ['lot', 'licence'])
  assert.deepEqual(normalizeAudience(['guest', 'no_lot']), ['guest', 'no_lot'])
  for (const bad of [[], ['nope'], 'all', null, undefined, {}, [null]]) assert.equal(normalizeAudience(bad), null)
})

test('normalizeCta: so destino com id valido; o resto vira {} (card sem botao)', () => {
  assert.deepEqual(normalizeCta({ destino: 'marina_publica' }), { destino: 'marina_publica' })
  assert.deepEqual(normalizeCta({ destino: 'dog_motors', extra: 'x' }), { destino: 'dog_motors' })
  for (const bad of [{}, null, undefined, 'marina_publica', { destino: 3 }, { destino: 'Marina' }, { destino: '../x' }, { destino: 'a' }, { destino: '' }]) {
    assert.deepEqual(normalizeCta(bad), {})
  }
})

// ---- linha do banco ----

test('normalizeNewsRow: linha boa vira o formato publico (camelCase, datas ISO)', () => {
  const item = normalizeNewsRow(row({ starts_at: '2026-11-13T00:00:00.123456+00:00', ends_at: '2026-12-01T00:00:00Z' }))
  assert.deepEqual(item, {
    id: 'marina-boats',
    tag: 'new',
    priority: 100,
    startsAt: '2026-11-13T00:00:00.123Z',
    endsAt: '2026-12-01T00:00:00.000Z',
    audience: ['all'],
    image: 'marina_barcos',
    cta: { destino: 'marina_publica' },
    texts: T,
  })
})

test('normalizeNewsRow: linha hostil ou quebrada e descartada', () => {
  const bads: Record<string, unknown>[] = [
    { id: 'ab' },
    { id: 'Marina-Boats' },
    { id: '-marina' },
    { id: 'a'.repeat(65) },
    { id: 5 },
    { tag: 'hot' },
    { tag: undefined },
    { priority: '100' },
    { priority: NaN },
    { priority: Infinity },
    { image: 'Marina.webp' },
    { image: '../etc/passwd' },
    { image: 'ab' },
    { image: 'a'.repeat(65) },
    { starts_at: null },
    { starts_at: 'ontem' },
    { ends_at: 'amanha' },
    { ends_at: 12345 },
    { audience: [] },
    { audience: 'all' },
    { texts: null },
    { texts: { 'pt-BR': T.en } },
  ]
  for (const b of bads) assert.equal(normalizeNewsRow(row(b)), null, JSON.stringify(b))
  for (const bad of [null, undefined, 'x', 5, [], true]) assert.equal(normalizeNewsRow(bad), null)
})

test('normalizeNewsRow: priority fracionaria vira inteiro e cta ruim so tira o botao', () => {
  const item = normalizeNewsRow(row({ priority: 7.9, cta: { destino: 'NÃO' } }))
  assert.ok(item)
  assert.equal(item.priority, 7)
  assert.deepEqual(item.cta, {})
})

// ---- janela e ordem ----

test('isActive: starts_at <= agora < ends_at, ends_at nulo = sem fim', () => {
  const at = (startsAt: string, endsAt: string | null) => isActive({ startsAt, endsAt }, NOW)
  assert.equal(at('2026-11-13T12:00:00.000Z', null), true)
  assert.equal(at('2026-11-13T12:00:00.001Z', null), false)
  assert.equal(at('2026-01-01T00:00:00.000Z', '2026-11-13T12:00:00.000Z'), false)
  assert.equal(at('2026-01-01T00:00:00.000Z', '2026-11-13T12:00:00.001Z'), true)
  assert.equal(at('2026-01-01T00:00:00.000Z', null), true)
})

test('activeNews: so publicados, validos e na janela; ordem prioridade, startsAt mais novo, id', () => {
  const rows = [
    row({ id: 'b-old', priority: 10, starts_at: '2026-11-01T00:00:00Z' }),
    row({ id: 'a-new', priority: 10, starts_at: '2026-11-10T00:00:00Z' }),
    row({ id: 'hero', priority: 110 }),
    row({ id: 'tie-b', priority: 10, starts_at: '2026-11-10T00:00:00Z' }),
    row({ id: 'draft', priority: 999, published: false }),
    row({ id: 'future', priority: 999, starts_at: '2026-12-01T00:00:00Z' }),
    row({ id: 'expired', priority: 999, ends_at: '2026-11-13T11:59:59Z' }),
    row({ id: 'broken', priority: 999, tag: 'nope' }),
    row({ id: 'no-flag', priority: 999, published: undefined }),
    row({ id: 'string-flag', priority: 999, published: 'true' }),
    null,
    'lixo',
  ]
  assert.deepEqual(activeNews(rows, NOW).map((n) => n.id), ['hero', 'a-new', 'tie-b', 'b-old'])
  assert.deepEqual(activeNews(rows, new Date(NOW)).map((n) => n.id), ['hero', 'a-new', 'tie-b', 'b-old'])
})

test('activeNews: no maximo 12, id repetido entra uma vez, entrada que nao e lista vira []', () => {
  const many = Array.from({ length: 20 }, (_, i) => row({ id: `card-${String(i).padStart(2, '0')}`, priority: i }))
  const out = activeNews(many, NOW)
  assert.equal(out.length, NEWS_MAX)
  assert.equal(out[0].id, 'card-19')
  assert.equal(out[11].id, 'card-08')
  assert.equal(activeNews([row(), row()], NOW).length, 1)
  for (const bad of [null, undefined, {}, 'x', 7]) assert.deepEqual(activeNews(bad, NOW), [])
})

test('compareNews: ordena estavel por prioridade, startsAt e id', () => {
  const mk = (id: string, priority: number, startsAt: string) => normalizeNewsRow(row({ id, priority, starts_at: startsAt }))!
  const a = mk('aaa', 5, '2026-11-01T00:00:00Z')
  const b = mk('bbb', 5, '2026-11-01T00:00:00Z')
  const c = mk('ccc', 6, '2026-10-01T00:00:00Z')
  assert.deepEqual([b, a, c].sort(compareNews).map((n) => n.id), ['ccc', 'aaa', 'bbb'])
})

// ---- corpos dos POSTs ----

test('parseSeenBody: ate 12 ids com a regex do id, sem repetir; o resto e invalido', () => {
  assert.deepEqual(parseSeenBody({ ids: ['marina-boats', 'dog-motors'] }), ['marina-boats', 'dog-motors'])
  assert.deepEqual(parseSeenBody({ ids: ['marina-boats', 'marina-boats'] }), ['marina-boats'])
  assert.deepEqual(parseSeenBody({ ids: [] }), [])
  const doze = Array.from({ length: 12 }, (_, i) => `card-${i}x`)
  assert.equal(parseSeenBody({ ids: doze })?.length, 12)
  assert.equal(parseSeenBody({ ids: [...doze, 'card-13x'] }), null)
  for (const bad of [null, undefined, 'x', 7, [], {}, { ids: 'marina-boats' }, { ids: [1] }, { ids: ['AB'] }, { ids: ['x'] }, { ids: ['ok-id', 'Bad Id'] }, { id: 'marina-boats' }]) {
    assert.equal(parseSeenBody(bad), null, JSON.stringify(bad))
  }
})

test('parseClickBody: {id} com a regex do id; o resto e invalido', () => {
  assert.equal(parseClickBody({ id: 'marina-boats' }), 'marina-boats')
  for (const bad of [null, undefined, 'marina-boats', 7, [], {}, { id: 5 }, { id: 'AB' }, { id: 'a' }, { id: "x'; drop table--" }, { ids: ['marina-boats'] }]) {
    assert.equal(parseClickBody(bad), null, JSON.stringify(bad))
  }
})

// ---- estado da carteira ----

test('walletNewsState: seen e clicked so dos cards do feed, sem repetir', () => {
  const rows = [
    { news_id: 'marina-boats', clicked_at: '2026-11-13T10:00:00Z' },
    { news_id: 'dog-motors', clicked_at: null },
    { news_id: 'fora-do-feed', clicked_at: '2026-11-13T10:00:00Z' },
    { news_id: 'dog-motors', clicked_at: null },
    { news_id: 5 },
    null,
  ]
  assert.deepEqual(walletNewsState(rows, ['marina-boats', 'dog-motors']), { seen: ['marina-boats', 'dog-motors'], clicked: ['marina-boats'] })
  assert.deepEqual(walletNewsState(rows, []), { seen: [], clicked: [] })
  assert.deepEqual(walletNewsState(null, ['marina-boats']), { seen: [], clicked: [] })
})

// ---- a migration 040 trancada ----

const SQL = readFileSync(new URL('../../supabase/migrations/040_dogcity_game_news.sql', import.meta.url), 'utf8')

test('migration 040: sem travessao (em dash, en dash) em lugar nenhum', () => {
  assert.equal(/[\u2013\u2014]/.test(SQL), false)
})

test('migration 040: RLS ligada, zero politicas, grants tirados dos papeis do cliente', () => {
  for (const t of ['dogcity_game_news', 'dogcity_game_news_seen']) {
    assert.match(SQL, new RegExp(`alter table public\\.${t} enable row level security;`))
    assert.match(SQL, new RegExp(`revoke all on table public\\.${t} from anon, authenticated;`))
  }
  assert.equal(/create policy/i.test(SQL), false)
  assert.match(SQL, /BEFORE merging/)
})

test('migration 040: a semente tem marina-boats publicado e dog-motors NAO publicado, com os 8 idiomas dentro dos limites', () => {
  const blocks = [...SQL.matchAll(/\$json\$([\s\S]*?)\$json\$/g)].map((m) => JSON.parse(m[1]))
  assert.equal(blocks.length, 2)
  const [boats, motors] = blocks
  for (const texts of blocks) {
    assert.deepEqual(Object.keys(texts).sort(), [...NEWS_LOCALES].sort())
    // o normalizador nao corta nem descarta nada: o que esta na semente ja cabe e esta completo
    assert.deepEqual(normalizeTexts(texts), texts)
  }
  assert.equal(boats.en.title, 'Boats are here')
  assert.equal(boats.en.cta, 'Go to the Marina')
  assert.equal(motors.en.title, 'DOG MOTORS is open')
  assert.equal(motors.en.cta, 'Test drive now')
  // os nomes proprios ficam sem traducao em todos os idiomas
  for (const loc of NEWS_LOCALES) {
    for (const w of ['Runabout', 'Cruiser', 'Yacht']) assert.ok(boats[loc].body.includes(w), `${loc} ${w}`)
    assert.ok(motors[loc].title.includes('DOG MOTORS'), `${loc} titulo`)
    assert.ok(motors[loc].body.includes('DOG RING'), `${loc} DOG RING`)
  }
  // as linhas: ids, publicacao, prioridade, imagem e destino
  assert.match(SQL, /'marina-boats', 'new', 100, now\(\), 'marina_barcos',\s+'\{"destino": "marina_publica"\}'::jsonb,\s+'\{all\}'/)
  assert.match(SQL, /'dog-motors', 'new', 110, now\(\), 'dog_motors',\s+'\{"destino": "dog_motors"\}'::jsonb,\s+'\{all\}'/)
  assert.match(SQL, /\$json\$::jsonb,\s+true\s*\)\s*on conflict \(id\) do nothing;/)
  assert.match(SQL, /\$json\$::jsonb,\s+false\s*\)\s*on conflict \(id\) do nothing;/)
  // a semente passa pelo mesmo caminho que o banco -> API
  const asRow = (id: string, priority: number, image: string, destino: string, texts: unknown, published: boolean) =>
    ({ id, tag: 'new', priority, starts_at: '2026-11-13T00:00:00Z', ends_at: null, audience: ['all'], image, cta: { destino }, texts, published })
  const feed = activeNews(
    [asRow('marina-boats', 100, 'marina_barcos', 'marina_publica', boats, true), asRow('dog-motors', 110, 'dog_motors', 'dog_motors', motors, false)],
    NOW,
  )
  assert.deepEqual(feed.map((n) => n.id), ['marina-boats'])
})
