"use client"

// /dogcity/ranking (servida em dogcity.space/ranking): o ranking publico dos DC Points. A casca e as regras vao no HTML; as
// linhas vem de /api/game/points/ranking (publica, com cache). O filtro (aba e periodo) mora na URL (?board=&period=), sem
// recarregar a pagina. A tela mesma e' ranking-view.tsx; ver o cabecalho dela para as regras do texto.

import { useCallback, useEffect, useState } from "react"
import { CityLayout } from "../city-layout"
import { RankingView, type RankingState } from "./ranking-view"
import { parseRankingQuery, type Board, type Period, type PublicRanking } from "@/lib/game/points/ranking"

export default function DogCityRankingPage() {
  const [board, setBoard] = useState<Board>("total")
  const [period, setPeriod] = useState<Period>("all")
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<RankingState>({ status: "loading" })

  // o estado inicial vem da URL (link compartilhado abre na aba certa)
  useEffect(() => {
    const q = parseRankingQuery(new URLSearchParams(window.location.search))
    setBoard(q.board)
    setPeriod(q.period)
    setReady(true)
  }, [])

  const pick = useCallback((b: Board, p: Period) => {
    setBoard(b)
    setPeriod(p)
    const url = new URL(window.location.href)
    url.searchParams.set("board", b)
    url.searchParams.set("period", p)
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
  }, [])

  useEffect(() => {
    if (!ready) return
    let vivo = true
    setState({ status: "loading" })
    fetch(`/api/game/points/ranking?board=${board}&period=${period}&limit=100&me=1`, { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<PublicRanking>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => { if (vivo) setState({ status: "ready", data }) })
      .catch(() => { if (vivo) setState({ status: "error" }) })
    return () => { vivo = false }
  }, [ready, board, period])

  return (
    <CityLayout>
      <RankingView state={state} board={board} period={period} onBoard={(b) => pick(b, period)} onPeriod={(p) => pick(board, p)} />
    </CityLayout>
  )
}
