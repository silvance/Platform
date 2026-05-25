"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  QuestionResponse,
  ScenarioReviewStatus,
  SubmitAnswerRequest,
  SubmitFeedbackRequest,
  type SubmitAnswerResponse,
} from "@ci-train/contracts";

export type SubmitResult =
  | { ok: true; result: SubmitAnswerResponse }
  | { ok: false; error: string };

// Challenge-mode per-question submit. Each click in the workspace
// invokes this; the result tells the client whether to flip the card
// to "completed" + reveal the debrief, or stay open and (optionally)
// show a hint.
export async function submitAnswerAction(
  scenarioSlug: string,
  questionId: string,
  responseJson: unknown,
): Promise<SubmitResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  const parsed = QuestionResponse.safeParse(responseJson);
  if (!parsed.success) {
    return { ok: false, error: "Invalid response shape." };
  }
  const body: SubmitAnswerRequest = { response: parsed.data };

  let result: SubmitAnswerResponse;
  try {
    result = await api.progress.submit(token, scenarioSlug, questionId, body);
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      const ebody = err.body as { message?: string } | undefined;
      return { ok: false, error: ebody?.message ?? err.message };
    }
    if (err instanceof ApiError && err.status === 403) {
      return { ok: false, error: "Not allowed." };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : "Submit failed.",
    };
  }

  // Revalidate the scenario page so server-rendered state (progress
  // counter, completed badges) reflects the change on the next nav.
  revalidatePath(`/scenarios/${scenarioSlug}`);
  return { ok: true, result };
}

// M21g inline review actions. The /admin/review and the
// authoring-editor surfaces already expose review save endpoints;
// these are the same endpoints, but scoped to revalidate the
// solve view so the admin sees their freshly-saved verdict +
// notes reflected without leaving the challenge.

export type InlineReviewResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setInlineScenarioReviewAction(
  slug: string,
  _prev: InlineReviewResult | undefined,
  formData: FormData,
): Promise<InlineReviewResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  const statusRaw = formData.get("status");
  const parsedStatus = ScenarioReviewStatus.safeParse(statusRaw);
  if (!parsedStatus.success) {
    return { ok: false, error: "Invalid review status." };
  }
  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" ? notesRaw : undefined;

  try {
    await api.authoring.setScenarioReview(token, slug, {
      status: parsedStatus.data,
      ...(notes !== undefined ? { notes } : {}),
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, error: "Not authorized." };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : "Save failed.",
    };
  }
  revalidatePath(`/scenarios/${slug}`);
  return { ok: true };
}

// Scenario feedback submission. Triggered by the small widget at
// the bottom of the solve view (one row per click, append-only).
// Resolves to a SubmitResult-shape so the client component can
// render the success / error path uniformly with the other
// actions on this page.
export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitScenarioFeedbackAction(
  scenarioSlug: string,
  _prev: SubmitFeedbackResult | undefined,
  formData: FormData,
): Promise<SubmitFeedbackResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  const bodyRaw = formData.get("body");
  const ratingRaw = formData.get("rating");

  // The textarea is required by the contract; "" / undefined are
  // user errors, not server errors.
  if (typeof bodyRaw !== "string" || bodyRaw.trim().length === 0) {
    return { ok: false, error: "Feedback can't be empty." };
  }

  let rating: number | null = null;
  if (typeof ratingRaw === "string" && ratingRaw !== "") {
    const n = Number.parseInt(ratingRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 5) rating = n;
  }

  const parsed = SubmitFeedbackRequest.safeParse({ body: bodyRaw, rating });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback." };
  }

  try {
    await api.feedback.submit(token, scenarioSlug, parsed.data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      const ebody = err.body as { message?: string } | undefined;
      return { ok: false, error: ebody?.message ?? err.message };
    }
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, error: "Not authorized." };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : "Submit failed.",
    };
  }

  return { ok: true };
}

export async function setInlineQuestionReviewAction(
  slug: string,
  questionId: string,
  _prev: InlineReviewResult | undefined,
  formData: FormData,
): Promise<InlineReviewResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };
  const raw = formData.get("notes");
  const notes = typeof raw === "string" ? raw : "";
  try {
    await api.authoring.setQuestionReview(token, slug, questionId, { notes });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, error: "Not authorized." };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : "Save failed.",
    };
  }
  revalidatePath(`/scenarios/${slug}`);
  return { ok: true };
}
