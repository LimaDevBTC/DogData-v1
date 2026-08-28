'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PRANCHA 3: O CATÁLOGO DE BAIRROS.
//
// O fundador não quis uma forma para a cidade inteira, quis um catálogo: "cada
// condomínio pode ter uma forma dessa, cinco pétalas, dez pétalas, árvore de
// Natal, fractal de gelo. Cada bairro tem uma arquitetura dessa. E aí a gente
// teria que encaixar os vários formatos de bairro num formato geral genérico."
//
// O formato geral genérico é VORONOI sobre sementes de ângulo áureo:
//   · as sementes herdam a propriedade do girassol, então a idade do UTXO vira
//     distância da praça sem nunca fechar anel nem alinhar raio;
//   · as células ladrilham sem sobra e sem vão, que é o encaixe pedido;
//   · saem todas diferentes, porque as sementes não estão numa grade;
//   · e a DIVISA entre células é onde o verde passa. O sistema de parques não
//     foi desenhado depois: ele é o negativo do loteamento, 4,95 km² contínuos.
//
// Gerado por scripts/gerar_bairros.py com dado real.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'

interface Celula {
  id: number; x: number; z: number; padrao: string
  area_km2: number; lotes_alvo: number; lotes_postos: number; raio: number
}
interface Meta {
  bairros: number; lotes: number; carteiras: number
  recuoVerde_m: number; declive_max: number
  areaLoteavel_km2: number; areaVerde_km2: number
  padroes: string[]; celulas: Celula[]
}

// uma cor por arquitetura. Laranja é a família de Fibonacci, azul o clássico,
// branco o gelo, verde a árvore.
const COR: Record<string, string> = {
  girassol: '#FFC97A', petala5: '#F7931A', petala8: '#E8660D', petala10: '#C24A12',
  concha: '#FFE9C4', gelo: '#9FD4E8', pinheiro: '#6FA86B', grelha: '#8A93A8',
}
const ROTULO: Record<string, string> = {
  girassol: 'girassol', petala5: '5 pétalas', petala8: '8 pétalas', petala10: '10 pétalas',
  concha: 'concha', gelo: 'floco de gelo', pinheiro: 'árvore', grelha: 'grelha',
}

const R_SITIO = 3500
const PARQUE = { rumo: 43, dist: 5200, disco: 3600 }

