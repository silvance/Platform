import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import {
  AdminCreateUserRequest,
  AdminResetPasswordRequest,
  AdminUpdateUserRequest,
  AdminUserListResponse,
  AdminUserResponse,
} from "@ci-train/contracts";
import { UsersService } from "./users.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

// Admin user management surface (M15). Mirrors the pattern in
// AuthoringController: controller-level @Roles("admin") plus the
// global RolesGuard short-circuits anything that isn't an admin
// session.
//
// Password values never appear in any response shape — the only way
// a plaintext password leaves this surface is in the bytes the
// admin themselves typed into the create/reset form.
@Controller("admin/users")
@Roles("admin")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(): Promise<AdminUserListResponse> {
    return { users: await this.users.list() };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(AdminCreateUserRequest))
  async create(
    @Body() body: AdminCreateUserRequest,
  ): Promise<AdminUserResponse> {
    const user = await this.users.create({
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      password: body.password,
    });
    return { user };
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(AdminUpdateUserRequest))
  async update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: AdminUpdateUserRequest,
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<AdminUserResponse> {
    if (!session) throw new UnauthorizedException();
    const user = await this.users.update(session.user.id, id, {
      displayName: body.displayName,
      role: body.role,
      disabled: body.disabled,
    });
    return { user };
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<AdminUserResponse> {
    const user = await this.users.approve(id);
    return { user };
  }

  // Hard-delete. Distinct from disable: a disabled account stays
  // in the table (and in the /admin/users list) but can't sign in;
  // a deleted account is gone, cascade-cleaning per-user data and
  // null-ing out authorship on anything they wrote. Used to retire
  // pilot accounts without leaving the list cluttered.
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<void> {
    if (!session) throw new UnauthorizedException();
    await this.users.delete(session.user.id, id);
  }

  @Post(":id/password")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(AdminResetPasswordRequest))
  async resetPassword(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: AdminResetPasswordRequest,
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<AdminUserResponse> {
    if (!session) throw new UnauthorizedException();
    // Resetting your own password through the admin surface would
    // bypass the current-password challenge. Route admins to the
    // self-service flow instead.
    if (session.user.id === id) {
      throw new BadRequestException(
        "Use the self-service password change to set your own password.",
      );
    }
    const result = await this.users.resetPassword(id, body.password);
    return { user: result.user };
  }
}
