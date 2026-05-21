import { Global, Module } from "@nestjs/common";
import { LocalFileSystemStorage } from "./local-filesystem-storage";

export const ARTIFACT_STORAGE = Symbol("ARTIFACT_STORAGE");

// Storage is exposed through a DI token so a future S3-compatible
// implementation can be substituted without changing consumers.
@Global()
@Module({
  providers: [
    {
      provide: ARTIFACT_STORAGE,
      useClass: LocalFileSystemStorage,
    },
  ],
  exports: [ARTIFACT_STORAGE],
})
export class StorageModule {}
