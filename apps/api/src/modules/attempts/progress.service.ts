import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import { z } from "zod";
import {
  AnswerKeyPayload,
  IndicatorItem,
  McOptionsSpec,
  MeProgressResponse,
  MeProgressRow,
  QuestionPayload,
  QuestionResponse,
  QuestionStatePayload,
  ScenarioProgressPayload,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  TextMatchOptionsSpec,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import { GradingService } from "./grading.service";

// Local schema for AnswerKey.expectedJson — same as in GradingService
// but exposed via toAnswerKey() so we can render the contract payload
// on completion.
const ExpectedAny = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("multi_choice"),
    correctIds: z.array(z.string()).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    type: z.literal("confidence"),
    expectedRange: z.tuple([
      z.number().int().min(1).max(5),
      z.number().int().min(1).max(5),
    ]),
  }),
  z.object({
    type: z.literal("select_indicators"),
    correctIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("text_match"),
    acceptableAnswers: z.array(z.string()).min(1),
    regex: z.boolean().default(false),
  }),
]);

// Pessimistic-lock row shape returned by SELECT ... FOR UPDATE on
// scenario_progress.
interface LockedProgressRow {
  id: string;
  scenario_id: string;
  user_id: string;
  completed_at: Date | null;
  completed_questions: number;
  total_questions: number;
}

