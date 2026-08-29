// Campo de Radiadores: infraestrutura de borda para dissipacao de calor
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso escuro em toda a parcela, camada base da infraestrutura
  p.chao(COR.ESCURO, -a + 8, -b + 8, a - 8, b - 8, Y.PARCELA)

  // Vinte e quatro aletas de dissipacao: laminas finas e altas
  // Vistas de cima, formam um pente. Espacamento regular de 26 metros entre centros.
  const alturaAletas = 2 * b - 80
  for (let k = 0; k < 24; k++) {
    const xAleta = -a + 40 + k * 26
    // Interrompe quando ultrapassa o limite seguro da parcela
    if (xAleta > a - 40) break
    // vol(cor, cx, cz, sx, alturaM, sz, giro)
    // Lamina: 6m de largura, 14m de altura, comprimento proporcional em z
    p.vol(COR.CLARO, xAleta, 0, 6, 14, alturaAletas, 0)
  }

  // Coletor: tubulacao alimentadora na profundidade z = -b + 30
  // Dimensoes: (2*a - 40) de largura, 20 metros de profundidade
  p.chao(COR.MEDIO, -a + 20, -b + 30, a - 20, -b + 50, Y.L1)

  // Duas bombas simetricas de circulacao
  // Cada uma: 40m de largura, 10m de altura, 30m de profundidade
  p.vol(COR.MEDIO, -a + 70, -b + 60, 40, 10, 30, 0)
  p.vol(COR.MEDIO, a - 70, -b + 60, 40, 10, 30, 0)

  return p.fechar()
}
