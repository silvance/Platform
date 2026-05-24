import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type Role } from "@prisma/client";
import type {
  AdminStatsResponse,
  AdminUserSummary,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import { AuthService } from "../auth/auth.service";

// Admin user management (M15). Lifts the seed-script-only "create
// + reset password" surface up onto an authenticated API, so a
// deployer doesn't need shell access to add a user or recover an
// account.
//
// Invariants the service guarantees on top of the schema:
//   - Email uniqueness is enforced by the unique citext index; we
//     turn the underlying Prisma error into a clean 409 so the
//     caller doesn't have to introspect prisma error codes.
//   - Password hashes never enter request/response shapes; only
//     hashed values reach the DB.
//   - We never allow the only admin in the system to demote or
//     disable themselves — locking yourself out of admin is the
//     #1 way this kind of UI gets people stuck.
//
// What this service does NOT do (deliberate, document later):
//   - Hard delete. User has FK references from authored content
//     (scenarios) and progress. `disabled` is the supported
//     soft-delete and is what the UI exposes for now.
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(): Promise<AdminUserSummary[]> {
    const rows = await this.prisma.user.findMany({
      // Pending-approval rows (approvedAt = NULL) first so a new
      // self-registration is obvious the moment an admin opens the
      // page. Postgres's default for ASC is NULLS LAST — we want
      // the opposite — so the `nulls: "first"` qualifier is the
      // load-bearing bit, not the asc/desc choice. After the
      // pending group, fall back to the pre-M17 ordering (role
      // then email).
      orderBy: [
        { approvedAt: { sort: "asc", nulls: "first" } },
        { role: "asc" },
        { email: "asc" },
      ],
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabled: true,
        createdAt: true,
        approvedAt: true,
        lastLoginAt: true,
      },
    });
    return rows.map(this.toSummary);
  }

  async get(id: string): Promise<AdminUserSummary> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabled: true,
        createdAt: true,
        approvedAt: true,
        lastLoginAt: true,
      },
    });
    if (!row) throw new NotFoundException("User not found.");
    return this.toSummary(row);
  }

  async create(input: {
    email: string;
    displayName: string;
    role: Role;
    password: string;
  }): Promise<AdminUserSummary> {
    const passwordHash = await this.auth.hashPassword(input.password);
    try {
      const row = await this.prisma.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          passwordHash,
          // Admin-created accounts are auto-approved (the admin is
          // the trust anchor). Only self-registered accounts land
          // with approvedAt: null and need approve() before login.
          approvedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          disabled: true,
          createdAt: true,
          approvedAt: true,
          lastLoginAt: true,
        },
      });
      return this.toSummary(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          `A user with email ${input.email} already exists.`,
        );
      }
      throw err;
    }
  }

  // Updates the mutable subset of fields. Self-protection rules:
  //   - actorId may not demote themselves out of admin if they're
  //     the last admin standing.
  //   - actorId may not disable themselves at all (the UI has no
  //     mechanism to re-enable a disabled account except via
  //     another admin, so self-disable is a foot-gun).
  async update(
    actorId: string,
    targetId: string,
    patch: {
      displayName?: string;
      role?: Role;
      disabled?: boolean;
    },
  ): Promise<AdminUserSummary> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException("User not found.");

    if (actorId === targetId) {
      if (patch.disabled === true) {
        throw new ForbiddenException("You can't disable your own account.");
      }
      if (patch.role === "user" && target.role === "admin") {
        await this.assertNotLastAdmin(targetId);
      }
    } else if (patch.role === "user" && target.role === "admin") {
      await this.assertNotLastAdmin(targetId);
    }

    if (patch.disabled === true && target.role === "admin") {
      await this.assertNotLastAdmin(targetId);
    }

    const row = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.disabled !== undefined ? { disabled: patch.disabled } : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabled: true,
        createdAt: true,
        approvedAt: true,
        lastLoginAt: true,
      },
    });

    // Disabling a user must immediately kill their active sessions.
    // resolveSession() already refuses a token whose user.disabled
    // is true, but explicitly revoking the rows makes the intent
    // visible in the session table and forces any in-flight
    // requests to fail on the next session check.
    if (patch.disabled === true) {
      await this.auth.revokeAllSessionsForUser(targetId, null);
    }

    return this.toSummary(row);
  }

  // Admin-initiated password reset (no current-password challenge).
  // Always revokes ALL of the target's sessions — the operator is
  // assumed to be acting in response to a credential compromise or
  // a forgotten password, so any session that pre-dates the reset
  // must be considered untrusted.
  async resetPassword(
    targetId: string,
    plain: string,
  ): Promise<{ user: AdminUserSummary; revokedSessions: number }> {
    const exists = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("User not found.");

    const passwordHash = await this.auth.hashPassword(plain);
    const row = await this.prisma.user.update({
      where: { id: targetId },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabled: true,
        createdAt: true,
        approvedAt: true,
        lastLoginAt: true,
      },
    });
    const { revoked } = await this.auth.revokeAllSessionsForUser(targetId, null);
    return { user: this.toSummary(row), revokedSessions: revoked };
  }

  private async assertNotLastAdmin(userId: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: {
        role: "admin",
        disabled: false,
        NOT: { id: userId },
      },
    });
    if (remaining === 0) {
      throw new BadRequestException(
        "Refusing to leave the system without an enabled admin.",
      );
    }
  }

  // M17: admin-approve a self-registered (pending) account. Sets
  // approvedAt = now; the user can sign in from the next request
  // onward. Idempotent — approving an already-approved row is a
  // no-op (the timestamp doesn't get re-bumped on re-approve, so
  // the audit trail keeps the original approval time).
  async approve(targetId: string): Promise<AdminUserSummary> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, approvedAt: true },
    });
    if (!target) throw new NotFoundException("User not found.");
    if (target.approvedAt !== null) {
      // Already approved — re-read to return the canonical row.
      return this.get(targetId);
    }
    const row = await this.prisma.user.update({
      where: { id: targetId },
      data: { approvedAt: new Date() },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabled: true,
        createdAt: true,
        approvedAt: true,
        lastLoginAt: true,
      },
    });
    return this.toSummary(row);
  }

 // helpers. Read-only; cheap aggregate queries; surfaced
  // by the /admin/stats controller + the authenticated layout
  // (header pending badge).

  // Called on every authenticated layout render for an admin user
  // to drive the header badge. Single indexed-int read.
  async countPendingApprovals(): Promise<number> {
    return this.prisma.user.count({ where: { approvedAt: null } });
  }

  async getStats(): Promise<AdminStatsResponse> {
    // Parallel aggregates so the latency is dominated by the
    // slowest call, not the sum of all of them.
    const [
      totalUsers,
      adminUsers,
      pendingUsers,
      disabledUsers,
      scenariosByStatus,
      scenariosByReview,
      attemptsCompleted,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "admin" } }),
      this.prisma.user.count({ where: { approvedAt: null } }),
      this.prisma.user.count({ where: { disabled: true } }),
      this.prisma.scenario.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.scenario.groupBy({
        by: ["reviewStatus"],
        _count: { _all: true },
      }),
      this.prisma.scenarioProgress.count({
        where: { completedAt: { not: null } },
      }),
    ]);

    const byStatus = { published: 0, draft: 0, archived: 0 };
    for (const row of scenariosByStatus) {
      const k = row.status as keyof typeof byStatus;
      if (k in byStatus) byStatus[k] = row._count._all;
    }

    // Collapse the 6 "something is wrong" review verdicts into
    // a single `flagged` bucket for the dashboard card. The
    // /admin/review page surfaces the breakdown.
    const byReview = { needs_review: 0, approved: 0, flagged: 0 };
    for (const row of scenariosByReview) {
      const status = row.reviewStatus;
      if (status === "needs_review" || status === "approved") {
        byReview[status] = row._count._all;
      } else {
        byReview.flagged += row._count._all;
      }
    }

    const totalScenarios =
      byStatus.published + byStatus.draft + byStatus.archived;

    return {
      users: {
        total: totalUsers,
        byRole: {
          admin: adminUsers,
          user: totalUsers - adminUsers,
        },
        pendingApproval: pendingUsers,
        disabled: disabledUsers,
      },
      scenarios: {
        total: totalScenarios,
        byStatus,
        byReview,
      },
      attempts: {
        completedAllTime: attemptsCompleted,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private toSummary = (row: {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    disabled: boolean;
    createdAt: Date;
    approvedAt: Date | null;
    lastLoginAt: Date | null;
  }): AdminUserSummary => ({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    disabled: row.disabled,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  });
}
