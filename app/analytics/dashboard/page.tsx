"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOG DATA — painel interno de analytics (rota não listada).
//
// Este arquivo é o maestro, não a tela: ele é dono do casco, da ÚNICA linha de
// filtro e do laço de busca. Cada aba mora no seu próprio arquivo, e a
// superfície compartilhada com a paleta validada vive em ./ui.
//
// A linha de filtro fica deliberadamente UMA e acima de tudo que ela governa.
// Filtro dentro de card deixa duas placas discordarem sobre o período que
// mostram — o jeito mais rápido de fazer um painel mentir.
//
// Rebusca nunca pisca esqueleto: o carregador aparece só na primeira pintura,
// depois o render anterior fica em opacidade reduzida pra que o layout não
// salte sob quem está lendo.
//
// UMA REQUISIÇÃO, QUATRO RELATÓRIOS. A rota chama quatro funções do banco em
// paralelo e devolve os quatro juntos. Se uma falhar ela volta `null` e a aba
// dela mostra o aviso — o painel perde uma aba, não a página.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react"
import {
  BarChart3, Coins, Compass, Megaphone, MousePointer2, RefreshCw, Users, Zap,
} from "lucide-react"
import { Reveal, Scramble } from "@/app/dogcity/motion"
import Ads from "./ads"
import Aquisicao from "./aquisicao"
import Comportamento from "./comportamento"
import Conversao from "./conversao"
import Publico from "./publico"
import Speed from "./speed"
import VisaoGeral from "./visao-geral"
import type { AdsReport, Relatorio } from "./types"
import { CAT, HAIR, HAIR_SOFT, HeroFigure, STATUS, StatusChip, fmtDuracao, fmtNum } from "./ui"

// Janelas em DIAS, com o rótulo separado do valor: 24h é `dias: 1`, e escrever
// "1d" num botão que o fundador pediu como "últimas 24h" seria fazer a pessoa
// traduzir a própria pergunta. Abaixo de 2 dias a série vem por hora (migração
// 025) — sem isso um filtro de 24h desenharia dois pontos e não mostraria o
// pico que justifica olhar 24h.
const JANELAS = [
  { dias: 1,  rotulo: "24h" },
  { dias: 7,  rotulo: "7d" },
  { dias: 14, rotulo: "14d" },
  { dias: 30, rotulo: "30d" },
  { dias: 60, rotulo: "60d" },
  { dias: 90, rotulo: "90d" },
] as const

const ABAS = [
  { key: "geral",         label: "Visão geral",   icon: BarChart3 },
  { key: "aquisicao",     label: "Aquisição",     icon: Compass },
  { key: "comportamento", label: "Comportamento", icon: MousePointer2 },
  { key: "publico",       label: "Público",       icon: Users },
  { key: "conversao",     label: "Conversão",     icon: Coins },
  { key: "velocidade",    label: "Velocidade",    icon: Zap },
  { key: "ads",           label: "Ads",           icon: Megaphone },
] as const

type AbaKey = (typeof ABAS)[number]["key"]

