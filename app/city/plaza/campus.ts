// ═══════════════════════════════════════════════════════════════════════════
// O CAMPUS ESPORTIVO: o chão que DOG Athletics, $DOG ARENA e THE GEODE dividem.
//
// Até 07/09 as três peças eram três ilhas: cada uma no seu bloco, cada uma com
// uma base nascida do contorno do próprio prédio (oval no ARENA, redonda na
// GEODE, octogonal no atletismo) e cada uma pousada na cota do terreno que
// calhava de existir debaixo dela. O fundador olhou a chapa e disse o que
// faltava: "base quadrada e com material padronizado nos 3... padronizamos a
// calçada que os 3 usam e otimizamos o espaço".
//
// ⚠️ E OS TRÊS NÃO CABEM NUMA CÉLULA. Medido antes de mexer: com pódio quadrado
// e calçada de 12 m os lados são 442, 344 e 316 m, ou seja 1.102 m de arco em
// fileira, 1.270 m contando vão e recuo. A maior célula da cidade é justamente a
// do atletismo, 466 x 895 m, e a peça ocupava 18% dela — é por isso que na chapa
// parecia caber tudo. O que existe é melhor do que caber: uma CÉLULA MAIOR.
//
// ⚠️ E A CÉLULA MAIOR JÁ ESTAVA LÁ, ENTRE DUAS AVENIDAS. A faixa de anel do
// ARENA (r 3.030 a 3.558) vai da avenida de 90° à de 120° em exatamente sete
// módulos. O ARENA ocupava três e a GEODE dois; sobravam dois, encostados na
// avenida de 90°, secos e sem colisão com programa nenhum. O atletismo veio para
// cá e o resultado é o que o fundador procurava sem ter o número:
//
//     DOG Athletics  rumo  94,286°  ┐
//     $DOG ARENA     rumo 105,000°  ├ 615,1 m entre um e outro. Os dois vãos.
//     THE GEODE      rumo 115,714°  ┘
//
// Mesmo anel, espaçamento idêntico, e o trio preenche a faixa inteira entre as
// duas avenidas. Nem o ARENA nem a GEODE saíram do lugar: quem se mudou foi a
// peça nova. O atletismo ainda desceu de r 4.042 para r 3.294, o que encurta o
// corte de distância dele de 5.500 para 4.700 m no celular.
//
// ⚠️ A PARCELA AGORA É UMA SÓ, e é isso que apaga as duas ruas radiais que
// separavam as três peças. Decisão do fundador em 07/09 ("campus único, sem rua
// interna"). A regra da casa continua obedecida: a parcela é um número inteiro
// de módulos da teia e os lados dela SÃO ruas — só que agora são as duas
// avenidas e os dois anéis, não as radiais finas de dentro.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'
import { ESTADIO_MOD, ESTADIO_PECA_X, ESTADIO_PECA_Z } from './estadio'
import { GEODE_MOD, GEODE_PECA_X, GEODE_PECA_Z } from './geode'
import { ATLETISMO_MOD, ATLETISMO_PECA_X, ATLETISMO_PECA_Z } from './atletismo'
import { COR_CALCADA, COR_MEIOFIO, Y_CALCADA } from './vias'

/** a parcela inteira: da avenida de 90° à de 120°, na faixa de anel do ARENA */
export const CAMPUS_MOD: Modulo = { i: 11, nr: 3, j: 42, ns: 7 }

/**
 * ⚠️ A CALÇADA PADRONIZADA É ESTA MEDIDA, E É A ÚNICA COISA QUE DEFINE O LADO DO
 * PÓDIO. Cada peça já declara o chão que ocupa (`*_PECA_X/Z`, que inclui
 * esplanada e talude do próprio modelo); o pódio é o quadrado que circunscreve
 * essa pegada mais 12 m de calçada por lado. Não é número escolhido: mudou a
 * peça, muda o pódio sozinho.
 */
export const CALCADA = 12

/** o degrau do pódio sobre o terraço, e a berma plana em volta dele */
export const PODIO_H = 1.2
export const BERMA = 24

/**
 * ⚠️ O TALUDE É 80 m E O NÚMERO SAIU DO VÃO, não do gosto. Entre os pódios do
 * atletismo e do ARENA sobram 222 m; tirando as duas bermas de 24, restam 174
 * para dois taludes. 80 + 80 = 160 cabe, 90 + 90 = 180 não cabia e os dois
 * terraços se comeriam.
 */
export const TALUDE = 80

