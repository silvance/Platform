import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  AdminReviewListResponse,
  AdminScenarioDetail,
  AdminScenarioListQuery,
  AdminScenarioListResponse,
  AdminScenarioSummary,
  ArtifactKind,
  AuthoredArtifact,
  AuthoredIndicatorSet,
  AuthoredQuestion,
  CreateIndicatorSetRequest,
  CreateQuestionRequest,
  CreateScenarioRequest,
  MAX_ARTIFACT_BYTES,
  SetQuestionReviewRequest,
  SetScenarioReviewRequest,
  UpdateArtifactRequest,
  UpdateIndicatorSetRequest,
  UpdateQuestionRequest,
  UpdateScenarioRequest,
} from "@ci-train/contracts";
import { AuthoringService } from "./authoring.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";
import { ARTIFACT_STORAGE } from "../artifacts/storage/storage.module";
import type { ArtifactStorage } from "../artifacts/storage/artifact-storage";
import { PacksService } from "./packs.service";
import type { Response } from "express";
import { Res } from "@nestjs/common";
import { MAX_PACK_BYTES, type ImportPackResponse } from "@ci-train/contracts";

// Multer's File type isn't exported by @nestjs/platform-express in a
// usable form (no @types/multer dep). We only need the buffer + a few
// fields from the memory-storage upload, so we type them locally.
interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Admin-only surface. All routes guarded at the controller level by
// `@Roles("admin")`. M12 brought the Role enum into agreement with
// the user-facing framing; the old "instructor"/"trainee" names live
// only in deployed env files for backwards compat.
@Controller("admin/challenges")
@Roles("admin")
export class AuthoringController {
  constructor(
    private readonly authoring: AuthoringService,
    private readonly packs: PacksService,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStorage,
  ) {}

