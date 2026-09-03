// ═══════════════════════════════════════════════════════════════════════════
// O PARQUE DE INVERNO: a região montanhosa do maciço oeste esculpida em pista
// profissional, snowboard park, halfpipe e teleféricos. Pedido do fundador,
// palavra por palavra: "quero que aquela região montanhosa seja mexida e lá
// temos que ter o parque de inverno. Pista de esqui profissional, snowboarding,
// nível top 1 mundo hoje. Se preciso aumente a elevação, crie as montanhas,
// mas isso é inegociável."
//
// ⚠️ ATRÁS DE `?inverno=1`, SEM EXCEÇÃO, pelo mesmo motivo de `terreno-fino.ts`:
// o bot de auto-commit publica de hora em hora. `INVERNO_ATIVO` é lido uma vez,
// no módulo, com a mesma guarda de `typeof window`. `alturaInvernoAt` devolve 0
// na primeira linha quando a bandeira está desligada, e `x + 0 === x` em ponto
// flutuante IEEE754 não tem exceção: `terrain.ts` soma este retorno a
// `heightAt` exatamente como soma `microRelevoAt`, e sem a bandeira a soma é
// bit a bit a mesma conta de hoje. A prova está no teste offline descrito no
// relatório, não neste arquivo.
//
// ── TAREFA 1, RESPONDIDA ANTES DE DESENHAR QUALQUER PISTA ───────────────────
// A abóbada é uma calota esférica (`dome.ts`, `DOME_R = 9050`). Medido com a
// geometria REAL (`crown - rim = f`, `Rc = (R² + f²) / 2f`, `yc = crown - Rc`,
// `casca(r) = yc + sqrt(Rc² - min(r,R)²)`), com os valores que `plaza-scene.tsx`
// de fato passa hoje (`crown: 2619`, `rim: 53`, logo `f = 2566`):
//
//   pico medido por `alpino.ts` (x=-8234, z=-902, r=8283,3 m): 321,7 m
//   casca no mesmo raio, hoje (f=2566):                        499,1 m
//   folga:                                                     177,4 m livres
//
// NÃO FURA. O pico de hoje já mora dentro da casca, com margem. Isto foi
// medido duas vezes por duas frentes independentes (esta e a frente da casca)
// e bateu: 499,1 contra 499 m, 177,4 contra 177 m.
//
// Mas o parque top 1 mundo pede muito mais altura que 321,7 m (ver Tarefa 2),
// e a casca de hoje (f=2566) não aguenta uma montanha maior: a folga cai para
// 130,7 m já em r=8.500 e para -183,7 m (FURA) em r=9.050, o raio da própria
// casca. A frente da casca abriu a forma para mudança e propõe uma flecha
// maior; este módulo foi projetado para `f = 5.500` (crown = 5.553, rim = 53),
// que mede:
//
//   casca em r=8.283 com f=5.500:                            1.302,4 m
//   folga sobre o pico de HOJE (321,7 m):                      980,7 m
// O cume novo (busca real em `heightAt`, não suposto) nasce em r=8.330,
// azimute 268°, com 1.065,9 m. A casca no mesmo raio (f=5.500) mede 1.236,4 m:
// folga de 170,5 m livres, medida, não estimada.
//
// ⚠️ ACHADO SEPARADO, E É UM DEFEITO QUE JÁ EXISTE HOJE, sem este módulo e sem
// qualquer flecha nova: o RIM da casca (53 m) é FIXO por construção, porque a
// calota sempre passa por `(0, crown)` e `(DOME_R, rim)`, então `casca(DOME_R) = rim`
// SEMPRE, não importa a flecha. O terreno real do maciço oeste, medido hoje
// sem nenhuma montanha nova, já passa de 280 m nos últimos 200 m antes da
// borda (r > 8.700, pior rumo ~251-277°) e a casca ali despenca para 53 m no
// limite: a 9.050 m o terreno mede até 289,9 m contra uma casca de 53 m, ou
// seja **-236,9 m, JÁ FURADO, hoje, sem eu ter tocado em nada**. Aumentar a
// flecha empurra o cruzamento para fora (de r≈8.700 com f=2.566 para r≈8.925
// com f=5.500, medido) mas não apaga o problema, porque o rim continua em
// 53 m nos dois casos. Isto não é problema meu de resolver (não teria como,
// sem mudar `rim` ou a régua do pódio, e as duas são de `dome.ts`): é um
// aviso para quem for fechar a casca. Este módulo fica DELIBERADAMENTE dentro
// de r ≤ 8.650, uma boa margem antes de onde a fratura de hoje começa em
// QUALQUER das duas flechas medidas, para não empilhar problema sobre problema.
//
// ── A PERGUNTA DE PROJETO: crescer ONDE ESTÁ ou migrar para dentro? ─────────
// Medido: migrar para dentro (r < 7.150) esbarra em DOIS obstáculos reais, não
// hipotéticos. Primeiro, urbanístico: `public/city/cidade.json` → `programa`
// já tem a Floresta de Extrativismo do Poente (VP02, 107,52 ha) centrada em
// r=6.762, rumo 236°, e o Reservatório e as Hortas do Poente mais perto ainda
// (r=4.530 e 4.700). Segundo, e mais duro: o PRÓPRIO PÓDIO DA ABÓBADA
// (`dome.ts` → `PODIO_R0..R3`, que `terrain.ts` já aplica) nivela à força o
// anel de r=6.150 a 8.300 até a cota 13 m, com peso PLENO (100%) entre 6.950 e
// 7.150, que é a antiga borda da casca menor, hoje uma cicatriz plana no meio
// da cidade. Qualquer relevo que eu somasse ali seria multiplicado por
// `(1 - peso)` e devolvido quase zero: medido, 97,8% de supressão em r=7.250,
// caindo a 17% em r=8.000 e a 2% só em r=8.200. A montanha não pode nascer no
// meio dessa faixa, ela seria apagada pela própria fundação da cidade.
//
// A RECOMENDAÇÃO: a montanha CRESCE ONDE ESTÁ, no arco oeste (rumo 248° a
// 288°, que cobre com folga os 251-277° onde o terreno de hoje já é mais alto
// em qualquer raio medido). O anel de 6.150 a 8.100 m, que o pódio já deixa
// plano, vira a PISTA VERDE DE ACESSO e a vila-base (estação, garagem dos
// teleféricos): um uso, não um desperdício, do nivelamento que já existe. A
// montanha de verdade (a crista, os ombros, os corredores) mora de r≈8.150 a
// r≈8.650, onde o pódio já solta a mão (supressão ≤ 5%) e a Floresta do
// Poente não chega.
//
// ── TAREFA 2, AS NORMAS, CONFERIDAS (WebSearch, não copiadas de memória) ────
// Desnível de homologação FIS, por disciplina, nível olímpico/Copa do Mundo:
//   descida (downhill), masculino:      até 1.100 m       (feminino: até 800 m)
//   super-G, nível olímpico/CM:         400 a 650 m (masc), 400 a 600 m (fem)
//   slalom gigante:                     250 a 450 m (masc), 250 a 400 m (fem)
//   slalom:                             180 a 220 m (masc), 140 a 220 m (fem)
//   halfpipe olímpico:                  parede 22 pés = 6,71 m; ~600 pés =
//                                        182,9 m de comprimento; rampa 16-18°
//   slopestyle:                         6 módulos típicos (3 saltos + 3 rails)
//   snowboardcross (boardercross):      percurso 800-1.200 m, desnível
//                                        100-250 m, declive médio 7-11°
// Classificação por inclinação (gradiente), sem g nenhum na conta: verde até
// ~16-25%, azul 25-40%, vermelha até ~47%, preta 40%+ sem teto fixado por
// norma nenhuma. Fontes no relatório final.
//
// Conclusão da Tarefa 2: o parque PRECISA de pelo menos ~900-1.100 m de
// desnível para a descida (a peça mais exigente) ler como "top 1 mundo" de
// verdade. O sítio de hoje tem 311 m de relevo natural (321,7 pico menos
// 10,6 mediana). A diferença, os outros ~600 a 800 m, é a montanha que este
// módulo esculpe, somando ao relevo real, não substituindo.
//
// ── TAREFA 3, A CONTA DE 1/6 g, E ELA É O PARTIDO DE ARTE DO PARQUE ─────────
// g_lua = 1,625 m/s² (o mesmo valor de `plano-diretor.md` § 5.3, não 1,62: a
// razão balística de lá, 6,035 = 9,81/1,625, é reaproveitada aqui ponto a
// ponto para não introduzir uma segunda constante concorrente no mesmo
// projeto). Três perguntas, três contas:
//
// 1. "Uma pista preta na Terra continua preta aqui?" A CLASSIFICAÇÃO não muda:
//    verde/azul/vermelha/preta é definida por GRADIENTE (subida/percurso), uma
//    razão geométrica que não tem g dentro. Uma rampa de 40% de inclinação é
//    preta na Terra e continua sendo preta na Lua, pela letra da norma.
//    Mas a ACELERAÇÃO que essa rampa produz, a·sin(θ), SIM muda, e por um
//    fator duro: a(θ) = g·sen(θ). Numa rampa de θ=21,8° (40%, preta de
//    entrada), a Terra dá 9,81×0,371 = 3,64 m/s²; a Lua dá 1,625×0,371 =
//    0,60 m/s². Pior: o TETO físico da aceleração lunar, numa parede vertical
//    hipotética de 90°, é o próprio g_lua = 1,625 m/s², e isso é MENOS do que
//    uma pista VERDE terrestre de 9,54° (16,8% de rampa) já produz
//    (9,81×sen(9,54°) = 1,625 m/s², a igualdade exata). Conclusão dura e
//    honesta: NENHUMA inclinação lunar, nem a mais vertical, reproduz a
//    aceleração de uma pista azul, vermelha ou preta terrestre. "Inclinação
//    equivalente" não existe para além do próprio limite físico da Lua. A
//    dificuldade de uma pista preta lunar não pode vir de g-force de reta:
//    tem que vir de percurso comprido (a velocidade final por conservação de
//    energia, v = √(2·g·h), só depende do DESNÍVEL, não da inclinação nem de
//    g diretamente no expoente (cai só com √6,035 = 2,457, não com 6,035),
//    de curva técnica estreita e de neve rala. Por isso este módulo faz a
//    pista SERPENTEAR (ver `AUTORIA_PISTAS`), não descer na linha de maior
//    declive: é o jeito de ganhar percurso sem exigir rampa impossível do
//    relevo.
//
// 2. "Um halfpipe de parede de 6,7 m projetado pra Terra faz o que a 1/6 g?"
//    A parede (a curva de transição) não muda: ela é geometria de quadris e
//    joelhos, não de queda livre, e `plano-diretor.md` já fixou esse
//    princípio no skatepark ("coping e muro ficam iguais"). O que muda é a
//    conversão de VELOCIDADE DE SAÍDA em ALTURA DE VOO, h = v²/(2g), para o
//    MESMO impulso muscular (que não depende de g: perna empurra igual aqui e
//    lá). O recorde mundial de amplitude num superpipe de 22 pés é 8,04 m
//    (Joffrey Pollet-Villard, Mundial FIS 2015). Na Lua, o MESMO impulso que
//    produziu 8,04 m na Terra produz 8,04 × 6,035 = 48,5 m de voo LIVRE acima
//    do coping. A parede de 6,7 m continua sendo a parede; o que precisa
//    crescer 6 vezes é o CÉU acima dela.
//
// 3. "Qual é a dimensão CERTA de halfpipe, mesa de salto e boardercross pra
//    Lua?" Resposta, com a mesma régua (parede/rampa iguais à Terra, envelope
//    de voo × 6,035):
//      halfpipe:  parede 6,71 m (igual), pé-a-pé 182,9 m (igual: ver Tarefa 3
//                 nota abaixo sobre por que o comprimento NÃO escala),
//                 folga de ar exigida acima do coping: 48,5 m (era 8,04 m)
//      mesa de salto (kicker/table): mesma rampa de saída (mesmo ângulo, ~30
//                 a 40 graus, igual à Terra: é a geometria do lip, não a
//                 física da queda), MAS o alcance R = v²·sen(2φ)/g escala por
//                 6,035 para a MESMA velocidade de entrada: uma mesa que na
//                 Terra manda o atleta a 25 m manda a 150,9 m aqui. A zona de
//                 pouso (knuckle) tem que ser 6,035× mais comprida, ou a
//                 velocidade de entrada tem que cair para 1/√6,035 = 40,7%
//                 da terrestre para pousar no mesmo lugar (opção que este
//                 módulo NÃO escolhe: a mesa lunar é a mesa que só existe
//                 aqui, então ela é a mesa longa, não a mesa capada)
//      boardercross: percurso 800-1.200 m (igual: é bitola de pista, não
//                 física de projétil) com saltos e rolos cujo alcance também
//                 escala por 6,035, exatamente como a mesa de salto acima
//
//    ⚠️ POR QUE O COMPRIMENTO DO HALFPIPE NÃO ESCALA (a pegadinha da conta
//    ingênua): para uma rampa de comprimento L e inclinação θ CONSTANTES, a
//    velocidade de saída por conservação de energia é v² = 2·g·sen(θ)·L, e a
//    altura de voo é h = v²/(2g) = sen(θ)·L: o g DOS DOIS LADOS DA CONTA
//    SE CANCELA. Se a velocidade vier de queda livre pela MESMA rampa (não de
//    impulso muscular extra), o comprimento do half-pipe não precisa mudar
//    nem um metro: o voo já sai maior sozinho, de graça, só porque a Lua devolve
//    de volta a mesma altura da queda, e essa é a "moeda" desta seção do plano
//    diretor. O fator 6,035 só aparece quando alguém ADICIONA energia por
//    músculo (pump) por cima da queda livre, e é exatamente aí, na
//    amplitude do pump, não no desenho do cano, que a Lua paga o prêmio.
//
// Este é o partido de arte do parque inteiro: não é uma estação alpina
// copiada da Terra posta na Lua, é a estação que SÓ poderia nascer aqui,
// onde a queda dá o dobro e meio de altura de volta de graça (√6,035), o
// pump multiplica por seis inteiros, e a pista precisa de percurso, não de
// parede vertical, porque a própria gravidade não empresta o "murro" que uma
// preta terrestre empresta de graça.
//
// ═══════════════════════════════════════════════════════════════════════════
// SEGUNDA CORREÇÃO DO FUNDADOR, MESMO DIA (03/09): "as montanha ta bem feia,
// parece uma repetição de blocos, 4 na sequência, um maior que outro". O
// diagnóstico do coordenador foi exato: eu esculpia por PERFIL RADIAL com
// cosseno de um lado e potência do outro, e somava alguns "ombros" (cumes
// COLOCADOS por fórmula, com espaçamento angular parecido). Cosseno é
// periódico por definição; somar N cumes parecidos e igualmente espaçados
// produz exatamente "blocos em fileira". A conta estava certa, a FAMÍLIA de
// função estava errada: montanha de verdade é o que sobra depois da erosão,
// não uma soma de bumps colocados.
//
// ⚠️ E A PRIMEIRA INSTRUÇÃO PARA CONSERTAR ISSO (ruído multifractal com
// crista + deformação de domínio) TAMBÉM FOI CORRIGIDA, na sequência, pelo
// mesmo motivo que já tinha corrigido a sequoia horas antes: esta casa tem
// API do Sketchfab conectada (`blender/sketchfab_fetch.py`), e um scan
// fotogramétrico real de montanha JÁ CARREGA erosão de verdade (vale
// ramificado, crista irregular, sela de altura variável) que ruído
// procedural não sabe imitar de graça. A ordem certa, dita pelo fundador:
// BUSQUE PRIMEIRO, meça, e só use ruído no que o acervo não resolver.
//
// ⚠️ O QUE FOI BUSCADO E MEDIDO, não suposto:
//   `weisse-wand-mountain.glb`   scan CC-BY de Shahriar Shahrabi, pico
//                                austríaco Weisse Wand (2.517 m de verdade),
//                                444.814 faces cru, decimado pra 15.000 aqui
//   `zwoelfernock-mountain.glb`  mesmo autor, pico Zwölfernock (2.516 m),
//                                534.842 faces cru, decimado pra 15.000
// Os DOIS scans crus (pré-conversão, `blender/assets-sketchfab/*/scene.gltf`
// + `.bin`, glTF simples sem DRACO) foram assados OFFLINE (script Python,
// não neste arquivo) numa grade de altura 96×96, MESMA ideia do heightmap
// SLDEM2015 que `terrain.ts` já usa pro sítio inteiro: rasteriza a nuvem de
// vértices num grid, guarda só a altura normalizada. O resultado mora em
// `./dados/relevo-weisse-wand.json` e `./dados/relevo-zwoelfernock.json`
// (import estático, `resolveJsonModule` já ligado no tsconfig: estes dados
// entram no bundle, sem fetch, sem quebrar a pureza síncrona de
// `alturaInvernoAt`).
//
// ⚠️ AS DUAS FEIÇÕES ENTRAM TRÊS VEZES (`FEICOES` abaixo), NÃO DUAS: o
// Zwölfernock uma vez como pico principal, o Weisse Wand duas vezes, em
// posição/giro/escala DIFERENTES cada uma. Reusar a mesma fonte com
// transform diferente é a técnica normal de "stamps" de terreno de
// verdade (é a mesma lógica das 9 sequoias diferentes resolvendo a floresta
// hoje): o que gera repetição não é reusar dado, é reusar POSIÇÃO e ESCALA
// junto. Cada uma das 3 feições tem centro, giro e raio próprios, medidos
// contra o layout do maciço, não copiados.
//
// ⚠️ RUÍDO ENTRA SÓ COMO TEMPERO, DEPOIS: `temperoFino` é ridged multifractal
// de verdade (fórmula do Musgrave/libnoise: `signal = (1 - |ruído|)²`, peso
// do próximo octave realimentado pelo `signal` do anterior, não persistência
// fixa) mais deformação de domínio (a coordenada de amostragem é deslocada
// por outro ruído de célula grande ANTES de qualquer coisa, pra quebrar o
// alinhamento radial que o perfil ainda tem). A amplitude dele é pequena
// contra a das feições reais: ele preenche a escala fina que 96×96 não
// resolve, não desenha a montanha.
//
// ⚠️ A PISTA CONTINUA CAVADA, E A CAVA AGORA TAMBÉM SUPRIME O TEMPERO por
// perto do eixo, não só soma profundidade fixa por cima: relevo com ruído de
// verdade embaixo de uma cava de profundidade constante ainda mostraria
// solavanco, porque subtrair uma constante não achata bump. `pistaPeso`
// (0..1) desliga `temperoFino` perto da fita ANTES do corte entrar, então a
// pista fica lisa como uma pista preparada de verdade, sem virar
// montanha-russa.
// ═══════════════════════════════════════════════════════════════════════════

// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { DistanceCuller, PerfProfile } from './perf'
// dados assados offline (script Python, fora deste arquivo) dos dois scans
// fotogramétricos reais: ver a nota "SEGUNDA CORREÇÃO" acima
import relevoWeisseWand from './dados/relevo-weisse-wand.json'
import relevoZwoelfernock from './dados/relevo-zwoelfernock.json'

// ── A BANDEIRA ───────────────────────────────────────────────────────────────
export const INVERNO_ATIVO =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('inverno') === '1'

// ── A GEOGRAFIA, EM NÚMERO (ver a conta completa no cabeçalho) ──────────────
/** o pico medido por `alpino.ts`, tal como está hoje, sem este módulo */
export const PICO_MEDIDO = { x: -8234, z: -902, r: 8283.3, azimuteGraus: 264 }

/** janela angular da crista nova, em rumo (0 = -Z, sentido horário) */
const AZ0 = 248
const AZ1 = 288

/** bandas radiais do perfil, redesenhado em 03/09 depois da chapa reprovar
 *  a montanha como duna sem aresta. A versão anterior tinha um PLANALTO
 *  (R_CRISTA0 a R_CRISTA1, 270 m de topo achatado): é exatamente isso que lê
 *  como cúpula de areia. Uma crista de verdade é uma ARESTA, não um platô:
 *  um raio SÓ no topo (R_CRISTA_PICO), subida mansa de um lado (o versante
 *  esquiável, para a cidade) e queda ABRUPTA do outro (a face de rocha, para
 *  fora). R_PE é o pé, dentro do anel que o pódio da abóbada já deixa
 *  plano; R_QUEDA é onde a adição volta a zero, antes da fratura de borda
 *  medida na Tarefa 1. */
const R_PE = 7150
const R_CRISTA_PICO = 8280
const R_QUEDA = 8650
/** expoente da face de rocha: mantém a curva perto de 1 quase até o topo e
 *  desaba no último trecho, o oposto do suave01 puro. Continua valendo:
 *  isto é o envelope de EXISTÊNCIA (onde o maciço pode aparecer), não a
 *  forma fina dele, que agora vem das feições reais abaixo. */
const EXP_FACE_ROCHA = 2.4

function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

