// ═══════════════════════════════════════════════════════════════════════════
// THE GEODE na cena da cidade.
//
// A arena coberta: um cume de obsidiana facetado, simétrico, com 28.240 lugares
// e piso de show de 48 x 28 m. Modelo em `blender/build_arena.py`, bacia
// calculada pela linha de visada em `scripts/bacia_arena.py`, plano em
// `arena.md`.
//
// ⚠️ A POSIÇÃO É UM MÓDULO DA TEIA, NÃO UMA COORDENADA. Regra já paga pelo
// estádio, em `estadio.ts`: peça de infra ocupa um número inteiro de módulos,
// porque os lados do módulo SÃO ruas. Coordenada escolhida a olho põe avenida
// dentro do prédio, que foi o defeito que o fundador apontou na chapa do
// estádio. Se a teia mudar, a peça acompanha sozinha.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, type Modulo } from './teia'
import type { DistanceCuller } from './perf'

/**
 * ⚠️ A TEIA NÃO É A ÚNICA MALHA VIÁRIA DA CIDADE, E FOI ISSO QUE ERROU O SÍTIO.
 *
 * A primeira escolha foi `{i:8, nr:3, j:46, ns:3}`, varrida contra a teia e
 * contra as peças do programa. O fundador viu na chapa: **a peça em cima de uma
 * via**. Medido depois, contra `cidade-malha.json`, que é onde moram as OUTRAS
 * três famílias de via:
 *
 *   · o **Anel Médio** (`AN2`, r 2.750, 26 m) passava a 4 m do centro da peça,
 *     ou seja POR CIMA dela: **-144 m de folga**;
 *   · o **bulevar BUL04** (44 m, rumo 106,875) passava a 90 m, e a peça precisa
 *     de 146.
 *
 * Nenhuma das duas aparece em `teia.ts`: bulevares, autopistas e anéis viários
 * são publicados pelo gerador em `cidade-malha.json` e desenhados por outro
 * caminho, então a máscara de parcela (`geodeParcela`) não os detém. Caber num
 * módulo da teia é NECESSÁRIO E NÃO SUFICIENTE.
 *
 * A varredura refeita cobre as três famílias mais os corpos d'água e os canais.
 * Dos 1.753 blocos aprovados, este ganha por folga:
 *
 *  · **309 m** até a via grande mais próxima (`AN3`, o Anel Exterior), contra
 *    -144 do sítio anterior;
 *  · caixa de **528 m no radial por 481 m de arco** para uma peça de 292 x 269:
 *    130 m livres no radial e 94 no arco até a rua do próprio módulo;
 *  · **mesmo anel do estádio** (r 3.294), 615 m dele: os dois seguem formando um
 *    distrito esportivo, agora sem nenhum dos dois em cima de via;
 *  · água a 1.097 m e o canal mais próximo (`CR03`) a 1.652 m de afastamento
 *    lateral.
 *
 * ⚠️ E A MESMA MEDIÇÃO REPROVOU O ESTÁDIO: `{i:11, nr:3, j:46, ns:3}` tem
 * **-60 m** contra o BUL04, ou seja o bulevar de 44 m passa por dentro dele.
 * Defeito anterior a esta peça e não corrigido aqui; a varredura que o acha está
 * em `scripts/_sitio2.ts`.
 */
export const GEODE_MOD: Modulo = { i: 11, nr: 3, j: 52, ns: 2 }

/** o envelope construído, para medir sem carregar o GLB */
export const GEODE_ENV_X = 224   // a saia de cristal, que é mais larga que o tambor
export const GEODE_ENV_Z = 201

/**
 * ⚠️ A PEÇA COBRE MAIS CHÃO QUE O PRÉDIO. O tambor tem 198 x 178, a saia
 * enterrada vai a 224 x 201 e a esplanada avança 34 m além do anel do chão, o
 * que dá 266 x 246. Os 292 x 269 declarados aqui somam ainda 13 m de margem por
 * lado para o micro-relevo. Foi por medir a cota só no PRÉDIO que a calçada do
 * estádio saiu furada.
 */
