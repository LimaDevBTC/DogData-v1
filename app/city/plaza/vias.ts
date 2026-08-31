// ═══════════════════════════════════════════════════════════════════════════
// AS VIAS: a rua da DogCity, que até 29/08/2026 não existia.
//
// ⚠️ O DIAGNÓSTICO QUE ORIGINOU ESTE ARQUIVO. O levantamento mediu a cena com
// ?tecido=1 e achou o motivo de o loteamento parecer amador, e não era
// acabamento, era ausência: as únicas ruas com geometria eram os 12 bulevares de
// costura. Tudo que se lia como "rua" dentro dos quarteirões era o VÃO entre os
// plintos dos lotes, o recuo de 1,4 m de tecido.ts. Sem calçada, sem meio-fio,
// sem travessa, sem esquina. Um loteamento sem via desenhada é uma mancha com
// frestas, e é isso que a chapa mostrava.
//
// A referência (maqueteiros de masterplan: RJ Models, Artistic Models, Pipers)
// diz que em maquete a rua é o que se GRAVA, e o limite de lote é implícito. Por
// isso aqui a pista é mais ESCURA que o regolito e a calçada é mais CLARA que o
// lote: de cima a malha viária vira uma teia desenhada, com fio claro na borda e
// miolo escuro, que é como um plano de massas se lê numa prancha.
//
// Toda a geometria sai de public/city/cidade-malha.json, que o gerador publica:
// 1.182 quarteirões com centro, lado e GIRO, mais os 12 bulevares. Nada aqui é
// inventado; se o gerador mudar a malha, a rua muda junto.
//
// Três seções, todas em constantes.* do mesmo json:
//   contorno  12 m  em volta de cada quarteirão (6 m por quarteirão, ver abaixo)
//   travessa   9 m  duas por quarteirão, em z local [-34,-25] e [25,34]
//   bulevar   34 m  12 raios sobre a costura de setor, com canteiro central
//
// ── O QUE A RODADA DA MAQUETE (maquete-spec.md seção 3) MUDOU AQUI ──────────
//  (1) COR: o canteiro sai de #4A5C3E (L 0,095) para VERDE #7E8A6B (L 0,237). O
//      verde antigo estava a 8 milésimos de luminância da pista e de cima o
//      bulevar lia como TRÊS faixas escuras em vez de duas pistas e um canteiro.
//  (2) FUSÃO: 4 materiais e 4 chamadas de desenho viram 1 material com cor por
//      vértice. A partir daqui acrescentar cor à rua deixa de custar material,
//      que é o recurso escasso desta cena (228 programas compilados na vista de
//      topo, teto de 235).
//  (3) TRAVESSIA ELEVADA nas 4 bocas de cada quarteirão com lote, EIXO tracejado
//      só nos 12 bulevares e FAIXA DE PEDESTRE só onde o bulevar cruza um
//      contorno de quarto. Faixa pintada em rua de 7 m não existe na chapa
//      (0,09 px na zenital); a travessia elevada é volume e existe.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { LIMIAR_PRACA } from './pracas'
import type { DistanceCuller } from './perf'
import { AVENIDAS, avenidasGeom } from './teia'

export interface ViasOpts {
  heightAt: (x: number, z: number) => number
  /** ⚠️ a cota da lâmina: a teia não atravessa a baía. Sem isto os 26 anéis
   *  completos cruzam 20,5 km² de água. */
  cotaAgua?: number
  /** ⚠️ ESTÁ NA BAÍA? A rua PARA na orla dela (fundador, 31/08: "retire as
   *  estradas de cima da baía"). Canal de 60 m e cratera de 300 m continuam
   *  ganhando ponte — o que não existe é viaduto de 20,5 km². Sem esta consulta a
   *  via não distingue os dois casos, porque para ela toda água é água. */
  naBaia?: (x: number, z: number) => boolean
  /** ⚠️ as parcelas do programa JÁ ENCAIXADAS na teia (programa.ts). Quando elas
   *  vêm, a máscara de peça é o polígono do MÓDULO, e aí a rua para exatamente na
   *  divisa da parcela: os lados da peça SÃO ruas, por construção. Sem isto a
   *  máscara usa o retângulo antigo do gerador, que é de outra grade. */
  parcelas?: { poly: [number, number][] }[]
  /** sombra própria da rua: é o meio-fio de 0,15 m que dá relevo à seção */
  sombra?: boolean
  /** a malha já carregada (public/city/cidade-malha.json). Sem ela o módulo busca sozinho. */
  malha?: Malha
  /** as 38 peças do programa (public/city/cidade.json). Sem elas o módulo busca sozinho. */
  meta?: Meta
  /** onde registrar as marcas de bulevar; sem ele, chame `update(cam)` a cada quadro */
  culler?: DistanceCuller
}

