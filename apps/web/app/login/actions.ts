"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";
import { LoginRequest } from "@ci-train/contracts";

export interface LoginActionState {
  error: string | null;
}

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = LoginRequest.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Email and password are required." };
  }

  let res;
  try {
    res = await api.login(parsed.data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { error: "Invalid email or password." };
    }
    if (err instanceof ApiError && err.status === 429) {
      return { error: "Too many attempts — slow down and try again." };
    }
    return { error: "Login failed. Please try again." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, res.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(res.expiresAt),
    path: "/",
  });

  redirect(res.user.role === "admin" ? "/admin" : "/scenarios");
}
