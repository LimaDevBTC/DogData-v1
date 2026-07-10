import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { assignDistrict } from '@/lib/city/zones'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/plot?address=<addr>
// Resolves a $DOG holder to its DogCity plot — the data behind the "Plot Deed"
// location card on /donate. Lives here (not under the gitignored app/api/city/)
// so it ships to production. District comes straight from the holder record via
// assignDistrict (lib/city/zones is tracked + dependency-free); the pin is a
// deterministic point in the district ring. No 3D city, no Supabase registry.
// DISTRICT_META mirrors DISTRICTS in lib/city/generator.ts (inlined to avoid
// pulling that module's heavy deps into a lightweight API route).
// ═══════════════════════════════════════════════════════════════════════════════

const DISTRICT_META = [
  { name: 'Genesis Core',   color: '#FDE047', tag: 'Oldest coins'     },
  { name: 'Diamond Hands',  color: '#FBBF24', tag: 'Ancient HODLers'  },
  { name: 'Vanguard',       color: '#F7931A', tag: 'Early believers'  },
  { name: 'Veterans',       color: '#FB7185', tag: 'Long-term'        },
  { name: 'Seasoned',       color: '#E879F9', tag: 'Matured holdings' },
  { name: 'Steady',         color: '#C4B5FD', tag: 'Mid-tenure'       },
  { name: 'Maturing',       color: '#A5B4FC', tag: 'Aging in'         },
  { name: 'Recent',         color: '#93C5FD', tag: 'Newer holdings'   },
  { name: 'Newcomers',      color: '#67E8F9', tag: 'Recent entrants'  },
  { name: 'Fresh Arrivals', color: '#6EE7B7', tag: 'Just arrived'     },
]

type Holder = { address: string; total_dog: number; utxo_count: number; rank: number }
let CACHE: { at: number; byAddr: Map<string, Holder>; total: number } | null = null

function holders(): { byAddr: Map<string, Holder>; total: number } {
  if (CACHE && Date.now() - CACHE.at < 5 * 60_000) return CACHE
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'dog_holders.json'), 'utf8'))
  const list: Holder[] = raw.holders || []
  const byAddr = new Map<string, Holder>()
  for (const h of list) byAddr.set(h.address, h)
  CACHE = { at: Date.now(), byAddr, total: list.length }
  return CACHE
}

// Stable FNV-1a hash → [0,1). Same input always lands the pin in the same spot.
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 1_000_000) / 1_000_000
}

export async function GET(request: Request) {
  const address = (new URL(request.url).searchParams.get('address') ?? '').trim()
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  try {
    const { byAddr, total } = holders()
    const h = byAddr.get(address)
    if (!h) {
      return NextResponse.json({ found: false }, { headers: { 'Cache-Control': 'public, s-maxage=300' } })
    }

    const di = assignDistrict(h.total_dog, h.utxo_count)
    const d = DISTRICT_META[di]

    // Pin in normalized city space [-1,1]: radius from the district's ring band
    // (district 0 innermost), angle + intra-band offset from the address hash.
    const bandInner = 0.10 + 0.90 * (di / 10)
    const bandOuter = 0.10 + 0.90 * ((di + 1) / 10)
    const rr = bandInner + (bandOuter - bandInner) * (0.25 + 0.5 * hash01(address + 'r'))
    const ang = hash01(address + 'a') * Math.PI * 2

    return NextResponse.json(
      {
        found: true,
        address,
        rank: h.rank,
        total_dog: h.total_dog,
        utxo_count: h.utxo_count,
        total_holders: total,
        district: { id: di, name: d.name, color: d.color, tag: d.tag },
        pin: {
          nx: Math.round(Math.cos(ang) * rr * 1000) / 1000,
          nz: Math.round(Math.sin(ang) * rr * 1000) / 1000,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
    )
  } catch (err) {
    console.error('[api/plot]', err)
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
  }
}
