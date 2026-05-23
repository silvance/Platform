import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { hash, verify, Algorithm } from "@node-rs/argon2";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { ACCESS_CODE_REJECT_MESSAGE } from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import { AccessCodesService } from "../access-codes/access-codes.service";

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
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  // A real, valid Argon2id hash used to keep the "unknown email" path
  // doing the same hashing work as the "wrong password" path. The actual
  // plaintext is randomized at startup and never used for authentication,
  // so verify() against any submitted password always returns false while
  // running the full KDF.
  //
  // Note: this mitigates timing-based *user enumeration* (the dominant
  // concern). It does NOT make the two paths perfectly equal — a row
  // fetch on a hit still costs a few extra ms — but it eliminates the
  // ~30ms gap between "no hash to verify" and "verify a real hash".
  private dummyHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessCodes: AccessCodesService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash(
      randomBytes(32).toString("base64url"),
      ARGON_OPTS,
    );
  }

  async hashPassword(plain: string): Promise<string> {
    return hash(plain, ARGON_OPTS);
  }

  // Self-registration (M23: gated by an admin-issued access code).
  //
  // Always returns void — the caller is the public endpoint which
  // echoes a single generic response on success. This is by design:
  // returning "email already registered" would leak account
  // enumeration to anyone curl-ing the register endpoint.
  //
  // Order matters here:
  //   1. Validate-and-consume the access code FIRST inside a Prisma
  //      transaction. Failure throws BadRequestException with the
  //      generic ACCESS_CODE_REJECT_MESSAGE — same message for all
  //      modes (missing / wrong / disabled / expired / exhausted).
  //   2. With a valid code in hand, check whether the email already
  //      exists. If so, we silently no-op the user write AND we
  //      refund the access-code usage (we don't want bad-faith
  //      enumeration to drain a usesLimit-capped code).
  //   3. Otherwise create a new user with approvedAt set to NOW
  //      (so they can sign in immediately) and role="user".
  //
  // Argon2 hash work runs in both branches so the response time
  // doesn't differ between "new" and "existing" — same defense the
  // login path uses with verifyAgainstDummy.
  async register(input: {
    email: string;
    displayName: string;
    password: string;
    accessCode: string;
  }): Promise<void> {
    const passwordHash = await this.hashPassword(input.password);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await this.accessCodes.validateAndConsume(
        tx,
        input.accessCode,
      );
      if (!consumed) {
        throw new BadRequestException(ACCESS_CODE_REJECT_MESSAGE);
      }

      const existing = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing) {
        // Refund the code use so an enumeration probe doesn't drain
        // a usesLimit-capped code. The response is still the generic
        // success the caller would have seen for a brand-new email
        // (controller responsibility) so this branch is invisible
        // externally.
        await tx.accessCode.update({
          where: { code: input.accessCode.trim() },
          data: { usesCount: { decrement: 1 } },
        });
        return;
      }

      await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          role: "user",
          // M23: access-code-gated registrations are auto-approved.
          // The admin who issued the code is the trust anchor.
          approvedAt: new Date(),
        },
      });
    });
  }

  async verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plain, ARGON_OPTS);
    } catch {
      return false;
    }
  }

  // Awaits a real Argon2id verify against a random hash. Always returns
  // false; the point is the work, not the answer.
  async verifyAgainstDummy(plain: string): Promise<boolean> {
    if (!this.dummyHash) {
      // Lifecycle should have populated it; lazy fallback prevents a
      // first-request crash if onModuleInit somehow hasn't run yet.
      this.dummyHash = await hash(
        randomBytes(32).toString("base64url"),
        ARGON_OPTS,
      );
    }
    return this.verifyPassword(this.dummyHash, plain);
  }

  async login(
    email: string,
    plain: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ token: string; expiresAt: Date; user: AuthenticatedUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // On a miss, do the same Argon2id work against the precomputed dummy
    // hash so the response time isn't a user-enumeration oracle.
    const passwordOk = user
      ? await this.verifyPassword(user.passwordHash, plain)
      : await this.verifyAgainstDummy(plain);

    if (!user || user.disabled || !passwordOk) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    // M17: self-registered accounts are inert until an admin
    // approves them. Surface a distinct error so the user gets a
    // clear message rather than thinking their password is wrong.
    // For our controlled-audience deployment the small marginal
    // enumeration risk (the message confirms the email is
    // registered) is acceptable; the UX win for legitimate
    // not-yet-approved users is the more important property.
    if (user.approvedAt === null) {
      throw new ForbiddenException(
        "Your account is pending admin approval. You'll be able to sign in once an admin enables it.",
      );
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
    // Note: approvedAt is intentionally NOT checked here.
    //
    // approvedAt is the *gate at login time* — login() in this same
    // service refuses to mint a session for an unapproved user. Once
    // a session exists, by construction the user was approved at the
    // moment it was minted. The mid-session "kill switch" for an
    // already-active account is `disabled`, which IS checked below;
    // setting it via /admin/users immediately invalidates every
    // session belonging to the target.
    //
    // If a future "unapprove" / "revert to pending" feature is
    // added, the implementation must EITHER (a) revoke all of the
    // target's sessions in the same transaction (preferred — mirrors
    // disable()), OR (b) add a `session.user.approvedAt === null`
    // check here. Picking only one is correct; the choice should
    // be deliberate.
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

  // Revokes every session for a user EXCEPT the one referenced by
  // `keepSessionId` (use this from a self-service password change so
  // the user isn't logged out of the tab they're currently using).
  // Pass `null` to revoke everything (use this from admin-initiated
  // resets and the CLI recovery script).
  //
  // "Revoke" sets revokedAt rather than deleting rows — keeps
  // session history for audit + makes the operation idempotent on
  // retry. resolveSession() already filters revokedAt.
  async revokeAllSessionsForUser(
    userId: string,
    keepSessionId: string | null,
  ): Promise<{ revoked: number }> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepSessionId ? { NOT: { id: keepSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  // Self-service password change. Requires the user's current
  // password — same trust model as `sudo`: an attacker with a
  // hijacked but unauthenticated session can't silently rotate
  // credentials. Throws UnauthorizedException on a bad current
  // password (same response shape as login failure) so the
  // controller doesn't have to know.
  //
  // Side-effect: revokes every OTHER active session for this user
  // so a previously-leaked token can't outlive the rotation. The
  // current session (the one the request came in on) is kept so the
  // browser tab stays logged in.
  async changePassword(
    userId: string,
    currentSessionId: string,
    currentPlain: string,
    newPlain: string,
  ): Promise<{ revokedSessions: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Shouldn't happen if the route is auth-guarded — but treat
      // it as an auth failure rather than 404 to avoid leaking
      // whether arbitrary user ids exist.
      throw new UnauthorizedException("Invalid current password.");
    }
    const ok = await this.verifyPassword(user.passwordHash, currentPlain);
    if (!ok) {
      throw new UnauthorizedException("Invalid current password.");
    }
    const newHash = await this.hashPassword(newPlain);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    const { revoked } = await this.revokeAllSessionsForUser(
      userId,
      currentSessionId,
    );
    return { revokedSessions: revoked };
  }

  // SHA-256 of the bearer token. The raw token never lands in the DB;
  // an attacker with DB read access cannot replay sessions.
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
