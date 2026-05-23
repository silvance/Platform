"use server";

import { api, ApiError } from "@/lib/api";
import { RegisterRequest } from "@ci-train/contracts";

// Discriminated state. `ok` carries the success message we render
// in place of the form; `error` is the message we keep above the
// form when the submission fails validation or throttling.
//
// Note: the API deliberately returns the SAME response shape
// whether the email was new or already registered, so this action
// can't tell the user "that email is already taken" — which would
// leak account enumeration. The success message is the same.
export type RegisterActionState =
  | { error: null; ok: null }
  | { error: string; ok: null }
  | { error: null; ok: string };

export async function registerAction(
  _prev: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  // Confirm-password is a client-side / BFF-side concern only — the
  // API has no opinion on it (the RegisterRequest contract carries
  // a single password). Check before touching Zod so the mismatch
  // message comes out cleanly rather than mixed in with min-length
  // errors.
  if (
    typeof password === "string" &&
    typeof confirmPassword === "string" &&
    password !== confirmPassword
  ) {
    return { error: "Passwords don't match. Re-type the confirmation.", ok: null };
  }

  const parsed = RegisterRequest.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
      ok: null,
    };
  }

  try {
    const res = await api.register(parsed.data);
    return { error: null, ok: res.message };
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      return {
        error: "Too many attempts — slow down and try again in a few minutes.",
        ok: null,
      };
    }
    if (err instanceof ApiError && err.status === 400) {
      return {
        error:
          "Registration didn't meet requirements (email + name + password ≥ 10 chars).",
        ok: null,
      };
    }
    return { error: "Registration failed. Please try again.", ok: null };
  }
}
