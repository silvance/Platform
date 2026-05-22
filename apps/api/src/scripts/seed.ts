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

interface IndicatorSetSeed {
  slug: string;
  displayName: string;
  // Optional artifact slug (e.g. "suspect-email.eml"); the seed resolves
  // this to an artifact id at write time. Null when the indicators are
  // not tied to a single artifact.
  sourceArtifactDisplayName?: string;
  items: Array<{ id: string; label: string; evidenceRef?: string }>;
}

interface QuestionSeed {
  ordinal: number;
  type: "multi_choice" | "short_answer" | "long_answer" | "confidence" | "select_indicators";
  promptMd: string;
  weight: number;
  // For multi_choice only. Other types leave this undefined.
  options?: Array<{ id: string; label: string }>;
  allowMultiple?: boolean;
  // For select_indicators only — references an IndicatorSetSeed.slug.
  indicatorSetSlug?: string;
  // Type-specific expected payload. See AnswerKeyPayload in
  // @ci-train/contracts for the exact shape per type.
  expected:
    | { type: "multi_choice"; correctIds: string[]; allowMultiple: boolean }
    | { type: "short_answer"; rubricNote: string | null }
    | { type: "long_answer"; rubricNote: string | null }
    | { type: "confidence"; expectedRange: [number, number] }
    | { type: "select_indicators"; correctIds: string[] };
  debriefMd: string;
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
  questions: QuestionSeed[];
  indicatorSets?: IndicatorSetSeed[];
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

- The **suspect email itself** (\`.eml\`), rendered with parsed headers,
  Authentication-Results highlighting (SPF / DKIM / DMARC), the text
  body, and attachment metadata.
- The **controller's contemporaneous note** of the request (plain text).
- A **24-hour slice of the partner firm's web-proxy log** (CSV).
- A **machine-parsed summary** of the suspect email's key headers
  (JSON). Useful for cross-checking against the live parsed view.
- The **vendor's normal invoice template** (PDF).

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
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "Jane Doe" <jane.doe@vendor.example>',
            "To: controller@partner.example",
            "Reply-To: ceo.urgent@gmail.com",
            "Return-Path: <noreply@vendor-lookup-alike.com>",
            "Subject: URGENT: Updated wire instructions for INV-2026-0418",
            "Date: Thu, 18 Apr 2026 14:07:02 +0000",
            "Message-ID: <bec-1234abcd@vendor-lookup-alike.com>",
            "Authentication-Results: mx.partner.example;",
            " spf=neutral smtp.mailfrom=vendor-lookup-alike.com;",
            " dkim=fail header.d=vendor.example;",
            " dmarc=fail policy.dmarc=reject",
            "Received: from mail.vendor-lookup-alike.com (203.0.113.42)",
            " by inbound.partner.local (1.2.3.4) with ESMTP id ABC123;",
            " Thu, 18 Apr 2026 14:07:00 +0000",
            "MIME-Version: 1.0",
            'Content-Type: multipart/alternative; boundary="BEC-BOUNDARY"',
            "",
            "--BEC-BOUNDARY",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Hi,",
            "",
            "Please update the wire instructions for invoice INV-2026-0418 to",
            "the new account immediately. Confidentiality is critical until",
            "this clears. Confirm via reply only — do not call.",
            "",
            "Thanks,",
            "Jane",
            "--BEC-BOUNDARY",
            "Content-Type: text/html; charset=utf-8",
            "",
            "<p>Hi,</p><p>Please update the wire instructions for",
            " <b>INV-2026-0418</b> to the new account immediately.</p>",
            "--BEC-BOUNDARY--",
            "",
          ].join("\r\n"),
        ),
      },
      {
        ordinal: 2,
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
        ordinal: 3,
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
        ordinal: 4,
        displayName: "email-headers-summary.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Machine-parsed summary; cross-check against the live EML view in the workspace.",
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
        ordinal: 5,
        displayName: "vendor-invoice-template.pdf",
        kind: "pdf",
        mimeType: "application/pdf",
        bytes: buildTinyPdf(),
      },
    ],
    indicatorSets: [
      {
        slug: "bec-header-indicators",
        displayName: "BEC indicators present in the suspect email",
        sourceArtifactDisplayName: "suspect-email.eml",
        // Items written in the same compact form the EML viewer surfaces
        // them — gives the trainee a visual mapping between the .eml
        // artifact tab and this question.
        items: [
          { id: "from-display-spoof", label: "From display name claims `Jane Doe` of vendor.example", evidenceRef: "From: header" },
          { id: "reply-to-divergent", label: "Reply-To address is `ceo.urgent@gmail.com` (different domain than From)", evidenceRef: "Reply-To: header" },
          { id: "return-path-lookalike", label: "Return-Path is on `vendor-lookup-alike.com` (lookalike domain)", evidenceRef: "Return-Path: header" },
          { id: "dkim-fail", label: "Authentication-Results reports `dkim=fail header.d=vendor.example`", evidenceRef: "Authentication-Results: header" },
          { id: "dmarc-fail", label: "Authentication-Results reports `dmarc=fail policy.dmarc=reject`", evidenceRef: "Authentication-Results: header" },
          { id: "spf-neutral", label: "Authentication-Results reports `spf=neutral`", evidenceRef: "Authentication-Results: header" },
          { id: "urgency-language", label: 'Subject and body use "URGENT" + same-day pressure framing', evidenceRef: "Subject: header / body" },
          { id: "received-from-lookalike", label: "Received: chain shows the message arrived from `mail.vendor-lookup-alike.com`", evidenceRef: "Received: header" },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which of these signals — present in the EML viewer's parsed Authentication-Results and header strip — support a BEC hypothesis? Select all that apply.",
        options: [
          { id: "spf-neutral", label: "SPF result is `neutral`" },
          { id: "dkim-fail", label: "DKIM result is `fail`" },
          { id: "dmarc-fail", label: "DMARC result is `fail`" },
          { id: "reply-to-divergent", label: "Reply-To address is on a different domain than From" },
          { id: "return-path-lookalike", label: "Return-Path is on a vendor-lookalike domain" },
          { id: "subject-uppercase", label: "Subject is in all caps" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["dkim-fail", "dmarc-fail", "reply-to-divergent", "return-path-lookalike"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven by the artifacts:**",
          "",
          "- `dkim=fail header.d=vendor.example` — the message claims to be from the real vendor domain but DKIM does not validate.",
          "- `dmarc=fail policy.dmarc=reject` — the receiving MTA's DMARC policy refused the message; this is a strong technical signal.",
          "- Reply-To divergence (`ceo.urgent@gmail.com` vs `jane.doe@vendor.example`) — classic identity-spoof / out-of-band reply trick.",
          "- Return-Path on `vendor-lookup-alike.com` — lookalike domain registered to receive bounce mail away from the real vendor.",
          "",
          "**Not enough to claim by itself:**",
          "",
          "- An all-caps subject and `URGENT` framing are *social engineering markers*, not proof of forgery.",
          "- `spf=neutral` is not pass *or* fail — by itself it doesn't prove anything; combined with the DKIM/DMARC failures it firms up the picture.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "confidence",
        weight: 1,
        promptMd:
          "On a 1–5 scale, how confident are you that this email is a BEC attempt? (1 = not confident, 5 = certain)",
        expected: { type: "confidence", expectedRange: [3, 5] },
        debriefMd: [
          "A confident **5** is unwarranted on the headers alone — the headers establish *spoofing*, not yet *intent and operational scope*.",
          "",
          "A **3 or 4** reflects calibrated reasoning given the available evidence: technical auth failures + Reply-To/Return-Path divergence + lookalike domain registration cluster strongly toward BEC, but proving the attacker accessed the vendor's account vs. simply impersonating it externally requires more work.",
          "",
          "A **1 or 2** ignores the multiple corroborating signals already in the artifacts.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "short_answer",
        weight: 1,
        promptMd:
          "Name one investigative step you would take next and explain *why* in one sentence.",
        expected: {
          type: "short_answer",
          rubricNote:
            "Acceptable: pivoting on the Return-Path domain (whois / passive DNS), pulling proxy-log activity around 14:07 local for the suspect domain, contacting the vendor via a known-good channel to corroborate, or pulling the broader Received chain via the raw .eml. The 'why' should connect the step to closing a specific evidentiary gap (proving inbound auth failure vs. confirming the alternate account is attacker-controlled).",
        },
        debriefMd: [
          "Several defensible answers; the rubric grades the *connection to evidence*, not the specific step:",
          "",
          "- *Out-of-band contact with the vendor* closes the \"is this account compromised at the source?\" gap.",
          "- *Pivot on the lookalike domain* (whois, passive DNS, infrastructure overlap) — closes the attribution gap.",
          "- *Pull the proxy-log slice* around 14:07 local — confirms the trainee/controller did not click through the Reply-To address.",
          "",
          "An answer like \"escalate to leadership\" without a specific evidentiary purpose does not satisfy the rubric.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "long_answer",
        weight: 3,
        promptMd:
          "Draft a one-paragraph escalation note for the SAC. Distinguish what you can *prove* from what you can only *infer*. Include a recommended containment action and your confidence level.",
        expected: {
          type: "long_answer",
          rubricNote:
            "Must (a) clearly separate proven (DKIM/DMARC fail, lookalike Return-Path, Reply-To divergence) from inferred (vendor account compromise, attacker identity, scope); (b) state a containment action (block the lookalike domain, hold the wire, notify the vendor via known-good channel); (c) include a calibrated confidence statement, not 'definitely a BEC' or 'we don't know'.",
        },
        debriefMd: [
          "Strong write-ups will:",
          "",
          "- Open with the **proven** facts in concrete terms — \"the message failed DKIM and DMARC\" rather than \"the email looks suspicious\".",
          "- Mark inferences as inferences — \"the lookalike domain registration *suggests* deliberate targeting\".",
          "- Include a containment action: hold the pending wire, block the lookalike domain at the proxy, notify the vendor via a known-good channel.",
          "- State confidence on a scale and *justify* it — not \"100% BEC\".",
          "",
          "This question is instructor-graded (M7); the rubric above describes the grading frame.",
        ].join("\n"),
      },
      {
        ordinal: 5,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "bec-header-indicators",
        promptMd:
          "Open the **suspect-email.eml** tab and review the parsed header strip. Which of the listed indicators are **technical evidence** the message was not sent from the real vendor (vs. social-engineering markers)? Pick the ones that establish *spoofing* on the wire.",
        expected: {
          type: "select_indicators",
          // Technical wire-level evidence — auth-mechanism failures and
          // lookalike-domain routing. Excludes display-name spoofing and
          // urgency framing, which are social-engineering markers, not
          // wire-protocol proofs.
          correctIds: [
            "reply-to-divergent",
            "return-path-lookalike",
            "dkim-fail",
            "dmarc-fail",
            "received-from-lookalike",
          ],
        },
        debriefMd: [
          "**Technical evidence of spoofing on the wire:**",
          "",
          "- `Reply-To: ceo.urgent@gmail.com` — Reply-To divergence is a wire-protocol signal: the message's *machine-readable* reply destination is a free webmail account.",
          "- `Return-Path` on a lookalike domain — wire-level routing the attacker controls.",
          "- `dkim=fail header.d=vendor.example` — the cryptographic signature claim that this is from vendor.example was rejected.",
          "- `dmarc=fail policy.dmarc=reject` — the receiving MTA's policy lookup against the vendor's published DMARC record rejected the message.",
          "- `Received: from mail.vendor-lookup-alike.com` — the first-hop Received line records that the message was injected from an attacker-controlled MTA.",
          "",
          "**Not technical evidence (social-engineering markers, separate axis):**",
          "",
          "- The `From:` display name (`Jane Doe`) is trivially forgeable and proves nothing about wire authenticity.",
          "- `spf=neutral` is *not a fail* — it asserts \"no published policy\" rather than \"this is spoofed.\"",
          "- `URGENT` framing and same-day pressure are psychological manipulation, not technical proof.",
          "",
          "**Reasoning discipline reminder:** distinguishing wire-level proofs from social-engineering markers is what separates \"this looks suspicious\" from \"this *is* spoofed on the wire and here are the four headers that prove it.\" Both matter in the report; mixing them weakens the writeup.",
        ].join("\n"),
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
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which phrases in the draft sweep report overstate what a 90-minute, 25 MHz–6 GHz observation can actually conclude? Select all that apply.",
        options: [
          { id: "sweep-clean", label: "\"Sweep was clean.\"" },
          { id: "no-devices", label: "\"No surveillance devices present.\"" },
          { id: "safe-for-discussions", label: "\"Room is safe for sensitive discussions.\"" },
          { id: "wifi-observed", label: "\"Wi-Fi and Bluetooth traffic observed at expected levels.\"" },
          { id: "background-nominal", label: "\"Background cellular activity nominal.\"" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["sweep-clean", "no-devices", "safe-for-discussions"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Overclaims:**",
          "",
          "- *\"Sweep was clean.\"* collapses a finite observation into a definitive negative finding.",
          "- *\"No surveillance devices present.\"* claims absence; the 90-minute / 25 MHz–6 GHz observation does not foreclose intermittent transmitters, RF-quiet devices, or out-of-band emitters.",
          "- *\"Room is safe for sensitive discussions.\"* is a *judgment*, not a measurement; the report should not assert it from this evidence alone.",
          "",
          "**Not overclaims:**",
          "",
          "- The Wi-Fi / Bluetooth / cellular observations are descriptions of what *was* observed during the window — they don't claim anything about what wasn't.",
          "",
          "Awareness module reminder: this exercise trains *language discipline*. It does not qualify you to render TSCM findings.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "confidence",
        weight: 1,
        promptMd:
          "On a 1–5 scale, how confident should the report's conclusion be that the room is RF-clean, given ONLY the evidence in the artifacts?",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd: [
          "The well-calibrated answer is **1 or 2**.",
          "",
          "The observation log explicitly notes the band coverage (25 MHz – 6 GHz) and the 90-minute window. A duty-cycled emitter or one operating outside the observed band would not appear; that is precisely the case where *absence of evidence is not evidence of absence*.",
          "",
          "A **3 or above** treats a bounded observation as a stronger negative finding than it is.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "long_answer",
        weight: 2,
        promptMd:
          "Rewrite the conclusion in language that does not overstate. Include the threshold at which you would escalate to qualified TSCM personnel and why.",
        expected: {
          type: "long_answer",
          rubricNote:
            "Acceptable rewrite uses bounded language (e.g., \"no signals of interest observed within the swept bands during the 90-minute observation window\"); names the observation limits (band coverage, time window); states a specific escalation threshold (anomalous transient observation, mission criticality, requirement for a finding, presence-of-evidence questions outside CI cyber's scope) tied to qualified TSCM personnel; avoids declaring the room safe.",
        },
        debriefMd: [
          "Strong rewrites will:",
          "",
          "- Replace \"clean\" with *bounded* language: \"no signals of interest observed within the swept bands during the 90-minute window.\"",
          "- Acknowledge the observation limits explicitly.",
          "- State an escalation threshold that ties to qualified TSCM personnel (not to CI cyber).",
          "- Not declare the room \"safe\" — that's a judgment outside the observation's reach.",
          "",
          "This question is instructor-graded (M7); the rubric describes the grading frame.",
        ].join("\n"),
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
    case "eml":  return ".eml";
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

  // Replace any prior questions (cascades to AnswerKey rows) AND any
  // prior indicator sets (cascades through the questions FK). Order
  // matters: questions hold an FK to indicator_sets with ON DELETE
  // RESTRICT, so we delete questions first.
  await prisma.question.deleteMany({ where: { scenarioId: scenario.id } });
  await prisma.indicatorSet.deleteMany({ where: { scenarioId: scenario.id } });

  // Resolve artifact display names → ids once for indicator-set sourcing.
  const artifactByName = new Map(
    (await prisma.artifact.findMany({
      where: { scenarioId: scenario.id },
      select: { id: true, displayName: true },
    })).map((a) => [a.displayName, a.id]),
  );

  // Create indicator sets first so questions can reference them by id.
  const indicatorSetIdBySlug = new Map<string, string>();
  for (const set of s.indicatorSets ?? []) {
    const sourceArtifactId = set.sourceArtifactDisplayName
      ? artifactByName.get(set.sourceArtifactDisplayName) ?? null
      : null;
    const row = await prisma.indicatorSet.create({
      data: {
        scenarioId: scenario.id,
        slug: set.slug,
        displayName: set.displayName,
        sourceArtifactId,
        // items_json stored as a bare array — the API/contract accept
        // both bare-array and `{ items: [...] }` shapes for forward
        // compatibility with the M8 importer.
        itemsJson: set.items as never,
      },
    });
    indicatorSetIdBySlug.set(set.slug, row.id);
  }

  for (const q of s.questions) {
    const optionsJson =
      q.type === "multi_choice"
        ? { options: q.options ?? [], allowMultiple: q.allowMultiple ?? false }
        : null;
    let indicatorSetId: string | null = null;
    if (q.type === "select_indicators") {
      if (!q.indicatorSetSlug) {
        throw new Error(
          `Question (ordinal ${q.ordinal}) is select_indicators but has no indicatorSetSlug.`,
        );
      }
      const id = indicatorSetIdBySlug.get(q.indicatorSetSlug);
      if (!id) {
        throw new Error(
          `Indicator set with slug ${q.indicatorSetSlug} not found in scenario ${scenario.slug}.`,
        );
      }
      indicatorSetId = id;
    }
    const question = await prisma.question.create({
      data: {
        scenarioId: scenario.id,
        ordinal: q.ordinal,
        type: q.type,
        promptMd: q.promptMd,
        weight: q.weight,
        optionsJson: optionsJson as never,
        indicatorSetId,
      },
    });
    await prisma.answerKey.create({
      data: {
        questionId: question.id,
        // Store the discriminated shape so AttemptsService can read it
        // without re-deriving type from the question row.
        expectedJson: q.expected as never,
        debriefMd: q.debriefMd,
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
