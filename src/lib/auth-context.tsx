"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserSession } from "@/lib/auth";

type AuthContextType = {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserSession>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<UserSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user ?? null);
        if (data.user?.name) {
          window.localStorage.setItem("vibemeet-name", data.user.name);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!active) return;
        if (response.ok) {
          const data = await response.json();
          setUser(data.user ?? null);
          if (data.user?.name) {
            window.localStorage.setItem("vibemeet-name", data.user.name);
          }
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<UserSession> => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to log in.");
      }
      setUser(data.user);
      if (data.user?.name) {
        window.localStorage.setItem("vibemeet-name", data.user.name);
      }
      return data.user;
    },
    [],
  );

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
    ): Promise<UserSession> => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to sign up.");
      }
      setUser(data.user);
      if (data.user?.name) {
        window.localStorage.setItem("vibemeet-name", data.user.name);
      }
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

