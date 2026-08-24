"use client"

import { useState, useEffect } from "react"
import { EntityTag, type Identity } from "@/components/entity-tag"
import { useParams, useRouter } from "next/navigation"
import {
  Copy, Check, Search, ArrowLeft, Activity, Zap,
  TrendingUp, Shield, Award, Star, AlertTriangle, Layers,
  CheckCircle2, FileCode2,
  type LucideIcon,
} from "lucide-react"
import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
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
  dog_legend:   { Icon: Award,         color: 'text-amber' }, // escala não existe neste tema
  hodl_hero:    { Icon: Shield,        color: 'text-purple-400' },
  airdrop_og:   { Icon: Star,          color: 'text-lava' },
  accumulator:  { Icon: TrendingUp,    color: 'text-green-400' },
  paper_hands:  { Icon: AlertTriangle, color: 'text-red-400/70' },
  panic_seller: { Icon: AlertTriangle, color: 'text-red-400' },
  rune_master:  { Icon: Layers,        color: 'text-emerald-400' },
}

interface IO {
  position: number
  address: string | null
  sats: number
  script_type: string | null
  amount_dog: number
  is_change?: boolean
  is_op_return?: boolean
  op_return_hex?: string
  holder_rank: number | null
  label: AddressLabel | null
  is_known: boolean
  /** quem e o dono, quando a gente sabe. Ver lib/dog/identity.ts */
  entity: Identity | null
}

interface TxData {
  txid: string
  /** ⚠️ `pending` é transação ainda em órbita, vista pelo nosso nó na mempool e
   *  ainda sem bloco. A praça linka para cá a partir de cada foguete, então esta
   *  página precisa saber existir antes da confirmação. */
  status?: 'pending' | 'confirmed' | 'dropped'
  first_seen?: string
  rbf?: boolean | null
  block_height: number | null
  timestamp: string
  type: string
  size: number | null
  vsize: number | null
  weight: number | null
  fee_sats: number
  fee_rate: number | null
  confirmations: number | null
  total_dog_moved: number
  inputs: IO[]
  outputs: IO[]
  classification: 'whale_movement' | 'airdrop_og_activity' | 'normal' | 'consolidation'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDog(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8).replace(/\.?0+$/, '') || '0'
}

function fmtFullDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
  } catch { return ts }
}

function relativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`
    const d = Math.floor(h / 24)
    return `${d} day${d !== 1 ? 's' : ''} ago`
  } catch { return '' }
}

function shortHex(s: string, head = 12, tail = 8): string {
  if (s.length <= head + tail + 1) return s
  return s.slice(0, head) + '…' + s.slice(-tail)
}

const CLASS_BADGE: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  whale_movement:      { label: 'Whale Movement',      Icon: Zap,      className: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  airdrop_og_activity: { label: 'Airdrop OG Activity', Icon: Star,     className: 'text-lava bg-lava/10 border-lava/20' },
  consolidation:       { label: 'Consolidation',       Icon: Layers,   className: 'text-dusty/60 bg-white/[0.03] border-white/[0.06]' },
  normal:              { label: 'Transfer',            Icon: Activity, className: 'text-dusty/40 bg-white/[0.02] border-white/[0.04]' },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CopyBtn({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false)
  const cls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded text-dusty/40 hover:text-snow transition-colors duration-200"
      title="Copy"
    >
      {copied ? <Check className={`${cls} text-green-400`} /> : <Copy className={cls} />}
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

function MetaRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-mono text-dusty/40 uppercase tracking-wider">{label}</p>
      <div className="font-mono text-sm text-snow/85">{value}</div>
      {sub && <div className="text-[11px] font-mono text-dusty/40">{sub}</div>}
    </div>
  )
}

function RuneCapsule({ amount }: { amount: number }) {
  return (
    <div className="inline-flex items-center gap-2 bg-void/60 border border-white/[0.06] rounded-lg pl-1 pr-2.5 py-1 max-w-full">
      <div className="w-6 h-6 rounded-full bg-void/80 border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img src="/dog-rune.webp" alt="" className="w-6 h-6 object-cover" />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-snow/85 tracking-tight whitespace-nowrap">
            DOG•GO•TO•THE•MOON
          </span>
          <span className="text-[9px] font-mono text-lava/80 bg-lava/10 border border-lava/20 px-1 py-px rounded uppercase tracking-wider">
            runes
          </span>
        </div>
        <span className="font-mono text-[11px] text-dusty/70">
          {fmtDog(amount)}
        </span>
      </div>
    </div>
  )
}

function IORow({ io, side }: { io: IO; side: 'in' | 'out' }) {
  const sideClr = side === 'in' ? 'text-red-400/80' : 'text-green-400/80'

  // OP_RETURN
  if (io.is_op_return) {
    return (
      <div className="border-b border-white/[0.04] last:border-b-0 px-3 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0">
            <span className="font-mono text-xs text-dusty/40 mt-0.5 flex-shrink-0">{io.position}</span>
            <FileCode2 className="w-3.5 h-3.5 text-lava/60 flex-shrink-0 mt-0.5" />
            <span className="font-mono text-xs text-lava/70 uppercase tracking-wider">OP_RETURN</span>
          </div>
          <span className="font-mono text-xs text-dusty/40">0 BTC</span>
        </div>
        {io.op_return_hex && (
          <div className="mt-2 ml-6 flex items-center gap-1 max-w-full">
            <code className="font-mono text-[11px] text-dusty/40 bg-void/60 border border-white/[0.04] rounded px-2 py-1 truncate">
              {io.op_return_hex}
            </code>
            <CopyBtn text={io.op_return_hex} size="xs" />
          </div>
        )}
      </div>
    )
  }

  const addressDisplay = io.address ?? '—'
  const linkable = !!io.address

  return (
    <div className="border-b border-white/[0.04] last:border-b-0 px-3 py-3 hover:bg-lava/[0.015] transition-colors duration-150">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Position + address */}
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="font-mono text-xs text-dusty/40 mt-0.5 flex-shrink-0 w-4 text-right">{io.position}</span>
          {linkable ? (
            <a
              href={`/address/bitcoin/${io.address}`}
              className="font-mono text-xs text-snow/70 hover:text-lava transition-colors duration-150 break-all leading-relaxed"
              title={io.address!}
            >
              {addressDisplay}
            </a>
          ) : (
            <span className="font-mono text-xs text-dusty/40 italic">unparseable script</span>
          )}
          {io.address && <CopyBtn text={io.address} size="xs" />}
          {/* A IDENTIDADE FICA COLADA NO ENDERECO, e nao la embaixo com os
              rotulos de coorte. "De quem e isto" e a primeira pergunta de quem
              abre uma transacao; "e uma baleia" e a segunda. */}
          {io.entity && <EntityTag identity={io.entity} className="mt-0.5 flex-shrink-0" />}
        </div>

        {/* BTC amount */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`font-mono text-xs font-semibold ${sideClr}`}>
            {satsToBtc(io.sats)} BTC
          </span>
          <span className="font-mono text-[10px] text-dusty/40">
            {io.sats.toLocaleString()} sats
          </span>
        </div>
      </div>

      {/* Rune transfer + labels */}
      {(io.amount_dog > 0 || io.label || io.is_change) && (
        <div className="mt-2 ml-6 flex items-center gap-2 flex-wrap">
          {io.amount_dog > 0 && <RuneCapsule amount={io.amount_dog} />}
          {io.label && (() => {
            const iconDef = LABEL_ICONS[io.label.id]
            const Icon = iconDef?.Icon
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.03] border border-white/[0.06] text-dusty/60">
                {Icon && <Icon className={`w-2.5 h-2.5 flex-shrink-0 ${iconDef.color}`} />}
                <span>{io.label.text}</span>
              </span>
            )
          })()}
          {io.holder_rank !== null && (
            <span className="text-[10px] font-mono text-dusty/40">
              #{io.holder_rank.toLocaleString()}
            </span>
          )}
          {io.is_change && (
            <span className="text-[10px] font-mono text-dusty/40 italic">change</span>
          )}
        </div>
      )}
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

  if (error || !data) {
    return (
      <Layout currentPage="explorer" setCurrentPage={() => {}}>
        <div className="pt-4 pb-12 px-3 md:px-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
          <BackButton />
          <Card variant="glass" className="border-red-500/10">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-red-400/80 font-mono text-sm">
                {error || 'Transaction not found.'}
              </p>
              <p className="text-dusty/30 font-mono text-xs">
                This transaction may not have $DOG activity or is not indexed yet.
              </p>
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
  const inputCount = data.inputs.length
  const outputCount = data.outputs.length

  return (
    <Layout currentPage="explorer" setCurrentPage={() => {}}>
      <div className="pt-4 pb-12 px-3 md:px-6 space-y-5 max-w-6xl mx-auto animate-fade-in">

        <BackButton />

        {/* ── Title row ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-base md:text-lg font-display text-snow font-semibold tracking-wide">
            Transaction details
          </h1>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border ${classBadge.className}`}>
              <classBadge.Icon className="w-3 h-3 flex-shrink-0" />
              {classBadge.label}
            </span>
            {/* ⚠️ `amber` AQUI É COR CHAPADA, NÃO ESCALA. O tema deste projeto
                define `amber: '#FFAD42'` como valor único, então `amber-300` e
                `amber-400/10` não compilam e o crachá saía cinza, sem o amarelo
                que é justamente o recado. Vale para qualquer cor do tema.

                AMARELO É "EM ÓRBITA", e o estado tem que ser lido de longe.
                Antes desta página aceitar `pending`, quem clicava num foguete da
                praça caía em "transaction not found" para uma transação que a
                gente estava desenhando na tela. */}
            {data.status === 'pending' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border bg-amber/10 border-amber/30 text-amber">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" aria-hidden />
                In the mempool
              </span>
            )}
            {data.status === 'dropped' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border bg-red-400/10 border-red-400/30 text-red-300">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Dropped from the mempool
              </span>
            )}
            {data.status !== 'pending' && data.status !== 'dropped' && data.confirmations !== null && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border bg-green-500/10 border-green-500/20 text-green-400">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                {data.confirmations.toLocaleString()} confirmation{data.confirmations !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Txid ── */}
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs text-snow/55 break-all flex-1 leading-relaxed">
            {data.txid}
          </code>
          <CopyBtn text={data.txid} />
        </div>

        {/* ── Meta cards (2 columns) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card variant="glass" className="border-white/[0.04]">
            <CardContent className="pt-4 pb-4 space-y-3">
              {/* sem bloco ainda: dizer o que se sabe, que é desde quando ela
                  está esperando, em vez de um traço mudo */}
              <MetaRow
                label="Block"
                value={
                  data.block_height != null
                    ? data.block_height.toLocaleString()
                    : <span className="text-amber">waiting for a block</span>
                }
              />
              <MetaRow
                label="Type"
                value={
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-lava/10 border border-lava/20 text-lava text-xs">
                    {data.type === 'transfer' ? 'Runes' : data.type}
                  </span>
                }
              />
              <MetaRow
                label="Timestamp"
                value={<span className="text-snow/70 text-xs">{relativeTime(data.timestamp)}</span>}
                sub={fmtFullDate(data.timestamp)}
              />
            </CardContent>
          </Card>

          <Card variant="glass" className="border-white/[0.04]">
            <CardContent className="pt-4 pb-4 space-y-3">
              {data.size !== null && (
                <MetaRow label="Size" value={`${data.size.toLocaleString()} B`} />
              )}
              {data.vsize !== null && (
                <MetaRow label="Virtual Size" value={`${data.vsize.toLocaleString()} B`} />
              )}
              <MetaRow label="Fee" value={`${data.fee_sats.toLocaleString()} sats`} />
              {data.fee_rate !== null && (
                <MetaRow label="Fee Rate" value={`${data.fee_rate.toFixed(2)} sat/vB`} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Inputs/Outputs counter ── */}
        <div className="text-xs font-mono text-dusty/50 px-1">
          {inputCount} Input{inputCount !== 1 ? 's' : ''}, {outputCount} Output{outputCount !== 1 ? 's' : ''}
        </div>

        {/* ── Inputs/Outputs flow ── */}
        <Card variant="glass" className="border-white/[0.04]">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* From */}
              <div className="border-b md:border-b-0 md:border-r border-white/[0.04]">
                <div className="px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01]">
                  <span className="text-[11px] font-mono text-dusty/50 uppercase tracking-wider">From</span>
                </div>
                <div>
                  {data.inputs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs font-mono text-dusty/30">
                      No input data
                    </div>
                  ) : (
                    data.inputs.map(io => <IORow key={`in-${io.position}`} io={io} side="in" />)
                  )}
                </div>
              </div>

              {/* To */}
              <div>
                <div className="px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01]">
                  <span className="text-[11px] font-mono text-dusty/50 uppercase tracking-wider">To</span>
                </div>
                <div>
                  {data.outputs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs font-mono text-dusty/30">
                      No output data
                    </div>
                  ) : (
                    data.outputs.map(io => <IORow key={`out-${io.position}`} io={io} side="out" />)
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </Layout>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

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
