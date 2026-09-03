// ═══════════════════════════════════════════════════════════════════════════
// AS SUPERFÍCIES DA CIDADE. Albedo, normal e rugosidade pra cada chão que a
// DogCity tem, gerados em canvas no boot da cena.
//
// ⚠️ POR QUE ISTO EXISTE. Medido em 01/09, antes desta peça: nenhum chão da
// cidade tinha textura. Terreno, rua, calçada, praça e lote eram todos
// `MeshStandardMaterial` com cor por vértice e mais nada. É o defeito de
// primeira ordem da cena: sem mapa de normal não existe micro-relevo, sem mapa
// de rugosidade a luz responde igual no asfalto e na grama, e o olho lê "polígono
// pintado" a qualquer distância. Nenhuma quantidade de geometria conserta isso,
// porque o problema não é a forma, é o que a forma faz com a luz.
//
// ⚠️ PROCEDURAL, NÃO ARQUIVO. Não há PNG nenhum aqui e é de propósito. Seis
// superfícies em 512² com três mapas cada seriam uns 12 MB de imagem no bundle,
// que numa cena que já carrega GLB, terreno e a abóbada é o pior lugar do mundo
// pra gastar rede. Gerar em canvas custa uma vez uns poucos ms por superfície,
// não passa pela rede, e permite variar a receita sem reexportar nada.
//
//   Onde o Blender ENTRA é no MOBILIÁRIO, não aqui: poste, banco, guia,
//   guarda-corpo, lixeira e placa são geometria modelada e é isso que tira a
//   cara de primitiva da cena. Textura que ladrilha ao infinito é trabalho de
//   ruído, não de modelagem.
//
// ⚠️ LADRILHO É O INIMIGO. Uma textura de 8 m repetida por 4 km desenha um
// xadrez visível de longe, e o xadrez lê PIOR que a cor chapada que ele veio
// substituir. É pra isso que serve `quebrarRepeticao`: um ruído de baixíssima
// frequência em coordenada de MUNDO, injetado no fragmento, que modula o albedo
// numa escala de dezenas de metros. O ladrilho continua lá; o olho perde a
// grade.
//
// ⚠️ UM PROGRAMA SÓ PRA TODO MUNDO. `onBeforeCompile` sem `customProgramCacheKey`
// compila um programa POR MATERIAL, e esta cena vive perto do teto de programas
// (medido: 402 compilados na vista alta). Todo material que passa por
// `quebrarRepeticao` declara a MESMA chave, então o three compila a variação uma
// vez e reaproveita.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
//
// ── FRENTE ASFALTO, 03/09 ATRÁS DE `?asfalto=1` ─────────────────────────────
// A cidade ganhou rua de contorno em 1.862 quarteirões (`fundacao-gta5.md`) e o
// asfalto passou a ser a superfície mais vista da cidade. Esta rodada mexe só
// em `amostraAsfalto` e em `quebrarRepeticao` (a segunda por uma extensão
// aditiva, uniforme-driven, que não muda o texto do shader pras outras cinco
// superfícies). Sem a bandeira, os dois ficam bit a bit como estavam.
//
// ⚠️ (1) O SULCO DE RODA SAIU DO LADRILHO, E NÃO VOLTA. Até aqui
// `amostraAsfalto` carimbava duas faixas em u=0,3 e u=0,7 DO LADRILHO, ou seja
// a cada 9 m de mundo, sem relação nenhuma com a pista de verdade — que no
// contorno mede de 6 a 10 m e no bulevar 44 m. `vias.ts:462-468` já tinha
// medido o estrago ("numa faixa de 7 m elas caem uma vez e meia, fora de
// lugar") e já escrevia por cima, pelo atributo `aVia` (posição real dentro da
// seção de via, gravada por vértice), o sulco no lugar CERTO: eixo de cada
// faixa, largura real, nunca repete porque não é ladrilho, é geometria. Só que
// aquele conserto de `vias.ts` só alcançava a RUGOSIDADE, e por MISTURA (peso
// 0,7, a rugosidade errada da receita ainda vazava 30%); o ALBEDO errado
// MULTIPLICAVA por cima sem nenhum desconto, então as duas faixas fora de
// lugar continuavam pintadas na tela por baixo do sulco certo. A regra é a
// mesma das 56 crateras removidas em 01/09: SULCO DE RODA TEM POSIÇÃO
// VERDADEIRA, é feição com identidade, não pertence ao ladrilho que se repete
// — pertence à via, que já é atributo de mundo em `vias.ts`. A duplicata errada
// sai daqui; o sulco de verdade já existia no lugar certo o tempo todo.
//
// ⚠️ (2) IDADE E PROCEDÊNCIA: A VARIAÇÃO GRANDE MORA EM `quebrarRepeticao`,
// NUNCA NO LADRILHO. `amostraAsfalto` (esta receita) só pode carregar o que o
// olho não identifica — grão de brita, desnível fino — porque qualquer coisa
// maior repetiria a cada 9 m e o xadrez seria pior que a chapa lisa que veio
// substituir (a MESMA lição das crateras). Trecho novo x trecho velho, junta
// de execução entre frentes de pavimentação e borda de agregado aflorado são
// GRANDES e têm de vir de coordenada de MUNDO, então moram na extensão nova de
// `quebrarRepeticao` (ativada só pro asfalto, por uniforme, texto do shader
// idêntico pras outras cinco superfícies — ver a nota grande na função).
// Duas escalas, as duas DECISÃO DE PROJETO, não medição de campo:
//   ~90 m   trecho novo x trecho velho: reaproveita o ruído de mundo que
//           `quebrarRepeticao` já tinha (3 oitavas a partir de `macroMetros`;
//           `vias.ts` já chama com 90 m pro asfalto), só que agora ele também
//           é a camada de idade, não só a quebra de ladrilho.
//   ~220 m  lote de pavimentação (frente de obra): um Worley/celular
//           jitterado em coordenada de mundo — não é grade, é célula
//           irregular, pela mesma razão de nunca desenhar linha reta que se
//           repete. 220 m foi escolhido perto dos 227 m do quarteirão Bairro
//           (`vias.ts`, uma dimensão real da cidade), pra que uma "obra" leia
//           como algo do tamanho de um quarteirão, não um capricho de escala.
//           Cada célula sorteia UMA idade (tinge todo o lote um pouco mais
//           claro/oxidado ou mais escuro/fresco) e a borda entre duas células
//           ganha uma aresta clara e fina — o agregado que a máquina de
//           pavimentação deixa exposto na emenda de duas frentes.
//
// ⚠️ (3) AS DUAS DISTÂNCIAS, com a MESMA câmera da cena inteira (fov 42,
// `plaza-scene.tsx:880`, um PerspectiveCamera só — não há câmera de rua
// diferente da aérea). `f = (viewport/2) / tan(21°)`; pra viewport 900 px,
// `f ≈ 1.172,3 px` (a mesma conta de `maquete-spec.md` 2.3). Ladrilho de 9 m
// em 512 px dá um texel de 9/512 = 1,7578 cm.
//
//   A 1,7 m (de pé): px/m = 1.172,3/1,7 ≈ 689,6. Um texel mede 12,12 px na
//   tela — o ladrilho inteiro (9 m) cobriria 6.206 px, muito além de qualquer
//   enquadramento, então a QUESTÃO NÃO É REPETIÇÃO DE LADRILHO, é textura
//   crua: um ciclo de brita (período ~9,4 cm, 96 lóbulos em 9 m) mede 64,7 px
//   na tela — GRANDE, plenamente resolvido. É por isso que o grão tem de
//   parecer material de verdade (variação de tom E de normal) e nunca uma
//   feição com contorno definido: de perto, o olho lê textura E FORMA, e
//   forma repetida é o que vira desenho.
//
//   A 50 m (dentro dos 30-80 m de rasante de drone do briefing): px/m =
//   1.172,3/50 ≈ 23,45. Um texel mede 0,412 px — MENOR que um pixel, a
//   textura já está minificada (é o regime que pede anisotropia, já ligada
//   por `setAnisotropia`). Um ciclo de brita mede 2,20 px: já no limite de
//   Nyquist, o grão para de existir como forma e vira só tom médio — CORRETO,
//   é o "chão de verdade fica liso a 50 m" que a nota de `relevoM` já
//   declarava. Mas o LADRILHO (9 m) ainda cobre 211 px na tela: grande o
//   bastante pra que qualquer feição identificável dentro dele (o sulco de
//   roda antigo, por exemplo) se repetisse umas 15 vezes num quadro de 3.000
//   px de largura — E ISSO O OLHO VÊ, mesmo sem ver mais o grão. É essa
//   repetição de MÉDIA distância, não a de perto, que o item (1) resolve e
//   que a variação de mundo do item (2) tem de vencer: a 50 m, uma célula de
//   220 m cobre 220 × 23,45 ≈ 5.159 px — bem além de qualquer quadro — e por
//   isso lê como região, nunca como grade.
//
// ⚠️ (4) A COR: FAMÍLIA OSSO, NÃO AZUL, E CALIBRADA CONTRA A TINTA DE QUEM
// VESTE. Medido (grid 512×512, mesmo ruído desta função): a receita de hoje
// (com o rodado) tem média r,g,b ≈ (58,0; 58,0; 61,5) — CANAL AZUL MAIS ALTO
// que o vermelho, a única superfície da cidade fora da família OSSO (matiz
// 36-42, `maquete-spec.md` 1.1) sem ser uma das duas exceções declaradas
// (água, pista de atletismo). `vias.ts` veste esse mapa com a tinta quase
// branca `#F5EFE4` (única consumidora de 'asfalto' na cidade inteira —
// conferido: nenhum outro módulo chama `vestir`/`superficie` com 'asfalto').
// Multiplicando mapa × tinta em linear, a pista final mede L ≈ 0,037 — MAIS
// ESCURA que o regolito ao redor (receita `amostraRegolito` × tinta do
// terreno `#9A948B` mede L ≈ 0,049 — `terrain.ts:124`): contraste 1,14:1 e
// INVERTIDO, a rua lendo mais escura que o pó solto ao lado dela. A paleta
// (`maquete-spec.md` 1.1) diz o oposto: PISTA/ESCURO `#57534B` tem L = 0,0872,
// mais CLARA que REGOLITO `#3F3D3A` (L = 0,047) — é essa diferença que faz a
// teia se destacar do terreno. A receita nova (atrás da bandeira) resolve as
// duas coisas juntas: mantém a razão de canal do próprio `#57534B`
// (G/R=0,9540, B/R=0,8621 — família OSSO de verdade) e desloca a média pra
// 74 + ruído (fecha em ≈ 93 em 255) porque É A CONTA, não o gosto: 93/255 é o
// valor que, multiplicado pela MESMA tinta `#F5EFE4` de `vias.ts`, devolve
// L = 0,0872 na tela — a luminância exata de PISTA/ESCURO. Contraste
// resultante: pista/regolito 1,38:1 (a ordem certa, pista mais clara),
// pista/calçada final 3,51:1 (calçada também renderiza abaixo do seu próprio
// hex — L 0,432 medido contra 0,556 do `#CBC4B6` cru — então bater os 4,41:1
// da tabela 1.5 exigiria mexer em `calcada`, que não é este arquivo; 3,51:1
// ainda é contraste sólido e, ao contrário de hoje, na direção certa).
//
// ⚠️ ORÇAMENTO, sem abrir navegador (medido em Node, mesmo ruído desta
// função, e no console do boot pelo `performance.now()` que `gerar` agora
// publica): material novo = 0, textura nova = 0 MB (ainda 3 mapas de 512² por
// superfície, nenhuma superfície nova), programa de shader novo = 0 (a
// extensão de `quebrarRepeticao` é texto idêntico pras seis superfícies,
// ligado por uniforme; roda dentro do MESMO `customProgramCacheKey` de
// sempre, 'dogcity:macro'). O custo por-fragmento da célula de idade só é
// pago de verdade pelo asfalto: o `if` do shader é sobre um UNIFORME (não um
// `varying`), então toda a chamada de desenho da calçada, do campo, do
// concreto e da pedra toma o MESMO caminho de warp e não paga o laço 3×3 do
// Worley.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export type Superficie =
  | 'regolito'   // o pó lunar fora do pódio
  | 'asfalto'    // pista
  | 'calcada'    // laje de concreto, com junta
  | 'campo'      // o verde do lote e da praça
  | 'concreto'   // concreto moldado, liso: plinto, mureta, pódio
  | 'pedra'      // guia, degrau, muro de arrimo

