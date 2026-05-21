import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { PrismaClient, type Role } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";

// Standalone seed runner.
//
//  - Creates one instructor and one trainee with freshly-generated
//    passwords printed to stdout.
//  - Upserts two demonstration scenarios so M2 has something to browse
//    out of the box:
//        bec-vendor-redirect-001          (email_headers + bec)
//        rf-awareness-clean-sweep-001     (rf_awareness — exercises the
//                                          awareness-only disclaimer)
//
// Re-running regenerates passwords for the same emails (idempotent on
// identity, non-idempotent on secrets) and refreshes scenario content
// in place.
//
// Usage (host):  pnpm --filter @ci-train/api seed
// Usage (docker): docker compose run --rm api node dist/scripts/seed.js

const SEED_INSTRUCTOR_EMAIL =
  process.env.SEED_INSTRUCTOR_EMAIL ?? "instructor@example.local";
const SEED_TRAINEE_EMAIL =
  process.env.SEED_TRAINEE_EMAIL ?? "trainee@example.local";

const ARGON_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

function randomPassword(): string {
  // 18 random bytes → 24 base64url chars. Easy to copy/paste, ~108 bits.
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

## What you'll have access to (later milestones)

Artifacts arrive in M3:
- The original \`.eml\` file (with full headers, including authentication
  results).
- A 24-hour slice of the partner firm's web-proxy log.
- A PDF copy of the vendor's normal invoice template.

## Goals for this scenario

You'll be asked to:

1. Identify header lines that support — or refute — a BEC hypothesis.
2. State your confidence that this is a BEC attempt, on a 1–5 scale.
3. Recommend the next investigative step, with one sentence on *why*.
4. Draft a one-paragraph escalation note for the SAC, distinguishing
   what you can prove from what you can only infer.

## Reasoning discipline

This scenario explicitly trains the difference between:

- **Proven:** authentication failures present in the headers; URLs that
  resolve to attacker-controlled infrastructure; etc.
- **Inferred:** intent, attribution, and likely scope of compromise.

Your debrief will grade the *report*, not just the verdict.
`.trim(),
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

## What this scenario is — and is not

This is an **awareness module**, not a TSCM training scenario.

- ✅ It trains how to read sweep-style observations with a CI cyber lens.
- ✅ It trains when to escalate to qualified TSCM personnel.
- ✅ It trains how to document RF observations *without overstating
  conclusions*.
- ❌ It does **not** qualify you to perform RF sweeps, evaluate device
  presence, or render any TSCM finding.

## Reasoning focus

The dominant trap here is **absence of evidence ≠ evidence of absence**:
a 90-minute observation does not foreclose the possibility of
intermittent transmitters, RF-quiet devices, or devices outside the
observation band. Watch for language that collapses that distinction.

## Goals for this scenario

You'll be asked to (in later milestones, once question UI lands):

1. Identify phrases in the draft report that overstate certainty.
2. Rate your confidence that the space is RF-clean, on a 1–5 scale,
   given only what the report tells you.
3. State the threshold at which you would escalate to qualified TSCM
   personnel and why.
4. Rewrite the conclusion in language that does not overclaim.
`.trim(),
    disclaimer: RF_AWARENESS_DISCLAIMER,
  },
];

async function upsertScenario(
  prisma: PrismaClient,
  authorId: string,
  s: ScenarioSeed,
): Promise<void> {
  // Two-step upsert: scenario, then brief, so the brief's scenario_id
  // can reference the scenario row in either branch.
  const scenario = await prisma.scenario.upsert({
    where: { slug: s.slug },
    update: {
      title: s.title,
      summary: s.summary,
      // skillAreas is a Prisma enum array; Prisma accepts the string
      // members directly.
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
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
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
      console.log(`    - ${s.slug}  (${s.skillAreas.join(", ")})`);
    }
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
