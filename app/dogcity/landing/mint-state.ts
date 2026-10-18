// ═══════════════════════════════════════════════════════════════════════════
// O CONTADOR DAS ESCRITURAS COMO MÁQUINA DE ESTADOS (brief landing v3, §4.2).
//
// Módulo PURO: recebe o que se sabe (fundo arrecadado, a altura do Bitcoin, o
// bloco B em que o fundo encheu) e devolve o estado e a copy da tela. Nenhum
// fetch, nenhum relógio, nenhum React: é o que o teste de vetores
// (mint-state.test.ts) exercita com dado simulado.
//
// Seis estados, um componente: A (enchendo), B0 (cheio, confirmando), B
// (fechado até o Founder), C (Founder), D (Whitelist), E (Partners), F (Public).
// O mesmo estado alimenta o herói, o botão vivo da navegação e, depois, a faixa
// global do site.
//
// ⚠️ A FASE É CALCULADA PELA MESMA FUNÇÃO DO MINTER. `phaseAt`, `phaseEnd` e
// `parseCalendar` abaixo são CÓPIA de dogcity-mint/packages/core/src/phase.ts
// (18/10/2026): o site e o minter não podem discordar sobre qual fase está
// aberta. Mudou lá, muda aqui; o teste de vetores pega a divergência de borda.
//
// ⚠️ B AINDA NÃO EXISTE. Entra por NEXT_PUBLIC_DOGCITY_MINT_B (vazia hoje): é o
// bloco em que o fundo de construção chegou a 10.000.000 $DOG. Quando o
// calendário for inscrito, a fonte passa a ser a inscrição; o calendário em
// blocos é sempre B+288, B+720, B+3.744 e B+4.032 (docs §7).
//
// ⚠️ NUNCA NÚMERO DE EXEMPLO EM PRODUÇÃO. Sem dado do fundo o estado é
// `connecting`: a tela mostra só a frase do estado A, sem número.
// ═══════════════════════════════════════════════════════════════════════════

export const FUND_GOAL = 10_000_000
export const TOTAL_LOTS = 70_714
/** confirmações de B antes de o calendário valer (estado B0 até lá) */
export const B_CONFIRMATIONS = 6
export const MINT_URL = "https://mint.dogcity.space"
export const MINT_HOST = "mint.dogcity.space"
export const CITY_URL = "https://dogcity.space"

/** deslocamentos do calendário a partir de B (docs §7) */
export const CAL_OFFSETS = { founder: 288, whitelist: 720, partner: 3744, public: 4032 } as const

// ── cópia de dogcity-mint/packages/core/src/phase.ts ─────────────────────────
export const PHASES = ["CLOSED", "FOUNDER", "WHITELIST", "PARTNER", "PUBLIC"] as const
export type Phase = (typeof PHASES)[number]

export interface Calendar {
  founderStart: number
  whitelistStart: number
  partnerStart: number
  publicStart: number
}

const isHeight = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0

export function parseCalendar(c: unknown): Calendar {
  if (typeof c !== "object" || c === null) throw new Error("calendário ausente")
  const o = c as Record<string, unknown>
  const keys = ["founderStart", "whitelistStart", "partnerStart", "publicStart"] as const
  for (const k of keys) if (!isHeight(o[k])) throw new Error(`calendário: ${k} inválido`)
  const v = keys.map((k) => o[k] as number)
  for (let i = 1; i < v.length; i++) if (v[i] <= v[i - 1]) throw new Error("calendário: alturas não crescem")
  return { founderStart: v[0], whitelistStart: v[1], partnerStart: v[2], publicStart: v[3] }
}

export function phaseAt(height: unknown, cal: Calendar): Phase {
  if (!isHeight(height)) return "CLOSED"
  if (height >= cal.publicStart) return "PUBLIC"
  if (height >= cal.partnerStart) return "PARTNER"
  if (height >= cal.whitelistStart) return "WHITELIST"
  if (height >= cal.founderStart) return "FOUNDER"
  return "CLOSED"
}

export function phaseEnd(phase: Phase, cal: Calendar): number {
  switch (phase) {
    case "CLOSED": return cal.founderStart
    case "FOUNDER": return cal.whitelistStart
    case "WHITELIST": return cal.partnerStart
    case "PARTNER": return cal.publicStart
    case "PUBLIC": return Infinity
  }
}
// ── fim da cópia ─────────────────────────────────────────────────────────────

export function calendarFromB(B: number): Calendar {
  return parseCalendar({
    founderStart: B + CAL_OFFSETS.founder,
    whitelistStart: B + CAL_OFFSETS.whitelist,
    partnerStart: B + CAL_OFFSETS.partner,
    publicStart: B + CAL_OFFSETS.public,
  })
}

