"use client"

// ═══════════════════════════════════════════════════════════════════════════
// VISÃO GERAL — os números que sustentam decisão, com base de comparação.
//
// Três regras que governam esta aba:
//
// 1. TODO número de topo vem com a janela anterior de igual tamanho ao lado.
//    "4.569 sessões" não diz se o mês foi bom; "4.569, +145% contra os 30 dias
//    anteriores" diz. Sem base de comparação um painel é um relógio: informa,
//    não orienta.
//
// 2. NÃO MEDIDO ≠ ZERO. Sessão reconstruída do histórico (antes de 27/08) tem
//    engaged_ms NULL, e toda média de permanência filtra essas fora. O painel
//    escreve sobre quantas sessões a média foi tirada em vez de deixar o
//    fundador achar que 6.432 sessões sustentam um número que veio de 40.
//
// 3. O QUE FOI BARRADO APARECE. Robô descartado é mostrado com o motivo, não
//    varrido pra debaixo do tapete: foi olhando tráfego não-filtrado que a
//    Áustria passou agosto inteiro como terceiro país do site.
// ═══════════════════════════════════════════════════════════════════════════

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Clock, Radio, ShieldAlert, TrendingUp, UserPlus, Users } from "lucide-react"
import { Reveal } from "@/app/dogcity/motion"
import type { Trafego } from "./types"
import {
  AXIS_TICK, CAT, ChartFrame, ChartTooltip, Delta, EmptyPlot, GRID, HAIR, HAIR_SOFT,
  Plate, PlateHead, PlotGrid, SectionHead, ShareBar, fmtDuracao, fmtNum, fmtPct,
  rotuloSerie, rotuloSerieLongo,
} from "./ui"

