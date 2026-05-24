import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
} from "@nestjs/common";
import {
  AccessCodeListResponse,
  CreateAccessCodeRequest,
  CreateAccessCodeResponse,
  DisableAccessCodeResponse,
} from "@ci-train/contracts";
import { AccessCodesService } from "./access-codes.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

// admin CRUD for registration access codes. Mirrors the
// UsersController pattern — controller-level @Roles("admin") plus
// the global RolesGuard short-circuits anything that isn't an
// admin session.
//
// Codes appear ONLY on this admin-only surface. No user-facing
// endpoint returns the literal `code` string.
@Controller("admin/access-codes")
@Roles("admin")
export class AccessCodesController {
  constructor(private readonly codes: AccessCodesService) {}

  @Get()
  async list(): Promise<AccessCodeListResponse> {
    return { codes: await this.codes.list() };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateAccessCodeRequest))
  async create(
    @CurrentSession() session: SessionContext,
    @Body() body: CreateAccessCodeRequest,
  ): Promise<CreateAccessCodeResponse> {
    const code = await this.codes.create(session.user.id, {
      label: body.label,
      code: body.code,
      usesLimit: body.usesLimit,
      expiresAt: body.expiresAt,
    });
    return { code };
  }

  @Patch(":id/disable")
  async disable(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<DisableAccessCodeResponse> {
    const code = await this.codes.disable(id);
    return { code };
  }
}
