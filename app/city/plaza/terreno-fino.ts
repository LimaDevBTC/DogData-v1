// ═══════════════════════════════════════════════════════════════════════════
// O TERRENO FINO: um clipmap geométrico centrado na câmera, que agora
// SUBSTITUI a malha grossa por baixo dele em vez de coexistir com ela. Bloco
// A de `fundacao-gta5.md`.
//
// ⚠️ ATRÁS DE `?terreno=fino`, SEM EXCEÇÃO. O bot de auto-commit publica de
// hora em hora; sem a bandeira, `TERRENO_FINO_ATIVO` é `false`, o grupo deste
// módulo fica vazio, o material da malha grossa não é tocado, e toda função
// pura devolve exatamente ZERO ou não faz nada. `heightAt` de `terrain.ts`
// continua bit a bit igual ao que era antes deste arquivo existir: a prova é
// que `microRelevoAt` retorna 0 na primeira linha quando a bandeira está
// desligada, e `x + 0 === x` em ponto flutuante IEEE754 não tem exceção.
//
// ── UM CHÃO SÓ: por que a malha grossa não é simplesmente descartada ───────
// A primeira versão deste módulo deixava a malha grossa desenhando por
// baixo do clipmap o tempo todo, e isso é um defeito de fundação: onde a
// curva do DEM diverge entre dois vértices da malha grossa (célula de
// ~59 m), a malha grossa e o clipmap (que segue `heightAt` de verdade a
// cada 0,5 a 128 m) se separam em METROS, não em unidade de profundidade, e
// `polygonOffset` não escala isso. Duas superfícies no mesmo lugar é
// exatamente o que este arquivo agora proíbe.
//
// A correção NÃO é apagar a malha grossa (ela é uma malha SÓ, site + saia +
// faixa fina do lago soldados vértice a vértice, e recortá-la de verdade
// quebraria essa costura ou exigiria reconstruir 429×429 vértices toda vez
// que a câmera anda, o que é caro). A correção é MASCARAR: 4 planos de
// recorte (`THREE.Plane`, nativo do Three.js, `clipIntersection: true`)
// aplicados ao MESMO material da malha grossa descartam, no fragmento, tudo
// que cai dentro do quadrado que o nível mais de fora do clipmap cobre AGORA.
// Fora do quadrado, a malha grossa desenha normal; dentro, ela não desenha
// nada, e o clipmap desenha no lugar. Nenhum ponto do mundo tem duas
// respostas ao mesmo tempo, para qualquer posição de câmera, sem exceção.
//
// ⚠️ ISTO NÃO CORTA O CUSTO DE VÉRTICE DA MALHA GROSSA. `clippingPlanes`
// descarta FRAGMENTO (depois da rasterização), não vértice: os 84.480
// triângulos da malha grossa continuam sendo processados no vertex shader
// todo quadro, exatamente como hoje. O que cai é o custo de FRAGMENTO
// (sombreamento, overdraw) na região coberta pelo clipmap, que é onde ele
// estava sendo desperdiçado mesmo. Ver a conta exata em `criarTerrenoFino`.
//
// ── por que UM PLANO NOVO, e o motivo do buraco real do sítio ──────────────
// A malha grossa hoje vem de uma grade de **429×429** células de
// 59,225293797166955 m (`public/lunar/btc-core-heightmap.json`, `cols: 429`),
// não 137×137 como o comentário antigo no topo de `terrain.ts` diz: aquele
// número está desatualizado, é doc-débito de outra rodada, não desta. A
// meia-largura real do sítio é `214 × 59,225... ≈ 12.674 m`, não os ~4.027 m
// que 137×137 daria. Isso importa porque a ideia original deste bloco (um
// nível de clipmap grande o bastante para cobrir o sítio inteiro e a malha
// grossa do sítio simplesmente não ser mais desenhada) não fecha com o
// tamanho real: um nível de 8.192 m de meia-largura NÃO alcança 12.674 m
// quando a câmera está no centro, e alcança MENOS ainda quando ela anda para
// a borda. Cobrir o sítio inteiro para QUALQUER posição de câmera exigiria um
// nível de dezenas de km, o que não é razoável.
//
// Por isso a engenharia é a mascaragem acima, não um clipmap do tamanho do
// sítio: ela resolve "chão único" para qualquer posição de câmera, com custo
// limitado, aceitando que a malha grossa continua existindo (só não
// desenhando) fora do quadrado do clipmap. É exatamente o espírito do anel de
// detalhe (`R_DET`) que `fundacao-gta5.md` já propõe: perto da câmera é
// verdade, longe é gráfico, e "longe" aqui significa fora dos 8.192 m do
// nível mais externo, bem além do raio da cidade (7.691-9.000 m).
//
// Cinco níveis aninhados agora (não quatro), todos com 128×128 quads. Cada
// nível de fora é um ANEL com um buraco quadrado do tamanho exato do nível
// de dentro. Célula e alcance multiplicam por 4 a cada nível:
//   0,5 → 2 → 8 → 32 → 128 m         (célula)
//   64 → 256 → 1.024 → 4.096 → 16.384 m   (alcance = 128 × célula)
// Com essa razão de 4, o buraco de QUALQUER nível mede `128/4 = 32` células
// (ver a nota grande em `BURACO_CELULAS`, é a conta que corrigiu o número
// errado do plano original: 12.288 quads por anel virou 15.360).
//
// ── por que reconstrução e não atualização toroidal ─────────────────────────
// A técnica clássica de geometry clipmap (Losasso/Hoppe) atualiza um buffer
// em anel: só a faixa que "entrou" é recalculada, o resto rola. Aqui cada
// nível é refeito por inteiro quando a câmera cruza o passo dele, porque a
// grade não é toroidal (não há wrap de índice) e o código fica muito mais
// simples de auditar. O custo está orçado no cabeçalho de `atualizar`: é
// barato, e se a chapa acusar o contrário a otimização natural é recalcular
// só a borda que entrou, não a grade inteira.
//
// ── o micro-relevo ──────────────────────────────────────────────────────────
// Um fbm em coordenada de MUNDO (sem período, ver `vnoiseMundo`) somado à
// amostra do DEM. Comprimento de onda mínimo 8 m, amplitude máxima 12 cm,
// em força total até 128 m do centro do clipmap (tudo que os níveis 0 e 1
// cobrem, e 2 m é a célula mais grossa que ainda representa 8 m sem serrilhar:
// 8 = 4 × 2), esvaecendo por smoothstep até 512 m (a borda do nível 2), e
// ZERO dali para fora. Isso não muda com o nível 4 novo: o nível 4 só carrega
// o DEM cru mais o recorte da malha grossa, nunca micro-relevo.
//
// ── as armadilhas de contrato ────────────────────────────────────────────
// 1. `microRelevoAt` é a MESMA função que `terrain.ts` chama dentro de
//    `heightAt`. A malha aqui embaixo (o clipmap) também usa o `heightAt` de
//    `terrain.ts` para desenhar os próprios vértices, a mesma fonte, nunca
//    uma conta paralela. Peça, rua, poste, árvore e câmera pousam em
//    `heightAt`/`superficieAt`; o relevo chega até eles porque chega até
//    essas duas funções, não só na malha.
// 2. Zero sobre pavimento: `ligarNaVia` recebe a MESMA máscara que a rua usa
//    para não plantar árvore dentro do asfalto. Antes de `vias` assentar, a
//    consulta some (`naViaAtual` fica `undefined`) e o relevo segue existindo
//    sem máscara por um instante, o mesmo comportamento que a arborização já
//    tem hoje quando planta antes da rua, não um caso novo.
// 3. ⚠️ NOVO CONTRATO DE `superficieAt`, pedido depois de este módulo ganhar
//    a mascaragem: com a bandeira ligada, `superficieAt` de `terrain.ts`
//    devolve `heightAt(x, z)` SEMPRE, sem depender de qual nível do clipmap
//    cobre o ponto nem de onde a câmera está agora. A alternativa (responder
//    pela malha do nível que cobre o ponto NESTE instante) faria a mesma
//    (x, z) mudar de resposta conforme a câmera anda, e isso derruba árvore,
//    poste e câmera perto de qualquer fronteira. `heightAt` é uma função pura
//    de (x, z), o único resíduo de dependência de câmera que ela carrega é o
//    próprio micro-relevo (até 12 cm, já orçado e aceito no primeiro round
//    deste bloco), não a escolha de malha. Ver o comentário em
//    `terrain.ts`, função `superficieAt`.
// 4. A bandeira. Ver o primeiro parágrafo deste cabeçalho.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

