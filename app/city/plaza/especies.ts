// ═══════════════════════════════════════════════════════════════════════════
// AS ESPÉCIES: a biblioteca de árvore da DogCity, separada de quem PLANTA.
//
// ⚠️ O QUE O FUNDADOR VIU EM 02/09 ("ainda temos muitas árvores genéricas") NÃO
// É FALTA DE TRIÂNGULO, É FALTA DE SILHUETA. Contado no código antes desta
// mudança: 3 geometrias de perto, e DUAS DELAS eram a mesma massa lobada com
// parâmetro diferente (`copaLobada(11, 2.45, 4.9, 0.88, 0.40)` para a esfera e
// `copaLobada(23, 2.95, 5.75, 0.60, 0.64)` para a copada). De pé, na calçada, a
// diferença entre as duas é de 12% de achatamento: o olho lê UMA espécie. Somando
// o anel, que era 100% cone, a cidade tinha na prática duas leituras.
//
// ⚠️ ESPÉCIE NOVA = CHAMADA DE DESENHO NOVA, E A CENA NÃO TEM FOLGA (382
// chamadas, 4,91 M triângulos). Um `InstancedMesh` desenha UMA geometria: não
// existe espécie nova de graça. O que pagou a quarta espécie foi FUNDIR OS DOIS
// BALDES DE LONGE. `cruzEsfera` e `cruzCone` desenhavam o MESMO octaedro de 8
// triângulos com proporções diferentes (7,0 × 4,8 e 11,0 × 4,6), e proporção sai
// da matriz de instância: a copada já provava isso desde 01/09, entrando no
// balde da esfera com 1,32 em xz e 0,94 em y. Um balde de longe só, com um fator
// por espécie, devolveu a chamada que a colunar gastou. Total antes 6, depois 6.
//
// ⚠️ E POR ISSO A QUINTA ESPÉCIE NÃO ENTROU. O jeito de ter mais silhueta sem
// mais chamada seria empacotar K formas numa geometria só e colapsar as não
// escolhidas no vértice, por atributo de instância. Isso multiplica o trabalho
// de VÉRTICE por K nos baldes de perto (5.200 instâncias × 92 triângulos × K) e
// eu NÃO MEDI o custo disso nesta cena. Ficou de fora com o motivo escrito.
//
// O que cada espécie carrega: geometria de perto, proporção no balde de longe,
// faixa de porte, arquétipos de escala não uniforme, tombo do fuste e a sua
// PRÓPRIA faixa de tinte. Quem planta escolhe por CONTEXTO, não por sorteio.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
//
// ⚠️ 03/09: A FRENTE PAISAGISMO. O projeto inteiro está escrito em
// `paisagismo.md`, antes do código, porque é assim que um paisagista de
// verdade trabalha: paleta por hierarquia viária primeiro, código depois. A
// bandeira é `?verde=1` (padrão do bot de auto-commit: sem ela, nada muda;
// ver `look.ts` para o mesmo raciocínio). Ela mora aqui e não em
// `arborizacao.ts` porque `props-table.ts` também precisa dela para os dois
// jardins temáticos, e um valor lido duas vezes de `window.location.search`
// é bug esperando para nascer no dia em que alguém trocar o nome do parâmetro
// num lugar só.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

/** true quando `?verde=1` está na URL. Lido uma vez, no módulo, como `look2`
 *  de `look.ts`: trocar de bandeira pede recarregar a página. */
export const verde: boolean = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('verde') === '1'

// ── as cores base, que o tinte por instância MULTIPLICA ───────────────────
export const COR_TRONCO = new THREE.Color('#6E685C')
export const COR_COPA = new THREE.Color('#7E8A6B')
/** ⚠️ A TERRA BATIDA DO PÉ É O ÚNICO CONTATO QUE A ÁRVORE TEM COM O CHÃO. Ela é
 *  escura de propósito: contra regolito #9B958C dá 2,4:1, que é o valor de uma
 *  oclusão de contato, não de uma mancha desenhada. */
export const COR_TERRA = new THREE.Color('#4A4238')
/** ⚠️ O ARBUSTO É MAIS ESCURO QUE A COPA DE PROPÓSITO. Sub-bosque real vive na
 *  sombra da árvore e nunca lê mais claro que ela; arbusto no mesmo valor da copa
 *  some dentro dela e o canteiro não aparece. #63704F contra copa #7E8A6B dá uma
 *  diferença de luminância de 17%, que é o que separa as duas massas na rasante. */
export const COR_ARBUSTO = new THREE.Color('#63704F')

/**
 * ⚠️ 03/09, PRIMEIRA ORDEM DE `paisagismo.md`: ISTO É O "SAGE CHAPADO" QUE A
 * CHAPA DE 1,7 M DENUNCIA. Antes desta nota, esfera e guarda-chuva dividiam o
 * MESMO pigmento (`COR_COPA`, #7E8A6B) e conífera/colunar eram só duas
 * variações de VALOR da mesma família de verde acinzentado (mesmo matiz,
 * luminância diferente). E o tinte por instância (`tintarMuda`, abaixo) só
 * inclina a cor toda do objeto (tronco, torrão e copa juntos) como se fosse
 * a luz do lugar, não redefine a família de matiz da copa: rodar o tinte não
 * resolve espécie plantada na mesma família de verde.
 *
 * ⚠️ NÃO BASTA VARIAR POR MUDA, tem que variar por ESPÉCIE. Quatro silhuetas
 * com quatro tons do mesmo verde continuam lendo como UM plantio de longe,
 * que é a distância em que a silhueta já não resolve nada (a mesma lição que
 * `tintarMuda` já registrava para o tinte, agora aplicada ao pigmento).
 *
 * Atrás de `?verde=1`: cada silhueta ganha pigmento de FAMÍLIA própria, não
 * só de valor. Sem a bandeira, os quatro pigmentos originais continuam byte
 * a byte iguais (regra 5, nada muda sem ela).
 *
 *   esfera (Alameda)      verde-folha comum, a mais neutra das quatro
 *   copada (Guarda-chuva) oliva PRATEADA (a nota antiga já dizia "oliva
 *                         seca de praça ensolarada" mas usava o MESMO
 *                         pigmento da esfera; agora tem o dela)
 *   cone (Conífera)       azul-esverdeado escuro de agulha, mais frio e
 *                         mais saturado, não só mais escuro
 *   colunar (Colunar)     quase preto-verde de cipreste, a mais saturada
 *                         e a mais escura das quatro
 */
const COR_COPA_GC = new THREE.Color(verde ? '#A69A5E' : '#7E8A6B')
/** a conífera é a mais fria e a mais saturada das quatro: é ela que faz a
 *  encosta ler como mata e não como parque */
