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

  // Login throttle is intentionally loose (10/min/IP) until the BFF
  // client-IP propagation lands. Today the web layer calls /auth/login
  // server-side, so every browser-driven login looks to the API like
  // it's coming from the BFF's IP — tightening the limit would
  // pool a whole LAN cohort behind a single bucket and lock real
  // users out. See docs/known-limitations.md for the propagation
  // design.
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
