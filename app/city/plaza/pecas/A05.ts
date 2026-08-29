// A05 - Alameda dos Fundadores
// Parcela linear 720 x 180 m (a=360, b=90) para passeio com arborização.
// Composição: gramado base, calçadão central de 700 x 40 m com dois canteiros laterais de 18 m,
// placas dos doadores em duas fileiras (z=-14, z=+14), praça central com lâmina de água,
// dois portões nos extremos e duas fileiras de árvores (z=-50, z=+50).

import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Gramado de fundo na parcela toda (Y.PARCELA)
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // Calçadão: 700 x 40 m, centrado no eixo x (Y.L1)
  p.chao(COR.CLARO, -350, -20, 350, 20, Y.L1)

  // Canteiros: 700 x 18 m, nas laterais do calçadão (Y.L2)
  p.chao(COR.VERDE, -350, -52, 350, -34, Y.L2)
  p.chao(COR.VERDE, -350, 34, 350, 52, Y.L2)

  // Praça central: disco COR.CLARO raio 55 m (Y.L3)
  p.disco(COR.CLARO, 0, 0, 55, Y.L3)

  // Lâmina de água: disco COR.AGUA raio 22 m (Y.L4, agua=true)
  p.disco(COR.AGUA, 0, 0, 22, Y.L4, true)

  // Cilindro central: raio 3 m, altura 12 m (COR.MEDIO)
  p.cilindro(COR.MEDIO, 0, 0, 3, 12)

  // Placas dos fundadores: 24 placas (3 x 1.2 m, altura 1.1 m)
  // 12 placas de cada lado (z=-14, z=+14), x de -330 a +330, espaçamento 60 m
  const xPos = [-330, -270, -210, -150, -90, -30, 30, 90, 150, 210, 270, 330]
  for (const x of xPos) {
    p.vol(COR.MEDIO, x, -14, 3, 1.1, 1.2)
    p.vol(COR.MEDIO, x, 14, 3, 1.1, 1.2)
  }

  // Portões: adro 40 x 30 m nas duas pontas (x=-344, x=+344, Y.MOLDURA)
  p.chao(COR.CLARO, -364, -15, -324, 15, Y.MOLDURA)
  p.chao(COR.CLARO, 324, -15, 364, 15, Y.MOLDURA)

  // Arborização: duas filas de covas (z=-50, z=+50), x de -330 a +330, passo 12 m
  p.alinhamento(-330, -50, 330, -50, 12)
  p.alinhamento(-330, 50, 330, 50, 12)

  return p.fechar()
}
