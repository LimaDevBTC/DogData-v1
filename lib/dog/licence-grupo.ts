// ═══════════════════════════════════════════════════════════════════════════
// CARTEIRAS QUE ASSINARAM A MESMA DOAÇÃO (19/11/2026)
//
// Uma doação ao fundo pode ter VÁRIOS remetentes na mesma transação: a conta de ordinals (bc1p…) e a conta de
// pagamento (3… ou 1…, base58) da mesma pessoa. O livro (founders-ledger.ts) reparte o valor entre elas pelo DOG
// líquido de cada uma, e cada parte vira uma linha do placar, com o degrau de licença SÓ da parte dela. Já a
// licença no lote (licence-lot.ts: coSpentLot) trata quem assinou junto como a MESMA carteira e soma tudo no
// lote. Resultado do caso S06-Q05-B0457-L003 (18/11): placar = 39.000 (personal) + 11.000 (personal, e com o
// base58 em minúsculas, que não é endereço de ninguém); licence-standing = 50.000 (commercial).
//
// O placar NÃO muda de conta (fundadores, ranking e total seguem como estão). Esta função só ACRESCENTA a cada
// linha de quem dividiu uma doação o grupo a que ela pertence: `co_signers` (os outros endereços, com a caixa
// original do base58) e `group_total` / `group_license` (a soma do grupo e o degrau dela). Quem lê o placar para
// decidir licença usa `group_license`; quem precisa da licença do LOTE continua em /api/dogcity/licence-standing.
// ═══════════════════════════════════════════════════════════════════════════
import { licenceFor, normalizeAddress } from './licence-btc'

export interface GrupoEntrada {
  address: string
  licence_total: number
  license: string
}

export interface GrupoContribuicao {
  remetentes: { address: string }[]
}

export type ComGrupo<E> = E & { co_signers?: string[]; group_total?: number; group_license?: string }

/**
 * `entries`: as linhas do placar (endereço em minúsculas, como o livro). `contributions`: as contribuições do livro
 * (`ledger.contributions`). `original`: endereço em minúsculas -> como a cadeia o escreve (base58 mantém a caixa).
 * Só as contribuições com 2 ou mais remetentes ligam carteiras; a união é transitiva (A+B numa transação, B+C
 * noutra: o grupo é A, B, C). Linha sem grupo sai igual. Pura.
 */
export function comGrupos<E extends GrupoEntrada>(
  entries: E[],
  contributions: GrupoContribuicao[],
  original: Map<string, string> = new Map(),
): ComGrupo<E>[] {
  const pai = new Map<string, string>()
  const raiz = (a: string): string => {
    let r = a
    while (pai.get(r) !== r) r = pai.get(r) ?? r
    pai.set(a, r)
    return r
  }
  for (const c of contributions) {
    const ends = [...new Set(c.remetentes.map((r) => String(r.address).toLowerCase()))].filter((a) => a && a !== 'anonymous')
    if (ends.length < 2) continue
    for (const a of ends) if (!pai.has(a)) pai.set(a, a)
    for (const a of ends.slice(1)) pai.set(raiz(a), raiz(ends[0]))
  }
  const membros = new Map<string, string[]>()
  for (const a of pai.keys()) membros.set(raiz(a), [...(membros.get(raiz(a)) ?? []), a])
  const total = new Map(entries.map((e) => [e.address.toLowerCase(), e.licence_total]))
  const nome = (a: string) => original.get(a) ?? normalizeAddress(a) ?? a
  return entries.map((e) => {
    const k = e.address.toLowerCase()
    if (!pai.has(k)) return e
    const grupo = (membros.get(raiz(k)) ?? []).sort()
    const soma = grupo.reduce((s, a) => s + (total.get(a) ?? 0), 0)
    return { ...e, co_signers: grupo.filter((a) => a !== k).map(nome), group_total: soma, group_license: licenceFor(soma) }
  })
}
