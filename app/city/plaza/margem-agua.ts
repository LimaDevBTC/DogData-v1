// §16.6: O TERRENO DESCE ATÉ A ÁGUA, EM DECLIVE NATURAL, EM TODA MARGEM.
//
// Fundador, 20/09/2026: *"não quero rampas, vamos ajustar o terreno para ter um
// declive natural até a água."* E antes disso, gravado em `canais.ts`: *"que
// escada o que, a galera tem que poder parar lancha na frente da casa."*
//
// ⚠️ O DEFEITO MEDIDO, que é o que esta peça desfaz:
//
//     lamina da agua ....... -40,0   unica para a cidade inteira
//     passeio do cais ...... -37,8   altura de conves de lancha
//     a cidade ao redor .... -28,0
//     ---------------------------------------------------------------
//     12 m de degrau, vencidos por talude de regolito de 40 m a 25%
//
// Auditoria de 20/09: 131.004 m² de cais em 56 ilhas de pavimento, de 12 a 150 m
// da rede viária. O cais existe e não há como chegar nele a pé, porque a casa
// está 12 m acima dele.
//
// ⚠️ O QUE ELA ENTREGOU, MEDIDO EM 22/09 CONTRA A CENA, com `?margem=0` de um
// lado e a cena de hoje do outro (grade de 25 m, 519.841 pontos, mais 4.078
// rumos de perfil radial saindo do centro dos 17 corpos d'água):
//
//     rumos com margem rebaixada .......  1.798 de 4.078 (44%)
//     queda a 45 m da agua, nesses .....  p50 2,37 m   p90 11,05 m   max 12,00 m
//     declive maximo nos 100 m secos ...  p50 18,7% -> 14,6%;  p90 33,9% -> 32,8%
//     chao rebaixado na grade ..........  18.792 pontos (3,61%), media 4,06 m
//     chao LEVANTADO ...................  zero
//     lotes do registro selado .........  2.976 de 70.720 (4,21%) mudam de cota,
//                                         p50 2,28 m, p90 8,87 m
//     lotes com chao abaixo da lamina ..  87 antes, 87 depois (nenhum novo)
//     custo de montagem do campo .......  76 ms, uma vez, por terreno
//
// O exemplo que fecha o pedido do fundador: no lago de 44,9 ha em (782, −3.486)
// a cota a 48 m da água era −34,18 e passou a −37,53. O passeio do cais está em
// −37,8. A casa da primeira fila deixou de estar 12 m acima do cais e passou a
// estar 27 cm acima dele, que é altura de convés de lancha.
//
// ═══════════════════════════════════════════════════════════════════════════
// COMO ELA FUNCIONA, E POR QUE É UM OPERADOR E NÃO UM DESENHO
//
// A peça não desenha margem nenhuma. Ela é um OPERADOR sobre a cota que já
// existe: `h → h − corte(h, d)`, onde `d` é a distância horizontal até a linha
// d'água. Duas consequências, e as duas são o motivo de ela ter sido escrita
// assim:
//
//  1. VALE PARA TODA ÁGUA DE UMA VEZ. Baía, os 17 lagos de cratera, as poças
//     pequenas que a máscara do gerador descarta, os canais radiais e a volta
//     de cada ilha entram pela MESMA porta, porque "água" aqui é o conjunto de
//     nível `chão ≤ lâmina`, não uma lista de corpos. Não há um caso da baía e
//     outro do lago para divergirem depois.
//
//  2. NÃO CRIA ARESTA EM LUGAR NENHUM. O operador é contínuo em `h` e em `d`,
//     então superfície contínua entra e superfície contínua sai. É por isso que
//     ele pode rodar DEPOIS do canal radial sem quebrar a costura da banda:
//     na borda da faixa o canal vale exatamente `bbAt` do mesmo ponto, os dois
//     lados recebem o mesmo corte, e a junta continua fechada.
//
// ⚠️ E ELE SÓ ABAIXA. Nunca levanta um metro de chão. É a mesma regra que a
// alça impôs e a orla da baía herdou em 22/09 ("do lado da água a orla NUNCA
// levanta o chão, só abaixa"), pelo mesmo motivo: saia de volta ao natural vira
// banco de areia, e banco de areia dentro d'água foi o defeito que custou 165
// de 165 rumos do arco da orla.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ A GARANTIA QUE FAZ ISTO CABER ANTES DO MERKLE, e ela é aritmética, não
// medição: **A MÁSCARA DE ÁGUA NÃO MUDA.**
//
//     corte ≤ h − alvo   e   alvo = lâmina + declive·d ≥ lâmina
//        ⇒  h_novo = h − corte ≥ alvo ≥ lâmina        (para chão seco)
//     corte = 0 quando h ≤ lâmina                     (para chão molhado)
//
// Ou seja: nenhum ponto seco vira água e nenhum ponto de água vira terra. O
// `superficieAt` que o alocador de lote usa como máscara devolve a MESMA
// classificação antes e depois. Muda `cota_cm` na folha do merkle, que é o
// preço que o §16.6 cobra; não muda a EXISTÊNCIA de lote nenhum, que é o que
// tornaria "terreno depois do lote" obrigatório e adiaria a regeração.
//
// ⚠️ E A GARANTIA É DO OPERADOR, NÃO DA COMPOSIÇÃO INTEIRA, e a diferença foi
// medida. O que roda DEPOIS dele (a franja da alça e a saia da orla da baía
// misturam a cota imposta com o natural) pode levar um ponto já rente à lâmina
// para o outro lado dela. Varredura de 22/09 em grade de 25 m, 519.841 pontos:
// 52 células, 3,25 ha, TODAS na franja de 250 m da alça entre os rumos 346,7 e
// 347,6, e o lote mais próximo delas está a 131 m. Zero lotes do registro
// selado ficam com o chão abaixo da lâmina por causa desta peça (os 87 que
// ficam já ficavam antes dela, e são o defeito que a frente do gerador está
// consertando por outro caminho).
//
// ⚠️ E A GUARDA DE BORDO (`MARGEM_GUARDA`) EXISTE PARA O `≥` VIRAR `>`. Sem
// ela um ponto com `d` interpolado em zero poderia ser puxado até a lâmina
// EXATA, e o gerador reprova pegada com `cota <= LAGO_COTA`: um lote sumiria
// por arredondamento. Com ela o chão seco guarda sempre 10% da folga que tinha
// acima da lâmina, então continua estritamente seco.
//
// ═══════════════════════════════════════════════════════════════════════════
// OS NÚMEROS, E DE ONDE CADA UM VEM
//
// `MARGEM_DECLIVE` = 5%. Não é número novo: é a faixa que esta cidade inteira
// já usa para chão que a gente anda. A praia do Lago da Praça desce a 4,17%, a
// subida da cidade sobe a 4,14%, a praia do canal radial vale exatamente 5%
// (`CANAL_PRAIA_ALT` 2 m em `CANAL_PRAIA` 40 m) e o teto que o fundador deu
// para a praça foi 6% ("não queremos barrancos"). 5% cai no meio disso.
//
// `MARGEM_W0` / `MARGEM_W1` = 150 e 300 m. A rampa de 5% manda sozinha nos
// primeiros 150 m e se dissolve até 300. Com a cidade em −28 a rampa alcança o
// chão natural em 240 m, ou seja o degrau de 12 m se desfaz INTEIRO antes de a
// dissolução começar a valer.
//
// ⚠️ A DISSOLUÇÃO COBRA UM PREÇO, E ELE FOI MEDIDO, NÃO ESTIMADO. Onde o corte
// bate no teto (margem que é barranco, não degrau), ele volta a zero ao longo
// da faixa 150 a 300 e isso ACRESCENTA declive nesse trecho. Medido em 22/09,
// grade de 25 m sobre o sítio, chão seco, antes contra depois:
//
//     faixa       declive p90 antes   depois    piora p90 / p99
//     0-50 m          29,4%           28,6%       +0,0 / +0,0 pp
//     50-100 m        15,3%           12,5%       +0,2 / +2,4 pp
//     100-200 m       12,7%           12,1%       +1,3 / +5,7 pp
//     200-330 m       10,8%           16,7%       +6,2 / +11,3 pp
//
// A alternativa medida foi dissolver em 450 m em vez de 300: a piora do p90 na
// cauda cai de +6,2 para +3,6 pp, e o preço é a faixa mexer em 4.158 lotes em
// vez de 2.976 (5,88% contra 4,21% do registro selado). ⚠️ 300 FICOU PORQUE A
// RODADA É CONSERVADORA: o pedido é a margem deixar de ser degrau, e o raio de
// impacto menor vale mais que 2,6 pontos de declive numa cauda que já tem 10%.
// Se o fundador quiser a cauda mais mansa, o número é 450 e o custo é 1.182
// lotes a mais mudando de cota.
//
// `MARGEM_CORTE` = 12 m. É O DEGRAU MEDIDO, e é teto de propósito: a peça nunca
// escava mais fundo do que o defeito que veio consertar. Onde a margem for um
// barranco de 40 m (e existem, no maciço oeste e na boca do parque), ela manda
// 12 e para. ⚠️ Isto é a diferença entre "a margem deixa de ser degrau" e
// "terreno novo", e a segunda coisa não foi pedida. Medido: em 43 dos 70.720
// lotes o teto morde, e nesses o talude continua íngreme depois do corte. É
// aceito de propósito: ali a margem não é um degrau de 12 m, é a encosta do
// maciço, e aplainar encosta de 40 m seria desenhar outro terreno.
//
// ⚠️ O QUE ELA NÃO TOCA, E É DE PROPÓSITO. Duas coisas diferentes:
//
//  1. MARGEM QUE JÁ É MANSA sai daqui bit a bit igual, porque `h − alvo` já é
//     negativo e o corte é zero. A praia do Lago da Praça (4,17%) e a praia do
//     canal radial (5% exatos) passam por esta função sem um centímetro de
//     diferença.
//
//  2. MARGEM DESENHADA DEPOIS não chega a ser consultada, porque `alcaAlturaAt`
//     e `orlaBaiaAlturaAt` IMPÕEM a própria cota na pegada delas e esta função
//     roda antes. Medido em 22/09: a linha d'água da baía cai quase inteira
//     dentro do arco da orla (1,3° a 101,3°, r 4.030 a 4.800) ou do arco da
//     alça (346° a 116,5°), e nesses arcos a margem não muda nada. É de
//     propósito: a orla da baía de 22/09 já desce da plataforma de −30 à lâmina
//     por uma praia de 80 m, que é 1:8, e re-esculpi-la aqui moveria a cota dos
//     2.062 lotes da Orla da Baía e dos 510 da Orla Nobre por causa de um
//     conserto que não é deles. ⚠️ Se um dia o fundador quiser a praia da orla
//     mais mansa que 1:8, o lugar é `orla-baia.ts`, e é decisão dele, não
//     efeito colateral desta peça.
//
// Margem desenhada não é degrau; degrau é o talude de regolito.
// ═══════════════════════════════════════════════════════════════════════════

