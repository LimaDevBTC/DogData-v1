// ═══════════════════════════════════════════════════════════════════════════
// O DETALHE DE PERTO DO PARQUE DE INVERNO. Regra do fundador, ao pé da letra:
// "ele vai estar num canto, entao so precisa de detalhes absurdos se o user
// for ate ele... se pesar demais pro user entrar fica ruim". Este módulo
// existe só para isso: uma camada que SÓ liga dentro de um raio pequeno em
// torno da câmera, e que fora dele custa, na prática, zero.
//
// TRÊS SISTEMAS, UM `atualizar(camera)`:
//   1. acabamento de pista, o sulco "corduroy" que a máquina compactadora
//      deixa (fita nova, sobreposta à fita de cor que `inverno.ts` já
//      desenha, nunca a substitui)
//   2. decalques de neve (rastro de esqui, pegada de bota, monte de neve
//      empurrada, mancha de gelo), catálogo PRÓPRIO, mesma técnica de
//      `decalques.ts` (quad instanciado, atlas gerado em canvas, desenho no
//      fragmento) mas sem tocar naquele arquivo, o catálogo dele é de
//      regolito lunar, este é de neve
//   3. duas rochas de destaque (Sketchfab, granito real escaneado), perto da
//      base da estação e da chegada da pista, pra quando o jogador parar
//      exatamente ali
//
// ⚠️ LEITURA, NUNCA EDIÇÃO, de `inverno.ts`: só `PISTAS`, `Pista` e
// `INVERNO_ATIVO`, todos exportados de lá. `pontoEmRumo` (polar → cartesiano)
// NÃO é exportado por `inverno.ts`, então está duplicado aqui embaixo, a
// mesma prática que `materiais.ts`/`decalques.ts` já usam pra `hash2`/
// `vnoise` ("duplicada porque [o outro arquivo] não a exporta").
//
// ── TAREFA 1, A PESQUISA (WebSearch, antes de escrever qualquer linha) ──────
// "ski piste corduroy grooming pattern" + "snowcat grooming texture": o
// sulco nasce de um pente (tiller) atrás do snowcat, com dentes de 7,6 a
// 12,7 cm de comprimento (mtnequipment.com/news/types-of-snow-groomers…). A
// largura de uma passada de máquina fica entre 3 e 4 m pro tiller e até 6 m
// pro snowcat inteiro (skicatcompany.com, xelom.com). Os sulcos correm NO
// SENTIDO DA DESCIDA, a fonte é literal: "grooming passes go up and down
// the slopes, creating parallel lines that mimic the terrain and natural
// flow", por isso aqui eles seguem a TANGENTE local da pista, nunca uma
// grade de mundo: a pista já serpenteia (`inverno.ts`), e o sulco serpenteia
// junto de graça, sem precisar fingir curva nenhuma.
//
// ⚠️ O QUE A BUSCA NÃO DEVOLVEU, E POR ISSO É ESCOLHA DE PROJETO, NÃO
// MEDIÇÃO: nenhuma fonte publicou o PASSO entre sulcos (distância crista a
// crista) nem a PROFUNDIDADE do sulco. `PITCH_M = 0.08` (8 cm) fica dentro
// da ordem de grandeza do comprimento de dente encontrado (7,6-12,7 cm);
// `RELEVO_M_SULCO = 0.015` (15 mm de altura de crista) é da mesma ordem de
// uma marca de pneu, o suficiente pra dar volume perceptível de perto sem
// virar degrau. NÃO MEDIDO EM TELA, é o que peço no relatório final pra
// conferir.
//
// A leve ondulação que a tarefa pede ("reto ou ligeiramente ondulado
// seguindo a máquina") também não tem número publicado: é um seno de baixa
// frequência e amplitude pequena (`WOBBLE_AMP_M`/`WOBBLE_WAVELEN_M`), NÃO
// MEDIDO, only pra não deixar o sulco matematicamente reto demais.
//
// ── A TÉCNICA DO SULCO: TEXTURA, NÃO GEOMETRIA ──────────────────────────────
// A lição de `materiais.ts` vale aqui inteira: "um ladrilho só pode conter o
// que o olho não identifica individualmente". Um sulco de 8 cm de passo
// repetido por metros é textura, não feição, cabe num mapa de normal
// gerado uma vez em canvas (a MESMA técnica Sobel de `materiais.ts`,
// duplicada aqui porque `gerar()`/a função que faz o Sobel lá não é
// exportada), tileado por METROS REAIS (não por índice de vértice): a malha
// da fita nova entra com só 2 vértices por seção (igual a fita de cor de
// `inverno.ts`), e a UV de cada vértice já carrega a distância real em
// metros (através/comprimento) dividida pelo passo do sulco, o hardware
// repete a textura sozinho via `RepeatWrapping`. Nenhum onBeforeCompile,
// nenhum programa de shader novo: é `MeshStandardMaterial` cru com
// map+normalMap, o preço mais barato que existe nesta cena pra esse efeito.
//
// ── A TÉCNICA DO DECALQUE DE NEVE: A MESMA DE decalques.ts, CATÁLOGO NOVO ──
// Quad instanciado (`THREE.InstancedBufferGeometry`), 2 triângulos por
// decalque, um atlas único gerado em canvas (aqui 2×2 células de 256px, 4
// tipos, não 12, por isso o atlas cabe num quarto do tamanho), UM material
// com onBeforeCompile pra ler a célula certa do atlas por instância e
// inclinar o quad pela tangente local (`heightAt`, mesma técnica de
// `PASSO_GRAD` que `decalques.ts` já validou). A ÚNICA variação técnica
// deliberada: em vez de girar por ÂNGULO (`iRot`, como `decalques.ts` faz,
// que é certo pra decalque sem direção própria), os tipos direcionais daqui
// (rastro de esqui, monte de neve) recebem um VETOR de direção por
// instância (`iDir`, a tangente real da pista naquele ponto), mesma
// matemática, um seno/cosseno a menos por vértice, e sem chance de eu errar
// o sinal da rotação sem poder abrir o navegador pra conferir.
//
// ⚠️ A ARMADILHA QUE JÁ MORDEU ESTA CASA HOJE (grade regular aparecendo na
// imagem): NENHUM sistema aqui usa célula de grade sem jitter. Rastro e
// monte nascem por PASSO ao longo do COMPRIMENTO DE ARCO da pista (não uma
// grade XZ), com o ponto de amostra deslocado por jitter determinístico
// (hash de `[índice da pista, índice do passo, salt]`, nunca `Math.random`);
// gelo nasce de uma varredura de mundo, mas com o mesmo jitter dentro da
// célula que `decalques.ts` já validou; pegada nasce de trilhas curtas com
// zigue-zague, não de uma fileira reta.
//
// ── POR QUE NÃO FATIAR A VARREDURA (a lição de decalques.ts, aplicada ao
// contrário) ─────────────────────────────────────────────────────────────
// `decalques.ts` aprendeu, medindo, que uma varredura de mundo dentro do
// CONSTRUTOR pode travar o portão de carga da cidade inteira. O universo
// aqui é pequeno por construção: 7 pistas, ~9,5 km de comprimento somado
// (medido com o mesmo `gerarSerpentina` de `inverno.ts`, rodado em Node sem
// navegador, ver a tabela abaixo), não a cidade inteira. Mesmo assim, a
// ÚNICA parte que se parece com o erro de `decalques.ts` (uma varredura de
// GRADE DE MUNDO, pro gelo) fica FORA do construtor, adiada pro primeiro
// `atualizar()`, não porque eu tenha medido que é cara (não medi, não abro
// navegador), mas porque a casa já pagou esse preço uma vez por assumir
// "deve ser barato" sem medir, e não vale repetir a mesma aposta. Rastro,
// monte e pegada (parametrizados pelo COMPRIMENTO DA PISTA, não por grade)
// ficam no construtor, no mesmo espírito do que `buildInverno` já faz hoje
// (ele chama `heightAt` centenas de vezes de forma síncrona pra medir cada
// pista e pra plantar os penhascos, sem fatiar).
//
// ── MEDIDO EM NODE, SEM NAVEGADOR (script descartável, mesma geometria de
// `ESPECIFICACOES`/`gerarSerpentina` de inverno.ts, heightAt substituído por
// nada, só a malha 2D importa pra estas contas) ────────────────────────────
//   comprimento 2D somado das 7 pistas:                      9.474,1 m
//   triângulos da fita de sulco (Σ (amostras-1)·2, exato):       720
//   passos de 4 m ao longo do arco, nas 7 pistas somadas:       2.365
//   bbox das PISTAS + 150 m de margem:                  1.792 × 2.454 m
//   células de 30 m nessa bbox (pro gelo, varredura adiada):    4.920
// Os comprimentos 3D reais (com elevação) são um pouco maiores, a conta 2D
// SUBESTIMA levemente, nunca superestima, então os tetos abaixo (com
// desbaste determinístico pro teto, a mesma técnica de `TETO_ROCHA` em
// `inverno.ts`) continuam válidos como teto duro.
//
// ── ORÇAMENTO TOTAL, declarado, não escondido ───────────────────────────────
//   fita de sulco:            720 triângulos, 1 malha, 1 material padrão
//   atlas de neve:             2×2 células de 256 px = 512×512, 1,0 MiB base
//                              (~1,33 MiB com mipmap, mesma conta de
//                              decalques.ts: base·4/3)
//   decalques de neve:        teto duro 1.300 instâncias = 2.600 triângulos,
//                              1 chamada de desenho
//   rochas de destaque:       2 modelos únicos (Sketchfab, ver Tarefa 3),
//                              até 4 instâncias (2 posições × 2 rochas) =
//                              até 128.000 triângulos SE as 4 estiverem à
//                              vista ao mesmo tempo, é de longe o item mais
//                              pesado desta rodada, DECLARADO no relatório
//                              final pra o fundador decidir se é demais
//   tudo isso desligado, sempre, fora do raio de detalhe (Tarefa 4)
//
// Three.js puro (regra da casa: nada de react-three-fiber). Sem travessão.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { INVERNO_ATIVO, PISTAS, type Pista } from './inverno'

