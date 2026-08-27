import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// Porta de entrada da telemetria.
//
// Esta rota roda em toda troca de rota de todo visitante, mais um pulso de
// engajamento a cada 15s. É a rota mais chamada do site inteiro, então ela faz
// UMA ida ao banco: `analytics_ingest` (migração 020) grava o evento cru e
// reconcilia sessão e visitante na mesma transação. O incidente de IO de 26/08
// é a razão de isso não ser quatro consultas.
//
// Três coisas o cliente NÃO manda, porque o cliente pode mentir sobre elas e
// porque o servidor sabe melhor: país, cidade e user-agent. Vêm dos headers da
// edge da Vercel. Em particular, é o user-agent lido aqui que permite marcar
// robô — a ausência dessa coluna é o motivo de a Áustria ter passado o mês de
// agosto como terceiro país do painel com 813 sessões de uma página cada.
//
// O esquema das tabelas vive em supabase/migrations/019 e 020.
// ═══════════════════════════════════════════════════════════════════════════

// Teto por campo. Não é paranoia: este endpoint é público e aceita POST de
// qualquer origem, então cada string que entra precisa de um limite ANTES de
// virar linha no banco.
const LIM = {
  page: 512, referrer: 255, event_name: 60, language: 35,
  utm: 120, device_type: 16, browser: 32, os: 24, id: 64, ua: 512,
} as const

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

const inteiro = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, Math.round(n)))
}

export async function POST(req: NextRequest) {
  try {
    // `sendBeacon` manda um Blob. Declaramos application/json no cliente, mas
    // navegador antigo pode chegar com text/plain — ler como texto e parsear à
    // mão aceita os dois. Um `req.json()` seco perderia justamente os eventos
    // de saída, que carregam a permanência da última página da visita.
    const bruto = await req.text()
    if (!bruto) return NextResponse.json({ error: 'corpo vazio' }, { status: 400 })

    let body: Record<string, unknown>
    try {
      body = JSON.parse(bruto)
    } catch {
      return NextResponse.json({ error: 'json invalido' }, { status: 400 })
    }

    const tipo = texto(body.event_type, 16)
    if (!tipo || !['pageview', 'vital', 'engagement', 'event'].includes(tipo)) {
      return NextResponse.json({ error: 'event_type invalido' }, { status: 400 })
    }

    // Geografia e user-agent: do servidor, sempre. O cliente nem é consultado.
    const h = req.headers
    const pais = h.get('x-vercel-ip-country') || h.get('cf-ipcountry') || null
    const cidade = h.get('x-vercel-ip-city') || h.get('cf-ipcity') || null
    const regiao = h.get('x-vercel-ip-country-region') || h.get('cf-region-code') || null

    const payload = {
      event_type: tipo,
      page: texto(body.page, LIM.page) ?? '/',
      referrer: texto(body.referrer, LIM.referrer),
      country: pais,
      // A Vercel percent-encoda a cidade no header ("S%C3%A3o+Paulo").
      // Sem decodificar, "São Paulo" e "Sao Paulo" viram duas cidades.
      city: cidade ? safeDecode(cidade) : null,
      region: regiao,
      device_type: texto(body.device_type, LIM.device_type),
      browser: texto(body.browser, LIM.browser),
      os: texto(body.os, LIM.os),
      session_id: texto(body.session_id, LIM.id),
      visitor_id: texto(body.visitor_id, LIM.id),
      user_agent: texto(h.get('user-agent'), LIM.ua),
      language: texto(body.language, LIM.language),
      screen_w: inteiro(body.screen_w, 0, 20000),
      screen_h: inteiro(body.screen_h, 0, 20000),
      viewport_w: inteiro(body.viewport_w, 0, 20000),
      viewport_h: inteiro(body.viewport_h, 0, 20000),
      utm_source: texto(body.utm_source, LIM.utm),
      utm_medium: texto(body.utm_medium, LIM.utm),
      utm_campaign: texto(body.utm_campaign, LIM.utm),
      utm_term: texto(body.utm_term, LIM.utm),
      utm_content: texto(body.utm_content, LIM.utm),
      vital_name: texto(body.vital_name, 8),
      vital_value: inteiro(body.vital_value, 0, 3_600_000),
      vital_rating: texto(body.vital_rating, 20),
      // Teto de 30 min por evento de engajamento. O cliente já corta, mas a
      // rota é pública: sem isto, um POST à mão poderia creditar 400 horas de
      // permanência numa página e envenenar a média do período inteiro.
      duration_ms: inteiro(body.duration_ms, 0, 1_800_000),
      scroll_pct: inteiro(body.scroll_pct, 0, 100),
      event_name: texto(body.event_name, LIM.event_name),
      event_value: typeof body.event_value === 'number' && Number.isFinite(body.event_value)
        ? body.event_value : null,
      event_meta: metaLimpa(body.event_meta),
    }

    const { error } = await supabase.rpc('analytics_ingest', { p: payload })
    if (error) throw error

    // 204 e não 200: não há nada pra devolver, e resposta vazia é mais barata
    // no caminho mais chamado do site.
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/track]', msg)
    // Falha de telemetria NUNCA vira erro visível: o cliente não olha a
    // resposta e nada na página depende dela.
    return new NextResponse(null, { status: 204 })
  }
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v.replace(/\+/g, ' '))
  } catch {
    return v
  }
}

// event_meta é o único campo de forma livre. Aceita um objeto raso de até 12
// chaves com valores escalares — o suficiente pra `{ metodo: 'dog' }` e longe
// do bastante pra alguém despejar um payload arbitrário num jsonb público.
function metaLimpa(v: unknown): Record<string, string | number | boolean> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const saida: Record<string, string | number | boolean> = {}
  let n = 0
  for (const [k, valor] of Object.entries(v as Record<string, unknown>)) {
    if (n >= 12) break
    if (typeof valor === 'string') saida[k.slice(0, 40)] = valor.slice(0, 200)
    else if (typeof valor === 'number' && Number.isFinite(valor)) saida[k.slice(0, 40)] = valor
    else if (typeof valor === 'boolean') saida[k.slice(0, 40)] = valor
    else continue
    n++
  }
  return n ? saida : null
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
