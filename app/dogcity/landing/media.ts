// ═══════════════════════════════════════════════════════════════════════════
// O que a landing v3 tem de mídia e de escrituras, lido NO BUILD.
//
// `media-manifest.json` é escrito por scripts/landing/sync-v3.mjs a partir do
// que as outras frentes entregaram em landing-v3/. O que não está no manifesto
// não existe para a página, e ela cai no fallback limpo (pôster provisório,
// mapa no lugar da subida T8, cartão de lugar sem laço). Nunca dado inventado.
//
// As escrituras vêm de public/landing/v3/deeds/deeds.json, gerado pelo gerador
// REAL da escritura (dogcity-mundo plano/carta/escritura_render.mjs). O nome do
// tier na tela vem da fonte única (lib/airdrop-tiers.ts), pelo degrau.
// ═══════════════════════════════════════════════════════════════════════════

import manifest from "./media-manifest.json"
import deedsFile from "@/public/landing/v3/deeds/deeds.json"
import { CITY_LADDER, COMPANY_LABEL, PROJECT_RESERVE_LABEL } from "@/lib/airdrop-tiers"

type Src = string | undefined
interface VideoManifest {
  hero_desktop_webm?: Src; hero_desktop_mp4?: Src; hero_mobile_webm?: Src; hero_mobile_mp4?: Src
  // T1 (a Terra sobre o domo): abre só a primeira reprodução, depois entra o laço
  intro_desktop_webm?: Src; intro_desktop_mp4?: Src; intro_mobile_webm?: Src; intro_mobile_mp4?: Src
  poster_desktop_avif?: Src; poster_desktop_webp?: Src; poster_desktop_jpg?: Src
  poster_mobile_avif?: Src; poster_mobile_webp?: Src; poster_mobile_jpg?: Src
  cuts?: { t: number; place: string }[]
  t8_desktop?: { count: number; pad: number }
  t8_mobile?: { count: number; pad: number }
  places?: Record<string, { webm?: Src; mp4?: Src; webp?: Src; jpg?: Src }>
}
interface Manifest {
  deeds?: { count: number }
  map?: { size: number; center: [number, number]; pxPerM: number }
  video?: VideoManifest
}
const M = manifest as unknown as Manifest
export const VIDEO: VideoManifest = M.video ?? {}

// ── o pôster do herói (o elemento LCP) ─────────────────────────────────────
// Até o primeiro quadro de T1 chegar, o pôster é a carta da cidade centrada na
// Satoshi Plaza, escurecida (public/landing/v3/poster/placeholder-*).
export const POSTER = {
  desktop: {
    avif: VIDEO.poster_desktop_avif ?? "/landing/v3/poster/placeholder-desktop.avif",
    webp: VIDEO.poster_desktop_webp ?? VIDEO.poster_desktop_jpg ?? "/landing/v3/poster/placeholder-desktop.webp",
  },
  mobile: {
    avif: VIDEO.poster_mobile_avif ?? "/landing/v3/poster/placeholder-mobile.avif",
    webp: VIDEO.poster_mobile_webp ?? VIDEO.poster_mobile_jpg ?? "/landing/v3/poster/placeholder-mobile.webp",
  },
  isPlaceholder: !VIDEO.poster_desktop_avif && !VIDEO.poster_desktop_webp && !VIDEO.poster_desktop_jpg,
}

const INTRO_DESKTOP = VIDEO.intro_desktop_webm || VIDEO.intro_desktop_mp4
  ? { webm: VIDEO.intro_desktop_webm, mp4: VIDEO.intro_desktop_mp4 } : null
const INTRO_MOBILE = VIDEO.intro_mobile_webm || VIDEO.intro_mobile_mp4
  ? { webm: VIDEO.intro_mobile_webm, mp4: VIDEO.intro_mobile_mp4 } : null

