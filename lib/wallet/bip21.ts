// O pedido de pagamento do BIP-21, puro, para a tela poder ser testada sem navegador.
// Saiu de components/donate/donate-modal.tsx sem mudar uma linha da conta.

export const BIP21_LABEL = encodeURIComponent('DogCity construction fund')

/**
 * `bitcoin:<endereco>?amount=<btc>&label=…`, o pedido de pagamento do BIP-21.
 * ⚠️ O amount é em BTC com ponto decimal, NUNCA em satoshi, e o campo daqui é
 * em satoshi. Sem valor digitado o parâmetro sai fora inteiro: `amount=0` é um
 * pedido de pagar zero, não "pergunte quanto".
 * Rune não tem equivalente disto, então o DOG não ganha URI inventada.
 */
export function bip21Uri(address: string, sats: number): string {
  const params: string[] = []
  if (sats > 0) {
    const btc = (Math.round(sats) / 1e8).toFixed(8).replace(/\.?0+$/, '')
    params.push(`amount=${btc}`)
  }
  params.push(`label=${BIP21_LABEL}`)
  return `bitcoin:${address}?${params.join('&')}`
}
