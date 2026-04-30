"use client"

import {
  Heart,
  ExternalLink,
  Shield,
  Zap,
  Globe,
  BarChart3,
  Users,
  Gift
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate' | 'multichain' | 'explorer' | 'status'

interface FooterProps {
  currentPage?: PageType
  setCurrentPage?: (page: PageType) => void
}

export default function Footer({ currentPage, setCurrentPage }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const handleDonate = () => {
    setCurrentPage?.('donate')
  }

  return (
    <footer className="border-t border-white/[0.04] mt-12 md:mt-20 relative pb-20 md:pb-0">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lava/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

          {/* DOG Data Info */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img
                  src="/dog-logo.png"
                  alt="DOG DATA"
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-12 h-12 bg-gradient-to-br from-lava to-lava-light flex items-center justify-center rounded-xl">
                  <span className="text-snow font-bold text-xl font-mono">D</span>
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl font-bold tracking-wide">
                  <span className="text-snow">DOG</span>
                  <span className="text-lava ml-1">DATA</span>
                </h3>
              </div>
            </div>

            <p className="text-dusty text-sm leading-relaxed font-mono">
              The ultimate platform for DOG rune analysis on Bitcoin.
              Real-time data and professional tools for the community.
            </p>

            <a
              href="/status"
              className="flex items-center space-x-2.5 group transition-opacity hover:opacity-80"
              title="System status"
            >
              <div className="relative w-2.5 h-2.5">
                <div className="absolute inset-0 bg-green-400 rounded-full" />
                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-30" />
              </div>
              <span className="text-green-400/80 text-xs font-mono font-semibold tracking-widest group-hover:text-green-400">SYSTEM ONLINE</span>
              <span className="text-dusty/60 text-[10px] font-mono group-hover:text-dusty">→ status</span>
            </a>
          </div>

          {/* Quick Links */}
          <div className="space-y-5">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 bg-lava/[0.08] border border-lava/[0.12] rounded-lg flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-lava/70" />
              </div>
              <h4 className="text-snow/80 font-display text-sm font-bold tracking-widest uppercase">Navigation</h4>
            </div>

            <ul className="space-y-1">
              {[
                { label: 'OVERVIEW', page: 'overview' as PageType },
                { label: 'TRANSACTIONS', page: 'transactions' as PageType },
                { label: 'HOLDERS', page: 'holders' as PageType },
                { label: 'ON-CHAIN METRICS', page: 'metrics' as PageType },
                { label: 'AIRDROP ANALYSIS', page: 'airdrop' as PageType },
                { label: 'BITCOIN NETWORK', page: 'bitcoin-network' as PageType },
                { label: 'MARKETS', page: 'markets' as PageType },
              ].map((item) => (
                <li key={item.page}>
                  <button
                    onClick={() => setCurrentPage?.(item.page)}
                    className={`w-full text-left transition-all duration-200 flex items-center group py-1.5 px-2 rounded-lg ${
                      currentPage === item.page
                        ? 'text-lava bg-lava/[0.06]'
                        : 'text-dusty hover:text-snow/80 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className={`w-1 h-1 rounded-full mr-3 transition-all duration-200 ${
                      currentPage === item.page ? 'bg-lava' : 'bg-dusty/30 group-hover:bg-dusty/60'
                    }`} />
                    <span className="font-mono text-xs font-medium tracking-wide">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-5">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 bg-lava/[0.08] border border-lava/[0.12] rounded-lg flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-lava/70" />
              </div>
              <h4 className="text-snow/80 font-display text-sm font-bold tracking-widest uppercase">Resources</h4>
            </div>

            <ul className="space-y-1">
              {[
                { label: 'DOG OFFICIAL SITE', sub: 'dogofbitcoin.com', href: 'https://dogofbitcoin.com/', icon: Globe },
                { label: 'ORDINALS PROTOCOL', sub: 'Official Documentation', href: 'https://ordinals.com', icon: Shield },
                { label: 'MEMPOOL EXPLORER', sub: 'Bitcoin Network', href: 'https://mempool.space', icon: Zap },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dusty hover:text-snow/80 transition-all duration-200 flex items-center group py-2 px-2 rounded-lg hover:bg-white/[0.02]"
                  >
                    <div className="w-7 h-7 bg-white/[0.02] border border-white/[0.05] rounded-lg flex items-center justify-center mr-3 group-hover:border-lava/20 group-hover:bg-lava/[0.04] transition-all duration-200">
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-medium tracking-wide block">{item.label}</span>
                      <span className="text-[10px] text-dusty/50 font-mono">{item.sub}</span>
                    </div>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200 flex-shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div className="space-y-5">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 bg-lava/[0.08] border border-lava/[0.12] rounded-lg flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-lava/70" />
              </div>
              <h4 className="text-snow/80 font-display text-sm font-bold tracking-widest uppercase">Community</h4>
            </div>

            <ul className="space-y-1">
              <li>
                <a
                  href="https://x.com/dogdatabtc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dusty hover:text-snow/80 transition-all duration-200 flex items-center group py-2 px-2 rounded-lg hover:bg-white/[0.02]"
                >
                  <div className="w-7 h-7 bg-white/[0.02] border border-white/[0.05] rounded-lg flex items-center justify-center mr-3 group-hover:border-lava/20 group-hover:bg-lava/[0.04] transition-all duration-200">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="font-mono text-xs font-medium tracking-wide block">FOLLOW US ON X</span>
                    <span className="text-[10px] text-dusty/50 font-mono">@dogdatabtc</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Donate Section */}
        <div className="border-t border-white/[0.04] pt-10 mb-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4 md:space-x-5">
              <div className="relative">
                <div className="w-11 h-11 md:w-14 md:h-14 bg-gradient-to-br from-lava to-lava-dark flex items-center justify-center rounded-xl shadow-[0_0_24px_rgba(245,110,15,0.15)]">
                  <Heart className="w-5 h-5 md:w-7 md:h-7 text-snow" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-base md:text-xl font-bold tracking-wide">
                  <span className="text-snow">SUPPORT</span>
                  <span className="text-lava ml-1.5">DOG DATA</span>
                </h3>
                <p className="text-dusty text-xs md:text-sm font-mono tracking-wide">
                  Keep the project free and open source
                </p>
              </div>
            </div>
            <button
              onClick={handleDonate}
              className="w-full md:w-auto px-6 md:px-8 py-3 bg-gradient-to-r from-lava to-lava-dark hover:from-lava-dark hover:to-lava-dark text-snow font-mono font-bold text-sm transition-all duration-300 shadow-[0_0_24px_rgba(245,110,15,0.15)] hover:shadow-[0_0_36px_rgba(245,110,15,0.25)] hover:scale-[1.02] flex items-center justify-center space-x-2.5 group rounded-xl"
            >
              <Gift className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              <span className="tracking-wider">MAKE DONATION</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.04] pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="text-dusty/60 text-xs font-mono tracking-wide">
              &copy; {currentYear} DOG DATA. ALL RIGHTS RESERVED.
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-dusty/60 font-mono tracking-wide">MADE BY</span>
              <a
                href="https://x.com/bitmaxdog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lava font-display font-semibold italic tracking-tight hover:text-lava-light transition-colors duration-300"
              >
                bitmax
              </a>
              <span className="text-dusty/60 font-mono tracking-wide">FOR THE DOG COMMUNITY</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
