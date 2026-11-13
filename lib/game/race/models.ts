// Os modelos que correm a perimetral AN7 (PLANO_CORRIDA_PERIMETRAL.md) e a velocidade maxima de cada um.
//
// ESPELHO do jogo: `vmaxKmh` e' o `motor.velocidadeMax` do tipo em `src/jogador/tipos_carro.ts` (dogcity-mundo, funcao `vMaxDoTipo`:
// os 18 carros da DOG MOTORS) e, para a Cyber e a Moto2, o `MODELOS_CORRIDA` de `src/corrida/modelos.ts` (210 e 350). E' esta
// tabela que o servidor usa no piso de tempo por trecho (distancia / (1,05 x Vmax)): carro novo na DOG MOTORS = uma linha aqui,
// com a mesma velocidade do jogo, antes de ele correr valendo.
//
// `premio`: so' os 18 carros da DOG MOTORS dao carro de premio. A Cyber e a Moto2 sao veiculos de licenca: entram no ranking, sem premio.
export interface ModeloCorrida {
  id: string
  /** nome de marca, nao se traduz */
  nome: string
  vmaxKmh: number
  /** o modelo vale um carro de premio (campeonato e desafio permanente) */
  premio: boolean
}

const licenca = (id: string, nome: string, vmaxKmh: number): ModeloCorrida => ({ id, nome, vmaxKmh, premio: false })
const dogMotors = (id: string, nome: string, vmaxKmh: number): ModeloCorrida => ({ id, nome, vmaxKmh, premio: true })

const LISTA: ReadonlyArray<ModeloCorrida> = [
  licenca('cyber', 'Cyber $DOG', 210),
  licenca('moto2', 'Moto2', 350),
  // supercarros
  dogMotors('c02', 'DOG Centurion', 350),
  dogMotors('c05', 'DOG Revolt', 350),
  // esportivos
  dogMotors('c15', 'DOG Bison', 300),
  dogMotors('c39', 'DOG Horizon R', 280),
  dogMotors('c40', 'DOG Apex 90', 270),
  dogMotors('c41', 'DOG Surge IV', 285),
  // luxo
  dogMotors('c10', 'DOG Sovereign', 250),
  // classicos
  dogMotors('c25', 'DOG Turbo 75', 230),
  dogMotors('c26', 'DOG Gullwing 54', 225),
  dogMotors('c28', 'DOG Monarch GT', 228),
  dogMotors('c62', 'DOG Breeze', 205),
  // muscle
  dogMotors('c30', 'DOG Cutter 71', 205),
  dogMotors('c32', 'DOG Stallion', 225),
  dogMotors('c61', 'DOG Stallion 65 Convertible', 210),
  // off-road
  dogMotors('c42', 'DOG Field 41', 160),
  dogMotors('c43', 'DOG Outpost 110', 175),
  // populares
  dogMotors('c52', 'DOG Bug', 140),
  dogMotors('c56', 'DOG Bug Classic', 150),
]

export const MODELOS_CORRIDA: Readonly<Record<string, ModeloCorrida>> = Object.freeze(
  Object.fromEntries(LISTA.map((m) => [m.id, Object.freeze(m)])),
)

export const IDS_MODELOS: ReadonlyArray<string> = LISTA.map((m) => m.id)
/** Os que dao carro de premio (os 18 da DOG MOTORS). */
export const IDS_MODELOS_COM_PREMIO: ReadonlyArray<string> = LISTA.filter((m) => m.premio).map((m) => m.id)

export function ehModeloCorrida(v: unknown): v is string {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODELOS_CORRIDA, v)
}

/** Vmax do modelo em m/s. Modelo desconhecido: lanca (quem chama ja' validou com `ehModeloCorrida`). */
export function vmaxMs(id: string): number {
  const m = MODELOS_CORRIDA[id]
  if (!m) throw new Error(`modelo de corrida desconhecido: ${id}`)
  return m.vmaxKmh / 3.6
}

export function modeloTemPremio(id: string): boolean {
  return MODELOS_CORRIDA[id]?.premio === true
}
