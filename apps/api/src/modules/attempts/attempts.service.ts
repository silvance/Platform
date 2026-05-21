import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  AttemptPayload,
  AttemptAnswerPayload,
  AnswerKeyPayload,
  DebriefAnswerPayload,
  DebriefPayload,
  McOptionsSpec,
  QuestionPayload,
  QuestionResponse,
  SaveAnswerRequest,
  AutoScoreOutcome,
} from "@ci-train/contracts";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service";
import { GradingService } from "./grading.service";

// Local schemas for the expected_json shapes stored on answer_keys.
// These mirror the discriminated union exposed by AnswerKeyPayload but
// live alongside the service that consumes them — the API contract
// describes what crosses the wire, these describe what's in the DB.
const ExpectedMc = z.object({
  type: z.literal("multi_choice"),
  correctIds: z.array(z.string()).min(1),
  allowMultiple: z.boolean(),
});
const ExpectedShortAnswer = z.object({
  type: z.literal("short_answer"),
  rubricNote: z.string().nullable(),
});
const ExpectedLongAnswer = z.object({
  type: z.literal("long_answer"),
  rubricNote: z.string().nullable(),
});
const ExpectedConfidence = z.object({
  type: z.literal("confidence"),
  expectedRange: z.tuple([
    z.number().int().min(1).max(5),
    z.number().int().min(1).max(5),
  ]),
});
const ExpectedAny = z.discriminatedUnion("type", [
  ExpectedMc,
  ExpectedShortAnswer,
  ExpectedLongAnswer,
  ExpectedConfidence,
]);

