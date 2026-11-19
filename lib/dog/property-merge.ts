// ═══════════════════════════════════════════════════════════════════════════
// A PROPRIEDADE UNIDA, OPT-IN (desenho final do fundador, 19/11/2026). Pura: sem rede, sem banco.
// Banco: migração 044 (dogcity_property). Serviço: lib/dog/property-merge-service.ts. Rotas:
// /api/dogcity/property (sessão de carteira) e /api/dogcity/properties (pública, só leitura, para o robô).
//
// REGRAS:
//  1. NADA AUTOMÁTICO. O dono vê "Expand your house" e escolhe QUAIS lotes vizinhos entram (pode guardar um lote solto
//     para vender). Não se paga nada. Vale SÓ NO JOGO: na cadeia cada lote segue a sua escritura e a sua licença.
//     O convite aparece só com pelo menos um lote licenciado e pelo menos um vizinho na mesma carteira.
//  2. Vizinho = mesmo quarteirão + divisa real (lib/dog/lot-property.ts). A seleção tem de ser UM grupo conexo.
//     Setor 8 (Financial District) nunca entra.
//  3. Lote sem licença entra só como terreno. A licença da propriedade é a mais alta entre os lotes; precisa de uma.
//  4. O teto do lazer vem do nível (TETO_DO_NIVEL, o mesmo do gerador no dogcity-mundo, scripts/casas/propriedade.py).
//  5. DESFAZER: voluntário (o dono) ou forçado (um lote saiu da carteira: a próxima leitura desfaz). Cada lote volta à
//     casa original, guardada. A licença nunca se move (é do lote).
//  6. FREIO: uma consolidação OU um desfazer voluntário por propriedade a cada 21 dias, contado por LOTE (nenhum lote
//     que participou de um evento voluntário nos últimos 21 dias entra noutro). O desfazer forçado não conta.
// ═══════════════════════════════════════════════════════════════════════════
import type { LicenceTier } from './licence-btc'
import { lotTakesLicence, normalizeLotId } from './licence-lot'
import { agruparPropriedades, type Vizinhanca } from './lot-property'

export const FREIO_DIAS = 21
export const FREIO_MS = FREIO_DIAS * 24 * 60 * 60 * 1000
/** uma seleção maior que isto não é uma casa: é um bairro */
export const MAX_LOTES = 12

export type PropertyState = 'active' | 'dissolved' | 'dissolved_forced'

/** uma linha de dogcity_property */
export interface PropertyRecord {
  id: string
  wallet: string
  /** os lotes da propriedade, ordenados */
  lots: string[]
  /** o lote âncora (o menor lot_id): a casa do jogo é PROP_<âncora> */
  anchor: string
  state: PropertyState
  createdAt: string
  endedAt: string | null
}

/** as peças da régua que cada nível libera (a ordem é a da REGUA do gerador; a piscina sempre primeiro, a sobra é jardim) */
export const TETO_DO_NIVEL: Record<LicenceTier, readonly string[]> = {
  personal: ['piscina'],
  commercial: ['piscina', 'basquete', 'tenis', 'hospedes'],
  patron: ['piscina', 'basquete', 'tenis', 'hospedes', 'futebol', 'academia'],
}

const RANK: Record<LicenceTier, number> = { personal: 1, commercial: 2, patron: 3 }

export function tierDaPropriedade(lots: string[], tiers: Map<string, LicenceTier | null>): LicenceTier | null {
  let t: LicenceTier | null = null
  for (const l of lots) {
    const x = tiers.get(l) ?? null
    if (x && (!t || RANK[x] > RANK[t])) t = x
  }
  return t
}

const tempo = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : null
}

/** o fim do freio de um lote (ms), ou null: o último evento VOLUNTÁRIO (consolidar ou desfazer) dos últimos 21 dias */
export function freioDoLote(lot: string, registros: PropertyRecord[], agoraMs: number): number | null {
  let fim: number | null = null
  for (const r of registros) {
    if (!r.lots.includes(lot)) continue
    const eventos = [tempo(r.createdAt)]
    if (r.state === 'dissolved') eventos.push(tempo(r.endedAt))   // o desfazer forçado não conta
    for (const t of eventos) {
      if (t === null) continue
      const ate = t + FREIO_MS
      if (ate > agoraMs && (fim === null || ate > fim)) fim = ate
    }
  }
  return fim
}

/** o que a carteira pode unir: os grupos conexos (2+ lotes fora do S08, pelo menos 1 licenciado) dos lotes que guarda */
export interface Opcao {
  /** todos os lotes do grupo conexo (o dono escolhe um subconjunto conexo deles) */
  lots: string[]
  licensed: string[]
  /** lotes do grupo que já estão numa propriedade ativa */
  merged: string[]
  /** o freio de cada lote do grupo, ISO; só os que têm */
  cooldownUntil: Record<string, string>
}

