// ═══════════════════════════════════════════════════════════════════════════
// THE GEODE na cena da cidade.
//
// A arena coberta: um cume de obsidiana facetado, simétrico, com 28.240 lugares
// e piso de show de 48 x 28 m. Modelo em `blender/build_arena.py`, bacia
// calculada pela linha de visada em `scripts/bacia_arena.py`, plano em
// `arena.md`.
//
// ⚠️ A POSIÇÃO É UM MÓDULO DA TEIA, NÃO UMA COORDENADA. Regra já paga pelo
// estádio, em `estadio.ts`: peça de infra ocupa um número inteiro de módulos,
// porque os lados do módulo SÃO ruas. Coordenada escolhida a olho põe avenida
// dentro do prédio, que foi o defeito que o fundador apontou na chapa do
// estádio. Se a teia mudar, a peça acompanha sozinha.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'

/**
 * O bloco de 3 x 3 módulos, escolhido por varredura de toda a teia (5.574
 * blocos comportam a peça com 45 m de folga; este é o melhor pelo conjunto):
 *
 *  · **caixa de 528 m no radial por 606 m de arco** para uma peça de 292 x 269,
 *    o que deixa **130 m livres até a rua** em qualquer direção;
 *  · fica no MESMO radial do estádio (`j: 46`), 540 m dele: os dois formam um
 *    distrito esportivo servido pela mesma avenida de aproximação, em vez de
 *    duas peças grandes disputando acesso em pontos opostos da cidade;
 *  · está a 2.754 m do centro contra 3.294 do estádio, ou seja MAIS PERTO da
 *    praça, que é de onde a cidade é vista;
 *  · água mais próxima a 1.469 m e canal radial a 962 m de afastamento lateral,
 *    medidos contra `cidade-malha.json`. Não pisa na frente de água.
 */
export const GEODE_MOD: Modulo = { i: 8, nr: 3, j: 46, ns: 3 }

/** o envelope construído, para medir sem carregar o GLB */
export const GEODE_ENV_X = 224   // a saia de cristal, que é mais larga que o tambor
export const GEODE_ENV_Z = 201

/**
 * ⚠️ A PEÇA COBRE MAIS CHÃO QUE O PRÉDIO. O tambor tem 198 x 178, a saia
 * enterrada vai a 224 x 201 e a esplanada avança 34 m além do anel do chão, o
 * que dá 266 x 246. Os 292 x 269 declarados aqui somam ainda 13 m de margem por
 * lado para o micro-relevo. Foi por medir a cota só no PRÉDIO que a calçada do
 * estádio saiu furada.
 */
export const GEODE_PECA_X = 292
export const GEODE_PECA_Z = 269

/**
 * A distância em que a peça some, POR PERFIL.
 *
 * ⚠️ A DISTÂNCIA SE MEDE DE ONDE A PEÇA É VISTA. A conta, igual à do estádio:
 *
 *     THE GEODE está a 2.754 m do centro
 *     o visitante fica na praça, raio até 1.024 m
 *     logo ele a vê de 1.730 a 3.778 m
 *
 * O corte tem de ser maior que o PIOR caso, não que a média: foi cortando pela
 * média que o estádio sumiu do celular em 06/09. 4.200 cobre os 3.778 com 11%
 * de folga.
 */
export function geodeCull(tier: 'mobile' | 'desktop'): number {
  return tier === 'mobile' ? 4200 : 6500
}

/** Centro e giro do bloco, direto da teia. */
export function geodeSitio(): { x: number; z: number; rumoDeg: number } {
  const c = caixaDoModulo(GEODE_MOD)
  const am = (c.a0 + c.a1) / 2
  return {
    x: Math.sin(am) * c.rm,
    z: -Math.cos(am) * c.rm,
    rumoDeg: (THREE.MathUtils.radToDeg(am) + 360) % 360,
  }
}

/** O polígono do bloco, que vira máscara de via: a rua para na divisa dele. */
export function geodeParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(GEODE_MOD) }
}

/**
 * ⚠️ NO CELULAR O INTERIOR SAI INTEIRO, e é a maior economia da peça.
 *
 * A arena é coberta: de fora, a arquibancada só aparece pelas quatro entradas,
 * que somam 4% do perímetro e ficam a 1,7 km de quem olha. O interior (bacia de
 * 46 fileiras, escadas, piso, grid de show) são **27.976 dos 31.348 triângulos**,
 * ou seja 89% da peça para um detalhe que o telefone nunca vai resolver.
 *
 * Por isso `build_arena.py` emite dois objetos, `GEODE_CASCA` e
 * `GEODE_INTERIOR`. No celular o segundo é removido e descartado: sobram 3.372
 * triângulos, e a silhueta, o letreiro e a lapidação continuam idênticos.
 *
 * ⚠️ E KTX2 NÃO SE APLICA AQUI. O espelho de `scripts/city/ktx2.mjs` existe para
 * GLB com IMAGEM embutida, que é o que estourava a memória de textura do
 * telefone. `dog-geode.glb` tem 182 KB, **zero imagens e zero texturas**, só cor
 * de material. Se um dia a pele ganhar textura, ela entra por lá.
 */
export function podarGeode(root: THREE.Object3D, tier: 'mobile' | 'desktop'): number {
  if (tier !== 'mobile') return 0
  let tirados = 0
  const alvos: THREE.Object3D[] = []
  root.traverse((o) => { if (o.name.startsWith('GEODE_INTERIOR')) alvos.push(o) })
  for (const o of alvos) {
    o.traverse((n) => {
      const mesh = n as THREE.Mesh
      if (mesh.isMesh) {
        tirados += (mesh.geometry.index?.count ?? 0) / 3
        mesh.geometry.dispose()
      }
    })
    o.removeFromParent()
  }
  return Math.round(tirados)
}

/**
 * Assenta o GLB no sítio, alinhado com as ruas do entorno.
 *
 * ⚠️ O GIRO É `-rumo`, e a conta é a mesma de `estadio.ts:96`: em three um
 * objeto com `rotation.y = φ` manda o próprio X local para `(cos φ, 0, −sin φ)`,
 * e a tangente no rumo `a` é `(cos a, sin a)`, então `φ = −a`. Com isso o eixo
 * longo da peça (198 m) fica paralelo à rua de anel.
 *
 * ⚠️ E A COTA É A MÁXIMA MEDIDA EM GRADE SOBRE A PEÇA INTEIRA, não a do centro
 * nem a dos cantos. Cinco pontos deixam passar o cume que cai no meio da
 * esplanada, e assentar pela média deixa o canto alto furando o piso: foi assim
 * que a calçada do estádio saiu com falha. A saia de cristal desce 5,5 m abaixo
 * do zero da peça e absorve o que sobrar.
 */
export function assentarGeode(
  root: THREE.Object3D,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  const s = geodeSitio()
  const rad = THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(-rad), sn = Math.sin(-rad)
  const hx = GEODE_PECA_X / 2, hz = GEODE_PECA_Z / 2
  let alto = -Infinity
  for (let dx = -hx; dx <= hx; dx += 14) {
    for (let dz = -hz; dz <= hz; dz += 14) {
      const x = s.x + dx * c - dz * sn
      const z = s.z + dx * sn + dz * c
      const y = alturaEm(x, z)
      if (y > alto) alto = y
    }
  }
  alto += 0.4
  root.name = 'THE_GEODE'
  root.position.set(s.x, alto, s.z)
  root.rotation.y = -rad
  return root
}
