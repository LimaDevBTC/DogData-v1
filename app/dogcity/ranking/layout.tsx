import type { Metadata } from "next"
import { OG_URL, OG_ALT } from "@/lib/og"

// Metadata de /dogcity/ranking (servida em dogcity.space/ranking). page.tsx e "use client", entao este layout irmao, Server
// Component, carrega o metadata (mesmo arranjo de /dogcity/referrals). Nenhum numero vivo aqui: um card compartilhado nao pode
// contradizer o ranking. Sem promessa de premio.
export const metadata: Metadata = {
  alternates: { canonical: "https://dogcity.space/ranking" },
  title: "DC Points ranking | DogCity",
  description: "Who has earned the most DC Points in DogCity: Total, Login and Ambassador boards, all time or this week.",
  openGraph: {
    title: "DogCity DC Points ranking",
    description: "Who has earned the most DC Points in DogCity.",
    type: "website",
    url: "https://dogcity.space/ranking",
    siteName: "DogCity",
    images: [{ url: OG_URL, width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DogCity DC Points ranking",
    description: "Who has earned the most DC Points in DogCity.",
    images: [OG_URL],
  },
}

export default function DogCityRankingLayout({ children }: { children: React.ReactNode }) {
  return children
}
