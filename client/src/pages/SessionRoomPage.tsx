import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getSession,
  type DiceRollResult,
  type GameSession,
  type SessionMessageItem,
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
        // Note: owner status is known once session_state arrives or if user is owner
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
        setLoading(false);
      });

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
