import { allIdentities, resolveIdentities, type Identity } from '@/lib/dog/identity'
import {
  NODE_SELECT,
  ROOT_WALLET,
  fetchNodesPaged,
  rowToNode,
  supabase,
  type No,
} from '../_shared'

/**
 * Agregacao do painel Flow (sankey por geracao), 100% no servidor.
 *
 * A fonte dos LINKS e dog_flows (fluxo TOTAL por par src->dst). A genealogia
 * entra so como metadado do no (saldo, is_holder, subtree, depth) e NUNCA como
 * fluxo: o fio genealogico e a primeira chegada, nao o quanto andou.
 *
 * dog_flows ainda esta em backfill, entao tudo aqui trata a tabela como
 * possivelmente parcial e a resposta declara isso em meta.flows.
 */

// ── contrato de resposta ────────────────────────────────────────────────────

export type LabelCat = 'exchange' | 'vault' | 'mm' | 'distributor' | 'other'

export interface FlowLabel {
  name: string
  cat: LabelCat
  source: 'dogdata' | 'verified'
}

export interface FlowNode {
  w: string
  gen: number
  b: number
  in: number
  out: number
  /** fracao ainda retida: b/in com teto 1 (sem entrada medida, 1 se ha saldo) */
  held_pct: number
  h: boolean
  c: number
  sw: number
  sh: number
  sb: number
  label: FlowLabel | null
}

export interface RestNode {
  id: string
  gen: number
  kind: 'holders' | 'spent'
  n: number
  b: number
  in: number
  out: number
}

export interface FlowLink {
  s: string
  t: string
  dog: number
  txs: number
  fb: number
  lb: number
  back?: true
}

export interface FlowCol {
  gen: 0 | 1 | 2 | 3 | 4
  label: string
  nodes: FlowNode[]
  rest: RestNode[]
}

export interface FlowStats {
  wallets: number
  coverage_gap_pct: 0
  direct_children: number
  holding_pct: number
  exchange_dog: number
  exchange_pct_supply: number
}

export interface FlowMeta {
  root: string
  generated_at: string
  flows: 'complete' | 'partial'
  min: number
  active: ActiveWindow
  truncated_links: number
  total_links_considered: number
}

export interface FlowResponse {
  root: FlowNode
  cols: FlowCol[]
  links: FlowLink[]
  ghost: { w: string; label: string } | null
  stats: FlowStats
  meta: FlowMeta
}

export type ActiveWindow = 'all' | '90d' | '30d'

export interface FlowParams {
  root: string
  expand: string[]
  min: number
  active: ActiveWindow
  mobile: boolean
}

// ── calibracao ──────────────────────────────────────────────────────────────

const TOTAL_SUPPLY = 100_000_000_000

// Teto de linhas de dog_flows lidas por nivel do BFS. A raiz sozinha tem
// 75.487 pares de saida (medido 2026-08-26); ler tudo e inviavel numa rota,
// entao cada nivel le o topo por total_dog e declara o resto em
// meta.truncated_links (a contagem exata vem de graca no count do PostgREST).
const LEVEL_ROW_CAP = 4000

// Quantas carteiras de um nivel viram src do nivel seguinte. Cada uma vira
// UMA consulta indexada (ver fetchFlowsForSrc); 24 em lotes de 6 paralelos
// cabem no orcamento de tempo da rota e cobrem com folga os 12 nos nomeados
// que a coluna desenha.
const FRONTIER_CAP = 24

// Enderecos por consulta in.() nas CONTAGENS de dog_flows (so contagem, sem
// order by). Para os DADOS o in.() nao serve: in.() + order by total_dog
// global vira bitmap de todas as linhas dos srcs + sort, e basta um hub
// (Kraken hot tem dezenas de milhares de pares) para estourar o statement
// timeout (medido 2026-08-26). Dados vao um src por consulta.
const SRC_CHUNK = 25

// Join de metadados na genealogia: so o topo por DOG movimentado entra, em
// blocos de 100 enderecos (~6,4KB de URL). Carteira fora do join nao tem
// saldo conhecido e cai no resto "spent" (segurar e afirmacao positiva, so
// se afirma com o saldo na mao).
const JOIN_CAP = 3200
const JOIN_CHUNK = 100

// Tetos do desenho, da spec: 12 nos nomeados por coluna no desktop (48 no
// total), 6 no mobile (24), e 120 links.
const LINK_CAP = 120

