// A órbita: cada transação de DOG pendente é uma nave circulando sobre a praça;
// o bloco é a janela de pouso e as naves do bloco descem no spaceport, uma atrás
// da outra. Spec: praca-central.md §1 (metáfora D1, "órbita e pouso").
//
// Regras de leitura, escritas antes do código:
//   • taxa manda na ALTITUDE: quem paga a taxa rápida voa baixo (perto de pousar),
//     quem paga o mínimo voa alto. A ordem visível é a ordem econômica.
//   • quantia manda no TAMANHO da nave, em escala log: 10 mil DOG é uma cápsula,
//     100 milhões é um cargueiro. Nunca linear, senão uma tx grande esconde a praça.
//   • a nave é um FOGUETE de aço inox no desenho de uma Starship, com "$DOG" na
//     fuselagem (pedido do fundador: "estilo SpaceX, escrito $DOG"): ogiva, corpo
//     de virolas soldadas, quatro flaps, seis sinos de motor, carenagem de perna
//     e o lado do escudo térmico em preto ladrilhado.
//     Voa de nariz em órbita e vira em pé para pousar, como a de verdade.
//   • ⚠️ O ACABAMENTO É TODO EM MATERIAL, A SILHUETA É QUE É GEOMETRIA. Linha de
//     painel, cordão de solda, ladrilho do escudo, fuligem dos motores e a
//     variação de brilho ao longo do corpo vivem em três mapas gerados em canvas
//     (cor, rugosidade, normal), compartilhados por TODAS as naves. O motivo é a
//     conta de escala: dezenas de naves ao mesmo tempo multiplicam qualquer
//     custo por nave, e o que a cena não tem folga é CHAMADA DE DESENHO.
//   • a nave que o visitante está seguindo ganha halo branco e maior.
//   • nada aqui decide estado. Entrar, pousar e cair chegam prontos do feed.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { isDonation, type DogTx } from './feed'

export const ORBIT_CENTER = new THREE.Vector3(0, 0, 0)

// ⚠️ A ESTAÇÃO SAIU DE DEBAIXO DA ABÓBADA em 28/08/2026, por ordem do fundador,
// e o motivo é simples: foguete não atravessa a casca. O modelo veio do Blender
// com o pad assado em (-140, 3090), raio 3.093 m, e a saia da abóbada fecha em
// 3.458 m, ou seja a estação inteira estava por dentro. O deslocamento leva o
// centro para o raio 5.150 no MESMO rumo, o que preserva o enquadramento do
// herói (a estação no horizonte, atrás do castelo) e deixa 350 m de chão livre
// entre a borda da casca e a testa da pegada de 845 por 599 m.
// ⚠️ ESTE NÚMERO JÁ MUDOU DUAS VEZES NO MESMO DIA, e sempre pelo mesmo motivo:
// ele é um DERIVADO do raio do sítio, não uma escolha. Foi 3.093 (dentro da
// casca), virou 4.400 quando a casca fechou em 3.500, e virou 5.150 quando o
// sítio cresceu para 4.500 para o lote mediano subir de 153 para 250 m². Se o
// raio mexer de novo, este vetor mexe junto ou o foguete volta a atravessar o
// vidro.
// O +19,8 em y é medido por raio no terreno: o chão passa de 37,7 m no sítio
// velho para 57,5 m no novo, e sem isso o pátio afunda.
// ⚠️ ISTO TAMBÉM MOVE AS VAGAS DE POUSO. Elas são coordenadas de mundo e vivem
// coladas ao modelo: mexer numa sem a outra põe nave pousando no vazio.
// ⚠️ E MUDOU UMA TERCEIRA VEZ, 30/08, PELO MESMO MOTIVO DE SEMPRE. A casca foi a
// 8.600 e depois a 7.050 no mesmo dia e este vetor ficou parado: o spaceport
// terminou a 5.150 do centro, ou seja **1.900 m DENTRO da abóbada**, com o
// foguete decolando de dentro do vidro. O fundador viu na chapa.
//
// ⚠️ E DE 7.800 PARA 9.200 NA MESMA TARDE, por respiro: "o spaceport me parecia
// muito perto da cúpula". Estava mesmo — com o complexo de 740 m, a testada dele
// ficava a 500 m da saia da abóbada. Para veículo classe Starship a faixa de
// segurança de lançamento é da ordem de 1,5 a 2 km; em 9.200 a testada fica a
// 1.780 m da casca.
//
// O rumo não muda (182,6°, o do Portão da Abóbada e do Farol). O raio saiu de
// medir o TERRENO: entre 8.400 e 9.200 há um platô com 0,6 a 1,1% de declive,
// e pátio de lançamento quer chão manso. Fora dele o declive volta a 5%.
// ⚠️ O y SE MEDE NA CENA, NÃO NUM MODELO DE TERRENO À PARTE. Eu calculei +78 m
// para o chão em 9.200 com uma réplica do heightmap e o `Regolith` da cena
// devolve 153: a réplica não tinha tudo (fade do pódio, cova, monte). Com o y
// tirado da réplica o pátio saiu 125 m ENTERRADO. O valor bom vem de raycast no
// próprio regolito: base do modelo em −10 no espaço dele, chão em 153, embute 5.
//
// ⚠️ E O TÚNEL DA ECLUSA ACOMPANHA. O portal externo dele é no pátio, não na
// casca: mover um sem o outro deixa o passageiro descendo do foguete a 1,4 km
// da porta. Ver `_eclusa('Spaceport', ...)` em scripts/gerar_cidade.py.
//
// ⚠️ SE `DOME_R` EM dome.ts MUDAR, ESTE VETOR MUDA JUNTO. É a terceira vez.
// ⚠️ O PÁTIO SAIU +2.000 m EM 02/09, e não por gosto: a casca foi de 7.050 para
// 9.050 e o respiro medido do pátio caía de 2.150 m para 150 m, ou seja o
// spaceport ficaria colado no vidro. O deslocamento é ao longo do rumo 182,6°,
// que é o eixo dele, então o enquadramento não gira: o pátio sai de r 9.200 para
// r 11200 e o respiro volta a ser 2.150 m.
// ⚠️ O y FOI DE 158 PARA 195,4 EM 02/09, E EU DEVIA TER FEITO ISSO JUNTO COM O
// DESLOCAMENTO HORIZONTAL. Quando o pátio saiu de r 9.200 para 11.200 eu mexi só
// em x e z. O y estava calibrado para o chão do lugar VELHO, medido em 153; no
// lugar novo o raycast no regolito dá 190,4. Consequência medida: a base do
// modelo (que fica em -10 no espaço dele) caía em 148, ou seja 42 m ENTERRADA, e
// as vagas de pouso ficavam 45 m ACIMA do chão. O fundador viu naves flutuando
// sobre regolito pelado com o pátio escondido embaixo.
//
// A regra é a mesma de antes: base do modelo 5 m dentro do chão, logo
// y = chao + 10 + 5 = 190,4 + 15 = 205,4 menos os 10 do offset do modelo = 195,4.
//
// ⚠️ E O y SE MEDE POR RAYCAST NO REGOLITO DA CENA, NUNCA POR RÉPLICA DO
// HEIGHTMAP. Já está escrito acima e eu repeti o erro de outra forma: uma grade
// de 40 m amostrada fora da cena deu 95 m para este mesmo ponto, 95 metros de
// diferença, porque não tem o pódio, a cova nem o monte.
export const SPACEPORT_SHIFT = new THREE.Vector3(-368.0, 195.4, 8098.4)

