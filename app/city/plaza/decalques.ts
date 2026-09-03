// ═══════════════════════════════════════════════════════════════════════════
// OS DECALQUES DE CHÃO: a especificidade que nenhum chão da cidade tem hoje.
//
// ⚠️ ESTE MÓDULO É O EMPREGO NOVO DE lotes.ts. `lotes.ts` (568 linhas) media a
// demarcação dos 52.984 lotes e não era importado por ninguém: em 30/08 o
// fundador decidiu que o lote NÃO APARECE (a cidade mostra infraestrutura, não
// divisa, porque nada foi mintado ainda), e a decisão foi reafirmada em 02/09.
// O que sobrevive dali não é o código, é a TÉCNICA, e ela já veio medida:
//
//   decal projetivo:  30,03 ms POR PEÇA (26,5 min de CPU pra cidade inteira)
//   atlas de textura por peça: 1,24 gigatexel (um atlas do tamanho da cidade)
//   quad instanciado, desenho no fragmento: 0,47 a 0,66 ms pra 52.984 peças
//
// A terceira opção venceu lá e vence aqui. A diferença é COMO o fragmento
// desenha: `lotes.ts` calculava a divisa por SDF (distância até a borda, em
// GLSL, sem textura nenhuma). Aqui o desenho é grande demais em variedade
// (remendo, trinca, tampa, poeira, ejecta...) pra valer a pena como fórmula;
// em vez disso um ATLAS ÚNICO de 2048×2048 (16 células de 512²) é gerado uma
// vez em canvas, como `materiais.ts` já faz pras seis superfícies, e cada
// instância escolhe uma célula. Nada de PNG no bundle, nada de rede.
//
// ⚠️ MeshStandardMaterial COM onBeforeCompile, E NÃO ShaderMaterial CRU, pelo
// mesmo motivo de `lotes.ts`: onBeforeCompile sobre o Standard entrega sombra
// recebida, log-depth, tonemapping, espaço de cor e o ambiente lunar de
// graça. Um ShaderMaterial cru reescreveria os seis includes à mão e ainda
// divergiria da resposta de luz do terreno e da via. Continua 1 material, 1
// programa (`customProgramCacheKey` fixo).
//
// ── POR QUE UM ATLAS AQUI NÃO É O "1,24 GIGATEXEL" QUE lotes.ts REJEITOU ────
// O número rejeitado era um atlas com espaço PRÓPRIO por lote (52.984 peças
// de testada variável, 6 a 168 m). Aqui o atlas é COMPARTILHADO: 16 receitas
// fixas, reaproveitadas por até 20.000 instâncias via um índice de célula por
// instância. O atlas custa 2048² × 4 bytes = 16.777.216 bytes = 16,0 MiB
// (≈21,3 MiB com a cadeia de mipmap, 4/3 do base). Isso é FIXO,
// independente de quantas instâncias existem: é o preço de 16 receitas, não
// de 20.000 peças.
//
// ── A GEOMETRIA: MAIS SIMPLES QUE lotes.ts, E É DE PROPÓSITO ────────────────
// `lotes.ts` amarrava os QUATRO CANTOS do quad na malha do terreno (bilinear)
// porque um lote mede até 168 m e cruza vários triângulos de 59 m — plano
// teria deixado o terreno "passar por cima" do lote em até 3,3 m no pior
// caso. O maior decalque daqui mede 3,0 × 0,5 m: sobre um triângulo de 59 m
// isso é ruído. Um único plano TILTADO a partir do gradiente local (altura
// central + duas amostras de `heightAt`, um passo de 0,4 m) já cobre o caso:
// com a inclinação medida em lotes.ts (mediana 1,72°, p95 3,80°, máximo
// 6,11°), o pior erro de um plano tiltado sobre 1 m de meio-raio é
// tan(6,11°) × 1 m ≈ 10,7 cm SEM tilt (chapado) e ≈ 0 por construção COM
// tilt (o plano É a tangente local). Por isso aqui são 3 chamadas de
// `heightAt` por instância (centro, +X, +Z), não 4 cantos + 5 sondas como em
// lotes.ts: o decalque é pequeno demais pra cruzar a diagonal de um triângulo
// de 59 m, que era o problema que as 5 sondas de lotes.ts resolviam.
//
// ── A BANDEIRA É `?decalque=1`, PRÓPRIA, NÃO `?look=2` ─────────────────────
// O bot de auto-commit publica pra `origin/main` de hora em hora. Como
// `look.ts` e `materiais.ts` (`?relevo=1`), um sistema de decalque inteiro
// não estreia sem o fundador ver a chapa antes de virar padrão pro visitante
// da hora seguinte.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

