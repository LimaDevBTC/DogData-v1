// Conferencia do pedido das salas da sede KRAY•SPACE (modulo puro: testado em scripts/salas.test.mjs).
import { mesmoEndereco } from '../ordinals/dsc'

/**
 * O jogo manda o endereco que ele mostra (`{ endereco }`). Se a sessao provada e'
 * de OUTRO endereco (provou com uma carteira, trocou para outra), a resposta e'
 * 401 'sessao_de_outro': o jogo pede a prova da carteira atual. O endereco do
 * corpo nunca e' o que se consulta: consulta-se so' o da sessao.
 */
export function conferirPedido(sessao: { address: string }, corpo: unknown): 'ok' | 'sessao_de_outro' {
  const pedido = (corpo as { endereco?: unknown } | null)?.endereco
  if (typeof pedido !== 'string' || !pedido) return 'ok'
  return mesmoEndereco(pedido.trim(), sessao.address) ? 'ok' : 'sessao_de_outro'
}
