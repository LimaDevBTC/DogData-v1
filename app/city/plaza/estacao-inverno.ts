// ═══════════════════════════════════════════════════════════════════════════
// A ESTAÇÃO DE ESQUI: a infraestrutura HUMANA do parque de inverno, não o
// terreno nem a pista (isso é `inverno.ts`, `alpino.ts`, `terrain.ts`, dos
// quais este arquivo NÃO importa nada em tempo de execução, só leu o código
// pra tirar número). O pedido do fundador: "onde o visitante chega, onde ele
// fica parado, e o que dá escala de estação de esqui de verdade em vez de
// montanha vazia com uma fita colorida."
//
// Quatro peças: (1) a vila-base (chalé, bilheteria, placas de pista), (2)
// segurança e limite de pista (cerca, rede de contenção), (3) maquinário
// PARADO (canhão de neve, groomer), sem animação — pedido explícito do
// fundador: "por enquanto pensamos no projeto dele, na aparência... não é
// jogo ainda" — e (4) cabines do teleférico, posições fixas ao longo do
// cabo, também sem animação.
//
// ── O CONTRATO, E POR QUE ELE É ASSÍNCRONO ──────────────────────────────────
// `buildEstacaoInverno(opts): Promise<{ group, triangulos, dispose }>` é o
// mesmo formato de `Chalet`/`Inverno` (grupo + contagem + descarte), mas
// como `buildInverno` ao lado, ASSÍNCRONO: cinco `.glb` são carregados aqui
// dentro (`GLTFLoader.load` é Promise). Quem chamava um builder síncrono
// direto precisa de `await` ou `.then()`. Cada peça é ADITIVA e resiliente:
// se um `.glb` falhar, o console avisa e o resto da estação sobe sem ela
// (mesma defesa em profundidade que `inverno.ts` usa pra floresta/rochas).
//
// ── AS OPÇÕES QUE ESTE MÓDULO PRECISA (leia antes de me chamar) ────────────
//   heightAt(x, z)   — obrigatório. A mesma `terrain.superficieAt` que o
//                      resto da cena usa: tudo aqui encosta no chão de
//                      verdade, nada é achatado numa cota fixa.
//   gltf             — opcional, MAS sem ele a estação sobe vazia (só um
//                      `console.warn`, nunca quebra): todas as peças de
//                      catálogo (chalé, bilheteria, cerca, snowcat) são GLB.
//                      Precisa ser o loader com DRACOLoader já registrado
//                      (os `.glb` desta praça saem em Draco).
//   sombra           — opcional (default true), mesmo campo de sempre.
//   vilaBase         — { r, az } em coordenadas de rumo (mesma convenção de
//                      `inverno.ts`: `pontoEmRumo`, ver abaixo). É o pé da
//                      montanha onde a pista chega no chão plano do pódio.
//                      DEFAULT { r: 6990, az: 265 }, que é onde `inverno.ts`
//                      hoje (lido em 03/09/2026) planta a estação de
//                      teleférico real (`ski-lift-station.glb`) — mas
//                      aquele número é PRIVADO daquele módulo (não
//                      exportado) e pode mudar sem aviso aqui: se outra
//                      frente mexer na vila-base, PASSE o valor novo em vez
//                      de confiar no default.
//   azimuteMacico    — { az0, az1 } em graus, a janela angular da crista
//                      (mesma convenção de `AZ0`/`AZ1` de `inverno.ts`).
//                      DEFAULT { az0: 248, az1: 288 }, lido de lá em
//                      03/09/2026, mesma ressalva acima.
//   cabos            — array de { rBase, azBase, rTopo, azTopo, nCabines? },
//                      um por vão de teleférico, pra popular com cabines
//                      penduradas (Tarefa 4). DEFAULT reproduz os DOIS vãos
//                      que `inverno.ts` desenha hoje via `construirTeleferico`
//                      (lido em 03/09/2026, também não exportado):
//                        principal:  (7000,268) → (8280,268), 10 cabines
//                        parque:     (6950,273) → (8220,261),  6 cabines
//                      Isto é uma FOTOGRAFIA da forma do cabo, não o cabo de
//                      verdade (a curva real mora dentro de `inverno.ts` e
//                      não é exportada): a altura de cada cabine é uma
//                      aproximação de arrio (ver `alturaCaboAprox`), NÃO É
//                      MEDIDA no cabo real. Se os dois módulos divergirem
//                      visualmente, o conserto é `inverno.ts` exportar os
//                      vãos e este arquivo importar, não uma segunda
//                      adivinhação daqui.
//   trilhas          — opcional. Estruturalmente igual ao `Pista[]` que
//                      `inverno.ts` já EXPORTA (`export const PISTAS`): quem
//                      montar a cena pode importar de lá e passar direto
//                      aqui, sem este arquivo precisar importar `inverno.ts`
//                      pra valer (tipagem estrutural, não nominal). Usado
//                      pra (a) cercar e sinalizar as bordas das pistas
//                      'preta'/'vermelha' de verdade e (b) nomear a placa da
//                      vila com a lista real. SEM `trilhas`: a placa cai pro
//                      snapshot de nomes abaixo (lido de `inverno.ts` em
//                      03/09/2026) e cerca/rede/bandeira caem pra um trecho
//                      simbólico curto perto da vila-base, não ao longo da
//                      pista (documentado, não escondido).
//   culler           — opcional, mesmo campo de `InvernoOpts.culler`
//                      (`DistanceCuller` de `./perf`). Se vier, este módulo
//                      SE REGISTRA sozinho (mesmo padrão de `inverno.ts`:
//                      `o.culler?.add(group, raio, centro)`), não fica só
//                      na prosa do relatório.
//   raioDetalhe      — opcional, metros, default 6000. Ver a nota de
//                      orçamento no fim do arquivo pra por que este número.
//
// ── PROIBIÇÕES DESTA FRENTE, TODAS RESPEITADAS AQUI ─────────────────────────
// Nenhuma animação de verdade (cabines paradas, canhão parado, groomer
// parado: pedido explícito do fundador). Nenhum travessão neste arquivo.
// Não toca em inverno.ts, alpino.ts, terrain.ts, plaza-scene.tsx, obra.ts,
// park.ts, materiais.ts, vias.ts, decalques.ts, sombra.ts, terreno-fino.ts,
// fusao.ts, dome.ts, arborizacao.ts, props-table.ts, sf-assets.ts,
// especies.ts (só leu). Licença CC0/CC-BY sempre; as linhas de crédito exatas
// estão no relatório final, pra colar em `sf-assets.ts`.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { DistanceCuller } from './perf'

