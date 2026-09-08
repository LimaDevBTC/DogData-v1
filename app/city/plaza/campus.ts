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
import { COR_CALCADA, COR_MEIOFIO, COR_PLATO } from './vias'

/** a parcela inteira: da avenida de 90° à de 120°, na faixa de anel do ARENA */
export const CAMPUS_MOD: Modulo = { i: 11, nr: 3, j: 42, ns: 7 }


/**
 * ⚠️ UM PÓDIO SÓ, E ISSO SUBSTITUIU TRÊS. A primeira versão dava a cada peça um
 * pódio quadrado próprio, em três terraços de cota diferente. O fundador viu a
 * chapa de produção e recusou: "ta muito feio separado assim, se preciso
 * terraplane e aterre". Agora a parcela inteira é UMA laje, numa cota só, e as
 * três peças pousam nela.
 *
 * ⚠️ E A COTA ÚNICA SE PAGA EM TERRA, que é o que ele autorizou. Medido sobre os
 * 92,3 ha da parcela, o terreno natural vai de −34,0 a −0,9 m, ou seja 33,1 m de
 * amplitude. A cota que EQUILIBRA corte e aterro é −17,7: 2,74 milhões de m³ de
 * cada lado, sem importar nem exportar terra. Ela custa 16,8 m de corte em 64%
 * da área e 16,3 m de aterro nos outros 36%.
 *
 * As alternativas foram medidas e recusadas: −14,0 deixaria o muro do lado da
 * cidade mais baixo, mas pede 4,80M m³ de aterro contra 1,39M de corte, ou seja
 * 3,4 milhões de m³ de terra que teriam de vir de outro lugar da Lua.
 */
export const CAMPUS_Y = -17.7

/** a espessura da laje sobre o chão terraplanado */
export const PODIO_H = 1.5

/**
 * ⚠️ A TERRAPLANAGEM PARA NA DIVISA, E ISSO SALVA AS DUAS AVENIDAS. Sem esta
 * franja o talude transbordava e pegava a avenida de 120° com 18,88 m de
 * caimento transversal nos 44 m de largura dela, 42,9%. A avenida é a DIVISA do
 * campus, não parte dele: ela continua no chão natural.
 *
 * ⚠️ E A LAJE É RECUADA DA DIVISA NESTA MESMA MEDIDA, para a borda dela pousar
 * em chão já plano. O que fica entre a laje e a divisa é a rampa da franja, e
 * ela some atrás do muro do pódio.
 */
export const FRANJA = 34

/** a faixa de calçada na borda da laje, a mesma medida da calçada da cidade */
export const CALCADA = 12

/** quanto o muro do pódio desce abaixo do chão mais baixo que ele encontra */
const RESERVA_MURO = 2.5

type Pt = readonly [number, number]

const _cx = caixaDoModulo(CAMPUS_MOD)
const _poly = polyDoModulo(CAMPUS_MOD) as Pt[]

/** o polígono da parcela, que vira máscara de via */
export function campusParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(CAMPUS_MOD) }
}

/** onde cada peça pousa: continua vindo da teia, nunca de coordenada escrita */
export const PECAS = [
  { id: 'DOG_ATHLETICS', mod: ATLETISMO_MOD, x: ATLETISMO_PECA_X, z: ATLETISMO_PECA_Z },
  { id: 'DOG_ARENA', mod: ESTADIO_MOD, x: ESTADIO_PECA_X, z: ESTADIO_PECA_Z },
  { id: 'THE_GEODE', mod: GEODE_MOD, x: GEODE_PECA_X, z: GEODE_PECA_Z },
] as const

export function pecaSitio(mod: Modulo): { x: number; z: number; a: number } {
  const c = caixaDoModulo(mod)
  const a = (c.a0 + c.a1) / 2
  return { x: Math.sin(a) * c.rm, z: -Math.cos(a) * c.rm, a }
}