const COR_CONIF = new THREE.Color(verde ? '#3E5A52' : '#66765C')
/** a colunar é escura e seca, de cipreste, para o risco vertical aparecer
 *  contra a copa arredondada da vizinha */
const COR_COLUNAR = new THREE.Color(verde ? '#3C4632' : '#5F6B52')
/** o tronco alto e limpo da guarda-chuva é mais claro: é ele que se vê */
const COR_TRONCO_CLARO = new THREE.Color('#877F6F')

// ── ruído determinístico: a cidade é a mesma em toda visita ────────────────
export function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * RUÍDO DE MUNDO, para a cor e a espécie terem PARENTESCO.
 *
 * ⚠️ VARIAÇÃO SÓ ALEATÓRIA DÁ CONFETE: cada árvore de uma alameda de uma espécie
 * e de uma cor, que lê como ruído de televisão, não como arborização. Uma alameda
 * de verdade é plantada de uma vez, com mudas do mesmo viveiro, e tem parentesco;
 * é o BAIRRO seguinte que muda. Por isso tudo o que varia aqui sai de dois
 * termos: um ruído de mundo (vizinhos parecidos) e um hash da muda (nenhuma
 * idêntica à outra).
 */
export function ruidoMundo(x: number, z: number, escala: number): number {
  const xi = Math.floor(x / escala), zi = Math.floor(z / escala)
  const fx = x / escala - xi, fz = z / escala - zi
  const h = (a: number, b: number) => hash01((((a & 1023) * 1013904223 + (b & 1023) * 1664525) >>> 0))
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const a = h(xi, zi), b = h(xi + 1, zi)
  const c = h(xi, zi + 1), d = h(xi + 1, zi + 1)
  const t0 = a + (b - a) * sx, t1 = c + (d - c) * sx
  return t0 + (t1 - t0) * sz
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVAS DE GEOMETRIA
// ═══════════════════════════════════════════════════════════════════════════

/** pinta uma geometria inteira de uma cor só, como atributo */
export function pintar(g: THREE.BufferGeometry, cor: THREE.Color) {
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { c[i * 3] = cor.r; c[i * 3 + 1] = cor.g; c[i * 3 + 2] = cor.b }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

/** um tubo de revolução por perfil [altura, raio], aberto nas duas pontas */
export function tubo(perfil: [number, number][], lados: number, cor: THREE.Color): THREE.BufferGeometry {
  const vs: number[] = [], ix: number[] = []
  for (const [y, r] of perfil) {
    for (let k = 0; k < lados; k++) {
      const a = (k / lados) * Math.PI * 2
      vs.push(Math.cos(a) * r, y, Math.sin(a) * r)
    }
  }
  for (let s = 0; s < perfil.length - 1; s++) {
    for (let k = 0; k < lados; k++) {
      const k2 = (k + 1) % lados
      const a = s * lados + k, b = s * lados + k2
      const c = (s + 1) * lados + k, d = (s + 1) * lados + k2
      ix.push(a, c, d, a, d, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return pintar(g, cor)
}

/**
 * O LÓBULO DE FOLHA: um icosaedro com o raio empurrado por vértice e a normal
 * trocada pela direção do centro. 20 triângulos.
 *
 * ⚠️ É ISTO QUE TIRA A COPA DE "FORMA PRIMITIVA", e o motivo é que a leitura de
 * esfera não vem do número de faces, vem de duas coisas que um icosaedro tem e
 * uma massa de folha não: SILHUETA REGULAR e NORMAL FACETADA.
 *
 * ⚠️ E O RUÍDO É POR POSIÇÃO, NÃO POR ÍNDICE, senão a copa RACHA. A
 * `IcosahedronGeometry` do three não é indexada: o mesmo canto aparece em 5 faces
 * com índices diferentes, e ruído por índice abriria fenda em todos eles.
 */
export function lobo(
  r: number, cx: number, cy: number, cz: number,
  achata: number, semente: number, cor: THREE.Color,
): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 0)
  const p = g.attributes.position as THREE.BufferAttribute
  const nrm = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const qx = Math.round(x * 1000), qy = Math.round(y * 1000), qz = Math.round(z * 1000)
    const chave = ((Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) >>> 0)
    const k = 0.74 + hash01(chave + semente) * 0.52
    const nx = x * k, ny = y * k * achata, nz = z * k
    p.setXYZ(i, nx, ny, nz)
    const L = Math.hypot(nx, ny, nz) || 1
    nrm[i * 3] = nx / L; nrm[i * 3 + 1] = ny / L; nrm[i * 3 + 2] = nz / L
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.translate(cx, cy, cz)
  return pintar(g, cor)
}

/**
 * A MASSA DE FOLHA: três lóbulos que se cruzam, 60 triângulos.
 *
 * ⚠️ TRÊS, E NÃO UM MAIOR. Um lóbulo só continua tendo contorno CONVEXO, e é a
 * convexidade que faz o olho dizer "bola". A cintura entre dois lóbulos é o único
 * jeito barato de produzir contorno côncavo, que é o que toda copa tem.
 */
export function copaLobada(
  semente: number, raio: number, y: number, achata: number, espalha: number,
  cor: THREE.Color = COR_COPA,
): THREE.BufferGeometry[] {
  const gs: THREE.BufferGeometry[] = []
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + hash01(semente * 17 + k) * 1.1
    const rr = raio * (0.72 + hash01(semente * 3 + k) * 0.30)
    gs.push(lobo(
      rr,
      Math.cos(a) * raio * espalha,
      y + (hash01(semente * 5 + k) - 0.45) * raio * 0.50,
      Math.sin(a) * raio * espalha,
      achata, semente * 31 + k + 1, cor,
    ))
  }
  return gs
}

/**
 * O PÉ: fuste alargado na base mais um torrão de terra batida. 32 triângulos.
 *
 * ⚠️ ISTO VALE MAIS QUE QUALQUER DETALHE DE COPA. Um cilindro de raio constante
 * encosta no chão com emenda dura e o olho lê a árvore FLUTUANDO. O fuste abre
 * de 0,18 m no topo para 0,62 m no pé, e o torrão de 1,05 m faz o papel do decal
 * de oclusão.
 *
 * ⚠️ TORRÃO É VOLUME, NÃO DECAL, E POR ISSO NÃO BRIGA COM O Z-BUFFER. Um disco
 * coplanar precisaria da folga de 0,02 m de `vias.ts`, e 0,02 m só segura terreno
 * plano. O torrão tem 0,20 m de altura e engole o desnível em vez de disputá-lo.
 */
export function geoPe(
  alturaFuste: number, raioTopo: number, corTronco: THREE.Color = COR_TRONCO,
): THREE.BufferGeometry[] {
  const colo = Math.min(0.55, alturaFuste * 0.3)
  const fuste = tubo([[0.0, 0.62], [colo, 0.30], [alturaFuste, raioTopo]], 5, corTronco)
  const torrao = tubo([[0.02, 1.05], [0.20, 0.34]], 6, COR_TERRA)
  return [fuste, torrao]
}

/**
 * ⚠️ `manterNormais` EXISTE PORQUE `computeVertexNormals` APAGA O LÓBULO. A copa
 * lobada só deixa de parecer primitiva porque a normal dela é esférica, e não por
 * face; se a fusão recalcular a normal no fim, os 60 triângulos voltam a acender
 * como 60 chapas. O padrão continua `false` para o look 1 sair igual ao de antes.
 */
export function fundir(gs: THREE.BufferGeometry[], manterNormais = false): THREE.BufferGeometry {
  const vs: number[] = [], cs: number[] = [], ns: number[] = [], ix: number[] = []
  for (const g of gs) {
    const base = vs.length / 3
    const p = g.attributes.position as THREE.BufferAttribute
    const c = g.attributes.color as THREE.BufferAttribute
    const nn = g.attributes.normal as THREE.BufferAttribute | undefined
    for (let i = 0; i < p.count; i++) {
      vs.push(p.getX(i), p.getY(i), p.getZ(i))
      cs.push(c.getX(i), c.getY(i), c.getZ(i))
      if (manterNormais) {
        if (nn) ns.push(nn.getX(i), nn.getY(i), nn.getZ(i))
        else ns.push(0, 1, 0)
      }
    }
    const idx = g.getIndex()
    if (idx) for (let i = 0; i < idx.count; i++) ix.push(base + idx.getX(i))
    else for (let i = 0; i < p.count; i++) ix.push(base + i)
    g.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  if (manterNormais) g.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3))
  else g.computeVertexNormals()
  return g
}

// ═══════════════════════════════════════════════════════════════════════════
// AS QUATRO SILHUETAS
// ═══════════════════════════════════════════════════════════════════════════

/** ALAMEDA (id `esfera`): a folhosa arredondada de calçada. Copa lobada baixa
 *  sobre fuste curto. 92 triângulos, 7,6 m. É a mais comum e a mais neutra: ela
 *  é o FUNDO contra o qual as outras três aparecem. */
function geoAlameda(): THREE.BufferGeometry {
  return fundir([...copaLobada(11, 2.45, 4.9, 0.88, 0.40), ...geoPe(3.4, 0.18)], true)
}

/** ALAMEDA, look 1: copa de icosaedro achatada sobre tronco. 30 triângulos, 7,0 m. */
function geoAlamedaVelha(): THREE.BufferGeometry {
  const copa = new THREE.IcosahedronGeometry(2.6, 0)
  copa.scale(1, 0.82, 1)
  copa.translate(0, 4.9, 0)
  const tronco = new THREE.CylinderGeometry(0.18, 0.26, 3.4, 5, 1, true)
  tronco.translate(0, 1.7, 0)
  return fundir([pintar(copa, COR_COPA), pintar(tronco, COR_TRONCO)])
}

/**
 * CONÍFERA (id `cone`): 80 triângulos, 11,2 m.
 *
 * ⚠️ CONE LISO É A FORMA PRIMITIVA MAIS DENUNCIÁVEL QUE EXISTE, porque a silhueta
 * dele é uma reta e nenhuma conífera tem contorno reto: o que se vê numa é uma
 * pilha de saias, cada uma com a ponta caída. São três saias tronco-cônicas mais
 * uma ponta, 48 triângulos, e o que muda não é o número, é o CONTORNO ficar
 * serrilhado a cada 2,4 m de altura. As saias são cascas abertas, e é o
 * `DoubleSide` do material que as deixa existir vistas de baixo.
 *
 * ⚠️ A SAIA SOBE 1,6 m, e não é enfeite: com a saia no chão, o torrão de 1,05 m
 * fica INTEIRO dentro do cone de 2,4 m de raio, invisível, e os 32 triângulos do
 * pé seriam pagos para não aparecer.
 */
function geoConifera(): THREE.BufferGeometry {
  const saias: THREE.BufferGeometry[] = [
    tubo([[1.90, 2.50], [4.60, 1.90]], 6, COR_CONIF),
    tubo([[4.30, 2.05], [7.00, 1.45]], 6, COR_CONIF),
    tubo([[6.70, 1.55], [9.00, 0.95]], 6, COR_CONIF),
  ]
  const ponta = new THREE.ConeGeometry(1.00, 2.20, 6, 1, true)
  ponta.translate(0, 9.00 + 1.10, 0)
  return fundir([...saias, pintar(ponta, COR_CONIF), ...geoPe(1.9, 0.30)], true)
}

/** CONÍFERA, look 1: `ConeGeometry` liso. 12 triângulos, 11,0 m. */
function geoConiferaVelha(): THREE.BufferGeometry {
  const c = new THREE.ConeGeometry(2.4, 11.0, 6)
  c.translate(0, 5.5, 0)
  return pintar(c, COR_COPA)
}

/**
 * GUARDA-CHUVA (id `copada`): 92 triângulos, 9,4 m.
 *
 * ⚠️ ELA ERA A MESMA ÁRVORE QUE A ALAMEDA, E ESTE É O CONSERTO. Até 02/09 as duas
 * saíam de `copaLobada` com 0,88 e 0,60 de achatamento e fuste de 3,4 e 4,2 m: de
 * pé na calçada, isso é a mesma silhueta com 12% a menos de altura de copa. Agora
 * a diferença é de TIPO, não de grau: fuste LIMPO de 5,6 m (contra 3,4), copa
 * achatada em 0,42 (contra 0,88) e espalhada em 0,72 (contra 0,40). O que se vê
 * de baixo é um guarda-chuva com o tronco inteiro à mostra; o que se vê de cima é
 * um disco largo. Nenhum triângulo a mais: os mesmos 3 lóbulos e o mesmo pé.
 *
 * ⚠️ E A COPA NÃO PODE ABRIR MAIS QUE ISSO. Com `espalha` em 0,92, contado do
 * eixo, os lóbulos chegavam a 6,1 m: 12,2 m de copa numa calçada de 5 m, ou seja
 * a árvore de calçada cobrindo a faixa de tráfego inteira, e num porte de 1,22 dá
 * 14,9 m. Em 0,72 a extensão cai para 5,05 m do eixo, 10,1 m de copa, que é uma
 * figueira grande de praça e ainda cabe na seção da avenida.
 *
 * ⚠️ E O TRONCO DELA É MAIS CLARO DE PROPÓSITO (#877F6F contra #6E685C). Fuste de
 * 5,6 m é metade da leitura da peça; no tom do tronco de fuste curto ele some
 * contra a sombra da própria copa.
 */
function geoGuardaChuva(): THREE.BufferGeometry {
  // ⚠️ COR PRÓPRIA DESDE 03/09 (`COR_COPA_GC`, não mais o `COR_COPA` default
  // de `copaLobada`): era o pigmento que faltava para a guarda-chuva parar
  // de ser a mesma alameda com fuste mais alto. Ver a nota grande do "sage
  // chapado" no topo do arquivo.
  return fundir([
    ...copaLobada(23, 2.90, 6.9, 0.42, 0.72, COR_COPA_GC),
    ...geoPe(5.6, 0.20, COR_TRONCO_CLARO),
  ], true)
}

/**
 * COLUNAR (id `colunar`): 82 triângulos, 12,4 m. A ESPÉCIE NOVA DE 02/09.
 *
 * ⚠️ ELA EXISTE PORQUE FALTAVA UM RISCO VERTICAL NA CIDADE. As três silhuetas
 * anteriores eram todas mais largas do que altas na copa (2,45, 2,95 e 2,50 m de
 * raio contra 7,6 a 11,2 m de altura, ou seja proporções de 1:1,5 a 1:2,2). Numa
 * vista de rua, uma fileira inteira de massas largas achata a perspectiva: não há
 * nada com proporção de POSTE, e é a alternância entre massa e risco que dá ritmo
 * a uma alameda de verdade. A colunar tem 0,95 m de raio para 12,4 m de altura,
 * ou seja 1:6,5, que é a proporção mais estreita da cidade.
 *
 * ⚠️ ELA NÃO É UM CILINDRO, e a diferença é o perfil ONDULADO. Cipreste tem a
 * cintura larga no terço de baixo, aperta no meio e volta a inchar antes da
 * ponta; um tubo de raio constante com a mesma proporção lê como poste verde.
 * O perfil abaixo tem 6 anéis de 5 lados: 5 segmentos × 5 × 2 = 50 triângulos,
 * mais os 32 do pé, 82 no total.
 *
 * ⚠️ A BASE DA COPA E O TOPO DO FUSTE TÊM DE SE ENCONTRAR NA MESMA COTA E NO
 * MESMO RAIO, e a primeira versão não tinha: fuste até 1,2 m com raio 0,26 e copa
 * começando em 1,5 m com raio 0,42 deixavam 0,30 m de VÃO e um anel aberto olhando
 * para cima, que o `DoubleSide` mostra por dentro. Agora as duas se encontram em
 * y = 1,20 com raio 0,20 contra 0,18, e o anel de baixo quase fecha sozinho.
 */
function geoColunar(): THREE.BufferGeometry {
  const copa = tubo([
    [1.20, 0.18],
    [3.30, 0.95],
    [6.20, 0.72],
    [8.60, 0.88],
    [11.10, 0.46],
    [12.40, 0.00],
  ], 5, COR_COLUNAR)
  return fundir([copa, ...geoPe(1.2, 0.20)], true)
}

/**
 * O ARBUSTO: dois lóbulos rentes ao chão, 40 triângulos, 1,6 m.
 *
 * ⚠️ SEM SUB-BOSQUE, JARDIM LÊ COMO ESTACIONAMENTO COM ÁRVORE: entre o chão e a
 * copa, a 5 m de altura, não havia NADA. O arbusto ocupa a faixa de 0 a 1,6 m,
 * que é a altura do olho de quem anda.
 *
 * ⚠️ ELE NÃO TEM LOD DE LONGE, E ISSO É DE PROPÓSITO. Um arbusto de 1,6 m a 420 m
 * mede cerca de 2 px numa tela de 900 px com 45 graus de campo.
 */
export function geoArbusto(): THREE.BufferGeometry {
  return fundir([
    lobo(0.95, 0.00, 0.62, 0.00, 0.74, 4001, COR_ARBUSTO),
    lobo(0.66, 0.74, 0.46, 0.28, 0.72, 4007, COR_ARBUSTO),
  ], true)
}

/**
 * O VOLUME DE LONGE: um octaedro alongado, 8 triângulos, UM SÓ PARA TODA ESPÉCIE.
 *
 * ⚠️ ISTO SUBSTITUI A CRUZ DE QUADS (fundador, 30/08: "esse monte de bloco verde
 * é o quê? Horrível"). A cruz eram três quads cruzados: de frente parece árvore,
 * mas na RASANTE ela vira uma laje verde chapada sem silhueta nenhuma. O octaedro
 * custa 8 triângulos contra 6 e tem VOLUME: qualquer ângulo devolve contorno de
 * copa. A cintura fica a 62% da altura.
 *
 * ⚠️ E AGORA ELE É UM BALDE SÓ, NÃO DOIS, E FOI ISSO QUE PAGOU A COLUNAR. Havia
 * `cruzEsfera` (7,0 × 4,8) e `cruzCone` (11,0 × 4,6) desenhando a MESMA forma com
 * proporções diferentes, o que é exatamente o que a matriz de instância faz de
 * graça. Cada espécie declara o seu `longe` e entra no balde único esticada. A
 * chamada de desenho economizada virou a quarta espécie de perto.
 */
export function geoLonge(altura = 7.0, larg = 4.8): THREE.BufferGeometry {
  const R = larg / 2
  const yc = altura * 0.62
  const vs: number[] = [0, 0, 0]                 // o pé, na cor do tronco
  const cs: number[] = [COR_TRONCO.r, COR_TRONCO.g, COR_TRONCO.b]
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2
    vs.push(Math.cos(a) * R, yc, Math.sin(a) * R)
    cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  }
  vs.push(0, altura, 0)                          // o topo
  cs.push(COR_COPA.r, COR_COPA.g, COR_COPA.b)
  const ix: number[] = []
  for (let k = 0; k < 4; k++) {
    const a = 1 + k, b = 1 + ((k + 1) % 4)
    ix.push(0, b, a)                             // a saia, para baixo
    ix.push(a, b, 5)                             // a copa, para cima
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3))
  g.setIndex(ix)
  g.computeVertexNormals()
  return g
}

