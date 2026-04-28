"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Copy, Check, ExternalLink, Search, ArrowRight, Activity, Zap,
  TrendingUp, Shield, Award, Star, AlertTriangle, Layers,
  type LucideIcon
} from "lucide-react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingScreen } from "@/components/loading-screen"

// ─── Types ──────────────────────────────────────────────────────────────────

interface AddressLabel { id: string; text: string; description: string }

const LABEL_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  whale:        { Icon: Zap,           color: 'text-cyan-400' },
  shark:        { Icon: Zap,           color: 'text-blue-400' },
  dolphin:      { Icon: TrendingUp,    color: 'text-teal-400' },
  fish:         { Icon: TrendingUp,    color: 'text-green-400' },
  shrimp:       { Icon: TrendingUp,    color: 'text-yellow-400' },
  plankton:     { Icon: Activity,      color: 'text-dusty/40' },
  top10:        { Icon: Award,         color: 'text-yellow-300' },
  top100:       { Icon: Star,          color: 'text-yellow-400' },
  diamond_paws: { Icon: Shield,        color: 'text-blue-300' },
  dog_legend:   { Icon: Award,         color: 'text-amber-400' },
  hodl_hero:    { Icon: Shield,        color: 'text-purple-400' },
  airdrop_og:   { Icon: Star,          color: 'text-lava' },
  accumulator:  { Icon: TrendingUp,    color: 'text-green-400' },
  paper_hands:  { Icon: AlertTriangle, color: 'text-red-400/70' },
  panic_seller: { Icon: AlertTriangle, color: 'text-red-400' },
  rune_master:  { Icon: Layers,        color: 'text-emerald-400' },
}

interface TxParty {
  address: string
  amount_dog: number
  is_change?: boolean
  holder_rank: number | null
  label: AddressLabel | null
  is_known: boolean
}

interface TxData {
  txid: string
  block_height: number
  timestamp: string
  type: string
  fee_sats: number
  total_dog_moved: number
  senders: TxParty[]
  receivers: TxParty[]
  classification: 'whale_movement' | 'airdrop_og_activity' | 'normal' | 'consolidation'
  mempool_link: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZoneName: 'short'
    })
  } catch { return ts }
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr
  return addr.slice(0, 8) + '…' + addr.slice(-6)
}