// ⚠️ CONSERTO DE 03/09, ACHADO AO VIVO NO MESMO DIA: `gltf.load()` para os GLB
// convertidos hoje (chalé, bilheteria, snowcat, cerca) pode disparar e NUNCA
// voltar (nem sucesso, nem erro), o decodificador Draco embutido trava
// silenciosamente. Sem limite de tempo, `buildEstacaoInverno` nunca resolve, e
// como quem chama isto (`inverno.ts`) espera essa Promise antes de trocar a
// caixa placeholder, a estação inteira travaria pra sempre. Mesma regra em
// `inverno.ts`: recurso externo nunca trava a cena, estourar o teto é falha
// como qualquer outra.
function comLimiteDeTempo<T>(p: Promise<T>, ms: number, rotulo: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_res, rej) => setTimeout(
      () => rej(new Error(`${rotulo}: sem resposta em ${ms} ms (decodificador travado ou rede lenta)`)),
      ms,
    )),
  ])
}

// ── tipos ────────────────────────────────────────────────────────────────
export type DificuldadePista = 'verde' | 'azul' | 'vermelha' | 'preta' | 'parque'

/** Estruturalmente igual ao `Pista` de `inverno.ts`: quem tiver um `Pista[]`
 *  de verdade (o `PISTAS` exportado de lá) pode passar direto, sem import
 *  cruzado. Só os campos que este módulo usa. */
export interface TrilhaLike {
  nome: string
  dificuldade: DificuldadePista
  largura: number
  pontos: { r: number; az: number }[]
}

export interface CaboOpts {
  rBase: number; azBase: number
  rTopo: number; azTopo: number
  /** quantas cabines penduradas neste vão. Default 8. */
  nCabines?: number
}

export interface EstacaoInvernoOpts {
  heightAt: (x: number, z: number) => number
  gltf?: GLTFLoader
  sombra?: boolean
  vilaBase?: { r: number; az: number }
  azimuteMacico?: { az0: number; az1: number }
  cabos?: CaboOpts[]
  trilhas?: TrilhaLike[]
  culler?: DistanceCuller
  raioDetalhe?: number
}

export interface EstacaoInverno {
  group: THREE.Group
  triangulos: number
  dispose(): void
}

