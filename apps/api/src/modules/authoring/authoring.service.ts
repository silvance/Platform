import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { QuestionType as PrismaQuestionType } from "@prisma/client";
import {
  AdminScenarioDetail,
  AdminScenarioSummary,
  AuthoredQuestion,
  CreateQuestionRequest,
  CreateScenarioRequest,
  UpdateQuestionRequest,
  UpdateScenarioRequest,
  MAX_QUESTIONS_PER_SCENARIO,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";

// Question types the M8 authoring surface can produce. select_indicators
// is intentionally excluded — it requires authoring an indicator set
// first, which is its own surface and lands later. Existing seeded
// select_indicators questions remain readable + editable as ordinals;
// to modify their correctness/options the seed remains the path.
const AUTHORABLE_TYPES = ["multi_choice", "confidence", "text_match"] as const;
type AuthorableType = (typeof AUTHORABLE_TYPES)[number];

@Injectable()
export class AuthoringService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminScenarioSummary[]> {
    const rows = await this.prisma.scenario.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { questions: true } },
      },
    });
    return rows.map((r) => toSummary(r, r._count.questions));
  }

  async getDetail(slug: string): Promise<AdminScenarioDetail> {
    const row = await this.prisma.scenario.findUnique({
      where: { slug },
      include: {
        brief: true,
        questions: {
          orderBy: { ordinal: "asc" },
          include: { answerKey: true },
        },
        _count: { select: { questions: true } },
      },
    });
    if (!row) throw new NotFoundException("Scenario not found.");

    const questions: AuthoredQuestion[] = row.questions.map((q) =>
      toAuthoredQuestion({
        id: q.id,
        ordinal: q.ordinal,
        type: q.type,
        promptMd: q.promptMd,
        weight: q.weight,
        optionsJson: q.optionsJson,
        expectedJson: q.answerKey?.expectedJson ?? null,
        debriefMd: q.answerKey?.debriefMd ?? null,
      }),
    );

    return {
      ...toSummary(row, row._count.questions),
      brief: row.brief
        ? {
            markdownBody: row.brief.markdownBody,
            disclaimerMd: row.brief.disclaimerMd ?? null,
          }
        : null,
      questions,
    };
  }

  async create(
    authorUserId: string,
    body: CreateScenarioRequest,
  ): Promise<AdminScenarioSummary> {
    const existing = await this.prisma.scenario.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("A scenario with that slug already exists.");
    }

    const created = await this.prisma.scenario.create({
      data: {
        slug: body.slug,
        title: body.title,
        summary: body.summary,
        skillAreas: body.skillAreas as never,
        difficulty: body.difficulty,
        estimatedMinutes: body.estimatedMinutes ?? null,
        tags: body.tags,
        status: body.status,
        source: "authored",
        authorUserId,
        brief: {
          create: {
            markdownBody: body.brief.markdownBody,
            disclaimerMd: body.brief.disclaimerMd ?? null,
          },
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    return toSummary(created, created._count.questions);
  }

  async update(
    slug: string,
    body: UpdateScenarioRequest,
  ): Promise<AdminScenarioSummary> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!scenario) throw new NotFoundException("Scenario not found.");

    const data: Prisma.ScenarioUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.summary !== undefined) data.summary = body.summary;
    if (body.skillAreas !== undefined) {
      data.skillAreas = body.skillAreas as never;
    }
    if (body.difficulty !== undefined) data.difficulty = body.difficulty;
    if (body.estimatedMinutes !== undefined) {
      data.estimatedMinutes = body.estimatedMinutes;
    }
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.status !== undefined) data.status = body.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.scenario.update({
        where: { id: scenario.id },
        data,
      });
      if (body.brief !== undefined) {
        await tx.scenarioBrief.upsert({
          where: { scenarioId: scenario.id },
          create: {
            scenarioId: scenario.id,
            markdownBody: body.brief.markdownBody,
            disclaimerMd: body.brief.disclaimerMd ?? null,
          },
          update: {
            markdownBody: body.brief.markdownBody,
            disclaimerMd: body.brief.disclaimerMd ?? null,
          },
        });
      }
      return tx.scenario.findUniqueOrThrow({
        where: { id: row.id },
        include: { _count: { select: { questions: true } } },
      });
    });
    return toSummary(updated, updated._count.questions);
  }

  async remove(slug: string): Promise<void> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!scenario) throw new NotFoundException("Scenario not found.");

    // Cascades handle brief, artifacts, questions (and their answer
    // keys), indicator sets, scenario progress, and question responses
    // — every FK to Scenario is ON DELETE CASCADE. Artifact bytes on
    // disk are NOT cleaned up here; the storage cleanup pass lives in
    // a separate maintenance job. Beta-only: it's fine to leave them.
    await this.prisma.scenario.delete({ where: { id: scenario.id } });
  }

  async addQuestion(
    slug: string,
    body: CreateQuestionRequest,
  ): Promise<AuthoredQuestion> {
    return this.prisma.$transaction(async (tx) => {
      const scenario = await tx.scenario.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!scenario) throw new NotFoundException("Scenario not found.");

      const existingCount = await tx.question.count({
        where: { scenarioId: scenario.id },
      });
      if (existingCount >= MAX_QUESTIONS_PER_SCENARIO) {
        throw new BadRequestException(
          `Scenario already has the maximum of ${MAX_QUESTIONS_PER_SCENARIO} questions.`,
        );
      }

      validateQuestionBody(body);

      const maxOrdinal = await tx.question.aggregate({
        where: { scenarioId: scenario.id },
        _max: { ordinal: true },
      });
      const nextOrdinal = (maxOrdinal._max.ordinal ?? 0) + 1;

      const { optionsJson, expectedJson, debriefMd } = bodyToDbShape(body);
      const created = await tx.question.create({
        data: {
          scenarioId: scenario.id,
          ordinal: nextOrdinal,
          type: body.type as PrismaQuestionType,
          promptMd: body.promptMd,
          weight: body.weight,
          optionsJson: (optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          answerKey: {
            create: {
              expectedJson: expectedJson as Prisma.InputJsonValue,
              debriefMd,
            },
          },
        },
        include: { answerKey: true },
      });

      // Adding a question invalidates any scenario_progress.completedAt
      // — the user has more to do now. Clear completedAt + bump the
      // cached totalQuestions counter on every progress row for this
      // scenario. The submit path recomputes both on the next answer
      // anyway, but stale UI state would be confusing in the meantime.
      await tx.scenarioProgress.updateMany({
        where: { scenarioId: scenario.id },
        data: { completedAt: null, totalQuestions: existingCount + 1 },
      });

      return toAuthoredQuestion({
        id: created.id,
        ordinal: created.ordinal,
        type: created.type,
        promptMd: created.promptMd,
        weight: created.weight,
        optionsJson: created.optionsJson,
        expectedJson: created.answerKey?.expectedJson ?? null,
        debriefMd: created.answerKey?.debriefMd ?? null,
      });
    });
  }

  async updateQuestion(
    slug: string,
    questionId: string,
    body: UpdateQuestionRequest,
  ): Promise<AuthoredQuestion> {
    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.findFirst({
        where: { id: questionId, scenario: { slug } },
        include: { answerKey: true },
      });
      if (!question) throw new NotFoundException("Question not found.");

      // Type changes are allowed but require swapping options + expected.
      // The grader is type-strict, so an in-place type change with
      // matching new payload is fine; the user's last-response on this
      // question still rehydrates because QuestionResponse stores the
      // response shape, not the question's options.
      if (
        question.type !== body.type &&
        !(AUTHORABLE_TYPES as readonly string[]).includes(question.type)
      ) {
        throw new BadRequestException(
          `Cannot change type from ${question.type} via the authoring API; that type isn't editable here.`,
        );
      }

      validateQuestionBody(body);

      const { optionsJson, expectedJson, debriefMd } = bodyToDbShape(body);
      const updated = await tx.question.update({
        where: { id: question.id },
        data: {
          type: body.type as PrismaQuestionType,
          promptMd: body.promptMd,
          weight: body.weight,
          optionsJson: (optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          // Switching off select_indicators? Wipe the FK so the row
          // doesn't keep pointing at a now-unrelated set.
          indicatorSetId: null,
        },
        include: { answerKey: true },
      });

      await tx.answerKey.upsert({
        where: { questionId: updated.id },
        create: {
          questionId: updated.id,
          expectedJson: expectedJson as Prisma.InputJsonValue,
          debriefMd,
        },
        update: {
          expectedJson: expectedJson as Prisma.InputJsonValue,
          debriefMd,
        },
      });

      // Updating correctness can change whether a user's already-set
      // completedAt is still earned. Conservative call: don't retroact.
      // Old completions stay; new submits re-grade against the new key.
      // This keeps the UI from suddenly "uncompleting" a question
      // someone solved, which feels worse than a stale completion.

      return toAuthoredQuestion({
        id: updated.id,
        ordinal: updated.ordinal,
        type: updated.type,
        promptMd: updated.promptMd,
        weight: updated.weight,
        optionsJson: updated.optionsJson,
        expectedJson:
          (await tx.answerKey.findUnique({ where: { questionId: updated.id } }))
            ?.expectedJson ?? null,
        debriefMd,
      });
    });
  }

  async removeQuestion(slug: string, questionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const question = await tx.question.findFirst({
        where: { id: questionId, scenario: { slug } },
        select: { id: true, scenarioId: true },
      });
      if (!question) throw new NotFoundException("Question not found.");

      // Cascade: deleting the question takes its question_responses
      // rows with it (onDelete: Cascade on QuestionResponse.question).
      // After the delete we recount completed responses per progress
      // row so the cached counter doesn't outrun totalQuestions — the
      // CHECK constraint `scenario_progress_counters_sane` would fire
      // if it did.
      await tx.question.delete({ where: { id: question.id } });

      const remaining = await tx.question.count({
        where: { scenarioId: question.scenarioId },
      });
      const progressRows = await tx.scenarioProgress.findMany({
        where: { scenarioId: question.scenarioId },
        select: { id: true },
      });
      for (const p of progressRows) {
        const completedCount = await tx.questionResponse.count({
          where: { progressId: p.id, completedAt: { not: null } },
        });
        // If deleting the question coincidentally completes the
        // scenario for someone (e.g. they'd solved everything except
        // the one we just removed), set completedAt. The submit path
        // would do the same on their next answer, but that won't
        // happen now since there's nothing left for them to submit.
        const scenarioCompletedAt =
          remaining > 0 && completedCount >= remaining ? new Date() : null;
        await tx.scenarioProgress.update({
          where: { id: p.id },
          data: {
            totalQuestions: remaining,
            completedQuestions: completedCount,
            completedAt: scenarioCompletedAt,
          },
        });
      }
    });
  }
}

