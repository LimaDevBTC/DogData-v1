"use client"

// O casco do site em volta da sala de operação.
//
// `Layout` é componente de cliente e recebe `setCurrentPage` como função, que
// não atravessa a fronteira servidor→cliente. Por isso este envelope existe:
// a página continua sendo do servidor (é ela que lê a sessão no portão) e o
// casco fica deste lado.
//
// currentPage é "profile" de propósito. A sala não é um item da navegação e
// nunca vai ser: um destaque no header anunciaria a rota para todo mundo que
// abrisse o menu.

import { Layout } from "@/components/layout"

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <Layout currentPage="profile" setCurrentPage={() => {}}>
      {children}
    </Layout>
  )
}
