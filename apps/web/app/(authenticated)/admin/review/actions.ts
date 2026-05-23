"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { readToken } from "@/lib/session";
import {
  ScenarioReviewStatus,
  SetScenarioReviewRequest,
} from "@ci-train/contracts";

export interface ReviewActionState {
  error: string | null;
  ok: string | null;
}

const initialOk = (msg: string): ReviewActionState => ({ error: null, ok: msg });
const initialErr = (msg: string): ReviewActionState => ({ error: msg, ok: null });

function describeError(err: unknown, fallback: string): ReviewActionState {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return initialErr("Not authorized.");
    }
    if (err.status === 404) {
      return initialErr("Scenario not found.");
    }
    if (err.status === 400) {
      const body = err.body as { message?: unknown } | null;
      if (body && typeof body.message === "string") {
        return initialErr(body.message);
      }
    }
  }
  return initialErr(fallback);
}

// Set the scenario-level review verdict + notes in a single submit.
// The form posts both fields; we re-validate on the BFF so a bad
// status enum doesn't reach the API as a 400.
export async function setScenarioReviewAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const token = await readToken();
  if (!token) return initialErr("Session expired. Reload and sign in again.");

  const slug = formData.get("slug");
  if (typeof slug !== "string" || slug.length === 0) {
    return initialErr("Missing slug.");
  }

  const parsedStatus = ScenarioReviewStatus.safeParse(formData.get("status"));
  if (!parsedStatus.success) {
    return initialErr("Invalid review status.");
  }

  // Notes is optional. Empty string is intentional (clears the
  // notes); null means "leave existing notes alone."
  const rawNotes = formData.get("notes");
  const body: SetScenarioReviewRequest =
    typeof rawNotes === "string"
      ? { status: parsedStatus.data, notes: rawNotes }
      : { status: parsedStatus.data };

  try {
    await api.authoring.setScenarioReview(token, slug, body);
  } catch (err) {
    return describeError(err, "Failed to save review.");
  }

  revalidatePath("/admin/review");
  return initialOk("Saved.");
}
