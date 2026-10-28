// ═══════════════════════════════════════════════════════════════════════════
// A CASA DA LICENÇA: o que a carteira que pagou a licença vê construir no lote.
//
// 🔒 DECISÃO DO FUNDADOR, 28/10/2026: toda carteira que pagou a licença de
// construção ganha a casa PADRÃO no seu lote (estilo pelo distrito, tamanho
// pela frente do lote). Commercial = a casa do distrito com loja no térreo (uso
// misto). Patron = projeto próprio (até lá, canteiro com a placa "Patron
// residence in design"). A tela diz só "In production" (Patron: "In design"),
// NUNCA data, nunca preço.
//
// POR QUE EXISTE: quem cunhou o lote e pagou a licença pergunta "e agora?". A
// landing (lookup, sections/wallet-lookup.tsx) e o /profile respondem com AS
// MESMAS frases, e elas moram só aqui. Cada tela desenha do seu jeito.
//
// DE ONDE VÊM AS PEÇAS:
//   * o degrau: do servidor (lib/dog/licence-wallet.ts, a regra do livro do
//     fundo mais os créditos em BTC, a mesma conta de /api/donate/leaderboard);
//   * o lote: do registro selado (/api/dogcity/lookup e /api/profile);
//   * o nome da licença e os veículos: dos cartões da landing (TIERS em
//     dogcity-data.ts). Mudou lá, muda aqui; o teste tranca as frases;
//   * o distrito: DISTRITO_DO_SETOR (o mesmo mapa do jogo).
//
// 🔒 CUSTÓDIA (fundador, 28/10/2026): carteira de corretora ou de empresa (a
// Kraken recebeu uma licença Commercial porque clientes sacaram $DOG direto para
// o fundo) NUNCA mostra licença nem casa. Ver ehCarteiraDeCustodia() abaixo.
//
// Pura, sem rede: testada em casa-da-licenca.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { TIERS, DISTRITO_DO_SETOR, SETORES_SEM_CATALOGO, SETOR_DAS_EMPRESAS } from "./dogcity-data"

export type Degrau = "personal" | "commercial" | "patron"

export const DEGRAUS: readonly Degrau[] = ["personal", "commercial", "patron"]
export const isDegrau = (t: unknown): t is Degrau => typeof t === "string" && (DEGRAUS as readonly string[]).includes(t)

/** o lote da carteira, como o registro respondeu */
export type LoteDaCasa =
  | { lot_id: string; sector: number }
  /** a carteira TEM lote, mas o índice não respondeu agora: nunca vira "sem lote" */
  | "sem_posicao"
  /** a carteira não tem lote (lápide, ou chegou depois do bloco 966.670) */
  | "sem_lote"

export type CasaDaLicenca =
  | {
      caso: "com_lote"
      degrau: Degrau
      /** "Personal" | "Commercial" | "Patron" */
      licenca: string
      /** "YOUR BUILDING · PERSONAL LICENCE" */
      rotulo: string
      /** null quando a posição não está ao alcance agora */
      loteId: string | null
      distrito: string | null
      /** "A residence from the Timberline catalogue" */
      constroi: string
      /** "Vehicles: the $DOG moto" (a frase do cartão da landing) */
      veiculos: string | null
      /** "In production" | "In design" */
      status: string
      /** tipo do lote pela frente na rua; SEMPRE null hoje (ver tipoPelaFrente) */
      tipo: string | null
    }
  | {
      caso: "sem_lote"
      degrau: Degrau
      licenca: string
      /** "BUILDING LICENCE · PERSONAL" */
      rotulo: string
      /** "This wallet holds a Personal licence." */
      titulo: string
      /** neutro, sem promessa: onde a casa vai */
      aviso: string
    }

// o canal oficial de suporte (app/dogcity/support, support@dogcity.space): link interno
export const SUPORTE = { href: "/dogcity/support", rotulo: "DogCity support" } as const
export const SUPORTE_LEAD = "Questions about your licence go to"

export const STATUS_EM_PRODUCAO = "In production"
export const STATUS_EM_PROJETO = "In design"

export const AVISO_SEM_LOTE =
  "No lot is linked to this wallet. The building goes on the lot of the wallet that holds the deed."

// ── O CTA DA LICENÇA, PARA QUEM NÃO TEM LICENÇA (28/10/2026) ────────────────
// O fundo fechou no bloco 972.336 e o número de Founder acabou, então "LOCK YOUR
// FOUNDER NUMBER" saiu. Quem chegou depois do snapshot (e quem tem lote e nenhuma
// licença) ouve a MESMA oferta: a licença de construção, aberta a qualquer um
// (frase das docs e da página /dogcity/founders). O link vai para os cartões das
// licenças na landing (#tiers), o mesmo destino do "Get a building licence" da
// página dos founders, não para a página de honra dos 138.
export const CTA_LICENCA = { href: "/dogcity#tiers", rotulo: "GET THE LICENCE TO BUILD ON IT" } as const
export const TEXTO_LICENCA_ABERTA = "A building licence is open to anyone, in $DOG or Bitcoin, and it is counted per wallet."

