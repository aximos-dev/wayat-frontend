import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./layout/ProtectedRoute";
import { AuthProvider } from "./lib/AuthContext";
import { ToastProvider } from "./lib/ToastContext";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DriversVehiclesPage } from "./pages/DriversVehiclesPage";
import { LoginPage } from "./pages/LoginPage";
import { RoutesStopsPage } from "./pages/RoutesStopsPage";
import { SettingsPage } from "./pages/SettingsPage";

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
                  <Route path="/" element={<ComingSoonPage title="Dashboard" />} />
                  <Route path="/live-operations" element={<ComingSoonPage title="Live Operations" />} />
                  <Route path="/approvals" element={<ComingSoonPage title="Approvals" />} />
                  <Route path="/students" element={<ComingSoonPage title="Students" />} />
                  <Route path="/drivers-vehicles" element={<DriversVehiclesPage />} />
                  <Route path="/routes-stops" element={<RoutesStopsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
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