// ── geometria de rumo, cópia de `inverno.ts` (não exportada de lá) ────────
function pontoEmRumo(r: number, azGraus: number): [number, number] {
  const a = (azGraus * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

// ── a paleta, cópia EXATA de `CORES` em `inverno.ts` (não exportada de lá,
// lida em 03/09/2026). NÃO EXISTE código/RAL/pantone oficial e único pra cor
// de dificuldade de pista (WebSearch em 03/09/2026, várias buscas, nenhuma
// fonte cita um número: INTERSPORT, SnowTrex, FIS e outras só confirmam a
// convenção VERBAL verde<azul<vermelha<preta, que é a mesma taxonomia que
// `Dificuldade` já usa). Diante disso a escolha certa não é inventar uma
// segunda paleta: é bater com a fita que `inverno.ts` já pinta na pista de
// verdade, pra placa e pista concordarem. 'parque' (terrenos freestyle) não
// é uma cor de dificuldade FIS, é convenção de sinalização de resort
// (laranja), e `inverno.ts` já a usa pelo mesmo motivo. */
const CORES: Record<DificuldadePista, string> = {
  verde: '#3DBB4C',
  azul: '#1E6FD9',
  vermelha: '#D92B2B',
  preta: '#202024',
  parque: '#E8660D',
}

/** Snapshot dos nomes reais das pistas, lido de `ESPECIFICACOES` em
 *  `inverno.ts` em 03/09/2026 (a lista exata pedida no briefing: Descida do
 *  Mar da Tranquilidade / Super-G / Gigante / Slalom / Boardercross /
 *  Slopestyle / a de acesso verde — ACHEI todos os sete nomes exatos, não
 *  precisei do fallback genérico por dificuldade). Usado só como TEXTO da
 *  placa quando `trilhas` não vem; quando vem, a placa lista os nomes reais
 *  de `trilhas` em vez deste snapshot. */
const PISTAS_SNAPSHOT: { nome: string; dificuldade: DificuldadePista }[] = [
  { nome: 'Descida do Mar da Tranquilidade', dificuldade: 'preta' },
  { nome: 'Super-G Regolito', dificuldade: 'preta' },
  { nome: 'Slalom Gigante Cratera Rasa', dificuldade: 'vermelha' },
  { nome: 'Slalom Poeira Fina', dificuldade: 'azul' },
  { nome: 'Boardercross Baixa Gravidade', dificuldade: 'parque' },
  { nome: 'Slopestyle Um Sexto', dificuldade: 'parque' },
  { nome: 'Pista Verde de Acesso', dificuldade: 'verde' },
]

// ── merge local de geometria, mesmo princípio de `merge()` em
// `mobiliario-urbano.ts` (position + normal + index, sem UV: as peças
// procedurais daqui usam cor de vértice, não textura), com UMA cor sólida
// por sub-geometria de entrada — é o que deixa canhão, cabine, rede e placa
// virarem UM material cada, vertexColors, em vez de um por peça. ─────────
function mergeColorido(partes: { geo: THREE.BufferGeometry; cor: THREE.Color }[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], ind: number[] = []
  for (const { geo, cor } of partes) {
    const base = pos.length / 3
    const p = geo.getAttribute('position') as THREE.BufferAttribute
    const n = geo.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
      col.push(cor.r, cor.g, cor.b)
    }
    const ix = geo.getIndex()
    if (ix) for (let i = 0; i < ix.count; i++) ind.push(base + ix.getX(i))
    else for (let i = 0; i < p.count; i++) ind.push(base + i)
    geo.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  out.setIndex(ind)
  return out
}

function contarTris(g: THREE.BufferGeometry): number {
  return g.index ? g.index.count / 3 : g.attributes.position.count / 3
}

// ── texto em canvas, mesmo princípio de `textTexture` em `monuments.ts`
// (não exportada de lá, reescrita aqui): fonte monoespaçada, encolhe antes
// de cortar, resolução alta o bastante pra ficar legível de perto (a régua
// desta casa pra letreiro real, não textura borrada). ─────────────────────
function textTexture(linhas: { texto: string; cor: string; tamanho: number; y: number }[], w = 1024, h = 640): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#0c0c0f'
  ctx.fillRect(0, 0, w, h)
  for (const l of linhas) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const setFonte = (px: number) => { ctx.font = `600 ${px}px "JetBrains Mono", "DM Mono", ui-monospace, monospace` }
    setFonte(l.tamanho)
    const xTexto = w * 0.16
    const room = w * 0.8
    const raw = ctx.measureText(l.texto).width
    if (raw > room) setFonte(Math.max(l.tamanho * 0.55, l.tamanho * (room / raw)))
    // a pastilha de cor da dificuldade, à esquerda do nome
    ctx.fillStyle = l.cor
    ctx.fillRect(w * 0.05, l.y - l.tamanho * 0.32, w * 0.07, l.tamanho * 0.64)
    ctx.fillStyle = '#EDE7DA'
    ctx.fillText(l.texto, xTexto, l.y)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// ── ORÇAMENTO PROCEDURAL, tris exatos (verificados em node com o mesmo
// three.js do repo, não estimados): Box=12, CylinderGeometry(...,8)=32,
// ConeGeometry(...,8)=24, CylinderGeometry(...,6)=24, ConeGeometry(...,4)=12.

/** o canhão de neve, peça única e parada. Busca no acervo (ver relatório: 7
 *  consultas, todas vazias de verdade) não achou NENHUM canhão de neve
 *  real; modelado por código, como a regra manda quando a busca é vazia.
 *  144 tris (12+32+32+32+24+12), um material, uma malha. */
function construirCanhaoDeNeve(): THREE.BufferGeometry {
  const metal = new THREE.Color('#7A7E86')
  const escuro = new THREE.Color('#2B2C31')
  const skid = new THREE.BoxGeometry(0.5, 0.12, 1.0); skid.translate(0, 0.06, 0)
  const mastro = new THREE.CylinderGeometry(0.09, 0.09, 1.7, 8); mastro.translate(0, 0.12 + 1.7 / 2, 0)
  const tanque = new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8)
  tanque.rotateZ(Math.PI / 2)
  tanque.translate(0.34, 1.05, 0)
  const anguloCano = (32 * Math.PI) / 180
  const cano = new THREE.CylinderGeometry(0.24, 0.2, 1.35, 8)
  cano.rotateX(Math.PI / 2 - anguloCano)
  cano.translate(0, 1.62, 0.55)
  const bocal = new THREE.ConeGeometry(0.24, 0.32, 8)
  bocal.rotateX(Math.PI / 2 - anguloCano)
  bocal.translate(0, 1.62 + Math.sin(anguloCano) * (1.35 / 2 + 0.16), 0.55 + Math.cos(anguloCano) * (1.35 / 2 + 0.16))
  const forquilha = new THREE.BoxGeometry(0.3, 0.28, 0.12); forquilha.translate(0, 1.62 - 0.1, 0.1)
  return mergeColorido([
    { geo: skid, cor: escuro },
    { geo: mastro, cor: metal },
    { geo: tanque, cor: metal },
    { geo: cano, cor: escuro },
    { geo: bocal, cor: escuro },
    { geo: forquilha, cor: metal },
  ])
}

/** uma cabine de teleférico fechada, pra popular o cabo (Tarefa 4, ver a
 *  decisão longa no relatório: nem `1379-chairlift` nem `Chair Lift`
 *  do acervo tinham uma cabine isolável, os dois são cenas inteiras
 *  fundidas). 72 tris (12+12+24+12+12), um material, uma malha, repetida
 *  via InstancedMesh. */
function construirCabine(): THREE.BufferGeometry {
  const corpo = new THREE.Color('#B23A2E')
  const teto = new THREE.Color('#26262B')
  const metal = new THREE.Color('#4A4A50')
  const caixa = new THREE.BoxGeometry(1.1, 1.3, 1.0); caixa.translate(0, 0.65, 0)
  const capota = new THREE.ConeGeometry(0.8, 0.4, 4); capota.rotateY(Math.PI / 4); capota.translate(0, 1.3 + 0.2, 0)
  const braco = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6); braco.translate(0, 1.3 + 0.4 + 0.45, 0)
  const garra = new THREE.BoxGeometry(0.18, 0.14, 0.3); garra.translate(0, 1.3 + 0.4 + 0.9 + 0.07, 0)
  const patim = new THREE.BoxGeometry(0.9, 0.05, 0.15); patim.translate(0, 0.025, 0)
  return mergeColorido([
    { geo: caixa, cor: corpo },
    { geo: capota, cor: teto },
    { geo: braco, cor: metal },
    { geo: garra, cor: metal },
    { geo: patim, cor: metal },
  ])
}

