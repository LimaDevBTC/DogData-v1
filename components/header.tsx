"use client"

import { useState } from "react"
import { 
  BarChart3, 
  Users, 
  Gift, 
  Activity,
  Wifi,
  RefreshCw,
  Heart,
  CreditCard,
  Menu,
  X,
  Network,
  Sparkles
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'donate'

const navigation = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'Airdrop Analysis', page: 'airdrop' as PageType, icon: Sparkles }, // Runestone effect
  { name: 'Bitcoin Network', page: 'bitcoin-network' as PageType, icon: Network },
  { name: 'Markets', page: 'markets' as PageType, icon: BarChart3 },
  { name: 'Transactions', page: 'transactions' as PageType, icon: CreditCard },
]

interface HeaderProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export default function Header({ currentPage, setCurrentPage }: HeaderProps) {
  const [showTransactionsComingSoon, setShowTransactionsComingSoon] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800/50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <button 
              onClick={() => {
                setCurrentPage('overview')
                setMobileMenuOpen(false)
              }}
              className="flex items-center space-x-2 md:space-x-3 hover:opacity-80 transition-all duration-300 group"
            >
              {/* Ícone do logo - responsivo */}
              <div className="relative w-10 h-10 md:w-14 md:h-14 flex-shrink-0">
                <img 
                  src="/dog-logo.png" 
                  alt="DOG DATA"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback caso a imagem não exista
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Fallback temporário */}
                <div className="hidden w-full h-full bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center group-hover:opacity-90 transition-all duration-300">
                  <span className="text-white font-bold text-lg md:text-xl font-mono">D</span>
                </div>
              </div>
              
              {/* Nome do app com tipografia responsiva */}
              <span className="text-white font-mono text-lg md:text-2xl font-bold tracking-wider hover:text-orange-400 transition-colors duration-300 whitespace-nowrap">
                DOG DATA
              </span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-2">
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon
              
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.page === 'transactions') {
                      setShowTransactionsComingSoon(true)
                      setTimeout(() => setShowTransactionsComingSoon(false), 2000)
                    } else {
                      setCurrentPage(item.page)
                    }
                  }}
                  className={`flex items-center justify-center px-5 py-3 text-sm font-mono font-medium tracking-wide transition-colors duration-300 ${
                    item.page === 'transactions' ? 'w-[170px]' : ''
                  } ${
                    isActive
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : item.page === 'transactions' && showTransactionsComingSoon
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/30 border border-transparent hover:border-gray-700/30'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-nowrap block">
                    {item.page === 'transactions' && showTransactionsComingSoon ? 'COMING SOON' : item.name}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Live Status, Refresh & Donate */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Donate Button - Hidden on small mobile */}
            <button
              onClick={() => setCurrentPage('donate')}
              className="hidden lg:flex items-center px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-mono font-medium tracking-wide transition-all duration-300 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-105 group"
              title="Support DOG Data"
            >
              <Heart className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm font-semibold tracking-wide">Donate</span>
            </button>
            
            {/* Live Status - Compact on mobile */}
            <div className="px-2 md:px-4 py-2 md:py-3 bg-gray-800/50 border border-gray-700/50 flex items-center space-x-1 md:space-x-2">
              <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
              <span className="text-green-400 text-xs font-mono font-medium">LIVE</span>
            </div>
            
            {/* Refresh Button - Hidden on mobile */}
            <button
              onClick={() => window.location.reload()}
              className="hidden sm:block px-3 md:px-4 py-2 md:py-3 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300 group"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-orange-400 group-hover:rotate-180 transition-all duration-500" />
            </button>
            
            {/* Hamburger Menu Button - Mobile only */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden px-3 py-2 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Collapsible */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800/50 bg-black/95 backdrop-blur-lg animate-in slide-in-from-top duration-200">
          <div className="px-3 py-3 space-y-1">
            {/* Mobile Donate Button */}
            <button
              onClick={() => {
                setCurrentPage('donate')
                setMobileMenuOpen(false)
              }}
              className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-mono font-semibold text-sm tracking-wide transition-all duration-300 w-full shadow-lg shadow-orange-500/30"
            >
              <Heart className="w-4 h-4 mr-2" />
              Support DOG Data
            </button>
            
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon
              
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.page === 'transactions') {
                      setShowTransactionsComingSoon(true)
                      setTimeout(() => setShowTransactionsComingSoon(false), 2000)
                    } else {
                      setCurrentPage(item.page)
                      setMobileMenuOpen(false)
                    }
                  }}
                  className={`flex items-center px-3 py-2.5 text-sm font-mono font-medium tracking-wide transition-colors duration-300 w-full text-left ${
                    isActive
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : item.page === 'transactions' && showTransactionsComingSoon
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/30 border border-transparent hover:border-gray-700/30'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2.5 flex-shrink-0" />
                  <span className="whitespace-nowrap block">
                    {item.page === 'transactions' && showTransactionsComingSoon ? 'COMING SOON' : item.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}