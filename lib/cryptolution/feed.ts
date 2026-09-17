// ═══════════════════════════════════════════════════════════════════════════
// CRYPTOLUTION × DogCity — o feed de transmissão diária da cidade.
//
// Vincent (@cryptolution101, canal "Cryptolution") publica um vídeo novo sobre
// $DOG praticamente todo dia. A Cryptolution House mostra o mais recente DENTRO
// da DogCity — a pessoa vê o vídeo do dia sem precisar sair pro YouTube.
//
// FONTE: o feed RSS público POR CANAL do YouTube. Sem API key, sem cota, sem
// segredo — o feed é aberto ao mundo e carrega os últimos ~15 uploads com id,
// título e data. A gente lê server-side (este arquivo só roda no servidor),
// normaliza e cacheia; o navegador só fala com o YouTube quando o visitante dá
// play no próprio embed.
//
// ⚠️ NÃO trocar por scraping da página do canal (www.youtube.com/@...): fora dos
// EUA aquela URL cai no muro de consentimento (302 → consent.youtube.com) e não
// devolve os vídeos. O endpoint /feeds/videos.xml?channel_id=… devolve XML puro,
// sem muro. `channelId` foi resolvido e conferido em 2026-09-13 contra o feed ao
// vivo (o mais recente era "$DOG SUPERCYCLE EXPLAINED").
// ═══════════════════════════════════════════════════════════════════════════

export const CRYPTOLUTION = {
  /** nome como aparece no canal */
  name: "Cryptolution",
  /** o prédio dele na cidade */
  building: "Cryptolution House",
  /** a pessoa */
  person: "Vincent",
  handle: "@cryptolution101",
  channelId: "UCyocm7zOzWBpk6Awpa2vzUw",
  youtube: "https://www.youtube.com/@CryptolutionOfficial",
  x: "https://x.com/cryptolution101",
} as const

export interface BroadcastVideo {
  id: string
  title: string
  /** ISO date string, direto do <published> do feed */
  published: string
  /** thumb hqdefault — derivada do id, sempre existe */
  thumb: string
  /** link do vídeo no YouTube (fallback caso o embed seja bloqueado) */
  url: string
}

export interface BroadcastFeed {
  channel: { name: string; building: string; url: string }
  /** o vídeo do dia — primeiro item, ou null se nada resolveu */
  latest: BroadcastVideo | null
  /** os últimos N, mais novo primeiro */
  videos: BroadcastVideo[]
  /** quando este retrato foi tirado, ISO */
  fetchedAt: string
  /** true quando o fetch ao vivo falhou e isto é o retrato embutido */
  stale: boolean
}

const FEED_URL = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

// hqdefault existe pra todo vídeo público (ao contrário de maxresdefault, que
// só existe se o upload for HD). i.ytimg.com serve com CORS liberado, então uma
// <img> comum resolve sem configurar remotePatterns do next/image.
export const thumbFor = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

/**
 * URL do player privacy-enhanced. É a forma COMPLIANT de tocar vídeo do YouTube
 * embutido: o conteúdo continua tocando dentro do iframe do YouTube (os Termos
 * não permitem servir o mp4 por conta própria), mas o visitante nunca sai da
 * DogCity. `rel=0` prende os relacionados ao próprio canal; `autoplay=1` só é
 * honrado porque o play parte de um clique do usuário.
 */
