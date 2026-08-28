'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PRANCHA 2 DA FUNDAÇÃO: A FORMA.
//
// O fundador travou duas regras que brigam entre si:
//   "mais antigo, mais perto da praça central"   e   "não pode virar anel".
// Um gradiente radial puro produz anel. Um setor por coorte produz raio. As
// duas coisas que ele proibiu são exatamente as duas saídas óbvias.
//
// A saída não óbvia é a filotaxia de ângulo áureo, 137,50776°, que é como o
// girassol empacota semente, como a pinha se fecha e como a concha cresce. A
// semente k vai para o ângulo k × 137,50776° e para o raio √(R₀² + k·a/π).
// A idade vira distância com precisão, e mesmo assim NUNCA fecha um anel nem
// alinha um raio, porque o ângulo áureo é o número mais irracional que existe:
// nenhuma fração o aproxima bem, então nenhum padrão periódico se forma.
//
// Ou seja: o pedido estético do fundador (Fibonacci, concha, fractal) e a
// restrição de engenharia que ele mesmo impôs são a MESMA coisa. Esta prancha
// existe para ele olhar e confirmar.
//
// Os dados são reais: 52.999 carteiras com 20k DOG ou mais, ordenadas pela
// idade do UTXO mais antigo, plantadas sobre o relevo da NASA com rejeição de
// tudo que é praça, parque, spaceport, cratera ou declive acima de 3°.
// Gerado por scripts/gerar_forma_filotaxia.py.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

interface Meta {
  anguloAureoGraus: number
  lobos?: number
  amplitude?: number
  colocados: number
  rejeitadas: number
  raioInterno: number
  raioFinal: number
  declive_max: number
  coortes: number
  idadeMaisVelha: number
  idadeMaisNova: number
  areaBrutaPorCarteira_m2: number
  areaDisponivel_km2: number
  areaNecessaria_km2: number
}

// as oito coortes, do UTXO mais velho (centro, brasa) ao mais novo (borda, fria)
const CORES = [
  '#FFE9C4', '#FFC97A', '#F7931A', '#E8660D',
  '#C24A12', '#8E3A1B', '#5C2D1E', '#3A2320',
]

const R_SITIO = 3500
const PARQUE = { rumo: 43, dist: 5200, disco: 3600 }