export interface Conjunto {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
  /** quantos metros de mundo cabem num lado do ladrilho */
  metros: number
  /** força sugerida do normal pra esta superfície */
  normalScale: number
}

// ── ruído ───────────────────────────────────────────────────────────────────
// Valor-ruído com látice que DÁ A VOLTA: sem o módulo no látice a textura não
// casa na emenda e cada ladrilho mostra uma linha vertical e uma horizontal.
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function vnoise(x: number, y: number, per: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per
  const y0 = ((yi % per) + per) % per, y1 = (y0 + 1) % per
  const a = hash2(x0, y0), b = hash2(x1, y0), c = hash2(x0, y1), d = hash2(x1, y1)
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
}

/** fbm que ladrilha: `per` é o látice da PRIMEIRA oitava e dobra junto com a
 *  frequência, então toda oitava fecha no mesmo período. */
function fbm(x: number, y: number, oct: number, per: number): number {
  let s = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, per * f)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return s / norm
}

// ── receitas ────────────────────────────────────────────────────────────────
// Cada receita responde, pra um ponto (u,v) em 0..1 do ladrilho:
//   h    altura em 0..1, de onde sai o mapa de normal
//   r,g,b cor linear em 0..255
//   rug  rugosidade em 0..1
type Amostra = { h: number; r: number; g: number; b: number; rug: number }

