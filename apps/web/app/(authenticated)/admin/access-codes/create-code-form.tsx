"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAccessCodeAction, type CreateCodeState } from "./actions";

const initial: CreateCodeState = { error: null, ok: null };

export function CreateAccessCodeForm() {
  const [state, action, pending] = useActionState(createAccessCodeAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

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
      style={{ maxWidth: 720, marginBottom: "1.25rem" }}
    >
      <h2 style={{ marginTop: 0, marginBottom: ".75rem", fontSize: "1.05rem" }}>
        Issue a new code
      </h2>
      <div style={gridStyle}>
        <label style={labelStyle}>
          <div style={legendStyle}>Label *</div>
          <input
            name="label"
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Onboarding Jun 2026"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <div style={legendStyle}>Code (blank = auto-generate)</div>
          <input
            name="code"
            type="text"
            maxLength={64}
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="auto"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <div style={legendStyle}>Uses limit (blank = unlimited)</div>
          <input
            name="usesLimit"
            type="number"
            min={1}
            step={1}
            placeholder="unlimited"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <div style={legendStyle}>Expires (blank = never)</div>
          <input
            name="expiresAt"
            type="datetime-local"
            style={inputStyle}
          />
        </label>
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: ".55rem",
          marginTop: ".85rem",
        }}
      >
        <input
          name="autoApprove"
          type="checkbox"
          defaultChecked
          style={{ marginTop: ".2rem" }}
        />
        <span style={{ fontSize: ".9rem" }}>
          Auto-approve registrations
          <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>
            Checked: anyone with the code can sign in immediately after
            registering. Uncheck to require an admin to approve each new
            account from <code>/admin/users</code> first &mdash; useful
            for codes posted to a wider channel.
          </div>
        </span>
      </label>
      {state.error ? (
        <div className="tag-bad" style={msgStyle}>{state.error}</div>
      ) : null}
      {state.ok ? (
        <div className="tag-ok" style={msgStyle}>{state.ok}</div>
      ) : null}
      <button type="submit" disabled={pending} style={buttonStyle}>
        {pending ? "Creating…" : "Create code"}
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
