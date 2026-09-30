import { NextRequest, NextResponse } from 'next/server'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import { fonteKrayDog, fonteOrdDog, verificarDog } from '@/lib/runes/dog-l1'
import { lerOrdEndereco, lerUtxosKray } from '@/lib/dogcity/fontes-l1'
import { ACESSO_TTL_S, RENOVAR_EM_MS, apagarAcessoSala, conferirPedido, gravarAcessoSala } from '@/lib/dogcity/acesso-salas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dogcity/dao-access  { endereco? }
 *
 * A porta da sala DOG DAO da sede KRAY•SPACE no DOGCITY (dogcity-mundo:
 * src/cidade/kray_salas.ts). Regra: saldo CONFIRMADO > 0 da rune
 * DOG•GO•TO•THE•MOON (840000:3) em Bitcoin L1 no endereco da SESSAO da carteira
 * (qualquer carteira suportada que provou o endereco; nada de Kray obrigatoria
 * nem de window.krayWallet.getRunes). DOG da KRAY L2, snapshot e endereco sem
 * prova nao contam (lib/runes/dog-l1.ts). Mesmo contrato da rota DSC.
 *
 *   200 { acesso: true, expira, renovarEm, endereco }
 *   401 { acesso: false, motivo: 'sem_sessao' | 'sessao_de_outro' }
 *   403 { acesso: false, motivo: 'sem_posse', endereco }       sem DOG confirmado agora
 *   429 { acesso: false, motivo: 'devagar' }
 *   503 { acesso: false, motivo: 'fonte_indisponivel' }         nenhuma concessao nova
 */
export async function POST(req: NextRequest) {
  const sid = req.cookies.get('dg_wallet')?.value
  const sessao = await getWalletSession(req)
  if (!sid || !sessao) return NextResponse.json({ acesso: false, motivo: 'sem_sessao' }, { status: 401 })
  const corpo = await req.json().catch(() => null)
  if (conferirPedido(sessao, corpo) !== 'ok') return NextResponse.json({ acesso: false, motivo: 'sessao_de_outro' }, { status: 401 })
  if (await tooFast(`dao:${sessao.address}`, 4)) return NextResponse.json({ acesso: false, motivo: 'devagar' }, { status: 429 })

  const r = await verificarDog(sessao.address, [fonteOrdDog(lerOrdEndereco), fonteKrayDog(lerUtxosKray)])

  if (r.status === 'holder') {
    const expira = Date.now() + ACESSO_TTL_S * 1000
    try {
      await gravarAcessoSala(sid, { sala: 'dao', endereco: sessao.address, expira })
    } catch (e: any) {
      console.error('[api/dogcity/dao-access] redis', e?.message)
      return NextResponse.json({ acesso: false, motivo: 'fonte_indisponivel' }, { status: 503 })
    }
    return NextResponse.json({ acesso: true, expira, renovarEm: RENOVAR_EM_MS, endereco: sessao.address })
  }
  if (r.status === 'sem_posse') {
    await apagarAcessoSala('dao', sid)
    return NextResponse.json({ acesso: false, motivo: 'sem_posse', endereco: sessao.address }, { status: 403 })
  }
  console.warn('[api/dogcity/dao-access] indisponivel')
  return NextResponse.json({ acesso: false, motivo: 'fonte_indisponivel' }, { status: 503 })
}
