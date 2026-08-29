// Campo de Treino. Parcelas abertas de esporte de bairro, sem arquibancada.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Base: chão verde em toda a parcela, nível piso
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // Campos de futebol: quantos couberem com espaçamento regulado
  const nx = Math.floor((2 * a - 60) / 120)
  const nz = Math.floor((2 * b - 60) / 84)

  // Posicionamento: margem de 30m + meio-espaçamento (7.5m em x, 8m em z)
  const xStart = -a + 30 + (120 - 105) / 2
  const zStart = -b + 30 + (84 - 68) / 2

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x0 = xStart + i * 120
      const z0 = zStart + j * 84
      const x1 = x0 + 105
      const z1 = z0 + 68

      // Campo principal em verde, nível L2
      p.chao(COR.VERDE, x0, z0, x1, z1, Y.L2)

      // Moldura clara de 2m marcando laterais do campo
      p.chao(COR.CLARO, x0 - 2, z0 - 2, x1 + 2, z0, Y.L2)      // topo
      p.chao(COR.CLARO, x0 - 2, z1, x1 + 2, z1 + 2, Y.L2)      // fundo
      p.chao(COR.CLARO, x0 - 2, z0, x0, z1, Y.L2)              // esquerda
      p.chao(COR.CLARO, x1, z0, x1 + 2, z1, Y.L2)              // direita
    }
  }

  // Vestiário: construção de 60 x 7 x 24 m (largura x altura x profundidade)
  p.vol(COR.CLARO, 0, -b + 40, 60, 7, 24)

  // Pista de caminhada: fita de 4m de largura em terracota, nível L1
  const pistaPath: [number, number][] = [
    [-a + 30, -b + 30],
    [a - 30, -b + 30],
    [a - 30, b - 30],
    [-a + 30, b - 30],
    [-a + 30, -b + 30]
  ]
  p.fita(COR.TERRACOTA, pistaPath, 4, Y.L1)

  // Árvores nas duas bordas tangenciais (paralelas ao anel), passo de 14m
  p.alinhamento(-a + 30, -b + 30, -a + 30, b - 30, 14)
  p.alinhamento(a - 30, -b + 30, a - 30, b - 30, 14)

  // Quatro refletores de 28 m nos cantos do conjunto de campos
  // Altura 28 m ilumina os campos de futebol e pista de caminhada
  p.refletor(-a + 50, -b + 50, 28)
  p.refletor(a - 50, -b + 50, 28)
  p.refletor(a - 50, b - 50, 28)
  p.refletor(-a + 50, b - 50, 28)

  // Oito bancos na pista de caminhada: 2 em cada lado (NO, NE, SO, SE)
  // Comprimento 1.8 m, virados para interior da pista
  // Lado norte (z = -b + 30): bancos em x = -a + 60 e x = a - 60
  p.banco(-a + 60, -b + 30, 0)
  p.banco(a - 60, -b + 30, 0)
  // Lado sul (z = b - 30): bancos em x = -a + 60 e x = a - 60
  p.banco(-a + 60, b - 30, 0)
  p.banco(a - 60, b - 30, 0)
  // Lado oeste (x = -a + 30): bancos em z = -b + 60 e z = b - 60
  p.banco(-a + 30, -b + 60, 1.57)
  p.banco(-a + 30, b - 60, 1.57)
  // Lado leste (x = a - 30): bancos em z = -b + 60 e z = b - 60
  p.banco(a - 30, -b + 60, 1.57)
  p.banco(a - 30, b - 60, 1.57)

  return p.fechar()
}