// ── o catálogo, e ele é LUNAR ────────────────────────────────────────────
// Não há chuva, não há erosão de vento, não há mato na junta. FORA: poça,
// musgo, mancha de água, folha seca, limo — tudo o que pede clima que a Lua
// não tem. DENTRO, o que aquele chão de fato faria:
//
//   remendo de pavimento (borda irregular + junta de execução), em duas
//     silhuetas (redondo e vala alongada, a "remendo-vala")
//   junta de concretagem da calçada / trinca de retração, em duas silhuetas
//     (junta reta + ramo, e trinca solta só ramificada)
//   tampa de poço, grelha de boca de lobo, caixa de inspeção
//   poeira de regolito acumulada no pé do meio-fio e na sarjeta
//   rastro de pneu de rover e trilha de pisada nos atalhos que a teia não
//     previu
//   ejecta clara ao redor de cratera pequena
//   pintura de faixa desgastada (gasta na trilha de roda, inteira no
//     acostamento)
//
// ⚠️ `naVia` NÃO DISTINGUE PISTA DE CALÇADA, SÓ "É VIA" DE "NÃO É VIA" — E
// ISSO JÁ TEM PONTE PRONTA PRA QUANDO MUDAR. A consulta que existe hoje
// (`vias.naVia`) devolve um booleano único pra pista, sarjeta E calçada
// juntas (ver o comentário dela em vias.ts); por isso remendo de asfalto e
// junta de calçada competem pela mesma zona larga ('via') no caminho sem
// `sobreQue`. A frente de vias está preparando `sobreQue(x, z)`, devolvendo
// `'pista' | 'sarjeta' | 'calcada' | null`, e este módulo já aceita essa
// opção (`DecalquesOpts.sobreQue`, ver abaixo): quando ela chegar, cada tipo
// do catálogo já sabe em qual das três superfícies finas nasce
// (`TipoDecal.superficies`) e o caminho largo por `naVia` vira só o
// FALLBACK pra quando `sobreQue` não vier ou devolver `null` (fora de
// via — aí quem decide continua sendo `naVia` com folga, como hoje). Nada
// neste módulo precisa mudar de novo quando a outra ponta ligar; troca-se
// só o valor da opção na chamada de `buildDecalques`, em `plaza-scene.tsx`.
//
// ⚠️ "EJECTA AO REDOR DE CRATERA" NÃO ESTÁ ANCORADA EM CRATERA DE VERDADE. As
// 56 crateras carimbadas da receita de regolito foram REMOVIDAS em 01/09
// (ver materiais.ts, amostraRegolito) e nenhuma posição real de cratera
// pequena é publicada em lugar nenhum do terreno hoje. O decalque de ejecta
// existe, mas espalhado no regolito por hash, não em volta de uma cratera
// que exista na malha. NÃO DISPONÍVEL até o terreno publicar posição de
// cratera.
//
// ⚠️ A "TRILHA DE PISADA" TAMBÉM É APROXIMAÇÃO. Um atalho de verdade nasce de
// tráfego simulado que este módulo não tem. Aqui ela é uma faixa compactada
// espalhada por hash no regolito longe da via — lê como "caminho gasto" de
// longe, não é literalmente o rastro de ninguém.
//
// ⚠️ "FAIXA DE PINTURA" NÃO SABE A DIREÇÃO DA PISTA. Orientar a faixa ao
// longo do eixo real da via pediria o rumo local, que `naVia` não devolve
// (só booleano). Aqui ela nasce com rotação aleatória por célula, como
// qualquer outro tipo da zona 'via' — plausível como remendo de pintura
// isolado, não como uma faixa contínua acompanhando a pista.
//
// ── COMO A REPETIÇÃO FOI QUEBRADA (a regra que materiais.ts já escreveu:
// "um ladrilho só pode conter o que o olho não consegue identificar
// individualmente" — um decalque TEM posição, mas se o mesmo remendo
// aparecer 20 vezes na quadra o efeito é o mesmo carimbo) ──────────────────
//   1. DUAS SILHUETAS por categoria maior (remendo e junta/trinca têm cada
//      uma duas receitas de atlas), escolhidas por hash da célula.
//   2. ROTAÇÃO contínua 0..2π por instância.
//   3. ESPELHO (flip de U) por instância: dá uma segunda leitura de graça
//      pras formas assimétricas (grelha, faixa, remendo-vala).
//   4. ESCALA 0,85 a 1,15 por instância.
//   5. TINTA por instância (±8% por canal), como `lotes.ts` fazia pro MIOLO.
//   6. DENSIDADE BAIXA por zona (11,25% via, 78,75% borda, 2,25% regolito —
//      ver DENSIDADE abaixo, já reajustada pro passo de 6 m): a mesma
//      quantidade de decalque por metro quadrado de antes da correção do
//      jitter, ver a seção seguinte.
//   7. JITTER DENTRO DA CÉLULA (ver a seção seguinte): sem ele, a grade
//      regular por si só desenha um RITMO reconhecível mesmo com forma e
//      cor variando — o mesmo erro das 56 crateras carimbadas de
//      materiais.ts, só que na cadência da colocação, não no desenho.
//
// ── O ARTEFATO DE TRANSPARÊNCIA, E COMO ELE FOI EVITADO ─────────────────────
// Decalque de chão empilhado é o caso clássico de "transparência sem ordem":
// `THREE.InstancedMesh`/`InstancedBufferGeometry` NÃO ordena instâncias por
// profundidade entre si, só o OBJETO inteiro entra na fila de transparência
// ordenada por distância à câmera. Se duas instâncias desta malha ocupassem
// o mesmo fragmento, a ordem de desenho entre elas seria a ordem do índice,
// arbitrária, e o resultado piscaria ao mover a câmera.
//
// ⚠️ A PRIMEIRA VERSÃO GARANTIA "NUNCA HÁ SOBREPOSIÇÃO" COM CENTRO FIXO NO
// MEIO DE CADA CÉLULA, SEM JITTER, E ISSO ERA A LIÇÃO CERTA APLICADA NO
// LUGAR ERRADO. A garantia geométrica estava correta; a consequência não:
// colocação presa a uma grade regular DESENHA A GRADE. Com 35% de densidade
// na borda, a poeira do pé do meio-fio caía a cada 4 m com regularidade de
// régua, e a 1,7 m o olho lê isso na hora — o mesmo defeito das 56 crateras
// carimbadas removidas de materiais.ts em 01/09, só que repetindo o RITMO
// da colocação em vez do DESENHO do carimbo. "Um ladrilho só pode conter o
// que o olho não identifica individualmente" vale igual pra posição: uma
// grade sem jitter é tão identificável quanto uma cratera copiada e colada.
//
// A saída é GRADE ESTRATIFICADA COM JITTER LIMITADO: cada célula ainda dá
// no máximo um decalque (a estratificação, que é o que evita amontoado),
// mas o centro anda dentro de um disco de raio `r` ao redor do centro da
// célula em vez de ficar cravado nele. `r` tem que ser pequeno o bastante
// pra dois vizinhos ORTOGONAIS na grade (distância de centro a centro =
// passo `P`, no pior caso) nunca se tocarem, mesmo se os dois forem o maior
// decalque do catálogo (diagonal `D`) e o jitter empurrar os dois um contra
// o outro:
//
//     centro a centro no pior caso = P − 2r  ≥  D   ⟺   r ≤ (P − D) / 2
//
// Com o passo antigo (P = 4,0 m) e D = 3,04 m (a faixa desgastada,
// 3,0 × 0,5 m, o maior decalque do catálogo — o segundo é o rastro de
// pneu, 2,6 × 1,4 m, diagonal 2,95 m), o jitter seguro era r ≤ 0,48 m: de
// menos de meio metro, pouco pra disfarçar a régua. Abrindo o passo pra
// P = 6,0 m, com o MESMO D = 3,04 m, o limite sobe pra r ≤ 1,48 m — mais de
// 3× o raio anterior, e agora o jitter é grande o bastante pra apagar a
// grade a olho. `JITTER_R = 1,40 m` fica um pouco abaixo do limite teórico
// (0,08 m de folga sobre o arredondamento de ponto flutuante do seno e
// cosseno da amostragem em disco).
//
// O jitter sai do MESMO hash determinista da célula que já escolhe tipo,
// rotação, escala, espelho e tinta (salts 9 e 10 de `hashCelula`, amostragem
// UNIFORME EM DISCO — ângulo de um hash, raio de `JITTER_R · √h` do outro,
// não `JITTER_R · h` sem raiz, que empilharia ponto perto do centro porque
// área cresce com o raio ao quadrado). A mesma célula (ci, cj) cai sempre no
// mesmo ponto jitterado, em toda sessão: nada armazenado, nada carregado, a
// garantia de determinismo do cabeçalho continua de pé.
//
// O passo maior (6,0 m em vez de 4,0 m) sobe a área por célula de 16 m²
// pra 36 m², 2,25×, e é por isso que `DENSIDADE` também sobe 2,25× abaixo:
// a MESMA quantidade de decalque por metro quadrado de antes, numa grade
// mais larga com folga pro jitter.
//
// O que sobra é o encontro com o CHÃO por baixo (terreno, via, lote): esse
// caso é o mesmo que `lotes.ts` já resolveu, e a resposta é a mesma —
// ALTURA, não profundidade de rasterizador. `ALTURA_DECALQUE = 0,02 m`
// reaproveita a constante medida em lotes.ts (segura de 300 a 9.000 m com
// buffer de profundidade logarítmico desligado, que é o padrão desta cena
// desde que `near` passou a acompanhar a distância). `depthWrite: false` +
// `transparent: true` deixam a borda do decalque suave (a receita entrega
// alfa gradiente, não recortado) sem gerar zbuffer competindo consigo mesma.
//
// ⚠️ RISCO RESIDUAL, DECLARADO E NÃO CONSERTADO: SANGRAMENTO DE MIPMAP NO
// ATLAS. Cada receita já deixa uma margem de 10 a 20% até a borda da própria
// célula (nenhuma vai a alfa > 0 encostada no limite 0..1), o que cobre a
// maioria dos níveis de mipmap intermediários. Mas em mips muito grosseiros
// (a malha inteira do atlas cabendo em poucos texels) qualquer decalque já
// está pequeno demais pra o olho notar a cor errada. NÃO MEDIDO na tela: se
// aparecer halo de cor vizinha na borda de um decalque visto de longe, o
// conserto é encolher a margem de amostragem de UV por célula (deixar de
// amostrar os últimos 2 a 4 texels de cada lado) ou desligar mipmap abaixo
// de um nível — nenhum dos dois está feito aqui.
// ═══════════════════════════════════════════════════════════════════════════

