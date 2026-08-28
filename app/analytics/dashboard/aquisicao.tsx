"use client"

// ═══════════════════════════════════════════════════════════════════════════
// AQUISIÇÃO — de onde vem, e o que cada origem vale.
//
// A aba antiga tinha "Fontes de tráfego": uma lista de hostnames ordenada por
// volume. Volume sozinho não decide nada — um canal que traz 1.100 sessões com
// 42% de engajamento e outro que traz 58 com 86% pedem ações opostas, e na
// lista ordenada por volume o segundo aparecia no rodapé como irrelevante.
//
// Por isso toda linha aqui carrega volume E qualidade lado a lado. E o canal é
// a unidade de cima, não o hostname: 'x.com' e 't.co' são o mesmo canal visto
// por dois domínios, e separá-los picota o número que decide onde investir.
// ═══════════════════════════════════════════════════════════════════════════

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { EyeOff, Link2, Megaphone, Radar } from "lucide-react"
import { Reveal } from "@/app/dogcity/motion"
import type { LinhaDireto, Trafego } from "./types"
import {
  AXIS_TICK, CAT, ChartFrame, ChartTooltip, EmptyPlot, GRID, HAIR,
  Plate, PlateHead, RankRows, SectionHead, STATUS, Tabela, fmtDuracao, fmtNum, fmtPct,
} from "./ui"

// Ordem fixa e nomeada. Canal é categoria nominal com significado estável, e
// deixar a cor seguir o ranking faria o mesmo canal trocar de cor entre duas
// janelas — o jeito mais rápido de tornar um painel ilegível na comparação.
const COR_CANAL: Record<string, string> = {
  Direto: CAT[0],
  Social: CAT[1],
  Busca: CAT[2],
  IA: CAT[1],
  Campanha: CAT[2],
  Pago: CAT[2],
  Referencia: CAT[0],
}

