import type { Metadata } from 'next'
import MapaClient from './mapa-client'

// ⚠️ SEM next/dynamic(ssr:false) AQUI. Diferente da cena 3D (que usa Three/WebGL
// e não roda no servidor de jeito nenhum), o canvas 2D deste mapa só é tocado
// dentro de useEffect: o componente renderiza normal em SSR (a <canvas> some
// vazia até hidratar) e carrega o registro no cliente. `ssr: false` num
// next/dynamic só é permitido dentro de um Client Component; usá-lo direto
// aqui (Server Component) derruba a rota com "ssr: false is not allowed with
// next/dynamic in Server Components".

const TITLE = 'City Map · DogCity'
const DESCRIPTION =
  'Navigate the sealed DogCity plot map: 70,709 plots across 9 sectors, from the whole site down to a single deed.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/city/mapa' },
}

export default function MapaPage() {
  return <MapaClient />
}
