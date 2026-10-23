import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteSheet,
  executeShadowdarkAction,
  exportShadowdarklingsSheet,
  getCampaign,
  getSheet,
  getSystem,
  levelUpSheet,
  updateSheet,
  type CampaignDetail,
  type SheetDetail,
  type SystemConfig,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function SheetPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportedJson, setExportedJson] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getSheet(id)
      .then(async ({ sheet: loaded }) => {
        if (cancelled) return;
        setSheet(loaded);
        const [{ campaign: camp }, { system: sys }] = await Promise.all([
          getCampaign(loaded.campaignId),
          getSystem(loaded.systemKey),
        ]);
        if (cancelled) return;
        setCampaign(camp);
        if (camp.system && camp.system !== "generic" && camp.system !== loaded.systemKey) {
          const { system: activeSys } = await getSystem(camp.system);
          if (!cancelled) setConfig(activeSys);
        } else {
          setConfig(sys);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load character sheet");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadError) {
    return (
      <main data-testid="page-sheet" className="page">
        <p className="empty-state">{loadError}</p>
      </main>
    );
  }
  if (!sheet || !config) {
    return (
      <main data-testid="page-sheet" className="page">
        <p className="empty-state">Loading…</p>
      </main>
    );
  }

  const isCampaignOwner =
    campaign?.members.some((m) => m.role === "OWNER" && m.userId === user?.id) ?? false;
  const canModify = isCampaignOwner || (sheet.kind === "PC" && sheet.ownerId === user?.id);

  const ancestryName =
    config.ancestries.find((a) => a.key === sheet.ancestryId)?.name ?? sheet.ancestryId ?? "—";
  const className =
    config.classes.find((c) => c.key === sheet.classId)?.name ?? sheet.classId ?? "—";
  const backgroundName =
    config.backgrounds.find((b) => b.key === sheet.backgroundId)?.name ??
    sheet.backgroundId ??
    "—";

  async function onLevelUp() {
    if (!sheet) return;
    setActionError(null);
    setBusy(true);
    try {
      const { sheet: updated } = await levelUpSheet(sheet.id);
      setSheet(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to level up");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!sheet) return;
    if (!window.confirm("Delete this character sheet?")) return;
    setActionError(null);
    setBusy(true);
    try {
      await deleteSheet(sheet.id);
      navigate(`/campaigns/${sheet.campaignId}`);
    } catch (err) {
      setBusy(false);
      setActionError(err instanceof Error ? err.message : "Failed to delete sheet");
    }
  }

  async function onExportShadowdarklings() {
    if (!sheet) return;
    setActionError(null);
    setBusy(true);
    try {
      const { character } = await exportShadowdarklingsSheet(sheet.id);
      setExportedJson(JSON.stringify(character, null, 2));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to export Shadowdarklings JSON");
    } finally {
      setBusy(false);
    }
  }

  async function onShadowdarkRest() {
    if (!sheet) return;
    setActionError(null);
    setBusy(true);
    try {
      const { sheet: updated } = await executeShadowdarkAction(sheet.id, { action: "rest" });
      setSheet(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to rest");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-testid="page-sheet" className="page">
      <p>
        <Link to={`/campaigns/${sheet.campaignId}`}>&larr; Back to campaign</Link>
      </p>
      <div className="detail-header">
        <h1 data-testid="sheet-name">{sheet.name}</h1>
        <span data-testid="sheet-kind-badge" className="badge">
          {sheet.kind}
        </span>
      </div>
      <p data-testid="sheet-identity" className="detail-description">
        {ancestryName} &middot; {className} &middot; {backgroundName}
      </p>
      {sheet.derived.shadowdark && (
        <p className="detail-description">
          Title: <strong data-testid="sheet-title">{sheet.derived.shadowdark.title}</strong>
          {" · "}Alignment:{" "}
          <strong data-testid="sheet-alignment">{sheet.derived.shadowdark.alignment}</strong>
          {" · "}Deity:{" "}
          <strong data-testid="sheet-deity">{sheet.derived.shadowdark.deity ?? "None"}</strong>
        </p>
      )}

      <div className="card stats-bar">
        <div className="stat-box">
          <span className="stat-label">Level</span>
          <strong data-testid="sheet-level">{sheet.level}</strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">XP</span>
          <span>
            <strong data-testid="sheet-xp">{sheet.xp}</strong> /{" "}
            <span data-testid="next-level-xp">
              {sheet.derived.nextLevelXp !== null ? sheet.derived.nextLevelXp : "MAX"}
            </span>
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">HP</span>
          <span>
            <strong data-testid="hp-current">{sheet.hpCurrent}</strong> /{" "}
            <span data-testid="hp-max">{sheet.hpMax}</span>
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">AC</span>
          <strong data-testid="ac-value">{sheet.derived.armorClass}</strong>
        </div>
        {sheet.derived.initiative !== null && (
          <div className="stat-box">
            <span className="stat-label">Initiative</span>
            <strong data-testid="initiative-value">
              {formatMod(sheet.derived.initiative)}
            </strong>
          </div>
        )}
        {sheet.derived.proficiencyBonus !== null && (
          <div className="stat-box">
            <span className="stat-label">Proficiency</span>
            <strong data-testid="pb-value">
              {formatMod(sheet.derived.proficiencyBonus)}
            </strong>
          </div>
        )}
        {sheet.derived.carrySlots !== null && (
          <div className="stat-box">
            <span className="stat-label">Carry Slots</span>
            <strong data-testid="carry-value">{sheet.derived.carrySlots}</strong>
          </div>
        )}
      </div>

      {canModify && (
        <section className="panel">
          <div className="button-row">
            {!editing && (
              <button
                data-testid="sheet-edit-button"
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
            {sheet.level < config.levels.max && (
              <button
                data-testid="level-up-button"
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={onLevelUp}
              >
                Level up
              </button>
            )}
            {sheet.derived.shadowdark && (
              <>
                <button
                  data-testid="export-shadowdarklings-button"
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={onExportShadowdarklings}
                >
                  Export Shadowdarklings JSON
                </button>
                <button
                  data-testid="shadowdark-rest-button"
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={onShadowdarkRest}
                >
                  Rest (8 hrs)
                </button>
              </>
            )}
            <button
              data-testid="sheet-delete-button"
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
          <FormError message={actionError} />
          {exportedJson && (
            <pre
              data-testid="shadowdarklings-json-preview"
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                maxHeight: "16rem",
                overflow: "auto",
                fontSize: "0.8rem",
              }}
            >
              {exportedJson}
            </pre>
          )}
        </section>
      )}

      {editing ? (
        <SheetEditForm
          sheet={sheet}
          config={config}
          onSaved={(updated) => {
            setSheet(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <section className="panel">
            <h2>Abilities</h2>
            <ul className="campaign-list">
              {config.abilities.map((a) => {
                const entry = sheet.abilities[a.key] ?? { score: 10, modifier: 0 };
                return (
                  <li key={a.key} data-testid="ability-row" className="campaign-item">
                    <span className="campaign-item-name">
                      {a.name} ({a.abbreviation})
                    </span>
                    <span style={{ marginLeft: "auto" }}>
                      Score: <strong data-testid="ability-score">{entry.score}</strong>
                    </span>
                    <span className="badge" data-testid="ability-modifier">
                      {formatMod(entry.modifier)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card panel">
            <h2>Equipment &amp; Extras</h2>
            <p className="detail-description">
              Armor:{" "}
              {config.armor.find((a) => a.key === sheet.armorId)?.name ??
                sheet.armorId ??
                "Unarmored"}
              {sheet.shield ? " + Shield" : ""}
            </p>
            {config.extras.talents && (
              <p className="detail-description">
                Talents: {sheet.extras.talents.length > 0 ? sheet.extras.talents.join(", ") : "None"}
              </p>
            )}
            {config.extras.spells && (
              <p className="detail-description">
                Spells:{" "}
                {sheet.extras.spells.length > 0 ? sheet.extras.spells.join(", ") : "None"}
                {sheet.derived.spellcasting
                  ? ` (${sheet.derived.spellcasting.known}/${sheet.derived.spellcasting.allowed} known)`
                  : ""}
              </p>
            )}
            {config.extras.notes && (
              <p className="detail-description">
                Notes: {sheet.extras.notes || "No notes."}
              </p>
            )}
          </section>
        </>
      )}

      <footer className="panel">
        <p data-testid="system-attribution" className="system-attribution">
          {config.attribution}
        </p>
      </footer>
    </main>
  );
}

function SheetEditForm({
  sheet,
  config,
  onSaved,
  onCancel,
}: {
  sheet: SheetDetail;
  config: SystemConfig;
  onSaved: (sheet: SheetDetail) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(sheet.name);
  const [ancestryId, setAncestryId] = useState(sheet.ancestryId ?? "");
  const [classId, setClassId] = useState(sheet.classId ?? "");
  const [backgroundId, setBackgroundId] = useState(sheet.backgroundId ?? "");
  const [armorId, setArmorId] = useState(sheet.armorId ?? "");
  const [shield, setShield] = useState(sheet.shield);
  const [hpCurrent, setHpCurrent] = useState(sheet.hpCurrent);
  const [hpMax, setHpMax] = useState(sheet.hpMax);
  const [xp, setXp] = useState(sheet.xp);
  const [abilities, setAbilities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const a of config.abilities) {
      map[a.key] = sheet.abilities[a.key]?.score ?? 10;
    }
    return map;
  });
  const [talentsText, setTalentsText] = useState(sheet.extras.talents.join(", "));
  const [spellsText, setSpellsText] = useState(sheet.extras.spells.join(", "));
  const [notes, setNotes] = useState(sheet.extras.notes);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { sheet: updated } = await updateSheet(sheet.id, {
        name: name.trim(),
        ancestryId: ancestryId || null,
        classId: classId || null,
        backgroundId: backgroundId || null,
        armorId: armorId || null,
        shield,
        hpCurrent,
        hpMax,
        xp,
        abilities,
        extras: {
          talents: talentsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          spells: spellsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notes,
          coins: sheet.extras.coins,
        },
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sheet");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form panel" onSubmit={onSubmit}>
      <h2>Edit Character Sheet</h2>
      <FormError message={error} />
      <label>
        Name
        <input
          data-testid="sheet-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="abilities-grid">
        <label>
          HP Current
          <input
            type="number"
            min={0}
            max={hpMax}
            value={hpCurrent}
            onChange={(e) => setHpCurrent(Number.parseInt(e.target.value, 10) || 0)}
          />
        </label>
        <label>
          HP Max
          <input
            type="number"
            min={1}
            value={hpMax}
            onChange={(e) => setHpMax(Number.parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label>
          XP
          <input
            type="number"
            min={0}
            value={xp}
            onChange={(e) => setXp(Number.parseInt(e.target.value, 10) || 0)}
          />
        </label>
      </div>
      <label>
        Ancestry / Species
        <select
          data-testid="ancestry-select"
          value={ancestryId}
          onChange={(e) => setAncestryId(e.target.value)}
        >
          <option value="">None</option>
          {config.ancestries.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Class
        <select
          data-testid="class-select"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          {config.classes.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Background
        <select
          data-testid="background-select"
          value={backgroundId}
          onChange={(e) => setBackgroundId(e.target.value)}
        >
          <option value="">None</option>
          {config.backgrounds.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="abilities-grid">
        {config.abilities.map((a) => (
          <label key={a.key}>
            {a.name} ({a.abbreviation})
            <input
              type="number"
              min={config.abilityScoreRange.min}
              max={config.abilityScoreRange.max}
              value={abilities[a.key] ?? 10}
              onChange={(e) =>
                setAbilities((prev) => ({
                  ...prev,
                  [a.key]: Number.parseInt(e.target.value, 10) || config.abilityScoreRange.min,
                }))
              }
            />
          </label>
        ))}
      </div>
      <label>
        Armor
        <select
          data-testid="armor-select"
          value={armorId}
          onChange={(e) => setArmorId(e.target.value)}
        >
          <option value="">Unarmored</option>
          {config.armor.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name} (AC {a.base})
            </option>
          ))}
        </select>
      </label>
      <label className="role-option">
        <input
          data-testid="shield-checkbox"
          type="checkbox"
          checked={shield}
          onChange={(e) => setShield(e.target.checked)}
        />
        Carry Shield
      </label>
      {config.extras.talents && (
        <label>
          Talents (comma-separated)
          <input
            data-testid="talents-input"
            type="text"
            value={talentsText}
            onChange={(e) => setTalentsText(e.target.value)}
          />
        </label>
      )}
      {config.extras.spells && (
        <label>
          Spells (comma-separated)
          <input
            data-testid="spells-input"
            type="text"
            value={spellsText}
            onChange={(e) => setSpellsText(e.target.value)}
          />
        </label>
      )}
      {config.extras.notes && (
        <label>
          Notes
          <textarea
            data-testid="notes-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      )}
      <div className="button-row">
        <button
          data-testid="sheet-save-button"
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          Save
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
