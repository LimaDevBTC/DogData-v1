"use client"

import { useSSE } from "@/hooks/use-sse"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, RefreshCw } from "lucide-react"

interface RealtimeStatusProps {
  onDataUpdate?: () => void;
}

export function RealtimeStatus({ onDataUpdate }: RealtimeStatusProps) {
  const { isConnected, lastMessage, error } = useSSE('/api/events');

  useEffect(() => {
    if (lastMessage?.type === 'data_updated' && onDataUpdate) {
      console.log('🔄 Dados atualizados via SSE, recarregando...');
      onDataUpdate();
    }
  }, [lastMessage, onDataUpdate]);

  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <Wifi className="w-3 h-3 mr-1" />
          Tempo Real
        </Badge>
      ) : (
        <Badge variant="destructive">
          <WifiOff className="w-3 h-3 mr-1" />
          Desconectado
        </Badge>
      )}
      
      {lastMessage?.type === 'data_updated' && (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          Atualizado
        </Badge>
      )}
      
      {error && (
        <Badge variant="destructive">
          Erro: {error}
        </Badge>
      )}
    </div>
  );
}
