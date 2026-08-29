// Colosso do Portao: estátua colossal recebendo visitantes, montada em caixas
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Base: piso da parcela em COR.CLARO, nível Y.PARCELA
  // Dimensões 160 x 160 m (cabe na parcela de 180 x 180 m)
  p.chao(COR.CLARO, -80, -80, 80, 80, Y.PARCELA)

  // Pedestal de sustentacao
  // Chao 90 x 90 m em Y.L1, centrado em (0, 0)
  p.chao(COR.CLARO, -45, -45, 45, 45, Y.L1)

  // Volume do pedestal: 60 x 60 m, 18 m altura, COR.MEDIO
  p.vol(COR.MEDIO, 0, 0, 30, 18, 30)

  // Colosso montado em caixas (massa urbana, sem fachada)
  // Tronco: 22 x 14 m, 46 m altura, em (0, 0)
  p.vol(COR.CLARO, 0, 0, 11, 46, 7)

  // Cabeca: 12 x 12 m, 64 m altura total (acima do tronco)
  p.vol(COR.CLARO, 0, 0, 6, 64, 6)

  // Braco esquerdo: 8 x 8 m, 40 m altura, em (-20, 0)
  p.vol(COR.CLARO, -20, 0, 4, 40, 4)

  // Braco direito: 8 x 8 m, 40 m altura, em (+20, 0)
  p.vol(COR.CLARO, 20, 0, 4, 40, 4)

  // Adro de observacao: chao 160 x 40 m em Y.L2
  // Posicionado na zona frontal (+z), z de 42 a 82 (máximo permitido)
  p.chao(COR.CLARO, -80, 42, 80, 82, Y.L2)

  // Arborizacao: 12 covas em anel de raio 80 m
  // Angulos: 0, 30, 60, 90, ... 330 graus
  for (let i = 0; i < 12; i++) {
    const angulo = (i * 360 / 12) * Math.PI / 180
    const x = Math.cos(angulo) * 80
    const z = Math.sin(angulo) * 80
    p.cova(x, z)
  }

  return p.fechar()
}
