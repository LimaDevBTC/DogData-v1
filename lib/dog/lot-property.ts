// ═══════════════════════════════════════════════════════════════════════════
// A PROPRIEDADE: lotes vizinhos da mesma carteira contam como UM terreno no jogo (fundador, 19/11/2026).
// Pura: sem rede, sem banco, sem arquivo. Quem lê a geometria e o arquivo de vizinhos mora em
// lib/city/lot-vizinhos.ts; quem gera o arquivo é scripts/city/gerar_vizinhos.ts.
//
// REGRAS:
//  1. Na CADEIA nada muda: cada lote é a sua escritura, a sua inscrição, a sua licença (licence-lot.ts).
//     A propriedade só existe para o JOGO e para a tela de escolha: é derivada, nunca gravada.
//  2. Dois lotes são VIZINHOS quando estão no MESMO QUARTEIRÃO (o mesmo S..-Q..-B....) e dividem um lado de
//     verdade: dois lados dos 4 cantos de plano/saida/lotes.json (dogcity-mundo) sobre a mesma reta, a
//     menos de TOLERANCIA_M um do outro, encostados por pelo menos MIN_DIVISA_M. Encostar só num canto não é
//     vizinho (não dá para andar de um terreno ao outro sem passar pela rua). Nunca se chuta pelo número
//     do lote: L002 e L003 podem estar em lados opostos do quarteirão.
//  3. Uma PROPRIEDADE é um grupo conexo de lotes vizinhos que a MESMA carteira guarda (união pelas divisas).
//     Lote sem vizinho da carteira = propriedade de um lote só.
//  4. A âncora da propriedade (o id estável) é o menor lot_id do grupo.
// ═══════════════════════════════════════════════════════════════════════════

/** o mesmo formato de licence-lot.ts LOT_ID_RE */
const LOT_RE = /^S(\d{2})-Q(\d{2})-B(\d{3,5})-L(\d{3,5})$/

/** a divisa mínima encostada para dois lotes serem um terreno só (m) */
export const MIN_DIVISA_M = 2
/** a distância máxima entre dois lados para serem a mesma divisa (m); os cantos do mundo têm 1 cm */
export const TOLERANCIA_M = 0.3

export type Ponto = [number, number]
/** os cantos do lote no quadro do mundo do jogo (x leste, z sul), na ordem do contorno */
export type Cantos = Ponto[]

export interface LoteGeo {
  lotId: string
  cantos: Cantos
}

/** o quarteirão de um lote ("S09-Q00-B0035"), ou null se o id não tem a forma */
export function quarteiraoDe(lotId: string): string | null {
  const m = LOT_RE.exec(lotId)
  return m ? `S${m[1]}-Q${m[2]}-B${m[3]}` : null
}

/** o número do lote dentro do quarteirão (L003 -> 3), ou null */
export function numeroDe(lotId: string): number | null {
  const m = LOT_RE.exec(lotId)
  return m ? Number(m[4]) : null
}

/** o id do lote a partir do quarteirão e do número, com o mesmo preenchimento do registro (L001, L01234 fica) */
export function lotIdDe(quarteirao: string, numero: number): string {
  return `${quarteirao}-L${String(numero).padStart(3, '0')}`
}

function lados(c: Cantos): [Ponto, Ponto][] {
  const out: [Ponto, Ponto][] = []
  for (let i = 0; i < c.length; i++) out.push([c[i], c[(i + 1) % c.length]])
  return out
}

/**
 * Quanto o lado `s` encosta no lado `t` (m): os dois sobre a mesma reta (as pontas de `t` a menos de `tol`
 * da reta de `s`) e a sobreposição das projeções. Lados que não são a mesma reta: 0.
 */
