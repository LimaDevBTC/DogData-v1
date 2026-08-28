import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWalletSession } from '@/lib/identity/session'
import { tooFast } from '@/lib/identity/throttle'
import {
  INSCRIPTION_ID, inscriptionMeta, inscriptionOwner, isImageType,
} from '@/lib/ordinals/inscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/profile/avatar { inscription_id }  escolhe a foto
 * POST /api/profile/avatar { inscription_id: null }  tira a foto
 *
 * ⚠️ A POSSE É RECONFERIDA AQUI, não herdada da listagem. A listagem é uma
 * conveniência da tela; este endpoint é o que grava, então ele pergunta ao
 * indexador quem segura a inscrição AGORA e compara com o endereço da sessão.
 * Sem isso qualquer pessoa poderia mandar o id de um ordinal famoso.
 */
export async function POST(req: NextRequest) {
  const session = await getWalletSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401 })
  }
  const address = session.address.toLowerCase()

  if (await tooFast(`avatar:${address}`, 2)) {
    return NextResponse.json({ error: 'Slow down, try again in a moment.' }, { status: 429 })
  }

  let body: { inscription_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 422 })
  }

  // Tirar a foto: volta pro sigilo desenhado a partir do endereço.
  if (body.inscription_id === null) {
    const { error } = await supabase
      .from('dogcity_profiles')
      .update({
        avatar_inscription_id: null,
        avatar_content_type: null,
        avatar_number: null,
        avatar_set_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('address', address)
    if (error) {
      console.error('[api/profile/avatar clear]', error.message)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    return NextResponse.json({ avatar_inscription_id: null })
  }

  const id = (body.inscription_id ?? '').trim().toLowerCase()
  if (!INSCRIPTION_ID.test(id)) {
    return NextResponse.json({ error: 'Invalid inscription id.' }, { status: 422 })
  }

  const [owner, meta] = await Promise.all([inscriptionOwner(id), inscriptionMeta(id)])
  if (!owner) {
    return NextResponse.json(
      { error: 'Could not confirm who holds this inscription. Try again in a moment.' },
      { status: 502 },
    )
  }
  if (owner.toLowerCase() !== address) {
    return NextResponse.json(
      { error: 'That inscription is not in this wallet.' },
      { status: 403 },
    )
  }
  if (!isImageType(meta?.contentType)) {
    return NextResponse.json(
      { error: 'Only image inscriptions can be used as a profile picture.' },
      { status: 422 },
    )
  }

  // Upsert e não update: a carteira pode escolher a foto antes de reivindicar
  // um handle, e nesse caso a linha do perfil ainda não existe.
  const { error } = await supabase.from('dogcity_profiles').upsert(
    {
      address,
      avatar_inscription_id: id,
      avatar_content_type: meta?.contentType ?? null,
      avatar_number: meta?.number ?? null,
      avatar_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'address' },
  )
  if (error) {
    console.error('[api/profile/avatar save]', error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({
    avatar_inscription_id: id,
    avatar_content_type: meta?.contentType ?? null,
    avatar_number: meta?.number ?? null,
  })
}