export interface Vias {
  group: THREE.Group
  quarteiroes: number
  /** anéis desenhados e rotatórias nos cruzamentos com os bulevares */
  aneis: number
  rotatorias: number
  pracas: number
  bulevares: number
  /** travessias elevadas nas bocas de quarteirão */
  travessias: number
  /** traços do eixo tracejado dos bulevares */
  eixos: number
  /** cruzamentos de bulevar com contorno de quarto que ganharam faixa */
  faixas: number
  triangulos: number
  metrosDeVia: number
  /** liga/desliga as marcas de bulevar por distância; redundante se `culler` foi passado */
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ⚠️ AS COTAS SÃO O QUE FAZ A RUA TER SEÇÃO E NÃO SER UM ADESIVO. O plinto do
// lote em tecido.ts tem 0,45 m; a calçada fica 0,12 abaixo dele e a pista 0,15
// abaixo da calçada. Esses 15 cm são o meio-fio residencial universal dos EUA
// (6 in), o único número de guia que a pesquisa achou em fonte primária.
// ⚠️ NÃO INVERTA ESTAS TRÊS COTAS. pracas.ts:55-58 amarra o Y_BASE 0,33 da praça
// à calçada daqui para que quem anda na rua entre na praça sem degrau; mexer
// aqui quebra as 128 praças de lá em silêncio.
const Y_PISTA = 0.18
const Y_CALCADA = 0.33
const Y_CANTEIRO = 0.40

// ⚠️ 0,02 m É A CONSTANTE ÚNICA DE FOLGA, E ELA FOI MEDIDA. Só ALTURA resolve
// aqui, e 0,02 m segura cobertura plena de 300 m a 9.000 m.
//
// ⚠️ A EXPLICAÇÃO ANTIGA CAIU, A CONSTANTE NÃO. Este comentário dizia que
// polygonOffset era INERTE porque a cena ligava logarithmicDepthBuffer e o
// fragmento escrevia gl_FragDepthEXT, apagando o deslocamento do rasterizador
// (fator 0, -16 e -64 davam os MESMOS 9.556 px na bancada). Isso era verdade
// enquanto o buffer logarítmico estava ligado; ele foi DESLIGADO por padrão
// quando o `near` passou a acompanhar a distância (plaza-scene.tsx), então hoje
// polygonOffset FUNCIONA de novo. A folga por altura continua sendo a escolha:
// ela não depende de estado do rasterizador e sobrevive à próxima troca.
const FOLGA = 0.02

// Paleta: a pista é o valor mais escuro da cidade e a calçada o mais claro. O
// lote (PEDRA em tecido.ts) fica entre os dois de propósito, senão a teia some.
// Razões medidas: calçada/pista 4,41:1, marca/pista 5,08:1, verde/pista 2,09:1.
const COR_PISTA = '#57534B'
const COR_CALCADA = '#CBC4B6'
const COR_MEIOFIO = '#8F8879'
const COR_CANTEIRO = '#7E8A6B'
const COR_MARCA = '#D8D2C4'
// ⚠️ O PLATÔ DO QUARTEIRÃO: a plataforma terraplenada, esperando prédio.
// Ele é MAIS CLARO que a pista de propósito, e é isso que faz a malha existir.
const COR_PLATO = '#9E968A'

type Alvo = 'pista' | 'calcada' | 'canteiro' | 'meiofio' | 'marca' | 'plato'

// ⚠️ AS CORES VIRAM Color UMA VEZ E ENTRAM COMO ATRIBUTO. Com
// ColorManagement.enabled (padrão desde a r152) o setStyle já converte sRGB para
// linear, que é o espaço de trabalho: escrever o hex cru no atributo devolveria
// a rua clara demais.
const COR: Record<Alvo, THREE.Color> = {
  pista: new THREE.Color(COR_PISTA),
  plato: new THREE.Color(COR_PLATO),
  calcada: new THREE.Color(COR_CALCADA),
  canteiro: new THREE.Color(COR_CANTEIRO),
  meiofio: new THREE.Color(COR_MEIOFIO),
  marca: new THREE.Color(COR_MARCA),
}

/** uma faixa da seção: de/até em metros a partir da borda t=0, na cota alt */
interface Banda { de: number; ate: number; alt: number; alvo: Alvo }

// Seção do meio contorno: o quarteirão tem lado 168 e a célula 180, então sobram
// 12 m entre dois quarteirões vizinhos. ⚠️ CADA QUARTEIRÃO DESENHA SÓ A SUA
// METADE (6 m, da borda 84 até 90); o vizinho desenha a outra e as duas se
// encontram exatamente em 90. Desenhar os 12 m inteiros duplicaria a via em toda
// divisa e o z-fighting apareceria como listra piscando na chapa.
const SEC_CONTORNO: Banda[] = [
  { de: 0.0, ate: 2.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 2.5, ate: 6.0, alt: Y_PISTA, alvo: 'pista' },
]
// ⚠️ A RUA DA TEIA, 12 m, CENTRADA NA DIVISA E INTEIRA.
// Ela substitui o par de meias-seções que cada quarteirão desenhava por conta
// própria. Ver a nota grande na seção 1: meia-seção por quarteirão nunca fecha
// cruzamento, porque no cruzamento não existe quarteirão para desenhar.
const SEC_RUA: Banda[] = [
  { de: -6.0, ate: -3.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: -3.5, ate: +3.5, alt: Y_PISTA, alvo: 'pista' },
  { de: +3.5, ate: +6.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// Travessa de 9 m, seção inteira (ela não é compartilhada com ninguém)
const SEC_TRAVESSA: Banda[] = [
  { de: 0.0, ate: 1.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 1.5, ate: 7.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 7.5, ate: 9.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// Bulevar de 34 m com canteiro central: 5 + 10 + 4 + 10 + 5. O canteiro não é
// enfeite, é onde a arborização de eixo vai plantar quando ela existir.
const SEC_BULEVAR: Banda[] = [
  { de: 0.0, ate: 5.0, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 5.0, ate: 15.0, alt: Y_PISTA, alvo: 'pista' },
  { de: 15.0, ate: 19.0, alt: Y_CANTEIRO, alvo: 'canteiro' },
  { de: 19.0, ate: 29.0, alt: Y_PISTA, alvo: 'pista' },
  { de: 29.0, ate: 34.0, alt: Y_CALCADA, alvo: 'calcada' },
]

// ⚠️ O ANEL: 26 m, e ele é a hierarquia que faltava. Com 12 bulevares radiais e
// mais nada, ir do setor 4 ao setor 8 obrigava a passar pela praça: a cidade era
// uma roda de bicicleta sem aro. Numa chapa isso não aparece; numa volta de
// carro aparece na primeira curva, e a direção de arte agora é dirigível.
// Seção 3,5 + 8 + 3 + 8 + 3,5: duas pistas com canteiro no meio, igual ao
// bulevar em menor escala, e o canteiro existe para a arborização de eixo.
const SEC_ANEL: Banda[] = [
  { de: 0.0, ate: 3.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 3.5, ate: 11.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 11.5, ate: 14.5, alt: Y_CANTEIRO, alvo: 'canteiro' },
  { de: 14.5, ate: 22.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 22.5, ate: 26.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// A rotatória onde o anel cruza um bulevar. Rotatória e não cruzamento porque
// numa malha radial os ângulos não são retos, e semáforo em ângulo agudo é
// impossível de dirigir.
const ROT_RAIO = 40, ROT_ILHA = 16

// ── a travessia elevada (spec 3.5) ────────────────────────────────────────
// Platô de 6 m no sentido da via, na cota da calçada, com rampa de 1 m nas duas
// pontas. Vive dentro da boca da travessa, encostado na calçada do contorno.
const TRV_FORA = 84      // a boca: onde a travessa encontra a calçada do contorno
const TRV_PLATO = 6.0
const TRV_RAMPA = 1.0
// ⚠️ 10 cm DE RECUO DE CADA MEIO-FIO, E É O QUE EVITA UMA BRIGA COPLANAR. Se o
// platô encostasse no meio-fio a face lateral dele (0,17 m) nasceria no MESMO
// plano da face do meio-fio (0,15 m) e as duas piscariam na chapa. Com o recuo o
// platô tem 5,8 m e nenhuma face nova precisa ser desenhada: o meio-fio que já
// existe é a parede da travessia.
const TRV_RECUO = 0.10

// ── o eixo tracejado do bulevar (spec 3.6) ────────────────────────────────
// 3 m de marca por 9 m de vão é a broken lane line do MUTCD (10 ft por 30 ft).
// Largura 0,60 m, quatro vezes a linha normal do manual, porque isto é convenção
// de maquete e não tinta de trânsito: a 300 m mede 2,34 px e a 1.000 m, 0,70.
const EIXO_MARCA = 3.0
const EIXO_VAO = 9.0
const EIXO_LARG = 0.60
// ⚠️ A MARCA DE BULEVAR SÓ EXISTE PARA A VISTA DE PEDESTRE E TEM DE MORRER CEDO.
// Ela é geometria e não shader, então não tem piso em pixel: de longe vira
// cintilação sem entregar desenho. Por isso cada bulevar é uma malha própria
// (mesmo material, zero material novo) registrada no DistanceCuller com o centro
// NO MEIO DO RAIO, e não na origem. props.ts:98 registra com centro na origem e
// mede a distância a partir da praça central; não copie aquele erro.
const MARCA_CULL = 900

// ── a faixa de pedestre (spec 3.7) ────────────────────────────────────────
// 6 barras de 0,60 m separadas por 1,80 m atravessando os 10 m de pista (MUTCD:
// barra continental de 12 in mínimo e 24 in preferido, separação mínima de 6 ft).
const FAIXA_BARRAS = 6
const FAIXA_LARG = 0.60
const FAIXA_VAO = 1.80

interface Quarteirao {
  id: string; setor: number; x: number; z: number; r: number
  /** ⚠️ `giro` e `lado` são DO BLOCO agora: 109 no Núcleo, 168 no Meio, 227 no
   *  Bairro, e na Cinta o giro é a tangente local, diferente em cada quarteirão */
  giro: number; lado: number; lotes: number
  /** ⚠️ profundidade RADIAL do quarteirão. Na teia ela difere da testada: `lado`
   *  é o arco (125 a 250 m) e `prof` é o vão entre anéis (109/168/227) */
  prof: number
  /** faixas de 50 m do quarteirão: define quantas travessas e fileiras ele tem */
  k: number
  /** a banda do distrito: é ela que agrupa os quarteirões num anel */
  quarto?: number
}
interface Bulevar {
  id: string; rumo: number; largura: number
  rInicio: number; rFim: number
  x0: number; z0: number; x1: number; z1: number
}
interface Peca { x: number; z: number; a: number; b: number; rot: number; forma?: string }
export interface Parque { id: string; x: number; z: number; a: number; b: number; rot: number }
export interface Diagonal { id: string; rumo: number; afastamento: number; largura: number }
export interface Malha {
  constantes: {
    distritos: number; viaContorno: number
    bulevar: number; raioSitio: number
    // ⚠️ NÃO EXISTE MAIS UM QUARTEIRÃO SÓ, e por isso a travessa também não é
    // uma tabela só: ela depende de k (2, 3 ou 4 faixas). Ler `travessas` fixo
    // desenhava travessa fora do quarteirão no Núcleo e faltava uma no Bairro.
    travessasPorK: Record<string, { z0: number; z1: number }[]>
    bandas: { de: number; ate: number; nome: string; k: number; lado: number }[]
    cinta: { de: number; faixas: number[]; lados: number[] }
    arcoBanda: number; avenidaDistrito: number; diagLargura: number
  }
  bulevares: Bulevar[]
  quarteiroes: Quarteirao[]
  parques?: Parque[]
  diagonais?: Diagonal[]
  contorno?: [number, number][]
}
export interface Anel { id: string; nome: string; r: number; larg: number }
export interface Meta { programa: Peca[]; raioBorda: number; aneis?: Anel[] }

/** acumulador de triângulos: uma malha só, cor por vértice */
class Fita {
  vs: number[] = []
  cs: number[] = []
  ix: number[] = []
  // ⚠️ OS QUATRO CANTOS TÊM DE VIR NO SENTIDO ANTI-HORÁRIO VISTO DE CIMA, senão
  // a normal aponta para baixo e o backface culling apaga a face inteira. Custou
  // uma rodada inteira em pracas.ts (a nota está em pracas.ts:101-107).
  add(cor: THREE.Color,
      ax: number, ay: number, az: number, bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) {
    const b = this.vs.length / 3
    this.vs.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    for (let i = 0; i < 4; i++) this.cs.push(cor.r, cor.g, cor.b)
    this.ix.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  get triangulos() { return this.ix.length / 3 }
  get vazia() { return this.ix.length === 0 }
  malha(mat: THREE.Material, nome: string): THREE.Mesh {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.vs, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cs, 3))
    g.setIndex(this.ix)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat)
    m.name = nome
    return m
  }
}

/** um eixo de via já discretizado: é ele que devolve a altura EXATA do plano da
 *  pista, que é o que toda marca precisa para não afundar. */
interface Trilho {
  ax: number; az: number; bx: number; bz: number
  perpX: number; perpZ: number
  comp: number; passos: number
  secao: Banda[]
  /** um por passo: false onde a máscara (peça, bulevar, borda) cortou o segmento */
  desenhado: boolean[]
}

export async function buildVias(o: ViasOpts): Promise<Vias> {
  // ⚠️ AS AVENIDAS VÊM DE `teia.ts`, NÃO DA MALHA PUBLICADA. O gerador publica as
  // costuras dos 6 distritos como "bulevares", e elas ficam entre 5,6° e 73,1°
  // uma da outra: divisa de loteamento, não estrutura viária. A avenida quer
  // simetria e mora na teia. Ver a nota longa em `teia.ts`.
  const [malha, meta] = await Promise.all([
    o.malha ?? fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<Malha>),
    o.meta ?? fetch('/city/cidade.json').then((r) => r.json() as Promise<Meta>),
  ])
  // ⚠️ TROCA AS COSTURAS PUBLICADAS PELAS 12 AVENIDAS SIMÉTRICAS. O gerador
  // publica as divisas dos 6 distritos no campo `bulevares`, e elas ficam entre
  // 5,6° e 73,1° uma da outra (medido): isso é divisa de loteamento, não
  // estrutura viária. Ver a nota longa em `teia.ts`.
  // ⚠️ A CONSTRUÇÃO SAIU DAQUI EM 31/08 e foi para `avenidasGeom()` em teia.ts.
  // Ela era feita aqui, na CÓPIA LOCAL deste módulo, e a arborização buscava o
  // mesmo JSON por conta própria: nunca via a troca e plantava nas 9 costuras de
  // distrito enquanto a rua saía nas 12 avenidas. Ver a nota em teia.ts.
  malha.bulevares = avenidasGeom() as Bulevar[]

  const K = malha.constantes
  // ⚠️ `meio` ERA GLOBAL E VALIA 84 PARA A CIDADE INTEIRA. Com o quarteirão
  // variando por banda ele passou a sair do bloco; a constante global aqui
  // desenhava contorno de 168 m em cima de quarteirão de 109 e de 227.
  const group = new THREE.Group()
  group.name = 'vias'

  // ── as duas máscaras que a via tem de respeitar ───────────────────────────
  // (1) as 38 peças do programa: lago, estádio e alfândega já ocupam o chão, e
  //     rua atravessando lago é o erro que a chapa mostra de longe. 26 centros de
  //     quarteirão caem dentro de peça, então o corte tem de ser por SEGMENTO e
  //     não por quarteirão inteiro.
  // ⚠️ A PEÇA VIROU RETÂNGULO DE CÉLULAS DA MALHA (29/08) e a máscara tem de
  // saber disso. Quem ainda é elipse são só as duas da casca (Portão e Farol),
  // que vivem além de R_ABOBADA onde não há malha para ancorar.
  // ⚠️ CONVENÇÃO ÚNICA: MUNDO = R(rot) · LOCAL, a mesma do `giro` da malha, logo
  // LOCAL = R(-rot) · MUNDO. O gerador usava o sinal invertido até 29/08 e por
  // isso a reserva de terra e o desenho eram espelhados: a máscara guardava 0
  // lote e a elipse desenhada caía em cima de 174. Medido, consertado, e agora
  // os dois lados usam esta mesma linha.
  const pecas = (meta.programa ?? []).map((p) => {
    const rr = (p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ret: p.forma !== 'elipse',
             ca: Math.cos(rr), sa: Math.sin(rr), rr2: (p.a * p.a + p.b * p.b) }
  })
  // ⚠️ QUANDO A CENA MANDA AS PARCELAS ENCAIXADAS, ELAS MANDAM. O polígono do
  // módulo é o mesmo objeto que define a divisa da parcela, então a rua para
  // exatamente nela: sem lasca, sem rua entrando na peça, sem peça pisando na
  // rua. É a diferença entre "conectar a peça à malha" e a peça NASCER conectada.
  const parcelas = o.parcelas ?? []
  const dentroDoPoly = (px: number, pz: number, poly: [number, number][]) => {
    let d = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j]
      if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) d = !d
    }
    return d
  }
  const emPeca = (px: number, pz: number) => {
    if (parcelas.length) {
      for (const q of parcelas) if (dentroDoPoly(px, pz, q.poly)) return true
      return false
    }
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr2) continue
      const lx = dx * p.ca + dz * p.sa, lz = -dx * p.sa + dz * p.ca
      if (p.ret) { if (Math.abs(lx) <= p.a && Math.abs(lz) <= p.b) return true }
      else if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  // (2) o corredor dos 12 bulevares. Os quarteirões giram com o setor, então na
  //     costura a grade de um setor não casa com a do vizinho e a via de contorno
  //     entraria por baixo do bulevar. Duas faixas coplanares brigam no z-buffer
  //     e a chapa mostra a briga.
  const noBulevar = (px: number, pz: number) => {
    const r = Math.hypot(px, pz)
    if (r < 40) return true
    // ⚠️ OS RADIAIS NÃO SÃO MAIS 12 COSTURAS IGUAIS. São as avenidas publicadas
    // em `bulevares`: quatro do eixo das pontes (rumos 0/90/180/270, 34 m) e seis
    // das costuras de distrito, que têm abertura desigual. Calcular por
    // `s * 360/12` errava o rumo de seis delas.
    for (const b of malha.bulevares) {
      const ang = (b.rumo * Math.PI) / 180
      const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
      if (px * dirX + pz * dirZ <= 0) continue
      const meia = (b.largura ?? K.bulevar) / 2 + 3
      if (Math.abs(px * Math.cos(ang) + pz * Math.sin(ang)) < meia) return true
    }
    return false
  }
  const rMax = (meta.raioBorda ?? 4400) + 10
  // Vão máximo de uma face de via, em metros: ver a nota em faixa(). Depois que
  // o chão passou a ser `superficieAt` o vão deixou de precisar ser curto por
  // causa da flecha (a superfície virou a mesma) e passou a precisar só de não
  // pular uma dobra da grade de 59 m do regolito. 24 m mede zero furo em 4.000
  // sondas e custa 210 mil triângulos a menos que 18.
  const PASSO = 24

  const chao = new Fita()
  // ⚠️ A GUIA VAI NUMA MALHA SÓ DELA, E NÃO É CAPRICHO: ela é a única coisa da
  // rua que PODE lançar sombra. Chão plano lançando sombra em chão plano com o
  // sol a 16 graus é a receita da acne de sombra (o gradiente de profundidade
  // por texel fica enorme na luz rasante, e o texel aqui mede de 0,88 a 3,5 m).
  // Duas malhas com o MESMO material custam 1 chamada de desenho a mais e zero
  // material, que é o recurso escasso desta cena.
  const guia = new Fita()
  let metros = 0

  // ── A PONTE ───────────────────────────────────────────────────────────────
  //
  // ⚠️ FUNDADOR, 31/08: "se qualquer parte dessas pistas cruzar água precisamos
  // de uma ponte AAA+, já vi estrada sendo interrompida por água na chapa".
  //
  // ⚠️ E ELA NÃO ESTAVA INTERROMPIDA, ESTAVA SUBMERSA. A via era assentada em
  // `heightAt`, que sobre a baía devolve o LEITO (até 90 m abaixo da lâmina): a
  // pista continuava lá, desenhada, 50 m debaixo d'água, e o que a chapa mostrava
  // era a lâmina opaca por cima. Diagnóstico diferente, conserto diferente: não
  // era buraco a tapar, era cota a levantar.
  //
  // ⚠️ E O TABULEIRO É `max(terreno, lâmina + gabarito)`, QUE É CONTÍNUO POR
  // CONSTRUÇÃO. A tentação é `if (molhado) sobe`, e aí nasce um degrau na margem
  // que precisa de rampa, e a rampa precisa saber onde a margem está. Com o
  // máximo, o tabuleiro fica nivelado sobre a água e encontra o chão EXATAMENTE
  // onde ele sobe até a mesma cota: a rampa é o próprio terreno, e não existe
  // junta para errar. É a mesma ideia do talude do canal, ao contrário.
  const COTA_AG = o.cotaAgua ?? -40
  const GABARITO = 7                  // altura livre do tabuleiro sobre a lâmina
  const DECK = COTA_AG + GABARITO
  const cotaVia = (x: number, z: number) => Math.max(o.heightAt(x, z), DECK)
  const sobreAgua = (x: number, z: number) => o.heightAt(x, z) < COTA_AG + 0.5

  // ── o gerador de faixa: um eixo, uma seção, o relevo de verdade ───────────
  // A linha t=0 é a BORDA da via, não o eixo: é assim que a seção fica escrita
  // como "de 0 até 2,5 é calçada", que é como um projeto de via se lê.
  // pular(x,z) decide segmento a segmento; quando um segmento cai fora, a seção
  // inteira cai junto, senão a calçada continuaria dentro do lago sem a pista.
  const faixa = (
    ax: number, az: number, bx: number, bz: number,
    perpX: number, perpZ: number, secao: Banda[],
    respeitaBulevar = true,
  ): Trilho => {
    // ⚠️ O PASSO SAI DO COMPRIMENTO, E ISTO FOI MEDIDO, NÃO ESTIMADO. Com 4
    // passos fixos o lado de 168 m virava trechos de 42 m, e uma faixa plana de
    // 42 m passa POR BAIXO da lombada do regolito no meio do vão: sonda de 4.000
    // pontos achou terreno furando a PISTA em 12,7% das amostras, até 1,00 m
    // acima dela, e a calçada em 5,5%. Não adianta subir a cota (a pista tem de
    // ficar abaixo da calçada, que tem de ficar abaixo do plinto de 0,45): o
    // conserto é encurtar a corda, e o erro cai com o QUADRADO do vão.
    const comp = Math.hypot(bx - ax, bz - az)
    const passos = Math.max(2, Math.ceil(comp / PASSO))
    const larg = secao[secao.length - 1].ate
    const meioSec = larg / 2
    const desenhado: boolean[] = new Array(passos).fill(false)
    for (let k = 0; k < passos; k++) {
      const t0 = k / passos, t1 = (k + 1) / passos
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1
      const mx = (x0 + x1) / 2 + perpX * meioSec, mz = (z0 + z1) / 2 + perpZ * meioSec
      if (Math.hypot(mx, mz) > rMax) continue
      // ⚠️ A AVENIDA PARA NA ORLA DA BAÍA. Ver `naBaia` nas opções.
      if (o.naBaia && o.naBaia(mx, mz)) continue
      // ⚠️ A PARCELA NÃO CORTA A AVENIDA. Auditado por raycast em 31/08: 15
      // interrupções nas 12 avenidas, com vãos de até 600 m, todas onde uma
      // parcela do programa cai em cima da via. A rua é a estrutura primária
      // desta cidade e o programa é o que sobra entre ruas — se os dois brigam,
      // quem cede é a parcela. Cortar a avenida quebra a regra que o fundador
      // cobra: "um carro tem que conseguir transitar entre todas as estradas do
      // mapa".
      if (respeitaBulevar && noBulevar(mx, mz)) continue
      desenhado[k] = true
      metros += Math.hypot(x1 - x0, z1 - z0)
      for (let i = 0; i < secao.length; i++) {
        const s = secao[i]
        const pax = x0 + perpX * s.de, paz = z0 + perpZ * s.de
        const pbx = x0 + perpX * s.ate, pbz = z0 + perpZ * s.ate
        const pcx = x1 + perpX * s.ate, pcz = z1 + perpZ * s.ate
        const pdx = x1 + perpX * s.de, pdz = z1 + perpZ * s.de
        chao.add(COR[s.alvo],
          pax, cotaVia(pax, paz) + s.alt, paz,
          pbx, cotaVia(pbx, pbz) + s.alt, pbz,
          pcx, cotaVia(pcx, pcz) + s.alt, pcz,
          pdx, cotaVia(pdx, pdz) + s.alt, pdz,
        )
        // a face vertical do meio-fio, no degrau entre esta banda e a próxima
        const prox = secao[i + 1]
        if (prox && prox.alt !== s.alt) {
          const alto = Math.max(s.alt, prox.alt), baixo = Math.min(s.alt, prox.alt)
          const h0 = cotaVia(pbx, pbz), h1 = cotaVia(pcx, pcz)
          guia.add(COR.meiofio,
            pbx, h0 + baixo, pbz, pbx, h0 + alto, pbz,
            pcx, h1 + alto, pcz, pcx, h1 + baixo, pcz,
          )
        }
        // ⚠️ O PARAPEITO SÓ EXISTE SOBRE A ÁGUA, e é ele que faz a travessia LER
        // como ponte em vez de aterro. 1,1 m, nas duas bordas da seção.
        if ((i === 0 || i === secao.length - 1) && sobreAgua(pax, paz)) {
          const bx2 = i === 0 ? pax : pbx, bz2 = i === 0 ? paz : pbz
          const cx2 = i === 0 ? pdx : pcx, cz2 = i === 0 ? pdz : pcz
          const y0 = cotaVia(bx2, bz2) + s.alt, y1 = cotaVia(cx2, cz2) + s.alt
          guia.add(COR.meiofio,
            bx2, y0, bz2, bx2, y0 + 1.1, bz2,
            cx2, y1 + 1.1, cz2, cx2, y1, cz2,
          )
          // o PILAR, a cada dois passos: desce do tabuleiro até o leito
          if (i === 0 && k % 2 === 0) {
            const fundo = o.heightAt(bx2, bz2)
            const lx = perpX * 2.2, lz = perpZ * 2.2
            guia.add(COR.meiofio,
              bx2 - lx, fundo, bz2 - lz, bx2 - lx, y0, bz2 - lz,
              bx2 + lx, y0, bz2 + lz, bx2 + lx, fundo, bz2 + lz,
            )
          }
        }
      }
    }
    return { ax, az, bx, bz, perpX, perpZ, comp, passos, secao, desenhado }
  }

  // ── a altura EXATA do plano da via, e por que ela não pode ser heightAt ───
  // ⚠️ TODA MARCA PINTADA TEM DE SE APOIAR NO PLANO DO QUAD DA PISTA, NÃO NA
  // SUPERFÍCIE. A pista é uma corda de até 24 m sobre um terreno curvo: um ponto
  // no meio do vão está no plano do quad, não em heightAt, e a diferença chega a
  // dezenas de centímetros. Uma marca posta em heightAt+0,02 some por dentro da
  // pista exatamente onde o vão é mais fundo. Aqui a conta refaz a triangulação
  // do quad (o Fita.add liga a-b-c e a-c-d, ou seja a diagonal é a-c) e devolve
  // o ponto no plano do triângulo certo, com erro zero por construção.
  const pontoVia = (tr: Trilho, s: number, off: number, sobe: number): [number, number, number] => {
    const t = Math.min(1, Math.max(0, s / tr.comp))
    const k = Math.min(tr.passos - 1, Math.max(0, Math.floor(t * tr.passos)))
    const u = t * tr.passos - k
    let banda = tr.secao[0]
    for (const b of tr.secao) if (off >= b.de && off <= b.ate) { banda = b; break }
    const v = (off - banda.de) / (banda.ate - banda.de)
    const t0 = k / tr.passos, t1 = (k + 1) / tr.passos
    const px0 = tr.ax + (tr.bx - tr.ax) * t0, pz0 = tr.az + (tr.bz - tr.az) * t0
    const px1 = tr.ax + (tr.bx - tr.ax) * t1, pz1 = tr.az + (tr.bz - tr.az) * t1
    const hA = o.heightAt(px0 + tr.perpX * banda.de, pz0 + tr.perpZ * banda.de)
    const hB = o.heightAt(px0 + tr.perpX * banda.ate, pz0 + tr.perpZ * banda.ate)
    const hC = o.heightAt(px1 + tr.perpX * banda.ate, pz1 + tr.perpZ * banda.ate)
    const hD = o.heightAt(px1 + tr.perpX * banda.de, pz1 + tr.perpZ * banda.de)
    // baricêntrica no quadrado unitário: a=(0,0) b=(0,1) c=(1,1) d=(1,0)
    const h = v >= u
      ? hA * (1 - v) + hB * (v - u) + hC * u
      : hA * (1 - u) + hC * v + hD * (u - v)
    const px = tr.ax + (tr.bx - tr.ax) * t + tr.perpX * off
    const pz = tr.az + (tr.bz - tr.az) * t + tr.perpZ * off
    return [px, h + banda.alt + sobe, pz]
  }
  /** true se o segmento que contém este ponto do trilho foi realmente desenhado */
  const trechoVivo = (tr: Trilho, s: number) => {
    const t = Math.min(1, Math.max(0, s / tr.comp))
    const k = Math.min(tr.passos - 1, Math.max(0, Math.floor(t * tr.passos)))
    return tr.desenhado[k]
  }
  /** um retângulo deitado na via, em (metro ao longo, metro através) */
  const retangulo = (fita: Fita, cor: THREE.Color, tr: Trilho,
                     s0: number, s1: number, o0: number, o1: number, sobe: number) => {
    const a = pontoVia(tr, s0, o0, sobe)
    const b = pontoVia(tr, s0, o1, sobe)
    const c = pontoVia(tr, s1, o1, sobe)
    const d = pontoVia(tr, s1, o0, sobe)
    fita.add(cor, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2])
  }

