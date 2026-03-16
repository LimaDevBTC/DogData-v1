"use client"

import Image from 'next/image'
import { ExternalLink } from 'lucide-react'

interface PartnerBannerProps {
  imageUrl: string
  link: string
  alt?: string
}

export function PartnerBanner({ imageUrl, link, alt = "Partner Banner" }: PartnerBannerProps) {
  return (
    <div className="w-full mb-6 md:mb-8">
      <a 
        href={link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full group cursor-pointer"
      >
        <div className="relative w-full overflow-hidden bg-gradient-to-r from-[#0A0A0C] via-[#141416] to-[#0A0A0C] border border-lava/[0.08] hover:border-lava/40 transition-all duration-300">
          {/* Badge "Official Partner" - Canto superior direito */}
          <div className="absolute top-2 right-2 z-10 bg-lava/90 px-2 py-0.5 flex items-center gap-1">
            <span className="text-snow text-[9px] font-mono font-bold uppercase tracking-wide">
              Official Partner
            </span>
            <ExternalLink className="w-2 h-2 text-snow" />
          </div>

          {/* Imagem do parceiro */}
          <div className="relative w-full h-[120px] md:h-[140px] flex items-center justify-center p-4">
            <Image
              src={imageUrl}
              alt={alt}
              fill
              className="object-contain group-hover:scale-105 transition-transform duration-300"
              priority
            />
          </div>

          {/* Efeito hover overlay */}
          <div className="absolute inset-0 bg-lava/0 group-hover:bg-lava/5 transition-all duration-300"></div>
        </div>
      </a>
    </div>
  )
}