export interface DecalquesOpts {
  /** ⚠️ Mesma exigência de lotes.ts: use `terrain.superficieAt`, que é o
   *  plano que a malha do terreno realmente desenha, não `heightAt` cru. */
  heightAt: (x: number, z: number) => number
  /** A mesma máscara que a arborização usa (vias.naVia). Sem ela E sem
   *  `sobreQue`, só a zona 'regolito' nasce (rastro, trilha, ejecta) — ver a
   *  nota longa acima sobre `naVia` não distinguir superfície. Continua
   *  sendo o FALLBACK de `sobreQue` pro que cai fora de via. */
  naVia?: (x: number, z: number, folga?: number) => boolean
  /** ⚠️ PONTA PREPARADA, AINDA NÃO LIGADA (02/09). A frente de vias vai
   *  publicar esta consulta fina; quando vier, cada tipo do catálogo já
   *  sabe em qual superfície nasce (`TipoDecal.superficies`) e o balde
   *  largo por `naVia` vira só o fallback pro que `sobreQue` devolve `null`
   *  (fora de via). Sem ela, o módulo funciona exatamente como hoje — não
   *  precisa voltar a este arquivo quando a outra ponta ligar, só passar o
   *  valor na chamada de `buildDecalques`. */
  sobreQue?: (x: number, z: number) => Superficie | null
  sombra?: boolean
  /** raio do anel de detalhe, em metros. ⚠️ NÃO HÁ AINDA UM `R_DET`
   *  COMPARTILHADO PELA CENA (conferido: nenhum módulo declara essa
   *  constante hoje). O valor de partida do plano da fundação é 300 m,
   *  repetido aqui como padrão isolado; quando a cena ganhar um R_DET
   *  próprio e medido no Bloco 0, é ESTE campo que recebe o valor dela. */
  raio?: number
}

export interface Decalques {
  group: THREE.Group
  /** quantas instâncias estão desenhando agora (muda a cada `atualizar`) */
  instancias: number
  /** teto duro: 20.000 × 2 tri = 40.000 triângulos, sempre, em 1 chamada */
  triangulosMax: number
  /** memória do atlas, com mipmap, em MiB — fixa, não cresce com instância */
  atlasMiB: number
  /** só refaz a lista quando a câmera anda mais que PASSO_REFAZ; o padrão é
   *  `mobiliario-urbano.ts`, função `atualizar`. */
  atualizar(camera: THREE.Camera): void
  dispose(): void
}

// ── a bandeira ──────────────────────────────────────────────────────────
// ⚠️ ATRÁS DE `?decalque=1`, PRÓPRIA DESTE MÓDULO. O bot de auto-commit
// publica de hora em hora; um sistema de decalque inteiro, novo, não visto
// pelo fundador numa chapa, não pode estrear ligado por padrão.
const DECALQUE_ON =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('decalque') === '1'

// ── as cotas medidas ou herdadas ──────────────────────────────────────────
/** herdado de lotes.ts, mesma medição: segura de 300 a 9.000 m sem cintilar */
const ALTURA_DECALQUE = 0.02
/** passo da amostra de gradiente. Pequeno porque o maior decalque mede 3 m:
 *  um passo maior que meio decalque leria a inclinação do QUARTEIRÃO vizinho,
 *  não a do próprio pé. */
const PASSO_GRAD = 0.4
/** teto duro de instâncias — ver o orçamento no cabeçalho */
const TETO = 20000
/** passo `P` da grade estratificada, em metros. ⚠️ NÃO É GOSTO, É METADE DA
 *  DESIGUALDADE DE JITTER — ver a nota longa do cabeçalho sobre o artefato
 *  de transparência: com a maior diagonal do catálogo D = 3,04 m, o jitter
 *  seguro é r ≤ (P − D) / 2. P = 4,0 m só permitia r ≤ 0,48 m, pouco demais
 *  pra apagar a régua da grade; P = 6,0 m libera r ≤ 1,48 m. */
const PASSO = 6.0
/** raio de jitter dentro da célula, em metros: r ≤ (PASSO − D) / 2 =
 *  (6,0 − 3,04) / 2 = 1,48 m; usa-se 1,40 m, com 0,08 m de folga sobre o
 *  limite teórico pra absorver o arredondamento de ponto flutuante do
 *  seno/cosseno da amostragem em disco. Sai do MESMO hash da posição
 *  (salts 9 e 10 de `hashCelula`): estável entre sessões, como todo o resto. */
const JITTER_R = 1.40
/** raio de partida do anel de detalhe. NÃO MEDIDO como constante de cena —
 *  ver a nota em DecalquesOpts.raio. */