  // ── 1. O DESENHO POR QUARTEIRÃO SAIU INTEIRO ──────────────────────────────
  //
  // ⚠️ ERA O ÚLTIMO RESTO DA ARQUITETURA ANTIGA, e ele explica o que o fundador
  // viu em 31/08: "temos radiais sem a menor conexão, algumas formam quarteirões
  // absolutamente pequenos". Este bloco desenhava, POR QUARTEIRÃO da grade do
  // GERADOR, a meia-seção de contorno nos quatro lados mais duas travessas
  // internas. Ele já não tinha dono desde que a teia passou a ser desenhada dos
  // 26 anéis e dos radiais: as duas grades não coincidem, então cada travessa
  // dele virava um traço solto por cima da teia, e cada meia-seção virava uma
  // rua de 6 m encostada em nada.
  //
  // A regra que ficou vale para a cidade inteira: A RUA VEM DA TEIA, e mais nada
  // desenha rua. Quem quiser rua nova acrescenta anel ou radial em `teia.ts`.
  //
  // ⚠️ A TRAVESSIA ELEVADA foi junto, e por consequência: ela era cotada contra a
  // boca da travessa deste bloco. Quando a teia tiver faixa de pedestre, ela
  // nasce do cruzamento anel × radial, que é um lugar que existe.
  let nq = malha.quarteiroes.length
  let travessias = 0