// ── a terraplanagem ─────────────────────────────────────────────────────────
// ⚠️ PORTA RÁPIDA ANTES DE QUALQUER CONTA. `campusAlturaAt` é chamada de dentro
// de `heightAt`, que é o trava-chão da câmera (todo quadro) e o pouso de toda
// peça, poste e árvore da cidade. Quase todo ponto do mapa está fora do campus,
// e o teste de raio resolve isso com duas comparações, sem atan2 e sem raiz.
const _rDentro = _cx.r0 - 40
const _rFora = Math.max(..._poly.map((p) => Math.hypot(p[0], p[1]))) + 40
// ⚠️ A PORTA COMPARA RAIO AO QUADRADO, SEM RAIZ. Medido: `Math.hypot` custa
// 45,3 ns por chamada nesta função, e `heightAt` é o trava-chão da câmera e o
// pouso de toda peça, poste e árvore da cidade — no boot são centenas de
// milhares de chamadas. `Math.hypot` do V8 não é a raiz da soma: ele trata
// estouro e desnormal, e não é embutido. Comparar x²+z² contra os limites ao
// quadrado dá a MESMA resposta e derruba o custo para o piso do laço em todo
// ponto fora do campus, que é 99% do mapa.
const _r2Dentro = _rDentro * _rDentro
const _r2Fora = _rFora * _rFora

const _suave = (k: number) => k * k * (3 - 2 * k)

/**
 * 1 no miolo da parcela, caindo a 0 na divisa ao longo da franja.
 *
 * ⚠️ A DISTÂNCIA SE MEDE CONTRA O POLÍGONO, NÃO CONTRA O SETOR ANULAR, e isso é
 * conserto de defeito medido. A primeira versão usava a métrica (raio, ângulo):
 * `min(r − r0, r1 − r, (a − a0)·r, (a1 − a)·r)`. Só que a parcela DESENHADA é um
 * quadrilátero de lados retos (o anel da cidade é uma face de dodecágono, não um
 * arco), e a laje é recuada perpendicular a essas retas. Num bloco de 30° as
 * duas métricas divergem por mais de 100 m nas quinas: o verificador pegou a
 * borda da laje pousada num trecho de rampa com **66,2% de declive**.
 *
 * Medindo contra as mesmas quatro retas que `recuar()` usa, a franja chega a 1
 * exatamente onde a laje começa, por construção. São quatro produtos escalares.
 */
const _arestas = _poly.map((p, i) => {
  const q = _poly[(i + 1) % _poly.length]
  const dx = q[0] - p[0], dz = q[1] - p[1]
  const L = Math.hypot(dx, dz) || 1
  return { px: p[0], pz: p[1], nx: dz / L, nz: -dx / L }
})

function dentroDaParcela(x: number, z: number): number {
  let d = Infinity
  for (const a of _arestas) {
    const t = (x - a.px) * a.nx + (z - a.pz) * a.nz
    if (t < d) d = t
  }
  return d
}

function pesoParcela(x: number, z: number): number {
  const r2 = x * x + z * z
  if (r2 <= _r2Dentro || r2 >= _r2Fora) return 0
  const dentro = dentroDaParcela(x, z)
  if (dentro <= 0) return 0
  return dentro >= FRANJA ? 1 : _suave(dentro / FRANJA)
}

/**
 * ⚠️ CHAVE DE DIAGNÓSTICO: `?campus=0` desliga a terraplanagem E a laje. Ela
 * existe porque em 07/09 a chapa de produção mostrou o terreno da cidade INTEIRA
 * escurecendo pela metade (RGB 111 para 48, medido longe do campus) quando o
 * pódio único entrou, com a MESMA contagem de triângulos e de chamadas de
 * desenho. Sem uma chave, separar "foi o campus" de "foi outra coisa" custa um
 * deploy por tentativa. A leitura acontece uma vez, no módulo, como o resto da
 * casa faz (`TERRENO_FINO_ATIVO` em `terreno-fino.ts`).
 */
const _flagCampus = typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('campus') ?? '')
/** a terraplanagem entra? (`?campus=0` e `?campus=laje` desligam) */
export const CAMPUS_CHAO = _flagCampus !== '0' && _flagCampus !== 'laje'
/** a laje entra? (`?campus=0` e `?campus=chao` desligam) */
export const CAMPUS_LAJE = _flagCampus !== '0' && _flagCampus !== 'chao'
/** compatibilidade: verdadeiro quando qualquer metade está ligada */
export const CAMPUS_ATIVO = CAMPUS_CHAO || CAMPUS_LAJE

