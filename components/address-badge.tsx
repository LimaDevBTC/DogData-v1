'use client'

import React from 'react';
import Image from 'next/image';
import { Award } from 'lucide-react';
import { useVerifiedAddresses } from '@/contexts/VerifiedAddressesContext';

interface AddressBadgeProps {
  address: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export function AddressBadge({ address, size = 'md', showName = true }: AddressBadgeProps) {
  const { getVerified, loading } = useVerifiedAddresses();
  const [imageError, setImageError] = React.useState(false);

  // Early return se ainda carregando
  if (loading) return null;
  
  // Lookup direto usando o contexto
  const verified = getVerified(address);
  
  // Early return se não verificado
  if (!verified) return null;

  // ⚠️ A PROCEDÊNCIA MUDA O QUE O SELO AFIRMA. Verificada é a entidade falando de
  // si mesma, com taxa paga e arquivo enviado. `onchain` é dedução nossa a partir
  // do fluxo. As duas são úteis; passar a segunda como se fosse a primeira é onde
  // um explorer perde a autoridade. O nome sai mais discreto e o title conta a
  // prova, igual ao `EntityTag` do explorer.
  const nosso = verified.source === 'onchain';
  const porque = nosso
    ? `Labelled by DogData${verified.evidence_note ? `\n${verified.evidence_note}` : ''}`
    : `Verified by the owner`;

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
          <Award className={`${iconSize} text-lava`} />
          {showName && verified.name && (
            <span className={`${textSize} font-medium text-snow/80`}>
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
            className={`relative ${iconSize} rounded-full overflow-hidden bg-snow/10 cursor-pointer transition-transform hover:scale-110 flex items-center justify-center shrink-0`}
            title={porque}
          >
            <div className="w-full h-full flex items-center justify-center p-[2px]">
              <Image
                src={verified.logo}
                alt={verified.name || 'Verified'}
                width={size === 'sm' ? 14 : size === 'md' ? 18 : 22}
                height={size === 'sm' ? 14 : size === 'md' ? 18 : 22}
                className="object-contain rounded-full"
                onError={() => setImageError(true)}
              />
            </div>
          </div>
        )}
        {showName && verified.name && (
          <span className={`${textSize} font-medium ${nosso ? 'text-dusty/70' : 'text-snow/80'}`} title={porque}>
            {verified.name}
            {nosso && verified.role && <span className="text-dusty/40"> · {verified.role}</span>}
          </span>
        )}
      </div>
    );
  }

  // Community badge com Twitter
  if (verified.type === 'community' && verified.twitter) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Award className={`${iconSize} text-lava`} />
        {showName && verified.twitter_name && (
          <a
            href={`https://twitter.com/${verified.twitter.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${textSize} font-medium text-lava hover:text-lava-light transition-colors`}
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
      <code className="text-snow text-xs break-all">{address}</code>
      <AddressBadge address={address} size="sm" showName={false} />
    </div>
  );
}