/** diferença angular mínima entre dois rumos em graus, sempre em [-180,180] */
function difAngulo(a: number, b: number): number {
  let d = (a - b) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function azimuteDe(x: number, z: number): number {
  const a = (Math.atan2(x, -z) * 180) / Math.PI
  return (a + 360) % 360
}

// ── ruído determinístico local (mesmo esquema de hash de `alpino.ts`, sem
// importar de lá: os dois módulos não precisam compartilhar estado, e cada
// hash tem semente própria) ──────────────────────────────────────────────
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function hash2(ix: number, iz: number, semente: number): number {
  return hash01((ix * 73856093) ^ (iz * 19349663) ^ (semente * 83492791))
}
function ruido(x: number, z: number, celula: number, semente: number): number {
  const fx = x / celula, fz = z / celula
  const ix = Math.floor(fx), iz = Math.floor(fz)
  const tx = fx - ix, tz = fz - iz
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz)
  const a = hash2(ix, iz, semente), b = hash2(ix + 1, iz, semente)
  const c = hash2(ix, iz + 1, semente), d = hash2(ix + 1, iz + 1, semente)
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz
}

function pontoEmRumo(r: number, azGraus: number): [number, number] {
  const a = (azGraus * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

// ── AUTORIA DAS PISTAS ───────────────────────────────────────────────────────
// ⚠️ AS PISTAS SERPENTEIAM DE PROPÓSITO, NÃO DESCEM PELA LINHA DE MAIOR
// DECLIVE. A Tarefa 3 mediu por quê: a aceleração de rampa cai por 6,035 na
// Lua, então a velocidade e a dificuldade desta pista não podem vir de ângulo,
// têm que vir de PERCURSO. Cada ponto é (raio, rumo); a altura de cada um é
// lida de `heightAt` na hora de desenhar, nunca suposta aqui.
//
// Desnível de cada pista, medido no perfil real (script de medição, az 268°,
// que é o eixo do pico principal): ver a tabela completa no relatório final.
// Aqui só a autoria; a conferência do número é depois de `heightAt` existir.
export type Dificuldade = 'verde' | 'azul' | 'vermelha' | 'preta' | 'parque'
export interface Pista {
  nome: string
  dificuldade: Dificuldade
  /** largura da fita, em metros */
  largura: number
  pontos: { r: number; az: number }[]
}

/**
 * ⚠️ A PRIMEIRA AUTORIA (waypoints soltos, 5 a 8 pontos por pista) errou por
 * um motivo medido, não por acaso: um salto de 30° de rumo com o raio quase
 * parado é uma DIAGONAL enorme (a 7.500 m de raio, 30° são 3.927 m de arco),
 * então o "serpenteio" virou zigue-zague gigante: 22,7 km de pista para
 * 1.053 m de desnível, 2,7° de grau médio, mais raso que uma calçada. Uma
 * pista de verdade serpenteia em CURVA CONTÍNUA, não em cotovelo. Por isso a
 * autoria agora é paramétrica: raio varre em linha reta de início a fim, o
 * rumo oscila em seno em torno de um eixo, e o número de amostras é alto o
 * bastante para a fita seguir a curva de perto. `medirPista` (abaixo) fecha o
 * ciclo: mede o resultado de verdade e é o que decidiu `oscilacoes` e
 * `amplitude` de cada pista, não o contrário.
 */
interface EspecPista {
  nome: string
  dificuldade: Dificuldade
  largura: number
  rInicio: number
  rFim: number
  azCentro: number
  /** meia-amplitude da serpentina, em graus */
  amplitude: number
  /** quantas oscilações completas de início a fim */
  oscilacoes: number
  amostras: number
}

function gerarSerpentina(e: EspecPista): { r: number; az: number }[] {
  const pts: { r: number; az: number }[] = []
  for (let i = 0; i <= e.amostras; i++) {
    const t = i / e.amostras
    const r = e.rInicio + (e.rFim - e.rInicio) * t
    const az = e.azCentro + e.amplitude * Math.sin(t * Math.PI * 2 * e.oscilacoes)
    pts.push({ r, az })
  }
  return pts
}

// As especificações abaixo foram tuneladas contra `medirPista` de verdade
// (varredura de amplitude × oscilações no script de medição, não suposição).
// ⚠️ A PRIMEIRA RODADA DE AJUSTE ENSINOU UMA SEGUNDA COISA, além da diagonal
// gigante: quanto MAIS a fita serpenteia, MAIS RASA ela fica (mais percurso
// para o mesmo desnível), então a amplitude certa é a MENOR que ainda cobre o
// desnível pedido pela norma, não a maior. E o pé da montanha (r < 7.700,
// dentro da faixa que o pódio da abóbada ainda suprime em parte) é fisicamente
// mais manso que a crista: as provas técnicas curtas (Super-G, Gigante,
// Slalom) foram por isso realocadas para o FLANCO onde o relevo esculpido já
// é íngreme de verdade (r ≈ 7.500 a 8.000), não empurradas à força com
// serpentina. Números finais, medidos, no relatório.
const ESPECIFICACOES: EspecPista[] = [
  {
    nome: 'Descida do Mar da Tranquilidade', dificuldade: 'preta', largura: 30,
    rInicio: 8330, rFim: 7150, azCentro: 268, amplitude: 6, oscilacoes: 1, amostras: 90,
  },
  {
    nome: 'Super-G Regolito', dificuldade: 'preta', largura: 27,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ: a troca do relevo por dado real
    // (Zwölfernock/Weisse Wand) moveu o flanco íngreme de novo. Medido de
    // novo por `medirPista`: 565 m de desnível, dentro de 400-650.
    rInicio: 7900, rFim: 7600, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 60,
  },
  {
    nome: 'Slalom Gigante Cratera Rasa', dificuldade: 'vermelha', largura: 22,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ, mesmo motivo. Medido: 408 m, dentro
    // de 250-450.
    rInicio: 7780, rFim: 7600, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 50,
  },
  {
    nome: 'Slalom Poeira Fina', dificuldade: 'azul', largura: 18,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ. Medido: 208 m, dentro de 180-220.
    rInicio: 7650, rFim: 7530, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 40,
  },
  {
    nome: 'Boardercross Baixa Gravidade', dificuldade: 'parque', largura: 30,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ. Medido: 1.192 m de percurso (alvo
    // 800-1.200), 249 m de desnível (alvo 100-250), 11,8° de grau médio
    // (alvo FIS 7-11°, 0,8° acima: os três critérios juntos não fecham
    // perfeito no relevo novo, e ficar 0,8° acima do teto de uma
    // RECOMENDAÇÃO, não de uma regra de homologação, foi a troca aceita
    // em vez de furar o percurso ou o desnível).
    rInicio: 7650, rFim: 7350, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 50,
  },
  {
    nome: 'Slopestyle Um Sexto', dificuldade: 'parque', largura: 24,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ. Sem norma FIS estrita; 164 m de
    // queda numa progressão razoável de freestyle.
    rInicio: 7850, rFim: 7600, azCentro: 260, amplitude: 2, oscilacoes: 1, amostras: 40,
  },
  {
    nome: 'Pista Verde de Acesso', dificuldade: 'verde', largura: 20,
    // o anel que o pódio da abóbada já deixa plano (r ≤ 7.150): o retorno
    // manso até a vila-base, de graça, em cima do nivelamento que já existe.
    rInicio: 7150, rFim: 6850, azCentro: 266, amplitude: 1, oscilacoes: 0.5, amostras: 30,
  },
]

export const PISTAS: Pista[] = ESPECIFICACOES.map((e) => ({
  nome: e.nome, dificuldade: e.dificuldade, largura: e.largura, pontos: gerarSerpentina(e),
}))

/** envelope radial ASSIMÉTRICO: sobe em cosseno do pé até a crista (o
 *  versante esquiável, moderado), cai em `Math.pow(suave01, EXP_FACE_ROCHA)`
 *  da crista até a queda externa (a face de rocha, que fica perto de 1 quase
 *  até o topo e desaba no último trecho). Continua a mesma forma da primeira
 *  correção: isto é só o envelope de EXISTÊNCIA, não a forma fina. */
function envelopeRadial(r: number): number {
  if (r <= R_PE || r >= R_QUEDA) return 0
  if (r <= R_CRISTA_PICO) return suave01((r - R_PE) / (R_CRISTA_PICO - R_PE))
  const t = suave01((R_QUEDA - r) / (R_QUEDA - R_CRISTA_PICO))
  return Math.pow(t, EXP_FACE_ROCHA)
}

/** janela angular de existência, em platô entre AZ0 e AZ1 com 10° de
 *  transição suave em cada ponta. Substitui os "ombros" da primeira
 *  correção: aquilo desenhava a FORMA do cume (era o próprio defeito, cumes
 *  colocados); isto só diz ONDE o maciço pode existir, e quem desenha a
 *  forma agora são as feições reais (`FEICOES`) mais o tempero fino. */
function envelopeAzimute(az: number): number {
  if (az <= AZ0 - 10 || az >= AZ1 + 10) return 0
  if (az >= AZ0 && az <= AZ1) return 1
  if (az < AZ0) return suave01((az - (AZ0 - 10)) / 10)
  return suave01((AZ1 + 10 - az) / 10)
}

// ═══════════════════════════════════════════════════════════════════════════
// AS FEIÇÕES REAIS: dois scans fotogramétricos (ver a nota "SEGUNDA
// CORREÇÃO" no cabeçalho do arquivo), usados TRÊS vezes com posição, giro e
// raio DIFERENTES cada uma: é isso que evita repetição, não a quantidade de
// arquivos. Amostragem por vizinho bilinear na grade 96×96 assada offline,
// com falloff circular suave (não quadrado) na borda de cada feição, e
// combinadas por MÁXIMO (mesma convenção de `monteEm` em `terrain.ts`): onde
// duas feições se sobrepõem, a mais alta vence e a transição sai suave
// porque as duas já desvanecem para 0 nas próprias bordas.
// ═══════════════════════════════════════════════════════════════════════════
interface DadosRelevo { grid: number; alturas: number[] }
interface FeicaoReal { cx: number; cz: number; giro: number; raioM: number; pesoAltura: number; dados: DadosRelevo }

/** ⚠️ PESO EM METROS, MEDIDO CONTRA O ALVO, NÃO CHUTADO: o terreno natural no
 *  arco da crista mede 260-320 m (Tarefa 1); o alvo de cume é ~1.150 m
 *  (Tarefa 2, e a folga da casca com a borda nova do arco oeste, 353,9 m
 *  medidos pela frente da casca, já foi reconferida pra esse valor). O
 *  Zwölfernock carrega o grosso (900 m no seu próprio pico), os dois usos do
 *  Weisse Wand ficam abaixo dele (640 e 430 m) pra não competir pelo posto
 *  de cume mais alto e ler como dois picos iguais de novo. */
const FEICOES: FeicaoReal[] = (() => {
  const [x1, z1] = pontoEmRumo(8280, 266)
  const [x2, z2] = pontoEmRumo(7950, 250)
  const [x3, z3] = pontoEmRumo(8100, 284)
  return [
    { cx: x1, cz: z1, giro: 0.35, raioM: 820, pesoAltura: 900, dados: relevoZwoelfernock as DadosRelevo },
    { cx: x2, cz: z2, giro: 1.10, raioM: 620, pesoAltura: 640, dados: relevoWeisseWand as DadosRelevo },
    // ⚠️ MESMO ARQUIVO QUE A FEIÇÃO ANTERIOR, GIRO E RAIO DIFERENTES: é a
    // técnica de "carimbo" reaproveitado com transform distinto (mesma ideia
    // das 9 sequoias resolvendo a floresta hoje). O que causaria repetição
    // seria repetir posição E escala juntas, não repetir a fonte de dado.
    { cx: x3, cz: z3, giro: 4.20, raioM: 520, pesoAltura: 430, dados: relevoWeisseWand as DadosRelevo },
  ]
})()

function amostrarFeicao(f: FeicaoReal, x: number, z: number): number {
  const dx = x - f.cx, dz = z - f.cz
  const c = Math.cos(-f.giro), s = Math.sin(-f.giro)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  const distNorm = Math.hypot(lx, lz) / f.raioM
  if (distNorm >= 1) return 0
  const g = f.dados.grid
  const u = lx / f.raioM * 0.5 + 0.5
  const v = lz / f.raioM * 0.5 + 0.5
  const fx = Math.min(g - 1.001, Math.max(0, u * (g - 1)))
  const fz = Math.min(g - 1.001, Math.max(0, v * (g - 1)))
  const i = Math.floor(fx), j = Math.floor(fz)
  const tx = fx - i, tz = fz - j
  const A = f.dados.alturas
  const H = (ii: number, jj: number) => A[jj * g + ii]
  const h = (H(i, j) * (1 - tx) + H(i + 1, j) * tx) * (1 - tz) + (H(i, j + 1) * (1 - tx) + H(i + 1, j + 1) * tx) * tz
  // ⚠️ FALLOFF CIRCULAR, NÃO QUADRADO: a grade é quadrada (u,v em [0,1]²),
  // mas cortar no quadrado desenharia uma aresta reta na chapa. O raio
  // normalizado (`distNorm`) já é a distância euclidiana, então o desvanece
  // é um círculo de verdade em torno de `(cx, cz)`.
  const falloff = 1 - suave01((distNorm - 0.72) / 0.28)
  return h * f.pesoAltura * falloff
}

// ═══════════════════════════════════════════════════════════════════════════
// O TEMPERO FINO: ridged multifractal (Musgrave/libnoise) com deformação de
// domínio, pesquisados antes de escrever (fonte: libnoise RidgedMulti e
// Inigo Quilez, "Domain Warping"). Isto NÃO desenha a montanha (isso é
// `FEICOES` acima); preenche a escala que a grade 96×96 não resolve, com
// amplitude pequena de propósito.
// ═══════════════════════════════════════════════════════════════════════════

/** deformação de domínio: desloca (x, z) por outro ruído de célula GRANDE
 *  (1.100 m, bem maior que a escala do tempero, 260 m) antes de amostrar
 *  qualquer coisa. É o que Quilez descreve: o campo de deformação varia mais
 *  devagar no espaço que o detalhe que ele desloca, senão vira tremedeira em
 *  vez de dobra suave. Isto quebra o alinhamento radial que o envelope ainda
 *  tem, sem isto mesmo com dado real o eco do raio poderia aparecer. */
function deformarDominio(x: number, z: number): [number, number] {
  const forca = 200
  const wx = (ruido(x, z, 1100, 811) * 2 - 1) * forca
  const wz = (ruido(x, z, 1100, 812) * 2 - 1) * forca
  return [x + wx, z + wz]
}

/** uma oitava em crista: `signal = (1 - |ruído|)²`. O valor absoluto dobra
 *  os lóbulos negativos pra cima, criando um VINCO exatamente onde o ruído
 *  cru cruza zero, e vinco é o que uma crista É. Elevar ao quadrado afia o
 *  vinco e achata o vale, que é a assinatura de "cume fino, vale largo" que
 *  o fundador pediu. */
function ridgedOitava(x: number, z: number, celula: number, semente: number): number {
  const n = ruido(x, z, celula, semente) * 2 - 1
  const sinal = 1 - Math.abs(n)
  return sinal * sinal
}

/** a parte MULTIFRACTAL, que é o que distingue isto de fBm comum: o peso de
 *  cada oitava não é uma persistência fixa, é REALIMENTADO pelo `signal` da
 *  oitava ANTERIOR (`peso = clamp(signal · ganho, 0, 1)`, fórmula exata do
 *  `RidgedMulti` do libnoise). Onde a oitava anterior já saiu alta (perto de
 *  uma crista), a próxima ganha até 2× de peso e fica mais áspera; onde saiu
 *  baixa (um vale), a próxima fica quase lisa. É por isso que o alto de uma
 *  montanha de verdade é mais rugoso que o baixo, em qualquer escala. */
function ridgedMultifractal(x: number, z: number, celulaBase: number, semente: number, oitavas: number): number {
  let soma = 0, somaAmp = 0, amp = 1, peso = 1, celula = celulaBase
  const lacunaridade = 2.0, ganho = 2.0
  for (let o = 0; o < oitavas; o++) {
    const sinal = ridgedOitava(x, z, celula, semente + o * 7) * peso
    peso = Math.min(1, Math.max(0, sinal * ganho))
    soma += sinal * amp
    somaAmp += amp
    celula /= lacunaridade
    amp *= 0.5
  }
  return somaAmp > 0 ? soma / somaAmp : 0 // ~0..1
}

/** amplitude do tempero, em metros: pequena contra as feições reais
 *  (430-900 m no pico), grande o bastante pra ler como rocha fraturada nas
 *  chapas de perto (`invernope`). `pesoPista` (0..1, ver `pistaProximidade01`)
 *  desliga o tempero perto da fita ANTES do corte entrar: senão a cava de
 *  profundidade constante deixaria os solavancos do ruído por baixo dela e a
 *  pista viraria montanha-russa, exatamente o defeito que foi apontado. */
const AMPLITUDE_TEMPERO = 55
function temperoFino(x: number, z: number, env: number, pesoPista: number): number {
  if (env <= 0 || pesoPista >= 1) return 0
  const [wx, wz] = deformarDominio(x, z)
  const rm = ridgedMultifractal(wx, wz, 260, 901, 4) // 0..1
  const centralizado = (rm - 0.5) * 2 // -1..1 aprox: sobe E desce, não só cava
  return centralizado * AMPLITUDE_TEMPERO * env * (1 - pesoPista)
}

/**
 * ⚠️ A PISTA É CAVADA, NÃO PINTADA. Uma fita de cor sobre a superfície lisa
 * lê como estrada. Pista de esqui de verdade é um corte na mata e no
 * relevo: uma calha rasa com talude nas duas bordas. `pistaProximidade01`
 * mede a distância ao segmento mais próximo de CADA pista (as mesmas
 * `PISTAS` que a fita desenha por cima) e devolve 1 no eixo, decaindo em
 * cosseno até 0 na borda do talude, o MESMO peso serve pra desligar
 * `temperoFino` (acima) e pra escalar a profundidade do corte (abaixo), os
 * dois lidos de uma distância só, não duas.
 *
 * ⚠️ CUSTO: soma de segmentos de TODAS as pistas, por chamada. ~360 pontos
 * ao todo (7 pistas, 30 a 90 amostras cada); cada `alturaInvernoAt` já
 * descarta cedo por envelope antes de chegar aqui, então isto só roda
 * dentro da zona do parque. NÃO MEDI o custo total de construção da malha
 * com isto ligado; se a chapa acusar, o corte é trocar a busca linear por
 * uma grade de baldes (bucket) pelas mesmas `PISTAS`.
 */
const PROFUNDIDADE_CORTE = 3.2
const TALUDE_CORTE = 8
const PISTAS_MUNDO = PISTAS.map((p) => ({
  meiaLargura: p.largura / 2,
  pontos: p.pontos.map((pt) => {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    return { x, z }
  }),
}))

function pistaProximidade01(x: number, z: number): number {
  let melhorDist = Infinity
  let melhorMeiaLarg = 0
  for (const pista of PISTAS_MUNDO) {
    const pts = pista.pontos
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, az_ = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z
      const dx = bx - ax, dz = bz - az_
      const lenSq = dx * dx + dz * dz || 1
      let t = ((x - ax) * dx + (z - az_) * dz) / lenSq
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const px = ax + dx * t, pz = az_ + dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < melhorDist) { melhorDist = d; melhorMeiaLarg = pista.meiaLargura }
    }
  }
  const alcance = melhorMeiaLarg + TALUDE_CORTE
  if (melhorDist >= alcance) return 0
  if (melhorDist <= melhorMeiaLarg) return 1
  const t = (melhorDist - melhorMeiaLarg) / TALUDE_CORTE
  return suave01(1 - t)
}

/**
 * A altura ADICIONADA pelo parque de inverno, em metros, para somar direto a
 * `heightAt` (mesmo contrato de `microRelevoAt`): 0 bit a bit sem a
 * bandeira, puro em (x, z), sem depender de câmera nem de estado. A forma
 * vem das `FEICOES` reais (multiplicadas pelo envelope de existência), o
 * tempero fino vem do ruído em crista, e a pista cava por cima dos dois.
 */
export function alturaInvernoAt(x: number, z: number): number {
  if (!INVERNO_ATIVO) return 0
  const r = Math.hypot(x, z)
  const envR = envelopeRadial(r)
  if (envR <= 0) return 0
  const az = azimuteDe(x, z)
  const envAz = envelopeAzimute(az)
  if (envAz <= 0) return 0
  const env = envR * envAz
  let baseReal = 0
  for (const f of FEICOES) baseReal = Math.max(baseReal, amostrarFeicao(f, x, z))
  const pesoPista = pistaProximidade01(x, z)
  const relevo = baseReal * env + temperoFino(x, z, env, pesoPista)
  return relevo - PROFUNDIDADE_CORTE * pesoPista
}

/**
 * Quanto (0..1) um ponto pertence à zona esculpida pelo parque de inverno.
 * `alpino.ts` usa isto para baixar a cota de neve SÓ onde a montanha nova
 * está, sem gelar encostas de outro rumo que não têm nada com este módulo.
 * 0 bit a bit sem `?inverno=1`, mesmo contrato de `alturaInvernoAt`.
 */
export function zonaEsquiavelAt(x: number, z: number): number {
  if (!INVERNO_ATIVO) return 0
  const r = Math.hypot(x, z)
  const envR = envelopeRadial(r)
  if (envR <= 0) return 0
  const az = azimuteDe(x, z)
  return envR * envelopeAzimute(az)
}
/**
 * ⚠️ ROCHA EXPOSTA. A mesma regra de `alpino.ts` (neve não gruda acima de
 * ~30°, zero em 55°): acima disso o que aparece não pode ser regolito
 * marrom, tem que ser pedra. `terrain.ts` chama isto (ele é o dono da cor
 * por vértice da malha grossa, `regolithColor`) com a inclinação que ELE já
 * calcula ao montar a malha, e mistura a cor pra um cinza de rocha onde o
 * fator voltar > 0. 0 fora da zona do parque (não pinta rocha na cidade),
 * 0 dentro da zona mas em terreno manso (< 30°): a transição usa a MESMA
 * faixa 30-55° que a neve usa, de propósito, para rocha e neve se encaixarem
 * sem uma tira de regolito sobrando entre as duas.
 */
export function fatorRochaAt(x: number, z: number, inclinacaoGraus: number): number {
  if (!INVERNO_ATIVO) return 0
  const zona = zonaEsquiavelAt(x, z)
  if (zona <= 0) return 0
  const porInclinacao = suave01((inclinacaoGraus - 30) / 25)
  return zona * porInclinacao
}


const CORES: Record<Dificuldade, THREE.Color> = {
  verde: new THREE.Color('#3DBB4C'),
  azul: new THREE.Color('#1E6FD9'),
  vermelha: new THREE.Color('#D92B2B'),
  preta: new THREE.Color('#202024'),
  parque: new THREE.Color('#E8660D'),
}

/** comprimento e desnível reais de uma pista, medidos em cima de `heightAt`
 *  de verdade: a conferência dos alvos de projeto, não a suposição deles. */
export function medirPista(p: Pista, heightAt: (x: number, z: number) => number) {
  let comprimento = 0
  let yMax = -Infinity, yMin = Infinity
  let anterior: THREE.Vector3 | null = null
  for (const pt of p.pontos) {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    const y = heightAt(x, z)
    yMax = Math.max(yMax, y); yMin = Math.min(yMin, y)
    const v = new THREE.Vector3(x, y, z)
    if (anterior) comprimento += anterior.distanceTo(v)
    anterior = v
  }
  return { comprimento, desnivel: yMax - yMin, grauMedio: (Math.atan2(yMax - yMin, comprimento) * 180) / Math.PI }
}

export interface InvernoOpts {
  /** ⚠️ passe `terrain.superficieAt`, a mesma regra de `alpino.ts`: quem
   *  desenha coisa que ENCOSTA no chão usa a superfície que a câmera vê, não
   *  a função contínua. */
  heightAt: (x: number, z: number) => number
  /** ⚠️ O LOADER DA CENA, NÃO UM CRU. As dez malhas de árvore em `ARVORES`
   *  (`tree-pine.glb` mais as nove sequoias, `sq-*.glb`) vêm comprimidas em
   *  DRACO (mesma armadilha documentada em `montanha.ts`: falham em
   *  `GLTFLoader` sem `DRACOLoader`). Sem `gltf`, a floresta não sobe
   *  (avisado no console, não silencioso) e o resto do módulo (pistas,
   *  halfpipe, teleféricos) sobe normalmente: a floresta é aditiva, não
   *  trava o parque. Falha de UM `.glb` também não trava nada: ver o
   *  cabeçalho da seção "A FLORESTA". */
  gltf?: GLTFLoader
  sombra?: boolean
  profile?: PerfProfile
  culler?: DistanceCuller
}

export interface Inverno {
  group: THREE.Group
  triangulos: number
  /** as medições reais de cada pista, para `?stats=1` e para o relatório */
  medidas: { nome: string; dificuldade: Dificuldade; comprimento: number; desnivel: number; grauMedio: number }[]
  /** quantas árvores reais (pinheiro + sequoia) subiram, para o log de boot */
  arvores: number
  /** troca o LOD por distância de câmera, mesmo contrato de `alpino.ts` */
  update(cam: THREE.Vector3): void
  dispose(): void
}

const LEVANTE_FITA = 0.5

/** uma fita de pista: tira de quads seguindo os pontos, elevada sobre o chão,
 *  cor sólida por dificuldade. Mesmo princípio de `alpino.ts`: malha própria,
 *  não cor por vértice do terreno de outro módulo. */
function construirFita(p: Pista, heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const cor = CORES[p.dificuldade]
  const centro: THREE.Vector3[] = p.pontos.map((pt) => {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    return new THREE.Vector3(x, heightAt(x, z) + LEVANTE_FITA, z)
  })
  const pos: number[] = [], nor: number[] = [], cores: number[] = [], uv: number[] = []
  const meiaLarg = p.largura / 2
  const up = new THREE.Vector3(0, 1, 0)
  let acumulado = 0
  for (let i = 0; i < centro.length; i++) {
    const atual = centro[i]
    const dir = new THREE.Vector3()
    if (i === 0) dir.subVectors(centro[1], centro[0])
    else if (i === centro.length - 1) dir.subVectors(centro[i], centro[i - 1])
    else dir.subVectors(centro[i + 1], centro[i - 1])
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0)
    dir.normalize()
    const lado = new THREE.Vector3().crossVectors(up, dir).normalize()
    const a = new THREE.Vector3().copy(atual).addScaledVector(lado, meiaLarg)
    const b = new THREE.Vector3().copy(atual).addScaledVector(lado, -meiaLarg)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    nor.push(0, 1, 0, 0, 1, 0)
    cores.push(cor.r, cor.g, cor.b, cor.r, cor.g, cor.b)
    if (i > 0) acumulado += atual.distanceTo(centro[i - 1])
    uv.push(0, acumulado / 20, 1, acumulado / 20)
  }
  const idx: number[] = []
  for (let i = 0; i < centro.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// ── O HALFPIPE ────────────────────────────────────────────────────────────
// Parede 6,71 m (22 pés, igual à Terra: ver Tarefa 3), pé-a-pé 182,9 m
// (600 pés, igual à Terra), largura de boca 19,5 m (64 pés). A folga de ar
// exigida ACIMA da parede (48,5 m, o recorde mundial de amplitude vezes
// 6,035) não é geometria desenhada aqui: é orçamento de câmera, escrito no
// relatório para quem for enquadrar a cena.
const PIPE_PAREDE = 6.71
const PIPE_MEIA_BOCA = 19.5 / 2
const PIPE_COMPRIMENTO = 182.9
const PIPE_FATIAS = 10
const PIPE_PERFIL = 8 // pontos atravessando a boca, de uma parede a outra

function perfilPipe(s: number): number {
  // s em [-1,1]; 0 no fundo do canal, 1 na boca de cada lado
  return PIPE_PAREDE * Math.pow(Math.abs(s), 1.6)
}

function construirHalfpipe(
  centroR: number, centroAz: number, rumoDescida: number,
  heightAt: (x: number, z: number) => number,
): THREE.BufferGeometry {
  const [cx, cz] = pontoEmRumo(centroR, centroAz)
  const yBase = heightAt(cx, cz)
  const dirRad = (rumoDescida * Math.PI) / 180
  const dir = new THREE.Vector3(Math.sin(dirRad), 0, -Math.cos(dirRad))
  const lado = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
  const pos: number[] = [], nor: number[] = [], cores: number[] = []
  const corGelo = new THREE.Color('#DCE7EE')
  const linhas: THREE.Vector3[][] = []
  for (let i = 0; i <= PIPE_FATIAS; i++) {
    const t = i / PIPE_FATIAS
    const centro = new THREE.Vector3(cx, yBase, cz).addScaledVector(dir, (t - 0.5) * PIPE_COMPRIMENTO)
    const linha: THREE.Vector3[] = []
    for (let j = 0; j <= PIPE_PERFIL; j++) {
      const s = (j / PIPE_PERFIL) * 2 - 1
      const alturaParede = perfilPipe(s)
      const p = new THREE.Vector3().copy(centro)
        .addScaledVector(lado, s * PIPE_MEIA_BOCA)
        .add(new THREE.Vector3(0, alturaParede - PIPE_PAREDE, 0)) // canal escavado: fundo abaixo do chão
      linha.push(p)
    }
    linhas.push(linha)
  }
  for (let i = 0; i < linhas.length - 1; i++) {
    for (let j = 0; j < PIPE_PERFIL; j++) {
      const a = linhas[i][j], b = linhas[i][j + 1], c = linhas[i + 1][j], d = linhas[i + 1][j + 1]
      const n1 = new THREE.Triangle(a, c, b).getNormal(new THREE.Vector3())
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
      pos.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)
      for (let k = 0; k < 6; k++) { nor.push(n1.x, n1.y, n1.z); cores.push(corGelo.r, corGelo.g, corGelo.b) }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  return g
}

// ── OS TELEFÉRICOS ────────────────────────────────────────────────────────
// Dois cabos: o principal, da vila-base ao ombro do pico; o do parque, da
// vila-base ao colo do halfpipe. Pilone de 16 m (referência de estação de
// esqui comum; NÃO É NORMA FIS, não existe norma FIS para pilone de
// teleférico, dito por honestidade, não por descuido).
const PILONE_ALTURA = 16

function construirTeleferico(
  deR: number, deAz: number, paraR: number, paraAz: number, nPilones: number,
  heightAt: (x: number, z: number) => number,
): { pilones: THREE.InstancedMesh; cabo: THREE.Mesh; triangulos: number } {
  const pontos: THREE.Vector3[] = []
  for (let i = 0; i <= nPilones + 1; i++) {
    const t = i / (nPilones + 1)
    const r = deR + (paraR - deR) * t
    const az = deAz + (paraAz - deAz) * t
    const [x, z] = pontoEmRumo(r, az)
    pontos.push(new THREE.Vector3(x, heightAt(x, z) + PILONE_ALTURA, z))
  }
  const gPilone = new THREE.CylinderGeometry(0.5, 0.7, PILONE_ALTURA, 6)
  const matPilone = new THREE.MeshStandardMaterial({ color: '#8A8D93', roughness: 0.8 })
  const pilones = new THREE.InstancedMesh(gPilone, matPilone, pontos.length)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < pontos.length; i++) {
    m4.makeTranslation(pontos[i].x, pontos[i].y - PILONE_ALTURA / 2, pontos[i].z)
    pilones.setMatrixAt(i, m4)
  }
  pilones.instanceMatrix.needsUpdate = true
  pilones.name = 'inverno:pilones'

  // o cabo: uma curva suave pelos topos dos pilones, levemente arriada entre
  // cada par (a mesma ideia de catenária de um cabo real, sem resolver a
  // catenária de verdade: é detalhe de fundo, visto de longe)
  const comArrio: THREE.Vector3[] = []
  for (let i = 0; i < pontos.length; i++) {
    comArrio.push(pontos[i])
    if (i < pontos.length - 1) {
      const meio = pontos[i].clone().lerp(pontos[i + 1], 0.5)
      meio.y -= 1.4
      comArrio.push(meio)
    }
  }
  const curva = new THREE.CatmullRomCurve3(comArrio)
  const gCabo = new THREE.TubeGeometry(curva, comArrio.length * 4, 0.12, 5, false)
  const matCabo = new THREE.MeshStandardMaterial({ color: '#2B2B2E', roughness: 0.6, metalness: 0.3 })
  const cabo = new THREE.Mesh(gCabo, matCabo)
  cabo.name = 'inverno:cabo'

  const triPilone = gPilone.index ? gPilone.index.count / 3 : gPilone.attributes.position.count / 3
  const triCabo = gCabo.index ? gCabo.index.count / 3 : gCabo.attributes.position.count / 3
  return { pilones, cabo, triangulos: Math.round(triPilone * pontos.length + triCabo) }
}

// ═══════════════════════════════════════════════════════════════════════════
// A FLORESTA (03/09, redesenhada no mesmo dia). A chapa apontou "árvores
// esparsas no pé e nada na montanha": a faixa de mata que `alpino.ts`
// adaptou e as coníferas de 34 triângulos dele são de propósito UM FUNDO
// visto de 6 a 9 km, não uma floresta que aguenta câmera perto do maciço.
//
// ⚠️ COLISÃO ENTRE FRENTES, 03/09: este módulo usava `sequoia-mass.glb`
// (84,69 m, um BOSQUE inteiro por instância, ver a nota que existia aqui). A
// frente de espécies aposentou esse arquivo (e `sequoia.glb`) no mesmo dia:
// achou no acervo Sketchfab sequoias de verdade, com casca texturizada, mais
// baratas (2.536-3.339 tri contra 10.336 do gerado por código, que lia como
// brócolis facetado). O `.catch(() => null)` que eu já tinha evitou a
// quebra, mas produziu um BURACO SILENCIOSO: 404 no console, floresta sem
// sequoia, ninguém sabendo, o mesmo defeito que `loadSf` teve em outro
// lugar da cena no mesmo dia. Duas correções aqui: (1) a fonte trocou para
// as novas; (2) falha de carregamento agora GRITA (`console.error`) por
// arquivo, nunca mais silenciosa.
//
// ⚠️ AS NOVAS SÃO ÁRVORES, NÃO BOSQUES, e isso muda a lógica inteira de
// densidade. `sequoia-mass.glb` entrava RARA (3,5% dos candidatos, só abaixo
// de 70 m) porque cada instância já valia uma clareira cheia. As novas
// medem 16 a 40 m (`sq-small-1`, `sq-med-1..4`, `sq-big-1..3`, medido no
// binário glTF, accessor min/max), na mesma ordem de grandeza do pinheiro
// (11 m), só mais altas: uma sequoia de verdade emerge acima do dossel de
// coníferas, não domina a clareira sozinha. Por isso a fração sobe de 3,5%
// para a maior parte da mistura (ver `ARVORES` abaixo) e passa a valer em
// toda a faixa de elevação, não só embaixo.
//
// ⚠️ `sq-rh.glb` MEDE 80 M, quase a escala do bosque antigo, só que é UMA
// árvore só (General Sherman de verdade passa de 80 m). É o "exemplar
// isolado de destaque perto da câmera" que a origem do modelo já descreve:
// entra no MESMO sorteio de todo mundo, mas com peso baixíssimo, então dá
// só um punhado de exemplares no maciço inteiro: raro e dramático, não repetido.
//
// ⚠️ OITO SILHUETAS DISTINTAS (nove com `sq-rh`) MATAM DE GRAÇA A FLORESTA
// DE CLONES: o defeito conhecido desta cidade (`props.ts` nunca chamou
// `setColorAt`, toda cópia de uma espécie saía bit a bit igual). Aqui cada
// candidato sorteia a PEÇA pelo MESMO hash determinístico que já decide
// posição, então a escolha é estável (recarregar a página planta a mesma
// árvore no mesmo lugar) sem custar um for-loop de cor por instância.
//
// ⚠️ SE UMA ESPÉCIE FALHA AO CARREGAR, OS CANDIDATOS DELA NÃO SOMEM: a
// tabela de peso cumulativo é reconstruída só com quem carregou, e o hash
// de espécie é resolvido contra ESSA tabela: outra espécie absorve a fatia,
// sem buraco silencioso na densidade. Só some a SILHUETA daquela espécie,
// nunca a árvore inteira.
//
// ⚠️ DOIS NÍVEIS DE DETALHE, MESMO CONTRATO DE `alpino.ts`: perto (r_cam <
// `FLORESTA_R_CHEIA`) usa a malha real carregada; longe usa um cone de 4
// lados (8 triângulos), a MESMA forma que `alpino.ts` já usa pro fundo dele,
// para todas as espécies lerem como uma silhueta só de longe. `update(cam)`
// troca o balde a cada chamada, como alpino faz.
//
// ⚠️ CUSTO DECLARADO NA CONSTRUÇÃO, NÃO SUPOSTO: contagem real no relatório
// final (`triangulos`/`arvores` do retorno). Teto duro de candidatos perto
// (`FLORESTA_TETO_PERTO`) para o orçamento não fugir se a densidade medida
// vier maior que a esperada.
const FLORESTA_BAIXO = 15
const FLORESTA_ALTO = 190
const FLORESTA_PLUMA = 22
const FLORESTA_PASSO = 30
/** ⚠️ MEDIDO OFFLINE DEPOIS DA TROCA DE ESPÉCIE, NÃO SUPOSTO: a varredura
 *  continua gerando 1.303 candidatos (a posição não mudou, só a espécie).
 *  Com os pesos de `ARVORES` e as dez malhas carregando, o teto de 450 aloca
 *  231 pinheiro, 76 sq-small, 108 sq-med (as 4 juntas), 33 sq-big (as 3
 *  juntas) e 1 sq-rh: 1.328.152 triângulos de perto mais 10.424 no pior caso
 *  do balde de longe, 1.338.576 no total declarado. Ajuste este número pra
 *  cima se a chapa pedir mais densidade de perto. */
const FLORESTA_TETO_PERTO = 450
const FLORESTA_R_CHEIA = 1300
/** acima disto (inclinação em graus) não planta: mesma regra de `alpino.ts` */
const FLORESTA_INC_MAX = 42
/** folga além da meia-largura da pista mais próxima antes de plantar */
const FLORESTA_FOLGA_PISTA = 10

/**
 * ⚠️ AS ESPÉCIES, COM PESO RELATIVO NO SORTEIO. `peso` não precisa somar 1:
 * o código normaliza pela soma de quem CARREGOU (ver `construirFloresta`).
 * Pesos escolhidos por bom senso de estrutura de floresta real (mudas
 * pequenas são a maioria, exemplares grandes são raros, o gigante isolado é
 * rariíssimo), não medidos, dito por honestidade: é a única parte deste
 * módulo que não vem de conta.
 */
interface EspecieArvore { id: string; url: string; peso: number; escMin: number; escMax: number }
const ARVORES: EspecieArvore[] = [
  { id: 'pinheiro', url: '/city/sf/tree-pine.glb', peso: 0.50, escMin: 0.80, escMax: 1.35 },
  { id: 'sq-small-1', url: '/city/sf/sq-small-1.glb', peso: 0.16, escMin: 0.85, escMax: 1.15 },
  { id: 'sq-med-1', url: '/city/sf/sq-med-1.glb', peso: 0.065, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-2', url: '/city/sf/sq-med-2.glb', peso: 0.065, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-3', url: '/city/sf/sq-med-3.glb', peso: 0.06, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-4', url: '/city/sf/sq-med-4.glb', peso: 0.06, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-big-1', url: '/city/sf/sq-big-1.glb', peso: 0.03, escMin: 0.90, escMax: 1.08 },
  { id: 'sq-big-2', url: '/city/sf/sq-big-2.glb', peso: 0.025, escMin: 0.90, escMax: 1.08 },
  { id: 'sq-big-3', url: '/city/sf/sq-big-3.glb', peso: 0.02, escMin: 0.90, escMax: 1.08 },
  // ⚠️ RARO DE PROPÓSITO: 80 m é quase a escala do bosque que este módulo
  // usava antes. Peso de 0,3% num sorteio de ~1.300 candidatos dá uns 3 a 5
  // exemplares no maciço inteiro: marco visual, não repetição.
  { id: 'sq-rh', url: '/city/sf/sq-rh.glb', peso: 0.003, escMin: 0.95, escMax: 1.05 },
]

interface CandidatoFloresta {
  x: number; z: number; y: number; giro: number
  /** hash cru 0..1 pra resolver espécie DEPOIS do carregamento (ver cabeçalho) */
  tEspecie: number
  /** hash cru 0..1 pra resolver a escala dentro da faixa da espécie sorteada */
  tEsc: number
}

/** distância ao segmento de pista mais próximo, reusando `PISTAS_MUNDO`
 *  (a mesma tabela que `corteDePistaAt` já monta) para não plantar árvore em
 *  cima da fita nem do talude dela. */
function distanciaAPistaMaisProxima(x: number, z: number): number {
  let melhor = Infinity
  for (const pista of PISTAS_MUNDO) {
    const pts = pista.pontos
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, azp = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z
      const dx = bx - ax, dz = bz - azp
      const lenSq = dx * dx + dz * dz || 1
      let t = ((x - ax) * dx + (z - azp) * dz) / lenSq
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const px = ax + dx * t, pz = azp + dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < melhor) melhor = d
      if (melhor < pista.meiaLargura) return melhor // já colou, não precisa continuar
    }
  }
  return melhor
}

