// ═══════════════════════════════════════════════════════════════════════════
// A ARBORIZAÇÃO: a árvore da DogCity, e ela é o maior salto de percepção que a
// cidade tem antes do mint, porque até aqui só existia chão desenhado.
//
// ⚠️ A COPA NÃO DESENHA POR VALOR, DESENHA POR SOMBRA, e é isso que dita a
// forma. Verde #7E8A6B contra calçada #CBC4B6 dá 2,11:1 de contraste e contra
// lote dá 1,43:1: de cima, uma copa quase some. O que aparece numa aérea de
// verdade é a SOMBRA dela, uma tracejada escura ao lado da calçada. Uma árvore
// de 7 m com o sol a 32 graus projeta 11,2 m, que mede cerca de 2 px na vista de
// topo. É por isso que a árvore aqui pode ter 30 triângulos e ainda funcionar.
//
// ⚠️ QUATRO ESPÉCIES, UM MATERIAL SÓ, e o material é o recurso escasso desta cena
// (a vista alta compila 402 programas). Alameda, conífera, guarda-chuva e colunar
// dividem um MeshStandardMaterial com cor por vértice, e o balde de longe e o
// arbusto dividem o mesmo: o three compila UM programa e cobra UMA chamada de
// desenho por InstancedMesh, seis no total.
//
// ⚠️ QUEM DIZ O QUE É UMA ÁRVORE É `especies.ts`, DESDE 02/09. Aqui mora só quem
// PLANTA: máscara, fileira, empurrão, LOD e balde. A separação nasceu de uma
// auditoria do fundador ("ainda temos muitas árvores genéricas"): com as três
// formas espalhadas por 300 linhas deste arquivo, ninguém tinha visto que DUAS
// delas eram a mesma `copaLobada` com 12% de diferença de achatamento.
//
// ⚠️ E A QUARTA ESPÉCIE NÃO CUSTOU CHAMADA DE DESENHO. Ela foi paga fundindo os
// dois baldes de longe, que desenhavam o MESMO octaedro de 8 triângulos com
// proporções diferentes: proporção é matriz de instância, e matriz é de graça.
// Antes 6 chamadas (3 de perto, 2 de longe, 1 de arbusto), agora 6 (4 de perto,
// 1 de longe, 1 de arbusto).
//
// ⚠️ O LOD NÃO SE REBALANCEIA POR QUADRO. A spec da maquete marcou o
// rebalanceamento contínuo como NÃO MEDIDO e deixou o plano B escrito: baldes
// refeitos só quando a câmera anda mais que um limiar. É o plano B que está
// implementado aqui, com limiar de 150 m, porque árvore não se mexe e a diferença
// entre octaedro e copa a 400 m não muda enquanto a câmera anda meio quarteirão.
//
// ⚠️ A SEÇÃO DA AVENIDA É ESCALADA, E ISSO ERA O "ASFALTO CORTANDO A ÁRVORE AO
// MEIO". `vias.ts` desenha toda avenida com a MESMA seção de 34 m esticada por
// `esc = largura / 34`; as quatro cardeais têm 44 m, logo esc = 1,294. Aqui os
// recuos 3,93 e 30,07 entravam CRUS, sem esc: com meia largura de 22, o lado
// direito caía em t = 30,07, e na seção esticada a faixa 24,6 a 37,6 é PISTA. A
// muda nascia no meio da mão de tráfego. Medido em 01/09: 1.150 das 20.756 de
// bulevar, todas nas quatro cardeais. Agora o recuo é `3,93 × esc` e
// `30,07 × esc`, que é onde a calçada realmente está.
//
// ⚠️ A MÁSCARA DE VIA VALE PARA VIA ALHEIA, NÃO PARA A PRÓPRIA SEÇÃO. `naVia`
// marca pista, sarjeta E CALÇADA, e a fileira de bulevar é plantada de propósito
// na calçada do bulevar: aplicar a máscara crua apagaria as duas fileiras que a
// cidade quer ter. A regra escrita aqui é "a muda pode estar na seção da via a
// que ela pertence, não pode estar em NENHUMA outra": o teste é
// `naVia(...) && !propria(...)`, e `propria` é a caixa da avenida (ou a faixa do
// anel) que gerou aquela fileira.
//
// Espaçamentos de fonte primária, não de gosto:
//   7,6 m  bulevar e anel      (Portland, 25 ft, faixas C, CC, D, DC, F, FU)
//   9,1 m  via de contorno     (Portland, 30 ft, faixas E, G, GU)
//   1,07 m recuo do meio-fio   (Seattle, 3 ft 6 in do eixo à face da guia)
//   10,7 m recuo de esquina    (NYC, 35 ft do meio-fio da transversal)
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { AVENIDAS, avenidasGeom, emAvenida } from './teia'
import { look2 } from './look'
import type { DistanceCuller } from './perf'
import {
  ESPECIES, ORDEM, GEO_LOOK1, geoArbusto, geoLonge,
  arquetipoDe, especieDe, tintarMuda, hash01,
  // ── a hierarquia viária de paisagismo.md, atrás de `?verde=1` (§1, §2) ──
  verde, especieDeTabela, PESO_BULEVAR_CANTEIRO, PESO_BULEVAR_CALCADA,
  PESO_ANEL, PESO_ANEL_PADRAO, PESO_BANDA, bandaDe, comAcento, distritoDe,
} from './especies'
import type { Contexto, EspecieId, ClasseBulevar } from './especies'

export interface Cova { x: number; z: number; r: number }

export interface ArborizacaoOpts {
  heightAt: (x: number, z: number) => number
  /** covas que as praças e as peças pediram, em coordenadas de mundo */
  covas?: Cova[]
  /** ⚠️ ESTÁ MOLHADO? Sem isto a plantação atravessa a baía.
   *
   *  Medido em 31/08, antes de existir: 13,7% das mudas (cerca de 6.800 de
   *  49.818) estavam sobre água. A rua PARA na baía por decisão do fundador
   *  ("retire as estradas de cima da baía"), e a fileira de árvore seguia em
   *  frente, reta, por cima da lâmina. Vem de `lagos.naAgua`, que é a mesma
   *  rotulagem por preenchimento que desenha a água: fonte única, não uma
   *  conta paralela de altura que divergiria na borda do pódio. */
  molhado?: (x: number, z: number) => boolean
  /** ⚠️ ESTÁ NA RUA? Sem isto a muda nasce no meio da pista. Vem de
   *  `vias.naVia`, a mesma máscara que a rua usa para se desenhar: fonte
   *  única, não uma conta paralela que divergiria na esquina.
   *
   *  Até 01/09 a árvore só conhecia AVENIDA (`noBulevar`, via `emAvenida`) e
   *  ANEL (`noAnel`, um raio contra um dodecágono). A malha viária LOCAL, que é
   *  a maior parte dos 261 km de rua desenhada, e as 46 rotatórias não eram
   *  consultadas por ninguém. */
  naVia?: (x: number, z: number, folga?: number) => boolean
  sombra?: boolean
  culler?: DistanceCuller
}

export interface Arborizacao {
  group: THREE.Group
  arvores: number
  cheias: number
  triangulos: number
  update(cam: THREE.Vector3): void
  dispose(): void
}

const TETO = 40000        // teto duro de instâncias; o módulo loga o plantado
const R_CHEIA = 1400      // além disto a árvore vira o volume de longe (8 triângulos)
const PASSO_REBALANCE = 150
/** margem entre o pé da muda e a guia: o ponto não tem raio, a árvore tem. Torrão
 *  de 1,05 m no maior porte (×1,35 de escala, ×1,34 de copa aberta) dá 1,90 m. */
const FOLGA_VIA = 1.9
/** a seção do bulevar em `vias.ts` mede 34 m e é esticada por largura/34 */
const SEC_BULEVAR_M = 34

/** ⚠️ A BIBLIOTECA DE ESPÉCIES SAIU DAQUI EM 02/09 e virou `especies.ts`. Este
 *  módulo é quem PLANTA: máscara, fileira, empurrão, LOD e balde. Quem diz o que
 *  é uma árvore é o outro. A separação não é estética: a auditoria de 02/09
 *  mostrou que duas das três "espécies" eram a mesma `copaLobada` com parâmetro
 *  diferente, e isso só é visível quando as quatro estão numa tabela lado a lado. */
