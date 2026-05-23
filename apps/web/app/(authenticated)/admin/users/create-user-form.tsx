"use client";

import { useActionState, useRef, useEffect } from "react";
import { MIN_PASSWORD_LENGTH } from "@ci-train/contracts";
import { createUserAction, type UserActionState } from "./actions";

const initial: UserActionState = { error: null, ok: null };

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful create so the next entry
  // starts fresh. Reaching for ref + reset() rather than a key prop
  // so pending/error states don't blink on re-render.
  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state.ok]);

  return (
    <form
      action={action}
      ref={formRef}
      className="card"
      style={{ maxWidth: 560, marginBottom: "1.25rem" }}
    >
      <h2 style={{ marginTop: 0, marginBottom: ".75rem", fontSize: "1.05rem" }}>
        Add user
      </h2>
      <div style={gridStyle}>
        <label style={labelStyle}>
          <div style={legendStyle}>Email</div>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <div style={legendStyle}>Display name</div>
          <input
            name="displayName"
            type="text"
            required
            minLength={1}
            maxLength={120}
            autoComplete="off"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <div style={legendStyle}>Role</div>
          <select name="role" defaultValue="user" style={inputStyle}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label style={labelStyle}>
          <div style={legendStyle}>
            Password (min {MIN_PASSWORD_LENGTH} characters)
          </div>
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            style={inputStyle}
          />
        </label>
      </div>
      {state.error ? (
        <div className="tag-bad" style={msgStyle}>{state.error}</div>
      ) : null}
      {state.ok ? (
        <div className="tag-ok" style={msgStyle}>{state.ok}</div>
      ) : null}
      <button type="submit" disabled={pending} style={buttonStyle}>
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.75rem",
};
const labelStyle: React.CSSProperties = { display: "block" };
const legendStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: ".85rem",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: ".5rem .75rem",
  background: "var(--bg-sunken)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  color: "var(--fg)",
  fontSize: "1rem",
};
const msgStyle: React.CSSProperties = {
  display: "block",
  margin: ".5rem 0 0 0",
};
const buttonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--bg-sunken)",
  border: 0,
  borderRadius: 6,
  padding: ".55rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: ".75rem",
};
