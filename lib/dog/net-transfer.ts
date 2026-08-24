/**
 * Quanto DOG realmente mudou de mão numa transação.
 *
 * ⚠️ O TROCO NÃO É TRANSFERÊNCIA, e confundir os dois é a diferença entre uma
 * doação de 600 mil e uma de 10 mil. Rune vive num UTXO: para mandar 10 mil de um
 * UTXO que tem 600 mil, você gasta o UTXO inteiro, manda 10 mil para o destino e
 * os outros 590 mil voltam para você. A entrada da transação é 600 mil. O que
 * aconteceu no mundo foi 10 mil.
 *
 * ⚠️ O PIPELINE DAS CONFIRMADAS JÁ SABIA DISSO. `update-transactions` calcula
 * `net_transfer = total_dog_out - total_to_self` desde sempre, e é esse número
 * que vai para `total_dog_moved`. O da mempool nasceu depois e nunca aprendeu:
 * mostrava `dog_in` na cara do foguete, no balão da praça e na lista. Este
 * arquivo existe para a lição morar em UM lugar só, e para as duas telas
 * responderem a mesma coisa sobre a mesma transação.
 *
 * ⚠️ SEM REMETENTE NÃO DÁ PARA SABER. Quando a lista de remetentes está vazia
 * (o watcher ainda não resolveu, ou a origem está fora do conjunto de UTXOs que
 * ele conhece), não existe como separar troco de pagamento. Aí o valor bruto é a
 * melhor leitura que temos, e o `kind` sai como 'unknown' para a tela poder
 * dizer isso em vez de fingir precisão.
 */

/** O remetente vem como endereço cru na mempool e como objeto nas confirmadas. */
export type SenderLike = string | { address?: string | null }
/** O destinatário chama o campo de `dog` na mempool e de `amount_dog` nas confirmadas. */
export type ReceiverLike = {
  address?: string | null
  dog?: number | string | null
  amount_dog?: number | string | null
}

export interface NetTransfer {
  /** o que mudou de dono */
  net: number
  /** o que voltou para quem mandou */
  change: number
  /** a soma de todas as saídas, troco incluído */
  gross: number
  /** transfer: alguém recebeu · self: só juntou os próprios UTXOs · unknown: sem remetente */
  kind: 'transfer' | 'self' | 'unknown'
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function netTransfer(senders: SenderLike[] | null | undefined, receivers: ReceiverLike[] | null | undefined): NetTransfer {
  const saidas = (receivers || []).map((r) => ({
    address: r.address || '',
    dog: num(r.dog ?? r.amount_dog),
  }))
  const gross = saidas.reduce((s, r) => s + r.dog, 0)

  const de = new Set(
    (senders || [])
      .map((s) => (typeof s === 'string' ? s : s?.address || ''))
      .filter(Boolean),
  )
  if (de.size === 0) return { net: gross, change: 0, gross, kind: 'unknown' }

  const change = saidas.reduce((s, r) => (de.has(r.address) ? s + r.dog : s), 0)
  // ⚠️ o piso em zero é de propósito: arredondamento em `numeric` já produziu
  // troco um fio maior que a saída, e um "-0,00001 DOG" na tela não é verdade,
  // é ruído de ponto flutuante vazando para o leitor.
  const net = Math.max(gross - change, 0)
  return { net, change, gross, kind: net === 0 && gross > 0 ? 'self' : 'transfer' }
}

/** O número que vai para a tela: o que mudou de mão, ou o bruto quando não dá para saber. */
export function movedDog(senders: SenderLike[] | null | undefined, receivers: ReceiverLike[] | null | undefined): number {
  return netTransfer(senders, receivers).net
}
