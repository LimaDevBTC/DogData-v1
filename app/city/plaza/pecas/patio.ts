// Patio de Manobra: infraestrutura de borda da DogCity na Lua
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Chao da parcela inteira em COR.ESCURO, base em Y.PARCELA
  p.chao(COR.ESCURO, -a, -b, a, b, Y.PARCELA)

  // Seis trilhos de manobra em COR.CLARO, espaçados uniformemente em z
  // Cada trilho: largura 2*a - 40 em x, espessura 2,5 m em z, altura Y.L1
  for (let k = 0; k <= 5; k++) {
    const z = -b + 30 + k * ((2 * b - 60) / 5)
    p.chao(COR.CLARO, -a + 20, z - 1.25, a - 20, z + 1.25, Y.L1)
  }

  // Galpao: volume em COR.MEDIO
  // Dimensoes: a*0.7 de largura, 12 m de altura, b*0.5 de profundidade
  // Posicao em x deslocada para esquerda em -a*0.45
  p.vol(COR.MEDIO, -a * 0.45, 0, a * 0.35, 12, b * 0.25, 0)

  // Doze vagoes em duas filas
  // Dimensoes: 24 m x 4,5 m x altura variavel
  // Altura alterna entre 4,5 e 6 m por ruido
  for (let k = 0; k <= 5; k++) {
    const x = -a + 90 + k * 70
    const altura = c.ruido(k) > 0.5 ? 6 : 4.5

    // Fila 1: z = -b + 60
    p.vol(COR.MEDIO, x, -b + 60, 12, altura, 2.25, 0)

    // Fila 2: z = b - 60
    p.vol(COR.MEDIO, x, b - 60, 12, altura, 2.25, 0)
  }

  // Torre de Controle: cilindro em COR.CLARO
  // Raio 6 m, altura 26 m, posicao em x = a - 60
  p.cilindro(COR.CLARO, a - 60, 0, 6, 26)

  return p.fechar()
}
