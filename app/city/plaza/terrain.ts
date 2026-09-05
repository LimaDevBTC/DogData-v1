// O chão: UM regolito, contínuo, do deck ao horizonte, passando pelo parque.
//
// Mare Tranquillitatis de verdade no sítio (public/lunar/btc-core-heightmap.f32,
// SLDEM2015, exageração vertical 2×, a mesma da cena da landing; conferido: o
// pad do spaceport cai a +75,5 onde o .blend tem 76,7, o plinto da Kray a -6,0),
// e dali para fora uma SAIA costurada vértice a vértice na borda do sítio, que
// leva o olho até o horizonte descendo devagar. Uma malha só, um material só,
// uma função de cor só (`regolithColor`), que o parque também usa:
// o fundador viu o sítio claro, o anel escuro e o parque marrom lado a lado, com
// fatias pretas onde a borda do sítio ficava mais alta que o anel e vazava o
// fundo, e disse o óbvio: "tudo isso está se passando no mesmo lugar, na Lua".
//
// Quadro three: x = leste, y = para cima, z = sul, que é exatamente (x, z, −y) do
// Blender, a conversão do exportador glTF. Sem névoa: o que escurece é a luz e um
// escurecimento suave com a distância, o mesmo para todas as malhas.
//
// ⚠️ A GRADE É 429×429, NÃO 137×137 (o número que este cabeçalho tinha até
// 02/09/2026). `public/lunar/btc-core-heightmap.json`, o arquivo real que
// `loadTerrain` busca, diz `cols: 429`, `cellSizeM: 59,225293797166955`: a
// meia-largura real do sítio é `214 × 59,225 ≈ 12.674 m`, não os ~4.027 m que
// 137×137 daria. Achado ao medir a máscara da malha grossa em
// `terreno-fino.ts`: a primeira versão do Bloco A supôs, com o número errado,
// que um único nível de clipmap extra cobriria o sítio inteiro, e não cobre.
import * as THREE from 'three'
import { PODIO_Y, PODIO_R0, PODIO_R1, PODIO_R2, PODIO_R3, PODIO_R3_PARQUE } from './dome'
import { exageroEm, VEX_HORIZONTE } from './vex'
import { PARK_CENTER, PARK_PIT, parkReach, parkCore } from './park-site'
import { look2 } from './look'
import { vestir } from './materiais'
import { microRelevoAt, TERRENO_FINO_ATIVO } from './terreno-fino'
import { alturaInvernoAt, zonaEsquiavelAt, fatorRochaAt } from './inverno'

export interface TerrainMeta {
  cols: number
  rows: number
  cellSizeM: number
  minRelM: number
  maxRelM: number
}

// ⚠️⚠️ O EXAGERO VERTICAL DEIXOU DE SER CONSTANTE EM 28/08/2026, e a razão é
// urbanística, não estética. Mare Tranquillitatis é genuinamente plana: medido
// na prancha /city/plan, o relevo REAL da NASA tem 17,36 km² a menos de 2 graus
// dentro do sítio. Com o exagero de 2 que esta linha aplicava, sobravam 4,06.
// Era o dobro de altura que tornava a cidade inconstruível, não a Lua.
//
// Agora o exagero é 1 DENTRO da cidade e volta a 2 no horizonte. A cidade se
// apoia na Lua como ela é, e a paisagem distante continua dramática. A rampa é
// suave (smoothstep) entre os dois raios, então não há costura: a derivada da
// altura é contínua e nenhuma junta aparece no chão.
//
// ⚠️ MEXER NESTES NÚMEROS MOVE O MUNDO INTEIRO na vertical. Tudo que foi
// enquadrado à mão sobre este terreno (as câmeras da guerra, o datum da
// batalha, o pouso do parque) tem de ser reconferido depois, e o jeito de
// conferir é `?stats=1` com window.__plazaView().
// ⚠️ A CONTA DO EXAGERO MUDOU DE ENDEREÇO: ela agora mora em ./vex, sem
// dependência nenhuma, para que a prancha de fundação possa importá-la sem
// arrastar o Three junto. Reexportado aqui para quem já importava daqui.
export { VEX_CIDADE, VEX_HORIZONTE, VEX_R_CIDADE, VEX_R_HORIZONTE, exageroEm, VERTICAL_EXAGGERATION } from './vex'

// ⚠️ A COTA DA PRAÇA, EXPORTADA EM MÓDULO. Até 05/09 (segunda rodada) a praça
// vivia implícita em `baseAt = 0` e ninguém fora deste arquivo precisava de
// número nenhum. Agora ela desceu para −35 (o fundador viu a ilha 40 m acima
// da lâmina e mandou abaixar) e QUEM PLANTA SOBRE A PRAÇA POR COTA ABSOLUTA
// (as âncoras em `precinct.ts`, que nascem antes de o terreno carregar) precisa
// do mesmo número, ou fica flutuando 35 m no ar. Um export só, para não haver
// uma segunda fonte de verdade se este valor mudar de novo.
export const PRACA_Y = -35
// ⚠️ O RAIO DA BORDA DA BACIA, TAMBÉM EXPORTADO. Três consumidores fora deste
// arquivo (a vala dos canais radiais, a máscara `_foraDoCanal` e a chamada de
// `buildCanais`, todos em `plaza-scene.tsx`) precisam saber onde o fundo plano
// do lago termina para a vala dos radiais entrar exatamente até lá, nem antes
// (sobra represa) nem depois (a vala corta o fundo do lago). Antes este número
// vivia repetido como literal em quatro lugares (aqui e em três pontos de
// `plaza-scene.tsx`); foi assim que o defeito da praia sem cais nasceu no
// primeiro rebaixamento (05/09, primeira rodada) e a correção é não repetir
// de novo.
export const LAGO_R1 = 1354

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ O CANAL RADIAL GANHOU PERFIL ABSOLUTO EM 05/09 (QUARTA RODADA), e não é
// gosto: é o defeito que o fundador chamou de "vala seca por causa da
// margem". A conta que ele pediu pra confirmar: 60 m de lâmina (a seção
// publicada) contra uma parede que sobe, medido, até 53 m em menos de
// 100 m de talude (a seção velha misturava a escavação com o relevo real da
// Lua, que varia −182 a +230 m no sítio): RAZÃO lâmina/profundidade de
// 1,1 a 2,4 no pior trecho, contra 5,4 do anel central (pior lado) e 43 no
// melhor. Isso lê como fosso, não como água, exatamente como ele descreveu.
//
// A palavra dele, 05/09: "se os canais estiverem muito fundos no terreno,
// deixe os com água na borda, para termos praias em todas as margens, se
// precisar terraplane mais, não queremos barrancos, aproveita pra mexer
// agora e nivela a porra toda", e depois, sobre o traçado: "não existe lote
// fixo em nenhum lugar da cidade... se a margem boa precisar de 300 m de
// cada lado, use 300." Os lotes de teste (`cidade-lotes.bin` e companhia)
// não são restrição: nascem de novo no snapshot, sobre o terreno que existir
// naquele dia.
//
// ⚠️ POR QUE PERFIL ABSOLUTO, E NÃO SÓ ALARGAR O `talude` ANTIGO: o desenho
// velho (`cavaEm`, abaixo, ainda vale para anéis de canal) MISTURA a
// escavação com o relevo NATURAL do ponto: o peso `k` interpola entre
// "chão daquele pixel" e "leito", então onde o relevo tem uma quina dentro
// da faixa de mistura, a quina sobrevive e vira barranco de qualquer jeito,
// não importa quão larga a faixa seja. Um canal "reto e nivelado" (a
// diretriz dele) precisa de um perfil que IGNORA o relevo dentro do
// corredor e só volta a consultá-lo na BORDA de fora, exatamente como
// `bacia()` já faz pela Praça: por isso a rampa de subida usa UMA amostra
// de referência (a borda), não o relevo picotado do meio do caminho.
//
// Medido (harness `calibra2.ts`, 348 pontos nos três radiais, passo 100 m):
// com `CANAL_BANDA` = 950 m (a MESMA folga da subida da cidade em `bacia()`,
// reaproveitada de propósito) a pior subida seca fica em 5,9%, dentro do
// teto de 6% que o fundador já deu para a praça. Passar de 700 m para 900 m
// derrubou o pior caso de 7,7% para 5,9%; 500 m dava 11,1%, barranco de
// verdade.
export const CANAL_MERGULHO = 20    // leito -> lâmina, embaixo d'água: pode ser íngreme, ninguém vê
export const CANAL_PRAIA = 40       // lâmina -> crista da praia seca, no meio de 20-60 m pedido
export const CANAL_PRAIA_ALT = 2    // altura da crista da praia acima da lâmina
export const CANAL_BANDA = 950      // crista da praia -> relevo natural, ≤6% medido (ver nota acima)
// ⚠️ A LÂMINA TAMBÉM ALARGOU, DE 60 PARA 100 m ("alargue a lâmina", palavra do
// fundador). `plaza-scene.tsx` publica ESTE número no lugar do `secao`/`lamina`
// que vem de `cidade-malha.json` (hoje 60), para a cava do terreno, a água de
// `canais.ts` e o corredor de `lago.ts` nascerem todos do MESMO valor, e é o
// número que este arquivo declara como divergente do JSON: `gerar_cidade.py`
// ainda publica 60 e só vai nascer certo na passada de regeneração pós-snapshot
// (dívida igual à de `LAGO_R1`, ver a nota dela). Os lotes de teste que hoje
// existem (`cidade-lotes.bin` e companhia) NÃO são restrição: o fundador foi
// explícito, "não existe lote fixo em nenhum lugar da cidade", e nascem de
// novo, uma vez só, no snapshot.
export const CANAL_LAMINA = 100

