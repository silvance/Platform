"use client";

import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@ci-train/contracts";
import {
  changePasswordAction,
  type ChangePasswordActionState,
} from "./actions";

const initial: ChangePasswordActionState = { error: null, ok: null };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initial,
  );

  return (
    <form action={action} className="card" style={{ maxWidth: 480 }}>
      <label style={labelStyle}>
        <div style={legendStyle}>Current password</div>
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <div style={legendStyle}>
          New password (min {MIN_PASSWORD_LENGTH} characters)
        </div>
        <input
          name="newPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          style={inputStyle}
        />
      </label>
      {state.error ? (
        <div className="tag-bad" style={msgStyle}>{state.error}</div>
      ) : null}
      {state.ok ? (
        <div className="tag-ok" style={msgStyle}>{state.ok}</div>
      ) : null}
      <button type="submit" disabled={pending} style={buttonStyle}>
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: ".75rem",
};
const legendStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: ".85rem",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: ".5rem .75rem",
  background: "#0b1020",
  border: "1px solid #2a3556",
  borderRadius: 6,
  color: "var(--fg)",
  fontSize: "1rem",
};
const msgStyle: React.CSSProperties = {
  display: "block",
  margin: ".5rem 0",
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
