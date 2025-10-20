"use client"

import Header from "./header"
import Footer from "./footer"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'transactions'

interface LayoutProps {
  children: React.ReactNode
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export function Layout({ children, currentPage, setCurrentPage }: LayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white grid-container flex flex-col">
      {/* Header */}
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      {/* Main Content */}
      <main className="relative pt-16 flex-1">
        <div className="container-fluid">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  )
}