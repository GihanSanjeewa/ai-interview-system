import { createContext, useContext, useEffect, useState } from "react";
import { authApi, setAccessToken } from "@/services/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const USER_KEY = "iv_user";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await authApi.me();
        if (cancelled) return;
        setUser(me);
        localStorage.setItem(USER_KEY, JSON.stringify(me));
      } catch {
        // Not logged in or refresh failed — keep cached user; pages requiring auth will redirect.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    persist(data);
    return data;
  };

  const register = async (fullName, email, password) => {
    const data = await authApi.register({ fullName, email, password });
    persist(data);
    return data;
  };

  const updateUser = async (patch) => {
    const { user: updated } = await authApi.updateProfile(patch);
    setUser(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    return updated;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    setAccessToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, updateUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
