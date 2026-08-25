// Mensagem-desafio canônica (compartilhada client/server — SEM deps de node).
// A prova de posse assina exatamente esta string; o servidor a reconstrói a partir do nonce.

export const CHALLENGE_TTL_SECONDS = 300

export function buildChallengeMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    'DOG DATA • Prova de propriedade',
    `Endereço: ${address}`,
    `Nonce: ${nonce}`,
    `Emitido: ${issuedAt}`,
  ].join('\n')
}
