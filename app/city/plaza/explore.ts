// ═══════════════════════════════════════════════════════════════════════════════
// O MODO EXPLORAR: andar pela DogCity como num jogo em primeira pessoa.
//
// W/↑ frente · S/↓ ré · A/D passos laterais · ←/→ GIRAM A CÂMERA · SHIFT corre.
// O mouse continua olhando (drag), e tudo funciona AO MESMO TEMPO: girar não é
// exclusividade do mouse — pedido do fundador (14/09): "se eu quero girar só
// consigo com o mouse". Setas laterais viram a cabeça como nos jogos clássicos;
// A e D são o passo lateral de quem já mira com o mouse.
//
// DOIS ANDARES, decididos pela altitude, sem botão:
//
//   PASSEIO (abaixo de 160 m): tecla de movimento é INTENÇÃO DE ANDAR. A câmera
//   PLANA até a rua (descida limitada a 30 m/s, nunca elevador despencando),
//   assenta a altura de olhos (1,8 m) e dali segue o RELEVO — sobe a rua, desce
//   a cratera, atravessa a laje do deck. É o que dá profundidade de gente: as
//   torres voltam a ser altas quando os olhos estão na calçada. E é o que faz a
//   ENTRADA funcionar: o visitante nasce a ~105 m sobre a batalha, aperta ↑ e
//   desce planando para dentro dela, em vez de pairar para sempre. Durante o
//   pouso longo o olhar NIVELA devagar rumo ao horizonte.
//
//   VOO (acima disso): o de antes — desloca o rig na horizontal, velocidade
//   proporcional à altitude, teto de 460 m/s. Viagem longa continua sendo dos
//   voos do menu Places, e as vistas altas (o plano, a órbita) seguem voando.
//
// Este módulo não é um segundo controlador de câmera: ele desloca o RIG inteiro
// (câmera E alvo pela mesma medida) e gira o ALVO em volta da câmera, então o
// OrbitControls continua sendo o único dono da orientação — transladar os dois
// pontos juntos não muda o offset esférico que ele guarda, e girar o alvo em
// volta da câmera é exatamente "virar a cabeça" sem sair do lugar.
//
// ⚠️ VELOCIDADE + AMORTECIMENTO, NUNCA POSIÇÃO += PASSO. Teclado cru dá
// movimento robótico: aqui velocidade e giro perseguem um alvo com suavização
// exponencial independente de framerate (1 - e^(-taxa·dt)), aceleram num ritmo
// e param noutro levemente mais frouxo — arranque respondido, parada com peso.
// Diagonal é NORMALIZADA: ↑+D não anda mais rápido que ↑.
//
// ⚠️ ESTE MÓDULO NÃO SUBSTITUI O CLAMP DE CHÃO da cena (câmera nunca entra no
// regolito, alvo sobe junto, exceção do aquário): o clamp roda DEPOIS deste
// update e continua mandando. O `chao` recebido aqui serve para a altitude do
// voo e para o piso do passeio — a cena passa o chão DE ANDAR, que inclui a
// laje do deck, enquanto o clamp segue com o relevo cru.
//
// Reutilizável de propósito (a cidade vai ganhar lotes, mansões, arena, prédios
// de comunidade): depende só de three, recebe câmera e alvo, e carrega um
// registro de POIs para o dia em que a aproximação de um marco mostrar
// "Vincent Mansion · 25 m" e "[E] ENTER" — a cena decide o desenho, este módulo
// só avisa.
// ═══════════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

/** Um marco anotável do mundo: a cena registra, o controlador avisa a
 *  aproximação. `raio` é a distância em que ele passa a contar (padrão 350 m). */
/** `raio` = a que distância o marco passa a ser anunciado (padrão 350 m);
 *  `entrada` = a que distância o "[E] ENTER" acende (padrão 15 m). Em prédio
 *  com círculo de colisão, `entrada` TEM de ser maior que o círculo, senão o
 *  visitante nunca chega perto o bastante e o convite nunca acende. */
export type Poi = { key: string; label: string; pos: THREE.Vector3; raio?: number; entrada?: number }
export type PoiProximo = { poi: Poi; dist: number } | null

