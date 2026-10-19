import { useState, type FormEvent } from "react";
import { importTheme } from "../api/client";
import { FormError } from "../components/FormError";
import { useI18n } from "../i18n/I18nContext";
import { useTheme } from "../theme/ThemeContext";

export function ThemesPage() {
  const { themes, activeTheme, setTheme, refreshThemes } = useTheme();
  const { t } = useI18n();

  const [importJson, setImportJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImportSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson.trim());
    } catch {
      setError("Please provide a valid JSON theme configuration document");
      return;
    }

    setSubmitting(true);
    try {
      await importTheme(parsed);
      setImportJson("");
      await refreshThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import theme");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main data-testid="page-themes" className="page">
      <div className="detail-header">
        <div>
          <h1>{t("themes.title")}</h1>
          <p className="description">{t("themes.description")}</p>
        </div>
      </div>

      <FormError message={error} />

      <section className="themes-grid">
        <ul className="campaign-list">
          {themes.map((theme) => {
            const isActive = activeTheme === theme.key;
            return (
              <li
                key={theme.key}
                data-testid={`theme-card-${theme.key}`}
                className={`card theme-card ${isActive ? "theme-card-active" : ""}`}
              >
                <div className="detail-header">
                  <div>
                    <strong className="theme-name">{theme.name}</strong>
                    <span className="campaign-item-system" style={{ marginLeft: "0.5rem" }}>
                      ({theme.key}) {theme.builtin ? `[${t("themes.builtinBadge")}]` : `[${t("themes.customBadge")}]`}
                    </span>
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setTheme(theme.key)}
                    >
                      {isActive ? "Active" : "Apply"}
                    </button>
                    <a
                      data-testid="theme-export-button"
                      className="btn btn-secondary"
                      href={`/api/themes/${theme.key}/export`}
                      download={`${theme.key}-theme.json`}
                    >
                      {t("themes.export")}
                    </a>
                  </div>
                </div>
                {theme.description && <p className="theme-description">{theme.description}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: "2rem" }}>
        <h2>{t("themes.importTitle")}</h2>
        <form className="card form" onSubmit={handleImportSubmit}>
          <label>
            Theme JSON
            <textarea
              data-testid="theme-import-input"
              rows={8}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={t("themes.importPlaceholder")}
              required
            />
          </label>
          <button
            data-testid="theme-import-submit"
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {t("themes.importButton")}
          </button>
        </form>
      </section>
    </main>
  );
}
