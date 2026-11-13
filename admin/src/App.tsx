import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute, SuperAdminRoute, TenantRoute } from "./layout/ProtectedRoute";
import { AuthProvider } from "./lib/AuthContext";
import { ToastProvider } from "./lib/ToastContext";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DemandPage } from "./pages/DemandPage";
import { DriversVehiclesPage } from "./pages/DriversVehiclesPage";
import { LoginPage } from "./pages/LoginPage";
import { FleetOverviewPage } from "./pages/FleetOverviewPage";
import { TenantsPage } from "./pages/TenantsPage";
import { RoutesStopsPage } from "./pages/RoutesStopsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudentManagementPage } from "./pages/StudentManagementPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route element={<SuperAdminRoute />}>
                    <Route path="/platform" element={<FleetOverviewPage />} />
                    <Route path="/platform/tenants" element={<TenantsPage />} />
                  </Route>
                  <Route element={<TenantRoute />}>
                  <Route path="/" element={<ComingSoonPage title="Dashboard" />} />
                  <Route path="/live-operations" element={<ComingSoonPage title="Live Operations" />} />
                  <Route path="/approvals" element={<ApprovalsPage />} />
                  <Route path="/demand" element={<DemandPage />} />
                  <Route path="/students" element={<StudentManagementPage />} />
                  <Route path="/drivers-vehicles" element={<DriversVehiclesPage />} />
                  <Route path="/routes-stops" element={<RoutesStopsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
