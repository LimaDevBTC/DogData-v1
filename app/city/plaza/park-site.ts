// Onde fica o Parque Runestone, e só isso: um módulo sem dependências para o
// terreno (que abre a cova sob o parque) e o parque (que se assenta nela) lerem
// a mesma posição sem se importarem em círculo.
//
// A posição é a da cena da landing (`blender/dogcity-landing.blend`): o Runestone
// está em (2300, 2460) no quadro do Blender, a nordeste da praça, no rumo 43°, com
// a estrada cênica saindo da cidade até ele. O parque V2 tem 7,2 km de lado e a
// chegada (estrada, Portão, Longshadow Plaza) fica 2,8 a 3,7 km a sudoeste do
// Monarca, do lado da praça; a 3,4 km o Portão cairia dentro do jardim. Então o
// mesmo rumo, 43°, e a distância que deixa TODO o construído do parque a mais de
// 2,3 km do centro (fora do platô, que acaba em 1,3 km): 5,2 km. Sem rotação: o
// quadro do parque (x leste, y norte no Blender) já olha com a marca do Monarca
// (az 225) e o vale para a praça, que está a sudoeste dele.
import * as THREE from 'three'

const BEARING = THREE.MathUtils.degToRad(43)
// ⚠️ 5.200 -> 9.800 em 30/08. A cidade cresceu para 6.900 (R_ABOBADA) e a 5.200 o
// parque ficaria DENTRO dela. Ele é parque nacional: mora FORA da abóbada e se
// chega nele de veículo pressurizado, pela eclusa G01 no rumo 43.
// ⚠️ ESTE NÚMERO TEM DE BATER COM `PARQUE_DIST` em scripts/gerar_cidade.py, que
// é quem abre a máscara do lote. Se os dois divergirem, o gerador reserva um
// vazio onde o parque não está e o parque nasce em cima de lote.
// ⚠️ E O TERRENO PRECISA ALCANÇAR: `siteRadiusM` em lib/city/lunar/sites.ts foi a
// 11.000 justamente para cobrir a cidade E o parque na posição nova.
const DIST = 9800
export const PARK_CENTER = new THREE.Vector3(Math.round(DIST * Math.sin(BEARING)), 0, -Math.round(DIST * Math.cos(BEARING)))
export const PARK_ROT_Y = 0
/** meio-lado da malha do parque (o disco tem este raio) */
export const PARK_HALF = 3600
/** até aqui o parque é o parque; daqui a PARK_HALF ele funde no regolito */
export const PARK_CORE = 3100
/**
 * ⚠️ O ALCANCE DO PARQUE É ANISOTRÓPICO, E ISSO NÃO É CAPRICHO. `PARK_HALF` era
 * 3.600 em toda direção, e como o parque está a 5.200 do centro, a cova dele
 * alcançava r 1.600 da cidade: o quadrante nordeste inteiro afundava e ficava
 * proibido para lote. Custo medido: 11,72 km², 21,6% do sítio, mais que toda a
 * área de lote alocada.
 *
 * ⚠️ E ENCOLHER POR IGUAL QUEBRARIA O PORTAL. A chegada do parque (estrada,
 * Portão, Longshadow Plaza) fica a 2,8 km do Monarca, do lado da praça: um raio
 * único menor que isso deixaria o Portão FORA da malha do parque. Então o
 * alcance encurta só no rumo da cidade, onde a chegada está, e continua 3.600
 * nas outras direções, onde o parque tem cordilheira.
 *
 * O resultado é o que o fundador pediu: a borda do parque do lado da cidade
 * passa a ser a ENTRADA, com o Portão nela, e o resto do espaço volta a ser
 * cidade.
 */
export const PARK_FRENTE = 2750
export const PARK_BLEND = 450
/** meio-lado efetivo naquela direção. (lx, lz) é local ao parque. */
export function parkReach(lx: number, lz: number): number {
  const dx = -PARK_CENTER.x, dz = -PARK_CENTER.z          // do parque para a cidade
  const nd = Math.hypot(dx, dz) || 1
  const nl = Math.hypot(lx, lz)
  if (nl < 1e-6) return PARK_FRENTE
  const cos = (lx * dx + lz * dz) / (nl * nd)
  const C1 = Math.cos(THREE.MathUtils.degToRad(42))       // dentro disto: frente cheia
  const C0 = Math.cos(THREE.MathUtils.degToRad(78))       // fora disto: parque cheio
  const t = Math.min(1, Math.max(0, (cos - C0) / (C1 - C0)))
  const k = t * t * (3 - 2 * t)
  return PARK_HALF + (PARK_FRENTE - PARK_HALF) * k
}
export function parkCore(lx: number, lz: number): number {
  return parkReach(lx, lz) - PARK_BLEND
}

/** quanto o regolito desce sob o parque, abaixo do datum, para nunca vazar pelo vale (fundo −61) */
export const PARK_PIT = 80

/** Onde o salão do Templo Leonidas ficou, em MUNDO. O parque preenche quando
 *  carrega (a altura só se sabe depois do datum); as vistas leem daqui. Enquanto
 *  for (0,0,0) o marcador do menu cai numa estimativa. */
export const TEMPLE_WORLD = new THREE.Vector3()
