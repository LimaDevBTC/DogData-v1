// A01 - Parque Central e Lago Maior
// Parcela de 1080 x 900 m (97,2 ha), o maior parque da DogCity na Lua.
// Composicao: gramado cobrindo toda a parcela, um lago de silhueta organica
// (quatro ovais sobrepostos, nao um oval unico, para fugir da forma de piscina),
// uma ilha pequena dentro do lago, caminho de contorno mais duas travessias retas,
// clareira de eventos com concha acustica num canto, playground de saibro,
// quatro portoes (um por meio de borda) e arborizacao densa gerada por ruido
// determinista, evitando a area do lago.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // moldura da parcela: anel de calcada + guia na borda de contorno
  p.moldura()

  // gramado cobrindo a parcela inteira, base de tudo
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // LAGO MAIOR: margem organica feita de quatro ovais sobrepostos.
  // Cada oval tem por baixo uma praia (COR.CLARO) 8 m maior de raio em cada eixo,
  // desenhada primeiro (camada mais baixa), com a agua por cima.
  const ovaisLago: Array<[number, number, number, number]> = [
    [-120, 40, 260, 150],
    [90, -30, 200, 130],
    [210, 90, 130, 90],
    [-260, -90, 150, 100],
  ]
  // praias primeiro, em Y.L1
  for (const [cx, cz, ra, rb] of ovaisLago) {
    p.oval(COR.CLARO, cx, cz, ra + 8, rb + 8, Y.L1)
  }
  // agua por cima, em Y.L2
  for (const [cx, cz, ra, rb] of ovaisLago) {
    p.oval(COR.AGUA, cx, cz, ra, rb, Y.L2, true)
  }

  // ILHA dentro do lago, perto de (+40, +20), acima da lamina d agua
  p.oval(COR.VERDE, 40, 20, 30, 20, Y.L3)

  // CAMINHO DE CONTORNO do lago, largura 6 m
  p.fita(
    COR.CLARO,
    [
      [-420, -360],
      [-200, -380],
      [140, -330],
      [380, -200],
      [420, 60],
      [300, 300],
      [0, 370],
      [-300, 330],
      [-430, 120],
      [-420, -360],
    ],
    6,
    Y.L3
  )

  // duas travessias retas cruzando o parque de borda a borda
  const travessia1: Array<[number, number]> = [
    [-a + 6, -150],
    [a - 6, 150],
  ]
  const travessia2: Array<[number, number]> = [
    [-150, -b + 6],
    [150, b - 6],
  ]
  p.fita(COR.CLARO, travessia1, 6, Y.L3)
  p.fita(COR.CLARO, travessia2, 6, Y.L3)

  // arvores em fileira ao longo das duas travessias, passo 14 m
  p.alinhamento(travessia1[0][0], travessia1[0][1], travessia1[1][0], travessia1[1][1], 14)
  p.alinhamento(travessia2[0][0], travessia2[0][1], travessia2[1][0], travessia2[1][1], 14)

  // CLAREIRA DE EVENTOS no canto (-330, 300): disco de raio 90 (uso publico,
  // caberia algumas centenas de pessoas em pe para um show ao ar livre)
  const clarX = -330
  const clarZ = 300
  p.disco(COR.CLARO, clarX, clarZ, 90, Y.L1)
  // concha acustica: meio anel de raio 40 a 70 atras do centro da clareira
  p.anel(COR.CLARO, clarX, clarZ, 40, 70, Y.L2, 0, Math.PI)
  // volume da concha, 60 x 20 m em planta e 12 m de altura, atras do meio anel
  p.vol(COR.CLARO, clarX, clarZ + 55, 60, 12, 20)

  // PLAYGROUND de saibro perto de (350, -320): laje 90 x 60 m
  const pgX = 350
  const pgZ = -320
  p.chao(COR.TERRACOTA, pgX - 45, pgZ - 30, pgX + 45, pgZ + 30, Y.L1)

  // QUATRO PORTOES, um em cada meio de borda, adro 60 x 30 encostado na moldura
  // borda -z (topo)
  p.chao(COR.CLARO, -30, -b, 30, -b + 30, Y.MOLDURA)
  // borda +z (base)
  p.chao(COR.CLARO, -30, b - 30, 30, b, Y.MOLDURA)
  // borda -x (esquerda)
  p.chao(COR.CLARO, -a, -15, -a + 30, 15, Y.MOLDURA)
  // borda +x (direita)
  p.chao(COR.CLARO, a - 30, -15, a, 15, Y.MOLDURA)

  // ARBORIZACAO densa: 90 covas espalhadas de forma deterministica por ruido,
  // evitando um raio de 300 m do centro do lago para nao plantar na agua
  for (let k = 0; k < 90; k++) {
    const x = (c.ruido(k * 2) - 0.5) * 960
    const z = (c.ruido(k * 2 + 1) - 0.5) * 800
    const distLago = Math.sqrt(x * x + z * z)
    if (distLago > 300) {
      p.cova(x, z)
    }
  }

  return p.fechar()
}
