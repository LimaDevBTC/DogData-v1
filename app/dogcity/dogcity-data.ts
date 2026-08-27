// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — single source of truth for phases, copy and project facts.
// Live numbers (fund, founders, donors) always come from /api/donate/leaderboard
// at runtime; nothing dynamic is hardcoded here. Facts below are verified
// project configuration (real DEM site, real holder segmentation at plan time).
// ═══════════════════════════════════════════════════════════════════════════

export const DONATION_GOAL = 10_000_000
export const DONATION_WALLET = "bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p"

export const LUNAR_SITE = {
  name: "Mare Tranquillitatis",
  latDeg: 0.674,
  lonDeg: 23.473,
  siteRadiusM: 3500,
  demSource: "SLDEM2015 (LRO LOLA + SELENE Kaguya)",
  verticalExaggeration: "2×",
  creditLine: "Terrain data: NASA/GSFC/ASU · LRO LOLA · JAXA/SELENE · SLDEM2015",
}

// Holder segmentation captured for the masterplan (lot rights at launch).
export const LOT_SEGMENTATION = {
  total: 97_673,
  btc: 86_029,
  sol: 11_303,
  stx: 341,
}

// ── $DOG Galaxy (app/galaxy) ───────────────────────────────────────────────
// Snapshot da genealogia lido do NO RAIZ (a tesouraria do airdrop) em
// 2026-08-26 via /api/holders/tree?depth=0. Sao exatamente os campos que o
// dossie da tesouraria mostra dentro do proprio produto, entao a landing e a
// galaxia nunca discordam.
//
// POR QUE E ESTATICO, e nao um fetch: aquela rota devolve 628 KB em ~2 s
// (ela carrega o recorte inteiro da arvore) e nao existe rota barata que
// devolva so estes quatro campos. Depois do incidente de IO de 26/08 a landing
// nao ganha rota nova de dado pesado. A arvore so cresce, entao o numero
// envelhece PARA BAIXO e nunca vira mentira, e a linha mono da secao carrega a
// data do snapshot.
export const GALAXY = {
  wallets: 263_919,       // root.subtree_wallets: todo endereco por onde DOG passou
  holding: 85_760,        // root.subtree_holders: com saldo hoje
  // ⚠️ NAO publicar "30 geracoes": 30 e o TETO da rota (GENS_MAX_DEPTH), nao
  // um fato da arvore. A profundidade real vai a 1.663 e 6.255 carteiras estao
  // alem da 30. O numero honesto para a copy e quantas carteiras nasceram
  // DIRETO do airdrop, que e agregado real da raiz.
  generationsShown: 30,   // so para a cena, que desenha ate a casca 30
  directChildren: 80_850, // root.children: primeiro salto do airdrop
  snapshot: "26 Aug 2026",
  // raiz da genealogia; usada para montar o deep link da lente Flow
  treasury: "bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t",
}

export const FEATURES = {
  contributionsLive: true,      // the construction fund is live today
  plotLookupLive: true,         // wallet → district lookup is live today
  inscriptionsLive: false,      // Ordinal building mint happens at the Grand Opening
  propertyMintLive: false,
}

export interface DogCityPhase {
  id: string
  number: number
  title: string
  shortTitle: string
  caption: string
  screenReaderSummary: string
  metric?: string
  image: string
  alt: string
}

