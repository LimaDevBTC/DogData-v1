// ═══════════════════════════════════════════════════════════════════════════
// A TEIA: a definição única da malha viária da cidade.
//
// ⚠️ ELA MORA AQUI E NÃO EM `vias.ts` PORQUE TEM DOIS DONOS. Quem desenha a rua
// é `vias.ts`; quem encaixa as peças do programa entre as ruas é `programa.ts`.
// Enquanto os números viviam dentro do módulo que desenha, o alocador de peças
// usava a grade ANTIGA (a do gerador, por banda de quarteirão) e a rua usava
// esta: as peças caíam rente à teia em vez de emolduradas por ela, que foi o que
// o fundador apontou ("as peças extras não conversam com as ruas").
//
// ⚠️ E A RUA É A ESTRUTURA PRIMÁRIA. O quarteirão é o que sobra entre elas, e a
// peça do programa é um NÚMERO INTEIRO de módulos. Nessa ordem nada quebra: a
// peça tem rua nos quatro lados por construção, porque os lados dela SÃO ruas.
//
// A conta, que é o que o fundador pediu ("conte o número de ruas que precisamos"):
//   26 anéis completos  ·  256 radiais em três níveis  ·  6.656 cruzamentos em X
// ═══════════════════════════════════════════════════════════════════════════

/** o anel viário interno, onde a teia começa */
export const R_DENTRO = 1450
/** a borda do tecido, onde ela termina */
export const R_FORA = 6900
/** meia largura da rua da teia (a seção inteira tem 12 m) */
export const HR = 6

/**
 * ⚠️ O VÃO ENTRE ANÉIS CRESCE POR CLASSE, e são as mesmas classes de
 * profundidade que o gerador usa para o quarteirão (109/168/227/286 mais a rua).
 * Vão constante daria quarteirão de 122 m na Cinta, que é lote de fundo de vale,
 * e de 298 m no núcleo, que é superquadra.
 */
export function vaoDoAnel(r: number): number {
  return r < 2200 ? 122 : r < 3400 ? 180 : r < 5000 ? 239 : 298
}

/** os 26 raios, do anel interior à borda */
export const ANEIS: readonly number[] = (() => {
  const out: number[] = []
  for (let r = R_DENTRO; r <= R_FORA; r += vaoDoAnel(r)) out.push(r)
  return out
})()

/**
 * ⚠️ DOIS NÍVEIS, 84 E 168, E A DOBRA NASCE EM CIMA DE UM ANEL.
 *
 * ⚠️ A VERSÃO ANTERIOR TINHA TRÊS NÍVEIS (64/128/256) E DOIS DEFEITOS, os dois
 * apontados pelo fundador em 31/08: "temos radiais sem a menor conexão, algumas
 * formam quarteirões absolutamente pequenos... podemos reduzir e padronizar".
 *
 *   1. OS RAIOS DE NASCIMENTO ERAM NÚMEROS REDONDOS (2.900 e 5.800) e não caíam
 *      em anel nenhum: medido, 56 m e 33 m fora do anel mais próximo. Um radial
 *      que nasce fora de anel começa NO MEIO de uma face de quarteirão, sem nada
 *      para encontrar — é literalmente o radial sem conexão. E o toco de 56 m
 *      entre o anel e o nascimento é o quarteirão minúsculo.
 *   2. TRÊS NÍVEIS ERAM MAIS DO QUE A CIDADE PRECISA. Dois entregam testada de
 *      108 a 253 m, que é melhor do que os 142 a 285 dos três, com 168 radiais
 *      em vez de 256.
 *
 * A dobra agora é `ANEIS[13]` — o índice, não um número: se o vão dos anéis
 * mudar, ela continua em cima de um anel por construção.
 */
export const N_RAD = 168

export const NIVEIS: readonly { passo: number; r0: number }[] = [
  { passo: 2, r0: ANEIS[0] },    //  84 radiais, testada 108 m em 1.450
  { passo: 1, r0: ANEIS[13] },   // +84 radiais, testada 127 m em 3.384
]

/** o raio em que o radial de índice `i` nasce, ou null se ele não existe */
export function nasceEm(i: number): number | null {
  for (const n of NIVEIS) if (i % n.passo === 0) return n.r0
  return null
}

