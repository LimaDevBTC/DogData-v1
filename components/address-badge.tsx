'use client'

import React from 'react';
import Image from 'next/image';
import { Award } from 'lucide-react';

interface AddressBadgeProps {
  address: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

interface VerifiedAddress {
  type: 'official' | 'community';
  name?: string;
  logo?: string;
  website?: string;
  twitter?: string;
  twitter_name?: string;
  verified_at: string;
}

interface VerifiedAddresses {
  config: {
    donation_address: string;
    verification_fee: number;
    update_fee: number;
  };
  verified: {
    [address: string]: VerifiedAddress;
  };
  pending_claims: any;
}

// Carregar dados de endereços verificados
let verifiedData: VerifiedAddresses | null = null;

async function loadVerifiedAddresses(): Promise<VerifiedAddresses> {
  if (verifiedData) return verifiedData;
  
  try {
    const response = await fetch('/data/verified_addresses.json');
    verifiedData = await response.json();
    return verifiedData!;
  } catch (error) {
    console.error('Erro ao carregar endereços verificados:', error);
    return {
      config: {
        donation_address: '',
        verification_fee: 0,
        update_fee: 0
      },
      verified: {},
      pending_claims: {}
    };
  }
}

export function AddressBadge({ address, size = 'md', showName = true }: AddressBadgeProps) {
  const [verified, setVerified] = React.useState<VerifiedAddress | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    loadVerifiedAddresses().then(data => {
      setVerified(data.verified[address] || null);
      setLoading(false);
      setImageError(false);
    });
  }, [address]);

  if (loading || !verified) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSize = sizeClasses[size];
  const textSize = textSizeClasses[size];

  // Exchange oficial com logo
  if (verified.type === 'official' && verified.logo) {
    if (imageError) {
      return (
        <div className="inline-flex items-center gap-1.5">
          <Award className={`${iconSize} text-orange-400`} />
          {showName && verified.name && (
            <span className={`${textSize} font-medium text-gray-300`}>
              {verified.name}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5">
        {verified.logo && (
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
              onError={() => setImageError(true)}
            />
          </div>
        )}
        {showName && verified.name && (
          <span className={`${textSize} font-medium text-gray-300`}>
            {verified.name}
          </span>
        )}
      </div>
    );
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
    );
  }

  return null;
}

export function AddressBadgeInline({ address }: { address: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <code className="text-white text-xs break-all">{address}</code>
      <AddressBadge address={address} size="sm" showName={false} />
    </div>
  );
}