/** B vindo de variável de ambiente pública; vazio ou inválido = ainda não existe */
export function parseB(raw: string | undefined | null): number | null {
  if (raw == null) return null
  const t = String(raw).trim().replace(/[,_\s]/g, "")
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return isHeight(n) && n > 0 ? n : null
}

// ── formatação: en-US, sempre por extenso, nunca "9.89M" ────────────────────
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US")

/** blocos x 10 min, sempre com "about" (brief §4.2) */
export function aboutBlocks(blocks: number): string {
  const min = Math.max(0, blocks) * 10
  if (min < 90) return `about ${Math.max(10, Math.round(min / 10) * 10)} minutes`
  const h = min / 60
  if (h < 72) return `about ${Math.round(h)} hours`
  return `about ${Math.round(h / 24)} days`
}

// ── o estado ────────────────────────────────────────────────────────────────
export type StateKind = "connecting" | "A" | "B0" | "B" | "C" | "D" | "E" | "F"

/** a régua das fases: cinco segmentos de LARGURA IGUAL (brief §4.2) */
export const RULER = [
  { phase: "CLOSED" as Phase, label: "CLOSED" },
  { phase: "FOUNDER" as Phase, label: "FOUNDER" },
  { phase: "WHITELIST" as Phase, label: "WHITELIST" },
  { phase: "PARTNER" as Phase, label: "PARTNERS" },
  { phase: "PUBLIC" as Phase, label: "PUBLIC" },
]

export interface CountdownInput {
  raised: number | null
  goal?: number | null
  B: number | null
  tip: number | null
  /** escrituras cunhadas (só o estado F usa; sem ele, F mostra o preço) */
  inscribed?: number | null
}

export interface Cta { label: string; href: string; external?: boolean }

export interface CountdownState {
  kind: StateKind
  /** id interno da fase (CLOSED, FOUNDER...) quando há calendário */
  phase: Phase | null
  label: string
  number: string | null
  unit: string | null
  sub: string | null
  h1: string
  primary: Cta
  secondary: Cta
  /** linha fina de Founder: só no estado A */
  founderLine: boolean
  /** o trilho: fundo (0..1) ou a régua das fases (0..1 em cinco segmentos iguais) */
  rail:
    | { mode: "connecting" }
    | { mode: "fund"; fraction: number; readout: string; full: boolean }
    | { mode: "phases"; fraction: number; current: number; readout: string }
  /** rótulo para leitor de tela do número */
  aria: string
  /** leitura compacta para a navegação (desktop e celular) */
  nav: { desktop: string; mobile: string; cta: string; href: string; external?: boolean }
  /** calendário absoluto quando B existe */
  calendar: Calendar | null
  B: number | null
  tip: number | null
}

const FIND: Cta = { label: "Find your lot", href: "#lookup" }
const ENTER: Cta = { label: "Enter the city", href: CITY_URL, external: true }
const CALENDAR: Cta = { label: "See the calendar", href: "#calendar" }
const MINT_AT: Cta = { label: `Mint at ${MINT_HOST}`, href: MINT_URL, external: true }

const H1_A = "At 10,000,000 $DOG the mint clock starts. Every lot in DogCity becomes a deed on Bitcoin."

const PHASE_NAME: Record<Phase, string> = {
  CLOSED: "CLOSED", FOUNDER: "FOUNDER", WHITELIST: "WHITELIST", PARTNER: "PARTNERS", PUBLIC: "PUBLIC",
}

function rulerFraction(phase: Phase, tip: number, cal: Calendar, B: number): { fraction: number; current: number } {
  const i = PHASES.indexOf(phase)
  if (phase === "PUBLIC") return { fraction: 1, current: i }
  const start = phase === "CLOSED" ? B : [cal.founderStart, cal.whitelistStart, cal.partnerStart][i - 1]
  const end = phaseEnd(phase, cal)
  const within = Math.max(0, Math.min(1, (tip - start) / Math.max(1, end - start)))
  return { fraction: (i + within) / PHASES.length, current: i }
}

