import "reflect-metadata";
import { promises as fs, createReadStream, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

// One-shot migration: copy every artifact byte from the local
// filesystem (Hetzner-style /data/artifacts) into an S3-compatible
// bucket (Cloudflare R2 / Backblaze B2 / AWS S3 / MinIO).
//
// The DB rows already store relativePath; that path becomes the
// object key (with optional S3_KEY_PREFIX prepended). Nothing in the
// DB needs to change — flipping ARTIFACT_STORAGE_BACKEND=s3 plus the
// S3_* env vars makes the API read the same paths from the bucket.
//
// Idempotent: each upload runs HEAD first and skips when the object
// already exists with the right size. Safe to re-run if a transfer
// is interrupted.
//
// Usage:
//   ARTIFACT_STORAGE_ROOT=/data/artifacts \
//   S3_BUCKET=ci-cyber-lab-artifacts \
//   S3_REGION=auto \
//   S3_ACCESS_KEY_ID=... \
//   S3_SECRET_ACCESS_KEY=... \
//   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
//   DATABASE_URL=postgres://... \
//   node dist/scripts/migrate-artifacts-to-s3.js
//
//   # Optional: --dry-run prints what would happen without uploading.

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const sourceRoot = resolve(
    process.env.ARTIFACT_STORAGE_ROOT ?? "/data/artifacts",
  );
  const bucket = required("S3_BUCKET");
  const region = process.env.S3_REGION ?? "auto";
  const accessKeyId = required("S3_ACCESS_KEY_ID");
  const secretAccessKey = required("S3_SECRET_ACCESS_KEY");
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
  const keyPrefixRaw = process.env.S3_KEY_PREFIX ?? "";
  const keyPrefix = normalizePrefix(keyPrefixRaw);

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.artifact.findMany({
      select: { id: true, relativePath: true, sizeBytes: true },
      orderBy: { id: "asc" },
    });
    console.log(
      `[migrate-artifacts-to-s3] ${rows.length} artifact rows in DB`,
    );
    let uploaded = 0;
    let skipped = 0;
    let missing = 0;
    for (const row of rows) {
      const localPath = join(sourceRoot, row.relativePath);
      const key = keyPrefix + row.relativePath.replace(/\\/g, "/");
      let stat;
      try {
        stat = statSync(localPath);
      } catch {
        console.warn(
          `  MISSING  ${row.relativePath}  (DB row ${row.id} has no on-disk file)`,
        );
        missing += 1;
        continue;
      }
      const localSize = stat.size;

      // HEAD first for idempotence. Skip when same size already up.
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        if ((head.ContentLength ?? -1) === localSize) {
          skipped += 1;
          continue;
        }
        console.log(
          `  RE-UPLOAD ${key}  (size mismatch: remote=${head.ContentLength ?? "?"} local=${localSize})`,
        );
      } catch (err) {
        // 404 = not yet uploaded, proceed.
        if (!isNotFound(err)) throw err;
      }

      if (dryRun) {
        console.log(`  WOULD UPLOAD ${key}  (${localSize} bytes)`);
        uploaded += 1;
        continue;
      }
      // Stream the file body into S3. The SDK accepts a Node Readable.
      const body = createReadStream(localPath);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: localSize,
        }),
      );
      uploaded += 1;
      if (uploaded % 25 === 0) {
        console.log(`  ... ${uploaded} uploaded`);
      }
    }
    console.log("");
    console.log(
      `[migrate-artifacts-to-s3] done: ${uploaded} uploaded, ` +
        `${skipped} skipped (already present), ${missing} missing on disk`,
    );
    if (dryRun) {
      console.log("(dry-run — no objects actually written)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

function normalizePrefix(raw: string): string {
  let p = raw.trim();
  if (!p) return "";
  p = p.replace(/^\/+/, "");
  if (!p.endsWith("/")) p = p + "/";
  return p;
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
