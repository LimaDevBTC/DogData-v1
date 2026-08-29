// DOG University: campus de 360 x 360 m em torno de patio central.
// Composicao: gramado, patio, quatro blocos, anfiteatro, caminhos, arborizacao.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Moldura de calcada na borda da parcela
  p.moldura()

  // Gramado: cobertura verde em toda a parcela no nivel Y.PARCELA
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // Patio central: 180 x 140 m de claro em Y.L1
  // Centrado na origem, x: -90 a +90, z: -70 a +70
  p.chao(COR.CLARO, -90, -70, 90, 70, Y.L1)

  // Blocos construidos em volta do patio (volumes sem fachada em Y.L1)
  // Norte: biblioteca, 240 x 50 m, 20 m de altura, centro (0, -120)
  p.vol(COR.CLARO, 0, -120, 120, 20, 25)

  // Sul: salas de aula, 240 x 50 m, 16 m de altura, centro (0, +120)
  p.vol(COR.CLARO, 0, 120, 120, 16, 25)

  // Oeste: laboratorios, 50 x 150 m, 16 m de altura, centro (-130, 0)
  p.vol(COR.CLARO, -130, 0, 25, 16, 75)

  // Leste: reitoria, 50 x 150 m, 24 m de altura, centro (+130, 0)
  p.vol(COR.CLARO, 130, 0, 25, 24, 75)

  // Anfiteatro: meio anel de arquibancada em (0, 40)
  // Raio interno 30, raio externo 55 m, 8 degraus de 4 m total
  // Angulo 0 a pi: semicirculo voltado ao norte
  p.arquibancada(COR.CLARO, 0, 40, 30, 55, 8, 4, 0, Math.PI)

  // Caminhos: fitas de 7 m em Y.L2 ligando bordas da parcela ao patio
  // Mantendo dentro de limite [-172, 172] conforme restricao de borda (a-8)
  // Caminho norte: meio da borda norte ate meio do lado norte do patio
  p.fita(COR.CLARO, [[0, -172], [0, -70]], 7, Y.L2)

  // Caminho sul: meio da borda sul ate meio do lado sul do patio
  p.fita(COR.CLARO, [[0, 70], [0, 172]], 7, Y.L2)

  // Caminho oeste: meio da borda oeste ate meio do lado oeste do patio
  p.fita(COR.CLARO, [[-172, 0], [-90, 0]], 7, Y.L2)

  // Caminho leste: meio da borda leste ate meio do lado leste do patio
  p.fita(COR.CLARO, [[90, 0], [172, 0]], 7, Y.L2)

  // Arborizacao: 16 covas no perimetro do patio
  // 4 por lado, espaçadas uniformemente
  // Lado norte (z = -70): 4 covas entre x = -80 e x = +80, passo 40 m
  p.cova(-80, -70)
  p.cova(-40, -70)
  p.cova(40, -70)
  p.cova(80, -70)

  // Lado sul (z = +70): 4 covas entre x = -80 e x = +80
  p.cova(-80, 70)
  p.cova(-40, 70)
  p.cova(40, 70)
  p.cova(80, 70)

  // Lado oeste (x = -90): 4 covas entre z = -45 e z = +45, passo 30 m
  p.cova(-90, -45)
  p.cova(-90, -15)
  p.cova(-90, 15)
  p.cova(-90, 45)

  // Lado leste (x = +90): 4 covas entre z = -45 e z = +45
  p.cova(90, -45)
  p.cova(90, -15)
  p.cova(90, 15)
  p.cova(90, 45)

  // Arborizacao: 4 filas de 6 covas nos cantos livres da parcela
  // Cada fila tem 50 m de comprimento em linha reta, passo 10 m
  // Canto NW (noroeste): x de -170 a -120, z = -150
  p.alinhamento(-170, -150, -120, -150, 10)

  // Canto NE (nordeste): x de 120 a 170, z = -150
  p.alinhamento(120, -150, 170, -150, 10)

  // Canto SW (sudoeste): x de -170 a -120, z = 150
  p.alinhamento(-170, 150, -120, 150, 10)

  // Canto SE (sudeste): x de 120 a 170, z = 150
  p.alinhamento(120, 150, 170, 150, 10)

  return p.fechar()
}
