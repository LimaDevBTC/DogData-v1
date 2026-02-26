"use client"

import {
  BarChart3,
  Users,
  Gift,
  Activity,
  Wifi,
  RefreshCw,
  Heart,
  CreditCard,
  Network,
  Sparkles,
  Zap
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate'

const navigation = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Transactions', page: 'transactions' as PageType, icon: CreditCard },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'On-Chain Metrics', page: 'metrics' as PageType, icon: Zap },
  { name: 'Markets', page: 'markets' as PageType, icon: BarChart3 },
  { name: 'Airdrop Analysis', page: 'airdrop' as PageType, icon: Sparkles },
  { name: 'Bitcoin Network', page: 'bitcoin-network' as PageType, icon: Network },
]

interface HeaderProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export default function Header({ currentPage, setCurrentPage }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-void/90 backdrop-blur-xl border-b border-elevated/50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-20">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 mr-4 md:mr-8">
            <button
              onClick={() => setCurrentPage('overview')}
              className="flex items-center space-x-2 md:space-x-3 hover:opacity-80 transition-all duration-300 group"
            >
              <div className="relative w-10 h-10 md:w-14 md:h-14 flex-shrink-0">
                <img
                  src="/dog-logo.png"
                  alt="DOG DATA"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-full h-full bg-gradient-to-br from-lava to-lava-light flex items-center justify-center group-hover:opacity-90 transition-all duration-300">
                  <span className="text-snow font-bold text-lg md:text-xl font-mono">D</span>
                </div>
              </div>

              <span className="text-snow font-display text-lg md:text-2xl font-bold tracking-wider hover:text-lava transition-colors duration-300 whitespace-nowrap">
                DOG DATA
              </span>
            </button>
          </div>

          {/* Navigation - Desktop only */}
          <nav className="hidden md:flex space-x-1.5 flex-1 justify-center max-w-5xl mx-4">
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon

              return (
                <button
                  key={item.name}
                  onClick={() => setCurrentPage(item.page)}
                  className={`flex items-center justify-center px-3 py-2.5 text-xs font-mono font-medium tracking-wide transition-colors duration-300 flex-shrink-0 ${
                    isActive
                      ? 'bg-lava/20 text-lava border border-lava/30'
                      : 'text-dusty hover:text-snow hover:bg-surface/30 border border-transparent hover:border-elevated/30'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">
                    {item.name}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Live Status, Refresh & Donate */}
          <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0 ml-4">
            {/* Donate Button - Hidden on small screens */}
            <button
              onClick={() => setCurrentPage('donate')}
              className="hidden lg:flex items-center px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-lava to-lava-dark hover:from-lava-dark hover:to-lava-dark text-snow font-mono font-medium tracking-wide transition-all duration-300 shadow-lg shadow-lava/20 hover:shadow-lava/40 hover:scale-105 group"
              title="Support DOG Data"
            >
              <Heart className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm font-semibold tracking-wide">Donate</span>
            </button>

            {/* Live Status */}
            <div className="px-2 md:px-4 py-2 md:py-3 bg-surface/50 border border-elevated/50 flex items-center space-x-1 md:space-x-2">
              <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
              <span className="text-green-400 text-xs font-mono font-medium">LIVE</span>
            </div>

            {/* Refresh Button - Visible on all sizes */}
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 md:py-3 bg-surface/50 border border-elevated/50 hover:bg-elevated/50 hover:border-dusty/30 transition-all duration-300 group"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4 text-dusty group-hover:text-lava group-hover:rotate-180 transition-all duration-500" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
