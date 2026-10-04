import { createContext, useContext, useState, type ReactNode } from "react";
import { logout as logoutRequest } from "./auth";
import { clearTokens, getCurrentPrincipal, type WayatPrincipal } from "./tokenStore";

interface AuthContextValue {
  principal: WayatPrincipal | null;
  /** Call after verifyOtp() has already stored the tokens — just refreshes this context's view
   *  of who's logged in. */
  refreshPrincipal: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<WayatPrincipal | null>(getCurrentPrincipal);

  const refreshPrincipal = () => setPrincipal(getCurrentPrincipal());

  const logout = async () => {
    await logoutRequest();
    clearTokens();
    setPrincipal(null);
  };

  return (
    <AuthContext.Provider value={{ principal, refreshPrincipal, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
