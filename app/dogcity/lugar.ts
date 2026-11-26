// ONDE O LOTE FICA, EM PALAVRAS (25/11/2026): o distrito pelo LUGAR do lote e não pelo prefixo do ID.
// O planejador do mapa deu o prefixo S09 (Bay Shore) à orla da baía E TAMBÉM a 883 lotes de quadras cortadas por água,
// que caem no meio da cidade (de Brownstone Heights a Atomic Heights). O ID e a escritura inscrita NÃO mudam; só o RÓTULO
// de onde o lote fica. `distrito-lugar.json` é cópia idêntica do dogcity-mint (apps/web/app/_lib/distrito-lugar.json).
// ⚠️ Só rótulo. Regra (catálogo de casa, licença, preço, S08 sem fusão) continua pelo prefixo do ID, por decisão de produto.
import { DISTRITO_DO_SETOR } from "./dogcity-data"
import LUGAR from "./distrito-lugar.json"

const POR_LUGAR: Readonly<Record<string, string>> = (LUGAR as { lotes: Record<string, string> }).lotes

/** o setor do prefixo do ID ("S09-…" = 9), o que a escritura grava; NÃO é onde o lote fica */
export const setorDoId = (lotId: string): number => Number(lotId.slice(1, 3))

/** o setor onde o lote FICA ("S05"): o do ID, menos nos lotes S09 fora da orla da baía (o setor pelo rumo do centro) */
export const sectorOf = (lotId: string): string => POR_LUGAR[lotId] ?? lotId.slice(0, 3)

/** o mesmo, como número (9 -> 3 para um S09 que fica em Brownstone Heights) */
export const setorDoLugar = (lotId: string): number => Number(sectorOf(lotId).slice(1, 3))

/** o distrito de um lote pelo lugar; null fora dos nove */
export const districtOf = (lotId: string): string | null => DISTRITO_DO_SETOR[setorDoLugar(lotId)] ?? null
