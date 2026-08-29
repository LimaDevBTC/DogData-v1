// Casa da Moeda: cofre, patio fechado e muro defensivo
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c // a = b = 90

  p.moldura()

  // Piso geral: area de servico
  // 180x180 m de asfalto para circulacao de veiculos
  p.chao(COR.ESCURO, -a, -b, a, b, Y.PARCELA)

  // Muro perimetral: 4 volumes
  // 2 m espessura, 6 m altura, perimetro em x = +-76 e z = +-76
  // Forma quadrado defensivo de 152 x 152 m (2*76 = 152)

  // Muro oeste (x = -76)
  p.vol(COR.MEDIO, -76, 0, 2, 6, 152)

  // Muro leste (x = +76)
  p.vol(COR.MEDIO, 76, 0, 2, 6, 152)

  // Muro norte (z = -76)
  p.vol(COR.MEDIO, 0, -76, 152, 6, 2)

  // Muro sul (z = +76)
  p.vol(COR.MEDIO, 0, 76, 152, 6, 2)

  // Patio interno: 130 x 130 m
  // Calcada de acesso em Y.L1, ~25 m de distancia do muro em cada lado
  p.chao(COR.CLARO, -65, -65, 65, 65, Y.L1)

  // Cofre: 60 x 60 m, 22 m altura
  // Bloco cego centrado no patio, base 3600 m2, altura maxima para seguranca
  p.vol(COR.MEDIO, 0, 0, 60, 22, 60)

  // Duas oficinas: 100 x 26 m, 12 m altura
  // Simetricas em z = +-50, deixando z = 0 para o cofre

  // Oficina norte (z = -50)
  p.vol(COR.CLARO, 0, -50, 100, 12, 26)

  // Oficina sul (z = +50)
  p.vol(COR.CLARO, 0, 50, 100, 12, 26)

  // Portao unico: 24 x 20 m em Y.L2
  // Unica abertura na parede sul (z = +76), controlada
  // Centro em (0, +76), dimensoes 24 (x) x 20 (z)
  p.chao(COR.ESCURO, -12, 66, 12, 86, Y.L2)

  // Quatro covas nos cantos externos da parcela
  // Sem arborizacao no patio, apenas nos extremos
  p.cova(-90, -90)
  p.cova(-90, 90)
  p.cova(90, -90)
  p.cova(90, 90)

  // Quatro mastros de 12m nos cantos do muro defensivo
  // Muro perimetral em x=±76, z=±76, altura 12m para vigilancia
  p.mastro(76, 76, 12)
  p.mastro(76, -76, 12)
  p.mastro(-76, 76, 12)
  p.mastro(-76, -76, 12)

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