// Janelas de atividade por last_block: ~144 blocos/dia.
const BLOCKS_90D = 12_960
const BLOCKS_30D = 4_320

// Heuristica da spec para meta.flows: menos de 1000 pares com src na raiz
// significa que o backfill ainda nao chegou la.
const FLOWS_COMPLETE_MIN_ROWS = 1000

// ── linha crua de dog_flows ─────────────────────────────────────────────────

interface FlowRow {
  src: string
  dst: string
  total_dog: number | string | null
  tx_count: number | null
  first_block: number | null
  last_block: number | null
}

const FLOW_SELECT = 'src, dst, total_dog, tx_count, first_block, last_block'

/**
 * Le ate `cap` linhas de dog_flows de UM src, do maior fluxo para o menor,
 * paginando em 1000 (max-rows do projeto). Um src por consulta e a forma que
 * o indice (src, total_dog DESC) atende como varredura pura com limite, sem
 * no de sort; foi a unica forma que sobreviveu ao statement timeout sob a
 * carga de escrita do backfill (medido 2026-08-26).
 *
 * Ordem secundaria por dst: total_dog empata (varios pares de mesmo valor) e
 * sem desempate a paginacao embaralha entre paginas, o que quebraria o
 * layout deterministico que a tela exige.
 */
async function fetchFlowsForSrc(src: string, cutoff: number | null, cap: number): Promise<FlowRow[]> {
  const PAGE = 1000
  const rows: FlowRow[] = []
  let offset = 0
  while (rows.length < cap) {
    const to = Math.min(offset + PAGE, cap) - 1
    const page = await retryOnce(async () => {
      let q: any = supabase.from('dog_flows').select(FLOW_SELECT).eq('src', src)
      if (cutoff !== null) q = q.gte('last_block', cutoff)
      const { data, error } = await q
        .order('total_dog', { ascending: false })
        .order('dst', { ascending: true })
        .range(offset, to)
      if (error) throw new Error(error.message)
      return (data ?? []) as FlowRow[]
    })
    rows.push(...page)
    if (page.length < to - offset + 1) break
    offset += PAGE
  }
  return rows.slice(0, cap)
}

/**
 * Quantos pares de dog_flows saem do conjunto de srcs, alem do que a janela
 * leu: alimenta truncated_links e total_links_considered. Sem order by a
 * contagem e so um bitmap, bem mais leve que os dados; ainda assim ela NUNCA
 * derruba o nivel: exata, depois estimada (via headCount), e falhando as
 * duas devolve `fallback` (o que foi de fato lido, o minimo honesto).
 */
async function countFlowsFrom(srcs: string[], cutoff: number | null, fallback: number): Promise<number> {
  try {
    const parts = await inBatches(chunk(srcs, SRC_CHUNK), (c) =>
      headCount((mode, head) => {
        let q: any = supabase.from('dog_flows').select('src', { count: mode, head }).in('src', c)
        if (cutoff !== null) q = q.gte('last_block', cutoff)
        return q.limit(1)
      }),
    )
    const total = parts.reduce((a, b) => a + b, 0)
    return Math.max(total, fallback)
  } catch {
    return fallback
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Concorrencia com teto. O join de metadados pode virar 32 consultas; atirar
// todas de uma vez satura o pooler do PostgREST (medido 2026-08-26: a rajada
// derrubou ate um eq. indexado em "upstream request timeout"). Seis por vez
// mantem a rota rapida sem sufocar o banco.
const PARALLEL = 6
async function inBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (const batch of chunk(items, PARALLEL)) {
    out.push(...(await Promise.all(batch.map(fn))))
  }
  return out
}

/**
 * Uma repeticao unica com pausa curta. O gateway do Supabase derruba chamadas
 * avulsas nos picos de escrita do backfill ("upstream request timeout" ate em
 * consulta indexada de uma linha, medido 2026-08-26); o pico dura segundos,
 * entao repetir UMA vez resolve o transitorio, e mais que isso so estica a
 * rota alem do orcamento de tempo dela.
 */
export async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    await new Promise((r) => setTimeout(r, 400))
    return await fn()
  }
}

/**
 * Traduz o vocabulario fechado de lib/dog/taxonomy.ts para as 5 categorias de
 * cor do sankey. vault junta o que tranca (tesouraria, ponte, burn), mm junta
 * quem gira inventario (desk, pool, marketplace).
 */
