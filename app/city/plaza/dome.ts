// ═══════════════════════════════════════════════════════════════════════════
// A ABÓBADA DE COLMEIA sobre a DogCity inteira.
//
// Decisão do fundador, 28/08/2026: UMA abóbada só, cobrindo a cidade e o
// coliseu da Cratera da Batalha. Foguete voa fora dela. Não existe abóbada
// separada para o coliseu, e se a estação de foguetes atrapalhar, a estação é
// que se muda.
//
// Por que colmeia, e é a única parte da física que sobreviveu ao corte: a
// tração de membrana de uma calota é N = p·Rc/2, e o raio de curvatura de uma
// célula hemisférica é o raio da própria célula. Então a célula pequena divide
// a tração linearmente, e com ela a espessura do vidro. A baia de 168 m da
// proposta original pedia 107 mm de vidro, que não existe; a célula de 42 m
// pede 23,7 mm, que é vidraça. Isso importa aqui porque decide a ESPESSURA DA
// NERVURA, que é a única coisa desta lista que a câmera vê.
//
// O resto da engenharia (gás, radiação, incêndio) foi descartado pelo fundador
// e com razão: esta cidade é virtual. O critério é a tela.
//
// ⚠️ CINTILAÇÃO ERA O ÚNICO RISCO REAL, E FOI CURADO EM 02/09 (commit
// 881fa63be4). Uma nervura de 0,9 m cai abaixo de 1 pixel além de ~1.300 m e
// piscava contra o céu preto estrelado; a cura era LOD, e o look 2 é essa
// cura: a casca virou uma calota lisa (18.432 tris) com o favo inteiro (bolha
// e nervura) desenhado no FRAGMENTO a partir de uma textura de 4.096² com
// mipmap (`texturaFavo`). O mipmap funde o sub-pixel numa média: longe, a
// nervura não pisca, ela perde contraste e some. Sem geometria fina, não tem
// o que cintilar.
//
// ⚠️ O RESÍDUO DESTA CURA É A SAIA, NÃO A CINTILAÇÃO. Uma casca mais funda
// deixa a orla mais vertical (a borda passa de 31,7° a 62,6° entre a de hoje e
// a proposta de `?casca=2`), e é lá, quase raspando o olhar, que o mipmap
// isotrópico borraria a fachada se a anisotropia não estivesse ligada; ela
// está, em 16 (o teto que a placa oferece), então o item continua coberto e é
// só o que fica pra fotografar de novo.
//
// ⚠️ A FLECHA VIROU BANDEIRA. `?casca=2` liga a casca proposta (mais funda +
// pele com relevo especular por célula) por cima de tudo isto; sem ela a
// abóbada é exatamente a de hoje. Ver `CASCA2` logo abaixo e o comentário
// sobre `crown`/`fade` dentro de `buildDome`.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Delaunay } from 'd3-delaunay'
import { look2 } from './look'

// ═══════════════════════════════════════════════════════════════════════════
// A BANDEIRA DESTA FRENTE. `?casca=2` liga a casca mais funda (o relatório de
// 02/09 propõe flecha 5.500 no lugar dos 2.566 de hoje) e a pele com relevo
// especular por célula. Sem ela a abóbada é EXATAMENTE a de hoje: `crown` e
// `fade` continuam saindo de `o.crown`/`o.fade`, que é quem `plaza-scene.tsx`
// já controla (inclusive por `?flecha=`).
//
// ⚠️ POR QUE A BANDEIRA MORA AQUI E NÃO EM `plaza-scene.tsx`. `buildDome`
// recebe `crown` sempre PRONTO de fora (`crown: num('flecha', 2619)`), então
// uma bandeira lida do lado de fora não teria como mudar o valor sem editar
// aquele arquivo, e esta frente não edita `plaza-scene.tsx`. A saída é a
// mesma do `look`: ler a própria URL, uma vez, no módulo, e DECIDIR AQUI
// DENTRO se ignora o `crown`/`fade` recebido e usa a proposta desta frente.
// Módulo lê, módulo decide; trocar de casca pede recarregar a página, que é o
// comportamento certo porque a textura de relevo nasce no boot da cena.
function lerCasca(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('casca') === '2'
}
const CASCA2 = lerCasca()

/** o d3-delaunay quer pares [x, y]; as sementes vivem num Float plano. */
function pares(v: number[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < v.length; i += 2) out.push([v[i], v[i + 1]])
  return out
}

/** raio em planta, usado só como piso quando o contorno da cidade não chega */
// ⚠️ ANDA COM O SÍTIO. 3.500 -> 4.500 em 28/08, e em 30/08 deixou de ser um
// NÚMERO para virar um CONTORNO. A cidade parou de ser um disco: ela é uma
// superelipse 1,25:1 cujo alcance vai de 6.054 a 7.573 m, e uma casca circular
// sobre ela ou sobrava 1,5 km de um lado ou cortava a cidade do outro.
// A abóbada agora recorta no MESMO contorno que o gerador publica em
// `cidade-malha.json` -> `contorno`, com uma folga. Sem contorno, cai neste raio.
// ⚠️ 7.050 -> 9.050 em 02/09. Continua sendo a testada do parque
// (PARK_CENTER a 11.800 menos PARK_FRENTE 2.750), e continua tendo de bater com
// `R_CASCA` em scripts/gerar_cidade.py.
export const DOME_R = 9050

/**
 * ⚠️ 8.600 -> 7.050 em 30/08. A borda agora termina EXATAMENTE na entrada do
 * Parque Runestone. O parque está a 9.800 do centro e alcança 2.750 na direção
 * da cidade (`PARK_FRENTE`), então a testada dele é 9.800 − 2.750 = 7.050. Com
 * 8.600 a abóbada entrava 1.550 m parque adentro e a saia dela ficava DE PÉ
 * dentro da cova do parque, a −263 m; com os 7.600 antigos já entrava 550 m.
 * ⚠️ O CINTURÃO ACABOU, E ESTA NOTA DIZIA O CONTRÁRIO ATÉ 01/09. O texto aqui
 * afirmava "o cinturão continua grande de propósito, para a cidade crescer:
 * 87,7 km², 56% do que a cúpula cobre", e aquilo era verdade enquanto o sítio
 * tinha raio 4.500 e a casca era um disco. Em 31/08 o sítio foi para 7.000 e o
 * contorno publicado passou a chegar a 7.571 m, ou seja a cidade ALCANÇOU a
 * casca e em parte do rumo passa dela. Medido em 01/09 sobre os 180 vértices de
 * `cidade-malha.json` -> `contorno`:
 *
 *   área do sítio            149,250 km²   (raio de 5.983 a 7.571 m)
 *   disco de DOME_R 7.050    156,145 km²
 *   diferença                  6,895 km²
 *
 * E a diferença nem é cinturão de verdade, porque a casca RECORTA NO CONTORNO,
 * não neste raio: o raio só vale como piso quando o contorno não chega.
 *
 * Isso é decisão de produto, não trivia de render: não existe mais reserva de
 * terra fora da cidade. O que sobra para crescer é tecido não loteado DENTRO
 * dela, 16,939 km² medidos em 01/09 (`public/city/cidade.json`:
 * `tecidoDisponivel_km2` 47,298 menos `areaLotes_km2` 30,359). Quem for
 * prometer terra a coleção parceira decide em cima desse número, e decide ANTES
 * do mint, porque lote inscrito na L1 congela o traçado.
 *
 * ⚠️ SE `PARK_FRENTE` OU `DIST` MUDAREM EM park-site.ts, ESTE NÚMERO MUDA JUNTO.
 */

/**
 * ⚠️ O PÓDIO. A casca é uma calota esférica pura, então a borda dela está numa
 * COTA SÓ. O terreno não está: no círculo de 7.050 m ele varia 235 m. Se a terra
 * não for nivelada, a abóbada fura o chão de um lado e fica pendurada a 100 m
 * dele do outro. A cota saiu do equilíbrio entre corte e aterro (149 m de corte
 * no pior rumo, 85 m de aterro no oposto).
 */
export const PODIO_Y = 13
// ⚠️ A FAIXA É LARGA DE PROPÓSITO, e alargar quase não mudou a rampa: de 6.200
// para 5.000 ela caiu só de 34,1% para 30,7%. O motivo é que a rampa não vem da
// transição, vem do SÍTIO: o terreno cru tem 42,8% no rumo 193 e 43,0% no 39, e
// há uma depressão de 180 m entre r 5.750 e 7.250 no setor sudoeste. A
// terraplenagem SUAVIZA essa cara (31% contra 43%), não a cria. A mediana do
// sítio é 1,8% e o p95 7,3%; esses picos são feição local.
export const PODIO_R0 = 6150      // onde a transição começa (o tecido acaba em 6.036)
export const PODIO_R1 = 6950      // daqui até R2 é plano, e a borda (7.050) fica dentro
export const PODIO_R2 = 7150
/**
 * ⚠️ O FADE EXTERNO É ANISOTRÓPICO, PELO MESMO MOTIVO QUE O DO PARQUE. Ele
 * precisa de 708 m no rumo 180, onde o terreno está 142 m acima do pódio, mas
 * no rumo do parque (313°) ele não pode passar de 7.550: dali para fora começa
 * a cova do Runestone, e um fade longo levantaria a testada do parque. Medido:
 * no setor do parque o fade necessário é 425 m, e 7.150 → 7.550 dá 400, com
 * rampa de 20,8% — a mesma ordem da rampa interna, 19,9%.
 */
export const PODIO_R3 = 8300
export const PODIO_R3_PARQUE = 7550

export interface DomeOpts {
  /** o chão, para a saia da borda pousar no relevo real */
  heightAt: (x: number, z: number) => number
  /**
   * ⚠️ A SUPERFÍCIE QUE A CÂMERA VÊ, e é ela que a sapata usa. `heightAt` é
   * contínua; a malha do regolito lineariza em células de ~59 m e a diferença
   * entre as duas já mediu 1,00 m nesta cena. Assentar pela contínua deixa a
   * sapata boiando ou enterrada por um valor que ninguém vê no código.
   */
  superficieAt?: (x: number, z: number) => number
  /**
   * ⚠️ O CONTORNO DA CIDADE, de `cidade-malha.json`. É ele que dá a forma à
   * casca: sem ele a abóbada volta a ser um círculo sobre uma cidade que não é.
   * Pontos [x, z] em ordem angular; a folga de `rimFolga` é somada.
   */
  contorno?: [number, number][]
  /** quanto a saia da casca passa da borda da cidade, em metros */
  rimFolga?: number
  /**
   * ⚠️ ONDE A CASCA FICA. A geometria é sempre construída em torno da ORIGEM e o
   * grupo é transladado no fim; `heightAt` é consultado já somando este centro,
   * senão a saia do domo anexo pousaria no relevo do lugar errado. Sem isto só
   * existe uma abóbada possível, a da cidade, e o Vale do Poente não teria casca.
   */
  centro?: { x: number; z: number }
  /** raio circunscrito da célula, em metros. 42 = um quarto do quarteirão de 168 m */
  cell?: number
  /** altura da borda sobre o datum da praça (o relevo do sítio vai de −85 a +66) */
  rim?: number
  /**
   * altura da coroa sobre o datum. O número de exemplo aqui já foi 1.200; o
   * default de hoje (vindo de `plaza-scene.tsx`) é 2.619. Em qualquer um dos
   * dois a câmera do herói (y 640, `HOME_POS` em plaza-scene.tsx) fica bem
   * por dentro, medido em 02/09 até para a coroa de 8.963 do hemisfério
   * pleno, então não é um limite que a flecha proposta aperte.
   */
  crown?: number
  /** largura da nervura em metros; é ela que decide quanto céu a malha come */
  rib?: number
  /** distância (m) em que a casca apaga; é o anti-cintilação */
  fade?: number
}