export default function VisaoGeral({ data }: { data: Trafego }) {
  const { resumo: r, anterior: a } = data

  const g = data.granularidade
  const serie = data.serie.map((d) => ({
    ...d,
    rotulo: rotuloSerie(d.inicio, g),
    Sessoes: d.sessoes,
    Visitantes: d.visitantes,
    Pageviews: d.pageviews,
  }))
  // Numa janela de 24h o eixo tem 25 baldes; deixar todo rótulo caber viraria
  // uma parede de texto. O minTickGap resolve no desktop, mas o passo do eixo
  // precisa ser mais folgado na hora do que no dia.
  const intervaloEixo = g === "hora" ? 3 : "preserveStartEnd"
  const unidade = g === "hora" ? "por hora" : "por dia"

  const agora = data.agora.map((b) => ({
    rotulo: b.minutos_atras === 0 ? "agora" : `-${b.minutos_atras}m`,
    views: b.views,
  }))
  const aoVivo = data.agora.reduce((s, b) => s + b.views, 0)

  const dispositivos = Object.entries(data.dispositivos)
    .map(([nome, valor], i) => ({
      label: nome.charAt(0).toUpperCase() + nome.slice(1),
      value: valor,
      color: CAT[Math.min(2, i)],
    }))
    .sort((x, y) => y.value - x.value)
  const totalDisp = dispositivos.reduce((s, d) => s + d.value, 0) || 1

  // Cobertura das duas medições que começaram em 27/08. Enquanto a janela ainda
  // pega os dias reconstruídos, esses números são baixos e PRECISAM estar
  // visíveis junto da métrica — senão o painel apresenta como fato do mês o que
  // veio de um punhado de sessões.
  //
  // ⚠️ Foi exatamente isso que deu errado na primeira versão desta aba: o
  // número de destaque era VISITANTES, que só existe desde 27/08, e o fundador
  // leu "32 visitas" como "nossos dados foram excluídos". Nada tinha sido
  // excluído — 43 mil eventos e 55 dias continuavam lá. Uma métrica nova em
  // posição de manchete descreve o instrumento, não o site.
  const cobDuracao = r.sessoes > 0 ? (r.sessoes_medidas / r.sessoes) * 100 : 0
  const cobIdentidade = r.sessoes > 0 ? (r.sessoes_identificadas / r.sessoes) * 100 : 0

  // O painel decide sozinho o que é honesto destacar, e se conserta sozinho
  // conforme a janela anda: enquanto a identidade cobrir menos de metade das
  // sessões, quem lidera é SESSÃO, que tem histórico completo desde 04/07.
  const identidadeMadura = cobIdentidade >= 50

  const novosPct = r.novos + r.recorrentes > 0
    ? (r.novos / (r.novos + r.recorrentes)) * 100
    : null

  return (
    <div className="space-y-12 md:space-y-16">

      {/* ── os cinco números ────────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow="AUDIÊNCIA"
          title="O que o site recebeu, contra o período anterior."
          sub="Visitante é pessoa (identificador anônimo persistente); sessão é visita; nenhuma métrica abaixo é amostrada."
        />
        <Reveal delay={0.4} y={16}>
          <PlotGrid className="mt-10 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Metrica
              label="Sessões"
              valor={fmtNum(r.sessoes)}
              sub={`${fmtNum(r.pageviews)} páginas · ${r.paginas_sessao ?? "—"} por sessão`}
              acento={CAT[0]}
              delta={<Delta atual={r.sessoes} anterior={a.sessoes} />}
            />
            <Metrica
              label="Visitantes"
              valor={r.sessoes_identificadas === 0 ? "—" : fmtNum(r.visitantes)}
              sub={
                r.sessoes_identificadas === 0
                  ? "identificação começou em 27/08/2026"
                  : identidadeMadura
                    ? "pessoas distintas"
                    : `pessoas distintas em ${fmtNum(r.sessoes_identificadas)} de ${fmtNum(r.sessoes)} sessões (${cobIdentidade.toFixed(0)}%)`
              }
              acento={CAT[1]}
              // Sem base comparável no período anterior o Delta já se cala
              // sozinho; forçar uma variação aqui compararia duas eras de
              // instrumento diferentes e inventaria uma queda que não houve.
              delta={
                a.sessoes_identificadas > 0
                  ? <Delta atual={r.visitantes} anterior={a.visitantes} />
                  : undefined
              }
              icone={Users}
            />
            <Metrica
              label="Permanência média"
              valor={fmtDuracao(r.duracao_media_s)}
              sub={
                r.sessoes_medidas === 0
                  ? "ainda sem sessão medida na janela"
                  : `mediana ${fmtDuracao(r.duracao_mediana_s)} · ${fmtNum(r.sessoes_medidas)} de ${fmtNum(r.sessoes)} sessões (${cobDuracao.toFixed(0)}%)`
              }
              acento={CAT[2]}
              delta={<Delta atual={r.duracao_media_s} anterior={a.duracao_media_s} sufixo="s" />}
              icone={Clock}
            />
            <Metrica
              label="Taxa de rejeição"
              valor={fmtPct(r.taxa_rejeicao)}
              sub="saiu sem ler nem navegar"
              acento={CAT[1]}
              // Rejeição que cai é melhora: sem `inverso` o painel pintaria de
              // vermelho justamente o resultado que se quer.
              delta={<Delta atual={r.taxa_rejeicao} anterior={a.taxa_rejeicao} inverso sufixo="%" />}
            />
            <Metrica
              label="Novos"
              valor={novosPct == null ? "—" : fmtPct(novosPct)}
              sub={`${fmtNum(r.novos)} novos · ${fmtNum(r.recorrentes)} recorrentes`}
              acento={CAT[0]}
              icone={UserPlus}
            />
          </PlotGrid>
        </Reveal>

        {(r.sessoes_medidas < r.sessoes || r.sessoes_identificadas < r.sessoes) && (
          <p className="font-mono text-[10px] text-dusty mt-4 leading-relaxed max-w-[74ch]">
            <span className="text-mist">Nada foi perdido nesta janela.</span> Sessões, páginas,
            países, origens e rejeição vêm da série inteira, desde 04/07/2026. O que começou em
            27/08 foi o <span className="text-mist">instrumento novo</span>: identidade de
            visitante, permanência e rolagem. Sessões anteriores foram reconstruídas do
            histórico — mantêm páginas, entrada e saída, mas não têm tempo nem identidade, e por
            isso ficam de fora dessas três médias em vez de entrarem como zero. A cobertura sobe
            sozinha conforme a janela anda.
          </p>
        )}
      </section>

      {/* ── a série ─────────────────────────────────────────────────────── */}
      <Reveal y={18}>
        <ChartFrame
          eyebrow={`Sessões, páginas e visitantes ${unidade}`}
          icon={TrendingUp}
          table={{
            head: [g === "hora" ? "Hora" : "Dia", "Sessões", "Páginas", "Visitantes"],
            rows: data.serie.map((d) => [
              rotuloSerieLongo(d.inicio, g), d.sessoes, d.pageviews, d.visitantes ?? "não medido",
            ]),
          }}
        >
          {serie.length > 1 ? (
            <ResponsiveContainer width="100%" height={266}>
              <AreaChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="an-pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CAT[0]} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={CAT[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="rotulo" tick={AXIS_TICK} axisLine={false} tickLine={false}
                  minTickGap={24} interval={intervaloEixo} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff25", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="Pageviews" stroke={CAT[0]} strokeWidth={2}
                  fill="url(#an-pv)" dot={false}
                  activeDot={{ r: 4, fill: CAT[0], stroke: "#050505", strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Sessoes" stroke={CAT[1]} strokeWidth={2}
                  fill="transparent" dot={false}
                  activeDot={{ r: 4, fill: CAT[1], stroke: "#050505", strokeWidth: 2 }} />
                {/* ⚠️ connectNulls FALSO e obrigatório aqui. Dia sem identidade
                    devolve null (migração 024), e ligar os pontos por cima
                    desenharia uma linha de visitantes atravessando 54 dias que
                    ninguém mediu. Antes da 024 esses dias vinham como 0, e a
                    curva rastejava no eixo por baixo de um volume de sessões
                    saudável — foi assim que o painel passou a impressão de que
                    os dados tinham sido apagados. */}
                <Area type="monotone" dataKey="Visitantes" stroke={CAT[2]} strokeWidth={2}
                  fill="transparent" dot={false} connectNulls={false}
                  activeDot={{ r: 4, fill: CAT[2], stroke: "#050505", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPlot height={266} />
          )}
        </ChartFrame>
      </Reveal>

      {/* ── permanência e rejeição por dia ──────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <ChartFrame
            eyebrow={`Permanência média ${unidade}`}
            icon={Clock}
            table={{
              head: [g === "hora" ? "Hora" : "Dia", "Segundos"],
              rows: data.serie.map((d) => [rotuloSerieLongo(d.inicio, g), d.duracao_s ?? "não medido"]),
            }}
          >
            {/* connectNulls fica FALSO: os dias sem medição têm que aparecer
                como buraco. Ligar os pontos por cima deles desenharia uma
                linha contínua sobre um período que ninguém mediu. */}
            {serie.some((d) => d.duracao_s != null) ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="rotulo" tick={AXIS_TICK} axisLine={false} tickLine={false}
                  minTickGap={24} interval={intervaloEixo} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v: number) => fmtDuracao(v)} />
                  <Tooltip content={<ChartTooltip unit="s" />} cursor={{ stroke: "#ffffff25" }} />
                  <Line type="monotone" dataKey="duracao_s" name="Permanência" stroke={CAT[2]}
                    strokeWidth={2} dot={{ r: 2.5, fill: CAT[2] }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPlot height={200}>Medição começou em 27/08 — aguardando dias completos</EmptyPlot>
            )}
          </ChartFrame>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <ChartFrame
            eyebrow={`Taxa de rejeição ${unidade}`}
            table={{
              head: [g === "hora" ? "Hora" : "Dia", "Rejeição %"],
              rows: data.serie.map((d) => [rotuloSerieLongo(d.inicio, g), d.rejeicao ?? "—"]),
            }}
          >
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="rotulo" tick={AXIS_TICK} axisLine={false} tickLine={false}
                  minTickGap={24} interval={intervaloEixo} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: "#ffffff25" }} />
                <Line type="monotone" dataKey="rejeicao" name="Rejeição" stroke={CAT[1]}
                  strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Reveal>
      </div>

      {/* ── agora, dispositivo, robôs ───────────────────────────────────── */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Reveal y={18}>
          <ChartFrame
            eyebrow={`Últimos 30 minutos · ${fmtNum(aoVivo)} views`}
            live
            table={{ head: ["Janela", "Views"], rows: agora.map((b) => [b.rotulo, b.views]) }}
          >
            <ResponsiveContainer width="100%" height={172}>
              <BarChart data={agora} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="rotulo" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="views" name="Views" fill={CAT[0]} maxBarSize={24} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={Radio}>Dispositivo</PlateHead>
            <ShareBar parts={dispositivos} total={totalDisp} />
            <ul className="mt-5 space-y-3">
              {dispositivos.map((d) => (
                <li key={d.label} className={`flex items-center gap-2.5 pb-3 border-b ${HAIR_SOFT} last:border-0 last:pb-0`}>
                  <span className="w-2 h-2 shrink-0" style={{ background: d.color }} />
                  <span className="font-mono text-[11px] text-mist">{d.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-snow tabular-nums">
                    {fmtNum(d.value)}
                    <span className="text-dusty ml-1.5">{Math.round((d.value / totalDisp) * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.16}>
          <Plate className="h-full">
            <PlateHead icon={ShieldAlert}>Tráfego descartado</PlateHead>
            {data.robos.sessoes_robo === 0 ? (
              <p className="font-mono text-[11px] text-dusty leading-relaxed">
                Nenhuma sessão marcada como robô nesta janela.
                <br />
                <span className="text-white/25">
                  A marcação depende do user-agent, que só passou a ser gravado em 27/08/2026.
                  Tráfego anterior não pode ser reclassificado.
                </span>
              </p>
            ) : (
              <>
                <div className="font-display font-bold text-[30px] text-snow tabular-nums leading-none">
                  {fmtNum(data.robos.sessoes_robo)}
                </div>
                <p className="font-mono text-[10px] text-dusty mt-2">
                  sessões fora de toda conta desta página
                </p>
                <ul className={`mt-5 space-y-2.5 border-t ${HAIR_SOFT} pt-4`}>
                  {Object.entries(data.robos.por_motivo)
                    .sort(([, x], [, y]) => y - x)
                    .map(([motivo, n]) => (
                      <li key={motivo} className="flex justify-between gap-3">
                        <span className="font-mono text-[11px] text-mist">{motivo}</span>
                        <span className="font-mono text-[11px] text-snow tabular-nums">{fmtNum(n)}</span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Plate>
        </Reveal>
      </div>
    </div>
  )
}

// Bloco de métrica com variação. Não usa StatTile porque o valor aqui já vem
// formatado como texto (duração, porcentagem) — o Counter do StatTile só
// interpola número, e animar "2m 14s" exigiria devolver a string pra número
// e de volta, o que é onde arredondamento vira mentira.
function Metrica({
  label, valor, sub, acento, delta, icone: Icone,
}: {
  label: string
  valor: string
  sub?: string
  acento: string
  delta?: React.ReactNode
  icone?: React.ElementType
}) {
  return (
    <div className="relative bg-void p-5 min-h-[132px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty flex items-center gap-1.5">
          {Icone && <Icone className="w-3 h-3" />}
          {label}
        </span>
        <span className="w-1.5 h-1.5 shrink-0 mt-1" style={{ background: acento }} />
      </div>
      <div className="mt-4">
        <div className="font-display font-bold text-[28px] leading-none text-snow tabular-nums">
          {valor}
        </div>
        <div className="mt-2 min-h-[30px]">
          {delta}
          {sub && (
            <div className="font-mono text-[10px] text-dusty leading-relaxed mt-0.5">{sub}</div>
          )}
        </div>
      </div>
    </div>
  )
}
