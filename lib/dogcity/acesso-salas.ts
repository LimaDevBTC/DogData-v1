// As concessoes curtas das salas da sede KRAY•SPACE no DOGCITY: DOG DAO (rune
// DOG em L1) e DOG SOCIAL CLUB (Ordinal oficial). Uma chave por SALA e por
// sessao: ter uma nunca da' a outra.
//
// Nasce SO' na rota da sala (app/api/dogcity/{dao,dsc}-access), depois da regra
// da sala confirmar a posse atual no endereco da sessao, e fica presa ao cookie
// da sessao da carteira (dg_wallet): outro jogador, outra aba sem o cookie ou
// outra carteira nao herdam nada. Vale ACESSO_TTL_S; o jogo revalida antes.
// Toda rota que um dia entregar conteudo, acao ou beneficio EXCLUSIVO de uma
// sala confere aqui (temAcessoSala), que tambem exige que a sessao ainda exista
// e seja do mesmo endereco: logout (DELETE /api/wallet/session) ou troca de
// carteira derrubam a concessao na hora.

import type { NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { getWalletSession } from '@/lib/identity/session'
import { mesmoEndereco } from '@/lib/ordinals/dsc'

export type Sala = 'dao' | 'dsc'

export const ACESSO_TTL_S = 300
export const RENOVAR_EM_MS = 120_000

export interface ConcessaoSala {
  sala: Sala
  endereco: string
  expira: number
  /** DSC: o Ordinal que deu o acesso */
  inscricao?: { id: string; numero: number | null }
}

const chave = (sala: Sala, sid: string): string => `salaacc:${sala}:${sid}`

export async function gravarAcessoSala(sid: string, c: ConcessaoSala): Promise<void> {
  await redisClient.set(chave(c.sala, sid), c, { ex: ACESSO_TTL_S })
}

export async function apagarAcessoSala(sala: Sala, sid: string): Promise<void> {
  try {
    await redisClient.del(chave(sala, sid))
  } catch {
    /* expira sozinha */
  }
}

/** A requisicao tem concessao valida DESTA sala, da carteira da sessao atual? */
export async function temAcessoSala(req: NextRequest, sala: Sala): Promise<ConcessaoSala | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const [sessao, c] = await Promise.all([getWalletSession(req), redisClient.get<ConcessaoSala>(chave(sala, sid))])
  if (!sessao || !c || c.sala !== sala || c.expira < Date.now()) return null
  return mesmoEndereco(sessao.address, c.endereco) ? c : null
}

export { conferirPedido } from './pedido-sala'