const S = 512 // lado do ladrilho em pixels

function amostraRegolito(u: number, v: number): Amostra {
  // ⚠️ ESTA RECEITA TINHA 56 CRATERAS CARIMBADAS E ELAS FORAM REMOVIDAS EM
  // 01/09, a pedido do fundador ("são as mesmas marcas por todo o terreno").
  // O comentário que estava aqui dizia que a cratera era o que fazia o chão ler
  // como Lua. Isso é verdade numa FOTO e é falso num LADRILHO, e a diferença é a
  // regra que vale pra toda textura que se repete:
  //
  //   UM LADRILHO SÓ PODE CONTER O QUE O OLHO NÃO CONSEGUE IDENTIFICAR
  //   INDIVIDUALMENTE.
  //
  // Grão, poeira e variação de rugosidade não têm identidade: repetidos, viram
  // superfície. Uma cratera TEM identidade, e o olho que reconhece uma feição
  // passa a usá-la pra achar a grade. Com ladrilho de 90 m sobre um terreno de
  // quilômetros, as 56 crateras apareciam de novo a cada 90 m, em formação, e o
  // xadrez que elas desenhavam lia PIOR que a cor chapada que a textura veio
  // substituir.
  //
  // ⚠️ E O ALBEDO QUASE LISO NÃO É CONCESSÃO, É O CERTO. O regolito real é quase
  // uniforme em cor na escala de dezenas de metros: o que varia na foto da
  // Apollo é a LUZ, não a tinta. Cratera é acidente de LUGAR, tem posição
  // verdadeira, e por isso pertence à malha do terreno (que aqui é elevação
  // lunar real do Mare Tranquillitatis), nunca a uma imagem que se repete.
  //
  // Sobra, de propósito, só o que amacia a luz sem nunca ser visto como desenho:
  // grão fino de amplitude baixa no relevo, e uma variação de rugosidade menor
  // ainda. A quebra de escala grande continua vindo de `quebrarRepeticao`, que
  // trabalha em coordenada de MUNDO e por isso não repete nunca.
  const grao = fbm(u * 34, v * 34, 3, 34)
  const poeira = fbm(u * 96, v * 96, 2, 96)
  const h = grao * 0.45 + poeira * 0.55
  // faixa de tom estreita: 0,96 a 1,04, ou seja mais ou menos 4%. É variação de
  // pó assentado, não de mancha.
  const t = 0.96 + h * 0.08
  return { h, r: 118 * t, g: 112 * t, b: 104 * t, rug: 0.955 + poeira * 0.03 }
}

