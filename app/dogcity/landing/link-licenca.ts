// ═══════════════════════════════════════════════════════════════════════════
// O LINK PROFUNDO DA LICENÇA (contrato FUNIL_LOTE_LICENCA_CASA.md §3, 01/11/2026).
//
// O jogo, o mint e o /profile mandam a pessoa para a landing com
//   https://dogcity.space/?licence=<personal|commercial|patron>&from=<game|mint|profile>#tiers
// O hash leva aos três cartões sem JS; com JS a landing abre a janela de pagamento
// já no degrau pedido. `from` é só medida: entra como `origem` no evento e NUNCA
// vai para a tela. Tudo que vem da URL é hostil: fora da lista, sai null.
//
// Pura, sem rede: testada em link-licenca.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { isDegrau, type Degrau } from "../casa-da-licenca"

export type Origem = "game" | "mint" | "profile"
const ORIGENS: readonly Origem[] = ["game", "mint", "profile"]
export const isOrigem = (o: unknown): o is Origem => typeof o === "string" && (ORIGENS as readonly string[]).includes(o)

export interface ParametrosLicenca {
  /** o degrau pedido; null se não veio ou não é um dos três */
  tier: Degrau | null
  /** de onde a pessoa veio; null se não veio ou não está na lista */
  from: Origem | null
}

/** lê `?licence=` e `?from=` de uma query string (com ou sem o "?" na frente) */
export function lerParametrosLicenca(search: string): ParametrosLicenca {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  } catch {
    return { tier: null, from: null }
  }
  const tier = params.get("licence")
  const from = params.get("from")
  return { tier: isDegrau(tier) ? tier : null, from: isOrigem(from) ? from : null }
}

/** a mesma URL sem `licence` e `from` (o hash fica), para um F5 não reabrir a janela */
export function limparParametrosLicenca(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete("licence")
    u.searchParams.delete("from")
    return u.toString()
  } catch {
    return url
  }
}
