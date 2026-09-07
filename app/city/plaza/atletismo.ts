/**
 * Estádio de atletismo: endereço e assentamento, sem carregar modelos.
 *
 * A parcela é um bloco INTEIRO da teia. O modelo cobre 304×220 m; o contrato
 * abaixo inclui margem até 320×240 m, inclusive calçada e saia. A escolha foi
 * medida contra as duas malhas viárias (publicada e ativa), programas publicados
 * e reencaixados, estádios existentes, Sphere e superfície lunar escavada.
 * Conferência reproduzível: npx tsx scripts/city/verificar-atletismo.ts.
 */
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'

/** 2 faixas radiais × 3 células tangenciais, além do Anel Exterior.
 * A 760 m da GEODE e 926 m do futebol; não desloca nenhuma das duas arenas.
 * O candidato imediatamente ao lado da GEODE foi rejeitado: havia água e
 * 48 m de desnível sob a peça. Aqui a superfície varia cerca de 4 m. */
export const ATLETISMO_MOD: Modulo = { i: 15, nr: 2, j: 50, ns: 3 }
export const ATLETISMO_PECA_X = 320
export const ATLETISMO_PECA_Z = 240
export const ATLETISMO_FOLGA_Y = 0.4
export const ATLETISMO_PASSO_SONDA = 8

/** Centro/giro nascem exclusivamente da caixa das células, nunca de coordenadas. */
export function atletismoSitio(): { x: number; z: number; rumoDeg: number } {
  const c = caixaDoModulo(ATLETISMO_MOD)
  const a = (c.a0 + c.a1) / 2
  return { x: Math.sin(a) * c.rm, z: -Math.cos(a) * c.rm,
    rumoDeg: (THREE.MathUtils.radToDeg(a) + 360) % 360 }
}

/** Registrar em buildVias.parcelas para suprimir apenas as ruas internas. */
export function atletismoParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(ATLETISMO_MOD) }
}

/** Mantém a silhueta leve visível de toda a praça, também no celular.
 * O detalhe próximo tem sua própria política de carregamento no loader. */
export function atletismoCull(tier: 'mobile' | 'desktop'): number {
  const c = caixaDoModulo(ATLETISMO_MOD)
  const alcancePraca = Math.ceil((c.rm + 1024 + 350) / 100) * 100
  return tier === 'mobile' ? alcancePraca : Math.max(7000, alcancePraca)
}

/**
 * ⚠️ A matriz deve ser a MESMA usada pelo Three: rotation.y = φ transforma
 * (x,z) em (cosφ*x + sinφ*z, -sinφ*x + cosφ*z). Trocar os sinais sonda o
 * retângulo espelhado e pode deixar o terreno atravessar a calçada real.
 *
 * A grade inclui explicitamente AMBAS AS BORDAS, mesmo se a dimensão não for
 * múltipla do passo. Passar terrain.superficieAt, a superfície desenhada.
 */
export function assentarAtletismo(
  root: THREE.Object3D,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  const s = atletismoSitio()
  const giro = -THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(giro), sn = Math.sin(giro)
  const nx = Math.ceil(ATLETISMO_PECA_X / ATLETISMO_PASSO_SONDA)
  const nz = Math.ceil(ATLETISMO_PECA_Z / ATLETISMO_PASSO_SONDA)
  let alto = -Infinity
  for (let i = 0; i <= nx; i++) {
    const dx = -ATLETISMO_PECA_X / 2 + (ATLETISMO_PECA_X * i) / nx
    for (let j = 0; j <= nz; j++) {
      const dz = -ATLETISMO_PECA_Z / 2 + (ATLETISMO_PECA_Z * j) / nz
      const y = alturaEm(s.x + c * dx + sn * dz, s.z - sn * dx + c * dz)
      if (!Number.isFinite(y)) throw new Error('[atletismo] cota de terreno inválida')
      alto = Math.max(alto, y)
    }
  }
  root.name = 'DOG_ATHLETICS'
  root.position.set(s.x, alto + ATLETISMO_FOLGA_Y, s.z)
  root.rotation.y = giro
  return root
}
