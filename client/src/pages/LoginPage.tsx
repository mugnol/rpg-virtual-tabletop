import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { FormError } from "../components/FormError";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main data-testid="page-login" className="page auth-page">
      <form data-testid="login-form" className="card form" onSubmit={onSubmit}>
        <h1>Log in</h1>
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
          Password
          <input
            data-testid="password-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button data-testid="login-submit" type="submit" className="btn btn-primary" disabled={submitting}>
          Log in
        </button>
        <p className="form-footer">
          No account yet? <Link to="/register">Register</Link>
        </p>
      </form>
    </main>
  );
}