export default function BairrosClient() {
  const cv = useRef<HTMLCanvasElement>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [lot, setLot] = useState<{ n: number; x: Int16Array; z: Int16Array; b: Uint16Array; c: Uint8Array } | null>(null)
  const [pinta, setPinta] = useState<'arquitetura' | 'idade' | 'bairro'>('arquitetura')
  const [zoom, setZoom] = useState(1)
  const [foco, setFoco] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [m, b] = await Promise.all([
        fetch('/city/bairros.json').then((r) => r.json()),
        fetch('/city/bairros-lotes.bin').then((r) => r.arrayBuffer()),
      ])
      if (!vivo) return
      const dv = new DataView(b)
      const n = Math.floor(b.byteLength / 7)
      const x = new Int16Array(n), z = new Int16Array(n)
      const bb = new Uint16Array(n), c = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        x[i] = dv.getInt16(i * 7, true); z[i] = dv.getInt16(i * 7 + 2, true)
        bb[i] = dv.getUint16(i * 7 + 4, true); c[i] = dv.getUint8(i * 7 + 6)
      }
      setMeta(m); setLot({ n, x, z, b: bb, c })
    })().catch(() => {})
    return () => { vivo = false }
  }, [])

  const padraoDe = useMemo(() => {
    const m = new Map<number, string>()
    meta?.celulas.forEach((c) => m.set(c.id, c.padrao))
    return m
  }, [meta])

  useEffect(() => {
    const canvas = cv.current
    if (!canvas || !lot || !meta) return
    const L = Math.min(1080, Math.floor(window.innerWidth * 0.60))
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = L * dpr; canvas.height = L * dpr
    canvas.style.width = `${L}px`; canvas.style.height = `${L}px`
    const g = canvas.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#0A0A0A'; g.fillRect(0, 0, L, L)

    const vis = R_SITIO / zoom
    const esc = (L / 2) / vis
    const px = (x: number) => L / 2 + x * esc
    const py = (z: number) => L / 2 + z * esc

    g.strokeStyle = 'rgba(255,255,255,0.10)'
    g.beginPath(); g.arc(L / 2, L / 2, R_SITIO * esc, 0, Math.PI * 2); g.stroke()

    const prad = (PARQUE.rumo * Math.PI) / 180
    g.fillStyle = 'rgba(46,90,58,0.30)'
    g.beginPath()
    g.arc(px(Math.sin(prad) * PARQUE.dist), py(-Math.cos(prad) * PARQUE.dist), PARQUE.disco * esc, 0, Math.PI * 2)
    g.fill()

    g.fillStyle = 'rgba(255,255,255,0.05)'
    g.beginPath(); g.arc(L / 2, L / 2, 960 * esc, 0, Math.PI * 2); g.fill()

    const raio = Math.max(0.45, esc * 8)
    for (let i = 0; i < lot.n; i++) {
      const X = px(lot.x[i]), Y = py(lot.z[i])
      if (X < -4 || Y < -4 || X > L + 4 || Y > L + 4) continue
      const pad = padraoDe.get(lot.b[i]) ?? 'girassol'
      if (foco && pad !== foco) continue
      if (pinta === 'arquitetura') g.fillStyle = COR[pad] ?? '#F7931A'
      else if (pinta === 'idade') g.fillStyle = `hsl(30 92% ${86 - (lot.c[i] / 7) * 58}%)`
      else g.fillStyle = `hsl(${(lot.b[i] * 47) % 360} 62% 60%)`
      g.beginPath(); g.arc(X, Y, raio, 0, Math.PI * 2); g.fill()
    }
  }, [lot, meta, pinta, zoom, foco, padraoDe])

  const porPadrao = useMemo(() => {
    const m = new Map<string, { n: number; lotes: number }>()
    meta?.celulas.forEach((c) => {
      const e = m.get(c.padrao) ?? { n: 0, lotes: 0 }
      e.n += 1; e.lotes += c.lotes_postos; m.set(c.padrao, e)
    })
    return Array.from(m.entries()).sort((a, b) => b[1].lotes - a[1].lotes)
  }, [meta])

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-5 py-6 text-white/80">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#F7931A]">
        DogCity · fundação · prancha 3
      </p>
      <h1 className="mt-1 text-3xl font-medium tracking-tight text-white">O catálogo de bairros</h1>
      <p className="mt-2 max-w-[68ch] font-mono text-[11px] leading-relaxed text-white/45">
        {meta?.bairros ?? '…'} bairros, cada um com a sua própria arquitetura interna, encaixados numa
        moldura de Voronoi sobre sementes de ângulo áureo. A moldura garante que a idade do UTXO vire
        distância da praça sem anel e sem raio; o catálogo garante que nenhum bairro se pareça com o
        vizinho. A divisa entre células é onde o verde passa.
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <canvas ref={cv} className="border border-white/10" />

        <aside className="w-[22rem] space-y-4 font-mono text-[11px]">
          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">A cidade</p>
            <dl className="mt-2 space-y-1">
              <Linha k="Bairros" v={meta ? String(meta.bairros) : '…'} destaque />
              <Linha k="Lotes plantados" v={meta ? meta.lotes.toLocaleString('pt-BR') : '…'} destaque />
              <Linha k="Carteiras elegíveis" v={meta ? meta.carteiras.toLocaleString('pt-BR') : '…'} />
              <Linha k="Área loteável" v={meta ? `${meta.areaLoteavel_km2} km²` : '…'} />
              <Linha k="Corredor verde" v={meta ? `${meta.areaVerde_km2} km²` : '…'} destaque />
              <Linha k="Recuo de divisa" v={meta ? `${meta.recuoVerde_m} m` : '…'} />
              <Linha k="Declive aceito" v={meta ? `até ${meta.declive_max}°` : '…'} />
            </dl>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              O verde não sobrou: ele é o negativo do loteamento. Cada célula recua {meta?.recuoVerde_m ?? 26} m
              da divisa e a soma dá um corredor contínuo que liga a cidade inteira.
            </p>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">As arquiteturas</p>
            <p className="mt-1 text-[10px] text-white/30">Clique para isolar.</p>
            <ul className="mt-2 space-y-1">
              {porPadrao.map(([pad, e]) => (
                <li key={pad}>
                  <button
                    onClick={() => setFoco(foco === pad ? null : pad)}
                    className={`flex w-full items-center gap-2 border px-2 py-1 text-left ${
                      foco === pad ? 'border-[#F7931A]' : 'border-transparent hover:border-white/10'
                    }`}
                  >
                    <span className="size-2.5 shrink-0" style={{ background: COR[pad] }} />
                    <span className="flex-1 text-white/70">{ROTULO[pad] ?? pad}</span>
                    <span className="tabular-nums text-white/40">{e.n} bairros</span>
                    <span className="w-16 text-right tabular-nums text-white/55">
                      {e.lotes.toLocaleString('pt-BR')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Pintar por</p>
            <div className="mt-2 flex gap-2">
              {(['arquitetura', 'idade', 'bairro'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPinta(v)}
                  className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                    pinta === v ? 'border-[#F7931A] text-[#F7931A]' : 'border-white/15 text-white/45'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {[1, 2, 4, 8].map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`border px-2 py-1 text-[10px] tabular-nums ${
                    zoom === z ? 'border-[#F7931A] text-[#F7931A]' : 'border-white/15 text-white/45'
                  }`}
                >
                  {z}×
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Aproxime em 4× ou 8× para ver o desenho de cada bairro. Em 1× o que se lê é a moldura;
              é de perto que a arquitetura aparece.
            </p>
          </section>
        </aside>
      </div>
    </main>
  )
}

function Linha({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/45">{k}</dt>
      <dd className={`tabular-nums ${destaque ? 'text-[#F7931A]' : 'text-white/80'}`}>{v}</dd>
    </div>
  )
}
