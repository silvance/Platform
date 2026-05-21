import {
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
  QuestionPayload,
  QuestionResponse,
  SaveAnswerRequest,
  AutoScoreOutcome,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import { GradingService } from "./grading.service";

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
  ) {}

  // POST /v1/scenarios/:slug/attempts
  // Idempotent: if the trainee already has an attempt for this scenario,
  // return it. Otherwise create one. Trainees only — instructors don't
  // take attempts in M5.
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
      // Same 404-not-403 stance as scenario detail — don't leak draft existence.
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
  async saveAnswer(
    role: Role,
    actorUserId: string,
    attemptId: string,
    questionId: string,
    body: SaveAnswerRequest,
  ): Promise<AttemptAnswerPayload> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { id: true, traineeUserId: true, locked: true },
    });
    if (!attempt) throw new NotFoundException("Attempt not found.");
    // Only the owning trainee may write answers. Instructors can read but
    // never write in M5.
    if (role !== "trainee" || actorUserId !== attempt.traineeUserId) {
      throw new ForbiddenException("Cannot write to another user's attempt.");
    }
    if (attempt.locked) {
      throw new ConflictException("Attempt is locked; submit is final.");
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, scenarioId: true, type: true },
    });
    if (!question) throw new NotFoundException("Question not found.");
    // The question must belong to the attempt's scenario.
    const ownScenario = await this.prisma.attempt.findFirst({
      where: { id: attemptId, scenarioId: question.scenarioId },
      select: { id: true },
    });
    if (!ownScenario) throw new NotFoundException("Question not found.");

    // Validate the response shape matches the declared question type.
    if (body.response.type !== question.type) {
      throw new ConflictException(
        `Response type ${body.response.type} does not match question type ${question.type}.`,
      );
    }

    const saved = await this.prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: question.id,
        },
      },
      update: { responseJson: body.response as object },
      create: {
        attemptId: attempt.id,
        questionId: question.id,
        responseJson: body.response as object,
      },
    });

    return this.composeAnswerPayload(saved);
  }

  // POST /v1/attempts/:id/submit
  // Idempotent: re-submitting a locked attempt returns the same state.
  async submit(
    role: Role,
    actorUserId: string,
    attemptId: string,
  ): Promise<AttemptPayload> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        scenario: {
          include: { questions: { include: { answerKey: true }, orderBy: { ordinal: "asc" } } },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException("Attempt not found.");
    if (role !== "trainee" || actorUserId !== attempt.traineeUserId) {
      throw new ForbiddenException("Cannot submit another user's attempt.");
    }
    if (attempt.locked) {
      // Idempotent re-submit — return current state.
      return this.composeAttemptPayload(attempt, attempt.scenario);
    }

    // Compute auto-grades for every question that has an answer key.
    const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    let total = 0;
    const updates: Array<{
      where: { attemptId_questionId: { attemptId: string; questionId: string } };
      update: { autoScore: number | null; autoOutcome: AutoScoreOutcome | null };
      create: Prisma.AttemptAnswerUncheckedCreateInput;
    }> = [];

    for (const q of attempt.scenario.questions) {
      const ans = answersByQuestion.get(q.id);
      const result = this.grading.grade({
        type: q.type,
        expectedJson: q.answerKey?.expectedJson ?? null,
        responseJson: ans?.responseJson ?? null,
      });
      if (result.score !== null) {
        total += result.score * q.weight;
      }
      updates.push({
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
    await this.prisma.$transaction([
      ...updates.map((u) =>
        this.prisma.attemptAnswer.upsert({
          where: u.where,
          update: u.update,
          create: u.create,
        }),
      ),
      this.prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          locked: true,
          submittedAt,
          totalScore: total,
        },
      }),
    ]);

    const refreshed = await this.prisma.attempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: {
        scenario: {
          include: { questions: { orderBy: { ordinal: "asc" } } },
        },
        answers: true,
      },
    });
    return this.composeAttemptPayload(refreshed, refreshed.scenario);
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
    const debriefAnswers: DebriefAnswerPayload[] = attempt.scenario.questions.map((q) => {
      const a = answersByQ.get(q.id);
      const question: QuestionPayload = toQuestionPayload(q);
      const answerKey: AnswerKeyPayload = toAnswerKeyPayload(q);
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
    });

    return {
      attemptId: attempt.id,
      scenarioSlug: attempt.scenario.slug,
      scenarioTitle: attempt.scenario.title,
      submittedAt: attempt.submittedAt.toISOString(),
      totalScore: attempt.totalScore ?? 0,
      maxScore: attempt.maxScore,
      answers: debriefAnswers,
    };
  }

  // ─── helpers ────────────────────────────────────────────────────

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

function toQuestionPayload(q: QuestionRow): QuestionPayload {
  // Pull options through a defensive shape rather than re-using the
  // contract's full union — `options` and `allowMultiple` are nullable
  // for non-mc rows.
  let options: QuestionPayload["options"] = null;
  let allowMultiple: QuestionPayload["allowMultiple"] = null;
  if (q.type === "multi_choice" && q.optionsJson) {
    const raw = q.optionsJson as {
      options?: Array<{ id: string; label: string }>;
      allowMultiple?: boolean;
    };
    options = raw.options ?? null;
    allowMultiple = raw.allowMultiple ?? null;
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

function toAnswerKeyPayload(q: QuestionRow): AnswerKeyPayload {
  // expectedJson is the discriminated shape per type. We trust the seed
  // to write it correctly; safeParse defends against drift.
  const key = q.answerKey;
  if (!key) {
    // No authored answer key — degrade gracefully so debrief still shows
    // *something* for the question.
    return {
      expected:
        q.type === "multi_choice"
          ? { type: "multi_choice", correctIds: [], allowMultiple: false }
          : q.type === "confidence"
            ? { type: "confidence", expectedRange: [3, 3] }
            : { type: q.type, rubricNote: null },
      debriefMd: "_No debrief authored for this question._",
    };
  }
  return {
    // The contract validates this at the controller boundary; we trust
    // the seed/import paths to write the right shape.
    expected: key.expectedJson as AnswerKeyPayload["expected"],
    debriefMd: key.debriefMd,
  };
}
