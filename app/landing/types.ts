// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing — shared shapes for the live APIs the sections consume.
// /api/donate/leaderboard is fetched once by page.tsx and passed down;
// /api/plot is fetched by the Plot Deed section itself, on submit.
// ═══════════════════════════════════════════════════════════════════════════

export interface RecentEntry {
  address: string
  amount: number
  timestamp: string
  txid: string
}

export interface LeaderboardData {
  goal: number
  total_received: number
  progress_pct: number
  donor_count: number
  founders_count: number
  recent: RecentEntry[]
}

export interface PlotData {
  found: boolean
  rank?: number
  total_dog?: number
  district?: { id: number; name: string; color: string; tag: string }
  pin?: { nx: number; nz: number }
}
