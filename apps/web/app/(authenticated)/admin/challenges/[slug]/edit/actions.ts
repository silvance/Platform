"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  CreateQuestionRequest,
  ScenarioBriefDraft,
  ScenarioStatus,
  SkillArea,
  UpdateScenarioRequest,
} from "@ci-train/contracts";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function fail(err: unknown, fallback: string): ActionResult {
  if (err instanceof ZodError) {
    return { ok: false, error: err.issues[0]?.message ?? fallback };
  }
  if (err instanceof ApiError) {
    const ebody = err.body as { message?: string } | undefined;
    return { ok: false, error: ebody?.message ?? err.message };
  }
  return { ok: false, error: fallback };
}

function getString(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
}

function getOptionalNumber(fd: FormData, name: string): number | null {
  const v = fd.get(name);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function updateMetadataAction(
  slug: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const skillAreas = formData
      .getAll("skillArea")
      .filter((v): v is string => typeof v === "string")
      .map((a) => SkillArea.parse(a));
    const tagsRaw = getString(formData, "tags");
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const body = UpdateScenarioRequest.parse({
      title: getString(formData, "title").trim(),
      summary: getString(formData, "summary").trim(),
      difficulty: Number(formData.get("difficulty")),
      estimatedMinutes: getOptionalNumber(formData, "estimatedMinutes"),
      skillAreas,
      tags,
      status: ScenarioStatus.parse(getString(formData, "status")),
    });
    await api.authoring.update(token, slug, body);
  } catch (err) {
    return fail(err, "Failed to save metadata.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function updateBriefAction(
  slug: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const disclaimer = getString(formData, "disclaimerMd").trim();
    const body = {
      brief: ScenarioBriefDraft.parse({
        markdownBody: getString(formData, "markdownBody"),
        disclaimerMd: disclaimer.length > 0 ? disclaimer : null,
      }),
    };
    await api.authoring.update(token, slug, body);
  } catch (err) {
    return fail(err, "Failed to save brief.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function deleteScenarioAction(slug: string): Promise<void> {
  const token = await readToken();
  if (!token) redirect("/login");
  await api.authoring.remove(token, slug);
  revalidatePath("/admin/challenges");
  redirect("/admin/challenges");
}

// ─── question CRUD ───────────────────────────────────────────────

function parseQuestionForm(formData: FormData) {
  const type = getString(formData, "type");
  const base = {
    promptMd: getString(formData, "promptMd"),
    weight: Number(formData.get("weight") || 1),
    debriefMd: getString(formData, "debriefMd"),
  };

  if (type === "multi_choice") {
    const optionLabels = formData
      .getAll("optionLabel")
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Assign synthetic ids: opt-1, opt-2, ... Stable across edits of the
    // same form because order is preserved by FormData and admins are
    // editing labels, not re-ordering ids by hand.
    const options = optionLabels.map((label, i) => ({
      id: `opt-${i + 1}`,
      label,
    }));
    const correctIndexes = formData
      .getAll("correctIndex")
      .filter((v): v is string => typeof v === "string")
      .map((v) => Number(v));
    const correctIds = correctIndexes
      .filter((i) => Number.isInteger(i) && i >= 0 && i < options.length)
      .map((i) => options[i]!.id);
    return CreateQuestionRequest.parse({
      type: "multi_choice",
      ...base,
      options,
      allowMultiple: formData.get("allowMultiple") === "on",
      correctIds,
    });
  }
  if (type === "confidence") {
    return CreateQuestionRequest.parse({
      type: "confidence",
      ...base,
      expectedRange: [
        Number(formData.get("expectedLo") ?? 3),
        Number(formData.get("expectedHi") ?? 5),
      ],
    });
  }
  if (type === "text_match") {
    const acceptableAnswers = getString(formData, "acceptableAnswers")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const hintRaw = getString(formData, "hint").trim();
    return CreateQuestionRequest.parse({
      type: "text_match",
      ...base,
      acceptableAnswers,
      caseSensitive: formData.get("caseSensitive") === "on",
      normalizeWhitespace: formData.get("normalizeWhitespace") === "on",
      regex: formData.get("regex") === "on",
      hint: hintRaw.length > 0 ? hintRaw : null,
      hintAfterTries: Number(formData.get("hintAfterTries") || 3),
    });
  }
  throw new Error(`Unsupported question type: ${type}`);
}

export async function addQuestionAction(
  slug: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const body = parseQuestionForm(formData);
    await api.authoring.addQuestion(token, slug, body);
  } catch (err) {
    return fail(err, "Failed to add question.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function updateQuestionAction(
  slug: string,
  questionId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const body = parseQuestionForm(formData);
    await api.authoring.updateQuestion(token, slug, questionId, body);
  } catch (err) {
    return fail(err, "Failed to update question.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function deleteQuestionAction(
  slug: string,
  questionId: string,
): Promise<void> {
  const token = await readToken();
  if (!token) redirect("/login");
  await api.authoring.removeQuestion(token, slug, questionId);
  revalidatePath(`/admin/challenges/${slug}/edit`);
}
