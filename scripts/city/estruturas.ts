/**
 * AS ESTRUTURAS QUE JÁ EXISTEM NA CIDADE, extraídas da CENA e publicadas em JSON
 * para a cartografia.
 *   npx tsx scripts/city/estruturas.ts > public/city/estruturas.json
 *
 * ⚠️ COORDENADA DE PEÇA NÃO SE COPIA À MÃO, e este arquivo existe por causa
 * disso. O mapa já errou 75 m uma vez por replicar fora da cena um número que a
 * cena calcula; aqui cada sítio vem da MESMA função que assenta a peça no 3D
 * (`derbySitio`, `estadioSitio`, `campusParcela`…), então mapa e cena não têm
 * como divergir. Se a peça se mexer no jogo, ela se mexe no mapa na próxima
 * geração e ninguém precisa lembrar de nada.
 *
 * ⚠️ SÓ ENTRA O QUE ESTÁ CONSTRUÍDO. O `programa` de `cidade.json` tem 71 peças;
 * a maioria é reserva de terra, não obra. A lista daqui é o que o
 * `plaza-scene.tsx` de fato instancia.
 */
import * as THREE from 'three'
import { derbySitio } from '../../app/city/plaza/derby'
import { estadioSitio } from '../../app/city/plaza/estadio'
import { geodeSitio } from '../../app/city/plaza/geode'
import { atletismoSitio } from '../../app/city/plaza/atletismo'
import { aquaticsSitio, AQUATICS_ATIVO } from '../../app/city/plaza/aquatics'
import { campusParcela } from '../../app/city/plaza/campus'
import { PARK_CENTER, TEMPLE_WORLD } from '../../app/city/plaza/park-site'
import { DSC_CENTER } from '../../app/city/plaza/dsc-gallery'
import { PAD_MAIN } from '../../app/city/plaza/orbit-layer'

type Est = { nome: string; x: number; z: number; classe: 'obra' | 'parque' | 'porto' }
const fora: Est[] = []
const põe = (nome: string, x: number, z: number, classe: Est['classe'] = 'obra') =>
  fora.push({ nome, x: Math.round(x), z: Math.round(z), classe })

const d = derbySitio();     põe('DOG DERBY', d.x, d.z)
const e = estadioSitio();   põe('$DOG ARENA', e.x, e.z)
const g = geodeSitio();     põe('THE GEODE', g.x, g.z)
const a = atletismoSitio(); põe('ATHLETICS', a.x, a.z)
if (AQUATICS_ATIVO) { const q = aquaticsSitio(); põe('AQUATICS CENTRE', q.x, q.z) }



// ⚠️ PARQUE RUNESTONE E SPACEPORT FICAM DE FORA: os dois já são topônimo do mapa
// (r 11.800 e r 11.200, ambos fora da abóbada), e repetir vira rótulo dobrado.
// A DSC Gallery também sai: r 640 é DENTRO do disco da praça, e no papel ela cai
// em cima do núcleo cívico. O mesmo vale para BitFlow, Kray e o Chalé, que o
// `precinct` assenta a dezenas de metros do centro.
void PARK_CENTER; void TEMPLE_WORLD; void DSC_CENTER; void PAD_MAIN

// ⚠️ O CAMPUS É PARCELA, NÃO PONTO, e o centroide dele cai exatamente em cima da
// arena. Ele vai como POLÍGONO, que é o que ele é: o recinto que abriga as
// quatro peças. Assim o mapa desenha o limite e põe o nome no limite.
const parcelaCampus = campusParcela().poly.map(([x, z]) => [Math.round(x), Math.round(z)])

process.stdout.write(JSON.stringify({
  nota: 'gerado por scripts/city/estruturas.ts a partir da cena; nao editar a mao',
  estruturas: fora,
  recintos: [{ nome: 'DOG UNIVERSITY', poly: parcelaCampus }],
}, null, 1) + '\n')
