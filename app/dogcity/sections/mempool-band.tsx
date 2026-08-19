"use client"

// A FAIXA VIVA DO TOPO (praca-ajustes.md item 6: "live mempool no topo da
// página"). Uma tira fina, grudada no alto da landing, com o que o nosso nó vê
// da mempool do DOG agora: quantas transações estão em órbita, quanto DOG elas
// carregam, o último pouso e a taxa do bloco seguinte. Clicar leva à praça, que
// é onde esses mesmos números viram naves.
//
// Por que uma faixa e não um card: a promessa da página é "isto está vivo". Uma
// tira presa no topo diz isso em todo scroll, sem tomar uma tela inteira.
//
// Nada de Reveal/IntersectionObserver aqui: a faixa nasce acima da dobra e os
// reveals deste projeto têm zona morta no topo (motion.tsx) — o conteúdo ficaria
// invisível justamente onde ele mais importa.
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { useMempoolFeed, minutesAgo, MEMPOOL_STALE_S } from "../use-mempool"
import { formatDog } from "../dogcity-data"

export default function MempoolBand() {
  const { feed, now } = useMempoolFeed()
  const s = feed?.snapshot ?? null
  const stale = !s || (feed?.stale_seconds ?? Infinity) > MEMPOOL_STALE_S

  const cells: { k: string; v: string }[] = [
    { k: "IN ORBIT", v: s ? `${s.dog_pending} tx` : "—" },
    { k: "IN FLIGHT", v: s ? `${formatDog(s.dog_pending_amount)} DOG` : "—" },
    { k: "LAST LANDING", v: s?.last_dog_block ? `#${s.last_dog_block} · ${minutesAgo(s.last_dog_block_time, now)}` : "—" },
    { k: "MEMPOOL", v: s ? `${s.tx_count.toLocaleString("en-US")} tx` : "—" },
    { k: "NEXT BLOCK", v: s?.fee_fast ? `${Math.round(s.fee_fast)} sat/vB` : "—" },
  ]

  return (
    <div className="sticky top-0 z-40 bg-void/95 backdrop-blur border-b border-white/10">
      <Link
        href="/city"
        className="group flex items-center gap-4 md:gap-7 px-4 md:px-8 h-9 overflow-x-auto whitespace-nowrap
                   font-mono text-[10px] md:text-[11px] tracking-[0.18em] text-mist hover:text-snow transition-colors"
      >
        <span className="inline-flex items-center gap-2 shrink-0 text-lava">
          <span
            aria-hidden
            className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? "bg-dusty" : "bg-emerald-400 animate-pulse"}`}
          />
          {stale ? "DOG MEMPOOL · SYNCING" : "DOG MEMPOOL · LIVE"}
        </span>
        {cells.map((c) => (
          <span key={c.k} className="inline-flex items-center gap-2 shrink-0">
            <span className="text-dusty">{c.k}</span>
            <span className="text-snow">{c.v}</span>
          </span>
        ))}
        <span className="ml-auto hidden md:inline-flex items-center gap-1 shrink-0 text-lava">
          WATCH IT FLY
          <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </div>
  )
}
