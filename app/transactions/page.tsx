"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Activity, 
  Clock, 
  Zap,
  TrendingUp
} from "lucide-react"

export default function TransactionsPage() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white font-mono flex items-center justify-center">
          <Activity className="w-10 h-10 mr-4 text-orange-400" />
          DOG Transactions
        </h1>
        <p className="text-gray-400 font-mono text-lg">
          Real-time transaction tracking and analysis
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="card-sharp card-hover glow-effect max-w-2xl w-full">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Clock className="w-24 h-24 text-orange-400 animate-pulse" />
                <Zap className="w-8 h-8 text-yellow-400 absolute -top-2 -right-2" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-white font-mono">
              Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-gray-400 font-mono text-lg">
              Estamos desenvolvendo um sistema avançado de rastreamento de transações DOG
            </p>
            
            <div className="space-y-4 mt-8">
              <div className="flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
                <span className="text-white font-mono">Rastreamento em tempo real</span>
              </div>
              <div className="flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-orange-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <span className="text-white font-mono">Análise detalhada de transferências</span>
              </div>
              <div className="flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <span className="text-white font-mono">Histórico completo de movimentações</span>
              </div>
              <div className="flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-yellow-400 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                <span className="text-white font-mono">Identificação de padrões e tendências</span>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-700/50">
              <Badge variant="outline" className="text-orange-400 border-orange-400 px-4 py-2 text-sm">
                <TrendingUp className="w-4 h-4 mr-2" />
                Em desenvolvimento ativo
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
