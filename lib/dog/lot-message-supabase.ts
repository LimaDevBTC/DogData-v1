// "MESSAGE THE OWNER": o banco de verdade (migração 045) por trás de MessageStore. Só servidor (service role).
// Sem as tabelas da 045 lança SemTabela, e as rotas respondem "not open yet". Toda leitura e escrita filtra pela carteira da sessão.
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeAddress } from './licence-btc'
import { normalizeLotId } from './licence-lot'
import { SemTabela } from './licence-lot-service'
import { ehSemTabela } from './licence-lot-supabase'
import type { EnvioStatus, MensagemRow, MessageStore, Silencio } from './lot-message-service'

const T = 'dogcity_lot_message'
const TM = 'dogcity_lot_message_mute'
const COLS = 'id, thread_id, reply_to, lot_id, from_wallet, to_wallet, body, created_at, read_at'
const STATUS: EnvioStatus[] = ['ok', 'muted', 'day_cap', 'lot_cap', 'reply_cap', 'not_found']

type PgErro = { message: string; code?: string } | null
function falha(e: PgErro): never {
  if (ehSemTabela(e)) throw new SemTabela(e?.message)
  throw new Error(e?.message ?? 'database error')
}

export function linhaDe(r: any): MensagemRow | null {
  const from = normalizeAddress(r?.from_wallet)
  const to = normalizeAddress(r?.to_wallet)
  const lot = normalizeLotId(r?.lot_id)
  if (typeof r?.id !== 'string' || typeof r?.thread_id !== 'string' || !from || !to || !lot || typeof r?.body !== 'string') return null
  return {
    id: r.id, threadId: r.thread_id, replyTo: typeof r.reply_to === 'string' ? r.reply_to : null, lot, from, to, body: r.body,
    createdAt: String(r.created_at ?? ''), readAt: typeof r.read_at === 'string' ? r.read_at : null,
  }
}

export function messageStore(db: SupabaseClient): MessageStore {
  return {
    async send(a) {
      const { data, error } = await db.rpc('dogcity_lot_message_send', {
        p_from: a.from, p_to: a.to, p_lot: a.lot, p_body: a.body, p_reply_to: a.replyTo, p_day_cap: a.dayCap, p_reply_cap: a.replyCap,
      })
      if (error) falha(error)
      if (!STATUS.includes(data as EnvioStatus)) throw new Error('dogcity_lot_message_send: unexpected answer')
      return data as EnvioStatus
    },
    async inbox(wallet, limit) {
      const { data, error } = await db.from(T).select(COLS).eq('to_wallet', wallet).is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(limit)
      if (error) falha(error)
      return (data ?? []).flatMap((r) => { const x = linhaDe(r); return x ? [x] : [] })
    },
    async unread(wallet) {
      const { count, error } = await db.from(T).select('id', { count: 'exact', head: true })
        .eq('to_wallet', wallet).is('deleted_at', null).is('read_at', null)
      if (error) falha(error)
      return count ?? 0
    },
    async ownBodies(wallet, ids) {
      const out = new Map<string, string>()
      if (!ids.length) return out
      const { data, error } = await db.from(T).select('id, body').eq('from_wallet', wallet).in('id', ids).limit(ids.length)
      if (error) falha(error)
      for (const r of (data ?? []) as Array<{ id: unknown; body: unknown }>) {
        if (typeof r.id === 'string' && typeof r.body === 'string') out.set(r.id, r.body)
      }
      return out
    },
    async markRead(wallet, ids) {
      if (!ids.length) return
      const { error } = await db.from(T).update({ read_at: new Date().toISOString() })
        .eq('to_wallet', wallet).in('id', ids).is('read_at', null).is('deleted_at', null)
      if (error) falha(error)
    },
    async remove(wallet, id) {
      const { data, error } = await db.from(T).update({ deleted_at: new Date().toISOString() })
        .eq('to_wallet', wallet).eq('id', id).is('deleted_at', null).select('id')
      if (error) falha(error)
      return (data ?? []).length > 0
    },
    async mute(wallet, messageId) {
      const { data, error } = await db.rpc('dogcity_lot_message_mute_sender', { p_owner: wallet, p_message: messageId })
      if (error) falha(error)
      return data === true
    },
    async unmute(wallet, muteId) {
      const { data, error } = await db.from(TM).delete().eq('owner_wallet', wallet).eq('id', muteId).select('id')
      if (error) falha(error)
      return (data ?? []).length > 0
    },
    async mutes(wallet, limit) {
      const { data, error } = await db.from(TM).select('id, muted_wallet, created_at').eq('owner_wallet', wallet)
        .order('created_at', { ascending: false }).limit(limit)
      if (error) falha(error)
      const out: Silencio[] = []
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const w = normalizeAddress(r.muted_wallet)
        if (typeof r.id === 'string' && w) out.push({ id: r.id, wallet: w, createdAt: String(r.created_at ?? '') })
      }
      return out
    },
  }
}
