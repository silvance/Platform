"use client";

import { useTransition } from "react";
import { logoutAction } from "./actions";

export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => logoutAction())}
      disabled={pending}
      style={{
        background: "transparent",
        color: "var(--muted)",
        border: "1px solid #2a3556",
        borderRadius: 6,
        padding: ".3rem .65rem",
        cursor: "pointer",
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