function catFromKind(kind: string | null): LabelCat {
  switch (kind) {
    case 'exchange':
      return 'exchange'
    case 'treasury':
    case 'bridge':
    case 'burn':
      return 'vault'
    case 'desk':
    case 'swap_pool':
    case 'marketplace':
      return 'mm'
    case 'distributor':
      return 'distributor'
    default:
      return 'other'
  }
}

export function toFlowLabel(id: Identity | null | undefined): FlowLabel | null {
  if (!id) return null
  return {
    name: id.name,
    cat: catFromKind(id.kind),
    source: id.source === 'verified' ? 'verified' : 'dogdata',
  }
}

/** bc1q…x7f2, o truncamento padrao da casa. */
export function shortAddr(w: string): string {
  return w.length <= 12 ? w : `${w.slice(0, 5)}…${w.slice(-4)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function fetchGenealogyOne(wallet: string): Promise<No | null> {
  return retryOnce(async () => {
    const { data, error } = await supabase
      .from('dog_genealogy')
      .select(NODE_SELECT)
      .eq('wallet', wallet)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? rowToNode(data as any) : null
  })
}

type CountMode = 'exact' | 'estimated'
type CountResult = PromiseLike<{ count: number | null; error: { message: string } | null }>

/**
 * Contagem com recuo: exata primeiro e, se ela falhar, a estimada do
 * planner. Sob a carga de escrita do backfill de dog_flows a exata sobre
 * dezenas de milhares de linhas estoura o statement timeout (medido
 * 2026-08-26, o PostgREST devolve 500 com mensagem vazia); a estimada e
 * barata e segura os tiles ate a poeira baixar.
 *
 * A exata viaja como HEAD (padrao da casa); a estimada tem que ir como GET
 * com limit(1), porque HEAD + count=estimated tambem trava no PostgREST
 * (medido no mesmo dia: HEAD pendurou 25s, GET com limit respondeu em 0,4s).
 */
async function headCount(build: (mode: CountMode, head: boolean) => CountResult): Promise<number> {
  let lastMessage = 'count failed'
  for (const mode of ['exact', 'estimated'] as const) {
    try {
      return await retryOnce(async () => {
        const { count, error } = await build(mode, mode === 'exact')
        if (error) throw new Error(error.message || 'count failed')
        if (typeof count !== 'number') throw new Error('no count in response')
        return count
      })
    } catch (err: any) {
      if (err?.message) lastMessage = err.message
    }
  }
  throw new Error(lastMessage)
}

/** Bloco de corte para as janelas 90d/30d, a partir da ponta de dog_flows. */
async function activeCutoffBlock(active: ActiveWindow): Promise<number | null> {
  if (active === 'all') return null
  return retryOnce(async () => {
    const { data, error } = await supabase
      .from('dog_flows')
      .select('last_block')
      .order('last_block', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    const tip = data?.[0]?.last_block
    if (typeof tip !== 'number') return null
    return tip - (active === '90d' ? BLOCKS_90D : BLOCKS_30D)
  })
}

// ── stats ───────────────────────────────────────────────────────────────────

/**
 * Os 4 tiles vem prontos daqui. exchange_dog soma o saldo atual de toda
 * carteira rotulada exchange (dog_labels + verified); holding_pct usa o
 * subtree_balance da raiz corrente, que na raiz default cobre a arvore
 * inteira. coverage_gap_pct e 0 por definicao: a genealogia cobre 100% do
 * airdrop, e a frase de autoridade do tile afirma exatamente isso.
 */
async function buildStats(root: No): Promise<FlowStats> {
  const [wallets, directChildren, exchangeDog] = await Promise.all([
    headCount(
      (mode, head) =>
        supabase.from('dog_genealogy').select('wallet', { count: mode, head }).limit(1) as any,
    ),
    headCount(
      (mode, head) =>
        supabase
          .from('dog_genealogy')
          .select('wallet', { count: mode, head })
          .eq('parent', root.w)
          .limit(1) as any,
    ),
    fetchExchangeDog(),
  ])
  return {
    wallets,
    coverage_gap_pct: 0,
    direct_children: directChildren,
    holding_pct: round2((root.sb / TOTAL_SUPPLY) * 100),
    exchange_dog: Math.round(exchangeDog),
    exchange_pct_supply: round2((exchangeDog / TOTAL_SUPPLY) * 100),
  }
}

async function fetchExchangeDog(): Promise<number> {
  const ids = await allIdentities()
  const addrs = Array.from(ids.values())
    .filter((i) => i.kind === 'exchange')
    .map((i) => i.address)
  if (addrs.length === 0) return 0
  let sum = 0
  await inBatches(chunk(addrs, JOIN_CHUNK), async (c) => {
    const rows = await retryOnce(async () => {
      const { data, error } = await supabase
        .from('dog_genealogy')
        .select('wallet, balance_dog')
        .in('wallet', c)
      if (error) throw new Error(error.message)
      return (data ?? []) as { balance_dog: number | string | null }[]
    })
    for (const r of rows) {
      sum += Number(r.balance_dog ?? 0)
    }
  })
  return sum
}

// ── nucleo ──────────────────────────────────────────────────────────────────

/** Devolve null quando a raiz pedida nao existe em dog_genealogy. */
export async function buildFlow(p: FlowParams): Promise<FlowResponse | null> {
  const rootNo = await fetchGenealogyOne(p.root)
  if (!rootNo) return null

  const [cutoff, stats, rootFlowRows] = await Promise.all([
    activeCutoffBlock(p.active),
    buildStats(rootNo),
    // Heuristica da spec para meta.flows: conta os pares com src na raiz,
    // SEM filtro de janela, porque a pergunta e sobre cobertura do backfill.
    countRootFlows(p.root),
  ])

  // ── BFS de ate 4 niveis sobre dog_flows, expandindo por src ──────────────
  // A distancia BFS e a geracao no modo re-rooteado; na raiz default a
  // geracao final vem do depth da genealogia (mais fiel, e o join ja traz).
  const bfsGen = new Map<string, number>()
  bfsGen.set(p.root, 0)
  const inflow = new Map<string, number>()
  const outflow = new Map<string, number>()
  const rawRows: FlowRow[] = []
  let totalLinksConsidered = 0
  let frontier: string[] = [p.root]

  for (let level = 1; level <= 4; level++) {
    const srcs = frontier.slice(0, FRONTIER_CAP)
    if (srcs.length === 0) break
    const next: string[] = []
    // O orcamento do nivel repartido entre os srcs: a raiz sozinha leva os
    // 4000; uma fronteira cheia leva ~167 pares cada, que ja cobre com folga
    // os 12 nos nomeados da coluna seguinte.
    const perSrc = Math.min(LEVEL_ROW_CAP, Math.max(50, Math.ceil(LEVEL_ROW_CAP / srcs.length)))
    const results = await inBatches(srcs, (s) => fetchFlowsForSrc(s, cutoff, perSrc))
    const levelRows = results.reduce((a, r) => a + r.length, 0)
    totalLinksConsidered += await countFlowsFrom(srcs, cutoff, levelRows)
    for (const r of results) {
      for (const row of r) {
        rawRows.push(row)
        const dog = Number(row.total_dog ?? 0)
        outflow.set(row.src, (outflow.get(row.src) ?? 0) + dog)
        inflow.set(row.dst, (inflow.get(row.dst) ?? 0) + dog)
        if (!bfsGen.has(row.dst)) {
          bfsGen.set(row.dst, Math.min(level, 4))
          next.push(row.dst)
        }
      }
    }
    if (level >= 4) break
    // Fronteira do proximo nivel: topo por DOG recebido, desempate pelo
    // endereco para o resultado nao depender da ordem de chegada das paginas.
    next.sort((a, b) => (inflow.get(b) ?? 0) - (inflow.get(a) ?? 0) || (a < b ? -1 : 1))
    frontier = next
  }

  const moved = (w: string) => (inflow.get(w) ?? 0) + (outflow.get(w) ?? 0)

  // ── join de metadados na genealogia (saldo, holder, subtree, depth) ──────
  const discovered = Array.from(bfsGen.keys()).filter((w) => w !== p.root)
  discovered.sort((a, b) => moved(b) - moved(a) || (a < b ? -1 : 1))
  const toJoin = [p.root, ...discovered.slice(0, JOIN_CAP)]
  const joined = new Map<string, No>()
  await inBatches(chunk(toJoin, JOIN_CHUNK), async (c) => {
    const nodes = await retryOnce(() =>
      fetchNodesPaged(
        (from, to) =>
          supabase
            .from('dog_genealogy')
            .select(NODE_SELECT)
            .in('wallet', c)
            .range(from, to) as any,
        c.length,
      ),
    )
    for (const n of nodes) joined.set(n.w, n)
  })
  joined.set(p.root, rootNo)

  const isDefaultRoot = p.root === ROOT_WALLET
  const genOf = (w: string): number => {
    if (w === p.root) return 0
    if (isDefaultRoot) {
      // Raiz default: depth da genealogia E a geracao (G4+ colapsa o resto).
      const j = joined.get(w)
      if (j) return Math.min(Math.max(j.d, 1), 4)
    }
    return Math.min(bfsGen.get(w) ?? 4, 4)
  }

  // ── identidades (chips) ──────────────────────────────────────────────────
  const idTargets = rootNo.p ? [...toJoin, rootNo.p] : toJoin
  const ids = await resolveIdentities(idTargets)

  // ── promocao a no individual, na ordem da spec ───────────────────────────
  // (1) rotulada, (2) >= 0,5% do fluxo da coluna, (3) top da coluna por DOG
  // movimentado. Teto de 12 por coluna no desktop, 6 no mobile.
  const perColCap = p.mobile ? 6 : 12
  const colWallets = new Map<number, string[]>()
  for (const w of discovered) {
    const g = genOf(w)
    const arr = colWallets.get(g)
    if (arr) arr.push(w)
    else colWallets.set(g, [w])
  }
  const byMoved = (a: string, b: string) => moved(b) - moved(a) || (a < b ? -1 : 1)
  const promoted = new Set<string>()
  for (let g = 1; g <= 4; g++) {
    const ws = colWallets.get(g) ?? []
    if (ws.length === 0) continue
    const colFlow = ws.reduce((acc, w) => acc + (inflow.get(w) ?? 0), 0)
    const labeled = ws.filter((w) => ids.has(w)).sort(byMoved)
    const big = ws
      .filter((w) => !ids.has(w) && colFlow > 0 && (inflow.get(w) ?? 0) >= colFlow * 0.005)
      .sort(byMoved)
    const top = ws.filter((w) => !ids.has(w) && !big.includes(w)).sort(byMoved)
    for (const w of [...labeled, ...big, ...top].slice(0, perColCap)) promoted.add(w)
  }

  // Carteira fora do join nao tem saldo conhecido: cai em spent, porque
  // "ainda segura" e afirmacao positiva e so se afirma com o saldo na mao.
  const restKind = (w: string): 'holders' | 'spent' => (joined.get(w)?.h ? 'holders' : 'spent')
  const restIdOf = (w: string) => `g${genOf(w)}:${restKind(w)}`

  // ── expansao in-place dos nos de resto (?expand=g2:holders) ──────────────
  for (const id of p.expand) {
    const m = /^g([1-4]):(holders|spent)$/.exec(id)
    if (!m) continue
    const g = Number(m[1])
    const kind = m[2]
    const extras = (colWallets.get(g) ?? [])
      .filter((w) => !promoted.has(w) && restKind(w) === kind)
      .sort(byMoved)
      .slice(0, perColCap)
    for (const w of extras) promoted.add(w)
  }

  // ── nos de resto: DOIS por coluna, holders e spent ───────────────────────
  const restAgg = new Map<string, RestNode>()
  const bumpRest = (id: string, g: number, kind: 'holders' | 'spent', w: string) => {
    let r = restAgg.get(id)
    if (!r) {
      r = { id, gen: g, kind, n: 0, b: 0, in: 0, out: 0 }
      restAgg.set(id, r)
    }
    r.n += 1
    r.b += joined.get(w)?.b ?? 0
    r.in += inflow.get(w) ?? 0
    r.out += outflow.get(w) ?? 0
  }
  for (const [g, ws] of Array.from(colWallets.entries())) {
    for (const w of ws) {
      if (promoted.has(w)) continue
      bumpRest(`g${g}:${restKind(w)}`, g, restKind(w), w)
    }
  }

  // Na raiz default o "N wallets" do resto pode ser EXATO: a coluna e a
  // coorte de depth inteira da genealogia, e contagem head e barata. O b/in/
  // out continua vindo da janela consultada (somar saldo de 80k linhas sem
  // agregacao nativa nao cabe numa rota); o n exato e o que o rotulo afirma.
  if (isDefaultRoot) {
    const cohort = await fetchCohortCounts()
    const promHolders = new Map<number, number>()
    const promSpent = new Map<number, number>()
    for (const w of Array.from(promoted)) {
      const g = genOf(w)
      const m = restKind(w) === 'holders' ? promHolders : promSpent
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    for (let g = 1; g <= 4; g++) {
      const c = cohort.get(g)
      if (!c) continue
      const nH = Math.max(0, c.holders - (promHolders.get(g) ?? 0))
      const nS = Math.max(0, c.wallets - c.holders - (promSpent.get(g) ?? 0))
      applyExactRest(restAgg, g, 'holders', nH)
      applyExactRest(restAgg, g, 'spent', nS)
    }
  }

  // ── links: agrega por par mapeado, dobra o que fica abaixo de min ────────
  const isNamed = (w: string) => w === p.root || promoted.has(w)
  const mapEnd = (w: string) => (isNamed(w) ? w : restIdOf(w))
  const genOfId = (id: string): number => {
    const m = /^g(\d):/.exec(id)
    return m ? Number(m[1]) : genOf(id)
  }

  interface Agg {
    s: string
    t: string
    dog: number
    txs: number
    fb: number
    lb: number
  }
  const stage = new Map<string, Agg>()
  let selfFolded = 0
  const merge = (s: string, t: string, dog: number, txs: number, fb: number, lb: number) => {
    const key = `${s}|${t}`
    const a = stage.get(key)
    if (a) {
      a.dog += dog
      a.txs += txs
      a.fb = fb > 0 ? (a.fb > 0 ? Math.min(a.fb, fb) : fb) : a.fb
      a.lb = Math.max(a.lb, lb)
    } else {
      stage.set(key, { s, t, dog, txs, fb, lb })
    }
  }
  for (const row of rawRows) {
    const s = mapEnd(row.src)
    const t = mapEnd(row.dst)
    if (s === t) {
      // Par que cai inteiro dentro do mesmo no de resto: nao ha o que
      // desenhar, mas ele e contado em truncated_links, nunca some calado.
      selfFolded++
      continue
    }
    merge(s, t, Number(row.total_dog ?? 0), row.tx_count ?? 0, row.first_block ?? 0, row.last_block ?? 0)
  }

  // Corte do slider: par nomeado abaixo de min nao vira link individual, o
  // destino dobra para o no de resto da geracao dele (somado, nunca
  // descartado em silencio).
  const folded = new Map<string, Agg>()
  let dropped = 0
  for (const a of Array.from(stage.values())) {
    let t = a.t
    if (a.dog < p.min && !t.includes(':')) {
      t = restIdOf(a.t)
      if (t === a.s) {
        selfFolded++
        continue
      }
    }
    const key = `${a.s}|${t}`
    const prev = folded.get(key)
    if (prev) {
      prev.dog += a.dog
      prev.txs += a.txs
      prev.fb = a.fb > 0 ? (prev.fb > 0 ? Math.min(prev.fb, a.fb) : a.fb) : prev.fb
      prev.lb = Math.max(prev.lb, a.lb)
    } else {
      folded.set(key, { ...a, t })
    }
  }

  const allLinks = Array.from(folded.values()).sort(
    (a, b) => b.dog - a.dog || (a.s < b.s ? -1 : 1) || (a.t < b.t ? -1 : 1),
  )
  const kept = allLinks.slice(0, LINK_CAP)
  dropped = allLinks.length - kept.length

  const links: FlowLink[] = kept.map((a) => {
    const back = genOfId(a.t) < genOfId(a.s)
    const link: FlowLink = {
      s: a.s,
      t: a.t,
      dog: Math.round(a.dog),
      txs: a.txs,
      fb: a.fb,
      lb: a.lb,
    }
    if (back) link.back = true
    return link
  })

  // ── nos finais ───────────────────────────────────────────────────────────
  const toFlowNode = (w: string): FlowNode => {
    const j = joined.get(w)
    const inD = inflow.get(w) ?? 0
    const outD = outflow.get(w) ?? 0
    const b = j?.b ?? 0
    return {
      w,
      gen: genOf(w),
      b: Math.round(b),
      in: Math.round(inD),
      out: Math.round(outD),
      held_pct: inD > 0 ? Math.round(Math.min(1, b / inD) * 10000) / 10000 : b > 0 ? 1 : 0,
      h: j?.h ?? false,
      c: j?.c ?? 0,
      sw: j?.sw ?? 0,
      sh: j?.sh ?? 0,
      sb: Math.round(j?.sb ?? 0),
      label: toFlowLabel(ids.get(w)),
    }
  }

  const rootNode = toFlowNode(p.root)
  const colLabels: Record<number, string> = { 0: 'G0', 1: 'G1', 2: 'G2', 3: 'G3', 4: 'G4+' }
  const cols: FlowCol[] = [0, 1, 2, 3, 4].map((g) => {
    const nodes =
      g === 0
        ? [rootNode]
        : Array.from(promoted)
            .filter((w) => genOf(w) === g)
            .sort(byMoved)
            .map(toFlowNode)
    const rest = Array.from(restAgg.values())
      .filter((r) => r.gen === g && r.n > 0)
      .sort((a, b) => (a.kind < b.kind ? -1 : 1))
      .map((r) => ({ ...r, b: Math.round(r.b), in: Math.round(r.in), out: Math.round(r.out) }))
    return { gen: g as FlowCol['gen'], label: colLabels[g], nodes, rest }
  })

  // Fantasma da origem anterior: so quando a raiz corrente nao e a tesouraria
  // e tem pai na genealogia. O rotulo e o nome conhecido ou o endereco curto.
  const ghost =
    p.root !== ROOT_WALLET && rootNo.p
      ? { w: rootNo.p, label: ids.get(rootNo.p)?.name ?? shortAddr(rootNo.p) }
      : null

  const meta: FlowMeta = {
    root: p.root,
    generated_at: new Date().toISOString(),
    // Sem contagem (backfill segurando a tabela) o selo diz partial: completo
    // e afirmacao positiva e so sai com a evidencia na mao.
    flows: rootFlowRows !== null && rootFlowRows >= FLOWS_COMPLETE_MIN_ROWS ? 'complete' : 'partial',
    min: p.min,
    active: p.active,
    // Tudo que existiu e nao virou link desenhado: pares alem da janela de
    // leitura por nivel, pares dobrados dentro do proprio resto e links
    // agregados alem do teto de 120.
    truncated_links: totalLinksConsidered - rawRows.length + selfFolded + dropped,
    total_links_considered: totalLinksConsidered,
  }

  return { root: rootNode, cols, links, ghost, stats, meta }
}

function applyExactRest(restAgg: Map<string, RestNode>, g: number, kind: 'holders' | 'spent', n: number) {
  const id = `g${g}:${kind}`
  const r = restAgg.get(id)
  if (r) {
    r.n = n
    if (n === 0) restAgg.delete(id)
  } else if (n > 0) {
    restAgg.set(id, { id, gen: g, kind, n, b: 0, in: 0, out: 0 })
  }
}

/**
 * Contagem que alimenta o selo complete/partial. Ela NUNCA derruba o painel:
 * o backfill de dog_flows escreve pesado e ja segurou contagens exatas em
 * statement timeout (medido 2026-08-26); nesse caso tenta a estimada do
 * planner (barata) e, falhando as duas, devolve null e o selo fica partial.
 */
async function countRootFlows(root: string): Promise<number | null> {
  try {
    return await headCount(
      (mode, head) =>
        supabase
          .from('dog_flows')
          .select('src', { count: mode, head })
          .eq('src', root)
          .limit(1) as any,
    )
  } catch {
    return null
  }
}

/** Contagens exatas por coorte de depth (1..3 e 4+), total e holders. */
async function fetchCohortCounts(): Promise<Map<number, { wallets: number; holders: number }>> {
  const gens = [1, 2, 3, 4]
  const rows = await inBatches(gens, async (g) => {
    const base = (mode: CountMode, head: boolean) =>
      g === 4
        ? supabase.from('dog_genealogy').select('wallet', { count: mode, head }).gte('depth', 4)
        : supabase.from('dog_genealogy').select('wallet', { count: mode, head }).eq('depth', g)
    const [wallets, holders] = await Promise.all([
      headCount((mode, head) => base(mode, head).limit(1) as any),
      headCount((mode, head) => base(mode, head).eq('is_holder', true).limit(1) as any),
    ])
    return [g, { wallets, holders }] as const
  })
  return new Map(rows)
}
