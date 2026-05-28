import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Report-writing / testimony-discipline family. Distinct from the
// other families because the *exercise* is the language, not the
// technical analysis. The artifacts are short; the questions
// probe whether the analyst can classify each statement and
// rewrite a sentence at the right confidence level.

export const REPORT_WRITING_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished) ──────────────────────────────────────
  {
    slug: "report-writing-ambiguous-evidence-001",
    title: "Report Writing: Mixed Evidence, Careful Finding",
    summary:
      "Given mixed evidence on a possible Business Email Compromise (BEC), write a defensible one-paragraph finding that names facts, assumptions, and recommended leads — without overclaiming.",
    skillAreas: ["report_writing", "inference_discipline", "bec"],
    difficulty: 3,
    estimatedMinutes: 30,
    tags: ["report_writing", "inference_discipline", "bec"],
    lane: "report_writing",
    module: "Findings vs facts",
    sequence: 3,
    brief: `
# Brief

Triage on a suspected **Business Email Compromise (BEC)** — a
financial-fraud lure that impersonates a trusted counterparty
to bend a routine money-movement workflow off its normal path
— has produced mixed evidence:

- The email had DMARC fail + Reply-To divergence.
- The recipient (a controller) **did reply** but **did not** send
  funds.
- One proxy-log entry shows a click on a link in the suspect email.
- The named "vendor contact" was reachable by phone and denied
  sending the email.

You are about to write the one-paragraph finding for the SAC.
Practice the language.

## Artifacts

- **case-summary.txt** — the bullet summary of what's been gathered.
- **statement-bank.json** — a list of candidate sentences for the
  finding, each tagged with what it claims. Your job is to pick
  ones that the artifacts actually support and reject ones that
  overclaim.

## Reasoning discipline

The categories you need to keep separate in the writeup:

- **Fact** — directly measured / observable in the artifacts.
- **Inference** — supported by the artifacts but requires
  judgment, language like *"consistent with"* or *"strongly
  suggests"*.
- **Assumption** — relied on but not yet verified; must be flagged
  as such.
- **Lead** — a *next step*, not part of the finding itself.

Mixing the categories is the writeup error that doesn't survive
cross-examination.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "case-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Triage summary — case 2026-BEC-114",
            "----------------------------------",
            "",
            "1. Suspect email auth results:",
            "     SPF       = neutral",
            "     DKIM      = fail (header.d=vendor.example)",
            "     DMARC     = fail (policy.dmarc=quarantine)",
            "",
            "2. Reply-To address (`ceo.urgent@gmail.com`) differs from From",
            "   address (`jane.doe@vendor.example`).",
            "",
            "3. Recipient (controller) confirmed by phone that they",
            "   replied to the email (without funds attached) before",
            "   escalating. Their reply went to the Reply-To Gmail address.",
            "",
            "4. Web-proxy log shows one click from the controller's session",
            "   on the link `https://vendor-lookup-alike.com/secure-payment`",
            "   at 14:06:48Z. Page content not captured.",
            "",
            "5. The named vendor contact (Jane Doe at vendor.example) was",
            "   reached by phone and stated she did not send the email and",
            "   has no knowledge of a wire-instruction change.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "statement-bank.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Each candidate sentence is tagged with what it claims.",
              statements: [
                { id: "S1", text: "The suspect email failed DKIM and DMARC at the receiving MTA.", claims: "auth-results report" },
                { id: "S2", text: "The named vendor contact, Jane Doe, confirmed by phone she did not send the email.", claims: "vendor denial" },
                { id: "S3", text: "The controller clicked one link on a lookalike domain before escalating.", claims: "proxy-log + controller statement" },
                { id: "S4", text: "The lookalike domain hosts attacker-controlled infrastructure designed to collect credentials.", claims: "page contents observed" },
                { id: "S5", text: "The threat actor is the same group responsible for the campaign tracked by the bureau as TA-115.", claims: "attribution" },
                { id: "S6", text: "The controller's reply to the Reply-To Gmail address may have aided the attacker in confirming the controller as a viable target.", claims: "operational consequence" },
                { id: "S7", text: "No funds were sent." , claims: "controller statement + ledger" },
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "report-writing-statements",
        displayName: "Candidate finding sentences",
        items: [
          { id: "S1", label: "The suspect email failed DKIM and DMARC at the receiving MTA." },
          { id: "S2", label: "The named vendor contact, Jane Doe, confirmed by phone she did not send the email." },
          { id: "S3", label: "The controller clicked one link on a lookalike domain before escalating." },
          { id: "S4", label: "The lookalike domain hosts attacker-controlled infrastructure designed to collect credentials." },
          { id: "S5", label: "The threat actor is the same group responsible for the campaign tracked by the bureau as TA-115." },
          { id: "S6", label: "The controller's reply to the Reply-To Gmail address may have aided the attacker in confirming the controller as a viable target." },
          { id: "S7", label: "No funds were sent." },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "report-writing-statements",
        promptMd:
          "From the statement bank, pick the sentences that belong in the **finding** as written, at the **fact** confidence level.",
        expected: {
          type: "select_indicators",
          correctIds: ["S1", "S2", "S3", "S7"],
        },
        debriefMd: [
          "**Fact-level sentences (belong as-is):**",
          "",
          "- S1: auth-results are recorded; this is a direct read of the artifact.",
          "- S2: phone confirmation from the named contact is a fact (assuming the contact's identity was verified — call back through the published vendor switchboard, not the email signature).",
          "- S3: proxy-log + controller's own statement is direct evidence of the click.",
          "- S7: zero funds sent, verifiable against the finance ledger.",
          "",
          "**Belong in the report, but with weaker framing (NOT as fact):**",
          "",
          "- S6 is an *inference* about operational consequence. Worth including, but phrased as \"may have\" / \"consistent with\" not as fact.",
          "",
          "**Do NOT belong in this finding:**",
          "",
          "- S4 claims page contents we did NOT capture. We can't say what the lookalike page actually did from this artifact set.",
          "- S5 is an attribution claim made without any supporting evidence in the artifacts.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which framing is the right way to include S6 (the controller's reply *may have* confirmed them as a target) in the finding?",
        options: [
          { id: "as-fact", label: "Include as a fact: \"The controller's reply confirmed them as a viable target to the attacker.\"" },
          { id: "as-inference", label: "Include as an inference: \"The controller's reply to the Reply-To address is consistent with the attacker confirming the controller as a viable target, though we cannot directly observe the attacker's intake.\"" },
          { id: "omit", label: "Omit — we can't directly observe the attacker's intake." },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["as-inference"], allowMultiple: false },
        debriefMd:
          "Including the inference with a *consistent with* framing names the operational consequence the SAC needs to act on (treat the controller as a known target, harden their account) without overclaiming about what we can't observe (the attacker's intake). Omitting altogether loses operationally useful information; stating as fact overclaims.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which **single missing artifact** would convert S4 (\"lookalike page = credential-collection\") from speculation into fact?",
        options: [
          { id: "page-capture", label: "A rendered-page capture from a sandboxed browser (or a URL-analyzer report)" },
          { id: "whois-info", label: "whois data for `vendor-lookup-alike.com`" },
          { id: "passive-dns", label: "Passive-DNS history for the lookalike domain" },
          { id: "more-clicks", label: "More controller proxy-log clicks on the same domain" },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["page-capture"],
          allowMultiple: false,
        },
        debriefMd:
          "A rendered-page capture from a sandboxed browser (or a URL-analyzer report) is what converts the inference into fact. Without it, S4 is speculation — defensible as an *operating hypothesis*, not as a finding.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the SAC writeup should make an attribution claim (S5) based on the current artifacts.",
        expected: { type: "confidence", expectedRange: [1, 1] },
        debriefMd:
          "**1.** Nothing in the artifacts supports attribution to a named threat actor. The finding can say \"consistent with patterns reported by the bureau in similar BEC campaigns\" if there's a *separate* analytic basis for that — but not in this one, with this artifact set.",
      },
    ],
  },

  // ─── Tier 2 (drafts) ─────────────────────────────────────────
  {
    slug: "report-writing-classify-statements-001",
    title: "Report Writing: Classify Each Statement",
    summary:
      "Given a list of writeup sentences, classify each as fact / inference / assumption / lead.",
    skillAreas: ["report_writing", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["report_writing", "inference_discipline"],
    lane: "report_writing",
    module: "Findings vs facts",
    sequence: 1,
    status: "draft",
    brief: `
# Brief (DRAFT)

A short exercise: classify each candidate sentence by the
category the writeup should treat it as.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "statements.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Candidate statements",
            "--------------------",
            "",
            "  A. The file was deleted from the recycle bin at 19:42 UTC.",
            "  B. The user deleted the file to conceal it.",
            "  C. The named author in the file's metadata is m.greene.",
            "  D. m.greene wrote the file.",
            "  E. Next: pull MFT entries for the file's create event to",
            "     resolve authorship.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "classify-statements-set",
        displayName: "Categories",
        items: [
          { id: "A", label: "A. The file was deleted from the recycle bin at 19:42 UTC." },
          { id: "B", label: "B. The user deleted the file to conceal it." },
          { id: "C", label: "C. The named author in the file's metadata is m.greene." },
          { id: "D", label: "D. m.greene wrote the file." },
          { id: "E", label: "E. Next: pull MFT entries for the file's create event to resolve authorship." },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 1,
        indicatorSetSlug: "classify-statements-set",
        promptMd:
          "Pick the statements that are **facts** (directly observable in the artifacts).",
        expected: { type: "select_indicators", correctIds: ["A", "C"] },
        debriefMd:
          "A (timestamp from recycle bin metadata) and C (the *named* author in metadata) are facts. B is an *assumption* about intent. D is an *inference* about authorship that requires more than the metadata field. E is a *lead*, not a finding sentence.",
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 1,
        indicatorSetSlug: "classify-statements-set",
        promptMd: "Pick the statements that are **leads** (next-step recommendations, not findings).",
        expected: { type: "select_indicators", correctIds: ["E"] },
        debriefMd:
          "E is the only lead — it names a query that hasn't been run yet. Leads belong in a *recommended-next-steps* section, not in the finding paragraph.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that D belongs in the finding paragraph at the *fact* confidence level.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. \"User X wrote the file\" requires authorship evidence beyond a metadata field. Stating it as fact is the classic over-claim.",
      },
    ],
  },

  {
    slug: "report-writing-presence-vs-execution-001",
    title: "Report Writing: Presence vs Execution",
    summary:
      "Rewrite an overconfident execution claim into a careful finding.",
    skillAreas: ["report_writing", "df_artifacts", "windows_artifacts"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["report_writing", "df_artifacts", "windows_artifacts"],
    lane: "report_writing",
    module: "Findings vs facts",
    sequence: 2,
    status: "draft",
    brief: `
# Brief (DRAFT)

A junior analyst wrote: *"util-x.exe was downloaded and executed
on WS-118."* The artifacts on hand show the download cleanly, but
no Prefetch entry and no Sysmon ProcessCreate within the 24-hour
window. (Sysmon = Microsoft System Monitor, a free Windows service
that emits structured process / network / file events to the Event
Log; ProcessCreate / EID 1 is its per-process-start event.)

Rewrite the sentence.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "facts.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Facts observed:",
            "  - Browser history shows util-x.exe downloaded to",
            "    C:\\Users\\m.wong\\Downloads\\util-x.exe at 14:08:23Z.",
            "  - Filesystem snapshot shows file present, MotW set.",
            "  - No Prefetch entry for util-x.exe (Prefetch is enabled).",
            "  - No Sysmon ProcessCreate for util-x.exe in the 24-hour window.",
            "  - User has not been interviewed.",
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 1,
        promptMd: "Which rewrite is the right one?",
        options: [
          { id: "still-asserts", label: "util-x.exe was downloaded and most likely executed on WS-118." },
          { id: "calibrated", label: "util-x.exe was downloaded to WS-118 at 14:08:23Z. No execution-artifact evidence (Prefetch, Sysmon ProcessCreate) was observed in the available window. User has not been interviewed." },
          { id: "denial", label: "util-x.exe was downloaded but NOT executed on WS-118." },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["calibrated"], allowMultiple: false },
        debriefMd:
          "Calibrated naming: state what was observed, state what was looked for and not found, state what hasn't been done yet (interview). The first rewrite hedges with \"most likely\" but still asserts execution. The third asserts non-execution — also an overclaim, since absence of evidence isn't proof of absence.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd: "What does the **absence** of a Prefetch entry for `util-x.exe` prove?",
        options: [
          {
            id: "nothing-definitive",
            label:
              "Nothing definitive. It leans toward non-execution, but Prefetch creation can be delayed and some configurations suppress Prefetch — absence is suggestive, not affirmative.",
          },
          {
            id: "proves-not-executed",
            label: "It proves the binary did not execute on this workstation.",
          },
          {
            id: "proves-cleaned-up",
            label:
              "It proves the binary executed but the attacker cleaned up Prefetch afterwards.",
          },
          {
            id: "proves-sysmon-off",
            label: "It proves Sysmon was disabled at the time of execution.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["nothing-definitive"],
          allowMultiple: false,
        },
        debriefMd:
          "**Nothing definitive.** Absence of a Prefetch entry leans toward non-execution, but Prefetch creation can be delayed under load and certain configurations suppress Prefetch entries. Absence is suggestive, not affirmative — exactly the kind of result the *calibrated* writeup names explicitly (looked for, not observed) rather than promoting to a conclusion in either direction.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: [
          "Confidence (1–5) that the **calibrated rewrite** you picked in Q1 is ready to send.",
          "",
          "> *util-x.exe was downloaded to WS-118 at 14:08:23Z. No execution-artifact evidence (Prefetch, Sysmon ProcessCreate) was observed in the available window. User has not been interviewed.*",
        ].join("\n"),
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "High. The calibrated rewrite says what's known, what was looked for, and what's missing. That's enough to send.",
      },
    ],
  },
];
