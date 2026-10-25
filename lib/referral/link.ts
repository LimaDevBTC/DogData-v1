// Referral: a regra do VINCULO carteira -> indicador. Modulo puro: o banco entra por `ReferralStore`.
//
// Quando roda: dentro de POST /api/wallet/verify, DEPOIS que a assinatura conferiu. O vinculo e'
// gravado pelo servidor com o ref que veio no corpo do pedido. Falhar FECHADO: na duvida nao
// vincula, e NADA aqui pode derrubar o verify (a funcao nunca lanca; o chamador ainda poe prazo).
//
// As regras (decisao do fundador, 25/10/2026, fase 1: so contar):
//  1. so vincula a carteira que verifica pela PRIMEIRA vez. Quem ja tinha verificado antes nao
//     pode ser "capturado" por um link. "Antes" = ja estava em wallet_first_verify, ou ja tem
//     perfil ou ponte de analytics (verificou antes da tabela existir), ou o navegador ja trazia
//     sessao verificada para este mesmo endereco;
//  2. um indicador por carteira, o primeiro, para sempre (chave unica + trigger no banco);
//  3. indicar a si mesmo nao vale: mesma carteira, ou o handle de quem esta verificando;
//  4. o ref tem de ser de conta verificada existente (handle so nasce com sessao provada);
//  5. ref invalido, desconhecido ou fora de regra e' IGNORADO EM SILENCIO.
//
// A carteira e' SEMPRE registrada como "ja verificou" (markFirstVerify), tenha vindo ref ou nao:
// e' isso que torna a regra 1 verdadeira para o link que aparecer depois.

import { normalizeAddress } from '../dog/licence-btc'
import { parseRef } from './ref'

export type SkipReason =
  | 'bad_address'
  | 'no_ref'
  | 'bad_ref'
  | 'known_wallet'
  | 'unknown_ref'
  | 'self'
  | 'already_linked'
  | 'error'

export interface LinkOutcome {
  linked: boolean
  reason?: SkipReason
}

export interface NewLink {
  referredAddress: string
  referrerAddress: string
  /** o handle de quem indica no instante do vinculo (auditoria; a chave e' o endereco) */
  referrerHandle: string
  /** a altura da ponta da cadeia no instante do vinculo, ou null se nao deu para ler */
  linkedBlock: number | null
}

export interface ReferralStore {
  /** O endereco ja deu sinal de ter verificado antes desta chamada (perfil, ponte de analytics). Lanca se nao souber. */
  wasKnownBefore(address: string): Promise<boolean>
  /** Registra o endereco como verificado. true SO se esta chamada criou o registro (atomico: chave primaria). */
  markFirstVerify(address: string): Promise<boolean>
  /** O endereco da conta verificada que tem este handle, ou null. */
  referrerOf(handle: string): Promise<string | null>
  /** A altura da ponta da cadeia agora, ou null. */
  chainTip(): Promise<number | null>
  /** Grava o vinculo. true SO se inseriu (a chave unica por carteira indicada recusa o segundo). */
  insertLink(link: NewLink): Promise<boolean>
}

export interface VerifyInput {
  /** o endereco que acabou de provar a posse */
  address: string
  /** o campo `ref` do corpo do pedido, como veio (nao confiavel) */
  ref: unknown
  /** o endereco da sessao verificada que o navegador JA trazia (cookie anterior), se houver */
  priorSessionAddress?: string | null
}

export async function linkOnVerify(input: VerifyInput, store: ReferralStore): Promise<LinkOutcome> {
  try {
    const address = normalizeAddress(input.address)
    if (!address) return { linked: false, reason: 'bad_address' }

    // Registra SEMPRE, com ou sem ref. Se a gravacao falhar, nao da para afirmar que e' a primeira vez.
    let first = false
    try {
      first = await store.markFirstVerify(address)
    } catch (e) {
      console.error('[referral] markFirstVerify:', (e as Error)?.message)
    }

    const rawRef = input.ref
    if (rawRef === undefined || rawRef === null || rawRef === '') return { linked: false, reason: 'no_ref' }
    const handle = parseRef(rawRef)
    if (!handle) return { linked: false, reason: 'bad_ref' }

    if (!first) return { linked: false, reason: 'known_wallet' }

    // sessao verificada anterior para o MESMO endereco: ja verificou antes (mesmo sem registro)
    const prior = input.priorSessionAddress ? normalizeAddress(input.priorSessionAddress) : null
    if (prior && prior === address) return { linked: false, reason: 'known_wallet' }
    // perfil ou ponte de analytics: verificou antes da tabela existir. Erro = nao sabe = nao vincula.
    if (await store.wasKnownBefore(address)) return { linked: false, reason: 'known_wallet' }

    const referrer = await store.referrerOf(handle)
    const referrerAddress = referrer ? normalizeAddress(referrer) : null
    if (!referrerAddress) return { linked: false, reason: 'unknown_ref' }
    if (referrerAddress === address) return { linked: false, reason: 'self' }

    const linkedBlock = await store.chainTip().catch(() => null)
    const inserted = await store.insertLink({
      referredAddress: address,
      referrerAddress,
      referrerHandle: handle,
      linkedBlock: Number.isSafeInteger(linkedBlock) && (linkedBlock as number) > 0 ? (linkedBlock as number) : null,
    })
    return inserted ? { linked: true } : { linked: false, reason: 'already_linked' }
  } catch (e) {
    console.error('[referral] linkOnVerify:', (e as Error)?.message)
    return { linked: false, reason: 'error' }
  }
}
