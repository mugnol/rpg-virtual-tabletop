import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="nav-bar">
      <span className="nav-brand">RPG Virtual Tabletop</span>
      <span data-testid="nav-user" className="nav-user">
        {user ? `${user.displayName} (${user.role})` : ""}
      </span>
      <button type="button" data-testid="logout-button" className="btn btn-secondary" onClick={onLogout}>
        Log out
      </button>
    </header>
  );
}
