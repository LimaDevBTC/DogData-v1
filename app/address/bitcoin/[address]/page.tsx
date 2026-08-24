"use client"

import { useState, useEffect } from "react"
import { EntityTag, type Identity } from "@/components/entity-tag"
import { useParams, useRouter } from "next/navigation"
import {
  Copy, Check, ExternalLink, Search, ArrowDownLeft, ArrowUpRight,
  ArrowLeftRight, ArrowLeft, ChevronLeft, ChevronRight, Filter,
  Activity, TrendingDown, Hash, Zap, Shield, Star, Award,
  TrendingUp, AlertTriangle, Clock, Layers, Bitcoin, Eye,
  type LucideIcon
} from "lucide-react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingScreen } from "@/components/loading-screen"

// ─── Types ─────────────────────────────────────────────────────────────────

interface AddressLabel { id: string; text: string; description: string }

// ─── Label icon map (id → Lucide icon + color) ──────────────────────────────

const LABEL_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  whale:             { Icon: Zap,           color: 'text-cyan-400' },
  shark:             { Icon: Zap,           color: 'text-blue-400' },
  dolphin:           { Icon: TrendingUp,    color: 'text-teal-400' },
  fish:              { Icon: TrendingUp,    color: 'text-green-400' },
  shrimp:            { Icon: TrendingUp,    color: 'text-yellow-400' },
  plankton:          { Icon: Activity,      color: 'text-dusty/50' },
  top10:             { Icon: Award,         color: 'text-yellow-300' },
  top100:            { Icon: Star,          color: 'text-yellow-400' },
  diamond_paws:      { Icon: Shield,        color: 'text-blue-300' },
  dog_legend:        { Icon: Award,         color: 'text-amber-400' },
  hodl_hero:         { Icon: Shield,        color: 'text-purple-400' },
  satoshi_visionary: { Icon: Eye,           color: 'text-violet-400' },
  rune_master:       { Icon: Layers,        color: 'text-emerald-400' },
  steady_holder:     { Icon: Shield,        color: 'text-slate-400' },
  ordinal_believer:  { Icon: Layers,        color: 'text-indigo-400' },
  btc_maximalist:    { Icon: Bitcoin,       color: 'text-orange-400' },
  airdrop_og:        { Icon: Star,          color: 'text-lava' },
  accumulator:       { Icon: TrendingUp,    color: 'text-green-400' },
  paper_hands:       { Icon: TrendingDown,  color: 'text-red-400/70' },
  panic_seller:      { Icon: AlertTriangle, color: 'text-red-400' },
  profit_taker:      { Icon: TrendingUp,    color: 'text-orange-400' },
  early_exit:        { Icon: Clock,         color: 'text-red-400/60' },
}

interface TxEntry {
  txid: string; block_height: number; timestamp: string
  direction: 'in' | 'out' | 'self'; amount_dog: number
  counterparty: string | null; counterparties: string[]
  total_dog_moved: number; fee_sats: number
  synthetic?: boolean; synthetic_label?: string
}

