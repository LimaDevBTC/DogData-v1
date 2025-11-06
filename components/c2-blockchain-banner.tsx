"use client"

import Image from 'next/image'
import { ExternalLink } from 'lucide-react'

export function C2BlockchainBanner() {
  return (
    <div className="w-full mb-10">
      <a 
        href="https://c2blockchain.com/"
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full group cursor-pointer"
      >
        <div className="relative w-full overflow-hidden bg-black border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-orange-500/10">
          {/* Badge "Official Partner" - Menor em mobile */}
          <div className="absolute top-2 right-2 md:top-3 md:right-3 z-10 flex items-center gap-1">
            <span className="text-gray-400 text-[8px] md:text-[10px] font-mono font-medium uppercase tracking-wide">
              Official Partner
            </span>
            <ExternalLink className="w-2 h-2 md:w-3 md:h-3 text-gray-400" />
          </div>

          {/* Conteúdo do Banner - Responsivo mas sempre em uma linha */}
          <div className="relative w-full h-[90px] flex items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 group-hover:scale-[1.02] transition-all duration-500 ease-out">
              {/* Logo C2 - Escala proporcionalmente */}
              <div className="relative w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] md:w-[70px] md:h-[70px] flex-shrink-0">
                <Image
                  src="/C2.png"
                  alt="C2 Blockchain"
                  fill
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>

              {/* Texto com gradiente azul - Escala mas NUNCA quebra */}
              <div className="flex items-center">
                <h2 
                  className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold uppercase tracking-tight sm:tracking-normal md:tracking-wide whitespace-nowrap"
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