// ═══════════════════════════════════════════════════════════════════════════
// A TABELA
// ═══════════════════════════════════════════════════════════════════════════

/** ⚠️ OS IDS SÃO OS ANTIGOS DE PROPÓSITO (`esfera`, `cone`, `copada`). Renomear
 *  para `alameda`, `conifera` e `guardaChuva` seria mais bonito e tocaria o
 *  histograma de LOD, os três tetos, o log e o balde de longe de `arborizacao.ts`
 *  sem mudar um pixel. A quarta entra como `colunar`. */
export type EspecieId = 'esfera' | 'cone' | 'copada' | 'colunar'

export interface Especie {
  id: EspecieId
  /** nome de viveiro, só para o log de boot (que é leitura de quem mantém) */
  nome: string
  /** a geometria de perto, construída uma vez no boot */
  geo(): THREE.BufferGeometry
  /** ⚠️ A PROPORÇÃO NO BALDE DE LONGE, aplicada por matriz de instância sobre o
   *  octaedro de 7,0 × 4,8. É isto que permite quatro espécies num balde só. */
  longe: { escXZ: number; escY: number }
  /** faixa de porte geral: muda nova ao lado de exemplar velho */
  porte: [number, number]
  /** arquétipos de escala não uniforme [xz, y] */
  arquetipos: [number, number][]
  /** amplitude do tombo do fuste em radianos */
  tombo: number
  /** faixa de tinte: frio (t = 0) e quente (t = 1), por canal */
  tinte: { frio: [number, number, number]; quente: [number, number, number] }
}

