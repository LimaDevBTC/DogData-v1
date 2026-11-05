// O portao das rotas de cron e o comparador de segredos.
//
// A Vercel manda `Authorization: Bearer $CRON_SECRET` em toda chamada de cron quando a variavel existe. E' a unica prova
// que vale: `User-Agent` e `x-vercel-cron` qualquer um escreve no curl, e segredo em query string (`?secret=`) vai parar em
// log, em historico e, se estiver no vercel.json, no repositorio publico.
//
// Falha fechada: sem CRON_SECRET a rota recusa tudo. A unica folga e' `next dev` sem a variavel, para rodar o cron a mao.
// Modulo puro (so' node:crypto): o teste roda sem Redis e sem banco.
import { createHash, timingSafeEqual } from 'node:crypto'

/** Compara dois segredos em tempo constante. O hash iguala os tamanhos, entao o tamanho do segredo tambem nao vaza. */
export function segredoConfere(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (typeof recebido !== 'string' || typeof esperado !== 'string' || !recebido || !esperado) return false
  const a = createHash('sha256').update(recebido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

interface PedidoComCabecalhos {
  headers: { get(nome: string): string | null }
}

export function cronAutorizado(
  req: PedidoComCabecalhos,
  amb: { CRON_SECRET?: string; NODE_ENV?: string } = process.env as { CRON_SECRET?: string; NODE_ENV?: string },
): boolean {
  const segredo = amb.CRON_SECRET
  if (!segredo) return amb.NODE_ENV === 'development'
  return segredoConfere(req.headers.get('authorization'), `Bearer ${segredo}`)
}
