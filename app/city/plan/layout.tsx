import type { Metadata } from 'next'

// ═══════════════════════════════════════════════════════════════════════════
// AS PRANCHAS SÃO PÁGINA DE TRABALHO, E ATÉ 31/08 ESTAVAM NO AR SEM TRAVA.
//
// ⚠️ O FUNDADOR, 31/08: "não precisamos publicar nenhum lote ainda, o snapshot é
// só daqui a 6 dias". Auditado nesse dia: `/city/plan`, `/city/plan/bairros` e
// `/city/plan/cidade` respondiam HTTP 200 em produção e as três DESENHAM O
// LOTEAMENTO INTEIRO (85.843 lotes). Nenhuma tinha link apontando para elas, mas
// não estar linkada não é estar fechada: a URL é curta e adivinhável, e o
// `sitemap`/crawler acha o que não tem `noindex`.
//
// ⚠️ E PUBLICAR O DESENHO ANTES DO SNAPSHOT É PIOR QUE CEDO, É ERRADO. O mapa de
// hoje sai de saldos de hoje, e o snapshot vale o saldo de domingo ao meio-dia
// ET: qualquer pessoa que se localizasse agora estaria olhando um lote que ainda
// vai mudar de tamanho e de lugar. Publicar cedo não antecipa a informação,
// publica uma informação errada.
//
// O que ficou:
//   · `robots: noindex, nofollow` para o buscador não guardar cópia;
//   · as próprias pranchas exigem `?prancha=1` (ver o topo de cada client).
// Elas continuam sendo a ferramenta do fundador, com uma bandeira a mais.
//
// ⚠️ NÃO É SEGURANÇA, É HIGIENE. Bandeira de query não protege nada de quem
// insiste; o que ela evita é o acidente, que é o caso real aqui. O dado sensível
// de verdade (o CSV que liga lote a ENDEREÇO) nunca esteve em `public/`, e o
// `cidade-lotes.bin` tem 13 bytes por lote só de geometria, sem endereço nenhum.
// Isso foi conferido no mesmo dia.
// ═══════════════════════════════════════════════════════════════════════════
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return children
}