/**
 * ⚠️ 0,86 a 1,14 ERA FAIXA DE 30%, E ÁRVORE DE RUA NÃO É ASSIM. Uma fileira real
 * tem muda nova de 3 m ao lado de exemplar velho de 13 m. Com o arquétipo junto, a
 * alameda vai de 3,1 m a 13,2 m e a conífera de 5,1 m a 15,1 m.
 *
 * ⚠️ ESCALA NÃO UNIFORME TORCE A NORMAL. O three multiplica a normal pela
 * `instanceMatrix` sem inversa transposta, então uma copa de 0,66 × 1,40 chega ao
 * shader com a normal inclinada alguns graus. NÃO MEDI o erro de luz; nas faixas
 * daqui ele some numa copa de 20 triângulos, mas quem abrir a faixa vai ver a copa
 * achatada acender errado.
 */
export const ESPECIES: Record<EspecieId, Especie> = {
  esfera: {
    id: 'esfera', nome: 'Alameda',
    geo: geoAlameda,
    longe: { escXZ: 1.00, escY: 1.00 },
    porte: [0.60, 1.35],
    arquetipos: [[1.00, 1.00], [1.34, 0.74], [0.66, 1.34], [0.88, 1.40]],
    // a de calçada cresce torta
    tombo: 0.062,
    tinte: { frio: [0.70, 0.82, 0.86], quente: [1.00, 0.98, 0.62] },
  },
  cone: {
    id: 'cone', nome: 'Conífera',
    geo: geoConifera,
    // 11,2 m de altura contra os 7,0 do octaedro base, e um pouco mais estreita
    longe: { escXZ: 0.96, escY: 1.57 },
    porte: [0.55, 1.25],
    arquetipos: [[1.00, 1.00], [1.25, 0.85], [0.80, 1.10], [0.72, 1.24]],
    // a de canteiro é estaqueada: quase no prumo
    tombo: 0.026,
    // ⚠️ a conífera não tem faixa quente: pinheiro seco não fica dourado, fica
    // cinza. A faixa dela anda no FRIO inteiro, de azulado a verde escuro.
    tinte: { frio: [0.72, 0.86, 0.94], quente: [0.90, 0.96, 0.74] },
  },
  copada: {
    id: 'copada', nome: 'Guarda-chuva',
    geo: geoGuardaChuva,
    // ⚠️ 9,3 m de altura e 10,1 m de copa, contra 7,6 m e 6,8 m da alameda: os
    // fatores abaixo são essa razão (10,1/6,8 = 1,49 arredondado para baixo, e
    // 9,3/7,0 = 1,33). O octaedro de longe é um proxy estilizado, não a copa
    // medida, então o fator conservador é o certo: uma copada larga demais no
    // horizonte vira mancha.
    longe: { escXZ: 1.38, escY: 1.34 },
    // ela já nasce larga: a faixa dela é mais curta, senão vira cogumelo
    porte: [0.62, 1.22],
    arquetipos: [[1.00, 1.00], [1.18, 0.86], [0.86, 1.12], [1.08, 0.92]],
    tombo: 0.048,
    // a mais quente das quatro: oliva seca, de praça ensolarada
    tinte: { frio: [0.80, 0.88, 0.78], quente: [1.00, 0.94, 0.56] },
  },
  colunar: {
    id: 'colunar', nome: 'Colunar',
    geo: geoColunar,
    // 12,4 m de altura e 1,9 m de largura: o risco vertical da cidade
    longe: { escXZ: 0.40, escY: 1.77 },
    // ⚠️ A FAIXA DE PORTE DELA É CURTA (0,74 a 1,10) DE PROPÓSITO. A colunar só
    // funciona como ritmo se as vizinhas tiverem a MESMA altura: cipreste de
    // altura sorteada vira serrote e lê como erro de modelagem, não como plantio.
    porte: [0.74, 1.10],
    // e os arquétipos dela quase não abrem: alargar uma colunar a desmancha
    arquetipos: [[1.00, 1.00], [1.10, 0.94], [0.90, 1.08], [0.96, 1.16]],
    // ela é estaqueada como a conífera, e o tombo dela aparece muito mais
    tombo: 0.018,
    tinte: { frio: [0.74, 0.84, 0.90], quente: [0.94, 0.92, 0.66] },
  },
}

