"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@ci-train/contracts";
import { registerAction, type RegisterActionState } from "./actions";

const initial: RegisterActionState = { error: null, ok: null };

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  if (state.ok) {
    // Replace the form on success — leaving the form mounted with
    // pre-filled values would invite a confused re-submit.
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Registration received
        </h2>
        <p style={{ color: "var(--muted)" }}>{state.ok}</p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/login" style={{ color: "var(--accent)" }}>
            ← Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card" style={{ maxWidth: 480 }}>
      <label style={labelStyle}>
        <div style={legendStyle}>Email</div>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
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
          autoComplete="name"
          style={inputStyle}
        />
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
      <label style={labelStyle}>
        <div style={legendStyle}>Confirm password</div>
        <input
          name="confirmPassword"
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
      <button type="submit" disabled={pending} style={buttonStyle}>
        {pending ? "Submitting…" : "Request account"}
      </button>
      <p
        style={{
          marginTop: "0.85rem",
          marginBottom: 0,
          color: "var(--muted)",
          fontSize: ".85rem",
        }}
      >
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Sign in
        </Link>
        .
      </p>
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