// Supported question types in M7 challenge mode. The Postgres enum
// still carries the deprecated short_answer / long_answer values but
// the API + view layer hide them; completion counting filters on this
// set too so a stale row of a hidden type can't block scenario
// completion.
const SUPPORTED_QUESTION_TYPES = [
  "multi_choice",
  "confidence",
  "select_indicators",
  "text_match",
] as const;

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
  ) {}

  // GET /v1/scenarios/:slug/progress
  //
  // Returns the caller's progress on this scenario. Does NOT create a
  // progress row — submit-first is when the row is born. The same
  // surface serves everyone (challenge-lab model, not LMS); the only
  // role check is the draft-leak gate on unpublished scenarios.
  async getProgress(
    role: Role,
    actorUserId: string,
    slug: string,
  ): Promise<ScenarioProgressPayload> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { slug },
      include: {
        questions: {
          orderBy: { ordinal: "asc" },
          include: { indicatorSet: true, answerKey: true },
        },
      },
    });
    if (!scenario) throw new NotFoundException("Scenario not found.");
    // Draft scenarios stay invisible to non-admin roles — admins can
    // preview their own drafts via the authoring surface; users only
    // see published content.
    if (role !== "admin" && scenario.status !== "published") {
      throw new NotFoundException("Scenario not found.");
    }

    // Cast the filtered list to QuestionRow[]. The runtime predicate
    // guarantees `type` is one of the contract values; TS can't narrow
    // through Prisma's generated union, so the cast is honest.
    const visibleQuestions = scenario.questions
      .filter(isContractType)
      .map((q) => q as unknown as QuestionRow);
    const questionPayloads = visibleQuestions.map(toQuestionPayload);

    const progress = await this.prisma.scenarioProgress.findUnique({
      where: {
        scenarioId_userId: {
          scenarioId: scenario.id,
          userId: actorUserId,
        },
      },
      include: {
        responses: {
          include: { question: { include: { answerKey: true } } },
        },
      },
    });

    const responses: QuestionStatePayload[] = visibleQuestions.map((q) => {
      const r = progress?.responses.find((x) => x.questionId === q.id);
      const completed = r?.completedAt ?? null;
      return {
        questionId: q.id,
        attemptCount: r?.attemptCount ?? 0,
        completedAt: completed ? completed.toISOString() : null,
        lastResponse: r?.responseJson
          ? (QuestionResponse.safeParse(r.responseJson).data ?? null)
          : null,
        // Answer key revealed only after the trainee has completed it.
        answerKey: completed
          ? toAnswerKey(q.type, q.answerKey ?? null, q.optionsJson)
          : null,
      };
    });

    return ScenarioProgressPayload.parse({
      scenarioSlug: scenario.slug,
      scenarioTitle: scenario.title,
      startedAt: progress?.startedAt ? progress.startedAt.toISOString() : null,
      completedAt: progress?.completedAt
        ? progress.completedAt.toISOString()
        : null,
      completedQuestions: progress?.completedQuestions ?? 0,
      totalQuestions: visibleQuestions.length,
      questions: questionPayloads,
      responses,
    });
  }

  // GET /v1/me/progress
  //
  // The signed-in user's per-scenario summary. One row per scenario
  // they've touched; admins see their own rows too (no role gate
  // beyond auth). Draft/archived scenarios are returned for whoever
  // has progress against them — the user already has a row, so
  // listing it just reflects state they put there.
  async listMyProgress(actorUserId: string): Promise<MeProgressResponse> {
    const rows = await this.prisma.scenarioProgress.findMany({
      where: { userId: actorUserId },
      include: {
        scenario: {
          select: { id: true, slug: true, title: true, status: true },
        },
      },
      orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { startedAt: "desc" }],
    });

    const items: MeProgressRow[] = rows.map((r) => ({
      scenarioId: r.scenario.id,
      scenarioSlug: r.scenario.slug,
      scenarioTitle: r.scenario.title,
      scenarioStatus: r.scenario.status as never,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      completedQuestions: r.completedQuestions,
      totalQuestions: r.totalQuestions,
    }));

    return MeProgressResponse.parse({
      rows: items,
      totals: {
        scenariosTouched: items.length,
        scenariosCompleted: items.filter((i) => i.completedAt !== null).length,
      },
    });
  }

  // POST /v1/scenarios/:slug/questions/:questionId/submit
  //
  // Submit a single answer. Idempotent on already-correct: re-submits
  // do not re-grade, do not bump attemptCount, just echo the completed
  // state.
  //
  // Concurrency: ScenarioProgress row is SELECT ... FOR UPDATE'd so
  // concurrent submits to different questions in the same scenario are
  // serialized. The cohort-progress endpoint reads without a lock.
  async submit(
    role: Role,
    actorUserId: string,
    slug: string,
    questionId: string,
    body: SubmitAnswerRequest,
  ): Promise<SubmitAnswerResponse> {
    // Anyone signed in may solve. The role variable stays for future
    // admin-content-management surfaces but does not gate solving.
    void role;

    return this.prisma.$transaction(async (tx) => {
      // Look up the scenario + question.
      const scenario = await tx.scenario.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });
      if (!scenario) throw new NotFoundException("Scenario not found.");
      // Drafts are admin-only on the read side (see getProgress);
      // mirror that gate on the SUBMIT side so admins can solve the
      // drafts they're previewing. Without this branch the
      // /admin/challenges → Solve → submit-answer path would 404
      // for every Tier-2 draft.
      if (role !== "admin" && scenario.status !== "published") {
        throw new NotFoundException("Scenario not found.");
      }

      const question = await tx.question.findFirst({
        where: { id: questionId, scenarioId: scenario.id },
        include: {
          answerKey: true,
          indicatorSet: { select: { itemsJson: true } },
        },
      });
      if (!question) throw new NotFoundException("Question not found.");
      if (!isContractType(question)) {
        throw new BadRequestException(
          "Question type is not supported in challenge mode.",
        );
      }
      if (body.response.type !== question.type) {
        throw new ConflictException(
          `Response type ${body.response.type} does not match question type ${question.type}.`,
        );
      }

      // Defensive: validate the response shape against the question's
      // option set (MC + select_indicators). Same as M5/M6 saveAnswer
      // — keeps bogus IDs out of the DB.
      if (body.response.type === "multi_choice") {
        const spec = McOptionsSpec.safeParse(question.optionsJson);
        if (!spec.success) {
          throw new ConflictException("Question is misconfigured (invalid options).");
        }
        const validIds = new Set(spec.data.options.map((o) => o.id));
        const unknown = body.response.data.selectedIds.filter(
          (id) => !validIds.has(id),
        );
        if (unknown.length > 0) {
          throw new BadRequestException({
            message: "Unknown option id(s) for this question.",
            unknown,
          });
        }
        if (!spec.data.allowMultiple && body.response.data.selectedIds.length > 1) {
          throw new BadRequestException(
            "This question allows at most one selection.",
          );
        }
      }
      if (body.response.type === "select_indicators") {
        if (!question.indicatorSet) {
          throw new ConflictException(
            "Question is misconfigured (missing indicator set).",
          );
        }
        const items = z.array(IndicatorItem).safeParse(
          (question.indicatorSet.itemsJson as { items?: unknown })?.items ??
            question.indicatorSet.itemsJson,
        );
        if (!items.success) {
          throw new ConflictException(
            "Indicator set is misconfigured (invalid items).",
          );
        }
        const validIds = new Set(items.data.map((i) => i.id));
        const unknown = body.response.data.selectedIds.filter(
          (id) => !validIds.has(id),
        );
        if (unknown.length > 0) {
          throw new BadRequestException({
            message: "Unknown indicator id(s) for this question.",
            unknown,
          });
        }
      }

      // Find or create the scenario_progress row for this user.
      // totalQuestions counts ONLY contract-supported types so a
      // stale short_answer / long_answer row (hidden from the client
      // by the filter in getProgress() / toQuestionPayload) can never
      // hold the scenario's completedAt back forever.
      const totalQuestions = await tx.question.count({
        where: {
          scenarioId: scenario.id,
          type: { in: [...SUPPORTED_QUESTION_TYPES] },
        },
      });

      const progressUpsert = await tx.scenarioProgress.upsert({
        where: {
          scenarioId_userId: {
            scenarioId: scenario.id,
            userId: actorUserId,
          },
        },
        update: {},
        create: {
          scenarioId: scenario.id,
          userId: actorUserId,
          totalQuestions,
        },
      });

      // SELECT ... FOR UPDATE on the now-existing row so concurrent
      // submits to other questions on this scenario serialize.
      const rows = await tx.$queryRaw<LockedProgressRow[]>`
        SELECT id, scenario_id, user_id, completed_at, completed_questions, total_questions
        FROM "scenario_progress"
        WHERE id = ${progressUpsert.id}::uuid
        FOR UPDATE
      `;
      const progress = rows[0];
      if (!progress) {
        // Cannot happen — we just upserted. Defensive.
        throw new NotFoundException("Progress row vanished.");
      }

      // Find or create the question_response row.
      const existing = await tx.questionResponse.findUnique({
        where: {
          progressId_questionId: {
            progressId: progress.id,
            questionId: question.id,
          },
        },
      });

      // Idempotent on already-correct.
      if (existing?.completedAt) {
        return SubmitAnswerResponse.parse({
          correct: true,
          completedJustNow: false,
          attemptCount: existing.attemptCount,
          answerKey: toAnswerKey(question.type, question.answerKey, question.optionsJson),
          hint: null,
        });
      }

      const result = this.grading.grade({
        type: question.type,
        optionsJson: question.optionsJson,
        expectedJson: question.answerKey?.expectedJson ?? null,
        responseJson: body.response,
      });

      const nextAttemptCount = (existing?.attemptCount ?? 0) + 1;
      const completedAt = result.correct ? new Date() : null;

      await tx.questionResponse.upsert({
        where: {
          progressId_questionId: {
            progressId: progress.id,
            questionId: question.id,
          },
        },
        update: {
          responseJson: body.response as unknown as Prisma.InputJsonValue,
          attemptCount: nextAttemptCount,
          completedAt: completedAt ?? undefined,
        },
        create: {
          progressId: progress.id,
          questionId: question.id,
          responseJson: body.response as unknown as Prisma.InputJsonValue,
          attemptCount: nextAttemptCount,
          completedAt: completedAt ?? undefined,
        },
      });

      // Recompute scenario_progress counters when the question just
      // completed.
      if (result.correct) {
        const newCompletedCount = await tx.questionResponse.count({
          where: { progressId: progress.id, completedAt: { not: null } },
        });
        const scenarioCompletedAt =
          newCompletedCount >= totalQuestions ? new Date() : null;
        await tx.scenarioProgress.update({
          where: { id: progress.id },
          data: {
            completedQuestions: newCompletedCount,
            totalQuestions,
            completedAt: scenarioCompletedAt,
          },
        });
      }

      // Optional hint (text_match only in M7).
      const hint = result.correct ? null : extractHint(
        question.type,
        question.optionsJson,
        nextAttemptCount,
      );

      return SubmitAnswerResponse.parse({
        correct: result.correct,
        completedJustNow: result.correct,
        attemptCount: nextAttemptCount,
        answerKey: result.correct
          ? toAnswerKey(question.type, question.answerKey, question.optionsJson)
          : null,
        hint,
      });
    });
  }

}

