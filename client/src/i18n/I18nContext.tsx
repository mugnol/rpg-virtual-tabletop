import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { updateUserPreferences } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import enBundle from "../locales/en.json";
import ptBrBundle from "../locales/pt-BR.json";

export type Locale = "en" | "pt-BR";

const bundles: Record<Locale, Record<string, any>> = {
  en: enBundle,
  "pt-BR": ptBrBundle,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveKey(obj: any, path: string): string | undefined {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("preferredLocale");
    if (saved === "en" || saved === "pt-BR") {
      return saved;
    }
    return "en";
  });

  // Sync when authenticated user changes or loads
  useEffect(() => {
    if (user?.preferredLocale && (user.preferredLocale === "en" || user.preferredLocale === "pt-BR")) {
      setLocaleState(user.preferredLocale as Locale);
      localStorage.setItem("preferredLocale", user.preferredLocale);
    }
  }, [user]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      setLocaleState(newLocale);
      localStorage.setItem("preferredLocale", newLocale);
      if (user) {
        try {
          await updateUserPreferences({ preferredLocale: newLocale });
        } catch (err) {
          console.error("Failed to persist preferred locale", err);
        }
      }
    },
    [user],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = resolveKey(bundles[locale], key);
      if (!text && locale !== "en") {
        text = resolveKey(bundles.en, key);
      }
      if (!text) {
        return key;
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`{{${k}}}`, "g"), String(v));
        }
      }
      return text;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