  // ── 1c. A TEIA FINA SAIU. FICAM SÓ AS VIAS PRINCIPAIS ─────────────────────
  //
  // ⚠️ DECISÃO DO FUNDADOR, 31/08: "milhares de ruas estreitas sem a menor
  // conexão. Criemos algo macro que funcione, depois escalamos. Já sabemos que
  // todas as carteiras cabem aí dentro com folga. Vamos criar apenas as vias
  // principais, em nível AAA+."
  //
  // ⚠️ E A DECISÃO É BOA, PORQUE A VIA PRINCIPAL JÁ ESTAVA PRONTA E BEM FEITA. A
  // cidade tem, desenhados nas seções 2 e 2b com marcação de eixo, canteiro,
  // meio-fio e ROTATÓRIA em cada cruzamento:
  //     7 anéis viários   (Interior 1.750 · Médio 2.750 · Exterior 3.750 ·
  //                        Cinturão 4.450 · Doca 5.620 · Escoamento 6.300 ·
  //                        Serviço 7.600), de 26 a 34 m
  //     9 bulevares       (34 a 44 m, com canteiro central), r 1.420 a 6.900
  //     63 cruzamentos, todos com rotatória
  // Isso é a estrutura macro de uma cidade de 14 km, e é AAA porque cada peça
  // dela tem seção cotada, não porque tem muita linha.
  //
  // ⚠️ O QUE SAIU E POR QUÊ: a teia de 27 anéis × 168 radiais. Ela nasceu para
  // fechar o X em todo cruzamento e chegou lá, mas a densidade estava errada para
  // o momento: rua de 12 m a cada 108 m em 156 km² dá dezenas de milhares de
  // trechos, e qualquer defeito de um deles vira "milhares de ruas sem conexão"
  // na chapa. Cidade se desenha do macro para o micro; a teia fina volta quando o
  // lote voltar, e aí ela nasce DENTRO do quarteirão que as vias principais já
  // delimitaram, não competindo com elas.
  //
  // O que fica registrado para quando ela voltar (`teia.ts` continua no
  // repositório, com os números medidos):
  //   · o anel é POLÍGONO, não círculo — a teia tem arestas retas;
  //   · o radial nasce EM CIMA de um anel, nunca num raio redondo (nascer 56 m
  //     fora do anel foi o que criou radial sem conexão e quarteirão de 56 m);
  //   · subdividir é preciso, mas a interpolação é CARTESIANA, senão a corda
  //     volta a virar arco.