/** a cota do chão depois da terraplanagem, dada a cota natural */
export function campusAlturaAt(x: number, z: number, natural: number): number {
  if (!CAMPUS_CHAO) return natural
  const k = pesoParcela(x, z)
  return k <= 0 ? natural : natural * (1 - k) + CAMPUS_Y * k
}

/**
 * O RUMO DO CAMPUS: o eixo da laje, e desde 07/09 o giro das TRÊS peças.
 *
 * ⚠️ ANTES CADA PEÇA SEGUIA A PRÓPRIA TANGENTE, E ISSO FICOU TORTO. A regra
 * original (`estadio.ts`) manda o eixo longo do prédio na tangente do anel,
 * porque é isso que o deixa paralelo à rua de anel do próprio quarteirão. Com
 * três quarteirões vizinhos as tangentes são diferentes: 94,286° no atletismo,
 * 105° no ARENA e 115,714° na GEODE, ou seja **10,714° de torção para cada
 * lado**. Enquanto cada peça tinha a sua rua em volta, cada uma lia como certa.
 *
 * No pódio único não existe mais rua interna: a referência do olho passou a ser
 * a LAJE, e contra ela o ARENA (que por acaso está no rumo do meio) parece
 * perfeito e os outros dois parecem tortos. O fundador viu na chapa: "a posição
 * do the geode e da pista de atletismo não estão devidamente alinhadas com o
 * estádio, e já estava assim, um pouco torto".
 *
 * Agora as três giram no rumo do meio do bloco. A regra da casa continua
 * respeitada, só que o alinhamento é com a rua que EXISTE: as duas avenidas que
 * limitam o campus, que são paralelas a este eixo.
 */
export const CAMPUS_RUMO = ((_cx.a0 + _cx.a1) / 2) * 180 / Math.PI
/** o giro em radianos que as três peças recebem, na convenção do Three */
export const GIRO_CAMPUS = -((_cx.a0 + _cx.a1) / 2)

/** o topo da laje: é aqui que as três peças pousam */
export const PODIO_TOPO = CAMPUS_Y + PODIO_H

// ── o polígono da laje ──────────────────────────────────────────────────────
/**
 * Recua um polígono CONVEXO para dentro por `d`, deslocando cada aresta e
 * cruzando as retas vizinhas. Convexo é o caso aqui: a parcela é um quadrilátero.
 *
 * ⚠️ O RECUO NÃO É "PUXAR O VÉRTICE PARA O CENTRO". Isso encolheria a peça por
 * fator, e num quadrilátero alongado como este (1,6 km por 0,5 km) o recuo sairia
 * três vezes maior num eixo do que no outro.
 */
function recuar(poly: Pt[], d: number): Pt[] {
  const n = poly.length
  const retas = poly.map((p, i) => {
    const q = poly[(i + 1) % n]
    const dx = q[0] - p[0], dz = q[1] - p[1]
    const L = Math.hypot(dx, dz) || 1
    // normal para DENTRO: o polígono vem no sentido que dá normal +Y (medido),
    // então (dz, −dx)/L aponta para o miolo.
    const nx = dz / L, nz = -dx / L
    return { px: p[0] + nx * d, pz: p[1] + nz * d, dx, dz }
  })
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = retas[(i + n - 1) % n], b = retas[i]
    const det = a.dx * b.dz - a.dz * b.dx
    if (Math.abs(det) < 1e-9) { out.push([b.px, b.pz]); continue }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / det
    out.push([a.px + a.dx * t, a.pz + a.dz * t])
  }
  return out
}

const _laje = recuar(_poly, FRANJA)
const _lajeMiolo = recuar(_laje, CALCADA)

/**
 * O EIXO DO LOSANGO, e é sobre ele que as três peças se alinham.
 *
 * ⚠️ O CENTRO DO MÓDULO NÃO É O CENTRO DA LAJE, E A DIFERENÇA É DE 57,4 m. Os
 * três módulos têm o mesmo raio (3.294), ou seja os centros deles estão num
 * ARCO. A laje é um quadrilátero de lados RETOS, porque o anel da cidade é uma
 * face de dodecágono: a linha do meio dela passa em 3.294 no centro e em 3.408
 * nas pontas. Resultado medido: o ARENA (que está no rumo do meio) cai exato
 * sobre o eixo, e o atletismo e a GEODE ficam os dois 57,4 m fora dele, para o
 * mesmo lado.
 *
 * O fundador viu na chapa de cima: "a gente tem um losango, ele precisa estar
 * alinhado e centralizado com as laterais reais; é visível que o centro do
 * geodo e o centro do estádio de atletismo não estão centralizados na largura
 * do losango".
 *
 * ⚠️ E A CORREÇÃO É PROJEÇÃO, NÃO COORDENADA NOVA. A posição AO LONGO do eixo
 * continua vindo da teia (é a projeção do centro do módulo), e só a componente
 * perpendicular é zerada. Se a teia mudar, as três acompanham sozinhas, que é a
 * regra da casa.
 */