// ── a bandeira ───────────────────────────────────────────────────────────
// Mesmo padrão de `look.ts`: lida uma vez, no módulo, no boot da página.
export const TERRENO_FINO_ATIVO: boolean =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('terreno') === 'fino'

// ── geometria do clipmap ────────────────────────────────────────────────
export const CLIPMAP_N = 128 // quads por lado, em todo nível
/** célula de cada nível, em metros. Razão 4 entre vizinhos. Nível 4 (128 m)
 *  é o pedido novo: leva o alcance de 4.096 para 16.384 m (meia-largura
 *  8.192 m), a malha que efetivamente separa "perto da câmera, mascarando a
 *  malha grossa" de "longe, malha grossa direto". */
export const CLIPMAP_CELULA = [0.5, 2.0, 8.0, 32.0, 128.0] as const
/** alcance = largura total do nível = `CLIPMAP_N × célula`. 64, 256, 1.024,
 *  4.096, 16.384 m. */
export const CLIPMAP_ALCANCE = CLIPMAP_CELULA.map((c) => c * CLIPMAP_N)
/**
 * ⚠️ O BURACO É 32 CÉLULAS, NÃO 64. O plano original (`fundacao-gta5.md`)
 * deu 12.288 quads por anel, o que implica um buraco de 64×64 células
 * (16.384 − 12.288 = 4.096 = 64²). Com célula multiplicando por 4 a cada
 * nível e todo nível tendo o MESMO N=128, um buraco de 64 células no nível
 * de fora mede `64 × célula_fora` metros, e o nível de dentro só cobre
 * `128 × célula_dentro = 128 × (célula_fora/4) = 32 × célula_fora` metros,
 * ou seja o buraco teria o DOBRO da largura do que o nível de dentro cobre,
 * e sobraria um anel de 32 células (a metade do buraco) SEM MALHA NENHUMA
 * entre o fim do nível de dentro e o começo do nível de fora.
 *
 * O buraco certo é `CLIPMAP_N / 4 = 32` células: aí `32 × célula_fora` metros
 * é EXATAMENTE `128 × célula_dentro` metros, porque `célula_fora = 4 ×
 * célula_dentro`. Sem sobra, sem furo. É a regra clássica de geometry
 * clipmap (Losasso/Hoppe): o buraco do nível N é do tamanho da COBERTURA
 * do nível N−1, não da metade da própria grade. Vale para QUALQUER par de
 * níveis vizinhos, inclusive o nível 4 novo contra o nível 3.
 *
 * Com o buraco certo e cinco níveis (um cheio, quatro em anel): cada anel
 * tem `128² − 32² = 15.360` quads. Total: `16.384 + 4 × 15.360 = 77.824`
 * quads = **155.648 triângulos**. Contra os 84.480 de hoje: 1,84× SÓ o
 * clipmap. Mas a malha grossa não sai do vertex shader (ver o cabeçalho do
 * arquivo): o total processado com a bandeira ligada é `84.480 + 155.648 =
 * 240.128`, **2,84×** o custo de hoje, não 1,84×. Medido em aritmética pura,
 * sem abrir navegador; ver a chamada de `node` no relatório.
 */
