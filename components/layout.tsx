"use client"

import { useRouter, usePathname } from "next/navigation"
import Header from "./header"
import Footer from "./footer"
import MobileBottomNav from "./mobile-bottom-nav"
import { C2BlockchainBanner } from "./c2-blockchain-banner"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate'

interface LayoutProps {
  children: React.ReactNode
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export function Layout({ children, currentPage }: LayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSetCurrentPage = (page: PageType) => {
    // Salvar no localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('dogdata-current-page', page)
    }
    // Navegar para a rota
    // Overview vai para a home (/) ao invés de /overview
    if (page === 'overview') {
      router.push('/')
    } else {
    router.push(`/${page}`)
    }
  }

  return (
    <div className="min-h-screen bg-void text-snow grid-container flex flex-col">
      {/* Header */}
      <Header currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />

      {/* Main Content */}
      <main className="relative pt-16 md:pt-20 flex-1 pb-20 md:pb-0">
        <div className="container-fluid transition-opacity duration-150 ease-in-out opacity-100">
          {/* C2 Blockchain Partner Banner - Topo de todas as páginas */}
          <C2BlockchainBanner />

          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
    </div>
  )
}