export function countdownState(input: CountdownInput): CountdownState {
  const goal = input.goal && input.goal > 0 ? input.goal : FUND_GOAL
  const { raised, B, tip } = input
  const base = { calendar: null as Calendar | null, B, tip }

  // ── B conhecido: o calendário manda (o fundo encheu, por definição) ──
  if (B != null) {
    const cal = calendarFromB(B)
    const conf = tip != null ? tip - B + 1 : null
    if (tip == null || conf == null || conf < B_CONFIRMATIONS) return stateB0(goal, raised, { ...base, calendar: cal }, B)
    const phase = phaseAt(tip, cal)
    const ruler = rulerFraction(phase, tip, cal, B)
    const rail = { mode: "phases" as const, ...ruler, readout: `BLOCK ${fmtInt(tip)}` }
    const common = { ...base, calendar: cal, phase, rail, founderLine: false }
    if (phase === "CLOSED") {
      const left = cal.founderStart - tip
      return {
        ...common, kind: "B",
        label: `FUND FULL AT BLOCK ${fmtInt(B)}`,
        number: fmtInt(left), unit: "BLOCKS TO THE FOUNDER MINT",
        sub: `${aboutBlocks(left)} · opens at block ${fmtInt(cal.founderStart)}`,
        h1: "Founders mint first, free. Then every wallet with a lot mints its own.",
        primary: FIND, secondary: CALENDAR,
        aria: `${fmtInt(left)} blocks to the Founder mint, which opens at block ${fmtInt(cal.founderStart)}`,
        nav: { desktop: `MINT OPENS IN ${fmtInt(left)} BLOCKS`, mobile: `${fmtInt(left)} BLOCKS`, cta: "FIND MY LOT", href: "#lookup" },
      }
    }
    const end = phaseEnd(phase, cal)
    const open = (name: string) => ({
      desktop: `${name} PHASE OPEN · MINT`, mobile: `${name} OPEN`, cta: "MINT", href: MINT_URL, external: true,
    })
    if (phase === "FOUNDER") {
      const left = end - tip
      return {
        ...common, kind: "C", label: "FOUNDER PHASE · OPEN",
        number: fmtInt(left), unit: "BLOCKS LEFT FOR FOUNDERS",
        sub: `${aboutBlocks(left)} · ends at block ${fmtInt(end)}`,
        h1: `Founders are minting their own lots free. The Whitelist opens at block ${fmtInt(cal.whitelistStart)}, from US$1 a lot.`,
        primary: MINT_AT, secondary: FIND,
        aria: `Founder phase open, ${fmtInt(left)} blocks left for Founders`,
        nav: open("FOUNDER"),
      }
    }
    if (phase === "WHITELIST") {
      const left = end - tip
      return {
        ...common, kind: "D", label: "WHITELIST · OPEN",
        number: fmtInt(left), unit: "BLOCKS LEFT TO CLAIM YOUR LOT",
        sub: `${aboutBlocks(left)} · ends at block ${fmtInt(end)}`,
        h1: `Every wallet with a lot at block 966,670 mints its own lot at half its public price, from US$1. Unclaimed lots go on sale at block ${fmtInt(cal.partnerStart)}.`,
        primary: { label: "Mint your lot", href: MINT_URL, external: true }, secondary: FIND,
        aria: `Whitelist open, ${fmtInt(left)} blocks left to claim your lot`,
        nav: open("WHITELIST"),
      }
    }
    if (phase === "PARTNER") {
      const left = end - tip
      return {
        ...common, kind: "E", label: "PARTNERS · OPEN",
        number: fmtInt(left), unit: "BLOCKS TO THE PUBLIC MINT",
        sub: `${aboutBlocks(left)} · the public mint opens at block ${fmtInt(end)}`,
        h1: "Holders of partner collections mint unclaimed lots, each priced by its tier and size.",
        primary: MINT_AT, secondary: FIND,
        aria: `Partners phase open, ${fmtInt(left)} blocks to the public mint`,
        nav: open("PARTNERS"),
      }
    }
    // PUBLIC
    const ins = input.inscribed
    const hasCount = typeof ins === "number" && Number.isFinite(ins) && ins >= 0
    // a contagem fica sozinha no número; "/ 70,714" desce para a unidade (o número
    // grande não pode carregar 15 caracteres)
    return {
      ...common, kind: "F", label: "PUBLIC MINT · OPEN",
      number: hasCount ? fmtInt(ins as number) : "US$2",
      unit: hasCount ? `/ ${fmtInt(TOTAL_LOTS)} DEEDS INSCRIBED` : "AND UP · BY TIER AND SIZE",
      sub: null,
      h1: "Anyone mints any unclaimed lot from US$2, priced by its tier and size, up to 10 lots per wallet every 144 blocks.",
      primary: MINT_AT, secondary: FIND,
      aria: hasCount
        ? `Public mint open, ${fmtInt(ins as number)} of ${fmtInt(TOTAL_LOTS)} deeds inscribed`
        : "Public mint open, from US$2 a lot",
      nav: open("PUBLIC"),
    }
  }

  // ── B desconhecido ──
  if (raised == null || !Number.isFinite(raised)) {
    return {
      // sem dado ainda: nada de "LIVE" (não há nada vivo para mostrar)
      ...base, kind: "connecting", phase: null,
      label: "THE DEED COUNTDOWN", number: null, unit: null, sub: null,
      h1: H1_A, primary: FIND, secondary: ENTER, founderLine: true,
      rail: { mode: "connecting" },
      aria: "Connecting to the construction fund",
      nav: { desktop: "FIND YOUR LOT", mobile: "", cta: "FIND MY LOT", href: "#lookup" },
    }
  }
  if (raised >= goal) return stateB0(goal, raised, base, null)

  // A: quanto falta. Arredonda o que falta PARA CIMA e a porcentagem PARA BAIXO:
  // a tela nunca diz que falta menos, nem que encheu, antes de ser verdade.
  const toGo = Math.ceil(goal - raised)
  const pct = Math.floor((raised / goal) * 10000) / 100
  const pctTxt = pct.toFixed(2)
  return {
    ...base, kind: "A", phase: null,
    label: "THE DEED COUNTDOWN · LIVE",
    number: fmtInt(toGo), unit: "$DOG TO GO", sub: null,
    h1: H1_A, primary: FIND, secondary: ENTER, founderLine: true,
    rail: {
      mode: "fund", fraction: Math.max(0, Math.min(1, raised / goal)), full: false,
      readout: `${fmtInt(Math.floor(raised))} / ${fmtInt(goal)} $DOG · ${pctTxt}%`,
    },
    aria: `${fmtInt(toGo)} $DOG to go, ${pctTxt}% of ${fmtInt(goal)}`,
    nav: { desktop: `${fmtInt(toGo)} $DOG TO GO · FIND YOUR LOT`, mobile: `${fmtInt(toGo)} TO GO`, cta: "FIND MY LOT", href: "#lookup" },
  }
}