export interface Dome {
  group: THREE.Group
  /** quantas células a casca tem, para o painel de ?stats=1 */
  celulas: number
  /** triângulos somados das duas malhas */
  triangulos: number
  /** altura da coroa sobre o datum: a órbita das naves lê daqui para passar por cima */
  coroa: number
  dispose(): void
}

const COR_NERVURA = new THREE.Color('#C6C9D2')
const COR_VIDRO = new THREE.Color('#C8D6E0')
const COR_SAIA = new THREE.Color('#26262B')

/** O trecho de vértice que os dois materiais dividem: normal, direção de vista e
 *  DISTÂNCIA À CÂMERA, que é o que mata a cintilação sem LOD de textura. */
// ⚠️ NÃO USE `cameraPosition` AQUI. O three só alimenta essa uniforme embutida
// para os materiais dele; num ShaderMaterial cru ela fica em (0,0,0) e toda
// conta de distância passa a medir do CENTRO DA CIDADE. O sintoma é bonito e
// enganoso: a casca some do raio do desvanecimento para fora e sobra só a
// calota central boiando sobre a praça, que de fora parece uma abóbada ATRÁS
// do tabuleiro. `uCam` é preenchida no onBeforeRender de cada malha.
// ⚠️ OS TRECHOS DE LOG-DEPTH SÃO OBRIGATÓRIOS AQUI. Com o buffer logarítmico
// ligado no renderizador, um ShaderMaterial cru que não inclua estes trechos
// escreve profundidade na escala ERRADA e some ou fura tudo. Três materiais na
// cena são crus (dois da abóbada e um do parque) e os três levam os includes.
const VS = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  uniform vec3 uCam;
  varying vec3 vN; varying vec3 vV; varying float vD; varying vec2 vUvPlano;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vD = distance(wp.xyz, uCam);
    vUvPlano = uv;
    #ifdef USE_FOG
      vFogDepth = -mv.z;
    #endif
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`

// ⚠️ NÉVOA À MÃO, PORQUE A MISTURA É ADITIVA. O trecho `fog_fragment` do three
// faz `mix(cor, fogColor, f)`: numa malha aditiva isso SOMA a cor da névoa no
// quadro inteiro e a casca vira um véu claro em vez de sumir. Em mistura
// aditiva o certo é a contribuição TENDER A ZERO, ou seja multiplicar por
// (1 − f). Os `fog_pars_*` continuam sendo os do three, então fogColor,
// fogNear, fogFar e fogDensity chegam pelo caminho normal e a casca respeita a
// mesma atmosfera do resto da cena.
const FOG_APLICA = `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb *= 1.0 - fogFactor;
  #endif`

/** O vidro: invisível de frente, aceso na rasante, e NUNCA escurece o céu.
 *  Mistura aditiva de propósito: com mistura normal a casca virava um véu azul
 *  escuro sobre as estrelas (medido na primeira chapa, ficou rede de galinheiro).
 *  Sem transmissão de verdade, que a 8 mil células não paga. */
