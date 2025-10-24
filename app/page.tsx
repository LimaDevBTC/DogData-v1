"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirecionar para a última página salva ou overview
    const savedPage = localStorage.getItem('dogdata-current-page') || 'overview'
    router.push(`/${savedPage}`)
  }, [router])

  return (
    <div className="min-h-screen bg-black text-white grid-container flex items-center justify-center">
      <div className="loading-dots mx-auto">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  )
}
