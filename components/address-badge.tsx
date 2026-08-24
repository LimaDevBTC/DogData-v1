'use client'

import React from 'react';
import Image from 'next/image';
import { Award, Landmark } from 'lucide-react';
import { useVerifiedAddresses } from '@/contexts/VerifiedAddressesContext';
import { KINDS, type WalletKind } from '@/lib/dog/taxonomy';

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

  // ⚠️ TRÊS NÍVEIS DE AFIRMAÇÃO, o mesmo vocabulário do `EntityTag` do explorer:
  // `verified` é a entidade falando de si mesma com taxa paga; `named` é dedução
  // nossa sobre QUEM é; `classified` é dedução nossa sobre O QUE faz, sem saber
  // de quem é. Aqui a linha é apertada, então a distinção vai na cor e no title,
  // e a classe sai em itálico, que é a marca de "não é nome próprio".
  const nivel = verified.claim ?? (verified.source === 'onchain' ? 'named' : 'verified');
  const nosso = nivel !== 'verified';
  const classe = nivel === 'classified';
  const kindSpec = classe ? KINDS[(verified.kind || '') as WalletKind] : null;
  const porque = [
    nosso ? 'Labelled by DogData' : 'Verified by the owner',
    kindSpec?.definition,
    verified.evidence_note,
  ].filter(Boolean).join('\n');

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

  // ⚠️ SEM LOGO TAMBÉM DESENHA, e isto era um defeito de verdade. A condição
  // exigia `verified.logo` para renderizar qualquer coisa, então as carteiras
  // rotuladas por CLASSE — que por definição não têm logo, porque não sabemos de
  // quem são — caíam nas duas condições seguintes e o componente devolvia null.
  // A tela ficava exatamente como antes de existir o rótulo: o trabalho todo
  // parava no último centímetro.
  if (verified.type === 'official' && (verified.logo ? !imageError : true)) {
    if (!verified.logo) {
      return (
        <div className="inline-flex items-center gap-1.5" title={porque}>
          {classe
            ? <Landmark className={`${iconSize} text-dusty/45`} />
            : <Award className={`${iconSize} text-lava`} />}
          {showName && verified.name && (
            <span className={`${textSize} whitespace-nowrap font-medium ${classe ? 'italic text-dusty/55' : 'text-dusty/70'}`}>
              {verified.name}
              {verified.role && <span className="text-dusty/40"> · {verified.role}</span>}
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
          <span
            className={`${textSize} whitespace-nowrap font-medium ${classe ? 'italic text-dusty/55' : nosso ? 'text-dusty/70' : 'text-snow/80'}`}
            title={porque}
          >
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