/**
 * OS TRÊS TERRAÇOS.
 *
 * ⚠️ UMA COTA SÓ PARA OS TRÊS NÃO SERVE, E O TERRENO É QUE DIZ ISSO. O declive
 * do sítio é TANGENCIAL, não radial: no raio 3.294 o chão sobe de −34 m na
 * avenida de 90° para −10 no rumo 105° e segue até −5, enquanto no radial ele
 * varia menos de 3 m sob o ARENA. Um platô único a uma cota só (a equilibrada
 * seria −17,5, com 16,9 m de corte contra 17,1 de aterro) precisaria de 24 m de
 * aterro na ponta do 90°, e o talude desse aterro só teria os ~50 m que sobram
 * entre o pódio e a avenida: 1:2, que é muro, não terreno.
 *
 * ⚠️ ENTÃO SÃO TRÊS TERRAÇOS, E O DEGRAU É CONSTANTE DE PROPÓSITO: 9,00 m entre
 * um e outro. O fundador prefere elemento repetido igualmente espaçado, e aqui
 * isso também é o que barateia a terraplanagem — nenhum dos três passa de 9,5 m
 * de corte nem de 7,4 m de aterro, contra os 24 do platô único. O degrau vence
 * os 222/236 m de vão a 11%, que é rampa de caminhar.
 */
export interface Terraco {
  /** o nome do objeto na cena, para casar com o GLB que pousa em cima */
  readonly id: string
  readonly mod: Modulo
  /** lado do pódio quadrado: a pegada da peça mais 12 m de calçada por lado */
  readonly lado: number
  /** a cota terraplanada deste terraço */
  readonly y: number
}

const ladoDe = (x: number, z: number) => Math.max(x, z) + 2 * CALCADA

export const TERRACOS: readonly Terraco[] = [
  { id: 'DOG_ATHLETICS', mod: ATLETISMO_MOD, lado: ladoDe(ATLETISMO_PECA_X, ATLETISMO_PECA_Z), y: -26.0 },
  { id: 'DOG_ARENA', mod: ESTADIO_MOD, lado: ladoDe(ESTADIO_PECA_X, ESTADIO_PECA_Z), y: -17.0 },
  { id: 'THE_GEODE', mod: GEODE_MOD, lado: ladoDe(GEODE_PECA_X, GEODE_PECA_Z), y: -8.0 },
]

/** centro e giro de um terraço, direto da teia — nunca de coordenada escrita */
export function terracoSitio(t: Terraco): { x: number; z: number; a: number } {
  const c = caixaDoModulo(t.mod)
  const a = (c.a0 + c.a1) / 2
  return { x: Math.sin(a) * c.rm, z: -Math.cos(a) * c.rm, a }
}

/** o polígono da parcela única, que vira máscara de via */
export function campusParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(CAMPUS_MOD) }
}

// ── a terraplanagem ─────────────────────────────────────────────────────────
// ⚠️ PORTA RÁPIDA ANTES DE QUALQUER CONTA. `campusAlturaAt` é chamada de dentro
// de `heightAt`, que é o trava-chão da câmera (todo quadro) e o pouso de toda
// peça, poste e árvore da cidade. Quase todo ponto do mapa está fora do campus,
// e o teste de raio resolve isso com uma comparação, sem atan2 e sem raiz.
const _sitios = TERRACOS.map((t) => ({ t, s: terracoSitio(t), meia: t.lado / 2 + BERMA }))
const _rMin = Math.min(..._sitios.map((o) => Math.hypot(o.s.x, o.s.z) - o.meia - TALUDE))
const _rMax = Math.max(..._sitios.map((o) => Math.hypot(o.s.x, o.s.z) + o.meia + TALUDE))

const _suave = (k: number) => k * k * (3 - 2 * k)

/**
 * ⚠️ A TERRAPLANAGEM PARA NA DIVISA DA PARCELA, E ISSO NÃO É ZELO: É O QUE SALVA
 * AS DUAS AVENIDAS. Sem esta máscara o talude de 80 m dos terraços das pontas
 * transbordava para fora do bloco e pegava a avenida de 120° no meio da subida:
 * medido, **18,88 m de caimento transversal nos 44 m de largura dela**, ou seja
 * 42,9% de through-fall numa via principal. A avenida é a DIVISA do campus, não
 * parte dele; ela tem de continuar no chão natural.
 *
 * Com a máscara, o aterro da ponta desce dentro da parcela e o pódio continua
 * plano: o pódio mais afastado da divisa está a 43 m dela (o do ARENA, no
 * radial) e a franja tem 30, então nenhum dos três encosta na descida.
 */
const _cx = caixaDoModulo(CAMPUS_MOD)
export const FRANJA = 34

function pesoParcela(x: number, z: number): number {
  const r = Math.hypot(x, z)
  if (r <= _cx.r0 || r >= _cx.r1) return 0
  let a = Math.atan2(x, -z)
  if (a < 0) a += Math.PI * 2
  if (a <= _cx.a0 || a >= _cx.a1) return 0
  const dentro = Math.min(r - _cx.r0, _cx.r1 - r, (a - _cx.a0) * r, (_cx.a1 - a) * r)
  return dentro >= FRANJA ? 1 : _suave(dentro / FRANJA)
}

