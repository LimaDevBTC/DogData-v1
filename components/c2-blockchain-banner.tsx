"use client"

import Image from 'next/image'
import { ExternalLink } from 'lucide-react'

export function C2BlockchainBanner() {
  return (
    <div className="w-full mb-8 md:mb-10">
      <a 
        href="https://c2blockchain.com/"
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full group cursor-pointer"
      >
        <div className="relative w-full overflow-hidden bg-black border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-orange-500/10">
          {/* Badge "Official Partner" - Discreto sem fundo */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <span className="text-gray-400 text-[10px] font-mono font-medium uppercase tracking-wide">
              Official Partner
            </span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </div>

          {/* Conteúdo do Banner - Compacto e elegante */}
          <div className="relative w-full h-[70px] md:h-[90px] flex items-center justify-center px-6 md:px-12">
            <div className="flex items-center gap-4 md:gap-8 group-hover:scale-[1.02] transition-all duration-500 ease-out">
              {/* Logo C2 - Aumentado levemente */}
              <div className="relative w-[60px] h-[60px] md:w-[70px] md:h-[70px] flex-shrink-0">
                <Image
                  src="/C2.png"
                  alt="C2 Blockchain"
                  fill
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>

              {/* Texto com gradiente azul - Discreto mas legível */}
              <div className="flex items-center">
                <h2 
                  className="text-xl md:text-2xl lg:text-3xl font-bold uppercase tracking-wide"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  C2 BLOCKCHAIN OTC: CBLO
                </h2>
              </div>
            </div>

            {/* Efeito hover overlay */}
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-all duration-300 pointer-events-none"></div>
          </div>
        </div>
      </a>
    </div>
  )
}

