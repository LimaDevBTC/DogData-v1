// ═══════════════════════════════════════════════════════════════════════════
// O ESTADO DE UM LOTE NO MINT (06/11/2026), para o verificador dizer "unclaimed" ou "claimed".
// O mint nao libera CORS para dogdata.xyz e o navegador nunca fala com o banco: a leitura e' aqui, no servidor, na rota PUBLICA
// do mint (/api/mint/lot/<id>), com cache curto na borda. Devolve so o que a tela usa.
// Falha (rede, 4xx/5xx, forma errada) = 503 com { error }: o verificador mostra o lote sem estado, nunca "unclaimed" por engano.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MINT_LOT = 'https://mint.dogcity.space/api/mint/lot/'
const LOT_ID_RE = /^S\d{2}-Q\d{2}-B\d{3,5}-L\d{3,5}$/
const OK_CACHE = 'public, s-maxage=15'
const ERR_CACHE = 'public, s-maxage=5'
const STATES = ['available', 'reserved', 'minted', 'not_for_sale'] as const

export async function GET(req: Request) {
  const erro = (msg: string, status = 503) => NextResponse.json({ error: msg }, { status, headers: { 'Cache-Control': ERR_CACHE } })
  const id = (new URL(req.url).searchParams.get('id') ?? '').trim().toUpperCase()
  if (!LOT_ID_RE.test(id)) return erro('bad lot id', 400)
  try {
    const r = await fetch(MINT_LOT + encodeURIComponent(id), { signal: AbortSignal.timeout(5_000), cache: 'no-store' })
    if (!r.ok) return erro(`mint HTTP ${r.status}`)
    const j = (await r.json()) as Record<string, unknown>
    const state = STATES.find((s) => s === j.state)
    if (!state || j.lotId !== id) return erro('mint: unexpected shape')
    return NextResponse.json(
      { lotId: id, state, inscriptionId: typeof j.inscriptionId === 'string' ? j.inscriptionId : null },
      { headers: { 'Cache-Control': OK_CACHE } },
    )
  } catch {
    return erro('mint unreachable')
  }
}
