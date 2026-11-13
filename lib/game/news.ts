// Rodar: npx tsx --test lib/game/news.test.ts
//
// Logica pura das novidades do jogo (cards de feature no login, sem rede e sem banco). Contrato: CONTRATO_NOVIDADES.md secao 1.
// Tabelas: supabase/migrations/040_dogcity_game_news.sql. Rotas: app/api/game/news, news/seen e news/click.
//
// - A linha do banco e' tratada como entrada hostil: tipos, regex do id e da imagem, datas, publico e textos sao conferidos de
//   novo aqui. Linha que nao passa some do feed (o jogo segue sem aquele card); nunca derruba a lista inteira.
// - Texto: so os 8 idiomas do jogo; "en" e' obrigatorio (e' o idioma de reserva do cliente). Titulo 60, corpo 160 e botao 24
//   caracteres (pontos de codigo, para nao partir um par substituto do japones ou do chines no meio).
// - Janela ativa: starts_at <= agora < ends_at (ends_at nulo = sem fim). Ordem: prioridade maior primeiro, depois starts_at mais
//   novo, depois id (desempate estavel). No maximo 12 cards.

export const NEWS_LOCALES = ['en', 'pt-BR', 'es', 'it', 'de', 'fr', 'zh-CN', 'ja'] as const
export type NewsLocale = (typeof NEWS_LOCALES)[number]

export const NEWS_TAGS = ['new', 'event', 'update'] as const
export type NewsTag = (typeof NEWS_TAGS)[number]

export const NEWS_AUDIENCES = ['all', 'guest', 'no_lot', 'lot', 'licence'] as const
export type NewsAudience = (typeof NEWS_AUDIENCES)[number]

export const NEWS_MAX = 12
export const TITLE_MAX = 60
export const BODY_MAX = 160
export const CTA_MAX = 24

export const NEWS_ID_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/
export const NEWS_IMAGE_RE = /^[a-z0-9_-]{3,64}$/
/** o id do registro de destinos do jogo (marina_publica, dog_motors...) */
export const NEWS_DESTINO_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/

export interface NewsText {
  title: string
  body: string
  cta: string
}
export type NewsTexts = Partial<Record<NewsLocale, NewsText>> & { en: NewsText }

