import type { Metadata } from 'next'
import CidadeClient from './cidade-client'

// Prancha 4: A CIDADE. Implementa o capítulo 6 do plano-diretor.md com a ordem
// de chegada de verdade, mais as camadas de enclave de família e do condomínio
// do Dog Social Club. Ver fundacao.md.
export const metadata: Metadata = {
  title: 'DogCity · fundação · prancha 4 · a cidade',
  description:
    '52.994 carteiras endereçadas em 12 setores pela ordem de chegada real, com enclaves de família e o condomínio do Dog Social Club.',
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

export default async function CidadePage(
  { searchParams }: { searchParams: Promise<{ prancha?: string }> },
) {
  const q = await searchParams
  if (q?.prancha !== '1') return <Fechada />
  return <CidadeClient />
}