/** o ângulo do radial de índice `i`, em radianos */
export const anguloDe = (i: number) => (i / N_RAD) * Math.PI * 2

/** quantos índices de 256 vale um passo de módulo naquele raio */
export function passoNoRaio(r: number): number {
  for (const n of NIVEIS) if (r >= n.r0) return n.passo
  return 4
}

/**
 * O MÓDULO: a célula entre dois anéis e dois radiais vizinhos ATIVOS naquele
 * raio. É a unidade em que o programa da cidade se mede.
 *
 * ⚠️ O PASSO ATIVO MUDA COM O RAIO, então o módulo do anel 3 não tem a mesma
 * largura angular do módulo do anel 20. Uma peça que ocupa `ns` módulos ocupa
 * `ns × passo` índices de 256, e é isso que a torna encaixável em qualquer faixa.
 */
export interface Modulo {
  /** índice do anel de dentro */
  i: number
  /** quantos anéis a peça ocupa */
  nr: number
  /** índice do radial de dentro, em 256 */
  j: number
  /** quantos módulos no ângulo */
  ns: number
}

/**
 * O retângulo em (raio, ângulo) que um bloco de módulos ocupa, já com recuo de rua.
 *
 * ⚠️ O RAIO SAI CORRIGIDO PELA ESQUADRIA DO POLÍGONO. O anel é polígono, não
 * círculo (a teia tem arestas retas), então o raio do anel é a APÓTEMA e o
 * vértice está em apótema/cos(π/N). Sem a correção a parcela ficaria com as
 * quinas de fora da rua: o erro é a flecha da corda, de 0,44 a 2,41 m conforme o
 * anel — pequeno, e visível justamente na quina, que é onde o olho vai.
 */
export function caixaDoModulo(m: Modulo) {
  const rmBruto = (ANEIS[m.i] + ANEIS[Math.min(ANEIS.length - 1, m.i + m.nr)]) / 2
  const passo = passoNoRaio(rmBruto)
  // ⚠️ `r0` e `r1` SÃO APÓTEMAS, não raios de círculo. A mitra de 1/cos(π/84)
  // que estava aqui corrigia a esquadria do polígono de 84 lados; com 12 faces
  // quem faz essa correção é `raioDodeca()`, no ponto, porque a diferença entre
  // apótema e raio agora depende do RUMO e chega a 3,5%.
  const r0 = ANEIS[m.i] + HR
  const r1 = ANEIS[Math.min(ANEIS.length - 1, m.i + m.nr)] - HR
  const rm = (r0 + r1) / 2
  const a0 = anguloDe(m.j) + HR / rm
  const a1 = anguloDe(m.j + m.ns * passo) - HR / rm
  return { r0, r1, a0, a1, rm, passo }
}

/**
 * O raio do ANEL DODECAGONAL no rumo `ang`, dado o raio do círculo inscrito.
 *
 * ⚠️ A MALHA INTEIRA SEGUE 12 FACES, e isso é decisão do fundador (06/09): "a
 * malha viária da cidade inteira tem que seguir a base original de 12 faces, com
 * arestas e esquinas bem definidas". Antes o anel era um polígono de 84 lados,
 * um por radial, e 84 lados não é polígono aos olhos de ninguém: a flecha da
 * corda ia de 1,0 m no anel interno a 4,7 m no externo, ou seja 0,03% do raio.
 * Lia como círculo, e era isso que ele não queria. Com 12 faces a flecha vai a
 * 229 m e a esquina existe.
 *
 * ⚠️ OS VÉRTICES CAEM NAS 12 AVENIDAS, não entre elas. A esquina do anel
 * acontece no cruzamento com a avenida radial, que é onde uma cidade de verdade
 * põe a praça de esquina. Por isso o deslocamento de 15° em `_rel`: a 30° exatos
 * (`AVENIDAS`) fica o vértice, e a 15° dele fica o meio da face.
 *
 * `r` é a APÓTEMA (a menor distância do centro à face). No vértice o raio sobe
 * para `r / cos(15°)`, 3,5% a mais.
 */
export function raioDodeca(r: number, ang: number): number {
  const PASSO = Math.PI / 6            // 30°, o setor de uma face
  let rel = ((ang % PASSO) + PASSO) % PASSO - PASSO / 2
  return r / Math.cos(rel)
}

