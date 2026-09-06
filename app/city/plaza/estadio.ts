// ═══════════════════════════════════════════════════════════════════════════
// $DOG ARENA na cena da cidade.
//
// O modelo vem de `blender/build_estadio.py` (bacia calculada pela linha de
// visada em `scripts/bacia_estadio.py`) e entra na praça como GLB, igual às
// torres.
//
// ⚠️ A POSIÇÃO É UM MÓDULO DA TEIA, NÃO UMA COORDENADA. A primeira versão punha
// o estádio numa coordenada escolhida pelo relevo e pelo programa, e o fundador
// apontou o resultado na chapa: TRÊS AVENIDAS PASSANDO POR DENTRO DELE. A causa
// é que eu testei colisão contra as PEÇAS do programa e não contra a malha
// viária. A regra da casa já existia e está em `programa.ts`:
//
//     TODA PEÇA OCUPA UM NÚMERO INTEIRO DE MÓDULOS DA TEIA.
//     Os lados da peça SÃO ruas, porque os lados do módulo são ruas.
//
// Então o estádio deixa de ter coordenada própria: ele tem um MÓDULO, e o centro
// e o giro saem da teia. Se a teia mudar, ele acompanha sozinho.
//
// Plano em `estadio.md`.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'

/**
 * O bloco de 3 x 3 módulos do estádio, escolhido por varredura de toda a teia
 * entre os raios 1.900 e 3.800: é o que fica mais perto do Parque Central (714 m
 * do centro dele) entre os que comportam o prédio inteiro com folga. A caixa
 * mede 528 m no radial por 669 m de arco para um prédio de 303 x 261 m, o que
 * deixa **134 m livres até a rua mais próxima em qualquer direção**.
 *
 * ⚠️ MEDIÇÃO CONHECIDA E NÃO ACIONADA: O BULEVAR BUL04 CRUZA ESTE BLOCO.
 *
 * Em 06/09, ao consertar o sítio de THE GEODE, a mesma varredura foi passada
 * neste bloco contra `cidade-malha.json`, que é onde moram as OUTRAS três
 * famílias de via (bulevares, autopistas e anéis viários). Elas não estão em
 * `teia.ts` e nem a máscara de parcela (`estadioParcela`) nem a varredura
 * original as viam. Contra a peça real do estádio (418 x 376):
 *
 *     BUL04, bulevar de 44 m no rumo 106,875: **-123 m de folga**,
 *     ou seja o eixo do bulevar cai dentro do bloco.
 *
 * A peça chegou a ser movida para `{i:11, nr:3, j:44, ns:3}` (123 m livres) e o
 * **fundador mandou voltar** para cá em 06/09: "confirme o estádio na mesma
 * posição de antes". Decisão dele, e não se relitiga aqui. O que fica é o
 * NÚMERO, para quem um dia decidir mexer não precisar redescobrir: a varredura
 * que acha o bloco livre está em `scripts/_sitio_est.ts`.
 *
 * ⚠️ E A REGRA GERAL VALE MESMO ASSIM, e foi paga por THE GEODE: caber num
 * módulo da teia é NECESSÁRIO E NÃO SUFICIENTE. Peça nova se confere contra as
 * três famílias de via mais água e canais.
 */
export const ESTADIO_MOD: Modulo = { i: 11, nr: 3, j: 46, ns: 3 }

/** o envelope construído, para quem precisa medir sem carregar o GLB */
export const ESTADIO_ENV_X = 303
export const ESTADIO_ENV_Z = 261

/**
 * ⚠️ A PEÇA COBRE MUITO MAIS QUE O PRÉDIO, e foi por não olhar isso que a
 * calçada saiu furada. O envelope tem 303 x 261, mas a esplanada avança 30,5 m
 * além da pele e o talude do platô mais 22, o que dá **418 x 376** de chão
 * ocupado. Medindo a cota só no prédio, o piso ficou 0,6 m abaixo do ponto mais
 * alto que ele cobre, e o terreno atravessou a calçada num trecho: é a mancha
 * que o fundador viu na chapa ("a calçada em torno do estádio tem uma falha").
 */