export const BURACO_CELULAS = CLIPMAP_N / 4

// ── o micro-relevo: amplitude, onda mínima, raio de força total e de zero ──
export const MICRO_AMP_M = 0.12
export const MICRO_ONDA_MIN_M = 8
/** força total até aqui: tudo que os níveis 0 (64 m) e 1 (256 m) cobrem por
 *  inteiro é `128 = CLIPMAP_ALCANCE[1] / 2`, a metade da largura do nível 1. */
export const MICRO_R_CHEIO = CLIPMAP_ALCANCE[1] / 2
/** zero a partir daqui: a metade da largura do nível 2, `512 m`. O
 *  esvaecimento acontece DENTRO do intervalo que o nível 2 cobre sozinho
 *  (128 a 512 m), que é exatamente "ao longo do nível 2" como o plano pede.
 *  Não muda com o nível 4: o nível 4 nunca carrega micro-relevo. */
export const MICRO_R_ZERO = CLIPMAP_ALCANCE[2] / 2
/** folga da máscara de via: 0, de propósito. `naVia` já é conservadora (marca
 *  até 4 m além da borda real, ver o comentário dela em `vias.ts`), então
 *  folga 0 aqui já sobra alguns metros de margem de graça. Escolhido, não
 *  medido: se a chapa mostrar relevo raspando o meio-fio, sobe para 1 ou 2. */
