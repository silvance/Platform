import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { hash, verify, Algorithm } from "@node-rs/argon2";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface SessionContext {
  sessionId: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

const TOKEN_BYTES = 32; // 256-bit random token, base64url-encoded
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Argon2id parameters — sensible 2026 defaults; tune if profiling shows
// login is a bottleneck under expected load (150–300 users).
const ARGON_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19 * 1024, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async hashPassword(plain: string): Promise<string> {
    return hash(plain, ARGON_OPTS);
  }

  async verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plain, ARGON_OPTS);
    } catch {
      return false;
    }
  }

  async login(
    email: string,
    plain: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ token: string; expiresAt: Date; user: AuthenticatedUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always verify against *something* to keep timing consistent between
    // "no such user" and "wrong password" paths. We hash a dummy on misses.
    const passwordOk = user
      ? await this.verifyPassword(user.passwordHash, plain)
      : await this.verifyPassword(
          "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          plain,
        ).then(() => false);

    if (!user || user.disabled || !passwordOk) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  async resolveSession(token: string): Promise<SessionContext | null> {
    if (!token) return null;
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    if (session.user.disabled) return null;
    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        role: session.user.role,
      },
    };
  }

  async revokeSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    try {
      await this.prisma.session.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Idempotent — logout never fails for unknown tokens.
    }
  }

  // Constant-time SHA-256 of the bearer token. The raw token never lands
  // in the DB; an attacker with DB read access cannot replay sessions.
  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  // Exposed for tests.
  static constantTimeEqualHex(a: string, b: string): boolean {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
