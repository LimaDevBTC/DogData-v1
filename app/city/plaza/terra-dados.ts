// ═══════════════════════════════════════════════════════════════════════════
// OS DADOS DA TERRA, vistos da cidade. Matemática pura, sem three e sem rede.
//
// ⚠️ É TUDO NÚMERO DE VERDADE, e essa é a única razão de o painel existir. Um
// painel de nave com número inventado é adereço; com efeméride real ele é a
// mesma coisa que o resto do DogData faz com a cadeia: mostrar o que está lá.
//
// ⚠️ PRECISÃO DECLARADA: as séries abaixo são as de baixa precisão do Meeus
// (Astronomical Algorithms, cap. 47), truncadas nos termos grandes. A distância
// fica dentro de ~200 km em 384.400, que é 0,05%, e a fase dentro de ~1%. Para
// um painel que mostra três casas isso é folga; para navegar, não serve, e não
// é para isso que ele está aqui.
//
// ⚠️ O SÍTIO É O DO PROJETO, não um genérico: Mare Tranquillitatis norte,
// 25° N, 40° E, o mesmo que `plaza-scene` usa para pôr a Terra no céu.
// ═══════════════════════════════════════════════════════════════════════════

/** o sítio da cidade, em coordenada selenográfica */
export const SITIO = { lat: 25.0, lon: 40.0, nome: 'Mare Tranquillitatis' }

/** mês sinódico, em dias: o ciclo dia/noite da cidade */
export const SINODICO = 29.530588853

const rad = (g: number) => (g * Math.PI) / 180
const graus = (r: number) => (r * 180) / Math.PI
/** normaliza para 0..360 */
const n360 = (g: number) => ((g % 360) + 360) % 360

/** dia juliano a partir do relógio */
export function julianDay(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5
}

interface Angulos {
  /** elongação média da Lua: 0 na lua nova, 180 na cheia */
  D: number
  /** anomalia média do Sol */
  M: number
  /** anomalia média da Lua */
  Ml: number
  /** argumento da latitude */
  F: number
}

function angulos(jd: number): Angulos {
  const T = (jd - 2451545) / 36525
  return {
    D: n360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T),
    M: n360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T),
    Ml: n360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T),
    F: n360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T),
  }
}

/**
 * A distância Terra-Lua, em km.
 *
 * ⚠️ ELA VARIA 13%, e é por isso que vale mostrar: 356.500 km no perigeu e
 * 406.700 no apogeu. Um painel que imprime "384.400" fixo está imprimindo uma
 * média e chamando de medida.
 */
export function distanciaKm(jd: number): number {
  const { D, M, Ml, F } = angulos(jd)
  const d = rad(D), m = rad(M), ml = rad(Ml), f = rad(F)
  const soma =
    -20905355 * Math.cos(ml) -
    3699111 * Math.cos(2 * d - ml) -
    2955968 * Math.cos(2 * d) -
    569925 * Math.cos(2 * ml) +
    48888 * Math.cos(m) -
    3149 * Math.cos(2 * f) +
    246158 * Math.cos(2 * d - 2 * ml) -
    152138 * Math.cos(2 * d - m - ml) -
    170733 * Math.cos(2 * d + ml) -
    204586 * Math.cos(2 * d - m) -
    129620 * Math.cos(m - ml) +
    108743 * Math.cos(d) +
    104755 * Math.cos(m + ml)
  return 385000.56 + soma / 1000
}

/** a fração iluminada da LUA vista da Terra, 0 a 1 */
export function faseLua(jd: number): number {
  const { D } = angulos(jd)
  return (1 - Math.cos(rad(D))) / 2
}

/**
 * A longitude selenográfica do ponto subsolar.
 *
 * ⚠️ A ÂNCORA É A LUA CHEIA: nela a face inteira está iluminada, logo o Sol
 * está a pino sobre a longitude 0. Daí sai `180 - D`, e daí sai todo o resto
 * (elevação do Sol no sítio, e portanto o dia e a noite da cidade).
 */
export function longitudeSubsolar(jd: number): number {
  const { D } = angulos(jd)
  return n360(180 - D)
}

/** a elevação do Sol no sítio, em graus (negativo = noite lunar) */
export function elevacaoSol(jd: number, lat = SITIO.lat, lon = SITIO.lon): number {
  const ls = longitudeSubsolar(jd)
  let dl = n360(lon - ls)
  if (dl > 180) dl -= 360
  return graus(Math.asin(Math.cos(rad(lat)) * Math.cos(rad(dl))))
}

/**
 * Quanto falta, em dias, para o Sol cruzar o horizonte do sítio.
 *
 * ⚠️ POR BUSCA, NÃO POR FÓRMULA FECHADA, de propósito: a elevação depende de
 * `longitudeSubsolar`, que já embute as irregularidades da série. Inverter isso
 * à mão erraria horas; varrer em passos de 6 h e refinar por bisseção erra
 * minutos e cabe em vinte linhas.
 */
export function proximoCruzamento(jd: number): { dias: number; nascendo: boolean } {
  const e0 = elevacaoSol(jd)
  const passo = 0.25
  let a = jd
  for (let k = 1; k <= 4 * SINODICO * 4; k++) {
    const b = jd + k * passo
    const eb = elevacaoSol(b)
    if ((e0 >= 0) !== (eb >= 0)) {
      let lo = a, hi = b
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2
        if ((elevacaoSol(m) >= 0) === (e0 >= 0)) lo = m
        else hi = m
      }
      return { dias: (lo + hi) / 2 - jd, nascendo: e0 < 0 }
    }
    a = b
  }
  return { dias: NaN, nascendo: e0 < 0 }
}

export interface DadosTerra {
  distancia_km: number
  atraso_s: number
  diametro_grau: number
  fase_terra: number
  crescente: boolean
  sol_elevacao: number
  dia: boolean
  cruzamento_dias: number
  cruzamento_nascendo: boolean
  utc: string
  local: string
}

const RAIO_TERRA = 6371.0
const LUZ = 299792.458

export function dadosTerra(agora = new Date()): DadosTerra {
  const jd = julianDay(agora)
  const d = distanciaKm(jd)
  const kLua = faseLua(jd)
  // ⚠️ A FASE DA TERRA É O COMPLEMENTO DA FASE DA LUA, e isso não é analogia, é
  // geometria: o hemisfério que o Sol não acende aqui é o que ele acende lá.
  // Consequência que vale para o projeto inteiro: quando a nossa cidade entra na
  // noite, a Terra está CHEIA sobre ela.
  const kTerra = 1 - kLua
  const sol = elevacaoSol(jd)
  const cruz = proximoCruzamento(jd)
  const amanha = faseLua(jd + 0.5)
  return {
    distancia_km: d,
    atraso_s: d / LUZ,
    diametro_grau: 2 * graus(Math.atan(RAIO_TERRA / d)),
    fase_terra: kTerra,
    crescente: amanha < kLua,
    sol_elevacao: sol,
    dia: sol >= 0,
    cruzamento_dias: cruz.dias,
    cruzamento_nascendo: cruz.nascendo,
    utc: agora.toISOString().slice(11, 19),
    local: agora.toTimeString().slice(0, 8),
  }
}

/** "4d 11h" a partir de dias decimais */
export function dur(dias: number): string {
  if (!isFinite(dias)) return '--'
  const d = Math.floor(dias)
  const h = Math.round((dias - d) * 24)
  return h === 24 ? `${d + 1}d 00h` : `${d}d ${String(h).padStart(2, '0')}h`
}
