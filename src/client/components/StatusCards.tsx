import { useState, useEffect } from 'react';

export default function StatusCards() {
  const [vehicleCount, setVehicleCount] = useState(0);
  const [tcpPort, setTcpPort] = useState<number | null>(null);
  const [httpPort, setHttpPort] = useState<number | null>(null);
  const [tcpStatus, setTcpStatus] = useState('...');
  const [httpStatus, setHttpStatus] = useState('...');

  useEffect(() => {
    fetch('/api/vehicles')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.vehicles) {
          setVehicleCount(Object.keys(data.data.vehicles).length);
        }
      })
      .catch(console.error);

    fetch('/health')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.servers) {
          const { tcp, http } = data.data.servers;
          setTcpPort(tcp.port);
          setTcpStatus(tcp.status === 'Ativo' ? '✅' : '❌');
          setHttpPort(http.port);
          setHttpStatus(http.status === 'Ativo' ? '✅' : '❌');
        }
      })
      .catch(console.error);
  }, []);

  const cards = [
    { label: 'Servidor OBD', value: `${tcpStatus} TCP: Porta ${tcpPort ?? '...'}`, color: 'from-green-500 to-emerald-600' },
    { label: 'API REST', value: `${httpStatus} HTTP: Porta ${httpPort ?? '...'}`, color: 'from-blue-500 to-cyan-600' },
    { label: 'SQLite + JSON', value: '✅ Base de Dados Ativa', color: 'from-purple-500 to-pink-600' },
    { label: 'Sistema Ativo', value: `🚗 ${vehicleCount} Veículos Cadastrados`, color: 'from-orange-500 to-red-600' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`bg-gradient-to-br ${card.color} text-white p-4 rounded-xl shadow-lg transform hover:scale-105 transition-transform`}
        >
          <div className="text-lg font-bold">{card.value}</div>
          <div className="text-sm opacity-90 mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