export function gerarCandidatosFloresta(heightAt: (x: number, z: number) => number): CandidatoFloresta[] {
  const candidatos: CandidatoFloresta[] = []
  const passos = Math.ceil((R_QUEDA - R_PE + 200) / FLORESTA_PASSO)
  for (let ir = 0; ir <= passos; ir++) {
    const r = R_PE - 100 + ir * FLORESTA_PASSO
    if (r < R_PE - 100 || r > R_QUEDA) continue
    // passo angular menor perto do centro pra não desperdiçar amostra, maior
    // longe: mantém a densidade LINEAR (metros entre candidatos) constante
    const passoAz = (FLORESTA_PASSO / r) * (180 / Math.PI)
    for (let az = AZ0 - 8; az <= AZ1 + 8; az += passoAz) {
      const jr = (hash2(ir, Math.round(az * 10), 501) - 0.5) * FLORESTA_PASSO * 0.8
      const jaz = (hash2(ir, Math.round(az * 10), 502) - 0.5) * passoAz * 0.8
      const rr = r + jr, azz = az + jaz
      const [x, z] = pontoEmRumo(rr, azz)
      const zona = zonaEsquiavelAt(x, z)
      if (zona <= 0.04) continue
      const y = heightAt(x, z)
      const dens = suave01((y - (FLORESTA_BAIXO - FLORESTA_PLUMA)) / (2 * FLORESTA_PLUMA))
        * (1 - suave01((y - (FLORESTA_ALTO - FLORESTA_PLUMA)) / (2 * FLORESTA_PLUMA)))
      if (dens <= 0.03) continue
      if (hash2(ir, Math.round(azz * 10), 503) > dens) continue
      const d = 15
      const dhx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d)
      const dhz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d)
      const inc = (Math.atan(Math.hypot(dhx, dhz)) * 180) / Math.PI
      if (inc > FLORESTA_INC_MAX) continue
      if (distanciaAPistaMaisProxima(x, z) < FLORESTA_FOLGA_PISTA) continue
      candidatos.push({
        x, z, y,
        giro: hash2(ir, Math.round(azz * 10), 506) * Math.PI * 2,
        tEspecie: hash2(ir, Math.round(azz * 10), 504),
        tEsc: hash2(ir, Math.round(azz * 10), 505),
      })
    }
  }
  return candidatos
}

