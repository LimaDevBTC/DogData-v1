// O Chalé do OrdCards: a âncora sul da praça (praca-central.md §4.2, D2 nova).
//
// Duas cartas colossais encostadas em "A", e as cartas são a carta OFICIAL do
// OrdCards da inscrição da logo (72d5cde4…i0, N° 127.106.002), fotografadas do
// componente real.
//
// ⚠️ AS DUAS ÁGUAS SÃO A FRENTE DA CARTA (fundador, 2026-08-21: "a maioria das
// pessoas está vendo só as costas da carta, façamos o chalé com duas faces
// frontais, não teremos as costas visíveis").
//
// A versão anterior era honesta com o objeto e ruim para quem chegava: frente
// para a praça, verso com o QR para o spaceport. Só que a praça tem quatro
// bulevares e o spaceport fica no eixo sul, então a maior parte das
// aproximações caía no lado do verso, e o prédio se apresentava pela cara que
// não diz o que ele é. Uma carta tem um lado que fala; um chalé feito de cartas
// deve falar dos dois lados.
//
// As cartas repousam sobre um pódio de vidro habitado, os lados do "A" ficam
// abertos com mezaninos por dentro, as arestas das cartas são de luz, e um
// passeio liga a porta ao fim do bulevar sul.
import * as THREE from 'three'
import { makeGlowTexture, makeGroundPool, makeHalo, POOL_SPREAD, type PoolDisc } from './light-pool'
import type { Tarefa, Trabalho } from './obra'

const CARD_RATIO = 88 / 63
const WARM = new THREE.Color('#FFB35C')
const ORANGE = new THREE.Color('#F7931A')

export interface Chalet {
  group: THREE.Group
  /** altura do ápice, para quem quiser mirar a câmera */
  apexY: number
  update: (t: number) => void
  dispose: () => void
}

/** teto de cada fatia dos dois laços de instância, em ms. O resto do chalé são
 *  fases de tamanho fixo, medidas abaixo, e cada uma cabe folgada neste teto. */
const MS_POR_FATIA = 4

/**
 * A construção do chalé, em fatias. `buildChalet` drena isto de uma vez só (o
 * caminho antigo, síncrono); `chaletComoTrabalho` entrega o mesmo gerador para
 * a Obra, que gasta o orçamento de quadro dela e devolve a thread ao render.
 *
 * ⚠️ FATIAR ESTE ARQUIVO NÃO ERA O CONSERTO DOS 7,6 s, E A MEDIDA DIZ ISSO. O
 * corpo inteiro daqui foi cronometrado em 02/09/2026 fora do navegador (mesmo
 * V8, node 20, o three 0.162 do repo, três execuções de aquecimento antes):
 * **2,6 a 3,9 ms**, para 62 malhas, 26 materiais, 9 chaves de programa, 1 luz e
 * 4.016 triângulos. Não existem 7,6 s de JavaScript nesta peça para dividir.
 *
 * A janela de boot rotulada `chalet` em `plaza-scene.tsx` contém, além desta
 * função, o `await` da textura `/city/cards/logo-front.png` (1488 x 2080,
 * 154 KB no disco, 12,4 MB de RGBA para subir à GPU, e ela vai em `map` E em
 * `emissiveMap`) e o que o laço de eventos drenar durante esse `await`. E o
 * laço de render já está rodando desde antes: `animate()` é chamado no mesmo
 * efeito que dispara `boot()`, então o primeiro quadro depois de cada
 * `scene.add` paga de uma vez a compilação dos programas novos e a subida das
 * texturas novas, sem ninguém pedir. NÃO MEDI essas duas: não abri navegador.
 * Ficam ditas, com o que dá para medir sem ele.
 *
 * O gerador continua valendo pelo pior caso: 3,9 ms é num desktop, e a mesma
 * conta num celular de gama média fica na casa dos 15 ms, ou seja um quadro
 * inteiro perdido. Fatiado são 17 cessões e a MAIOR fatia medida é 0,99 ms.
 */
