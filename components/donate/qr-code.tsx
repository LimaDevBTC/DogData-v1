"use client"

// O QR das janelas de pagamento (licença e DOG MOTORS), desenhado aqui da MESMA string que o link usa. Saiu de
// ./donate-modal.tsx sem mudar uma linha da conta, para o modo "car" (./car-checkout.tsx) usar o mesmo.
//
// O que existia antes era um JPEG na pasta public: derivado que não acompanhava o endereço (se a constante mudasse,
// o código mandava dinheiro para o lugar errado e nada acusava), e compressão com perda suja justamente a borda dos
// módulos, que é o que a câmera precisa ler.

import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/** Margem exigida pelo padrão. Sem os 4 módulos de silêncio, leitor nenhum lê. */
const QUIET = 4

export function QrCode({ text, label, className = 'w-36 h-36' }: { text: string; label: string; className?: string }) {
  const { d, size } = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    const n = q.getModuleCount()
    // Um path só, acumulando corridas horizontais de módulos escuros: fica bem
    // mais leve no DOM que um <rect> por módulo.
    let path = ''
    for (let row = 0; row < n; row += 1) {
      let col = 0
      while (col < n) {
        if (!q.isDark(row, col)) { col += 1; continue }
        let run = 1
        while (col + run < n && q.isDark(row, col + run)) run += 1
        path += `M${col + QUIET} ${row + QUIET}h${run}v1h-${run}z`
        col += run
      }
    }
    return { d: path, size: n + QUIET * 2 }
  }, [text])

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      // O que está codificado, legível de fora: o endereço fica auditável sem
      // precisar decodificar a imagem.
      data-qr-text={text}
      shapeRendering="crispEdges"
      className={`${className} shrink-0`}
    >
      {/* ⚠️ Contraste aqui é requisito de leitura, não estilo: branco e preto,
          nunca a paleta escura da casa. */}
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={d} fill="#000000" />
    </svg>
  )
}
