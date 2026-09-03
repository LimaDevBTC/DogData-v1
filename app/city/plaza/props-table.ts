// A TABELA dos adereços: onde cada modelo de fora entra na praça, e por quê.
// Uma linha por peça; `props.ts` cuida do resto (carga, instância, terreno,
// culling). Os nomes de arquivo são os de `public/city/sf/`, convertidos por
// `blender/fetch_batch.py` a partir de `blender/picks.json`. Todo modelo é
// CC0/CC-BY e está creditado em `sf-assets.ts` (a licença exige).
//
// A REGRA: nada entra por ser bonito. Cada linha diz onde e por quê; as espécies
// de árvore que aqui viram modelo real saem do gerador procedural de
// `precinct.ts` (opção `realTrees`), para não haver duas árvores no mesmo lugar.
import type { PropSpec } from './props'
import {
  onDiagonal, WHITEPAPER_CYPRESSES, SATOSHI_CYPRESSES, ORDINAL_OLIVES, PAW_BLOSSOMS,
  QUADRANT_ANGLE, poolCenter, BOULEVARD_PALMS, DECK_GATE_PALMS, HERO_PALMS, DECK_Y,
} from './garden-plan'
import { R_ANCHOR } from './precinct'
import { PAD_MAIN } from './orbit-layer'
// ⚠️ 03/09: os dois jardins temáticos de `paisagismo.md` §4, atrás da MESMA
// bandeira `?verde=1` que `arborizacao.ts` usa (ver a nota dela em
// `especies.ts`): um valor, um lugar, lido por quem precisar.
import { verde, hash01 } from './especies'

const rad = (d: number) => (d * Math.PI) / 180

/**
 * Altura do topo da laje do complexo de lançamento, acima do regolito.
 *
 * ⚠️ ESTE NÚMERO É MEDIDO, NÃO ESCOLHIDO, e é o mesmo `DECK_TOP` de
 * `blender/build_spaceport.py`: (y do LandingZonePad no mundo) menos (chão por
 * raycast). Hoje 272,1 − 190,4 = 81,7, arredondado para cima em 0,2 para a laje
 * COBRIR o disco preto em vez de brigar com ele por profundidade.
 * Se `SPACEPORT_SHIFT.y` ou o terreno dali mudarem, muda aqui E no .py.
 */
export const SP_DECK_TOP = 81.9

/** um anel de `n` pontos no raio `r`, começando no ângulo `a0` (graus, de +x para +z) */
export function ring(n: number, r: number, a0 = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(a0) + (i / n) * Math.PI * 2
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]
  })
}
/** pontos ao longo de um bulevar cardeal (0 = norte, 90 = leste, 180 = sul, 270 = oeste) */
export function alongBoulevard(deg: number, rs: number[], side = 0): [number, number][] {
  const a = rad(deg)
  return rs.map((r) => [Math.sin(a) * r + Math.cos(a) * side, Math.cos(a) * r - Math.sin(a) * side] as [number, number])
}
/** pontos ao longo de uma alameda diagonal */
export function alongAllee(q: 'NE' | 'NW' | 'SE' | 'SW', rs: number[], side = 0): [number, number][] {
  return rs.map((r) => onDiagonal(q, r, side))
}

/** os bancos do Anel, olhando para dentro (o mesmo lugar dos antigos de caixa) */
const BENCH_RING = ring(24, 452 - 34 / 2 + 3, 7.5)
/** as urnas: nas esquinas dos parterres, entre as portas dos bulevares */
const URNS = ring(16, 332 + 38, 11.25).filter(([x, z]) => Math.abs(Math.sin(2 * Math.atan2(z, x))) > 0.2)

// ── o DECK central (revisão de 2026-08-19: "todos os seus elementos são
// genéricos"). O deck é a laje da praça, em y = DECK_Y; tudo aqui é `lift`
// relativo ao terreno, então cada peça leva `deckLift` para subir do chão do
// regolito (y 0) até a laje. ────────────────────────────────────────────────
const deckLift = DECK_Y
/** os quatro eixos do deck, a `r` do centro */
const deckAxis = (r: number): [number, number][] => [[0, -r], [r, 0], [0, r], [-r, 0]]
/** as diagonais do deck */
const deckDiag = (r: number): [number, number][] => {
  const k = r / Math.SQRT2
  return [[k, -k], [k, k], [-k, k], [-k, -k]]
}

