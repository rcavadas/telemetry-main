export default function ApiEndpoints() {
  const endpoints = [
    {
      title: '🏥 Health Check',
      method: 'GET',
      path: '/health',
      description: 'Verifica o status dos servidores e recursos do sistema.',
      testable: true,
    },
    {
      title: '📱 Listar Dispositivos',
      method: 'GET',
      path: '/api/devices',
      description: 'Retorna lista de todos os dispositivos OBD com dados disponíveis.',
      testable: true,
    },
    {
      title: '🚗 Listar Veículos',
      method: 'GET',
      path: '/api/vehicles',
      description: 'Retorna lista de todos os veículos registrados na frota.',
      testable: true,
    },
    {
      title: '🔧 Atualizar Veículo',
      method: 'PUT',
      path: '/api/vehicles/:deviceId',
      description: 'Atualiza informações de um veículo específico.',
      testable: false,
    },
    {
      title: '📊 Relatório JSON',
      method: 'GET',
      path: '/api/reports/:deviceId',
      description: 'Gera relatório completo de análise do dispositivo em formato JSON.',
      testable: true,
    },
    {
      title: '📄 Relatório Markdown',
      method: 'GET',
      path: '/api/reports/:deviceId/markdown',
      description: 'Baixa relatório detalhado em formato Markdown.',
      testable: true,
      download: true,
    },
    {
      title: '📡 Leituras Brutas',
      method: 'GET',
      path: '/api/readings/:deviceId',
      description: 'Retorna dados brutos de telemetria do dispositivo.',
      testable: true,
    },
    {
      title: '🔍 Decoder Hexadecimal',
      method: 'POST',
      path: '/api/decode-hex',
      description: 'Decodifica dados hexadecimais OBD em tempo real.',
      testable: false,
    },
  ];

  const testEndpoint = async (path: string) => {
    try {
      const response = await fetch(path);
      const data = await response.json();
      alert(JSON.stringify(data, null, 2));
    } catch (error) {
      alert('Erro ao testar endpoint: ' + error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🌐 Endpoints da API</h1>
        <p className="text-gray-600">Documentação e testes dos endpoints disponíveis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {endpoints.map((endpoint, index) => (
          <div key={index} className="card hover:shadow-2xl transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 mb-2">{endpoint.title}</h3>
            <div className="bg-gray-100 px-3 py-2 rounded-lg mb-3 font-mono text-sm">
              {endpoint.method} {endpoint.path}
            </div>
            <p className="text-gray-600 text-sm mb-4">{endpoint.description}</p>
            {endpoint.testable && (
              <button
                onClick={() => testEndpoint(endpoint.path.replace(':deviceId', '218LSAB2025000004'))}
                className="btn-primary text-sm py-2 w-full"
              >
                {endpoint.download ? '📥 Download' : '🔍 Testar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