/** carrega um `.glb` e devolve a geometria e o material do primeiro mesh
 *  achado, prontos pra instanciar. `null` se não achar mesh OU se o
 *  carregamento falhar, e falha AGORA GRITA no console (`console.error`),
 *  em vez do `.catch(() => null)` silencioso que já custou dois buracos
 *  nesta casa no mesmo dia (este módulo e `loadSf`). O chamador ainda decide
 *  o que fazer sem a árvore (a espécie perdida é redistribuída entre as que
 *  carregaram, ver `construirFloresta`), mas ninguém fica sem SABER. */
async function carregarInstanciavel(
  gltf: GLTFLoader, especie: EspecieArvore,
): Promise<{ geo: THREE.BufferGeometry; mat: THREE.Material } | null> {
  try {
    const cena = await new Promise<THREE.Group>((res, rej) => gltf.load(especie.url, (g) => res(g.scene), undefined, rej))
    let achado: THREE.Mesh | null = null
    cena.traverse((o) => { if (!achado && (o as THREE.Mesh).isMesh) achado = o as THREE.Mesh })
    if (!achado) {
      console.error(`[inverno] floresta: ${especie.url} carregou mas não tem mesh nenhum dentro. Espécie '${especie.id}' fica de fora, redistribuída.`)
      return null
    }
    const mesh = achado as THREE.Mesh
    return { geo: mesh.geometry, mat: mesh.material as THREE.Material }
  } catch (e) {
    console.error(`[inverno] floresta: ${especie.url} NÃO CARREGOU (espécie '${especie.id}'). Ela fica de fora e o peso dela é redistribuído entre as outras; a densidade não cai, só perde essa silhueta. Motivo:`, e)
    return null
  }
}

