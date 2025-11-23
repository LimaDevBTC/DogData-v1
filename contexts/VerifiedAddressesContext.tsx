"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface VerifiedAddress {
  type: 'official' | 'community'
  name?: string
  logo?: string
  website?: string
  twitter?: string
  twitter_name?: string
  verified_at: string
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
    
    // Carregar JSON apenas UMA vez para toda a aplicação
    fetch('/data/verified_addresses.json', {
      signal: AbortSignal.timeout(5000) // 5s timeout
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(jsonData => {
        if (cancelled) return;
        setData(jsonData)
        setLoading(false)
        console.log('✅ Verified addresses loaded:', Object.keys(jsonData.verified || {}).length, 'addresses')
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
    if (!data) return null
    return data.verified[address] || null
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

