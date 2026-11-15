import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sessionWallet } from '@/lib/game/session'
import { computeCheckin, gameDay, historyStart } from '@/lib/game/checkin'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { creditCheckin, type CheckinPoints } from '@/lib/game/points/service'
import { pointsStore } from '@/lib/game/points/store'

// DC POINTS NO SERVIDOR (migração 042, 15/11/2026): o POST credita a recompensa do dia direto no livro (fonte `checkin`,
// referência `checkin:<dia>`, idempotente: um POST repetido depois de uma falha do livro credita, nunca paga duas vezes).
// Conta no teto diário de 480 e só para carteira com handle. A resposta ganha `points`
// ({ status: credited | duplicate | capped | no_handle | unavailable, credited, balance }); o GET devolve points: null.
// `reward` continua dizendo quanto o dia vale (o cliente com handle NÃO soma sozinho: lê o saldo).

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
    return json({ ...computeCheckin(await loadDays(wallet, today), today), points: null })
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
    const days = await loadDays(wallet, today)
    const state = computeCheckin(days, today, justClaimed)
    // a recompensa do dia é a MESMA em toda chamada do dia (o streak de hoje não muda): o livro confere pelo ref
    const dayReward = computeCheckin(days, today, true).reward?.points ?? 0
    const ledgerWallet = normalizeAddress(wallet)
    let points: CheckinPoints | null = null
    if (state.checkedToday && ledgerWallet && dayReward > 0) {
      // teto próprio: o livro lento não pendura o check-in (creditCheckin nunca lança; repetir o POST credita)
      points = await creditCheckin(pointsStore(supabase, AbortSignal.timeout(4_000)), ledgerWallet, today, dayReward)
    }
    return json({ ...state, points })
  } catch (e) {
    console.error('[game/checkin POST]', (e as Error)?.message)
    return json({ error: 'server_error' }, 500)
  }
}