export type Exploracao = {
  /** Uma vez por quadro, ANTES de controls.update() e do clamp de chão.
   *  Desloca câmera e alvo juntos; devolve true se há tecla viva (movimento OU
   *  giro) — é o sinal para a cena cancelar voo/autoRotate e segurar o
   *  lastInteraction. */
  update: (dt: number, alvo: THREE.Vector3, chao: (x: number, z: number) => number) => boolean
  /** ainda há velocidade de verdade (inclui a desaceleração após soltar tudo) */
  andando: () => boolean
  /** zera velocidade, giro e intenção de andar: a cena chama quando um voo
   *  (flyTo/Places/tour) assume o rig, senão o pouso do passeio arrastaria o
   *  enquadramento recém-chegado para o chão */
  parar: () => void
  setPois: (lista: Poi[]) => void
  poiProximo: () => PoiProximo
  dispose: () => void
}

// ── PASSEIO ── olhos de pedestre e passo de jogo: a praça tem 600 m de vão,
// passo de gente real (1,4 m/s) é tortura; 9 m/s lê como caminhada de jogo e a
// corrida cruza uma rua sem virar teletransporte
const OLHO = 1.8
const VEL_ANDA = 9
// teclado abaixo desta altura é intenção de ANDAR: plana até a rua e cola.
// Cobre a entrada (o visitante nasce a ~105 m sobre a guerra); as vistas de
// verdade altas (o plano, a órbita) ficam acima e seguem voando.
const ALT_PASSEIO = 160
// o assentamento no piso: mola proporcional (ganho 4/s) tetada em 55 m/s. Perto
// do chão o ganho baixo cola firme e macio no relevo passando sob os pés; de
// longe o teto vira uma DESCIDA de avião que fecha os 150 m da entrada em ~4 s,
// depressa o bastante para não sobrar câmera pairando no ar mas sem despenque.
// ⚠️ EQUILÍBRIO MEDIDO (teste F): com teto 30 o glide era raso demais e a
// câmera cruzava a cidade inteira ainda a 40 m do chão. O horizontal escala com
// a altitude (rápido no alto), então o vertical precisa acompanhar.
const SEGUE_GANHO = 4
const SEGUE_TETO = 55
// acima deste degrau o pouso é "longo": o olhar nivela rumo ao horizonte
const DEGRAU_LONGO = 4
// ── VOO ── rente ao chão ~12 m/s, +0,45 m/s por metro de altitude, teto 460
const VEL_BASE = 12
const VEL_POR_ALTURA = 0.45
const VEL_TETO = 460
// corrida: 2,2x — atravessar uma rua, não um mapa; distância longa é voo
const SPRINT = 2.2
// suavização (s⁻¹): arranque chega a 90% em ~0,35 s; a parada é um tico mais
// solta, que é o que lê como peso e não como freio de mão
const ACEL = 6.5
const FREIO = 4.2
// o giro por teclado: ~97°/s no máximo, com a mesma rampa suave do andar
const GIRO_MAX = 1.7
const GIRO_ACEL = 7
const GIRO_FREIO = 9
// FOV na corrida: +3 graus, SUTIL de propósito (cidade premium, não fliperama)
const FOV_SPRINT = 3
const FOV_TAXA = 5
// o aviso de POI reavalia a cada quarto de segundo, nunca por quadro
const POI_PASSO_S = 0.25
const POI_RAIO_PADRAO = 350
// ⚠️ O PIVÔ DO OLHAR ENCURTA COM TECLA VIVA. O drag do OrbitControls gira a
// câmera EM VOLTA DO ALVO, e depois de um voo do menu Places o alvo pode estar
// a 2 km: arrastar no meio do passo viraria uma órbita de 2 km, não um olhar.
// Com o alvo puxado para ~40 m à frente, arrastar (e girar por tecla) lê como
// virar a cabeça. A puxada é ao longo do PRÓPRIO raio de visão, então não muda
// um pixel na tela no quadro em que acontece — e só roda com tecla viva, para
// o zoom/duplo-toque/Places continuarem orbitando marcos como sempre.
const OLHAR_DIST = 40

