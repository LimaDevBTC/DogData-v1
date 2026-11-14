// ═══════════════════════════════════════════════════════════════════════════
// O RELOGIO DA WHITELIST E O LINK DO LOTE (06/11/2026). Modulo PURO: sem fetch, sem relogio, sem React.
//
// Nenhuma altura mora aqui: o calendario vem do mint (/api/mint/status, repassado por /api/dogcity/minter) e a ponta vem da
// mesma leitura. O fim da Whitelist e' o `partnerStart` do calendario. Blocos viram tempo a ~10 min por bloco, sempre "about".
// ═══════════════════════════════════════════════════════════════════════════
import { aboutBlocks, fmtInt, MINT_URL, type Calendar } from "./mint-state"

export interface WhitelistClock {
  /** a Whitelist esta aberta agora (altura dentro do intervalo do calendario) */
  active: boolean
  endBlock: number
  publicBlock: number
  blocksLeft: number
  /** "about 9 days" / "about 25 hours" */
  about: string
}

/** null quando falta calendario ou altura: a tela nao desenha contagem em vez de inventar uma */
export function whitelistClock(cal: Calendar | null | undefined, height: number | null | undefined): WhitelistClock | null {
  if (!cal || typeof height !== "number" || !Number.isSafeInteger(height) || height < 0) return null
  const blocksLeft = Math.max(0, cal.partnerStart - height)
  return {
    active: height >= cal.whitelistStart && height < cal.partnerStart,
    endBlock: cal.partnerStart,
    publicBlock: cal.publicStart,
    blocksLeft,
    about: aboutBlocks(blocksLeft),
  }
}

export const bannerText = (c: WhitelistClock) => `Unclaimed lots open to other wallets in ${c.about}. Check your wallet.`

/** a linha do verificador para um lote que ninguem cunhou */
export const unclaimedText = (c: WhitelistClock) =>
  `Your lot is unclaimed. Whitelist closes in ${c.about} (block ${fmtInt(c.endBlock)}). After that, other wallets can mint it.`

export const blocksLeftText = (c: WhitelistClock) =>
  `${fmtInt(c.blocksLeft)} ${c.blocksLeft === 1 ? "block" : "blocks"} left, ${c.about}.`

export type LotMintState = "available" | "reserved" | "minted" | "not_for_sale"

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const
const UTM_PADRAO: Record<string, string> = { utm_source: "dogdata", utm_medium: "checker", utm_campaign: "whitelist-unclaimed" }

/**
 * O link do lote no mint (/lot/<id>), levando os UTM de quem chegou (o post que trouxe a pessoa ao verificador).
 * Sem nenhum UTM de entrada, marca a origem como o proprio verificador, para o painel separar o que ele empurra.
 */
export function mintLotHref(lotId: string, utm: Partial<Record<(typeof UTM_KEYS)[number], string>> = {}): string {
  const u = new URL(`${MINT_URL}/lot/${encodeURIComponent(lotId)}`)
  const trazidos = UTM_KEYS.filter((k) => utm[k])
  if (trazidos.length > 0) for (const k of trazidos) u.searchParams.set(k, utm[k]!.slice(0, 120))
  else for (const [k, v] of Object.entries(UTM_PADRAO)) u.searchParams.set(k, v)
  return u.toString()
}

/** ?address= da URL do verificador: so o que parece endereco (o resto a rota recusa), nunca ecoado em erro */
export function addressFromSearch(search: string): string | null {
  const v = (new URLSearchParams(search).get("address") ?? "").trim()
  return /^[A-Za-z0-9]{14,90}$/.test(v) ? v : null
}
