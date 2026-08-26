'use client'

// Os 4 tiles de autoridade acima do canvas. Os numeros chegam prontos da API
// (stats do payload do flow); aqui e so exibicao, zero conta. Valores no
// laranja de marca #f7931a, permitido porque e texto 2D, nao cena.

import type { FlowStats } from './flow/flow-types'

const nf = new Intl.NumberFormat('en-US')

interface Tile {
  label: string
  value: string
  sub: string
}

export default function StatsStrip({ stats }: { stats: FlowStats | null }) {
  const tiles: Tile[] = [
    {
      label: 'Wallets mapped',
      value: stats ? nf.format(stats.wallets) : '...',
      // frase de autoridade: a genealogia cobre 100% do airdrop
      sub: '0.00% gap, full replay',
    },
    {
      label: 'Direct from airdrop',
      value: stats ? nf.format(stats.direct_children) : '...',
      sub: 'children of the treasury',
    },
    {
      label: 'On exchanges',
      value: stats ? `${stats.exchange_pct_supply.toFixed(2)}%` : '...',
      sub: 'of total supply',
    },
    {
      label: 'Still held',
      value: stats ? `${stats.holding_pct.toFixed(2)}%` : '...',
      sub: 'of supply under this root',
    },
  ]

  return (
    <div className="grid grid-cols-2 border-b border-white/10 md:grid-cols-4">
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={`px-4 py-2 sm:px-6 ${i % 2 === 1 ? 'border-l border-white/10' : ''} ${i > 0 ? 'md:border-l md:border-white/10' : ''} ${i >= 2 ? 'border-t border-white/10 md:border-t-0' : ''}`}
        >
          <div className="text-[9px] uppercase tracking-[0.2em] text-white/40">{t.label}</div>
          <div className="mt-0.5 text-sm text-[#f7931a]">{t.value}</div>
          <div className="text-[9px] text-white/35">{t.sub}</div>
        </div>
      ))}
    </div>
  )
}
