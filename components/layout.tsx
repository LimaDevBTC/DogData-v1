"use client"

import { useRouter, usePathname } from "next/navigation"
import Header from "./header"
import Footer from "./footer"
import { BitflowBanner } from "./bitflow-banner"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate' | 'multichain' | 'explorer' | 'status' | 'city' | 'profile'

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
      {/* ⚠️ NÃO devolver o pt-14/pt-16 daqui sem antes tornar o header fixo de
          verdade. O <header> declara `fixed top-0` (header.tsx:73), mas
          app/globals.css:296 tem `header { position: relative }` escrito FORA de
          qualquer @layer — e declaração sem camada vence utilitário dentro de
          @layer utilities, independente de especificidade. Resultado: o header
          nunca foi fixo, ficou sempre no fluxo, e este padding reservava 56px
          (64 no desktop) para um elemento que não estava sobreposto a nada.
          Medido em 27/08 no iPhone 14 Pro: o header ocupava 0→57 e o conteúdo
          só começava em 113. Era o vão que o fundador fotografou entre o header
          e o banner da BitFlow, e ele existia em TODA página do site.
          O que sobrou aqui é respiro de propósito, não compensação. */}
      <main className="relative pt-3 md:pt-4 flex-1">
        {fullBleed ? (
          <div className="transition-opacity duration-200 ease-out opacity-100">
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
              <BitflowBanner noMargin />
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