  // ── 1b. A VIA EM VOLTA DA PRAÇA DE QUARTO FOI REMOVIDA ────────────────────
  // ⚠️ NÃO É PODA, É CONSEQUÊNCIA. A praça de quarto era a célula central de cada
  // quarto 3x3, que nunca recebia lote: um buraco a cada 540 m em fileira
  // perfeita, que na planta lia como poá e foi o que o fundador chamou de
  // carimbado. O verde agora é `parques`, poucos e escolhidos, e quem desenha é
  // pracas.ts. Sem quarto não há anel de quarto.

  // ── 2. os 12 bulevares de costura, e só eles ganham marcação ──────────────
  // ⚠️ ELES SAEM DE tecido.ts E PASSAM A MORAR AQUI. Lá a pista era desenhada
  // ACIMA do meio-fio (pista em +0,45 e guia em +0,30), ou seja a seção estava de
  // cabeça para baixo e a via ficava um planalto claro com moldura escura. Se os
  // dois módulos desenharem bulevar ao mesmo tempo as faixas brigam no z-buffer.
  const marcas: { fita: Fita; centro: THREE.Vector3 }[] = []
  let eixos = 0, faixasPed = 0
  for (const b of malha.bulevares) {
    const ang = (b.rumo * Math.PI) / 180
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
    const larg = b.largura ?? K.bulevar
    const esc = larg / SEC_BULEVAR[SEC_BULEVAR.length - 1].ate
    const secao = esc === 1 ? SEC_BULEVAR : SEC_BULEVAR.map((s) => ({ ...s, de: s.de * esc, ate: s.ate * esc }))
    // a linha t=0 é a borda esquerda: recua meia largura do eixo
    const tr = faixa(b.x0 - perpX * larg / 2, b.z0 - perpZ * larg / 2,
                     b.x1 - perpX * larg / 2, b.z1 - perpZ * larg / 2,
                     perpX, perpZ, secao, false)

    const fita = new Fita()
    // as duas pistas do bulevar: bandas 1 e 3 da seção
    const pistas = [secao[1], secao[3]]

    // ── faixa de pedestre: só onde o bulevar cruza um contorno de QUARTO ────
    // ⚠️ MARCAÇÃO VIÁRIA É PRIVILÉGIO DO BULEVAR. Pintar eixo ou faixa em via
    // local de 7 m dá a ela a linguagem de arterial e apaga a hierarquia
    // bulevar > contorno > travessa que a malha construiu.
    // Os cruzamentos saem dos DADOS, não de um passo inventado: cada quarto tem
    // 540 m de lado, então a divisa dele cruza a costura a 270 m do centro
    // projetado no eixo do bulevar. Os dois setores vizinhos têm grades giradas
    // (7,5 graus por setor), então as duas famílias de divisa não coincidem e é
    // por isso que sai cerca de uma faixa a cada 250 m e não a cada 540.
    // ⚠️ A TRAVESSIA VINHA DOS QUARTOS, QUE NÃO EXISTEM MAIS. Ela nasce onde uma
    // rua do tecido encosta na avenida, e quem sabe disso agora é o QUARTEIRÃO:
    // cada bloco vizinho da avenida projeta a sua divisa sobre o eixo dela. O
    // passo deixa de ser fixo em 270 m e passa a ser meio quarteirão, que muda
    // por banda, então a travessia aparece onde a rua de fato chega.
    const cruz: number[] = []
    for (const q of malha.quarteiroes) {
      const off = q.x * perpX + q.z * perpZ
      if (Math.abs(off) > q.lado + 60) continue
      const ao = q.x * dirX + q.z * dirZ
      const meio = q.lado / 2 + 6
      for (const r of [ao - meio, ao + meio]) {
        if (r < b.rInicio + 80 || r > b.rFim - 80) continue
        if (cruz.some((c) => Math.abs(c - r) < 70)) continue
        cruz.push(r)
      }
    }
    cruz.sort((x, y) => x - y)
    for (const r of cruz) {
      const s = r - b.rInicio
      if (!trechoVivo(tr, s)) continue
      const span = FAIXA_BARRAS * FAIXA_LARG + (FAIXA_BARRAS - 1) * FAIXA_VAO
      for (const p of pistas) {
        for (let i = 0; i < FAIXA_BARRAS; i++) {
          const s0 = s - span / 2 + i * (FAIXA_LARG + FAIXA_VAO)
          retangulo(fita, COR.marca, tr, s0, s0 + FAIXA_LARG, p.de + 0.05, p.ate - 0.05, FOLGA)
        }
      }
      faixasPed++
    }

    // ── eixo tracejado, um por pista ────────────────────────────────────────
    // ⚠️ AQUI EU DESVIEI DA SPEC E O MOTIVO É FÍSICO. A spec 3.6 pede o eixo
    // "sobre o eixo do canteiro" mas na cota Y_PISTA + 0,02 e na razão de
    // contraste marca/PISTA: as três coisas não cabem juntas, porque o eixo do
    // canteiro é terra a 0,40 e uma linha a 0,20 nasceria enterrada nele. Linha
    // tracejada é divisória de faixa e mora no asfalto, então ela vai no meio de
    // cada uma das duas pistas de 10 m, que é exatamente a broken lane line do
    // MUTCD. Custa 12.384 triângulos em vez dos 6.200 previstos, o que é ruído
    // perto do saldo de -790 mil da rodada.
    const periodo = EIXO_MARCA + EIXO_VAO
    for (const p of pistas) {
      const centroPista = (p.de + p.ate) / 2
      for (let s = 0; s + EIXO_MARCA < tr.comp; s += periodo) {
        if (!trechoVivo(tr, s + EIXO_MARCA / 2)) continue
        // nunca em cima de uma faixa de pedestre: paint sobre paint é borrão
        if (cruz.some((c) => Math.abs(c - b.rInicio - (s + EIXO_MARCA / 2)) < 9)) continue
        retangulo(fita, COR.marca, tr, s, s + EIXO_MARCA,
                  centroPista - EIXO_LARG / 2, centroPista + EIXO_LARG / 2, FOLGA)
        eixos++
      }
    }
    if (!fita.vazia) {
      const mx = (tr.ax + tr.bx) / 2 + perpX * larg / 2
      const mz = (tr.az + tr.bz) / 2 + perpZ * larg / 2
      marcas.push({ fita, centro: new THREE.Vector3(mx, o.heightAt(mx, mz), mz) })
    }
  }