// Pessimistic-lock row shape returned by SELECT ... FOR UPDATE.
interface LockedAttemptRow {
  id: string;
  scenario_id: string;
  trainee_user_id: string;
  locked: boolean;
  submitted_at: Date | null;
  max_score: number;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
  ) {}

  // POST /v1/scenarios/:slug/attempts
  async startOrGet(
    role: Role,
    traineeUserId: string,
    slug: string,
  ): Promise<AttemptPayload> {
    if (role !== "trainee") {
      throw new ForbiddenException("Only trainees may start attempts.");
    }
    const scenario = await this.prisma.scenario.findUnique({
      where: { slug },
      include: { questions: { orderBy: { ordinal: "asc" } } },
    });
    if (!scenario) throw new NotFoundException("Scenario not found.");
    if (scenario.status !== "published") {
      throw new NotFoundException("Scenario not found.");
    }

    const maxScore = scenario.questions.reduce((acc, q) => acc + q.weight, 0);
    if (maxScore === 0) {
      throw new ConflictException(
        "This scenario has no questions yet — nothing to attempt.",
      );
    }

    const attempt = await this.prisma.attempt.upsert({
      where: {
        scenarioId_traineeUserId: {
          scenarioId: scenario.id,
          traineeUserId,
        },
      },
      update: {},
      create: {
        scenarioId: scenario.id,
        traineeUserId,
        maxScore,
      },
      include: { answers: true },
    });

    return this.composeAttemptPayload(attempt, scenario);
  }

  // GET /v1/attempts/:id
  async get(
    role: Role,
    actorUserId: string,
    attemptId: string,
  ): Promise<AttemptPayload> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        scenario: {
          include: { questions: { orderBy: { ordinal: "asc" } } },
        },
      },
    });
    if (!attempt) throw new NotFoundException("Attempt not found.");

    this.assertCanRead(role, actorUserId, attempt.traineeUserId);

    return this.composeAttemptPayload(attempt, attempt.scenario);
  }

  // PATCH /v1/attempts/:id/answers/:questionId
  //
  // Race-safety: we open a transaction and SELECT FOR UPDATE on the
  // attempt row. Submit holds the same lock for its full grading run,
  // so an autosave that arrives during submit either runs first
  // (submit waits and re-reads the latest answers) or runs after
  // submit (and sees locked=true and 409s). There is no window in
  // which an autosave can write a new responseJson into a row that
  // submit has already graded.
  async saveAnswer(
    role: Role,
    actorUserId: string,
    attemptId: string,
    questionId: string,
    body: SaveAnswerRequest,
  ): Promise<AttemptAnswerPayload> {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await this.lockAttempt(tx, attemptId);
      if (!attempt) throw new NotFoundException("Attempt not found.");
      if (role !== "trainee" || actorUserId !== attempt.trainee_user_id) {
        throw new ForbiddenException("Cannot write to another user's attempt.");
      }
      if (attempt.locked) {
        throw new ConflictException("Attempt is locked; submit is final.");
      }

      // Single query: question must exist AND belong to the attempt's
      // scenario. Collapses the previous two-query check into one.
      const question = await tx.question.findFirst({
        where: { id: questionId, scenarioId: attempt.scenario_id },
        select: { id: true, type: true, optionsJson: true },
      });
      if (!question) throw new NotFoundException("Question not found.");

      // Response type must match the question's declared type.
      if (body.response.type !== question.type) {
        throw new ConflictException(
          `Response type ${body.response.type} does not match question type ${question.type}.`,
        );
      }

      // For multi_choice, every selectedId must be in the question's
      // option set. If allowMultiple is false, at most one selection.
      // Bad data (unknown ids, too many selections) is rejected before
      // it ever lands in the DB.
      if (body.response.type === "multi_choice") {
        const spec = McOptionsSpec.safeParse(question.optionsJson);
        if (!spec.success) {
          throw new ConflictException("Question is misconfigured (invalid options).");
        }
        const validIds = new Set(spec.data.options.map((o) => o.id));
        const picked = body.response.data.selectedIds;
        const unknown = picked.filter((id) => !validIds.has(id));
        if (unknown.length > 0) {
          throw new BadRequestException({
            message: "Unknown option id(s) for this question.",
            unknown,
          });
        }
        if (!spec.data.allowMultiple && picked.length > 1) {
          throw new BadRequestException(
            "This question allows at most one selection.",
          );
        }
      }

      const saved = await tx.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: attempt.id,
            questionId: question.id,
          },
        },
        update: { responseJson: body.response as unknown as Prisma.InputJsonValue },
        create: {
          attemptId: attempt.id,
          questionId: question.id,
          responseJson: body.response as unknown as Prisma.InputJsonValue,
        },
      });

      return this.composeAnswerPayload(saved);
    });
  }

  // POST /v1/attempts/:id/submit — idempotent; grades + locks atomically.
  async submit(
    role: Role,
    actorUserId: string,
    attemptId: string,
  ): Promise<AttemptPayload> {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await this.lockAttempt(tx, attemptId);
      if (!attempt) throw new NotFoundException("Attempt not found.");
      if (role !== "trainee" || actorUserId !== attempt.trainee_user_id) {
        throw new ForbiddenException("Cannot submit another user's attempt.");
      }

      // Idempotent re-submit — locked rows return current state without
      // re-grading.
      if (attempt.locked) {
        const cur = await tx.attempt.findUniqueOrThrow({
          where: { id: attempt.id },
          include: {
            scenario: { include: { questions: { orderBy: { ordinal: "asc" } } } },
            answers: true,
          },
        });
        return this.composeAttemptPayload(cur, cur.scenario);
      }

      // Read every question + key + the trainee's latest answers under
      // the same FOR UPDATE lock so no autosave can race in between.
      const questions = await tx.question.findMany({
        where: { scenarioId: attempt.scenario_id },
        include: { answerKey: true },
        orderBy: { ordinal: "asc" },
      });
      const answers = await tx.attemptAnswer.findMany({
        where: { attemptId: attempt.id },
      });
      const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

      let total = 0;
      for (const q of questions) {
        const ans = answersByQuestion.get(q.id);
        const result = this.grading.grade({
          type: q.type,
          expectedJson: q.answerKey?.expectedJson ?? null,
          responseJson: ans?.responseJson ?? null,
        });
        if (result.score !== null) {
          total += result.score * q.weight;
        }
        await tx.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: q.id } },
          update: { autoScore: result.score, autoOutcome: result.outcome },
          create: {
            attemptId: attempt.id,
            questionId: q.id,
            responseJson: Prisma.JsonNull,
            autoScore: result.score,
            autoOutcome: result.outcome,
          },
        });
      }

      const submittedAt = new Date();
      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          locked: true,
          submittedAt,
          totalScore: total,
        },
      });

      const refreshed = await tx.attempt.findUniqueOrThrow({
        where: { id: attempt.id },
        include: {
          scenario: { include: { questions: { orderBy: { ordinal: "asc" } } } },
          answers: true,
        },
      });
      return this.composeAttemptPayload(refreshed, refreshed.scenario);
    });
  }

  // GET /v1/attempts/:id/debrief — only available once submitted.
  async getDebrief(
    role: Role,
    actorUserId: string,
    attemptId: string,
  ): Promise<DebriefPayload> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        scenario: {
          include: {
            questions: {
              include: { answerKey: true },
              orderBy: { ordinal: "asc" },
            },
          },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException("Attempt not found.");
    this.assertCanRead(role, actorUserId, attempt.traineeUserId);
    if (!attempt.locked || !attempt.submittedAt) {
      throw new ConflictException(
        "Attempt has not been submitted yet — debrief is not available.",
      );
    }

    const answersByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const debriefAnswers: DebriefAnswerPayload[] = attempt.scenario.questions.map(
      (q) => {
        const a = answersByQ.get(q.id);
        const question = toQuestionPayload(q);
        const answerKey = toAnswerKeyPayload(q);
        const responseParsed = a?.responseJson
          ? QuestionResponse.safeParse(a.responseJson)
          : null;
        return {
          questionId: q.id,
          response: responseParsed?.success ? responseParsed.data : null,
          autoScore: a?.autoScore ?? null,
          autoOutcome: (a?.autoOutcome ?? null) as AutoScoreOutcome | null,
          manualScore: a?.manualScore ?? null,
          instructorNotesMd: a?.instructorNotesMd ?? null,
          question,
          answerKey,
        };
      },
    );

    // Final validation so any drift between Prisma row shapes and the
    // shared contract surfaces here as a 500 rather than as
    // silently-wrong client renders.
    return DebriefPayload.parse({
      attemptId: attempt.id,
      scenarioSlug: attempt.scenario.slug,
      scenarioTitle: attempt.scenario.title,
      submittedAt: attempt.submittedAt.toISOString(),
      totalScore: attempt.totalScore ?? 0,
      maxScore: attempt.maxScore,
      answers: debriefAnswers,
    });
  }

  // ─── helpers ────────────────────────────────────────────────────

  // SELECT ... FOR UPDATE on the attempts row inside the given
  // transaction. Returns null when the row doesn't exist (handled by
  // callers as 404).
  private async lockAttempt(
    tx: Prisma.TransactionClient,
    attemptId: string,
  ): Promise<LockedAttemptRow | null> {
    const rows = await tx.$queryRaw<LockedAttemptRow[]>`
      SELECT id, scenario_id, trainee_user_id, locked, submitted_at, max_score
      FROM "attempts"
      WHERE id = ${attemptId}::uuid
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private assertCanRead(role: Role, actorUserId: string, traineeUserId: string) {
    if (role === "instructor") return;
    if (actorUserId === traineeUserId) return;
    throw new ForbiddenException("Cannot read another user's attempt.");
  }

  private composeAttemptPayload(
    attempt: {
      id: string;
      startedAt: Date;
      submittedAt: Date | null;
      locked: boolean;
      totalScore: number | null;
      maxScore: number;
      answers: Array<{
        questionId: string;
        responseJson: unknown;
        autoScore: number | null;
        autoOutcome: AutoScoreOutcome | null;
        manualScore: number | null;
        instructorNotesMd: string | null;
      }>;
    },
    scenario: {
      slug: string;
      title: string;
      questions: Array<Parameters<typeof toQuestionPayload>[0]>;
    },
  ): AttemptPayload {
    const questions = scenario.questions.map(toQuestionPayload);
    const answers: AttemptAnswerPayload[] = attempt.answers.map((a) =>
      this.composeAnswerPayload(a),
    );
    return AttemptPayload.parse({
      id: attempt.id,
      scenarioSlug: scenario.slug,
      scenarioTitle: scenario.title,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
      status: attempt.locked ? "submitted" : "in_progress",
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      questions,
      answers,
    });
  }

  private composeAnswerPayload(a: {
    questionId: string;
    responseJson: unknown;
    autoScore: number | null;
    autoOutcome: AutoScoreOutcome | null;
    manualScore: number | null;
    instructorNotesMd: string | null;
  }): AttemptAnswerPayload {
    const parsed = a.responseJson
      ? QuestionResponse.safeParse(a.responseJson)
      : null;
    return {
      questionId: a.questionId,
      response: parsed?.success ? parsed.data : null,
      autoScore: a.autoScore,
      autoOutcome: a.autoOutcome,
      manualScore: a.manualScore,
      instructorNotesMd: a.instructorNotesMd,
    };
  }
}

// Shape returned by Prisma includes for a Question row with optional
// optionsJson and an optional answerKey relation.
type QuestionRow = {
  id: string;
  ordinal: number;
  type: "multi_choice" | "short_answer" | "long_answer" | "confidence";
  promptMd: string;
  weight: number;
  optionsJson: unknown;
  answerKey?: {
    expectedJson: unknown;
    debriefMd: string;
  } | null;
};

// Validates optionsJson via McOptionsSpec rather than casting. If the
// JSON is malformed, degrade gracefully: emit no options + allowMultiple=
// false. The trainee won't have anything to pick (and the misconfigured
// question becomes a no-op), but the API surface stays valid.
function toQuestionPayload(q: QuestionRow): QuestionPayload {
  let options: QuestionPayload["options"] = null;
  let allowMultiple: QuestionPayload["allowMultiple"] = null;
  if (q.type === "multi_choice") {
    const parsed = McOptionsSpec.safeParse(q.optionsJson);
    if (parsed.success) {
      options = parsed.data.options;
      allowMultiple = parsed.data.allowMultiple;
    } else {
      options = [];
      allowMultiple = false;
    }
  }
  return {
    id: q.id,
    ordinal: q.ordinal,
    type: q.type,
    promptMd: q.promptMd,
    weight: q.weight,
    options,
    allowMultiple,
  };
}

// Validates expectedJson via ExpectedAny rather than casting. If a row
// is malformed, degrade to a placeholder that the contract accepts —
// the debrief still renders, just without a usable expected answer.
function toAnswerKeyPayload(q: QuestionRow): AnswerKeyPayload {
  const key = q.answerKey;
  if (!key) {
    return placeholderAnswerKey(q.type);
  }
  const parsed = ExpectedAny.safeParse(key.expectedJson);
  if (!parsed.success || parsed.data.type !== q.type) {
    return {
      expected: placeholderExpected(q.type),
      debriefMd:
        "_The authored answer key for this question is malformed; the rubric below may not apply._\n\n" +
        key.debriefMd,
    };
  }
  return {
    expected: parsed.data,
    debriefMd: key.debriefMd,
  };
}

function placeholderAnswerKey(
  type: QuestionRow["type"],
): AnswerKeyPayload {
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
    case "short_answer":
      return { type: "short_answer", rubricNote: null };
    case "long_answer":
      return { type: "long_answer", rubricNote: null };
  }
}
