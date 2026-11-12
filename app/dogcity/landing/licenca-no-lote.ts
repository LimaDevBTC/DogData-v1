// ═══════════════════════════════════════════════════════════════════════════
// A LICENÇA AO LADO DO LOTE, na busca da landing (#lookup).
// Contrato: FUNIL_LOTE_LICENCA_CASA.md §2 e §4 (01/11/2026).
//
// "The deed is the land. The licence builds the house." Quem acha o próprio lote
// na busca precisa ver o passo seguinte: sem licença, o botão que a compra; com
// licença, o estado da casa. A compra só aparece para quem não pagou.
//
// DE ONDE VEM CADA PEÇA:
//   * a licença da carteira: já vem na resposta de /api/dogcity/lookup
//     (`licence: { tier } | null`, com o filtro de custódia do servidor). Objeto
//     null = DogData não respondeu a tempo: NADA de licença na tela, melhor
//     nenhum que um errado.
//   * a casa: o índice público do jogo, https://play.dogcity.space/city/dados/casas/
//     indice.json (`tamanhoBloco`, `blocos`) e `<bx>_<bz>.json` com
//     bx = floor(x / tamanhoBloco), bz = floor(z / tamanhoBloco). A casa é
//     `entradas[].id === "CASA_" + lot_id.replace(/-/g, "_")`. O mesmo arquivo
//     traz `mintados`: lotes com escritura e casa ainda por gerar. Sem resposta =
//     "não se sabe", nunca "não tem".
//   * o estado do lote no mint (available / minted): o mint ainda NÃO responde
//     com CORS para dogcity.space (conferido em 01/11/2026), então a landing não o
//     consulta. O que se sabe vem do índice: casa de pé ou lote em `mintados` =
//     mintado; fora dos dois = desconhecido, e a frase não afirma nada do mint.
//
// Pura, sem rede: testada em licenca-no-lote.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { nomeDaLicenca, type Degrau } from "../casa-da-licenca"

export const CASAS_URL = "https://play.dogcity.space/city/dados/casas"

/** o que o índice das casas disse do lote */
export type EstadoDaCasa =
  /** a casa está no índice: de pé na cidade */
  | "construida"
  /** o lote está em `mintados`: escritura cunhada, casa por gerar */
  | "mintado_sem_casa"
  /** nem casa nem `mintados`: o índice não sabe (lote sem escritura, ou índice atrasado) */
  | "ausente"
  /** o índice não respondeu: não se sabe */
  | "desconhecido"

/** `"CASA_" + lot_id` com os hifens em sublinhado, como o gerador do jogo escreve */
export const idDaCasa = (lotId: string) => `CASA_${lotId.replace(/-/g, "_")}`

/** o nome do arquivo do bloco (`"-10_-4"`) de uma posição em metros; null se o dado não presta */
export function blocoDe(x: unknown, z: unknown, tamanhoBloco: unknown): string | null {
  if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) return null
  if (typeof tamanhoBloco !== "number" || !Number.isFinite(tamanhoBloco) || tamanhoBloco <= 0) return null
  return `${Math.floor(x / tamanhoBloco)}_${Math.floor(z / tamanhoBloco)}`
}

/** lê `tamanhoBloco` do indice.json; null se a resposta não tem a forma esperada */
export function tamanhoDoBloco(indice: unknown): number | null {
  if (typeof indice !== "object" || indice === null) return null
  const t = (indice as { tamanhoBloco?: unknown }).tamanhoBloco
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null
}

/** o índice diz se o bloco existe; sem a lista, assume que pode existir */
export function blocoExiste(indice: unknown, bloco: string): boolean {
  if (typeof indice !== "object" || indice === null) return true
  const blocos = (indice as { blocos?: unknown }).blocos
  if (typeof blocos !== "object" || blocos === null) return true
  return Object.prototype.hasOwnProperty.call(blocos, bloco)
}

/** lê o arquivo do bloco e diz o que ele sabe do lote; dado torto = "ausente", nunca lança */
export function estadoNoBloco(bloco: unknown, lotId: string): Exclude<EstadoDaCasa, "desconhecido"> {
  if (typeof bloco !== "object" || bloco === null) return "ausente"
  const b = bloco as { entradas?: unknown; mintados?: unknown }
  const alvo = idDaCasa(lotId)
  if (Array.isArray(b.entradas)) {
    for (const e of b.entradas) {
      if (typeof e === "object" && e !== null && (e as { id?: unknown }).id === alvo) return "construida"
    }
  }
  if (Array.isArray(b.mintados) && b.mintados.some((m) => m === lotId)) return "mintado_sem_casa"
  return "ausente"
}

// ── as frases (inglês, sem travessão, sem preço, sem data) ──────────────────
export const PROXIMO_DEGRAU: Record<Degrau, Degrau | null> = { personal: "commercial", commercial: "patron", patron: null }

export interface FraseDaCasa {
  /** a linha principal: o estado da casa */
  titulo: string
  /** a linha de apoio; null quando o título basta */
  nota: string | null
  /** mostrar o botão "See your house" (a casa está na cidade) */
  verCasa: boolean
}

/**
 * A frase para quem TEM licença, pelo que o índice sabe da casa. Patron é sempre
 * "residence in design" (a casa é projeto próprio; até lá, o canteiro com a placa).
 */
export function fraseDaCasa(degrau: Degrau, estado: EstadoDaCasa): FraseDaCasa {
  const nome = nomeDaLicenca(degrau)
  if (degrau === "patron") {
    return {
      titulo: "Your Patron residence is in design.",
      nota: estado === "construida" || estado === "mintado_sem_casa" ? "The site is marked on your lot." : null,
      verCasa: estado === "construida",
    }
  }
  switch (estado) {
    case "construida":
      return { titulo: `Your ${nome} house is built.`, nota: null, verCasa: true }
    case "mintado_sem_casa":
      return { titulo: `Your ${nome} house is in production.`, nota: "It appears on this lot in the city.", verCasa: false }
    case "ausente":
      return {
        titulo: `Your ${nome} house is in production.`,
        nota: "It stands on this lot in the city once the deed is minted.",
        verCasa: false,
      }
    default:
      return { titulo: `Your ${nome} licence is on this lot.`, nota: null, verCasa: false }
  }
}

/** o link discreto de subir de degrau; null no Patron */
export function fraseDeSubir(degrau: Degrau): { proximo: Degrau; rotulo: string } | null {
  const proximo = PROXIMO_DEGRAU[degrau]
  if (!proximo) return null
  return { proximo, rotulo: `Move up to ${nomeDaLicenca(proximo)}: pay only the difference` }
}

// ── o CTA para quem NÃO tem licença ─────────────────────────────────────────
// Lote sabidamente mintado (casa ou `mintados`): o botão do contrato, "Build your
// house". Estado desconhecido: a mesma oferta sem afirmar a escritura.
export const CTA_CONSTRUIR = {
  mintado: "Build your house",
  desconhecido: "Get the licence that builds on it",
} as const
// a mesma frase do mint (01/11 à noite, fundador): a pessoa compra a casa e os veículos, não uma "licença"
export const NOTA_CONSTRUIR = "The deed is the land. The licence is your house, and it comes with its vehicles. It belongs to the lot and goes with the deed."

export function rotuloDeConstruir(estado: EstadoDaCasa): string {
  return estado === "construida" || estado === "mintado_sem_casa" ? CTA_CONSTRUIR.mintado : CTA_CONSTRUIR.desconhecido
}
