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

export interface SystemSummary {
  key: string;
  version: string;
  name: string;
  attribution: string;
  builtin: boolean;
}

export interface SystemAbility {
  key: string;
  name: string;
  abbreviation: string;
}

export interface SystemOption {
  key: string;
  name: string;
}

export interface SystemClass extends SystemOption {
  hitDie: number;
  spellcasting?: {
    ability: string;
    knownByLevel: number[];
  };
}

export interface SystemArmor extends SystemOption {
  base: number;
  dex: "full" | "none" | number;
  slots?: number;
}

export interface SystemConfig {
  key: string;
  name: string;
  version: string;
  attribution: string;
  abilities: SystemAbility[];
  abilityScoreRange: { min: number; max: number };
  abilityModifier: { formula: string; min?: number; max?: number };
  creation: {
    methods: Array<"manual" | "roll3d6InOrder" | "roll4d6DropLowest" | "standardArray">;
    mulliganIfAllBelow?: number;
    standardArray?: number[];
  };
  levels: {
    max: number;
    advancement:
      | { mode: "multiplier"; xpMultiplier: number; resetOnAdvance: boolean }
      | { mode: "thresholds"; thresholds: number[] };
    proficiencyBonus?: { formula: string };
  };
  classes: SystemClass[];
  ancestries: SystemOption[];
  backgrounds: SystemOption[];
  armor: SystemArmor[];
  shield?: { bonus: number };
  derived: {
    hitPointsAtFirstLevel?: string;
    hitPointsPerLevel?: string;
    initiative?: string;
    carrySlots?: string;
  };
  currency: { units: string[] };
  extras: { talents?: boolean; spells?: boolean; notes?: boolean };
}

export interface SheetSummary {
  id: string;
  kind: "PC" | "NPC";
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  ancestryId: string | null;
  classId: string | null;
  level: number;
  systemKey: string;
}

export interface SheetExtras {
  talents: string[];
  spells: string[];
  notes: string;
  coins: Record<string, number>;
}

export interface SheetDetail extends SheetSummary {
  campaignId: string;
  backgroundId: string | null;
  xp: number;
  abilities: Record<string, { score: number; modifier: number }>;
  hpMax: number;
  hpCurrent: number;
  armorId: string | null;
  shield: boolean;
  extras: SheetExtras;
  derived: {
    hpPerLevel: number | null;
    proficiencyBonus: number | null;
    initiative: number | null;
    carrySlots: number | null;
    armorClass: number;
    nextLevelXp: number | null;
    spellcasting: {
      ability: string;
      known: number;
      allowed: number;
    } | null;
  };
}