const RAIO_PADRAO = 300
/** a câmera precisa andar isto pra lista de decalques ser refeita. Maior que
 *  o PASSO_REFAZ de 30 m do mobiliário (mobiliario-urbano.ts) porque o
 *  laço daqui varre uma grade contínua (ver o orçamento no relatório), não
 *  uma lista de postes já filtrada por avenida: NÃO MEDIDO o custo real de
 *  um refazimento, este número é uma escolha conservadora, não uma medição. */
const PASSO_REFAZ = 40
/** largura da faixa de poeira/sujeira fora da via, medida a partir do fio da
 *  via (folga positiva de `naVia`). Não é medição de campo, é escala de
 *  desenho: a sarjeta em V do Bloco B mede 0,30 m e o meio-fio 0,15 m: uma
 *  faixa de acúmulo de 1,6 m cobre os dois e ainda pega um pouco do
 *  passeio, que é onde poeira de sarjeta de verdade se deposita. */
const FOLGA_BORDA = 1.6

// ── densidade por zona, em fração de candidato aprovado (0..1) ────────────
// ⚠️ REAJUSTADA JUNTO COM O PASSO DA GRADE (4,0 m → 6,0 m, ver PASSO acima):
// área por célula sobe (6,0/4,0)² = 2,25×, então a densidade sobe 2,25×
// junto, pra manter a MESMA quantidade de decalque por metro quadrado que o
// valor antigo já orçava (0,05 → 0,1125, 0,35 → 0,7875, 0,01 → 0,0225). NÃO
// MEDIDO EM CHAPA — a proporção entre zonas continua a mesma escolha de
// antes: borda mais densa porque poeira de sarjeta é quase contínua na vida
// real, regolito aberto mais raro porque rastro e ejecta são acidente, não
// textura.
const DENSIDADE: Record<Zona, number> = { via: 0.1125, borda: 0.7875, regolito: 0.0225 }

type Zona = 'via' | 'borda' | 'regolito'

/** as três superfícies finas que `sobreQue` (vias.ts, ainda não publicada)
 *  vai devolver. Ver a nota em DecalquesOpts.sobreQue. */
export type Superficie = 'pista' | 'sarjeta' | 'calcada'

interface TipoDecal {
  nome: string
  /** índice da célula na grade 4×4 do atlas, 0..15 */
  cel: number
  zona: Zona
  /** onde este tipo nasce quando `sobreQue` está disponível — ver a nota em
   *  DecalquesOpts.sobreQue. Os três tipos de regolito (rastro, trilha,
   *  ejecta) não declaram: `sobreQue` só classifica ponto QUE ESTÁ em via, e
   *  esses três nunca estão. */
  superficies?: Superficie[]
  /** footprint em metros, ANTES da variação de escala por instância */
  sx: number
  sz: number
  /** pinta um texel do atlas: (u,v) em 0..1 dentro da própria célula */
  pintar: (u: number, v: number) => Amostra
}

interface Amostra { a: number; r: number; g: number; b: number }

// ── ruído local, duplicado de propósito ────────────────────────────────
// A mesma dupla hash2/vnoise de materiais.ts, mas SEM o `per` periódico: lá
// ele existe pra a textura dar a volta e ladrilhar sem costura; aqui cada
// receita é um carimbo ÚNICO dentro da própria célula, nunca repetido lado a
// lado consigo mesmo, então não há emenda pra costurar. Duplicada porque
// materiais.ts não a exporta (mesma razão que lotes.ts dava pro seu hash01).
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
}
function fbm(x: number, y: number, oct: number): number {
  let s = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); norm += amp; amp *= 0.5; f *= 2 }
  return s / norm
}
function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
function mistura(a: number, b: number, t: number): number { return a + (b - a) * t }

