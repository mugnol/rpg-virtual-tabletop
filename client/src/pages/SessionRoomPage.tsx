import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getSession,
  listCampaignSheets,
  listSessionMaps,
  type DiceRollResult,
  type GameSession,
  type MapToken,
  type SessionMap,
  type SessionMessageItem,
  type SheetSummary,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

interface PresenceUser {
  userId: string;
  displayName: string;
  role: string;
}

interface ActiveRollAnimation {
  roll: DiceRollResult & { userName: string };
  visible: boolean;
}

export function SessionRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [session, setSession] = useState<GameSession | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<SessionMessageItem[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Map and Combat state
  const [map, setMap] = useState<SessionMap | null>(null);
  const [campaignSheets, setCampaignSheets] = useState<SheetSummary[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [combatTargetId, setCombatTargetId] = useState<string>("");

  // Token placement modal state
  const [isAddTokenOpen, setIsAddTokenOpen] = useState(false);
  const [tokenType, setTokenType] = useState<"CHARACTER" | "MONSTER" | "ITEM">("CHARACTER");
  const [tokenSheetId, setTokenSheetId] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenHp, setTokenHp] = useState<string>("");
  const [tokenAc, setTokenAc] = useState<string>("");
  const [tokenAttackBonus, setTokenAttackBonus] = useState<string>("");
  const [tokenDamage, setTokenDamage] = useState<string>("");

  // Chat input
  const [chatInput, setChatInput] = useState("");

  // Dice roller state
  const [selectedDie, setSelectedDie] = useState<number>(20);
  const [modifier, setModifier] = useState<string>("");
  const [diceCount, setDiceCount] = useState<number>(1);
  const [rollLabel, setRollLabel] = useState<string>("");

  // Visual dice animation overlay
  const [activeRoll, setActiveRoll] = useState<ActiveRollAnimation | null>(null);
  const animationTimerRef = useRef<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const chatStreamRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [messages]);

  // Load session metadata and initialize WebSocket
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getSession(id)
      .then(({ session: sess }) => {
        if (cancelled) return;
        setSession(sess);
        if (sess.campaignId) {
          listCampaignSheets(sess.campaignId)
            .then(({ sheets }) => {
              if (!cancelled) setCampaignSheets(sheets);
            })
            .catch(() => {});
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
        setLoading(false);
      });

    listSessionMaps(id)
      .then(({ maps }) => {
        if (cancelled) return;
        if (maps.length > 0) {
          setMap((prev) => prev ?? maps[0]);
        }
      })
      .catch(() => {});

    // Establish WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/sessions/${id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        switch (payload.type) {
          case "session_state": {
            setSession(payload.session);
            setPresence(payload.presence || []);
            setMessages(payload.messages || []);
            if (payload.maps && payload.maps.length > 0) {
              setMap(payload.maps[0]);
            }
            // Check if current user is owner (GM)
            if (payload.session && user?.role === "GM") {
              setIsOwner(true);
            }
            break;
          }

          case "presence_update": {
            setPresence(payload.presence || []);
            break;
          }

          case "status_changed": {
            setSession((prev) => (prev ? { ...prev, status: payload.status } : null));
            break;
          }

          case "chat_message": {
            setMessages((prev) => [...prev, payload.message]);
            break;
          }

          case "dice_roll": {
            const roll = payload.roll as DiceRollResult & {
              id: string;
              userId: string;
              userName: string;
              createdAt: string;
            };
            // Format roll content into chat message
            const diceMsg: SessionMessageItem = {
              id: roll.id,
              sessionId: id,
              userId: roll.userId,
              userName: roll.userName,
              type: "DICE",
              content: JSON.stringify(roll),
              deleted: false,
              createdAt: roll.createdAt,
            };
            setMessages((prev) => [...prev, diceMsg]);

            // Trigger animation overlay
            if (animationTimerRef.current) {
              window.clearTimeout(animationTimerRef.current);
            }
            setActiveRoll({ roll, visible: true });
            animationTimerRef.current = window.setTimeout(() => {
              setActiveRoll(null);
            }, 5000);
            break;
          }

          case "message_deleted": {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.messageId ? { ...m, deleted: true } : m)),
            );
            break;
          }

          case "map_updated": {
            setMap(payload.map);
            break;
          }

          case "token_placed": {
            setMap((prev) => {
              if (!prev || prev.id !== payload.mapId) return prev;
              const exists = prev.tokens.some((t) => t.id === payload.token.id);
              return {
                ...prev,
                tokens: exists
                  ? prev.tokens.map((t) => (t.id === payload.token.id ? payload.token : t))
                  : [...prev.tokens, payload.token],
              };
            });
            break;
          }

          case "token_moved":
          case "token_updated": {
            setMap((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                tokens: prev.tokens.map((t) => (t.id === payload.token.id ? payload.token : t)),
              };
            });
            break;
          }

          case "token_deleted": {
            setMap((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                tokens: prev.tokens.filter((t) => t.id !== payload.tokenId),
              };
            });
            break;
          }

          case "combat_started": {
            setMap((prev) => {
              if (!prev || prev.id !== payload.mapId) return prev;
              return {
                ...prev,
                combat: payload.combat,
                tokens: payload.tokens ?? prev.tokens,
              };
            });
            break;
          }

          case "turn_changed": {
            setMap((prev) => {
              if (!prev || prev.id !== payload.mapId) return prev;
              return {
                ...prev,
                combat: payload.combat,
              };
            });
            break;
          }

          case "combat_attack": {
            setMap((prev) => {
              if (!prev || prev.id !== payload.mapId) return prev;
              return {
                ...prev,
                tokens: prev.tokens.map((t) =>
                  t.id === payload.targetToken.id ? payload.targetToken : t,
                ),
              };
            });
            break;
          }

          case "combat_ended": {
            setMap((prev) => {
              if (!prev || prev.id !== payload.mapId) return prev;
              return {
                ...prev,
                combat: null,
              };
            });
            break;
          }

          case "error": {
            setError(payload.message || "Session error");
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection failed");
    };

    return () => {
      cancelled = true;
      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }
      ws.close();
      wsRef.current = null;
    };
  }, [id, user]);

  function handleSendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "chat_message",
        content: chatInput.trim(),
      }),
    );
    setChatInput("");
  }

  function handleRollDice() {
    if (!wsRef.current) return;
    const count = diceCount > 1 ? `${diceCount}` : "";
    let formula = `${count}d${selectedDie}`;
    const modNum = Number.parseInt(modifier, 10);
    if (!Number.isNaN(modNum)) {
      if (modNum >= 0) {
        formula += `+${modNum}`;
      } else {
        formula += `${modNum}`;
      }
    }

    wsRef.current.send(
      JSON.stringify({
        type: "roll_dice",
        formula,
        label: rollLabel.trim() || undefined,
      }),
    );
  }

  function handleStatusChange(status: "ACTIVE" | "PAUSED" | "ENDED") {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "set_status",
        status,
      }),
    );
  }

  function handleDeleteMessage(messageId: string) {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "delete_message",
        messageId,
      }),
    );
  }

  function handleOpenAddToken() {
    setIsAddTokenOpen(true);
    if (session?.campaignId) {
      listCampaignSheets(session.campaignId)
        .then(({ sheets }) => setCampaignSheets(sheets))
        .catch(() => {});
    }
  }

  function handleSheetSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const sheetId = e.target.value;
    setTokenSheetId(sheetId);
    const sheet = campaignSheets.find((s) => s.id === sheetId);
    if (sheet) {
      setTokenName(sheet.name);
    }
  }

  function handlePlaceTokenSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wsRef.current || !map) return;

    if (tokenType === "CHARACTER") {
      const sheet = campaignSheets.find((s) => s.id === tokenSheetId);
      wsRef.current.send(
        JSON.stringify({
          type: "place_token",
          mapId: map.id,
          token: {
            type: "CHARACTER",
            characterSheetId: tokenSheetId || undefined,
            name: sheet?.name || tokenName || "Character",
          },
        }),
      );
    } else if (tokenType === "MONSTER") {
      wsRef.current.send(
        JSON.stringify({
          type: "place_token",
          mapId: map.id,
          token: {
            type: "MONSTER",
            name: tokenName || "Monster",
            hpMax: Number.parseInt(tokenHp, 10) || 10,
            hpCurrent: Number.parseInt(tokenHp, 10) || 10,
            ac: Number.parseInt(tokenAc, 10) || 10,
            attackBonus: Number.parseInt(tokenAttackBonus, 10) || 0,
            damageFormula: tokenDamage || "1d6",
          },
        }),
      );
    } else {
      wsRef.current.send(
        JSON.stringify({
          type: "place_token",
          mapId: map.id,
          token: {
            type: "ITEM",
            name: tokenName || "Item",
          },
        }),
      );
    }

    setIsAddTokenOpen(false);
    setTokenName("");
    setTokenHp("");
    setTokenAc("");
    setTokenAttackBonus("");
    setTokenDamage("");
    setTokenSheetId("");
  }

  function handleToggleMovement() {
    if (!wsRef.current || !map) return;
    wsRef.current.send(
      JSON.stringify({
        type: "update_map",
        mapId: map.id,
        data: {
          allowPlayerMovement: !map.allowPlayerMovement,
        },
      }),
    );
  }

  function handleTokenClick(token: MapToken) {
    if (!effectiveIsOwner && !map?.allowPlayerMovement) {
      return;
    }
    if (!effectiveIsOwner && token.ownerId !== user?.id) {
      return;
    }
    setSelectedTokenId((prev) => (prev === token.id ? null : token.id));
  }

  function handleCellClick(x: number, y: number) {
    if (!selectedTokenId || !wsRef.current || !map) return;
    wsRef.current.send(
      JSON.stringify({
        type: "move_token",
        tokenId: selectedTokenId,
        x,
        y,
      }),
    );
    setSelectedTokenId(null);
  }

  function handleStartCombat() {
    if (!wsRef.current || !map) return;
    wsRef.current.send(
      JSON.stringify({
        type: "start_combat",
        mapId: map.id,
      }),
    );
  }

  function handleNextTurn() {
    if (!wsRef.current || !map) return;
    wsRef.current.send(
      JSON.stringify({
        type: "next_turn",
        mapId: map.id,
      }),
    );
  }

  function handleCombatAttack() {
    if (!wsRef.current || !map || !map.combat?.activeTokenId) return;
    const targets = map.tokens.filter(
      (t) => t.type !== "ITEM",
    );
    const target = targets.find((t) => t.id === combatTargetId) || targets.find((t) => t.id !== map.combat?.activeTokenId) || targets[0];
    if (!target) return;

    wsRef.current.send(
      JSON.stringify({
        type: "combat_attack",
        mapId: map.id,
        attackerId: map.combat.activeTokenId,
        targetId: target.id,
      }),
    );
  }

  function handleEndCombat() {
    if (!wsRef.current || !map) return;
    wsRef.current.send(
      JSON.stringify({
        type: "end_combat",
        mapId: map.id,
      }),
    );
  }

  if (loading) {
    return (
      <main data-testid="page-session" className="page">
        <p className="empty-state">Loading session room…</p>
      </main>
    );
  }

  if (error && !session) {
    return (
      <main data-testid="page-session" className="page">
        <p className="empty-state">{error}</p>
      </main>
    );
  }

  const effectiveIsOwner = isOwner || user?.role === "GM";
  const visibleMessages = messages.filter((m) => !m.deleted);
  const activeCombatant = map?.tokens.find((t) => t.id === map?.combat?.activeTokenId);
  const potentialTargets = map
    ? map.tokens.filter((t) => t.type !== "ITEM")
    : [];

  return (
    <main data-testid="page-session" className="page session-page">
      {/* Visual Dice Roll Animation Overlay */}
      {activeRoll && activeRoll.visible && (
        <div data-testid="dice-animation-overlay" className="dice-animation-overlay">
          <div className="dice-modal">
            <div className="dice-spinner">
              <span className="dice-icon">🎲</span>
            </div>
            <div className="dice-roller-name">{activeRoll.roll.userName} rolled</div>
            <div data-testid="dice-roll-total" className="dice-roll-total">
              {activeRoll.roll.total}
            </div>
            <div data-testid="dice-roll-breakdown" className="dice-roll-breakdown">
              {activeRoll.roll.formula}: [{(activeRoll.roll.dice || []).join(", ")}]
              {activeRoll.roll.modifier !== 0
                ? activeRoll.roll.modifier > 0
                  ? ` + ${activeRoll.roll.modifier}`
                  : ` - ${Math.abs(activeRoll.roll.modifier)}`
                : ""}{" "}
              = {activeRoll.roll.total}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveRoll(null)}
              style={{ marginTop: "0.5rem" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header & Lifecycle Controls */}
      <div className="session-header panel">
        <div className="detail-header">
          <div>
            <h1 data-testid="session-title">{session?.name}</h1>
            {session?.campaignId && (
              <Link to={`/campaigns/${session.campaignId}`} className="back-link">
                ← Back to Campaign
              </Link>
            )}
          </div>
          <div>
            Status:{" "}
            <span
              data-testid="session-status"
              className={`badge status-${session?.status.toLowerCase()}`}
            >
              {session?.status}
            </span>
          </div>
        </div>

        {effectiveIsOwner && (
          <div className="button-row" style={{ marginTop: "0.75rem" }}>
            {session?.status === "SCHEDULED" && (
              <button
                data-testid="session-start-button"
                type="button"
                className="btn btn-primary"
                onClick={() => handleStatusChange("ACTIVE")}
              >
                Start Session
              </button>
            )}
            {session?.status === "ACTIVE" && (
              <>
                <button
                  data-testid="session-pause-button"
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleStatusChange("PAUSED")}
                >
                  Pause Session
                </button>
                <button
                  data-testid="session-end-button"
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleStatusChange("ENDED")}
                >
                  End Session
                </button>
              </>
            )}
            {session?.status === "PAUSED" && (
              <>
                <button
                  data-testid="session-resume-button"
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleStatusChange("ACTIVE")}
                >
                  Resume Session
                </button>
                <button
                  data-testid="session-end-button"
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleStatusChange("ENDED")}
                >
                  End Session
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <FormError message={error} />

      {/* Map & Combat Section */}
      {map && (
        <section className="session-map-container panel">
          {/* Combat Tracker */}
          {map.combat?.active && (
            <div data-testid="combat-tracker" className="combat-tracker">
              <div className="combat-tracker-header">
                <h3>⚔️ Combat Encounter — Round {map.combat.round}</h3>
                <div data-testid="active-turn-indicator" className="active-turn-indicator">
                  Turn: <strong>{activeCombatant?.name ?? "Active"}</strong>
                </div>
              </div>
              <div className="combat-controls">
                <label>
                  Target:{" "}
                  <select
                    data-testid="combat-target-select"
                    value={combatTargetId}
                    onChange={(e) => setCombatTargetId(e.target.value)}
                  >
                    <option value="">-- Select Target --</option>
                    {potentialTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  data-testid="combat-attack-button"
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCombatAttack}
                >
                  ⚔️ Attack
                </button>
                <button
                  data-testid="combat-next-button"
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleNextTurn}
                >
                  Next Turn ➔
                </button>
                {effectiveIsOwner && (
                  <button
                    data-testid="combat-end-button"
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleEndCombat}
                  >
                    End Combat
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Map Toolbar */}
          <div className="map-toolbar">
            <div className="map-info">
              <h3>
                {map.name} ({map.width}x{map.height})
              </h3>
            </div>
            <div className="map-toolbar-actions">
              {effectiveIsOwner && (
                <>
                  <button
                    data-testid="token-add-button"
                    type="button"
                    className="btn btn-primary"
                    onClick={handleOpenAddToken}
                  >
                    + Add Token
                  </button>
                  <button
                    data-testid="allow-movement-toggle"
                    type="button"
                    className={`btn ${map.allowPlayerMovement ? "btn-secondary" : "btn-outline-secondary"}`}
                    onClick={handleToggleMovement}
                  >
                    {map.allowPlayerMovement ? "Player Movement: Allowed" : "Player Movement: Locked"}
                  </button>
                  {!map.combat?.active && (
                    <button
                      data-testid="combat-start-button"
                      type="button"
                      className="btn btn-warning"
                      onClick={handleStartCombat}
                    >
                      ⚔️ Start Combat
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Map Grid */}
          <div className="map-board-wrapper">
            <div
              data-testid="map-board"
              className={`map-board theme-${map.theme}`}
              style={{
                gridTemplateColumns: `repeat(${map.width}, 48px)`,
                gridTemplateRows: `repeat(${map.height}, 48px)`,
              }}
            >
              {Array.from({ length: map.height }, (_, y) =>
                Array.from({ length: map.width }, (_, x) => {
                  const cellTokens = map.tokens.filter((t) => t.x === x && t.y === y);
                  return (
                    <div
                      key={`${x}-${y}`}
                      data-testid={`map-cell-${x}-${y}`}
                      className={`map-cell ${selectedTokenId ? "cell-selectable" : ""}`}
                      onClick={() => handleCellClick(x, y)}
                    >
                      {cellTokens.map((token) => {
                        const isSelected = selectedTokenId === token.id;
                        const isTurn = map.combat?.active && map.combat.activeTokenId === token.id;
                        return (
                          <div
                            key={token.id}
                            className={`map-token token-${token.type.toLowerCase()} ${
                              isSelected ? "token-selected" : ""
                            } ${isTurn ? "token-active-turn" : ""}`}
                            style={{ backgroundColor: token.color || undefined }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTokenClick(token);
                            }}
                          >
                            <span data-testid="token-name" className="token-name">
                              {token.name}
                            </span>
                            {token.type !== "ITEM" && (
                              <span data-testid="token-hp" className="token-hp">
                                {token.hpCurrent}/{token.hpMax}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </section>
      )}

      {/* Place Token Modal */}
      {isAddTokenOpen && (
        <div className="modal-overlay" onClick={() => setIsAddTokenOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Place Token on Map</h3>
            <form onSubmit={handlePlaceTokenSubmit}>
              <div className="form-group">
                <label>Token Type</label>
                <select
                  data-testid="token-type-select"
                  value={tokenType}
                  onChange={(e) => setTokenType(e.target.value as any)}
                >
                  <option value="CHARACTER">CHARACTER</option>
                  <option value="MONSTER">MONSTER</option>
                  <option value="ITEM">ITEM</option>
                </select>
              </div>

              {tokenType === "CHARACTER" && (
                <div className="form-group">
                  <label>Select Character Sheet</label>
                  <select
                    data-testid="token-sheet-select"
                    value={tokenSheetId}
                    onChange={handleSheetSelect}
                  >
                    <option value="">-- Select Sheet --</option>
                    {campaignSheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {tokenType === "MONSTER" && (
                <>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      data-testid="token-name-input"
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="e.g. Goblin Scout"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>HP</label>
                    <input
                      data-testid="token-hp-input"
                      type="number"
                      value={tokenHp}
                      onChange={(e) => setTokenHp(e.target.value)}
                      placeholder="e.g. 10"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>AC</label>
                    <input
                      data-testid="token-ac-input"
                      type="number"
                      value={tokenAc}
                      onChange={(e) => setTokenAc(e.target.value)}
                      placeholder="e.g. 12"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Attack Bonus</label>
                    <input
                      data-testid="token-attack-bonus-input"
                      type="number"
                      value={tokenAttackBonus}
                      onChange={(e) => setTokenAttackBonus(e.target.value)}
                      placeholder="e.g. 3"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Damage Dice</label>
                    <input
                      data-testid="token-damage-input"
                      type="text"
                      value={tokenDamage}
                      onChange={(e) => setTokenDamage(e.target.value)}
                      placeholder="e.g. 1d6+1"
                      required
                    />
                  </div>
                </>
              )}

              {tokenType === "ITEM" && (
                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    data-testid="token-name-input"
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g. Gold Chest"
                    required
                  />
                </div>
              )}

              <div className="button-row" style={{ marginTop: "1rem" }}>
                <button data-testid="token-submit-button" type="submit" className="btn btn-primary">
                  Place Token
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddTokenOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Room Layout: Left (Presence + Dice Tray), Right (Chat Stream) */}
      <div className="session-grid">
        <div className="session-sidebar">
          {/* Presence List */}
          <section className="panel">
            <h2>Online Participants</h2>
            <ul data-testid="presence-list" className="presence-list">
              {presence.map((p) => (
                <li key={p.userId} data-testid="presence-user" className="presence-user">
                  <span className="presence-dot" />
                  <strong>{p.displayName}</strong> ({p.role})
                </li>
              ))}
              {presence.length === 0 && <li className="empty-state">No users connected</li>}
            </ul>
          </section>

          {/* Interactive Dice Roller Tray */}
          <section data-testid="dice-roller-tray" className="panel dice-tray">
            <h2>Dice Roller Tray</h2>
            <div className="dice-selector">
              {[4, 6, 8, 10, 12, 20, 100].map((sides) => (
                <button
                  key={sides}
                  data-testid={`dice-button-${sides}`}
                  type="button"
                  className={`btn ${selectedDie === sides ? "btn-primary" : "btn-secondary"} dice-btn`}
                  onClick={() => setSelectedDie(sides)}
                >
                  d{sides}
                </button>
              ))}
            </div>

            <div className="dice-controls-grid">
              <label>
                Modifier (+/-)
                <input
                  data-testid="dice-modifier-input"
                  type="text"
                  placeholder="e.g. 5 or -2"
                  value={modifier}
                  onChange={(e) => setModifier(e.target.value)}
                />
              </label>
              <label>
                Count
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={diceCount}
                  onChange={(e) => setDiceCount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                />
              </label>
            </div>

            <label>
              Roll Reason / Label
              <input
                type="text"
                placeholder="e.g. Attack roll, Stealth check"
                value={rollLabel}
                onChange={(e) => setRollLabel(e.target.value)}
              />
            </label>

            <button
              data-testid="dice-roll-button"
              type="button"
              className="btn btn-primary dice-roll-action"
              onClick={handleRollDice}
            >
              Roll {diceCount > 1 ? `${diceCount}` : ""}d{selectedDie}
              {modifier ? (modifier.startsWith("-") ? modifier : `+${modifier}`) : ""}
            </button>
          </section>
        </div>

        {/* Real-time Session Chat */}
        <div className="session-chat-panel panel">
          <h2>Session Chat</h2>
          <div data-testid="chat-stream" ref={chatStreamRef} className="chat-stream">
            {visibleMessages.length === 0 ? (
              <p className="empty-state">No messages yet. Say hello or roll some dice!</p>
            ) : (
              visibleMessages.map((msg) => {
                let parsedDice: (DiceRollResult & { label?: string }) | null = null;
                if (msg.type === "DICE") {
                  try {
                    parsedDice = JSON.parse(msg.content);
                  } catch {
                    parsedDice = null;
                  }
                }

                return (
                  <div
                    key={msg.id}
                    data-testid="chat-message"
                    className={`chat-message ${msg.type === "DICE" ? "chat-message-dice" : ""}`}
                  >
                    <div className="chat-header">
                      <strong data-testid="chat-author" className="chat-author">
                        {msg.userName}
                      </strong>
                      <span className="chat-timestamp">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {effectiveIsOwner && (
                        <button
                          data-testid="chat-delete-button"
                          type="button"
                          className="btn btn-danger btn-xs chat-delete-btn"
                          title="Delete message"
                          onClick={() => handleDeleteMessage(msg.id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {msg.type === "DICE" && parsedDice ? (
                      <div data-testid="chat-content" className="chat-content dice-content">
                        {parsedDice.label && (
                          <div className="dice-roll-label">🎲 {parsedDice.label}</div>
                        )}
                        <div className="dice-roll-summary">
                          Rolled <strong>{parsedDice.formula}</strong>: [
                          {(parsedDice.dice || []).join(", ")}]
                          {parsedDice.modifier !== 0
                            ? parsedDice.modifier > 0
                              ? ` + ${parsedDice.modifier}`
                              : ` - ${Math.abs(parsedDice.modifier)}`
                            : ""}{" "}
                          ={" "}
                          <span className="dice-total-highlight">{parsedDice.total}</span>
                        </div>
                      </div>
                    ) : (
                      <div data-testid="chat-content" className="chat-content">
                        {msg.content}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form className="chat-input-bar" onSubmit={handleSendChat}>
            <input
              data-testid="chat-input"
              type="text"
              placeholder="Send a message to everyone in the room…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={session?.status === "PAUSED" && !effectiveIsOwner}
            />
            <button
              data-testid="chat-send-button"
              type="submit"
              className="btn btn-primary"
              disabled={session?.status === "PAUSED" && !effectiveIsOwner}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
