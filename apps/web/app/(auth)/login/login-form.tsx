"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "./actions";

const initial: LoginActionState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="auth-form">
      <div className="field">
        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>
      {state.error ? (
        <div className="form-message error" role="alert">{state.error}</div>
      ) : null}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending}
        style={{ width: "100%", marginTop: "0.25rem" }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
