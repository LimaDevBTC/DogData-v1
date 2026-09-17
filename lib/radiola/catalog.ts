// Catálogo do Radiola tocado no mini-player do canto do DogCity.
//
// O player toca as faixas EM TREND do radiola.music em ordem ALEATÓRIA (shuffle
// no `use-radiola-audio`). Cada faixa segue a mesma forma que o player do
// Radiola usa (`audio_url`, `cover`, `title`, `artist`).
//
// ⚠️ FONTE DAS FAIXAS — PLACEHOLDER por enquanto. As faixas do Radiola são NFTs
// L2 da Kray (coleção `radiola_music`), e o trending vem do backend deles; a
// descoberta automática desse endereço foi bloqueada pelas travas de segurança,
// então falta o dono do Radiola confirmar a fonte (endpoint público de trending
// OU uma lista pronta). Enquanto isso, uso samples livres só pra tocar/ver no
// localhost. Troque `TRACKS` (ou ligue num fetch real) — ver RADIOLA-INTEGRATION.md.

export interface RadiolaTrack {
  id: string
  title: string
  artist: string
  /** URL da capa. Vazio → o player usa o disco padrão. */
  art: string
  /** URL do áudio (mp3/stream). Vazio → faixa só de UI (não toca). */
  src: string
}

export const RADIOLA = {
  /** Símbolo do Rune L1 distribuído pelo Radiola. Aqui é só rótulo de UI — o
   *  DogCity nunca toca no supply; a distribuição é do Radiola. */
  runeSymbol: 'RADIOLA',
  /** De quanto em quanto tempo o player confirma escuta (segundos). */
  heartbeatSeconds: 15,
  /** Teto diário de escuta contável por endereço (segundos). 4h. */
  dailyCapSeconds: 4 * 60 * 60,
  /** Exibição: "pontos $RADIOLA" por segundo de escuta. É SÓ VISUAL. A
   *  quantidade real de Rune é decidida pelo Radiola na distribuição, lendo o
   *  razão de segundos. 1 ponto por minuto. */
  pointsPerSecond: 1 / 60,
} as const

/** Link do Radiola aberto pelo logo do player. */
export const RADIOLA_URL = 'https://www.radiola.music'

/** Logo oficial do Radiola (o "R" magenta+laranja), em public/. */
export const RADIOLA_LOGO: string | null = '/radiola-logo.png'

// Faixas REAIS do Radiola (áudio no Supabase deles, bucket cosmic-cards). Estas
// são do artista Tafari — capturadas da fila real do player do radiola.music.
// Pra trocar/ampliar depois: cada `src` é a `audio_url` real; o ideal é o dono
// expor um GET de trending e o player buscar dinâmico (ver RADIOLA-INTEGRATION.md).
export const TRACKS: RadiolaTrack[] = [
  { id: 'legend-lion',    title: 'Legend Lion',    artist: 'Tafari', art: '', src: 'https://wokhgoabtwuvqynogafv.supabase.co/storage/v1/object/public/cosmic-cards/174b6974fe2f6b2733ba8098663c8a305ef00b802d58b09632f1f49c035e1b5c.mpeg' },
  { id: 'wire-babylon',   title: 'Wire Babylon',   artist: 'Tafari', art: '', src: 'https://wokhgoabtwuvqynogafv.supabase.co/storage/v1/object/public/cosmic-cards/831b62730e0768214376afdc1dcb7e6cd65f520bdd99d73b3251982cb7f6a85e.mpeg' },
  { id: 'little-keepers', title: 'Little Keepers', artist: 'Tafari', art: '', src: 'https://wokhgoabtwuvqynogafv.supabase.co/storage/v1/object/public/cosmic-cards/56f31460b0e015305a10e97ecc58391c18da5724e2265129fce97b843f47dbb5.mpeg' },
  { id: 'ash-and-river',  title: 'Ash & River',    artist: 'Tafari', art: '', src: 'https://wokhgoabtwuvqynogafv.supabase.co/storage/v1/object/public/cosmic-cards/b59f5a280a1df1c129ee7394daa17efc673085908a1eab6fc6ba3258f517435b.mpeg' },
  { id: 'zions-echo',     title: "Zion's Echo",    artist: 'Tafari', art: '', src: 'https://wokhgoabtwuvqynogafv.supabase.co/storage/v1/object/public/cosmic-cards/7824360bb42537409bf14cd896ffd48260f02b75361d64aea0319a065be9f69b.mpeg' },
  { id: 'concrete-bloom', title: 'Concrete Bloom', artist: 'Tafari', art: '', src: 'https://wokhgoabtwuvqynogafv.supabase.co/storage/v1/object/public/cosmic-cards/eb3ce1ce97c0da5575f6cfe08cd88b8deeb360acf2244df359806a812621bb44.mpeg?v=cbr2' },
]
