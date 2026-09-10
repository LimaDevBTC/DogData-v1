import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// COMPRIMIR ATRIBUTO DE GEOMETRIA, TROCANDO O TIPO E NÃO O DESENHO.
//
// ⚠️ POR QUE ISTO EXISTE, e o número é medido. O censo de geometria
// (`scripts/city/geometria.mjs`, 10/09) somou 491 MiB residentes na cidade e
// mostrou que 68% disso são DUAS peças: `terreno` (172 MiB) e `vias` (164 MiB).
// A quebra por atributo mostrou o resto: está tudo em Float32, inclusive o que
// nunca precisou de 32 bits.
//
//   terreno   index Uint32 56,6  ·  position 31,5  ·  color 31,5  ·  normal 31,5  ·  uv 21,0
//   vias      position 49,9  ·  normal 49,9  ·  uv 32,5  ·  index 24,7  ·  aVia 6,6
//
// Uma normal é um versor: cada componente vive em [-1, 1] e um Int16
// normalizado dá 32.767 passos nesse intervalo, ou 0,003° de erro angular. Uma
// cor de vértice vive em [0, 1] e nunca teve mais que a precisão do olho. Trocar
// o tipo desses dois devolve memória sem tocar em um vértice sequer.
//
// ⚠️ O QUE NÃO ENTRA AQUI, E POR QUÊ. A regra é o INTERVALO, não o gosto:
//
//   · `position` fica em Float32. A cidade tem 60 km de ponta a ponta e a
//     calçada tem 15 cm de meio-fio; 16 bits sobre esse alcance dariam 1,8 m de
//     passo, que é maior que a peça que se quer desenhar.
//   · `uv` do terreno e das vias fica em Float32 porque NÃO é [0, 1]: as duas
//     escrevem `mundo / escala` para ladrilhar, e no terreno isso chega a ±72.
//     Normalizar corta em 1 e a textura inteira colapsa. Quem quiser esses 53
//     MiB tem de derivar o uv da posição no shader, que é outra frente.
//   · `aVia` fica em Float32 porque empacota DUAS coisas num número: a parte
//     inteira é largura em meios metros e a fracionária é a posição através da
//     banda, com 0,999 de granularidade. Ver a nota de `comBanda` em `vias.ts`.
//     Não existe tipo curto que guarde as duas sem mexer no shader, e são 3 MiB.
//
// ⚠️ E A ORDEM IMPORTA: chame DEPOIS de `computeVertexNormals()`. Ele escreve um
// Float32 novo por cima e desfaz a compressão em silêncio.
// ═══════════════════════════════════════════════════════════════════════════

/** o passo de um versor guardado em Int16 normalizado, em graus */
export const ERRO_NORMAL_GRAUS = (Math.asin(1 / 32767) * 180) / Math.PI

/**
 * Normal de Float32 para Int16 normalizado: 12 bytes por vértice viram 6.
 *
 * ⚠️ `normalized: true` NÃO É DETALHE, é o contrato. Com ele o WebGL entrega ao
 * shader `valor / 32767`, ou seja o versor de volta; sem ele o shader recebe
 * 32.767 e a cena inteira fica preta. O mesmo vale para a cor.
 */
export function normalCurta(geo: THREE.BufferGeometry): boolean {
  const a = geo.getAttribute('normal') as THREE.BufferAttribute | undefined
  if (!a || !(a.array instanceof Float32Array) || a.itemSize !== 3) return false
  const src = a.array
  const out = new Int16Array(src.length)
  for (let i = 0; i < src.length; i++) {
    // o clamp é contra ruído de `computeVertexNormals` em triângulo degenerado:
    // um versor que sai 1,0000001 vira -32768 no arredondamento e o triângulo
    // acende ao contrário
    out[i] = Math.round(Math.max(-1, Math.min(1, src[i])) * 32767)
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3, true))
  return true
}

/**
 * Cor de vértice de Float32 para inteiro normalizado: 12 bytes viram 3 ou 6.
 *
 * ⚠️ `bits` É DECISÃO DE SUPERFÍCIE, NÃO DE ORÇAMENTO. Oito bits são o padrão de
 * COLOR_0 do glTF e bastam onde a cor é detalhe sobre iluminação. No TERRENO ela
 * não é detalhe: é uma rampa lisa de regolito atravessando quilômetros, e é
 * exatamente a superfície em que 256 degraus por canal viram faixa visível. Lá
 * vão 16 bits, que custam 3 bytes a mais por vértice e não têm banda nenhuma.
 */
export function corCurta(geo: THREE.BufferGeometry, bits: 8 | 16 = 8): boolean {
  const a = geo.getAttribute('color') as THREE.BufferAttribute | undefined
  if (!a || !(a.array instanceof Float32Array)) return false
  const src = a.array
  const max = bits === 8 ? 255 : 65535
  const out = bits === 8 ? new Uint8Array(src.length) : new Uint16Array(src.length)
  for (let i = 0; i < src.length; i++) {
    out[i] = Math.round(Math.max(0, Math.min(1, src[i])) * max)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, a.itemSize, true))
  return true
}

/** quantos bytes os atributos mais o índice ocupam; a régua do censo */
export function bytesDaGeometria(geo: THREE.BufferGeometry): number {
  let n = geo.index ? geo.index.array.byteLength : 0
  for (const k in geo.attributes) n += (geo.attributes[k] as THREE.BufferAttribute).array.byteLength
  return n
}