export const HERO_FILM = {
  desktop: { webm: VIDEO.hero_desktop_webm, mp4: VIDEO.hero_desktop_mp4 },
  mobile: { webm: VIDEO.hero_mobile_webm ?? VIDEO.hero_desktop_webm, mp4: VIDEO.hero_mobile_mp4 ?? VIDEO.hero_desktop_mp4 },
  intro: { desktop: INTRO_DESKTOP, mobile: INTRO_MOBILE ?? INTRO_DESKTOP },
  /** a legenda enquanto T1 roda (o nome é o do catálogo do jogo) */
  introPlace: "THE DOME",
  cuts: VIDEO.cuts ?? [],
  exists: !!(VIDEO.hero_desktop_webm || VIDEO.hero_desktop_mp4 || VIDEO.hero_mobile_webm || VIDEO.hero_mobile_mp4),
}

// ── a abertura de The city (P4): T5, o iate entrando no canal entre o cais da
// OrdCards e a Sphere, filmado no jogo com GPU (18/10). O pôster é o 1º quadro
// do laço (quadro 14 da tomada); o laço fecha num mergulho ao preto de 10
// quadros (a fusão do fim no começo dobrava o iate). 5,4 s, AV1 e H.264 Main.
// Arquivos próprios desta frente, em public/landing/v3/city/.
export const CITY_OPENER = {
  poster: {
    desktop: { avif: "/landing/v3/city/opener-desktop.avif", webp: "/landing/v3/city/opener-desktop.webp" },
    mobile: { avif: "/landing/v3/city/opener-mobile.avif", webp: "/landing/v3/city/opener-mobile.webp" },
  },
  loop: {
    desktop: { webm: "/landing/v3/city/opener-desktop.webm", mp4: "/landing/v3/city/opener-desktop.mp4" },
    mobile: { webm: "/landing/v3/city/opener-mobile.webm", mp4: "/landing/v3/city/opener-mobile.mp4" },
  } as null | {
    desktop: { webm: string; mp4: string }
    mobile: { webm: string; mp4: string }
  },
  place: "THE BAY",
}

export const T8 = {
  desktop: VIDEO.t8_desktop ?? null,
  mobile: VIDEO.t8_mobile ?? null,
  url: (variant: "desktop" | "mobile", i: number, pad: number) =>
    `/landing/v3/video/t8/${variant}/${String(i).padStart(pad, "0")}.webp`,
}

// ── a carta sem moldura (fundo da busca) ────────────────────────────────────
export const MAP = {
  src2400: "/landing/v3/map/city-plan_2400.webp",
  src1200: "/landing/v3/map/city-plan_1200.webp",
  size: M.map?.size ?? 2400,
  center: M.map?.center ?? [1200, 1200],
  /** pixels do mapa (a 2400) por metro do mundo; x leste, z sul */
  pxPerM: M.map?.pxPerM ?? 0.12,
}
export function metersToMap(x_m: number, z_m: number): [number, number] {
  return [MAP.center[0] + x_m * MAP.pxPerM, MAP.center[1] + z_m * MAP.pxPerM]
}

// ── as escrituras da galeria ────────────────────────────────────────────────
export type DeedGroup = "tiers-1-3" | "tiers-4-6" | "tiers-7-13" | "company" | "reserve" | "example"
interface RawDeed {
  arquivo: string; lot_id: string; grupo: DeedGroup; tier_n: number | null; tier: string
  area_m2: number; distrito: string; rua_frente: string | null; acesso: [string, string] | null
}
export interface Deed {
  file: string
  lotId: string
  group: DeedGroup
  rung: number | null
  /** "TIER 1 OF 13 · SATOSHI VISIONARY", "COMPANY", "PROJECT RESERVE" */
  tierLine: string
  /** só o nome, em caixa alta */
  tierName: string
  area: number
  /** "S07 · THE SPIT" como a escritura imprime */
  district: string
  /** "THE SPIT" quando o setor tem nome; senão "S01" */
  place: string
  src1200: string
  src2400: string
}

