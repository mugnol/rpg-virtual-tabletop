import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NavBar } from "../components/NavBar";

export function LoadingScreen() {
  return (
    <div className="page-loading">
      <p>Loading…</p>
    </div>
  );
}

/** Wraps protected pages: nav bar + redirect to /login when unauthenticated. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

/** Wraps public-only pages (login/register): redirect to / when authenticated. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
