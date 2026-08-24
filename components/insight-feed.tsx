"use client"

// O FEED DE INSIGHTS.
//
// ⚠️ O QUE ESTA FAIXA É, E O QUE ELA NÃO É. Ela não é um painel de métricas: é
// uma banca de notícias. Cada linha é uma FRASE sobre o que os dados da casa
// viram nas últimas 24 horas, com o número que a sustenta e um link para quem
// quiser conferir na transação. Métrica você lê e esquece; frase você repete.
//
// ⚠️ E ELA PUBLICA CONTRA O PRÓPRIO INTERESSE. Decisão do fundador, 24/08/2026:
// "não existe contra próprio interesse, queremos a verdade". Saída de corretora
// aparece com o mesmo peso que entrada, e uma venda grande é notícia mesmo quando
// é ruim para o preço. É a única coisa que compra autoridade.
//
// ⚠️ DUAS APRESENTAÇÕES, UM COMPONENTE. Na home ela é CHAMADA: poucas linhas, na
// largura do banner, e o bloco inteiro leva ao feed completo. Na página de
// on-chain ela é a MATÉRIA: tudo que existe, sem link para lugar nenhum. Uma
// banca de jornal mostra a manchete na calçada e o jornal inteiro lá dentro; a
// versão anterior punha o jornal inteiro na calçada e empurrava o resto da home
// para baixo da dobra.
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Coins, Radio, Rocket, TrendingUp } from "lucide-react"

interface Insight {
  id: string
  headline: string
  value?: string
  kind: "exchange_in" | "exchange_out" | "whale" | "donation" | "mempool" | "holders"
  href?: string
  at: string
  source: string
}

// ⚠️ A COR CARREGA O SENTIDO, e ela é a mesma da praça: vermelho é dinheiro
// entrando na cidade (a cauda do foguete de doação), âmbar é o que ainda está em
// órbita, laranja é o DOG se movendo. Duas telas, um vocabulário.
const ESTILO: Record<Insight["kind"], { Icon: typeof Coins; cor: string }> = {
  exchange_in: { Icon: ArrowDownRight, cor: "text-red-400" },
  exchange_out: { Icon: ArrowUpRight, cor: "text-green-400" },
  whale: { Icon: TrendingUp, cor: "text-lava" },
  donation: { Icon: Rocket, cor: "text-red-400" },
  mempool: { Icon: Radio, cor: "text-amber" },
  holders: { Icon: Coins, cor: "text-cyan-400" },
}

/** Para onde a chamada da home leva. Um lugar só, para não haver dois.
 *
 * ⚠️ TRANSAÇÕES, E A ESCOLHA TEM MOTIVO. É ali que a manchete vira ação: quem lê
 * "a mesa mandou 90M para a Kraken" tem a lista de transações na mesma tela para
 * conferir. Notícia e prova a dois centímetros uma da outra. */
export const FEED_COMPLETO = "/transactions#feed"

export default function InsightFeed({
  /** quantas linhas desenhar. A home mostra a chamada, a página inteira mostra tudo. */
  limite,
  /** o bloco todo vira link para o feed completo */
  chamada = false,
}: { limite?: number; chamada?: boolean } = {}) {
  const [items, setItems] = useState<Insight[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    const buscar = () => {
      fetch("/api/insights", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!vivo || !d) return
          setItems(d.insights || [])
          setCarregando(false)
        })
        .catch(() => vivo && setCarregando(false))
    }
    buscar()
    // a mempool anda a cada bloco; um minuto é o passo que não deixa a frase velha
    const t = setInterval(buscar, 60_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  // ⚠️ SEM ITEM, SEM FAIXA. Um feed vazio com esqueleto piscando promete conteúdo
  // que não existe, e a página do overview já tem o que mostrar sem ele.
  if (!carregando && items.length === 0) return null

  const visiveis = limite ? items.slice(0, limite) : items
  const escondidos = items.length - visiveis.length

  const Linhas = (
    <ul className="divide-y divide-white/[0.04]">
      {(carregando ? [] : visiveis).map((i) => {
        const s = ESTILO[i.kind] ?? ESTILO.whale
        const Corpo = (
          <div className="flex items-start gap-2.5 px-3 py-2">
            <s.Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${s.cor}`} aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-snow/85">{i.headline}</p>
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-dusty/60 sm:block">
              {i.source}
            </span>
          </div>
        )
        // ⚠️ NA CHAMADA, A LINHA NÃO É LINK. O bloco inteiro já leva ao feed
        // completo; link dentro de link é âncora aninhada, que o HTML não aceita e
        // o navegador resolve do jeito dele.
        return (
          <li key={i.id}>
            {i.href && !chamada ? (
              <a href={i.href} className="block transition-colors hover:bg-white/[0.03]">
                {Corpo}
              </a>
            ) : (
              Corpo
            )}
          </li>
        )
      })}
      {carregando && (
        <li className="px-3 py-2">
          <p className="font-mono text-[11px] text-dusty/60">reading the chain…</p>
        </li>
      )}
    </ul>
  )

  // ⚠️ O TÍTULO SÓ APARECE NA CHAMADA. Na página inteira o divisor da seção já
  // escreve "What the chain did today" logo acima, e repetir a mesma frase dois
  // centímetros abaixo faz o leitor procurar a diferença entre as duas. O ponto
  // pulsando e a procedência ficam nos dois casos: eles dizem outra coisa.
  const Cabecalho = (
    <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-lava animate-pulse" aria-hidden />
      {chamada && (
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">
          What the chain did today
        </span>
      )}
      <span className="ml-auto font-mono text-[10px] text-dusty/60">from our own node</span>
    </div>
  )

  const Corpo = (
    <div className="border border-white/[0.06] bg-black/40">
      {Cabecalho}
      {Linhas}
      {chamada && escondidos > 0 && (
        <div className="flex items-center gap-1.5 border-t border-white/[0.05] px-3 py-1.5 text-dusty/60 transition-colors group-hover:text-lava">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
            {escondidos} more on-chain {escondidos === 1 ? "story" : "stories"}
          </span>
          <ArrowRight className="h-3 w-3" aria-hidden />
        </div>
      )}
    </div>
  )

  // ⚠️ SEM `px-4` PRÓPRIO. A home já embrulha tudo num container com padding, e o
  // padding a mais deixava a faixa 16px mais estreita que o banner de cada lado.
  return chamada ? (
    <section aria-label="On-chain insights">
      <Link href={FEED_COMPLETO} className="group block">
        {Corpo}
      </Link>
    </section>
  ) : (
    <section aria-label="On-chain insights">{Corpo}</section>
  )
}
