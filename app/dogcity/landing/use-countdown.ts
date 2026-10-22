"use client"

// O contador vivo: junta o fundo (/api/donate/leaderboard?slim=1, a cada 60 s), a
// altura do Bitcoin (o feed único de ../use-mempool.ts) e o detector do bloco B
// (/api/dogcity/mint-b, a cada 30 s) e entrega o estado da máquina pura de
// ./mint-state.ts. Uma fonte para o herói, o botão vivo da navegação e o calendário.
//
// A TROCA É SOZINHA, SEM REDEPLOY: status "filling" = contador do fundo; "full_unconfirmed"
// = THE FUND IS FULL (B ainda provisório, não entra na conta); "set" = contador do mint
// (B definitivo, 6 confirmações, congelado). Em "set" o detector para de ser consultado.
// A variável pública NEXT_PUBLIC_DOGCITY_MINT_B, quando preenchida, vale como SOBREPOSIÇÃO
// MANUAL e o detector nem é consultado.
//
// ⚠️ SIMULAÇÃO SÓ NO DEV. `?mintsim=A|B0|B|C|D|E|F|Fcount|connecting` troca a entrada
// por dado simulado para conferir os seis estados na tela. O ramo inteiro some
// do build de produção (NODE_ENV é substituído em tempo de compilação), então
// nunca há número de exemplo em produção.

import { useEffect, useMemo, useState } from "react"
import { useMempoolFeed } from "../use-mempool"
import { countdownState, parseB, parseMintB, FUND_GOAL, type CountdownInput, type CountdownState, type MintBInfo } from "./mint-state"

const B_ENV = parseB(process.env.NEXT_PUBLIC_DOGCITY_MINT_B)
const FUND_POLL_MS = 60_000
const MINT_B_POLL_MS = 30_000

export interface FundData { raised: number; goal: number }

function useFund(initial: FundData | null): FundData | null {
  // o primeiro valor vem do servidor (page.tsx), para o número já estar no HTML
  const [fund, setFund] = useState<FundData | null>(initial)
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          // ⚠️ r.ok E a forma são obrigatórios (incidente de 26/08: 503 com { error })
          const r = await fetch("/api/donate/leaderboard?slim=1", { signal: AbortSignal.timeout(10_000) })
          const j = r.ok ? await r.json() : null
          if (alive && j && typeof j.total_received === "number" && Number.isFinite(j.total_received)) {
            setFund({ raised: j.total_received, goal: typeof j.goal === "number" && j.goal > 0 ? j.goal : FUND_GOAL })
          }
        } catch { /* mantém a última leitura */ }
      }
      if (alive) timer = setTimeout(tick, FUND_POLL_MS)
    }
    void tick()
    const onVis = () => { if (document.visibilityState === "visible" && timer) { clearTimeout(timer); void tick() } }
    document.addEventListener("visibilitychange", onVis)
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis) }
  }, [])
  return fund
}

/**
 * O detector do bloco B. Só consulta quando a variável manual está vazia; para de
 * perguntar quando a resposta é `set` (B congelado, nada mais muda). Antes disso segue
 * perguntando a cada 30 s, porque uma reorg ainda pode desfazer o cruzamento. Falha de
 * rede, 503 ou forma estranha mantém a última leitura.
 */
const MINTER_POLL_MS = 30_000

/** `accepting` do minter, lido pela rota do servidor (/api/dogcity/minter). null até a primeira leitura boa ou em erro. */
interface MinterRead { accepting: boolean | null; claimed: number | null; inscribed: number | null }
const num = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null)

function useMinterAccepting(): MinterRead {
  const [accepting, setAccepting] = useState<MinterRead>({ accepting: null, claimed: null, inscribed: null })
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/dogcity/minter", { signal: AbortSignal.timeout(10_000) })
          const j = r.ok ? ((await r.json()) as { accepting?: unknown; claimed?: unknown; inscribed?: unknown }) : null
          if (alive) setAccepting(j ? { accepting: typeof j.accepting === "boolean" ? j.accepting : null, claimed: num(j.claimed), inscribed: num(j.inscribed) } : { accepting: null, claimed: null, inscribed: null })
        } catch { if (alive) setAccepting({ accepting: null, claimed: null, inscribed: null }) }
      }
      if (alive) timer = setTimeout(tick, MINTER_POLL_MS)
    }
    void tick()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [])
  return accepting
}

