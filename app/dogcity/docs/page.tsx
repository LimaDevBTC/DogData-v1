// ═══════════════════════════════════════════════════════════════════════════
// DogCity Documentation, V1 (/dogcity/docs), página pública, texto em inglês.
//
// Transcrição de marketing/DOGCITY-DOCS-V1.md (604 linhas, aprovado). Todo
// número, tabela e frase abaixo vem literalmente desse arquivo; nada foi
// somado, arredondado ou reescrito. A única liberdade tomada foi de
// APRESENTAÇÃO: markdown vira componente (tabela, bloco de dados, cartão),
// nunca reescrita de conteúdo.
//
// ⚠️ SEÇÃO 8 DO MARKDOWN ("Notes for whoever writes the copy") FICOU DE FORA
// DE PROPÓSITO. Aquela seção não é conteúdo do documento: são instruções
// internas para quem escreve copy A PARTIR dele (o que pode repetir, o que
// não pode, o rung institucional que "não é público", números vivos que não
// devem ser impressos sem conferir antes). Publicar aquela seção verbatim
// numa página pública contradiria a própria seção, ela mesma diz que certas
// frases "não devem aparecer em lugar nenhum onde este documento for citado".
// O índice abaixo lista as seções 1 a 7; a 8 nunca chega ao HTML.
//
// Página sem animação de scroll/framer-motion (documento de leitura, não
// precisa disso), mas o <Layout> da casa É "use client" (usa useRouter) e
// todo outro page.tsx que o usa também é "use client", sem essa diretiva o
// build falha ao tentar serializar `setCurrentPage={() => {}}` para dentro de
// um Client Component. A metadata (que "use client" não pode exportar) mora
// no layout.tsx irmão deste arquivo.
// ═══════════════════════════════════════════════════════════════════════════

"use client"

import { Layout } from "@/components/layout"

// ── mesmas constantes de hairline de ../motion.tsx, copiadas localmente ────
// (aquele arquivo é "use client"; esta página é Server Component de propósito
// e não precisa de nenhum hook de lá, só destas duas strings)
const HAIR = "border-white/10"
const HAIR_SOFT = "border-white/[0.06]"

// ═══════════════════════════════════════════════════════════════════════════
// primitivas de tipografia e layout
// ═══════════════════════════════════════════════════════════════════════════

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{children}</div>
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-3xl ${className}`}>{children}</p>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-bold text-base md:text-lg text-snow mt-10 first:mt-0">{children}</h3>
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-lava hover:text-lava-light underline underline-offset-2 break-all"
    >
      {children}
    </a>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] md:text-[13px] text-snow bg-white/[0.06] px-1.5 py-0.5">{children}</code>
}

// a linha rotulo/valor que aparece nos blocos monoespaçados do documento
function Row({
  label, value, note, indent,
}: {
  label: string
  value?: string
  note?: string
  indent?: boolean
}) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ${indent ? "pl-4 border-l border-white/10 ml-1" : ""}`}>
      <span className="text-dusty">{label}</span>
      {value && <span className="text-snow tabular-nums">{value}</span>}
      {note && <span className="text-dusty">{note}</span>}
    </div>
  )
}

// bloco monoespaçado com borda, para dados congelados no bloco 966.670
function DataBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-4 border ${HAIR} bg-white/[0.02] px-5 py-4 md:px-6 md:py-5 font-mono text-[11px] md:text-xs space-y-1.5 max-w-2xl`}>
      {children}
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className={`mt-4 border ${HAIR} overflow-x-auto max-w-3xl`}>
      <table className="w-full text-[12px] md:text-[13px] border-collapse min-w-[340px]">
        <thead>
          <tr className={`border-b ${HAIR}`}>
            {head.map((h) => (
              <th key={h} className="text-left font-mono text-[9px] md:text-[10px] tracking-[0.14em] text-dusty px-3 py-2 md:px-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b ${HAIR_SOFT} last:border-b-0`}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 md:px-4 text-snow align-top tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NumberedList({ items }: { items: { lead: string; text: string }[] }) {
  return (
    <ol className="mt-4 space-y-3 max-w-3xl">
      {items.map((it, i) => (
        <li key={i} className="text-[13px] md:text-[15px] text-mist leading-relaxed flex gap-3">
          <span className="font-mono text-lava shrink-0 tabular-nums">{i + 1}.</span>
          <span>
            <strong className="text-snow">{it.lead}</strong> {it.text}
          </span>
        </li>
      ))}
    </ol>
  )
}

