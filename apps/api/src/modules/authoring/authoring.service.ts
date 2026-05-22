import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ArtifactKind, QuestionType as PrismaQuestionType } from "@prisma/client";
import {
  AdminScenarioDetail,
  AdminScenarioSummary,
  AuthoredArtifact,
  AuthoredIndicatorSet,
  AuthoredQuestion,
  CreateIndicatorSetRequest,
  CreateQuestionRequest,
  CreateScenarioRequest,
  IndicatorItem,
  UpdateArtifactRequest,
  UpdateIndicatorSetRequest,
  UpdateQuestionRequest,
  UpdateScenarioRequest,
  MAX_QUESTIONS_PER_SCENARIO,
} from "@ci-train/contracts";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service";

// Question types the authoring surface can produce. M9 added
// select_indicators (and the indicator-set CRUD it needs). The
// "unsupported" escape hatch survives in the contract for a hypothetical
// future enum value but every current QuestionType is authorable.
const AUTHORABLE_TYPES = [
  "multi_choice",
  "confidence",
  "text_match",
  "select_indicators",
] as const;
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
        artifacts: { orderBy: { ordinal: "asc" } },
        indicatorSets: {
          orderBy: { displayName: "asc" },
          include: { _count: { select: { questions: true } } },
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
        indicatorSetId: q.indicatorSetId ?? null,
      }),
    );

    const indicatorSets: AuthoredIndicatorSet[] = row.indicatorSets.map((s) =>
      toAuthoredIndicatorSet(s, s._count.questions),
    );

    const artifacts: AuthoredArtifact[] = row.artifacts.map((a) => ({
      id: a.id,
      ordinal: a.ordinal,
      displayName: a.displayName,
      kind: a.kind,
      sha256: a.sha256,
      sizeBytes: a.sizeBytes,
      mimeType: a.mimeType,
      viewerHint: a.viewerHint ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      ...toSummary(row, row._count.questions),
      brief: row.brief
        ? {
            markdownBody: row.brief.markdownBody,
            disclaimerMd: row.brief.disclaimerMd ?? null,
          }
        : null,
      questions,
      indicatorSets,
      artifacts,
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

      await validateQuestionBodyTx(tx, scenario.id, body);

      const maxOrdinal = await tx.question.aggregate({
        where: { scenarioId: scenario.id },
        _max: { ordinal: true },
      });
      const nextOrdinal = (maxOrdinal._max.ordinal ?? 0) + 1;

      const { optionsJson, expectedJson, debriefMd, indicatorSetId } =
        bodyToDbShape(body);
      const created = await tx.question.create({
        data: {
          scenarioId: scenario.id,
          ordinal: nextOrdinal,
          type: body.type as PrismaQuestionType,
          promptMd: body.promptMd,
          weight: body.weight,
          optionsJson: (optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          indicatorSetId,
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
        indicatorSetId: created.indicatorSetId ?? null,
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
        include: { answerKey: true, scenario: { select: { id: true } } },
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

      await validateQuestionBodyTx(tx, question.scenarioId, body);

      const { optionsJson, expectedJson, debriefMd, indicatorSetId } =
        bodyToDbShape(body);
      const updated = await tx.question.update({
        where: { id: question.id },
        data: {
          type: body.type as PrismaQuestionType,
          promptMd: body.promptMd,
          weight: body.weight,
          optionsJson: (optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          // The CHECK constraint enforces: select_indicators ⇔ FK set.
          // bodyToDbShape returns the correct value (set id for
          // select_indicators, null for everything else).
          indicatorSetId,
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
        indicatorSetId: updated.indicatorSetId ?? null,
      });
    });
  }

  // ─── indicator sets ────────────────────────────────────────────

  async addIndicatorSet(
    slug: string,
    body: CreateIndicatorSetRequest,
  ): Promise<AuthoredIndicatorSet> {
    return this.prisma.$transaction(async (tx) => {
      const scenario = await tx.scenario.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!scenario) throw new NotFoundException("Scenario not found.");

      const dup = await tx.indicatorSet.findUnique({
        where: {
          scenarioId_slug: { scenarioId: scenario.id, slug: body.slug },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          "An indicator set with that slug already exists on this scenario.",
        );
      }

      assertUniqueItemIds(body.items);
      const sourceArtifactId = await resolveSourceArtifact(
        tx,
        scenario.id,
        body.sourceArtifactId,
      );

      const created = await tx.indicatorSet.create({
        data: {
          scenarioId: scenario.id,
          slug: body.slug,
          displayName: body.displayName,
          sourceArtifactId,
          itemsJson: body.items as never,
        },
        include: { _count: { select: { questions: true } } },
      });
      return toAuthoredIndicatorSet(created, created._count.questions);
    });
  }

  async updateIndicatorSet(
    slug: string,
    setId: string,
    body: UpdateIndicatorSetRequest,
  ): Promise<AuthoredIndicatorSet> {
    return this.prisma.$transaction(async (tx) => {
      const set = await tx.indicatorSet.findFirst({
        where: { id: setId, scenario: { slug } },
      });
      if (!set) throw new NotFoundException("Indicator set not found.");

      // Reject item changes that would orphan correctIds on dependent
      // questions. Other authoring tools tend to silently lose data
      // here; we'd rather force the admin to update the questions
      // first or accept a list with the IDs they still want.
      if (body.items !== undefined) {
        assertUniqueItemIds(body.items);
        const referencedQuestions = await tx.question.findMany({
          where: { indicatorSetId: set.id },
          include: { answerKey: true },
        });
        const newIds = new Set(body.items.map((i) => i.id));
        for (const q of referencedQuestions) {
          const exp = q.answerKey?.expectedJson as
            | { correctIds?: unknown }
            | null
            | undefined;
          const correctIds = Array.isArray(exp?.correctIds)
            ? (exp!.correctIds as string[])
            : [];
          const orphans = correctIds.filter((id) => !newIds.has(id));
          if (orphans.length > 0) {
            throw new BadRequestException({
              message:
                "Items cannot be removed while a question still marks them correct.",
              questionId: q.id,
              orphans,
            });
          }
        }
      }

      const data: Prisma.IndicatorSetUpdateInput = {};
      if (body.displayName !== undefined) data.displayName = body.displayName;
      if (body.sourceArtifactId !== undefined) {
        const resolved = await resolveSourceArtifact(
          tx,
          set.scenarioId,
          body.sourceArtifactId,
        );
        data.sourceArtifact = resolved
          ? { connect: { id: resolved } }
          : { disconnect: true };
      }
      if (body.items !== undefined) {
        data.itemsJson = body.items as never;
      }

      const updated = await tx.indicatorSet.update({
        where: { id: set.id },
        data,
        include: { _count: { select: { questions: true } } },
      });
      return toAuthoredIndicatorSet(updated, updated._count.questions);
    });
  }

  async removeIndicatorSet(slug: string, setId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const set = await tx.indicatorSet.findFirst({
        where: { id: setId, scenario: { slug } },
        include: { _count: { select: { questions: true } } },
      });
      if (!set) throw new NotFoundException("Indicator set not found.");

      // FK is ON DELETE RESTRICT — refuse rather than silently break
      // dependent select_indicators questions.
      if (set._count.questions > 0) {
        throw new ConflictException(
          `Indicator set is still referenced by ${set._count.questions} question(s). Delete or retype those first.`,
        );
      }
      await tx.indicatorSet.delete({ where: { id: set.id } });
    });
  }

  // ─── artifact metadata (bytes handled in the controller) ───────

  async resolveScenarioId(slug: string): Promise<string> {
    const row = await this.prisma.scenario.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Scenario not found.");
    return row.id;
  }

  async recordArtifact(
    slug: string,
    args: {
      displayName: string;
      kind: ArtifactKind;
      relativePath: string;
      sha256: string;
      sizeBytes: number;
      mimeType: string;
      viewerHint?: string | null;
    },
  ): Promise<{ artifact: AuthoredArtifact; scenarioId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const scenario = await tx.scenario.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!scenario) throw new NotFoundException("Scenario not found.");

      const max = await tx.artifact.aggregate({
        where: { scenarioId: scenario.id },
        _max: { ordinal: true },
      });
      const nextOrdinal = (max._max.ordinal ?? 0) + 1;

      const created = await tx.artifact.create({
        data: {
          scenarioId: scenario.id,
          ordinal: nextOrdinal,
          displayName: args.displayName,
          kind: args.kind,
          relativePath: args.relativePath,
          sha256: args.sha256,
          sizeBytes: args.sizeBytes,
          mimeType: args.mimeType,
          viewerHint: args.viewerHint ?? null,
        },
      });
      return {
        artifact: toAuthoredArtifactRow(created),
        scenarioId: scenario.id,
      };
    });
  }

  async updateArtifact(
    slug: string,
    artifactId: string,
    body: UpdateArtifactRequest,
  ): Promise<AuthoredArtifact> {
    return this.prisma.$transaction(async (tx) => {
      const artifact = await tx.artifact.findFirst({
        where: { id: artifactId, scenario: { slug } },
      });
      if (!artifact) throw new NotFoundException("Artifact not found.");

      // Ordinal uniqueness per scenario is enforced by a DB unique
      // index. On a collision (admin reorders into an occupied slot)
      // we swap the existing occupant onto the vacated slot — single
      // operation, no big-bang renumber.
      const data: Prisma.ArtifactUpdateInput = {};
      if (body.displayName !== undefined) data.displayName = body.displayName;
      if (body.viewerHint !== undefined) data.viewerHint = body.viewerHint;
      if (body.ordinal !== undefined && body.ordinal !== artifact.ordinal) {
        const occupant = await tx.artifact.findFirst({
          where: {
            scenarioId: artifact.scenarioId,
            ordinal: body.ordinal,
            id: { not: artifact.id },
          },
        });
        if (occupant) {
          // Park the occupant at a guaranteed-free negative slot, move
          // the target into place, swap the occupant into the vacated
          // slot. Three writes, but no constraint juggling.
          await tx.artifact.update({
            where: { id: occupant.id },
            data: { ordinal: -1 },
          });
          await tx.artifact.update({
            where: { id: artifact.id },
            data: { ordinal: body.ordinal },
          });
          await tx.artifact.update({
            where: { id: occupant.id },
            data: { ordinal: artifact.ordinal },
          });
          // We've already moved this row; clear the field so the final
          // update below is a no-op for ordinal.
          data.ordinal = body.ordinal;
        } else {
          data.ordinal = body.ordinal;
        }
      }

      const updated = await tx.artifact.update({
        where: { id: artifact.id },
        data,
      });
      return toAuthoredArtifactRow(updated);
    });
  }

  async findArtifact(
    slug: string,
    artifactId: string,
  ): Promise<{
    id: string;
    scenarioId: string;
    relativePath: string;
  } | null> {
    const artifact = await this.prisma.artifact.findFirst({
      where: { id: artifactId, scenario: { slug } },
      select: { id: true, scenarioId: true, relativePath: true },
    });
    return artifact;
  }

  async removeArtifact(slug: string, artifactId: string): Promise<{
    relativePath: string;
  }> {
    const artifact = await this.findArtifact(slug, artifactId);
    if (!artifact) throw new NotFoundException("Artifact not found.");

    // Indicator sets pointing at this artifact survive via
    // `ON DELETE SET NULL` (the items_json content is the value, not
    // the link). The storage backend bytes are removed by the
    // controller after this row goes; doing the disk delete inside the
    // tx would risk leaving a row pointing at deleted bytes if the
    // commit fails.
    await this.prisma.artifact.delete({ where: { id: artifact.id } });
    return { relativePath: artifact.relativePath };
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

// Some validation needs DB lookups (select_indicators must verify the
// indicator set belongs to the scenario + that correctIds resolve to
// real item ids). It runs inside the same transaction that performs
// the create/update so the check + write see the same snapshot.
async function validateQuestionBodyTx(
  tx: Prisma.TransactionClient,
  scenarioId: string,
  body: CreateQuestionRequest,
): Promise<void> {
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
    return;
  }
  if (body.type === "confidence") {
    const [lo, hi] = body.expectedRange;
    if (lo > hi) {
      throw new BadRequestException("expectedRange must have lo <= hi.");
    }
    return;
  }
  if (body.type === "text_match") {
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
    return;
  }
  // select_indicators — referenced indicator set must belong to the
  // same scenario; correctIds must all resolve to ids on its items.
  const set = await tx.indicatorSet.findFirst({
    where: { id: body.indicatorSetId, scenarioId },
  });
  if (!set) {
    throw new BadRequestException(
      "indicatorSetId does not match a set on this scenario.",
    );
  }
  // items_json was authored as a bare array OR `{items:[...]}`. Both
  // shapes survived from M6/M7; accept both here too.
  const rawItems = (set.itemsJson as { items?: unknown } | null)?.items
    ?? set.itemsJson;
  const items = z.array(IndicatorItem).safeParse(rawItems);
  if (!items.success) {
    throw new BadRequestException(
      "Indicator set is misconfigured (invalid items).",
    );
  }
  const validIds = new Set(items.data.map((i) => i.id));
  const unknownIds = body.correctIds.filter((id) => !validIds.has(id));
  if (unknownIds.length > 0) {
    throw new BadRequestException({
      message: "correctIds references unknown indicator id(s).",
      unknown: unknownIds,
    });
  }
}

interface DbShape {
  optionsJson: unknown | null;
  expectedJson: unknown;
  debriefMd: string;
  // Mirrors questions.indicator_set_id. Only set for select_indicators;
  // the DB CHECK enforces the converse.
  indicatorSetId: string | null;
}

function bodyToDbShape(body: CreateQuestionRequest): DbShape {
  if (body.type === "multi_choice") {
    return {
      optionsJson: { options: body.options, allowMultiple: body.allowMultiple },
      expectedJson: {
        type: "multi_choice",
        correctIds: body.correctIds,
        allowMultiple: body.allowMultiple,
      },
      debriefMd: body.debriefMd,
      indicatorSetId: null,
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
      indicatorSetId: null,
    };
  }
  if (body.type === "text_match") {
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
      indicatorSetId: null,
    };
  }
  // select_indicators. The item set itself lives on indicator_sets;
  // optionsJson is null. Correctness is just the set of correct ids.
  return {
    optionsJson: null,
    expectedJson: {
      type: "select_indicators",
      correctIds: body.correctIds,
    },
    debriefMd: body.debriefMd,
    indicatorSetId: body.indicatorSetId,
  };
}

