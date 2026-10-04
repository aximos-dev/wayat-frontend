import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./layout/ProtectedRoute";
import { AuthProvider } from "./lib/AuthContext";
import { AddRoutePage } from "./pages/AddRoutePage";
import { AddVehiclePage } from "./pages/AddVehiclePage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { LoginPage } from "./pages/LoginPage";
import { RoutesStopsPage } from "./pages/RoutesStopsPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
                <Route path="/drivers" element={<ComingSoonPage title="Drivers" />} />
                <Route path="/routes-stops" element={<RoutesStopsPage />} />
                <Route path="/routes-stops/routes/new" element={<AddRoutePage />} />
                <Route path="/routes-stops/vehicles/new" element={<AddVehiclePage />} />
                <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
