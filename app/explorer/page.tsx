"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Wallet, Hash, ExternalLink, Users, Database, Layers } from "lucide-react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function isValidBtcAddress(s: string): boolean {
  return /^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$/.test(s)
}

function isValidTxid(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s)
}

const TOP_HOLDERS = [
  { rank: 1,  address: "bc1p50n9sksy5gwe6fgrxxsqfcp6ndsfjhykjqef64m8067hfadd9efqrhpp9k", dog: "3.43B" },
  { rank: 2,  address: "bc1pk8g4rztfkxs2q9c40g6keeknjw6aadx3kzu4suzlll0remfw7xxs5x9ctv", dog: "3.41B" },
  { rank: 3,  address: "3G7gSaxPY7BhbEASd2pnZY5cg7uEQMQvd8", dog: "2.18B" },
  { rank: 4,  address: "bc1qj7dam98j6ktjcp320qu77y2vrylv49c2k2hkmu", dog: "2.17B" },
  { rank: 5,  address: "bc1pmqjlx3afzdrmv8gc6dpq990h4xwucdtgt9el3u5fmalek34zqysq96plm5", dog: "110M" },
]

export default function ExplorerPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(() => {
    const q = query.trim()
    if (!q) return
    if (isValidTxid(q)) {
      router.push(`/tx/bitcoin/${q.toLowerCase()}`)
      return
    }
    if (isValidBtcAddress(q)) {
      router.push(`/address/bitcoin/${q}`)
      return
    }
    setError("Enter a valid Bitcoin address (bc1…, 1…, 3…) or a 64-character transaction ID.")
  }, [query, router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
    else if (error) setError(null)
  }

  return (
    <Layout currentPage="explorer" setCurrentPage={() => {}}>
      <div className="pt-4 pb-12 px-3 md:px-6 space-y-8 max-w-4xl mx-auto animate-fade-in">

        {/* Hero */}
        <div className="text-center space-y-4 hero-glow pt-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-lava/[0.07] border border-lava/[0.12] flex items-center justify-center">
              <Search className="w-6 h-6 text-lava" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold font-display gradient-text-hero tracking-tight">
              DOG Explorer
            </h1>
          </div>
          <p className="text-dusty font-mono text-sm md:text-base">
            Search any $DOG holder address or transaction on Bitcoin L1
          </p>
        </div>

        {/* Search Bar */}
        <Card variant="glass" className="border-lava/[0.08]">
          <CardContent className="pt-6 pb-6 space-y-4">
            <div className={`flex items-center gap-3 bg-void/80 border rounded-xl px-4 py-3 transition-all duration-300 ${
              error
                ? "border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                : "border-white/[0.06] focus-within:border-lava/40 focus-within:shadow-[0_0_20px_rgba(245,110,15,0.08)]"
            }`}>
              <Search className="w-5 h-5 text-dusty/50 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); if (error) setError(null) }}
                onKeyDown={handleKeyDown}
                placeholder="Bitcoin address or transaction ID..."
                className="flex-1 bg-transparent font-mono text-sm text-snow placeholder-dusty/30 outline-none min-w-0"
                autoFocus
                spellCheck={false}
              />
              <button
                onClick={handleSearch}
                className="glass-button flex-shrink-0 px-5 py-2 text-sm font-mono font-semibold text-lava border border-lava/20 hover:border-lava/40 hover:text-snow hover:bg-lava/10 rounded-lg transition-all duration-200"
              >
                Search
              </button>
            </div>

            {error && (
              <p className="text-red-400/80 font-mono text-xs px-1">{error}</p>
            )}

            <div className="flex items-center gap-6 px-1">
              <span className="flex items-center gap-1.5 text-xs font-mono text-dusty/40">
                <Wallet className="w-3 h-3" />
                bc1q… / 1… / 3… — address
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono text-dusty/40">
                <Hash className="w-3 h-3" />
                64 hex chars — transaction ID
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Notable Addresses */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.04]" />
            <span className="text-xs font-mono text-dusty/40 uppercase tracking-[0.15em]">Top Holders</span>
            <div className="h-px flex-1 bg-white/[0.04]" />
          </div>

          <div className="space-y-2">
            {TOP_HOLDERS.map(h => (
              <a
                key={h.address}
                href={`/address/bitcoin/${h.address}`}
                className="flex items-center gap-4 glass hover:bg-glass-bg-hover border border-white/[0.04] hover:border-lava/[0.15] rounded-xl px-4 py-3 transition-all duration-300 group"
              >
                <span className="w-8 text-right font-mono text-xs text-dusty/40 flex-shrink-0">
                  #{h.rank}
                </span>
                <span className="flex-1 font-mono text-xs text-dusty/70 group-hover:text-snow/80 truncate transition-colors duration-200">
                  {h.address}
                </span>
                <span className="font-mono text-xs font-semibold text-lava flex-shrink-0">
                  {h.dog} DOG
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-dusty/20 group-hover:text-lava/50 flex-shrink-0 transition-colors duration-200" />
              </a>
            ))}
          </div>
        </div>

        {/* Info strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            { Icon: Users,    label: '88,882+',   sub: 'DOG Holders on L1',      iconClass: 'text-lava' },
            { Icon: Database, label: '3,424+',    sub: 'Blocks indexed',          iconClass: 'text-cyan-400' },
            { Icon: Layers,   label: 'Bitcoin L1', sub: 'Rune $DOG — 840000:3',  iconClass: 'text-amber-400' },
          ] as const).map(item => (
            <div key={item.label} className="glass border border-white/[0.04] rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
                <item.Icon className={`w-4 h-4 ${item.iconClass}`} />
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-snow">{item.label}</p>
                <p className="font-mono text-xs text-dusty/50">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </Layout>
  )
}
