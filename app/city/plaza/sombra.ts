// ============================================================================
// SOMBRA EM CASCATA DA PRACA (Bloco E de fundacao-gta5.md)
// ============================================================================
//
// Modulo NOVO, dono da FRENTE SOMBRA. Nao importa perf.ts, nao importa
// plaza-scene.tsx: recebe cena e renderer, devolve um objeto que a cena liga
// e atualiza por quadro. Atras da bandeira `?csm=1` de quem chama (este
// arquivo nao le a URL: quem decide ligar ou nao e o cabo, plaza-scene.tsx).
//
// ── O PROBLEMA, em uma frase ────────────────────────────────────────────────
// Hoje ha UMA DirectionalLight com UMA camera ortografica de sombra cuja
// meia-largura cresce por degrau (1.000 / 1.800 / 3.200 / 4.600 m) sobre um
// mapa de 2048. No pior degrau, um texel de sombra mede 2*3200/2048 = 3,125 m,
// maior que um lote inteiro: nenhum meio-fio, poste ou plinto pode ter sombra
// de contato nesse regime.
//
// ── A CONTA DAS TRES CASCATAS (conferida, nao inventada) ───────────────────
// Tabela do plano:
//   cascata 0: alcance  0-60 m   -> texel 2,9 cm
//   cascata 1: alcance 60-400 m  -> texel 16,6 cm
//   cascata 2: alcance 400-2000 m-> texel 78,1 cm
//
// texel = diametro / mapSize, com mapSize = 2048 (mesmo mapa nas tres,
// exatamente como o plano pede). O diametro de cada cascata e a LARGURA DA
// FAIXA (fim menos inicio), nao a distancia absoluta ao anfitriao: e essa
// leitura e a UNICA que reproduz os tres texels do plano com exatidao:
//
//   cascata 0: diametro = 60 -  0 =   60 m -> meia-largura 30   m
//              texel = 60   / 2048 = 0,029296875 m = 2,93 cm  (2,9 cm)
//   cascata 1: diametro = 400 - 60 =  340 m -> meia-largura 170  m
//              texel = 340  / 2048 = 0,166015625 m = 16,60 cm (16,6 cm)
//   cascata 2: diametro = 2000-400 = 1600 m -> meia-largura 800  m
//              texel = 1600 / 2048 = 0,78125 m    = 78,13 cm (78,1 cm)
//
// ACHADO DA PRIMEIRA RODADA, escrito porque a regra da casa e nao esconder
// conta que nao fecha: com meia-largura 800 m a cascata 2 alcanca, a partir
// do seu proprio centro, ATE 800 m, nao ate 2.000 m. Nao existe meia-largura
// que de simultaneamente texel 78,1 cm E alcance de 2.000 m com mapa 2048
// (isso pediria meia-largura 1.000 m, que da texel 97,6 cm, fora do que a
// tabela pede). A conta do plano era do coordenador e estava errada nesse
// ponto; a DECISAO, pedida explicitamente no brief: ALEM DO ALCANCE REAL DE
// CADA CASCATA (30 / 170 / 800 m do seu proprio ancora, ver abaixo qual e o
// ancora de cada uma), NAO HA SOMBRA PROJETADA. O chao fica com a luz
// ambiente (hemisferica + earthshine, que plaza-scene.tsx ja mantem).
//
// ── OS DOIS ANCORAS (por que nao e um so) ───────────────────────────────────
// Cascata 0 (perto) segue a CAMERA. E ela que resolve "debaixo da camera":
// contato de meio-fio nao depende de para onde voce esta olhando, depende de
// onde voce esta PISANDO. Cascatas 1 e 2 seguem `controls.target`, exatamente
// como a sombra unica de hoje, e pelo mesmo motivo ja escrito no arquivo
// antigo: e o alvo, nao a camera, que pode estar no parque a 9 km.
//
// ============================================================================
// SEGUNDA RODADA (revisao do coordenador): POR QUE NAO HA MAIS LUZ FANTASMA
// ============================================================================
//
// A primeira versao deste modulo usava DUAS DirectionalLight extras, de
// intensidade ZERO, so para o three renderizar o mapa de profundidade delas
// (castShadow=true entra na lista de sombra independente de intensidade,
// conferido em WebGLRenderer.js). Funcionava sem vazamento aditivo, mas
// tinha um custo permanente e correto de apontar: a CONTAGEM de luzes da cena
// subia de 1 para 3, e isso sobe `NUM_DIR_LIGHTS`/`NUM_DIR_LIGHT_SHADOWS` na
// PERMUTACAO DE SHADER DE TODO MATERIAL ILUMINADO DA CENA, para sempre,
// mesmo com as duas luzes contribuindo zero. `perf.ts` tem uma classe inteira
// (`OrcamentoDeLuz`) por causa exatamente disso, medido nesta cena: uma
// viagem de camera de ida e volta que mudou a contagem de luz subiu os
// programas compilados de 444 para 480. Existe uma frente de orcamento
// inteira tentando derrubar o numero de programas hoje; uma solucao de
// sombra que trabalha contra ela nao serve, mesmo custando zero em VRAM.
//
// O CONSERTO: cascatas 0 e 1 NAO SAO LUZ NENHUMA. Sao dois passes manuais de
// profundidade, cada um com sua propria `THREE.OrthographicCamera` (nunca
// adicionada a `scene`, nunca vira Light) e seu proprio `WebGLRenderTarget`
// com `depthTexture`. O desenho e feito com `scene.overrideMaterial` mais
// `renderer.setRenderTarget(alvo)` mais `renderer.render(scene, camera)`,
// restaurando `overrideMaterial = null` e `setRenderTarget(null)` logo
// depois. A cascata 2 continua sendo o `sun` de hoje, INALTERADA: e a UNICA
// luz que a cena tem, exatamente como antes desta rodada inteira comecar.
// Resultado: ZERO luz nova, ZERO permutacao nova em qualquer material que
// este modulo nao possui, ZERO briga com a frente de orcamento. O mapa que
// sai desses dois passes manuais e LIDO exatamente como antes: um shader meu,
// num quad raso, escurecendo por multiplicacao (ver a secao do decalque mais
// abaixo, ela nao mudou).
//
// ── O QUE `overrideMaterial` DESENHA, E COMO ISTO FOI RECORTADO ─────────────
// `scene.overrideMaterial` troca o material de TUDO que estiver visivel na
// cena para o passe, sem excecao: ceu, estrelas, a Terra (billboard que segue
// a camera) e ate os proprios dois quads escurecedores deste modulo, se
// alguem esquecer de escondê-los. Sem recorte, esses fundos GIGANTES (a casca
// da abobada e citada em outro comentario deste arquivo como estando a 6 km)
// entrariam no mapa de profundidade da cascata perto e escureceriam o chao
// inteiro, ou nada, dependendo de qual lado da comparacao ganhasse.
//
// Este modulo nao tem acesso as camadas (`THREE.Layers`) de ceu/estrelas/
// Terra: elas nascem em plaza-scene.tsx, que este modulo nao edita, e nao
// existe hoje uma convencao de camada para "coisa que nao e chao" (a unica
// camada em uso na cena e `CAVE_LAYER`, para a caverna, sem relacao). Duas
// mitigacoes DENTRO do que este modulo possui:
//
//   1. OS DOIS QUADS ESCURECEDORES FICAM INVISIVEIS DURANTE A PROPRIA
//      CAPTURA (`decal0.mesh.visible = decal1.mesh.visible = false` antes de
//      cada passe manual, restaurado depois). Isto e garantido, nao e conta:
//      sao objetos deste modulo.
//
//   2. O `near`/`far` DE CADA CAMERA ORTOGRAFICA MANUAL E APERTADO EM TORNO
//      DA PROPRIA ALTURA DO TERRENO, NAO O 500-7000 COMPARTILHADO DA CASCATA
//      2. `MARGEM_PROFUNDIDADE_MANUAL = 400` m: a camera manual fica a
//      `distanciaSol` (3.600 m, igual a hoje) do ancora ao longo do sol, com
//      `near = distanciaSol - 400` e `far = distanciaSol + 400`, ou seja so
//      enxerga o que estiver entre 3.200 e 4.000 m dela mesma NA DIRECAO DO
//      SOL. Isto cobre com folga os 232 m de relevo do sitio inteiro citados
//      em fundacao-gta5.md e qualquer torre de dezenas de metros, e deixa de
//      fora, por construcao, qualquer coisa que exista a mais de 400 m do
//      ancora ao longo do eixo do sol, o que inclui o ceu/estrelas/Terra
//      (objetos de fundo, pensados para ficar atras de tudo) NA IMENSA
//      MAIORIA dos enquadramentos.
//
// ISTO NAO E GARANTIA, E FICA MARCADO ASSIM: nao abri navegador, nao vi
// nenhuma chapa desta cena. Se o ceu/abobada tiver geometria que cruze essa
// janela de 800 m em algum angulo especifico de sol (por exemplo, perto do
// horizonte, quando a luz quase raspa a casca), ela entraria no passe manual
// e apareceria como uma mancha grande e errada no decalque daquela cascata.
// O jeito de ver isso na chapa: se um decalque escurecer uma area MUITO maior
// que 60 ou 340 m ao redor do proprio ancora, ou escurecer coisa no ceu, e
// exatamente este vazamento. O conserto correto seria layers de verdade
// (marcar ceu/estrelas/Terra numa camada que as duas cameras manuais nao
// veem), e isso pertence a quem cria esses objetos, nao a este modulo.
//
// ============================================================================
// O QUE NAO RECEBE A SOMBRA FINA (em letra grande porque o coordenador pediu)
// ============================================================================
//
//   UM QUAD ESCURECEDOR SOBRE O CHAO ESCURECE O CHAO. SO O CHAO.
//
//   A FACE DO MEIO-FIO, O FUSTE DO POSTE, O TRONCO DA ARVORE E QUALQUER
//   SUPERFICIE VERTICAL NAO RECEBEM A SOMBRA FINA DESTE MODULO. ELAS
//   CONTINUAM COM A SOMBRA GROSSA DA CASCATA 2 (78 cm de texel), A MESMA
//   PRECISAO QUE JA EXISTIA NO DEGRAU MEDIO DE HOJE.
//
// Para esta rodada isto e aceitavel: o assunto e a FUNDACAO, e o assunto da
// fundacao e o chao (fundacao-gta5.md, Bloco E, "o que se ve de pe"). O
// meio-fio GANHA sombra de contato no PISO ao lado dele (a marca escura que
// ele projeta), que e o efeito que mais faltava; a face vertical do proprio
// meio-fio continua lida so pela iluminacao direta/hemisferica, sem
// escurecimento extra.
//
// O que resolveria isto: uma passada em ESPACO DE TELA, reconstruindo a
// posicao de mundo de CADA PIXEL da imagem final a partir do buffer de
// profundidade da CAMERA (nao da luz), e comparando essa posicao contra as
// tres cascatas do sol do mesmo jeito que o decalque faz para o chao. Isso
// escureceria qualquer superficie, vertical ou nao, porque deixaria de
// depender de um quad plano ancorado no chao. Essa tecnica mora, por
// construcao, no COMPOSER (`pos.ts`, o pos-processamento que ja existe na
// cena para o AO), porque so ali existe o buffer de profundidade da CAMERA
// pronto para reconstrucao. `pos.ts` nao e deste modulo.
//
// ============================================================================
// O QUAD ACOMPANHA O RELEVO? SIM, POR MALHA, E O ERRO E LIMITADO ASSIM
// ============================================================================
//
// Cada decalque e uma grade (nao mais um quad unico): cascata 0 usa 8x8
// celulas (9x9 = 81 vertices, celula de 60/8 = 7,5 m); cascata 1 usa 16x16
// celulas (17x17 = 289 vertices, celula de 340/16 = 21,25 m). A cada quadro
// em que a cascata esta ligada, CADA VERTICE e reamostrado por `alturaEm(x,
// z)` (a mesma funcao de terreno que a chamadora ja usa para pousar a
// camera) e a malha e reenviada para a GPU. 81 + 289 = 370 chamadas de
// `alturaEm` por quadro: nao medido em ms, mas da mesma ordem de grandeza do
// que `chao()` ja custa por quadro so para a colisao da camera, entao nao
// deveria ser o item mais caro deste modulo.
//
// O ERRO MAXIMO, por celula, e a diferenca entre o relevo verdadeiro DENTRO
// da celula e o plano que os 4 vertices dela descrevem (a malha acerta o
// vertice, o erro mora so ENTRE vertices). Isto NAO FOI MEDIDO (exigiria o
// terreno carregado, que so existe no navegador), mas da para limitar por
// CONSTRUCAO, comparando a celula com o que ja se sabe do terreno:
//
//   HOJE (antes do Bloco A): `terrain.ts` desenha uma malha de 59,2 m por
//   triangulo. Uma celula de 7,5 ou 21,25 m cabe INTEIRA dentro de um unico
//   triangulo do terreno na maioria dos casos, que e plano por definicao: o
//   erro desta malha e desprezivel porque nao ha curvatura para perder
//   dentro de uma celula menor que o proprio triangulo que ela amostra.
//
//   DEPOIS do Bloco A (micro-relevo de ate 12 cm de amplitude, comprimento de
//   onda minimo 8 m, conforme fundacao-gta5.md): a celula de cascata 0 (7,5 m)
//   fica ABAIXO do comprimento de onda minimo do relevo, e nao ha garantia de
//   capturar um pico ou vale inteiro dentro de uma unica celula; o erro pode
//   chegar a ordem da propria amplitude, 12 cm. A celula de cascata 1
//   (21,25 m) fica acima do comprimento de onda, entao tende a promediar o
//   relevo em vez de perde-lo, com erro menor que 12 cm mas tambem NAO
//   MEDIDO. Nenhum dos dois casos e catastrofico (o decalque so escurece,
//   nunca clareia, e um erro de poucos centimetros no chao nao move a
//   silhueta de nada), mas fica escrito que o numero exato depende do Bloco A
//   e nao foi medido.
//
// Sem `alturaEm` fornecido, a malha nao e reamostrada: fica achatada em Y=0
// (mais o `elevarDecal`), o mesmo piso "errado mas previsivel" documentado
// abaixo na opcao `alturaEm`.
//
// ============================================================================
// ── (c) needsUpdate POR CASCATA, sem `renderer.shadowMap` para 0 e 1 ───────
// ============================================================================
// Como cascatas 0 e 1 nao sao luz, elas nao passam por
// `renderer.shadowMap.needsUpdate` (esse portao continua existindo, mas so
// para a cascata 2/`sol`, exatamente como no arquivo de hoje). Para 0 e 1, o
// controle e direto: este modulo decide, com o proprio contador de quadro,
// SE chama `renderer.render(scene, camOrto)` para cada uma neste quadro, sem
// flag nenhuma no meio. Cascata 0 renderiza TODO quadro (a nao ser congelada
// pelo voo); cascatas 1 e 2 seguem `everyN`, cascata 1 pelo mesmo contador
// manual, cascata 2 pelo mecanismo de sempre (`sun.shadow.needsUpdate`).
//
// ── (a) ENCAIXE EM TEXEL, POR CASCATA ───────────────────────────────────────
// A mesma tecnica de hoje (arredondar o alvo, em espaco girado para o eixo do
// sol, para o multiplo mais proximo do texel), repetida tres vezes com o
// texel de cada uma. Sem isso a sombra treme 1 texel a cada passo de camera,
// e a 2,9 cm por texel na cascata 0 um tremor de 1 texel ja e visivel.
//
// ── (b) A COSTURA ────────────────────────────────────────────────────────
// Cada decalque escurece TOTAL no miolo e esvaece para NENHUM efeito (branco)
// numa margem perto da propria borda (smoothstep em espaco local do quad).
// Como e so escurecimento por multiplicacao, a costura nunca aparece como
// linha: e uma transicao macia entre "esta cascata refina" e "so a cascata
// de baixo (ou nenhuma) esta atuando ali".
//
// ── (e) BIAS E normalBias, POR CASCATA ──────────────────────────────────────
// A UNICA calibragem por chapa que o arquivo de hoje registra com o texel
// junto e o `normalBias`: 1,2 apagava 97% da sombra; 0,15 foi o valor medido
// no degrau `half = 300` do `?look=2` (o mais fino que existia), cujo texel e
// 2*300/2048 = 0,29296875 m. Dai sai a UNICA razao que este modulo tem
// direito de usar sem inventar numero:
//
//   k_normalBias = 0,15 / 0,29296875 = 0,512  (adimensional)
//
// `bias` (-0,0004) nao tem texel de referencia escrito no comentario de hoje.
// Assumo, por semelhanca dimensional (as duas existem para o mesmo motivo:
// acne de auto-sombra vs. descolamento do pe), A MESMA razao, e isto e CONTA
// por analogia, NAO MEDIDO (o coordenador confirmou: fica marcado assim, nao
// se mede por outro caminho nesta rodada):
//
//   k_bias = -0,0004 / 0,29296875 = -0,0013655  (por metro de texel)
//
// Aplicando aos tres texels (near/far do frustum de sombra da cascata 2
// mantidos iguais aos de hoje, 500-7000; cascatas 0/1 usam a propria janela
// apertada de 400 m, ver acima, sem efeito nesta razao porque bias/normalBias
// aqui sao aplicados A MAO no shader do decalque, nao lidos de
// `light.shadow`):
//
//   cascata 0  texel 0,0293 m -> normalBias 0,0150 m (1,5 cm)  bias -0,0000400
//   cascata 1  texel 0,1660 m -> normalBias 0,0850 m (8,5 cm)  bias -0,0002266
//   cascata 2  texel 0,7813 m -> normalBias 0,4000 m (40   cm) bias -0,0010668
//
// (cascata 2 usa o `light.shadow.bias/normalBias` de verdade do three, porque
// ela e a unica luz que ilumina; cascatas 0/1 usam os MESMOS numeros, so que
// aplicados a mao dentro do shader do decalque, como offset em metros ao
// longo de +Y mundo antes de projetar no espaco da luz (ver `alturaEm` e o
// uniform `uNormalBias` mais abaixo).
//
// ── (f) castShadow do mobiliario perto: NAO EDITADO AQUI ───────────────────
// Ver o relatorio final: lista do que deveria voltar a projetar sombra
// propria dentro dos 60 m da cascata 0, para a frente de orcamento decidir.
// Nenhuma linha de props-table.ts, precinct.ts ou mobiliario-urbano.ts foi
// tocada por este modulo.
//
// ── ORCAMENTO (a conta, nao a medida; nenhum fps aqui) ──────────────────────
// VRAM por mapa 2048x2048: cor RGBA8 (4 bytes/texel, alocada mesmo com
// `colorWrite:false`, o `WebGLRenderTarget` sempre tem uma textura de cor) +
// profundidade (`DepthTexture`, ~4 bytes/texel, estimativa, nao medida no
// driver) = ~8 bytes/texel x 2048 x 2048 = 33.554.432 bytes = 32 MB por mapa.
// Hoje: 1 mapa (a luz `sun`) = 32 MB. Com as tres cascatas: cascata 2 segue
// sendo a luz de hoje (32 MB, sem mudanca), mais dois `WebGLRenderTarget`
// manuais (cascatas 0 e 1, 32 MB cada) = 96 MB no total, 64 MB a mais que
// hoje, 1,6% de uma GTX 1650 de 4.096 MB. ZERO luz nova entra nesta conta:
// a unica DirectionalLight da cena continua sendo uma so, exatamente como
// hoje, entao a permutacao de shader de QUALQUER material que este modulo
// nao possui fica INTOCADA. E o item que a rodada anterior errou e esta
// rodada resolve.
//
// Renderizacoes de profundidade por quadro, pior caso (`everyN=1`): 3 (uma
// pela luz de hoje, duas manuais), contra 1 hoje. Caso tipico (`everyN=2`,
// mesmo numero que `governor.shadowEvery` ja usa): cascata 0 todo quadro +
// 1 e 2 a cada dois quadros, media ~2/quadro. Os dois passes manuais usam
// `scene.overrideMaterial` com `MeshBasicMaterial({colorWrite:false})`,
// tecnica mais barata por fragmento que o `MeshDepthMaterial` com
// empacotamento RGBA que o three usa por padrao (nao escreve cor nenhuma,
// so profundidade), mas ainda percorre a MESMA geometria da cena inteira que
// estiver dentro do near/far apertado: nao medido em ms.
//
// ── SOBRE O near/far DA CASCATA 2 ──────────────────────────────────────────
// A cascata 2 usa o MESMO `shadow.camera.near/far` de hoje (500/7000), sem
// mudanca: e a luz de sempre, o coordenador pediu para nao mexer nela. As
// cascatas 0/1 (manuais) usam a janela apertada de 400 m descrita acima, sem
// relacao com esse intervalo.
// ============================================================================

