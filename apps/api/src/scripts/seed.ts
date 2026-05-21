import "reflect-metadata";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PrismaClient, type Role, type ArtifactKind } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";

// Standalone seed runner. Creates one instructor and one trainee with
// freshly-generated passwords, upserts the two demonstration scenarios,
// and writes their artifact bytes into the storage root.
//
// Usage (host):  pnpm --filter @ci-train/api seed
// Usage (docker): docker compose run --rm api node dist/scripts/seed.js

const SEED_INSTRUCTOR_EMAIL =
  process.env.SEED_INSTRUCTOR_EMAIL ?? "instructor@example.local";
const SEED_TRAINEE_EMAIL =
  process.env.SEED_TRAINEE_EMAIL ?? "trainee@example.local";
const STORAGE_ROOT = resolve(
  process.env.ARTIFACT_STORAGE_ROOT ?? "/data/artifacts",
);

const ARGON_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

function randomPassword(): string {
  return randomBytes(18).toString("base64url");
}

async function upsertUser(
  prisma: PrismaClient,
  email: string,
  displayName: string,
  role: Role,
): Promise<{ password: string; id: string }> {
  const password = randomPassword();
  const passwordHash = await hash(password, ARGON_OPTS);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, displayName, role, disabled: false },
    create: { email, passwordHash, displayName, role },
  });
  return { password, id: user.id };
}

const RF_AWARENESS_DISCLAIMER = `
> **Awareness module — not TSCM training.** This scenario builds
> investigative judgement around RF observations. It does **not**
> qualify you to conduct TSCM sweeps, evaluate device presence, or
> render technical findings on RF threats. When in doubt, escalate
> to qualified TSCM personnel and document observations conservatively.
`.trim();

interface ArtifactSeed {
  ordinal: number;
  displayName: string;
  kind: ArtifactKind;
  mimeType: string;
  bytes: Buffer;
}

interface ScenarioSeed {
  slug: string;
  title: string;
  summary: string;
  skillAreas: string[];
  difficulty: number;
  estimatedMinutes: number;
  tags: string[];
  brief: string;
  disclaimer?: string;
  artifacts: ArtifactSeed[];
}

