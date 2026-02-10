import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import ServerSettings from '../components/ServerSettings';
import UserManagement from '../components/UserManagement';

export default function Settings() {
  const { auth } = useAuth();

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">⚙️ Configurações do Sistema</h1>
        <p className="text-gray-600">Configure portas e gerencie usuários do sistema</p>
      </div>

      {!auth || auth.role !== 'admin' ? (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800">
            Para alterar configurações, faça login como administrador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ServerSettings />
          <UserManagement />
        </div>
      )}
    </div>
  );
}
