import { z } from "zod";

// Keep this enum in sync with `enum SkillArea` in
// apps/api/prisma/schema.prisma. The Prisma migration is the source of
// truth at the DB layer; this Zod enum mirrors it for cross-cutting
// validation in the API + web layers.
export const SkillArea = z.enum([
  "email_headers",
  "bec",
  "df_artifacts",
  "removable_media",
  "windows_artifacts",
  "network_logs",
  "account_compromise",
  "rf_awareness",
  "report_writing",
  "inference_discipline",
]);
export type SkillArea = z.infer<typeof SkillArea>;

// rf_awareness is an *awareness-only* module per project scope. UI code
// uses this to render the escalation disclaimer at the top of the brief
// and debrief; the seed/import paths use it to require a disclaimer.
export const AWARENESS_ONLY_SKILL_AREAS = ["rf_awareness"] as const satisfies
  readonly SkillArea[];

export function isAwarenessOnly(area: SkillArea): boolean {
  return (AWARENESS_ONLY_SKILL_AREAS as readonly string[]).includes(area);
}

export const ScenarioStatus = z.enum(["draft", "published", "archived"]);
export type ScenarioStatus = z.infer<typeof ScenarioStatus>;

export const ScenarioSource = z.enum(["authored", "imported"]);
export type ScenarioSource = z.infer<typeof ScenarioSource>;

export const Difficulty = z.number().int().min(1).max(5);
export type Difficulty = z.infer<typeof Difficulty>;

// Trimmed shape for catalog listings — no brief body, smaller payloads.
export const ScenarioListItem = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  skillAreas: z.array(SkillArea).min(1),
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().positive().nullable(),
  tags: z.array(z.string()),
  status: ScenarioStatus,
  source: ScenarioSource,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ScenarioListItem = z.infer<typeof ScenarioListItem>;

export const ScenarioListResponse = z.object({
  scenarios: z.array(ScenarioListItem),
  total: z.number().int().nonnegative(),
});
export type ScenarioListResponse = z.infer<typeof ScenarioListResponse>;

// Detail view includes the brief markdown + optional awareness disclaimer.
// Artifacts and questions land in later milestones.
//
// Size caps are deliberately large but finite: 100 KB of markdown is many
// pages of prose (Moby Dick chapter 1 is ~30 KB), so any legitimate brief
// fits, while a malformed pack import or a buggy authoring path can't
// stream multi-megabyte payloads through the API or the renderer.
export const MAX_BRIEF_MARKDOWN_BYTES = 100_000;
export const MAX_DISCLAIMER_MARKDOWN_BYTES = 20_000;

export const ScenarioBriefPayload = z.object({
  markdownBody: z.string().max(MAX_BRIEF_MARKDOWN_BYTES),
  disclaimerMd: z.string().max(MAX_DISCLAIMER_MARKDOWN_BYTES).nullable(),
});
export type ScenarioBriefPayload = z.infer<typeof ScenarioBriefPayload>;

export const ScenarioDetail = ScenarioListItem.extend({
  brief: ScenarioBriefPayload.nullable(),
});
export type ScenarioDetail = z.infer<typeof ScenarioDetail>;

// Query parameters for GET /v1/scenarios. All optional. The API filters
// trainees down to status=published regardless of what they send.
export const ScenarioListQuery = z.object({
  skillArea: SkillArea.optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  tag: z.string().min(1).max(60).optional(),
  status: ScenarioStatus.optional(),
});
export type ScenarioListQuery = z.infer<typeof ScenarioListQuery>;