  // ── 2b. OS ANÉIS: POLÍGONO QUE LIGA AS ROTATÓRIAS EM RETA ────────────────
  //
  // ⚠️ FUNDADOR, 31/08: "ligue os cruzamentos em linha reta, sem arcos curvos,
  // teia é em linha reta". O anel deixa de ser um círculo amostrado em 96 passos
  // e passa a ser um POLÍGONO cujos vértices incluem, obrigatoriamente, os 9
  // cruzamentos com os bulevares. Entre duas rotatórias a via é uma reta.
  //
  // ⚠️ UM VÉRTICE POR ROTATÓRIA, E MAIS NADA. A primeira tentativa subdividiu
  // cada vão até a flecha da corda ficar abaixo de 8 m, e o resultado é que o
  // anel voltou a parecer círculo — o fundador viu na hora: "não mostra polígonos
  // não, você tá viajando, eu ainda vejo as avenidas todas em curva". Ele tem
  // razão: uma flecha invisível é, por definição, um círculo. Se a teia é em reta,
  // a reta tem de APARECER.
  //
  // Com as 12 avenidas a 30°, cada anel é um DODECÁGONO REGULAR. A flecha vai de
  // 60 m no Anel Interior a 259 m na Pista de Serviço: bem visível, que é o
  // ponto. O raio do anel passa a ser o do VÉRTICE, e o meio da aresta fica
  // cos(15°) = 96,6% dele.
  const _bulRumos = (malha.bulevares ?? []).map((b: Bulevar) => b.rumo)
    .sort((x: number, y: number) => x - y)
  /** os vértices do polígono de um anel: exatamente as rotatórias */
  const verticesDoAnel = (_raio: number): number[] => {
    const base = _bulRumos.length ? _bulRumos : [0, 90, 180, 270]
    return base.map((g) => (g * Math.PI) / 180)
  }
  // ⚠️ O ANEL PARA NA BOCA DA ROTATÓRIA. Sem isso a faixa dele passaria por cima
  // da faixa do bulevar, duas superfícies coplanares no mesmo Y, e o z-buffer
  // decide por pixel: aparece listra piscando exatamente no cruzamento, que é
  // onde o olho vai.
  let nAneis = 0, nRot = 0
  for (const an of meta.aneis ?? []) {
    const esc = an.larg / SEC_ANEL[SEC_ANEL.length - 1].ate
    const secao = esc === 1 ? SEC_ANEL : SEC_ANEL.map((b) => ({ ...b, de: b.de * esc, ate: b.ate * esc }))
    const r0 = an.r - an.larg / 2
    const verts = verticesDoAnel(an.r)
    const passos = verts.length
    let desenhou = false
    // ⚠️ CADA LADO SE SUBDIVIDE, E ISSO CONSERTA DOIS DEFEITOS DE UMA VEZ.
    //
    // O fundador, 31/08: "estrada faltando a sudeste... o mapa deve estar cheio
    // desses buracos ainda. Um carro tem que conseguir transitar entre todas as
    // estradas do mapa". Auditado por raycast: 14 lados de anel simplesmente NÃO
    // EXISTIAM, com vãos de até 3.240 m.
    //
    // A causa: o lado do polígono era UM QUAD de até 3.900 m e a máscara testava
    // só o PONTO MÉDIO dele. Uma parcela caindo no meio matava a avenida inteira
    // entre duas rotatórias. Teste pontual em geometria longa é sempre isso.
    //
    // E o segundo defeito era o mesmo quad: 3.900 m de corda sobre terreno que
    // ondula 25 m fica ora boiando ora enterrado no meio do vão.
    //
    // ⚠️ A SUBDIVISÃO É CARTESIANA, entre as duas pontas da corda — interpolar o
    // ÂNGULO devolveria a curva que a teia acabou de perder.
    for (let k = 0; k < passos; k++) {
      const a0 = verts[k], a1 = verts[(k + 1) % passos] + (k + 1 === passos ? Math.PI * 2 : 0)
      const am = (a0 + a1) / 2
      const mx = Math.sin(am) * an.r, mz = -Math.cos(am) * an.r
      // ⚠️ A PARCELA NÃO CORTA VIA PRINCIPAL. A rua é a estrutura primária desta
      // cidade e o programa é o que sobra entre ruas: se uma parcela cai em cima
      // de uma avenida, quem cede é a parcela. Cortar a avenida quebra a regra
      // que o fundador cobra, que é poder dirigir de qualquer ponto a qualquer
      // ponto. `emPeca` continua valendo para o que não é via principal.
      void mx; void mz
      // a boca da rotatória: o anel para antes de entrar no bulevar
      let naBoca = false
      for (let b = 0; b < 12; b++) {
        const d = Math.abs(((am * 180) / Math.PI - b * 30 + 180) % 360 - 180)
        if ((d * Math.PI) / 180 * an.r < ROT_RAIO + 6) { naBoca = true; break }
      }
      if (naBoca) continue
      desenhou = true
      metros += an.r * (a1 - a0)
      const pt = (rr: number, aa: number) => [Math.sin(aa) * rr, -Math.cos(aa) * rr] as const
      const NSUB = Math.max(1, Math.round((2 * an.r * Math.sin((a1 - a0) / 2)) / PASSO))
      for (let i = 0; i < secao.length; i++) {
        const b = secao[i]
        const ra = r0 + b.de, rb = r0 + b.ate
        // ⚠️ ORDEM ANTI-HORÁRIA VISTA DE CIMA: ângulo primeiro, raio depois. A
        // ordem natural de escrever (raio, depois ângulo) dá normal para BAIXO e
        // o backface culling apaga o anel inteiro. Medido: com a ordem errada a
        // sonda vertical achava anel em 8 de 72 pontos, ou seja praticamente só
        // as rotatórias. É a MESMA armadilha de pracas.ts:98.
        // as quatro pontas da corda, nos dois raios da banda
        const [A0x, A0z] = pt(ra, a0), [A1x, A1z] = pt(ra, a1)
        const [B0x, B0z] = pt(rb, a0), [B1x, B1z] = pt(rb, a1)
        for (let t = 0; t < NSUB; t++) {
          const u0 = t / NSUB, u1 = (t + 1) / NSUB
          const ax = A0x + (A1x - A0x) * u0, az = A0z + (A1z - A0z) * u0
          const dx = A0x + (A1x - A0x) * u1, dz = A0z + (A1z - A0z) * u1
          const cx = B0x + (B1x - B0x) * u1, cz = B0z + (B1z - B0z) * u1
          const bx = B0x + (B1x - B0x) * u0, bz = B0z + (B1z - B0z) * u0
          // ⚠️ O ANEL PARA NA ORLA DA BAÍA, pelo mesmo motivo da avenida. O teste
          // é por SUBTRECHO, não pelo lado inteiro: um lado do dodecágono tem até
          // 3.900 m e pode entrar na baía por 300 m — matar o lado todo devolveria
          // o buraco de 3 km que a auditoria acabou de fechar.
          if (o.naBaia && o.naBaia((ax + cx) / 2, (az + cz) / 2)) continue
          // ⚠️ ORDEM ANTI-HORÁRIA VISTA DE CIMA: ângulo primeiro, raio depois. A
          // ordem natural de escrever (raio, depois ângulo) dá normal para BAIXO
          // e o backface culling apaga o anel inteiro. Mesma armadilha de
          // pracas.ts:98.
          chao.add(COR[b.alvo],
            // ⚠️ `cotaVia`, NÃO `heightAt`: sobre a baía o anel viria assentado
            // no LEITO, 50 m debaixo da lâmina. Ver a nota da ponte lá em cima.
            ax, cotaVia(ax, az) + b.alt, az,
            dx, cotaVia(dx, dz) + b.alt, dz,
            cx, cotaVia(cx, cz) + b.alt, cz,
            bx, cotaVia(bx, bz) + b.alt, bz)
          const prox = secao[i + 1]
          if (prox && prox.alt !== b.alt) {
            const alto = Math.max(b.alt, prox.alt), baixo = Math.min(b.alt, prox.alt)
            const h0 = cotaVia(bx, bz), h1 = cotaVia(cx, cz)
            guia.add(COR.meiofio, bx, h0 + baixo, bz, bx, h0 + alto, bz,
                     cx, h1 + alto, cz, cx, h1 + baixo, cz)
          }
        }
      }
    }
    if (desenhou) nAneis++
    // as 12 rotatórias deste anel
    for (let b = 0; b < 12; b++) {
      const ang = (b * 30 * Math.PI) / 180
      const cx = Math.sin(ang) * an.r, cz = -Math.cos(ang) * an.r
      // ⚠️ A ROTATÓRIA DO CINTURÃO FICA ALÉM DE rMax DE PROPÓSITO: a Avenida do
      // Cinturão mora em 4.450, fora do tecido, e é lá que os doze bulevares
      // terminam. Cortar por rMax deixaria a avenida sem nenhuma entrada.
      if (emPeca(cx, cz) || Math.hypot(cx, cz) > 4520) continue
      nRot++
      const N = 48
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2
        for (const [ra, rb, alt, alvo] of [
          [ROT_ILHA, ROT_RAIO, Y_PISTA, 'pista'],
          [0, ROT_ILHA, Y_CANTEIRO, 'canteiro'],
        ] as [number, number, number, Alvo][]) {
          const P = (rr: number, aa: number) => [cx + Math.sin(aa) * rr, cz - Math.cos(aa) * rr] as const
          const [ax, az] = P(ra, a0), [dx2, dz2] = P(ra, a1)
          const [cx2, cz2] = P(rb, a1), [bx2, bz2] = P(rb, a0)
          chao.add(COR[alvo],
            ax, o.heightAt(ax, az) + alt, az,
            dx2, o.heightAt(dx2, dz2) + alt, dz2,
            cx2, o.heightAt(cx2, cz2) + alt, cz2,
            bx2, o.heightAt(bx2, bz2) + alt, bz2)
        }
      }
    }
  }

  // ── 3. UMA malha, UM material, cor por vértice ────────────────────────────
  // ⚠️ ANTES ERAM 4 MATERIAIS E 4 CHAMADAS. O limite real desta cena não é
  // triângulo nem chamada de desenho (373 numa GTX 1650 é folga), é MATERIAL e
  // PROGRAMA: a vista de topo compila 228 programas e o teto da rodada é 235.
  // Com cor por vértice, acrescentar cor à rua (a marca branca, por exemplo)
  // passou a custar zero material.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0,
  })
  mat.name = 'via'
  const feitas: THREE.Mesh[] = []
  const piso = chao.malha(mat, 'via:chao')
  piso.receiveShadow = true
  piso.castShadow = false
  piso.frustumCulled = false
  group.add(piso)
  feitas.push(piso)

  // ⚠️ A SOMBRA DA RUA É A FACE DO MEIO-FIO, e ela é o único relevo que a seção
  // tem. Com plaza-scene.tsx em normalBias 1,2 (o valor antigo) ela não aparece:
  // medido, 1,2 apaga 97% da sombra de um degrau desta ordem. Quem for conferir
  // o relevo tem de estar com o normalBias 0,15 da spec 6.2.
  if (!guia.vazia) {
    const gm = guia.malha(mat, 'via:guia')
    gm.receiveShadow = true
    gm.castShadow = o.sombra ?? true
    gm.frustumCulled = false
    group.add(gm)
    feitas.push(gm)
  }

  const marcaMeshes: THREE.Mesh[] = []
  for (let i = 0; i < marcas.length; i++) {
    const m = marcas[i].fita.malha(mat, `via:marca:${malha.bulevares[i]?.id ?? i}`)
    m.receiveShadow = true          // mesmo material e mesma permutação de programa do piso
    m.castShadow = false            // 2 cm de tinta não lançam sombra
    m.frustumCulled = true
    group.add(m)
    marcaMeshes.push(m)
    feitas.push(m)
    o.culler?.add(m, MARCA_CULL, marcas[i].centro)
  }

  const triangulos = chao.triangulos + guia.triangulos + marcas.reduce((s, m) => s + m.fita.triangulos, 0)

  return {
    group,
    quarteiroes: nq,
    aneis: nAneis,
    rotatorias: nRot,
    pracas: 0,   // ⚠️ a praça de quarto acabou; o verde é `parques`, em pracas.ts
    bulevares: malha.bulevares.length,
    travessias,
    eixos,
    faixas: faixasPed,
    triangulos,
    metrosDeVia: Math.round(metros),
    update(cam: THREE.Vector3) {
      for (let i = 0; i < marcaMeshes.length; i++) {
        const on = cam.distanceTo(marcas[i].centro) < MARCA_CULL
        if (marcaMeshes[i].visible !== on) marcaMeshes[i].visible = on
      }
    },
    dispose() {
      for (const m of feitas) m.geometry.dispose()
      mat.dispose()
      group.clear()
    },
  }
}