type Forma = EspecieId

interface Muda {
  x: number; z: number; forma: Forma
  /** porte geral da muda */
  esc: number
  /** ⚠️ ESCALA NÃO UNIFORME É A SILHUETA DE GRAÇA (ver `arquetipoDe`). */
  escXZ: number; escY: number
  giro: number
  /** inclinação do fuste: árvore de rua não nasce no prumo */
  tomboX: number; tomboZ: number
  /** cor por instância (`setColorAt`), só no look 2 */
  tint: THREE.Color | null
}

/** uma muda pronta: porte, arquétipo, tombo e cor saem todos do mesmo hash, para
 *  a cidade ser a mesma em toda visita. No look 1 devolve exatamente o que o
 *  módulo devolvia antes (escala uniforme 0,86 a 1,14, sem tombo, sem cor). */
function criarMuda(x: number, z: number, forma: Forma, i: number): Muda {
  const giro = hash01(i * 7) * Math.PI * 2
  if (!look2) {
    const esc = 0.86 + hash01(i) * 0.28
    return { x, z, forma, esc, escXZ: 1, escY: 1, giro, tomboX: 0, tomboZ: 0, tint: null }
  }
  const espec = ESPECIES[forma]
  const [p0, p1] = espec.porte
  const esc = p0 + hash01(i) * (p1 - p0)
  const [escXZ, escY] = arquetipoDe(forma, x, z, i)
  const tombo = espec.tombo
  return {
    x, z, forma, esc, escXZ, escY, giro,
    tomboX: (hash01(i * 77) - 0.5) * 2 * tombo,
    tomboZ: (hash01(i * 131) - 0.5) * 2 * tombo,
    tint: tintarMuda(forma, x, z, i, new THREE.Color()),
  }
}

interface Quarteirao { x: number; z: number; giro: number; lado: number; prof?: number; k?: number }
interface Bulevar { rumo: number; largura: number; x0: number; z0: number; x1: number; z1: number }
interface Anel { r: number; larg: number; nome?: string }
interface Peca { x: number; z: number; a: number; b: number; rot: number; forma?: string }
/** as bandas de distrito e os distritos, publicados por `scripts/gerar_cidade.py`
 *  em `cidade-malha.json`; ver `paisagismo.md` §2 e a nota de `especies.ts` */
interface DadoBanda { de: number; ate: number; nome: string }
interface DadoDistrito { rumo: number; abertura: number }
/** os pares z0/z1 de cada travessa do quarteirão, por número de faixas `k`
 *  (ver `travessasPorK` em `cidade-malha.json`, e a nota de `paisagismo.md` §1) */
type TravessasPorK = Record<string, { z0: number; z1: number }[]>

