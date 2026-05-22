// Server-only session helpers. The browser never sees the raw API token —
// it lives in an HttpOnly cookie set by Next.js on its own origin, and
// Next.js forwards it to the API via Authorization headers on server-side
// fetches.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "./api";
import type { PublicUser } from "@ci-train/contracts";

export const SESSION_COOKIE = "ci_train_session";

export async function readToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await readToken();
  if (!token) return null;
  try {
    const me = await api.me(token);
    return me.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireInstructor(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/scenarios");
  return user;
}
