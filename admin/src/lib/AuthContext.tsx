import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logout as logoutRequest } from "./auth";
import {
  clearTokens,
  getActingTenantId,
  getCurrentAccount,
  setActingTenantId,
  type Account,
  type WayatPrincipal,
} from "./tokenStore";

interface AuthContextValue {
  /** Whoever is signed in (null = signed out). */
  account: Account | null;
  /** The tenant the tenant pages work in — the admin's own, or the one a super admin stepped
   *  into. Null for a super admin on the platform pages. */
  principal: WayatPrincipal | null;
  isSuperAdmin: boolean;
  /** Super admin only: step into a tenant (null = back to the platform pages). */
  actAs: (tenantId: string | null) => void;
  /** Call after verifyOtp() has already stored the tokens — just refreshes this context's view
   *  of who's logged in. */
  refreshPrincipal: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function principalOf(account: Account | null, acting: string | null): WayatPrincipal | null {
  if (!account) return null;
  if (account.role === "SUPER_ADMIN") return acting ? { ...account, tenantId: acting } : null;
  return account.tenantId ? { ...account, tenantId: account.tenantId } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<Account | null>(getCurrentAccount);
  const [acting, setActing] = useState<string | null>(getActingTenantId);

  const refreshPrincipal = () => {
    setAccount(getCurrentAccount());
    setActing(getActingTenantId());
  };

  const actAs = (tenantId: string | null) => {
    setActingTenantId(tenantId);
    setActing(tenantId);
    // Some cached lists aren't keyed by tenant (the demand board) — start clean in the new one.
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "platform" });
  };

  const logout = async () => {
    await logoutRequest();
    clearTokens();
    setAccount(null);
    setActing(null);
    queryClient.clear();
  };

  const isSuperAdmin = account?.role === "SUPER_ADMIN";
  return (
    <AuthContext.Provider
      value={{ account, principal: principalOf(account, isSuperAdmin ? acting : null), isSuperAdmin, actAs, refreshPrincipal, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
