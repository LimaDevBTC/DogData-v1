"use client"

import { useState } from "react"
import { Layout } from "@/components/layout"
import OverviewPage from "./overview/page"
import HoldersPage from "./holders/page"
import AirdropPage from "./airdrop/page"
import BitcoinNetworkPage from "./bitcoin-network/page"
import TransactionsPage from "./transactions/page"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'transactions'

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState<PageType>('overview')
  
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
      default:
        return <OverviewPage />
    }
  }
  
  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </Layout>
  )
}