/**
 * O peso da terraplanagem de um terraço em (x, z): 1 no quadrado plano (pódio
 * mais berma), caindo por smoothstep ao longo do talude, 0 fora dele.
 *
 * ⚠️ A CAIXA É MEDIDA NO EIXO LOCAL DA PEÇA, e a matriz tem de ser a MESMA que
 * `assentarEstadio`/`assentarGeode`/`assentarAtletismo` usam para pousar o GLB
 * (rotation.y = −rumo). Se os sinais divergirem, o platô fica girado em relação
 * ao prédio e o canto do prédio pousa no talude. A ida é
 * `(wx, wz) = (C·lx − S·lz, S·lx + C·lz)`; esta é a volta.
 */
function pesoDoTerraco(o: (typeof _sitios)[number], x: number, z: number): number {
  const C = Math.cos(o.s.a), S = Math.sin(o.s.a)
  const dx = x - o.s.x, dz = z - o.s.z
  const lx = Math.abs(C * dx + S * dz) - o.meia
  const lz = Math.abs(-S * dx + C * dz) - o.meia
  if (lx <= 0 && lz <= 0) return 1
  const fora = Math.hypot(Math.max(lx, 0), Math.max(lz, 0))
  if (fora >= TALUDE) return 0
  return _suave(1 - fora / TALUDE)
}

/**
 * A cota do chão depois da terraplanagem, dada a cota natural.
 *
 * ⚠️ OS TERRAÇOS NÃO SE SOBREPÕEM, e isso é garantido pelo TALUDE de 80 m contra
 * os vãos de 222 e 236 m. Por isso a soma dos pesos nunca passa de 1 e não
 * precisa de normalização; se um dia um pódio crescer, o `Math.min(1, ...)`
 * abaixo degrada para a média em vez de estourar a cota.
 */
export function campusAlturaAt(x: number, z: number, natural: number): number {
  const r = Math.hypot(x, z)
  if (r < _rMin || r > _rMax) return natural
  const mascara = pesoParcela(x, z)
  if (mascara <= 0) return natural
  let peso = 0, alvo = 0
  for (const o of _sitios) {
    const w = pesoDoTerraco(o, x, z)
    if (w > 0) { peso += w; alvo += w * o.t.y }
  }
  if (peso <= 0) return natural
  const k = Math.min(1, peso) * mascara
  return natural * (1 - k) + (alvo / peso) * k
}

/** a cota em que o GLB de cada peça pousa: o topo do pódio, não o terreno */
export function podioTopo(t: Terraco): number {
  return t.y + Y_CALCADA + PODIO_H
}

/**
 * Envolve o `superficieAt` do terreno para que quem pousa peça encontre o TOPO
 * DO PÓDIO dentro do quadrado dele, e o chão normal fora.
 *
 * ⚠️ É ASSIM QUE OS TRÊS PASSAM A DIVIDIR O MESMO PISO SEM QUE `estadio.ts`,
 * `geode.ts` e `atletismo.ts` PRECISEM SABER DO CAMPUS. Cada um continua
 * varrendo a própria peça em grade e pegando a cota máxima, exatamente como
 * antes; só que a cota que eles encontram agora é a laje, que é plana, então a
 * varredura devolve o mesmo número em todos os pontos e o prédio assenta rente.
 */
export function comPodio(base: (x: number, z: number) => number) {
  return (x: number, z: number): number => {
    for (const o of _sitios) {
      const C = Math.cos(o.s.a), S = Math.sin(o.s.a)
      const dx = x - o.s.x, dz = z - o.s.z
      const meia = o.t.lado / 2
      if (Math.abs(C * dx + S * dz) <= meia && Math.abs(-S * dx + C * dz) <= meia) {
        return podioTopo(o.t)
      }
    }
    return base(x, z)
  }
}

// ── o desenho ───────────────────────────────────────────────────────────────
// Uma geometria só, cor por vértice, um material: o campus inteiro é uma chamada
// de desenho. A paleta é a da rua (`vias.ts`), e é isso que faz a calçada dos
// três ser a MESMA calçada da cidade e não um cinza inventado aqui.

