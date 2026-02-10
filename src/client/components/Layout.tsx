import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { auth, logout } = useAuth(); // Mantido para uso futuro se necessário

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const isTracking = location.pathname === '/tracking';

  return (
    <div className="flex min-h-screen">
      <Sidebar isActive={isActive} />
      <main
        className={`flex-1 ml-72 ${isTracking ? 'p-0' : 'p-6'} ${isTracking ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {isTracking ? (
          // Rastreamento: mapa em tela cheia (área útil) como no Traccar
          <div className="w-full h-screen relative">
            {children}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
