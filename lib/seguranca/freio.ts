// O freio por IP das rotas publicas que escrevem ou gastam (carteira, perfil, cotacao, chaves de API) e a leitura de corpo
// com teto.
//
// Janela fixa, INCR + EXPIRE, o mesmo desenho de lib/chat/nearby-sessao.ts `estourouIp`. Os tetos sao folgados de proposito:
// o jogo e o mint chamam por rewrite, e um NAT de escola ou de operadora divide IP. Barra script, nao barra pessoa.
//
// Redis fora do ar NAO fecha a porta: o freio existe contra abuso, nao como autenticacao (mesma regra de
// lib/identity/throttle.ts). O que depende de Redis para valer (sessao, desafio) falha sozinho, na propria rota.
import { NextResponse, type NextRequest } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { eventoSeguranca, ipDoPedido } from './evento'

export async function passouDoTeto(req: NextRequest, balde: string, teto: number, janelaS = 60): Promise<boolean> {
  try {
    const chave = `freio:${balde}:${ipDoPedido(req)}`
    const n = await redisClient.incr(chave)
    if (n === 1) await redisClient.expire(chave, janelaS)
    if (n > teto) {
      // so' a primeira de cada rajada vai para o log: o proprio log nao pode virar o custo do ataque
      if (n === teto + 1) eventoSeguranca('freio_ip', req, { balde })
      return true
    }
    return false
  } catch {
    return false
  }
}

export function respostaFreio(janelaS = 60): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests, try again in a moment.' },
    { status: 429, headers: { 'Retry-After': String(janelaS), 'Cache-Control': 'no-store' } },
  )
}

export type CorpoLido = { ok: true; valor: unknown } | { ok: false; status: 400 | 413 }

/** O corpo JSON, com teto em bytes: recusa pelo Content-Length antes de ler e confere de novo depois. */
export async function lerJsonComTeto(req: NextRequest, tetoBytes: number): Promise<CorpoLido> {
  const declarado = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(declarado) && declarado > tetoBytes) {
    eventoSeguranca('corpo_grande', req, { declarado })
    return { ok: false, status: 413 }
  }
  let bruto: string
  try {
    bruto = await req.text()
  } catch {
    return { ok: false, status: 400 }
  }
  if (Buffer.byteLength(bruto, 'utf8') > tetoBytes) {
    eventoSeguranca('corpo_grande', req, { bytes: Buffer.byteLength(bruto, 'utf8') })
    return { ok: false, status: 413 }
  }
  try {
    return { ok: true, valor: JSON.parse(bruto) }
  } catch {
    return { ok: false, status: 400 }
  }
}
