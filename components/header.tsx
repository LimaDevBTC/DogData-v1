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
  TrendingUp,
  Globe,
  Search
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate' | 'multichain' | 'explorer' | 'status'

const navigation = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Transactions', page: 'transactions' as PageType, icon: CreditCard },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'Cross-Chain', page: 'multichain' as PageType, icon: Globe },
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
  const [scrolled, setScrolled] = useState(false)

  const handleNavClick = useCallback((page: PageType) => {
    setCurrentPage(page)
    setMenuOpen(false)
  }, [setCurrentPage])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-header-nav]')) setMenuOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-void/90 backdrop-blur-2xl border-b border-white/[0.04] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]'
          : 'bg-void/60 backdrop-blur-xl border-b border-transparent'
      }`}
      data-header-nav
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 mr-4 md:mr-8">
            <button
              onClick={() => handleNavClick('overview')}
              className="flex items-center space-x-2 md:space-x-3 hover:opacity-90 transition-all duration-300 group"
            >
              <div className="relative w-8 h-8 md:w-10 md:h-10 flex-shrink-0">
                <img
                  src="/dog-logo.png"
                  alt="DOG DATA"
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-full h-full bg-gradient-to-br from-lava to-lava-light flex items-center justify-center rounded-lg">
                  <span className="text-snow font-bold text-lg font-mono">D</span>
                </div>
              </div>

              <span className="font-display text-base md:text-lg font-bold tracking-wide whitespace-nowrap">
                <span className="text-snow">DOG</span>
                <span className="text-lava ml-1">DATA</span>
              </span>
            </button>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex space-x-0.5 flex-1 justify-center max-w-5xl mx-4">
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon

              return (
                <button
                  key={item.name}
                  onClick={() => setCurrentPage(item.page)}
                  className={`relative flex items-center justify-center px-3 py-1.5 text-[11px] font-mono font-medium tracking-wide transition-all duration-300 flex-shrink-0 rounded-lg group ${
                    isActive
                      ? 'text-lava'
                      : 'text-[#6B6B78] hover:text-snow/90'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-lava/[0.08] border border-lava/[0.12] rounded-lg" />
                  )}
                  <Icon className={`relative w-3.5 h-3.5 mr-1.5 flex-shrink-0 transition-colors duration-300 ${
                    isActive ? 'text-lava' : 'text-[#4A4A52] group-hover:text-[#6B6B78]'
                  }`} />
                  <span className="relative whitespace-nowrap">{item.name}</span>
                </button>
              )
            })}
            {/* Explorer — external route */}
            <a
              href="/explorer"
              className={`relative flex items-center justify-center px-3 py-1.5 text-[11px] font-mono font-medium tracking-wide transition-all duration-300 flex-shrink-0 rounded-lg group ${
                currentPage === 'explorer'
                  ? 'text-lava bg-lava/[0.06] border border-lava/[0.15]'
                  : 'text-[#6B6B78] hover:text-snow/90'
              }`}
            >
              <Search className={`relative w-3.5 h-3.5 mr-1.5 flex-shrink-0 transition-colors duration-300 ${
                currentPage === 'explorer' ? 'text-lava' : 'text-[#4A4A52] group-hover:text-[#6B6B78]'
              }`} />
              <span className="relative whitespace-nowrap">Explorer</span>
            </a>
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-2 md:space-x-2.5 flex-shrink-0 ml-4">
            {/* Donate */}
            <button
              onClick={() => setCurrentPage('donate')}
              className="hidden lg:flex items-center px-4 py-1.5 bg-gradient-to-r from-lava to-lava-dark text-snow font-mono font-medium text-xs tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(245,110,15,0.15)] hover:shadow-[0_0_30px_rgba(245,110,15,0.25)] hover:scale-[1.02] group rounded-lg"
              title="Support DOG Data"
            >
              <Heart className="w-3.5 h-3.5 mr-1.5 group-hover:scale-110 transition-transform duration-300" />
              <span className="font-semibold">Donate</span>
            </button>

            {/* Status — clickable, shows live system health (links to /status page) */}
            <a
              href="/status"
              title="View system status"
              className="px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-green-400/[0.2] flex items-center space-x-1.5 rounded-lg transition-all duration-300 group"
            >
              <div className="relative w-1.5 h-1.5">
                <div className="absolute inset-0 bg-green-400 rounded-full"></div>
                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-40"></div>
              </div>
              <span className="text-green-400/90 group-hover:text-green-400 text-[10px] md:text-[11px] font-mono font-semibold tracking-wider transition-colors">STATUS</span>
            </a>

            {/* Refresh */}
            <button
              onClick={() => window.location.reload()}
              className="px-2 py-1.5 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 group rounded-lg"
              title="Refresh Data"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#6B6B78] group-hover:text-lava group-hover:rotate-180 transition-all duration-700" />
            </button>

            {/* Hamburger - Mobile */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
              className="md:hidden px-2 py-1.5 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-200 rounded-lg"
              title="Menu"
            >
              {menuOpen ? (
                <X className="w-5 h-5 text-lava" />
              ) : (
                <Menu className="w-5 h-5 text-[#6B6B78]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.04] bg-void/95 backdrop-blur-2xl animate-fade-in">
          <nav className="max-w-[1600px] mx-auto px-3 py-2 space-y-0.5">
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon
              return (
                <button
                  key={item.page}
                  onClick={() => handleNavClick(item.page)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm tracking-wide transition-all duration-200 rounded-lg ${
                    isActive
                      ? 'text-lava bg-lava/[0.08]'
                      : 'text-[#6B6B78] hover:text-snow hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.name}
                </button>
              )
            })}
            <a
              href="/explorer"
              className={`w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm tracking-wide transition-all duration-200 rounded-lg ${
                currentPage === 'explorer'
                  ? 'text-lava bg-lava/[0.08]'
                  : 'text-[#6B6B78] hover:text-snow hover:bg-white/[0.03]'
              }`}
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              Explorer
            </a>
            <button
              onClick={() => handleNavClick('donate')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 font-mono text-sm tracking-wide transition-all duration-200 rounded-lg ${
                currentPage === 'donate'
                  ? 'text-lava bg-lava/[0.08]'
                  : 'text-[#6B6B78] hover:text-snow hover:bg-white/[0.03]'
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
