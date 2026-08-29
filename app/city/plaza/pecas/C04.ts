// Museu da Runa, 180 x 180 m. Guarda a runa do DOG em um recinto de agua.
// Piso claro, patio de agua, galeria submersa, lanternim para luz natural, passarelas e arborizacao.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso claro na parcela toda em Y.PARCELA, deixando 8m de margem
  p.chao(COR.CLARO, -82, -82, 82, 82, Y.PARCELA)

  // Patio de agua: 120 x 120 m centrado em Y.L1 com agua=true
  // O museu boia nele
  p.chao(COR.AGUA, -60, -60, 60, 60, Y.L1, true)

  // Galeria: volume 90 x 90 m (sx=45, sz=45), 16 m de altura, centrado em (0,0)
  // Assentada no espelho da agua em Y.L1
  // ⚠️ vol() e cilindro() NÃO recebem cota: eles assentam na parcela por definição.
  // A versão escrita pelo agente passava Y.L1 aqui (viraria giro de 0,3 rad, 17 graus
  // de museu torto) e no cilindro abaixo, onde Y.L1 caía no número de LADOS e o
  // CylinderGeometry com 0,3 lado devolvia vértice NaN.
  p.vol(COR.CLARO, 0, 0, 45, 16, 45)

  // Lanternim: cilindro raio 12 m, altura 26 m no centro
  // Permite entrada de luz natural no recinto
  p.cilindro(COR.CLARO, 0, 0, 12, 26)

  // Quatro passarelas em Y.L2, largura 8 m, conectam as bordas a galeria
  // Passarela sul: de borda sul ate galeria
  p.fita(COR.CLARO, [[0, -78], [0, -45]], 8, Y.L2)
  // Passarela norte: de borda norte ate galeria
  p.fita(COR.CLARO, [[0, 78], [0, 45]], 8, Y.L2)
  // Passarela oeste: de borda oeste ate galeria
  p.fita(COR.CLARO, [[-78, 0], [-45, 0]], 8, Y.L2)
  // Passarela leste: de borda leste ate galeria
  p.fita(COR.CLARO, [[78, 0], [45, 0]], 8, Y.L2)

  // Arborizacao: 4 filas de 5 covas nos quatro cantos livres da parcela
  // Fora do patio de agua, em terra firme no nivel Y.PARCELA
  // Canto NE (x > 0, z > 0)
  p.alinhamento(65, 65, 80, 80, 4)
  // Canto NW (x < 0, z > 0)
  p.alinhamento(-65, 65, -80, 80, 4)
  // Canto SE (x > 0, z < 0)
  p.alinhamento(65, -65, 80, -80, 4)
  // Canto SW (x < 0, z < 0)
  p.alinhamento(-65, -65, -80, -80, 4)

  // Guarda-corpo nas quatro passarelas sobre o espelho de agua
  // Altura 1.2m, segurança para pedestres ao atravessar
  // Passarela sul
  p.guardaCorpo([[0, -78], [0, -45]], 1.2)
  // Passarela norte
  p.guardaCorpo([[0, 78], [0, 45]], 1.2)
  // Passarela oeste
  p.guardaCorpo([[-78, 0], [-45, 0]], 1.2)
  // Passarela leste
  p.guardaCorpo([[78, 0], [45, 0]], 1.2)

  // Postes no perimetro interno, altura 9m, passo 40m
  // Lado norte (z=82, x de -82 a 82)
  p.postes(-82, 82, 82, 82, 40, 9)
  // Lado sul (z=-82, x de -82 a 82)
  p.postes(-82, -82, 82, -82, 40, 9)
  // Lado leste (x=82, z de -82 a 82)
  p.postes(82, -82, 82, 82, 40, 9)
  // Lado oeste (x=-82, z de -82 a 82)
  p.postes(-82, -82, -82, 82, 40, 9)

  return p.fechar()
}
