import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createInvite,
  createSession,
  createSheet,
  deleteCampaign,
  getCampaign,
  getSystem,
  listCampaignSessions,
  listCampaignSheets,
  listSystems,
  updateCampaign,
  type CampaignDetail,
  type GameSession,
  type SheetSummary,
  type SystemConfig,
  type SystemSummary,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollAbilitiesForSystem(config: SystemConfig): Record<string, number> {
  const { min, max } = config.abilityScoreRange;
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const methods = config.creation.methods;

  if (methods.includes("roll3d6InOrder")) {
    const threshold = config.creation.mulliganIfAllBelow;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const scores: Record<string, number> = {};
      for (const a of config.abilities) {
        scores[a.key] = clamp(rollDie(6) + rollDie(6) + rollDie(6));
      }
      if (!threshold || Object.values(scores).some((s) => s >= threshold) || attempt === 49) {
        return scores;
      }
    }
  }

  if (methods.includes("roll4d6DropLowest")) {
    const scores: Record<string, number> = {};
    for (const a of config.abilities) {
      const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((x, y) => x - y);
      scores[a.key] = clamp(rolls[1] + rolls[2] + rolls[3]);
    }
    return scores;
  }

  if (methods.includes("standardArray") && config.creation.standardArray) {
    const scores: Record<string, number> = {};
    config.abilities.forEach((a, idx) => {
      scores[a.key] = clamp(config.creation.standardArray?.[idx] ?? 10);
    });
    return scores;
  }

  const fallback: Record<string, number> = {};
  for (const a of config.abilities) {
    fallback[a.key] = clamp(10);
  }
  return fallback;
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCampaign(id)
      .then(({ campaign }) => {
        if (!cancelled) setCampaign(campaign);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong, please try again");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadError) {
    return (
      <main data-testid="page-campaign-detail" className="page">
        <p className="empty-state">{loadError}</p>
      </main>
    );
  }
  if (!campaign) {
    return (
      <main data-testid="page-campaign-detail" className="page">
        <p className="empty-state">Loading…</p>
      </main>
    );
  }

  const isOwner = campaign.members.some((m) => m.role === "OWNER" && m.userId === user?.id);

  return (
    <main data-testid="page-campaign-detail" className="page">
      <div className="detail-header">
        <h1 data-testid="campaign-name">{campaign.name}</h1>
        {campaign.archived && (
          <span data-testid="archived-badge" className="badge">
            Archived
          </span>
        )}
      </div>
      <p data-testid="campaign-description" className="detail-description">
        {campaign.description || "No description."}
      </p>
      <p className="detail-system">
        System: <span data-testid="campaign-system">{campaign.system}</span>
      </p>
      {isOwner && (
        <OwnerActions
          campaign={campaign}
          onUpdated={setCampaign}
          onDeleted={() => navigate("/")}
        />
      )}
      <SessionsSection campaign={campaign} isOwner={isOwner} />
      {campaign.system && campaign.system !== "generic" && (
        <SheetsSection campaign={campaign} isOwner={isOwner} />
      )}
      <section>
        <h2>Members</h2>
        <ul data-testid="member-list" className="member-list">
          {campaign.members.map((member) => (
            <li key={member.userId} data-testid="member-item">
              {member.displayName} ({member.role})
            </li>
          ))}
        </ul>
      </section>
      {isOwner && <InviteSection campaign={campaign} onInviteCreated={setCampaign} />}
    </main>
  );
}