import * as THREE from 'three'

// ── tipos ────────────────────────────────────────────────────────────────

/** a hora corrente, como plaza-scene.tsx ja a calcula (objeto HOURS de la) */
export interface HoraSombra {
  /** graus acima do horizonte; <= 0 desliga a cascata inteira (item d) */
  elevacaoGraus: number
  /** intensidade do sol nesta hora (H.sun); <= 0 tambem desliga */
  intensidade: number
  /** cor do sol nesta hora (H.sunColor) */
  cor: number
}

export interface OpcoesSombraCascata {
  /** texels por lado, mesmo mapa nas tres cascatas (padrao 2048, igual ao plano) */
  mapSize?: number
  /** frustum de profundidade da cascata 2 (a luz real), padrao 500/7000, igual a hoje */
  near?: number
  far?: number
  /** cadencia de atualizacao das cascatas 1 e 2; a 0 atualiza sempre. padrao 2 */
  everyN?: number
  /** azimute do sol, graus (padrao 306, o SUN_AZ de hoje) */
  azimuteGraus?: number
  /** distancia da luz/camera a cena, so afeta o frustum (padrao 3600, igual a hoje) */
  distanciaSol?: number
  /** altura do terreno num ponto, para o decalque nao flutuar nem afundar.
   *  sem isto, cai num plano horizontal em Y=0 (ver cabecalho). */
  alturaEm?: (x: number, z: number) => number
  /** quanto o decalque sobe acima do chao (padrao 0,02 m, o mesmo +2 cm do Bloco C) */
  elevarDecal?: number
  /** o quanto o decalque escurece no maximo, 0..1 (padrao 1 = pode ir a preto) */
  opacidadeMaxima?: number
  /** segmentos da malha de cada decalque (padrao 8 para a cascata 0, 16 para a 1; ver cabecalho) */
  segmentosDecal0?: number
  segmentosDecal1?: number
}