// A minimal but valid 1x1 transparent PNG. Tiny enough to embed inline;
// big enough to prove the image-viewer dispatch works end-to-end.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// A minimal valid one-page PDF. Hand-built to keep the seed self-
// contained (no PDF library dependency). Renders the single line of
// text "ci-train seed PDF artifact" in any standards-compliant viewer.
function buildTinyPdf(): Buffer {
  const text = "(ci-train seed PDF artifact)";
  const stream = `BT /F1 24 Tf 60 720 Td ${text} Tj ET`;
  const streamBytes = Buffer.from(stream, "ascii");

  // Object byte offsets are needed for the xref table — build the
  // body string while tracking them.
  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n",
    `4 0 obj << /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "binary");
  for (const o of objects) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(o, "binary");
  }
  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.concat([
    Buffer.from(header, "binary"),
    ...objects.map((o) => Buffer.from(o, "binary")),
    Buffer.from(xref, "binary"),
    Buffer.from(trailer, "binary"),
  ]);
}

function utf8(s: string): Buffer {
  return Buffer.from(s, "utf-8");
}

const SCENARIOS: ScenarioSeed[] = [
  {
    slug: "bec-vendor-redirect-001",
    title: "BEC: Vendor Payment Redirect",
    summary:
      "A controller in your AOR receives an urgent wire-change request from a known vendor contact. Headers and surrounding context are available. Decide what you can prove vs what you can only infer.",
    skillAreas: ["email_headers", "bec", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 45,
    tags: ["bec", "phishing", "finance", "inference"],
    brief: `
# Brief

At 14:07 local, the controller of a partner firm in your AOR received an
email purportedly from \`jane.doe@vendor.example\` — a familiar vendor
finance contact — requesting that the routing details for an outstanding
invoice be redirected to a new account.

You have been asked to triage the email and advise the controller.

## Open the artifacts

The workspace tabs hold the supporting material:

- A **24-hour slice of the partner firm's web-proxy log** (CSV).
- The **vendor's normal invoice template** (PDF).
- The **controller's contemporaneous note** of the request (plain text).
- A **machine-parsed summary** of the suspect email's key headers
  (JSON). The full \`.eml\` and an inline header parser arrive in M4.

## Goals for this scenario

In later milestones (M5), you'll be asked to:

1. Identify the indicators in the headers + proxy log that support — or
   refute — a BEC hypothesis.
2. State your confidence that this is a BEC attempt, on a 1–5 scale.
3. Recommend the next investigative step, with one sentence on *why*.
4. Draft a one-paragraph escalation note for the SAC, distinguishing
   what you can prove from what you can only infer.

## Reasoning discipline

Distinguish:

- **Proven:** authentication failures present in the headers; URLs that
  resolve to attacker-controlled infrastructure; etc.
- **Inferred:** intent, attribution, and likely scope of compromise.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "controller-note.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Date:    14:07 local",
            "Author:  J. Smith, Controller",
            "",
            "Received an email that looked like it was from jane.doe@vendor.example",
            "asking us to update the routing for invoice INV-2026-0418. Replied",
            "asking to confirm by phone but the response said she was in a meeting",
            "until tomorrow and the payment was urgent.",
            "",
            "Flagged this to CI cyber instead of routing it to AP. Not sending yet.",
            "",
            "— J.S.",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "proxy-log-24h.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "timestamp,src_ip,user,host,url,status,bytes,user_agent",
            "2026-04-18T13:51:02Z,10.4.7.18,j.smith,vendor.example,/login,200,4321,Mozilla/5.0",
            "2026-04-18T13:52:14Z,10.4.7.18,j.smith,vendor.example,/invoices/INV-2026-0418,200,18211,Mozilla/5.0",
            "2026-04-18T14:06:48Z,10.4.7.18,j.smith,vendor-lookup-alike.com,/secure-payment,200,2104,Mozilla/5.0",
            "2026-04-18T14:06:53Z,10.4.7.18,j.smith,vendor-lookup-alike.com,/api/account-update,200,884,Mozilla/5.0",
            "2026-04-18T14:07:21Z,10.4.7.18,j.smith,smtp.gmail.com,/inbox,200,17033,Mozilla/5.0",
            "2026-04-18T14:09:02Z,10.4.7.18,j.smith,vendor.example,/account,401,118,Mozilla/5.0",
            "2026-04-18T14:09:11Z,10.4.7.18,j.smith,vendor.example,/login,200,4319,Mozilla/5.0",
            "2026-04-18T14:12:33Z,10.4.7.18,j.smith,internal.partner.local,/wiki/wire-change-policy,200,28442,Mozilla/5.0",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "email-headers-summary.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Machine-parsed summary; full .eml + inline parser arrive in M4.",
              from_display: "Jane Doe",
              from_address: "jane.doe@vendor.example",
              reply_to: "ceo.urgent@gmail.com",
              return_path: "<noreply@vendor-lookup-alike.com>",
              received_chain: [
                "from mail.vendor-lookup-alike.com",
                "by inbound.partner.local",
              ],
              auth_results: {
                spf: "neutral",
                dkim: "fail",
                dmarc: "fail",
              },
              suspect_links: [
                "https://vendor-lookup-alike.com/secure-payment",
                "https://vendor-lookup-alike.com/api/account-update",
              ],
              attachments: ["INV-2026-0418-revised.pdf"],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "vendor-invoice-template.pdf",
        kind: "pdf",
        mimeType: "application/pdf",
        bytes: buildTinyPdf(),
      },
    ],
  },
  {
    slug: "rf-awareness-clean-sweep-001",
    title: "RF Awareness: \"Clean Sweep\" Report Review",
    summary:
      "A field element forwards a one-page sweep report concluding 'no devices present.' Your task is to assess the language for overclaim and identify when escalation to qualified TSCM personnel is warranted.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 25,
    tags: ["rf", "tscm-awareness", "report-language", "absence-of-evidence"],
    brief: `
# Brief

A field element under your CI cyber AOR forwards a one-page report
covering a 90-minute observation period in a sensitive conference space.
The report concludes:

> *"Sweep was clean. No surveillance devices present."*

You are asked to review the report's language **before it goes to the SAC**
and recommend revisions if any are warranted.

## Open the artifacts

The workspace tabs hold:

- The **draft report itself** (plain text) — read it for overclaim.
- An **observation log** of band activity during the sweep (JSON).
- A **placeholder spectrum-display image** (PNG). The image is not the
  exercise: the language in the draft report is.

## What this scenario is — and is not

This is an **awareness module**, not a TSCM training scenario.

- ✅ It trains how to read sweep-style observations with a CI cyber lens.
- ✅ It trains when to escalate to qualified TSCM personnel.
- ✅ It trains how to document RF observations *without overstating
  conclusions*.
- ❌ It does **not** qualify you to perform RF sweeps, evaluate device
  presence, or render any TSCM finding.

## Reasoning focus

**Absence of evidence ≠ evidence of absence.** A 90-minute observation
does not foreclose intermittent transmitters, RF-quiet devices, or
devices outside the observation band. Watch for language that collapses
that distinction.
`.trim(),
    disclaimer: RF_AWARENESS_DISCLAIMER,
    artifacts: [
      {
        ordinal: 1,
        displayName: "draft-sweep-report.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "FIELD OBSERVATION REPORT — DRAFT",
            "Date:        2026-04-18",
            "Location:    Conference room 4B",
            "Duration:    90 minutes (10:00–11:30 local)",
            "Equipment:   handheld spectrum analyzer (band coverage 25 MHz – 6 GHz)",
            "",
            "Findings:",
            "  - No signals of interest observed in the swept bands.",
            "  - Wi-Fi and Bluetooth traffic observed at expected levels.",
            "  - Background cellular activity nominal.",
            "",
            "Conclusion:",
            "  Sweep was clean. No surveillance devices present.",
            "",
            "Recommendation:",
            "  Room is safe for sensitive discussions.",
            "",
            "— Field element 9",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "observation-log.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Periodic snapshots from the sweep tool. Awareness module — illustrative only.",
              equipment: "handheld spectrum analyzer (25 MHz – 6 GHz)",
              start_local: "2026-04-18T10:00:00",
              end_local: "2026-04-18T11:30:00",
              snapshots: [
                { t: "10:05", band: "2.4GHz", observations: "WiFi, Bluetooth" },
                { t: "10:18", band: "5GHz", observations: "WiFi" },
                { t: "10:34", band: "850MHz", observations: "cellular (carrier)" },
                { t: "10:51", band: "2.4GHz", observations: "WiFi, Bluetooth" },
                { t: "11:07", band: "1.9GHz", observations: "cellular (carrier)" },
                { t: "11:22", band: "5GHz", observations: "WiFi" },
              ],
              notes: [
                "No persistent signals outside known carrier/Wi-Fi/BT profiles.",
                "Coverage limited to 25 MHz – 6 GHz; bands outside this window were not assessed.",
                "Observation window: 90 minutes. Burst / duty-cycled emitters outside the window would not appear.",
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "spectrum-snapshot.png",
        kind: "image",
        mimeType: "image/png",
        bytes: Buffer.from(TINY_PNG_BASE64, "base64"),
      },
    ],
  },
];

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function writeArtifactBytes(
  scenarioId: string,
  artifactId: string,
  ext: string,
  bytes: Buffer,
): Promise<string> {
  // Relative path is stored verbatim in the DB so future moves don't
  // require schema changes. The path is set by trusted code (this seed
  // and the M8 importer) — never derived from user input.
  const rel = join("scenarios", scenarioId, `${artifactId}${ext}`);
  const abs = resolve(STORAGE_ROOT, rel);
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.writeFile(abs, bytes);
  return rel;
}

function extForKind(displayName: string, kind: ArtifactKind): string {
  const dot = displayName.lastIndexOf(".");
  if (dot >= 0) return displayName.slice(dot);
  switch (kind) {
    case "text": return ".txt";
    case "csv":  return ".csv";
    case "json": return ".json";
    case "pdf":  return ".pdf";
    case "image": return ".png";
  }
}

async function upsertScenario(
  prisma: PrismaClient,
  authorId: string,
  s: ScenarioSeed,
): Promise<void> {
  const scenario = await prisma.scenario.upsert({
    where: { slug: s.slug },
    update: {
      title: s.title,
      summary: s.summary,
      skillAreas: s.skillAreas as never,
      difficulty: s.difficulty,
      estimatedMinutes: s.estimatedMinutes,
      tags: s.tags,
      status: "published",
      source: "authored",
      authorUserId: authorId,
    },
    create: {
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      skillAreas: s.skillAreas as never,
      difficulty: s.difficulty,
      estimatedMinutes: s.estimatedMinutes,
      tags: s.tags,
      status: "published",
      source: "authored",
      authorUserId: authorId,
    },
  });

  await prisma.scenarioBrief.upsert({
    where: { scenarioId: scenario.id },
    update: { markdownBody: s.brief, disclaimerMd: s.disclaimer ?? null },
    create: {
      scenarioId: scenario.id,
      markdownBody: s.brief,
      disclaimerMd: s.disclaimer ?? null,
    },
  });

  // Replace any prior artifacts for this scenario so seed is idempotent
  // on ordinals — no orphan files left behind in the DB.
  await prisma.artifact.deleteMany({ where: { scenarioId: scenario.id } });

  for (const a of s.artifacts) {
    // Real v4 UUID. The ParseUUIDPipe on the artifact streaming
    // endpoint requires v4 specifically, so synthesizing format-like
    // strings (as an earlier revision tried) fails validation.
    const uuid = randomUUID();
    const ext = extForKind(a.displayName, a.kind);
    const relativePath = await writeArtifactBytes(scenario.id, uuid, ext, a.bytes);
    await prisma.artifact.create({
      data: {
        id: uuid,
        scenarioId: scenario.id,
        ordinal: a.ordinal,
        displayName: a.displayName,
        kind: a.kind,
        relativePath,
        sha256: sha256(a.bytes),
        sizeBytes: a.bytes.length,
        mimeType: a.mimeType,
      },
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });

    const instructor = await upsertUser(
      prisma,
      SEED_INSTRUCTOR_EMAIL,
      "Seed Instructor",
      "instructor",
    );
    const trainee = await upsertUser(
      prisma,
      SEED_TRAINEE_EMAIL,
      "Seed Trainee",
      "trainee",
    );

    for (const s of SCENARIOS) {
      await upsertScenario(prisma, instructor.id, s);
    }

    // eslint-disable-next-line no-console
    console.log("\n────────────────────────────────────────");
    console.log("  ci-train seed users created/updated");
    console.log("────────────────────────────────────────");
    console.log(`  instructor: ${SEED_INSTRUCTOR_EMAIL}`);
    console.log(`  password  : ${instructor.password}`);
    console.log("────────────────────────────────────────");
    console.log(`  trainee   : ${SEED_TRAINEE_EMAIL}`);
    console.log(`  password  : ${trainee.password}`);
    console.log("────────────────────────────────────────");
    console.log(`  scenarios upserted: ${SCENARIOS.length}`);
    for (const s of SCENARIOS) {
      console.log(
        `    - ${s.slug}  (${s.skillAreas.join(", ")})  artifacts: ${s.artifacts.length}`,
      );
    }
    console.log(`  artifact storage root: ${STORAGE_ROOT}`);
    console.log("────────────────────────────────────────\n");
    console.log("Copy passwords now — they are not stored anywhere else.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