function amostraAsfalto(u: number, v: number): Amostra {
  const brita = fbm(u * 96, v * 96, 3, 96)      // o agregado
  const macro = fbm(u * 5, v * 5, 4, 5)          // desnível fino dentro do próprio ladrilho

  if (!ASFALTO_NOVO) {
    // ⚠️ RECEITA ANTIGA, PRESERVADA BIT A BIT ATRÁS DA BANDEIRA. Ela tem o
    // sulco de roda carimbado em u=0,3/0,7 do LADRILHO (posição de tile, não
    // de via) e o canal azul mais alto que o vermelho. Os dois defeitos estão
    // escritos e explicados na nota grande do cabeçalho ("FRENTE ASFALTO,
    // 03/09"); o conserto é a receita de baixo, e só ela roda com
    // `?asfalto=1`.
    const rodado = Math.exp(-((u - 0.3) ** 2) / 0.006) + Math.exp(-((u - 0.7) ** 2) / 0.006)
    const h = brita * 0.8 + macro * 0.2 - rodado * 0.12
    const base = 40 + brita * 30 - rodado * 6 + macro * 10
    return {
      h: Math.max(0, Math.min(1, h)),
      r: base, g: base * 1.0, b: base * 1.06,
      rug: 0.92 - rodado * 0.26 - brita * 0.06,
    }
  }

  // ── RECEITA NOVA (`?asfalto=1`) ─────────────────────────────────────────
  // Sem sulco de roda: ele é feição com posição verdadeira e mora em
  // `vias.ts` (atributo `aVia`, ver a nota do cabeçalho). O que sobra aqui é
  // só o que o olho nunca identifica individualmente: grão de brita e um
  // desnível fino de ladrilho.
  const h = brita * 0.8 + macro * 0.2
  // ⚠️ 74 NÃO É CHUTE. `40 + brita*30 + macro*10` (a receita antiga sem o
  // rodado) mede média 59,66 num grid 512×512; o deslocamento pra 74 fecha a
  // média em ≈93/255, que é o valor que — multiplicado pela tinta `#F5EFE4`
  // que `vias.ts` já usa — devolve a luminância exata de PISTA/ESCURO
  // (`#57534B`, L=0,0872, `maquete-spec.md` 1.1). A conta inteira, com o
  // porquê da pista estar hoje mais escura que o regolito (errado) e como o
  // deslocamento resolve isso, está na nota grande do cabeçalho.
  const base = 74 + brita * 30 + macro * 10
  return {
    h,
    // ⚠️ FAMÍLIA OSSO: as razões de canal são as de `#57534B` (G/R=0,9540,
    // B/R=0,8621), não mais um azul que nenhuma outra superfície da cidade
    // tem (as duas exceções cromáticas da paleta são água e pista de
    // atletismo, declaradas em `maquete-spec.md` 1.3; asfalto não é uma
    // delas).
    r: base, g: base * 0.9540, b: base * 0.8621,
    rug: 0.92 - brita * 0.06,
  }
}

function amostraCalcada(u: number, v: number): Amostra {
  // Laje de 1/4 do ladrilho, junta funda de 2 px: a junta é o que dá escala
  // humana ao chão. Sem ela a calçada é uma chapa cinza de tamanho indefinido.
  const NL = 4
  const fu = (u * NL) % 1, fv = (v * NL) % 1
  const junta = Math.min(fu, 1 - fu, fv, 1 - fv)
  const naJunta = junta < 0.022
  const idLaje = Math.floor(u * NL) * 31 + Math.floor(v * NL) * 17
  const tomLaje = 0.94 + hash2(idLaje, 3) * 0.12       // laje a laje varia
  const mosqueado = fbm(u * 26, v * 26, 4, 26)
  const lasca = fbm(u * 60, v * 60, 2, 60)
  const h = naJunta ? 0.18 : 0.72 + mosqueado * 0.2 + lasca * 0.08
  const t = (naJunta ? 0.62 : tomLaje) * (0.9 + mosqueado * 0.2)
  return {
    h, r: 186 * t, g: 180 * t, b: 168 * t,
    rug: naJunta ? 0.98 : 0.86 + mosqueado * 0.1,
  }
}