interface CascataProfundidade {
  cam: THREE.OrthographicCamera
  alvoRT: THREE.WebGLRenderTarget
  meiaLargura: number
  texel: number
  quadro: number
  matrizSombra: THREE.Matrix4
}

export interface SombraCascata {
  /** a UNICA luz que ilumina de verdade (cascata 2). mesmo papel do `sun` de hoje. */
  sol: THREE.DirectionalLight
  /** aplica a direcao/cor/intensidade da hora corrente (chamar ao trocar de hora) */
  aplicarHora(h: HoraSombra): void
  /** chamar por quadro, com a camera, o alvo (controls.target) e o renderer atuais */
  atualizar(p: {
    camera: THREE.Camera
    alvo: THREE.Vector3
    renderer: THREE.WebGLRenderer
    /** true durante o voo da visita guiada: nada atualiza, mapa fica congelado */
    congelarTudo?: boolean
    /** true no quadro em que o voo pousa: forca as tres a atualizar uma vez */
    forcarTudo?: boolean
  }): void
  /** cadencia de 1/2 das cascatas 1 e 2; escreva aqui para seguir governor.shadowEvery */
  everyN: number
  dispose(): void
}

// ── as tres meias-larguras, ja explicadas e conferidas no cabecalho ────────
const MEIA_LARGURA: readonly [number, number, number] = [30, 170, 800]

