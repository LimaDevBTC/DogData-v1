/**
 * DOG DERBY: endereço e assentamento, sem carregar modelo.
 *
 * A peça mora na parcela E02 do gerador, e não numa célula da teia como o DOG
 * Athletics. Por isso o sítio nasce da peça publicada em `public/city/cidade.json`
 * mais um deslocamento medido dentro dela, e não de `caixaDoModulo`.
 * Projeto e medições em derby.md. Conferência: npx tsx scripts/city/verificar-derby.ts
 */
import * as THREE from 'three'

/** o id da peça no gerador; o NOME mudou para DOG Derby em 08/09, o id não */
export const DERBY_ID = 'E02'

/**
 * ⚠️ O DESLOCAMENTO DENTRO DA PARCELA É MEDIDO, E O SINAL DE `lz` JÁ ERROU UMA
 * VEZ. `buildPecas` leva o quadro local da peça para o mundo por
 *     x = px + lx·cos(rot) − lz·sin(rot)
 *     z = pz + lx·sin(rot) + lz·cos(rot)
 * e medir com o sinal de `lz` trocado nos dois termos é um ESPELHAMENTO, não
 * uma rotação: o ponto continua dentro da parcela e continua seco, então nada
 * acusa, só a topografia sob a peça muda. Com o sinal certo a pegada de
 * 424 × 358 m tem 8,49 m de amplitude; espelhada, 10,03 m.
 *
 * Varredura de 279 posições dentro dos 60,26 ha da parcela, passo de 25 m,
 * sondando a cada 12 m: este é o ponto mais plano (8,49 m contra 22,85 m do
 * pior), seco em todas as sondas, e o único valor de `lz` que ainda cabe nos
 * 521 m de profundidade da parcela com a peça inteira dentro.
 */
export const DERBY_LX = -175
export const DERBY_LZ = -75

/** o envelope do modelo, medido no gerador Blender (report.json) */
export const DERBY_PECA_X = 424
export const DERBY_PECA_Z = 358.5
export const DERBY_FOLGA_Y = 0.4
export const DERBY_PASSO_SONDA = 12

export interface PecaDoGerador { x: number; z: number; rot: number }

/** Centro do conjunto em mundo, derivado da parcela e do deslocamento medido. */
export function derbySitio(peca: PecaDoGerador): { x: number; z: number; rumoDeg: number } {
  const rr = THREE.MathUtils.degToRad(peca.rot)
  const c = Math.cos(rr), s = Math.sin(rr)
  return {
    x: peca.x + DERBY_LX * c - DERBY_LZ * s,
    z: peca.z + DERBY_LX * s + DERBY_LZ * c,
    rumoDeg: peca.rot,
  }
}

/**
 * ⚠️ O CORTE ACOMPANHA O RAIO DA PARCELA, e é conta e não constante, pelo mesmo
 * motivo do atletismo: o visitante fica na praça (raio até 1.024 m), então o
 * pior caso de onde alguém olha é o raio da peça mais o raio da praça, e o corte
 * tem de ser maior que o PIOR caso, nunca a média.
 */
export function derbyCull(peca: PecaDoGerador, tier: 'mobile' | 'desktop'): number {
  const rm = Math.hypot(peca.x, peca.z)
  const alcancePraca = Math.ceil((rm + 1024 + 350) / 100) * 100
  return tier === 'mobile' ? alcancePraca : Math.max(7000, alcancePraca)
}

/**
 * ⚠️ POUSA NO PONTO MAIS ALTO DA PEGADA, não na média. É o que impede qualquer
 * parte da peça de enterrar, e é por isso que a saia do modelo desce 9,5 m: ela
 * tem de alcançar o ponto mais BAIXO, e a amplitude medida aqui é 8,49 m.
 *
 * A matriz de sondagem é a MESMA que o Three usa para girar o grupo. Trocar os
 * sinais sonda o retângulo espelhado, que é o defeito que `assentarEstadio`
 * cometeu em 06/09 e que só apareceu quando o campus criou um talude ao lado.
 *
 * A grade inclui explicitamente as duas bordas. Passar terrain.superficieAt.
 */
export function assentarDerby(
  root: THREE.Object3D,
  peca: PecaDoGerador,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  const s = derbySitio(peca)
  const giro = -THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(giro), sn = Math.sin(giro)
  const nx = Math.ceil(DERBY_PECA_X / DERBY_PASSO_SONDA)
  const nz = Math.ceil(DERBY_PECA_Z / DERBY_PASSO_SONDA)
  let alto = -Infinity
  for (let i = 0; i <= nx; i++) {
    const dx = -DERBY_PECA_X / 2 + (DERBY_PECA_X * i) / nx
    for (let j = 0; j <= nz; j++) {
      const dz = -DERBY_PECA_Z / 2 + (DERBY_PECA_Z * j) / nz
      const y = alturaEm(s.x + c * dx + sn * dz, s.z - sn * dx + c * dz)
      if (!Number.isFinite(y)) throw new Error('[derby] cota de terreno inválida')
      alto = Math.max(alto, y)
    }
  }
  root.name = 'DOG_DERBY'
  root.position.set(s.x, alto + DERBY_FOLGA_Y, s.z)
  root.rotation.y = giro
  return root
}
