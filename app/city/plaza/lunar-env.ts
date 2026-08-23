// ═══════════════════════════════════════════════════════════════════════════════
// O ambiente da praça: a Lua, não um estúdio.
//
// A praça usava `RoomEnvironment` como `scene.environment`, que é uma caixa branca
// com seis luminárias, uma delas de valor 100 pendurada exatamente no zênite. Metal
// sem difusa É SÓ REFLEXO: com aquele mapa, todo latão e todo bronze da praça
// refletiam um teto de estúdio, e o selo do BTC saiu branco por causa disso. A
// compensação era global (`envMapIntensity = 0.32` em tudo que carregava), o que
// escurece o erro sem corrigi-lo: continuava branco, só que mais fraco.
//
// A Lua oferece exatamente três coisas como ambiente, e nada além disso:
//   1. céu PRETO acima do horizonte. Sem atmosfera não há espalhamento, então não
//      há luz de céu, não há halo em volta de nada e não há gradiente azul.
//   2. o quique do REGOLITO abaixo do horizonte, que é a fonte dominante: albedo
//      ~12%, cinza levemente quente, com a surra de oposição no lado anti-solar.
//   3. a TERRA, um disco de ~2°, parada num ponto do céu (a Lua é travada por maré).
//
// Este arquivo desenha isso num equiretangular de 512×256 em meia-precisão e passa
// por `PMREMGenerator.fromEquirectangular`. Nada aqui é aleatório: a praça é
// idêntica em toda visita.
//
// E sai mais barato no boot, que era metade do motivo. Medido numa GTX 1650, sete
// repetições, `gl.finish()` em cada uma:
//   `new RoomEnvironment()` + `fromScene`  →  mediana 23 ms, com picos de 111 e 164
//   `buildLunarEnvironment`                →  mediana 10 ms, faixa 5,5 a 15
// A cauda é o que interessa. O caminho do `fromScene` desenha uma cena de verdade
// seis vezes, o que obriga o driver a compilar o programa de `MeshStandardMaterial`
// antes de qualquer outra coisa da praça existir: na primeira visita, com o cache
// de shader frio, isso mediu 64 ms contra 29 ms daqui. O caminho equiretangular é
// um blit de tela cheia e a cadeia de borrão, e nunca dá pico.
//
// Uso, do lado de quem chama (o dispose é dele):
//     const env = buildLunarEnvironment(renderer, { earthDir: EARTH_DIR, sunDir: SUN_DIR })
//     scene.environment = env
//     ...
//     env.dispose()
// ═══════════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

/**
 * Multiplicador de `envMapIntensity` recomendado para este ambiente.
 *
 * ⚠️ NÃO É O 0,32 ANTIGO AJUSTADO NO OLHO, E TROCAR PELO NÚMERO ERRADO OU APAGA A
 * PRAÇA OU TRAZ O ESTÚDIO DE VOLTA. Medido numa esfera de albedo 1, rugosidade 1,
 * metalness 0, iluminada SÓ pelo `scene.environment` (o termo difuso do IBL, sem
 * tonemap, canal vermelho, GTX 1650):
 *
 *   normal          RoomEnvironment × 0,32   lunar × 1,0   lunar × 0,55
 *   horizontal              0,259               0,557         0,306
 *   para cima               0,514               0,035         0,020
 *   para baixo              0,224               0,910         0,498
 *
 * O que iguala EXATAMENTE o nível de hoje nas verticais é 0,465. O 0,55 é isso
 * mais uma folga: em luminância as verticais ficam ~12% acima de hoje, e essa
 * folga paga o que as superfícies viradas para CIMA perdem, que é o conserto
 * inteiro. Elas caem 28×, porque na Lua não existe luz de céu e o que estava
 * ali era o teto do estúdio. As viradas para baixo dobram, porque na Lua o
 * quique do regolito é a fonte grande e é o que ilumina a barriga das coisas
 * (é o que se vê nas fotos do módulo lunar).
 *
 * Se a praça ainda ficar apagada, ESTA é a única constante a mexer: até 1,0 dá
 * para defender como segundo quique, já que o calçamento e as torres também
 * devolvem luz e este mapa só modela o primeiro. Acima de 1,2 você está
 * reinventando o estúdio, e o selo de latão volta a sair branco.
 */
export const LUNAR_ENV_INTENSITY = 0.55

