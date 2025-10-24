"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check localStorage for saved page
    const savedPage = typeof window !== 'undefined' 
      ? localStorage.getItem('dogdata-current-page') 
      : null
    
    const targetPage = savedPage || 'overview'
    router.replace(`/${targetPage}`)
  }, [router])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-spin" />
        <p className="text-gray-400 font-mono">Redirecting...</p>
      </div>
    </div>
  )
}
