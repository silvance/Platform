import type { Readable } from "node:stream";

// Storage backend interface. M3 ships with a local-filesystem
// implementation; an S3-compatible backend can be added later by
// implementing this interface without touching ArtifactsService.
//
// All paths passed in are *relative* to the configured storage root.
// Implementations MUST reject paths that escape that root.
export interface ArtifactStorage {
  read(relativePath: string): Promise<Readable>;
  exists(relativePath: string): Promise<boolean>;
  size(relativePath: string): Promise<number>;
  write(relativePath: string, data: Buffer): Promise<void>;
  // Best-effort delete. Implementations MUST treat a missing file as
  // a no-op (idempotent) rather than throwing.
  remove(relativePath: string): Promise<void>;
}

export class ArtifactPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactPathError";
  }
}