export const ORDEM: EspecieId[] = ['esfera', 'cone', 'copada', 'colunar']

/** as duas geometrias do look 1, que continuam saindo exatamente como saíam */
export const GEO_LOOK1 = { esfera: geoAlamedaVelha, cone: geoConiferaVelha }

/**
 * O TINTE DE UMA MUDA. Ele MULTIPLICA a cor por vértice, então 1,0 é a copa base.
 *
 * ⚠️ O TINTE TEM DE FICAR ABAIXO DE 1, E A PRIMEIRA VERSÃO NÃO FICAVA. Ela somava
 * até 1,26 por canal e o vermelho e o verde ESTOURAVAM: seis amostras lidas da
 * malha davam fffff9, fffee8, fffff6, f5f8e6, fffffb, ou seja quase branco, e a
 * variação inteira sobrava no azul. Multiplicador que passa de 1 não clareia a
 * copa, ele a satura e come a própria variação. Todas as faixas de `tinte` acima
 * têm o máximo em 1,00.
 *
 * ⚠️ E A FAIXA É POR ESPÉCIE, não uma só para a cidade. Quatro silhuetas com a
 * mesma paleta continuam lendo como um plantio só visto de longe, que é a
 * distância em que a silhueta já não resolve nada.
 */
export function tintarMuda(
  esp: EspecieId, x: number, z: number, i: number, alvo: THREE.Color,
): THREE.Color {
  const { frio, quente } = ESPECIES[esp].tinte
  const t = 0.65 * ruidoMundo(x, z, 170) + 0.35 * hash01(i * 2654435761)
  alvo.setRGB(
    frio[0] + t * (quente[0] - frio[0]),
    frio[1] + t * (quente[1] - frio[1]),
    frio[2] + t * (quente[2] - frio[2]),
  )
  // e a luminância por muda, que é o que separa duas vizinhas do mesmo tom
  alvo.multiplyScalar(0.82 + hash01(i * 40503) * 0.34)
  return alvo
}

