// Portao da abobada: entrada elipsoidal do Spaceport na casca lunar
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)

  // Nao chama p.moldura() porque esta peca esta na casca, fora da malha

  // BASE: pista de asfalto 160 x 62 metros em Y.PARCELA
  // Oval centrada, meias extensoes 80 x 31
  p.oval(COR.ESCURO, 0, 0, 80, 31, Y.PARCELA)

  // CANCELA: faixa clara 200 x 12 metros em Y.L1
  // Linha que se atravessa na entrada, centrada em (0, 0)
  p.chao(COR.CLARO, -100, -6, 100, 6, Y.L1)

  // TORRES DE PORTAO: volumes 30 x 40 metros, 34 m de altura
  // Torre esquerda em (-110, 0), meias extensoes sx=15 sz=20
  p.vol(COR.MEDIO, -110, 0, 15, 34, 20)
  // Torre direita em (+110, 0)
  p.vol(COR.MEDIO, 110, 0, 15, 34, 20)

  // GUARITAS: volumes 14 x 14 metros, 8 m de altura
  // Meias extensoes sx=7 sz=7 para quadrado 14x14
  // Guarita sudoeste em (-55, -34)
  p.vol(COR.CLARO, -55, -34, 7, 8, 7)
  // Guarita sudeste em (+55, -34)
  p.vol(COR.CLARO, 55, -34, 7, 8, 7)
  // Guarita noroeste em (-55, +34)
  p.vol(COR.CLARO, -55, 34, 7, 8, 7)
  // Guarita nordeste em (+55, +34)
  p.vol(COR.CLARO, 55, 34, 7, 8, 7)

  // SEIS PISTAS: faixas 130 x 3 metros em Y.L2
  // Por onde a carga passa apos entrar, espaçadas a 12 metros
  for (let k = 0; k < 6; k++) {
    const z = -30 + k * 12
    p.chao(COR.CLARO, -65, z - 1.5, 65, z + 1.5, Y.L2)
  }

  // Seis mastros de 28 m ao longo da cancela, espaçados de -140 a +140.
  // Altura de mastro de portao de entrada, estrutura de controle.
  for (let i = 0; i < 6; i++) {
    const x = -140 + i * 56
    p.mastro(x, 0, 28)
  }

  // Guarda-corpo nas bordas oeste e leste das pistas de carga.
  // Contenção de 1,2 m ao longo das faixas de movimento.
  p.guardaCorpo([[-65, -31.5], [-65, 31.5]], 1.2)
  p.guardaCorpo([[65, -31.5], [65, 31.5]], 1.2)

  return p.fechar()
}
