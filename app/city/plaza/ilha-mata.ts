// ═══════════════════════════════════════════════════════════════════════════
// A MATA DAS ILHAS: vegetação de verdade nas ilhas reservadas do anel
// central, por pedido do fundador em 06/09.
//
// ⚠️ O DIAGNÓSTICO ERA FÁCIL E ELE ESTAVA CERTO. A "mata" de `lago.ts` (bloco
// "4. as ilhas") é uma FAIXA DE COR (`COR_MATO`) pintada num quad entre a praia
// e a trilha: zero árvore, zero arbusto, zero pedra. De cima isso lê como grama
// chapada, que foi exatamente a queixa dele. `aquario.ts` já planta palmeira,
// samambaia, feto e grama-alta nas mesmas ilhas, mas (a) está atrás de
// `?aquario=1`, ou seja OFF em produção, e (b) mesmo ligado é raro demais para
// virar dossel: 16 a 30 indivíduos por espécie por ilha, em anéis largos de
// dezenas de metros, lê como jardim pontilhado, não como mata.
//
// ⚠️ NENHUMA CONSTRUÇÃO. O fundador foi explícito: preservar as ilhas, só
// natureza. Este módulo planta árvore, arbusto, touceira e rocha; não desenha
// nada que pareça programa (sem plataforma, sem cerca, sem trilha nova: a
// trilha de saibro e o píer de `lago.ts` continuam intocados).
//
// ⚠️ SEIS ILHAS, NÃO OITO, DESDE 06/09: `lago.ts` reordenou o anel (a do Dog
// Social Club estava em cima da junção de um canal, e oito não cabiam sem
// encostar em nenhum). Este módulo não fixa o número em lugar nenhum: ele
// itera `o.ilhas`, então lê seis hoje e leria outro tanto se o anel mudar nesse
// número de novo. O que É fixo são os ARQUÉTIPOS por índice (1 a 5, a partir
// de `ARQUETIPOS` abaixo): se o anel crescer, faltam nomes, e o fallback
// (`ARQUETIPOS[5]`) cobre o buraco sem quebrar, só sem identidade própria.
//
// ⚠️ A COTA NÃO VEM DE `heightAt` + UM `lift` CONSTANTE, e essa era a segunda
// imprecisão de `aquario.ts` (`LIFT_ILHA`, um único deslocamento para toda a
// floresta, quando a ilha sobe de +0,15 na praia a +3,1 na clareira). Aqui
// cada planta recebe a cota EXATA do patamar em que nasceu, pela mesma régua
// de `yTerraco` do desembarque em `lago.ts` (`alturaPatamar` abaixo): sem isso
// uma palmeira da praia nasceria até 0,9 m acima da areia ou enterrada na
// clareira.
//
// ⚠️ COR POR INSTÂNCIA SEMPRE LIGADA, SEM BANDEIRA. `props.ts` só chama
// `setColorAt` atrás de `?copa=1` (ver o cabeçalho dele): em produção, sem a
// bandeira, toda cópia de uma espécie sai bit a bit igual à anterior, que é o
// "verde chapado" que o fundador nomeou, só que na COPA em vez do chão. Este
// módulo não usa `props.ts`: carrega os GLB e monta o `InstancedMesh` por
// conta própria, e por isso pode ligar `setColorAt` incondicionalmente.
//
// ⚠️ LOD DE DOSSEL: PERTO = MODELO REAL, LONGE = OCTAEDRO TINTADO. As ilhas
// estão a ~1.250 m do centro da praça, e a maioria das vistas é de lá: nesse
// caso a árvore de verdade nunca aparece, só o volume de longe. Por isso o
// esforço de variedade (altura, cor, silhueta) tem de sobreviver no octaedro,
// e é para lá que a cor por instância e a mistura de porte foram desenhadas.
// A malha de longe é `geoLonge` de `especies.ts`, reaproveitada e não
// reinventada (o mesmo motivo por que ela existe lá: um volume de 8 triângulos
// lê como copa de qualquer ângulo, uma cruz de quads não).
//
// ⚠️ AS SEIS NÃO SÃO IGUAIS. Cinco arquétipos nomeados (uma por ilha
// reservada, ver `ARQUETIPOS`) variam densidade, quais espécies emergem do
// dossel, quantas rochas e o quanto a borda da clareira é irregular. A sexta
// (Dog Social Club) tem tratamento próprio, mais rala, sem miolo fechado (a
// clareira dela é a praça do parceiro, não um lote guardado).
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadSf, dressSf, podarMapasSecundarios } from './sf-assets'
import { hash01, geoLonge } from './especies'
import { contornoIlha, anguloDesembarque, type Ilha } from './lago'
import type { Tier, Quality, DistanceCuller } from './perf'

export interface IlhaMataOpts {
  ilhas: Ilha[]
  lago: { agua: number; fundo: number }
  gltf: GLTFLoader
  tier: Tier
  quality: Quality
  cortaTextura: boolean
  sombra?: boolean
  culler?: DistanceCuller
}