/**
 * O raio do ANEL VIÁRIO DESENHADO no rumo `ang`, dado o raio do VÉRTICE.
 *
 * ⚠️ ESTA É A ÚNICA VERDADE DO ANEL, E ELA EXISTE PORQUE HAVIA TRÊS. Fundador,
 * 06/09: "o dodecaedro é a malha viária da cidade toda, o outro modelo gerava
 * círculos, pode excluir". Antes daqui conviviam:
 *   · `vias.ts`, que DESENHA o anel como dodecágono com o vértice em `an.r` e a
 *     face em `an.r·cos(15°)`, ou seja 96,6% dele;
 *   · cinco consumidores (ponte de canal, arborização, poste, estação de metrô,
 *     obra) que liam o mesmo `an.r` como CÍRCULO;
 *   · `raioDodeca()`, logo acima, que é o mesmo polígono mas com `r` valendo a
 *     APÓTEMA, o que devolve o dodecágono INSCRITO no círculo errado.
 * O círculo passa pelos 12 vértices e some do desenho no meio de cada face: o
 * erro é a flecha da corda, 3,5% do raio, de 61 m no Anel Interior a 259 m na
 * Pista de Serviço. Era isso que punha ponte de canal fora do asfalto e fileira
 * de árvore no meio do quarteirão.
 *
 * ⚠️ `r` AQUI É O VÉRTICE, NÃO A APÓTEMA, porque é assim que `vias.ts` desenha
 * (`pt(an.r, a0)` nos 12 rumos de `AVENIDAS`). Quem tiver apótema em mãos usa
 * `raioDodeca`; quem tiver `aneisViarios[].r` usa esta.
 */
export function anelRaio(r: number, ang: number): number {
  const PASSO = Math.PI / 6            // 30°, o setor de uma face
  const rel = ((ang % PASSO) + PASSO) % PASSO - PASSO / 2
  return (r * Math.cos(PASSO / 2)) / Math.cos(rel)
}

/** o ponto (x,z) do anel viário desenhado, no rumo `ang` */
export function anelPonto(r: number, ang: number): [number, number] {
  const rr = anelRaio(r, ang)
  return [Math.sin(ang) * rr, -Math.cos(ang) * rr]
}

/**
 * A AVENIDA DA ALÇA: a única via da cidade que não é dodecágono.
 *
 * ⚠️ FUNDADOR, 07/09: "o último anel do dodecaedro fica exatamente sobre a alça
 * de terra que temos dentro da baía. Poderíamos abrir uma exceção e termos a via
 * em formato circular, arredondado, pra ela acompanhar o trajeto da alça, e a
 * via deve passar exatamente no meio, e terrenos de um lado e do outro. Os
 * terrenos terão praia de um lado e pista do outro."
 *
 * ⚠️ E A PREMISSA ESTAVA ERRADA POR 300 m, O QUE SÓ MELHORA A IDEIA. A AN7 NÃO
 * estava sobre a alça: medido em 07/09 nos 262 rumos do arco
 * (`scripts/city/alca-varredura.mjs`), o dodecágono de vértice 7.600 cai na
 * terra em 53 rumos e NA ÁGUA EM 209. A margem externa da alça está em r 7.300 e
 * o anel passava por fora dela. Era esse o aterro de 436.788 m² que a
 * classificação de água deixava passar.
 *
 * ⚠️ OS NÚMEROS DA ALÇA, MEDIDOS E NÃO ESTIMADOS:
 *     arco    rumo 346° a 116,5°, 15,91 km
 *     largura mínima 680 m · mediana 740 · máxima 1.560
 *     margem interna (baía) r 6.580 · margem externa r 7.300
 *     meio    r 6.950, com desvio de 32 m ao longo dos 130,5°
 * Um círculo único em r 6.950 cai na terra nos 262 rumos com 40 m de folga de
 * cada lado; o desvio ao meio real é 10 m na mediana e 150 m no pior ponto. A
 * alça é um anel quase perfeito, então o círculo do fundador não é só mais
 * bonito, é a forma que o terreno tem.
 *
 * ⚠️ E O ORÇAMENTO DE TERRA FECHA COM FOLGA. Na largura mediana, tirando 30 m de
 * praia mais recuo de cada lado e os 44 m da via, sobram 318 m de profundidade
 * de lote POR LADO; no ponto mais estreito, 288 m. A classe mais funda de
 * quarteirão da cidade é 286 m. Cabe a fileira mais nobre que existe, dos dois
 * lados. No trecho mais largo (1.560 m) sobra tanto que uma fileira só ficaria
 * com 728 m de fundo: ali é caso de duas fileiras.
 */
