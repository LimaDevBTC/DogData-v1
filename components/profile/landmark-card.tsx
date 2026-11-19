"use client"

// AS CASAS SOB MEDIDA DA CARTEIRA NO PERFIL (fundador, 19/11/2026, pergunta do @pips). A peça própria que a carteira tem na
// cidade (PIPS HOUSE, J.DOG ESTATE, a arena): não é escritura no Bitcoin, é da carteira no jogo. Só aparece quando existe.
// Copy 100% em inglês, sem travessão.
import { useEffect, useState } from "react"
import { ArrowUpRight, Landmark as LandmarkIcon } from "lucide-react"
import { PlateHead } from "@/components/plot/kit"

interface Landmark { id: string; name: string; url: string }

export function LandmarkCard({ address }: { address: string }) {
  const [items, setItems] = useState<Landmark[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/dogcity/landmarks?address=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { landmarks?: Landmark[] } | null) => { if (alive) setItems(Array.isArray(j?.landmarks) ? j!.landmarks! : []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [address])

  if (!items?.length) return null
  return (
    <div className="space-y-4 border border-white/10 bg-void p-5 md:p-6">
      <PlateHead icon={LandmarkIcon} right={<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">in the game</span>}>
        {items.length === 1 ? "your landmark" : "your landmarks"}
      </PlateHead>
      <div className="space-y-4">
        <p className="text-sm text-dusty leading-relaxed">
          Built in DogCity for this wallet. A landmark is not a deed on Bitcoin: it belongs to your wallet in the game,
          and its vehicles are for you only.
        </p>
        <ul className="space-y-3">
          {items.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <span className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.16em] text-white">
                <LandmarkIcon className="w-4 h-4 text-lava" /> {l.name}
              </span>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-lava/50 bg-lava/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.16] transition-colors"
              >
                Visit in game <ArrowUpRight className="w-3 h-3" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
