"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { X, ExternalLink, Search, ChevronLeft, ChevronRight, Copy, Database } from "lucide-react"

interface RunestoneStats {
  snapshot_block: number
  snapshot_date: string
  total_holders: number
  total_stones: number
  multi_stone_holders: number
  single_stone_holders: number
  max_stones_one_wallet: number
  still_holding_dog: number
  retention_rate: number
  last_updated: string | null
}

interface RunestoneHolder {
  rank: number
  address: string
  stones: number
  airdrop_dog: number
  current_dog: number
  behavior: string
  diamond_score: number
}

interface HoldersData {
  holders: RunestoneHolder[]
  total: number
  page: number
  limit: number
  pages: number
}

const RUNE_GLYPHS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ"
const LIMIT = 25

function GlyphBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden select-none opacity-[0.035]"
      style={{ fontFamily: "monospace", fontSize: "1rem", lineHeight: "1.5rem", wordBreak: "break-all", color: "#F56E0F" }}
    >
      {RUNE_GLYPHS.repeat(400)}
    </div>
  )
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n))

function fmtDog(n: number) {
  if (n === 0) return "—"
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return fmt(n)
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`
}

const BEHAVIOR_COLOR: Record<string, string> = {
  satoshi_visionary: "text-emerald-400",
  btc_maximalist:    "text-emerald-400",
  rune_master:       "text-emerald-400",
  ordinal_believer:  "text-emerald-400",
  dog_legend:        "text-emerald-400",
  diamond_paws:      "text-purple-400",
  hodl_hero:         "text-sky-400",
  steady_holder:     "text-sky-400/80",
  profit_taker:      "text-yellow-400/70",
  early_exit:        "text-orange-400/70",
  panic_seller:      "text-red-400/70",
  paper_hands:       "text-red-500/60",
}

const BEHAVIOR_LABEL: Record<string, string> = {
  satoshi_visionary: "Satoshi",
  btc_maximalist:    "BTC Maxi",
  rune_master:       "Rune Master",
  ordinal_believer:  "OG Believer",
  dog_legend:        "DOG Supporter",
  diamond_paws:      "Diamond Paws",
  hodl_hero:         "Hodl Hero",
  steady_holder:     "Steady",
  profit_taker:      "Profit Taker",
  early_exit:        "Early Exit",
  panic_seller:      "Panic Sell",
  paper_hands:       "Paper Hands",
}

function StonesTag({ n }: { n: number }) {
  const color =
    n >= 500  ? "bg-[#F56E0F]/20 text-[#F56E0F] border-[#F56E0F]/30" :
    n >= 100  ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
    n >= 10   ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                "bg-white/[0.04] text-snow/70 border-white/[0.07]"
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-sm font-bold ${color}`}>
      {fmt(n)} <span className="text-[10px] opacity-70">🪨</span>
    </span>
  )
}

