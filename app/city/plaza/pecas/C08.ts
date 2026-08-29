// Memorial do Dog Perdido: 180 x 360 m. Silencio.
// Piso claro, espelho de agua, muretas, marcos alternados, camera final, arvores.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso claro ate os limites de seguranca (a-8 e b-8)
  // Cobre praticamente toda a parcela deixando margem de 8m
  p.chao(COR.CLARO, -82, -172, 82, 172, Y.PARCELA)

  // Espelho de agua longo: 60 x 280 centrado em (0,0)
  // O memorial da agua: 6.035 carteiras que nunca gastaram DOG
  // Coordenadas: x de -30 a +30 (60m), z de -140 a +140 (280m)
  p.chao(COR.AGUA, -30, -140, 30, 140, Y.L1, true)

  // Mureta esquerda: 4 x 280 com altura 0.8m
  // Ladeando a agua na posicao x = -34
  // sx = 2 (semi-largura), sz = 140 (semi-profundidade)
  p.vol(COR.MEDIO, -34, 0, 2, 0.8, 140)

  // Mureta direita: 4 x 280 com altura 0.8m
  // Ladeando a agua na posicao x = +34
  p.vol(COR.MEDIO, 34, 0, 2, 0.8, 140)

  // 63 marcos alternados: 31 em cada coluna (x = -60 e x = +60)
  // z de -150 a +150, espacados a cada 10 metros
  // Altura alternada: 1.2m para indices pares, 2.4m para impares
  // Cada marco e um volume 2 x 2 metros
  for (let i = 0; i <= 30; i++) {
    const z = -150 + i * 10
    const altura = i % 2 === 0 ? 1.2 : 2.4

    // Marco esquerdo
    p.vol(COR.MEDIO, -60, z, 1, altura, 1)

    // Marco direito
    p.vol(COR.MEDIO, 60, z, 1, altura, 1)
  }

  // Camera final: disco de raio 34 em Y.L2 na posicao (0, -160)
  // Piso elevado para a camera contemplativa
  p.disco(COR.CLARO, 0, -160, 34, Y.L2)

  // Cilindro no centro do disco: raio 3 metros, altura 9 metros
  // Marca o ponto focal do memorial
  p.cilindro(COR.MEDIO, 0, -160, 3, 9)

  // Arborizacao esquerda: x = -78, z de -160 a +160, passo 12 metros
  // Fileira de covas (arvores) na borda esquerda
  p.alinhamento(-78, -160, -78, 160, 12)

  // Arborizacao direita: x = +78, z de -160 a +160, passo 12 metros
  // Fileira de covas (arvores) na borda direita
  p.alinhamento(78, -160, 78, 160, 12)

  return p.fechar()
}
