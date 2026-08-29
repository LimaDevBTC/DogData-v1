// Teatro Municipal na Lua: piso claro, plateia, palco, colunata, escadaria, arborizacao
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Moldura: anel de calcada e guia na borda
  p.moldura()

  // Piso do teatro inteiro (180 x 180), base em Y.PARCELA
  p.chao(COR.CLARO, -a, -b, a, b, Y.PARCELA)

  // Adro: espaco onde a plateia espera (160 x 50 em Y.L1)
  // Posicao: centro em (0, +50), logo x de -80 a +80, z de +25 a +75
  p.chao(COR.CLARO, -80, 25, 80, 75, Y.L1)

  // Caixa cenica (palco): volume 70 x 60, altura 34 m
  // Centro em (0, -50), half-sizes sx=35, sz=30
  p.vol(COR.CLARO, 0, -50, 35, 34, 30)

  // Plateia: volume 120 x 70, altura 18 m
  // Centro em (0, +5), half-sizes sx=60, sz=35
  p.vol(COR.CLARO, 0, 5, 60, 18, 35)

  // Portico: colunata com seis cilindros, raio 2.2 m, altura 14 m
  // x = -50, -30, -10, 10, 30, 50 (espacamento de 20 m)
  // z = +32
  const xPortico = [-50, -30, -10, 10, 30, 50]
  for (const x of xPortico) {
    p.cilindro(COR.CLARO, x, 32, 2.2, 14)
  }

  // Escadaria: quatro degraus em progressao
  // k=0: 150 x 4 em z=44, Y.L1
  // k=1: 140 x 4 em z=48, Y.L1+0.3
  // k=2: 130 x 4 em z=52, Y.L1+0.6
  // k=3: 120 x 4 em z=56, Y.L1+0.9
  for (let k = 0; k < 4; k++) {
    const larg = 150 - k * 10
    const z = 44 + k * 4
    const y = Y.L1 + k * 0.3
    const x0 = -(larg / 2)
    const x1 = larg / 2
    // Cada degrau tem profundidade 4 m
    p.chao(COR.CLARO, x0, z - 2, x1, z + 2, y)
  }

  // Arborizacao: 12 covas em anel de raio 78
  // Angulo = (k/12) * 2*pi, com cos/sin para coordenadas circulares
  for (let k = 0; k < 12; k++) {
    const angulo = (k / 12) * 2 * Math.PI
    const cx = 78 * Math.cos(angulo)
    const cz = 78 * Math.sin(angulo)
    p.cova(cx, cz)
  }

  return p.fechar()
}