export function RunestoneEasterEgg({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [stats, setStats]           = useState<RunestoneStats | null>(null)
  const [data, setData]             = useState<HoldersData | null>(null)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [minStones, setMinStones]   = useState(1)
  const [loading, setLoading]       = useState(false)
  const [copied, setCopied]         = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    fetch("/api/runestone/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d))
      .catch(() => {})
  }, [isOpen])

  const loadHolders = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), min_stones: String(minStones) })
    if (search) p.set("address", search)
    fetch(`/api/runestone/holders?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, search, minStones])

  useEffect(() => { if (isOpen) loadHolders() }, [isOpen, loadHolders])

  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [isOpen, onClose])

  const doSearch = () => { setPage(1); setSearch(searchInput) }
  const clearSearch = () => { setSearchInput(""); setSearch(""); setPage(1) }
  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopied(addr)
    setTimeout(() => setCopied(null), 1500)
  }

  if (!isOpen) return null

  const totalPages = data?.pages ?? 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[95vh] flex flex-col rounded-2xl border border-[#F56E0F]/20 bg-[#060604] shadow-[0_0_120px_-20px_rgba(245,110,15,0.4)]"
      >
        <GlyphBg />

        {/* ── Header ── */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.05] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#F56E0F]/30 blur-xl animate-pulse" />
              <Image src="/Runestone.png" alt="Runestone" width={44} height={44} className="relative rounded-xl" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-mono text-[#F56E0F]/50 uppercase tracking-[0.3em]">ᚠ Ordinal Collection · Bitcoin Mainnet ᚠ</div>
              <h2 className="text-xl font-bold text-snow leading-tight tracking-tight">The Runestone</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Database className="w-2.5 h-2.5 text-[#F56E0F]/60" />
                <span className="text-dusty text-[10px] font-mono">Dados: ord indexer local · bloco 840,000 snapshot</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-dusty hover:text-snow hover:bg-white/[0.06] transition-colors flex-shrink-0 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="relative z-10 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(245,110,15,0.15) transparent" }}>
          <div className="px-5 py-4 space-y-5">

            {/* ── Stats ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#F56E0F] text-[10px] font-mono uppercase tracking-widest">Snapshot · Bloco 840,000 · 20 Abr 2024</span>
                {stats?.last_updated && (
                  <span className="text-dusty/40 text-[10px] font-mono">
                    atualizado {new Date(stats.last_updated).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "Holders únicos",        value: fmt(stats.total_holders),         sub: "endereços com ≥1 pedra",     color: "text-snow" },
                    { label: "Total de Runestones",   value: fmt(stats.total_stones),          sub: "pedras no snapshot",         color: "text-[#F56E0F]" },
                    { label: "Multi-stone holders",   value: fmt(stats.multi_stone_holders),   sub: `máx: ${fmt(stats.max_stones_one_wallet)} pedras`,  color: "text-amber-400" },
                    { label: "Ainda com DOG",         value: `${stats.retention_rate.toFixed(1)}%`,  sub: `${fmt(stats.still_holding_dog)} endereços`, color: "text-emerald-400" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <div className="text-dusty text-[10px] font-mono uppercase tracking-widest mb-1">{s.label}</div>
                      <div className={`text-lg font-bold font-mono leading-tight ${s.color}`}>{s.value}</div>
                      <div className="text-dusty/60 text-[10px] font-mono mt-0.5">{s.sub}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-dusty/40 text-xs font-mono animate-pulse">
                  Lendo índice ord…
                </div>
              )}
            </section>

            {/* ── Holder Leaderboard ── */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-[#F56E0F] text-[10px] font-mono uppercase tracking-widest">
                    Holders de Runestone
                  </span>
                  {data && (
                    <span className="text-dusty/50 text-[10px] font-mono">{fmt(data.total)} endereços</span>
                  )}
                  {/* Filter chips */}
                  <div className="flex gap-1">
                    {[1, 2, 10, 100].map(n => (
                      <button
                        key={n}
                        onClick={() => { setMinStones(n); setPage(1) }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${minStones === n ? "bg-[#F56E0F]/15 text-[#F56E0F] border-[#F56E0F]/30" : "bg-white/[0.02] text-dusty border-white/[0.06] hover:border-white/[0.15]"}`}
                      >
                        {n === 1 ? "todos" : `≥${n}🪨`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Search */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="buscar endereço…"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && doSearch()}
                    className="h-7 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-snow text-xs font-mono placeholder:text-dusty/40 focus:outline-none focus:border-[#F56E0F]/40 w-40"
                  />
                  <button onClick={doSearch} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#F56E0F]/10 border border-[#F56E0F]/20 hover:bg-[#F56E0F]/20 transition-colors">
                    <Search className="w-3.5 h-3.5 text-[#F56E0F]" />
                  </button>
                  {search && (
                    <button onClick={clearSearch} className="h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-dusty hover:text-snow text-xs font-mono transition-colors">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className={`rounded-xl border border-white/[0.05] overflow-hidden transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.025]">
                      {["#", "Endereço", "Runestones", "DOG Recebido", "DOG Atual", "Behavior", ""].map((h, i) => (
                        <th key={i} className={`px-3 py-2.5 text-[#F56E0F]/60 font-medium text-[10px] uppercase tracking-wider ${i === 0 ? "text-left" : i <= 2 ? "text-left" : i === 3 || i === 4 ? "text-right hidden sm:table-cell" : i === 5 ? "text-center hidden md:table-cell" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.holders.map(h => (
                      <tr key={h.address} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2 text-dusty/60 w-8">{h.rank}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-snow/80 font-mono">{truncAddr(h.address)}</span>
                            <button onClick={() => copyAddr(h.address)} className="text-dusty hover:text-snow transition-colors flex-shrink-0">
                              {copied === h.address
                                ? <span className="text-green-400 text-[9px]">✓</span>
                                : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <StonesTag n={h.stones} />
                        </td>
                        <td className="px-3 py-2 text-right text-snow/50 hidden sm:table-cell">{fmtDog(h.airdrop_dog)}</td>
                        <td className="px-3 py-2 text-right hidden sm:table-cell">
                          <span className={h.current_dog > 0 ? "text-snow/80" : "text-dusty/30"}>{fmtDog(h.current_dog)}</span>
                        </td>
                        <td className="px-3 py-2 text-center hidden md:table-cell">
                          <span className={`text-[10px] ${BEHAVIOR_COLOR[h.behavior] ?? "text-dusty"}`}>
                            {BEHAVIOR_LABEL[h.behavior] ?? h.behavior}
                          </span>
                        </td>
                        <td className="px-2 py-2 w-6">
                          <a href={`https://mempool.space/address/${h.address}`} target="_blank" rel="noopener noreferrer" className="text-dusty hover:text-[#F56E0F] transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {!data && (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-dusty/40 animate-pulse">Carregando holders…</td></tr>
                    )}
                    {data?.holders.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-dusty/50">Nenhum resultado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-dusty/50 text-[10px] font-mono">
                    página {page} de {totalPages} · {data ? fmt(data.total) : "—"} holders
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/[0.06] text-dusty hover:text-snow hover:border-white/[0.15] disabled:opacity-25 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/[0.06] text-dusty hover:text-snow hover:border-white/[0.15] disabled:opacity-25 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Explore links ── */}
            <section className="grid grid-cols-2 gap-2">
              {[
                { label: "DOG•GO•TO•THE•MOON · ord.io", href: "https://ord.io/840000:3" },
                { label: "Bloco 840,000 · mempool.space", href: "https://mempool.space/block/840000" },
              ].map(l => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#F56E0F]/25 hover:bg-[#F56E0F]/[0.03] transition-all group">
                  <span className="text-snow/60 text-[11px] font-mono group-hover:text-snow transition-colors">{l.label}</span>
                  <ExternalLink className="w-3 h-3 text-dusty group-hover:text-[#F56E0F] transition-colors ml-2 flex-shrink-0" />
                </a>
              ))}
            </section>

            <div className="text-center pb-1">
              <p className="text-dusty/25 text-[10px] font-mono tracking-widest">ᚠ Only those who know, know ᚠ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
