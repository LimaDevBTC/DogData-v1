import type { Metadata } from "next"
import { OG_URL, OG_ALT, OG_IMAGE } from '@/lib/og'

// Metadata desta rota. page.tsx é "use client" (usa <Layout> da casa, que puxa
// useRouter, e busca o fundo ao vivo num useEffect) e um Client Component não
// pode exportar `metadata`; este layout.tsx irmão, Server Component, é quem
// carrega isso para /dogcity/founders. Mesmo arranjo de /dogcity/docs.
//
// ⚠️ NENHUM NÚMERO VIVO AQUI. O valor do fundo e a contagem de Founders mudam
// todo dia; um card do X é a única parte da página que a pessoa lê sem abrir o
// site, e um número velho nele contradiz a própria página. Só entra o que não
// envelhece: a meta de 10.000.000 $DOG, que é fixa por definição.
//
// ⚠️ A imagem é obrigatória, senão todo link compartilhado sai como card sem
// imagem. O `?v=` existe porque X e Facebook guardam a chapa pela URL e não
// voltam a buscar quando o arquivo muda no mesmo caminho.
const OG = OG_URL

// 23/10/2026: a página virou a de honra dos 138 (o programa fechou no bloco 972.336); a metadata acompanha.
export const metadata: Metadata = {
  alternates: { canonical: "https://dogcity.space/founders" },
  title: "The 138 Founders of DogCity",
  description:
    "138 wallets funded DogCity: the construction fund reached 10,000,000 $DOG at block 972,336. The list is closed and inscribed on Bitcoin as a child of the City Charter.",
  openGraph: {
    title: "The 138 Founders of DogCity",
    description:
      "The construction fund reached 10,000,000 $DOG at block 972,336, from 138 wallets. The list is closed and inscribed on Bitcoin.",
    type: "website",
    url: "https://dogcity.space/founders",
    siteName: "DogCity",
    images: [
      {
        url: OG,
        width: 1200,
        height: 630,
        alt: "Inside the DogCity dome at Mare Tranquillitatis: the honeycomb shell overhead, the bay, the road web and Satoshi Plaza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The 138 Founders of DogCity",
    description: "138 wallets funded the city. The list is closed and inscribed on Bitcoin.",
    images: [OG],
  },
}

export default function DogCityFoundersLayout({ children }: { children: React.ReactNode }) {
  return children
}