/**
 * O cone barato de longe (8 triângulos), MESMA forma que `alpino.ts` usa:
 * todas as espécies precisam ler como uma silhueta só quando a câmera está
 * a quilômetros, senão o horizonte ganha costura visível entre elas.
 */
function geoConeLonge(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(2.3, 11.5, 4, 1, false)
  g.translate(0, 5.75, 0)
  const n = g.attributes.position.count
  const cor = new THREE.Color('#3E5140')
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = cor.r; arr[i * 3 + 1] = cor.g; arr[i * 3 + 2] = cor.b }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

interface Floresta {
  group: THREE.Group
  triangulos: number
  arvores: number
  update(cam: THREE.Vector3): void
}

/** `null` sem `?inverno=1`, sem `gltf`, ou se TODOS os `.glb` falharem ao
 *  carregar: a floresta é aditiva, o resto do parque sobe de qualquer jeito.
 *  Falha PARCIAL (algumas espécies, não todas) NÃO devolve `null`: a
 *  floresta sobe com quem carregou e grita no console por quem não. */
async function construirFloresta(o: InvernoOpts): Promise<Floresta | null> {
  if (!INVERNO_ATIVO || !o.gltf) return null
  const carregadas = await Promise.all(ARVORES.map((esp) => carregarInstanciavel(o.gltf!, esp)))
  const vivas = ARVORES
    .map((esp, i) => ({ especie: esp, dados: carregadas[i] }))
    .filter((v): v is { especie: EspecieArvore; dados: { geo: THREE.BufferGeometry; mat: THREE.Material } } => v.dados !== null)
  if (vivas.length === 0) {
    console.error('[inverno] floresta: NENHUMA espécie carregou. Sem árvore nenhuma, o resto do parque sobe normal.')
    return null
  }
  if (vivas.length < ARVORES.length) {
    console.warn(`[inverno] floresta: subiu com ${vivas.length}/${ARVORES.length} espécies (ver os erros acima por nome de arquivo).`)
  }

  // ⚠️ TABELA DE PESO CUMULATIVO SÓ DE QUEM CARREGOU. `tEspecie` (0..1, hash
  // determinístico já sorteado por posição) resolve contra ESTA tabela: se
  // uma espécie caiu, a fatia dela é absorvida pelas outras porque a soma
  // total muda, não porque alguém reagiu à falha em tempo de execução: é
  // reconstrução, não fallback condicional, então o resultado é o mesmo
  // sempre que os mesmos arquivos carregarem, determinístico de novo.
  const pesoTotal = vivas.reduce((s, v) => s + v.especie.peso, 0)
  const cumulativo: { ateT: number; idx: number }[] = []
  let acc = 0
  for (let i = 0; i < vivas.length; i++) { acc += vivas[i].especie.peso / pesoTotal; cumulativo.push({ ateT: acc, idx: i }) }
  const resolverEspecie = (t: number): number => {
    for (const c of cumulativo) if (t <= c.ateT) return c.idx
    return cumulativo.length - 1
  }

  const candidatos = gerarCandidatosFloresta(o.heightAt).map((c) => ({ ...c, especieIdx: resolverEspecie(c.tEspecie) }))
  // desbaste determinístico se passar do teto de perto (o balde de longe não
  // tem teto: cone de 8 tri é barato o bastante pra sobrar todo mundo nele)
  let paraPerto = candidatos
  if (candidatos.length > FLORESTA_TETO_PERTO) {
    const manter = FLORESTA_TETO_PERTO / candidatos.length
    paraPerto = candidatos.filter((_, i) => hash01(i * 2654435761) < manter)
  }
  const paraPertoSet = new Set(paraPerto)

  const group = new THREE.Group()
  group.name = 'inverno:floresta'
  let triangulos = 0

  const instPerto: (THREE.InstancedMesh | null)[] = vivas.map((v, i) => {
    const cap = Math.max(1, paraPerto.filter((c) => c.especieIdx === i).length)
    const inst = new THREE.InstancedMesh(v.dados.geo, v.dados.mat, cap)
    inst.name = `inverno:floresta:${v.especie.id}:perto`
    inst.castShadow = o.sombra ?? true
    inst.frustumCulled = false
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(inst)
    const triUnit = v.dados.geo.index ? v.dados.geo.index.count / 3 : v.dados.geo.attributes.position.count / 3
    triangulos += triUnit * cap
    return inst
  })

  const geoLonge = geoConeLonge()
  const matLonge = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, flatShading: true })
  const longe = new THREE.InstancedMesh(geoLonge, matLonge, Math.max(1, candidatos.length))
  longe.name = 'inverno:floresta:longe'
  longe.castShadow = false
  longe.frustumCulled = false
  longe.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  group.add(longe)
  const triLonge = geoLonge.index ? geoLonge.index.count / 3 : geoLonge.attributes.position.count / 3
  triangulos += candidatos.length * triLonge // pior caso: todo mundo no balde de longe

  const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion()
  const ve = new THREE.Euler(), vs = new THREE.Vector3()

  const update = (cam: THREE.Vector3) => {
    const contagens = new Array(vivas.length).fill(0)
    let nLonge = 0
    for (const c of candidatos) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z)
      const perto = d < FLORESTA_R_CHEIA && paraPertoSet.has(c)
      const especie = vivas[c.especieIdx].especie
      const esc = especie.escMin + c.tEsc * (especie.escMax - especie.escMin)
      vp.set(c.x, c.y, c.z)
      ve.set(0, c.giro, 0)
      vq.setFromEuler(ve)
      vs.set(esc, esc, esc)
      m4.compose(vp, vq, vs)
      const inst = perto ? instPerto[c.especieIdx] : null
      if (inst) inst.setMatrixAt(contagens[c.especieIdx]++, m4)
      else longe.setMatrixAt(nLonge++, m4)
    }
    for (let i = 0; i < vivas.length; i++) {
      const inst = instPerto[i]
      if (!inst) continue
      inst.count = contagens[i]
      inst.instanceMatrix.needsUpdate = true
    }
    longe.count = nLonge
    longe.instanceMatrix.needsUpdate = true
  }
  update(new THREE.Vector3(0, 0, 0))
  for (const inst of instPerto) inst?.computeBoundingSphere()
  longe.computeBoundingSphere()

  return { group, triangulos: Math.round(triangulos), arvores: candidatos.length, update }
}