// Question rows whose type is in the contract enum (i.e. not the
// deprecated short_answer / long_answer values that remain in the DB
// enum). We filter them out everywhere so they're invisible to clients.
function isContractType(q: { type: string }): q is { type: "multi_choice" | "confidence" | "select_indicators" | "text_match" } & typeof q {
  return (
    q.type === "multi_choice" ||
    q.type === "confidence" ||
    q.type === "select_indicators" ||
    q.type === "text_match"
  );
}

type QuestionRow = {
  id: string;
  ordinal: number;
  type: "multi_choice" | "confidence" | "select_indicators" | "text_match";
  promptMd: string;
  weight: number;
  optionsJson: unknown;
  indicatorSet?: {
    id: string;
    slug: string;
    displayName: string;
    sourceArtifactId: string | null;
    itemsJson: unknown;
  } | null;
  // Present whenever the caller `include`d the answerKey relation. The
  // progress endpoint needs it to compose the AnswerKeyPayload on
  // completion; the submit endpoint fetches its own copy in-tx.
  answerKey?: {
    expectedJson: unknown;
    debriefMd: string;
  } | null;
};

function toQuestionPayload(q: QuestionRow): QuestionPayload {
  let options: QuestionPayload["options"] = null;
  let allowMultiple: QuestionPayload["allowMultiple"] = null;
  let textMatch: QuestionPayload["textMatch"] = null;
  let indicatorSet: QuestionPayload["indicatorSet"] = null;

  if (q.type === "multi_choice") {
    const parsed = McOptionsSpec.safeParse(q.optionsJson);
    if (parsed.success) {
      options = parsed.data.options;
      allowMultiple = parsed.data.allowMultiple;
    } else {
      options = [];
      allowMultiple = false;
    }
  } else if (q.type === "text_match") {
    const parsed = TextMatchOptionsSpec.safeParse(q.optionsJson);
    if (parsed.success) {
      textMatch = {
        caseSensitive: parsed.data.caseSensitive,
        normalizeWhitespace: parsed.data.normalizeWhitespace,
        regex: parsed.data.regex,
        // Don't leak the acceptable-answer cap as a hint — pull the
        // shared char cap from the contract instead.
        maxLength: 500,
      };
    } else {
      textMatch = {
        caseSensitive: false,
        normalizeWhitespace: true,
        regex: false,
        maxLength: 500,
      };
    }
  } else if (q.type === "select_indicators" && q.indicatorSet) {
    const rawItems =
      (q.indicatorSet.itemsJson as { items?: unknown })?.items ??
      q.indicatorSet.itemsJson;
    const parsed = z.array(IndicatorItem).safeParse(rawItems);
    indicatorSet = {
      id: q.indicatorSet.id,
      slug: q.indicatorSet.slug,
      displayName: q.indicatorSet.displayName,
      sourceArtifactId: q.indicatorSet.sourceArtifactId,
      items: parsed.success ? parsed.data : [],
    };
  }

  return {
    id: q.id,
    ordinal: q.ordinal,
    type: q.type,
    promptMd: q.promptMd,
    weight: q.weight,
    options,
    allowMultiple,
    indicatorSet,
    textMatch,
  };
}