export const GEODE_PECA_X = 292   // no ARCO (tangencial), que é o eixo longo
export const GEODE_PECA_Z = 269   // no RADIAL

/**
 * A distância em que a peça some, POR PERFIL.
 *
 * ⚠️ A DISTÂNCIA SE MEDE DE ONDE A PEÇA É VISTA. A conta, igual à do estádio:
 *
 *     THE GEODE está a 3.294 m do centro (era 2.754 antes da correção de sítio)
 *     o visitante fica na praça, raio até 1.024 m
 *     logo ele a vê de 2.270 a 4.318 m
 *
 * O corte tem de ser maior que o PIOR caso, não que a média: foi cortando pela
 * média que o estádio sumiu do celular em 06/09. 4.700 cobre os 4.318 com 9% de
 * folga. ⚠️ Este número acompanha o SÍTIO: mudou o módulo, refaça a conta.
 */
export function geodeCull(tier: 'mobile' | 'desktop'): number {
  return tier === 'mobile' ? 4700 : 7000
}

/** Centro e giro do bloco, direto da teia. */
export function geodeSitio(): { x: number; z: number; rumoDeg: number } {
  const c = caixaDoModulo(GEODE_MOD)
  const am = (c.a0 + c.a1) / 2
  return {
    x: Math.sin(am) * c.rm,
    z: -Math.cos(am) * c.rm,
    rumoDeg: (THREE.MathUtils.radToDeg(am) + 360) % 360,
  }
}

/** O polígono do bloco, que vira máscara de via: a rua para na divisa dele. */
export function geodeParcela(): { poly: [number, number][] } {
  return { poly: polyDoModulo(GEODE_MOD) }
}

/**
 * ⚠️ NO CELULAR O INTERIOR SAI INTEIRO, e é a maior economia da peça.
 *
 * A arena é coberta: de fora, a arquibancada só aparece pelas quatro entradas,
 * que somam 4% do perímetro e ficam a 1,7 km de quem olha. O interior (bacia de
 * 46 fileiras, escadas, piso, grid de show) são **27.976 dos 31.348 triângulos**,
 * ou seja 89% da peça para um detalhe que o telefone nunca vai resolver.
 *
 * Por isso `build_arena.py` emite dois objetos, `GEODE_CASCA` e
 * `GEODE_INTERIOR`. No celular o segundo é removido e descartado: sobram 3.372
 * triângulos, e a silhueta, o letreiro e a lapidação continuam idênticos.
 *
 * ⚠️ E KTX2 NÃO SE APLICA AQUI. O espelho de `scripts/city/ktx2.mjs` existe para
 * GLB com IMAGEM embutida, que é o que estourava a memória de textura do
 * telefone. `dog-geode.glb` tem 182 KB, **zero imagens e zero texturas**, só cor
 * de material. Se um dia a pele ganhar textura, ela entra por lá.
 */
export function podarGeode(root: THREE.Object3D, tier: 'mobile' | 'desktop'): number {
  // ⚠️ A PODA FOI DESLIGADA EM 08/09, POR DECISÃO DO FUNDADOR ("vamos pagar").
  //
  // Ela removia o `GEODE_INTERIOR` INTEIRO no celular, e isso era defeito de
  // integração desde que o tour da live ganhou paradas de interior: as três
  // (`geodedentro`, `estadiodentro`, `atletismodentro`) rodam no celular, ou
  // seja a transmissão voava para dentro da arena e mostrava uma CASCA VAZIA no
  // telefone, sem quadra, sem assento e sem telão. E a maior parte de quem
  // assiste a live no X está no telefone.
  //
  // Piorou quando outro agente customizou a quadra em 08/09: o modelo novo tem
  // `AR_QUADRA`, `AR_LINHA`, `AR_ASSENTO` (laranja DOG), `AR_CAMAROTE`, `AR_ACO`
  // e `AR_TELA`, ou seja o interior virou justamente a peça a mostrar, e o
  // celular era o único que não a via.
  //
  // ⚠️ O PREÇO ESTÁ MEDIDO E É PEQUENO NA ESCALA DA CENA: 29.334 triângulos
  // contra 3.372 da casca, num GLB de 184 KB inteiro. A cena de perto já roda
  // com mais de 5 M de triângulos, então o interior é **0,6%** disso. O que
  // custava caro nesta peça nunca foi o interior: era o cristal do parque.
  //
  // A função fica, com o corte desarmado, porque a poda por tier é a ferramenta
  // certa para o dia em que o interior crescer. Quem religar precisa tirar as
  // três paradas de interior do roteiro do celular no mesmo commit.
  if (tier !== 'mobile') return 0
  return 0
  let tirados = 0
  const alvos: THREE.Object3D[] = []
  root.traverse((o) => { if (o.name.startsWith('GEODE_INTERIOR')) alvos.push(o) })
  for (const o of alvos) {
    o.traverse((n) => {
      const mesh = n as THREE.Mesh
      if (mesh.isMesh) {
        tirados += (mesh.geometry.index?.count ?? 0) / 3
        mesh.geometry.dispose()
      }
    })
    o.removeFromParent()
  }
  return Math.round(tirados)
}

