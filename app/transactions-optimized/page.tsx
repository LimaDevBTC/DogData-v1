"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TransactionsOptimizedPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/transactions")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-gray-400 font-mono text-sm">
      Redirecting to latest transactions…
    </div>
  )
}

