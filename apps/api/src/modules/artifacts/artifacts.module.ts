import { Module } from "@nestjs/common";
import { ArtifactsService } from "./artifacts.service";
import { ArtifactsController } from "./artifacts.controller";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [StorageModule],
  providers: [ArtifactsService],
  controllers: [ArtifactsController],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
