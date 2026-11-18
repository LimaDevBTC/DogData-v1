"use client"

// /profile no dogdata.xyz: a moldura do DogData em volta do corpo compartilhado.
// No dogcity.space a mesma pagina vem de app/dogcity/profile/page.tsx, com a moldura da cidade.
import type { ReactNode } from "react"
import { Layout } from "@/components/layout"
import { ProfileBody } from "@/components/profile/profile-body"

function Shell({ children }: { children: ReactNode }) {
  return <Layout currentPage="profile" setCurrentPage={() => {}}>{children}</Layout>
}

export default function ProfilePage() {
  return <ProfileBody Shell={Shell} />
}