// ── razao bias/normalBias por metro de texel, derivada da unica calibragem
//    documentada no arquivo de hoje (ver cabecalho, item e) ─────────────────
const K_NORMAL_BIAS = 0.15 / 0.29296875 // = 0,512
const K_BIAS = -0.0004 / 0.29296875 // = -0,0013655 (por analogia, NAO MEDIDO)

// janela de profundidade das duas cameras manuais (cascatas 0 e 1), apertada
// em torno do proprio ancora para nao pegar ceu/estrelas/Terra (ver cabecalho)
const MARGEM_PROFUNDIDADE_MANUAL = 400 // metros, para cada lado do ancora

const PADRAO = {
  mapSize: 2048,
  near: 500,
  far: 7000,
  everyN: 2,
  azimuteGraus: 306,
  distanciaSol: 3600,
  elevarDecal: 0.02,
  opacidadeMaxima: 1,
  segmentosDecal0: 8,
  segmentosDecal1: 16,
}

// ── o shader do decalque de contato ─────────────────────────────────────────
// Sampleia o mapa de profundidade CRU (THREE.DepthTexture, sem empacotamento
// RGBA: ver o cabecalho, secao da luz fantasma removida) de UMA cascata e
// escurece por MULTIPLICACAO: onde a cascata viu oclusao, a cor tende a
// preto; onde nao viu, tende a branco (nenhum efeito). A margem da borda
// esvaece o efeito para nenhum, evitando a linha de costura (item b).
const VERTEX_DECAL = /* glsl */ `
  varying vec3 vMundo;
  varying vec2 vLocal;
  void main() {
    vec4 posMundo = modelMatrix * vec4(position, 1.0);
    vMundo = posMundo.xyz;
    vLocal = (uv - 0.5) * 2.0;
    gl_Position = projectionMatrix * viewMatrix * posMundo;
  }
`
const FRAGMENT_DECAL = /* glsl */ `
  uniform sampler2D uMapa;
  uniform mat4 uMatrizSombra;
  uniform vec2 uTexel;
  uniform float uBias;
  uniform float uNormalBias;
  uniform float uOpacidadeMaxima;
  varying vec3 vMundo;
  varying vec2 vLocal;

  float amostraUnica(vec2 uv, float compare) {
    // profundidade CRUA do THREE.DepthTexture, ja em [0,1], sem desempacotar
    float armazenada = texture2D(uMapa, uv).r;
    return step(compare, armazenada);
  }

  void main() {
    // offset ao longo de +Y mundo antes de projetar, equivalente ao
    // normalBias do three (o decalque so existe sobre chao, normal = para cima)
    vec4 alvo = vec4(vMundo + vec3(0.0, uNormalBias, 0.0), 1.0);
    vec4 coordSombra = uMatrizSombra * alvo;
    coordSombra.xyz /= coordSombra.w;
    float compare = coordSombra.z + uBias;

    float aceso = 1.0;
    bool dentro = coordSombra.x >= 0.0 && coordSombra.x <= 1.0 &&
                  coordSombra.y >= 0.0 && coordSombra.y <= 1.0 &&
                  coordSombra.z <= 1.0;
    if (dentro) {
      // PCF de 4 amostras: suave o bastante para o custo de um decalque,
      // sem replicar as 17 amostras do getShadow() do three
      vec2 uv = coordSombra.xy;
      aceso = (
        amostraUnica(uv + vec2(-uTexel.x, -uTexel.y) * 0.5, compare) +
        amostraUnica(uv + vec2( uTexel.x, -uTexel.y) * 0.5, compare) +
        amostraUnica(uv + vec2(-uTexel.x,  uTexel.y) * 0.5, compare) +
        amostraUnica(uv + vec2( uTexel.x,  uTexel.y) * 0.5, compare)
      ) * 0.25;
    }

    // esvaece para "sem efeito" (aceso = 1) perto da borda do quad: e a
    // costura macia do item (b), quadrada porque a caixa e quadrada
    float distBorda = max(abs(vLocal.x), abs(vLocal.y));
    float margem = smoothstep(0.72, 1.0, distBorda);
    aceso = mix(aceso, 1.0, margem);

    float escurecimento = (1.0 - aceso) * uOpacidadeMaxima;
    vec3 cor = mix(vec3(1.0), vec3(0.0), escurecimento);
    gl_FragColor = vec4(cor, 1.0);
  }
`

