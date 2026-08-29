// Reservatorio do Cinturao: tanques de agua, bacias de contencao e casa de bombas
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Moldura de calcada na borda
  p.moldura()

  // Chao base em toda a parcela
  p.chao(COR.ESCURO, -a, -b, a, b, Y.PARCELA)

  // Bacias de contencao sob cada fileira de tanques
  // Cada bacia tem dimensao (2*a - 60) x 70
  const baciasX0 = -(a - 30)
  const baciasX1 = a - 30
  const baciasHalfDepth = 35 // metade de 70

  // Bacia em z = -b + 70
  p.chao(COR.MEDIO, baciasX0, -b + 70 - baciasHalfDepth, baciasX1, -b + 70 + baciasHalfDepth, Y.L1)

  // Bacia em z = b - 70
  p.chao(COR.MEDIO, baciasX0, b - 70 - baciasHalfDepth, baciasX1, b - 70 + baciasHalfDepth, Y.L1)

  // Seis tanques em grade 3x2, raio 26
  const zLinhas = [-b + 70, b - 70]

  for (let linha = 0; linha < 2; linha++) {
    for (let col = 0; col < 3; col++) {
      // Posicao x conforme formula: -a + 60 + i*((2*a - 120) / 2)
      // col 0: -a + 60, col 1: 0, col 2: a - 60
      const xTanque = -a + 60 + col * ((2 * a - 120) / 2)
      const zTanque = zLinhas[linha]

      // Altura varia por coluna: 18 + (col % 3) * 4
      // col 0: 18 m, col 1: 22 m, col 2: 26 m
      const alturaTanque = 18 + (col % 3) * 4

      // Cilindro com raio 26
      p.cilindro(COR.CLARO, xTanque, zTanque, 26, alturaTanque)
    }
  }

  // Casa de bombas: vol 50 x 8 x 24, centro em (0, 0)
  // vol(cor, cx, cz, sx, alturaM, sz, giro)
  p.vol(COR.MEDIO, 0, 0, 50, 8, 24)

  // Tubulacao: fita de (-a + 30, 0) a (a - 30, 0), largura 4, altura Y.L2
  p.fita(COR.MEDIO, [[-a + 30, 0], [a - 30, 0]], 4, Y.L2)

  return p.fechar()
}