// ═══════════════════════════════════════════════════════════════════════════
// OS DOIS JARDINS TEMÁTICOS (paisagismo.md §4), atrás de `?verde=1`.
//
// ⚠️ AS DUAS COORDENADAS SÃO LOTES DE VERDADE, NÃO INVENÇÃO. `cidade.json`
// (`programa[]`) já reserva "Jardim Botânico" (setor 9, distrito 4, x −1969
// z −705, 30,06 ha) e "Jardim das Coortes" (setor 11, distrito 5, x −699
// z −1954, 28,28 ha): dois lotes de jardim que o gerador desenhou e ninguém
// tinha plantado ainda. Medido em 03/09 lendo o próprio JSON publicado.
//
// ⚠️ SÓ O NÚCLEO DE CADA LOTE RECEBE PEÇA CURADA, NÃO OS 30 HA INTEIROS. Um
// jardim japonês de 30 ha não é um jardim japonês, é um parque com enfeite
// oriental: Portland tem 5,2 ha, Kenrokuen (um dos três grandes do Japão)
// tem 11,4 ha. Aqui o núcleo fica em raio 90 m (2,54 ha) e o resto do lote é
// bosque comum do distrito, plantado pela hierarquia de `especies.ts` como
// qualquer contorno da cidade: é o acento de distrito (§2) que já empurra o
// distrito 4 para `esfera` (quieto) e o distrito 5 para `cone` (fronteira),
// então a moldura em volta do jardim já nasce coerente com o bairro em vez de
// ser um recorte estrangeiro.
//
// ⚠️ 03/09, SEGUNDA RODADA: sete espécies novas chegaram publicadas em
// `public/city/sf/` com crédito em `sf-assets.ts` (outra frente, a pedido do
// item 3 de `paisagismo.md` §6). `tree-black-pine` SUBSTITUI `tree-gnarled`
// no Jardim Japonês (era um substituto genérico, agora é o pinheiro-negro de
// verdade que o pedido descrevia); `bamboo-clump` entra como tela de fundo;
// `banana-tree` e `heliconia` entram no Jardim Tropical; `baobab` vira o
// marco de chegada do Jardim Tropical (silhueta única, tema certo: savana);
// `cedar-lebanon` planta a Alameda dos Fundadores (distrito 2, outro lote
// publicado por `cidade.json` que ninguém tinha ocupado ainda). `tree-pine`
// NÃO entra aqui: a outra frente já a destinou à floresta de conífera do
// maciço de inverno, que é módulo alheio (`alpino.ts`).
//
// ⚠️ ORÇAMENTO: contagem de `materials` no JSON de cada .glb (script de
// 03/09). Jardim Japonês: sakura-hero 3, lamp-stone 1, tree-black-pine 3
// (hero, 1 instância só, nunca alameda: 40.000 tri é classe de exceção),
// bamboo-clump 5 → **12**. Jardim Tropical: palm 3, feto 1, samambaia 1,
// banana-tree 5, heliconia 3 (15.000 tri para 2 m de planta: hero também,
// poucos pontos), baobab 2 → **15**. Alameda dos Fundadores: cedar-lebanon
// 4 → **4**. Total desta entrega: **31 chamadas de desenho novas**, todas
// atrás de `?verde=1` (custo zero na produção sem a bandeira). NÃO ENTROU
// `temple-hall` (9 primitivas): fica no pedido de espécie, "já disponível,
// caro" (`paisagismo.md` §6). `tree-palm.glb` (5 primitivas) também ficou de
// fora: `palm` já cobre o mesmo papel por 3.
/** ponto local (lx ao longo do eixo do jardim, lz perpendicular) para mundo,
 *  girado pelo `rot` do PRÓPRIO lote publicado em `cidade.json`: a
 *  composição interna gira junto com o lote em vez de flutuar em diagonal
 *  sobre ele. */
function noJardim(cx: number, cz: number, rotDeg: number, lx: number, lz: number): [number, number] {
  const r = rad(rotDeg), c = Math.cos(r), s = Math.sin(r)
  return [cx + lx * c - lz * s, cz + lx * s + lz * c]
}
/** um bosque informal de `n` pontos entre `rMin` e `rMax` do eixo do jardim:
 *  nem anel nem grade, porque folhagem tropical e sub-bosque não nascem em
 *  fileira. O hash de `especies.ts` garante posição determinística. */
function bosque(
  cx: number, cz: number, rotDeg: number, n: number, rMin: number, rMax: number, semente: number,
): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = hash01(semente * 131 + i * 7) * Math.PI * 2
    const r = rMin + hash01(semente * 271 + i * 13) * (rMax - rMin)
    return noJardim(cx, cz, rotDeg, Math.cos(a) * r, Math.sin(a) * r)
  })
}

// ── Jardim Botânico → JARDIM JAPONÊS (distrito 4: Memorial, Mercado) ────────
const JB_CX = -1969, JB_CZ = -705, JB_ROT = 289.69
// duas cerejeiras-hero flanqueando a alameda de chegada (peça de 45.000 tri:
// duas, não mais, "hero" é specimen raro, não plantio)
const JB_SAKURA: [number, number][] = [
  noJardim(JB_CX, JB_CZ, JB_ROT, -35, 20),
  noJardim(JB_CX, JB_CZ, JB_ROT, -35, -20),
]
// oito lanternas de pedra ao longo do eixo, alternando lado (mesmo espírito
// da alameda do Jardim Ordinal, `lamp-stone` reaproveitado)
const JB_LAMPS: [number, number][] = [-60, -42, -24, -6, 12, 30, 48, 66].map(
  (lx, i) => noJardim(JB_CX, JB_CZ, JB_ROT, lx, (i % 2 === 0 ? 1 : -1) * 9),
)
// ⚠️ O PINHEIRO-NEGRO SUBSTITUI O `tree-gnarled` QUE ESTAVA AQUI. Antes de
// 03/09 a árvore antiga e retorcida ("tronco lenhoso e retorcido") era o
// substituto disponível para o pedido de `paisagismo.md` §6 item 1 (Pinus
// thunbergii); agora o pinheiro-negro japonês de verdade chegou, e ele é
// classe de exceção (40.000 tri, hero): UMA instância só, no fim do eixo,
// nunca em fileira.
const JB_BLACKPINE: [number, number][] = [noJardim(JB_CX, JB_CZ, JB_ROT, 55, 0)]
// tela de bambu fechando os dois lados do núcleo curado, separando-o do
// bosque comum do distrito sem precisar de muro (o pedido §6 item 2)
const JB_BAMBOO: [number, number][] = [-75, -50, -25, 0, 25, 50, 75].flatMap(
  (lx) => [noJardim(JB_CX, JB_CZ, JB_ROT, lx, 34), noJardim(JB_CX, JB_CZ, JB_ROT, lx, -34)],
)