export interface NewsItem {
  id: string
  tag: NewsTag
  priority: number
  startsAt: string
  endsAt: string | null
  audience: NewsAudience[]
  image: string
  cta: { destino?: string }
  texts: NewsTexts
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** texto de uma linha so': controles viram espaco, espacos repetidos colapsam, corta em `max` pontos de codigo */
export function cutText(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const clean = v.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  const chars = Array.from(clean)
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() : clean
}

function normalizeOneText(raw: unknown): NewsText | null {
  if (!isRecord(raw)) return null
  const title = cutText(raw.title, TITLE_MAX)
  const body = cutText(raw.body, BODY_MAX)
  const cta = cutText(raw.cta, CTA_MAX)
  // idioma incompleto cai fora inteiro (o cliente usa o "en"); nunca mistura campo de um idioma com outro
  return title && body && cta ? { title, body, cta } : null
}

/** textos por idioma: corta, descarta idioma fora da lista ou incompleto, exige o "en". Sem "en" valido: null. */
export function normalizeTexts(raw: unknown): NewsTexts | null {
  if (!isRecord(raw)) return null
  const en = normalizeOneText(raw.en)
  if (!en) return null
  const out: NewsTexts = { en }
  for (const loc of NEWS_LOCALES) {
    if (loc === 'en') continue
    const t = normalizeOneText(raw[loc])
    if (t) out[loc] = t
  }
  return out
}

/** publico: so' valores da lista, sem repetir, na ordem canonica. Vazio ou invalido: null (o card nao vai a ninguem por engano). */
export function normalizeAudience(raw: unknown): NewsAudience[] | null {
  if (!Array.isArray(raw)) return null
  const out = NEWS_AUDIENCES.filter((a) => raw.includes(a))
  return out.length ? out : null
}

/** {destino} so' com id valido; qualquer outra coisa vira {} (card sem botao) */
export function normalizeCta(raw: unknown): { destino?: string } {
  if (isRecord(raw) && typeof raw.destino === 'string' && NEWS_DESTINO_RE.test(raw.destino)) return { destino: raw.destino }
  return {}
}

function isoOf(v: unknown): string | null {
  if (typeof v !== 'string' && !(v instanceof Date)) return null
  const t = typeof v === 'string' ? Date.parse(v) : v.getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** uma linha de dogcity_game_news (colunas em snake_case) no formato publico da API; null se a linha for invalida */
export function normalizeNewsRow(row: unknown): NewsItem | null {
  if (!isRecord(row)) return null
  const { id, tag, priority, image } = row
  if (typeof id !== 'string' || !NEWS_ID_RE.test(id)) return null
  if (typeof tag !== 'string' || !(NEWS_TAGS as readonly string[]).includes(tag)) return null
  if (typeof priority !== 'number' || !Number.isFinite(priority)) return null
  if (typeof image !== 'string' || !NEWS_IMAGE_RE.test(image)) return null
  const startsAt = isoOf(row.starts_at)
  if (!startsAt) return null
  // ends_at presente mas ilegivel: o card nunca terminaria; melhor sumir do que ficar para sempre
  const endsAt = row.ends_at == null ? null : isoOf(row.ends_at)
  if (row.ends_at != null && !endsAt) return null
  const audience = normalizeAudience(row.audience)
  if (!audience) return null
  const texts = normalizeTexts(row.texts)
  if (!texts) return null
  return {
    id,
    tag: tag as NewsTag,
    priority: Math.trunc(priority),
    startsAt,
    endsAt,
    audience,
    image,
    cta: normalizeCta(row.cta),
    texts,
  }
}

/** janela de data: starts_at <= agora < ends_at */
export function isActive(item: Pick<NewsItem, 'startsAt' | 'endsAt'>, now: number): boolean {
  if (Date.parse(item.startsAt) > now) return false
  return item.endsAt === null || Date.parse(item.endsAt) > now
}

/** prioridade maior primeiro, depois startsAt mais novo, depois id */
export function compareNews(a: NewsItem, b: NewsItem): number {
  if (a.priority !== b.priority) return b.priority - a.priority
  const sa = Date.parse(a.startsAt)
  const sb = Date.parse(b.startsAt)
  if (sa !== sb) return sb - sa
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** o feed: so' linhas publicadas, validas e dentro da janela, ordenadas, no maximo 12 */
export function activeNews(rows: unknown, now: Date | number = Date.now()): NewsItem[] {
  if (!Array.isArray(rows)) return []
  const t = typeof now === 'number' ? now : now.getTime()
  const out: NewsItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!isRecord(row) || row.published !== true) continue
    const item = normalizeNewsRow(row)
    if (!item || seen.has(item.id) || !isActive(item, t)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out.sort(compareNews).slice(0, NEWS_MAX)
}

/** corpo do POST /seen: {ids: string[]}, ate 12, cada um com a regex do id, sem repetir. Invalido: null. Lista vazia vale (nada a gravar). */
export function parseSeenBody(body: unknown): string[] | null {
  if (!isRecord(body) || !Array.isArray(body.ids) || body.ids.length > NEWS_MAX) return null
  const ids: string[] = []
  for (const id of body.ids) {
    if (typeof id !== 'string' || !NEWS_ID_RE.test(id)) return null
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** corpo do POST /click: {id: string} com a regex do id. Invalido: null. */
export function parseClickBody(body: unknown): string | null {
  if (!isRecord(body) || typeof body.id !== 'string' || !NEWS_ID_RE.test(body.id)) return null
  return body.id
}

/** as linhas de dogcity_game_news_seen da carteira viram as listas da resposta, so' dos cards que estao no feed */
export function walletNewsState(rows: unknown, feedIds: readonly string[]): { seen: string[]; clicked: string[] } {
  const inFeed = new Set(feedIds)
  const seen: string[] = []
  const clicked: string[] = []
  if (!Array.isArray(rows)) return { seen, clicked }
  for (const r of rows) {
    if (!isRecord(r) || typeof r.news_id !== 'string' || !inFeed.has(r.news_id)) continue
    if (!seen.includes(r.news_id)) seen.push(r.news_id)
    if (r.clicked_at != null && !clicked.includes(r.news_id)) clicked.push(r.news_id)
  }
  return { seen, clicked }
}
