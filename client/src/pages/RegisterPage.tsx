import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"GM" | "PLAYER" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setError("Display name must be between 2 and 40 characters");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (role === "") {
      setError("Please choose a role");
      return;
    }
    setSubmitting(true);
    try {
      await register({ email, password, displayName: trimmedName, role });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main data-testid="page-register" className="page auth-page">
      <form data-testid="register-form" className="card form" onSubmit={onSubmit}>
        <h1>Create your account</h1>
        <FormError message={error} />
        <label>
          Email
          <input
            data-testid="email-input"
            type="text"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Display name
          <input
            data-testid="display-name-input"
            type="text"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            data-testid="password-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <fieldset className="role-picker">
          <legend>Role</legend>
          <label className="role-option">
            <input
              data-testid="role-gm"
              type="radio"
              name="role"
              value="GM"
              checked={role === "GM"}
              onChange={() => setRole("GM")}
            />
            Game Master
          </label>
          <label className="role-option">
            <input
              data-testid="role-player"
              type="radio"
              name="role"
              value="PLAYER"
              checked={role === "PLAYER"}
              onChange={() => setRole("PLAYER")}
            />
            Player
          </label>
        </fieldset>
        <button data-testid="register-submit" type="submit" className="btn btn-primary" disabled={submitting}>
          Register
        </button>
        <p className="form-footer">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