export interface LunarEnvOptions {
  /** Direção da Terra no céu, normalizada, apontando PARA ela (mesma convenção de `EARTH_DIR` na cena). */
  earthDir?: THREE.Vector3
  /** Matiz do disco da Terra. Só o MATIZ: a magnitude vive nas constantes deste arquivo. */
  earthTint?: number
  /** Matiz do regolito. Idem: só o matiz. O padrão é o `BASE` de `terrain.ts`. */
  groundTint?: number
  /** Direção do sol, normalizada, apontando PARA ele (mesma convenção de `SUN_DIR` na cena). */
  sunDir?: THREE.Vector3
}

// ── o alvo, e por que ele tem este tamanho ─────────────────────────────────────
// ⚠️ A LARGURA AQUI É QUE DEFINE O TAMANHO DO PMREM, não um parâmetro à parte:
// `PMREMGenerator._fromTexture` faz `_setSize(image.width / 4)`. 512 de largura dá
// um cubo de 128, contra os 256 fixos que o `fromScene` do RoomEnvironment usa:
// metade da resolução linear do estúdio, um quarto dos texels na cadeia de borrão.
//
// Por que não 256×128, que seria mais barato ainda: em cubo 64 cada pixel de face
// vale 1,4°, em cubo 128 vale 0,7°. Isso importa para superfície ESPELHADA E PLANA,
// que mapeia direção do ambiente quase 1:1 em ângulo de tela: as lâminas de água
// (rugosidade 0,05) e o `mirrorMat` dos monumentos (0,02) mostrariam o horizonte e
// o disco da Terra em degraus visíveis, e o disco escorregando de posição conforme
// a câmera gira. Em cubo 128 o disco fica com ~13 px de diâmetro e a transição do
// horizonte cabe em quatro linhas em vez de duas.
//
// ⚠️ E NÃO ADIANTA SUBIR PARA 1024. Medido no mesmo aparelho: o PMREM sozinho
// custa 2,8 ms em cubo 64, 3,3 ms em cubo 128 e 3,9 ms em cubo 256, ou seja a
// cadeia de borrão nem é o gargalo. Quem paga é o laço de CPU, que vai de 0,5 ms
// para 2,0 ms para 7,3 ms. Dobrar de novo custa 5 ms de thread principal para
// resolver melhor um ambiente que é liso em quase toda a esfera.
const W = 512
const H = 256

// ── as três coisas, em radiância relativa (chão iluminado = 1) ─────────────────
// ⚠️ ESTES NÚMEROS SÃO RELATIVOS ENTRE SI, DE PROPÓSITO. A escala absoluta mora em
// `LUNAR_ENV_INTENSITY`, num lugar só, onde o ajuste artístico é uma linha. Se
// alguém trocar isto por radiância física do sol da cena, a constante lá em cima
// vira um número sem sentido e o próximo a mexer vai perseguir o fantasma errado.
const SKY = 0.012 // ver a nota do céu abaixo
const EARTH = 6.0 // ver a nota do disco abaixo
const HORIZON_SOFT = 2.5 * (Math.PI / 180) // meia-largura da transição chão/céu
const NADIR_FADE = 0.22 // o chão no nadir é mais escuro que no horizonte
const OPPOSITION = 0.42 // surra de oposição, no lado ANTI-solar

// ⚠️ O DISCO SAI 4,5° EM VEZ DOS 2° REAIS, e isso é deliberado. Em 1° de raio o
// disco ocupa menos de um texel de face e o PMREM o come no primeiro nível de
// borrão: o metal da praça deixaria de refletir a Terra. A energia dele é
// irrelevante de qualquer jeito (o brilho-da-Terra na praça é uma DirectionalLight
// de verdade, não vem daqui), então trocar tamanho correto por estabilidade de
// pixel não custa nada de física e compra o realce especular inteiro.
const EARTH_R = 4.5 * (Math.PI / 180)
const EARTH_SOFT = 1.2 * (Math.PI / 180)

// A Terra de `plaza-scene.tsx`: azimute 243°, elevação 44°, que é onde ela fica
// parada para quem está no norte de Mare Tranquillitatis. Repetido aqui só para o
// arquivo funcionar sozinho; quem chama deve passar o `EARTH_DIR` da cena.
const DEFAULT_EARTH_DIR = new THREE.Vector3(
  Math.sin(THREE.MathUtils.degToRad(243)) * Math.cos(THREE.MathUtils.degToRad(44)),
  Math.sin(THREE.MathUtils.degToRad(44)),
  -Math.cos(THREE.MathUtils.degToRad(243)) * Math.cos(THREE.MathUtils.degToRad(44)),
).normalize()

// O sol da cena, (-2600, 1500, -1900): baixo, 25° de elevação, do noroeste.
const DEFAULT_SUN_DIR = new THREE.Vector3(-2600, 1500, -1900).normalize()