/** um trecho de rede de contenção (postes + tela), pra onde a pista termina
 *  perto de rocha exposta. Busca no acervo não achou "safety net ski" nem
 *  "avalanche fence" (0 resultados, ver relatório); modelado por código.
 *  74 tris (2 postes de 24 + 2 amarras de 12 + tela de 2), postes e
 *  amarração no vertexColors, tela em
 *  material próprio (precisa de transparência, não entra no merge). */
function construirRedeContencao(): { postes: THREE.BufferGeometry; tela: THREE.BufferGeometry } {
  const metal = new THREE.Color('#5A5A5E')
  const postoA = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6); postoA.translate(-3, 1.0, 0)
  const postoB = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6); postoB.translate(3, 1.0, 0)
  const amarraTopo = new THREE.BoxGeometry(6.1, 0.06, 0.06); amarraTopo.translate(0, 1.85, 0)
  const amarraBase = new THREE.BoxGeometry(6.1, 0.06, 0.06); amarraBase.translate(0, 0.25, 0)
  const postes = mergeColorido([
    { geo: postoA, cor: metal }, { geo: postoB, cor: metal },
    { geo: amarraTopo, cor: metal }, { geo: amarraBase, cor: metal },
  ])
  const tela = new THREE.PlaneGeometry(6, 1.6)
  tela.translate(0, 1.05, 0)
  return { postes, tela }
}

/** poste + bandeirola de sinalização, InstancedMesh com `instanceColor` pra
 *  variar a cor por dificuldade num material só. 25 tris (poste 24 + a
 *  bandeirola, 1 triângulo cru). */
function construirBandeira(): THREE.BufferGeometry {
  const poste = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6)
  poste.translate(0, 0.9, 0)
  const bandeirolaPos = new Float32Array([
    0, 1.75, 0, 0, 1.5, 0, 0.55, 1.68, 0,
  ])
  const bandeirola = new THREE.BufferGeometry()
  bandeirola.setAttribute('position', new THREE.Float32BufferAttribute(bandeirolaPos, 3))
  bandeirola.computeVertexNormals()
  return mergeColorido([
    { geo: poste, cor: new THREE.Color('#8A8A8A') },
    { geo: bandeirola, cor: new THREE.Color('#FFFFFF') },
  ])
}

/** o poste + travessa da placa (vertexColors), mais a chapa com o texto
 *  (material próprio, textura). 46 tris no total (32+12 do poste/travessa,
 *  2 da chapa), dois materiais. */
function construirSuporteDePlaca(): THREE.BufferGeometry {
  const metal = new THREE.Color('#3C3C40')
  const poste = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8); poste.translate(0, 1.3, 0)
  const travessa = new THREE.BoxGeometry(0.9, 0.06, 0.06); travessa.translate(0, 2.55, 0.02)
  return mergeColorido([{ geo: poste, cor: metal }, { geo: travessa, cor: metal }])
}

