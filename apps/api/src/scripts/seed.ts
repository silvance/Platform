import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";

// Standalone seed runner. Creates one instructor and one trainee with
// freshly-generated passwords printed to stdout. Re-running the seed
// regenerates passwords for the same emails (idempotent on identity,
// non-idempotent on secrets) — intended for fresh dev environments.
//
// Usage (host):  pnpm --filter @ci-train/api seed
// Usage (docker): docker compose run --rm api node dist/scripts/seed.js

const SEED_INSTRUCTOR_EMAIL = process.env.SEED_INSTRUCTOR_EMAIL ?? "instructor@example.local";
const SEED_TRAINEE_EMAIL = process.env.SEED_TRAINEE_EMAIL ?? "trainee@example.local";

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

async function upsert(
  prisma: PrismaClient,
  email: string,
  displayName: string,
  role: "instructor" | "trainee",
): Promise<string> {
  const password = randomPassword();
  const passwordHash = await hash(password, ARGON_OPTS);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, displayName, role, disabled: false },
    create: { email, passwordHash, displayName, role },
  });
  return password;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const instructorPassword = await upsert(
      prisma,
      SEED_INSTRUCTOR_EMAIL,
      "Seed Instructor",
      "instructor",
    );
    const traineePassword = await upsert(
      prisma,
      SEED_TRAINEE_EMAIL,
      "Seed Trainee",
      "trainee",
    );

    // eslint-disable-next-line no-console
    console.log("\n────────────────────────────────────────");
    console.log("  ci-train seed users created/updated");
    console.log("────────────────────────────────────────");
    console.log(`  instructor: ${SEED_INSTRUCTOR_EMAIL}`);
    console.log(`  password  : ${instructorPassword}`);
    console.log("────────────────────────────────────────");
    console.log(`  trainee   : ${SEED_TRAINEE_EMAIL}`);
    console.log(`  password  : ${traineePassword}`);
    console.log("────────────────────────────────────────\n");
    console.log("Copy these now — they are not stored anywhere else.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
