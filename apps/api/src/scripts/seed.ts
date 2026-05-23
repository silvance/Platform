import "reflect-metadata";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PrismaClient, type Role, type ArtifactKind } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";
import { MIN_PASSWORD_LENGTH } from "@ci-train/contracts";
import { assertDistinctSeedEmails } from "./seed-config";
import { SCENARIOS } from "./seed-content";
import { validateScenarios } from "./seed-content/validate";
import type {
  ArtifactSeed,
  IndicatorSetSeed,
  QuestionSeed,
  ScenarioSeed,
} from "./seed-content/types";

// Standalone seed runner. Idempotently upserts one admin + one
// regular-user account, plus the demonstration challenges and
// their artifact bytes.
//
// Role model (kept current with M15 product framing):
//   user  – can sign in, browse and solve challenges, view their
//           own progress, and change their own password.
//   admin – everything a user can do AND author / import / export
//           challenges plus manage other user accounts. Admins are
//           still challenge users — they solve challenges and have
//           their own progress like anyone else.
//
// M15: bootstrap passwords are env-configurable.
//   SEED_ADMIN_EMAIL    – admin account (default: admin@example.local)
//   SEED_ADMIN_PASSWORD – password for the admin account
//   SEED_USER_EMAIL     – regular-user account (default: user@example.local)
//   SEED_USER_PASSWORD  – password for the regular-user account
//
// Backwards-compat aliases (kept only so deployed env files from
// before M15 keep working — don't use them in new deploys):
//   SEED_INSTRUCTOR_EMAIL → falls through to SEED_ADMIN_EMAIL
//   SEED_TRAINEE_EMAIL    → falls through to SEED_USER_EMAIL
//
// Password handling — three cases per user:
//   1. SEED_*_PASSWORD set
//      → use it. Re-running the seed is idempotent: the password is
//        re-hashed but always set to the same env value.
//   2. SEED_*_PASSWORD unset AND the account does NOT yet exist
//      → generate a random password, print it once (preserves the
//        original pre-M15 behavior so a fresh local dev still gets
//        a usable login out of the box).
//   3. SEED_*_PASSWORD unset AND the account already exists
//      → DO NOT rotate the password. Re-running the seed on a deploy
//        that didn't pin SEED_*_PASSWORD must not surprise an admin
//        whose password was set via the admin UI or reset-password
//        script.
//
// Usage (host):  pnpm --filter @ci-train/api seed
// Usage (docker): docker compose run --rm api node dist/scripts/seed.js

const SEED_ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ??
  process.env.SEED_INSTRUCTOR_EMAIL ??
  "admin@example.local";
const SEED_USER_EMAIL =
  process.env.SEED_USER_EMAIL ??
  process.env.SEED_TRAINEE_EMAIL ??
  "user@example.local";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? null;
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? null;
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

interface SeedUserResult {
  id: string;
  // Action taken so the operator-facing log can be precise:
  //   "created"  — brand-new account, password is in `password`
  //                (env or random).
  //   "updated"  — existed already, env password rotated it.
  //   "kept"     — existed already, env password not provided,
  //                so we did not touch the password row.
  action: "created" | "updated" | "kept";
  // Plaintext password to display ONLY for the "created" (random)
  // case. For "updated" we don't echo what the operator already
  // supplied; for "kept" there's nothing to display.
  passwordToDisplay: string | null;
}