export function encosto(s: [Ponto, Ponto], t: [Ponto, Ponto], tol = TOLERANCIA_M): number {
  const [p, q] = s
  const dx = q[0] - p[0]
  const dz = q[1] - p[1]
  const len = Math.hypot(dx, dz)
  if (!(len > 1e-6)) return 0
  const ux = dx / len
  const uz = dz / len
  const dist = (r: Ponto) => Math.abs((r[0] - p[0]) * uz - (r[1] - p[1]) * ux)
  if (dist(t[0]) > tol || dist(t[1]) > tol) return 0
  const proj = (r: Ponto) => (r[0] - p[0]) * ux + (r[1] - p[1]) * uz
  const a = proj(t[0])
  const b = proj(t[1])
  const lo = Math.max(0, Math.min(a, b))
  const hi = Math.min(len, Math.max(a, b))
  return Math.max(0, hi - lo)
}

/** o maior trecho de divisa que dois lotes dividem (m) */
export function divisaEntre(a: Cantos, b: Cantos, tol = TOLERANCIA_M): number {
  let melhor = 0
  for (const s of lados(a)) for (const t of lados(b)) melhor = Math.max(melhor, encosto(s, t, tol))
  return melhor
}

const cantosValidos = (c: unknown): c is Cantos =>
  Array.isArray(c) && c.length >= 3 && c.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))

/** os dois lotes são um terreno só: mesmo quarteirão e uma divisa de pelo menos MIN_DIVISA_M */
export function saoVizinhos(a: LoteGeo, b: LoteGeo, minDivisa = MIN_DIVISA_M): boolean {
  if (a.lotId === b.lotId) return false
  const qa = quarteiraoDe(a.lotId)
  if (!qa || qa !== quarteiraoDe(b.lotId)) return false
  if (!cantosValidos(a.cantos) || !cantosValidos(b.cantos)) return false
  return divisaEntre(a.cantos, b.cantos) >= minDivisa
}

/**
 * Todos os pares vizinhos de uma lista de lotes (a cidade inteira, no gerador). Compara só dentro do
 * quarteirão, com um corte pela caixa de cada lote: a cidade (70 mil lotes) passa em segundos.
 * Devolve, por quarteirão, os pares de números de lote [menor, maior], ordenados.
 */
export function paresVizinhos(lotes: LoteGeo[], minDivisa = MIN_DIVISA_M): Map<string, [number, number][]> {
  const porQ = new Map<string, LoteGeo[]>()
  for (const l of lotes) {
    const q = quarteiraoDe(l.lotId)
    if (!q || !cantosValidos(l.cantos)) continue
    porQ.set(q, [...(porQ.get(q) ?? []), l])
  }
  const out = new Map<string, [number, number][]>()
  for (const [q, ls] of [...porQ].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const caixas = ls.map((l) => {
      const xs = l.cantos.map((p) => p[0])
      const zs = l.cantos.map((p) => p[1])
      return [Math.min(...xs) - TOLERANCIA_M, Math.max(...xs) + TOLERANCIA_M, Math.min(...zs) - TOLERANCIA_M, Math.max(...zs) + TOLERANCIA_M]
    })
    const pares: [number, number][] = []
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const a = caixas[i]
        const b = caixas[j]
        if (a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]) continue
        if (!saoVizinhos(ls[i], ls[j], minDivisa)) continue
        const ni = numeroDe(ls[i].lotId)!
        const nj = numeroDe(ls[j].lotId)!
        pares.push(ni < nj ? [ni, nj] : [nj, ni])
      }
    }
    if (pares.length) out.set(q, pares.sort((x, y) => x[0] - y[0] || x[1] - y[1]))
  }
  return out
}

// ── o arquivo de vizinhos (data/dogcity_lot_vizinhos.json) ──────────────────

/** o formato do arquivo: por quarteirão, os pares "a-b" de números de lote separados por vírgula */
export interface ArquivoVizinhos {
  versao: 1
  fonte: string
  minDivisaM: number
  toleranciaM: number
  pares: number
  quarteiroes: Record<string, string>
}