/**
 * O parque de inverno inteiro: pistas, halfpipe, vila-base, teleféricos e a
 * floresta. Devolve grupo vazio sem `?inverno=1` (a mesma defesa em
 * profundidade de `terreno-fino.ts`: quem esquecer de checar a bandeira
 * antes de chamar isto não quebra nada).
 *
 * ⚠️ FICOU ASSÍNCRONA EM 03/09, por causa da floresta (`GLTFLoader.load` é
 * Promise). Quem chamava `buildInverno({...})` direto agora precisa de
 * `await`; ver a linha exata no relatório.
 */
export async function buildInverno(o: InvernoOpts): Promise<Inverno> {
  const group = new THREE.Group()
  group.name = 'inverno'
  const medidas: Inverno['medidas'] = []
  if (!INVERNO_ATIVO) {
    return { group, triangulos: 0, medidas, arvores: 0, update() {}, dispose() { group.clear() } }
  }

  let triangulos = 0
  const matFita = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0, polygonOffset: true,
    polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
  for (const p of PISTAS) {
    const g = construirFita(p, o.heightAt)
    const mesh = new THREE.Mesh(g, matFita)
    mesh.name = `inverno:pista:${p.nome}`
    mesh.receiveShadow = o.sombra ?? true
    mesh.castShadow = false
    group.add(mesh)
    triangulos += g.index ? g.index.count / 3 : g.attributes.position.count / 3
    const med = medirPista(p, o.heightAt)
    medidas.push({ nome: p.nome, dificuldade: p.dificuldade, ...med })
  }

  // o halfpipe: no colo entre o ombro sul e o pico principal, já fora da
  // faixa pesada do pódio (r > 8.100, supressão ≤ 17%, ver cabeçalho)
  const gPipe = construirHalfpipe(8220, 261, 264, o.heightAt)
  const matPipe = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 })
  const meshPipe = new THREE.Mesh(gPipe, matPipe)
  meshPipe.name = 'inverno:halfpipe'
  meshPipe.receiveShadow = o.sombra ?? true
  group.add(meshPipe)
  triangulos += gPipe.attributes.position.count / 3

  // a vila-base: um volume simples de apoio, mais a estação de teleférico
  // REAL (buscada no Sketchfab, ver a nota "SEGUNDA CORREÇÃO": mobiliário
  // não é terreno, e o acervo tem estação melhor que a caixa que eu desenhava)
  const matVila = new THREE.MeshStandardMaterial({ color: '#6B5B4A', roughness: 0.85 })
  {
    const [r, az, largura, altura] = [6920, 273, 30, 12] as const
    const [x, z] = pontoEmRumo(r, az)
    const y = o.heightAt(x, z)
    const geo = new THREE.BoxGeometry(largura, altura, largura * 0.6)
    const mesh = new THREE.Mesh(geo, matVila)
    mesh.position.set(x, y + altura / 2, z)
    mesh.rotation.y = (az * Math.PI) / 180
    mesh.name = 'inverno:vila'
    mesh.castShadow = o.sombra ?? true
    mesh.receiveShadow = true
    group.add(mesh)
    triangulos += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
  }
  if (o.gltf) {
    try {
      const cena = await new Promise<THREE.Group>((res, rej) =>
        o.gltf!.load('/city/sf/ski-lift-station.glb', (g) => res(g.scene), undefined, rej))
      const [r, az] = [6990, 265]
      const [x, z] = pontoEmRumo(r, az)
      const y = o.heightAt(x, z)
      const caixa = new THREE.Box3().setFromObject(cena)
      cena.position.set(x - (caixa.min.x + caixa.max.x) / 2, y - caixa.min.y, z - (caixa.min.z + caixa.max.z) / 2)
      cena.rotation.y = (az * Math.PI) / 180
      cena.name = 'inverno:estacao'
      let triEstacao = 0
      cena.traverse((k) => {
        const mesh = k as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = o.sombra ?? true
        mesh.receiveShadow = true
        const g = mesh.geometry
        triEstacao += g.index ? g.index.count / 3 : g.attributes.position.count / 3
      })
      group.add(cena)
      triangulos += triEstacao
    } catch (e) {
      console.error('[inverno] estação de teleférico (ski-lift-station.glb) NÃO CARREGOU. A vila sobe só com a caixa.', e)
    }
  } else {
    console.warn('[inverno] sem `gltf`: a estação real não sobe, só a caixa placeholder.')
  }

  // ⚠️ OS PENHASCOS: rocha espalhada de verdade, não só cor de vértice.
  // Segunda técnica do fundador pra atacar "parece bloco repetido", e a mais
  // barata das três (ele mesmo disse): mesmo com o relevo vindo de scan
  // real, uma silhueta 100% lisa nas encostas ainda lê como escultura. O
  // pacote (`rocks-stylized-pack.glb`, CC-BY, PolyOne Studio) virou UM mesh
  // só na conversão (o Blender uniu as peças do pack), então cada instância
  // aqui é um agrupamento pequeno de pedras, não uma pedra igual repetida:
  // ESCALA e GIRO por instância ainda variam, o que evita ler como carimbo.
  if (o.gltf) {
    try {
      const cena = await new Promise<THREE.Group>((res, rej) =>
        o.gltf!.load('/city/sf/rocks-stylized-pack.glb', (g) => res(g.scene), undefined, rej))
      let malha: THREE.Mesh | null = null
      cena.traverse((k) => { if (!malha && (k as THREE.Mesh).isMesh) malha = k as THREE.Mesh })
      if (malha) {
        const geoRocha = (malha as THREE.Mesh).geometry
        const matRocha = (malha as THREE.Mesh).material as THREE.Material
        const candidatosRocha: { x: number; z: number; y: number; esc: number; giro: number }[] = []
        const passos = Math.ceil((R_QUEDA - R_PE) / 45)
        for (let ir = 0; ir <= passos; ir++) {
          const r = R_PE + ir * 45
          const passoAz = (45 / r) * (180 / Math.PI)
          for (let az = AZ0 - 5; az <= AZ1 + 5; az += passoAz) {
            const jr = (hash2(ir, Math.round(az * 10), 601) - 0.5) * 45 * 0.8
            const jaz = (hash2(ir, Math.round(az * 10), 602) - 0.5) * passoAz * 0.8
            const rr = r + jr, azz = az + jaz
            const [x, z] = pontoEmRumo(rr, azz)
            const zona = zonaEsquiavelAt(x, z)
            if (zona <= 0.05) continue
            const y = o.heightAt(x, z)
            const d = 15
            const dhx = (o.heightAt(x + d, z) - o.heightAt(x - d, z)) / (2 * d)
            const dhz = (o.heightAt(x, z + d) - o.heightAt(x, z - d)) / (2 * d)
            const inc = (Math.atan(Math.hypot(dhx, dhz)) * 180) / Math.PI
            // só nas faces expostas (a mesma faixa da rocha exposta), e um
            // pouco além, pra ancorar visualmente o pé do penhasco também
            if (inc < 28) continue
            if (pistaProximidade01(x, z) > 0.15) continue
            if (hash2(ir, Math.round(azz * 10), 603) > 0.35) continue // desbasta: nem toda célula vira pedra
            candidatosRocha.push({
              x, z, y,
              esc: 0.6 + hash2(ir, Math.round(azz * 10), 604) * 1.2,
              giro: hash2(ir, Math.round(azz * 10), 605) * Math.PI * 2,
            })
          }
        }
        const TETO_ROCHA = 140
        let usar = candidatosRocha
        if (candidatosRocha.length > TETO_ROCHA) {
          const manter = TETO_ROCHA / candidatosRocha.length
          usar = candidatosRocha.filter((_, i) => hash01(i * 2654435761 + 17) < manter)
        }
        const instRocha = new THREE.InstancedMesh(geoRocha, matRocha, Math.max(1, usar.length))
        instRocha.name = 'inverno:penhascos'
        instRocha.castShadow = o.sombra ?? true
        instRocha.receiveShadow = true
        instRocha.frustumCulled = false
        const m4r = new THREE.Matrix4(), vpr = new THREE.Vector3(), vqr = new THREE.Quaternion()
        const ver = new THREE.Euler(), vsr = new THREE.Vector3()
        for (let i = 0; i < usar.length; i++) {
          const c = usar[i]
          vpr.set(c.x, c.y, c.z)
          ver.set(0, c.giro, 0)
          vqr.setFromEuler(ver)
          vsr.set(c.esc, c.esc, c.esc)
          m4r.compose(vpr, vqr, vsr)
          instRocha.setMatrixAt(i, m4r)
        }
        instRocha.count = usar.length
        instRocha.instanceMatrix.needsUpdate = true
        instRocha.computeBoundingSphere()
        group.add(instRocha)
        const triRocha = geoRocha.index ? geoRocha.index.count / 3 : geoRocha.attributes.position.count / 3
        triangulos += triRocha * usar.length
      } else {
        console.error('[inverno] rocks-stylized-pack.glb carregou mas não tem mesh dentro. Sem penhasco.')
      }
    } catch (e) {
      console.error('[inverno] penhascos (rocks-stylized-pack.glb) NÃO CARREGARAM. A face fica só com a cor de rocha, sem volume.', e)
    }
  } else {
    console.warn('[inverno] sem `gltf`: sem penhasco de verdade, só a cor de rocha do vértice.')
  }

  // os teleféricos
  const t1 = construirTeleferico(7000, 268, 8280, 268, 6, o.heightAt)
  t1.pilones.name = 'inverno:teleferico:principal:pilones'
  t1.cabo.name = 'inverno:teleferico:principal:cabo'
  group.add(t1.pilones, t1.cabo)
  triangulos += t1.triangulos

  const t2 = construirTeleferico(6950, 273, 8220, 261, 4, o.heightAt)
  t2.pilones.name = 'inverno:teleferico:parque:pilones'
  t2.cabo.name = 'inverno:teleferico:parque:cabo'
  group.add(t2.pilones, t2.cabo)
  triangulos += t2.triangulos

  for (const m of [t1.pilones, t2.pilones]) { m.castShadow = o.sombra ?? true; m.frustumCulled = false }

  // ⚠️ A FLORESTA É ADITIVA. `construirFloresta` devolve `null` sem `gltf`,
  // sem os dois `.glb`, ou se os dois falharem ao carregar: o resto do
  // parque (pistas, halfpipe, vila, teleféricos) já subiu e continua de pé.
  let floresta: Floresta | null = null
  try {
    floresta = await construirFloresta(o)
    if (floresta) {
      floresta.group.name = 'inverno:floresta'
      group.add(floresta.group)
      triangulos += floresta.triangulos
    } else {
      console.warn('[inverno] floresta não subiu: sem `gltf` ou os .glb falharam ao carregar')
    }
  } catch (e) {
    console.error('[inverno] floresta não subiu', e)
  }

  const [ccx, ccz] = pontoEmRumo(7800, 268)
  o.culler?.add(group, 26000, new THREE.Vector3(ccx, 0, ccz))

  return {
    group,
    triangulos: Math.round(triangulos),
    medidas,
    arvores: floresta?.arvores ?? 0,
    update(cam: THREE.Vector3) { floresta?.update(cam) },
    dispose() {
      group.traverse((k) => {
        const mesh = k as THREE.Mesh
        if ((mesh as THREE.Mesh).isMesh) {
          mesh.geometry.dispose()
          const mat = mesh.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose?.()
        }
      })
      group.clear()
    },
  }
}
