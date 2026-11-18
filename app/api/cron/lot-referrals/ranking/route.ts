/**
 * GET /api/cron/lot-referrals/ranking[?from=<ISO>&to=<ISO>]   (Bearer CRON_SECRET)
 *
 * O ranking semanal da indicação (top 3: 5.000 / 2.500 / 1.000 DC) para o fundador CONFERIR. Não paga nada. Janela padrão: os
 * últimos 7 dias; conta os lotes indicados creditados ao dono (lot_referral_rewards, lado owner). Mostra endereços: rota privada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase'
import { weeklyRanking } from '@/lib/lot-referral/rules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 20

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const q = req.nextUrl.searchParams
  const to = q.get('to') ? new Date(q.get('to')!) : new Date()
  const from = q.get('from') ? new Date(q.get('from')!) : new Date(to.getTime() - 7 * 86_400_000)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return NextResponse.json({ error: 'bad_window' }, { status: 400 })
  const { data, error } = await supabase.from('lot_referral_rewards').select('wallet, created_at')
    .eq('side', 'owner').eq('status', 'credited').gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(20000)
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const rows = ((data ?? []) as Array<{ wallet: string | null; created_at: string }>).flatMap((r) => (r.wallet ? [{ wallet: r.wallet, created_at: r.created_at }] : []))
  return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), top: weeklyRanking(rows) }, { headers: { 'Cache-Control': 'no-store' } })
}
