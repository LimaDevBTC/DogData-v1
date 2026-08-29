// Mercado Municipal C09. Galpão de 140 x 200 m e 16 m de altura centrado em (0, -60).
// Pátio de carga de 150 x 70 m com 6 vagas de 20 x 3 m. Feira ao ar livre com 18 barracas
// de 8 x 8 m em grade 3 x 6. Arborização nas bordas (x = -78 e x = +78, z = -160 a +160, passo 12).
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso da parcela inteira em COR.CLARO
  p.chao(COR.CLARO, -a, -b, a, b, Y.PARCELA)

  // Galpão: volume de 140 x 200 m, 16 m de altura, centrado em (0, -60)
  // Largura 140 m (meia extensão 70), comprimento 200 m (meia extensão 100)
  p.vol(COR.MEDIO, 0, -60, 70, 16, 100)

  // Pátio de carga: chão escuro de 150 x 70 m em (0, +130) a Y.L1
  // Largura 150 m (75 m meia extensão), profundidade 70 m (35 m meia extensão)
  p.chao(COR.ESCURO, -75, 95, 75, 165, Y.L1)

  // Seis vagas de carga: 20 x 3 m em Y.L2
  // Espaçamento 24 m entre centros (x = -60 + k*24 para k = 0 a 5), todas em z = +130
  for (let k = 0; k < 6; k++) {
    const x = -60 + k * 24
    p.chao(COR.CLARO, x - 10, 128.5, x + 10, 131.5, Y.L2)
  }

  // Feira ao ar livre: 18 barracas de 8 x 8 m, 3,5 m de altura
  // Grade 3 colunas (x = -50, 0, +50) x 6 fileiras (z = 20 a 90, passo 14 m entre centros)
  const colunasX = [-50, 0, 50]
  const fileirasZ = [20, 34, 48, 62, 76, 90]

  for (const x of colunasX) {
    for (const z of fileirasZ) {
      p.vol(COR.CLARO, x, z, 4, 3.5, 4)
    }
  }

  // Arborização: duas filas de covas nas bordas longas
  // Cada fila: 27 covas espaçadas 12 m (z = -160 a +160), em x = -78 e x = +78
  p.alinhamento(-78, -160, -78, 160, 12)
  p.alinhamento(78, -160, 78, 160, 12)

  // Postes no patio de carga, 1 fila longitudinal
  // Patio de 150 x 70 em (0, +130), fila central ao longo de x para amarracao de cargas
  p.postes(-75, 130, 75, 130, 40, 9)

  // Seis bancos entre as barracas da feira
  // Distribuidos entre as 6 fileiras de barracas (z=20,34,48,62,76,90)
  // 1 banco por fileira, centrado em x=0 entre as colunas de barracas
  const zBancosBarracas = [20, 34, 48, 62, 76, 90]
  for (const z of zBancosBarracas) {
    p.banco(0, z, 0) // vendedores e clientes podem descansar
  }

  // Postes no perimetro interno, altura 9m, passo 40m
  // Lado norte (z=172, x de -82 a 82)
  p.postes(-82, 172, 82, 172, 40, 9)
  // Lado sul (z=-172, x de -82 a 82)
  p.postes(-82, -172, 82, -172, 40, 9)
  // Lado leste (x=82, z de -172 a 172)
  p.postes(82, -172, 82, 172, 40, 9)
  // Lado oeste (x=-82, z de -172 a 172)
  p.postes(-82, -172, -82, 172, 40, 9)

  return p.fechar()
}