function amostraCampo(u: number, v: number): Amostra {
  // Duas escalas de tufo mais um capim alto de alta frequência. O verde varia de
  // seco a viçoso; verde único chapado é a assinatura do amadorismo.
  const tufoG = fbm(u * 4, v * 4, 4, 4)
  const tufoP = fbm(u * 17, v * 17, 3, 17)
  const capim = fbm(u * 110, v * 130, 2, 110)
  const seco = Math.max(0, fbm(u * 3 + 9, v * 3 + 4, 3, 3) - 0.52) * 2.2
  const h = capim * 0.6 + tufoP * 0.28 + tufoG * 0.12
  const vico = 0.72 + tufoG * 0.3 + tufoP * 0.2 + capim * 0.16
  const r = (86 + seco * 62) * vico
  const g = (112 + seco * 22) * vico
  const b = (66 + seco * 10) * vico
  return { h, r, g, b, rug: 0.93 + capim * 0.06 }
}

function amostraConcreto(u: number, v: number): Amostra {
  const poro = fbm(u * 70, v * 70, 3, 70)
  const mancha = fbm(u * 6, v * 6, 4, 6)
  // linha de fôrma a cada meio ladrilho: concreto moldado tem junta de painel
  const forma = Math.abs(((v * 2) % 1) - 0.5) > 0.487 ? 1 : 0
  const h = 0.7 + poro * 0.24 - forma * 0.3
  const t = (0.9 + mancha * 0.2) * (1 - forma * 0.12)
  return { h, r: 172 * t, g: 169 * t, b: 162 * t, rug: 0.8 + poro * 0.14 + mancha * 0.05 }
}

function amostraPedra(u: number, v: number): Amostra {
  const veio = fbm(u * 9, v * 9, 5, 9)
  const grao = fbm(u * 80, v * 80, 3, 80)
  const h = veio * 0.6 + grao * 0.4
  const t = 0.76 + veio * 0.36 + grao * 0.1
  return { h, r: 138 * t, g: 133 * t, b: 124 * t, rug: 0.88 + grao * 0.1 }
}

const RECEITAS: Record<Superficie, { fn: (u: number, v: number) => Amostra; metros: number; normalScale: number; relevoM: number }> = {
  // ⚠️ `normalScale` BAIXO DE PROPÓSITO. O grão aqui existe pra amaciar a luz,
  // não pra ser visto: normal forte num chão sem feição vira aquele granulado de
  // plástico que denuncia textura procedural.
  //
  // ── `relevoM`: QUANTOS METROS DE RELEVO VALE `h = 1` (?relevo=1) ────────────
  //
  // ⚠️ ISTO É O CONSERTO DE UM DEFEITO MEDIDO EM 02/09, e ele só apareceu quando
  // o portão ganhou chapa na ALTURA DO OLHO. De cima o chão estava bom; a 1,7 m
  // o asfalto lia como papel-alumínio amassado e o regolito como veludo cotelê,
  // com a direção do ladrilho visível a perder de vista.
  //
  // A causa não é gosto, é uma conta que faltava. O mapa de normal sai de um
  // Sobel sobre `h` multiplicado por uma FORÇA ÚNICA, a mesma para as seis
  // superfícies, e a inclinação física que isso produz é
  //
  //     inclinação = FORÇA · 8 · (∂h/∂texel) · (S / metros)
  //
  // ou seja ela DEPENDE DE `metros`, que vai de 4 a 40. Com uma força só, o
  // regolito (ladrilho de 40 m) recebia 4,4 vezes mais relevo físico que o
  // asfalto (9 m) para o mesmo desenho de altura, e os dois recebiam relevo de
  // ordens de grandeza acima do real. Daí a corrugação de um metro num pó que na
  // vida é milimétrico.
  //
  // Com `relevoM` a força se DERIVA, e some do arbítrio:
  //
  //     FORÇA = relevoM · S / (8 · metros)
  //
  // Os valores abaixo são o TOPO da faixa plausível de cada material, não a
  // média: o objetivo é matar o alumínio amassado sem chapar o chão de vez.
  // Brita de capa de rolamento é 8 a 16 mm; junta de laje de calçada é 1 cm;
  // pó assentado é centimétrico.
  //
  // ⚠️ E ISTO TIRA RELEVO DE LONGE, DE PROPÓSITO. Chão de verdade fica liso a
  // 50 m: o que sobrevive à distância é MANCHA, não bolha. Se a vista alta ficar
  // pobre depois desta conta, a resposta certa é variação de albedo e decalque,
  // e micro-relevo na GEOMETRIA do terreno, nunca devolver a força do normal.
  // ⚠️ O REGOLITO É O ÚNICO QUE SUBIU DEPOIS DA PRIMEIRA CHAPA, e não por gosto.
  // Com 0,05 m a planície ficou uma chapa marrom morta na rasante: certo para
  // pó, errado para o LUGAR, porque num ladrilho de 40 m o que o olho vê não é
  // grão de pó, é clod, ejecta e cratera de meio metro, que o mare tem de sobra.
  // 0,25 m em 40 m é a decimetria real dessa escala, e continua 8 vezes abaixo
  // do que a força cega de 3,2 aplicava.
  regolito: { fn: amostraRegolito, metros: 40, normalScale: 0.5,  relevoM: 0.25 },
  asfalto:  { fn: amostraAsfalto,  metros: 9,  normalScale: 0.7,  relevoM: 0.022 },
  calcada:  { fn: amostraCalcada,  metros: 6,  normalScale: 0.85, relevoM: 0.014 },
  campo:    { fn: amostraCampo,    metros: 7,  normalScale: 0.75, relevoM: 0.05 },
  concreto: { fn: amostraConcreto, metros: 10, normalScale: 0.5,  relevoM: 0.010 },
  pedra:    { fn: amostraPedra,    metros: 4,  normalScale: 0.9,  relevoM: 0.030 },
}

