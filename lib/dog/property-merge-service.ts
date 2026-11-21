// ═══════════════════════════════════════════════════════════════════════════
// A PROPRIEDADE UNIDA ligada ao banco e ao mint por interfaces (19/11/2026). As regras moram em property-merge.ts.
// O banco de verdade está em property-merge-supabase.ts; os testes passam um falso.
//
//   vistaDaCarteira       GET /api/dogcity/property: as propriedades ativas da carteira, as opções de unir e o freio.
//                         Desfaz na hora (forçado, sem freio) a propriedade cujo lote saiu da carteira.
//   consolidar            POST { action: 'merge', lots }: a seleção conferida (mint, vizinhança, licença, freio)
//   desfazer              POST { action: 'split', id }: o desfazer voluntário (com o freio)
//   propriedadesPublicas  GET /api/dogcity/properties (o robô): as ativas, sem endereço; desfaz as quebradas antes
//
// FALHAS: sem a tabela da 044 (SemTabela) = 'not_open'; mint mudo = 'unknown' (nunca se une, nem se desfaz por venda,
// sem o mint dizer quem guarda o quê); banco fora = 'unknown'.
// ═══════════════════════════════════════════════════════════════════════════
import type { LicenceTier } from './licence-btc'
import { heldLotsOf, tierOfLot, type MintHolder } from './licence-lot'
import { SemTabela } from './licence-lot-service'
import type { AreaDe, Vizinhanca } from './lot-property'
import {
  FREIO_DIAS, REGUA_DO_LAZER, opcoesDeConsolidacao, publica, quebradas, tierDaPropriedade, validarConsolidacao, validarDesfazer,
  type DesfazerErro, type MergeErro, type Opcao, type PropertyPublica, type PropertyRecord,
} from './property-merge'

export interface PropertyStore {
  /** os registros (todos os estados) que tocam algum destes lotes, ou desta carteira */
  ofWallet(wallet: string): Promise<PropertyRecord[]>
  touching(lots: string[]): Promise<PropertyRecord[]>
  active(): Promise<PropertyRecord[]>
  /** dogcity_property_merge: o id, ou null se o mundo mudou */
  merge(wallet: string, lots: string[], cooldownDays: number): Promise<string | null>
  /** dogcity_property_dissolve */
  dissolve(id: string, wallet: string, reason: 'voluntary' | 'forced', cooldownDays: number): Promise<boolean>
}

export interface PropertyDeps {
  store: PropertyStore
  holder: (address: string) => Promise<MintHolder | null>
  /** o total aplicado em cada lote (licence-lot-supabase lotTotals) */
  lotTotals: (lots: string[]) => Promise<Map<string, number>>
  vizinho: () => Promise<Vizinhanca | null>
  /** a área de cada lote (data/dogcity_lot_areas.json); null se o arquivo não está ao alcance */
  areas: () => Promise<AreaDe | null>
  agoraMs: () => number
}

const erroDe = (e: unknown) => (e as Error)?.message ?? String(e)

async function tiersDe(deps: PropertyDeps, lots: string[]): Promise<Map<string, LicenceTier | null>> {
  const totals = lots.length ? await deps.lotTotals(lots) : new Map<string, number>()
  return new Map(lots.map((l) => [l, tierOfLot(totals.get(l) ?? 0)]))
}

export interface PropertyView {
  tier: LicenceTier | null
  lots: { lot: string; tier: LicenceTier | null }[]
  properties: (PropertyPublica & { id: string; createdAt: string; splitAfter: string })[]
  options: Opcao[]
  canExpand: boolean
  /** as que esta leitura desfez porque um lote saiu da carteira */
  dissolvedNow: string[]
  cooldownDays: number
  /** a régua do lazer: a peça e a área mínima (a prévia do jogo soma a área dos lotes escolhidos) */
  amenitiesByArea: typeof REGUA_DO_LAZER
}

export type Falha = { ok: false; why: 'not_open' | 'unknown' }

async function comFalha<T>(fn: () => Promise<T>): Promise<T | Falha> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof SemTabela) return { ok: false, why: 'not_open' }
    console.error('[property] unavailable:', erroDe(e))
    return { ok: false, why: 'unknown' }
  }
}

/** desfaz (forçado) as propriedades da carteira com lote que saiu dela; devolve as que ficaram ativas */
async function desfazerQuebradas(deps: PropertyDeps, wallet: string, held: string[], registros: PropertyRecord[]) {
  const q = quebradas(registros, wallet, held)
  const feitas: string[] = []
  for (const r of q) if (await deps.store.dissolve(r.id, wallet, 'forced', FREIO_DIAS)) feitas.push(r.anchor)
  const agoraIso = new Date(deps.agoraMs()).toISOString()
  const atual = registros.map((r) => (q.includes(r) ? { ...r, state: 'dissolved_forced' as const, endedAt: agoraIso } : r))
  return { feitas, atual }
}