async function upsertUser(
  prisma: PrismaClient,
  email: string,
  displayName: string,
  role: Role,
  envPassword: string | null,
): Promise<SeedUserResult> {
  if (envPassword !== null && envPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Bootstrap password for ${email} is shorter than ${MIN_PASSWORD_LENGTH} ` +
        `characters. Regenerate it (e.g. \`openssl rand -base64 24\`) and ` +
        `rerun the seed. Passwords below the minimum length are rejected by ` +
        `the API at create/reset time too, so seeding under it would leave ` +
        `you with credentials you can't rotate through the UI.`,
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Case 3: keep — account exists and operator didn't pin a
  // password. Refresh displayName + role + un-disable, but leave
  // passwordHash alone.
  if (existing && envPassword === null) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { displayName, role, disabled: false },
    });
    return { id: user.id, action: "kept", passwordToDisplay: null };
  }

  // Cases 1 / 2: there's a password to set, either supplied or
  // freshly random.
  const plain = envPassword ?? randomPassword();
  const passwordHash = await hash(plain, ARGON_OPTS);
  const user = await prisma.user.upsert({
    where: { email },
    // M17: re-seeding an existing account preserves whatever
    // approvedAt it already has (don't clobber a deliberate admin
    // approval). New rows land auto-approved — seeded accounts
    // are trusted by the deployer who ran the seed.
    update: { passwordHash, displayName, role, disabled: false },
    create: {
      email,
      passwordHash,
      displayName,
      role,
      approvedAt: new Date(),
    },
  });

  if (existing) {
    return { id: user.id, action: "updated", passwordToDisplay: null };
  }
  return {
    id: user.id,
    action: "created",
    // Only echo the password when WE generated it. If the operator
    // supplied SEED_*_PASSWORD, they already know it, and logging it
    // back into Docker output would just be one more place it leaks.
    passwordToDisplay: envPassword === null ? plain : null,
  };
}


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
  // require schema changes. The path is set by trusted code (this
  // seed; a future content-pack importer would do the same) — never
  // derived from user input.
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
  // M16 tiering: scenarios default to "published" (visible to every
  // signed-in user). Tier-2 drafts opt in to status="draft" so only
  // admins see them in the listing — same status field, different
  // visibility, no schema change.
  const status = s.status ?? "published";
  const scenario = await prisma.scenario.upsert({
    where: { slug: s.slug },
    update: {
      title: s.title,
      summary: s.summary,
      skillAreas: s.skillAreas as never,
      difficulty: s.difficulty,
      estimatedMinutes: s.estimatedMinutes,
      tags: s.tags,
      status,
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
      status,
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
        // compatibility with a future content-pack importer.
        itemsJson: set.items as never,
      },
    });
    indicatorSetIdBySlug.set(set.slug, row.id);
  }

  for (const q of s.questions) {
    let optionsJson: unknown = null;
    if (q.type === "multi_choice") {
      optionsJson = {
        options: q.options ?? [],
        allowMultiple: q.allowMultiple ?? false,
      };
    } else if (q.type === "text_match") {
      if (!q.textMatch) {
        throw new Error(
          `Question (ordinal ${q.ordinal}) is text_match but has no textMatch config.`,
        );
      }
      // Correctness (the acceptableAnswers list) lives on the AnswerKey,
      // not optionsJson — see TextMatchOptionsSpec in @ci-train/contracts.
      // Keeps a Question row free of answer-key data.
      optionsJson = {
        caseSensitive: q.textMatch.caseSensitive ?? false,
        normalizeWhitespace: q.textMatch.normalizeWhitespace ?? true,
        regex: q.textMatch.regex ?? false,
        hint: q.textMatch.hint ?? null,
        hintAfterTries: q.textMatch.hintAfterTries ?? 3,
      };
    }
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

function describeAction(
  email: string,
  envVarName: string,
  envSet: boolean,
  r: SeedUserResult,
): string {
  switch (r.action) {
    case "created":
      return r.passwordToDisplay
        ? `  created  ${email}  password (random): ${r.passwordToDisplay}`
        : `  created  ${email}  password: (from env)`;
    case "updated":
      return `  updated  ${email}  password: (rotated to env value)`;
    case "kept":
      return envSet
        ? // Unreachable in practice — env set means we go through
          // create/update; included for completeness.
          `  kept     ${email}  password: (env supplied but row already had one — investigate)`
        : `  kept     ${email}  password: (unchanged — set ${envVarName} to rotate)`;
  }
}

async function main(): Promise<void> {
  // Run BEFORE constructing the Prisma client / touching the FS so
  // a misconfigured deploy fails fast with a clear message rather
  // than silently demoting the admin row.
  assertDistinctSeedEmails(SEED_ADMIN_EMAIL, SEED_USER_EMAIL);

  // Same fail-fast rule for the seed catalogue itself: a malformed
  // scenario (broken cross-reference between a select_indicators
  // question and its indicator-set, multi_choice correctId that
  // isn't an option, duplicate ordinals, etc.) is caught BEFORE we
  // partially write to the DB.
  validateScenarios(SCENARIOS);

  const prisma = new PrismaClient();
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });

    const admin = await upsertUser(
      prisma,
      SEED_ADMIN_EMAIL,
      "Seed Admin",
      "admin",
      SEED_ADMIN_PASSWORD,
    );
    const user = await upsertUser(
      prisma,
      SEED_USER_EMAIL,
      "Seed User",
      "user",
      SEED_USER_PASSWORD,
    );

    for (const s of SCENARIOS) {
      await upsertScenario(prisma, admin.id, s);
    }

    // eslint-disable-next-line no-console
    console.log("\n────────────────────────────────────────");
    console.log("  ci-train seed");
    console.log("────────────────────────────────────────");
    console.log(
      describeAction(SEED_ADMIN_EMAIL, "SEED_ADMIN_PASSWORD", SEED_ADMIN_PASSWORD !== null, admin),
    );
    console.log(
      describeAction(SEED_USER_EMAIL, "SEED_USER_PASSWORD", SEED_USER_PASSWORD !== null, user),
    );
    console.log("────────────────────────────────────────");
    console.log(`  scenarios upserted: ${SCENARIOS.length}`);
    for (const s of SCENARIOS) {
      console.log(
        `    - ${s.slug}  (${s.skillAreas.join(", ")})  artifacts: ${s.artifacts.length}`,
      );
    }
    console.log(`  artifact storage root: ${STORAGE_ROOT}`);
    console.log("────────────────────────────────────────");
    if (
      admin.passwordToDisplay !== null ||
      user.passwordToDisplay !== null
    ) {
      console.log("Random passwords above are printed ONCE. Copy now —");
      console.log("they are not stored anywhere else. For repeatable");
      console.log("deploys, set SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD.");
    } else {
      console.log("To rotate a seeded account's password, run:");
      console.log("  node dist/scripts/reset-password.js \\");
      console.log("    --email <email> --password '<new-password>'");
    }
    console.log("────────────────────────────────────────\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