// ═══════════════════════════════════════════════════════════════════════════
// A DISTRIBUIÇÃO POR CONTEXTO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ DISTRIBUIÇÃO UNIFORME É O QUE FAZ ARBORIZAÇÃO PARECER TEXTURA. Até 02/09 a
 * escolha era: hash do índice da avenida decide entre duas espécies na calçada e
 * duas no canteiro, e o ANEL INTEIRO era conífera, sem exceção. Contado nos
 * geradores: os 7 anéis somam 26.634 pontos de plantio contra 25.992 das 12
 * avenidas, ou seja mais da metade da arborização da cidade era UMA espécie só.
 *
 * Aqui cada contexto tem a sua mistura, e a mistura é a leitura urbana do lugar:
 *  - `calcada`  frente de lote: folhosa dominante, colunar como ritmo
 *  - `canteiro` eixo de bulevar: guarda-chuva e colunar, que é o que se planta
 *               em canteiro central de 4 m, e conífera de vez em quando
 *  - `anel`     via de cintura, mais rural: conífera dominante, sem guarda-chuva
 *  - `cova`     pátio de peça e praça: guarda-chuva dominante, que é a árvore de
 *               sombra de praça, e nada de conífera em pátio calçado
 *  - `contorno` malha local (só com `?arvcont=1`): folhosa quase pura
 */
export type Contexto = 'calcada' | 'canteiro' | 'anel' | 'cova' | 'contorno'

const PESO: Record<Contexto, [EspecieId, number][]> = {
  calcada: [['esfera', 0.46], ['copada', 0.30], ['colunar', 0.16], ['cone', 0.08]],
  canteiro: [['copada', 0.34], ['colunar', 0.32], ['cone', 0.26], ['esfera', 0.08]],
  anel: [['cone', 0.44], ['esfera', 0.32], ['colunar', 0.18], ['copada', 0.06]],
  cova: [['copada', 0.42], ['esfera', 0.36], ['colunar', 0.16], ['cone', 0.06]],
  contorno: [['esfera', 0.62], ['copada', 0.22], ['colunar', 0.12], ['cone', 0.04]],
}

/**
 * ⚠️ O DECLIVE É O ÚNICO CONTEXTO QUE NÃO VEM DA RUA, e ele importa: encosta
 * plantada de folhosa lê como pomar, encosta plantada de conífera lê como mata.
 * `declive` é a tangente do ângulo do terreno (queda em metros por metro andado),
 * e acima de 0,16, que é cerca de 9 graus, a mistura inteira desliza para a
 * conífera. NÃO MEDI quantas mudas da cidade caem acima desse limiar: o pódio é
 * plano em y = 0 dentro de r = 1.500 m e as fileiras de anel de 5.620 m para fora
 * é que devem pegar relevo.
 */
const DECLIVE_MATA = 0.16

/**
 * O NÚCLEO DA ESCOLHA POR PESO, separado de `especieDe` em 03/09 para servir
 * dois chamadores: o de sempre (`especieDe`, que busca o peso em `PESO[ctx]`)
 * e o novo da hierarquia viária (`especieDeTabela`, que recebe o peso pronto
 * de uma tabela de `paisagismo.md`). MESMA fórmula, ZERO mudança de resultado
 * para quem já chamava `especieDe`: é refatoração, não comportamento novo.
 *
 * ⚠️ E A ESCOLHA TEM PARENTESCO, senão vira confete. `q` é 62% ruído de mundo em
 * célula de 520 m e 38% hash da fileira: 520 m é da ordem de um quarteirão largo,
 * então um trecho inteiro de avenida sai da mesma espécie e o trecho seguinte
 * troca, que é como um plantio real por lote de obra se comporta. Sortear muda a
 * muda daria uma árvore de cada tipo em cada fileira, que é ruído.
 *
 * @param semente índice da fileira (avenida, aresta de anel), não da muda
 * @param declive tangente do declive local, 0 quando não foi amostrado
 */
function escolherPeso(
  pesos: readonly (readonly [EspecieId, number])[], x: number, z: number, semente: number, declive: number,
): EspecieId {
  const q = 0.62 * ruidoMundo(x, z, 520) + 0.38 * hash01(semente * 4099 + 7)
  // na encosta, a conífera engole metade do peso de todo mundo
  const mata = declive > DECLIVE_MATA
  let total = 0
  const ajust: number[] = []
  for (const [id, p] of pesos) {
    const v = mata ? (id === 'cone' ? p + 0.5 : p * 0.5) : p
    ajust.push(v); total += v
  }
  let acc = 0
  const alvo = q * total
  for (let k = 0; k < pesos.length; k++) {
    acc += ajust[k]
    if (alvo < acc) return pesos[k][0]
  }
  return pesos[pesos.length - 1][0]
}

export function especieDe(
  ctx: Contexto, x: number, z: number, semente: number, declive = 0,
): EspecieId {
  return escolherPeso(PESO[ctx], x, z, semente, declive)
}

/**
 * A MESMA ESCOLHA, com o peso vindo de FORA em vez de `PESO[ctx]`. É a porta
 * de entrada da hierarquia viária de `paisagismo.md` (§1): bulevar cardinal x
 * intermediário, anel por nome, banda por raio. Atrás de `?verde=1` em
 * `arborizacao.ts`: sem a bandeira ninguém chama esta função, e `especieDe`
 * acima continua sendo o único caminho, byte a byte igual a antes de 03/09.
 */
export function especieDeTabela(
  pesos: readonly (readonly [EspecieId, number])[], x: number, z: number, semente: number, declive = 0,
): EspecieId {
  return escolherPeso(pesos, x, z, semente, declive)
}