export async function vistaDaCarteira(deps: PropertyDeps, wallet: string): Promise<PropertyView | Falha> {
  return comFalha(async () => {
    const [holder, viz, areaDe] = await Promise.all([deps.holder(wallet).catch(() => null), deps.vizinho().catch(() => null), deps.areas().catch(() => null)])
    if (!holder) return { ok: false, why: 'unknown' } as Falha
    const held = heldLotsOf(holder)
    const doDono = await deps.store.ofWallet(wallet)
    const { feitas, atual } = await desfazerQuebradas(deps, wallet, held, doDono)
    // o freio é por lote: os registros de outras carteiras nos mesmos lotes também contam
    const tocam = held.length ? await deps.store.touching(held) : []
    const registros = [...new Map([...atual, ...tocam.filter((r) => !atual.some((a) => a.id === r.id))].map((r) => [r.id, r])).values()]
    const tiers = await tiersDe(deps, held)
    const agora = deps.agoraMs()
    const ativas = registros.filter((r) => r.state === 'active' && r.wallet === wallet)
    const options = opcoesDeConsolidacao(held, tiers, viz, registros, agora, areaDe)
    return {
      tier: tierDaPropriedade(held, tiers),
      lots: held.map((lot) => ({ lot, tier: tiers.get(lot) ?? null })),
      properties: ativas.map((r) => {
        const v = validarDesfazer({ id: r.id, wallet, registros, agoraMs: agora })
        return {
          ...publica(r, tiers, areaDe), id: r.id, createdAt: r.createdAt,
          splitAfter: !v.ok && v.why === 'cooldown' && v.until ? v.until : new Date(agora).toISOString(),
        }
      }),
      options,
      canExpand: options.some((o) => o.lots.filter((l) => !o.merged.includes(l)).length >= 2),
      dissolvedNow: feitas,
      cooldownDays: FREIO_DIAS,
      amenitiesByArea: REGUA_DO_LAZER,
    }
  })
}

export type MergeResult = { ok: true; id: string; anchor: string; lots: string[]; tier: LicenceTier } | { ok: false; why: MergeErro | 'stale' | 'not_open' | 'unknown'; until?: string }

export async function consolidar(deps: PropertyDeps, wallet: string, lots: unknown): Promise<MergeResult> {
  const r = await comFalha(async (): Promise<MergeResult> => {
    const [holder, viz] = await Promise.all([deps.holder(wallet).catch(() => null), deps.vizinho().catch(() => null)])
    if (!holder) return { ok: false, why: 'unknown' }
    const held = heldLotsOf(holder)
    const pedidos = Array.isArray(lots) ? lots.filter((l): l is string => typeof l === 'string') : []
    const registros = [...(await deps.store.touching(pedidos.map((l) => l.trim().toUpperCase())))]
    const plano = validarConsolidacao({ lots, held, tiers: await tiersDe(deps, held), vizinho: viz, registros, agoraMs: deps.agoraMs() })
    if (!plano.ok) return plano
    const id = await deps.store.merge(wallet, plano.lots, FREIO_DIAS)
    if (!id) return { ok: false, why: 'stale' }
    return { ok: true, id, anchor: plano.anchor, lots: plano.lots, tier: plano.tier }
  })
  return r
}

export type SplitResult = { ok: true; anchor: string; lots: string[] } | { ok: false; why: DesfazerErro | 'stale' | 'not_open' | 'unknown'; until?: string }

export async function desfazer(deps: PropertyDeps, wallet: string, id: unknown): Promise<SplitResult> {
  return comFalha(async (): Promise<SplitResult> => {
    const doDono = await deps.store.ofWallet(wallet)
    const alvo = doDono.find((r) => r.id === id)
    const tocam = alvo ? await deps.store.touching(alvo.lots) : []
    const registros = [...new Map([...doDono, ...tocam].map((r) => [r.id, r])).values()]
    const v = validarDesfazer({ id, wallet, registros, agoraMs: deps.agoraMs() })
    if (!v.ok) return v
    if (!(await deps.store.dissolve(v.record.id, wallet, 'voluntary', FREIO_DIAS))) return { ok: false, why: 'stale' }
    return { ok: true, anchor: v.record.anchor, lots: v.record.lots }
  })
}

/** as propriedades ativas para o robô (sem endereço). A que tem lote fora da carteira é desfeita antes (forçado). */
export async function propriedadesPublicas(deps: PropertyDeps, opts: { maxHolders?: number } = {}): Promise<PropertyPublica[] | Falha> {
  return comFalha(async () => {
    const ativas = await deps.store.active()
    const porCarteira = new Map<string, PropertyRecord[]>()
    for (const r of ativas) porCarteira.set(r.wallet, [...(porCarteira.get(r.wallet) ?? []), r])
    const max = opts.maxHolders ?? 200
    const fora = new Set<string>()
    let n = 0
    for (const [w, rs] of porCarteira) {
      if (n++ >= max) break
      const h = await deps.holder(w).catch(() => null)
      if (!h) continue   // mint mudo: nunca desfaz sem saber quem guarda
      const { feitas } = await desfazerQuebradas(deps, w, heldLotsOf(h), rs)
      for (const a of feitas) fora.add(a)
    }
    const vivas = ativas.filter((r) => !fora.has(r.anchor))
    const tiers = await tiersDe(deps, [...new Set(vivas.flatMap((r) => r.lots))])
    const areaDe = await deps.areas().catch(() => null)
    return vivas.map((r) => publica(r, tiers, areaDe)).sort((a, b) => (a.anchor < b.anchor ? -1 : 1))
  })
}
