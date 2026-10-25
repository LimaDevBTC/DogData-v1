// Referral: leitura e escrita das tabelas da migracao 035 pelo servidor. SO servidor (service role).
//
// Duas regras de custo (incidente de IO de 26/08): o placar le UMA funcao SQL que agrega tabelas
// pequenas (referral_board), e o cron trabalha em lotes pequenos (referral_next_batch). Nada aqui
// varre dog_transactions por requisicao de pagina.

import { supabase } from '../supabase'
import type { BoardRowRaw } from './board'
import type { PendingWallet, ProgressRow, ResolvedLot } from './refresh'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function readBoardRows(limit: number, referrer: string | null = null): Promise<BoardRowRaw[]> {
  const { data, error } = await supabase.rpc('referral_board', { p_limit: limit, p_referrer: referrer })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    referrer_address: String(r.referrer_address),
    handle: typeof r.handle === 'string' ? r.handle : null,
    referred: num(r.referred),
    minted: num(r.minted),
    minted_lots: num(r.minted_lots),
    licences_personal: num(r.licences_personal),
    licences_commercial: num(r.licences_commercial),
    licences_patron: num(r.licences_patron),
    licence_dog: num(r.licence_dog),
    counted_at: typeof r.counted_at === 'string' ? r.counted_at : null,
    referrers_total: num(r.referrers_total),
    referred_total: num(r.referred_total),
  }))
}

// ── cron ────────────────────────────────────────────────────────────────────

export async function nextBatch(n: number): Promise<PendingWallet[]> {
  const { data, error } = await supabase.rpc('referral_next_batch', { p_limit: n })
  if (error) throw new Error(error.message)
  const out: PendingWallet[] = []
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const at = Date.parse(String(r.linked_at))
    if (!Number.isFinite(at)) continue
    const lots: Record<string, ResolvedLot> = {}
    const raw = (r.mint_lots ?? {}) as Record<string, { b?: unknown; t?: unknown }>
    for (const [id, v] of Object.entries(raw)) {
      const b = Number(v?.b)
      if (Number.isSafeInteger(b) && b > 0) lots[id] = { b, t: Number.isFinite(Number(v?.t)) ? Number(v?.t) : null }
    }
    const lb = Number(r.linked_block)
    out.push({
      referred: String(r.referred_address),
      referrer: String(r.referrer_address),
      linkedAtMs: at,
      linkedBlock: Number.isSafeInteger(lb) && lb > 0 ? lb : null,
      knownLots: lots,
    })
  }
  return out
}

export async function saveProgress(rows: ProgressRow[]): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('referral_progress').upsert(
    rows.map((r) => ({
      referred_address: r.referred,
      minted_lots: r.mintedLots,
      first_mint_block: r.firstMintBlock,
      licence_dog: r.licenceDog,
      licence_tier: r.tier,
      mint_lots: r.mintLots,
      checked_at: now,
    })),
    { onConflict: 'referred_address' },
  )
  if (error) throw new Error(error.message)
}
