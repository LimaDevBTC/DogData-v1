// Stub do sats-connect para testes em Node (o pacote real não carrega fora do
// bundler). Qualquer chamada falha alto: o caminho da UniSat não pode depender dele.
const nao = (nome: string) => () => { throw new Error(`sats-connect.${nome} chamado no teste`) }
export const request = async () => { throw new Error('sats-connect.request chamado no teste') }
export const getProviders = () => []
export const isProviderInstalled = () => false
export const setDefaultProvider = nao('setDefaultProvider')
export const removeDefaultProvider = nao('removeDefaultProvider')
export const AddressPurpose = { Ordinals: 'ordinals', Payment: 'payment' }
export const BitcoinNetworkType = { Mainnet: 'Mainnet' }
export const MessageSigningProtocols = { BIP322: 'BIP322' }
