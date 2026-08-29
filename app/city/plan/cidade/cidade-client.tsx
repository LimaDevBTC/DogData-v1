'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PRANCHA 4: A CIDADE ENDEREÇADA.
//
// Implementa o capítulo 6 do plano-diretor.md: 12 setores de 30°, cada um com
// malha própria girada 7,5°, quartos de 540 m, quarteirões de 168 m, 84 lotes
// de 300 m² cada. Nada começa antes de r = 1.300 m.
//
// ⚠️ A ORDEM É A DE VERDADE AGORA. As pranchas 2 e 3 ordenavam por
// `oldest_age_days`, e 74,9% das carteiras empatam nessa coluna: três quartos da
// cidade estavam ordenados pelo endereço, que é aleatório. Aqui a chave é
// `(ts, txid, vout)` do UTXO mais antigo, que dá zero colisões em 52.994. Ela
// também é impossível de fraudar: endereço é grindável, txid e vout são
// escolhidos por quem envia.
//
// Duas camadas por cima do tecido:
//   · 185 enclaves de família (o ancestral de profundidade 1 na genealogia do
//     DOG, só famílias com 10 elegíveis ou mais, porque 91,7% das famílias têm
//     uma carteira só);
//   · o condomínio do Dog Social Club, no setor do rumo 60, que ocupa os lotes
//     mais internos IGNORANDO a idade, que é a regra 4 do fundador.
//
// Gerado por scripts/gerar_cidade.py.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'

interface Meta {
  setores: number; giroPorSetor: number; bulevar_m: number
  celula_m: number; quarteirao_m: number; lote_m2: number
  declive_max: number; raioInicio: number; raioSitio: number
  capacidadeHaPorSetor: number[]
  tecidoDisponivel_km2: number; areaLotes_km2: number
  loteMediana_m2: number; loteMenor_m2: number; loteMaior_m2: number
  carteiras: number; plantadas: number
  enclaves: number; carteirasEmEnclave: number
  dsc: number; setorDSC: number; quartos: number; quarteiroes: number
}

const CORES_FORMA = ['#8B8B93', '#C9A227', '#3FA7D6', '#E8660D', '#E5484D']
const CORES_COORTE = ['#FFE9C4', '#FFC97A', '#F7931A', '#E8660D', '#C24A12', '#8E3A1B', '#5C2D1E', '#3A2320']
const PARQUE = { rumo: 43, dist: 5200, disco: 3600 }

