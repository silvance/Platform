"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  CreateScenarioRequest,
  SkillArea,
  type CreateScenarioRequest as CreateScenarioRequestType,
} from "@ci-train/contracts";

export type CreateScenarioState =
  | { ok: true }
  | { ok: false; error: string };

// Minimal create form. Just enough to get a draft into the DB; the
// detail editor handles the long-tail fields. Tags/skillAreas can be
// edited there too — we only require skillAreas here because the
// contract demands at least one.
export async function createScenarioAction(
  _prev: CreateScenarioState | undefined,
  formData: FormData,
): Promise<CreateScenarioState> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  const skillAreas = formData
    .getAll("skillArea")
    .filter((v): v is string => typeof v === "string");
  // Tolerate either the canonical enum names or stripped-whitespace
  // copy-paste. parseFloat for difficulty handles "3" vs 3.
  const rawDifficulty = formData.get("difficulty");
  const rawMinutes = formData.get("estimatedMinutes");

  let parsed: CreateScenarioRequestType;
  try {
    parsed = CreateScenarioRequest.parse({
      slug: String(formData.get("slug") ?? "").trim(),
      title: String(formData.get("title") ?? "").trim(),
      summary: String(formData.get("summary") ?? "").trim(),
      skillAreas: skillAreas.map((a) => SkillArea.parse(a)),
      difficulty: Number(rawDifficulty),
      estimatedMinutes:
        rawMinutes && String(rawMinutes).trim() !== ""
          ? Number(rawMinutes)
          : null,
      tags: [],
      status: "draft",
      brief: {
        markdownBody: String(formData.get("briefMd") ?? "").trim(),
        disclaimerMd: null,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input." };
    }
    throw err;
  }

  let slug: string;
  try {
    const created = await api.authoring.create(token, parsed);
    slug = created.slug;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { ok: false, error: "That slug is already in use." };
    }
    if (err instanceof ApiError && err.status === 400) {
      const ebody = err.body as { message?: string } | undefined;
      return {
        ok: false,
        error: ebody?.message ?? "The API rejected this scenario.",
      };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : "Failed to create scenario.",
    };
  }

  revalidatePath("/admin/challenges");
  redirect(`/admin/challenges/${slug}/edit`);
}
