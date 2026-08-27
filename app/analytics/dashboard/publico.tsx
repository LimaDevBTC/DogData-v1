"use client"

// ═══════════════════════════════════════════════════════════════════════════
// PÚBLICO — quem é, onde está, com o quê.
//
// A correção pedida nesta aba era bandeira. Ela tinha um mapa fixo de 20
// emojis e o site recebe visita de 85 países: 65 caíam num 🌐 genérico e o
// painel tratava Suíça e Paquistão como "o resto do mundo".
//
// Não existe motivo pra manter lista. A bandeira de qualquer código ISO-3166
// alfa-2 é o par de Regional Indicator Symbols das duas letras, e o nome por
// extenso vem do próprio navegador via Intl.DisplayNames — ver `bandeira()` e
// `nomePais()` em ./ui. Uma conta, 250 países, zero manutenção.
//
// E o código sozinho também não servia: "AT" não diz nada a ninguém. Toda
// linha aqui mostra bandeira, nome por extenso e o código, nessa ordem.
// ═══════════════════════════════════════════════════════════════════════════

import { Globe2, Languages, Laptop, MapPin, Monitor } from "lucide-react"
import { Reveal, Stagger, StaggerItem } from "@/app/dogcity/motion"
import type { Trafego } from "./types"
import {
  CAT, HAIR, HAIR_SOFT, Plate, PlateHead, RankRows, SectionHead, Tabela,
  bandeira, fmtDuracao, fmtNum, fmtPct, nomeIdioma, nomePais,
} from "./ui"

export default function Publico({ data }: { data: Trafego }) {
  const totalSessoes = data.paises.reduce((s, p) => s + p.sessoes, 0) || 1
  const top = data.paises.slice(0, 12)
  const resto = data.paises.slice(12)

  return (
    <div className="space-y-12 md:space-y-16">

      {/* ── geografia ───────────────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow="GEOGRAFIA"
          title={`${data.paises.length} países nesta janela.`}
          sub="País vem do header da edge da Vercel, resolvido no servidor — o cliente não é consultado e não pode mentir sobre isso."
        />

        <Reveal delay={0.4} y={16}>
          <Stagger
            className={`mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px ${HAIR} border bg-white/10`}
            step={0.03}
          >
            {top.map((p) => (
              <StaggerItem key={p.pais}>
                <div className="bg-void p-4 h-full">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none shrink-0" aria-hidden>
                      {bandeira(p.pais)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-snow truncate">
                        {nomePais(p.pais)}
                      </div>
                      <div className="font-mono text-[9px] tracking-[0.18em] text-white/25">
                        {p.pais}
                      </div>
                    </div>
                  </div>
                  <div className="font-display font-bold text-xl text-snow tabular-nums mt-3">
                    {fmtNum(p.sessoes)}
                  </div>
                  <div className="font-mono text-[10px] text-dusty tabular-nums mt-0.5">
                    {fmtPct((p.sessoes / totalSessoes) * 100)} das sessões
                  </div>
                  {/* Permanência por país separa "muita gente passou" de "muita
                      gente ficou" — é o corte que revela tráfego artificial. */}
                  <div className="font-mono text-[10px] text-white/25 tabular-nums mt-0.5">
                    {p.duracao_s != null ? `${fmtDuracao(p.duracao_s)} em média` : "sem medição"}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        {resto.length > 0 && (
          <Reveal y={16} delay={0.1}>
            <div className={`mt-6 border ${HAIR}`}>
              <Tabela
                cabecalho={["País", "Sessões", "Visitantes", "Páginas", "Permanência"]}
                alinhar={["l", "r", "r", "r", "r"]}
                linhas={resto.map((p) => [
                  <span key="p" className="flex items-center gap-2">
                    <span aria-hidden>{bandeira(p.pais)}</span>
                    <span className="text-snow">{nomePais(p.pais)}</span>
                    <span className="text-white/25">{p.pais}</span>
                  </span>,
                  fmtNum(p.sessoes),
                  p.visitantes == null ? <span key="v" className="text-white/25">—</span> : fmtNum(p.visitantes),
                  fmtNum(p.pageviews),
                  fmtDuracao(p.duracao_s),
                ])}
              />
            </div>
          </Reveal>
        )}
      </section>

      {/* ── cidades ─────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <Plate className="h-full">
            <PlateHead icon={MapPin}>Cidades</PlateHead>
            {data.cidades.length ? (
              <RankRows
                numbered
                rows={data.cidades.slice(0, 12).map((c) => ({
                  label: `${bandeira(c.pais)}  ${c.cidade}`,
                  value: c.sessoes,
                }))}
              />
            ) : (
              <p className="font-mono text-[11px] text-dusty leading-relaxed py-6">
                Ainda sem cidade nesta janela.
                <br />
                <span className="text-white/25">
                  A cidade vem do header da edge e só passou a ser gravada em 27/08/2026.
                </span>
              </p>
            )}
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={Languages}>Idioma do navegador</PlateHead>
            {data.idiomas.length ? (
              <RankRows
                rows={data.idiomas.slice(0, 10).map((i) => ({
                  label: `${nomeIdioma(i.idioma)} (${i.idioma})`,
                  value: i.sessoes,
                }))}
                color={CAT[1]}
              />
            ) : (
              <p className="font-mono text-[11px] text-dusty py-6">
                Gravado desde 27/08/2026.
              </p>
            )}
          </Plate>
        </Reveal>
      </div>

      {/* ── tecnologia ──────────────────────────────────────────────────── */}
      <section>
        <SectionHead
          eyebrow="TECNOLOGIA"
          title="Com o que estão abrindo o site."
          sub="A largura de viewport é a que decide layout — não a resolução da tela, que ignora janela redimensionada e densidade de pixel."
        />
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-10">
          <Reveal y={18}>
            <Plate className="h-full">
              <PlateHead icon={Monitor}>Navegador</PlateHead>
              <RankRows rows={data.navegadores.map((n) => ({ label: n.navegador, value: n.sessoes }))} />
            </Plate>
          </Reveal>

          <Reveal y={18} delay={0.08}>
            <Plate className="h-full">
              <PlateHead icon={Laptop}>Sistema</PlateHead>
              {data.sistemas.length ? (
                <RankRows
                  rows={data.sistemas.map((s) => ({ label: s.so, value: s.sessoes }))}
                  color={CAT[1]}
                />
              ) : (
                <p className="font-mono text-[11px] text-dusty py-6">
                  Detecção de sistema ativa desde 27/08/2026.
                </p>
              )}
            </Plate>
          </Reveal>

          <Reveal y={18} delay={0.16}>
            <Plate className="h-full">
              <PlateHead icon={Globe2}>Largura de viewport</PlateHead>
              {data.telas.length ? (
                <RankRows
                  rows={data.telas.map((t) => ({ label: `${t.faixa} px`, value: t.sessoes }))}
                  color={CAT[2]}
                />
              ) : (
                <p className="font-mono text-[11px] text-dusty py-6">
                  Gravado desde 27/08/2026.
                </p>
              )}
            </Plate>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
