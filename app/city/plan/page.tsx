import type { Metadata } from 'next'
import PlanClient from './plan-client'

// A prancha de fundação da DogCity. Página de trabalho, não de vitrine: ela
// existe para o fundador decidir declive e tamanho de lote OLHANDO, em vez de
// discutir número em texto. Ver fundacao.md, fase 1.
const TITLE = 'DogCity · fundação · prancha 1'
const DESCRIPTION =
  'Quanta terra existe no sítio lunar de Mare Tranquillitatis, medida célula a célula no relevo real da NASA, e quantos lotes cabem em cada cenário de declive.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
}


// ⚠️ A PRANCHA EXIGE `?prancha=1` DESDE 31/08, e o teste roda AQUI, no componente
// de SERVIDOR. A primeira tentativa leu `window.location` dentro do cliente e não
// funcionou por dois motivos: no servidor `window` não existe, então o HTML saía
// sempre fechado; e ler window durante o render dá divergência de hidratação.
// `searchParams` é o jeito certo de um componente de servidor ler a query.
//
// ⚠️ E `noindex` NÃO BASTAVA. Estas páginas já tinham `robots: noindex`, e mesmo
// assim respondiam HTTP 200 em produção para qualquer um com a URL. Não estar no
// buscador não é estar fechado.
//
// O motivo da trava está em `app/city/plan/layout.tsx`: o fundador pediu que
// nenhum lote seja publicado antes do snapshot de domingo, e estas pranchas
// desenham os 85.843.
function Fechada() {
  return (
    <main style={{ minHeight: '100vh', background: '#0E0E10', color: '#8A8375',
                   display: 'grid', placeItems: 'center', fontSize: 13,
                   fontFamily: 'ui-monospace, monospace', textAlign: 'center',
                   padding: 24, lineHeight: 1.8 }}>
      <div>
        prancha de trabalho
        <br />
        o loteamento da DogCity é publicado depois do snapshot
      </div>
    </main>
  )
}

export default async function PlanPage(
  { searchParams }: { searchParams: Promise<{ prancha?: string }> },
) {
  const q = await searchParams
  if (q?.prancha !== '1') return <Fechada />
  return <PlanClient />
}