interface AddressData {
  address: string
  status: 'holder' | 'forensic_only' | 'tx_only' | 'not_a_dog_holder'
  holder: { rank: number; total_dog: number; total_amount: number; utxo_count: number; percentile: number } | null
  forensic: {
    behavior_pattern: string; behavior_detail: string; airdrop_rank: number
    airdrop_amount: number; current_balance: number; retention_rate: number
    diamond_score: number; is_dumping: boolean; insights: string[]
  } | null
  labels: AddressLabel[]
  /** quem e o dono, quando a gente sabe. Ver lib/dog/identity.ts */
  entity: Identity | null
  transactions: TxEntry[]
  tx_count: number
  stats: {
    total_received_dog: number; total_sent_dog: number
    first_tx_timestamp: string | null; last_tx_timestamp: string | null
    first_tx_block: number | null; last_tx_block: number | null
    largest_single_receive: number; largest_single_send: number
  }
  metadata: { indexed_blocks: number; last_updated: string; total_holders: number; block_range?: { from: number; to: number } }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function fmtDate(ts: string | null): string {
  if (!ts) return '—'
  try { return new Date(ts).toISOString().split('T')[0] } catch { return '—' }
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr
  return addr.slice(0, 8) + '…' + addr.slice(-6)
}

// ─── Label badge colors matching the design system ──────────────────────────

const LABEL_STYLES: Record<string, string> = {
  whale:          'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  shark:          'text-blue-400 bg-blue-400/10 border-blue-400/20',
  dolphin:        'text-teal-400 bg-teal-400/10 border-teal-400/20',
  fish:           'text-green-400 bg-green-400/10 border-green-400/20',
  shrimp:         'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  plankton:       'text-dusty bg-white/[0.03] border-white/[0.06]',
  diamond_paws:   'text-blue-300 bg-blue-300/10 border-blue-300/20',
  dog_legend:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
  hodl_hero:      'text-purple-400 bg-purple-400/10 border-purple-400/20',
  satoshi_visionary: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  rune_master:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  airdrop_og:     'text-lava bg-lava/10 border-lava/20',
  top10:          'text-yellow-300 bg-yellow-300/10 border-yellow-300/20',
  top100:         'text-yellow-400 bg-yellow-400/[0.08] border-yellow-400/15',
  accumulator:    'text-green-400 bg-green-400/10 border-green-400/20',
  paper_hands:    'text-red-400/70 bg-red-400/[0.06] border-red-400/15',
  panic_seller:   'text-red-400 bg-red-400/10 border-red-400/20',
  profit_taker:   'text-orange-400 bg-orange-400/10 border-orange-400/20',
}
const DEFAULT_LABEL_STYLE = 'text-dusty bg-white/[0.03] border-white/[0.06]'

// ─── Sub-components ─────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded text-dusty/50 hover:text-snow transition-colors duration-200"
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-400" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function LabelBadge({ label }: { label: AddressLabel }) {
  const cls = LABEL_STYLES[label.id] || DEFAULT_LABEL_STYLE
  const iconDef = LABEL_ICONS[label.id]
  const Icon = iconDef?.Icon
  const iconColor = iconDef?.color || 'text-dusty/50'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border ${cls}`}
      title={label.description}
    >
      {Icon && <Icon className={`w-3 h-3 ${iconColor} flex-shrink-0`} />}
      <span>{label.text}</span>
    </span>
  )
}

function StatCard({
  label, value, sub, valueClass = 'text-snow'
}: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="glass border border-white/[0.04] hover:border-lava/[0.1] rounded-xl p-4 flex flex-col gap-1 transition-colors duration-300">
      <span className="text-xs font-mono text-dusty/50 uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-mono font-semibold ${valueClass}`}>{value}</span>
      {sub && <span className="text-xs font-mono text-dusty/40">{sub}</span>}
    </div>
  )
}

function DirectionIcon({ dir }: { dir: 'in' | 'out' | 'self' }) {
  if (dir === 'in')   return <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
  if (dir === 'out')  return <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
  return <ArrowLeftRight className="w-3.5 h-3.5 text-dusty/40" />
}

function ExplorerSearchBar() {
  const router = useRouter()
  const [q, setQ] = useState("")
  const go = () => {
    const s = q.trim()
    if (!s) return
    if (/^[0-9a-fA-F]{64}$/.test(s)) router.push(`/tx/bitcoin/${s.toLowerCase()}`)
    else router.push(`/address/bitcoin/${s}`)
  }
  return (
    <div className="flex items-center gap-2 bg-void/80 border border-white/[0.06] focus-within:border-lava/30 rounded-lg px-3 py-1.5 transition-all duration-200">
      <Search className="w-3.5 h-3.5 text-dusty/40 flex-shrink-0" />
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && go()}
        placeholder="Search address or txid…"
        className="w-36 md:w-52 bg-transparent text-xs font-mono text-snow/70 placeholder-dusty/30 outline-none"
        spellCheck={false}
      />
    </div>
  )
}

