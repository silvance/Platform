import "server-only";
import { cookies } from "next/headers";

// Server-side helpers for the theme system. The `data-theme`
// attribute on <html> is set by the root layout at render time
// based on the THEME_COOKIE; the client-side toggle is a server
// action that flips the cookie and revalidates.
//
// Default theme is "dark" — matches the prior UI and keeps a
// first-time visitor from getting a flash on the very first hit.

export const THEME_COOKIE = "cl_theme";

export type Theme = "light" | "dark";
export const VALID_THEMES: readonly Theme[] = ["light", "dark"];

export async function readTheme(): Promise<Theme> {
  const jar = await cookies();
  const v = jar.get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "dark";
}
