#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DOG MOTORS no site: as imagens da página /dogcity/motors, em AVIF + WebP, nas larguras que o srcset pede.
//
//   node scripts/motors/make-images.mjs [pasta assets_carros]
//
// Fontes (fora do repo, em assets_carros/):
//   projeto/renders/r2_02_entrada_AN7.png      o herói (16:9) e o recorte 4:5 do celular
//   projeto/renders/r2_03_interior_gallery.png a Gallery (16:9)
//   projeto/renders/r2_04_torre_de_baixo.png   a DOG TOWER (recorte 4:3)
//   projeto/renders/r2_05_passarela_ring.png   o DOG RING (recorte 4:3)
//   projeto/renders/r2_01_aerea_baia.png       a Spit vista da baía, para a corrida (recorte 4:3)
//   pronto/conferencia/<slug>_frente34.png     as 18 fotos de estúdio (prep_cars.py iguala o fundo e recorta 16:10)
// Saída: public/dogcity-motors/ (nomes estáveis; trocar uma imagem = rodar de novo e versionar).
// O OG (1200x630, JPEG) sai junto: X e Telegram guardam pela URL, então o nome leva a rodada (-r2).
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
const assets = resolve(process.argv[2] ?? join(repo, '../assets_carros'))
const renders = join(assets, 'projeto/renders')
const out = join(repo, 'public/dogcity-motors')
mkdirSync(out, { recursive: true })

const AVIF = { quality: 52, effort: 6, chromaSubsampling: '4:2:0' }
const WEBP = { quality: 76, effort: 6 }
// os carros são o produto: um pouco mais de qualidade (aro, grade, placa), e ainda abaixo de 15 KB no maior
const AVIF_CAR = { quality: 60, effort: 6, chromaSubsampling: '4:4:4' }
const WEBP_CAR = { quality: 82, effort: 6 }

async function variants(input, name, widths, crop, car = false) {
  for (const w of widths) {
    let img = sharp(input)
    if (crop) img = img.extract(crop)
    const meta = await img.clone().metadata()
    const base = img.resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
    await base.clone().avif(car ? AVIF_CAR : AVIF).toFile(join(out, `${name}-${w}.avif`))
    await base.clone().webp(car ? WEBP_CAR : WEBP).toFile(join(out, `${name}-${w}.webp`))
    void meta
  }
}

// ── os renders ──
const R = (f) => join(renders, f)
await variants(R('r2_02_entrada_AN7.png'), 'hero', [768, 1280, 1600])
// celular: 4:5 com o letreiro, a torre e o pilone da direita (o letreiro fica em x 530-715, a torre em 860-975)
await variants(R('r2_02_entrada_AN7.png'), 'hero-m', [480, 720], { left: 455, top: 0, width: 720, height: 900 })
await variants(R('r2_03_interior_gallery.png'), 'gallery', [768, 1280, 1600])
await variants(R('r2_04_torre_de_baixo.png'), 'tower', [600, 900, 1200], { left: 180, top: 0, width: 1200, height: 900 })
await variants(R('r2_05_passarela_ring.png'), 'ring', [600, 900, 1200], { left: 260, top: 0, width: 1200, height: 900 })
await variants(R('r2_01_aerea_baia.png'), 'race', [600, 900, 1200], { left: 230, top: 0, width: 1200, height: 900 })

// o OG da página (1200x630): o pórtico, o letreiro e a torre
await sharp(R('r2_02_entrada_AN7.png'))
  .extract({ left: 0, top: 40, width: 1600, height: 840 })
  .resize({ width: 1200, height: 630 })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(out, 'og-dog-motors-r2.jpg'))

// ── os 18 carros ──
const tmp = mkdtempSync(join(tmpdir(), 'motors-cars-'))
execFileSync('python3', [join(here, 'prep_cars.py'), join(assets, 'pronto/conferencia'), tmp], { stdio: 'inherit' })
for (const f of readdirSync(tmp).filter((f) => /^c\d{2}\.png$/.test(f)).sort()) {
  await variants(join(tmp, f), `car-${f.slice(0, 3)}`, [448, 672, 896], undefined, true)
}

let total = 0
for (const f of readdirSync(out)) total += statSync(join(out, f)).size
console.log(`public/dogcity-motors: ${readdirSync(out).length} arquivos, ${(total / 1024).toFixed(0)} KB`)
