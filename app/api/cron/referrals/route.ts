/**
 * GET /api/cron/referrals   (Vercel Cron, a cada 10 minutos)
 *
 * Enche referral_progress: para um LOTE das carteiras indicadas (as nunca contadas primeiro, depois as
 * mais antigas), le o que elas fizeram DEPOIS do vinculo (escritura cunhada no mint, licenca paga ao
 * fundo em $DOG ou BTC) e grava a conta. O placar (/api/referral/board) so le o resultado pronto.
 * Fontes e aproximacoes: lib/referral/sources.ts. Regra do "depois": lib/referral/tally.ts.
 *
 * Protegida por CRON_SECRET (Authorization: Bearer ...), como a de licence-btc: sem a variavel a rota
 * recusa TUDO. Falha fechada: carteira cuja fonte falhou nao e gravada e volta na proxima rodada.
 * Nao escreve em dog_transactions, no livro dos founders, em total_received nem no bloco B.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase'
import { nextBatch, saveProgress } from '@/lib/referral/db'
import { defaultDeps, refreshBatch } from '@/lib/referral/refresh'
import { btcPayments, dogPayments } from '@/lib/referral/sources'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const BATCH = 80
const BUDGET_MS = 50_000

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
    const deps = defaultDeps({
      nextBatch,
      save: saveProgress,
      dogPayments: (w) => dogPayments(supabase, w.referred, w.linkedBlock, w.linkedAtMs),
      btcPayments: (addresses) => btcPayments(supabase, addresses),
    })
    const r = await refreshBatch(deps, BATCH, started + BUDGET_MS)
    return NextResponse.json({ ok: true, ...r, ms: Date.now() - started })
  } catch (e) {
    console.error('[cron/referrals]', (e as Error)?.message)
    return NextResponse.json({ ok: false, error: 'refresh failed' }, { status: 500 })
  }
}
