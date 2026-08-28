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
  const unidade = g === "hora" ? "per hour" : "per day"

  const agora = data.agora.map((b) => ({
    rotulo: b.minutos_atras === 0 ? "now" : `-${b.minutos_atras}m`,
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

  // ⚠️ SESSÕES POR PESSOA SÓ PODE SAIR DA BASE COMPARÁVEL.
  // `sessoes` conta a população inteira da janela; `visitantes` só existe
  // dentro das sessões identificadas. Dividir um pelo outro compara duas
  // populações e devolve um número sem significado — em 28/08 isso dava 5,6
  // sessões por pessoa (717 ÷ 128) e o fundador estranhou, com razão. A razão
  // verdadeira usa o mesmo denominador dos dois lados: 198 ÷ 128 = 1,55.
  const sessoesPorPessoa =
    r.visitantes > 0 ? r.sessoes_identificadas / r.visitantes : null

  const novosPct = r.novos + r.recorrentes > 0
    ? (r.novos / (r.novos + r.recorrentes)) * 100
    : null

  return (
    <div className="space-y-12 md:space-y-16">

      {/* ── os cinco números ────────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow="AUDIENCE"
          title="What the site received, against the previous period."
          sub="A visitor is a person (anonymous persistent id); a session is a visit. Nothing below is sampled."
        />
        <Reveal delay={0.4} y={16}>
          <PlotGrid className="mt-10 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Metrica
              label="Sessions"
              valor={fmtNum(r.sessoes)}
              sub={`${fmtNum(r.pageviews)} pageviews · ${r.paginas_sessao ?? "—"} per session`}
              acento={CAT[0]}
              delta={<Delta atual={r.sessoes} anterior={a.sessoes} />}
            />
            <Metrica
              label="Visitors"
              valor={r.sessoes_identificadas === 0 ? "—" : fmtNum(r.visitantes)}
              sub={
                r.sessoes_identificadas === 0
                  ? "identity started 2026-08-27"
                  : identidadeMadura
                    ? `${sessoesPorPessoa?.toFixed(2) ?? "—"} sessions per person`
                    : `${sessoesPorPessoa?.toFixed(2) ?? "—"} sessions per person · measured on ` +
                      `${fmtNum(r.sessoes_identificadas)} of ${fmtNum(r.sessoes)} sessions (${cobIdentidade.toFixed(0)}%)`
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
              label="Avg. time on site"
              valor={fmtDuracao(r.duracao_media_s)}
              sub={
                r.sessoes_medidas === 0
                  ? "no measured session in this window yet"
                  : `median ${fmtDuracao(r.duracao_mediana_s)} · ${fmtNum(r.sessoes_medidas)} of ${fmtNum(r.sessoes)} sessions (${cobDuracao.toFixed(0)}%)`
              }
              acento={CAT[2]}
              delta={<Delta atual={r.duracao_media_s} anterior={a.duracao_media_s} sufixo="s" />}
              icone={Clock}
            />
            <Metrica
              label="Bounce rate"
              valor={fmtPct(r.taxa_rejeicao)}
              sub="left without reading or navigating"
              acento={CAT[1]}
              // Rejeição que cai é melhora: sem `inverso` o painel pintaria de
              // vermelho justamente o resultado que se quer.
              delta={<Delta atual={r.taxa_rejeicao} anterior={a.taxa_rejeicao} inverso sufixo="%" />}
            />
            <Metrica
              label="New"
              valor={novosPct == null ? "—" : fmtPct(novosPct)}
              sub={`${fmtNum(r.novos)} new · ${fmtNum(r.recorrentes)} returning`}
              acento={CAT[0]}
              icone={UserPlus}
            />
          </PlotGrid>
        </Reveal>

        {(r.sessoes_medidas < r.sessoes || r.sessoes_identificadas < r.sessoes) && (
          <p className="font-mono text-[10px] text-dusty mt-4 leading-relaxed max-w-[74ch]">
            <span className="text-mist">Nothing was lost in this window.</span> Sessions,
            pageviews, countries, sources and bounce come from the whole series, since
            2026-07-04. What started on 2026-08-27 was the <span className="text-mist">new
            instrument</span>: visitor identity, time on page and scroll depth. Earlier sessions
            were rebuilt from history — they keep pageviews, entry and exit, but have no time and
            no identity, so they stay out of those three averages instead of entering as zero.
            Coverage climbs on its own as the window moves.
            {cobIdentidade < 100 && (
              <>
                {" "}
                <span className="text-mist">Sessions and visitors do not divide into each
                other</span>{" "}while coverage is under 100%: sessions counts the whole window,
                visitors only counts inside identified sessions. The sessions-per-person ratio
                beside it already uses the same denominator on both sides.
              </>
            )}
          </p>
        )}
      </section>

      {/* ── a série ─────────────────────────────────────────────────────── */}
      <Reveal y={18}>
        <ChartFrame
          eyebrow={`Sessions, pageviews and visitors ${unidade}`}
          icon={TrendingUp}
          table={{
            head: [g === "hora" ? "Hour" : "Day", "Sessions", "Pageviews", "Visitors"],
            rows: data.serie.map((d) => [
              rotuloSerieLongo(d.inicio, g), d.sessoes, d.pageviews, d.visitantes ?? "not measured",
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
            eyebrow={`Avg. time on site ${unidade}`}
            icon={Clock}
            table={{
              head: [g === "hora" ? "Hour" : "Day", "Seconds"],
              rows: data.serie.map((d) => [rotuloSerieLongo(d.inicio, g), d.duracao_s ?? "not measured"]),
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
                  <Line type="monotone" dataKey="duracao_s" name="Time on site" stroke={CAT[2]}
                    strokeWidth={2} dot={{ r: 2.5, fill: CAT[2] }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPlot height={200}>Measurement started 2026-08-27 — waiting for full days</EmptyPlot>
            )}
          </ChartFrame>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <ChartFrame
            eyebrow={`Bounce rate ${unidade}`}
            table={{
              head: [g === "hora" ? "Hour" : "Day", "Bounce %"],
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
                <Line type="monotone" dataKey="rejeicao" name="Bounce" stroke={CAT[1]}
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
            eyebrow={`Last 30 minutes · ${fmtNum(aoVivo)} views`}
            live
            table={{ head: ["Window", "Views"], rows: agora.map((b) => [b.rotulo, b.views]) }}
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
            <PlateHead icon={Radio}>Device</PlateHead>
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
            <PlateHead icon={ShieldAlert}>Discarded traffic</PlateHead>
            {data.robos.sessoes_robo === 0 ? (
              <p className="font-mono text-[11px] text-dusty leading-relaxed">
                No session discarded in this window.
                <br />
                <span className="text-white/25">
                  Marking depends on the user-agent, only stored since 2026-08-27. Earlier
                  traffic cannot be reclassified.
                </span>
              </p>
            ) : (
              <>
                <div className="font-display font-bold text-[30px] text-snow tabular-nums leading-none">
                  {fmtNum(data.robos.sessoes_robo)}
                </div>
                <p className="font-mono text-[10px] text-dusty mt-2">
                  sessions kept out of every number on this page
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
