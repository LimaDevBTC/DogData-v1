// ═══════════════════════════════════════════════════════════════════════════
// AS SUPERFÍCIES DA CIDADE. Albedo, normal e rugosidade pra cada chão que a
// DogCity tem, gerados em canvas no boot da cena.
//
// ⚠️ POR QUE ISTO EXISTE. Medido em 01/09, antes desta peça: nenhum chão da
// cidade tinha textura. Terreno, rua, calçada, praça e lote eram todos
// `MeshStandardMaterial` com cor por vértice e mais nada. É o defeito de
// primeira ordem da cena: sem mapa de normal não existe micro-relevo, sem mapa
// de rugosidade a luz responde igual no asfalto e na grama, e o olho lê "polígono
// pintado" a qualquer distância. Nenhuma quantidade de geometria conserta isso,
// porque o problema não é a forma, é o que a forma faz com a luz.
//
// ⚠️ PROCEDURAL, NÃO ARQUIVO. Não há PNG nenhum aqui e é de propósito. Seis
// superfícies em 512² com três mapas cada seriam uns 12 MB de imagem no bundle,
// que numa cena que já carrega GLB, terreno e a abóbada é o pior lugar do mundo
// pra gastar rede. Gerar em canvas custa uma vez uns poucos ms por superfície,
// não passa pela rede, e permite variar a receita sem reexportar nada.
//
//   Onde o Blender ENTRA é no MOBILIÁRIO, não aqui: poste, banco, guia,
//   guarda-corpo, lixeira e placa são geometria modelada e é isso que tira a
//   cara de primitiva da cena. Textura que ladrilha ao infinito é trabalho de
//   ruído, não de modelagem.
//
// ⚠️ LADRILHO É O INIMIGO. Uma textura de 8 m repetida por 4 km desenha um
// xadrez visível de longe, e o xadrez lê PIOR que a cor chapada que ele veio
// substituir. É pra isso que serve `quebrarRepeticao`: um ruído de baixíssima
// frequência em coordenada de MUNDO, injetado no fragmento, que modula o albedo
// numa escala de dezenas de metros. O ladrilho continua lá; o olho perde a
// grade.
//
// ⚠️ UM PROGRAMA SÓ PRA TODO MUNDO. `onBeforeCompile` sem `customProgramCacheKey`
// compila um programa POR MATERIAL, e esta cena vive perto do teto de programas
// (medido: 402 compilados na vista alta). Todo material que passa por
// `quebrarRepeticao` declara a MESMA chave, então o three compila a variação uma
// vez e reaproveita.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export type Superficie =
  | 'regolito'   // o pó lunar fora do pódio
  | 'asfalto'    // pista
  | 'calcada'    // laje de concreto, com junta
  | 'campo'      // o verde do lote e da praça
  | 'concreto'   // concreto moldado, liso: plinto, mureta, pódio
  | 'pedra'      // guia, degrau, muro de arrimo

export interface Conjunto {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
  /** quantos metros de mundo cabem num lado do ladrilho */
  metros: number
  /** força sugerida do normal pra esta superfície */
  normalScale: number
}

// ── ruído ───────────────────────────────────────────────────────────────────
// Valor-ruído com látice que DÁ A VOLTA: sem o módulo no látice a textura não
// casa na emenda e cada ladrilho mostra uma linha vertical e uma horizontal.
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function vnoise(x: number, y: number, per: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per
  const y0 = ((yi % per) + per) % per, y1 = (y0 + 1) % per
  const a = hash2(x0, y0), b = hash2(x1, y0), c = hash2(x0, y1), d = hash2(x1, y1)
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
}

/** fbm que ladrilha: `per` é o látice da PRIMEIRA oitava e dobra junto com a
 *  frequência, então toda oitava fecha no mesmo período. */
function fbm(x: number, y: number, oct: number, per: number): number {
  let s = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, per * f)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return s / norm
}

// ── receitas ────────────────────────────────────────────────────────────────
// Cada receita responde, pra um ponto (u,v) em 0..1 do ladrilho:
//   h    altura em 0..1, de onde sai o mapa de normal
//   r,g,b cor linear em 0..255
//   rug  rugosidade em 0..1
type Amostra = { h: number; r: number; g: number; b: number; rug: number }

const S = 512 // lado do ladrilho em pixels

