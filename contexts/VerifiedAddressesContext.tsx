"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

/**
 * ⚠️ ESTE CONTEXTO PASSOU A LER A FONTE ÚNICA, `/api/identity`, e não mais o
 * `verified_addresses.json` cru. Antes existiam três fontes de identidade sem
 * conversa entre si e a mesma carteira era "Bitget" numa tela e um endereço
 * anônimo na outra. Depois de unificar o explorer, o desencontro virou o
 * contrário: a Kraken, que é o MAIOR holder de DOG, aparecia com nome no
 * explorer e anônima na página de holders. Uma fonte só resolve os dois lados.
 *
 * ⚠️ E `source` VIAJA JUNTO. "A Bitget disse que este endereço é dela", com taxa
 * paga, não é a mesma afirmação que "a gente concluiu pelo fluxo". O selo precisa
 * do campo para não passar uma pela outra.
 */
interface VerifiedAddress {
  type: 'official' | 'community'
  name?: string
  logo?: string
  website?: string
  twitter?: string
  twitter_name?: string
  verified_at: string
  description?: string
  source?: 'verified' | 'onchain'
  claim?: 'verified' | 'named' | 'classified'
  kind?: string | null
  role?: string | null
  evidence?: string | null
  evidence_note?: string | null
}

interface VerifiedAddressesData {
  config: {
    donation_address: string
    verification_fee: number
    update_fee: number
  }
  verified: {
    [address: string]: VerifiedAddress
  }
  pending_claims: any
}

interface VerifiedAddressesContextType {
  data: VerifiedAddressesData | null
  loading: boolean
  getVerified: (address: string) => VerifiedAddress | null
}

const VerifiedAddressesContext = createContext<VerifiedAddressesContextType>({
  data: null,
  loading: true,
  getVerified: () => null
})

export function VerifiedAddressesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<VerifiedAddressesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false;
    
    // Uma ida só, para a aplicação inteira, à fonte que já juntou as duas origens
    fetch('/api/identity', {
      signal: AbortSignal.timeout(6000)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (cancelled) return;
        const verified: Record<string, VerifiedAddress> = {}
        for (const [address, id] of Object.entries((json?.identities || {}) as Record<string, any>)) {
          verified[address] = {
            type: 'official',
            name: id.name,
            logo: id.logo || undefined,
            website: id.website || undefined,
            twitter: id.twitter || undefined,
            verified_at: '',
            source: id.source,
            claim: id.claim,
            kind: id.kind ?? null,
            role: id.role ?? null,
            evidence: id.evidence ?? null,
            evidence_note: id.evidence_note ?? null,
          }
        }
        setData({ config: { donation_address: '', verification_fee: 0, update_fee: 0 }, verified, pending_claims: {} })
        setLoading(false)
      })
      .catch(error => {
        if (cancelled) return;
        // Silenciar erro se for apenas timeout ou cancelamento
        if (error.name !== 'AbortError' && error.name !== 'TimeoutError') {
          console.error('❌ Error loading verified addresses:', error)
        }
        // Fallback vazio
        setData({
          config: {
            donation_address: '',
            verification_fee: 0,
            update_fee: 0
          },
          verified: {},
          pending_claims: {}
        })
        setLoading(false)
      })
    
    return () => {
      cancelled = true;
    };
  }, [])

  const getVerified = (address: string): VerifiedAddress | null => {
    if (!data || !address) return null
    // Normalizar endereço para lowercase para busca case-insensitive
    const addressLower = address.toLowerCase()
    // Tentar busca direta primeiro
    if (data.verified[address]) {
      return data.verified[address]
    }
    // Tentar busca case-insensitive
    const verifiedKey = Object.keys(data.verified).find(
      key => key.toLowerCase() === addressLower
    )
    return verifiedKey ? data.verified[verifiedKey] : null
  }

  return (
    <VerifiedAddressesContext.Provider value={{ data, loading, getVerified }}>
      {children}
    </VerifiedAddressesContext.Provider>
  )
}

export function useVerifiedAddresses() {
  const context = useContext(VerifiedAddressesContext)
  if (!context) {
    throw new Error('useVerifiedAddresses must be used within VerifiedAddressesProvider')
  }
  return context
}

