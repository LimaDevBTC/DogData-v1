"use client"

// O RESUMO VIVO DA GENEALOGIA, pedido UMA vez por carregamento.
//
// /api/holders/tree/summary devolve os agregados da raiz da árvore (duas
// leituras de índice no Supabase, cache de 10 min na borda). A landing tem dois
// consumidores dele: a porta 03 da hero e a seção $DOG Galaxy mais abaixo.
//
// ⚠️ POR QUE UM CACHE DE PROMESSA no escopo do módulo, e não um fetch por
// componente. Depois do incidente de IO de 26/08 nenhuma tela desta casa bate
// duas vezes na mesma rota de Supabase por carregamento. Aqui o primeiro
// consumidor dispara a chamada, os outros recebem a MESMA promessa, e o
// resultado fica guardado para quem montar depois (a seção Galaxy monta bem
// depois da hero, quando a pessoa rola).
//
// ⚠️ SEM DADO, NUNCA ZERO. Quem consome cai nas constantes GALAXY de
// ../dogcity-data, que são o primeiro quadro honesto: a árvore só cresce, então
// o número envelhece PARA BAIXO e nunca vira mentira.
//
// A guarda de forma é obrigatória e não é paranoia: no incidente de 26/08 uma
// rota devolveu corpo `{ error }`, o objeto passou pelo guard de null e um
// .toLocaleString() de campo inexistente derrubou a árvore de componentes
// inteira (tela preta em produção).
import { useEffect, useState } from "react"

export interface TreeSummary {
  wallets: number
  holders: number
  directChildren: number
}

let pendente: Promise<TreeSummary | null> | null = null

function busca(): Promise<TreeSummary | null> {
  if (pendente) return pendente
  pendente = fetch("/api/holders/tree/summary", { signal: AbortSignal.timeout(9000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && typeof j.wallets === "number" && j.wallets > 0 && typeof j.holders === "number") {
        return { wallets: j.wallets, holders: j.holders, directChildren: Number(j.directChildren) || 0 }
      }
      return null
    })
    .catch(() => null)
  return pendente
}

export function useTreeSummary(): TreeSummary | null {
  const [v, setV] = useState<TreeSummary | null>(null)
  useEffect(() => {
    let vivo = true
    void busca().then((s) => {
      if (vivo && s) setV(s)
    })
    return () => {
      vivo = false
    }
  }, [])
  return v
}
