'use client'
// ═══════════════════════════════════════════════════════════════════════════════
// Satoshi Plaza on the Moon, with the DOG mempool alive above it.
//
// praca-central.md: the plaza of the landing scene (Central Tower, BitFlow HQ,
// Kray Tower, the deck and its gardens) exported as-is from blender/dogcity-landing
// .blend to public/city/plaza.glb, standing on the real Mare Tranquillitatis
// terrain (public/lunar/btc-core-heightmap.f32, VEX 2×, same as the .blend), with
// the spaceport 3 km south. Every pending DOG transaction is a ship in orbit;
// each block is a landing window; the board on screen is the node's mempool.
//
// Raw Three.js (house rule: no react-three-fiber). Everything this file imports
// is tracked: the lunar helpers under lib/city/lunar are gitignored and must
// never be imported from a production page (Vercel builds from the GitHub clone).
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createBattlefield, type Battlefield } from '../war/battlefield'
import WarLegend from './war-legend'
import { loadTerrain } from './terrain'
import { createOrbitLayer, PAD_MAIN } from './orbit-layer'
import { startFeed, isDonation, type DogTx, type Snapshot, donationDog } from './feed'
import { buildChalet, type Chalet } from './chalet'
import { buildPrecinct, ANCHORS, type Precinct } from './precinct'
import { loadPark, PARK_CENTER, type Park } from './park'
import { buildMonuments, type Monuments } from './monuments'
import { buildLunarEnvironment, LUNAR_ENV_INTENSITY } from './lunar-env'
import { onDiagonal, DECK_Y, GENESIS_POS, SATOSHI_POOL, PAW_PALM, ORDINAL_CENTER, LEONIDAS_POS, BUST_POS } from './garden-plan'
import { TEMPLE_WORLD } from './park-site'
import { CAVE_YAW, CAVE_LAYER } from './leonidas-cave'
import { buildFoundersWalk, type FoundersWalk, type FoundersData } from './founders-walk'
import { detectTier, profileFor, parseQuality, FrameGovernor, DistanceCuller, mergeStaticByMaterial } from './perf'
import { SF_CREDITS, SF, loadSf, dressSf } from './sf-assets'
import { buildProps, type Props } from './props'
import { buildDscGallery, DSC_CENTER, type DscGallery } from './dsc-gallery'
import { PROPS } from './props-table'
import { CityChat } from '@/components/wallet/city-chat'

// ── framing ────────────────────────────────────────────────────────────────────
// The default view is the landing hero, from the north-east, high enough that the
// orbit ring sweeps through the frame and the spaceport reads at the horizon.
// From the north-north-east, down the monumental axis: deck in front, the towers
// framing it, the Castle of Cards beyond the deck, the spaceport at the horizon
// behind the castle, and the Earth in the south-western sky.
const HOME_POS = new THREE.Vector3(560, 640, -1480)
const HOME_TARGET = new THREE.Vector3(0, 100, 480)
// A phone in portrait sees a narrow slice: pull in closer and look a little
// lower so the deck and the towers fill the width instead of floating mid-frame.
type View = { pos: THREE.Vector3; target: THREE.Vector3 }
/** Os lugares: cada um é um enquadramento (câmera, alvo). O menu "Places" voa
 *  para eles e `?view=<nome>` abre neles. */
// ── A Cratera da Guerra: o book de DOG/USD como campo de batalha, 3 km a
// sudoeste da praça. O motor é o de app/city/war/battlefield.ts; aqui ele é um
// LUGAR do mundo: sem clique, o HUD do modo jogo revela por proximidade e o
// feed da Kraken só liga quando alguém se aproxima.
const WAR_POS = new THREE.Vector3(-2120, 0, 2120)
const fmtQtd = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)

// hora curta da fita: HH:MM:SS local, sem data. A fita só mostra os últimos
// segundos, então a data seria ruído numa linha de 10 px.
const fmtHora = (t: number) => {
  const d = new Date(t)
  const p2 = (n: number) => n.toString().padStart(2, '0')
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}
const fmtPreco = (p: number) => (p > 0 ? p.toFixed(6) : '-')
// quantas linhas a fita desenha no desktop
const FITA_LINHAS = 6

export const PLACES: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  { key: 'home', label: 'Satoshi Plaza', hint: 'the whole precinct' },
  { key: 'deck', label: 'The deck', hint: 'the Needle, up close' },
  { key: 'mark', label: 'The Bitcoin Mark', hint: 'the seal on the deck, north axis' },
  { key: 'founders', label: "Founders' Circle", hint: 'the donors, at the tower foot' },
  { key: 'whitepaper', label: 'Whitepaper Garden', hint: 'nine pages, north-east' },
  { key: 'genesis', label: 'The Genesis Block', hint: 'end of the whitepaper walk' },
  { key: 'satoshi', label: "Satoshi's Mirror", hint: 'north-west pool' },
  { key: 'bust', label: 'The Bronze Satoshi', hint: 'gate of the mirror garden' },
  { key: 'temple', label: 'Leonidas Temple', hint: 'hidden in the massif' },
  { key: 'paw', label: 'The Diamond Paw', hint: '$DOG, south-east' },
  { key: 'leonidas', label: 'Leonidas', hint: 'founder of DOG, behind the paw' },
  { key: 'ordinal', label: 'Ordinal Garden', hint: 'runestones, south-west' },
  { key: 'dsc', label: 'Dog Social Club', hint: 'the collection, beside Kray' },
  { key: 'chalet', label: 'OrdCards Chalet', hint: 'south anchor' },
  { key: 'kray', label: 'Kray Tower', hint: 'east anchor' },
  { key: 'bitflow', label: 'BitFlow HQ', hint: 'west anchor' },
  { key: 'pad', label: 'Spaceport', hint: 'where the ships land' },
  { key: 'park', label: 'Runestone Park', hint: 'the Gate, 5 km north-east' },
  { key: 'war', label: 'The Price War', hint: 'the crater, 3 km south-west' },
  { key: 'top', label: 'From above', hint: 'the plan' },
]
/** A VISITA GUIADA (praca-ajustes.md item 4). Na primeira vez que alguém entra
 *  na cidade, a câmera faz o percurso sozinha e conta o que é cada coisa; um
 *  toque, uma tecla ou o botão "Skip" devolvem o controle na hora. A trilha usa
 *  as mesmas vistas do menu Places, então nunca desencontra da cena. */
export const TOUR: ReadonlyArray<{ key: string; text: string }> = [
  { key: 'home', text: 'Satoshi Plaza, on Mare Tranquillitatis. Everything here is built on real lunar terrain.' },
  { key: 'deck', text: 'The Needle at the centre. Every address in the city is measured from this tower.' },
  { key: 'founders', text: "The Founders' Circle at the tower foot: one plaque for every wallet that funded the city." },
  { key: 'paw', text: 'The Diamond Paw: $DOG written into the ground, thirty metres across.' },
  { key: 'leonidas', text: 'Leonidas, founder of DOG: a yellow skull under a black hood, with the bitcoin mark on his chest.' },
  { key: 'dsc', text: 'Beside Kray Tower, the Dog Social Club: the whole collection, in the order the chain wrote it.' },
  { key: 'padtour', text: 'The spaceport: the strongback, the tank farm, the dishes. When a block lands, the ships come down on this apron.' },
  { key: 'park', text: 'Runestone Park, five kilometres north-east: the ordinal range, in black crystal.' },
  { key: 'temple', text: 'And, hidden among the monarch stones, a temple nobody was meant to find.' },
  { key: 'home', text: 'The city is yours to walk. Double-tap anything to get close.' },
]
const TOUR_FLY_S = 4.2
const TOUR_HOLD_MS = 6400

function viewFor(name: string | null, aspect: number): View {
  switch (name) {
    case 'castle': case 'south': case 'chalet':
      return { pos: new THREE.Vector3(-560, 300, 1260), target: new THREE.Vector3(0, 110, 620) }
    case 'chaletback': // conferência: a água que olha para o spaceport
      return { pos: new THREE.Vector3(420, 300, 1560), target: new THREE.Vector3(0, 150, 660) }
    case 'north':
      return { pos: new THREE.Vector3(160, 120, -140), target: new THREE.Vector3(0, 10, -520) }
    case 'founders': // de pé no deck, diante do muro: o lado NORTE é onde estão
      // as placas já ocupadas (o primeiro fundador entra ao norte e o círculo
      // segue no sentido horário)
      return { pos: new THREE.Vector3(6, 42.3, -84), target: new THREE.Vector3(0, 41.7, -67) }
    case 'deck':
      return { pos: new THREE.Vector3(-260, 120, 380), target: new THREE.Vector3(0, 60, 0) }
    // De pé no eixo norte, um pouco além do marco, olhando para ele com a Needle
    // subindo atrás: é o enquadramento para o qual a peça foi desenhada.
    case 'mark':
      return { pos: new THREE.Vector3(0, 40 + 16, -228), target: new THREE.Vector3(0, 40 + 12, -150) }
    case 'whitepaper': { const [x, z] = onDiagonal('NE', 598, 4); const [tx, tz] = onDiagonal('NE', 690); return { pos: new THREE.Vector3(x, 7, z), target: new THREE.Vector3(tx, 4, tz) } }
    case 'genesis': { const [x, z] = onDiagonal('NE', 838, 9); return { pos: new THREE.Vector3(x, 6, z), target: new THREE.Vector3(GENESIS_POS[0], 4.5, GENESIS_POS[1]) } }
    case 'satoshi': { const [x, z] = onDiagonal('NW', 492, 3); return { pos: new THREE.Vector3(x, 6, z), target: new THREE.Vector3(SATOSHI_POOL[0], 9, SATOSHI_POOL[1]) } }
    case 'paw': { const [x, z] = onDiagonal('SE', 430, -30); return { pos: new THREE.Vector3(x, 95, z), target: new THREE.Vector3(PAW_PALM[0], 0, PAW_PALM[1]) } }
    case 'leonidas': { const [x, z] = onDiagonal('SE', 700, 5); return { pos: new THREE.Vector3(x, 4, z), target: new THREE.Vector3(LEONIDAS_POS[0], 8, LEONIDAS_POS[1]) } }
    case 'satoshiside': { const [x, z] = onDiagonal('NW', 560, 62); return { pos: new THREE.Vector3(x, 8, z), target: new THREE.Vector3(SATOSHI_POOL[0], 6, SATOSHI_POOL[1]) } }
    case 'bust': { const [x, z] = onDiagonal('NW', 462, 8); return { pos: new THREE.Vector3(x, 4.5, z), target: new THREE.Vector3(BUST_POS[0], 4, BUST_POS[1]) } }
    case 'temple': {
      // a BOCA da caverna (o salão está lá dentro); a altura vem do parque
      // quando ele carrega. A câmera fica no eixo da boca, do lado de fora.
      const t = TEMPLE_WORLD.lengthSq() > 1 ? TEMPLE_WORLD.clone() : new THREE.Vector3(PARK_CENTER.x + 335, -100, PARK_CENTER.z - 59)
      const d = new THREE.Vector3(Math.cos(CAVE_YAW), 0, -Math.sin(CAVE_YAW))
      return { pos: t.clone().addScaledVector(d, 96).setY(t.y + 26), target: new THREE.Vector3(t.x, t.y + 11, t.z) }
    }
    case 'templewide': { // conferência: a caverna inteira, de fora e de cima
      const t = TEMPLE_WORLD.clone()
      const d = new THREE.Vector3(Math.cos(CAVE_YAW), 0, -Math.sin(CAVE_YAW))
      return { pos: t.clone().addScaledVector(d, 190).setY(t.y + 92), target: new THREE.Vector3(t.x - 20, t.y + 6, t.z) }
    }
    case 'templeside': { // conferência: o perfil, para ver o pé no chão
      const t = TEMPLE_WORLD.clone()
      const d = new THREE.Vector3(-Math.sin(CAVE_YAW), 0, -Math.cos(CAVE_YAW))
      return { pos: t.clone().addScaledVector(d, 120).setY(t.y + 30), target: new THREE.Vector3(t.x - 12, t.y + 8, t.z) }
    }
    case 'templepath': { // conferência: o caminho secreto, do pódio até a boca
      const t = TEMPLE_WORLD.clone()
      const d = new THREE.Vector3(0.932, 0, -0.362) // rumo do pódio do precinto
      return { pos: t.clone().addScaledVector(d, 300).setY(t.y + 80), target: new THREE.Vector3(t.x + 60, t.y, t.z - 24) }
    }
    case 'templein': {
      // ⚠️ DENTRO DO SALÃO, não no corredor. Na caverna velha a boca dava
      // direto na câmara e 8 m para dentro já mostrava o templo. Depois da
      // reforma de 26/08 há um corredor em S de ~45 m antes do salão, e esta
      // vista mostrava só parede curva: era a queixa do fundador ("lá dentro
      // não conseguimos visualizar o templo"). A câmera agora fica na boca do
      // salão (44 m para dentro) e mira o templo, que está a 72 m.
      const t = TEMPLE_WORLD.lengthSq() > 1 ? TEMPLE_WORLD.clone() : new THREE.Vector3(PARK_CENTER.x + 335, -100, PARK_CENTER.z - 59)
      const d = new THREE.Vector3(Math.cos(CAVE_YAW), 0, -Math.sin(CAVE_YAW))
      return { pos: t.clone().addScaledVector(d, -44).setY(t.y + 13), target: t.clone().addScaledVector(d, -72).setY(t.y + 12) }
    }
    case 'templegarden': { // o pátio: o jardim de fungos em volta do templo
      const t = TEMPLE_WORLD.lengthSq() > 1 ? TEMPLE_WORLD.clone() : new THREE.Vector3(PARK_CENTER.x + 335, -100, PARK_CENTER.z - 59)
      const d = new THREE.Vector3(Math.cos(CAVE_YAW), 0, -Math.sin(CAVE_YAW))
      const lado = new THREE.Vector3(-Math.sin(CAVE_YAW), 0, -Math.cos(CAVE_YAW))
      // ⚠️ os números são conservadores de propósito: o salão vai de 26 a 118 m
      // para dentro e tem 83,5 m de largura, mas com lado 30 e altura 24 a
      // câmera encostava na parede e o quadro pegava a rocha acesa pelo sol
      // de fora. 22 de lado e 15 de altura ficam com folga dentro do volume.
      return {
        pos: t.clone().addScaledVector(d, -96).addScaledVector(lado, 22).setY(t.y + 15),
        target: t.clone().addScaledVector(d, -72).setY(t.y + 7),
      }
    }
    case 'satoshiclose': { const [x, z] = onDiagonal('NW', 536, 1); return { pos: new THREE.Vector3(x, 5, z), target: new THREE.Vector3(SATOSHI_POOL[0], 6.5, SATOSHI_POOL[1]) } }
    case 'satoshisideclose': { const [x, z] = onDiagonal('NW', 560, 26); return { pos: new THREE.Vector3(x, 6, z), target: new THREE.Vector3(SATOSHI_POOL[0], 6, SATOSHI_POOL[1]) } }
    case 'leonidasclose': { const [x, z] = onDiagonal('SE', 714, 4); return { pos: new THREE.Vector3(x, 5, z), target: new THREE.Vector3(LEONIDAS_POS[0], 9, LEONIDAS_POS[1]) } }
    case 'dsc': {
      const d = DSC_CENTER
      const f = Math.atan2(-d.x, -d.z)
      return { pos: new THREE.Vector3(d.x + Math.sin(f) * 58, 20, d.z + Math.cos(f) * 58), target: new THREE.Vector3(d.x, 11, d.z) }
    }
    case 'ordinal': { const [x, z] = onDiagonal('SW', 606, 6); return { pos: new THREE.Vector3(x, 5.5, z), target: new THREE.Vector3(ORDINAL_CENTER[0], 6, ORDINAL_CENTER[1]) } }
    case 'kray':
      return { pos: new THREE.Vector3(300, 140, 420), target: new THREE.Vector3(620, 90, 0) }
    case 'bitflow':
      return { pos: new THREE.Vector3(-300, 140, 420), target: new THREE.Vector3(-620, 90, 0) }
    case 'bitflowback': // a face de trás, onde entrou a assinatura
      return { pos: new THREE.Vector3(-980, 320, -180), target: new THREE.Vector3(-620, 300, 0) }
    case 'top':
      return { pos: new THREE.Vector3(60, 2600, 900), target: new THREE.Vector3(0, 0, 100) }
    // the park's own hero, "The Gate Reveal": from the Gate crest, south-west of the
    // Monarch, looking up the Vale of the Mark (park frame (−2210, −1748) → three (−2210, +1748))
    case 'parkclose':
      return { pos: new THREE.Vector3(PARK_CENTER.x - 1250, 40, PARK_CENTER.z + 1050), target: new THREE.Vector3(PARK_CENTER.x, 150, PARK_CENTER.z) }
    case 'padclose':
      return { pos: new THREE.Vector3(PAD_MAIN.x + 40, PAD_MAIN.y + 40, PAD_MAIN.z - 150), target: new THREE.Vector3(PAD_MAIN.x - 20, PAD_MAIN.y + 24, PAD_MAIN.z + 20) }
    case 'pad':
      return { pos: new THREE.Vector3(PAD_MAIN.x + 150, 90, PAD_MAIN.z + 190), target: new THREE.Vector3(PAD_MAIN.x - 60, 40, PAD_MAIN.z + 60) }
    case 'padtour': {
      // A parada do tour NÃO pode depender de haver nave pousada: em noite quieta
      // o pátio está vazio e a câmera ficava olhando para o nada (fundador,
      // 2026-08-19). Esta vista mira o que está sempre lá — o pórtico de
      // lançamento a (PAD_MAIN.x+120, PAD_MAIN.z−40) — com as antenas à direita.
      // De perto e de BAIXO: a 300 m e 96 m de altura, metade do quadro era
      // regolito vazio e o pórtico virava um risco. Aqui a câmera fica na altura
      // de um prédio pequeno e olha PARA CIMA, então a torre ocupa o quadro e o
      // chão vazio some.
      // Entre as DUAS torres: o pórtico escuro com o foguete (spaceport.glb) e o
      // strongback branco (props). Câmera baixa e olhando para cima, senão o
      // quadro é metade regolito e as torres viram riscos.
      // De TRÁS do pátio, olhando para a praça: as duas torres (o pórtico com o
      // foguete e o strongback branco) ficam no meio do quadro e a silhueta da
      // cidade fecha o fundo a 3 km. Assim a parada tem o que mostrar mesmo na
      // noite mais quieta, sem nave nenhuma pousada.
      // e olhando um pouco PARA CIMA (alvo acima da câmera): mirando para baixo,
      // 55% do quadro era chão vazio.
      return { pos: new THREE.Vector3(PAD_MAIN.x + 40, 58, PAD_MAIN.z + 215), target: new THREE.Vector3(PAD_MAIN.x + 10, 92, PAD_MAIN.z - 60) }
    }
    case 'war':
      // chegando do lado da praça (NE da cratera), baixo o bastante pros
      // exércitos (em escala de monumento) encherem o quadro em diagonal.
      // ⚠️ EM PÉ (celular) a chegada rasteira punha a câmera no chão ATRÁS
      // das costas dos cães, com meio ecrã de regolito e a batalha escondida
      // (fundador fotografou): o retrato agora chega ALTO e recuado, vendo a
      // costura de través com os dois exércitos e a régua no quadro; a escala
      // de monumento (2,6x) mantém os efeitos legíveis mesmo desta altura.
      return aspect >= 1
        ? { pos: new THREE.Vector3(WAR_POS.x + 460, 175, WAR_POS.z - 480), target: new THREE.Vector3(WAR_POS.x - 60, 25, WAR_POS.z + 60) }
        : { pos: new THREE.Vector3(WAR_POS.x + 350, 235, WAR_POS.z - 370), target: new THREE.Vector3(WAR_POS.x - 40, 5, WAR_POS.z + 40) }
    case 'warentry':
      // A CHEGADA (pedido do fundador): o usuário cai DIRETO sobre a batalha,
      // vindo do sudoeste, com a skyline da cidade fechando o fundo a 3,7 km
      // pra gerar curiosidade. Câmera baixa atrás da retaguarda dos ursos,
      // olhando NE por cima da costura: batalha no primeiro plano, torres no
      // horizonte. Sem fog na cena, a cidade lê até de longe.
      // ⚠️ a 700 m a batalha virava linha de brasa no horizonte (metade do
      // quadro era regolito); a 380 m ela enche o primeiro plano e a skyline
      // ainda fecha o fundo por cima da costura
      // o enquadramento é o MESMO diagonal provado da vista 'war', só que
      // espelhado pro lado SW: a batalha enche o quadro em diagonal e a
      // cidade fecha o fundo na direção do olhar
      // ⚠️ A CÂMERA RASANTE FOI DESFEITA EM 27/08, E O MOTIVO ESTÁ MEDIDO.
      // O raciocínio antigo ("rasante, o chão comprime numa faixa fina") ignorava
      // que 26 m é MENOS que um urso: o rig pousava atrás da retaguarda vermelha
      // e um bicho a poucos metros tapava dois terços do quadro. Pior, aos 26 m
      // declarados o rig ficava ABAIXO do terreno (o chão ali está em ~117), e o
      // travamento do laço subia câmera E alvo em bloco, ou seja o número escrito
      // aqui nem era o que ia pra tela.
      // O enquadramento abaixo foi POSICIONADO À MÃO pelo fundador no navegador
      // e lido por window.__plazaView() (?stats=1): 204 m de altura, alvo em 152,
      // 396 m de distância. A direção do olhar é a mesma de antes (o alvo em
      // x/z não mudou); o que mudou é que agora se vê a batalha inteira, a régua
      // de preço no chão, os helicópteros e a skyline com a Needle ao fundo.
      // O retrato foi posicionado do mesmo jeito, na janela estreitada: 186 m de
      // altura, alvo em 141, 567 m de distância. Ele recua mais que o desktop de
      // propósito, porque em retrato o quadro é alto e estreito e a batalha só
      // fecha as duas linhas de frente de mais longe.
      // ⚠️ OS DOIS ESTÃO ACIMA DO CHÃO (204 e 186 contra ~119 e ~181 de terreno
      // mais 1,7): o travamento NÃO dispara e os valores valem como escritos.
      // Mexer para baixo daqui devolve o urso na lente e, pior, volta a cair
      // abaixo do terreno, onde o número escrito deixa de ser o que vai pra tela.
      return aspect >= 1
        ? { pos: new THREE.Vector3(WAR_POS.x - 202, 204, WAR_POS.z + 173), target: new THREE.Vector3(WAR_POS.x + 70, 152, WAR_POS.z - 110) }
        : { pos: new THREE.Vector3(WAR_POS.x - 341, 186, WAR_POS.z + 308), target: new THREE.Vector3(WAR_POS.x + 60, 141, WAR_POS.z - 90) }
    case 'far':
      return { pos: new THREE.Vector3(-2600, 2800, 4200), target: new THREE.Vector3(1800, 0, -1900) }
    case 'park':
      return { pos: new THREE.Vector3(PARK_CENTER.x - 2210, 30, PARK_CENTER.z + 1748), target: new THREE.Vector3(PARK_CENTER.x, 120, PARK_CENTER.z) }
    case 'spaceport':
      return { pos: new THREE.Vector3(600, 380, 3700), target: new THREE.Vector3(-140, 60, 3090) }
  }
  if (aspect >= 1) return { pos: HOME_POS.clone(), target: HOME_TARGET.clone() }
  return { pos: new THREE.Vector3(430, 760, -1300), target: new THREE.Vector3(0, 40, 420) }
}
function homeFor(aspect: number): View {
  const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null
  return viewFor(view, aspect)
}

