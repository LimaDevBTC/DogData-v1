"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O CABEÇALHO DE PÁGINA. Um só, para o site inteiro.
//
// Antes desta peça existiam TRÊS gerações de cabeçalho convivendo, e dava para
// ver na mesma tela qual era qual:
//
//   1ª  `gradient-text-hero`, centralizado, ícone em `rounded-xl`, e — o pior —
//       SEM `font-display`. Como o <body> carrega `font-mono`, o <h1> dessas
//       páginas renderizava em JetBrains Mono laranja. Em /holders isso ficava
//       dois centímetros acima do card do $DOG Galaxy, que usa Syne branco: a
//       mesma tela mostrava duas tipografias brigando. Era /holders, /airdrop,
//       /bitcoin-network e /transactions.
//   2ª  `font-display` com cor sólida, mas ainda centralizado e sem hierarquia.
//   3ª  a linguagem plot-map de /runestone, /profile e do painel: sobrancelha
//       mono, fio de cabelo, título em display, tudo alinhado à esquerda.
//
// Esta é a 3ª, extraída e endurecida. As regras que ela carrega:
//
// · ALINHAMENTO À ESQUERDA. Todo conteúdo do site é alinhado à esquerda; um
//   cabeçalho centralizado troca o eixo de leitura no topo de cada página e é
//   metade da sensação de "desalinhado".
//
// · O SUBTÍTULO NÃO É MONO. Mono é largo e não hifeniza bem; centralizado num
//   iPhone de 390 px, "Complete holder database with real-time updates" quebrava
//   dentro da palavra — "real-" numa linha, "time updates" na outra. Texto
//   corrido, alinhado à esquerda e com `max-w` mede certo em qualquer largura.
//
// · CANTO VIVO, NUNCA `rounded-xl`. Canto arredondado é a assinatura de kit de
//   componente genérico e contradiz a chapa de canto reto que o site usa em
//   toda placa.
//
// · O TÍTULO É `font-display`, SEMPRE. Não é opcional e não tem variante.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ IDIOMA. Este componente nao tem string propria — tudo vem por prop — mas
// quem o usa precisa lembrar: as paginas PUBLICAS do site sao em INGLES. O
// painel interno em /analytics e o unico lugar em portugues. O site recebe
// visita de 85 paises e o Brasil e ~26% dela; sobrancelha em portugues numa
// pagina publica e erro, nao escolha.
import type { ElementType, ReactNode } from "react"

export interface MetaDado {
  rotulo: string
  valor: string
  /** Liga o ponto pulsante. Use só quando o número realmente anda sozinho. */
  vivo?: boolean
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  icon: Icone,
  meta,
  acoes,
  className = "",
}: {
  eyebrow: string
  title: ReactNode
  sub?: ReactNode
  icon?: ElementType
  meta?: MetaDado[]
  /** Botões ou links que pertencem à página, não ao conteúdo. */
  acoes?: ReactNode
  className?: string
}) {
  return (
    <header className={`relative ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="min-w-0">

          {/* ── a sobrancelha, com o ícone dentro dela ────────────────────
              O ícone vive NA LINHA da sobrancelha, não à esquerda do bloco
              inteiro. Num iPhone, uma placa de 48 px à esquerda do conjunto
              rouba 60 px dos 342 disponíveis e empurra título e subtítulo para
              uma coluna estreita — que é onde a quebra feia nasce. Aqui ele
              custa uma linha de 26 px e devolve a largura inteira para o texto. */}
          <div className="flex items-center gap-2.5">
            {Icone && (
              <span
                aria-hidden
                className="grid place-items-center shrink-0 w-7 h-7 border border-lava/25 bg-lava/[0.06]"
              >
                <Icone className="w-3.5 h-3.5 text-lava" />
              </span>
            )}
            <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-lava truncate">
              {eyebrow}
            </span>
          </div>

          {/* fio estático de 56 px: a marca da casa. Não é DrawRule porque os
              reveals do projeto disparam num IntersectionObserver com margem
              negativa no topo, e um cabeçalho nasce dentro dessa zona morta —
              animado, ele nunca apareceria. */}
          <span aria-hidden className="block h-px w-14 bg-lava mt-3" />

          <h1 className="font-display font-bold text-snow leading-[1.04] mt-4
                         text-[26px] sm:text-[34px] md:text-[42px] lg:text-[46px]">
            {title}
          </h1>

          {sub && (
            <p className="text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-2xl">
              {sub}
            </p>
          )}
        </div>

        {acoes && <div className="shrink-0 flex items-center gap-2">{acoes}</div>}
      </div>

      {/* ── a régua de metadados ──────────────────────────────────────────
          "Last update: Aug 28, 2026 at 12:34:22 AM" solto em cinza era uma
          frase, não um dado: sem rótulo, sem alinhamento e com segundos que
          ninguém lê. Aqui cada item é rótulo + valor tabular, e o ponto verde
          só acende no que anda sozinho. */}
      {meta && meta.length > 0 && (
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 pt-4 border-t border-white/[0.06]">
          {meta.map((m) => (
            <div key={m.rotulo} className="flex items-center gap-2 min-w-0">
              {m.vivo && (
                <span
                  aria-hidden
                  className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"
                />
              )}
              <dt className="font-mono text-[10px] tracking-[0.2em] uppercase text-dusty shrink-0">
                {m.rotulo}
              </dt>
              <dd className="font-mono text-[11px] text-mist tabular-nums truncate">{m.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

// ── formatação de "última atualização" ─────────────────────────────────────
// Segundos saíram de propósito: um carimbo que muda a cada segundo convida a
// pessoa a conferir se mudou, e a resposta nunca importa. Minuto basta para
// dizer "isto é recente", que é a única pergunta que esse dado responde.
//
// ⚠️ `undefined` como locale, não "en-US" cravado: a data é lida por quem
// visita, e o site recebe gente de 85 países. O formato do navegador é o certo
// para cada um deles.
export function ultimaAtualizacao(iso: string | number | Date | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