function amostraRegolito(u: number, v: number): Amostra {
  // ⚠️ ESTA RECEITA TINHA 56 CRATERAS CARIMBADAS E ELAS FORAM REMOVIDAS EM
  // 01/09, a pedido do fundador ("são as mesmas marcas por todo o terreno").
  // O comentário que estava aqui dizia que a cratera era o que fazia o chão ler
  // como Lua. Isso é verdade numa FOTO e é falso num LADRILHO, e a diferença é a
  // regra que vale pra toda textura que se repete:
  //
  //   UM LADRILHO SÓ PODE CONTER O QUE O OLHO NÃO CONSEGUE IDENTIFICAR
  //   INDIVIDUALMENTE.
  //
  // Grão, poeira e variação de rugosidade não têm identidade: repetidos, viram
  // superfície. Uma cratera TEM identidade, e o olho que reconhece uma feição
  // passa a usá-la pra achar a grade. Com ladrilho de 90 m sobre um terreno de
  // quilômetros, as 56 crateras apareciam de novo a cada 90 m, em formação, e o
  // xadrez que elas desenhavam lia PIOR que a cor chapada que a textura veio
  // substituir.
  //
  // ⚠️ E O ALBEDO QUASE LISO NÃO É CONCESSÃO, É O CERTO. O regolito real é quase
  // uniforme em cor na escala de dezenas de metros: o que varia na foto da
  // Apollo é a LUZ, não a tinta. Cratera é acidente de LUGAR, tem posição
  // verdadeira, e por isso pertence à malha do terreno (que aqui é elevação
  // lunar real do Mare Tranquillitatis), nunca a uma imagem que se repete.
  //
  // Sobra, de propósito, só o que amacia a luz sem nunca ser visto como desenho:
  // grão fino de amplitude baixa no relevo, e uma variação de rugosidade menor
  // ainda. A quebra de escala grande continua vindo de `quebrarRepeticao`, que
  // trabalha em coordenada de MUNDO e por isso não repete nunca.
  const grao = fbm(u * 34, v * 34, 3, 34)
  const poeira = fbm(u * 96, v * 96, 2, 96)
  const h = grao * 0.45 + poeira * 0.55
  // faixa de tom estreita: 0,96 a 1,04, ou seja mais ou menos 4%. É variação de
  // pó assentado, não de mancha.
  const t = 0.96 + h * 0.08
  return { h, r: 118 * t, g: 112 * t, b: 104 * t, rug: 0.955 + poeira * 0.03 }
}

function amostraAsfalto(u: number, v: number): Amostra {
  const brita = fbm(u * 96, v * 96, 3, 96)      // o agregado
  const macro = fbm(u * 5, v * 5, 4, 5)          // manchas de idade
  // Sulco de roda: duas faixas ao longo de v, mais lisas e mais escuras. É a
  // marca que separa asfalto de rua de asfalto de estacionamento.
  const rodado = Math.exp(-((u - 0.3) ** 2) / 0.006) + Math.exp(-((u - 0.7) ** 2) / 0.006)
  const h = brita * 0.8 + macro * 0.2 - rodado * 0.12
  const base = 40 + brita * 30 - rodado * 6 + macro * 10
  return {
    h: Math.max(0, Math.min(1, h)),
    r: base, g: base * 1.0, b: base * 1.06,
    // molhado no sulco, seco e áspero fora dele: é o contraste que dá leitura
    rug: 0.92 - rodado * 0.26 - brita * 0.06,
  }
}

function amostraCalcada(u: number, v: number): Amostra {
  // Laje de 1/4 do ladrilho, junta funda de 2 px: a junta é o que dá escala
  // humana ao chão. Sem ela a calçada é uma chapa cinza de tamanho indefinido.
  const NL = 4
  const fu = (u * NL) % 1, fv = (v * NL) % 1
  const junta = Math.min(fu, 1 - fu, fv, 1 - fv)
  const naJunta = junta < 0.022
  const idLaje = Math.floor(u * NL) * 31 + Math.floor(v * NL) * 17
  const tomLaje = 0.94 + hash2(idLaje, 3) * 0.12       // laje a laje varia
  const mosqueado = fbm(u * 26, v * 26, 4, 26)
  const lasca = fbm(u * 60, v * 60, 2, 60)
  const h = naJunta ? 0.18 : 0.72 + mosqueado * 0.2 + lasca * 0.08
  const t = (naJunta ? 0.62 : tomLaje) * (0.9 + mosqueado * 0.2)
  return {
    h, r: 186 * t, g: 180 * t, b: 168 * t,
    rug: naJunta ? 0.98 : 0.86 + mosqueado * 0.1,
  }
}

function amostraCampo(u: number, v: number): Amostra {
  // Duas escalas de tufo mais um capim alto de alta frequência. O verde varia de
  // seco a viçoso; verde único chapado é a assinatura do amadorismo.
  const tufoG = fbm(u * 4, v * 4, 4, 4)
  const tufoP = fbm(u * 17, v * 17, 3, 17)
  const capim = fbm(u * 110, v * 130, 2, 110)
  const seco = Math.max(0, fbm(u * 3 + 9, v * 3 + 4, 3, 3) - 0.52) * 2.2
  const h = capim * 0.6 + tufoP * 0.28 + tufoG * 0.12
  const vico = 0.72 + tufoG * 0.3 + tufoP * 0.2 + capim * 0.16
  const r = (86 + seco * 62) * vico
  const g = (112 + seco * 22) * vico
  const b = (66 + seco * 10) * vico
  return { h, r, g, b, rug: 0.93 + capim * 0.06 }
}