/** a inclinação da margem: 5%, entre os 4,14% da subida da cidade e o teto de
 *  6% que o fundador deu para a praça. */
export const MARGEM_DECLIVE = 0.05
/** até aqui a rampa manda sozinha. */
export const MARGEM_W0 = 150
/** e aqui ela já se dissolveu por completo: além disto o chão é o de sempre. */
export const MARGEM_W1 = 300
/** teto do rebaixamento, em metros. É o degrau medido em 20/09, e a peça não
 *  escava mais fundo que o defeito que veio consertar. */
export const MARGEM_CORTE = 12
/** fração da folga acima da lâmina que o chão seco SEMPRE guarda. Ver a nota da
 *  garantia no cabeçalho: é isto que impede um lote de virar água por
 *  arredondamento do campo de distância. */
export const MARGEM_GUARDA = 0.9

/**
 * ⚠️ CHAVE DE DIAGNÓSTICO: `?margem=0` desliga o §16.6 inteiro e devolve o chão
 * de antes de 22/09, bit a bit. Mesmo padrão de `?alca=0`, `?orlabaia=0`,
 * `?campus=0` e `?aquatics=0`, e existe pelo mesmo motivo: é assim que se mede
 * QUANTO a peça mexeu, montando as duas cidades lado a lado. Com ela desligada
 * o campo de distância nem chega a ser montado.
 */
