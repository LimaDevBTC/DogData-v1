// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS: a SEGUNDA DECLARAÇÃO dos endereços que recebem o dinheiro dos carros (a mesma ideia de
// PONTAS_ESPERADAS em components/donate/donate-modal.tsx, para o fundo da licença).
//
// O endereço de pagamento chega na resposta do pedido (POST /api/dogcity/car-quote, campo `payTo`), e ele sai das
// variáveis CAR_FUND_BTC_ADDRESS e CAR_FUND_DOG_ADDRESS da Vercel. Esta tabela é uma cópia INDEPENDENTE, escrita à
// mão no código, das pontas de cada um. A janela de compra só mostra endereço, QR e botão de pagar quando o `payTo`
// do pedido bate com ela. Não bateu, ou a tabela está vazia: nada de endereço na tela (falha fechada).
//
// ⚠️ O QUE ISTO PEGA: variável da Vercel criada com o endereço errado (um caractere trocado, o endereço de outra
// carteira), bug nosso montando o pedido, edição desatenta num lugar só, extensão que troca texto no DOM.
// ⚠️ O QUE NÃO PEGA: quem injeta script na página remenda isto junto. Contra esse valem a CSP de middleware.ts e,
// acima de tudo, a tela de confirmação da própria carteira, que mostra o destino.
//
// ⚠️ O FUNDADOR PREENCHE no mesmo passo em que cria as variáveis (PROGRESSO_dog_motors_site.md, "O que o fundador
// faz"): os 10 primeiros caracteres, os 7 últimos e o tamanho de cada endereço. Enquanto estiver null, a loja pode
// até abrir no servidor, mas esta página não mostra endereço para pagar.
// ═══════════════════════════════════════════════════════════════════════════

export interface AddressEnds { start: string; end: string; length: number }

// Endereços enviados pelo fundador em 13/11/2026 (conta nova na mesma carteira das licenças), conferidos: bech32 v0 e
// bech32m v1 de mainnet, diferentes do fundo da licença (lib/dog/licence-btc.ts).
export const CAR_PAY_TO_ENDS: Readonly<Record<'btc' | 'dog', AddressEnds | null>> = {
  btc: { start: 'bc1qlmd3cm', end: 'cz32n2x', length: 42 },
  dog: { start: 'bc1p2rtqq0', end: 'qh0tsd0', length: 62 },
}

/** true só quando o endereço do pedido bate com a segunda declaração da moeda */
export function payToConfirmed(
  currency: 'btc' | 'dog',
  payTo: unknown,
  table: Readonly<Record<'btc' | 'dog', AddressEnds | null>> = CAR_PAY_TO_ENDS,
): boolean {
  const e = table[currency]
  if (!e || typeof payTo !== 'string') return false
  if (e.start.length < 8 || e.end.length < 6 || e.length < 26 || e.length > 90) return false
  // bech32 não tem caixa (o servidor devolve em minúsculas); base58 tem, e aí a comparação é exata
  const bech = payTo.toLowerCase().startsWith('bc1')
  const low = (s: string) => (bech ? s.toLowerCase() : s)
  const a = low(payTo)
  return a.length === e.length && a.startsWith(low(e.start)) && a.endsWith(low(e.end))
}