// ── Jardim das Coortes → JARDIM TROPICAL (distrito 5: Observatório, Cinturão) ─
const JC_CX = -699, JC_CZ = -1954, JC_ROT = 340.31
// dez palmeiras em bosque informal (não fileira): a espécie que NENHUM outro
// lugar da praça usa, para o jardim ter cara própria mesmo com peças velhas
const JC_PALMS = bosque(JC_CX, JC_CZ, JC_ROT, 10, 30, 80, 5501)
// duas camadas de samambaia sob as palmeiras: o mesmo par que já veste a
// floresta das ilhas (`aquario.ts`), aqui como sub-bosque do jardim
const JC_FETO = bosque(JC_CX, JC_CZ, JC_ROT, 14, 15, 70, 6607)
const JC_SAMAMBAIA = bosque(JC_CX, JC_CZ, JC_ROT, 14, 15, 70, 7703)
// bananeiras na camada média, entre o sub-bosque e o dossel das palmeiras
// (pedido §6 item 3)
const JC_BANANA = bosque(JC_CX, JC_CZ, JC_ROT, 8, 20, 60, 8807)
// helicônias como ponto focal de cor perto dos caminhos: 15.000 tri para
// 2 m de planta é orçamento de hero (pedido §6 item 4), por isso só 5 pontos,
// não plantio de canteiro
const JC_HELICONIA: [number, number][] = [
  noJardim(JC_CX, JC_CZ, JC_ROT, -30, 12), noJardim(JC_CX, JC_CZ, JC_ROT, 30, 12),
  noJardim(JC_CX, JC_CZ, JC_ROT, -30, -12), noJardim(JC_CX, JC_CZ, JC_ROT, 30, -12),
  noJardim(JC_CX, JC_CZ, JC_ROT, 0, 24),
]
// o baobá como marco de chegada do Jardim Tropical: silhueta única (savana),
// o tema certo para esta espécie, não um landmark cívico solto
const JC_BAOBA: [number, number][] = [noJardim(JC_CX, JC_CZ, JC_ROT, -70, 0)]

// ── Alameda dos Fundadores (distrito 2: HQ, Museu, Casa da Moeda, Colosso) ──
// Outro lote publicado por `cidade.json` (x −354, z 1777, rot 191,25°, faixa
// de 343,7 × 114,4 m) que ninguém tinha plantado. O cedro do Líbano, copa em
// bandejas horizontais, é a árvore de memorial/fundador em paisagismo real
// (contraste deliberado com o risco vertical da colunar, que já é o acento
// deste distrito): duas duplas flanqueando o eixo.
const AF_CX = -354, AF_CZ = 1777, AF_ROT = 191.25
const AF_CEDROS: [number, number][] = [
  noJardim(AF_CX, AF_CZ, AF_ROT, -120, 20), noJardim(AF_CX, AF_CZ, AF_ROT, -120, -20),
  noJardim(AF_CX, AF_CZ, AF_ROT, 120, 20), noJardim(AF_CX, AF_CZ, AF_ROT, 120, -20),
]
// ⚠️ A SEQUOIA-GIGANTE CHEGOU EM 03/09 (`sequoia.glb`/`sequoia-mass.glb`,
// geradas por código, `blender/build_sequoia.py`, crédito próprio sem CC-BY
// porque não vieram de terceiro): o "Bosque dos Fundadores" que ficava
// pendente aqui agora existe. Duas heros nas pontas da faixa (mais longe do
// centro que os cedros, porque sequoia impressiona por tamanho e quer
// distância para se ler) mais oito baratas em pequenos grupos ao redor de
// cada uma.
const AF_SEQUOIA_HERO: [number, number][] = [
  noJardim(AF_CX, AF_CZ, AF_ROT, -280, 0), noJardim(AF_CX, AF_CZ, AF_ROT, 280, 0),
]
const AF_SEQUOIA_MASSA: [number, number][] = [-280, 280].flatMap((lx) => [
  noJardim(AF_CX, AF_CZ, AF_ROT, lx - 18, 14), noJardim(AF_CX, AF_CZ, AF_ROT, lx + 14, 18),
  noJardim(AF_CX, AF_CZ, AF_ROT, lx - 14, -18), noJardim(AF_CX, AF_CZ, AF_ROT, lx + 18, -14),
])

