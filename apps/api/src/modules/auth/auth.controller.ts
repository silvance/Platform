import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
} from "@ci-train/contracts";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { Public } from "./decorators/public.decorator";
import {
  CurrentSession,
  type RequestWithSession,
} from "./decorators/current-user.decorator";
import type { SessionContext } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // M14 tightened the login throttle to 5 attempts / 5 min / *real
  // client IP*. The realness comes from the BFF forwarded-IP
  // channel — when the web layer calls /auth/login server-side, it
  // attaches X-CI-Train-Client-IP + X-CI-Train-BFF-Secret, and
  // BffForwardedThrottlerGuard keys the bucket by the forwarded IP
  // instead of the BFF's container IP. In dev, where the secret is
  // unset, the throttle falls back to req.ip — still safe, just
  // pools BFF-routed traffic together. Direct hits on the public
  // API always key on the real peer regardless.
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 5 * 60_000 } })
  @UsePipes(new ZodValidationPipe(LoginRequest))
  async login(
    @Body() body: LoginRequest,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.toString(),
    });

    return {
      user: result.user,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  // M17 self-registration. Public; account lands in pending-
  // approval state regardless of outcome. Throttle is tighter than
  // login (3 / 5 min) because every successful call writes to
  // users; combined with the M14 per-real-client-IP keying, this
  // makes bulk-spam registration impractical without distributed
  // infrastructure.
  @Public()
  @Post("register")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })
  @UsePipes(new ZodValidationPipe(RegisterRequest))
  async register(@Body() body: RegisterRequest): Promise<RegisterResponse> {
    await this.authService.register({
      email: body.email,
      displayName: body.displayName,
      password: body.password,
    });
    // Same response regardless of whether a row was created — no
    // account-enumeration via response shape or status code.
    return {
      pendingApproval: true,
      message:
        "Registration received. An administrator will review your account; you'll be able to sign in once it's enabled.",
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: RequestWithSession): Promise<void> {
    const header = req.headers["authorization"];
    const token = typeof header === "string" ? header.split(" ", 2)[1] : undefined;
    if (token) {
      await this.authService.revokeSession(token);
    }
  }

  @Get("me")
  me(@CurrentSession() session: SessionContext | undefined): MeResponse {
    if (!session) throw new UnauthorizedException();
    return {
      user: session.user,
      session: { expiresAt: session.expiresAt.toISOString() },
    };
  }

  // Self-service password change. Throttled at the same rate as
  // login (5 / 5 min per real-client IP) — currentPassword is
  // a credential, so the same brute-force pressure applies.
  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 5 * 60_000 } })
  @UsePipes(new ZodValidationPipe(ChangePasswordRequest))
  async changePassword(
    @Body() body: ChangePasswordRequest,
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<void> {
    if (!session) throw new UnauthorizedException();
    await this.authService.changePassword(
      session.user.id,
      session.sessionId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