const _eixo = (() => {
  const n = _laje.length
  const arestas = _laje.map((p, i) => {
    const q = _laje[(i + 1) % n]
    return { i, L: Math.hypot(q[0] - p[0], q[1] - p[1]),
      m: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number] }
  })
  // as duas arestas CURTAS são as pontas do losango; o eixo liga os meios delas
  const curtas = [...arestas].sort((a, b) => a.L - b.L).slice(0, 2).sort((a, b) => a.i - b.i)
  const M1 = curtas[0].m, M2 = curtas[1].m
  const L = Math.hypot(M2[0] - M1[0], M2[1] - M1[1])
  return { cx: (M1[0] + M2[0]) / 2, cz: (M1[1] + M2[1]) / 2,
    dx: (M2[0] - M1[0]) / L, dz: (M2[1] - M1[1]) / L, L }
})()

/** o comprimento do eixo da laje, para quem for distribuir coisa em cima dela */
export const EIXO_CAMPUS = { x: _eixo.cx, z: _eixo.cz, dx: _eixo.dx, dz: _eixo.dz, comprimento: _eixo.L }

/**
 * O sítio de uma peça JÁ ALINHADO no eixo da laje: mantém a posição ao longo do
 * eixo que a teia dá e zera o desvio perpendicular.
 */
export function sitioNoCampus(mod: Modulo): { x: number; z: number } {
  const s = pecaSitio(mod)
  const t = (s.x - _eixo.cx) * _eixo.dx + (s.z - _eixo.cz) * _eixo.dz
  return { x: _eixo.cx + _eixo.dx * t, z: _eixo.cz + _eixo.dz * t }
}

function dentroDoPoly(x: number, z: number, poly: Pt[]): boolean {
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro
  }
  return dentro
}

/** o polígono da laje, para quem precisa medir sem desenhar */
export function lajeDoCampus(): Pt[] { return _laje }
export function naLaje(x: number, z: number): boolean { return dentroDoPoly(x, z, _laje) }

/**
 * Envolve o `superficieAt` do terreno para que quem pousa peça encontre o TOPO
 * DA LAJE dentro dela, e o chão normal fora.
 *
 * ⚠️ É ASSIM QUE OS TRÊS DIVIDEM O MESMO PISO SEM QUE `estadio.ts`, `geode.ts` e
 * `atletismo.ts` PRECISEM SABER DO CAMPUS. Cada um continua varrendo a própria
 * peça em grade e pegando a cota máxima, exatamente como antes; só que a cota
 * que eles encontram agora é a laje, que é plana, então a varredura devolve o
 * mesmo número em todos os pontos e o prédio assenta rente.
 */
export function comPodio(base: (x: number, z: number) => number) {
  return (x: number, z: number): number => (naLaje(x, z) ? PODIO_TOPO : base(x, z))
}

// ── o desenho ───────────────────────────────────────────────────────────────
/**
 * ⚠️ A NORMAL SAI DO WINDING, NÃO DE UM VETOR ESCRITO À MÃO, e isso é conserto
 * de defeito medido. A versão anterior declarava a normal num parâmetro e
 * montava o triângulo na ordem "natural": para a tampa, com A(-m,-m), B(m,-m) e
 * D(m,m), o produto vetorial (B−A)×(D−A) dá −Y contra o +Y declarado. Three
 * descarta por WINDING e não pela normal declarada, então a tampa era back-face
 * e sumia: a chapa de produção mostrou o INTERIOR escuro da caixa, e o fundador
 * viu "um quadrado com cor diferente do resto do terreno, não é calçada, não é
 * platô, é outra coisa". Era o avesso.
 *
 * Calculando a normal a partir dos próprios vértices, declarado e desenhado não
 * podem mais divergir: ou os dois estão certos, ou os dois estão errados juntos
 * e o teste de tampa (abaixo) pega.
 */
