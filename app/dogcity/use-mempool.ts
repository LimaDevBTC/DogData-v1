"use client"

// O FEED DA MEMPOOL DO DOG, num lugar só.
//
// Nasceu dentro de sections/plaza-live.tsx e saiu de lá quando a faixa viva do
// topo (praca-ajustes.md item 6) passou a ler o mesmo feed: duas cópias do mesmo
// polling significariam duas verdades na mesma página, e a página inteira tem
// que dizer o mesmo número.
//
// Lê /api/mempool/dog, que serve o que o NOSSO nó vê: quantas transações de DOG
// estão em órbita, quanto DOG elas carregam, e qual foi o último pouso. Se o
// feed calar por dois minutos, quem consome mostra SYNCING, não LIVE.
//
// ⚠️ POR QUE ISTO É UM SINGLETON DE MÓDULO, e não um hook com useEffect por
// consumidor. Até 27/08 a landing rodava DUAS enquetes de 20 s sem ninguém ter
// notado: a MempoolBand importava daqui e plaza-live.tsx tinha uma CÓPIA COLADA
// do hook (linhas 97-125 de lá). Com a hero nova são TRÊS consumidores na mesma
// tela, e um hook por consumidor viraria três batidas de 20 s no mesmo endpoint.
// Depois do incidente de IO de 26/08 isso não passa.
//
// Aqui existe um timer só, um Set de assinantes e um snapshot compartilhado. O
// primeiro assinante liga o ciclo e o último a desmontar desliga. Quem monta
// depois recebe o snapshot corrente NA HORA, sem esperar o próximo tick: é por
// isso que a hero nasce com número em vez de "Reading the node." piscando.
import { useEffect, useState } from "react"

export interface MempoolSnapshot {
  updated_at: string
  tx_count: number
  fee_fast: number | null
  fee_slow: number | null
  tip_height: number | null
  // ⚠️ A ROTA SEMPRE SERVIU tip_hash (route.ts:118) e esta interface não o
  // declarava, então ele chegava e era descartado pelo TypeScript. Ele entrou
  // aqui em 04/09 porque o estado pós snapshot de sections/snapshot.tsx publica
  // o hash do bloco alvo: é o que transforma "a Bitcoin block is Bitcoin's
  // word" de retórica em um dado que qualquer pessoa confere contra o próprio
  // nó, sem depender de nós.
  tip_hash: string | null
  dog_pending: number
  dog_pending_amount: number
  last_dog_block: number | null
  last_dog_block_time: string | null
  last_dog_block_count: number | null
  last_dog_block_amount: number | null
}

export interface MempoolFeed {
  snapshot: MempoolSnapshot | null
  stale_seconds: number | null
  landed?: unknown[]
}

export const MEMPOOL_POLL_MS = 20_000
export const MEMPOOL_STALE_S = 120

export interface MempoolState {
  feed: MempoolFeed | null
  now: number
}

// ── o estado compartilhado ─────────────────────────────────────────────────
// `estado` é trocado por um objeto NOVO a cada tick de propósito: os assinantes
// guardam a referência em useState e comparam por identidade, então mutar o
// objeto no lugar não re-renderizaria ninguém.
let estado: MempoolState = { feed: null, now: 0 }
const assinantes = new Set<(s: MempoolState) => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let rodando = false

function publica(s: MempoolState) {
  estado = s
  // forEach e não for..of: o target do tsconfig deste projeto é anterior a
  // es2015 e iterar Set exigiria downlevelIteration.
  assinantes.forEach((fn) => fn(s))
}

async function tick() {
  try {
    const r = await fetch("/api/mempool/dog", { cache: "no-store" })
    if (r.ok) {
      const j = (await r.json()) as MempoolFeed
      publica({ feed: j, now: Date.now() })
    } else {
      // mantém a última leitura; a idade a leva para SYNCING sozinha
      publica({ feed: estado.feed, now: Date.now() })
    }
  } catch {
    publica({ feed: estado.feed, now: Date.now() })
  }
  if (rodando) timer = setTimeout(() => void tick(), MEMPOOL_POLL_MS)
}

function liga() {
  if (rodando) return
  rodando = true
  void tick()
}

function desliga() {
  rodando = false
  if (timer) clearTimeout(timer)
  timer = null
}

export function useMempoolFeed(): MempoolState {
  // primeiro quadro = o snapshot que já existe no módulo. Um consumidor que
  // monta com a página já viva não passa por um estado vazio.
  const [s, setS] = useState<MempoolState>(estado)
  useEffect(() => {
    assinantes.add(setS)
    liga()
    // se o ciclo já estava rodando, o valor corrente pode ser mais novo do que
    // o capturado no useState inicial
    setS(estado)
    return () => {
      assinantes.delete(setS)
      if (assinantes.size === 0) desliga()
    }
  }, [])
  return s
}

export function minutesAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "—"
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (m < 1) return "just now"
  if (m === 1) return "1 min ago"
  if (m < 90) return `${m} min ago`
  const h = Math.round(m / 60)
  return `${h} h ago`
}