const CIMA = new THREE.Vector3(0, 1, 0)

/** true quando o foco é um campo de texto: busca, follow tx, chat, modal.
 *  Nessas horas o teclado é da digitação, nunca da cidade. */
function digitando(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function createExplore(opts: {
  camera: THREE.PerspectiveCamera
  /** portão da cena: falso antes do boot e durante a visita guiada */
  habilitado: () => boolean
  /** true dentro de interiores com teto (túnel do aquário): o passeio não
   *  cola no "chão" que passa por cima da cabeça */
  interior?: () => boolean
  /** o primeiro deslocamento de verdade (é quando a dica de controles some) */
  onPrimeiroPasso?: () => void
  /** muda o marco mais próximo (ou null ao sair do raio); já vem com histerese de tempo */
  onPoi?: (p: PoiProximo) => void
}): Exploracao {
  const { camera, habilitado, interior, onPrimeiroPasso, onPoi } = opts

  // ── teclado ────────────────────────────────────────────────────────────────
  // Estado em objeto simples (nada de setState por quadro). `e.code` e não
  // `e.key`: WASD é posição física de mão, não letra — funciona igual em
  // qualquer layout, e as setas são as mesmas em todos.
  const teclas: Record<string, boolean> = {}
  let sprint = false
  const CONTROLES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') { if (!digitando(e.target)) sprint = true; return }
    if (!CONTROLES.has(e.code)) return
    if (digitando(e.target)) return
    // ⚠️ seta NÃO rola página nem mexe em mais nada enquanto a cidade anda
    e.preventDefault()
    teclas[e.code] = true
    sprint = e.shiftKey
  }
  const onKeyUp = (e: KeyboardEvent) => {
    // soltar SEMPRE limpa, mesmo que a tecla tenha descido dentro de um input:
    // é o que impede a cidade de sair andando sozinha com tecla "presa"
    if (e.key === 'Shift') { sprint = false; return }
    if (CONTROLES.has(e.code)) delete teclas[e.code]
  }
  // janela perdeu o foco (alt-tab, cmd-tab, troca de aba): nenhum keyup vem,
  // então tudo solta aqui — o clássico do personagem que anda para sempre
  const soltaTudo = () => { for (const k of Object.keys(teclas)) delete teclas[k]; sprint = false }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', soltaTudo)
  document.addEventListener('visibilitychange', soltaTudo)

  // ── movimento ──────────────────────────────────────────────────────────────
  // vetores pré-alocados: este código roda por quadro e não aloca nada
  const frente = new THREE.Vector3()
  const direita = new THREE.Vector3()
  const rumo = new THREE.Vector3(0, 0, 1) // última direção horizontal válida
  const desejo = new THREE.Vector3()
  const velAlvo = new THREE.Vector3()
  const vel = new THREE.Vector3()
  const passo = new THREE.Vector3()
  const olharOffset = new THREE.Vector3()
  let giroVel = 0
  // ⚠️ A INTENÇÃO DE ANDAR TEM HISTERESE, e foi teste dirigido que pegou. A
  // altitude é medida sobre o PISO, e o piso afunda na baía e nos canais: quem
  // descia planando com ↑ cruzava a água, a "altitude" saltava acima do corte
  // e o pouso ESTANCAVA no meio do voo. Uma vez armada (tecla viva abaixo do
  // corte), a intenção segura até soltar as teclas, aconteça o que acontecer
  // com o relevo lá embaixo.
  let querAndar = false
  // ⚠️ O POUSO TERMINA MESMO SOLTANDO A TECLA, como a gravidade de um jogo:
  // sem isto, soltar ↑ no meio do plano (ou sair andando da borda da laje, da
  // baía) deixava a câmera PARADA NO AR, e foi o teste dirigido que pegou —
  // parou a 36 m do chão em cima da baía. Armado só por MOVIMENTO em passeio
  // (girar a cabeça num mirante baixo não pode puxar ninguém para o chão) e
  // desarmado ao tocar o piso ou quando um voo assume (parar()).
  let assentando = false
  let deuPrimeiroPasso = false
  // o FOV da corrida é um EXTRA composto por cima do que a cena tiver: se um
  // enquadramento (ou __plazaOlhar) mexer no fov, isto soma e subtrai só a
  // própria parcela em vez de brigar pelo número inteiro
  let fovExtra = 0

  // ── POIs ───────────────────────────────────────────────────────────────────
  let pois: Poi[] = []
  let poiAtual: PoiProximo = null
  let poiRelogio = 0

  const avaliaPois = (x: number, z: number, y: number) => {
    let melhor: PoiProximo = null
    for (const p of pois) {
      const d = Math.hypot(p.pos.x - x, p.pos.y - y, p.pos.z - z)
      if (d <= (p.raio ?? POI_RAIO_PADRAO) && (!melhor || d < melhor.dist)) melhor = { poi: p, dist: d }
    }
    const mudou = (melhor?.poi.key ?? null) !== (poiAtual?.poi.key ?? null)
      || (melhor && poiAtual && Math.abs(melhor.dist - poiAtual.dist) > 5)
    poiAtual = melhor
    if (mudou && onPoi) onPoi(poiAtual)
  }

  const update = (dt: number, alvo: THREE.Vector3, chao: (x: number, z: number) => number): boolean => {
    const ix = (teclas.KeyD ? 1 : 0) - (teclas.KeyA ? 1 : 0)
    const iz = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0)
    const ig = (teclas.ArrowLeft ? 1 : 0) - (teclas.ArrowRight ? 1 : 0)
    const vivo = habilitado()
    const movendo = vivo && (ix !== 0 || iz !== 0)
    const girando = vivo && ig !== 0
    const tecladoAtivo = movendo || girando

    // ── girar a cabeça: o alvo roda EM VOLTA da câmera ────────────────────
    // A câmera não sai do lugar; só o ponto olhado desliza. Com rampa própria,
    // o giro arranca e assenta como o andar — nunca trepida nem "pula".
    giroVel += ((girando ? ig * GIRO_MAX : 0) - giroVel) * (1 - Math.exp(-(girando ? GIRO_ACEL : GIRO_FREIO) * dt))
    if (Math.abs(giroVel) > 1e-3) {
      olharOffset.copy(alvo).sub(camera.position)
      olharOffset.applyAxisAngle(CIMA, giroVel * dt)
      alvo.copy(camera.position).add(olharOffset)
    } else if (giroVel !== 0) giroVel = 0

    if (tecladoAtivo) {
      // o pivô do olhar vem para perto (ver OLHAR_DIST): mesma direção, nada
      // muda na tela, mas o drag simultâneo passa a ser cabeça, não órbita
      const d = camera.position.distanceTo(alvo)
      if (d > OLHAR_DIST) alvo.sub(camera.position).multiplyScalar(OLHAR_DIST / d).add(camera.position)
    }

    // a frente é a da CÂMERA AGORA, projetada no plano do chão: girar (mouse ou
    // seta) no meio do passo curva a caminhada na hora, e o horizonte fica
    // estável porque o deslocamento nunca tem componente vertical
    camera.getWorldDirection(frente)
    frente.y = 0
    if (frente.lengthSq() < 1e-6) {
      // olhando a pino (vista "From above"): a frente degenerou; o "para cima"
      // da tela é o que o visitante lê como frente
      frente.set(0, 1, 0).applyQuaternion(camera.quaternion)
      frente.y = 0
    }
    if (frente.lengthSq() < 1e-6) frente.copy(rumo)
    frente.normalize()
    rumo.copy(frente)
    direita.crossVectors(frente, CIMA)

    // ── passeio ou voo? a altitude decide, com histerese de intenção ──────
    const piso = chao(camera.position.x, camera.position.z)
    const altura = camera.position.y - piso
    if (!movendo) querAndar = false
    else if (altura < ALT_PASSEIO) querAndar = true
    const emPasseio = (querAndar || altura < ALT_PASSEIO) && !(interior?.())
    if (movendo && emPasseio) assentando = true

    if (movendo) {
      desejo.copy(frente).multiplyScalar(iz).addScaledVector(direita, ix)
      desejo.normalize() // ⚠️ diagonal normalizada: ↑+D anda igual a ↑
      // rente ao chão anda-se a passo de jogo; descendo de alto, a horizontal
      // ainda escala com a altitude que resta, então o pouso é um mergulho de
      // avião (rápido no alto, assentando no passo conforme chega na rua)
      const rapidez = (emPasseio && altura < 8
        ? VEL_ANDA
        : Math.min(VEL_BASE + Math.max(0, altura) * VEL_POR_ALTURA, VEL_TETO)) * (sprint ? SPRINT : 1)
      velAlvo.copy(desejo).multiplyScalar(rapidez)
    } else {
      velAlvo.set(0, 0, 0)
    }

    // perseguição exponencial: mesma curva em 30 ou 120 fps
    const taxa = movendo ? ACEL : FREIO
    vel.lerp(velAlvo, 1 - Math.exp(-taxa * dt))
    const temVel = vel.lengthSq() > 1e-4
    if (temVel) {
      passo.copy(vel).multiplyScalar(dt)
      camera.position.add(passo)
      alvo.add(passo)
    } else if (vel.lengthSq() > 0) {
      vel.set(0, 0, 0)
    }

    // ── o passeio COLA no piso: olhos a 1,8 m, seguindo o relevo ──────────
    // Mola de ganho fixo com teto de velocidade: perto do chão cola firme no
    // relevo passando sob os pés; de 100 m vira um plano de pouso de ~4 s. O
    // alvo acompanha o mesmo dy para o olhar não cabecear — e no pouso longo o
    // olhar NIVELA devagar em direção ao horizonte, senão quem desce olhando o
    // chão de 100 m acaba em pé na rua encarando o próprio sapato.
    if (emPasseio && (movendo || temVel || assentando)) {
      const alvoY = chao(camera.position.x, camera.position.z) + OLHO
      const dy = alvoY - camera.position.y
      if (Math.abs(dy) < 0.05) assentando = false // pé no chão
      const vy = THREE.MathUtils.clamp(dy * SEGUE_GANHO, -SEGUE_TETO, SEGUE_TETO)
      const dyPasso = Math.abs(vy * dt) >= Math.abs(dy) ? dy : vy * dt
      camera.position.y += dyPasso
      alvo.y += dyPasso
      if (Math.abs(dy) > DEGRAU_LONGO) {
        alvo.y += (camera.position.y - alvo.y) * (1 - Math.exp(-2.2 * dt)) * 0.5
      }
      if (!deuPrimeiroPasso && tecladoAtivo) { deuPrimeiroPasso = true; onPrimeiroPasso?.() }
    } else if (!deuPrimeiroPasso && tecladoAtivo && temVel) {
      deuPrimeiroPasso = true
      onPrimeiroPasso?.()
    }

    // o sopro de FOV da corrida, indo e voltando devagar
    const extraAlvo = movendo && sprint ? FOV_SPRINT : 0
    const extraNovo = fovExtra + (extraAlvo - fovExtra) * (1 - Math.exp(-FOV_TAXA * dt))
    if (Math.abs(extraNovo - fovExtra) > 1e-4) {
      camera.fov += extraNovo - fovExtra
      fovExtra = extraNovo
      camera.updateProjectionMatrix()
    }

    if (pois.length && onPoi) {
      poiRelogio += dt
      if (poiRelogio >= POI_PASSO_S) {
        poiRelogio = 0
        avaliaPois(camera.position.x, camera.position.z, camera.position.y)
      }
    }
    return tecladoAtivo
  }

  return {
    update,
    andando: () => vel.lengthSq() > 1e-4 || Math.abs(giroVel) > 1e-3 || assentando,
    parar: () => { vel.set(0, 0, 0); giroVel = 0; querAndar = false; assentando = false },
    setPois: (lista) => { pois = lista },
    poiProximo: () => poiAtual,
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', soltaTudo)
      document.removeEventListener('visibilitychange', soltaTudo)
      // devolve o FOV que este módulo tiver somado (unmount no meio da corrida)
      if (fovExtra !== 0) { camera.fov -= fovExtra; camera.updateProjectionMatrix() }
    },
  }
}