export default function FormaClient() {
  const cv = useRef<HTMLCanvasElement>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [pontos, setPontos] = useState<{ n: number; x: Int16Array; z: Int16Array; c: Uint8Array } | null>(null)
  const [lente, setLente] = useState<'coorte' | 'densidade'>('coorte')
  const [zoom, setZoom] = useState(1)
  // ⚠️ AS VARIANTES SÃO A DECISÃO EM ABERTO. Sem lobos o empacotamento é perfeito
  // mas a IDADE forma coroas limpas, e como prédio comum tem padrão por bairro a
  // cidade subiria anelada. Com lobos a mesma idade cai a distâncias diferentes
  // conforme o rumo, e a coroa vira pétala. 5 e 8 são de Fibonacci.
  const [forma, setForma] = useState<'' | '-5lobos' | '-8lobos'>('-5lobos')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [m, b] = await Promise.all([
        fetch(`/city/forma-filotaxia${forma}.json`).then((r) => r.json()),
        fetch(`/city/forma-filotaxia${forma}.bin`).then((r) => r.arrayBuffer()),
      ])
      if (!vivo) return
      const dv = new DataView(b)
      const n = Math.floor(b.byteLength / 5)
      const x = new Int16Array(n), z = new Int16Array(n), c = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        x[i] = dv.getInt16(i * 5, true)
        z[i] = dv.getInt16(i * 5 + 2, true)
        c[i] = dv.getUint8(i * 5 + 4)
      }
      setMeta(m)
      setPontos({ n, x, z, c })
    })().catch(() => {})
    return () => { vivo = false }
  }, [forma])

  useEffect(() => {
    const canvas = cv.current
    if (!canvas || !pontos) return
    const L = Math.min(1100, Math.floor(window.innerWidth * 0.62))
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

    // a borda do sítio
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1
    g.beginPath(); g.arc(L / 2, L / 2, R_SITIO * esc, 0, Math.PI * 2); g.stroke()

    // o parque, que é o grande vazio a nordeste
    const prad = (PARQUE.rumo * Math.PI) / 180
    const pcx = Math.sin(prad) * PARQUE.dist, pcz = -Math.cos(prad) * PARQUE.dist
    g.fillStyle = 'rgba(46,90,58,0.28)'
    g.beginPath(); g.arc(px(pcx), py(pcz), PARQUE.disco * esc, 0, Math.PI * 2); g.fill()

    // a praça: o furo central de onde a espiral nasce
    g.fillStyle = 'rgba(255,255,255,0.055)'
    g.beginPath(); g.arc(L / 2, L / 2, (meta?.raioInterno ?? 960) * esc, 0, Math.PI * 2); g.fill()

    // as sementes
    const raio = Math.max(0.5, 1.15 * esc * 9)
    for (let i = 0; i < pontos.n; i++) {
      const X = px(pontos.x[i]), Y = py(pontos.z[i])
      if (X < -4 || Y < -4 || X > L + 4 || Y > L + 4) continue
      g.fillStyle = lente === 'coorte'
        ? CORES[pontos.c[i]]
        : `hsl(28 90% ${38 + (pontos.c[i] / 7) * 26}%)`
      g.beginPath(); g.arc(X, Y, raio, 0, Math.PI * 2); g.fill()
    }

    // o eixo do Dog Social Club, rumo 69°
    const drad = (68.7 * Math.PI) / 180
    g.strokeStyle = 'rgba(247,147,26,0.55)'; g.lineWidth = 1.5; g.setLineDash([5, 5])
    g.beginPath(); g.moveTo(L / 2, L / 2)
    g.lineTo(px(Math.sin(drad) * R_SITIO), py(-Math.cos(drad) * R_SITIO)); g.stroke()
    g.setLineDash([])
  }, [pontos, meta, lente, zoom])

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-5 py-6 text-white/80">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#F7931A]">
        DogCity · fundação · prancha 2
      </p>
      <h1 className="mt-1 text-3xl font-medium tracking-tight text-white">A forma</h1>
      <p className="mt-2 max-w-[64ch] font-mono text-[11px] leading-relaxed text-white/45">
        52.999 carteiras com 20.000 DOG ou mais, ordenadas pela idade do UTXO mais antigo e plantadas no
        ângulo áureo de 137,50776°. É o empacotamento do girassol e da concha. A idade vira distância da
        praça com precisão, e mesmo assim nenhum anel se fecha e nenhum raio se alinha.
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <canvas ref={cv} className="border border-white/10" />

        <aside className="w-[21rem] space-y-4 font-mono text-[11px]">
          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">A espiral</p>
            <dl className="mt-2 space-y-1">
              <Linha k="Ângulo" v={meta ? `${meta.anguloAureoGraus.toFixed(5)}°` : '…'} />
              <Linha k="Carteiras plantadas" v={meta ? meta.colocados.toLocaleString('pt-BR') : '…'} destaque />
              <Linha k="Posições rejeitadas" v={meta ? meta.rejeitadas.toLocaleString('pt-BR') : '…'} />
              <Linha k="Nasce em" v={meta ? `${meta.raioInterno} m` : '…'} />
              <Linha k="Fecha em" v={meta ? `${meta.raioFinal} m` : '…'} destaque />
              <Linha k="Sítio de hoje" v={`${R_SITIO} m`} />
            </dl>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              A cidade inteira cabe dentro do sítio que já existe, com {meta ? R_SITIO - meta.raioFinal : '…'} m
              de sobra no anel externo.
            </p>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">O orçamento</p>
            <dl className="mt-2 space-y-1">
              <Linha k="Bruto por carteira" v={meta ? `${meta.areaBrutaPorCarteira_m2} m²` : '…'} />
              <Linha k="Terra disponível" v={meta ? `${meta.areaDisponivel_km2} km²` : '…'} />
              <Linha k="Terra necessária" v={meta ? `${meta.areaNecessaria_km2} km²` : '…'} destaque />
              <Linha k="Declive aceito" v={meta ? `até ${meta.declive_max}°` : '…'} />
            </dl>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Idade do UTXO</p>
            <div className="mt-2 flex h-3 overflow-hidden">
              {CORES.map((c) => <div key={c} className="flex-1" style={{ background: c }} />)}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-white/40">
              <span>{meta ? `${Math.round(meta.idadeMaisVelha)} dias` : '…'}</span>
              <span>centro</span>
              <span>borda</span>
              <span>{meta ? `${meta.idadeMaisNova} dia` : '…'}</span>
            </div>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">A forma</p>
            <div className="mt-2 flex gap-2">
              {([['', 'espiral'], ['-5lobos', '5 pétalas'], ['-8lobos', '8 pétalas']] as const).map(([v, r]) => (
                <button
                  key={v}
                  onClick={() => setForma(v as '' | '-5lobos' | '-8lobos')}
                  className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                    forma === v ? 'border-[#F7931A] text-[#F7931A]' : 'border-white/15 text-white/45'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Na espiral pura o empacotamento não faz anel, mas a idade faz: cada coorte vira uma coroa
              limpa, e como prédio comum tem padrão por bairro a cidade subiria anelada. As pétalas
              quebram isso: a mesma idade cai a distâncias diferentes conforme o rumo. 5 e 8 são de
              Fibonacci.
            </p>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Lentes</p>
            <div className="mt-2 flex gap-2">
              {(['coorte', 'densidade'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLente(l)}
                  className={`border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                    lente === l ? 'border-[#F7931A] text-[#F7931A]' : 'border-white/15 text-white/45'
                  }`}
                >
                  {l}
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
              Aproxime até 8× e procure um anel ou um raio. Não existe: é essa a propriedade do ângulo
              áureo, e é ela que satisfaz a regra do fundador.
            </p>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] leading-relaxed text-white/35">
              O verde a nordeste é o Parque Runestone, disco real de 3.600 m. O tracejado laranja é o eixo
              do Dog Social Club, rumo 68,7°, alinhado com a galeria que já existe dentro da praça.
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
