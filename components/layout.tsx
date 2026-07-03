"use client"

import { useRouter, usePathname } from "next/navigation"
import Header from "./header"
import Footer from "./footer"
import { BitflowBanner } from "./bitflow-banner"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate' | 'multichain' | 'explorer' | 'status' | 'city'

interface LayoutProps {
  children: React.ReactNode
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
  fullBleed?: boolean
}

export function Layout({ children, currentPage, fullBleed }: LayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSetCurrentPage = (page: PageType) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dogdata-current-page', page)
    }
    if (page === 'overview') {
      router.push('/')
    } else {
      router.push(`/${page}`)
    }
  }

  return (
    <div className="min-h-screen bg-void text-snow grid-container flex flex-col">
      {/* Aurora Ambient Light */}
      <div className="aurora-bg" aria-hidden="true" />

      {/* Header */}
      <Header currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />

      {/* Main Content */}
      <main className="relative pt-14 md:pt-16 flex-1">
        {fullBleed ? (
          <div className="transition-opacity duration-200 ease-out opacity-100">
            <div className="container-fluid">
              <BitflowBanner />
            </div>
            {children}
          </div>
        ) : (
          <div className="container-fluid transition-opacity duration-200 ease-out opacity-100">
            <BitflowBanner />
            {children}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
    </div>
  )
}