/** cria a geometria do decalque JA EM TAMANHO REAL (metros), centrada em
 *  (0,0,0), com `segmentos` celulas por lado. Os vertices nascem achatados em
 *  Y=0: quem chama reamostra a altura depois (ver `reamostrarAltura`). */
function criarGeometriaDecal(diametro: number, segmentos: number) {
  const geo = new THREE.PlaneGeometry(diametro, diametro, segmentos, segmentos)
  geo.rotateX(-Math.PI / 2)
  return geo
}

/** reescreve a altura (Y) de cada vertice da malha do decalque a partir de
 *  `alturaEm(x, z)` (ou de um piso fixo, se a funcao nao foi fornecida). O
 *  X e o Z locais dos vertices, apos o `rotateX` em `criarGeometriaDecal`,
 *  ja sao os deslocamentos corretos em metros a partir do ancora. */
function reamostrarAltura(
  geo: THREE.BufferGeometry,
  ancoraX: number,
  ancoraZ: number,
  elevar: number,
  alturaEm?: (x: number, z: number) => number,
) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i)
    const lz = pos.getZ(i)
    const y = (alturaEm ? alturaEm(ancoraX + lx, ancoraZ + lz) : 0) + elevar
    pos.setY(i, y)
  }
  pos.needsUpdate = true
}

