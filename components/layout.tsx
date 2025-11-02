"use client"

import { useRouter, usePathname } from "next/navigation"
import Header from "./header"
import Footer from "./footer"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'donate'

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
    <div className="min-h-screen bg-black text-white grid-container flex flex-col">
      {/* Header */}
      <Header currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
      
      {/* Main Content */}
      <main className="relative pt-[25px] md:pt-20 flex-1">
        <div className="container-fluid transition-opacity duration-150 ease-in-out opacity-100">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <Footer currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
    </div>
  )
}