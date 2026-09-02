// ═══════════════════════════════════════════════════════════════════════════
// O portão da sala de operação.
//
// Não há senha nova, nem tabela de papéis, nem provedor de login. A prova de
// posse da carteira JÁ existe e já é forte: /api/wallet/verify confere a
// assinatura (BIP-322, ECDSA ou Schnorr) antes de gravar `wsess:<sid>` no
// Upstash. A existência do registro com endereço é a prova. Aqui só se
// pergunta: este endereço provado está na lista da casa?
//
// ⚠️ A LISTA É ENV, NUNCA ARQUIVO. Este repositório é PÚBLICO. Uma allowlist
// commitada entrega, de graça e para sempre, exatamente quais duas carteiras
// abrem a sala — e endereço de Bitcoin não se rotaciona como senha.
//
// ⚠️ QUEM NÃO É ADMIN VÊ 404, NÃO 403. Um 403 confirma que a sala existe e
// que aquele caminho é o certo, o que transforma o portão num anúncio.
// ═══════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { redisClient } from '@/lib/upstash'
import type { WalletSession } from '@/lib/identity/session'

/**
 * Endereços que abrem a sala, de `ADMIN_ADDRESSES` (separados por vírgula).
 *
 * Lido a cada chamada, e não uma vez no topo do módulo: em runtime de função
 * o módulo sobrevive entre requisições, então uma constante de topo congelaria
 * a lista até o próximo deploy. Trocar quem entra tem que valer na hora.
 */
function allowlist(): Set<string> {
  const bruto = process.env.ADMIN_ADDRESSES || ''
  return new Set(
    bruto
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  )
}

export interface Admin {
  address: string
  walletId: string | null
  verifiedAt: string
}

async function porSid(sid: string | undefined): Promise<Admin | null> {
  if (!sid) return null

  const lista = allowlist()
  // Lista vazia fecha a porta para todo mundo. A alternativa — cair para
  // "sem lista, todo mundo entra" — abriria a sala inteira num deploy onde a
  // variável faltasse, que é justamente quando ninguém está olhando.
  if (lista.size === 0) return null

  let sessao: WalletSession | null = null
  try {
    sessao = await redisClient.get<WalletSession>(`wsess:${sid}`)
  } catch {
    // Redis fora do ar nega a entrada. Um portão que abre quando a checagem
    // falha não é um portão.
    return null
  }

  if (!sessao?.address || !lista.has(sessao.address)) return null
  return { address: sessao.address, walletId: sessao.walletId ?? null, verifiedAt: sessao.verifiedAt }
}

/** Para rotas de API (route handlers), que recebem a requisição. */
export function getAdminFromRequest(req: NextRequest): Promise<Admin | null> {
  return porSid(req.cookies.get('dg_wallet')?.value)
}

/** Para Server Components, que leem o cookie do contexto. */
export async function getAdmin(): Promise<Admin | null> {
  const jar = await cookies()
  return porSid(jar.get('dg_wallet')?.value)
}
