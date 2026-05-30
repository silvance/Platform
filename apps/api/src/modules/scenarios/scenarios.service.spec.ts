import { NotFoundException } from "@nestjs/common";
import { ScenariosService } from "./scenarios.service";
import type { PrismaService } from "../database/prisma.service";

// Minimal in-memory fake of the Prisma surface area used by
// ScenariosService. We're testing the where-clause shape and the
// role-gating semantics, not Prisma itself.
function makeFakePrisma(rows: Array<Record<string, unknown>>) {
  const captured: { findManyArgs?: unknown; countArgs?: unknown } = {};

  const filter = (where: Record<string, unknown> | undefined) => {
    if (!where) return rows;
    return rows.filter((r) => {
      for (const [k, v] of Object.entries(where)) {
        const rv = r[k];
        if (v && typeof v === "object" && "in" in (v as object)) {
          const allowed = (v as { in: unknown[] }).in;
          if (!allowed.includes(rv)) return false;
        } else if (v && typeof v === "object" && "has" in (v as object)) {
          const needle = (v as { has: unknown }).has;
          if (!Array.isArray(rv) || !rv.includes(needle)) return false;
        } else {
          if (rv !== v) return false;
        }
      }
      return true;
    });
  };

  return {
    captured,
    prisma: {
      $transaction: async (operations: unknown[]) => Promise.all(operations),
      scenario: {
        findMany: jest.fn(async (args?: { where?: Record<string, unknown>; orderBy?: unknown }) => {
          captured.findManyArgs = args;
          // M22 list path: include _count so the no-progress
          // fallback can read total question count.
          return filter(args?.where).map((r) => ({
            _count: { questions: 0 },
            ...r,
          }));
        }),
        count: jest.fn(async (args?: { where?: Record<string, unknown> }) => {
          captured.countArgs = args;
          return filter(args?.where).length;
        }),
        findUnique: jest.fn(async (args: { where: { slug: string }; include?: unknown }) => {
          const row = rows.find((r) => r["slug"] === args.where.slug);
          if (!row) return null;
          // Service expects `artifacts` + `_count` to be present when
          // include sets them; defaults keep older tests passing.
          return { artifacts: [], _count: { questions: 0 }, ...row };
        }),
      },
      // M22: empty progress table — every row falls back to the
      // (0, _count.questions) default in toListItem.
      scenarioProgress: {
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => null),
      },
    } as unknown as PrismaService,
  };
}

