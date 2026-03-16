"use client"

import {
  Heart,
  Github,
  ExternalLink,
  Shield,
  Zap,
  Globe,
  BarChart3,
  Users,
  Gift,
  Activity,
  CreditCard
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate'

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
    <footer className="border-t border-snow/[0.06] mt-12 md:mt-20 relative pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content - Aligned to grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">

          {/* DOG Data Info */}
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src="/dog-logo.png"
                  alt="DOG DATA"
                  className="w-14 h-14 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-14 h-14 bg-gradient-to-br from-lava to-lava-light flex items-center justify-center shadow-lg shadow-lava/30">
                  <span className="text-snow font-bold text-2xl font-mono">D</span>
                </div>
              </div>
              <div>
                <h3 className="text-lava-dark font-display text-2xl font-bold tracking-wider">DOG DATA</h3>
              </div>
            </div>

            <p className="text-dusty text-sm leading-relaxed font-mono">
              The ultimate platform for DOG rune analysis on Bitcoin.
              Real-time data and professional tools for the community.
            </p>

            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 animate-pulse shadow-lg shadow-green-400/50"></div>
              <span className="text-green-400 text-sm font-mono font-semibold tracking-wide">SYSTEM ONLINE</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-lava/20 border border-lava/30 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-lava" />
              </div>
              <h4 className="text-lava-dark font-display text-lg font-bold tracking-wider">NAVIGATION</h4>
            </div>

            <ul className="space-y-4">
              <li>
                <button
                  onClick={() => setCurrentPage?.('overview')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'overview'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">OVERVIEW</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage?.('transactions')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'transactions'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">TRANSACTIONS</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage?.('holders')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'holders'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">HOLDERS</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage?.('metrics')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'metrics'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">ON-CHAIN METRICS</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage?.('airdrop')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'airdrop'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">AIRDROP ANALYSIS</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage?.('bitcoin-network')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'bitcoin-network'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">BITCOIN NETWORK</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage?.('markets')}
                  className={`w-full text-left transition-all duration-300 flex items-center group py-2 ${
                    currentPage === 'markets'
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-lava hover:bg-lava-dark/10'
                  }`}
                >
                  <div className="w-2 h-2 bg-lava mr-4 group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-lava/50 transition-all duration-300"></div>
                  <span className="font-mono text-sm font-medium tracking-wide">MARKETS</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-lava/20 border border-lava/30 flex items-center justify-center">
                <Globe className="w-4 h-4 text-lava" />
              </div>
              <h4 className="text-lava-dark font-display text-lg font-bold tracking-wider">RESOURCES</h4>
            </div>

            <ul className="space-y-4">
              <li>
                <a
                  href="https://dogofbitcoin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dusty hover:text-lava transition-all duration-300 flex items-center group py-2 hover:bg-lava-dark/10"
                >
                  <div className="w-8 h-8 bg-transparent border border-lava-dark/20 flex items-center justify-center mr-4 group-hover:border-lava/50 group-hover:bg-lava/10 transition-all duration-300">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-mono text-sm font-medium tracking-wide block">DOG OFFICIAL SITE</span>
                    <span className="text-xs text-dusty/70 font-mono">dogofbitcoin.com</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
              </li>
              <li>
                <a
                  href="https://ordinals.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dusty hover:text-lava transition-all duration-300 flex items-center group py-2 hover:bg-lava-dark/10"
                >
                  <div className="w-8 h-8 bg-transparent border border-lava-dark/20 flex items-center justify-center mr-4 group-hover:border-lava/50 group-hover:bg-lava/10 transition-all duration-300">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-mono text-sm font-medium tracking-wide block">ORDINALS PROTOCOL</span>
                    <span className="text-xs text-dusty/70 font-mono">Official Documentation</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
              </li>
              <li>
                <a
                  href="https://mempool.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dusty hover:text-lava transition-all duration-300 flex items-center group py-2 hover:bg-lava-dark/10"
                >
                  <div className="w-8 h-8 bg-transparent border border-lava-dark/20 flex items-center justify-center mr-4 group-hover:border-lava/50 group-hover:bg-lava/10 transition-all duration-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-mono text-sm font-medium tracking-wide block">MEMPOOL EXPLORER</span>
                    <span className="text-xs text-dusty/70 font-mono">Bitcoin Network</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-lava/20 border border-lava/30 flex items-center justify-center">
                <Users className="w-4 h-4 text-lava" />
              </div>
              <h4 className="text-lava-dark font-display text-lg font-bold tracking-wider">COMMUNITY</h4>
            </div>

            <ul className="space-y-4">
              <li>
                <a
                  href="https://x.com/dogdatabtc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dusty hover:text-lava transition-all duration-300 flex items-center group py-2 hover:bg-lava-dark/10"
                >
                  <div className="w-8 h-8 bg-transparent border border-lava-dark/20 flex items-center justify-center mr-4 group-hover:border-lava/50 group-hover:bg-lava/10 transition-all duration-300">
                    {/* X Logo (Twitter rebrand) */}
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="font-mono text-sm font-medium tracking-wide block">FOLLOW US ON X</span>
                    <span className="text-xs text-dusty/70 font-mono">@dogdatabtc</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Donate Section */}
        <div className="border-t border-lava-dark/30 pt-12 mb-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4 md:space-x-6">
              <div className="relative">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-lava to-lava-dark flex items-center justify-center shadow-2xl shadow-lava/30">
                  <Heart className="w-6 h-6 md:w-8 md:h-8 text-snow" />
                </div>
                <div className="absolute inset-0 bg-lava/20 blur-xl -z-10"></div>
              </div>
              <div>
                <h3 className="text-lava-dark font-display text-lg md:text-2xl font-bold tracking-wider">SUPPORT DOG DATA</h3>
                <p className="text-dusty text-xs md:text-sm font-mono tracking-wide">
                  Keep the project free and open source
                </p>
              </div>
            </div>
            <button
              onClick={handleDonate}
              className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-lava to-lava-dark hover:from-lava-dark hover:to-lava-dark text-snow font-mono font-bold transition-all duration-300 shadow-2xl shadow-lava/30 hover:shadow-lava/50 hover:scale-105 flex items-center justify-center space-x-3 group border border-lava-light/30"
            >
              <Gift className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
              <span className="tracking-wide">MAKE DONATION</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-lava-dark/30 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0">
            <div className="text-dusty text-sm font-mono tracking-wide">
              &copy; {currentYear} DOG DATA. ALL RIGHTS RESERVED.
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-dusty font-mono tracking-wide">MADE BY</span>
              <a
                href="https://x.com/bitmaxdog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lava font-display font-semibold italic tracking-tight hover:text-lava-light transition-colors duration-300"
              >
                bitmax
              </a>
              <span className="text-dusty font-mono tracking-wide">FOR THE DOG COMMUNITY</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