function validateQuestionBody(body: CreateQuestionRequest): void {
  if (body.type === "multi_choice") {
    const ids = new Set(body.options.map((o) => o.id));
    if (ids.size !== body.options.length) {
      throw new BadRequestException("Duplicate option ids.");
    }
    for (const id of body.correctIds) {
      if (!ids.has(id)) {
        throw new BadRequestException(
          `correctIds references unknown option id "${id}".`,
        );
      }
    }
    if (!body.allowMultiple && body.correctIds.length > 1) {
      throw new BadRequestException(
        "allowMultiple is false but more than one correct id was given.",
      );
    }
  } else if (body.type === "confidence") {
    const [lo, hi] = body.expectedRange;
    if (lo > hi) {
      throw new BadRequestException(
        "expectedRange must have lo <= hi.",
      );
    }
  } else if (body.type === "text_match") {
    if (body.regex) {
      for (const pattern of body.acceptableAnswers) {
        try {
          new RegExp(pattern, body.caseSensitive ? "" : "i");
        } catch {
          throw new BadRequestException(
            `Invalid regex acceptable answer: ${pattern}`,
          );
        }
      }
    }
  }
}

function bodyToDbShape(body: CreateQuestionRequest): {
  optionsJson: unknown | null;
  expectedJson: unknown;
  debriefMd: string;
} {
  if (body.type === "multi_choice") {
    return {
      optionsJson: { options: body.options, allowMultiple: body.allowMultiple },
      expectedJson: {
        type: "multi_choice",
        correctIds: body.correctIds,
        allowMultiple: body.allowMultiple,
      },
      debriefMd: body.debriefMd,
    };
  }
  if (body.type === "confidence") {
    return {
      optionsJson: null,
      expectedJson: {
        type: "confidence",
        expectedRange: body.expectedRange,
      },
      debriefMd: body.debriefMd,
    };
  }
  // text_match — keep correctness off optionsJson. acceptableAnswers
  // lives only on expectedJson so leaking a Question row never leaks
  // the answer key.
  return {
    optionsJson: {
      caseSensitive: body.caseSensitive,
      normalizeWhitespace: body.normalizeWhitespace,
      regex: body.regex,
      hint: body.hint ?? null,
      hintAfterTries: body.hintAfterTries,
    },
    expectedJson: {
      type: "text_match",
      acceptableAnswers: body.acceptableAnswers,
      regex: body.regex,
    },
    debriefMd: body.debriefMd,
  };
}