function amostraConcreto(u: number, v: number): Amostra {
  const poro = fbm(u * 70, v * 70, 3, 70)
  const mancha = fbm(u * 6, v * 6, 4, 6)
  // linha de fôrma a cada meio ladrilho: concreto moldado tem junta de painel
  const forma = Math.abs(((v * 2) % 1) - 0.5) > 0.487 ? 1 : 0
  const h = 0.7 + poro * 0.24 - forma * 0.3
  const t = (0.9 + mancha * 0.2) * (1 - forma * 0.12)
  return { h, r: 172 * t, g: 169 * t, b: 162 * t, rug: 0.8 + poro * 0.14 + mancha * 0.05 }
}

function amostraPedra(u: number, v: number): Amostra {
  const veio = fbm(u * 9, v * 9, 5, 9)
  const grao = fbm(u * 80, v * 80, 3, 80)
  const h = veio * 0.6 + grao * 0.4
  const t = 0.76 + veio * 0.36 + grao * 0.1
  return { h, r: 138 * t, g: 133 * t, b: 124 * t, rug: 0.88 + grao * 0.1 }
}

const RECEITAS: Record<Superficie, { fn: (u: number, v: number) => Amostra; metros: number; normalScale: number }> = {
  // ⚠️ `normalScale` BAIXO DE PROPÓSITO. O grão aqui existe pra amaciar a luz,
  // não pra ser visto: normal forte num chão sem feição vira aquele granulado de
  // plástico que denuncia textura procedural.
  regolito: { fn: amostraRegolito, metros: 40, normalScale: 0.5 },
  asfalto:  { fn: amostraAsfalto,  metros: 9,  normalScale: 0.7 },
  calcada:  { fn: amostraCalcada,  metros: 6,  normalScale: 0.85 },
  campo:    { fn: amostraCampo,    metros: 7,  normalScale: 0.75 },
  concreto: { fn: amostraConcreto, metros: 10, normalScale: 0.5 },
  pedra:    { fn: amostraPedra,    metros: 4,  normalScale: 0.9 },
}

// ── geração ─────────────────────────────────────────────────────────────────
function canvasDe(dados: Uint8ClampedArray): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.putImageData(new ImageData(dados, S, S), 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = anisotropia
  return tex
}

function gerar(nome: Superficie): Conjunto {
  const { fn, metros, normalScale } = RECEITAS[nome]
  const alt = new Float32Array(S * S)
  const alb = new Uint8ClampedArray(S * S * 4)
  const rug = new Uint8ClampedArray(S * S * 4)

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      const a = fn(x / S, y / S)
      alt[i] = a.h
      alb[i * 4] = a.r; alb[i * 4 + 1] = a.g; alb[i * 4 + 2] = a.b; alb[i * 4 + 3] = 255
      const q = Math.max(0, Math.min(255, a.rug * 255))
      rug[i * 4] = q; rug[i * 4 + 1] = q; rug[i * 4 + 2] = q; rug[i * 4 + 3] = 255
    }
  }

  // normal por Sobel, com as bordas dando a volta pelo outro lado do ladrilho:
  // sem o wrap a emenda ganha um vinco de luz que aparece de longe.
  const nrm = new Uint8ClampedArray(S * S * 4)
  const at = (x: number, y: number) => alt[(((y % S) + S) % S) * S + (((x % S) + S) % S)]
  const FORCA = 3.2
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))
      let nx = -dx * FORCA, ny = -dy * FORCA, nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv; ny *= inv; nz *= inv
      const i = (y * S + x) * 4
      nrm[i] = (nx * 0.5 + 0.5) * 255
      nrm[i + 1] = (ny * 0.5 + 0.5) * 255
      nrm[i + 2] = (nz * 0.5 + 0.5) * 255
      nrm[i + 3] = 255
    }
  }

  const map = canvasDe(alb)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = canvasDe(nrm)
  normalMap.colorSpace = THREE.NoColorSpace
  const roughnessMap = canvasDe(rug)
  roughnessMap.colorSpace = THREE.NoColorSpace
  return { map, normalMap, roughnessMap, metros, normalScale }
}

let anisotropia = 8
const cache = new Map<Superficie, Conjunto>()

/** Chamada UMA vez pela cena, depois do renderer existir: sem isso o ladrilho
 *  em ângulo raso (que é como se olha chão) vira papa a dez metros. */