// ═══════════════════════════════════════════════════════════════════════════
// O JARDIM ITALIANO (paisagismo.md §4.6 a §4.8), atrás de `?verde=1`.
//
// ⚠️ O SÍTIO É MEDIDO, NÃO ESCOLHIDO. "Floresta de Extrativismo" (VP02,
// `cidade.json`, x −5.612 z 3.772, rot 236,1°, 107,52 ha, tipo `floresta`,
// logo não é lote de holder) é a peça do programa com o maior declive real
// medido em 03/09 no heightmap bruto (`public/lunar/btc-core-heightmap.f32`,
// fora do arco do parque de inverno, `?inverno=1`, que fica 12° mais a
// oeste): um trecho de 280 m com queda monótona de 63,6 m, 22,7% de
// declividade média, da ordem da queda real de Villa d'Este (mais de 45 m).
// O eixo (rumo 56,1°, descendo do TOPO para a BASE) aponta, estendido, quase
// exatamente para o centro da cidade: a vista no fim do eixo não foi
// desenhada, é o terreno relido.
//
//   TOPO (entrada, viale dei cipressi): x −6.161  z 3.960  h 113,2 m
//   BASE (belvedere, fim do eixo):      x −5.928  z 3.804  h  49,6 m
//
// Uso só o núcleo (280 × 120 m, 3,36 ha) desse lote de 107,52 ha; o resto
// continua floresta de produção e vira, de graça, o BOSCO que o cânone exige
// (mata informal ao redor do parterre geométrico).
//
// ⚠️ TRÊS ARQUIVOS AQUI (`pine-umbrella`, `buxo-sebe`, `buxo-bola`) AINDA NÃO
// TÊM LINHA DE CRÉDITO EM `sf-assets.ts`. Não é meu arquivo para editar (a
// frente de espécies foi interrompida por limite de sessão no meio do
// trabalho); estão atrás de `?verde=1`, então não aparecem em produção sem a
// bandeira, e a linha de crédito é dado que chega depois da geometria, não
// um bloqueio para desenhar o projeto. Um quarto, `limao-vaso-test`, tem
// sufixo "-teste" no nome: tratado como provisório.
//
// ⚠️ ORÇAMENTO: tree-cypress 2, pine-umbrella 2, buxo-sebe 2, buxo-bola 1,
// limao-vaso-test 2, garden-urn 2, fountain-basin 1 → **12 chamadas de
// desenho novas**, mais as 8 da sequoia acima (`sequoia` 4, `sequoia-mass`
// 4). Contas completas em `paisagismo.md` §7.
const IT_CX = -6160.5, IT_CZ = 3959.9, IT_ROT = 56.1   // TOPO do eixo, rumo descendo para a BASE

/** viale dei cipressi: fileira dupla dos primeiros 80 m do eixo, do TOPO até
 *  a boca do parterre. 6 m de passo, mais fechado que a rua (paisagismo.md
 *  §1): aqui é parede vegetal de chegada, não alameda urbana. */
const IT_VIALE: [number, number][] = Array.from({ length: 14 }, (_, i) => 10 + i * 6).flatMap(
  (la) => [noJardim(IT_CX, IT_CZ, IT_ROT, la, 14), noJardim(IT_CX, IT_CZ, IT_ROT, la, -14)],
)

/** um compartimento do parterre: o contorno (passo `passo`, para `buxo-sebe`)
 *  e os 4 cantos (para `buxo-bola`), em coordenada LOCAL do parterre (antes
 *  de `noJardim`). `cx,cz` é o centro do compartimento, `w,h` a largura e a
 *  profundidade. */
function compartimento(cx: number, cz: number, w: number, h: number, passo: number) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - h / 2, z1 = cz + h / 2
  const contorno: [number, number][] = []
  const nx = Math.max(1, Math.round(w / passo)), nz = Math.max(1, Math.round(h / passo))
  for (let i = 0; i <= nx; i++) { const x = x0 + (w * i) / nx; contorno.push([x, z0], [x, z1]) }
  for (let i = 1; i < nz; i++) { const z = z0 + (h * i) / nz; contorno.push([x0, z], [x1, z]) }
  const cantos: [number, number][] = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]
  return { contorno, cantos }
}

// ⚠️ QUATRO COMPARTIMENTOS, 2×2, CAMINHO CENTRAL DE 6 m (a mesma geometria em
// cruz de Villa Lante: quatro tabuleiros ao redor de um eixo de água). Cada
// compartimento 26 × 22 m, centrado a 100+13=113 e 100+13+6+26=145 m do TOPO
// (a `la` cresce descendo o eixo), lb em ±(3+11)=±14.
const IT_COMPARTIMENTOS = [
  compartimento(113, -14, 26, 22, 2.6), compartimento(145, -14, 26, 22, 2.6),
  compartimento(113, 14, 26, 22, 2.6), compartimento(145, 14, 26, 22, 2.6),
]
const IT_SEBE: [number, number][] = IT_COMPARTIMENTOS.flatMap((c) =>
  c.contorno.map(([la, lb]) => noJardim(IT_CX, IT_CZ, IT_ROT, la, lb)))
const IT_TOPIARIA: [number, number][] = IT_COMPARTIMENTOS.flatMap((c) =>
  c.cantos.map(([la, lb]) => noJardim(IT_CX, IT_CZ, IT_ROT, la, lb)))

/** a limonaia: fileira dupla de limoeiro em vaso flanqueando o trecho do
 *  eixo reservado para a catena d'acqua (a água em si é `lagos.ts`/
 *  `canais.ts`, fora do escopo). 6 pontos por lado, passo 6 m. */
const IT_LIMONAIA: [number, number][] = Array.from({ length: 6 }, (_, i) => 182 + i * 6).flatMap(
  (la) => [noJardim(IT_CX, IT_CZ, IT_ROT, la, 20), noJardim(IT_CX, IT_CZ, IT_ROT, la, -20)],
)

/** as cicas em vaso, em PARES (não fileira, ao contrário do limoeiro): portão
 *  de entrada, as duas quebras de terraço, entrada do belvedere. `cycas-
 *  vaso.glb` ainda não chegou ao disco (paisagismo.md §6.4); a linha entra
 *  mesmo assim porque `loadSf` nunca quebra por asset ausente (sf-assets.ts)
 *  quando o arquivo chegar, esta linha passa a desenhar sem eu tocar em
 *  código de novo. */