export interface Terrain {
  group: THREE.Group
  /** Altura do chão em (x, z), em qualquer lugar: sítio, saia, horizonte. */
  heightAt: (x: number, z: number) => number
  /** Igual a heightAt; nome mantido para quem chamava o anel do horizonte. */
  horizonAt: (x: number, z: number) => number
  /**
   * ⚠️ A SUPERFÍCIE QUE A CÂMERA VÊ, QUE NÃO É `heightAt`. `heightAt` é a função
   * contínua; a MALHA do regolito é a linearização dela em células de ~59 m, com
   * cada célula partida em dois triângulos. Entre dois vértices as duas
   * discordam pela flecha da corda, e quem assenta chão sobre `heightAt` fica
   * ora acima ora abaixo do que aparece na tela.
   *
   * Medido em 29/08/2026 com 4.000 sondas verticais: a pista da via, posta a
   * 0,18 m sobre `heightAt`, tinha regolito passando POR CIMA dela em 12,7% das
   * amostras, até 1,00 m. Subdividir a via de 42 para 18 m derrubou para 4,4% e
   * 0,30 m, e não ia a zero nunca, porque o resto não é erro da via: é a malha
   * do terreno chordando os 59 m dela.
   *
   * Quem desenha chão (via, praça, lote, peça) usa ESTA e casa exatamente com o
   * que se vê. Quem precisa da superfície real (câmera, física, silhueta do
   * horizonte) usa `heightAt`.
   *
   * ⚠️ COM `?terreno=fino` LIGADO, ESTA FUNÇÃO VIRA `heightAt` SEM MAIS NADA,
   * em todo (x, z). A malha grossa deixa de ser a coisa desenhada por baixo
   * do clipmap (é mascarada por `THREE.Plane`, ver `terreno-fino.ts`), então
   * o erro de corda que o parágrafo acima descreve deixa de existir onde o
   * clipmap cobre; e fora do clipmap a malha grossa segue exatamente como
   * hoje, então tratar tudo como `heightAt` ali é uma aproximação aceita, não
   * medida por sonda, para não fazer a resposta desta função depender de
   * onde a câmera está agora (isso derrubaria árvore, poste e câmera perto
   * de qualquer fronteira de nível: ver a armadilha 3 em `terreno-fino.ts`).
   */
  superficieAt: (x: number, z: number) => number
  /** O chão SEM a cova do parque: o parque funde a borda dele neste valor. */
  baseAt: (x: number, z: number) => number
  /** altura média do sítio: a régua do relevo em `regolithColor` */
  meanHeight: number
  halfExtent: number
  /** a bacia do lago da praça: margem interna, margem externa e cota da lâmina */
  lago: { r0: number; r1: number; agua: number; fundo: number }
  /** ⚠️ PARA QUEM DESENHA OUTRA MALHA DE CHÃO COM O MESMO MATERIAL (o
   *  clipmap de `terreno-fino.ts`). A cor por vértice que a malha grossa usa
   *  em `push`, exposta para não duplicar a conta: cinza normalizado quando
   *  `look2` está ligado (a textura manda no tom), cor direta senão. */
  corAt: (x: number, z: number, relief: number, out: THREE.Color) => THREE.Color
  /** metros de mundo por unidade de UV, para quem precisar casar o ladrilho
   *  da textura com a malha grossa. */
  uvEscala: number
  /** o material da malha grossa, por referência: quem quiser reusar (e não
   *  criar um material novo) clona a partir daqui. */
  material: THREE.Material
}

const BASE = new THREE.Color('#3f3d3a') // regolito iluminado pelo sol; o material escurece o resto
// ⚠️ A ROCHA EXPOSTA DO PARQUE DE INVERNO (03/09). A chapa reprovou a face
// íngreme do maciço como "regolito marrom com neve por cima": acima de 30°,
// crescendo a 55° (a mesma faixa que `alpino.ts` usa pra neve não grudar),
// o vértice mistura para este cinza de pedra em vez do marrom do resto da
// cidade. Não é textura nova (não tenho onde declarar um material a mais sem
// tocar `materiais.ts`, que tem dono): é SÓ a cor por vértice, mistura no
// `corVertice` que já existe. `#6E6A63` é mais claro e mais frio que `BASE`
// (que mede 0,0497 linear); pedra fraturada lê mais clara que regolito fino
// sob a mesma luz, então clarear é a direção certa, não medi o albedo exato.
const ROCHA_PICO = new THREE.Color('#6E6A63')

/** metros de mundo por unidade de UV da malha do regolito. Ver `push`. */
const UV_ESCALA = 1000
/** ⚠️ A TINTA QUE DEVOLVE O VALOR QUE `BASE` DAVA. Conta feita, não chutada:
 *  BASE em linear é 0,0497 e o albedo médio da receita 'regolito' é cerca de
 *  0,17 linear, então a tinta tem de valer 0,29 linear pra imagem não clarear
 *  de repente. #9A948B mede 0,325, ou seja 12% acima do que havia: é o pouco de
 *  respiro que o meio-tom pedia, não uma troca de exposição. Não medi na chapa
 *  qual dos dois o fundador prefere. */
const TINTA_REGOLITO = '#9A948B'
const R_DARK_START = 3000
const R_DARK_END = 26000

/** A cor do regolito em qualquer malha do chão: base × relevo × ruído × distância.
 *  `relief` em metros (positivo = mais alto que a vizinhança), `dist` = distância à
 *  praça. Uma função só, para o parque a 9 km ser o mesmo chão que o deck. */
export function regolithColor(x: number, z: number, relief: number, dist: number, out: THREE.Color): THREE.Color {
  const rel = THREE.MathUtils.clamp(relief / 220 + 0.45, 0, 1)
  const noise = 0.92 + 0.08 * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)
  const far = THREE.MathUtils.clamp((dist - R_DARK_START) / (R_DARK_END - R_DARK_START), 0, 1)
  const shade = (0.72 + rel * 0.5) * noise * (1 - 0.72 * far)
  return out.set(BASE.r * shade, BASE.g * shade, BASE.b * shade)
}

/**
 * ⚠️ A VALA DO CANAL TEM DE SER CAVADA NO TERRENO, e não estava. O lago tem
 * bacia escavada aqui (LAGO_*) e por isso a lâmina dele aparece; o canal era
 * desenhado por `canais.ts` a 1 m abaixo do chão e o REGOLITO ficava por cima.
 * Medido em corte perpendicular no rumo 22,5 a r 2.000: água a −32,2 e regolito
 * a −28,2, ou seja o canal inteiro enterrado 4 m, sem erro nenhum aparecer.
 * O gerador publica os canais; a cena passa a especificação para cá.
 */
