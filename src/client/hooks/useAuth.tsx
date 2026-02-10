import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface AuthData {
  token: string;
  username: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  auth: AuthData | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('telemetry_auth');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setAuth(data);
      } catch (e) {
        localStorage.removeItem('telemetry_auth');
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const authData: AuthData = {
            token: result.data.token,
            username: result.data.username,
            role: result.data.role,
          };
          setAuth(authData);
          localStorage.setItem('telemetry_auth', JSON.stringify(authData));
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem('telemetry_auth');
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    return headers;
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