export default function Aquisicao({ data, direto }: { data: Trafego; direto: LinhaDireto[] | null }) {
  const canais = data.canais
  const totalSessoes = canais.reduce((s, c) => s + c.sessoes, 0) || 1

  // A ordenação do gráfico é por volume, mas o eixo de cor não é: cada canal
  // mantém o hue que lhe pertence.
  const barras = canais.map((c) => ({
    canal: c.canal,
    Sessoes: c.sessoes,
    cor: COR_CANAL[c.canal] ?? CAT[0],
  }))

  const semBusca = (canais.find((c) => c.canal === "Busca")?.sessoes ?? 0) / totalSessoes < 0.05

  return (
    <div className="space-y-12 md:space-y-16">

      <section>
        <SectionHead
          eyebrow="AQUISIÇÃO"
          title="De onde vem o tráfego, e o que cada origem entrega."
          sub="Canal é a unidade: x.com e t.co são a mesma origem vista por dois domínios. Engajamento é a fração de sessões que leram ou navegaram."
        />

        <Reveal delay={0.4} y={16}>
          <div className={`mt-10 border ${HAIR}`}>
            <Tabela
              cabecalho={["Canal", "Sessões", "Share", "Visitantes", "Engajamento", "Permanência"]}
              alinhar={["l", "r", "r", "r", "r", "r"]}
              linhas={canais.map((c) => [
                <span key="c" className="flex items-center gap-2">
                  <span className="w-2 h-2 shrink-0" style={{ background: COR_CANAL[c.canal] ?? CAT[0] }} />
                  <span className="text-snow">{c.canal}</span>
                </span>,
                fmtNum(c.sessoes),
                fmtPct((c.sessoes / totalSessoes) * 100),
                c.visitantes == null ? <span key="v" className="text-white/25">—</span> : fmtNum(c.visitantes),
                fmtPct(c.engajamento),
                fmtDuracao(c.duracao_s),
              ])}
            />
          </div>
        </Reveal>

        {semBusca && (
          <p className="font-mono text-[10px] text-dusty mt-4 leading-relaxed max-w-[70ch]">
            Busca orgânica está abaixo de 5% do tráfego. Para um site cujo produto é dado
            público sobre uma rune, isso é um canal inteiro fora de operação — não uma
            flutuação do período.
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <ChartFrame
            eyebrow="Sessões por canal"
            icon={Radar}
            table={{ head: ["Canal", "Sessões"], rows: canais.map((c) => [c.canal, c.sessoes]) }}
          >
            {barras.length ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={barras} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="canal" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                  <Bar dataKey="Sessoes" maxBarSize={54} radius={[4, 4, 0, 0]}>
                    {barras.map((b) => <Cell key={b.canal} fill={b.cor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPlot height={230} />
            )}
          </ChartFrame>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={Link2}>Origens (domínio de saída)</PlateHead>
            <RankRows
              rows={data.origens.slice(0, 10).map((o) => ({
                label: o.origem,
                value: o.sessoes,
                hint: o.engajamento != null ? `${o.engajamento}% eng.` : undefined,
              }))}
            />
          </Plate>
        </Reveal>
      </div>

      {/* ── o que tem dentro do "Direto" ────────────────────────────────── */}
      {/* "Direto" e o maior canal do site e era uma linha sem nada dentro. Ele
          quase nunca significa "digitou o endereco": significa "o navegador nao
          disse de onde veio". Link com rel="noreferrer", app nativo, cliente de
          email, QR code — tudo cai aqui.

          Esta placa NAO atribui origem. Ela mostra a forma: por qual pagina
          essa gente entra. Uma fonte externa manda para pagina profunda e
          especifica; quem digita o dominio cai na raiz. A leitura fica com quem
          sabe o que foi publicado onde. */}
      {direto && direto.length > 0 && (
        <Reveal y={18}>
          <Plate>
            <PlateHead icon={EyeOff}>Dentro do &ldquo;Direto&rdquo;</PlateHead>
            <p className="font-mono text-[10px] text-dusty mb-4 leading-relaxed max-w-[74ch]">
              Sessões que chegaram sem dizer de onde vieram, abertas pela página em que
              entraram. Entrada na raiz costuma ser quem digitou o endereço; entrada direta
              numa página funda quase sempre é link externo que apagou o referrer.
            </p>
            <Tabela
              cabecalho={["Página de entrada", "Sessões", "Rejeição", "Páginas/sessão", "Permanência"]}
              alinhar={["l", "r", "r", "r", "r"]}
              linhas={direto.map((d) => [
                <span key="p" className="text-snow">{d.pagina}</span>,
                fmtNum(d.sessoes),
                <span key="r" style={{ color: (d.rejeicao ?? 0) >= 70 ? STATUS.poor : undefined }}>
                  {fmtPct(d.rejeicao)}
                </span>,
                d.paginas_sessao ?? "—",
                fmtDuracao(d.duracao_s),
              ])}
            />
            <p className="font-mono text-[10px] text-white/25 mt-4 leading-relaxed max-w-[74ch]">
              Para uma origem sair daqui e virar canal próprio, o link precisa carregar UTM —
              por exemplo{" "}
              <span className="text-mist">?utm_source=coinmarketcap&amp;utm_medium=referral</span>{" "}
              no endereço submetido ao diretório. Sem isso não há como distinguir, e nenhuma
              ferramenta de analytics consegue.
            </p>
          </Plate>
        </Reveal>
      )}

      {/* ── campanhas ───────────────────────────────────────────────────── */}
      <Reveal y={18}>
        <Plate>
          <PlateHead icon={Megaphone}>Campanhas (UTM)</PlateHead>
          {data.campanhas.length ? (
            <Tabela
              cabecalho={["Campanha", "Origem", "Meio", "Sessões", "Visitantes"]}
              alinhar={["l", "l", "l", "r", "r"]}
              linhas={data.campanhas.map((c) => [
                <span key="c" className="text-snow">{c.campanha}</span>,
                c.origem ?? "—",
                c.meio ?? "—",
                fmtNum(c.sessoes),
                c.visitantes == null ? <span key="v" className="text-white/25">—</span> : fmtNum(c.visitantes),
              ])}
            />
          ) : (
            <div className="py-10">
              <p className="font-mono text-[11px] text-dusty leading-relaxed max-w-[70ch]">
                Nenhuma campanha marcada nesta janela.
              </p>
              <p className="font-mono text-[10px] text-white/25 leading-relaxed max-w-[70ch] mt-3">
                A captura de UTM está ativa desde 27/08/2026 e sobrevive à navegação interna
                (fica guardada na sessão). Para uma origem aparecer aqui, o link precisa
                carregar os parâmetros — por exemplo{" "}
                <span className="text-mist">?utm_source=x&amp;utm_medium=social&amp;utm_campaign=fundacao</span>.
                gclid, fbclid, twclid e ?ref= são traduzidos automaticamente.
              </p>
            </div>
          )}
        </Plate>
      </Reveal>
    </div>
  )
}
