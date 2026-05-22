import { Module } from "@nestjs/common";
import { ArtifactsService } from "./artifacts.service";
import { ArtifactsController } from "./artifacts.controller";
import { EmlParseService } from "./eml-parse.service";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [StorageModule],
  providers: [ArtifactsService, EmlParseService],
  controllers: [ArtifactsController],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