// ── determinismo por célula de mundo: sem estado, sem carga ──────────────
// A mesma cidade em toda visita, sem nada salvo: o hash da célula (ci, cj) é
// a única fonte de aleatoriedade. `salt` separa presença, tipo, rotação,
// escala, espelho e tinta na MESMA célula sem eles colidirem.
function hashCelula(ci: number, cj: number, salt: number): number {
  let h = (ci * 374761393 + cj * 668265263 + salt * 2246822519) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// ── as doze receitas ───────────────────────────────────────────────────
// Cada uma devolve alfa (0 fora do decalque, 1 no miolo) e cor linear 0..255.
// A cor sai multiplicada pela tinta da instância no fragmento; o alfa NUNCA
// é tocado pela instância, só pela receita — "o alfa vem do atlas".

function tRemendoA(u: number, v: number): Amostra {
  const dx = u - 0.5, dz = v - 0.5
  const ang = Math.atan2(dz, dx)
  const perturb = fbm(Math.cos(ang) * 2.4 + 4, Math.sin(ang) * 2.4 + 4, 3)
  const raio = 0.30 + (perturb - 0.5) * 0.14
  const r = Math.hypot(dx, dz)
  const aBase = 1 - smooth(raio - 0.012, raio + 0.012, r)
  // junta de execução: anel escuro por dentro da borda
  const juntaR = raio - 0.035
  const juntaBanda = smooth(juntaR - 0.02, juntaR, r) * (1 - smooth(juntaR, juntaR + 0.02, r))
  const macha = fbm(u * 9, v * 9, 3)
  const tom = 0.85 + macha * 0.3
  const rC = 78 * tom, gC = 74 * tom, bC = 68 * tom
  const t = juntaBanda
  return { a: aBase, r: mistura(rC, 40, t), g: mistura(gC, 38, t), b: mistura(bC, 35, t) }
}

function tRemendoB(u: number, v: number): Amostra {
  // remendo-vala: retângulo arredondado (SDF de caixa com canto), alongado —
  // a marca de valeta reaterrada, diferente da mancha redonda de tRemendoA
  const dx = u - 0.5, dz = v - 0.5
  const hx = 0.40, hz = 0.20
  const qx = Math.abs(dx) - hx, qz = Math.abs(dz) - hz
  const fora = Math.hypot(Math.max(qx, 0), Math.max(qz, 0))
  const dentro = Math.min(Math.max(qx, qz), 0)
  const perturb = (fbm(u * 12, v * 12, 2) - 0.5) * 0.03
  const d = fora + dentro - 0.03 - perturb
  const aBase = 1 - smooth(-0.01, 0.01, d)
  const junta = smooth(-0.03, -0.012, d) * (1 - smooth(-0.012, 0.006, d))
  const macha = fbm(u * 7 + 5, v * 7 + 5, 3)
  const tom = 0.85 + macha * 0.3
  const rC = 76 * tom, gC = 72 * tom, bC = 66 * tom
  const t = junta
  return { a: aBase, r: mistura(rC, 40, t), g: mistura(gC, 38, t), b: mistura(bC, 35, t) }
}

function tJuntaA(u: number, v: number): Amostra {
  const onda = (fbm(v * 6, 0.5, 2) - 0.5) * 0.04
  const distJunta = Math.abs((u - 0.5) - onda)
  const aJunta = 1 - smooth(0.006, 0.016, distJunta)
  // ramo secundário diagonal, só na metade de cima da célula
  const dx2 = (u - 0.5) - (v - 0.5) * 0.6
  const jitter2 = (fbm(v * 9 + 11, u * 9 + 11, 3) - 0.5) * 0.05
  const distTrinca = Math.abs(dx2 - jitter2)
  const presenca = v > 0.5 ? 1 : 0
  const aTrinca = presenca * (1 - smooth(0.004, 0.010, distTrinca))
  const a = Math.max(aJunta, aTrinca)
  return { a, r: 32, g: 31, b: 29 }
}

function tTrincaB(u: number, v: number): Amostra {
  // trinca de retração solta, só ramificada, sem a junta reta
  const meandro = (fbm(v * 5, 2.0, 3) - 0.5) * 0.5
  const xCentro = 0.5 + meandro
  let d = Math.abs(u - xCentro)
  if (v > 0.55) {
    const xRamo = xCentro + (v - 0.55) * 0.9
    d = Math.min(d, Math.abs(u - xRamo))
  }
  const a = 1 - smooth(0.006, 0.018, d)
  return { a, r: 30, g: 30, b: 32 }
}

function tTampa(u: number, v: number): Amostra {
  const dx = u - 0.5, dz = v - 0.5
  const r = Math.hypot(dx, dz)
  const raioBase = 0.46
  const aBase = 1 - smooth(raioBase - 0.01, raioBase + 0.01, r)
  const ang = Math.atan2(dz, dx)
  const nervuras = 0.5 + 0.5 * Math.sin(ang * 14)
  const aneis = 0.5 + 0.5 * Math.sin(r * 70)
  const relevo = nervuras * 0.5 + aneis * 0.5
  const tom = 0.55 + relevo * 0.30
  const rC = 64 * tom, gC = 62 * tom, bC = 58 * tom
  const aro = smooth(raioBase - 0.09, raioBase - 0.06, r)
  return { a: aBase, r: mistura(rC, rC * 0.7, aro), g: mistura(gC, gC * 0.7, aro), b: mistura(bC, bC * 0.7, aro) }
}

function tGrelha(u: number, v: number): Amostra {
  const dx = Math.abs(u - 0.5), dz = Math.abs(v - 0.5)
  const aBox = (1 - smooth(0.44, 0.45, dx)) * (1 - smooth(0.40, 0.41, dz))
  const barra = Math.abs(((u * 11) % 1) - 0.5)
  const vao = barra < 0.20
  const tom = vao ? 0.42 * 0.35 : 0.42
  const gray = 70 * tom
  return { a: aBox, r: gray, g: gray, b: gray * 1.02 }
}

function tCaixa(u: number, v: number): Amostra {
  const dx = Math.abs(u - 0.5), dz = Math.abs(v - 0.5)
  const aBox = (1 - smooth(0.42, 0.432, dx)) * (1 - smooth(0.42, 0.432, dz))
  const seam = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5)) < 0.01 ? 1 : 0
  const cantos: [number, number][] = [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]
  let bolt = 0
  for (const [cx, cz] of cantos) if (Math.hypot(u - cx, v - cz) < 0.025) bolt = 1
  const tom = 0.82 - seam * 0.28 - bolt * 0.35
  const gray = 150 * tom
  return { a: aBox, r: gray, g: gray * 0.99, b: gray * 0.95 }
}

function tPoeira(u: number, v: number): Amostra {
  // mais forte perto do meio-fio (u pequeno), esvaece pro passeio
  const grad = 1 - smooth(0.1, 0.85, u)
  const mancha = fbm(u * 6, v * 6, 3)
  const a = Math.max(0, Math.min(1, grad * 0.75 + (mancha - 0.5) * 0.25))
  const tom = 0.9 + mancha * 0.2
  return { a, r: 118 * tom, g: 112 * tom, b: 104 * tom }
}

function tRastro(u: number, v: number): Amostra {
  const fadeV = smooth(0.03, 0.14, v) * (1 - smooth(0.86, 0.97, v))
  const ruido = fbm(u * 20, v * 6, 2)
  const banda = Math.min(Math.abs(u - 0.35), Math.abs(u - 0.65))
  const a = fadeV * (1 - smooth(0.05 + ruido * 0.02, 0.09 + ruido * 0.02, banda))
  return { a, r: 75, g: 72, b: 67.5 }
}

function tTrilha(u: number, v: number): Amostra {
  const meandro = (fbm(v * 4, 1.0, 3) - 0.5) * 0.18
  const centro = 0.5 + meandro
  const largura = 0.14 + fbm(v * 8, 3.0, 2) * 0.04
  const d = Math.abs(u - centro)
  const fadeV = smooth(0.04, 0.18, v) * (1 - smooth(0.82, 0.96, v))
  const a = fadeV * (1 - smooth(largura * 0.7, largura, d))
  const tom = 1.06
  return { a, r: 118 * tom, g: 113 * tom, b: 105 * tom }
}

function tEjecta(u: number, v: number): Amostra {
  const dx = u - 0.5, dz = v - 0.5
  const r = Math.hypot(dx, dz)
  const ang = Math.atan2(dz, dx)
  const raios = 0.5 + 0.5 * Math.sin(ang * 9 + fbm(ang * 2, 0.7, 2) * 6)
  const anel = smooth(0.06, 0.20, r) * (1 - smooth(0.34, 0.48, r))
  const a = Math.max(0, anel * (0.4 + raios * 0.6))
  const tom = 1.18
  return { a, r: 118 * tom, g: 112 * tom, b: 104 * tom }
}

function tFaixa(u: number, v: number): Amostra {
  const dz = Math.abs(v - 0.5)
  const aBanda = 1 - smooth(0.30, 0.32, dz)
  // desgaste: gasta perto da trilha de roda (u baixo), inteira no acostamento (u alto)
  const erosaoBase = mistura(0.35, 0.95, smooth(0.15, 0.85, u))
  const ruido = fbm(u * 14, v * 14, 3)
  const cobre = ruido < erosaoBase ? 1 : 0
  const tom = 0.92 + ruido * 0.16
  return { a: aBanda * cobre, r: 215 * tom, g: 205 * tom, b: 175 * tom }
}