const desloca = (v: THREE.Vector3) => v.add(SPACEPORT_SHIFT)

/** O pad principal do spaceport, já no lugar novo, fora da abóbada. */
export const PAD_MAIN = desloca(new THREE.Vector3(-140, 77.5, 3090))
/** Vagas de pouso em volta do pad principal, para um bloco com várias naves. */
const PAD_SPOTS: THREE.Vector3[] = [
  PAD_MAIN.clone(),
  desloca(new THREE.Vector3(-380, 23.5, 3300)), // SP_Pad0
  desloca(new THREE.Vector3(-60, 77.5, 3160)),
  desloca(new THREE.Vector3(-220, 77.5, 3160)),
  desloca(new THREE.Vector3(-60, 77.5, 3020)),
  desloca(new THREE.Vector3(-220, 77.5, 3020)),
  desloca(new THREE.Vector3(-300, 60, 3120)),
  desloca(new THREE.Vector3(20, 80, 3090)),
]

// ── o teto da abóbada empurra a órbita para cima ───────────────────────────
// As naves circulam ACIMA da casca, também por ordem do fundador. A banda de
// altitude continua codificando a taxa (rápida embaixo, lenta em cima), ela só
// sobe inteira. Zero quando não há abóbada na cena, e é por isso que a /city
// que está no ar não muda de aparência enquanto a casca não for aprovada.
let pisoOrbita = 0
/** Chamado pela cena quando a abóbada sobe. `y` é quanto a banda inteira sobe. */
export function setOrbitFloor(y: number) { pisoOrbita = Math.max(0, y) }

const DOG_ORANGE = new THREE.Color('#F7931A')
// ⚠️ CAUDA VERMELHA É DOAÇÃO PARA A CIDADE (fundador, 2026-08-24). Vermelho
// porque é a única cor forte que a praça ainda não usa: laranja é o DOG, o verde
// está reservado para estado e o roxo foi banido por colidir com o azul. Quem
// olha a órbita e vê um rastro vermelho sabe, sem legenda, que alguém acabou de
// bancar um pedaço da cidade.
const DONATION_RED = new THREE.Color('#FF3B30')
const DOG_HOT = new THREE.Color('#FFB35C')
const FOLLOW_WHITE = new THREE.Color('#FFFFFF')
/** Nariz para cima: leva o +z do modelo ao +y do mundo. */
const UPRIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)

type Phase = 'orbit' | 'landing' | 'parked' | 'dropping'

interface Ship {
  tx: DogTx
  group: THREE.Group
  /** As duas malhas do LOD (perto, longe). Compartilham geometria e material. */
  meshes: THREE.Mesh[]
  /** true quando a nave ganhou um material só dela (a queda faz fade nele). */
  ownMat: boolean
  glow: THREE.Sprite
  hit: THREE.Mesh
  trail: THREE.Line
  trailPts: THREE.Vector3[]
  trailAt: number
  phase: Phase
  // órbita
  radius: number
  altitude: number
  omega: number
  phase0: number
  tilt: number
  // pouso / queda
  curve: THREE.CatmullRomCurve3 | null
  t0: number
  dur: number
  spot: THREE.Vector3 | null
  parkedAt: number
  followed: boolean
  size: number
  flightQ: THREE.Quaternion
}

export interface OrbitLayer {
  group: THREE.Group
  enter: (tx: DogTx, opts?: { silent?: boolean }) => void
  land: (tx: DogTx, opts?: { silent?: boolean }) => void
  drop: (tx: DogTx) => void
  /** Uma nave já pousada (na carga inicial), sem animação. */
  park: (tx: DogTx) => void
  update: (t: number, dt: number, fees: { fast: number | null; slow: number | null }) => void
  pick: (raycaster: THREE.Raycaster) => DogTx | null
  follow: (txid: string | null) => DogTx | null
  positionOf: (txid: string) => THREE.Vector3 | null
  count: () => { orbit: number; landing: number; parked: number }
  dispose: () => void
}

function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function sizeFor(dog: number): number {
  // 1e3 → 40 m · 1e5 → 64 m · 1e7 → 88 m · 1e9 → 112 m
  //
  // ⚠️ DOBROU EM 01/09 (fundador: "os foguetes vão precisar dobrar de tamanho,
  // no mínimo, eles praticamente sumiram"). A faixa era de 16 a 60 m, que é a
  // proporção honesta de uma Starship (50 m), e é exatamente por isso que não
  // funcionava: a nave é lida de DENTRO da cidade, e o pad fica a 5.150 m do
  // centro. A conta que explica o sumiço: com a câmera de 42° em 1440 px cada
  // pixel vale 0,029°, então um foguete de 60 m a 5 km mede
  // atan(60/5000) = 0,69°, ou 23 px de altura. Vinte e três pixels a 5 km, com o
  // céu preto atrás, é um risco, não uma nave.
  //
  // Com 120 m ele mede 47 px, que já se lê como objeto. Escala real perdida,
  // leitura ganha, e o precedente já existe: um Saturno V tem 110 m. Isto é
  // cidade virtual, o critério é a tela.
  //
  // ⚠️ SE MEXER AQUI, MEXA NA TORRE JUNTO. A torre de lançamento
  // (`sp-strongback` em props-table.ts) tem 58 m de altura nativa e a escala
  // dela foi para 2 pela mesma razão: torre mais baixa que o foguete que ela
  // serve lê como erro na hora.
  return THREE.MathUtils.clamp(4 + 12 * Math.log10(Math.max(1, dog)), 32, 120)
}