export const AVENIDA_ALCA = {
  id: 'AN7',
  r: 6950,
  larg: 44,
  circulo: true,
  // ⚠️ O ARCO DA VIA VAI ALÉM DO ARCO DA ALÇA, E ISSO É O ACESSO. A alça medida
  // vai de 346 a 116,5 (`ALCA_TERRA`), mas nenhum dos 12 rumos de `AVENIDAS` cai
  // nas pontas dela: os vizinhos são 330 e 120, os dois DE FORA. Terminando no
  // arco da alça a avenida de 15,9 km virava duas ilhas, medido em 07/09 por
  // componente conexo: 453.060 m² a 54 m da rede e 233.676 m² a 186 m, com os
  // dois pontos de aproximação exatamente nas tampas. Levando as pontas até 330
  // e 120 ela morre EM CIMA das duas avenidas radiais, que já correm até 6.972,
  // e o acesso sai de graça, sem uma rua a mais na alça.
  //
  // ⚠️ E O TERRENO AGUENTA: sondados os rumos 320 a 135 de meio em meio grau nas
  // três cotas 6.928, 6.950 e 6.972, nenhuma amostra abaixo da lâmina.
  arco: [330, 120] as [number, number],
}

/**
 * O arco em que a alça É alça, ou seja onde há água dos dois lados.
 *
 * ⚠️ FUNDADOR, 07/09: "as outras ruas devem sair por completo da alça de terra.
 * Lá, por enquanto, teremos apenas a via central."
 *
 * ⚠️ E ELE NÃO É O MESMO ARCO DA VIA, de propósito. Este é o pedaço medido em
 * que a faixa de terra tem baía de um lado e água externa do outro, e é dentro
 * DELE que nenhuma outra rua pode existir. A via passa disso nas duas pontas
 * justamente para achar as radiais e sair da alça ligada.
 */
export const ALCA_TERRA: [number, number] = [346, 116.5]

/**
 * A lista de anéis do gerador com a exceção da alça já aplicada.
 *
 * ⚠️ PASSA POR AQUI QUEM DESENHA E QUEM SEGUE O ANEL, e isso é a lição de
 * `avenidasGeom()` logo abaixo: enquanto `vias.ts` corrigia a sua CÓPIA do JSON,
 * a arborização lia o JSON cru e plantava onde não havia rua. Substituir num
 * módulo só é substituir para quem lembra de olhar.
 */
export function aneisDaCidade<T extends { id?: string; r: number; larg: number }>(
  aneis: readonly T[],
): (T & { circulo?: boolean; arco?: [number, number] })[] {
  return aneis.map((a) =>
    a.id === AVENIDA_ALCA.id
      ? { ...a, r: AVENIDA_ALCA.r, larg: AVENIDA_ALCA.larg, circulo: true, arco: AVENIDA_ALCA.arco }
      : { ...a })
}

/** o rumo (em radianos) cai dentro do arco deste anel? */
export function noArcoDoAnel(an: { arco?: [number, number] }, ang: number): boolean {
  if (!an.arco) return true
  const g = (((ang * 180) / Math.PI) % 360 + 360) % 360
  const [a, b] = an.arco
  return a <= b ? g >= a && g <= b : g >= a || g <= b
}

/** a área em m² de um bloco de módulos (trapézio circular) */
export function areaDoModulo(m: Modulo): number {
  const c = caixaDoModulo(m)
  return ((c.a1 - c.a0) / 2) * (c.r1 * c.r1 - c.r0 * c.r0)
}

/**
 * O polígono do bloco, em mundo, para máscara e desenho.
 *
 * ⚠️ UM VÉRTICE POR RADIAL, NÃO UMA CURVA SUBDIVIDIDA. A parcela é limitada por
 * ruas, as ruas são cordas retas, então o lado da parcela é reto por definição. A
 * versão que subdividia em 6 passos desenhava uma curva onde a rua é reta, e a
 * diferença aparecia como uma lasca entre a parcela e a calçada.
 */