// ── o catálogo, com o índice de célula do atlas 4×4 (0..15) e a(s)
// superfície(s) fina(s) onde cada tipo nasce quando `sobreQue` existir ─────
const TIPOS: TipoDecal[] = [
  { nome: 'remendo',      cel: 0,  zona: 'via',      superficies: ['pista'],   sx: 1.6,  sz: 1.6,  pintar: tRemendoA },
  { nome: 'junta',        cel: 1,  zona: 'via',      superficies: ['calcada'], sx: 1.8,  sz: 1.8,  pintar: tJuntaA },
  { nome: 'tampa',        cel: 2,  zona: 'via',      superficies: ['pista'],   sx: 0.75, sz: 0.75, pintar: tTampa },
  { nome: 'grelha',       cel: 3,  zona: 'via',      superficies: ['sarjeta'], sx: 0.9,  sz: 0.45, pintar: tGrelha },
  { nome: 'caixa',        cel: 4,  zona: 'via',      superficies: ['calcada'], sx: 0.6,  sz: 0.6,  pintar: tCaixa },
  { nome: 'poeira',       cel: 5,  zona: 'borda',    superficies: ['sarjeta'], sx: 2.2,  sz: 1.0,  pintar: tPoeira },
  { nome: 'rastro',       cel: 6,  zona: 'regolito',                          sx: 2.6,  sz: 1.4,  pintar: tRastro },
  { nome: 'trilha',       cel: 7,  zona: 'regolito',                          sx: 2.0,  sz: 1.2,  pintar: tTrilha },
  { nome: 'ejecta',       cel: 8,  zona: 'regolito',                          sx: 1.3,  sz: 1.3,  pintar: tEjecta },
  { nome: 'faixa',        cel: 9,  zona: 'via',      superficies: ['pista'],   sx: 3.0,  sz: 0.5,  pintar: tFaixa },
  { nome: 'remendo-vala', cel: 10, zona: 'via',      superficies: ['pista'],   sx: 2.4,  sz: 1.0,  pintar: tRemendoB },
  { nome: 'trinca',       cel: 11, zona: 'via',      superficies: ['calcada'], sx: 1.4,  sz: 1.4,  pintar: tTrincaB },
]
// células 12..15 do atlas ficam em branco (alfa 0): reserva pro próximo tipo
// que entrar no catálogo, sem precisar redimensionar o atlas.
const GRID = 4
const CEL_PX = 512
const ATLAS_PX = GRID * CEL_PX

const POR_ZONA: Record<Zona, TipoDecal[]> = {
  via: TIPOS.filter((t) => t.zona === 'via'),
  borda: TIPOS.filter((t) => t.zona === 'borda'),
  regolito: TIPOS.filter((t) => t.zona === 'regolito'),
}

/** ⚠️ PONTA PREPARADA PRO `sobreQue` (ver DecalquesOpts.sobreQue), montada
 *  aqui e não dentro do laço de `atualizar`: filtrar `TIPOS` por instância é
 *  8 comparações × milhares de células por refazimento; a tabela pronta é
 *  um lookup. */
const POR_SUPERFICIE: Record<Superficie, TipoDecal[]> = {
  pista: TIPOS.filter((t) => t.superficies?.includes('pista')),
  sarjeta: TIPOS.filter((t) => t.superficies?.includes('sarjeta')),
  calcada: TIPOS.filter((t) => t.superficies?.includes('calcada')),
}