const _flagMargem = typeof window === 'undefined'
  ? ''
  : (new URLSearchParams(window.location.search).get('margem') ?? '')
export const MARGEM_CHAO = _flagMargem !== '0'

const _suave = (t: number) => t * t * (3 - 2 * t)

/**
 * O operador. `h` é a cota que o resto do chão já montou, `d` a distância
 * horizontal até a linha d'água (de `CampoMargem`), `lamina` a cota única da
 * água da cidade (−40).
 *
 * ⚠️ PURO E SEM ESTADO. É chamado por vértice de malha, por lote e por quadro
 * de câmera: qualquer alocação aqui aparece no perfil.
 */
export function margemAguaAt(h: number, d: number, lamina: number): number {
  if (d >= MARGEM_W1) return h
  const folga = h - lamina
  if (folga <= 0) return h                      // já está debaixo d'água
  const alvo = lamina + MARGEM_DECLIVE * d
  let corte = h - alvo
  if (corte <= 0) return h                      // a margem aqui já é mansa
  if (corte > MARGEM_CORTE) corte = MARGEM_CORTE
  const teto = MARGEM_GUARDA * folga
  if (corte > teto) corte = teto
  if (d > MARGEM_W0) corte *= 1 - _suave((d - MARGEM_W0) / (MARGEM_W1 - MARGEM_W0))
  return h - corte
}