  @Get()
  async list(
    @Query() rawQuery: Record<string, string>,
  ): Promise<AdminScenarioListResponse> {
    // Per-field safeParse so a single bad query param returns 400
    // with a precise message rather than silently dropping a
    // filter the operator thought was active.
    const parsed = AdminScenarioListQuery.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid scenario filter.",
        issues: parsed.error.issues,
      });
    }
    const scenarios = await this.authoring.list(parsed.data);
    return { scenarios };
  }

  // ─── M21b admin review workflow ────────────────────────────────
  //
  // GET /v1/admin/challenges/_review
  // PATCH /v1/admin/challenges/:slug/review
  // PATCH /v1/admin/challenges/:slug/questions/:questionId/review
  //
  // `_review` (underscore prefix) is declared BEFORE the slug-
  // parameterized routes so it doesn't shadow `:slug`. The Scenario-
  // Slug regex refuses underscores, so a scenario named "_review"
  // can never be authored.

  @Get("_review")
  async listForReview(): Promise<AdminReviewListResponse> {
    const scenarios = await this.authoring.listForReview();
    return { scenarios };
  }

  @Patch(":slug/review")
  async setScenarioReview(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body(new ZodValidationPipe(SetScenarioReviewRequest))
    body: SetScenarioReviewRequest,
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<{ scenario: AdminScenarioSummary }> {
    if (!session) throw new UnauthorizedException();
    const scenario = await this.authoring.setScenarioReview(
      slug,
      session.user.id,
      { status: body.status, notes: body.notes },
    );
    return { scenario };
  }

  @Patch(":slug/questions/:questionId/review")
  async setQuestionReview(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" })) questionId: string,
    @Body(new ZodValidationPipe(SetQuestionReviewRequest))
    body: SetQuestionReviewRequest,
  ): Promise<{ question: AuthoredQuestion }> {
    const question = await this.authoring.setQuestionReview(
      slug,
      questionId,
      body.notes,
    );
    return { question };
  }

  // ─── packs (M11) ───────────────────────────────────────────────
  //
  // Declared BEFORE the slug-parameterized routes so `_import` and
  // `:slug/export` don't collide with `:slug`. The `_import` prefix
  // is also a route the ScenarioSlug regex would refuse (slugs must
  // start with [a-z0-9]), so a future admin can't author a scenario
  // with that slug and shadow the endpoint.
  @Post("_import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_PACK_BYTES, files: 1 },
    }),
  )
  async importPack(
    @CurrentSession() session: SessionContext | undefined,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ): Promise<ImportPackResponse> {
    if (!session) throw new UnauthorizedException();
    if (!file) throw new BadRequestException("Missing 'file' field.");
    return this.packs.importPack(session.user.id, file.buffer);
  }

  @Get(":slug/export")
  async exportPack(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, zipBytes } = await this.packs.exportScenario(slug);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", String(zipBytes.length));
    // Filename is safe because it's <slug>-<iso-timestamp>.zip — slug
    // is regex-validated and the timestamp has no path-meaningful
    // characters after the colon-replace.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(zipBytes);
  }

  @Get(":slug")
  async getOne(
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<AdminScenarioDetail> {
    return this.authoring.getDetail(slug);
  }

  @Post()
  async create(
    @CurrentSession() session: SessionContext | undefined,
    @Body(new ZodValidationPipe(CreateScenarioRequest))
    body: CreateScenarioRequest,
  ): Promise<AdminScenarioSummary> {
    if (!session) throw new UnauthorizedException();
    return this.authoring.create(session.user.id, body);
  }

  @Patch(":slug")
  async update(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body(new ZodValidationPipe(UpdateScenarioRequest))
    body: UpdateScenarioRequest,
  ): Promise<AdminScenarioSummary> {
    return this.authoring.update(slug, body);
  }

  @Delete(":slug")
  @HttpCode(204)
  async remove(
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<void> {
    await this.authoring.remove(slug);
  }

  // ─── questions ─────────────────────────────────────────────────

  @Post(":slug/questions")
  async addQuestion(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body(new ZodValidationPipe(CreateQuestionRequest))
    body: CreateQuestionRequest,
  ): Promise<AuthoredQuestion> {
    return this.authoring.addQuestion(slug, body);
  }

  @Patch(":slug/questions/:questionId")
  async updateQuestion(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" }))
    questionId: string,
    @Body(new ZodValidationPipe(UpdateQuestionRequest))
    body: UpdateQuestionRequest,
  ): Promise<AuthoredQuestion> {
    return this.authoring.updateQuestion(slug, questionId, body);
  }

  @Delete(":slug/questions/:questionId")
  @HttpCode(204)
  async removeQuestion(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" }))
    questionId: string,
  ): Promise<void> {
    await this.authoring.removeQuestion(slug, questionId);
  }

  // ─── indicator sets ────────────────────────────────────────────

  @Post(":slug/indicator-sets")
  async addIndicatorSet(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body(new ZodValidationPipe(CreateIndicatorSetRequest))
    body: CreateIndicatorSetRequest,
  ): Promise<AuthoredIndicatorSet> {
    return this.authoring.addIndicatorSet(slug, body);
  }

  @Patch(":slug/indicator-sets/:setId")
  async updateIndicatorSet(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("setId", new ParseUUIDPipe({ version: "4" })) setId: string,
    @Body(new ZodValidationPipe(UpdateIndicatorSetRequest))
    body: UpdateIndicatorSetRequest,
  ): Promise<AuthoredIndicatorSet> {
    return this.authoring.updateIndicatorSet(slug, setId, body);
  }

  @Delete(":slug/indicator-sets/:setId")
  @HttpCode(204)
  async removeIndicatorSet(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("setId", new ParseUUIDPipe({ version: "4" })) setId: string,
  ): Promise<void> {
    await this.authoring.removeIndicatorSet(slug, setId);
  }

  // ─── artifacts ─────────────────────────────────────────────────

  // Multer's memory storage + a hard size cap. Files larger than
  // MAX_ARTIFACT_BYTES are rejected by busboy before the handler sees
  // the buffer, which keeps a runaway upload from allocating tens of
  // MB just to be rejected.
  @Post(":slug/artifacts")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_ARTIFACT_BYTES, files: 1 },
    }),
  )
  async addArtifact(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body("displayName") displayName: string | undefined,
    @Body("kind") kindRaw: string | undefined,
    @Body("viewerHint") viewerHint: string | undefined,
  ): Promise<AuthoredArtifact> {
    if (!file) throw new BadRequestException("Missing 'file' field.");
    if (!displayName || displayName.length === 0 || displayName.length > 200) {
      throw new BadRequestException(
        "Missing or invalid 'displayName' (1–200 chars).",
      );
    }
    const kindParsed = ArtifactKind.safeParse(kindRaw);
    if (!kindParsed.success) {
      throw new BadRequestException(
        "Invalid 'kind' — must be one of text|csv|json|pdf|image|eml.",
      );
    }
    if (viewerHint !== undefined && viewerHint.length > 60) {
      throw new BadRequestException("'viewerHint' too long (max 60 chars).");
    }

    // Resolve the scenarioId first so the storage path is canonical
    // from the first write. The DB row is created after the bytes
    // land; if the row write fails we unlink to keep DB/storage in
    // sync.
    const scenarioId = await this.authoring.resolveScenarioId(slug);
    const artifactUuid = randomUUID();
    // Storage extension is derived from `kind` (a closed enum), never
    // from displayName. The DB row's displayName carries whatever the
    // admin typed; the on-disk filename uses the canonical extension
    // so the storage path can't inherit attacker-influenced semantics.
    // Serving behavior is unchanged: the streaming endpoint sets the
    // response Content-Type via safeServeMimeFor(kind, storedMime) and
    // ignores the extension entirely.
    const ext = extForKind(kindParsed.data);
    const relativePath = join(
      "scenarios",
      scenarioId,
      `${artifactUuid}${ext}`,
    );
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");

    await this.storage.write(relativePath, file.buffer);
    try {
      const { artifact } = await this.authoring.recordArtifact(slug, {
        displayName,
        kind: kindParsed.data,
        relativePath,
        sha256,
        sizeBytes: file.buffer.length,
        mimeType: file.mimetype || defaultMimeFor(kindParsed.data),
        viewerHint: viewerHint ?? null,
      });
      return artifact;
    } catch (err) {
      // DB write failed — bytes are now orphaned. Roll the disk back.
      await this.storage.remove(relativePath);
      throw err;
    }
  }

  @Patch(":slug/artifacts/:artifactId")
  async updateArtifact(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("artifactId", new ParseUUIDPipe({ version: "4" }))
    artifactId: string,
    @Body(new ZodValidationPipe(UpdateArtifactRequest))
    body: UpdateArtifactRequest,
  ): Promise<AuthoredArtifact> {
    return this.authoring.updateArtifact(slug, artifactId, body);
  }

  @Delete(":slug/artifacts/:artifactId")
  @HttpCode(204)
  async removeArtifact(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("artifactId", new ParseUUIDPipe({ version: "4" }))
    artifactId: string,
  ): Promise<void> {
    const { relativePath } = await this.authoring.removeArtifact(
      slug,
      artifactId,
    );
    // Bytes go after the metadata row. A failure here is logged and
    // swallowed by the storage layer — stranded blobs are cheaper
    // than 500'ing on a delete that already succeeded at the DB level.
    await this.storage.remove(relativePath);
  }
}

function defaultMimeFor(kind: ArtifactKind): string {
  switch (kind) {
    case "text": return "text/plain; charset=utf-8";
    case "csv":  return "text/csv; charset=utf-8";
    case "json": return "application/json; charset=utf-8";
    case "pdf":  return "application/pdf";
    case "image": return "application/octet-stream";
    case "eml":  return "message/rfc822";
  }
}

function extForKind(kind: ArtifactKind): string {
  switch (kind) {
    case "text": return ".txt";
    case "csv":  return ".csv";
    case "json": return ".json";
    case "pdf":  return ".pdf";
    // kind=image is a class, not a format. The displayed name and the
    // stored mime carry the real format; the disk file gets a generic
    // .img extension so the path doesn't claim a specific encoding.
    case "image": return ".img";
    case "eml":  return ".eml";
  }
}