function useMintB(manual: number | null, initial: MintBInfo | null): MintBInfo | null {
  // parte da leitura do servidor (page.tsx): a primeira pintura já sabe B e a ponta
  const [info, setInfo] = useState<MintBInfo | null>(initial)
  useEffect(() => {
    if (manual != null) return
    if (initial?.status === "set") return   // B congelado: nada mais muda (a ponta viva vem do feed)
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      let done = false
      if (document.visibilityState === "visible") {
        try {
          // ⚠️ r.ok E a forma são obrigatórios (incidente de 26/08: 503 com { error })
          const r = await fetch("/api/dogcity/mint-b", { signal: AbortSignal.timeout(10_000) })
          const next = r.ok ? parseMintB(await r.json()) : null
          if (alive && next) {
            setInfo(next)
            done = next.status === "set"
          }
        } catch { /* mantém a última leitura */ }
      }
      if (alive && !done) timer = setTimeout(tick, MINT_B_POLL_MS)
    }
    void tick()
    const onVis = () => { if (document.visibilityState === "visible" && timer) { clearTimeout(timer); void tick() } }
    document.addEventListener("visibilitychange", onVis)
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual])
  return useMemo(() => (manual != null ? { status: "set" as const, B: manual, raised: null, tip: initial?.tip ?? null } : info), [manual, info, initial])
}

function simulated(): CountdownInput | null {
  if (process.env.NODE_ENV === "production") return null
  if (typeof window === "undefined") return null
  const k = new URLSearchParams(window.location.search).get("mintsim")
  if (!k) return null
  const B = 971_900
  const map: Record<string, CountdownInput> = {
    connecting: { raised: null, B: null, tip: null },
    A: { raised: 9_887_345.6, B: null, tip: 971_954 },
    B0: { raised: 10_000_250, B: null, tip: 971_954 },
    B: { raised: 10_000_250, B, tip: B + 76 },
    C: { raised: null, B, tip: B + 380 },
    D: { raised: null, B, tip: B + 854 },
    E: { raised: null, B, tip: B + 3852 },
    F: { raised: null, B, tip: B + 4100 },
    Fcount: { raised: null, B, tip: B + 4100, inscribed: 18_342 },
  }
  return map[k] ?? null
}

export function useCountdown(initialFund: FundData | null = null, initialMintB: MintBInfo | null = null): CountdownState {
  const fund = useFund(initialFund)
  const mintB = useMintB(B_ENV, initialMintB)
  const minter = useMinterAccepting()
  const { feed } = useMempoolFeed()
  const feedTip = feed?.snapshot?.tip_height ?? null
  const [sim, setSim] = useState<CountdownInput | null>(null)
  useEffect(() => { setSim(simulated()) }, [])
  return useMemo(() => {
    if (sim) return countdownState(sim)
    // B só entra com status "set". Em full_unconfirmed o B da API é provisório: a tela diz
    // THE FUND IS FULL e o total vem do maior entre o placar e o detector.
    const fundFull = mintB?.status === "full_unconfirmed"
    const raised = fundFull || mintB?.status === "set"
      ? Math.max(fund?.raised ?? 0, mintB?.raised ?? 0) || null
      : fund?.raised ?? null
    // a ponta do feed é a viva; a do detector segura quando o feed ainda não chegou
    const tip = feedTip != null && mintB?.tip != null ? Math.max(feedTip, mintB.tip) : feedTip ?? mintB?.tip ?? null
    return countdownState({ raised, goal: fund?.goal ?? FUND_GOAL, B: mintB?.status === "set" ? mintB.B : null, tip, fundFull,
      minterAccepting: minter.accepting, claimed: minter.claimed, inscribed: minter.inscribed })
  }, [sim, fund, feedTip, mintB, minter])
}
