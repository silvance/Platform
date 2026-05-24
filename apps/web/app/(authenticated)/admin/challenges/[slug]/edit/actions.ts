"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  CreateIndicatorSetRequest,
  CreateQuestionRequest,
  IndicatorItem,
  Lane,
  ScenarioBriefDraft,
  ScenarioStatus,
  SkillArea,
  UpdateIndicatorSetRequest,
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

    const moduleRaw = formData.get("module");
    const moduleValue =
      typeof moduleRaw === "string" && moduleRaw.trim() !== ""
        ? moduleRaw.trim()
        : null;
    const sequenceRaw = formData.get("sequence");
    const sequence =
      typeof sequenceRaw === "string" && sequenceRaw.trim() !== ""
        ? Number.parseInt(sequenceRaw, 10)
        : undefined;
    const body = UpdateScenarioRequest.parse({
      title: getString(formData, "title").trim(),
      summary: getString(formData, "summary").trim(),
      difficulty: Number(formData.get("difficulty")),
      estimatedMinutes: getOptionalNumber(formData, "estimatedMinutes"),
      skillAreas,
      tags,
      status: ScenarioStatus.parse(getString(formData, "status")),
 // curated-library fields. Lane is required at the API
      // level once we declare an UpdateScenarioRequest that
      // includes it; here we forward whatever the form has.
      lane: Lane.parse(getString(formData, "lane")),
      module: moduleValue,
      sequence,
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
  if (type === "select_indicators") {
    const indicatorSetId = getString(formData, "indicatorSetId");
    const correctIds = formData
      .getAll("siCorrectId")
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return CreateQuestionRequest.parse({
      type: "select_indicators",
      ...base,
      indicatorSetId,
      correctIds,
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

// M21e: per-question review notes. Saves to the dedicated
// review endpoint (not the question-update endpoint) so it's
// independent of question content edits and visible only on
// admin payloads.
export async function setQuestionReviewAction(
  slug: string,
  questionId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };
  const raw = formData.get("notes");
  const notes = typeof raw === "string" ? raw : "";
  try {
    await api.authoring.setQuestionReview(token, slug, questionId, { notes });
  } catch (err) {
    return fail(err, "Failed to save review notes.");
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

// ─── indicator-set CRUD ──────────────────────────────────────────

function parseIndicatorSetItems(formData: FormData) {
  const ids = formData
    .getAll("itemId")
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim());
  const labels = formData
    .getAll("itemLabel")
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim());
  const evidenceRefs = formData
    .getAll("itemEvidenceRef")
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim());
  const len = Math.max(ids.length, labels.length, evidenceRefs.length);
  const items: ReadonlyArray<ReturnType<typeof IndicatorItem.parse>> = Array.from(
    { length: len },
    (_, i) => {
      const id = ids[i] ?? "";
      const label = labels[i] ?? "";
      const evidenceRef = evidenceRefs[i] ?? "";
      if (id.length === 0 || label.length === 0) return null;
      return IndicatorItem.parse({
        id,
        label,
        evidenceRef: evidenceRef.length > 0 ? evidenceRef : null,
      });
    },
  ).filter(
    (x): x is ReturnType<typeof IndicatorItem.parse> => x !== null,
  );
  return items;
}

export async function addIndicatorSetAction(
  slug: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const items = parseIndicatorSetItems(formData);
    const sourceArtifactId = getString(formData, "sourceArtifactId").trim();
    const body = CreateIndicatorSetRequest.parse({
      slug: getString(formData, "slug").trim(),
      displayName: getString(formData, "displayName").trim(),
      sourceArtifactId: sourceArtifactId.length > 0 ? sourceArtifactId : null,
      items,
    });
    await api.authoring.addIndicatorSet(token, slug, body);
  } catch (err) {
    return fail(err, "Failed to add indicator set.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function updateIndicatorSetAction(
  slug: string,
  setId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const items = parseIndicatorSetItems(formData);
    const sourceArtifactId = getString(formData, "sourceArtifactId").trim();
    const body = UpdateIndicatorSetRequest.parse({
      displayName: getString(formData, "displayName").trim(),
      sourceArtifactId: sourceArtifactId.length > 0 ? sourceArtifactId : null,
      items,
    });
    await api.authoring.updateIndicatorSet(token, slug, setId, body);
  } catch (err) {
    return fail(err, "Failed to save indicator set.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function deleteIndicatorSetAction(
  slug: string,
  setId: string,
): Promise<void> {
  const token = await readToken();
  if (!token) redirect("/login");
  await api.authoring.removeIndicatorSet(token, slug, setId);
  revalidatePath(`/admin/challenges/${slug}/edit`);
}

// ─── artifact CRUD ───────────────────────────────────────────────

export async function uploadArtifactAction(
  slug: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  // Hand the multipart payload straight through. The API validates the
  // file size + kind + displayName; we forward as-is.
  try {
    await api.authoring.addArtifact(token, slug, formData);
  } catch (err) {
    return fail(err, "Failed to upload artifact.");
  }
  revalidatePath(`/admin/challenges/${slug}/edit`);
  return { ok: true };
}

export async function deleteArtifactAction(
  slug: string,
  artifactId: string,
): Promise<void> {
  const token = await readToken();
  if (!token) redirect("/login");
  await api.authoring.removeArtifact(token, slug, artifactId);
  revalidatePath(`/admin/challenges/${slug}/edit`);
}