/** gera o atlas 2048×2048 em canvas, uma vez, no boot — igual materiais.ts */
function gerarAtlas(): THREE.CanvasTexture {
  const dados = new Uint8ClampedArray(ATLAS_PX * ATLAS_PX * 4) // zero = transparente
  for (const tipo of TIPOS) {
    const gx = tipo.cel % GRID, gy = Math.floor(tipo.cel / GRID)
    const ox = gx * CEL_PX, oy = gy * CEL_PX
    for (let py = 0; py < CEL_PX; py++) {
      for (let px = 0; px < CEL_PX; px++) {
        const u = (px + 0.5) / CEL_PX, v = (py + 0.5) / CEL_PX
        const s = tipo.pintar(u, v)
        const ix = ((oy + py) * ATLAS_PX + (ox + px)) * 4
        dados[ix] = s.r; dados[ix + 1] = s.g; dados[ix + 2] = s.b
        dados[ix + 3] = Math.max(0, Math.min(255, s.a * 255))
      }
    }
  }
  const cv = document.createElement('canvas')
  cv.width = ATLAS_PX; cv.height = ATLAS_PX
  const ctx = cv.getContext('2d')!
  ctx.putImageData(new ImageData(dados, ATLAS_PX, ATLAS_PX), 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  // ⚠️ CLAMP, NÃO REPEAT: cada célula é uma ilha isolada dentro do atlas; s
  // repetisse, a borda de uma célula puxaria o pixel da vizinha.
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  return tex
}

export function buildDecalques(o: DecalquesOpts): Decalques {
  const group = new THREE.Group()
  group.name = 'decalques'
  const atlasMiB = (ATLAS_PX * ATLAS_PX * 4 * (4 / 3)) / (1024 * 1024)

  if (!DECALQUE_ON) {
    // bandeira desligada: grupo vazio, sem atlas, sem custo nenhum
    return {
      group, instancias: 0, triangulosMax: 0, atlasMiB: 0,
      atualizar() {}, dispose() {},
    }
  }

  if (!o.naVia && !o.sobreQue) {
    console.warn('[decalques] sem `naVia` nem `sobreQue`: só a zona regolito nasce (rastro, trilha, ejecta); ' +
      'remendo, junta, tampa, grelha, caixa, faixa e poeira dependem de uma das duas')
  }
  const naVia = o.naVia
  const sobreQue = o.sobreQue
  const RAIO = o.raio ?? RAIO_PADRAO

  const atlas = gerarAtlas()

  const base = new THREE.PlaneGeometry(1, 1)
  base.rotateX(-Math.PI / 2) // deitado, normal pra cima; ver lotes.ts
  const geo = new THREE.InstancedBufferGeometry()
  geo.setIndex(base.getIndex())
  geo.setAttribute('position', base.getAttribute('position'))
  geo.setAttribute('normal', base.getAttribute('normal'))
  geo.setAttribute('uv', base.getAttribute('uv'))

  const iOff = new Float32Array(TETO * 2)
  const iY = new Float32Array(TETO)
  const iGrad = new Float32Array(TETO * 2)
  const iRot = new Float32Array(TETO)
  const iSize = new Float32Array(TETO * 2)
  const iCel = new Float32Array(TETO)
  const iFlip = new Float32Array(TETO)
  const iTint = new Float32Array(TETO * 3)
  const attrOff = new THREE.InstancedBufferAttribute(iOff, 2); attrOff.setUsage(THREE.DynamicDrawUsage)
  const attrY = new THREE.InstancedBufferAttribute(iY, 1); attrY.setUsage(THREE.DynamicDrawUsage)
  const attrGrad = new THREE.InstancedBufferAttribute(iGrad, 2); attrGrad.setUsage(THREE.DynamicDrawUsage)
  const attrRot = new THREE.InstancedBufferAttribute(iRot, 1); attrRot.setUsage(THREE.DynamicDrawUsage)
  const attrSize = new THREE.InstancedBufferAttribute(iSize, 2); attrSize.setUsage(THREE.DynamicDrawUsage)
  const attrCel = new THREE.InstancedBufferAttribute(iCel, 1); attrCel.setUsage(THREE.DynamicDrawUsage)
  const attrFlip = new THREE.InstancedBufferAttribute(iFlip, 1); attrFlip.setUsage(THREE.DynamicDrawUsage)
  const attrTint = new THREE.InstancedBufferAttribute(iTint, 3); attrTint.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('iOff', attrOff)
  geo.setAttribute('iY', attrY)
  geo.setAttribute('iGrad', attrGrad)
  geo.setAttribute('iRot', attrRot)
  geo.setAttribute('iSize', attrSize)
  geo.setAttribute('iCel', attrCel)
  geo.setAttribute('iFlip', attrFlip)
  geo.setAttribute('iTint', attrTint)
  geo.instanceCount = 0
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9200) // frustumCulled=false: inerte, só por segurança

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.92,
    metalness: 0,
    // ⚠️ transparent+depthWrite:false é seguro aqui porque a grade
    // estratificada com jitter limitado garante que duas instâncias nunca
    // compartilham fragmento — ver a nota longa do cabeçalho.
    transparent: true,
    depthWrite: false,
  })
  mat.name = 'decalque'
  mat.map = atlas
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        /* glsl */`
        #include <common>
        attribute vec2 iOff;
        attribute float iY;
        attribute vec2 iGrad;
        attribute float iRot;
        attribute vec2 iSize;
        attribute float iCel;
        attribute float iFlip;
        attribute vec3 iTint;
        varying vec3 vTint;
        `,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */`
        // a normal é a tangente do plano tiltado pelo gradiente local, já em
        // eixos de MUNDO (iGrad foi amostrado em X/Z de mundo na CPU, ao
        // contrário de lotes.ts que precisava desgirar a normal local do
        // lote — aqui não há giro pra desfazer).
        vec3 objectNormal = normalize(vec3(-iGrad.x, 1.0, -iGrad.y));
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */`
        float lc = cos(iRot);
        float ls = sin(iRot);
        vec2 lm = position.xz * iSize;
        vec2 off = vec2(lm.x * lc + lm.y * ls, -lm.x * ls + lm.y * lc);
        vec2 wxz = iOff + off;
        // o plano segue a TANGENTE local (gradiente), não um valor achatado:
        // ver a conta do cabeçalho (tan 6,11° × 1 m ≈ 10,7 cm sem tilt).
        float hy = iY + iGrad.x * off.x + iGrad.y * off.y;
        vec3 transformed = vec3(wxz.x, hy + ${ALTURA_DECALQUE.toFixed(3)}, wxz.y);
        vTint = iTint;
        // ⚠️ UV REESCRITO AQUI, DEPOIS DE uv_vertex, como em lotes.ts: o
        // índice de célula escolhe o quadrante 4×4 do atlas, o espelho troca
        // U antes de entrar no atlas.
        float _gx = mod(iCel + 0.5, ${GRID.toFixed(1)});
        float _gy = floor((iCel + 0.5) / ${GRID.toFixed(1)});
        vec2 uvLocal = uv;
        if (iFlip > 0.5) uvLocal.x = 1.0 - uvLocal.x;
        #ifdef USE_MAP
          vMapUv = (vec2(_gx, _gy) + uvLocal) / ${GRID.toFixed(1)};
        #endif
        `,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */`
        #include <common>
        varying vec3 vTint;
        `,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */`
        #include <map_fragment>
        // a cor sai do atlas (mesmo o alfa); a tinta só multiplica o RGB.
        diffuseColor.rgb *= vTint;
        `,
      )
  }
  mat.customProgramCacheKey = () => 'dogcity:decalque'

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'decalques:quad'
  mesh.frustumCulled = false
  mesh.receiveShadow = o.sombra ?? true
  mesh.castShadow = false
  // desenha depois do chão (terreno/via/lote, que usam renderOrder 0 ou 1)
  mesh.renderOrder = 2
  group.add(mesh)

  console.log(
    `[decalques] atlas ${ATLAS_PX}×${ATLAS_PX} (${GRID}×${GRID} células de ${CEL_PX}²), ` +
    `${TIPOS.length} tipos, ${atlasMiB.toFixed(1)} MiB com mipmap, teto ${TETO.toLocaleString('pt-BR')} ` +
    `instâncias (${(TETO * 2).toLocaleString('pt-BR')} triângulos), 1 material, 1 chamada` +
    `${DECALQUE_ON ? '' : ' (bandeira desligada, nada nasce)'}`,
  )

  // ── amostra de altura+gradiente por célula, com cache entre chamadas ────
  // ⚠️ O CACHE NÃO É LIMPO ENTRE `atualizar`, DE PROPÓSITO. A câmera anda
  // aos poucos e a área varrida se sobrepõe muito de uma chamada pra outra
  // (PASSO_REFAZ = 40 m contra um raio de varredura de RAIO); reamostrar a
  // mesma célula de novo seria `heightAt` jogado fora. NÃO MEDIDO quanto o
  // cache economiza; ele só é limpo se crescer demais (ver o teto abaixo).
  const cacheAltura = new Map<number, { h: number; dx: number; dz: number }>()
  const CACHE_TETO = 200000
  const amostrarAltura = (ci: number, cj: number, wx: number, wz: number) => {
    const chave = (ci + 65536) * 131072 + (cj + 65536)
    const visto = cacheAltura.get(chave)
    if (visto) return visto
    if (cacheAltura.size > CACHE_TETO) cacheAltura.clear()
    const h0 = o.heightAt(wx, wz)
    const hx = o.heightAt(wx + PASSO_GRAD, wz)
    const hz = o.heightAt(wx, wz + PASSO_GRAD)
    const r = { h: h0, dx: (hx - h0) / PASSO_GRAD, dz: (hz - h0) / PASSO_GRAD }
    cacheAltura.set(chave, r)
    return r
  }

  const alvo = new THREE.Vector3()
  const camAnterior = new THREE.Vector3(1e9, 1e9, 1e9)
  let primeira = true
  let instancias = 0

  function atualizar(camera: THREE.Camera) {
    camera.getWorldPosition(alvo)
    if (!primeira && alvo.distanceToSquared(camAnterior) < PASSO_REFAZ * PASSO_REFAZ) return
    primeira = false
    camAnterior.copy(alvo)

    // ⚠️ GRADE ANCORADA NA ORIGEM DO MUNDO (ci = round(x/PASSO)), NÃO NA
    // CÂMERA: se a grade se movesse com a câmera, a célula de cada ponto do
    // mundo mudaria a cada refazimento e a "colocação determinística por
    // célula" do cabeçalho deixaria de valer entre uma chamada e a próxima.
    // O jitter (ver a nota longa do cabeçalho) desloca o CENTRO dentro da
    // célula; a célula em si continua fixa no mundo.
    //
    // ⚠️ ARITMÉTICA DE CÉLULAS VARRIDAS, RECALCULADA PRO PASSO DE 6 m: com
    // RAIO = 300 m, reach = ceil(300 / 6,0) = 50; a caixa varrida é
    // (2·50+1)² = 10.201 células, das quais ficam dentro do círculo
    // π·50² ≈ 7.854 (contra ≈17.671 no passo antigo de 4 m — a grade mais
    // larga varre MENOS, não mais). TETO = 20.000 continua sendo só o teto
    // de segurança: com ≈7.854 células candidatas por refazimento e
    // densidade máxima de 78,75% (zona 'borda'), o pior caso teórico
    // (~6.185 instâncias se TODA célula varrida caísse na zona mais densa)
    // já fica bem abaixo do teto — TETO nunca deveria ser o fator limitante
    // na prática. NÃO MEDIDO em navegador.
    const reach = Math.ceil(RAIO / PASSO)
    const cx = Math.round(alvo.x / PASSO)
    const cz = Math.round(alvo.z / PASSO)
    const r2max = RAIO * RAIO

    let k = 0
    for (let di = -reach; di <= reach && k < TETO; di++) {
      for (let dj = -reach; dj <= reach && k < TETO; dj++) {
        const ci = cx + di, cj = cz + dj

        // ⚠️ AMOSTRAGEM UNIFORME EM DISCO: ângulo de um hash, raio de
        // `JITTER_R · √h` do outro. `JITTER_R · h`, sem raiz, empilharia
        // ponto perto do centro, porque área cresce com o raio ao quadrado.
        const ang = hashCelula(ci, cj, 9) * Math.PI * 2
        const rad = JITTER_R * Math.sqrt(hashCelula(ci, cj, 10))
        const wx = ci * PASSO + Math.cos(ang) * rad
        const wz = cj * PASSO + Math.sin(ang) * rad

        // ⚠️ O TESTE DE RAIO USA A POSIÇÃO JÁ JITTERADA, não o centro da
        // célula: é o ponto onde o decalque REALMENTE nasce que precisa
        // caber no anel de detalhe, não a âncora da grade.
        const ddx = wx - alvo.x, ddz = wz - alvo.z
        if (ddx * ddx + ddz * ddz > r2max) continue

        // ── classificação: `sobreQue` fino primeiro, `naVia` como
        // fallback (ver a nota longa no topo do arquivo e em
        // DecalquesOpts.sobreQue) ──────────────────────────────────────
        let zona: Zona
        const fina: Superficie | null = sobreQue ? sobreQue(wx, wz) : null
        if (fina) {
          zona = 'via'
        } else if (naVia) {
          if (naVia(wx, wz, 0)) zona = 'via'
          else if (naVia(wx, wz, FOLGA_BORDA)) zona = 'borda'
          else zona = 'regolito'
        } else {
          zona = 'regolito'
        }

        // com superfície fina, o balde é por AFINIDADE (só os tipos que
        // nascem em 'pista', 'sarjeta' ou 'calcada'), não a zona larga
        // 'via' inteira; se a superfície não bater com tipo nenhum do
        // catálogo de hoje (não deveria acontecer), cai no balde largo
        // como rede de segurança, pra não perder a instância.
        let candidatos: TipoDecal[]
        if (fina) {
          candidatos = POR_SUPERFICIE[fina]
          if (!candidatos.length) candidatos = POR_ZONA.via
        } else {
          candidatos = POR_ZONA[zona]
        }
        if (!candidatos.length) continue

        const presenca = hashCelula(ci, cj, 1)
        if (presenca > DENSIDADE[zona]) continue

        const hTipo = hashCelula(ci, cj, 2)
        const tipo = candidatos[Math.min(candidatos.length - 1, Math.floor(hTipo * candidatos.length))]

        const g = amostrarAltura(ci, cj, wx, wz)
        const hRot = hashCelula(ci, cj, 3)
        const hEsc = hashCelula(ci, cj, 4)
        const hFlip = hashCelula(ci, cj, 5)
        const hT0 = hashCelula(ci, cj, 6), hT1 = hashCelula(ci, cj, 7), hT2 = hashCelula(ci, cj, 8)

        const escala = 0.85 + hEsc * 0.30
        iOff[k * 2] = wx; iOff[k * 2 + 1] = wz
        iY[k] = g.h
        iGrad[k * 2] = g.dx; iGrad[k * 2 + 1] = g.dz
        iRot[k] = hRot * Math.PI * 2
        iSize[k * 2] = tipo.sx * escala; iSize[k * 2 + 1] = tipo.sz * escala
        iCel[k] = tipo.cel
        iFlip[k] = hFlip < 0.5 ? 0 : 1
        const tintJitter = 0.92 + 0.16 * hT0
        iTint[k * 3] = tintJitter
        iTint[k * 3 + 1] = tintJitter * (0.98 + 0.04 * hT1)
        iTint[k * 3 + 2] = tintJitter * (0.97 + 0.05 * hT2)
        k++
      }
    }

    instancias = k
    geo.instanceCount = k
    attrOff.needsUpdate = true
    attrY.needsUpdate = true
    attrGrad.needsUpdate = true
    attrRot.needsUpdate = true
    attrSize.needsUpdate = true
    attrCel.needsUpdate = true
    attrFlip.needsUpdate = true
    attrTint.needsUpdate = true
  }

  return {
    group,
    get instancias() { return instancias },
    triangulosMax: TETO * 2,
    atlasMiB,
    atualizar,
    dispose() {
      base.dispose()
      geo.dispose()
      mat.dispose()
      atlas.dispose()
    },
  }
}
