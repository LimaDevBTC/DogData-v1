// Os dados do bloco "On chain, live" (16/11/2026), puros: servem ao servidor (page.tsx lê o mint) e ao cliente (o bloco).
// A rota é pública e de outro projeto (mint.dogcity.space/api/mint/deeds/recent): tudo que chega é conferido pela forma.

export interface RecentDeed { lotId: string; inscriptionId: string; number: number | null; phase: string }

/** a City Charter: o pai de toda escritura (inscrição 127,689,895, bloco 972,239) */
export const CHARTER_ID = "d7dc12d0df773e1cbf9605ae8b1e09f38f7cde5f9fb797651fb698aa7964e794i0"
export const CHARTER_NUMBER = 127_689_895
/** todas as filhas da Charter no ordinals.com, em ordem; as novas entram sozinhas */
export const CHARTER_CHILDREN_URL = `https://ordinals.com/children/${CHARTER_ID}`
export const inscriptionUrl = (id: string) => `https://ordinals.com/inscription/${id}`
/** a prévia da escritura servida pelo mint, os mesmos bytes que foram inscritos (o mint libera o enquadramento só para cá) */
export const deedPreviewUrl = (lotId: string) => `https://mint.dogcity.space/api/mint/deed/${encodeURIComponent(lotId)}/preview`

const LOT_ID = /^S\d{2}-Q\d{2}-B\d{3,5}-L\d{3,5}$/
const INSCRIPTION = /^[0-9a-f]{64}i(?:0|[1-9][0-9]{0,9})$/
const PHASES = new Set(["FOUNDER", "WHITELIST", "PARTNER", "PUBLIC"])

/** A resposta de /api/mint/deeds/recent conferida; null se o corpo não tem a forma. No máximo 6 escrituras. */
export function parseRecentDeeds(j: unknown): { deeds: RecentDeed[]; inscribed: number | null } | null {
  if (typeof j !== "object" || j === null || Array.isArray(j)) return null
  const o = j as { deeds?: unknown; inscribed?: unknown }
  if (!Array.isArray(o.deeds)) return null
  const deeds: RecentDeed[] = []
  for (const d of o.deeds.slice(0, 12)) {
    if (typeof d !== "object" || d === null) continue
    const { lotId, inscriptionId, number, phase } = d as Record<string, unknown>
    if (typeof lotId !== "string" || !LOT_ID.test(lotId) || typeof inscriptionId !== "string" || !INSCRIPTION.test(inscriptionId)) continue
    deeds.push({
      lotId, inscriptionId,
      number: typeof number === "number" && Number.isSafeInteger(number) && number >= 0 ? number : null,
      phase: typeof phase === "string" && PHASES.has(phase) ? phase : "",
    })
    if (deeds.length === 6) break
  }
  const n = o.inscribed
  return { deeds, inscribed: typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null }
}
