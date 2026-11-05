// O registro de eventos de seguranca: uma linha JSON no log da funcao (console.warn), que a Vercel guarda em Runtime Logs.
//
// O que NUNCA entra aqui: cookie, token, assinatura, nonce, corpo do pedido, IP cru e endereco inteiro de carteira. O IP vira
// um apelido que muda todo dia (da para ver "o mesmo pedinte hoje", nao para seguir uma pessoa), o endereco fica so' nas
// pontas. Nao ha alerta ligado nisto: e' a materia prima para filtrar por `"seg":` nos logs e para um log drain, se o
// fundador ligar um. Ver docs/security/INCIDENT_RESPONSE.md do dogcity-mundo.
import { createHash } from 'node:crypto'

export type TipoEvento =
  | 'auth_assinatura_invalida'
  | 'auth_desafio_ausente'
  | 'auth_desafio_repetido'
  | 'cron_negado'
  | 'admin_negado'
  | 'freio_ip'
  | 'corpo_grande'
  | 'pedido_invalido'

interface PedidoComCabecalhos {
  headers: { get(nome: string): string | null }
  nextUrl?: { pathname: string }
}

export function ipDoPedido(req: PedidoComCabecalhos): string {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || ''
  return ip.trim().slice(0, 64) || 'sem-ip'
}

/** O apelido do IP no dia: 12 hex de sha256(dia + ip). */
export function apelidoDoIp(ip: string, agoraMs: number = Date.now()): string {
  const dia = new Date(agoraMs).toISOString().slice(0, 10)
  return createHash('sha256').update(`${dia}:${ip}`).digest('hex').slice(0, 12)
}

/** bc1p...w3xz: o bastante para reconhecer, sem gravar o endereco inteiro no log. */
export function enderecoCurto(a: unknown): string | null {
  return typeof a === 'string' && a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : null
}

export function linhaDoEvento(
  tipo: TipoEvento,
  req: PedidoComCabecalhos,
  extra: Record<string, string | number | boolean | null> = {},
  agoraMs: number = Date.now(),
): string {
  return JSON.stringify({
    seg: tipo,
    rota: req.nextUrl?.pathname ?? null,
    ip: apelidoDoIp(ipDoPedido(req), agoraMs),
    em: new Date(agoraMs).toISOString(),
    ...extra,
  })
}

export function eventoSeguranca(tipo: TipoEvento, req: PedidoComCabecalhos, extra: Record<string, string | number | boolean | null> = {}): void {
  try {
    console.warn(linhaDoEvento(tipo, req, extra))
  } catch {
    /* log nunca derruba a rota */
  }
}
