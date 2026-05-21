import { Injectable } from "@nestjs/common";
import { z } from "zod";
import type { QuestionType } from "@prisma/client";
import {
  AutoScoreOutcome,
  ConfidenceResponse,
  McResponse,
  SelectIndicatorsResponse,
} from "@ci-train/contracts";

export interface GradingInput {
  type: QuestionType;
  expectedJson: unknown; // raw from the AnswerKey row
  responseJson: unknown; // raw trainee response (or null if untouched)
}

export interface GradingResult {
  // null when the question type is not auto-gradable (short/long answer).
  score: number | null;
  outcome: AutoScoreOutcome;
}

// Local schemas describing the expected_json shape *as stored in the
// AnswerKey row*. Kept out of @ci-train/contracts on purpose — the
// shared contracts package describes the API payloads, not the DB row
// shapes that the API consumes internally.
const ExpectedMc = z.object({
  type: z.literal("multi_choice"),
  correctIds: z.array(z.string()).min(1),
  allowMultiple: z.boolean(),
});
const ExpectedConfidence = z.object({
  type: z.literal("confidence"),
  expectedRange: z.tuple([
    z.number().int().min(1).max(5),
    z.number().int().min(1).max(5),
  ]),
});
const ExpectedSelectIndicators = z.object({
  type: z.literal("select_indicators"),
  correctIds: z.array(z.string()).min(1),
});

@Injectable()
export class GradingService {
  // Returns the trainee's auto-grade for a single question. Never throws
  // on malformed data — falls back to outcome="ungradable" so a single
  // bad row can't break the whole debrief.
  grade(input: GradingInput): GradingResult {
    try {
      switch (input.type) {
        case "multi_choice":
          return this.gradeMultiChoice(input);
        case "confidence":
          return this.gradeConfidence(input);
        case "select_indicators":
          return this.gradeSelectIndicators(input);
        case "short_answer":
        case "long_answer":
          // Narrative answers need instructor review (M7).
          return { score: null, outcome: "ungradable" };
        default:
          return { score: null, outcome: "ungradable" };
      }
    } catch {
      return { score: null, outcome: "ungradable" };
    }
  }

  private gradeMultiChoice(input: GradingInput): GradingResult {
    const expected = ExpectedMc.safeParse(input.expectedJson);
    if (!expected.success) return { score: null, outcome: "ungradable" };
    if (input.responseJson === null || input.responseJson === undefined) {
      return { score: 0, outcome: "incorrect" };
    }
    const response = McResponse.safeParse(
      unwrapData("multi_choice", input.responseJson),
    );
    if (!response.success) return { score: 0, outcome: "incorrect" };

    const correct = new Set(expected.data.correctIds);
    const picked = new Set(response.data.selectedIds);
    const exactMatch =
      correct.size === picked.size &&
      [...correct].every((id) => picked.has(id));
    if (exactMatch) {
      return { score: 1, outcome: "correct" };
    }
    // Partial credit when multi-select and the trainee picked a subset
    // of the correct set with no false positives. Otherwise 0.
    if (expected.data.allowMultiple && picked.size > 0) {
      const allCorrect = [...picked].every((id) => correct.has(id));
      if (allCorrect && picked.size < correct.size) {
        return {
          score: picked.size / correct.size,
          outcome: "partial",
        };
      }
    }
    return { score: 0, outcome: "incorrect" };
  }

  // Same logic as multi_choice but tied to indicator sets. Partial
  // credit always available (indicator selection is implicitly
  // multi-select). False positives → 0/incorrect.
  private gradeSelectIndicators(input: GradingInput): GradingResult {
    const expected = ExpectedSelectIndicators.safeParse(input.expectedJson);
    if (!expected.success) return { score: null, outcome: "ungradable" };
    if (input.responseJson === null || input.responseJson === undefined) {
      return { score: 0, outcome: "incorrect" };
    }
    const response = SelectIndicatorsResponse.safeParse(
      unwrapData("select_indicators", input.responseJson),
    );
    if (!response.success) return { score: 0, outcome: "incorrect" };

    const correct = new Set(expected.data.correctIds);
    const picked = new Set(response.data.selectedIds);
    const exactMatch =
      correct.size === picked.size &&
      [...correct].every((id) => picked.has(id));
    if (exactMatch) {
      return { score: 1, outcome: "correct" };
    }
    if (picked.size > 0) {
      const allCorrect = [...picked].every((id) => correct.has(id));
      if (allCorrect && picked.size < correct.size) {
        return { score: picked.size / correct.size, outcome: "partial" };
      }
    }
    return { score: 0, outcome: "incorrect" };
  }

  private gradeConfidence(input: GradingInput): GradingResult {
    const expected = ExpectedConfidence.safeParse(input.expectedJson);
    if (!expected.success) return { score: null, outcome: "ungradable" };
    if (input.responseJson === null || input.responseJson === undefined) {
      return { score: 0, outcome: "out_of_range" };
    }
    const response = ConfidenceResponse.safeParse(
      unwrapData("confidence", input.responseJson),
    );
    if (!response.success) return { score: 0, outcome: "out_of_range" };

    const [lo, hi] = expected.data.expectedRange;
    const v = response.data.value;
    return v >= lo && v <= hi
      ? { score: 1, outcome: "in_range" }
      : { score: 0, outcome: "out_of_range" };
  }
}

// Trainee responseJson is stored as the discriminated-union shape
// { type, data }. Unwrap before validating the inner payload.
function unwrapData(expectedType: string, raw: unknown): unknown {
  if (
    raw &&
    typeof raw === "object" &&
    "type" in raw &&
    (raw as { type: unknown }).type === expectedType &&
    "data" in raw
  ) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}