/**
 * Assenta o GLB no sítio, alinhado com as ruas do entorno.
 *
 * ⚠️ O GIRO É `-rumo`, e a conta é a mesma de `estadio.ts:96`: em three um
 * objeto com `rotation.y = φ` manda o próprio X local para `(cos φ, 0, −sin φ)`,
 * e a tangente no rumo `a` é `(cos a, sin a)`, então `φ = −a`. Com isso o eixo
 * longo da peça (198 m) fica paralelo à rua de anel.
 *
 * ⚠️ E A COTA É A MÁXIMA MEDIDA EM GRADE SOBRE A PEÇA INTEIRA, não a do centro
 * nem a dos cantos. Cinco pontos deixam passar o cume que cai no meio da
 * esplanada, e assentar pela média deixa o canto alto furando o piso: foi assim
 * que a calçada do estádio saiu com falha. A saia de cristal desce 5,5 m abaixo
 * do zero da peça e absorve o que sobrar.
 */
export function assentarGeode(
  root: THREE.Object3D,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  const s = geodeSitio()
  const rad = THREE.MathUtils.degToRad(s.rumoDeg)
  const c = Math.cos(-rad), sn = Math.sin(-rad)
  const hx = GEODE_PECA_X / 2, hz = GEODE_PECA_Z / 2
  let alto = -Infinity
  for (let dx = -hx; dx <= hx; dx += 14) {
    for (let dz = -hz; dz <= hz; dz += 14) {
      // ⚠️ A MATRIZ TEM DE SER A DO THREE, E ATÉ 07/09 ESTA NÃO ERA. Um objeto
      // com `rotation.y = φ` manda o próprio X local para `(cos φ, 0, −sin φ)`,
      // ou seja `(wx, wz) = (c·dx + sn·dz, −sn·dx + c·dz)` com `c, sn` de φ. O
      // que estava aqui, `(c·dx − sn·dz, sn·dx + c·dz)`, é a rotação INVERSA:
      // sondava um retângulo girado 2φ fora do lugar. Ficou invisível enquanto o
      // terreno sob a peça era liso, e apareceu no dia em que o campus criou um
      // talude ao lado: a sonda pegava a subida do terraço vizinho e o $DOG
      // ARENA pousava 0,61 m ACIMA do próprio pódio, flutuando. A conta certa é
      // a mesma que `atletismo.ts` já usava e documentava.
      const x = s.x + c * dx + sn * dz
      const z = s.z - sn * dx + c * dz
      const y = alturaEm(x, z)
      if (y > alto) alto = y
    }
  }
  alto += 0.4
  root.name = 'THE_GEODE'
  root.position.set(s.x, alto, s.z)
  root.rotation.y = -rad
  return root
}

