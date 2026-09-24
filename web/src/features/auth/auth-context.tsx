import * as React from 'react';
import { User, getToken, getUser, setAuth, clearAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(getUser());
  const [token, setToken] = React.useState<string | null>(getToken());
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const initAuth = async () => {
      const currentToken = getToken();
      if (currentToken) {
        try {
          const res = await api.get<User>('/api/v1/auth/me');
          setUser(res);
        } catch (error) {
          clearAuth();
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = React.useCallback(async (username: string, password: string) => {
    const res = await api.post<LoginResponse>('/api/v1/auth/login', { username, password });
    setAuth(res.token, res.user);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        keepalive: true
      });
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearAuth();
      window.location.replace('/v2/login');
      window.setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
