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

// Keep in sync with `enum ArtifactKind` in apps/api/prisma/schema.prisma.
// M3 supports text, csv, json, pdf, image. EML lands in M4; pcap/disk
// images / Windows registry slabs come later.
export const ArtifactKind = z.enum(["text", "csv", "json", "pdf", "image"]);
export type ArtifactKind = z.infer<typeof ArtifactKind>;

// Per-kind rendering hints. UI viewer dispatch is driven by `kind`; the
// mime type is shown to trainees but does not pick the renderer (some
// .csv files arrive as text/plain in real-world tooling).
export function defaultMimeFor(kind: ArtifactKind): string {
  switch (kind) {
    case "text": return "text/plain; charset=utf-8";
    case "csv":  return "text/csv; charset=utf-8";
    case "json": return "application/json; charset=utf-8";
    case "pdf":  return "application/pdf";
    case "image": return "application/octet-stream"; // overridden by stored mime
  }
}

// Only these image MIME types may be served inline. SVG is intentionally
// excluded — SVG documents can carry JavaScript, which combined with
// `Content-Disposition: inline` would create an XSS surface even with a
// strict CSP. Everything else (kind=image with a stored MIME we don't
// recognize) is downgraded to an octet-stream attachment by the API.
export const ALLOWED_IMAGE_MIMES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

// Canonical Content-Type the API serves for a given artifact, *independent*
// of whatever the DB row claims. This means a stale/imported/malicious
// MIME (e.g. `text/html` or `application/javascript` recorded for kind=text)
// cannot get a renderable Content-Type past the API. Returns the serving
// MIME and whether the browser should render inline (PDF + allowed
// images) vs download (everything else, including any rejected image).
export function safeServeMimeFor(
  kind: ArtifactKind,
  storedMime: string,
): { mime: string; inline: boolean } {
  switch (kind) {
    case "text": return { mime: "text/plain; charset=utf-8", inline: false };
    case "csv":  return { mime: "text/csv; charset=utf-8",   inline: false };
    case "json": return { mime: "application/json; charset=utf-8", inline: false };
    case "pdf":  return { mime: "application/pdf",           inline: true  };
    case "image": {
      const normalized = (storedMime.split(";")[0] ?? "").trim().toLowerCase();
      if (ALLOWED_IMAGE_MIMES.has(normalized)) {
        return { mime: normalized, inline: true };
      }
      // Unknown image MIME → don't render inline. Serve as a download
      // so the browser doesn't try to interpret it.
      return { mime: "application/octet-stream", inline: false };
    }
  }
}

export const ArtifactListItem = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  displayName: z.string().min(1).max(200),
  kind: ArtifactKind,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1).max(120),
  viewerHint: z.string().max(60).nullable(),
  createdAt: z.string().datetime(),
});
export type ArtifactListItem = z.infer<typeof ArtifactListItem>;

export const ScenarioSource = z.enum(["authored", "imported"]);
export type ScenarioSource = z.infer<typeof ScenarioSource>;

export const Difficulty = z.number().int().min(1).max(5);
export type Difficulty = z.infer<typeof Difficulty>;

// Slug constraint shared by every endpoint that takes a slug route param.
// Lowercase, digits, hyphens; must start with an alphanumeric (no leading
// hyphen); max 120 to match the VARCHAR(120) DB column. Validation runs
// before any DB lookup so malformed input fails fast — defense in depth
// against the slug being smuggled into a path or query at a future date.
export const ScenarioSlug = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Slug must be lowercase alphanumeric with hyphens.",
  );
export type ScenarioSlug = z.infer<typeof ScenarioSlug>;

// Trimmed shape for catalog listings — no brief body, smaller payloads.
export const ScenarioListItem = z.object({
  id: z.string().uuid(),
  slug: ScenarioSlug,
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
  artifacts: z.array(ArtifactListItem),
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
