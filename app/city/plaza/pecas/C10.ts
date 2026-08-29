// Observatorio do cinturao: cupula central com plataforma, anel de servico e acesso
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c
  p.moldura()

  // Piso da parcela inteira em COR.CLARO em Y.PARCELA
  // Cobre os 180 x 180 m do nivel base
  p.chao(COR.CLARO, -90, -90, 90, 90, Y.PARCELA)

  // Plataforma elevada: disco COR.CLARO raio 70 em Y.L1
  // Plano de observacao, margem 20 m ate a borda da parcela
  p.disco(COR.CLARO, 0, 0, 70, Y.L1)

  // Cupula principal: cilindro COR.CLARO raio 26, altura 20 m
  // Corpo do observatorio, base no chao da plataforma
  p.cilindro(COR.CLARO, 0, 0, 26, 20)

  // Calota no topo: cilindro COR.CLARO raio 20, altura 28 m
  // Empilhado para silhueta escalonada: cobre a cupula e sobe ate 28 m total
  p.cilindro(COR.CLARO, 0, 0, 20, 28)

  // Anel de servico: anel COR.MEDIO raio interno 30, raio externo 40 em Y.L2
  // Circula a cupula para manutencao e passadiço
  p.anel(COR.MEDIO, 0, 0, 30, 40, Y.L2)

  // Telescopio menor 1: cilindro COR.CLARO raio 8, altura 12 m em (-46, +34)
  p.cilindro(COR.CLARO, -46, 34, 8, 12)

  // Telescopio menor 2: cilindro COR.CLARO raio 8, altura 12 m em (+46, +34)
  p.cilindro(COR.CLARO, 46, 34, 8, 12)

  // Acesso: fita COR.CLARO largura 9 m em Y.L2, de norte para cupula
  // Sobe do limite da parcela (0, +78) ate a plataforma (0, +40)
  p.fita(COR.CLARO, [[0, 78], [0, 40]], 9, Y.L2)

  // Arborizacao: 8 covas em anel de raio 82
  // Marcam o perimetro externo, vista da abobada
  const raioArvores = 82
  const numArvores = 8
  for (let i = 0; i < numArvores; i++) {
    const angulo = (i / numArvores) * Math.PI * 2
    const x = raioArvores * Math.cos(angulo)
    const z = raioArvores * Math.sin(angulo)
    p.cova(x, z)
  }

  return p.fechar()
}
