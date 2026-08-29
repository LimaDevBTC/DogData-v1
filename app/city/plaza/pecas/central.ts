// Central de Distribuicao, 180 x 180 m. Peca modular com variacao determinista para as doze Centrais.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Moldura de calcada e guia na borda.
  p.moldura()

  // Piso escuro em Y.PARCELA na parcela toda: -180 x -180 a +180 x +180.
  p.chao(COR.ESCURO, -a, -b, a, b, Y.PARCELA)

  // Patio sob os silos: 150 x 40 em Y.L1 em (0, +62), desenhado ANTES dos silos.
  p.chao(COR.CLARO, -75, 50, 75, 74, Y.L1)

  // Galpao principal: 120 x 70, altura 11 a 16 m em (0, -30).
  const altGalpao = 11 + c.ruido(1) * 5
  p.vol(COR.MEDIO, 0, -30, 60, altGalpao, 35)

  // Plataforma de carga: 140 x 24 em Y.L1 em (0, +25).
  p.chao(COR.CLARO, -70, 13, 70, 37, Y.L1)

  // Esteira COR.MEDIO de 6 m em Y.L2 de (-60, -30) a (+60, +25), ligacao galpao-plataforma.
  p.fita(COR.MEDIO, [[-60, -30], [0, 0], [60, 25]], 6, Y.L2)

  // Quatro silos: cilindros raio 9, altura 16 a 24 m, em x = -54, -18, 18, 54, z = +62.
  for (let k = 0; k < 4; k++) {
    const xSilo = -54 + k * 36
    const altSilo = 16 + c.ruido(2 + k) * 8
    p.cilindro(COR.CLARO, xSilo, 62, 9, altSilo, 16)
  }

  // Seis conteineres: volumes 12 x 2,4, altura 2,6 ou 5,2 em z = -74.
  for (let k = 0; k < 6; k++) {
    const xConteiner = -66 + k * 26
    const altConteiner = 2.6 + c.ruido(10 + k) * 2.6
    p.vol(COR.MEDIO, xConteiner, -74, 6, altConteiner, 1.2)
  }

  // Arborizacao: 4 covas nos cantos da parcela.
  const cantos = [
    [-76, -76],
    [76, -76],
    [-76, 76],
    [76, 76]
  ]
  for (const [x, z] of cantos) {
    p.cova(x, z, 3)
  }

  // Iluminacao da plataforma de carga: fila de postes de 12 m ao longo do eixo x.
  // Espaçados a 34 m, altura real de iluminacao de cais de carga.
  p.postes(-70, 25, 70, 25, 34, 12)

  // Dois mastros de 18 m laterais ao galpao, estrutura de suporte.
  // Altura de mastro de triagem, um de cada lado da carga.
  p.mastro(-60, -50, 18)
  p.mastro(60, -50, 18)

  return p.fechar()
}
