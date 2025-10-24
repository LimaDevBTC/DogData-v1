"use client"

import { useState, useEffect } from "react"
import { Layout } from "@/components/layout"
import OverviewPage from "./overview/page"
import HoldersPage from "./holders/page"
import AirdropPage from "./airdrop/page"
import BitcoinNetworkPage from "./bitcoin-network/page"
import TransactionsPage from "./transactions/page"
import DonatePage from "./donate/page"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'transactions' | 'donate'

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState<PageType>('overview')
  const [isInitialized, setIsInitialized] = useState(false)

  // Carregar página salva do localStorage
  useEffect(() => {
    const savedPage = localStorage.getItem('dogdata-current-page') as PageType
    if (savedPage && ['overview', 'holders', 'airdrop', 'bitcoin-network', 'transactions', 'donate'].includes(savedPage)) {
      setCurrentPage(savedPage)
    }
    setIsInitialized(true)
  }, [])

  // Salvar página atual no localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('dogdata-current-page', currentPage)
    }
  }, [currentPage, isInitialized])
  
  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage />
      case 'holders':
        return <HoldersPage />
      case 'airdrop':
        return <AirdropPage />
      case 'bitcoin-network':
        return <BitcoinNetworkPage />
      case 'transactions':
        return <TransactionsPage />
      case 'donate':
        return <DonatePage />
      default:
        return <OverviewPage />
    }
  }
  
  // Mostrar loading durante inicialização
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black text-white grid-container flex items-center justify-center">
        <div className="loading-dots mx-auto">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    )
  }

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </Layout>
  )
}