/** Só o matiz interessa: divide pelo canal máximo para o hex não mexer no brilho.
 *  ⚠️ SEM `convertSRGBToLinear` AQUI. `setHex` já entrega no espaço de trabalho
 *  (linear, com `ColorManagement.enabled` ligado, que é o padrão desde a r152).
 *  Converter de novo eleva tudo ao quadrado e o regolito sai escuro e saturado. */
function hueOf(hex: number, out: THREE.Color): THREE.Color {
  out.setHex(hex, THREE.SRGBColorSpace)
  const peak = Math.max(out.r, out.g, out.b, 1e-6)
  return out.multiplyScalar(1 / peak)
}

/**
 * Monta o mapa de ambiente da praça lunar e devolve a textura pronta para
 * `scene.environment`. O dispose é de quem chama.
 */
export function buildLunarEnvironment(renderer: THREE.WebGLRenderer, opts: LunarEnvOptions = {}): THREE.Texture {
  const earthDir = opts.earthDir ? opts.earthDir.clone().normalize() : DEFAULT_EARTH_DIR
  const sunDir = opts.sunDir ? opts.sunDir.clone().normalize() : DEFAULT_SUN_DIR

  // O padrão do chão é o mesmo `#3f3d3a` que `terrain.ts` usa como base do
  // regolito: o ambiente tem que ter a cor do chão que ele representa, senão a
  // praça e o reflexo da praça discordam. O da Terra é o mesmo `0x8fb0ff` da luz
  // de brilho-da-Terra, pela mesma razão.
  const tmp = new THREE.Color()
  const ground = hueOf(opts.groundTint ?? 0x3f3d3a, tmp).clone()
  const earth = hueOf(opts.earthTint ?? 0x8fb0ff, tmp).clone()
  // ⚠️ O CÉU NÃO É ZERO, e não é física, é conta de renderizador. Zero exato deixa
  // toda superfície lisa virada para cima com reflexo preto puro, que o olho lê
  // como buraco ou material faltando, e a praça tem vidro. 1,2% do chão é escuro
  // o bastante para ninguém chamar de céu e claro o bastante para o vidro existir.
  const sky = new THREE.Color(0.85, 0.90, 1.0).multiplyScalar(SKY)

  // ── preenchimento ────────────────────────────────────────────────────────────
  // ⚠️ MEIA-PRECISÃO, NÃO CANVAS 2D E NÃO FLOAT32. Canvas obriga a passar por sRGB
  // de 8 bits, que não representa o disco da Terra acima de 1 e ainda exige um
  // `document`; medido, o caminho por canvas também é mais LENTO (2,6 ms contra
  // 2,0 ms em 512×256) por causa da conversão gama por texel. Float32 resolveria,
  // mas amostrar RGBA32F com filtro linear depende de `OES_texture_float_linear`,
  // que falta em boa parte do parque de celulares; RGBA16F é filtrável no núcleo
  // do WebGL2. Meia-precisão é o único dos três que é rápido, HDR e portátil.
  const data = new Uint16Array(W * H * 4)
  const ONE = THREE.DataUtils.toHalfFloat(1)

  // atan2/cos/sin por texel seriam 260 mil chamadas de trigonometria; por coluna
  // são 512. O resto do laço é aritmética.
  const cosPhi = new Float32Array(W)
  const sinPhi = new Float32Array(W)
  for (let x = 0; x < W; x++) {
    const phi = ((x + 0.5) / W - 0.5) * Math.PI * 2 // `equirectUv`: u = atan2(z, x) / 2π + 0,5
    cosPhi[x] = Math.cos(phi)
    sinPhi[x] = Math.sin(phi)
  }

  let i = 0
  for (let y = 0; y < H; y++) {
    // ⚠️ A LINHA 0 DA MEMÓRIA É O NADIR, NÃO O ZÊNITE. `DataTexture` nasce com
    // `flipY = false` (ao contrário de toda textura de imagem), então v = 0 é a
    // primeira linha do array, e `equirectUv` faz v = asin(dir.y)/π + 0,5. Quem
    // copiar este laço para um canvas 2D tem que inverter, ou a praça fica de
    // cabeça para baixo com o regolito no céu.
    const v = (y + 0.5) / H
    const el = (v - 0.5) * Math.PI
    const dy = Math.sin(el)
    const ce = Math.cos(el)

    // O chão é o hemisfério de baixo. A borda é suave em 2,5° porque um degrau de
    // um texel no nível 0 do PMREM vira uma linha dura no reflexo dos espelhos.
    // Comparar `sin(el)` com um limiar em radianos é ângulo pequeno de propósito,
    // não confusão de unidade: a 2,5° o erro é de 0,03%.
    const below = THREE.MathUtils.smootherstep(-dy, -HORIZON_SOFT, HORIZON_SOFT)
    // Um plano lambertiano tem radiância uniforme, mas o que se vê perto dos pés
    // é a própria sombra do observador e o calçamento; o horizonte é regolito
    // limpo. Escurecer o nadir é o que faz o chão ler como chão e não como caixa.
    const groundLevel = below * (1 - NADIR_FADE * Math.max(0, -dy))

    for (let x = 0; x < W; x++) {
      const dx = ce * cosPhi[x]
      const dz = ce * sinPhi[x]

      // ⚠️ O REALCE VAI NO LADO OPOSTO AO SOL, E ISSO NÃO É ENGANO DE SINAL. O
      // regolito é retroespalhador: é a surra de oposição, a mesma que faz a lua
      // cheia ser desproporcionalmente mais brilhante que a meia-lua. Olhando na
      // direção do sol você vê a face SOMBREADA de cada grão e cada cratera;
      // olhando para o ponto anti-solar, nenhuma sombra é visível e o chão
      // acende. Quem "consertar" isto para o lado do sol inverte o efeito mais
      // reconhecível que a Lua tem, e as fotos da Apollo mostram o certo.
      const anti = -(dx * sunDir.x + dy * sunDir.y + dz * sunDir.z)
      const surge = anti > 0 ? 1 + OPPOSITION * anti * anti : 1
      const g = groundLevel * surge

      let r = sky.r + ground.r * g
      let gg = sky.g + ground.g * g
      let b = sky.b + ground.b * g

      // A Terra. Comparação de cossenos em vez de `acos`, que é caro e não muda
      // nada: `smootherstep` na borda cobre a serrilha.
      const cd = dx * earthDir.x + dy * earthDir.y + dz * earthDir.z
      if (cd > Math.cos(EARTH_R + EARTH_SOFT)) {
        // ⚠️ SEM HALO EM VOLTA DO DISCO. Halo é espalhamento atmosférico, que é
        // exatamente o que a Lua não tem e o motivo deste arquivo existir. A
        // borda é suave na largura de um texel e acabou.
        const t = THREE.MathUtils.smootherstep(cd, Math.cos(EARTH_R + EARTH_SOFT), Math.cos(EARTH_R))
        // ⚠️ O DISCO É REALCE ESPECULAR, NÃO FONTE DE LUZ. A cena já tem uma
        // DirectionalLight de brilho-da-Terra: o que faltava era o metal ter o
        // que refletir. O 6× sai da razão de radiância medida em albedo, 0,30 da
        // Terra contra 0,12 do regolito visto sob um sol a 25° de elevação
        // (0,30 / (0,12 · sen 25°) ≈ 5,9), então é o contraste que a Lua tem de
        // verdade entre o disco azul e o chão, e não um número de gosto.
        const k = EARTH * t
        r += earth.r * k
        gg += earth.g * k
        b += earth.b * k
      }

      data[i++] = THREE.DataUtils.toHalfFloat(r)
      data[i++] = THREE.DataUtils.toHalfFloat(gg)
      data[i++] = THREE.DataUtils.toHalfFloat(b)
      data[i++] = ONE
    }
  }

  const src = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType)
  src.mapping = THREE.EquirectangularReflectionMapping
  src.colorSpace = THREE.LinearSRGBColorSpace
  // ⚠️ `DataTexture` nasce com filtro NEAREST nos dois lados. Sem estas duas
  // linhas o borrão do PMREM parte de um equiretangular em degraus e o horizonte
  // vira escada nos reflexos. E o `wrapS` tem que repetir: o equiretangular fecha
  // em u = 0 = 1, e com clamp aparece uma costura vertical no meio do céu.
  src.magFilter = THREE.LinearFilter
  src.minFilter = THREE.LinearFilter
  src.wrapS = THREE.RepeatWrapping
  src.wrapT = THREE.ClampToEdgeWrapping
  src.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  const rt = pmrem.fromEquirectangular(src)
  // A fonte já virou o cubo borrado: nada aqui sobrevive ao boot.
  src.dispose()
  pmrem.dispose()

  // ⚠️ O PMREM DEVOLVE UM RENDER TARGET, E O CONTRATO DAQUI É UMA TEXTURA. Quem
  // chama só tem como chamar `texture.dispose()`, que libera a textura da GPU mas
  // deixa o framebuffer do alvo pendurado. Amarrar o dispose do alvo ao da textura
  // fecha o buraco sem vazar o tipo para fora. Não há recursão: o handler do
  // renderer para render target não chama `dispose` na textura de novo.
  const texture = rt.texture
  texture.addEventListener('dispose', () => rt.dispose())
  return texture
}