// ⚠️ CONSERTO DE 03/09, mesmo achado e mesma regra de `inverno.ts` e
// `estacao-inverno.ts`: `gltf.load()` pode travar sem nunca voltar. Aqui o
// efeito é menor (as 2 rochas de destaque simplesmente nunca apareceriam,
// sem erro nenhum no console), mas a mesma defesa se aplica.
function comLimiteDeTempo<T>(p: Promise<T>, ms: number, rotulo: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_res, rej) => setTimeout(
      () => rej(new Error(`${rotulo}: sem resposta em ${ms} ms (decodificador travado ou rede lenta)`)),
      ms,
    )),
  ])
}

// ── bandeira própria, E POR QUE ELA NÃO É UM PORTÃO ─────────────────────
// ⚠️ CORRIGIDO (revisão do coordenador): a primeira versão deste módulo
// exigia `?invdet=1` além de `?inverno=1` pra qualquer coisa aparecer. Isso
// era exatamente o erro contrário do que a tarefa pediu: quem visita
// `?inverno=1` sozinho, que é a forma normal de ver o parque, não veria
// nada deste trabalho, porque faltaria uma segunda bandeira que ninguém
// sabe que existe. O portão de custo certo já existe e é o raio de 120 m em
// `atualizar(camera)`: nada desenha até a câmera chegar perto, e isso já é
// o controle que a tarefa pediu ("opcional e barato de ligar/desligar por
// distância"). Uma bandeira em cima disso só esconde o trabalho de quem
// testar do jeito normal, não protege custo nenhum que o raio não proteja
// sozinho.
//
// A ÚNICA entrada deste módulo é `!INVERNO_ATIVO` (linha abaixo, em
// `buildInvernoDetalhe`): sem a montanha, sulco e decalque sobre um terreno
// sem parque não fariam sentido; com a montanha, este módulo aparece igual
// a ela, sem bandeira extra.
//
// A bandeira que sobra aqui é PRA DEPURAÇÃO, e no sentido invertido do que
// a primeira versão fazia: `?invdet=forcar` FORÇA a camada de detalhe a
// aparecer mesmo com a câmera longe (pista, decalques e rochas todos
// visíveis, ignorando o raio), pra o fundador conseguir uma chapa isolada
// deste módulo sem precisar navegar até o canto do mapa primeiro. Nunca uma
// trava: sem a bandeira, o padrão já é aparecer, governado só pelo raio.
const INVERNO_DETALHE_FORCAR =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('invdet') === 'forcar'