export function arquivoDeVizinhos(pares: Map<string, [number, number][]>, fonte: string): ArquivoVizinhos {
  const quarteiroes: Record<string, string> = {}
  let n = 0
  for (const [q, ps] of pares) {
    quarteiroes[q] = ps.map(([a, b]) => `${a}-${b}`).join(',')
    n += ps.length
  }
  return { versao: 1, fonte, minDivisaM: MIN_DIVISA_M, toleranciaM: TOLERANCIA_M, pares: n, quarteiroes }
}

/** quem é vizinho de quem, pelo arquivo: (a, b) => true se os dois lotes dividem uma divisa */
export type Vizinhanca = (a: string, b: string) => boolean

/** o arquivo conferido e virado em consulta, ou null se a forma não é a esperada */
export function lerVizinhos(json: unknown): Vizinhanca | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Partial<ArquivoVizinhos>
  if (j.versao !== 1 || !j.quarteiroes || typeof j.quarteiroes !== 'object') return null
  const tabela = j.quarteiroes as Record<string, unknown>
  const cache = new Map<string, Set<string>>()
  const doQuarteirao = (q: string): Set<string> => {
    let s = cache.get(q)
    if (s) return s
    s = new Set()
    const txt = tabela[q]
    if (typeof txt === 'string') for (const par of txt.split(',')) if (/^\d+-\d+$/.test(par)) s.add(par)
    cache.set(q, s)
    return s
  }
  return (a, b) => {
    const q = quarteiraoDe(a)
    if (!q || q !== quarteiraoDe(b) || a === b) return false
    const na = numeroDe(a)!
    const nb = numeroDe(b)!
    return doQuarteirao(q).has(na < nb ? `${na}-${nb}` : `${nb}-${na}`)
  }
}

/** a vizinhança direto da geometria (testes e o gerador) */
export function vizinhancaDaGeometria(lotes: LoteGeo[], minDivisa = MIN_DIVISA_M): Vizinhanca {
  const geo = new Map(lotes.map((l) => [l.lotId, l]))
  return (a, b) => {
    const la = geo.get(a)
    const lb = geo.get(b)
    return !!la && !!lb && saoVizinhos(la, lb, minDivisa)
  }
}

// ── as propriedades de uma carteira ─────────────────────────────────────────

export interface Propriedade {
  /** a âncora: o menor lot_id do grupo (id estável da propriedade) */
  id: string
  /** os lotes do grupo, ordenados */
  lots: string[]
}

/**
 * Os lotes que UMA carteira guarda, agrupados em propriedades (grupos conexos pelas divisas). Pura.
 * Sem vizinhança (arquivo fora do alcance): cada lote é uma propriedade de um lote só, nunca uma união chutada.
 */
export function agruparPropriedades(lotIds: string[], vizinho: Vizinhanca | null): Propriedade[] {
  const ids = [...new Set(lotIds.filter((l) => LOT_RE.test(l)))].sort()
  const pai = new Map(ids.map((l) => [l, l]))
  const raiz = (l: string): string => {
    let r = l
    while (pai.get(r) !== r) r = pai.get(r)!
    let x = l
    while (pai.get(x) !== r) { const p = pai.get(x)!; pai.set(x, r); x = p }
    return r
  }
  if (vizinho) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (quarteiraoDe(ids[i]) !== quarteiraoDe(ids[j])) continue
        if (!vizinho(ids[i], ids[j])) continue
        const a = raiz(ids[i])
        const b = raiz(ids[j])
        if (a !== b) pai.set(a < b ? b : a, a < b ? a : b)
      }
    }
  }
  const grupos = new Map<string, string[]>()
  for (const l of ids) { const r = raiz(l); grupos.set(r, [...(grupos.get(r) ?? []), l]) }
  return [...grupos.values()]
    .map((lots) => ({ id: lots[0], lots }))
    .sort((a, b) => b.lots.length - a.lots.length || (a.id < b.id ? -1 : 1))
}

/** a propriedade que contém o lote, ou null */
export const propriedadeDoLote = (props: Propriedade[], lotId: string): Propriedade | null =>
  props.find((p) => p.lots.includes(lotId)) ?? null
