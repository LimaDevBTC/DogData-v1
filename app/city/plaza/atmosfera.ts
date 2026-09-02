// ═══════════════════════════════════════════════════════════════════════════
// A ATMOSFERA CONTIDA: perspectiva aérea dentro da abóbada (só no ?look=2)
//
// O PROBLEMA. A cena não tinha NENHUMA pista de profundidade: um prédio a 500 m
// e uma montanha a 8 km chegavam à câmera com o mesmo contraste e a mesma
// saturação. Isso é fisicamente correto no vácuo e é o que faz a cidade ler
// como maquete chapada. Perspectiva aérea é o recurso mais barato que existe
// para dar escala.
//
// A FICÇÃO. A Lua não segura ar; quem segura é a ABÓBADA. Então a névoa é uma
// propriedade do VOLUME DENTRO DA CASCA, não do planeta: ela vale até a parede
// (DOME_R = 7.050 m), morre logo depois, e o terreno lunar que se estende por
// dezenas de quilômetros lá fora continua nítido e contrastado, como vácuo deve
// ser. O espectador VÊ o ar terminar.
//
// A DOSE É "QUASE SECA, SÓ PROFUNDIDADE". Cinza neutro morno, teto de 15% de
// mistura na parede da abóbada. Não vira Terra, não vira neblina, não tem feixe
// volumétrico. Na dúvida, sutil.
//
// ── COMO ESTÁ FEITO, E POR QUE NÃO É onBeforeCompile ────────────────────────
//
// Névoa por raio precisa de uma varying nova em TODO material. Fazer isso por
// `onBeforeCompile` custa um `customProgramCacheKey` por família de material
// numa cena que já compila 402 programas, e obriga a passar por cada módulo do
// chão (que são de outros donos). O caminho barato é REESCREVER OS CHUNKS de
// névoa do próprio three: a substituição é idêntica para todos os materiais,
// então o número de programas não muda, e nenhum outro arquivo precisa saber
// que a névoa existe. `scene.fog` continua sendo o interruptor oficial: quem
// tem `fog: false` (o padrão só é true) fica de fora sozinho.
//
// ⚠️ AS ESTRELAS E A TERRA SE EXCLUEM SOZINHAS, e isso foi conferido na conta,
// não só no olho: a máscara é o RAIO DE MUNDO do fragmento, as estrelas moram a
// 90.000 m e a Terra a 37.000 m da câmera, ou seja as duas caem fora de AR_R1 e
// recebem máscara zero. O `scene.background` é uma cor, e cor de fundo não passa
// por shader de material: o preto do céu continua preto: 0. Se a névoa acendesse
// o fundo, a cena inteira lavava.
//
// ⚠️ A NÉVOA DO THREE É APLICADA DEPOIS DO TONE MAPPING, e isso é uma armadilha
// de verdade: em `meshphysical_frag` a ordem é tonemapping, colorspace, e SÓ
// ENTÃO fog. Ou seja o `fogColor` (que o three guarda em espaço LINEAR) é
// misturado num pixel que já está em sRGB de tela. Uma névoa "cinza claro"
// 0x9d8f7d guardada como linear vale 0,336 de display, ou seja ela ESCURECIA o
// que devia clarear. Por isso a cor aqui é montada com `setRGB(..., LinearSRGB)`
// com os números que eu quero VER na tela, e não com `setHex`.
//
// ⚠️ E A EXPOSIÇÃO DA HORA NÃO ALCANÇA A NÉVOA, pelo mesmo motivo (ela entra
// depois do tone mapping). Então o brilho da névoa é calculado aqui, como fração
// da irradiância do sol da hora, no mesmo padrão do rebote do regolito.
//
// ⚠️ O GTAO NÃO BRIGA: o raio dele é 0,9 m (ver pos.ts), então ele só escurece
// contato próximo, onde a névoa vale ~0,3%. E o composer roda DEPOIS da cena,
// então a névoa já está dentro do quadro que ele lê.
//
// ⚠️ NÃO MEDI o custo em quadro. O trabalho é uma varying a mais e um `exp` por
// fragmento, sem passe novo, sem material novo, sem chamada de desenho nova.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three'

/** Onde o ar começa a rarefazer: a parede da abóbada (DOME_R em dome.ts). */
export const AR_R0 = 7050
/** Daqui para fora é vácuo duro. A faixa existe para não desenhar um anel. */
export const AR_R1 = 8600

/**
 * ⚠️ TETO DE MISTURA na parede da abóbada. 0,15 sobre um objeto escuro (0,15 de
 * display) leva ele a 0,22, e sobre um claro (0,70) leva a 0,62: comprime o
 * contraste do fundo sem apagar nada. Acima de ~0,25 a leitura vira neblina, que
 * foi recusada nesta rodada.
 */
const TETO = 0.15

/**
 * ⚠️ DENSIDADE. A fórmula do chunk é exponencial SIMPLES (1 - exp(-ρd)), não a
 * exponencial ao quadrado que o three usa por padrão: a versão ao quadrado é
 * quase reta perto da câmera (a 500 m ela dá 1,2% do fator, contra 15,2% da
 * simples) e a perspectiva aérea que interessa aqui é justamente a da faixa de
 * 300 m a 3 km. Com ρ = 3,3e-4 o fator cru vale 0,15 a 500 m, 0,48 a 2 km e 0,90
 * a 7 km; multiplicado pelo teto, 2,3%, 7,2% e 13,5%.
 */
