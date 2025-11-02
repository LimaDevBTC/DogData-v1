import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Server-Sent Events (SSE) para atualizações em tempo real
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Enviar evento inicial de conexão
      const message = `data: ${JSON.stringify({ 
        type: 'connected', 
        timestamp: new Date().toISOString() 
      })}\n\n`
      controller.enqueue(encoder.encode(message))
      
      // Manter conexão viva com heartbeat a cada 30 segundos
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({ 
            type: 'heartbeat', 
            timestamp: new Date().toISOString() 
          })}\n\n`
          controller.enqueue(encoder.encode(heartbeat))
        } catch (error) {
          clearInterval(heartbeatInterval)
        }
      }, 30000)
      
      // Cleanup ao fechar conexão
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