export interface CampoMargem {
  /** metros até a linha d'água mais próxima, saturado em `MARGEM_W1`. */
  distanciaAt(x: number, z: number): number
  /** quantos pontos de linha d'água o campo encontrou (para o relatório). */
  readonly pontos: number
}

export interface CampoMargemOpts {
  /** lado da grade do heightmap (429). */
  n: number
  /** metros por célula da grade do heightmap (59,2253). */
  cell: number
  /** a cota única da água. */
  lamina: number
  /** ⚠️ ALÉM DESTE RAIO NÃO HÁ ÁGUA, e a trava é obrigatória. A saia do sítio
   *  desce sem parar (`drop`, em `terrain.ts`), então lá fora o chão passa de
   *  −40 e seria lido como oceano: nasceria uma linha d'água falsa em volta do
   *  sítio inteiro e a margem cavaria uma rampa nela. `lagos.ts` já usa esta
   *  mesma trava (`hypot > R − 40` vira 1e6) para não desenhar água ali. */
  raioAgua: number
  /** o chão ANTES da margem, no ponto. */
  chao(x: number, z: number): number
}

/**
 * Constrói o campo de distância até a linha d'água, uma vez, na montagem do
 * terreno.
 *
 * ⚠️ POR QUE UM CAMPO E NÃO UMA CONTA LOCAL. A tentação é estimar a distância
 * pelo declive do próprio ponto (`d ≈ (h − lâmina)/|∇h|`), que é exato numa
 * rampa uniforme e não precisa de memória nenhuma. Ela não serve, e o motivo é
 * aritmético: essa estimativa só sabe ESCULPIR o talude onde ele está, e um
 * degrau não se conserta esculpindo, se conserta ESTICANDO. Reproduzido no
 * papel sobre o talude medido (12 m em 48 m): a versão local devolvia 5% nos
 * primeiros 24 m e 55% nos últimos 12, ou seja empurrava o degrau ladeira acima
 * em vez de desfazê-lo. Esticar exige saber onde a água está a 240 m de
 * distância, e isso nenhuma conta local sabe.
 *
 * ⚠️ E O CAMPO É DE PONTO, NÃO DE CÉLULA. A linha d'água sai por interpolação
 * linear nas arestas da grade (a mesma travessia que `lagos.ts` usa no marching
 * squares), mais o ponto médio de cada célula cortada. Sem os pontos médios o
 * espaçamento é o da célula (59,2 m) e a distância medida a um conjunto de
 * pontos superestima a distância à linha: medido no papel, até 8,8 m de erro a
 * 50 m da margem, que numa rampa de 5% é 44 cm de ondulação. Com os médios o
 * espaçamento cai pela metade e o erro por quatro, para 11 cm.
 */