const RHO = 3.3e-4

/** O que a névoa precisa saber da hora (subconjunto de `Hour` em plaza-scene). */
export type HoraDoAr = { sun: number; el: number; sunColor: number; earth: number }

function lumLinear(c: THREE.Color) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

/** Irradiância do sol no CHÃO na hora, o mesmo número que calibra o rebote. */
function irradiancia(H: HoraDoAr) {
  if (H.sun <= 0 || H.el <= 0) return 0
  return H.sun * Math.sin(THREE.MathUtils.degToRad(H.el)) * lumLinear(new THREE.Color(H.sunColor))
}

/** A irradiância da hora `day`, que é a referência de 100% de ar aceso. */
const IRR_REF = 5.4 * Math.sin(THREE.MathUtils.degToRad(44)) * lumLinear(new THREE.Color(0xfff6e8))

/**
 * A cor da névoa da hora, já nos números de DISPLAY (ver a armadilha do tone
 * mapping no cabeçalho).
 *
 * ⚠️ A FAMÍLIA É A DO REBOTE DO REGOLITO (0x9d8f7d no céu do hemisférico,
 * 0xa8927a no direcional), morna e dessaturada. Névoa azul num mundo sem céu
 * azul denuncia na hora: o único azul legítimo aqui é o da Terra, e ele só
 * assume quando o sol está abaixo do horizonte.
 *
 * ⚠️ O BRILHO ANDA COM A RAIZ da fração de irradiância, não com ela mesma. Na
 * `morning` a fração é 0,30, e um ar a 30% de brilho simplesmente não aparece
 * depois que a exposição da hora sobe o resto da imagem; com a raiz ela vira
 * 0,55. Isto é escolha perceptual, não medida.
 */
function corDoAr(H: HoraDoAr): THREE.Color {
  const irr = irradiancia(H)
  if (irr <= 0) {
    // Sem sol quem acende o ar é a Terra: azul, e fraco.
    const k = 0.10 + Math.min(H.earth, 1.2) * 0.06
    return new THREE.Color().setRGB(0.56 * k, 0.66 * k, 0.92 * k, THREE.LinearSRGBColorSpace)
  }
  const k = Math.min(1.1, Math.max(0.12, Math.sqrt(irr / IRR_REF)))
  // cinza morno neutro, na banda do regolito
  return new THREE.Color().setRGB(0.60 * k, 0.575 * k, 0.545 * k, THREE.LinearSRGBColorSpace)
}

let remendado = false

/**
 * Reescreve os quatro chunks de névoa do three: a máscara por raio de mundo e o
 * teto de mistura entram aqui, iguais para todo material, sem programa novo.
 *
 * ⚠️ `transpose()` NÃO EXISTE em GLSL ES 1.00, que é o que o three emite para os
 * materiais embutidos mesmo em contexto WebGL2. A volta da posição de vista para
 * mundo é feita com três `dot` contra as colunas de `viewMatrix`, que é a mesma
 * conta: para R ortonormal, (R^T v)_i = dot(viewMatrix[i].xyz, v).
 *
 * ⚠️ E A CONTA É EM POSIÇÃO DE VISTA, não em `transformed`: `transformed` é
 * local ao objeto e ainda não passou pela `instanceMatrix`, então toda árvore e
 * todo poste instanciado cairia no raio do objeto original, que é zero.
 */
function remendarChunks() {
  if (remendado) return
  remendado = true
  const C = THREE.ShaderChunk as unknown as Record<string, string>

  C.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogAr;
#endif
`

  C.fog_vertex = `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vec3 arV = mvPosition.xyz;
  vec3 arW = cameraPosition + vec3(
    dot( viewMatrix[ 0 ].xyz, arV ),
    dot( viewMatrix[ 1 ].xyz, arV ),
    dot( viewMatrix[ 2 ].xyz, arV ) );
  vFogAr = 1.0 - smoothstep( ${AR_R0.toFixed(1)}, ${AR_R1.toFixed(1)}, length( arW ) );
#endif
`

  C.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogDensity;
  varying float vFogDepth;
  varying float vFogAr;
#endif
`

  C.fog_fragment = `
#ifdef USE_FOG
  float fogFactor = ( 1.0 - exp( - fogDensity * vFogDepth ) ) * vFogAr * ${TETO.toFixed(3)};
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
#endif
`
}

/**
 * Liga a atmosfera contida na cena. Chamar UMA vez, antes do primeiro quadro.
 *
 * O `FogExp2` é escolhido só porque é ele que faz o three declarar o uniform
 * `fogDensity` e o define `USE_FOG`; a fórmula que roda é a do chunk acima.
 */
export function instalarAtmosfera(scene: THREE.Scene, H: HoraDoAr): THREE.FogExp2 {
  remendarChunks()
  const fog = new THREE.FogExp2(0x000000, RHO)
  fog.color.copy(corDoAr(H))
  scene.fog = fog
  return fog
}
