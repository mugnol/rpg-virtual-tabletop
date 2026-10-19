import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getSystem,
  importSystemRaw,
  listSystems,
  type SystemConfig,
  type SystemSummary,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

export function SystemsPage() {
  const { user } = useAuth();
  const [systems, setSystems] = useState<SystemSummary[] | null>(null);
  const [selected, setSelected] = useState<SystemConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(() => {
    listSystems()
      .then(({ systems: rows }) => {
        setSystems(rows);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load systems");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onViewDetail(key: string) {
    try {
      const { system } = await getSystem(key);
      setSelected(system);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load system details");
    }
  }

  async function onImportSubmit(event: FormEvent) {
    event.preventDefault();
    setImportError(null);
    if (importJson.trim() === "") {
      setImportError("Please provide a system configuration JSON document");
      return;
    }
    setImporting(true);
    try {
      await importSystemRaw(importJson);
      setImportJson("");
      refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import system");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main data-testid="page-systems" className="page">
      <h1>Installed Game Systems</h1>
      {loadError && <FormError message={loadError} />}
      {systems !== null && (
        <ul data-testid="system-list" className="campaign-list">
          {systems.map((sys) => (
            <li key={`${sys.key}-${sys.version}`} className="card system-card">
              <div className="detail-header">
                <strong data-testid="system-item">{sys.name}</strong>
                <span className="campaign-item-system">
                  {sys.key} v{sys.version} {sys.builtin ? "(Built-in)" : "(Imported)"}
                </span>
                <div className="button-row" style={{ marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onViewDetail(sys.key)}
                  >
                    Details
                  </button>
                  <a
                    data-testid="system-export-button"
                    className="btn btn-secondary"
                    href={`/api/systems/${sys.key}/export`}
                    download={`${sys.key}-${sys.version}.json`}
                  >
                    Export
                  </a>
                </div>
              </div>
              <p data-testid="system-attribution" className="system-attribution">
                {sys.attribution}
              </p>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <section className="card panel">
          <div className="detail-header">
            <h2>
              {selected.name} (v{selected.version})
            </h2>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginLeft: "auto" }}
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
          <p className="detail-description">
            Abilities: {selected.abilities.map((a) => `${a.name} (${a.abbreviation})`).join(", ")}
          </p>
          <p className="detail-description">
            Classes: {selected.classes.map((c) => `${c.name} (d${c.hitDie})`).join(", ")}
          </p>
          <p className="detail-description">
            Ancestries: {selected.ancestries.map((a) => a.name).join(", ")}
          </p>
          <p className="detail-description">
            Armor: {selected.armor.map((a) => `${a.name} (AC ${a.base})`).join(", ")}
          </p>
        </section>
      )}

      {user?.role === "GM" && (
        <section className="panel">
          <form
            data-testid="system-import-form"
            className="card form"
            onSubmit={onImportSubmit}
          >
            <h2>Import System Configuration</h2>
            <FormError message={importError} />
            <label>
              Configuration JSON
              <textarea
                data-testid="system-import-input"
                rows={8}
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"key": "my-system", ...}'
              />
            </label>
            <button
              data-testid="system-import-submit"
              type="submit"
              className="btn btn-primary"
              disabled={importing}
            >
              Import system
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
