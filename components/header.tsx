"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart3,
  Users,
  RefreshCw,
  Heart,
  CreditCard,
  Network,
  Sparkles,
  Zap,
  Menu,
  X,
  TrendingUp
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate'

const navigation = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Transactions', page: 'transactions' as PageType, icon: CreditCard },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'On-Chain Metrics', page: 'metrics' as PageType, icon: Zap },
  { name: 'Markets', page: 'markets' as PageType, icon: TrendingUp },
  { name: 'Airdrop Analysis', page: 'airdrop' as PageType, icon: Sparkles },
  { name: 'Bitcoin Network', page: 'bitcoin-network' as PageType, icon: Network },
]

interface HeaderProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export default function Header({ currentPage, setCurrentPage }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleNavClick = useCallback((page: PageType) => {
    setCurrentPage(page)
    setMenuOpen(false)
  }, [setCurrentPage])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-header-nav]')) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [menuOpen])

  // Close menu on escape
  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-void/80 backdrop-blur-2xl border-b border-snow/[0.06]" data-header-nav>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-20">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 mr-4 md:mr-8">
            <button
              onClick={() => handleNavClick('overview')}
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

              <span className="text-lava-dark font-display text-lg md:text-2xl font-bold tracking-wider hover:text-lava transition-colors duration-300 whitespace-nowrap">
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
                  className={`flex items-center justify-center px-3 py-2 text-xs font-mono font-medium tracking-wide transition-all duration-200 flex-shrink-0 rounded-lg ${
                    isActive
                      ? 'bg-lava/15 text-lava border border-lava/20'
                      : 'text-dusty hover:text-snow hover:bg-snow/[0.04] border border-transparent'
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

          {/* Right side: Live Status, Refresh, Donate & Hamburger */}
          <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0 ml-4">
            {/* Donate Button - Hidden on small screens */}
            <button
              onClick={() => setCurrentPage('donate')}
              className="hidden lg:flex items-center px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-lava to-lava-dark hover:from-lava-dark hover:to-lava-dark text-snow font-mono font-medium tracking-wide transition-all duration-200 shadow-lg shadow-lava/20 hover:shadow-lava/30 hover:scale-[1.02] group rounded-lg"
              title="Support DOG Data"
            >
              <Heart className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm font-semibold tracking-wide">Donate</span>
            </button>

            {/* Live Status */}
            <div className="px-2 md:px-3 py-1.5 md:py-2 bg-snow/[0.03] border border-snow/[0.06] flex items-center space-x-1.5 rounded-lg">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-[10px] md:text-xs font-mono font-medium">LIVE</span>
            </div>

            {/* Refresh Button - Visible on all sizes */}
            <button
              onClick={() => window.location.reload()}
              className="px-2.5 py-2 md:py-2 bg-snow/[0.03] border border-snow/[0.06] hover:bg-snow/[0.06] transition-all duration-200 group rounded-lg"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4 text-dusty group-hover:text-lava group-hover:rotate-180 transition-all duration-500" />
            </button>

            {/* Hamburger Button - Mobile only */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
              className="md:hidden px-2.5 py-2 bg-snow/[0.03] border border-snow/[0.06] hover:bg-snow/[0.06] transition-all duration-200 rounded-lg"
              title="Menu"
            >
              {menuOpen ? (
                <X className="w-5 h-5 text-lava" />
              ) : (
                <Menu className="w-5 h-5 text-dusty" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-snow/[0.06] bg-void/95 backdrop-blur-2xl">
          <nav className="max-w-[1600px] mx-auto px-3 py-2 space-y-0.5">
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon
              return (
                <button
                  key={item.page}
                  onClick={() => handleNavClick(item.page)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm tracking-wide transition-all duration-150 rounded-lg ${
                    isActive
                      ? 'text-lava bg-lava/10'
                      : 'text-dusty hover:text-snow hover:bg-snow/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.name}
                </button>
              )
            })}
            <button
              onClick={() => handleNavClick('donate')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm tracking-wide transition-all duration-150 rounded-lg ${
                currentPage === 'donate'
                  ? 'text-lava bg-lava/10'
                  : 'text-dusty hover:text-snow hover:bg-snow/[0.04]'
              }`}
            >
              <Heart className="w-4 h-4 flex-shrink-0" />
              Donate
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