export const MICRO_FOLGA = 0

export type NaViaFn = (x: number, z: number, folga?: number) => boolean

// ── ruído em coordenada de mundo, sem período ───────────────────────────
// Mesma família de hash inteiro que `materiais.ts` usa em `hash2`/`vnoise`,
// mas SEM o `% per` que faz aquele ladrilhar. Aqui não há period: o mundo
// da cidade não repete, e não pode, porque o relevo tem que ser o mesmo
// valor sempre que alguém pergunta pelo mesmo (x, z), venha de onde vier a
// pergunta (a malha do clipmap, `heightAt`, uma peça pousando).
function hashMundo(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function vnoiseMundo(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hashMundo(xi, zi), b = hashMundo(xi + 1, zi)
  const c = hashMundo(xi, zi + 1), d = hashMundo(xi + 1, zi + 1)
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
}

/** Três oitavas, mas ao contrário do `fbm` de `materiais.ts`: a mais FINA é
 *  a de 8 m, que é o PISO do comprimento de onda, e as outras duas (16, 32 m)
 *  são MAIS GROSSAS, não mais finas. Nenhuma oitava fura o piso de 8 m.
 *  Devolve 0..1. */
function microFbmMundo(x: number, z: number): number {
  const a = vnoiseMundo(x / MICRO_ONDA_MIN_M, z / MICRO_ONDA_MIN_M)
  const b = vnoiseMundo(x / (MICRO_ONDA_MIN_M * 2), z / (MICRO_ONDA_MIN_M * 2))
  const c = vnoiseMundo(x / (MICRO_ONDA_MIN_M * 4), z / (MICRO_ONDA_MIN_M * 4))
  return a * 0.55 + b * 0.3 + c * 0.15
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

// ── estado do módulo: o centro do clipmap e a máscara da via ───────────────
// ⚠️ MÓDULO, NÃO INSTÂNCIA. `terrain.ts` chama `microRelevoAt` direto (sem
// passar por um objeto `TerrenoFino`), porque `heightAt` nasce antes de o
// clipmap existir. Mesmo padrão de `look.ts`: estado global lido por todo
// mundo, escrito só por quem tem a caneta (`atualizar`, `ligarNaVia`).
let centro = { x: 0, z: 0 }
let naViaAtual: NaViaFn | undefined

/** Chame quando `vias` assentar: `ligarNaVia(vias.naVia)`. Antes disso a
 *  máscara não existe e o relevo é desenhado sem ela, mesmo comportamento
 *  que a arborização já tem quando planta antes da rua subir. */
export function ligarNaVia(fn: NaViaFn): void {
  naViaAtual = fn
}

/** 1 perto do centro do clipmap atual, esvaecendo por smoothstep entre
 *  `MICRO_R_CHEIO` e `MICRO_R_ZERO`, 0 dali pra fora. 0 sempre que a bandeira
 *  está desligada. Usada só pelo micro-relevo agora (o contrato de
 *  `superficieAt` deixou de depender dela, ver a armadilha 3 no cabeçalho). */
export function pesoFino(x: number, z: number): number {
  if (!TERRENO_FINO_ATIVO) return 0
  const d = Math.hypot(x - centro.x, z - centro.z)
  if (d <= MICRO_R_CHEIO) return 1
  if (d >= MICRO_R_ZERO) return 0
  return 1 - smooth01((d - MICRO_R_CHEIO) / (MICRO_R_ZERO - MICRO_R_CHEIO))
}

/**
 * O relevo em (x, z), em metros, para SOMAR à amostra do DEM. Chamado por
 * `terrain.ts` dentro de `heightAt` e por este módulo dentro da própria
 * malha (via `heightAt`, nunca direto), uma função só, os dois lugares.
 *
 * ⚠️ COM A BANDEIRA DESLIGADA ISTO É `return 0` NA PRIMEIRA LINHA, sempre.
 * É a prova de bit a bit: `heightAt` de `terrain.ts` vira `base + 0`, e em
 * IEEE754 isso é exatamente `base`.
 */
export function microRelevoAt(x: number, z: number): number {
  if (!TERRENO_FINO_ATIVO) return 0
  const peso = pesoFino(x, z)
  if (peso <= 0) return 0
  if (naViaAtual && naViaAtual(x, z, MICRO_FOLGA)) return 0
  const f = microFbmMundo(x, z) * 2 - 1 // 0..1 -> -1..1
  return f * MICRO_AMP_M * peso
}

// ── a malha ──────────────────────────────────────────────────────────────

export interface TerrenoFinoOpts {
  /** o MESMO `heightAt` de `terrain.ts` (já com o micro-relevo embutido
   *  quando a bandeira está ligada). O clipmap não sabe nada de DEM: só
   *  amostra esta função em cada vértice. */
  heightAt: (x: number, z: number) => number
  /** a MESMA cor por vértice que a malha grossa usa (`Terrain.corAt`), para
   *  o clipmap ficar visualmente idêntico onde as duas coexistiam. */
  corAt: (x: number, z: number, relevo: number, out: THREE.Color) => THREE.Color
  /** `Terrain.meanHeight`: o relevo relativo que `corAt` espera. */
  meanHeight: number
  /** `Terrain.uvEscala`: mesma escala de UV da malha grossa, pro ladrilho da
   *  textura casar. */
  uvEscala: number
  /**
   * `Terrain.material`: o material da malha grossa, por referência (não um
   * clone). Serve para DUAS coisas:
   * 1. É clonado (`.clone()`) para os 5 níveis do clipmap desenharem com a
   *    mesma receita visual, mais `polygonOffset` no clone (não no
   *    original), detalhe que sobra de quando as duas malhas coexistiam;
   *    hoje quase nunca mais competem, mas o offset é barato e inofensivo
   *    deixá-lo, então ficou.
   * 2. ⚠️ É MUTADO DIRETO (não clonado) para receber os 4 `THREE.Plane` que
   *    mascaram a malha grossa. Por isso tem que ser a MESMA referência que
   *    a malha grossa de `terrain.ts` usa: mascarar um clone não mascara o
   *    que está desenhado na tela. Sem este campo, a malha grossa não é
   *    mascarada e as duas superfícies voltam a coexistir.
   */
  material?: THREE.Material
  sombra?: boolean
}

export interface TerrenoFino {
  group: THREE.Group
  /** triângulos totais dos cinco níveis, fixo (não muda com a câmera):
   *  128² (nível 0, cheio) + 4 × (128² − 32²) (níveis 1-4, anel) = 77.824
   *  quads = 155.648 triângulos. Ver `BURACO_CELULAS`. */
  triangulos: number
  /**
   * Chame todo quadro. Cada um dos cinco níveis só é refeito quando a
   * câmera cruza o PASSO daquele nível (o passo é a própria célula: 0,5 m
   * pro nível 0, 2 pro 1, 8 pro 2, 32 pro 3, 128 pro 4), nunca por quadro, e
   * encaixado no passo do nível, não numa distância qualquer. É o mesmo
   * padrão de `mobiliario-urbano.atualizar`, com um detalhe a mais: aqui
   * cada nível tem o SEU passo, não um só pra tudo. Também reposiciona os 4
   * planos de recorte da malha grossa para o quadrado do nível mais de fora
   * (nível 4) RECÉM CONSTRUÍDO, nunca a posição contínua da câmera: assim a
   * máscara sempre casa exatamente com a borda do que está desenhado, sem
   * folga de 1 quadro entre a malha se mover e a máscara se mover.
   *
   * ⚠️ ORÇAMENTO POR REFAÇÃO DE UM NÍVEL: 129×129 = 16.641 amostras de
   * `heightAt` (a grade cheia, inclusive as ~961 do interior do buraco nos
   * níveis em anel, que nascem e não são desenhadas, simplificação
   * deliberada, ~5,8% de amostra a mais por código mais simples de auditar)
   * mais 1 `computeVertexNormals()` sobre até 32.768 triângulos (nível 0).
   * Amostras de `heightAt` por metro andado, somando os 5 níveis (cada um
   * no seu passo): `16.641 × (1/0,5 + 1/2 + 1/8 + 1/32 + 1/128) ≈ 44.333`.
   * Não medido em ms: sem navegador não há relógio de quadro.
   */
  atualizar(camera: THREE.Camera): void
  dispose(): void
}

/** Índices de um nível: grade `N×N` quads, com um buraco quadrado centrado
 *  de `BURACO_CELULAS` de lado quando `cheio` é falso. Mesma ordem de
 *  enrolamento que `terrain.ts` usa na grade do sítio (`a, c, b, b, c, d`
 *  com `c` uma linha abaixo de `a`), pra não precisar do teste de normal
 *  invertida que `terrain.ts` faz no boot: aqui a topologia é sempre a
 *  mesma, então o enrolamento certo se confere uma vez, não a cada nível. */
function indicesDoNivel(cheio: boolean): number[] {
  const n = CLIPMAP_N
  const rowLen = n + 1
  const margem = (n - BURACO_CELULAS) / 2
  const idx: number[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!cheio
        && i >= margem && i < margem + BURACO_CELULAS
        && j >= margem && j < margem + BURACO_CELULAS) continue
      const a = j * rowLen + i, b = a + 1, c = a + rowLen, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  return idx
}

interface NivelInterno {
  mesh: THREE.Mesh
  geo: THREE.BufferGeometry
  cell: number
  n: number
  /** o centro (já ajustado à célula) usado na última reconstrução, ou
   *  `null` antes da primeira. */
  centroConstruido: { x: number; z: number } | null
}

function criarNivel(cell: number, cheio: boolean, material: THREE.Material, sombra: boolean): NivelInterno {
  const n = CLIPMAP_N
  const rowLen = n + 1
  const nv = rowLen * rowLen
  const geo = new THREE.BufferGeometry()
  // ⚠️ ATRIBUTOS PRÉ-ALOCADOS, NÃO `number[]`. Ao contrário da malha grossa
  // de `terrain.ts` (construída uma vez só), este nível é reescrito toda
  // hora que a câmera cruza o passo dele: alocar um `Float32Array` uma vez e
  // escrever nele com `.setXYZ`/`needsUpdate` evita recriar o buffer inteiro
  // a cada refação.
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2), 2))
  geo.setIndex(indicesDoNivel(cheio))
  const mesh = new THREE.Mesh(geo, material)
  mesh.receiveShadow = sombra
  mesh.frustumCulled = false // a malha grossa também desliga: ela cerca a câmera, a esfera não ajuda
  mesh.renderOrder = 1 // depois da malha grossa, pro polygonOffset do material valer
  return { mesh, geo, cell, n, centroConstruido: null }
}

