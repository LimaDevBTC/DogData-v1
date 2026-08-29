// Farol do Portao - elipse de raio 45 m na casca da abobada, sem moldura
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)

  // Base: disco CLARO de raio 40 (margem de 5m ate a borda de 45m)
  p.disco(COR.CLARO, 0, 0, 40, Y.PARCELA)

  // Primeiro anel de degraus: raio 26 a 34, espessura 8m em Y.L1
  p.anel(COR.CLARO, 0, 0, 26, 34, Y.L1)

  // Segundo anel de degraus: raio 14 a 26, espessura 12m em Y.L2
  p.anel(COR.CLARO, 0, 0, 14, 26, Y.L2)

  // Torre do farol: cilindro CLARO de raio 9, altura 58m
  p.cilindro(COR.CLARO, 0, 0, 9, 58)

  // Lanterna: cilindro MEDIO de raio 12, altura 66m (ultrapassa a torre em 8m)
  p.cilindro(COR.MEDIO, 0, 0, 12, 66)

  return p.fechar()
}
