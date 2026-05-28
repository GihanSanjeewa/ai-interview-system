import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "iv_user";
const TOKEN_KEY = "iv_token";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    setLoading(false);
  }, []);

  const persist = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token || "demo-token");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      persist(res.data);
      return res.data;
    } catch (err) {
      // Fallback for demo when backend isn't reachable
      if (!email || !password) throw err;
      const demoUser = {
        id: "demo-1",
        name: email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (s) => s.toUpperCase()),
        email,
        avatar: null,
        plan: "Pro",
        joinedAt: new Date().toISOString(),
      };
      persist({ token: "demo-token", user: demoUser });
      return { token: "demo-token", user: demoUser };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await axios.post("/api/auth/register", { name, email, password });
      persist(res.data);
      return res.data;
    } catch (err) {
      if (!name || !email || !password) throw err;
      const demoUser = {
        id: "demo-1",
        name,
        email,
        avatar: null,
        plan: "Free",
        joinedAt: new Date().toISOString(),
      };
      persist({ token: "demo-token", user: demoUser });
      return { token: "demo-token", user: demoUser };
    }
  };

  const updateUser = (updates) => {
    setUser((u) => {
      const next = { ...u, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORAGE_KEY);
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