// ⚠️ ATRÁS DE BANDEIRA, e o motivo é o mesmo do `look.ts`: o bot de auto-commit
// empurra pra `origin/main` de hora em hora e a Vercel publica dali. Uma conta
// que muda o chão das seis superfícies da cidade inteira não estreia sem o
// fundador ver as duas chapas lado a lado. `?relevo=1` liga; sem ela, nada muda.
// Quando aprovar, o padrão inverte aqui e `?relevo=0` passa a ser a volta.
const RELEVO_FISICO =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('relevo') === '1'

// ⚠️ A BANDEIRA DESTA FRENTE. Mesmo motivo de `RELEVO_FISICO` acima: o bot de
// auto-commit publica pra `origin/main` de hora em hora, e uma receita nova
// pra superfície mais vista da cidade não estreia sem o fundador ver as duas
// chapas lado a lado. `?asfalto=1` liga a receita nova de `amostraAsfalto` e a
// camada de idade/procedência de `quebrarRepeticao`; sem ela, os dois ficam
// bit a bit como estavam antes desta rodada. Lida uma vez, no módulo, com a
// mesma guarda de SSR.
const ASFALTO_NOVO =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('asfalto') === '1'

// ── geração ─────────────────────────────────────────────────────────────────
function canvasDe(dados: Uint8ClampedArray): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.putImageData(new ImageData(dados, S, S), 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = anisotropia
  return tex
}

function gerar(nome: Superficie): Conjunto {
  // ⚠️ MEDIDO, NÃO ESTIMADO: o tempo de geração no boot, pro orçamento que a
  // frente asfalto pediu. Publicado no console no estilo da casa
  // (`decalques.ts`/`vias.ts` já fazem isso pras contas deles).
  const t0 = performance.now()
  const { fn, metros, normalScale, relevoM } = RECEITAS[nome]
  const alt = new Float32Array(S * S)
  const alb = new Uint8ClampedArray(S * S * 4)
  const rug = new Uint8ClampedArray(S * S * 4)

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      const a = fn(x / S, y / S)
      alt[i] = a.h
      alb[i * 4] = a.r; alb[i * 4 + 1] = a.g; alb[i * 4 + 2] = a.b; alb[i * 4 + 3] = 255
      const q = Math.max(0, Math.min(255, a.rug * 255))
      rug[i * 4] = q; rug[i * 4 + 1] = q; rug[i * 4 + 2] = q; rug[i * 4 + 3] = 255
    }
  }

  // normal por Sobel, com as bordas dando a volta pelo outro lado do ladrilho:
  // sem o wrap a emenda ganha um vinco de luz que aparece de longe.
  const nrm = new Uint8ClampedArray(S * S * 4)
  const at = (x: number, y: number) => alt[(((y % S) + S) % S) * S + (((x % S) + S) % S)]
  // 3,2 é o número único e cego que valia para as seis superfícies até 02/09.
  // Ver a nota longa em RECEITAS: com `?relevo=1` ele vira conta.
  const FORCA = RELEVO_FISICO ? (relevoM * S) / (8 * metros) : 3.2
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))
      let nx = -dx * FORCA, ny = -dy * FORCA, nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv; ny *= inv; nz *= inv
      const i = (y * S + x) * 4
      nrm[i] = (nx * 0.5 + 0.5) * 255
      nrm[i + 1] = (ny * 0.5 + 0.5) * 255
      nrm[i + 2] = (nz * 0.5 + 0.5) * 255
      nrm[i + 3] = 255
    }
  }

  const map = canvasDe(alb)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = canvasDe(nrm)
  normalMap.colorSpace = THREE.NoColorSpace
  const roughnessMap = canvasDe(rug)
  roughnessMap.colorSpace = THREE.NoColorSpace
  const ms = performance.now() - t0
  console.log(`[materiais] ${nome} gerado em ${ms.toFixed(1)} ms (${S}×${S}, 3 mapas: albedo/normal/rugosidade)`)
  return { map, normalMap, roughnessMap, metros, normalScale }
}

