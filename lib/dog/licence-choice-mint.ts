// O caminho servidor a servidor do mint para a escolha do lote da licença (POST/GET /api/dogcity/licence-choice).
import { timingSafeEqual } from 'node:crypto'
import { normalizeAddress } from './licence-btc'

/**
 * O SERVIDOR DO MINT (21/11/2026, fundador: "nenhum CTA leva ao DogData; a escolha tem de estar no mint e no jogo"). O mint confere a
 * assinatura da carteira na SESSÃO DELE e repassa a escolha daqui, servidor a servidor: `Authorization: Bearer <MINT_CRON_SECRET>`
 * (o mesmo segredo que os dois já dividem, o CRON_SECRET do mint) e o endereço em `x-dogcity-wallet`. Sem a variável, ou com o
 * segredo errado, o caminho não existe (cai na sessão do cookie). A posse do lote continua conferida aqui (holderDoMint).
 */
export function enderecoDoMint(req: { headers: { get(name: string): string | null } }, segredo = process.env.MINT_CRON_SECRET?.trim()): string | null {
  if (!segredo || segredo.length < 16) return null
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const a = Buffer.from(auth.slice(7)), b = Buffer.from(segredo)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return normalizeAddress(req.headers.get('x-dogcity-wallet') ?? '') || null
}

