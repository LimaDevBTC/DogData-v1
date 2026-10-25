import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWalletSession } from '@/lib/identity/session'
import { comPrazo, falhaPrivada } from '@/lib/api/prazo'
import { readBoardRows } from '@/lib/referral/db'
import { refLink } from '@/lib/referral/ref'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/referral/me: o link e a contagem PROPRIOS de quem tem sessao verificada.
//
// So existe para a carteira da sessao (cookie dg_wallet, nascido em /api/wallet/verify): nao aceita
// ?address=. Sem sessao 401. Sem handle, `link` e' null (so conta verificada COM @handle indica).
// A contagem vem da mesma funcao do placar, filtrada por esta conta; se a migracao 035 ainda nao
// estiver aplicada, `counts` volta null e o link continua valendo (o link nao depende do banco novo).
// Sem cache: e' dado de uma pessoa.
export async function GET(req: NextRequest) {
  const session = await getWalletSession(req).catch(() => null)
  if (!session) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }
  const address = session.address.toLowerCase()

  return comPrazo(
    async () => {
      const { data: profile, error } = await supabase.from('dogcity_profiles').select('handle').eq('address', address).maybeSingle()
      if (error) {
        console.error('[api/referral/me] profile:', error.message)
        return falhaPrivada()
      }
      const handle: string | null = profile?.handle ?? null
      let counts: {
        referred: number; minted: number; licences: { personal: number; commercial: number; patron: number }; licence_dog: number
      } | null = null
      if (handle) {
        try {
          const [row] = await readBoardRows(1, address)
          counts = row
            ? {
                referred: row.referred, minted: row.minted,
                licences: { personal: row.licences_personal, commercial: row.licences_commercial, patron: row.licences_patron },
                licence_dog: row.licence_dog,
              }
            : { referred: 0, minted: 0, licences: { personal: 0, commercial: 0, patron: 0 }, licence_dog: 0 }
        } catch (e) {
          console.error('[api/referral/me] counts:', (e as Error)?.message)
        }
      }
      return NextResponse.json(
        { handle, link: handle ? refLink(handle) : null, counts },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    },
    { ms: 5000, falha: falhaPrivada },
  )
}
