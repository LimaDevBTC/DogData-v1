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
  const _radiais = (cava?.radiais ?? []).map((r) => ({
    ...r, dx: Math.sin((r.rumo * Math.PI) / 180), dz: -Math.cos((r.rumo * Math.PI) / 180),
    // ⚠️ SEM ESTE FIM A VALA VAI ATÉ O INFINITO. Ver o comentário em plaza-scene.
    rFim: r.rFim ?? Infinity,
  }))
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
  /** quanto o chão desce naquele ponto, de 0 (fora) a 1 (no eixo) */
  const cavaEm = (x: number, z: number): number => {
    let k = 0
    for (const r of _radiais) {
      const t = x * r.dx + z * r.dz
      if (t < r.rInicio - 40 || t > r.rFim + _tal) continue
      const d = Math.abs(x * r.dz - z * r.dx)     // distância ao eixo
      const meia = r.secao / 2
      if (d < meia) k = Math.max(k, 1)
      else if (d < meia + _tal) k = Math.max(k, 1 - (d - meia) / _tal)
    }
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
  // O platô da praça: dentro de 960 m o chão é plano no nível 0 (o deck, as
  // âncoras e o jardim inteiro, até a muralha em 900, foram desenhados sobre um
  // plano), e daí até 1300 m ele volta suavemente ao relevo real.
  // ⚠️ O PLATÔ FOI ESTENDIDO DE 960 PARA 1.340 m, E ISSO FOI MEDIDO ANTES.
  // Ele parava em 960 e o chão voltava ao relevo real até 1.300, que é onde o
  // lote começa. Sonda de 36 rumos: em r 1.300 o regolito ia de -18,7 a +25,1,
  // ou seja 43,8 m de amplitude só por rumo. Enquanto ali era só transição isso
  // não incomodava ninguém; a partir do momento em que o anel vira LAGO, uma
  // lâmina plana afundaria 18,7 m de um lado e boiaria 25,1 m do outro.
  // Com o platô até 1.340 o anel inteiro fica no nível 0 e a bacia pode ser
  // escavada nele com margem constante. A volta ao relevo real passa a ser de
  // 1.340 a 1.700, fora do lago e por baixo da primeira fileira de quarteirões,
  // que continuam acompanhando o chão como sempre acompanharam.
  const PLATO_R = 1470, PLATO_FIM = 1830
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
  // ⚠️ O PERFIL DEIXOU DE SER UM `smoothstep` ÚNICO EM 02/09, E ELE ERA A CAUSA
  // DA "PISTA DE SKATE" QUE O FUNDADOR APONTOU. Medido no perfil antigo (talude
  // de 40 m para 26 m de queda, lâmina em −17): a inclinação ia de 0° em r 1.050
  // a 44,3° em r 1.070, e a linha d'água caía em r 1.074,2, ou seja EM CIMA da
  // parte mais íngreme, a 43,0°. Uma tigela analítica, igual nos 360°, com uma
  // fita clara de largura constante colada por cima. Areia não era possível ali:
  // `w = 1,5 / inclinação` dava 1,6 m na linha d'água.
  //
  // Agora o talude tem TRÊS TRECHOS e a linha d'água cai no do meio:
  //   A   0 a 42% do talude    0 -> `seca`             smoothstep, o banco seco
  //   B   42% a 74%            `seca` -> +BANQUETA     LINEAR, a banqueta rasa
  //   C   74% a 100%           -> LAGO_FUNDO           smoothstep, o mergulho
  // A derivada do `smoothstep` é ZERO nas duas pontas, então A entra em B sem
  // quina, sem precisar de concordância à mão.
  //
  // ⚠️ E O TALUDE VARIA COM O RUMO, senão o conserto entrega o mesmo anel
  // perfeito, só que mais bonito. Dois harmônicos (o raciocínio do
  // `contornoIlha`) mexem no COMPRIMENTO do talude e na ALTURA do banco seco: a
  // linha d'água anda dentro da banqueta e a areia nasce larga na enseada e
  // estreita na ponta, sem nenhuma decisão binária para oscilar em volta.
  //
  // ⚠️ AS FOLGAS SÃO MEDIDAS, NÃO CHUTADAS. A praça vai até r 1.024 (monumentos
  // e Calçada dos Fundadores, desenhados sobre platô plano) e o anel da orla
  // passou de r 1.440 para r 1.465, aresta interna em 1.452. Com R0 = 1.100 e
  // talude interno de 43 a 67 m, o topo do barranco fica entre r 1.033 e 1.057:
  // 9 m livres da praça no pior rumo. Com talude externo de 47 a 57 m, o pé fica
  // entre r 1.437 e 1.447: 5 m livres do anel no pior rumo.
  const LAGO_R0 = 1100, LAGO_R1 = 1390     // o fundo plano da bacia
  // ⚠️ FUNDO 14 E NÃO 26. Com 26 o trecho C caía 12,4 m em 14,3 m (52°) logo
  // depois da praia, e areia rasa que vira penhasco a 5 m da beira lê como
  // piscina. Com 14 o mergulho fica em 34° e a lâmina tem 7,5 m: é lago, não fosso.
  const LAGO_FUNDO = 14
  const LAGO_TAL_A = 0.42, LAGO_TAL_B = 0.74   // as duas dobras, em fração do talude
  const LAGO_BANQUETA = 1.6                    // a queda dentro da banqueta
  const LAGO_AGUA_Y = -6.5                     // a cota da lâmina
  const lagoMod = (x: number, z: number): number => {
    const a = Math.atan2(z, x)
    return Math.sin(a * 3 + 0.7) * 0.62 + Math.sin(a * 5 - 1.4) * 0.38
  }
  const bacia = (x: number, z: number): number => {
    const r = Math.hypot(x, z)
    if (r > LAGO_R0 && r < LAGO_R1) return LAGO_FUNDO
    const m = lagoMod(x, z)
    const fora = r >= LAGO_R1
    const T = fora ? 52 + 5 * m : 55 + 12 * m
    const seca = 5.7 + 0.7 * m
    const s = fora ? (LAGO_R1 + T - r) / T : (r - (LAGO_R0 - T)) / T
    if (s <= 0) return 0
    if (s >= 1) return LAGO_FUNDO
    if (s < LAGO_TAL_A) {
      const t = s / LAGO_TAL_A
      return seca * (t * t * (3 - 2 * t))
    }
    if (s < LAGO_TAL_B) return seca + LAGO_BANQUETA * ((s - LAGO_TAL_A) / (LAGO_TAL_B - LAGO_TAL_A))
    const t = (s - LAGO_TAL_B) / (1 - LAGO_TAL_B)
    const d0 = seca + LAGO_BANQUETA
    return d0 + (LAGO_FUNDO - d0) * (t * t * (3 - 2 * t))
  }
  // ⚠️ A FAIXA REFINADA DO TALUDE, DECLARADA AQUI PORQUE O `superficieAt`
  // PRECISA DELA. Quem pousa peça no barranco pergunta ao `superficieAt`, e ele
  // interpola a MALHA, não a curva. Se ele continuasse lendo a grade de 59 m
  // enquanto a malha desenha a de 4,9 m, a areia voltaria a enterrar, só que
  // menos. Passo fino medido: 59,225 / 12 = 4,94 m.
  const LAGO_SUB = 12
  const FAIXA: [number, number][] = [[1025, 1110], [1385, 1455]]
  const naFaixa = (i: number, j: number): boolean => {
    // ⚠️ PORTA RÁPIDA, e ela não é otimização prematura: `superficieAt` chama
    // isto, e `superficieAt` é o trava-chão da câmera (todo quadro) e o pouso de
    // 86 mil lotes. Uma raiz quadrada no caso comum em vez de quatro.
    const rc = Math.hypot((i + 0.5 - half) * cell, (j + 0.5 - half) * cell)
    if (rc < FAIXA[0][0] - cell || rc > FAIXA[1][1] + cell) return false
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
    // ⚠️ COM `leito`, A VALA VAI ATÉ UMA COTA, NÃO ATÉ UMA PROFUNDIDADE. `cavaEm`
    // devolve o peso da vala (1 no eixo, caindo a 0 no fim do talude), e o corte
    // interpola do chão até a cota do leito por esse peso: no eixo o fundo é
    // exatamente `leito`, na borda do talude é o chão, e no meio é a rampa.
    const _kc = cavaEm(x, z)
    const _bb = baseAt(x, z) - bacia(x, z) + monteEm(x, z)
    const b0 = _leitoAbs !== undefined && _kc > 0
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
  // O conserto refina SÓ AS DUAS FAIXAS DO TALUDE, em `LAGO_SUB` por lado.
  // Refinar o anel inteiro (r 1.000 a 1.460) seriam 977 células da grade; as
  // duas faixas são 341, medidas pela área: π(1110² − 1025²) e π(1455² − 1385²)
  // divididas por 59,225². O número real conferido está no relatório.
  //
  // ⚠️ E A BORDA DA FAIXA NÃO PODE RACHAR. Vértice novo numa aresta que o
  // vizinho NÃO subdividiu é junta em T: pousado no `heightAt`, ele abre fenda.
  // Aqui ele é interpolado LINEARMENTE na aresta grossa, ou seja fica exatamente
  // em cima da reta que o vizinho desenha. E não custa nada de forma: a
  // vizinhança da faixa é platô plano de um lado (o topo do barranco fica em
  // r 1.033 no pior rumo, dentro da faixa) e fundo plano do outro (r 1.100 a
  // 1.390), então ali o interpolado e o real são o MESMO ponto.
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