function stateB0(goal: number, raised: number | null, base: { calendar: Calendar | null; B: number | null; tip: number | null }, B: number | null): CountdownState {
  // o número é o valor REAL arrecadado (que passa da meta), nunca a meta escrita como se
  // fosse o arrecadado; sem o dado do fundo, só a unidade diz que a meta foi atingida
  const real = raised != null && Number.isFinite(raised) ? Math.floor(raised) : null
  return {
    ...base, kind: "B0", phase: null,
    label: "THE FUND IS FULL",
    number: real != null ? fmtInt(real) : null,
    unit: real != null ? "$DOG RAISED · GOAL REACHED" : "GOAL REACHED",
    sub: B != null ? `filled at block ${fmtInt(B)}` : null,
    h1: "The construction fund is full. The mint calendar is set from the block that filled it.",
    primary: FIND, secondary: CALENDAR, founderLine: false,
    rail: {
      mode: "fund", fraction: 1, full: true,
      readout: `${fmtInt(Math.max(goal, Math.floor(raised ?? goal)))} / ${fmtInt(goal)} $DOG · 100.00%`,
    },
    aria: real != null ? `The construction fund is full: ${fmtInt(real)} $DOG raised, goal ${fmtInt(goal)}` : "The construction fund is full",
    nav: { desktop: "THE FUND IS FULL · FIND YOUR LOT", mobile: "FUND FULL", cta: "FIND MY LOT", href: "#lookup" },
  }
}

/** as cinco fases do calendário, com o bloco absoluto quando B existe (brief §4.6) */
export function calendarRows(B: number | null) {
  const cal = B != null ? calendarFromB(B) : null
  return [
    { phase: "CLOSED" as Phase, name: "CLOSED", span: "B to B+288 · about 48 hours", price: null,
      text: "Nobody mints. The Founder list is cut at block B and published for review.",
      startsAt: B },
    { phase: "FOUNDER" as Phase, name: "FOUNDER", span: "B+288 to B+720 · about 3 days", price: "FREE",
      text: "Founders mint their own lot, paying only the network fee and postage.",
      startsAt: cal?.founderStart ?? null },
    { phase: "WHITELIST" as Phase, name: "WHITELIST", span: "B+720 to B+3,744 · about 21 days", price: "FROM US$1",
      text: "Every wallet with a lot mints its own lot at half its public price.",
      startsAt: cal?.whitelistStart ?? null },
    { phase: "PARTNER" as Phase, name: "PARTNERS", span: "B+3,744 to B+4,032 · about 48 hours", price: "FROM US$2",
      text: "Holders of partner collections mint unclaimed lots, priced by tier and size.",
      startsAt: cal?.partnerStart ?? null },
    { phase: "PUBLIC" as Phase, name: "PUBLIC", span: "From B+4,032", price: "FROM US$2",
      text: "Anyone mints any unclaimed lot, priced by tier and size, up to 10 per wallet every 144 blocks.",
      startsAt: cal?.publicStart ?? null },
  ]
}
