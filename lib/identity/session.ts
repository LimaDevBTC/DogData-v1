// Sessão de carteira: cookie httpOnly `dg_wallet` → `wsess:<sid>` no Upstash.
//
// A sessão só nasce em /api/wallet/verify, depois da assinatura conferir, então
// a simples existência do registro com endereço JÁ É a prova de posse: não há
// um campo "verified" separado a consultar.

import type { NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'

export interface WalletSession {
  address: string
  walletId: string | null
  verifiedAt: string
}

export async function getWalletSession(req: NextRequest): Promise<WalletSession | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const session = await redisClient.get<WalletSession>(`wsess:${sid}`)
  return session?.address ? session : null
}
