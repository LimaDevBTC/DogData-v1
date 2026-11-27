// Um espelho EM MEMÓRIA de dc_points_ranking (supabase/migrations/050), só para os testes (ranking.test.ts). Mesmas regras, na
// mesma ordem: delta > 0, migração só no all time, herdado só no Total all time e só sem migração e com handle, semana =
// últimos 7 dias de jogo, empate com a mesma posição, ordem entre empatados por quem chegou primeiro. O SQL de verdade foi
// provado à parte (PGlite, fora do repo; ver o PR).
import type { Board, Period } from './ranking'

export interface RankLine { wallet: string; kind: string; source: string; delta: number; day: string; at: string }
export interface RankLegacy { wallet: string; amount: number; at: string }

export function memoryRanking(
  input: { lines: RankLine[]; legacy: RankLegacy[]; handles: Record<string, string | null>; migrated: string[]; avatars?: Record<string, string> },
  board: Board, period: Period, limit: number, wallet: string | null, today: string,
) {
  const dayN = (d: string) => Math.floor(Date.parse(d + 'T00:00:00Z') / 86_400_000)
  const acc = new Map<string, { pts: number; at: string }>()
  const add = (w: string, pts: number, at: string) => {
    const c = acc.get(w) ?? { pts: 0, at }
    c.pts += pts
    if (at > c.at) c.at = at
    acc.set(w, c)
  }
  for (const l of input.lines) {
    if (l.delta <= 0) continue
    const ok = board === 'total' ? (l.kind === 'earn' || l.kind === 'referral' || (l.kind === 'migration' && period === 'all'))
      : board === 'login' ? l.kind === 'earn' && l.source === 'checkin'
      : l.kind === 'referral'
    if (!ok) continue
    if (period === 'week' && dayN(l.day) < dayN(today) - 6) continue
    add(l.wallet, l.delta, l.at)
  }
  if (board === 'total' && period === 'all') {
    for (const g of input.legacy) {
      if (g.amount > 0 && !input.migrated.includes(g.wallet) && input.handles[g.wallet]) add(g.wallet, g.amount, g.at)
    }
  }
  const all = [...acc.entries()].map(([w, v]) => ({ wallet: w, ...v })).filter((x) => x.pts > 0)
    .sort((a, b) => b.pts - a.pts || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || (a.wallet < b.wallet ? -1 : 1))
  const rankOf = (pts: number) => 1 + all.filter((x) => x.pts > pts).length
  const found = wallet ? all.find((x) => x.wallet === wallet) : undefined
  return {
    total: all.length,
    updated_at: new Date().toISOString(),
    rows: all.slice(0, limit).map((x) => ({ rank: rankOf(x.pts), wallet: x.wallet, handle: input.handles[x.wallet] ?? null, avatar: input.avatars?.[x.wallet] ?? null, points: x.pts })),
    me: found ? { rank: rankOf(found.pts), points: found.pts } : null,
  }
}
