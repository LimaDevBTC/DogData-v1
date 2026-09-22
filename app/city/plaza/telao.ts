// O TELÃO DA CRYPTOLUTION — a quarta peça do pente da Satoshi Plaza.
//
// Era a FACHADA da Cryptolution House (cryptolution-house.ts): o vão de 96 × 54
// que o Blender abriu no modelo, mostrando a thumbnail do vídeo do dia do
// Vincent (@cryptolution101) e abrindo o player quando clicado. A casa nunca
// chegou a ser instanciada na cena — o módulo existia e ninguém o chamava — e o
// fundador decidiu separar as duas coisas: "colocar o telão passando o vídeo
// dele na praça principal e deixar a mansão dele separada". Depois pediu que ele
// entrasse junto com as outras três peças do deck, a 90° uma da outra.
//
// ⚠️ O TELÃO É UM PÔSTER, NÃO O PLAYER. Sampler de vídeo do YouTube em WebGL
// não existe (e os Termos exigem tocar no player deles). A face mostra a
// thumbnail real (i.ytimg.com serve com CORS liberado — ver lib/cryptolution/
// feed.ts) com o play e o título por cima; o play de verdade é o <iframe> que a
// cena levanta no clique, e o visitante nunca sai da cidade.
//
// ⚠️ NADA DE REDE AQUI, o mesmo contrato do chalé: o vídeo do dia entra por
// parâmetro, e quem chama é que consulta `/api/cryptolution`. Assim a peça nasce
// certa em localhost sem rede, com o retrato embutido logo abaixo.
//
// ⚠️ E ELE NÃO TEM NENHUMA PointLight, de propósito. O censo de luzes de
// monuments.ts (23/08) derrubou oito PointLight que pintavam halo em cima de
// peça que JÁ EMITE — o custo é malhas × luzes em cada fragmento da praça. Aqui
// a tela é `MeshBasicMaterial` (ela mesma é a fonte), o soffit da marquise e o
// rodapé são faixas emissivas, e a pedra do proscênio entra levantada (a mesma
// `liftMassing` das âncoras) para não virar silhueta preta ao lado do brilho.
import * as THREE from 'three'
import { TELAO_W, TELAO_H, TELAO_PEITORIL } from './garden-plan'
import type { PerfProfile } from './perf'

export interface CryptolutionVideo {
  id: string
  title: string
  /** thumbnail hqdefault, i.ytimg.com (CORS liberado) */
  thumb: string
}

/** o retrato embutido: a peça nasce com conteúdo real mesmo sem rede */
export const TELAO_VIDEO_EMBUTIDO: CryptolutionVideo = {
  id: 'LMWwFpfgyaM',
  title: '$DOG SUPERCYCLE EXPLAINED (NEW CAPITAL FLOW MODEL)',
  thumb: 'https://i.ytimg.com/vi/LMWwFpfgyaM/hqdefault.jpg',
}

export interface Telao {
  group: THREE.Group
  /** o mesh da tela — quem clica nele abre o vídeo (raycast em plaza-scene) */
  screen: THREE.Mesh
  /** o vídeo que está na tela agora */
  video: CryptolutionVideo
  /** troca o vídeo sem reconstruir a peça (o feed ao vivo chegando depois) */
  setVideo: (v: CryptolutionVideo) => void
  /** a fila que a tela roda sozinha; o primeiro é o do dia */
  setVideos: (vs: CryptolutionVideo[]) => void
  update: (t: number) => void
  dispose: () => void
}

