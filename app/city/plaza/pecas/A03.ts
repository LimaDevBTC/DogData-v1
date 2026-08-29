// Jardim das Coortes - Recinto memorial das oito coortes de holders de DOG.
// Parcela 540 x 540 m (29,2 ha). Composicao: oito aneis concentricos de verde
// (raio 30+26k a 30+26k+20 para k=0..7), separados por caminhos de 6 m. Nucleo
// com disco de piso e marco cilindrico central (4 m raio, 16 m alto).
// Quatro portoes nas bordas norte, sul, leste, oeste. Arborizacao em espiral:
// uma cova por anel, a cada 40 graus, no raio do meio.

import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  // Moldura de calcada na borda
  p.moldura()

  // Piso COR.CLARO na parcela toda, nivel Y.PARCELA
  p.chao(COR.CLARO, -a, -b, a, b, Y.PARCELA)

  // Oito recintos: aneis concentricos de raio interno 30+k*26 a raio externo
  // 30+k*26+20, para k de 0 a 7. Separacao entre aneis: 6 m (caminho de piso).
  // Cada anel tem abertura de espiral: a0 = k*0.5, a1 = k*0.5 + 2*PI - 0.35
  for (let k = 0; k < 8; k++) {
    const ri = 30 + k * 26
    const re = ri + 20
    const a0 = k * 0.5
    const a1 = k * 0.5 + 2 * Math.PI - 0.35

    p.anel(COR.VERDE, 0, 0, ri, re, Y.L2, a0, a1)
  }

  // Nucleo: disco COR.CLARO de raio 30 em Y.L3
  p.disco(COR.CLARO, 0, 0, 30, Y.L3)

  // Marco da coorte zero: cilindro COR.MEDIO de raio 4 m e altura 16 m
  p.cilindro(COR.MEDIO, 0, 0, 4, 16)

  // Quatro portoes: adro COR.CLARO de 50 x 26 em Y.MOLDURA, no meio de cada borda.
  // 50 m tangencial (ao longo da borda), 26 m radial (para dentro).
  // Norte: z = b - [0, 26]
  p.chao(COR.CLARO, -25, b - 26, 25, b, Y.MOLDURA)
  // Sul: z = -b + [0, 26]
  p.chao(COR.CLARO, -25, -b, 25, -b + 26, Y.MOLDURA)
  // Leste: x = a - [0, 26]
  p.chao(COR.CLARO, a - 26, -25, a, 25, Y.MOLDURA)
  // Oeste: x = -a + [0, 26]
  p.chao(COR.CLARO, -a, -25, -a + 26, 25, Y.MOLDURA)

  // Arborizacao: uma cova em cada anel, a cada 40 graus, no raio do meio do anel.
  for (let k = 0; k < 8; k++) {
    const rMeio = 30 + k * 26 + 10

    // Covas a cada 40 graus: 0, 40, 80, ..., 320 (9 covas por anel)
    for (let grau = 0; grau < 360; grau += 40) {
      const angulo = (grau * Math.PI) / 180
      const x = rMeio * Math.sin(angulo)
      const z = -rMeio * Math.cos(angulo)

      p.cova(x, z)
    }
  }

  // Iluminacao: postes em 8 raios emanando do nucleo central (marca das coortes),
  // em forma de "spokes", para marcar os setores. Passo ~46 m, altura 8 m.
  // Os raios saem a cada 45 graus, de r=50 m (fora do cilindro) ate r=220 m
  // (antes da borda, onde a=270 significa que o raio util e ~265 m).
  for (let raio_graus = 0; raio_graus < 360; raio_graus += 45) {
    const angulo = (raio_graus * Math.PI) / 180
    const cos_a = Math.cos(angulo)
    const sin_a = Math.sin(angulo)
    // Coloca postes de 46 em 46 m ao longo do raio
    for (let r = 50; r <= 220; r += 46) {
      const px = r * sin_a
      const pz = -r * cos_a  // convenção do arquivo: angulo 0 aponta para -z
      p.poste(px, pz, 8)
    }
  }

  // Bancos (12 unidades) em arco de raio ~100 m ao redor do cilindro central,
  // virados para o marco (elemento principal). Ruido na distancia.
  for (let k = 0; k < 12; k++) {
    const angulo = (k / 12) * 2 * Math.PI
    const raioBase = 100
    const ruido = c.ruido(k) - 0.5
    const dist = raioBase + ruido * 30
    const bx = dist * Math.sin(angulo)
    const bz = -dist * Math.cos(angulo)
    const giro = angulo
    p.banco(bx, bz, giro, COR.CLARO)
  }

  // Mastro de 20 m ao lado do cilindro central, marcando a coorte zero.
  // Posicionado a ~25 m de distancia, num angulo intermediario.
  const mastroAngulo = Math.PI / 4  // 45 graus
  const mastroR = 25
  const mastroX = mastroR * Math.sin(mastroAngulo)
  const mastroZ = -mastroR * Math.cos(mastroAngulo)
  p.mastro(mastroX, mastroZ, 20, COR.CLARO)

  return p.fechar()
}
