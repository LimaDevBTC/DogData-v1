// Campo Solar: fileiras de paineis solares com via de servico e subestacao
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Chao da parcela: regolito compactado em Y.PARCELA
  p.chao(COR.ESCURO, -a, -b, a, b, Y.PARCELA)

  // Fileiras de paineis solares: n = Math.floor((2*b - 60) / 26)
  // Espacamento 26 m, comecando em z = -b + 38
  const nFileiras = Math.floor((2 * b - 60) / 26)
  for (let i = 0; i < nFileiras; i++) {
    const z = -b + 38 + i * 26

    // Painel em Y.L2: (2*a - 40) x 9 m
    p.chao(COR.MEDIO, -a + 20, z, a - 20, z + 9, Y.L2)

    // Sombra de estrutura em Y.L1: (2*a - 40) x 2 m, deslocada z + 6
    p.chao(COR.ESCURO, -a + 20, z + 6, a - 20, z + 8, Y.L1)
  }

  // Via de servico: estrada central de 12 x (2*b - 30) m em Y.L1
  p.chao(COR.CLARO, -6, -b + 15, 6, b - 15, Y.L1)

  // Subestacao: caixa de 60 x 9 m altura x 30 m profundidade
  // Posicionada em (a - 90, -b + 60)
  p.vol(COR.MEDIO, a - 90, -b + 60, 30, 9, 15, 0)

  // Quatro torres nos cantos internos: raio 2 m, altura 22 m
  p.cilindro(COR.CLARO, -a + 40, -b + 40, 2, 22)
  p.cilindro(COR.CLARO, a - 40, -b + 40, 2, 22)
  p.cilindro(COR.CLARO, -a + 40, b - 40, 2, 22)
  p.cilindro(COR.CLARO, a - 40, b - 40, 2, 22)

  return p.fechar()
}
