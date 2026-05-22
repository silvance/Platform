import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@ci-train/contracts";

// Emergency password-reset CLI (M15). Gives a VPS operator a clean
// recovery path that does NOT involve manually editing the users
// table or rerunning the full seed.
//
// Usage:
//   node dist/scripts/reset-password.js \
//     --email user@example.com --password 'NewPasswordHere'
//
// Or, less leaky on the shell, read the password from stdin:
//   echo -n 'NewPasswordHere' | node dist/scripts/reset-password.js \
//     --email user@example.com --password-stdin
//
// Behavior:
//   - Requires the target user to already exist; refuses to create
//     accounts (use the seed or the admin UI for that).
//   - Validates the new password against the same min/max length
//     the API enforces.
//   - Hashes with the same argon2id parameters as the API.
//   - Revokes ALL of the target's active sessions — same trust
//     model as an admin-initiated reset: a forgotten or compromised
//     password means every pre-reset token is untrusted.
//   - Prints what it did and exits non-zero on any failure.

const ARGON_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

interface ParsedArgs {
  email: string;
  password: string;
  // True when the operator passed --password-stdin (or supplied an
  // empty --password '' value). We accept stdin as a tiny ergonomic
  // win: keeps the password out of `ps` and out of shell history.
  passwordFromStdin: boolean;
}

function usage(): never {
  // eslint-disable-next-line no-console
  console.error(
    [
      "Usage:",
      "  node dist/scripts/reset-password.js \\",
      "    --email <email> --password '<new-password>'",
      "",
      "  node dist/scripts/reset-password.js \\",
      "    --email <email> --password-stdin   # read password from stdin",
      "",
      `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`,
    ].join("\n"),
  );
  process.exit(2);
}

// Minimal argv parser. Adding a parsing library to a recovery
// script would be a footgun — we want this to run from a stripped
// container with `node dist/...` and no surprises.
function parseArgs(argv: string[]): ParsedArgs {
  let email: string | undefined;
  let password: string | undefined;
  let passwordFromStdin = false;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "--email" || tok === "-e") {
      email = argv[++i];
    } else if (tok === "--password" || tok === "-p") {
      password = argv[++i];
    } else if (tok === "--password-stdin") {
      passwordFromStdin = true;
    } else if (tok === "-h" || tok === "--help") {
      usage();
    } else if (tok?.startsWith("--email=")) {
      email = tok.slice("--email=".length);
    } else if (tok?.startsWith("--password=")) {
      password = tok.slice("--password=".length);
    } else {
      // eslint-disable-next-line no-console
      console.error(`Unrecognized argument: ${tok}`);
      usage();
    }
  }

  if (!email) usage();
  if (passwordFromStdin && password !== undefined) {
    // eslint-disable-next-line no-console
    console.error("--password and --password-stdin are mutually exclusive.");
    usage();
  }
  if (!passwordFromStdin && password === undefined) usage();

  return {
    email: email as string,
    password: password ?? "",
    passwordFromStdin,
  };
}

async function readStdinPassword(): Promise<string> {
  return new Promise<string>((resolveStdin, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => {
      // Strip exactly one trailing newline if present — `echo -n`
      // is the documented form, but a regular `echo` is the
      // accident-likely form, and we'd rather not silently store a
      // password with an embedded `\n`.
      let s = Buffer.concat(chunks).toString("utf8");
      if (s.endsWith("\r\n")) s = s.slice(0, -2);
      else if (s.endsWith("\n")) s = s.slice(0, -1);
      resolveStdin(s);
    });
    process.stdin.on("error", reject);
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const plain = args.passwordFromStdin
    ? await readStdinPassword()
    : args.password;

  if (plain.length < MIN_PASSWORD_LENGTH || plain.length > MAX_PASSWORD_LENGTH) {
    // eslint-disable-next-line no-console
    console.error(
      `Refusing to set password: length ${plain.length} is outside ` +
        `${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`,
    );
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: args.email },
      select: { id: true, email: true },
    });
    if (!user) {
      // eslint-disable-next-line no-console
      console.error(
        `No user with email "${args.email}". This script does not ` +
          "create accounts — use the admin UI or seed script first.",
      );
      process.exit(1);
    }

    const passwordHash = await hash(plain, ARGON_OPTS);
    const result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      const revoked = await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { revoked: revoked.count };
    });

    // eslint-disable-next-line no-console
    console.log(
      `OK — password for ${user.email} updated; ` +
        `${result.revoked} active session(s) revoked.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("reset-password failed:", err);
  process.exit(1);
});