export const ESTADIO_PECA_X = 418
export const ESTADIO_PECA_Z = 376

/**
 * A distância em que a peça some, POR PERFIL.
 *
 * ⚠️ A DISTÂNCIA SE MEDE DE ONDE A PEÇA É VISTA, não por analogia com o resto da
 * cena. Em 06/09 pus 2.600 m no mobile copiando a lógica do `smallCull` (1.200)
 * e do `lodDistance` (1.300) de `perf.ts`, e o resultado foi o fundador
 * reportando que **o estádio não aparecia no celular**. A conta que faltou:
 *
 *     o estádio está a 3.294 m do centro da cidade
 *     o visitante fica na praça, raio até 1.024 m
 *     logo ele o vê de 2.270 a 4.318 m de distância
 *
 * Com o corte em 2.600 a peça sumia de quase toda a praça, inclusive da vista
 * de entrada (3.196 m) e do deck (3.204 m). O corte tem de ser maior que o pior
 * caso de onde alguém olha, e não menor que a distância média da cena.
 *
 * ⚠️ E O CUSTO É PEQUENO: são 85 mil triângulos numa cena de milhões, ou seja
 * menos de 2%. O que quebra celular nesta casa é textura e contagem de chamada,
 * não uma malha sem imagem nenhuma.
 *
 * ⚠️ E O KTX2 NÃO SE APLICA A ESTA PEÇA: o espelho de `scripts/city/ktx2.mjs`
 * existe para GLB com IMAGEM embutida, que é o que estourava a memória de
 * textura do telefone. `dog-arena.glb` tem 415 KB, ZERO imagens e ZERO texturas,
 * só cor de material. Se um dia ele ganhar textura, ela entra por lá.
 */
export function estadioCull(tier: 'mobile' | 'desktop'): number {
  return tier === 'mobile' ? 4500 : 7000
}

/** Centro e giro do bloco, direto da teia. */
export function estadioSitio(): { x: number; z: number; rumoDeg: number } {
  const c = caixaDoModulo(ESTADIO_MOD)
  const am = (c.a0 + c.a1) / 2
  return {
    x: Math.sin(am) * c.rm,
    z: -Math.cos(am) * c.rm,
    rumoDeg: (THREE.MathUtils.radToDeg(am) + 360) % 360,
  }
}

/** O polígono do bloco, que vira máscara de via: a rua para na divisa dele. */
export function estadioParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(ESTADIO_MOD) }
}

/**
 * Assenta o GLB no sítio, alinhado com as ruas do entorno.
 *
 * ⚠️ O EIXO LONGO VAI NA TANGENTE, que é a direção da rua de anel: é isso que
 * deixa o prédio paralelo à malha em vez de enviesado. Em three um objeto com
 * `rotation.y = φ` manda o próprio X local para `(cos φ, 0, −sin φ)`, e a
 * tangente no rumo `a` é `(cos a, sin a)`, então `φ = −a`. É a mesma conta que
 * `pecas.ts:253` já usa para desenhar qualquer peça do programa.
 *
 * ⚠️ E O PÉ É A COTA MÁXIMA, não a do centro. Regra da casa para peça grande
 * (`loteamento.md:253`): o terreno varia 14,4 m sob o prédio, e assentar pela
 * média deixaria o canto alto furando o platô. O que sobra embaixo é a saia,
 * que já vem no modelo.
 */
export function assentarEstadio(
  root: THREE.Object3D,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  const s = estadioSitio()
  const rad = THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(-rad), sn = Math.sin(-rad)
  // ⚠️ E A COTA SE MEDE EM GRADE, NÃO NOS CANTOS. Cinco pontos do prédio deixam
  // passar o cume que cai no meio da esplanada; a grade de 14 m sobre a peça
  // inteira custa ~800 consultas uma vez no boot e não deixa buraco. A folga de
  // 0,4 m é a margem para o micro-relevo que o `terreno=fino` acrescenta depois.
  const hx = ESTADIO_PECA_X / 2, hz = ESTADIO_PECA_Z / 2
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
  root.name = 'DOG_ARENA'
  root.position.set(s.x, alto, s.z)
  root.rotation.y = -rad
  return root
}
