import type { Metadata } from "next"
import { OG_URL, OG_ALT } from "@/lib/og"

// Metadata de /dogcity/referrals (servida em dogcity.space/referrals). page.tsx e "use client" (usa o
// <Layout> da casa), entao este layout irmao, Server Component, carrega o metadata. Mesmo arranjo de
// /dogcity/founders. Nenhum numero vivo aqui: um card compartilhado nao pode contradizer o placar.
export const metadata: Metadata = {
  alternates: { canonical: "https://dogcity.space/referrals" },
  title: "Referral board | DogCity",
  description: "We're counting. The DogCity referral board shows how many referrals each verified account brought. What referrals unlock will be announced.",
  openGraph: {
    title: "DogCity referral board",
    description: "We're counting. What referrals unlock will be announced.",
    type: "website",
    url: "https://dogcity.space/referrals",
    siteName: "DogCity",
    images: [{ url: OG_URL, width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DogCity referral board",
    description: "We're counting. What referrals unlock will be announced.",
    images: [OG_URL],
  },
}

export default function DogCityReferralsLayout({ children }: { children: React.ReactNode }) {
  return children
}
