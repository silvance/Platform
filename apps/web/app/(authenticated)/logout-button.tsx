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
      className="btn btn-ghost btn-sm"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