export default function PainelAnalytics() {
  const [dados, setDados] = useState<Relatorio | null>(null)
  const [ads, setAds] = useState<AdsReport | null>(null)
  const [dias, setDias] = useState(30)
  const [aba, setAba] = useState<AbaKey>("geral")
  const [carregando, setCarregando] = useState(true)
  const [carregandoAds, setCarregandoAds] = useState(false)
  const [ultima, setUltima] = useState<Date | null>(null)

  const buscar = useCallback((d: number) => {
    setCarregando(true)
    fetch(`/api/analytics/report?days=${d}`)
      .then((r) => r.json())
      .then((r: Relatorio) => { setDados(r); setUltima(new Date()) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const buscarAds = useCallback((d: number) => {
    setCarregandoAds(true)
    fetch(`/api/ads/report?days=${d}`)
      .then((r) => r.json())
      .then(setAds)
      .catch(() => {})
      .finally(() => setCarregandoAds(false))
  }, [])

  useEffect(() => { buscar(dias) }, [dias, buscar])
  useEffect(() => { if (aba === "ads") buscarAds(dias) }, [aba, dias, buscarAds])
  useEffect(() => {
    const t = setInterval(() => {
      buscar(dias)
      if (aba === "ads") buscarAds(dias)
    }, 60_000)
    return () => clearInterval(t)
  }, [dias, aba, buscar, buscarAds])

  if (!dados) {
    return (
      <main className="min-h-screen bg-void text-snow flex items-center justify-center px-6">
        <div className="text-center">
          <Scramble text="CARREGANDO ANALYTICS" className="font-mono text-[11px] tracking-[0.3em] text-lava" />
          <div className="mt-4 h-px w-40 mx-auto bg-white/10">
            <div className="h-full w-1/3 bg-lava animate-pulse-slow" />
          </div>
        </div>
      </main>
    )
  }

  const t = dados.trafego
  const v = dados.vitais
  const nota = v?.nota_geral ?? null
  const estadoNota = nota == null ? "warn" : nota >= 90 ? "good" : nota >= 50 ? "warn" : "poor"
  const tendencia = t ? t.serie.slice(-14).map((d) => d.sessoes) : []

  // Mesma regra da aba Visão geral, ver o comentário no herói abaixo.
  const heroIdentidadeMadura =
    !!t && t.resumo.sessoes > 0 && t.resumo.sessoes_identificadas / t.resumo.sessoes >= 0.5

  const heroi =
    aba === "velocidade" ? (
      <HeroFigure
        label="Nota de performance"
        value={nota}
        unit="/ 100"
        accent={STATUS[estadoNota]}
        badge={nota != null ? <StatusChip status={estadoNota} /> : undefined}
        sub="percentil 75 de visitas reais, ponderado entre as cinco Core Web Vitals"
      />
    ) : aba === "conversao" && dados.funil ? (
      <HeroFigure
        label="Doadores com 10k+ DOG"
        value={dados.funil.doacoes.cruzaram_10k}
        accent={CAT[0]}
        sub={`licença Personal destravada · janela de ${dados.funil.periodo.dias} dias`}
      />
    ) : aba === "ads" && ads ? (
      <HeroFigure
        label="Impressões de banner"
        value={ads.summary.impressions}
        accent={CAT[0]}
        sub={`${ads.advertiser} · janela de ${ads.period.days} dias`}
      />
    ) : t ? (
      // ⚠️ O NÚMERO DE MANCHETE TEM QUE TER O HISTÓRICO INTEIRO.
      // A primeira versão desta página destacava VISITANTES, que só existe
      // desde 27/08/2026. Numa janela de 30 dias isso são 29 dias sem dado, e
      // o painel abria anunciando "32" sobre 4.603 sessões reais — o fundador
      // leu como "nossos dados foram excluídos". Nada tinha sido: 43 mil
      // eventos e 55 dias continuavam no banco. Uma métrica recém-instrumentada
      // em posição de manchete descreve o INSTRUMENTO, não o site.
      //
      // Então a escolha é por cobertura, e se conserta sozinha: enquanto a
      // identidade não cobrir metade das sessões da janela, quem lidera é
      // SESSÃO, contínua desde 04/07. Quando cobrir, visitante assume sem
      // ninguém tocar em código.
      heroIdentidadeMadura ? (
        <HeroFigure
          label="Visitantes no período"
          value={t.resumo.visitantes}
          trend={tendencia}
          trendUnidade={t.granularidade === "hora" ? "horas" : "dias"}
          accent={CAT[0]}
          sub={`${fmtNum(t.resumo.sessoes)} sessões · ${fmtDuracao(t.resumo.duracao_media_s)} de permanência média`}
        />
      ) : (
        <HeroFigure
          label="Sessões no período"
          value={t.resumo.sessoes}
          trend={tendencia}
          trendUnidade={t.granularidade === "hora" ? "horas" : "dias"}
          accent={CAT[0]}
          sub={
            t.resumo.sessoes_identificadas === 0
              ? `${fmtNum(t.resumo.pageviews)} páginas · identificação de visitante começou em 27/08/2026`
              : `${fmtNum(t.resumo.pageviews)} páginas · ${fmtNum(t.resumo.visitantes)} visitantes identificados até agora`
          }
        />
      )
    ) : null

  return (
    <main className="min-h-screen bg-void text-snow">

      <header className={`sticky top-0 z-30 bg-void border-b ${HAIR_SOFT}`}>
        <div className="max-w-[1400px] mx-auto px-5 md:px-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pt-7 pb-5">
            <div>
              <Scramble text="DOG DATA · TELEMETRIA INTERNA"
                className="font-mono text-[10px] tracking-[0.3em] text-lava" />
              {/* NÃO é um SplitLine: as primitivas de reveal compartilhadas
                  disparam num IntersectionObserver com margem de -10% no topo,
                  e um cabeçalho sticky mora dentro dessa faixa morta — as
                  palavras nunca seriam liberadas. */}
              <h1 className="font-display font-bold text-2xl md:text-[32px] text-snow mt-2.5 leading-none">
                Site Dashboard
              </h1>
              <p className="font-mono text-[10px] text-dusty mt-2.5 tabular-nums">
                {/* Em 24h as duas pontas caem no mesmo dia ou em dias vizinhos,
                    e só a data faria o cabeçalho dizer "27/08 → 28/08" sem
                    informar nada. Janela curta mostra a hora. */}
                {t && (
                  <>
                    {new Date(t.periodo.de).toLocaleString("pt-BR",
                      dias <= 2
                        ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                        : { day: "2-digit", month: "2-digit", year: "numeric" })}
                    {" → "}
                    {new Date(t.periodo.ate).toLocaleString("pt-BR",
                      dias <= 2
                        ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                        : { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </>
                )}
                {ultima && (
                  <span className="text-white/25 ml-3">
                    · atualizado {ultima.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex border ${HAIR}`}>
                {JANELAS.map((j) => (
                  <button
                    key={j.dias}
                    onClick={() => setDias(j.dias)}
                    aria-pressed={dias === j.dias}
                    className={`px-3.5 min-h-[40px] font-mono text-[11px] tabular-nums transition-colors
                      border-r ${HAIR} last:border-r-0 ${
                      dias === j.dias
                        ? "bg-lava text-void font-bold"
                        : "text-dusty hover:text-snow hover:bg-white/[0.04]"
                    }`}
                  >
                    {j.rotulo}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { buscar(dias); if (aba === "ads") buscarAds(dias) }}
                aria-label="Atualizar agora"
                className={`grid place-items-center w-10 h-10 border ${HAIR} text-dusty
                  hover:text-snow hover:border-white/25 transition-colors`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${carregando || carregandoAds ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <nav className="flex -mb-px overflow-x-auto">
            {ABAS.map(({ key, label, icon: Icone }) => (
              <button
                key={key}
                onClick={() => setAba(key)}
                aria-current={aba === key ? "page" : undefined}
                className={`flex items-center gap-2 px-4 md:px-5 min-h-[46px] shrink-0
                  font-mono text-[11px] uppercase tracking-[0.2em] border-b-2 transition-colors ${
                  aba === key
                    ? "text-lava border-lava"
                    : "text-dusty border-transparent hover:text-mist"
                }`}
              >
                <Icone className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div
        className={`max-w-[1400px] mx-auto px-5 md:px-10 py-10 md:py-14 transition-opacity duration-300 ${
          carregando || (aba === "ads" && carregandoAds) ? "opacity-60" : "opacity-100"
        }`}
      >
        {heroi && <Reveal y={14} className="block mb-12 md:mb-16">{heroi}</Reveal>}

        {aba === "geral"         && (t ? <VisaoGeral data={t} />    : <Indisponivel o="tráfego" />)}
        {aba === "aquisicao"     && (t ? <Aquisicao data={t} />     : <Indisponivel o="tráfego" />)}
        {aba === "comportamento" && (dados.comportamento
          ? <Comportamento data={dados.comportamento} /> : <Indisponivel o="comportamento" />)}
        {aba === "publico"       && (t ? <Publico data={t} />       : <Indisponivel o="público" />)}
        {aba === "conversao"     && (dados.funil ? <Conversao data={dados.funil} /> : <Indisponivel o="conversão" />)}
        {aba === "velocidade"    && (v ? <Speed data={v} />         : <Indisponivel o="velocidade" />)}
        {aba === "ads" && (
          ads
            ? <Ads data={ads} />
            : (
              <div className="py-24 text-center">
                <Scramble text="CARREGANDO DADOS DE ADS"
                  className="font-mono text-[11px] tracking-[0.3em] text-dusty" />
              </div>
            )
        )}
      </div>

      <footer className={`border-t ${HAIR_SOFT} mt-8`}>
        <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-6 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/25">
            dogdata.xyz
          </span>
          <span className="font-mono text-[10px] text-white/25">
            auto-refresh 60s · rota não listada · esta rota não se mede
          </span>
        </div>
      </footer>
    </main>
  )
}

// Uma função do banco que falhou custa esta aba, não a página. E o aviso diz
// o que aconteceu em vez de mostrar um gráfico vazio, que seria lido como
// "não houve tráfego".
function Indisponivel({ o }: { o: string }) {
  return (
    <div className={`border ${HAIR} p-8 text-center`}>
      <p className="font-mono text-[11px] text-dusty leading-relaxed">
        O relatório de {o} não respondeu nesta consulta.
        <br />
        <span className="text-white/25">
          As outras abas seguem com dados. Tente atualizar; se persistir, o banco está sob carga.
        </span>
      </p>
    </div>
  )
}
