import { Injectable } from "@nestjs/common";
import {
  LANE_LABELS,
  MeDailyResponse,
  MeStatsResponse,
  SkillArea,
  SkillAreaProgress,
  CalibrationStats,
  StreakStats,
  type Lane,
  type MeDailySuggestion,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import { createHash } from "node:crypto";

// Canonical list of skill areas. The contract enum is authoritative;
// we iterate it here so the response always has one row per area
// (including the ones the user hasn't touched -- the UI grid is
// stable that way).
const SKILL_AREAS = SkillArea.options;

// Calibration grade thresholds. First-pass values; tune once we
// see real distributions across the cohort. The "—" grade is
// reserved for users with zero confidence questions answered yet.
function gradeFromPercent(
  totalConfidenceQuestions: number,
  percentInRange: number,
): CalibrationStats["grade"] {
  if (totalConfidenceQuestions === 0) return "—";
  if (percentInRange >= 90) return "A";
  if (percentInRange >= 80) return "A-";
  if (percentInRange >= 70) return "B";
  if (percentInRange >= 60) return "B-";
  if (percentInRange >= 50) return "C";
  if (percentInRange >= 40) return "D";
  return "F";
}

// Compute streak metrics from a sorted-DESC list of UTC-day strings
// (YYYY-MM-DD) on which the user had any activity. Exported so the
// spec can exercise it directly with synthetic day sets.
//
// The "today" arg is the UTC date the call is made on (also a
// YYYY-MM-DD string); the spec passes it explicitly so the tests
// don't depend on the wall clock.
export function computeStreak(
  activeDaysDesc: string[],
  today: string,
): StreakStats {
  if (activeDaysDesc.length === 0) {
    return { currentDays: 0, longestDays: 0, lastActiveOn: null };
  }
  const set = new Set(activeDaysDesc);
  const mostRecent = activeDaysDesc[0]!;

  // Current streak: walk back from today. Tolerate "active yesterday
  // but not yet today" so the streak doesn't visibly reset at the
  // local-midnight UTC rollover.
  let current = 0;
  const yesterday = addDays(today, -1);
  if (set.has(today) || set.has(yesterday)) {
    let cursor = set.has(today) ? today : yesterday;
    while (set.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  // Longest streak: walk the sorted-ASC distinct days, find the
  // longest run of consecutive day-after-day pairs.
  const ascending = [...activeDaysDesc].reverse();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < ascending.length; i++) {
    if (ascending[i] === addDays(ascending[i - 1]!, 1)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return {
    currentDays: current,
    longestDays: longest,
    lastActiveOn: mostRecent,
  };
}

// Helper: shift a YYYY-MM-DD string by N days (positive or
// negative). UTC arithmetic; the input is treated as midnight UTC.
function addDays(yyyymmdd: string, delta: number): string {
  const d = new Date(`${yyyymmdd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Helper: today's UTC date as YYYY-MM-DD.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class MeStatsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /v1/me/stats
  async compute(userId: string): Promise<MeStatsResponse> {
    const [totals, skillAreaProgress, calibration, streak] = await Promise.all([
      this.computeTotals(userId),
      this.computeSkillAreaProgress(userId),
      this.computeCalibration(userId),
      this.computeStreakFromDb(userId),
    ]);
    return MeStatsResponse.parse({
      totals,
      skillAreaProgress,
      calibration,
      streak,
    });
  }

  private async computeTotals(userId: string) {
    const [progressRows, responseAgg, responseCorrect] = await Promise.all([
      this.prisma.scenarioProgress.findMany({
        where: { userId },
        select: { completedAt: true },
      }),
      this.prisma.questionResponse.count({
        where: { progress: { userId } },
      }),
      this.prisma.questionResponse.count({
        where: { progress: { userId }, completedAt: { not: null } },
      }),
    ]);
    return {
      scenariosStarted: progressRows.length,
      scenariosCompleted: progressRows.filter((r) => r.completedAt !== null).length,
      questionsAnswered: responseAgg,
      questionsCorrect: responseCorrect,
    };
  }

  // Per-skill-area aggregation. Restricted to published scenarios so
  // totals are stable (drafts shouldn't move the user's "skill area
  // progress" denominator around as authors iterate).
  private async computeSkillAreaProgress(
    userId: string,
  ): Promise<SkillAreaProgress[]> {
    // Pull every published question with its scenario's skill areas;
    // also pull the user's correct responses for those questions.
    // Aggregating in memory keeps the SQL trivial vs an array-unnest
    // group-by, at the cost of ~one row per published question per
    // request. Catalogue is <2k questions, so this is cheap.
    const [questions, correctResponses] = await Promise.all([
      this.prisma.question.findMany({
        where: { scenario: { status: "published" } },
        select: { id: true, scenario: { select: { skillAreas: true } } },
      }),
      this.prisma.questionResponse.findMany({
        where: {
          progress: { userId },
          completedAt: { not: null },
          question: { scenario: { status: "published" } },
        },
        select: { questionId: true },
      }),
    ]);

    const correctIds = new Set(correctResponses.map((r) => r.questionId));
    const totalsBySkill = new Map<string, number>();
    const correctBySkill = new Map<string, number>();

    for (const q of questions) {
      const isCorrect = correctIds.has(q.id);
      for (const sa of q.scenario.skillAreas as SkillArea[]) {
        totalsBySkill.set(sa, (totalsBySkill.get(sa) ?? 0) + 1);
        if (isCorrect) {
          correctBySkill.set(sa, (correctBySkill.get(sa) ?? 0) + 1);
        }
      }
    }

    return SKILL_AREAS.map((sa) => {
      const total = totalsBySkill.get(sa) ?? 0;
      const correct = correctBySkill.get(sa) ?? 0;
      const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
      return {
        skillArea: sa,
        questionsCorrect: correct,
        questionsTotal: total,
        percentComplete: percent,
      };
    });
  }

  // Calibration: for every confidence-type question the user has
  // answered, check whether the response value landed inside the
  // configured expectedRange.
  private async computeCalibration(userId: string): Promise<CalibrationStats> {
    const rows = await this.prisma.questionResponse.findMany({
      where: {
        progress: { userId },
        responseJson: { not: undefined as never },
        question: { type: "confidence" },
      },
      select: {
        responseJson: true,
        question: { select: { answerKey: { select: { expectedJson: true } } } },
      },
    });

    let total = 0;
    let within = 0;
    for (const r of rows) {
      const value = extractConfidenceValue(r.responseJson);
      const range = extractExpectedRange(
        r.question.answerKey?.expectedJson ?? null,
      );
      if (value === null || range === null) continue;
      total++;
      if (value >= range[0] && value <= range[1]) within++;
    }
    const percent = total === 0 ? 0 : Math.round((within / total) * 100);
    return {
      totalConfidenceQuestions: total,
      withinRange: within,
      percentInRange: percent,
      grade: gradeFromPercent(total, percent),
    };
  }

  // Streak: distinct UTC-calendar-days on which the user submitted
  // any response.
  private async computeStreakFromDb(userId: string): Promise<StreakStats> {
    const responses = await this.prisma.questionResponse.findMany({
      where: { progress: { userId } },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const distinct = new Set<string>();
    for (const r of responses) {
      distinct.add(r.updatedAt.toISOString().slice(0, 10));
    }
    const desc = [...distinct].sort((a, b) => (a < b ? 1 : -1));
    return computeStreak(desc, todayUtc());
  }

  // GET /v1/me/daily
  //
  // "Today's challenge" recommendation. Picks one published
  // scenario the user has NOT yet completed, weighted toward
  // their weakest skill areas (lowest percentComplete in
  // computeSkillAreaProgress). Deterministic per (userId, UTC
  // date): a refresh during the day returns the same pick;
  // tomorrow's pick rotates.
  async computeDaily(userId: string): Promise<MeDailyResponse> {
    const date = todayUtc();

    // Reuse the same skill-area scores we surface on /me/stats so
    // the "why this one" copy lines up with the dashboard.
    const skillAreaProgress = await this.computeSkillAreaProgress(userId);
    const weaknessByArea = new Map<SkillArea, number>();
    for (const row of skillAreaProgress) {
      // Weakness score: 100 - percentComplete. Skills the user
      // hasn't touched (0%) score 100; mastered skills score 0.
      weaknessByArea.set(row.skillArea, 100 - row.percentComplete);
    }

    // Candidate pool: published scenarios the user hasn't completed.
    // "Completed" means ScenarioProgress.completedAt is set.
    const candidates = await this.prisma.scenario.findMany({
      where: {
        status: "published",
        progress: {
          none: { userId, completedAt: { not: null } },
        },
      },
      select: {
        slug: true,
        title: true,
        lane: true,
        skillAreas: true,
      },
    });

    if (candidates.length === 0) {
      return MeDailyResponse.parse({ suggestion: null, forDate: date });
    }

    // Score each candidate by the max weakness across its skill
    // areas (so a scenario in the user's weakest tagged area
    // surfaces, even if its OTHER tags overlap with stronger
    // areas). Tie-broken deterministically.
    type Scored = {
      slug: string;
      title: string;
      lane: Lane;
      skillAreas: SkillArea[];
      score: number;
      weakestArea: SkillArea | null;
    };
    const scored: Scored[] = candidates.map((c) => {
      const areas = c.skillAreas as SkillArea[];
      let bestScore = 0;
      let bestArea: SkillArea | null = null;
      for (const a of areas) {
        const w = weaknessByArea.get(a) ?? 100;
        if (w > bestScore) {
          bestScore = w;
          bestArea = a;
        }
      }
      return {
        slug: c.slug,
        title: c.title,
        lane: c.lane as Lane,
        skillAreas: areas,
        score: bestScore,
        weakestArea: bestArea,
      };
    });

    // Sort by score desc, then slug asc for stability.
    scored.sort((a, b) =>
      a.score !== b.score ? b.score - a.score : a.slug.localeCompare(b.slug),
    );

    // Pick from the top-K so the daily refresh actually varies.
    // K = min(5, candidate count). Use a (userId + date) hash to
    // index into that window so the choice is stable for the day.
    const K = Math.min(5, scored.length);
    const window = scored.slice(0, K);
    const idx = deterministicIndex(`${userId}|${date}`, K);
    const pick = window[idx]!;

    const reason = pick.weakestArea
      ? `From your weakest skill area: ${labelFor(pick.weakestArea)}.`
      : "A fresh scenario for today.";

    const suggestion: MeDailySuggestion = {
      scenarioSlug: pick.slug,
      scenarioTitle: pick.title,
      laneSlug: pick.lane,
      laneLabel: LANE_LABELS[pick.lane],
      reason,
    };
    return MeDailyResponse.parse({ suggestion, forDate: date });
  }
}

// Human-readable skill-area label for the "why this one?" copy.
// We can't import SKILL_AREA_LABELS from contracts and re-export
// here without re-exporting the dependency tree; inline the seven
// we ship instead. Keep the casing aligned with apps/web.
function labelFor(area: SkillArea): string {
  const map: Record<SkillArea, string> = {
    email_headers: "Email Headers",
    bec: "BEC",
    df_artifacts: "DF Artifacts",
    removable_media: "Removable Media",
    windows_artifacts: "Windows Artifacts",
    linux_artifacts: "Linux Artifacts",
    macos_artifacts: "macOS Artifacts",
    malware_analysis: "Malware Analysis",
    network_logs: "Network Logs",
    account_compromise: "Account Compromise",
    rf_awareness: "Signals Awareness",
    report_writing: "Report Writing",
    inference_discipline: "Reasoning Discipline",
  };
  return map[area];
}

// Deterministic index: hash the seed, take the first 8 hex chars,
// modulo by N. Used so the daily pick is stable within a day but
// rotates across days.
function deterministicIndex(seed: string, n: number): number {
  if (n <= 1) return 0;
  const h = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  const i = parseInt(h, 16);
  return i % n;
}

// Local helpers for response/answer-key JSON shape. The confidence
// grading logic in grading.service.ts already enforces the shape on
// submit; we re-check here only because we're reading historical
// rows and shouldn't crash if any are malformed.

function extractConfidenceValue(payload: unknown): number | null {
  if (payload == null || typeof payload !== "object") return null;
  // Submit wraps the value under a "data" envelope. Tolerate both.
  const data =
    "data" in payload && payload.data != null && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : (payload as Record<string, unknown>);
  const v = data.value;
  return typeof v === "number" ? v : null;
}

function extractExpectedRange(
  expectedJson: unknown,
): [number, number] | null {
  if (expectedJson == null || typeof expectedJson !== "object") return null;
  const obj = expectedJson as Record<string, unknown>;
  const range = obj.expectedRange;
  if (!Array.isArray(range) || range.length !== 2) return null;
  const lo = range[0];
  const hi = range[1];
  if (typeof lo !== "number" || typeof hi !== "number") return null;
  return [lo, hi];
}
