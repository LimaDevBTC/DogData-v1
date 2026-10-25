// Referral: o ReferralStore de producao (Supabase, service role). SO servidor.
//
// Escritas: wallet_first_verify (uma linha por carteira, na primeira verificacao) e
// referral_links (o vinculo, imutavel). Tabelas da migracao 035. Sem a migracao aplicada tudo
// aqui lanca/falha, e quem chama (lib/referral/link.ts) trata como "nao vincula": o verify segue.

import { supabase } from '../supabase'
import type { NewLink, ReferralStore } from './link'

const MEMPOOL_TIP = 'https://mempool.space/api/blocks/tip/height'
const MINT_STATUS = 'https://mint.dogcity.space/api/mint/status'
const TIP_TIMEOUT_MS = 1500

async function getWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

/** A altura da ponta da cadeia: mempool.space; se falhar, o status publico do mint (so se fresco). null = nao sei. */
export async function readChainTip(): Promise<number | null> {
  try {
    const r = await getWithTimeout(MEMPOOL_TIP, TIP_TIMEOUT_MS)
    if (r.ok) {
      const n = Number((await r.text()).trim())
      if (Number.isSafeInteger(n) && n > 0) return n
    }
  } catch { /* cai para o proximo */ }
  try {
    const r = await getWithTimeout(MINT_STATUS, TIP_TIMEOUT_MS)
    if (r.ok) {
      const j = (await r.json()) as { height?: unknown; heightAgeMs?: unknown }
      const h = Number(j?.height)
      const age = Number(j?.heightAgeMs)
      if (Number.isSafeInteger(h) && h > 0 && Number.isFinite(age) && age < 10 * 60 * 1000) return h
    }
  } catch { /* sem ponta */ }
  return null
}

export const supabaseReferralStore: ReferralStore = {
  async wasKnownBefore(address) {
    // perfil (chave primaria) e ponte de analytics (indice em address). O perfil guarda tudo em minusculas.
    const [profile, bridge] = await Promise.all([
      supabase.from('dogcity_profiles').select('address').eq('address', address.toLowerCase()).limit(1),
      supabase.from('analytics_identity').select('address').eq('address', address).limit(1),
    ])
    if (profile.error) throw new Error(profile.error.message)
    if (bridge.error) throw new Error(bridge.error.message)
    return (profile.data?.length ?? 0) > 0 || (bridge.data?.length ?? 0) > 0
  },

  async markFirstVerify(address) {
    // ON CONFLICT DO NOTHING + RETURNING: so devolve linha quando ESTA chamada inseriu.
    const { data, error } = await supabase
      .from('wallet_first_verify')
      .upsert({ address, source: 'verify' }, { onConflict: 'address', ignoreDuplicates: true })
      .select('address')
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },

  async referrerOf(handle) {
    // handle so existe em dogcity_profiles depois de sessao provada (POST /api/profile): perfil = conta verificada
    const { data, error } = await supabase.from('dogcity_profiles').select('address').eq('handle', handle).maybeSingle()
    if (error) throw new Error(error.message)
    return data?.address ?? null
  },

  chainTip: readChainTip,

  async insertLink(l: NewLink) {
    const { data, error } = await supabase
      .from('referral_links')
      .upsert(
        {
          referred_address: l.referredAddress,
          referrer_address: l.referrerAddress,
          referrer_handle: l.referrerHandle,
          linked_block: l.linkedBlock,
        },
        { onConflict: 'referred_address', ignoreDuplicates: true },
      )
      .select('referred_address')
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },
}
