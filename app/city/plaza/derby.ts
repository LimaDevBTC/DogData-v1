/**
 * DOG DERBY: endereço e assentamento, sem carregar modelo.
 *
 * A parcela é um bloco INTEIRO da teia. O modelo cobre 424 × 358,5 m, inclusive
 * platô e saia de fundação. Conferência: npx tsx scripts/city/verificar-derby.ts
 * e a varredura que escolheu o sítio: npx tsx scripts/city/derby-sitio.ts
 */
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'

/** o id da peça no gerador; o NOME mudou para DOG Derby em 08/09, o id não */
export const DERBY_ID = 'E02'

/**
 * ⚠️ MUDOU DE ENDEREÇO EM 09/09/2026, E O MOTIVO É QUE HAVIA RUA EM CIMA DA PEÇA.
 *
 * A primeira implantação usava a parcela do GERADOR (a peça E02 de
 * `cidade.json`) mais um deslocamento medido dentro dela. Ela passava em todo o
 * verificador e ainda assim estava errada na chapa, pelo motivo que
 * `programa.ts` já documentava e eu ignorei: a peça vinha posicionada pela grade
 * do GERADOR e a rua é desenhada pela TEIA da cena (26 anéis × 168 radiais). São
 * duas grades, então a peça caía RENTE às ruas em vez de emoldurada por elas. O
 * fundador viu na chapa: "ele está em cima de uma rua, mesmo com terreno
 * sobrando em volta".
 *
 * A regra da casa é uma só, e é ela que faz nada quebrar: TODA PEÇA OCUPA UM
 * NÚMERO INTEIRO DE MÓDULOS DA TEIA, porque os lados do módulo SÃO ruas.
 *
 * Escolhido por varredura de 70 módulos válidos (envelope inteiro dentro do
 * módulo com 8 m de folga, seco, sem colisão com programa/Sphere/campus, com
 * testada de via principal e nenhuma via entrando no envelope, a menos de
 * 1.400 m do sítio anterior). Este é o mais próximo: **120 m** do lugar de
 * ontem, com a peça ocupando **60% do bloco**.
 *
 * ⚠️ O MESMO ANEL DO CAMPUS ESPORTIVO, e isso é de propósito. O DOG Athletics é
 * `{i:11, nr:3, j:42, ns:2}` e o campus inteiro é `{i:11, nr:3, j:42, ns:7}`: o
 * Derby fica na mesma faixa de anel, 20 radiais adiante, o que põe as quatro
 * peças de esporte da cidade na mesma linha. A varredura confere a colisão com
 * `CAMPUS_MOD` explicitamente, porque ele NÃO está em `cidade.json` (é parcela
 * criada na cena) e sem essa checagem 6 dos candidatos nasciam em cima dele.
 *
 * ⚠️ OCUPAÇÃO ENTRA NA ESCOLHA, NÃO SÓ VALIDADE. Havia módulos com metade da
 * amplitude de terreno (4,24 m contra 11,01) e a peça ocupando 26% deles. Foi
 * exatamente isso que reprovou o primeiro sítio do atletismo em 07/09: "a peça
 * ocupava 18% dele" e as arenas liam como ilhas soltas. 60% é o que faz a peça
 * ler como emoldurada pelas ruas, que é o que o fundador pediu.
 */
export const DERBY_MOD: Modulo = { i: 11, nr: 3, j: 62, ns: 2 }

/** o envelope do modelo, medido no gerador Blender (report.json) */
export const DERBY_PECA_X = 424
export const DERBY_PECA_Z = 358.5
export const DERBY_FOLGA_Y = 0.4
export const DERBY_PASSO_SONDA = 12
/**
 * ⚠️ AMPLITUDE MEDIDA NO SÍTIO NOVO, E ELA SUBIU. O sítio anterior tinha 8,63 m
 * e este tem 11,01: é o preço de ficar dentro do módulo e a 120 m do lugar. A
 * saia do modelo (`SKIRT` em `blender/build_derby.py`) tem de ser maior que este
 * número mais a folga de pouso, porque a peça pousa no ponto MAIS ALTO.
 */
export const DERBY_AMPLITUDE_MEDIDA = 11.01

/** Centro/giro nascem exclusivamente da caixa das células, nunca de coordenadas. */
export function derbySitio(): { x: number; z: number; rumoDeg: number } {
  const c = caixaDoModulo(DERBY_MOD)
  const a = (c.a0 + c.a1) / 2
  return { x: Math.sin(a) * c.rm, z: -Math.cos(a) * c.rm,
    rumoDeg: (THREE.MathUtils.radToDeg(a) + 360) % 360 }
}

/**
 * Registrar em `buildVias.parcelas` para suprimir as ruas internas do bloco.
 *
 * ⚠️ É ESTA FUNÇÃO QUE CONSERTA O DEFEITO, não a mudança de endereço sozinha.
 * Sem registrar a parcela, a teia desenha as ruas de dentro do bloco por cima da
 * peça mesmo com ela alinhada ao módulo. É o mesmo papel de `atletismoParcela()`
 * e de `campusParcela()`.
 */
export function derbyParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(DERBY_MOD) }
}

/**
 * ⚠️ O CORTE ACOMPANHA O RAIO DO MÓDULO, e é conta e não constante, pelo mesmo
 * motivo do atletismo: o visitante fica na praça (raio até 1.024 m), então o
 * pior caso de onde alguém olha é o raio da peça mais o raio da praça, e o corte
 * tem de ser maior que o PIOR caso, nunca a média.
 */
export function derbyCull(tier: 'mobile' | 'desktop'): number {
  const c = caixaDoModulo(DERBY_MOD)
  const alcancePraca = Math.ceil((c.rm + 1024 + 350) / 100) * 100
  return tier === 'mobile' ? alcancePraca : Math.max(7000, alcancePraca)
}

/**
 * ⚠️ POUSA NO PONTO MAIS ALTO DA PEGADA, não na média. É o que impede qualquer
 * parte da peça de enterrar, e é por isso que a saia do modelo tem de alcançar o
 * ponto mais BAIXO.
 *
 * A matriz de sondagem é a MESMA que o Three usa para girar o grupo. Trocar os
 * sinais sonda o retângulo espelhado, que é o defeito que `assentarEstadio`
 * cometeu em 06/09 e que só apareceu quando o campus criou um talude ao lado.
 *
 * A grade inclui explicitamente as duas bordas. Passar terrain.superficieAt.
 */
export function assentarDerby(
  root: THREE.Object3D,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  const s = derbySitio()
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
