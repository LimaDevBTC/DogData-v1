// Hospital Geral e Heliponto. Blocos de internacao e emergencia, heliponto operacional com circulo de pouso e letra H.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Piso geral: COR.CLARO em Y.PARCELA, cobrindo toda a parcela 180m x 360m
  p.chao(COR.CLARO, -a, -b, a, b, Y.PARCELA)

  // Bloco de internacao: volume 150m x 90m, altura 30m, em (0, -100)
  // Posicionado longe da origem para deixar acesso livre
  p.vol(COR.CLARO, 0, -100, 150, 30, 90)

  // Bloco de emergencia: volume 140m x 60m, altura 14m, em (0, +40)
  // Menor que internacao, posicionado acima do heliponto
  p.vol(COR.CLARO, 0, 40, 140, 14, 60)

  // Heliponto: disco COR.ESCURO raio 26m em Y.L1, em (0, +140)
  p.disco(COR.ESCURO, 0, 140, 26, Y.L1)

  // Circulo de pouso: anel COR.CLARO raio 22-26m em Y.L2 (marcacao visual)
  p.anel(COR.CLARO, 0, 140, 22, 26, Y.L2)

  // Letra H em Y.L3: composta de tres retangulos
  // Barra esquerda: 4m (x) x 20m (z), centrada em x=-8
  p.chao(COR.CLARO, -10, 130, -6, 150, Y.L3)
  // Barra direita: 4m (x) x 20m (z), centrada em x=+8
  p.chao(COR.CLARO, 6, 130, 10, 150, Y.L3)
  // Travessa horizontal: 20m (x) x 4m (z), centrada em (0, 140)
  p.chao(COR.CLARO, -10, 138, 10, 142, Y.L3)

  // Acesso de ambulancia: fita COR.ESCURO 10m de largura em Y.L1
  // De (-82, 40) a (+82, 40), ligando emergencia ao acesso externo
  p.fita(COR.ESCURO, [[-82, 40], [82, 40]], 10, Y.L1)

  // Jardim de recuperacao: 150m x 50m, COR.VERDE em Y.L1
  // Posicionado em (0, -170), abaixo do bloco de internacao
  p.chao(COR.VERDE, -75, -195, 75, -145, Y.L1)

  // Arborizacao: alinhamento nas duas bordas longas, passo 12m
  // Borda leste: x=+82, de z=-172 a z=+172
  p.alinhamento(82, -172, 82, 172, 12)
  // Borda oeste: x=-82, de z=-172 a z=+172
  p.alinhamento(-82, -172, -82, 172, 12)

  // Oito covas distribuidas no jardim em padrão 4x2
  const cvasJardim = [
    [-50, -190], [-50, -150],
    [0, -190], [0, -150],
    [50, -190], [50, -150],
    [-25, -170], [25, -170]
  ]
  for (const [x, z] of cvasJardim) {
    p.cova(x, z)
  }

  // Mastro de 18m no heliponto (biruta, marca a altura de descida)
  p.mastro(0, 140, 18)

  // Postes no perimetro interno, altura 9m, passo 40m
  // Lado norte (z=172, x de -82 a 82)
  p.postes(-82, 172, 82, 172, 40, 9)
  // Lado sul (z=-172, x de -82 a 82)
  p.postes(-82, -172, 82, -172, 40, 9)
  // Lado leste (x=82, z de -172 a 172)
  p.postes(82, -172, 82, 172, 40, 9)
  // Lado oeste (x=-82, z de -172 a 172)
  p.postes(-82, -172, -82, 172, 40, 9)

  return p.fechar()
}