let anisotropia = 8
const cache = new Map<Superficie, Conjunto>()

/** Chamada UMA vez pela cena, depois do renderer existir: sem isso o ladrilho
 *  em ângulo raso (que é como se olha chão) vira papa a dez metros. */
export function setAnisotropia(n: number) {
  anisotropia = Math.max(1, Math.min(16, n))
  cache.forEach((c) => {
    c.map.anisotropy = anisotropia; c.map.needsUpdate = true
    c.normalMap.anisotropy = anisotropia; c.normalMap.needsUpdate = true
    c.roughnessMap.anisotropy = anisotropia; c.roughnessMap.needsUpdate = true
  })
}

/** O conjunto de mapas de uma superfície. Gerado na primeira chamada e
 *  compartilhado: dois módulos que pedem 'asfalto' recebem A MESMA textura, que
 *  é o que mantém a conta de texturas do renderer em pé. */
export function superficie(nome: Superficie): Conjunto {
  let c = cache.get(nome)
  if (!c) { c = gerar(nome); cache.set(nome, c) }
  return c
}

export interface VestirOpts {
  /** metros de mundo por ladrilho; o padrão é o da receita */
  metros?: number
  /** multiplica a força do normal da receita */
  normal?: number
  /** quebra a repetição com ruído de mundo (padrão: sim) */
  macro?: boolean
  /** escala do ruído de mundo, em metros (padrão 140) */
  macroMetros?: number
}

/** Veste um material com a superfície pedida. O `repeat` sai de `metros`, então
 *  quem chama NÃO precisa saber o tamanho do ladrilho: passa o tamanho do chão
 *  em metros e a função resolve.
 *
 *  ⚠️ O UV TEM DE SER EM METROS DE MUNDO. Esta função assume que a malha
 *  entrega UV em 0..1 sobre o seu próprio tamanho, e por isso recebe `mundo`:
 *  o lado do chão, em metros. Malha que já traz UV em metros passa `mundo = 1`. */
export function vestir(
  mat: THREE.MeshStandardMaterial,
  nome: Superficie,
  mundo: number,
  o: VestirOpts = {},
) {
  const c = superficie(nome)
  const metros = o.metros ?? c.metros
  const rep = Math.max(1, mundo / metros)
  // ⚠️ CLONE DA TEXTURA, NÃO DO CANVAS. Duas malhas de tamanhos diferentes
  // precisam de `repeat` diferente, e `repeat` mora na Texture. O clone divide a
  // MESMA imagem na GPU (o three sobe uma vez por `source`), então isto custa um
  // objeto JS, não um upload.
  const map = c.map.clone(); map.repeat.set(rep, rep); map.needsUpdate = true
  const nm = c.normalMap.clone(); nm.repeat.set(rep, rep); nm.needsUpdate = true
  const rm = c.roughnessMap.clone(); rm.repeat.set(rep, rep); rm.needsUpdate = true

  mat.map = map
  mat.normalMap = nm
  mat.roughnessMap = rm
  const f = c.normalScale * (o.normal ?? 1)
  mat.normalScale = new THREE.Vector2(f, f)
  // ⚠️ `roughness` continua valendo: no three ele MULTIPLICA o mapa. Deixar o
  // padrão 1.0 é o que faz o mapa mandar de verdade.
  mat.roughness = 1
  mat.metalness = 0
  mat.needsUpdate = true

  // ⚠️ `asfalto` LIGA A CAMADA DE IDADE/PROCEDÊNCIA, E SÓ ELA. Ver a nota
  // grande de `quebrarRepeticao`: o texto do shader não muda por causa disto
  // (a chave de cache continua uma só pras seis superfícies); o que muda é o
  // valor do uniforme que a função nova lê.
  if (o.macro !== false) {
    quebrarRepeticao(mat, o.macroMetros ?? 140, { asfalto: nome === 'asfalto' })
  }
}

// ⚠️ O LOTE DE PAVIMENTAÇÃO, EM METROS. Perto dos 227 m do quarteirão Bairro
// (`vias.ts`), de propósito (nota grande do cabeçalho, item 2): não é medida
// de obra nenhuma, é a decisão de fazer uma "frente de pavimentação" ler como
// algo do tamanho de um quarteirão da cidade, não um capricho de escala.
const LOTE_PAVIMENTACAO_M = 220

