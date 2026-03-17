'use client'

import NavBar from '@/design-system/components/NavBar'
import PageLayout from '@/design-system/components/PageLayout'
import SectionHeader from '@/design-system/components/SectionHeader'
import MetricCard from '@/design-system/components/MetricCard'
import StatBadge from '@/design-system/components/StatBadge'
import LiveIndicator from '@/design-system/components/LiveIndicator'
import AddressChip from '@/design-system/components/AddressChip'
import ChartContainer from '@/design-system/components/ChartContainer'
import DataTable from '@/design-system/components/DataTable'
import HeatmapCell from '@/design-system/components/HeatmapCell'
import { useCursorGlow } from '@/design-system/hooks/useCursorGlow'

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_HOLDERS = [
  { rank: 1, address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', balance: 8_450_000_000, pct: 4.81 },
  { rank: 2, address: 'bc1q9h5yjqka3uf7fy62dp3ce9t84nkr2s5j3msxql', balance: 5_230_000_000, pct: 2.98 },
  { rank: 3, address: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', balance: 3_120_000_000, pct: 1.78 },
  { rank: 4, address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', balance: 2_890_000_000, pct: 1.65 },
  { rank: 5, address: 'bc1q42lja79elem0anu8q860g3ez8gy6tka2d43f4rp', balance: 2_150_000_000, pct: 1.23 },
  { rank: 6, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', balance: 1_870_000_000, pct: 1.07 },
  { rank: 7, address: 'bc1qc7slrfxkknhcq48waf2x25d7xhpfu9v2g7f5ts', balance: 1_540_000_000, pct: 0.88 },
  { rank: 8, address: 'bc1qp3wjpa3lykng0lv2wn7y3ghkdmynjmfz76s92t', balance: 1_230_000_000, pct: 0.70 },
]

const TABLE_COLUMNS = [
  { key: 'rank', label: 'Rank', align: 'center' as const },
  { key: 'address', label: 'Address', mono: true },
  { key: 'balance', label: 'Balance', align: 'right' as const, mono: true },
  { key: 'pct', label: '% Supply', align: 'right' as const, mono: true },
]

function generateHeatmapData() {
  const data: { value: number; date: string }[] = []
  const now = new Date()
  for (let i = 0; i < 52 * 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (52 * 7 - i))
    data.push({
      value: Math.floor(Math.random() * 100),
      date: d.toISOString().slice(0, 10),
    })
  }
  return data
}

const heatmapData = generateHeatmapData()

// ─── Page ─────────────────────────────────────────────────────
export default function DesignSystemPage() {
  const glowRef = useCursorGlow<HTMLDivElement>()

  return (
    <div
      ref={glowRef as React.RefObject<HTMLDivElement>}
      className="relative"
      style={{
        background:
          'radial-gradient(var(--cursor-glow-radius, 600px) at var(--cursor-x, 50%) var(--cursor-y, -100%), var(--cursor-glow-color, transparent), transparent)',
      }}
    >
      <NavBar
        links={[
          { label: 'Overview', href: '#overview', active: true },
          { label: 'Metrics', href: '#metrics' },
          { label: 'Holders', href: '#holders' },
          { label: 'Charts', href: '#charts' },
          { label: 'Heatmap', href: '#heatmap' },
        ]}
        actions={<LiveIndicator status="live" lastUpdate="2s ago" />}
      />

      <PageLayout>
        {/* ════════════════════════════════════════════════════════
            HERO SECTION
        ════════════════════════════════════════════════════════ */}
        <section id="overview" className="pb-24">
          <div className="flex flex-col items-center text-center mb-16">
            <span className="font-sans text-xs uppercase tracking-widest text-text-accent mb-4">
              Bitcoin Intelligence Design System
            </span>
            <div className="h-px w-10 bg-gradient-bitcoin mb-8" />
            <h1 className="font-display text-hero font-extrabold text-text-primary leading-none mb-6">
              <span className="text-text-accent">$</span>DOG DATA
            </h1>
            <p className="font-sans text-lg text-text-secondary max-w-xl">
              Premium data explorer for the largest Bitcoin Rune in the world.
              Every component crafted with precision for on-chain intelligence.
            </p>
          </div>

          {/* Live indicator strip */}
          <div className="flex items-center justify-center gap-8 mb-12 flex-wrap">
            <LiveIndicator status="live" lastUpdate="2s ago" />
            <LiveIndicator status="updating" lastUpdate="Syncing..." />
            <LiveIndicator status="stale" lastUpdate="5m ago" />
          </div>

          {/* Hero Metric */}
          <div className="max-w-md mx-auto mb-16">
            <MetricCard
              label="$DOG Market Cap"
              value={892_450_000}
              change={12.45}
              changeDirection="up"
              size="hero"
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            METRICS GRID
        ════════════════════════════════════════════════════════ */}
        <section id="metrics" className="pb-24">
          <SectionHeader
            eyebrow="Core Metrics"
            title="Real-time Market Data"
            subtitle="Live on-chain metrics updated every block"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <MetricCard
              label="Price (USD)"
              value={0.00508}
              change={5.23}
              changeDirection="up"
              size="lg"
            />
            <MetricCard
              label="24h Volume"
              value={14_320_000}
              change={-2.10}
              changeDirection="down"
              size="lg"
            />
            <MetricCard
              label="Total Holders"
              value={98_432}
              change={1.85}
              changeDirection="up"
              size="lg"
            />
            <MetricCard
              label="Circulating Supply"
              value="100B"
              size="lg"
            />
          </div>

          {/* Small metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <MetricCard label="ATH" value="$0.0152" size="sm" />
            <MetricCard label="ATL" value="$0.0003" size="sm" />
            <MetricCard label="7d Change" value={8.92} change={8.92} changeDirection="up" size="sm" />
            <MetricCard label="30d Change" value={-3.41} change={3.41} changeDirection="down" size="sm" />
            <MetricCard label="Avg Hold Time" value="47d" size="sm" />
            <MetricCard label="Active Addresses" value="12.4K" size="sm" />
          </div>

          {/* Loading states */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <MetricCard label="" value="" loading />
            <MetricCard label="" value="" loading />
            <MetricCard label="" value="" loading />
            <MetricCard label="" value="" loading />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            STAT BADGES
        ════════════════════════════════════════════════════════ */}
        <section className="pb-24">
          <SectionHeader
            eyebrow="Badges"
            title="Status Indicators"
            subtitle="Inline stat badges for contextual data"
          />

          <div className="flex flex-wrap gap-3 mt-8">
            <StatBadge label="Status" value="Active" variant="positive" />
            <StatBadge label="Risk" value="High" variant="negative" />
            <StatBadge label="Network" value="Bitcoin" variant="bitcoin" />
            <StatBadge label="Confirmations" value="6" variant="default" />
            <StatBadge label="Fee Rate" value="42 sat/vB" variant="warning" />
            <StatBadge label="Block" value="#892,145" variant="bitcoin" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            ADDRESS CHIPS
        ════════════════════════════════════════════════════════ */}
        <section className="pb-24">
          <SectionHeader
            eyebrow="Addresses"
            title="Wallet & Hash Display"
            subtitle="Smart truncation with clipboard support"
          />

          <div className="flex flex-wrap gap-3 mt-8">
            <AddressChip
              address="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
              copyable
              truncate="mid"
            />
            <AddressChip
              address="bc1q9h5yjqka3uf7fy62dp3ce9t84nkr2s5j3msxql"
              copyable
              truncate="head"
            />
            <AddressChip
              address="bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h"
              copyable
              truncate="tail"
            />
            <AddressChip
              address="3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5"
              copyable
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CHART CONTAINERS
        ════════════════════════════════════════════════════════ */}
        <section id="charts" className="pb-24">
          <SectionHeader
            eyebrow="Charts"
            title="Data Visualization Containers"
            subtitle="Wrappers for premium chart experiences"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <ChartContainer
              title="Price History"
              subtitle="$DOG/USD"
              accentColor="bitcoin"
            >
              <div className="h-64 flex items-end gap-1 px-2">
                {Array.from({ length: 48 }).map((_, i) => {
                  const h = 20 + Math.random() * 80
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(to top, rgba(247,147,26,0.6), rgba(247,147,26,0.15))`,
                      }}
                    />
                  )
                })}
              </div>
            </ChartContainer>

            <ChartContainer
              title="Transaction Volume"
              subtitle="Daily on-chain transfers"
              accentColor="data"
            >
              <div className="h-64 flex items-end gap-1 px-2">
                {Array.from({ length: 48 }).map((_, i) => {
                  const h = 10 + Math.random() * 90
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(to top, rgba(232,130,14,0.6), rgba(232,130,14,0.1))`,
                      }}
                    />
                  )
                })}
              </div>
            </ChartContainer>
          </div>

          {/* Loading chart */}
          <div className="mt-6">
            <ChartContainer
              title="Holder Growth"
              subtitle="Loading data..."
              loading
            >
              <div />
            </ChartContainer>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            DATA TABLE
        ════════════════════════════════════════════════════════ */}
        <section id="holders" className="pb-24">
          <SectionHeader
            eyebrow="Rankings"
            title="Top Holders"
            subtitle="Ranked by $DOG balance"
            action={
              <StatBadge label="Total" value="98,432 holders" variant="bitcoin" />
            }
          />

          <div className="mt-8 rounded-lg border border-border bg-bg-surface overflow-hidden">
            <DataTable
              columns={TABLE_COLUMNS}
              data={MOCK_HOLDERS.map(h => ({
                ...h,
                balance: h.balance.toLocaleString(),
                pct: `${h.pct}%`,
              }))}
              sortable
              pagination
              pageSize={5}
            />
          </div>

          {/* Loading table */}
          <div className="mt-6 rounded-lg border border-border bg-bg-surface overflow-hidden">
            <DataTable
              columns={TABLE_COLUMNS}
              data={[]}
              loading
            />
          </div>

          {/* Empty table */}
          <div className="mt-6 rounded-lg border border-border bg-bg-surface overflow-hidden">
            <DataTable
              columns={TABLE_COLUMNS}
              data={[]}
              emptyMessage="No whale activity detected in this timeframe"
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            HEATMAP
        ════════════════════════════════════════════════════════ */}
        <section id="heatmap" className="pb-24">
          <SectionHeader
            eyebrow="Activity"
            title="Transaction Heatmap"
            subtitle="365 days of on-chain activity"
          />

          <div className="mt-8 p-6 rounded-lg border border-border bg-bg-surface overflow-x-auto">
            <div className="flex gap-0.5 flex-wrap" style={{ maxWidth: '100%' }}>
              {heatmapData.map((cell, i) => (
                <HeatmapCell
                  key={i}
                  value={cell.value}
                  max={100}
                  date={cell.date}
                  label="txns"
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-xs text-text-tertiary font-sans">
              <span>Less</span>
              <div className="flex gap-0.5">
                {[0, 25, 50, 75, 100].map(v => (
                  <HeatmapCell key={v} value={v} max={100} />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            TYPOGRAPHY SHOWCASE
        ════════════════════════════════════════════════════════ */}
        <section className="pb-24">
          <SectionHeader
            eyebrow="Typography"
            title="Type Scale"
            subtitle="Three font families for maximum hierarchy"
          />

          <div className="mt-8 space-y-8">
            {/* Display font */}
            <div className="p-6 rounded-lg border border-border bg-bg-surface">
              <span className="font-sans text-xs uppercase tracking-widest text-text-accent">Font Display &mdash; Syne</span>
              <div className="mt-4 space-y-2">
                <p className="font-display text-mega font-extrabold text-text-primary">96px Mega</p>
                <p className="font-display text-hero font-bold text-text-primary">64px Hero</p>
                <p className="font-display text-2xl font-bold text-text-primary">32px Heading</p>
                <p className="font-display text-xl font-semibold text-text-primary">24px Title</p>
              </div>
            </div>

            {/* Sans font */}
            <div className="p-6 rounded-lg border border-border bg-bg-surface">
              <span className="font-sans text-xs uppercase tracking-widest text-text-accent">Font Sans &mdash; DM Sans</span>
              <div className="mt-4 space-y-2">
                <p className="font-sans text-lg text-text-primary">18px — Interface large, navigation</p>
                <p className="font-sans text-base text-text-primary">15px — Body text, paragraphs, descriptions</p>
                <p className="font-sans text-sm text-text-secondary">13px — Secondary text, captions, metadata</p>
                <p className="font-sans text-xs text-text-tertiary uppercase tracking-widest">11px — Labels, badges, eyebrows</p>
              </div>
            </div>

            {/* Mono font */}
            <div className="p-6 rounded-lg border border-border bg-bg-surface">
              <span className="font-sans text-xs uppercase tracking-widest text-text-accent">Font Mono &mdash; JetBrains Mono</span>
              <div className="mt-4 space-y-2">
                <p className="font-mono text-2xl text-text-accent">$892,450,000.00</p>
                <p className="font-mono text-lg text-text-primary">0.00508 USD &middot; +5.23%</p>
                <p className="font-mono text-sm text-text-secondary">bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</p>
                <p className="font-mono text-xs text-text-tertiary">tx: a1b2c3d4e5f6...7890abcd</p>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            COLOR PALETTE
        ════════════════════════════════════════════════════════ */}
        <section className="pb-24">
          <SectionHeader
            eyebrow="Tokens"
            title="Color System"
            subtitle="Layered backgrounds, accent colors, and semantic palette"
          />

          <div className="mt-8 space-y-6">
            {/* Backgrounds */}
            <div>
              <h3 className="font-sans text-sm text-text-secondary mb-3">Backgrounds</h3>
              <div className="flex gap-3 flex-wrap">
                {[
                  { name: 'Void', cls: 'bg-bg-void' },
                  { name: 'Base', cls: 'bg-bg-base' },
                  { name: 'Surface', cls: 'bg-bg-surface' },
                  { name: 'Elevated', cls: 'bg-bg-elevated' },
                  { name: 'Overlay', cls: 'bg-bg-overlay' },
                ].map(c => (
                  <div key={c.name} className="flex flex-col items-center gap-2">
                    <div className={`w-20 h-20 rounded-lg border border-border ${c.cls}`} />
                    <span className="font-mono text-xs text-text-tertiary">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Accents */}
            <div>
              <h3 className="font-sans text-sm text-text-secondary mb-3">Accents</h3>
              <div className="flex gap-3 flex-wrap">
                {[
                  { name: 'Primary', cls: 'bg-accent-primary' },
                  { name: 'Primary Dim', cls: 'bg-accent-primary-dim' },
                  { name: 'Data', cls: 'bg-accent-data' },
                  { name: 'Data Dim', cls: 'bg-accent-data-dim' },
                  { name: 'Positive', cls: 'bg-accent-positive' },
                  { name: 'Negative', cls: 'bg-accent-negative' },
                ].map(c => (
                  <div key={c.name} className="flex flex-col items-center gap-2">
                    <div className={`w-20 h-20 rounded-lg border border-border ${c.cls}`} />
                    <span className="font-mono text-xs text-text-tertiary">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shadows */}
            <div>
              <h3 className="font-sans text-sm text-text-secondary mb-3">Shadows &amp; Glows</h3>
              <div className="flex gap-6 flex-wrap">
                {[
                  { name: 'Bitcoin Glow', cls: 'shadow-bitcoin' },
                  { name: 'Data Glow', cls: 'shadow-data' },
                  { name: 'Shadow SM', cls: 'shadow-sm' },
                  { name: 'Shadow LG', cls: 'shadow-lg' },
                ].map(c => (
                  <div key={c.name} className="flex flex-col items-center gap-2">
                    <div className={`w-24 h-24 rounded-xl bg-bg-surface border border-border ${c.cls}`} />
                    <span className="font-mono text-xs text-text-tertiary">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION HEADERS
        ════════════════════════════════════════════════════════ */}
        <section className="pb-24">
          <SectionHeader
            eyebrow="Layout"
            title="Section Headers"
            subtitle="Variations of the section header component"
          />

          <div className="mt-8 space-y-12">
            <SectionHeader
              eyebrow="On-Chain"
              title="Bitcoin Network Stats"
              subtitle="Real-time metrics from the Bitcoin blockchain"
              action={
                <button className="px-4 py-2 rounded-md bg-accent-primary-dim text-text-accent font-sans text-sm hover:bg-accent-primary/20 transition-colors">
                  View All
                </button>
              }
            />
            <SectionHeader
              title="Simple Title Only"
            />
            <SectionHeader
              eyebrow="Forensic Analysis"
              title="Whale Tracker"
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════════════════════ */}
        <footer className="border-t border-border-subtle py-12 text-center">
          <p className="font-sans text-sm text-text-tertiary">
            Bitcoin Intelligence Design System &mdash; dogdata.xyz
          </p>
          <p className="font-mono text-xs text-text-tertiary mt-2">
            $DOG GO TO THE MOON
          </p>
        </footer>
      </PageLayout>
    </div>
  )
}
