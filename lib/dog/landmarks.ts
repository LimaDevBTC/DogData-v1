// AS CASAS SOB MEDIDA DA CARTEIRA (fundador, 19/11/2026, depois da pergunta do @pips: "is my PIPS house attached to my
// wallet?"). Algumas carteiras têm, além da escritura do lote, uma peça própria na cidade feita para elas (PIPS HOUSE,
// J.DOG ESTATE, SATOSHI'S GOAL ARENA). Ela não é escritura no Bitcoin: a dona é a `carteiraDona` da entrada no catálogo
// público do jogo (https://play.dogcity.space/city/dados/catalogo.json), a mesma que o jogo usa para a trava dos veículos e
// da porta. Aqui: ler o catálogo e devolver as peças de uma carteira. Puro, para o teste; o fetch é o único efeito.

export const CATALOGO_URL = "https://play.dogcity.space/city/dados/catalogo.json"
export const JOGO_URL = "https://play.dogcity.space/city/"

export interface Landmark {
  id: string
  name: string
  /** o jogo pousa o jogador na vista da peça por ?view=<id> (src/lugares/vista_url.ts do dogcity-mundo) */
  url: string
}

interface Entrada { id?: unknown; nome?: unknown; carteiraDona?: unknown; vista?: { jogador?: unknown } | null }

/** as peças do catálogo cuja `carteiraDona` é o endereço (bech32 comparado em minúsculo) */
export function landmarksOf(catalogo: unknown, address: string): Landmark[] {
  const entradas = (catalogo as { entradas?: unknown } | null)?.entradas
  if (!Array.isArray(entradas)) return []
  const alvo = address.toLowerCase().startsWith("bc1") ? address.toLowerCase() : address
  const out: Landmark[] = []
  for (const e of entradas as Entrada[]) {
    if (!e || typeof e.id !== "string" || typeof e.carteiraDona !== "string") continue
    const dona = e.carteiraDona.toLowerCase().startsWith("bc1") ? e.carteiraDona.toLowerCase() : e.carteiraDona
    if (dona !== alvo) continue
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(e.id)) continue
    const name = typeof e.nome === "string" && e.nome.trim() ? e.nome.trim().slice(0, 80) : e.id
    const url = e.vista?.jogador ? `${JOGO_URL}?view=${e.id.toLowerCase()}` : JOGO_URL
    out.push({ id: e.id, name, url })
  }
  return out
}

/** o catálogo do jogo, guardado por 1 h no cache do Next; null se o jogo não respondeu */
export async function catalogoDoJogo(ms = 4000): Promise<unknown | null> {
  try {
    const r = await fetch(CATALOGO_URL, { signal: AbortSignal.timeout(ms), next: { revalidate: 3600 } })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}
