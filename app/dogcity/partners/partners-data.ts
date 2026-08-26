// ═══════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL PARTNERS — the two anchor lots of Satoshi Plaza.
//
// Every fact below is either a property of the model that actually renders
// (lib/city/towers/*) or something verifiable about the partner's own product.
// Nothing here is a projection: no metre heights are quoted, because the city's
// units have no published metre scale and inventing one would be a lie told in
// a surveyor's voice — the specs describe composition instead, which is true by
// construction. `lot` matches PHASE_ANNOTATIONS in ../dogcity-data.ts, where
// these two buildings are already named on the phase-04 plate.
// ═══════════════════════════════════════════════════════════════════════════

export type PartnerKey = "bitflow" | "kray"

/**
 * Everything the 3D viewer can show. The two partners are anchors on the plaza
 * ring; `needle` is the project's own landmark at its centre, which is why it is
 * a site but never a Partner — it has no dossier, no external link and no lot
 * number, because DogCity does not lease a lot from itself.
 */
export type SiteKey = PartnerKey | "needle"

export interface Site {
  /** Blender-built, Draco-compressed. Lazily fetched, one at a time. */
  glb: string
  /** that site's own Cycles render, shown until the GLB resolves */
  poster: string
  /** in-canvas readout, line 1 */
  label: string
  /** in-canvas readout, line 2 — lava */
  sub: string
  /** screen-reader description of the canvas */
  aria: string
  /**
   * Whether a procedural builder exists in tracked `lib/city/towers/` to fall
   * back to when the GLB fails. The Needle's builder lives in the gitignored
   * city directory, so it has none — its poster is the fallback. Being explicit
   * here beats discovering it from a failed dynamic import at runtime.
   */
  fallback: boolean
}

export const SITES: Record<SiteKey, Site> = {
  bitflow: {
    glb: "/city/bitflow-hq.glb",
    poster: "/city/bitflow-hq-poster.jpg",
    label: "BITFLOW HQ",
    sub: "LOT #1 · PLAZA NORTH",
    aria: "Interactive 3D model of BitFlow HQ and its landscaped corner site, Bitflow's anchor building on Satoshi Plaza",
    fallback: true,
  },
  kray: {
    glb: "/city/kray-tower.glb",
    poster: "/city/kray-tower-poster.jpg",
    label: "KRAY TOWER",
    sub: "LOT #2 · PLAZA WEST",
    aria: "Interactive 3D model of Kray Tower and its landscaped forecourt, Kray Space's anchor building on Satoshi Plaza",
    fallback: true,
  },
  needle: {
    glb: "/city/central-tower.glb",
    poster: "/city/central-tower-poster.jpg",
    label: "THE NEEDLE",
    sub: "SATOSHI PLAZA · CENTRE",
    aria: "Interactive 3D model of the Needle, DogCity's central tower, standing in Satoshi Plaza with its water feature, garden quadrants and the four anchor lots",
    fallback: false,
  },
}

export interface Partner {
  key: PartnerKey
  /** the organisation */
  name: string
  /** the building standing on the lot */
  building: string
  /** lot designation, as annotated on the masterplan */
  lot: string
  /** short position line for the dossier head */
  position: string
  logo: string
  logoAlt: string
  /** logo box aspect, so the two marks can share a row without jumping */
  logoClass: string
  href: string
  hrefLabel: string
  blurb: string
  /** registration-corner accent for this partner's plate */
  accent: string
  specs: ReadonlyArray<readonly [string, string]>
}

export const PARTNERS: readonly Partner[] = [
  {
    key: "bitflow",
    name: "Bitflow",
    building: "BitFlow HQ",
    lot: "LOT #1 · PLAZA NORTH",
    position: "North anchor",
    logo: "/Bitflow.png",
    logoAlt: "Bitflow",
    logoClass: "h-7 md:h-8",
    href: "https://app.bitflow.finance/tokens/DOG",
    hrefLabel: "app.bitflow.finance",
    blurb:
      "Bitcoin DeFi on Stacks. Bitflow runs the DOG/sBTC pool, the venue where DOG trades off Bitcoin L1, and it is the pair pinned to the top of DogData's markets page.",
    accent: "rgba(247,129,22,0.85)",
    specs: [
      ["STRUCTURE", "9 stacked volumes"],
      ["CROWN", "Pixel-wave mark, lit"],
      ["FAÇADE", "Salamander LED spine"],
      ["CHAIN", "Stacks"],
    ],
  },
  {
    key: "kray",
    name: "Kray Space",
    building: "Kray Tower",
    lot: "LOT #2 · PLAZA WEST",
    position: "West anchor",
    logo: "/kray.jpeg",
    logoAlt: "Kray Space",
    logoClass: "h-9 md:h-10",
    href: "https://kray.space",
    hrefLabel: "kray.space",
    blurb:
      "A Bitcoin layer 2 with its own wallet, runes settlement and an on-chain NFT stack. The tower carries Kray's mark at the crown as a 3D object inscribed on Bitcoin: not a texture of a logo, the inscription itself.",
    accent: "rgba(185,194,207,0.85)",
    specs: [
      ["STRUCTURE", "Flared monolith · 27 storeys"],
      ["CROWN", "Inscribed 3D mark"],
      ["FAÇADE", "V-ribs, foot to crown"],
      ["CHAIN", "Bitcoin L2"],
    ],
  },
] as const