export function campoMargem(o: CampoMargemOpts): CampoMargem {
  const { n, cell, lamina, raioAgua, chao } = o
  const half = (n - 1) / 2
  // a janela: só o miolo do sítio pode ter água, e só até MARGEM_W1 além dela
  // alguém sente a margem. Amostrar a grade inteira de 429² seria pagar o chão
  // do horizonte para nada.
  const kJan = Math.min(half, Math.ceil((raioAgua + MARGEM_W1 + cell) / cell))
  const i0 = Math.max(0, Math.round(half - kJan))
  const i1 = Math.min(n - 1, Math.round(half + kJan))
  const m = i1 - i0 + 1
  const px = (i: number) => (i0 + i - half) * cell

  // ── 1. o chão e o estado de cada nó ──────────────────────────────────────
  // ⚠️ TRÊS ESTADOS, NÃO DOIS. "fora" (além de `raioAgua`) não é o mesmo que
  // "seco": se ele fosse seco, a fronteira do raio viraria uma travessia e
  // nasceria uma linha d'água circular falsa em r = raioAgua. Aresta com um nó
  // "fora" não produz ponto nenhum.
  const FORA = 0, SECO = 1, MOLHADO = 2
  const H = new Float32Array(m * m)
  const est = new Uint8Array(m * m)
  for (let j = 0; j < m; j++) {
    const z = px(j)
    for (let i = 0; i < m; i++) {
      const x = px(i)
      const k = j * m + i
      if (Math.hypot(x, z) > raioAgua) { est[k] = FORA; H[k] = lamina; continue }
      const h = chao(x, z)
      H[k] = h
      est[k] = h > lamina ? SECO : MOLHADO
    }
  }

  // ── 2. a linha d'água, por travessia de aresta ───────────────────────────
  const pts: number[] = []
  const trav = (ka: number, kb: number, xa: number, za: number, xb: number, zb: number): number => {
    if (est[ka] === FORA || est[kb] === FORA || est[ka] === est[kb]) return -1
    const ha = H[ka], hb = H[kb]
    const t = Math.abs(hb - ha) < 1e-9 ? 0.5 : Math.min(1, Math.max(0, (lamina - ha) / (hb - ha)))
    pts.push(xa + (xb - xa) * t, za + (zb - za) * t)
    return pts.length - 2
  }
  for (let j = 0; j < m - 1; j++) {
    const z0 = px(j), z1 = px(j + 1)
    for (let i = 0; i < m - 1; i++) {
      const x0 = px(i), x1 = px(i + 1)
      const k00 = j * m + i, k10 = k00 + 1, k01 = k00 + m, k11 = k01 + 1
      // ⚠️ AS QUATRO ARESTAS, E A REPETIÇÃO É DE PROPÓSITO. A célula vizinha
      // volta a cortar a aresta comum e o ponto entra duas vezes; como a
      // distância é um MÍNIMO, ponto repetido não muda resposta nenhuma. Testar
      // as quatro é o que permite achar o ponto médio do corte logo abaixo, que
      // é quem derruba o erro de espaçamento.
      const a = trav(k00, k10, x0, z0, x1, z0)
      const b = trav(k00, k01, x0, z0, x0, z1)
      const c = trav(k10, k11, x1, z0, x1, z1)
      const d = trav(k01, k11, x0, z1, x1, z1)
      // o ponto médio do corte, que é o que derruba o erro de espaçamento
      const achados: number[] = []
      if (a >= 0) achados.push(a)
      if (b >= 0) achados.push(b)
      if (c >= 0) achados.push(c)
      if (d >= 0) achados.push(d)
      if (achados.length >= 2) {
        const p = achados[0], q = achados[1]
        pts.push((pts[p] + pts[q]) / 2, (pts[p + 1] + pts[q + 1]) / 2)
      }
    }
  }

  // ── 3. o campo, por carimbo ──────────────────────────────────────────────
  // ⚠️ CARIMBO E NÃO TRANSFORMADA DE DISTÂNCIA EM DUAS PASSADAS. A transformada
  // por chanfro depende da ordem das passadas e erra até 7,6% na diagonal, que a
  // 240 m são 18 m de distância e 90 cm de cota. O carimbo é euclidiano exato
  // contra o conjunto de pontos e não depende de ordem nenhuma, o que também o
  // torna reproduzível fora daqui sem discussão de algoritmo.
  const D = new Float32Array(m * m).fill(MARGEM_W1)
  const raioCel = MARGEM_W1 / cell
  for (let q = 0; q < pts.length; q += 2) {
    const fi = pts[q] / cell + half - i0
    const fj = pts[q + 1] / cell + half - i0
    const ia = Math.max(0, Math.ceil(fi - raioCel)), ib = Math.min(m - 1, Math.floor(fi + raioCel))
    const ja = Math.max(0, Math.ceil(fj - raioCel)), jb = Math.min(m - 1, Math.floor(fj + raioCel))
    for (let j = ja; j <= jb; j++) {
      const dz = (j - fj) * cell
      for (let i = ia; i <= ib; i++) {
        const dx = (i - fi) * cell
        const d = Math.sqrt(dx * dx + dz * dz)
        const k = j * m + i
        if (d < D[k]) D[k] = d
      }
    }
  }

  const lim = m - 1.001
  return {
    pontos: pts.length / 2,
    distanciaAt(x: number, z: number): number {
      const fi = x / cell + half - i0
      const fj = z / cell + half - i0
      if (fi < 0 || fj < 0 || fi > lim || fj > lim) return MARGEM_W1
      const i = Math.floor(fi), j = Math.floor(fj)
      const u = fi - i, v = fj - j
      const k = j * m + i
      return D[k] * (1 - u) * (1 - v) + D[k + 1] * u * (1 - v)
        + D[k + m] * (1 - u) * v + D[k + m + 1] * u * v
    },
  }
}
