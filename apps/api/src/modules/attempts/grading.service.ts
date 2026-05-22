import { Injectable } from "@nestjs/common";
import { z } from "zod";
import type { QuestionType } from "@prisma/client";
import {
  ConfidenceResponse,
  McResponse,
  SelectIndicatorsResponse,
  TextMatchOptionsSpec,
  TextMatchResponse,
} from "@ci-train/contracts";

export interface GradingInput {
  type: QuestionType;
  // Raw value of question.optionsJson (multi_choice options /
  // text_match parameters). Ignored for other types.
  optionsJson: unknown;
  // Raw value of answer_key.expectedJson.
  expectedJson: unknown;
  // Raw value of the trainee's submitted response (already unwrapped
  // by the caller is fine; the grader is tolerant either way).
  responseJson: unknown;
}

// In challenge-mode there are only two outcomes per submission:
// "correct" → the question completes; or "incorrect" → keep trying.
// Partial credit on MC / select_indicators is preserved as a *score*
// for the UI ("you got 2/3"), but it does not complete the question.
export interface GradingResult {
  correct: boolean;
  // 0.0–1.0. Always set for the four supported question types.
  score: number;
}

// Local schemas for the expected_json shapes stored on answer_keys.
// These mirror the discriminated union exposed by AnswerKeyPayload but
// live alongside the service that consumes them — the API contract
// describes what crosses the wire, these describe what's in the DB.
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
const ExpectedTextMatch = z.object({
  type: z.literal("text_match"),
  acceptableAnswers: z.array(z.string()).min(1),
  regex: z.boolean().default(false),
});

@Injectable()
export class GradingService {
  // Returns {correct, score} for a single submission. Never throws on
  // malformed data — falls back to {correct: false, score: 0} so a
  // single bad row can't poison the question's submission flow.
  grade(input: GradingInput): GradingResult {
    try {
      switch (input.type) {
        case "multi_choice":
          return this.gradeMultiChoice(input);
        case "confidence":
          return this.gradeConfidence(input);
        case "select_indicators":
          return this.gradeSelectIndicators(input);
        case "text_match":
          return this.gradeTextMatch(input);
        // The short_answer / long_answer enum values survive in the DB
        // for back-compat but the API refuses to create such questions;
        // anything that slips through grades as incorrect.
        default:
          return { correct: false, score: 0 };
      }
    } catch {
      return { correct: false, score: 0 };
    }
  }

  private gradeMultiChoice(input: GradingInput): GradingResult {
    const expected = ExpectedMc.safeParse(input.expectedJson);
    if (!expected.success) return { correct: false, score: 0 };
    const response = McResponse.safeParse(unwrapData("multi_choice", input.responseJson));
    if (!response.success) return { correct: false, score: 0 };

    const correct = new Set(expected.data.correctIds);
    const picked = new Set(response.data.selectedIds);
    const exactMatch =
      correct.size === picked.size &&
      [...correct].every((id) => picked.has(id));
    if (exactMatch) return { correct: true, score: 1 };

    // Partial credit (subset with no false positives) is *reported* as
    // a score so the UI can show "you got 2/3" — but it does not
    // complete the question.
    if (expected.data.allowMultiple && picked.size > 0) {
      const allCorrect = [...picked].every((id) => correct.has(id));
      if (allCorrect && picked.size < correct.size) {
        return { correct: false, score: picked.size / correct.size };
      }
    }
    return { correct: false, score: 0 };
  }

  private gradeConfidence(input: GradingInput): GradingResult {
    const expected = ExpectedConfidence.safeParse(input.expectedJson);
    if (!expected.success) return { correct: false, score: 0 };
    const response = ConfidenceResponse.safeParse(unwrapData("confidence", input.responseJson));
    if (!response.success) return { correct: false, score: 0 };

    const [lo, hi] = expected.data.expectedRange;
    const v = response.data.value;
    return v >= lo && v <= hi
      ? { correct: true, score: 1 }
      : { correct: false, score: 0 };
  }

  private gradeSelectIndicators(input: GradingInput): GradingResult {
    const expected = ExpectedSelectIndicators.safeParse(input.expectedJson);
    if (!expected.success) return { correct: false, score: 0 };
    const response = SelectIndicatorsResponse.safeParse(
      unwrapData("select_indicators", input.responseJson),
    );
    if (!response.success) return { correct: false, score: 0 };

    const correct = new Set(expected.data.correctIds);
    const picked = new Set(response.data.selectedIds);
    const exactMatch =
      correct.size === picked.size &&
      [...correct].every((id) => picked.has(id));
    if (exactMatch) return { correct: true, score: 1 };

    if (picked.size > 0) {
      const allCorrect = [...picked].every((id) => correct.has(id));
      if (allCorrect && picked.size < correct.size) {
        return { correct: false, score: picked.size / correct.size };
      }
    }
    return { correct: false, score: 0 };
  }

  private gradeTextMatch(input: GradingInput): GradingResult {
    const expected = ExpectedTextMatch.safeParse(input.expectedJson);
    if (!expected.success) return { correct: false, score: 0 };
    const opts = TextMatchOptionsSpec.safeParse(input.optionsJson);
    if (!opts.success) return { correct: false, score: 0 };
    const response = TextMatchResponse.safeParse(
      unwrapData("text_match", input.responseJson),
    );
    if (!response.success) return { correct: false, score: 0 };

    const submitted = normalizeText(response.data.text, opts.data);

    if (expected.data.regex) {
      // Each acceptable answer is treated as a regex. We compile here
      // (not at module load) because acceptable answers come from
      // authored content and we want fresh regexes per call. Flags:
      //   case-insensitive when !caseSensitive
      //   no `g` — we use .test() which is stateless.
      const flags = opts.data.caseSensitive ? "" : "i";
      for (const pattern of expected.data.acceptableAnswers) {
        try {
          const re = new RegExp(pattern, flags);
          if (re.test(submitted)) return { correct: true, score: 1 };
        } catch {
          // Malformed regex authored in the answer key. Treat as a
          // grading miss; the author is responsible for valid regex.
          continue;
        }
      }
      return { correct: false, score: 0 };
    }

    // Literal match. Normalize the acceptable answers the same way we
    // normalized the submission so trim/case/whitespace flags act
    // symmetrically.
    for (const accept of expected.data.acceptableAnswers) {
      if (normalizeText(accept, opts.data) === submitted) {
        return { correct: true, score: 1 };
      }
    }
    return { correct: false, score: 0 };
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

function normalizeText(
  s: string,
  opts: { caseSensitive: boolean; normalizeWhitespace: boolean },
): string {
  let out = s.trim();
  if (opts.normalizeWhitespace) out = out.replace(/\s+/g, " ");
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}