function toSummary(
  row: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    skillAreas: string[];
    difficulty: number;
    estimatedMinutes: number | null;
    tags: string[];
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  questionCount: number,
): AdminScenarioSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    skillAreas: row.skillAreas as never,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    tags: row.tags,
    status: row.status as never,
    questionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface RawQuestion {
  id: string;
  ordinal: number;
  type: string;
  promptMd: string;
  weight: number;
  optionsJson: unknown;
  expectedJson: unknown;
  debriefMd: string | null;
}

function toAuthoredQuestion(q: RawQuestion): AuthoredQuestion {
  if (!isAuthorable(q.type)) {
    return {
      type: "unsupported",
      id: q.id,
      ordinal: q.ordinal,
      promptMd: q.promptMd,
      weight: q.weight,
      underlyingType: q.type,
    };
  }
  const debrief = q.debriefMd ?? "_No debrief authored._";
  if (q.type === "multi_choice") {
    const opts = q.optionsJson as
      | { options?: unknown; allowMultiple?: unknown }
      | null
      | undefined;
    const exp = q.expectedJson as
      | { correctIds?: unknown }
      | null
      | undefined;
    return {
      type: "multi_choice",
      id: q.id,
      ordinal: q.ordinal,
      promptMd: q.promptMd,
      weight: q.weight,
      debriefMd: debrief,
      options: Array.isArray(opts?.options) ? (opts!.options as never) : [],
      allowMultiple: Boolean(opts?.allowMultiple),
      correctIds: Array.isArray(exp?.correctIds)
        ? (exp!.correctIds as string[])
        : [],
    };
  }
  if (q.type === "confidence") {
    const exp = q.expectedJson as
      | { expectedRange?: unknown }
      | null
      | undefined;
    const rangeArr = Array.isArray(exp?.expectedRange)
      ? (exp!.expectedRange as unknown[])
      : null;
    const lo = typeof rangeArr?.[0] === "number" ? (rangeArr[0] as number) : 3;
    const hi = typeof rangeArr?.[1] === "number" ? (rangeArr[1] as number) : 3;
    return {
      type: "confidence",
      id: q.id,
      ordinal: q.ordinal,
      promptMd: q.promptMd,
      weight: q.weight,
      debriefMd: debrief,
      expectedRange: [lo, hi],
    };
  }
  // text_match. The acceptable-answers list lives ONLY on expectedJson;
  // optionsJson carries the matching parameters. Reading correctness
  // through expectedJson keeps a single source of truth and makes a
  // future leak via optionsJson impossible (it has nothing to leak).
  const opts = q.optionsJson as
    | {
        caseSensitive?: unknown;
        normalizeWhitespace?: unknown;
        regex?: unknown;
        hint?: unknown;
        hintAfterTries?: unknown;
      }
    | null
    | undefined;
  const exp = q.expectedJson as
    | { acceptableAnswers?: unknown }
    | null
    | undefined;
  return {
    type: "text_match",
    id: q.id,
    ordinal: q.ordinal,
    promptMd: q.promptMd,
    weight: q.weight,
    debriefMd: debrief,
    acceptableAnswers: Array.isArray(exp?.acceptableAnswers)
      ? (exp!.acceptableAnswers as string[])
      : [],
    caseSensitive: Boolean(opts?.caseSensitive),
    normalizeWhitespace: opts?.normalizeWhitespace !== false,
    regex: Boolean(opts?.regex),
    hint: typeof opts?.hint === "string" ? opts!.hint : null,
    hintAfterTries:
      typeof opts?.hintAfterTries === "number"
        ? (opts!.hintAfterTries as number)
        : 3,
  };
}

function isAuthorable(t: string): t is AuthorableType {
  return (AUTHORABLE_TYPES as readonly string[]).includes(t);
}