const IT_CICAS: [number, number][] = [0, 95, 175, 255].flatMap((la) => [
  noJardim(IT_CX, IT_CZ, IT_ROT, la, 4), noJardim(IT_CX, IT_CZ, IT_ROT, la, -4),
])

/** o bosco: pinheiro-manso em bosque informal (a mesma função `bosque()` do
 *  Jardim Tropical), na faixa mais baixa e mais sombria do eixo, entre o
 *  parterre e o belvedere. Informal de propósito: bosco é o contraste contra
 *  a geometria do parterre, alinhar os dois seria o erro canônico. */
const IT_BOSCO = bosque(IT_CX, IT_CZ, IT_ROT, 14, 200, 260, 9203)

/** o belvedere: moldura da água (reaproveitando `fountain-basin`, a água de
 *  verdade fica pendente) e um par de urnas na borda, olhando para a vista
 *  que o eixo natural já aponta (paisagismo.md §4.6: quase exatamente o
 *  centro da cidade). */
const IT_BELVEDERE_FONTE: [number, number][] = [noJardim(IT_CX, IT_CZ, IT_ROT, 272, 0)]
const IT_BELVEDERE_URNAS: [number, number][] = [
  noJardim(IT_CX, IT_CZ, IT_ROT, 260, 16), noJardim(IT_CX, IT_CZ, IT_ROT, 260, -16),
  noJardim(IT_CX, IT_CZ, IT_ROT, 280, 16), noJardim(IT_CX, IT_CZ, IT_ROT, 280, -16),
]

const JARDINS_TEMATICOS: PropSpec[] = [
  {
    file: 'tree-sakura-hero', why: 'as duas cerejeiras-hero do Jardim Japonês, flanqueando a chegada',
    at: JB_SAKURA, jitter: 0.06, cull: 1800,
  },
  {
    file: 'lamp-stone', why: 'as lanternas de pedra do eixo do Jardim Japonês',
    at: JB_LAMPS, yaw: 'center', scale: 1, cull: 1100, castShadow: false,
  },
  {
    file: 'tree-black-pine', why: 'o pinheiro-negro-japonês, hero único, no fim do eixo do Jardim Japonês',
    at: JB_BLACKPINE, cull: 2000,
  },
  {
    file: 'bamboo-clump', why: 'a tela de bambu que separa o núcleo curado do Jardim Japonês do bosque comum do distrito',
    at: JB_BAMBOO, jitter: 0.15, cull: 1300, castShadow: false,
  },
  {
    file: 'palm', why: 'o bosque de palmeiras do Jardim Tropical: a única espécie de palmeira que nenhum outro lugar da praça usa',
    at: JC_PALMS, jitter: 0.2, cull: 1600,
  },
  {
    file: 'feto', why: 'sub-bosque do Jardim Tropical, sob as palmeiras',
    at: JC_FETO, scale: 1.4, jitter: 0.4, cull: 1400, castShadow: false,
  },
  {
    file: 'samambaia', why: 'segunda camada de sub-bosque do Jardim Tropical, para variar a textura do chão',
    at: JC_SAMAMBAIA, scale: 1.6, jitter: 0.35, cull: 1400, castShadow: false,
  },
  {
    file: 'banana-tree', why: 'a camada média do Jardim Tropical, entre o sub-bosque e o dossel de palmeiras',
    at: JC_BANANA, jitter: 0.25, cull: 1400,
  },
  {
    file: 'heliconia', why: 'os pontos focais de cor do Jardim Tropical, perto dos caminhos: hero, não canteiro',
    at: JC_HELICONIA, jitter: 0.1, cull: 1200, castShadow: false,
  },
  {
    file: 'baobab', why: 'o marco de chegada do Jardim Tropical: a silhueta mais reconhecível do repertório',
    at: JC_BAOBA, cull: 2200,
  },
  {
    file: 'cedar-lebanon', why: 'a Alameda dos Fundadores (distrito 2), lote publicado e ainda vazio: o cedro é a árvore de memorial em paisagismo real',
    at: AF_CEDROS, jitter: 0.08, cull: 2000,
  },
  {
    file: 'sequoia', why: 'o Bosque dos Fundadores: duas sequoias-hero nas pontas da Alameda, mais longe do centro que os cedros',
    at: AF_SEQUOIA_HERO, cull: 2600,
  },
  {
    file: 'sequoia-mass', why: 'a variante barata da sequoia, em pequenos grupos ao redor de cada hero',
    at: AF_SEQUOIA_MASSA, jitter: 0.15, cull: 1800,
  },
  // ── o Jardim Italiano (paisagismo.md §4.6 a §4.8) ──────────────────────────
  {
    file: 'tree-cypress', why: 'o viale dei cipressi do Jardim Italiano, do TOPO até a boca do parterre',
    at: IT_VIALE, jitter: 0.08, cull: 1800,
  },
  {
    file: 'buxo-sebe', why: 'o contorno dos 4 compartimentos do parterre de buxo (crédito pendente em sf-assets.ts, ver paisagismo.md §6.4)',
    at: IT_SEBE, cull: 900, castShadow: false,
  },
  {
    file: 'buxo-bola', why: 'a topiária dos cantos de cada compartimento (crédito pendente)',
    at: IT_TOPIARIA, yaw: 'center', jitter: 0.05, cull: 900, castShadow: false,
  },
  {
    file: 'limao-vaso-test', why: 'a limonaia flanqueando o trecho reservado para a catena d\'acqua (arquivo provisório, sufixo "-teste")',
    at: IT_LIMONAIA, yaw: 'center', jitter: 0.08, cull: 1200,
  },
  {
    file: 'cycas-vaso', why: 'as cicas em par: portão de entrada, as duas quebras de terraço, entrada do belvedere (arquivo ainda não chegou, linha pronta para quando chegar)',
    at: IT_CICAS, yaw: 'center', jitter: 0.06, cull: 1200,
  },
  {
    file: 'pine-umbrella', why: 'o bosco do Jardim Italiano, entre o parterre e o belvedere (crédito pendente)',
    at: IT_BOSCO, jitter: 0.2, cull: 2000,
  },
  {
    file: 'fountain-basin', why: 'a moldura da água no belvedere, no fim do eixo do Jardim Italiano (a água de verdade é lagos.ts/canais.ts, fora do escopo)',
    at: IT_BELVEDERE_FONTE, yaw: 'center', scale: 1.6, cull: 1800,
  },
  {
    file: 'garden-urn', why: 'a borda do belvedere do Jardim Italiano, olhando para a vista que o eixo natural aponta',
    at: IT_BELVEDERE_URNAS, yaw: 'center', jitter: 0.05, cull: 1200,
  },
]

