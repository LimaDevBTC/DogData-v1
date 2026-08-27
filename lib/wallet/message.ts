// Mensagem-desafio canônica (compartilhada client/server — SEM deps de node).
// A prova de posse assina exatamente esta string; o servidor guarda a mesma
// string no Redis junto do nonce e compara contra ela, então mexer aqui não
// invalida nenhum desafio já emitido.
//
// ⚠️ ESTE TEXTO É TELA, não comentário: é o que a carteira mostra dentro do
// popup de assinatura, para um público que lê o site em inglês. Toda linha
// nova aqui entra em inglês.

export const CHALLENGE_TTL_SECONDS = 300

export function buildChallengeMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    'DOG DATA · Proof of ownership',
    '',
    'Sign this message to prove this address is yours.',
    'It is free, it moves no coins and it grants no spending permission.',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
    `Valid for: ${CHALLENGE_TTL_SECONDS / 60} minutes`,
  ].join('\n')
}