/** Reescreve os vértices de um nível para o novo centro `(cx, cz)`, já
 *  encaixado na célula dele por quem chama (`atualizar`). Amostra
 *  `opts.heightAt` uma vez por vértice: é o custo real desta função, ver o
 *  orçamento no comentário de `TerrenoFino.atualizar`. */
function preencherNivel(nivel: NivelInterno, cx: number, cz: number, opts: TerrenoFinoOpts): void {
  const { cell, n, geo } = nivel
  const rowLen = n + 1
  const meio = n / 2
  const pos = geo.attributes.position as THREE.BufferAttribute
  const cores = geo.attributes.color as THREE.BufferAttribute
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const col = new THREE.Color()
  for (let j = 0; j <= n; j++) {
    const z = cz + (j - meio) * cell
    for (let i = 0; i <= n; i++) {
      const x = cx + (i - meio) * cell
      const y = opts.heightAt(x, z)
      const k = j * rowLen + i
      pos.setXYZ(k, x, y, z)
      opts.corAt(x, z, y - opts.meanHeight, col)
      cores.setXYZ(k, col.r, col.g, col.b)
      uv.setXY(k, x / opts.uvEscala, z / opts.uvEscala)
    }
  }
  pos.needsUpdate = true
  cores.needsUpdate = true
  uv.needsUpdate = true
  geo.computeVertexNormals()
  nivel.centroConstruido = { x: cx, z: cz }
}

