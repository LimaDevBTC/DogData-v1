"use client"

import { 
  BarChart3, 
  Users, 
  Gift, 
  Activity,
  Wifi,
  RefreshCw
} from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'transactions'

const navigation = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'Airdrop Analysis', page: 'airdrop' as PageType, icon: Gift },
  { name: 'Bitcoin Network', page: 'bitcoin-network' as PageType, icon: Activity },
]

interface HeaderProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export default function Header({ currentPage, setCurrentPage }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <button 
              onClick={() => setCurrentPage('overview')}
              className="flex items-center space-x-3 hover:opacity-80 transition-all duration-300 group"
            >
              {/* Ícone do logo - será substituído por imagem */}
              <div className="relative w-14 h-14 flex-shrink-0">
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
                <div className="hidden w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center group-hover:opacity-90 transition-all duration-300">
                  <span className="text-white font-bold text-xl font-mono">D</span>
                </div>
              </div>
              
              {/* Nome do app com tipografia code moderna */}
              <span className="text-white font-mono text-2xl font-bold tracking-wider hover:text-orange-400 transition-colors duration-300">
                DOG DATA
              </span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navigation.map((item) => {
              const isActive = currentPage === item.page
              const Icon = item.icon
              
              return (
                <button
                  key={item.name}
                  onClick={() => setCurrentPage(item.page)}
                  className={`flex items-center px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/30 border border-transparent hover:border-gray-700/30'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </button>
              )
            })}
          </nav>

          {/* Live Status & Refresh */}
          <div className="flex items-center space-x-2">
            <div className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
              <span className="text-green-400 text-xs font-mono font-medium">LIVE</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300 group"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-orange-400 group-hover:rotate-180 transition-all duration-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-800/50 bg-black/90 backdrop-blur-lg">
        <div className="px-4 pt-3 pb-4 space-y-2">
          {navigation.map((item) => {
            const isActive = currentPage === item.page
            const Icon = item.icon
            
            return (
              <button
                key={item.name}
                onClick={() => setCurrentPage(item.page)}
                className={`flex items-center px-4 py-3 text-base font-medium transition-all duration-300 w-full text-left ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/30 border border-transparent hover:border-gray-700/30'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}