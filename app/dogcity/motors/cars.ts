// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS no site: a ficha dos 18 carros da vitrine (/dogcity/motors).
//
// NOME e CLASSE vêm do catálogo da loja (lib/game/cars/catalog.ts, o mesmo que cobra): a vitrine nunca mostra um
// nome que a loja não vende. O PREÇO NÃO MORA AQUI: vem só do GET /api/dogcity/car-quote (./quote.ts). O catálogo
// tem preços marcadores (PRECOS_PROVISORIOS) e nenhum deles vai para a tela.
//
// OS NÚMEROS SÃO DO JOGO, não de ficha técnica de fábrica (dogcity-mundo, branch claude/tipos-carro, e68ad5983):
//   topKmh     velocidade máxima de TIPOS_CARRO (src/jogador/tipos_carro.ts, `kmh` de cada linha; vMaxDoTipo)
//   zeroTo100  0 a 100 km/h MEDIDO no Rapier com o GLB de verdade (scripts/carro/ensaio_tipos.ts, a ficha de
//              dirigibilidade de PROGRESSO_tipos_carro.md, coluna 0-100)
//   drive      a tração da linha (`frente`): 0 = RWD, >0 = AWD, 0,5 nos off-road = 4X4
//   engine     o motor do som (MotorSom: cilindros, arranjo, turbo)
//   massKg     a massa da linha
// Mudou a tabela do jogo, muda aqui (o teste tranca ids, nomes e classes contra o catálogo e as faixas da classe).
//
// FOTOS: public/dogcity-motors/car-<id>-<448|672|896>.<avif|webp> (scripts/motors/make-images.mjs, recorte 16:10).
// CRÉDITOS: os modelos são CC BY 4.0 (assets_carros/pronto/creditos.json). A atribuição leva o autor, o link do
// modelo (o endereço curto do Sketchfab, sem o nome de marca do título) e a licença, que é o que a CC BY 4.0 pede.
// ═══════════════════════════════════════════════════════════════════════════

import { CAR_MODEL_IDS, CAR_MODELS, type CarClass } from "@/lib/game/cars/catalog"

export const CLASS_ORDER: readonly CarClass[] = ["super", "sport", "luxury", "classic", "muscle", "offroad", "popular"]

/** o nome da classe na tela ("popular" do catálogo é Compact na vitrine) */
export const CLASS_LABEL: Readonly<Record<CarClass, string>> = {
  super: "Super",
  sport: "Sport",
  luxury: "Luxury",
  classic: "Classic",
  muscle: "Muscle",
  offroad: "Off-road",
  popular: "Compact",
}

/** a classe do jogo (TIPOS_CARRO) que corresponde a cada classe da loja: o teste confere a ficha por ela */
export const GAME_CLASS: Readonly<Record<CarClass, string>> = {
  super: "super", sport: "esportivo", luxury: "luxo", classic: "classico", muscle: "muscle", offroad: "offroad", popular: "popular",
}

export type Drive = "AWD" | "RWD" | "4X4"

export interface GameSpec {
  /** a classe da linha em TIPOS_CARRO */
  gameClass: string
  topKmh: number
  zeroTo100: number
  drive: Drive
  engine: string
  massKg: number
}

export const SPECS: Readonly<Record<string, GameSpec>> = {
  c02: { gameClass: "super", topKmh: 350, zeroTo100: 2.6, drive: "AWD", engine: "V12", massKg: 1520 },
  c05: { gameClass: "super", topKmh: 350, zeroTo100: 2.5, drive: "AWD", engine: "V12", massKg: 1770 },
  c15: { gameClass: "esportivo", topKmh: 300, zeroTo100: 3.0, drive: "AWD", engine: "V8 turbo", massKg: 2200 },
  c39: { gameClass: "esportivo", topKmh: 280, zeroTo100: 3.2, drive: "AWD", engine: "Inline-6 turbo", massKg: 1560 },
  c40: { gameClass: "esportivo", topKmh: 270, zeroTo100: 3.5, drive: "RWD", engine: "V6", massKg: 1370 },
  c41: { gameClass: "esportivo", topKmh: 285, zeroTo100: 3.3, drive: "RWD", engine: "Inline-6 turbo", massKg: 1510 },
  c10: { gameClass: "luxo", topKmh: 250, zeroTo100: 4.2, drive: "AWD", engine: "V12 turbo", massKg: 2490 },
  c25: { gameClass: "classico", topKmh: 230, zeroTo100: 4.2, drive: "RWD", engine: "Flat-6 turbo", massKg: 1140 },
  c26: { gameClass: "classico", topKmh: 225, zeroTo100: 5.1, drive: "RWD", engine: "Inline-6", massKg: 1295 },
  c28: { gameClass: "classico", topKmh: 228, zeroTo100: 4.9, drive: "RWD", engine: "Inline-6", massKg: 1500 },
  c62: { gameClass: "classico", topKmh: 205, zeroTo100: 4.6, drive: "RWD", engine: "Inline-4", massKg: 960 },
  c30: { gameClass: "muscle", topKmh: 205, zeroTo100: 4.2, drive: "RWD", engine: "V8", massKg: 1680 },
  c32: { gameClass: "muscle", topKmh: 225, zeroTo100: 3.8, drive: "RWD", engine: "V8", massKg: 1600 },
  c61: { gameClass: "muscle", topKmh: 210, zeroTo100: 4.3, drive: "RWD", engine: "V8", massKg: 1350 },
  c42: { gameClass: "offroad", topKmh: 160, zeroTo100: 6.5, drive: "4X4", engine: "Inline-4", massKg: 1100 },
  c43: { gameClass: "offroad", topKmh: 175, zeroTo100: 5.6, drive: "4X4", engine: "V8", massKg: 2100 },
  c52: { gameClass: "popular", topKmh: 140, zeroTo100: 8.0, drive: "RWD", engine: "Flat-4", massKg: 820 },
  c56: { gameClass: "popular", topKmh: 150, zeroTo100: 7.0, drive: "RWD", engine: "Flat-4", massKg: 870 },
}

