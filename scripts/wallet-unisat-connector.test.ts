// Conector e doação da UniSat contra um provider falso no formato documentado
// (unisat-wallet/unisat-dev-docs). Rodar: npx tsx --tsconfig scripts/test-stubs/tsconfig.json scripts/wallet-unisat-connector.test.ts
// (o sats-connect real não carrega em Node; o tsconfig de teste troca por um stub que falha alto)
import { createUnisatConnector } from '../lib/wallet/connectors/unisat'
import { donationSupport, readDogBalance, sendBtcDonation, sendDogDonation, DOG_RUNE_ID } from '../lib/wallet/donate'

const TR = 'bc1pgd5gkd7c9h0eulkl4d6tynfnvhjr0ng6sf0w4g24hq2zm4ty3e7svyxq8y'
const WPKH = 'bc1q5kmvl0ghnqls5s64zsfkxs7pl6y6xcp0n6uqar'
const LEG = '1G7DTEBhMFgt8sXtZMuNKwjhDXnApbLiu8'
const TXID = 'ab'.repeat(32)

let falhas = 0
const conf = (nome: string, cond: boolean) => {
  console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}`)
  if (!cond) falhas++
}
const erro = async (f: () => Promise<unknown>) => {
  try { await f(); return '' } catch (e: any) { return String(e?.message) }
}

function falsa(o: Partial<Record<string, any>> = {}) {
  const log: any[] = []
  const st = { conta: o.conta ?? TR, chain: o.chain ?? 'BITCOIN_MAINNET', trocaFalha: !!o.trocaFalha }
  const p: any = {
    log, st,
    requestAccounts: async () => { log.push(['requestAccounts']); if (o.recusa) throw { code: 4001, message: 'User rejected the request.' }; return [st.conta] },
    getAccounts: async () => [st.conta],
    getPublicKey: async () => '02' + '11'.repeat(32),
    getChain: async () => ({ enum: st.chain, name: st.chain === 'BITCOIN_MAINNET' ? 'Bitcoin Mainnet' : 'Bitcoin Testnet', network: 'livenet' }),
    switchChain: async (c: string) => { log.push(['switchChain', c]); if (st.trocaFalha) throw { code: 4001, message: 'User rejected' }; st.chain = c; return p.getChain() },
    signMessage: async (m: string, t: string) => { log.push(['signMessage', t]); return 'c2ln' },
    sendBitcoin: async (to: string, sats: number) => { log.push(['sendBitcoin', to, sats]); return TXID },
    sendRunes: async (to: string, id: string, amt: string) => { log.push(['sendRunes', to, id, amt]); return { txid: TXID } },
    on: () => {}, removeListener: () => {},
  }
  return p
}
const instala = (p: any, nome = 'unisat_wallet') => { (globalThis as any).window = { [nome]: p } }

;(async () => {
  // conexão normal, taproot
  let p = falsa(); instala(p)
  const c = createUnisatConnector()
  conf('detecta window.unisat_wallet', c.isInstalled())
  const acc = await c.connect()
  conf('ordinals = pagamento = o endereço da conta', acc.ordinalsAddress === TR && acc.paymentAddress === TR && acc.walletId === 'unisat')
  const s1 = await c.signMessage(TR, 'm')
  conf('taproot assina em bip322-simple', s1.protocol === 'bip322' && p.log.at(-1)[1] === 'bip322-simple')

  // prefere unisat_wallet ao window.unisat de um fork
  const fork = falsa({ conta: WPKH }); (globalThis as any).window = { unisat: fork, unisat_wallet: p }
  conf('prefere unisat_wallet ao window.unisat', (await createUnisatConnector().connect()).ordinalsAddress === TR)

  // só window.unisat (versão antiga)
  p = falsa({ conta: WPKH }); instala(p, 'unisat')
  conf('aceita window.unisat em versão antiga e segwit nativo', (await createUnisatConnector().connect()).ordinalsAddress === WPKH)

  // legado assina em ecdsa
  p = falsa({ conta: LEG }); instala(p)
  await createUnisatConnector().connect()
  const s2 = await createUnisatConnector().signMessage(LEG, 'm')
  conf('legado 1... assina em ecdsa', s2.protocol === 'ecdsa' && p.log.at(-1)[1] === 'ecdsa')

  // rede errada: troca para mainnet
  p = falsa({ chain: 'BITCOIN_TESTNET' }); instala(p)
  await createUnisatConnector().connect()
  conf('troca de testnet para mainnet', p.log.some((l: any[]) => l[0] === 'switchChain' && l[1] === 'BITCOIN_MAINNET'))

  // recusa a troca: não conecta
  p = falsa({ chain: 'BITCOIN_TESTNET', trocaFalha: true }); instala(p)
  conf('recusa da troca de rede barra a conexão', /mainnet only/i.test(await erro(() => createUnisatConnector().connect())))

  // recusa da conexão
  p = falsa({ recusa: true }); instala(p)
  conf('recusa da conexão vira frase', /cancelled/i.test(await erro(() => createUnisatConnector().connect())))

  // endereço que não é de mainnet
  p = falsa({ conta: 'tb1qrn7tvhdf6wnh790384ahj56u0xaa0kqgautnnz' }); instala(p)
  conf('endereço de testnet é recusado', /cannot verify/i.test(await erro(() => createUnisatConnector().connect())))

  // conta trocada entre conectar e assinar
  p = falsa(); instala(p); await createUnisatConnector().connect(); p.st.conta = WPKH
  conf('conta trocada antes de assinar é barrada', /another account/i.test(await erro(() => createUnisatConnector().signMessage(TR, 'm'))))

  // doação
  p = falsa(); instala(p)
  conf('doação pela UniSat é por clique', donationSupport('unisat') === 'rpc')
  conf('sem saldo de runa documentado: null', (await readDogBalance('unisat')) === null)
  const d = await sendDogDonation('unisat', TR, 1234.5, 5)
  const r = p.log.at(-1)
  conf('DOG vai em unidade atômica e com o id da runa', r[0] === 'sendRunes' && r[2] === DOG_RUNE_ID && r[3] === '123450000' && d.txid === TXID)
  const bt = await sendBtcDonation('unisat', TR, 50000.4)
  conf('BTC vai em sats inteiros', p.log.at(-1)[2] === 50000 && bt.txid === TXID)
  p.sendRunes = async () => { throw { code: 4001, message: 'User rejected the request.' } }
  conf('recusa na doação vira "Cancelled"', /cancelled in your wallet/i.test(await erro(() => sendDogDonation('unisat', TR, 1, 5))))
  p.sendRunes = async () => 'nao-e-txid'
  conf('resposta sem txid válido é barrada', /transaction id/i.test(await erro(() => sendDogDonation('unisat', TR, 1, 5))))
  delete p.sendRunes
  conf('versão sem sendRunes manda para o caminho manual', /cannot send from inside a site/i.test(await erro(() => sendDogDonation('unisat', TR, 1, 5))))
  ;(globalThis as any).window = {}
  conf('sem extensão: doação manual', donationSupport('unisat') === 'manual')

  console.log(falhas ? `${falhas} falha(s)` : 'tudo certo')
  process.exit(falhas ? 1 : 0)
})()
