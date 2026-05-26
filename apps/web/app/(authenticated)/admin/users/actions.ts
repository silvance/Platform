"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  AdminCreateUserRequest,
  AdminResetPasswordRequest,
  AdminUpdateUserRequest,
  MIN_PASSWORD_LENGTH,
} from "@ci-train/contracts";

export interface UserActionState {
  error: string | null;
  ok: string | null;
}

const initialOk = (msg: string): UserActionState => ({ error: null, ok: msg });
const initialErr = (msg: string): UserActionState => ({ error: msg, ok: null });

function describeError(err: unknown, fallback: string): UserActionState {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      return initialErr("A user with that email already exists.");
    }
    if (err.status === 400) {
      // The API returns the zod issue message directly in many
      // cases; surface it when we can read it.
      const body = err.body as { message?: unknown } | null;
      if (body && typeof body.message === "string") {
        return initialErr(body.message);
      }
      return initialErr(
        `Request rejected. Check the form and try again (passwords need at ` +
          `least ${MIN_PASSWORD_LENGTH} characters).`,
      );
    }
    if (err.status === 401 || err.status === 403) {
      return initialErr("You're not authorized to do that.");
    }
  }
  return initialErr(fallback);
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const token = await readToken();
  if (!token) return initialErr("Session expired. Reload and sign in again.");

  const parsed = AdminCreateUserRequest.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return initialErr(
      parsed.error.issues[0]?.message ??
        "Check the form — all fields are required.",
    );
  }

  try {
    await api.users.create(token, parsed.data);
  } catch (err) {
    return describeError(err, "Failed to create user.");
  }

  revalidatePath("/admin/users");
  return initialOk(`Created ${parsed.data.email}.`);
}

export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const token = await readToken();
  if (!token) return initialErr("Session expired. Reload and sign in again.");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return initialErr("Missing user id.");
  }

  // Only ship the fields the form actually carried — the schema
  // refuses an empty patch.
  const patch: Record<string, unknown> = {};
  const role = formData.get("role");
  const disabledRaw = formData.get("disabled");
  if (typeof role === "string" && role.length > 0) patch.role = role;
  if (typeof disabledRaw === "string") {
    patch.disabled = disabledRaw === "true";
  }

  const parsed = AdminUpdateUserRequest.safeParse(patch);
  if (!parsed.success) {
    return initialErr(
      parsed.error.issues[0]?.message ??
        "Nothing to change — pick a role or disabled toggle.",
    );
  }

  try {
    await api.users.update(token, id, parsed.data);
  } catch (err) {
    return describeError(err, "Failed to update user.");
  }

  revalidatePath("/admin/users");
  return initialOk("User updated.");
}

export async function approveUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const token = await readToken();
  if (!token) return initialErr("Session expired. Reload and sign in again.");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return initialErr("Missing user id.");
  }

  try {
    await api.users.approve(token, id);
  } catch (err) {
    return describeError(err, "Failed to approve user.");
  }

  revalidatePath("/admin/users");
  return initialOk("User approved. They can now sign in.");
}

export async function deleteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const token = await readToken();
  if (!token) return initialErr("Session expired. Reload and sign in again.");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return initialErr("Missing user id.");
  }

  try {
    await api.users.remove(token, id);
  } catch (err) {
    return describeError(err, "Failed to delete user.");
  }

  revalidatePath("/admin/users");
  return initialOk("Account deleted.");
}

export async function resetPasswordAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const token = await readToken();
  if (!token) return initialErr("Session expired. Reload and sign in again.");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return initialErr("Missing user id.");
  }

  const parsed = AdminResetPasswordRequest.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return initialErr(
      parsed.error.issues[0]?.message ??
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  try {
    await api.users.resetPassword(token, id, parsed.data);
  } catch (err) {
    return describeError(err, "Failed to reset password.");
  }

  revalidatePath("/admin/users");
  return initialOk(
    "Password reset. The user's other sessions have been signed out.",
  );
}