const BASE_ROW = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "x",
  title: "X",
  summary: "x",
  skillAreas: ["email_headers"],
  difficulty: 2,
  estimatedMinutes: 30,
  authorUserId: null,
  version: 1,
  status: "published",
  source: "authored",
  importedPackHash: null,
  tags: ["a"],
 // curated-library defaults — every row mocked through these
  // tests carries a lane so the toListItem mapper has something to
  // serialise.
  lane: "foundations" as const,
  module: null as string | null,
  sequence: 0,
  // M21b review defaults (every row mocked here goes through the
  // user-facing path which doesn't read these, but the toListItem
  // mapper now also needs lane/module/sequence which it does read).
  reviewStatus: "needs_review",
  reviewNotes: null as string | null,
  reviewedAt: null as Date | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ScenariosService (unit)", () => {
  describe("list — role gating", () => {
    it("trainees only see published scenarios, even if they pass status=draft", async () => {
      const { prisma, captured } = makeFakePrisma([
        { ...BASE_ROW, slug: "pub", status: "published" },
        { ...BASE_ROW, slug: "drft", status: "draft" },
        { ...BASE_ROW, slug: "arch", status: "archived" },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.list("user", "test-user-id", { status: "draft" });
      expect(res.scenarios.map((s) => s.slug)).toEqual(["pub"]);
      expect((captured.findManyArgs as { where: { status: string } }).where.status).toBe(
        "published",
      );
    });

    it("instructors see draft + published by default, hiding archived", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, slug: "pub", status: "published" },
        { ...BASE_ROW, slug: "drft", status: "draft" },
        { ...BASE_ROW, slug: "arch", status: "archived" },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.list("admin", "test-admin-id", {});
      expect(res.scenarios.map((s) => s.slug).sort()).toEqual(["drft", "pub"]);
    });

    it("instructors can explicitly request archived", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, slug: "pub", status: "published" },
        { ...BASE_ROW, slug: "arch", status: "archived" },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.list("admin", "test-admin-id", { status: "archived" });
      expect(res.scenarios.map((s) => s.slug)).toEqual(["arch"]);
    });
  });

  describe("list — filters", () => {
    it("filters by skillArea via array `has`", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, slug: "a", skillAreas: ["email_headers", "bec"] },
        { ...BASE_ROW, slug: "b", skillAreas: ["rf_awareness"] },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.list("user", "test-user-id", { skillArea: "rf_awareness" });
      expect(res.scenarios.map((s) => s.slug)).toEqual(["b"]);
    });

    it("filters by tag", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, slug: "a", tags: ["phishing"] },
        { ...BASE_ROW, slug: "b", tags: ["rf"] },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.list("user", "test-user-id", { tag: "rf" });
      expect(res.scenarios.map((s) => s.slug)).toEqual(["b"]);
    });

    it("filters by difficulty", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, slug: "a", difficulty: 2 },
        { ...BASE_ROW, slug: "b", difficulty: 4 },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.list("user", "test-user-id", { difficulty: 4 });
      expect(res.scenarios.map((s) => s.slug)).toEqual(["b"]);
    });
  });

  describe("getBySlug — role gating", () => {
    it("trainees get 404 (not 403) when accessing a draft, to avoid leaking existence", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, slug: "secret-draft", status: "draft", brief: null },
      ]);
      const svc = new ScenariosService(prisma);
      await expect(svc.getBySlug("user", "test-user-id", "secret-draft")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("instructors can fetch a draft", async () => {
      const { prisma } = makeFakePrisma([
        {
          ...BASE_ROW,
          slug: "secret-draft",
          status: "draft",
          brief: { markdownBody: "# hi", disclaimerMd: null },
        },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.getBySlug("admin", "test-admin-id", "secret-draft");
      expect(res.slug).toBe("secret-draft");
      expect(res.brief?.markdownBody).toBe("# hi");
    });

    it("404 for an unknown slug regardless of role", async () => {
      const { prisma } = makeFakePrisma([]);
      const svc = new ScenariosService(prisma);
      await expect(svc.getBySlug("admin", "test-admin-id", "nope")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns disclaimerMd on the brief when present", async () => {
      const { prisma } = makeFakePrisma([
        {
          ...BASE_ROW,
          slug: "rf",
          brief: { markdownBody: "# brief", disclaimerMd: "> awareness only" },
        },
      ]);
      const svc = new ScenariosService(prisma);
      const res = await svc.getBySlug("user", "test-user-id", "rf");
      expect(res.brief?.disclaimerMd).toBe("> awareness only");
    });
  });

  describe("laneOverview", () => {
    it("returns one row per Lane enum value with counts of published scenarios", async () => {
      const { prisma } = makeFakePrisma([
        { ...BASE_ROW, id: "1", slug: "a", lane: "foundations" },
        { ...BASE_ROW, id: "2", slug: "b", lane: "foundations" },
        { ...BASE_ROW, id: "3", slug: "c", lane: "windows_artifacts" },
        // archived rows should NOT count
        { ...BASE_ROW, id: "4", slug: "d", lane: "windows_artifacts", status: "archived" },
      ]);
      const svc = new ScenariosService(prisma);
      const { lanes } = await svc.laneOverview("user", "test-user-id");

      // 15 canonical lanes returned regardless of contents
      // (ojt_bridge, foundations, email_bec, windows_artifacts,
      // linux_forensics, macos_forensics, removable_media_spillage,
      // insider_risk, network_logs, memory_forensics,
      // malware_analysis, mobile_forensics, rf_awareness,
      // evidence_handling, report_writing).
      expect(lanes).toHaveLength(15);
      const foundations = lanes.find((l) => l.lane === "foundations");
      const win = lanes.find((l) => l.lane === "windows_artifacts");
      const empty = lanes.find((l) => l.lane === "rf_awareness");
      expect(foundations?.publishedScenarioCount).toBe(2);
      expect(win?.publishedScenarioCount).toBe(1); // archived excluded
      expect(empty?.publishedScenarioCount).toBe(0);
      expect(empty?.completedScenarioCount).toBe(0);
    });
  });
});
