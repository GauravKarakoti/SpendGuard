import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  
  // Declare interval variables outside so both start() and cancel() can access them
  let keepAlive: NodeJS.Timeout;
  let mockLogInterval: NodeJS.Timeout;

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeEnqueue = (data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          isClosed = true;
          clearInterval(keepAlive);
          clearInterval(mockLogInterval);
        }
      };

      // Keep connection alive to prevent timeouts
      keepAlive = setInterval(() => {
        safeEnqueue(`:\n\n`);
      }, 15000);

      // Simulation: Emit a heartbeat log every 10 seconds
      mockLogInterval = setInterval(() => {
        const payload = JSON.stringify({
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
          level: 'info',
          message: 'Agent heartbeat active. Monitoring 402 endpoints.'
        });
        
        safeEnqueue(`data: ${payload}\n\n`);
      }, 10000);

      // 1st Cleanup Method: Client aborts the request
      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(keepAlive);
        clearInterval(mockLogInterval);
      });
    },
    
    // 2nd Cleanup Method: The stream itself is cancelled/closed
    cancel() {
      clearInterval(keepAlive);
      clearInterval(mockLogInterval);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}