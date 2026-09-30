import { NextRequest, NextResponse } from 'next/server'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { listInscriptions } from '@/lib/ordinals/inscriptions'
import { verificarDsc, type FonteLista } from '@/lib/ordinals/dsc'
import { donoNoOrd, lerOrdEndereco, lerUtxosKray } from '@/lib/dogcity/fontes-l1'
import { ACESSO_TTL_S, RENOVAR_EM_MS, apagarAcessoSala, conferirPedido, gravarAcessoSala } from '@/lib/dogcity/acesso-salas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** as listas do endereco, na ordem: UniSat (se ha' token), Kray, ord (lib/ordinals/dsc.ts) */
function listas(): FonteLista[] {
  const out: FonteLista[] = []
  if (process.env.UNISAT_API_TOKEN) {
    out.push({
      nome: 'unisat',
      listar: async (endereco, cursor, tamanho) => {
        const { items, total, proximo } = await listInscriptions(endereco, cursor, tamanho)
        return { items: items.map((i) => ({ id: i.id, number: i.number })), total, proximo }
      },
    })
  }
  out.push({
    nome: 'kray',
    listar: async (endereco) => {
      const utxos = await lerUtxosKray(endereco)
      const items = utxos.flatMap((u) => u.inscricoes.map((id) => ({ id, number: 0 })))
      return { items, total: items.length, proximo: items.length }
    },
  })
  out.push({
    nome: 'ord',
    listar: async (endereco) => {
      const r = await lerOrdEndereco(endereco)
      const items = r.inscricoes.map((id) => ({ id, number: 0 }))
      return { items, total: items.length, proximo: items.length }
    },
  })
  return out
}

/**
 * POST /api/dogcity/dsc-access  { endereco? }
 *
 * A porta do lounge DOG SOCIAL CLUB da sede KRAY•SPACE no DOGCITY
 * (dogcity-mundo: src/cidade/kray_salas.ts). O endereco consultado sai SO' da
 * sessao da carteira (cookie dg_wallet, criada por /api/wallet/verify depois da
 * assinatura do desafio de uso unico); o `endereco` do corpo so' confere que o
 * jogo mostra a mesma carteira. A posse e' a ATUAL (lib/ordinals/dsc.ts: lista
 * por fonte, dono conferido no ord), a cada chamada. A concessao dura
 * ACESSO_TTL_S e o jogo revalida em RENOVAR_EM_MS.
 *
 *   200 { acesso: true, expira, renovarEm, inscricao, endereco }
 *   401 { acesso: false, motivo: 'sem_sessao' | 'sessao_de_outro' }
 *   403 { acesso: false, motivo: 'sem_posse', endereco }       nenhum Ordinal oficial agora
 *   429 { acesso: false, motivo: 'devagar' }
 *   503 { acesso: false, motivo: 'fonte_indisponivel' }         nenhuma concessao nova
 */
export async function POST(req: NextRequest) {
  const sid = req.cookies.get('dg_wallet')?.value
  const sessao = await getWalletSession(req)
  if (!sid || !sessao) return NextResponse.json({ acesso: false, motivo: 'sem_sessao' }, { status: 401 })
  const corpo = await req.json().catch(() => null)
  if (conferirPedido(sessao, corpo) !== 'ok') return NextResponse.json({ acesso: false, motivo: 'sessao_de_outro' }, { status: 401 })
  // cada verificacao custa perguntas aos indexadores
  if (await tooFast(`dsc:${sessao.address}`, 4)) return NextResponse.json({ acesso: false, motivo: 'devagar' }, { status: 429 })

  const r = await verificarDsc(sessao.address, { listas: listas(), dono: donoNoOrd })

  if (r.status === 'holder') {
    const expira = Date.now() + ACESSO_TTL_S * 1000
    try {
      await gravarAcessoSala(sid, { sala: 'dsc', endereco: sessao.address, inscricao: r.inscricao, expira })
    } catch (e: any) {
      // sem onde guardar a concessao, nenhuma rota exclusiva a reconheceria: nao libera
      console.error('[api/dogcity/dsc-access] redis', e?.message)
      return NextResponse.json({ acesso: false, motivo: 'fonte_indisponivel' }, { status: 503 })
    }
    return NextResponse.json({ acesso: true, expira, renovarEm: RENOVAR_EM_MS, inscricao: r.inscricao, endereco: sessao.address })
  }
  if (r.status === 'sem_posse') {
    await apagarAcessoSala('dsc', sid)
    return NextResponse.json({ acesso: false, motivo: 'sem_posse', endereco: sessao.address }, { status: 403 })
  }
  // fonte fora: a concessao que existe segue ate' expirar (o jogo decide com o `expira` que ja' tem); nenhuma nova
  console.warn('[api/dogcity/dsc-access] indisponivel:', r.motivo)
  return NextResponse.json({ acesso: false, motivo: 'fonte_indisponivel' }, { status: 503 })
}