export const embedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`

// ── parsing sem dependência de XML ──────────────────────────────────────────
// O feed é regular e pequeno; um split por <entry> + quatro regex é mais barato
// e mais robusto que puxar um parser de XML pro bundle do servidor.
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))) // o YouTube usa a forma hex (&#x27;)
    .replace(/&amp;/g, "&") // por último: senão desfaz os escapes acima
}

function parseFeed(xml: string): BroadcastVideo[] {
  const out: BroadcastVideo[] = []
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    if (!id) continue
    const rawTitle = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? ""
    out.push({
      id,
      title: decodeEntities(rawTitle).trim(),
      published,
      thumb: thumbFor(id),
      url: watchUrl(id),
    })
  }
  return out
}

// ── o retrato embutido ──────────────────────────────────────────────────────
// Últimos vídeos reais, conferidos em 2026-09-13. Servem de duas formas:
//   1. localhost sem rede / YouTube fora do ar → a chapa mostra conteúdo REAL,
//      nunca uma moldura vazia (a landing inteira segue a regra "nunca quebra").
//   2. primeiro paint da seção antes do fetch ao vivo responder.
// Some sozinho assim que o feed ao vivo resolve; se ficar servido, `stale:true`
// avisa a UI a mostrar "último retrato conhecido".
const FALLBACK_VIDEOS: BroadcastVideo[] = [
  { id: "LMWwFpfgyaM", title: "$DOG SUPERCYCLE EXPLAINED (NEW CAPITAL FLOW MODEL 💰🔄🐕)", published: "2026-09-11T19:20:58+00:00", thumb: thumbFor("LMWwFpfgyaM"), url: watchUrl("LMWwFpfgyaM") },
  { id: "y5kkv2GDqjM", title: "$DOG OUTPERFORMS ALL BLUE CHIP MEMECOINS 😤", published: "2026-09-10T20:57:49+00:00", thumb: thumbFor("y5kkv2GDqjM"), url: watchUrl("y5kkv2GDqjM") },
  { id: "CasociPhwAs", title: "WHICH BULLISH PATTERN IS $DOG FORMING? 🐕🚀🌖", published: "2026-09-09T19:31:56+00:00", thumb: thumbFor("CasociPhwAs"), url: watchUrl("CasociPhwAs") },
  { id: "9i8BoJTMnII", title: "$DOG Forming 2021 $DOGE Parabola Pattern? 👀🧨🐕", published: "2026-09-08T20:40:39+00:00", thumb: thumbFor("9i8BoJTMnII"), url: watchUrl("9i8BoJTMnII") },
  { id: "ExB-W8wsXCs", title: "WELCOME TO $DOG DISBELIEF STAGE (MUST WATCH)", published: "2026-09-07T19:17:53+00:00", thumb: thumbFor("ExB-W8wsXCs"), url: watchUrl("ExB-W8wsXCs") },
]

export function fallbackFeed(): BroadcastFeed {
  return {
    channel: { name: CRYPTOLUTION.name, building: CRYPTOLUTION.building, url: CRYPTOLUTION.youtube },
    latest: FALLBACK_VIDEOS[0],
    videos: FALLBACK_VIDEOS,
    fetchedAt: new Date().toISOString(),
    stale: true,
  }
}

/**
 * Lê o feed ao vivo e normaliza. Nunca lança: qualquer falha (rede, 4xx/5xx,
 * timeout, feed vazio) cai no retrato embutido, então quem chama sempre recebe
 * um BroadcastFeed utilizável.
 */
export async function fetchBroadcast(limit = 6): Promise<BroadcastFeed> {
  try {
    const res = await fetch(FEED_URL(CRYPTOLUTION.channelId), {
      headers: { "user-agent": "Mozilla/5.0 (compatible; DogCity/1.0; +https://dogdata.xyz)" },
      // cache na camada de fetch do Next: uma leitura do YouTube a cada ~30 min
      // serve todos os visitantes. SWR longo cobre uma janela em que o feed
      // esteja fora do ar sem a chapa piscar.
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`feed ${res.status}`)
    const videos = parseFeed(await res.text()).slice(0, limit)
    if (!videos.length) throw new Error("empty feed")
    return {
      channel: { name: CRYPTOLUTION.name, building: CRYPTOLUTION.building, url: CRYPTOLUTION.youtube },
      latest: videos[0],
      videos,
      fetchedAt: new Date().toISOString(),
      stale: false,
    }
  } catch {
    return fallbackFeed()
  }
}
