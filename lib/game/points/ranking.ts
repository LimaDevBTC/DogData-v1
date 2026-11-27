// ═════════════════════════════════════════════════════════════════
// RANKING DOS DC POINTS (27/11/2026): as regras de LEITURA da rota pública GET /api/game/points/ranking. Sem rede, sem banco.
// A conta mora no banco (supabase/migrations/050_dc_points_ranking.sql, dc_points_ranking); aqui ficam a leitura do pedido, a
// leitura HOSTIL da resposta do banco e o formato PÚBLICO.
//
// O ranking soma pontos GANHOS, nunca o saldo. A tabela de origens (kind/source) e a regra do Total, dos herdados e da semana
// estão no cabeçalho da 050. Cada origem, em uma linha:
//   earn/checkin -> Total, Login | earn/<venda pesca madeira minerio caca cavalo turno missao tutorial verified> -> Total
//   referral/referral -> Total, Ambassador | referral/bonus (bônus único do operador, migração 051) -> Total, Ambassador
//   migration/save -> Total (só all time) | spend, car, refund -> nunca
//
// PRIVACIDADE (decisão de 27/11/2026): o JSON público NUNCA leva o endereço inteiro. `wallet` sai abreviado (o mesmo
// shortAddress do placar de referral) e o caminho interno da página da carteira (`walletPath`) só sai quando a linha NÃO tem
// handle (o endereço abreviado é a identidade mostrada). Para linha com handle, `walletPath` é null: ligar @handle a endereço
// inteiro em lista com todos os jogadores não é público em lugar nenhum hoje (só quem fala na praça aparece assim, em
// /api/chat). Para ligar o link também nas linhas com handle, vire LINK_WALLET_WITH_HANDLE.
// ═════════════════════════════════════════════════════════════════
import { shortAddress } from '@/lib/referral/ref'
import { dbInt } from './store'

export const BOARDS = ['total', 'login', 'ambassador'] as const
export const PERIODS = ['all', 'week'] as const
export type Board = (typeof BOARDS)[number]
export type Period = (typeof PERIODS)[number]

export const DEFAULT_LIMIT = 100
export const MAX_LIMIT = 100
export const LINK_WALLET_WITH_HANDLE = false

export interface RankingQuery { board: Board; period: Period; limit: number; me: boolean }

export interface RankingRow {
  rank: number
  handle: string | null
  /** o endereço ABREVIADO, para exibir */
  wallet: string
  /** o caminho INTERNO da página da carteira no DogData (nunca explorador externo); null quando a linha tem handle */
  walletPath: string | null
  /** a inscrição da foto de perfil (a tela serve por /api/inscription/<id>/content) ou null */
  avatar: string | null
  points: number
}

export interface PublicRanking {
  board: Board
  period: Period
  updatedAt: string
  /** quantas carteiras têm ponto neste quadro (não só as linhas devolvidas) */
  total: number
  rows: RankingRow[]
  me: { rank: number; points: number } | null
}

const INSCRIPTION_RE = /^[0-9a-f]{64}i[0-9]{1,6}$/
const HANDLE_RE = /^[a-z0-9_]{3,15}$/
const WALLET_RE = /^[A-Za-z0-9]{26,90}$/

/** Os parâmetros da URL. Valor fora da lista cai no padrão (board=total, period=all, limit=100, no máximo 100). */
export function parseRankingQuery(params: URLSearchParams): RankingQuery {
  const b = params.get('board')
  const p = params.get('period')
  const board = (BOARDS as readonly string[]).includes(b ?? '') ? (b as Board) : 'total'
  const period = (PERIODS as readonly string[]).includes(p ?? '') ? (p as Period) : 'all'
  const raw = params.get('limit')
  const n = raw !== null && /^[0-9]{1,6}$/.test(raw) ? Number(raw) : DEFAULT_LIMIT
  return { board, period, limit: Math.min(MAX_LIMIT, Math.max(1, n)), me: params.get('me') === '1' }
}

const bad = (): never => { throw new Error('dc_points_ranking: unexpected answer') }

/** A resposta de dc_points_ranking, lida com desconfiança (forma inesperada LANÇA: a rota responde 503) e já no formato público. */
export function toPublicRanking(v: unknown, board: Board, period: Period, hasSession: boolean): PublicRanking {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : bad()
  const total = dbInt(o.total)
  if (total === null || total < 0) bad()
  const rowsRaw = Array.isArray(o.rows) ? o.rows : bad()
  const rows: RankingRow[] = (rowsRaw as unknown[]).map((r) => {
    const x = r && typeof r === 'object' ? (r as Record<string, unknown>) : bad()
    const rank = dbInt(x.rank)
    const points = dbInt(x.points)
    if (rank === null || rank < 1 || points === null || points < 1) bad()
    if (typeof x.wallet !== 'string' || !WALLET_RE.test(x.wallet)) bad()
    const handle = typeof x.handle === 'string' && HANDLE_RE.test(x.handle) ? x.handle : null
    const avatar = typeof x.avatar === 'string' && INSCRIPTION_RE.test(x.avatar) ? x.avatar : null
    const wallet = x.wallet as string
    return {
      rank: rank as number,
      handle,
      wallet: shortAddress(wallet),
      walletPath: handle && !LINK_WALLET_WITH_HANDLE ? null : `/address/bitcoin/${wallet}`,
      avatar,
      points: points as number,
    }
  })
  let me: PublicRanking['me'] = null
  if (hasSession && o.me && typeof o.me === 'object') {
    const m = o.me as Record<string, unknown>
    const rank = dbInt(m.rank)
    const points = dbInt(m.points)
    if (rank !== null && rank >= 1 && points !== null && points >= 1) me = { rank, points }
  }
  const updatedAt = typeof o.updated_at === 'string' && !Number.isNaN(Date.parse(o.updated_at)) ? new Date(o.updated_at).toISOString() : bad()
  return { board, period, updatedAt: updatedAt as string, total: total as number, rows, me }
}