// ── QUEM PAGOU SACANDO DE UMA CORRETORA (28/10/2026, decisão do fundador) ───
// Um saque de corretora chega ao fundo vindo da carteira da corretora, não da do
// cliente: a licença fica no endereço da corretora, e a carteira do cliente não
// aparece como pagadora. Nota neutra, só a saída (suporte), sem prometer crédito.
// Aparece onde a carteira consultada NÃO tem licença. A frase inteira, com o link
// no lugar de "DogCity support": pergunta + antes + SUPORTE.rotulo + depois.
export const NOTA_CORRETORA = {
  pergunta: "Paid from an exchange?",
  antes: "A withdrawal from an exchange arrives from the exchange's wallet, not yours. Contact",
  depois: "with the transaction and your own wallet address.",
} as const
export const notaCorretoraTexto = () =>
  `${NOTA_CORRETORA.pergunta} ${NOTA_CORRETORA.antes} ${SUPORTE.rotulo} ${NOTA_CORRETORA.depois}`

// ── A LINHA SECTOR DA ESCRITURA (28/10/2026) ────────────────────────────────
// Antes só os setores 7 a 9 levavam o nome; os setores 1 a 6 saíam só com o
// número. Agora os nove levam o nome do distrito: "1 · Harbor Canals". Se a rota
// (ou uma resposta em cache de antes da mudança) mandar sem nome, o nome sai do
// mesmo mapa aqui, então a tela nunca volta ao número solto. Setor sem nome
// conhecido (fora de 1 a 9) fica só com o número.
export function rotuloDoSetor(setor: number, distrito?: string | null): string {
  const nome = distrito || DISTRITO_DO_SETOR[setor] || null
  return nome ? `${setor} · ${nome}` : String(setor)
}

// ── CARTEIRA DE CUSTÓDIA: NUNCA LEVA LICENÇA NEM CASA (28/10/2026) ──────────
// A carteira de custódia da Kraken (bc1plzs2l…dhspn, lote S08-Q00-B0002-L004) foi
// creditada com uma licença Commercial (87.777 $DOG em 2 transações de 14/09)
// porque clientes sacaram $DOG direto para o endereço do fundo. A Kraken não
// comprou licença. Regra do fundador: corretora e empresa NUNCA mostram status de
// licença ou de casa, em nenhuma tela. Três sinais, qualquer um basta:
//   * identidade: o endereço bate com `dog_labels` ou `verified_addresses.json`
//     (corretora, ponte, mercado, tesouraria...), a mesma identidade que manda o
//     /api/dogcity/lookup responder `exchange`;
//   * setor: o lote está no setor 8 (Financial District, só empresas: 32 lotes);
//   * tier: o tier do lote em dogcity_lot_info.json é "co" (Company).
// Decidida NO SERVIDOR (rotas de lookup e /api/profile): a licença nem sai na
// resposta. Não é crédito, não mexe no placar: é só o que a tela deste endereço diz.
export interface SinaisDeCustodia {
  /** a identidade que a casa conhece para o endereço (qualquer valor verdadeiro) */
  identidade?: unknown
  /** o setor do lote no registro selado */
  setor?: number | null
  /** o código do tier do lote ("co" = empresa) */
  tierDoLote?: string | null
}

export function ehCarteiraDeCustodia(s: SinaisDeCustodia): boolean {
  if (s.identidade) return true
  if (s.setor === SETOR_DAS_EMPRESAS) return true
  return s.tierDoLote === "co"
}

/** a licença que a tela pode mostrar: a que veio, ou null se a carteira é de custódia */
export function licencaVisivel<T>(licence: T | null | undefined, sinais: SinaisDeCustodia): T | null {
  return ehCarteiraDeCustodia(sinais) ? null : licence ?? null
}

const tierDe = (d: Degrau) => TIERS.find((t) => t.key === d)

/** o nome da licença como o cartão da landing escreve */
export function nomeDaLicenca(d: Degrau): string {
  return tierDe(d)?.name ?? d.charAt(0).toUpperCase() + d.slice(1)
}

/** a linha "Vehicles: ..." do cartão do degrau, inteira; null se o cartão não tiver */
export function veiculosDe(d: Degrau): string | null {
  return tierDe(d)?.perks.find((p) => p.startsWith("Vehicles: ")) ?? null
}