function criarDecal(diametro: number, segmentos: number, opacidadeMaxima: number) {
  const geo = criarGeometriaDecal(diametro, segmentos)
  const uniforms = {
    uMapa: { value: null as THREE.Texture | null },
    uMatrizSombra: { value: new THREE.Matrix4() },
    uTexel: { value: new THREE.Vector2() },
    uBias: { value: 0 },
    uNormalBias: { value: 0 },
    uOpacidadeMaxima: { value: opacidadeMaxima },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_DECAL,
    fragmentShader: FRAGMENT_DECAL,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.MultiplyBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    fog: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false // segue a camera todo quadro; nunca vale a pena cortar
  mesh.renderOrder = 5000 // depois do chao opaco, para o depthTest ja ter algo para comparar
  mesh.castShadow = false
  mesh.receiveShadow = false
  return { mesh, uniforms, geo }
}

/** cria uma das duas cameras manuais (cascatas 0 e 1): nunca e adicionada a
 *  `scene`, nunca vira Light. So existe para `renderer.render(scene, cam)`
 *  dentro de um passe de profundidade que este modulo controla a mao. */
function criarCameraManual(meiaLargura: number): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-meiaLargura, meiaLargura, meiaLargura, -meiaLargura, 1, 1)
  cam.up.set(0, 1, 0)
  return cam
}

/**
 * Cria a sombra em tres cascatas e a devolve pronta para entrar na cena. Nao
 * mexe em plaza-scene.tsx: quem chama e quem adiciona `handle.sol` (a luz
 * real) e liga `atualizar()` no loop. Ver o relatorio para as linhas exatas.
 */
