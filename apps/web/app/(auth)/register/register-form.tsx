"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@ci-train/contracts";
import { registerAction, type RegisterActionState } from "./actions";

const initial: RegisterActionState = { error: null, ok: null };

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  if (state.ok) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Account ready
        </h2>
        <p className="muted">{state.ok}</p>
        <p style={{ margin: 0 }}>
          <Link href="/login">→ Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="auth-form">
      <div className="field">
        <label className="field-label" htmlFor="accessCode">
          Access code
        </label>
        <input
          id="accessCode"
          name="accessCode"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="input"
          placeholder="From your invite"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          minLength={1}
          maxLength={120}
          autoComplete="name"
          className="input"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="password">
          Password (min {MIN_PASSWORD_LENGTH} characters)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className="input"
        />
      </div>
      {state.error ? (
        <div className="form-message error" role="alert">{state.error}</div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
        style={{ width: "100%", marginTop: "0.25rem" }}
      >
        {pending ? "Submitting…" : "Create account"}
      </button>
    </form>
  );
}
