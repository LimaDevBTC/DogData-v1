import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The dossier is a precomputed aggregate (~40KB) built by
// runestone/scripts/build_dossier.py from a local ord enumeration of the
// collection plus a bitcoind pass for current custody. Small enough to serve
// whole, so the page makes exactly one request.
let _cache: { data: unknown; ts: number } | null = null

export async function GET() {
  try {
    const now = Date.now()
    if (_cache && now - _cache.ts < 5 * 60_000) {
      return NextResponse.json(_cache.data, {
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
      })
    }
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'runestone_dossier.json'), 'utf-8')
    const data = JSON.parse(raw)
    _cache = { data, ts: now }
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Runestone dossier unavailable', detail: String(e) }, { status: 503 })
  }
}