function BulletList({ items }: { items: { lead: string; text: string }[] }) {
  return (
    <ul className="mt-4 space-y-3 max-w-3xl">
      {items.map((it, i) => (
        <li key={i} className="text-[13px] md:text-[15px] text-mist leading-relaxed flex gap-3">
          <span className="text-lava shrink-0">·</span>
          <span>
            <strong className="text-snow">{it.lead}</strong> {it.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

// mini cabeçalho para os quatro "sinais" da seção 4 (não são numerados no
// documento original, são cabeçalhos em negrito seguidos de parágrafo)
function Signal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 max-w-3xl">
      <div className="font-display font-bold text-snow text-sm md:text-base">{title}</div>
      <div className="text-[13px] md:text-[15px] text-mist leading-relaxed mt-1.5">{children}</div>
    </div>
  )
}

// ── índice: seções 1 a 7 do documento (a 8 não é conteúdo público) ─────────
const TOC = [
  { id: "what-is-dogcity", n: "1", label: "What DogCity is" },
  { id: "the-snapshot", n: "2", label: "The snapshot" },
  { id: "how-land-follows-the-coins", n: "3", label: "How land follows the coins" },
  { id: "person-from-a-service", n: "4", label: "Person from a service" },
  { id: "financial-district", n: "5", label: "The Financial District" },
  { id: "founders-program", n: "6", label: "The Founders Program" },
  { id: "not-yet", n: "7", label: "What this is not, yet" },
]

function Section({
  id, n, title, children,
}: {
  id: string
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={`relative border-t ${HAIR_SOFT} scroll-mt-24`}>
      <div className="py-14 md:py-20">
        <Eyebrow>SECTION {n}</Eyebrow>
        <h2 className="font-display font-bold text-2xl md:text-[32px] text-snow mt-3 leading-tight max-w-2xl">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function DogCityDocsPage() {
  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="bg-void text-snow">
        {/* ── cabeçalho do documento ─────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-8 md:pt-16 md:pb-10">
          <Eyebrow>PUBLIC DOCUMENTATION · V1</Eyebrow>
          <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] md:leading-[1.03] mt-3 max-w-3xl">
            DogCity Documentation
          </h1>
          <div className="mt-5 font-mono text-[11px] md:text-xs text-dusty leading-relaxed max-w-2xl space-y-1">
            <div><span className="text-mist">STATUS</span> · public documentation, first version</div>
          </div>
          <P className="max-w-2xl">
            What DogCity is, how the snapshot was built and verified, how land is sized, how the
            project tells a person from a service, and what the Financial District is. This
            document does not say where any wallet lives in the city. That comes later and will be
            published the same way everything else here was: with the method, the numbers, and a
            fingerprint.
          </P>

          {/* ── o mapa ──────────────────────────────────────────────────── */}
          <figure className="m-0 mt-8 max-w-3xl">
            <a
              href="/city/mapa-topo.svg"
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative block border ${HAIR} bg-white/[0.02] overflow-hidden`}
            >
              {/* SVG de 4,4 MB: NUNCA importado, servido direto de /public por
                  URL. Uma tag <img> comum, não next/image (que não otimiza
                  SVG e só adicionaria uma camada sem ganho). */}
              <img
                src="/city/mapa-topo.svg"
                alt="Topographic map of DogCity's lunar site: the ring roads, the spit, the bay and Satoshi Plaza over real Mare Tranquillitatis elevation data."
                className="w-full h-auto"
                loading="lazy"
              />
              <span
                className={`absolute bottom-0 right-0 border-l border-t ${HAIR} bg-void/85 backdrop-blur-sm
                  font-mono text-[10px] tracking-[0.14em] text-lava group-hover:text-lava-light px-3 py-2`}
              >
                OPEN FULL SIZE →
              </span>
            </a>
            <figcaption className={`mt-3 border-t ${HAIR_SOFT} pt-3 font-mono text-[9px] md:text-[10px] tracking-[0.14em] text-mist leading-relaxed`}>
              THE TERRAIN THE CITY IS BUILT ON · CLICK TO OPEN AT FULL RESOLUTION
            </figcaption>
          </figure>
        </div>

        {/* ── corpo: índice + seções ──────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)] gap-x-10">
          {/* índice: barra horizontal rolável no celular, coluna fixa a partir de lg */}
          <nav aria-label="Table of contents" className="lg:border-t lg:border-white/[0.06] lg:pt-8">
            <div className="font-mono text-[9px] tracking-[0.25em] text-dusty mb-3 hidden lg:block">
              CONTENTS
            </div>
            <div className="flex gap-2 overflow-x-auto pb-4 lg:hidden min-w-0 -mx-6 px-6">
              {TOC.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className={`shrink-0 whitespace-nowrap border ${HAIR} font-mono text-[10px] tracking-[0.1em] text-mist hover:text-lava hover:border-white/[0.35] px-3 py-1.5`}
                >
                  {t.n}. {t.label}
                </a>
              ))}
            </div>
            <ul className="hidden lg:block space-y-2.5 lg:sticky lg:top-24">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block text-[12px] text-mist hover:text-lava leading-snug">
                    <span className="text-dusty font-mono mr-1.5">{t.n}</span>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            {/* ═══════════════════════════ 1 ═══════════════════════════ */}
            <Section id="what-is-dogcity" n="1" title="What DogCity is, in one page">
              <P className="mt-0">
                DogCity is a virtual city built on real lunar terrain. Bitcoin&apos;s territory sits
                on Mare Tranquillitatis, one of the Moon&apos;s dark basaltic plains, mapped from real
                NASA data rather than a procedural landscape invented for the game.
              </P>
              <P>
                Every wallet that holds $DOG receives a lot on that terrain. Not a lot you buy, not a
                lot you pick: a lot decided by that wallet&apos;s own history on the Bitcoin
                blockchain. The city is not a real-estate product. It is a permanent record of
                on-chain activity, rendered as a place you can walk through.
              </P>
              <P>Three ideas carry the whole design:</P>
              <BulletList
                items={[
                  {
                    lead: "Location is not for sale.",
                    text: "A wallet's position comes from its on-chain history at one fixed block. Nothing that can be paid for, licence, donation, or partnership, moves it.",
                  },
                  {
                    lead: "The city is a photograph, not a ledger.",
                    text: "A lot's position, size, and district are frozen at the snapshot block, forever. Spending an old coin afterward does not move the building.",
                  },
                  {
                    lead: "Only the building breathes.",
                    text: "Height and condition follow the wallet's live balance, computed by the indexer. The lot underneath never changes.",
                  },
                ]}
              />
              <P>
                $DOG is the only asset involved. DogCity does not launch a new token, and holding a
                lot is not equity, an investment, or a yield.
              </P>
            </Section>

            {/* ═══════════════════════════ 2 ═══════════════════════════ */}
            <Section id="the-snapshot" n="2" title="The snapshot">
              <Sub>What happened</Sub>
              <P className="mt-3">
                On 12 September 2026 a single Bitcoin block decided the land allocation of every
                self custody $DOG wallet in the city. Nothing was claimed, nothing was signed,
                nothing was registered. The chain was read once, at one height, and the result was
                frozen.
              </P>
              <DataBlock>
                <Row label="block" value="966,670" />
                <Row label="time" value="12 September 2026, 11:26:45 UTC" />
                <Row label="block hash" value="00000000000000000001151e3718cd3766940941fa7815f7eaeb1b8588acd927" />
                <Row label="rune" value="DOG-GO-TO-THE-MOON" note="(id 840000:3, 5 decimals)" />
              </DataBlock>

              <Sub>What was counted</Sub>
              <DataBlock>
                <Row label="wallets holding $DOG" value="85,818" />
                <Row label="UTXOs" value="239,432" />
                <Row label="$DOG" value="99,975,593,202.33" />
              </DataBlock>
              <P>
                The rune&apos;s total supply is 100,000,000,000. The count is 24,406,797.66 short of
                that figure, and the difference is burned $DOG: destroyed on chain, owned by nobody.
                The snapshot counts what exists, so it counts circulating supply exactly. The
                project&apos;s own API publishes the burn figure at <Code>/api/dog-rune/stats</Code>.
              </P>

              <Sub>How it was built</Sub>
              <P className="mt-3">
                A snapshot is not a photograph of today. It is a photograph of one moment, and the
                chain kept moving after it.
              </P>
              <NumberedList
                items={[
                  {
                    lead: "",
                    text: "The full set of DOG coins was frozen from a state the node had already confirmed, at a height above the snapshot block.",
                  },
                  {
                    lead: "",
                    text: "Every DOG transaction that happened after block 966,670 was then undone, one at a time: coins created after the block were removed, coins spent after the block were put back where they were.",
                  },
                  {
                    lead: "",
                    text: "The result is the set of coins that existed at 11:26:45 UTC, and nothing else.",
                  },
                ]}
              />
              <P>
                Balance, coin age, UTXO count, and Runestone ownership were all derived from that
                same frozen set, so every number in the snapshot describes the same instant.
                Runestone ownership was pinned to the block too, not copied from today: 31 stones
                changed hands in the hours after the snapshot, and using a fresh list would have
                credited 8 wallets that did not hold one at the block and missed 13 that did.
              </P>

              <Sub>How it was verified</Sub>
              <P className="mt-3">
                The method can be checked, which is the point. Two things had to be true, and if
                either was off by a single unit the work was wrong.
              </P>
              <BulletList
                items={[
                  {
                    lead: "Supply conservation.",
                    text: "A transfer moves coins, it never creates or destroys them. Rolling the chain back must leave the total untouched. The difference came to zero, exactly.",
                  },
                  {
                    lead: "Set identity.",
                    text: "Every coin spent after the block had to reappear, and every coin created after it had to disappear. The two sides matched to the unit, and no wallet came out holding a negative balance.",
                  },
                ]}
              />
              <P>
                These checks are not decoration. While the list was being closed they caught real
                mistakes, including two source files that looked identical and were four blocks
                apart from each other. A negative balance is impossible, so when one appeared it
                proved the inputs were wrong, not the arithmetic. The list was only declared
                finished when both checks came to zero.
              </P>

              <Sub>The result, sealed</Sub>
              <P className="mt-3">
                The snapshot is a file. Its fingerprint is published so it cannot be quietly
                changed: if a single number inside it moves, the hash stops matching.
              </P>
              <DataBlock>
                <Row label="dog_snapshot_966670.json" value="42.3 MB" />
                <Row label="sha256" value="dc3a8df4a5af3cc2c5ff7ea888c8f1811e21c8a78c70e121cd5ab19f80154e75" />
              </DataBlock>
              <DataBlock>
                <Row label="dog_snapshot_966670_utxos.json" value="38.8 MB" />
                <Row label="sha256" value="ccac1c2f5fd64b31359a8f37c52236cc3543f9a950904296e9aeabe44ca96bdf" />
              </DataBlock>
              <P>
                The first file holds one row per wallet: balance, coin age, UTXO count, tier,
                Runestone count. The second holds every counted UTXO, by wallet.
              </P>

              <Sub>Who the snapshot found</Sub>
              <Table
                head={["Group", "Wallets"]}
                rows={[
                  ["Received the airdrop and still hold", "26,943"],
                  ["Never received the airdrop, bought on the market", "58,875"],
                  ["Hold a Runestone", "29,011"],
                  ["Hold a Runestone and received the airdrop", "24,942"],
                  ["Never sold a single coin of their airdrop", "19,279"],
                  ["Never sold, and still hold their Runestone", "18,633"],
                ]}
              />
              <P>
                Those last 18,633 received DOG when it was given away, held every coin of it, and
                kept the Runestone that brought it to them. On chain, that is the longest patience
                the data can show.
              </P>
              <P>
                Holder tier counts at the snapshot. These tiers are the ranks of the Genesis Badge,
                earned by airdrop history; the badge is a mark, not a lot, and it does not decide
                where a wallet lives (see section 3):
              </P>
              <Table
                head={["Tier", "Wallets"]}
                rows={[
                  ["Satoshi Visionary", "88"],
                  ["BTC Maximalist", "100"],
                  ["Rune Master", "261"],
                  ["Ordinal Believer", "713"],
                  ["DOG Supporter", "1,349"],
                  ["Diamond Paws", "19,279"],
                ]}
              />
            </Section>

            {/* ═══════════════════════════ 3 ═══════════════════════════ */}
            <Section id="how-land-follows-the-coins" n="3" title="How land follows the coins">
              <P className="mt-0">Lot area grows with the square root of a wallet&apos;s $DOG balance, between a floor and a cap:</P>
              <DataBlock>
                <Row label="area" value="clamp( 0.986443 x sqrt(DOG), 1 m2, 40,000 m2 )" />
                <Row label="total allocated" value="46.66 km2" />
              </DataBlock>
              <P>
                Square root is the whole point. Doubling a balance does not double the land, it
                multiplies it by 1.41. A city where land grew in a straight line with money would be
                owned by six wallets.
              </P>
              <Table
                head={["A wallet holding", "Receives a lot of"]}
                rows={[
                  ["1,000 $DOG", "31 m2"],
                  ["20,000 $DOG", "140 m2"],
                  ["101,779 $DOG (the median holder)", "315 m2"],
                  ["889,806 $DOG (one full airdrop allocation)", "931 m2"],
                  ["10,000,000 $DOG", "3,119 m2"],
                  ["1,644,000,000 $DOG and above", "40,000 m2 (the cap)"],
                ]}
              />
              <P>Six wallets reach the cap.</P>
              <P>The number that answers the whale question before it is asked:</P>
              <DataBlock>
                <Row label="Top 20 wallets, share of supply" value="33.02%" />
                <Row label="Top 20 wallets, share of land" value="1.14%" />
              </DataBlock>
              <P>
                The largest wallet on the chain holds 56 times more $DOG than the twentieth largest,
                and receives 2.7 times the land. That is the square root curve at work: it rewards
                size without letting size erase everyone smaller.
              </P>
            </Section>

            {/* ═══════════════════════════ 4 ═══════════════════════════ */}
            <Section id="person-from-a-service" n="4" title="How we tell a person from a service">
              <P className="mt-0">
                This is the part of the project most worth explaining slowly, because it is where
                the city almost got it wrong, and the record of getting it wrong is what makes the
                final answer trustworthy.
              </P>

              <Sub>Where this ruler came from</Sub>
              <P className="mt-3">
                The project&apos;s first version of this system only classified wallets that had
                received the original $DOG airdrop. A wallet that never received the airdrop, no
                matter how much it accumulated by buying on the open market, carried no tier and had
                no path to a strong position in the city, however hard it tried.
              </P>
              <P>
                A member of the community, the user @R_irion66036 on X, pointed this out publicly,
                in this post:{" "}
                <ExtLink href="https://x.com/r_irion66036/status/2098835847101477099">
                  https://x.com/r_irion66036/status/2098835847101477099
                </ExtLink>
              </P>
              <P>
                That criticism was correct, and it changed the project. The ruler was rebuilt to
                order all 85,818 wallets in the snapshot by measured on-chain accumulation,
                independent of whether a wallet ever received the airdrop. Location is set by
                history and cannot be bought: that is the whole point of the city, a record of who
                was here, not a shelf of addresses for sale. But arriving today shuts nobody out.
                Every $DOG wallet already holds a lot from its own on-chain history, and anyone can
                still become a Founder by order of arrival, build on the land they already own, and
                take an entry in the Founders&apos; draw (section 6 covers all three).
              </P>
              <P>
                The airdrop itself did not disappear from the picture. It became the Genesis Badge:
                every wallet that received the original airdrop carries this mark permanently, on
                the record as part of the first community. The Genesis Badge is identity and
                legacy, never land and never a return. It does not decide where a wallet lives and
                it pays out nothing; the tiers above are its ranks.
              </P>

              <Sub>Why the problem exists</Sub>
              <P className="mt-3">
                The rebuilt ruler needed to be a single measure that could order every wallet: how
                much a wallet accumulated, and for how long it held. Call it DOG-time: for every
                coin a wallet holds, multiply its amount by its age in days, and add it all up. One
                number, the same question for everyone, no need to know whether a wallet received
                the airdrop, bought on the market, or both.
              </P>
              <P>
                The first time that ruler was run in full, half of its own top ranks were not
                people. Some wallets held tens of thousands of deposits, one per transaction, every
                single day for the project&apos;s entire history. Others had received deposits from
                nearly a thousand different addresses. A ruler built to reward patient accumulation
                was, at the very top, rewarding infrastructure: exchange wallets, bridges, and
                addresses the project itself uses to distribute funds.
              </P>

              <Sub>Why it is hard</Sub>
              <P className="mt-3">
                The obvious fix, exclude anything that looks like a business, runs into a structural
                wall: <strong className="text-snow">custody consolidates</strong>. An
                exchange&apos;s wallet does not receive from the public. It receives from the
                exchange&apos;s own internal transfers, which have already gathered everything
                together. That gives it few counterparties, old coin age, and little turnover per
                address, exactly the signature the ruler was designed to reward. In the one sense
                that matters most to a ruler built on patience, a service&apos;s wallet looks better
                than a person&apos;s. Nothing about the shape of the coins on chain says &quot;this
                is a business.&quot; The information that a wallet belongs to a company lives in a
                label, not in its transaction history.
              </P>

              <Sub>The metrics we tested and rejected</Sub>
              <P className="mt-3">
                Every one of these was measured against the real wallet population, not judged by
                eye. Each line is the number that killed it.
              </P>
              <NumberedList
                items={[
                  {
                    lead: "Counting deposits or UTXOs.",
                    text: "One wallet had 195 separate deposits and zero signed transactions in its entire history: it bought, repeatedly, and never once proved it controlled the coins by spending them. Counting deposits measures buying, not conviction.",
                  },
                  {
                    lead: "Buying whole airdrop allocations",
                    text: "(a wallet's deposits arriving in exact multiples of 889,806 $DOG, the size of one airdrop allocation). 68 wallets bought ten or more whole allocations and mostly never sold. Worse: five of those wallets received the deposits as the airdrop payout of their own Runestones (holding 38, 16, 13, 14, and 24 stones). A filter meant to catch accumulation would have punished exactly the holders the project promises to reward.",
                  },
                  {
                    lead: "A repeated, identical deposit value.",
                    text: "This only finds the market's own standard lot size: 88,980.60 $DOG, one tenth of an airdrop allocation, shows up in hundreds of perfectly ordinary wallets.",
                  },
                  {
                    lead: "Signatures per day of the wallet's active window.",
                    text: "A cutoff of one signature per day catches 20,871 wallets, a quarter of the entire city.",
                  },
                  {
                    lead: "Turnover",
                    text: "(signatures divided by remaining UTXOs). This catches holders who are consolidating, not cashing out: one wallet held 68 exact airdrop allocations inside a single UTXO and had signed 106 times just to merge them into it. The denominator collapses to one and the ratio explodes, flagging patience as suspicious.",
                  },
                  {
                    lead: "Distinct payers, counted only from the surviving UTXO",
                    text: "(the coins still held at the snapshot). This measure is nearly identical, mathematically, to counting UTXOs (a correlation of 0.9995 across 413 of the top 500 wallets). It rewards a wallet that sweeps its coins into one output, because sweeping erases the wallet's own deposit history, and it punishes a wallet that simply keeps everything it was ever sent.",
                  },
                  {
                    lead: "Distinct payers, counted from a wallet's complete history.",
                    text: "A known exchange address showed 763 distinct payers across 1,334 transactions, which briefly looked like a real line to draw. It was not: a confirmed retail wallet showed 633 distinct payers too, because it had bought 129 whole airdrop allocations from 633 different people and never sold a single coin. It measured right alongside the exchange. A cutoff proposed from a small sample would have wrongly flagged several confirmed people and retail wallets along with it.",
                  },
                ]}
              />

              <Sub>What works, and why</Sub>
              <P className="mt-3">
                The instrument that survived is not one rule but three, plus a hard exit condition,
                and each targets a different shape of custody.
              </P>
              <Signal title="Circadian rhythm">
                A service operates continuously; a person sleeps. Measuring the concentration of a
                wallet&apos;s deposit times around the clock (a statistical test on the hour of day,
                in UTC, each deposit arrived) separates the two: a person&apos;s deposits cluster
                around the hours they are awake, a service&apos;s do not cluster at all.
                <DataBlock>
                  <Row label="rule" value="100 or more deposits, AND a concentration score below 0.15" />
                </DataBlock>
                <span className="block mt-3">
                  The threshold has to scale with how many deposits a wallet has, because a small
                  sample looks randomly clustered by chance alone. Tested against the full
                  population of comparable wallets, the rule caught 3 out of 71 candidates, and all
                  3 had signed 300 or more transactions each: a service hiding inside what looked
                  like a control group. Zero honest wallets were wrongly caught.
                </span>
              </Signal>
              <Signal title="The 889,806 package">
                A marketplace trades in whole airdrop allocations or exact fractions of one; an
                exchange moves any amount at all, set by whatever a customer chooses to send. Every
                verified exchange address shows close to zero deposits landing on a package
                boundary. Across the whole city, 27.5% of wallets are wallets where every single
                deposit landed on a package boundary, and 67.4% are wallets where none did. The
                number sits squarely at one of two ends: it is either a retail signature or it is
                not.
              </Signal>
              <Signal title="Overlap between who pays and who gets paid">
                A custodian or a bridge address tends to return funds to close to the same address
                that deposited them, because that is what custody and bridging mean. An exchange
                almost never does: a customer deposits to one address and withdraws to another.
                Measured across the clearest three reference points available: a confirmed person
                showed 0% overlap, a confirmed exchange showed 2%, and an independently confirmed
                cross-chain bridge address showed 63%, consistent with a bridge&apos;s normal
                behavior of partial redemption (some coins migrate across and stay, some come
                back). This is the one test that proves custody by mechanism rather than by
                threshold.
              </Signal>
              <Signal title="A marketplace-fee check, used only to confirm a person, never to exclude a service">
                Confirmed retail wallets pay a marketplace fee on 86 to 100% of their purchases. It
                cannot exclude a service on its own, because some professional trading activity also
                runs through the same marketplace.
              </Signal>

              <Sub>How we calibrated against outside truth</Sub>
              <P className="mt-3">
                The strongest evidence available anywhere in the project is a wallet whose owner
                asked to be verified and paid to prove it: those addresses live in the project&apos;s
                verified-address list, separate from the labels the project deduces on its own from
                chain data. Three such verified exchange hot wallets, Gate.io, MEXC, and Bitget, sat
                at the very top of the raw accumulation ruler. Reaching the conclusion &quot;this is
                a service&quot; for all three, using only blind measurement (circadian rhythm,
                distinct destinations, volume) before ever looking at which address belonged to
                which company, is what validated the instrument. That gives confidence in what the
                same instrument says where no label exists yet.
              </P>
              <P>
                The DOG-to-Stacks bridge, an address the founder confirmed directly, measured at 63%
                overlap between depositors and recipients, exactly the bridge signature described
                above: some transfers show a full round trip, most show partial redemption
                consistent with migrating funds across chains and holding them there.
              </P>

              <Sub>What the ruler does not reach, honestly</Sub>
              <P className="mt-3">
                The ruler only has enough signal to classify where the money actually concentrates.
                It cannot classify the whole city, and it does not try to.
              </P>
              <DataBlock>
                <Row label="circadian rhythm signal (100+ deposits)" value="120 wallets" note="0.14% · concentrate 28% of supply" />
                <Row label="overlap signal (20+ deposits)" value="1,170" note="1.36%" />
                <Row label="any shape signal at all (10+ deposits)" value="3,353" note="3.91% · concentrate 52% of supply" />
                <Row label="too few deposits to read (under 10)" value="82,465" note="96.09%" />
                <Row label="of those, never sent DOG at all" value="58,695" note="excluded by rule, see below" indent />
                <Row label="genuinely no signal either way" value="23,770" note="27.70%" indent />
              </DataBlock>
              <P>
                In the top 500 wallets specifically, 57% have 10 or more deposits, 38% have 20 or
                more, and 10% have 100 or more: the signal is concentrated exactly where it matters,
                at the top of the city.
              </P>

              <Sub>The rule that protects everyone else</Sub>
              <P className="mt-3">
                A wallet only ever carries the institutional tag if it has sent $DOG at least once,
                in addition to matching one of the signals above. This is not a technicality: the
                right of appeal described in section 5 only works for a wallet that notices it was
                tagged and pushes back. A wallet that received the airdrop and never touched it
                again cannot appeal, so it must never be exposed to a tag in the first place. That
                single rule protects 58,695 wallets, 68% of the entire city, that have never signed
                a transaction of any kind.
              </P>
              <P>
                Applied once, on the top 500 wallets, the current rule flagged 21 wallets holding
                13,660,491,106 $DOG (13.66% of the supply). Eight of the 21 sit in the top 10,
                fifteen in the top 60. Thirteen of the 21 were caught by only one of the four
                signals and carry no independent label: those are the fragile calls, and the ones
                most likely to be appealed.
              </P>
            </Section>

            {/* ═══════════════════════════ 5 ═══════════════════════════ */}
            <Section id="financial-district" n="5" title="The Financial District">
              <Sub>What it is and why it exists</Sub>
              <P className="mt-3">
                A wallet&apos;s position in the residential city is earned by patient personal
                accumulation. An exchange, a bridge, or a trading desk never competed on that axis
                in the first place, and placing one at the back of the line for holding the coins
                its own customers sent it is not neutrality, it is punishing the entities that
                brought the project attention and liquidity. The Financial District exists to give
                institutions their own address, sized by what they hold, without asking the
                residential ruler to bend around them.
              </P>

              <Sub>A privilege, not a punishment</Sub>
              <P className="mt-3">
                Moving a wallet with institutional behavior into the Financial District is not a
                penalty. It is the arrangement that leaves both sides better off, and both sides
                need to be argued, because the point is that nobody loses.
              </P>
              <P>
                For the institution, it is a privilege. It receives an address in the city&apos;s
                commercial center, where visibility is worth something, instead of disappearing into
                the middle of a residential line that measures a quality it never competed for in
                the first place. An exchange that brought $DOG a listing and press attention earns a
                storefront, not a punishment.
              </P>
              <P>
                For everyone else, it is also a gain. Residential lots go to the wallets that
                actually live in those neighborhoods, and no person loses ground to an address that
                is holding coins on behalf of other people.
              </P>
              <P>
                The residential ruler measures personal accumulation, and an institution never
                competed on that axis to begin with. Taking it out of that line is not removing it
                from the city, it is placing it where what it does is exactly what counts. The right
                of appeal for this tag, documented later in this section, still stands either way: a
                wallet flagged by mistake, whose owner states the wallet is personal, trades it for
                a lot of the same standing drawn from the project&apos;s reserve.
              </P>

              <Sub>Where it is</Sub>
              <P className="mt-3">
                The Financial District sits inside Satoshi Plaza, the city&apos;s central precinct
                (everything within 1,420 meters of the center, 6.33 km2 total), rather than in a
                ring further out. The plaza was already larger than its current civic program
                needed, and placing the district there gives it the most prominent address in the
                city without taking a single lot away from the residential fabric.
              </P>
              <DataBlock>
                <Row label="Satoshi Plaza" value="6.33 km2" />
                <Row label="Financial District (institutional wallets)" value="1.89 km2" note="(30%)" indent />
                <Row label="project reserve, 15% of the plaza" value="0.95 km2" note="(15%)" indent />
                <Row label="civic core and existing landmark buildings" value="3.49 km2" note="(55%)" indent />
              </DataBlock>

              <Sub>How land is sized inside the district</Sub>
              <P className="mt-3">
                The district uses the same square-root curve as the rest of the city, with its
                ceiling raised from 40,000 m2 to 150,000 m2. The residential cap would tie every
                large institution at the same maximum size, which erases exactly the size difference
                a financial district is supposed to show. Under the raised cap, the largest wallet
                identified so far reaches roughly 112,000 m2, well under the new ceiling, and the
                curve still holds: a wallet with 4.3 times the balance of another receives only 2.1
                times the land. Twenty-two already-identified institutional wallets today account
                for 28.85% of the supply and would occupy under 0.6 km2 even at the higher cap; a
                broader projection across every exchange currently listing $DOG and their bridges
                puts the total closer to 1.9 km2, comfortably inside the 13.5 km2 available in the
                surrounding ring should the district ever need to grow into it.
              </P>
              <P>
                $DOG is listed on 20 exchanges today (source: CoinGecko, 13 September 2026), 14
                custodial and 6 on-chain. The project has confirmed the deposit address of 5 of the
                14 custodial exchanges so far.
              </P>

              <Sub>How you enter</Sub>
              <P className="mt-3">
                Entry is by verified identity, never by measurement. A wallet does not qualify for
                the Financial District by looking like a business on chain: the exchange or
                institution comes to the project, proves who it is, and the project and the
                institution enter a partnership. This is the mirror image of how a residential lot
                is earned: in the neighborhoods, a wallet proves what it did; in the Financial
                District, it proves who it is. An exchange that has not yet reached out does not get
                placed there by the project&apos;s own deduction.
              </P>

              <Sub>The right of appeal</Sub>
              <P className="mt-3">
                Not every institutional wallet will have come forward for a partnership by the time
                the city goes live, and the measurement in section 4 exists precisely to catch the
                ones that have not, without silently mislabeling anyone. Any wallet automatically
                tagged as institutional keeps a right of appeal: its owner can state that the wallet
                is personal and trade it for a lot of the same standing drawn from the project&apos;s
                own reserve, no different in size or quality from the one it gave up.
              </P>
              <P>
                That right only works because the project holds a standing reserve everywhere it
                might be needed. The project keeps 15% of the lots in every neighborhood in the
                city, scattered throughout each one rather than gathered into a single block,
                specifically so that a lot of comparable standing is always available near wherever
                an appeal happens to land. Across the whole city that reserve totals 15,141 lots,
                alongside 85,797 wallet lots, using 51.05 km2 of the 66.767 km2 of urban fabric
                available, with 15.71 km2 to spare.
              </P>
            </Section>

            {/* ═══════════════════════════ 6 ═══════════════════════════ */}
            <Section id="founders-program" n="6" title="The Founders Program">
              <P className="mt-0">
                Founders are a separate track from the residential city: a way to fund and unlock
                the city&apos;s construction, layered on top of a wallet&apos;s own lot from section
                3, never a substitute for it. A wallet&apos;s Genesis Badge, tier, and lot never
                change because of anything in this section.
              </P>

              <Sub>What a Founder is</Sub>
              <P className="mt-3">
                A Founder is any wallet that contributes to the city&apos;s construction fund before
                the fund reaches 10,000,000 $DOG. There is no cap on the number of Founders: what
                closes the door is time, not a seat count. Contributions are counted per wallet and
                add up across several transactions, and a wallet&apos;s Founder number is assigned
                by order of arrival, meaning its first contribution, never by how much it eventually
                gives. Contributing more later never moves the number.
              </P>

              <Sub>Three axes</Sub>
              <P className="mt-3">
                Everything a Founder receives sits under one of three ideas:{" "}
                <strong className="text-snow">Seen</strong>, the building stands on opening day and
                carries a marker only Founders have; <strong className="text-snow">Remembered</strong>,
                the name on the Founders&apos; Monument and the number on the facade; and{" "}
                <strong className="text-snow">First</strong>, mints before the doors open and sits
                inside every test and update before anyone else.
              </P>

              <Sub>The ladder</Sub>
              <P className="mt-3">Every rung includes everything in the rung below it.</P>
              <div className="mt-4 space-y-3 max-w-3xl">
                {[
                  {
                    name: "Citizen",
                    threshold: "any amount",
                    text: "A name on the Founders' Monument in order of arrival, a permanent Founder number never issued again, access to the Founders Club on its island in the city's bay, and one entry in the Founders' draw. There is no building licence below 10,000 $DOG: the recognition is permanent either way, and the order number is the one thing that cannot be obtained later.",
                  },
                  {
                    name: "Personal",
                    threshold: "10,000 $DOG",
                    text: "Adds a one time, permanent building licence; minting before the Grand Opening, so the building stands on day one; early access to the game, to every test and every update; the Founder's light on the building, visible from above at night; and a base item pack (yard and house number plaque).",
                  },
                  {
                    name: "Commercial",
                    threshold: "50,000 $DOG",
                    text: "Adds an extended item pack (leisure ground, garden, lighting) and a lunar rover parked on the lot.",
                  },
                  {
                    name: "Patron",
                    threshold: "500,000 $DOG",
                    text: "Adds naming a street, with the name staying on the city map, and a custom building designed outside the district catalogue. This is the one exception to the rule that every district keeps its own architecture, which is why the privilege stops here: personality lives in the items around a house, not in the house itself.",
                  },
                ].map((r) => (
                  <div key={r.name} className={`border ${HAIR} bg-white/[0.02] px-5 py-4 md:px-6`}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-display font-bold text-snow text-base md:text-lg">{r.name}</span>
                      <span className="font-mono text-[11px] tracking-[0.1em] text-lava">{r.threshold}</span>
                    </div>
                    <p className="mt-2 text-[13px] md:text-sm text-mist leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>

              <Sub>The Founders&apos; draw</Sub>
              <P className="mt-3">
                One draw, among every Founder at any rung, on an announced date. Prizes: a
                Runestone, held by the project and given away once; a custom building, the Patron
                privilege granted to a winner at any rung; a street name, chosen by the winner and
                printed on the city map; and the 1 of 1, the first lunar rover ever minted, the only
                one of its kind. No lot is ever drawn: where a wallet lives is decided by its
                Bitcoin history at block 966,670, never by anything paid.
              </P>

              <Sub>Soulbound versus transferable</Sub>
              <P className="mt-3">
                Founder and achievement items are soulbound: they prove something a wallet did, and
                that proof cannot be bought. Catalogue items, bought from the store, are
                transferable: they are taste, so they can trade. The split gives the city a real
                item market without turning merit into merchandise.
              </P>

              <Sub>What a Founder is not</Sub>
              <P className="mt-3">
                Not equity, not an investment, not a yield. DogCity launches no new token: no
                staking, no APY, no emissions, no parallel economy. Everything runs on $DOG, which
                already exists on Bitcoin and is already distributed. Being a Founder never moves a
                wallet&apos;s own lot, and it never moves anyone else&apos;s either.
              </P>
            </Section>

            {/* ═══════════════════════════ 7 ═══════════════════════════ */}
            <Section id="not-yet" n="7" title="What this is not, yet">
              <BulletList
                items={[
                  {
                    lead: "No lot has a published address.",
                    text: "The snapshot decides how much land a wallet receives, not where in the city that land sits. Where each wallet lives comes later, and will be published with the same method, numbers, and fingerprint used here.",
                  },
                  {
                    lead: "No deed has been minted.",
                    text: "There is nothing to claim, nothing to sign, nothing to pay today.",
                  },
                  {
                    lead: "Nothing you do now changes the snapshot.",
                    text: "Moving coins after block 966,670 does not change what that block recorded, in either direction.",
                  },
                  {
                    lead: "The Financial District is a set of decided rules, not a built district.",
                    text: "Its boundaries, its cap, and its entry process are locked; the lots themselves have not been generated or assigned.",
                  },
                  {
                    lead: "The city is not reproducible by outsiders yet.",
                    text: "The snapshot file and its fingerprint are published, and anyone can check their own wallet's balance and coin age against the chain by hand. A public script that rebuilds the entire list from scratch does not exist yet.",
                  },
                ]}
              />
            </Section>

            <div className="py-14 md:py-16">
              <a href="/dogcity" className="font-mono text-[11px] tracking-[0.14em] text-lava hover:text-lava-light">
                ← BACK TO DOGCITY
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
