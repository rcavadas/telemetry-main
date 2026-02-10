import { useState, useEffect, useRef } from 'react';

interface TCPMessage {
  id: string;
  timestamp: string;
  clientId: string;
  rawHex: string;
  messageType: string;
  size: number;
  deviceId?: string;
  crcValid?: boolean;
  decoded?: {
    success?: boolean;
    decoded?: {
      protocolId?: string;
      deviceId?: string;
    };
  };
}

export default function TCPMonitor() {
  const [messages, setMessages] = useState<TCPMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isPaused) return;

    const eventSource = new EventSource('/api/tcp-stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setIsConnected(true);
        } else if (data.id && data.rawHex) {
          // Mensagem TCP recebida diretamente do backend
          setMessages(prev => [data, ...prev].slice(0, 100));
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [isPaused]);

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">📡 Monitor TCP</h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={clearMessages} className="btn-secondary text-sm py-2 px-4">
            🗑️ Limpar
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="btn-primary text-sm py-2 px-4"
          >
            {isPaused ? '▶️ Retomar' : '⏸️ Pausar'}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>🔍 Aguardando comunicações TCP...</p>
            <p className="text-sm mt-2">As mensagens aparecerão aqui em tempo real</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="bg-white p-3 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500">{msg.timestamp}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {msg.clientId}
                  </span>
                </div>
                <div className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                  {msg.rawHex}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-2">
                  <span>Tipo: {msg.messageType}</span>
                  <span>| Tamanho: {msg.size} bytes</span>
                  {msg.deviceId && (
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                      {msg.deviceId}
                    </span>
                  )}
                  {msg.decoded?.decoded?.protocolId && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                      {msg.decoded.decoded.protocolId}
                    </span>
                  )}
                  {msg.crcValid !== undefined && (
                    <span className={`px-2 py-0.5 rounded ${msg.crcValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      CRC: {msg.crcValid ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
