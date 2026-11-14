// ═══════════════════════════════════════════════════════════════════════════
// A LOJA ABERTA OU FECHADA: os endereços que recebem o dinheiro dos carros.
//
// O carro recebe em endereços PRÓPRIOS, separados dos da licença:
//   CAR_FUND_BTC_ADDRESS   onde se paga em BTC
//   CAR_FUND_DOG_ADDRESS   onde se paga em $DOG
// Assim o dinheiro do carro nunca entra no placar da licença, no livro dos founders nem no gatilho dos
// 10.000.000 $DOG do mint: esses leem SÓ os endereços do fundo (lib/dog/licence-btc.ts, FUND_*), e esta
// configuração recusa um endereço de carro igual a um deles.
//
// Falha fechada: variável ausente, vazia, endereço que não é de mainnet, igual a um endereço do fundo da
// licença, ou preço ainda provisório (lib/game/cars/catalog.ts) = loja FECHADA. Loja fechada: toda rota de
// compra responde 503 `sales_closed` e o cron não faz nada. As variáveis são só LIDAS aqui; quem as cria na
// Vercel é o fundador.
// ═══════════════════════════════════════════════════════════════════════════
import { FUND_BTC_ADDRESS, FUND_DOG_ADDRESS, normalizeAddress } from '@/lib/dog/licence-btc'
import { PRECOS_PROVISORIOS, catalogIsSane } from './catalog'

export type SalesClosedReason = 'no_btc_address' | 'no_dog_address' | 'licence_address' | 'provisional_prices' | 'bad_catalog' | 'not_open'

export type CarSales =
  | { open: true; btcAddress: string; dogAddress: string }
  | { open: false; reason: SalesClosedReason }

const LICENCE_ADDRESSES = new Set([FUND_BTC_ADDRESS.toLowerCase(), FUND_DOG_ADDRESS.toLowerCase()])

export function carSales(
  env: Record<string, string | undefined> = process.env,
  opts: { provisional?: boolean; catalogOk?: boolean } = {},
): CarSales {
  const btc = normalizeAddress(env.CAR_FUND_BTC_ADDRESS)
  const dog = normalizeAddress(env.CAR_FUND_DOG_ADDRESS)
  if (!btc) return { open: false, reason: 'no_btc_address' }
  if (!dog) return { open: false, reason: 'no_dog_address' }
  if (LICENCE_ADDRESSES.has(btc.toLowerCase()) || LICENCE_ADDRESSES.has(dog.toLowerCase())) return { open: false, reason: 'licence_address' }
  if (opts.catalogOk ?? catalogIsSane()) {
    if (opts.provisional ?? PRECOS_PROVISORIOS) return { open: false, reason: 'provisional_prices' }
    // a chave de abertura (13/11): mesmo com endereços, preços e banco prontos, só vende com CAR_SALES_OPEN=1. Ela
    // existe porque o jogo precisa entregar o carro comprado antes de a loja abrir; quem liga é o fundador.
    if ((env.CAR_SALES_OPEN ?? '').trim() !== '1') return { open: false, reason: 'not_open' }
    return { open: true, btcAddress: btc, dogAddress: dog }
  }
  return { open: false, reason: 'bad_catalog' }
}
