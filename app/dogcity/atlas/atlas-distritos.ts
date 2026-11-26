// O filtro por distrito do atlas (25/11/2026). Puro: sem React, para o teste.
// ⚠️ As folhas de cadastro (09.xx) são pelo PREFIXO do ID do lote (a escritura não muda). Um lote com id S09 que fica no
// meio da cidade está numa folha S09 (Bay Shore), por isso a página manda achá-lo em FIND YOUR SHEET.
import { DISTRITO_DO_SETOR } from "../dogcity-data"

export type Distrito = { slug: string; sector: number; code: string; name: string }

const slugDe = (nome: string) => nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** os nove distritos, na ordem S01..S09, com o nome do contrato publicado */
export const DISTRITOS: readonly Distrito[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => ({
  slug: slugDe(DISTRITO_DO_SETOR[s]),
  sector: s,
  code: `S${String(s).padStart(2, "0")}`,
  name: DISTRITO_DO_SETOR[s],
}))

/** "?district=timberline" -> o distrito, ou null (sem filtro ou valor desconhecido) */
export const distritoDoSlug = (slug: string | null | undefined): Distrito | null =>
  DISTRITOS.find((d) => d.slug === (slug ?? "").toLowerCase()) ?? null

/** o setor de uma folha de cadastro pelo título ("Registry S05 · 1/2" -> 5); null se não for folha de setor */
export const setorDaFolha = (titulo: string): number | null => {
  const m = /Registry S(\d\d)/.exec(titulo)
  return m ? Number(m[1]) : null
}

/** as folhas (num) do distrito, na ordem do livro */
export const folhasDoDistrito = (
  plates: readonly { num: string; title: string }[],
  sheets: readonly string[],
  d: Distrito,
): string[] => plates.filter((p) => sheets.includes(p.num) && setorDaFolha(p.title) === d.sector).map((p) => p.num)
