// A PROPRIEDADE UNIDA: o banco de verdade (migração 044) por trás de PropertyStore. Só servidor (service role).
// Sem a tabela da 044 lança SemTabela, e as rotas respondem "not open yet".
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeAddress } from './licence-btc'
import { normalizeLotId } from './licence-lot'
import { SemTabela } from './licence-lot-service'
import { ehSemTabela } from './licence-lot-supabase'
import type { PropertyStore } from './property-merge-service'
import type { PropertyRecord, PropertyState } from './property-merge'

const COLS = 'id, wallet, lots, anchor, state, created_at, ended_at'
const ESTADOS: PropertyState[] = ['active', 'dissolved', 'dissolved_forced']

type PgErro = { message: string; code?: string } | null
function falha(e: PgErro): never {
  if (ehSemTabela(e)) throw new SemTabela(e?.message)
  throw new Error(e?.message ?? 'database error')
}

export function registroDe(r: any): PropertyRecord | null {
  const wallet = normalizeAddress(r?.wallet)
  const anchor = normalizeLotId(r?.anchor)
  if (typeof r?.id !== 'string' || !wallet || !anchor || !ESTADOS.includes(r?.state) || !Array.isArray(r?.lots)) return null
  const lots = r.lots.map((l: unknown) => normalizeLotId(l))
  if (lots.some((l: string | null) => !l)) return null
  return {
    id: r.id, wallet, lots: [...lots].sort(), anchor, state: r.state,
    createdAt: String(r.created_at ?? ''), endedAt: typeof r.ended_at === 'string' ? r.ended_at : null,
  }
}

const lista = (data: any[] | null) => (data ?? []).flatMap((r) => { const x = registroDe(r); return x ? [x] : [] })

export function propertyStore(db: SupabaseClient): PropertyStore {
  return {
    async ofWallet(wallet) {
      const { data, error } = await db.from('dogcity_property').select(COLS).eq('wallet', wallet).limit(500)
      if (error) falha(error)
      return lista(data)
    },
    async touching(lots) {
      const ls = [...new Set(lots.map((l) => normalizeLotId(l)).filter((l): l is string => !!l))]
      if (!ls.length) return []
      const { data, error } = await db.from('dogcity_property').select(COLS).overlaps('lots', ls).limit(500)
      if (error) falha(error)
      return lista(data)
    },
    async active() {
      const { data, error } = await db.from('dogcity_property').select(COLS).eq('state', 'active').order('anchor').limit(5000)
      if (error) falha(error)
      return lista(data)
    },
    async merge(wallet, lots, cooldownDays) {
      const { data, error } = await db.rpc('dogcity_property_merge', { p_wallet: wallet, p_lots: lots, p_cooldown_days: cooldownDays })
      if (error) falha(error)
      return typeof data === 'string' && data.length ? data : null
    },
    async dissolve(id, wallet, reason, cooldownDays) {
      const { data, error } = await db.rpc('dogcity_property_dissolve', { p_id: id, p_wallet: wallet, p_reason: reason, p_cooldown_days: cooldownDays })
      if (error) falha(error)
      return data === true
    },
  }
}
