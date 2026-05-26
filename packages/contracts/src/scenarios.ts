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

// Display labels for skill-area chips in the UI. The enum keys
// are storage values; users see the right-hand strings.
export const SKILL_AREA_LABELS: Record<SkillArea, string> = {
  email_headers: "Email Headers",
  bec: "BEC",
  df_artifacts: "DF Artifacts",
  removable_media: "Removable Media",
  windows_artifacts: "Windows Artifacts",
  network_logs: "Network Logs",
  account_compromise: "Account Compromise",
  rf_awareness: "RF Awareness",
  report_writing: "Report Writing",
  inference_discipline: "Reasoning Discipline",
};

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
export const ArtifactKind = z.enum([
  "text",
  "csv",
  "json",
  "pdf",
  "image",
  "eml",
  "pcap",
]);
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
    case "eml":  return "message/rfc822";
    case "pcap": return "application/vnd.tcpdump.pcap";
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
    case "eml":
      // .eml files are downloaded as attachments. The renderable view
      // comes from the parsed JSON endpoint, not from streaming the
      // raw bytes through a viewer.
      return { mime: "message/rfc822", inline: false };
    case "pcap":
      // Always download; we never render PCAP inline. The user opens
      // it in Wireshark / tshark / their preferred tooling.
      return { mime: "application/vnd.tcpdump.pcap", inline: false };
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

// curated challenge-library lanes. Mirrors the Lane Prisma
// enum exactly — keep in sync with apps/api/prisma/schema.prisma.
// The order here is the canonical user-facing display order for
// the lane overview at /scenarios.
export const Lane = z.enum([
  "ojt_bridge",
  "foundations",
  "email_bec",
  "windows_artifacts",
  "removable_media_spillage",
  "insider_risk",
  "network_logs",
  "memory_forensics",
  "mobile_forensics",
  "rf_awareness",
  "evidence_handling",
  "report_writing",
]);
export type Lane = z.infer<typeof Lane>;

export const LANE_LABELS: Record<Lane, string> = {
  ojt_bridge: "OJT Bridge",
  foundations: "Foundations",
  email_bec: "Email & BEC",
  windows_artifacts: "Windows Artifacts",
  removable_media_spillage: "Removable Media / Spillage",
  insider_risk: "Insider Threat",
  network_logs: "Network & Logs",
  memory_forensics: "Memory Forensics",
  mobile_forensics: "Mobile Forensics",
  rf_awareness: "RF Awareness",
  evidence_handling: "Evidence Handling",
  report_writing: "Report Writing",
};

export const LANE_DESCRIPTIONS: Record<Lane, string> = {
  ojt_bridge:
    "Short bridge scenarios for new CDTIs who have completed introductory coursework. Practice turning familiar tool outputs into evidence-safe findings.",
  foundations:
    "Core DF concepts every analyst needs first — hashes, MAC times, magic bytes, custody fundamentals.",
  email_bec:
    "Business Email Compromise (BEC) and phishing triage. Read headers, attachments, and lure mechanics; separate spoof from compromise.",
  windows_artifacts:
    "Windows-specific artifacts: execution evidence, registry, recent files, Windows 11 additions.",
  removable_media_spillage:
    "USB / removable-media handling and the spillage scenarios that come with it.",
  insider_risk:
    "Insider-threat indicator triage for leaving employees and unusual access patterns. Anomaly-vs-finding discipline.",
  network_logs:
    "Reading access logs, flow records, and host-side network telemetry without over-claiming.",
  memory_forensics:
    "Volatility 3 reads of a memory image. Triage the process tree, network connections, and suspicious memory regions; separate \"this looks off\" from \"this is malware.\"",
  mobile_forensics:
    "Mobile-device extraction triage — Cellebrite UFED, GrayKey, Magnet AXIOM. Read what the tool actually got; decide what an extraction can and cannot prove.",
  rf_awareness:
    "Awareness-level RF observation reporting. Not TSCM training.",
  evidence_handling:
    "Custody documents, descriptive vs speculative wording, and the corrective steps when a chain has gaps.",
  report_writing:
    "Turning what the artifacts prove into defensible written findings.",
};

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
 // curated-library projection.
  lane: Lane,
  module: z.string().nullable(),
  sequence: z.number().int().nonnegative(),
  // M22 per-user progress projection. Always present on listing
  // calls made by an authenticated user (which is every call this
  // endpoint serves, since the route is auth-guarded). Zero is
  // "user has not solved any question on this scenario."
  // `totalQuestions` equals 0 only for an in-progress draft an
  // admin is previewing.
  completedQuestions: z.number().int().nonnegative(),
  totalQuestions: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ScenarioListItem = z.infer<typeof ScenarioListItem>;

// lane overview: one row per lane summarising counts and the
// authenticated user's progress. Drives the new /scenarios page.
export const LaneSummary = z.object({
  lane: Lane,
  label: z.string(),
  description: z.string(),
  publishedScenarioCount: z.number().int().nonnegative(),
  completedScenarioCount: z.number().int().nonnegative(),
  inProgressScenarioCount: z.number().int().nonnegative(),
});
export type LaneSummary = z.infer<typeof LaneSummary>;

export const LaneOverviewResponse = z.object({
  lanes: z.array(LaneSummary),
});
export type LaneOverviewResponse = z.infer<typeof LaneOverviewResponse>;

export const ScenarioListResponse = z.object({
  scenarios: z.array(ScenarioListItem),
  total: z.number().int().nonnegative(),
});
export type ScenarioListResponse = z.infer<typeof ScenarioListResponse>;

// Detail view includes the brief markdown + optional awareness disclaimer.
// Artifacts and questions land in later milestones.
//
// Size caps are deliberately large but finite: 100 000 characters of
// markdown is many pages of prose (Moby Dick chapter 1 is ~30 000),
// so any legitimate brief fits, while a malformed pack import or a
// buggy authoring path can't stream multi-megabyte payloads through
// the API or the renderer. The unit is JS string length (UTF-16 code
// units) — matches Zod's `.max()` semantics. For ASCII this equals
// bytes; for multi-byte characters it's a closer match to "render
// cost" than a true byte cap.
export const MAX_BRIEF_MARKDOWN_CHARS = 100_000;
export const MAX_DISCLAIMER_MARKDOWN_CHARS = 20_000;

export const ScenarioBriefPayload = z.object({
  markdownBody: z.string().max(MAX_BRIEF_MARKDOWN_CHARS),
  disclaimerMd: z.string().max(MAX_DISCLAIMER_MARKDOWN_CHARS).nullable(),
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
 // filter to a single lane.
  lane: Lane.optional(),
});
export type ScenarioListQuery = z.infer<typeof ScenarioListQuery>;