export interface IlhaMata {
  group: THREE.Group
  /** total de indivíduos plantados (árvore, arbusto, touceira, rocha) */
  individuos: number
  /** quantos hoje estão no balde de PERTO (modelo real), soma das espécies */
  perto: number
  /** triângulos no pior caso: todo o dossel no balde de perto ao mesmo tempo */
  trianguloPiorCaso: number
  chamadas: number
  /** por ilha, para o relatório: id, arquétipo e indivíduos */
  porIlha: { id: string; arquetipo: string; individuos: number }[]
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ── a cota do patamar, a MESMA régua de `yTerraco` no desembarque de lago.ts ─
//
// ⚠️ REPRODUZIDA, NÃO IMPORTADA: `lago.ts` calcula isso dentro do laço da
// ilha, fechado sobre `L.agua` e `dsc` daquela iteração, sem exportar uma
// função. Duplicar cinco linhas de aritmética é mais barato e mais claro do
// que abrir o fecho de `buildLago` para exportar um closure. Os CINCO cortes
// (fCl, 0,655, 0,70, 0,88, 1,00) e os QUATRO coeficientes são cópia literal.
function alturaPatamar(agua: number, dsc: boolean, f: number): number {
  const fCl = dsc ? 0.42 : 0.34
  const ff = Math.min(1, Math.max(0, f))
  if (ff <= fCl) return agua + 3.1
  if (ff <= 0.655) return agua + 3.0 - (0.3 * (ff - fCl)) / (0.655 - fCl)
  if (ff <= 0.70) return agua + 2.6
  if (ff <= 0.88) return agua + 2.4 - (0.9 * (ff - 0.70)) / 0.18
  return agua + 1.5 - (1.35 * (ff - 0.88)) / 0.12
}

// ── a fronteira da clareira, DEFORMADA por ilha, para ela não ler como
// círculo (item 1 e 3 do pedido: "mancha de clareira natural, não círculo";
// "a borda é o que mais conta de cima") ─────────────────────────────────────
//
// ⚠️ DUAS FREQUÊNCIAS PRÓPRIAS (5 e 8), DIFERENTES DAS DA COSTA (3 e 5 em
// `contornoIlha`). Se a borda da mata batesse palma com a onda da costa, a
// ilha inteira "respiraria" junto e a clareira pareceria só uma cópia menor
// do litoral. Aqui a fronteira é a MATA que decide, não a geografia.
function limiteMiolo(k: number, dsc: boolean, amp: number, a: number): number {
  const fCl = dsc ? 0.42 : 0.34
  if (dsc || amp <= 0) return fCl + 0.02
  const n = 0.6 * Math.sin(a * 5 + k * 3.1) + 0.4 * Math.sin(a * 8 - k * 1.4 + 0.7)
  return Math.max(0.02, fCl + 0.02 + amp * 0.10 * n)
}

// ── medidas reais dos GLB (public/city/sf/*.glb), lidas do chunk JSON de
// cada arquivo em 06/09 (script em scratchpad, não faz parte do build): altura
// e largura (maior lado do plano XZ) da caixa. Usadas só para escalar o
// octaedro de longe na proporção certa, do mesmo jeito que `especies.ts` faz
// com `ESPECIES[x].longe` para as quatro espécies procedurais. ─────────────
const MEDIDA: Record<string, { h: number; w: number }> = {
  'palm': { h: 13.0, w: 8.0 },
  'palm-tall': { h: 16.1, w: 15.0 },
  'palm-date': { h: 14.0, w: 10.4 },
  'tree-palm': { h: 13.0, w: 13.0 },
  'tree-medit': { h: 11.0, w: 11.5 },
  'tree-gnarled': { h: 12.1, w: 7.0 },
  'banana-tree': { h: 3.5, w: 2.6 },
  'bamboo-clump': { h: 6.0, w: 5.0 },
  'cycas': { h: 1.8, w: 2.6 },
  'feto': { h: 0.7, w: 4.1 },
  'samambaia': { h: 1.0, w: 5.5 },
  'grama-alta': { h: 0.45, w: 1.3 },
  'rocks-stylized-pack': { h: 1.7, w: 5.6 },
  'oleander': { h: 1.93, w: 8.18 },
}
/** triângulos por arquivo (mesma medição), só para o relatório de orçamento.
 *  ⚠️ `oleander` ENTROU EM 06/09, SEM DOWNLOAD NOVO: já estava no acervo
 *  (`public/city/sf/oleander.glb`, já espelhado em KTX2, crédito já em
 *  `sf-assets.ts` desde o Jardim Italiano) e nunca tinha sido plantado. O
 *  fundador autorizou buscar espécie nova no Sketchfab SE FALTASSE; antes
 *  disso, o levantamento do acervo (`public/city/sf-ktx2/`, 89 de 92 arquivos
 *  espelhados, os três que faltam são do estádio e não têm nada a ver com
 *  planta) mostrou que "arbusto de borda florido" já existia, só não estava
 *  em uso: é o mesmo cacho de 3 pés que veste a limonaia do Jardim Italiano
 *  (ver a nota em `sf-assets.ts`: "caixa larga de 8x8 m... recorte de
 *  canteiro com várias plantas"). Reusar saiu de graça; buscar de novo teria
 *  custado download, conversão e espelho por algo que já estava no disco. */
const TRI_GLB: Record<string, number> = {
  'palm': 2264, 'palm-tall': 6000, 'palm-date': 2600, 'tree-palm': 4500,
  'tree-medit': 10000, 'tree-gnarled': 21859, 'banana-tree': 2500,
  'bamboo-clump': 3441, 'cycas': 602, 'feto': 399, 'samambaia': 500,
  'grama-alta': 400, 'rocks-stylized-pack': 3076, 'oleander': 10000,
}
/** quantas primitivas (= chamadas de desenho) cada GLB quebra em, medido no
 *  mesmo levantamento: o exportador glTF faz uma por material. */
const PARTES_GLB: Record<string, number> = {
  'palm': 3, 'palm-tall': 3, 'palm-date': 4, 'tree-palm': 5,
  'tree-medit': 3, 'tree-gnarled': 1, 'banana-tree': 5,
  'bamboo-clump': 5, 'cycas': 2, 'feto': 1, 'samambaia': 1,
  'grama-alta': 2, 'rocks-stylized-pack': 1, 'oleander': 3,
}

/** o papel de cada arquivo na composição: dita se ele entra no LOD de longe
 *  (dossel: árvore emergente e palmeira) ou só liga/desliga por distância
 *  (médio e chão, que de 1.250 m não valem um pixel de qualquer forma) */
type Papel = 'emergente' | 'dossel' | 'medio' | 'chao' | 'rocha'
const PAPEL: Record<string, Papel> = {
  'tree-medit': 'emergente', 'tree-gnarled': 'emergente',
  'palm': 'dossel', 'palm-tall': 'dossel', 'palm-date': 'dossel', 'tree-palm': 'dossel',
  'banana-tree': 'medio', 'bamboo-clump': 'medio', 'cycas': 'medio', 'oleander': 'medio',
  'feto': 'chao', 'samambaia': 'chao', 'grama-alta': 'chao',
  'rocks-stylized-pack': 'rocha',
}

// ═══════════════════════════════════════════════════════════════════════════
// OS ARQUÉTIPOS: as cinco ilhas reservadas não podem ser cinco cópias do
// mesmo hash com raio diferente (item 6 do pedido). Cada uma tem uma
// composição nomeada, com densidade, espécie emergente, rocha e
// irregularidade de clareira PRÓPRIAS. `mult` multiplica a base de TODAS as
// camadas; os campos específicos ajustam só o que dá identidade.
//
// ⚠️ ERAM SETE, VIRARAM CINCO EM 06/09 (lago.ts, "seis ilhas, não oito"). As
// duas que saíram ("canopy alto" e "equilibrada") não foram descartadas: o
// traço de "canopy alto" (mais emergente) foi para dentro de "floresta
// fechada", que agora é a maior das reservadas (raio 90, a que mais se
// aproxima da do Dog Social Club) e ganhou uma segunda `tree-medit` por
// causa disso. "Equilibrada" era a composição mais genérica das sete e foi a
// que saiu sem deixar traço, de propósito: com só cinco ilhas sobrando,
// nenhuma pode ser "a do meio termo" sem herança de outra.
// ═══════════════════════════════════════════════════════════════════════════
interface Arquetipo {
  nome: string
  mult: number
  emergentes: { file: 'tree-medit' | 'tree-gnarled'; n: number }[]
  rochas: number
  bambu: number
  clareiraAmp: number
  /** quantas palmeiras da praia nascem INCLINADAS sobre a água, o coqueiro de
   *  cartão-postal (item 3: "chega até a areia em alguns pontos"). Cada uma
   *  soma 1 ao total de `palm`, plantada à parte da faixa reta de BASE_PRAIA. */
  praiaLean: number
  /** o cacho de oleandro (flor rosa) como acento de borda; ver a nota em
   *  `TRI_GLB.oleander` sobre por que ele é reuso e não download novo */
  oleandro: number
}
/** chave = índice da ilha no array `ilhas` (0 é o Dog Social Club, tratado à
 *  parte); 1 a 5 são as cinco reservadas, NA ORDEM DO RAIO delas em `lago.ts`
 *  (`RAIO_RESERVADA = [58, 66, 74, 82, 90]`): a maior (5) é a que ganha o
 *  tratamento mais denso, a menor (1) o mais raro. */
const ARQUETIPOS: Record<number, Arquetipo> = {
  1: { nome: 'atol raro', mult: 0.55, emergentes: [], rochas: 10, bambu: 0, clareiraAmp: 0.15, praiaLean: 5, oleandro: 1 },
  2: { nome: 'clareira grande', mult: 0.70, emergentes: [{ file: 'tree-medit', n: 1 }], rochas: 5, bambu: 0, clareiraAmp: 0.85, praiaLean: 2, oleandro: 2 },
  3: { nome: 'bosque de bambu', mult: 1.05, emergentes: [], rochas: 3, bambu: 16, clareiraAmp: 0.35, praiaLean: 1, oleandro: 0 },
  4: { nome: 'morro rochoso', mult: 0.95, emergentes: [{ file: 'tree-medit', n: 1 }], rochas: 13, bambu: 3, clareiraAmp: 0.30, praiaLean: 2, oleandro: 2 },
  5: { nome: 'floresta fechada', mult: 1.35, emergentes: [{ file: 'tree-medit', n: 2 }, { file: 'tree-gnarled', n: 1 }], rochas: 4, bambu: 8, clareiraAmp: 0.55, praiaLean: 1, oleandro: 3 },
}
const ARQUETIPO_DSC: Arquetipo = { nome: 'jardim do clube (tratado)', mult: 0.60, emergentes: [], rochas: 2, bambu: 0, clareiraAmp: 0, praiaLean: 1, oleandro: 2 }

/** base de indivíduos por camada, mult = 1, ilha "padrão" (não DSC): cada
 *  entrada é [arquivo, quantos]. MIOLO é o mais denso de propósito ("mata
 *  fechada no miolo, rareando para a praia", item 1); PRAIA_BORDA é o mais
 *  ralo, quase só capim, com uma palmeira solta de vez em quando chegando até
 *  a areia (item 3). */
const BASE_MIOLO: [string, number][] = [
  ['palm-tall', 5], ['tree-palm', 4], ['palm', 4],
  ['banana-tree', 6], ['cycas', 8],
  ['feto', 30], ['samambaia', 24], ['grama-alta', 12],
]
const BASE_EXT: [string, number][] = [
  ['palm', 6], ['palm-date', 5], ['tree-palm', 3],
  ['banana-tree', 4], ['cycas', 4],
  ['feto', 20], ['samambaia', 16], ['grama-alta', 12],
]
const BASE_PRAIA: [string, number][] = [
  ['palm', 2],
  ['grama-alta', 14], ['feto', 5],
]

/** o mesmo hash posicional de `props.ts` (`hash`), para a cor e o jitter de
 *  cada instância ficarem amarrados ao LUGAR e não à ordem de inserção */
function hashPos(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** hash do NOME do arquivo (soma de char codes), não do comprimento: duas
 *  espécies de nome com o mesmo tamanho ('feto' e 'palm', 4 letras cada)
 *  geravam a MESMA semente de bosque na mesma ilha com `file.length`, ou
 *  seja nasciam nos mesmos centros de clareira por coincidência de nome. */
function hashNome(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0
  return h % 8191
}

/** a cor de uma instância: um multiplicador de luz centrado em 1 (nunca só
 *  escurece, ver a nota de `corInstancia` em `props.ts`) mais um giro de
 *  matiz verde-para-dourado, que é a variação que se vê de verdade numa copa
 *  tropical real (folha nova contra madura, sol contra sombra). Amplitude
 *  MAIOR que a `VARIACAO_PADRAO` de `props.ts` (0,06 de luz, 0,10 de mistura)
 *  de propósito: aqui a cor por instância é a ÚNICA pista de volume que
 *  sobrevive no octaedro de longe, então ela tem de se ver de 1.250 m. */
function corTropical(x: number, z: number, alvo: THREE.Color): THREE.Color {
  const hLuz = hashPos(x, z)
  const hMatiz = hashPos(x + 1013.1, z - 1013.1)
  const luz = 1 + (hLuz - 0.5) * 2 * 0.22
  const matiz = 0.28 + hMatiz * 0.10 // verde (0,28) a amarelo-esverdeado (0,38), setHSL
  const puro = new THREE.Color().setHSL(matiz, 0.55, 0.42)
  return alvo.copy(puro).multiplyScalar(luz)
}

interface Ponto {
  x: number; y: number; z: number; a: number
  /** ⚠️ SÓ O COQUEIRO DE PRAIA (`palmeirasInclinadas` abaixo) preenche isto.
   *  Eixo de inclinação HORIZONTAL, perpendicular ao radial da ilha (para o
   *  tronco tombar rumo à água, não rumo a um lado qualquer); `undefined` cai
   *  no giro aleatório puro que todo o resto da mata usa. */
  inclinacao?: { eixoX: number; eixoZ: number; angulo: number }
}

/** um bosque de `n` indivíduos entre `fMinFn(a)` e `fMax`, em clareiras de
 *  2 a 6 (a mesma lição dos afloramentos do Parque Runestone e da floresta
 *  velha de `aquario.ts`: densidade constante lê como cerca-viva, bosque com
 *  claro lê como mata). Evita o ângulo do píer com a mesma folga de 10 m que
 *  `aquario.ts` usa. */
function bosque(
  ilha: Ilha, k: number, dsc: boolean, semente: number, n: number,
  fMinFn: (a: number) => number, fMax: number, agua: number,
): Ponto[] {
  if (n <= 0) return []
  const out: Ponto[] = []
  const aPier = anguloDesembarque(k)
  const meiaPier = 10 / ilha.r
  let feito = 0, tentativa = 0
  while (feito < n && tentativa < n * 5 + 20) {
    tentativa++
    const ga = hash01(semente + tentativa * 7) * Math.PI * 2
    const quantos = Math.min(n - feito, 2 + Math.floor(hash01(semente + tentativa * 11) * 5))
    for (let j = 0; j < quantos && feito < n; j++) {
      const a = ga + (hash01(semente + tentativa * 31 + j * 3) - 0.5) * (24 / ilha.r)
      const dd = Math.abs(((a - aPier + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      if (dd < meiaPier) continue
      const fMin = fMinFn(a)
      if (fMin >= fMax) continue
      const f = fMin + hash01(semente + tentativa * 53 + j * 7) * (fMax - fMin)
      const r = contornoIlha(k, a, ilha.r * f)
      const x = ilha.x + Math.cos(a) * r, z = ilha.z + Math.sin(a) * r
      out.push({ x, z, a, y: alturaPatamar(agua, dsc, f) })
      feito++
    }
  }
  return out
}

/** o bambu não é bosque, é TELA: um anel raso rente à trilha por dentro,
 *  como a tela do Jardim Japonês (`JB_BAMBOO` em `props-table.ts`). Ele é o
 *  que dá o "fechado" da floresta fechada e o miolo do bosque de bambu. */
function telaBambu(ilha: Ilha, k: number, dsc: boolean, n: number, agua: number): Ponto[] {
  if (n <= 0) return []
  const fCl = dsc ? 0.42 : 0.34
  const f = (0.655 + fCl + 0.02) / 2 + 0.03 // logo por dentro da trilha
  const out: Ponto[] = []
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 + hash01(k * 41 + j) * 0.2
    const r = contornoIlha(k, a, ilha.r * f)
    out.push({ x: ilha.x + Math.cos(a) * r, z: ilha.z + Math.sin(a) * r, a, y: alturaPatamar(agua, dsc, f) })
  }
  return out
}

/** as rochas da praia: mais largas de escala, um pouco além da faixa de
 *  vegetação (f até 0,92), para os matacões aparecerem na areia como pedra de
 *  verdade e não só na mata */
function rochasPraia(ilha: Ilha, k: number, dsc: boolean, n: number, agua: number): Ponto[] {
  if (n <= 0) return []
  const out: Ponto[] = []
  const aPier = anguloDesembarque(k)
  const meiaPier = 10 / ilha.r
  let feito = 0, tentativa = 0
  while (feito < n && tentativa < n * 6 + 10) {
    tentativa++
    const a = hash01(k * 971 + tentativa * 13) * Math.PI * 2
    const dd = Math.abs(((a - aPier + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    if (dd < meiaPier) continue
    const f = 0.78 + hash01(k * 971 + tentativa * 13 + 5) * 0.14
    const r = contornoIlha(k, a, ilha.r * f)
    out.push({ x: ilha.x + Math.cos(a) * r, z: ilha.z + Math.sin(a) * r, a, y: alturaPatamar(agua, dsc, f) })
    feito++
  }
  return out
}

/**
 * O COQUEIRO DE CARTÃO-POSTAL, debruçado sobre a água. Item 3 do pedido diz
 * "vegetação que chega até a areia em alguns pontos"; uma palmeira ereta na
 * beira já chega até a areia, mas é a INCLINAÇÃO que faz o olho ler "praia
 * tropical" em vez de "árvore que nasceu perto d'água por acaso".
 *
 * ⚠️ ISTO NÃO É UM ASSET NOVO, É UMA INCLINAÇÃO NA MATRIZ. O fundador liberou
 * buscar espécie no Sketchfab se faltasse, mas a `palm.glb` que já está no
 * acervo (espelhada, creditada, em uso em meia dúzia de lugares da cidade)
 * dá o coqueiro certo só com o tronco tombado: o mesmo truque de `tombo` que
 * `especies.ts`/`arborizacao.ts` usa para a árvore de calçada "crescer torta",
 * só que aqui o tombo é GRANDE (13 a 22°) e DIRECIONADO para a água, não um
 * jitter pequeno e aleatório de árvore de rua.
 *
 * ⚠️ O EIXO DO TOMBO É PERPENDICULAR AO RAIO, não X e Z independentes como em
 * `arborizacao.ts`. Dois ângulos de Euler decompostos em X e Z aproximam mal
 * uma inclinação de mais de 10° numa direção específica (a composição XYZ do
 * Euler não é uma rotação simples em torno de um eixo arbitrário); aqui o
 * eixo horizontal (−sin a, 0, cos a), perpendicular ao raio no ponto `a`, e
 * um único ângulo dão a inclinação EXATA, sem a aproximação de ângulo
 * pequeno. `buildIlhaMata` monta o quaternion com `setFromAxisAngle` direto.
 */
function palmeirasInclinadas(ilha: Ilha, k: number, dsc: boolean, n: number, agua: number): Ponto[] {
  if (n <= 0) return []
  const out: Ponto[] = []
  const aPier = anguloDesembarque(k)
  const meiaPier = 10 / ilha.r
  let feito = 0, tentativa = 0
  while (feito < n && tentativa < n * 6 + 10) {
    tentativa++
    const a = hash01(k * 733 + tentativa * 17) * Math.PI * 2
    const dd = Math.abs(((a - aPier + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    if (dd < meiaPier) continue
    // bem na beira, f 0,855 a 0,885: ainda mata, tronco já debruçando na praia
    const f = 0.855 + hash01(k * 733 + tentativa * 17 + 9) * 0.03
    const r = contornoIlha(k, a, ilha.r * f)
    const angulo = (13 + hash01(k * 733 + tentativa * 17 + 3) * 9) * (Math.PI / 180) // 13 a 22 graus
    out.push({
      x: ilha.x + Math.cos(a) * r, z: ilha.z + Math.sin(a) * r, a,
      y: alturaPatamar(agua, dsc, f),
      inclinacao: { eixoX: -Math.sin(a), eixoZ: Math.cos(a), angulo },
    })
    feito++
  }
  return out
}

interface Parte { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }

export async function buildIlhaMata(o: IlhaMataOpts): Promise<IlhaMata> {
  const group = new THREE.Group()
  group.name = 'ilha-mata'
  const agua = o.lago.agua

  // ⚠️ ORÇAMENTO POR TIER, LIDO DE `PerfProfile` COMO `inverno.ts` FAZ: o
  // celular planta 55% do desktop e LOW mais 55% em cima disso (≈30% do
  // desktop no total); o chão (feto/samambaia/capim, que de 1.250 m não vale
  // um pixel) corta mais um tanto no celular, porque é ali que mora a maior
  // CONTAGEM de indivíduos por triângulo mais barato de todos.
  const tierMul = o.tier === 'mobile' ? 0.55 : 1.0
  const qualMul = o.quality === 'low' ? 0.55 : o.quality === 'high' ? 1.15 : 1.0
  const chaoMul = o.tier === 'mobile' ? 0.7 : 1.0
  const mulPara = (papel: Papel) => tierMul * qualMul * (papel === 'chao' ? chaoMul : 1)

  // ── 1. gera os pontos de TODAS as ilhas, agrupados por arquivo ───────────
  const porArquivo = new Map<string, Ponto[]>()
  const add = (file: string, pts: Ponto[]) => {
    if (!pts.length) return
    const l = porArquivo.get(file) ?? []
    l.push(...pts)
    porArquivo.set(file, l)
  }
  const porIlha: { id: string; arquetipo: string; individuos: number }[] = []

  o.ilhas.forEach((ilha, k) => {
    const dsc = k === 0
    const arq = dsc ? ARQUETIPO_DSC : (ARQUETIPOS[k] ?? ARQUETIPOS[5])
    const fCl = dsc ? 0.42 : 0.34
    let antes = 0
    for (const l of porArquivo.values()) antes += l.length

    const fMinMiolo = (a: number) => limiteMiolo(k, dsc, arq.clareiraAmp, a)
    const semKMiolo = 10_000 + k * 977
    const semKExt = 20_000 + k * 977
    const semKPraia = 30_000 + k * 977

    if (!dsc) {
      for (const [file, base] of BASE_MIOLO) {
        const n = Math.round(base * arq.mult * mulPara(PAPEL[file]))
        add(file, bosque(ilha, k, dsc, semKMiolo + hashNome(file), n, fMinMiolo, 0.635, agua))
      }
    }
    for (const [file, base] of BASE_EXT) {
      const n = Math.round(base * arq.mult * mulPara(PAPEL[file]))
      add(file, bosque(ilha, k, dsc, semKExt + hashNome(file), n, () => 0.705, 0.85, agua))
    }
    for (const [file, base] of BASE_PRAIA) {
      const n = Math.round(base * arq.mult * mulPara(PAPEL[file]))
      add(file, bosque(ilha, k, dsc, semKPraia + hashNome(file), n, () => 0.85, 0.895, agua))
    }
    for (const em of arq.emergentes) {
      const n = Math.round(em.n * mulPara('emergente'))
      // a emergente nasce BEM no miolo (f até 0,55), longe da borda e do píer:
      // ela é o pico do dossel, não faz sentido rente à clareira
      add(em.file, bosque(ilha, k, dsc, 40_000 + k * 131 + hashNome(em.file), n, () => fCl + 0.03, 0.55, agua))
    }
    {
      const n = Math.round(arq.bambu * mulPara('medio'))
      add('bamboo-clump', telaBambu(ilha, k, dsc, n, agua))
    }
    {
      const n = Math.round(arq.rochas * mulPara('rocha'))
      const naPraia = Math.round(n * 0.55)
      add('rocks-stylized-pack', rochasPraia(ilha, k, dsc, naPraia, agua))
      add('rocks-stylized-pack', bosque(ilha, k, dsc, 50_000 + k * 151, n - naPraia, fMinMiolo, 0.80, agua))
    }
    // o coqueiro de cartão-postal (item 3), à parte da faixa reta de
    // BASE_PRAIA: soma ao `palm` já plantado, não substitui
    add('palm', palmeirasInclinadas(ilha, k, dsc, Math.round(arq.praiaLean * mulPara('dossel')), agua))
    // o acento de oleandro na borda, reuso do cacho que já veste a limonaia
    // do Jardim Italiano (ver a nota em `TRI_GLB.oleander`). ⚠️ FAIXA FIXA
    // (0,705 a 0,84), A MESMA DA MATA EXTERNA: `fMinMiolo` ia do miolo até a
    // praia e ATRAVESSAVA A TRILHA (0,655 a 0,70) no meio do caminho, ou
    // seja o oleandro podia nascer EM CIMA do saibro. "Borda" aqui é a borda
    // de fora, entre a trilha e a praia, não qualquer ponto da ilha.
    add('oleander', bosque(ilha, k, dsc, 60_000 + k * 191, Math.round(arq.oleandro * mulPara('medio')),
      () => 0.705, 0.84, agua))

    let depois = 0
    for (const l of porArquivo.values()) depois += l.length
    porIlha.push({ id: ilha.id, arquetipo: arq.nome, individuos: depois - antes })
  })

  // ── 2. carrega cada GLB uma vez e extrai as partes (padrão de props.ts:
  // um InstancedMesh POR PRIMITIVA, senão o modelo de duas texturas perde a
  // metade que não é a primeira malha, ver a nota corrigida em inverno.ts
  // esta semana) ────────────────────────────────────────────────────────────
  const disposables: { dispose: () => void }[] = []
  const carregarPartes = async (file: string): Promise<Parte[]> => {
    const root = await loadSf(o.gltf, `/city/sf/${file}.glb`)
    if (!root) return []
    if (o.cortaTextura) podarMapasSecundarios(root)
    dressSf(root, { castShadow: o.sombra ?? true })
    root.updateMatrixWorld(true)
    const partes: Parte[] = []
    root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh) partes.push({ geo: m.geometry, mat: m.material as THREE.Material, local: m.matrixWorld.clone() })
    })
    return partes
  }

  let individuos = 0
  let chamadas = 0
  let trianguloPiorCaso = 0

  // ── 3a. médio, chão e rocha: sem LOD de longe (de 1.250 m não valem um
  // pixel, ver o cabeçalho de arborizacao.ts sobre sombra de copa), só
  // liga/desliga pelo `DistanceCuller` como qualquer adereço pequeno ───────
  const simples: { file: string; papel: Papel }[] = [
    { file: 'banana-tree', papel: 'medio' }, { file: 'bamboo-clump', papel: 'medio' }, { file: 'cycas', papel: 'medio' }, { file: 'oleander', papel: 'medio' },
    { file: 'feto', papel: 'chao' }, { file: 'samambaia', papel: 'chao' }, { file: 'grama-alta', papel: 'chao' },
    { file: 'rocks-stylized-pack', papel: 'rocha' },
  ]
  // ⚠️ CORTE APERTADO, PORQUE ISTO NÃO TEM LOD DE LONGE (só o dossel tem, ver
  // 3b). Medido: o chão (feto/samambaia/capim) é a maior CONTAGEM de
  // indivíduos do módulo (947 no desktop, orçamento em scratchpad) e um raio
  // de corte de 2.500 m os deixava TODOS ligados na vista padrão da praça
  // (~1.250 m), pagando ~410 mil triângulos por folhagem de 0,4 a 1 m de
  // altura, invisível a essa distância. Cortando em 600/900/1.100 m (chão,
  // médio, rocha) a vista padrão da praça sobra só com o octaedro do dossel:
  // é o LOD de longe fazendo o trabalho que o pedido do fundador pede
  // ("a maior parte do tempo elas são vistas de longe").
  const CULL_POR_PAPEL: Record<Papel, number> = { emergente: 4000, dossel: 4000, medio: 900, chao: 600, rocha: 1100 }

  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qua = new THREE.Quaternion(), esc3 = new THREE.Vector3()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const cor = new THREE.Color()

  // ⚠️ UM SUBGRUPO POR PAPEL, NÃO O GRUPO INTEIRO NO CULLER VÁRIAS VEZES. A
  // primeira versão registrava `group` (a raiz inteira do módulo) uma vez por
  // arquivo, com um raio de corte DIFERENTE cada vez: como todas as chamadas
  // mudam a MESMA propriedade `visible` do MESMO objeto, só a última a rodar
  // no `update()` do `DistanceCuller` vencia, e capim (2.500 m) acabava preso
  // ao corte de rocha (3.400 m) ou vice-versa, dependendo da ordem do laço.
  // Cada papel tem seu próprio subgrupo, registrado uma vez, com o raio dele.
  const gruposPorPapel: Partial<Record<Papel, THREE.Group>> = {}
  const grupoDe = (papel: Papel) => {
    let g = gruposPorPapel[papel]
    if (!g) { g = new THREE.Group(); g.name = `ilha-mata:grupo:${papel}`; group.add(g); gruposPorPapel[papel] = g }
    return g
  }

  const instanciarSimples = async (file: string, papel: Papel) => {
    const pts = porArquivo.get(file)
    if (!pts || !pts.length) return
    const partes = await carregarPartes(file)
    if (!partes.length) return
    individuos += pts.length
    const destino = grupoDe(papel)
    for (const parte of partes) {
      const im = new THREE.InstancedMesh(parte.geo, parte.mat, pts.length)
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(pts.length * 3).fill(1), 3)
      pts.forEach((p, i) => {
        const s = (0.75 + hashPos(p.x, p.z) * 0.65) * (papel === 'rocha' ? 1 + hashPos(p.z, p.x) * 1.2 : 1)
        pos.set(p.x, p.y, p.z)
        // ⚠️ GIRO ALEATÓRIO, NÃO RADIAL. A primeira versão apontava toda muda
        // "para fora" (`p.a + π/2`, o ângulo que a gerou): árvore de verdade
        // não nasce alinhada ao centro da ilha, e um bosque inteiro apontando
        // pro mesmo lado lê como plantio de jardineiro, não como mata.
        qua.setFromAxisAngle(eixoY, hashPos(p.x + 3, p.z + 7) * Math.PI * 2)
        esc3.setScalar(s)
        m4.compose(pos, qua, esc3).multiply(parte.local)
        im.setMatrixAt(i, m4)
        im.setColorAt(i, corTropical(p.x, p.z, cor))
      })
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      im.castShadow = papel !== 'chao' && (o.sombra ?? true)
      im.receiveShadow = true
      im.name = `ilha-mata:${file}`
      destino.add(im)
      disposables.push({ dispose: () => { im.geometry.dispose() } })
      chamadas++
      trianguloPiorCaso += pts.length * (TRI_GLB[file] ?? 0) / (PARTES_GLB[file] ?? 1)
    }
  }
  await Promise.all(simples.map((s) => instanciarSimples(s.file, s.papel)))
  for (const [papel, g] of Object.entries(gruposPorPapel) as [Papel, THREE.Group][]) {
    o.culler?.add(g, CULL_POR_PAPEL[papel], new THREE.Vector3(0, 0, 0))
  }

  // ── 3b. dossel e emergente: LOD de verdade (perto = GLB, longe = octaedro
  // tintado), porque estas são as que desenham a silhueta vista de cima ────
  interface Dossel { file: string; papel: Papel; partes: Parte[]; pts: Ponto[]; near: THREE.InstancedMesh[]; iPerto: number[] }
  const dosseis: Dossel[] = []
  const arquivosDossel = ['tree-medit', 'tree-gnarled', 'palm', 'palm-tall', 'palm-date', 'tree-palm']
  for (const file of arquivosDossel) {
    const pts = porArquivo.get(file)
    if (!pts || !pts.length) continue
    const partes = await carregarPartes(file)
    if (!partes.length) continue
    individuos += pts.length
    const near = partes.map((parte) => {
      const im = new THREE.InstancedMesh(parte.geo, parte.mat, pts.length)
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(pts.length * 3).fill(1), 3)
      im.castShadow = o.sombra ?? true
      im.receiveShadow = true
      im.frustumCulled = false
      im.count = 0
      im.name = `ilha-mata:perto:${file}`
      group.add(im)
      chamadas++
      return im
    })
    trianguloPiorCaso += pts.length * (TRI_GLB[file] ?? 0)
    dosseis.push({ file, papel: PAPEL[file], partes, pts, near, iPerto: partes.map(() => 0) })
  }
  const totalDossel = dosseis.reduce((s, d) => s + d.pts.length, 0)
  const gLonge = geoLonge()
  const matLonge = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  const longe = new THREE.InstancedMesh(gLonge, matLonge, Math.max(1, totalDossel))
  longe.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, totalDossel) * 3).fill(1), 3)
  longe.name = 'ilha-mata:longe'
  longe.castShadow = false
  longe.receiveShadow = false
  longe.frustumCulled = false
  longe.count = 0
  group.add(longe)
  chamadas += totalDossel > 0 ? 1 : 0
  disposables.push({ dispose: () => { gLonge.dispose(); matLonge.dispose() } })

  // ⚠️ RAIO DE TROCA 650 m, NÃO OS 150 m DE `arborizacao.ts`. Lá a fileira
  // urbana é vista de rua, a poucos metros; aqui o objeto é a ILHA vista do
  // barco ou da praça, e a troca perto demais do observador (que se aproxima
  // do píer) faria a copa "estourar" de octaedro para malha bem diante dele.
  // NÃO MEDI o ponto exato em que a diferença deixa de incomodar; 650 m é a
  // metade da distância ilha-praça, ponto em que a maioria das vistas já
  // decidiu se está "perto" (passeio de barco) ou "longe" (vista da praça).
  const R_PERTO = 650
  let ultima = new THREE.Vector3(1e9, 1e9, 1e9)
  let perto = 0
  const eixoInclinacao = new THREE.Vector3()
  const quaLean = new THREE.Quaternion()
  const quaYaw = new THREE.Quaternion()
  /** o giro de uma instância: puro (aleatório em Y) para quase tudo, ou
   *  tombado (o coqueiro de `palmeirasInclinadas`) quando `p.inclinacao`
   *  existe. `qYaw` gira a copa antes de tombar, `qLean` tomba o tronco todo
   *  na direção certa: `q = qLean · qYaw`, ou seja o giro acontece no
   *  referencial LOCAL da árvore, antes dela se inclinar (ver a nota grande
   *  em `palmeirasInclinadas` sobre por que não são dois ângulos de Euler). */
  const giroDe = (p: Ponto): THREE.Quaternion => {
    quaYaw.setFromAxisAngle(eixoY, hashPos(p.x + 3, p.z + 7) * Math.PI * 2)
    if (!p.inclinacao) return quaYaw.clone()
    eixoInclinacao.set(p.inclinacao.eixoX, 0, p.inclinacao.eixoZ)
    quaLean.setFromAxisAngle(eixoInclinacao, p.inclinacao.angulo)
    return quaLean.multiply(quaYaw)
  }
  const rebalancear = (cam: THREE.Vector3) => {
    for (const d of dosseis) d.iPerto.fill(0)
    let iL = 0
    perto = 0
    for (const d of dosseis) {
      let iP = 0
      for (const p of d.pts) {
        const dx = p.x - cam.x, dz = p.z - cam.z
        const dist2 = dx * dx + dz * dz
        pos.set(p.x, p.y, p.z)
        qua.copy(giroDe(p))
        if (dist2 < R_PERTO * R_PERTO) {
          const s = 0.8 + hashPos(p.x, p.z) * 0.5
          esc3.setScalar(s)
          const base = new THREE.Matrix4().compose(pos, qua, esc3)
          d.near.forEach((im, pi) => {
            const mm = new THREE.Matrix4().multiplyMatrices(base, d.partes[pi].local)
            im.setMatrixAt(iP, mm)
            im.setColorAt(iP, corTropical(p.x, p.z, cor))
          })
          iP++
          perto++
        } else {
          const med = MEDIDA[d.file] ?? { h: 12, w: 8 }
          const s = 0.8 + hashPos(p.x, p.z) * 0.5
          esc3.set((med.w / 4.8) * s, (med.h / 7.0) * s, (med.w / 4.8) * s)
          m4.compose(pos, qua, esc3)
          longe.setMatrixAt(iL, m4)
          longe.setColorAt(iL, corTropical(p.x, p.z, cor))
          iL++
        }
      }
      d.near.forEach((im, pi) => { im.count = iP; d.iPerto[pi] = iP })
    }
    longe.count = iL
    longe.instanceMatrix.needsUpdate = true
    if (longe.instanceColor) longe.instanceColor.needsUpdate = true
    for (const d of dosseis) for (const im of d.near) {
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }
  }
  rebalancear(new THREE.Vector3(1e9, 1e9, 1e9)) // primeira passada: tudo de longe, câmera nasce na praça

  o.culler?.add(group, 4200, new THREE.Vector3(0, 0, 0))

  console.log(
    `[ilha-mata] ${individuos.toLocaleString('pt-BR')} indivíduos em ${o.ilhas.length} ilhas ` +
    `(tier ${o.tier}, quality ${o.quality}): ` +
    porIlha.map((p) => `${p.id} ${p.arquetipo} ${p.individuos}`).join(', ') +
    `; ${chamadas} chamadas de desenho, ${Math.round(trianguloPiorCaso).toLocaleString('pt-BR')} triângulos de pior caso ` +
    `(todo o dossel no balde de perto)`,
  )

  return {
    group,
    individuos,
    get perto() { return perto },
    trianguloPiorCaso: Math.round(trianguloPiorCaso),
    chamadas,
    porIlha,
    update(cam: THREE.Vector3) {
      if (cam.distanceToSquared(ultima) < 150 * 150) return
      ultima = cam.clone()
      rebalancear(cam)
    },
    dispose() {
      for (const d of disposables) d.dispose()
      group.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.isMesh) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.() }
      })
      group.clear()
    },
  }
}
