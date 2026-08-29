// Mirante do Cinturao: plataforma de observacao ritual no bordo da cidade lunar
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Chao base em toda a parcela (220 x 140 m)
  p.chao(COR.CLARO, -a / 2, -b / 2, a / 2, b / 2, Y.PARCELA)

  // Plataforma central: disco de raio 60 m em Y.L1
  p.disco(COR.CLARO, 0, 0, 60, Y.L1)

  // Degraus concentricos para acesso a plataforma
  // Primeiro degrau: anel raio 44-60 m em Y.L2
  p.anel(COR.CLARO, 0, 0, 44, 60, Y.L2)

  // Segundo degrau: anel raio 30-44 m em Y.L3
  p.anel(COR.CLARO, 0, 0, 30, 44, Y.L3)

  // Terceiro degrau: disco raio 30 m em Y.L4
  p.disco(COR.CLARO, 0, 0, 30, Y.L4)

  // Torre central: cilindro raio 7 m, altura 34 m
  p.cilindro(COR.CLARO, 0, 0, 7, 34)

  // Braco oeste: passadico 40 x 3 m, altura 4 m
  p.vol(COR.MEDIO, -30, 0, 40, 4, 3)

  // Braco leste: passadico 40 x 3 m, altura 4 m
  p.vol(COR.MEDIO, 30, 0, 40, 4, 3)

  // Arvore ritual: 10 covas em anel raio 88 m
  for (let k = 0; k < 10; k++) {
    const angulo = (k / 10) * 2 * Math.PI
    const x = 88 * Math.cos(angulo)
    const z = 88 * Math.sin(angulo)
    p.cova(x, z)
  }

  // Guarda-corpo no anel externo da plataforma: 24 pontos em raio 58 m
  // Altura 1.2 m para proteger visitantes no ritual de observacao
  const guardaCorpoPoints: [number, number][] = []
  for (let k = 0; k < 24; k++) {
    const angulo = (k / 24) * 2 * Math.PI
    const x = 58 * Math.cos(angulo)
    const z = 58 * Math.sin(angulo)
    guardaCorpoPoints.push([x, z])
  }
  // Fecha o polígono
  guardaCorpoPoints.push([58 * Math.cos(0), 58 * Math.sin(0)])
  p.guardaCorpo(guardaCorpoPoints, 1.2)

  // Seis bancos virados para fora, distribuidos uniformemente em volta do anel
  // Giro em radianos para apontar para fora (radial)
  for (let k = 0; k < 6; k++) {
    const angulo = (k / 6) * 2 * Math.PI
    const x = 50 * Math.cos(angulo)
    const z = 50 * Math.sin(angulo)
    const giro = angulo + Math.PI / 2  // perpendicular ao raio
    p.banco(x, z, giro)
  }

  // Dois mastros de 22 m ladeando a torre central
  // Um a oeste (x = -35, z = 0) e outro a leste (x = 35, z = 0)
  p.mastro(-35, 0, 22)
  p.mastro(35, 0, 22)

  return p.fechar()
}
