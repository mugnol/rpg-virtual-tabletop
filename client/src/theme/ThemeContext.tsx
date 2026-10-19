import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getTheme,
  listThemes,
  updateUserPreferences,
  type ThemeConfig,
  type ThemeSummary,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface ThemeContextValue {
  activeTheme: string;
  themes: ThemeSummary[];
  setTheme: (key: string) => Promise<void>;
  refreshThemes: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeVariables(theme: ThemeConfig) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.key);

  const { colors, typography, borderRadius, customProperties } = theme;
  root.style.setProperty("--theme-bg-primary", colors.bgPrimary);
  root.style.setProperty("--theme-bg-secondary", colors.bgSecondary);
  root.style.setProperty("--theme-bg-panel", colors.bgPanel);
  root.style.setProperty("--theme-text-primary", colors.textPrimary);
  root.style.setProperty("--theme-text-secondary", colors.textSecondary);
  root.style.setProperty("--theme-accent", colors.accent);
  root.style.setProperty("--theme-accent-hover", colors.accentHover);
  root.style.setProperty("--theme-border", colors.border);
  root.style.setProperty("--theme-danger", colors.danger);

  root.style.setProperty("--theme-font-sans", typography.fontFamilySans);
  root.style.setProperty("--theme-font-heading", typography.fontFamilyHeading);
  root.style.setProperty("--theme-font-mono", typography.fontFamilyMono);
  root.style.setProperty("--theme-border-radius", borderRadius);

  if (customProperties) {
    for (const [key, val] of Object.entries(customProperties)) {
      root.style.setProperty(`--theme-${key}`, val);
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [themes, setThemes] = useState<ThemeSummary[]>([
    { key: "medieval", name: "Medieval", description: "Warm parchment and dark tavern aesthetic", builtin: true },
    { key: "cyberpunk", name: "Cyberpunk", description: "High-contrast dark synth aesthetic", builtin: true },
  ]);

  const [activeTheme, setActiveThemeState] = useState<string>(() => {
    return localStorage.getItem("preferredTheme") || "medieval";
  });

  const refreshThemes = useCallback(async () => {
    try {
      const res = await listThemes();
      if (res.themes && res.themes.length > 0) {
        setThemes(res.themes);
      }
    } catch {
      // Fallback to builtins if not loaded yet
    }
  }, []);

  useEffect(() => {
    refreshThemes();
  }, [refreshThemes]);

  // Load and apply theme configuration
  const applyThemeByKey = useCallback(async (key: string) => {
    try {
      const { theme } = await getTheme(key);
      applyThemeVariables(theme);
    } catch {
      document.documentElement.setAttribute("data-theme", key);
    }
  }, []);

  // Update theme when activeTheme changes
  useEffect(() => {
    applyThemeByKey(activeTheme);
  }, [activeTheme, applyThemeByKey]);

  // Synchronize with authenticated user preferences
  useEffect(() => {
    if (user?.preferredTheme) {
      setActiveThemeState(user.preferredTheme);
      localStorage.setItem("preferredTheme", user.preferredTheme);
    }
  }, [user]);

  const setTheme = useCallback(
    async (newTheme: string) => {
      setActiveThemeState(newTheme);
      localStorage.setItem("preferredTheme", newTheme);
      await applyThemeByKey(newTheme);

      if (user) {
        try {
          await updateUserPreferences({ preferredTheme: newTheme });
        } catch (err) {
          console.error("Failed to persist preferred theme", err);
        }
      }
    },
    [user, applyThemeByKey],
  );

  return (
    <ThemeContext.Provider value={{ activeTheme, themes, setTheme, refreshThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
