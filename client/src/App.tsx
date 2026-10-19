import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth } from "./components/RouteGuards";
import { CampaignDetailPage } from "./pages/CampaignDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SheetPage } from "./pages/SheetPage";
import { SystemsPage } from "./pages/SystemsPage";

export function App() {
  return (
    <Routes>
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        path="/login"
        element={
          // Always rendered: a logged-in user may need to switch accounts
          // (the suite logs in as a second user without logging out first).
          <LoginPage />
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/systems"
        element={
          <RequireAuth>
            <SystemsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/campaigns/:id"
        element={
          <RequireAuth>
            <CampaignDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sheets/:id"
        element={
          <RequireAuth>
            <SheetPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