export default function CidadeClient() {
  const cv = useRef<HTMLCanvasElement>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [d, setD] = useState<{ n: number; x: Int16Array; z: Int16Array; s: Uint8Array; c: Uint8Array; f: Uint16Array; g: Uint8Array; fr: Uint8Array; pf: Uint8Array } | null>(null)
  const [pinta, setPinta] = useState<'idade' | 'setor' | 'familia' | 'forma'>('idade')
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [m, buf] = await Promise.all([
        fetch('/city/cidade.json').then((r) => r.json()),
        fetch('/city/cidade-lotes.bin').then((r) => r.arrayBuffer()),
      ])
      if (!vivo) return
      const dv = new DataView(buf)
      // ⚠️ O REGISTRO FOI DE 9 PARA 11 BYTES em 28/08, quando o lote deixou de ser
      // 300 m² para todos e passou a seguir a raiz do saldo (masterplan §9). Os
      // dois bytes novos são a frente e a profundidade em metros: sem eles a
      // prancha desenha ponto, e ponto não mostra que a cidade tem lote de 21 m²
      // e lote de 33 mil.
      const REG = 11
      const n = Math.floor(buf.byteLength / REG)
      const x = new Int16Array(n), z = new Int16Array(n)
      const s = new Uint8Array(n), c = new Uint8Array(n)
      const f = new Uint16Array(n), g = new Uint8Array(n)
      const fr = new Uint8Array(n), pf = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        const o = i * REG
        x[i] = dv.getInt16(o, true); z[i] = dv.getInt16(o + 2, true)
        s[i] = dv.getUint8(o + 4); c[i] = dv.getUint8(o + 5)
        f[i] = dv.getUint16(o + 6, true); g[i] = dv.getUint8(o + 8)
        fr[i] = dv.getUint8(o + 9); pf[i] = dv.getUint8(o + 10)
      }
      setMeta(m); setD({ n, x, z, s, c, f, g, fr, pf })
    })().catch(() => {})
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    const canvas = cv.current
    if (!canvas || !d || !meta) return
    const L = Math.min(1080, Math.floor(window.innerWidth * 0.60))
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = L * dpr; canvas.height = L * dpr
    canvas.style.width = `${L}px`; canvas.style.height = `${L}px`
    const g2 = canvas.getContext('2d')
    if (!g2) return
    g2.setTransform(dpr, 0, 0, dpr, 0, 0)
    g2.fillStyle = '#0A0A0A'; g2.fillRect(0, 0, L, L)

    const R = meta.raioSitio
    const esc = (L / 2) / (R / zoom)
    const px = (v: number) => L / 2 + v * esc
    const py = (v: number) => L / 2 + v * esc

    // o parque a nordeste
    const prad = (PARQUE.rumo * Math.PI) / 180
    g2.fillStyle = 'rgba(46,90,58,0.28)'
    g2.beginPath()
    g2.arc(px(Math.sin(prad) * PARQUE.dist), py(-Math.cos(prad) * PARQUE.dist), PARQUE.disco * esc, 0, Math.PI * 2)
    g2.fill()

    // as 12 costuras, onde correm os bulevares
    g2.strokeStyle = 'rgba(255,255,255,0.09)'; g2.lineWidth = 1
    for (let s = 0; s < meta.setores; s++) {
      const a = (s * (360 / meta.setores) * Math.PI) / 180
      g2.beginPath(); g2.moveTo(L / 2, L / 2)
      g2.lineTo(px(Math.sin(a) * R), py(-Math.cos(a) * R)); g2.stroke()
    }
    g2.strokeStyle = 'rgba(255,255,255,0.10)'
    g2.beginPath(); g2.arc(L / 2, L / 2, R * esc, 0, Math.PI * 2); g2.stroke()

    // o precinto da praça
    g2.fillStyle = 'rgba(255,255,255,0.05)'
    g2.beginPath(); g2.arc(L / 2, L / 2, meta.raioInicio * esc, 0, Math.PI * 2); g2.fill()

    // ⚠️ RETÂNGULO, não ponto. Com o lote seguindo a raiz do saldo a cidade tem
    // parcela de 21 m² e parcela de 33 mil; desenhada como bolinha de raio fixo
    // ela volta a parecer 53 mil iguais, que é justamente o que deixou de ser.
    for (let i = 0; i < d.n; i++) {
      const X = px(d.x[i]), Y = py(d.z[i])
      if (X < -8 || Y < -8 || X > L + 8 || Y > L + 8) continue
      if (d.g[i] & 1) g2.fillStyle = '#22D3EE'
      else if (pinta === 'idade') g2.fillStyle = CORES_COORTE[d.c[i]]
      else if (pinta === 'setor') g2.fillStyle = `hsl(${d.s[i] * 30} 64% 58%)`
      else if (pinta === 'forma') g2.fillStyle = CORES_FORMA[(d.g[i] >> 1) & 7]
      else g2.fillStyle = d.f[i] ? `hsl(${(d.f[i] * 61) % 360} 70% 60%)` : 'rgba(255,255,255,0.10)'
      const w = Math.max(0.5, d.fr[i] * esc), h = Math.max(0.5, d.pf[i] * esc)
      g2.fillRect(X - w / 2, Y - h / 2, w, h)
    }
  }, [d, meta, pinta, zoom])

  const porSetor = useMemo(() => meta?.capacidadeHaPorSetor ?? [], [meta])

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-5 py-6 text-white/80">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#F7931A]">
        DogCity · fundação · prancha 4
      </p>
      <h1 className="mt-1 text-3xl font-medium tracking-tight text-white">A cidade endereçada</h1>
      <p className="mt-2 max-w-[70ch] font-mono text-[11px] leading-relaxed text-white/45">
        {meta ? meta.plantadas.toLocaleString('pt-BR') : '…'} carteiras com endereço, em{' '}
        {meta?.setores ?? 12} setores de 30° com malha própria girada 7,5° cada. A ordem é a de chegada
        de verdade, pela chave (ts, txid, vout) do UTXO mais antigo, com zero colisões. Dentro de cada
        setor, mais antigo é sempre mais perto da praça.
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <canvas ref={cv} className="border border-white/10" />

        <aside className="w-[22rem] space-y-4 font-mono text-[11px]">
          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">A cidade</p>
            <dl className="mt-2 space-y-1">
              <L k="Carteiras endereçadas" v={meta ? meta.plantadas.toLocaleString('pt-BR') : '…'} d />
              <L k="Tecido disponível" v={meta ? `${meta.tecidoDisponivel_km2} km²` : '…'} />
              <L k="Área dos lotes" v={meta ? `${meta.areaLotes_km2} km²` : '…'} />
              <L k="Quartos" v={meta ? String(meta.quartos) : '…'} />
              <L k="Quarteirões" v={meta ? String(meta.quarteiroes) : '…'} />
              <L k="Lote mediano" v={meta ? `${meta.loteMediana_m2.toLocaleString('pt-BR')} m²` : '…'} d />
              <L k="Menor e maior" v={meta ? `${meta.loteMenor_m2} m² · ${meta.loteMaior_m2.toLocaleString('pt-BR')} m²` : '…'} />
              <L k="Começa em" v={meta ? `${meta.raioInicio} m` : '…'} />
              <L k="Declive aceito" v={meta ? `até ${meta.declive_max}°` : '…'} />
              <L k="Bulevar de costura" v={meta ? `${meta.bulevar_m} m` : '…'} />
            </dl>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">As camadas</p>
            <dl className="mt-2 space-y-1">
              <L k="Enclaves de família" v={meta ? String(meta.enclaves) : '…'} d />
              <L k="Carteiras em enclave" v={meta ? meta.carteirasEmEnclave.toLocaleString('pt-BR') : '…'} />
              <L k="Condomínio DSC" v={meta ? `${meta.dsc} lotes, setor ${meta.setorDSC}` : '…'} d />
            </dl>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              O DSC ocupa os lotes mais internos do seu setor ignorando a idade, que é a regra 4. É
              por isso que aquele é o único setor sem monotonia perfeita, e a quebra é a regra
              funcionando. Em ciano no mapa.
            </p>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Capacidade por setor</p>
            <ul className="mt-2 space-y-0.5">
              {porSetor.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-12 text-white/40">S{String(i + 1).padStart(2, '0')}</span>
                  <span className="h-2 bg-[#F7931A]/70" style={{ width: `${(c / Math.max(...porSetor)) * 130}px` }} />
                  <span className="tabular-nums text-white/55">{c.toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              A desigualdade é estrutural: o setor 2 é raso porque o Parque Runestone o come. É essa
              diferença de fundura que faz a mesma idade cair em raios diferentes, e é ela que impede
              o anel.
            </p>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Pintar por</p>
            <div className="mt-2 flex gap-2">
              {(['idade', 'setor', 'familia'] as const).map((v) => (
                <button key={v} onClick={() => setPinta(v)}
                  className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${pinta === v ? 'border-[#F7931A] text-[#F7931A]' : 'border-white/15 text-white/45'}`}>
                  {v}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {[1, 2, 4, 8].map((z) => (
                <button key={z} onClick={() => setZoom(z)}
                  className={`border px-2 py-1 text-[10px] tabular-nums ${zoom === z ? 'border-[#F7931A] text-[#F7931A]' : 'border-white/15 text-white/45'}`}>
                  {z}×
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function L({ k, v, d }: { k: string; v: string; d?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/45">{k}</dt>
      <dd className={`tabular-nums ${d ? 'text-[#F7931A]' : 'text-white/80'}`}>{v}</dd>
    </div>
  )
}
