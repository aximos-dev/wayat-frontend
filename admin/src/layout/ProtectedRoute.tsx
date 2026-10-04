import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function ProtectedRoute() {
  const { principal } = useAuth();
  if (!principal) return <Navigate to="/login" replace />;
  return <Outlet />;
}
