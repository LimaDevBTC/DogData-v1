// Referral: a CONTA do que cada carteira indicada fez DEPOIS do vinculo. Modulo puro, sem rede e sem banco.
//
// O que conta (fase 1, so contar):
//  * mint: lotes da carteira indicada cuja escritura foi cunhada (bloco da transacao reveal)
//    DEPOIS do bloco do vinculo;
//  * licenca: o que a carteira indicada pagou ao fundo de construcao DEPOIS do vinculo, em $DOG
//    (livro dos founders) e em BTC (credit_dog travado em dogcity_btc_payments). O degrau e' o que
//    esses pagamentos POSTERIORES somam, na mesma escada da licenca (Personal 10.000, Commercial
//    50.000, Patron 500.000). Pagamento anterior ao vinculo nunca entra, mesmo que a soma total da
//    carteira chegue a um degrau maior: o programa nao paga indicacao por algo que ja existia.
//
// "DEPOIS" (isAfterLink): ESTRITAMENTE depois do bloco do vinculo (o evento tem de ter confirmado
// num bloco maior). Se um dos lados nao tem bloco, compara por tempo (o do bloco do evento contra
// o instante do vinculo). Sem bloco nem tempo no evento: NAO conta (falha fechada).

import { combineWallet, licenceFor, type LicenceKey } from '../dog/licence-btc'

export interface LinkFact {
  referred: string
  referrer: string
  linkedAtMs: number
  linkedBlock: number | null
}

export interface ChainEvent {
  /** a altura do bloco em que o evento confirmou, ou null se nao se sabe */
  block: number | null
  /** o tempo do bloco (ou do credito) em ms, ou null */
  timeMs: number | null
}

export interface MintedLot extends ChainEvent {
  lotId: string
}

export interface Payment extends ChainEvent {
  kind: 'dog' | 'btc'
  /** valor em $DOG (no BTC, o credit_dog da cotacao travada) */
  dog: number
}

export function isAfterLink(link: Pick<LinkFact, 'linkedAtMs' | 'linkedBlock'>, ev: ChainEvent): boolean {
  if (link.linkedBlock !== null && ev.block !== null) return ev.block > link.linkedBlock
  if (ev.timeMs !== null && Number.isFinite(ev.timeMs)) return ev.timeMs > link.linkedAtMs
  return false
}

export interface WalletProgress {
  /** lotes cunhados depois do vinculo */
  mintedLots: number
  /** o primeiro bloco de mint depois do vinculo, ou null */
  firstMintBlock: number | null
  /** $DOG pago ao fundo depois do vinculo (DOG + BTC com o teto por carteira) */
  licenceDog: number
  /** o degrau que esse valor alcanca; 'citizen' = abaixo de Personal = nao e' licenca */
  tier: LicenceKey
}

export function walletProgress(link: LinkFact, lots: MintedLot[], payments: Payment[]): WalletProgress {
  const mintedAfter = lots.filter((l) => isAfterLink(link, l))
  const blocks = mintedAfter.map((l) => l.block).filter((b): b is number => b !== null)
  let dog = 0
  let btc = 0
  for (const p of payments) {
    if (!(p.dog > 0) || !Number.isFinite(p.dog)) continue
    if (!isAfterLink(link, p)) continue
    if (p.kind === 'btc') btc += p.dog
    else dog += p.dog
  }
  const licenceDog = combineWallet(dog, btc)
  return {
    mintedLots: mintedAfter.length,
    firstMintBlock: blocks.length ? Math.min(...blocks) : null,
    licenceDog,
    tier: licenceFor(licenceDog),
  }
}
