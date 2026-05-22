"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import { QuestionResponse, SaveAnswerRequest } from "@ci-train/contracts";

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  responseJson: unknown,
): Promise<SaveResult> {
  const token = await readToken();
  if (!token) return { ok: false, error: "Not signed in." };

  const parsed = QuestionResponse.safeParse(responseJson);
  if (!parsed.success) {
    return { ok: false, error: "Invalid response shape." };
  }
  const body: SaveAnswerRequest = { response: parsed.data };

  try {
    await api.attempts.saveAnswer(token, attemptId, questionId, body);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { ok: false, error: "Attempt is locked." };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : "Save failed.",
    };
  }

  revalidatePath(`/attempts/${attemptId}`);
  return { ok: true };
}

export async function submitAttemptAction(attemptId: string): Promise<void> {
  const token = await readToken();
  if (!token) redirect("/login");
  await api.attempts.submit(token, attemptId);
  redirect(`/attempts/${attemptId}/debrief`);
}

export async function startAttemptAction(slug: string): Promise<void> {
  const token = await readToken();
  if (!token) redirect("/login");
  const attempt = await api.attempts.start(token, slug);
  redirect(`/attempts/${attempt.id}`);
}
