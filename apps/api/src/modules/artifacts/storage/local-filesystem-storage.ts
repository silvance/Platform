import { promises as fs, createReadStream } from "node:fs";
import { dirname, isAbsolute, normalize, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { Injectable, Logger } from "@nestjs/common";
import {
  ArtifactStorage,
  ArtifactPathError,
} from "./artifact-storage";

const DEFAULT_ROOT = "/data/artifacts";

@Injectable()
export class LocalFileSystemStorage implements ArtifactStorage {
  private readonly logger = new Logger(LocalFileSystemStorage.name);
  private readonly root: string;

  constructor() {
    const configured = process.env.ARTIFACT_STORAGE_ROOT ?? DEFAULT_ROOT;
    // Resolve once at startup. All subsequent path joins are compared
    // against this canonical root to detect escapes.
    this.root = resolve(configured);
    this.logger.log(`artifact storage root: ${this.root}`);
  }

  private resolveSafe(relativePath: string): string {
    if (!relativePath || typeof relativePath !== "string") {
      throw new ArtifactPathError("relativePath is required.");
    }
    if (isAbsolute(relativePath)) {
      throw new ArtifactPathError("relativePath must be relative.");
    }
    // Normalize collapses `..` segments. We then verify the resolved path
    // is inside the storage root, which catches both `..` traversal and
    // symlink games on the *resolved* side. Symlink-based escapes still
    // require lstat() during reads — but seed/import paths only write
    // through this storage, so symlinks can't be planted by users.
    const normalized = normalize(relativePath);
    const absolute = resolve(this.root, normalized);
    const rootWithSep = this.root.endsWith(sep) ? this.root : this.root + sep;
    if (absolute !== this.root && !absolute.startsWith(rootWithSep)) {
      throw new ArtifactPathError(
        `relativePath escapes the storage root: ${relativePath}`,
      );
    }
    return absolute;
  }

  async read(relativePath: string): Promise<Readable> {
    const abs = this.resolveSafe(relativePath);
    // Stream rather than buffer — artifact files can be tens of MB.
    return createReadStream(abs);
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      const abs = this.resolveSafe(relativePath);
      await fs.access(abs);
      return true;
    } catch {
      return false;
    }
  }

  async size(relativePath: string): Promise<number> {
    const abs = this.resolveSafe(relativePath);
    const stat = await fs.stat(abs);
    return stat.size;
  }

  async write(relativePath: string, data: Buffer): Promise<void> {
    const abs = this.resolveSafe(relativePath);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
  }
}
