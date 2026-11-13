// O pedido de pagamento do BIP-21, puro, para a tela poder ser testada sem navegador.
// Saiu de components/donate/donate-modal.tsx sem mudar uma linha da conta.

export const BIP21_LABEL = encodeURIComponent('DogCity construction fund')
/** o rótulo dos pedidos de carro (DOG MOTORS): a carteira mostra quem pede, e não é o fundo da licença */
export const BIP21_LABEL_MOTORS = encodeURIComponent('DOG MOTORS')

/**
 * `bitcoin:<endereco>?amount=<btc>&label=…`, o pedido de pagamento do BIP-21.
 * ⚠️ O amount é em BTC com ponto decimal, NUNCA em satoshi, e o campo daqui é
 * em satoshi. Sem valor digitado o parâmetro sai fora inteiro: `amount=0` é um
 * pedido de pagar zero, não "pergunte quanto".
 * Rune não tem equivalente disto, então o DOG não ganha URI inventada.
 */
export function bip21Uri(address: string, sats: number, label: string = BIP21_LABEL): string {
  const params: string[] = []
  if (sats > 0) {
    const btc = (Math.round(sats) / 1e8).toFixed(8).replace(/\.?0+$/, '')
    params.push(`amount=${btc}`)
  }
  params.push(`label=${label}`)
  return `bitcoin:${address}?${params.join('&')}`
}