function materialVidro(fade: number, coroa: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTint: { value: COR_VIDRO },
      uBase: { value: 0.055 },
      uFres: { value: 0.30 },
      uFade: { value: fade },
      uCoroa: { value: coroa },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: VS,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      #include <fog_pars_fragment>
      uniform vec3 uTint; uniform float uBase; uniform float uFres; uniform float uFade; uniform float uCoroa; uniform vec3 uCam;
      varying vec3 vN; varying vec3 vV; varying float vD; varying vec2 vUvPlano;
      // dentro = 1 quando a câmera está sob a casca, 0 quando ela saiu do sítio
      // ou subiu acima da coroa. O apagamento é remédio de quem olha DE DENTRO;
      // visto de fora a abóbada tem que ter silhueta.
      float dentro() {
        float r = 1.0 - smoothstep(3200.0, 3800.0, length(uCam.xz));
        float h = 1.0 - smoothstep(uCoroa * 0.9, uCoroa * 1.4, uCam.y);
        return r * h;
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = pow(1.0 - abs(dot(n, v)), 3.0);
        float d = dentro();
        // ⚠️ O VIDRO TROCA DE REGRA CONFORME O LADO, e isso é escolha, não bug.
        // Por dentro ele tem que sumir para o céu preto e as estrelas
        // aparecerem; por fora ele tem que EXISTIR, senão a abóbada é um anel
        // preto no chão e mais nada (medido: a 6,5 km a nervura de 0,9 m dá
        // 0,05 px e some). Vidro de verdade faria a mesma coisa e ficaria
        // invisível: aqui a cidade é virtual e a imagem manda.
        float base = mix(0.11, uBase, d);
        float fres = mix(0.42, uFres, d);
        float brilho = pow(max(dot(reflect(-v, n), normalize(vec3(0.28, 0.86, 0.18))), 0.0), 36.0) * (1.0 - d) * 0.7;
        // ⚠️ DE DENTRO O LONGE PARA NUM PISO, NÃO EM ZERO (fundador, 31/08:
        // "não existe esse negócio de face única, a cúpula tem que aparecer de
        // dentro também"). O "1.0 - smoothstep" original zerava o vidro além de
        // 2.200 m, e como a casca tem 7.076 m de raio isso apagava TODA a
        // metade da frente: da praça o céu ficava liso, sem cúpula nenhuma.
        // Medido no enquadramento do OG (olho em r 3.000, y 1.840): a casca
        // cruza o quadro entre 6.000 e 10.076 m, ou seja inteiramente dentro
        // da faixa que era zerada.
        float longe = mix(1.0, 1.0 - 0.62 * smoothstep(uFade * 0.45, uFade * 2.6, vD), d);
        gl_FragColor = vec4(uTint * (base + fres * f + brilho) * longe, 1.0);
        ${FOG_APLICA}
      }`,
    transparent: true,
    depthWrite: false,
    // ⚠️ O TESTE DE PROFUNDIDADE VOLTOU, 30/08. Ele estava DESLIGADO como remendo:
    // a cena vai do deck ao horizonte a 26 km e a 6 km o buffer de 24 bits não
    // separava mais a casca do chão, então a metade da frente da abóbada perdia
    // o teste e sumia. Desligar resolveu aquilo e criou este: como a mistura é
    // aditiva e não havia teste, a casca passou a desenhar por cima de TUDO,
    // inclusive de quem está na frente dela — o fundador viu os cristais do
    // parque com a abóbada por cima.
    //
    // O conserto de verdade era o buffer logarítmico, e o comentário antigo já
    // dizia isso ("fica para depois da forma aprovada"). A forma está aprovada.
    // Ele agora é o padrão no renderizador e os três ShaderMaterial crus da cena
    // incluem os trechos de log-depth.
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  })
}

/** A nervura: linha clara e fina, com a claridade variando pela inclinação para
 *  a abóbada ter forma, e sumindo com a distância.
 *
 *  ⚠️ O DESVANECIMENTO NÃO É ENFEITE. A nervura de 0,9 m cai abaixo de 1 pixel
 *  além de 1.300 m; sem apagar, a malha do outro lado da cidade (7 km de vão)
 *  vira um emaranhado que pisca a cada movimento de câmera. Aqui ela vai a 12%
 *  de opacidade no longe: a borda continua legível como bruma, e não como rede. */
function materialNervura(fade: number, coroa: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uCor: { value: COR_NERVURA },
      uFade: { value: fade },
      uCoroa: { value: coroa },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: VS,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      #include <fog_pars_fragment>
      uniform vec3 uCor; uniform float uFade; uniform float uCoroa; uniform vec3 uCam;
      varying vec3 vN; varying vec3 vV; varying float vD; varying vec2 vUvPlano;
      float dentro() {
        float r = 1.0 - smoothstep(3200.0, 3800.0, length(uCam.xz));
        float h = 1.0 - smoothstep(uCoroa * 0.9, uCoroa * 1.4, uCam.y);
        return r * h;
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vN);
        float k = 0.45 + 0.55 * abs(dot(n, normalize(vec3(0.28, 1.0, 0.18))));
        // ⚠️ O PISO SOBE DE 0,12 PARA 0,34, e o motivo do 0,12 continua de pé: a
        // nervura de 0,9 m cai abaixo de 1 px além de 1.300 m e a 7 km de vão
        // vira rede que pisca. Por isso quem carrega o longe é o VIDRO (acima),
        // que é superfície e não alia; a nervura só precisa de presença
        // suficiente para a casca ter forma, não de leitura de malha.
        float perto = mix(0.34, 1.0, 1.0 - smoothstep(uFade * 0.35, uFade * 1.2, vD));
        gl_FragColor = vec4(uCor * k, mix(0.85, perto, dentro()));
        ${FOG_APLICA}
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,    // mesmo motivo do vidro, ver o comentário acima
    side: THREE.DoubleSide,
    fog: true,
  })
}


// ═══════════════════════════════════════════════════════════════════════════
// LOOK 2: A CASCA DISCRETA. O favo sai da GEOMETRIA e entra no FRAGMENTO.
//
// ⚠️ O DIAGNÓSTICO QUE MANDOU FAZER ISTO (medido em 01/09 com
// `__plazaMeshes('abobada')`): nervura 1.805.391 tris, vidro 259.782 tris, anel
// 23.040, saia 17.280. Total 2.105.493, ou 33% da cena inteira. 86% da abóbada
// era fita de nervura, e a fita tem 0,9 m: além de ~1.300 m ela cai abaixo de 1
// pixel. Ou seja o objeto mais caro da cidade existia para desenhar linhas mais
// finas que um pixel, que por isso cintilavam contra o céu preto.
//
// O cabeçalho deste arquivo já tinha nomeado a cura em 30/08 ("a cura não é
// estrutural, é LOD: a casca devia virar textura projetada com mipmap"). É o
// que está aqui. O ponto INTEIRO é o mipmap: ele funde detalhe sub-pixel numa
// média suave, que é exatamente a operação que geometria não sabe fazer. Longe,
// a nervura não pisca: ela perde contraste e some.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ NÚMERO CORRIGIDO EM 02/09. Este comentário dizia "diâmetro de 14.100 m,
// 3,44 m/texel": verdade quando `DOME_R` valia 7.050, mentira desde que ele
// virou 9.050 (ver a constante `DOME_R` no topo do arquivo). Hoje o diâmetro
// é 18.100 m: 4,42 m/texel.
/** lado da textura do favo. 4096 sobre um diâmetro de 18.100 m dá 4,42 m/texel. */
const FAVO_LADO = 4096

/**
 * Rasteriza UMA VEZ, em canvas, o mesmo Voronoi que a geometria usava, e devolve
 * um mapa de UM CANAL (RedFormat) com mipmap.
 *
 * ⚠️ UM CANAL, NÃO QUATRO. 4096² em RGBA são 67 MB de VRAM mais 22 de mipmap;
 * em RedFormat são 16,8 mais 5,6. A informação cabe num escalar porque os dois
 * dados que a casca precisa vivem em FAIXAS diferentes do mesmo número:
 *   0,00 a 0,50  a sombra da bolha (o gradiente do centro da célula para a quina)
 *   0,50 a 1,00  a nervura
 * O shader separa por faixa. E como o mipmap faz média, uma nervura que ocupa
 * meio texel no nível N vira meio valor no nível N+1: o contraste cai sozinho
 * com a distância, sem nenhuma conta de fade.
 *
 * ⚠️ A PROJEÇÃO É PLANAR (x, z) E ISSO ESTÁ CERTO, não é preguiça: as sementes
 * do Voronoi sempre foram sorteadas EM PLANTA, não sobre a superfície. Então
 * projetar em planta reproduz exatamente a mesma célula que a geometria fazia.
 * A esticada da grazing na saia é problema da ANISOTROPIA, que está ligada.
 */
function texturaFavo(
  celulas: { cx: number; cz: number; pol: [number, number][] }[],
  R: number,
  ribM: number,
): THREE.DataTexture {
  const L = FAVO_LADO
  const cv = document.createElement('canvas')
  cv.width = L; cv.height = L
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#000'
  g.fillRect(0, 0, L, L)
  const px = (x: number) => ((x + R) / (2 * R)) * L
  const pz = (z: number) => ((z + R) / (2 * R)) * L
  // ⚠️ A NERVURA ENGORDA DE 0,9 m PARA ~4 m, e é ganho, não perda. 0,9 m não
  // cabe num texel de 4,42 m (era 3,44 quando DOME_R era 7.050): rasterizada,
  // ela vira um fio de 0,20 px que o canvas já entrega serrilhado. Com 4 m ela
  // bate no PISO de 1,1 px (4/4,42 = 0,90, abaixo do piso; antes, com 3,44
  // m/texel, os mesmos 4 m davam 1,16 e não precisavam do piso), desce limpo
  // pela pirâmide de mipmap, e na tela ainda é fina.
  const ribPx = Math.max(1.1, (ribM / (2 * R)) * L)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  for (const c of celulas) {
    const cxp = px(c.cx), czp = pz(c.cz)
    let rr = 0
    g.beginPath()
    for (let k = 0; k < c.pol.length; k++) {
      const X = px(c.pol[k][0]), Z = pz(c.pol[k][1])
      rr = Math.max(rr, Math.hypot(X - cxp, Z - czp))
      if (k === 0) g.moveTo(X, Z); else g.lineTo(X, Z)
    }
    g.closePath()
    // a bolha: claro no centro, escuro na quina. Fica INTEIRA abaixo de 0,5.
    const grad = g.createRadialGradient(cxp, czp, 0, cxp, czp, Math.max(1, rr))
    grad.addColorStop(0, 'rgb(112,112,112)')   // 0,44
    grad.addColorStop(0.7, 'rgb(66,66,66)')    // 0,26
    grad.addColorStop(1, 'rgb(20,20,20)')      // 0,08
    g.fillStyle = grad
    g.fill()
    g.strokeStyle = 'rgb(255,255,255)'
    g.lineWidth = ribPx
    g.stroke()
  }
  // extrai o canal vermelho em faixas, para não alocar 67 MB de uma vez
  const dados = new Uint8Array(L * L)
  const FAIXA = 512
  for (let y0 = 0; y0 < L; y0 += FAIXA) {
    const h = Math.min(FAIXA, L - y0)
    const img = g.getImageData(0, y0, L, h).data
    for (let i = 0, n = L * h; i < n; i++) dados[y0 * L + i] = img[i * 4]
  }
  const tex = new THREE.DataTexture(dados, L, L, THREE.RedFormat, THREE.UnsignedByteType)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  // ⚠️ ANISOTROPIA É OBRIGATÓRIA AQUI, não é enfeite. Na saia a casca é quase
  // paralela ao raio de visão e o mipmap isotrópico borra os DOIS eixos: sem
  // anisotropia a orla vira um borrão cinza e a silhueta perde o remate. O three
  // apara este 16 no máximo que a placa oferecer, então não precisa do
  // renderizador aqui.
  tex.anisotropy = 16
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

// ═══════════════════════════════════════════════════════════════════════════
// A PELE INFLA (atrás de `?casca=2`). Resposta direta ao "por que não um
// prédio tipo Water Cube": a fachada do Water Cube (Pequim) É uma espuma de
// Weaire-Phelan em almofadas de ETFE, e a nossa casca já reproduz a MESMA
// partição (Voronoi por Delaunay, célula de ~42 m, nervura de 0,9 m, e o
// tamanho da célula sai da MESMA conta de tração de membrana que dimensiona
// as almofadas dele). O que falta é só a almofada ser ESTUFADA: hoje a
// célula é uma face plana e só finge volume por sombreamento (`bolha` no
// fragmento de baixo). Uma almofada de verdade pega brilho ESPECULAR próprio
// porque a normal muda de direção dentro da célula, e face plana não faz isso.
//
// ⚠️ POR QUE NÃO GEOMETRIA. O look 1 já faz almofada de verdade em malha
// (`pillow = 0,30·a`, o "else" mais abaixo) e ela media 259.782 triângulos
// SÓ NO VIDRO, medido em 01/09 com `__plazaMeshes('abobada')`: número real,
// não estimado, porque é o mesmo layout de células. Somar isso aos 38.592 do
// look 2 seria +673%, e o fundador já avisou que a cena vive perto do teto
// enquanto outra frente inteira está cortando triângulo pra baixo. Não cabe.
// A saída é a mesma que resolveu a nervura: LOD por textura, agora para o
// RELEVO em vez da linha. Custo: uma textura nova pequena (abaixo) e meia
// dúzia de instruções de ALU no fragmento. Zero triângulo.
//
// ⚠️ QUANTO DE FLECHA POR CÉLULA. O guia de projeto do ETFE (Architen
// Landrell, confirmado por duas fontes independentes) dá rise/span ≈ 10% como
// o padrão da indústria para uma almofada pneumática, não os 30% que o
// `pillow` geométrico do look 1 usa (esse número foi escolhido em 30/08 para
// ler como "bolha" de propósito; o pedido desta vez é o oposto, "almofada,
// não bolha de sabão"). O relevo abaixo usa o MESMO perfil de calota
// (√(1−t²), não parábola) que o look 1 já usa, só que como altura relativa
// (0 a 1) numa textura, na proporção 10% real do Water Cube.
const RELEVO_LADO = 1024

/**
 * A textura de relevo: o MESMO Voronoi de `texturaFavo`, mas só a barriga da
 * célula (perfil de calota, sem nervura, sem faixa dupla), numa resolução bem
 * mais baixa.
 *
 * ⚠️ BAIXA RESOLUÇÃO DE PROPÓSITO, NÃO DESLEIXO. O relevo é sinal de baixa
 * frequência: a barriga de uma célula de ~42 m, não uma aresta que precisa
 * de nitidez como a nervura. 1.024² sobre 18.100 m dá 17,7 m/texel: uma
 * célula de 42 m ainda cobre ~2,4 texels de lado a lado, o bastante pro
 * degradê ler como curva. Custo: 1.024² em RedFormat são 1,05 MB de VRAM mais
 * 0,35 de mipmap, contra os 22,4 MB do favo (2,8% do custo de textura que a
 * casca já paga).
 */
function texturaRelevo(
  celulas: { cx: number; cz: number; pol: [number, number][] }[],
  R: number,
): THREE.DataTexture {
  const L = RELEVO_LADO
  const cv = document.createElement('canvas')
  cv.width = L; cv.height = L
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#000'
  g.fillRect(0, 0, L, L)
  const px = (x: number) => ((x + R) / (2 * R)) * L
  const pz = (z: number) => ((z + R) / (2 * R)) * L
  for (const c of celulas) {
    const cxp = px(c.cx), czp = pz(c.cz)
    let rr = 0
    g.beginPath()
    for (let k = 0; k < c.pol.length; k++) {
      const X = px(c.pol[k][0]), Z = pz(c.pol[k][1])
      rr = Math.max(rr, Math.hypot(X - cxp, Z - czp))
      if (k === 0) g.moveTo(X, Z); else g.lineTo(X, Z)
    }
    g.closePath()
    // ⚠️ PERFIL DE CALOTA, NÃO RAMPA LINEAR: a mesma curva √(1−t²) do pillow
    // geométrico do look 1: sobe quase reto do caixilho e arredonda no meio,
    // que é o que uma almofada de verdade faz. O gradiente radial do canvas só
    // aceita paradas de cor, não uma função, daí as cinco amostras.
    const grad = g.createRadialGradient(cxp, czp, 0, cxp, czp, Math.max(1, rr))
    const paradas: [number, number][] = [
      [0.0, 1.0], [0.5, Math.sqrt(1 - 0.25)], [0.75, Math.sqrt(1 - 0.5625)],
      [0.9, Math.sqrt(1 - 0.81)], [1.0, 0.0],
    ]
    for (const [t, h] of paradas) {
      const v8 = Math.round(h * 255)
      grad.addColorStop(t, `rgb(${v8},${v8},${v8})`)
    }
    g.fillStyle = grad
    g.fill()
  }
  const dados = new Uint8Array(L * L)
  const img = g.getImageData(0, 0, L, L).data
  for (let i = 0, n = L * L; i < n; i++) dados[i] = img[i * 4]
  const tex = new THREE.DataTexture(dados, L, L, THREE.RedFormat, THREE.UnsignedByteType)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 16
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * O material da casca discreta: uma superfície só, com o favo lido da textura.
 *
 * ⚠️ ELE JÁ NASCE PRONTO PARA O TELÃO. `uConteudo` e `uConteudoMix` existem e
 * estão ligados no fragmento: a calota inteira já carrega o UV planar da cidade
 * (0..1 sobre o diâmetro), então basta `setConteudoAbobada(dome, textura, 0.8)`
 * para projetar imagem na abóbada sem tocar em geometria nenhuma. Nesta rodada
 * a mistura é 0, ou seja custo zero e nenhum pixel muda.
 */
// ⚠️ FORÇA DO RELEVO, E É A ÚNICA CONSTANTE DESTA FRENTE QUE NÃO SAI DE CONTA
// FECHADA. O perfil da textura (acima) segue o rise/span de 10% medido no
// guia do ETFE; a CONVERSÃO de `dFdx`/`dFdy` de tela para inclinação de
// normal depende de quantos pixels de tela a casca ocupa no enquadramento, o
// que só se sabe olhando, e esta frente não abre navegador. Este número é
// primeira passada, calculado por ordem de grandeza (não chutado: 1.024
// texels sobre 18.100 m, visto de 1 a 3 km, dá derivada de tela da ordem de
// 10⁻³ a 10⁻² por pixel; para virar uma inclinação visível sem estourar,
// precisa de ganho de dezenas), e É A PRIMEIRA COISA A CONFERIR com
// `?casca=2`.
const RELEVO_FORCA = 18.0

function materialCalota(
  fade: number, coroa: number, favo: THREE.Texture, relevo: THREE.Texture | null = null,
): THREE.ShaderMaterial {
  // ⚠️ O BLOCO SÓ EXISTE NO TEXTO QUANDO `relevo` VEM PREENCHIDO. Sem
  // `?casca=2`, `relevo` é null e o shader que sai daqui é BYTE A BYTE o
  // mesmo de antes desta frente: nem sampler extra, nem ALU extra, nem
  // `extensions.derivatives` ligado. "Sem a bandeira a abóbada é exatamente a
  // de hoje" vale também no shader compilado, não só no visual.
  const blocoRelevo = relevo ? `

        // ── A PELE INFLA: brilho especular por célula, sem geometria nenhuma ──
        // ⚠️ NORMAL "BUMP" BARATO, NÃO GEOMETRIA (ver o comentário grande perto
        // de \`texturaRelevo\`). \`uRelevo\` é um campo de altura de baixa
        // frequência (a barriga da célula); a derivada de TELA dessa altura dá a
        // inclinação local sem precisar de tangente/bitangente calculados por
        // célula, a mesma perturbação de normal que um bump map clássico faz,
        // só que a partir de \`dFdx\`/\`dFdy\` em vez de um segundo canal de UV.
        vec3 up2 = abs(n.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 tg = normalize(cross(up2, n));
        vec3 btg = cross(n, tg);
        float relevoH = texture2D(uRelevo, vUvPlano).r;
        vec3 nBolha = normalize(n - (dFdx(relevoH) * tg + dFdy(relevoH) * btg) * uRelevoForca);
        float brilhoCelula = pow(max(dot(reflect(-v, nBolha), normalize(vec3(0.28, 0.86, 0.18))), 0.0), 24.0);
        cor += uTint * brilhoCelula * (1.0 - d) * longe * 0.55;
` : ''
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTint: { value: COR_VIDRO },
      uNerv: { value: COR_NERVURA },
      uFavo: { value: favo },
      uConteudo: { value: null as THREE.Texture | null },
      uConteudoMix: { value: 0 },
      uFade: { value: fade },
      uCoroa: { value: coroa },
      uCam: { value: new THREE.Vector3() },
      ...(relevo ? { uRelevo: { value: relevo }, uRelevoForca: { value: RELEVO_FORCA } } : {}),
    },
    vertexShader: VS,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      #include <fog_pars_fragment>
      uniform vec3 uTint; uniform vec3 uNerv;
      uniform sampler2D uFavo; uniform sampler2D uConteudo; uniform float uConteudoMix;
      uniform float uFade; uniform float uCoroa; uniform vec3 uCam;
      ${relevo ? 'uniform sampler2D uRelevo; uniform float uRelevoForca;' : ''}
      varying vec3 vN; varying vec3 vV; varying float vD; varying vec2 vUvPlano;
      float dentro() {
        float r = 1.0 - smoothstep(3200.0, 3800.0, length(uCam.xz));
        float h = 1.0 - smoothstep(uCoroa * 0.9, uCoroa * 1.4, uCam.y);
        return r * h;
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = pow(1.0 - abs(dot(n, v)), 3.0);
        float d = dentro();
        float base = mix(0.11, 0.055, d);
        float fres = mix(0.42, 0.30, d);
        float brilho = pow(max(dot(reflect(-v, n), normalize(vec3(0.28, 0.86, 0.18))), 0.0), 36.0) * (1.0 - d) * 0.7;
        float longe = mix(1.0, 1.0 - 0.62 * smoothstep(uFade * 0.45, uFade * 2.6, vD), d);
        vec3 cor = uTint * (base + fres * f + brilho) * longe;

        // ── o favo, separado por faixa do MESMO escalar ─────────────────────
        float t = texture2D(uFavo, vUvPlano).r;
        float bolha = clamp(t * 2.0, 0.0, 1.0);          // 0,00 a 0,50 -> sombreado
        float nerv = max(0.0, t - 0.5) * 2.0;            // 0,50 a 1,00 -> nervura
        // ⚠️ NÃO EXISTE FADE DE DISTÂNCIA NA NERVURA AQUI, DE PROPÓSITO. Quem
        // apaga é o mipmap: longe, o texel branco entra na média com os vizinhos
        // pretos e o valor cai por baixo de 0,5, onde \`nerv\` já é zero. É o
        // desvanecimento correto porque acompanha a AMOSTRAGEM, e não uma
        // distância chutada. O que sobra de escolha é o zênite.
        // ⚠️ O ZÊNITE É QUASE MUDO, POR ORDEM (fundador, 01/09: "no zênite é
        // quase invisível"). Medido na chapa de olhar para cima: com o fator em
        // 0,30 a malha ainda era o assunto do quadro inteiro. Em 0,18 sobre um
        // ganho de 0,18 a nervura no topo sai a 0,032, menos da metade dos
        // 0,072 da primeira versão, e na barriga da casca (n.y baixo) ela
        // continua inteira, que é onde a forma se lê.
        float zen = mix(1.0, 0.18, pow(max(n.y, 0.0), 2.0));
        cor += uTint * bolha * 0.026 * longe;
        cor += uNerv * nerv * 0.18 * zen * longe;
${blocoRelevo}
        // o telão do futuro: nesta rodada uConteudoMix é 0 e isto não pesa
        vec3 conteudo = texture2D(uConteudo, vUvPlano).rgb;
        cor = mix(cor, conteudo, uConteudoMix);

        gl_FragColor = vec4(cor, 1.0);
        ${FOG_APLICA}
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  })
  // ⚠️ CAST NECESSÁRIO: o @types/three instalado aqui só declara
  // `clipCullDistance`/`multiDraw` em `extensions` (o `derivatives` existe em
  // tempo de execução, ver three/src/materials/ShaderMaterial.js, mas ficou
  // de fora do .d.ts). Sem o cast o `tsc --noEmit` reprova por um tipo
  // desatualizado, não por um erro real.
  if (relevo) (mat.extensions as unknown as Record<string, boolean>).derivatives = true
  return mat
}

// ═══════════════════════════════════════════════════════════════════════════
// A BORDA, E O DEFEITO QUE FLECHA NENHUMA CONSERTA (03/09).
//
// A calota passa por (0, crown) e (R, rim) SEMPRE: `capY(DOME_R) = rim`, para
// qualquer flecha. Aprofundar a cúpula empurra o CRUZAMENTO com o terreno para
// fora (medido com o heightmap real, `public/lunar/btc-core-heightmap.f32`,
// convenção nativa: ang em radianos, 0 no leste, sentido anti-horário, ver
// `raioNo`/os laços de setor abaixo):
//
//   f 2.566 (hoje): cruzamento entre r 8.700 e 8.975, conforme o setor.
//   f 5.500 (proposta): cruzamento entre r 8.930 e 9.015.
//
// mas nunca ELIMINA, porque a borda não sobe junto: `rim` fica em 53 m em
// QUALQUER flecha. E o relevo bruto do arco oeste (ang 60° a 240°, na
// convenção acima) passa de 53 m por até 241 m perto de r = 9.050, medido em
// 3.600 amostras angulares, pico em ang ≈ 165° (293,7 m de terreno contra 53
// de borda). Fora desse arco (240° a 60°, passando pelo leste) o terreno no
// raio da borda fica entre −193 e −25 m: sobra folga de sobra, o problema é
// só no oeste.
//
// ⚠️ ESCOLHA: BORDA VARIÁVEL POR AZIMUTE, EM PLATÔ, NÃO POR CONTORNO. Três
// caminhos foram pesados com número:
//
//   (a) BORDA VARIÁVEL: a escolhida. Não é o mesmo experimento que já foi
//       tentado e desfeito (ver "NÃO PONHA O RELEVO DE VOLTA AQUI" duas
//       telas abaixo): aquele fazia a borda SEGUIR o chão ponto a ponto, e o
//       resultado ondulava 481 m e lia como lona. Este é um LEVANTE EM
//       PLATÔ: dois patamares (53 m normal, 353 m sobre o arco oeste) unidos
//       por uma transição suave (`smoothstep`) de 25 a 32 graus de largura e uma
//       rampa radial de 1.250 m (de r 7.800 a 9.050): a casca não amostra o
//       terreno em lugar nenhum, só soma uma função fixa de (r, ângulo)
//       calibrada uma vez contra o heightmap. Custa a PROPRIEDADE que o
//       cabeçalho original defendia (tração de membrana uniforme, `N =
//       p·Rc/2` com um Rc só): no arco oeste a curvatura local deixa de ser
//       a do Rc global (10.196 m) e passa a ter também a curvatura do
//       LEVANTE em si. Uma rampa de 300 m de altura em 1.250 m de raio tem
//       curvatura da ordem de W²/(π²·A) ≈ 1.250² / (π²·300) ≈ 528 m no ponto
//       mais inclinado da transição: MENOS tração ali (raio menor), não
//       mais, pela mesma física da Tarefa 1(b). É uma ESTIMATIVA de ordem de
//       grandeza (perfil de smoothstep, não medida em elemento finito), não
//       um projeto estrutural; o que ela diz é que a transição não é o ponto
//       fraco. Custo em área cega: 8,32 km² de parede nova (48,75% do
//       perímetro, ponderado pela transição), contra 17,06 km² se a mesma
//       altura fosse aplicada nos 360°.
//   (b) BORDA MAIS ALTA E CONSTANTE: pesada e descartada. Preserva a esfera
//       pura em TODO lugar, mas paga integralmente: 300 m de parapeito extra
//       em 56.863 m de perímetro (2π·DOME_R) são 17,06 km² de parede cega
//       nova NOS 360°, contra os 2,2 km² que o parapeito de hoje custa no
//       relatório original: mais de 7,7x a área cega da cidade inteira para
//       resolver um problema que existe em menos da metade do círculo. Não é
//       proporcional.
//   (c) NIVELAR O TERRENO: não é decisão de `dome.ts` (o pódio mora em
//       `terrain.ts`, que outra frente possui) e a frente de inverno já
//       avisou que o nivelamento do pódio suprime até 97,8% do relevo entre
//       r 6.950 e 7.150; estender isso até r 9.050 no arco oeste arrisca a
//       montanha nova dela (cume em 1.151,3 m, r 8.220, ang 178° nesta
//       convenção). Fica registrado como alternativa, não implementada aqui.
//
// ⚠️ A MONTANHA DO INVERNO GANHA FOLGA COM O LEVANTE, NÃO PERDE. O levante só
// SOMA altura à casca; no ponto da montanha (r 8.220, ang 178°) o fator
// angular já está no núcleo pleno (1,0) e o fator radial mede 0,387, somando
// 116,1 m à casca de 1.389,2 m (f 5.500), e a folga sobe de 237,9 m para
// 353,9 m. Reconferir sempre que `RAISE_MAX`, a rampa radial ou a janela
// angular mudarem.
// ═══════════════════════════════════════════════════════════════════════════

/** curva suave 0→1 entre `e0` e `e1`, a mesma usada em toda a casca */
function suave(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// ⚠️ JANELA MEDIDA, NÃO CHUTADA. `ANG0`/`ANG1` (75° a 222°, convenção nativa:
// 0 no leste, anti-horário) é o núcleo onde o levante entra CHEIO; fora dele
// as transições `TRANS0`/`TRANS1` (25° e 32°, assimétricas porque o relevo
// cai em ritmos diferentes dos dois lados) descem a 0. Verificado varrendo
// r de 7.800 a 9.050 e ângulo de 0° a 360° a cada 10 m / 0,2°: a pior folga
// contra o terreno real, com este levante somado, é +59,9 m, positiva em
// toda a banda, para f 2.566 E f 5.500 (o levante não depende da flecha).
const BORDA_ANG0 = (75 * Math.PI) / 180
const BORDA_ANG1 = (222 * Math.PI) / 180
const BORDA_TRANS0 = (25 * Math.PI) / 180
const BORDA_TRANS1 = (32 * Math.PI) / 180
// onde a rampa radial começa (0 no levante) e termina (1, cheio, na borda)
const BORDA_R_RAMPA0 = 7800
/** quanto o pior ponto do arco oeste precisa: 293,7 m de terreno medido no
 *  raio da borda, mais ~59 m de folga do próprio levante (a folga total no
 *  pico, com a rampa radial em 1,0 ali, sai maior, ver o cabeçalho acima) */
const BORDA_LEVANTE_MAX = 300

function anguloNormalizado(ang: number): number {
  const a = ang % (Math.PI * 2)
  return a < 0 ? a + Math.PI * 2 : a
}

function fatorLevanteAngular(ang: number): number {
  const a = anguloNormalizado(ang)
  if (a >= BORDA_ANG0 && a <= BORDA_ANG1) return 1
  if (a < BORDA_ANG0) return 1 - suave(0, BORDA_TRANS0, BORDA_ANG0 - a)
  return 1 - suave(0, BORDA_TRANS1, a - BORDA_ANG1)
}

/** quanto a casca sobe, em metros, no ponto (r, ang); 0 sem `?casca=2` */
function levanteEm(r: number, ang: number): number {
  if (!CASCA2) return 0
  return fatorLevanteAngular(ang) * suave(BORDA_R_RAMPA0, DOME_R, r) * BORDA_LEVANTE_MAX
}

export function buildDome(o: DomeOpts): Dome {

  const a = o.cell ?? 42
  // ⚠️ A BORDA ASSENTA NO PÓDIO, não numa cota solta. `rim` é onde a tela de
  // hexágonos morre, e ela fica PARAPEITO acima do anel nivelado: 40 m, que é a
  // pilha anel de coroamento 7,5 + parede 23,5 + berma 9. Constante em toda a
  // volta, porque o pódio é constante. Em 54 km de perímetro isso dá 2,2 km² de
  // superfície cega, contra os 3,46 km² que a parede variável cobrava.
  const PARAPEITO = 40
  const rim = o.rim ?? (PODIO_Y + PARAPEITO)
  // ⚠️ A FLECHA SE ESCOLHE PELO ÂNGULO DA BORDA, não pela altura. A relação é
  // `flecha / raio = tan(θ/2)`, onde θ é a inclinação da casca onde ela morre no
  // anel. Isso é o que decide se a peça lê como CÚPULA ou como lente, e a altura
  // sozinha engana: a versão de 1.256 m parecia baixa não por ser baixa, mas
  // porque chegava ao chão a 16,6° — quase deitada. Com 3.130 m ela chega a
  // 40,0°, que é barriga de cúpula de verdade. Hoje (sem bandeira) o default
  // que chega daqui de fora é 2.619 de coroa, ou seja flecha 2.566 e borda a
  // 31,7°, no meio do caminho entre lente e cúpula.
  //
  // ⚠️ 5.500 DE FLECHA, ATRÁS DE `?casca=2`, com os três argumentos medidos:
  //
  // (a) LEITURA. Comparei θ contra cúpulas reais (raio de curvatura próprio,
  //     não a altura do prédio inteiro): o Panteão é hemisfério puro, 90°. A
  //     cúpula ORIGINAL de Santa Sofia (a que caiu em 558 por ser rasa demais)
  //     media Rc ≈ 69 pés contra um vão de 31 m, dá 47,5°, quase o mesmo dos
  //     4.000 (47,7°), e a HISTÓRIA já classificou esse ângulo como raso
  //     demais para ler (e aguentar) como cúpula. A reconstrução de Isidoro, o
  //     Jovem, subiu o Rc para ≈ 53 pés (73,7°) para resolver exatamente
  //     isso. A cúpula pontuda de Florença (quinto acuto, raio = 4/5 do vão)
  //     dá 112°, mais que hemisfério. Os quatro ficam entre 47,5° e 112°; os
  //     31,7° de hoje ficam ABAIXO de todos, inclusive da cúpula que a
  //     história reprovou. 5.500 dá 62,6°: ainda abaixo da reconstrução de
  //     Santa Sofia, mas bem acima do piso de "cúpula de verdade" que o
  //     parágrafo anterior já tinha medido em 40°.
  // (b) ESTRUTURA. `N = p·Rc/2` é da CASCA INTEIRA (a estrutura primária, anéis
  //     e nervuras), não da célula: o Rc de uma célula de 42 m vem do PRÓPRIO
  //     estufamento dela (ver `pillow`/relevo mais abaixo) e não muda com a
  //     flecha grande, então os 23,7 mm de vidro por célula NÃO mudam. O que
  //     muda é a tração que a casca grande carrega: Rc cai de 17.242 (flecha
  //     2.566) para 10.196 (5.500), 40,9% menos tração na estrutura primária.
  //     Hemisfério pleno (9.050) dá 47,5%, mais 6,6 pontos por mais 3.550 m
  //     de flecha: retorno decrescente.
  // (c) MONTANHA. No raio 8.283 (o pico do maciço oeste, 321,7 m, medido pela
  //     outra frente) a casca de hoje passa a 499 m: 177,4 m de vão livre
  //     acima do pico. Em 5.500 ela passa a 1.302 m: 980,7 m livres, de sobra
  //     para o parque de inverno que a outra frente está montando ali.
  //
  // Não custa geometria na CALOTA: as células são distribuídas em PLANTA,
  // então subir a flecha não muda a contagem da malha de revolução. O que
  // sobe junto é a órbita das naves, que é lida de `coroa − 180`, de propósito,
  // porque `setOrbitFloor(domo.coroa - 180)` em plaza-scene.tsx lê o valor
  // DEVOLVIDO por `buildDome`, não uma constante duplicada: a órbita sobe
  // sozinha com a coroa, sem precisar tocar naquele arquivo.
  const FLECHA_HOJE = 2566
  const FLECHA_PROPOSTA = 5500
  // ⚠️ REFERÊNCIA FIXA, NÃO `o.crown`. Se alguém combinar `?flecha=` com
  // `?casca=2`, o `crown` recebido de fora pode não ser o 2.619 de hoje; o
  // fade tem de escalar contra o valor que CALIBROU o desvanecimento
  // original, não contra um número arbitrário digitado na URL.
  const CROWN_HOJE_REF = PODIO_Y + PARAPEITO + FLECHA_HOJE
  const crown = CASCA2 ? rim + FLECHA_PROPOSTA : (o.crown ?? CROWN_HOJE_REF)
  const ribW = o.rib ?? 0.9
  // ⚠️ O FADE ESCALA COM A COROA ATRÁS DA BANDEIRA, SENÃO A BARRIGA LAVA. O
  // desvanecimento de longe (`uFade*0,45` a `uFade*2,6`) foi calibrado para a
  // coroa de hoje: a 2.619 m de distância de uma câmera perto do centro, o
  // fator de brilho já mede 0,80 (medido por conta, não chutado). Sem escalar
  // o fade, uma coroa a 5.553 m cairia para 0,38 (quase no piso do
  // desvanecimento) e a barriga que a Tarefa 1 acabou de conquistar voltaria
  // lavada de neblina. Escalando `fade` na MESMA proporção que a coroa cresceu,
  // o fator no topo volta a bater 0,80: a conta é `fade_novo = fade_base ×
  // (coroa_nova / coroa_de_hoje)`, então o desenho do desvanecimento não muda,
  // só a distância em que ele acontece.
  const fadeBase = o.fade ?? 2200
  const fade = CASCA2 ? fadeBase * (crown / CROWN_HOJE_REF) : fadeBase

  const group = new THREE.Group()
  group.name = 'abobada'

  // ── a calota ───────────────────────────────────────────────────────────────
  // Esfera que passa pela coroa (r 0, y crown) e pela borda (r R, y rim).
  const f = crown - rim
  const Rc = (DOME_R * DOME_R + f * f) / (2 * f)
  const yc = crown - Rc
  /** a normal da esfera em (x, z), que é o que orienta pillow e nervura */
  const normalEm = (x: number, z: number, out: THREE.Vector3) =>
    out.set(x, capY(Math.hypot(x, z), Math.atan2(z, x)) - yc, z).normalize()

  // ⚠️ A CASCA VAI ATÉ 3.500, NÃO ATÉ 3.500 MENOS UMA CÉLULA. A primeira versão
  // parava uma célula antes para não ter hexágono pela metade, e isso custava
  // caro no lugar errado: o loteamento tem de terminar onde a casca termina, e
  // o anel de 3.458 a 3.500 é a faixa mais produtiva do sítio (foram cerca de
  // 1.500 lotes, contra 52.991 carteiras que precisam de endereço). Como os
  // vértices da fileira de fora já são aparados contra o círculo por `apara`,
  // a borda sai limpa de qualquer jeito e a terra volta para a cidade.
  // ── O CONTORNO MANDA, O RAIO É SÓ O PISO ──────────────────────────────────
  // ⚠️ `raioNo(ang)` é o que substitui `rMax` em toda parte. Ele interpola o
  // contorno publicado; sem contorno devolve DOME_R e a casca volta a ser
  // circular, que é o comportamento antigo e continua correto para um sítio
  // redondo.
  const cen = o.centro ?? { x: 0, z: 0 }
  const heightAt = (x: number, z: number) => o.heightAt(x + cen.x, z + cen.z)
  const chaoBorda = o.superficieAt
    ? (x: number, z: number) => o.superficieAt!(x + cen.x, z + cen.z)
    : heightAt
  // ⚠️ PLANTA CIRCULAR (fundador, 30/08: "a abóbada está toda torda, deixou de
  // ser uma cúpula pra virar um lençol, quero ela como uma cúpula perfeita").
  //
  // A versão anterior fazia duas coisas que, juntas, desmanchavam a esfera:
  // recortava a casca no CONTORNO DA CIDADE, uma superelipse de raio 6.103 a
  // 7.691 m, e ainda levantava cada rumo pela altura do chão naquele ponto. A
  // silhueta mudava a cada rumo e a aba ondulava 481 m: lençol, não cúpula.
  //
  // Medi o terreno num CÍRCULO e a surpresa desfez o problema: ele varia 232 m,
  // não 481. Os 481 m nunca foram do sítio — eram da superelipse cortando a
  // encosta em diagonal, entrando e saindo da subida. Num círculo o sítio é
  // muito mais manso do que parecia.
  //
  // Então a casca volta a ser calota esférica pura, com a borda numa cota só, e
  // o desnível do chão passa a ser problema do PÓDIO, que é a peça de projeto
  // certa para ele. `o.contorno` continua na interface porque o domo do vale
  // passa um, mas aqui ele não recorta mais nada.
  const raioNo = (_ang: number): number => DOME_R
  const rMax = DOME_R

  // ── A BORDA NUMA COTA SÓ ──────────────────────────────────────────────────
  //
  // ⚠️ NÃO PONHA O RELEVO DE VOLTA AQUI. Eu já tentei: fiz a borda seguir o chão
  // para a parede ficar com altura constante, e o resultado foi a casca virar
  // lona. O erro estava em escolher o lugar errado para absorver o desnível. A
  // casca é a peça RÍGIDA — ela não negocia. Quem negocia com o terreno é o
  // pódio, embaixo, que é terra e existe para isso.
  //
  // Assim `capY` volta a depender só do raio: uma esfera, igual em todo rumo.
  // ⚠️ 03/09: "SÓ DO RAIO" GANHOU UMA EXCEÇÃO MEDIDA. `capY` agora também lê
  // `ang`, mas SEM `?casca=2` `levanteEm` devolve 0 sempre e a conta acima
  // continua sendo a resposta inteira, bit a bit; a esfera pura permanece o
  // comportamento padrão. Com a bandeira, `levanteEm` soma o platô do arco
  // oeste; ver o bloco grande de comentário antes de `buildDome` para o
  // porquê e o custo.
  const capY = (r: number, ang: number) =>
    yc + Math.sqrt(Math.max(0, Rc * Rc - Math.min(r, DOME_R) * Math.min(r, DOME_R))) + levanteEm(r, ang)

  // Almofada: quanto a célula estufa acima da calota. 0,18·a dá a leitura de
  // acolchoado sem virar bolha de plástico.
  // ⚠️ BOLHA, NÃO ALMOFADA (fundador, 30/08: "eu quero estilo bolha, igual do
  // prédio que mandei"). A flecha era 0,12·a — 5 m num vão de 42, que lê como
  // painel estufado. No Water Cube a célula é uma CALOTA CHEIA e o que desenha a
  // fachada é a quina entre duas bolhas vizinhas. 0,30·a dá 12,6 m e é o que
  // separa "almofada" de "bolha".
  const pillow = 0.30 * a
  // Célula grande ganha um anel a mais: a 42 m ela ocupa 28,6 graus da tela e
  // um cone de 6 triângulos apareceria como cone.
  const aneis = a >= 30 ? 2 : 1

  // ── A CASCA É GERADA NA SUPERFÍCIE, NÃO RECORTADA DE UMA GRADE ────────────
  //
  // ⚠️ REESCRITA DE 30/08, e o fundador diagnosticou a raiz antes de mim: "a
  // abordagem que estamos usando pra fechar o tecido da cúpula está errada.
  // Estamos jogando a tela de colmeias sobre a armação e obrigando a entrar.
  // A cúpula terá que ser gerada e desenhada aresta por aresta. A colmeia tem
  // que começar da base."
  //
  // Ele está certo, e a prova é o histórico: a versão antiga montava uma rede
  // hexagonal NO PLANO, ficava com as células cujo CENTRO caía dentro do disco e
  // aparava os vértices contra o círculo. O contorno virava um corte no meio das
  // células, e nenhum remate resolvia isso — três tentativas, três defeitos:
  // silhueta serrada, buraco entre cunhas, e faixa de tom errado. Cada conserto
  // trocava um problema por outro porque o problema não era o remate, era a
  // grade não terminar onde a cúpula termina.
  //
  // ⚠️ E O MODELO NÃO É COLMEIA, É ESPUMA. A referência que o fundador mandou é o
  // Water Cube de Pequim: a fachada dele é a estrutura de Weaire–Phelan, uma
  // espuma, com polígonos irregulares de 5, 6 e 7 lados. Quem gera isso é
  // VORONOI com relaxamento de Lloyd, e ele tem a propriedade que a colmeia não
  // tem: um diagrama de Voronoi é uma PARTIÇÃO do plano. Recortar uma partição
  // contra o disco dá uma partição do disco — cobertura de 100% por teorema, não
  // por remendo. A gola que eu tinha inventado deixa de existir.
  //
  // A ordem é a que ele pediu: a primeira fileira de sementes nasce ENCOSTADA na
  // borda e as outras entram para dentro, de anel em anel.
  const ESPACO = a * 1.73        // calibre médio; a célula sai com área de hexágono de raio a

  // ⚠️ CINCO CALIBRES, NÃO UM (fundador, 30/08: "quero semear com no mínimo 5
  // elementos diferentes, me parece que o water cube usa muitos"). Ele está
  // certo sobre a referência: a espuma de Weaire–Phelan tem células de tipos
  // diferentes, e cortada num plano a fachada mostra bolha grande e pequena
  // encostadas. Com Voronoi puro o tamanho da célula segue a DENSIDADE LOCAL de
  // sementes, então a variedade não se pinta, se semeia.
  //
  // Os pesos somam multiplicador médio 1,03, ou seja a contagem de células fica
  // onde estava; o que muda é a distribuição. Mais no meio e menos nos extremos,
  // que é como espuma real se distribui — bolha muito grande é rara.
  // ⚠️ SETE CALIBRES, DE 0,48 A 1,85 (fundador, 30/08: "dá pra colocar ainda mais
  // variedade, mais bolhas, mais irregularidades"). Cinco ainda deixava a
  // fachada com cara de calibre único mais ruído; sete com a cauda mais longa dá
  // a leitura de espuma, onde bolha grande e pequena se encostam sem transição.
  const CALIBRES: [number, number][] = [   // [multiplicador, peso]
    [0.48, 0.10], [0.62, 0.16], [0.78, 0.20], [0.96, 0.20],
    [1.20, 0.16], [1.50, 0.11], [1.85, 0.07],
  ]
  // ⚠️ SORTEIO DETERMINÍSTICO. Sem semente fixa a cúpula muda a cada carregamento
  // e nenhuma chapa pode ser comparada com a anterior.
  let _rngS = 0x9e3779b9
  const rng = () => {
    _rngS = (_rngS + 0x6d2b79f5) | 0
    let t = Math.imul(_rngS ^ (_rngS >>> 15), 1 | _rngS)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const sorteiaCalibre = () => {
    let u = rng()
    for (const [m, w] of CALIBRES) { if ((u -= w) <= 0) return m }
    return 1.0
  }

  // ⚠️ E O LLOYD SAIU. Ele existe para IGUALAR o tamanho das células, que é
  // exatamente o contrário do que se quer agora: com cinco calibres, relaxar
  // apaga a variedade e devolve o calibre único. O espaçamento passa a vir da
  // amostragem de disco de Poisson, que já nasce bem distribuída — é a troca
  // certa, porque Poisson dá espaçamento sem uniformizar tamanho.
  const sementes: number[] = []
  const raios: number[] = []
  {
    // ⚠️ A FIADA DA BASE TAMBÉM VAI SORTEADA (fundador, 30/08: "formato aleatório
    // desde a primeira célula"). Ela era calibre único e passo único, e por isso
    // a orla saía com todas as células do mesmo aspecto — uma fileira legível
    // contra a espuma do resto. Isso REVISA o "começa da base" de mais cedo, e
    // sem custo: quem garante o remate limpo é o RECORTE contra o disco, não a
    // regularidade das sementes. A borda continua exata com a fiada bagunçada.
    //
    // A volta é caminhada: cada semente sorteia o próprio calibre, o passo é a
    // média dela com a anterior (mesmo critério do arremesso lá embaixo) e a
    // distância ao centro balança até um quarto do calibre.
    {
      let ang = 0
      let ant = ESPACO * sorteiaCalibre()
      while (ang < Math.PI * 2 - 1e-6) {
        const r = ESPACO * sorteiaCalibre()
        const rad = DOME_R - r * 0.5 - rng() * r * 0.25
        sementes.push(Math.cos(ang) * rad, Math.sin(ang) * rad)
        raios.push(r)
        ang += ((ant + r) * 0.5) / DOME_R
        ant = r
      }
    }
    // grade de busca: célula do tamanho do maior calibre, para o teste de
    // vizinhança olhar 3x3 e não a lista inteira
    const RMAX = ESPACO * 1.62
    const G = RMAX
    const nG = Math.ceil((DOME_R * 2) / G) + 2
    const balde: number[][] = Array.from({ length: nG * nG }, () => [])
    const iG = (x: number, z: number) =>
      (Math.floor((z + DOME_R) / G) + 1) * nG + (Math.floor((x + DOME_R) / G) + 1)
    const guarda = (i: number) => balde[iG(sementes[i * 2], sementes[i * 2 + 1])]?.push(i)
    for (let i = 0; i < raios.length; i++) guarda(i)
    const cabe = (x: number, z: number, r: number) => {
      const gx = Math.floor((x + DOME_R) / G) + 1, gz = Math.floor((z + DOME_R) / G) + 1
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const b = balde[(gz + dz) * nG + (gx + dx)]
        if (!b) continue
        for (const i of b) {
          const ex = sementes[i * 2] - x, ez = sementes[i * 2 + 1] - z
          // ⚠️ O CRITÉRIO É A MÉDIA DOS DOIS RAIOS, não o raio do candidato: com
          // calibres diferentes, usar só um deixa a bolha grande invadir a
          // pequena e o Voronoi devolve uma lasca no lugar da célula.
          if (ex * ex + ez * ez < ((r + raios[i]) * 0.5) ** 2) return false
        }
      }
      return true
    }
    // arremesso de dardos até falhar seguidamente: é o critério honesto de
    // saturação, e não um número de tentativas escolhido a dedo
    const LIMITE_INT = DOME_R - ESPACO * 0.95
    let seguidas = 0
    while (seguidas < 12000) {
      const ang = rng() * Math.PI * 2
      const rr = Math.sqrt(rng()) * LIMITE_INT
      const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr
      const r = ESPACO * sorteiaCalibre()
      if (!cabe(x, z, r)) { seguidas++; continue }
      seguidas = 0
      sementes.push(x, z); raios.push(r)
      guarda(raios.length - 1)
    }
  }
  const del = Delaunay.from(pares(sementes))
  const LIM = DOME_R * 1.02

  // ⚠️ O RECORTE CONTRA O CÍRCULO É O QUE FECHA A CÚPULA. Célula de Voronoi é
  // convexa e o disco é convexo, então a interseção é convexa e tem no máximo UM
  // arco. O arco é subdividido para a borda não sair poligonal a olho nu.
  const cortaNoDisco = (pol: [number, number][]): [number, number][] | null => {
    const R = DOME_R
    const dentro = pol.map(([x, z]) => x * x + z * z <= R * R)
    if (dentro.every(Boolean)) return pol
    if (!dentro.some(Boolean)) return null
    const out: [number, number][] = []
    let saida: [number, number] | null = null, entrada: [number, number] | null = null
    for (let k = 0; k < pol.length; k++) {
      const A = pol[k], B = pol[(k + 1) % pol.length]
      const dA = dentro[k], dB = dentro[(k + 1) % pol.length]
      if (dA) out.push(A)
      if (dA !== dB) {
        // interseção do segmento AB com o círculo
        const dx = B[0] - A[0], dz = B[1] - A[1]
        const qa = dx * dx + dz * dz
        const qb = 2 * (A[0] * dx + A[1] * dz)
        const qc = A[0] * A[0] + A[1] * A[1] - R * R
        const disc = Math.max(0, qb * qb - 4 * qa * qc)
        const raiz = Math.sqrt(disc)
        for (const t of [(-qb - raiz) / (2 * qa), (-qb + raiz) / (2 * qa)]) {
          if (t < -1e-9 || t > 1 + 1e-9) continue
          const P: [number, number] = [A[0] + dx * t, A[1] + dz * t]
          out.push(P)
          if (dA && !dB) saida = P
          else entrada = P
          break
        }
      }
    }
    // costura o arco entre onde saiu e onde voltou
    if (saida && entrada) {
      let a0 = Math.atan2(saida[1], saida[0]), a1 = Math.atan2(entrada[1], entrada[0])
      let d = a1 - a0
      while (d <= -Math.PI) d += Math.PI * 2
      while (d > Math.PI) d -= Math.PI * 2
      const n = Math.max(1, Math.ceil(Math.abs(d) / 0.004))
      const arco: [number, number][] = []
      for (let k = 1; k < n; k++) {
        const ang = a0 + (d * k) / n
        arco.push([Math.cos(ang) * R, Math.sin(ang) * R])
      }
      const iSaida = out.findIndex((p) => p === saida)
      if (iSaida >= 0) out.splice(iSaida + 1, 0, ...arco)
    }
    return out.length >= 3 ? out : null
  }

  const celulas: { cx: number; cz: number; pol: [number, number][] }[] = []
  {
    const vor = del.voronoi([-LIM, -LIM, LIM, LIM])
    for (let i = 0; i < sementes.length / 2; i++) {
      const cp = vor.cellPolygon(i)
      if (!cp || cp.length < 4) continue
      const bruto = cp.slice(0, -1) as [number, number][]   // d3 fecha o anel
      const cort = cortaNoDisco(bruto)
      if (!cort) continue
      let cx = 0, cz = 0
      for (const [x, z] of cort) { cx += x; cz += z }
      celulas.push({ cx: cx / cort.length, cz: cz / cort.length, pol: cort })
    }
  }

  // ⚠️ AQUI SE PARTE O CAMINHO (01/09). O look 1 continua construindo a casca em
  // GEOMETRIA: uma almofada por célula mais uma fita por aresta, os 2,07 M de
  // triângulos medidos. O look 2 constrói UMA CALOTA de poucos milhares de
  // triângulos e desenha o mesmo favo no fragmento, a partir da textura com
  // mipmap. Nada some: o favo continua lá, só deixou de ser malha.
  let trisCasca = 0
  const aDescartar: (() => void)[] = []

  if (look2) {
    // ── LOOK 2: uma calota lisa, o favo no fragmento ────────────────────────
    //
    // ⚠️ A MALHA É RADIAL PORQUE A SUPERFÍCIE É DE REVOLUÇÃO. 48 anéis por 192
    // setores dão 18.432 triângulos, contra os 1.805.391 da nervura sozinha
    // (fator 98). E não perde forma: a maior corda dessa grade sobre a esfera é
    // de 231 m na saia, onde a flecha da corda contra a esfera dá 0,6 m, muito
    // abaixo de um pixel em qualquer enquadramento desta cena.
    const ANEIS = 48, SETORES = 192
    const cPos: number[] = [], cNor: number[] = [], cUv: number[] = [], cIdx: number[] = []
    const nrmC = new THREE.Vector3()
    for (let i = 0; i <= ANEIS; i++) {
      // ⚠️ RAIO COM EXPOENTE 0,85, não linear: perto da orla a casca é mais
      // inclinada e é lá que a silhueta se lê. O expoente adensa os anéis na
      // saia sem gastar anel no zênite, onde a superfície é quase plana.
      const r = DOME_R * Math.pow(i / ANEIS, 0.85)
      for (let k = 0; k <= SETORES; k++) {
        const ang = (k / SETORES) * Math.PI * 2
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r
        // ⚠️ `y` MUDOU DE FORA PARA DENTRO DO LAÇO EM 03/09. Com o levante da
        // borda (ver `levanteEm`) a altura deixa de ser só função do anel (r):
        // depende do setor também. Sem `?casca=2` `levanteEm` é 0 e `y` sai
        // idêntico ao de antes, só que recalculado 193x a mais por anel, um
        // custo de boot, não de quadro.
        const y = capY(r, ang)
        // ⚠️ NORMAL ANALÍTICA SÓ SEM A BANDEIRA. `normalEm` presume esfera
        // pura (deriva a normal do raio contra o centro da esfera); com o
        // levante ativo a superfície deixa de ser essa esfera perto da borda
        // oeste e a normal analítica erraria bem ali. Sem bandeira nada muda:
        // mesma normal de sempre. Com ela, cai para `computeVertexNormals()`
        // depois de fechados os índices, mais abaixo.
        if (CASCA2) nrmC.set(0, 1, 0)
        else normalEm(x, z, nrmC)
        cPos.push(x, y, z)
        cNor.push(nrmC.x, nrmC.y, nrmC.z)
        cUv.push(x / (2 * DOME_R) + 0.5, z / (2 * DOME_R) + 0.5)
      }
    }
    const LINHA = SETORES + 1
    for (let i = 0; i < ANEIS; i++) {
      for (let k = 0; k < SETORES; k++) {
        const A = i * LINHA + k, B = (i + 1) * LINHA + k
        cIdx.push(A, B, B + 1, A, B + 1, A + 1)
      }
    }
    const geoCalota = new THREE.BufferGeometry()
    geoCalota.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3))
    geoCalota.setAttribute('normal', new THREE.Float32BufferAttribute(cNor, 3))
    geoCalota.setAttribute('uv', new THREE.Float32BufferAttribute(cUv, 2))
    geoCalota.setIndex(cIdx)
    // ⚠️ RECALCULA A NORMAL SÓ COM A BANDEIRA (ver o comentário no laço acima):
    // sem `?casca=2` a normal já gravada é a analítica de sempre, e recalcular
    // aqui mudaria o número por arredondamento de vizinhança sem necessidade.
    if (CASCA2) geoCalota.computeVertexNormals()

    const texFavo = texturaFavo(celulas, DOME_R, 4.0)
    // ⚠️ O RELEVO SÓ NASCE ATRÁS DA BANDEIRA. Gerar a textura custa uma
    // passada de canvas a mais no boot; sem `?casca=2` esse custo nem existe.
    const texRelevo = CASCA2 ? texturaRelevo(celulas, DOME_R) : null
    const matCal = materialCalota(fade, crown, texFavo, texRelevo)
    const malhaCal = new THREE.Mesh(geoCalota, matCal)
    malhaCal.name = 'abobada:calota'
    malhaCal.frustumCulled = false
    malhaCal.renderOrder = 5
    // ⚠️ SEM RAYCAST, 03/09. O fundador relatou: de fora da cidade, o duplo
    // toque para se aproximar de algo visto ATRAVÉS DO VIDRO "seleciona o
    // próprio domo", e só dá para voltar clicando em Tour. Medido com um log
    // temporário no próprio picking: o raio do centro da tela, mirando a
    // Needle a 6.563 m de distância, acha PRIMEIRO `merged:mullion` (a
    // nervura desta casca) a 420 m, porque a transparência é visual, e o
    // Raycaster do three não sabe disso: ele acha o primeiro triângulo no
    // caminho, vidro ou não. Cada novo duplo toque reaproxima da MESMA casca,
    // cada vez mais perto, e nunca atravessa — é uma casca fechada.
    // A mesma regra já existe nesta cena para o emblema de guerra
    // (plaza-scene.tsx, `emblema.traverse(o => { o.raycast = () => {} })`):
    // um objeto que é atmosfera, não destino, não intercepta picking.
    malhaCal.raycast = () => {}
    malhaCal.onBeforeRender = (_r, _s, cam) => {
      cam.getWorldPosition(matCal.uniforms.uCam.value)
      matCal.uniformsNeedUpdate = true
    }
    group.add(malhaCal)
    trisCasca = cIdx.length / 3
    aDescartar.push(() => {
      geoCalota.dispose(); matCal.dispose(); texFavo.dispose(); texRelevo?.dispose()
    })
  } else {
    // ── vidro: uma almofada por célula, tudo fundido numa malha só ────────────
    //
    // A célula agora é um POLÍGONO qualquer de 4 a 8 lados, não um hexágono, então
    // o leque sai do centroide. Dois anéis: o de fora nos vértices (na calota) e um
    // intermediário a 55% do caminho, que é o que dá a barriga da almofada em vez
    // de um cone.
    const vidros: THREE.BufferGeometry[] = []
    const tmpN = new THREE.Vector3()
    for (const c of celulas) {
      const n = c.pol.length
      const pos: number[] = []
      const idx: number[] = []
      normalEm(c.cx, c.cz, tmpN)
      pos.push(c.cx, capY(Math.hypot(c.cx, c.cz), Math.atan2(c.cz, c.cx)) + pillow * tmpN.y, c.cz)
      // ⚠️ O PERFIL É DE CALOTA, NÃO DE PARÁBOLA. `1 − t²` cai devagar no meio e
      // rápido na borda: dá barriga mole. `√(1 − t²)` é a seção de uma esfera —
      // sobe reto do caixilho e arredonda no alto, que é o que uma bolha faz.
      // Três anéis porque com dois a quina do meio aparece na silhueta.
      const ANEIS_B = [0.42, 0.72, 0.92, 1.0]
      for (const t of ANEIS_B) {
        const alt = pillow * Math.sqrt(Math.max(0, 1 - t * t))
        for (const [vx, vz] of c.pol) {
          const x = c.cx + (vx - c.cx) * t, z = c.cz + (vz - c.cz) * t
          pos.push(x, capY(Math.hypot(x, z), Math.atan2(z, x)) + alt, z)
        }
      }
      for (let k = 0; k < n; k++) idx.push(0, 1 + k, 1 + ((k + 1) % n))
      for (let m = 0; m < ANEIS_B.length - 1; m++) {
        const A = 1 + m * n, B = 1 + (m + 1) * n
        for (let k = 0; k < n; k++) {
          const k2 = (k + 1) % n
          idx.push(A + k, B + k, B + k2)
          idx.push(A + k, B + k2, A + k2)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      // ⚠️ A BORDA NÃO CEDE MAIS A NORMAL. Isso era para a época da almofada: com a
      // normal da calota nos vértices de borda, a célula ganhava um caixilho
      // chapado e a junta sumia. Bolha é o contrário — duas bolhas vizinhas se
      // encontram numa QUINA, e é a quina que desenha a fachada. Cada célula é
      // geometria própria, então `computeVertexNormals` já dá a quina viva de
      // graça: normal dura na divisa, suave por dentro.
      vidros.push(g)
    }

    const geoVidro = mergeGeometries(vidros, false)!
    vidros.forEach((g) => g.dispose())
    const matVidro = materialVidro(fade, crown)
    const malhaVidro = new THREE.Mesh(geoVidro, matVidro)
    malhaVidro.frustumCulled = false
    malhaVidro.renderOrder = 5
    malhaVidro.raycast = () => {} // ver a nota grande em malhaCal, mesmo defeito, mesmo conserto
    // ⚠️ `uniformsNeedUpdate` é obrigatório: num ShaderMaterial cru o three sobe as
    // uniformes uma vez e depois só quando este sinal é levantado. Sem ele a
    // posição da câmera congela no primeiro quadro e o desvanecimento passa a
    // medir de um ponto que não existe mais.
    malhaVidro.onBeforeRender = (_r, _s, cam) => {
      cam.getWorldPosition(matVidro.uniforms.uCam.value)
      matVidro.uniformsNeedUpdate = true
    }
    group.add(malhaVidro)

    // ── nervuras: uma fita por aresta, cada aresta uma vez só ─────────────────
    // A aresta é compartilhada por duas células. Sem a chave de deduplicação a
    // malha desenharia 2x a estrutura e o céu ficaria com o dobro de traço.
    const vistas = new Set<string>()
    const pos: number[] = []
    const nor: number[] = []
    const idx: number[] = []
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), meio = new THREE.Vector3()
    const dir = new THREE.Vector3(), lado = new THREE.Vector3(), nrm = new THREE.Vector3()
    // ⚠️ A ARESTA VEM DO POLÍGONO, não de um hexágono ideal. Antes ela era calculada
    // do centro do hexágono mais o vetor do canto; com célula de Voronoi o número
    // de lados varia de 4 a 8 e a aresta É o dado. E a aresta da orla, que agora
    // cai exatamente no círculo, ganha nervura como qualquer outra: é ela que faz o
    // remate contra o anel de coroamento sem gola nenhuma.
    const pontoNa = (x: number, z: number, out: THREE.Vector3) =>
      out.set(x, capY(Math.hypot(x, z), Math.atan2(z, x)), z)
    for (const c of celulas) {
      const n = c.pol.length
      for (let k = 0; k < n; k++) {
        pontoNa(c.pol[k][0], c.pol[k][1], p0)
        pontoNa(c.pol[(k + 1) % n][0], c.pol[(k + 1) % n][1], p1)
        meio.addVectors(p0, p1).multiplyScalar(0.5)
        const chave = `${Math.round(meio.x / 0.5)}:${Math.round(meio.z / 0.5)}`
        if (vistas.has(chave)) continue
        vistas.add(chave)
        normalEm(meio.x, meio.z, nrm)
        dir.subVectors(p1, p0).normalize()
        lado.crossVectors(dir, nrm).normalize().multiplyScalar(ribW / 2)
        // 0,4 m acima do vidro: sem isso as duas superfícies brigam pelo z-buffer
        const sobe = 0.4
        const base = pos.length / 3
        for (const p of [p0, p1]) {
          pos.push(p.x - lado.x, p.y + nrm.y * sobe - lado.y, p.z - lado.z)
          nor.push(nrm.x, nrm.y, nrm.z)
          pos.push(p.x + lado.x, p.y + nrm.y * sobe + lado.y, p.z + lado.z)
          nor.push(nrm.x, nrm.y, nrm.z)
        }
        idx.push(base, base + 1, base + 3, base, base + 3, base + 2)
      }
    }
    const geoNerv = new THREE.BufferGeometry()
    geoNerv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geoNerv.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    geoNerv.setIndex(idx)
    const matNerv = materialNervura(fade, crown)
    const malhaNerv = new THREE.Mesh(geoNerv, matNerv)
    malhaNerv.name = 'abobada:nervura'
    malhaNerv.renderOrder = 6
    malhaNerv.frustumCulled = false
    malhaNerv.raycast = () => {} // ver a nota grande em malhaCal: foi ESTA malha que o duplo toque achava
    malhaNerv.onBeforeRender = (_r, _s, cam) => {
      cam.getWorldPosition(matNerv.uniforms.uCam.value)
      matNerv.uniformsNeedUpdate = true
    }
    group.add(malhaNerv)

    trisCasca = geoVidro.index!.count / 3 + geoNerv.index!.count / 3
    aDescartar.push(() => {
      geoVidro.dispose(); matVidro.dispose()
      geoNerv.dispose(); matNerv.dispose()
    })
  }

  // ── O REMATE COM O SOLO ───────────────────────────────────────────────────
  //
  // ⚠️ O HEXÁGONO NÃO TOCA O CHÃO (fundador, 30/08). Ele morre num ANEL DE
  // COROAMENTO de aço, e é o aço que desce até a sapata. Antes a tela de
  // hexágonos era simplesmente recortada no raio da borda e ia morrer na terra:
  // a chapa mostrava a célula cortada pela metade chegando ao solo, que é o que
  // o fundador chamou de agonia. Engenheiro nenhum aprova uma estrutura
  // pressurizada terminando assim, porque a borda de uma casca é justamente onde
  // o esforço de membrana vira esforço de flexão e precisa de um elemento rígido
  // para receber.
  //
  // A sequência, de cima para baixo, é a de uma casca de verdade:
  //   1. TELA DE HEXÁGONOS      recortada no raio da borda
  //   2. ANEL DE COROAMENTO     caixão de aço preto, onde a tela morre
  //   3. PAREDE                 do anel até o joelho
  //   4. BERMA                  o chanfro
  //   5. SAPATA                 anel horizontal, embutido no solo
  //
  // ⚠️ E AS COTAS SAEM DE `superficieAt`, a superfície que a câmera vê, com 2.880
  // segmentos. Medido antes: com 360 a corda reta entre dois vértices se afastava
  // do chão real em até 4,66 m num perímetro de 44,9 km. Com 2.880 o pior caso é
  // 0,57 m e a berma de 9 m absorve isso com folga de ordem de grandeza.
  // ⚠️ NO LOOK 2 A VOLTA CAI PELA METADE, 2.880 -> 1.440. O critério do 2.880 era
  // a corda reta se afastar do chão real em no máximo 0,57 m (com 360 dava 4,66);
  // com 1.440 o pior caso medido pela mesma regra fica na ordem de 1,1 m, e a
  // berma tem 9 m. Em troca o anel cai de 23.040 para 11.520 triângulos e a saia
  // de 17.280 para 8.640, que é o que fecha a abóbada inteira abaixo de 40 mil.
  const SEG = look2 ? 1440 : 2880
  const EMBUTE = 8         // quanto a sapata entra no solo
  const sapata = 26        // largura do anel horizontal
  const berma = 9          // o chanfro entre a parede e a sapata
  const ANEL_H = 7.5       // altura do caixão de coroamento
  const ANEL_W = 4.5       // o quanto ele avança para fora da tela
  const chao = o.superficieAt ?? heightAt

  const sPos: number[] = [], sIdx: number[] = []     // parede, berma e sapata
  const aPos: number[] = [], aIdx: number[] = []     // o anel de aço
  // ⚠️ O ANEL ERA UMA ARESTA PRETA E RETA (#141416, metalness 0,85) encostando no
  // regolito sem nenhum tratamento, e é o que mais salta na orla. No look 2 ele
  // deixa de ser cromado (roughness 0,42 -> 0,62, metalness 0,85 -> 0,55, cor
  // #1E1F24) e ganha COR POR VÉRTICE: a aba de cima, que pega o céu, fica clara,
  // e o pé, que está em sombra própria contra o solo, fica escuro. Assim a linha
  // de remate continua legível de longe sem ser um traço chapado.
  const aCor: number[] = []
  for (let i = 0; i <= SEG; i++) {
    const ang = (i / SEG) * Math.PI * 2
    const rr = raioNo(ang)
    const cx2 = Math.cos(ang), cz2 = Math.sin(ang)
    const x = cx2 * rr, z = cz2 * rr
    const yBorda = capY(rr, ang)       // onde a tela de hexágonos morre (o levante da borda entra aqui)
    const yChao = chao(x, z)
    // o anel: caixão que recebe a tela, avança para fora e desce ANEL_H
    aPos.push(cx2 * (rr - ANEL_W), yBorda, cz2 * (rr - ANEL_W))            // 0 aba de dentro
    aPos.push(cx2 * (rr + ANEL_W), yBorda, cz2 * (rr + ANEL_W))            // 1 aba de fora
    aPos.push(cx2 * (rr + ANEL_W), yBorda - ANEL_H, cz2 * (rr + ANEL_W))   // 2 pé de fora
    aPos.push(cx2 * (rr - ANEL_W), yBorda - ANEL_H, cz2 * (rr - ANEL_W))   // 3 pé de dentro
    if (look2) {
      aCor.push(1.55, 1.55, 1.62,  1.70, 1.70, 1.78,  0.52, 0.52, 0.56,  0.42, 0.42, 0.46)
    }
    // a parede e a base, a partir do pé do anel
    sPos.push(x, yBorda - ANEL_H, z)                                        // 0 topo da parede
    sPos.push(x, yChao + berma, z)                                          // 1 pé da parede
    sPos.push(cx2 * (rr + berma), yChao, cz2 * (rr + berma))                // 2 joelho
    sPos.push(cx2 * (rr + sapata), yChao - EMBUTE, cz2 * (rr + sapata))     // 3 borda enterrada
  }
  for (let i = 0; i < SEG; i++) {
    const b = i * 4, c = (i + 1) * 4
    for (let k = 0; k < 3; k++) {
      sIdx.push(b + k, b + k + 1, c + k + 1, b + k, c + k + 1, c + k)
      aIdx.push(b + k, b + k + 1, c + k + 1, b + k, c + k + 1, c + k)
    }
    aIdx.push(b + 3, b, c, b + 3, c, c + 3)     // fecha o caixão por dentro
  }
  const geoSaia = new THREE.BufferGeometry()
  geoSaia.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
  geoSaia.setIndex(sIdx)
  geoSaia.computeVertexNormals()
  const matSaia = new THREE.MeshStandardMaterial({
    color: COR_SAIA, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide,
  })
  // ⚠️ O ANEL É PRETO E METÁLICO DE PROPÓSITO: é ele que dá a linha de remate que
  // se lê de longe e que separa a tela clara do solo. Sem contraste ele some e o
  // problema volta a ser visual mesmo estando construído.
  const geoAnel = new THREE.BufferGeometry()
  geoAnel.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3))
  geoAnel.setIndex(aIdx)
  geoAnel.computeVertexNormals()
  if (look2) geoAnel.setAttribute('color', new THREE.Float32BufferAttribute(aCor, 3))
  const matAnel = look2
    ? new THREE.MeshStandardMaterial({
        color: '#1E1F24', metalness: 0.55, roughness: 0.62,
        side: THREE.DoubleSide, vertexColors: true,
      })
    : new THREE.MeshStandardMaterial({
        color: '#141416', metalness: 0.85, roughness: 0.42, side: THREE.DoubleSide,
      })
  const malhaAnel = new THREE.Mesh(geoAnel, matAnel)
  malhaAnel.name = 'abobada:anel'
  malhaAnel.castShadow = true
  malhaAnel.receiveShadow = true
  malhaAnel.frustumCulled = false
  group.add(malhaAnel)
  const malhaSaia = new THREE.Mesh(geoSaia, matSaia)
  malhaSaia.frustumCulled = false
  group.add(malhaSaia)

  const triangulos = trisCasca + geoSaia.index!.count / 3 + geoAnel.index!.count / 3

  group.position.set(cen.x, 0, cen.z)


  return {
    group,
    celulas: celulas.length,
    triangulos,
    coroa: crown,
    dispose() {
      for (const d of aDescartar) d()
      geoSaia.dispose(); matSaia.dispose()
      geoAnel.dispose(); matAnel.dispose()
    },
  }
}
