// ═══════════════════════════════════════════════════════════════════════════
// O ESTADO REAL DO MINTER, para a landing não anunciar "aberto" só pela altura.
// O mint (mint.dogcity.space) não libera CORS para dogdata.xyz, então a leitura é
// aqui no servidor, com cache curto. Só repassa o que a landing precisa.
// Falha (rede, 5xx, forma errada) = 503 com { error }: a landing trata como
// "não confirmado" e não mostra o botão de mint.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STATUS_URL = 'https://mint.dogcity.space/api/mint/status'
const OK_CACHE = 'public, s-maxage=15'
const ERR_CACHE = 'public, s-maxage=5'

export async function GET() {
  const erro = (msg: string) => NextResponse.json({ error: msg }, { status: 503, headers: { 'Cache-Control': ERR_CACHE } })
  try {
    const r = await fetch(STATUS_URL, { signal: AbortSignal.timeout(5_000), cache: 'no-store' })
    if (!r.ok) return erro(`minter HTTP ${r.status}`)
    const j = (await r.json()) as Record<string, unknown>
    if (typeof j.accepting !== 'boolean' || typeof j.healthy !== 'boolean' || typeof j.phase !== 'string') return erro('minter: unexpected shape')
    const height = typeof j.height === 'number' && Number.isSafeInteger(j.height) ? j.height : null
    return NextResponse.json({ accepting: j.accepting, healthy: j.healthy, phase: j.phase, height }, { headers: { 'Cache-Control': OK_CACHE } })
  } catch {
    return erro('minter unreachable')
  }
}
