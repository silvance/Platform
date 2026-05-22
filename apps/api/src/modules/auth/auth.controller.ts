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
import { LoginRequest, LoginResponse, MeResponse } from "@ci-train/contracts";
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
}
