import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { useTheme } from "../theme/ThemeContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const { activeTheme, themes, setTheme } = useTheme();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="nav-bar">
      <Link to="/" className="nav-brand">
        {t("nav.brand")}
      </Link>
      <nav className="nav-links">
        <Link to="/" data-testid="nav-dashboard-link" className="nav-link">
          {t("nav.dashboard")}
        </Link>
        <Link to="/systems" data-testid="nav-systems-link" className="nav-link">
          {t("nav.systems")}
        </Link>
        <Link to="/themes" data-testid="nav-themes-link" className="nav-link">
          {t("nav.themes")}
        </Link>
      </nav>

      <div className="nav-selectors">
        <select
          data-testid="theme-select"
          className="select-compact"
          value={activeTheme}
          onChange={(e) => setTheme(e.target.value)}
          title={t("nav.themeSelect")}
        >
          {themes.map((th) => (
            <option key={th.key} value={th.key}>
              {th.name}
            </option>
          ))}
        </select>

        <select
          data-testid="locale-select"
          className="select-compact"
          value={locale}
          onChange={(e) => setLocale(e.target.value as "en" | "pt-BR")}
          title={t("nav.languageSelect")}
        >
          <option value="en">English</option>
          <option value="pt-BR">Português (BR)</option>
        </select>
      </div>

      {user ? (
        <>
          <span data-testid="nav-user" className="nav-user">
            {user.displayName} ({user.role})
          </span>
          <button
            type="button"
            data-testid="logout-button"
            className="btn btn-secondary"
            onClick={onLogout}
          >
            {t("nav.logout")}
          </button>
        </>
      ) : (
        <div className="nav-auth-links">
          <Link to="/login" className="btn btn-secondary">
            {t("nav.login")}
          </Link>
          <Link to="/register" className="btn btn-primary">
            {t("nav.register")}
          </Link>
        </div>
      )}
    </header>
  );
}
