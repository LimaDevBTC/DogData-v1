// Os fios de verdade de "Message the owner" (só servidor): o banco (045), o dono do lote pelo mint e os handles do DogData.
// As duas rotas (/api/dogcity/lot-message e /api/dogcity/inbox) usam o mesmo.
import { supabase } from '@/lib/supabase'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { lerJsonComTeto, passouDoTeto } from '@/lib/seguranca/freio'
import { normalizeAddress } from './licence-btc'
import { MINT_ORIGIN } from './licence-lot-supabase'
import { donoNaResposta } from './lot-message'
import { messageStore } from './lot-message-supabase'
import type { MessageDeps } from './lot-message-service'
import type { PortaHttp } from './lot-message-http'

/** o mint responde ao lote em até isto; passou, a mensagem não sai (falha fechado) */
const MINT_MS = 2_500

async function donoDoLote(lot: string): Promise<string | null | undefined> {
  try {
    const r = await fetch(`${MINT_ORIGIN}/api/mint/lots?ids=${encodeURIComponent(lot)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(MINT_MS), headers: { accept: 'application/json' },
    })
    if (!r.ok) return undefined
    return donoNaResposta(await r.json(), lot)
  } catch {
    return undefined
  }
}

async function handles(enderecos: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < enderecos.length; i += 200) {
    const { data, error } = await supabase.from('dogcity_profiles').select('address, handle').in('address', enderecos.slice(i, i + 200))
    if (error) throw new Error(`dogcity_profiles: ${error.message}`)
    for (const r of (data ?? []) as Array<{ address: unknown; handle: unknown }>) {
      const a = normalizeAddress(r.address)
      if (a && typeof r.handle === 'string' && /^[a-z0-9_]{1,32}$/i.test(r.handle)) out.set(a, r.handle)
    }
  }
  return out
}

export const messageDeps: MessageDeps = {
  store: messageStore(supabase),
  donoDoLote,
  handles,
}

export const portaHttp: PortaHttp = {
  async sessao(req) {
    const s = await getWalletSession(req).catch(() => null)
    return s ? normalizeAddress(s.address) : null
  },
  freioIp: (req, balde, teto) => passouDoTeto(req, balde, teto),
  freioCarteira: (chave, segundos) => tooFast(chave, segundos),
  lerCorpo: (req, teto) => lerJsonComTeto(req, teto),
}