/**
 * ⚠️ A MONTANHA DE NEVE É ESCULPIDA NO TERRENO, não pintada sobre ele. O relevo
 * real dentro do domo do vale dá 77 m em 2.642 m, ou 1,7° de declive médio, que
 * é rampa de estacionamento e não pista (azul de iniciante na Terra tem 8 a 12°).
 * Sem levantar o chão de verdade, a pista seria uma textura branca num plano.
 */
export interface Monte { x: number; z: number; raio: number; altura: number }

export interface CanalCava {
  radiais: { rumo: number; secao: number; rInicio: number; rFim?: number }[]
  aneis: { phi: number; secao: number; contorno: [number, number][]; vaos?: [number, number][] }[]
  /** quanto o leito desce abaixo do chão original */
  fundo?: number
  /** ⚠️ A COTA ABSOLUTA DO LEITO, e é ela que manda quando existe.
   *
   *  `fundo` é uma profundidade RELATIVA ao chão, e é exatamente por isso que o
   *  canal ficou serrilhado: cavar 4,6 m abaixo de um terreno que ondula 25 m
   *  produz um leito que ondula 25 m junto, e a água em cima dele sobe e desce.
   *  O fundador matou esse defeito nos lagos em 30/08 ("toda água da cidade
   *  precisa ter exatamente o mesmo nível, já que está tudo interligado") e ele
   *  sobreviveu nos três radiais. Com `leito` o corte vai até uma COTA, como uma
   *  eclusa de verdade, e a água passa a ser uma lâmina só.
   *
   *  Medido em 30/08: pôr os três radiais em −44 custa 16,7 Mm³ de corte
   *  (11 a 22 m de profundidade média, 36,5 no pior ponto). É barato perto dos
   *  276 Mm³ que mataram os canais de anel. */
  leito?: number
  /** a largura da rampa de terra de cada lado, além da seção */
  talude?: number
  /** montes construídos, como a montanha de neve do Vale do Poente */
  montes?: Monte[]
}

export async function loadTerrain(cava?: CanalCava): Promise<Terrain> {
  const [meta, buf] = await Promise.all([
    fetch('/lunar/btc-core-heightmap.json').then((r) => {
      if (!r.ok) throw new Error('heightmap meta missing')
      return r.json() as Promise<TerrainMeta>
    }),
    fetch('/lunar/btc-core-heightmap.f32').then((r) => {
      if (!r.ok) throw new Error('heightmap missing')
      return r.arrayBuffer()
    }),
  ])
  return buildTerrain(meta, new Float32Array(buf), cava)
}