function TxRow({ tx }: { tx: TxEntry }) {
  const counterparty = tx.counterparty || (tx.counterparties?.[0] ?? null)
  const extraCount = (tx.counterparties?.length || 0) > 1 ? tx.counterparties.length - 1 : 0

  const amountClass = tx.direction === 'in'
    ? 'text-green-400'
    : tx.direction === 'out'
      ? 'text-red-400'
      : 'text-dusty'

  if (tx.synthetic) {
    return (
      <tr className="border-b border-white/[0.03] bg-lava/[0.02]">
        <td className="py-2.5 pl-4 pr-2 w-8">
          <div className="flex items-center justify-center">
            <ArrowDownLeft className="w-3.5 h-3.5 text-green-400/60" />
          </div>
        </td>
        <td className={`py-2.5 px-2 font-mono text-xs font-semibold text-green-400/70 whitespace-nowrap`}>
          {fmt(tx.amount_dog)} DOG
        </td>
        <td className="py-2.5 px-2 font-mono text-xs text-dusty/40 italic" colSpan={3}>
          {tx.synthetic_label || 'DOG Airdrop'}
        </td>
        <td className="py-2.5 pl-2 pr-4 font-mono text-xs text-dusty/20 italic">
          est. block ~840,000
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-white/[0.03] hover:bg-lava/[0.02] transition-colors duration-150 group">
      {/* Direction */}
      <td className="py-2.5 pl-4 pr-2 w-8">
        <div className="flex items-center justify-center">
          <DirectionIcon dir={tx.direction} />
        </div>
      </td>
      {/* Amount */}
      <td className={`py-2.5 px-2 font-mono text-xs font-semibold ${amountClass} whitespace-nowrap`}>
        {fmt(tx.amount_dog)} DOG
      </td>
      {/* Counterparty */}
      <td className="py-2.5 px-2 font-mono text-xs max-w-[180px]">
        {counterparty ? (
          <a
            href={`/address/bitcoin/${counterparty}`}
            className="text-dusty/60 hover:text-lava transition-colors duration-150"
            title={counterparty}
          >
            {shortAddr(counterparty)}
          </a>
        ) : (
          <span className="text-dusty/25">—</span>
        )}
        {extraCount > 0 && <span className="text-dusty/30 ml-1">+{extraCount}</span>}
      </td>
      {/* Block */}
      <td className="py-2.5 px-2 font-mono text-xs text-dusty/50 whitespace-nowrap hidden md:table-cell">
        {tx.block_height.toLocaleString()}
      </td>
      {/* Date */}
      <td className="py-2.5 px-2 font-mono text-xs text-dusty/40 whitespace-nowrap hidden sm:table-cell">
        {fmtDate(tx.timestamp)}
      </td>
      {/* Txid */}
      <td className="py-2.5 pl-2 pr-4 font-mono text-xs">
        <a
          href={`/tx/bitcoin/${tx.txid}`}
          className="text-dusty/30 hover:text-lava transition-colors duration-150"
          title={tx.txid}
        >
          {tx.txid.slice(0, 8)}…
        </a>
      </td>
    </tr>
  )
}

// ─── UTXO breakdown card ─────────────────────────────────────────────────────

interface UtxoRow {
  txid: string; vout: number; dog: number
  age_days: number; ts: number | null; lth: boolean; pct: number
}
interface UtxoResponse {
  address: string; total: number; total_dog: number
  lth_utxos: number; sth_utxos: number
  page: number; limit: number; total_pages: number
  sort: string; utxos: UtxoRow[]
}

function fmtAge(days: number): string {
  if (days >= 365) return (days / 365).toFixed(1) + 'y'
  if (days >= 1) return Math.round(days) + 'd'
  return '<1d'
}

function fmtTs(ts: number | null): string {
  if (!ts) return '—'
  try { return new Date(ts * 1000).toISOString().split('T')[0] } catch { return '—' }
}

const UTXO_SORTS: { key: string; label: string }[] = [
  { key: 'age_desc', label: 'Oldest' },
  { key: 'age_asc', label: 'Newest' },
  { key: 'dog_desc', label: 'Largest' },
]

const UTXO_PAGE_SIZE = 25

function UtxoCard({ address }: { address: string }) {
  const [data, setData] = useState<UtxoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('age_desc')

  useEffect(() => { setPage(1) }, [sort])

  useEffect(() => {
    setLoading(true)
    const url = `/api/address/bitcoin/${encodeURIComponent(address)}/utxos?page=${page}&limit=${UTXO_PAGE_SIZE}&sort=${sort}`
    fetch(url)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [address, page, sort])

  // UTXO snapshot not generated yet (or address has none) — hide the card silently.
  if (notFound) return null
  if (!loading && data && data.total === 0) return null

  return (
    <Card variant="glass" className="border-white/[0.04]">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base text-lava">
            <Layers className="w-4 h-4" />
            DOG UTXOs
            {data && (
              <span className="text-dusty/40 font-mono text-sm font-normal">
                ({data.total.toLocaleString()})
              </span>
            )}
          </CardTitle>

          <div className="flex items-center gap-3 flex-wrap">
            {data && (
              <span className="text-xs font-mono text-dusty/50">
                <span className="text-amber-400">{data.lth_utxos.toLocaleString()} LTH</span>
                {' · '}
                <span className="text-emerald-400">{data.sth_utxos.toLocaleString()} STH</span>
              </span>
            )}
            <div className="flex items-center gap-1 glass border border-white/[0.04] rounded-lg p-1">
              {UTXO_SORTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all duration-200 ${
                    sort === s.key
                      ? 'bg-lava/10 text-lava border border-lava/20'
                      : 'text-dusty/50 hover:text-snow border border-transparent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-void/40 backdrop-blur-sm z-10 flex items-center justify-center">
              <span className="text-dusty/60 text-xs font-mono">Loading…</span>
            </div>
          )}
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04] text-left">
                <th className="pb-2 pl-4 pr-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal">UTXO</th>
                <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal text-right">DOG</th>
                <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal text-right hidden sm:table-cell">% wallet</th>
                <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal text-right">Age</th>
                <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal hidden md:table-cell">Date</th>
                <th className="pb-2 pl-2 pr-4 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal text-right">Cohort</th>
              </tr>
            </thead>
            <tbody>
              {data?.utxos.map(u => (
                <tr key={`${u.txid}:${u.vout}`} className="border-b border-white/[0.03] hover:bg-lava/[0.02] transition-colors duration-150">
                  <td className="py-2.5 pl-4 pr-2 font-mono text-xs">
                    <a
                      href={`/tx/bitcoin/${u.txid}`}
                      className="text-dusty/50 hover:text-lava transition-colors duration-150"
                      title={`${u.txid}:${u.vout}`}
                    >
                      {u.txid.slice(0, 10)}…:{u.vout}
                    </a>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-xs font-semibold text-snow/80 text-right whitespace-nowrap">
                    {fmt(u.dog)}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-xs text-dusty/50 text-right hidden sm:table-cell">
                    {u.pct.toFixed(u.pct < 0.01 ? 4 : 2)}%
                  </td>
                  <td className="py-2.5 px-2 font-mono text-xs text-dusty/60 text-right whitespace-nowrap">
                    {fmtAge(u.age_days)}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-xs text-dusty/40 hidden md:table-cell whitespace-nowrap">
                    {fmtTs(u.ts)}
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                      u.lth
                        ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                        : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                    }`}>
                      {u.lth ? 'LTH' : 'STH'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.03] flex items-start gap-2 text-xs font-mono text-dusty/30">
          <Clock className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>Coin age = time since each UTXO was created (last moved). LTH ≥155d · STH &lt;155d.</span>
        </div>

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
            <span className="text-xs font-mono text-dusty/40">
              Page {data.page} of {data.total_pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 rounded-lg border border-white/[0.06] text-dusty/40 hover:text-snow hover:border-lava/20 disabled:opacity-25 transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages || loading}
                className="p-1.5 rounded-lg border border-white/[0.06] text-dusty/40 hover:text-snow hover:border-lava/20 disabled:opacity-25 transition-all duration-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

export default function AddressPage() {
  const params = useParams()
  const address = decodeURIComponent(params.address as string)

  const [data, setData] = useState<AddressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/address/bitcoin/${encodeURIComponent(address)}`)
      .then(r => {
        if (!r.ok) return r.json().then(body => { throw new Error(body?.message || `HTTP ${r.status}`) })
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [address])

  if (loading) return <LoadingScreen message="Loading address data…" />

  const mempoolLink = `https://mempool.space/address/${address}`

  // ── Not a DOG holder ───────────────────────────────────────────────────────
  if (!error && data?.status === 'not_a_dog_holder') {
    return (
      <Layout currentPage="explorer" setCurrentPage={() => {}}>
        <div className="pt-4 pb-12 px-3 md:px-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
          <BackButton />
          <AddressHeader address={address} mempoolLink={mempoolLink} labels={[]} />
          <Card variant="glass" className="border-white/[0.04]">
            <CardContent className="pt-8 pb-8 text-center space-y-2">
              <p className="text-dusty font-mono text-sm">This address has no $DOG activity.</p>
              <p className="text-dusty/40 font-mono text-xs">Not a DOG holder — yet?</p>
            </CardContent>
          </Card>
          <div className="flex justify-center">
            <ExplorerSearchBar />
          </div>
        </div>
      </Layout>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <Layout currentPage="explorer" setCurrentPage={() => {}}>
        <div className="pt-4 pb-12 px-3 md:px-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
          <BackButton />
          <Card variant="glass" className="border-red-500/10">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-red-400/80 font-mono text-sm">{error || 'Failed to load data.'}</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  // ── Filter + pagination ────────────────────────────────────────────────────
  const filteredTxs = data.transactions.filter(tx => filter === 'all' || tx.direction === filter)
  const totalPages = Math.ceil(filteredTxs.length / PAGE_SIZE)
  const pageTxs = filteredTxs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <Layout currentPage="explorer" setCurrentPage={() => {}}>
      <div className="pt-4 pb-12 px-3 md:px-6 space-y-6 max-w-6xl mx-auto animate-fade-in">

        <BackButton />

        {/* ── Address header + labels ── */}
        <AddressHeader address={address} mempoolLink={mempoolLink} labels={data.labels} entity={data.entity} />

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {data.holder && (
            <>
              <StatCard label="$DOG Balance" value={fmt(data.holder.total_dog) + ' DOG'} valueClass="text-lava" />
              <StatCard
                label="Rank"
                value={`#${data.holder.rank.toLocaleString()}`}
                sub={`Top ${data.holder.percentile.toFixed(data.holder.percentile < 0.01 ? 4 : 2)}%`}
              />
              <StatCard label="UTXOs" value={data.holder.utxo_count.toString()} />
            </>
          )}
          {data.stats.total_received_dog > 0 && (
            <StatCard label="Total Received" value={fmt(data.stats.total_received_dog) + ' DOG'} valueClass="text-green-400" />
          )}
          {data.stats.total_sent_dog > 0 && (
            <StatCard label="Total Sent" value={fmt(data.stats.total_sent_dog) + ' DOG'} valueClass="text-red-400/80" />
          )}
          {data.stats.first_tx_block && (
            <StatCard
              label="First Activity"
              value={`Block ${data.stats.first_tx_block.toLocaleString()}`}
              sub={fmtDate(data.stats.first_tx_timestamp)}
            />
          )}
          {data.stats.last_tx_block && (
            <StatCard
              label="Last Activity"
              value={`Block ${data.stats.last_tx_block.toLocaleString()}`}
              sub={fmtDate(data.stats.last_tx_timestamp)}
            />
          )}
          <StatCard label="DOG Transactions" value={data.tx_count.toString()} />
        </div>

        {/* ── Forensic card ── */}
        {data.forensic && (
          <Card variant="glass" className="border-lava/[0.08] hover:border-lava/[0.15]">
            <CardHeader>
              <CardTitle className="text-lava flex items-center gap-2 text-base">
                <Activity className="w-4 h-4" />
                Forensic Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-mono text-sm text-snow/80">{data.forensic.behavior_detail}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-dusty/60">
                <span>
                  Airdrop rank:{' '}
                  <span className="text-snow/70">#{data.forensic.airdrop_rank.toLocaleString()}</span>
                </span>
                <span>
                  Airdrop amount:{' '}
                  <span className="text-snow/70">{fmt(data.forensic.airdrop_amount)} DOG</span>
                </span>
                <span>
                  Retention:{' '}
                  <span className={
                    data.forensic.retention_rate >= 80 ? 'text-green-400' :
                    data.forensic.retention_rate >= 20 ? 'text-yellow-400' : 'text-red-400'
                  }>
                    {data.forensic.retention_rate.toFixed(1)}%
                  </span>
                </span>
                <span>
                  Diamond score:{' '}
                  <span className="text-blue-400">{data.forensic.diamond_score}</span>
                </span>
                {data.forensic.is_dumping && (
                  <span className="text-red-400 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Currently dumping
                  </span>
                )}
              </div>
              {data.forensic.insights.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {data.forensic.insights.map((ins, i) => (
                    <span key={i} className="text-xs font-mono text-dusty/50 glass border border-white/[0.04] px-2.5 py-0.5 rounded-full">
                      {ins}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── DOG UTXO breakdown ── */}
        {data.holder && <UtxoCard address={address} />}

        {/* ── Transaction history ── */}
        {data.tx_count > 0 && (
          <Card variant="glass" className="border-white/[0.04]">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2 text-base text-lava">
                  <Hash className="w-4 h-4" />
                  Transaction History
                  <span className="text-dusty/40 font-mono text-sm font-normal">
                    ({data.tx_count})
                  </span>
                </CardTitle>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 glass border border-white/[0.04] rounded-lg p-1">
                  <Filter className="w-3 h-3 text-dusty/30 ml-1 mr-0.5 flex-shrink-0" />
                  {(['all', 'in', 'out'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setFilter(f); setPage(1) }}
                      className={`px-3 py-1 text-xs font-mono rounded-md transition-all duration-200 ${
                        filter === f
                          ? 'bg-lava/10 text-lava border border-lava/20'
                          : 'text-dusty/50 hover:text-snow border border-transparent'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'in' ? '← IN' : 'OUT →'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04] text-left">
                      <th className="pb-2 pl-4 pr-2 w-8" />
                      <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal">Amount</th>
                      <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal">Counterparty</th>
                      <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal hidden md:table-cell">Block</th>
                      <th className="pb-2 px-2 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal hidden sm:table-cell">Date</th>
                      <th className="pb-2 pl-2 pr-4 text-xs font-mono text-dusty/40 uppercase tracking-wider font-normal">Txid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTxs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-dusty/30 font-mono text-sm">
                          No transactions
                        </td>
                      </tr>
                    ) : (
                      pageTxs.map(tx => <TxRow key={tx.txid} tx={tx} />)
                    )}
                  </tbody>
                </table>
              </div>

              {/* Coverage notice */}
              <div className="mt-3 pt-3 border-t border-white/[0.03] flex items-start gap-2 text-xs font-mono text-dusty/30">
                <Clock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>
                  Indexed range: blocks{' '}
                  {(data.metadata.block_range?.from ?? 941111).toLocaleString()}–
                  {(data.metadata.block_range?.to ?? 946936).toLocaleString()}.
                  Earlier activity (incl. the DOG airdrop at ~block 840,000) appears as an estimate where available.
                </span>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
                  <span className="text-xs font-mono text-dusty/40">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg border border-white/[0.06] text-dusty/40 hover:text-snow hover:border-lava/20 disabled:opacity-25 transition-all duration-200"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-white/[0.06] text-dusty/40 hover:text-snow hover:border-lava/20 disabled:opacity-25 transition-all duration-200"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function BackButton() {
  const router = useRouter()
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/explorer')
  }
  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-lava/20 text-dusty/60 hover:text-snow text-xs font-mono transition-all duration-200"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back
    </button>
  )
}

function AddressHeader({
  address, mempoolLink, labels, entity
}: { address: string; mempoolLink: string; labels: AddressLabel[]; entity?: Identity | null }) {
  return (
    <div className="space-y-3">
      {/* A IDENTIDADE VEM ANTES DO ENDERECO, em cima de tudo. Quem abre a pagina
          de uma carteira quer saber de quem ela e; o endereco em si e so o
          identificador. A pagina de holders ja dava essa resposta e esta aqui
          nao dava, que foi o defeito apontado. */}
      {entity && (
        <div className="flex items-center gap-2">
          <EntityTag identity={entity} />
          {entity.website && (
            <a
              href={entity.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-mono text-[10px] text-dusty/40 underline-offset-2 hover:text-lava hover:underline"
            >
              {entity.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      )}

      {/* Address row */}
      <div className="flex items-start gap-2 flex-wrap">
        <code className="font-mono text-xs text-snow/60 break-all flex-1 leading-relaxed">
          {address}
        </code>
        <div className="flex items-center gap-1 flex-shrink-0">
          <CopyBtn text={address} />
          <a
            href={mempoolLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-dusty/40 hover:text-snow transition-colors duration-200"
            title="View on mempool.space"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Labels row */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map(l => <LabelBadge key={l.id} label={l} />)}
        </div>
      )}
    </div>
  )
}