/**
 * O TELÃO DO PLACAR, acendido com a marca.
 *
 * ⚠️ PEDIDO DO FUNDADOR EM 08/09: *"a câmera para e fica mostrando a quadra (…)
 * e mostrando o telão em branco no centro do take. Colocar ao menos um $DOG
 * laranja no telão preto."*
 *
 * ⚠️ O GANCHO É O MATERIAL, E NÃO O NOME DO NÓ, E ISSO FOI CONSERTO NO MESMO
 * DIA. A primeira versão procurava a malha `GEODE_INTERIOR_10`, que era como o
 * `dog-geode.glb` antigo publicava o telão. Horas depois outro agente REGEROU o
 * modelo com a quadra customizada, e o GLB novo tem **dois nós só**
 * (`GEODE_CASCA` e `GEODE_INTERIOR`, 8 e 11 primitivas): `GEODE_INTERIOR_10`
 * deixou de existir e a função virou código morto sem ninguém notar, porque ela
 * falha em silêncio devolvendo `false`.
 *
 * Nome de MATERIAL sobrevive à fusão de malha; nome de nó não. O telão é o
 * material **`AR_TELA`** (índice 15 dos 16), e ele continua sendo `AR_TELA` em
 * qualquer reexportação que mantenha a nomenclatura do `.blend`. É por isso que
 * o gancho mudou de eixo.
 *
 * ⚠️ E ELE NÃO ESTÁ MAIS BRANCO: o modelo novo já entrega o telão com emissivo
 * AZUL (0,297 / 0,534 / 0,961). O defeito deixou de ser "apagado" e passou a ser
 * "cor errada": azul frio não é cor desta casa, e num painel que domina o centro
 * do quadro ele tinge a bacia inteira. Fundo `#0A0B0D`, glifo `#E8660D`, que é a
 * cor do DADO (a mesma da Sphere, e nunca o lava `#F56E0F`).
 *
 * ⚠️ UMA TEXTURA, UM MATERIAL, ZERO PROGRAMA NOVO. Canvas 512x256 e
 * `MeshBasicMaterial`: telão não recebe luz, ele EMITE, e básico fica fora do
 * laço de iluminação da cena, então não soma custo por luz.
 */
export function acenderTelaoGeode(root: THREE.Object3D): number {
  const cv = document.createElement('canvas')
  cv.width = 512; cv.height = 256
  const g = cv.getContext('2d')!
  g.fillStyle = '#0A0B0D'
  g.fillRect(0, 0, 512, 256)
  // ⚠️ A MOLDURA ESCURA NÃO É ENFEITE: sem ela o glifo encosta na borda e o
  // painel lê como adesivo colado, não como tela dentro de uma carcaça.
  g.strokeStyle = '#1A1D24'; g.lineWidth = 10
  g.strokeRect(5, 5, 502, 246)
  g.fillStyle = '#E8660D'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 132px "JetBrains Mono", ui-monospace, monospace'
  g.fillText('$DOG', 256, 132)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  // ⚠️ UM MATERIAL PARA TODAS AS FACES DO TELÃO. Ele aparece em mais de uma
  // primitiva (a caixa tem quatro lados), e criar um material por face pagaria
  // chamada e programa por lado sem imagem nenhuma a mais.
  const novo = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  let trocados = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    let mexeu = false
    const saida = mats.map((mat) => {
      if (mat && mat.name === 'AR_TELA') { mexeu = true; trocados++; mat.dispose(); return novo }
      return mat
    })
    if (!mexeu) return
    m.material = Array.isArray(m.material) ? saida : saida[0]
    uvPlanar(m.geometry)
  })
  if (!trocados) tex.dispose()
  return trocados
}

/**
 * ⚠️ O TELÃO NÃO TEM UV, E ISSO DEIXOU A TELA PRETA EM PRODUÇÃO. Conferido no
 * GLB: a primitiva do `AR_TELA` tem só `POSITION` e `NORMAL`, sem `TEXCOORD_0`.
 * Sem UV, `map` amostra sempre o texel (0,0), que no canvas do placar é o fundo.
 * O fundador viu na live: *"o telão está todo preto"*. Defeito meu, e do tipo que
 * não aparece em typecheck nem em build: só olhando.
 *
 * O conserto é projeção PLANAR pelos dois maiores eixos da caixa da peça. O
 * telão é uma caixa larga e baixa, então os dois maiores eixos são justamente a
 * face que se olha; as faces finas das bordas recebem a mesma projeção e ficam
 * com o pixel esticado, que a essa distância não se vê. Gerar UV de verdade
 * pediria reexportar o modelo, e o modelo é de outra frente.
 */
