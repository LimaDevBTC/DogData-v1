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

/**
 * ⚠️ MUDOU DE ENDEREÇO EM 07/09, E O MOTIVO É O CAMPUS. A primeira escolha foi
 * `{i:15, nr:2, j:50, ns:3}`, no anel de fora (r 4.042), 760 m da GEODE e 926 m
 * do futebol. Válida contra tudo o que o verificador olha, e ainda assim errada
 * na chapa: o fundador viu as três arenas como três ilhas soltas, cada uma com
 * uma base de formato diferente, e o bloco daquele sítio tinha 466 x 895 m para
 * uma peça de 320 x 240 — a peça ocupava 18% dele.
 *
 * O sítio novo é a célula que sobrava entre a avenida de 90° e o $DOG ARENA, na
 * MESMA faixa de anel dos outros dois (r 3.030 a 3.558). Ela é seca (nenhum
 * ponto molhado em 7.569 sondas), tem 8,9 m de desnível natural sob o pódio (o
 * ARENA tem 16,3 e a GEODE 12,7) e não colide com programa nenhum. O que ela
 * entrega e o sítio antigo não entregava:
 *
 *     DOG Athletics  rumo  94,286°  ┐  615,1 m
 *     $DOG ARENA     rumo 105,000°  ┤
 *     THE GEODE      rumo 115,714°  ┘  615,1 m
 *
 * Mesmo anel, espaçamento idêntico, e o trio preenche exatamente a faixa entre
 * as avenidas de 90° e de 120°. Nem o ARENA nem a GEODE se mexeram. O chão dos
 * três agora é uma parcela só, terraplanada em três terraços, e quem manda nela
 * é `campus.ts`.
 */
export const ATLETISMO_MOD: Modulo = { i: 11, nr: 3, j: 42, ns: 2 }
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
 * O detalhe próximo tem sua própria política de carregamento no loader.
 *
 * ⚠️ O NÚMERO ACOMPANHA O SÍTIO SOZINHO, e é por isso que ele é uma conta e não
 * uma constante. Com a mudança para r 3.294 o corte de celular caiu de 5.500
 * para 4.700 m, que é o mesmo da GEODE pela mesma razão: o visitante fica na
 * praça (raio até 1.024 m), logo o pior caso de onde alguém olha é o raio da
 * peça mais o raio da praça, e o corte tem de ser maior que o PIOR caso. Foi
 * cortando pela média que o estádio sumiu do celular em 06/09. */
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