export function opcoesDeConsolidacao(
  held: string[],
  tiers: Map<string, LicenceTier | null>,
  vizinho: Vizinhanca | null,
  registros: PropertyRecord[],
  agoraMs: number,
): Opcao[] {
  if (!vizinho) return []
  const ok = [...new Set(held.map((l) => normalizeLotId(l)).filter((l): l is string => !!l && lotTakesLicence(l)))]
  const ativos = new Set(registros.filter((r) => r.state === 'active').flatMap((r) => r.lots))
  return agruparPropriedades(ok, vizinho)
    .filter((g) => g.lots.length >= 2 && g.lots.some((l) => tiers.get(l)))
    .map((g) => {
      const cooldownUntil: Record<string, string> = {}
      for (const l of g.lots) {
        const f = freioDoLote(l, registros, agoraMs)
        if (f) cooldownUntil[l] = new Date(f).toISOString()
      }
      return { lots: g.lots, licensed: g.lots.filter((l) => tiers.get(l)), merged: g.lots.filter((l) => ativos.has(l)), cooldownUntil }
    })
}

export type MergeErro =
  | 'too_few' | 'too_many' | 'invalid_lot' | 'sector_8' | 'not_holder' | 'not_connected' | 'no_licence' | 'already_merged' | 'cooldown'

export type MergePlano =
  | { ok: true; lots: string[]; anchor: string; tier: LicenceTier }
  | { ok: false; why: MergeErro; until?: string }

/** a seleção do dono conferida inteira. `held` é a lista do MINT (sem o mint não se une) */
export function validarConsolidacao(input: {
  lots: unknown
  held: string[]
  tiers: Map<string, LicenceTier | null>
  vizinho: Vizinhanca | null
  registros: PropertyRecord[]
  agoraMs: number
}): MergePlano {
  if (!Array.isArray(input.lots)) return { ok: false, why: 'invalid_lot' }
  if (input.lots.length > MAX_LOTES) return { ok: false, why: 'too_many' }
  const lots: string[] = []
  for (const x of input.lots) {
    const l = normalizeLotId(x)
    if (!l) return { ok: false, why: 'invalid_lot' }
    if (!lots.includes(l)) lots.push(l)
  }
  lots.sort()
  if (lots.length < 2) return { ok: false, why: 'too_few' }
  if (lots.some((l) => !lotTakesLicence(l))) return { ok: false, why: 'sector_8' }
  const held = new Set(input.held)
  if (lots.some((l) => !held.has(l))) return { ok: false, why: 'not_holder' }
  if (!input.vizinho || agruparPropriedades(lots, input.vizinho).length !== 1) return { ok: false, why: 'not_connected' }
  const tier = tierDaPropriedade(lots, input.tiers)
  if (!tier) return { ok: false, why: 'no_licence' }
  const ativos = new Set(input.registros.filter((r) => r.state === 'active').flatMap((r) => r.lots))
  if (lots.some((l) => ativos.has(l))) return { ok: false, why: 'already_merged' }
  let fim: number | null = null
  for (const l of lots) {
    const f = freioDoLote(l, input.registros, input.agoraMs)
    if (f && (fim === null || f > fim)) fim = f
  }
  if (fim) return { ok: false, why: 'cooldown', until: new Date(fim).toISOString() }
  return { ok: true, lots, anchor: lots[0], tier }
}

export type DesfazerErro = 'not_found' | 'not_owner' | 'not_active' | 'cooldown'

export function validarDesfazer(input: { id: unknown; wallet: string; registros: PropertyRecord[]; agoraMs: number }):
  { ok: true; record: PropertyRecord } | { ok: false; why: DesfazerErro; until?: string } {
  const r = input.registros.find((x) => x.id === input.id)
  if (!r) return { ok: false, why: 'not_found' }
  if (r.wallet !== input.wallet) return { ok: false, why: 'not_owner' }
  if (r.state !== 'active') return { ok: false, why: 'not_active' }
  // o freio vale para o desfazer também: a consolidação de hoje só se desfaz por vontade em 21 dias
  const outros = input.registros.filter((x) => x.id !== r.id)
  let fim = (tempo(r.createdAt) ?? 0) + FREIO_MS
  for (const l of r.lots) {
    const f = freioDoLote(l, outros, input.agoraMs)
    if (f && f > fim) fim = f
  }
  if (fim > input.agoraMs) return { ok: false, why: 'cooldown', until: new Date(fim).toISOString() }
  return { ok: true, record: r }
}

/** a propriedade ativa cujos lotes não estão mais todos na carteira: desfaz sozinha (forçado, sem freio) */
export function quebradas(registros: PropertyRecord[], wallet: string, held: string[]): PropertyRecord[] {
  const h = new Set(held)
  return registros.filter((r) => r.state === 'active' && r.wallet === wallet && r.lots.some((l) => !h.has(l)))
}

/** o que o robô lê (sem endereço): a propriedade ativa, os lotes, a licença dela e as peças que o nível libera */
export interface PropertyPublica {
  anchor: string
  lots: string[]
  tier: LicenceTier | null
  state: 'active'
  amenities: readonly string[]
}

export function publica(r: PropertyRecord, tiers: Map<string, LicenceTier | null>): PropertyPublica {
  const tier = tierDaPropriedade(r.lots, tiers)
  return { anchor: r.anchor, lots: r.lots, tier, state: 'active', amenities: tier ? TETO_DO_NIVEL[tier] : [] }
}
