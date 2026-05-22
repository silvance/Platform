"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import { ChangePasswordRequest, MIN_PASSWORD_LENGTH } from "@ci-train/contracts";

export interface ChangePasswordActionState {
  error: string | null;
  ok: string | null;
}

export async function changePasswordAction(
  _prev: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const token = await readToken();
  if (!token) {
    return { error: "Session expired. Reload and sign in again.", ok: null };
  }

  // Pre-validate on the BFF so we can return a precise message
  // (the API would also reject, but the round-trip would look
  // like a generic 400). The schema enforces min-length and the
  // new-password-must-differ refinement.
  const parsed = ChangePasswordRequest.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error:
        first?.message ??
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters and differ from your current password.`,
      ok: null,
    };
  }

  try {
    await api.changePassword(token, parsed.data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { error: "Current password is incorrect.", ok: null };
    }
    if (err instanceof ApiError && err.status === 429) {
      return {
        error: "Too many attempts — slow down and try again in a few minutes.",
        ok: null,
      };
    }
    if (err instanceof ApiError && err.status === 400) {
      return {
        error: "Password didn't meet requirements. Try a longer, distinct one.",
        ok: null,
      };
    }
    return { error: "Password change failed. Please try again.", ok: null };
  }

  // The current session is preserved; other sessions were revoked
  // server-side. Refresh the page state so any cached /me data is
  // re-fetched cleanly.
  revalidatePath("/me/security");
  return {
    error: null,
    ok: "Password updated. Other active sessions for your account have been signed out.",
  };
}