function toDeed(d: RawDeed): Deed {
  const rung = typeof d.tier_n === "number" && d.tier_n >= 1 && d.tier_n <= 13 ? d.tier_n : null
  const name = rung
    ? CITY_LADDER[rung - 1].label.toUpperCase()
    : d.grupo === "company" ? COMPANY_LABEL.toUpperCase()
    : d.grupo === "reserve" ? PROJECT_RESERVE_LABEL.toUpperCase()
    : d.tier.toUpperCase()
  const place = d.distrito.includes("·") ? d.distrito.split("·").slice(1).join("·").trim() : d.distrito
  return {
    file: d.arquivo,
    lotId: d.lot_id,
    group: d.grupo,
    rung,
    tierName: name,
    tierLine: rung ? `TIER ${rung} OF 13 · ${name}` : name,
    area: d.area_m2,
    district: d.distrito,
    place,
    src1200: `/landing/v3/deeds/${d.arquivo}_1200.webp`,
    src2400: `/landing/v3/deeds/${d.arquivo}_2400.webp`,
  }
}

const ALL = ((deedsFile as { deeds: RawDeed[] }).deeds ?? []).map(toDeed)
export const EXAMPLE_DEED: Deed | null = ALL.find((d) => d.group === "example") ?? null
export const GALLERY: Deed[] = ALL.filter((d) => d.group !== "example")

/** a primeira tela da galeria: os três primeiros degraus e o lote de empresa da Plaza */
export const FEATURED = GALLERY.filter((d) => (d.rung != null && d.rung <= 3) || d.group === "company")
export const LADDER_REST = GALLERY.filter((d) => !FEATURED.includes(d))

/** a escritura da galeria do mesmo tier (para "Your deed will be drawn like this") */
export function deedForTier(code: string | null | undefined, rung: number | null | undefined): Deed | null {
  if (rung) return GALLERY.find((d) => d.rung === rung) ?? null
  if (code === "co") return GALLERY.find((d) => d.group === "company") ?? null
  if (code === "res") return GALLERY.find((d) => d.group === "reserve") ?? null
  return null
}

// ── a anatomia da escritura (as sete partes do "Read a deed") ───────────────
// Retângulos em fração da folha (4200 x 2970, o mesmo template para todo lote),
// medidos na escritura de exemplo de 18/10/2026 (S07-Q00-B0001-L115). A coluna
// da direita do gerador empilha por altura, então REMEDIR se o template mudar.
export interface DeedPart {
  key: string
  title: string
  text: string
  /** o retângulo que acende (x, y, largura, altura em fração da folha) */
  r: [number, number, number, number]
  /** o recorte do quadro empilhado no celular, folgado em volta de `r` */
  c: [number, number, number, number]
}
export const DEED_PARTS: DeedPart[] = [
  { key: "lot", title: "LOT AND AREA", text: "The lot ID and its area head the sheet.",
    r: [0.034, 0.025, 0.5, 0.113], c: [0.02, 0.012, 0.525, 0.15] },
  { key: "tier", title: "TIER", text: "Its rung on the ladder of 13, or Company, or Project Reserve, and its district.",
    r: [0.546, 0.044, 0.146, 0.086], c: [0.53, 0.02, 0.17, 0.13] },
  { key: "key", title: "KEY PLAN", text: "The City Charter, reduced, with the lot's place in it.",
    r: [0.697, 0.025, 0.286, 0.188], c: [0.69, 0.016, 0.3, 0.205] },
  { key: "corners", title: "CORNERS", text: "A to D, in meters from the plaza center, to the centimetre.",
    r: [0.697, 0.225, 0.286, 0.126], c: [0.69, 0.215, 0.3, 0.145] },
  { key: "street", title: "STREET", text: "The road in front: rings R1 to R27, avenues A1 to A12, radials like 3.07, lanes like L2952.1, the lake roads LK1 and LK2, the Spit avenue AN7, the bay road SHORE and the quays QUAY.",
    r: [0.697, 0.402, 0.286, 0.068], c: [0.69, 0.365, 0.3, 0.115] },
  { key: "phase", title: "MINT PHASE", text: "Read from the block the deed is inscribed in, against the calendar on chain.",
    r: [0.697, 0.486, 0.286, 0.019], c: [0.69, 0.44, 0.3, 0.08] },
  { key: "stamp", title: "STAMP", text: "dogcity-966670-v1 and the root of the lot map its proof leads to.",
    r: [0.697, 0.907, 0.286, 0.069], c: [0.69, 0.86, 0.3, 0.125] },
]
export const DEED_RATIO = 4200 / 2970
