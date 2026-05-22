"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import type { ImportPackResponse } from "@ci-train/contracts";

export type ImportResult =
  | { ok: true; result: ImportPackResponse }
  | { ok: false; error: string };

export async function importPackAction(
  _prev: ImportResult | undefined,
  formData: FormData,
): Promise<ImportResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  const file = formData.get("file");
  if (!file) return { ok: false, error: "Missing file." };

  try {
    const result = await api.authoring.importPack(token, formData);
    revalidatePath("/admin/challenges");
    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body as { message?: string } | undefined;
      return { ok: false, error: body?.message ?? err.message };
    }
    return { ok: false, error: "Import failed." };
  }
}
