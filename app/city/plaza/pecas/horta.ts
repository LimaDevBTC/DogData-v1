// Hortas do Cinturao: estufas, canteiros e cisterna na borda lunar
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Chao verde: base da parcela em Y.PARCELA
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // Numero de fileiras de estufas: (2*b - 70) / 46
  // Calcula quantas estruturas de cultivo cabem na profundidade
  const nEstufas = Math.floor((2 * b - 70) / 46)
  const larguraEstufa = 2 * a - 70

  // Estufas: fileiras de estruturas de cultivo em COR.CLARO
  // Dimensoes: (2*a - 70) de largura, 7 m de altura, 30 m de profundidade
  // Espacamento: 46 m entre centros (30 estufa + 16 canteiro)
  for (let k = 0; k < nEstufas; k++) {
    const zEstufa = -b + 50 + k * 46
    p.vol(COR.CLARO, 0, zEstufa, larguraEstufa, 7, 30)
  }

  // Canteiros: espaco entre estufas em Y.L2 para cultivo
  // Dimensoes: (2*a - 70) de largura, 14 m de profundidade
  for (let k = 0; k < nEstufas; k++) {
    const zCanteiro = -b + 50 + k * 46 + 23
    const x0 = -(larguraEstufa / 2)
    const z0 = zCanteiro - 7
    const x1 = larguraEstufa / 2
    const z1 = zCanteiro + 7
    p.chao(COR.VERDE, x0, z0, x1, z1, Y.L2)
  }

  // Casa de maquinas: estrutura de suporte em COR.MEDIO
  // Dimensoes: 50 m de largura, 9 m de profundidade, 26 m de altura
  // Posicao: (a - 70, -b + 30) proxima a borda tangencial
  p.vol(COR.MEDIO, a - 70, -b + 30, 50, 9, 26)

  // Cisterna: coleta e armazenamento de agua em Y.L4
  // Raio 22 m, com agua ativa (agua=true)
  // Posicao: (-a + 60, -b + 40) no lado oposto
  p.disco(COR.AGUA, -a + 60, -b + 40, 22, Y.L4, true)

  // Arvores nas bordas tangenciais
  // Duas linhas paralelas ao eixo x (tangencial)
  // z = -b + 16 (proxima ao centro), z = b - 16 (distante do centro)
  // Passo de 12 m entre covas para ritmo regular
  p.alinhamento(-a, -b + 16, a, -b + 16, 12)
  p.alinhamento(-a, b - 16, a, b - 16, 12)

  // Postes entre as fileiras de estufa: 1 fila vertical em x=0
  // Passo 50 m, altura 8 m para suporte estrutural das linhas de irrigacao
  // Vai de z = -b + 50 a z = b - 50, percorrendo toda a profundidade longitudinal
  p.postes(0, -b + 50, 0, b - 50, 50, 8)

  return p.fechar()
}
