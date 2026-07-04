import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/*
  Supabase — run once:

  CREATE TABLE IF NOT EXISTS page_events (
    id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type   text        NOT NULL CHECK (event_type IN ('pageview', 'vital')),
    page         text        NOT NULL,
    referrer     text,
    country      text,
    device_type  text,
    browser      text,
    session_id   text,
    vital_name   text,
    vital_value  real,
    vital_rating text,
    created_at   timestamptz DEFAULT now()
  );

  CREATE INDEX idx_page_events_created  ON page_events (created_at DESC);
  CREATE INDEX idx_page_events_type     ON page_events (event_type, created_at DESC);
  CREATE INDEX idx_page_events_page     ON page_events (page, created_at DESC);

  ALTER TABLE page_events DISABLE ROW LEVEL SECURITY;
*/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event_type, page, referrer, device_type, browser, session_id, vital_name, vital_value, vital_rating } = body

    if (!event_type || !['pageview', 'vital'].includes(event_type)) {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400 })
    }

    // Country from Vercel edge header — free, no extra API needed
    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      null

    const { error } = await supabase.from('page_events').insert({
      event_type,
      page: page ?? '/',
      referrer: referrer || null,
      country,
      device_type: device_type ?? null,
      browser: browser ?? null,
      session_id: session_id ?? null,
      vital_name: vital_name ?? null,
      vital_value: vital_value ?? null,
      vital_rating: vital_rating ?? null,
    })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[analytics/track]', err?.message)
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
