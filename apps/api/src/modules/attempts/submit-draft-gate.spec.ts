import { NotFoundException } from "@nestjs/common";
import { ProgressService } from "./progress.service";
import { GradingService } from "./grading.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import type { PrismaService } from "../database/prisma.service";

// Regression spec for the M17-era /admin/challenges → Solve → submit
// path. The submit handler used to reject every draft with a flat
// `status !== "published" → 404`, ignoring admin role. The Solve
// link landed admins on a working page but their first answer
// submission failed with API ... /SUBMIT RETURNED 404. This spec
// pins the rule that admin and user visibility on the SUBMIT path
// matches the visibility on the READ paths (scenarios.getBySlug,
// progress.getProgress):
//
//   users  → published only
//   admins → published OR draft

const VALID_BODY = {
  // The shape that crosses the wire — `data` wraps the per-type
  // payload, matching SubmitAnswerRequest in @ci-train/contracts.
  response: {
    type: "multi_choice" as const,
    data: { selectedIds: ["a"] },
  },
};

// ── ProgressService.submit ──────────────────────────────────────

function makeFakePrismaForSubmit(opts: {
  status: "draft" | "published" | "archived";
}) {
  const scenarioFindUnique = jest.fn().mockResolvedValue({
    id: "s1",
    status: opts.status,
  });
  const questionFindFirst = jest.fn().mockResolvedValue(null);
  const tx = {
    scenario: { findUnique: scenarioFindUnique },
    question: { findFirst: questionFindFirst },
  };
  const $transaction = jest.fn((cb: (t: typeof tx) => unknown) => cb(tx));
  return {
    api: { $transaction } as unknown as PrismaService,
    scenarioFindUnique,
    questionFindFirst,
  };
}

describe("ProgressService.submit — admin-vs-user draft gating", () => {
  it("user submitting against a draft → 404, short-circuited at status check", async () => {
    const fake = makeFakePrismaForSubmit({ status: "draft" });
    const svc = new ProgressService(fake.api, new GradingService());

    await expect(
      svc.submit("user", "uid-1", "some-draft-slug", "q-uuid", VALID_BODY),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Short-circuited at the status gate — question lookup never ran.
    expect(fake.questionFindFirst).not.toHaveBeenCalled();
  });

  it("admin submitting against a draft → proceeds past the status check (M17 fixup)", async () => {
    const fake = makeFakePrismaForSubmit({ status: "draft" });
    const svc = new ProgressService(fake.api, new GradingService());

    // Mocked question lookup returns null so the call still throws
    // NotFound — but this throw is "Question not found" from line 241,
    // not the status gate. We assert the question lookup RAN: that's
    // proof the gate let admin through.
    await expect(
      svc.submit("admin", "admin-1", "some-draft-slug", "q-uuid", VALID_BODY),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(fake.questionFindFirst).toHaveBeenCalledTimes(1);
  });

  it("user submitting against a published scenario → proceeds past the status check", async () => {
    const fake = makeFakePrismaForSubmit({ status: "published" });
    const svc = new ProgressService(fake.api, new GradingService());

    await expect(
      svc.submit("user", "uid-1", "some-published-slug", "q-uuid", VALID_BODY),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(fake.questionFindFirst).toHaveBeenCalledTimes(1);
  });
});

// ── ProgressService.getProgress ─────────────────────────────────

function makeFakePrismaForProgress(opts: {
  status: "draft" | "published" | "archived";
  hasScenario?: boolean;
}) {
  const scenarioFindUnique = jest.fn().mockResolvedValue(
    opts.hasScenario === false
      ? null
      : {
          id: "s1",
          slug: "draft-slug",
          status: opts.status,
          title: "Test Draft",
          questions: [],
        },
  );
  return {
    api: {
      scenario: { findUnique: scenarioFindUnique },
      scenarioProgress: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService,
    scenarioFindUnique,
  };
}

describe("ProgressService.getProgress — admin-vs-user draft gating", () => {
  it("user GET draft progress → 404", async () => {
    const fake = makeFakePrismaForProgress({ status: "draft" });
    const svc = new ProgressService(fake.api, new GradingService());

    await expect(
      svc.getProgress("user", "uid-1", "draft-slug"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("admin GET draft progress → does NOT throw NotFound at the status gate", async () => {
    const fake = makeFakePrismaForProgress({ status: "draft" });
    const svc = new ProgressService(fake.api, new GradingService());

    // The mock returns a scenario with no questions, so getProgress
    // returns a valid (empty) payload — no exception. That's the
    // assertion: admin gets past the gate.
    const payload = await svc.getProgress("admin", "admin-1", "draft-slug");
    expect(payload.scenarioSlug).toBe("draft-slug");
    expect(payload.totalQuestions).toBe(0);
  });
});

// ── ScenariosService.getBySlug ──────────────────────────────────

function makeFakePrismaForScenarioGet(opts: {
  status: "draft" | "published" | "archived";
}) {
  const scenarioFindUnique = jest.fn().mockResolvedValue({
    id: "s1",
    slug: "any-slug",
    title: "Test",
    summary: "",
    skillAreas: [],
    difficulty: 1,
    estimatedMinutes: 1,
    tags: [],
    status: opts.status,
    source: "authored",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    brief: null,
    artifacts: [],
    // M22: getBySlug now reads _count.questions for the
    // no-progress fallback.
    _count: { questions: 0 },
  });
  return {
    api: {
      scenario: { findUnique: scenarioFindUnique },
      // M22: getBySlug looks up the actor's progress row; the
      // gate tests use a fresh-user scenario so this is null.
      scenarioProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService,
    scenarioFindUnique,
  };
}

describe("ScenariosService.getBySlug — admin-vs-user draft gating", () => {
  it("user GET draft scenario → 404 (existence not leaked)", async () => {
    const fake = makeFakePrismaForScenarioGet({ status: "draft" });
    const svc = new ScenariosService(fake.api);

    await expect(svc.getBySlug("user", "test-user-id", "draft-slug")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("admin GET draft scenario → returns payload", async () => {
    const fake = makeFakePrismaForScenarioGet({ status: "draft" });
    const svc = new ScenariosService(fake.api);

    const payload = await svc.getBySlug("admin", "test-admin-id", "draft-slug");
    expect(payload.slug).toBe("any-slug");
  });

  it("user GET published scenario → returns payload", async () => {
    const fake = makeFakePrismaForScenarioGet({ status: "published" });
    const svc = new ScenariosService(fake.api);

    const payload = await svc.getBySlug("user", "test-user-id", "published-slug");
    expect(payload.slug).toBe("any-slug");
  });
});
