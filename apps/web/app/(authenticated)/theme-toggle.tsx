"use client";

import { useTransition } from "react";
import { setTheme } from "@/lib/theme-action";
import type { Theme } from "@/lib/theme";

// Header theme toggle. Submits to a server action that flips the
// THEME_COOKIE and revalidates the layout — no client-side
// theming or hydration mismatch, since <html data-theme> is
// rendered server-side from the cookie.
export function ThemeToggle({ current }: { current: Theme }) {
  const [pending, startTransition] = useTransition();
  const next: Theme = current === "dark" ? "light" : "dark";
  const label =
    current === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      className="icon-btn"
      title={label}
      aria-label={label}
      disabled={pending}
      onClick={() => startTransition(() => setTheme(next))}
    >
      {current === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
