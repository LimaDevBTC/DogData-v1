"use client"

import Header from "./header"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'transactions'

interface LayoutProps {
  children: React.ReactNode
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export function Layout({ children, currentPage, setCurrentPage }: LayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white grid-container">
      {/* Header */}
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      {/* Main Content */}
      <main className="relative pt-16">
        <div className="container-fluid">
          {children}
        </div>
      </main>
    </div>
  )
}