import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../auth.service";
import { PUBLIC_METADATA_KEY } from "../decorators/public.decorator";
import type { RequestWithSession } from "../decorators/current-user.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_METADATA_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestWithSession>();
    const token = extractBearerToken(req.headers["authorization"]);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const session = await this.authService.resolveSession(token);
    if (!session) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    req.session = session;
    return true;
  }
}

function extractBearerToken(header: string | string[] | undefined): string | null {
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const [scheme, token] = value.split(" ", 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}
