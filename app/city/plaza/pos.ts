// ═══════════════════════════════════════════════════════════════════════════
// PÓS-PROCESSAMENTO DA PRAÇA (atrás de ?look=2)
//
// Um EffectComposer encapsulado, com API pequena, para o laço de render da cena
// não precisar saber o que é um passe:
//
//     const pos = montarPos(renderer, scene, camera, { largura, altura, dpr })
//     // no laço:
//     if (pos.ativo) pos.render(); else renderer.render(scene, camera)
//
// A ordem é RenderPass, oclusão de ambiente, bloom, OutputPass, antisserrilhado,
// e cada escolha tem motivo escrito abaixo.
//
// ⚠️ IMPORTAÇÃO DINÂMICA, COMO EM app/city/explore/city-3d.tsx (~linha 713). Os
// módulos de `three/examples/jsm/postprocessing` só entram depois que a cena
// nasce: o composer é acessório, e quem paga a primeira tela é o caminho normal.
// Enquanto os módulos não chegam, `ativo` é false e a cena desenha direto.
//
// ⚠️ O TONEMAPPING ACONTECE UMA VEZ SÓ, E NÃO POR SORTE. Lido na fonte do three
// 0.162 (WebGLPrograms.getParameters): o `toneMapping` do material vira
// NoToneMapping sempre que o alvo de render NÃO é a tela. Com composer, todo o
// desenho da cena vai para um alvo HalfFloat, logo nenhum material tonemapeia;
// quem tonemapeia é o OutputPass, lendo `renderer.toneMapping` e
// `renderer.toneMappingExposure`. Por isso o `renderer.toneMapping` FICA como
// está (ACES): tirar ele deixaria o OutputPass sem curva. A nota equivalente,
// pelo lado do fundo de cena, está em
// app/city/explore/anchor-preview/glb-viewer.tsx (~linha 151).
//
// ⚠️ E TEM UM EFEITO COLATERAL QUE SAI DE CONTA, NÃO DE MEDIÇÃO. Material com
// `toneMapped: false` (as fitas quentes do Chalé, o gelo do Precinct, as placas
// dos Monuments) não passava pela curva no caminho direto e passa a passar aqui,
// porque o renderizador não distingue material dentro de um alvo. Pela fórmula
// do ACES do three, branco linear 1,0 com exposição 1,06 sai em 0,777 linear, ou
// 228/255 no lugar de 255: 10,6% mais escuro. É perda conhecida e uniforme, e
// devolve espaço de alta luz para o bloom em vez de estourar chapado.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'

export interface PosOpts {
  largura: number
  altura: number
  dpr: number
  /** liga o passe de oclusão de ambiente (o item mais caro daqui) */
  ao?: boolean
  /** raio do AO em METROS DE MUNDO. Curto: é contato, não ambiente de sala */
  aoRaio?: number
  /** 0..1, quanto o AO escurece. Sutil, senão vira halo sujo de demo */
  aoForca?: number
  /** escala do buffer de AO (1 = resolução cheia, 0,5 = metade) */
  aoEscala?: number
  /** meio-lado (m) da caixa em volta da câmera dentro da qual o AO é calculado */
  aoAlcance?: number
  /** direções amostradas pelo GTAO (16 é o padrão do three) */
  aoAmostras?: number
  bloomForca?: number
  bloomRaio?: number
  bloomLimiar?: number
}

export interface Pos {
  /** true quando o composer está montado e `render()` desenha de verdade */
  readonly ativo: boolean
  /** true quando o passe de oclusão entrou no composer */
  readonly aoLigado: boolean
  /** o que aconteceu ao montar; sai em window.__plazaPos() com ?stats=1 */
  readonly diagnostico: Record<string, unknown>
  /**
   * ⚠️ OS CONTADORES DA CENA, LIDOS NA HORA CERTA. `renderer.info.render` é
   * ZERADO no começo de cada `renderer.render()`, e cada passe de tela cheia do
   * composer é um `renderer.render()` de um quad. Quem lesse o info no fim do
   * quadro leria o último quad: "1 chamada, 1 triângulo". Isto aqui é a foto
   * tirada logo depois do RenderPass, ou seja a geometria REAL da cena, que é o
   * número com que os outros módulos medem o próprio trabalho.
   */
  readonly medida: { calls: number; triangles: number; points: number; lines: number } | null
  render(): void
  resize(largura: number, altura: number): void
  /** o FrameGovernor (perf.ts) mexe no DPR do renderer; o composer segue */
  setDpr(dpr: number): void
  dispose(): void
}