function tri(pos: number[], nor: number[], cor: number[], a: Pt3, b: Pt3, c: Pt3, k: THREE.Color) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const L = Math.hypot(nx, ny, nz) || 1
  nx /= L; ny /= L; nz /= L
  for (const p of [a, b, c]) pos.push(p[0], p[1], p[2])
  for (let i = 0; i < 3; i++) { nor.push(nx, ny, nz); cor.push(k.r, k.g, k.b) }
  return ny
}
type Pt3 = readonly [number, number, number]

/** leque a partir do vértice 0: o polígono é convexo, então isto basta */
function tampa(pos: number[], nor: number[], cor: number[], poly: Pt[], y: number, k: THREE.Color) {
  let pior = 1
  for (let i = 1; i + 1 < poly.length; i++) {
    const ny = tri(pos, nor, cor,
      [poly[0][0], y, poly[0][1]], [poly[i][0], y, poly[i][1]], [poly[i + 1][0], y, poly[i + 1][1]], k)
    pior = Math.min(pior, ny)
  }
  return pior
}

/** o anel entre dois polígonos concêntricos, no mesmo plano */
function faixa(pos: number[], nor: number[], cor: number[], fora: Pt[], dentro: Pt[], y: number, k: THREE.Color) {
  let pior = 1
  for (let i = 0; i < fora.length; i++) {
    const j = (i + 1) % fora.length
    const A: Pt3 = [fora[i][0], y, fora[i][1]], B: Pt3 = [fora[j][0], y, fora[j][1]]
    const C: Pt3 = [dentro[j][0], y, dentro[j][1]], D: Pt3 = [dentro[i][0], y, dentro[i][1]]
    pior = Math.min(pior, tri(pos, nor, cor, A, B, C, k), tri(pos, nor, cor, A, C, D, k))
  }
  return pior
}

/**
 * O MURO. Desce de `y` até `pe` ao longo de cada aresta, com a face virada para
 * FORA. A altura não é constante e não pode ser: o terreno em volta do campus
 * varia 26 m, então o muro tem 19 m na ponta da avenida de 90° e some quase por
 * completo no anel de fora.
 */
function muro(pos: number[], nor: number[], cor: number[], poly: Pt[], y: number, pe: (x: number, z: number) => number, k: THREE.Color) {
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    const p = poly[i], q = poly[j]
    // subdivide a aresta: o pé acompanha o terreno, que não é reto
    const n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 60))
    for (let s = 0; s < n; s++) {
      const t0 = s / n, t1 = (s + 1) / n
      const x0 = p[0] + (q[0] - p[0]) * t0, z0 = p[1] + (q[1] - p[1]) * t0
      const x1 = p[0] + (q[0] - p[0]) * t1, z1 = p[1] + (q[1] - p[1]) * t1
      const b0 = pe(x0, z0), b1 = pe(x1, z1)
      // ordem escolhida para a normal apontar para FORA do polígono
      tri(pos, nor, cor, [x0, y, z0], [x0, b0, z0], [x1, b1, z1], k)
      tri(pos, nor, cor, [x0, y, z0], [x1, b1, z1], [x1, y, z1], k)
    }
  }
}

/**
 * A cota em que o muro do pódio tem de pousar num ponto da borda.
 *
 * ⚠️ ELE PROCURA O CHÃO MAIS BAIXO NUMA FAIXA EM VOLTA, não só embaixo da
 * aresta. Entre a aresta da laje e a divisa da parcela existe a rampa da franja,
 * e depois dela o terreno natural, que na ponta da avenida de 90° está a
 * −35,6 m. Um muro que parasse na cota da própria aresta (que é o chão já
 * terraplanado, −17,7) deixaria 18 m de rampa à mostra por baixo dele.
 */
export function peDoMuro(alturaEm: (x: number, z: number) => number, x: number, z: number): number {
  let baixo = alturaEm(x, z)
  const r = Math.hypot(x, z) || 1
  const ux = x / r, uz = z / r
  for (const d of [FRANJA * 0.5, FRANJA, FRANJA + 40, FRANJA + 90]) {
    baixo = Math.min(baixo, alturaEm(x + ux * d, z + uz * d), alturaEm(x - ux * d, z - uz * d),
      alturaEm(x - uz * d, z + ux * d), alturaEm(x + uz * d, z - ux * d))
  }
  return baixo - RESERVA_MURO
}

