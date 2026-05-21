"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await api.logout(token);
    } catch {
      // Best-effort revocation; clearing the cookie is what matters for the client.
    }
  }
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
