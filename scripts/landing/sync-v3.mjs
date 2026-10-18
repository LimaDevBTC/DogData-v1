#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SINCRONIZA A MÍDIA E O DADO DA LANDING v3 (/dogcity) PARA DENTRO DO REPO.
//
//   node scripts/landing/sync-v3.mjs [--src ../landing-v3] [--carta] [--sem-t8]
//
// As outras frentes entregam em `landing-v3/` (fora do repo); este script copia
// só o que o site serve, confere a forma de cada coisa e escreve o manifesto
// que a página lê no build (app/dogcity/landing/media-manifest.json). O que não
// existir fica fora do manifesto, e a página cai no fallback limpo. Nunca
// inventa arquivo.
//
//   deeds/   <nn>-<nome>_{1200,2400}.webp + deeds.json  ->  public/landing/v3/deeds/
//            (os .svg de 1,3 MB NÃO sobem: o site serve só os WebP)
//   data/    lot_info.json                              ->  data/dogcity_lot_info.json
//            (só servidor: /api/dogcity/lookup e /api/dogcity/lot; nunca no bundle)
//   video/   ver VIDEO abaixo                           ->  public/landing/v3/video/
//   --carta  a carta colorida SEM moldura, rótulos e legenda, de public/city/carta-v10.svg
//            ->  public/landing/v3/map/city-plan_{2400,1200}.webp (fundo da busca)
//
// Rodar de novo é seguro: sobrescreve com os mesmos nomes.
// ═══════════════════════════════════════════════════════════════════════════
import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const SRC = path.resolve(RAIZ, arg('--src', '../landing-v3'))
const FAZ_CARTA = args.includes('--carta')
const SEM_T8 = args.includes('--sem-t8')   // a subida T8 só entra se casar com a carta

const PUB = path.join(RAIZ, 'public/landing/v3')
const MANIFESTO = path.join(RAIZ, 'app/dogcity/landing/media-manifest.json')
const log = (...a) => console.log('[sync-v3]', ...a)
const kb = (n) => `${Math.round(n / 1024)} KB`

async function copia(de, para) {
  await fs.mkdir(path.dirname(para), { recursive: true })
  await fs.copyFile(de, para)
  const st = await fs.stat(para)
  return st.size
}

const manifesto = existsSync(MANIFESTO) ? JSON.parse(await fs.readFile(MANIFESTO, 'utf8')) : {}

// ── 1. escrituras ──────────────────────────────────────────────────────────
const GRUPOS = new Set(['tiers-1-3', 'tiers-4-6', 'tiers-7-13', 'company', 'reserve', 'example'])
const dDeeds = path.join(SRC, 'deeds')
if (existsSync(path.join(dDeeds, 'deeds.json'))) {
  const j = JSON.parse(await fs.readFile(path.join(dDeeds, 'deeds.json'), 'utf8'))
  if (!Array.isArray(j.deeds)) throw new Error('deeds.json sem deeds[]')
  const ok = []
  for (const d of j.deeds) {
    for (const k of ['arquivo', 'lot_id', 'grupo', 'tier', 'area_m2', 'distrito']) {
      if (d[k] === undefined) throw new Error(`deeds.json: ${d.lot_id ?? '?'} sem ${k}`)
    }
    if (!GRUPOS.has(d.grupo)) throw new Error(`deeds.json: grupo desconhecido ${d.grupo}`)
    if (!/^S\d\d-Q\d\d-B\d{4}-L\d{3}$/.test(d.lot_id)) throw new Error(`deeds.json: lot_id estranho ${d.lot_id}`)
    let tam = 0
    for (const w of [1200, 2400]) {
      const f = path.join(dDeeds, `${d.arquivo}_${w}.webp`)
      if (!existsSync(f)) throw new Error(`falta ${f}`)
      tam += await copia(f, path.join(PUB, 'deeds', `${d.arquivo}_${w}.webp`))
    }
    ok.push(d)
    log('escritura', d.arquivo, d.lot_id, kb(tam))
  }
  await copia(path.join(dDeeds, 'deeds.json'), path.join(PUB, 'deeds', 'deeds.json'))
  manifesto.deeds = { count: ok.length }
} else log('sem landing-v3/deeds/deeds.json: a galeria fica no espécime publicado')

// ── 2. dado da busca ───────────────────────────────────────────────────────
const fLot = path.join(SRC, 'data', 'lot_info.json')
if (existsSync(fLot)) {
  const j = JSON.parse(await fs.readFile(fLot, 'utf8'))
  const campos = j.campos?.join(',')
  if (campos !== 'tier,distrito,area_m2,rua_frente,acesso,frente_da_para') throw new Error(`lot_info.json: campos inesperados ${campos}`)
  const n = Object.keys(j.lote ?? {}).length
  if (n < 70000) throw new Error(`lot_info.json: só ${n} lotes`)
  const tam = await copia(fLot, path.join(RAIZ, 'data', 'dogcity_lot_info.json'))
  log('lot_info', n, 'lotes', kb(tam))
} else log('sem landing-v3/data/lot_info.json: a busca sai sem tier e sem rua')