export const PHASES: DogCityPhase[] = [
  {
    id: "terrain",
    number: 1,
    title: "Real Lunar Terrain",
    shortTitle: "Terrain",
    caption:
      "DogCity begins with a real place on the Moon. Roads, lots and buildings are positioned over mapped lunar elevation data, not an invented landscape.",
    screenReaderSummary:
      "Phase 1 of 5. Untouched lunar terrain at Mare Tranquillitatis with a faint orange survey grid, the site boundary ring and a circular marker where the Central Event Plaza will stand.",
    metric: "0.674°N · 23.473°E · Mare Tranquillitatis",
    image: "/landing/phase-01.webp",
    alt: "Dark lunar terrain covered by a faint glowing survey grid, with a circular plaza marker at the centre",
  },
  {
    id: "survey",
    number: 2,
    title: "Survey & Masterplan",
    shortTitle: "Survey",
    caption:
      "The plan follows the terrain. The monumental avenue is traced, district boundaries respond to elevation, and every eligible wallet receives a demarcated lot.",
    screenReaderSummary:
      "Phase 2 of 5. The same terrain now carries the staked masterplan: the primary avenue, organic district outlines, the plaza ring and a vast field of faintly glowing demarcated lots.",
    metric: "97,673 lots demarcated",
    image: "/landing/phase-02.webp",
    alt: "Lunar terrain etched with glowing masterplan lines: avenue, district boundaries and thousands of faint lot markers",
  },
  {
    id: "foundations",
    number: 3,
    title: "Foundations",
    shortTitle: "Foundations",
    caption:
      "The Founding Era begins. The Central Plaza platform rises, tower foundations are poured and the first community properties break ground.",
    screenReaderSummary:
      "Phase 3 of 5. The raised circular plaza platform glows at the centre; tower foundations, construction cranes and the first community foundations appear on the surveyed terrain.",
    image: "/landing/phase-03.webp",
    alt: "Construction phase: glowing circular platform, tower foundations and cranes on surveyed lunar terrain",
  },
  {
    id: "first-district",
    number: 4,
    title: "First District",
    shortTitle: "District 1",
    caption:
      "Wallet history decides location. The three landmark towers stand, the commercial ring is demarcated, and the earliest builders define the first district.",
    screenReaderSummary:
      "Phase 4 of 5. The Central Tower, BitFlow HQ and Kray Tower stand around the plaza; a ring of outlined commercial lots surrounds them and one district of buildings glows to the west.",
    metric: "Commercial ring: 2 of 13 lots claimed",
    image: "/landing/phase-04.webp",
    alt: "First district built around the central plaza with three landmark towers and a ring of outlined commercial lots",
  },
  {
    id: "active-city",
    number: 5,
    title: "DogCity Active",
    shortTitle: "Active",
    caption:
      "A city shaped by DOG holders, built on real lunar terrain and connected to Bitcoin. Every new builder expands the map.",
    screenReaderSummary:
      "Phase 5 of 5. The complete city at night: eight glowing districts, the garden plaza with supertrees, the spaceport, stadiums, parks, the monorail loop and the Solana and Stacks satellite districts.",
    image: "/landing/phase-05.webp",
    alt: "The complete DogCity at night: glowing districts radiating from the garden plaza across dark lunar terrain",
  },
]

// ── Scrollytelling annotations — anchored to city elements ──────────────────
// (u,v) are frame-space coordinates (0-1, v from top) projected from the world
// positions through the locked hero camera in Blender (world_to_camera_view).
export interface PhaseAnnotation {
  id: string
  u: number
  v: number
  title: string
  text?: string
  primary?: boolean
  side?: "top" | "bottom" | "left" | "right"
}

export const PHASE_ANNOTATIONS: PhaseAnnotation[][] = [
  [ // 01 · terrain
    { id: "plaza", u: 0.4781, v: 0.4699, title: "FUTURE CENTRAL PLAZA", primary: true,
      text: "Roads, lots and buildings will rise over mapped lunar terrain, a real place on the Moon." },
  ],
  [ // 02 · survey
    { id: "lots", u: 0.8611, v: 0.3049, title: "97,673 LOTS DEMARCATED", primary: true,
      text: "Every eligible wallet receives a lot, segmented across BTC, SOL and STX holders." },
    { id: "plaza", u: 0.4781, v: 0.4699, title: "CENTRAL PLAZA · STAKED" },
  ],
  [ // 03 · foundations
    { id: "plaza", u: 0.4781, v: 0.4699, title: "FOUNDATIONS & CRANES", primary: true,
      text: "The Founding Era begins: the plaza platform and the landmark tower foundations rise first." },
    { id: "firstprops", u: 0.2528, v: 0.5857, title: "FIRST COMMUNITY PROPERTIES" },
  ],
  [ // 04 · first district
    { id: "tower", u: 0.4771, v: 0.3624, title: "CENTRAL TOWER", primary: true, side: "top",
      text: "Wallet history decides location; the landmark towers anchor the first district." },
    { id: "bitflow", u: 0.4017, v: 0.3554, title: "BITFLOW HQ · LOT #1", side: "left" },
    { id: "kray", u: 0.5567, v: 0.3671, title: "KRAY TOWER · LOT #2", side: "right" },
    { id: "ring", u: 0.5746, v: 0.5356, title: "COMMERCIAL RING · RESERVED", side: "bottom" },
  ],
  [ // 05 · active city
    { id: "stadium", u: 0.6841, v: 0.8159, title: "FOOTBALL STADIUM", primary: true, side: "top",
      text: "A living city: stadiums, parks, the monorail loop and the spaceport serve every district." },
    { id: "monorail", u: 0.8005, v: 0.6491, title: "MONORAIL LOOP", side: "right" },
    { id: "pawpark", u: 0.0561, v: 0.8097, title: "PAW PARK", side: "right" },
    { id: "craterpark", u: 0.7375, v: 0.1267, title: "CRATER PARK", side: "bottom" },
  ],
]