const CLASS_BADGE: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  whale_movement:      { label: 'Whale Movement',      Icon: Zap,          className: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  airdrop_og_activity: { label: 'Airdrop OG Activity', Icon: Star,         className: 'text-lava bg-lava/10 border-lava/20' },
  consolidation:       { label: 'Consolidation',       Icon: Layers,       className: 'text-dusty/60 bg-white/[0.03] border-white/[0.06]' },
  normal:              { label: 'Transfer',             Icon: Activity,     className: 'text-dusty/40 bg-white/[0.02] border-white/[0.04]' },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded text-dusty/40 hover:text-snow transition-colors duration-200"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
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

function PartyCard({ party, side }: { party: TxParty; side: 'sender' | 'receiver' }) {
  const accentColor = side === 'sender' ? 'text-red-400' : 'text-green-400'
  const borderClass = party.is_change
    ? 'border-white/[0.03] opacity-40'
    : 'border-white/[0.05] hover:border-lava/[0.12]'

  return (
    <div className={`glass ${borderClass} rounded-xl p-4 flex flex-col gap-2.5 transition-all duration-300`}>
      {/* Address row */}
      <div className="flex items-start gap-1.5">
        <a
          href={`/address/bitcoin/${party.address}`}
          className="flex-1 font-mono text-xs text-dusty/60 hover:text-lava break-all leading-relaxed transition-colors duration-150"
          title={party.address}
        >
          {party.address}
        </a>
        <CopyBtn text={party.address} />
      </div>

      {/* Amount + labels */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-mono text-sm font-bold ${accentColor}`}>
          {fmt(party.amount_dog)} DOG
        </span>
        {party.label && (() => {
          const iconDef = LABEL_ICONS[party.label.id]
          const Icon = iconDef?.Icon
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-white/[0.04] border border-white/[0.06] text-dusty/60">
              {Icon && <Icon className={`w-3 h-3 flex-shrink-0 ${iconDef.color}`} />}
              <span>{party.label.text}</span>
            </span>
          )
        })()}
        {party.holder_rank && (
          <span className="text-xs font-mono text-dusty/35">
            #{party.holder_rank.toLocaleString()}
          </span>
        )}
        {party.is_change && (
          <span className="text-xs font-mono text-dusty/30">(change)</span>
        )}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TxPage() {
  const params = useParams()
  const txid = (params.txid as string).toLowerCase()

  const [data, setData] = useState<TxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/tx/bitcoin/${txid}`)
      .then(r => {
        if (!r.ok) return r.json().then(body => { throw new Error(body?.message || body?.error || `HTTP ${r.status}`) })
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [txid])

  if (loading) return <LoadingScreen message="Loading transaction…" />

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <Layout currentPage="overview" setCurrentPage={() => {}}>
        <div className="pt-4 pb-12 px-3 md:px-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
          <Breadcrumb txid={txid} />
          <Card variant="glass" className="border-red-500/10">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-red-400/80 font-mono text-sm">
                {error || 'Transaction not found.'}
              </p>
              <p className="text-dusty/30 font-mono text-xs">
                This transaction may not have $DOG activity or is not indexed yet.
              </p>
              <a
                href={`https://mempool.space/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-dusty/40 hover:text-lava transition-colors duration-150"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on mempool.space
              </a>
            </CardContent>
          </Card>
          <div className="flex justify-center">
            <ExplorerSearchBar />
          </div>
        </div>
      </Layout>
    )
  }

  const classBadge = CLASS_BADGE[data.classification] || CLASS_BADGE.normal

  return (
    <Layout currentPage="overview" setCurrentPage={() => {}}>
      <div className="pt-4 pb-12 px-3 md:px-6 space-y-6 max-w-5xl mx-auto animate-fade-in">

        <Breadcrumb txid={txid} />

        {/* ── Transaction header ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-lava/10 border border-lava/20 flex items-center justify-center">
                <Activity className="w-3 h-3 text-lava" />
              </div>
              <span className="text-xs font-mono text-lava/70 font-semibold uppercase tracking-wider">Transaction</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full border ${classBadge.className}`}>
              <classBadge.Icon className="w-3 h-3 flex-shrink-0" />
              {classBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <code className="font-mono text-xs text-snow/50 break-all flex-1 leading-relaxed">
              {data.txid}
            </code>
            <div className="flex items-center gap-1 flex-shrink-0">
              <CopyBtn text={data.txid} />
              <a
                href={data.mempool_link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-dusty/40 hover:text-snow transition-colors duration-200"
                title="View on mempool.space"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* ── Meta card ── */}
        <Card variant="glass" className="border-white/[0.04]">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-xs font-mono text-dusty/40 uppercase tracking-wider mb-1">Block</p>
                <p className="font-mono text-sm text-snow">{data.block_height.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-dusty/40 uppercase tracking-wider mb-1">Timestamp</p>
                <p className="font-mono text-xs text-snow/70">{fmtDate(data.timestamp)}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-dusty/40 uppercase tracking-wider mb-1">Total Moved</p>
                <p className="font-mono text-sm font-bold text-lava">{fmt(data.total_dog_moved)} DOG</p>
              </div>
              <div>
                <p className="text-xs font-mono text-dusty/40 uppercase tracking-wider mb-1">Fee</p>
                <p className="font-mono text-sm text-snow/70">{data.fee_sats.toLocaleString()} sats</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Flow diagram ── */}
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Inputs */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-red-500/10" />
              <p className="text-xs font-mono text-dusty/40 uppercase tracking-wider whitespace-nowrap">
                Inputs ({data.senders.length})
              </p>
              <div className="h-px flex-1 bg-red-500/10" />
            </div>
            {data.senders.map((s, i) => (
              <PartyCard key={i} party={s} side="sender" />
            ))}
          </div>

          {/* Arrow */}
          <div className="flex md:flex-col items-center justify-center md:pt-12 px-1 self-center md:self-auto">
            <div className="p-2 rounded-full glass border border-lava/10">
              <ArrowRight className="w-4 h-4 text-lava/40 md:rotate-0 rotate-90" />
            </div>
          </div>

          {/* Outputs */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-green-500/10" />
              <p className="text-xs font-mono text-dusty/40 uppercase tracking-wider whitespace-nowrap">
                Outputs ({data.receivers.length})
              </p>
              <div className="h-px flex-1 bg-green-500/10" />
            </div>
            {data.receivers.map((r, i) => (
              <PartyCard key={i} party={r} side="receiver" />
            ))}
          </div>
        </div>

        {/* ── External link ── */}
        <div className="flex justify-center gap-6 pt-2">
          <a
            href={data.mempool_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-dusty/30 hover:text-lava transition-colors duration-150"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View tx on mempool.space
          </a>
          <a
            href={`https://mempool.space/block-height/${data.block_height}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-dusty/30 hover:text-lava transition-colors duration-150"
          >
            <Zap className="w-3.5 h-3.5" />
            View block {data.block_height.toLocaleString()}
          </a>
        </div>

      </div>
    </Layout>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Breadcrumb({ txid }: { txid: string }) {
  return (
    <nav className="flex items-center gap-2 text-xs font-mono text-dusty/40">
      <a href="/explorer" className="hover:text-lava transition-colors duration-150">Explorer</a>
      <span>/</span>
      <span className="text-dusty/25 truncate max-w-[200px] md:max-w-sm">{txid}</span>
    </nav>
  )
}
