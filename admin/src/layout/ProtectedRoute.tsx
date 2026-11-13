import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function ProtectedRoute() {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** The tenant pages: need a tenant — a super admin who hasn't stepped into one goes to the
 *  platform pages instead. */
export function TenantRoute() {
  const { principal, isSuperAdmin } = useAuth();
  if (!principal) return <Navigate to={isSuperAdmin ? "/platform" : "/login"} replace />;
  return <Outlet />;
}

/** Our ops team's pages. */
export function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
