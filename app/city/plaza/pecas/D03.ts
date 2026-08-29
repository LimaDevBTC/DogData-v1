// D03 - Patio de Conteineres
// Peca logistica de 360 x 360 m onde moeda e triada antes de descer para as doze Centrais.
// Asfalto COR.ESCURO como piso, quatro fileiras de conteineres empilhados com relevo,
// galpao de triagem, quatro guindastes e pistas de manobra para caminhoes.

import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso: asfalto escuro em toda a parcela (Y.PARCELA)
  p.chao(COR.ESCURO, -a + 8, -b + 8, a - 8, b - 8, Y.PARCELA)

  // CONTEINERES: quatro fileiras de 12 unidades (48 total, 1.344 m2 cobertura)
  // Cada conteiner: 12 m comprimento x 2,4 m profundidade (planta 28,8 m2)
  // Fileiras em z = -120, -40, +40, +120 (40 m entre centros, circulacao de 28 m)
  // Posicoes em x: -150 + k*27 para k de 0 a 11 (27 m entre centros, 15 m claro)
  // Altura com ruido: 2,6 m, 5,2 m ou 7,8 m (um, dois ou tres empilhados)

  const zFileiras = [-120, -40, 40, 120]
  const alturas = [2.6, 5.2, 7.8]

  zFileiras.forEach((zFila, fila) => {
    for (let k = 0; k < 12; k++) {
      const x = -150 + k * 27
      const indiceAltura = Math.floor(c.ruido(k + fila * 20) * 3)
      const altura = alturas[indiceAltura]

      p.vol(COR.MEDIO, x, zFila, 6, altura, 1.2)
    }
  })

  // GALPAO DE TRIAGEM: 150 x 60 m de planta, 14 m de altura
  // Triagem da moeda antes da baixada para as doze Centrais
  p.vol(COR.MEDIO, 0, 150, 75, 14, 30, 0)

  // GUINDASTES: quatro cilindros COR.CLARO de raio 2,5 m e 26 m de altura
  // Posicionados em x = -120, -40, +40, +120, todos em z = -165
  const xGuindastes = [-120, -40, 40, 120]
  xGuindastes.forEach((x) => {
    p.cilindro(COR.CLARO, x, -165, 2.5, 26)
  })

  // PISTAS DE MANOBRA: duas faixas COR.CLARO em Y.L1 para circulacao de caminhoes
  // Cada uma 320 m x 14 m (planta 4.480 m2)
  // Uma entre fileiras -120 e -40, outra entre fileiras +40 e +120
  p.chao(COR.CLARO, -160, -87, 160, -73, Y.L1)
  p.chao(COR.CLARO, -160, 73, 160, 87, Y.L1)

  // COVAS DE ARVORE: quatro marcacoes nos cantos, sem plantio
  // Patio logistico nao e jardim, apenas registros urbanos
  const cantos = [[-150, -150], [150, -150], [-150, 150], [150, 150]]
  cantos.forEach(([x, z]) => {
    p.cova(x, z)
  })

  return p.fechar()
}