function uvPlanar(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position')
  if (!pos) return
  g.computeBoundingBox()
  const bb = g.boundingBox!
  const tam = new THREE.Vector3(); bb.getSize(tam)
  // os dois maiores eixos da caixa, que é onde a imagem tem de ficar direita
  const eixos = [0, 1, 2].sort((a, b) => tam.getComponent(b) - tam.getComponent(a))
  const [u, v] = [eixos[0], eixos[1]]
  const du = tam.getComponent(u) || 1, dv = tam.getComponent(v) || 1
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getComponent(i, u) - bb.min.getComponent(u)) / du
    // v invertido: textura do canvas cresce para BAIXO e a UV do three para cima
    uv[i * 2 + 1] = 1 - (pos.getComponent(i, v) - bb.min.getComponent(v)) / dv
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/**
 * A LUZ DE DENTRO DA ARENA.
 *
 * ⚠️ EMISSIVO BRILHA, NÃO ILUMINA, e é essa confusão que deixou o interior no
 * escuro. O fundador viu na live: *"tá faltando luz dentro do the geode, uma
 * escuridão tremenda"*. O modelo novo tem cinco materiais emissivos (`AR_LUZ` com
 * força 9, `AR_AMBAR` 5,5, `AR_LETRA` 7,3), e em three.js emissivo acende o
 * PRÓPRIO material e não joga um fóton em nada. Sem uma luz de verdade a quadra
 * fica preta, e ela é preta por desenho: `AR_QUADRA` tem cor base 0,0075, ou
 * seja o material mais escuro do modelo depois da obsidiana.
 *
 * ⚠️ E AS LUZES SÃO GATILHADAS POR DISTÂNCIA, pela mesma razão que a caverna do
 * Leonidas gatilha as dela: a contagem de luzes entra na chave de cache de
 * programa do three e custa em TODO fragmento iluminado da cena, não só aqui.
 * Elas entram no `DistanceCuller`, que zera `visible` além do raio; o
 * `projectObject` do renderizador pula subárvore invisível, então a luz some do
 * `lightsArray` e para de custar de verdade, não só de aparecer.
 *
 * Três pontuais, warm white de `AR_LUZ` (1 / 0,896 / 0,745): duas altas nas
 * pontas do eixo longo e uma no centro, todas acima do plano da quadra.
 */
export function acenderGeode(
  root: THREE.Object3D,
  culler?: DistanceCuller,
  ancora?: THREE.Vector3,
): THREE.PointLight[] {
  let alvo: THREE.Object3D | null = null
  root.traverse((o) => { if (o.name === 'GEODE_INTERIOR') alvo = o })
  const pai = (alvo ?? root) as THREE.Object3D
  const caixa = new THREE.Box3().setFromObject(pai)
  const c = caixa.getCenter(new THREE.Vector3())
  const t = caixa.getSize(new THREE.Vector3())
  // o eixo longo no plano, para espalhar as duas das pontas
  const longo = t.x >= t.z ? 'x' : 'z'
  const meio = (longo === 'x' ? t.x : t.z) * 0.28
  const alturaLuz = caixa.min.y + t.y * 0.72
  const COR = 0xffe4be
  const feitas: THREE.PointLight[] = []
  const alcance = Math.max(t.x, t.z) * 1.1
  for (const dz of [-meio, 0, meio]) {
    const l = new THREE.PointLight(COR, dz === 0 ? 3.2 : 2.4, alcance, 1.6)
    l.position.set(longo === 'x' ? c.x + dz : c.x, alturaLuz, longo === 'z' ? c.z + dz : c.z)
    pai.add(l)
    feitas.push(l)
  }
  // ⚠️ O RAIO DO GATILHO É A PRÓPRIA PEÇA COM FOLGA: elas só interessam a quem
  // está dentro ou na porta, e de fora a casca é opaca.
  if (culler && ancora) for (const l of feitas) culler.add(l, Math.max(t.x, t.z) * 1.6, ancora)
  return feitas
}