export function setAnisotropia(n: number) {
  anisotropia = Math.max(1, Math.min(16, n))
  cache.forEach((c) => {
    c.map.anisotropy = anisotropia; c.map.needsUpdate = true
    c.normalMap.anisotropy = anisotropia; c.normalMap.needsUpdate = true
    c.roughnessMap.anisotropy = anisotropia; c.roughnessMap.needsUpdate = true
  })
}

/** O conjunto de mapas de uma superfície. Gerado na primeira chamada e
 *  compartilhado: dois módulos que pedem 'asfalto' recebem A MESMA textura, que
 *  é o que mantém a conta de texturas do renderer em pé. */
export function superficie(nome: Superficie): Conjunto {
  let c = cache.get(nome)
  if (!c) { c = gerar(nome); cache.set(nome, c) }
  return c
}

export interface VestirOpts {
  /** metros de mundo por ladrilho; o padrão é o da receita */
  metros?: number
  /** multiplica a força do normal da receita */
  normal?: number
  /** quebra a repetição com ruído de mundo (padrão: sim) */
  macro?: boolean
  /** escala do ruído de mundo, em metros (padrão 140) */
  macroMetros?: number
}

/** Veste um material com a superfície pedida. O `repeat` sai de `metros`, então
 *  quem chama NÃO precisa saber o tamanho do ladrilho: passa o tamanho do chão
 *  em metros e a função resolve.
 *
 *  ⚠️ O UV TEM DE SER EM METROS DE MUNDO. Esta função assume que a malha
 *  entrega UV em 0..1 sobre o seu próprio tamanho, e por isso recebe `mundo`:
 *  o lado do chão, em metros. Malha que já traz UV em metros passa `mundo = 1`. */
export function vestir(
  mat: THREE.MeshStandardMaterial,
  nome: Superficie,
  mundo: number,
  o: VestirOpts = {},
) {
  const c = superficie(nome)
  const metros = o.metros ?? c.metros
  const rep = Math.max(1, mundo / metros)
  // ⚠️ CLONE DA TEXTURA, NÃO DO CANVAS. Duas malhas de tamanhos diferentes
  // precisam de `repeat` diferente, e `repeat` mora na Texture. O clone divide a
  // MESMA imagem na GPU (o three sobe uma vez por `source`), então isto custa um
  // objeto JS, não um upload.
  const map = c.map.clone(); map.repeat.set(rep, rep); map.needsUpdate = true
  const nm = c.normalMap.clone(); nm.repeat.set(rep, rep); nm.needsUpdate = true
  const rm = c.roughnessMap.clone(); rm.repeat.set(rep, rep); rm.needsUpdate = true

  mat.map = map
  mat.normalMap = nm
  mat.roughnessMap = rm
  const f = c.normalScale * (o.normal ?? 1)
  mat.normalScale = new THREE.Vector2(f, f)
  // ⚠️ `roughness` continua valendo: no three ele MULTIPLICA o mapa. Deixar o
  // padrão 1.0 é o que faz o mapa mandar de verdade.
  mat.roughness = 1
  mat.metalness = 0
  mat.needsUpdate = true

  if (o.macro !== false) quebrarRepeticao(mat, o.macroMetros ?? 140)
}

/** Modula o albedo por um ruído de baixíssima frequência em coordenada de mundo.
 *  É o que apaga a grade do ladrilho numa superfície de quilômetros.
 *
 *  ⚠️ TODOS COMPARTILHAM UM PROGRAMA. Ver a nota do cabeçalho: a chave de cache
 *  é fixa de propósito, senão cada material vira um shader novo. Como a escala
 *  entra por `uniform`, materiais com escalas diferentes ainda dividem o mesmo
 *  programa compilado. */
export function quebrarRepeticao(mat: THREE.MeshStandardMaterial, metros = 140) {
  const u = { value: 1 / Math.max(1, metros) }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMacro = u
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMacroXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMacroXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vMacroXZ;
uniform float uMacro;
float mrand(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mrand(i), mrand(i + vec2(1.0, 0.0)), u.x),
             mix(mrand(i + vec2(0.0, 1.0)), mrand(i + vec2(1.0, 1.0)), u.x), u.y);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 mp = vMacroXZ * uMacro;
  float m = mnoise(mp) * 0.62 + mnoise(mp * 3.1) * 0.26 + mnoise(mp * 9.3) * 0.12;
  diffuseColor.rgb *= mix(0.80, 1.16, m);
}`)
  }
  mat.customProgramCacheKey = () => 'dogcity:macro'
  mat.needsUpdate = true
}

export function disposeMateriais() {
  cache.forEach((c) => { c.map.dispose(); c.normalMap.dispose(); c.roughnessMap.dispose() })
  cache.clear()
}
