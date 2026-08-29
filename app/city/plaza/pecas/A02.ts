// Jardim Botanico - parcela A02 (540 x 540 m, 29,2 ha)
// Composicao: gramado base (COR.VERDE), estufa central (160x70m, 18m altura),
// adro de entrada (200x40m), aleias de circulacao em cruz (8m de largura),
// 12 canteiros em 2 fileiras com sebes verdes, espelho d agua, e arborization.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c
  p.moldura()

  // 1. Gramado base cobrindo toda a parcela (540 x 540 m)
  p.chao(COR.VERDE, -a, -b, a, b, Y.PARCELA)

  // 2. Estufa central: 160 m (x) x 70 m (z), 18 m de altura (volume sem fachada)
  p.vol(COR.CLARO, 0, 0, 160, 18, 70)

  // 3. Adro de acesso em frente da estufa: 200 m (x) x 40 m (z), em Y.L1
  // Posicionado imediatamente abaixo (z negativo) da estufa
  p.chao(COR.CLARO, -100, -75, 100, -35, Y.L1)

  // 4. Aleias de circulacao: fita COR.CLARO 8 m em Y.L2
  // Aleia horizontal inferior (z = -110)
  p.fita(COR.CLARO, [[-250, -110], [250, -110]], 8, Y.L2)
  // Aleia horizontal superior (z = +110)
  p.fita(COR.CLARO, [[-250, 110], [250, 110]], 8, Y.L2)
  // Aleia vertical (x = 0, ligando as duas horizontais)
  p.fita(COR.CLARO, [[0, -270], [0, 270]], 8, Y.L2)

  // 5. 12 Canteiros: 60 x 40 m cada, em 2 fileiras (superior z=-170, inferior z=+170)
  // Espacamento em x: -230, -138, -46, 46, 138, 230 (6 canteiros por fileira)
  const xCanteiros = [-230, -138, -46, 46, 138, 230]

  // Fileira superior (z = -170)
  for (const x of xCanteiros) {
    // Canteiro em verde: 60 m (x) x 40 m (z)
    p.chao(COR.VERDE, x - 30, -170 - 20, x + 30, -170 + 20, Y.L3)
    // Sebe: 4 vol de 1,2 m altura formando retangulo em volta do canteiro
    p.vol(COR.VERDE, x, -170 - 21, 60, 1.2, 2)
    p.vol(COR.VERDE, x, -170 + 21, 60, 1.2, 2)
    p.vol(COR.VERDE, x - 31, -170, 2, 1.2, 40)
    p.vol(COR.VERDE, x + 31, -170, 2, 1.2, 40)
  }

  // Fileira inferior (z = +170)
  for (const x of xCanteiros) {
    // Canteiro em verde
    p.chao(COR.VERDE, x - 30, 170 - 20, x + 30, 170 + 20, Y.L3)
    // Sebe: 4 vol
    p.vol(COR.VERDE, x, 170 - 21, 60, 1.2, 2)
    p.vol(COR.VERDE, x, 170 + 21, 60, 1.2, 2)
    p.vol(COR.VERDE, x - 31, 170, 2, 1.2, 40)
    p.vol(COR.VERDE, x + 31, 170, 2, 1.2, 40)
  }

  // 6. Espelho d agua: disco raio 30 m, com agua=true, em Y.L4
  // Posicionado em frente da estufa
  p.disco(COR.AGUA, 0, -60, 30, Y.L4, true)

  // 7. Arborização
  // Alinhamento nas aleias horizontais: passo 10 m
  p.alinhamento(-250, -110, 250, -110, 10)
  p.alinhamento(-250, 110, 250, 110, 10)

  // 20 covas de arvore rara em anel ao redor da estufa: raio 120 m
  // Angulo 0 aponta para -z e cresce para +x
  for (let k = 0; k < 20; k++) {
    const angle = (k / 20) * 2 * Math.PI
    const cx = 120 * Math.sin(angle)
    const cz = -120 * Math.cos(angle)
    p.cova(cx, cz)
  }

  return p.fechar()
}
