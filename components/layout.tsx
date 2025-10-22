"use client"

import { useState, useEffect } from "react"
import Header from "./header"
import Footer from "./footer"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'transactions' | 'donate'

interface LayoutProps {
  children: React.ReactNode
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export function Layout({ children, currentPage, setCurrentPage }: LayoutProps) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevPage, setPrevPage] = useState(currentPage)

  useEffect(() => {
    if (currentPage !== prevPage) {
      // Iniciar transição
      setIsTransitioning(true)
      
      // Scroll suave para o topo
      window.scrollTo({ top: 0, behavior: 'smooth' })
      
      // Pequeno delay para a transição ser visível
      setTimeout(() => {
        setPrevPage(currentPage)
        setIsTransitioning(false)
      }, 150)
    }
  }, [currentPage, prevPage])

  return (
    <div className="min-h-screen bg-black text-white grid-container flex flex-col">
      {/* Header */}
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      {/* Main Content */}
      <main className="relative pt-20 flex-1">
        <div 
          className={`container-fluid transition-opacity duration-150 ease-in-out ${
            isTransitioning ? 'opacity-90' : 'opacity-100'
          }`}
        >
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <Footer currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  )
}