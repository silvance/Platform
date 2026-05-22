"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  QuestionResponse,
  SubmitAnswerRequest,
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