/** Error thrown for any non-2xx API response; message is the server's message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ path: string; message: string }>;
  };
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
    const detailSuffix =
      err?.details && err.details.length > 0
        ? `: ${err.details.map((d) => `${d.path} ${d.message}`).join("; ")}`
        : "";
    throw new ApiError(
      res.status,
      err?.code ?? "INTERNAL_ERROR",
      `${err?.message ?? "Something went wrong, please try again"}${detailSuffix}`,
      err?.details,
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

export function listSystems(): Promise<{ systems: SystemSummary[] }> {
  return request("GET", "/systems");
}

export function getSystem(key: string): Promise<{ system: SystemConfig }> {
  return request("GET", `/systems/${key}`);
}

export async function importSystemRaw(rawJson: string): Promise<{ system: SystemConfig }> {
  const res = await fetch("/api/systems/import", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: rawJson,
  });
  const data = (await res.json().catch(() => ({}))) as ErrorBody & { system: SystemConfig };
  if (!res.ok) {
    const err = data.error;
    const detailSuffix =
      err?.details && err.details.length > 0
        ? `: ${err.details.map((d) => `${d.path} ${d.message}`).join("; ")}`
        : "";
    throw new ApiError(
      res.status,
      err?.code ?? "INTERNAL_ERROR",
      `${err?.message ?? "Failed to import system"}${detailSuffix}`,
      err?.details,
    );
  }
  return data;
}

export function listCampaignSheets(campaignId: string): Promise<{ sheets: SheetSummary[] }> {
  return request("GET", `/campaigns/${campaignId}/sheets`);
}

export interface CreateSheetInput {
  kind: "PC" | "NPC";
  name: string;
  ancestryId?: string | null;
  classId?: string | null;
  backgroundId?: string | null;
  abilities: Record<string, number>;
  armorId?: string | null;
  shield?: boolean;
  extras?: Partial<SheetExtras>;
}

export function createSheet(
  campaignId: string,
  input: CreateSheetInput,
): Promise<{ sheet: SheetDetail }> {
  return request("POST", `/campaigns/${campaignId}/sheets`, input);
}

export function getSheet(id: string): Promise<{ sheet: SheetDetail }> {
  return request("GET", `/sheets/${id}`);
}

export interface UpdateSheetInput {
  name?: string;
  ancestryId?: string | null;
  classId?: string | null;
  backgroundId?: string | null;
  xp?: number;
  abilities?: Record<string, number>;
  hpMax?: number;
  hpCurrent?: number;
  armorId?: string | null;
  shield?: boolean;
  extras?: Partial<SheetExtras>;
}

export function updateSheet(
  id: string,
  input: UpdateSheetInput,
): Promise<{ sheet: SheetDetail }> {
  return request("PATCH", `/sheets/${id}`, input);
}

export function levelUpSheet(id: string): Promise<{ sheet: SheetDetail }> {
  return request("POST", `/sheets/${id}/levelup`, {});
}

export function deleteSheet(id: string): Promise<void> {
  return request("DELETE", `/sheets/${id}`);
}

export interface GameSession {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  status: "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED";
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessageItem {
  id: string;
  sessionId: string;
  userId: string | null;
  userName: string;
  type: "TEXT" | "DICE" | "SYSTEM";
  content: string;
  deleted: boolean;
  createdAt: string;
}

export interface DiceRollResult {
  formula: string;
  label?: string;
  dice: number[];
  modifier: number;
  total: number;
}

export function listCampaignSessions(campaignId: string): Promise<{ sessions: GameSession[] }> {
  return request("GET", `/campaigns/${campaignId}/sessions`);
}

export function createSession(
  campaignId: string,
  input: { name: string; description?: string },
): Promise<{ session: GameSession }> {
  return request("POST", `/campaigns/${campaignId}/sessions`, input);
}

export function getSession(sessionId: string): Promise<{ session: GameSession }> {
  return request("GET", `/sessions/${sessionId}`);
}

export function updateSession(
  sessionId: string,
  input: { name?: string; description?: string; status?: "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED" },
): Promise<{ session: GameSession }> {
  return request("PATCH", `/sessions/${sessionId}`, input);
}

export function deleteSession(sessionId: string): Promise<void> {
  return request("DELETE", `/sessions/${sessionId}`);
}

export function listSessionMessages(sessionId: string): Promise<{ messages: SessionMessageItem[] }> {
  return request("GET", `/sessions/${sessionId}/messages`);
}

export interface MapToken {
  id: string;
  mapId: string;
  type: "CHARACTER" | "MONSTER" | "ITEM";
  name: string;
  characterSheetId: string | null;
  ownerId: string | null;
  x: number;
  y: number;
  color: string;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  attackBonus: number;
  damageFormula: string;
  initiative: number;
}

export interface CombatState {
  id: string;
  mapId: string;
  active: boolean;
  round: number;
  turnIndex: number;
  activeTokenId: string | null;
  turnOrder: string[];
}

export interface SessionMap {
  id: string;
  sessionId: string;
  name: string;
  theme: "stone-dungeon" | "forest-clearing" | "tavern-cellar" | string;
  width: number;
  height: number;
  allowPlayerMovement: boolean;
  tokens: MapToken[];
  combat: CombatState | null;
}

export interface CombatAttackResult {
  attackerName: string;
  targetName: string;
  d20: number;
  attackBonus: number;
  attackTotal: number;
  isCritical: boolean;
  isFumble: boolean;
  hit: boolean;
  targetAc: number;
  damage: number;
  damageFormula: string;
  targetHpBefore: number;
  targetHpAfter: number;
  targetHpMax: number;
  logMessage: string;
}

export function listSessionMaps(sessionId: string): Promise<{ maps: SessionMap[] }> {
  return request("GET", `/sessions/${sessionId}/maps`);
}

export function createSessionMap(
  sessionId: string,
  input: { name?: string; theme?: string; width?: number; height?: number; allowPlayerMovement?: boolean },
): Promise<{ map: SessionMap }> {
  return request("POST", `/sessions/${sessionId}/maps`, input);
}

export function getMap(mapId: string): Promise<{ map: SessionMap }> {
  return request("GET", `/maps/${mapId}`);
}

export function updateMap(
  mapId: string,
  input: { name?: string; theme?: string; width?: number; height?: number; allowPlayerMovement?: boolean },
): Promise<{ map: SessionMap }> {
  return request("PATCH", `/maps/${mapId}`, input);
}

export function placeToken(
  mapId: string,
  input: Partial<MapToken>,
): Promise<{ token: MapToken }> {
  return request("POST", `/maps/${mapId}/tokens`, input);
}

export function updateToken(
  tokenId: string,
  input: Partial<MapToken>,
): Promise<{ token: MapToken }> {
  return request("PATCH", `/tokens/${tokenId}`, input);
}

export function deleteToken(tokenId: string): Promise<void> {
  return request("DELETE", `/tokens/${tokenId}`);
}

export function startCombat(mapId: string): Promise<{ combat: CombatState; tokens: MapToken[] }> {
  return request("POST", `/maps/${mapId}/combat/start`);
}

export function nextCombatTurn(mapId: string): Promise<{ combat: CombatState }> {
  return request("POST", `/maps/${mapId}/combat/next`);
}

export function executeCombatAttack(
  mapId: string,
  input: { attackerId: string; targetId: string; forcedD20?: number },
): Promise<{ attack: CombatAttackResult; targetToken: MapToken }> {
  return request("POST", `/maps/${mapId}/combat/attack`, input);
}

export function endCombat(mapId: string): Promise<{ combat: CombatState }> {
  return request("POST", `/maps/${mapId}/combat/end`);
}