export async function buildArborizacao(o: ArborizacaoOpts): Promise<Arborizacao> {
  const [malha, meta] = await Promise.all([
    fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<{
      constantes: {
        setores: number; quarteirao: number; viaContorno: number; bulevar: number
        bandas?: DadoBanda[]; distritosDef?: DadoDistrito[]; travessasPorK?: TravessasPorK
      }
      quarteiroes: Quarteirao[]; bulevares: Bulevar[]
    }>),
    fetch('/city/cidade.json').then((r) => r.json() as Promise<{
      programa: Peca[]; raioBorda: number; raioInicio: number; aneis?: Anel[]
    }>),
  ])
  const K = malha.constantes
  // ⚠️ TUDO NÃO PUBLICADO VIRA ARRAY VAZIO, NUNCA NÚMERO INVENTADO. Sem
  // `bandas`/`distritosDef` a hierarquia de bairro simplesmente não se aplica
  // (`bandaDe`/`distritoDe` caem no padrão delas) em vez de travar a cidade.
  const BANDAS = K.bandas ?? []
  const DISTRITOS = K.distritosDef ?? []
  const TRAVESSAS_POR_K = K.travessasPorK ?? {}
  const group = new THREE.Group()
  group.name = 'arborizacao'

  // ── as máscaras: árvore respeita o mesmo que a rua respeita ───────────────
  const pecas = (meta.programa ?? []).map((p) => {
    const rr = (p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ret: p.forma !== 'elipse',
             ca: Math.cos(rr), sa: Math.sin(rr), rr2: p.a * p.a + p.b * p.b }
  })
  const emPeca = (px: number, pz: number) => {
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr2) continue
      const lx = dx * p.ca + dz * p.sa, lz = -dx * p.sa + dz * p.ca
      if (p.ret) { if (Math.abs(lx) <= p.a && Math.abs(lz) <= p.b) return true }
      else if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  const rMax = meta.raioBorda ?? 4400
  const rMin = (meta.raioInicio ?? 1300) - 40
  const aneis = meta.aneis ?? []
  // ⚠️ ESTA MÁSCARA ESTAVA MORTA, E CALADA. Ela varria `K.setores`, e
  // `constantes` publica `setoresLegado`, não `setores`: `s < undefined` é falso
  // na primeira volta, o laço nunca rodava e a função só respondia `r < 40`. Ou
  // seja, desde sempre a árvore NÃO desviava de avenida nenhuma, e as fileiras
  // de anel eram plantadas por dentro dos cruzamentos.
  //
  // Undefined numa comparação não estoura, dá falso: a máscara errada tem a
  // mesma aparência de máscara ausente, e nada no console reclama.
  //
  // Agora ela vem da teia, com a largura de CADA avenida (44 nas quatro cardeais,
  // 34 nas outras oito) em vez de um `meiaBul` único.
  const noBulevar = (px: number, pz: number) => {
    if (Math.hypot(px, pz) < 40) return true
    return emAvenida(px, pz, 3)
  }
  const noAnel = (px: number, pz: number, folga = 3) => {
    const r = Math.hypot(px, pz)
    for (const a of aneis) if (Math.abs(r - a.r) <= a.larg / 2 + folga) return true
    return false
  }

  // ⚠️ E ESTA É A MÁSCARA QUE FALTAVA INTEIRA. `noBulevar` e `noAnel` são testes
  // ANALÍTICOS sobre 12 retas e 7 raios; a rua desenhada tem 261 km, 1.859
  // quarteirões e 46 rotatórias. Tudo o que não é avenida nem anel nunca foi
  // consultado por ninguém, e é a maior parte do asfalto da cidade.
  const naVia = o.naVia
  if (!naVia) console.warn('[arborização] sem consulta de via: a muda pode nascer no meio da pista (o campo `naVia` de `vias.ts` não chegou)')

  // ⚠️ SONDA DE VIDA, PORQUE MÁSCARA MORTA TEM A CARA DE MÁSCARA AUSENTE. Foi
  // exatamente assim que `noBulevar` passou semanas lendo `K.setores`, um campo
  // que o JSON não publica, respondendo sempre `false` sem uma linha no console.
  // Aqui a sonda pergunta pelo MEIO DA PISTA de cada avenida: se nenhuma das 12
  // responder "é rua", a consulta chegou quebrada e o aviso sai alto.
  if (naVia) {
    let acertos = 0
    for (const av of avenidasGeom()) {
      const ang = (av.rumo * Math.PI) / 180
      const perpX = Math.cos(ang), perpZ = Math.sin(ang)
      const larg = av.largura ?? K.bulevar
      const e = larg / SEC_BULEVAR_M
      const off = 10 * e - larg / 2          // t = 10, meio da pista esquerda
      const mx = (av.x0 + av.x1) / 2 + perpX * off
      const mz = (av.z0 + av.z1) / 2 + perpZ * off
      if (naVia(mx, mz, 0)) acertos++
    }
    if (acertos === 0) console.warn('[arborização] a consulta de via chegou, mas não reconhece o meio da pista de NENHUMA das 12 avenidas: máscara provavelmente quebrada')
  }

  /** ⚠️ A MUDA PODE ESTAR NA SEÇÃO DA VIA QUE A PLANTOU, NUNCA EM OUTRA. `naVia`
   *  marca pista, sarjeta e calçada; a fileira de bulevar é plantada DE PROPÓSITO
   *  na calçada do bulevar, a 1,07 m da guia. Testar a máscara crua apagaria as
   *  duas fileiras que a cidade quer ter. Então quem tem seção própria passa
   *  `propria`, e só é recusada a muda que caiu em rua ALHEIA: malha local,
   *  rotatória, outro anel. */
  const emViaAlheia = (px: number, pz: number, folga: number, propria?: (x: number, z: number) => boolean) => {
    if (!naVia) return false
    if (!naVia(px, pz, folga)) return false
    return propria ? !propria(px, pz) : true
  }
  let rejVia = 0, salvas = 0

  // ⚠️ RECUSAR NÃO PODE SER O FIM DA HISTÓRIA, E A PRIMEIRA VERSÃO DESTA MÁSCARA
  // ERA. Medido em 01/09, com a máscara recém-ligada: 14.633 mudas recusadas
  // contra 19.790 plantadas, ou seja 42,5% da arborização da cidade nascia dentro
  // do asfalto. Só que APAGAR as 14.633 deixa avenida sem fileira, e fileira de
  // árvore de rua é o primeiro sinal de "isto é uma cidade de verdade" numa vista
  // rasante: o remédio ficaria tão visível quanto a doença.
  //
  // ⚠️ O EMPURRÃO É AO LONGO DA FILEIRA, NÃO PARA QUALQUER LADO. A muda já está
  // no recuo certo da seção (calçada a 1,07 m da guia, ou o canteiro central de
  // 15 a 19); o que a derrubou foi uma rua ATRAVESSANDO a fileira, quase sempre
  // uma travessa local ou a boca de uma rotatória de 40 m. Andar 4 ou 8 m no
  // sentido da fileira sai do cruzamento e MANTÉM O ALINHAMENTO, que é justamente
  // o cue que se quer preservar. Só se isso falhar o candidato anda de lado, e aí
  // ele já está procurando outra calçada, não a sua.
  //
  // ⚠️ 12 TENTATIVAS É TETO DE BOOT, NÃO DE GOSTO: 12 consultas de grade por muda
  // recusada, cerca de 176 mil no pior caso medido. Quem aumentar paga no tempo
  // de subida da cidade, que já é o que o portão da praça espera.
  //
  // ⚠️ E O EMPURRÃO PODE ENCOSTAR DUAS MUDAS. O passo da fileira é 7,6 m e o
  // menor empurrão é 3,8 m, então na BORDA de um cruzamento a muda salva pode
  // parar a 3,8 m da vizinha que não precisou andar. NÃO MEDI quantas ficam
  // assim; em fileira de rua, espaçamento irregular lê melhor do que buraco.
  const TENTATIVAS: [number, number][] = [
    [3.8, 0], [-3.8, 0],
    [2.6, 2.2], [-2.6, 2.2], [2.6, -2.2], [-2.6, -2.2],
    [7.6, 0], [-7.6, 0],
    [0, 4.4], [0, -4.4],
    [11.4, 0], [-11.4, 0],
    // ⚠️ E OS QUATRO ÚLTIMOS SÃO PARA A ROTATÓRIA. Ela tem 40 m de raio: um
    // deslize de 11,4 m não sai dela, e era ali que ficava a maior parte das
    // mudas perdidas, bem na boca da travessia, que é onde o olho vai.
    [15.2, 0], [-15.2, 0], [22.8, 0], [-22.8, 0],
  ]
  /** o ponto vale? raio, peça, água e via alheia, na ordem mais barata */
  const vale = (px: number, pz: number, propria?: (x: number, z: number) => boolean) => {
    const r = Math.hypot(px, pz)
    if (r < rMin || r > rMax) return false
    if (emPeca(px, pz)) return false
    if (molhado(px, pz)) return false
    return !emViaAlheia(px, pz, FOLGA_VIA, propria)
  }
  /** empurra a muda recusada para o ponto legal mais próximo, ao longo da fileira
   *  (`ao`) e depois de través (`tr`). Devolve null quando não há salvação. */
  const empurrar = (
    x: number, z: number, ao: [number, number], tr: [number, number],
    propria?: (px: number, pz: number) => boolean,
  ): [number, number] | null => {
    for (const [a, t] of TENTATIVAS) {
      const px = x + ao[0] * a + tr[0] * t
      const pz = z + ao[1] * a + tr[1] * t
      if (vale(px, pz, propria)) return [px, pz]
    }
    return null
  }

  // ⚠️ SE A CONSULTA DE ÁGUA NÃO CHEGAR, RECLAME ALTO. O defeito que ela conserta
  // é invisível no console: máscara ausente e máscara errada têm a mesma cara, e
  // foi assim que `noBulevar` ficou morta por semanas lendo um campo que não
  // existe. Melhor um aviso feio do que 6.800 árvores boiando em silêncio.
  const molhado = o.molhado ?? (() => false)
  if (!o.molhado) console.warn('[arborização] sem consulta de água: a plantação pode atravessar a baía')

  const mudas: Muda[] = []
  /** `propria`: a seção de via a que esta fileira pertence, se houver. Sem ela,
   *  qualquer rua debaixo da muda a recusa. */
  const por = (x: number, z: number, forma: Forma, i: number, evitaVia = true,
               propria?: (px: number, pz: number) => boolean,
               ao: [number, number] = [1, 0], tr: [number, number] = [0, 1]) => {
    if (mudas.length >= TETO) return
    const r = Math.hypot(x, z)
    if (r < rMin || r > rMax) return
    if (emPeca(x, z)) return
    if (molhado(x, z)) return
    if (evitaVia && (noBulevar(x, z) || noAnel(x, z))) return
    if (emViaAlheia(x, z, FOLGA_VIA, propria)) {
      rejVia++
      const p = empurrar(x, z, ao, tr, propria)
      if (!p) return
      salvas++
      mudas.push(criarMuda(p[0], p[1], forma, i))
      return
    }
    mudas.push(criarMuda(x, z, forma, i))
  }

  /**
   * ⚠️ O DECLIVE LOCAL, AMOSTRADO COM QUATRO ALTURAS, e ele só é pedido onde a
   * espécie não vem da rua: a cova e o anel. A fileira de bulevar recebe declive
   * 0 de propósito, porque avenida de 44 m é terraplenada por definição e o que
   * manda ali é a seção da via, não o terreno.
   *
   * O passo é de 6 m porque a árvore tem 7 a 12 m: declive medido num passo de
   * 1 m responde à rugosidade da malha, não à encosta que o olho vê.
   */
  const PASSO_DECLIVE = 6
  /** ⚠️ E ELE É LEMBRADO NUMA GRADE DE 60 m, PORQUE A CONSULTA DE ALTURA NÃO É
   *  BARATA. `terrain.superficieAt` interpola dentro da célula e chama `heightAt`
   *  3 ou 4 vezes por consulta, então um declive cru custa até 16 `heightAt`. Os
   *  7 anéis somam 26.634 pontos de plantio a 7,6 m um do outro: sem cache seriam
   *  cerca de 430 mil `heightAt` no boot da cidade, que é o tempo que o portão da
   *  praça espera. Numa grade de 60 m, oito pontos seguidos da fileira dividem a
   *  mesma resposta e a conta cai para cerca de 54 mil. Quantizar não custa
   *  leitura: a espécie já vem de um ruído de célula de 520 m. NÃO MEDI o custo em
   *  milissegundos de uma consulta de altura nesta cena. */
  const CEL_DECLIVE = 60
  const cacheDecl = new Map<number, number>()
  const declive = (px: number, pz: number): number => {
    const ci = Math.round(px / CEL_DECLIVE), cj = Math.round(pz / CEL_DECLIVE)
    const chave = (ci + 4096) * 16384 + (cj + 4096)
    const visto = cacheDecl.get(chave)
    if (visto !== undefined) return visto
    const h = o.heightAt
    const cx = ci * CEL_DECLIVE, cz = cj * CEL_DECLIVE
    const dx = h(cx + PASSO_DECLIVE, cz) - h(cx - PASSO_DECLIVE, cz)
    const dz = h(cx, cz + PASSO_DECLIVE) - h(cx, cz - PASSO_DECLIVE)
    const d = Math.hypot(dx, dz) / (2 * PASSO_DECLIVE)
    cacheDecl.set(chave, d)
    return d
  }

  /** ⚠️ A COVA NÃO TEM AVENIDA A QUEM PERTENCER, então a semente dela é o próprio
   *  ruído de mundo (dentro de `especieDe`) e não um índice de fileira: o pátio
   *  inteiro de uma peça cai na mesma célula de 520 m e recebe a mesma mistura,
   *  que é o parentesco que a avenida ganha do índice. Hash puro por cova daria
   *  confete dentro de um mesmo pátio. */
  const espDaCova = (px: number, pz: number): Forma =>
    look2 ? especieDe('cova', px, pz, 0, declive(px, pz)) : 'esfera'

  /** a escolha de qualquer fileira: no look 1 nada disso acontece e a fileira
   *  continua com a espécie fixa que ela tinha */
  const espDa = (ctx: Contexto, px: number, pz: number, semente: number,
                 velha: Forma, decl = 0): Forma =>
    look2 ? especieDe(ctx, px, pz, semente, decl) : velha

  // ── 1. as covas que a praça e a peça pediram ─────────────────────────────
  // Elas já vêm com posição escolhida por quem desenhou o chão, então não passam
  // pela máscara de peça: a cova DENTRO de uma peça é justamente a que a peça pôs.
  let i = 0
  for (const c of o.covas ?? []) {
    if (mudas.length >= TETO) break
    const r = Math.hypot(c.x, c.z)
    if (r < rMin || r > rMax) continue
    // a cova escapa da máscara de PEÇA (foi a peça que a pediu), nunca da de água
    if (molhado(c.x, c.z)) continue
    // ⚠️ nem da de VIA: quem desenhou o pátio escolheu a cova, mas nenhuma peça
    // pediu uma árvore no meio de uma rua que o `vias.ts` desenhou por cima dela
    if (emViaAlheia(c.x, c.z, FOLGA_VIA)) {
      rejVia++
      // a cova não tem fileira: o empurrão vira uma busca em anel curto
      const p = empurrar(c.x, c.z, [1, 0], [0, 1])
      if (!p) continue
      salvas++
      mudas.push(criarMuda(p[0], p[1], espDaCova(p[0], p[1]), i))
      i++
      continue
    }
    mudas.push(criarMuda(c.x, c.z, espDaCova(c.x, c.z), i))
    i++
  }
  const daCova = mudas.length

  // ── 2. os 12 bulevares: cone no canteiro, esfera nas duas calçadas ────────
  // Seção do bulevar (vias.ts): calçada 0 a 5, pista 5 a 15, canteiro 15 a 19,
  // pista 19 a 29, calçada 29 a 34, medida da borda esquerda.
  const PASSO_BUL = 7.6
  // ⚠️ AS AVENIDAS VÊM DE `avenidasGeom()`, NÃO DE `malha.bulevares`. O campo
  // `bulevares` do JSON são as 9 costuras dos 6 distritos, e `vias.ts` as troca
  // pelas 12 simétricas na cópia DELE. Este módulo busca o JSON por conta
  // própria e via as costuras: plantava em 61,9°, 106,9°, 185,6°, 241,9° e
  // 309,4°, onde não há rua, e deixava pelada a avenida de 30, 60, 120, 150,
  // 210, 240, 300 e 330. As duas listas só coincidem em 0, 90, 180 e 270.
  // ⚠️ A ESPÉCIE É POR AVENIDA, E ESSE É O PONTO. Sortear a espécie muda a muda
  // dá salada: cada árvore de uma fileira de um tipo, que é ruído, não plantio.
  // Uma avenida de verdade foi plantada de uma vez e tem uma espécie dominante do
  // começo ao fim; o que varia é a avenida SEGUINTE. Aqui o hash é do ÍNDICE da
  // avenida, então cada uma das 12 tem a sua identidade e ela é a mesma em toda
  // visita. No look 1 nada disso acontece: continua esfera na calçada, cone no
  // canteiro, como antes.
  const avenidas = avenidasGeom()
  for (let ai = 0; ai < avenidas.length; ai++) {
    const b = avenidas[ai]
    // ⚠️ A ESPÉCIE NÃO É MAIS UMA POR AVENIDA INTEIRA, e essa era metade do
    // "genérico". Uma avenida daqui tem 5.480 m: sortear UMA espécie de calçada e
    // UMA de canteiro para os 722 pontos da fileira dá 5,5 km de repetição, que é
    // exatamente o que o olho lê como maquete. Agora a mistura vem do contexto e
    // o ruído de mundo de 520 m troca o trecho a cada quarteirão largo, que é
    // como um plantio por lote de obra se comporta. O índice da avenida entra
    // como semente, então cada uma das 12 continua tendo identidade própria.
    const ang = (b.rumo * Math.PI) / 180
    const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const L = Math.hypot(b.x1 - b.x0, b.z1 - b.z0)
    const n = Math.floor(L / PASSO_BUL)
    const larg = b.largura ?? K.bulevar
    const meia = larg / 2
    // ⚠️ A SEÇÃO É ESTICADA, E ERA ISTO QUE PUNHA A ÁRVORE NO ASFALTO. `vias.ts`
    // desenha toda avenida com a mesma seção de 34 m multiplicada por
    // `esc = largura / 34`. Nas quatro cardeais, de 44 m, esc = 1,294: a guia
    // direita não está em t = 29 e sim em t = 37,5, e o recuo cru de 30,07 caía
    // dentro da faixa 24,6 a 37,6, que é PISTA. Agora o recuo acompanha a seção.
    const esc = larg / SEC_BULEVAR_M
    // a árvore de bulevar tem seção própria: a caixa da avenida a legitima, menos
    // onde ela entra na rotatória, que é rua de outro dono
    const naSecaoDoBulevar = (px: number, pz: number) => emAvenida(px, pz, 0) && !noAnel(px, pz, 18)
    // ⚠️ HIERARQUIA (paisagismo.md §1), ATRÁS DE `?verde=1`. Antes de 03/09 as
    // 12 avenidas recebiam a MESMA mistura `canteiro`/`calcada`, cardinal e
    // intermediária igual: um bulevar de 44 m (o eixo das pontes) e um de 34 m
    // (a costura de distrito) liam como a mesma via em porte diferente. Com a
    // bandeira, a classe vem da LARGURA JÁ MEDIDA (`larg`, publicada por
    // `avenidasGeom()`), não de um número novo.
    const classe: ClasseBulevar = larg >= 40 ? 'cardinal' : 'intermedio'
    const espCanteiro = (px: number, pz: number) => verde
      ? especieDeTabela(PESO_BULEVAR_CANTEIRO[classe], px, pz, ai)
      : espDa('canteiro', px, pz, ai, 'cone')
    const espCalcada = (px: number, pz: number) => verde
      ? especieDeTabela(PESO_BULEVAR_CALCADA[classe], px, pz, ai)
      : espDa('calcada', px, pz, ai, 'esfera')
    for (let k = 0; k <= n; k++) {
      const d = k * PASSO_BUL
      const bx = b.x0 + dirX * d, bz = b.z0 + dirZ * d
      // cone no eixo do canteiro (t = 17 da borda, ou seja o meio)
      por(bx, bz, espCanteiro(bx, bz), i++, false,
          naSecaoDoBulevar, [dirX, dirZ], [perpX, perpZ])
      // esfera a 1,07 m da face de cada meio-fio: t = 3,93 e t = 30,07 na seção
      // de 34 m, ambos esticados por esc
      for (const t of [3.93 * esc - meia, 30.07 * esc - meia]) {
        const x = bx + perpX * t, z = bz + perpZ * t
        if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
        if (emPeca(x, z) || molhado(x, z)) continue
        if (mudas.length >= TETO) break
        if (emViaAlheia(x, z, FOLGA_VIA, naSecaoDoBulevar)) {
          rejVia++
          // ⚠️ ao longo da avenida primeiro: a calçada continua depois do
          // cruzamento, e é lá que a fileira quer estar
          const p = empurrar(x, z, [dirX, dirZ], [perpX, perpZ], naSecaoDoBulevar)
          if (!p) continue
          salvas++
          mudas.push(criarMuda(p[0], p[1], espCalcada(p[0], p[1]), i))
          i++
          continue
        }
        mudas.push(criarMuda(x, z, espCalcada(x, z), i))
        i++
      }
    }
  }
  const doBulevar = mudas.length - daCova

  // ── 3. os 3 anéis: cone no canteiro central ──────────────────────────────
  // ⚠️ ISTO NÃO ESTAVA NA SPEC porque o anel não existia quando ela foi escrita.
  // É a peça que faltava para o verde da cidade ser SISTEMA e não ilha: o anel
  // plantado liga um distrito ao outro por baixo de árvore.
  // ⚠️ A FILEIRA SEGUE O POLÍGONO, NÃO O CÍRCULO. O anel virou dodecágono em
  // 31/08 ("teia é em linha reta") e a flecha vai de 60 m no Anel Interior a
  // 259 m na Pista de Serviço: plantar no círculo deixaria a fileira até 259 m
  // FORA da rua, atravessando o terreno — que é exatamente a leitura de "elemento
  // atrapalhando". Aqui a árvore anda pela corda entre duas avenidas, como a via.
  // ⚠️ O NÚMERO DE VÉRTICES É O NÚMERO DE AVENIDAS, não um 12 escrito à mão. O
  // anel vira polígono com um vértice em cada rotatória (é assim que `vias.ts`
  // o desenha, em `verticesDoAnel`), então derivar daqui é o que impede a
  // fileira de sair da corda no dia em que a teia mudar de contagem.
  const _VERT = AVENIDAS.length
  for (const a of aneis) {
    // ⚠️ HIERARQUIA POR NOME (paisagismo.md §1), ATRÁS DE `?verde=1`. Os sete
    // anéis eram uma via só repetida sete vezes (100% conífera); agora cada
    // nome PUBLICADO por `cidade.json` (`a.nome`) busca o caráter do lugar
    // onde está: ver a tabela `PESO_ANEL` em `especies.ts`. Sem o nome (json
    // antigo, sem campo `nome`) cai no perfil neutro do Anel Médio.
    const pesosAnel = a.nome ? (PESO_ANEL[a.nome] ?? PESO_ANEL_PADRAO) : PESO_ANEL_PADRAO
    const espAnel = (px: number, pz: number, semente: number, decl: number) => verde
      ? especieDeTabela(pesosAnel, px, pz, semente, decl)
      : espDa('anel', px, pz, semente, 'cone', decl)
    const n = Math.floor((2 * Math.PI * a.r) / PASSO_BUL)
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2
      // projeta o ângulo na corda do dodecágono: o vértice fica no raio cheio e
      // o meio da aresta em cos(π/12) dele
      const lado = Math.floor((t / (Math.PI * 2)) * _VERT)
      const g0 = (lado / _VERT) * Math.PI * 2, g1 = ((lado + 1) / _VERT) * Math.PI * 2
      const u = (t - g0) / (g1 - g0)
      const P0x = Math.sin(g0) * a.r, P0z = -Math.cos(g0) * a.r
      const P1x = Math.sin(g1) * a.r, P1z = -Math.cos(g1) * a.r
      const x = P0x + (P1x - P0x) * u, z = P0z + (P1z - P0z) * u
      if (Math.hypot(x, z) < rMin || Math.hypot(x, z) > rMax) continue
      if (emPeca(x, z) || molhado(x, z) || noBulevar(x, z)) continue
      // ⚠️ A FILEIRA DO ANEL SÓ TEM DIREITO AO CANTEIRO DO PRÓPRIO ANEL. Fora da
      // faixa dele (rotatória, malha local, outro anel), quem manda é `naVia`.
      // As 46 rotatórias eram o buraco maior: `noBulevar` recusa até 3 m fora da
      // caixa da avenida, e a rotatória tem 40 m de raio, então sobrava um aro de
      // asfalto de 15 m em cada travessia onde a fileira entrava e continuava.
      if (mudas.length >= TETO) break
      // ⚠️ A FAIXA PRÓPRIA DO ANEL É A CORDA, NÃO O CÍRCULO, e testar o círculo
      // custou 12.855 árvores na primeira medição: o anel é um dodecágono desde
      // 31/08 e o meio da aresta fica a 96,6% do raio, então `|hypot − r|` vale
      // 3,4% do raio (235 m na Pista de Serviço) no meio de cada lado. A fileira
      // inteira aparecia como "fora da própria faixa" e ia toda para a máscara.
      // Aqui a distância é ao SEGMENTO P0P1, que é onde a via realmente está.
      const noCanteiroDoAnel = (px: number, pz: number) => {
        const ex = P1x - P0x, ez = P1z - P0z
        const L2 = ex * ex + ez * ez
        const u2 = L2 > 0 ? Math.max(0, Math.min(1, ((px - P0x) * ex + (pz - P0z) * ez) / L2)) : 0
        const qx = P0x + ex * u2, qz = P0z + ez * u2
        // e a rotatória NÃO é faixa própria do anel: ela é rua de outro dono, com
        // 40 m de raio, e `noBulevar` só recusa 3 m fora da caixa da avenida
        return Math.hypot(px - qx, pz - qz) <= a.larg / 2 && !emAvenida(px, pz, 18)
      }
      if (emViaAlheia(x, z, FOLGA_VIA, noCanteiroDoAnel)) {
        rejVia++
        // a fileira do anel corre pela corda: `ao` é a direção da aresta do
        // dodecágono, `tr` é o radial
        const cl = Math.hypot(P1x - P0x, P1z - P0z) || 1
        const aoX = (P1x - P0x) / cl, aoZ = (P1z - P0z) / cl
        const p = empurrar(x, z, [aoX, aoZ], [-aoZ, aoX], noCanteiroDoAnel)
        if (!p) continue
        salvas++
        mudas.push(criarMuda(p[0], p[1], espAnel(p[0], p[1], lado, declive(p[0], p[1])), i))
        i++
        continue
      }
      // ⚠️ O ANEL ERA 100% CONÍFERA, E ELE É MAIS DA METADE DA CIDADE. Contado
      // nos geradores: os 7 anéis somam 26.634 pontos de plantio contra 25.992
      // das 12 avenidas. Uma espécie única em 51% da arborização é o maior
      // multiplicador de "genérico" que este módulo tinha. A semente é o LADO do
      // dodecágono, e não o anel: assim uma aresta inteira tem parentesco e a
      // seguinte troca, que é o que dá a leitura de trecho.
      mudas.push(criarMuda(x, z, espAnel(x, z, lado, declive(x, z)), i))
      i++
    }
  }
  const doAnel = mudas.length - daCova - doBulevar

  // ── 4. a via de contorno, UM lado por quarteirão ─────────────────────────
  // ⚠️ UM LADO E NÃO OS DOIS, e isso é decisão urbana e não economia: plantio
  // unilateral em rua estreita de 7 m é padrão real, e a referência de maquete
  // (RJ Models) entrega masterplan com entourage deliberadamente limitado. Os
  // dois lados dariam mais de 35 mil árvores só aqui.
  const PASSO_CONT = 9.1
  const RECUO_ESQ = 10.7
  // ⚠️ O MEIO SAI DO BLOCO, NÃO DE UMA CONSTANTE. Era `K.quarteirao / 2` (84)
  // para a cidade inteira; com o quarteirão variando por banda (109 no Núcleo,
  // 168 no Meio, 227 no Bairro) isso plantava a fileira de árvores 30 m dentro
  // do lote no Núcleo e 30 m fora dele no Bairro.
  // ⚠️ ESTA FILEIRA FICOU ÓRFÃ EM 31/08 e por isso saiu. Ela era plantada ao
  // longo da VIA DE CONTORNO de cada quarteirão, e a via de contorno deixou de
  // existir quando a cidade passou a ter só as vias principais (7 anéis × 12
  // avenidas). O resultado na chapa eram fileiras pontilhadas atravessando o
  // terreno sem rua nenhuma embaixo, que é o que o fundador viu como elemento
  // atrapalhando. Árvore acompanha rua; sem rua, não há alinhamento.
  //
  // As de BULEVAR e de ANEL continuam, porque essas ruas existem. `?arvcont=1`
  // traz esta de volta para quem restaurar a teia fina.
  const _querCont = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('arvcont') === '1'
  for (const q of (_querCont ? malha.quarteiroes : [])) {
    const meio = q.lado / 2
    // ⚠️ A SEMENTE É O QUARTEIRÃO, NÃO A MUDA. Semente por muda faz os 38% de
    // hash de `especieDe` virarem sorteio a cada 9,1 m e a testada sai com uma
    // espécie diferente por árvore, que é confete. Com a semente do bloco, a
    // testada inteira tem parentesco e é o bloco seguinte que troca.
    const semQ = Math.round(q.x) * 31 + Math.round(q.z)
    // a fileira corre ao longo da TESTADA e recua a PROFUNDIDADE
    const off = (q.prof ?? q.lado) / 2 + 2.5 + 1.07
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const meia = meio - RECUO_ESQ
    const n = Math.floor((meia * 2) / PASSO_CONT)
    // ⚠️ BANDA + ACENTO DE DISTRITO (paisagismo.md §2), ATRÁS DE `?verde=1`.
    // O raio do CENTRO do quarteirão já diz a banda (Núcleo a Cinta); o
    // ângulo já diz o distrito. As duas leituras vêm dos MESMOS arrays
    // publicados que a máscara de via já usa: nada novo é buscado por
    // quarteirão além de um `hypot`/`atan2` que a malha inteira já paga.
    const rQ = Math.hypot(q.x, q.z)
    const bandaQ = BANDAS.length ? bandaDe(rQ, BANDAS) : null
    const distritoQ = DISTRITOS.length ? distritoDe(q.x, q.z, DISTRITOS) : null
    const pesosContorno = bandaQ ? comAcento(PESO_BANDA[bandaQ], distritoQ) : null
    const espContorno = (px: number, pz: number) => verde && pesosContorno
      ? especieDeTabela(pesosContorno, px, pz, semQ)
      : espDa('contorno', px, pz, semQ, 'esfera')
    for (let k = 0; k <= n; k++) {
      const lx = -meia + k * PASSO_CONT
      const x = q.x + lx * cg - off * sg, z = q.z + lx * sg + off * cg
      por(x, z, espContorno(x, z), i++, true, undefined, [cg, sg], [-sg, cg])
    }
  }
  const doContorno = mudas.length - daCova - doBulevar - doAnel

  // ── 4c. a travessa, marcada nas duas bocas: a veia verde do plano-diretor
  // (cap. 3.2) que hoje não tem uma única árvore ─────────────────────────────
  //
  // ⚠️ ISTO É NOVO EM 03/09, E SÓ EXISTE ATRÁS DE `?verde=1`. A travessa (9 m,
  // `TRAVESSAS_POR_K`) corta o quarteirão pelo meio e o plano-diretor a chama
  // de "veia verde contínua" (217,7 km de corredor capilar), mas o código de
  // hoje nunca planta nela: ela nem entra na máscara `naVia` (a nota do topo
  // deste arquivo já registrava o buraco). Duas árvores por travessa, uma em
  // cada BOCA (onde ela encontra a testada do quarteirão, o `TRV_FORA` de
  // `vias.ts`), marcam a passagem sem armar uma segunda alameda de 9,1 m
  // dentro de um corredor de 9 m, o que sobraria fileira dupla disputando
  // pista com pedestre. É leitura de "isto é uma passagem", não de bulevar.
  //
  // ⚠️ SÓ K = 2, 3 E 4 TÊM TRAVESSA DEFINIDA. `travessasPorK` publicado (ver
  // `paisagismo.md` §1) não tem entrada para k = 5 (a banda Borda, 519 dos
  // 1.862 quarteirões): a Borda não tem travessa nesta malha, e plantar uma
  // aqui seria inventar geometria que o gerador não desenhou. `?? []` deixa
  // esses quarteirões de fora, calados, em vez de assumir um par de bordas.
  //
  // ⚠️ O RECUO DA BOCA (6,0 m) É ESCOLHA, NÃO MEDIÇÃO: não há um manual citado
  // para "quanto recuar da esquina de uma travessa de 9 m"; é menor que o
  // recuo de esquina do contorno (10,7 m, NYC) de propósito, porque aqui a
  // árvore está MARCANDO a boca, não evitando o cruzamento.
  const RECUO_TRAV = 6.0
  for (const q of (verde ? malha.quarteiroes : [])) {
    const segs = TRAVESSAS_POR_K[String(q.k ?? '')]
    if (!segs || !segs.length) continue
    const meio = q.lado / 2
    const meiaTrav = meio - RECUO_TRAV
    if (meiaTrav <= 0) continue
    const semQ = Math.round(q.x) * 31 + Math.round(q.z) + 97   // semente distinta do contorno
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const rQ = Math.hypot(q.x, q.z)
    const bandaQ = BANDAS.length ? bandaDe(rQ, BANDAS) : null
    const distritoQ = DISTRITOS.length ? distritoDe(q.x, q.z, DISTRITOS) : null
    const pesosTrav = bandaQ ? comAcento(PESO_BANDA[bandaQ], distritoQ) : null
    for (const seg of segs) {
      const lz = (seg.z0 + seg.z1) / 2
      for (const lx of [-meiaTrav, meiaTrav]) {
        const x = q.x + lx * cg - lz * sg, z = q.z + lx * sg + lz * cg
        const esp = pesosTrav ? especieDeTabela(pesosTrav, x, z, semQ) : 'esfera'
        por(x, z, esp, i++, true, undefined, [cg, sg], [-sg, cg])
      }
    }
  }
  const doTravessa = mudas.length - daCova - doBulevar - doAnel - doContorno

  // ── 4b. o sub-bosque: touceira de arbusto ao pé da árvore ────────────────
  // ⚠️ O ARBUSTO NASCE DA ÁRVORE, NÃO DE UMA GRADE PRÓPRIA, e isso não é preguiça
  // é composição: canteiro de arbusto solto no meio do terreno vira mato, o que o
  // olho lê como jardim é o arbusto ENCOSTADO no pé da árvore, formando uma massa
  // baixa contínua embaixo da fileira. Herdar a posição da muda também herda de
  // graça tudo o que ela já passou: raio, peça, água e via.
  //
  // ⚠️ MAS HERDAR NÃO DISPENSA CONFERIR, porque o arbusto anda de 1,6 a 3,1 m do
  // tronco e 3,1 m é mais que os 1,9 m de folga da própria muda: na calçada de
  // 5 m, um arbusto empurrado para fora cai na sarjeta. Cada touceira passa por
  // `vale` de novo, com a seção própria genérica de avenida e anel, e quem não
  // passa simplesmente não nasce.
  //
  // ⚠️ A SEÇÃO PRÓPRIA AQUI É GENÉRICA, e a diferença importa. `naSecaoDoBulevar`
  // e `noCanteiroDoAnel` valem por avenida e por aresta do dodecágono; o arbusto
  // não sabe de quem herdou. `propriaGeral` é a união das duas, ou seja mais
  // permissiva: ela deixa o arbusto ficar na calçada de QUALQUER avenida, não só
  // da sua. NÃO MEDI quantas touceiras isso deixa passar na calçada da avenida
  // vizinha; como as duas fileiras são plantadas do mesmo jeito, a leitura não
  // muda.
  const propriaGeral = (px: number, pz: number) =>
    (emAvenida(px, pz, 0) && !noAnel(px, pz, 18)) || noAnel(px, pz, 0)
  interface Arbusto { x: number; z: number; esc: number; escXZ: number; giro: number; tint: THREE.Color | null }
  const arbustos: Arbusto[] = []
  if (look2) {
    for (let k = 0; k < mudas.length; k++) {
      const m = mudas[k]
      // 55% das árvores ganham touceira, de 1 a 3 arbustos: a fração é o que
      // separa "fileira com canteiro" de "cidade coberta de mato"
      if (hash01(k * 913 + 17) > 0.55) continue
      const quantos = 1 + Math.floor(hash01(k * 2287) * 3)
      for (let j = 0; j < quantos; j++) {
        const a = hash01(k * 331 + j * 97) * Math.PI * 2
        const d = 1.6 + hash01(k * 613 + j * 53) * 1.5
        const px = m.x + Math.cos(a) * d, pz = m.z + Math.sin(a) * d
        if (!vale(px, pz, propriaGeral)) continue
        arbustos.push({
          x: px, z: pz,
          esc: 0.62 + hash01(k * 71 + j * 29) * 0.85,
          escXZ: 0.80 + hash01(k * 149 + j * 11) * 0.55,
          giro: hash01(k * 977 + j * 13) * Math.PI * 2,
          // ⚠️ O ARBUSTO PEGA O TINTE DA ÁRVORE DE CIMA, não um seu. Touceira e
          // copa no mesmo lugar com temperaturas diferentes lê como dois
          // plantios sobrepostos; com o mesmo tinte, lê como um canteiro só.
          tint: m.tint,
        })
      }
    }
  }

  // ── 5. seis InstancedMesh, UM material ───────────────────────────────────
  //
  // ⚠️ SEIS ANTES, SEIS DEPOIS, E A CONTA MUDOU DE LUGAR. Até 02/09 eram 3 baldes
  // de perto (esfera, cone, copada), 2 de longe (cruzEsfera, cruzCone) e 1 de
  // arbusto. Agora são 4 de perto (a colunar entrou), 1 de longe (os dois viraram
  // um) e 1 de arbusto. A troca é honesta: `cruzEsfera` e `cruzCone` desenhavam o
  // MESMO octaedro de 8 triângulos com proporções diferentes (7,0 × 4,8 e
  // 11,0 × 4,6), e proporção sai da matriz de instância de graça, como a copada já
  // provava desde 01/09. A chamada economizada pagou a quarta silhueta.
  //
  // ⚠️ DoubleSide POR CAUSA DA SAIA DA CONÍFERA: as três saias são cascas abertas
  // e a de baixo se vê por dentro em qualquer câmera de rua. Custa fragmento a
  // mais em copa de 92 triângulos, o que não move o ponteiro.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  })
  // ⚠️ UM MATERIAL PARA AS SEIS, e ele é o recurso escasso desta cena: a vista
  // alta compila 402 programas. `InstancedMesh` novo custa uma CHAMADA; material
  // novo custa um PROGRAMA, que é muito mais caro. Nenhuma das quatro espécies
  // tem material próprio: a identidade delas está na geometria e no `setColorAt`.
  const geos: Partial<Record<EspecieId, THREE.BufferGeometry>> = look2
    ? { esfera: ESPECIES.esfera.geo(), cone: ESPECIES.cone.geo(),
        copada: ESPECIES.copada.geo(), colunar: ESPECIES.colunar.geo() }
    : { esfera: GEO_LOOK1.esfera(), cone: GEO_LOOK1.cone() }
  const gArb = look2 ? geoArbusto() : null
  const gLonge = geoLonge()
  const tri = (g?: THREE.BufferGeometry | null) => (g ? g.getIndex()!.count / 3 : 0)
  const TRI_ARB = tri(gArb)

  /** quantas de cada espécie foram plantadas, na ordem estável de `ORDEM` */
  const nPor: Record<EspecieId, number> = { esfera: 0, cone: 0, copada: 0, colunar: 0 }
  for (const m of mudas) nPor[m.forma]++

  // ⚠️ 900 ERA POUCO DEMAIS e o fundador viu: "esse monte de bloco verde é o quê?
  // Horrível". Com 40.000 árvores e teto de 900 copas, 39.518 delas eram o LOD de
  // longe, então praticamente a cidade INTEIRA era o LOD. Um teto de LOD só vale
  // quando o LOD é a exceção.
  // ⚠️ E O TETO CAIU DUAS VEZES no look 2, porque a copa engordou: o pé levou a
  // esfera de 30 para 52 triângulos e a massa de folha lobada de 52 para 92.
  // ⚠️ AGORA ELE CAIU DE NOVO PARA PAGAR A COLUNAR, E A SOMA FICOU MENOR QUE A DE
  // ANTES. Os três tetos velhos custavam, no pior caso,
  // 2.600 × 92 + 1.200 × 92 + 1.400 × 80 = 461.600 triângulos. Os quatro de agora
  // custam 2.200 × 92 + 1.200 × 92 + 1.100 × 80 + 800 × 82 = 466.400, ou seja
  // +4.800 triângulos de PIOR CASO, 0,10% dos 4,91 M da cena. E o pior caso quase
  // não acontece: a densidade medida é de 616 árvores/km², um disco de
  // R_CHEIA = 1.400 m contém cerca de 3.794 árvores e a repartição por espécie
  // fica dentro dos quatro tetos.
  //
  // ⚠️ E O TETO NÃO É COBRADO QUANDO NÃO É USADO. O balde de perto ficava com
  // `count` no teto e as sobras preenchidas com matriz de escala zero: triângulo
  // degenerado não pinta pixel, mas PASSA pelo vértice. `count` recebe o número de
  // fato preenchido.
  const CAP: Record<EspecieId, number> = look2
    ? { esfera: 2200, cone: 1100, copada: 1200, colunar: 800 }
    : { esfera: 6000, cone: 6000, copada: 1, colunar: 1 }
  // ⚠️ O ARBUSTO É O MAIS BARATO DE TODOS, E POR ISSO O RAIO É CURTO. 420 m e
  // teto de 1.400: na densidade medida, um disco de 420 m tem cerca de 341
  // árvores e, com 55% delas ganhando de 1 a 3 touceiras, cerca de 375 arbustos.
  // O teto é quase 4 vezes a conta esperada e custa 1.400 × 40 = 56.000
  // triângulos no pior caso.
  const R_ARBUSTO = 420
  const CAP_ARB = look2 ? 1400 : 1

  /** as espécies que existem neste look, na ordem estável */
  const vivas = ORDEM.filter((e) => !!geos[e])
  const malhas: Record<string, THREE.InstancedMesh> = {
    // ⚠️ UM BALDE DE LONGE SÓ, E A CAPACIDADE É A CIDADE INTEIRA. No pior
    // enquadramento (câmera de órbita, nenhuma árvore dentro de R_CHEIA) todas as
    // mudas caem aqui: dimensionar por espécie faria a matriz estourar em silêncio
    // no dia em que a mistura mudasse.
    longe: new THREE.InstancedMesh(gLonge, mat, Math.max(1, mudas.length)),
  }
  for (const e of vivas) malhas[`cheia:${e}`] = new THREE.InstancedMesh(geos[e]!, mat, CAP[e])
  if (gArb) malhas.arbusto = new THREE.InstancedMesh(gArb, mat, CAP_ARB)
  for (const [nome, m] of Object.entries(malhas)) {
    m.name = `arvore:${nome}`
    m.castShadow = o.sombra ?? true
    m.receiveShadow = false          // copa recebendo sombra de copa é só ruído
    m.frustumCulled = false
    group.add(m)
  }

  const m4 = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const qua = new THREE.Quaternion()
  const eul = new THREE.Euler()
  const esc = new THREE.Vector3()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const y0 = mudas.map((m) => o.heightAt(m.x, m.z))
  const yArb = arbustos.map((a) => o.heightAt(a.x, a.z))

  // ── a cor por instância entra UMA VEZ, no balde de longe e nos de perto ────
  // ⚠️ instanceColor MULTIPLICA a cor por vértice, não a substitui: o tronco
  // continua tronco e o torrão continua terra, e o tinte inclina os três juntos,
  // que é como a luz de um lugar se comporta. Por isso o tinte é quase neutro
  // (nenhum canal passa de 1,00) em vez de uma cor cheia.
  if (look2) {
    for (const m of Object.values(malhas)) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.count * 3).fill(1), 3)
    }
  }

  // ⚠️ O BALDE DE PERTO PASSOU A SER O DOS MAIS PERTO, E ANTES NÃO ERA. O laço
  // preenchia na ordem do vetor até bater o teto: quando o teto mordia, quem
  // levava a copa cheia era quem tinha sido PLANTADO primeiro, não quem estava
  // perto da câmera, e sobrava octaedro de 8 triângulos a 40 m do olho. O
  // conserto é um histograma de 48 baldes de distância POR ESPÉCIE (duas passadas
  // O(n), sem ordenar 40 mil): ele devolve o raio em que a contagem enche o teto,
  // e o teto vira um raio em vez de uma ordem de chegada.
  const BINS = 48
  const binW = R_CHEIA / BINS
  const hist: Record<EspecieId, Int32Array> = {
    esfera: new Int32Array(BINS), cone: new Int32Array(BINS),
    copada: new Int32Array(BINS), colunar: new Int32Array(BINS),
  }
  const corte = (h: Int32Array, teto: number) => {
    let acc = 0
    for (let b = 0; b < BINS; b++) { acc += h[b]; if (acc > teto) return b * binW }
    return R_CHEIA
  }
  /** raio de corte ao quadrado, por espécie */
  const r2: Record<EspecieId, number> = { esfera: 0, cone: 0, copada: 0, colunar: 0 }
  /** o próximo índice livre de cada balde de perto */
  const iCheia: Record<EspecieId, number> = { esfera: 0, cone: 0, copada: 0, colunar: 0 }

  let ultima = new THREE.Vector3(1e9, 1e9, 1e9)
  let cheias = 0
  const rebalancear = (cam: THREE.Vector3) => {
    for (const e of ORDEM) { hist[e].fill(0); iCheia[e] = 0 }
    for (let k = 0; k < mudas.length; k++) {
      const m = mudas[k]
      const d = Math.hypot(m.x - cam.x, m.z - cam.z)
      if (d >= R_CHEIA) continue
      hist[m.forma][Math.min(BINS - 1, (d / binW) | 0)]++
    }
    for (const e of ORDEM) r2[e] = corte(hist[e], CAP[e]) ** 2

    let iL = 0
    for (let k = 0; k < mudas.length; k++) {
      const m = mudas[k]
      const dx = m.x - cam.x, dz = m.z - cam.z
      const d2 = dx * dx + dz * dz
      pos.set(m.x, y0[k], m.z)
      if (m.tomboX || m.tomboZ) {
        eul.set(m.tomboX, m.giro, m.tomboZ, 'YXZ')
        qua.setFromEuler(eul)
      } else qua.setFromAxisAngle(eixoY, m.giro)
      const perto = malhas[`cheia:${m.forma}`]
      if (perto && d2 < r2[m.forma] && iCheia[m.forma] < CAP[m.forma]) {
        esc.set(m.esc * m.escXZ, m.esc * m.escY, m.esc * m.escXZ)
        m4.compose(pos, qua, esc)
        const j = iCheia[m.forma]++
        if (m.tint) perto.setColorAt(j, m.tint)
        perto.setMatrixAt(j, m4)
      } else {
        // ⚠️ A PROPORÇÃO DE LONGE VEM DA TABELA, e é ela que faz quatro espécies
        // caberem num octaedro só. A colunar entra em 0,40 × 1,77 e a conífera em
        // 0,96 × 1,57: a 1.400 m ninguém tem espécie, todo mundo tem PROPORÇÃO, e
        // é a proporção que faz uma fileira de cipreste continuar lendo como
        // fileira de cipreste na silhueta do horizonte.
        const L = ESPECIES[m.forma].longe
        esc.set(m.esc * m.escXZ * L.escXZ, m.esc * m.escY * L.escY, m.esc * m.escXZ * L.escXZ)
        m4.compose(pos, qua, esc)
        if (m.tint) malhas.longe.setColorAt(iL, m.tint)
        malhas.longe.setMatrixAt(iL++, m4)
      }
    }
    // ⚠️ `count` EM VEZ DE MATRIZ ZERADA: a sobra do teto deixou de ser cobrada.
    malhas.longe.count = iL
    cheias = 0
    for (const e of vivas) { malhas[`cheia:${e}`].count = iCheia[e]; cheias += iCheia[e] }

    // o sub-bosque: sem histograma, porque o teto é quase 4 vezes a conta
    // esperada dentro do raio. ⚠️ SE ELE MORDER, quem fica de fora é quem foi
    // plantado por último, não quem está mais longe: é o mesmo defeito de ordem
    // de chegada que o histograma consertou para a copa. NÃO MEDI se ele morde.
    let iA = 0
    if (malhas.arbusto) {
      const rA2 = R_ARBUSTO * R_ARBUSTO
      for (let k = 0; k < arbustos.length && iA < CAP_ARB; k++) {
        const a = arbustos[k]
        const dx = a.x - cam.x, dz = a.z - cam.z
        if (dx * dx + dz * dz >= rA2) continue
        pos.set(a.x, yArb[k], a.z)
        qua.setFromAxisAngle(eixoY, a.giro)
        esc.set(a.esc * a.escXZ, a.esc, a.esc * a.escXZ)
        m4.compose(pos, qua, esc)
        if (a.tint) malhas.arbusto.setColorAt(iA, a.tint)
        malhas.arbusto.setMatrixAt(iA++, m4)
      }
      malhas.arbusto.count = iA
    }

    for (const m of Object.values(malhas)) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  }
  rebalancear(new THREE.Vector3(0, 0, 0))

  // pior caso contado no código, não medido na chapa: todo balde de perto cheio
  let triangulos = mudas.length * 8 + CAP_ARB * TRI_ARB
  for (const e of vivas) triangulos += CAP[e] * tri(geos[e])

  console.log(
    `[arborização] ${mudas.length.toLocaleString('pt-BR')} árvores (paisagismo ${verde ? 'ON' : 'off'}): ` +
    `${daCova.toLocaleString('pt-BR')} de cova, ${doBulevar.toLocaleString('pt-BR')} de bulevar, ` +
    `${doAnel.toLocaleString('pt-BR')} de anel, ${doContorno.toLocaleString('pt-BR')} de contorno, ` +
    `${doTravessa.toLocaleString('pt-BR')} de travessa; ` +
    `${rejVia.toLocaleString('pt-BR')} recusadas pela máscara de via ` +
    `(${salvas.toLocaleString('pt-BR')} salvas pelo empurrão, ${(rejVia - salvas).toLocaleString('pt-BR')} perdidas)` +
    `${naVia ? '' : ' (MÁSCARA AUSENTE: o campo `naVia` não chegou por opts)'}` +
    `; espécies ` + vivas.map((e) =>
      `${ESPECIES[e].nome} ${nPor[e].toLocaleString('pt-BR')} (${tri(geos[e])} tri, teto ${CAP[e]})`,
    ).join(', ') +
    `; ${arbustos.length.toLocaleString('pt-BR')} arbustos de ${TRI_ARB} tri` +
    `; ${Object.keys(malhas).length} chamadas de desenho, ` +
    `${triangulos.toLocaleString('pt-BR')} triângulos de pior caso, look ${look2 ? 2 : 1}`,
  )

  return {
    group,
    arvores: mudas.length,
    get cheias() { return cheias },
    triangulos,
    /** ⚠️ SÓ REFAZ OS BALDES QUANDO A CÂMERA ANDOU 150 m. Rebalancear por quadro
     *  é O(40.000) e a spec marcou o custo disso como não medido; árvore não se
     *  mexe, e a diferença entre cruz e copa a 400 m não muda em meio quarteirão. */
    update(cam: THREE.Vector3) {
      if (cam.distanceToSquared(ultima) < PASSO_REBALANCE * PASSO_REBALANCE) return
      ultima = cam.clone()
      rebalancear(cam)
    },
    dispose() {
      for (const m of Object.values(malhas)) { m.geometry.dispose(); m.dispose() }
      mat.dispose()
      group.clear()
    },
  }
}
