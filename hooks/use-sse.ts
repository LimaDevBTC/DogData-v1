import { useEffect, useState, useRef } from 'react';

interface SSEMessage {
  type: string;
  timestamp: string;
  data?: {
    totalHolders?: number;
    lastUpdated?: string;
  };
}

export const useSSE = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('🔗 Conectado ao SSE');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        setLastMessage(message);
        console.log('📨 Mensagem SSE recebida:', message);
      } catch (err) {
        console.error('❌ Erro ao processar mensagem SSE:', err);
        setError('Erro ao processar mensagem');
      }
    };

    eventSource.onerror = (event) => {
      console.error('❌ Erro na conexão SSE:', event);
      setError('Erro na conexão');
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url]);

  const closeConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  return {
    isConnected,
    lastMessage,
    error,
    closeConnection
  };
};
