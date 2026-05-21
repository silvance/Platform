"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "./actions";

const initial: LoginActionState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="card" style={{ maxWidth: 420 }}>
      <label style={{ display: "block", marginBottom: ".75rem" }}>
        <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>Email</div>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          style={inputStyle}
        />
      </label>
      <label style={{ display: "block", marginBottom: ".75rem" }}>
        <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>Password</div>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </label>
      {state.error ? (
        <div className="tag-bad" style={{ margin: ".5rem 0" }}>
          {state.error}
        </div>
      ) : null}
      <button type="submit" disabled={pending} style={buttonStyle}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: ".5rem .75rem",
  background: "#0b1020",
  border: "1px solid #2a3556",
  borderRadius: 6,
  color: "var(--fg)",
  fontSize: "1rem",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "#0b1020",
  border: 0,
  borderRadius: 6,
  padding: ".55rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
};
