import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createInvite,
  deleteCampaign,
  getCampaign,
  updateCampaign,
  type CampaignDetail,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

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
  const [submitting, setSubmitting] = useState(false);

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
      <h2>Edit campaign</h2>
      <label>
        Name
        <input data-testid="campaign-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Description
        <input data-testid="description-input" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Game system
        <input data-testid="system-input" type="text" value={system} onChange={(e) => setSystem(e.target.value)} />
      </label>
      <div className="button-row">
        <button data-testid="save-button" type="submit" className="btn btn-primary" disabled={submitting}>
          Save
        </button>
        <button data-testid="cancel-button" type="button" className="btn btn-secondary" onClick={onCancel}>
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
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onGenerate = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { invite } = await createInvite(campaign.id);
      setLastToken(invite.token);
      onInviteCreated({ ...campaign, invites: [...campaign.invites, invite] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setBusy(false);
    }
  }, [campaign, onInviteCreated]);

  return (
    <section className="panel">
      <h2>Invite codes</h2>
      <FormError message={error} />
      <div className="button-row">
        <button data-testid="invite-generate-button" type="button" className="btn btn-primary" disabled={busy} onClick={onGenerate}>
          Generate invite code
        </button>
        {lastToken && (
          <code data-testid="invite-code" className="invite-code">
            {lastToken}
          </code>
        )}
      </div>
      {campaign.invites.length > 0 && (
        <ul data-testid="invite-list" className="invite-list">
          {campaign.invites.map((invite) => (
            <li key={invite.id}>
              <code>{invite.token}</code>
              <span className="invite-expiry">expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