export const PROPS: readonly PropSpec[] = [
  // ── árvores: as espécies com papel (as de copa redonda e os pinheiros seguem
  // procedurais nos setores, que é onde ninguém chega perto) ──────────────────
  {
    file: 'tree-cypress', why: 'a nave do Jardim do White Paper e o crescente do Espelho de Satoshi',
    at: [...WHITEPAPER_CYPRESSES, ...SATOSHI_CYPRESSES], scale: 1, jitter: 0.14, cull: 1800,
  },
  {
    file: 'tree-olive', why: 'o jardim antigo em volta do círculo de runestones (SW)',
    at: ORDINAL_OLIVES, jitter: 0.16, cull: 1500,
  },
  {
    file: 'tree-blossom', why: 'a Pata de Diamante é o único jardim que floresce',
    at: PAW_BLOSSOMS, jitter: 0.18, cull: 1500,
  },
  // ── palmeiras de verdade: as antigas "murchas" saíram (fundador, 2026-08-19) ──
  {
    file: 'palm-date', why: 'as alamedas dos quatro bulevares e os portões do Anel: tamareira cheia e ereta',
    at: [...BOULEVARD_PALMS, ...HERO_PALMS], jitter: 0.12, cull: 1500,
  },
  {
    file: 'palm-tall', why: 'oito palmeiras altas nas quatro portas do deck, para marcar a subida',
    at: DECK_GATE_PALMS, jitter: 0.08, cull: 1700,
  },
  // ── o deck central, DEPOIS DA LIMPEZA (2026-08-19) ─────────────────────────
  // O deck ficou com o que significa: podium, escadarias, colunata e o inlay do
  // Bitcoin no piso. Os obeliscos, a esfera armilar e as taças de Versalhes
  // saíram daqui (aumentavam a confusão que o fundador apontou) e foram para o
  // jardim, onde o vocabulário é esse. No deck fica só o que serve a quem chega:
  {
    file: 'column-doric', why: 'a colunata do deck: 36 colunas dóricas na borda, no lugar dos cones brancos do GLB',
    at: ring(28, 250, 6.4), lift: deckLift, jitter: 0.03, cull: 3200,
  },
  {
    file: 'torch-pillar', why: 'oito pilares com fogo, aos pares no topo das quatro escadarias',
    at: [
      ...alongBoulevard(0, [286], -22), ...alongBoulevard(0, [286], 22),
      ...alongBoulevard(90, [286], -22), ...alongBoulevard(90, [286], 22),
      ...alongBoulevard(180, [286], -22), ...alongBoulevard(180, [286], 22),
      ...alongBoulevard(270, [286], -22), ...alongBoulevard(270, [286], 22),
    ],
    yaw: 'center', scale: 3.4, lift: deckLift, cull: 3000,
  },
  {
    file: 'brazier', why: 'quatro braseiros em volta do inlay do Bitcoin, no piso do deck',
    at: deckDiag(150), yaw: 'center', scale: 3.2, lift: deckLift, cull: 2200,
  },
  {
    file: 'btc-atm', why: 'dois caixas de BTC no topo da escadaria norte, onde se chega ao deck',
    at: [[-14, -196], [14, -196]], yaw: 'center', lift: deckLift, cull: 1200, castShadow: false,
  },
  // ── as peças que saíram do deck, agora no jardim ──────────────────────────
  {
    file: 'armillary', why: 'a esfera armilar no eixo do jardim norte, antes da Grande Fonte',
    at: [[0, -520]], yaw: 'center', scale: 3.0, lift: 1.5, cull: 1600,
  },
  {
    file: 'pedestal', why: 'a base da esfera armilar',
    at: [[0, -520]], scale: 1.5, cull: 1600,
  },
  {
    file: 'deck-colonnade', why: 'as duas taças de Versalhes nas portas leste e oeste do jardim',
    at: [[520, 0], [-520, 0]], yaw: 'center', scale: 0.62, cull: 1600,
  },
  // ── as árvores emblemáticas (item 11): poucas, boas, com silhueta própria ──
  // Das seis que o garimpo trouxe, três não eram árvore inteira (dois scans de
  // tronco sem copa e uma cerejeira pela metade) e foram recusadas na folha de
  // contato. Ficaram as três que se sustentam de perto.
  {
    file: 'tree-maple', why: 'bordos japoneses ao longo da alameda do Jardim Ordinal: a única cor quente do jardim',
    at: [...alongAllee('SW', [560, 600, 640, 680], 26), ...alongAllee('SW', [560, 600, 640, 680], -26)],
    jitter: 0.12, cull: 1400,
  },
  {
    file: 'tree-medit', why: 'a árvore de copa do cinturão interno, no lugar das copas procedurais de perto',
    at: ring(20, 392, 9), jitter: 0.16, cull: 1600,
  },
  {
    file: 'tree-gnarled', why: 'três árvores antigas, retorcidas, junto à Grande Fonte do norte: as mais velhas da praça',
    at: [[-58, -556], [64, -572], [-14, -604]], jitter: 0.1, cull: 1600,
  },
  // ── água ────────────────────────────────────────────────────────────────────
  {
    file: 'fountain-grand', why: 'a Grande Fonte do norte, no lugar da quarta âncora: escultura no eixo',
    at: [[0, -R_ANCHOR]], yaw: 'center', scale: 2.6, lift: 2.2, cull: 4000, envMapIntensity: 1.3,
  },
  {
    file: 'fountain-basin', why: 'um chafariz no meio dos espelhos do norte e do oeste (o do DOG fica livre: a marca é o assunto)',
    at: [poolCenter('NE'), poolCenter('SW'), poolCenter('NW')], yaw: 'center', scale: 2.4, lift: 0.3, cull: 2200,
  },
  {
    file: 'garden-urn', why: 'urnas nas esquinas dos parterres, o vocabulário do jardim de palácio',
    at: URNS, yaw: 'center', scale: 1, jitter: 0.06, cull: 1100,
  },
  // ── o que se senta e o que ilumina ─────────────────────────────────────────
  {
    file: 'bench-classic', why: 'os bancos do Anel, olhando para o deck',
    at: BENCH_RING, yaw: 'center', cull: 1000, castShadow: false,
  },
  {
    file: 'lamp-stone', why: 'lanternas de pedra ao longo da alameda do Jardim Ordinal',
    at: [...alongAllee('SW', [500, 540, 580, 620, 660, 700], 11), ...alongAllee('SW', [500, 540, 580, 620, 660, 700], -11)],
    scale: 1, cull: 1100, castShadow: false,
  },
  // ── o spaceport: torre, tanques e antenas ──────────────────────────────────
  // ⚠️ AS TRÊS ESCALAS DOBRARAM EM 01/09, E NÃO POR GOSTO: elas ACOMPANHAM o
  // foguete. `sizeFor()` em orbit-layer.ts saiu da faixa 16 a 60 m para 32 a
  // 120 m porque a nave sumia vista da praça, a 5.150 m do pad (a conta está
  // escrita lá). Escala é RELAÇÃO: dobrar só a nave deixaria a torre de
  // lançamento com metade da altura do que ela serve, e torre menor que o
  // foguete lê como erro antes de qualquer outra coisa no quadro.
  //
  // Alturas nativas medidas no bbox dos GLB: strongback 58 m, tanque 12 m,
  // antena por conferir. Com escala 2 a torre vai a 116 m, logo abaixo dos 120 m
  // do maior foguete, que é a proporção certa: a torre serve a nave e não
  // compete com ela.
  // ── O COMPLEXO DE LANÇAMENTO (2026-09-02) ─────────────────────────────────
  // ⚠️ O DISCO PRETO DO PÁTIO FLUTUA 82 m ACIMA DO REGOLITO, e era isso que
  // fazia o conjunto ler como maquete de papel a 430 m. Medido importando
  // `public/city/spaceport.glb` no Blender: LandingZonePad está em y 76,7 no
  // espaço do modelo, mais `SPACEPORT_SHIFT.y` (195,4) dá 272,1 no mundo,
  // contra 190,4 de chão por raycast no regolito. Delta 81,7.
  //
  // `sp-complex.glb` (blender/build_spaceport.py) constrói NESSE VAZIO: pátio
  // de concreto, mesa sobre 16 pilares contraventados, laje com goela para o
  // foguete, fosso de chamas com defletor, queimado e poeira soprada no chão,
  // tubulação sobre cavalete vindo do parque de tanques, quatro mastros de
  // 150 m, cerca, portão iluminado, estrada de serviço e três carretas.
  // 6.486 triângulos, 4 materiais, ou seja 4 chamadas de desenho.
  //
  // ⚠️ ELE ENTRA COM UM ÚNICO PONTO EM `at`, DE PROPÓSITO. `props.ts` só
  // instancia quando há mais de um ponto; com um ponto ele clona a raiz e a
  // peça inteira fica rígida, nivelada por si, apoiada em UM valor de
  // `heightAt`. Espalhar o complexo em várias linhas o deixaria escadeado pelo
  // declive de 0,93% do platô.
  {
    file: 'sp-complex', why: 'a mesa de lançamento sobre pilares, o fosso de chamas e tudo que dá escala ao pátio',
    // cull 9000 e não mais: o centro da praça está a 11,2 km do pad, então o
    // complexo NÃO entra nas 570 chamadas da vista de rua; ele acende nas
    // paradas que chegam perto (pad, padclose, padtour, spaceport).
    at: [[PAD_MAIN.x, PAD_MAIN.z]], yaw: 0, scale: 1, cull: 9000,
  },
  // ⚠️ O STRONGBACK SUBIU PARA A LAJE. Ele estava no regolito, 82 m ABAIXO do
  // deck onde o foguete se apoia: uma torre de lançamento no pé do barranco,
  // servindo uma nave que ela não alcança. Agora ele fica na laje, do lado
  // oposto ao pórtico (que ocupa dx +2 a +36), com o foguete no meio dos dois.
  // `lift` é o topo da laje de `sp-complex`; os dois se movem juntos porque
  // ambos partem do mesmo `heightAt`.
  {
    file: 'sp-strongback', why: 'a torre de lançamento, na laje, flanqueando o foguete do lado oposto ao pórtico',
    at: [[PAD_MAIN.x - 62, PAD_MAIN.z - 18]], yaw: 'center', scale: 2, lift: SP_DECK_TOP, cull: 9000,
  },
  {
    file: 'sp-tank', why: 'o parque de tanques atrás dos hangares',
    at: [[PAD_MAIN.x - 250, PAD_MAIN.z + 240], [PAD_MAIN.x - 250, PAD_MAIN.z + 300], [PAD_MAIN.x - 250, PAD_MAIN.z + 360]],
    yaw: 90, scale: 2.8, cull: 6000,
  },
  {
    file: 'sp-dish', why: 'as antenas do controle, olhando para a Terra',
    at: [[PAD_MAIN.x + 330, PAD_MAIN.z + 90], [PAD_MAIN.x + 380, PAD_MAIN.z + 160]],
    yaw: 210, scale: 2.6, cull: 6000,
  },
  // ── os dois jardins temáticos (paisagismo.md §4), atrás de `?verde=1` ──────
  ...(verde ? JARDINS_TEMATICOS : []),
]

