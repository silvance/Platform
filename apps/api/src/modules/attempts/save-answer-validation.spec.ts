import { AttemptsService } from "./attempts.service";
import { GradingService } from "./grading.service";
import type { PrismaService } from "../database/prisma.service";
import { Prisma } from "@prisma/client";

// These tests exercise the validation logic that lives inside the
// transactional `saveAnswer` path. We stub Prisma's `$transaction` to
// invoke the callback with a fake tx that mirrors the real interface
// the service uses: `$queryRaw` for the FOR UPDATE select, plus
// question.findFirst / attemptAnswer.upsert.

interface LockedRow {
  id: string;
  scenario_id: string;
  trainee_user_id: string;
  locked: boolean;
  submitted_at: Date | null;
  max_score: number;
}

const TRAINEE_ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const SCENARIO_ID = "33333333-3333-4333-8333-333333333333";
const QUESTION_ID = "44444444-4444-4444-8444-444444444444";

interface FakeOpts {
  attempt: LockedRow | null;
  question:
    | {
        id: string;
        type: "multi_choice" | "short_answer" | "long_answer" | "confidence";
        optionsJson: unknown;
      }
    | null;
}

function makeFakePrisma({ attempt, question }: FakeOpts): PrismaService {
  const upsert = jest.fn(async () => ({
    questionId: QUESTION_ID,
    responseJson: { type: "multi_choice", data: { selectedIds: ["a"] } },
    autoScore: null,
    autoOutcome: null,
    manualScore: null,
    instructorNotesMd: null,
  }));
  interface FakeTx {
    $queryRaw: jest.Mock;
    question: { findFirst: jest.Mock };
    attemptAnswer: { upsert: jest.Mock };
  }
  const tx: FakeTx = {
    $queryRaw: jest.fn(async () => (attempt ? [attempt] : [])),
    question: { findFirst: jest.fn(async () => question) },
    attemptAnswer: { upsert },
  };
  const prisma = {
    $transaction: jest.fn(
      async (
        cbOrOps:
          | ((tx: FakeTx) => Promise<unknown>)
          | Array<Prisma.PrismaPromise<unknown>>,
      ) => {
        if (typeof cbOrOps === "function") return cbOrOps(tx);
        return Promise.all(cbOrOps);
      },
    ),
  } as unknown as PrismaService;
  return prisma;
}

const OK_ATTEMPT: LockedRow = {
  id: ATTEMPT_ID,
  scenario_id: SCENARIO_ID,
  trainee_user_id: TRAINEE_ID,
  locked: false,
  submitted_at: null,
  max_score: 7,
};

const MC_QUESTION = {
  id: QUESTION_ID,
  type: "multi_choice" as const,
  optionsJson: {
    options: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" },
      { id: "c", label: "Charlie" },
    ],
    allowMultiple: true,
  },
};

const grading = new GradingService();

describe("AttemptsService.saveAnswer — validation", () => {
  it("404s when attempt missing", async () => {
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: null, question: null }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["a"] } },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("403s when caller is not the owning trainee", async () => {
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: MC_QUESTION }),
      grading,
    );
    await expect(
      svc.saveAnswer(
        "trainee",
        "different-user-id",
        ATTEMPT_ID,
        QUESTION_ID,
        { response: { type: "multi_choice", data: { selectedIds: ["a"] } } },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("403s when caller is an instructor (read-only role)", async () => {
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: MC_QUESTION }),
      grading,
    );
    await expect(
      svc.saveAnswer("instructor", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["a"] } },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("409s when the attempt is already locked", async () => {
    const locked = { ...OK_ATTEMPT, locked: true, submitted_at: new Date() };
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: locked, question: MC_QUESTION }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["a"] } },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("409s when response type mismatches question type", async () => {
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: MC_QUESTION }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "short_answer", data: { text: "nope" } },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("400s when selecting an unknown option id", async () => {
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: MC_QUESTION }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["bogus"] } },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("400s when picking 2+ on a single-select question (allowMultiple=false)", async () => {
    const singleSelect = {
      ...MC_QUESTION,
      optionsJson: {
        options: MC_QUESTION.optionsJson.options,
        allowMultiple: false,
      },
    };
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: singleSelect }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["a", "b"] } },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("409s when the MC question's optionsJson is misconfigured", async () => {
    const bad = { ...MC_QUESTION, optionsJson: { not: "valid" } };
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: bad }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["a"] } },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("404s when the question doesn't belong to the attempt's scenario", async () => {
    // findFirst returns null because the WHERE includes scenarioId.
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: null }),
      grading,
    );
    await expect(
      svc.saveAnswer("trainee", TRAINEE_ID, ATTEMPT_ID, QUESTION_ID, {
        response: { type: "multi_choice", data: { selectedIds: ["a"] } },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("happy path: valid MC selection upserts and returns the payload", async () => {
    const svc = new AttemptsService(
      makeFakePrisma({ attempt: OK_ATTEMPT, question: MC_QUESTION }),
      grading,
    );
    const r = await svc.saveAnswer(
      "trainee",
      TRAINEE_ID,
      ATTEMPT_ID,
      QUESTION_ID,
      { response: { type: "multi_choice", data: { selectedIds: ["a", "c"] } } },
    );
    expect(r.questionId).toBe(QUESTION_ID);
    expect(r.autoScore).toBeNull();
  });
});