/**
 * ⚠️ A SAIA DO PÓDIO DESCE ATÉ O TERRENO, E NÃO TEM ALTURA FIXA. A primeira
 * versão era uma caixa de 1,2 m e ela FLUTUAVA, por causa de uma armadilha que
 * só apareceu quando a medição foi feita: o anel interno da cidade é uma FACE do
 * dodecágono, não um arco. Entre a avenida de 90° e a de 120° a face é uma reta
 * só, então o raio útil no rumo do bloco é menor que a apótema que
 * `caixaDoModulo` devolve. Medido: o canto de dentro do pódio do atletismo fica
 * a **5,6 m** da divisa (o do ARENA a 36 e o da GEODE a 21), e logo depois da
 * divisa o chão volta ao natural e cai 7 m. Caixa de altura fixa ali é laje
 * pendurada no ar.
 *
 * Com a saia medida contra o terreno em volta, o pódio vira o que ele é de fato
 * num terraço em encosta: laje por cima, muro de arrimo por baixo, e a altura do
 * muro é o que a encosta pedir. É a mesma solução que `build_estadio.py` já usa
 * na `plataforma()` do ARENA, com 26 m de saia.
 */
const RESERVA_SAIA = 2.5

function saiaAte(alturaEm: (x: number, z: number) => number, o: (typeof _sitios)[number]): number {
  const C = Math.cos(o.s.a), S = Math.sin(o.s.a)
  const meia = o.t.lado / 2
  let baixo = Infinity
  // uma faixa em volta do pódio, da borda dele até o fim da berma: é onde o
  // terreno pode fugir para baixo, e é o que a saia tem de alcançar.
  for (let passo = 0; passo <= BERMA; passo += 6) {
    const d = meia + passo
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * Math.PI * 2
      const lx = Math.max(-d, Math.min(d, Math.cos(a) * d * 1.5))
      const lz = Math.max(-d, Math.min(d, Math.sin(a) * d * 1.5))
      baixo = Math.min(baixo, alturaEm(o.s.x + C * lx - S * lz, o.s.z + S * lx + C * lz))
    }
  }
  return baixo - RESERVA_SAIA
}

function caixa(
  pos: number[], nor: number[], cor: number[],
  cx: number, cz: number, ang: number, meia: number,
  y0: number, y1: number, topo: THREE.Color, lateral: THREE.Color,
) {
  const C = Math.cos(ang), S = Math.sin(ang)
  const p = (lx: number, lz: number, y: number) => [cx + C * lx - S * lz, y, cz + S * lx + C * lz]
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], k: THREE.Color) => {
    for (const v of [a, b, c, a, c, d]) pos.push(v[0], v[1], v[2])
    for (let i = 0; i < 6; i++) { nor.push(n[0], n[1], n[2]); cor.push(k.r, k.g, k.b) }
  }
  const A = p(-meia, -meia, y1), B = p(meia, -meia, y1)
  const D = p(meia, meia, y1), E = p(-meia, meia, y1)
  quad(A, B, D, E, [0, 1, 0], topo)
  const a0 = p(-meia, -meia, y0), b0 = p(meia, -meia, y0)
  const d0 = p(meia, meia, y0), e0 = p(-meia, meia, y0)
  quad(a0, A, E, e0, [-C, 0, -S], lateral)
  quad(b0, d0, D, B, [C, 0, S], lateral)
  quad(a0, b0, B, A, [S, 0, -C], lateral)
  quad(e0, E, D, d0, [-S, 0, C], lateral)
}

/**
 * O campus desenhado: o pódio quadrado de cada peça, topo de calçada e face de
 * meio-fio, com a saia descendo até o terreno em volta.
 *
 * ⚠️ O PÓDIO É QUADRADO NOS TRÊS E O LADO É A ÚNICA COISA QUE MUDA. É o que o
 * fundador pediu: a base padroniza, o prédio é que é diferente. A esplanada oval
 * do ARENA e o disco da GEODE continuam dentro dos GLBs e pousam em cima desta
 * laje; a faixa de 12 m que sobra em volta deles é a calçada comum.
 */
export function criarCampus(alturaEm: (x: number, z: number) => number): THREE.Group {
  const pos: number[] = [], nor: number[] = [], cor: number[] = []
  const kCalcada = new THREE.Color(COR_CALCADA)
  const kMeiofio = new THREE.Color(COR_MEIOFIO)
  for (const o of _sitios) {
    caixa(pos, nor, cor, o.s.x, o.s.z, -o.s.a, o.t.lado / 2,
      saiaAte(alturaEm, o), podioTopo(o.t), kCalcada, kMeiofio)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
  g.computeBoundingSphere()
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
  const mesh = new THREE.Mesh(g, mat)
  mesh.name = 'CAMPUS_ESPORTIVO'
  mesh.receiveShadow = true
  mesh.castShadow = true
  const grupo = new THREE.Group()
  grupo.name = 'CAMPUS'
  grupo.add(mesh)
  return grupo
}

/** a profundidade da saia de cada pódio, para quem quiser medir sem desenhar */
export function saiasDoCampus(alturaEm: (x: number, z: number) => number) {
  return _sitios.map((o) => ({ id: o.t.id, topo: podioTopo(o.t), pe: saiaAte(alturaEm, o),
    altura: podioTopo(o.t) - saiaAte(alturaEm, o) }))
}
