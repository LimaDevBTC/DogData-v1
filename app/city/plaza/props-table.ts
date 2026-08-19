// A TABELA dos adereços: onde cada modelo de fora entra na praça, e por quê.
// Uma linha por peça; `props.ts` cuida do resto (carga, instância, terreno,
// culling). Os nomes de arquivo são os de `public/city/sf/`.
import type { PropSpec } from './props'
import { onDiagonal } from './garden-plan'

const rad = (d: number) => (d * Math.PI) / 180

/** um anel de `n` pontos no raio `r`, começando no ângulo `a0` (graus, de +x para +z) */
export function ring(n: number, r: number, a0 = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(a0) + (i / n) * Math.PI * 2
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]
  })
}
/** pontos ao longo de um bulevar cardeal (0 = norte, 90 = leste, 180 = sul, 270 = oeste),
 *  `side` metros para o lado do eixo */
export function alongBoulevard(deg: number, rs: number[], side = 0): [number, number][] {
  const a = rad(deg)
  return rs.map((r) => [Math.sin(a) * r + Math.cos(a) * side, Math.cos(a) * r - Math.sin(a) * side] as [number, number])
}
/** pontos ao longo de uma alameda diagonal */
export function alongAllee(q: 'NE' | 'NW' | 'SE' | 'SW', rs: number[], side = 0): [number, number][] {
  return rs.map((r) => onDiagonal(q, r, side))
}

/** Cada peça entra aqui depois de convertida e aprovada olhando a imagem. */
export const PROPS: readonly PropSpec[] = []