// ── carregamento de um GLB único (chalé, bilheteria, snowcat): mesmo
// padrão defensivo de `inverno.ts` (Box3 pra achar o pé real do modelo,
// nunca supor que o exportador já deixou y=0 no chão; try/catch, aviso no
// console, resto da estação sobe do mesmo jeito se este pedaço falhar). ──
async function carregarPecaUnica(
  gltf: GLTFLoader, url: string, x: number, z: number, azGraus: number, y: number, sombra: boolean,
): Promise<{ obj: THREE.Object3D; triangulos: number } | null> {
  try {
    const cena = await comLimiteDeTempo(
      new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej)),
      8000, `[estacao-inverno] ${url}`,
    )
    const caixa = new THREE.Box3().setFromObject(cena)
    cena.position.set(x - (caixa.min.x + caixa.max.x) / 2, y - caixa.min.y, z - (caixa.min.z + caixa.max.z) / 2)
    cena.rotation.y = (azGraus * Math.PI) / 180
    let tris = 0
    cena.traverse((k) => {
      const mesh = k as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = sombra
      mesh.receiveShadow = true
      tris += contarTris(mesh.geometry)
    })
    return { obj: cena, triangulos: tris }
  } catch (e) {
    console.error(`[estacao-inverno] ${url} NÃO CARREGOU`, e)
    return null
  }
}

/** extrai a GEOMETRIA (primeira malha encontrada) e o MATERIAL de um GLB,
 *  pra virar InstancedMesh (a cerca). Mesma ideia de `carregarPecas` em
 *  `mobiliario-urbano.ts`, mas pra um `.glb` de peça única, não um atlas de
 *  nós nomeados. */
async function carregarGeometriaEMaterial(gltf: GLTFLoader, url: string): Promise<{ geo: THREE.BufferGeometry; mat: THREE.Material } | null> {
  try {
    const cena = await comLimiteDeTempo(
      new Promise<THREE.Group>((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej)),
      8000, `[estacao-inverno] ${url}`,
    )
    let achado: THREE.Mesh | null = null
    cena.traverse((k) => { if (!achado && (k as THREE.Mesh).isMesh) achado = k as THREE.Mesh })
    if (!achado) return null
    const mesh = achado as THREE.Mesh
    const geo = mesh.geometry.clone()
    // ⚠️ MESMO CHÃO EM Y=0: o exportador (`convert_one_asset.py`) já floora
    // no pé do modelo, mas a defesa é barata e evita cerca flutuando ou
    // enterrada se algum dia o pipeline mudar essa convenção.
    geo.computeBoundingBox()
    const minY = geo.boundingBox!.min.y
    if (Math.abs(minY) > 0.01) geo.translate(0, -minY, 0)
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    return { geo, mat }
  } catch (e) {
    console.error(`[estacao-inverno] ${url} NÃO CARREGOU`, e)
    return null
  }
}

// ── aproximação de arrio do cabo, SÓ pra posicionar cabine (ver a nota de
// `cabos` no cabeçalho: NÃO é a curva real do cabo, que mora em
// `inverno.ts` e não é exportada). Pilone de referência 16 m (comentário
// medido de `inverno.ts`, lido em 03/09/2026); arrio leve de 12% no meio do
// vão, como um cabo real catenário faz entre dois suportes. ───────────────
const PILONE_REF_M = 16
function alturaCaboAprox(t: number): number {
  const arrio = 0.12
  return PILONE_REF_M * (1 - arrio * 4 * t * (1 - t))
}

const FENCE_MODULO_M = 4.56 // comprimento real do `ski-fence.glb` (medido no exportador)

/** distribui posições ao longo de uma trilha (`TrilhaLike`), em AMBAS as
 *  bordas, a cada `passo` metros de arco, pra cerca e bandeira. Devolve
 *  também o `giro` (mesma fórmula de `mobiliario-urbano.ts`: rumo negativo,
 *  porque a peça "corre em +X local" e uma rotação em Y leva +X para
 *  (cosθ, 0, −senθ)). */
