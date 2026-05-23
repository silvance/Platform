"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";

export type CreateCodeState =
  | { error: null; ok: null }
  | { error: string; ok: null }
  | { error: null; ok: string };

export async function createAccessCodeAction(
  _prev: CreateCodeState,
  formData: FormData,
): Promise<CreateCodeState> {
  const token = await readToken();
  if (!token) return { error: "Not signed in.", ok: null };

  const labelRaw = formData.get("label");
  const codeRaw = formData.get("code");
  const usesLimitRaw = formData.get("usesLimit");
  const expiresAtRaw = formData.get("expiresAt");

  if (typeof labelRaw !== "string" || labelRaw.trim() === "") {
    return { error: "Label is required.", ok: null };
  }

  const usesLimit =
    typeof usesLimitRaw === "string" && usesLimitRaw.trim() !== ""
      ? Number.parseInt(usesLimitRaw, 10)
      : undefined;
  if (usesLimit !== undefined && (!Number.isFinite(usesLimit) || usesLimit < 1)) {
    return { error: "Uses limit must be a positive integer (or blank).", ok: null };
  }

  const expiresAt =
    typeof expiresAtRaw === "string" && expiresAtRaw.trim() !== ""
      ? new Date(expiresAtRaw).toISOString()
      : undefined;

  try {
    const res = await api.accessCodes.create(token, {
      label: labelRaw.trim(),
      ...(typeof codeRaw === "string" && codeRaw.trim() !== ""
        ? { code: codeRaw.trim() }
        : {}),
      ...(usesLimit !== undefined ? { usesLimit } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    });
    revalidatePath("/admin/access-codes");
    return {
      error: null,
      ok: `Created code ${res.code.code}.`,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return {
        error: "That code is already in use. Pick a different value or leave the field blank to auto-generate.",
        ok: null,
      };
    }
    if (err instanceof ApiError && err.status === 400) {
      return { error: "Invalid input — check label, limit, and expiry.", ok: null };
    }
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { error: "Not authorized.", ok: null };
    }
    return { error: "Create failed. Try again.", ok: null };
  }
}

export type DisableCodeState =
  | { ok: true }
  | { ok: false; error: string };

export async function disableAccessCodeAction(
  id: string,
  _prev: DisableCodeState | undefined,
): Promise<DisableCodeState> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };
  try {
    await api.accessCodes.disable(token, id);
    revalidatePath("/admin/access-codes");
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, error: "Not authorized." };
    }
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, error: "Code not found." };
    }
    return { ok: false, error: "Disable failed." };
  }
}