// ── geometria polar duplicada de inverno.ts (não exportada lá) ───────────
function pontoEmRumo(r: number, azGraus: number): [number, number] {
  const a = (azGraus * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

// ── hash determinístico local, mesma família de decalques.ts/inverno.ts:
// nunca Math.random, sempre função pura da posição/índice, pra a cidade
// nascer igual em toda visita sem nada salvo. ─────────────────────────────
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function hash3(a: number, b: number, salt: number): number {
  return hash01((a * 374761393) ^ (b * 668265263) ^ (salt * 2246822519))
}
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

// ═══════════════════════════════════════════════════════════════════════════
// TAREFA 1: A FITA DE SULCO ("corduroy")
// ═══════════════════════════════════════════════════════════════════════════

interface AmostraPista {
  x: number; z: number; y: number
  alongM: number
  dirX: number; dirZ: number
  ladoX: number; ladoZ: number
}

/** centro, tangente e lado de cada ponto de uma pista, com `y` real (a
 *  MESMA técnica de `construirFita`/`medirPista` em inverno.ts: raio+rumo →
 *  cartesiano, altura só vem de `heightAt`, nunca suposta). `lado` é
 *  `up × dir`, a mesma convenção de mão de `construirFita`. */
function amostrarPista(p: Pista, heightAt: (x: number, z: number) => number): AmostraPista[] {
  const centros = p.pontos.map((pt) => {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    return { x, z, y: heightAt(x, z) }
  })
  const out: AmostraPista[] = []
  let along = 0
  for (let i = 0; i < centros.length; i++) {
    const atual = centros[i]
    let dirX: number, dirZ: number
    if (i === 0) { dirX = centros[1].x - centros[0].x; dirZ = centros[1].z - centros[0].z }
    else if (i === centros.length - 1) { dirX = centros[i].x - centros[i - 1].x; dirZ = centros[i].z - centros[i - 1].z }
    else { dirX = centros[i + 1].x - centros[i - 1].x; dirZ = centros[i + 1].z - centros[i - 1].z }
    const dl = Math.hypot(dirX, dirZ) || 1
    dirX /= dl; dirZ /= dl
    const ladoX = dirZ, ladoZ = -dirX // up(0,1,0) × dir, igual construirFita
    if (i > 0) along += Math.hypot(atual.x - centros[i - 1].x, atual.z - centros[i - 1].z)
    out.push({ x: atual.x, z: atual.z, y: atual.y, alongM: along, dirX, dirZ, ladoX, ladoZ })
  }
  return out
}

/** interpola posição/tangente/lado num `alongM` arbitrário dentro da
 *  amostragem (busca linear: cada pista tem no máximo ~90 amostras, não
 *  vale a pena uma árvore pra isso). */
function amostraEm(amostras: AmostraPista[], alongM: number): AmostraPista | null {
  if (alongM < 0 || alongM > amostras[amostras.length - 1].alongM) return null
  for (let i = 1; i < amostras.length; i++) {
    if (amostras[i].alongM >= alongM) {
      const a = amostras[i - 1], b = amostras[i]
      const span = b.alongM - a.alongM
      const t = span > 1e-6 ? (alongM - a.alongM) / span : 0
      return {
        x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t,
        alongM,
        dirX: a.dirX + (b.dirX - a.dirX) * t, dirZ: a.dirZ + (b.dirZ - a.dirZ) * t,
        ladoX: a.ladoX + (b.ladoX - a.ladoX) * t, ladoZ: a.ladoZ + (b.ladoZ - a.ladoZ) * t,
      }
    }
  }
  return amostras[amostras.length - 1]
}

// ⚠️ acima da fita de cor de `inverno.ts` (`LEVANTE_FITA`, hoje 0,5 m, lido
// em inverno.ts na função `construirFita`, PRIVADO, não exportado, então
// não posso importar o número, só ficar acima dele com folga). 5 cm de
// folga + `polygonOffset` mais agressivo que o da fita (-2,-2 contra -1,-1)
// garantem a ordem certa mesmo que aquele valor mude um pouco. NÃO MEDIDO
// em tela, é um dos itens do "o que eu quero ver" no relatório final.
const ALTURA_OVERLAY = 0.55
const PITCH_M = 0.08 // passo do sulco, ver a nota da Tarefa 1 no cabeçalho
const WOBBLE_AMP_M = 0.03 // NÃO MEDIDO: deriva lateral do operador, pequena de propósito
const WOBBLE_WAVELEN_M = 16 // NÃO MEDIDO: comprimento de onda dessa deriva

function construirCorduroy(pistas: Pista[], amostrasPorPista: AmostraPista[][]): { geometry: THREE.BufferGeometry; triangulos: number } {
  const pos: number[] = [], nor: number[] = [], uv: number[] = []
  const idx: number[] = []
  let triangulos = 0
  for (let pi = 0; pi < pistas.length; pi++) {
    const p = pistas[pi]
    const amostras = amostrasPorPista[pi]
    const meia = p.largura / 2
    const base = pos.length / 3
    for (const a of amostras) {
      const wob = WOBBLE_AMP_M * Math.sin((a.alongM * Math.PI * 2) / WOBBLE_WAVELEN_M)
      for (const lado of [-1, 1]) {
        const cross = lado * meia
        pos.push(a.x + a.ladoX * cross, a.y + ALTURA_OVERLAY, a.z + a.ladoZ * cross)
        nor.push(0, 1, 0)
        uv.push((cross + wob) / PITCH_M, a.alongM / PITCH_M)
      }
    }
    const n = amostras.length
    for (let i = 0; i < n - 1; i++) {
      const l0 = base + i * 2, r0 = base + i * 2 + 1, l1 = base + (i + 1) * 2, r1 = base + (i + 1) * 2 + 1
      idx.push(l0, l1, r0, r0, l1, r1)
      triangulos += 2
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  return { geometry: geo, triangulos }
}

const CORD_TEX_W = 64, CORD_TEX_H = 8
const RELEVO_M_SULCO = 0.015 // NÃO MEDIDO: altura de crista, ver o cabeçalho

/** mapa de albedo + normal do sulco, UM período (0..1 = um passo `PITCH_M`
 *  de mundo), constante ao longo de V, o mesmo Sobel de `materiais.ts`
 *  (`gerar`, não exportado de lá, por isso duplicado aqui), com `dy=0`
 *  porque o perfil não varia ao longo do comprimento. */
function gerarCorduroyTex(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const alt = new Float32Array(CORD_TEX_W)
  for (let x = 0; x < CORD_TEX_W; x++) alt[x] = 0.5 + 0.5 * Math.sin(((x + 0.5) / CORD_TEX_W) * Math.PI * 2)
  const at = (x: number) => alt[((x % CORD_TEX_W) + CORD_TEX_W) % CORD_TEX_W]
  // FORÇA física, mesma fórmula de materiais.ts (relevoM·S/(8·metros)): aqui
  // "metros" é o próprio passo do sulco, PITCH_M.
  const FORCA = (RELEVO_M_SULCO * CORD_TEX_W) / (8 * PITCH_M)
  const alb = new Uint8ClampedArray(CORD_TEX_W * CORD_TEX_H * 4)
  const nrm = new Uint8ClampedArray(CORD_TEX_W * CORD_TEX_H * 4)
  for (let y = 0; y < CORD_TEX_H; y++) {
    for (let x = 0; x < CORD_TEX_W; x++) {
      const h = alt[x]
      const tom = 0.94 + h * 0.10 // crista um pouco mais clara, vale um pouco mais fundo
      const i = (y * CORD_TEX_W + x) * 4
      const v = Math.round(235 * tom)
      alb[i] = v; alb[i + 1] = v; alb[i + 2] = Math.min(255, v + 4); alb[i + 3] = 255
      const dx = at(x + 1) - at(x - 1)
      let nx = -dx * FORCA, ny = 0, nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv; ny *= inv; nz *= inv
      nrm[i] = Math.round((nx * 0.5 + 0.5) * 255)
      nrm[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      nrm[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      nrm[i + 3] = 255
    }
  }
  const cvA = document.createElement('canvas'); cvA.width = CORD_TEX_W; cvA.height = CORD_TEX_H
  cvA.getContext('2d')!.putImageData(new ImageData(alb, CORD_TEX_W, CORD_TEX_H), 0, 0)
  const map = new THREE.CanvasTexture(cvA)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  const cvN = document.createElement('canvas'); cvN.width = CORD_TEX_W; cvN.height = CORD_TEX_H
  cvN.getContext('2d')!.putImageData(new ImageData(nrm, CORD_TEX_W, CORD_TEX_H), 0, 0)
  const normalMap = new THREE.CanvasTexture(cvN)
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
  normalMap.colorSpace = THREE.NoColorSpace
  return { map, normalMap }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAREFA 2: DECALQUES DE NEVE (catálogo próprio, técnica de decalques.ts)
// ═══════════════════════════════════════════════════════════════════════════

interface Amostra { a: number; r: number; g: number; b: number }

function tRastro(u: number, v: number): Amostra {
  // dois sulcos de esqui, paralelos ao eixo "ao longo" (U aqui, ver a nota
  // do cabeçalho sobre iDir): duas bandas escuras em V constante
  const d1 = Math.abs(v - 0.30), d2 = Math.abs(v - 0.70)
  const a = Math.max(smooth(0.12, 0.02, d1), smooth(0.12, 0.02, d2))
  const tom = 0.80
  return { a: a * 0.85, r: 214 * tom, g: 222 * tom, b: 232 * tom }
}

function tMonte(u: number, v: number): Amostra {
  // neve empurrada pra fora da pista: crista clara perto de v=0.35, sombra
  // logo abaixo (v=0.55..0.8), corpo inteiro esmaece nas pontas de U
  const corpo = smooth(0.0, 0.12, u) * smooth(1.0, 0.88, u) * smooth(0.02, 0.18, v) * smooth(0.98, 0.8, v)
  const crista = smooth(0.15, 0.32, v) * smooth(0.5, 0.34, v)
  const sombra = smooth(0.45, 0.58, v) * smooth(0.85, 0.62, v)
  const tom = 1.10 * crista + 0.85 * sombra + 1.0 * (1 - crista - sombra)
  return { a: corpo, r: 240 * tom, g: 244 * tom, b: 250 * tom }
}

function tPegada(u: number, v: number): Amostra {
  // pegada de bota: uma elipse (sola) + uma menor no calcanhar, sombra de
  // neve compactada, mais escura que a neve ao redor
  const dx = (u - 0.5) / 0.34, dz = (v - 0.44) / 0.46
  const sola = dx * dx + dz * dz
  const dx2 = (u - 0.5) / 0.30, dz2 = (v - 0.86) / 0.30
  const salto = dx2 * dx2 + dz2 * dz2
  const a = Math.max(1 - smooth(0.85, 1.0, sola), 1 - smooth(0.85, 1.0, salto))
  const tom = 0.72
  return { a: a * 0.8, r: 200 * tom, g: 208 * tom, b: 220 * tom }
}

function tGelo(u: number, v: number): Amostra {
  // mancha irregular de gelo exposto: fbm limiarizado, branco-azulado,
  // mais claro/brilhante que a neve comum (sem carga especular própria,
  // ver a nota do material, mas a diferença de tom já lê como "duro")
  const n = fbm(u * 5 + 11, v * 5 + 11, 3)
  const raio = Math.hypot(u - 0.5, v - 0.5)
  const a = smooth(0.5, 0.28, raio) * smooth(0.30, 0.55, n)
  return { a, r: 222, g: 234, b: 248 }
}

interface TipoNeve {
  nome: string
  cel: number
  sAlong: number
  sCross: number
  pintar: (u: number, v: number) => Amostra
}
const TIPOS_NEVE: TipoNeve[] = [
  { nome: 'rastro', cel: 0, sAlong: 2.6, sCross: 0.5, pintar: tRastro },
  { nome: 'monte', cel: 1, sAlong: 3.0, sCross: 1.0, pintar: tMonte },
  { nome: 'pegada', cel: 2, sAlong: 0.32, sCross: 0.30, pintar: tPegada },
  { nome: 'gelo', cel: 3, sAlong: 1.1, sCross: 0.9, pintar: tGelo },
]
const NEVE_GRID = 2
const NEVE_CEL_PX = 256
const NEVE_ATLAS_PX = NEVE_GRID * NEVE_CEL_PX

function gerarAtlasNeve(): THREE.CanvasTexture {
  const dados = new Uint8ClampedArray(NEVE_ATLAS_PX * NEVE_ATLAS_PX * 4)
  for (const tipo of TIPOS_NEVE) {
    const gx = tipo.cel % NEVE_GRID, gy = Math.floor(tipo.cel / NEVE_GRID)
    const ox = gx * NEVE_CEL_PX, oy = gy * NEVE_CEL_PX
    for (let py = 0; py < NEVE_CEL_PX; py++) {
      for (let px = 0; px < NEVE_CEL_PX; px++) {
        const u = (px + 0.5) / NEVE_CEL_PX, v = (py + 0.5) / NEVE_CEL_PX
        const s = tipo.pintar(u, v)
        const ix = ((oy + py) * NEVE_ATLAS_PX + (ox + px)) * 4
        dados[ix] = s.r; dados[ix + 1] = s.g; dados[ix + 2] = s.b
        dados[ix + 3] = Math.max(0, Math.min(255, s.a * 255))
      }
    }
  }
  const cv = document.createElement('canvas'); cv.width = NEVE_ATLAS_PX; cv.height = NEVE_ATLAS_PX
  cv.getContext('2d')!.putImageData(new ImageData(dados, NEVE_ATLAS_PX, NEVE_ATLAS_PX), 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping // células isoladas, mesma razão de decalques.ts
  tex.anisotropy = 8
  return tex
}

interface CandidatoNeve {
  x: number; z: number
  dirX: number; dirZ: number
  sAlong: number; sCross: number
  cel: number; flip: number
  tintR: number; tintG: number; tintB: number
}

const TETO_NEVE: Record<string, number> = { rastro: 500, monte: 400, pegada: 150, gelo: 250 }
const TETO_NEVE_TOTAL = Object.values(TETO_NEVE).reduce((a, b) => a + b, 0) // 1.300
const PASSO_GRAD_NEVE = 0.4 // mesmo passo de decalques.ts: decalque pequeno, gradiente local

/** desbasta uma lista pro teto do tipo, MESMA técnica de `TETO_ROCHA` em
 *  inverno.ts (mantém uma fração determinística por hash, não corta do fim,
 *  senão o desbaste ficaria concentrado num pedaço só do mapa). */
function desbastar<T>(lista: T[], teto: number, salt: number): T[] {
  if (lista.length <= teto) return lista
  const manter = teto / lista.length
  return lista.filter((_, i) => hash01(i * 2654435761 + salt) < manter)
}

function gerarCandidatosArco(pistas: Pista[], amostrasPorPista: AmostraPista[][]): { rastro: CandidatoNeve[]; monte: CandidatoNeve[] } {
  const rastro: CandidatoNeve[] = [], monte: CandidatoNeve[] = []
  const STEP = 4.0
  // jitter seguro: r ≤ (STEP − maior sAlong)/2. O maior sAlong do catálogo
  // direcional é 'monte' (3,0 m) → r ≤ (4,0−3,0)/2 = 0,5 m; uso 0,45 m com
  // folga (mesmo espírito da folga de 0,08 m de decalques.ts sobre o limite
  // teórico).
  const JITTER_ARCO = 0.45
  for (let pi = 0; pi < pistas.length; pi++) {
    const p = pistas[pi]
    const amostras = amostrasPorPista[pi]
    const totalLen = amostras[amostras.length - 1].alongM
    const nPassos = Math.floor(totalLen / STEP)
    for (let s = 0; s < nPassos; s++) {
      const alvo = (s + 0.5) * STEP + (hash3(pi, s, 1) - 0.5) * 2 * JITTER_ARCO
      const a = amostraEm(amostras, alvo)
      if (!a) continue
      for (let lane = 0; lane < 2; lane++) {
        if (hash3(pi, s, 10 + lane) > 0.30) continue
        const sinal = lane === 0 ? -1 : 1
        const faixa = Math.max(0.3, p.largura * 0.5 - 1.2)
        const lateral = sinal * (0.6 + hash3(pi, s, 20 + lane) * faixa)
        const esc = 0.85 + hash3(pi, s, 30 + lane) * 0.3
        const tinta = 0.94 + hash3(pi, s, 35 + lane) * 0.10
        rastro.push({
          x: a.x + a.ladoX * lateral, z: a.z + a.ladoZ * lateral,
          dirX: a.dirX, dirZ: a.dirZ, sAlong: 2.6 * esc, sCross: 0.5 * esc,
          cel: 0, flip: hash3(pi, s, 40 + lane) > 0.5 ? 1 : 0,
          tintR: tinta, tintG: tinta, tintB: tinta,
        })
      }
      for (let borda = 0; borda < 2; borda++) {
        if (hash3(pi, s, 50 + borda) > 0.55) continue
        const sinal = borda === 0 ? -1 : 1
        const lateral = sinal * (p.largura / 2 - 0.5 + hash3(pi, s, 60 + borda) * 0.6)
        const esc = 0.85 + hash3(pi, s, 70 + borda) * 0.3
        const tinta = 0.97 + hash3(pi, s, 75 + borda) * 0.08
        monte.push({
          x: a.x + a.ladoX * lateral, z: a.z + a.ladoZ * lateral,
          dirX: a.dirX, dirZ: a.dirZ, sAlong: 3.0 * esc, sCross: 1.0 * esc,
          cel: 1, flip: 0, tintR: tinta, tintG: tinta, tintB: tinta,
        })
      }
    }
  }
  return { rastro: desbastar(rastro, TETO_NEVE.rastro, 101), monte: desbastar(monte, TETO_NEVE.monte, 103) }
}

/** trilhas curtas de pegada perto de um ponto (a estação/base): poucas
 *  linhas, zigue-zague esquerda/direita, nunca uma fileira reta. */
function gerarCandidatosPegada(cx: number, cz: number): CandidatoNeve[] {
  const out: CandidatoNeve[] = []
  const TRILHAS = 5, PASSOS = 7, PASSO_M = 0.62
  for (let t = 0; t < TRILHAS; t++) {
    const ang = (t / TRILHAS) * Math.PI * 2 + hash3(t, 0, 200) * 0.6
    const dirX = Math.sin(ang), dirZ = Math.cos(ang)
    const ladoX = dirZ, ladoZ = -dirX
    let along = 1.2 + hash3(t, 1, 201) * 2
    for (let k = 0; k < PASSOS; k++) {
      along += PASSO_M * (0.85 + hash3(t, k, 202) * 0.3)
      const lado = (k % 2 === 0 ? 1 : -1) * 0.14
      const x = cx + dirX * along + ladoX * lado
      const z = cz + dirZ * along + ladoZ * lado
      const tinta = 0.95 + hash3(t, k, 203) * 0.08
      out.push({
        x, z, dirX, dirZ, sAlong: 0.32, sCross: 0.30, cel: 2,
        flip: k % 2, tintR: tinta, tintG: tinta, tintB: tinta,
      })
    }
  }
  return desbastar(out, TETO_NEVE.pegada, 205)
}

/** manchas de gelo: varredura de grade de MUNDO, mas só chamada uma vez, de
 *  fora do construtor (ver a nota do cabeçalho sobre não repetir o erro
 *  medido em decalques.ts). Elegibilidade: dentro da zona esquiável de
 *  verdade (`zonaEsquiavelAt`, passada como opção, nunca importando
 *  `inverno.ts` pra isso, como a tarefa pediu) E inclinação local acima de
 *  um limiar, um pouco ABAIXO do limiar de rocha exposta de `inverno.ts`
 *  (30°, ver `fatorRochaAt`), porque a faixa de transição pouco antes da
 *  rocha nua é exatamente onde a neve fica mais compactada e vira gelo.
 *  ESCOLHA DE PROJETO (26°), não medição. */
function gerarCandidatosGelo(
  amostrasTodas: { x: number; z: number }[],
  heightAt: (x: number, z: number) => number,
  zonaEsquiavelAt: (x: number, z: number) => number,
): CandidatoNeve[] {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of amostrasTodas) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z) }
  const MARGEM = 150, CEL = 30
  minX -= MARGEM; maxX += MARGEM; minZ -= MARGEM; maxZ += MARGEM
  const out: CandidatoNeve[] = []
  const PASSO_INC = 6
  for (let x = minX; x < maxX; x += CEL) {
    for (let z = minZ; z < maxZ; z += CEL) {
      const jx = x + CEL * 0.5 + (hash2(Math.round(x), Math.round(z)) - 0.5) * CEL * 0.8
      const jz = z + CEL * 0.5 + (hash2(Math.round(z), Math.round(x)) - 0.5) * CEL * 0.8
      const zona = zonaEsquiavelAt(jx, jz)
      if (zona < 0.4) continue
      const dhx = (heightAt(jx + PASSO_INC, jz) - heightAt(jx - PASSO_INC, jz)) / (2 * PASSO_INC)
      const dhz = (heightAt(jx, jz + PASSO_INC) - heightAt(jx, jz - PASSO_INC)) / (2 * PASSO_INC)
      const inc = (Math.atan(Math.hypot(dhx, dhz)) * 180) / Math.PI
      if (inc < 26) continue
      const ang = hash2(Math.round(jx * 10), Math.round(jz * 10)) * Math.PI * 2
      const esc = 0.8 + hash2(Math.round(jx * 7), Math.round(jz * 7)) * 0.5
      out.push({
        x: jx, z: jz, dirX: Math.sin(ang), dirZ: Math.cos(ang),
        sAlong: 1.1 * esc, sCross: 0.9 * esc, cel: 3,
        flip: hash2(Math.round(jx * 3), Math.round(jz * 3)) > 0.5 ? 1 : 0,
        tintR: 0.99, tintG: 1.0, tintB: 1.03,
      })
    }
  }
  return desbastar(out, TETO_NEVE.gelo, 401)
}

// ═══════════════════════════════════════════════════════════════════════════
// A ASSINATURA
// ═══════════════════════════════════════════════════════════════════════════

export interface InvernoDetalheOpts {
  /** ⚠️ Mesma exigência de todo módulo que encosta no chão nesta cena: use
   *  `terrain.superficieAt`, não uma função contínua crua. */
  heightAt: (x: number, z: number) => number
  /** `inverno.ts` já exporta isto; passe direto (`zonaEsquiavelAt` de
   *  `inverno.ts`). Sem ela, o tipo 'gelo' não nasce (aviso no console, o
   *  resto do módulo sobe normalmente), é a "peça a função como parâmetro"
   *  que a tarefa pediu, pra este arquivo nunca importar `inverno.ts` além
   *  de `PISTAS`/`Pista`/`INVERNO_ATIVO`. */
  zonaEsquiavelAt?: (x: number, z: number) => number
  /** ponto (x,z) da estação/vila-base, pras pegadas de bota e pra uma das
   *  duas rochas de destaque. Se omitido, usa o fim da 'Pista Verde de
   *  Acesso' (o ponto onde `PISTAS` já converge pra base), lido de
   *  `PISTAS`, nunca um número fixo meu. */
  estacao?: { x: number; z: number }
  /** o loader DA CENA, já com DRACOLoader, mesma exigência de
   *  `InvernoOpts.gltf`. Sem ele, as rochas de destaque não sobem (avisado
   *  no console); o resto do módulo (pista, decalque) sobe normal. */
  gltf?: GLTFLoader
  sombra?: boolean
  /** raio do anel de detalhe, em metros. Ver a Tarefa 4 no relatório final
   *  pra a escolha do valor padrão, pode vir IGUAL ou MENOR que o raio da
   *  floresta/rocha em massa que a frente de carregamento está definindo. */
  raio?: number
}

export interface InvernoDetalhe {
  group: THREE.Group
  /** triângulos ATIVOS agora (fita fixa + decalques desenhando + rochas
   *  visíveis), muda a cada `atualizar`, como em decalques.ts/inverno.ts. */
  triangulos: number
  /** teto duro dos três sistemas, pro relatório e pro `?stats=1`: fita
   *  (fixo), decalques (instâncias × 2 tri), rocha (se as 4 estiverem à
   *  vista ao mesmo tempo). */
  pistaTriangulos: number
  decalTrianguloTeto: number
  rochaTrianguloTeto: number
  atlasMiB: number
  /** chame no laço de quadro; só refaz quando a câmera anda mais que
   *  `PASSO_REFAZ`, mesmo padrão de mobiliario-urbano.ts. */
  atualizar(camera: THREE.Camera): void
  dispose(): void
}

const RAIO_DETALHE_PADRAO = 120 // ver a Tarefa 4 no relatório
const PASSO_REFAZ = 20 // menor que os 30-40 m dos módulos de escala de cidade,
// porque RAIO_DETALHE aqui também é menor, refazer mais cedo evita "pop" de
// um raio já pequeno. NÃO MEDIDO em navegador, escolha proporcional.

export function buildInvernoDetalhe(o: InvernoDetalheOpts): InvernoDetalhe {
  const group = new THREE.Group()
  group.name = 'inverno-detalhe'
  const disposeveis: { dispose(): void }[] = []

  const resultado: InvernoDetalhe = {
    group, triangulos: 0, pistaTriangulos: 0, decalTrianguloTeto: 0, rochaTrianguloTeto: 0, atlasMiB: 0,
    atualizar() {}, dispose() { group.clear() },
  }
  if (!INVERNO_ATIVO) return resultado

  const RAIO = o.raio ?? RAIO_DETALHE_PADRAO
  const heightAt = o.heightAt

  // ── amostragem compartilhada das 7 pistas (usada pela fita, pelos
  // candidatos de rastro/monte e pra achar a bbox do gelo) ────────────────
  const amostrasPorPista = PISTAS.map((p) => amostrarPista(p, heightAt))
  const amostrasTodas: { x: number; z: number }[] = []
  for (const lista of amostrasPorPista) for (const a of lista) amostrasTodas.push({ x: a.x, z: a.z })

  // ── ponto da estação/base, dado ou lido de PISTAS (nunca um número fixo
  // meu, ver InvernoDetalheOpts.estacao) ──────────────────────────────────
  const pistaVerde = PISTAS.find((p) => p.dificuldade === 'verde') ?? PISTAS[PISTAS.length - 1]
  const pontoVerde = pistaVerde.pontos[pistaVerde.pontos.length - 1]
  const [evX, evZ] = pontoEmRumo(pontoVerde.r, pontoVerde.az)
  const estacao = o.estacao ?? { x: evX, z: evZ }
  // "chegada da pista": o fim da pista preta principal (a mais longa, quem
  // desce até mais perto da base), lido de PISTAS pelo nome que o próprio
  // catálogo publica, não uma coordenada inventada aqui.
  const pistaChegada = PISTAS.find((p) => p.nome === 'Descida do Mar da Tranquilidade') ?? PISTAS[0]
  const pontoChegada = pistaChegada.pontos[pistaChegada.pontos.length - 1]
  const [chX, chZ] = pontoEmRumo(pontoChegada.r, pontoChegada.az)

  // ═══ TAREFA 1: fita de sulco ═══
  const { geometry: geoCord, triangulos: triCord } = construirCorduroy(PISTAS, amostrasPorPista)
  const { map: cordMap, normalMap: cordNormal } = gerarCorduroyTex()
  const matCord = new THREE.MeshStandardMaterial({
    map: cordMap, normalMap: cordNormal, normalScale: new THREE.Vector2(1, 1),
    roughness: 0.82, metalness: 0, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })
  const meshCord = new THREE.Mesh(geoCord, matCord)
  meshCord.name = 'inverno-detalhe:corduroy'
  meshCord.receiveShadow = o.sombra ?? true
  meshCord.castShadow = false
  meshCord.renderOrder = 3 // depois da fita de cor (que já usa polygonOffset -1,-1)
  meshCord.visible = false // atualizar() liga
  group.add(meshCord)
  disposeveis.push({ dispose() { geoCord.dispose(); matCord.dispose(); cordMap.dispose(); cordNormal.dispose() } })

  // ═══ TAREFA 2: decalques de neve ═══
  const atlasNeve = gerarAtlasNeve()
  const atlasMiB = (NEVE_ATLAS_PX * NEVE_ATLAS_PX * 4 * (4 / 3)) / (1024 * 1024)

  const baseQuad = new THREE.PlaneGeometry(1, 1)
  baseQuad.rotateX(-Math.PI / 2)
  const geoNeve = new THREE.InstancedBufferGeometry()
  geoNeve.setIndex(baseQuad.getIndex())
  geoNeve.setAttribute('position', baseQuad.getAttribute('position'))
  geoNeve.setAttribute('normal', baseQuad.getAttribute('normal'))
  geoNeve.setAttribute('uv', baseQuad.getAttribute('uv'))

  const iOff = new Float32Array(TETO_NEVE_TOTAL * 2)
  const iY = new Float32Array(TETO_NEVE_TOTAL)
  const iGrad = new Float32Array(TETO_NEVE_TOTAL * 2)
  const iDir = new Float32Array(TETO_NEVE_TOTAL * 2)
  const iSize = new Float32Array(TETO_NEVE_TOTAL * 2)
  const iCel = new Float32Array(TETO_NEVE_TOTAL)
  const iFlip = new Float32Array(TETO_NEVE_TOTAL)
  const iTint = new Float32Array(TETO_NEVE_TOTAL * 3)
  const attrOff = new THREE.InstancedBufferAttribute(iOff, 2); attrOff.setUsage(THREE.DynamicDrawUsage)
  const attrY = new THREE.InstancedBufferAttribute(iY, 1); attrY.setUsage(THREE.DynamicDrawUsage)
  const attrGrad = new THREE.InstancedBufferAttribute(iGrad, 2); attrGrad.setUsage(THREE.DynamicDrawUsage)
  const attrDir = new THREE.InstancedBufferAttribute(iDir, 2); attrDir.setUsage(THREE.DynamicDrawUsage)
  const attrSize = new THREE.InstancedBufferAttribute(iSize, 2); attrSize.setUsage(THREE.DynamicDrawUsage)
  const attrCel = new THREE.InstancedBufferAttribute(iCel, 1); attrCel.setUsage(THREE.DynamicDrawUsage)
  const attrFlip = new THREE.InstancedBufferAttribute(iFlip, 1); attrFlip.setUsage(THREE.DynamicDrawUsage)
  const attrTint = new THREE.InstancedBufferAttribute(iTint, 3); attrTint.setUsage(THREE.DynamicDrawUsage)
  geoNeve.setAttribute('iOff', attrOff)
  geoNeve.setAttribute('iY', attrY)
  geoNeve.setAttribute('iGrad', attrGrad)
  geoNeve.setAttribute('iDir', attrDir)
  geoNeve.setAttribute('iSize', attrSize)
  geoNeve.setAttribute('iCel', attrCel)
  geoNeve.setAttribute('iFlip', attrFlip)
  geoNeve.setAttribute('iTint', attrTint)
  geoNeve.instanceCount = 0
  geoNeve.boundingSphere = new THREE.Sphere(new THREE.Vector3((minMax(amostrasTodas, 'x')[0] + minMax(amostrasTodas, 'x')[1]) / 2, 0, (minMax(amostrasTodas, 'z')[0] + minMax(amostrasTodas, 'z')[1]) / 2), 3000)

  const ALTURA_DECAL = 0.02 // mesmo epsilon medido/herdado por lotes.ts/decalques.ts
  const ALTURA_DECAL_PISTA = ALTURA_OVERLAY + ALTURA_DECAL + 0.02 // acima do sulco também

  const matNeve = new THREE.MeshStandardMaterial({
    roughness: 0.80, metalness: 0, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  })
  matNeve.map = atlasNeve
  matNeve.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        attribute vec2 iOff;
        attribute float iY;
        attribute vec2 iGrad;
        attribute vec2 iDir;
        attribute vec2 iSize;
        attribute float iCel;
        attribute float iFlip;
        attribute vec3 iTint;
        varying vec3 vTintNeve;
      `)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        vec3 objectNormal = normalize(vec3(-iGrad.x, 1.0, -iGrad.y));
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        vec2 alongVec = iDir;
        vec2 crossVec = vec2(-iDir.y, iDir.x);
        vec2 local = position.xz;
        vec2 off = alongVec * (local.x * iSize.x) + crossVec * (local.y * iSize.y);
        vec2 wxz = iOff + off;
        float hy = iY + iGrad.x * off.x + iGrad.y * off.y;
        vec3 transformed = vec3(wxz.x, hy, wxz.y);
        vTintNeve = iTint;
        float _gx = mod(iCel + 0.5, ${NEVE_GRID.toFixed(1)});
        float _gy = floor((iCel + 0.5) / ${NEVE_GRID.toFixed(1)});
        vec2 uvLocal = uv;
        if (iFlip > 0.5) uvLocal.x = 1.0 - uvLocal.x;
        #ifdef USE_MAP
          vMapUv = (vec2(_gx, _gy) + uvLocal) / ${NEVE_GRID.toFixed(1)};
        #endif
      `)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        varying vec3 vTintNeve;
      `)
      .replace('#include <map_fragment>', /* glsl */`
        #include <map_fragment>
        diffuseColor.rgb *= vTintNeve;
      `)
  }
  matNeve.customProgramCacheKey = () => 'dogcity:neve-decal'
  matNeve.name = 'neve-decal'

  const meshNeve = new THREE.Mesh(geoNeve, matNeve)
  meshNeve.name = 'inverno-detalhe:decalques-neve'
  meshNeve.frustumCulled = false
  meshNeve.receiveShadow = o.sombra ?? true
  meshNeve.castShadow = false
  meshNeve.renderOrder = 4
  group.add(meshNeve)
  disposeveis.push({ dispose() { geoNeve.dispose(); matNeve.dispose(); atlasNeve.dispose(); baseQuad.dispose() } })

  // candidatos síncronos (comprimento de pista, universo pequeno e medido,
  // ver o cabeçalho): rastro, monte, pegada. Gelo fica pro primeiro
  // `atualizar` (ver a nota longa do cabeçalho sobre não repetir o erro
  // medido em decalques.ts).
  const { rastro, monte } = gerarCandidatosArco(PISTAS, amostrasPorPista)
  const pegada = gerarCandidatosPegada(estacao.x, estacao.z)
  let gelo: CandidatoNeve[] = []
  let geloPronto = false

  function calcularGrad(x: number, z: number) {
    const h0 = heightAt(x, z)
    const hx = heightAt(x + PASSO_GRAD_NEVE, z)
    const hz = heightAt(x, z + PASSO_GRAD_NEVE)
    return { h: h0, dx: (hx - h0) / PASSO_GRAD_NEVE, dz: (hz - h0) / PASSO_GRAD_NEVE }
  }

  // todos os candidatos, com a altura+gradiente já resolvidos (uma vez só,
  // não muda depois, só a VISIBILIDADE muda por distância em atualizar).
  interface Pronto { x: number; z: number; y: number; gx: number; gz: number; dirX: number; dirZ: number; sAlong: number; sCross: number; cel: number; flip: number; tintR: number; tintG: number; tintB: number; sobrePista: boolean }
  function preparar(cands: CandidatoNeve[], sobrePista: boolean): Pronto[] {
    return cands.map((c) => {
      const g = calcularGrad(c.x, c.z)
      return { x: c.x, z: c.z, y: g.h, gx: g.dx, gz: g.dz, dirX: c.dirX, dirZ: c.dirZ, sAlong: c.sAlong, sCross: c.sCross, cel: c.cel, flip: c.flip, tintR: c.tintR, tintG: c.tintG, tintB: c.tintB, sobrePista }
    })
  }
  let prontosRastro = preparar(rastro, true)
  let prontosMonte = preparar(monte, true)
  let prontosPegada = preparar(pegada, false)
  let prontosGelo: Pronto[] = []

  function escreverInstancia(k: number, p: Pronto) {
    iOff[k * 2] = p.x; iOff[k * 2 + 1] = p.z
    iY[k] = p.y + (p.sobrePista ? ALTURA_DECAL_PISTA : ALTURA_DECAL)
    iGrad[k * 2] = p.gx; iGrad[k * 2 + 1] = p.gz
    iDir[k * 2] = p.dirX; iDir[k * 2 + 1] = p.dirZ
    iSize[k * 2] = p.sAlong; iSize[k * 2 + 1] = p.sCross
    iCel[k] = p.cel
    iFlip[k] = p.flip
    iTint[k * 3] = p.tintR; iTint[k * 3 + 1] = p.tintG; iTint[k * 3 + 2] = p.tintB
  }

  // ═══ TAREFA 3: rochas de destaque (Sketchfab, ver relatório pro crédito) ═══
  const grupoRochas = new THREE.Group()
  grupoRochas.name = 'inverno-detalhe:rochas'
  grupoRochas.visible = false
  group.add(grupoRochas)
  let rochaTrianguloTeto = 0
  if (o.gltf) {
    const carregar = (arquivo: string) => comLimiteDeTempo(
      new Promise<THREE.Group>((res, rej) => o.gltf!.load(`/city/sf/${arquivo}`, (g) => res(g.scene), undefined, rej)),
      8000, `[inverno-detalhe] ${arquivo}`,
    )
    Promise.all([carregar('inverno-rocha-granito-a.glb'), carregar('inverno-rocha-granito-b.glb')])
      .then(([cenaA, cenaB]) => {
        let malhaA: THREE.Mesh | null = null, malhaB: THREE.Mesh | null = null
        cenaA.traverse((k) => { if (!malhaA && (k as THREE.Mesh).isMesh) malhaA = k as THREE.Mesh })
        cenaB.traverse((k) => { if (!malhaB && (k as THREE.Mesh).isMesh) malhaB = k as THREE.Mesh })
        if (!malhaA || !malhaB) { console.error('[inverno-detalhe] um dos GLBs de rocha carregou sem mesh dentro.'); return }
        const geoA = (malhaA as THREE.Mesh).geometry, matA = (malhaA as THREE.Mesh).material as THREE.Material
        const geoB = (malhaB as THREE.Mesh).geometry, matB = (malhaB as THREE.Mesh).material as THREE.Material
        const triA = geoA.index ? geoA.index.count / 3 : geoA.attributes.position.count / 3
        const triB = geoB.index ? geoB.index.count / 3 : geoB.attributes.position.count / 3

        const posicionar = (geo: THREE.BufferGeometry, mat: THREE.Material, cx: number, cz: number, offAng: number, offR: number, giro: number, esc: number) => {
          const x = cx + Math.cos(offAng) * offR, z = cz + Math.sin(offAng) * offR
          const y = heightAt(x, z)
          const mesh = new THREE.Mesh(geo, mat)
          mesh.position.set(x, y, z)
          mesh.rotation.y = giro
          mesh.scale.setScalar(esc)
          mesh.castShadow = o.sombra ?? true
          mesh.receiveShadow = true
          mesh.name = 'inverno-detalhe:rocha'
          grupoRochas.add(mesh)
        }
        // duas posições (estação e chegada), uma rocha de cada em cada
        // posição, 4 instâncias, ESCALA e GIRO variando pra não ler como
        // carimbo (mesma disciplina de inverno.ts com rocks-stylized-pack).
        // Offsets de 12 a 18 m, NÃO MEDIDO contra a caixa real da vila/
        // estação (privada, não exportada), generoso de propósito pra não
        // encostar em nada.
        posicionar(geoA, matA, estacao.x, estacao.z, 2.1, 14, 0.4, 1.0)
        posicionar(geoB, matB, estacao.x, estacao.z, 4.6, 17, 2.6, 1.05)
        posicionar(geoB, matB, chX, chZ, 1.0, 15, 0.9, 0.95)
        posicionar(geoA, matA, chX, chZ, 3.4, 18, 4.2, 1.1)

        rochaTrianguloTeto = 2 * triA + 2 * triB
        resultado.rochaTrianguloTeto = rochaTrianguloTeto
        console.log(`[inverno-detalhe] rochas de destaque: 2 modelos únicos (granito-a ${triA} tri, granito-b ${triB} tri), 4 instâncias, teto ${rochaTrianguloTeto.toLocaleString('pt-BR')} triângulos se as 4 estiverem à vista`)
      })
      .catch((e) => console.error('[inverno-detalhe] rochas de destaque NÃO CARREGARAM (inverno-rocha-granito-a/b.glb).', e))
  } else {
    console.warn('[inverno-detalhe] sem `gltf`: as rochas de destaque não sobem.')
  }

  console.log(
    `[inverno-detalhe] fita de sulco ${triCord.toLocaleString('pt-BR')} triângulos; ` +
    `atlas de neve ${NEVE_ATLAS_PX}×${NEVE_ATLAS_PX} (${atlasMiB.toFixed(2)} MiB), ${TIPOS_NEVE.length} tipos, ` +
    `teto ${TETO_NEVE_TOTAL.toLocaleString('pt-BR')} instâncias (rastro ${prontosRastro.length}, monte ${prontosMonte.length}, ` +
    `pegada ${prontosPegada.length}, gelo adiado); raio de detalhe ${RAIO} m`
  )

  // ── atualizar: um único gate de movimento pros três sistemas ────────────
  const alvo = new THREE.Vector3()
  const camAnterior = new THREE.Vector3(1e9, 1e9, 1e9)
  let primeira = true
  const lista: { p: Pronto; d: number }[] = []

  function atualizar(camera: THREE.Camera) {
    camera.getWorldPosition(alvo)

    if (!geloPronto && o.zonaEsquiavelAt) {
      // ⚠️ ADIADO PRA CÁ, DE PROPÓSITO: ver a nota longa do cabeçalho sobre
      // não repetir, sem medir, a aposta que já custou caro em decalques.ts.
      // Roda uma vez só, no primeiro quadro em que `atualizar` é chamado,
      // nunca dentro do construtor síncrono.
      gelo = gerarCandidatosGelo(amostrasTodas, heightAt, o.zonaEsquiavelAt)
      prontosGelo = preparar(gelo, false)
      geloPronto = true
      console.log(`[inverno-detalhe] gelo: ${prontosGelo.length} manchas candidatas (varredura adiada pro 1º atualizar)`)
    } else if (!geloPronto) {
      geloPronto = true // sem zonaEsquiavelAt, gelo nunca nasce, aviso já dado no construtor
      console.warn('[inverno-detalhe] sem `zonaEsquiavelAt`: o tipo \'gelo\' não nasce.')
    }

    const moveu = primeira || alvo.distanceToSquared(camAnterior) >= PASSO_REFAZ * PASSO_REFAZ
    if (!moveu) return
    primeira = false
    camAnterior.copy(alvo)

    // fita de sulco: visível se a câmera está a menos de RAIO de QUALQUER
    // amostra de QUALQUER pista (busca linear em ~367 pontos, trivial), OU
    // se `?invdet=forcar` está pedindo a camada inteira pra uma chapa de
    // teste isolada (ver a nota da bandeira no cabeçalho).
    const r2 = RAIO * RAIO
    let pertoPista = INVERNO_DETALHE_FORCAR
    if (!pertoPista) {
      for (const a of amostrasTodas) {
        const dx = a.x - alvo.x, dz = a.z - alvo.z
        if (dx * dx + dz * dz < r2) { pertoPista = true; break }
      }
    }
    meshCord.visible = pertoPista

    // rochas: visíveis se perto da estação OU da chegada (ou forçado)
    const dEst = (alvo.x - estacao.x) ** 2 + (alvo.z - estacao.z) ** 2
    const dCheg = (alvo.x - chX) ** 2 + (alvo.z - chZ) ** 2
    grupoRochas.visible = INVERNO_DETALHE_FORCAR || dEst < r2 || dCheg < r2

    // decalques: junta os quatro tipos, filtra por raio (ou tudo, se
    // forçado; o teto de instâncias abaixo continua valendo do mesmo jeito),
    // escreve até o teto
    lista.length = 0
    const todos: Pronto[] = [...prontosRastro, ...prontosMonte, ...prontosPegada, ...prontosGelo]
    for (const p of todos) {
      const dx = p.x - alvo.x, dz = p.z - alvo.z
      const d = dx * dx + dz * dz
      if (INVERNO_DETALHE_FORCAR || d < r2) lista.push({ p, d })
    }
    lista.sort((a, b) => a.d - b.d)
    const n = Math.min(lista.length, TETO_NEVE_TOTAL)
    for (let k = 0; k < n; k++) escreverInstancia(k, lista[k].p)
    geoNeve.instanceCount = n
    attrOff.needsUpdate = true; attrY.needsUpdate = true; attrGrad.needsUpdate = true
    attrDir.needsUpdate = true; attrSize.needsUpdate = true; attrCel.needsUpdate = true
    attrFlip.needsUpdate = true; attrTint.needsUpdate = true

    resultado.triangulos = (pertoPista ? triCord : 0) + n * 2 + (grupoRochas.visible ? rochaTrianguloTeto : 0)
  }

  function dispose() {
    for (const d of disposeveis) d.dispose()
    grupoRochas.traverse((k) => {
      const mesh = k as THREE.Mesh
      if (mesh.isMesh) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }
    })
    group.clear()
  }

  resultado.pistaTriangulos = triCord
  resultado.decalTrianguloTeto = TETO_NEVE_TOTAL * 2
  resultado.atlasMiB = atlasMiB
  resultado.atualizar = atualizar
  resultado.dispose = dispose
  return resultado
}

function minMax(pts: { x: number; z: number }[], eixo: 'x' | 'z'): [number, number] {
  let mn = Infinity, mx = -Infinity
  for (const p of pts) { const v = eixo === 'x' ? p.x : p.z; mn = Math.min(mn, v); mx = Math.max(mx, v) }
  return [mn, mx]
}
