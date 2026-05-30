import { Global, Module } from "@nestjs/common";
import { LocalFileSystemStorage } from "./local-filesystem-storage";
import { S3Storage } from "./s3-storage";
import type { ArtifactStorage } from "./artifact-storage";

export const ARTIFACT_STORAGE = Symbol("ARTIFACT_STORAGE");

// Backend selection is env-driven. Default is "local" — the
// LocalFileSystemStorage class used by the Hetzner deploy. Set
// ARTIFACT_STORAGE_BACKEND=s3 to use the S3-compatible adapter
// (Cloudflare R2 / Backblaze B2 / AWS S3 / MinIO / Wasabi). See
// s3-storage.ts for the required S3_* env vars.
@Global()
@Module({
  providers: [
    {
      provide: ARTIFACT_STORAGE,
      useFactory: (): ArtifactStorage => {
        const backend = (process.env.ARTIFACT_STORAGE_BACKEND ?? "local")
          .toLowerCase()
          .trim();
        switch (backend) {
          case "s3":
            return new S3Storage();
          case "local":
          case "":
            return new LocalFileSystemStorage();
          default:
            throw new Error(
              `Unknown ARTIFACT_STORAGE_BACKEND=${backend}. ` +
                `Expected "local" or "s3".`,
            );
        }
      },
    },
  ],
  exports: [ARTIFACT_STORAGE],
})
export class StorageModule {}