// ═══════════════════════════════════════════════════════════════════════════
// A HIERARQUIA VIÁRIA (paisagismo.md, §1 e §2): DADO, NÃO IF.
//
// ⚠️ TODOS OS NÚMEROS DAQUI SÃO OS PUBLICADOS POR `cidade-malha.json` /
// `cidade.json` / `teia.ts`, lidos em 03/09: 4 bulevares cardeais (0/90/180/
// 270°) de 44,0 m contra 8 intermediários de 34,0 m (`teia.ts`, `AVENIDAS`);
// 7 anéis nomeados com raio e largura publicados em `cidade.json` (`aneis`);
// 4 bandas de distrito (Núcleo/Meio/Bairro/Borda) com os raios de corte
// publicados em `cidade-malha.json` (`constantes.bandas`); 6 distritos com
// rumo e abertura publicados em `constantes.distritosDef`. Nada aqui é
// inventado: quem planta (`arborizacao.ts`) passa os números que já buscou do
// mesmo JSON, esta tabela só decide o que fazer com eles.
//
// A regra de leitura, por trecho de `paisagismo.md`:
//   §1 hierarquia   → PESO_BULEVAR_CANTEIRO, PESO_BULEVAR_CALCADA, PESO_ANEL
//   §2 bairro/banda → PESO_BANDA, ACENTO_DISTRITO, comAcento, distritoDe
// ═══════════════════════════════════════════════════════════════════════════

/** classe de bulevar: só existem estas duas larguras nos 12 radiais publicados
 *  (`teia.ts:AVENIDAS`, 44 nos quatro cardeais e 34 nos outros oito) */
export type ClasseBulevar = 'cardinal' | 'intermedio'

/**
 * ⚠️ O CARDINAL LEVA A LEITURA MAIS DISCIPLINADA DA CIDADE, DE PROPÓSITO. Ele
 * cruza o sítio inteiro (é o eixo das pontes, `teia.ts`) e é nele que a cidade
 * se apresenta de uma ponta a outra: uma alameda dupla de `esfera` contínua
 * lê como Barcelona (plátano do Eixample) ou Paris (o alinhamento de um só
 * porte no bulevar), que é exatamente a referência que sustenta espécie única
 * em via de maior hierarquia. O canteiro de 4 m (esticado por `esc` nos
 * cardeais) é o único lugar da cidade largo o bastante para a copa de 10,1 m
 * da guarda-chuva sem disputar a pista; a colunar entra como o "risco" que
 * pontua a massa a cada trecho, como um poste de luz pontua uma alameda real.
 *
 * O intermediário (34 m) é a mesma estrutura em escala menor: canteiro mais
 * estreito não cabe copada folgada, então a colunar assume, e a calçada
 * ganha mais textura (duas espécies fortes em vez de uma quase pura) porque
 * ele conecta bairro a bairro, não a cidade inteira: é onde a variação de
 * caráter local pode aparecer sem quebrar a legibilidade do sistema primário.
 */
export const PESO_BULEVAR_CANTEIRO: Record<ClasseBulevar, [EspecieId, number][]> = {
  cardinal: [['copada', 0.48], ['colunar', 0.32], ['cone', 0.20]],
  intermedio: [['colunar', 0.44], ['cone', 0.34], ['copada', 0.22]],
}
export const PESO_BULEVAR_CALCADA: Record<ClasseBulevar, [EspecieId, number][]> = {
  cardinal: [['esfera', 0.72], ['copada', 0.18], ['colunar', 0.10]],
  intermedio: [['esfera', 0.48], ['copada', 0.28], ['colunar', 0.16], ['cone', 0.08]],
}

/**
 * ⚠️ OS SETE ANÉIS NÃO SÃO UMA VIA SÓ REPETIDA, e hoje eram (100% conífera,
 * ver a nota de `PESO.anel` acima). Cada nome publicado em `cidade.json`
 * carrega o caráter do lugar onde ele está:
 *
 *   Anel Interior (r 1.750, 26 m)   Núcleo:  quase tão disciplinado quanto o
 *                                   bulevar cardinal, porque está colado à
 *                                   praça e à malha mais fina da cidade.
 *   Anel Médio (r 2.750, 26 m)      Meio:    a transição, metade folhosa
 *                                   metade guarda-chuva.
 *   Anel Exterior (r 3.750, 26 m)   Bairro:  a copa se abre e a conífera
 *                                   entra de vez, preparando o Cinturão.
 *   Avenida do Cinturão (r 4.450, 30 m)  Borda: hardier, guarda-chuva vira
 *                                   acento raro, não presença.
 *   Avenida da Doca / de Escoamento (r 5.620 e 6.300, 34 m)  Cinta: via de
 *                                   serviço portuário/industrial, conífera e
 *                                   colunar, nada ornamental, espaçamento
 *                                   maior (ver `paisagismo.md` §1).
 *   Pista de Serviço (r 7.600, 30 m)  a borda do sítio: conífera pura, a
 *                                   única leitura honesta para uma via de
 *                                   manutenção que ninguém passeia.
 *
 * Chave por `a.nome` (o campo que `cidade.json.aneis[]` já publica); quem
 * chama passa um fallback para o nome que não bater (não deveria acontecer,
 * mas a malha pode crescer sem esta tabela crescer junto).
 */
export const PESO_ANEL: Record<string, [EspecieId, number][]> = {
  'Anel Interior': [['esfera', 0.56], ['copada', 0.32], ['colunar', 0.12]],
  'Anel Médio': [['esfera', 0.38], ['copada', 0.36], ['cone', 0.26]],
  'Anel Exterior': [['copada', 0.36], ['cone', 0.40], ['colunar', 0.24]],
  'Avenida do Cinturão': [['cone', 0.56], ['colunar', 0.30], ['copada', 0.14]],
  'Avenida da Doca': [['cone', 0.64], ['colunar', 0.36]],
  'Avenida de Escoamento': [['cone', 0.70], ['colunar', 0.30]],
  'Pista de Serviço': [['cone', 1]],
}
/** o peso de anel para um nome que a tabela não conhece: o do Anel Médio, o
 *  mais neutro dos sete */
export const PESO_ANEL_PADRAO: [EspecieId, number][] = PESO_ANEL['Anel Médio']

