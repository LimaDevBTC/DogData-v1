// Freio simples por chave, o mesmo padrão que o chat da praça já usa: uma
// marca no Redis com `nx` e prazo. Não é contagem de janela deslizante, é
// "um pedido a cada N segundos", que é o que rotas caras precisam.

import { redisClient } from '@/lib/upstash'

export async function tooFast(key: string, seconds: number): Promise<boolean> {
  try {
    const reserved = await redisClient.set(`throttle:${key}`, '1', { ex: seconds, nx: true })
    return reserved !== 'OK'
  } catch {
    // Redis fora do ar não pode fechar a porta de quem está usando o site: o
    // freio existe contra abuso, não como autenticação.
    return false
  }
}
