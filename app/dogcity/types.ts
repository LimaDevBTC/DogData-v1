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

// Um registro do fundo: quem entrou. A licenca vem de /api/donate/leaderboard,
// calculada por total doado (citizen < personal < commercial).
// ⚠️ `patron` ENTROU EM 12/09/2026 e faltava aqui. O degrau existe desde sempre em
// `components/donate/donate-modal.tsx:65` (500k) e na tabela `tiers` da API, mas
// `licenseFor` no leaderboard parava em `commercial` e o tipo aqui também: os quatro
// doadores de 500k+ chegavam à UI rotulados como `commercial`.
export type License = "citizen" | "personal" | "commercial" | "patron"

// Fundador: ordenado por CHEGADA (a primeira doacao da carteira), nunca por
// volume. `founder_seq` e a posicao na fila e nao muda quando alguem doa mais.
export interface FounderEntry {
  founder_seq: number
  address: string
  crossed_at: string
  total: number
  license: License
}

// Construtor: a mesma gente, ordenada por VOLUME acumulado.
export interface BuilderEntry {
  rank: number
  address: string
  total: number
  txCount: number
  lastTx: string
  license: License
}

export interface LeaderboardData {
  goal: number
  total_received: number
  progress_pct: number
  donor_count: number
  founders_count: number
  recent: RecentEntry[]
  founders?: FounderEntry[]
  leaderboard?: BuilderEntry[]
}

export interface PlotData {
  found: boolean
  rank?: number
  total_dog?: number
  district?: { id: number; name: string; color: string; tag: string }
  pin?: { nx: number; nz: number }
}
