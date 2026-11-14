// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS: o catálogo dos carros à venda no DOG CITY e o preço de cada um em $DOG.
//
// Os 18 modelos são os da concessionária do jogo (dogcity-mundo, src/jogador/tipos_carro.ts, os mesmos ids
// que a corrida usa em lib/game/race/models.ts do PR #61). Nome de marca não se traduz.
//
// PREÇOS DEFINIDOS PELO FUNDADOR em 13/11/2026: a tabela provisória dividida por dois, com o topo (os dois
// supercarros) em 250.000 $DOG, metade da licença Patron, e o mais barato (os Fuscas) em 10.000 $DOG. Mudar preço =
// mudar aqui E em `car_models` (migração 039 ou um update no banco) com os MESMOS números. O preço só vale quando o código e o banco concordam
// (lib/game/cars/order.ts): um lugar sozinho, mexido por engano, não muda o que se cobra.
//
// O preço é FIXO em $DOG por modelo. Em BTC paga-se o equivalente pela mediana das corretoras, travada por
// 15 minutos, pela MESMA régua da licença (lib/dog/licence-btc.ts, lib/dog/price-sources.ts).
// ═══════════════════════════════════════════════════════════════════════════

/** true = os preços abaixo são marcadores e nada se vende. false desde 13/11: os preços são os do fundador. A loja
 *  continua fechada até existirem os dois endereços próprios (CAR_FUND_BTC_ADDRESS e CAR_FUND_DOG_ADDRESS). */
export const PRECOS_PROVISORIOS = false

/** teto absoluto do preço de um carro em $DOG: preço acima disto é erro de digitação, não preço */
export const MAX_CAR_PRICE_DOG = 5_000_000
/** piso do preço de um carro em $DOG */
export const MIN_CAR_PRICE_DOG = 1_000

export type CarClass = 'super' | 'sport' | 'luxury' | 'classic' | 'muscle' | 'offroad' | 'popular'

export interface CarModel {
  id: string
  /** nome de marca, não se traduz */
  name: string
  class: CarClass
  /** preço em $DOG inteiro (sem casas) */
  priceDog: number
}

const car = (id: string, name: string, cls: CarClass, priceDog: number): CarModel => Object.freeze({ id, name, class: cls, priceDog })

// ⚠️ PROVISÓRIO: preços de marcação, NÃO são os reais.
const LIST: ReadonlyArray<CarModel> = [
  car('c02', 'DOG Centurion', 'super', 250_000),
  car('c05', 'DOG Revolt', 'super', 250_000),
  car('c15', 'DOG Bison', 'sport', 75_000),
  car('c39', 'DOG Horizon R', 'sport', 60_000),
  car('c40', 'DOG Apex 90', 'sport', 60_000),
  car('c41', 'DOG Surge IV', 'sport', 60_000),
  car('c10', 'DOG Sovereign', 'luxury', 100_000),
  car('c25', 'DOG Turbo 75', 'classic', 40_000),
  car('c26', 'DOG Gullwing 54', 'classic', 40_000),
  car('c28', 'DOG Monarch GT', 'classic', 40_000),
  car('c62', 'DOG Breeze', 'classic', 30_000),
  car('c30', 'DOG Cutter 71', 'muscle', 35_000),
  car('c32', 'DOG Stallion', 'muscle', 35_000),
  car('c61', 'DOG Stallion 65 Convertible', 'muscle', 35_000),
  car('c42', 'DOG Field 41', 'offroad', 25_000),
  car('c43', 'DOG Outpost 110', 'offroad', 25_000),
  car('c52', 'DOG Bug', 'popular', 10_000),
  car('c56', 'DOG Bug Classic', 'popular', 10_000),
]

export const CAR_MODELS: Readonly<Record<string, CarModel>> = Object.freeze(Object.fromEntries(LIST.map((m) => [m.id, m])))
export const CAR_MODEL_IDS: ReadonlyArray<string> = Object.freeze(LIST.map((m) => m.id))

/** id de modelo do catálogo (só chave própria: `__proto__`, `toString` e afins não passam) */
export function isCarModel(v: unknown): v is string {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CAR_MODELS, v)
}

/** preço válido: inteiro seguro, dentro do piso e do teto. Qualquer outra coisa (NaN, Infinity, negativo, fração) não é preço. */
export function validPriceDog(p: unknown): p is number {
  return typeof p === 'number' && Number.isSafeInteger(p) && p >= MIN_CAR_PRICE_DOG && p <= MAX_CAR_PRICE_DOG
}

/** o catálogo inteiro tem preço válido (conferido no teste e na rota: um preço torto fecha a venda) */
export function catalogIsSane(models: ReadonlyArray<CarModel> = LIST): boolean {
  const ids = new Set<string>()
  for (const m of models) {
    if (!/^c[0-9]{2}$/.test(m.id) || ids.has(m.id) || !validPriceDog(m.priceDog) || !m.name) return false
    ids.add(m.id)
  }
  return ids.size > 0
}
