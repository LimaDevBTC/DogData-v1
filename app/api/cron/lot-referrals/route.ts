/**
 * GET /api/cron/lot-referrals   (cron; NÃO agendado em vercel.json: o orquestrador liga)
 *
 * Credita a indicação por lote (DC Points e itens): lê o feed do mint (GET mint/api/mint/cron/referral-feed), aplica as regras
 * (lib/lot-referral/rules.ts) e grava no livro-caixa pelas funções da migração 043. Idempotente: rodar duas vezes não duplica.
 * Protegida por CRON_SECRET (Authorization: Bearer ...); sem a variável recusa TUDO. Variáveis: CRON_SECRET, MINT_CRON_SECRET
 * (o CRON_SECRET do mint, para o feed), DOGCITY_MINT_URL (opcional). Responde o relatório do giro (sem endereços).
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase'
import { referralDeps } from '@/lib/lot-referral/io'
import { runReferralJob } from '@/lib/lot-referral/job'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  try {
    const report = await runReferralJob(referralDeps(supabase))
    return NextResponse.json({ ok: true, ...report, ms: Date.now() - started }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[cron/lot-referrals]', (e as Error)?.message)
    return NextResponse.json({ ok: false, error: 'run failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
