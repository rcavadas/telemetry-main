import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export default function UserManagement() {
  const { getAuthHeaders } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const createUser = async () => {
    if (!newUsername || !newPassword) {
      setStatus('❌ Preencha todos os campos');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('✅ Usuário criado com sucesso!');
        setNewUsername('');
        setNewPassword('');
        loadUsers();
      } else {
        setStatus('❌ Erro: ' + (data.error || 'Falha ao criar usuário'));
      }
    } catch (error) {
      setStatus('❌ Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('✅ Usuário removido com sucesso!');
        loadUsers();
      } else {
        setStatus('❌ Erro: ' + (data.error || 'Falha ao remover usuário'));
      }
    } catch (error) {
      setStatus('❌ Erro de conexão');
    }
  };

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-gray-800 mb-2">👥 Usuários</h3>
      <p className="text-sm text-gray-600 mb-4">
        Crie usuários com nível de acesso administrador ou apenas visualização.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="novo usuário"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="senha"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">Usuário (visualização)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <button
          onClick={createUser}
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? '⏳ Criando...' : '➕ Criar Usuário'}
        </button>

        {status && (
          <div className={`px-4 py-2 rounded-lg text-sm ${
            status.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {status}
          </div>
        )}

        <div className="mt-6">
          <h4 className="font-semibold text-gray-800 mb-3">Usuários Cadastrados</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Usuário</th>
                  <th className="px-3 py-2 text-left">Papel</th>
                  <th className="px-3 py-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="px-3 py-2">{user.id}</td>
                    <td className="px-3 py-2 font-medium">{user.username}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