/** ?ao=1 liga, ?ao=0 desliga, ?ao=so mostra só o buffer de oclusão */
function lerModoAo(): 'liga' | 'desliga' | 'so' | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('ao')
  if (v === '1') return 'liga'
  if (v === '0') return 'desliga'
  if (v === 'so' || v === 'only') return 'so'
  return null
}

class Composicao implements Pos {
  ativo = false
  aoLigado = false
  diagnostico: Record<string, unknown> = { estado: 'carregando' }
  medida: { calls: number; triangles: number; points: number; lines: number } | null = null

  private composer: EffectComposer | null = null
  private gtao: GTAOPass | null = null
  private descartado = false
  /** caixa de recorte do AO, refeita por quadro em volta da câmera */
  private caixaAo = new THREE.Box3()
  private l: number
  private a: number

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private opts: PosOpts,
  ) {
    this.l = opts.largura
    this.a = opts.altura
    void this.montar()
  }

  private async montar() {
    try {
      const [
        { EffectComposer: EC }, { RenderPass }, { GTAOPass: GTAO },
        { UnrealBloomPass }, { OutputPass }, { SMAAPass },
      ] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/GTAOPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
        import('three/examples/jsm/postprocessing/SMAAPass.js'),
      ])
      if (this.descartado) return

      const o = this.opts
      const dpr = o.dpr
      const composer = new EC(this.renderer)
      composer.setPixelRatio(dpr)
      composer.setSize(this.l, this.a)
      const rp = new RenderPass(this.scene, this.camera)
      // ⚠️ A FOTO DOS CONTADORES SAI DAQUI, e não do fim do quadro. Ver a nota
      // em `medida`, na interface: o info do renderizador zera a cada
      // `renderer.render()`, e o composer faz um por passe.
      const rpRender = rp.render.bind(rp)
      rp.render = (...args: Parameters<typeof rpRender>) => {
        rpRender(...args)
        const r = this.renderer.info.render
        this.medida = { calls: r.calls, triangles: r.triangles, points: r.points, lines: r.lines }
      }
      composer.addPass(rp)

      // ── OCLUSÃO DE AMBIENTE ───────────────────────────────────────────────
      // O defeito nº 1 de contato da cena é que tudo encosta no chão com emenda
      // dura. GTAO é o passe certo (busca de horizonte, não amostragem de esfera
      // como o SSAO velho) e ele EXISTE no three 0.162 instalado
      // (node_modules/three/examples/jsm/postprocessing/GTAOPass.js), então não
      // caímos no SSAOPass.
      const modo = lerModoAo()
      const quer = modo === 'desliga' ? false : modo ? true : (o.ao ?? true)
      let motivoAo = modo === 'desliga' ? 'desligado por ?ao=0' : 'desligado pelo perfil'
      let gtao: GTAOPass | null = null
      if (quer) {
        gtao = new GTAO(this.scene, this.camera, this.l * dpr, this.a * dpr)
        motivoAo = 'ligado'

        // ⚠️ AQUI MORA O BURACO DO BUFFER LOGARÍTMICO, E ELE É REAL.
        //
        // Esta cena liga `logarithmicDepthBuffer` por padrão (plaza-scene.tsx,
        // ~linha 704). Com ele TODO material do renderizador ganha o define
        // USE_LOGDEPTHBUF e escreve `gl_FragDepth = log2(1 + w) * logDepthBufFC
        // * 0,5` no lugar do z do rasterizador. O GTAOPass desenha o G-buffer
        // dele com um MeshNormalMaterial próprio e depois reconstrói posição de
        // vista de duas formas, `perspectiveDepthToViewZ(depth, near, far)` e a
        // inversa da matriz de projeção aplicada em NDC
        // (three/examples/jsm/shaders/GTAOShader.js, linhas 109 a 128). As duas
        // assumem profundidade NDC comum: com profundidade logarítmica o AO sai
        // ERRADO, a cena colapsa perto do plano near e a oclusão vira borrão.
        //
        // O conserto não é remendar dois shaders do three (getDepth E
        // getViewPosition, no GTAO e no denoise de Poisson, que nem tem os
        // uniformes de near e far). É tirar o gl_FragDepth do ÚNICO material que
        // desenha o G-buffer: sem o `logdepthbuf_fragment` o MeshNormalMaterial
        // volta a gravar gl_FragCoord.z, que é exatamente o que o shader do AO
        // espera, e nada mais na cena é tocado.
        //
        // E o G-buffer aguenta o z comum porque o `near` desta cena já acompanha
        // a distância (near = d²/1e6, ver a nota longa em plaza-scene.tsx): a
        // resolução do z fica constante em 5,96 cm em qualquer distância, metade
        // da separação de 12 cm das camadas do kit.
        if (this.renderer.capabilities.logarithmicDepthBuffer) {
          const nm = gtao.normalMaterial
          nm.onBeforeCompile = (s) => {
            s.fragmentShader = s.fragmentShader.replace('#include <logdepthbuf_fragment>', '')
          }
          // ⚠️ chave de cache FIXA: sem ela o three usa o texto da função como
          // parte da chave do programa, e o orçamento de programas (402 medidos
          // na vista alta) passaria a depender de como este arquivo foi
          // minificado. Ver a mesma regra em materiais.ts.
          nm.customProgramCacheKey = () => 'gtao-sem-logdepth'
          nm.needsUpdate = true
          motivoAo = 'ligado, G-buffer sem gl_FragDepth (logdepth ligado na cena)'
        }

        // ⚠️ RAIO CURTO E FORÇA BAIXA. AO exagerado vira aquele halo cinza de
        // demo, que é PIOR que não ter AO: ele come a sombra dura que faz a cena
        // parecer Lua. 0,9 m é contato de peça com chão, não ambiente de sala.
        // `screenSpaceRadius: false` mantém o raio em METROS DE MUNDO, que é o
        // que impede o AO de crescer quando a câmera se afasta.
        gtao.updateGtaoMaterial({
          radius: o.aoRaio ?? 0.9,
          distanceExponent: 1.4,
          thickness: 1.2,
          scale: 1,
          samples: o.aoAmostras ?? 16,
          screenSpaceRadius: false,
        })
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: o.aoAmostras ?? 16 })
        gtao.blendIntensity = o.aoForca ?? 0.6
        if (modo === 'so') gtao.output = GTAO.OUTPUT.Denoise

        // Escala do buffer de AO. O passe redimensiona os alvos internos dele em
        // setSize, então basta interceptar ANTES do addPass (que chama setSize).
        // Meia resolução corta pela metade o preenchimento do prepasse de normal
        // e do denoise; a geometria continua sendo desenhada duas vezes.
        const escala = o.aoEscala ?? 1
        if (escala !== 1) {
          const original = gtao.setSize.bind(gtao)
          gtao.setSize = (w: number, h: number) => original(Math.max(2, Math.round(w * escala)), Math.max(2, Math.round(h * escala)))
        }
        composer.addPass(gtao)
      }

      // ── BLOOM ─────────────────────────────────────────────────────────────
      // ⚠️ ELE EXISTE PARA O POSTE E A JANELA ACESA, NÃO PARA LAVAR A CENA. Numa
      // lua sem atmosfera, halo largo em superfície iluminada é mentira física
      // além de feio. Força baixa e limiar ALTO: só o que já está acima de 0,95
      // linear floresce, e o regolito ao sol, medido em 30% de luminância na
      // chapa de 29/08, fica de fora com folga.
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(this.l * dpr, this.a * dpr),
        o.bloomForca ?? 0.16,
        o.bloomRaio ?? 0.34,
        o.bloomLimiar ?? 0.95,
      )
      composer.addPass(bloom)

      // ── SAÍDA ─────────────────────────────────────────────────────────────
      // OutputPass faz ACES + sRGB, uma vez só (ver a nota do topo).
      composer.addPass(new OutputPass())

      // ── ANTISSERRILHADO ───────────────────────────────────────────────────
      // ⚠️ DEPOIS do OutputPass, e isso não é detalhe. O MSAA do contexto WebGL
      // vale para o framebuffer padrão e some assim que o desenho vai para um
      // FBO, que é o que o composer faz; o SMAA repõe. E ele é um filtro de
      // BORDA calibrado em espaço de exibição: rodar antes do tonemapping o
      // faria julgar contraste em valores HDR, onde toda alta luz vira aresta.
      // (A referência de app/city/explore/city-3d.tsx põe o SMAA antes do
      // OutputPass; aqui está depois, de propósito.)
      composer.addPass(new SMAAPass())

      this.composer = composer
      this.gtao = gtao
      this.aoLigado = !!gtao
      this.ativo = true
      this.diagnostico = {
        estado: 'ativo',
        passes: ['render', ...(gtao ? ['gtao'] : []), 'bloom', 'output', 'smaa'],
        ao: motivoAo,
        aoRaio: o.aoRaio ?? 0.9,
        aoForca: o.aoForca ?? 0.6,
        aoEscala: o.aoEscala ?? 1,
        aoAlcance: o.aoAlcance ?? 380,
        aoAmostras: o.aoAmostras ?? 16,
        bloom: { forca: o.bloomForca ?? 0.16, raio: o.bloomRaio ?? 0.34, limiar: o.bloomLimiar ?? 0.95 },
        logDepth: this.renderer.capabilities.logarithmicDepthBuffer,
      }
    } catch (e) {
      // sem pós-processamento a cena continua desenhando pelo caminho direto
      this.ativo = false
      this.diagnostico = { estado: 'falhou', erro: String(e) }
    }
  }

  render() {
    // ── A CAIXA DE RECORTE DO AO SEGUE A CÂMERA ────────────────────────────
    //
    // ⚠️ ISTO É O CONSERTO DO CHUVISCO NO CÉU E NA ABÓBADA, e o defeito não era
    // o G-buffer estar sem gl_FragDepth: era PRECISÃO DE PROFUNDIDADE LONGE.
    // Sem buffer logarítmico, a resolução do z de 24 bits vale d² / (near · 2²⁴).
    // Nesta vista de rua o `near` está no piso de 0,3 m, então a 6 km, que é
    // onde mora a casca da abóbada, cada degrau de z mede 36e6 / (0,3 · 1,678e7)
    // = 7,2 m; nas estrelas mede quilômetros. O GTAO reconstrói posição de vista
    // a partir desse z e compara o horizonte entre pixels VIZINHOS: com degraus
    // de 7 metros numa casca lisa, vizinhos caem em degraus diferentes, o teste
    // de horizonte alterna, e a saída é exatamente um chuvisco fino.
    //
    // ⚠️ E ESCREVER PROFUNDIDADE LOGARÍTMICA NO PREPASSE NÃO SERIA O CONSERTO
    // CERTO, seria um conserto caro para um problema que não precisa existir. O
    // raio do AO é 0,9 m de mundo: a 400 m de câmera, 0,9 m já mede menos de um
    // pixel. Oclusão de contato a 6 km é ruído por definição, não informação.
    //
    // Então o AO passa a valer só dentro de uma caixa em volta da câmera. O
    // shader do GTAO tem isso pronto (SCENE_CLIP_BOX): fora da caixa mais o
    // raio ele DESCARTA o fragmento, e o alvo fica no branco de limpeza, que é
    // "sem oclusão". Céu, estrelas, abóbada e horizonte saem do AO, o chuvisco
    // some, e de quebra o laço de 16 direções deixa de rodar na maior parte da
    // tela, que é onde estava boa parte do custo.
    if (this.gtao) {
      const p = this.camera.position
      const r = this.opts.aoAlcance ?? 380
      this.caixaAo.min.set(p.x - r, p.y - r, p.z - r)
      this.caixaAo.max.set(p.x + r, p.y + r, p.z + r)
      this.gtao.setSceneClipBox(this.caixaAo)
    }
    this.composer?.render()
  }

  resize(largura: number, altura: number) {
    this.l = largura
    this.a = altura
    this.composer?.setSize(largura, altura)
  }

  setDpr(dpr: number) {
    this.opts.dpr = dpr
    // EffectComposer.setPixelRatio já refaz o setSize dos alvos e de cada passe,
    // que é o que mantém a resolução dinâmica do FrameGovernor funcionando.
    this.composer?.setPixelRatio(dpr)
  }

  dispose() {
    this.descartado = true
    this.ativo = false
    this.gtao?.dispose()
    this.composer?.dispose()
    this.composer = null
    this.gtao = null
  }
}

/**
 * Monta o pós-processamento. Devolve NA HORA um cabo com `ativo = false`; ele
 * vira true sozinho quando os módulos do three chegarem. Quem chama só precisa
 * de: `if (pos.ativo) pos.render(); else renderer.render(scene, camera)`.
 */
export function montarPos(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: PosOpts,
): Pos {
  return new Composicao(renderer, scene, camera, opts)
}