/** Altitude pela taxa, relativa à faixa rápida do momento: rápida ou acima → baixo,
 *  mínimo → alto. Sem cotação (feed frio) cai no meio. */
export function altitudeFor(feeRate: number | null, fast: number | null, slow: number | null): number {
  const lo = 330 + pisoOrbita, hi = 760 + pisoOrbita
  if (feeRate == null) return (lo + hi) / 2
  const f = fast ?? 3, s = slow ?? 1
  const span = Math.max(0.5, f - s)
  const k = THREE.MathUtils.clamp((feeRate - s) / span, 0, 1) // 0 = lento, 1 = rápido
  return hi - k * (hi - lo)
}

// ── a pele da nave: três mapas, um único conjunto para TODAS as naves ────────
// ⚠️ A CONTA QUE MANDA NESTE ARQUIVO: `sizeFor` põe a nave entre 32 e 120 m e
// pode haver dezenas em órbita ao mesmo tempo, uma por transação pendente. Logo
// TODO detalhe que custa triângulo é multiplicado por dezenas, e todo detalhe
// que custa CHAMADA DE DESENHO é multiplicado por dezenas numa cena que já está
// em ~570 chamadas. Por isso a regra aqui é: linha de painel, anel de solda,
// fuligem e variação de brilho vivem em TEXTURA; só a silhueta vira geometria,
// e a geometria toda da nave é FUNDIDA numa malha só.
//
// Layout dos três mapas (mesmo layout nos três, é o mesmo UV):
//   • v ∈ [0,06 · 1] = o CORPO. v = 0,06 é a cauda (base da imagem, flipY) e
//     v = 1 é a ponta da ogiva. O v do Lathe é reescrito por POSIÇÃO no eixo,
//     não pelo índice do ponto do perfil, senão a cadência dos anéis mente.
//   • v ∈ [0 · 0,06] = um ATLAS de peças: metade esquerda (u < 0,5) é o flap,
//     metade direita é o sino do motor. Assim flap e motor entram na MESMA
//     malha e no MESMO material do corpo, e a nave inteira é 1 chamada.
const TEX_W = 1024, TEX_H = 512
const ATLAS_V = 0.06                 // fatia de v reservada para o atlas de peças
const BODY_H = TEX_H * (1 - ATLAS_V) // altura em px da região do corpo
// ⚠️ FATOR DE ESTICAMENTO DO TEXTO, RECALCULADO. O u dá a volta no casco:
// 1024 px valem 2π·0,09 = 0,565 de comprimento, ou seja 1811 px por unidade.
// O v agora anda com a POSIÇÃO: 481 px (BODY_H) por unidade de comprimento.
// Texto escrito ao longo do eixo precisa do avanço encolhido por 481/1811.
const ALONG = BODY_H / (TEX_W / (2 * Math.PI * 0.09))
const RINGS = 26                     // virolas: 50 m / 1,9 m é o passo do Starship

interface ShipMaps { map: THREE.Texture; rough: THREE.Texture; normal: THREE.Texture }