/** "from the Timberline catalogue"; "from The Spit catalogue" (sem "the The") */
function doCatalogo(distrito: string): string {
  return /^the /i.test(distrito) ? `from ${distrito} catalogue` : `from the ${distrito} catalogue`
}

/** o distrito com catálogo de casas, ou null (setor sem nome ou Financial District) */
function distritoComCatalogo(setor: number | null): string | null {
  if (setor == null || SETORES_SEM_CATALOGO.has(setor)) return null
  return DISTRITO_DO_SETOR[setor] ?? null
}

/** o que a licença constrói no lote; sem distrito conhecido, a frase das docs ("the district catalogue") */
export function oQueConstroi(d: Degrau, setor: number | null): string {
  const cat = distritoComCatalogo(setor)
  const de = cat ? doCatalogo(cat) : "from the district catalogue"
  if (d === "patron") return "A custom residence designed for you"
  if (d === "commercial") return `A mixed-use building ${de} (a shop on the ground floor, a home above)`
  return `A residence ${de}`
}

// ── O GANCHO DA TIPOLOGIA ───────────────────────────────────────────────────
// TODO(tipologia pela frente): o tipo do lote (Row / Small / Standard / Large /
// Estate) sai da FRENTE do lote na rua, a regra das docs §8 ("Five lot types,
// measured on the street") e do jogo (dogcity-mundo scripts/casas/lote_casa.py,
// tipologia_da_frente; plano/the_build/frente_por_rua.py). O DogData AINDA NÃO
// TEM a frente de cada lote (data/dogcity_lot_info.json não traz `frente_m`),
// então nenhuma tela mostra tipo hoje: `tipo` sai null e as telas omitem a
// linha. Quando a frente chegar (um campo novo em lot-info, copiado pelo
// sync-v3), basta passá-la em `frenteM` em casaDaLicenca().
// ⚠️ NUNCA usar TIPOLOGIA_DA_FORMA aqui: aquilo é a forma pelo utxo_count do
// registro (House, Courtyard...), outra régua, e daria tipo errado.
// ⚠️ NEM a coluna `frente_m` de data/dogcity_lotes.csv sem conferir: ela é do
// desenho do registro e não é garantidamente o lado que dá para a rua de
// verdade (frente_por_rua.py mede contra o asfalto e, na esquina, escolhe o
// lado mais curto entre os que encostam). Até o fundador confirmar a fonte,
// para o DogData a frente pela rua "ainda não existe" (decisão de 28/10).
export function tipoPelaFrente(frenteM: number | null | undefined): string | null {
  if (typeof frenteM !== "number" || !Number.isFinite(frenteM) || frenteM <= 0) return null
  if (frenteM < 6) return "Row"
  if (frenteM < 22) return "Small"
  if (frenteM < 27) return "Standard"
  if (frenteM < 50) return "Large"
  return "Estate"
}

/**
 * As frases da casa de UMA carteira com licença. Sem licença (degrau null ou
 * inválido) devolve null, e a tela segue como sempre foi. Lote no setor 8
 * (Financial District, só empresas) também devolve null: a rota já corta a
 * licença da carteira de custódia (ehCarteiraDeCustodia), e esta é a segunda
 * trava, para uma resposta antiga nunca desenhar casa numa empresa.
 */
export function casaDaLicenca(
  degrau: unknown,
  lote: LoteDaCasa,
  frenteM: number | null = null,
): CasaDaLicenca | null {
  if (!isDegrau(degrau)) return null
  if (typeof lote === "object" && lote !== null && lote.sector === SETOR_DAS_EMPRESAS) return null
  const licenca = nomeDaLicenca(degrau)
  if (lote === "sem_lote") {
    return {
      caso: "sem_lote",
      degrau,
      licenca,
      rotulo: `BUILDING LICENCE · ${licenca.toUpperCase()}`,
      titulo: `This wallet holds a ${licenca} licence.`,
      aviso: AVISO_SEM_LOTE,
    }
  }
  const comPosicao = typeof lote === "object" && lote !== null
  const setor = comPosicao && Number.isInteger(lote.sector) ? lote.sector : null
  return {
    caso: "com_lote",
    degrau,
    licenca,
    rotulo: `YOUR BUILDING · ${licenca.toUpperCase()} LICENCE`,
    loteId: comPosicao ? lote.lot_id : null,
    distrito: setor != null ? DISTRITO_DO_SETOR[setor] ?? null : null,
    constroi: oQueConstroi(degrau, setor),
    veiculos: veiculosDe(degrau),
    status: degrau === "patron" ? STATUS_EM_PROJETO : STATUS_EM_PRODUCAO,
    tipo: tipoPelaFrente(frenteM),
  }
}