function* construirChalet(front: THREE.Texture, saida: { chale: Chalet | null }): Tarefa {
  const group = new THREE.Group()
  group.name = 'OrdCardsChalet'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }
  const glowTex = track(makeGlowTexture())
  // NÃO MEDI esta linha: ela é a única do arquivo que toca em canvas 2D (um
  // gradiente radial num 64 x 64) e o cronômetro que usei roda fora do
  // navegador, com o canvas dublado. Fica numa fatia própria justamente por
  // isso: se ela custar caro em algum aparelho, custa sozinha.
  yield // ── fatia: a textura do brilho ─────────────────────────────────────
  const pools: PoolDisc[] = []
  /** ⚠️ A POÇA LARGA VALE METADE DA LUMINÁRIA (0,3 nas poças dos postes do
   *  precinct → 0,15 aqui), pelo mesmo motivo dos monumentos: ela cobre dezenas
   *  de metros e no brilho cheio vira mancha branca em cima do piso desenhado. */
  const WASH_GAIN = 0.15

  const W = 172, H = W * CARD_RATIO // 240 m de carta
  const lean = 0.5 // 28,6° da vertical
  const apex = H * Math.cos(lean)
  const half = H * Math.sin(lean)
  const BASE_H = 26 // o pódio de vidro
  const CARD_T = 1.6

  // ── pódio: plinto de pedra, e o volume de vidro habitado ──────────────────
  const plinthR = Math.max(W, half * 2) * 0.62
  const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(plinthR, plinthR + 1.2, 1.4, 96)), track(new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.85 })))
  plinth.position.y = 0.7
  plinth.receiveShadow = true
  group.add(plinth)
  const plinthRing = new THREE.Mesh(track(new THREE.RingGeometry(plinthR - 0.9, plinthR - 0.1, 160)), track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, side: THREE.DoubleSide })))
  plinthRing.rotation.x = -Math.PI / 2
  plinthRing.position.y = 1.45
  group.add(plinthRing)

  const glassMat = track(new THREE.MeshPhysicalMaterial({
    color: 0x0f1a26, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.32,
    envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
  }))
  const baseW = W - 4, baseD = half * 2 - 4
  const glass = new THREE.Mesh(track(new THREE.BoxGeometry(baseW, BASE_H, baseD)), glassMat)
  glass.position.y = 1.4 + BASE_H / 2
  group.add(glass)
  yield // ── fatia: o pódio está de pé ──────────────────────────────────────
  // esquadrias do pódio: mullions verticais nas quatro faces
  const mullionMat = track(new THREE.MeshStandardMaterial({ color: 0x24252c, metalness: 0.75, roughness: 0.4 }))
  const mullionGeo = track(new THREE.BoxGeometry(0.7, BASE_H, 0.7))
  const nMx = Math.round(baseW / 9), nMz = Math.round(baseD / 9)
  const mullions = new THREE.InstancedMesh(mullionGeo, mullionMat, (nMx + nMz) * 2 + 4)
  const o = new THREE.Object3D()
  let mi = 0
  // ⚠️ CEDE POR TEMPO, NÃO POR CONTAGEM (a regra está em obra.ts). Medido em
  // 02/09: são 92 instâncias e o laço inteiro custa 0,13 ms, então o relógio
  // nunca dispara com os números de hoje. Ele fica porque `nMx`/`nMz` saem de
  // uma divisão da fachada: quem trocar o módulo de 9 m por 1 m multiplica a
  // contagem por nove sem tocar em nada aqui, e um limite escrito em itens
  // acerta num tamanho e erra em todos os outros.
  let relogio = performance.now()
  for (let i = 0; i <= nMx; i++) for (const s of [-1, 1]) {
    o.position.set(-baseW / 2 + (i * baseW) / nMx, 1.4 + BASE_H / 2, s * baseD / 2); o.updateMatrix(); mullions.setMatrixAt(mi++, o.matrix)
    if ((mi & 15) === 0 && performance.now() - relogio > MS_POR_FATIA) { yield; relogio = performance.now() }
  }
  for (let i = 1; i < nMz; i++) for (const s of [-1, 1]) {
    o.position.set(s * baseW / 2, 1.4 + BASE_H / 2, -baseD / 2 + (i * baseD) / nMz); o.updateMatrix(); mullions.setMatrixAt(mi++, o.matrix)
    if ((mi & 15) === 0 && performance.now() - relogio > MS_POR_FATIA) { yield; relogio = performance.now() }
  }
  mullions.count = mi
  mullions.instanceMatrix.needsUpdate = true
  group.add(mullions)
  yield // ── fatia: as esquadrias do pódio ──────────────────────────────────
  // pisos por dentro do pódio (dois) e mezaninos dentro do A (três), quentes
  // lajes escuras com fita de luz quente na borda e guarda-corpo de vidro: o
  // interior lê como arquitetura, não como prateleiras (a primeira versão tinha
  // pranchas cor de compensado, vistas do bulevar)
  const floorMat = track(new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.55, metalness: 0.25 }))
  const stripMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const railMat = track(new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }))
  // `glow` é a opacidade do brilho pintado por baixo da laje. O pódio pede o
  // dobro do resto porque foi ELE que perdeu a luz própria (ver o bloco de luz
  // mais abaixo); os mezaninos do "A" continuam com a luz de verdade em cima.
  const floorAt = (y: number, w: number, d: number, lit = true, glow = 0.08) => {
    const f = new THREE.Mesh(track(new THREE.BoxGeometry(w, 1.2, d)), floorMat)
    f.position.y = y
    f.receiveShadow = true
    group.add(f)
    if (lit) {
      // fita de luz nas duas bordas abertas (as faces do "A" a ±x) e guarda-corpo
      for (const sx of [-1, 1]) {
        const strip = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.25, d - 1)), stripMat)
        strip.position.set(sx * (w / 2 - 0.4), y + 0.72, 0)
        group.add(strip)
        const rail = new THREE.Mesh(track(new THREE.PlaneGeometry(d - 1.5, 2.6)), railMat)
        rail.rotation.y = Math.PI / 2
        rail.position.set(sx * (w / 2 - 0.9), y + 0.6 + 1.3, 0)
        group.add(rail)
      }
      // uma luz suave sob a laje: o interior brilha quente
      const l = new THREE.Mesh(track(new THREE.PlaneGeometry(w - 4, d - 4)), track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: glow, depthWrite: false })))
      l.rotation.x = -Math.PI / 2
      l.position.y = y + 0.7
      group.add(l)
    }
  }
  floorAt(1.4 + 0.6, baseW - 2, baseD - 2, true, 0.16)
  floorAt(1.4 + BASE_H / 2, baseW - 4, baseD - 4, true, 0.16)
  yield // ── fatia: os dois pisos de dentro do pódio ────────────────────────
  const cardBase = 1.4 + BASE_H // as cartas nascem no topo do pódio
  // uma parada por mezanino: cada `floorAt` iluminado são seis malhas e cinco
  // geometrias novas, e é a menor unidade que dá para interromper sem deixar
  // uma laje sem guarda-corpo no quadro do meio
  for (const k of [0.16, 0.34, 0.52]) {
    const y = cardBase + apex * k
    const d = 2 * half * (1 - k) - 6
    if (d > 20) floorAt(y, W - 10, d)
    yield // ── fatia: um mezanino do "A" ────────────────────────────────────
  }
  // o "chão" do A no topo do pódio: laje clara
  floorAt(cardBase - 0.6, baseW, baseD, false)
  yield // ── fatia: a laje do topo do pódio ─────────────────────────────────

  // ── as duas cartas ────────────────────────────────────────────────────────
  const cardMat = (map: THREE.Texture) =>
    track(new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.06, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.5 }))
  const innerMat = track(new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.55, metalness: 0.25 }))
  const cardGeo = track(new THREE.PlaneGeometry(W, H))
  const edgeMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }))
  const edgeGeoH = track(new THREE.BoxGeometry(W + 0.4, 0.9, CARD_T + 0.6))
  const edgeGeoV = track(new THREE.BoxGeometry(0.9, H + 0.4, CARD_T + 0.6))
  const mk = (map: THREE.Texture, sign: number) => {
    const g = new THREE.Group()
    const outer = new THREE.Mesh(cardGeo, cardMat(map))
    outer.position.z = CARD_T / 2
    const inner = new THREE.Mesh(cardGeo, innerMat)
    inner.rotation.y = Math.PI
    inner.position.z = -CARD_T / 2
    outer.castShadow = outer.receiveShadow = true
    inner.receiveShadow = true
    g.add(outer, inner)
    // arestas de luz: o perímetro da carta
    for (const [gy, py] of [[edgeGeoH, H / 2], [edgeGeoH, -H / 2]] as const) { const e = new THREE.Mesh(gy, edgeMat); e.position.y = py; g.add(e) }
    for (const px of [-W / 2, W / 2]) { const e = new THREE.Mesh(edgeGeoV, edgeMat); e.position.x = px; g.add(e) }
    // pivota na base sobre o pódio: base em z = sign·half, topo no ápice
    g.position.set(0, cardBase + apex / 2, sign * half / 2)
    g.rotation.set(-lean, sign > 0 ? 0 : Math.PI, 0, 'YXZ')
    return g
  }
  // a MESMA face nas duas águas: quem sobe pela escadaria e quem vem do
  // spaceport veem a carta, não o verso dela
  group.add(mk(front, -1))
  yield // ── fatia: a água sul ──────────────────────────────────────────────
  group.add(mk(front, 1))
  yield // ── fatia: a água norte ────────────────────────────────────────────
  // ── a estrutura por dentro do "A": caibros de aço a cada 12 m, nas duas águas ──
  const rafterMat = track(new THREE.MeshStandardMaterial({ color: 0x2b2c33, metalness: 0.8, roughness: 0.35 }))
  const rafterLen = H - 6
  const rafterGeo = track(new THREE.BoxGeometry(1.1, rafterLen, 1.4))
  const nR = Math.floor((W - 12) / 12)
  const rafters = new THREE.InstancedMesh(rafterGeo, rafterMat, nR * 2)
  let ri = 0
  for (const sign of [-1, 1]) {
    for (let i = 0; i < nR; i++) {
      const x = -W / 2 + 6 + i * 12 + 6
      // paralelo à carta, 1,6 m para dentro dela
      o.position.set(x, cardBase + apex / 2, sign * half / 2 - sign * (CARD_T / 2 + 1.6) * Math.cos(lean))
      o.rotation.set(-lean, sign > 0 ? 0 : Math.PI, 0, 'YXZ')
      o.updateMatrix()
      rafters.setMatrixAt(ri++, o.matrix)
      // mesmo relógio das esquadrias: 26 caibros hoje, 0,04 ms medidos, e o
      // limite existe pelo `nR`, que também sai de uma divisão da fachada
      if ((ri & 15) === 0 && performance.now() - relogio > MS_POR_FATIA) { yield; relogio = performance.now() }
    }
  }
  rafters.count = ri
  rafters.instanceMatrix.needsUpdate = true
  rafters.castShadow = true
  group.add(rafters)
  yield // ── fatia: os caibros de aço ───────────────────────────────────────

  // ── a escadaria monumental, do lado da praça: três terraços de pedra escura ──
  // com o degrau iluminado, do gramado ao pórtico
  const stairMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.7, metalness: 0.15 }))
  const nosingMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.55 }))
  const stairW = W * 0.62
  for (let k = 0; k < 3; k++) {
    const depth = 30 - k * 8, hgt = 3.2
    const zc = -baseD / 2 - 6 - depth / 2 - (2 - k) * 0 // encostados no pódio, o mais largo embaixo
    const tier = new THREE.Mesh(track(new THREE.BoxGeometry(stairW - k * 14, hgt, depth)), stairMat)
    tier.position.set(0, hgt / 2 + k * hgt, zc)
    tier.receiveShadow = tier.castShadow = true
    group.add(tier)
    const nosing = new THREE.Mesh(track(new THREE.BoxGeometry(stairW - k * 14, 0.2, 0.5)), nosingMat)
    nosing.position.set(0, hgt + k * hgt + 0.1, zc - depth / 2 + 0.3)
    group.add(nosing)
    // o nariz do degrau já acende; a poça é a marca dele no piso do patamar. O
    // raio é a meia profundidade do degrau (a poça preenche o patamar de frente
    // a fundo) e são três ao longo da largura, em terços, porque o degrau tem
    // 100 m de boca e uma poça só no meio deixaria as pontas apagadas.
    for (const sx of [-1, 0, 1]) pools.push({ at: [sx * (stairW - k * 14) / 3, hgt + k * hgt + 0.12, zc], r: depth / 2, gain: WASH_GAIN })
    // e, no chão diante da escadaria, a poça de quem chega pelo passeio
    if (k === 0) pools.push({ at: [0, 0.42, zc - depth], r: depth / 2, gain: WASH_GAIN })
    yield // ── fatia: um terraço da escadaria ──────────────────────────────
  }

  // ── luz ──────────────────────────────────────────────────────────────────
  //
  // Eram quatro PointLight (e antes disso, oito). Ficou UMA.
  //
  // ⚠️ A QUE FICA É A DE DENTRO DO "A", e ela não é halo. O miolo do chalé é
  // laje escura, caibro de aço e o VERSO das cartas (`innerMat`, sem nenhuma
  // emissão): sem fonte lá dentro o prédio vira uma casca oca atrás de arestas
  // acesas, e o vão de 240 m, que é o assunto da peça, some. Poça não ilumina
  // geometria, então não existe troca possível para esta.
  //
  // As outras três eram halo em cima de coisa que já brilha sozinha: a do pódio
  // (as fitas das lajes, os guarda-corpos e o brilho sob a laje são emissivos),
  // a frontal a 100 m da fachada (a face da carta é emissiva) e o farol do ápice
  // (o glifo é MeshBasic, ele já está aceso por definição). Viraram poça no piso
  // da aproximação e um halo de sprite no farol.
  const lights: THREE.PointLight[] = []
  const addLight = (x: number, y: number, z: number, i: number, c: THREE.Color | number = WARM, dist = 380) => {
    const l = new THREE.PointLight(c, i, dist, 1.35)
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
  }
  addLight(0, cardBase + apex * 0.35, 0, 2.6, WARM, 420)
  // ⚠️ A POÇA DO PÓDIO TEM O DOBRO DO RAIO DO PLINTO DE PROPÓSITO, e o miolo
  // dela fica escondido embaixo do plinto: luz não atravessa prédio. O que
  // aparece é só a saia, do pé do plinto para fora, que é exatamente o halo que
  // um volume aceso deixa no chão em volta. Quem cortar o raio para `plinthR`
  // some com a poça inteira, porque aí ela cabe embaixo da pedra.
  pools.push({ at: [0, 0.42, 0], r: plinthR * 2, gain: WASH_GAIN })
  yield // ── fatia: a luz de dentro do "A" ──────────────────────────────────

  // ── a porta e o passeio para o bulevar sul (norte do chalé) ──────────────
  const walkMat = track(new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.75, metalness: 0.15 }))
  const walk = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 150)), walkMat)
  walk.rotation.x = -Math.PI / 2
  walk.position.set(0, 0.36, -plinthR - 60)
  walk.receiveShadow = true
  group.add(walk)
  const walkLineMat = track(new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false, transparent: true, opacity: 0.6 }))
  for (const sx of [-1, 1]) {
    const ln = new THREE.Mesh(track(new THREE.PlaneGeometry(0.6, 150)), walkLineMat)
    ln.rotation.x = -Math.PI / 2
    ln.position.set(sx * 15, 0.42, -plinthR - 60)
    group.add(ln)
  }
  // três poças ao longo do passeio, no lugar do foco frontal que ficava a 100 m
  // da fachada: raio igual à meia largura do passeio, espaçadas por um quarto do
  // comprimento dele
  for (const s of [-1, 0, 1]) pools.push({ at: [0, 0.44, -plinthR - 60 + s * (150 / 4)], r: 30 / 2, gain: WASH_GAIN })
  // portal de entrada: um pórtico baixo com o glifo
  const portal = new THREE.Mesh(track(new THREE.BoxGeometry(34, 12, 4)), track(new THREE.MeshStandardMaterial({ color: 0x0f0f13, roughness: 0.4, metalness: 0.6, emissive: WARM, emissiveIntensity: 0.15 })))
  portal.position.set(0, 9.6 + 6.5, -baseD / 2 - 6)
  group.add(portal)
  yield // ── fatia: o passeio e o pórtico ───────────────────────────────────

  // ── a marca girando sobre o ápice ────────────────────────────────────────
  const glyph = new THREE.Group()
  glyph.add(new THREE.Mesh(track(new THREE.TorusGeometry(10, 1.2, 8, 48)), track(new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))))
  glyph.add(new THREE.Mesh(track(new THREE.SphereGeometry(4, 24, 16)), track(new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }))))
  glyph.position.set(0, cardBase + apex + 30, 0)
  group.add(glyph)
  // o farol do ápice: um halo de sprite preso ao próprio glifo, que sobe e desce
  // com ele. O diâmetro sai da esfera do glifo pela proporção dos postes do
  // precinct (lâmpada de 1,8 m, poça de 17): esfera de 8 m, halo de 75.
  const beacon = track(makeHalo([[0, 0, 0]], { color: ORANGE, size: 4 * 2 * POOL_SPREAD, texture: glowTex, name: 'ChaletBeacon' }))
  glyph.add(beacon.object)
  const beaconBase = beacon.material.opacity
  yield // ── fatia: a marca e o farol do ápice ──────────────────────────────

  // todas as poças do chalé numa malha só
  const pool = track(makeGroundPool(pools, { texture: glowTex, name: 'ChaletPools' }))
  group.add(pool.object)
  const poolBase = pool.material.opacity

  saida.chale = {
    group,
    apexY: cardBase + apex,
    update(t) {
      glyph.rotation.y = t * 0.3
      glyph.position.y = cardBase + apex + 30 + Math.sin(t * 0.8) * 2
      for (const l of lights) l.intensity = (l.userData.base ??= l.intensity) * (0.92 + 0.08 * Math.sin(t * 1.1 + l.position.x * 0.02))
      // a poça e o farol respiram na mesma cadência que as luzes faziam: sem
      // isso o chalé fica aceso mas parado, e é o movimento que o deixa vivo
      pool.material.opacity = poolBase * (0.92 + 0.08 * Math.sin(t * 1.1))
      beacon.material.opacity = beaconBase * (0.92 + 0.08 * Math.sin(t * 0.8))
    },
    dispose() { for (const d of disposables) d.dispose() },
  }
}

