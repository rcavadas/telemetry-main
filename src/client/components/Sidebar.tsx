import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';

interface SidebarProps {
  isActive: (path: string) => boolean;
}

export default function Sidebar({ isActive }: SidebarProps) {
  const { auth, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const menuItems = [
    { path: '/', icon: '📊', label: 'Dashboard' },
    { path: '/tracking', icon: '📍', label: 'Rastreamento' },
    { path: '/vehicles', icon: '🚗', label: 'Cadastro de Veículos' },
    { path: '/api', icon: '🌐', label: 'Endpoints API' },
    { path: '/settings', icon: '⚙️', label: 'Configurações' },
  ];

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-72 bg-white/98 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 text-center border-b-2 border-white/20">
          <h1 className="text-2xl font-bold">🚗 Telemetria</h1>
          <p className="text-sm opacity-90 mt-1">Sistema Multi-Protocolo</p>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 mb-2 rounded-xl transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer with Auth */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            {auth ? (
              <>
                <div className="mb-3 px-3 py-2 rounded-lg bg-green-100 text-green-800 text-sm font-medium">
                  🔐 {auth.username} ({auth.role})
                </div>
                <button
                  onClick={logout}
                  className="w-full btn-secondary text-sm py-2"
                >
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full btn-primary text-sm py-2"
              >
                🔐 Login
              </button>
            )}
          </div>
        </div>
      </aside>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