function pontosNaBorda(t: TrilhaLike, passo: number, offsetExtra: number): { x: number; z: number; giro: number }[] {
  const mundo = t.pontos.map((p) => pontoEmRumo(p.r, p.az))
  const out: { x: number; z: number; giro: number }[] = []
  const meiaLargura = t.largura / 2 + offsetExtra
  for (let i = 0; i < mundo.length - 1; i++) {
    const [x0, z0] = mundo[i], [x1, z1] = mundo[i + 1]
    const dx = x1 - x0, dz = z1 - z0
    const L = Math.hypot(dx, dz)
    if (L < 1e-6) continue
    const ux = dx / L, uz = dz / L
    const px = -uz, pz = ux
    const giro = -Math.atan2(uz, ux)
    for (let d = 0; d < L; d += passo) {
      const bx = x0 + ux * d, bz = z0 + uz * d
      for (const lado of [-1, 1]) {
        out.push({ x: bx + px * meiaLargura * lado, z: bz + pz * meiaLargura * lado, giro })
      }
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
export async function buildEstacaoInverno(o: EstacaoInvernoOpts): Promise<EstacaoInverno> {
  const group = new THREE.Group()
  group.name = 'estacao-inverno'
  const sombra = o.sombra ?? true
  let triangulos = 0
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(x: T): T => { disposables.push(x); return x }

  // ⚠️ `track()` só existe pra recurso que NÃO é alcançado por
  // `group.traverse` no `dispose()` final: toda geometria/material que vira
  // atributo de um Mesh/InstancedMesh ADICIONADO ao `group` já é descartado
  // ali, e envolver os dois em `track()` também seria descarte em dobro
  // (inofensivo no three.js, mas redundante e confuso de ler). A ÚNICA
  // exceção é `THREE.Texture`: `Material.dispose()` NÃO descarta o `.map`
  // dela (são recursos GPU separados), então toda textura de canvas criada
  // aqui precisa do `track()` mesmo sendo referenciada por um material que
  // o traverse já alcança.
  const vilaBase = o.vilaBase ?? { r: 6990, az: 265 }
  const [ancoraX, ancoraZ] = pontoEmRumo(vilaBase.r, vilaBase.az)
  // ⚠️ O RUMO DE ORIENTAÇÃO NÃO É `vilaBase.az` PURO: é o CENTRO da janela
  // angular do maciço (`azimuteMacico`, default 248..288° lido de `AZ0`/`AZ1`
  // em `inverno.ts`). São dois números com propósitos diferentes: `vilaBase`
  // é ONDE a vila fica (a âncora, um ponto), `azimuteMacico` é PRA ONDE a
  // montanha está (uma direção). O chalé, a bilheteria, o canhão e a placa
  // olham pro meio do maciço, não pro raio exato da âncora, que pode ter um
  // desvio local pequeno sem significado direcional.
  const macico = o.azimuteMacico ?? { az0: 248, az1: 288 }
  const azMacicoGraus = (macico.az0 + macico.az1) / 2
  const azRad = (azMacicoGraus * Math.PI) / 180
  // U = direção morro acima (r crescente, olhando pro meio do maciço);
  // P = lateral (perpendicular a U)
  const U = { x: Math.sin(azRad), z: -Math.cos(azRad) }
  const P = { x: Math.cos(azRad), z: Math.sin(azRad) }
  const ponto = (up: number, lado: number) => ({ x: ancoraX + U.x * up + P.x * lado, z: ancoraZ + U.z * up + P.z * lado })

  // ── TAREFA 1: A VILA-BASE ─────────────────────────────────────────────
  if (o.gltf) {
    const gltf = o.gltf
    const pLodge = ponto(-30, 45)
    const pBooth = ponto(-14, 20)
    const pSnowcat = ponto(-25, -42)

    const lodge = await carregarPecaUnica(gltf, '/city/sf/ski-lodge.glb', pLodge.x, pLodge.z, vilaBase.az + 180, o.heightAt(pLodge.x, pLodge.z), sombra)
    if (lodge) { lodge.obj.name = 'estacao:lodge'; group.add(lodge.obj); triangulos += lodge.triangulos }

    const booth = await carregarPecaUnica(gltf, '/city/sf/ticket-booth.glb', pBooth.x, pBooth.z, vilaBase.az + 90, o.heightAt(pBooth.x, pBooth.z), sombra)
    if (booth) { booth.obj.name = 'estacao:bilheteria'; group.add(booth.obj); triangulos += booth.triangulos }

    const snowcat = await carregarPecaUnica(gltf, '/city/sf/snowcat.glb', pSnowcat.x, pSnowcat.z, vilaBase.az + 200, o.heightAt(pSnowcat.x, pSnowcat.z), sombra)
    if (snowcat) { snowcat.obj.name = 'estacao:groomer'; group.add(snowcat.obj); triangulos += snowcat.triangulos }
  } else {
    console.warn('[estacao-inverno] sem `gltf`: chalé, bilheteria e groomer não sobem, só o que é procedural.')
  }

  // o canhão de neve: peça única, parada, perto da pista (lado da vila)
  {
    const pCanhao = ponto(18, -14)
    const geo = construirCanhaoDeNeve()
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(pCanhao.x, o.heightAt(pCanhao.x, pCanhao.z), pCanhao.z)
    mesh.rotation.y = azRad + Math.PI
    mesh.name = 'estacao:canhao-de-neve'
    mesh.castShadow = sombra
    mesh.receiveShadow = true
    group.add(mesh)
    triangulos += contarTris(geo)
  }

  // a placa da vila: nomes reais de `trilhas` quando vier, senão o snapshot
  {
    const listaPlaca = (o.trilhas && o.trilhas.length ? o.trilhas : PISTAS_SNAPSHOT).slice(0, 7)
    const alturaLinha = 640 / Math.max(4, listaPlaca.length + 1)
    const linhas = listaPlaca.map((p, i) => ({
      texto: p.nome, cor: CORES[p.dificuldade], tamanho: Math.min(46, alturaLinha * 0.62),
      y: alturaLinha * (i + 1),
    }))
    const tex = track(textTexture(linhas)) // textura: precisa do track, ver nota acima
    const pPlaca = ponto(-9, 9)
    const suporteGeo = construirSuporteDePlaca()
    const suporteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 })
    const suporte = new THREE.Mesh(suporteGeo, suporteMat)
    suporte.position.set(pPlaca.x, o.heightAt(pPlaca.x, pPlaca.z), pPlaca.z)
    suporte.rotation.y = azRad
    suporte.name = 'estacao:placa:suporte'
    suporte.castShadow = sombra
    group.add(suporte)
    triangulos += contarTris(suporteGeo)
    const chapaGeo = new THREE.PlaneGeometry(2.6, 1.6)
    const chapaMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    const chapa = new THREE.Mesh(chapaGeo, chapaMat)
    chapa.position.set(pPlaca.x, o.heightAt(pPlaca.x, pPlaca.z) + 2.2, pPlaca.z)
    chapa.rotation.y = azRad
    chapa.name = 'estacao:placa:texto'
    group.add(chapa)
    triangulos += contarTris(chapaGeo)
  }

  // ── TAREFA 2: CERCA, REDE E BANDEIRA AO LONGO DAS PISTAS TÉCNICAS ──────
  const tecnicas = (o.trilhas ?? []).filter((t) => t.dificuldade === 'preta' || t.dificuldade === 'vermelha')
  const MAX_CERCA = 48   // ≈ 219 m de cerca combinada, 48 × 1.500 tris = 72.000
  const MAX_BANDEIRA = 120

  if (o.gltf && tecnicas.length) {
    const gltf = o.gltf
    const fence = await carregarGeometriaEMaterial(gltf, '/city/sf/ski-fence.glb')
    if (fence) {
      let pontosCerca: { x: number; z: number; giro: number }[] = []
      for (const t of tecnicas) pontosCerca = pontosCerca.concat(pontosNaBorda(t, FENCE_MODULO_M, 1.0))
      if (pontosCerca.length > MAX_CERCA) {
        // desbaste uniforme e determinístico, não corte só do fim
        const passoDesbaste = pontosCerca.length / MAX_CERCA
        pontosCerca = Array.from({ length: MAX_CERCA }, (_, i) => pontosCerca[Math.floor(i * passoDesbaste)])
      }
      const inst = new THREE.InstancedMesh(fence.geo, fence.mat, Math.max(1, pontosCerca.length))
      inst.name = 'estacao:cerca'
      inst.castShadow = sombra
      inst.receiveShadow = true
      inst.frustumCulled = false
      const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion(), vs = new THREE.Vector3(1, 1, 1)
      pontosCerca.forEach((pt, i) => {
        vp.set(pt.x, o.heightAt(pt.x, pt.z), pt.z)
        vq.setFromEuler(new THREE.Euler(0, pt.giro, 0))
        m4.compose(vp, vq, vs)
        inst.setMatrixAt(i, m4)
      })
      inst.count = pontosCerca.length
      inst.instanceMatrix.needsUpdate = true
      inst.computeBoundingSphere()
      group.add(inst)
      triangulos += contarTris(fence.geo) * pontosCerca.length
      // fence.geo/fence.mat viram `inst.geometry`/`inst.material`: o
      // traverse do `dispose()` final já alcança os dois, sem track() aqui
    } else {
      console.warn('[estacao-inverno] ski-fence.glb não carregou: pistas técnicas ficam sem cerca.')
    }
  } else if (!tecnicas.length) {
    console.warn('[estacao-inverno] sem `trilhas`: cerca, rede e bandeira caem pro trecho simbólico perto da vila-base, não seguem a pista real.')
  }

  // bandeirolas de sinalização, cor por dificuldade via instanceColor
  {
    const pontosBandeira: { x: number; z: number; giro: number; cor: string }[] = []
    if (tecnicas.length) {
      // mesmo escopo da cerca (só preta/vermelha): a bandeira reforça a
      // borda que a cerca já marca, não um sistema de sinalização à parte
      for (const t of tecnicas) {
        for (const p of pontosNaBorda(t, 24, t.largura / 2 + 2.5)) pontosBandeira.push({ ...p, cor: CORES[t.dificuldade] })
      }
    } else {
      // fallback simbólico: um leque curto de bandeiras perto da vila
      for (let i = -3; i <= 3; i++) {
        const p = ponto(6, i * 6)
        pontosBandeira.push({ x: p.x, z: p.z, giro: azRad, cor: CORES.azul })
      }
    }
    let usar = pontosBandeira
    if (usar.length > MAX_BANDEIRA) {
      const passo = usar.length / MAX_BANDEIRA
      usar = Array.from({ length: MAX_BANDEIRA }, (_, i) => usar[Math.floor(i * passo)])
    }
    const geo = construirBandeira()
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, usar.length))
    inst.name = 'estacao:bandeiras'
    inst.frustumCulled = false
    const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion(), vs = new THREE.Vector3(1, 1, 1)
    usar.forEach((pt, i) => {
      vp.set(pt.x, o.heightAt(pt.x, pt.z), pt.z)
      vq.setFromEuler(new THREE.Euler(0, pt.giro, 0))
      m4.compose(vp, vq, vs)
      inst.setMatrixAt(i, m4)
      inst.setColorAt(i, new THREE.Color(pt.cor))
    })
    inst.count = usar.length
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    inst.computeBoundingSphere()
    group.add(inst)
    triangulos += contarTris(geo) * usar.length
  }

  // rede de contenção: uma por pista técnica, no fim dela (perto de rocha
  // exposta), ou um par simbólico perto da vila sem `trilhas`
  {
    const pontasFinais: { x: number; z: number; giro: number }[] = []
    for (const t of tecnicas) {
      const n = t.pontos.length
      if (n < 2) continue
      const [x0, z0] = pontoEmRumo(t.pontos[n - 2].r, t.pontos[n - 2].az)
      const [x1, z1] = pontoEmRumo(t.pontos[n - 1].r, t.pontos[n - 1].az)
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1
      pontasFinais.push({ x: x1 + (dx / L) * 6, z: z1 + (dz / L) * 6, giro: -Math.atan2(dz / L, dx / L) + Math.PI / 2 })
    }
    if (!pontasFinais.length) {
      pontasFinais.push({ x: ponto(-2, 30).x, z: ponto(-2, 30).z, giro: azRad })
      pontasFinais.push({ x: ponto(-2, -30).x, z: ponto(-2, -30).z, giro: azRad })
    }
    const { postes, tela } = construirRedeContencao()
    const postesGeo = postes
    const telaGeo = tela
    const postesMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 })
    const telaMat = new THREE.MeshStandardMaterial({
      color: '#E8660D', transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.9,
    })
    const instPostes = new THREE.InstancedMesh(postesGeo, postesMat, Math.max(1, pontasFinais.length))
    const instTela = new THREE.InstancedMesh(telaGeo, telaMat, Math.max(1, pontasFinais.length))
    instPostes.name = 'estacao:rede:postes'
    instTela.name = 'estacao:rede:tela'
    instPostes.frustumCulled = instTela.frustumCulled = false
    instPostes.castShadow = sombra
    const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion(), vs = new THREE.Vector3(1, 1, 1)
    pontasFinais.forEach((pt, i) => {
      vp.set(pt.x, o.heightAt(pt.x, pt.z), pt.z)
      vq.setFromEuler(new THREE.Euler(0, pt.giro, 0))
      m4.compose(vp, vq, vs)
      instPostes.setMatrixAt(i, m4)
      instTela.setMatrixAt(i, m4)
    })
    instPostes.count = instTela.count = pontasFinais.length
    instPostes.instanceMatrix.needsUpdate = instTela.instanceMatrix.needsUpdate = true
    group.add(instPostes, instTela)
    triangulos += (contarTris(postesGeo) + contarTris(telaGeo)) * pontasFinais.length
  }

  // ── TAREFA 4: CABINES DO TELEFÉRICO ─────────────────────────────────────
  const cabos: CaboOpts[] = o.cabos ?? [
    { rBase: 7000, azBase: 268, rTopo: 8280, azTopo: 268, nCabines: 10 },
    { rBase: 6950, azBase: 273, rTopo: 8220, azTopo: 261, nCabines: 6 },
  ]
  {
    const cabineGeo = construirCabine()
    const cabineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 })
    const totalCabines = cabos.reduce((s, c) => s + (c.nCabines ?? 8), 0)
    const inst = new THREE.InstancedMesh(cabineGeo, cabineMat, Math.max(1, totalCabines))
    inst.name = 'estacao:cabines'
    inst.frustumCulled = false
    let idx = 0
    const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion(), vs = new THREE.Vector3(1, 1, 1)
    for (const cabo of cabos) {
      const n = cabo.nCabines ?? 8
      for (let i = 0; i < n; i++) {
        // afasta das duas estações (0,08..0,92) pra não cravar cabine
        // dentro do prédio de embarque/desembarque
        const t = 0.08 + (i / Math.max(1, n - 1)) * 0.84
        const r = cabo.rBase + (cabo.rTopo - cabo.rBase) * t
        const az = cabo.azBase + (cabo.azTopo - cabo.azBase) * t
        const [x, z] = pontoEmRumo(r, az)
        const y = o.heightAt(x, z) + alturaCaboAprox(t)
        const azSeguinte = cabo.azBase + (cabo.azTopo - cabo.azBase) * Math.min(1, t + 0.02)
        const rSeguinte = cabo.rBase + (cabo.rTopo - cabo.rBase) * Math.min(1, t + 0.02)
        const [x2, z2] = pontoEmRumo(rSeguinte, azSeguinte)
        const giro = -Math.atan2(z2 - z, x2 - x)
        vp.set(x, y, z)
        vq.setFromEuler(new THREE.Euler(0, giro, 0))
        m4.compose(vp, vq, vs)
        inst.setMatrixAt(idx++, m4)
      }
    }
    inst.count = idx
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    group.add(inst)
    triangulos += contarTris(cabineGeo) * idx
  }

  // ── ORÇAMENTO DE DETALHE: raio proposto ─────────────────────────────────
  // Centro no meio do caminho entre a vila-base e o topo do cabo mais
  // longo, raio generoso o bastante pra cobrir vila + os dois vãos inteiros
  // (o vão principal mede r=7000→8280 no mesmo azimute, ou seja 1.280 m só
  // de raio, fora o desvio angular do vão do parque). `inverno.ts` registra
  // o PRÓPRIO grupo (montanha inteira) a 26.000 m, então 6.000 m aqui é uma
  // lente mais fina pra mobília de escala humana (chalé, bilheteria, placa)
  // sem cortar a estação antes da montanha em volta dela sumir. PROPOSTO,
  // não fechado: quem montar a cena pode passar `raioDetalhe` diferente.
  const raioDetalhe = o.raioDetalhe ?? 6000
  const [ccx, ccz] = pontoEmRumo((vilaBase.r + 8280) / 2, vilaBase.az)
  o.culler?.add(group, raioDetalhe, new THREE.Vector3(ccx, 0, ccz))

  return {
    group,
    triangulos: Math.round(triangulos),
    dispose() {
      group.traverse((k) => {
        const mesh = k as THREE.Mesh
        if (!(mesh as THREE.Mesh).isMesh) return
        mesh.geometry?.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[]
        if (Array.isArray(mat)) mat.forEach((m) => m?.dispose()); else mat?.dispose?.()
      })
      for (const d of disposables) d.dispose()
      group.clear()
    },
  }
}