function assertUniqueItemIds(items: readonly { id: string }[]): void {
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) {
      throw new BadRequestException(`Duplicate item id: "${it.id}".`);
    }
    ids.add(it.id);
  }
}

async function resolveSourceArtifact(
  tx: Prisma.TransactionClient,
  scenarioId: string,
  raw: string | null | undefined,
): Promise<string | null> {
  if (raw === undefined || raw === null) return null;
  const artifact = await tx.artifact.findFirst({
    where: { id: raw, scenarioId },
    select: { id: true },
  });
  if (!artifact) {
    throw new BadRequestException(
      "sourceArtifactId does not match an artifact on this scenario.",
    );
  }
  return artifact.id;
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
  indicatorSetId: string | null;
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
  if (q.type === "text_match") {
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
  // select_indicators. The set + items live on indicator_sets; this
  // payload carries only the FK + correctIds so the editor can render
  // the question card.
  const exp = q.expectedJson as
    | { correctIds?: unknown }
    | null
    | undefined;
  return {
    type: "select_indicators",
    id: q.id,
    ordinal: q.ordinal,
    promptMd: q.promptMd,
    weight: q.weight,
    debriefMd: debrief,
    indicatorSetId: q.indicatorSetId ?? "",
    correctIds: Array.isArray(exp?.correctIds)
      ? (exp!.correctIds as string[])
      : [],
  };
}

function isAuthorable(t: string): t is AuthorableType {
  return (AUTHORABLE_TYPES as readonly string[]).includes(t);
}

function toAuthoredIndicatorSet(
  row: {
    id: string;
    slug: string;
    displayName: string;
    sourceArtifactId: string | null;
    itemsJson: unknown;
  },
  questionCount: number,
): AuthoredIndicatorSet {
  const rawItems = (row.itemsJson as { items?: unknown } | null)?.items
    ?? row.itemsJson;
  const parsed = z.array(IndicatorItem).safeParse(rawItems);
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    sourceArtifactId: row.sourceArtifactId,
    items: parsed.success ? parsed.data : [],
    questionCount,
  };
}

function toAuthoredArtifactRow(row: {
  id: string;
  ordinal: number;
  displayName: string;
  kind: ArtifactKind;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  viewerHint: string | null;
  createdAt: Date;
}): AuthoredArtifact {
  return {
    id: row.id,
    ordinal: row.ordinal,
    displayName: row.displayName,
    kind: row.kind,
    sha256: row.sha256,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    viewerHint: row.viewerHint ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