export function criarSombraCascata(scene: THREE.Scene, opcoes: OpcoesSombraCascata = {}): SombraCascata {
  const cfg = { ...PADRAO, ...opcoes }

  // ── a UNICA luz da cena (cascata 2), inalterada em relacao a hoje ──────
  const sol = new THREE.DirectionalLight(0xffffff, 0)
  sol.castShadow = true
  sol.visible = true
  sol.shadow.mapSize.set(cfg.mapSize, cfg.mapSize)
  sol.shadow.camera.near = cfg.near
  sol.shadow.camera.far = cfg.far
  sol.shadow.autoUpdate = false
  sol.shadow.needsUpdate = false
  const scSol = sol.shadow.camera as THREE.OrthographicCamera
  scSol.left = -MEIA_LARGURA[2]; scSol.right = MEIA_LARGURA[2]
  scSol.top = MEIA_LARGURA[2]; scSol.bottom = -MEIA_LARGURA[2]
  scSol.updateProjectionMatrix()
  const texelSol = (2 * MEIA_LARGURA[2]) / cfg.mapSize
  sol.shadow.normalBias = K_NORMAL_BIAS * texelSol
  sol.shadow.bias = K_BIAS * texelSol
  scene.add(sol, sol.target)

  // ── as duas cameras manuais (cascatas 0 e 1), NUNCA adicionadas a scene ──
  const criarCascataManual = (indice: 0 | 1): CascataProfundidade => {
    const meiaLargura = MEIA_LARGURA[indice]
    const texel = (2 * meiaLargura) / cfg.mapSize
    const cam = criarCameraManual(meiaLargura)
    cam.near = cfg.distanciaSol - MARGEM_PROFUNDIDADE_MANUAL
    cam.far = cfg.distanciaSol + MARGEM_PROFUNDIDADE_MANUAL
    cam.updateProjectionMatrix()
    const alvoRT = new THREE.WebGLRenderTarget(cfg.mapSize, cfg.mapSize, {
      depthTexture: new THREE.DepthTexture(cfg.mapSize, cfg.mapSize),
      depthBuffer: true,
    })
    return { cam, alvoRT, meiaLargura, texel, quadro: 0, matrizSombra: new THREE.Matrix4() }
  }
  const cascata0 = criarCascataManual(0)
  const cascata1 = criarCascataManual(1)

  // ── material barato do passe de profundidade: nao escreve cor, so Z ─────
  const materialProfundidade = new THREE.MeshBasicMaterial({ colorWrite: false })

  // ── os dois decalques de contato (cascatas 0 e 1), com malha real ───────
  const decal0 = criarDecal(MEIA_LARGURA[0] * 2, cfg.segmentosDecal0, cfg.opacidadeMaxima)
  const decal1 = criarDecal(MEIA_LARGURA[1] * 2, cfg.segmentosDecal1, cfg.opacidadeMaxima)
  decal0.uniforms.uMapa.value = cascata0.alvoRT.depthTexture
  decal0.uniforms.uMatrizSombra.value = cascata0.matrizSombra
  decal0.uniforms.uTexel.value.set(1 / cfg.mapSize, 1 / cfg.mapSize)
  decal0.uniforms.uBias.value = K_BIAS * cascata0.texel
  decal0.uniforms.uNormalBias.value = K_NORMAL_BIAS * cascata0.texel
  decal1.uniforms.uMapa.value = cascata1.alvoRT.depthTexture
  decal1.uniforms.uMatrizSombra.value = cascata1.matrizSombra
  decal1.uniforms.uTexel.value.set(1 / cfg.mapSize, 1 / cfg.mapSize)
  decal1.uniforms.uBias.value = K_BIAS * cascata1.texel
  decal1.uniforms.uNormalBias.value = K_NORMAL_BIAS * cascata1.texel
  scene.add(decal0.mesh, decal1.mesh)

  // ── direcao do sol (recalculada em aplicarHora, igual a hoje) ───────────
  let elevacaoAtual = 44
  let ligado = true
  const sunDir = new THREE.Vector3(0, 1, 0)
  const sunDist = cfg.distanciaSol
  const lightRot = new THREE.Matrix4()
  const lightRotInv = new THREE.Matrix4()
  const recalcularDirecao = () => {
    const a = THREE.MathUtils.degToRad(cfg.azimuteGraus)
    const e = THREE.MathUtils.degToRad(elevacaoAtual)
    sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize()
    lightRot.lookAt(sunDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))
    lightRotInv.copy(lightRot).invert()
  }
  recalcularDirecao()

  const aplicarHora = (h: HoraSombra) => {
    elevacaoAtual = h.elevacaoGraus
    ligado = h.elevacaoGraus > 0 && h.intensidade > 0
    recalcularDirecao()
    sol.color.setHex(h.cor)
    // (d) SOL ABAIXO DO HORIZONTE: cascata 2 apaga por INTENSIDADE (o jeito
    // certo, ver cabecalho); cascatas 0/1 nem sao luz, entao quem as desliga
    // e `ligado`, lido em atualizar() para nao rodar os passes manuais e
    // para esconder os decalques.
    sol.intensity = ligado ? h.intensidade : 0
  }
  aplicarHora({ elevacaoGraus: elevacaoAtual, intensidade: 1, cor: 0xffffff })

  // ── ancora + encaixe em texel (item a), reutilizado pelos tres ──────────
  const ancoraTmp = new THREE.Vector3()
  const calcularAncoraTexel = (alvoMundo: THREE.Vector3, texel: number) => {
    ancoraTmp.copy(alvoMundo).applyMatrix4(lightRotInv)
    ancoraTmp.x = Math.round(ancoraTmp.x / texel) * texel
    ancoraTmp.y = Math.round(ancoraTmp.y / texel) * texel
    ancoraTmp.applyMatrix4(lightRot)
    return ancoraTmp
  }

  const posicionarSol = (alvoMundo: THREE.Vector3) => {
    const ancora = calcularAncoraTexel(alvoMundo, texelSol)
    sol.target.position.copy(ancora)
    sol.position.copy(ancora).addScaledVector(sunDir, sunDist)
  }

  const matrizRemapeio = new THREE.Matrix4().set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0,
  )
  const projScreenTmp = new THREE.Matrix4()
  /** posiciona uma camera manual no ancora encaixado em texel e recalcula a
   *  matriz de sombra dela (a mesma conta que LightShadow.updateMatrices()
   *  faz, replicada aqui porque esta camera nunca pertence a uma Light) */
  const posicionarCascataManual = (c: CascataProfundidade, alvoMundo: THREE.Vector3) => {
    const ancora = calcularAncoraTexel(alvoMundo, c.texel)
    c.cam.position.copy(ancora).addScaledVector(sunDir, sunDist)
    c.cam.lookAt(ancora)
    c.cam.updateMatrixWorld(true)
    projScreenTmp.multiplyMatrices(c.cam.projectionMatrix, c.cam.matrixWorldInverse)
    c.matrizSombra.copy(matrizRemapeio).multiply(projScreenTmp)
  }

  const posDecal = new THREE.Vector3()
  const reposicionarDecal = (mesh: THREE.Mesh, geo: THREE.BufferGeometry, alvoMundo: THREE.Vector3) => {
    posDecal.set(alvoMundo.x, 0, alvoMundo.z)
    mesh.position.copy(posDecal)
    reamostrarAltura(geo, alvoMundo.x, alvoMundo.z, cfg.elevarDecal, cfg.alturaEm)
  }

  /** o passe manual de profundidade de UMA cascata: troca todo material da
   *  cena por um material barato so-profundidade, desenha para o alvo, e
   *  restaura tudo. Os dois decalques ficam invisiveis durante qualquer
   *  passe (ver cabecalho: overrideMaterial desenha tudo que for visivel). */
  const capturarProfundidade = (c: CascataProfundidade, renderer: THREE.WebGLRenderer) => {
    const overrideAnterior = scene.overrideMaterial
    scene.overrideMaterial = materialProfundidade
    renderer.setRenderTarget(c.alvoRT)
    renderer.clear(true, true, true)
    renderer.render(scene, c.cam)
    renderer.setRenderTarget(null)
    scene.overrideMaterial = overrideAnterior
  }

  let primeiraVez = true
  let everyNAtual = cfg.everyN

  const atualizar: SombraCascata['atualizar'] = ({ camera, alvo, renderer, congelarTudo, forcarTudo }) => {
    renderer.shadowMap.autoUpdate = false

    if (congelarTudo && !primeiraVez) {
      renderer.shadowMap.needsUpdate = false
      return
    }

    decal0.mesh.visible = ligado
    decal1.mesh.visible = ligado
    if (!ligado) {
      // (d) sol abaixo do horizonte: nenhum passe roda, os mapas ficam com
      // o ultimo conteudo (irrelevante, ninguem le com os decalques
      // escondidos e o sol com intensidade 0)
      renderer.shadowMap.needsUpdate = false
      primeiraVez = false
      return
    }

    // cascata 0: sempre segue a CAMERA (debaixo dela, nao do alvo)
    posicionarCascataManual(cascata0, camera.position)
    reposicionarDecal(decal0.mesh, decal0.geo, camera.position)

    // cascatas 1 e 2: seguem o ALVO (controls.target), igual a sombra unica de hoje
    posicionarCascataManual(cascata1, alvo)
    posicionarSol(alvo)
    reposicionarDecal(decal1.mesh, decal1.geo, alvo)

    const forcarAgora = forcarTudo || primeiraVez
    const every = Math.max(1, everyNAtual)
    cascata1.quadro = (cascata1.quadro + 1) % every
    const vezDe1e2 = forcarAgora || cascata1.quadro === 0

    // ── os dois passes manuais (nunca tocam renderer.shadowMap) ──────────
    // as duas visibilidades de decalque ja foram decididas acima (ligado);
    // escondo os dois so durante os passes, e restauro antes de sair
    const vis0 = decal0.mesh.visible, vis1 = decal1.mesh.visible
    if (vis0 || vis1) {
      decal0.mesh.visible = false
      decal1.mesh.visible = false
      capturarProfundidade(cascata0, renderer) // (c) cascata 0 sempre por quadro
      if (vezDe1e2) capturarProfundidade(cascata1, renderer)
      decal0.mesh.visible = vis0
      decal1.mesh.visible = vis1
    }

    // ── cascata 2, o unico caminho que ainda usa renderer.shadowMap ──────
    sol.shadow.needsUpdate = vezDe1e2
    renderer.shadowMap.needsUpdate = sol.shadow.needsUpdate
    primeiraVez = false
  }

  const dispose = () => {
    sol.shadow.map?.dispose()
    sol.target.removeFromParent()
    sol.removeFromParent()
    for (const c of [cascata0, cascata1]) c.alvoRT.dispose()
    materialProfundidade.dispose()
    for (const d of [decal0, decal1]) {
      d.geo.dispose()
      ;(d.mesh.material as THREE.Material).dispose()
      d.mesh.removeFromParent()
    }
  }

  const handle: SombraCascata = {
    sol,
    aplicarHora,
    atualizar,
    dispose,
    get everyN() { return everyNAtual },
    set everyN(n: number) { everyNAtual = n },
  }
  return handle
}
