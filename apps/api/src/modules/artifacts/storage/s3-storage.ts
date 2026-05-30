import { Injectable, Logger } from "@nestjs/common";
import { isAbsolute, normalize } from "node:path/posix";
import { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ArtifactStorage, ArtifactPathError } from "./artifact-storage";

// S3-compatible storage backend. Works against any S3 API:
// Cloudflare R2, Backblaze B2, AWS S3, MinIO, Wasabi, etc.
//
// Wired via env when ARTIFACT_STORAGE_BACKEND=s3 — see storage.module.ts.
// Required env vars:
//   S3_BUCKET                 — bucket name
//   S3_REGION                 — region (R2 ignores this but the SDK wants something)
//   S3_ACCESS_KEY_ID          — access key
//   S3_SECRET_ACCESS_KEY      — secret
// Optional:
//   S3_ENDPOINT               — custom endpoint URL (set for R2/B2/MinIO; omit for AWS)
//   S3_FORCE_PATH_STYLE       — "true" to force path-style addressing (needed for MinIO)
//   S3_KEY_PREFIX             — optional prefix prepended to every object key
//                              (lets you share one bucket across environments)
//
// Path safety mirrors LocalFileSystemStorage: relativePath must be
// relative, must not contain `..` segments after normalization, and
// must not be empty. Object keys for S3 are stored with forward
// slashes regardless of host OS so downloads work consistently when
// browsed via the cloud console.
@Injectable()
export class S3Storage implements ArtifactStorage {
  private readonly logger = new Logger(S3Storage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error(
        "S3Storage: S3_BUCKET env var is required when " +
          "ARTIFACT_STORAGE_BACKEND=s3.",
      );
    }
    const region = process.env.S3_REGION ?? "auto";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3Storage: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY env vars " +
          "are required when ARTIFACT_STORAGE_BACKEND=s3.",
      );
    }
    const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
    this.bucket = bucket;
    this.keyPrefix = normalizeKeyPrefix(process.env.S3_KEY_PREFIX);
    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.logger.log(
      `artifact storage: S3-compatible bucket=${bucket} ` +
        `endpoint=${endpoint ?? "(aws default)"} ` +
        `prefix=${this.keyPrefix || "(none)"}`,
    );
  }

  private toKey(relativePath: string): string {
    if (!relativePath || typeof relativePath !== "string") {
      throw new ArtifactPathError("relativePath is required.");
    }
    if (isAbsolute(relativePath)) {
      throw new ArtifactPathError("relativePath must be relative.");
    }
    // Force forward slashes. Normalize collapses `..` segments; we
    // reject any path whose normalized form still starts with `..`
    // (which would walk above the prefix root).
    const normalized = normalize(relativePath.replace(/\\/g, "/"));
    if (normalized === ".." || normalized.startsWith("../")) {
      throw new ArtifactPathError(
        `relativePath escapes the storage root: ${relativePath}`,
      );
    }
    return this.keyPrefix + normalized;
  }

  async read(relativePath: string): Promise<Readable> {
    const Key = this.toKey(relativePath);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key }),
    );
    // In Node, Body is a Readable stream. AWS SDK v3 types it more
    // broadly because the same SDK also runs in browsers.
    if (!res.Body || !isNodeReadable(res.Body)) {
      throw new Error(
        `S3Storage.read: response body for ${Key} is not a Node stream`,
      );
    }
    return res.Body;
  }

  async exists(relativePath: string): Promise<boolean> {
    const Key = this.toKey(relativePath);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key }),
      );
      return true;
    } catch (err) {
      if (isNotFoundError(err)) return false;
      throw err;
    }
  }

  async size(relativePath: string): Promise<number> {
    const Key = this.toKey(relativePath);
    const res = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key }),
    );
    return res.ContentLength ?? 0;
  }

  async write(relativePath: string, data: Buffer): Promise<void> {
    const Key = this.toKey(relativePath);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key, Body: data }),
    );
  }

  async remove(relativePath: string): Promise<void> {
    // Path safety violations propagate (matches LocalFileSystemStorage).
    const Key = this.toKey(relativePath);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key }),
      );
    } catch (err) {
      // S3 DELETE is idempotent on most providers (a 204 even when the
      // object didn't exist), but some return errors for missing keys.
      // Don't fail the calling DB op over a stranded blob.
      if (!isNotFoundError(err)) {
        this.logger.warn(
          `delete failed for ${Key}: ${(err as Error)?.message ?? String(err)}`,
        );
      }
    }
  }
}

function normalizeKeyPrefix(raw: string | undefined): string {
  if (!raw || raw.trim() === "") return "";
  let p = raw.trim();
  // Strip leading slashes; keep trailing slash so concatenation works.
  p = p.replace(/^\/+/, "");
  if (!p.endsWith("/")) p = p + "/";
  return p;
}

function isNodeReadable(body: unknown): body is Readable {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { pipe?: unknown }).pipe === "function"
  );
}

function isNotFoundError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
}
