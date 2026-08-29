// Depósito de Regolito: infraestrutura de armazenagem de material de obras da cidade
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Chão em COR.ESCURO na altura base, preenchendo toda a parcela
  p.chao(COR.ESCURO, -a, -b, a, b, Y.PARCELA)

  // Seis pilhas de regolito em duas fileiras de três
  // Cada pilha é um cone escalonado de três discos concêntricos
  const zFileiras = [-b + 60, b - 60]

  for (const z of zFileiras) {
    for (let k = 0; k < 3; k++) {
      // Distribuição uniforme dos três centros ao longo do eixo x
      const x = -a + 70 + k * (a - 70)

      // Base da pilha: disco de raio 26 m em Y.L2
      p.disco(COR.MEDIO, x, z, 26, Y.L2)

      // Meio da pilha: disco de raio 16 m em Y.L3
      p.disco(COR.MEDIO, x, z, 16, Y.L3)

      // Topo da pilha: disco de raio 8 m em Y.L4
      p.disco(COR.MEDIO, x, z, 8, Y.L4)
    }
  }

  // Ponte rolante de transferência sobre as pilhas
  // Dimensões: comprimento (2*a - 60), profundidade 3 m, altura 5 m
  // Posicionada no eixo central (0, 0) atravessando transversalmente
  p.vol(COR.CLARO, 0, 0, 2*a - 60, 5, 3)

  // Dois apoios estruturais para suportar a ponte rolante
  // Cilindros de raio 3 m e altura 14 m, espaçados nas extremidades
  p.cilindro(COR.CLARO, -a + 40, 0, 3, 14, 8)
  p.cilindro(COR.CLARO, a - 40, 0, 3, 14, 8)

  // Balança de pesagem para controle de material
  // Plataforma de 30 x 14 m em Y.L1, centrada a z = -b + 30
  p.chao(COR.CLARO, -15, -b + 30 - 7, 15, -b + 30 + 7, Y.L1)

  // Quatro refletores de 24 m nos cantos internos da parcela
  // Altura 24 m cobre toda a profundidade do deposito com luz direta
  p.refletor(-a + 40, -b + 40, 24)
  p.refletor(a - 40, -b + 40, 24)
  p.refletor(-a + 40, b - 40, 24)
  p.refletor(a - 40, b - 40, 24)

  return p.fechar()
}