/**
 * ⚠️ AS QUATRO BANDAS SÃO UM GRADIENTE DE FORMALIDADE, NÃO QUATRO CAIXAS. O
 * Núcleo (raio 1.450 a 2.180, quarteirão de 109 m) é a malha mais fina e mais
 * perto da praça: leitura disciplinada, quase toda folhosa. A Borda (4.300 a
 * 5.500, quarteirão de 286 m) encosta na Cinta industrial e no Parque
 * Runestone: a mistura pende para a conífera, preparando o olho para o que
 * vem depois. Meio e Bairro interpolam entre as duas pontas. Os quatro cortes
 * de raio são os PUBLICADOS em `constantes.bandas`: `bandaDe` below lê o
 * array de verdade, nunca um número fixo aqui.
 */
export type Banda = 'Nucleo' | 'Meio' | 'Bairro' | 'Borda' | 'Cinta'

export const PESO_BANDA: Record<Banda, [EspecieId, number][]> = {
  Nucleo: [['esfera', 0.62], ['copada', 0.26], ['colunar', 0.12]],
  Meio: [['esfera', 0.48], ['copada', 0.28], ['colunar', 0.14], ['cone', 0.10]],
  Bairro: [['esfera', 0.34], ['copada', 0.26], ['cone', 0.26], ['colunar', 0.14]],
  Borda: [['cone', 0.42], ['esfera', 0.24], ['copada', 0.20], ['colunar', 0.14]],
  Cinta: [['cone', 0.62], ['colunar', 0.38]],
}

/**
 * Em que banda cai um raio `r`, a partir do array PUBLICADO (`meta.constantes
 * .bandas` de `cidade-malha.json`: `{ de, ate, nome }`, nomes exatamente
 * 'Nucleo' | 'Meio' | 'Bairro' | 'Borda'). Além da última banda é `'Cinta'`
 * (o cinturão industrial, r ≥ 5.500, que a malha de distrito não cobre).
 *
 * ⚠️ NUNCA HARDCODEAR OS RAIOS AQUI: eles vêm de fora porque são dado do
 * gerador (`scripts/gerar_cidade.py`), não constante de paisagismo. Se a
 * cidade crescer uma banda, esta função não precisa mudar.
 */
export function bandaDe(r: number, bandas: readonly { de: number; ate: number; nome: string }[]): Banda {
  for (const b of bandas) if (r >= b.de && r < b.ate) return b.nome as Banda
  return 'Cinta'
}

/**
 * ⚠️ O ACENTO É SÓ NA MALHA LOCAL (contorno e travessa), NUNCA NO BULEVAR NEM
 * NO ANEL. Essa é a diferença entre "identidade de bairro" e "colcha de
 * retalhos": a estrutura primária (12 avenidas, 7 anéis) tem de ler como UM
 * sistema em toda a cidade, senão ninguém reconhece um bulevar de outro; é a
 * malha fina, que já muda de banda a cada quarteirão, quem pode carregar o
 * sotaque do distrito sem quebrar a leitura de cima.
 *
 * Os seis distritos publicados (`constantes.distritosDef`, rumo 0°, 61,875°,
 * 106,875°, 185,625°, 241,875°, 309,375°) foram lidos contra o programa cívico
 * de `cidade.json` (medido em 03/09, ver `paisagismo.md` §2) para escolher o
 * acento:
 *
 *   0  Cais Norte (logística, sem monumento)         → cone, robusto, utilitário
 *   1  Universidade/Hospital/Hipódromo, Lago Maior    → copada, parque e sombra
 *   2  HQ, Museu, Casa da Moeda, Fundadores (o maior) → colunar, cívico e vertical
 *   3  City Hall, Distrito Financeiro, Lago do Poente → esfera, formal e disciplinado
 *   4  Memorial, Mercado, Jardim Botânico             → esfera, quieto e refletido
 *   5  Observatório, Cinturão, Jardim das Coortes     → cone, fronteira
 *
 * `comAcento` multiplica o peso da espécie-acento por 1,6 e deixa o resto como
 * está (a normalização de `escolherPeso` cuida do resto somar 1 de novo).
 */
export const ACENTO_DISTRITO: readonly EspecieId[] = ['cone', 'copada', 'colunar', 'esfera', 'esfera', 'cone']

export function comAcento(
  pesos: readonly (readonly [EspecieId, number])[], distrito: number | null,
): [EspecieId, number][] {
  if (distrito == null) return pesos as [EspecieId, number][]
  const alvo = ACENTO_DISTRITO[((distrito % ACENTO_DISTRITO.length) + ACENTO_DISTRITO.length) % ACENTO_DISTRITO.length]
  return pesos.map(([id, p]) => [id, id === alvo ? p * 1.6 : p] as [EspecieId, number])
}

/**
 * Em que distrito (0..5) cai um ponto do mundo, a partir de `distritosDef`
 * PUBLICADO (`constantes.distritosDef`, `{ rumo, abertura }` em graus).
 *
 * ⚠️ A CONVENÇÃO DE RUMO É A DE `teia.ts`: rumo 0° aponta para −z (mundo
 * `[x, z] = [sin(a)·r, −cos(a)·r]`), então o ângulo inverso é
 * `atan2(x, −z)`, normalizado para [0°, 360°). Usar `atan2(z, x)` (a
 * convenção matemática comum) giraria os seis distritos 90° e cada acento
 * cairia no bairro errado, em silêncio: o mesmo defeito de convenção que já
 * custou uma cidade espelhada em `vias.ts` (nota de 29/08).
 */
export function distritoDe(x: number, z: number, distritosDef: readonly { rumo: number; abertura: number }[]): number {
  let ang = (Math.atan2(x, -z) * 180) / Math.PI
  ang = ((ang % 360) + 360) % 360
  for (let i = 0; i < distritosDef.length; i++) {
    const d = distritosDef[i]
    if (ang >= d.rumo && ang < d.rumo + d.abertura) return i
  }
  return distritosDef.length - 1
}

/**
 * O ARQUÉTIPO DE UMA MUDA: qual das quatro escalas não uniformes ela recebe.
 *
 * ⚠️ ESCALA NÃO UNIFORME É A SILHUETA DE GRAÇA. Quatro leituras (redonda, aberta,
 * colunar, alta) saem de dois fatores por instância, sem malha nova, sem material
 * novo e sem um triângulo a mais: o custo de mais uma silhueta real é uma chamada
 * de desenho inteira numa cena com 382.
 */
export function arquetipoDe(esp: EspecieId, x: number, z: number, i: number): [number, number] {
  const arq = ESPECIES[esp].arquetipos
  // o arquétipo também tem parentesco: uma alameda inteira tende ao mesmo tipo
  const q = 0.55 * ruidoMundo(x, z, 240) + 0.45 * hash01(i * 101)
  return arq[Math.min(arq.length - 1, Math.floor(q * arq.length))]
}
