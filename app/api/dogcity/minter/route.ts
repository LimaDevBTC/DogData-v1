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
    // o contador do mint (22/10/2026): pedidos pagos e escrituras na cadeia; ausente no minter antigo = null
    const n = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)
    // 06/11/2026: o calendario (4 alturas, lido do mint e nunca escrito aqui) e a contagem cunhada, para o aviso e o
    // verificador de lote contarem blocos ate o fim da Whitelist. Calendario com forma estranha vira null.
    const cal = j.calendar as Record<string, unknown> | null | undefined
    const calendar = cal && typeof cal === 'object'
      && n(cal.founderStart) != null && n(cal.whitelistStart) != null && n(cal.partnerStart) != null && n(cal.publicStart) != null
      ? { founderStart: cal.founderStart, whitelistStart: cal.whitelistStart, partnerStart: cal.partnerStart, publicStart: cal.publicStart }
      : null
    return NextResponse.json({ accepting: j.accepting, healthy: j.healthy, phase: j.phase, height, claimed: n(j.claimed), inscribed: n(j.inscribed), minted: n(j.minted), calendar }, { headers: { 'Cache-Control': OK_CACHE } })
  } catch {
    return erro('minter unreachable')
  }
}
