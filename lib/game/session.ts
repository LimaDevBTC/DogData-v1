import type { NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'

/**
 * Carteira da sessao verificada (cookie dg_wallet -> Redis wsess:<sid>, o mesmo de /api/wallet/session).
 * O /api/wallet/verify grava { address, walletId, verifiedAt }; o campo usado aqui e' `address`.
 * Sem cookie, sessao expirada ou formato inesperado: null (a rota responde 401). Falha FECHADA.
 */
export async function sessionWallet(req: NextRequest): Promise<string | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid || sid.length > 100) return null
  const s = (await redisClient.get(`wsess:${sid}`)) as { address?: unknown } | null
  const a = s && typeof s === 'object' ? s.address : null
  return typeof a === 'string' && a.length >= 26 && a.length <= 90 ? a : null
}