export function buildTerrain(meta: TerrainMeta, heights: Float32Array, cava?: CanalCava): Terrain {
  // ── a vala dos canais ─────────────────────────────────────────────────────
  // ⚠️ SE ESTE BLOCO NÃO RODAR, O CANAL FICA ENTERRADO E NADA ACUSA. A água é
  // desenhada por outro módulo, então o regolito por cima dela não gera erro:
  // só some com o canal.
  const _fundoC = cava?.fundo ?? 4.6
  const _tal = cava?.talude ?? 26
  const _leitoAbs = cava?.leito
  const _radiais = (cava?.radiais ?? []).map((r) => {
    const dx = Math.sin((r.rumo * Math.PI) / 180), dz = -Math.cos((r.rumo * Math.PI) / 180)
    return {
      ...r, dx, dz,
      // a perpendicular ao eixo, para decompor qualquer ponto em (t, s)
      px: -dz, pz: dx,
      meia: r.secao / 2,
      // ⚠️ SEM ESTE FIM A VALA VAI ATÉ O INFINITO. Ver o comentário em plaza-scene.
      rFim: r.rFim ?? Infinity,
    }
  })
  // ⚠️ PERFIL DE COSSENO, NÃO CONE. Cone dá aresta na base e ponta no topo: a
  // aresta vira degrau visível de longe e a ponta não tem onde pôr o teleférico.
  // `1 − cos` sobe suave do pé e arredonda o cume, que é a forma de montanha.
  const _montes = cava?.montes ?? []
  const monteEm = (x: number, z: number): number => {
    let h = 0
    for (const m of _montes) {
      const d = Math.hypot(x - m.x, z - m.z)
      if (d >= m.raio) continue
      const t = 1 - d / m.raio
      h = Math.max(h, m.altura * (t * t * (3 - 2 * t)))
    }
    return h
  }
  // ⚠️ `vaos` = onde o anel está INTERROMPIDO. O gerador para o canal antes de
  // uma peça de porta e recomeça depois dela; se a vala for cavada mesmo assim, o
  // vão não existe e a peça volta a ficar sobre 4,6 m de vala. Os vãos vêm em
  // RUMO (0 no −Z, horário), que é o quadro do gerador, e aqui o ângulo do anel é
  // `atan2(z, x)`: os dois não são a mesma coisa e a conversão é obrigatória.
  const _aneis = (cava?.aneis ?? []).map((a) => ({
    secao: a.secao,
    vaos: a.vaos ?? [],
    pts: a.contorno.map(([x, z]) => ({ a: Math.atan2(z, x), r: Math.hypot(x, z) })),
  }))
  const _noVao = (vaos: [number, number][], x: number, z: number) => {
    if (!vaos.length) return false
    let ru = (Math.atan2(x, -z) * 180) / Math.PI
    ru = ((ru % 360) + 360) % 360
    for (const [a0, a1] of vaos) {
      if (((ru - a0) % 360 + 360) % 360 <= ((a1 - a0) % 360 + 360) % 360) return true
    }
    return false
  }
  /** quanto o chão desce naquele ponto, de 0 (fora) a 1 (no eixo). ⚠️ SÓ OS
   *  ANÉIS DE CANAL, DESDE A QUARTA RODADA (05/09): os radiais saíram daqui
   *  e ganharam perfil ABSOLUTO (`canalRadialAbsAt`, definida mais abaixo,
   *  perto de `bacia`, porque precisa dela). Ver a nota grande em
   *  `CANAL_BANDA` acima para o motivo. Esta função continua existindo para
   *  o dia em que houver anel de canal de novo (`cava.aneis`, hoje vazio). */
  const cavaEm = (x: number, z: number): number => {
    let k = 0
    for (const an of _aneis) {
      if (!an.pts.length || _noVao(an.vaos as [number, number][], x, z)) continue
      const ang = Math.atan2(z, x)
      let melhor = an.pts[0], dd = 9
      for (const p of an.pts) {
        const q = Math.abs(((p.a - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        if (q < dd) { dd = q; melhor = p }
      }
      const d = Math.abs(Math.hypot(x, z) - melhor.r)
      const meia = an.secao / 2
      if (d < meia) k = Math.max(k, 1)
      else if (d < meia + _tal) k = Math.max(k, 1 - (d - meia) / _tal)
    }
    return k * k * (3 - 2 * k)                    // suaviza a borda da vala
  }
  const n = meta.cols
  const cell = meta.cellSizeM
  const half = (n - 1) / 2
  const halfExtent = half * cell
  // ⚠️ o exagero entra DEPOIS da interpolação, e por lugar: interpolar alturas
  // já exageradas com fatores diferentes nos quatro cantos criaria degrau na
  // borda de célula. Interpola o relevo cru, depois escala pelo raio.
  const H = (i: number, j: number) => heights[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))]

  const rawAt = (x: number, z: number): number => {
    const fi = Math.min(n - 1.001, Math.max(0, x / cell + half))
    const fj = Math.min(n - 1.001, Math.max(0, z / cell + half))
    const i = Math.floor(fi), j = Math.floor(fj)
    const u = fi - i, v = fj - j
    const cru = H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
    return cru * exageroEm(Math.hypot(x, z))
  }
  // O platô da praça: dentro do raio o chão é plano no nível 0 (o deck, as
  // âncoras e o jardim inteiro, até a muralha em 900, foram desenhados sobre um
  // plano), e daí em diante ele volta suavemente ao relevo real.
  // ⚠️ O PLATÔ CRESCEU DE 1.470/1.830 PARA 2.400/2.760 EM 05/09 (SEGUNDA
  // RODADA), E O MOTIVO É A SUBIDA NOVA DA CIDADE. A praça desceu para −35 (ver
  // `PRACA_Y`) e a antiga bacia de 40 m em ~110 m virou uma subida de 4,14% em
  // 950 m (a subida NÃO pode ficar mais curta que isso, ou volta a ser
  // barranco): o chão só fica seco e plano de novo em r 2.344 (`R_CIDADE_SECA`
  // abaixo). Com o platô antigo em 1.470 o relevo real começaria a se misturar
  // 874 m ANTES do fim da subida, e a subida reta que a praia pede sairia
  // ondulada pelo relevo cru por baixo. Platô até 2.400 dá 56 m de folga seca
  // depois do fim medido da subida, e a volta ao relevo real (2.400 a 2.760)
  // guarda a mesma largura de 360 m que a transição já tinha antes.
  const PLATO_R = 2400, PLATO_FIM = 2760
  const siteAt = (x: number, z: number): number => {
    const raw = rawAt(x, z)
    const r = Math.hypot(x, z)
    if (r >= PLATO_FIM) return raw
    if (r <= PLATO_R) return 0
    const t = (r - PLATO_R) / (PLATO_FIM - PLATO_R)
    const k = t * t * (3 - 2 * t)
    return raw * k
  }
  // a média da saia usa o exagero do HORIZONTE, que é onde a saia vive
  let mean = 0
  for (let k = 0; k < heights.length; k++) mean += heights[k] * VEX_HORIZONTE
  mean /= heights.length

  // A saia: fora do quadrado do sítio, a altura parte da altura da BORDA (o ponto
  // do quadrado na direção do lugar), decai para a média do sítio, e desce com a
  // distância como um rebordo suave de cratera. Contínua na borda por construção.
  const boundaryPoint = (x: number, z: number): [number, number] => {
    const m = Math.max(Math.abs(x), Math.abs(z)) || 1
    return [(x / m) * halfExtent, (z / m) * halfExtent]
  }
  const drop = (d: number) => {
    const t = Math.min(1, Math.max(0, (d - halfExtent) / 24000))
    return t * 60 + t * t * 220
  }
  const skirtAt = (x: number, z: number): number => {
    const [bx, bz] = boundaryPoint(x, z)
    const hb = siteAt(bx, bz)
    const d = Math.hypot(x, z)
    const dOut = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - halfExtent)
    const fade = Math.exp(-(dOut / 2200) * (dOut / 2200))
    return hb * fade + mean * (1 - fade) - drop(d)
  }
  const baseAt = (x: number, z: number): number => (Math.max(Math.abs(x), Math.abs(z)) <= halfExtent ? siteAt(x, z) : skirtAt(x, z))
  // A cova do parque: sob o Parque Runestone o regolito desce até (datum − PARK_PIT),
  // onde datum é o chão sob o Monarca, com a mesma rampa (PARK_CORE → PARK_HALF)
  // que o parque usa para fundir na borda. O parque tem chão próprio (vale a −61,
  // cordilheira a +240 sobre o datum); sem a cova o regolito de Tranquillitatis
  // vazava pelo fundo do vale onde o relevo real é mais alto que o datum.
  const parkDatum = baseAt(PARK_CENTER.x, PARK_CENTER.z)
  // ⚠️ A BACIA DO LAGO DA PRAÇA. O anel entre a praça e a cidade não tinha um
  // lote sequer, então ele podia virar água sem custar endereço nenhum.
  //
  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️ SEGUNDA RODADA, 05/09/2026: A PRAÇA DESCEU, O DEGRAU MORREU PELA RAIZ.
  //
  // A primeira rodada do mesmo dia rebaixou só a BACIA (lâmina de -6,5 para
  // -40) e manteve a praça no platô, cota 0. Resultado medido: uma ilha 40 m
  // ACIMA da água, com um terraço de cinco degraus na beira para vencer a
  // queda sem virar rampa de skate. O fundador viu a cena em produção e foi
  // direto na causa: "a praça é uma ilha quase na altura da água do canal,
  // não sei por que motivo ela é muito metros mais alta... agora é só abaixar
  // a praça central, ela ainda tem uns degraus pra chegar na água que eu não
  // quero". Ele tem razão: o degrau só existia porque a praça estava alta.
  // Tirar o degrau sem descer a praça seria trocar cinco lances por uma rampa
  // de 40 m; a única forma de não ter escada nenhuma é ter pouco o que descer.
  //
  // Por isso a praça desce para `PRACA_Y` = -35 (exportada acima, para as
  // âncoras que nascem antes do terreno). Sobram só 5 m secos até a lâmina
  // (-40), e 5 m viram praia mansa sem escada nenhuma. A lâmina, o fundo da
  // bacia (`LAGO_FUNDO`) e a cota da água (`LAGO_AGUA_Y`) NÃO mudam: são a
  // mesma água de toda a cidade, e mexer nelas reabriria a discussão de
  // hidrografia.md, que já está fechada.
  //
  // ⚠️ O PERFIL VIROU RETO DE PROPÓSITO, sem smoothstep na praia. O talude
  // antigo usava `smoothstep` (derivada zero nas pontas, pico no meio) e foi
  // exatamente isso que empurrou a linha d'água para cima do trecho mais
  // íngreme na primeira versão desta bacia (a "pista de skate" de 02/09). O
  // fundador pediu praia de "corrida mansa": inclinação CONSTANTE do começo
  // ao fim, que é uma reta, não uma curva que acelera no meio. `retaGrampeada`
  // (abaixo) faz exatamente isso, e por ser reta a inclinação medida a 6 e a
  // 16 m da lâmina (a sonda que `lago.ts` usa para desenhar a areia) é a MESMA
  // inclinação do talude inteiro: a largura da areia deixa de ser um número
  // estimado e passa a ser o que a reta entrega, sem surpresa.
  //
  // ⚠️ SEM TERRAÇO, SEM HARMÔNICO POR RUMO. O terraço de cinco degraus (o que
  // o fundador recusou) e a modulação `lagoMod` (que variava o talude por
  // rumo para o anel não ler "de compasso") saem os dois. O painel de projeto
  // do centro mediu o sítio real e achou um eixo de caimento natural a 49,4°
  // (NE baixo, SW alto: até 118 m de diferença de cota no mesmo raio) que é o
  // jeito certo de quebrar a simetria, mas seguir esse eixo pede reamostrar o
  // relevo cru por azimute e redesenhar a bacia como península presa ao lado
  // alto, e isso é retrabalho de escala maior que esta rodada, que já entrega
  // o pedido mais recente e mais específico do fundador (a praça descer, sem
  // degrau, com praia nos dois lados). Fica registrado para a próxima rodada,
  // quando o painel fechar a versão vencedora: um anel perfeitamente circular
  // hoje é mais seguro de medir e de verificar offline (sem abrir navegador)
  // do que uma bacia assimétrica calibrada à mão contra o relevo real.
  //
  // ⚠️ O RAIO DA PRAÇA (1.024, monumentos e Calçada dos Fundadores) NÃO MUDOU:
  // só a COTA da praça desceu. O que muda de raio é a cidade do lado de fora,
  // porque a subida de volta ao nível 0 deixou de caber em ~110 m (era
  // barranco de 20°, e o fundador recusou isso também: "se os canais
  // estiverem muito fundos... terraplane mais, não queremos barrancos"). Com
  // 40 m de queda a ~4,1% a subida pede ~950 m de corrida; ela começa em
  // `R_AGUA_OUT` e só fica seca e plana em `R_CIDADE_SECA`, medido abaixo pelo
  // harness.
  //
  // ⚠️ OS DOIS RUNS (praia interna e subida externa) FORAM ALARGADOS TRÊS
  // VEZES depois da primeira medição, e o motivo foi a AREIA, não o barranco.
  // `lago.ts` desenha a largura da faixa de areia como `1,5 / inclinação`, e
  // essa largura ainda balança ±25% de rumo a rumo por um ruído orgânico
  // (`onda`, a mesma máquina de `contornoIlha`) para o anel não ler como
  // compasso. Medido contra a MALHA de verdade (não a fórmula): a primeira
  // tentativa (praia a 5,05%, subida a 5,50%) já batia a meta na MÉDIA, mas o
  // pior rumo do ruído descia a 19,8 m por dentro e 16,6 m por fora, por baixo
  // do piso de 20. A causa é que perto da linha d'água a MALHA lê um pouco
  // mais íngreme que a reta nominal (a curva tem uma quina exatamente ali, de
  // ~4% para ~18%, e a grade fina arredonda a quina por cima de uma célula:
  // ver `LAGO_SUB` abaixo). Alargar o run sozinho ajudou pouco porque o erro
  // da quina é quase constante em METROS, não em porcentagem, e um talude mais
  // manso amplifica o mesmo erro absoluto num raio maior. A dupla correção que
  // fechou a conta foi refinar a malha (`LAGO_SUB` de 12 para 16, cortando o
  // erro da quina) E alargar os runs para 120 e 950 m: medido depois, 28,0 m
  // de areia dos DOIS lados, pior rumo do ruído em 21,0 m, com folga real.
  const R_PRACA_BORDA = 1024
  // 120 m de praia a 4,17% (drop de 5 m: de -35 a -40): dentro dos 80-200 m e
  // dos 2-6% pedidos, com folga dos dois lados da banda.
  const R_AGUA_IN = 1144
  // o mergulho, da lâmina até o fundo da bacia: 7,5 m de água em 40 m de
  // corrida, 18,75%. Não é praia (fica embaixo d'água), não precisa ser mansa.
  const LAGO_R0 = 1184
  // ⚠️ LAGO_R1 (a outra ponta do fundo plano) é exportado no topo do arquivo
  // porque `plaza-scene.tsx` também precisa dele, em três lugares, para a vala
  // dos canais radiais parar exatamente onde este fundo começa.
  // fundo plano da bacia: 170 m, um lago de verdade e não uma valeta.
  const LAGO_FUNDO = 47.5   // INTACTO: 40 m secos + 7,5 m de água, a mesma profundidade de sempre
  const LAGO_AGUA_Y = -40   // INTACTO: a cota de toda a água da cidade
  const R_AGUA_OUT = LAGO_R1 + 40   // simétrico ao mergulho interno
  // a subida da cidade: 40 m a 4,14% (bem abaixo do teto de 6% que o fundador
  // deu), 950 m de corrida. Medido depois pelo harness: onde ela termina de
  // verdade.
  const R_CIDADE_SECA = R_AGUA_OUT + 950
  /** reta grampeada: liga h0 em d0 a h1 em d1 com inclinação CONSTANTE, e
   *  trava fora do intervalo. Reta, não curva: é o que dá "corrida mansa" (a
   *  mesma inclinação do início ao fim) em vez do smoothstep que acelerava no
   *  meio e escondia a linha d'água em cima do trecho mais íngreme. */
  const retaGrampeada = (d: number, d0: number, h0: number, d1: number, h1: number): number => {
    const t = (d - d0) / (d1 - d0)
    if (t <= 0) return h0
    if (t >= 1) return h1
    return h0 + (h1 - h0) * t
  }
  const bacia = (x: number, z: number): number => {
    const r = Math.hypot(x, z)
    if (r <= R_PRACA_BORDA) return -PRACA_Y                    // a praça inteira, plana, em PRACA_Y
    if (r <= R_AGUA_IN) return retaGrampeada(r, R_PRACA_BORDA, -PRACA_Y, R_AGUA_IN, 40)
    if (r <= LAGO_R0) return retaGrampeada(r, R_AGUA_IN, 40, LAGO_R0, LAGO_FUNDO)
    if (r <= LAGO_R1) return LAGO_FUNDO
    if (r <= R_AGUA_OUT) return retaGrampeada(r, LAGO_R1, LAGO_FUNDO, R_AGUA_OUT, 40)
    if (r <= R_CIDADE_SECA) return retaGrampeada(r, R_AGUA_OUT, 40, R_CIDADE_SECA, 0)
    return 0
  }

  // ⚠️ O CHÃO SEM CANAL NENHUM, e é a peça que faltava para o canal radial ter
  // perfil absoluto: `canalRadialAbsAt`, logo abaixo, precisa saber "o que
  // este ponto seria se não houvesse canal" para subir até lá na borda da
  // faixa, exatamente o que `heightAt` monta antes de aplicar a vala
  // (`baseAt − bacia + monte`). Extraída para não repetir a conta.
  const bbAt = (x: number, z: number): number => baseAt(x, z) - bacia(x, z) + monteEm(x, z)

  // ── O CANAL RADIAL, PERFIL ABSOLUTO ──────────────────────────────────────
  // Ver a nota grande em `CANAL_BANDA` (topo do arquivo) para o "porquê".
  // Devolve `null` fora de qualquer canal (usa o chão normal); dentro, devolve
  // a cota já pronta, ignorando o relevo local do meio do caminho e só
  // consultando-o na BORDA da faixa (`bbAt` no ponto espelhado), como
  // `bacia()` já faz com a praça.
  // ⚠️ O LEITO É O MESMO QUE `_leitoAbs` (a cota absoluta que `plaza-scene.tsx`
  // já publica como `leito: (lagos.cota − 4)`), não um número novo. Sem
  // fonte publicada, cai para 4 m abaixo da lâmina, a mesma profundidade que
  // `canais.ts` usa para o convés da lancha (`FUNDO = 4.0`).
  const leitoCanal = _leitoAbs ?? (LAGO_AGUA_Y - 4)
  const canalRadialAbsAt = (x: number, z: number): number | null => {
    let melhor: number | null = null
    for (const r of _radiais) {
      const tt = x * r.dx + z * r.dz
      if (tt < r.rInicio - 40 || tt > r.rFim + CANAL_BANDA) continue
      const s = x * r.px + z * r.pz
      const d = Math.abs(s)
      const meia = r.meia
      const rBanda = meia + CANAL_BANDA
      if (d > rBanda) continue
      const sinal = s < 0 ? -1 : 1
      let h: number
      const rMerg = meia - CANAL_MERGULHO
      const rPraia = meia + CANAL_PRAIA
      if (d <= rMerg) {
        h = leitoCanal          // leito plano, embaixo d'água
      } else if (d <= meia) {
        h = retaGrampeada(d, rMerg, leitoCanal, meia, LAGO_AGUA_Y)
      } else if (d <= rPraia) {
        h = retaGrampeada(d, meia, LAGO_AGUA_Y, rPraia, LAGO_AGUA_Y + CANAL_PRAIA_ALT)
      } else {
        // ⚠️ A REFERÊNCIA É O PONTO NA BORDA DA FAIXA, MESMO (t, sinal·rBanda),
        // NÃO O RELEVO NO MEIO DO CAMINHO. É isto que garante a inclinação
        // constante medida (`calibra2.ts`): o relevo real pode ter qualquer
        // quina entre a praia e a borda, ela nunca aparece na rampa.
        const xRef = tt * r.dx + sinal * rBanda * r.px
        const zRef = tt * r.dz + sinal * rBanda * r.pz
        const hRef = bbAt(xRef, zRef)
        h = retaGrampeada(d, rPraia, LAGO_AGUA_Y + CANAL_PRAIA_ALT, rBanda, hRef)
      }
      // ⚠️ DOIS CANAIS PODEM SE SOBREPOR PERTO DO LAGO (25° e 55° só têm 30°
      // de abertura, e `CANAL_BANDA` é bem mais larga que isso). O MENOR
      // (mais escavado) VENCE, mesmo critério de `Math.max(k,...)` que o
      // resto do arquivo usa para a vala, só que em cota absoluta em vez de
      // peso: aqui "mais fundo" é "menor h".
      melhor = melhor === null ? h : Math.min(melhor, h)
    }
    return melhor
  }
  // ⚠️ A FAIXA REFINADA, DECLARADA AQUI PORQUE O `superficieAt` PRECISA DELA.
  // Quem pousa peça pergunta ao `superficieAt`, e ele interpola a MALHA, não a
  // curva. Se ele continuasse lendo a grade de 59 m onde a curva analítica tem
  // uma QUINA (mudança abrupta de inclinação), a malha grossa arredondaria a
  // quina por cima de uma célula inteira e a areia (que faz bisseção contra
  // `superficieAt`, em `lago.ts`) sondaria um talude ligeiramente diferente do
  // que a curva `bacia()` desenhou.
  //
  // ⚠️ A FAIXA ENCOLHEU PARA SÓ AS QUINAS, E NÃO É A MESMA CONTA DE ANTES. O
  // desenho de 02/09 precisava refinar o talude INTEIRO (52 a 67 m de corrida)
  // porque a curva ali era um `smoothstep` com curvatura forte de ponta a
  // ponta: qualquer ponto da rampa divergia da grade grossa. A reta desta
  // rodada (`retaGrampeada`) tem curvatura ZERO no meio do trecho (uma reta
  // interpolada linearmente por uma grade grossa é a MESMA reta, sem erro), e
  // só quebra nas SEIS quinas (praça/praia, praia/mergulho, mergulho/fundo,
  // duas vezes, e cidade seca). Refinar apenas ±50 m em volta de cada quina
  // (260 m interno, 140 m entre as duas quinas da bacia, 100 m na subida da
  // cidade: 500 m ao todo) cobre exatamente onde a malha grossa arredondaria
  // demais, sem pagar célula fina nos ~950 m de subida que são reta pura e não
  // precisam dela.
  //
  // ⚠️ LAGO_SUB SUBIU DE 12 PARA 16 PELA MESMA RAZÃO QUE OS RUNS ALARGARAM
  // (ver a nota grande de `R_CIDADE_SECA` acima): a quina em `R_AGUA_IN` e em
  // `R_AGUA_OUT` é exatamente onde `lago.ts` sonda a inclinação para desenhar
  // a areia, e uma célula grossa arredondando essa quina desloca a linha
  // d'água MEDIDA por metros inteiros num talude manso. Passo fino com 12:
  // 59,225/12 = 4,94 m, erro de corda medido até 0,23 m na quina, areia caindo
  // a 19,5 m no pior rumo (por baixo do piso). Com 16: passo 59,225/16 =
  // 3,70 m, erro até 0,13 m, areia em 21,0 m no pior rumo. Custo, medido pelo
  // harness: 1.932 células grossas caem nas três faixas, vezes 17² vértices
  // cada, ~558 mil vértices. É MAIS que a malha grossa inteira do sítio
  // (429² ≈ 184 mil vértices), então não é barato; é o preço de a linha
  // d'água medida bater a meta de areia em todo rumo, e fica confinado aos
  // ~500 m de faixa que de fato têm quina, não nos ~950 m de subida reta ao
  // redor, que continuam na grade grossa de 59 m.
  const LAGO_SUB = 16
  const FAIXA: [number, number][] = [
    [R_PRACA_BORDA - 50, LAGO_R0 + 50],      // praça / praia / mergulho interno
    [LAGO_R1 - 50, R_AGUA_OUT + 50],         // mergulho externo / fundo da bacia
    [R_CIDADE_SECA - 50, R_CIDADE_SECA + 50], // onde a subida da cidade termina
  ]
  const FAIXA_MIN = Math.min(...FAIXA.map(([a]) => a))
  const FAIXA_MAX = Math.max(...FAIXA.map(([, b]) => b))
  const naFaixa = (i: number, j: number): boolean => {
    // ⚠️ PORTA RÁPIDA, e ela não é otimização prematura: `superficieAt` chama
    // isto, e `superficieAt` é o trava-chão da câmera (todo quadro) e o pouso de
    // 86 mil lotes. Uma raiz quadrada no caso comum em vez de quatro.
    const rc = Math.hypot((i + 0.5 - half) * cell, (j + 0.5 - half) * cell)
    if (rc < FAIXA_MIN - cell || rc > FAIXA_MAX + cell) return false
    for (let dj = 0; dj <= 1; dj++) {
      for (let di = 0; di <= 1; di++) {
        const r = Math.hypot((i + di - half) * cell, (j + dj - half) * cell)
        for (const [ra, rb] of FAIXA) if (r > ra && r < rb) return true
      }
    }
    return false
  }
  // ── O PÓDIO DA ABÓBADA ────────────────────────────────────────────────────
  //
  // ⚠️ SEM ESTE BLOCO A CÚPULA NÃO FECHA. A casca é uma calota esférica pura, de
  // borda numa cota só; o terreno cru varia 232 m no círculo de 8.600 m. Se a
  // terra não for nivelada, a abóbada fura o chão de um lado e fica pendurada a
  // 100 m dele do outro. Foi exatamente isso que apareceu na chapa como o rasgo
  // na borda, e a tentativa de consertar pela casca (fazer a borda seguir o
  // relevo) transformou a cúpula em lençol. O desnível se resolve com terra.
  //
  // O anel é plano entre R1 e R2 e se dissolve nos dois lados por smoothstep.
  // A rampa interna, 750 m para até 127 m de corte, dá 19,3% no pior rumo — um
  // talude de 1:5, que se sustenta. R0 é 7.700 porque a cidade acaba em 7.691:
  // nenhuma quadra é tocada pela terraplenagem.
  // ⚠️ O FADE EXTERNO ENCURTA NO RUMO DO PARQUE. Ver PODIO_R3_PARQUE em dome.ts:
  // a partir de 7.550 naquele setor começa a cova do Runestone, e um fade longo
  // ali levantaria a testada do parque. A mistura angular é a mesma de
  // `parkReach`, para as duas transições combinarem em vez de brigarem.
  const _pdx = PARK_CENTER.x, _pdz = PARK_CENTER.z
  const _pnd = Math.hypot(_pdx, _pdz) || 1
  const podioR3Em = (x: number, z: number): number => {
    const nl = Math.hypot(x, z)
    if (nl < 1e-6) return PODIO_R3
    const cos = (x * _pdx + z * _pdz) / (nl * _pnd)
    const C1 = Math.cos((42 * Math.PI) / 180)      // dentro disto: fade curto inteiro
    const C0 = Math.cos((78 * Math.PI) / 180)      // fora disto: fade longo
    const t = Math.min(1, Math.max(0, (cos - C0) / (C1 - C0)))
    const k = t * t * (3 - 2 * t)
    return PODIO_R3 + (PODIO_R3_PARQUE - PODIO_R3) * k
  }
  const podioPeso = (x: number, z: number): number => {
    const r = Math.hypot(x, z)
    if (r <= PODIO_R0) return 0
    const R3 = podioR3Em(x, z)
    if (r >= R3) return 0
    if (r >= PODIO_R1 && r <= PODIO_R2) return 1
    const t = r < PODIO_R1
      ? (r - PODIO_R0) / (PODIO_R1 - PODIO_R0)
      : (R3 - r) / (R3 - PODIO_R2)
    return t * t * (3 - 2 * t)
  }
  const heightAt = (x: number, z: number): number => {
    // ⚠️ A VALA DO CANAL ENTRA JUNTO COM A BACIA DO LAGO, no mesmo ponto e pelo
    // mesmo motivo: os dois são água, e água só aparece se o chão for cavado.
    //
    // ⚠️ OS RADIAIS SAEM DAQUI DESDE A QUARTA RODADA (05/09): `canalRadialAbsAt`
    // já devolve a cota PRONTA (perfil absoluto, ver a nota grande em
    // `CANAL_BANDA`), então quando ela responde não nulo é ELA que manda, sem
    // passar pelo peso `_kc`. `cavaEm` continua servindo só os anéis de canal
    // (hoje nenhum), com o mesmo blend por peso de sempre.
    const _bb = bbAt(x, z)
    const _canalAbs = canalRadialAbsAt(x, z)
    const _kc = cavaEm(x, z)
    const b0 = _canalAbs !== null
      ? _canalAbs
      : _leitoAbs !== undefined && _kc > 0
      ? _bb - _kc * Math.max(0, _bb - _leitoAbs)
      : _bb - _fundoC * _kc
    const _w = podioPeso(x, z)
    const b = _w > 0 ? b0 * (1 - _w) + PODIO_Y * _w : b0
    const lx = x - PARK_CENTER.x, lz = z - PARK_CENTER.z
    const r = Math.hypot(lx, lz)
    // ⚠️ O ALCANCE VEM DA DIREÇÃO, não de uma constante: curto no rumo da cidade
    // (onde fica o Portão do parque) e inteiro nos outros. Ver park-site.ts.
    const meia = parkReach(lx, lz), nucleo = parkCore(lx, lz)
    const bParque = r >= meia ? b : (() => {
      const k = r <= nucleo ? 1 : 1 - (r - nucleo) / (meia - nucleo)
      const kk = k * k * (3 - 2 * k)
      return b - kk * Math.max(0, b - (parkDatum - PARK_PIT))
    })()
    // ⚠️ O MICRO-RELEVO DO TERRENO FINO ENTRA AQUI, E É A ARMADILHA 1 DO
    // BLOCO A: se ele existisse só na malha desenhada, peça, rua, poste,
    // árvore e câmera (que pousam todos em `heightAt`/`superficieAt`, não na
    // malha) ficariam flutuando ou afundadas sobre o chão que a tela mostra.
    // `microRelevoAt` devolve 0 sem a bandeira `?terreno=fino` (checado na
    // primeira linha dela), então esta soma é `bParque + 0 = bParque` bit a
    // bit quando a bandeira está desligada. Ver o cabeçalho de `terreno-fino.ts`.
    //
    // ⚠️ O PARQUE DE INVERNO ENTRA PELO MESMO CONTRATO. `alturaInvernoAt`
    // esculpe o maciço oeste (ver o cabeçalho de `inverno.ts`) e devolve 0 na
    // primeira linha sem `?inverno=1`: esta soma continua bit a bit igual a
    // hoje com a bandeira desligada. Somado DEPOIS do micro-relevo, na mesma
    // ordem em que `terreno-fino.ts` já soma depois de tudo o mais: os dois
    // relevos aditivos não competem, eles se empilham.
    return bParque + microRelevoAt(x, z) + alturaInvernoAt(x, z)
  }

  // ⚠️ CONTRATO NOVO, DEPOIS DE A MALHA GROSSA SER MASCARADA (não mais
  // desenhada) por baixo do clipmap fino: com `?terreno=fino` ligado, esta
  // função é `return heightAt(x, z)`, ponto final, sem depender de qual
  // nível do clipmap cobre o ponto nem de onde a câmera está agora.
  //
  // A tentação era responder pela malha que está desenhada NESTE instante
  // (o clipmap perto, a grade de 59 m longe): foi descartada porque a
  // resposta para o MESMO (x, z) mudaria conforme a câmera anda (o clipmap
  // é centrado nela), e árvore, poste e câmera pousam nesta função uma vez
  // e não esperam que o chão debaixo deles se mova depois. `heightAt` é
  // pura em (x, z); o único resíduo de dependência de câmera que ela carrega
  // é o próprio micro-relevo (até 12 cm, orçado e aceito), não a escolha de
  // malha. Ver a armadilha 3 no cabeçalho de `terreno-fino.ts`.
  //
  // Sem a bandeira, nada disto roda: o caminho de baixo (a mesma superfície
  // que a malha grossa desenha, achando a célula da grade e interpolando
  // linear, com a grade do sítio e a faixa fina do lago) continua sendo a
  // resposta inteira, exatamente como antes deste bloco existir.
  const superficieAt = (x: number, z: number): number => {
    if (TERRENO_FINO_ATIVO) return heightAt(x, z)
    const ci = Math.floor(x / cell + half), cj = Math.floor(z / cell + half)
    if (ci < 0 || cj < 0 || ci >= n - 1 || cj >= n - 1) return heightAt(x, z)
    // ⚠️ DENTRO DA FAIXA DO LAGO A MALHA É OUTRA. Ver `naFaixa`: ali a célula
    // grossa é subdividida em LAGO_SUB por lado, então o triângulo que o olho vê
    // é o fino. Perguntar pela grade de 59 m aqui devolveria a resposta da malha
    // que NÃO existe mais naquele pedaço.
    const fino = naFaixa(ci, cj)
    const passo = fino ? cell / LAGO_SUB : cell
    const ox = (ci - half) * cell, oz = (cj - half) * cell
    const fi = fino ? (x - ox) / passo : x / cell + half
    const fj = fino ? (z - oz) / passo : z / cell + half
    const i = Math.floor(fi), j = Math.floor(fj)
    const u = fi - i, v = fj - j
    const H = fino
      ? (ii: number, jj: number) => heightAt(ox + ii * passo, oz + jj * passo)
      : (ii: number, jj: number) => heightAt((ii - half) * cell, (jj - half) * cell)
    const ya = H(i, j), yb = H(i + 1, j), yc = H(i, j + 1)
    if (u + v <= 1) return ya + (yb - ya) * u + (yc - ya) * v
    const yd = H(i + 1, j + 1)
    return yd + (yb - yd) * (1 - v) + (yc - yd) * (1 - u)
  }

  // ── a malha única: grade do sítio + anéis da saia soldados na borda ────────
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const col = new THREE.Color()
  // ⚠️ A COR POR VÉRTICE MULTIPLICA O MAPA, e é aqui que a armadilha mora.
  // `regolithColor` devolve BASE (#3f3d3a, 0,0497 linear) VEZES um fator de
  // sombreamento; vestir o material por cima disso multiplicaria a receita
  // do regolito por 0,05 e o chão sairia preto e sujo. A escolha foi deixar
  // a TEXTURA mandar no tom e a cor por vértice guardar só o que ela sabe e
  // a textura não: o relevo, o ruído por vértice e o escurecimento com a
  // distância. Por isso o valor vira cinza normalizado (BASE sai da conta) e
  // volta pela tinta TINTA_REGOLITO do material.
  // A alternativa, desligar `vertexColors`, foi descartada: perderia o
  // escurecimento de 26 km do horizonte, que é o que dá profundidade à saia
  // e não tem como vir de um ladrilho de 90 m.
  //
  // ⚠️ EXTRAÍDA DE `push` PARA `terreno-fino.ts` PODER REUSAR, sem duplicar a
  // conta nem importar este arquivo (ciclo: `terrain.ts` importa
  // `terreno-fino.ts` para o micro-relevo). Comportamento idêntico ao que
  // `push` fazia inline, nenhum número muda.
  const corVertice = (x: number, z: number, relief: number, out: THREE.Color): THREE.Color => {
    regolithColor(x, z, relief, Math.hypot(x, z), out)
    // ⚠️ ROCHA EXPOSTA, SÓ DENTRO DA ZONA DO PARQUE. `zonaEsquiavelAt` é 0 em
    // praticamente todo o sítio (a zona é um arco de 40° a 7-8,6 km do
    // centro), então o early-exit poupa as duas chamadas extras de `heightAt`
    // (a diferença central da inclinação) em toda a cidade. Sem `?inverno=1`
    // `zonaEsquiavelAt` já é 0 na primeira linha: esta soma é `out` puro,
    // bit a bit, exatamente como antes desta mistura existir.
    const zona = zonaEsquiavelAt(x, z)
    if (zona > 0) {
      const d = 20
      const dhx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d)
      const dhz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d)
      const inc = (Math.atan(Math.hypot(dhx, dhz)) * 180) / Math.PI
      const fRocha = fatorRochaAt(x, z, inc)
      if (fRocha > 0) out.lerp(ROCHA_PICO, fRocha)
    }
    if (look2) {
      const s = out.r / BASE.r
      return out.set(s, s, s)
    }
    return out
  }
  const push = (x: number, y: number, z: number, relief: number) => {
    positions.push(x, y, z)
    corVertice(x, z, relief, col)
    colors.push(col.r, col.g, col.b)
    // UV em MUNDO dividido por UV_ESCALA. ⚠️ NÃO É `vestir(mat, nome, 1)`: o
    // `repeat` de `vestir` é `max(1, mundo/metros)` e o piso trava em 1, então
    // UV em metros crus daria um ladrilho por metro. Com UV em quilômetros e
    // `mundo = UV_ESCALA` a conta fecha: repeat = 1000/90 e o ladrilho mede
    // exatamente 90 m de mundo, em qualquer ponto da malha, sítio ou saia.
    uvs.push(x / UV_ESCALA, z / UV_ESCALA)
    return positions.length / 3 - 1
  }
  // grade do sítio: índice j*n+i
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i - half) * cell, z = (j - half) * cell
      const y = heightAt(x, z)
      push(x, y, z, y - mean)
    }
  }
  // ── ⚠️ O TALUDE DO LAGO NÃO CABE NA GRADE DO SÍTIO, E ERA A CAUSA RAIZ ────
  //
  // A grade tem `cellSizeM` 59,225 m (`btc-core-heightmap.json`) e o talude do
  // lago mede 55: são 0,93 vértice atravessando o barranco INTEIRO. Medi em 720
  // rumos o desvio entre o `heightAt` analítico, que é onde toda peça pousa, e a
  // malha que o olho vê: 14,43 m no rumo 45°, em r 1.053,5. Ou seja, a faixa de
  // areia enterrava 14 m num rumo e pairava no outro, e o barranco na tela era
  // meia dúzia de triângulos gigantes de transição. Isso é rampa de skate por
  // construção, e nenhum conserto de perfil ou de cor sobrevive a ela.
  //
  // O conserto refina SÓ AS FAIXAS ONDE A CURVA TEM QUINA, em `LAGO_SUB` por
  // lado (ver o comentário de `FAIXA` acima: com a bacia virando reta em
  // 05/09, segunda rodada, a maior parte do talude deixou de precisar de malha
  // fina, e sobraram três faixas curtas em vez de duas largas).
  //
  // ⚠️ E A BORDA DA FAIXA NÃO PODE RACHAR. Vértice novo numa aresta que o
  // vizinho NÃO subdividiu é junta em T: pousado no `heightAt`, ele abre fenda.
  // Aqui ele é interpolado LINEARMENTE na aresta grossa, ou seja fica exatamente
  // em cima da reta que o vizinho desenha. E não custa nada de forma: a
  // vizinhança de cada faixa é sempre um trecho reto ou plano da própria
  // `bacia()`, então ali o interpolado e o real são o MESMO ponto.
  let celulasFinas = 0
  const refina = (i: number, j: number) => {
    celulasFinas++
    const K = LAGO_SUB
    const x0 = (i - half) * cell, z0 = (j - half) * cell
    // as alturas dos quatro cantos grossos, para interpolar as arestas de junta
    const y00 = heightAt(x0, z0), y10 = heightAt(x0 + cell, z0)
    const y01 = heightAt(x0, z0 + cell), y11 = heightAt(x0 + cell, z0 + cell)
    const eO = !naFaixa(i - 1, j), eL = !naFaixa(i + 1, j)
    const eN = !naFaixa(i, j - 1), eS = !naFaixa(i, j + 1)
    const base = positions.length / 3
    for (let v = 0; v <= K; v++) {
      for (let u = 0; u <= K; u++) {
        const fu = u / K, fv = v / K
        const x = x0 + cell * fu, z = z0 + cell * fv
        const junta = (u === 0 && eO) || (u === K && eL) || (v === 0 && eN) || (v === K && eS)
        const y = junta
          ? y00 * (1 - fu) * (1 - fv) + y10 * fu * (1 - fv) + y01 * (1 - fu) * fv + y11 * fu * fv
          : heightAt(x, z)
        push(x, y, z, y - mean)
      }
    }
    for (let v = 0; v < K; v++) {
      for (let u = 0; u < K; u++) {
        const a = base + v * (K + 1) + u, b = a + 1, c = a + (K + 1), d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
  }
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      if (naFaixa(i, j)) { refina(i, j); continue }
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  if (typeof window !== 'undefined') (window as unknown as { __lagoFinas?: number }).__lagoFinas = celulasFinas
  // o perímetro, em ordem, começando no canto (i=0,j=0) e girando
  const perimeter: number[] = []
  for (let i = 0; i < n - 1; i++) perimeter.push(0 * n + i)
  for (let j = 0; j < n - 1; j++) perimeter.push(j * n + (n - 1))
  for (let i = n - 1; i > 0; i--) perimeter.push((n - 1) * n + i)
  for (let j = n - 1; j > 0; j--) perimeter.push(j * n + 0)
  const P = perimeter.length
  // anéis da saia: escalas multiplicativas a partir do ponto de borda
  // anéis fechados perto da borda (triângulos curtos, sombreamento sem raias) e
  // abertos longe, onde ninguém vê a diferença
  const SCALES = [1.03, 1.07, 1.12, 1.19, 1.28, 1.4, 1.56, 1.78, 2.08, 2.5, 3.1, 4.0, 5.4, 7.6, 11.0, 16.0]
  // ⚠️ OS MARCADORES DA SAIA SÃO LIDOS AQUI, e não recalculados de `n`. O
  // refinamento do talude insere vértices e índices ENTRE a grade e a saia, e as
  // duas contas antigas (`perimeter.length + n * n` e `(n - 1) * (n - 1) * 6`)
  // passariam a apontar para o meio do barranco.
  const saiaVert = positions.length / 3
  const saiaIdx = indices.length
  let prevRing = perimeter
  for (const s of SCALES) {
    const ring: number[] = []
    for (let k = 0; k < P; k++) {
      const pi = perimeter[k]
      const bx = positions[pi * 3], bz = positions[pi * 3 + 2]
      const x = bx * s, z = bz * s
      const y = heightAt(x, z)
      ring.push(push(x, y, z, y - mean))
    }
    for (let k = 0; k < P; k++) {
      const a = prevRing[k], b = prevRing[(k + 1) % P], c = ring[k], d = ring[(k + 1) % P]
      indices.push(a, b, c, b, d, c)
    }
    prevRing = ring
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  // Enrolamento medido, não adivinhado: se a normal no centro apontar para
  // baixo, inverte todos os triângulos e recalcula. O mesmo teste vale para a
  // saia porque ela segue o mesmo sentido de giro do perímetro.
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const centerIdx = Math.floor(n / 2) * n + Math.floor(n / 2)
  if (nrm.getY(centerIdx) < 0) flipWinding(geo)
  const skirtProbe = saiaVert // primeiro vértice do primeiro anel da saia
  if ((geo.attributes.normal as THREE.BufferAttribute).getY(Math.min(skirtProbe, positions.length / 3 - 1)) < 0) {
    // a saia veio ao contrário da grade: inverte só os triângulos da saia
    const idx = geo.getIndex()!
    const start = saiaIdx
    for (let k = start; k < idx.count; k += 3) { const b = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, b) }
    idx.needsUpdate = true
    geo.computeVertexNormals()
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  if (look2) {
    // ⚠️ 90 m DE LADRILHO, E O NÚMERO É O TRABALHO TODO. O padrão da receita é
    // ⚠️ O LADRILHO ENCOLHEU DE 90 m PRA 14 m EM 01/09, E O MOTIVO É O INVERSO
    // DO QUE PARECE. Ladrilho grande era a defesa contra repetição enquanto a
    // receita tinha 56 CRATERAS carimbadas: feição reconhecível repetindo de 90
    // em 90 m desenhava um xadrez, e foi a queixa do fundador ("são as mesmas
    // marcas por todo o terreno"). Tiradas as crateras (ver materiais.ts), a
    // textura não tem mais nenhuma feição que o olho saiba identificar, e aí
    // ladrilho grande deixou de ser defesa e virou DEFEITO: com 90 m de lado num
    // mapa de 512 px, um texel mede 0,176 m e o grão mais fino que cabe é de
    // 0,35 m, então de perto o ruído virava mancha de 2 a 3 m. Com o sol rasante
    // desta cena, mapa de normal em mancha desse tamanho vira camuflagem.
    //
    // Com 14 m o texel cai pra 0,027 m e o grão fica na escala de pó de verdade,
    // que é o que a luz rasante quer. A repetição não volta porque não há o que
    // reconhecer, e o que sobra de escala grande vem do `quebrarRepeticao`, que
    // trabalha em coordenada de MUNDO e não repete nunca.
    //
    // ⚠️ E A FORÇA DO NORMAL CAIU JUNTO. Sob luz rasante o normal é o parâmetro
    // que mais engana: forte demais e o chão vira plástico granulado. Aqui ele
    // serve pra amaciar a luz, não pra ser visto.
    mat.color = new THREE.Color(TINTA_REGOLITO)
    vestir(mat, 'regolito', UV_ESCALA, { metros: 14, normal: 0.55, macroMetros: 1400 })
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.name = 'Regolith'
  mesh.frustumCulled = false

  const group = new THREE.Group()
  group.add(mesh)
  return { group, heightAt, horizonAt: heightAt, superficieAt, baseAt, meanHeight: mean, halfExtent,
           lago: { r0: LAGO_R0, r1: LAGO_R1, agua: LAGO_AGUA_Y, fundo: -LAGO_FUNDO },
           corAt: corVertice, uvEscala: UV_ESCALA, material: mat }
}

function flipWinding(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex()!
  for (let k = 0; k < idx.count; k += 3) { const b = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, b) }
  idx.needsUpdate = true
  geo.computeVertexNormals()
}

function fract(v: number) {
  return v - Math.floor(v)
}
