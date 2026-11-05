import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { lerJsonComTeto, passouDoTeto, respostaFreio } from '@/lib/seguranca/freio'

export const dynamic = 'force-dynamic'

const TETO_IP_MINUTO = 60
const RE_ANUNCIANTE = /^[a-z0-9_-]{1,40}$/

/*
  Supabase — run once to create the table:

  CREATE TABLE IF NOT EXISTS ad_events (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type  text        NOT NULL CHECK (event_type IN ('impression', 'click')),
    advertiser  text        NOT NULL DEFAULT 'bitflow',
    page        text        NOT NULL,
    device_type text        CHECK (device_type IN ('mobile', 'desktop')),
    created_at  timestamptz DEFAULT now()
  );

  CREATE INDEX idx_ad_events_lookup ON ad_events (advertiser, event_type, created_at);
*/

export async function POST(req: NextRequest) {
  try {
    // rota publica que grava no banco e alimenta numero de anunciante: cada campo com forma e teto, e um freio por IP
    if (await passouDoTeto(req, 'adstrack', TETO_IP_MINUTO)) return respostaFreio()
    const corpo = await lerJsonComTeto(req, 2048)
    if (!corpo.ok) return NextResponse.json({ error: 'invalid body' }, { status: corpo.status })
    const { event_type, advertiser, page, device_type } = (corpo.valor ?? {}) as Record<string, unknown>

    if (event_type !== 'impression' && event_type !== 'click') {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400 })
    }
    if (advertiser !== undefined && (typeof advertiser !== 'string' || !RE_ANUNCIANTE.test(advertiser))) {
      return NextResponse.json({ error: 'invalid advertiser' }, { status: 400 })
    }
    if (page !== undefined && (typeof page !== 'string' || page.length > 512)) {
      return NextResponse.json({ error: 'invalid page' }, { status: 400 })
    }
    if (device_type !== undefined && device_type !== 'mobile' && device_type !== 'desktop') {
      return NextResponse.json({ error: 'invalid device_type' }, { status: 400 })
    }

    const { error } = await supabase.from('ad_events').insert({
      event_type,
      advertiser: advertiser ?? 'bitflow',
      page: page ?? '/',
      device_type: device_type ?? 'desktop',
    })

    if (error) throw error

    return NextResponse.json({ ok: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err: any) {
    console.error('[ads/track]', err?.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
