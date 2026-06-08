'use client'

import { Layout } from '@/components/layout'
import { OnChainChartGrid, METRICS } from '@/components/charts/onchain-chart-grid'
import { BarChart3 } from 'lucide-react'

export default function ChartsPage() {
  return (
    <Layout currentPage="metrics" setCurrentPage={() => {}}>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-10">
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-text-secondary">
              On-Chain Metrics
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary md:text-4xl">
            DOG Charts
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm text-text-secondary">
            {METRICS.length} on-chain metrics for the DOG rune — valuation, holder cohorts,
            profit/loss and concentration — all on a single standardized model with the DOG
            price overlaid for context.
          </p>
        </header>

        <OnChainChartGrid />
      </div>
    </Layout>
  )
}
