"use client"

import React from 'react'
import Image from 'next/image'
import { Award } from 'lucide-react'
import { useVerifiedAddresses } from '@/contexts/VerifiedAddressesContext'

interface AddressBadgeProps {
  address: string
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
}

// Componente 100% otimizado com React.memo
const AddressBadgeOptimized = React.memo(function AddressBadge({ 
  address, 
  size = 'md', 
  showName = true 
}: AddressBadgeProps) {
  const { getVerified, loading } = useVerifiedAddresses()
  
  // Early return se ainda carregando
  if (loading) return null
  
  // Lookup direto - SEM useState, SEM useEffect
  const verified = getVerified(address)
  
  // Early return se não verificado
  if (!verified) return null

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const iconSize = sizeClasses[size]
  const textSize = textSizeClasses[size]

  // Exchange oficial com logo
  if (verified.type === 'official' && verified.logo) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <div 
          className={`relative ${iconSize} rounded-full overflow-hidden bg-white/10 cursor-pointer transition-transform hover:scale-110`}
          title={verified.name || 'Verified'}
        >
          <Image
            src={verified.logo}
            alt={verified.name || 'Verified'}
            width={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
            height={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
            className="object-contain"
            loading="lazy"
          />
        </div>
        {showName && verified.name && (
          <span className={`${textSize} font-medium text-gray-300`}>
            {verified.name}
          </span>
        )}
      </div>
    )
  }

  // Community badge com Twitter
  if (verified.type === 'community' && verified.twitter) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Award className={`${iconSize} text-orange-400`} />
        {showName && verified.twitter_name && (
          <a
            href={`https://twitter.com/${verified.twitter.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${textSize} font-medium text-orange-400 hover:text-orange-300 transition-colors`}
          >
            {verified.twitter}
          </a>
        )}
      </div>
    )
  }

  return null
}, (prevProps, nextProps) => {
  // Custom comparison - só re-renderiza se endereço mudar
  return prevProps.address === nextProps.address && 
         prevProps.size === nextProps.size && 
         prevProps.showName === nextProps.showName
})

AddressBadgeOptimized.displayName = 'AddressBadgeOptimized'

export { AddressBadgeOptimized as AddressBadge }

export function AddressBadgeInline({ address }: { address: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <code className="text-white text-xs break-all">{address}</code>
      <AddressBadgeOptimized address={address} size="sm" showName={false} />
    </div>
  )
}

