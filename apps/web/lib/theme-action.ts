"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE, type Theme } from "./theme";

// One-year cookie. Theme is a preference, not a security gate;
// no need for HttpOnly. SameSite=lax so a redirect from the
// toggle action still carries the freshly-set cookie.
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export async function setTheme(next: Theme): Promise<void> {
  const jar = await cookies();
  jar.set(THEME_COOKIE, next, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SEC,
    path: "/",
  });
  // Revalidate the root so the new data-theme attribute renders
  // on the next paint without a full reload.
  revalidatePath("/", "layout");
}
