import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUser, isTokenValid, silentRefresh, logout as authLogout, JwtPayload } from '../lib/auth';

interface AuthContextValue {
  user: JwtPayload | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (isTokenValid()) {
        setUser(getUser());
      } else {
        const ok = await silentRefresh();
        if (ok) setUser(getUser());
      }
      setLoading(false);
    }
    init();
  }, []);

  async function logout() {
    await authLogout();
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
