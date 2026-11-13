// DOG MOTORS no site: os srcset das imagens da página (public/dogcity-motors/, scripts/motors/make-images.mjs).
// Um lugar só para a pré-carga do servidor (page.tsx) e o <picture> do cliente pedirem os MESMOS arquivos.

const set = (name: string, widths: readonly number[], ext: "avif" | "webp") =>
  widths.map((w) => `/dogcity-motors/${name}-${w}.${ext} ${w}w`).join(", ")

const pair = (name: string, widths: readonly number[], fallbackWidth: number) => ({
  avif: set(name, widths, "avif"),
  webp: set(name, widths, "webp"),
  fallback: `/dogcity-motors/${name}-${fallbackWidth}.webp`,
})

/** o herói: 16:9 na paisagem, o recorte 4:5 (letreiro, torre, pilone) no retrato */
export const HERO = {
  desktop: pair("hero", [768, 1280, 1600], 1280),
  mobile: pair("hero-m", [480, 720], 720),
}

/** a Gallery (16:9) e as três pranchas do lugar (4:3) */
export const PLACE = {
  gallery: pair("gallery", [768, 1280, 1600], 1280),
  tower: pair("tower", [600, 900, 1200], 900),
  ring: pair("ring", [600, 900, 1200], 900),
  race: pair("race", [600, 900, 1200], 900),
}
