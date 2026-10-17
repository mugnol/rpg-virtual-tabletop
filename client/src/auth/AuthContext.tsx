import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister, type RegisterInput, type User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  /** True until the initial GET /api/auth/me has settled. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        // No/invalid session — treated as logged out (UC-04 AF-4.1).
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await apiLogin(email, password);
    setUser(user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await apiRegister(input);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
