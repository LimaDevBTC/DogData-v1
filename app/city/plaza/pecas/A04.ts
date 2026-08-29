// Lago do Poente: parcela 360 x 360 m (13 ha) com lago de bairro oval, praia contornando,
// deck avançando sobre a água, caminho de pedestre contornando e arborização dupla.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Gramado verde da parcela toda em nível de chão
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // Praia: oval clara 150 x 130 m centrada na parcela
  p.oval(COR.CLARO, 0, 0, 75, 65, Y.L1)

  // Lago principal: oval de água 132 x 112 m em Y.L2
  p.oval(COR.AGUA, 0, 0, 66, 56, Y.L2, true)

  // Pequeno lago a noroeste: 60 x 40 m em (-60, 30) para irregularidade da margem
  p.oval(COR.AGUA, -60, 30, 30, 20, Y.L2, true)

  // Pequeno lago a sudeste: 50 x 45 m em (55, -35) para irregularidade da margem
  p.oval(COR.AGUA, 55, -35, 25, 22.5, Y.L2, true)

  // Deck de madeira 70 x 12 m avançando sobre a água em z = -80
  p.chao(COR.MEDIO, -35, -86, 35, -74, Y.L3)

  // Caminho de pedestre contornando: fita clara de 5 m em anel de raio 150 com 16 pontos
  const caminhoContorno: [number, number][] = []
  for (let i = 0; i < 16; i++) {
    const angulo = (i / 16) * 2 * Math.PI
    const x = 150 * Math.cos(angulo)
    const z = 150 * Math.sin(angulo)
    caminhoContorno.push([x, z])
  }
  caminhoContorno.push(caminhoContorno[0]) // fechar no ponto inicial
  p.fita(COR.CLARO, caminhoContorno, 5, Y.L3)

  // Arborização: 24 árvores num anel de raio 158 m
  for (let i = 0; i < 24; i++) {
    const angulo = (i / 24) * 2 * Math.PI
    const x = 158 * Math.cos(angulo)
    const z = 158 * Math.sin(angulo)
    p.cova(x, z)
  }

  // Arborização leste: 8 árvores num anel de raio 120 m no lado leste (x positivo)
  for (let i = 0; i < 8; i++) {
    const angulo = ((i / 8) - 0.5) * Math.PI
    const x = 120 * Math.cos(angulo)
    const z = 120 * Math.sin(angulo)
    p.cova(x, z)
  }

  return p.fechar()
}