// ── 3. vídeo ───────────────────────────────────────────────────────────────
// Nomes esperados em landing-v3/video/ (o LEIAME.md de lá manda se divergir):
//   hero-desktop.webm / hero-desktop.mp4    16:9, 1920x1080, laço do herói
//   hero-mobile.webm  / hero-mobile.mp4     9:16, 720x1280
//   poster-desktop.{avif,webp,jpg}          1º quadro de T1, 16:9
//   poster-mobile.{avif,webp,jpg}           1º quadro de T1, 9:16
//   cuts.json                               [{ "t": segundos, "place": "SATOSHI PLAZA" }, ...]
//   t8/desktop/NNN.webp, t8/mobile/NNN.webp a subida até a carta (72 e 48 quadros)
//   places/<slug>.{webm,mp4} + places/<slug>.{webp,jpg}   laços de 4 s dos lugares
const dVid = path.join(SRC, 'video')
if (existsSync(dVid)) {
  const v = {}
  const pega = async (nome, chave) => {
    const f = path.join(dVid, nome)
    if (!existsSync(f)) return
    const t = await copia(f, path.join(PUB, 'video', nome))
    v[chave] = `/landing/v3/video/${nome}`
    log('vídeo', nome, kb(t))
  }
  for (const s of ['desktop', 'mobile']) {
    await pega(`hero-${s}.webm`, `hero_${s}_webm`)
    await pega(`hero-${s}.mp4`, `hero_${s}_mp4`)
    for (const e of ['avif', 'webp', 'jpg']) await pega(`poster-${s}.${e}`, `poster_${s}_${e}`)
  }
  if (existsSync(path.join(dVid, 'cuts.json'))) {
    v.cuts = JSON.parse(await fs.readFile(path.join(dVid, 'cuts.json'), 'utf8'))
  }
  for (const s of ['desktop', 'mobile']) {
    const d = path.join(dVid, 't8', s)
    if (!existsSync(d)) continue
    const fs8 = (await fs.readdir(d)).filter((f) => /^\d+\.webp$/.test(f)).sort()
    for (const f of fs8) await copia(path.join(d, f), path.join(PUB, 'video', 't8', s, f))
    v[`t8_${s}`] = { count: fs8.length, pad: fs8[0]?.replace('.webp', '').length ?? 3 }
    log('t8', s, fs8.length, 'quadros')
  }
  // ── o layout que a frente do filme entregou em 18/10 (video/LEIAME.md manda):
  //   hero/hero-intro-{1920x1080,720x1280}.{webm,mp4}   T1, só a 1ª reprodução
  //   hero/hero-loop-{1920x1080,720x1280}.{webm,mp4}    o laço T2 a T6
  //   hero/poster-intro-{1920x1080,1080x1920}.{avif,webp}  1º quadro de T1 (o LCP)
  //   hero/hero-loop-marcacoes.json                     { marcacoes: [{ t, lugar }] }
  //   map-rise/t8-{desktop-1600,celular-720}/quadro-NNN.webp
  //   cartoes/<slug>-720x1280.{webm,mp4}                laços de 4 s dos lugares
  const pegaDe = async (rel, nome, chave) => {
    const f = path.join(dVid, rel)
    if (!existsSync(f)) return
    const t = await copia(f, path.join(PUB, 'video', nome))
    v[chave] = `/landing/v3/video/${nome}`
    log('vídeo', rel, '->', nome, kb(t))
  }
  if (existsSync(path.join(dVid, 'hero'))) {
    for (const [s, dim] of [['desktop', '1920x1080'], ['mobile', '720x1280']]) {
      for (const e of ['webm', 'mp4']) {
        await pegaDe(`hero/hero-loop-${dim}.${e}`, `hero-${s}.${e}`, `hero_${s}_${e}`)
        await pegaDe(`hero/hero-intro-${dim}.${e}`, `intro-${s}.${e}`, `intro_${s}_${e}`)
      }
    }
    for (const [s, dim] of [['desktop', '1920x1080'], ['mobile', '1080x1920']]) {
      for (const e of ['avif', 'webp']) await pegaDe(`hero/poster-intro-${dim}.${e}`, `poster-${s}.${e}`, `poster_${s}_${e}`)
    }
    const fm = path.join(dVid, 'hero', 'hero-loop-marcacoes.json')
    if (existsSync(fm)) {
      const m = JSON.parse(await fs.readFile(fm, 'utf8'))
      // a última marcação é a fusão de volta ao começo (nota), não um take novo
      v.cuts = m.marcacoes.filter((x) => !x.nota).map((x) => ({ t: x.t, place: x.lugar }))
      log('cortes', v.cuts.map((c) => `${c.t}s ${c.place}`).join(' | '))
    }
  }
  if (!SEM_T8) {
    for (const [s, pasta] of [['desktop', 't8-desktop-1600'], ['mobile', 't8-celular-720']]) {
      const d = path.join(dVid, 'map-rise', pasta)
      if (!existsSync(d)) continue
      const qs = (await fs.readdir(d)).filter((f) => /^quadro-\d+\.webp$/.test(f)).sort()
      for (const f of qs) await copia(path.join(d, f), path.join(PUB, 'video', 't8', s, f.replace('quadro-', '')))
      v[`t8_${s}`] = { count: qs.length, pad: qs[0]?.replace('quadro-', '').replace('.webp', '').length ?? 3 }
      log('t8', s, qs.length, 'quadros (map-rise)')
    }
  }
  const dC = path.join(dVid, 'cartoes')
  if (existsSync(dC)) {
    const { execFileSync } = await import('node:child_process')
    v.places ??= {}
    // só os lugares que a landing imprime ($DOG ARENA não entra, decisão de 18/10)
    for (const slug of ['satoshi-plaza', 'the-bay', 'the-spit', 'spaceport']) {
      for (const e of ['webm', 'mp4']) {
        const f = path.join(dC, `${slug}-720x1280.${e}`)
        if (!existsSync(f)) continue
        await copia(f, path.join(PUB, 'video', 'places', `${slug}.${e}`))
        v.places[slug] ??= {}
        v.places[slug][e] = `/landing/v3/video/places/${slug}.${e}`
      }
      // o pôster do cartão é o 1º quadro do laço (o cartão parado mostra o lugar)
      const mp4 = path.join(PUB, 'video', 'places', `${slug}.mp4`)
      if (v.places[slug]?.mp4 && existsSync(mp4)) {
        const out = path.join(PUB, 'video', 'places', `${slug}.webp`)
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-frames:v', '1', '-vf', 'scale=720:-2', '-c:v', 'libwebp', '-quality', '74', out])
        v.places[slug].webp = `/landing/v3/video/places/${slug}.webp`
      }
    }
    log('cartões', Object.keys(v.places).join(', '))
  }
  const dP = path.join(dVid, 'places')
  if (existsSync(dP)) {
    v.places ??= {}
    for (const f of await fs.readdir(dP)) {
      const m = f.match(/^([a-z0-9-]+)\.(webm|mp4|webp|jpg)$/)
      if (!m) continue
      await copia(path.join(dP, f), path.join(PUB, 'video', 'places', f))
      v.places[m[1]] ??= {}
      v.places[m[1]][m[2]] = `/landing/v3/video/places/${f}`
    }
    log('lugares', Object.keys(v.places).join(', '))
  }
  manifesto.video = v
} else log('sem landing-v3/video/: o herói fica no pôster provisório')