const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fmtDog = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)
const short = (s: string, a = 8, b = 6) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s)
const minutesAgo = (iso: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null)

interface HudState {
  loading: string | null
  error: string | null
  snapshot: Snapshot | null
  stale: number | null
  orbit: number
  parked: number
  picked: DogTx | null
  followed: DogTx | null
  followNote: string | null
  stats?: string
}

/** O PORTÃO DE ENTRADA (fundador, 2026-08-19: "o certo seria carregar tudo e só
 *  depois entregar a página"). A cena só é entregue quando cada etapa termina;
 *  até lá a tela de carga cobre tudo e os controles ficam desligados. Os pesos
 *  são o tempo relativo de cada etapa, medido aqui: o parque e as torres pesam. */
const BOOT_STEPS = [
  { key: 'terrain', label: 'Reading Mare Tranquillitatis', weight: 8 },
  { key: 'towers', label: 'Raising the plaza and the towers', weight: 26 },
  { key: 'chalet', label: 'Raising the OrdCards Chalet', weight: 6 },
  { key: 'garden', label: 'Planting the garden', weight: 10 },
  { key: 'monuments', label: 'Setting the monuments', weight: 12 },
  { key: 'props', label: 'Placing the fountains and the palms', weight: 12 },
  { key: 'founders', label: "Engraving the founders' plaques", weight: 4 },
  { key: 'park', label: 'Growing Runestone Park', weight: 16 },
  { key: 'shaders', label: 'Lighting the plaza', weight: 6 },
] as const
type BootKey = (typeof BOOT_STEPS)[number]['key']
const BOOT_TOTAL = BOOT_STEPS.reduce((a, b) => a + b.weight, 0)

