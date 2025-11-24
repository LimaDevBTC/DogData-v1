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
    const result = verifiedKey ? data.verified[verifiedKey] : null
    // Debug temporário para Dog of Bitcoin
    if (addressLower.includes('bc1pz66497g7mj8cq0ncj2hjjfxcxuzv44yxnlach5puypf39ghejmaq20zgne')) {
      console.log('🔍 [getVerified] Endereço:', address, 'Lower:', addressLower, 'Key encontrada:', verifiedKey, 'Resultado:', result)
    }
    return result
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

