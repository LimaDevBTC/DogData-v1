// City Hall (C05): Sede civica da DogCity na Lua
// Parcela 360 x 360 m, 13 ha. Composicao: piso civico claro em toda base, adro central de 300 x 130 m,
// edificio de 200 x 90 m com campanario de 62 m, escadaria de 5 degraus para acesso,
// espelhos de agua nos flancos, canteiros nos quatro cantos, arborizacao lateral.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Moldura: anel de calcada na borda da parcela (obrigatorio)
  p.moldura()

  // Piso civico de base: 360 x 360 m em Y.PARCELA
  // Marca que o nucleo e civico, nao verde. Oferece base uniforme para todo o complexo.
  p.chao(COR.CLARO, -a + 8, -b + 8, a - 8, b - 8, Y.PARCELA)

  // Adro principal: 300 x 130 m, centrado em (0, +60), em Y.L1
  // Local de encontro e celebracao civica. Degraus levam ate o campanario.
  p.chao(COR.CLARO, -150, 60 - 65, 150, 60 + 65, Y.L1)

  // Escadaria: 5 degraus ascendentes em direcao ao edificio
  // Cada degrau diminui 16 m de largura a cada passo (200, 184, 168, 152, 136 m).
  // Profundidade fixa de 5 m entre degraus. Altura sobe 0.25 m a cada degrau.
  // k=0: degrau de 200 x 5 m em z=-40, altura Y.L1
  // k=1: degrau de 184 x 5 m em z=-45, altura Y.L1+0.25
  // ... ate k=4
  for (let k = 0; k < 5; k++) {
    const largura = 200 - k * 16
    const z = -40 - k * 5
    const altura = Y.L1 + k * 0.25
    p.chao(COR.CLARO, -largura / 2, z - 2.5, largura / 2, z + 2.5, altura)
  }

  // Edificio principal: volume 200 x 90 m, altura 34 m, em (0, -90)
  // Caixa pura sem fachada. E o nucleo de poder civico, visivel de toda a Lua.
  p.vol(COR.CLARO, 0, -90, 100, 34, 45)

  // Campanario: cilindro raio 14 m, altura 62 m, em (0, -90)
  // Torre marca vertical do bairro. Subida de 62 m oferece vista panoramica da DogCity.
  p.cilindro(COR.CLARO, 0, -90, 14, 62)

  // Canteiros de borda: 4 quadrados 60 x 60 m em COR.VERDE em Y.L2
  // Posicionados simetricamente nos quatro cantos da parcela.
  const canteiros = [
    { x: -130, z: -130 },
    { x: +130, z: -130 },
    { x: -130, z: +130 },
    { x: +130, z: +130 }
  ]

  for (const cant of canteiros) {
    p.chao(COR.VERDE, cant.x - 30, cant.z - 30, cant.x + 30, cant.z + 30, Y.L2)
  }

  // Espelhos de agua: duas laminas 60 x 20 m em Y.L4 com agua=true
  // Posicionadas simetricamente: esquerda centrada em (-100, +100), direita em (+100, +100).
  // Espelho esquerdo
  p.chao(COR.AGUA, -130, 90, -70, 110, Y.L4, true)
  // Espelho direito
  p.chao(COR.AGUA, 70, 90, 130, 110, Y.L4, true)

  // Arborizacao lateral: duas filas de covas nos flancos do adro
  // Fila esquerda em x = -160, fila direita em x = +160
  // Ambas percorrem z de -10 a +130 com passo de 11 m (aproximadamente 12 arvores por fila)
  p.alinhamento(-160, -10, -160, 130, 11, 2)
  p.alinhamento(160, -10, 160, 130, 11, 2)

  // Arborizacao dos canteiros: 4 covas por canteiro
  // Uma em cada quadrante do canteiro 60 x 60 m para simetria
  for (const cant of canteiros) {
    p.cova(cant.x - 15, cant.z - 15, 2)
    p.cova(cant.x + 15, cant.z - 15, 2)
    p.cova(cant.x - 15, cant.z + 15, 2)
    p.cova(cant.x + 15, cant.z + 15, 2)
  }

  return p.fechar()
}