export interface Credit { author: string; url: string }

/** os autores dos modelos dos 18 carros (CC BY 4.0), pelo endereço curto do modelo */
export const CAR_CREDITS: Readonly<Record<string, Credit>> = {
  c02: { author: "SDC PERFORMANCE™", url: "https://sketchfab.com/models/d679af35b5694301a185c7454a700c73" },
  c05: { author: "ALIEEEN", url: "https://sketchfab.com/models/cf52245eb68f48daa909c7ad2a8deaa3" },
  c10: { author: "kurojishi", url: "https://sketchfab.com/models/1f614e803fc24946b83bdc2dd9926d62" },
  c15: { author: "SDC PERFORMANCE™", url: "https://sketchfab.com/models/647849f2b10e42a39365a0f572968f5e" },
  c25: { author: "Lexyc16", url: "https://sketchfab.com/models/de1ffd344c41481892511f7fd332c136" },
  c26: { author: "Lexyc16", url: "https://sketchfab.com/models/505241c829c540a4921533000736904e" },
  c28: { author: "AngryBearr", url: "https://sketchfab.com/models/bf1fe23e1578417ab11db67dc89fbe32" },
  c30: { author: "Barbo", url: "https://sketchfab.com/models/78f76d386a4341b0b71745bdc50fd5ab" },
  c32: { author: "BaldGuyMartin", url: "https://sketchfab.com/models/fd8d342bb5ad45a999c5908fa0311b58" },
  c39: { author: "Lexyc16", url: "https://sketchfab.com/models/ff8fb2251dfa4bb9979e7022c5a6666c" },
  c40: { author: "Lexyc16", url: "https://sketchfab.com/models/1cc15628a00a4739a6b6c01128927c8d" },
  c41: { author: "Martin Trafas", url: "https://sketchfab.com/models/eb9bb1eb41db431cb078088ae1ce45f8" },
  c42: { author: "AnilG", url: "https://sketchfab.com/models/b635f6d5a7a045cf9bae3cc71952cd23" },
  c43: { author: "meeww", url: "https://sketchfab.com/models/5773ec04488b46148816b5f7a9f3f44f" },
  c52: { author: "soujagah", url: "https://sketchfab.com/models/cb6e82e73386448fb3b4e2dd25255a5e" },
  c56: { author: "Matej Ondra", url: "https://sketchfab.com/models/3d166ec739cb440984cbcd17608675e0" },
  c61: { author: "Kristian LaGrange", url: "https://sketchfab.com/models/05f2a294087541ab82f681136d134344" },
  c62: { author: "Ricy", url: "https://sketchfab.com/models/7acee5044310499f85df631b203227b5" },
}

/**
 * Os modelos de terceiros que aparecem SÓ nos renders do prédio (assets_carros/projeto/CREDITOS_RENDERS.md): a
 * picape Cyber $DOG e as palmeiras. Os carros dos giradores já estão em CAR_CREDITS.
 */
export const RENDER_CREDITS: readonly (Credit & { what: string })[] = [
  { what: "Cyber $DOG pickup", author: "sumitsvlv", url: "https://sketchfab.com/models/3ebad24e51a2427d83ac397056d0ab6f" },
  { what: "palm", author: "Next Spring", url: "https://sketchfab.com/models/39052ea764c945858449e699318efa53" },
  { what: "royal palm", author: "PlantCatalog", url: "https://sketchfab.com/models/3113aadb615e432f934ec5d3407d11ce" },
  { what: "date palm", author: "evolveduk", url: "https://sketchfab.com/models/11acf710e6c149daa8d6fb8cdc5d087f" },
]

export interface ShowroomCar {
  id: string
  name: string
  cls: CarClass
  classLabel: string
  /** a posição na vitrine (1 a 18), na ordem das classes */
  n: number
  spec: GameSpec
  credit: Credit
}

/** os 18, na ordem das classes (e, dentro da classe, na ordem do catálogo) */
export const SHOWROOM: readonly ShowroomCar[] = CLASS_ORDER
  .flatMap((cls) => CAR_MODEL_IDS.filter((id) => CAR_MODELS[id].class === cls))
  .map((id, i) => ({
    id,
    name: CAR_MODELS[id].name,
    cls: CAR_MODELS[id].class,
    classLabel: CLASS_LABEL[CAR_MODELS[id].class],
    n: i + 1,
    spec: SPECS[id],
    credit: CAR_CREDITS[id],
  }))

export const CLASS_COUNT: Readonly<Record<CarClass, number>> = Object.fromEntries(
  CLASS_ORDER.map((c) => [c, SHOWROOM.filter((s) => s.cls === c).length]),
) as Record<CarClass, number>

// ── as fotos ──
export const PHOTO_WIDTHS = [448, 672, 896] as const
export const photoSrcSet = (id: string, ext: "avif" | "webp") =>
  PHOTO_WIDTHS.map((w) => `/dogcity-motors/car-${id}-${w}.${ext} ${w}w`).join(", ")
export const photoFallback = (id: string) => `/dogcity-motors/car-${id}-672.webp`

/** "1,520 KG" */
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US")
