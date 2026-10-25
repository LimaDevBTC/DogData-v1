"use client"

// /dogcity/referrals (servida em dogcity.space/referrals): o placar publico do referral, fase 1: so contar.
// A casca e as regras vao no HTML; as linhas vem de /api/referral/board (cache de CDN, barata).
// A tela mesma e' board-view.tsx; ver o cabecalho dela para as regras do texto.

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout"
import { ReferralBoardView, type BoardState } from "./board-view"
import type { PublicBoard } from "@/lib/referral/board"

export default function DogCityReferralsPage() {
  const [state, setState] = useState<BoardState>({ status: "loading" })
  useEffect(() => {
    let vivo = true
    fetch("/api/referral/board")
      .then((r) => (r.ok ? (r.json() as Promise<PublicBoard>) : Promise.reject(new Error(String(r.status)))))
      .then((board) => { if (vivo) setState({ status: "ready", board }) })
      .catch(() => { if (vivo) setState({ status: "error" }) })
    return () => { vivo = false }
  }, [])

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <ReferralBoardView state={state} />
    </Layout>
  )
}
