// F01, Distrito Financeiro.
// Parcela 1080 x 360 m (a=540, b=180), 38,9 ha.
// Composicao: piso duro COR.CLARO na parcela toda (nao ha grama, e distrito financeiro).
// Eixo central: calcadao de 40 m de largura em z=0, de x=-520 a x=+520.
// Dez lotes de 200x130 m organizados em duas fileiras (z=-100 e z=+100), cinco colunas
// em x = -420, -210, 0, +210, +420. Nove viram volumes de altura desigual (skyline de
// distrito financeiro real nunca e uniforme); o lote central da fileira de cima (0,+100)
// vira a Praca do Capital, um espaco civico aberto com espelho d'agua.
// Cada volume ganha um adro (praca de chegada) voltado para o calcadao.
// Arborizacao em fileira nas duas bordas do calcadao, passo 11 m.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // piso duro cobrindo a parcela toda: distrito financeiro e laje/calcada, nao grama
  p.chao(COR.CLARO, -a + 6, -b + 6, a - 6, b - 6, Y.PARCELA)

  // calcadao central, 40 m de largura, quase toda a extensao utilizavel da parcela
  p.fita(COR.CLARO, [[-520, 0], [520, 0]], 40, Y.L1)

  // lotes: [x, z, largura, profundidade, altura, nome]
  const lotes: Array<[number, number, number, number, number, string]> = [
    [-420, -100, 180, 110, 62, 'Bolsa do DOG'],
    [-210, -100, 160, 110, 48, 'BitFlow Swap'],
    [0, -100, 170, 110, 74, 'Casa de Credito'],
    [210, -100, 160, 110, 40, 'Mercado de Previsoes'],
    [420, -100, 150, 110, 34, 'Kray, arte on chain'],
    [-420, 100, 120, 110, 88, 'Torre de Dados'],
    [-210, 100, 150, 110, 30, 'Camara de Compensacao'],
    [210, 100, 150, 110, 26, 'Incubadora'],
    [420, 100, 150, 110, 22, 'Pavilhao de Leilao'],
  ]

  for (const [x, z, lx, lz, h] of lotes) {
    // adro voltado para o calcadao: faixa de 190 x 24 entre o volume e o eixo central
    const zAdro = z < 0 ? z + lz / 2 + 12 : z - lz / 2 - 12
    p.chao(COR.CLARO, x - 95, zAdro - 12, x + 95, zAdro + 12, Y.L1)
    // volume, massa sem fachada
    p.vol(COR.MEDIO, x, z, lx, h, lz)
  }

  // Praca do Capital, lote (0, +100): disco civico + espelho d'agua central
  p.disco(COR.CLARO, 0, 100, 70, Y.L2)
  p.disco(COR.AGUA, 0, 100, 34, Y.L4, true)

  // arborizacao nas duas bordas do calcadao
  p.alinhamento(-520, -22, 520, -22, 11)
  p.alinhamento(-520, 22, 520, 22, 11)

  return p.fechar()
}
