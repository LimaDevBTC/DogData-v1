import type { Metadata } from "next"
import { OG_URL, OG_ALT } from "@/lib/og"

// Metadata de /dogcity/profile (servida em dogcity.space/profile). page.tsx e "use client", entao este layout irmao,
// Server Component, carrega o metadata. Perfil e' por carteira: nada vivo aqui.
export const metadata: Metadata = {
  alternates: { canonical: "https://dogcity.space/profile" },
  title: "Your profile | DogCity",
  description: "Your DogCity profile: handle, standing, your plot in the city and your referral link.",
  openGraph: {
    title: "Your profile | DogCity",
    description: "Your DogCity profile: handle, standing, your plot in the city and your referral link.",
    type: "website",
    url: "https://dogcity.space/profile",
    siteName: "DogCity",
    images: [{ url: OG_URL, width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your profile | DogCity",
    description: "Your DogCity profile: handle, standing, your plot in the city and your referral link.",
    images: [OG_URL],
  },
}

export default function DogCityProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
