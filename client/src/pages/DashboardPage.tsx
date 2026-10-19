import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCampaign,
  joinCampaign,
  listCampaigns,
  listSystems,
  type CampaignListItem,
  type SystemSummary,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCampaigns()
      .then(({ campaigns }) => {
        if (!cancelled) setCampaigns(campaigns);
      })
      .catch((err: unknown) => {
        if (!cancelled) setListError(err instanceof Error ? err.message : "Something went wrong, please try again");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main data-testid="page-dashboard" className="page">
      <h1>My campaigns</h1>
      {listError && <FormError message={listError} />}
      {campaigns !== null && campaigns.length === 0 && (
        <p data-testid="empty-campaigns" className="empty-state">
          No campaigns yet
        </p>
      )}
      {campaigns !== null && campaigns.length > 0 && (
        <ul data-testid="campaign-list" className="campaign-list">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                data-testid="campaign-item"
                className="campaign-item"
                to={`/campaigns/${campaign.id}`}
              >
                <span className="campaign-item-name">{campaign.name}</span>
                <span className="campaign-item-system">{campaign.system}</span>
                <span className="campaign-item-relationship">
                  {campaign.relationship === "OWNER" ? "Owner" : "Player"}
                </span>
                {campaign.archived && (
                  <span data-testid="archived-badge" className="badge">
                    Archived
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {user?.role === "GM" ? <CreateCampaignPanel onCreated={(id) => navigate(`/campaigns/${id}`)} /> : <JoinCampaignPanel />}
    </main>
  );
}

function CreateCampaignPanel({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("generic");
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
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
      .catch(() => {
        // Fallback to generic if systems list fails
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 3 || name.trim().length > 80) {
      setError("Campaign name must be between 3 and 80 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { campaign } = await createCampaign({
        name: name.trim(),
        description: description.trim(),
        system: system.trim() || "generic",
      });
      onCreated(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <button
        data-testid="create-campaign-button"
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen((v) => !v)}
      >
        New campaign
      </button>
      {open && (
        <form data-testid="campaign-create-form" className="card form" onSubmit={onSubmit}>
          <h2>New campaign</h2>
          <FormError message={error} />
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
          <button data-testid="campaign-create-submit" type="submit" className="btn btn-primary" disabled={submitting}>
            Create campaign
          </button>
        </form>
      )}
    </section>
  );
}

function JoinCampaignPanel() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (token.trim() === "") {
      setError("Invite code is required");
      return;
    }
    setSubmitting(true);
    try {
      const { campaign } = await joinCampaign(token.trim());
      navigate(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <form data-testid="join-form" className="card form" onSubmit={onSubmit}>
        <h2>Join with invite code</h2>
        <FormError message={error} />
        <label>
          Invite code
          <input
            data-testid="token-input"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button data-testid="join-button" type="submit" className="btn btn-primary" disabled={submitting}>
          Join campaign
        </button>
      </form>
    </section>
  );
}
