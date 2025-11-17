import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Server-Sent Events (SSE) para atualizações em tempo real
  const encoder = new TextEncoder()
  let heartbeatInterval: NodeJS.Timeout | null = null
  
  const stream = new ReadableStream({
    start(controller) {
      // Enviar evento inicial de conexão
      try {
        const message = `data: ${JSON.stringify({ 
          type: 'connected', 
          timestamp: new Date().toISOString() 
        })}\n\n`
        controller.enqueue(encoder.encode(message))
      } catch (error) {
        console.error('Error sending initial SSE message:', error)
      }
      
      // Manter conexão viva com heartbeat a cada 30 segundos
      heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({ 
            type: 'heartbeat', 
            timestamp: new Date().toISOString() 
          })}\n\n`
          controller.enqueue(encoder.encode(heartbeat))
        } catch (error) {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          try {
            controller.close()
          } catch (closeError) {
            // Ignorar erro ao fechar
          }
        }
      }, 30000)
      
      // Cleanup ao fechar conexão
      request.signal.addEventListener('abort', () => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          heartbeatInterval = null
        }
        try {
          controller.close()
        } catch (closeError) {
          // Ignorar erro ao fechar
        }
      })
    },
    cancel() {
      // Cleanup quando o stream é cancelado
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Desabilitar buffering do nginx
    },
  })
}