export { QUADRANT_ANGLE }

// ═══════════════════════════════════════════════════════════════════════════
// PALETA DE VARIAÇÃO POR INSTÂNCIA, RESERVADA PARA `props.ts` (paisagismo.md
// §pedido do fundador, item 4 do briefing de 03/09).
//
// ⚠️ ESTE CAMPO AINDA NÃO ESTÁ LIGADO A NADA. Outra frente está dando a
// `PropSpec` a capacidade de variar cor por instância (hoje toda cópia de uma
// espécie é clone bit a bit); quando o nome exato do campo chegar, é só
// espalhar os valores abaixo nas linhas de `JARDINS_TEMATICOS` (e nas outras
// árvores da tabela) pelo nome do arquivo. Escrevo aqui agora para não perder
// a decisão de paisagismo enquanto o campo não existe: matiz em graus (0 a
// 360, a faixa é a AMPLITUDE da variação, não limite absoluto), saturação e
// luz como fração 0 a 1 (a mesma convenção de `THREE.Color.setHSL`).
//
// A regra de paisagismo por trás de cada linha: cópia de oliveira varia em
// PRATA (luz alta, saturação baixa), cerejeira varia em ROSA (matiz estreito,
// luz alta), bordo varia em OURO/VERMELHO (matiz largo, outono), pinheiro
// varia pouco (é hero, uma instância não precisa de variação nenhuma) e
// folhagem tropical varia em verde-amarelo (a folha nova contra a madura). Um
// intervalo único para tudo pinta a cerejeira da cor do pinheiro, que é o
// mesmo defeito do "sage chapado" registrado em `especies.ts`, só que nos
// modelos importados em vez das quatro silhuetas procedurais.
export interface VariacaoCorHSL { h: [number, number]; s: [number, number]; l: [number, number] }
export const PALETA_INSTANCIA_PENDENTE: Record<string, VariacaoCorHSL> = {
  'tree-sakura-hero': { h: [330, 350], s: [0.35, 0.55], l: [0.62, 0.78] },
  'tree-maple': { h: [15, 45], s: [0.45, 0.75], l: [0.35, 0.55] },
  'tree-olive': { h: [70, 90], s: [0.10, 0.25], l: [0.55, 0.72] },
  'tree-cypress': { h: [140, 160], s: [0.20, 0.35], l: [0.18, 0.28] },
  'tree-black-pine': { h: [150, 160], s: [0.15, 0.20], l: [0.14, 0.18] },  // hero, quase sem faixa
  'bamboo-clump': { h: [75, 95], s: [0.30, 0.45], l: [0.42, 0.58] },
  'banana-tree': { h: [90, 110], s: [0.35, 0.55], l: [0.40, 0.58] },
  'heliconia': { h: [5, 25], s: [0.55, 0.80], l: [0.45, 0.60] },
  'baobab': { h: [30, 45], s: [0.15, 0.25], l: [0.35, 0.45] },
  'cedar-lebanon': { h: [155, 170], s: [0.20, 0.30], l: [0.22, 0.32] },
  'palm': { h: [85, 105], s: [0.25, 0.40], l: [0.35, 0.50] },
  'palm-date': { h: [80, 100], s: [0.20, 0.35], l: [0.38, 0.52] },
  'feto': { h: [95, 115], s: [0.30, 0.45], l: [0.30, 0.42] },
  'samambaia': { h: [95, 115], s: [0.25, 0.40], l: [0.32, 0.45] },
}
