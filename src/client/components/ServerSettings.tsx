import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function ServerSettings() {
  const { getAuthHeaders } = useAuth();
  const [httpPort, setHttpPort] = useState(3000);
  const [tcpPort, setTcpPort] = useState(29479);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setHttpPort(data.data.httpPort);
        setTcpPort(data.data.tcpPort);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ httpPort, tcpPort }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('✅ Portas atualizadas com sucesso!');
      } else {
        setStatus('❌ Erro: ' + (data.error || 'Falha ao atualizar'));
      }
    } catch (error) {
      setStatus('❌ Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-gray-800 mb-2">🔌 Portas do Servidor</h3>
      <p className="text-sm text-gray-600 mb-4">
        Modifique as portas HTTP e TCP. O servidor reinicia internamente nessas portas após salvar.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Porta HTTP</label>
          <input
            type="number"
            min="1"
            max="65535"
            value={httpPort}
            onChange={(e) => setHttpPort(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Porta TCP (OBD)</label>
          <input
            type="number"
            min="1"
            max="65535"
            value={tcpPort}
            onChange={(e) => setTcpPort(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={saveSettings}
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? '⏳ Salvando...' : '💾 Salvar Portas'}
        </button>

        {status && (
          <div className={`px-4 py-2 rounded-lg text-sm ${
            status.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
