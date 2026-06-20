"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, CreditCard, Users, Zap, LayoutGrid, X, Sparkles, Network, Heart, TrendingUp, Globe } from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate' | 'multichain' | 'explorer'

const primaryNav = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Txns', page: 'transactions' as PageType, icon: CreditCard },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'Metrics', page: 'metrics' as PageType, icon: Zap },
]

const moreNav = [
  { name: 'Cross-Chain', page: 'multichain' as PageType, icon: Globe },
  { name: 'Markets', page: 'markets' as PageType, icon: TrendingUp },
  { name: 'Airdrop', page: 'airdrop' as PageType, icon: Sparkles },
  { name: 'Bitcoin', page: 'bitcoin-network' as PageType, icon: Network },
  { name: 'Donate', page: 'donate' as PageType, icon: Heart },
]

interface MobileBottomNavProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export default function MobileBottomNav({ currentPage, setCurrentPage }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreActive = moreNav.some(item => item.page === currentPage)

  const handleMoreItemClick = useCallback((page: PageType) => {
    setCurrentPage(page)
    setMoreOpen(false)
  }, [setCurrentPage])

  // Close "More" when clicking outside
  useEffect(() => {
    if (!moreOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-bottom-nav]')) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [moreOpen])

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50" data-bottom-nav>
      {/* More overlay */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-void/60 backdrop-blur-sm z-40"
            onClick={() => setMoreOpen(false)}
          />
          {/* Menu */}
          <div className="relative z-50 mx-3 mb-2 bg-[#0A0A0C]/95 backdrop-blur-2xl border border-white/[0.06] rounded-2xl animate-fade-in overflow-hidden shadow-xl shadow-black/50">
            <div className="grid grid-cols-2 gap-px bg-white/[0.03]">
              {moreNav.map((item) => {
                const Icon = item.icon
                const isActive = currentPage === item.page
                return (
                  <button
                    key={item.page}
                    onClick={() => handleMoreItemClick(item.page)}
                    className={`flex flex-col items-center justify-center py-4 px-3 min-h-[68px] active:scale-95 transition-all duration-150 ${
                      isActive
                        ? 'bg-lava/[0.08] text-lava'
                        : 'bg-[#0A0A0C]/60 text-[#6B6B78] hover:text-snow'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1.5" />
                    <span className="text-[10px] font-mono uppercase tracking-wider font-medium">
                      {item.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Main bottom bar */}
      <nav className="bg-void/90 backdrop-blur-2xl border-t border-white/[0.04] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-14">
          {/* Primary nav items */}
          {primaryNav.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.page
            return (
              <button
                key={item.page}
                onClick={() => {
                  setCurrentPage(item.page)
                  setMoreOpen(false)
                }}
                className={`relative flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[48px] active:scale-95 transition-all duration-100 ${
                  isActive ? 'text-lava' : 'text-snow/60'
                }`}
              >
                {/* Active indicator dot */}
                <Icon className={`w-5 h-5 mb-0.5 transition-transform duration-200 ${isActive ? 'scale-105' : ''}`} />
                <span className={`text-[9px] font-mono uppercase tracking-wide ${isActive ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
                {isActive && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-lava rounded-full" />}
              </button>
            )
          })}

          {/* More button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMoreOpen(!moreOpen)
            }}
            className={`relative flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[48px] active:scale-95 transition-all duration-100 ${
              moreOpen || isMoreActive ? 'text-lava' : 'text-snow/60'
            }`}
          >
            {moreOpen ? (
              <X className="w-5 h-5 mb-0.5" />
            ) : (
              <LayoutGrid className="w-5 h-5 mb-0.5" />
            )}
            <span className={`text-[9px] font-mono uppercase tracking-wide ${isMoreActive ? 'font-semibold' : ''}`}>
              More
            </span>
            {isMoreActive && !moreOpen && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-lava rounded-full" />}
          </button>
        </div>
      </nav>
    </div>
  )
}
