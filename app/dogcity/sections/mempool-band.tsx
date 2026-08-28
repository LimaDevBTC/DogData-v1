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
// ⚠️ E NENHUMA BARRA DE ROLAGEM, que é como ela nasceu errada. A primeira versão
// punha as cinco células numa fileira com `overflow-x-auto`, e o conteúdo não
// cabia em largura NENHUMA. Medido em 2026-08-23:
//
//     390px   precisa 1063, cabe  366   transborda 697
//     768px   precisa 1443, cabe  704   transborda 739
//    1280px   precisa 1443, cabe 1216   transborda 227
//    1920px   precisa 1443, cabe 1336   transborda 107
//
// Ou seja: a primeira coisa que o visitante via na landing era uma barra de
// rolagem horizontal, inclusive num monitor grande. O fundador: "organize os
// itens para que não precisemos dela".
//
// A regra agora é por PRIORIDADE, não por rolagem: cada célula declara a partir
// de que largura ela aparece, e o que não cabe simplesmente não entra. A ordem é
// a da história que a página conta: quantas naves estão em órbita, quanto DOG
// elas carregam, quando foi o último pouso, e só depois os números de quem gosta
// de número. O `overflow-hidden` no fim é cinto de segurança, não a solução: se
// um dia um valor crescer, ele corta em vez de devolver a barra.
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

  // `at` é a partir de que largura a célula existe. Rótulo curto no celular e
  // longo no desktop pela mesma razão: o que economiza espaço é a palavra, não a
  // fonte.
  // ⚠️ NOME DE MERCADO NO DADO (fundador, 28/08). "ORBIT", "IN FLIGHT" e
  // "LANDED" eram bonitos e não diziam a ninguém que a faixa mostra a mempool:
  // o foguete é da cena, aqui é transação, bloco e taxa.
  const cells: { k: string; kLong?: string; v: string; at: string }[] = [
    { k: "UNCONF.", kLong: "UNCONFIRMED", v: s ? `${s.dog_pending} tx` : "—", at: "inline-flex" },
    { k: "PENDING", kLong: "DOG PENDING", v: s ? `${formatDog(s.dog_pending_amount)} DOG` : "—", at: "inline-flex" },
    { k: "LAST BLOCK", kLong: "LAST DOG BLOCK", v: s?.last_dog_block ? `#${s.last_dog_block} · ${minutesAgo(s.last_dog_block_time, now)}` : "—", at: "hidden md:inline-flex" },
    { k: "BTC MEMPOOL", v: s ? `${s.tx_count.toLocaleString("en-US")} tx` : "—", at: "hidden xl:inline-flex" },
  ]
  // ⚠️ A TAXA DO PRÓXIMO BLOCO SAIU DA FAIXA, e a escolha é entre ela e o convite.
  // Medido: nem na tela de 1920 cabem cinco células mais o "watch it fly", porque
  // o container trava em 1336. Entre um número que quem quer já acha na /mempool
  // e a única coisa que diz que a faixa é clicável, fica o convite.

  return (
    <div className="sticky top-0 z-40 bg-void/95 backdrop-blur border-b border-white/10">
      <Link
        href="/city"
        className="group flex items-center gap-3 md:gap-6 px-4 md:px-8 h-9 overflow-hidden whitespace-nowrap
                   font-mono text-[10px] md:text-[11px] tracking-[0.1em] md:tracking-[0.16em] text-mist hover:text-snow transition-colors"
      >
        <span className="inline-flex items-center gap-2 shrink-0 text-lava">
          <span
            aria-hidden
            className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? "bg-dusty" : "bg-emerald-400 animate-pulse"}`}
          />
          {/* no celular o nome da rede é o que menos informa: o ponto verde já
              diz que está vivo, e o espaço vale mais para um número */}
          <span className="lg:hidden">{stale ? "SYNCING" : "LIVE"}</span>
          <span className="hidden lg:inline">{stale ? "DOG MEMPOOL · SYNCING" : "DOG MEMPOOL · LIVE"}</span>
        </span>
        {cells.map((c) => (
          <span key={c.k} className={`${c.at} items-center gap-1.5 md:gap-2 shrink-0`}>
            <span className="text-dusty">
              {c.kLong ? (
                <>
                  <span className="lg:hidden">{c.k}</span>
                  <span className="hidden lg:inline">{c.kLong}</span>
                </>
              ) : (
                c.k
              )}
            </span>
            <span className="text-snow">{c.v}</span>
          </span>
        ))}
        <span className="ml-auto hidden 2xl:inline-flex items-center gap-1 shrink-0 text-lava">
          WATCH IT FLY
          <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </div>
  )
}
