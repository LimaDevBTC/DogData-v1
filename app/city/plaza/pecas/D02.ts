// Alfandega e triagem: patio de conferencia de carga, galpao de triagem, docas, patio de espera, torre de controle, portico de raio x.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso escuro de todo o patio da alfandega (Y.PARCELA, nivel da pista de rua).
  p.chao(COR.ESCURO, -a + 8, -b + 8, a - 8, b - 8, Y.PARCELA)

  // Galpao de triagem: caixa 240m x 90m, altura 18m, centrada em (0, -90).
  p.vol(COR.MEDIO, 0, -90, 240, 18, 90)

  // Dez docas: 18m x 30m cada, em Y.L1 (piso levantado em 12 cm).
  // Posicionadas em x = -108 + k*24, z = -20, k de 0 a 9.
  for (let k = 0; k < 10; k++) {
    const cx = -108 + k * 24
    p.chao(COR.CLARO, cx - 9, -20 - 15, cx + 9, -20 + 15, Y.L1)
  }

  // Patio de espera: 300m x 90m em Y.L1, centrado em (0, +100).
  p.chao(COR.CLARO, -150, 55, 150, 145, Y.L1)

  // Seis fileiras de marcacao: 280m x 1.5m cada em Y.L2 (24 cm acima do piso).
  // Posicionadas em z = 62 + k*15, k de 0 a 5.
  for (let k = 0; k < 6; k++) {
    const z = 62 + k * 15
    p.chao(COR.MEDIO, -140, z - 0.75, 140, z + 0.75, Y.L2)
  }

  // Torre de controle: cilindro de raio 9m, altura 32m, em (-140, +140).
  p.cilindro(COR.CLARO, -140, 140, 9, 32)

  // Portico de raio x: caixa 40m x 16m, altura 12m, em (0, +30).
  p.vol(COR.MEDIO, 0, 30, 40, 12, 16)

  // Arborizacao nas quatro bordas da parcela, passo 16m entre covas.
  // Borda norte (z = +172).
  p.alinhamento(-a + 8, b - 8, a - 8, b - 8, 16)

  // Borda sul (z = -172).
  p.alinhamento(-a + 8, -b + 8, a - 8, -b + 8, 16)

  // Borda leste (x = +172).
  p.alinhamento(a - 8, -b + 8, a - 8, b - 8, 16)

  // Borda oeste (x = -172).
  p.alinhamento(-a + 8, -b + 8, -a + 8, b - 8, 16)

  // Iluminacao das docas: fila de postes de 14 m ao longo de z = -40.
  // Espaçados a 30 m, altura de iluminacao de porto de descarregamento.
  p.postes(-108, -40, 108, -40, 30, 14)

  // Torres de iluminacao de estadio de 26 m nos cantos do patio de espera.
  // Altura real de torre de iluminacao de grandes areas.
  p.refletor(-150, 55, 26)
  p.refletor(-150, 145, 26)
  p.refletor(150, 55, 26)
  p.refletor(150, 145, 26)

  return p.fechar()
}