/** Modula o albedo por um ruído de baixíssima frequência em coordenada de mundo.
 *  É o que apaga a grade do ladrilho numa superfície de quilômetros.
 *
 *  ⚠️ TODOS COMPARTILHAM UM PROGRAMA. Ver a nota do cabeçalho: a chave de cache
 *  é fixa de propósito, senão cada material vira um shader novo. Como a escala
 *  entra por `uniform`, materiais com escalas diferentes ainda dividem o mesmo
 *  programa compilado.
 *
 *  ⚠️ `opts.asfalto` NUNCA MUDA O TEXTO DO SHADER, SÓ O VALOR DE UM UNIFORME.
 *  Isto é o que protege a regra da linha acima: se o texto mudasse por
 *  material, dois materiais com a MESMA `customProgramCacheKey` mas fontes
 *  DIFERENTES fariam o three servir o programa errado pro segundo que
 *  pedisse (o mesmo aviso que `vias.ts:477` já registrou pra chave dele). O
 *  bloco de idade/procedência (frente asfalto, 03/09) está sempre presente no
 *  texto quando `?asfalto=1` está ligado — pra TODAS as seis superfícies,
 *  igual — e o `if (uAsfalto > 0.5)` dentro dele é um branch por UNIFORME:
 *  toda a chamada de desenho de uma calçada, campo, concreto ou pedra toma o
 *  MESMO caminho (o uniforme não varia por fragmento dentro de um material),
 *  então o custo real do laço de Worley cai só em cima do asfalto. Sem
 *  `?asfalto=1`, o bloco nem existe no texto: o shader sai idêntico ao de
 *  antes desta rodada, pra qualquer superfície. */
export function quebrarRepeticao(
  mat: THREE.MeshStandardMaterial,
  metros = 140,
  opts: { asfalto?: boolean } = {},
) {
  const u = { value: 1 / Math.max(1, metros) }
  const uAsfalto = { value: opts.asfalto ? 1 : 0 }
  const uLote = { value: 1 / LOTE_PAVIMENTACAO_M }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMacro = u
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMacroXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMacroXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vMacroXZ;
uniform float uMacro;
float mrand(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mrand(i), mrand(i + vec2(1.0, 0.0)), u.x),
             mix(mrand(i + vec2(0.0, 1.0)), mrand(i + vec2(1.0, 1.0)), u.x), u.y);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 mp = vMacroXZ * uMacro;
  float m = mnoise(mp) * 0.62 + mnoise(mp * 3.1) * 0.26 + mnoise(mp * 9.3) * 0.12;
  diffuseColor.rgb *= mix(0.80, 1.16, m);
}`)
    if (ASFALTO_NOVO) {
      // ⚠️ ESTE BLOCO SÓ EXISTE NO TEXTO QUANDO A BANDEIRA DA FRENTE ASFALTO
      // ESTÁ LIGADA (`ASFALTO_NOVO`, lida uma vez no módulo). Ele é o mesmo
      // texto pras seis superfícies nas duas situações: bandeira desligada,
      // shader idêntico a antes; bandeira ligada, shader com este bloco em
      // TODAS elas, e só o uniforme `uAsfalto` distingue o asfalto do resto.
      // Nunca condicione este `if` a `opts.asfalto` sozinho: isso faria o
      // TEXTO variar por material com a MESMA chave de cache.
      shader.uniforms.uAsfalto = uAsfalto
      shader.uniforms.uLote = uLote
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uAsfalto;
uniform float uLote;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
{
  // ⚠️ IDADE E PROCEDÊNCIA (frente asfalto, 03/09, item 2 do cabeçalho de
  // materiais.ts). Célula jitterada em coordenada de MUNDO (Worley de 3×3
  // vizinhos): cada "lote de pavimentação" sorteia uma idade (mais escuro e
  // fechado = fresco; mais claro e aberto = oxidado) e a borda entre dois
  // lotes ganha uma aresta clara e fina, o agregado que a máquina deixa
  // exposto na emenda de duas frentes de obra. Nunca é grade reta (o jitter
  // por vizinho quebra o alinhamento), então não repete como desenho mesmo
  // vista de longe.
  if (uAsfalto > 0.5) {
    vec2 lp = vMacroXZ * uLote;
    vec2 lid = floor(lp), lf = fract(lp);
    float d1 = 99.0, d2 = 99.0, idadeLote = 0.0;
    for (int oy = -1; oy <= 1; oy++) {
      for (int ox = -1; ox <= 1; ox++) {
        vec2 viz = vec2(float(ox), float(oy));
        vec2 jit = vec2(mrand(lid + viz), mrand(lid + viz + 17.3));
        vec2 delta = viz + jit - lf;
        float d = dot(delta, delta);
        if (d < d1) { d2 = d1; d1 = d; idadeLote = mrand(lid + viz + 51.0); }
        else if (d < d2) { d2 = d; }
      }
    }
    float costura = 1.0 - smoothstep(0.0, 0.12, sqrt(d2) - sqrt(d1));
    diffuseColor.rgb *= mix(0.90, 1.08, idadeLote);
    diffuseColor.rgb *= mix(1.0, 1.06, costura);
  }
}`)
    }
  }
  mat.customProgramCacheKey = () => 'dogcity:macro'
  mat.needsUpdate = true
}

export function disposeMateriais() {
  cache.forEach((c) => { c.map.dispose(); c.normalMap.dispose(); c.roughnessMap.dispose() })
  cache.clear()
}
