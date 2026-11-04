import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sessionWallet } from '@/lib/game/session'
import { computeCheckin, gameDay, historyStart } from '@/lib/game/checkin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const H = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: H })

async function loadDays(wallet: string, today: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dogcity_game_checkins')
    .select('day')
    .eq('wallet', wallet)
    .gte('day', historyStart(today))
    .lte('day', today)
    .limit(500)
  if (error) throw error
  return (data ?? []).map((r: { day: string }) => r.day)
}

// GET -> estado do check-in (so le).
export async function GET(req: NextRequest) {
  try {
    const wallet = await sessionWallet(req)
    if (!wallet) return json({ error: 'unauthenticated' }, 401)
    const today = gameDay()
    return json(computeCheckin(await loadDays(wallet, today), today))
  } catch (e) {
    console.error('[game/checkin GET]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}

// POST -> marca o dia de jogo. Idempotente: a chave (wallet, day) impede pagar duas vezes.
export async function POST(req: NextRequest) {
  try {
    const wallet = await sessionWallet(req)
    if (!wallet) return json({ error: 'unauthenticated' }, 401)
    const today = gameDay()
    // ignoreDuplicates: ON CONFLICT DO NOTHING; so devolve a linha se ESTA chamada inseriu.
    const { data, error } = await supabase
      .from('dogcity_game_checkins')
      .upsert({ wallet, day: today }, { onConflict: 'wallet,day', ignoreDuplicates: true })
      .select('day')
    if (error) throw error
    const justClaimed = (data?.length ?? 0) > 0
    return json(computeCheckin(await loadDays(wallet, today), today, justClaimed))
  } catch (e) {
    console.error('[game/checkin POST]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}
