"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O MAPA DA CIDADE, na hero do snapshot.
//
// Decisão do fundador em 11/09: "quero essa imagem na hero section, ela está
// muito boa e diretamente ligada com o snapshot de amanhã". A carta responde a
// pergunta que o countdown levanta — faltam X blocos para QUÊ — mostrando a
// cidade inteira, com cada tier na cor dele.
//
// ⚠️ ELA MOSTRA BAIRRO, NUNCA LOTE, e é essa linha que autoriza a peça a estar
// aqui. A <PlotDeed /> saiu da landing em 04/09 porque desenhar o lote de uma
// carteira antes do bloco 966.670 é publicar uma POSIÇÃO ANTES DE SER DECIDIDA:
// ela muda quando alguém recebe, gasta ou consolida uma moeda, e "mexeram no meu
// lote" custa mais do que a seção rende. O mapa está do outro lado dessa linha:
// qual tier mora em que anel é REGRA, fechada e auditável, e não depende do
// estado da chain de ninguém.
//
// ⚠️ A CHAVE DOS TIERS É HTML, NÃO PIXEL. A carta tem o painel "WHO LIVES WHERE"
// embutido, mas ele foi desenhado para 2.400 px: num telefone de 390 px aquele
// texto tem 2 px de altura. A imagem entrega a ESTRUTURA (os anéis, a alça, a
// baía, a autopista), que sobrevive pequena; o entendimento vem da lista aqui do
// lado, que é texto de verdade — selecionável, legível por leitor de tela e que
// não depende de a pessoa dar zoom.
//
// ⚠️ E A COR DA AMOSTRA É COMPOSTA, COMO NO MAPA. Lá a mancha é pintada SOBRE o
// relevo com opacidade; mostrando o hexadecimal puro aqui, a chave diria um tom
// e a carta mostraria outro, e o leitor procuraria a cor errada. Cada amostra é
// a mesma tinta sobre a mesma base (#6F5C45) com a mesma opacidade.
//
// ⚠️ PESO: a fonte é UM WebP de 1.600 px (365 KB), não o SVG de 4,4 MB. O vetor
// vive atrás do link "open the full map", que é onde ele ganha o peso dele.
// As variantes menores NÃO são versionadas: o `next/image` as deriva desta com
// o `sizes` abaixo, e no telefone o que desce fica em torno de 96 KB. Guardar
// cópias de 1.000 e 640 px no repositório seria a mesma confusão de ter duas
// cartas da mesma cidade — alguém acabaria apontando para a errada.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image"
import { HAIR, HAIR_SOFT } from "../motion"
import { SNAPSHOT } from "../dogcity-data"

/** a paleta é a mesma de `scripts/city/mapa-topo.mjs` (TIER_COR/TIER_OP), e a
 *  base é o marrom médio do relevo sobre o qual a mancha é pintada */
const BASE_RELEVO = "#6F5C45"
export const TIERS_MAPA: { cor: string; op: number; nome: string; onde: string }[] = [
  { cor: "#FFCE7A", op: 0.86, nome: "1 · Satoshi Visionary", onde: "the spit, front row, centre of the arc" },
  { cor: "#F79B34", op: 0.86, nome: "2 · BTC Maximalist", onde: "the spit, front row, both flanks" },
  { cor: "#DE6A18", op: 0.86, nome: "3 · Rune Master", onde: "the spit, back row" },
  { cor: "#B4501C", op: 0.8, nome: "4 · Ordinal Believer", onde: "waterfront, facing the water" },
  { cor: "#87452A", op: 0.78, nome: "5 · DOG Supporter", onde: "waterfront, behind the shore road" },
  { cor: "#9C8F79", op: 0.66, nome: "6 · Diamond Paws", onde: "inner fabric, by how the wallet is used" },
  { cor: "#6A6E72", op: 0.68, nome: "7 to 12 · The Group", onde: "from 20k DOG, oldest UTXO sits closer in" },
  { cor: "#414750", op: 0.7, nome: "Every other holder", onde: "under 20k DOG, outskirts, no ranking" },
]

function Amostra({ cor, op }: { cor: string; op: number }) {
  return (
    <span aria-hidden className="inline-block shrink-0 mt-[3px] h-3 w-3" style={{ background: BASE_RELEVO }}>
      <span className="block h-full w-full" style={{ background: cor, opacity: op }} />
    </span>
  )
}

export function ChaveTiers({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {TIERS_MAPA.map((t) => (
        <li key={t.nome} className="flex gap-2.5 items-start">
          <Amostra cor={t.cor} op={t.op} />
          <span className="min-w-0">
            <span className="font-mono text-[11px] md:text-xs text-snow tracking-[0.06em]">{t.nome}</span>
            <span className="block text-[11px] md:text-xs text-dusty leading-snug">{t.onde}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function CityMap() {
  return (
    <figure className="m-0">
      <div className={`relative border ${HAIR} bg-white/[0.02]`}>
        {/* ⚠️ SEM `priority`: esta imagem divide a hero com o countdown, e o
            countdown é quem tem de pintar primeiro. Ela carrega logo em
            seguida, sem disputar a primeira dobra com o número. */}
        <Image
          src="/landing/citymap-1600.webp"
          alt="City plan of DogCity: concentric districts around Satoshi Plaza, the spit along the bay, and the AN7 ring expressway. Each tier of holder is a different colour."
          width={1600}
          height={1600}
          sizes="(min-width: 1024px) 44vw, 100vw"
          className="w-full h-auto"
        />
        <a
          href="/city/dogcity-map.svg"
          target="_blank"
          rel="noopener"
          className={`absolute bottom-0 right-0 border-l border-t ${HAIR} bg-void/85 backdrop-blur-sm
            font-mono text-[10px] tracking-[0.14em] text-lava hover:text-lava-light px-3 py-2`}
        >
          OPEN THE FULL MAP →
        </a>
      </div>
      <figcaption className={`mt-3 border-t ${HAIR_SOFT} pt-3 font-mono text-[9px] md:text-[10px] tracking-[0.14em] text-mist leading-relaxed`}>
        THE PLAN BEFORE THE SNAPSHOT · EVERY WALLET IS PLACED AT BLOCK{" "}
        <span className="tabular-nums text-lava">{SNAPSHOT.block.toLocaleString("en-US")}</span>
      </figcaption>
    </figure>
  )
}