/**
 * O campus desenhado: UMA laje sobre a parcela inteira, no cinza de platô da
 * cidade, com a faixa de calçada na borda e o muro descendo até o terreno.
 *
 * ⚠️ O MURO PROCURA O CHÃO MAIS BAIXO NUMA FAIXA EM VOLTA, não só embaixo da
 * aresta. Entre a aresta da laje e a divisa da parcela existe a rampa da franja,
 * e depois dela o terreno natural, que na ponta do 90° está a −35,6 m. Um muro
 * que parasse na cota da própria aresta deixaria a rampa à mostra por baixo.
 */
export function criarCampus(alturaEm: (x: number, z: number) => number): THREE.Group {
  const pos: number[] = [], nor: number[] = [], cor: number[] = []
  const kPlato = new THREE.Color(COR_PLATO)
  const kCalcada = new THREE.Color(COR_CALCADA)
  const kMeiofio = new THREE.Color(COR_MEIOFIO)

  const nyMiolo = tampa(pos, nor, cor, _lajeMiolo, PODIO_TOPO, kPlato)
  const nyFaixa = faixa(pos, nor, cor, _laje, _lajeMiolo, PODIO_TOPO, kCalcada)

  muro(pos, nor, cor, _laje, PODIO_TOPO, (x, z) => peDoMuro(alturaEm, x, z), kMeiofio)

  // ⚠️ PORTÃO DE TAMPA VIRADA. Custa uma comparação no boot e teria pego sozinho
  // o defeito que a chapa de produção pegou. Se a tampa alguma vez sair com a
  // normal para baixo, o console diz, em vez de a peça simplesmente sumir.
  if (nyMiolo < 0.9 || nyFaixa < 0.9) {
    console.error(`[campus] TAMPA VIRADA: normal.y miolo ${nyMiolo.toFixed(2)}, faixa ${nyFaixa.toFixed(2)}`)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
  g.computeBoundingSphere()
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })
  const mesh = new THREE.Mesh(g, mat)
  mesh.name = 'CAMPUS_PODIO'
  mesh.receiveShadow = true
  // ⚠️ A LAJE NÃO PROJETA SOMBRA, E ISSO NÃO É ECONOMIA: É CONSERTO. Com
  // `castShadow = true` a chapa de produção saiu com o CHÃO DA CIDADE INTEIRA
  // preto, em pleno `hour=day`. A causa é o tamanho do projetor: a sombra em
  // cascata ajusta o frustum ao que projeta, e uma peça de 1,8 km por 476 m,
  // com muro descendo 29 m, obriga o mapa a cobrir uma caixa que a resolução
  // dele não alcança. O resultado é acne de sombra em toda a cena, que lê como
  // escuridão. Com os três pódios pequenos da versão anterior isso não
  // acontecia, e é essa a única diferença relevante entre as duas chapas.
  //
  // ⚠️ E NÃO SE PERDE NADA: a laje é CHÃO. O que ela projetaria seria sombra no
  // terreno logo abaixo dela, que ninguém vê. Quem projeta sombra sobre ela são
  // as três peças, e essas continuam com `castShadow` ligado.
  mesh.castShadow = false
  const grupo = new THREE.Group()
  grupo.name = 'CAMPUS'
  grupo.add(mesh)
  return grupo
}

/** a altura do muro em volta da laje, amostrada, para medir sem desenhar */
export function muroDoCampus(alturaEm: (x: number, z: number) => number) {
  return _laje.map((p, i) => {
    const q = _laje[(i + 1) % _laje.length]
    let baixa = Infinity, alta = -Infinity
    for (let s = 0; s <= 20; s++) {
      const t = s / 20
      const h = PODIO_TOPO - peDoMuro(alturaEm, p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
      baixa = Math.min(baixa, h); alta = Math.max(alta, h)
    }
    return { aresta: i, comprimento: Math.hypot(q[0] - p[0], q[1] - p[1]), minima: baixa, maxima: alta }
  })
}