export function criarTerrenoFino(opts: TerrenoFinoOpts): TerrenoFino {
  const group = new THREE.Group()
  group.name = 'TerrenoFino'

  // ⚠️ SEM A BANDEIRA, NO-OP TOTAL. Nenhuma geometria, nenhum material,
  // nenhum plano de recorte é criado; o material da malha grossa (se
  // passado) não é tocado. `atualizar`/`dispose` não fazem nada. Isso deixa
  // a linha única que a cena chama (`criarTerrenoFino(...)`) segura de
  // chamar sempre, sem a cena precisar checar a bandeira ela mesma, o mesmo
  // espírito de `look.ts`: o módulo lê a bandeira, quem chama não precisa.
  if (!TERRENO_FINO_ATIVO) {
    return { group, triangulos: 0, atualizar() {}, dispose() {} }
  }

  // ⚠️ POR QUE CLONE PARA O CLIPMAP, E MUTAÇÃO DIRETA PARA A MÁSCARA. Ver o
  // comentário grande em `TerrenoFinoOpts.material`: o clipmap desenha com
  // um CLONE (mais `polygonOffset`, resíduo inofensivo de quando as duas
  // malhas podiam ficar quase coincidentes); a malha grossa é mascarada
  // mutando o material ORIGINAL, porque mascarar um clone não mascararia o
  // que está de fato na tela.
  const materialClipmap = (opts.material ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })).clone()
  materialClipmap.polygonOffset = true
  materialClipmap.polygonOffsetFactor = -4
  materialClipmap.polygonOffsetUnits = -4

  // ── a máscara: 4 planos formando o quadrado do nível mais de fora ──────
  // ⚠️ ISTO É O QUE GARANTE "UM CHÃO SÓ". `clipIntersection = true` faz o
  // Three.js descartar um fragmento só quando ele está do lado de dentro dos
  // QUATRO planos ao mesmo tempo: a interseção dos quatro semiespaços é
  // exatamente o quadrado que o nível mais de fora cobre agora. Fora do
  // quadrado a malha grossa desenha normal. Exige `renderer.localClippingEnabled
  // = true` no renderer da cena (fora do alcance deste arquivo, ver o
  // relatório para a linha exata).
  let planosMascara: THREE.Plane[] | null = null
  if (opts.material) {
    planosMascara = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), // guarda x <= cx-h
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),  // guarda x >= cx+h
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), // guarda z <= cz-h
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),  // guarda z >= cz+h
    ]
    opts.material.clippingPlanes = planosMascara
    opts.material.clipIntersection = true
  }

  const sombra = opts.sombra !== false
  const niveis: NivelInterno[] = CLIPMAP_CELULA.map((cell, i) => criarNivel(cell, i === 0, materialClipmap, sombra))
  for (const nv of niveis) group.add(nv.mesh)
  const nivelDeFora = niveis[niveis.length - 1]
  const meiaLarguraFora = (nivelDeFora.cell * nivelDeFora.n) / 2 // 8.192 m com o nível 4

  const _alvo = new THREE.Vector3()

  function atualizar(camera: THREE.Camera): void {
    camera.getWorldPosition(_alvo)
    // ⚠️ ESTADO DO MÓDULO, LIDO POR `terrain.ts`. Atualizado todo quadro
    // (é só uma atribuição, não custa nada); só a MALHA é que respeita o
    // passo de cada nível, mais abaixo.
    centro.x = _alvo.x
    centro.z = _alvo.z
    for (const nv of niveis) {
      // encaixado no passo do PRÓPRIO nível: arredonda pra célula dele, não
      // pra uma grade global. Ver o cabeçalho do arquivo.
      const cx = Math.round(_alvo.x / nv.cell) * nv.cell
      const cz = Math.round(_alvo.z / nv.cell) * nv.cell
      const c = nv.centroConstruido
      if (c && c.x === cx && c.z === cz) continue
      preencherNivel(nv, cx, cz, opts)
    }
    // a máscara segue o CENTRO CONSTRUÍDO do nível de fora (não a câmera
    // contínua): assim ela sempre bate com a borda real da malha que está
    // desenhada, nunca com onde a câmera está NESTE exato instante.
    if (planosMascara && nivelDeFora.centroConstruido) {
      const c = nivelDeFora.centroConstruido
      planosMascara[0].constant = c.x - meiaLarguraFora
      planosMascara[1].constant = -(c.x + meiaLarguraFora)
      planosMascara[2].constant = c.z - meiaLarguraFora
      planosMascara[3].constant = -(c.z + meiaLarguraFora)
    }
  }

  const n = CLIPMAP_N
  const quadsCheio = n * n
  const quadsAnel = n * n - BURACO_CELULAS * BURACO_CELULAS
  const nAneis = niveis.length - 1
  const triangulos = (quadsCheio + nAneis * quadsAnel) * 2

  return {
    group,
    triangulos,
    atualizar,
    dispose() {
      for (const nv of niveis) nv.geo.dispose()
      materialClipmap.dispose()
      // devolve a malha grossa ao estado sem máscara, pra não deixar um
      // plano de recorte morto grudado no material de quem nos deu ele.
      if (opts.material) {
        opts.material.clippingPlanes = []
        opts.material.clipIntersection = false
      }
    },
  }
}
