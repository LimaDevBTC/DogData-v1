// DOG Phone (Mensagens): os fios de verdade (só servidor). O banco é o da migração 046 pelo service role; a sessão é a da
// carteira assinada (cookie dg_wallet), a mesma do chat e da caixa do lote. Quando a conta que entra pelo X sem carteira
// existir neste repo, é aqui que ela vira uma segunda forma de `sessao` (a tabela já tem a coluna x_id).
import type { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { lerJsonComTeto, passouDoTeto } from '@/lib/seguranca/freio'
import type { PortaHttp } from './http'
import { SemTabela, type PhoneDeps, type Rpc } from './service'

// 42883 função inexistente, 42P01 tabela inexistente, PGRST202 função fora do cache do PostgREST: a 046 ainda não foi aplicada
const SEM_TABELA = new Set(['42883', '42P01', 'PGRST202', 'PGRST205'])

const rpc: Rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    if (SEM_TABELA.has(String(error.code ?? ''))) throw new SemTabela(error.message)
    throw new Error(`${fn}: ${error.message}`)
  }
  return data
}

export const phoneDeps: PhoneDeps = {
  rpc,
  // segredo só do servidor e sempre presente: a chave da cutucada não precisa de variável nova
  segredo: process.env.PHONE_NUDGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dogphone',
}

export const portaHttp: PortaHttp = {
  async sessao(req) {
    const s = await getWalletSession(req as NextRequest).catch(() => null)
    // a MESMA chave de dogcity_profiles (app/api/profile grava o endereço em minúsculas): é por ela que o handle é lido
    const a = typeof s?.address === 'string' ? s.address.trim().toLowerCase() : ''
    return a.length >= 26 && a.length <= 90 ? a : null
  },
  freioIp: (req, balde, teto) => passouDoTeto(req as NextRequest, balde, teto),
  freioConta: (chave, segundos) => tooFast(chave, segundos),
  lerCorpo: (req, teto) => lerJsonComTeto(req as NextRequest, teto),
}