/**
 * O caminho antigo, síncrono, e ele NÃO MUDOU DE ASSINATURA: drena o gerador de
 * uma vez só e devolve o chalé pronto. Quem já chamava isto continua chamando.
 */
export function buildChalet(front: THREE.Texture): Chalet {
  const saida: { chale: Chalet | null } = { chale: null }
  const g = construirChalet(front, saida)
  while (!g.next().done) { /* sem parar: é o comportamento de antes */ }
  // o gerador só termina depois de escrever `saida.chale`; se caiu antes, quem
  // chamou já recebeu a exceção e nunca chega aqui
  return saida.chale as Chalet
}

/** O chalé como peça da Obra. `chale` fica nulo até a última fatia rodar. */
export interface ChaletTrabalho extends Trabalho {
  readonly chale: Chalet | null
}

/**
 * O chalé para o contrato de `obra.ts`. FAIXA 2 (fundo): a cidade abre sem ele.
 *
 * `peso` 6 é o mesmo que a etapa `chalet` já tinha na tela de carga de
 * `plaza-scene.tsx`, para a barra não mudar de ritmo na troca.
 *
 * ⚠️ A TEXTURA TEM DE CHEGAR PRONTA, e é de propósito. Um gerador não sabe
 * esperar promessa, e a Obra chama `next()` em laço apertado dentro do
 * orçamento do quadro: um gerador que cedesse enquanto espera a textura queimaria
 * os 6 ms de TODO quadro girando em falso, e ainda seguraria as outras peças da
 * fila atrás dele. Quem chama carrega o PNG antes e passa a textura aqui.
 */
export function chaletComoTrabalho(
  front: THREE.Texture,
  opts: { aoPronto?: (c: Chalet) => void; peso?: number } = {},
): ChaletTrabalho {
  const saida: { chale: Chalet | null } = { chale: null }
  return {
    nome: 'OrdCards Chalet',
    peso: opts.peso ?? 6,
    faixa: 2,
    get chale() { return saida.chale },
    // ⚠️ NÃO USE `yield*` AQUI. O `target` deste tsconfig é abaixo de ES2015 e
    // `npx tsc --noEmit` recusa: "TS2802: Type 'Tarefa' can only be iterated
    // through when using the '--downlevelIteration' flag". Repassar as cessões
    // à mão faz a mesma coisa e compila.
    *fatia() {
      const g = construirChalet(front, saida)
      while (!g.next().done) yield
      if (saida.chale) opts.aoPronto?.(saida.chale)
    },
  }
}
