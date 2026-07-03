import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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
    const body = await req.json()
    const { event_type, advertiser, page, device_type } = body

    if (!event_type || !['impression', 'click'].includes(event_type)) {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400 })
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
    return NextResponse.json({ error: 'internal', detail: err?.message }, { status: 500 })
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
