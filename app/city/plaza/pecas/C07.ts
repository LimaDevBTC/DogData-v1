// DOG DATA HQ na Lua. Piso, torre de marca, base operacional, praca de dados com paineis de leitura, espelho d agua e arboricao nas bordas.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c
  p.moldura()

  // Piso base COR.CLARO em Y.PARCELA cobrindo toda a parcela
  p.chao(COR.CLARO, -82, -172, 82, 172, Y.PARCELA)

  // Praca de dados: chao COR.CLARO elevado em Y.L1, 150 x 120 m, centrada em (0, +90)
  p.chao(COR.CLARO, -75, 30, 75, 150, Y.L1)

  // Doze lajes (paineis de leitura do supply) em grade 3x4
  // Cada laja 20 x 8 m em COR.MEDIO, em Y.L1 (sobre a praca)
  // Colunas x = -45, 0, +45; linhas z = +40, +75, +110, +145
  const colunasX = [-45, 0, 45]
  const linhasZ = [40, 75, 110, 145]
  for (const x of colunasX) {
    for (const z of linhasZ) {
      p.chao(COR.MEDIO, x - 10, z - 4, x + 10, z + 4, Y.L1)
    }
  }

  // Torre: marco do bairro, 90 x 90 m, 78 m de altura, em (0, -110)
  p.vol(COR.CLARO, 0, -110, 90, 78, 90)

  // Base: volume operacional, 150 x 70 m, 14 m de altura, em (0, -30), encostada na torre
  p.vol(COR.CLARO, 0, -30, 150, 14, 70)

  // Espelho d agua: chao COR.AGUA 60 x 24 m em Y.L4, com agua=true, em (0, +20)
  p.chao(COR.AGUA, -30, 8, 30, 32, Y.L4, true)

  // Arboricacao nas duas bordas longas (x = -82 e +82, z de -172 a +172, passo 13 m)
  p.alinhamento(-82, -172, -82, 172, 13)
  p.alinhamento(82, -172, 82, 172, 13)

  // Iluminacao da Praca de Dados: 2 filas de postes de 6 m, passo 20 m.
  // Altura 6 m ilumina as 12 lajes de leitura do supply central.
  p.postes(-40, 30, -40, 150, 20, 6)      // Fila oeste
  p.postes(40, 30, 40, 150, 20, 6)        // Fila leste

  // Mastro de 40 m junto da torre: antenna de transmissao de dados.
  // 40 m e a altura de torre de transmissao, junto ao volume de 78 m para visibilidade.
  p.mastro(0, -110, 40)

  return p.fechar()
}
