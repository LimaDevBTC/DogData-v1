// Mensagem-desafio canônica (compartilhada client/server — SEM deps de node).
// A prova de posse assina exatamente esta string; o servidor guarda a mesma
// string no Redis junto do nonce e compara contra ela, então mexer aqui não
// invalida nenhum desafio já emitido.
//
// ⚠️ ESTE TEXTO É TELA, não comentário: é o que a carteira mostra dentro do
// popup de assinatura, para um público que lê o site em inglês. Toda linha
// nova aqui entra em inglês.

export const CHALLENGE_TTL_SECONDS = 300

// O desafio diz para QUEM a posse esta sendo provada. Sem esta linha um site
// falso podia repassar o nosso desafio a vitima e ficar com a sessao
// (phishing de sessao) sem nada no popup da carteira que o denunciasse; com
// ela, o dominio aparece no texto assinado. E fixa no dominio
// canonico, inclusive quando o pedido vem da /city servida pelo rewrite do
// jogo novo (mesma origem) ou de um preview: o que se prova e posse perante o
// DOG DATA, nao perante um host de deploy. Mudar o texto nao invalida desafio
// ja emitido (o verify compara com a string guardada no Redis).
export const CHALLENGE_URI = 'https://www.dogdata.xyz'

export function buildChallengeMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    'DOG DATA · Proof of ownership',
    '',
    'Sign this message to prove this address is yours.',
    'It is free, it moves no coins and it grants no spending permission.',
    '',
    `URI: ${CHALLENGE_URI}`,
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
    `Valid for: ${CHALLENGE_TTL_SECONDS / 60} minutes`,
  ].join('\n')
}