function toAnswerKey(
  questionType: QuestionRow["type"],
  answerKey: { expectedJson: unknown; debriefMd: string } | null,
  optionsJson: unknown,
): AnswerKeyPayload {
  if (!answerKey) {
    return placeholderAnswerKey(questionType);
  }
  const parsed = ExpectedAny.safeParse(answerKey.expectedJson);
  if (!parsed.success || parsed.data.type !== questionType) {
    return {
      expected: placeholderExpected(questionType),
      debriefMd:
        "_The authored answer key for this question is malformed; the rubric below may not apply._\n\n" +
        answerKey.debriefMd,
    };
  }
  // For text_match, swap in the configured `regex` flag from the
  // options spec so the answer key payload's `regex` agrees with how
  // the grader is actually behaving (the expectedJson's `regex` is
  // authoritative either way, but consistency matters).
  if (parsed.data.type === "text_match") {
    const opts = TextMatchOptionsSpec.safeParse(optionsJson);
    return {
      expected: {
        type: "text_match",
        acceptableAnswers: parsed.data.acceptableAnswers,
        regex: opts.success ? opts.data.regex : parsed.data.regex,
      },
      debriefMd: answerKey.debriefMd,
    };
  }
  return {
    expected: parsed.data,
    debriefMd: answerKey.debriefMd,
  };
}

function placeholderAnswerKey(type: QuestionRow["type"]): AnswerKeyPayload {
  return {
    expected: placeholderExpected(type),
    debriefMd: "_No debrief authored for this question._",
  };
}

function placeholderExpected(
  type: QuestionRow["type"],
): AnswerKeyPayload["expected"] {
  switch (type) {
    case "multi_choice":
      return { type: "multi_choice", correctIds: [], allowMultiple: false };
    case "confidence":
      return { type: "confidence", expectedRange: [3, 3] };
    case "select_indicators":
      return { type: "select_indicators", correctIds: [] };
    case "text_match":
      return { type: "text_match", acceptableAnswers: [], regex: false };
  }
}

function extractHint(
  questionType: string,
  optionsJson: unknown,
  attemptCount: number,
): string | null {
  if (questionType !== "text_match") return null;
  const opts = TextMatchOptionsSpec.safeParse(optionsJson);
  if (!opts.success) return null;
  const hint = opts.data.hint;
  if (!hint) return null;
  return attemptCount >= opts.data.hintAfterTries ? hint : null;
}