function makeShipMaps(): ShipMaps {
  const W = TEX_W, H = TEX_H, HB = BODY_H
  const novo = () => {
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    return { c, x: c.getContext('2d')! }
  }
  const A = novo(), R = novo(), N = novo()   // albedo, rugosidade, normal
  const a = A.x, r = R.x, n = N.x

  // y da imagem para uma altura z ∈ [0,1] do corpo (0 = cauda, 1 = ponta)
  const by = (z: number) => (1 - z) * HB

  // ── base ──────────────────────────────────────────────────────────────────
  const g = a.createLinearGradient(0, 0, 0, HB)
  g.addColorStop(0, '#dcdfe4'); g.addColorStop(0.45, '#c2c6cd'); g.addColorStop(1, '#cfd2d7')
  a.fillStyle = g; a.fillRect(0, 0, W, HB)
  r.fillStyle = '#4a4a4a'; r.fillRect(0, 0, W, H)     // 0,29: inox escovado
  n.fillStyle = '#8080ff'; n.fillRect(0, 0, W, H)     // normal neutra

  // brilho variando ao longo do corpo: faixas largas de rugosidade, sem feição
  // que o olho consiga identificar (armadilha do ladrilho, armadilhas-3d.md)
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * HB, h = 2 + Math.random() * 9
    const k = 0.18 + Math.random() * 0.34
    r.fillStyle = `rgba(${Math.round(k * 255)},${Math.round(k * 255)},${Math.round(k * 255)},0.5)`
    r.fillRect(0, y, W, h)
    a.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`
    a.fillRect(0, y, W, h)
  }

  // ── anel de solda e linha de painel: o detalhe que entrega escala ──────────
  // Cada virola ganha (1) uma junta escura, (2) um cordão de solda claro logo
  // acima e (3) um degrau na normal, que é o que dá SOMBRA PRÓPRIA de perto.
  for (let i = 1; i < RINGS; i++) {
    const y = Math.round(by(i / RINGS))
    a.fillStyle = 'rgba(64,68,76,0.42)'; a.fillRect(0, y, W, 2)
    a.fillStyle = 'rgba(255,255,255,0.28)'; a.fillRect(0, y - 2, W, 1)
    r.fillStyle = 'rgba(150,150,150,0.75)'; r.fillRect(0, y - 2, W, 4) // solda é fosca
    // cordão: sobe de um lado e desce do outro no canal verde (eixo v)
    n.fillStyle = 'rgba(128,190,255,1)'; n.fillRect(0, y - 2, W, 2)
    n.fillStyle = 'rgba(128,66,255,1)'; n.fillRect(0, y, W, 2)
    // costura vertical das chapas, desencontrada a cada virola para não virar grade
    const off = (i * 0.37) % 1
    for (let k = 0; k < 6; k++) {
      const x = Math.round(((k / 6 + off) % 1) * W)
      a.fillStyle = 'rgba(72,76,84,0.30)'; a.fillRect(x, y, 1.5, Math.round(HB / RINGS))
    }
  }

  // ── escudo térmico: metade da circunferência centrada em u = 0 ────────────
  // (o −y do modelo: a barriga em voo, o lado sul no pouso). As bordas caem em
  // u = 0,25 e 0,75, onde estão os flaps, como no Starship.
  const shieldTop = by(0.94)
  for (const x0 of [0, W * 0.75]) {
    a.fillStyle = '#15161a'; a.fillRect(x0, shieldTop, W * 0.25, HB - shieldTop)
    r.fillStyle = '#e0e0e0'; r.fillRect(x0, shieldTop, W * 0.25, HB - shieldTop) // cerâmica é fosca
  }
  // ladrilho hexagonal aproximado: linhas nos dois sentidos, finas
  for (const x0 of [0, W * 0.75]) {
    for (let i = 0; i < 60; i++) {
      const y = shieldTop + (i / 60) * (HB - shieldTop)
      a.fillStyle = 'rgba(255,255,255,0.07)'; a.fillRect(x0, y, W * 0.25, 1)
      n.fillStyle = 'rgba(128,150,255,0.6)'; n.fillRect(x0, y, W * 0.25, 1)
    }
    for (let k = 0; k < 22; k++) {
      const x = x0 + (k / 22) * W * 0.25
      a.fillStyle = 'rgba(255,255,255,0.05)'; a.fillRect(x, shieldTop, 1, HB - shieldTop)
    }
  }
  // a borda do escudo é uma linha viva, é ela que se lê a distância
  a.fillStyle = 'rgba(40,42,48,0.9)'
  a.fillRect(W * 0.25 - 2, shieldTop, 3, HB - shieldTop)
  a.fillRect(W * 0.75 - 1, shieldTop, 3, HB - shieldTop)

  // ── linha de separação de estágio: uma cinta mais pesada no pé do corpo ────
  const sep = by(0.085)
  a.fillStyle = 'rgba(52,56,64,0.55)'; a.fillRect(0, sep - 5, W, 10)
  a.fillStyle = 'rgba(255,255,255,0.22)'; a.fillRect(0, sep - 7, W, 2)
  r.fillStyle = 'rgba(160,160,160,0.8)'; r.fillRect(0, sep - 7, W, 14)

  // ── DESGASTE ORIENTADO: fuligem subindo dos motores ───────────────────────
  // ⚠️ metal limpo e uniforme é a assinatura de render amador. A fuligem é o que
  // separa "cilindro branco" de "veículo que já voou".
  const soot = a.createLinearGradient(0, HB, 0, by(0.26))
  soot.addColorStop(0, 'rgba(18,18,20,0.85)')
  soot.addColorStop(0.35, 'rgba(28,28,32,0.45)')
  soot.addColorStop(1, 'rgba(30,30,34,0)')
  a.fillStyle = soot; a.fillRect(0, by(0.26), W, HB - by(0.26))
  const sootR = r.createLinearGradient(0, HB, 0, by(0.26))
  sootR.addColorStop(0, 'rgba(230,230,230,0.9)')
  sootR.addColorStop(1, 'rgba(230,230,230,0)')
  r.fillStyle = sootR; r.fillRect(0, by(0.26), W, HB - by(0.26))
  // línguas de fuligem irregulares, senão a borda do gradiente lê como faixa
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * W, h = (0.06 + Math.random() * 0.20) * HB
    a.fillStyle = `rgba(20,20,24,${0.10 + Math.random() * 0.18})`
    a.fillRect(x, HB - h, 8 + Math.random() * 60, h)
  }

  // ── a marca ───────────────────────────────────────────────────────────────
  // "$DOG" ao longo do eixo, lendo da cauda para a ponta: no lado limpo
  // (u = 0,5, o +y do modelo: o céu em voo, a praça no pouso) e no escudo
  // (u = 0), para ler também de baixo.
  const word = (cx: number, cy: number, text: string, px: number, color: string) => {
    a.save()
    a.translate(cx, cy)
    a.rotate(-Math.PI / 2)
    a.scale(ALONG, 1)
    a.fillStyle = color
    a.font = 'bold ' + px + 'px "JetBrains Mono", "DM Sans", system-ui, sans-serif'
    a.textAlign = 'center'; a.textBaseline = 'middle'
    a.fillText(text, 0, 0)
    a.restore()
  }
  word(W * 0.5, by(0.44), '$DOG', 300, '#F7931A')
  word(0, by(0.44), '$DOG', 300, '#F7931A')
  word(W, by(0.44), '$DOG', 300, '#F7931A') // a metade que sobra do escudo (u = 1)
  word(W * 0.5, by(0.15), 'DOGCITY', 56, '#1a1a1e')
  // anel de aviso na saia dos motores, já por baixo da fuligem
  a.fillStyle = 'rgba(247,147,26,0.75)'; a.fillRect(0, HB - 8, W, 8)

  // ── ATLAS DE PEÇAS (v < 0,06) ─────────────────────────────────────────────
  // esquerda = flap (grafite com nervura), direita = sino do motor (gradiente da
  // garganta para a saída, escurecendo, com canaleta de refrigeração).
  const ay0 = HB, ah = H - HB
  a.fillStyle = '#26272d'; a.fillRect(0, ay0, W * 0.5, ah)
  r.fillStyle = '#c0c0c0'; r.fillRect(0, ay0, W * 0.5, ah)
  for (let k = 0; k < 40; k++) {
    const x = (k / 40) * W * 0.5
    a.fillStyle = 'rgba(255,255,255,0.06)'; a.fillRect(x, ay0, 2, ah)
    n.fillStyle = 'rgba(150,128,255,1)'; n.fillRect(x, ay0, 1, ah)
  }
  const bell = a.createLinearGradient(0, H, 0, ay0) // baixo = garganta, topo = saída
  bell.addColorStop(0, '#6a5b4e'); bell.addColorStop(0.45, '#3a3a3e'); bell.addColorStop(1, '#17171a')
  a.fillStyle = bell; a.fillRect(W * 0.5, ay0, W * 0.5, ah)
  r.fillStyle = '#707070'; r.fillRect(W * 0.5, ay0, W * 0.5, ah)
  for (let k = 0; k < 64; k++) {
    const x = W * 0.5 + (k / 64) * W * 0.5
    a.fillStyle = 'rgba(0,0,0,0.30)'; a.fillRect(x, ay0, 2, ah)
    n.fillStyle = 'rgba(96,128,255,1)'; n.fillRect(x, ay0, 1, ah)
    n.fillStyle = 'rgba(160,128,255,1)'; n.fillRect(x + 2, ay0, 1, ah)
  }

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  }
  // ⚠️ rugosidade e normal são DADO, não cor: se forem para sRGB o three
  // aplica a curva e o inox vira plástico.
  return { map: tex(A.c, true), rough: tex(R.c, false), normal: tex(N.c, false) }
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,220,170,0.85)')
  g.addColorStop(0.45, 'rgba(255,150,40,0.28)')
  g.addColorStop(1, 'rgba(255,120,20,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createOrbitLayer(): OrbitLayer {
  const group = new THREE.Group()
  group.name = 'OrbitLayer'
  const ships = new Map<string, Ship>()
  const glowTex = makeGlowTexture()

  // ── o foguete: DUAS geometrias fundidas (perto e longe), UM material ──────
  // ⚠️ A CONTA DA CHAMADA DE DESENHO. Antes desta versão cada nave era 10 objetos
  // (casco + 4 flaps + 3 motores + halo + rastro): com 30 naves em órbita isso é
  // 300 chamadas numa cena que já mede ~570. Casco, flaps, sinos e pernas agora
  // são UMA malha, com UM material, porque flap e motor foram parar num atlas
  // dentro da mesma textura. A nave passou a custar 3 chamadas (malha + halo +
  // rastro), ou seja 90 para 30 naves: ~210 chamadas devolvidas para a cena.
  //
  // ⚠️ E TEM LOD. A nave em órbita alta mede poucos pixels e detalhe sub-pixel
  // cintila (armadilhas-3d.md, "geometria fina"). Cada nave é um THREE.LOD, que
  // o próprio renderer resolve por distância sem que ninguém precise passar a
  // câmera para o `update` daqui.
  const R = 0.09 // proporção de Starship: 9 m de diâmetro para 50 m de altura

  /** Reescreve o uv de uma peça para dentro de um retângulo do atlas. */
  const atlasUV = (g: THREE.BufferGeometry, u0: number, u1: number, v0: number, v1: number) => {
    const uv = g.attributes.uv as THREE.BufferAttribute
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i)
      if (u < minU) minU = u; if (u > maxU) maxU = u
      if (v < minV) minV = v; if (v > maxV) maxV = v
    }
    const du = maxU - minU || 1, dv = maxV - minV || 1
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i,
        u0 + ((uv.getX(i) - minU) / du) * (u1 - u0),
        v0 + ((uv.getY(i) - minV) / dv) * (v1 - v0))
    }
    uv.needsUpdate = true
    return g
  }
  const FLAP_UV = [0.01, 0.48, 0.006, 0.054] as const
  const BELL_UV = [0.52, 0.99, 0.006, 0.054] as const

  /** Casco de revolução. `seg` é a resolução em volta; o v sai da POSIÇÃO no eixo. */
  const hullGeo = (seg: number, fatias: number) => {
    const pts: THREE.Vector2[] = []
    pts.push(new THREE.Vector2(0.0, 0.0))
    pts.push(new THREE.Vector2(R * 0.70, 0.0))       // a saia dos motores
    pts.push(new THREE.Vector2(R * 0.76, 0.014))     // o alargamento da saia
    pts.push(new THREE.Vector2(R, 0.034))
    for (let i = 1; i <= fatias; i++) pts.push(new THREE.Vector2(R, 0.034 + (0.626 * i) / fatias))
    for (let i = 1; i <= Math.max(4, Math.round(fatias * 0.8)); i++) {   // ogiva
      const nOg = Math.max(4, Math.round(fatias * 0.8))
      const t = i / nOg
      pts.push(new THREE.Vector2(R * Math.cos((t * Math.PI) / 2) * (1 - 0.15 * t), 0.66 + 0.34 * t))
    }
    const g = new THREE.LatheGeometry(pts, seg)
    g.rotateX(Math.PI / 2) // o Lathe nasce em torno de +y; a nave voa em +z
    // ⚠️ O v DO LATHE ANDA COM O ÍNDICE DO PONTO, e índice não é comprimento: com
    // o perfil desigual a cadência dos anéis de solda mentiria e o "$DOG"
    // escorreria. Reescrito por posição no eixo, dentro da faixa do corpo.
    const pos = g.attributes.position as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const z = THREE.MathUtils.clamp(pos.getZ(i), 0, 1)
      uv.setY(i, ATLAS_V + z * (1 - ATLAS_V))
    }
    uv.needsUpdate = true
    return g
  }

  /** Pá trapezoidal: raiz longa no casco, ponta recuada. */
  const flapBase = (() => {
    const sh = new THREE.Shape()
    sh.moveTo(0, 0); sh.lineTo(0.10, 0.025); sh.lineTo(0.10, 0.11); sh.lineTo(0.03, 0.17); sh.lineTo(0, 0.17); sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false })
    g.rotateX(Math.PI / 2) // (x, y, z) → (x, −z, y): o comprimento cai em +z, a espessura em y
    atlasUV(g, FLAP_UV[0], FLAP_UV[1], FLAP_UV[2], FLAP_UV[3])
    return g.toNonIndexed()
  })()

  /** Os quatro flaps: dois traseiros grandes, dois dianteiros menores.
   *  ⚠️ O ESPELHO É ROTAÇÃO, NÃO ESCALA NEGATIVA. `scale(-1,1,1)` inverte o
   *  sentido do triângulo e a peça fica avessa; a versão anterior tinha dois
   *  flaps virados do avesso. Girar π em torno do eixo da nave põe a pá no lado
   *  −x com o sentido preservado. */
  const flapsGeo = () => {
    const out: THREE.BufferGeometry[] = []
    for (const [z, sc, lado] of [[0.085, 1, 1], [0.085, 1, -1], [0.70, 0.62, 1], [0.70, 0.62, -1]] as const) {
      const f = flapBase.clone()
      f.scale(sc, sc, sc)
      f.translate(R * 0.94, 0, 0)
      if (lado < 0) f.rotateZ(Math.PI)
      f.translate(0, 0, z)
      out.push(f)
    }
    return out
  }

  /** Sino de motor: garganta estreita e expansão, é o que muda a leitura de perto.
   *  Aponta para −z (a popa). Aberto dos dois lados, por isso o material é
   *  `DoubleSide`: sem isso o interior do sino é um buraco. */
  const bellBase = (() => {
    const pts = [
      new THREE.Vector2(0.0048, -0.004),
      new THREE.Vector2(0.0062, -0.010),
      new THREE.Vector2(0.0095, -0.019),
      new THREE.Vector2(0.0145, -0.030),
      new THREE.Vector2(0.0195, -0.042),
      new THREE.Vector2(0.0225, -0.055),
    ]
    const g = new THREE.LatheGeometry(pts, 10)
    g.rotateX(Math.PI / 2)
    atlasUV(g, BELL_UV[0], BELL_UV[1], BELL_UV[2], BELL_UV[3])
    return g.toNonIndexed()
  })()

  /** Seis motores, como o Starship: três de vácuo por fora, três de mar por dentro. */
  const enginesGeo = () => {
    const out: THREE.BufferGeometry[] = []
    // ⚠️ O RAIO DA SAIA MANDA: a saia fecha em R·0,70 = 0,063, então a borda de
    // fora do sino mais externo (raio do anel + raio da saída) tem de caber em
    // 0,063 ou os motores ficam mais largos que o foguete. Externos: 0,038 +
    // 0,0225·1,12 = 0,063 na conta.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6
      const e = bellBase.clone(); e.scale(1.12, 1.12, 1.15)
      e.translate(Math.cos(a) * 0.038, Math.sin(a) * 0.038, -0.004)
      out.push(e)
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 6
      const e = bellBase.clone(); e.scale(0.72, 0.72, 0.70)
      e.translate(Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.0)
      out.push(e)
    }
    return out
  }

  /** Carenagem de perna de pouso: quatro caixinhas na saia. Silhueta, não função. */
  const legsGeo = () => {
    const out: THREE.BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      // ⚠️ TEM QUE SAIR DO CASCO. Com o raio do casco em 0,09, uma carenagem
      // centrada em 0,072 ficaria INTEIRA dentro dele e não se veria nada.
      // Centrada em 0,096 ela avança de 0,084 a 0,108, ou seja 0,018 de saliência.
      const b = new THREE.BoxGeometry(0.024, 0.012, 0.060)
      atlasUV(b, FLAP_UV[0], FLAP_UV[1], FLAP_UV[2], FLAP_UV[3])
      const nb = b.toNonIndexed()
      nb.rotateZ(a)
      nb.translate(Math.cos(a) * R * 1.07, Math.sin(a) * R * 1.07, 0.034)
      out.push(nb)
    }
    return out
  }

  // ⚠️ TRIÂNGULO CONTADO NO CÓDIGO, NÃO MEDIDO NO NAVEGADOR (eu não abri o
  // navegador). Perto: casco 32 setores × 25 fatias × 2 = 1.600, mais 4 flaps de
  // 16 = 64, mais 6 sinos de 10 × 5 × 2 = 600, mais 4 pernas de 12 = 48, ou seja
  // 2.312 por nave. Trinta naves de perto dão 69 mil triângulos, 1,3% dos 5,5 M
  // da cena. Longe: 12 × 11 × 2 = 264 mais os flaps, 328 por nave. A folga está
  // em triângulo, e é por isso que o ganho todo foi buscado na chamada de desenho.
  const rocketNear = mergeGeometries(
    [hullGeo(32, 12).toNonIndexed(), ...flapsGeo(), ...enginesGeo(), ...legsGeo()], false,
  )!
  const rocketFar = mergeGeometries([hullGeo(12, 4).toNonIndexed(), ...flapsGeo()], false)!
  const hitGeo = new THREE.SphereGeometry(1, 8, 8)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  const maps = makeShipMaps()
  // ⚠️ UM MATERIAL PARA TODAS AS NAVES, TRÊS AO TODO. Antes era um material novo
  // por nave (`steelMat(hot)` dentro de `makeShip`). Material novo não custa
  // chamada, mas custa cache de programa e cada nave que caía chamava `dispose`
  // nele; com material compartilhado o `dispose` de uma nave apagaria a pintura
  // de todas, e é por isso que `remove` só descarta material PRÓPRIO (ver `ownMat`).
  const steelMat = (emissive: THREE.Color | number, intensity: number) =>
    new THREE.MeshStandardMaterial({
      map: maps.map, roughnessMap: maps.rough, normalMap: maps.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      color: 0xffffff, metalness: 0.9,
      // ⚠️ `roughness` MULTIPLICA `roughnessMap`: com mapa, 1 é o único valor que
      // deixa o mapa mandar (armadilhas-3d.md).
      roughness: 1, envMapIntensity: 1.2,
      side: THREE.DoubleSide, // o sino do motor é aberto
      emissive, emissiveMap: maps.map, emissiveIntensity: intensity,
    })
  const matCold = steelMat(0xffffff, 0.12)
  const matHot = steelMat(DOG_HOT, 0.26)
  const matFollow = steelMat(FOLLOW_WHITE, 0.45)

  let landingQueueAt = 0 // carimbo do último pouso agendado, para escalonar
  let spotIndex = 0
  let followedId: string | null = null

  const makeShip = (tx: DogTx): Ship => {
    // ⚠️ O TAMANHO SEGUE O QUE MUDOU DE MÃO, não o UTXO gasto. Uma consolidação
    // de 600 mil que só se junta a si mesma não merece o foguete de uma baleia.
    const size = sizeFor(tx.dog_net)
    const g = new THREE.Group()
    g.name = `ship:${tx.txid}`
    const hot = tx.dog_net >= 10_000_000
    // o modelo mede 1 de comprimento em +z, cauda em z = 0; escala pelo tamanho
    const mat = hot ? matHot : matCold
    const near = new THREE.Mesh(rocketNear, mat)
    near.castShadow = true
    const far = new THREE.Mesh(rocketFar, mat)
    // ⚠️ A TROCA DE NÍVEL É POR TAMANHO, não uma distância fixa: um cargueiro de
    // 120 m ainda se lê de longe e um de 32 m já não. Com a câmera de 42° em
    // 1440 px, cada pixel vale 0,029°, então a nave sai de ~50 px de altura na
    // distância de troca de 32 m e fica na mesma leitura em toda a faixa.
    const model = new THREE.LOD()
    model.addLevel(near, 0)
    model.addLevel(far, 700 + size * 16)
    model.scale.setScalar(size)
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }),
    )
    glow.scale.setScalar(size * 1.9)
    glow.position.z = -0.14 * size // a chama, atrás da saia
    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.scale.setScalar(size * 0.9)
    hit.position.z = 0.5 * size
    hit.userData.txid = tx.txid
    g.add(model, glow, hit)
    const trailPts = Array.from({ length: 24 }, () => new THREE.Vector3())
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts)
    const trailCol = new Float32Array(24 * 3)
    const tint = isDonation(tx) ? DONATION_RED : DOG_ORANGE
    for (let i = 0; i < 24; i++) {
      const a = 1 - i / 24
      trailCol[i * 3] = tint.r * a
      trailCol[i * 3 + 1] = tint.g * a
      trailCol[i * 3 + 2] = tint.b * a
    }
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    trail.frustumCulled = false
    group.add(g, trail)
    return {
      tx, group: g, meshes: [near, far], ownMat: false, glow, hit, trail, trailPts, trailAt: 0,
      phase: 'orbit',
      radius: 780 + hash01(tx.txid, 1) * 340,
      altitude: 700 + pisoOrbita,
      omega: (Math.PI * 2) / (70 + hash01(tx.txid, 2) * 40),
      phase0: hash01(tx.txid, 3) * Math.PI * 2,
      tilt: (hash01(tx.txid, 4) - 0.5) * 0.28,
      curve: null, t0: 0, dur: 0, spot: null, parkedAt: 0,
      followed: false, size, flightQ: new THREE.Quaternion(),
    }
  }

  const orbitPos = (s: Ship, t: number, out: THREE.Vector3): THREE.Vector3 => {
    const a = s.phase0 + s.omega * t
    const x = Math.cos(a) * s.radius
    const z = Math.sin(a) * s.radius
    // inclinação leve: a órbita sobe de um lado e desce do outro
    const y = s.altitude + Math.sin(a) * s.radius * Math.sin(s.tilt) * 0.35 + Math.sin(t * 0.7 + s.phase0) * 6
    return out.set(x, y, z)
  }

  const setPhase = (s: Ship, p: Phase) => { s.phase = p }

  const nextSpot = (): THREE.Vector3 => {
    const spot = PAD_SPOTS[spotIndex % PAD_SPOTS.length]
    spotIndex++
    return spot.clone()
  }

  /** Troca o material das duas malhas do LOD de uma vez. */
  const setMat = (s: Ship, m: THREE.Material) => { for (const k of s.meshes) k.material = m }

  const remove = (s: Ship) => {
    group.remove(s.group, s.trail)
    s.trail.geometry.dispose()
    ;(s.trail.material as THREE.Material).dispose()
    // ⚠️ NUNCA descarte o material do casco aqui: ele é compartilhado por todas
    // as naves. Só o material PRÓPRIO, o que a queda clona para poder apagar.
    if (s.ownMat) (s.meshes[0].material as THREE.Material).dispose()
    ;(s.glow.material as THREE.Material).dispose()
    ships.delete(s.tx.txid)
  }

  const applyFollow = (s: Ship) => {
    if (s.ownMat) return // a nave em queda tem material próprio, não se mexe nele
    if (s.followed) {
      setMat(s, matFollow)
      ;(s.glow.material as THREE.SpriteMaterial).color.set(0xffffff)
      s.glow.scale.setScalar(s.size * 3.4)
    } else {
      setMat(s, s.tx.dog_net >= 10_000_000 ? matHot : matCold)
      ;(s.glow.material as THREE.SpriteMaterial).color.set(0xffffff)
      s.glow.scale.setScalar(s.size * 1.9)
    }
  }

  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  let clock = 0

  const api: OrbitLayer = {
    group,
    enter(tx, opts) {
      if (ships.has(tx.txid)) return
      const s = makeShip(tx)
      ships.set(tx.txid, s)
      s.followed = followedId === tx.txid
      applyFollow(s)
      if (!opts?.silent) {
        // chega de fora: começa mais alto e mais longe e converge para a órbita
        s.altitude += 400
        s.radius += 900
      }
      orbitPos(s, clock, tmp)
      s.group.position.copy(tmp)
      for (const p of s.trailPts) p.copy(tmp)
    },
    park(tx) {
      if (ships.has(tx.txid)) return
      const s = makeShip(tx)
      ships.set(tx.txid, s)
      s.followed = followedId === tx.txid
      applyFollow(s)
      setPhase(s, 'parked')
      s.spot = nextSpot()
      s.parkedAt = clock
      s.group.position.copy(s.spot)
      s.group.quaternion.copy(UPRIGHT)
      for (const p of s.trailPts) p.copy(s.group.position)
      ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.35
    },
    land(tx, opts) {
      let s = ships.get(tx.txid)
      if (!s) {
        // nunca esteve em órbita para a cena (chegou direto no bloco): entra e pousa
        api.enter(tx, { silent: true })
        s = ships.get(tx.txid)!
      }
      s.tx = tx
      if (s.phase === 'parked') return
      const spot = nextSpot()
      const p0 = s.group.position.clone()
      // continua um trecho na tangente, mergulha para o eixo do pad e desce
      const ahead = orbitPos(s, clock + 6, tmp).clone()
      ahead.y = p0.y - 60
      const above = spot.clone().add(tmp2.set(0, 420, 0))
      const low = spot.clone().add(tmp2.set(0, 70, 0))
      const down = spot.clone()
      s.curve = new THREE.CatmullRomCurve3([p0, ahead, above, low, down], false, 'catmullrom', 0.5)
      // escalona: um pouso a cada 3,5 s dentro do mesmo bloco
      const start = Math.max(clock, landingQueueAt + 3.5)
      landingQueueAt = start
      s.t0 = opts?.silent ? clock - 100 : start
      s.dur = 16
      s.spot = down
      setPhase(s, 'landing')
    },
    drop(tx) {
      const s = ships.get(tx.txid)
      if (!s || s.phase !== 'orbit') return
      // ⚠️ A QUEDA APAGA A NAVE MEXENDO NA EMISSÃO DO MATERIAL, e o material do
      // casco é COMPARTILHADO: sem este clone, uma tx caindo apagaria todas as
      // naves da órbita junto. Custa um material por queda, que é raro e breve.
      const own = (s.meshes[0].material as THREE.MeshStandardMaterial).clone()
      setMat(s, own)
      s.ownMat = true
      const p0 = s.group.position.clone()
      const away = orbitPos(s, clock + 10, tmp).clone().multiplyScalar(2.2)
      away.y = p0.y + 900
      s.curve = new THREE.CatmullRomCurve3([p0, orbitPos(s, clock + 4, tmp2).clone(), away], false, 'catmullrom', 0.5)
      s.t0 = clock
      s.dur = 7
      setPhase(s, 'dropping')
    },
    update(t, dt, fees) {
      clock = t
      for (const s of Array.from(ships.values())) {
        if (s.phase === 'orbit') {
          // altitude e raio convergem para o alvo (novas chegam de longe)
          const target = altitudeFor(s.tx.fee_rate, fees.fast, fees.slow)
          s.altitude += (target - s.altitude) * Math.min(1, dt * 0.35)
          const rTarget = 780 + hash01(s.tx.txid, 1) * 340
          s.radius += (rTarget - s.radius) * Math.min(1, dt * 0.35)
          orbitPos(s, t, tmp)
          const prev = s.group.position.clone()
          s.group.position.copy(tmp)
          tmp2.copy(tmp).sub(prev)
          if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
        } else if (s.phase === 'landing' && s.curve) {
          const u = THREE.MathUtils.clamp((t - s.t0) / s.dur, 0, 1)
          if (u <= 0) {
            orbitPos(s, t, tmp)
            const prev = s.group.position.clone()
            s.group.position.copy(tmp)
            tmp2.copy(tmp).sub(prev)
            if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
            // a curva parte de onde a nave estiver quando a vez dela chegar
            const pts = s.curve.points
            pts[0].copy(tmp)
            s.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
          } else {
            const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2 // ease in-out
            s.curve.getPointAt(e, tmp)
            const prev = s.group.position.clone()
            s.group.position.copy(tmp)
            tmp2.copy(tmp).sub(prev)
            // voa de nariz até 65% do caminho; daí vira em pé (nariz para cima),
            // como uma Starship no flip final, e desce vertical até a cauda tocar
            if (u < 0.65) {
              if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
              s.flightQ.copy(s.group.quaternion)
            } else {
              const k = THREE.MathUtils.smoothstep(u, 0.65, 0.9)
              s.group.quaternion.slerpQuaternions(s.flightQ, UPRIGHT, k)
            }
            ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.95 - 0.5 * Math.max(0, u - 0.8) / 0.2
            if (u >= 1) {
              setPhase(s, 'parked')
              s.parkedAt = t
              s.curve = null
              s.group.quaternion.copy(UPRIGHT)
              ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.2
            }
          }
        } else if (s.phase === 'dropping' && s.curve) {
          const u = THREE.MathUtils.clamp((t - s.t0) / s.dur, 0, 1)
          s.curve.getPointAt(u, tmp)
          const prev = s.group.position.clone()
          s.group.position.copy(tmp)
          tmp2.copy(tmp).sub(prev)
          if (tmp2.lengthSq() > 1e-4) s.group.lookAt(tmp.clone().add(tmp2))
          const fade = 1 - u
          ;(s.glow.material as THREE.SpriteMaterial).opacity = 0.95 * fade
          ;(s.meshes[0].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 * fade
          ;(s.trail.material as THREE.LineBasicMaterial).opacity = 0.55 * fade
          if (u >= 1) { remove(s); continue }
        } else if (s.phase === 'parked') {
          // fica no pátio por dez minutos e taxia para o hangar (some)
          if (t - s.parkedAt > 600) { remove(s); continue }
          const gm = s.glow.material as THREE.SpriteMaterial
          gm.opacity = 0.3 + 0.08 * Math.sin(t * 2 + s.phase0)
        }
        // rastro: só quando voa, amostrado no TEMPO (60 ms) e não por quadro, para o
        // comprimento não depender do frame rate: 24 amostras = 1,4 s de rastro.
        if (s.phase === 'orbit' || s.phase === 'landing' || s.phase === 'dropping') {
          if (t - s.trailAt >= 0.06) {
            const pts = s.trailPts
            // um salto grande (quadro lento, entrada de longe) zera o rastro em vez
            // de riscar uma corda no céu
            if (pts[0].distanceTo(s.group.position) > 260) for (const p of pts) p.copy(s.group.position)
            for (let i = pts.length - 1; i > 0; i--) pts[i].copy(pts[i - 1])
            pts[0].copy(s.group.position)
            s.trail.geometry.setFromPoints(pts)
            s.trailAt = t
          }
          s.trail.visible = true
        } else {
          s.trail.visible = false
        }
      }
    },
    pick(raycaster) {
      const hits: THREE.Mesh[] = []
      for (const s of Array.from(ships.values())) hits.push(s.hit)
      const found = raycaster.intersectObjects(hits, false)
      if (!found.length) return null
      const txid = found[0].object.userData.txid as string
      return ships.get(txid)?.tx ?? null
    },
    follow(txid) {
      followedId = txid
      let found: DogTx | null = null
      for (const s of Array.from(ships.values())) {
        s.followed = s.tx.txid === txid
        applyFollow(s)
        if (s.followed) found = s.tx
      }
      return found
    },
    positionOf(txid) {
      const s = ships.get(txid)
      return s ? s.group.position.clone() : null
    },
    count() {
      let orbit = 0, landing = 0, parked = 0
      for (const s of Array.from(ships.values())) {
        if (s.phase === 'orbit') orbit++
        else if (s.phase === 'landing') landing++
        else if (s.phase === 'parked') parked++
      }
      return { orbit, landing, parked }
    },
    dispose() {
      for (const s of Array.from(ships.values())) remove(s)
      rocketNear.dispose(); rocketFar.dispose(); flapBase.dispose(); bellBase.dispose()
      hitGeo.dispose(); glowTex.dispose(); hitMat.dispose()
      maps.map.dispose(); maps.rough.dispose(); maps.normal.dispose()
      matCold.dispose(); matHot.dispose(); matFollow.dispose()
    },
  }
  return api
}
