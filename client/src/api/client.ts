export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "GM" | "PLAYER";
}

export interface CampaignListItem {
  id: string;
  name: string;
  system: string;
  archived: boolean;
  relationship: "OWNER" | "PLAYER";
  updatedAt: string;
}

export interface CampaignMember {
  userId: string;
  displayName: string;
  role: "OWNER" | "PLAYER";
  joinedAt: string;
}

export interface CampaignInvite {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface CampaignDetail {
  id: string;
  name: string;
  description: string;
  system: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  members: CampaignMember[];
  invites: CampaignInvite[];
}

/** Error thrown for any non-2xx API response; message is the server's message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const data = (await res.json().catch(() => ({}))) as ErrorBody & T;
  if (!res.ok) {
    const err = data.error;
    throw new ApiError(
      res.status,
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Something went wrong, please try again",
    );
  }
  return data;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role: "GM" | "PLAYER";
}

export function register(input: RegisterInput): Promise<{ user: User }> {
  return request("POST", "/auth/register", input);
}

export function login(email: string, password: string): Promise<{ user: User }> {
  return request("POST", "/auth/login", { email, password });
}

export function logout(): Promise<void> {
  return request("POST", "/auth/logout");
}

export function fetchMe(): Promise<{ user: User }> {
  return request("GET", "/auth/me");
}

export function listCampaigns(): Promise<{ campaigns: CampaignListItem[] }> {
  return request("GET", "/campaigns");
}

export function createCampaign(input: {
  name: string;
  description?: string;
  system?: string;
}): Promise<{ campaign: CampaignDetail }> {
  return request("POST", "/campaigns", input);
}

export function getCampaign(id: string): Promise<{ campaign: CampaignDetail }> {
  return request("GET", `/campaigns/${id}`);
}

export function updateCampaign(
  id: string,
  input: { name?: string; description?: string; system?: string; archived?: boolean },
): Promise<{ campaign: CampaignDetail }> {
  return request("PATCH", `/campaigns/${id}`, input);
}

export function deleteCampaign(id: string): Promise<void> {
  return request("DELETE", `/campaigns/${id}`);
}

export function createInvite(id: string): Promise<{ invite: CampaignInvite }> {
  return request("POST", `/campaigns/${id}/invites`);
}

export function joinCampaign(token: string): Promise<{ campaign: CampaignDetail }> {
  return request("POST", "/campaigns/join", { token });
}