// lite: navegador embutido de carteira no celular (memória curtíssima). A cena
// nasce na qualidade mínima, DPR 1 e sem o campo de batalha; ?lite=1 força.
export default function PlazaScene({ lite = false }: { lite?: boolean } = {}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{
    follow: (txid: string) => Promise<void>
    home: () => void
    flyTo: (name: string) => void
    startTour: () => void
    stopTour: () => void
  } | null>(null)
  const [hud, setHud] = useState<HudState>({
    loading: 'Loading the plaza…', error: null, snapshot: null, stale: null,
    orbit: 0, parked: 0, picked: null, followed: null, followNote: null,
  })
  const [followInput, setFollowInput] = useState('')
  // ⚠️ no celular o formulário de follow NÃO mora na tela: vira um botão que
  // abre sob demanda, senão ele cobre o HUD da guerra e tudo que estiver
  // embaixo (fundador, 25/08). No desktop segue fixo como sempre foi.
  const [followOpen, setFollowOpen] = useState(false)
  const [placesOpen, setPlacesOpen] = useState(false)
  // painel de chat da praça: mesmo estado abre o botão do HUD e o overlay/painel em city-chat.tsx
  const [chatOpen, setChatOpen] = useState(false)
  const [liteUi] = useState(() => lite || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lite') === '1'))
  // o HUD da guerra é imperativo: o laço 3D escreve opacidade e números direto
  // nestes nós conforme a distância até a cratera, sem passar pelo React
  const warHudRef = useRef<HTMLDivElement>(null)
  const warPrecoRef = useRef<HTMLDivElement>(null)
  const warPressaoRef = useRef<HTMLDivElement>(null)
  const warBaixasRef = useRef<HTMLDivElement>(null)
  // linha extra compacta do book de verdade (bidsDog/asksDog), mesmo padrão imperativo
  const warBidsRef = useRef<HTMLSpanElement>(null)
  const warAsksRef = useRef<HTMLSpanElement>(null)
  // ⚠️ A FITA DE TRADES REAIS. O motor sempre serviu `fita` no hud() e o palco
  // solo sempre desenhou; a cidade nunca desenhou, e o fundador lembrava dela
  // ("um campo onde ficavam aparecendo as ordens de preço"). Cada linha é uma
  // negociação de verdade na Kraken, a mesma que vira tiro na batalha.
  // As linhas nascem prontas no JSX e são atualizadas por textContent: a fita
  // muda várias vezes por segundo e re-renderizar React nesse ritmo com a cena
  // de 2,6M de triângulos rodando é desperdício.
  const warFitaRef = useRef<HTMLDivElement>(null)
  const warFitaLinhas = useRef<Array<HTMLDivElement | null>>([])
  const warFitaMobileRef = useRef<HTMLDivElement>(null)
  // ── LEGENDA DA BATALHA ────────────────────────────────────────────────
  // ⚠️ O ESTADO SÓ É ESCRITO COM O PAINEL ABERTO. O HUD da guerra inteiro
  // atualiza por textContent justamente para não re-renderizar React com a
  // cena de 2,6M de triângulos rodando; a legenda é a exceção porque tem
  // dezenas de campos e abre por escolha do usuário. Fechada, custa zero.
  const [legendaAberta, setLegendaAberta] = useState(false)
  const legendaAbertaRef = useRef(false)
  const [legendaDados, setLegendaDados] = useState<Parameters<typeof WarLegend>[0]['dados']>(null)
  useEffect(() => { legendaAbertaRef.current = legendaAberta }, [legendaAberta])
  // ── O CHAMADO DA OBRA (praca-ajustes.md item 8) ──────────────────────────
  // A praça é a vitrine do que o dinheiro constrói, e até agora ela não pedia
  // nada: quem entrava não tinha como financiar o próximo quarteirão sem sair da
  // cidade e procurar. O mesmo número do /api/donate/leaderboard que a landing
  // mostra aparece aqui, e o botão leva direto à seção de construção.
  const [fund, setFund] = useState<{ raised: number; goal: number; pct: number; donors: number } | null>(null)
  const [tour, setTour] = useState<{ i: number; text: string; n: number } | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/donate/leaderboard', { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return
        setFund({ raised: j.total_received ?? 0, goal: j.goal ?? 10_000_000, pct: j.progress_pct ?? 0, donors: j.donor_count ?? 0 })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const [boot, setBoot] = useState<{ done: BootKey[]; label: string; ready: boolean; failed: boolean }>({ done: [], label: BOOT_STEPS[0].label, ready: false, failed: false })
  const readyRef = useRef<(() => void) | null>(null)
  useEffect(() => { if (boot.ready) readyRef.current?.() }, [boot.ready])
  const [qualityNow] = useState(() => (typeof window !== 'undefined' ? parseQuality(new URLSearchParams(window.location.search).get('quality')) : 'balanced'))
  // Phones start with the board folded to its one-line summary; the scene is the
  // point. Deitado conta como phone: largura engana, a altura não.
  const [boardOpen, setBoardOpen] = useState(() => typeof window === 'undefined' || (window.innerWidth >= 640 && window.innerHeight >= 521))
  // ?plate=1: só a cena, sem HUD (para fotografar as chapas da landing)
  const [plate] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('plate') === '1')

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false

    // ── renderer ────────────────────────────────────────────────────────────
    // Log depth: a cena vai do deck (2 m) ao parque (9 km) e ao horizonte (60 km);
    // sem ele, duas superfícies quase coplanares a 9 km brigam no z-buffer.
    // perf.ts: nível por aparelho, resolução dinâmica, culling por distância
    const buscaLite = new URLSearchParams(window.location.search).get('lite') === '1'
    const emLite = lite || buscaLite
    const quality = emLite ? 'low' : parseQuality(new URLSearchParams(window.location.search).get('quality'))
    const profile = profileFor(emLite ? 'mobile' : detectTier(), quality)
    if (emLite) {
      // framebuffer é o maior consumidor de memória num aparelho 3x
      profile.maxPixelRatio = 1
      profile.minPixelRatio = 0.75
    }
    const renderer = new THREE.WebGLRenderer({ antialias: profile.antialias, powerPreference: 'high-performance', logarithmicDepthBuffer: true })
    const governor = new FrameGovernor(renderer, profile)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    // a exposição passou a ser propriedade da HORA (ver HOURS, mais abaixo); este
    // valor é só o de partida até a hora ser escolhida
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = profile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)
    const culler = new DistanceCuller()
    const wantStats = new URLSearchParams(window.location.search).get('stats') === '1'
    if (wantStats) {
      // ?stats=1: window.__plazaDump() → custo por grupo de topo (malhas, triângulos, instâncias)
      ;(window as unknown as { __plazaDump?: () => unknown }).__plazaDump = () => {
        const rows: { name: string; meshes: number; tris: number; points: number; lights: number; visible: boolean }[] = []
        for (const child of scene.children) {
          let meshes = 0, tris = 0, points = 0, lights = 0
          child.traverse((o) => {
            const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number; isPoints?: boolean; isLight?: boolean }
            if (!o.visible) return
            if (m.isLight) lights++
            if (m.isPoints) { const g = (m as unknown as THREE.Points).geometry; points += g.attributes.position?.count ?? 0 }
            if (m.isMesh) {
              meshes++
              const g = m.geometry
              const n = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3
              tris += n * (m.isInstancedMesh ? (m.count ?? 1) : 1)
            }
          })
          rows.push({ name: child.name || child.type, meshes, tris: Math.round(tris), points, lights, visible: child.visible })
        }
        return rows.sort((a, b) => b.tris - a.tris)
      }
      ;(window as unknown as { __plazaMeshes?: (groupName: string) => unknown }).__plazaMeshes = (groupName: string) => {
        const rows: { name: string; tris: number; inst: number }[] = []
        const g = scene.children.find((c) => c.name === groupName)
        g?.traverse((o) => {
          const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number }
          if (!m.isMesh) return
          const geo = m.geometry
          const n = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3
          rows.push({ name: o.name || o.type, tris: Math.round(n * (m.isInstancedMesh ? (m.count ?? 1) : 1)), inst: m.isInstancedMesh ? (m.count ?? 0) : 1 })
        })
        return rows.sort((a, b) => b.tris - a.tris).slice(0, 25)
      }
    }

    const scene = new THREE.Scene()
    // ?stats=1: a cena inteira na janela, para medir peça por fora (foi assim que
    // se achou o pé da caverna fora do chão). Declarado aqui, DEPOIS da cena
    // existir: no bloco de stats lá em cima ele caía na zona morta do const.
    if (wantStats) {
      const w = window as unknown as { __plazaScene?: THREE.Scene; __plazaTHREE?: typeof THREE }
      w.__plazaScene = scene
      w.__plazaTHREE = THREE
    }
    scene.background = new THREE.Color(0x000000)
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.5, 200000)
    // A câmera não vive no grafo da cena, então um raycast de depuração não a
    // encontrava: com `?stats=1` ela fica à mão, que é como se pergunta "o que é
    // esse pixel ali" sem adivinhar coordenada de mundo.
    if (wantStats) (window as unknown as { __plazaCamera?: THREE.Camera }).__plazaCamera = camera
    camera.layers.enable(CAVE_LAYER) // a caverna do Leonidas vive fora do sol
    // ⚠️ A ENTRADA PADRÃO (sem ?view=) agora é SOBRE A BATALHA com a cidade ao
    // fundo (decisão do fundador: entregar o user direto na guerra, take
    // cinematográfico). Fora do lite apenas: no lite o campo nem nasce e a
    // câmera estaria sobre uma cratera vazia. ?view= explícito continua manda.
    const viewParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null
    const entradaGuerra = !viewParam && !emLite
    const home = entradaGuerra ? viewFor('warentry', camera.aspect) : homeFor(camera.aspect)
    camera.position.copy(home.pos)
    if (entradaGuerra) {
      // o dolly de pouso parte recuado e mais alto; o flyTo pro frame-herói
      // dispara lá embaixo, depois que ele existe
      camera.position.sub(home.target).multiplyScalar(1.45).add(home.target)
      camera.position.y += 210
    }

    let groundAt: (x: number, z: number) => number = () => 0
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(home.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    // até 3 m do alvo: uma estátua, uma placa, um glifo têm de caber na tela
    // (era 260, e por isso nada pequeno se aproximava); o chão é respeitado no loop
    controls.minDistance = 3
    controls.maxDistance = 16000
    controls.zoomSpeed = 1.1
    // ⚠️ ESTA LINHA É O MOTIVO DE NINGUÉM VER O CÉU, e ela merece o aviso.
    //
    // No OrbitControls o ângulo polar π/2 é a câmera na altura do alvo, olhando na
    // horizontal. Passar disso é a câmera descer ABAIXO do alvo, que é como se
    // olha para cima. Travado em π/2, o rig não olha acima do horizonte NUNCA:
    // sobra só a metade de cima do quadro, uns 21 graus de céu.
    //
    // Consequência medida (2026-08-23): a Terra estava pendurada a 10° de
    // elevação, coladinha no horizonte, porque era a única altura em que alguém a
    // veria. E isso é justamente o que faz um corpo celeste parecer satélite. O
    // mesmo trava as naves da mempool, que voam em cima.
    //
    // O CONSERTO, em duas partes que só funcionam juntas:
    //
    //   (a) aqui, deixar o ângulo passar de π/2, que é a câmera descer abaixo do
    //       alvo, que é como se olha para cima;
    //   (b) no laço, quando o chão empurrar a câmera para cima, SUBIR O ALVO na
    //       mesma medida. Os dois pontos sobem juntos, então a direção do olhar
    //       não muda: o que muda é o rig inteiro deslizar para fora do regolito.
    //
    // Sem (b), (a) sozinho não faz nada: com o alvo preso no chão o OrbitControls
    // não tem para onde levar a câmera, e foi o que eu medi antes de escrever
    // isto. O par (câmera, alvo) corrigido é ponto fixo do `update()`, porque o
    // deslocamento entre eles não muda, então não existe deriva.
    const LOOK_UP = 0.85 // 49 graus de céu, o bastante para a Terra e as naves
    controls.maxPolarAngle = Math.PI / 2 + LOOK_UP
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.18
    controls.enabled = false // só depois que o portão abrir (ver `boot.ready`)
    controls.update()
    let lastInteraction = 0
    const wake = () => { lastInteraction = performance.now(); controls.autoRotate = false }
    renderer.domElement.addEventListener('pointerdown', wake)
    renderer.domElement.addEventListener('wheel', wake, { passive: true })

    // ── AS TRÊS HORAS DA PRAÇA ───────────────────────────────────────────────
    //
    // O fundador, 2026-08-23: "a maior parte do tempo me parece tudo muito
    // escuro". Já tinha havido uma rodada de subir preenchimento (19/08) e ela
    // não resolveu, porque o problema não era falta de luz. Medido nesta data,
    // numa chapa da praça: regolito ao sol 30% de luminância, gramado 24%,
    // asfalto 24%, TORRES 6,7%, céu 0%. O ponto mais claro do quadro inteiro era
    // 73%. Uma imagem sem nenhum realce lê como escura mesmo sem nada estar
    // preto, e subir ambiente só transforma preto em cinza sujo.
    //
    // O que faltava era ESCOLHER A HORA. O dia lunar tem 29,5 dias terrestres,
    // quase 15 de sol e 15 de noite, e o sol anda meio grau por hora: o que na
    // Terra é uma hora dourada, lá dura um dia inteiro. Então não existe "a"
    // iluminação da praça, existem horas, e cada uma é uma direção de arte.
    //
    // ⚠️ SÃO TRÊS ESTADOS FIXOS, NÃO UM CICLO ANIMADO. Ciclo contínuo obriga a
    // reassar o mapa de sombra o tempo todo, e o congelamento da sombra é metade
    // do desempenho desta cena.
    //
    // ⚠️ E O AZIMUTE DO SOL NÃO MUDA ENTRE AS HORAS. Ele foi escolhido a olho
    // para a composição da vista inicial (torres recortadas, sombra atravessando
    // o deck); o que muda é a ALTURA, que é o que decide comprimento de sombra e
    // quanto do regolito acende.
    const SUN_AZ = 306 // noroeste, como já era
    type Hour = { el: number; sun: number; sunColor: number; hemi: number; earth: number; exposure: number }
    // ⚠️ SOL RASO NÃO É CENA CLARA, e eu errei isto na primeira tentativa. Num
    // plano que olha para BAIXO, o assunto é o chão, e o que o chão recebe é
    // proporcional ao SENO da elevação: a 10 graus são 0,17 do que ele receberia
    // de pino, contra 0,42 dos 25 graus que a cena tinha. A primeira versão
    // desta tabela punha a manhã a 10 graus como padrão e deixou a praça mais
    // escura do que estava, medido em chapa. Foto de Apollo é clara porque o
    // assunto é vertical e o sol vem por trás da câmera; aqui o assunto é uma
    // esplanada vista de cima.
    const HOURS: Record<string, Hour> = {
      // O PADRÃO: sol alto o bastante para acender a esplanada (sen 44° = 0,69,
      // uma vez e meia o que a cena tinha) e ainda dar sombra com direção.
      day: { el: 44, sun: 5.4, sunColor: 0xfff6e8, hemi: 0.34, earth: 0.15, exposure: 1.06 },
      // A dramática: sombra longa atravessando a praça e torres em contraluz. O
      // chão fica mais escuro, e isso aqui é escolha, não defeito.
      morning: { el: 16, sun: 5.0, sunColor: 0xfff0d2, hemi: 0.28, earth: 0.18, exposure: 1.12 },
      // A noite assumida: sem sol, a Terra manda. Ela é grande (2 graus) e fica
      // parada no céu, então a sombra dela é macia e a luz é azul. O que acende a
      // cidade é a luz artificial dela mesma.
      earthlight: { el: -8, sun: 0.0, sunColor: 0xfff1dc, hemi: 0.62, earth: 1.05, exposure: 1.16 },
    }
    const hourKey = new URLSearchParams(window.location.search).get('hour') ?? 'day'
    const H = HOURS[hourKey] ?? HOURS.day
    renderer.toneMappingExposure = H.exposure

    const sunPos = (el: number, dist: number) => {
      const a = THREE.MathUtils.degToRad(SUN_AZ), e = THREE.MathUtils.degToRad(el)
      return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(dist)
    }
    const sun = new THREE.DirectionalLight(H.sunColor, H.sun)
    sun.position.copy(sunPos(H.el, 3600))
    sun.castShadow = true
    sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize)
    sun.shadow.camera.near = 500
    sun.shadow.camera.far = 7000
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.left = -1000; sc.right = 1000; sc.top = 1000; sc.bottom = -1000
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 1.2
    sun.target.position.set(0, 0, 320)
    scene.add(sun, sun.target)
    // A caixa de sombra segue o alvo da câmera (encaixada em texels da luz para
    // não tremer) e cresce com a distância: sombras na praça E no parque, a 9 km,
    // com um mapa só. Sem isto o parque era plano: as pedras não assentavam.
    const SUN_DIR = sun.position.clone().normalize()
    const SUN_DIST = sun.position.length()
    const lightRot = new THREE.Matrix4().lookAt(SUN_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))
    const lightRotInv = lightRot.clone().invert()
    const shadowAnchor = new THREE.Vector3()
    let shadowHalf = 1000
    const followShadow = () => {
      const dist = camera.position.distanceTo(controls.target)
      const half = dist < 1500 ? 1000 : dist < 3500 ? 1800 : 3200
      if (half !== shadowHalf) {
        shadowHalf = half
        sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half
        sc.updateProjectionMatrix()
      }
      const texel = (2 * half) / sun.shadow.mapSize.x
      shadowAnchor.copy(controls.target).applyMatrix4(lightRotInv)
      shadowAnchor.x = Math.round(shadowAnchor.x / texel) * texel
      shadowAnchor.y = Math.round(shadowAnchor.y / texel) * texel
      shadowAnchor.applyMatrix4(lightRot)
      sun.target.position.copy(shadowAnchor)
      sun.position.copy(shadowAnchor).addScaledVector(SUN_DIR, SUN_DIST)
    }
    // ⚠️ O PREENCHIMENTO É FRACO DE DIA E FORTE DE NOITE, ao contrário do que a
    // intuição terrestre pede. Aqui não há céu: com o sol de pé, o único
    // preenchimento é o quique do regolito, que é pouco, e é ele que dá a sombra
    // dura das fotos de Apollo. Deixar o hemisférico alto de dia mata justamente
    // o contraste que estamos buscando. De noite ele inverte: a Terra é a fonte,
    // e ela é grande o suficiente para ser quase um difusor.
    scene.add(new THREE.HemisphereLight(0x3a4664, 0x1a1712, H.hemi))
    // O brilho da Terra vem DA TERRA, e não de um ponto qualquer do céu: mesma
    // direção que o disco (EARTH_DIR, logo abaixo), para a luz e o objeto
    // concordarem.
    const earthshine = new THREE.DirectionalLight(0x8fb0ff, H.earth)
    scene.add(earthshine)

    // dark studio reflections for the glass towers, per-material tamed below
    // ⚠️ O AMBIENTE ERA UM ESTÚDIO FOTOGRÁFICO, e numa lua sem atmosfera isso é
    // errado por dentro e caro por fora. `RoomEnvironment` é uma caixa branca com
    // luminárias: todo metal da cena refletia um estúdio (foi o que fez o selo de
    // latão do Marco sair branco), e o projeto compensava forçando 0,32 de
    // envMapIntensity em cada material carregado, o que apagava junto o quique do
    // regolito, que é a única coisa que a Lua tem de verdade.
    //
    // `lunar-env.ts` monta o que existe: preto acima do horizonte, regolito
    // abaixo, e o disco da Terra no lugar dele. Medido na construção: mediana de
    // 23 ms para 10 ms, e o pior caso de 164 ms para 15 ms, porque o `fromScene`
    // desenha uma cena seis vezes e obriga o driver a compilar o shader de
    // MeshStandardMaterial antes de qualquer coisa da praça existir.
    //
    // A chamada mora AQUI, depois da Terra, para o ambiente e o disco olharem na
    // mesma direção: se um dia o sítio mudar de latitude, os dois mudam juntos.
    const tameEnv = (root: THREE.Object3D) => {
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material
        const list = Array.isArray(m) ? m : m ? [m] : []
        for (const mat of list) if ('envMapIntensity' in mat) (mat as THREE.MeshStandardMaterial).envMapIntensity = LUNAR_ENV_INTENSITY
      })
    }

    // ── sky: stars and the Earth ─────────────────────────────────────────────
    scene.add(buildStars())
    // ⚠️ A TERRA É CÉU, NÃO É OBJETO DA CENA, e é essa distinção que conserta o
    // que o fundador viu: "hoje a terra parece um satélite da lua".
    //
    // Ela estava pendurada em (-21000, 6800, 30000), um ponto do MUNDO a 37 km.
    // Medido: andar mil metros na praça a deslocava 1,54° contra as estrelas, que
    // é 38% do próprio diâmetro dela. Um corpo a 384 mil km não faz isso. Fazer
    // isso é o que define, para o olho, um satélite em órbita baixa: ele desliza,
    // muda de tamanho e passa por trás das torres enquanto você caminha.
    //
    // A correção profissional é a de sempre para corpo celeste: PRENDER NA CÂMERA.
    // A posição passa a ser a da câmera mais uma direção fixa, então a paralaxe é
    // exatamente zero e o tamanho na tela nunca muda. Continua sendo uma esfera
    // iluminada pelo mesmo sol (a fase é de verdade), só que agora mora no céu.
    //
    // ⚠️ E ELA SOBE PARA ONDE ELA ESTÁ. A Lua é travada por maré: a Terra não
    // nasce nem se põe, fica PARADA num ponto do céu, e QUAL ponto depende de
    // onde a cidade está. A 10 graus, onde ela estava, a leitura é de "luar
    // nascendo", que é outra coisa.
    //
    // ⚠️ E A ALTURA DELA ESCOLHE O SÍTIO, não o contrário. A distância angular
    // até o zênite é a distância até o ponto sub-terrestre (0°, 0°):
    //
    //   Tranquillitatis sul   (8,5° N, 31° E)  →  58° de elevação
    //   Tranquillitatis norte (25° N, 40° E)   →  44° de elevação
    //
    // Fica a norte, a 44°: mais alto que isso e a Terra só existe para quem olha
    // para cima de propósito; mais baixo, e ela vira lua nascendo. Continua sendo
    // Mare Tranquillitatis (o mar vai até uns 30° N), e o azimute sai da mesma
    // conta: 243°, a sudoeste, na direção do ponto sub-terrestre.
    const earth = buildEarth()
    const EARTH_AZ = 243, EARTH_EL = 44
    const EARTH_DIR = new THREE.Vector3(
      Math.sin(THREE.MathUtils.degToRad(EARTH_AZ)) * Math.cos(THREE.MathUtils.degToRad(EARTH_EL)),
      Math.sin(THREE.MathUtils.degToRad(EARTH_EL)),
      -Math.cos(THREE.MathUtils.degToRad(EARTH_AZ)) * Math.cos(THREE.MathUtils.degToRad(EARTH_EL)),
    ).normalize()
    const EARTH_DIST = 37000
    earth.position.copy(EARTH_DIR).multiplyScalar(EARTH_DIST)
    scene.add(earth)
    earthshine.position.copy(EARTH_DIR).multiplyScalar(6000)

    const lunarEnv = buildLunarEnvironment(renderer, { earthDir: EARTH_DIR, sunDir: SUN_DIR })
    scene.environment = lunarEnv

    // ── layers ──────────────────────────────────────────────────────────────
    const orbit = createOrbitLayer()
    scene.add(orbit.group)

    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    const gltf = new GLTFLoader()
    gltf.setDRACOLoader(draco)

    const pulses: { m: THREE.MeshStandardMaterial; base: number; rate: number; phase: number }[] = []
    const sways: { o: THREE.Object3D; y0: number; amp: number }[] = []
    const jets: { o: THREE.Object3D; y0: number }[] = []
    let chalet: Chalet | null = null
    let precinct: Precinct | null = null
    let park: Park | null = null
    let monuments: Monuments | null = null
    let props: Props | null = null
    let dsc: DscGallery | null = null
    let founders: FoundersWalk | null = null
    const spinners: THREE.Object3D[] = []
    let campo: Battlefield | null = null
    // tremor de impacto: o motor avisa, o anfitrião sacode. Ver onImpactoGrande.
    let tremorT0 = -1
    let tremorForca = 0
    let campoVivo = false
    let emblemaGuerra: THREE.Group | null = null
    let heightAt: (x: number, z: number) => number = () => 0

    const loadGlb = (url: string) =>
      new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej))

    // marca uma etapa como pronta; quando todas terminam, o portão abre
    const stepDone = (key: BootKey) => {
      if (disposed) return
      setBoot((b) => {
        if (b.done.includes(key)) return b
        const done = [...b.done, key]
        const next = BOOT_STEPS.find((st) => !done.includes(st.key))
        return { ...b, done, label: next?.label ?? 'Ready', ready: done.length >= BOOT_STEPS.length }
      })
    }
    const boot = async () => {
      try {
        const terrain = await loadTerrain()
        if (disposed) return
        heightAt = terrain.heightAt
        groundAt = terrain.heightAt
        scene.add(terrain.group)
        stepDone('terrain')

        // ── a Cratera da Guerra nasce com o terreno, dormindo ────────────────
        // ⚠️ ANTES do compileAsync, senão as luzes do campo mudam a contagem de
        // PointLight depois do boot e o three recompila a cena inteira no
        // primeiro frame. luzesAmbiente: false porque o orçamento global de
        // luzes da praça está no limite; maxLuzes fica em 1-2 impactos.
        // ⚠️ No modo lite (navegador embutido de carteira) o campo NÃO nasce:
        // WebView de carteira mata a aba por memória, e a batalha é o maior
        // sistema vivo da cena. Quem quiser a guerra abre no navegador.
        if (!emLite) {
          // ⚠️ UMA BATALHA SÓ (fundador flagrou "duas versões"): o BALANCED
          // padrão montava o campo pela metade (2200/56) e a cratera parecia
          // uma batalha mais pobre que o palco solo /city/war. Agora que a
          // CHEGADA é a batalha, balanced e high recebem o campo cheio, igual
          // ao palco; só as luzes ficam em 2 (orçamento estrutural da cidade,
          // ≤10 PointLights no total). O low continua enxuto: é o celular.
          const orcCampo = profile.quality === 'low'
            ? { cap: 900, niveis: 36, maxOndas: 6, maxLuzes: 1, detritos: 140, poeiraMax: 220, faiscaMax: 70 }
            : { cap: 4200, niveis: 80, maxOndas: 20, maxLuzes: 2, detritos: 700, poeiraMax: 900, faiscaMax: 240 }
          // rotação escolhida pra frente cruzar NW-SE: quem chega da praça vê os
          // cães de frente e os ursos do outro lado
          const rotY = (5 * Math.PI) / 4
          const cosR = Math.cos(rotY)
          const sinR = Math.sin(rotY)
          // ⚠️ LICENÇA POÉTICA MEDIDA, como a Terra de 2,6° no céu: em escala 1:1
          // um soldado de 1,4 m a 400 m é um pontinho contra o regolito claro.
          // A batalha é monumento: 2,6x deixa o campo com meio quilômetro e os
          // obeliscos com 23 m, legíveis da chegada sem mudar o motor.
          const ESCALA_GUERRA = 2.6
          // ⚠️⚠️ O DATUM, E POR QUE METADE DO TEATRO DE FOGO NÃO EXISTIA AQUI.
          //
          // O motor escreve DUAS classes de altura. Os exércitos, veículos,
          // baterias, cicatrizes e cadáveres perguntam `altura(x, z)`. Mas o
          // tiro do trade, o rastro, o anel de choque, o clarão de impacto, a
          // bola de fogo, a fumaça, os destroços, o número de dano, os
          // traçantes, a largada do MLRS, a casca de morteiro em voo, a luz da
          // frente e a neblina rasteira usam Y FIXO, tipo 1,2, porque no palco
          // solo o chão da batalha está em y ≈ 0.
          //
          // Aqui não estava. `alturaLocal` devolvia a cota ABSOLUTA do terreno
          // dividida pela escala: medido, entre 35 e 49 em local sobre a
          // pegada do campo. Com o grupo em y=0, o chão ficava lá em cima e
          // tudo que nasce em y≈1 aparecia uns 96 METROS DE MUNDO abaixo do
          // regolito, que é opaco. Os bonecos apareciam, o fogo não. É
          // exatamente a queixa do fundador: "armas que atiram e nada
          // acontece", e a razão de a batalha da cidade parecer ter menos
          // coisa que a do palco solo tendo as mesmas peças.
          //
          // O conserto é rebasear o zero, não somar piso dentro do motor: são
          // mais de dez pontos com Y fixo espalhados por 4.300 linhas e um
          // esquecido volta a enterrar o efeito. A conta fecha idêntica para
          // quem já usava `altura`: antes mundo = 0 + 2,6·(h/2,6) = h; agora
          // mundo = DATUM + 2,6·((h − DATUM)/2,6) = h. Ninguém se move.
          const DATUM = terrain.heightAt(WAR_POS.x, WAR_POS.z)
          const alturaLocal = (x: number, z: number) => {
            const wx = WAR_POS.x + (x * cosR + z * sinR) * ESCALA_GUERRA
            const wz = WAR_POS.z + (-x * sinR + z * cosR) * ESCALA_GUERRA
            return (terrain.heightAt(wx, wz) - DATUM) / ESCALA_GUERRA
          }
          // ⚠️ AS OPÇÕES QUE O MOTOR CRIOU PARA A PRAÇA E A PRAÇA NUNCA LIGOU.
          // Durante três conversas o fundador disse que a batalha da cidade tem
          // menos coisa que a do palco solo. A chamada daqui pedia só
          // `luzesAmbiente: false` e ignorava o resto da interface, que está
          // escrita em battlefield.ts falando DESTE anfitrião:
          //  · `motas`: o comentário do motor diz literalmente "a cidade pede as
          //    do motor para as duas batalhas terem os MESMOS elementos". A
          //    poeira suspensa é o que dá ar de campo de batalha em vez de
          //    bonecos num tabuleiro limpo. O solo usa 500 no high.
          //  · `brilhoInterno`: existe porque a praça NÃO pode manter uma cadeia
          //    de composer. Sem bloom e sem esta opção, o clarão de impacto
          //    nasce 1x e morre em 130 ms; com ela, 1,7x e 260 ms, e o halo lê
          //    na cena. Era metade do "a explosão parece fraca".
          //  · `onImpactoGrande`: morteiro e canhão de tanque sacodem a câmera.
          //    O motor não conhece câmera nenhuma de propósito; quem sacode é o
          //    anfitrião, e o solo já fazia isso desde sempre.
          const motasCampo = profile.quality === 'low' ? 0 : profile.quality === 'high' ? 500 : 300
          campo = createBattlefield(alturaLocal, orcCampo, undefined, {
            luzesAmbiente: false,
            motas: motasCampo,
            brilhoInterno: true,
            // ⚠️ sem isto a poeira, as brasas e as motas saem 2,6x menores que
            // no palco solo, e o halo de cada explosão cobre 26 m num campo de
            // 458 m: Points e PointLight não herdam a escala do grupo
            escala: ESCALA_GUERRA,
            onImpactoGrande: (forca) => {
              // mesma janela do palco solo: um impacto por vez, senão a câmera
              // vibra sem parar numa barragem
              const agoraT = performance.now()
              if (agoraT - tremorT0 < 300) return
              tremorT0 = agoraT
              tremorForca = Math.min(0.5, forca / 30)
            },
          })
          campo.group.position.set(WAR_POS.x, DATUM, WAR_POS.z) // ver o comentário do DATUM
          campo.group.rotation.y = rotY
          campo.group.scale.setScalar(ESCALA_GUERRA)
          scene.add(campo.group)
          // ?stats=1 → window.__plazaGuerra(): onde cada peça VIVA da batalha
          // está, em metros do centro da cratera. Existe porque o defeito de
          // 27/08 (tiro nascendo a milhares de metros, por confundir mundo com
          // local) é invisível em chapa: clarão de boca dura 100 ms. Medir a
          // distância é determinístico; olhar a foto é sorte.
          if (wantStats) {
            ;(window as unknown as { __plazaGuerra?: () => unknown }).__plazaGuerra = () => {
              const centro = new THREE.Vector3(WAR_POS.x, 0, WAR_POS.z)
              const v = new THREE.Vector3()
              let vivos = 0
              let longe = 0
              let maior = 0
              let menorY = Infinity
              let enterradas = 0
              const chao = terrain.heightAt(WAR_POS.x, WAR_POS.z)
              const fujoes: string[] = []
              campo!.group.traverseVisible((o) => {
                if (!(o as THREE.Mesh).isMesh) return
                vivos++
                o.getWorldPosition(v)
                const d = Math.hypot(v.x - centro.x, v.z - centro.z)
                if (d > maior) maior = d
                if (v.y < menorY) menorY = v.y
                // 40 m abaixo do chão da cratera: fundo de cratera de verdade
                // não chega perto disso, então é peça enterrada
                if (v.y < chao - 40) enterradas++
                if (d > 1200) {
                  longe++
                  if (fujoes.length < 6) fujoes.push(`${o.name || o.type} a ${Math.round(d)} m`)
                }
              })
              return {
                meshesVisiveis: vivos,
                foraDoCampo: longe,
                maiorDistancia: Math.round(maior),
                fujoes,
                // ⚠️ o defeito do DATUM se enxerga AQUI: com o zero errado, as
                // peças de Y fixo ficavam dezenas de metros abaixo do chão
                chaoDaCratera: Math.round(terrain.heightAt(WAR_POS.x, WAR_POS.z)),
                // o assalto e o maior sistema do motor: se este numero nao sobe,
                // ele esta dormindo (era o que acontecia ate 27/08)
                assaltos: campo!.hud().assaltos,
                eventos: campo!.hud().eventos,
                fila: campo!.hud().filaEventos,
                churn: Number(campo!.hud().churnRelativo.toFixed(2)),
                menorY: Math.round(menorY),
                enterradas,
              }
            }
          }
          culler.add(campo.group, 3600, new THREE.Vector3(WAR_POS.x, 0, WAR_POS.z))
          // ⚠️ O FAROL: uma coluna de luz laranja de 600 m sobre a cratera,
          // visível do horizonte da praça. É o "tem algo ali" que faz alguém
          // atravessar 3 km; o parque tem a silhueta da cordilheira, a guerra
          // tem isto. Aditiva, sem luz real, custo de um cilindro.
          {
            // ⚠️ NA LATERAL, nunca no meio: no centro ele virava um mastro
            // atravessando a batalha (fundador, 25/08). Fica na ponta NW da
            // costura, fora do campo, como bandeira de sinalização.
            const fx = WAR_POS.x - 148
            const fz = WAR_POS.z - 148
            const farol = new THREE.Mesh(
              new THREE.CylinderGeometry(1.5, 4, 560, 10, 1, true),
              new THREE.MeshBasicMaterial({
                color: 0xff9540, transparent: true, opacity: 0.26,
                blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
              }),
            )
            farol.position.set(fx, terrain.heightAt(fx, fz) + 280, fz)
            scene.add(farol)

            // ⚠️ O SÍMBOLO DA BATALHA (fundador, 25/08): espadas cruzadas em
            // voxel girando no topo do farol, para o horizonte dizer O QUE há
            // ali, não só que há algo. Basic + aditivo, sem luz nova.
            const matEmblema = new THREE.MeshBasicMaterial({
              color: 0xffb066, transparent: true, opacity: 0.9,
              blending: THREE.AdditiveBlending, depthWrite: false,
            })
            // escala de horizonte: a 3 km, espada de 60 m e um cisco; 130 m le
            const emblema = new THREE.Group()
            for (const lado of [-1, 1]) {
              const lamina = new THREE.Mesh(new THREE.BoxGeometry(13, 130, 13), matEmblema)
              lamina.rotation.z = lado * (Math.PI / 4)
              const guarda = new THREE.Mesh(new THREE.BoxGeometry(40, 9, 9), matEmblema)
              guarda.rotation.z = lado * (Math.PI / 4)
              guarda.position.set(lado * 24, -24, 0)
              emblema.add(lamina, guarda)
            }
            emblema.position.set(fx, terrain.heightAt(fx, fz) + 640, fz)
            emblema.traverse((o) => { (o as any).raycast = () => {} })
            scene.add(emblema)
            emblemaGuerra = emblema
          }
        }

        // The deck (podium, gardens, supertrees, amphitheatre, pools, colonnade,
        // monorail) comes from the landing .blend; the three towers are the
        // landing-grade GLBs the /dogcity partners section shows (D6). Each tower
        // GLB ships with its own site slab; on the plaza those slabs would fight
        // the deck, so only the buildings are kept.
        const [plaza, spaceport, needle, bitflow, kray, btcMark] = await Promise.all([
          loadGlb('/city/plaza.glb'),
          loadGlb('/city/spaceport.glb'),
          loadGlb('/city/central-tower.glb'),
          loadGlb('/city/bitflow-hq.glb'),
          loadGlb('/city/kray-tower.glb'),
          loadGlb('/city/btc-mark.glb').catch(() => null),
        ])
        if (disposed) return
        // The Needle's own site slab would double the deck; the tower stands on the
        // deck alone. BitFlow and Kray keep their whole sites (gardens, kerbs, cars):
        // out at the anchor radius there is nothing for them to collide with.
        const stripByName = (root: THREE.Object3D, re: RegExp) => {
          const gone: THREE.Object3D[] = []
          root.traverse((o) => { if (re.test(o.name)) gone.push(o) })
          for (const o of gone) o.parent?.remove(o)
          return gone.length
        }
        stripByName(needle, /^(SITE_|PROP_)|_Site$/i)
        // item 3 da lista: os "pináculos brancos pontiagudos" em volta das placas
        // dos fundadores são o anel de jatos d'água da Needle (WATER_JET_RING,
        // raio 81, 30 m de altura). Saem: o Círculo dos Fundadores é o assunto ali.
        stripByName(needle, /^WATER_JET_RING$/)
        // item 13 da lista: fora os carros. O levantamento achou SITE_TRAFFIC nos
        // sítios das torres e as pistas de táxi do spaceport; a rua do anel
        // (PlazaRingRoad) e a estrada do parque ficam, que são via, não veículo.
        for (const root of [bitflow, kray]) stripByName(root, /^(SITE_TRAFFIC|.*_Car\d*|.*Vehicle.*)$/i)
        // ── OS SÍTIOS DA KRAY E DA BITFLOW PASSAM A FALAR COM A PRAÇA ──────────
        //
        // O fundador, 2026-08-23: "precisamos atacar o entorno da torre da Kray e
        // do QG da BitFlow, eles ainda não estão conversando com o entorno.
        // Asfalto diferente, jardins diferentes."
        //
        // ⚠️ A CAUSA NÃO É COR, É PROCEDÊNCIA. Cada GLB traz um QUARTEIRÃO DE
        // CIDADE inteiro: duas ruas com faixa pintada, meio-fio, calçada,
        // canteiros e a paleta da cena de origem, que era uma cidade na Terra.
        // Largado no meio de um jardim clássico lunar, esse lote vira um
        // retângulo preto com ruas que não levam a lugar nenhum, e é exatamente
        // isso que se vê de cima.
        //
        // Consertar no Blender seria reconstruir os dois prédios. Não é preciso:
        // os materiais do lote vêm com nome (`site_asphalt`, `site_kerb`,
        // `veg_leaf`…), então dá para reger o lote inteiro pelo NOME DO MATERIAL,
        // aqui, com a paleta do precinto ao lado.
        //
        // O que sai: as RUAS e a pintura de faixa. Não há carro na praça (item 13
        // desta mesma lista tirou todos), e uma pista com faixa central no meio de
        // um jardim é o resto mais visível do quarteirão antigo.
        // O que fica, repintado: o chão vira gramado do precinto, o passeio e o
        // meio-fio viram a pedra escura da praça, e a vegetação recebe os mesmos
        // verdes das sebes e copas do jardim.
        // ⚠️ A REPINTURA PRECISA ALCANÇAR TAMBÉM O LOD DE LONGE, e por isso ela
        // vira função aqui em cima: cada torre é um THREE.LOD com o GLB inteiro
        // perto e uma versão decimada longe. Repintar só o de perto faz a praça
        // trocar de paleta quando a câmera recua, e o quarteirão antigo volta.
        let reconcileSite: (root: THREE.Object3D | null) => void = () => {}
        let liftMassing: (root: THREE.Object3D | null) => void = () => {}
        {
          // A paleta é a do precinct.ts, copiada aqui de propósito com o nome
          // dito: se um dia o jardim mudar de verde, este bloco é o segundo lugar
          // a mudar, e o comentário é o aviso.
          const PAVE = 0x17181d      // paveMat do precinto
          const KERB = 0x2a2a30      // a mureta do anel
          const LAWN_C = 0x183121    // LAWN
          const HEDGE_C = 0x1a3a1f   // HEDGE
          const LEAF_C = 0x2f6b3a    // LEAF
          const TRUNK_C = 0x3a2c22   // TRUNK
          /** Some sem apagar geometria: material invisível. As primitivas do GLB
           *  vêm agrupadas por material dentro de uma malha só, então remover o
           *  nó levaria junto o que fica. */
          const hide = (m: THREE.MeshStandardMaterial) => {
            m.transparent = true
            m.opacity = 0
            m.depthWrite = false
            m.colorWrite = false
          }
          const repaint: Record<string, (m: THREE.MeshStandardMaterial) => void> = {
            site_asphalt: hide,
            road_paint: hide,
            site_paint: hide,
            road_mark: hide,
            // ⚠️ AS POÇAS DE LUZ DE RUA VÃO JUNTO COM A RUA. `spill_warm*` são
            // decalques de chão pintados para cair sobre ASFALTO escuro, onde
            // liam como o brilho dos postes molhando a pista. Sobre o gramado do
            // jardim viram três manchas cinzentas boiando na grama, e foi isso
            // que apareceu na chapa da BitFlow. A praça tem os postes dela.
            spill_warm: hide,
            spill_warm_2: hide,
            spill_warm_3: hide,
            site_ground: (m) => { m.color.setHex(LAWN_C); m.roughness = 0.95; m.metalness = 0 },
            // ⚠️ A CALÇADA RETANGULAR DO LOTE SAI INTEIRA, e não é repintura: é
            // o leque do precinto que passa a pavimentar as duas âncoras
            // (precinct.ts, "PÁTIO EM LEQUE"). Manter as duas seria um quadrado
            // de pedra por baixo de um setor de pedra, com duas bordas brigando
            // onde deveria haver uma.
            site_pave: hide,
            site_pave_band: hide,
            site_stone: (m) => { m.color.setHex(PAVE); m.roughness = 0.8; m.metalness = 0.1 },
            site_kerb: (m) => { m.color.setHex(KERB); m.roughness = 0.6; m.metalness = 0.2 },
            veg_hedge: (m) => { m.color.setHex(HEDGE_C); m.roughness = 0.9; m.metalness = 0 },
            veg_bed: (m) => { m.color.setHex(0x241d17); m.roughness = 1; m.metalness = 0 },
            veg_leaf: (m) => { m.color.setHex(LEAF_C); m.roughness = 0.9; m.metalness = 0 },
            veg_leaf_lit: (m) => { m.color.setHex(0x3d8148); m.roughness = 0.9 },
            veg_leaf_mid: (m) => { m.color.setHex(0x35743f); m.roughness = 0.9 },
            veg_frond: (m) => { m.color.setHex(LEAF_C); m.roughness = 0.9; m.metalness = 0 },
            veg_trunk: (m) => { m.color.setHex(TRUNK_C); m.roughness = 0.85; m.metalness = 0 },
          }
          let touched = 0
          reconcileSite = (root: THREE.Object3D | null) => {
            if (!root) return
            root.traverse((o) => {
              const mesh = o as THREE.Mesh
              if (!mesh.isMesh) return
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
              for (const mat of mats) {
                const fn = repaint[(mat?.name ?? '') as string]
                if (fn) { fn(mat as THREE.MeshStandardMaterial); touched++ }
              }
            })
          }
          reconcileSite(bitflow)
          reconcileSite(kray)
          if (wantStats) console.log('[plaza] sítios das âncoras: ', touched, 'materiais reconciliados com a praça')

          // ⚠️ A ARQUITETURA ESTAVA PINTADA DE PRETO, e é ela o assunto.
          //
          // Medido em 2026-08-23: o chão da praça está em 24 a 30% de luminância,
          // que é meio-tom, e as TORRES em 6,7%. O `massing` da BitFlow é #0b0e0b,
          // 4% de cinza. Nenhuma quantidade de luz salva um material que absorve
          // tudo: o sol bate e não volta nada, e a cidade lê como silhueta.
          //
          // Aqui a massa das três sobe para perto do dobro. Não é clarear a cena,
          // é dar ao sol alguma coisa em que bater. O vidro, os perfis e as faixas
          // de LED ficam como estão: eles já são o desenho.
          const LIFT: Record<string, number> = {
            massing: 2.1, massing_lip: 2.0, slab: 1.9, slab_edge: 1.6, mullion: 1.5,
          }
          liftMassing = (root: THREE.Object3D | null) => {
            root?.traverse((o) => {
              const mesh = o as THREE.Mesh
              if (!mesh.isMesh) return
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
              for (const mat of mats) {
                const k = LIFT[(mat?.name ?? '') as string]
                if (!k) continue
                const m = mat as THREE.MeshStandardMaterial
                // multiplica sem estourar: o teto é 22% de cinza, ainda escuro
                m.color.setRGB(Math.min(0.22, m.color.r * k), Math.min(0.22, m.color.g * k), Math.min(0.22, m.color.b * k))
              }
            })
          }
          for (const root of [bitflow, kray, needle]) liftMassing(root)
        }
        stripByName(spaceport, /^SP_Taxi\d+$/)
        // ── A REFORMA DO DECK (fundador, 2026-08-19: "completamente confusa,
        // elementos genéricos, árvores artificiais, anfiteatro") ──────────────
        // O deck vem da cena da landing com muita coisa que não conta a história
        // do projeto: sete supertrees, um anfiteatro com palco, uma passarela
        // aérea, três espelhos d'água de enfeite e canteiros. Tudo isso sai. O
        // que FICA é o que significa: o podium e o anel de pedra, as quatro
        // escadarias de acesso, a colunata da borda e o INLAY DO BITCOIN no piso.
        // (a colunata que vinha no GLB era um anel de cones brancos finos; sai
        // também, e no lugar entram colunas dóricas de verdade, em props-table)
        const stripped = stripByName(plaza, /^(PZ_Tree|PZ_Amp|PZ_Stage|PZ_Skywalk|PZ_Pool|PZ_Flora|PZ_GlowStems|PZ_Planters|PZ_Colonnade)/)
        if (wantStats) console.log('[plaza] deck: removidas', stripped, 'peças genéricas')
        // ⚠️ O DECALQUE ANTIGO SAI, E O MARCO ENTRA NO LUGAR DELE.
        //
        // `PZ_BtcInlay` era um ₿ chapado de 26 x 53 m, sem espessura e sem borda,
        // largado a 40 graus do eixo no quadrante nordeste (x 126, z -108), com o
        // material `M_StreetGlow` pintado de laranja aqui na carga. O fundador:
        // "um símbolo do Bitcoin genérico". Era mesmo.
        //
        // No lugar entra `btc-mark.glb` (blender/build_btc_mark.py): selo de latão
        // de 46 m embutido na laje, anel gravado, canal de luz, quatro entalhes
        // cardeais, a data do gênese, e o ₿ em bronze escuro de 21 m subindo dele,
        // inclinado nos 14 graus da marca.
        //
        // ⚠️ E ELE VAI PARA O EIXO NORTE, r 150. As quatro escadarias do deck estão
        // nos eixos: quem sobe pelo norte encontra o marco de frente com a Needle
        // atrás, que é o enquadramento que a praça já oferecia e ninguém usava. Na
        // diagonal, onde o decalque estava, não se chega de frente nunca.
        stripByName(plaza, /^PZ_BtcInlay$/)
        const MARK_R = 150
        if (btcMark) {
          btcMark.name = 'BtcMark'
          btcMark.position.set(0, DECK_Y, -MARK_R)
          // ⚠️ MEIA VOLTA, E ISSO CONSERTOU O QUE PARECIA SER MATERIAL. No Blender
          // o glifo foi levantado olhando para -Y, e o `export_yup` manda -Y do
          // Blender para +Z do glTF: na praça ele nascia de COSTAS para a
          // escadaria norte. Pior, o contorno de luz, que mora atrás do glifo,
          // passava a ficar na FRENTE dele e cobria a peça inteira com uma chapa
          // quente. Eu tinha atribuído isso a metal reflexivo e mexido em luz
          // duas vezes antes de olhar a orientação.
          btcMark.rotation.y = Math.PI
          // ⚠️ O SELO SAIU BRANCO ATÉ ESTA LINHA EXISTIR, e a causa não era luz:
          // a cena usa um `RoomEnvironment` de estúdio como ambiente, e METAL SEM
          // DIFUSA É SÓ REFLEXO. Com envMapIntensity cheio, latão e bronze viram
          // espelhos de um estúdio branco. Todo GLB da praça passa pelo `tameEnv`
          // por isso; o marco tinha nascido fora dele. Diminuir refletor não
          // resolvia nada, e foi o que eu tentei antes de medir.
          tameEnv(btcMark)
          btcMark.traverse((o) => {
            const mesh = o as THREE.Mesh
            if (!mesh.isMesh) return
            mesh.castShadow = true
            mesh.receiveShadow = true
          })
          scene.add(btcMark)
          culler.add(btcMark, 3200)

          // ⚠️ MONUMENTO SE ILUMINA, NÃO SE ACENDE. A primeira tentativa foi uma
          // lâmina emissiva atrás do glifo e saiu como logotipo de apresentação.
          // O que faz um bronze escuro existir de noite são dois refletores
          // rasantes, que é como qualquer praça de verdade resolve isso.
          for (const sx of [-1, 1]) {
            // ⚠️ 260 CANDELAS ERAM CEM VEZES A PRAÇA. O sol da cena é 2,6, o hemisférico
            // 0,5: dois refletores fortes lavaram o selo inteiro de branco. Aqui o
            // refletor só precisa separar o bronze do céu, não iluminar o deck.
            const spot = new THREE.SpotLight(0xffc98a, 46, 210, Math.PI / 9, 0.62, 2)
            spot.position.set(sx * 26, DECK_Y + 7, -MARK_R + 30)
            spot.target.position.set(0, DECK_Y + 11, -MARK_R)
            spot.castShadow = false
            scene.add(spot)
            scene.add(spot.target)
            culler.add(spot, 2600)
          }
        }
        // The precinct (praca-central.md §4.2, D7): the Needle at the centre of the
        // deck; four anchors on a ring at R_ANCHOR, one per cardinal point, every
        // front turned to the centre. In each tower GLB the signed façade faces +z,
        // so "face the plaza" is a rotation about y: west anchor +90°, east −90°.
        // LOD: cada torre é um THREE.LOD com o GLB inteiro até 1,3 km e a versão
        // decimada (blender/make_tower_lods.py, ~18 % dos triângulos) além disso;
        // o three troca sozinho pela distância da câmera. Os nós animados vivem no
        // nível 0 e continuam animados mesmo escondidos.
        const [needleLod1, bitflowLod1, krayLod1] = await Promise.all([
          loadGlb('/city/central-tower-lod1.glb').catch(() => null),
          loadGlb('/city/bitflow-hq-lod1.glb').catch(() => null),
          loadGlb('/city/kray-tower-lod1.glb').catch(() => null),
        ])
        if (disposed) return
        if (needleLod1) stripByName(needleLod1, /^(SITE_|PROP_)|_Site$/i)
        // o mesmo acordo com a praça, na versão de longe das duas âncoras
        reconcileSite(bitflowLod1)
        reconcileSite(krayLod1)
        for (const root of [bitflowLod1, krayLod1, needleLod1]) liftMassing(root)
        const LOD_DIST = profile.lodDistance // a vista de casa (1,6 km) fica com as torres inteiras
        const lodOf = (full: THREE.Object3D, low: THREE.Object3D | null) => {
          const lod = new THREE.LOD()
          lod.addLevel(full, 0)
          if (low) { mergeStaticByMaterial(low, /^$/); lod.addLevel(low, LOD_DIST, 0.08) } // histerese: sem pisca na fronteira
          return lod
        }
        const needleLod = lodOf(needle, needleLod1)
        needleLod.position.set(0, 39.9, 0)
        const bitflowLod = lodOf(bitflow, bitflowLod1)
        bitflowLod.position.copy(ANCHORS.west.pos)
        bitflowLod.rotation.y = ANCHORS.west.rotY
        const krayLod = lodOf(kray, krayLod1)
        krayLod.position.copy(ANCHORS.east.pos)
        krayLod.rotation.y = ANCHORS.east.rotY
        for (const root of [plaza, spaceport, needleLod, bitflowLod, krayLod]) {
          tameEnv(root)
          root.traverse((o) => {
            const m = o as THREE.Mesh
            if (!m.isMesh) return
            m.castShadow = true
            m.receiveShadow = true
            const mat = m.material as THREE.MeshStandardMaterial
            const name = o.name || ''
            // beacons and LEDs breathe; nothing else moves in the exports
            if (/beacon|led|glow|_light|lamp|strip|portal/i.test(name) && mat && 'emissiveIntensity' in mat) {
              pulses.push({ m: mat, base: mat.emissiveIntensity, rate: 0.9 + Math.random() * 0.8, phase: Math.random() * 6 })
            }
          })
          scene.add(root)
        }
        // the named-node contract of the tower GLBs (see app/dogcity/partners)
        for (const [root, name, amp] of [[kray, 'KRAY_CROWN_ICON', 1.4], [bitflow, 'BITFLOW_ROOF_MARK', 0]] as const) {
          const o = root.getObjectByName(name)
          if (o) sways.push({ o, y0: o.position.y, amp })
        }
        for (const [root, name] of [[kray, 'WATER_JET']] as const) {
          const o = root.getObjectByName(name)
          if (o) jets.push({ o, y0: o.scale.y })
        }
        // D9: the Needle's sign ring ("MOON • DOG…") turns, slowly, like a real one
        for (const name of ['NEEDLE_LED_BAND', 'NEEDLE_LED_DOTS']) {
          const o = needle.getObjectByName(name)
          if (o) spinners.push(o)
        }
        // ── item 1 da lista: BITFLOW também na face de TRÁS ──────────────────
        // O GLB só assina a fachada da praça (BITFLOW_SIGN_CROWN em z +40,3, no
        // topo). Quem vem do jardim norte ou do parque via a torre sem nome.
        //
        // 2026-08-19, fundador: "na parte de trás o agente só escreveu BITFLOW,
        // não usou a logo, tem que ser a LOGO OFICIAL". Então a face de trás
        // deixou de ser texto desenhado em canvas e passou a ser a marca de
        // verdade: `public/city/bitflow-logo.webp` é o lockup oficial (o bicho de
        // pixel laranja mais a palavra) tirado de `public/Bitflow.png`, com o
        // branco do fundo vazado para alfa. Proporção 1662x273 preservada.
        {
          const logo = await new Promise<THREE.Texture | null>((res) =>
            new THREE.TextureLoader().load('/city/bitflow-logo.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t) }, undefined, () => res(null)),
          )
          if (logo) {
            const W = 104, H = W * (273 / 1662)
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(W, H),
              new THREE.MeshBasicMaterial({ map: logo, transparent: true, toneMapped: false }),
            )
            sign.position.set(10, 311, -44.6) // a mesma altura do letreiro da frente, na face oposta
            sign.rotation.y = Math.PI
            sign.name = 'BITFLOW_SIGN_BACK'
            bitflow.add(sign)
          }
        }

        // perf: cada GLB vira poucas malhas (uma por material); os nós animados ficam de fora
        const KEEP = /^(KRAY_CROWN_ICON|BITFLOW_ROOF_MARK|WATER_JET|NEEDLE_LED_BAND|NEEDLE_LED_DOTS|BITFLOW_SIGN_BACK)$/
        for (const [root, label] of [[plaza, 'plaza'], [spaceport, 'spaceport'], [needle, 'needle'], [bitflow, 'bitflow'], [kray, 'kray']] as const) {
          const r = mergeStaticByMaterial(root, KEEP)
          if (wantStats) console.log(`[plaza] merged ${label}: ${r.before} → ${r.after} meshes`)
        }
        // the main pad sits on the terrain: keep the constant honest
        PAD_MAIN.y = heightAt(PAD_MAIN.x, PAD_MAIN.z) + 1
        // um foguete aposentado no pad de trás do spaceport (V2 Rocket, Diccbudd,
        // CC-BY-4.0): a silhueta que faltava no pátio; sem placa, é cenário
        void loadSf(gltf, SF.rocket).then((r) => {
          if (!r || disposed) return
          dressSf(r, { envMapIntensity: 1.2, roughness: 0.55 })
          const x = -380, z = 3300 // SP_Pad0
          r.position.set(x, heightAt(x, z) + 0.4, z)
          r.rotation.y = Math.PI * 0.15
          r.scale.setScalar(1.6)
          scene.add(r)
          culler.add(r, 6000, new THREE.Vector3(x, 0, z))
        })

        // The OrdCards Chalet at the south anchor (D2, nova redação): both slopes
        // of the "A" carry the FRONT of the official logo card, since 2026-08-21.
        // The back, with its QR, is no longer on the building: most approaches
        // landed on that side and the piece introduced itself with the face that
        // says nothing about what it is.
        stepDone('towers')
        const texLoader = new THREE.TextureLoader()
        const loadTex = (url: string) =>
          new Promise<THREE.Texture>((res, rej) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t) }, undefined, rej))
        const lf = await loadTex('/city/cards/logo-front.png')
        if (disposed) return
        chalet = buildChalet(lf)
        chalet.group.position.copy(ANCHORS.south.pos)
        chalet.group.rotation.y = ANCHORS.south.rotY
        scene.add(chalet.group)

        // The precinct: boulevards, the ring, the lunar garden, the Mother Tree (D7, D8).
        stepDone('chalet')
        precinct = buildPrecinct({ heightAt, profile, culler, realTrees: PROPS.length > 0 })
        scene.add(precinct.group)
        // compila os shaders agora, com o aviso de carga na tela, e não no primeiro
        // arrasto do dedo (eram ~60 programas: segundos de travada no celular)
        stepDone('garden')
        try { await renderer.compileAsync(scene, camera) } catch { /* driver sem compile paralelo: compila no primeiro quadro */ }
        if (disposed) return

        // Os monumentos (White Paper, Gênese, Satoshi, Pata, Jardim Ordinal) e a
        // Calçada dos Fundadores entram logo depois do jardim: texturas e o
        // leaderboard chegam pela rede, e nenhum deles segura o primeiro quadro.
        const pMonuments = buildMonuments({ heightAt, gltf, profile, culler })
          .then((m) => { if (disposed) { m.dispose(); return } monuments = m; scene.add(m.group) })
          .catch((err) => console.warn('[plaza] monuments did not load', err))
          .finally(() => stepDone('monuments'))
        // os adereços de fora (props-table.ts): entram depois do jardim, e cada um
        // só existe se o arquivo existir (a praça nunca quebra por um adereço)
        // as árvores semeadas dos setores vêm do precinto como MODELOS (item 11:
        // a copa-esfera procedural saiu), então a lista de adereços é a tabela
        // mais o que o jardim semeou
        const sectorSpecs = (precinct?.treeSpots ?? []).map((t) => ({
          file: t.file,
          why: 'árvore semeada dos setores (precinct.ts): modelo real no lugar da copa procedural',
          at: t.at,
          jitter: 0.22,
          cull: profile.smallCull * 1.4,
        }))
        const allProps = [...PROPS, ...sectorSpecs]
        const pProps = allProps.length
          ? buildProps({ specs: allProps, heightAt, gltf, profile, culler })
            .then((p) => { if (disposed) { p.dispose(); return } props = p; scene.add(p.group) })
            .catch((err) => console.warn('[plaza] props', err))
            .finally(() => stepDone('props'))
          : Promise.resolve(stepDone('props'))
        // a galeria do Dog Social Club (item 10): a coleção inteira num muro do
        // jardim ao lado da Kray; entra junto com os adereços
        const pDsc = buildDscGallery({ heightAt, profile, culler })
          .then((g) => { if (!g || disposed) { g?.dispose(); return } dsc = g; scene.add(g.group) })
          .catch((err) => console.warn('[plaza] dsc', err))
        // ⚠️ PRAZO OBRIGATÓRIO: este fetch mora DENTRO do portão de carga; no
        // incidente de IO de 26/08 a rota pendurou no banco anêmico e a praça
        // inteira ficou refém nos 90% ("Engraving the founders' plaques").
        // Sem dado a Calçada nasce vazia e a cidade abre; placa não segura porta.
        const pFounders = fetch('/api/donate/leaderboard', { signal: AbortSignal.timeout(10000) })
          .then((r) => (r.ok ? (r.json() as Promise<FoundersData>) : null))
          .catch(() => null)
          .then((data) => {
            if (disposed) return
            founders = buildFoundersWalk({ heightAt, data, profile, culler })
            scene.add(founders.group)
          })
          .finally(() => stepDone('founders'))

        // The Runestone park, 5.2 km to the north-east (D10, the landing's
        // position), loads after the plaza is up: it is a horizon until someone
        // flies there, and 2 MB of park should never delay the first frame.
        const pPark = loadPark({ baseAt: terrain.baseAt, meanHeight: terrain.meanHeight, gltf, profile, culler })
          .then((p) => { if (disposed) { p.dispose(); return } park = p; scene.add(p.group) })
          .catch((err) => console.warn('[plaza] park did not load', err))
          .finally(() => stepDone('park'))

        // o portão só abre depois de TUDO montado e dos shaders compilados: o
        // usuário não pega mais uma praça que não responde ao dedo
        await Promise.all([pMonuments, pProps, pFounders, pPark, pDsc])
        if (disposed) return
        // tudo VISÍVEL para compilar: o compile do three ignora o que está
        // invisível, e a visita guiada passa exatamente pelo que o culling
        // esconde. Compilar com tudo ligado tira o engasgo de cada parada.
        culler.revealAll()
        try { await renderer.compileAsync(scene, camera) } catch { /* sem compile paralelo */ }
        culler.update(camera.position)
        stepDone('shaders')
      } catch (err) {
        console.error('[plaza]', err)
        setBoot((b) => ({ ...b, failed: true, label: 'The plaza did not load' }))
        setHud((h) => ({ ...h, loading: null, error: 'The plaza did not load. Refresh to try again.' }))
      }
    }
    void boot()

    // ── demo mode (?demo=1): synthetic ships, so the choreography can be seen
    // on a quiet night. Client-only, never touches the feed or the database, and
    // the board says DEMO while it runs.
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'
    const demoTimers: ReturnType<typeof setTimeout>[] = []
    if (demo) {
      let n = 0
      const fake = (): DogTx => {
        n++
        const id = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
        const dog = Math.round(Math.pow(10, 3 + Math.random() * 5))
        return {
          txid: id, status: 'pending', first_seen: new Date().toISOString(), seen_pending: true,
          block_height: null, block_time: null, confirmed_at: null, dropped_at: null,
          dog_in: dog, dog_out: dog, dog_burn: 0, dog_net: dog, dog_change: 0, flow_kind: 'transfer' as const,
          explicit_edict: n % 2 === 0, cenotaph: false,
          senders: ['bc1pdemo' + id.slice(0, 20)], receivers: [{ address: 'bc1qdemo' + id.slice(20, 40), dog }],
          fee_sats: 300 + Math.round(Math.random() * 3000), vsize: 250, fee_rate: Number((1 + Math.random() * 6).toFixed(2)),
          n_in: 1, n_out: 2, rbf: true,
        }
      }
      const live: DogTx[] = []
      for (let i = 0; i < 6; i++) { const tx = fake(); live.push(tx); orbit.enter(tx, { silent: true }) }
      const tick = () => {
        // every 25 s: a new ship; every 4th tick a "block" lands the two lowest,
        // now and then one drops
        const tx = fake(); live.push(tx); orbit.enter(tx)
        if (live.length % 4 === 0) {
          const landed = live.splice(0, 2)
          for (const l of landed) orbit.land({ ...l, status: 'confirmed', block_height: 962984, confirmed_at: new Date().toISOString() })
        } else if (Math.random() < 0.15 && live.length > 3) {
          const d = live.splice(1, 1)[0]
          orbit.drop(d)
        }
        demoTimers.push(setTimeout(tick, 25_000))
      }
      demoTimers.push(setTimeout(tick, 8_000))
    }

    // ── the feed ────────────────────────────────────────────────────────────
    let fees = { fast: null as number | null, slow: null as number | null }
    const feed = startFeed({
      onReady(p) {
        fees = { fast: p.snapshot?.fee_fast ?? null, slow: p.snapshot?.fee_slow ?? null }
        for (const tx of p.pending) orbit.enter(tx, { silent: true })
        // the last landing wave stays on the apron for a while
        const cutoff = Date.now() - 12 * 60_000
        for (const tx of p.landed) if (tx.confirmed_at && new Date(tx.confirmed_at).getTime() > cutoff) orbit.park(tx)
      },
      onEnter: (tx) => orbit.enter(tx),
      onLand: (tx) => orbit.land(tx),
      onDrop: (tx) => orbit.drop(tx),
      onSnapshot(s, stale) {
        fees = { fast: s?.fee_fast ?? null, slow: s?.fee_slow ?? null }
        setHud((h) => ({ ...h, snapshot: s, stale, error: null }))
      },
      onError: (message) => setHud((h) => ({ ...h, error: `Feed: ${message}` })),
    })

    // ── picking ─────────────────────────────────────────────────────────────
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downAt = 0
    let downXY = [0, 0]
    let lastTapAt = 0
    let lastTapXY = [0, 0]
    const onDown = (e: PointerEvent) => { downAt = performance.now(); downXY = [e.clientX, e.clientY] }
    const onUp = (e: PointerEvent) => {
      if (performance.now() - downAt > 350) return
      if (Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6) return
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const now = performance.now()
      const isDouble = now - lastTapAt < 380 && Math.hypot(e.clientX - lastTapXY[0], e.clientY - lastTapXY[1]) < 24
      lastTapAt = now; lastTapXY = [e.clientX, e.clientY]
      if (isDouble) {
        // o que houver sob o dedo: malhas só (pontos e sprites não contam)
        ray.params.Points = { threshold: 0 }
        const hits = ray.intersectObjects(scene.children, true).filter((h) => (h.object as THREE.Mesh).isMesh && !(h.object as THREE.Sprite).isSprite)
        if (hits.length) focusAt(hits[0].point)
        return
      }
      const tx = orbit.pick(ray)
      setHud((h) => ({ ...h, picked: tx }))
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    // ── voar: um tween curto de (câmera, alvo) para (câmera, alvo) ─────────
    const fly = { on: false, t0: 0, dur: 1.2, p0: new THREE.Vector3(), t0v: new THREE.Vector3(), p1: new THREE.Vector3(), t1: new THREE.Vector3() }
    const flyTo = (v: View, dur = 1.4) => {
      fly.p0.copy(camera.position); fly.t0v.copy(controls.target)
      fly.p1.copy(v.pos); fly.t1.copy(v.target)
      fly.t0 = performance.now(); fly.dur = dur; fly.on = true
      controls.autoRotate = false
      lastInteraction = performance.now()
    }
    // o pouso cinematográfico da entrada: desce devagar do recuo até o
    // frame-herói da batalha (só quando a chegada é a guerra, ver lá em cima)
    if (entradaGuerra) flyTo({ pos: home.pos.clone(), target: home.target.clone() }, 4.2)
    // duplo toque em qualquer coisa: o alvo vai até o ponto tocado e a câmera
    // chega perto, mantendo a direção; é assim que se chega a uma placa, a uma
    // estátua, ao parque
    const focusAt = (hit: THREE.Vector3) => {
      const dir = camera.position.clone().sub(hit)
      const dist = dir.length()
      const nd = THREE.MathUtils.clamp(dist * 0.32, 14, 420)
      dir.normalize()
      if (dir.y < 0.12) dir.y = 0.12 // nunca rasteiro demais ao chegar
      dir.normalize()
      const pos = hit.clone().addScaledVector(dir, nd)
      pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 3)
      flyTo({ pos, target: hit.clone() }, 1.1)
    }

    // ── a visita guiada ────────────────────────────────────────────────────
    // Um passo é: voar 4,2 s até a próxima vista e segurar até completar 6,4 s.
    // Enquanto ela roda os controles ficam desligados, mas QUALQUER gesto a
    // encerra — ninguém fica preso num filme.
    let tourTimer: ReturnType<typeof setTimeout> | null = null
    let tourStep = -1
    let tourRunning = false
    let shadowDirty = false
    const stopTour = () => {
      if (tourTimer) clearTimeout(tourTimer)
      tourTimer = null
      tourStep = -1
      tourRunning = false
      shadowDirty = true // o mapa de sombra ficou congelado durante os voos
      setTour(null)
      controls.enabled = true
      controls.autoRotate = false
    }
    // no celular a visita não sai da praça: as duas paradas a 5 km (parque e
    // caverna) dobram o que está desenhado e é onde o aparelho engasga
    const route = profile.tier === 'mobile' ? TOUR.filter((st) => st.key !== 'park' && !st.key.startsWith('temple')) : TOUR
    const nextTourStep = () => {
      tourStep += 1
      if (tourStep >= route.length) { stopTour(); return }
      const st = route[tourStep]
      // as paradas longe (parque, caverna) ganham voo mais longo: a mesma
      // distância no mesmo tempo é o que fazia a câmera parecer arrancada
      const far = st.key === 'park' || st.key.startsWith('temple')
      flyTo(viewFor(st.key, camera.aspect), far ? TOUR_FLY_S * 1.6 : TOUR_FLY_S)
      setTour({ i: tourStep, text: st.text, n: route.length })
      tourTimer = setTimeout(nextTourStep, far ? TOUR_HOLD_MS + 2200 : TOUR_HOLD_MS)
    }
    const startTour = () => {
      if (tourTimer) clearTimeout(tourTimer)
      tourStep = -1
      tourRunning = true
      controls.enabled = false
      nextTourStep()
    }
    const cancelTourOnInput = () => { if (tourTimer) stopTour() }
    renderer.domElement.addEventListener('pointerdown', cancelTourOnInput)
    renderer.domElement.addEventListener('wheel', cancelTourOnInput, { passive: true })
    window.addEventListener('keydown', cancelTourOnInput)

    apiRef.current = {
      flyTo(name) { flyTo(viewFor(name, camera.aspect)) },
      async follow(txid) {
        const inScene = orbit.follow(txid)
        if (inScene) {
          setHud((h) => ({ ...h, followed: inScene, followNote: null, picked: inScene }))
          return
        }
        const tx = await feed.lookup(txid)
        if (!tx) {
          setHud((h) => ({ ...h, followed: null, followNote: 'Not a DOG transaction our node has seen in the last 24 h.' }))
          return
        }
        setHud((h) => ({
          ...h,
          followed: tx,
          picked: tx,
          followNote:
            tx.status === 'confirmed'
              ? `Landed in block ${fmtInt.format(tx.block_height ?? 0)}.`
              : tx.status === 'dropped'
                ? 'It left the mempool without a block (replaced or evicted).'
                : 'In orbit.',
        }))
      },
      home() { flyTo(homeFor(camera.aspect)) },
      startTour,
      stopTour,
    }
    if (wantStats) (window as unknown as { __plazaFly?: (n: string) => void }).__plazaFly = (n: string) => apiRef.current?.flyTo(n)
    // ?stats=1 → window.__plazaView(): devolve o enquadramento ATUAL já escrito
    // como a linha de viewFor(), inclusive em coordenadas relativas a WAR_POS.
    // Existe porque enquadrar no olho e depois transcrever numero na mao e onde
    // a intencao se perde: o fundador posiciona a camera arrastando, chama isto,
    // e o que sai cola direto no switch de viewFor.
    if (wantStats) {
      const r = (n: number) => Math.round(n)
      ;(window as unknown as { __plazaView?: () => unknown }).__plazaView = () => {
        const p = camera.position, t = controls.target
        return {
          aspect: +camera.aspect.toFixed(3),
          modo: camera.aspect >= 1 ? 'paisagem (aspect >= 1)' : 'retrato (aspect < 1)',
          absoluto: `pos(${r(p.x)}, ${r(p.y)}, ${r(p.z)})  target(${r(t.x)}, ${r(t.y)}, ${r(t.z)})`,
          relativoWarPos:
            `{ pos: new THREE.Vector3(WAR_POS.x ${p.x - WAR_POS.x >= 0 ? '+' : '-'} ${Math.abs(r(p.x - WAR_POS.x))}, ${r(p.y)}, WAR_POS.z ${p.z - WAR_POS.z >= 0 ? '+' : '-'} ${Math.abs(r(p.z - WAR_POS.z))}), ` +
            `target: new THREE.Vector3(WAR_POS.x ${t.x - WAR_POS.x >= 0 ? '+' : '-'} ${Math.abs(r(t.x - WAR_POS.x))}, ${r(t.y)}, WAR_POS.z ${t.z - WAR_POS.z >= 0 ? '+' : '-'} ${Math.abs(r(t.z - WAR_POS.z))}) }`,
          alturaDaCamera: r(p.y),
          distanciaAoAlvo: r(p.distanceTo(t)),
        }
      }
    }
    // ?tx=<txid>: chegou pela landing (ou por um link) já seguindo uma nave
    {
      const txParam = (new URLSearchParams(window.location.search).get('tx') || '').trim().toLowerCase()
      if (/^[0-9a-f]{64}$/.test(txParam)) {
        setFollowInput(txParam)
        setFollowOpen(true) // a resposta do follow mora no painel: abre pra quem chegou pelo link
        // depois do primeiro feed: o orbit precisa das naves para achar a dela
        setTimeout(() => { void apiRef.current?.follow(txParam) }, 2500)
      }
    }

    // o portão: quando tudo terminou, os controles ligam. E a vista se refaz:
    // as vistas do parque (o templo na caverna) dependem de TEMPLE_WORLD, que só
    // existe depois que o parque carrega — pedidas na abertura, elas caíam na
    // estimativa e a câmera parava 86 m abaixo do chão.
    readyRef.current = () => {
      controls.enabled = true
      const want = new URLSearchParams(window.location.search).get('view')
      // ⚠️ A VISITA GUIADA NUNCA DISPARA SOZINHA. Ela abria automaticamente na
      // primeira visita da sessão e sequestrava a câmera de quem só queria
      // andar (o fundador vetou: tour só se o usuário clicar em TOUR). O botão
      // no topo é a única porta.
      if (want && /^temple/.test(want)) {
        const v = viewFor(want, camera.aspect)
        camera.position.copy(v.pos)
        controls.target.copy(v.target)
        controls.update()
      }
    }

    // ── loop ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let raf = 0
    let hudTick = 0
    let lastFrameAt = performance.now()
    let statsTick = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(0.1, clock.getDelta())
      const t = clock.elapsedTime
      const nowMs = performance.now()
      governor.sample(nowMs - lastFrameAt, nowMs)
      lastFrameAt = nowMs
      culler.update(camera.position)
      if (!controls.autoRotate && performance.now() - lastInteraction > 25_000) controls.autoRotate = true
      if (fly.on) {
        const u = Math.min(1, (performance.now() - fly.t0) / (fly.dur * 1000))
        const k = u * u * (3 - 2 * u)
        camera.position.lerpVectors(fly.p0, fly.p1, k)
        controls.target.lerpVectors(fly.t0v, fly.t1, k)
        if (u >= 1) { fly.on = false; shadowDirty = true }
      }
      controls.update()
      // o chão: a câmera nunca entra no regolito nem no deck (1,7 m = olhos de pé)
      {
        const gy = groundAt(camera.position.x, camera.position.z) + 1.7
        if (camera.position.y < gy) {
          // ⚠️ O ALVO SOBE JUNTO, e é isso que faz olhar para cima funcionar.
          // Empurrar só a câmera devolvia a vista para baixo no quadro seguinte
          // (a câmera voltava a ficar ACIMA do alvo). Subindo os dois pela mesma
          // medida, a direção do olhar fica intacta e o rig apenas sai do chão.
          const lift = gy - camera.position.y
          camera.position.y = gy
          controls.target.y += lift
        }
        const ty = groundAt(controls.target.x, controls.target.z) + 0.3
        if (controls.target.y < ty) controls.target.y = ty
      }
      // em voo da visita guiada a sombra está congelada: refazer o enquadramento
      // do mapa a cada quadro seria trabalho jogado fora
      if (!(fly.on && tourRunning)) followShadow()
      orbit.update(t, dt, fees)
      for (const p of pulses) p.m.emissiveIntensity = p.base * (0.8 + 0.25 * Math.sin(t * p.rate + p.phase))
      for (const s of sways) { s.o.rotation.y = Math.sin(t * 0.22) * 0.95; s.o.position.y = s.y0 + Math.sin(t * 0.8) * s.amp }
      for (const j of jets) j.o.scale.y = j.y0 * (0.88 + 0.12 * Math.sin(t * 1.4))
      chalet?.update(t)
      precinct?.update(t)
      monuments?.update(t)
      founders?.update(t)
      dsc?.update(t)
      park?.update(t, renderer.domElement.clientHeight / 2, camera.position)
      // ── a guerra acorda por proximidade e a interface muda de modo ────────
      // O feed liga a 1,4 km e desliga ao se afastar; o HUD do modo jogo entra
      // em fade de 1,1 km até 600 m, escrito DIRETO no DOM (zero re-render).
      if (campo) {
        const dWar = camera.position.distanceTo(WAR_POS)
        const quer = dWar < 2600
        if (quer !== campoVivo) {
          campoVivo = quer
          campo.setLive(quer)
        }
        if (dWar < 3600) campo.update(nowMs)
        if (emblemaGuerra) emblemaGuerra.rotation.y = nowMs * 0.0006
        if (warHudRef.current) {
          // ⚠️ raio generoso: o ponto bom de assistir no celular fica LONGE
          // (retrato pede recuo) e a 1,1 km o preço já tinha sumido da tela
          const k = Math.min(1, Math.max(0, (2300 - dWar) / 800))
          warHudRef.current.style.opacity = k.toFixed(2)
          // ⚠️ a fita e a legenda dividem a MESMA calha da direita: com as duas
          // abertas o painel ficava por cima dos trades e os dois liam sujo
          if (warFitaRef.current) {
            warFitaRef.current.style.opacity = legendaAbertaRef.current ? '0' : k.toFixed(2)
          }
          if (k > 0 && (hudTick & 31) === 1) {
            const h = campo.hud()
            if (warPrecoRef.current) warPrecoRef.current.textContent = h.preco > 0 ? `$${h.preco.toFixed(6)}` : '$-'
            if (warPressaoRef.current) {
              const tot = h.compra + h.venda
              warPressaoRef.current.style.width = `${(tot > 0 ? (h.compra / tot) * 100 : 50).toFixed(1)}%`
            }
            if (warBaixasRef.current) {
              warBaixasRef.current.textContent = `bought ${fmtQtd(h.ursosCaidos)} · sold ${fmtQtd(h.caesCaidos)} DOG`
            }
            if (legendaAbertaRef.current) {
              setLegendaDados({
                dogPorSoldado: h.dogPorSoldado, niveisBook: h.niveisBook, niveisEncenados: h.niveisEncenados,
                bidsDog: h.bidsDog, asksDog: h.asksDog, spread: h.spread,
                vwap24: h.vwap24, volume24: h.volume24, trades24: h.trades24,
                low24: h.low24, high24: h.high24, preco: h.preco, status: h.status,
                churnRelativo: h.churnRelativo, assaltos: h.assaltos, eventos: h.eventos,
              })
            }
            if (warBidsRef.current) warBidsRef.current.textContent = `BIDS ${fmtQtd(h.bidsDog)}`
            if (warAsksRef.current) warAsksRef.current.textContent = `ASKS ${fmtQtd(h.asksDog)}`
            // ── a fita ────────────────────────────────────────────────────
            // ⚠️ A ORDEM DOS FILHOS DE CADA LINHA É CONTRATO com o JSX lá
            // embaixo: hora, seta, quantidade, preço. Mexeu no JSX, mexe aqui.
            {
              const fita = h.fita || []
              if (warFitaRef.current) warFitaRef.current.style.display = fita.length ? '' : 'none'
              for (let i = 0; i < FITA_LINHAS; i++) {
                const linha = warFitaLinhas.current[i]
                if (!linha) continue
                const tr = fita[i]
                if (!tr) { linha.style.visibility = 'hidden'; continue }
                linha.style.visibility = ''
                const f = linha.children
                if (f.length < 4) continue
                f[0].textContent = fmtHora(tr.t)
                f[1].textContent = tr.lado === 'buy' ? '▲' : '▼'
                ;(f[1] as HTMLElement).style.color = tr.lado === 'buy' ? '#f7931a' : '#f87171'
                f[2].textContent = fmtQtd(tr.qty)
                f[3].textContent = `$${fmtPreco(tr.preco)}`
              }
              // no celular a fita colapsa nos três últimos, numa linha só, dentro
              // do próprio cartão: coluna lateral em 390px come a tela
              if (warFitaMobileRef.current) {
                warFitaMobileRef.current.textContent = fita.length
                  ? fita.slice(0, 3).map((tr) => `${tr.lado === 'buy' ? '▲' : '▼'} ${fmtQtd(tr.qty)}`).join('  ')
                  : ''
              }
            }
          }
        }
      }
      for (const sp of spinners) sp.rotation.y = t * 0.12
      // ⚠️ SEM PARALAXE: a Terra anda junto com a câmera, então a direção dela no
      // céu é sempre a mesma e o tamanho na tela nunca muda.
      earth.position.copy(camera.position).addScaledVector(EARTH_DIR, EARTH_DIST)
      // ⚠️ E ELA PARA DE RODAR NA CARA DE QUEM OLHA. Estava dando uma volta a cada
      // 26 minutos: dá para VER girando, e o que gira à vista é coisa perto. A
      // Terra leva 24 horas. Isto aqui é uma volta a cada 12 horas de relógio,
      // vinte vezes o real: imperceptível numa visita, e o bastante para as
      // nuvens não parecerem pintadas em quem deixa a aba aberta.
      earth.rotation.y = t * 0.00015
      const cl = earth.getObjectByName('Clouds'); if (cl) cl.rotation.y = t * 0.00019
      // o governador decide se o mapa de sombra atualiza a cada quadro ou a cada
      // dois. EM VOO da visita guiada ele congela: refazer a sombra do sol a cada
      // quadro enquanto a câmera atravessa 5 km era metade do engasgo que o
      // fundador viu. Ao pousar, uma atualização só.
      renderer.shadowMap.autoUpdate = false
      if (fly.on && tourRunning) renderer.shadowMap.needsUpdate = false
      else if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false }
      else if (statsTick % governor.shadowEvery === 0) renderer.shadowMap.needsUpdate = true
      // ── TREMOR DE IMPACTO ────────────────────────────────────────────
      // Deslocamento aplicado ao redor do render e desfeito logo depois: o
      // OrbitControls nunca vê, então não briga com o damping nem acumula.
      // ⚠️ A AMPLITUDE ACOMPANHA A DISTÂNCIA. No palco solo a câmera está a
      // dezenas de metros e 0,55 basta; aqui ela pode assistir de 400 m, onde
      // o mesmo número não move um pixel. Amplitude proporcional à distância
      // mantém o abalo do MESMO tamanho na tela, e acima de 1,2 km não sacode
      // nada: dali a batalha é uma brasa no horizonte e tremer a cidade
      // inteira por causa dela seria ruído.
      let sx = 0
      let sy = 0
      if (tremorT0 > 0) {
        const ft = (performance.now() - tremorT0) / 700
        if (ft >= 1) tremorT0 = -1
        else {
          const dist = camera.position.distanceTo(WAR_POS)
          if (dist < 1200) {
            const amp = 0.0016 * dist * tremorForca * (1 - ft)
            sx = (Math.sin(nowMs * 0.06) * 0.5) * amp
            sy = (Math.sin(nowMs * 0.083 + 1.7) * 0.5) * amp
          }
        }
      }
      camera.position.x += sx
      camera.position.y += sy
      renderer.render(scene, camera)
      camera.position.x -= sx
      camera.position.y -= sy
      statsTick++
      if (wantStats && (statsTick & 15) === 0) {
        const info = renderer.info
        const w = window as unknown as { __plazaStats?: unknown }
        w.__plazaStats = { fps: Math.round(1000 / Math.max(1, nowMs - lastFrameAt + dt * 1000)), calls: info.render.calls, triangles: info.render.triangles, points: info.render.points, lines: info.render.lines, programs: info.programs?.length ?? 0, textures: info.memory.textures, geometries: info.memory.geometries, dpr: governor.pixelRatio, tier: profile.tier, quality: profile.quality, shadowEvery: governor.shadowEvery }
        setHud((h) => ({ ...h, stats: `${profile.tier} · ${profile.quality} · dpr ${governor.pixelRatio.toFixed(2)} · shadow/${governor.shadowEvery} · ${info.render.calls} calls · ${(info.render.triangles / 1e6).toFixed(2)}M tris · ${Math.round(1000 / Math.max(1, dt * 1000))} fps` }))
      }
      // the counters on the board follow the scene, twice a second
      if ((hudTick++ & 31) === 0) {
        const c = orbit.count()
        setHud((h) => (h.orbit === c.orbit + c.landing && h.parked === c.parked ? h : { ...h, orbit: c.orbit + c.landing, parked: c.parked }))
      }
    }
    animate()

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      feed.stop()
      for (const t of demoTimers) clearTimeout(t)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointerdown', wake)
      renderer.domElement.removeEventListener('wheel', wake)
      controls.dispose()
      orbit.dispose()
      chalet?.dispose()
      precinct?.dispose()
      park?.dispose()
      monuments?.dispose()
      props?.dispose()
      dsc?.dispose()
      founders?.dispose()
      campo?.dispose()
      draco.dispose()
      lunarEnv.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry?.dispose()
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          for (const mat of mats) mat?.dispose()
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  const s = hud.snapshot
  const tipAge = minutesAgo(s?.tip_time ?? null)
  const lastDogAge = minutesAgo(s?.last_dog_block_time ?? null)
  const bootPct = Math.min(99.5, (BOOT_STEPS.filter((st) => boot.done.includes(st.key)).reduce((a, b) => a + b.weight, 0) / BOOT_TOTAL) * 100)
  const live = hud.stale != null && hud.stale < 40 && !hud.error

  const submitFollow = (e: React.FormEvent) => {
    e.preventDefault()
    const v = followInput.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(v)) {
      setHud((h) => ({ ...h, followNote: 'Paste a full transaction id (64 hex characters).' }))
      return
    }
    void apiRef.current?.follow(v)
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white select-none">
      <div
        ref={mountRef}
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: boot.ready ? 1 : 0, pointerEvents: boot.ready ? 'auto' : 'none' }}
      />

      {/* ── o portão: a praça só é entregue montada ────────────────────────── */}
      {!boot.ready && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black px-8 text-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">DogCity · the Moon</p>
            <h1 className="mt-2 font-mono text-xl font-semibold tracking-tight text-white sm:text-2xl">Satoshi Plaza</h1>
          </div>
          <div className="w-full max-w-sm">
            <div className="h-[3px] w-full overflow-hidden bg-white/10">
              <div
                className="h-full bg-[#F7931A] transition-[width] duration-500 ease-out"
                style={{ width: `${Math.round(bootPct)}%` }}
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">
              <span>{boot.failed ? 'Failed. Refresh to try again.' : `${boot.label}…`}</span>
              <span className="tabular-nums text-white/35">{Math.round(bootPct)}%</span>
            </div>
          </div>
          <p className="max-w-xs font-mono text-[10px] leading-relaxed text-white/25">
            The whole plaza loads before it opens: terrain, towers, gardens, monuments and the park.
          </p>
        </div>
      )}

      {boot.ready && <>

      {!plate && <>
      {/* ── o modo jogo: invisível até a câmera chegar perto da cratera ── */}
      {/* no celular a cápsula sobe acima da linha do botão Follow tx e encolhe */}
      <div
        ref={warHudRef}
        className="pointer-events-none absolute inset-x-0 flex justify-center transition-opacity duration-300 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
        style={{ opacity: 0 }}
      >
        <div className="border border-white/10 bg-black/85 px-3 py-2 text-center font-mono sm:px-4 sm:py-2.5">
          <div className="text-[8px] uppercase tracking-[0.24em] text-white/40 sm:text-[9px] sm:tracking-[0.3em]">The Price War · DOG / USD · Kraken live</div>
          <div ref={warPrecoRef} className="mt-1 text-lg tracking-tight text-white/95 tabular-nums sm:text-xl">$-</div>
          <div className="mx-auto mt-1.5 h-1 w-44 overflow-hidden rounded-full bg-white/10 sm:w-56">
            <div ref={warPressaoRef} className="h-full bg-gradient-to-r from-[#f7931a] to-[#c96a12]" style={{ width: '50%' }} />
          </div>
          {/* celular: a fita cabe em uma linha, dentro do cartão */}
          <div
            ref={warFitaMobileRef}
            className="mt-1 font-mono text-[8px] tracking-[0.12em] tabular-nums text-white/45 [@media(min-width:640px)_and_(min-height:521px)]:hidden"
          />
          <div ref={warBaixasRef} className="mt-1 text-[8px] uppercase tracking-[0.18em] text-white/35 tabular-nums sm:text-[9px]">bought 0 · sold 0 DOG</div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[8px] uppercase tracking-[0.18em] tabular-nums sm:text-[9px]">
            <span ref={warBidsRef} className="text-[#f7931a]/90">BIDS 0</span>
            <span className="text-white/25">·</span>
            <span ref={warAsksRef} className="text-red-400/85">ASKS 0</span>
          </div>
          {/* ⚠️ `pointer-events-auto` obrigatório: o invólucro do HUD é
              `pointer-events-none` para não roubar o arrasto da câmera, então
              todo controle dentro dele precisa reativar o ponteiro no próprio
              elemento, senão o clique atravessa e nada acontece. */}
          <button
            type="button"
            onClick={() => setLegendaAberta(true)}
            className="pointer-events-auto mt-2 border border-white/15 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 hover:border-[#f7931a]/60 hover:text-[#f7931a] sm:text-[9px]"
          >
            How to read this
          </button>
        </div>
      </div>
      <WarLegend aberto={legendaAberta} onFechar={() => setLegendaAberta(false)} dados={legendaDados} />

      {/* ── A FITA DE TRADES REAIS, coluna à direita ────────────────────────
             Cada linha é uma negociação que a Kraken serviu e que virou tiro na
             batalha: é a ponte entre o mercado e a encenação, e sem ela a
             batalha vira enfeite. Herda a opacidade do cartão de preço, que
             some com a distância, porque as duas coisas falam do mesmo campo.
             ⚠️ SÓ EM DESKTOP DE VERDADE (largura E altura), a mesma régua do
             painel Follow tx: no celular deitado a coluna cobria a batalha. */}
      <div
        ref={warFitaRef}
        className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 select-none flex-col items-end gap-1 font-mono text-[10px] tabular-nums tracking-[0.04em] text-white/55 transition-opacity duration-300 [@media(min-width:640px)_and_(min-height:521px)]:flex"
        style={{ opacity: 0 }}
      >
        <div className="mb-0.5 text-[9px] uppercase tracking-[0.22em] text-white/25">Tape</div>
        {Array.from({ length: FITA_LINHAS }, (_, i) => (
          <div
            key={i}
            ref={(el) => { warFitaLinhas.current[i] = el }}
            className="flex items-center gap-1.5"
            style={{ visibility: 'hidden' }}
          >
            <span className="text-white/30" />
            <span />
            <span className="text-white/75" />
            <span className="text-white/40" />
          </div>
        ))}
      </div>

      {/* ── title, and the way back: the landing is the front door, the site is home */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
          <a href="/dogcity" className="hover:text-white">DogCity</a>
          <span className="mx-2 text-white/25">·</span>
          <a href="/" className="hover:text-white">DOG DATA</a>
        </p>
        <h1 className="mt-1 font-mono text-base font-semibold tracking-tight text-white sm:text-xl">Satoshi Plaza</h1>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Mare Tranquillitatis · the Moon</p>
        {hud.stats && <p className="mt-0.5 font-mono text-[10px] text-[#F7931A]/80">{hud.stats}</p>}
        {/* ── places: voar até um lugar; duplo toque na cena aproxima de qualquer coisa ── */}
        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => setPlacesOpen((v) => !v)}
            className="border border-white/15 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 hover:border-white/40 hover:text-white"
          >
            Places {placesOpen ? '−' : '+'}
          </button>
          <button
            type="button"
            onClick={() => (tour ? apiRef.current?.stopTour() : apiRef.current?.startTour())}
            className="ml-2 border border-white/15 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 hover:border-white/40 hover:text-white"
          >
            {tour ? 'Stop tour' : 'Tour'}
          </button>
          {/* a guerra ganha botão próprio: ninguém deveria precisar do menu
              pra ACHAR uma batalha (fundador não achou, 25/08). No lite o
              campo não existe, então o botão também não. */}
          {!liteUi && (
            <button
              type="button"
              onClick={() => apiRef.current?.flyTo('war')}
              className="ml-2 border border-[#F7931A]/50 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F7931A]/90 hover:border-[#F7931A] hover:text-[#F7931A]"
            >
              War
            </button>
          )}
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className="ml-2 border border-white/15 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 hover:border-white/40 hover:text-white"
          >
            Chat
          </button>
          {/* follow mora aqui em cima em todo tamanho: o painel só abre no clique
             (fundador: "em desktop ela também deve ficar dentro do botão") */}
          <button
            type="button"
            onClick={() => setFollowOpen((v) => !v)}
            className="ml-2 border border-white/15 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 hover:border-white/40 hover:text-white"
          >
            Follow tx
          </button>
          {placesOpen && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-[16rem] border border-white/10 bg-black/90 py-1">
              {PLACES.map((pl) => (
                <li key={pl.key}>
                  <button
                    type="button"
                    onClick={() => { apiRef.current?.flyTo(pl.key); setPlacesOpen(false) }}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left font-mono text-[11px] text-white/85 hover:bg-white/10"
                  >
                    <span>{pl.label}</span>
                    <span className="text-[9px] uppercase tracking-[0.15em] text-white/35">{pl.hint}</span>
                  </button>
                </li>
              ))}
              <li className="px-3 pb-1 pt-2 font-mono text-[9px] leading-relaxed text-white/35">
                Double-tap anything in the scene to approach it. Pinch or scroll to get within a few metres.
              </li>
              <li className="px-3 pb-1 pt-2 font-mono text-[9px] tracking-[0.15em] text-white/45">
                QUALITY:{' '}
                {(['high', 'balanced', 'low'] as const).map((q, i) => (
                  <span key={q}>
                    {i > 0 && <span className="text-white/25"> · </span>}
                    <a href={`/city?quality=${q}`} className={q === qualityNow ? 'text-[#F7931A]' : 'hover:text-white'}>{q.toUpperCase()}</a>
                  </span>
                ))}
              </li>
              <li className="px-3 pb-1 pt-1 font-mono text-[8px] leading-relaxed text-white/25">
                3D credits: {SF_CREDITS.map((c, i) => (
                  <span key={c.title}>{i > 0 && ' · '}{c.title} by {c.author} ({c.license})</span>
                ))} · planet textures by three.js.
              </li>
            </ul>
          )}
        </div>
        {/* o chamado da obra: só no desktop, onde há coluna livre; no telefone o
            mesmo destino está no link "DogCity" acima, e o board ocupa o alto */}
        {fund && (
          <a
            href="/dogcity#build"
            className="mt-2 hidden w-[16rem] border border-[#F7931A]/40 bg-black/70 px-3 py-2 hover:border-[#F7931A] sm:block"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F7931A]">Build DogCity</p>
            <div className="mt-1.5 h-[3px] w-full overflow-hidden bg-white/10">
              <div className="h-full bg-[#F7931A]" style={{ width: `${Math.min(100, Math.round(fund.pct))}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-white/60">
              {fmtDog(fund.raised)} of {fmtDog(fund.goal)} DOG · {fund.donors} builder{fund.donors === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 font-mono text-[9px] leading-relaxed text-white/35">
              The grand opening at 10M DOG opens the city to holder mints. Fund a block →
            </p>
          </a>
        )}
      </div>

      {/* ── the board: under the title on phones, top-right on desktop ──────
          ⚠️ no celular o bloco de título (marca + h1 + subtítulo + botões)
          desce até ~9rem; a 5.6rem a barra cobria PLACES e TOUR */}
      <div className="absolute left-4 right-4 top-[9.4rem] sm:left-auto sm:right-6 sm:top-6 sm:flex sm:w-[20rem] sm:flex-col sm:gap-2">
        <div className="border border-white/10 bg-black/85">
          <button
            type="button"
            onClick={() => setBoardOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70"
          >
            <span className="truncate">
              {boardOpen
                ? `Mission board${typeof window !== 'undefined' && window.location.search.includes('demo=1') ? ' · demo' : ''}`
                : `${hud.orbit} in orbit · ${fmtDog(s?.dog_pending_amount ?? 0)} DOG`}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`inline-block size-1.5 rounded-full ${live ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
              <span className="text-white/45">{live ? 'live' : hud.stale != null ? `${hud.stale}s ago` : 'connecting'}</span>
              <span className="text-white/40">{boardOpen ? '−' : '+'}</span>
            </span>
          </button>
          {boardOpen && (
            <dl className="grid gap-2 border-t border-white/10 px-3 py-3 font-mono text-[11px]">
              <Row k="In orbit" v={`${hud.orbit} ship${hud.orbit === 1 ? '' : 's'} · ${fmtDog(s?.dog_pending_amount ?? 0)} DOG`} strong />
              <Row
                k="Next landing"
                v={
                  <>
                    any minute <span className="text-white/45">· ~10 min cadence</span>
                    <br />
                    <span className="text-white/60">
                      last block {s?.tip_height ? fmtInt.format(s.tip_height) : '…'}
                      {tipAge != null ? `, ${tipAge} min ago` : ''}
                    </span>
                  </>
                }
              />
              <Row
                k="Last DOG landing"
                v={
                  s?.last_dog_block
                    ? `block ${fmtInt.format(s.last_dog_block)} · ${s.last_dog_block_count} ship${s.last_dog_block_count === 1 ? '' : 's'}${lastDogAge != null ? ` · ${lastDogAge} min ago` : ''}`
                    : 'waiting for the first block'
                }
              />
              <Row k="Fuel, sat/vB" v={s ? `${s.fee_fast ?? '…'} fast · ${s.fee_normal ?? '…'} · ${s.fee_slow ?? '…'} slow` : '…'} />
              <Row k="Whole mempool" v={s ? `${fmtInt.format(s.tx_count)} txs waiting` : '…'} />
              <Row k="On the apron" v={`${hud.parked} landed`} />
            </dl>
          )}
        </div>
        {/* ── chat: no desktop empilha aqui embaixo do board (mesmo container flex);
            city-chat.tsx troca sozinho pra overlay fixo quase-tela-cheia abaixo do sm ── */}
        <CityChat open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>

      {/* ── a legenda da visita guiada (item 4) ───────────────────────────── */}
      {tour && (
        <div
          className="pointer-events-none absolute inset-x-4 z-20 sm:inset-x-0 sm:mx-auto sm:w-[38rem]"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="pointer-events-auto border border-white/10 bg-black/85 px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F7931A]">
                The city, in {tour.n} stops · {tour.i + 1}/{tour.n}
              </p>
              <button
                type="button"
                onClick={() => apiRef.current?.stopTour()}
                className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 hover:text-white"
              >
                Skip
              </button>
            </div>
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-white/85">{tour.text}</p>
            <div className="mt-2 h-px w-full bg-white/10">
              <div
                className="h-full bg-[#F7931A]/70 transition-[width] duration-500"
                style={{ width: `${Math.round(((tour.i + 1) / tour.n) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── follow your DOG. Nasce FECHADO em todo tamanho e abre pelo botão do
             topo. On a phone only one bottom card is up at a time: the
             picked ship takes the slot while it is open.
             ⚠️ CELULAR DEITADO: largura passa de 640 e o breakpoint sm acha que é
             desktop, mas a ALTURA é de telefone e o painel fixo engolia a tela
             (fundador fotografou). Desktop de verdade = largura E altura. ──── */}
      <div
        className={`absolute left-4 right-4 sm:left-6 sm:right-auto sm:w-[26rem] ${!followOpen || tour ? 'hidden' : hud.picked ? 'hidden [@media(min-width:640px)_and_(min-height:521px)]:block' : ''}`}
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <form onSubmit={submitFollow} className="border border-white/10 bg-black/85 p-3">
          <div className="flex items-center justify-between">
            <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">Follow your DOG</label>
            <button
              type="button"
              onClick={() => setFollowOpen(false)}
              aria-label="Close"
              className="px-1 font-mono text-[12px] leading-none text-white/45"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={followInput}
              onChange={(e) => setFollowInput(e.target.value)}
              placeholder="paste a transaction id"
              spellCheck={false}
              className="min-w-0 flex-1 border border-white/10 bg-black px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-white/30 focus:border-[#F7931A]/70 focus:outline-none"
            />
            <button type="submit" className="border border-[#F7931A]/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F7931A]">
              Find
            </button>
          </div>
          {hud.followNote && <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/60">{hud.followNote}</p>}
          <p className="mt-2 hidden font-mono text-[10px] leading-relaxed text-white/35 sm:block">
            Every ship is a DOG transaction our node sees in the mempool. Fee sets the altitude, amount sets the size, the block is the landing window.
            Double-tap anything to approach it.
          </p>
        </form>
      </div>

      {/* ── picked ship ───────────────────────────────────────────────────── */}
      {hud.picked && (
        <div className="absolute left-4 right-4 sm:left-auto sm:right-6 sm:w-[22rem]" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <div className="border border-white/10 bg-black/85 p-3 font-mono text-[11px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">
                  {hud.picked.status === 'pending' ? 'In orbit' : hud.picked.status === 'confirmed' ? 'Landed' : 'Left orbit'}
                </p>
                {/* ⚠️ O NÚMERO GRANDE É O QUE MUDOU DE MÃO. Antes aqui aparecia
                    `dog_in`, o UTXO inteiro gasto, e uma doação de 10 mil saída
                    de um UTXO de 600 mil era anunciada como 600 mil. Quando há
                    troco, ele vai embaixo, dito com todas as letras, porque
                    esconder a diferença é o que criava o engano. */}
                <p className="mt-1 text-white">
                  {fmtDog(hud.picked.flow_kind === 'self' ? hud.picked.dog_in : hud.picked.dog_net)} DOG
                </p>
                {hud.picked.flow_kind === 'self' && (
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/40">
                    back to the same wallet
                  </p>
                )}
                {hud.picked.flow_kind === 'transfer' && hud.picked.dog_change > 0 && (
                  <p className="mt-0.5 text-[10px] text-white/40">
                    + {fmtDog(hud.picked.dog_change)} change back to the sender
                  </p>
                )}
                {hud.picked.flow_kind === 'unknown' && (
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/40">
                    sender not resolved yet
                  </p>
                )}
                {/* ⚠️ A COR PRECISA SER DITA EM ALGUM LUGAR, senão ela é enigma.
                    O rastro vermelho na órbita marca dinheiro entrando na
                    cidade; aqui a caixa confirma, com a mesma cor, para quem
                    clicou não ficar adivinhando por que aquele foguete é
                    diferente dos outros. */}
                {isDonation(hud.picked) && (
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]" style={{ color: '#FF3B30' }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#FF3B30' }} aria-hidden />
                    Funding DogCity · {fmtDog(donationDog(hud.picked))} DOG
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setHud((h) => ({ ...h, picked: null }))} className="text-white/40 hover:text-white">
                ×
              </button>
            </div>
            <dl className="mt-2 grid gap-1 text-white/70">
              <Row k="tx" v={<a className="text-white underline decoration-white/20 underline-offset-2" href={`/tx/bitcoin/${hud.picked.txid}`}>{short(hud.picked.txid, 10, 8)}</a>} />
              <Row k="fee" v={hud.picked.fee_rate != null ? `${hud.picked.fee_rate} sat/vB · ${fmtInt.format(hud.picked.fee_sats ?? 0)} sats` : '…'} />
              <Row k="from" v={hud.picked.senders[0] ? <a className="underline decoration-white/20 underline-offset-2" href={`/address/bitcoin/${hud.picked.senders[0]}`}>{short(hud.picked.senders[0])}</a> : 'unknown'} />
              <Row k="to" v={hud.picked.receivers[0] ? <a className="underline decoration-white/20 underline-offset-2" href={`/address/bitcoin/${hud.picked.receivers[0].address}`}>{short(hud.picked.receivers[0].address)}</a> : 'burn'} />
              <Row
                k={hud.picked.status === 'confirmed' ? 'block' : 'seen'}
                v={hud.picked.status === 'confirmed' && hud.picked.block_height ? fmtInt.format(hud.picked.block_height) : `${minutesAgo(hud.picked.first_seen) ?? 0} min ago`}
              />
              {hud.picked.dog_burn > 0 && <Row k="burned" v={`${fmtDog(hud.picked.dog_burn)} DOG`} />}
            </dl>
          </div>
        </div>
      )}

      {/* ── erro depois de aberto (feed, por exemplo) ──────────────────────── */}
      {hud.error && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <p className="border border-white/10 bg-black/85 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">
            {hud.error}
          </p>
        </div>
      )}
      </>}
      </>}
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-white/45">{k}</dt>
      <dd className={`text-right ${strong ? 'text-[#F7931A]' : 'text-white/85'}`}>{v}</dd>
    </div>
  )
}

// ── sky ────────────────────────────────────────────────────────────────────────
function buildStars(): THREE.Points {
  const N = 4000
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    // uniform on the sphere, but only above the horizon (the ground hides the rest)
    const u = Math.random(), v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(1 - v) // 0..90°
    const r = 90000
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.cos(phi)
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    const b = 0.35 + Math.random() * 0.65
    const warm = Math.random() < 0.2
    col[i * 3] = b
    col[i * 3 + 1] = b * (warm ? 0.9 : 0.97)
    col[i * 3 + 2] = b * (warm ? 0.75 : 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const m = new THREE.PointsMaterial({ size: 180, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })
  const p = new THREE.Points(g, m)
  p.name = 'Stars'
  return p
}

function buildEarth(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'Earth'
  // ⚠️ O TAMANHO É LICENÇA POÉTICA MEDIDA, e não um número solto. Da Lua a Terra
  // tem 1,9°. Estava com 4,0°, mais que o dobro, e tamanho de lua cheia somado à
  // paralaxe era metade do efeito "satélite". Agora são 2,6°: ainda maior que a
  // verdade, porque a Terra é o assunto do céu daqui, mas dentro da ordem de
  // grandeza de um corpo distante.
  const R = 840 // 2,6° a 37 km
  const loader = new THREE.TextureLoader()
  const tex = (url: string, srgb = true) => {
    const t = loader.load(url)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshPhongMaterial({
      map: tex('/city/earth/earth_atmos_2048.jpg'),
      specularMap: tex('/city/earth/earth_specular_2048.jpg', false),
      normalMap: tex('/city/earth/earth_normal_2048.jpg', false),
      normalScale: new THREE.Vector2(0.6, 0.6),
      specular: new THREE.Color(0x333333),
      shininess: 18,
    }),
  )
  g.add(globe)
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.012, 64, 48),
    new THREE.MeshLambertMaterial({ map: tex('/city/earth/earth_clouds_1024.png'), transparent: true, opacity: 0.9, depthWrite: false }),
  )
  clouds.name = 'Clouds'
  g.add(clouds)
  // ⚠️ A ATMOSFERA É FINA, e a nossa estava com 5% do raio: 320 km de ar, que lê
  // como bola de neblina. A camada real tem uns 100 km sobre 6.371 de raio, 1,6%.
  // Fina e um pouco mais forte desenha um FIO azul no limbo, que é o que se vê
  // nas fotos de verdade.
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.016, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x6fa4ff, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }),
  )
  g.add(rim)
  g.rotation.z = 0.41 // axial tilt, for the look of it
  return g
}

function buildEarthDrawn(): THREE.Group {
  // A drawn Earth, deliberately quiet: deep ocean, muted land, thin cloud, a faint
  // blue rim. From the Moon it spans about two degrees; a 640 m ball 37 km away
  // reads the same. Seeded so it looks the same on every visit.
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const c = document.createElement('canvas')
  c.width = 512; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#123a72'
  ctx.fillRect(0, 0, 512, 256)
  ctx.fillStyle = '#4b5a3a'
  for (let i = 0; i < 18; i++) {
    ctx.beginPath()
    ctx.ellipse(rnd() * 512, 50 + rnd() * 156, 22 + rnd() * 60, 12 + rnd() * 34, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 70; i++) {
    ctx.beginPath()
    ctx.ellipse(rnd() * 512, rnd() * 256, 10 + rnd() * 50, 2 + rnd() * 5, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(0, 0, 512, 14); ctx.fillRect(0, 242, 512, 14) // ice caps
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const g = new THREE.Group()
  g.name = 'Earth'
  g.add(new THREE.Mesh(new THREE.SphereGeometry(640, 48, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })))
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(680, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x5f9cff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }),
  )
  g.add(rim)
  return g
}