// ── 4. a carta sem moldura (fundo da busca) ────────────────────────────────
// carta-v10.svg tem 2400x2400 com a Satoshi Plaza em (1200,1200) e a barra de
// escala de 5 km em 600 px: 0,12 px por metro (x leste, z sul). Os rótulos, os
// marcadores de lugar e as duas caixas de legenda saem; o desenho fica.
if (FAZ_CARTA) {
  const sharp = (await import('sharp')).default
  let s = await fs.readFile(path.join(RAIZ, 'public/city/carta-v10.svg'), 'utf8')
  const corte = s.indexOf('<rect x="54" y="54" width="720" height="148"')   // começo do bloco de legendas
  if (corte < 0) throw new Error('carta-v10.svg mudou: não achei o bloco de legendas')
  s = s.slice(0, corte) + '</svg>'
  s = s.replace(/<text\b[\s\S]*?<\/text>/g, '')
  s = s.replace(/<circle cx="[\d.]+" cy="[\d.]+" r="4" fill="#F7931A"\/>/g, '')            // pontos de lugar
  s = s.replace(/<rect x="[\d.]+" y="[\d.]+" width="7" height="7" fill="#F7931A"[^>]*\/>/g, '') // marcos
  await fs.mkdir(path.join(PUB, 'map'), { recursive: true })
  for (const w of [2400, 1200]) {
    const out = path.join(PUB, 'map', `city-plan_${w}.webp`)
    await sharp(Buffer.from(s), { density: 72 * (w / 2400) * 1 }).resize(w, w).webp({ quality: 80, effort: 6 }).toFile(out)
    log('carta', out.replace(RAIZ + '/', ''), kb((await fs.stat(out)).size))
  }
  manifesto.map = { size: 2400, center: [1200, 1200], pxPerM: 0.12 }
}

await fs.mkdir(path.dirname(MANIFESTO), { recursive: true })
await fs.writeFile(MANIFESTO, JSON.stringify(manifesto, null, 2) + '\n')
log('manifesto', MANIFESTO.replace(RAIZ + '/', ''))