export const TIERS = [
  {
    key: "founder",
    name: "Founder",
    threshold: "Any amount",
    color: "#CBD5E1",
    perks: [
      "Name engraved on the Founders' Monument, by order of arrival",
      "Counts toward the 10M Grand Opening",
      "Personal progress bar toward your license",
    ],
    note: "Contributions below 10,000 DOG do not include the right to mint a building. Founder recognition is permanent; the mint license starts at Personal.",
    cta: "Become a Founder",
  },
  {
    key: "personal",
    name: "Personal Property",
    threshold: "10,000 DOG",
    color: "#F56E0F",
    featured: true,
    perks: [
      "Mint your building at the Grand Opening, paying only BTC network fees",
      "One-time, permanent, tied to your wallet",
      "Verified DogCity profile",
    ],
    cta: "Register Personal Property",
  },
  {
    key: "commercial",
    name: "Commercial Property",
    threshold: "50,000 DOG",
    color: "#FB923C",
    perks: [
      "Everything in Personal",
      "Customize building model and color",
      "Ad space on your building's facade",
    ],
    cta: "Register Commercial Property",
  },
  {
    key: "patron",
    name: "Patron",
    threshold: "500,000 DOG",
    color: "#FFAD42",
    perks: [
      "Patron title inside the DogCity ecosystem",
      "Founding supporter recognition",
      "Priority access to future features where applicable",
    ],
    cta: "Become a Patron",
  },
]

export const WALLET_STEPS = [
  { n: "01", title: "DOG wallet", text: "Your wallet is the identity. No seed phrase, no signup: the address is enough." },
  { n: "02", title: "Balance & eligibility", text: "Your DOG balance sets the registration level a property can reach." },
  { n: "03", title: "Oldest UTXO", text: "The age of your oldest eligible DOG UTXO influences district placement; older coins live closer to the core." },
  { n: "04", title: "District assignment", text: "The masterplan assigns your lot inside one of the districts, following real terrain." },
  { n: "05", title: "Lunar coordinates", text: "Every lot maps to true selenographic coordinates at Mare Tranquillitatis." },
  { n: "06", title: "Bitcoin inscription", text: "At the Grand Opening, licensed properties can be minted as Ordinals on Bitcoin L1 (planned, not live yet)." },
]

export const DONATION_METHODS = [
  {
    key: "dog",
    title: "DOG Rune",
    symbol: "DOG",
    logo: "/DOG.png",
    qr: "/qrdog.jpeg",
    address: DONATION_WALLET,
    note: "Bitcoin L1 Rune · counts toward your license",
    featured: true,
  },
  {
    key: "bitcoin",
    title: "Bitcoin",
    symbol: "BTC",
    logo: "/BTC.png",
    qr: "/qrbtc.jpeg",
    address: "bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63",
    note: "Native SegWit · general support",
  },
  {
    key: "stacks",
    title: "Stacks",
    symbol: "STX",
    logo: "/STX .png",
    qr: "/qrstx.jpeg",
    address: "SP18DX0ANJTAA3WWWA501QHR27J76KPGV9MQ0J01Y",
    note: "Stacks L2 · general support",
  },
]

export function formatDog(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return Math.floor(n).toLocaleString()
}

export function shortAddr(addr: string): string {
  if (!addr || addr === "anonymous") return "Anonymous"
  return addr.length > 14 ? `${addr.slice(0, 7)}…${addr.slice(-5)}` : addr
}