function SessionsSection({
  campaign,
  isOwner,
}: {
  campaign: CampaignDetail;
  isOwner: boolean;
}) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSessions = useCallback(() => {
    listCampaignSessions(campaign.id)
      .then(({ sessions: list }) => setSessions(list))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      });
  }, [campaign.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Session name is required");
      return;
    }
    setSubmitting(true);
    try {
      await createSession(campaign.id, { name: name.trim() });
      setName("");
      setCreating(false);
      loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section data-testid="sessions-section" className="panel">
      <h2>Game Sessions</h2>
      {isOwner && (
        <div className="button-row">
          <button
            data-testid="session-create-button"
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating((prev) => !prev)}
          >
            New session
          </button>
        </div>
      )}
      <FormError message={error} />
      {creating && (
        <form className="card form" onSubmit={handleCreate}>
          <h3>Create New Session</h3>
          <label>
            Session Name
            <input
              data-testid="session-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Session 1: Into the Ruins"
            />
          </label>
          <div className="button-row">
            <button
              data-testid="session-create-submit"
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              Create Session
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {sessions.length === 0 ? (
        <p className="empty-state" style={{ marginTop: "0.75rem" }}>
          No game sessions yet.
        </p>
      ) : (
        <ul data-testid="session-list" className="campaign-list">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                data-testid="session-item"
                className="campaign-item"
                to={`/sessions/${s.id}`}
              >
                <span
                  data-testid="session-status-badge"
                  className={`badge status-${s.status.toLowerCase()}`}
                >
                  {s.status}
                </span>
                <span className="campaign-item-name">{s.name}</span>
                {s.description && (
                  <span className="campaign-item-system">{s.description}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SheetsSection({ campaign, isOwner }: { campaign: CampaignDetail; isOwner: boolean }) {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [creatingKind, setCreatingKind] = useState<"PC" | "NPC" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCampaignSheets(campaign.id)
      .then(({ sheets: rows }) => {
        if (!cancelled) setSheets(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load sheets");
      });
    getSystem(campaign.system)
      .then(({ system }) => {
        if (!cancelled) setSystemConfig(system);
      })
      .catch(() => {
        // System might not be found if deleted
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id, campaign.system]);

  return (
    <section data-testid="sheet-section" className="panel">
      <h2>Character Sheets</h2>
      <div className="button-row">
        <button
          data-testid="sheet-create-pc-button"
          type="button"
          className="btn btn-primary"
          onClick={() => setCreatingKind((k) => (k === "PC" ? null : "PC"))}
        >
          New character
        </button>
        {isOwner && (
          <button
            data-testid="sheet-create-npc-button"
            type="button"
            className="btn btn-secondary"
            onClick={() => setCreatingKind((k) => (k === "NPC" ? null : "NPC"))}
          >
            New NPC
          </button>
        )}
      </div>
      <FormError message={error} />
      {creatingKind && systemConfig && (
        <CreateSheetForm
          campaignId={campaign.id}
          kind={creatingKind}
          config={systemConfig}
          onCreated={(sheetId) => navigate(`/sheets/${sheetId}`)}
          onCancel={() => setCreatingKind(null)}
        />
      )}
      {sheets.length === 0 ? (
        <p className="empty-state" style={{ marginTop: "0.75rem" }}>
          No character sheets yet.
        </p>
      ) : (
        <ul data-testid="sheet-list" className="campaign-list">
          {sheets.map((s) => (
            <li key={s.id}>
              <Link
                data-testid="sheet-item"
                className="campaign-item"
                to={`/sheets/${s.id}`}
              >
                <span data-testid="sheet-kind-badge" className="badge">
                  {s.kind}
                </span>
                <span className="campaign-item-name">{s.name}</span>
                <span className="campaign-item-system">
                  Lv {s.level} {s.ancestryId ?? ""} {s.classId ?? ""}
                </span>
                {s.ownerName && (
                  <span className="campaign-item-relationship">{s.ownerName}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateSheetForm({
  campaignId,
  kind,
  config,
  onCreated,
  onCancel,
}: {
  campaignId: string;
  kind: "PC" | "NPC";
  config: SystemConfig;
  onCreated: (sheetId: string) => void;
  onCancel: () => void;
}) {
  const defaultAbilities = () => {
    const init: Record<string, number> = {};
    const mid = Math.max(config.abilityScoreRange.min, Math.min(config.abilityScoreRange.max, 10));
    for (const a of config.abilities) {
      init[a.key] = mid;
    }
    return init;
  };

  const [name, setName] = useState("");
  const [ancestryId, setAncestryId] = useState(config.ancestries[0]?.key ?? "");
  const [classId, setClassId] = useState(config.classes[0]?.key ?? "");
  const [backgroundId, setBackgroundId] = useState(config.backgrounds[0]?.key ?? "");
  const [armorId, setArmorId] = useState("");
  const [shield, setShield] = useState(false);
  const [abilities, setAbilities] = useState<Record<string, number>>(defaultAbilities);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onRollAbilities() {
    setAbilities(rollAbilitiesForSystem(config));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError("Character name is required");
      return;
    }
    setSubmitting(true);
    try {
      const { sheet } = await createSheet(campaignId, {
        kind,
        name: name.trim(),
        ancestryId: ancestryId || null,
        classId: classId || null,
        backgroundId: backgroundId || null,
        abilities,
        armorId: armorId || null,
        shield,
      });
      onCreated(sheet.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create character sheet");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h3>New {kind === "PC" ? "Player Character" : "NPC"}</h3>
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
              {c.name} (d{c.hitDie})
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

      <div>
        <div className="detail-header">
          <strong>Abilities</strong>
          <button
            data-testid="roll-abilities-button"
            type="button"
            className="btn btn-secondary"
            onClick={onRollAbilities}
          >
            Roll abilities
          </button>
        </div>
        <div className="abilities-grid">
          {config.abilities.map((a) => (
            <label key={a.key}>
              {a.name} ({a.abbreviation})
              <input
                data-testid={`ability-input-${a.key}`}
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
        Carry Shield {config.shield ? `(+${config.shield.bonus} AC)` : ""}
      </label>
      <div className="button-row">
        <button
          data-testid="sheet-save-button"
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          Create {kind}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function OwnerActions({
  campaign,
  onUpdated,
  onDeleted,
}: {
  campaign: CampaignDetail;
  onUpdated: (campaign: CampaignDetail) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onArchiveToggle() {
    setError(null);
    setBusy(true);
    try {
      const { campaign: updated } = await updateCampaign(campaign.id, {
        archived: !campaign.archived,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this campaign? This cannot be undone.")) return;
    setError(null);
    setBusy(true);
    try {
      await deleteCampaign(campaign.id);
      onDeleted();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    }
  }

  return (
    <section className="panel">
      <div className="button-row">
        {!editing && (
          <button data-testid="edit-button" type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {campaign.archived ? (
          <button data-testid="unarchive-button" type="button" className="btn btn-secondary" disabled={busy} onClick={onArchiveToggle}>
            Unarchive
          </button>
        ) : (
          <button data-testid="archive-button" type="button" className="btn btn-secondary" disabled={busy} onClick={onArchiveToggle}>
            Archive
          </button>
        )}
        <button data-testid="delete-button" type="button" className="btn btn-danger" disabled={busy} onClick={onDelete}>
          Delete
        </button>
      </div>
      <FormError message={error} />
      {editing && (
        <CampaignEditForm
          campaign={campaign}
          onError={setError}
          onSaved={(updated) => {
            onUpdated(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </section>
  );
}

function CampaignEditForm({
  campaign,
  onError,
  onSaved,
  onCancel,
}: {
  campaign: CampaignDetail;
  onError: (message: string) => void;
  onSaved: (campaign: CampaignDetail) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [system, setSystem] = useState(campaign.system);
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSystems()
      .then(({ systems: rows }) => {
        if (!cancelled) {
          const unique = Array.from(new Map(rows.map((s) => [s.key, s])).values());
          setSystems(unique);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 3 || name.trim().length > 80) {
      onError("Campaign name must be between 3 and 80 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { campaign: updated } = await updateCampaign(campaign.id, {
        name: name.trim(),
        description: description.trim(),
        system: system.trim(),
      });
      onSaved(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form data-testid="campaign-edit-form" className="card form" onSubmit={onSubmit}>
      <label>
        Name
        <input
          data-testid="campaign-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Description
        <input
          data-testid="description-input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Game system
        <select
          data-testid="system-select"
          value={system}
          onChange={(e) => setSystem(e.target.value)}
        >
          <option value="generic">None (Generic)</option>
          {systems.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="button-row">
        <button data-testid="save-button" type="submit" className="btn btn-primary" disabled={submitting}>
          Save
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function InviteSection({
  campaign,
  onInviteCreated,
}: {
  campaign: CampaignDetail;
  onInviteCreated: (campaign: CampaignDetail) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const onGenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
    try {
      await createInvite(campaign.id);
      const { campaign: refreshed } = await getCampaign(campaign.id);
      onInviteCreated(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setGenerating(false);
    }
  }, [campaign.id, onInviteCreated]);

  const latest = campaign.invites[0];

  return (
    <section className="panel">
      <h2>Invite players</h2>
      <FormError message={error} />
      <button
        data-testid="invite-generate-button"
        type="button"
        className="btn btn-primary"
        disabled={generating}
        onClick={onGenerate}
      >
        Generate invite code
      </button>
      {latest && (
        <p className="invite-box">
          Share code: <code data-testid="invite-code">{latest.token}</code>
        </p>
      )}
    </section>
  );
}
