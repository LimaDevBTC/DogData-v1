"use client"

// ═══════════════════════════════════════════════════════════════════════════
// ScrubChart — a linha que se lê com o dedo.
//
// Nasceu no painel interno, onde o fundador não conseguia perguntar "de que dia
// foi esse pico" (28/08), e virou peça compartilhada porque a mesma pergunta é
// a única que importa num gráfico de preço no celular.
//
// TRÊS DECISÕES DE CONSTRUÇÃO, e cada uma resolve um defeito medido:
//
// 1. TRAÇO EM SVG ESTICADO, MARCADOR EM HTML. O `viewBox` com
//    `preserveAspectRatio="none"` deixa a linha ocupar qualquer largura sem
//    ninguém medir o container (sem ResizeObserver, sem layout thrash), e o
//    `vector-effect` mantém a espessura real. Mas um `<circle>` dentro desse
//    mesmo viewBox vira ovo, então marcador, régua e extremos são elementos
//    HTML posicionados em porcentagem.
//
// 2. `touch-action: pan-y`. Sem isso, arrastar o dedo na horizontal dentro do
//    gráfico sequestra a rolagem vertical da página inteira. Com isso, o
//    navegador continua rolando na vertical e o gesto horizontal é nosso.
//
// 3. A LEITURA É PEGAJOSA NO TOQUE E EFÊMERA NO MOUSE. Celular não tem hover:
//    se a leitura sumisse ao levantar o dedo, ninguém conseguiria ler o número
//    que acabou de procurar. No mouse, sair do gráfico limpa, que é o que a
//    mão espera de um cursor.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react'

export interface ScrubPoint {
  /** O que o eixo x diz deste ponto: "sex 23/08", "14:00", "23 ago 2026". */
  label: string
  value: number
  /** Um segundo número do mesmo instante, opcional: "862 pageviews". */
  sub?: string
}

export function ScrubChart({
  points,
  color = '#E8660D',
  height = 72,
  format = (n: number) => String(n),
  caption,
  /** Marca o topo e o fundo da janela. Liga no preço, desliga na sparkline. */
  markExtremes = false,
  className = '',
}: {
  points: ScrubPoint[]
  color?: string
  height?: number
  format?: (n: number) => string
  caption?: string
  markExtremes?: boolean
  className?: string
}) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const mover = useCallback((clientX: number, total: number) => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)))
    setAtivo(Math.round(t * (total - 1)))
  }, [])

  if (points.length < 2) return null

  const W = 300
  const H = 100
  const pad = 6
  const valores = points.map((p) => p.value)
  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const span = max - min || 1
  const iMax = valores.indexOf(max)
  const iMin = valores.indexOf(min)

  const px = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2)
  const py = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2)
  const linha = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.value).toFixed(1)}`).join(' ')
  const area = `${linha} L${px(points.length - 1).toFixed(1)} ${H} L${px(0).toFixed(1)} ${H} Z`

  // fração 0..1 do ponto, para posicionar em HTML sem distorção
  const fx = (i: number) => (px(i) / W) * 100
  const fy = (v: number) => (py(v) / H) * 100

  const lido = ativo ?? points.length - 1
  const p = points[lido]
  const gid = `scrub-${Math.round(px(iMax))}-${points.length}`

  return (
    <div className={`w-full select-none ${className}`}>
      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Drag across the chart to read a point"
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={lido}
        aria-valuetext={`${p.label}: ${format(p.value)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          mover(e.clientX, points.length)
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') mover(e.clientX, points.length)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setAtivo(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setAtivo(Math.max(0, lido - 1))
          else if (e.key === 'ArrowRight') setAtivo(Math.min(points.length - 1, lido + 1))
          else if (e.key === 'Escape') setAtivo(null)
          else return
          e.preventDefault()
        }}
        className="relative w-full cursor-crosshair outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        style={{ height, touchAction: 'pan-y' }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path
            d={linha}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {markExtremes && iMax !== iMin && (
          <>
            <Extremo x={fx(iMax)} y={fy(max)} cor={color} texto={format(max)} lado="cima" />
            <Extremo x={fx(iMin)} y={fy(min)} cor={color} texto={format(min)} lado="baixo" />
          </>
        )}

        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-px transition-opacity"
          style={{ left: `${fx(lido)}%`, background: 'rgba(240,240,242,0.22)', opacity: ativo == null ? 0 : 1 }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${fx(lido)}%`, top: `${fy(p.value)}%`, background: color, boxShadow: '0 0 0 2px #050505' }}
        />
      </div>

      {/* A leitura ocupa o lugar da legenda: parada, diz o tamanho da janela;
          tocada, diz o ponto. Altura fixa para o cartão não pular na troca. */}
      <div className="mt-2 min-h-[2.2em] font-mono text-[10px] leading-relaxed">
        {ativo == null ? (
          <span className="uppercase tracking-[0.2em] text-white/25">{caption}</span>
        ) : (
          <>
            <span className="text-white/60">{p.label}</span>
            <span className="mx-1.5 text-white/20">·</span>
            <span className="font-bold text-white tabular-nums">{format(p.value)}</span>
            {p.sub && (
              <>
                <span className="mx-1.5 text-white/20">·</span>
                <span className="text-white/45">{p.sub}</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** O topo e o fundo da janela, ditos onde acontecem. */
function Extremo({
  x, y, cor, texto, lado,
}: { x: number; y: number; cor: string; texto: string; lado: 'cima' | 'baixo' }) {
  // ⚠️ o rótulo foge da borda: nas pontas ele sairia do quadro, então o
  // alinhamento vira à esquerda ou à direita conforme onde o extremo caiu
  const perto = x < 18 ? 'left' : x > 82 ? 'right' : 'center'
  const translate = perto === 'left' ? 'translateX(0)' : perto === 'right' ? 'translateX(-100%)' : 'translateX(-50%)'
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${x}%`, top: `${y}%`, background: cor, opacity: 0.7 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute font-mono text-[9px] tabular-nums text-white/35"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transform: `${translate} translateY(${lado === 'cima' ? '-140%' : '40%'})`,
        }}
      >
        {texto}
      </span>
    </>
  )
}