// ── a tela desenhada num canvas ──────────────────────────────────────────────
// Desenha o pôster do vídeo do dia: fundo escuro, a thumbnail real quando ela
// chega, o degradê, a pílula "DAILY DISPATCH", o botão de play e o título. Roda
// uma vez na hora certa e de novo quando a imagem do YouTube carrega.
//
// ⚠️ EXPORTADA PORQUE A CASA TAMBÉM A USA se um dia voltar a ter telão: o
// desenho do pôster é um só, em um lugar só.
export function makeScreenTexture(video: CryptolutionVideo, metade = false): {
  texture: THREE.CanvasTexture
  /** redesenha com outro vídeo */
  set: (v: CryptolutionVideo) => void
  dispose: () => void
} {
  // ⚠️ NO CELULAR A TELA NASCE METADE, e é pela mesma razão do atlas do DSC
  // (dsc-gallery.ts): o que derruba o contexto WebGL do telefone é o PICO de
  // memória na decodificação, não o tamanho final. 1024 × 576 são 2,4 MB de
  // VRAM com mipmap; 512 × 288 são 0,6 MB, e a tela é vista de 100 m.
  const W = metade ? 512 : 1024
  const H = metade ? 288 : 576 // 16:9
  const k = W / 1024 // o desenho inteiro é escrito na escala cheia e multiplicado
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  let img: HTMLImageElement | null = null
  let atual = video

  const wrap = (text: string, maxW: number, font: string): string[] => {
    ctx.font = font
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = w
      } else line = test
    }
    if (line) lines.push(line)
    return lines.slice(0, 2)
  }

  const draw = () => {
    ctx.setTransform(k, 0, 0, k, 0, 0) // tudo abaixo em coordenadas de 1024 × 576
    const CW = 1024, CH = 576
    // fundo
    ctx.fillStyle = '#07070b'
    ctx.fillRect(0, 0, CW, CH)
    // a thumbnail, se já chegou (cobre a tela, recorte "cover")
    if (img && img.complete && img.naturalWidth) {
      const ir = img.naturalWidth / img.naturalHeight
      const cr = CW / CH
      let dw = CW, dh = CH, dx = 0, dy = 0
      if (ir > cr) { dh = CH; dw = CH * ir; dx = (CW - dw) / 2 }
      else { dw = CW; dh = CW / ir; dy = (CH - dh) / 2 }
      try { ctx.drawImage(img, dx, dy, dw, dh) } catch { /* taint improvável: i.ytimg tem CORS */ }
    }
    // degradê pra assentar o texto (como a chapa da landing)
    const g = ctx.createLinearGradient(0, 0, 0, CH)
    g.addColorStop(0, 'rgba(0,0,0,0.45)')
    g.addColorStop(0.45, 'rgba(0,0,0,0.05)')
    g.addColorStop(1, 'rgba(0,0,0,0.9)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CW, CH)

    // pílula "DAILY DISPATCH" com o ponto laranja
    ctx.font = '600 22px ui-monospace, monospace'
    const pill = 'DAILY DISPATCH'
    const pw = ctx.measureText(pill).width
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(28, 28, pw + 58, 40)
    ctx.fillStyle = '#F56E0F'
    ctx.beginPath()
    ctx.arc(50, 48, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#F4F4F6'
    ctx.fillText(pill, 68, 50)

    // botão de play, centro
    ctx.fillStyle = '#F5B02B'
    ctx.beginPath()
    ctx.arc(CW / 2, CH / 2, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#08070b'
    ctx.beginPath()
    ctx.moveTo(CW / 2 - 20, CH / 2 - 30)
    ctx.lineTo(CW / 2 - 20, CH / 2 + 30)
    ctx.lineTo(CW / 2 + 34, CH / 2)
    ctx.closePath()
    ctx.fill()

    // título do vídeo, embaixo
    ctx.fillStyle = '#F4F4F6'
    const titleFont = '700 30px ui-sans-serif, system-ui, sans-serif'
    const lines = wrap(atual.title, CW - 72, titleFont)
    ctx.font = titleFont
    ctx.textBaseline = 'alphabetic'
    let ty = CH - 40 - (lines.length - 1) * 36
    for (const l of lines) { ctx.fillText(l, 36, ty); ty += 36 }

    texture.needsUpdate = true
  }

  // busca a thumbnail real (CORS liberado no i.ytimg — feed.ts); ao chegar,
  // redesenha com a imagem. Se falhar, o pôster segue com o fundo escuro.
  const carregaThumb = () => {
    if (img) { img.onload = null; img.onerror = null; img = null }
    if (!atual.thumb) return
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => { if (img === el) draw() }
    el.onerror = () => { if (img === el) { img = null; draw() } }
    img = el
    el.src = atual.thumb
  }

  draw()
  carregaThumb()

  return {
    texture,
    set: (v: CryptolutionVideo) => {
      if (v.id === atual.id) return
      atual = v
      draw()
      carregaThumb()
    },
    dispose: () => {
      if (img) { img.onload = null; img.onerror = null; img = null }
      texture.dispose()
    },
  }
}

// ── o proscênio: a moldura que faz a tela ler como arquitetura ───────────────
//
// ⚠️ O QUADRO LOCAL É O DA CASA: a tela olha para +Z. Quem posiciona gira o
// group com `rotation.y = −rumo` (em radianos), que é a mesma conta que o muro
// do DSC faz em dsc-gallery.ts — e é o que põe a face olhando para a Agulha.
export function buildTelao(video: CryptolutionVideo, opts?: { profile?: PerfProfile }): Telao {
  const group = new THREE.Group()
  group.name = 'Telao'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  // ── o quadro local ────────────────────────────────────────────────────────
  // ⚠️ z = 0 É O PLANO DA TELA, e é ele que `TELAO_POS` posiciona no raio. Tudo
  // que é estrutura mora em z NEGATIVO (para trás, na direção da colunata) e a
  // marquise é a única coisa que avança para z positivo. Na primeira escrita eu
  // pus os pilares em z −3,5 e a tela em z +3,55: os pilares ficavam 3,5 m ATRÁS
  // da tela e não emolduravam nada — de frente eles sumiam por trás dela.
  const MEIA = TELAO_W / 2                 // 28,8
  const PIL_L = 7                          // largura do pilar
  const PIL_P = 10                         // profundidade do pilar
  const PIL_Z = -4                         // centro do pilar: vai de −9 a +1
  const PIL_X = MEIA + PIL_L / 2 + 1       // 33,3: 1 m de junta entre tela e pilar
  const TOPO = TELAO_PEITORIL + TELAO_H    // 39,4: o topo da tela
  const PIL_H = TOPO + 4                   // 43,4: o pilar passa da tela
  const LARG = PIL_X * 2 + PIL_L           // 73,6: a largura total da peça

  // pedra do proscênio: o taupe quente-escuro da praça, já LEVANTADO (a pedra
  // crua a ~4% de cinza vira silhueta preta no sol lunar; ao lado de uma tela
  // acesa, pior ainda)
  const pedra = track(new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.115, 0.10, 0.088), roughness: 0.9, metalness: 0.05, envMapIntensity: 0.5,
  }))
  const metal = track(new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.085, 0.085, 0.095), metalness: 0.9, roughness: 0.4, envMapIntensity: 0.5,
  }))
  const quente = track(new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false }))
  const laranja = track(new THREE.MeshBasicMaterial({ color: 0xf56e0f, toneMapped: false }))

  const caixa = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat)
    m.position.set(x, y + h / 2, z)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    return m
  }

  // o pódio: a peça assenta 2 m acima do piso do deck, como o pedestal do
  // Leônidas, para as duas terem a mesma linha de base na chapa. Ele avança 4 m
  // à frente da tela, que é o degrau onde se para para assistir.
  caixa(LARG + 6, 2, 16, 0, 0, PIL_Z, pedra)
  // o peitoril, do pódio até a base da tela, 1 m à frente dela
  caixa(LARG, TELAO_PEITORIL - 2, PIL_P, 0, 2, PIL_Z, pedra)
  // os dois pilares do proscênio, emoldurando a tela pelos lados
  caixa(PIL_L, PIL_H - 2, PIL_P, -PIL_X, 2, PIL_Z, pedra)
  caixa(PIL_L, PIL_H - 2, PIL_P, +PIL_X, 2, PIL_Z, pedra)
  // a parede de trás, que fecha a vista de quem olha de fora do deck
  caixa(LARG, PIL_H - 2, 1.6, 0, 2, PIL_Z - PIL_P / 2 - 0.8, pedra)
  // a verga e a marquise projetada, que dá sombra própria à tela
  caixa(LARG, 4, PIL_P, 0, TOPO, PIL_Z, pedra)
  caixa(LARG, 1.2, 8, 0, TOPO + 2.8, 4, metal)

  // ── o que faz as vezes de luz, sem ser luz ────────────────────────────────
  // o soffit da marquise: uma faixa quente virada para baixo (a normal do plano
  // vai de +Z para −Y com o giro de +90° em X), lavando o topo da tela e a testa
  // dos pilares
  const soffit = new THREE.Mesh(track(new THREE.PlaneGeometry(LARG - 4, 7.2)), quente)
  soffit.rotation.x = Math.PI / 2
  soffit.position.set(0, TOPO + 2.75, 4)
  group.add(soffit)
  // o rodapé laranja no peitoril: a linha de base da peça, e é ele que se vê de
  // 600 m, não o vídeo
  const rodape = new THREE.Mesh(track(new THREE.PlaneGeometry(TELAO_W, 0.9)), laranja)
  rodape.position.set(0, TELAO_PEITORIL - 1.1, 0.06)
  group.add(rodape)

  // ── a tela: o plano z = 0 ─────────────────────────────────────────────────
  const tex = track(makeScreenTexture(video, !!opts?.profile?.cortaTextura))
  const screen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(TELAO_W, TELAO_H)),
    track(new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false })),
  )
  screen.position.set(0, TELAO_PEITORIL + TELAO_H / 2, 0)
  screen.name = 'CryptolutionScreen'
  screen.userData.cryptolution = true // marca pro raycast do clique→vídeo
  // ⚠️ O VÍDEO VIAJA NO `userData` DO MESH, e não num estado de React, porque
  // quem o lê é o raycast do clique, que roda dentro do efeito da cena. A cena
  // nunca re-renderiza React por causa da praça (2,6 M de triângulos); é o
  // clique que levanta o player, e ele precisa saber QUAL vídeo está na tela
  // naquele instante — que pode já não ser o embutido.
  screen.userData.video = video
  group.add(screen)

  // ⚠️ A TELA RODA A FILA, E ISSO É O MAIS PERTO DE "PASSANDO VÍDEOS" QUE DÁ.
  // O fundador falou em "um telão que fica passando os vídeos dele". Um telão
  // que TOCA vídeo do YouTube não existe em WebGL — não há sampler de vídeo do
  // YouTube, e os Termos exigem que o play aconteça no player deles. O que dá é
  // a tela nunca ficar parada: o feed devolve os últimos seis despachos e o
  // pôster troca a cada `PASSO_S`, sempre começando pelo do dia. Quem clica
  // assiste o que estiver na tela naquele instante, não um vídeo fixo.
  const PASSO_S = 14
  let fila: CryptolutionVideo[] = [video]
  let i = 0
  let proxima = PASSO_S
  let atual = video
  const mostra = (v: CryptolutionVideo) => { atual = v; screen.userData.video = v; tex.set(v) }
  return {
    group,
    screen,
    get video() { return atual },
    setVideo: (v: CryptolutionVideo) => { fila = [v]; i = 0; mostra(v) },
    setVideos: (vs: CryptolutionVideo[]) => {
      if (!vs.length) return
      fila = vs
      i = 0
      proxima = PASSO_S
      mostra(vs[0])
    },
    update(t: number) {
      // o ponto laranja da pílula não pulsa (é canvas); quem respira é o rodapé,
      // que é o "no ar" da peça vista de longe
      const p = 0.5 + 0.5 * Math.sin(t * 1.6)
      rodape.scale.y = 0.85 + 0.3 * p
      // ⚠️ A TROCA ANDA PELO RELÓGIO DA CENA, NÃO POR `setInterval`. `t` é o
      // tempo da praça: se a aba fica em segundo plano e o laço de render para,
      // a fila para junto, em vez de acumular trocas e dar um salto ao voltar.
      if (fila.length > 1 && t >= proxima) {
        proxima = t + PASSO_S
        i = (i + 1) % fila.length
        mostra(fila[i])
      }
    },
    dispose() {
      for (const d of disposables) d.dispose()
    },
  } as Telao
}