export function polyDoModulo(m: Modulo): [number, number][] {
  const c = caixaDoModulo(m)
  // ⚠️ O PONTO SAI SOBRE A FACE DO DODECÁGONO, não sobre o círculo: `raioDodeca`
  // é quem converte apótema em raio naquele rumo. Sem isso a parcela ficaria
  // encolhida em relação à rua que a limita, e a diferença aparece justamente na
  // quina, que é onde o olho vai.
  const pt = (r: number, a: number): [number, number] => {
    const rr = raioDodeca(r, a)
    return [Math.sin(a) * rr, -Math.cos(a) * rr]
  }
  const out: [number, number][] = []
  // ⚠️ E O VÉRTICE DA AVENIDA ENTRA NA LISTA. Um bloco largo pode atravessar uma
  // quina do dodecágono, e ligar as duas pontas em reta cortaria a esquina fora.
  const quinas: number[] = []
  for (let q = Math.ceil(c.a0 / (Math.PI / 6)); q * (Math.PI / 6) < c.a1; q++) {
    const a = q * (Math.PI / 6)
    if (a > c.a0 && a < c.a1) quinas.push(a)
  }
  const angs = [c.a0, ...quinas, c.a1]
  for (const a of angs) out.push(pt(c.r0, a))
  for (let k = angs.length - 1; k >= 0; k--) out.push(pt(c.r1, angs[k]))
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// AS AVENIDAS RADIAIS
//
// ⚠️ SÃO 12, A 30° EXATOS (fundador, 31/08: "estranho, os raios não estão
// simétricos"). E ele mediu certo: os 9 bulevares que a cidade tinha ficavam
// entre 5,6° e 73,1° um do outro, razão de TREZE VEZES. Eles não eram avenidas,
// eram as COSTURAS DOS 6 DISTRITOS, que têm larguras desiguais por projeto —
// serviam como divisa administrativa e nunca como estrutura viária.
//
// ⚠️ AVENIDA E DIVISA DE DISTRITO SÃO COISAS DIFERENTES, e confundir as duas foi
// o erro. A avenida é geometria da cidade e quer simetria; a divisa é do
// loteamento e segue o saldo das carteiras. Elas podem coincidir aqui e ali, e
// não têm obrigação de coincidir sempre.
//
// A hierarquia é a mínima que se lê de cima: 4 cardeais largas, 8 intermediárias.
// Com 7 anéis dá 84 cruzamentos, todos com rotatória.
export const AVENIDAS: readonly { rumo: number; largura: number; papel: string }[] =
  Array.from({ length: 12 }, (_, i) => ({
    rumo: i * 30,
    largura: i % 3 === 0 ? 44 : 34,
    papel: i % 3 === 0 ? 'distrito' : 'ponte',
  }))

/** onde a avenida nasce (rente ao platô) e onde ela morre */
export const AV_R_INICIO = 1420
/**
 * ⚠️ A AVENIDA PASSOU A MORRER NO ANEL DE SERVIÇO, E NÃO NA BORDA DO TECIDO.
 *
 * Era `R_FORA` (6.900), a borda do tecido, e por isso o ANEL DE SERVIÇO (AN7,
 * vértice em r 7.600) não tinha uma única avenida chegando nele: 15,2 km de
 * asfalto desenhado, 0,83 km² de pavimento, sem nenhuma ligação com o resto da
 * cidade. Auditado em 06/09 por componente conexo do pavimento desenhado
 * (`scripts/city/vias-varredura.mjs`): ele era, sozinho, a maior ilha do mapa,
 * a mais de 240 m de qualquer outra rua. Quebrava a regra que o fundador cobra
 * desde 31/08, "um carro tem que conseguir transitar entre todas as estradas do
 * mapa", e quebrava calado, porque na chapa um anel completo parece ligado.
 *
 * ⚠️ E O NÚMERO MUDOU DE 7.615 PARA 6.972 QUANDO A AN7 MUDOU DE RAIO. Ela era
 * um dodecágono de vértice 7.600 e virou a avenida circular da alça, em r 6.950
 * (ver `AVENIDA_ALCA` logo acima): 6.950 mais meia seção de 44 m dá 6.972, que é
 * onde a avenida radial entra na rotatória em vez de encostar nela.
 *
 * ⚠️ E ELA PARA AÍ, NÃO SEGUE ATÉ A PRAIA EXTERNA. O programa da alça é lote com
 * praia de um lado e pista do outro: uma radial furando até r 7.300 cortaria a
 * fileira de lotes ao meio e daria fundo de quarteirão para a praia. O acesso à
 * alça é pela avenida circular, nas quatro rotatórias que caem dentro do arco
 * (rumos 0, 30, 60 e 90).
 *
 * ⚠️ ISTO NÃO MEXE NO TECIDO NEM NO LOTE. `AV_R_INICIO` e `AV_R_FIM` são lidos
 * só dentro de `avenidasGeom()`; quem desenha o tecido é `ANEIS`, que continua
 * indo de `R_DENTRO` a `R_FORA`. A avenida atravessa a coroa externa, que não é
 * lotável, para chegar ao anel de serviço — que é para isso que serve uma
 * pista de serviço.
 */
export const AV_R_FIM = 6972

export interface AvenidaGeom {
  id: string
  rumo: number
  largura: number
  papel: string
  rInicio: number
  rFim: number
  x0: number
  z0: number
  x1: number
  z1: number
}

/**
 * A GEOMETRIA DAS AVENIDAS, EM UM LUGAR SÓ.
 *
 * ⚠️ ELA MORA AQUI PELO MESMO MOTIVO QUE O RESTO DA TEIA, E O MOTIVO SE PROVOU
 * SOZINHO EM 31/08. A construção vivia dentro de `vias.ts`, que trocava
 * `malha.bulevares` pelas 12 avenidas na SUA cópia do JSON. Só que
 * `arborizacao.ts` busca o mesmo JSON por conta própria e nunca viu a troca:
 * ela plantava nas 9 COSTURAS DE DISTRITO publicadas pelo gerador
 * (0, 61,9, 90, 106,9, 180, 185,6, 241,9, 270, 309,4) enquanto a rua era
 * desenhada nas 12 simétricas (0, 30, 60 ... 330).
 *
 * O que o fundador viu: "temos algumas fileiras de árvores em locais que não
 * temos ruas, e também uma rua faltando árvores". Medido, era exatamente isso:
 * as duas listas se cruzam só em 0, 90, 180 e 270, então CINCO fileiras ficavam
 * sobre terreno sem rua nenhuma e OITO avenidas ficavam peladas.
 *
 * Trocar a cópia local de um JSON compartilhado não é fonte única, é fonte
 * única para quem lembra de olhar. Agora quem quiser avenida chama isto.
 */
export function avenidasGeom(): AvenidaGeom[] {
  return AVENIDAS.map((av, i) => {
    const g = (av.rumo * Math.PI) / 180
    return {
      id: `AV${String(i + 1).padStart(2, '0')}`,
      rumo: av.rumo,
      largura: av.largura,
      papel: av.papel,
      rInicio: AV_R_INICIO,
      rFim: AV_R_FIM,
      x0: Math.sin(g) * AV_R_INICIO,
      z0: -Math.cos(g) * AV_R_INICIO,
      x1: Math.sin(g) * AV_R_FIM,
      z1: -Math.cos(g) * AV_R_FIM,
    }
  })
}

/**
 * Está o ponto dentro da caixa de uma avenida? (com folga `folga` de cada lado)
 *
 * ⚠️ A AVENIDA É MEIA-RETA, NÃO RETA. Testar só a distância ao eixo marcaria
 * também o lado oposto da cidade, porque a reta do rumo 30° passa igualmente
 * pelo rumo 210°. O produto escalar com a direção resolve, e sem ele a máscara
 * apagaria árvore em avenida que nem existe naquele lado.
 */
export function emAvenida(px: number, pz: number, folga = 3): boolean {
  for (const av of AVENIDAS) {
    const g = (av.rumo * Math.PI) / 180
    if (px * Math.sin(g) - pz * Math.cos(g) <= 0) continue
    if (Math.abs(px * Math.cos(g) + pz * Math.sin(g)) < av.largura / 2 + folga) return true
  }
  return false
}
